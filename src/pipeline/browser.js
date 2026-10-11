/** The page side of the pipeline: reading a picked/pasted file into a Doc, and the adapters for the
 * steps that need the page — the pinned AI models (src/matting.js, src/super-resolution.js, which run
 * in their own workers / the isolated /ai-runtime/ frame), caption text in the bundled SUIT font, WebP.
 * Nothing here uploads anything: pictures stay in this browser. */
import {removeBackground} from '../matting.js';
import {superResolve} from '../super-resolution.js';
import {AI_MODELS} from '../ai-models.js';

let bigCached=null;
/** Is the 190 MB matte model already in this browser (Cache Storage)? Until it is, previews use the 4.6 MB one. */
async function matteCached(){if(bigCached)return true;try{const {modelCached}=await import('../onnx-engine.js');bigCached=await modelCached({...AI_MODELS.matte,file:'onnx/model.onnx'});}catch{bigCached=false;}return bigCached;}

export const MAX_INPUT_SIDE=8192,MAX_INPUT_PIXELS=40e6;
const canvasOf=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
export function toCanvas(data,w,h){const c=canvasOf(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);return c;}
export function pixelsOf(c){return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;}

/** A File/Blob → {items:[{name,w,h,frames}],notes}. Animated GIF/WebP: first frame (as the browser decodes it). */
export async function readImage(file,name='image'){
 const bmp=await createImageBitmap(file,{imageOrientation:'from-image',premultiplyAlpha:'none',colorSpaceConversion:'default'});
 try{
  let w=bmp.width,h=bmp.height;
  if(!w||!h)throw Error('empty image');
  // Very large pictures are reduced on the way in (the AI outputs this is for are ≤ 4K).
  const s=Math.min(1,MAX_INPUT_SIDE/Math.max(w,h),Math.sqrt(MAX_INPUT_PIXELS/(w*h)));
  if(s<1){w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s));}
  const c=canvasOf(w,h),g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(bmp,0,0,w,h);
  const data=new Uint8ClampedArray(g.getImageData(0,0,w,h).data.buffer);c.width=c.height=1;
  return {items:[{name:String(name).replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,40)||'image',w,h,frames:[{data,ms:0}]}],notes:[],source:{w:bmp.width,h:bmp.height}};
 }finally{bmp.close?.();}
}

/** @param {{onProgress?:(t:string)=>void,signal?:AbortSignal}} [o] */
export function pageAdapters(o={}){
 const progress=o.onProgress||(()=>{});
 return {
  /** Pinned BiRefNet-lite (U-2-Netp for the quick 512 px preview while the big model is not cached). */
  async bgRemove(data,w,h,{refine=true,preview=false}={}){
   const c=toCanvas(data,w,h),model=preview&&!await matteCached()?'quick':'best';
   const out=await removeBackground(c,{signal:o.signal,refine,cleanup:false,model,progress:p=>progress(String(p))});
   if(model==='best')bigCached=true;
   const px=out.width===w&&out.height===h?pixelsOf(out):(()=>{const t=canvasOf(w,h);t.getContext('2d').drawImage(out,0,0,w,h);return pixelsOf(t);})();
   return new Uint8ClampedArray(px.buffer);
  },
  /** Real-ESRGAN general-x4v3 (pinned); the step resizes ×4 to the asked scale. */
  async upscale(data,w,h){
   const out=await superResolve(toCanvas(data,w,h),4,{signal:o.signal,engine:'fast',progress:p=>progress(String(p))});
   return {data:new Uint8ClampedArray(pixelsOf(out).buffer),w:out.width,h:out.height};
  },
  /** Text in SUIT (bundled, self-hosted), outlined, sized as a share of the picture's width. */
  async caption(data,w,h,p){
   const c=toCanvas(data,w,h),g=c.getContext('2d');
   const size=Math.max(8,Math.round(p.size*w)),weight=p.font==='suit-bold'?700:900,font=`${weight} ${size}px SUIT, sans-serif`;
   try{await document.fonts.load(font,p.text);}catch{}
   g.font=font;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
   // Long text shrinks to fit 92 % of the width.
   let m=g.measureText(p.text).width;if(m>w*.92){g.font=`${weight} ${Math.max(8,Math.floor(size*w*.92/m))}px SUIT, sans-serif`;}
   const y=p.position==='top'?size*.75:p.position==='center'?h/2:h-size*.75;
   if(p.strokeWidth>0){g.strokeStyle=p.stroke;g.lineWidth=Math.max(1,size*p.strokeWidth);g.strokeText(p.text,w/2,y);}
   g.fillStyle=p.color;g.fillText(p.text,w/2,y);
   return new Uint8ClampedArray(pixelsOf(c).buffer);
  },
  async webp(data,w,h,q){
   const c=toCanvas(data,w,h),blob=await new Promise(r=>c.toBlob(r,'image/webp',q));
   if(!blob||blob.type!=='image/webp')throw Error('WebP is not available in this browser');
   return new Uint8Array(await blob.arrayBuffer());
  },
 };
}
