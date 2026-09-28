#!/usr/bin/env node
/** Validate every seed file: node tools/platform/validate-seed.mjs [dir-or-file ...]
 * Cross-file references (entities/sources defined in another seed file) are allowed. */
import {readdirSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSeed} from '../../platform/seed.js';
const ROOT=fileURLToPath(new URL('../../data/seed/',import.meta.url));
export function seedFiles(dir=ROOT){
 const out=[];for(const name of readdirSync(dir).sort()){const p=path.join(dir,name);if(statSync(p).isDirectory())out.push(...seedFiles(p));else if(name.endsWith('.json'))out.push(p);}
 return out;
}
export function loadSeeds(files=seedFiles()){return files.map(f=>({file:f,doc:JSON.parse(readFileSync(f,'utf8'))}));}
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
 const args=process.argv.slice(2),files=args.length?args.flatMap(a=>statSync(a).isDirectory()?seedFiles(a):[path.resolve(a)]):seedFiles();
 const all=args.length?[...new Set([...seedFiles(),...files])]:files;
 const results=validateAll(loadSeeds(all)).filter(r=>files.includes(r.file));
 let bad=0,count=0;
 for(const r of results){count+=r.entities;if(r.errors.length){bad++;console.log(`✗ ${path.relative(process.cwd(),r.file)}`);for(const e of r.errors)console.log('   '+e);}else console.log(`✓ ${path.relative(process.cwd(),r.file)} (${r.entities} entities)`);}
 console.log(`${results.length} files, ${count} entities, ${bad} invalid`);
 process.exit(bad?1:0);
}
