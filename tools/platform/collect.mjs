#!/usr/bin/env node
/** Run collectors locally or in CI.
 *   node tools/platform/collect.mjs --adapter steam-store [--out file.json] [--limit 20]
 *   node tools/platform/collect.mjs --all --d1        (CF_ACCOUNT_ID, CF_API_TOKEN, CF_D1_DATABASE_IDS env)
 *   node tools/platform/collect.mjs --adapters claude-status,openai-status --d1
 * With --d1 the output goes through the ingest pipeline straight into D1 (REST API) and every run is
 * recorded in `collectors` / `collector_runs` (architecture D6). CF_D1_DATABASE_IDS=preview:<id>,prod:<id>
 * (or the older single CF_D1_DATABASE_ID) lists the databases: each adapter runs ONCE and the same
 * document is ingested into every database in turn (platform/db/d1-targets.js); a failed database never
 * skips the next one, and the exit code is 1 if any failed.
 * Targets (which entities to refresh) come from the seed data: every entity with its facts. The
 * adapter's output is validated as a seed document before it is written or sent. */
import {readdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runAdapter} from '../../collectors/_runtime.js';
import {loadSeeds} from './validate-seed.mjs';
import {validateSeed} from '../../platform/seed.js';
import {ingest} from '../../platform/ingest.js';
import {openD1Targets,counters,targetLine} from '../../platform/db/d1-targets.js';
import {recordRun} from '../../platform/collector-health.js';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export function adapterIds(){return readdirSync(path.join(ROOT,'collectors'),{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('_')&&existsSync(path.join(ROOT,'collectors',d.name,'index.js'))).map(d=>d.name).sort();}
export async function loadAdapter(id){return (await import(pathToFileURL(path.join(ROOT,'collectors',id,'index.js')).href)).default;}
/** Entities as collectors see them: {id,type,vertical,names,aliases,facts:{p:v},factRegions:{p:[region…]}}.
 * `facts` holds the unscoped values; `factRegions` lists the regions each property is seeded in ('*' =
 * unscoped), so an adapter can write into the scope the curated value uses (one release date, not two). */
export function seedTargets(seeds=loadSeeds()){
 return seeds.flatMap(({doc})=>(doc.entities||[]).map(e=>{
  /** @type {Record<string,string[]>} */const factRegions={};
  for(const f of e.facts||[])if(!f.plan&&!f.platform)(factRegions[f.p]??=[]).includes(f.region||'*')||factRegions[f.p].push(f.region||'*');
  return {id:e.id,type:e.type,vertical:doc.vertical,slug:e.slug,names:e.names,aliases:e.aliases||[],facts:Object.fromEntries((e.facts||[]).filter(f=>!f.region&&!f.plan&&!f.platform).map(f=>[f.p,f.v])),factRegions,versions:e.versions||[]};
 }));
}
function args(argv){const o={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2),n=argv[i+1];if(n===undefined||n.startsWith('--'))o[k]=true;else{o[k]=n;i++;}}}return o;}

/**
 * Ingest one adapter run into every target, in order, and record the run in each. Never throws: a
 * target that fails (ingest or run record) is logged and counted, and the next target still runs.
 * @param {{label:string,db:any}[]} targets @param {any} adapter @param {string} id
 * @param {any} run runAdapter() result @param {string[]} errors validation errors of run.doc
 * @param {(m:string)=>void} [log] @returns {Promise<number>} failed targets
 */
