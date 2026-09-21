/** Worker-compatible AI handle. Where the browser honors Document-Isolation-Policy (Chromium), the
 * worker runs inside a hidden isolated iframe so WASM inference can use threads; elsewhere, or when
 * the runtime page is unavailable, it is a plain module Worker with identical messages. */
let runtime;
function isolatedFrame(){
 runtime??=new Promise(resolve=>{
  if(typeof document==='undefined'||!document.body)return resolve(null);
  const frame=document.createElement('iframe'),timers=[];let settled=false;
  // Settle exactly once. A stale fallback timer must never remove a frame that already reported
  // ready: that silently kills the worker it hosts in the middle of model setup.
  const done=isolated=>{
   if(settled)return;settled=true;timers.forEach(clearTimeout);removeEventListener('message',onMessage);
   if(!isolated)frame.remove();resolve(isolated?frame:null);
  };
  const onMessage=e=>{if(e.source===frame.contentWindow&&e.origin===location.origin&&e.data?.type==='ai-runtime-ready')done(e.data.isolated===true);};
  addEventListener('message',onMessage);
  // A missing page (static mirrors without headers) loads but never reports ready.
  frame.addEventListener('load',()=>timers.push(setTimeout(()=>done(false),1500)),{once:true});
  timers.push(setTimeout(()=>done(false),10000));
  frame.style.cssText='position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none';
  frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.title='AI runtime';
  frame.src=new URL('../ai-runtime/',import.meta.url).href;
  document.body.append(frame);
 });
 return runtime;
}
/** The isolated frame lives in another renderer process, and Chrome 151 crashes the sending renderer
 * when a GPU-backed ImageBitmap (any canvas-sourced one on real GPUs) is posted across. Bitmaps
 * therefore cross that boundary as raw RGBA, read back here instead of inside the crashing path. */
export function packBitmaps(data,transfer=[]){
 if(!data||typeof data!=='object'||Array.isArray(data))return {data,transfer};
 const out={...data},moved=transfer.filter(v=>!(v instanceof ImageBitmap));
 for(const [key,value] of Object.entries(data)){
  if(!(value instanceof ImageBitmap))continue;
  const {width,height}=value,c=new OffscreenCanvas(width,height),ctx=c.getContext('2d',{willReadFrequently:true});
  try{ctx.drawImage(value,0,0);const pixels=ctx.getImageData(0,0,width,height).data.buffer;out[key]={rgba:pixels,width,height};moved.push(pixels);}
  finally{value.close();c.width=c.height=1;}
 }
 return {data:out,transfer:moved};
}
// getImageData already un-premultiplied the pixels; decoding with premultiplyAlpha:'none' avoids a
// second lossy premultiply round trip on translucent pixels (mattes, alpha images).
export async function unpackBitmaps(data){
 if(data&&typeof data==='object')for(const [key,value] of Object.entries(data))
  if(value?.rgba instanceof ArrayBuffer)data[key]=await createImageBitmap(new ImageData(new Uint8ClampedArray(value.rgba),value.width,value.height),{premultiplyAlpha:'none'});
 return data;
}
export async function aiWorker(name,url){
 const frame=await isolatedFrame();
 if(!frame?.isConnected||!frame.contentWindow){runtime=null;return new Worker(url,{type:'module'});}
 const {port1,port2}=new MessageChannel();let queue=Promise.resolve();
 const handle={onmessage:null,onerror:null,isolated:true,
  postMessage(message,transfer=[]){const packed=packBitmaps(message,transfer);port1.postMessage({data:packed.data},packed.transfer);},
  terminate(){port1.postMessage('terminate');port1.close();}};
 // Decoding is async; the chain keeps progress and result messages in order.
 port1.onmessage=({data})=>{queue=queue.then(async()=>{
  if('error' in data)return handle.onerror?.({message:data.error});
  let message;try{message=await unpackBitmaps(data.data);}catch(e){return handle.onerror?.({message:`Could not receive the model result: ${e.message}`});}
  handle.onmessage?.({data:message});
 });};
 frame.contentWindow.postMessage({type:'ai-worker',name},location.origin,[port2]);
 return handle;
}
