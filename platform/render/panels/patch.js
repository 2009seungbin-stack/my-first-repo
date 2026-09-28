// @ts-check
/** Korean translation patch channel: which game versions it is known to work on (newest first,
 * with the game's current version marked and flagged when nobody has re-checked since an update),
 * the author, and where to get it — Nerulio links to the author and never hosts patch files. */
import {html,safeHref} from '../html.js';
import {box,badge,nameOf,channelUrl} from '../ui.js';
import {related,compatibilityOf,versionsOf,pickFact} from '../../db/channel.js';
import {COMPAT_STATUS_LABEL,label} from '../../labels.js';
import {factRows} from './generic.js';

/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e}=ctx;
 const game=(await related(db,e.id,'out',['translates']))[0]?.entity||null;
 const compat=(await compatibilityOf(db,{subject:e.id})).filter(c=>!game||c.target_id===game.id);
 const current=game?(await versionsOf(db,game.id,1))[0]||null:null;
 return {game,compat,current};
}
const CLS=/** @type {Record<string,string>} */({supported:'c',works:'c',works_with_issues:'u',broken:'d',unsupported:'d',unverified_after_update:'u',unknown:'u'});
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l,facts,entity:e}=ctx,ko=l==='ko';
 const v=pickFact(facts,'patch_version'),author=pickFact(facts,'author_name'),home=pickFact(facts,'homepage'),verified=pickFact(facts,'verified_game_version');
 const rows=[...d.compat].sort((a,b)=>a.target_version==='*'?1:b.target_version==='*'?-1:b.target_version.localeCompare(a.target_version,undefined,{numeric:true}));
 const cur=d.current?.version;
 const onCurrent=cur?rows.find(r=>r.target_version===cur):null;
 const info=box({title:ko?'패치 정보':'Patch',extra:badge('COMMUNITY',l)},html`<div class="kv pad">${v?html`<span class="big">${v.value}</span>`:html`<span class="fine">${ko?'패치 버전 정보 없음':'Patch version unknown'}</span>`}<span class="fine">${author?`${ko?'제작자':'Author'} ${author.value}`:''}${verified?` · ${ko?'제작자가 밝힌 대응 버전':'author-stated game version'} ${verified.value}`:''}</span>
${home?html`<a class="btn p" href="${safeHref(home.value)}" rel="noopener nofollow" target="_blank">${ko?'제작자 배포처로 이동 ↗':'Go to the author’s page ↗'}</a><span class="fine">${ko?'Nerulio는 패치 파일을 올리거나 보관하지 않습니다.':'Nerulio does not host patch files.'}</span>`:''}</div>`);
 const game=d.game?box({title:d.game?(ko?`${nameOf(d.game,l)} 버전별 호환`:`Compatibility by ${nameOf(d.game,l)} version`):'',note:cur?(ko?`현재 게임 버전 ${cur}`:`Current game version ${cur}`):''},html`${cur&&!onCurrent?html`<p class="alert">${rows.some(r=>r.target_version!=='*')?(ko?`게임이 ${cur}로 업데이트된 뒤 아직 아무도 확인하지 않았습니다. 해 보셨다면 결과를 남겨 주세요.`:`Nobody has re-checked the patch since the game updated to ${cur}. Tried it? Leave a result.`):(ko?`현재 버전 ${cur}에서 확인한 리포트가 아직 없습니다. 해 보셨다면 결과를 남겨 주세요.`:`No report on the current version ${cur} yet. Tried it? Leave a result.`)} <a href="${channelUrl(l,d.game)}write?kind=report">${ko?'리포트 쓰기 ›':'Report ›'}</a></p>`:''}
${rows.length?html`<ul class="rows">${rows.map(r=>html`<li><span class="tt">${r.target_version==='*'?(ko?'버전 무관':'any version'):r.target_version}${r.target_version===cur?html` <span class="st new">${ko?'현재':'current'}</span>`:''}${r.subject_version&&r.subject_version!=='*'?html` <span class="fine">${ko?'패치':'patch'} ${r.subject_version}</span>`:''}</span><span class="st ${CLS[r.status]||'u'}" title="${r.note||''}">${label(/** @type {any} */(COMPAT_STATUS_LABEL)[r.status],l)}</span>${r.confirmations?html`<span class="fine">${ko?`확인 ${r.confirmations}명`:`${r.confirmations} confirmed`}</span>`:''}${r.verification!=='COMMUNITY'?badge(r.verification,l):''}</li>`)}</ul>`:html`<p class="empty">${ko?'아직 호환 리포트가 없습니다.':'No compatibility reports yet.'}</p>`}`):'';
 return html`<div class="g2 a">${info}${game}</div>`;
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function wiki(d,ctx){
 const {l}=ctx;
 return html`<table class="wk"><tbody>${d.game?html`<tr><th>${l==='ko'?'게임':'Game'}</th><td><a href="${channelUrl(l,d.game)}">${nameOf(d.game,l)}</a></td></tr>`:''}${factRows(ctx)}</tbody></table>`;
}
/** @type {import('./index.js').Panel} */
export default {id:'patch',types:['games:translation_patch'],load,top,wiki};
