import {AI_MODELS} from './ai-models.js';
import {ort,modelBytes,runtimeError,wasmThreads} from './onnx-engine.js';
let session,deviceKey;
const progress=value=>self.postMessage({progress:value});
self.onmessage=async({data:{bitmap,backend='auto',refine=true,cleanup=false}})=>{
 let out,preview,tile,input,outputs,device='wasm';const started=performance.now(),spec=AI_MODELS.matte;
 try{
  const adapter=backend!=='wasm'?await self.navigator.gpu?.requestAdapter():null;
  if(adapter)device='webgpu';const rt=await ort();
  if(!session||deviceKey!==device){
   await session?.release();session=null;deviceKey=null;
   const bytes=await modelBytes({...spec,file:'onnx/model.onnx'},progress);
   session=await rt.InferenceSession.create(bytes,{executionProviders:[device],graphOptimizationLevel:'all'});deviceKey=device;
  }
  progress('Decoding · preparing 512px inference proxy');preview=new OffscreenCanvas(512,512);const ctx=preview.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,512,512);
  const rgb=ctx.getImageData(0,0,512,512).data,values=new Float32Array(3*512*512),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let i=0;i<512*512;i++)for(let c=0;c<3;c++)values[c*512*512+i]=(rgb[i*4+c]/255-mean[c])/std[c];
  input=new rt.Tensor('float32',values,[1,3,512,512]);progress('Processing · foreground inference');outputs=await session.run({[session.inputNames[0]]:input});
  const logits=outputs[session.outputNames[0]],mask=new Float32Array(logits.data.length);for(let i=0;i<mask.length;i++)mask[i]=1/(1+Math.exp(-logits.data[i]));
  if(mask.length!==512*512)throw Error('Unexpected matte output shape');
  input.dispose();input=null;for(const value of Object.values(outputs))value.dispose();outputs=null;
  out=new OffscreenCanvas(bitmap.width,bitmap.height);const dest=out.getContext('2d');let done=0;const total=Math.ceil(bitmap.width/1024)*Math.ceil(bitmap.height/128);
  for(let y=0;y<bitmap.height;y+=128)for(let x=0;x<bitmap.width;x+=1024){
   const w=Math.min(1024,bitmap.width-x),h=Math.min(128,bitmap.height-y);tile=new OffscreenCanvas(w,h);const tc=tile.getContext('2d',{willReadFrequently:true});tc.drawImage(bitmap,x,y,w,h,0,0,w,h);const image=tc.getImageData(0,0,w,h),d=image.data;
   for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
    const i=(yy*w+xx)*4,gx=Math.max(0,Math.min(511,(x+xx+.5)*512/bitmap.width-.5)),gy=Math.max(0,Math.min(511,(y+yy+.5)*512/bitmap.height-.5)),bx=Math.floor(gx),by=Math.floor(gy),fx=gx-bx,fy=gy-by;
    let sum=0,weight=0,bgr=0,bgg=0,bgb=0,bgw=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
     const j=Math.min(511,by+dy)*512+Math.min(511,bx+dx),p=j*4,spatial=(dx?fx:1-fx)*(dy?fy:1-fy);
     const distance=(d[i]-rgb[p])**2+(d[i+1]-rgb[p+1])**2+(d[i+2]-rgb[p+2])**2;
     const a=spatial*(refine ? .02+Math.exp(-distance/(2*48**2)) : 1);sum+=a*mask[j];weight+=a;
     if(mask[j]<.1){bgr+=rgb[p]*spatial;bgg+=rgb[p+1]*spatial;bgb+=rgb[p+2]*spatial;bgw+=spatial;}
    }
    const alpha=weight?sum/weight:0;
    if(cleanup&&d[i+3]===255&&bgw>0&&alpha>.1&&alpha<.95){const bg=[bgr/bgw,bgg/bgw,bgb/bgw];for(let c=0;c<3;c++)d[i+c]=(d[i+c]-(1-alpha)*bg[c])/alpha;}
    d[i+3]=Math.round(d[i+3]*alpha);
   }
   tc.putImageData(image,0,0);dest.drawImage(tile,x,y);tile.width=tile.height=1;tile=null;progress(`Refining alpha · tile ${++done} / ${total}`);
  }
  const result=out.transferToImageBitmap();self.postMessage({bitmap:result,report:{engine:spec.id,revision:spec.revision,license:spec.license,backend:device,threads:device==='wasm'?wasmThreads():null,inferenceSize:512,refinement:refine?'color-guided bilinear':'bilinear',cleanup,elapsedMs:performance.now()-started}},[result]);
 }catch(error){self.postMessage({error:runtimeError(error,device),retryBackend:device==='webgpu'?'wasm':null});}
 finally{bitmap.close();input?.dispose();if(outputs)for(const value of Object.values(outputs))value.dispose();for(const c of [out,preview,tile])if(c)c.width=c.height=1;}
};
