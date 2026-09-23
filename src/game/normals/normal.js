/** Height (px) → tangent-space normal map, with the edge mode chosen per texture, pixel-art
 * quantisation, normal-aware mipmaps and seam measurements. Pure (no DOM).
 *
 * Convention (same as src/game/texture-normal.js): X = image right, Z = out of the surface.
 * 'opengl' = green up as displayed (Godot, Unity, Blender); 'directx' = green down (Unreal).
 * With image rows counted downward, n ∝ (−∂h/∂x, +∂h/∂y_down, 1) for OpenGL.
 * Byte encoding: v → round((v+1)·127.5); the flat normal is (128,128,255). */
import {edgeTable,EDGE_MODES} from './height.js';
export const CONVENTIONS=Object.freeze(['opengl','directx']);
/** Derivative kernels, separable: `d` differentiates, `s` smooths across. Each is normalised so a
 * ramp of one unit per pixel yields exactly 1. 'central' does not smooth at all — the choice for
 * pixel art, where a one-pixel ledge must stay one pixel wide. */
export const KERNELS=Object.freeze({
 central:{d:[-.5,0,.5],s:[1]},
 sobel3:{d:[-.5,0,.5],s:[.25,.5,.25]},
 scharr:{d:[-.5,0,.5],s:[3/16,10/16,3/16]},
 sobel5:{d:[-1/8,-2/8,0,2/8,1/8],s:[1/16,4/16,6/16,4/16,1/16]}
});
export const KERNEL_IDS=Object.freeze(Object.keys(KERNELS));
const enc=v=>{const b=Math.round((v+1)*127.5);return b<0?0:b>255?255:b;};
export const decodeByte=b=>(b-127.5)/127.5;
/** Separable correlation of `src` with `kx` along x then `ky` along y, sampling past the border
 * with the edge mode. Returns a new Float32Array. */
function sep(src,w,h,kx,ky,mode){
 const rx=(kx.length-1)>>1,ry=(ky.length-1)>>1,tx=edgeTable(w,rx,mode),ty=edgeTable(h,ry,mode),tmp=new Float32Array(w*h),out=new Float32Array(w*h);
 for(let y=0;y<h;y++){const row=y*w;for(let x=0;x<w;x++){let s=0;for(let k=0;k<kx.length;k++){const c=kx[k];if(c)s+=c*src[row+tx[x+k]];}tmp[row+x]=s;}}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0;for(let k=0;k<ky.length;k++){const c=ky[k];if(c)s+=c*tmp[ty[y+k]*w+x];}out[y*w+x]=s;}
 return out;
}
/** ∂h/∂x and ∂h/∂y (y downward) with the given kernel and edge mode. */
export function gradients(height,w,h,{kernel='sobel3',edge='clamp'}={}){
 if(height.length!==w*h)throw Error('Height does not match the given dimensions');
 const K=KERNELS[kernel];if(!K)throw Error('Unknown derivative kernel');
 if(!EDGE_MODES.includes(edge))throw Error('Unknown edge mode');
 return {gx:sep(height,w,h,K.d,K.s,edge),gy:sep(height,w,h,K.s,K.d,edge)};
}
/** Float normals (x, y-as-stored, z) for a height field. `strength` scales the relief. */
export function normalsFromHeight(height,w,h,{strength=1,kernel='sobel3',edge='clamp',convention='opengl'}={}){
 if(!CONVENTIONS.includes(convention))throw Error('Unknown normal convention');
 if(!Number.isFinite(strength)||strength<0||strength>64)throw Error('Strength must be between 0 and 64');
 const {gx,gy}=gradients(height,w,h,{kernel,edge}),ys=convention==='opengl'?1:-1,out=new Float32Array(w*h*3);
 for(let p=0;p<w*h;p++){
  const nx=-gx[p]*strength,ny=gy[p]*strength*ys,l=Math.hypot(nx,ny,1);
  out[p*3]=nx/l;out[p*3+1]=ny/l;out[p*3+2]=1/l;
 }
 return out;
}
/** Quantises normals the way pixel artists paint them: the tilt snaps to `tiers` steps (plus
 * flat) up to `maxTilt` degrees, the direction to `directions` evenly spaced angles (4 = the four
 * sides, 8 adds diagonals). Each pixel is snapped on its own, so edges stay one pixel crisp. */
