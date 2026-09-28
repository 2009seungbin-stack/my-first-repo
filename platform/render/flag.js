// @ts-check
/** 신고 (/{l}/community/report?target=discussion:<id>): the report-to-moderators form required
 * before boards open (takedown / temporary-block requests, wrong information, spam). Submits to
 * /api/v2/flags through the islands; moderators resolve it in the admin console. */
import {html} from './html.js';
import {page,postUrl} from './ui.js';

export const FLAG_REASONS=Object.freeze({spam:{ko:'스팸·도배',en:'Spam'},abuse:{ko:'욕설·혐오·괴롭힘',en:'Abuse or harassment'},wrong_info:{ko:'틀린 정보',en:'Wrong information'},source_dispute:{ko:'출처 이의',en:'Source dispute'},copyright:{ko:'저작권·권리 침해 (임시조치 요청)',en:'Copyright or rights (takedown request)'},duplicate:{ko:'중복',en:'Duplicate'},other:{ko:'기타',en:'Other'}});
const TARGET=/^(discussion|comment|report|wiki_revision|fact|entity|user):[\w:.-]{1,100}$/;

/** What is being reported, so the reader can see it before sending (only public content is named).
 * @param {any} db @param {string|null} target @param {string} l
 * @returns {Promise<{kind:string,title:string,url:string}|null>} */
export async function loadFlagTarget(db,target,l){
 const m=target&&TARGET.exec(target)&&/^(discussion|comment):(.+)$/.exec(target);
 if(!m)return null;
 if(m[1]==='discussion'){
  const d=await db.prepare("SELECT d.title,d.post_no,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=? AND d.status IN ('published','locked')").bind(m[2]).first();
  return d?{kind:'discussion',title:String(d.title),url:postUrl(l,{vertical:String(d.vertical),slug:String(d.slug)},Number(d.post_no))}:null;
 }
 const c=await db.prepare("SELECT c.id,c.body_md,d.post_no,e.vertical,e.slug FROM comments c JOIN discussions d ON d.id=c.discussion_id JOIN entities e ON e.id=d.entity_id WHERE c.id=? AND c.status='published' AND d.status IN ('published','locked')").bind(m[2]).first();
 return c?{kind:'comment',title:String(c.body_md).replace(/\s+/g,' ').slice(0,120),url:postUrl(l,{vertical:String(c.vertical),slug:String(c.slug)},Number(c.post_no))+`#c-${c.id}`}:null;
}

/** @param {{l:string,target:string|null,about?:{kind:string,title:string,url:string}|null,channels?:{name:string,href:string}[]}} o @param {{origin:string}} site */
export function renderFlag(o,site){
 const {l}=o,ko=l==='ko',target=o.target&&TARGET.test(o.target)?o.target:null,about=o.about||null;
 const body=html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'신고하기':'Report content'}</h1></div>
${target&&about?html`<p class="ftarget"><span class="fine">${about.kind==='comment'?(ko?'신고할 댓글':'Comment'):(ko?'신고할 글':'Post')}</span> <a href="${about.url}">${about.title}</a></p>`:''}
${target?html`<form class="wform" data-island="flag-form" data-target="${target}" data-back="${about?.url||''}">
<label>${ko?'사유':'Reason'}<select name="reason" required><option value="" selected disabled>${ko?'사유를 선택하세요':'Choose a reason'}</option>${Object.entries(FLAG_REASONS).map(([k,v])=>html`<option value="${k}">${v[/** @type {'ko'|'en'} */(l)]}</option>`)}</select></label>
<label>${ko?'설명 (선택)':'Details (optional)'}<textarea name="note" maxlength="1000" placeholder="${ko?'권리 침해 신고는 원본 위치와 권리자임을 알 수 있는 정보를 적어 주세요.':'For rights claims, say where the original is and how you hold the rights.'}"></textarea></label>
<ul class="rules"><li>${ko?'권리 침해 신고가 접수되면 해당 글을 먼저 임시로 가리고(임시조치), 게시자에게 알린 뒤 처리 결과를 기록합니다.':'Rights claims hide the content first, notify the author and log the outcome.'}</li><li>${ko?'허위 신고가 반복되면 신고 기능이 제한될 수 있습니다.':'Repeated false reports may be restricted.'}</li></ul>
<div class="acts">${about?html`<a class="btn" href="${about.url}">${ko?'취소':'Cancel'}</a>`:''}<button class="btn p" type="submit" data-label="${ko?'신고':'Report'}">${ko?'신고':'Report'}</button></div></form>`:html`<p class="empty">${ko?'신고할 대상을 찾을 수 없습니다. 글이나 댓글의 “신고” 링크로 들어와 주세요.':'Open this form from a post or comment.'}</p>`}
</section></div>`;
 return page({l,title:ko?'신고하기 | Nerulio':'Report | Nerulio',description:ko?'게시물 신고':'Report content',canonical:site.origin+`/${l}/community/report`,noindex:true,channels:o.channels||[],body});
}
export {TARGET as FLAG_TARGET};
