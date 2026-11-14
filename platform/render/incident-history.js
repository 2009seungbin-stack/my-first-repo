// @ts-check
/** Collected service history. Recorded endpoints are not a claim of current availability. */
import {html,safeHref} from './html.js';

/** Keep the recorded date precision; only precise instants are converted to the reader's zone.
 * @param {number|null} value @param {string} precision @param {string} l */
function timestamp(value,precision,l){
 if(typeof value!=='number'||!Number.isFinite(value)||!['time','day','month','quarter','year'].includes(precision))return '';
 const at=new Date(value);if(!Number.isFinite(at.getTime()))return '';
 const iso=at.toISOString();
 if(precision==='quarter')return html`<span>${l==='ko'?`${iso.slice(0,4)}년 ${Math.floor(at.getUTCMonth()/3)+1}분기`:`Q${Math.floor(at.getUTCMonth()/3)+1} ${iso.slice(0,4)}`}</span>`;
 if(precision!=='time'){
  const date=iso.slice(0,precision==='year'?4:precision==='month'?7:10);
  return html`<time datetime="${date}">${date}</time>`;
 }
 const ko=l==='ko',zone=ko?'Asia/Seoul':'UTC';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(p=>[p.type,p.value]));
 const text=`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${ko?'KST':'UTC'}`;
 return html`<time datetime="${iso}">${text}</time>`;
}

/** @param {any[]} events @param {string} l */
export function renderIncidentHistory(events,l){
 const ko=l==='ko';
 return html`<section class="box pad" data-incident-history><h2>${ko?'최근 수집한 공식 이력':'Recently collected official history'}</h2><p class="fine">${ko?'최근 14일에 걸치는 수집 기록 중 최대 20개를 시작 시각 역순으로 표시합니다. 현재 작동 여부나 전체 장애 이력을 보장하지 않습니다. 최신 현황은 공식 출처에서 확인하세요.':'Up to 20 collected entries overlapping the last 14 days, newest start first. This does not establish current availability or a complete incident history. Check the official source for the latest state.'}</p>${events.length?html`<ol class="plist">${events.map(ev=>{
  const start=timestamp(ev.starts_at,ev.precision,l),end=timestamp(ev.ends_at,ev.precision,l);
  return html`<li class="pad"><h3>${ev.title[l]||ev.title.en||''}</h3><p class="fine">${start?html`${ko?'시작 기록':'Recorded start'}: ${start}`:(ko?'시작 시각 미기록':'Start time not recorded')}<br>${end?html`${ko?'종료 기록':'Recorded end'}: ${end}`:(ko?'종료 시각 미기록':'End time not recorded')}</p><p class="fine">${ev.status==='ended'?(ko?'수집 당시 상태: 종료됨':'Status at collection: ended'):(ko?'수집 당시 종료 여부 미확정':'End status unconfirmed at collection')}</p>${ev.url?html`<a href="${safeHref(ev.url)}" rel="noopener" target="_blank">${ko?'공식 원문':'Official source'} ↗</a>`:''}</li>`;
 })}</ol>`:html`<p>${ko?'표시할 수집 기록이 없습니다. 공식 출처에서 현재 상태를 확인하세요.':'No collected entries to display. Check the official source for current status.'}</p>`}</section>`;
}
