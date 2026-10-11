// @ts-check
/** The portal home (/ in Korean, /en/ in English; /{l}/community/ redirects there) since the AI 창작 pivot
 * (owner decision 2026-10-11, mockup 1 "홈"): an upload strip into the workbench, the feed of the seven boards
 * (인기 · 최신 · 념글 · 레시피만) where each post shows its before/after images, a one-line recipe and
 * "내 사진으로 해보기", and on the right 이번 주 유행, 규격 바로 맞추기 and the rules. */
import {html,raw} from './html.js';
import {t} from './strings.js';
import {page,box,nameOf,channelUrl,postHref,frontUrl,homeUrl,kindChip,aiChip,signInUrl,channelTile,channelName,authorText} from './ui.js';
import {loadRail,renderRail} from './rail.js';
import {icon,EMPTY_ART} from './icons.js';
import {buttonsHTML} from '../../src/signin-brands.js';
import {siteGraph} from '../../src/brand.js';
import {boardTime} from './format.js';
import {frontPosts,withCards} from '../db/channel.js';
import {CHANNELS,channelById,channelPath,makePath,recipesPath} from '../channels.js';
import {MAKE_TOOLS,makeHref} from '../tools-nav.js';
import {summaryLine} from '../recipe.js';

/** What the site is, for titles, descriptions and JSON-LD (the home, the recipe lists). */
export const SITE_WHAT=Object.freeze({
 ko:{title:'Nerulio — AI 창작 커뮤니티: AI로 만든 이미지를 다듬고 레시피를 공유',
  description:'ChatGPT·제미나이로 만든 이미지를 카톡 이모티콘·LINE 스탬프·프사·배경화면·도트 규격으로 다듬고, 만든 방법(레시피)을 나누는 커뮤니티. 이미지는 서버로 보내지 않고 브라우저에서 다듬어요.'},
 en:{title:'Nerulio — AI creation community: finish AI images and share the recipe',
  description:'Finish images made with ChatGPT or Gemini as KakaoTalk emoticons, LINE stickers, avatars, wallpapers and pixel art, and share how you made them (the recipe). Images are processed in your browser, never uploaded for editing.'}});
/** WebSite + Organization as one JSON-LD graph, with what the site is. @param {string} root @param {string} l */
const siteJsonld=(root,l)=>{const {site,org}=siteGraph(root,l);return {'@context':'https://schema.org','@graph':[{...site,description:SITE_WHAT[l==='ko'?'ko':'en'].description},org]};};

const DAY=864e5;
/** 념글 periods (today = the rolling 24 hours the ★ rule uses). */
export const BEST_PERIODS=Object.freeze({day:{days:1,ko:'오늘',en:'Today'},week:{days:7,ko:'이번 주',en:'This week'},month:{days:30,ko:'이번 달',en:'This month'}});
const BAR=CHANNELS.filter(c=>c.inBar);

/** Home feed tabs: 인기 (the last days by upvotes and comments), 최신, 레시피만 (most tried); 념글 is its own page. */
export const FEED_SORTS=/** @type {const} */(['hot','new','recipes']);
/** @param {any} db @param {{l:string,now:number,sort?:string,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadFront(db,o){
 const sort=o.sort==='new'?'new':o.sort==='recipes'?'recipes':'hot';
 // Independent reads run together: on D1 every query is a round trip. The feed shows the AI 창작 boards only.
 const [picked,rail]=await Promise.all([
  sort==='new'?frontPosts(db,{mode:'latest',people:true,open:true,limit:20})
  :sort==='recipes'?frontPosts(db,{mode:'tries',open:true,limit:20})
  :frontPosts(db,{mode:'hot',people:true,open:true,since:o.now-7*DAY,limit:20}),
  loadRail(db,{now:o.now})]);
 // A quiet week: the most upvoted posts of all time fill the popular tab.
 const posts=sort==='hot'&&picked.length<8?[...picked,...(await frontPosts(db,{mode:'hot',people:true,open:true,limit:20})).filter(p=>!picked.some(x=>x.id===p.id))].slice(0,20):picked;
 return {l:o.l,now:o.now,sort,posts:await withCards(db,posts),rail,channels:o.channels||[]};
}

/** A recipe in one line (platform/recipe.js summaryLine: 시트 나누기 → 배경 지우기 → 흰 테두리 6px → LINE 스탬프 370×320).
 * A stored recipe was validated when it was posted; a row that cannot be summarised shows nothing. @param {any} recipe @param {string} l */
