import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import adapter,{toSeed,parseHeadings,FEED_URL,SOURCE_ID} from '../collectors/reaper-whatsnew/index.js';
import {runAdapter,collectorContext} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';

const FIXTURE=readFileSync(new URL('./fixtures/n2/collectors/reaper-whatsnew/whatsnew-head.txt',import.meta.url),'utf8');
const KNOWN={entities:new Set(['app:reaper'])};
const NOW=Date.UTC(2026,8,28,12);
const fakeFetch=(/** @type {string} */ body,status=200)=>{const calls=[];const f=async(/** @type {string} */ url)=>{calls.push(url);return new Response(body,{status,headers:{'content-type':'text/plain'}});};f.calls=calls;return f;};

test('adapter contract', ()=>{
 assert.equal(adapter.id,'reaper-whatsnew');
 assert.equal(adapter.vertical,'studio');
 assert.equal(adapter.mode,'auto');
 assert.deepEqual(adapter.hosts,['www.reaper.fm']);
 assert.equal(new URL(FEED_URL).hostname,'www.reaper.fm');
});

test('parseHeadings reads "vX.YY - Month D YYYY" headings only', ()=>{
 const h=parseHeadings(FIXTURE);
 assert.deepEqual(h[0],{version:'7.80',released:'2026-09-13'});
 assert.deepEqual(h[1],{version:'7.79',released:'2026-08-17'});
 assert.equal(h.length,4);
 const logs=[];
 assert.deepEqual(parseHeadings('v7.99 - Smarch 1 2026\n  + v8.00 - January 1 2027 mentioned in a bullet\nv8.00 - January 5, 2027\nvolume fix\n',m=>logs.push(m)),[{version:'8.00',released:'2027-01-05'}]);
 assert.equal(logs.length,1);
 assert.deepEqual(parseHeadings('v7.32 - Feburary 1 2025\nv0.948 - Apr 24 2006\n'),[{version:'7.32',released:'2025-02-01'},{version:'0.948',released:'2006-04-24'}]);
});

test('toSeed produces latest_version + dated versions; empty feed is an error', ()=>{
 const doc=toSeed(FIXTURE,{retrieved:'2026-09-28'});
 assert.deepEqual(validateSeed(doc,KNOWN),[]);
 const e=doc.entities[0];
 assert.equal(e.id,'app:reaper');
 assert.equal(e.facts[0].v,'7.80');
 assert.equal(e.facts[0].ver,'OFFICIAL',"Cockos's own release record: a newer release replaces a stale seeded version");
 assert.equal(e.versions.length,4);
 assert.ok(e.versions.every(v=>v.src===SOURCE_ID&&/^\d{4}-\d\d-\d\d$/.test(v.released)));
 assert.equal(doc.sources[0].kind,'FEED');
 assert.throws(()=>toSeed('<html>moved</html>',{retrieved:'2026-09-28'}),/no version headings/);
});

test('collect() via runtime; HTTP errors surface; host allowlist enforced', async()=>{
 const f=fakeFetch(FIXTURE);
 const run=await runAdapter(adapter,{fetch:f,now:()=>NOW});
 assert.equal(run.error,null);
 assert.deepEqual(f.calls,[FEED_URL]);
 assert.equal(run.snapshots[0].excerpt[0].version,'7.80');
 assert.deepEqual(validateSeed(run.doc,KNOWN),[]);
 const bad=await runAdapter(adapter,{fetch:fakeFetch('',404),now:()=>NOW});
 assert.match(bad.error,/HTTP 404/);
 const ctx=collectorContext(adapter,{fetch:fakeFetch(''),now:()=>NOW});
 await assert.rejects(ctx.get('https://forum.cockos.com/',{source:'x'}),/not allowlisted/);
});
