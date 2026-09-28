import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{MANUAL_PAGES} from '../collectors/studio-vendor-manual/index.js';
import {runAdapter} from '../collectors/_runtime.js';

test('manual source: no fetching, no hosts, documented pages are https', async()=>{
 assert.equal(adapter.id,'studio-vendor-manual');
 assert.equal(adapter.vertical,'studio');
 assert.equal(adapter.mode,'manual');
 assert.deepEqual(adapter.hosts,[]);
 for(const p of MANUAL_PAGES)assert.equal(new URL(p.url).protocol,'https:');
 const run=await runAdapter(adapter,{fetch:async()=>{throw Error('must not fetch');}});
 assert.equal(run.manual,true);
 assert.equal(run.doc,null);
 assert.equal(run.error,null);
});
