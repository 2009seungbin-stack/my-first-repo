// @ts-check
/** Community front (/{l}/community/): ★ 전체 베스트 (today, this week, this month; per channel), then every
 * channel with its 말머리 and newest posts, the 공지·건의 line; on the right sign-in, the reader's pinned
 * channels, the week's popular tags, Radar news and this week's schedule (docs/n2/CHANNELS.md). */
import {html,raw} from './html.js';
import {t} from './strings.js';
import {page,box,nameOf,channelUrl,postHref,frontUrl,kindChip,signInUrl,channelTile,channelName} from './ui.js';
import {buttonsHTML} from '../../src/signin-brands.js';
import {boardTime,compact,dday,eventTime} from './format.js';
import {frontPosts,boardPosts,noticesOf,popularTags,entitiesByIds,radarChanges,upcomingEvents,typeCounts} from '../db/channel.js';
import {CHANNELS,channelById,channelPath,flairLabel,FEATURED_TAGS,patchCollectionPath} from '../channels.js';
import {typeDef} from '../verticals/index.js';
import {describeChange} from '../change-text.js';
import {label} from '../labels.js';

const DAY=864e5;
/** 념글 periods (today = the rolling 24 hours the ★ rule uses). */
export const BEST_PERIODS=Object.freeze({day:{days:1,ko:'오늘',en:'Today'},week:{days:7,ko:'이번 주',en:'This week'},month:{days:30,ko:'이번 달',en:'This month'}});
const BAR=CHANNELS.filter(c=>c.inBar);

/** @param {any} db @param {{l:string,now:number,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadFront(db,o){
 // Independent reads run together: on D1 every query is a round trip.
 const [best,latest,types,notice,popular,news,radar,upcoming]=await Promise.all([
  frontPosts(db,{mode:'best',since:o.now-DAY,limit:10}),
  Promise.all(BAR.map(c=>boardPosts(db,{channel:c.id,limit:3,fold:true}).then(r=>r.posts))),
  Promise.all(BAR.map(c=>c.vertical?typeCounts(db,c.vertical):Promise.resolve({}))),
  noticesOf(db,'notice',1),popularTags(db,{since:o.now-7*DAY,limit:10}),frontPosts(db,{mode:'news',limit:5}),radarChanges(db,{limit:12,minImportance:2}),
  upcomingEvents(db,{from:o.now,to:o.now+7*DAY,limit:6})]);
 // A quiet week still shows tags to start from.
 const used=new Set(popular.map(p=>p.entity.id));
 const featured=[...(await entitiesByIds(db,['service:claude','gpu:rtx-5070','game:steam-2379780','service:claude-code','work:the-apothecary-diaries-tv-s3','runtime:ollama','app:godot'].filter(id=>!used.has(id)))).values()];
 const seen=new Set();
 const changes=news.length?[]:radar.filter(c=>{const k=`${c.entity_id}|${c.kind}`;return seen.has(k)?false:(seen.add(k),true);}).slice(0,5);
 return {l:o.l,now:o.now,best,latest:BAR.map((c,i)=>({ch:c,posts:latest[i],types:/** @type {Record<string,number>} */(types[i])})),notice:notice[0]||null,
  tags:[...popular.map(p=>p.entity),...featured].slice(0,10),news,changes,upcoming,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadFront>>} m @param {{origin:string,providers?:string[]}} site */
