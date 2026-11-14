import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{TAGS_URL,MIRROR_TAGS_URL,MIRROR_SOURCE_ID,SOURCE_ID,MAX_VERSIONS} from '../collectors/blender-releases/index.js';
import {runAdapter} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';
import {ingest,canon} from '../platform/ingest.js';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {publishedNews} from '../platform/news.js';
const NOW=Date.parse('2026-11-14T09:00:00Z'),KNOWN={entities:new Set(['app:blender'])};
const sha=n=>n.toString(16).padStart(40,'0'),tag=(version,n)=>({name:'v'+version,commit:{sha:sha(n),url:'https://ignored.invalid/private'}});
const tags=[tag('4.5.16',1),tag('5.3.0',2),{name:'v5.4.0-alpha',commit:{sha:sha(3)}},tag('5.3.0',2)];
const commit=n=>({sha:sha(n),committer:{date:n===1?'2026-11-10T00:15:00+02:00':'2026-11-09T22:11:24Z',name:'UNUSED_PERSON',email:'unused@example.invalid'},message:'UNUSED_MESSAGE'});
async function run({primary=403,list=tags,commitAt=commit,commitStatus=200}={}){
 const calls=[];let clock=NOW;
 const fetch=async url=>{
  calls.push(url);let body,status;
  if(url===TAGS_URL){status=primary;body=primary===200?'not JSON':'denied';}
  else if(url===MIRROR_TAGS_URL){status=200;body=JSON.stringify(list);}
  else{assert.match(url,/^https:\/\/api\.github\.com\/repos\/blender\/blender\/git\/commits\/[a-f0-9]{40}$/);status=commitStatus;body=JSON.stringify(commitAt(parseInt(url.slice(-40),16)));}
  return new Response(body,{status,headers:{'content-type':'application/json'}});
 };
 // Advance the mock clock beyond the existing politeness delay; production timing is unchanged.
 const result=await runAdapter(adapter,{fetch,now:()=>clock+=adapter.minIntervalMs});return {...result,calls};
}

test('403 uses official mirror metadata, bounded commit URLs and actual UTC dates without retaining author/body fields',async()=>{
 const r=await run();assert.equal(r.error,null);assert.deepEqual(validateSeed(r.doc,KNOWN),[]);
 assert.deepEqual(r.calls,[TAGS_URL,MIRROR_TAGS_URL,'https://api.github.com/repos/blender/blender/git/commits/'+sha(2),'https://api.github.com/repos/blender/blender/git/commits/'+sha(1)]);
 const e=r.doc.entities[0];assert.equal(e.facts[0].v,'5.3.0');assert.equal(e.facts[0].src,MIRROR_SOURCE_ID);assert.equal(e.facts[0].ver,'OFFICIAL');assert.equal(e.facts[0].only_if_newer,true);assert.match(e.facts[0].note,/UTC/);
 assert.deepEqual(e.versions.map(v=>[v.version,v.released,v.src]),[['5.3.0','2026-11-09',MIRROR_SOURCE_ID],['4.5.16','2026-11-09',MIRROR_SOURCE_ID]]);
 assert(e.versions.every(v=>v.notes_url===`https://projects.blender.org/blender/blender/src/tag/v${v.version}`));
 assert.deepEqual(r.doc.sources.map(s=>s.id),[SOURCE_ID,MIRROR_SOURCE_ID]);assert.equal(r.snapshots[0].http_status,403);assert.match(r.doc.sources[1].note,/UTC day/);
 assert(!JSON.stringify(r.doc).includes('UNUSED_')&&!JSON.stringify(r.snapshots).includes('UNUSED_'));
});

test('429 and server refusal can use the mirror; other HTTP and malformed successful primary data remain errors',async()=>{
 for(const primary of [429,500,503])assert.equal((await run({primary})).error,null);
 for(const primary of [401,404,200]){const r=await run({primary});assert(r.error);assert.equal(r.doc,null);assert.deepEqual(r.calls,[TAGS_URL]);}
});

test('mirror data failures return no partial document',async()=>{
 const cases=[
  {list:{}},{list:[]},{list:[{name:'v5.3.0',commit:{sha:'../../not-a-commit'}}]},
  {commitStatus:503},{commitAt:n=>({...commit(n),sha:sha(99)})},
  {commitAt:n=>({...commit(n),committer:{date:'2026-02-30T00:00:00Z'}})},
  {commitAt:n=>({...commit(n),committer:{date:'2026-11-09T24:00:00Z'}})},
  {commitAt:n=>({...commit(n),committer:{date:'unknown'}})},
 ];
 for(const options of cases){const r=await run(options);assert(r.error,JSON.stringify(options));assert.equal(r.doc,null);assert(r.calls.length<=4);}
});

test('only twelve unique numeric tags are resolved, with no response-controlled host or commit URL',async()=>{
 const list=Array.from({length:30},(_,i)=>tag('5.3.'+i,i+1));list.push(list[29],{name:'not-a-release',commit:{sha:'invalid'}});
 const r=await run({list,commitAt:n=>({...commit(n),committer:{date:'2026-11-09T00:00:00Z'}})});
 assert.equal(r.error,null);assert.equal(r.doc.entities[0].versions.length,MAX_VERSIONS);assert.equal(r.calls.length,MAX_VERSIONS+2);
 assert.equal(r.doc.entities[0].versions[0].version,'5.3.29');assert.equal(r.doc.entities[0].versions.at(-1).version,'5.3.18');
 assert(r.calls.every(u=>['projects.blender.org','api.github.com'].includes(new URL(u).hostname)));
});

