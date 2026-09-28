// @ts-check
/** "{GPU}에서 돌아가는 로컬 LLM" (/{l}/hardware/{gpu}/local-llm): every open-weight model in the
 * graph against this card's VRAM at Q4_K_M and Q8_0 — a labelled ESTIMATE with the method shown —
 * next to community measurements (median tok/s and count), which are never estimated. The page the
 * English "can I run it" sites rank for, in Korean and with estimate and measurement kept apart. */
import {html} from './html.js';
import {page,nameOf,channelUrl,box,badge} from './ui.js';
import {int} from './format.js';
import {openModels,benchmarksOn,factsFor,pickFact} from '../db/channel.js';
import {estimateLlmMemory,METHOD} from '../estimates/llm-memory.js';

const QUANTS=/** @type {const} */(['Q4_K_M','Q8_0']);
/** @param {any} db @param {import('../db/channel.js').Entity} gpu @param {{l:string,now:number,channels?:{name:string,href:string}[]}} o */
export async function loadLocalLlm(db,gpu,o){
 const vram=Number(pickFact((await factsFor(db,[gpu.id])).get(gpu.id),'vram_gb')?.value||0);
 const bench=await benchmarksOn(db,gpu.id);
 const models=(await openModels(db)).sort((a,b)=>a.paramsB-b.paramsB).map(m=>{
  const est=Object.fromEntries(QUANTS.map(q=>[q,vram?estimateLlmMemory({paramsB:m.paramsB,quant:q,vramGiB:vram}):null]));
  const tps=bench.filter(b=>b.entity_id===m.entity.id&&typeof b.metrics.tokens_per_s==='number').map(b=>Number(b.metrics.tokens_per_s)).sort((a,b)=>a-b);
  return {...m,est,measured:tps.length?{median:tps.length%2?tps[tps.length>>1]:(tps[tps.length/2-1]+tps[tps.length/2])/2,n:tps.length}:null};
 });
 return {gpu,vram,models,l:o.l,now:o.now,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadLocalLlm>>} m @param {{origin:string}} site */
export function renderLocalLlm(m,site){
 const {gpu,l}=m,ko=l==='ko',name=nameOf(gpu,l),base=channelUrl(l,gpu),url=base+'local-llm';
 // The same words as the method text below (맞음 / 빠듯함 / 안 맞음).
 const V=/** @type {Record<string,[string,string]>} */({fits:[ko?'맞음':'Fits','fy'],tight:[ko?'빠듯함':'Tight','fm'],does_not_fit:[ko?'안 맞음':'No','fn']});
 const cell=(/** @type {any} */ r)=>r?html`<td class="${V[r.verdict][1]}"><b>${V[r.verdict][0]}</b> <span class="fine">≈ ${r.gib.total.low.toFixed(1)}–${r.gib.total.high.toFixed(1)} GiB</span></td>`:html`<td>–</td>`;
 const fitsQ4=m.models.filter(x=>x.est.Q4_K_M?.verdict==='fits');
 const biggest=fitsQ4[fitsQ4.length-1];
 const summary=html`<section class="box chh rh"><div class="chm"><div class="chn1"><h1>${ko?`${name}에서 돌아가는 로컬 LLM`:`Local LLMs on the ${name}`}</h1>${badge('ESTIMATE',l,ko?'≈ 메모리 추정':'≈ memory estimate')}</div>
<p class="desc">${ko?`VRAM ${m.vram} GB 기준으로 공개 가중치 모델 ${m.models.length}개가 들어가는지 추정했습니다. Q4_K_M에서 여유 있게 들어가는 가장 큰 모델은 ${biggest?nameOf(biggest.entity,l)+` (${biggest.paramsB}B)`:'없음'}입니다. 속도(tok/s)는 추정하지 않고 커뮤니티 실측만 보여줍니다.`:`${m.models.length} open-weight models estimated against ${m.vram} GB of VRAM. Largest comfortable fit at Q4_K_M: ${biggest?nameOf(biggest.entity,l)+` (${biggest.paramsB}B)`:'none'}. Speed is never estimated; only community measurements are shown.`}</p></div></section>`;
 const noFit=(/** @type {any} */ x)=>x.est.Q4_K_M?.verdict==='does_not_fit'&&!x.measured;
 const row=(/** @type {any} */ x)=>html`<tr><td><a href="${channelUrl(l,x.entity)}">${nameOf(x.entity,l)}</a></td><td>${x.paramsB}B</td>${cell(x.est.Q4_K_M)}${cell(x.est.Q8_0)}<td>${x.measured?html`<b>${int(Math.round(x.measured.median*10)/10,l)}</b> tok/s <span class="fine">· ${x.measured.n}${ko?'건':''}</span>`:html`<span class="fine">${ko?'리포트 없음':'none yet'}</span>`}</td></tr>`;
 const table=box({title:ko?'모델별 적합성':'Fit by model',note:ko?'KV 캐시 제외 · 여유분 10% · 방법은 아래':'KV cache excluded · 10% headroom · method below'},html`<div class="tw"><table class="mt"><thead><tr><th>${ko?'모델':'Model'}</th><th>${ko?'파라미터':'Params'}</th><th>Q4_K_M</th><th>Q8_0</th><th>${ko?'실측 (중앙값)':'Measured (median)'}</th></tr></thead><tbody>
${m.models.filter(x=>!noFit(x)).map(row)}
</tbody></table></div>${m.models.some(noFit)?html`<details class="more"><summary>${ko?`Q4_K_M에서도 안 맞는 모델 ${m.models.filter(noFit).length}개 보기`:`${m.models.filter(noFit).length} models that do not fit even at Q4_K_M`}</summary><div class="tw"><table class="mt"><tbody>${m.models.filter(noFit).map(row)}</tbody></table></div></details>`:''}<details class="method" open><summary>${ko?'추정 방법':'How this is estimated'}</summary><p>${METHOD.method[/** @type {'ko'|'en'} */(l)]||METHOD.method.en}</p></details>`);
 const form=box({id:'bench',title:ko?'내 측정값 올리기':'Post your measurement',extra:badge('COMMUNITY',l)},html`<form class="wform" data-island="bench-form" data-gpu="${gpu.id}">
<div class="row"><label>${ko?'모델':'Model'}<select name="model" required>${m.models.filter(x=>x.est.Q4_K_M?.verdict!=='does_not_fit').map(x=>html`<option value="${x.entity.id}">${nameOf(x.entity,l)}</option>`)}</select></label>
<label>${ko?'실행기':'Runtime'}<select name="runtime"><option>llama.cpp</option><option>Ollama</option><option>LM Studio</option><option>vLLM</option><option>ExLlamaV2</option></select></label>
<label>${ko?'양자화':'Quantization'}<select name="quant"><option>Q4_K_M</option><option>Q5_K_M</option><option>Q6_K</option><option>Q8_0</option><option>FP16</option></select></label></div>
<div class="row"><label>${ko?'컨텍스트 (선택)':'Context (optional)'}<input name="ctx" inputmode="numeric" pattern="[0-9]{3,7}" placeholder="8192"></label>
<label>${ko?'생성 속도 (tok/s)':'Generation (tok/s)'}<input name="tps" inputmode="decimal" required pattern="[0-9]{1,4}([.,][0-9]{1,2})?" placeholder="42.5" title="${ko?'숫자, 소수점 둘째 자리까지 (예: 42.5)':'A number, up to two decimals (e.g. 42.5)'}"></label>
<label>${ko?'드라이버 / OS (선택)':'Driver / OS (optional)'}<input name="os" maxlength="60" placeholder="${ko?'예: 581.xx · Windows 11':'e.g. Windows 11'}"></label></div>
<div class="acts"><button class="btn p" type="submit" data-label="${ko?'올리기':'Post'}">${ko?'올리기':'Post'}</button></div></form>`);
 const body=html`<div class="crumb"><a class="chl" href="${base}">${ko?`${name} 채널`:name}</a><span class="sp"></span><a class="btn" href="${base}">${ko?'채널로':'Channel'}</a></div>${summary}${table}${form}`;
 const other=ko?'en':'ko';
 return page({l,title:ko?`${name}에서 돌아가는 로컬 LLM — ${m.vram}GB VRAM 적합 모델 (추정·실측) | Nerulio`:`Local LLMs that fit the ${name} (${m.vram} GB) — estimate and measurements | Nerulio`,
  description:ko?`${name} ${m.vram}GB에 들어가는 공개 LLM ${fitsQ4.length}개(Q4_K_M, 추정)와 커뮤니티 실측 토큰/초.`:`${fitsQ4.length} open LLMs that fit ${m.vram} GB at Q4_K_M (estimate) plus community-measured tokens/s.`,
  canonical:site.origin+url,alternates:{[l]:site.origin+url,[other]:site.origin+channelUrl(other,gpu)+'local-llm'},noindex:!m.vram,
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:{name,id:gpu.id},body});
}
