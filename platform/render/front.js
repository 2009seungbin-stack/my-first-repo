// @ts-check
/** Community front (/{l}/community/): best posts across channels (tab per vertical), what is
 * changing now (Radar bot news posts, or Radar changes before any post exists), new reports,
 * unanswered questions; sign-in, popular channels and tools on the right. */
import {html} from './html.js';
import {t} from './strings.js';
import {page,box,nameOf,channelUrl,postUrl,frontUrl,kindChip,monogram,TILE,badge,signInUrl} from './ui.js';
import {boardTime,compact,collapseVersions} from './format.js';
import {frontPosts,activeChannels,radarChanges,recentVersions,upcomingEvents} from '../db/channel.js';
import {dday,eventTime} from './format.js';
import {VERTICALS} from '../schema.js';
import {verticalOf} from '../verticals/index.js';
import {describeChange} from '../change-text.js';
import {label} from '../labels.js';

const DAY=864e5;
/** @param {any} db @param {{l:string,now:number,vertical?:string|null,channels?:{name:string,href:string}[]}} o */
export async function loadFront(db,o){
 const vertical=o.vertical&&VERTICALS.includes(/** @type {any} */(o.vertical))?o.vertical:null;
 const best=await frontPosts(db,{mode:'best',vertical,since:o.now-3*DAY,limit:15});
 const news=await frontPosts(db,{mode:'news',limit:8});
 // One line per entity and kind (several schedule edits to one work read as one).
 const seen=new Set();
 const changes=news.length?[]:(await radarChanges(db,{limit:30,minImportance:2})).filter(c=>{const k=`${c.entity_id}|${c.kind}`;return seen.has(k)?false:(seen.add(k),true);}).slice(0,8);
 const reports=await frontPosts(db,{mode:'kind',kind:'report',limit:6});
 const questions=await frontPosts(db,{mode:'kind',kind:'question',unanswered:true,limit:6});
 const popular=await activeChannels(db,o.now-7*DAY,10);
 // Facts that make the front useful before the boards fill up.
 const releases=collapseVersions(await recentVersions(db,{since:o.now-7*DAY,until:o.now,vertical,limit:16}),o.l).slice(0,8);
 const upcoming=await upcomingEvents(db,{from:o.now,to:o.now+7*DAY,vertical,limit:6});
 return {l:o.l,now:o.now,vertical,best,news,changes,reports,questions,popular,releases,upcoming,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadFront>>} m @param {{origin:string}} site */
export function renderFront(m,site){
 const {l,now}=m,s=t(l),base=frontUrl(l);
 const chName=(/** @type {any} */ p)=>p.entity?html`<a class="chn" href="${channelUrl(l,p.entity)}">${nameOf(p.entity,l)}</a>`:'';
 const tabs=html`<nav class="ftabs" aria-label="${s.liveBest}"><a href="${base}"${!m.vertical?html` class="on"`:''}>${s.all}</a>${VERTICALS.map(v=>html`<a href="${base}?v=${v}"${m.vertical===v?html` class="on"`:''}>${label(/** @type {any} */(verticalOf(v)).label,l)}</a>`)}</nav>`;
 const best=box({title:s.liveBest,extra:tabs},m.best.length?html`<ol class="plist">${m.best.map((p,i)=>html`<li class="lr"><span class="rank">${i+1}</span><a class="tt" href="${p.entity?postUrl(l,p.entity,p.post_no):'#'}">${kindChip(p.kind,l)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a>${chName(p)}<span class="up">▲ ${p.up}</span></li>`)}</ol>`:html`<p class="empty">${s.frontEmpty} <span class="fine">${s.bestRule}</span></p>`);
 const radar=box({title:s.changingNow,note:html`<a href="/${l}/radar/">${s.radar} ›</a>`},m.news.length?html`<ol class="plist">${m.news.map(p=>html`<li class="lr"><span class="fine">${boardTime(p.created_at,now,l)}</span><a class="tt" href="${p.entity?postUrl(l,p.entity,p.post_no):'#'}">${kindChip('news',l)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a>${chName(p)}<span class="fine">⚙</span></li>`)}</ol>`
  :m.changes.length?html`<ol class="plist">${m.changes.map(c=>{const d=describeChange(c,{name:nameOf(c.entity,l)},/** @type {'ko'|'en'} */(l));return html`<li class="lr"><span class="fine">${boardTime(c.detected_at,now,l)}</span><a class="tt" href="${channelUrl(l,c.entity)}">${d.title}${d.detail?` — ${d.detail}`:''}</a><a class="chn" href="${channelUrl(l,c.entity)}">${nameOf(c.entity,l)}</a><span class="fine" title="${l==='ko'?'공식·자동 감지':'official / auto-detected'}">⚙ ${l==='ko'?'자동':'auto'}</span></li>`;})}</ol>`:html`<p class="empty">${s.frontEmpty}</p>`);
 const small=(/** @type {string} */ title,/** @type {typeof m.reports} */ list)=>box({title},list.length?html`<ol class="rows">${list.map(p=>html`<li><a class="tt" href="${p.entity?postUrl(l,p.entity,p.post_no):'#'}">${kindChip(p.kind,l)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a>${chName(p)}<span class="fine">${boardTime(p.created_at,now,l)}</span></li>`)}</ol>`:html`<p class="empty">${s.frontEmpty}</p>`);
 const side=html`<section class="box login" data-island="account"><b>${s.loginTitle}</b><span class="fine">${s.loginNote}</span><a class="btn" href="${signInUrl(base)}" rel="nofollow">${s.continueWith('Google')}</a></section>
${box({title:s.popularChannels},m.popular.length?html`<ol class="rows">${m.popular.map((c,i)=>html`<li><span class="rank">${i+1}</span><span class="tile sm ${TILE[c.entity.vertical]||''}" aria-hidden="true">${monogram(c.entity,l)}</span><a class="tt" href="${channelUrl(l,c.entity)}">${nameOf(c.entity,l)}</a><span class="fine">${compact(c.posts,l)}</span></li>`)}</ol>`:html`<ol class="rows">${m.channels.map(c=>html`<li><a class="tt" href="${c.href}">${c.name}</a></li>`)}</ol>`)}
${box({title:l==='ko'?'분야별 채널':'Channels by area'},html`<ul class="rows">${VERTICALS.map(v=>html`<li class="vtl"><a class="tt" href="/${l}/${v}/">${label(/** @type {any} */(verticalOf(v)).label,l)}</a><span class="fine">${label(/** @type {any} */(verticalOf(v)).tagline,l)}</span></li>`)}</ul>`)}
${box({title:s.toolsBox,note:html`<a href="/${l}/">${l==='ko'?'전체 ›':'All ›'}</a>`},html`<div class="toolsg"><a href="/${l}/image/compress/">${l==='ko'?'이미지 압축':'Compress images'}</a><a href="/${l}/game/sprite-lab/">${l==='ko'?'스프라이트 랩':'Sprite Lab'}</a><a href="/${l}/game/pixel-lab/">${l==='ko'?'픽셀 랩':'Pixel Lab'}</a><a href="/${l}/game/tile-lab/">${l==='ko'?'타일 랩':'Tile Lab'}</a></div>`)}`;
 const ko=l==='ko';
 const releases=m.releases.length?box({title:ko?'이번 주 출시·업데이트':'Released this week',note:html`<a href="/${l}/radar/">${ko?'레이더 ›':'Radar ›'}</a>`},html`<ul class="rows">${m.releases.map(r=>html`<li><span class="tm">${boardTime(r.released_at,now,l)}</span><a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)} <b>${r.version}</b></a></li>`)}</ul>`):'';
 const upcoming=m.upcoming.length?box({title:ko?'이번 주 일정':'This week'},html`<ul class="rows">${m.upcoming.map(ev=>html`<li class="ev"><span class="dday">${dday(ev.starts_at,now,l)}</span><a class="tt" href="${channelUrl(l,/** @type {any} */(ev.entity))}">${ev.title[l]||ev.title.en}</a><span class="fine">${eventTime(ev.starts_at,ev.precision,l)}</span></li>`)}</ul>`):'';
 const body=html`<div class="front"><main class="mainc"><h1 class="sr-only">${m.l==='ko'?'Nerulio 커뮤니티':'Nerulio community'}</h1>${best}${radar}<div class="g2">${releases}${upcoming}</div><div class="g2">${small(s.newReports,m.reports)}${small(s.openQuestions,m.questions)}</div></main><aside class="side">${side}</aside></div>`;
 const title=l==='ko'?'Nerulio 커뮤니티 — AI·게임·하드웨어·창작 채널':'Nerulio community — AI, games, hardware and creator channels';
 const other=l==='ko'?'en':'ko';
 return page({l,title,description:l==='ko'?'채널별 실시간 소식, 공식 정보와 커뮤니티 리포트.':'Live changes, official facts and community reports per channel.',canonical:site.origin+base+(m.vertical?`?v=${m.vertical}`:''),
  alternates:{[l]:site.origin+base,[other]:site.origin+frontUrl(other),'x-default':site.origin+frontUrl('en')},noindex:!!m.vertical,channels:m.channels,homeOn:true,body});
}

/** 념글 periods (today = the rolling 24 hours the ★ rule uses). */
export const BEST_PERIODS=Object.freeze({day:{days:1,ko:'오늘',en:'Today'},week:{days:7,ko:'이번 주',en:'This week'},month:{days:30,ko:'이번 달',en:'This month'}});
/** @param {any} db @param {{l:string,now:number,period:string,vertical?:string|null,channels?:{name:string,href:string}[]}} o */
export async function loadBest(db,o){
 const period=Object.prototype.hasOwnProperty.call(BEST_PERIODS,o.period)?o.period:'day';
 const vertical=o.vertical&&VERTICALS.includes(/** @type {any} */(o.vertical))?o.vertical:null;
 const days=/** @type {any} */(BEST_PERIODS)[period].days;
 return {l:o.l,now:o.now,period,vertical,posts:await frontPosts(db,{mode:'best',vertical,since:o.now-days*DAY,limit:50}),channels:o.channels||[]};
}
/** @param {Awaited<ReturnType<typeof loadBest>>} m @param {{origin:string}} site */
export function renderBest(m,site){
 const {l,now}=m,s=t(l),ko=l==='ko',base=`/${l}/community/best/`;
 const qs=(/** @type {Record<string,string|null>} */ p)=>{const u=new URLSearchParams();const all={period:m.period==='day'?null:m.period,v:m.vertical,...p};for(const [k,v] of Object.entries(all))if(v)u.set(k,v);const x=u.toString();return base+(x?`?${x}`:'');};
 const periods=html`<nav class="ftabs" aria-label="${ko?'기간':'Period'}">${Object.entries(BEST_PERIODS).map(([k,v])=>html`<a href="${qs({period:k==='day'?null:k})}"${m.period===k?html` class="on" aria-current="page"`:''}>${/** @type {any} */(v)[l]}</a>`)}</nav>`;
 const verts=html`<nav class="ftabs" aria-label="${ko?'분야':'Area'}"><a href="${qs({v:null})}"${!m.vertical?html` class="on"`:''}>${s.all}</a>${VERTICALS.map(v=>html`<a href="${qs({v})}"${m.vertical===v?html` class="on"`:''}>${label(/** @type {any} */(verticalOf(v)).label,l)}</a>`)}</nav>`;
 const list=box({title:ko?'★ 념글':'★ Best posts',extra:periods,note:s.bestRule},m.posts.length?html`<ol class="plist">${m.posts.map((p,i)=>html`<li class="lr"><span class="rank">${i+1}</span><a class="tt" href="${p.entity?postUrl(l,p.entity,p.post_no):'#'}">${kindChip(p.kind,l)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a>${p.entity?html`<a class="chn" href="${channelUrl(l,p.entity)}">${nameOf(p.entity,l)}</a>`:''}<span class="up">▲ ${p.up}</span></li>`)}</ol>`:html`<p class="empty">${ko?'이 기간에 념글이 된 글이 없습니다.':'No best posts in this period.'}</p>`);
 const body=html`<div class="narrow"><section class="box kwb">${verts}</section>${list}</div>`;
 return page({l,title:ko?'념글 — 채널별 베스트 글 | Nerulio':'Best posts | Nerulio',description:ko?'AI·게임·하드웨어·스튜디오·서브컬처 채널에서 추천을 많이 받은 글.':'Most upvoted posts across channels.',
  canonical:site.origin+qs({}),noindex:!!(m.vertical||m.period!=='day'),channels:m.channels,body});
}
