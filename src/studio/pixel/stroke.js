/** One paint gesture of the Pixel workspace (pencil, eraser, line, rectangle, ellipse, dither,
 * shading, spray-free). Pure: no DOM.
 *
 * Like Aseprite's tool loop, a stroke reads every pixel from a SNAPSHOT of the plane taken when the
 * gesture began and writes into the live plane. So an ink is applied at most once per pixel per
 * stroke (passing over a pixel twice with shading ink moves it one step, not two; alpha ink does
 * not build up), and "revert" is exact. Shape tools redraw from the snapshot on every move.
 *
 * Pixel-perfect (1-px brush): when three consecutive unit steps form an L, the corner pixel is
 * given back to the snapshot — unless another part of the stroke also painted it (hit counts). */
import {brushOffsets,linePoints,mirrorPoints,ditherOn,isCorner,unpack,pack,RGBA,INDEXED} from './raster.js';
import {blendRGBA} from '../../game/aseprite-blend.js';
export const INKS=Object.freeze(['simple','alpha','lockAlpha','shading','replace']);
export class Stroke{
 /** @param target plane {w,h,data} painted in place
  * @param o {kind, clear, ink, value, value2 (dither second colour, null = leave the pixel),
  *   from (replace ink: the colour to replace), size, shape, pixelPerfect, symmetry {mode,axisX,axisY},
  *   dither {pattern, density} | null, ramp (shading: values dark → light), rampDir (+1 / −1),
  *   limit (selection mask, Uint8Array) } */
 constructor(target,o={}){
  this.p=target;this.src=target.data.slice();this.o={kind:RGBA,clear:0,ink:'simple',value:0,value2:null,from:null,size:1,shape:'square',pixelPerfect:false,symmetry:null,dither:null,ramp:null,rampDir:1,limit:null,...o};
  this.hits=new Uint16Array(target.w*target.h);this.touched=[];this.dirty=null;this.path=[];this.last=null;
  this.offsets=brushOffsets(this.o.size,this.o.shape);
  this.rampIndex=null;
  if(this.o.ink==='shading'&&this.o.ramp?.length){this.rampIndex=new Map();this.o.ramp.forEach((v,k)=>{if(!this.rampIndex.has(v))this.rampIndex.set(v,k);});}
  this.tmp=new Uint8Array(4);
 }
 /** Value the ink writes over `s` (the snapshot pixel) at (x, y); undefined = leave it. */
 inkValue(s,x,y){
  const o=this.o;let v=o.value;
  if(o.dither){if(!ditherOn(x,y,o.dither.pattern,o.dither.density)){if(o.value2==null)return undefined;v=o.value2;}}
  switch(o.ink){
   case 'shading':{if(!this.rampIndex)return undefined;const k=this.rampIndex.get(s);if(k==null)return undefined;const n=Math.max(0,Math.min(o.ramp.length-1,k+o.rampDir));return o.ramp[n];}
   case 'replace':return s===o.from?v:undefined;
   case 'lockAlpha':{if(s===o.clear)return undefined;if(o.kind===INDEXED)return v;const [r,g,b]=unpack(v),a=s>>>24;return pack(r,g,b,a);}
   case 'alpha':{
    if(o.kind===INDEXED)return v;const a=v>>>24;if(a===255||s===0)return v;if(!a)return s;
    const t=this.tmp,c=unpack(s);t[0]=c[0];t[1]=c[1];t[2]=c[2];t[3]=c[3];blendRGBA(t,0,v&255,v>>>8&255,v>>>16&255,a,255,0);return pack(t[0],t[1],t[2],t[3]);
   }
   default:return v;
  }
 }
 put(x,y){
  const p=this.p;if(x<0||y<0||x>=p.w||y>=p.h)return;const i=y*p.w+x;
  if(this.o.limit&&!this.o.limit[i])return;
  if(!this.hits[i]){this.touched.push(i);const v=this.inkValue(this.src[i],x,y);if(v!==undefined)p.data[i]=v;this.grow(x,y);}
  this.hits[i]++;
 }
 unput(x,y){
  const p=this.p;if(x<0||y<0||x>=p.w||y>=p.h)return;const i=y*p.w+x;if(!this.hits[i])return;
  if(--this.hits[i]===0)p.data[i]=this.src[i];
 }
 grow(x,y){const d=this.dirty;if(!d){this.dirty={x,y,w:1,h:1};return;}if(x<d.x){d.w+=d.x-x;d.x=x;}else if(x>=d.x+d.w)d.w=x-d.x+1;if(y<d.y){d.h+=d.y-y;d.y=y;}else if(y>=d.y+d.h)d.h=y-d.y+1;}
 /** The brush footprint at (x, y) with every symmetry mirror. */
 stampAt(x,y,fn){
  const off=this.offsets,s=this.o.symmetry,mode=s?.mode||'none',copies=[[x,y,1,1]];
  if(mode!=='none'){const [mx,my]=mirrorPoints(x,y,{mode:'both',axisX:s.axisX,axisY:s.axisY})[3];
   if(mode==='x'||mode==='both')copies.push([mx,y,-1,1]);if(mode==='y'||mode==='both')copies.push([x,my,1,-1]);if(mode==='both')copies.push([mx,my,-1,-1]);}
  // a mirrored copy uses the mirrored footprint, so even-sized brushes stay symmetric too
  for(const [cx,cy,fx,fy]of copies)for(let k=0;k<off.length;k+=2)fn(cx+fx*off[k],cy+fy*off[k+1]);
 }
 stamp(x,y){this.stampAt(x,y,(a,b)=>this.put(a,b));}
 unstamp(x,y){this.stampAt(x,y,(a,b)=>this.unput(a,b));}
 /** Freehand: a new pointer position (whole pixels). Gaps are filled with a Bresenham line. */
 point(x,y){
  x=Math.floor(x);y=Math.floor(y);
  const pts=this.last?linePoints(this.last[0],this.last[1],x,y).slice(1):[[x,y]];
  this.last=[x,y];
  const perfect=this.o.pixelPerfect&&this.o.size===1;
  for(const pt of pts){
   const path=this.path,n=path.length;
   if(n&&path[n-1][0]===pt[0]&&path[n-1][1]===pt[1])continue;
   path.push(pt);this.stamp(pt[0],pt[1]);
   if(perfect&&path.length>=3){const a=path[path.length-3],b=path[path.length-2],c=path[path.length-1];if(isCorner(a,b,c)){this.unstamp(b[0],b[1]);path.splice(path.length-2,1);}}
  }
 }
 /** Shape tools: replace whatever the stroke drew with these pixels (each stamped with the brush). */
 shape(points){this.revert();for(const [x,y]of points)this.stamp(x,y);}
 /** Plain pixel set without the brush (filled shapes, fills). */
 pixels(points){for(const [x,y]of points)this.put(x,y);}
 /** Every pixel of a mask (bucket fill). */
 mask(m){const {w}=this.p;for(let i=0;i<m.length;i++)if(m[i]){const x=i%w;this.put(x,(i-x)/w);}}
 revert(){for(const i of this.touched){this.p.data[i]=this.src[i];this.hits[i]=0;}this.touched=[];this.dirty=null;this.path=[];}
 get changed(){for(const i of this.touched)if(this.p.data[i]!==this.src[i])return true;return false;}
 /** Snapshot as a plane (what the layer looked like before the gesture). */
 get before(){return {w:this.p.w,h:this.p.h,data:this.src};}
}
