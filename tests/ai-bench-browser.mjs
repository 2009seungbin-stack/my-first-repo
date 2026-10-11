// AI-300 benchmark driver (runs inside a page; docs/ai-bench/run_browser.py feeds it corpus files through a
// Playwright route). It calls the real public engines exactly as the product does and returns PNGs + reports.
import * as Im from '../src/image.js';
import {removeBackground} from '../src/matting.js';
import {superResolve} from '../src/super-resolution.js';
const png=async c=>{const b=await Im.blobOf(c,'image/png');return new Uint8Array(await b.arrayBuffer());};
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);};
/** One job: {kind:'matte'|'sr', data (base64 file bytes) or url, options}. Returns {png (base64), report, ms}. */
export async function job({kind,url,data,options={}}){
 const blob=data?new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))]):await (await fetch(url)).blob(),source=await Im.decode(blob);let out;
 try{
  const t=performance.now();
  options={progress:p=>console.log('progress',p),...options};
  out=kind==='matte'?await removeBackground(source,options):await superResolve(source,options.scale||4,{fallback:false,...options});
  const ms=performance.now()-t;return {png:b64(await png(out)),report:out.processingReport||null,ms,width:out.width,height:out.height};
 }finally{Im.release(source);Im.release(out);}
}
/** Model probe (runs in a module worker, like the engines): load a pinned ONNX file with ONNX Runtime Web on a
 * backend and time a few runs on a random input. Worker body: tests/ai-bench-probe.mjs. */
export function probe(args){
 return new Promise(resolve=>{const w=new Worker(new URL('./ai-bench-probe.mjs',import.meta.url),{type:'module'});
  w.onmessage=e=>{w.terminate();resolve(e.data);};w.onerror=e=>{w.terminate();resolve({ok:false,error:e.message||'worker failed'});};w.postMessage(args);});
}
