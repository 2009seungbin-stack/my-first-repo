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

const DAY=864e5;
export const HISTORY_DAYS=14;
/** Which of the last HISTORY_DAYS calendar days each collected entry touches (KST days for ko, UTC days for en —
 * the zones the entries' times are shown in). An entry counts on every day from its recorded start to its
 * recorded end; without a usable end it counts on its start day only. A date-only entry keeps its own calendar
 * date. Entries without a start, or recorded only to a month, quarter or year, cannot be placed and are
 * returned as `unplaced`. A day with count 0 means "nothing collected", never "no incident".
 * @param {any[]} events @param {number} now @param {string} l
 * @returns {{days:{date:string,count:number}[],unplaced:number}} */
export function incidentDays(events,now,l){
 const shift=l==='ko'?9*36e5:0,last=Math.floor((now+shift)/DAY),first=last-HISTORY_DAYS+1;
 const count=new Array(HISTORY_DAYS).fill(0);let unplaced=0;
 const ok=(/** @type {unknown} */ v)=>typeof v==='number'&&Number.isFinite(v);
 for(const ev of events){
  if(!ok(ev.starts_at)||(ev.precision!=='time'&&ev.precision!=='day')){unplaced++;continue;}
  const off=ev.precision==='time'?shift:0,a=Math.floor((ev.starts_at+off)/DAY);
  const b=ok(ev.ends_at)&&ev.ends_at>=ev.starts_at?Math.floor((ev.ends_at+off)/DAY):a;
  if(b<first||a>last){unplaced++;continue;}
  for(let d=Math.max(a,first);d<=Math.min(b,last);d++)count[d-first]++;
 }
 return {days:count.map((n,i)=>({date:new Date((first+i)*DAY).toISOString().slice(0,10),count:n})),unplaced};
}
/** The day strip above the list: one cell per day with the number of listed entries that touch it.
 * @param {any[]} events @param {number} now @param {string} l */
function dayStrip(events,now,l){
 const ko=l==='ko',{days,unplaced}=incidentDays(events,now,l),zone=ko?'KST':'UTC';
 const md=(/** @type {string} */ d)=>{const [,m,day]=d.split('-').map(Number);return ko?`${m}월 ${day}일`:`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${day}`;};
 const cell=(/** @type {{date:string,count:number}} */ d)=>html`<li class="ih-d${d.count?' on':''}"><span class="ih-b" aria-hidden="true">${d.count||''}</span><time class="ih-n" datetime="${d.date}" aria-hidden="true">${Number(d.date.slice(8))}</time><span class="sr-only">${md(d.date)}: ${d.count?(ko?`수집 기록 ${d.count}개`:`${d.count} collected ${d.count===1?'entry':'entries'}`):(ko?'수집된 기록 없음':'nothing collected')}</span></li>`;
 return html`<div class="ih-strip" data-incident-days><h3 id="ih-days-h">${ko?`날짜별 수집 기록 · ${md(days[0].date)} – ${md(days[days.length-1].date)} (${zone})`:`Collected entries by day · ${md(days[0].date)} – ${md(days[days.length-1].date)} (${zone})`}</h3>
<ol class="ih-days" aria-labelledby="ih-days-h">${days.map(cell)}</ol>
<p class="fine">${ko?'숫자가 있는 칸은 아래 목록의 기록 중 그날에 걸친 개수입니다(종료 시각이 없으면 시작일에만 표시). 빈 칸은 수집된 기록이 없다는 뜻이며, 그날 장애가 없었다는 뜻이 아닙니다.':'A numbered cell counts the entries listed below that touch that day (start day only when no end was recorded). An empty cell means nothing was collected, not that there was no incident that day.'}${unplaced?(ko?` 날짜를 특정할 수 없는 기록 ${unplaced}개는 넣지 않았습니다.`:` ${unplaced} ${unplaced===1?'entry':'entries'} without a usable date ${unplaced===1?'is':'are'} not placed.`):''}</p></div>`;
}

/** @param {any[]} events @param {string} l @param {number} [now] with a time, the day strip is drawn above the list */
export function renderIncidentHistory(events,l,now){
 const ko=l==='ko',strip=typeof now==='number'&&Number.isFinite(now)?dayStrip(events,now,l):'';
 return html`<section class="box pad" data-incident-history><h2>${ko?'최근 수집한 공식 이력':'Recently collected official history'}</h2><p class="fine">${ko?'최근 14일에 걸치는 수집 기록 중 최대 20개를 시작 시각 역순으로 표시합니다. 현재 작동 여부나 전체 장애 이력을 보장하지 않습니다. 최신 현황은 공식 출처에서 확인하세요.':'Up to 20 collected entries overlapping the last 14 days, newest start first. This does not establish current availability or a complete incident history. Check the official source for the latest state.'}</p>${strip}${events.length?html`<ol class="plist">${events.map(ev=>{
  const start=timestamp(ev.starts_at,ev.precision,l),end=timestamp(ev.ends_at,ev.precision,l);
  return html`<li class="pad"><h3>${ev.title[l]||ev.title.en||''}</h3><p class="fine">${start?html`${ko?'시작 기록':'Recorded start'}: ${start}`:(ko?'시작 시각 미기록':'Start time not recorded')}<br>${end?html`${ko?'종료 기록':'Recorded end'}: ${end}`:(ko?'종료 시각 미기록':'End time not recorded')}</p><p class="fine">${ev.status==='ended'?(ko?'수집 당시 상태: 종료됨':'Status at collection: ended'):(ko?'수집 당시 종료 여부 미확정':'End status unconfirmed at collection')}</p>${ev.url?html`<a href="${safeHref(ev.url)}" rel="noopener" target="_blank">${ko?'공식 원문':'Official source'} ↗</a>`:''}</li>`;
 })}</ol>`:html`<p>${ko?'표시할 수집 기록이 없습니다. 공식 출처에서 현재 상태를 확인하세요.':'No collected entries to display. Check the official source for current status.'}</p>`}</section>`;
}
