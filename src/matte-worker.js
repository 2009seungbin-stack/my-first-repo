import {matteSpec} from './ai-models.js';
import {ort,modelBytes,runtimeError,wasmThreads} from './onnx-engine.js';
import {refineMatte} from './matte-refine.js';
const loaded=new Map(); // model key → {session,device}
const progress=value=>self.postMessage({progress:value});
/** Model probability (S×S, 0..1) from the raw output, per the spec's output kind. */
export function probability(spec,data,N){
 const out=new Float32Array(N);
 // U-2-Net emits a saliency map that its reference code min-max normalises; BiRefNet emits logits.
 if(spec.output==='minmax'){let lo=Infinity,hi=-Infinity;for(let i=0;i<N;i++){const v=data[i];if(v<lo)lo=v;if(v>hi)hi=v;}const span=hi-lo||1;for(let i=0;i<N;i++)out[i]=(data[i]-lo)/span;}
 else if(spec.output==='logits')for(let i=0;i<N;i++)out[i]=1/(1+Math.exp(-data[i]));
 else for(let i=0;i<N;i++)out[i]=Math.max(0,Math.min(1,data[i]));
 return out;
}
self.onmessage=async({data:{bitmap,backend='auto',refine=true,cleanup=false,model='best',backdrop='auto'}})=>{
 let out,preview,input,outputs,device='wasm';const started=performance.now(),spec=matteSpec(model),S=spec.size,N=S*S;
 try{
  // The small model runs in about a second on WASM; skipping WebGPU avoids its shader-compile delay.
  const adapter=backend!=='wasm'&&!spec.cpuFirst?await self.navigator.gpu?.requestAdapter():null;
  if(adapter)device='webgpu';const rt=await ort();
  let entry=loaded.get(spec.key);
  if(!entry||entry.device!==device){
   await entry?.session.release();loaded.delete(spec.key);
   const bytes=await modelBytes(spec,progress);
   entry={session:await rt.InferenceSession.create(bytes,{executionProviders:[device],graphOptimizationLevel:'all'}),device};loaded.set(spec.key,entry);
  }
  const session=entry.session,mean=[.485,.456,.406],std=[.229,.224,.225];
  progress(`Decoding · preparing ${S}px inference proxy`);preview=new OffscreenCanvas(S,S);const ctx=preview.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,S,S);
  const rgb=ctx.getImageData(0,0,S,S).data,values=new Float32Array(3*N);
  for(let i=0;i<N;i++)for(let c=0;c<3;c++)values[c*N+i]=(rgb[i*4+c]/255-mean[c])/std[c];
  input=new rt.Tensor('float32',values,[1,3,S,S]);progress('Processing · foreground inference');outputs=await session.run({[session.inputNames[0]]:input});
  const raw=outputs[session.outputNames[0]];if(raw.data.length!==N)throw Error('Unexpected matte output shape');
  const prob=probability(spec,raw.data,N),inferMs=performance.now()-started;
  input.dispose();input=null;for(const value of Object.values(outputs))value.dispose();outputs=null;preview.width=preview.height=1;preview=null;
  progress('Refining alpha · edges');
  const W=bitmap.width,H=bitmap.height;out=new OffscreenCanvas(W,H);const oc=out.getContext('2d',{willReadFrequently:true});oc.drawImage(bitmap,0,0);
  const image=oc.getImageData(0,0,W,H),r=refineMatte(image.data,W,H,prob,S,S,{guided:refine,backdrop:refine?backdrop:'off',cleanup});
  image.data.set(r.rgba);oc.putImageData(image,0,0);
  const result=out.transferToImageBitmap();self.postMessage({bitmap:result,report:{engine:spec.id,model:spec.key,revision:spec.revision,license:spec.license,backend:device,threads:device==='wasm'?wasmThreads():null,inferenceSize:S,...r.report,inferMs,elapsedMs:performance.now()-started}},[result]);
 }catch(error){self.postMessage({error:runtimeError(error,device),retryBackend:device==='webgpu'?'wasm':null});}
 finally{bitmap.close();input?.dispose();if(outputs)for(const value of Object.values(outputs))value.dispose();for(const c of [out,preview])if(c)c.width=c.height=1;}
};
