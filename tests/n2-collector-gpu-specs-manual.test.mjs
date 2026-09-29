import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{OFFICIAL_SPEC_SOURCES} from '../collectors/gpu-specs-manual/index.js';
import {runAdapter} from '../collectors/_runtime.js';

test('gpu-specs-manual is a MANUAL_SOURCE that never fetches', async()=>{
 assert.equal(adapter.id,'gpu-specs-manual');
 assert.equal(adapter.vertical,'hardware');
 assert.equal(adapter.mode,'manual');
 assert.deepEqual(adapter.hosts,[]);
 let fetched=0;
 const run=await runAdapter(adapter,{fetch:async()=>{fetched++;return new Response('');}});
 assert.equal(run.manual,true);
 assert.equal(run.doc,null);
 assert.equal(run.error,null);
 assert.equal(fetched,0);
 await assert.rejects(adapter.collect(),/MANUAL_SOURCE/);
});

test('documented official spec sources are https vendor pages', ()=>{
 assert.ok(OFFICIAL_SPEC_SOURCES.length>=6);
 for(const s of OFFICIAL_SPEC_SOURCES){
  const u=new URL(s.url);
  assert.equal(u.protocol,'https:');
  assert.match(u.hostname,/(^|\.)(nvidia|amd|intel)\.com$/);
 }
});