export async function ingestRun(targets,adapter,id,run,errors,log=console.log){
 let failed=0;
 for(const {label,db} of targets){
  const c0=counters(db);
  let stats=null,error=run.error||(errors.length?`validation: ${errors.slice(0,3).join('; ')}`:null);
  // A fresh copy per database: the same document, whatever ingest does with the object it is given.
  if(run.doc&&!errors.length){try{stats=await ingest(db,structuredClone({...run.doc,snapshots:run.snapshots}),{mode:'collector',actor:`collector:${id}`,adapter:id,now:run.finished});}catch(e){error=`ingest: ${e}`;}}
  // What this run cost (before its own run record): shown per run in the admin app.
  const c1=counters(db),queries=c1.queries-c0.queries,rowsWritten=c1.rowsWritten-c0.rowsWritten;
  try{await recordRun(db,{id,vertical:adapter.vertical,mode:adapter.mode,freshnessHours:adapter.freshnessHours},{started:run.started,finished:run.finished,error,observations:run.doc?.entities?.length||0,changes:stats?.changes||0,rowsWritten,queries});}
  catch(e){error=error?`${error}; run record: ${e}`:`run record: ${e}`;}
  log(targetLine(label,id,{error,changes:stats?.changes||0,queries,rowsWritten}));
  if(error)failed++;
 }
 return failed;
}

/**
 * The command line. Returns the exit code (0 ok, 1 a collector or a database failed, 2 nothing to run).
 * @param {string[]} argv
 * @param {{env?:Record<string,string|undefined>,open?:(spec:{label:string,databaseId:string},env:any)=>any,load?:(id:string)=>Promise<any>,fetch?:typeof fetch,log?:(m:string)=>void,logErr?:(m:string)=>void}} [deps]
 */
export async function main(argv,deps={}){
 const log=deps.log||console.log,logErr=deps.logErr||console.error,load=deps.load||loadAdapter;
 const o=args(argv),ids=o.all?adapterIds():o.adapters?String(o.adapters).split(',').filter(Boolean):[o.adapter].filter(Boolean);
 // Every database is opened (and the list checked) before any source is fetched.
 const d1=o.d1?openD1Targets(deps.env||process.env,deps.open):null;
 if(d1)log(`d1 targets: ${d1.map(t=>t.label).join(', ')}`);
 if(!ids.length){log('adapters: '+adapterIds().join(', '));return 2;}
 const seeds=loadSeeds(),targets=seedTargets(seeds),known={entities:new Set(targets.map(t=>t.id)),sources:new Set(seeds.flatMap(s=>(s.doc.sources||[]).map(x=>x.id)))};
 let failed=0;
 for(const id of ids){
  const adapter=await load(id);
  const lim=o.limit?Number(o.limit):Infinity;
  const mine=targets.filter(t=>!adapter.vertical||t.vertical===adapter.vertical||adapter.crossVertical).slice(0,lim);
  const run=await runAdapter(adapter,{targets:mine,log:logErr,...(deps.fetch?{fetch:deps.fetch}:{})});
  const errors=run.doc?validateSeed(run.doc,known):[];
  const report={adapter:id,started:new Date(run.started).toISOString(),finished:new Date(run.finished).toISOString(),error:run.error,validation:errors,snapshots:run.snapshots.length,entities:run.doc?.entities?.length||0};
  log(JSON.stringify(report));
  if(run.error||errors.length)failed++;
  if(o.out&&run.doc)writeFileSync(ids.length>1?o.out.replace(/(\.json)?$/,`.${id}.json`):o.out,JSON.stringify({...run.doc,snapshots:run.snapshots},null,1));
  if(d1&&!run.manual)failed+=await ingestRun(d1,adapter,id,run,errors,log);
  if(o.ingest&&run.doc&&!errors.length){
   const token=(deps.env||process.env).INGEST_TOKEN;if(!token)throw Error('INGEST_TOKEN is required with --ingest');
   const res=await fetch(o.ingest,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({adapter:id,run:{started:run.started,finished:run.finished,error:run.error},doc:run.doc,snapshots:run.snapshots})});
   log(`ingest ${id}: HTTP ${res.status} ${(await res.text()).slice(0,300)}`);
   if(!res.ok)failed++;
  }
 }
 return failed?1:0;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // exitCode instead of process.exit(): exiting while fetch sockets close trips a libuv assertion on Windows.
 try{process.exitCode=await main(process.argv.slice(2));}
 catch(e){console.error(String(e?.stack||e));process.exitCode=1;}
}
