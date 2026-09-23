/** Pixel-editor raster primitives for the Pixel workspace. Pure: no DOM.
 *
 * Everything works on a PLANE: {w, h, data} where `data` is either a Uint32Array of packed RGBA
 * (little-endian: r | g<<8 | b<<16 | a<<24, the same bytes as an RGBA Uint8Array — see rgbaView)
 * for RGB sprites, or a Uint8Array of palette indices for indexed sprites. A value is one pixel;
 * `clear` is the transparent value (0 in RGBA, the transparent index when indexed). All shapes are
 * produced as whole pixels in plane coordinates; nothing here anti-aliases.
 *
 * The algorithms follow Aseprite where it has one: Bresenham lines, Zingl's ellipse in a bounding
 * box, 4-connected bucket fill with a per-channel tolerance, pixel-perfect removal of L-corners,
 * shading ink that moves a pixel one step along a ramp, Bayer ordered dithering. */
export const RGBA=0,INDEXED=1;
/** Packed RGBA ↔ bytes. The packing matches a Uint8Array RGBA buffer viewed as Uint32 on
 * little-endian machines (every browser and Node on x86/ARM). */
export const pack=(r,g,b,a=255)=>a?((r&255)|(g&255)<<8|(b&255)<<16|(a&255)<<24)>>>0:0;
export const unpack=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
export const alphaOf=v=>v>>>24;
export function plane(w,h,kind=RGBA,fill=0){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('A plane needs a positive integer size');
 const data=kind===INDEXED?new Uint8Array(w*h):new Uint32Array(w*h);if(fill)data.fill(fill);
 return {w,h,data};
}
export const clonePlane=p=>({w:p.w,h:p.h,data:p.data.slice()});
export const inside=(p,x,y)=>x>=0&&y>=0&&x<p.w&&y<p.h;
/** RGBA bytes → packed plane; every fully transparent pixel becomes 0 so "transparent" is one value. */
export function planeFromRGBA(data,w,h){
 const out=new Uint32Array(w*h),src=data instanceof Uint32Array?data:new Uint32Array(data.buffer,data.byteOffset,w*h);
 for(let i=0;i<out.length;i++){const v=src[i];out[i]=v>>>24?v:0;}
 return {w,h,data:out};
}
/** Byte view of a packed plane (no copy). */
export const rgbaView=p=>new Uint8Array(p.data.buffer,p.data.byteOffset,p.w*p.h*4);
// ------------------------------------------------------------------ brushes
export const MAX_BRUSH=64;
/** Offsets [dx0,dy0,dx1,dy1,…] of a brush footprint around its hot spot. Square and round brushes
 * of even size put the extra pixel right/down, as Aseprite does. */
const brushCache=new Map();
export function brushOffsets(size=1,shape='square'){
 size=Math.max(1,Math.min(MAX_BRUSH,Math.round(size)));const key=size+shape;let o=brushCache.get(key);if(o)return o;
 const out=[],c=Math.floor(size/2),r=size/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  if(shape==='round'&&size>2){const dx=x+.5-r,dy=y+.5-r;if(dx*dx+dy*dy>r*r+.01)continue;}
  out.push(x-c,y-c);
 }
 o=Int16Array.from(out);brushCache.set(key,o);return o;
}
// ------------------------------------------------------------------ lines and shapes
/** Bresenham: every pixel from (x0,y0) to (x1,y1) inclusive, 8-connected. */
export function linePoints(x0,y0,x1,y1){
 x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
 const out=[],dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx+dy,x=x0,y=y0;
 for(;;){out.push([x,y]);if(x===x1&&y===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x+=sx;}if(e2<=dx){err+=dx;y+=sy;}}
 return out;
}
/** Shift-constrained line end: the angle snaps to the pixel-art set 0°, 26.57° (2:1), 45°,
 * 63.43° (1:2), 90° and their mirrors, keeping the longer axis length. */
