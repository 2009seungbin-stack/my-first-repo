#!/usr/bin/env node
/** Run collectors locally or in CI.
 *   node tools/platform/collect.mjs --adapter steam-store [--out file.json] [--limit 20]
 *   node tools/platform/collect.mjs --all --ingest https://nerulio.com/api/v2/admin/ingest   (INGEST_TOKEN env)
 * Targets (which entities to refresh) come from the seed data: every entity with its facts. The
 * adapter's output is validated as a seed document before it is written or sent. */
import {readdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runAdapter} from '../../collectors/_runtime.js';
import {loadSeeds,validateAll} from './validate-seed.mjs';
import {validateSeed} from '../../platform/seed.js';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export function adapterIds(){return readdirSync(path.join(ROOT,'collectors'),{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('_')&&existsSync(path.join(ROOT,'collectors',d.name,'index.js'))).map(d=>d.name).sort();}
export async function loadAdapter(id){return (await import(pathToFileURL(path.join(ROOT,'collectors',id,'index.js')).href)).default;}
/** Entities as collectors see them: {id,type,vertical,names,aliases,facts:{p:v}}. */
export function seedTargets(seeds=loadSeeds()){
 return seeds.flatMap(({doc})=>(doc.entities||[]).map(e=>({id:e.id,type:e.type,vertical:doc.vertical,slug:e.slug,names:e.names,aliases:e.aliases||[],facts:Object.fromEntries((e.facts||[]).filter(f=>!f.region&&!f.plan&&!f.platform).map(f=>[f.p,f.v])),versions:e.versions||[]})));
}
function args(argv){const o={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2),n=argv[i+1];if(n===undefined||n.startsWith('--'))o[k]=true;else{o[k]=n;i++;}}}return o;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const o=args(process.argv.slice(2)),ids=o.all?adapterIds():[o.adapter].filter(Boolean);
 if(!ids.length){console.log('adapters:',adapterIds().join(', '));process.exitCode=2;}
 const seeds=loadSeeds(),targets=seedTargets(seeds),known={entities:new Set(targets.map(t=>t.id)),sources:new Set(seeds.flatMap(s=>(s.doc.sources||[]).map(x=>x.id)))};
 let failed=0;
 for(const id of ids){
  const adapter=await loadAdapter(id);
  const lim=o.limit?Number(o.limit):Infinity;
  const mine=targets.filter(t=>!adapter.vertical||t.vertical===adapter.vertical||adapter.crossVertical).slice(0,lim);
  const run=await runAdapter(adapter,{targets:mine,log:m=>console.error(m)});
  const errors=run.doc?validateSeed(run.doc,known):[];
  const report={adapter:id,started:new Date(run.started).toISOString(),finished:new Date(run.finished).toISOString(),error:run.error,validation:errors,snapshots:run.snapshots.length,entities:run.doc?.entities?.length||0};
  console.log(JSON.stringify(report));
  if(run.error||errors.length)failed++;
  if(o.out&&run.doc)writeFileSync(ids.length>1?o.out.replace(/(\.json)?$/,`.${id}.json`):o.out,JSON.stringify({...run.doc,snapshots:run.snapshots},null,1));
  if(o.ingest&&run.doc&&!errors.length){
   const token=process.env.INGEST_TOKEN;if(!token)throw Error('INGEST_TOKEN is required with --ingest');
   const res=await fetch(o.ingest,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({adapter:id,run:{started:run.started,finished:run.finished,error:run.error},doc:run.doc,snapshots:run.snapshots})});
   console.log(`ingest ${id}: HTTP ${res.status} ${(await res.text()).slice(0,300)}`);
   if(!res.ok)failed++;
  }
 }

 // exitCode instead of process.exit(): exiting while fetch sockets close trips a libuv assertion on Windows.
 process.exitCode=failed?1:ids.length?0:2;
}
