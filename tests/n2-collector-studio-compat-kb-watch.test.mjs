import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import adapter,{TRACKED,toSource,articleUrl,watchSourceId} from '../collectors/studio-compat-kb-watch/index.js';
import {runAdapter,collectorContext} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';
import {seedFiles,loadSeeds} from '../tools/platform/validate-seed.mjs';

const FIXTURE=readFileSync(new URL('./fixtures/n2/collectors/studio-compat-kb-watch/steinberg-38919570456594.json',import.meta.url),'utf8');
const STEIN=TRACKED.find(t=>t.id==='38919570456594');
const NOW=Date.UTC(2026,8,28,12);
/** Same adapter without the politeness delay, so the suite does not sleep (delay is covered by the runtime's own tests). */
const FAST={...adapter,minIntervalMs:0};
/** Serve the Steinberg fixture for its URL and a synthetic article for every other tracked URL. */
const fakeFetch=(fail=new Set())=>{const calls=[];const f=async(/** @type {string} */ url)=>{calls.push(url);
 const t=TRACKED.find(x=>articleUrl(x)===url);
 if(!t||fail.has(t.id))return new Response('{"error":"RecordNotFound"}',{status:404});
 const body=t.id==='38919570456594'?FIXTURE:JSON.stringify({article:{id:Number(t.id),title:`Article ${t.id}`,html_url:`https://${t.host}/hc/${t.locale}/articles/${t.id}-x`,edited_at:'2026-09-01T00:00:00Z',updated_at:'2026-09-02T00:00:00Z',body:'<p>hello</p>'}});
 return new Response(body,{status:200,headers:{'content-type':'application/json'}});};f.calls=calls;return f;};

test('adapter contract: only the tracked Zendesk hosts, polite, auto', ()=>{
 assert.equal(adapter.id,'studio-compat-kb-watch');
 assert.equal(adapter.vertical,'studio');
 assert.equal(adapter.mode,'auto');
 assert.ok(adapter.minIntervalMs>=1000);
 assert.deepEqual([...adapter.hosts].sort(),[...new Set(TRACKED.map(t=>t.host))].sort());
 for(const t of TRACKED)assert.match(articleUrl(t),/^https:\/\/[a-z0-9.-]+\/api\/v2\/help_center\/en-(us|gb)\/articles\/\d+\.json$/);
});

test('every tracked article points at a curated seed source that exists', ()=>{
 const ids=new Set(loadSeeds(seedFiles()).flatMap(s=>(s.doc.sources||[]).map((/** @type {any} */ x)=>x.id)));
 for(const t of TRACKED)for(const c of t.cites)assert.ok(ids.has(c),`${t.host}/${t.id} cites unknown ${c}`);
});

test('toSource records title, edited_at and a body hash — never the body itself', async()=>{
 const s=await toSource(/** @type {any} */(STEIN),JSON.parse(FIXTURE),{retrieved:'2026-09-28'});
 assert.equal(s.id,watchSourceId(/** @type {any} */(STEIN)));
 assert.equal(s.kind,'OFFICIAL_API');
 assert.match(s.url,/^https:\/\/helpcenter\.steinberg\.de\/hc\/en-us\/articles\/38919570456594/);
 assert.match(s.title,/Golden Gate/);
 assert.match(s.note,/^edited_at=2026-09-15T\d\d:\d\d:\d\dZ; body_sha256_16=[0-9a-f]{16}; /);
 assert.doesNotMatch(JSON.stringify(s),/refrain/);
 const again=await toSource(/** @type {any} */(STEIN),JSON.parse(FIXTURE),{retrieved:'2026-09-28'});
 assert.equal(again.note,s.note);
 const changed=JSON.parse(FIXTURE);changed.article.body+='<p>chart added</p>';
 assert.notEqual((await toSource(/** @type {any} */(STEIN),changed,{retrieved:'2026-09-28'})).note,s.note);
 await assert.rejects(toSource(/** @type {any} */(STEIN),{},{retrieved:'2026-09-28'}),/no "article"/);
 await assert.rejects(toSource(/** @type {any} */(STEIN),{article:{id:1}},{retrieved:'2026-09-28'}),/unexpected article id/);
});

test('collect(): one request per tracked article, sources-only valid document', async()=>{
 const f=fakeFetch();
 const run=await runAdapter(FAST,{fetch:f,now:()=>NOW});
 assert.equal(run.error,null);
 assert.equal(f.calls.length,TRACKED.length);
 assert.equal(run.doc.sources.length,TRACKED.length);
 assert.deepEqual(run.doc.entities,[]);
 assert.deepEqual(validateSeed(run.doc),[]);
 assert.equal(run.snapshots.find((/** @type {any} */ s)=>s.url.includes('38919570456594')).excerpt.edited_at,'2026-09-15T07:28:16Z');
});

test('partial failures are tolerated and logged; total failure is an error; host allowlist', async()=>{
 const logs=[];
 const run=await runAdapter(FAST,{fetch:fakeFetch(new Set([TRACKED[0].id])),now:()=>NOW,log:(/** @type {string} */ m)=>logs.push(m)});
 assert.equal(run.error,null);
 assert.equal(run.doc.sources.length,TRACKED.length-1);
 assert.ok(logs.some(m=>/1 of \d+ tracked articles failed/.test(m)));
 const all=await runAdapter(FAST,{fetch:fakeFetch(new Set(TRACKED.map(t=>t.id))),now:()=>NOW});
 assert.match(all.error,/all \d+ tracked articles failed/);
 const ctx=collectorContext(adapter,{fetch:fakeFetch(),now:()=>NOW});
 await assert.rejects(ctx.get('https://www.native-instruments.com/',{source:'x'}),/not allowlisted/);
});
