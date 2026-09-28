import test from 'node:test';
import assert from 'node:assert/strict';
import {runAdapter} from '../collectors/_runtime.js';
import collabs from '../collectors/subculture-kr-collabs/index.js';
import news from '../collectors/subculture-official-news/index.js';
import figures from '../collectors/subculture-figure-preorders/index.js';

for(const a of [collabs,news,figures]){
 test(`${a.id}: manual adapter never fetches and documents its workflow`, async()=>{
  assert.equal(a.mode,'manual');assert.equal(a.vertical,'subculture');
  assert.deepEqual(a.hosts,[]);
  assert.ok(a.channels.length>0&&a.workflow.length>0);
  let fetched=false;
  const run=await runAdapter(a,{fetch:async()=>{fetched=true;return new Response('');}});
  assert.equal(run.manual,true);assert.equal(run.doc,null);assert.equal(run.error,null);assert.equal(fetched,false);
 });
}