export function snapLineEnd(x0,y0,x1,y1){
 const dx=x1-x0,dy=y1-y0,ax=Math.abs(dx),ay=Math.abs(dy);if(!ax&&!ay)return [x1,y1];
 const ratios=[[1,0],[2,1],[1,1],[1,2],[0,1]];const ang=Math.atan2(ay,ax);let best=ratios[0],d=Infinity;
 for(const r of ratios){const e=Math.abs(Math.atan2(r[1],r[0])-ang);if(e<d){d=e;best=r;}}
 const sx=Math.sign(dx)||1,sy=Math.sign(dy)||1;
 if(best[1]===0)return [x0+dx,y0];if(best[0]===0)return [x0,y0+dy];
 // length along the dominant axis of the chosen ratio, rounded to whole steps of the ratio
 const k=Math.max(1,Math.round(best[0]>=best[1]?ax/best[0]:ay/best[1]));
 return [x0+sx*k*best[0],y0+sy*k*best[1]];
}
/** Rectangle between two corners (inclusive). `filled` gives every pixel, else the 1-px border. */
export function rectPixels(x0,y0,x1,y1,filled=false){
 const l=Math.min(x0,x1),r=Math.max(x0,x1),t=Math.min(y0,y1),b=Math.max(y0,y1),out=[];
 for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)if(filled||y===t||y===b||x===l||x===r)out.push([x,y]);
 return out;
}
/** Ellipse inscribed in the box (x0,y0)–(x1,y1) inclusive: Alois Zingl's integer algorithm (the one
 * Aseprite uses), which is symmetric and never leaves gaps. `filled` returns the spans' pixels. */
export function ellipsePixels(x0,y0,x1,y1,filled=false){
 if(x0>x1)[x0,x1]=[x1,x0];if(y0>y1)[y0,y1]=[y1,y0];
 const set=new Map(),put=(x,y)=>{if(filled){const s=set.get(y);if(!s)set.set(y,[x,x]);else{if(x<s[0])s[0]=x;if(x>s[1])s[1]=x;}}else set.set(x+','+y,[x,y]);};
 let a=Math.abs(x1-x0),b=Math.abs(y1-y0),b1=b&1;
 if(a===0||b===0){for(const p of linePoints(x0,y0,x1,y1))put(p[0],p[1]);}
 else{
  let dx=4*(1-a)*b*b,dy=4*(b1+1)*a*a,err=dx+dy+b1*a*a,e2;
  y0+=(b+1)>>1;y1=y0-b1;a*=8*a;b1=8*b*b;
  do{put(x1,y0);put(x0,y0);put(x0,y1);put(x1,y1);e2=2*err;if(e2<=dy){y0++;y1--;err+=dy+=a;}if(e2>=dx||2*err>dy){x0++;x1--;err+=dx+=b1;}}while(x0<=x1);
  while(y0-y1<=b){put(x0-1,y0);put(x1+1,y0++);put(x0-1,y1);put(x1+1,y1--);}
 }
 const out=[];
 if(filled){for(const [y,[l,r]]of set)for(let x=l;x<=r;x++)out.push([x,y]);}
 else for(const p of set.values())out.push(p);
 return out;
}
/** Pixel-perfect filter over a whole freehand path (unit steps): drops every L-corner pixel, i.e.
 * a point whose neighbours before and after touch it on different axes and each other diagonally. */
export function pixelPerfect(points){
 const out=[];
 for(const p of points){
  const n=out.length;if(n&&out[n-1][0]===p[0]&&out[n-1][1]===p[1])continue;
  out.push(p);
  if(out.length>=3){const a=out[out.length-3],b=out[out.length-2],c=out[out.length-1];if(isCorner(a,b,c))out.splice(out.length-2,1);}
 }
 return out;
}
export const isCorner=(a,b,c)=>(a[0]===b[0]||a[1]===b[1])&&(c[0]===b[0]||c[1]===b[1])&&a[0]!==c[0]&&a[1]!==c[1]&&Math.abs(a[0]-c[0])===1&&Math.abs(a[1]-c[1])===1;
// ------------------------------------------------------------------ symmetry
/** Mirror images of a pixel. `axisX`/`axisY` are boundary coordinates (whole or half pixels):
 * a vertical axis at 8 mirrors x=7 onto x=8; at 8.5 it runs through the centre of pixel 8. */
