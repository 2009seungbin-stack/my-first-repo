// @ts-check
/** Shared building blocks of the platform pages: URLs, names, badges, the board row and the page
 * shell (header, channel bar). Every page is ko/en, server-rendered, and works without JavaScript;
 * personal state (follow, votes, notifications) is filled in later by islands. */
import {html,raw,safeHref} from './html.js';
import {t} from './strings.js';
import {VERIFICATION_LABEL,label} from '../labels.js';
import {boardTime,compact} from './format.js';
import {CHANNELS,channelById,channelPath,postPath,flairLabel,patchCollectionPath} from '../channels.js';
import {FILE_TOOLS,GAME_TOOLS,PC_TOOLS,toolHref,toolsHome} from '../tools-nav.js';
import {icon,CHANNEL_ICON,TIER_ICON} from './icons.js';

// Production assets can remain in a visitor's cache for four hours. Bump this version for CSS releases.
export const CSS_HREF='/src/platform/n2.css?v=20261003-pc-tools';
/** SUIT and JetBrains Mono, self-hosted and split by unicode-range (tools/fonts/subset-suit.py). */
export const FONTS_HREF='/src/platform/fonts.css';
export const ISLANDS_SRC='/src/platform/islands.js';
/** Applies the saved theme before the first paint (white by default) and runs the dark-mode button and
 * the menu drawer; a classic script, so it blocks rendering only for its own few hundred bytes. */
export const THEME_SRC='/src/platform/theme.js';

/** @typedef {import('../db/channel.js').Entity} Entity */
/** @param {{names:Record<string,string>}} e @param {string} l */
export const nameOf=(e,l)=>e.names[l]||e.names.en||Object.values(e.names)[0]||'';
/** @param {string} l @param {{vertical:string,slug:string}} e */
export const channelUrl=(l,e)=>`/${l}/${e.vertical}/${e.slug}/`;
/** A post's address: /{l}/community/{channel}/{no}. @param {string} l @param {{channel_id:string,channel_no:number}} p */
export const postHref=(l,p)=>postPath(l,p.channel_id,p.channel_no);
export const frontUrl=(/** @type {string} */ l)=>`/${l}/community/`;
/** A member's profile (/{l}/community/u/{nickname}). @param {string} l @param {string} name */
export const profilePath=(l,name)=>`/${l}/community/u/${encodeURIComponent(name)}`;
/** Nicknames with a profile link: members' own nicknames, not the generated "user-xxxxxx" nor ㅇㅇ (read as
 * the anonymous writer's name even when a member picked it). @param {string|null|undefined} name */
export const hasProfile=name=>!!name&&name!=='ㅇㅇ'&&!/^user-[0-9a-z]{6}$/.test(name);
/** The portal home: Korean at the site root, English at /en/ (the community front, PLATFORM=on). */
export const homeUrl=(/** @type {string} */ l)=>l==='ko'?'/':`/${l}/`;
/** The sign-in chooser (the account page lists the configured providers: Google, GitHub, Discord) that
 * comes back to `path` (server/oauth/flow.js safeReturnPath). Links carry data-signin so the islands can
 * open the sign-in sheet in place instead. @param {string} path */
export const signInUrl=path=>`/${/^\/(ko|en|ja)\//.exec(path)?.[1]||'ko'}/account/?return=${encodeURIComponent(path)}`;

/** Search-engine ownership tags (Google, Naver, Bing) on the portal home, which is the site root: the
 * tokens come from the build (GOOGLE_/NAVER_/BING_SITE_VERIFICATION) like on the static pages.
 * @param {{google?:string,naver?:string,bing?:string}|null|undefined} v */
export const verifyMeta=v=>v?[['google-site-verification',v.google],['naver-site-verification',v.naver],['msvalidate.01',v.bing]].filter(([,x])=>x&&/^[A-Za-z0-9_-]{1,256}$/.test(String(x))).map(([n,x])=>html`<meta name="${n}" content="${x}">
`):'';
/** Two-letter tile for a channel without an image ("C", "5070", "GX"). @param {Entity} e @param {string} l */
export function monogram(e,l){
 const n=nameOf(e,l);
 const num=/\b(\d{3,4})\b/.exec(n);if(e.type==='gpu'&&num)return num[1];
 const words=n.replace(/[()\[\]:~\-–—]/g,' ').split(/\s+/).filter(Boolean);
 if(!words.length)return '?';
 if(/^[A-Za-z]/.test(words[0]))return words.length>1&&/^[A-Z]/.test(words[1])&&words[0].length<=3?(words[0][0]+words[1][0]).toUpperCase():words[0][0].toUpperCase();
 return [...words[0]][0];
}
/** Tile colors per vertical (the channel icon when there is no image). */
export const TILE=/** @type {Record<string,string>} */({ai:'t-ai',games:'t-games',hardware:'t-hw',studio:'t-studio',subculture:'t-sub',tools:'t-tools'});

