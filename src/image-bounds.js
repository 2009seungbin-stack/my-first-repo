import {abort,yieldUI} from './resources.js';
export async function imageBounds(c,{signal,progress=()=>{},whiteThreshold}={}){
 let worker;const ctx=c.getContext('2d'),bounds={x:c.width,y:c.height,right:-1,bottom:-1};
 abort(signal);
 try{worker=new Worker(new URL('./bounds-worker.js',import.meta.url),{type:'module'});worker.postMessage({start:true,width:c.width,height:c.height});}catch{worker=null;}
 const stop=()=>worker?.terminate();signal?.addEventListener('abort',stop,{once:true});
 try{
  for(let y=0;y<c.height;y+=64){
   abort(signal);const height=Math.min(64,c.height-y),data=ctx.getImageData(0,y,c.width,height).data;
   if(worker){
    const b=await new Promise((resolve,reject)=>{
     const cancel=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));},cleanup=()=>signal?.removeEventListener('abort',cancel);
     signal?.addEventListener('abort',cancel,{once:true});worker.onmessage=e=>{cleanup();resolve(e.data.bounds);};worker.onerror=e=>{cleanup();reject(Error(e.message||'Bounds worker failed'));};
     worker.postMessage({y,height,width:c.width,whiteThreshold,buffer:data.buffer},[data.buffer]);
    });Object.assign(bounds,b);
   }else{
    for(let yy=0;yy<height;yy++)for(let x=0;x<c.width;x++){
     const i=(yy*c.width+x)*4;if(data[i+3]>8&&(whiteThreshold===undefined||Math.min(data[i],data[i+1],data[i+2])<whiteThreshold)){
      bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,y+yy);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y+yy);
     }
    }
   }
   progress(`Processing · ${Math.min(y+height,c.height)} / ${c.height} rows`);await yieldUI();
  }
  return bounds.right<0?null:{x:bounds.x,y:bounds.y,w:bounds.right-bounds.x+1,h:bounds.bottom-bounds.y+1};
 }finally{signal?.removeEventListener('abort',stop);stop();}
}
