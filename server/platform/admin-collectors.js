// @ts-check
/** The collectors the admin app knows about, and how healthy each one is.
 * The Worker cannot read collectors/*\/index.js at runtime (they are not in the Worker bundle), so
 * the list is kept here; tests/admin-api.test.mjs fails when it drifts from the adapters or from the
 * workflow's schedules. A collector with no run record counts as a problem ("never"): a run that hit
 * the D1 write limit may not have been able to record itself. */

/** @typedef {'30m'|'6h'|'manual'} Schedule */
/** @typedef {{id:string,vertical:string,mode:'auto'|'manual',freshnessHours:number,schedule:Schedule}} CollectorDef */

/** @type {readonly CollectorDef[]} */
export const COLLECTORS=Object.freeze([
 {id:'claude-status',vertical:'ai',mode:'auto',freshnessHours:1,schedule:'30m'},
 {id:'openai-status',vertical:'ai',mode:'auto',freshnessHours:1,schedule:'30m'},
 {id:'claude-release-notes',vertical:'ai',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'gemini-api-changelog',vertical:'ai',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'github-releases',vertical:'ai',mode:'auto',freshnessHours:12,schedule:'6h'},
 {id:'openai-api-changelog',vertical:'ai',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'anilist-schedule',vertical:'subculture',mode:'auto',freshnessHours:12,schedule:'6h'},
 {id:'steam-news-subculture',vertical:'subculture',mode:'auto',freshnessHours:12,schedule:'6h'},
 {id:'steam-news',vertical:'games',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'steam-store',vertical:'games',mode:'auto',freshnessHours:168,schedule:'6h'},
 {id:'nvidia-datacenter-drivers',vertical:'hardware',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'blender-releases',vertical:'studio',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'reaper-whatsnew',vertical:'studio',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'studio-compat-kb-watch',vertical:'studio',mode:'auto',freshnessHours:24,schedule:'6h'},
 {id:'studio-github-releases',vertical:'studio',mode:'auto',freshnessHours:24,schedule:'6h'},
 // tools/platform/fx.mjs, a separate step of the 6-hourly run (records itself as "ecb-fx").
 {id:'ecb-fx',vertical:'ai',mode:'auto',freshnessHours:96,schedule:'6h'},
 {id:'ai-plans-manual',vertical:'ai',mode:'manual',freshnessHours:24*14,schedule:'manual'},
 {id:'gpu-specs-manual',vertical:'hardware',mode:'manual',freshnessHours:24*90,schedule:'manual'},
 {id:'studio-vendor-manual',vertical:'studio',mode:'manual',freshnessHours:24*7,schedule:'manual'},
 {id:'subculture-figure-preorders',vertical:'subculture',mode:'manual',freshnessHours:24*30,schedule:'manual'},
 {id:'subculture-kr-collabs',vertical:'subculture',mode:'manual',freshnessHours:24*7,schedule:'manual'},
 {id:'subculture-official-news',vertical:'subculture',mode:'manual',freshnessHours:72,schedule:'manual'},
]);
/** Adapters "지금 실행" may dispatch (collect.mjs adapters that write to D1; ecb-fx is not one). */
export const RUNNABLE=Object.freeze(COLLECTORS.filter(c=>c.mode==='auto'&&c.id!=='ecb-fx').map(c=>c.id));
export const STATUS_ADAPTERS=Object.freeze(['claude-status','openai-status']);

/** Next scheduled start (GitHub cron, UTC): every :00/:30, or at :17 past 00/06/12/18. Actual runs
 * start a few minutes late. @param {Schedule} schedule @param {number} now */
export function nextRun(schedule,now){
 if(schedule==='30m')return Math.floor(now/18e5)*18e5+18e5;
 if(schedule==='6h'){const base=Math.floor(now/216e5)*216e5+17*6e4;return base>now?base:base+216e5;}
 return null;
}

/** @typedef {'ok'|'failing'|'stale'|'never'|'manual'} CollectorStateName */
/** @param {CollectorDef} def @param {any} row a `collectors` row or null @param {number} now @returns {CollectorStateName} */
export function collectorState(def,row,now){
 if(def.mode==='manual')return 'manual';
 if(!row||!row.last_attempt_at)return 'never';
 if(row.last_error)return 'failing';
 if(!row.last_success_at||now-Number(row.last_success_at)>def.freshnessHours*36e5)return 'stale';
 return 'ok';
}
/** Problems first (failing, never, stale), then ok, then manual; alphabetical within a group. */
export const STATE_ORDER=/** @type {Record<CollectorStateName,number>} */({failing:0,never:1,stale:2,ok:3,manual:4});

/** Registry ∪ rows found in D1 (a collector D1 knows but the registry does not still shows up).
 * @param {any[]} rows @param {number} now */
export function collectorItems(rows,now){
 const byId=new Map(rows.map(r=>[String(r.adapter),r]));
 /** @type {CollectorDef[]} */const defs=[...COLLECTORS];
 for(const r of rows)if(!COLLECTORS.some(c=>c.id===r.adapter))defs.push({id:String(r.adapter),vertical:String(r.vertical||''),mode:r.mode==='manual'?'manual':'auto',freshnessHours:Number(r.freshness_hours)||24,schedule:r.mode==='manual'?'manual':'6h'});
 return defs.map(def=>{
  const r=byId.get(def.id)||null,state=collectorState(def,r,now);
  return {id:def.id,vertical:def.vertical,mode:def.mode,freshnessHours:def.freshnessHours,schedule:def.schedule,
   last_success_at:r?.last_success_at==null?null:Number(r.last_success_at),last_error:r?.last_error??null,last_run_at:r?.last_attempt_at==null?null:Number(r.last_attempt_at),
   consecutive_failures:Number(r?.consecutive_failures||0),
   observations:r?.observations==null?null:Number(r.observations),changes:r?.changes==null?null:Number(r.changes),rows_written:r?.rows_written==null?null:Number(r.rows_written),
   next_run_at:nextRun(def.schedule,now),state};
 }).sort((a,b)=>STATE_ORDER[a.state]-STATE_ORDER[b.state]||a.id.localeCompare(b.id));
}