export function recipeLine(recipe,l){
 try{return summaryLine(recipe,l);}catch{return '';}
}
/** The size line of a result image: "370×320 ×24". @param {{w:number,h:number}} img @param {number} n */
const sizeLabel=(img,n)=>`${img.w&&img.h?`${img.w}×${img.h}`:''}${n>1?` ×${n}`:''}`.trim();
/** The before/after pair of a post (or its first two results), linking to the post. @param {any} p @param {string} l @param {string} href */
export function beforeAfter(p,l,href){
 const m=p.media;if(!m||!m.images.length)return '';
 const results=m.images.filter((/** @type {any} */ i)=>!i.source);
 const pics=m.before&&m.after?[m.before,m.after]:results.slice(0,2);
 if(!pics.length)return '';
 const ko=l==='ko';
 return html`<a class="fimg${pics.length===1?' one':''}" href="${href}" aria-label="${ko?'이미지 보기':'View images'}">${pics.map((/** @type {any} */ i,/** @type {number} */ k)=>html`<span class="fi${i.source?' src':' chk'}"><img src="${i.url}" alt="" loading="lazy" decoding="async"${i.w&&i.h?html` width="${i.w}" height="${i.h}"`:''}>${i.source?html`<span class="lab">${ko?'원본':'Before'}</span>`:k===pics.length-1&&sizeLabel(i,results.length)?html`<span class="lab mono">${sizeLabel(i,results.length)}</span>`:''}</span>`)}</a>`;
}
/** One post in a feed (mockup 1): channel · writer · time; 말머리 (+ AI 생성) and title; the before/after
 * images (or the first lines when there are none); the recipe in one line with "내 사진으로 해보기"; ↑, 댓글,
 * 리믹스. @param {any} p @param {string} l @param {number} now */
export function feedCard(p,l,now){
 const ko=l==='ko',href=postHref(l,p);
 const imgs=beforeAfter(p,l,href);
 const line=p.recipe?recipeLine(p.recipe,l):'';
 return html`<li><article class="fc"><div class="fm"><a class="fch" href="${channelPath(l,p.channel_id)}">${channelTile(p.channel_id,l)}<b>${channelName(p.channel_id,l)}</b></a><span class="dot" aria-hidden="true">·</span><span class="fwho">${authorText(p,ko?'탈퇴한 사용자':'Former member')}</span><span class="dot" aria-hidden="true">·</span><time datetime="${new Date(p.created_at).toISOString()}">${boardTime(p.created_at,now,l)}</time></div>
<h2 class="fti"><a href="${href}">${kindChip(p.kind,l,p.channel_id)}${p.ai?aiChip(l):''}${p.best_at?html`<span class="star" title="${t(l).bestRule}" role="img" aria-label="${ko?'념글':'Best'}">${icon('starFill',15)}</span>`:''}${p.title}</a></h2>
${imgs||(p.excerpt?html`<p class="fx">${p.excerpt}</p>`:'')}
${p.has_recipe?html`<div class="frc"><b>${ko?'레시피':'Recipe'}</b><span class="frs">${line||(ko?'다듬기 단계가 담긴 레시피':'A finishing recipe')}</span><a class="btn sm" href="${makePath(l,{recipe:p.id})}" rel="nofollow">${ko?'내 사진으로 해보기':'Try on my image'}</a></div>`:''}
<div class="fa"><span class="up" aria-label="${ko?`추천 ${p.up}`:`${p.up} upvotes`}">${icon('up',14)}${p.up}</span><a class="cm" href="${href}#comments">${ko?'댓글':'Comments'} ${p.comments}</a>${p.has_recipe||p.remixes?html`<a class="rx" href="${href}#remixes">${ko?'리믹스':'Remixes'} ${p.remixes}</a>`:''}</div></article></li>`;
}

