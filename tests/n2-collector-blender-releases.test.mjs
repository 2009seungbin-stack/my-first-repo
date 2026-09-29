import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import adapter,{toSeed,compareVersions,TAGS_URL,SOURCE_ID,MAX_VERSIONS} from '../collectors/blender-releases/index.js';
import {runAdapter,collectorContext} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';

const FIXTURE=readFileSync(new URL('./fixtures/n2/collectors/blender-releases/tags.json',import.meta.url),'utf8');
const KNOWN={entities:new Set(['app:blender'])};
const NOW=Date.UTC(2026,8,28,12);
const fakeFetch=(/** @type {string} */ body,status=200)=>{const calls=[];const f=async(/** @type {string} */ url)=>{calls.push(url);return new Response(body,{status,headers:{'content-type':'application/json'}});};f.calls=calls;return f;};

test('adapter contract', ()=>{
 assert.equal(adapter.id,'blender-releases');
 assert.equal(adapter.vertical,'studio');
 assert.equal(adapter.mode,'auto');
 assert.deepEqual(adapter.hosts,['projects.blender.org']);
 assert.equal(new URL(TAGS_URL).hostname,'projects.blender.org');
 assert.ok(adapter.minIntervalMs>=1000);
});

test('toSeed: highest vX.Y.Z tag is latest; LTS tags kept; dates from tag commits', ()=>{
 const doc=toSeed(JSON.parse(FIXTURE),{retrieved:'2026-09-28'});
 assert.deepEqual(validateSeed(doc,KNOWN),[]);
 const e=doc.entities[0];
 assert.equal(e.id,'app:blender');
 assert.equal(e.facts[0].v,'5.2.2');
 assert.equal(e.facts[0].ver,'OFFICIAL');
 assert.equal(e.versions[0].version,'5.2.2');
 assert.equal(e.versions[0].released,'2026-09-14');
 assert.ok(e.versions.some(v=>v.version==='4.5.14'));
 assert.ok(e.versions.length<=MAX_VERSIONS);
 for(let i=1;i<e.versions.length;i++)assert.ok(compareVersions(e.versions[i-1].version,e.versions[i].version)>0);
 assert.equal(doc.sources[0].id,SOURCE_ID);
});

test('toSeed skips non-release tags and duplicates; rejects non-arrays', ()=>{
 const logs=[];
 const doc=toSeed([{name:'v5.3.0-alpha'},{name:'blender-v4.5-release'},{name:'v5.0.0',commit:{created:'garbage'}},{name:'v5.0.0'}],{retrieved:'2026-09-28',log:m=>logs.push(m)});
 assert.deepEqual(doc.entities[0].versions,[{version:'5.0.0',channel:'stable',notes_url:'https://projects.blender.org/blender/blender/releases/tag/v5.0.0',src:SOURCE_ID}]);
 assert.equal(logs.length,2);
 const none=toSeed([],{retrieved:'2026-09-28'});
 assert.deepEqual(none.entities[0].facts,[]);
 assert.throws(()=>toSeed({},{retrieved:'2026-09-28'}),/expected a JSON array/);
});

test('collect() via runtime: single request, snapshot excerpt, valid doc; errors surface', async()=>{
 const f=fakeFetch(FIXTURE);
 const run=await runAdapter(adapter,{fetch:f,now:()=>NOW});
 assert.equal(run.error,null);
 assert.deepEqual(f.calls,[TAGS_URL]);
 assert.deepEqual(run.snapshots[0].excerpt.slice(0,2),['v5.2.2','v4.5.14']);
 assert.deepEqual(validateSeed(run.doc,KNOWN),[]);
 const bad=await runAdapter(adapter,{fetch:fakeFetch('x',500),now:()=>NOW});
 assert.match(bad.error,/HTTP 500/);
 const ctx=collectorContext(adapter,{fetch:fakeFetch('[]'),now:()=>NOW});
 await assert.rejects(ctx.get('https://download.blender.org/release/',{source:'x'}),/not allowlisted/);
});
