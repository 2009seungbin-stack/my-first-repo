// @ts-check
/** 운영 투명성 (/{l}/community/transparency): monthly counts of reports received and of moderation
 * actions by kind — aggregate only, no targets, reporters or moderators. The public side of the
 * 신고 → 임시조치 → 처리 기록 flow. */
import {html} from './html.js';
import {page,box} from './ui.js';

const ACTION=/** @type {Record<string,{ko:string,en:string}>} */({hide:{ko:'임시조치(숨김)',en:'Hidden'},unhide:{ko:'복구',en:'Restored'},dismiss:{ko:'기각',en:'Dismissed'},restrict:{ko:'이용 제한',en:'Restricted'},unrestrict:{ko:'제한 해제',en:'Unrestricted'}});
const REASON=/** @type {Record<string,{ko:string,en:string}>} */({spam:{ko:'스팸·도배',en:'Spam'},abuse:{ko:'욕설·혐오',en:'Abuse'},wrong_info:{ko:'틀린 정보',en:'Wrong info'},source_dispute:{ko:'출처 이의',en:'Source dispute'},copyright:{ko:'권리 침해',en:'Rights'},duplicate:{ko:'중복',en:'Duplicate'},other:{ko:'기타',en:'Other'}});

/** @param {any} db @param {{l:string,now:number,channels?:{name:string,href:string}[]}} o */
export async function loadTransparency(db,o){
 const since=o.now-365*864e5;
 const month="strftime('%Y-%m',created_at/1000,'unixepoch')";
 const flags=(await db.prepare(`SELECT ${month} AS m,reason,COUNT(*) AS n FROM content_flags WHERE created_at>=? GROUP BY 1,2`).bind(since).all()).results||[];
 const actions=(await db.prepare(`SELECT ${month} AS m,action,COUNT(*) AS n FROM moderation_actions WHERE created_at>=? GROUP BY 1,2`).bind(since).all()).results||[];
 const months=[...new Set([...flags,...actions].map((/** @type {any} */ r)=>String(r.m)))].sort().reverse();
 return {months,flags,actions,l:o.l,channels:o.channels||[]};
}
/** @param {Awaited<ReturnType<typeof loadTransparency>>} m @param {{origin:string}} site */
export function renderTransparency(m,site){
 const {l}=m,ko=l==='ko',base=`/${l}/community/transparency`;
 const sum=(/** @type {any[]} */ rows,/** @type {string} */ mo,/** @type {string} */ k,/** @type {string} */ v)=>rows.filter(r=>r.m===mo&&r[k]===v).reduce((a,r)=>a+Number(r.n),0);
 const table=m.months.length?html`<div class="tw"><table class="mt"><thead><tr><th>${ko?'월':'Month'}</th>${Object.values(REASON).map(r=>html`<th>${r[/** @type {'ko'|'en'} */(l)]}</th>`)}${Object.values(ACTION).map(a=>html`<th>${a[/** @type {'ko'|'en'} */(l)]}</th>`)}</tr></thead><tbody>
${m.months.map(mo=>html`<tr><td>${mo}</td>${Object.keys(REASON).map(k=>html`<td>${sum(m.flags,mo,'reason',k)}</td>`)}${Object.keys(ACTION).map(k=>html`<td>${sum(m.actions,mo,'action',k)}</td>`)}</tr>`)}</tbody></table></div>`:html`<p class="empty">${ko?'아직 접수된 신고가 없습니다.':'No reports yet.'}</p>`;
 const body=html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'운영 투명성':'Moderation transparency'}</h1></div>
<div class="pad desc">${ko?html`<p>신고가 들어오면 운영자가 확인해 <b>임시조치</b>(글을 가리고 보관), <b>복구</b>, <b>기각</b> 중 하나로 처리하고, 모든 처리는 사유와 함께 기록됩니다. 권리 침해 신고는 먼저 임시조치한 뒤 게시자에게 알립니다. 아래는 최근 12개월의 월별 합계이며, 대상·신고자·처리자는 공개하지 않습니다.</p>`:html`<p>Reports are reviewed and either hidden (kept, not shown), restored or dismissed; every action is logged with its reason. Monthly totals for the last 12 months below; targets, reporters and moderators are not published.</p>`}</div></section>
${box({title:ko?'월별 신고 사유와 처리':'Reports and actions by month'},table)}</div>`;
 return page({l,title:ko?'운영 투명성 — 신고와 처리 현황 | Nerulio':'Moderation transparency | Nerulio',description:ko?'Nerulio 게시판의 월별 신고 접수와 처리 현황.':'Monthly reports and moderation actions on Nerulio boards.',canonical:site.origin+base,channels:m.channels,body});
}
