// @ts-check
/** "Does an open-weight LLM fit in this GPU's VRAM?" — a documented, pure ESTIMATE.
 *
 * Nerulio labels every output of this module ESTIMATE (never OFFICIAL/COMMUNITY). It estimates
 * memory only; it never estimates speed (tokens/s) — speed comes only from community benchmarks.
 *
 * Method (also exported as METHOD for use as an ESTIMATE_METHOD source note):
 *  1. Weights  = total parameters × bits-per-weight ÷ 8.
 *     Bits-per-weight is a RANGE per quantization preset:
 *       low  = bpw of the preset's default tensor type — block layout in ggml/src/ggml-common.h
 *              (`static_assert(sizeof(block_…))`), default type from llama_ftype_get_default_type()
 *              in src/llama-quant.cpp;
 *       high = whole-file bits/weight that llama.cpp measured for the same preset on
 *              Llama-3.1-8B (tools/quantize/README.md). Mixed presets keep some tensors (token
 *              embeddings, output, parts of attention/FFN) at higher precision; that share is
 *              largest in small models, so the 8B figure is a practical upper bound.
 *     MoE models: all experts stay resident, so use the TOTAL parameter count.
 *  2. KV cache (only when the model config is given) =
 *       2 (K and V) × layers × KV heads × head dim × context tokens × parallel sequences
 *       × bytes per element of the cache type (f16/bf16 = 2, q8_0 = 34/32, q4_0 = 18/32, …, same
 *       block sizes as above; llama.cpp default cache type is f16).
 *     This is the full-attention formula; for sliding-window, hybrid or MLA models it over-states the
 *     cache (treat it as an upper bound).
 *  3. Runtime overhead (Nerulio assumption, not measured): 0.5–1.0 GiB fixed (driver/runtime
 *     context, compute buffers) + 0–5 % of the weights (scratch/alignment).
 *  4. Verdict against the card's VRAM (binary GiB, as GPU memory capacities are specified):
 *       does_not_fit  low total  > VRAM
 *       tight         high total > VRAM × (1 − headroom)   (default headroom 10 % for display/OS/driver)
 *       fits          otherwise.
 */

export const METHOD_VERSION='1';
const GIB=1024**3;
const LLAMA_CPP_COMMIT='03a667aa304f2a8e02a9a02b2e3fb45d64bcae7f';
export const REFERENCES=Object.freeze({
 quantizeReadme:`https://github.com/ggml-org/llama.cpp/blob/${LLAMA_CPP_COMMIT}/tools/quantize/README.md`,
 blockLayouts:`https://github.com/ggml-org/llama.cpp/blob/${LLAMA_CPP_COMMIT}/ggml/src/ggml-common.h`,
 defaultTypes:`https://github.com/ggml-org/llama.cpp/blob/${LLAMA_CPP_COMMIT}/src/llama-quant.cpp`,
 cacheTypes:`https://github.com/ggml-org/llama.cpp/blob/${LLAMA_CPP_COMMIT}/tools/server/README.md`,
});

/** @typedef {{id:string,label:string,defaultType:string,bpwLow:number,bpwHigh:number}} QuantPreset */

/** Bits per weight of ggml tensor types = sizeof(block) × 8 ÷ weights per block (ggml-common.h). */
export const TYPE_BPW=Object.freeze({
 F32:32,F16:16,BF16:16,
 Q8_0:(2+32)*8/32,            // 8.5
 Q6_K:(128+64+16+2)*8/256,    // 6.5625
 Q5_K:(4+12+128+32)*8/256,    // 5.5
 Q5_0:(2+4+16)*8/32,          // 5.5
 Q4_K:(4+12+128)*8/256,       // 4.5
 Q4_0:(2+16)*8/32,            // 4.5
 IQ4_NL:(2+16)*8/32,          // 4.5
 IQ4_XS:(2+2+4+128)*8/256,    // 4.25
 Q3_K:(2+64+32+12)*8/256,     // 3.4375
 IQ3_S:(2+64+8+32+4)*8/256,   // 3.4375
 IQ3_XXS:(2+96)*8/256,        // 3.0625
 Q2_K:(4+16+64)*8/256,        // 2.625
 IQ2_S:(2+64+16)*8/256,       // 2.5625
 IQ2_XS:(2+64+8)*8/256,       // 2.3125
 IQ2_XXS:(2+64)*8/256,        // 2.0625
 IQ1_M:(32+16+8)*8/256,       // 1.75
 IQ1_S:(2+32+16)*8/256,       // 1.5625
});