export function quantizeNormals(n,count,{directions=8,tiers=2,maxTilt=60}={}){
 if(![4,8,16,32].includes(directions))throw Error('Directions must be 4, 8, 16 or 32');
 if(!Number.isInteger(tiers)||tiers<1||tiers>4)throw Error('Tiers must be 1–4');
 const out=new Float32Array(n.length),step=2*Math.PI/directions,tStep=maxTilt/tiers*Math.PI/180;
 for(let p=0;p<count;p++){
  const x=n[p*3],y=n[p*3+1],z=n[p*3+2],tilt=Math.acos(Math.max(-1,Math.min(1,z)));
  let k=Math.round(tilt/tStep);if(k>tiers)k=tiers;
  if(!k){out[p*3+2]=1;continue;}
  const a=Math.round(Math.atan2(y,x)/step)*step,t=k*tStep,s=Math.sin(t);
  out[p*3]=Math.cos(a)*s;out[p*3+1]=Math.sin(a)*s;out[p*3+2]=Math.cos(t);
 }
 return out;
}
/** Float normals → RGBA bytes. Outside `mask` (transparent pixels) the flat normal is written, and
 * alpha is always 255: engines that pack normals (Unity's DXT5nm path reads R·A) must not see a
 * zero alpha under a sprite's edge. */
export function encodeNormals(n,w,h,{mask=null}={}){
 const out=new Uint8Array(w*h*4);
 for(let p=0;p<w*h;p++){
  const i=p*4;
  if(mask&&!mask[p]){out[i]=128;out[i+1]=128;out[i+2]=255;out[i+3]=255;continue;}
  out[i]=enc(n[p*3]);out[i+1]=enc(n[p*3+1]);out[i+2]=enc(n[p*3+2]);out[i+3]=255;
 }
 return out;
}
/** Normals of transparent pixels copied outwards from the nearest opaque ones for `pixels` rings,
 * so bilinear filtering and mipmaps at a sprite's edge do not blend in the flat background normal. */
export function bleedNormals(rgba,mask,w,h,pixels=2){
 const out=new Uint8Array(rgba),have=new Uint8Array(mask);
 for(let r=0;r<pixels;r++){
  const add=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const p=y*w+x;if(have[p])continue;let sx=0,sy=0,sz=0,n=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;if(!have[q])continue;sx+=decodeByte(out[q*4]);sy+=decodeByte(out[q*4+1]);sz+=decodeByte(out[q*4+2]);n++;}
   if(n){const l=Math.hypot(sx,sy,sz)||1;add.push(p,enc(sx/l),enc(sy/l),enc(sz/l));}
  }
  if(!add.length)break;
  for(let i=0;i<add.length;i+=4){const p=add[i];out[p*4]=add[i+1];out[p*4+1]=add[i+2];out[p*4+2]=add[i+3];have[p]=1;}
 }
 return out;
}
/** Decoded unit vectors of an RGBA normal map (the stored y, whatever convention it is in). */
export function decodeNormals(rgba,w,h){
 const out=new Float32Array(w*h*3);
 for(let p=0;p<w*h;p++){const x=decodeByte(rgba[p*4]),y=decodeByte(rgba[p*4+1]),z=decodeByte(rgba[p*4+2]),l=Math.hypot(x,y,z)||1;out[p*3]=x/l;out[p*3+1]=y/l;out[p*3+2]=z/l;}
 return out;
}
/** Mipmaps for a normal map: average the VECTORS and renormalise. A plain RGB average (what a
 * colour mip does) shortens the vectors, so lighting flattens and darkens at a distance.
 * Alpha, if `mask` is given, is carried as the fraction of covered texels. */