const VCLASS=/** @type {Record<string,string>} */({OFFICIAL:'o',AUTOMATED:'a',COMMUNITY_VERIFIED:'c',COMMUNITY:'cm',ESTIMATE:'e',DISPUTED:'d',UNKNOWN:'u'});
/** Verification chip: ✓ 공식, ⚙ 자동 감지, ● 커뮤니티 검증, ≈ 추정 … @param {string} v @param {string} l @param {string} [text] */
export const badge=(v,l,text)=>html`<span class="st ${VCLASS[v]||'u'}">${text??label(/** @type {any} */(VERIFICATION_LABEL)[v]||VERIFICATION_LABEL.UNKNOWN,l)}</span>`;

/** A section box with a header row. @param {{title:unknown,extra?:unknown,note?:unknown,cls?:string,id?:string}} h @param {unknown} body */
export const box=(h,body)=>html`<section class="box ${h.cls||''}"${h.id?html` id="${h.id}"`:''}><div class="bh"><h2>${h.title}</h2>${h.extra}${h.note?html`<span class="x">${h.note}</span>`:''}</div>${body}</section>`;

/** Author: the Radar bot gear; an anonymous writer as "ㅇㅇ (a3F9)" (nickname + daily ID, muted); a member
 * (고정닉) with ✓ and the tier badge (◇ ◆ ⚑ ✎).
 * @param {{author_name:string|null,author_tier:string,bot?:boolean,anon_id?:string|null}} p @param {string} l */
export function author(p,l){
 const s=t(l);
 if(p.bot)return html`<span class="nick bot">${s.bot}<b class="tb">${icon('gear',13)}</b></span>`;
 if(p.anon_id)return html`<span class="nick anon" title="${s.anonTitle}">${p.author_name||'ㅇㅇ'}<span class="aid"> (${p.anon_id})</span></span>`;
 const tier=/** @type {Record<string,string>} */(s.tier)[p.author_tier]||'';
 const name=p.author_name&&hasProfile(p.author_name)?html`<a href="${profilePath(l,p.author_name)}">${p.author_name}</a>`:p.author_name||s.anonymous;
 return html`<span class="nick mem">${name}<b class="ck" title="${s.memberTitle}" role="img" aria-label="${s.memberTitle}">${icon('check',12)}</b>${tier?html`<b class="tb t-${p.author_tier}" title="${tier}" role="img" aria-label="${tier}">${icon(TIER_ICON[p.author_tier]||'diamond',12)}</b>`:''}</span>`;
}
/** Plain-text author for data attributes and JSON-LD. @param {{author_name:string|null,anon_id?:string|null}} p @param {string} fallback */
export const authorText=(p,fallback)=>p.anon_id?`${p.author_name||'ㅇㅇ'} (${p.anon_id})`:p.author_name||fallback;
const KIND_CLASS=/** @type {Record<string,string>} */({news:'news',report:'rep',patch:'ko',question:'q',guide:'gd',benchmark:'ben',notice:'nt',info:'inf',review:'rv',buy:'buy',event:'buy',feedback:''});
/** 말머리 chip, named as the post's channel calls it (팁 for guide in AI). @param {string} kind @param {string} l @param {string|null} [channel] */
export const kindChip=(kind,l,channel=null)=>html`<span class="mh ${KIND_CLASS[kind]||''}">${flairLabel(channel,kind,l)}</span>`;
/** A tag chip (the entity page of the tag). @param {Entity} e @param {string} l @param {boolean} [on] */
export const tagChip=(e,l,on=false)=>html`<a class="rtag${on?' on':''}" href="${channelUrl(l,e)}">${nameOf(e,l)}</a>`;
/** A channel's tile (its icon on the channel's color). @param {string} ch @param {string} [_l] */
export const channelTile=(ch,_l)=>html`<span class="tile ch-${ch}" aria-hidden="true">${icon(CHANNEL_ICON[ch]||'chat',20)}</span>`;
/** @param {string} ch @param {string} l */
export const channelName=(ch,l)=>channelById(ch)?.names[l==='ko'?'ko':'en']||ch;