export function mirrorPoints(x,y,{mode='none',axisX=0,axisY=0}={}){
 const out=[[x,y]];
 const mx=Math.round(2*axisX-x-1),my=Math.round(2*axisY-y-1);
 if(mode==='x'||mode==='both')out.push([mx,y]);
 if(mode==='y'||mode==='both')out.push([x,my]);
 if(mode==='both')out.push([mx,my]);
 return out;
}
// ------------------------------------------------------------------ dithering
const bayer=n=>{if(n===1)return [0];const h=n/2,m=bayer(h),o=new Array(n*n),c=[0,2,3,1];for(let y=0;y<n;y++)for(let x=0;x<n;x++)o[y*n+x]=4*m[(y%h)*h+x%h]+c[(y<h?0:2)+(x<h?0:1)];return o;};
/** Ordered patterns: an n×n threshold matrix with `levels` distinct thresholds. */
export const DITHER_PATTERNS=Object.freeze({
 bayer2:{n:2,m:bayer(2),levels:4},bayer4:{n:4,m:bayer(4),levels:16},bayer8:{n:8,m:bayer(8),levels:64},
 checker:{n:2,m:[0,1,1,0],levels:2},lines:{n:2,m:[0,0,1,1],levels:2},columns:{n:2,m:[0,1,0,1],levels:2}});
/** True when the first colour goes at (x, y) for a pattern at `density` 0…1. Anchored at the
 * canvas origin, so strokes that overlap continue the same pattern (no seams). */
export function ditherOn(x,y,pattern='bayer4',density=.5){
 const p=DITHER_PATTERNS[pattern]||DITHER_PATTERNS.bayer4,n=p.n;
 return p.m[((y%n+n)%n)*n+((x%n+n)%n)]<Math.round(Math.max(0,Math.min(1,density))*p.levels);
}
// ------------------------------------------------------------------ colour distance for tolerance
/** Aseprite-style tolerance: every channel within `tol` (0…255). Transparent matches transparent. */
export function withinTolerance(a,b,tol,kind=RGBA,colorOf=null){
 if(a===b)return true;if(!tol)return false;
 const ca=kind===INDEXED?colorOf(a):unpack(a),cb=kind===INDEXED?colorOf(b):unpack(b);
 if(!ca||!cb)return false;
 if(!ca[3]&&!cb[3])return true;
 return Math.abs(ca[0]-cb[0])<=tol&&Math.abs(ca[1]-cb[1])<=tol&&Math.abs(ca[2]-cb[2])<=tol&&Math.abs(ca[3]-cb[3])<=tol;
}
// ------------------------------------------------------------------ fill / magic wand
/** Pixels the bucket (or magic wand) takes from (x, y): a Uint8Array mask of the plane.
 * `contiguous` floods through 4-connected (or 8 with `diagonal`) neighbours within tolerance of the
 * start colour; otherwise every matching pixel in the plane. `sample` is the plane colours are read
 * from (the merged image when "sample all layers"); `limit` restricts it to a selection mask. */
