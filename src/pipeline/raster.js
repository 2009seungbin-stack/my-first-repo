/** Pixel buffers for the recipe pipeline: straight (non-premultiplied) RGBA in Uint8ClampedArray.
 * Pure JS, no DOM: the same code runs in the pipeline worker, on the page and in Node tests, and
 * gives the same bytes everywhere (integer outputs of fixed float formulas, no canvas resampling).
 *
 *   Doc   {items:[Item], notes:[string]}            what flows from step to step
 *   Item  {name, w, h, frames:[{data, ms}]}           one sticker / picture; frames share w×h */

/** @typedef {{data:Uint8ClampedArray,ms:number}} Frame */
/** @typedef {{name:string,w:number,h:number,frames:Frame[]}} Item */
/** @typedef {{items:Item[],notes:string[]}} Doc */

export const blank=(w,h)=>new Uint8ClampedArray(w*h*4);
/** @returns {Item} */
export const item=(name,w,h,data,ms=0)=>({name,w,h,frames:[{data,ms}]});
export const withFrames=(it,w,h,frames)=>({name:it.name,w,h,frames});
/** Apply fn(data,w,h) → {data,w,h} to every frame of an item (all frames give the same size). */
export function mapFrames(it,fn){
 let w=it.w,h=it.h;const frames=it.frames.map(f=>{const r=fn(f.data,it.w,it.h);w=r.w;h=r.h;return {data:r.data,ms:f.ms};});
 return {name:it.name,w,h,frames};
}

// ---------------------------------------------------------------- measurement
/** Bounding box of pixels with alpha > cut, or null. */
export function alphaBounds(data,w,h,cut=8){
 let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++){const row=y*w*4;for(let x=0;x<w;x++)if(data[row+x*4+3]>cut){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;y1=y;}}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
export function hasTransparency(data,cut=250){for(let i=3;i<data.length;i+=4)if(data[i]<cut)return true;return false;}
/** The backdrop seen at the picture's edge: the most common colour (5-bit bins, averaged) of the border
 * pixels, and the share of border pixels within `tol` of it. Transparent edges count as transparent. */
export function borderColor(data,w,h,tol=36){
 const bins=new Map();let n=0,clear=0,top=null,topN=0;
 const take=i=>{n++;if(data[i+3]<16){clear++;return;}const k=(data[i]>>3)<<10|(data[i+1]>>3)<<5|(data[i+2]>>3);let e=bins.get(k);if(!e)bins.set(k,e=[0,0,0,0]);e[0]++;e[1]+=data[i];e[2]+=data[i+1];e[3]+=data[i+2];if(e[0]>topN){topN=e[0];top=e;}};
 const step=Math.max(1,Math.floor((w+h)/2048));
 for(let x=0;x<w;x+=step){take(x*4);take(((h-1)*w+x)*4);}
 for(let y=1;y<h-1;y+=step){take(y*w*4);take((y*w+w-1)*4);}
 if(clear>n/2)return {transparent:true,color:[0,0,0],share:clear/n};
 const color=top?[1,2,3].map(i=>Math.round(top[i]/top[0])):[255,255,255];
 let near=0;const lim=tol*tol;
 const test=i=>{if(data[i+3]<16)return;const r=data[i]-color[0],g=data[i+1]-color[1],b=data[i+2]-color[2];if(r*r+g*g+b*b<=lim)near++;};
 for(let x=0;x<w;x+=step){test(x*4);test(((h-1)*w+x)*4);}
 for(let y=1;y<h-1;y+=step){test(y*w*4);test((y*w+w-1)*4);}
 return {transparent:false,color,share:near/Math.max(1,n-clear)};
}
/** The backdrop's own noise: 1.6 × the 90th percentile of the border's distance to the backdrop colour,
 * never below the recipe's tolerance, at most 100 (AI backdrops are gradients and grain, not flat). */
