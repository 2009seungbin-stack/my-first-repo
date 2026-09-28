import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runAdapter} from '../collectors/_runtime.js';
import {createSteamNewsAdapter,updatesFromNews} from '../collectors/steam-news/index.js';
import {versionFromTitle,classify} from '../collectors/steam-news/parse.js';
import {validateSeed} from '../platform/seed.js';

const FX=new URL('./fixtures/n2/collectors/steam-news/',import.meta.url);
const fx=(/** @type {number} */ appid)=>readFileSync(new URL(`${appid}.json`,FX),'utf8');
const items=(/** @type {number} */ appid)=>JSON.parse(fx(appid)).appnews.newsitems;
const target=(appid)=>({id:`game:steam-${appid}`,type:'game',vertical:'games',facts:{steam_appid:appid}});
let clock=Date.UTC(2026,8,28,12);const now=()=>(clock+=5000);

test('versionFromTitle: only versions the title states, never dates',()=>{
 const cases={
  'Patch Version 1.5.12620 Now Live':'1.5.12620',
  'Update notes for v1.5.78.11833':'1.5.78.11833',
  'Update 1.6.4850 released':'1.6.4850',
  '12.4a Hotfix':'12.4a',
  'Kenshi 1.0.65 + FCS 2.14.2 Hotfix':'1.0.65',
  'Terraria 1.4.5.7 - Out Now for PC!':'1.4.5.7',
  'PATCH NOTES 12.4 - SEPTEMBER 17TH, 2026':'12.4',
  'Hotfix #36 Now Live!':'Hotfix #36',
  'Patch #7 Now Live!':'Patch #7',
  'Marvel Rivals Version 20260924 Patch Notes':'20260924',
  '패치 노트 1.2.3':'1.2.3',
  '[09.25] Patch Notes':null,
  '2026.09.28 Update':null,
  'Season 12 The Daily Life of Our Test Subjects':null,
  'Counter-Strike 2 Update':null,
  'Release Note for 2025/12/16':null,
 };
 for(const [t,v] of Object.entries(cases))assert.equal(versionFromTitle(t),v,t);
});

test('classify: developer tag, patch wording, and no future/beta posts',()=>{
 assert.equal(classify({title:'Counter-Strike 2 Update',tags:['patchnotes']}).update,true);
 assert.equal(classify({title:'Patch Notes Version 1.17',tags:[]}).update,true,'untagged but a stated version with patch wording');
 assert.equal(classify({title:'Community Update #33 - Patch 8 Stress Test Now Live'}).update,false);
 assert.equal(classify({title:'Upcoming Patch 1.2 preview'}).update,false);
 assert.equal(classify({title:'Terraria 1.4.5 - the Launch Date Revealed at Last!'}).update,false);
 assert.equal(classify({title:'Map Service Report - Update 43.1'}).update,false);
 assert.equal(classify({title:'9월 25일 업데이트 예정 안내'}).update,false);
 assert.equal(classify({title:'9월 25일 업데이트 안내'}).update,true);
 assert.equal(classify({title:'Kenshi 1.0.67 - Experimental Branch',tags:['patchnotes']}).channel,'beta');
 assert.equal(classify({title:'Full Moon Event & Bundles'}).update,false);
});

test('updatesFromNews on recorded posts',()=>{
 const hk=updatesFromNews(items(367520),{appid:367520,src:'src:x'});
 assert.deepEqual(hk.facts.map(f=>[f.p,f.v]),[['last_update_at','2026-03-27'],['current_build','1.5.12620']]);
 assert.match(hk.facts[0].note,/2026-03-27T\d\d:\d\d:\d\dZ/,'exact timestamp kept in the note');
 assert.equal(hk.versions[0].version,'1.5.12620');assert.equal(hk.versions[0].released,'2026-03-27');
 assert.match(hk.versions[0].notes_url,/^https:\/\//);

 const er=updatesFromNews(items(1245620),{appid:1245620,src:'src:x'});
 assert.deepEqual(er.facts.map(f=>f.v),['2026-08-27','1.17']);
 assert.deepEqual(er.versions.map(v=>v.version).slice(0,2),['1.17','1.16.1']);

 const ke=updatesFromNews(items(233860),{appid:233860,src:'src:x'});
 assert.equal(ke.facts.find(f=>f.p==='current_build').v,'1.0.68');
 assert.ok(!ke.versions.some(v=>v.version==='1.0.67'),'experimental branch posts are not stable versions');
 assert.ok(!ke.versions.some(v=>v.version.startsWith('2.14')),'tool versions after the game version are ignored');

 const bg=updatesFromNews(items(1086940),{appid:1086940,src:'src:x'});
 assert.deepEqual(bg.facts.map(f=>f.v),['2026-03-26','Hotfix #36']);

 const mr=updatesFromNews(items(2767030),{appid:2767030,src:'src:x'});
 assert.equal(mr.facts.find(f=>f.p==='current_build').v,'20260924');

 const pubg=updatesFromNews(items(578080),{appid:578080,src:'src:x'});
 assert.deepEqual(pubg.versions.map(v=>v.version),['43.1']);
 assert.equal(pubg.facts[0].note.includes('Patch Notes - Update 43.1'),true,'the service report is not the update');

 assert.deepEqual(updatesFromNews([],{appid:1,src:'src:x'}),{facts:[],versions:[],updates:0});
});

test('collect() emits partial entity updates that validate against the seed graph',async()=>{
 const calls=[];
 const fetch=async url=>{calls.push(url);const appid=Number(new URL(url).searchParams.get('appid'));
  try{return new Response(fx(appid),{status:200,headers:{'content-type':'application/json'}});}catch{return new Response('{"appnews":{"appid":1,"newsitems":[],"count":0}}',{status:200});}};
 const targets=[367520,1245620,233860,1086940,2767030,578080,111].map(target);
 const run=await runAdapter(createSteamNewsAdapter({retryDelays:[0]}),{fetch,now,targets});
 assert.equal(run.error,null);
 assert.equal(calls.length,7);
 assert.ok(calls.every(u=>u.startsWith('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=')&&u.includes('feeds=steam_community_announcements')));
 assert.deepEqual(validateSeed(run.doc,{entities:new Set(targets.map(t=>t.id))}),[]);
 assert.equal(run.doc.entities.length,6,'a game without update posts gets no entry');
 assert.ok(run.doc.entities.every(e=>e.names===undefined&&e.slug===undefined),'partial updates only');
 const src=run.doc.sources[0];assert.equal(src.kind,'OFFICIAL_API');assert.equal(src.retrieved,'2026-09-28');
});

test('throttling is retried; a run with no readable news reports an error',async()=>{
 let n=0;
 const flaky=async()=>(++n===1?new Response('',{status:429}):new Response(fx(367520),{status:200}));
 const ok=await runAdapter(createSteamNewsAdapter({retryDelays:[0]}),{fetch:flaky,now,targets:[target(367520)]});
 assert.equal(ok.doc.entities[0].facts[0].v,'2026-03-27');
 const bad=await runAdapter(createSteamNewsAdapter({retryDelays:[]}),{fetch:async()=>new Response('',{status:500}),now,targets:[target(367520)]});
 assert.match(bad.error,/no news could be read/);
 assert.deepEqual(createSteamNewsAdapter().hosts,['api.steampowered.com']);
});
