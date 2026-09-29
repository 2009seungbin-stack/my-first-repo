#!/usr/bin/env node
/** Seed edits → D1, through the one ingest pipeline (the first load is export-sql.mjs; everything
 * after it goes through here, NERULIO_2_MIGRATION_PLAN.md §2).
 *
 *   node tools/platform/seed-sync.mjs --d1 [--verticals games,ai] [--changed-since <git ref>] [--radar]
 *   node tools/platform/seed-sync.mjs --sqlite local.sqlite [...]      (a local D1 copy, e.g. a dry run)
 *   node tools/platform/seed-sync.mjs --plan [--verticals …] [--changed-since <ref>]   → JSON array
 *
 * --d1 writes through the D1 REST API (CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN) and records
 * each vertical as a run of "seed-sync-<vertical>" in collectors/collector_runs (admin app, alerts).
 * --changed-since keeps only verticals whose data/seed/<vertical>/ files changed since that ref
 * (an unknown ref, e.g. the all-zero "before" of a new branch, means every vertical).
 * --radar ingests in 'admin' mode (a curated correction worth showing on the Radar); the default
 * 'seed' mode records the history at importance 0.
 *
 * Safe to repeat: everything is written under the seed identity (platform/ingest.js header), so an
 * unchanged seed writes ~0 rows, never moves "last verified", and never reverts what collectors,
 * admins or the community wrote after the seed; entity names/descriptions merge per locale.
 * The whole seed is validated first — an invalid file anywhere stops the sync before any write. */
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ingest,SEED_ACTOR} from '../../platform/ingest.js';
import {D1Rest} from '../../platform/db/d1-rest.js';
import {recordRun} from '../../platform/collector-health.js';
import {VERTICALS} from '../../platform/schema.js';
import {loadSeeds,validateAll} from './validate-seed.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
/** A run older than a year is not "stale": seed syncs run on pushes, not on a schedule. */
export const SEED_SYNC_FRESHNESS_HOURS=24*365;
export const runId=(/** @type {string} */ vertical)=>`seed-sync-${vertical}`;

/** Verticals whose seed files changed since `ref` (null = every vertical: unknown or empty ref).
 * @param {string|undefined} ref @param {string} [cwd] @returns {string[]|null} */
