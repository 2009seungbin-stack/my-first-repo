/** Optional standalone ORT runtime. Called only inside processing workers. */
let runtime;
export async function ort(){
 runtime??=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.webgpu.min.mjs');
 runtime.env.wasm.numThreads=1;runtime.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';return runtime;
}
export async function modelBytes(spec,progress=()=>{}){
 const url=`https://huggingface.co/${spec.id}/resolve/${spec.revision}/${spec.file}`;let cache;
 try{cache=await caches.open('nerulio-models-v1');const hit=await cache.match(url);if(hit){progress('Loading cached model');return hit.arrayBuffer();}}catch{/* Cache storage is optional. */}
 const response=await fetch(url);if(!response.ok)throw Error(`Model download failed (${response.status})`);
 const length=Number(response.headers.get('content-length')),reader=response.body.getReader(),chunks=[];let loaded=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;progress(`Downloading model · ${(loaded/1024**2).toFixed(1)} MiB${length?' / '+(length/1024**2).toFixed(1)+' MiB':''}`);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(loaded);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
 try{await cache?.put(url,new Response(bytes));}catch{/* Quota denial must not stop inference. */}return bytes;
}
export async function fastSRModel(spec,device,progress){
 const rt=await ort(),model=await rt.InferenceSession.create(await modelBytes(spec,progress),{executionProviders:[device],graphOptimizationLevel:'all'});
 const infer=async function(rgb,w,h){
  const pw=spec.pad?Math.ceil(w/spec.pad)*spec.pad:w,ph=spec.pad?Math.ceil(h/spec.pad)*spec.pad:h;
  const reflect=(p,n)=>n===1?0:p<n?p:Math.max(0,2*n-p-2);
  const input=new Float32Array(pw*ph*3);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)for(let c=0;c<3;c++)input[c*pw*ph+y*pw+x]=rgb[(reflect(y,h)*w+reflect(x,w))*3+c]/255;
  const tensor=new rt.Tensor('float32',input,[1,3,ph,pw]);let outputs;
  try{
   outputs=await model.run({[model.inputNames[0]]:tensor});const prediction=outputs[model.outputNames[0]],oh=prediction.dims[2],ow=prediction.dims[3],data=new Uint8ClampedArray(ow*oh*3);
   for(let i=0;i<ow*oh;i++)for(let c=0;c<3;c++)data[i*3+c]=prediction.data[c*ow*oh+i]*255;
   return {width:ow,height:oh,channels:3,data};
  }finally{tensor.dispose();if(outputs)for(const output of Object.values(outputs))output.dispose();}
 };infer.dispose=()=>model.release();return infer;
}
