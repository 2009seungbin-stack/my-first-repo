// @ts-check
/** Shared building blocks of the platform pages: URLs, names, badges, the board row and the page
 * shell (header, channel bar). Every page is ko/en, server-rendered, and works without JavaScript;
 * personal state (follow, votes, notifications) is filled in later by islands. */
import {html,raw,safeHref} from './html.js';
import {t} from './strings.js';
import {VERIFICATION_LABEL,label} from '../labels.js';
import {boardTime,compact} from './format.js';

export const CSS_HREF='/src/platform/n2.css';
export const ISLANDS_SRC='/src/platform/islands.js';

/** @typedef {import('../db/channel.js').Entity} Entity */
/** @param {{names:Record<string,string>}} e @param {string} l */
export const nameOf=(e,l)=>e.names[l]||e.names.en||Object.values(e.names)[0]||'';
/** @param {string} l @param {{vertical:string,slug:string}} e */
export const channelUrl=(l,e)=>`/${l}/${e.vertical}/${e.slug}/`;
/** @param {string} l @param {{vertical:string,slug:string}} e @param {number} no */
export const postUrl=(l,e,no)=>`${channelUrl(l,e)}${no}`;
export const frontUrl=(/** @type {string} */ l)=>`/${l}/community/`;
/** Google sign-in that comes back to `path` (server/auth-google.js safeReturnPath). @param {string} path */
export const signInUrl=path=>`/api/v1/auth/google/start?return=${encodeURIComponent(path)}`;

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

/** Author with tier badge (◇ ◆ ⚑ ✎) or the Radar bot gear. @param {{author_name:string|null,author_tier:string,bot?:boolean}} p @param {string} l */
export function author(p,l){
 const s=t(l);
 if(p.bot)return html`<span class="nick bot">${s.bot}<b aria-hidden="true"> ⚙</b></span>`;
 const tier=/** @type {Record<string,string>} */(s.tier)[p.author_tier]||'';
 return html`<span class="nick">${p.author_name||s.anonymous}${tier?html`<b title="${tier}"> ${tier.split(' ')[0]}</b>`:''}</span>`;
}
const KIND_CLASS=/** @type {Record<string,string>} */({news:'news',report:'rep',patch:'ko',question:'q',guide:'gd',benchmark:'ben',notice:'nt'});
/** 말머리 chip. @param {string} kind @param {string} l */
export const kindChip=(kind,l)=>html`<span class="mh ${KIND_CLASS[kind]||''}">${/** @type {Record<string,string>} */(t(l).kind)[kind]||kind}</span>`;

/**
 * One board row: number · [말머리] title [comments] · author · time · views · up.
 * @param {ReturnType<typeof import('../db/channel.js').channelPosts> extends Promise<infer R> ? R extends {posts:(infer P)[]} ? P : never : never} p
 * @param {{l:string,now:number,href:string,current?:boolean,channel?:string}} o
 */
export function postRow(p,o){
 const {l,now}=o;
 const title=html`${kindChip(p.kind,l)}${/** @type {any} */(p).solved?html`<span class="solved">${l==='ko'?'해결':'solved'}</span>`:''}${p.best_at?html`<span class="star" title="${t(l).bestRule}">★ </span>`:''}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}${p.has_image?html`<span class="img" aria-label="image"> ▣</span>`:''}`;
 return html`<li class="pr${p.bot?' bot':''}${p.pinned?' pin':''}${o.current?' cur':''}"><span class="no">${p.bot?'⚙':p.post_no}</span>${o.current?html`<span class="tt" aria-current="page">${title}</span>`:html`<a class="tt" href="${o.href}">${title}</a>`}${o.channel?html`<span class="chn">${o.channel}</span>`:''}${author(p,l)}<span class="num w"><time datetime="${new Date(p.created_at).toISOString()}">${boardTime(p.created_at,now,l)}</time></span><span class="num v">${compact(p.views,l)}</span><span class="num u">${p.up||''}</span></li>`;
}