/** [id, default tensor type, llama.cpp-measured bits/weight on Llama-3.1-8B]
 * BF16 is not in the README table; it reuses the F16 row (both are 2-byte elements). */
const PRESET_ROWS=/** @type {const} */([
 ['F16','F16',16.0005],['BF16','BF16',16.0005],
 ['Q8_0','Q8_0',8.5008],['Q6_K','Q6_K',6.5633],
 ['Q5_K_M','Q5_K',5.7036],['Q5_K_S','Q5_K',5.5704],
 ['Q4_K_M','Q4_K',4.8944],['Q4_K_S','Q4_K',4.6672],
 ['IQ4_NL','IQ4_NL',4.6818],['IQ4_XS','IQ4_XS',4.4597],
 ['Q3_K_L','Q3_K',4.2979],['Q3_K_M','Q3_K',3.9960],['Q3_K_S','Q3_K',3.6429],
 ['IQ3_M','IQ3_S',3.7628],['IQ3_S','IQ3_S',3.6606],['IQ3_XS','IQ3_S',3.4977],['IQ3_XXS','IQ3_XXS',3.2548],
 ['Q2_K','Q2_K',3.1593],['Q2_K_S','Q2_K',2.9697],
 ['IQ2_M','IQ2_S',2.9294],['IQ2_S','IQ2_XS',2.7403],['IQ2_XS','IQ2_XS',2.5882],['IQ2_XXS','IQ2_XXS',2.3824],
 ['IQ1_M','IQ1_M',2.1460],['IQ1_S','IQ1_S',2.0042],
]);
/** Quantization presets, highest precision first. @type {Readonly<Record<string,QuantPreset>>} */
export const QUANTS=Object.freeze(Object.fromEntries(PRESET_ROWS.map(([id,type,measured])=>{
 const block=TYPE_BPW[/** @type {keyof typeof TYPE_BPW} */(type)];
 return [id,Object.freeze({id,label:id,defaultType:type,bpwLow:Math.min(block,measured),bpwHigh:Math.max(block,measured)})];
})));
export const QUANT_ORDER=Object.freeze(PRESET_ROWS.map(r=>r[0]));

/** KV-cache element sizes in bytes (llama.cpp --cache-type-k/-v values; block sizes from ggml-common.h). */
export const KV_CACHE_BYTES=Object.freeze({f32:4,f16:2,bf16:2,q8_0:34/32,q5_1:24/32,q5_0:22/32,q4_1:20/32,q4_0:18/32,iq4_nl:18/32});

export const OVERHEAD=Object.freeze({fixedGiBLow:0.5,fixedGiBHigh:1.0,weightsFractionLow:0,weightsFractionHigh:0.05});
export const DEFAULT_HEADROOM=0.10;

