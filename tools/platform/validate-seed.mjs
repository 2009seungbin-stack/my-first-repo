#!/usr/bin/env node
/** Validate every seed file: node tools/platform/validate-seed.mjs [dir-or-file ...]
 * Cross-file references (entities/sources defined in another seed file) are allowed. */
import {readdirSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSeed} from '../../platform/seed.js';
const ROOT=fileURLToPath(new URL('../../data/seed/',import.meta.url));
export function seedFiles(dir=ROOT){
 dir=path.resolve(dir);const out=[];for(const name of readdirSync(dir).sort()){const p=path.join(dir,name);if(statSync(p).isDirectory())out.push(...seedFiles(p));else if(name.endsWith('.json'))out.push(p);}
 return out;
}
/** A UTF-8 BOM (e.g. from a PowerShell write) is refused with a clear message, not a JSON error. */
export function readSeed(file){
 const text=readFileSync(file,'utf8');
 if(text.charCodeAt(0)===0xfeff)throw Error(`${file}: remove the UTF-8 byte order mark (save as UTF-8 without BOM)`);
 try{return JSON.parse(text);}catch(e){throw Error(`${file}: invalid JSON: ${e.message}`);}
}
/** Non-blocking quality warnings: entities without a Korean name or description, per vertical and type.
 * Korean pages still work (they fall back to English); these are the backlog for Korean coverage. */
export function koreanCoverage(seeds=loadSeeds()){
 /** @type {Record<string,{total:number,noName:number,noDesc:number}>} */const out={};
 for(const {doc} of seeds)for(const e of doc.entities||[]){
  if(e.names===undefined)continue;
  const k=`${doc.vertical}:${e.type}`,r=out[k]??={total:0,noName:0,noDesc:0};
  r.total++;if(!e.names.ko||!/[\uac00-\ud7a3]/.test(e.names.ko))r.noName++;if(!e.description?.ko)r.noDesc++;
 }
 return out;
}
export function loadSeeds(files=seedFiles()){return files.map(f=>({file:path.resolve(f),doc:readSeed(f)}));}
export function validateAll(seeds=loadSeeds()){
 const entities=new Set(),sources=new Set(),results=[];
 for(const {doc} of seeds){for(const e of doc.entities||[])entities.add(e.id);for(const s of doc.sources||[])sources.add(s.id);}
 const seenE=new Map(),seenS=new Map();
 for(const {file,doc} of seeds){
  const errors=validateSeed(doc,{entities,sources});
  for(const e of doc.entities||[]){if(seenE.has(e.id))errors.push(`entity ${e.id} also defined in ${path.basename(seenE.get(e.id))}`);else seenE.set(e.id,file);}
  for(const s of doc.sources||[]){if(seenS.has(s.id))errors.push(`source ${s.id} also defined in ${path.basename(seenS.get(s.id))}`);else seenS.set(s.id,file);}
  results.push({file,errors,entities:(doc.entities||[]).length});
 }
 return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2).filter(a=>!a.startsWith('--')),files=args.length?args.flatMap(a=>statSync(a).isDirectory()?seedFiles(a):[path.resolve(a)]):seedFiles();
 const all=args.length?[...new Set([...seedFiles(),...files])]:files;
 const results=validateAll(loadSeeds(all)).filter(r=>files.includes(r.file));
 let bad=0,count=0;
 for(const r of results){count+=r.entities;if(r.errors.length){bad++;console.log(`✗ ${path.relative(process.cwd(),r.file)}`);for(const e of r.errors)console.log('   '+e);}else console.log(`✓ ${path.relative(process.cwd(),r.file)} (${r.entities} entities)`);}
 console.log(`${results.length} files, ${count} entities, ${bad} invalid`);
 if(process.argv.includes('--korean')){
  const cov=koreanCoverage();
  console.log('\nKorean coverage (warnings only): type · entities · without Hangul name · without ko description');
  for(const [k,r] of Object.entries(cov).sort((a,b)=>b[1].noName-a[1].noName))console.log(`  ${k.padEnd(32)} ${String(r.total).padStart(4)}  ${String(r.noName).padStart(4)}  ${String(r.noDesc).padStart(4)}`);
 }
 process.exitCode=bad?1:0;
}
