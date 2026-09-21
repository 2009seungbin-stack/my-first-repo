import {abort,yieldUI} from './resources.js';
import {decode,release} from './image.js';
import {pngRGBACompressed} from './png-stream.js';

/** One output buffer, one decoded source at a time, and 32-row transfer buffers. */
export async function packMasks(items,w,h,mapping,{signal,progress=()=>{}}={}){
 if(mapping.length!==4||mapping.some(m=>m!=='zero'&&m!=='one'&&(!Number.isInteger(m)||!items[m])))throw Error('Missing channel input');
 abort(signal);let worker,output;
 const request=(message,transfer=[])=>new Promise((resolve,reject)=>{
  const clean=()=>signal?.removeEventListener('abort',cancel),cancel=()=>{clean();reject(new DOMException('Cancelled','AbortError'));};
  signal?.addEventListener('abort',cancel,{once:true});
  worker.onmessage=({data})=>{if(data.progress){progress(data.progress);return;}clean();data.error?reject(Error(data.error)):resolve(data.result);};
  worker.onerror=e=>{clean();reject(Error(e.message||'Mask worker failed'));};
  try{worker.postMessage(message,transfer);}catch(e){clean();reject(e);}
 });
 try{
  try{worker=new Worker(new URL('./mask-worker.js',import.meta.url),{type:'module'});await request({start:true,w,h,mapping});}
  catch(e){abort(signal);worker?.terminate();worker=null;output=maskBuffer(w,h,mapping);}
  for(const index of [...new Set(mapping.filter(Number.isInteger))]){
   abort(signal);const c=await decode(items[index].blob,{signal});
   try{
    abort(signal);if(c.width!==w||c.height!==h)throw Error('All channel inputs must have the same dimensions');
    const channels=mapping.flatMap((m,c)=>m===index?[c]:[]),ctx=c.getContext('2d');
    for(let y=0;y<h;y+=32){abort(signal);const rows=Math.min(32,h-y),data=ctx.getImageData(0,y,w,rows).data;
     if(worker)await request({buffer:data.buffer,offset:y*w*4,channels},[data.buffer]);else applyMaskRows(output,data,y*w*4,channels);
     progress(`Packing source ${index+1} · row ${y+rows} / ${h}`);await yieldUI();
    }
   }finally{release(c);}
  }
  abort(signal);return worker?await request({finish:true}):await pngRGBACompressed(output,w,h,{signal,progress});
 }finally{worker?.terminate();output=null;}
}
export function maskBuffer(w,h,mapping){const output=new Uint8ClampedArray(w*h*4);for(let c=0;c<4;c++)if(mapping[c]==='one')for(let i=c;i<output.length;i+=4)output[i]=255;return output;}
export function applyMaskRows(output,rgba,offset,channels){for(let i=0;i<rgba.length;i+=4){const value=Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]);for(const c of channels)output[offset+i+c]=value;}}