const METHOD_EN='Estimate, not a measurement. Weights = total parameters × bits-per-weight ÷ 8, using a bits-per-weight range per quantization: low = the block size of the preset\'s default ggml tensor type (llama.cpp ggml-common.h, llama-quant.cpp), high = the whole-file bits/weight llama.cpp measured for that preset on Llama-3.1-8B (tools/quantize/README.md). MoE models count all parameters. KV cache (when the model config is known) = 2 × layers × KV heads × head dimension × context × sequences × bytes per cache element (f16 = 2 bytes by default); for sliding-window, hybrid or MLA attention this is an upper bound. Runtime overhead is a Nerulio assumption: 0.5–1.0 GiB plus 0–5 % of the weights. Verdict: "does not fit" when even the low total exceeds VRAM, "tight" when the high total exceeds 90 % of VRAM, otherwise "fits". Speed is not estimated.';
const METHOD_KO='측정값이 아닌 추정치입니다. 가중치 메모리 = 전체 파라미터 수 × 가중치당 비트 ÷ 8이며, 양자화 방식마다 비트 범위를 씁니다: 하한은 해당 프리셋 기본 ggml 텐서 형식의 블록 크기(llama.cpp ggml-common.h, llama-quant.cpp), 상한은 llama.cpp가 Llama-3.1-8B에서 측정한 파일 전체 평균 bits/weight(tools/quantize/README.md)입니다. MoE 모델은 전체 파라미터를 셉니다. KV 캐시(모델 설정값이 있을 때) = 2 × 레이어 수 × KV 헤드 수 × 헤드 차원 × 컨텍스트 길이 × 시퀀스 수 × 캐시 원소당 바이트(기본 f16 = 2바이트)이며, 슬라이딩 윈도·하이브리드·MLA 어텐션 모델에서는 상한값입니다. 런타임 오버헤드는 Nerulio의 가정값으로 0.5–1.0GiB에 가중치의 0–5%를 더합니다. 판정: 하한 합계도 VRAM을 넘으면 "안 맞음", 상한 합계가 VRAM의 90%를 넘으면 "빠듯함", 그 외에는 "맞음". 속도는 추정하지 않습니다.';

/** Source record for seed data / renderers (kind ESTIMATE_METHOD; `note` holds the method text). */
export const METHOD=Object.freeze({
 id:'src:estimate-llm-vram-fit-v1',
 kind:'ESTIMATE_METHOD',
 title:'Nerulio LLM VRAM fit estimate (method v1)',
 publisher:'Nerulio',
 retrieved:'2026-09-28',
 note:METHOD_EN,
 method:Object.freeze({en:METHOD_EN,ko:METHOD_KO}),
 version:METHOD_VERSION,
 references:REFERENCES,
});

export const VERDICT_LABELS=Object.freeze({
 fits:Object.freeze({en:'Fits (estimate)',ko:'들어감 (추정)'}),
 tight:Object.freeze({en:'Tight (estimate)',ko:'빠듯함 (추정)'}),
 does_not_fit:Object.freeze({en:'Does not fit (estimate)',ko:'안 들어감 (추정)'}),
});

/**
 * @typedef {{layers:number,kvHeads:number,headDim:number}} KvConfig
 * @typedef {{
 *  paramsB:number,              // total parameters in billions (MoE: all experts)
 *  quant:string,                // key of QUANTS
 *  vramGiB?:number,             // the card's memory; omit to get only the memory estimate
 *  context?:number,             // tokens held in the KV cache
 *  kv?:KvConfig,                // model config (num_hidden_layers, num_key_value_heads, head_dim)
 *  cacheType?:string,           // key of KV_CACHE_BYTES (default f16); cacheTypeV defaults to cacheType
 *  cacheTypeV?:string,
 *  sequences?:number,           // parallel sequences (default 1)
 *  headroom?:number             // fraction of VRAM kept free (default 0.10)
 * }} EstimateInput
 * @typedef {{low:number,high:number}} Range
 */

const posNum=(/** @type {unknown} */ x)=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const posInt=(/** @type {unknown} */ x)=>posNum(x)&&Number.isInteger(x);
const round2=(/** @type {number} */ x)=>Math.round(x*100)/100;

