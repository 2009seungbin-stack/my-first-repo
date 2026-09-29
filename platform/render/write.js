// @ts-check
/** Write page (/{l}/community/{channel}/write?tag=&kind=): the channel, its 말머리, 0–3 tags (from an
 * entity page the channel and tag come picked), then nickname/password without an account, title, body and
 * images. On a game or an app tag the 리포트/호환 말머리 turns into a structured report (ProtonDB-style:
 * what, which versions, result, setup), which feeds the community verdict. The islands send the form. */
import {html} from './html.js';
import {t} from './strings.js';
import {page,nameOf,signInUrl} from './ui.js';
import {anonFields} from './post.js';
import {related,versionsOf,entitiesByIds,popularTags} from '../db/channel.js';
import {LIMITS} from '../community.js';
import {CHANNELS,channelById,channelPath,writePath,writableFlairs,flairLabel,FEATURED_TAGS,TAG_LIMIT} from '../channels.js';
import {verticalOf} from '../verticals/index.js';
import {label} from '../labels.js';

/** @param {any} db @param {{l:string,now:number,channel:string,tag?:string|null,kind?:string|null,result?:string|null,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadWrite(db,o){
 const ch=/** @type {import('../channels.js').Channel} */(channelById(o.channel));
 const tag=o.tag?(await entitiesByIds(db,[o.tag])).get(o.tag)||null:null;
 // Report subjects: patches that translate this game, plugins hosted by this app.
 /** @type {import('../db/channel.js').Entity[]} */let subjects=[];
 if(tag?.type==='game')subjects=(await related(db,tag.id,'in',['translates'])).map(r=>r.entity);
 else if(tag?.type==='app')subjects=(await related(db,tag.id,'in',['supports_host'])).map(r=>r.entity).slice(0,80);
 const versions=subjects.length&&tag?(await versionsOf(db,tag.id,8)).map(v=>v.version):[];
 /** @type {Record<string,string>} */const subjectVersion={};
 for(const x of subjects.slice(0,10)){const v=(await versionsOf(db,x.id,1))[0];if(v)subjectVersion[x.id]=v.version;}
 // Suggested tags: the channel's most used lately, topped up with its featured ones.
 const used=(await popularTags(db,{channel:ch.id,since:o.now-30*864e5,limit:8})).map(r=>r.entity);
 const ids=new Set(used.map(e=>e.id));
 const featured=[...(await entitiesByIds(db,(FEATURED_TAGS[ch.id]||[]).filter(id=>!ids.has(id)))).values()];
 const suggest=[...used,...featured].filter(e=>e.id!==tag?.id).slice(0,8);
 return {ch,tag,subjects,versions,subjectVersion,suggest,result:['works','works_with_issues','broken'].includes(String(o.result))?String(o.result):'works',l:o.l,
  kind:o.kind&&ch.flairs.includes(o.kind)?o.kind:null,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadWrite>>} m @param {{origin:string}} site */
