import {canvas,release} from './image.js';
import {processTile} from './tile-algorithms.js';
import {abort,imagePlan,yieldUI} from './resources.js';
export async function outlineTiled(source,{kind='outline',options={},radius=1,color=[24,32,45],signal,progress=()=>{}}={}){
 if(kind==='swap')radius=0;else if(kind==='texture')radius=1;
 if(!Number.isInteger(radius)||radius<0||radius>64)throw Error('Invalid tile overlap');
 abort(signal);const size=imagePlan(source.width,source.height).tile,out=canvas(source.width,source.height),dest=out.getContext('2d'),ctx=source.getContext('2d');let worker,success=false;
 try{worker=new Worker(new URL('./tile-worker.js',import.meta.url),{type:'module'});}catch{worker=null;}
 try{
  let done=0,total=Math.ceil(source.width/size)*Math.ceil(source.height/size);
  for(let y=0;y<source.height;y+=size)for(let x=0;x<source.width;x+=size){
   abort(signal);const sx=Math.max(0,x-radius),sy=Math.max(0,y-radius),w=Math.min(source.width,x+size+radius)-sx,h=Math.min(source.height,y+size+radius)-sy;
   let data=ctx.getImageData(sx,sy,w,h).data,result;
   if(worker){try{result=await new Promise((resolve,reject)=>{
    const clean=()=>signal?.removeEventListener('abort',cancel),cancel=()=>{clean();reject(new DOMException('Cancelled','AbortError'));};signal?.addEventListener('abort',cancel,{once:true});
    worker.onmessage=e=>{clean();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};worker.onerror=e=>{clean();reject(Error(e.message||'Tile worker failed'));};worker.postMessage({buffer:data.buffer,w,h,radius,color,kind,options},[data.buffer]);
   });}catch(e){abort(signal);worker.terminate();worker=null;data=ctx.getImageData(sx,sy,w,h).data;}}
   result??=processTile(data,w,h,{kind,radius,color,options});abort(signal);
   dest.putImageData(new ImageData(result,w,h),sx,sy,x-sx,y-sy,Math.min(size,source.width-x),Math.min(size,source.height-y));
   progress(`Processing · tile ${++done} / ${total}`);await yieldUI();
  }
  success=true;return out;
 }finally{worker?.terminate();if(!success)release(out);}
}