/** KV cache bytes for one configuration (exact formula, no range). */
export function kvCacheBytes(/** @type {{layers:number,kvHeads:number,headDim:number,context:number,cacheType?:string,cacheTypeV?:string,sequences?:number}} */ c){
 for(const k of /** @type {const} */(['layers','kvHeads','headDim','context']))if(!posInt(c[k]))throw RangeError(`${k} must be a positive integer`);
 const seq=c.sequences??1;if(!posInt(seq))throw RangeError('sequences must be a positive integer');
 const tk=c.cacheType??'f16',tv=c.cacheTypeV??tk;
 const bk=KV_CACHE_BYTES[/** @type {keyof typeof KV_CACHE_BYTES} */(tk)],bv=KV_CACHE_BYTES[/** @type {keyof typeof KV_CACHE_BYTES} */(tv)];
 if(bk===undefined||bv===undefined)throw RangeError(`unknown cache type ${bk===undefined?tk:tv}`);
 return c.layers*c.kvHeads*c.headDim*c.context*seq*(bk+bv);
}

/**
 * Estimate memory for one model × quantization (× GPU).
 * @param {EstimateInput} input
 */
export function estimateLlmMemory(input){
 if(!posNum(input?.paramsB))throw RangeError('paramsB must be a positive number (billions)');
 const q=QUANTS[input.quant];if(!q)throw RangeError(`unknown quantization ${input.quant}`);
 const params=input.paramsB*1e9;
 /** @type {Range} */const weights={low:params*q.bpwLow/8,high:params*q.bpwHigh/8};
 /** @type {Range|null} */let kv=null;
 if(input.kv||input.context!==undefined){
  if(!input.kv||input.context===undefined)throw RangeError('KV cache needs both kv {layers,kvHeads,headDim} and context');
  const b=kvCacheBytes({...input.kv,context:input.context,cacheType:input.cacheType,cacheTypeV:input.cacheTypeV,sequences:input.sequences});
  kv={low:b,high:b};
 }
 /** @type {Range} */const overhead={low:OVERHEAD.fixedGiBLow*GIB+weights.low*OVERHEAD.weightsFractionLow,high:OVERHEAD.fixedGiBHigh*GIB+weights.high*OVERHEAD.weightsFractionHigh};
 /** @type {Range} */const total={low:weights.low+(kv?kv.low:0)+overhead.low,high:weights.high+(kv?kv.high:0)+overhead.high};
 const headroom=input.headroom??DEFAULT_HEADROOM;
 if(!(typeof headroom==='number'&&headroom>=0&&headroom<1))throw RangeError('headroom must be in [0,1)');
 /** @type {null|'fits'|'tight'|'does_not_fit'} */let verdict=null;
 if(input.vramGiB!==undefined){
  if(!posNum(input.vramGiB))throw RangeError('vramGiB must be a positive number');
  const vram=input.vramGiB*GIB;
  verdict=total.low>vram?'does_not_fit':total.high>vram*(1-headroom)?'tight':'fits';
 }
 const gib=(/** @type {Range} */ r)=>({low:round2(r.low/GIB),high:round2(r.high/GIB)});
 const assumptions=[];
 if(!kv)assumptions.push('kv_cache_not_included');
 return {
  label:/** @type {'ESTIMATE'} */('ESTIMATE'),
  method:METHOD.id,
  quant:q.id,
  bitsPerWeight:{low:q.bpwLow,high:q.bpwHigh},
  bytes:{weights,kvCache:kv,overhead,total},
  gib:{weights:gib(weights),kvCache:kv&&gib(kv),overhead:gib(overhead),total:gib(total)},
  vramGiB:input.vramGiB??null,
  headroom,
  verdict,
  verdictLabel:verdict?VERDICT_LABELS[verdict]:null,
  assumptions,
  methodText:METHOD.method,
 };
}

/**
 * Highest-precision preset whose verdict is "fits" (then "tight") on a card, or null.
 * @param {Omit<EstimateInput,'quant'>&{vramGiB:number}} input @param {readonly string[]} [order]
 */
export function bestQuantFor(input,order=QUANT_ORDER){
 /** @type {ReturnType<typeof estimateLlmMemory>|null} */let tight=null;
 for(const quant of order){
  const r=estimateLlmMemory({...input,quant});
  if(r.verdict==='fits')return r;
  if(r.verdict==='tight'&&!tight)tight=r;
 }
 return tight;
}
