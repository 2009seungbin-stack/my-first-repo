// @ts-check
/** "지금 Claude 장애?" (/{l}/ai/{slug}/status): the official status page's incidents next to
 * Nerulio users' problem reports of the last 24 hours (per hour, Korea time for ko), a spike badge
 * when the last hour is well above the week's usual rate, and a one-tap report. User reports are
 * labelled as such and never presented as the official status. */
import {html,safeHref} from './html.js';
import {t} from './strings.js';
import {page,nameOf,channelUrl,box,badge} from './ui.js';
import {boardTime,TZ} from './format.js';
import {related,eventsFor,issueReportsSince,factsFor,pickFact,collectorState,koAlias} from '../db/channel.js';
import {STATUS_ADAPTER,statusChecked} from './panels/ai.js';
import {reportSignal,SPIKE} from '../status-signal.js';
import {RAIL_SERVICES,isStatusIncident,statusState} from './rail.js';
import {icon,STATUS_ICON} from './icons.js';

const HOUR=36e5,DAY=864e5;
export const SYMPTOMS=Object.freeze({down:{ko:'접속 안 됨',en:'Won’t load'},slow:{ko:'느림',en:'Slow'},error:{ko:'오류 메시지',en:'Errors'},login:{ko:'로그인 안 됨',en:'Can’t sign in'},limit:{ko:'한도 오류',en:'Limit errors'}});
/** Spike = last hour ≥ 3 reports and ≥ 3× the average hourly rate of the previous 7 days. */
export {SPIKE};

/** The Korean name people search with ("클로드", "챗GPT", "제미나이"): the curated one of the home status
 * services, else the entity's Korean alias. @param {any} db @param {import('../db/channel.js').Entity} entity @param {string} name */
async function searchAlias(db,entity,name){
 const curated=RAIL_SERVICES.find(s=>s.id===entity.id)?.ko;
 if(curated)return curated===name?(/[가-힣]/.test(name)?entity.names.en||null:null):curated;
 return koAlias(db,entity.id,name);
}

/** @param {any} db @param {import('../db/channel.js').Entity} entity @param {{l:string,now:number,channels?:{name:string,href:string}[]}} o */
export async function loadStatus(db,entity,o){
 const {now}=o;
 const provider=(await related(db,entity.id,'in',['offers']))[0]?.entity||null;
 const siblings=provider?(await related(db,provider.id,'out',['offers'])).map(r=>r.entity).filter(x=>x.type==='service'&&x.id!==entity.id).slice(0,4):[];
 const adapter=provider?STATUS_ADAPTER[provider.id]:undefined;
 const q={kinds:['incident','other'],from:now-30*DAY,desc:true,limit:30};
 const [own,bySibling,reports,facts,collectors,alias]=await Promise.all([
  eventsFor(db,[entity.id,...(provider?[provider.id]:[])],q),
  Promise.all(siblings.map(x=>eventsFor(db,[x.id],{...q,limit:10}))),
  issueReportsSince(db,[entity.id],now-8*DAY),
  factsFor(db,[entity.id]),
  adapter?collectorState(db,[adapter]):Promise.resolve(new Map()),
  o.l==='ko'?searchAlias(db,entity,nameOf(entity,'ko')):Promise.resolve(null)]);
 // The service's own incidents and its provider's decide its state (as on the home status box); a
 // sister service's incident (Claude Code under Claude) is listed with its name but does not.
 const seen=new Set();
 /** @type {(ReturnType<typeof eventsFor> extends Promise<(infer E)[]> ? E & {about:import('../db/channel.js').Entity|null} : never)[]} */
 const incidents=[...own.filter(isStatusIncident).map(x=>({...x,about:null})),...siblings.flatMap((sib,i)=>bySibling[i].filter(isStatusIncident).map(x=>({...x,about:sib})))]
  .filter(x=>seen.has(x.id)?false:(seen.add(x.id),true)).sort((a,b)=>(b.starts_at??0)-(a.starts_at??0)).slice(0,30);
 const {hours,baseline,spike,total24}=reportSignal(reports,now);
 /** @type {Record<string,number>} */const symptoms={};
 for(const r of reports)if(r.created_at>=now-DAY){const k=String(r.env.symptom||'other');symptoms[k]=(symptoms[k]||0)+1;}
 const statusPage=pickFact(facts.get(entity.id),'status_page')?.value||null;
 const collector=adapter?collectors.get(adapter):undefined;
 const checked=adapter?statusChecked(collector,now):false;
 const open=incidents.filter(x=>!x.about&&x.status!=='ended');
 const siblingOpen=incidents.filter(x=>x.about&&x.status!=='ended');
 const state=statusState({open:open.length>0,spike,checked,total24});
 return {entity,alias,provider,siblings,incidents,open,siblingOpen,state,checked,checkedAt:collector?.last_success_at??null,hasCollector:!!adapter,hours,baseline,spike,total24,symptoms,statusPage,l:o.l,now,channels:o.channels||[]};
}

