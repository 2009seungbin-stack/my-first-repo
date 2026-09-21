/** Repair and inspection passes for game textures: edge dilation, mipmap preview, power-of-two
 * planning, seam measurement, and clearly-labelled approximations (height, occlusion, masks).
 * Pure: RGBA bytes and channel planes in, the same out. No DOM, no canvas. */
export const POT_SIZES=Object.freeze([16,32,64,128,256,512,1024,2048,4096]);
export const BLEED_STEPS=Object.freeze([2,4,8,16]);
const size=(data,w,h)=>{
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Invalid texture dimensions');
 if(data.length!==w*h*4)throw Error('RGBA data does not match the given dimensions');
};
/** Edge dilation (alpha bleed): RGB is pushed outwards from texels that carry alpha into the
 * transparent ones around them, one ring per round, each new texel taking the average RGB of the
 * neighbours that already have colour. Alpha is never written, and a texel with alpha above the
 * threshold is never touched — so bilinear filtering and mipmaps stop pulling the PNG's
 * background colour into the sprite's edge. */
export function dilateEdges(data,w,h,{pixels=4,threshold=0,wrap=false}={}){
 size(data,w,h);
 if(!Number.isInteger(pixels)||pixels<1||pixels>64)throw Error('Bleed width must be 1–64 pixels');
 const out=new Uint8Array(data),solid=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++)solid[p]=data[p*4+3]>threshold?1:0;
 let filledTotal=0;
 for(let round=0;round<pixels;round++){
  const queue=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const p=y*w+x;if(solid[p])continue;
   let r=0,g=0,b=0,n=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    let nx=x+dx,ny=y+dy;
    if(wrap){nx=(nx+w)%w;ny=(ny+h)%h;}else if(nx<0||nx>=w||ny<0||ny>=h)continue;
    const q=ny*w+nx;if(!solid[q])continue;
    r+=out[q*4];g+=out[q*4+1];b+=out[q*4+2];n++;
   }
   if(n)queue.push(p,Math.round(r/n),Math.round(g/n),Math.round(b/n));
  }
  if(!queue.length)break;
  for(let i=0;i<queue.length;i+=4){const p=queue[i];out[p*4]=queue[i+1];out[p*4+1]=queue[i+2];out[p*4+2]=queue[i+3];solid[p]=1;filledTotal++;}
 }
 return {data:out,filled:filledTotal,rounds:pixels};
}
/** Box-filtered mipmap chain, the same naive per-channel average a GPU uses on a
 * non-premultiplied texture — which is exactly why an undilated edge darkens as it shrinks. */
export function mipChain(data,w,h,{levels=4}={}){
 size(data,w,h);
 if(!Number.isInteger(levels)||levels<1||levels>12)throw Error('Mip levels must be 1–12');
 const chain=[{level:0,width:w,height:h,data}];
 let src=data,sw=w,sh=h;
 for(let level=1;level<=levels;level++){
  const dw=Math.max(1,sw>>1),dh=Math.max(1,sh>>1),out=new Uint8Array(dw*dh*4);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
   const x0=Math.min(sw-1,x*2),x1=Math.min(sw-1,x*2+1),y0=Math.min(sh-1,y*2),y1=Math.min(sh-1,y*2+1);
   for(let c=0;c<4;c++)out[(y*dw+x)*4+c]=Math.round((src[(y0*sw+x0)*4+c]+src[(y0*sw+x1)*4+c]+src[(y1*sw+x0)*4+c]+src[(y1*sw+x1)*4+c])/4);
  }
  chain.push({level,width:dw,height:dh,data:out});src=out;sw=dw;sh=dh;
  if(dw===1&&dh===1)break;
 }
 return chain;
}
const potNear=(n,min,max)=>{
 const clamped=Math.max(min,Math.min(max,n)),lower=2**Math.floor(Math.log2(clamped)),upper=2**Math.ceil(Math.log2(clamped));
 return Math.max(min,Math.min(max,clamped-lower<=upper-clamped?lower:upper));
};
/** Target dimensions for a power-of-two resize. 'fit' keeps the aspect ratio and lands the long
 * side on the largest power of two that fits `max`; the others snap each axis on its own. */
