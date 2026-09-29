// @ts-check
/** The portal home (/ in Korean, /en/ in English; /{l}/community/ redirects there): one column of posts
 * from every channel (인기 · 최신, and the ★ 념글 page), and on the right sign-in, AI service status, Radar
 * news, this week's schedule and today's best. File and game tools are in the menu of every page. */
import {html,raw} from './html.js';
import {t} from './strings.js';
import {page,box,nameOf,channelUrl,postHref,frontUrl,homeUrl,kindChip,signInUrl,channelTile,channelName,author} from './ui.js';
import {loadRail,renderRail,statusStrip} from './rail.js';
import {icon,EMPTY_ART} from './icons.js';
import {buttonsHTML} from '../../src/signin-brands.js';
import {boardTime,compact} from './format.js';
import {frontPosts,excerptsOf} from '../db/channel.js';
import {CHANNELS,channelById,channelPath} from '../channels.js';

const DAY=864e5;
/** 념글 periods (today = the rolling 24 hours the ★ rule uses). */
export const BEST_PERIODS=Object.freeze({day:{days:1,ko:'오늘',en:'Today'},week:{days:7,ko:'이번 주',en:'This week'},month:{days:30,ko:'이번 달',en:'This month'}});
const BAR=CHANNELS.filter(c=>c.inBar);

/** Home feed tabs: 인기 (the last days by upvotes and comments), 최신, and 념글 (the best page). */
export const FEED_SORTS=/** @type {const} */(['hot','new']);
/** @param {any} db @param {{l:string,now:number,sort?:string,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadFront(db,o){
 const sort=o.sort==='new'?'new':'hot';
 // Independent reads run together: on D1 every query is a round trip.
 const [picked,rail]=await Promise.all([
  sort==='new'?frontPosts(db,{mode:'latest',people:true,limit:20}):frontPosts(db,{mode:'hot',people:true,since:o.now-7*DAY,limit:20}),
  loadRail(db,{now:o.now})]);
 // A quiet week: the most upvoted posts of all time fill the popular tab.
 const posts=sort==='hot'&&picked.length<8?[...picked,...(await frontPosts(db,{mode:'hot',people:true,limit:20})).filter(p=>!picked.some(x=>x.id===p.id))].slice(0,20):picked;
 const excerpts=await excerptsOf(db,posts.map(p=>p.id));
 return {l:o.l,now:o.now,sort,posts:posts.map(p=>({...p,excerpt:excerpts.get(p.id)||''})),rail,channels:o.channels||[]};
}

/** One post in the home feed: channel · 말머리 · writer · time, title, the first lines, ▲ and comments.
 * @param {Awaited<ReturnType<typeof loadFront>>['posts'][number]} p @param {string} l @param {number} now */
export function feedCard(p,l,now){
 const ko=l==='ko';
 return html`<li><article class="fc"><div class="fm"><a class="fch" href="${channelPath(l,p.channel_id)}">${channelTile(p.channel_id,l)}<b>${channelName(p.channel_id,l)}</b></a>${kindChip(p.kind,l,p.channel_id)}${author(p,l)}<time datetime="${new Date(p.created_at).toISOString()}">${boardTime(p.created_at,now,l)}</time><span class="fv" aria-label="${ko?`조회 ${compact(p.views,l)}`:`${compact(p.views,l)} views`}">${icon('eye',15)}${compact(p.views,l)}</span></div>
<h2 class="fti"><a href="${postHref(l,p)}">${p.best_at?html`<span class="star" title="${t(l).bestRule}" role="img" aria-label="${ko?'념글':'Best'}">${icon('starFill',15)}</span>`:''}${p.title}</a></h2>${p.excerpt?html`<p class="fx">${p.excerpt}</p>`:''}
<div class="fa"><span class="up" aria-label="${ko?`추천 ${p.up}`:`${p.up} upvotes`}">${icon('up',14)}${p.up}</span>${p.comments?html`<a class="cm" href="${postHref(l,p)}#comments" aria-label="${ko?`댓글 ${p.comments}`:`${p.comments} comments`}">${icon('bubble',14)}${p.comments}</a>`:''}${p.tags.slice(0,2).map(e=>html`<a class="ftag" href="${channelUrl(l,e)}">#${nameOf(e,l)}</a>`)}</div></article></li>`;
}

