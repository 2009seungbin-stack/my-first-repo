// @ts-check
/** Keeps the AI status fresh from the site itself. The status collectors (claude-status, openai-status)
 * are scheduled every 30 minutes on GitHub Actions, but GitHub runs busy schedules late or not at all
 * (2026-09-29: 11 of 48 runs, 2–3 hours apart), and the status box trusts its data for 2 hours only.
 * So a page view that finds the status older than REFRESH_AFTER runs the same collectors here, after the
 * response (ctx.waitUntil), with the same ingest pipeline and run record as the scheduled job.
 *
 * Cost: one small read per isolate per CHECK_EVERY; a refresh is claimed in D1 (last_attempt_at) so one
 * isolate at a time fetches each status page, at most once per LOCK_MS. */
import claudeStatus from '../../collectors/claude-status/index.js';
import openaiStatus from '../../collectors/openai-status/index.js';
import {runAdapter} from '../../collectors/_runtime.js';
import {ingest} from '../../platform/ingest.js';
import {recordRun} from '../../platform/collector-health.js';
import {validateSeed} from '../../platform/seed.js';
import {watchStatus} from './status-watch.js';

export const STATUS_ADAPTERS=Object.freeze([claudeStatus,openaiStatus]);
export const REFRESH_AFTER=10*60e3,LOCK_MS=4*60e3,CHECK_EVERY=60e3;
let nextCheck=0;
/** Tests: forget the per-isolate pause. */
export const resetStatusRefresh=()=>{nextCheck=0;};

/** The adapters whose last success is older than REFRESH_AFTER and that nobody claimed in LOCK_MS.
 * @param {any} db @param {number} now */
export async function staleAdapters(db,now){
 const ids=STATUS_ADAPTERS.map(a=>a.id);
 const rows=(await db.prepare(`SELECT adapter,enabled,last_attempt_at,last_success_at FROM collectors WHERE adapter IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results||[];
 const by=new Map(rows.map((/** @type {any} */ r)=>[String(r.adapter),r]));
 return STATUS_ADAPTERS.filter(a=>{const r=by.get(a.id);if(!r)return false;if(!Number(r.enabled))return false;
  return (r.last_success_at==null||Number(r.last_success_at)<now-REFRESH_AFTER)&&(r.last_attempt_at==null||Number(r.last_attempt_at)<now-LOCK_MS);});
}

/** Claims one adapter's refresh: only the isolate whose update changes the row runs it. @param {any} db @param {string} id @param {number} now */
export async function claim(db,id,now){
 const r=await db.prepare('UPDATE collectors SET last_attempt_at=? WHERE adapter=? AND enabled=1 AND (last_attempt_at IS NULL OR last_attempt_at<?) AND (last_success_at IS NULL OR last_success_at<?)')
  .bind(now,id,now-LOCK_MS,now-REFRESH_AFTER).run();
 return Number(r?.meta?.changes||0)>0;
}

/** Entities as the status collectors match them (models by name, alias or API id; services; providers). @param {any} db */
async function aiTargets(db){
 const rows=(await db.prepare("SELECT id,type,slug,names FROM entities WHERE vertical='ai' AND status='active' AND type IN ('model','service','provider')").all()).results||[];
 const aliases=(await db.prepare("SELECT a.entity_id,a.alias FROM entity_aliases a JOIN entities e ON e.id=a.entity_id WHERE e.vertical='ai' AND e.type='model'").all()).results||[];
 const apiIds=(await db.prepare("SELECT f.entity_id,f.value FROM facts f JOIN entities e ON e.id=f.entity_id WHERE e.vertical='ai' AND e.type='model' AND f.property='api_model_id' AND f.region='*'").all()).results||[];
 /** @type {Map<string,string[]>} */const al=new Map();for(const r of aliases)al.set(String(r.entity_id),[...(al.get(String(r.entity_id))||[]),String(r.alias)]);
 /** @type {Map<string,string>} */const api=new Map();for(const r of apiIds){try{const v=JSON.parse(String(r.value));if(typeof v==='string')api.set(String(r.entity_id),v);}catch{}}
 return rows.map((/** @type {any} */ r)=>{let names={};try{names=JSON.parse(String(r.names));}catch{}
  return {id:String(r.id),type:String(r.type),vertical:'ai',slug:String(r.slug),names,aliases:al.get(String(r.id))||[],facts:api.has(String(r.id))?{api_model_id:api.get(String(r.id))}:{},factRegions:{},versions:[]};});
}

/** Runs the stale status collectors into `db` (claimed first). Never throws; returns the ids it ran.
 * @param {any} db @param {{now?:number,fetch?:typeof fetch,adapters?:any[]}} [o] */
export async function refreshStatus(db,o={}){
 const now=o.now??Date.now();
 /** @type {string[]} */
 const ran=[];
 try{
  const due=o.adapters||await staleAdapters(db,now);if(!due.length)return ran;
  const targets=await aiTargets(db),known={entities:new Set(targets.map((/** @type {{id:string}} */ t)=>t.id)),sources:new Set()};
  for(const adapter of due){
   if(!await claim(db,adapter.id,now))continue;
   const run=await runAdapter(adapter,{targets,...(o.fetch?{fetch:o.fetch}:{})});
   const errors=run.doc?validateSeed(run.doc,known):[];
   let error=run.error||(errors.length?`validation: ${errors.slice(0,3).join('; ')}`:null),changes=0;
   if(run.doc&&!errors.length){try{changes=(await ingest(db,structuredClone({...run.doc,snapshots:run.snapshots}),{mode:'collector',actor:`collector:${adapter.id}`,adapter:adapter.id,now:run.finished}))?.changes||0;}catch(e){error=`ingest: ${e}`;}}
   await recordRun(db,{id:adapter.id,vertical:adapter.vertical,mode:adapter.mode,freshnessHours:adapter.freshnessHours},{started:run.started,finished:run.finished,error,observations:run.doc?.entities?.length||0,changes});
   ran.push(adapter.id);
  }
 }catch(e){console.log(`status refresh: ${/** @type {any} */(e)?.message||e}`);}
 return ran;
}

/** From a page view: at most one check per isolate per CHECK_EVERY; the work runs after the response.
 * Followers and the webhook hear about a new incident the same way as after the scheduled run.
 * @param {any} env @param {any} ctx @param {{origin:string,now?:number}} site */
export function maybeRefreshStatus(env,ctx,site){
 const now=site.now??Date.now();
 if(!env?.DB||typeof ctx?.waitUntil!=='function'||now<nextCheck)return false;
 nextCheck=now+CHECK_EVERY;
 ctx.waitUntil((async()=>{
  const ran=await refreshStatus(env.DB,{now});
  if(ran.length){try{await watchStatus({env,db:env.DB,now,fetch,origin:site.origin});}catch(e){console.log(`status watch: ${/** @type {any} */(e)?.message||e}`);}}
 })());
 return true;
}
