// @ts-check
/** The right column of the portal pages (home feed and posts): AI service status (official incidents
 * and Nerulio user reports, the same signal as each service's status page), Radar news, this week's
 * schedule and today's ★ best posts. */
import {html} from './html.js';
import {nameOf,channelUrl,postHref,frontUrl} from './ui.js';
import {boardTime,dday} from './format.js';
import {entitiesByIds,eventsFor,issueReportsSince,collectorState,frontPosts,upcomingEvents} from '../db/channel.js';
import {reportSignal} from '../status-signal.js';
import {STATUS_ADAPTER,statusChecked} from './panels/ai.js';

const DAY=864e5;
/** The services on the status box, with their provider (whose incidents count too) and a short name. */
export const RAIL_SERVICES=Object.freeze([
 {id:'service:claude',provider:'provider:anthropic',short:'Claude'},
 {id:'service:chatgpt',provider:'provider:openai',short:'ChatGPT'},
 {id:'service:gemini-app',provider:'provider:google',short:'Gemini'},
]);

/** @typedef {'bad'|'warn'|'ok'|'unk'} StatusState */
/** Status of one service: an open official incident, a spike of user reports, a checked "no incident",
 * or (no status collector) the user-report count only.
 * @param {{open:boolean,spike:boolean,checked:boolean,total24:number}} x @returns {StatusState} */
export const statusState=x=>x.open?'bad':x.spike?'warn':x.checked?'ok':'unk';
/** @param {StatusState} state @param {number} total24 @param {string} l */
export function statusText(state,total24,l){
 const ko=l==='ko';
 if(state==='bad')return ko?'공식 장애':'Incident';
 if(state==='warn')return ko?'리포트 급증':'Reports spiking';
 if(state==='ok')return ko?'정상':'Operational';
 return total24?(ko?`리포트 ${total24}건`:`${total24} reports`):(ko?'리포트 없음':'No reports');
}

/** @param {any} db @param {{now:number}} o */
export async function loadRail(db,o){
 const {now}=o,ids=RAIL_SERVICES.map(s=>s.id);
 const adapters=[...new Set(RAIL_SERVICES.map(s=>STATUS_ADAPTER[s.provider]).filter(Boolean))];
 const [entities,incidents,reports,collectors,news,upcoming,best]=await Promise.all([
  entitiesByIds(db,ids),
  Promise.all(RAIL_SERVICES.map(s=>eventsFor(db,[s.id,s.provider],{kinds:['incident','other'],from:now-DAY,desc:true,limit:10}))),
  issueReportsSince(db,ids,now-8*DAY),
  collectorState(db,adapters),
  frontPosts(db,{mode:'news',limit:3}),
  upcomingEvents(db,{from:now,to:now+7*DAY,limit:4}),
  frontPosts(db,{mode:'best',since:now-DAY,limit:5})]);
 const status=RAIL_SERVICES.map((s,i)=>{
  const e=entities.get(s.id)||null;
  const open=incidents[i].some(x=>x.url&&/status\./.test(x.url)&&x.status!=='ended');
  const sig=reportSignal(reports.filter(r=>r.entity_id===s.id),now);
  const adapter=STATUS_ADAPTER[s.provider];
  const checked=adapter?statusChecked(collectors.get(adapter),now):false;
  return {id:s.id,short:s.short,entity:e,total24:sig.total24,state:statusState({open,spike:sig.spike,checked,total24:sig.total24})};
 }).filter(x=>x.entity);
 return {now,status,news,upcoming,best};
}

/** @param {Awaited<ReturnType<typeof loadRail>>} r @param {string} l */
export function renderRail(r,l){
 const ko=l==='ko',now=r.now;
 const status=html`<section class="rbox" aria-labelledby="rail-status"><div class="rbh"><h2 id="rail-status">${ko?'AI 서비스 상태':'AI service status'}</h2><a href="/${l}/ai/">${ko?'AI 채널':'AI'} ›</a></div>
<ul class="svc">${r.status.map(x=>html`<li><a class="svr" href="${channelUrl(l,/** @type {any} */(x.entity))}status"><span class="dot ${x.state}" aria-hidden="true"></span><b>${x.short}</b><span class="svs ${x.state}">${statusText(x.state,x.total24,l)}</span></a></li>`)}</ul>
<p class="fine">${ko?'공식 상태 페이지의 장애 기록과 Nerulio 사용자 리포트 기준':'Official incidents and Nerulio user reports'}</p></section>`;
 const news=r.news.length?html`<section class="rbox" aria-labelledby="rail-news"><div class="rbh"><h2 id="rail-news">${ko?'새 소식':'News'}</h2><a href="/${l}/radar/">${ko?'레이더':'Radar'} ›</a></div>
<ul class="rnews">${r.news.map(p=>html`<li><time datetime="${new Date(p.created_at).toISOString()}">${boardTime(p.created_at,now,l)}</time><a href="${postHref(l,p)}">${p.title}</a></li>`)}</ul></section>`:'';
 const upcoming=r.upcoming.length?html`<section class="rbox" aria-labelledby="rail-week"><div class="rbh"><h2 id="rail-week">${ko?'이번 주 일정':'This week'}</h2></div>
<ul class="rev">${r.upcoming.map(ev=>html`<li><span class="dday">${dday(ev.starts_at,now,l)}</span><a href="${channelUrl(l,/** @type {any} */(ev.entity))}">${ev.title[l]||ev.title.en}</a></li>`)}</ul></section>`:'';
 const best=r.best.length?html`<section class="rbox" aria-labelledby="rail-best"><div class="rbh"><h2 id="rail-best">${ko?'★ 념글':'★ Best'}</h2><a href="${frontUrl(l)}best/">${ko?'더보기':'More'} ›</a></div>
<ol class="rbest">${r.best.map((p,i)=>html`<li><span class="rk">${i+1}</span><a href="${postHref(l,p)}">${p.title}</a></li>`)}</ol></section>`:'';
 return html`<aside class="rrail" aria-label="${ko?'상태와 소식':'Status and news'}">${status}${news}${upcoming}${best}<p class="rfoot"><a href="/${l}/about/">Nerulio</a> · <a href="/${l}/terms/">${ko?'이용약관':'Terms'}</a> · <a href="/${l}/privacy/">${ko?'개인정보 처리방침':'Privacy'}</a> · <a href="/${l}/community/policy">${ko?'운영정책':'Rules'}</a> · <a href="/${l}/community/transparency">${ko?'투명성':'Transparency'}</a></p></aside>`;
}