export function potPlan(w,h,{mode='nearest',max=4096,min=16,square=false}={}){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Invalid texture dimensions');
 if(!POT_SIZES.includes(max)||!POT_SIZES.includes(min)||min>max)throw Error('Power-of-two bounds must come from POT_SIZES');
 const clamp=n=>Math.max(min,Math.min(max,n));
 let width,height;
 if(mode==='nearest'){width=potNear(w,min,max);height=potNear(h,min,max);}
 else if(mode==='down'){width=clamp(2**Math.floor(Math.log2(w)));height=clamp(2**Math.floor(Math.log2(h)));}
 else if(mode==='up'){width=clamp(2**Math.ceil(Math.log2(w)));height=clamp(2**Math.ceil(Math.log2(h)));}
 else if(mode==='fit'){
  const long=clamp(2**Math.floor(Math.log2(Math.max(w,h)))),scale=long/Math.max(w,h);
  width=w>=h?long:potNear(Math.round(w*scale),min,max);height=h>w?long:potNear(Math.round(h*scale),min,max);
 }else throw Error('Unknown power-of-two mode');
 if(square){const n=Math.max(width,height);width=height=n;}
 return {width,height,changed:width!==w||height!==h,mode};
}
/** Mean |ΔRGB| between two lines of texels. A null coordinate is the one that walks the line. */
const edgeDiff=(data,w,{ax,ay,bx,by,count})=>{
 let sum=0,max=0;const profile=new Uint8Array(count);
 for(let i=0;i<count;i++){
  const a=((ay??i)*w+(ax??i))*4,b=((by??i)*w+(bx??i))*4;
  const d=(Math.abs(data[a]-data[b])+Math.abs(data[a+1]-data[b+1])+Math.abs(data[a+2]-data[b+2]))/3;
  profile[i]=Math.min(255,Math.round(d));sum+=d;if(d>max)max=d;
 }
 return {mean:sum/count,max,profile};
};
/** Does this texture tile? Compares the columns (and rows) that become neighbours when the
 * texture repeats, against the variation one pixel inside — a seam only matters when the edge
 * pair differs more than the interior already does. */
export function seamMetrics(data,w,h){
 size(data,w,h);
 const vertical=w>1?edgeDiff(data,w,{ax:w-1,ay:null,bx:0,by:null,count:h}):{mean:0,max:0,profile:new Uint8Array(h)};
 const horizontal=h>1?edgeDiff(data,w,{ax:null,ay:h-1,bx:null,by:0,count:w}):{mean:0,max:0,profile:new Uint8Array(w)};
 const interiorV=w>2?edgeDiff(data,w,{ax:0,ay:null,bx:1,by:null,count:h}).mean:0,interiorH=h>2?edgeDiff(data,w,{ax:null,ay:0,bx:null,by:1,count:w}).mean:0;
 // A seam is only a seam when the wrapped edge pair differs more than the texture already
 // varies from one texel to the next; a noisy texture has a large absolute edge difference and
 // no visible seam, a smooth gradient has a small one and an obvious seam.
 const ratio=(mean,interior)=>interior>.5?mean/interior:mean>1?Infinity:1;
 const v={...vertical,interior:interiorV,ratio:ratio(vertical.mean,interiorV)},hz={...horizontal,interior:interiorH,ratio:ratio(horizontal.mean,interiorH)};
 return {vertical:v,horizontal:hz,seamless:v.ratio<=1.5&&hz.ratio<=1.5};
}
export function blurPlane(plane,w,h,rounds=1){
 let src=plane;
 for(let r=0;r<rounds;r++){
  const out=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let sum=0,n=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
    sum+=src[ny*w+nx];n++;
   }
   out[y*w+x]=Math.round(sum/n);
  }
  src=out;
 }
 return src===plane?new Uint8Array(plane):src;
}
/** Approximation: luminance read as height. Real height needs a displacement bake. */
export function heightFromLuminance(data,w,h,{invert=false,smooth=0}={}){
 size(data,w,h);const out=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const v=Math.round(.2126*data[p*4]+.7152*data[p*4+1]+.0722*data[p*4+2]);out[p]=invert?255-v:v;}
 return smooth?blurPlane(out,w,h,Math.min(8,smooth)):out;
}
/** Approximation: edge energy (Sobel magnitude on luminance) read as relief, for albedo maps
 * whose brightness is paint rather than shape. */