/**
 * One board row: number · [말머리] title [comments] tags · author · time · views · up.
 * @param {ReturnType<typeof import('../db/channel.js').boardPosts> extends Promise<infer R> ? R extends {posts:(infer P)[]} ? P : never : never} p
 * @param {{l:string,now:number,current?:boolean,channel?:boolean,tagOn?:Set<string>}} o
 */
export function postRow(p,o){
 const {l,now}=o,href=postHref(l,p);
 const title=html`${kindChip(p.kind,l,p.channel_id)}${/** @type {any} */(p).solved?html`<span class="solved">${l==='ko'?'해결':'solved'}</span>`:''}${p.best_at?html`<span class="star" title="${t(l).bestRule}">★ </span>`:''}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}${p.has_image?html`<span class="img" aria-label="image"> ▣</span>`:''}`;
 const tags=p.tags.length?html`<span class="rtags">${p.tags.map(e=>tagChip(e,l,!!o.tagOn?.has(e.id)))}</span>`:'';
 return html`<li class="pr${p.bot?' bot':''}${p.pinned?' pin':''}${o.current?' cur':''}"><span class="no">${p.bot?'⚙':p.channel_no}</span><span class="tc">${o.current?html`<span class="tt" aria-current="page">${title}</span>`:html`<a class="tt" href="${href}">${title}</a>`}${o.channel?html`<a class="chn" href="${channelPath(l,p.channel_id)}">${channelName(p.channel_id,l)}</a>`:''}${tags}</span>${author(p,l)}<span class="num w"><time datetime="${new Date(p.created_at).toISOString()}">${boardTime(p.created_at,now,l)}</time></span><span class="num v">${compact(p.views,l)}</span><span class="num u">${p.up||''}</span></li>`;
}
/** The header row of a board list. @param {string} l */
export function boardHead(l){
 const s=t(l);
 return html`<li class="pr ph" aria-hidden="true"><span class="no">${s.colNo}</span><span class="tc"><span class="tt">${s.colTitle}</span></span><span class="nick">${s.colAuthor}</span><span class="num w">${s.colDate}</span><span class="num v">${s.colViews}</span><span class="num u">${s.colUp}</span></li>`;
}

/** The Nerulio mark (src/logo.js: the favicon, the tool pages and the brand PNGs use the same shape). */
const LOGO=html`<svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#c6f24e"/><path d="M21 47V31a11 11 0 0 1 22 0v16" fill="none" stroke="#15171a" stroke-width="8.5" stroke-linecap="round"/><circle cx="47.5" cy="16.5" r="5" fill="#15171a"/></svg>`;
const CHEV=html`<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;

/** The menu column (desktop) and the drawer (mobile): pages, the channels, and the file and game tools,
 * each group folding open on a click (<details>, no script needed). @param {{l:string,homeOn?:boolean,bestOn?:boolean,patchOn?:boolean}} o */
function shellNav(o){
 const l=o.l,ko=l==='ko',lang=ko?'ko':'en';
 const item=(/** @type {string} */ href,/** @type {string} */ label,/** @type {boolean|undefined} */ on,/** @type {string} */ ic)=>html`<a class="ln${on?' on':''}" href="${href}"${on?html` aria-current="page"`:''}>${icon(ic,18)}${label}</a>`;
 const tools=(/** @type {string} */ id,/** @type {string} */ title,/** @type {readonly import('../tools-nav.js').NavTool[]} */ list,/** @type {boolean} */ open)=>html`<details class="lg" id="${id}"${open?html` open`:''}><summary>${CHEV}${title}<span class="lgn">${list.length}</span></summary><ul>${list.map(x=>html`<li><a href="${toolHref(l,x)}"><span class="ic" title="${x.ic}">${icon(x.svg,18)}</span>${x[lang]}</a></li>`)}<li><a class="all" href="${toolsHome(l)}">${ko?'도구 전체 보기 ›':'All tools ›'}</a></li></ul></details>`;
 return html`<aside class="lnav" id="lnav" aria-label="${ko?'메뉴와 도구':'Menu and tools'}"><div class="lnh"><a class="brand" href="${homeUrl(l)}">${LOGO}<span>nerulio</span></a><a class="lnx" href="#" data-drawer-close aria-label="${ko?'닫기':'Close'}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></a></div>
