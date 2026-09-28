// @ts-check
/** Vertical hub (/{l}/{vertical}/, e.g. /ko/games/): every channel of the vertical by type — the
 * channel directory behind "전체 채널" and the crawl path to every channel page. */
import {html} from './html.js';
import {page,nameOf,channelUrl,box,monogram,TILE} from './ui.js';
import {compact} from './format.js';
import {hubEntities,typeCounts,factsFor,pickFact,related,stalePatches,preorderDeadlines,upcomingEvents,recentVersions} from '../db/channel.js';
import {dday,eventTime,boardTime} from './format.js';
import {money,tokens,isoDateText,int} from './format.js';
import {estimateLlmMemory} from '../estimates/llm-memory.js';
import {badge} from './ui.js';
import {verticalOf,typeDef} from '../verticals/index.js';
import {label} from '../labels.js';

export const HUB_PAGE_SIZE=60;
/** @param {any} db @param {string} vertical @param {{l:string,now?:number,type?:string|null,page?:number,channels?:{name:string,href:string}[]}} o */
export async function loadHub(db,vertical,o){
 const v=verticalOf(vertical);if(!v)return null;
 const counts=await typeCounts(db,vertical);
 const type=o.type&&Object.prototype.hasOwnProperty.call(v.types,o.type)?o.type:null;
 const pageNo=Math.max(1,Math.floor(o.page||1));
 const types=(type?[type]:v.hubTypes.filter(t=>counts[t]));
 const groups=[];
 for(const t of types)groups.push({type:t,total:counts[t]||0,rows:await hubEntities(db,vertical,{type:t,limit:type?HUB_PAGE_SIZE:12,offset:type?(pageNo-1)*HUB_PAGE_SIZE:0})});
 // AI plans and models: a comparison table from official facts instead of a plain list.
 let compare=null;
 if(vertical==='hardware'&&type==='gpu'){
  const all=await hubEntities(db,'hardware',{type,limit:200});
  const facts=await factsFor(db,all.map(r=>r.entity.id));
  compare={rows:all.map(r=>({e:r.entity,owner:null,f:(/** @type {string} */ p)=>pickFact(facts.get(r.entity.id),p)}))};
 }
 if(vertical==='ai'&&(type==='plan'||type==='model')){
  const all=await hubEntities(db,'ai',{type,limit:200});
  const facts=await factsFor(db,all.map(r=>r.entity.id));
  const owner=new Map();
  for(const r of all){const rel=await related(db,r.entity.id,type==='plan'?'in':'out',[type==='plan'?'has_plan':'made_by']);owner.set(r.entity.id,rel[0]?.entity||null);}
  compare={rows:all.map(r=>({e:r.entity,owner:owner.get(r.entity.id),f:(/** @type {string} */ p)=>pickFact(facts.get(r.entity.id),p,{region:o.l==='ko'?'KR':'US'})}))};
 }
 // "Right now" boxes on the vertical's front page (no type filter).
 const now=o.now??Date.now();
 /** @type {any} */const now_={};
 if(!type&&vertical==='games'){now_.stale=await stalePatches(db,10);now_.updates=await recentVersions(db,{since:now-7*864e5,until:now,vertical:'games',limit:10});}
 if(!type&&vertical==='subculture'){now_.events=await upcomingEvents(db,{from:now,to:now+14*864e5,vertical:'subculture',limit:10});now_.preorders=await preorderDeadlines(db,now,8);}
 return {vertical,v,type,page:pageNo,counts,groups,compare,now:now_,at:now,l:o.l,channels:o.channels||[]};
}
/** @param {NonNullable<Awaited<ReturnType<typeof loadHub>>>} m @param {{origin:string}} site */
export function renderHub(m,site){
 const {l,v,vertical}=m,ko=l==='ko',base=`/${l}/${vertical}/`;
 const tabs=html`<nav class="ftabs" aria-label="${ko?'종류':'Type'}"><a href="${base}"${!m.type?html` class="on" aria-current="page"`:''}>${ko?'전체':'All'}</a>${v.hubTypes.filter(t=>m.counts[t]).map(t=>html`<a href="${base}?type=${t}"${m.type===t?html` class="on" aria-current="page"`:''}>${label(/** @type {any} */(typeDef(vertical,t)).plural,l)} <span class="fine">${m.counts[t]}</span></a>`)}</nav>`;
 const groups=m.groups.map(g=>box({title:label(/** @type {any} */(typeDef(vertical,g.type)).plural,l),note:!m.type&&g.total>g.rows.length?html`<a href="${base}?type=${g.type}">${ko?`${g.total}개 모두 보기 ›`:`All ${g.total} ›`}</a>`:`${g.total}`},
  html`<ul class="hubg">${g.rows.map(r=>html`<li><span class="tile sm ${TILE[vertical]||''}" aria-hidden="true">${monogram(r.entity,l)}</span><a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)}</a>${r.posts?html`<span class="fine">${ko?'글':'posts'} ${compact(r.posts,l)}</span>`:''}</li>`)}</ul>`));
 const total=m.type?m.counts[m.type]||0:0,last=Math.ceil(total/HUB_PAGE_SIZE);
 const pager=m.type&&last>1?html`<nav class="pager" aria-label="${ko?'페이지':'Page'}">${m.page>1?html`<a class="btn" href="${base}?type=${m.type}${m.page-1>1?`&page=${m.page-1}`:''}">‹</a>`:''}<span class="fine">${m.page} / ${last}</span>${m.page<last?html`<a class="btn" href="${base}?type=${m.type}&page=${m.page+1}">›</a>`:''}</nav>`:'';
 const cmp=m.compare?compareTable(m,l):null;
 const body=cmp?html`<section class="box chh rh"><div class="chm"><div class="chn1"><h1>${m.type==='gpu'?(ko?'그래픽카드 VRAM·스펙 비교':'GPU VRAM and spec comparison'):m.type==='plan'?(ko?'AI 요금제 비교':'AI plan comparison'):(ko?'AI 모델 API 가격 비교':'AI model API price comparison')}</h1>${badge('OFFICIAL',l)}</div><span class="fine">${m.type==='gpu'?(ko?'제조사 공식 스펙 기준. "Q4 최대"는 Q4_K_M에서 여유 있게 들어가는 모델 크기 추정(KV 캐시 제외)입니다.':'Official specs. "Q4 max" is an estimate of the largest model that fits at Q4_K_M (KV cache excluded).'):m.type==='plan'?(ko?'각 회사 공식 요금 페이지 기준. 한국 요금이 공식으로 나와 있으면 원화, 아니면 달러로 적었습니다(달러 요금은 결제 시 환율·세금에 따라 달라짐).':'From each company\'s official pricing page, in the local currency where one is published.'):(ko?'각 회사 공식 가격 문서 기준, 100만 토큰당 달러.':'From each company\'s official pricing docs, USD per 1M tokens.')}</span>${tabs}</div></section>${cmp}`:html`<section class="box chh rh"><div class="chm"><div class="chn1"><h1>${label(v.label,l)}</h1><span class="fine">${label(v.tagline,l)}</span></div>${tabs}</div></section>${nowBoxes(m)}${groups}${pager}`;
 const other=ko?'en':'ko';
 if(cmp)return page({l,title:m.type==='gpu'?(ko?'그래픽카드 VRAM·스펙 비교 — 로컬 LLM 추정 포함 | Nerulio':'GPU VRAM and spec comparison | Nerulio'):m.type==='plan'?(ko?'AI 요금제 비교 — ChatGPT·Claude·Gemini 월 요금 (공식) | Nerulio':'AI plan comparison — ChatGPT, Claude, Gemini | Nerulio'):(ko?'AI 모델 API 가격 비교 — 입력·출력 100만 토큰당 (공식) | Nerulio':'AI model API prices — per 1M tokens | Nerulio'),description:ko?'공식 가격 페이지 기준 요금·API 가격을 한 표로. 바뀌면 기록이 남습니다.':'Official prices in one table, with change history.',canonical:site.origin+base+`?type=${m.type}`,alternates:{[l]:site.origin+base+`?type=${m.type}`,[other]:site.origin+`/${other}/${vertical}/?type=${m.type}`},channels:m.channels,body});
 return page({l,title:ko?`${label(v.label,l)} 채널 — ${label(v.tagline,l)} | Nerulio`:`${label(v.label,l)} channels — ${label(v.tagline,l)} | Nerulio`,description:label(v.tagline,l),
  canonical:site.origin+base+(m.type?`?type=${m.type}${m.page>1?`&page=${m.page}`:''}`:''),alternates:{[l]:site.origin+base,[other]:site.origin+`/${other}/${vertical}/`},noindex:m.page>1,channels:m.channels,body});
}