/** The upload strip above the feed: into the workbench (images never leave the browser there). @param {string} l */
export function uploadStrip(l){
 const ko=l==='ko';
 return html`<a class="upstrip" href="${makePath(l)}"><span class="upi">${icon('photo',22)}</span><span class="upt"><strong>${ko?'AI로 만든 이미지 올려서 바로 다듬기':'Upload an AI image and finish it'}</strong><span>${ko?'누끼·고화질·카톡/LINE 규격·도트 — 이미지는 서버로 안 가요':'Cut-out, upscale, KakaoTalk/LINE sizes, pixel art — images stay on your device'}</span></span><span class="btn">${ko?'이미지 고르기':'Choose an image'}</span></a>`;
}
/** The presets as one row of chips (phones; wide screens have them in the right column). @param {string} l */
export const presetChips=(/** @type {string} */ l)=>html`<nav class="pchips" aria-label="${l==='ko'?'규격':'Sizes'}">${MAKE_TOOLS.map(x=>html`<a href="${makeHref(l,x)}">${x[l==='ko'?'ko':'en']}</a>`)}</nav>`;

/** @param {Awaited<ReturnType<typeof loadFront>>} m @param {{origin:string,providers?:string[],verify?:{google?:string,naver?:string,bing?:string}|null}} site */
export function renderFront(m,site){
 const {l,now}=m,s=t(l),ko=l==='ko',home=homeUrl(l),what=SITE_WHAT[ko?'ko':'en'];
 const tab=(/** @type {string} */ href,/** @type {boolean} */ on,/** @type {unknown} */ label,nofollow=false)=>html`<a href="${href}"${nofollow?html` rel="nofollow"`:''}${on?html` class="on" aria-current="page"`:''}>${label}</a>`;
 const tabs=html`<nav class="feedtabs" aria-label="${ko?'정렬':'Sort'}">${tab(home,m.sort==='hot',html`${icon('flame',16)}${ko?'인기':'Popular'}`)}${tab(`${home}?sort=new`,m.sort==='new',ko?'최신':'Latest',true)}${tab(`${frontUrl(l)}best/`,false,ko?'념글':'Best')}${tab(`${home}?sort=recipes`,m.sort==='recipes',ko?'레시피만':'Recipes only',true)}<span class="sp"></span><a class="btn p" href="${makePath(l)}" aria-label="${ko?'다듬고 올리기':'Finish and post'}">${icon('pencil',16)}<span>${ko?'다듬고 올리기':'Finish and post'}</span></a></nav>`;
 const feed=m.posts.length?html`<ol class="feed">${m.posts.map(p=>feedCard(p,l,now))}</ol>`:html`<div class="empty box emptyv">${EMPTY_ART}<p>${m.sort==='recipes'?(ko?'아직 레시피가 붙은 글이 없어요. 작업대에서 다듬고 올리면 레시피가 같이 붙어요.':'No posts with a recipe yet. Posting from the workbench attaches one.'):s.frontEmpty}</p><p><a class="btn p" href="${makePath(l)}">${ko?'다듬고 올리기':'Finish and post'}</a></p></div>`;
 const login=html`<section class="box login" data-island="account"><b>${ko?'로그인하면 구독·알림·고정닉':s.loginTitle}</b>${site.providers?.length?raw(buttonsHTML(site.providers,l,home)):html`<a class="btn" href="${signInUrl(home)}" rel="nofollow" data-signin>${s.login}</a>`}</section>`;
 const body=html`<div class="front"><main class="mainc"><h1 class="sr-only">${ko?'Nerulio — AI 창작 커뮤니티':'Nerulio — AI creation community'}</h1>${uploadStrip(l)}${presetChips(l)}${tabs}${feed}<p class="more2"><a class="btn" href="${m.sort==='recipes'?recipesPath(l):channelPath(l,'sticker')}">${m.sort==='recipes'?(ko?'레시피 모음에서 더 보기':'More in Recipes'):(ko?'채널에서 더 보기':'More in the channels')} ›</a></p></main><div class="side">${login}${renderRail(m.rail,l)}</div></div>`;
 const other=ko?'en':'ko',plain=m.sort==='hot';
 return page({l,title:what.title,description:what.description,canonical:site.origin+home+(plain?'':`?sort=${m.sort}`),noindex:!plain,
  alternates:plain?{[l]:site.origin+home,[other]:site.origin+homeUrl(other),'x-default':site.origin+homeUrl('ko')}:{},channels:m.channels,homeOn:true,body,verify:plain?site.verify:null,
  // The site's name, logo and what it is, for search engines.
  jsonld:plain?siteJsonld(site.origin+'/',l):null});
}

