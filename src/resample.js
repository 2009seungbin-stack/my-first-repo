import {canvas,release} from './image.js';
import {abort,deviceCapabilities,imagePlan,yieldUI} from './resources.js';

let modulePromise;
const engines=new Map();
async function engine(plan,worker=true){
 const key=`${plan.tile}:${plan.concurrency}:${worker}`;
 if(!engines.has(key)){
  modulePromise??=import('../assets/vendor/pica-10.0.3/pica_main.mjs');
  const {default:create}=await modulePromise;
  engines.set(key,create({tile:plan.tile,concurrency:plan.concurrency,idle:1000,
   features:worker?['js','wasm','ww']:['js','wasm'],workerURL:new URL('../assets/vendor/pica-10.0.3/pica_worker.js',import.meta.url)}));
 }
 return engines.get(key);
}
/** Overlapped filter regions are managed by pinned Pica. No full-image RGBA clone. */
export async function resample(source,w,h,{signal,progress=()=>{},filter='mks2013',preset='balanced',tile,worker=true}={}){
 abort(signal);const caps=deviceCapabilities(),plan=imagePlan(source.width,source.height,w,h,{capabilities:caps,preset});
 if(tile)plan.tile=tile;
 let out=null,cancel;
 const token=new Promise(resolve=>{cancel=()=>resolve(new DOMException('Cancelled','AbortError'));});
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  for(let attempt=0;attempt<2;attempt++){
   abort(signal);progress(`Processing · ${w} × ${h} · ${filter} · ${plan.tile}px tiles`);await yieldUI();
   out=canvas(w,h);
   try{
    const p=await engine(plan,worker&&caps.worker);
    await p.resize(source,out,{filter,cancelToken:token});abort(signal);
    out.processingReport={engine:`pica-10.0.3/${filter}`,tiled:true,tile:plan.tile,
     backend:p.resize_features.ww?'worker':p.resize_features.wasm?'wasm-cpu':'js-cpu',
     estimatedWorkingBytes:plan.estimatedBytes,estimateIncludes:'source, destination, intermediate and tile buffers; excludes browser/GPU/encoder overhead'};
    const result=out;out=null;return result;
   }catch(error){
    release(out);out=null;abort(signal);
    if(attempt||error.name==='AbortError')throw error;
    // A failed worker/allocation retries a smaller, sequential compatible path.
    plan.tile=256;plan.concurrency=1;worker=false;progress('Retrying · smaller tiles / compatible CPU');
   }
  }
 }finally{signal?.removeEventListener('abort',cancel);release(out);}
}
