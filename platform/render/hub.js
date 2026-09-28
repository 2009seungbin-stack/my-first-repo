// @ts-check
/** Vertical hub (/{l}/{vertical}/, e.g. /ko/games/): every channel of the vertical by type — the
 * channel directory behind "전체 채널" and the crawl path to every channel page. */
import {html} from './html.js';
import {page,nameOf,channelUrl,box,monogram,TILE} from './ui.js';
import {compact,collapseVersions} from './format.js';
import {kindTag} from './radar.js';
import {hubEntities,typeCounts,factsFor,pickFact,relatedMany,relatedManyIn,stalePatches,preorderDeadlines,upcomingEvents,recentVersions,entitiesByIds} from '../db/channel.js';
import {dday,eventTime,boardTime} from './format.js';
import {money,tokens,isoDateText,int} from './format.js';
import {estimateLlmMemory} from '../estimates/llm-memory.js';
import {badge} from './ui.js';
import {verticalOf,typeDef} from '../verticals/index.js';
import {label} from '../labels.js';

export const HUB_PAGE_SIZE=60;
/** @param {any} db @param {string} vertical @param {{l:string,now?:number,type?:string|null,org?:string|null,sort?:string|null,vs?:string|null,page?:number,channels?:{name:string,href:string}[]}} o */
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
  const ids=all.map(r=>r.entity.id);
  const byId=type==='plan'?await relatedManyIn(db,ids,'has_plan'):await relatedMany(db,ids,'made_by');
  const owner=new Map(ids.map(id=>[id,byId.get(id)?.[0]||null]));
  compare={rows:all.map(r=>({e:r.entity,owner:owner.get(r.entity.id),f:(/** @type {string} */ p)=>pickFact(facts.get(r.entity.id),p,{region:o.l==='ko'?'KR':'US'})}))};
 }
 // "Right now" boxes on the vertical's front page (no type filter).
 const now=o.now??Date.now();
 /** @type {any} */const now_={};
 if(!type&&vertical==='games'){now_.stale=await stalePatches(db,10);now_.updates=collapseVersions(await recentVersions(db,{since:now-7*864e5,until:now,vertical:'games',limit:20}),o.l).slice(0,10);}
 if(type==='work'&&vertical==='subculture')now_.week=(await upcomingEvents(db,{from:now,to:now+7*864e5,vertical:'subculture',limit:60})).filter((/** @type {any} */ e)=>e.kind==='broadcast'||e.kind==='release');
 // Entry pages people search for, linked from the hub (else they are only in the sitemap).
 if(!type&&vertical==='ai')now_.status=(await hubEntities(db,'ai',{type:'service',limit:20})).map((/** @type {any} */ r)=>r.entity);
 if(!type&&vertical==='hardware'){
  const pairs=((await db.prepare("SELECT r.subject_id AS a,r.object_id AS b FROM relations r JOIN entities x ON x.id=r.subject_id JOIN entities y ON y.id=r.object_id WHERE r.predicate='successor_of' AND r.valid_until IS NULL AND x.type='gpu' AND y.type='gpu' AND x.status='active' AND y.status='active' LIMIT 12").all()).results||[]);
  const ents=await entitiesByIds(db,pairs.flatMap((/** @type {any} */ p)=>[String(p.a),String(p.b)]));
  now_.pairs=pairs.map((/** @type {any} */ p)=>[ents.get(String(p.b)),ents.get(String(p.a))]).filter((/** @type {any[]} */ [x,y])=>x&&y);
 }
 if(!type&&vertical==='subculture'){now_.events=await upcomingEvents(db,{from:now,to:now+14*864e5,vertical:'subculture',limit:10});now_.preorders=await preorderDeadlines(db,now,8);}
 return {vertical,v,type,page:pageNo,counts,groups,compare,org:o.org||null,sort:o.sort||null,vs:o.vs?o.vs.split(','):null,now:now_,at:now,l:o.l,channels:o.channels||[]};
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
 // A pair of cards (?type=gpu&vs=a,b) is its own page: "RTX 5070 vs RTX 4070" is a common search.
 const vsSlugs=m.vs||[];const pairRows=m.type==='gpu'&&m.compare?vsSlugs.map((/** @type {string} */ x)=>/** @type {any} */(m.compare).rows.find((/** @type {any} */ r)=>r.e.slug===x)).filter(Boolean):[];
 if(pairRows.length===2){const [a,b]=pairRows.map((/** @type {any} */ x)=>nameOf(x.e,l)),q=`?type=gpu&vs=${vsSlugs.join(',')}`;
  // Only the two cards (not the whole table again): a page of its own for "A vs B".
  const pbody=html`<section class="box chh rh"><div class="chm"><div class="chn1"><h1>${ko?`${a} vs ${b} 비교`:`${a} vs ${b}`}</h1></div><span class="fine">${ko?'제조사 공식 스펙을 나란히 놓고, 로컬 LLM이 어디까지 들어가는지 추정했습니다.':'Official specs side by side, with an estimate of the local LLMs each can run.'}</span></div></section>
${gpuVersus(pairRows,l)}<p class="pad"><a href="${channelUrl(l,pairRows[0].e)}">${a} ›</a> · <a href="${channelUrl(l,pairRows[1].e)}">${b} ›</a> · <a href="${base}?type=gpu">${ko?'전체 그래픽카드 비교표 ›':'All GPUs ›'}</a></p>`;
  return page({l,title:ko?`${a} vs ${b} 비교 — VRAM·대역폭·전력·로컬 LLM | Nerulio`:`${a} vs ${b} — VRAM, bandwidth, power, local LLMs | Nerulio`,description:ko?`${a}와 ${b}의 VRAM·메모리·전력·출시가를 공식 스펙으로 나란히 비교하고, 각 카드에서 돌아가는 로컬 LLM 크기(추정)를 보여 줍니다.`:`Official specs and estimated local-LLM fit of ${a} and ${b}, side by side.`,
   canonical:site.origin+base+q,alternates:{[l]:site.origin+base+q,[ko?'en':'ko']:site.origin+`/${ko?'en':'ko'}/${vertical}/${q}`},channels:m.channels,body:pbody});}
 if(cmp)return page({l,title:m.type==='gpu'?(ko?'그래픽카드 VRAM·스펙 비교 — 로컬 LLM 추정 포함 | Nerulio':'GPU VRAM and spec comparison | Nerulio'):m.type==='plan'?(ko?'AI 요금제 비교 — ChatGPT·Claude·Gemini 월 요금 (공식) | Nerulio':'AI plan comparison — ChatGPT, Claude, Gemini | Nerulio'):(ko?'AI 모델 API 가격 비교 — 입력·출력 100만 토큰당 (공식) | Nerulio':'AI model API prices — per 1M tokens | Nerulio'),description:(ko?{gpu:'엔비디아·AMD·인텔 그래픽카드의 VRAM, 메모리 대역폭, 전력, 출시가를 공식 스펙으로 한 표에 모았습니다. 카드마다 돌아가는 로컬 LLM 크기(추정)도 함께 봅니다.',plan:'ChatGPT·Claude·Gemini 등 AI 요금제의 월 요금과 연 요금을 공식 가격 페이지 기준으로 한 표에 모았습니다. 가격이 바뀌면 기록이 남습니다.',model:'OpenAI·Anthropic·구글 등 AI 모델의 API 입력·출력 가격(100만 토큰당)과 컨텍스트를 공식 문서 기준으로 비교합니다. 회사별 필터와 정렬, 가격 변경 이력.'}:{gpu:'VRAM, bandwidth, power and launch price of NVIDIA, AMD and Intel GPUs from official specs, with the local LLMs each can run (estimate).',plan:'Monthly and yearly prices of ChatGPT, Claude, Gemini and other AI plans from official pricing pages, with change history.',model:'API input/output prices per 1M tokens and context of AI models from official docs, by company.'})[/** @type {'gpu'|'plan'|'model'} */(m.type)]||'',canonical:site.origin+base+`?type=${m.type}`,alternates:{[l]:site.origin+base+`?type=${m.type}`,[other]:site.origin+`/${other}/${vertical}/?type=${m.type}`},channels:m.channels,body});
 return page({l,title:ko?`${label(v.label,l)} 채널 — ${label(v.tagline,l)} | Nerulio`:`${label(v.label,l)} channels — ${label(v.tagline,l)} | Nerulio`,description:label(v.tagline,l),
  canonical:site.origin+base+(m.type?`?type=${m.type}${m.page>1?`&page=${m.page}`:''}`:''),alternates:{[l]:site.origin+base,[other]:site.origin+`/${other}/${vertical}/`},noindex:m.page>1,channels:m.channels,body});
}

