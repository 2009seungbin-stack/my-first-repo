import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateLlmMemory,kvCacheBytes,bestQuantFor,QUANTS,QUANT_ORDER,TYPE_BPW,KV_CACHE_BYTES,METHOD,VERDICT_LABELS} from '../platform/estimates/llm-memory.js';
import {SOURCE_KINDS} from '../platform/schema.js';
import {validateSeed} from '../platform/seed.js';

const GIB=1024**3;

test('ggml block sizes give the documented bits per weight', ()=>{
 // Values stated in llama.cpp ggml-common.h comments / derivable from its static_asserts.
 assert.equal(TYPE_BPW.Q8_0,8.5);
 assert.equal(TYPE_BPW.Q6_K,6.5625);
 assert.equal(TYPE_BPW.Q5_K,5.5);
 assert.equal(TYPE_BPW.Q4_K,4.5);
 assert.equal(TYPE_BPW.IQ4_XS,4.25);
 assert.equal(TYPE_BPW.Q3_K,3.4375);
 assert.equal(TYPE_BPW.IQ3_S,3.4375);
 assert.equal(TYPE_BPW.IQ3_XXS,3.0625);
 assert.equal(TYPE_BPW.Q2_K,2.625);
 assert.equal(TYPE_BPW.IQ2_S,2.5625);
 assert.equal(TYPE_BPW.IQ2_XS,2.3125);
 assert.equal(TYPE_BPW.IQ2_XXS,2.0625);
 assert.equal(TYPE_BPW.IQ1_M,1.75);
 assert.equal(TYPE_BPW.IQ1_S,1.5625);
});

test('every preset has low ≤ high, ordered highest precision first', ()=>{
 for(const id of QUANT_ORDER){const q=QUANTS[id];assert.ok(q.bpwLow>0&&q.bpwLow<=q.bpwHigh,id);}
 assert.equal(QUANT_ORDER[0],'F16');
 assert.deepEqual([QUANTS.Q4_K_M.bpwLow,QUANTS.Q4_K_M.bpwHigh],[4.5,4.8944]);
 assert.deepEqual([QUANTS.Q8_0.bpwLow,QUANTS.Q8_0.bpwHigh],[8.5,8.5008]);
});

test('weights high bound reproduces llama.cpp README sizes for Llama-3.1-8B', ()=>{
 // README: Q4_K_M 4.58 GiB, Q8_0 7.95 GiB, F16 14.96 GiB at 8.03 B parameters.
 for(const [quant,gib] of [['Q4_K_M',4.58],['Q8_0',7.95],['F16',14.96],['IQ3_XXS',3.04]]){
  const r=estimateLlmMemory({paramsB:8.03,quant});
  assert.ok(Math.abs(r.gib.weights.high-gib)<=0.02,`${quant}: ${r.gib.weights.high} vs ${gib}`);
 }
});

test('KV cache formula: Llama-3.1-8B config, 8192 tokens, f16 = 1 GiB', ()=>{
 const b=kvCacheBytes({layers:32,kvHeads:8,headDim:128,context:8192});
 assert.equal(b,GIB);
 assert.equal(kvCacheBytes({layers:32,kvHeads:8,headDim:128,context:8192,cacheType:'q8_0'}),GIB*34/32/2);
 assert.equal(kvCacheBytes({layers:32,kvHeads:8,headDim:128,context:8192,sequences:2}),2*GIB);
 assert.equal(kvCacheBytes({layers:32,kvHeads:8,headDim:128,context:8192,cacheType:'q8_0',cacheTypeV:'f16'}),32*8*128*8192*(34/32+2));
 assert.throws(()=>kvCacheBytes({layers:32,kvHeads:8,headDim:128,context:8192,cacheType:'q3_k'}),/unknown cache type/);
 assert.throws(()=>kvCacheBytes({layers:0,kvHeads:8,headDim:128,context:1}),/layers/);
 assert.equal(KV_CACHE_BYTES.f16,2);
});

test('verdicts: fits / tight / does not fit, always labelled ESTIMATE', ()=>{
 const kv={layers:32,kvHeads:8,headDim:128};
 const fit=estimateLlmMemory({paramsB:8.03,quant:'Q4_K_M',vramGiB:12,kv,context:8192});
 assert.equal(fit.label,'ESTIMATE');
 assert.equal(fit.verdict,'fits');
 assert.deepEqual(fit.verdictLabel,VERDICT_LABELS.fits);
 assert.equal(fit.method,METHOD.id);
 // total range: weights 4.21..4.58 + kv 1 + overhead 0.5..(1+5%)
 assert.ok(fit.gib.total.low>5.6&&fit.gib.total.high<6.9,JSON.stringify(fit.gib.total));
 const tight=estimateLlmMemory({paramsB:8.03,quant:'F16',vramGiB:16});
 assert.equal(tight.verdict,'tight');
 const no=estimateLlmMemory({paramsB:70,quant:'Q4_K_M',vramGiB:24});
 assert.equal(no.verdict,'does_not_fit');
 const none=estimateLlmMemory({paramsB:7,quant:'Q4_K_M'});
 assert.equal(none.verdict,null);
 assert.deepEqual(none.assumptions,['kv_cache_not_included']);
 assert.equal(none.gib.kvCache,null);
});

test('input validation', ()=>{
 assert.throws(()=>estimateLlmMemory({paramsB:0,quant:'Q4_K_M'}),/paramsB/);
 assert.throws(()=>estimateLlmMemory({paramsB:7,quant:'Q4_Z'}),/unknown quantization/);
 assert.throws(()=>estimateLlmMemory({paramsB:7,quant:'Q4_K_M',context:4096}),/KV cache needs/);
 assert.throws(()=>estimateLlmMemory({paramsB:7,quant:'Q4_K_M',vramGiB:-1}),/vramGiB/);
 assert.throws(()=>estimateLlmMemory({paramsB:7,quant:'Q4_K_M',vramGiB:8,headroom:1}),/headroom/);
});

test('bestQuantFor picks the highest-precision preset that fits', ()=>{
 const r=bestQuantFor({paramsB:8.03,vramGiB:12});
 assert.equal(r?.quant,'Q8_0');
 const r2=bestQuantFor({paramsB:32,vramGiB:24,kv:{layers:64,kvHeads:8,headDim:128},context:8192});
 assert.ok(r2&&QUANT_ORDER.indexOf(r2.quant)>=QUANT_ORDER.indexOf('Q5_K_M'),r2?.quant);
 assert.equal(bestQuantFor({paramsB:400,vramGiB:8}),null);
});

test('METHOD is a valid ESTIMATE_METHOD source with en+ko text', ()=>{
 assert.equal(METHOD.kind,'ESTIMATE_METHOD');
 assert.ok(SOURCE_KINDS.includes(METHOD.kind));
 assert.ok(METHOD.method.en.length>200&&METHOD.method.ko.length>100);
 assert.match(METHOD.method.en,/not a measurement/);
 assert.match(METHOD.method.ko,/추정치/);
 for(const u of Object.values(METHOD.references))assert.match(u,/^https:\/\/github\.com\/ggml-org\/llama\.cpp\/blob\/[0-9a-f]{40}\//);
 const {id,kind,title,publisher,retrieved,note}=METHOD;
 const doc={schema:'nerulio.seed/1',vertical:'hardware',sources:[{id,kind,title,publisher,retrieved,note}],entities:[]};
 assert.deepEqual(validateSeed(doc),[]);
});
