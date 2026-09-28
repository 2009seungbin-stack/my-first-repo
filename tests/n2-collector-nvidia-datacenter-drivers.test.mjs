import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import adapter,{toSeed,compareVersions,RELEASES_URL,SOURCE_ID} from '../collectors/nvidia-datacenter-drivers/index.js';
import {runAdapter,collectorContext} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';

const FIXTURE=readFileSync(new URL('./fixtures/n2/collectors/nvidia-datacenter-drivers/releases.json',import.meta.url),'utf8');
const KNOWN={entities:new Set(['vendor:nvidia'])};
const NOW=Date.UTC(2026,8,28,12);
const fakeFetch=(/** @type {string} */ body,status=200)=>{const calls=[];const f=async(/** @type {string} */ url,/** @type {any} */ init)=>{calls.push({url,init});return new Response(body,{status,headers:{'content-type':'application/json'}});};f.calls=calls;return f;};

test('adapter contract: auto mode, docs.nvidia.com only, polite', ()=>{
 assert.equal(adapter.id,'nvidia-datacenter-drivers');
 assert.equal(adapter.vertical,'hardware');
 assert.equal(adapter.mode,'auto');
 assert.deepEqual(adapter.hosts,['docs.nvidia.com']);
 assert.ok(adapter.minIntervalMs>=1000);
 assert.equal(new URL(RELEASES_URL).hostname,'docs.nvidia.com');
});

test('compareVersions orders dotted numeric versions', ()=>{
 assert.ok(compareVersions('580.178.04','580.65.06')>0);
 assert.ok(compareVersions('595.58.03','595.71.05')<0);
 assert.equal(compareVersions('460.106.00','460.106'),0);
});

test('toSeed maps the recorded fixture to a valid seed document', ()=>{
 const doc=toSeed(JSON.parse(FIXTURE),{retrieved:'2026-09-28'});
 assert.deepEqual(validateSeed(doc,KNOWN),[]);
 assert.deepEqual(doc.entities.map(e=>e.id),['driver:nvidia-dc-r615','driver:nvidia-dc-r595','driver:nvidia-dc-r580','driver:nvidia-dc-r460']);
 const r580=doc.entities[2];
 const fact=(/** @type {any} */ e,/** @type {string} */ p)=>e.facts.find((/** @type {any} */ f)=>f.p===p);
 assert.equal(fact(r580,'latest_version').v,'580.178.04');
 assert.equal(fact(r580,'branch_type').v,'lts');
 assert.equal(fact(r580,'release_date').v,'2025-08-04');
 assert.equal(fact(doc.entities[1],'branch_type').v,'production');
 assert.equal(fact(doc.entities[0],'branch_type').v,'new_feature');
 assert.equal(r580.versions.length,3);
 assert.deepEqual(r580.versions[0],{version:'580.178.04',src:SOURCE_ID,channel:'lts',released:'2026-08-03',notes_url:'https://docs.nvidia.com/datacenter/tesla/tesla-release-notes-580-178-04/index.html'});
 // 460: the oldest listed release has no date → no branch release_date fact, version kept undated.
 const r460=doc.entities[3];
 assert.equal(fact(r460,'release_date'),undefined);
 assert.equal(r460.versions[1].released,undefined);
 // Installer URLs are never stored.
 assert.doesNotMatch(JSON.stringify(doc),/\.run"/);
 for(const e of doc.entities){assert.equal(e.type,'driver');assert.deepEqual(e.relations,[{p:'made_by',o:'vendor:nvidia',src:SOURCE_ID}]);assert.ok(e.description.en&&e.description.ko);}
 assert.equal(doc.sources[0].kind,'FEED');
 assert.equal(doc.sources[0].retrieved,'2026-09-28');
});

test('toSeed skips malformed rows and unknown branch types without inventing values', ()=>{
 const logs=[];
 const doc=toSeed({
  '999':{type:'mystery branch',driver_info:[{release_version:'999.1.2',release_date:'2030-01-01',release_notes:'http://evil.example/x'}]},
  'abc':{type:'lts branch',driver_info:[{release_version:'1.2.3'}]},
  '600':{type:'production branch',driver_info:[{release_version:'not-a-version'},{release_version:'700.1.1'}]},
 },{retrieved:'2026-09-28',log:m=>logs.push(m)});
 assert.equal(doc.entities.length,1);
 const e=doc.entities[0];
 assert.equal(e.facts.find(f=>f.p==='branch_type'),undefined);
 assert.equal(e.versions[0].notes_url,undefined);
 assert.equal(e.versions[0].channel,undefined);
 assert.ok(logs.some(m=>/unknown type/.test(m))&&logs.some(m=>/no valid releases/.test(m)));
 assert.throws(()=>toSeed([],{retrieved:'2026-09-28'}),/expected an object/);
});

test('collect() through the runtime: one request, snapshot recorded, valid output', async()=>{
 const f=fakeFetch(FIXTURE);
 const run=await runAdapter(adapter,{fetch:f,now:()=>NOW});
 assert.equal(run.error,null);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].url,RELEASES_URL);
 assert.equal(run.snapshots.length,1);
 assert.equal(run.snapshots[0].http_status,200);
 assert.deepEqual(run.snapshots[0].excerpt,['615','595','580','460']);
 assert.equal(run.doc.sources[0].retrieved,'2026-09-28');
 assert.deepEqual(validateSeed(run.doc,KNOWN),[]);
});

test('HTTP errors surface as run errors, not partial documents', async()=>{
 const run=await runAdapter(adapter,{fetch:fakeFetch('nope',503),now:()=>NOW});
 assert.equal(run.doc,null);
 assert.match(run.error,/HTTP 503/);
});

test('the runtime refuses hosts outside the allowlist', async()=>{
 const ctx=collectorContext(adapter,{fetch:fakeFetch('{}'),now:()=>NOW});
 await assert.rejects(ctx.get('https://download.nvidia.com/XFree86/Linux-x86_64/latest.txt',{source:'x'}),/not allowlisted/);
});
