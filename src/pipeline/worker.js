/** The pipeline worker: runs the pure recipe steps and the export off the page's thread
 * (src/pipeline/runner.js sends {id, kind:'step'|'export', op, p, doc}). WebP comes from
 * OffscreenCanvas here; everything else is Nerulio's own code. */
import {STEPS,exportDoc} from './steps.js';

async function webp(data,w,h,q){
 const c=new OffscreenCanvas(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);
 const blob=await c.convertToBlob({type:'image/webp',quality:q});
 if(blob.type!=='image/webp')throw Error('WebP encoding is not available in this browser');
 return new Uint8Array(await blob.arrayBuffer());
}
const buffers=doc=>doc.items.flatMap(it=>it.frames.map(f=>f.data.buffer));
self.onmessage=async({data:m})=>{
 const notes=[];
 try{
  if(m.kind==='export'){
   const exported=await exportDoc(m.doc,m.p,{ai:typeof OffscreenCanvas!=='undefined'?{webp}:null},{fitPreset:m.fitPreset,stem:m.stem});
   self.postMessage({id:m.id,exported,notes},[...exported.files.map(f=>f.bytes.buffer),...(exported.pack?[exported.pack.bytes.buffer]:[])]);
   return;
  }
  const doc=await STEPS[m.op].run(m.doc,m.p,{report:x=>notes.push(x),ai:null});
  // Transfer what this step made (inputs passed through untouched are copies too: structured clone).
  self.postMessage({id:m.id,doc,notes},[...new Set(buffers(doc))]);
 }catch(e){self.postMessage({id:m.id,error:String(e?.message||e),needsPage:e?.name==='NeedsPage'});}
};