export function renderWrite(m,site){
 const {ch,tag,l}=m,s=t(l),ko=l==='ko',lang=ko?'ko':'en';
 const name=ch.names[lang],base=channelPath(l,ch.id),self=writePath(l,ch.id,{tag:tag?.id||null,kind:m.kind});
 const kinds=writableFlairs(ch.id);
 const chosen=m.kind&&kinds.includes(m.kind)?m.kind:(kinds.includes('question')?'question':kinds[0]);
 const vname=(/** @type {string} */ v)=>{const x=verticalOf(v);return x?label(x.label,l):'';};
 const rep=m.subjects.length&&tag?html`<fieldset class="repf" data-report-fields><legend>${ko?'구조화 리포트 (호환 여부)':'Structured report (compatibility)'}</legend>
<input type="hidden" name="targetId" value="${tag.id}">
<div class="row"><label>${tag.type==='game'?(ko?'한글패치':'Korean patch'):(ko?'플러그인':'Plugin')}<select name="subjectId" required>${m.subjects.map(x=>html`<option value="${x.id}" data-v="${m.subjectVersion[x.id]||''}">${nameOf(x,l)}</option>`)}</select></label>
<label>${ko?'패치/플러그인 버전':'Patch/plugin version'}<input name="subjectVersion" maxlength="${LIMITS.version}" value="${m.subjects[0]?m.subjectVersion[m.subjects[0].id]||'':''}" placeholder="${ko?'예: 1.7':'e.g. 1.7'}"></label>
<label>${tag.type==='game'?(ko?'게임 버전':'Game version'):(ko?'앱 버전':'App version')}<input name="targetVersion" maxlength="${LIMITS.version}" list="tv" value="${m.versions[0]||''}" placeholder="${m.versions[0]||''}"><datalist id="tv">${m.versions.map(v=>html`<option value="${v}"></option>`)}</datalist></label></div>
<div class="row"><label>${ko?'결과':'Result'}<select name="result" required><option value="works"${m.result==='works'?' selected':''}>${ko?'✓ 작동':'✓ Works'}</option><option value="works_with_issues"${m.result==='works_with_issues'?' selected':''}>${ko?'◐ 일부 문제':'◐ Works with issues'}</option><option value="broken"${m.result==='broken'?' selected':''}>${ko?'✕ 안 됨':'✕ Broken'}</option></select></label>
<label>${ko?'OS':'OS'}<input name="env_os" maxlength="60" placeholder="${ko?'예: Windows 11 24H2':'e.g. Windows 11 24H2'}"></label>
<label>${ko?'기기':'Device'}<input name="env_device" maxlength="60" placeholder="${ko?'예: Steam Deck, RTX 4070':'e.g. Steam Deck'}"></label></div>
<p class="fine">${ko?'같은 조합에 리포트가 3명 이상 모이고 반대가 적으면 ● 커뮤니티 검증으로 바뀝니다. 패치 파일은 올리지 말고 제작자 배포처를 안내해 주세요.':'With 3+ independent reports and few contradictions the combination becomes ● community verified. Do not upload patch files; link to the author.'}</p></fieldset>`:'';
 const from=tag?html`<p class="wfrom"><b>${nameOf(tag,l)}</b> ${ko?`페이지에서 왔어요. 채널(${name})과 태그(${nameOf(tag,l)})를 미리 골라 뒀어요. 바꿔도 돼요.`:`— the channel (${name}) and the tag are picked for you. Change them if you like.`}</p>`:'';
 const channels=html`<fieldset class="wsec"><legend>${ko?'채널':'Channel'}</legend><div class="chips">${CHANNELS.filter(c=>c.inBar||c.id==='notice').map(c=>html`<a class="wchip${c.id===ch.id?' on':''}" href="${writePath(l,c.id,{tag:tag?.id||null})}"${c.id===ch.id?html` aria-current="page"`:''} data-channel-link="${c.id}">${c.names[lang]}</a>`)}</div></fieldset>`;
 const flairs=html`<fieldset class="wsec"><legend>${ko?'말머리':'Flair'} <span class="fine">${ko?`${name} 채널 말머리`:`${name} flairs`}</span></legend><div class="chips">${kinds.map(k=>html`<label class="wchip r"><input type="radio" name="kind" value="${k}"${k===chosen?html` checked`:''}><span>${flairLabel(ch.id,k,l)}</span></label>`)}</div></fieldset>`;
 const tags=html`<fieldset class="wsec" data-tag-picker data-limit="${TAG_LIMIT}"><legend>${ko?'태그':'Tags'} <span class="fine">${ko?`최대 ${TAG_LIMIT}개`:`up to ${TAG_LIMIT}`}</span> <span class="tcount" data-tag-count>${tag?1:0}/${TAG_LIMIT}</span></legend>
<div class="chips" data-tag-selected>${tag?html`<span class="wtag"><input type="hidden" name="tags" value="${tag.id}">${nameOf(tag,l)}<button type="button" data-tag-remove aria-label="${ko?'태그 빼기':'Remove tag'}">×</button></span>`:''}</div>
<div class="tsearch" hidden data-tag-search-wrap><input type="search" data-tag-search placeholder="${ko?'태그 검색 — 예: 클로드, 5070, 발더스':'Search tags — e.g. Claude, 5070'}" aria-label="${ko?'태그 검색':'Search tags'}" autocomplete="off"><ul class="shr" data-tag-results hidden></ul></div>
${m.suggest.length?html`<div class="tsug"><span class="fine">${ko?'추천 태그 · 다른 분야 태그도 달 수 있어요':'Suggested · tags from other areas work too'}</span><div class="chips">${m.suggest.map(e=>html`<button type="button" class="wchip add" data-add-tag="${e.id}" data-name="${nameOf(e,l)}">+ ${nameOf(e,l)}<span class="fine"> · ${vname(e.vertical)}</span></button>`)}</div></div>`:''}
<p class="fine" data-tag-line>${tag?(ko?`${nameOf(tag,l)} 태그 페이지에도 보여요.`:`Also shows on the ${nameOf(tag,l)} page.`):(ko?'태그 없이도 등록돼요. 달면 그 대상 페이지에도 보여요.':'Tags are optional; a tagged post also shows on that page.')}</p>
${ch.vertical?html`<details class="tprop" data-island="tag-propose" data-channel="${ch.id}"><summary>${ko?'찾는 태그가 없나요? 새 태그 제안 (고정닉)':'Missing a tag? Propose one (members)'}</summary><div class="row"><label>${ko?'태그 이름':'Tag name'}<input name="proposeName" maxlength="60" autocomplete="off"></label><label>${ko?'출처 링크 (공식 페이지)':'Source link (official page)'}<input name="proposeUrl" type="url" maxlength="300" placeholder="https://"></label></div><label>${ko?'메모':'Note'}<input name="proposeNote" maxlength="300"></label><p class="fine">${ko?'로그인한 회원만 제안할 수 있고, 운영자가 확인한 뒤 태그로 추가돼요.':'Members only; the owner reviews each proposal.'}</p><button type="button" class="btn" data-propose-send>${ko?'제안 보내기':'Send proposal'}</button><p class="fine" data-propose-status role="status"></p></details>`:''}</fieldset>`;
 const body=html`<div class="crumb"><a class="chl" href="${base}">${s.channel(name)}</a><span class="sp"></span><a class="btn" href="${base}">${s.list}</a></div>
<section class="box"><div class="bh"><h1 class="wt">${ko?`${name} 채널에 글쓰기`:`Write in ${name}`}</h1></div>${from}
<form class="wform" data-island="write-form" data-channel="${ch.id}">
<p class="needlogin" hidden>${ko?'글을 등록하려면 로그인이 필요합니다. 쓰던 내용은 이 브라우저에 임시저장되어 로그인 후에도 남아 있어요.':'Sign in to post.'} <a href="${signInUrl(self)}" rel="nofollow" data-signin>${s.login} ›</a></p>
${channels}${flairs}${tags}
${anonFields(l,self)}
${rep}
<label>${ko?'제목':'Title'}<input name="title" maxlength="${LIMITS.title[1]}" minlength="${LIMITS.title[0]}" required autocomplete="off"></label>
<label>${ko?'본문':'Body'}<textarea name="body" maxlength="${LIMITS.body[1]}" placeholder="${ko?'마크다운 일부 지원: **굵게**, `코드`, 목록, 링크.':'Markdown: **bold**, `code`, lists, links.'}"></textarea></label>
<div class="imgpick" data-image-picker hidden><div class="imgbar"><label class="btn"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif" multiple hidden data-image-input>${ko?'📷 이미지 추가':'📷 Add images'}</label><span class="fine">${ko?'최대 10장 · 올리기 전에 이 기기에서 크기를 줄이고 위치 정보(EXIF)를 지웁니다 · 움짤(GIF)은 첫 장면만 올라가요':'Up to 10 · resized on this device and location data (EXIF) removed before upload · a GIF becomes a still image'}</span></div><ul class="imgs" data-image-list></ul></div>
<ul class="rules"><li><a href="/${l}/community/policy">${ko?'게시판 운영정책':'Community rules'}</a></li><li>${ko?'공식 정보는 출처 링크와 함께 적어 주세요. 공식 수치는 위키 값이 우선합니다.':'Link sources for official information.'}</li><li>${s.bestRule}</li><li>${ko?'욕설·도배·불법 파일 공유는 숨김 처리됩니다. 불법촬영물·아동 성착취물은 즉시 삭제하고 관계 기관에 신고할 수 있어요.':'Abuse, spam and illegal file sharing are hidden. Illegal intimate images and child sexual abuse material are removed at once and may be reported to the authorities.'}</li></ul>
<div class="acts"><a class="btn" href="${base}">${ko?'취소':'Cancel'}</a><button class="btn p" type="submit" data-label="${ko?`${name} 채널에 등록`:`Post in ${name}`}">${ko?`${name} 채널에 등록`:`Post in ${name}`}</button></div>
</form></section>`;
 return page({l,title:ko?`글쓰기 - ${name} 채널 | Nerulio`:`Write - ${name} | Nerulio`,description:ko?`${name} 채널에 글을 씁니다.`:`Write a post in ${name}.`,canonical:site.origin+channelPath(l,ch.id)+'write',noindex:true,
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:tag?{name:nameOf(tag,l),id:tag.id}:null,body});
}