export function floodMask(p,x,y,{tolerance=0,contiguous=true,diagonal=false,kind=RGBA,colorOf=null,sample=null,limit=null}={}){
 const s=sample||p,{w,h}=p,out=new Uint8Array(w*h);if(!inside(p,x,y))return {mask:out,count:0};
 const start=s.data[y*w+x];let count=0;
 const match=i=>(!limit||limit[i])&&withinTolerance(s.data[i],start,tolerance,kind,colorOf);
 if(!contiguous){for(let i=0;i<w*h;i++)if(match(i)){out[i]=1;count++;}return {mask:out,count};}
 if(limit&&!limit[y*w+x])return {mask:out,count:0};
 const stack=new Int32Array(w*h);let top=0;stack[top++]=y*w+x;out[y*w+x]=1;count=1;
 while(top){
  const i=stack[--top],cx=i%w,cy=(i-cx)/w;
  const tryPush=j=>{if(!out[j]&&match(j)){out[j]=1;count++;stack[top++]=j;}};
  if(cx>0)tryPush(i-1);if(cx<w-1)tryPush(i+1);if(cy>0)tryPush(i-w);if(cy<h-1)tryPush(i+w);
  if(diagonal){if(cx>0&&cy>0)tryPush(i-w-1);if(cx<w-1&&cy>0)tryPush(i-w+1);if(cx>0&&cy<h-1)tryPush(i+w-1);if(cx<w-1&&cy<h-1)tryPush(i+w+1);}
 }
 return {mask:out,count};
}
// ------------------------------------------------------------------ selection masks
export const emptyMask=(w,h)=>new Uint8Array(w*h);
export function maskFromRect(w,h,r){const m=new Uint8Array(w*h),x0=Math.max(0,r.x),y0=Math.max(0,r.y),x1=Math.min(w,r.x+r.w),y1=Math.min(h,r.y+r.h);for(let y=y0;y<y1;y++)m.fill(1,y*w+x0,y*w+x1);return m;}
/** Polygon (lasso) → mask: a pixel is inside when its centre is (even-odd rule). Points in pixel
 * coordinates (fractional allowed). Pixels the outline itself passes through are included, so a
 * thin lasso still selects what was drawn over. */
export function maskFromPolygon(w,h,points){
 const m=new Uint8Array(w*h);if(points.length<2)return m;
 const n=points.length;
 for(let y=0;y<h;y++){
  const cy=y+.5,xs=[];
  for(let i=0;i<n;i++){const [ax,ay]=points[i],[bx,by]=points[(i+1)%n];if((ay<=cy&&by>cy)||(by<=cy&&ay>cy))xs.push(ax+(cy-ay)*(bx-ax)/(by-ay));}
  xs.sort((a,b)=>a-b);
  for(let k=0;k+1<xs.length;k+=2){const x0=Math.max(0,Math.ceil(xs[k]-.5)),x1=Math.min(w-1,Math.floor(xs[k+1]-.5));for(let x=x0;x<=x1;x++)m[y*w+x]=1;}
 }
 for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%n];for(const [x,y]of linePoints(Math.floor(a[0]),Math.floor(a[1]),Math.floor(b[0]),Math.floor(b[1])))if(x>=0&&y>=0&&x<w&&y<h)m[y*w+x]=1;}
 return m;
}
/** Combine a new selection with the current one: replace, add (Shift), subtract (Alt), intersect (Shift+Alt). */
export function combineMask(cur,next,mode='replace'){
 if(mode==='replace'||!cur)return next;
 const out=new Uint8Array(next.length);
 for(let i=0;i<out.length;i++)out[i]=mode==='add'?cur[i]|next[i]:mode==='subtract'?cur[i]&&!next[i]?1:0:cur[i]&next[i];
 return out;
}
export const invertMask=m=>{const o=new Uint8Array(m.length);for(let i=0;i<m.length;i++)o[i]=m[i]?0:1;return o;};
export function maskBounds(m,w,h){
 let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++){const row=y*w;for(let x=0;x<w;x++)if(m[row+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;y1=y;}}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
export const maskCount=m=>{let n=0;for(let i=0;i<m.length;i++)n+=m[i]?1:0;return n;};
/** Boundary edges of a mask for marching ants: [x0,y0,x1,y1,…] segments in pixel-corner
 * coordinates, horizontal runs merged so a 512×512 rectangle is 4 segments, not 2048. */
export function maskEdges(m,w,h){
 const out=[],at=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&m[y*w+x]?1:0;
 for(let y=0;y<=h;y++){let run=0,dir=0;
  for(let x=0;x<=w;x++){const a=at(x,y-1),b=at(x,y),d=x<w&&a!==b?(a?1:2):0;if(d!==dir){if(dir)out.push(run,y,x,y);run=x;dir=d;}}}
 for(let x=0;x<=w;x++){let run=0,dir=0;
  for(let y=0;y<=h;y++){const a=at(x-1,y),b=at(x,y),d=y<h&&a!==b?(a?1:2):0;if(d!==dir){if(dir)out.push(x,run,x,y);run=y;dir=d;}}}
 return out;
}
// ------------------------------------------------------------------ floating pieces (move / copy / paste)
/** Lifts the masked pixels: {x, y, w, h, data (plane values), mask} cropped to the mask's bounds.
 * `cut` clears them from the plane (returns a new plane). */
export function lift(p,m,{cut=false,clear=0}={}){
 const b=maskBounds(m,p.w,p.h);if(!b)return null;
 const data=new p.data.constructor(b.w*b.h),mask=new Uint8Array(b.w*b.h);
 if(clear)data.fill(clear);
 const next=cut?clonePlane(p):p;
 for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const i=(b.y+y)*p.w+b.x+x;if(!m[i])continue;data[y*b.w+x]=p.data[i];mask[y*b.w+x]=1;if(cut)next.data[i]=clear;}
 return {piece:{x:b.x,y:b.y,w:b.w,h:b.h,data,mask},plane:next};
}
/** Stamps a floating piece onto a plane (in place). Transparent pieces pixels do not overwrite,
 * like Aseprite's mask colour; `opaqueOnly:false` copies them too. */