<nav aria-label="${ko?'페이지':'Pages'}">${item(homeUrl(l),ko?'홈':'Home',o.homeOn,'home')}${item(`${frontUrl(l)}best/`,ko?'전체 베스트':'Best everywhere',o.bestOn,'star')}${item(`/${l}/radar/`,ko?'레이더':'Radar',false,'radar')}${item(patchCollectionPath(l),ko?'한글패치 모음':'Korean patches',o.patchOn,'pin')}</nav>
<details class="lg lch"><summary>${CHEV}${ko?'채널':'Channels'}<span class="lgn">${CHANNELS.length}</span></summary><ul>${CHANNELS.map(c=>html`<li><a href="${channelPath(l,c.id)}"><span class="tile sm ch-${c.id}" aria-hidden="true">${icon(CHANNEL_ICON[c.id],14)}</span>${c.names[lang]}</a></li>`)}</ul></details>
<span class="lsep" aria-hidden="true"></span>
${tools('nav-pc',ko?'PC 도구':'PC tools',PC_TOOLS,true)}${tools('nav-file',ko?'파일 도구':'File tools',FILE_TOOLS,false)}${tools('nav-game',ko?'게임 도구':'Game tools',GAME_TOOLS,false)}</aside>`;
}

/**
 * 채널 이동 (mobile bottom sheet, desktop dialog): pinned channels (islands fill them from this browser or
 * the account), every channel with a pin button, and the tags seen lately. Opened by "전체 채널"; without
 * JavaScript that link goes to the channel list on the community front.
 * @param {string} l */
export function channelSheet(l){
 const ko=l==='ko',lang=ko?'ko':'en';
 return html`<dialog class="chsheet" id="chsheet" aria-labelledby="chsheet-h" data-island="channel-sheet"><div class="shh"><span class="grab" aria-hidden="true"></span><h2 id="chsheet-h">${ko?'채널':'Channels'}</h2><button type="button" class="shx" data-close-sheet aria-label="${ko?'닫기':'Close'}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
<div class="shs"><label class="sr-only" for="chsheet-q">${ko?'채널·태그 찾기':'Find a channel or tag'}</label><input id="chsheet-q" type="search" data-sheet-q placeholder="${ko?'채널·태그 찾기 (예: 클로드, 5070)':'Find a channel or tag (e.g. Claude, 5070)'}" autocomplete="off"><ul class="shr" data-sheet-results hidden></ul></div>
<section class="shg" data-my-channels hidden><h3>${ko?'내 채널 · 채널 바에 이 순서로':'My channels · in this order on the bar'}</h3><ul data-my-list></ul></section>
<section class="shg"><h3>${ko?'전체 채널':'All channels'}</h3><ul>${CHANNELS.map(c=>html`<li><span class="tile ch-${c.id}" aria-hidden="true">${icon(CHANNEL_ICON[c.id],16)}</span><span class="shn"><a href="${channelPath(l,c.id)}">${c.names[lang]}</a><span class="fine">${c.desc[lang]}</span></span>${c.inBar?html`<button type="button" class="pin" data-pin="${c.id}" aria-pressed="false"><span class="p0">${ko?'고정':'Pin'}</span><span class="p1">✓ ${ko?'고정됨':'Pinned'}</span></button>`:''}</li>`)}
<li><span class="tile ch-patch" aria-hidden="true">${icon('pin',16)}</span><span class="shn"><a href="${patchCollectionPath(l)}">${ko?'한글패치 모음':'Korean patches'}</a><span class="fine">${ko?'게임 · [한글패치]':'Games · [Korean patch]'}</span></span></li></ul></section>
<section class="shg" data-recent-tags hidden><h3>${ko?'최근 본 태그':'Tags you viewed'}</h3><div class="rtags" data-recent-list></div></section>
<p class="fine shf">${ko?'로그인 없이 고정한 채널은 이 브라우저에 저장되고, 로그인하면 계정으로 옮겨져요.':'Pins without an account stay in this browser and move to your account when you sign in.'}</p></dialog>`;
}

/** The share image of a page: its own card when it has one (a site path or an absolute URL on the site),
 * else the portal card of the language (tools/brand-assets.py). @param {{l:string,canonical:string,ogImage?:{url:string}|null}} o */
export function ogImageUrl(o){
 const origin=new URL(o.canonical).origin;
 if(o.ogImage?.url){const u=new URL(o.ogImage.url,origin);if(u.origin===origin)return u.href;}
 return `${origin}/assets/social/${o.l==='ko'?'ko':'en'}-portal.png`;
}

/**
 * Page shell. `channels` = the channel bar (popular channels for anonymous visitors; an island swaps in
 * the reader's subscriptions). `scope` = the channel a search is limited to.
 * @param {{l:string,title:string,description:string,canonical:string,alternates?:Record<string,string>,noindex?:boolean,
 *  verify?:{google?:string,naver?:string,bing?:string}|null,
 *  channels:{name:string,href:string,on?:boolean,id?:string}[],homeOn?:boolean,bestOn?:boolean,patchOn?:boolean,scope?:{name:string,id:string}|null,body:unknown,jsonld?:object|null,feed?:string|null,feedTitle?:string,ogType?:string,
 *  ogImage?:{url:string,alt?:string}|null}} o `ogImage` = a 1200×630 share card of this page (a site path), instead of the site card.
 */
export function page(o){
 const s=t(o.l);
 // Every page with language versions names the English one as x-default, the same way.
 const alts={...(o.alternates||{})};if(alts.en&&alts.ko&&!alts['x-default'])alts['x-default']=alts.en;
 const alt=Object.entries(alts);
 return html`<!doctype html>
