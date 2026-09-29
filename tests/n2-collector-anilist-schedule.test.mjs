import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import adapter,{fuzzyDate,jstTime,toSeed,QUERY} from '../collectors/anilist-schedule/index.js';
import {runAdapter} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';

const FIX=new URL('./fixtures/n2/collectors/anilist-schedule/media-2026-09-28.json',import.meta.url);
const body=readFileSync(FIX,'utf8');
const NOW=Date.parse('2026-09-28T12:00:00Z');
const targets=[
 {id:'work:the-apothecary-diaries-tv-s3',type:'work',vertical:'subculture',names:{en:'The Apothecary Diaries Season 3',ko:'약사의 혼잣말 3기'},facts:{anilist_id:195516}},
 {id:'work:bleach-tybw-calamity',type:'work',vertical:'subculture',names:{en:'Bleach: Thousand-Year Blood War – The Calamity'},facts:{anilist_id:185874}},
 {id:'work:one-piece-tv',type:'work',vertical:'subculture',names:{en:'One Piece'},facts:{anilist_id:21}},
 {id:'work:the-apothecary-diaries-film-2026',type:'work',vertical:'subculture',names:{en:'The Apothecary Diaries the Movie'},facts:{anilist_id:200929}},
 {id:'work:no-anilist',type:'work',vertical:'subculture',names:{en:'Untracked'},facts:{}},
 {id:'franchise:x',type:'franchise',vertical:'subculture',names:{en:'X'},facts:{anilist_id:1}},
];
const known={entities:new Set(targets.map(t=>t.id)),sources:new Set()};

/** Fake fetch that records requests and answers from the fixture. */
function fakeFetch(){
 const calls=[];
 const f=async(url,init)=>{calls.push({url,init});return new Response(body,{status:200,headers:{'content-type':'application/json','x-ratelimit-remaining':'29'}});};
 return {f,calls};
}

test('helpers: partial dates and JST times', ()=>{
 assert.equal(fuzzyDate({year:2026,month:10,day:2}),'2026-10-02');
 assert.equal(fuzzyDate({year:2027,month:1,day:null}),'2027-01');
 assert.equal(fuzzyDate({year:2027,month:null,day:null}),'2027');
 assert.equal(fuzzyDate({year:null,month:null,day:null}),null);
 assert.equal(jstTime(1790949600),'2026-10-02T23:00+09:00');
});

test('collect posts one batched query for tracked works only and returns a valid seed doc', async()=>{
 const {f,calls}=fakeFetch();
 const run=await runAdapter({...adapter,_fetch:f},{targets,now:()=>NOW});
 assert.equal(run.error,null);
 assert.equal(calls.length,1);
 assert.equal(calls[0].init.method,'POST');
 assert.equal(calls[0].url,'https://graphql.anilist.co/');
 const sent=JSON.parse(calls[0].init.body);
 assert.equal(sent.query,QUERY);
 assert.deepEqual(sent.variables.ids.sort((a,b)=>a-b),[21,185874,195516,200929]);
 assert.equal(run.snapshots.length,1);
 assert.equal(run.snapshots[0].http_status,200);
 assert.match(run.snapshots[0].checksum,/^[0-9a-f]{64}$/);
 const doc=run.doc;
 assert.deepEqual(validateSeed(doc,known),[]);
 // Honest labelling: third-party community database.
 assert.equal(doc.sources[0].kind,'FEED');
 assert.match(doc.sources[0].note,/[Tt]hird-party/);
 for(const e of doc.entities)for(const x of e.facts)assert.equal(x.ver,'COMMUNITY');
 for(const ev of doc.events)assert.equal(ev.ver,'COMMUNITY');
 const s3=doc.entities.find(e=>e.id==='work:the-apothecary-diaries-tv-s3');
 assert.deepEqual(s3.facts.find(x=>x.p==='airing_status').v,'upcoming');
 assert.deepEqual(s3.facts.find(x=>x.p==='release_date').v,'2026-10-02');
 const ev=doc.events.find(e=>e.entities[0]==='work:the-apothecary-diaries-tv-s3');
 assert.equal(ev.kind,'broadcast');assert.equal(ev.date_precision,'time');
 assert.equal(ev.starts,'2026-10-02T23:00+09:00');
 assert.equal(ev.title.ko,'약사의 혼잣말 3기 1화');
 const bleach=doc.entities.find(e=>e.id==='work:bleach-tybw-calamity');
 assert.equal(bleach.facts.find(x=>x.p==='episodes').v,10);
 assert.equal(bleach.facts.find(x=>x.p==='end_date'),undefined,'end_date only once finished');
 const film=doc.events.find(e=>e.entities[0]==='work:the-apothecary-diaries-film-2026');
 assert.equal(film.kind,'release');assert.equal(film.title.en,'The Apothecary Diaries the Movie — release');
});