/** Title, description and heading in the words people search with when it breaks: "Claude 지금 안
 * 돼요?", "클로드 안 됨·먹통·오류". They never state the status itself: search results keep a snippet for
 * days, and a stale "정상" there would be a false claim. @param {string} name @param {string|null} alias @param {string} l */
export function statusSeo(name,alias,l){
 if(l!=='ko')return {h1:`Is ${name} down right now?`,title:`Is ${name} down right now? Live outage and error check | Nerulio`,
  description:`Is ${name} not working? Official status-page incidents and Nerulio users’ “not working” reports from the last 24 hours, hour by hour and shown separately.`};
 const label=alias?`${name}(${alias})`:name,word=/[가-힣]/.test(name)?name:alias||name;
 return {h1:`${label} 지금 안 돼요?`,title:`${label} 지금 안 돼요? 실시간 장애·접속 오류 확인 | Nerulio`,
  description:`${word} 안 됨·먹통·오류가 나나요? 공식 상태 페이지의 장애 기록과 Nerulio 사용자들의 ‘안 돼요’ 리포트(최근 24시간, 시간별)를 따로 보여줍니다.`};
}

/** "HH:MM" in the page language's time zone (KST for ko). @param {number} ms @param {string} l */
const hhmm=(ms,l)=>new Intl.DateTimeFormat('en-GB',{timeZone:TZ[l]||'UTC',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms));
/** When the official status was last checked and when the user reports were counted. "정상" is only ever
 * said within STATUS_FRESH_MS of a successful check (statusChecked); an older check is shown as such.
 * @param {{checked:boolean,checkedAt:number|null,hasCollector:boolean,now:number,l:string}} m */
export function freshness(m){
 const ko=m.l==='ko',at=(/** @type {number} */ ms)=>html`<time datetime="${new Date(ms).toISOString()}">${boardTime(ms,m.now,m.l)}</time>`;
 const official=!m.hasCollector?(ko?'공식 상태는 자동 확인하지 않아요':'Official status is not checked automatically')
  :m.checkedAt===null?(ko?'공식 상태 아직 확인 전':'Official status not checked yet')
  :m.checked?html`${ko?'공식 상태 마지막 확인':'Official status last checked'} ${at(m.checkedAt)}`
  :html`${ko?'공식 상태 마지막 확인':'Official status last checked'} ${at(m.checkedAt)} ${ko?'(2시간 넘게 지나 ‘정상’으로 표시하지 않아요)':'(over 2 hours ago, so not shown as operational)'}`;
 return html`<span class="stfo">${official}</span> · <span>${ko?'사용자 리포트':'User reports as of'} <time datetime="${new Date(m.now).toISOString()}">${hhmm(m.now,m.l)}</time>${ko?' 기준':''}${m.l==='en'?' UTC':''}</span>`;
}