export function adaptiveTolerance(data,w,h,color,tol){
 const d=[];const take=i=>{if(data[i+3]<16)return;const r=data[i]-color[0],g=data[i+1]-color[1],b=data[i+2]-color[2];d.push(Math.sqrt(r*r+g*g+b*b));};
 const step=Math.max(1,Math.floor((w+h)/1024));for(let x=0;x<w;x+=step){take(x*4);take(((h-1)*w+x)*4);}for(let y=0;y<h;y+=step){take(y*w*4);take((y*w+w-1)*4);}
 if(!d.length)return tol;d.sort((a,b)=>a-b);const p90=d[Math.floor(d.length*.9)];
 // Only the part of the border that IS backdrop counts (a sticker touching the edge is not noise).
 return Math.round(Math.min(100,Math.max(tol,p90<tol*2.5?p90*1.6:tol)));
}
/** Bounding box of what differs from the backdrop (alpha when the picture has transparency). */
export function contentBounds(data,w,h,tol=36){
 const b=borderColor(data,w,h,tol);
 if(b.transparent)return alphaBounds(data,w,h,16);
 const [R,G,B]=b.color,lim=tol*tol;let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(data[i+3]<16)continue;const r=data[i]-R,g=data[i+1]-G,bl=data[i+2]-B;if(r*r+g*g+bl*bl>lim){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;y1=y;}}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}

// ---------------------------------------------------------------- copy / place
/** Copy a rectangle (may reach outside the source: transparent there). */
export function cropRect(data,w,h,r){
 const out=blank(r.w,r.h);
 const sx0=Math.max(0,r.x),sy0=Math.max(0,r.y),sx1=Math.min(w,r.x+r.w),sy1=Math.min(h,r.y+r.h);
 for(let y=sy0;y<sy1;y++)out.set(data.subarray((y*w+sx0)*4,(y*w+sx1)*4),((y-r.y)*r.w+(sx0-r.x))*4);
 return out;
}
/** Source-over composite of `top` onto `base` (both straight RGBA, same size) at offset; returns base. */
export function over(base,bw,bh,top,tw,th,ox=0,oy=0){
 for(let y=0;y<th;y++){const by=y+oy;if(by<0||by>=bh)continue;
  for(let x=0;x<tw;x++){const bx=x+ox;if(bx<0||bx>=bw)continue;const i=(y*tw+x)*4,j=(by*bw+bx)*4,a=top[i+3];if(!a)continue;
   if(a===255||!base[j+3]){base[j]=top[i];base[j+1]=top[i+1];base[j+2]=top[i+2];base[j+3]=a;continue;}
   const sa=a/255,da=base[j+3]/255,oa=sa+da*(1-sa);
   for(let c=0;c<3;c++)base[j+c]=Math.round((top[i+c]*sa+base[j+c]*da*(1-sa))/oa);base[j+3]=Math.round(oa*255);}}
 return base;
}
export function fill(w,h,rgb){const out=blank(w,h);for(let i=0;i<out.length;i+=4){out[i]=rgb[0];out[i+1]=rgb[1];out[i+2]=rgb[2];out[i+3]=255;}return out;}
export const hexRGB=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

// ---------------------------------------------------------------- resampling
/** Lanczos-3 weights per output pixel (start, count, weights), normalised, support widened when shrinking. */
function contributions(inSize,outSize,offset=0,scale=outSize/inSize){
 const s=Math.min(1,scale),support=3/s,list=[];
 const L=x=>{x=Math.abs(x);if(x<1e-9)return 1;if(x>=3)return 0;const px=Math.PI*x;return 3*Math.sin(px)*Math.sin(px/3)/(px*px);};
 for(let o=0;o<outSize;o++){
  const center=(o+.5)/scale-offset,start=Math.max(0,Math.floor(center-support)),end=Math.min(inSize-1,Math.ceil(center+support));
  const wts=[];let sum=0;for(let i=start;i<=end;i++){const v=L((i+.5-center)*s);wts.push(v);sum+=v;}
  if(sum===0){const i=Math.min(inSize-1,Math.max(0,Math.floor(center)));list.push({start:i,w:new Float64Array([1])});continue;}
  list.push({start,w:Float64Array.from(wts,v=>v/sum)});
 }
 return list;
}
/** Resize straight RGBA to ow×oh: Lanczos-3 on premultiplied colour (no dark fringes at transparent
 * edges), separable, deterministic. kind 'nearest' copies pixels. */