/** @param {any} db @param {{l:string,now:number,period:string,channel?:string|null,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadBest(db,o){
 const period=Object.prototype.hasOwnProperty.call(BEST_PERIODS,o.period)?o.period:'day';
 const channel=o.channel&&channelById(o.channel)?o.channel:null;
 const days=/** @type {any} */(BEST_PERIODS)[period].days;
 return {l:o.l,now:o.now,period,channel,posts:await frontPosts(db,{mode:'best',channel,open:!channel,since:o.now-days*DAY,limit:50}),channels:o.channels||[]};
}
/** @param {Awaited<ReturnType<typeof loadBest>>} m @param {{origin:string}} site */
export function renderBest(m,site){
 const {l}=m,s=t(l),ko=l==='ko',lang=ko?'ko':'en',base=`/${l}/community/best/`;
 const qs=(/** @type {Record<string,string|null>} */ p)=>{const u=new URLSearchParams();const all={period:m.period==='day'?null:m.period,ch:m.channel,...p};for(const [k,v] of Object.entries(all))if(v)u.set(k,v);const x=u.toString();return base+(x?`?${x}`:'');};
 const periods=html`<nav class="ftabs" aria-label="${ko?'기간':'Period'}">${Object.entries(BEST_PERIODS).map(([k,v])=>html`<a href="${qs({period:k==='day'?null:k})}"${m.period===k?html` class="on" aria-current="page"`:''}>${/** @type {any} */(v)[l]}</a>`)}</nav>`;
 const chs=html`<nav class="ftabs chf" aria-label="${ko?'채널':'Channel'}"><a href="${qs({ch:null})}"${!m.channel?html` class="on"`:''}>${s.all}</a>${BAR.map(c=>html`<a href="${qs({ch:c.id})}"${m.channel===c.id?html` class="on"`:''}>${c.names[lang]}</a>`)}</nav>`;
 const list=box({title:ko?'★ 념글':'★ Best posts',extra:periods,note:s.bestRule},m.posts.length?html`<ol class="plist">${m.posts.map((p,i)=>html`<li class="lr"><span class="rank">${i+1}</span><a class="tt" href="${postHref(l,p)}">${kindChip(p.kind,l,p.channel_id)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a><span class="lrm"><a class="chn" href="${channelPath(l,p.channel_id)}">${channelName(p.channel_id,l)}</a>${p.tags[0]?html`<a class="rtag" href="${channelUrl(l,p.tags[0])}">${nameOf(p.tags[0],l)}</a>`:''}</span><span class="up">▲ ${p.up}</span></li>`)}</ol>`:html`<p class="empty">${ko?'이 기간에 념글이 된 글이 없습니다.':'No best posts in this period.'}</p>`);
 const body=html`<div class="narrow"><h1 class="sr-only">${ko?'전체 베스트 — 채널별 념글':'Best posts'}</h1><section class="box kwb">${chs}</section>${list}</div>`;
 return page({l,title:ko?'전체 베스트 — 념글 | Nerulio AI 창작 커뮤니티':'Best posts | Nerulio AI creation community',description:ko?'프사·이모티콘·도트·배경화면 채널에서 추천을 많이 받은 AI 창작 글.':'The most upvoted AI creations across the channels.',
  canonical:site.origin+qs({}),noindex:!!(m.channel||m.period!=='day'),channels:m.channels,bestOn:true,body});
}
