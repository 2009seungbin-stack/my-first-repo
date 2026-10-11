/** The recipe runner: one chain of steps over a Doc, with
 *  - a per-step cache keyed by (input, every earlier step, this step's op@v and params): changing step 5
 *    never re-runs the background removal of step 1;
 *  - a quick pass on a ≤ 512 px copy first (what the preview shows), then the full-resolution pass
 *    (what the downloads use) — run({preview:true}) / run({preview:false});
 *  - the pure steps in one Worker (src/pipeline/worker.js), the page-only steps (AI models, text)
 *    on the page through `ai` adapters (src/pipeline/browser.js); in Node everything runs in-process.
 * Events: onStep({index,op,status:'run'|'done'|'cached'|'error',ms,notes}) for the per-step status list. */
import {validateRecipe,defaultStep} from './recipe.js';
import {STEPS,NeedsPage,exportDoc} from './steps.js';
import {checkSpec} from './specs.js';
import {hashDoc,hashText,hex8,limitSide} from './raster.js';

export const PREVIEW_SIDE=512;
const bytesOf=doc=>doc.items.reduce((n,it)=>n+it.frames.reduce((m,f)=>m+f.data.byteLength,0),0);
const abortIf=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};

/** A Doc whose pictures are at most `side` px on the long side (copies only what it shrinks). */
export function previewDoc(doc,side=PREVIEW_SIDE){
 return {items:doc.items.map(it=>{if(Math.max(it.w,it.h)<=side)return it;let w=it.w,h=it.h;const frames=it.frames.map(f=>{const r=limitSide(f.data,it.w,it.h,side);w=r.w;h=r.h;return {data:r.data,ms:f.ms};});return {name:it.name,w,h,frames};}),notes:[]};
}

export class Pipeline{
 /** @param {{ai?:any,worker?:boolean|(()=>Worker),cacheBytes?:number}} [o] */
 constructor(o={}){
  this.ai=o.ai||null;this.cacheBytes=o.cacheBytes??400*1024**2;
  /** @type {Map<string,{doc:any,notes:any[],bytes:number}>} */this.cache=new Map();this.used=0;
  this.makeWorker=o.worker===false||typeof Worker==='undefined'?null:typeof o.worker==='function'?o.worker:()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  this.worker=null;this.seq=0;this.pending=new Map();
 }
 dispose(){this.worker?.terminate();this.worker=null;this.cache.clear();this.used=0;}
 remember(key,v){
  if(this.cache.has(key))return;v.bytes=bytesOf(v.doc);if(v.bytes>this.cacheBytes)return;
  this.cache.set(key,v);this.used+=v.bytes;
  for(const [k,x] of this.cache){if(this.used<=this.cacheBytes)break;this.cache.delete(k);this.used-=x.bytes;}
 }
 recall(key){const v=this.cache.get(key);if(v){this.cache.delete(key);this.cache.set(key,v);}return v;}
 /** Run one op in the worker (falls back to this thread when there is none). */
 inWorker(msg,signal){
  if(!this.makeWorker)return Promise.resolve(null);
  if(!this.worker){this.worker=this.makeWorker();this.worker.onmessage=e=>{const job=this.pending.get(e.data.id);if(job){this.pending.delete(e.data.id);job(e.data);}};this.worker.onerror=e=>{for(const job of this.pending.values())job({error:e.message||'worker failed'});this.pending.clear();this.worker?.terminate();this.worker=null;};}
  const id=++this.seq;
  return new Promise((resolve,reject)=>{
   const stop=()=>{this.pending.delete(id);this.worker?.terminate();this.worker=null;for(const job of this.pending.values())job({error:'cancelled'});this.pending.clear();reject(new DOMException('Cancelled','AbortError'));};
   signal?.addEventListener('abort',stop,{once:true});
   this.pending.set(id,data=>{signal?.removeEventListener('abort',stop);if(data.error){const e=Error(data.error);if(data.needsPage)e.name='NeedsPage';reject(e);}else resolve(data);});
   this.worker.postMessage({...msg,id});
  });
 }
 /**
  * @param {{items:any[],notes:string[]}} input @param {any} recipe a recipe (validated here)
  * @param {{preview?:boolean,signal?:AbortSignal,onStep?:(e:any)=>void,stem?:string,exportFiles?:boolean}} [o]
  */
 async run(input,recipe,o={}){
  const v=validateRecipe(recipe);if(!v.ok)throw Error(v.error);
  const all=v.recipe.steps,live=all.map((s,i)=>({s,i})).filter(x=>!x.s.off);
  const exp=live.find(x=>x.s.op==='export')?.s||defaultStep('export');
  const chain=live.filter(x=>x.s.op!=='export');
  const fitPreset=[...chain].reverse().find(x=>x.s.op==='fit')?.s.p.preset||null;
  const signal=o.signal,emit=o.onStep||(()=>{});
  let doc=o.preview?previewDoc(input):input;
  let key=hashText(`${hashDoc(doc)}|${o.preview?'p':'f'}`);
  const steps=[],docs=[];
  for(const {s,i} of chain){
   abortIf(signal);
   key=hashText(`${hex8(key)}|${s.op}@${s.v}|${JSON.stringify(s.p)}`);
   const k=hex8(key),hit=this.recall(k);
   if(hit){doc=hit.doc;docs.push({index:i,doc});steps.push({index:i,op:s.op,status:'cached',ms:0,notes:hit.notes});emit(steps[steps.length-1]);continue;}
   emit({index:i,op:s.op,status:'run'});
   const t0=performance.now(),notes=[];
   const impl=/** @type {any} */(STEPS)[s.op];
   try{
    let out=null;
    if(!impl.main(s.p)){const r=await this.inWorker({kind:'step',op:s.op,p:s.p,doc},signal).catch(e=>{if(e.name==='NeedsPage')return null;throw e;});if(r){out=r.doc;notes.push(...r.notes);}}
    if(!out)out=await impl.run(doc,s.p,{ai:this.ai,report:x=>notes.push(x),preview:!!o.preview});
    doc=out;
   }catch(e){
    if(/** @type {any} */(e)?.name==='AbortError')throw e;
    const ev={index:i,op:s.op,status:'error',ms:Math.round(performance.now()-t0),notes,error:String(/** @type {any} */(e)?.message||e)};steps.push(ev);emit(ev);throw Object.assign(Error(ev.error),{step:i,op:s.op});
   }
   docs.push({index:i,doc});
   const ev={index:i,op:s.op,status:'done',ms:Math.round(performance.now()-t0),notes};steps.push(ev);emit(ev);
   this.remember(k,{doc,notes});
  }
  abortIf(signal);
  let exported=null,check=null;
  if(o.exportFiles!==false){
   const msg={kind:'export',p:exp.p,doc,fitPreset,stem:o.stem||'nerulio'};
   const r=await this.inWorker(msg,signal).catch(e=>{if(e.name==='AbortError')throw e;return null;});
   exported=r?r.exported:await exportDoc(doc,exp.p,{ai:this.ai},{fitPreset,stem:o.stem||'nerulio'});
   check=checkSpec(exported.files,fitPreset,{zip:exported.pack?.bytes||null});
  }
  return {doc,docs,steps,exported,check,fitPreset,recipe:v.recipe};
 }
}
