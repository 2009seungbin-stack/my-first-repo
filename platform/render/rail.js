// @ts-check
/** The right column of the portal pages (home feed and posts): AI service status (official incidents
 * and Nerulio user reports, the same signal as each service's status page), Radar news and today's ★
 * best posts. The weekly schedule lives on Radar. */
import {html} from './html.js';
import {nameOf,channelUrl,postHref,frontUrl} from './ui.js';
import {boardTime} from './format.js';
import {entitiesByIds,eventsFor,issueReportsSince,collectorState,frontPosts} from '../db/channel.js';
import {reportSignal} from '../status-signal.js';
import {STATUS_ADAPTER,statusChecked} from './panels/ai.js';
import {icon,STATUS_ICON,REPORT_ICON} from './icons.js';

const DAY=864e5;
/** The services on the status box, with their provider (whose incidents count too), a short name and the
 * Korean name people type when it breaks ("클로드 안 됨", "챗GPT 먹통", "제미나이 오류"). */
export const RAIL_SERVICES=Object.freeze([
 {id:'service:claude',provider:'provider:anthropic',short:'Claude',ko:'클로드'},
 {id:'service:chatgpt',provider:'provider:openai',short:'ChatGPT',ko:'챗GPT'},
 {id:'service:gemini-app',provider:'provider:google',short:'Gemini',ko:'제미나이'},
]);
/** An official incident: an event from a status page (status.claude.com, status.openai.com …). @param {{url:string|null}} x */
export const isStatusIncident=x=>!!x.url&&/status\./.test(x.url);

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
 const [entities,incidents,reports,collectors,news,best]=await Promise.all([
  entitiesByIds(db,ids),
  Promise.all(RAIL_SERVICES.map(s=>eventsFor(db,[s.id,s.provider],{kinds:['incident','other'],from:now-DAY,desc:true,limit:10}))),
  issueReportsSince(db,ids,now-8*DAY),
  collectorState(db,adapters),
  frontPosts(db,{mode:'news',limit:3}),
  frontPosts(db,{mode:'best',since:now-DAY,limit:5})]);
 const status=RAIL_SERVICES.map((s,i)=>{
  const e=entities.get(s.id)||null;
  const open=incidents[i].some(x=>isStatusIncident(x)&&x.status!=='ended');
  const sig=reportSignal(reports.filter(r=>r.entity_id===s.id),now);
  const adapter=STATUS_ADAPTER[s.provider];
  const checked=adapter?statusChecked(collectors.get(adapter),now):false;
  return {id:s.id,short:s.short,entity:e,total24:sig.total24,state:statusState({open,spike:sig.spike,checked,total24:sig.total24})};
 }).filter(x=>x.entity);
 return {now,status,news,best};
}

/** A compact report button beside a service: one tap says "it's not working for me" (islands, with or
 * without an account); without JavaScript it opens the status page's report box. Labelled 제보, not
 * "안 돼요": beside the status word "안 돼요" read like the service's state (2026-09-30).
 * @param {{id:string,short:string,entity:any}} x @param {string} l @param {boolean} [compact] */
export function outageButton(x,l,compact=false){
 const ko=l==='ko',label=ko?`${x.short}가 안 되면 제보`:`Report ${x.short} not working`;
 return html`<a class="nb${compact?' c':''}" href="${channelUrl(l,x.entity)}status#report" data-outage="${x.id}" aria-label="${label}" title="${label}" rel="nofollow">${icon(REPORT_ICON,compact?14:15)}<span>${ko?'제보':'Report'}</span></a>`;
}

/** @param {Awaited<ReturnType<typeof loadRail>>} r @param {string} l */
export function renderRail(r,l){
 const ko=l==='ko',now=r.now;
 const status=html`<section class="rbox" aria-labelledby="rail-status"><div class="rbh"><h2 id="rail-status">${icon('pulse',16)}${ko?'AI 서비스 상태':'AI service status'}</h2><a href="/${l}/ai/">${ko?'AI 채널':'AI'} ›</a></div>
<ul class="svc">${r.status.map(x=>html`<li><a class="svr" href="${channelUrl(l,/** @type {any} */(x.entity))}status"><span class="sti ${x.state}">${icon(STATUS_ICON[x.state],16)}</span><b>${x.short}</b><span class="svs ${x.state}">${statusText(x.state,x.total24,l)}</span></a>${outageButton(x,l)}</li>`)}</ul>
</section>`;
 const news=r.news.length?html`<section class="rbox" aria-labelledby="rail-news"><div class="rbh"><h2 id="rail-news">${icon('news',16)}${ko?'새 소식':'News'}</h2><a href="/${l}/radar/">${ko?'레이더':'Radar'} ›</a></div>
<ul class="rnews">${r.news.map(p=>html`<li><time datetime="${new Date(p.created_at).toISOString()}">${boardTime(p.created_at,now,l)}</time><a href="${postHref(l,p)}">${p.title}</a></li>`)}</ul></section>`:'';
 const best=r.best.length?html`<section class="rbox" aria-labelledby="rail-best"><div class="rbh"><h2 id="rail-best">${icon('star',16)}${ko?'념글':'Best'}</h2><a href="${frontUrl(l)}best/">${ko?'더보기':'More'} ›</a></div>
<ol class="rbest">${r.best.map((p,i)=>html`<li><span class="rk">${i+1}</span><a href="${postHref(l,p)}">${p.title}</a></li>`)}</ol></section>`:'';
 return html`<aside class="rrail" aria-label="${ko?'상태와 소식':'Status and news'}">${status}${news}${best}<p class="rfoot"><a href="/${l}/about/">Nerulio</a> · <a href="/${l}/terms/">${ko?'이용약관':'Terms'}</a> · <a href="/${l}/privacy/">${ko?'개인정보 처리방침':'Privacy'}</a> · <a href="/${l}/community/policy">${ko?'운영정책':'Rules'}</a> · <a href="/${l}/community/transparency">${ko?'투명성':'Transparency'}</a></p></aside>`;
}

/** The status line above the feed on phones: one row, each service a link to its status page (where the big
 * 안 돼요 button is); words only when something is wrong. @param {Awaited<ReturnType<typeof loadRail>>} r @param {string} l */
export function statusStrip(r,l){
 const ko=l==='ko';
 return html`<nav class="mstat" aria-label="${ko?'AI 서비스 상태':'AI service status'}"><span class="msl">${icon('pulse',15)}${ko?'AI 상태':'AI status'}</span>${r.status.map(x=>html`<a class="msi" href="${channelUrl(l,/** @type {any} */(x.entity))}status" aria-label="${x.short} ${statusText(x.state,x.total24,l)}"><span class="sti ${x.state}">${icon(STATUS_ICON[x.state],15)}</span><b>${x.short}</b>${x.state==='bad'||x.state==='warn'?html`<span class="svs ${x.state}">${statusText(x.state,x.total24,l)}</span>`:''}</a>`)}</nav>`;
}
