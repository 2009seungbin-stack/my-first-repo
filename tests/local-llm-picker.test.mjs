// The local-LLM fit page's quantization picker column: every value comes from platform/estimates/llm-memory.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {entitiesByIds} from '../platform/db/channel.js';
import {loadLocalLlm,renderLocalLlm,PICK_QUANTS} from '../platform/render/localllm.js';
import {estimateLlmMemory,bestQuantFor,QUANTS,QUANT_ORDER} from '../platform/estimates/llm-memory.js';

test('picker presets are known presets, highest precision first',()=>{
 for(const q of PICK_QUANTS)assert(QUANTS[q],q);
 const at=PICK_QUANTS.map(q=>QUANT_ORDER.indexOf(q));
 assert.deepEqual(at,[...at].sort((a,b)=>a-b));
 assert(PICK_QUANTS.includes('Q4_K_M')&&PICK_QUANTS.includes('Q8_0'),'the two fixed columns are also in the picker');
});

test('each row carries the estimator\'s verdict and range for every preset, and the best preset that fits',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated(),now=Date.parse('2026-11-15T00:00:00Z');
 try{
  await seedDatabase(db,undefined,now);
  const gpu=(await entitiesByIds(db,['gpu:rtx-5070'])).get('gpu:rtx-5070');
  for(const l of ['ko','en']){
   const m=await loadLocalLlm(db,gpu,{l,now});
   assert(m.vram>0&&m.models.length>3);
   const out=String(renderLocalLlm(m,{origin:'https://nerulio.test'}));
   const cells=[...out.matchAll(/<td data-llm-cell data-best="([^"]*)" data-q="([^"]*)" class="(f[ymn])">/g)];
   assert.equal(cells.length,m.models.length,'one picker cell per model');
   // Rows are rendered fitting models first, then the collapsed "does not fit" list: match by content, not by order.
   const want=new Map(m.models.map(x=>[JSON.stringify(Object.fromEntries(PICK_QUANTS.map(q=>{const r=estimateLlmMemory({paramsB:x.paramsB,quant:q,vramGiB:m.vram});return [q,[r.verdict,`${r.gib.total.low.toFixed(1)}–${r.gib.total.high.toFixed(1)}`]];}))),bestQuantFor({paramsB:x.paramsB,vramGiB:m.vram},PICK_QUANTS)]));
   const cls={fits:'fy',tight:'fm',does_not_fit:'fn'};
   for(const [,best,q,c] of cells){
    const json=q.replaceAll('&quot;','"');
    assert(want.has(json),'data-q equals the estimator output');
    const b=want.get(json);
    assert.equal(best,b?b.quant:'');assert.equal(c,b?cls[b.verdict]:'fn');
    if(b)assert(b.verdict!=='does_not_fit','a best preset never is one that does not fit');
   }
   const count={fits:0,tight:0,does_not_fit:0};for(const x of m.models)count[x.best?x.best.verdict:'does_not_fit']++;
   assert(out.includes(l==='ko'?`맞음 ${count.fits}개 · 빠듯함 ${count.tight}개 · 안 맞음 ${count.does_not_fit}개`:`${count.fits} fit · ${count.tight} tight · ${count.does_not_fit} do not fit`));
   assert(out.includes('<select data-llm-quant data-hw-enable disabled')&&PICK_QUANTS.every(q=>out.includes(`<option value="${q}">${q}</option>`)));
   assert(out.includes(l==='ko'?'맞는 프리셋 없음':'No preset fits')||m.models.every(x=>x.best),'a model no preset fits says so');
  }
 }finally{db.raw.close();}
});
