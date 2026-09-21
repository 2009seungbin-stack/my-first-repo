/** The one resampler the PDF optimizer uses. It runs inside the PDF Worker on an OffscreenCanvas
 * and, in browsers whose Workers have none, on the owning page's canvas through pdf-rpc.js — so
 * both paths produce the same bytes. Large reductions halve repeatedly first: a single
 * drawImage from 2339px to 500px aliases badly, four halvings do not. */
const surface=(w,h)=>{
 if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);
 const c=document.createElement('canvas');c.width=w;c.height=h;return c;
};
const drop=c=>{c.width=c.height=1;};
const jpeg=(c,quality)=>c.convertToBlob?c.convertToBlob({type:'image/jpeg',quality}):new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('JPEG encoder unavailable')),'image/jpeg',quality));
function context(c){const x=c.getContext('2d',{alpha:false});x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';return x;}
function resample(source,w,h,tw,th){
 let current=surface(w,h),ctx=context(current);
 if(source.bitmap)ctx.drawImage(source.bitmap,0,0,w,h);
 else ctx.putImageData(new ImageData(source.rgba,w,h),0,0);
 let cw=w,ch=h;
 while(cw>=tw*2&&ch>=th*2&&cw>2&&ch>2){
  const half=surface(Math.max(tw,cw>>1),Math.max(th,ch>>1));
  context(half).drawImage(current,0,0,half.width,half.height);
  drop(current);current=half;cw=half.width;ch=half.height;
 }
 if(cw===tw&&ch===th)return current;
 const out=surface(tw,th);context(out).drawImage(current,0,0,tw,th);drop(current);return out;
}
function desaturate(c){
 const ctx=c.getContext('2d'),image=ctx.getImageData(0,0,c.width,c.height),d=image.data;
 for(let i=0;i<d.length;i+=4)d[i]=d[i+1]=d[i+2]=(d[i]*77+d[i+1]*151+d[i+2]*28)>>8;
 ctx.putImageData(image,0,0);
}
/** source: {blob} for an existing JPEG, or {rgba,width,height} for decoded samples.
 * type 'jpeg' returns JPEG bytes; type 'gray' returns one 8-bit channel for a soft mask. */
export async function encodeImage(source,tw,th,{type='jpeg',quality=.62,grayscale=false}={}){
 let bitmap=null,c=null;
 try{
  if(source.blob)bitmap=await createImageBitmap(source.blob);
  const w=bitmap?bitmap.width:source.width,h=bitmap?bitmap.height:source.height;
  if(!(w>0&&h>0))return null;
  c=resample(bitmap?{bitmap}:source,w,h,Math.min(tw,w),Math.min(th,h));
  if(type==='gray'){
   const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,out=new Uint8Array(c.width*c.height);
   for(let i=0,p=0;p<out.length;i+=4,p++)out[p]=d[i];
   return {bytes:out,width:c.width,height:c.height};
  }
  if(grayscale)desaturate(c);
  const blob=await jpeg(c,quality);
  return {bytes:new Uint8Array(await blob.arrayBuffer()),width:c.width,height:c.height};
 }catch{return null;}
 finally{bitmap?.close();if(c)drop(c);}
}