export function normalMipChain(rgba,w,h,{levels=4}={}){
 const chain=[{level:0,width:w,height:h,data:rgba}];let src=decodeNormals(rgba,w,h),sw=w,sh=h,srcA=null;
 for(let p=0;p<w*h&&!srcA;p++)if(rgba[p*4+3]!==255)srcA=true;
 let alpha=srcA?Float32Array.from({length:w*h},(_,p)=>rgba[p*4+3]):null;
 for(let level=1;level<=levels;level++){
  const dw=Math.max(1,sw>>1),dh=Math.max(1,sh>>1),n=new Float32Array(dw*dh*3),a=alpha?new Float32Array(dw*dh):null,data=new Uint8Array(dw*dh*4);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
   let sx=0,sy=0,sz=0,sa=0;
   for(const [ox,oy]of [[0,0],[1,0],[0,1],[1,1]]){const q=Math.min(sh-1,y*2+oy)*sw+Math.min(sw-1,x*2+ox);sx+=src[q*3];sy+=src[q*3+1];sz+=src[q*3+2];if(alpha)sa+=alpha[q];}
   const l=Math.hypot(sx,sy,sz)||1,p=y*dw+x;n[p*3]=sx/l;n[p*3+1]=sy/l;n[p*3+2]=sz/l;
   data[p*4]=enc(n[p*3]);data[p*4+1]=enc(n[p*3+1]);data[p*4+2]=enc(n[p*3+2]);data[p*4+3]=alpha?Math.round(sa/4):255;if(a)a[p]=sa/4;
  }
  chain.push({level,width:dw,height:dh,data});src=n;alpha=a;sw=dw;sh=dh;
  if(dw===1&&dh===1)break;
 }
 return chain;
}
// ------------------------------------------------------------------ seams
/** How well a map tiles: mean per-channel |Δ| across the wrap seam (last column → first column,
 * last row → first row), against the same measure between neighbouring columns/rows inside the
 * image. ratio ≈ 1 means the seam looks like any other pixel step; a clamped kernel on a
 * tileable texture gives a ratio well above 1. Computed on R and G (the slope channels). */
export function seamError(rgba,w,h,{channels=[0,1]}={}){
 const diff=(a,b)=>{let s=0;for(const c of channels)s+=Math.abs(rgba[a*4+c]-rgba[b*4+c]);return s/channels.length;};
 let seamV=0,seamH=0,inV=0,inH=0,maxSeam=0;
 for(let y=0;y<h;y++){const d=diff(y*w+w-1,y*w);seamV+=d;if(d>maxSeam)maxSeam=d;for(let x=0;x+1<w;x++)inV+=diff(y*w+x,y*w+x+1);}
 for(let x=0;x<w;x++){const d=diff((h-1)*w+x,x);seamH+=d;if(d>maxSeam)maxSeam=d;for(let y=0;y+1<h;y++)inH+=diff(y*w+x,(y+1)*w+x);}
 const seam=(seamV/h+seamH/w)/2,inside=(w>1&&h>1)?(inV/(h*(w-1))+inH/(w*(h-1)))/2:0;
 return {seam,inside,ratio:inside>1e-9?seam/inside:seam>0?Infinity:1,maxSeam};
}
/** Shift-consistency at the border — the exact test for "is this kernel wrap-correct": generate
 * from the texture, and from the texture rolled by half its size, roll the second result back,
 * and compare. A wrap-correct generator gives identical bytes everywhere; a clamped one differs
 * in the rows and columns next to the original border. Returns per-pixel |Δ| stats on the border
 * band (`band` px wide) and in the interior. */
export function rollConsistency(a,b,w,h,{band=2}={}){
 let sb=0,nb=0,si=0,ni=0,maxBand=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=(y*w+x)*4,d=(Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2]))/3;
  const border=x<band||y<band||x>=w-band||y>=h-band;
  if(border){sb+=d;nb++;if(d>maxBand)maxBand=d;}else{si+=d;ni++;}
 }
 return {border:nb?sb/nb:0,interior:ni?si/ni:0,maxBorder:maxBand};
}
/** Rolls an RGBA (or any 4-channel) image by (dx, dy) with wrap-around. */
export function roll(rgba,w,h,dx,dy,channels=4){
 const out=new rgba.constructor(rgba.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=((x-dx)%w+w)%w,sy=((y-dy)%h+h)%h;for(let c=0;c<channels;c++)out[(y*w+x)*channels+c]=rgba[(sy*w+sx)*channels+c];}
 return out;
}