export function heightFromEdges(data,w,h,{gain=2,smooth=1}={}){
 size(data,w,h);const luma=heightFromLuminance(data,w,h),out=new Uint8Array(w*h);
 const at=(x,y)=>luma[Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x))];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const gx=at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1)-at(x-1,y-1)-2*at(x-1,y)-at(x-1,y+1);
  const gy=at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1)-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1);
  out[y*w+x]=Math.min(255,Math.round(Math.hypot(gx,gy)/8*gain));
 }
 return smooth?blurPlane(out,w,h,Math.min(8,smooth)):out;
}
/** Approximation, not ray-traced ambient occlusion: a texel that sits below the average height
 * of the disc around it is darkened in proportion to how far below it sits. */
export function occlusionApprox(height,w,h,{radius=4,strength=1}={}){
 if(height.length!==w*h)throw Error('Height plane does not match the given dimensions');
 if(!Number.isInteger(radius)||radius<1||radius>32)throw Error('Radius must be 1–32 pixels');
 if(!Number.isFinite(strength)||strength<0||strength>4)throw Error('Strength must be 0–4');
 const out=new Uint8Array(w*h),offsets=[];
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(dx||dy){const d=Math.hypot(dx,dy);if(d<=radius)offsets.push(dx,dy,1/d);}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const self=height[y*w+x];let sum=0,weight=0;
  for(let i=0;i<offsets.length;i+=3){
   const nx=Math.max(0,Math.min(w-1,x+offsets[i])),ny=Math.max(0,Math.min(h-1,y+offsets[i+1])),k=offsets[i+2];
   sum+=Math.max(0,height[ny*w+nx]-self)*k;weight+=255*k;
  }
  out[y*w+x]=Math.max(0,Math.min(255,Math.round(255*(1-strength*(sum/weight)*2))));
 }
 return out;
}
/** Emission / colour masks. 'threshold' keeps what is brighter than a luminance cut, 'color'
 * keeps what is within a distance of one colour, 'luminance' is the luminance itself. */
export function emissionMask(data,w,h,{mode='threshold',threshold=200,color=[255,255,255],tolerance=60,soft=8}={}){
 size(data,w,h);
 if(!['threshold','color','luminance'].includes(mode))throw Error('Unknown mask mode');
 if(!Number.isFinite(threshold)||threshold<0||threshold>255)throw Error('Threshold must be 0–255');
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>441)throw Error('Tolerance must be 0–441');
 const out=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){
  const i=p*4,luma=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
  if(mode==='luminance')out[p]=Math.round(luma);
  else if(mode==='threshold')out[p]=soft>0?Math.max(0,Math.min(255,Math.round((luma-threshold)/soft*255))):luma>=threshold?255:0;
  else{const d=Math.hypot(data[i]-color[0],data[i+1]-color[1],data[i+2]-color[2]);out[p]=d<=tolerance?255:soft>0?Math.max(0,Math.min(255,Math.round((1-(d-tolerance)/(soft*4))*255))):0;}
 }
 return out;
}
/** Mask from alpha, luminance or a colour range — the three ways a mask is usually hiding
 * inside an existing texture. */
export function maskExtract(data,w,h,{source='alpha',invert=false,...rest}={}){
 size(data,w,h);
 let out;
 if(source==='alpha'){out=new Uint8Array(w*h);for(let p=0;p<w*h;p++)out[p]=data[p*4+3];}
 else if(source==='luminance')out=emissionMask(data,w,h,{...rest,mode:'luminance'});
 else if(source==='color')out=emissionMask(data,w,h,{...rest,mode:'color'});
 else if(source==='threshold')out=emissionMask(data,w,h,{...rest,mode:'threshold'});
 else throw Error('Unknown mask source');
 if(invert)for(let p=0;p<out.length;p++)out[p]=255-out[p];
 return out;
}