/** @param {any} m @param {string} l */
function compareTable(m,l){
 const ko=l==='ko',rows=m.compare.rows;
 if(m.type==='gpu'){
  const list=rows.filter((/** @type {any} */ r)=>r.f('vram_gb')).sort((/** @type {any} */ a,/** @type {any} */ b)=>Number(b.f('vram_gb').value)-Number(a.f('vram_gb').value)||String(b.f('release_date')?.value||'').localeCompare(String(a.f('release_date')?.value||'')));
  const q4=(/** @type {number} */ vram)=>{let best=0;for(const p of [1,3,4,7,8,12,14,20,24,27,32,35,49,70,72,110,123])if(estimateLlmMemory({paramsB:p,quant:'Q4_K_M',vramGiB:vram}).verdict==='fits')best=p;return best;};
  const cell=(/** @type {any} */ f,/** @type {string} */ unit)=>f?`${int(Number(f.value),l)}${unit}`:'–';
  return box({title:ko?`그래픽카드 ${list.length}개`:`${list.length} GPUs`},html`<div class="tw"><table class="mt"><thead><tr><th>${ko?'카드':'Card'}</th><th>VRAM</th><th>${ko?'대역폭':'Bandwidth'}</th><th>${ko?'보드 전력':'Power'}</th><th>${ko?'출시가':'MSRP'}</th><th>${ko?'출시':'Released'}</th><th>${ko?'Q4 최대 (추정)':'Q4 max (est.)'}</th></tr></thead><tbody>
${list.map((/** @type {any} */ r)=>{const v=Number(r.f('vram_gb').value),price=r.f('launch_price_usd'),rel=r.f('release_date');return html`<tr><td><a href="${channelUrl(l,r.e)}"><b>${nameOf(r.e,l)}</b></a></td><td><b>${v} GB</b></td><td>${cell(r.f('memory_bandwidth_gbs'),' GB/s')}</td><td>${cell(r.f('board_power_w'),' W')}</td><td>${price?money(Number(price.value),'USD',l):'–'}</td><td>${rel?isoDateText(String(rel.value)):'–'}</td><td><a href="${channelUrl(l,r.e)}local-llm">≈ ${q4(v)}B</a></td></tr>`;})}
</tbody></table></div>`);
 }
 if(m.type==='plan'){
  const list=rows.filter((/** @type {any} */ r)=>r.f('price_monthly')).sort((/** @type {any} */ a,/** @type {any} */ b)=>String(a.owner?.slug||'').localeCompare(String(b.owner?.slug||''))||String(a.f('price_monthly').unit||'USD').localeCompare(String(b.f('price_monthly').unit||'USD'))||Number(a.f('price_monthly').value)-Number(b.f('price_monthly').value));
  return box({title:ko?`요금제 ${list.length}개`:`${list.length} plans`},html`<div class="tw"><table class="mt"><thead><tr><th>${ko?'서비스':'Service'}</th><th>${ko?'요금제':'Plan'}</th><th>${ko?'월 요금':'Monthly'}</th><th>${ko?'연 요금':'Yearly'}</th><th>${ko?'최소 인원':'Min seats'}</th></tr></thead><tbody>
${list.map((/** @type {any} */ r)=>{const mo=r.f('price_monthly'),yr=r.f('price_yearly'),seats=r.f('seats_min');return html`<tr><td>${r.owner?html`<a href="${channelUrl(l,r.owner)}">${nameOf(r.owner,l)}</a>`:'–'}</td><td><a href="${channelUrl(l,r.e)}">${nameOf(r.e,l)}</a></td><td><b>${money(Number(mo.value),mo.unit||'USD',l)}</b></td><td>${yr?money(Number(yr.value),yr.unit||'USD',l):'–'}</td><td>${seats?seats.value:'–'}</td></tr>`;})}
</tbody></table></div>`);
 }
 const list=rows.filter((/** @type {any} */ r)=>r.f('api_input_price')&&['active','preview',undefined].includes(r.f('status')?.value)).sort((/** @type {any} */ a,/** @type {any} */ b)=>Number(b.f('api_input_price').value)-Number(a.f('api_input_price').value));
 return box({title:ko?`API로 쓸 수 있는 모델 ${list.length}개`:`${list.length} models with API prices`},html`<div class="tw"><table class="mt"><thead><tr><th>${ko?'모델':'Model'}</th><th>${ko?'회사':'Provider'}</th><th>${ko?'입력':'Input'}</th><th>${ko?'출력':'Output'}</th><th>${ko?'캐시 입력':'Cached'}</th><th>${ko?'컨텍스트':'Context'}</th><th>${ko?'출시':'Released'}</th></tr></thead><tbody>
${list.map((/** @type {any} */ r)=>{const i=r.f('api_input_price'),o=r.f('api_output_price'),c=r.f('api_cached_input_price'),ctx=r.f('context_window'),rel=r.f('release_date');return html`<tr><td><a href="${channelUrl(l,r.e)}"><b>${nameOf(r.e,l)}</b></a></td><td>${r.owner?nameOf(r.owner,l):'–'}</td><td>${money(Number(i.value),i.unit||'USD',l)}</td><td>${o?money(Number(o.value),o.unit||'USD',l):'–'}</td><td>${c?money(Number(c.value),c.unit||'USD',l):'–'}</td><td>${ctx?tokens(Number(ctx.value)):'–'}</td><td>${rel?isoDateText(String(rel.value)):'–'}</td></tr>`;})}
</tbody></table></div><p class="fine pad">${ko?'가격은 100만 토큰당 USD. 모델 이름을 누르면 가격 변경 이력이 있습니다.':'USD per 1M tokens. Open a model for its price history.'}</p>`);
}

