/** Off-main-thread cleanup for the Pixel workspace (the least-squares grid fit of a smooth
 * resample takes seconds on large pictures). {id, op:'analyse'|'run', frames:[{data,width,height}],
 * opts, analysis?} → {id, ok, result|error}. Deterministic: the same input gives the same bytes. */
import {analyse,runCleanup} from '../../pixel/cleanup.js';
self.onmessage=({data})=>{
 const {id,op,frames,opts,analysis}=data;
 try{
  const list=frames.map(f=>({data:new Uint8Array(f.data.buffer,f.data.byteOffset,f.data.byteLength),width:f.width,height:f.height}));
  if(op==='analyse'){self.postMessage({id,ok:true,result:analyse(list,opts||{})});return;}
  if(op==='run'){
   const r=runCleanup(list,opts||{},analysis||null),transfer=r.frames.map(f=>f.data.buffer);
   self.postMessage({id,ok:true,result:r},transfer);return;
  }
  throw Error('unknown op '+op);
 }catch(e){self.postMessage({id,ok:false,error:String(e?.message||e)});}
};