export function changedVerticals(ref,cwd=ROOT){
 if(!ref||/^0+$/.test(ref))return null;
 let out;
 try{out=execFileSync('git',['diff','--name-only',ref,'HEAD','--','data/seed/'],{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']});}
 catch{return null;}
 const set=new Set();
 for(const line of out.split(/\r?\n/)){const m=/^data\/seed\/([a-z]+)\//.exec(line.trim());if(m&&VERTICALS.includes(/** @type {any} */(m[1])))set.add(m[1]);}
 return VERTICALS.filter(v=>set.has(v));
}

/** Which verticals to sync. @param {{verticals?:string,changedSince?:string}} o @returns {string[]} */
export function planVerticals(o={}){
 let list=o.verticals?String(o.verticals).split(',').map(s=>s.trim()).filter(Boolean):[...VERTICALS];
 const bad=list.filter(v=>!VERTICALS.includes(/** @type {any} */(v)));
 if(bad.length)throw Error(`unknown verticals: ${bad.join(', ')}`);
 if(o.changedSince!==undefined){const changed=changedVerticals(o.changedSince);if(changed)list=list.filter(v=>changed.includes(v));}
 return VERTICALS.filter(v=>list.includes(v));
}

/** Entity ids a document points at (relations, events, availability, compatibility, fact plans). @param {any} doc */
function referencedIds(doc){
 const ids=new Set();
 for(const e of doc.entities||[]){for(const r of e.relations||[])ids.add(r.o);for(const f of e.facts||[])if(f.plan&&f.plan!=='*')ids.add(f.plan);}
 for(const x of doc.events||[]){for(const id of x.entities||[])ids.add(id);if(x.page)ids.add(x.page);}
 for(const a of doc.availability||[]){ids.add(a.entity);if(a.plan&&a.plan!=='*')ids.add(a.plan);}
 for(const c of doc.compatibility||[]){ids.add(c.subject);ids.add(c.target);}
 return ids;
}
/** The identity part of an entity definition (what a reference needs to exist). @param {any} e */
const identity=e=>({id:e.id,type:e.type,slug:e.slug,names:e.names,...(e.aliases?{aliases:e.aliases}:{}),...(e.description?{description:e.description}:{}),...(e.official_urls?{official_urls:e.official_urls}:{}),...(e.regions?{regions:e.regions}:{}),...(e.image_url?{image_url:e.image_url}:{})});

/**
 * Sync the seed documents of `verticals` into `db`.
 * Pass 0: entities of OTHER verticals that the selected documents reference and the database lacks
 *         (identity only — their facts belong to their own vertical's sync).
 * Pass 1: sources, entities and facts of every selected document.
 * Pass 2: relations, versions, events, availability, compatibility (every entity exists by now).
 * @param {any} db D1 binding (D1Rest, D1Shim, Worker D1) @param {{verticals:string[],radar?:boolean,now?:number,seeds?:{file:string,doc:any}[],log?:(m:string)=>void}} o
 */
export async function syncSeeds(db,o){
 const seeds=o.seeds||loadSeeds(),log=o.log||(()=>{}),now=o.now??Date.now();
 const bad=validateAll(seeds).filter(r=>r.errors.length);
 if(bad.length)throw Error(`invalid seed: ${path.basename(bad[0].file)}: ${bad[0].errors[0]}`);
 const opts={mode:/** @type {const} */(o.radar?'admin':'seed'),actor:SEED_ACTOR,now};
 const count=()=>({queries:Number(db.queries)||0,rowsWritten:Number(db.rowsWritten)||0});
 /** @type {Record<string,any>} */const report={};
 const owner=new Map();for(const {doc} of seeds)for(const e of doc.entities||[])owner.set(e.id,{vertical:doc.vertical,e});
 for(const vertical of o.verticals){
  const t0=Date.now(),c0=count(),docs=seeds.filter(s=>s.doc.vertical===vertical).map(s=>s.doc);
  const r={files:docs.length,entities:0,created:0,facts:{added:0,changed:0,confirmed:0,conflicts:0,kept:0},changes:0,foreign:0,queries:0,rowsWritten:0,ms:0};
  const add=(/** @type {any} */ s)=>{r.created+=s.created;r.changes+=s.changes;for(const k of /** @type {const} */(['added','changed','confirmed','conflicts','kept']))r.facts[k]+=s.facts[k]||0;};
  // Pass 0
  const own=new Set(docs.flatMap(d=>(d.entities||[]).map((/** @type {any} */ e)=>e.id)));
  const foreign=[...new Set(docs.flatMap(d=>[...referencedIds(d)]))].filter(id=>!own.has(id)&&owner.has(id));
  const missing=[];
  for(let i=0;i<foreign.length;i+=40){
   const c=foreign.slice(i,i+40);
   const found=new Set(((await db.prepare(`SELECT id FROM entities WHERE id IN (${c.map(()=>'?').join(',')})`).bind(...c).all()).results||[]).map((/** @type {any} */ x)=>x.id));
   missing.push(...c.filter(id=>!found.has(id)));
  }
  for(const v of VERTICALS){
   const ents=missing.filter(id=>owner.get(id).vertical===v).map(id=>identity(owner.get(id).e));
   if(ents.length){add(await ingest(db,{schema:'nerulio.seed/1',vertical:v,sources:[],entities:ents},opts));r.foreign+=ents.length;}
  }
  // Pass 1
  for(const doc of docs){
   const s=await ingest(db,{schema:doc.schema,vertical:doc.vertical,sources:doc.sources,entities:(doc.entities||[]).map((/** @type {any} */ e)=>({...e,relations:undefined,versions:undefined}))},opts);
   add(s);r.entities+=(doc.entities||[]).length;
  }
  // Pass 2 (entities as bare references: their names and facts were handled in pass 1)
  for(const doc of docs){
   add(await ingest(db,{schema:doc.schema,vertical:doc.vertical,sources:[],entities:(doc.entities||[]).filter((/** @type {any} */ e)=>e.relations?.length||e.versions?.length).map((/** @type {any} */ e)=>({id:e.id,relations:e.relations,versions:e.versions})),
    events:doc.events,availability:doc.availability,compatibility:doc.compatibility},opts));
  }
  const c1=count();r.queries=c1.queries-c0.queries;r.rowsWritten=c1.rowsWritten-c0.rowsWritten;r.ms=Date.now()-t0;
  report[vertical]=r;
  log(`${vertical}: ${r.files} files, ${r.entities} entities (${r.created} new, ${r.foreign} referenced from other verticals), facts +${r.facts.added} ~${r.facts.changed} =${r.facts.confirmed} kept ${r.facts.kept} conflicts ${r.facts.conflicts}, ${r.changes} changes, ${r.queries} queries, ${r.rowsWritten} rows written, ${r.ms} ms`);
 }
 return report;
}

/** @param {string[]} argv */
function args(argv){/** @type {Record<string,string|true>} */const o={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2),n=argv[i+1];if(n===undefined||n.startsWith('--'))o[k]=true;else{o[k]=n;i++;}}}return o;}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const o=args(process.argv.slice(2));
 const verticals=planVerticals({verticals:typeof o.verticals==='string'?o.verticals:undefined,changedSince:typeof o['changed-since']==='string'?o['changed-since']:undefined});
 if(o.plan){console.log(JSON.stringify(verticals));}
 else{
  /** @type {any} */let db;
  if(o.d1)db=new D1Rest({accountId:process.env.CF_ACCOUNT_ID||'',databaseId:process.env.CF_D1_DATABASE_ID||'',token:process.env.CF_API_TOKEN||''});
  else if(typeof o.sqlite==='string'){const {D1Shim}=await import('../../tests/d1-shim.mjs');db=new D1Shim(o.sqlite);db.raw.exec('PRAGMA foreign_keys=ON');}
  else{console.error('usage: seed-sync.mjs (--d1 | --sqlite <file> | --plan) [--verticals a,b] [--changed-since <ref>] [--radar]');process.exitCode=2;}
  if(db){
   if(!verticals.length)console.log('seed-sync: no seed changes to sync');
   let failed=0;
   for(const v of verticals){
    const started=Date.now();/** @type {any} */let r=null,error=null;
    const c0={q:Number(db.queries)||0,w:Number(db.rowsWritten)||0};
    try{r=(await syncSeeds(db,{verticals:[v],radar:!!o.radar,log:m=>console.log(m)}))[v];}
    catch(e){error=String(/** @type {any} */(e)?.stack||e).slice(0,2000);failed++;console.error(`seed-sync ${v}: ${error}`);}
    if(o.d1){
     try{await recordRun(db,{id:runId(v),vertical:v,mode:'auto',freshnessHours:SEED_SYNC_FRESHNESS_HOURS},{started,finished:Date.now(),error,observations:r?.entities||0,changes:r?.changes||0,rowsWritten:(Number(db.rowsWritten)||0)-c0.w,queries:(Number(db.queries)||0)-c0.q});}
     catch(e){console.error(`seed-sync ${v}: could not record the run: ${e}`);failed++;}
    }
   }
   process.exitCode=failed?1:0;
  }
 }
}