<html lang="${o.l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${o.title}</title>
<meta name="description" content="${o.description}">
<link rel="canonical" href="${o.canonical}">
${alt.map(([hl,href])=>html`<link rel="alternate" hreflang="${hl}" href="${href}">
`)}${o.noindex?html`<meta name="robots" content="noindex,follow">
`:''}<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:url" content="${o.canonical}">
<meta property="og:site_name" content="Nerulio">
<meta property="og:type" content="${o.ogType||'website'}">
<meta property="og:locale" content="${o.l==='ko'?'ko_KR':'en_US'}">
<meta property="og:image" content="${ogImageUrl(o)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
${o.ogImage?.alt?html`<meta property="og:image:alt" content="${o.ogImage.alt}">
`:''}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
${verifyMeta(o.verify)}
${o.feed?html`<link rel="alternate" type="application/rss+xml" href="${o.feed}" title="${o.feedTitle||'RSS'}">
`:''}
<script src="${THEME_SRC}"></script>
<link rel="stylesheet" href="${FONTS_HREF}">
<link rel="stylesheet" href="${CSS_HREF}">
<script type="module" src="${ISLANDS_SRC}"></script>
<script src="/src/hit.js" defer></script>
${o.jsonld?html`<script type="application/ld+json">${raw(JSON.stringify(o.jsonld).replace(/</g,'\\u003c'))}</script>
`:''}</head>
<body class="n2">
<a class="skip" href="#main">${o.l==='ko'?'본문 바로가기':'Skip to content'}</a>
<div class="app">
${shellNav(o)}
<div class="col">
<header class="top hd"><a class="menu" href="#lnav" data-drawer-open aria-controls="lnav" aria-label="${o.l==='ko'?'메뉴·도구 열기':'Open menu and tools'}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg></a>
<a class="brand" href="${homeUrl(o.l)}">${LOGO}<span>nerulio</span></a>
<form class="hq" role="search" action="/${o.l}/search/" method="get"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>${o.scope?html`<input type="hidden" name="in" value="${o.scope.id}"><span class="qchip" title="${o.scope.name}"><span class="qn">${o.scope.name}</span><button type="button" class="qx" data-unscope aria-label="${o.l==='ko'?'전체에서 검색':'Search everywhere'}">×</button></span>`:''}<input type="search" name="q" placeholder="${o.scope?s.searchIn(o.scope.name):s.search}" aria-label="${o.scope?s.searchIn(o.scope.name):s.search}"></form>
<button type="button" class="thm" data-theme-toggle aria-pressed="false" aria-label="${o.l==='ko'?'다크 모드':'Dark mode'}" title="${o.l==='ko'?'다크 모드':'Dark mode'}"><svg class="i-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg><svg class="i-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
<nav class="hn" aria-label="Nerulio"><a class="hb rdr" href="/${o.l}/radar/" title="${s.radar}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 19 5"/></svg><span>${s.radar}</span></a></nav>
<div class="hu" data-island="account"><a class="hb solid" href="${signInUrl(new URL(o.canonical).pathname)}" rel="nofollow" data-signin>${s.login}</a></div>
</header>
<nav class="chbar" aria-label="${s.allChannels}"><div class="cr" data-island="channel-bar"><span class="chs" data-channel-links>${o.channels.map(c=>html`<a href="${c.href}" data-ch="${/** @type {any} */(c).id||''}"${c.on?html` class="on" aria-current="page"`:''}>${c.name}</a>`)}</span></div><a class="allch" href="#lnav" data-open-sheet aria-haspopup="dialog" aria-controls="chsheet"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>${o.l==='ko'?'전체 채널':'All channels'}</span></a></nav>
${channelSheet(o.l)}
${String(o.body).includes('<main')?html`<div class="pg" id="main">${o.body}</div>`:html`<main class="pg" id="main">${o.body}</main>`}
<footer class="ft"><div><a href="/${o.l}/about/">Nerulio</a> · <a href="/${o.l}/terms/">${o.l==='ko'?'이용약관':'Terms'}</a> · <a href="/${o.l}/privacy/">${o.l==='ko'?'개인정보 처리방침':'Privacy'}</a> · <a href="/${o.l}/community/policy">${o.l==='ko'?'게시판 운영정책':'Community rules'}</a> · <a href="/${o.l}/community/transparency">${o.l==='ko'?'운영 투명성':'Transparency'}</a></div></footer>
</div></div>
<a class="scrim" href="#" data-drawer-close tabindex="-1" aria-hidden="true"></a>
</body>
</html>`;
}

/** Official link list for the wiki box. @param {{label:string,url:string}[]} urls */
/** Korean names for the seed's English link labels ("Official site (JP)" → "공식 사이트 (일본)");
 * names of services (Steam, GitHub, Laftel …) stay as they are. */
const LINK_KO=/** @type {[RegExp,string][]} */([[/^Official site$/,'공식 사이트'],[/^Official website$/,'공식 사이트'],[/^Website$/,'웹사이트'],[/^Product page$/,'제품 페이지'],[/^Model page$/,'모델 페이지'],[/^Author page$/,'제작자 페이지'],
 [/^Release notes$/,'릴리스 노트'],[/^Pricing$/,'요금 안내'],[/^Docs$/,'문서'],[/^API docs$/,'API 문서'],[/^Announcement$/,'발표'],[/^Datasheet$/,'데이터시트'],[/^Specifications$/,'사양'],[/^Downloads$/,'다운로드'],[/^Support$/,'지원'],
 [/^Requirements$/,'요구 사항'],[/^macOS compatibility$/,'macOS 호환성'],[/^Korean official site$/,'한국 공식 사이트'],[/^Korean name credit$/,'한국어 이름 출처'],[/^Korean name source/,'한국어 이름 출처'],
 [/^Anime official site$|^Official anime site$/,'애니 공식 사이트'],[/^Film official site$/,'극장판 공식 사이트'],[/^Official portal$/,'공식 포털']]);
const PAREN_KO=/** @type {Record<string,string>} */({JP:'일본',JA:'일본어',EN:'영어',KR:'한국',KO:'한국어',docs:'문서',US:'미국'});
/** @param {string} label @param {string} l */
export function linkLabel(label,l){
 if(l!=='ko')return label;
 const m=/^(.*?)(?:\s*\(([^)]+)\))?$/.exec(label.trim());const base=m?.[1]||label,paren=m?.[2];
 const hit=LINK_KO.find(([re])=>re.test(base));
 if(!hit)return label;
 return paren?`${hit[1]} (${PAREN_KO[paren]||paren})`:hit[1];
}
/** @param {{url:string,label:string}[]} urls @param {string} [l] */
export const officialLinks=(urls,l='en')=>urls.slice(0,6).map(u=>html`<a href="${safeHref(u.url)}" rel="noopener" target="_blank">${linkLabel(u.label,l)} ↗</a>`);
