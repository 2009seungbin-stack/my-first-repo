// @ts-check
/** Write page (/{l}/{vertical}/{slug}/write): 말머리, title, body; on channels that have
 * compatibility subjects (a game's Korean patches, an app's plugins) the 리포트 tag turns into a
 * structured report (ProtonDB-style: what, which versions, result, setup), which feeds the
 * community verdict instead of being a free-text post. The form works through the islands. */
import {html} from './html.js';
import {t} from './strings.js';
import {page,nameOf,channelUrl,signInUrl} from './ui.js';
import {anonFields} from './post.js';
import {related,versionsOf} from '../db/channel.js';
import {POST_KINDS,writableKinds,LIMITS,boardOpen} from '../community.js';

/** @param {any} db @param {import('../db/channel.js').Entity} entity @param {{l:string,kind?:string|null,result?:string|null,channels?:{name:string,href:string}[]}} o */
export async function loadWrite(db,entity,o){
 // Report subjects: patches that translate this game, plugins hosted by this app.
 /** @type {import('../db/channel.js').Entity[]} */let subjects=[];
 if(entity.type==='game')subjects=(await related(db,entity.id,'in',['translates'])).map(r=>r.entity);
 else if(entity.type==='app')subjects=(await related(db,entity.id,'in',['supports_host'])).map(r=>r.entity).slice(0,80);
 const versions=subjects.length?(await versionsOf(db,entity.id,8)).map(v=>v.version):[];
 // Each patch's latest known version, filled in when it is picked (games have a few patches).
 /** @type {Record<string,string>} */const subjectVersion={};
 for(const x of subjects.slice(0,10)){const v=(await versionsOf(db,x.id,1))[0];if(v)subjectVersion[x.id]=v.version;}
 return {entity,subjects,versions,subjectVersion,result:['works','works_with_issues','broken'].includes(String(o.result))?String(o.result):'works',l:o.l,kind:o.kind&&Object.prototype.hasOwnProperty.call(POST_KINDS,o.kind)?o.kind:null,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadWrite>>} m @param {{origin:string}} site */
export function renderWrite(m,site){
 const {entity:e,l}=m,s=t(l),ko=l==='ko';
 const name=nameOf(e,l),base=channelUrl(l,e);
 const kinds=writableKinds(e.vertical);
 const chosen=m.kind&&kinds.includes(m.kind)?m.kind:(kinds.includes('question')?'question':kinds[0]);
 const rep=m.subjects.length?html`<fieldset class="repf"><legend>${ko?'구조화 리포트 (호환 여부)':'Structured report (compatibility)'}</legend>
<input type="hidden" name="targetId" value="${e.id}">
<div class="row"><label>${e.type==='game'?(ko?'한글패치':'Korean patch'):(ko?'플러그인':'Plugin')}<select name="subjectId" required>${m.subjects.map(x=>html`<option value="${x.id}" data-v="${m.subjectVersion[x.id]||''}">${nameOf(x,l)}</option>`)}</select></label>
<label>${ko?'패치/플러그인 버전':'Patch/plugin version'}<input name="subjectVersion" maxlength="${LIMITS.version}" value="${m.subjects[0]?m.subjectVersion[m.subjects[0].id]||'':''}" placeholder="${ko?'예: 1.7':'e.g. 1.7'}"></label>
<label>${e.type==='game'?(ko?'게임 버전':'Game version'):(ko?'앱 버전':'App version')}<input name="targetVersion" maxlength="${LIMITS.version}" list="tv" value="${m.versions[0]||''}" placeholder="${m.versions[0]||''}"><datalist id="tv">${m.versions.map(v=>html`<option value="${v}"></option>`)}</datalist></label></div>
<div class="row"><label>${ko?'결과':'Result'}<select name="result" required><option value="works"${m.result==='works'?' selected':''}>${ko?'✓ 작동':'✓ Works'}</option><option value="works_with_issues"${m.result==='works_with_issues'?' selected':''}>${ko?'◐ 일부 문제':'◐ Works with issues'}</option><option value="broken"${m.result==='broken'?' selected':''}>${ko?'✕ 안 됨':'✕ Broken'}</option></select></label>
<label>${ko?'OS':'OS'}<input name="env_os" maxlength="60" placeholder="${ko?'예: Windows 11 24H2':'e.g. Windows 11 24H2'}"></label>
<label>${ko?'기기':'Device'}<input name="env_device" maxlength="60" placeholder="${ko?'예: Steam Deck, RTX 4070':'e.g. Steam Deck'}"></label></div>
<p class="fine">${ko?'같은 조합에 리포트가 3명 이상 모이고 반대가 적으면 ● 커뮤니티 검증으로 바뀝니다. 패치 파일은 올리지 말고 제작자 배포처를 안내해 주세요.':'With 3+ independent reports and few contradictions the combination becomes ● community verified. Do not upload patch files; link to the author.'}</p></fieldset>`:'';
 // Boards not open yet (OPEN_BOARDS): say so instead of a form that would be refused.
 const closed=!boardOpen(e)?html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'게시판 준비 중':'Board opens later'}</h1></div><p class="empty">${ko?`${name} 채널 게시판은 아직 열지 않았어요. 지금은 AI, 한글패치, GPU 채널 게시판부터 운영합니다. 정보와 변경 기록, 원클릭 리포트는 계속 쓸 수 있어요.`:`This board opens later; AI, Korean-patch and GPU channels come first.`}</p><p class="pad"><a class="btn" href="${base}">${ko?'채널로 돌아가기':'Back to the channel'}</a></p></section></div>`:null;
 const body=closed||html`<div class="crumb"><a class="chl" href="${base}">${s.channel(name)}</a><span class="sp"></span><a class="btn" href="${base}">${s.list}</a></div>
<section class="box"><div class="bh"><h1 class="wt">${ko?`${name} 채널에 글쓰기`:`Write in ${name}`}</h1></div>
<form class="wform" data-island="write-form" data-entity="${e.id}">
<p class="needlogin" hidden>${ko?'글을 등록하려면 로그인이 필요합니다. 쓰던 내용은 이 브라우저에 임시저장되어 로그인 후에도 남아 있어요.':'Sign in to post.'} <a href="${signInUrl(base+'write')}" rel="nofollow" data-signin>${s.login} ›</a></p>
${anonFields(l,base+'write')}
<div class="row"><label>${ko?'말머리':'Tag'}<select name="kind">${kinds.map(k=>html`<option value="${k}"${k===chosen?html` selected`:''}>${/** @type {any} */(s.kind)[k]}</option>`)}</select></label></div>
${rep}
<label>${ko?'제목':'Title'}<input name="title" maxlength="${LIMITS.title[1]}" minlength="${LIMITS.title[0]}" required autocomplete="off"></label>
<label>${ko?'본문':'Body'}<textarea name="body" maxlength="${LIMITS.body[1]}" placeholder="${ko?'마크다운 일부 지원: **굵게**, `코드`, 목록, 링크.':'Markdown: **bold**, `code`, lists, links.'}"></textarea></label>
<div class="imgpick" data-image-picker hidden><div class="imgbar"><label class="btn"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif" multiple hidden data-image-input>${ko?'📷 이미지 추가':'📷 Add images'}</label><span class="fine">${ko?'최대 10장 · 올리기 전에 이 기기에서 크기를 줄이고 위치 정보(EXIF)를 지웁니다 · 움짤(GIF)은 첫 장면만 올라가요':'Up to 10 · resized on this device and location data (EXIF) removed before upload · a GIF becomes a still image'}</span></div><ul class="imgs" data-image-list></ul></div>
<ul class="rules"><li><a href="/${l}/community/policy">${ko?'게시판 운영정책':'Community rules'}</a></li><li>${ko?'공식 정보는 출처 링크와 함께 적어 주세요. 공식 수치는 위키 값이 우선합니다.':'Link sources for official information.'}</li><li>${ko?`${s.bestRule}`:s.bestRule}</li><li>${ko?'욕설·도배·불법 파일 공유는 숨김 처리됩니다. 불법촬영물·아동 성착취물은 즉시 삭제하고 관계 기관에 신고할 수 있어요.':'Abuse, spam and illegal file sharing are hidden. Illegal intimate images and child sexual abuse material are removed at once and may be reported to the authorities.'}</li></ul>
<div class="acts"><a class="btn" href="${base}">${ko?'취소':'Cancel'}</a><button class="btn p" type="submit" data-label="${ko?'등록':'Post'}">${ko?'등록':'Post'}</button></div>
</form></section>`;
 return page({l,title:ko?`글쓰기 - ${name} 채널 | Nerulio`:`Write - ${name} | Nerulio`,description:ko?`${name} 채널에 글을 씁니다.`:`Write a post in ${name}.`,canonical:site.origin+base+'write',noindex:true,
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:{name,id:e.id},body});
}