test('no tracked works → no request', async()=>{
 const {f,calls}=fakeFetch();
 const run=await runAdapter({...adapter,_fetch:f},{targets:[targets.find(t=>t.id==='work:no-anilist')],now:()=>NOW});
 assert.equal(run.error,null);assert.equal(calls.length,0);
 assert.deepEqual(run.doc.entities,[]);
});

test('GraphQL errors and HTTP errors surface as run errors', async()=>{
 const err=async()=>new Response(JSON.stringify({data:null,errors:[{message:'Too Many Requests.',status:429}]}),{status:429});
 const run=await runAdapter({...adapter,_fetch:err},{targets,now:()=>NOW});
 assert.match(run.error,/HTTP 429/);
});

test('host allowlist is enforced by the POST helper', async()=>{
 const {f}=fakeFetch();
 const evil={...adapter,_fetch:f,hosts:['example.org']};
 const run=await runAdapter(evil,{targets,now:()=>NOW});
 assert.match(run.error,/not allowlisted/);
});

test('past next-episode times are not emitted as upcoming events', ()=>{
 const media=JSON.parse(body).data.Page.media;
 const doc=toSeed(media,new Map([[195516,targets[0]]]),'2026-12-01',Date.parse('2026-12-01'));
 assert.equal(doc.events.length,0);
});

test('release dates use the seed convention: JST calendar date of the first airing, in the seeded scope', async()=>{
 const {jstDate,seededRegion}=await import('../collectors/anilist-schedule/index.js');
 // Tokyo Revengers: "2026年10月2日から毎週金曜深夜1:23" = Saturday 3 October 01:23 JST (16:23 UTC on the 2nd).
 assert.equal(jstDate(Date.parse('2026-10-02T16:23:00Z')/1000),'2026-10-03');
 assert.equal(jstDate(Date.parse('2026-10-03T15:55:00Z')/1000),'2026-10-04');   // Ranma: 土曜24:55
 assert.equal(seededRegion({factRegions:{release_date:['*']}},'release_date'),undefined);
 assert.equal(seededRegion({factRegions:{release_date:['JP','KR']}},'release_date'),'JP');
 assert.equal(seededRegion({factRegions:{release_date:['GLOBAL','KR']}},'release_date'),'GLOBAL');
 assert.equal(seededRegion({factRegions:{}},'release_date'),undefined);
 const media=[{id:178083,format:'TV',status:'NOT_YET_RELEASED',episodes:null,startDate:{year:2026,month:10,day:2},endDate:{},nextAiringEpisode:{episode:1,airingAt:Date.parse('2026-10-02T16:53:00Z')/1000},siteUrl:'https://anilist.co/anime/178083'},
  {id:151807,format:'TV',status:'FINISHED',episodes:12,startDate:{year:2024,month:1,day:7},endDate:{year:2024,month:3,day:31},nextAiringEpisode:null,siteUrl:'https://anilist.co/anime/151807'}];
 const by=new Map([[178083,{id:'work:tokyo-revengers-santen-sensou',names:{en:'Tokyo Revengers'},factRegions:{release_date:['*']}}],[151807,{id:'work:solo-leveling-tv-s1',names:{en:'Solo Leveling'},factRegions:{release_date:['JP']}}]]);
 const doc=toSeed(media,by,'2026-09-29',NOW);
 const tr=doc.entities.find(e=>e.id==='work:tokyo-revengers-santen-sensou').facts.find(x=>x.p==='release_date');
 assert.deepEqual([tr.v,tr.region],['2026-10-03',undefined],"episode 1's airingAt decides, not a startDate typed in by hand");
 const sl=doc.entities.find(e=>e.id==='work:solo-leveling-tv-s1').facts;
 assert.deepEqual(sl.filter(x=>x.p.endsWith('_date')).map(x=>[x.p,x.v,x.region]),[['release_date','2024-01-07','JP'],['end_date','2024-03-31','JP']],'written into the scope the seed uses');
});