/** @param {any} m @param {string} l */
function compareTable(m,l){
 const ko=l==='ko',rows=m.compare.rows;
 if(m.type==='gpu'){
  const pair=m.vs?m.vs.map((/** @type {string} */ slug)=>rows.find((/** @type {any} */ r)=>r.e.slug===slug)).filter(Boolean):[];
  const versus=pair.length===2?gpuVersus(pair,l):'';
  const list=rows.filter((/** @type {any} */ r)=>r.f('vram_gb')).sort((/** @type {any} */ a,/** @type {any} */ b)=>Number(b.f('vram_gb').value)-Number(a.f('vram_gb').value)||String(b.f('release_date')?.value||'').localeCompare(String(a.f('release_date')?.value||'')));
  const q4=q4Max;
  const cell=(/** @type {any} */ f,/** @type {string} */ unit)=>f?`${int(Number(f.value),l)}${unit}`:'–';
  return html`${versus}${box({title:ko?`그래픽카드 ${list.length}개`:`${list.length} GPUs`},html`<div class="tw" tabindex="0"><table class="mt"><thead><tr><th>${ko?'카드':'Card'}</th><th>VRAM</th><th>${ko?'대역폭':'Bandwidth'}</th><th>${ko?'보드 전력':'Power'}</th><th>${ko?'출시가':'MSRP'}</th><th>${ko?'출시':'Released'}</th><th>${ko?'Q4 최대 (추정)':'Q4 max (est.)'}</th></tr></thead><tbody>
${list.map((/** @type {any} */ r)=>{const v=Number(r.f('vram_gb').value),price=r.f('launch_price_usd'),rel=r.f('release_date');return html`<tr><td><a href="${channelUrl(l,r.e)}"><b>${nameOf(r.e,l)}</b></a></td><td><b>${v} GB</b></td><td>${cell(r.f('memory_bandwidth_gbs'),' GB/s')}</td><td>${cell(r.f('board_power_w'),' W')}</td><td>${price?money(Number(price.value),'USD',l):'–'}</td><td>${rel?isoDateText(String(rel.value)):'–'}</td><td><a href="${channelUrl(l,r.e)}local-llm">≈ ${q4(v)}B</a></td></tr>`;})}
</tbody></table></div>`)}`;
 }
 if(m.type==='plan'){
  // Plans without a list price (Enterprise) stay in the table as "문의", so the count matches the tab.
  const list=rows.slice().sort((/** @type {any} */ a,/** @type {any} */ b)=>(a.f('price_monthly')?0:1)-(b.f('price_monthly')?0:1)).sort((/** @type {any} */ a,/** @type {any} */ b)=>String(a.owner?.slug||'').localeCompare(String(b.owner?.slug||''))||(a.f('price_monthly')?0:1)-(b.f('price_monthly')?0:1)||String(a.f('price_monthly')?.unit||'USD').localeCompare(String(b.f('price_monthly')?.unit||'USD'))||Number(a.f('price_monthly')?.value)-Number(b.f('price_monthly')?.value));
  return box({title:ko?`요금제 ${list.length}개`:`${list.length} plans`},html`<div class="tw" tabindex="0"><table class="mt"><thead><tr><th>${ko?'서비스':'Service'}</th><th>${ko?'요금제':'Plan'}</th><th>${ko?'월 요금':'Monthly'}</th><th>${ko?'연 요금':'Yearly'}</th><th class="nm">${ko?'최소 인원':'Min seats'}</th></tr></thead><tbody>
${list.map((/** @type {any} */ r)=>{const mo=r.f('price_monthly'),yr=r.f('price_yearly'),seats=r.f('seats_min');return html`<tr><td>${r.owner?html`<a href="${channelUrl(l,r.owner)}">${nameOf(r.owner,l)}</a>`:'–'}</td><td><a href="${channelUrl(l,r.e)}">${nameOf(r.e,l)}</a></td><td>${mo?html`<b>${money(Number(mo.value),mo.unit||'USD',l)}</b>`:html`<span class="fine">${ko?'문의':'Contact'}</span>`}</td><td>${yr?money(Number(yr.value),yr.unit||'USD',l):'–'}</td><td class="nm">${seats?seats.value:'–'}</td></tr>`;})}
</tbody></table></div>`);
 }
 const live=rows.filter((/** @type {any} */ r)=>r.f('api_input_price')&&['active','preview',undefined].includes(r.f('status')?.value));
 /** @type {Map<string,{e:any,n:number}>} */const orgs=new Map();for(const r of live)if(r.owner){const o=orgs.get(r.owner.slug)||{e:r.owner,n:0};o.n++;orgs.set(r.owner.slug,o);}
 const org=m.org&&orgs.has(m.org)?m.org:null;
 const price=(/** @type {any} */ r)=>Number(r.f('api_input_price').value);
 const list=live.filter((/** @type {any} */ r)=>!org||r.owner?.slug===org).sort((/** @type {any} */ a,/** @type {any} */ b)=>m.sort==='cheap'?price(a)-price(b):m.sort==='new'?String(b.f('release_date')?.value||'').localeCompare(String(a.f('release_date')?.value||'')):price(b)-price(a));
 const q=(/** @type {string|null} */ o,/** @type {string|null} */ so)=>`?type=model${o?`&org=${o}`:''}${so?`&sort=${so}`:''}`;
 const chips=html`<div class="chips pad">${[[null,ko?'전체':'All',live.length],...[...orgs.values()].sort((a,b)=>b.n-a.n).map(o=>[o.e.slug,nameOf(o.e,l),o.n])].map(([slug,name,n])=>html`<a class="chipf${(slug||null)===org?' on':''}" href="${q(/** @type {any} */(slug),m.sort)}">${name} <span class="fine">${n}</span></a>`)}
<span class="sp"></span><span class="chips">${[[null,ko?'비싼 순':'Priciest'],['cheap',ko?'싼 순':'Cheapest'],['new',ko?'최신순':'Newest']].map(([so,name])=>html`<a class="chipf${(so||null)===(m.sort||null)?' on':''}" href="${q(org,/** @type {any} */(so))}">${name}</a>`)}</span></div>`;
 return box({title:ko?`API로 쓸 수 있는 모델 ${list.length}개`:`${list.length} models with API prices`},html`${chips}<div class="tw" tabindex="0"><table class="mt"><thead><tr><th>${ko?'모델':'Model'}</th><th class="nm">${ko?'회사':'Provider'}</th><th>${ko?'입력':'Input'}</th><th>${ko?'출력':'Output'}</th><th class="nm">${ko?'캐시 입력':'Cached'}</th><th>${ko?'컨텍스트':'Context'}</th><th class="nm">${ko?'출시':'Released'}</th></tr></thead><tbody>
${list.map((/** @type {any} */ r)=>{const i=r.f('api_input_price'),o=r.f('api_output_price'),c=r.f('api_cached_input_price'),ctx=r.f('context_window'),rel=r.f('release_date');return html`<tr><td><a href="${channelUrl(l,r.e)}"><b>${nameOf(r.e,l)}</b></a></td><td class="nm">${r.owner?nameOf(r.owner,l):'–'}</td><td>${money(Number(i.value),i.unit||'USD',l)}</td><td>${o?money(Number(o.value),o.unit||'USD',l):'–'}</td><td class="nm">${c?money(Number(c.value),c.unit||'USD',l):'–'}</td><td>${ctx?tokens(Number(ctx.value)):'–'}</td><td class="nm">${rel?isoDateText(String(rel.value)):'–'}</td></tr>`;})}
</tbody></table></div><p class="fine pad">${ko?'가격은 100만 토큰당 USD. 모델 이름을 누르면 가격 변경 이력이 있습니다.':'USD per 1M tokens. Open a model for its price history.'}</p>`);
}