export function stamp(p,piece,{clear=0,opaqueOnly=true,limit=null}={}){
 const x0=Math.max(0,piece.x),y0=Math.max(0,piece.y),x1=Math.min(p.w,piece.x+piece.w),y1=Math.min(p.h,piece.y+piece.h);
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const s=(y-piece.y)*piece.w+x-piece.x;if(!piece.mask[s])continue;const v=piece.data[s];if(opaqueOnly&&v===clear)continue;const i=y*p.w+x;if(limit&&!limit[i])continue;p.data[i]=v;}
 return p;
}
export function flipPiece(piece,axis='x'){
 const {w,h}=piece,data=new piece.data.constructor(w*h),mask=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=axis==='x'?w-1-x:x,sy=axis==='y'?h-1-y:y;data[y*w+x]=piece.data[sy*w+sx];mask[y*w+x]=piece.mask[sy*w+sx];}
 return {...piece,data,mask};
}
/** 90° rotation about the piece's centre (whole pixels: the centre of an odd/even box is kept to
 * within half a pixel, rounding towards the top-left, the same every time so four turns return). */
export function rotatePiece(piece,dir='cw'){
 const {w,h}=piece,data=new piece.data.constructor(w*h),mask=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=dir==='cw'?h-1-y:y,ny=dir==='cw'?x:w-1-x,d=ny*h+nx;data[d]=piece.data[y*w+x];mask[d]=piece.mask[y*w+x];}
 const cx2=2*piece.x+w,cy2=2*piece.y+h;// doubled centre
 return {...piece,w:h,h:w,x:Math.floor((cx2-h)/2),y:Math.floor((cy2-w)/2),data,mask};
}
export const pieceMaskOn=(piece,w,h)=>{const m=new Uint8Array(w*h);for(let y=0;y<piece.h;y++)for(let x=0;x<piece.w;x++){const X=piece.x+x,Y=piece.y+y;if(X<0||Y<0||X>=w||Y>=h||!piece.mask[y*piece.w+x])continue;m[Y*w+X]=1;}return m;};
// ------------------------------------------------------------------ whole-plane edits
/** Replace colour: every pixel equal to (or within tolerance of) `from` becomes `to`. */
export function replaceColor(p,from,to,{tolerance=0,kind=RGBA,colorOf=null,limit=null}={}){
 const out=clonePlane(p);let n=0;
 for(let i=0;i<p.data.length;i++){if(limit&&!limit[i])continue;if(withinTolerance(p.data[i],from,tolerance,kind,colorOf)&&p.data[i]!==to){out.data[i]=to;n++;}}
 return {plane:out,changed:n};
}
const N4=[[1,0],[-1,0],[0,1],[0,-1]],N8=[...N4,[1,1],[1,-1],[-1,1],[-1,-1]];
export const OUTLINE_MATRICES=Object.freeze({circle:N4,square:N8,horizontal:[[1,0],[-1,0]],vertical:[[0,1],[0,-1]]});
/** Aseprite's Edit › FX › Outline on one plane: `outside` paints transparent pixels that touch an
 * opaque one (by the chosen matrix); `inside` paints opaque pixels that touch a transparent one or
 * the plane edge. Only pixels inside `limit` (the selection) change. */
