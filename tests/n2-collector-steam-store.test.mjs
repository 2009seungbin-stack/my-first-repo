import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runAdapter} from '../collectors/_runtime.js';
import {createSteamStoreAdapter} from '../collectors/steam-store/index.js';
import {parseLanguages,koreanSupport,parseReleaseDate,parsePlatforms,slugify,cleanName,parseWebsite} from '../collectors/steam-store/parse.js';
import {validateSeed} from '../platform/seed.js';

const FX=new URL('./fixtures/n2/collectors/steam-store/',import.meta.url);
const fx=(/** @type {string} */ n)=>readFileSync(new URL(n,FX),'utf8');
const target=(appid,more={})=>({id:`game:steam-${appid}`,type:'game',vertical:'games',facts:{steam_appid:appid},...more});

/** Recorded-fixture fetch: never the network. `plan` lets a test script throttled responses. */
function fakeFetch(plan={}){
 const calls=[];
 const f=async(url)=>{
  calls.push(url);
  const u=new URL(url),appid=u.searchParams.get('appids'),l=u.searchParams.get('l');
  const scripted=(plan[`${appid}:${l}:${u.searchParams.get('cc')}`]||plan[`${appid}:${l}`])?.shift();
  if(scripted)return new Response(scripted.body,{status:scripted.status,headers:{'content-type':'application/json'}});
  let body;try{body=fx(`${appid}.${l}.json`);}catch{body=JSON.stringify({[appid]:{success:false}});}
  return new Response(body,{status:200,headers:{'content-type':'application/json'}});
 };
 f.calls=calls;return f;
}
let clock=Date.UTC(2026,8,28,12);const now=()=>(clock+=5000);

test('parseLanguages reads the full-audio marker and ignores the footnote',()=>{
 const langs=parseLanguages('English<strong>*</strong>, Korean, Japanese<strong>*</strong><br><strong>*</strong>languages with full audio support');
 assert.deepEqual(langs,[{name:'English',fullAudio:true},{name:'Korean',fullAudio:false},{name:'Japanese',fullAudio:true}]);
 assert.equal(koreanSupport(langs),'interface_subtitles');
 assert.equal(koreanSupport(parseLanguages('English, Korean<strong>*</strong>')),'full_audio');
 assert.equal(koreanSupport(parseLanguages('English<strong>*</strong>, French')),'none');
 assert.equal(koreanSupport(parseLanguages('')),null,'missing field is unknown, not "none"');
 assert.equal(koreanSupport(parseLanguages(undefined)),null);
});

test('parseReleaseDate keeps the precision the store gives and never guesses',()=>{
 assert.equal(parseReleaseDate('Feb 24, 2017'),'2017-02-24');
 assert.equal(parseReleaseDate('24 Feb, 2017'),'2017-02-24');
 assert.equal(parseReleaseDate('Sept 3, 2026'),'2026-09-03');
 assert.equal(parseReleaseDate('October 2026'),'2026-10');
 assert.equal(parseReleaseDate('2027'),'2027');
 for(const s of ['Coming soon','To be announced','Q1 2027','Feb 30, 2017','',null])assert.equal(parseReleaseDate(s),null,String(s));
});

test('small parsers',()=>{
 assert.deepEqual(parsePlatforms({windows:true,mac:false,linux:true}),['windows','linux']);
 assert.equal(slugify('PUBG: BATTLEGROUNDS'),'pubg-battlegrounds');
 assert.equal(slugify("Baldur's Gate 3"),'baldurs-gate-3');
 assert.equal(slugify('Pokémon & Co.'),'pokemon-and-co');
 assert.equal(slugify('이터널 리턴'),'');
 assert.equal(cleanName('ELDEN RING™'),'ELDEN RING');
 assert.equal(parseWebsite('not a url'),null);
 assert.equal(parseWebsite('http://hollowknight.com'),'http://hollowknight.com/');
});

