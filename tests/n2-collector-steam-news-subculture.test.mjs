import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import adapter,{parseRss,titleDate,kstDate,mapItems} from '../collectors/steam-news-subculture/index.js';
import {runAdapter} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';

const fx=(/** @type {string} */ id)=>readFileSync(new URL(`./fixtures/n2/collectors/steam-news-subculture/${id}.xml`,import.meta.url),'utf8');
const NOW=Date.parse('2026-09-28T12:00:00Z');
const targets=[
 {id:'work:blue-archive-game',type:'work',vertical:'subculture',names:{en:'Blue Archive',ko:'블루 아카이브'},facts:{steam_appid:3557620}},
 {id:'work:wuthering-waves-game',type:'work',vertical:'subculture',names:{en:'Wuthering Waves'},facts:{steam_appid:3513350}},
 {id:'work:limbus-company-game',type:'work',vertical:'subculture',names:{en:'Limbus Company'},facts:{steam_appid:1973530}},
 {id:'work:no-steam',type:'work',vertical:'subculture',names:{en:'Mobile only'},facts:{}},
];
const known={entities:new Set(targets.map(t=>t.id)),sources:new Set()};

test('RSS parsing decodes CDATA and entities', ()=>{
 const items=parseRss(fx('3513350'));
 assert.equal(items.length,3);
 assert.match(items[0].title,/3\.6 버전/);
 assert.equal(items[0].link.startsWith('https://store.steampowered.com/news/app/3513350/view/'),true);
});

test('dates written in titles are resolved against the post date', ()=>{
 const post=Date.parse('Mon, 28 Sep 2026 09:00:25 +0000');
 assert.equal(titleDate(' 9/29(화) 업데이트 상세 안내',post),'2026-09-29');
 assert.equal(titleDate('2026년 9월 24일 정기 업데이트 안내',post),'2026-09-24');
 assert.equal(titleDate('2026.10.01 (KST) 신규 인격 특정 추출',post),'2026-10-01');
 assert.equal(titleDate('1/6(화) 업데이트 안내',Date.parse('2026-12-28T00:00:00Z')),'2027-01-06');
 assert.equal(titleDate('『명조:워더링 웨이브』 3.6 버전 업데이트 내용',post),null);
 assert.equal(kstDate(Date.parse('Wed, 19 Aug 2026 20:00:31 +0000')),'2026-08-20');
});

test('update posts become events; versions only when a version number is explicit', ()=>{
 const ba=mapItems(targets[0],parseRss(fx('3557620')),'src:steam-news-3557620',NOW);
 assert.equal(ba.versions.length,0);
 assert.equal(ba.events.length,1,'two posts about the same 9/29 update collapse to one event');
 assert.equal(ba.events[0].starts,'2026-09-29');assert.equal(ba.events[0].status,'announced');
 const ww=mapItems(targets[1],parseRss(fx('3513350')),'src:steam-news-3513350',NOW);
 assert.deepEqual(ww.versions.map(v=>[v.version,v.released]),[['3.6','2026-08-20']],'older than 45 days are dropped');
 const lc=mapItems(targets[2],parseRss(fx('1973530')),'src:steam-news-1973530',NOW);
 assert.deepEqual(lc.events.map(e=>e.starts),['2026-09-24'],'issue/hotfix and gacha posts are ignored');
 assert.equal(lc.events[0].status,'ended');
});

test('collect: allowlisted GETs per Steam-linked work, valid seed document', async()=>{
 const calls=[];
 const fetch=async(/** @type {string} */ url)=>{calls.push(url);const id=url.match(/app\/(\d+)\//)[1];return new Response(fx(id),{status:200,headers:{'content-type':'text/xml; charset=UTF-8'}});};
 const run=await runAdapter({...adapter,minIntervalMs:0},{targets,fetch,now:()=>NOW});
 assert.equal(run.error,null);
 assert.deepEqual(calls,[3557620,3513350,1973530].map(a=>`https://store.steampowered.com/feeds/news/app/${a}/?l=koreana`));
 assert.equal(run.snapshots.length,3);
 const doc=run.doc;
 assert.deepEqual(validateSeed(doc,known),[]);
 assert.ok(doc.sources.every(s=>s.kind==='FEED'));
 assert.ok(doc.events.every(e=>e.ver==='AUTOMATED'&&e.kind==='update'));
 const ww=doc.entities.find(e=>e.id==='work:wuthering-waves-game');
 assert.equal(ww.facts[0].p,'current_version');assert.equal(ww.facts[0].v,'3.6');
});

test('HTTP failure is reported, not swallowed', async()=>{
 const fetch=async()=>new Response('nope',{status:503});
 const run=await runAdapter({...adapter,minIntervalMs:0},{targets,fetch,now:()=>NOW});
 assert.match(run.error,/HTTP 503/);
});