/** Largest open-model size (billions) that fits at Q4_K_M, from the same estimate as the GPU pages. @param {number} vram */
function q4Max(vram){let best=0;for(const p of [1,3,4,7,8,12,14,20,24,27,32,35,49,70,72,110,123])if(estimateLlmMemory({paramsB:p,quant:'Q4_K_M',vramGiB:vram}).verdict==='fits')best=p;return best;}
/** Two cards side by side (?type=gpu&vs=a,b); the better value of each row in bold.
 * @param {any[]} pair @param {string} l */
function gpuVersus(pair,l){
 const ko=l==='ko';
 const num=(/** @type {any} */ r,/** @type {string} */ p)=>{const f=r.f(p);return f?Number(f.value):null;};
 const ROWS=/** @type {[string,string,(r:any)=>number|null,(n:number)=>string,boolean][]} */([
  ['VRAM','VRAM',r=>num(r,'vram_gb'),n=>`${n} GB`,true],
  ['대역폭','Bandwidth',r=>num(r,'memory_bandwidth_gbs'),n=>`${int(n,l)} GB/s`,true],
  ['메모리 버스','Memory bus',r=>num(r,'memory_bus_bits'),n=>`${n}-bit`,true],
  ['보드 전력','Board power',r=>num(r,'board_power_w'),n=>`${int(n,l)} W`,false],
  ['출시가','MSRP',r=>num(r,'launch_price_usd'),n=>money(n,'USD',l),false],
  ['Q4 최대 모델 (추정)','Q4 max (est.)',r=>{const v=num(r,'vram_gb');return v?q4Max(v):null;},n=>`≈ ${n}B`,true]]);
 const [a,b]=pair;
 const memType=(/** @type {any} */ r)=>r.f('memory_type')?.value?String(r.f('memory_type').value):'–';
 return box({title:ko?`${nameOf(a.e,l)} vs ${nameOf(b.e,l)}`:`${nameOf(a.e,l)} vs ${nameOf(b.e,l)}`,extra:badge('OFFICIAL',l),note:ko?'공식 스펙 · 공식 수치가 없으면 – · Q4 최대는 추정':'Official specs · – where no official figure · Q4 max is an estimate'},html`<div class="tw" tabindex="0"><table class="mt vs"><thead><tr><th></th><th><a href="${channelUrl(l,a.e)}">${nameOf(a.e,l)}</a></th><th><a href="${channelUrl(l,b.e)}">${nameOf(b.e,l)}</a></th></tr></thead><tbody>
<tr><th>${ko?'메모리':'Memory'}</th><td>${memType(a)}</td><td>${memType(b)}</td></tr>
${ROWS.map(([k,e,get,fmt,higher])=>{const x=get(a),y=get(b);const win=x==null||y==null||x===y?0:(higher?x>y:x<y)?1:2;return html`<tr><th>${ko?k:e}</th><td>${x==null?'–':win===1?html`<b>${fmt(x)}</b>`:fmt(x)}</td><td>${y==null?'–':win===2?html`<b>${fmt(y)}</b>`:fmt(y)}</td></tr>`;})}
</tbody></table></div><p class="fine pad"><a href="${channelUrl(l,a.e)}local-llm">${nameOf(a.e,l)} 로컬 LLM ›</a> · <a href="${channelUrl(l,b.e)}local-llm">${nameOf(b.e,l)} 로컬 LLM ›</a></p>`);
}

