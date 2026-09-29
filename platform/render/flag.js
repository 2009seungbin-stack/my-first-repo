// @ts-check
/** 신고 (/{l}/community/report?target=discussion:<id>): the report-to-moderators form required
 * before boards open (takedown / temporary-block requests, wrong information, spam). Submits to
 * /api/v2/flags through the islands; moderators resolve it in the admin console. */
import {html} from './html.js';
import {page} from './ui.js';
import {postPath} from '../channels.js';

/** 신고 사유 (server/platform/anon.js REPORT): the ones marked `now` hide the post or comment at once, until a
 * moderator checks it; the others hide it when 3 different people report it. */
export const FLAG_REASONS=Object.freeze({
 spam:{ko:'스팸·도배·광고',en:'Spam or ads'},
 abuse:{ko:'욕설·혐오·괴롭힘',en:'Abuse or harassment'},
 privacy:{ko:'개인정보 노출 (즉시 숨김)',en:'Personal information (hidden at once)',now:true},
 illegal_filming:{ko:'불법촬영물·동의 없는 사진 (즉시 숨김)',en:'Non-consensual intimate images (hidden at once)',now:true},
 csam:{ko:'아동·청소년 성착취물 (즉시 숨김)',en:'Child sexual abuse material (hidden at once)',now:true},
 sexual:{ko:'음란물',en:'Sexual content'},
 violence:{ko:'폭력·자해·위협',en:'Violence, self-harm or threats'},
 wrong_info:{ko:'틀린 정보',en:'Wrong information'},
 source_dispute:{ko:'출처 이의',en:'Source dispute'},
 copyright:{ko:'저작권·권리 침해 (임시조치 요청)',en:'Copyright or rights (takedown request)'},
 duplicate:{ko:'중복',en:'Duplicate'},
 other:{ko:'기타',en:'Other'}});
const TARGET=/^(discussion|comment|report|wiki_revision|fact|entity|user):[\w:.-]{1,100}$/;

/** What is being reported, so the reader can see it before sending (only public content is named).
 * @param {any} db @param {string|null} target @param {string} l
 * @returns {Promise<{kind:string,title:string,url:string}|null>} */
export async function loadFlagTarget(db,target,l){
 const m=target&&TARGET.exec(target)&&/^(discussion|comment):(.+)$/.exec(target);
 if(!m)return null;
 if(m[1]==='discussion'){
  const d=await db.prepare("SELECT d.title,d.channel_id,d.channel_no FROM discussions d WHERE d.id=? AND d.status IN ('published','locked')").bind(m[2]).first();
  return d?{kind:'discussion',title:String(d.title),url:postPath(l,String(d.channel_id),Number(d.channel_no))}:null;
 }
 const c=await db.prepare("SELECT c.id,c.body_md,d.channel_id,d.channel_no FROM comments c JOIN discussions d ON d.id=c.discussion_id WHERE c.id=? AND c.status='published' AND d.status IN ('published','locked')").bind(m[2]).first();
 return c?{kind:'comment',title:String(c.body_md).replace(/\s+/g,' ').slice(0,120),url:postPath(l,String(c.channel_id),Number(c.channel_no))+`#c-${c.id}`}:null;
}

/** @param {{l:string,target:string|null,about?:{kind:string,title:string,url:string}|null,channels?:{name:string,href:string}[]}} o @param {{origin:string}} site */
export function renderFlag(o,site){
 const {l}=o,ko=l==='ko',target=o.target&&TARGET.test(o.target)?o.target:null,about=o.about||null;
 const body=html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'신고하기':'Report content'}</h1></div>
${target&&about?html`<p class="ftarget"><span class="fine">${about.kind==='comment'?(ko?'신고할 댓글':'Comment'):(ko?'신고할 글':'Post')}</span> <a href="${about.url}">${about.title}</a></p>`:''}
${target?html`<form class="wform" data-island="flag-form" data-target="${target}" data-back="${about?.url||''}">
<label>${ko?'사유':'Reason'}<select name="reason" required><option value="" selected disabled>${ko?'사유를 선택하세요':'Choose a reason'}</option>${Object.entries(FLAG_REASONS).map(([k,v])=>html`<option value="${k}">${v[/** @type {'ko'|'en'} */(l)]}</option>`)}</select></label>
<label>${ko?'설명 (선택)':'Details (optional)'}<textarea name="note" maxlength="1000" placeholder="${ko?'권리 침해 신고는 원본 위치와 권리자임을 알 수 있는 정보를 적어 주세요.':'For rights claims, say where the original is and how you hold the rights.'}"></textarea></label>
<ul class="rules"><li>${ko?'로그인하지 않아도 신고할 수 있어요. 서로 다른 3명이 신고하면 운영자가 확인할 때까지 자동으로 숨겨집니다.':'You can report without an account. Content reported by 3 different people is hidden until a moderator checks it.'}</li><li>${ko?'개인정보 노출·불법촬영물·아동 성착취물은 신고 1건으로 즉시 숨겨지고 운영자에게 바로 알림이 갑니다. 불법 촬영물과 아동 성착취물은 확인 후 삭제하며 관계 기관에 신고할 수 있어요.':'Personal information, non-consensual intimate images and child sexual abuse material are hidden on the first report and the moderator is alerted at once; confirmed illegal material is deleted and may be reported to the authorities.'}</li><li>${ko?'권리 침해 신고가 접수되면 해당 글을 먼저 임시로 가리고(임시조치), 게시자에게 알린 뒤 처리 결과를 기록합니다.':'Rights claims hide the content first, notify the author and log the outcome.'}</li><li>${ko?'허위 신고가 반복되면 신고 기능이 제한될 수 있습니다.':'Repeated false reports may be restricted.'}</li></ul>
<div class="acts">${about?html`<a class="btn" href="${about.url}">${ko?'취소':'Cancel'}</a>`:''}<button class="btn p" type="submit" data-label="${ko?'신고':'Report'}">${ko?'신고':'Report'}</button></div></form>`:html`<p class="empty">${ko?'신고할 대상을 찾을 수 없습니다. 글이나 댓글의 “신고” 링크로 들어와 주세요.':'Open this form from a post or comment.'}</p>`}
</section></div>`;
 return page({l,title:ko?'신고하기 | Nerulio':'Report | Nerulio',description:ko?'게시물 신고':'Report content',canonical:site.origin+`/${l}/community/report`,noindex:true,channels:o.channels||[],body});
}
export {TARGET as FLAG_TARGET};
