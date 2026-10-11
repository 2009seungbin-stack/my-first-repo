import {canvas,release} from './image.js';
import {abort} from './resources.js';
import {aiWorker} from './ai-host.js';
let worker,timer,busy=false;
const terminate=()=>{clearTimeout(timer);worker?.terminate();worker=null;};
/** Cut-out of the foreground. Options: model 'best' | 'quick' | a key of AI_MODELS.matteModels; refine (colour-guided
 * alpha + flat-backdrop handling); backdrop 'auto' | 'off' (known-backdrop edges on plain/white sheets, see
 * matte-refine.js); cleanup (un-mix edge colours from the old backdrop); backend 'auto' | 'wasm'. */
export async function removeBackground(source,{signal,progress=()=>{},backend='auto',refine=true,cleanup=false,model='best',backdrop='auto'}={}){
 abort(signal);if(busy)throw Error('A foreground job is already running');busy=true;clearTimeout(timer);
 try{
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')throw Error('AI foreground extraction needs Worker and OffscreenCanvas. Use the color-background mode on this browser.');
  worker??=await aiWorker('matte',new URL('./matte-worker.js',import.meta.url));const bitmap=await createImageBitmap(source);if(signal?.aborted){bitmap.close();abort(signal);}
  const result=await new Promise((resolve,reject)=>{
   const done=()=>signal?.removeEventListener('abort',cancel),cancel=()=>{done();terminate();reject(new DOMException('Cancelled','AbortError'));};signal?.addEventListener('abort',cancel,{once:true});
   worker.onmessage=e=>{if(e.data.progress){progress(e.data.progress);return;}done();e.data.error?reject(Object.assign(Error(e.data.error),{retryBackend:e.data.retryBackend})):resolve(e.data);};worker.onerror=e=>{done();reject(Error(e.message||'Model worker failed'));};
   try{worker.postMessage({bitmap,backend,refine,cleanup,model,backdrop},[bitmap]);}catch(e){done();bitmap.close();reject(e);}
  });
  let c;try{abort(signal);c=canvas(result.bitmap.width,result.bitmap.height);c.getContext('2d').drawImage(result.bitmap,0,0);c.processingReport=result.report;return c;}catch(e){release(c);throw e;}finally{result.bitmap.close();}
 }catch(e){terminate();abort(signal);if(e.retryBackend&&backend!=='wasm'){busy=false;progress('GPU inference failed · retrying in a fresh WASM worker');const recovered=await removeBackground(source,{signal,progress,backend:'wasm',refine,cleanup,model,backdrop});recovered.processingReport.fallbackReason=`WebGPU failed: ${e.message}`;return recovered;}throw e;}
 finally{busy=false;if(worker)timer=setTimeout(terminate,30000);}
}
