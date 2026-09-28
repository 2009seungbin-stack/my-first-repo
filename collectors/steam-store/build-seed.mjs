#!/usr/bin/env node
/** Regenerate data/seed/games/steam-games.json from collectors/steam-store/targets.json by running
 * the steam-store and steam-news adapters (live network, polite: ≥1.5 s between requests per host).
 *
 *   node collectors/steam-store/build-seed.mjs [--limit N] [--skip-news] [--out file]
 *
 * - Entity ids are `game:steam-<appid>`; slugs and org ids already in the seed file are kept stable.
 * - A game whose fetch fails this time keeps its previous entity (no silent data loss).
 * - curated.json names are compared with the store names; a mismatch is reported (wrong appid guard).
 * - The result is validated against every other seed file before it is written. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runAdapter} from '../_runtime.js';
import {createSteamStoreAdapter} from './index.js';
import {createSteamNewsAdapter} from '../steam-news/index.js';
import {loadSeeds,seedFiles,validateAll} from '../../tools/platform/validate-seed.mjs';
import {normName} from '../../platform/schema.js';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map((a,i,all)=>a.startsWith('--')?[a.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]:null).filter(Boolean));
const OUT=typeof args.out==='string'?args.out:ROOT+'data/seed/games/steam-games.json';
const log=(/** @type {string} */ m)=>console.error(m);

const targets=JSON.parse(readFileSync(ROOT+'collectors/steam-store/targets.json','utf8')).targets.slice(0,args.limit?Number(args.limit):undefined);
const curatedNames=new Map(JSON.parse(readFileSync(ROOT+'collectors/steam-store/curated.json','utf8')).targets.map(c=>[c.appid,c.name]));
const prev=existsSync(OUT)?JSON.parse(readFileSync(OUT,'utf8')):{sources:[],entities:[]};
const prevById=new Map(prev.entities.map(e=>[e.id,e]));
const others=loadSeeds(seedFiles().filter(f=>f.replace(/\\/g,'/')!==OUT.replace(/\\/g,'/')));
// Other files' games entities reserve their slugs; previous orgs are reused by name.
const reserved=others.filter(s=>s.doc.vertical==='games').flatMap(s=>s.doc.entities||[]).map(e=>({id:e.id,type:e.type,vertical:'games',slug:e.slug,names:e.names,aliases:e.aliases||[],facts:{}}));
const prevOrgs=prev.entities.filter(e=>e.type==='org').map(e=>({id:e.id,type:'org',vertical:'games',slug:e.slug,names:e.names,aliases:e.aliases||[],facts:{}}));
const stubs=targets.map(t=>({id:`game:steam-${t.appid}`,type:'game',vertical:'games',slug:prevById.get(`game:steam-${t.appid}`)?.slug,facts:{steam_appid:t.appid}}));

const store=await runAdapter(createSteamStoreAdapter(),{targets:[...stubs,...prevOrgs,...reserved],log});
if(store.error)throw Error(store.error);
const doc=store.doc;
const got=new Set(doc.entities.map(e=>e.id));
// Keep previously collected games that failed this run (transient errors), with their sources.
for(const s of stubs)if(!got.has(s.id)&&prevById.has(s.id)){
 const e=prevById.get(s.id);log(`kept previous entity for ${s.id}`);doc.entities.push(e);
 const srcIds=new Set([...(e.facts||[]),...(e.relations||[]),...(e.versions||[])].map(x=>x.src));
 for(const src of prev.sources)if(srcIds.has(src.id)&&!doc.sources.some(x=>x.id===src.id))doc.sources.push(src);
 for(const r of e.relations||[])if(!doc.entities.some(x=>x.id===r.o)){const o=prevById.get(r.o);if(o)doc.entities.push(o);}
}
const mismatches=[];
for(const e of doc.entities.filter(e=>e.type==='game')){
 const appid=Number(e.id.split('-').pop()),want=curatedNames.get(appid);
 if(want&&!normName(e.names.en).includes(normName(want))&&!normName(want).includes(normName(e.names.en)))mismatches.push(`${appid}: curated "${want}" vs store "${e.names.en}"`);
}
if(!args['skip-news']){
 const games=doc.entities.filter(e=>e.type==='game').map(e=>({id:e.id,type:'game',vertical:'games',facts:{steam_appid:e.facts.find(f=>f.p==='steam_appid').v}}));
 const news=await runAdapter(createSteamNewsAdapter(),{targets:games,log});
 if(news.error)log(`steam-news failed: ${news.error}`);
 else{
  const byId=new Map(doc.entities.map(e=>[e.id,e]));
  for(const u of news.doc.entities){const e=byId.get(u.id);e.facts=[...e.facts.filter(f=>f.p!=='last_update_at'&&f.p!=='current_build'),...u.facts];if(u.versions)e.versions=u.versions;}
  doc.sources.push(...news.doc.sources);
 }
}
// Stable, reviewable output: snapshots are provenance for live ingest, not seed content.
const strip=(/** @type {any} */ x)=>{const {snap,...rest}=x;return rest;};
const games=doc.entities.filter(e=>e.type==='game').sort((a,b)=>a.slug<b.slug?-1:1);
const orgs=doc.entities.filter(e=>e.type==='org').sort((a,b)=>a.id<b.id?-1:1);
const out={schema:'nerulio.seed/1',vertical:'games',
 sources:[...new Map(doc.sources.map(s=>[s.id,s])).values()].sort((a,b)=>a.id<b.id?-1:1),
 entities:[...games,...orgs].map(e=>({...e,facts:(e.facts||[]).map(strip)}))};
const results=validateAll([...others,{file:OUT,doc:out}]).filter(r=>r.file===OUT);
const errors=results.flatMap(r=>r.errors);
if(errors.length){console.error(errors.slice(0,40).join('\n'));process.exit(1);}
writeFileSync(OUT,JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({games:games.length,orgs:orgs.length,sources:out.sources.length,store:doc.stats,mismatches},null,1));
