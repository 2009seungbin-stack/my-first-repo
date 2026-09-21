import * as Im from '../src/image.js';
import {superResolve} from '../src/super-resolution.js';
import {imageMetrics} from '../src/quality.js';
export async function run({smoke=false,engine='quality',backend='wasm',strictGPU=false}={}){
 const rows=[],source=Im.canvas(32,32),ctx=source.getContext('2d');ctx.fillStyle='#6688aa';ctx.fillRect(0,0,32,32);ctx.fillStyle='#ffffff';ctx.fillRect(8,8,16,16);
 try{for(const scale of [2,4]){
  const result=await superResolve(source,scale,{engine,fallback:false,tile:32,backend:strictGPU?'webgpu':smoke?'auto':backend,allowBackendFallback:!strictGPU,signal:AbortSignal.timeout(smoke?180000:900000),progress:value=>console.log(value)});
  if(result.width!==32*scale||result.height!==32*scale)throw Error('Incorrect ML scale');
  const data=result.getContext('2d').getImageData(0,0,result.width,result.height).data;
  if(data[3]!==255)throw Error('ML alpha was lost');
  rows.push({case:'ML inference smoke (not quality acceptance)',width:result.width,height:result.height,...result.processingReport});Im.release(result);
 }}finally{Im.release(source);}
 if(smoke)return {rows};
 const photo=await Im.decode(await (await fetch('/tests/fixtures/astronaut.png')).blob());
 try{for(const scale of [2,4]){
  const low=await Im.resizeQuality(photo,photo.width/scale,photo.height/scale,{filter:'lanczos3'}),classical=await Im.resizeQuality(low,photo.width,photo.height,{filter:'lanczos3'});
  const result=await superResolve(low,scale,{engine,fallback:false,tile:128,backend:'auto',progress:value=>console.log(value)});
  const get=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data,reference=get(photo);
  const ai=imageMetrics(reference,get(result),photo.width,photo.height),baseline=imageMetrics(reference,get(classical),photo.width,photo.height);
  rows.push({case:'NASA portrait / Lanczos degradation (not model training degradation)',scale,ai,baseline,beatsClassicalPSNR:ai.psnr>baseline.psnr,...result.processingReport,_png:result.toDataURL()});
  Im.release(result);Im.release(classical);Im.release(low);
 }}finally{Im.release(photo);}
 return {rows,quality:'Photo comparison is a single NASA portrait. Anime, alpha matte, broad visual quality and 8K ML output remain UNVERIFIED.'};
}
