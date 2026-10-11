// Worker for tests/ai-bench-browser.mjs probe(): session create + timed runs of one pinned model on one backend.
import {ort,modelBytes} from '../../../src/onnx-engine.js';
async function runtime(version){
 if(!version)return ort();
 const rt=await import(`https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/ort.webgpu.min.mjs`);
 rt.env.wasm.numThreads=self.crossOriginIsolated?Math.max(1,Math.min(8,(navigator.hardwareConcurrency||2)-1)):1;rt.env.wasm.wasmPaths=`https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/`;return rt;
}
self.onmessage=async({data:{spec,device='webgpu',size=1024,runs=3,ortVersion=null}})=>{
 const t0=performance.now();
 try{
  const rt=await runtime(ortVersion),bytes=await modelBytes(spec),t1=performance.now(),session=await rt.InferenceSession.create(bytes,{executionProviders:[device],graphOptimizationLevel:'all'}),t2=performance.now(),times=[];
  const input=new rt.Tensor('float32',Float32Array.from({length:3*size*size},()=>Math.random()*2-1),[1,3,size,size]);let info=null;
  for(let i=0;i<runs;i++){const t=performance.now(),out=await session.run({[session.inputNames[0]]:input}),o=out[session.outputNames[0]];info={type:o.type,dims:o.dims,ctor:o.data.constructor.name,first:Number(o.data[0])};times.push(performance.now()-t);for(const v of Object.values(out))v.dispose();}
  await session.release();self.postMessage({ok:true,device,ort:ortVersion||'1.30.0',threads:rt.env.wasm.numThreads,loadMs:t1-t0,createMs:t2-t1,runMs:times,output:info});
 }catch(e){self.postMessage({ok:false,device,error:String(e?.message||e).slice(0,600)});}
};