/** @param {any} m */
function nowBoxes(m){
 const {l,at}=m,ko=l==='ko',n=m.now||{};
 const out=[];
 if(n.week)return weekTable(m);
 if(n.status?.length)out.push(box({title:ko?'지금 장애? 서비스 상태':'Is it down? Service status'},html`<ul class="rows">${n.status.map((/** @type {any} */ e)=>html`<li><a class="tt" href="${channelUrl(l,e)}status">${ko?`지금 ${nameOf(e,l)} 장애?`:`Is ${nameOf(e,l)} down?`}</a></li>`)}</ul>`));
 if(n.pairs?.length)out.push(box({title:ko?'그래픽카드 1:1 비교':'GPU head-to-head'},html`<ul class="rows">${n.pairs.map((/** @type {any} */ [x,y])=>{const q=[x.slug,y.slug].sort().join(',');return html`<li><a class="tt" href="/${l}/hardware/?type=gpu&vs=${q}">${nameOf(x,l)} vs ${nameOf(y,l)}</a><a class="fine" href="${channelUrl(l,y)}local-llm">${ko?'로컬 LLM ›':'Local LLMs ›'}</a></li>`;})}</ul>`));
 if(n.stale?.length)out.push(box({title:ko?'업데이트로 한글패치 확인이 필요한 게임':'Korean patches to re-check after an update',extra:html`<span class="st u">${ko?'미확인':'unchecked'}</span>`},html`<ul class="rows">${n.stale.map((/** @type {any} */ s)=>html`<li><a class="tt" href="${channelUrl(l,s.game)}">${nameOf(s.game,l)} <b>${s.current}</b></a><span class="fine">${ko?`패치는 ${s.lastOk}에서 작동`:`patch worked on ${s.lastOk}`}</span><a class="fine" href="${channelUrl(l,s.patch)}">${ko?'패치 채널 ›':'patch ›'}</a></li>`)}</ul>`));
 if(n.updates?.length)out.push(box({title:ko?'이번 주 업데이트된 게임':'Updated this week',extra:badge('AUTOMATED',l)},html`<ul class="rows">${n.updates.map((/** @type {any} */ r)=>html`<li><span class="tm">${boardTime(r.released_at,at,l)}</span><a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)} <b>${r.version}</b></a></li>`)}</ul>`));
 if(n.events?.length)out.push(box({title:ko?'2주 안의 방송·이벤트':'Next two weeks',extra:badge('OFFICIAL',l)},html`<ul class="rows">${n.events.map((/** @type {any} */ ev)=>html`<li class="ev"><span class="dday">${dday(ev.starts_at,at,l)}</span><a class="tt" href="${channelUrl(l,ev.entity)}">${kindTag(ev.kind,l)}${ev.title[l]||ev.title.en}</a><span class="fine">${eventTime(ev.starts_at,ev.precision,l)}</span></li>`)}</ul>`));
 if(n.preorders?.length)out.push(box({title:ko?'예약 마감 임박 굿즈':'Pre-orders closing soon',note:ko?'제조사 공식 상품 페이지 기준':'official product pages'},html`<ul class="rows">${n.preorders.map((/** @type {any} */ p)=>html`<li><span class="st soon">${ko?'마감':'closes'} ${isoDateText(p.ends).slice(5)}</span><a class="tt" href="${channelUrl(l,p.entity)}">${nameOf(p.entity,l)}</a>${p.work?html`<a class="fine" href="${channelUrl(l,p.work)}">${nameOf(p.work,l)}</a>`:p.of?html`<a class="fine" href="${channelUrl(l,p.of)}">${nameOf(p.of,l)}</a>`:''}</li>`)}</ul>`));
 return out.length?html`<div class="g2">${out}</div>`:'';
}