export function renderFront(m,site){
 const {l,now}=m,s=t(l),ko=l==='ko',lang=ko?'ko':'en',base=frontUrl(l);
 const periods=html`<nav class="ftabs" aria-label="${ko?'기간':'Period'}">${Object.entries(BEST_PERIODS).map(([k,v])=>html`<a href="${base}best/${k==='day'?'':`?period=${k}`}"${k==='day'?html` class="on"`:''}>${/** @type {any} */(v)[l]}</a>`)}</nav>`;
 const chTabs=html`<nav class="ftabs chf" aria-label="${ko?'채널':'Channel'}"><a class="on" href="${base}best/">${s.all}</a>${BAR.map(c=>html`<a href="${base}best/?ch=${c.id}">${c.names[lang]}</a>`)}</nav>`;
 const bestRow=(/** @type {typeof m.best[number]} */ p,/** @type {number} */ i)=>html`<li class="lr"><span class="rank">${i+1}</span><a class="tt" href="${postHref(l,p)}">${kindChip(p.kind,l,p.channel_id)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a><span class="lrm"><a class="chn" href="${channelPath(l,p.channel_id)}">${channelName(p.channel_id,l)}</a>${p.tags[0]?html`<a class="rtag" href="${channelUrl(l,p.tags[0])}">${nameOf(p.tags[0],l)}</a>`:''}</span><span class="up">▲ ${p.up}</span></li>`;
 const best=box({title:ko?'★ 전체 베스트':'★ Best everywhere',extra:periods},html`${chTabs}${m.best.length?html`<ol class="plist">${m.best.map(bestRow)}</ol>`:html`<p class="empty">${ko?'오늘 념글이 된 글이 아직 없어요.':'No best posts today yet.'}</p>`}<p class="fine pad">${ko?'★ 념글 = 채널마다 24시간 안에 추천 기준 이상 + 추천 비율 70% 이상. 기준은 그 채널 최근 7일 활동으로 정해져요(5~100).':'★ Best = within 24 h, the channel\'s upvote bar and a 70%+ ratio. The bar follows the channel\'s last 7 days (5–100).'}</p>`);
 const typeText=(/** @type {import('../channels.js').Channel} */ c,/** @type {Record<string,number>} */ types)=>{
  const total=Object.values(types).reduce((a,b)=>a+b,0);if(!c.vertical)return ko?'모든 태그 선택 가능':'Any tag';
  return `${ko?`태그 ${compact(total,l)}개`:`${compact(total,l)} tags`} · ${Object.entries(types).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([type,n])=>{const td=typeDef(/** @type {string} */(c.vertical),type);return `${td?label(td.label,l):type} ${n}`;}).join(' · ')}`;
 };
 const channelBox=(/** @type {typeof m.latest[number]} */ x)=>html`<section class="box chbox"><div class="bh">${channelTile(x.ch.id,l)}<h2><a href="${channelPath(l,x.ch.id)}">${x.ch.names[lang]}</a></h2><span class="x">${x.ch.desc[lang]}</span><button type="button" class="btn sm pin" data-pin="${x.ch.id}" aria-pressed="false"><span class="p0">${ko?'고정':'Pin'}</span><span class="p1">✓ ${ko?'고정됨':'Pinned'}</span></button></div>
<nav class="fl" aria-label="${ko?'말머리':'Flairs'}">${x.ch.flairs.map(k=>html`<a rel="nofollow" href="${channelPath(l,x.ch.id)}?kind=${k}">${flairLabel(x.ch.id,k,l)}</a>`)}</nav>
${x.posts.length?html`<ol class="rows">${x.posts.map(p=>html`<li><a class="tt" href="${postHref(l,p)}">${kindChip(p.kind,l,p.channel_id)}${p.best_at?html`<span class="star">★ </span>`:''}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a><span class="fine">${boardTime(p.created_at,now,l)}</span></li>`)}</ol>`:html`<p class="empty">${ko?'아직 글이 없어요. 첫 글을 써 보세요.':'No posts yet. Write the first one.'}</p>`}
<p class="pad chfoot"><span class="fine">${typeText(x.ch,x.types)}</span><a href="${channelPath(l,x.ch.id)}">${ko?'채널 가기':'Open'} ›</a></p></section>`;
 const notice=html`<section class="box nline"><span class="tile ch-notice" aria-hidden="true">${ko?'공':'N'}</span><a href="${channelPath(l,'notice')}"><b>${ko?'공지·건의':'Notices & feedback'}</b></a><span class="fine">${ko?'운영 공지, 사이트·도구 건의 — 공지는 각 채널 맨 위에 1개만 고정':'Announcements and site feedback — one notice is pinned at the top of each channel'}</span>${m.notice?html`<a class="tt" href="${postHref(l,m.notice)}">${kindChip('notice',l)}${m.notice.title}</a>`:''}</section>`;
 const login=html`<section class="box login" data-island="account"><b>${ko?'로그인하면 채널 구독·알림':s.loginTitle}</b><span class="fine">${ko?'로그인 없이도 ㅇㅇ (오늘의 ID)로 글과 댓글을 쓸 수 있어요.':'Without an account you can still post as ㅇㅇ (today\'s ID).'}</span>${site.providers?.length?raw(buttonsHTML(site.providers,l,base)):html`<a class="btn" href="${signInUrl(base)}" rel="nofollow" data-signin>${s.login}</a>`}</section>`;
 const mine=box({title:ko?'내 채널':'My channels',note:html`<button type="button" class="lnk" data-open-sheet aria-controls="chsheet">${ko?'편집':'Edit'}</button>`},html`<ul class="rows mych" data-my-channels-side><li><a class="tt" href="${patchCollectionPath(l)}">${ko?'한글패치 모음':'Korean patches'}</a><span class="fine">${ko?'게임 · [한글패치]':'Games · [Korean patch]'}</span></li></ul><p class="fine pad">${ko?'채널의 “고정”을 누르면 채널 바 앞에 와요. 로그인 없이도 이 브라우저에 저장돼요.':'Pinned channels come first on the bar; without an account they stay in this browser.'}</p>`);
 const tags=box({title:ko?'인기 태그 · 이번 주':'Popular tags this week'},html`<p class="pad tagl">${m.tags.map(e=>html`<a class="rtag" href="${channelUrl(l,e)}">${nameOf(e,l)}</a>`)}</p>`);
 const radar=box({title:ko?'레이더 소식':'Radar news',note:html`<a href="/${l}/radar/">${s.radar} ›</a>`},m.news.length?html`<ol class="rows">${m.news.map(p=>html`<li><span class="tm">${boardTime(p.created_at,now,l)}</span><a class="tt" href="${postHref(l,p)}">${p.title}</a><span class="fine">${channelName(p.channel_id,l)}</span></li>`)}</ol>`
  :m.changes.length?html`<ol class="rows">${m.changes.map(c=>{const d=describeChange(c,{name:nameOf(c.entity,l)},/** @type {'ko'|'en'} */(l));return html`<li><span class="tm">${boardTime(c.detected_at,now,l)}</span><a class="tt" href="${channelUrl(l,c.entity)}">${d.title}</a><span class="fine">${channelName(channelById(c.vertical==='hardware'?'hw':c.vertical==='subculture'?'sub':c.vertical)?.id||'free',l)}</span></li>`;})}</ol>`:html`<p class="empty">${s.frontEmpty}</p>`);
 const upcoming=m.upcoming.length?box({title:ko?'이번 주 일정':'This week'},html`<ul class="rows">${m.upcoming.map(ev=>html`<li class="ev"><span class="dday">${dday(ev.starts_at,now,l)}</span><a class="tt" href="${channelUrl(l,/** @type {any} */(ev.entity))}">${ev.title[l]||ev.title.en}</a><span class="fine">${eventTime(ev.starts_at,ev.precision,l)}</span></li>`)}</ul>`):'';
 const body=html`<div class="front"><main class="mainc"><h1 class="fh">${ko?'Nerulio 커뮤니티':'Nerulio community'}</h1>${best}<h2 class="fsub" id="channels">${ko?'글은 큰 채널에, 무엇에 대한 글인지는 태그로':'Posts live in big channels; tags say what they are about'}</h2><div class="chgrid">${m.latest.map(channelBox)}</div>${notice}</main><aside class="side">${login}${mine}${tags}${radar}${upcoming}</aside></div>`;
 const title=ko?'Nerulio 커뮤니티 — AI·게임·PC·창작 도구·애니 채널':'Nerulio community — AI, games, PC, creator tools and anime';
 const other=ko?'en':'ko';
 return page({l,title,description:ko?'AI·게임·PC·하드웨어·창작 도구·애니·서브컬처·자유 채널. 말머리와 태그로 골라 보는 커뮤니티.':'AI, games, PC & hardware, creator tools, anime and free-talk channels, filtered by flair and tag.',canonical:site.origin+base,
  alternates:{[l]:site.origin+base,[other]:site.origin+frontUrl(other),'x-default':site.origin+frontUrl('en')},channels:m.channels,homeOn:true,body});
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
