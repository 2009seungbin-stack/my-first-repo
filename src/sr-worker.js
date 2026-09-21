import {AI_MODELS} from './ai-models.js';
import {fastSRModel,runtimeError,wasmThreads} from './onnx-engine.js';
let session,sessionKey;
const progress=value=>self.postMessage({progress:value});
async function getModel(spec,device){
 const key=spec.id+device;
 if(sessionKey!==key){if(session)await session.dispose();session=null;sessionKey=null;session=await fastSRModel(spec,device,progress);sessionKey=key;}
 return session;
}
self.onmessage=async({data:{bitmap,scale=2,tile=128,backend='auto',engine='quality'}})=>{
 let out,tileCanvas,alphaCanvas,fallbackReason=null;const spec=engine==='fast'?AI_MODELS.fastSR:AI_MODELS[scale===4?'sr4':'sr2'],started=performance.now();let device=backend==='wasm'?'wasm':self.navigator.gpu?'webgpu':'wasm';
 try{
  if(device==='webgpu'&&!await self.navigator.gpu.requestAdapter()){device='wasm';fallbackReason='WebGPU adapter unavailable';progress('WebGPU adapter unavailable · WASM fallback');}
  // ONNX runtime can cache a failed backend/session promise. Backend retries must
  // use a fresh worker, not a second session in the poisoned runtime.
  const model=await getModel(spec,device);
  out=new OffscreenCanvas(bitmap.width*scale,bitmap.height*scale);const dest=out.getContext('2d');
  for(let attempt=0;attempt<3;attempt++){
   const overlap=32,total=Math.ceil(bitmap.width/tile)*Math.ceil(bitmap.height/tile);let done=0;
   try{
    for(let y=0;y<bitmap.height;y+=tile)for(let x=0;x<bitmap.width;x+=tile){
     const sx=Math.max(0,x-overlap),sy=Math.max(0,y-overlap),ex=Math.min(bitmap.width,x+tile+overlap),ey=Math.min(bitmap.height,y+tile+overlap),w=ex-sx,h=ey-sy;
     tileCanvas=new OffscreenCanvas(w,h);const ctx=tileCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,sx,sy,w,h,0,0,w,h);
     const rgba=ctx.getImageData(0,0,w,h).data,rgb=new Uint8Array(w*h*3);
     for(let i=0,j=0;i<rgba.length;i+=4,j+=3){rgb[j]=rgba[i];rgb[j+1]=rgba[i+1];rgb[j+2]=rgba[i+2];}
     const inferred=await model(rgb,w,h);
     // The processor pads to a multiple of 8. Crop only the original source region.
     if(inferred.width<w*scale||inferred.height<h*scale)throw Error('Unexpected SR output dimensions');
     alphaCanvas=new OffscreenCanvas(w*scale,h*scale);const ac=alphaCanvas.getContext('2d',{willReadFrequently:true});ac.drawImage(tileCanvas,0,0,w*scale,h*scale);
     const alpha=ac.getImageData(0,0,w*scale,h*scale),result=new Uint8ClampedArray(w*h*scale*scale*4);
     for(let yy=0;yy<h*scale;yy++)for(let xx=0;xx<w*scale;xx++){
      const i=(yy*w*scale+xx)*4,ratio=spec.scale/scale;for(let channel=0;channel<3;channel++){let sum=0;for(let dy=0;dy<ratio;dy++)for(let dx=0;dx<ratio;dx++)sum+=inferred.data[((yy*ratio+dy)*inferred.width+xx*ratio+dx)*inferred.channels+channel];result[i+channel]=sum/(ratio*ratio);}result[i+3]=alpha.data[i+3];
     }
     ac.putImageData(new ImageData(result,w*scale,h*scale),0,0);
     const cw=Math.min(tile,bitmap.width-x)*scale,ch=Math.min(tile,bitmap.height-y)*scale;
     dest.drawImage(alphaCanvas,(x-sx)*scale,(y-sy)*scale,cw,ch,x*scale,y*scale,cw,ch);
     tileCanvas.width=tileCanvas.height=alphaCanvas.width=alphaCanvas.height=1;tileCanvas=alphaCanvas=null;
     progress(`Super-resolution · tile ${++done} / ${total}`);
    }
    const result=out.transferToImageBitmap();self.postMessage({bitmap:result,report:{engine:spec.id,revision:spec.revision,license:spec.license,backend:device,threads:device==='wasm'?wasmThreads():null,fallbackReason,tile,overlap,tiles:total,elapsedMs:performance.now()-started,scale}},[result]);return;
   }catch(error){
    if(tileCanvas)tileCanvas.width=tileCanvas.height=1;if(alphaCanvas)alphaCanvas.width=alphaCanvas.height=1;tileCanvas=alphaCanvas=null;
    if(attempt===2)throw error;
    tile=Math.max(32,tile/2);dest.clearRect(0,0,out.width,out.height);progress(`Inference retry · ${tile}px tiles`);
    if(attempt===1&&device==='webgpu')throw error;
   }
  }
 }catch(error){self.postMessage({error:runtimeError(error,device),retryBackend:device==='webgpu'?'wasm':null});}
 finally{bitmap.close();if(out)out.width=out.height=1;if(tileCanvas)tileCanvas.width=tileCanvas.height=1;if(alphaCanvas)alphaCanvas.width=alphaCanvas.height=1;}
};