export function resize(data,w,h,ow,oh,kind='smooth'){
 ow=Math.max(1,Math.round(ow));oh=Math.max(1,Math.round(oh));
 if(ow===w&&oh===h)return new Uint8ClampedArray(data);
 if(kind==='nearest'){const out=blank(ow,oh);for(let y=0;y<oh;y++){const sy=Math.min(h-1,Math.floor((y+.5)*h/oh));for(let x=0;x<ow;x++){const sx=Math.min(w-1,Math.floor((x+.5)*w/ow));const i=(sy*w+sx)*4,j=(y*ow+x)*4;out[j]=data[i];out[j+1]=data[i+1];out[j+2]=data[i+2];out[j+3]=data[i+3];}}return out;}
 const cx=contributions(w,ow),cy=contributions(h,oh);
 // Horizontal pass into premultiplied floats.
 const mid=new Float32Array(ow*h*4);
 for(let y=0;y<h;y++){const row=y*w*4,orow=y*ow*4;for(let x=0;x<ow;x++){const c=cx[x];let r=0,g=0,b=0,a=0;for(let k=0;k<c.w.length;k++){const i=row+(c.start+k)*4,wt=c.w[k],al=data[i+3]*wt;r+=data[i]*al;g+=data[i+1]*al;b+=data[i+2]*al;a+=al;}const j=orow+x*4;mid[j]=r;mid[j+1]=g;mid[j+2]=b;mid[j+3]=a;}}
 const out=blank(ow,oh);
 for(let y=0;y<oh;y++){const c=cy[y];for(let x=0;x<ow;x++){let r=0,g=0,b=0,a=0;for(let k=0;k<c.w.length;k++){const i=((c.start+k)*ow+x)*4,wt=c.w[k];r+=mid[i]*wt;g+=mid[i+1]*wt;b+=mid[i+2]*wt;a+=mid[i+3]*wt;}
  const j=(y*ow+x)*4;if(a<=.5){out[j+3]=0;continue;}out[j]=Math.round(r/a);out[j+1]=Math.round(g/a);out[j+2]=Math.round(b/a);out[j+3]=Math.round(a);}}
 return out;
}
/** Long side down to `side` (never up). */
export function limitSide(data,w,h,side){
 const s=Math.min(1,side/Math.max(w,h));if(s>=1)return {data,w,h};
 const ow=Math.max(1,Math.round(w*s)),oh=Math.max(1,Math.round(h*s));return {data:resize(data,w,h,ow,oh),w:ow,h:oh};
}

// ---------------------------------------------------------------- warp
/** Affine warp about the canvas centre: scale sx/sy, rotation (radians), translation (px), alpha factor.
 * Bilinear on premultiplied colour, same canvas size. */
export function warp(data,w,h,{sx=1,sy=1,rot=0,dx=0,dy=0,alpha=1}={}){
 const out=blank(w,h),cx=w/2,cy=h/2,cos=Math.cos(-rot),sin=Math.sin(-rot);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  // Inverse map: output → source.
  const px=x+.5-cx-dx,py=y+.5-cy-dy,rx=(px*cos-py*sin)/sx+cx-.5,ry=(px*sin+py*cos)/sy+cy-.5;
  const x0=Math.floor(rx),y0=Math.floor(ry),fx=rx-x0,fy=ry-y0;let r=0,g=0,b=0,a=0;
  for(let k=0;k<4;k++){const xx=x0+(k&1),yy=y0+(k>>1);if(xx<0||yy<0||xx>=w||yy>=h)continue;const wt=(k&1?fx:1-fx)*(k>>1?fy:1-fy);if(!wt)continue;const i=(yy*w+xx)*4,al=data[i+3]*wt;r+=data[i]*al;g+=data[i+1]*al;b+=data[i+2]*al;a+=al;}
  const j=(y*w+x)*4;if(a<=.5)continue;out[j]=Math.round(r/a);out[j+1]=Math.round(g/a);out[j+2]=Math.round(b/a);out[j+3]=Math.round(a*alpha);
 }
 return out;
}

// ---------------------------------------------------------------- hashing (cache keys, determinism checks)
/** FNV-1a 32 over a byte view, as 8 hex digits. */
export function fnv(bytes,h=0x811c9dc5){for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,0x01000193);}return h>>>0;}
export const hex8=n=>(n>>>0).toString(16).padStart(8,'0');
export function hashText(s,h=0x811c9dc5){for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;}
export function hashDoc(doc){let h=0x811c9dc5;for(const it of doc.items){h=hashText(`${it.name}|${it.w}x${it.h}|${it.frames.length}`,h);for(const f of it.frames){h=hashText(`|${f.ms}|`,h);h=fnv(f.data,h);}}return hex8(h);}
