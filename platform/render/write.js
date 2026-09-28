// @ts-check
/** Write page (/{l}/{vertical}/{slug}/write): 말머리, title, body; on channels that have
 * compatibility subjects (a game's Korean patches, an app's plugins) the 리포트 tag turns into a
 * structured report (ProtonDB-style: what, which versions, result, setup), which feeds the
 * community verdict instead of being a free-text post. The form works through the islands. */
import {html} from './html.js';
import {t} from './strings.js';
import {page,nameOf,channelUrl,signInUrl} from './ui.js';
import {related,versionsOf} from '../db/channel.js';
import {POST_KINDS,writableKinds,LIMITS} from '../community.js';

/** @param {any} db @param {import('../db/channel.js').Entity} entity @param {{l:string,kind?:string|null,channels?:{name:string,href:string}[]}} o */
export async function loadWrite(db,entity,o){
 // Report subjects: patches that translate this game, plugins hosted by this app.
 /** @type {import('../db/channel.js').Entity[]} */let subjects=[];
 if(entity.type==='game')subjects=(await related(db,entity.id,'in',['translates'])).map(r=>r.entity);
 else if(entity.type==='app')subjects=(await related(db,entity.id,'in',['supports_host'])).map(r=>r.entity).slice(0,80);
 const versions=subjects.length?(await versionsOf(db,entity.id,8)).map(v=>v.version):[];
 return {entity,subjects,versions,l:o.l,kind:o.kind&&Object.prototype.hasOwnProperty.call(POST_KINDS,o.kind)?o.kind:null,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadWrite>>} m @param {{origin:string}} site */
export function renderWrite(m,site){
 const {entity:e,l}=m,s=t(l),ko=l==='ko';
 const name=nameOf(e,l),base=channelUrl(l,e);
 const kinds=writableKinds(e.vertical);
 const chosen=m.kind&&kinds.includes(m.kind)?m.kind:(kinds.includes('question')?'question':kinds[0]);
 const rep=m.subjects.length?html`<fieldset class="repf"><legend>${ko?'구조화 리포트 (호환 여부)':'Structured report (compatibility)'}</legend>
<input type="hidden" name="targetId" value="${e.id}">
<div class="row"><label>${e.type==='game'?(ko?'한글패치':'Korean patch'):(ko?'플러그인':'Plugin')}<select name="subjectId" required>${m.subjects.map(x=>html`<option value="${x.id}">${nameOf(x,l)}</option>`)}</select></label>
<label>${ko?'패치/플러그인 버전':'Patch/plugin version'}<input name="subjectVersion" maxlength="${LIMITS.version}" placeholder="${ko?'예: 1.7':'e.g. 1.7'}"></label>
<label>${e.type==='game'?(ko?'게임 버전':'Game version'):(ko?'앱 버전':'App version')}<input name="targetVersion" maxlength="${LIMITS.version}" list="tv" placeholder="${m.versions[0]||''}"><datalist id="tv">${m.versions.map(v=>html`<option value="${v}"></option>`)}</datalist></label></div>
<div class="row"><label>${ko?'결과':'Result'}<select name="result" required><option value="works">${ko?'✓ 작동':'✓ Works'}</option><option value="works_with_issues">${ko?'◐ 일부 문제':'◐ Works with issues'}</option><option value="broken">${ko?'✕ 안 됨':'✕ Broken'}</option></select></label>
<label>${ko?'OS':'OS'}<input name="env_os" maxlength="60" placeholder="${ko?'예: Windows 11 24H2':'e.g. Windows 11 24H2'}"></label>
<label>${ko?'기기':'Device'}<input name="env_device" maxlength="60" placeholder="${ko?'예: Steam Deck, RTX 4070':'e.g. Steam Deck'}"></label></div>
<p class="fine">${ko?'같은 조합에 리포트가 3명 이상 모이고 반대가 적으면 ● 커뮤니티 검증으로 바뀝니다. 패치 파일은 올리지 말고 제작자 배포처를 안내해 주세요.':'With 3+ independent reports and few contradictions the combination becomes ● community verified. Do not upload patch files; link to the author.'}</p></fieldset>`:'';
 const body=html`<div class="crumb"><a class="chl" href="${base}">${s.channel(name)}</a><span class="sp"></span><a class="btn" href="${base}">${s.list}</a></div>
<section class="box"><div class="bh"><h1 class="wt">${ko?`${name} 채널에 글쓰기`:`Write in ${name}`}</h1></div>
<form class="wform" data-island="write-form" data-entity="${e.id}">
<p class="needlogin" hidden>${ko?'글을 등록하려면 로그인이 필요합니다. 작성한 내용은 로그인 후 다시 입력해야 할 수 있어요.':'Sign in to post.'} <a href="${signInUrl(base+'write')}" rel="nofollow">${s.login} ›</a></p>
<div class="row"><label>${ko?'말머리':'Tag'}<select name="kind">${kinds.map(k=>html`<option value="${k}"${k===chosen?html` selected`:''}>${/** @type {any} */(s.kind)[k]}</option>`)}</select></label></div>
${rep}
<label>${ko?'제목':'Title'}<input name="title" maxlength="${LIMITS.title[1]}" minlength="${LIMITS.title[0]}" required autocomplete="off"></label>
<label>${ko?'본문':'Body'}<textarea name="body" maxlength="${LIMITS.body[1]}" placeholder="${ko?'마크다운 일부 지원: **굵게**, `코드`, 목록, 링크. 이미지 업로드는 준비 중입니다.':'Markdown: **bold**, `code`, lists, links.'}"></textarea></label>
<ul class="rules"><li><a href="/${l}/community/policy">${ko?'게시판 운영정책':'Community rules'}</a></li><li>${ko?'공식 정보는 출처 링크와 함께 적어 주세요. 공식 수치는 위키 값이 우선합니다.':'Link sources for official information.'}</li><li>${ko?`${s.bestRule}`:s.bestRule}</li><li>${ko?'욕설·도배·불법 파일 공유는 숨김 처리됩니다.':'Abuse, spam and illegal file sharing are hidden.'}</li></ul>
<div class="acts"><a class="btn" href="${base}">${ko?'취소':'Cancel'}</a><button class="btn p" type="submit" data-label="${ko?'등록':'Post'}">${ko?'등록':'Post'}</button></div>
</form></section>`;
 return page({l,title:ko?`글쓰기 - ${name} 채널 | Nerulio`:`Write - ${name} | Nerulio`,description:ko?`${name} 채널에 글을 씁니다.`:`Write a post in ${name}.`,canonical:site.origin+base+'write',noindex:true,
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:{name,id:e.id},body});
}