export function outline(p,value,{place='outside',matrix='circle',clear=0,limit=null}={}){
 const out=clonePlane(p),{w,h}=p,nb=OUTLINE_MATRICES[matrix]||N4;let n=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(limit&&!limit[i])continue;const solid=p.data[i]!==clear;
  if(place==='outside'?solid:!solid)continue;
  let hit=false;
  for(const [dx,dy]of nb){const X=x+dx,Y=y+dy,o=X>=0&&Y>=0&&X<w&&Y<h?p.data[Y*w+X]!==clear:false;if(place==='outside'?o:!o){hit=true;break;}}
  if(hit&&out.data[i]!==value){out.data[i]=value;n++;}
 }
 return {plane:out,changed:n};
}
/** Drop shadow: transparent pixels whose (x−dx, y−dy) is opaque become `value`. */
export function dropShadow(p,value,{dx=1,dy=1,clear=0,limit=null}={}){
 const out=clonePlane(p),{w,h}=p;let n=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(p.data[i]!==clear||(limit&&!limit[i]))continue;const X=x-dx,Y=y-dy;if(X<0||Y<0||X>=w||Y>=h)continue;if(p.data[Y*w+X]!==clear){out.data[i]=value;n++;}}
 return {plane:out,changed:n};
}
/** Opaque bounds of a plane, or null when it is fully transparent. */
export function planeBounds(p,clear=0){
 let x0=p.w,y0=p.h,x1=-1,y1=-1;
 for(let y=0;y<p.h;y++){const row=y*p.w;for(let x=0;x<p.w;x++)if(p.data[row+x]!==clear){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;y1=y;}}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
export function cropPlane(p,r,clear=0){
 const out=new p.data.constructor(r.w*r.h);if(clear)out.fill(clear);
 for(let y=0;y<r.h;y++){const sy=r.y+y;if(sy<0||sy>=p.h)continue;const x0=Math.max(0,r.x),x1=Math.min(p.w,r.x+r.w);if(x1>x0)out.set(p.data.subarray(sy*p.w+x0,sy*p.w+x1),y*r.w+x0-r.x);}
 return {w:r.w,h:r.h,data:out};
}
/** Places plane `src` at (dx, dy) on a new w×h plane (clipped). */
export function placePlane(src,w,h,dx,dy,clear=0){
 const out=new src.data.constructor(w*h);if(clear)out.fill(clear);
 for(let y=0;y<src.h;y++){const ty=y+dy;if(ty<0||ty>=h)continue;const x0=Math.max(0,-dx),x1=Math.min(src.w,w-dx);if(x1>x0)out.set(src.data.subarray(y*src.w+x0,y*src.w+x1),ty*w+dx+x0);}
 return {w,h,data:out};
}
export function samePlane(a,b){if(a.w!==b.w||a.h!==b.h)return false;for(let i=0;i<a.data.length;i++)if(a.data[i]!==b.data[i])return false;return true;}
/** Dirty-rectangle helper: union of rects (null = empty). */
export const unionRect=(a,b)=>!a?b:!b?a:(()=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};})();
export const clipRect=(r,w,h)=>{if(!r)return null;const x=Math.max(0,r.x),y=Math.max(0,r.y),x1=Math.min(w,r.x+r.w),y1=Math.min(h,r.y+r.h);return x1>x&&y1>y?{x,y,w:x1-x,h:y1-y}:null;};