const LOGO=html`<svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#fff"/><path d="M21 47V31a11 11 0 0 1 22 0v16" fill="none" stroke="#2b62d6" stroke-width="8.5" stroke-linecap="round"/><circle cx="47.5" cy="16.5" r="5" fill="#8fbaff"/></svg>`;

/**
 * Page shell. `channels` = the channel bar (popular channels for anonymous visitors; an island swaps in
 * the reader's subscriptions). `scope` = the channel a search is limited to.
 * @param {{l:string,title:string,description:string,canonical:string,alternates?:Record<string,string>,noindex?:boolean,
 *  channels:{name:string,href:string,on?:boolean}[],homeOn?:boolean,scope?:{name:string,id:string}|null,body:unknown,jsonld?:object|null,feed?:string|null,ogType?:string}} o
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
<meta property="og:image" content="${new URL(o.canonical).origin}/assets/social/${o.l==='ko'?'ko':'en'}-home.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${o.feed?html`<link rel="alternate" type="application/rss+xml" href="${o.feed}" title="RSS">
`:''}
<link rel="stylesheet" href="${CSS_HREF}">
<script type="module" src="${ISLANDS_SRC}"></script>
<script src="/src/hit.js" defer></script>
${o.jsonld?html`<script type="application/ld+json">${raw(JSON.stringify(o.jsonld).replace(/</g,'\\u003c'))}</script>
`:''}</head>
<body class="n2">
<a class="skip" href="#main">${o.l==='ko'?'본문 바로가기':'Skip to content'}</a>
<header class="hd"><div class="w hr">
<a class="brand" href="${frontUrl(o.l)}">${LOGO}<span>Nerulio</span></a>
<form class="hq" role="search" action="/${o.l}/search/" method="get"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>${o.scope?html`<input type="hidden" name="in" value="${o.scope.id}"><span class="qchip" title="${o.scope.name}"><span class="qn">${o.scope.name}</span><button type="button" class="qx" data-unscope aria-label="${o.l==='ko'?'전체에서 검색':'Search everywhere'}">×</button></span>`:''}<input type="search" name="q" placeholder="${o.scope?s.searchIn(o.scope.name):s.search}" aria-label="${o.scope?s.searchIn(o.scope.name):s.search}"></form>
<nav class="hn" aria-label="Nerulio"><a class="hb" href="/${o.l}/radar/">${s.radar}</a><a class="hb tl" href="/${o.l}/">${s.tools}</a></nav>
<div class="hu" data-island="account"><a class="hb solid" href="/${o.l}/account/">${s.login}</a></div>
</div></header>
<nav class="chbar" aria-label="${s.allChannels}"><div class="w cr" data-island="channel-bar">
<a href="${frontUrl(o.l)}"${o.homeOn?html` class="on" aria-current="page"`:''}>${s.home}</a><a href="${frontUrl(o.l)}best/">${s.allBest}</a><span class="sep" aria-hidden="true"></span>
${o.channels.map(c=>html`<a href="${c.href}"${c.on?html` class="on" aria-current="page"`:''}>${c.name}</a>`)}
</div></nav>
${String(o.body).includes('<main')?html`<div class="w pg" id="main">${o.body}</div>`:html`<main class="w pg" id="main">${o.body}</main>`}
<footer class="ft"><div class="w"><a href="/${o.l}/about/">Nerulio</a> · <a href="/${o.l}/terms/">${o.l==='ko'?'이용약관':'Terms'}</a> · <a href="/${o.l}/privacy/">${o.l==='ko'?'개인정보 처리방침':'Privacy'}</a> · <a href="/${o.l}/community/policy">${o.l==='ko'?'게시판 운영정책':'Community rules'}</a> · <a href="/${o.l}/community/transparency">${o.l==='ko'?'운영 투명성':'Transparency'}</a></div></footer>
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