/** 24 bars, one per hour; the dashed line is the week's usual hourly rate. @param {Awaited<ReturnType<typeof loadStatus>>} m */
function chart(m){
 const {l}=m,W=720,H=150,PL=28,PB=22,PT=10,max=Math.max(4,Math.ceil(Math.max(...m.hours.map(h=>h.n),m.baseline)*1.2));
 const bw=(W-PL)/24,y=(/** @type {number} */ v)=>PT+(H-PT-PB)*(1-v/max);
 const hourLabel=(/** @type {number} */ ms)=>new Intl.DateTimeFormat('en-GB',{timeZone:TZ[l]||'UTC',hour:'2-digit',hourCycle:'h23'}).format(new Date(ms));
 const ticks=[0,Math.round(max/2),max];
 return html`<div class="tw" tabindex="0"><svg class="hchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${l==='ko'?`최근 24시간 사용자 리포트, 시간당. 합계 ${m.total24}건`:`User reports per hour, last 24 hours. Total ${m.total24}`}">
${ticks.map(v=>html`<line class="gl" x1="${PL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"></line><text class="ax" x="${PL-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`)}
${m.hours.map((h,i)=>{const x=PL+i*bw+1,hh=Math.max(0,H-PB-y(h.n));return html`<g class="bar"><rect class="hit" x="${PL+i*bw}" y="${PT}" width="${bw}" height="${H-PT-PB}"></rect>${h.n?html`<path class="b${i===23?' now':''}" d="M${x},${H-PB} v${-Math.max(0,hh-4)} q0,-4 4,-4 h${bw-10} q4,0 4,4 v${Math.max(0,hh-4)} z"></path>`:''}<title>${hourLabel(h.from)}:00 — ${h.n}${l==='ko'?'건':''}</title></g>`;})}
${m.baseline>0?html`<line class="base" x1="${PL}" x2="${W}" y1="${y(m.baseline)}" y2="${y(m.baseline)}"></line>`:''}
${m.hours.map((h,i)=>i%6===0||i===23?html`<text class="ax" x="${PL+i*bw+bw/2}" y="${H-6}" text-anchor="middle">${i===23?(l==='ko'?'지금':'now'):hourLabel(h.from)+(l==='ko'?'시':'h')}</text>`:'')}
</svg></div>`;
}

/** @param {Awaited<ReturnType<typeof loadStatus>>} m @param {{origin:string}} site */
export function renderStatus(m,site){
 const {entity:e,l,now,state}=m,s=t(l),ko=l==='ko',name=nameOf(e,l),base=channelUrl(l,e),seo=statusSeo(name,m.alias,l);
 const headline=state==='bad'?(ko?`${name}: 공식 장애 조사 중`:`${name}: official incident open`):state==='warn'?(ko?`${name}: 사용자 리포트 급증`:`${name}: user reports spiking`):state==='ok'?(ko?`${name}: 공식 장애 없음${m.total24?` · 사용자 리포트 ${m.total24}건(평소 수준)`:''}`:`${name}: no official incident${m.total24?` · ${m.total24} user reports (usual level)`:''}`):(ko?`${name}: 공식 상태 확인 전${m.total24?` · 사용자 리포트 ${m.total24}건`:''}`:`${name}: official status not checked yet${m.total24?` · ${m.total24} user reports`:''}`);
 const sib=m.siblingOpen.length?html`<p class="fine">${ko?`같은 회사의 다른 서비스에 공식 장애가 진행 중이에요: ${[...new Set(m.siblingOpen.map(x=>nameOf(/** @type {any} */(x.about),l)))].join(', ')}`:`An official incident is open on a related service: ${[...new Set(m.siblingOpen.map(x=>nameOf(/** @type {any} */(x.about),l)))].join(', ')}`}</p>`:'';
 const top=html`<section class="box sthero ${state}"><span class="sti ${state}">${icon(STATUS_ICON[state],30)}</span><div class="sthb"><h1>${seo.h1}</h1><p class="sth">${headline}</p>${sib}
<p class="stf fine">${freshness(m)}</p>
<p class="fine">${ko?'공식 상태 페이지의 장애 기록과 Nerulio 사용자 리포트를 따로 보여줍니다.':'Official incidents and Nerulio user reports, shown separately.'} ${m.statusPage?html`<a href="${safeHref(m.statusPage)}" rel="noopener" target="_blank">${ko?'공식 상태 페이지':'Official status page'} ↗</a>`:''}</p></div></section>`;
 const report=box({title:ko?'지금 문제가 있나요?':'Having problems now?',note:ko?'로그인한 사용자 리포트만 집계 · 한 사람당 1시간에 한 번':'Signed-in reports only · once per person per hour'},html`<div class="vbs sym" data-island="outage-report" data-entity="${e.id}">${Object.entries(SYMPTOMS).map(([k,v])=>html`<button class="vb" type="button" data-symptom="${k}" disabled>${v[/** @type {'ko'|'en'} */(l)]}</button>`)}</div>`);
 const reports=box({title:ko?'최근 24시간 사용자 리포트':'User reports, last 24 hours',extra:badge('COMMUNITY',l),note:ko?html`합계 <span data-total24="${m.total24}">${m.total24}</span>건 · 점선 = 지난 7일 평균`:html`<span data-total24="${m.total24}">${m.total24}</span> total · dashed = 7-day average`},
  html`${chart(m)}${Object.keys(m.symptoms).length?html`<ul class="rows">${Object.entries(m.symptoms).sort((a,b)=>b[1]-a[1]).map(([k,n])=>html`<li><span class="tt">${/** @type {any} */(SYMPTOMS)[k]?.[l]||k}</span><b>${n}</b></li>`)}</ul>`:''}
<details class="method"><summary>${ko?'표로 보기':'Show as table'}</summary><table class="mt"><thead><tr><th>${ko?'시간':'Hour'}</th><th>${ko?'리포트':'Reports'}</th></tr></thead><tbody>${m.hours.map(h=>html`<tr><td>${boardTime(h.from,now,l)}</td><td>${h.n}</td></tr>`)}</tbody></table></details>`);
 const inc=box({title:ko?'공식 장애 기록 (30일)':'Official incidents (30 days)',extra:badge('AUTOMATED',l)},m.incidents.length?html`<ul class="rows">${m.incidents.map(x=>html`<li><span class="tm">${x.starts_at?boardTime(x.starts_at,now,l):''}</span><a class="tt" href="${safeHref(x.url)}" rel="noopener" target="_blank">${x.about?html`<span class="chn">${nameOf(x.about,l)}</span> `:''}${x.title[l]||x.title.en}</a><span class="st ${x.status==='ended'?'c':'u'}">${x.status==='ended'?(ko?'해결':'resolved'):(ko?'진행 중':'open')}</span></li>`)}</ul>`:html`<p class="empty">${m.checked?(ko?'최근 30일 동안 공식 상태 페이지에 기록된 장애가 없습니다.':'No incident on the official status page in the last 30 days.'):(ko?'공식 상태 페이지를 아직 수집하지 않았습니다. 위 링크에서 직접 확인해 주세요.':'The official status page has not been collected yet; check it via the link above.')}</p>`);
 const others=m.siblings.length?box({title:ko?'같은 회사의 다른 서비스':'Other services by the same company'},html`<ul class="rows">${m.siblings.map(x=>html`<li><a class="tt" href="${channelUrl(l,x)}status">${nameOf(x,l)}</a></li>`)}</ul>`):'';
 const body=html`<div class="crumb"><a class="chl" href="${base}">${s.channel(name)}</a><span class="sp"></span><a class="btn" href="${base}">${s.list}</a></div>${top}<div class="cols"><main class="mainc">${report}${reports}${inc}</main><aside class="side">${others}</aside></div>`;
 return page({l,title:seo.title,description:seo.description,
  canonical:site.origin+base+'status',alternates:{[l]:site.origin+base+'status',[ko?'en':'ko']:site.origin+channelUrl(ko?'en':'ko',e)+'status'},
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:{name,id:e.id},body,
  jsonld:{'@context':'https://schema.org','@type':'WebPage',name:seo.h1,headline,url:site.origin+base+'status',dateModified:new Date(now).toISOString()}});
}