const WD=/** @type {Record<string,string[]>} */({ko:['일','월','화','수','목','금','토'],en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat']});
/** Broadcasts and releases of the next 7 days by weekday, in Korea time on Korean pages. @param {any} m */
function weekTable(m){
 const {l,at}=m,ko=l==='ko',tz=ko?'Asia/Seoul':'UTC';
 const parts=(/** @type {number} */ ms)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
 const days=Array.from({length:7},(_,i)=>{const p=parts(at+i*864e5);return {key:`${p.month}.${p.day}`,wd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday)};});
 /** @type {Record<string,any[]>} */const by={};
 for(const e of m.now.week){const p=parts(e.starts_at);(by[`${p.month}.${p.day}`]??=[]).push({...e,hm:e.precision==='time'?`${p.hour}:${p.minute}`:''});}
 const body=html`<ol class="week">${days.map((d,i)=>html`<li${i===0?html` class="today"`:''}><h3>${WD[l][d.wd]} <span class="fine">${d.key}</span></h3>${(by[d.key]||[]).length?html`<ul>${(by[d.key]||[]).sort((a,b)=>a.starts_at-b.starts_at).map(e=>html`<li><span class="tm">${e.hm||'–'}</span><a href="${channelUrl(l,e.entity)}">${e.title[l]||e.title.en}</a></li>`)}</ul>`:html`<p class="fine">${ko?'편성 없음':'Nothing scheduled'}</p>`}</li>`)}</ol>`;
 return box({title:ko?'이번 주 방영·공개 시간표 (한국 시간)':'This week\'s broadcasts (UTC)',extra:badge('OFFICIAL',l),note:ko?'공식 편성 발표 기준 · 시간 미정은 –':'official schedules'},body);
}