/** @param {Awaited<ReturnType<typeof loadFront>>} m @param {{origin:string,providers?:string[]}} site */
export function renderFront(m,site){
 const {l,now}=m,s=t(l),ko=l==='ko',home=homeUrl(l);
 const tabs=html`<nav class="feedtabs" aria-label="${ko?'정렬':'Sort'}"><a href="${home}"${m.sort==='hot'?html` class="on" aria-current="page"`:''}>${icon('flame',16)}${ko?'인기':'Popular'}</a><a href="${home}?sort=new" rel="nofollow"${m.sort==='new'?html` class="on" aria-current="page"`:''}>${icon('clock',16)}${ko?'최신':'Latest'}</a><a href="${frontUrl(l)}best/">${icon('star',16)}${ko?'념글':'Best'}</a><span class="sp"></span><a class="btn p" href="${frontUrl(l)}free/write">${icon('pencil',16)}${s.write}</a></nav>`;
 const feed=m.posts.length?html`<ol class="feed">${m.posts.map(p=>feedCard(p,l,now))}</ol>`:html`<div class="empty box emptyv">${EMPTY_ART}<p>${s.frontEmpty}</p></div>`;
 const login=html`<section class="box login" data-island="account"><b>${ko?'로그인하면 구독·알림·고정닉':s.loginTitle}</b><span class="fine">${ko?'로그인 없이도 ㅇㅇ (오늘의 ID)로 글과 댓글을 쓸 수 있어요.':'Without an account you can still post as ㅇㅇ (today\'s ID).'}</span>${site.providers?.length?raw(buttonsHTML(site.providers,l,home)):html`<a class="btn" href="${signInUrl(home)}" rel="nofollow" data-signin>${s.login}</a>`}</section>`;
 const body=html`<div class="front"><main class="mainc"><h1 class="sr-only">${ko?'Nerulio — AI·게임·PC·창작 도구·애니 커뮤니티':'Nerulio — community for AI, games, PC, creator tools and anime'}</h1>${statusStrip(m.rail,l)}${tabs}${feed}<p class="more2"><a class="btn" href="${frontUrl(l)}free/">${ko?'채널에서 더 보기':'More in the channels'} ›</a></p></main><div class="side">${login}${renderRail(m.rail,l)}</div></div>`;
 const title=ko?'Nerulio — AI·게임·PC·창작 도구·애니 커뮤니티와 파일 도구':'Nerulio — community for AI, games, PC, creator tools and anime, plus file tools';
 const other=ko?'en':'ko';
 return page({l,title,description:ko?'AI 서비스 상태와 새 소식, 게임·PC·창작 도구·애니 채널의 인기 글, 그리고 서버에 올리지 않는 파일·게임 도구.':'AI service status and news, popular posts from game, PC, creator-tool and anime channels, and file and game tools that never upload your files.',canonical:site.origin+home+(m.sort==='new'?'?sort=new':''),noindex:m.sort==='new',
  alternates:m.sort==='new'?{}:{[l]:site.origin+home,[other]:site.origin+homeUrl(other),'x-default':site.origin+homeUrl('ko')},channels:m.channels,homeOn:true,body});
}

/** @param {any} db @param {{l:string,now:number,period:string,channel?:string|null,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadBest(db,o){
 const period=Object.prototype.hasOwnProperty.call(BEST_PERIODS,o.period)?o.period:'day';
 const channel=o.channel&&channelById(o.channel)?o.channel:null;
 const days=/** @type {any} */(BEST_PERIODS)[period].days;
 return {l:o.l,now:o.now,period,channel,posts:await frontPosts(db,{mode:'best',channel,since:o.now-days*DAY,limit:50}),channels:o.channels||[]};
}
/** @param {Awaited<ReturnType<typeof loadBest>>} m @param {{origin:string}} site */
export function renderBest(m,site){
 const {l}=m,s=t(l),ko=l==='ko',lang=ko?'ko':'en',base=`/${l}/community/best/`;
 const qs=(/** @type {Record<string,string|null>} */ p)=>{const u=new URLSearchParams();const all={period:m.period==='day'?null:m.period,ch:m.channel,...p};for(const [k,v] of Object.entries(all))if(v)u.set(k,v);const x=u.toString();return base+(x?`?${x}`:'');};
 const periods=html`<nav class="ftabs" aria-label="${ko?'기간':'Period'}">${Object.entries(BEST_PERIODS).map(([k,v])=>html`<a href="${qs({period:k==='day'?null:k})}"${m.period===k?html` class="on" aria-current="page"`:''}>${/** @type {any} */(v)[l]}</a>`)}</nav>`;
 const chs=html`<nav class="ftabs chf" aria-label="${ko?'채널':'Channel'}"><a href="${qs({ch:null})}"${!m.channel?html` class="on"`:''}>${s.all}</a>${BAR.map(c=>html`<a href="${qs({ch:c.id})}"${m.channel===c.id?html` class="on"`:''}>${c.names[lang]}</a>`)}</nav>`;
 const list=box({title:ko?'★ 념글':'★ Best posts',extra:periods,note:s.bestRule},m.posts.length?html`<ol class="plist">${m.posts.map((p,i)=>html`<li class="lr"><span class="rank">${i+1}</span><a class="tt" href="${postHref(l,p)}">${kindChip(p.kind,l,p.channel_id)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a><span class="lrm"><a class="chn" href="${channelPath(l,p.channel_id)}">${channelName(p.channel_id,l)}</a>${p.tags[0]?html`<a class="rtag" href="${channelUrl(l,p.tags[0])}">${nameOf(p.tags[0],l)}</a>`:''}</span><span class="up">▲ ${p.up}</span></li>`)}</ol>`:html`<p class="empty">${ko?'이 기간에 념글이 된 글이 없습니다.':'No best posts in this period.'}</p>`);
 const body=html`<div class="narrow"><h1 class="sr-only">${ko?'전체 베스트 — 채널별 념글':'Best posts'}</h1><section class="box kwb">${chs}</section>${list}</div>`;
 return page({l,title:ko?'전체 베스트 — 채널별 념글 | Nerulio':'Best posts | Nerulio',description:ko?'AI·게임·PC·창작 도구·애니·자유 채널에서 추천을 많이 받은 글.':'Most upvoted posts across channels.',
  canonical:site.origin+qs({}),noindex:!!(m.channel||m.period!=='day'),channels:m.channels,bestOn:true,body});
}
