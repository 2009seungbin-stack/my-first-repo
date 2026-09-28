// @ts-check
/** AI model channel (Claude Opus 5.5, GPT-…, Gemma …): official API prices with their change
 * history, where the model is available (plans × platforms), a deprecation notice, and for
 * open-weight models the VRAM it needs (ESTIMATE) with example cards that fit. */
import {html} from '../html.js';
import {box,badge,nameOf,channelUrl} from '../ui.js';
import {money,isoDateText,dateText,tokens} from '../format.js';
import {factHistory,availabilityFor,entitiesByIds,entitiesWithFact,pickFact,related} from '../../db/channel.js';
import {estimateLlmMemory} from '../../estimates/llm-memory.js';
import {AVAILABILITY_LABEL,label} from '../../labels.js';
import {factRows} from './generic.js';

const PRICE_PROPS=['api_input_price','api_output_price','api_cached_input_price'];
const VRAM_TIERS=[8,12,16,24,32,48,80];
/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e,facts}=ctx;
 const history=await factHistory(db,e.id,PRICE_PROPS);
 const avail=await availabilityFor(db,[e.id]);
 const plans=await entitiesByIds(db,avail.map(a=>a.plan_id).filter(id=>id!=='*'));
 const provider=(await related(db,e.id,'out',['made_by']))[0]?.entity||null;
 const params=Number(pickFact(facts,'parameters_b')?.value||0),open=pickFact(facts,'open_weights')?.value===true;
 let local=null;
 if(open&&params>0){
  const est=estimateLlmMemory({paramsB:params,quant:'Q4_K_M'});
  const tier=VRAM_TIERS.find(v=>estimateLlmMemory({paramsB:params,quant:'Q4_K_M',vramGiB:v}).verdict==='fits')||null;
  const cards=tier?(await entitiesWithFact(db,'gpu','vram_gb',tier,3)):[];
  local={est,tier,cards};
 }
 return {history,avail,plans,provider,local};
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l,facts,entity:e}=ctx,ko=l==='ko';
 const price=(/** @type {string} */ p)=>{const f=pickFact(facts,p);return f?money(Number(f.value),f.unit||'USD',l):null;};
 const inP=price('api_input_price'),outP=price('api_output_price'),cache=price('api_cached_input_price');
 const dep=pickFact(facts,'deprecation_date')?.value,status=pickFact(facts,'status')?.value;
 const notice=dep||status==='deprecated'||status==='retired'?html`<section class="box alertbox"><b>${status==='retired'?(ko?'서비스 종료된 모델':'Retired model'):(ko?'지원 종료 예정':'Deprecation scheduled')}</b>${dep?html` <span>${isoDateText(String(dep))}</span>`:''} ${badge('OFFICIAL',l)}</section>`:'';
 // Price history: every closed row of a price property, as "old → new (date)".
 const changes=d.history.filter(h=>!h.current).map(h=>{const next=d.history.find(x=>x.property===h.property&&x.plan===h.plan&&x.region===h.region&&x.valid_from>=(h.valid_until||0)&&x!==h);return {h,next};}).filter(x=>x.next);
 const PL=/** @type {Record<string,{ko:string,en:string}>} */({api_input_price:{ko:'입력',en:'Input'},api_output_price:{ko:'출력',en:'Output'},api_cached_input_price:{ko:'캐시 입력',en:'Cached input'}});
 const pricing=inP||outP?box({title:ko?'API 가격 (100만 토큰)':'API price (per 1M tokens)',extra:badge('OFFICIAL',l)},html`<div class="kv pad"><span class="big">${inP||'–'} <span class="fine">/</span> ${outP||'–'}</span><span class="fine">${ko?'입력 / 출력':'input / output'}${cache?` · ${ko?'캐시 입력':'cached input'} ${cache}`:''}</span></div>
<h3 class="wh">${ko?'가격 변경 이력':'Price history'}</h3>${changes.length?html`<ul class="rows">${changes.map(({h,next})=>html`<li><span class="tm">${dateText(/** @type {number} */(h.valid_until),'day',l).slice(2)}</span><span class="tt">${PL[h.property]?.[/** @type {'ko'|'en'} */(l)]} ${money(Number(h.value),h.unit||'USD',l)} → <b>${money(Number(next?.value),next?.unit||'USD',l)}</b></span></li>`)}</ul>`:html`<p class="fine pad">${ko?'기록된 변경 없음. 바뀌면 여기에 이전 값과 날짜가 남습니다.':'No recorded change yet. Old values and dates will be kept here.'}</p>`}`):'';
 const rows=d.avail.map(a=>({where:a.plan_id!=='*'&&d.plans.get(a.plan_id)?nameOf(/** @type {any} */(d.plans.get(a.plan_id)),l):a.platform==='api'?'API':(ko?'전체':'All'),platform:a.platform,region:a.region,state:a.state,plan:d.plans.get(a.plan_id)}));
 const where=rows.length?box({title:ko?'쓸 수 있는 곳':'Where it is available',extra:badge('OFFICIAL',l)},html`<ul class="rows">${rows.map(r=>html`<li><span class="tt">${r.plan?html`<a href="${channelUrl(l,r.plan)}">${r.where}</a>`:r.where}${r.platform!=='*'&&r.platform!=='api'?html` <span class="fine">${r.platform}</span>`:''}${r.region!=='*'?html` <span class="fine">${r.region}</span>`:''}</span><span class="st ${r.state==='available'?'c':r.state==='unavailable'?'d':'u'}">${label(/** @type {any} */(AVAILABILITY_LABEL)[r.state]||AVAILABILITY_LABEL.unknown,l)}</span></li>`)}</ul>`):'';
 const loc=d.local?box({title:ko?'로컬에서 돌리려면':'Running it locally',extra:badge('ESTIMATE',l)},html`<div class="kv pad"><span class="big sm">≈ ${d.local.est.gib.total.low.toFixed(1)}–${d.local.est.gib.total.high.toFixed(1)} GiB</span><span class="fine">Q4_K_M · ${ko?'KV 캐시 제외':'KV cache excluded'}</span>
${d.local.tier?html`<span>${ko?`${d.local.tier}GB 카드부터 여유`:`Fits from ${d.local.tier} GB cards`}${d.local.cards.length?html`: ${d.local.cards.map((c,i)=>html`${i?', ':''}<a href="${channelUrl(l,c)}local-llm">${nameOf(c,l)}</a>`)}`:''}</span>`:html`<span>${ko?'단일 소비자용 카드(80GB 이하)에는 들어가지 않음':'Does not fit a single card up to 80 GB'}</span>`}</div>`):'';
 const specs=[['context_window',ko?'컨텍스트':'Context'],['max_output',ko?'최대 출력':'Max output']].map(([p,lab])=>{const f=pickFact(facts,p);return f?html`<span class="spec"><span class="fine">${lab}</span><b>${tokens(Number(f.value))}</b></span>`:'';});
 const head=specs.some(Boolean)?html`<section class="box specs">${specs}${d.provider?html`<span class="spec"><span class="fine">${ko?'제공사':'Provider'}</span><a href="${channelUrl(l,d.provider)}"><b>${nameOf(d.provider,l)}</b></a></span>`:''}${pickFact(facts,'api_model_id')?html`<span class="spec"><span class="fine">API ID</span><code>${pickFact(facts,'api_model_id')?.value}</code></span>`:''}</section>`:'';
 return html`${notice}${head}<div class="g2">${pricing||loc}${where||(pricing?loc:'')}</div>${pricing&&where&&loc?loc:''}`;
}
/** @param {unknown} _d @param {import('./index.js').PanelContext} ctx */
function wiki(_d,ctx){const rows=factRows(ctx);return rows.length?html`<table class="wk"><tbody>${rows}</tbody></table>`:'';}

/** @type {import('./index.js').Panel} */
export default {id:'model',types:['ai:model'],load,top,wiki};
