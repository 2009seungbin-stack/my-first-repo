// @ts-check
/** Run history: compact result summaries kept in this browser only, so a later run can be compared with the previous one. */
const PREFIX='nerulio.preflight.v1.history.';
export const HISTORY_LIMIT=8,HISTORY_COMPONENT_LIMIT=500;
/** @typedef {Pick<Storage,'getItem'|'setItem'|'removeItem'>} Store */
/** @typedef {{at:string,name:string,from:string,to:string,platform:string,architecture:string,verdict:string,sample:boolean,total:number,counts:Record<string,number>,components:[string,string,string][]}} RunSnapshot */
/** @param {import('../core/types').PreflightResult} result @returns {RunSnapshot} */
export function snapshotRun(result){
 return {at:result.generatedAt,name:String(result.environment.name||'').slice(0,100),from:String(result.environment.host.version||''),to:String(result.target.version||''),
  platform:result.target.platform,architecture:result.target.architecture,verdict:result.overallVerdict,sample:!!result.sample,total:result.components.length,
  counts:Object.fromEntries(Object.entries(result.counts).filter(([,n])=>n)),
  components:result.components.slice(0,HISTORY_COMPONENT_LIMIT).map(c=>[c.component.id,String(c.component.name).slice(0,160),c.status])};
}
/** Verdict and status codes are rendered as class names and icon lookups, so stored ones must look like codes. */
const CODE=/^[A-Z][A-Z_]{0,39}$/;
/** @param {unknown} run @returns {run is RunSnapshot} */
const valid=run=>{
 const r=/** @type {RunSnapshot} */(run);
 return !!r&&typeof r.at==='string'&&CODE.test(r.verdict)&&typeof r.to==='string'&&typeof r.from==='string'&&typeof r.name==='string'&&typeof r.platform==='string'&&typeof r.architecture==='string'&&
  Number.isFinite(r.total)&&!!r.counts&&typeof r.counts==='object'&&Object.entries(r.counts).every(([s,n])=>CODE.test(s)&&Number.isFinite(n))&&
  Array.isArray(r.components)&&r.components.length<=HISTORY_COMPONENT_LIMIT&&r.components.every(c=>Array.isArray(c)&&c.length===3&&c.every(x=>typeof x==='string')&&CODE.test(c[2]));
};
/** Newest first. History is disposable, so unreadable data reads as empty instead of blocking the app.
 * @param {Store} storage @param {string} vertical @returns {RunSnapshot[]} */
export function listRuns(storage,vertical){
 try{
  const x=JSON.parse(storage.getItem(PREFIX+vertical)||'null');
  return x&&x.schemaVersion===1&&Array.isArray(x.runs)?x.runs.filter(valid).slice(0,HISTORY_LIMIT):[];
 }catch{return [];}
}
/** @param {RunSnapshot} run */
const fingerprint=run=>JSON.stringify([run.name,run.from,run.to,run.platform,run.architecture,run.verdict,run.sample,run.total,run.components]);
/** Records a run. Repeating an identical run refreshes its timestamp instead of adding a duplicate entry.
 * @param {Store} storage @param {string} vertical @param {import('../core/types').PreflightResult} result @returns {RunSnapshot[]} */
export function recordRun(storage,vertical,result){
 const run=snapshotRun(result),previous=listRuns(storage,vertical);
 const runs=[run,...(previous[0]&&fingerprint(previous[0])===fingerprint(run)?previous.slice(1):previous)].slice(0,HISTORY_LIMIT);
 storage.setItem(PREFIX+vertical,JSON.stringify({schemaVersion:1,runs}));
 return runs;
}
/** @param {Store} storage @param {string} vertical */
export function clearRuns(storage,vertical){storage.removeItem(PREFIX+vertical);}
/** Status changes from an older run to a newer one. `before`/`after` are null when a component was added or removed.
 * `partial` is true when either inventory exceeded the stored component limit, so only the stored part is compared.
 * @param {RunSnapshot} older @param {RunSnapshot} newer */
export function diffRuns(older,newer){
 const before=new Map(older.components.map(([id,name,status])=>[id,{name,status}])),after=new Map(newer.components.map(([id,name,status])=>[id,{name,status}]));
 /** @type {{id:string,name:string,before:string|null,after:string|null}[]} */
 const changes=[];
 for(const [id,c] of after){const old=before.get(id);if(!old)changes.push({id,name:c.name,before:null,after:c.status});else if(old.status!==c.status)changes.push({id,name:c.name,before:old.status,after:c.status});}
 for(const [id,c] of before)if(!after.has(id))changes.push({id,name:c.name,before:c.status,after:null});
 return {changes,verdictChanged:older.verdict!==newer.verdict,targetChanged:older.from!==newer.from||older.to!==newer.to||older.platform!==newer.platform||older.architecture!==newer.architecture,
  partial:older.total>older.components.length||newer.total>newer.components.length};
}
/** The recorded run a live result is compared with: the newest one that is not identical to it.
 * @param {RunSnapshot[]} runs newest first @param {import('../core/types').PreflightResult} result @returns {RunSnapshot|null} */
export function baselineRun(runs,result){const current=fingerprint(snapshotRun(result));return runs.find(run=>fingerprint(run)!==current)||null;}
/** Component id → its status in the baseline run, for components whose status differs now (null = not in that run).
 * Components beyond the stored limit are not compared, and "new" is not claimed against a truncated baseline.
 * @param {RunSnapshot} baseline @param {import('../core/types').PreflightResult} result @returns {Map<string,string|null>} */
export function statusChanges(baseline,result){
 const before=new Map(baseline.components.map(([id,,status])=>[id,status])),partial=baseline.total>baseline.components.length;
 /** @type {Map<string,string|null>} */
 const changes=new Map();
 for(const c of result.components.slice(0,HISTORY_COMPONENT_LIMIT)){
  const old=before.get(c.component.id);
  if(old===undefined){if(!partial)changes.set(c.component.id,null);}else if(old!==c.status)changes.set(c.component.id,old);
 }
 return changes;
}