test('collect() turns recorded appdetails into a valid seed document',async()=>{
 const fetch=fakeFetch();
 const adapter=createSteamStoreAdapter({retryDelays:[0]});
 const targets=[target(367520),target(233860),target(1962700,{slug:'subnautica-2'}),target(377160),target(999999999),
  {id:'org:unknown-worlds',type:'org',vertical:'games',slug:'unknown-worlds',names:{en:'Unknown Worlds Entertainment'},aliases:[],facts:{}},
  {id:'game:other',type:'game',vertical:'games',slug:'kenshi',names:{en:'Other'},aliases:[],facts:{}}];
 const run=await runAdapter(adapter,{fetch,now,targets});
 assert.equal(run.error,null);
 const doc=run.doc;
 assert.deepEqual(validateSeed(doc,{entities:new Set(['org:unknown-worlds','game:other'])}),[]);
 assert.equal(fetch.calls.length,10,'english + korean per game; a missing app stops after the English US + KR calls');
 assert.ok(fetch.calls.every(u=>u.startsWith('https://store.steampowered.com/api/appdetails?appids=')));
 const byId=Object.fromEntries(doc.entities.map(e=>[e.id,e]));
 const fact=(id,p)=>byId[id].facts.find(f=>f.p===p)?.v;

 const hk=byId['game:steam-367520'];
 assert.equal(hk.slug,'hollow-knight');assert.deepEqual(hk.names,{en:'Hollow Knight'},'no ko name when the Korean store uses the same name');
 assert.equal(fact(hk.id,'korean_official'),'full_audio');
 assert.equal(fact(hk.id,'release_date'),'2017-02-24');
 assert.deepEqual(fact(hk.id,'platforms'),['windows','macos','linux']);
 assert.ok(fact(hk.id,'official_languages').includes('Korean'));
 assert.deepEqual(hk.relations.map(r=>[r.p,r.o]),[['developed_by','org:team-cherry'],['published_by','org:team-cherry']]);
 assert.ok(hk.facts.every(f=>f.ver==='AUTOMATED'&&f.src==='src:steam-store-app-367520'));

 assert.equal(fact('game:steam-233860','korean_official'),'full_audio','Kenshi lists Korean with full audio (recorded 2026-09-28)');
 assert.equal(fact('game:steam-377160','korean_official'),'none');
 assert.ok(byId['game:steam-377160'].description.en.includes('no official Korean'));
 assert.equal(byId['game:steam-233860'].slug,'kenshi-233860','slug owned by another entity gets the appid suffix');

 const sn=byId['game:steam-1962700'];
 assert.deepEqual(sn.names,{en:'Subnautica 2',ko:'서브노티카 2'});
 assert.equal(sn.slug,'subnautica-2','existing slug is kept');
 assert.equal(fact(sn.id,'korean_official'),'interface_subtitles');
 assert.equal(sn.relations[0].o,'org:unknown-worlds','existing org is matched by name');
 assert.ok(!byId['org:unknown-worlds-entertainment']);
 assert.ok(sn.description.ko.includes('한국어'));

 assert.ok(!byId['game:steam-999999999'],'apps without store data are skipped, not invented');
 const src=doc.sources.find(s=>s.id==='src:steam-store-app-367520');
 assert.equal(src.kind,'OFFICIAL');assert.equal(src.url,'https://store.steampowered.com/app/367520/');assert.equal(src.retrieved,'2026-09-28');
 assert.ok(run.snapshots.every(s=>s.checksum&&s.source.startsWith('src:steam-store-app-')));
 assert.equal(run.snapshots[0].excerpt.name,'Hollow Knight');
});

test('throttled responses are retried, then the game is skipped without failing the run',async()=>{
 const fetch=fakeFetch({'367520:english':[{status:429,body:''},{status:200,body:'null'}],'233860:english':[{status:429,body:''},{status:429,body:''},{status:429,body:''}]});
 const run=await runAdapter(createSteamStoreAdapter({retryDelays:[0,0]}),{fetch,now,targets:[target(367520),target(233860)]});
 assert.equal(run.error,null);
 assert.ok(run.doc.entities.some(e=>e.id==='game:steam-367520'),'recovered after 429 and a null body');
 assert.ok(!run.doc.entities.some(e=>e.id==='game:steam-233860'),'gave up after the retry budget');
 assert.equal(run.doc.stats.failed,1);
});

test('games missing from the US store are read through the KR store',async()=>{
 const fetch=fakeFetch({'1962700:english:us':[{status:200,body:JSON.stringify({1962700:{success:false}})}]});
 const run=await runAdapter(createSteamStoreAdapter({retryDelays:[0]}),{fetch,now,targets:[target(1962700)]});
 assert.equal(run.error,null);
 assert.deepEqual(fetch.calls.map(u=>new URL(u).searchParams.get('cc')),['us','kr','kr']);
 assert.equal(run.doc.entities[0].names.en,'Subnautica 2');
 assert.match(run.doc.sources[0].note,/l=english&cc=kr/);
});

test('a run where nothing can be read reports an error for health tracking',async()=>{
 const fetch=async()=>new Response('',{status:503});
 const run=await runAdapter(createSteamStoreAdapter({retryDelays:[]}),{fetch,now,targets:[target(367520)]});
 assert.match(run.error,/no game could be read/);
});

test('only allowlisted hosts are reachable',async()=>{
 const adapter=createSteamStoreAdapter();
 assert.deepEqual(adapter.hosts,['store.steampowered.com']);
 assert.ok(adapter.minIntervalMs>=1500,'Valve politeness: at least 1.5 s between requests');
});