/** @param {any} m */
function nowBoxes(m){
 const {l,at}=m,ko=l==='ko',n=m.now||{};
 const out=[];
 if(n.stale?.length)out.push(box({title:ko?'업데이트로 한글패치 확인이 필요한 게임':'Korean patches to re-check after an update',extra:html`<span class="st u">${ko?'미확인':'unchecked'}</span>`},html`<ul class="rows">${n.stale.map((/** @type {any} */ s)=>html`<li><a class="tt" href="${channelUrl(l,s.game)}">${nameOf(s.game,l)} <b>${s.current}</b></a><span class="fine">${ko?`패치는 ${s.lastOk}에서 작동`:`patch worked on ${s.lastOk}`}</span><a class="fine" href="${channelUrl(l,s.patch)}">${ko?'패치 채널 ›':'patch ›'}</a></li>`)}</ul>`));
 if(n.updates?.length)out.push(box({title:ko?'이번 주 업데이트된 게임':'Updated this week',extra:badge('AUTOMATED',l)},html`<ul class="rows">${n.updates.map((/** @type {any} */ r)=>html`<li><span class="tm">${boardTime(r.released_at,at,l)}</span><a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)} <b>${r.version}</b></a></li>`)}</ul>`));
 if(n.events?.length)out.push(box({title:ko?'2주 안의 방송·이벤트':'Next two weeks',extra:badge('OFFICIAL',l)},html`<ul class="rows">${n.events.map((/** @type {any} */ ev)=>html`<li class="ev"><span class="dday">${dday(ev.starts_at,at,l)}</span><a class="tt" href="${channelUrl(l,ev.entity)}">${ev.title[l]||ev.title.en}</a><span class="fine">${eventTime(ev.starts_at,ev.precision,l)}</span></li>`)}</ul>`));
 if(n.preorders?.length)out.push(box({title:ko?'예약 마감 임박 굿즈':'Pre-orders closing soon',note:ko?'제조사 공식 상품 페이지 기준':'official product pages'},html`<ul class="rows">${n.preorders.map((/** @type {any} */ p)=>html`<li><span class="st soon">${ko?'마감':'closes'} ${isoDateText(p.ends).slice(5)}</span><a class="tt" href="${channelUrl(l,p.entity)}">${nameOf(p.entity,l)}</a></li>`)}</ul>`));
 return out.length?html`<div class="g2">${out}</div>`:'';
}