test('real D1 ingest records both provenance sources and the 403 snapshot without replacing a newer known version',{skip:!sqliteAvailable},async()=>{
 const r=await run(),db=D1Shim.migrated();assert.equal(r.error,null);
 try{
  await ingest(db,{schema:'nerulio.seed/1',vertical:'studio',sources:[r.doc.sources[0]],entities:[{id:'app:blender',type:'app',slug:'blender',names:{en:'Blender'},facts:[{p:'latest_version',v:'6.0.0',ver:'OFFICIAL',src:SOURCE_ID}],versions:[{version:'6.0.0',channel:'stable',released:'2026-11-08',src:SOURCE_ID}]}]},{mode:'seed',actor:'seed',now:NOW-864e5});
  await ingest(db,{...r.doc,snapshots:r.snapshots},{mode:'collector',actor:'collector:blender-releases',adapter:adapter.id,now:NOW});
  assert.equal(db.raw.prepare("SELECT value FROM facts WHERE entity_id='app:blender' AND property='latest_version' AND is_current=1").get().value,canon('6.0.0'));
  assert.equal(db.raw.prepare("SELECT observed_at FROM facts WHERE entity_id='app:blender' AND property='latest_version' AND is_current=1").get().observed_at,NOW-864e5);
  assert.deepEqual(db.raw.prepare('SELECT source_id,http_status FROM snapshots ORDER BY id').all().map(r=>[r.source_id,r.http_status]),[[SOURCE_ID,403],[MIRROR_SOURCE_ID,200],[MIRROR_SOURCE_ID,200],[MIRROR_SOURCE_ID,200]]);
  const versions=db.raw.prepare("SELECT version,source_id,verification FROM versions WHERE entity_id='app:blender' ORDER BY version").all();assert.equal(versions.length,3);assert.equal(versions.find(v=>v.version==='4.5.16').source_id,MIRROR_SOURCE_ID);assert.equal(versions.find(v=>v.version==='4.5.16').verification,'OFFICIAL');
  const news=await publishedNews(db,'en',6,NOW);assert.equal(news.length,1);assert.equal(news[0].source_kind,'tag');assert.match(news[0].title,/Blender 5\.3\.0 — source tag/);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM sources').get().n,2);
  const newer=await run({list:[tag('6.1.0',3)]});assert.equal(newer.error,null);
  await ingest(db,{...newer.doc,snapshots:newer.snapshots},{mode:'collector',actor:'collector:blender-releases',adapter:adapter.id,now:NOW+1000});
  assert.equal(db.raw.prepare("SELECT value FROM facts WHERE entity_id='app:blender' AND property='latest_version' AND is_current=1").get().value,canon('6.1.0'));
  await ingest(db,r.doc,{mode:'collector',actor:'collector:blender-releases',adapter:adapter.id,now:NOW+2000});
  assert.equal(db.raw.prepare("SELECT value FROM facts WHERE entity_id='app:blender' AND property='latest_version' AND is_current=1").get().value,canon('6.1.0'),'a later stale mirror cannot roll back its own prior value');
 }finally{db.raw.close();}
});

test('only_if_newer validation rejects wrong types and non-version properties',async()=>{
 const r=await run();assert.equal(r.error,null);
 for(const flag of ['true',1,null]){const doc=structuredClone(r.doc);doc.entities[0].facts[0].only_if_newer=flag;assert(validateSeed(doc,KNOWN).some(e=>e.includes('only_if_newer')));}
 const doc=structuredClone(r.doc);doc.entities[0].facts[0].p='license';assert(validateSeed(doc,KNOWN).some(e=>e.includes('only_if_newer')));
 const allowed=structuredClone(r.doc);allowed.entities[0].facts[0].only_if_newer=false;assert.deepEqual(validateSeed(allowed,KNOWN),[]);
});

test('monotonic input keeps equal/incomparable versions, re-confirms exact repeats and grants no extra trust',{skip:!sqliteAvailable},async()=>{
 const r=await run();assert.equal(r.error,null);
 const cases=[
  {value:'v6.0.0',flag:true,want:'6.0.0',fresh:false},
  {value:'6.0.0-preview',flag:true,want:'6.0.0',fresh:false},
  {value:'custom',flag:true,want:'6.0.0',fresh:false},
  {value:'6.0.0',flag:true,want:'6.0.0',fresh:true},
  {value:'5.3.0',flag:false,want:'5.3.0',fresh:true},
  {value:'5.3.0',flag:undefined,want:'5.3.0',fresh:true},
  {value:'6.1.0',flag:true,verification:'COMMUNITY',want:'6.0.0',fresh:false},
  {baseline:'custom',value:'5.3.0',flag:true,want:'custom',fresh:false},
 ];
 for(const c of cases){
  const db=D1Shim.migrated();
  try{
   await ingest(db,{schema:'nerulio.seed/1',vertical:'studio',sources:r.doc.sources,entities:[{id:'app:blender',type:'app',slug:'blender',names:{en:'Blender'},facts:[{p:'latest_version',v:c.baseline||'6.0.0',ver:'OFFICIAL',src:SOURCE_ID}]}]},{mode:'collector',actor:'collector:blender-releases',now:NOW-864e5});
   const fact={p:'latest_version',v:c.value,ver:c.verification||'OFFICIAL',src:MIRROR_SOURCE_ID,...(c.flag===undefined?{}:{only_if_newer:c.flag})};
   await ingest(db,{schema:'nerulio.seed/1',vertical:'studio',sources:[],entities:[{id:'app:blender',facts:[fact]}]},{mode:'collector',actor:'collector:blender-releases',now:NOW});
   const current=db.raw.prepare("SELECT value,observed_at FROM facts WHERE property='latest_version' AND is_current=1").get();assert.equal(current.value,canon(c.want),JSON.stringify(c));assert.equal(current.observed_at,c.fresh?NOW:NOW-864e5,JSON.stringify(c));
  }finally{db.raw.close();}
 }
});
