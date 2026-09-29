#!/usr/bin/env node
/** Import every seed file into a D1-compatible database through the one ingest pipeline.
 * Seed files reference entities defined in other files, so the import runs in two passes:
 * 1. sources, entities and facts of every file (no cross-file references yet),
 * 2. the full documents (relations, versions, events, availability, compatibility).
 * Usage (local preview DB): node tools/platform/seed-db.mjs out.sqlite */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ingest} from '../../platform/ingest.js';
import {loadSeeds,validateAll} from './validate-seed.mjs';

/** @param {any} db D1 binding @param {{file:string,doc:any}[]} [seeds] @param {number} [now] */
export async function seedDatabase(db,seeds=loadSeeds(),now=Date.now()){
 const bad=validateAll(seeds).filter(r=>r.errors.length);
 if(bad.length)throw Error(`invalid seed: ${path.basename(bad[0].file)}: ${bad[0].errors[0]}`);
 const opts={mode:/** @type {const} */('seed'),actor:'seed',now};
 for(const {doc} of seeds)await ingest(db,{schema:doc.schema,vertical:doc.vertical,sources:doc.sources,
  entities:(doc.entities||[]).map((/** @type {any} */ e)=>({...e,relations:undefined,versions:undefined}))},opts);
 let entities=0;
 for(const {doc} of seeds){await ingest(db,doc,opts);entities+=(doc.entities||[]).length;}
 return {files:seeds.length,entities};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv[2];
 if(!out){console.error('usage: node tools/platform/seed-db.mjs <out.sqlite>');process.exit(2);}
 const {rmSync}=await import('node:fs');rmSync(out,{force:true});
 const {D1Shim}=await import('../../tests/d1-shim.mjs');
 const db=D1Shim.migrated(out);
 const t=Date.now(),r=await seedDatabase(db);
 console.log(`${r.files} files, ${r.entities} entities → ${out} in ${Date.now()-t} ms`);
}
