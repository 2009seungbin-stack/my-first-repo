import * as Im from './image.js';
import {imageMetrics} from './quality.js';
import {abort,yieldUI} from './resources.js';
let formatsPromise;
export function supportedFormats(){return formatsPromise??=(async()=>{
 const c=Im.canvas(2,2),formats=[];try{for(const format of ['png','jpeg','webp','avif'])try{await Im.blobOf(c,`image/${format}`);formats.push(format);}catch{/* Actual encoder unavailable. */}return formats;}finally{Im.release(c);}
})();}
async function hasAlpha(c,signal){
 const ctx=c.getContext('2d');for(let y=0;y<c.height;y+=64){abort(signal);const d=ctx.getImageData(0,y,c.width,Math.min(64,c.height-y)).data;for(let i=3;i<d.length;i+=4)if(d[i]!==255)return true;await yieldUI();}return false;
}
function sample(c,w,h,bg){const out=Im.canvas(w,h),ctx=out.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.drawImage(c,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;Im.release(out);return data;}
/** Compare decoded output on black AND white, so invisible RGB cannot win. */
async function score(blob,reference,w,h,signal){
 abort(signal);const bitmap=await createImageBitmap(blob);try{
  const a=imageMetrics(reference[0],sample(bitmap,w,h,'#000'),w,h),b=imageMetrics(reference[1],sample(bitmap,w,h,'#fff'),w,h);
  return {ssim:Math.min(a.ssim,b.ssim),mse:Math.max(a.mse,b.mse),sampleWidth:w,sampleHeight:h};
 }finally{bitmap.close();}
}
/** minSSIM (no target size): pick the SMALLEST candidate that still scores at least this
 * similarity, instead of the most similar one — which would always be the untouched original. */
export async function compress(source,{format='png',quality=.92,kb=0,width=0,allowShrink=false,bg='#ffffff',minSSIM=0,signal,progress=()=>{},original}={},check=()=>{}){
 const started=performance.now(),supported=await supportedFormats();check();abort(signal);
 if(format!=='auto'&&!supported.includes(format))throw Error(`The browser cannot encode ${format.toUpperCase()}. Choose ${supported.join(', ')}.`);
 const transparent=await hasAlpha(source,signal),formats=format==='auto'?supported.filter(f=>f!=='jpeg'||!transparent):[format];
 const target=Number(kb)*1024,maxWidth=width?Math.min(source.width,width):source.width;
 if(!Number.isFinite(target)||target<0||!Number.isFinite(quality)||quality<=0||quality>1)throw Error('Invalid compression settings');
 const factor=Math.min(1,512/Math.max(source.width,source.height)),sw=Math.max(1,Math.round(source.width*factor)),sh=Math.max(1,Math.round(source.height*factor));
 // For explicit JPEG flattening, compare against the chosen background, not transparency.
 const reference=format==='jpeg'?[sample(source,sw,sh,bg),sample(source,sw,sh,bg)]:[sample(source,sw,sh,'#000'),sample(source,sw,sh,'#fff')];
 let best=null,smallest=null,work=null,outputW=maxWidth;const candidates=[],pool=[];
 const consider=async(blob,w,h,fmt,q,retained=false)=>{
  check();abort(signal);const metric=await score(blob,reference,sw,sh,signal),candidate={blob,w,h,format:fmt,quality:q,metric,retained};
  candidates.push({format:fmt,quality:q,width:w,height:h,bytes:blob.size,...metric,retained});
  if(!smallest||blob.size<smallest.blob.size)smallest=candidate;
  if(minSSIM&&!target){candidate.pass=metric.ssim>=minSSIM;pool.push(candidate);return;}
  if((!target||blob.size<=target)&&(!best||metric.ssim>best.metric.ssim+.0001||Math.abs(metric.ssim-best.metric.ssim)<=.0001&&blob.size<best.blob.size))best=candidate;
 };
 try{
  const originalFormat=original?.type?.replace('image/','');
  if(original instanceof Blob&&formats.includes(originalFormat)&&outputW===source.width&&(!target||original.size<=target))await consider(original,source.width,source.height,originalFormat,null,true);
  for(let level=0;level<(allowShrink&&target?6:1);level++){
   check();abort(signal);const outputH=Math.max(1,Math.round(source.height*outputW/source.width));
   work=outputW===source.width?source:await Im.resizeQuality(source,outputW,outputH,{signal,progress});
   let levelSmallest=Infinity;
   for(const fmt of formats){
    let input=work;try{
     if(fmt==='jpeg'&&transparent)input=Im.background(work,bg);
     progress(`Encoding · ${fmt.toUpperCase()} · ${outputW} × ${outputH}`);
     let chosen=await Im.blobOf(input,`image/${fmt}`,quality),chosenQ=quality;levelSmallest=Math.min(levelSmallest,chosen.size);
     if(target&&chosen.size>target&&fmt!=='png'){
      let lo=.05,hi=quality;const floor=await Im.blobOf(input,`image/${fmt}`,lo);levelSmallest=Math.min(levelSmallest,floor.size);
      chosen=floor;chosenQ=lo;
      if(floor.size<=target)for(let iteration=0;iteration<8;iteration++){
       check();abort(signal);const q=(lo+hi)/2,blob=await Im.blobOf(input,`image/${fmt}`,q);
       progress(`Encoding · ${fmt.toUpperCase()} · candidate ${iteration+1} / 8`);
       if(blob.size<=target){lo=q;chosen=blob;chosenQ=q;}else hi=q;await yieldUI();
      }
     }
     await consider(chosen,outputW,outputH,fmt,chosenQ);
    }finally{if(input!==work)Im.release(input);}
   }
   if(work!==source)Im.release(work);work=null;
   if(!target||!allowShrink||outputW<=32)break;
   // Evaluate another resolution even if one fits: detail vs quantization trade-off.
   outputW=Math.max(1,Math.floor(outputW*Math.max(.55,Math.min(.85,Math.sqrt(target/levelSmallest)))));
  }
  if(pool.length){
   // Quality mode: the smallest lossy result that stays above the similarity floor. Noisy or
   // grainy pictures may never reach the floor; they still get the requested quality level
   // (like any other compressor) rather than silently keeping the original.
   const bySize=(a,b)=>a.blob.size-b.blob.size,lossy=pool.filter(c=>c.format!=='png'&&!c.retained),passing=lossy.filter(c=>c.pass);
   const top=Math.max(...lossy.map(c=>c.metric.ssim)),near=lossy.filter(c=>c.metric.ssim>=top-.01);
   best=[...(passing.length?passing:near),...pool.filter(c=>c.format==='png'||c.retained)].sort(bySize)[0];
  }
  const chosen=best||smallest;
  return {...chosen,met:!!best,report:{inputWidth:source.width,inputHeight:source.height,width:chosen.w,height:chosen.h,format:chosen.format,bytes:chosen.blob.size,
   targetBytes:target||null,ssim:chosen.metric.ssim,metric:'8x8 luma SSIM on <=512px proxies, worst of black/white composites',
   retainsOriginal:chosen.retained,alphaPreserved:chosen.format!=='jpeg',elapsedMs:performance.now()-started,candidates}};
 }finally{if(work&&work!==source)Im.release(work);}
}
