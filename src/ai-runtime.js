/** Isolated same-origin host for AI workers. Served with Document-Isolation-Policy so ONNX Runtime
 * gets WASM threads (SharedArrayBuffer) without isolating the embedding page, its ads or iframes. */
import {packBitmaps,unpackBitmaps} from './ai-host.js';
const WORKERS={sr:'./sr-worker.js',matte:'./matte-worker.js'};
const transferables=data=>data&&typeof data==='object'?Object.values(data).filter(v=>v instanceof ImageBitmap||v instanceof ArrayBuffer):[];
addEventListener('message',({data,origin,ports})=>{
 if(origin!==location.origin||data?.type!=='ai-worker'||!Object.hasOwn(WORKERS,data.name)||!ports[0])return;
 const port=ports[0],worker=new Worker(new URL(WORKERS[data.name],import.meta.url),{type:'module'});let queue=Promise.resolve();
 // Bitmaps cross the process boundary as RGBA (see packBitmaps); worker hops stay in-process.
 worker.onmessage=e=>{try{const packed=packBitmaps(e.data);port.postMessage({data:packed.data},packed.transfer);}catch(error){port.postMessage({error:`Could not return the model result: ${error.message}`});}};
 worker.onerror=e=>{e.preventDefault();port.postMessage({error:e.message||'Model worker failed'});};
 port.onmessage=e=>{
  if(e.data==='terminate'){worker.terminate();port.close();return;}
  queue=queue.then(async()=>{const message=await unpackBitmaps(e.data.data);worker.postMessage(message,transferables(message));})
   .catch(error=>port.postMessage({error:`Could not start the model worker: ${error.message}`}));
 };
});
parent.postMessage({type:'ai-runtime-ready',isolated:self.crossOriginIsolated},location.origin);
