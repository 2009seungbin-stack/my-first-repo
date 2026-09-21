import {canvas,release,resizeQuality} from './image.js';
import {abort} from './resources.js';
let worker,idleTimer,busy=false;
function terminate(){clearTimeout(idleTimer);worker?.terminate();worker=null;}
/** One persistent session, idle expiry, transferable bitmap input/output, hard abort. */
export async function superResolve(source,scale=2,{signal,progress=()=>{},tile=128,backend='auto',fallback=true,engine='quality',allowBackendFallback=true}={}){
 if(![2,4].includes(scale))throw Error('Super-resolution supports 2× and 4×');abort(signal);
 if(busy)throw Error('An AI image job is already running');busy=true;clearTimeout(idleTimer);
 try{
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')throw Error('Worker/OffscreenCanvas unavailable');
  worker??=new Worker(new URL('./sr-worker.js',import.meta.url),{type:'module'});
  const bitmap=await createImageBitmap(source);if(signal?.aborted){bitmap.close();abort(signal);}
  const result=await new Promise((resolve,reject)=>{
   const cleanup=()=>signal?.removeEventListener('abort',cancel),cancel=()=>{cleanup();terminate();reject(new DOMException('Cancelled','AbortError'));};
   signal?.addEventListener('abort',cancel,{once:true});
   worker.onmessage=e=>{if(e.data.progress){progress(e.data.progress);return;}cleanup();if(e.data.error)reject(Object.assign(Error(e.data.error),{retryBackend:e.data.retryBackend}));else resolve(e.data);};
   worker.onerror=e=>{cleanup();reject(Error(e.message||'Model worker failed'));};
   try{worker.postMessage({bitmap,scale,tile,backend,engine},[bitmap]);}catch(e){cleanup();bitmap.close();reject(e);}
  });
  let out;try{abort(signal);out=canvas(result.bitmap.width,result.bitmap.height);out.getContext('2d').drawImage(result.bitmap,0,0);out.processingReport=result.report;return out;}catch(e){release(out);throw e;}finally{result.bitmap.close();}
 }catch(error){
  terminate();abort(signal);if(allowBackendFallback&&error.retryBackend&&backend!=='wasm'){busy=false;progress('GPU inference failed · retrying in a fresh WASM worker');const recovered=await superResolve(source,scale,{signal,progress,tile:Math.min(tile,64),backend:'wasm',fallback,engine});recovered.processingReport.fallbackReason=`WebGPU failed: ${error.message}`;return recovered;}
  if(!fallback)throw error;progress('Model unavailable · high-quality classical fallback');
  const out=await resizeQuality(source,source.width*scale,source.height*scale,{signal,progress});out.processingReport.fallbackReason=error.message;return out;
 }finally{busy=false;if(worker)idleTimer=setTimeout(terminate,30000);}
}
