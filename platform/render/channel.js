// @ts-check
/** Tag page (/{l}/{vertical}/{slug}/): an entity's live panel, what people are talking about, and the
 * posts tagged with it in every channel (with its parts: Claude → its plans, features and models), with
 * the wiki on the right. Writing from here opens the entity's default channel with the tag picked
 * (docs/n2/CHANNELS.md). The URL is the same as when every entity had its own board. */
import {html} from './html.js';
import {t} from './strings.js';
import {page,box,nameOf,channelUrl,postHref,postRow,boardHead,kindChip,monogram,TILE,officialLinks,signInUrl,channelName} from './ui.js';
import {compact} from './format.js';
import {pickFact,factsFor,boardPosts,channelStats,recentTitles,contentCounts,relatedChannels,koAlias,tagChildren,SORTS} from '../db/channel.js';
import {PREDICATES} from '../schema.js';
import {indexable} from '../seo.js';
import {channelJsonLd} from './jsonld.js';
import {panelFor} from './panels/index.js';
import {POST_KINDS,channelBestThreshold,BEST_RULE} from '../community.js';
import {defaultChannelOf,channelById,channelPath,writePath,flairLabel} from '../channels.js';
import {typeDef,verticalOf,propertyDef} from '../verticals/index.js';
import {label} from '../labels.js';
import {TZ,dateText,factText} from './format.js';

export const PAGE_SIZE=30;
/** Start of the reader's day in ms (Korea time for ko). @param {number} now @param {string} l */
export function dayStart(now,l){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ[l]||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));
 return now-((+p.hour*60+ +p.minute)*60+ +p.second)*1000-now%1000;
}

/**
 * Everything the channel page needs, read once (the page is edge-cached for anonymous readers).
 * @param {any} db @param {import('../db/channel.js').Entity} entity
 * @param {{l:string,now:number,kind?:string|null,sort?:string,best?:boolean,page?:number,children?:boolean,channels?:{name:string,href:string,on?:boolean,id?:string}[]}} o
 */
export async function loadChannel(db,entity,o){
 const region=o.l==='ko'?'KR':'US';
 const facts=(await factsFor(db,[entity.id])).get(entity.id)||[];
 const ctx={db,entity,facts,l:o.l,now:o.now,region};
 const panel=panelFor(entity);
 const kind=o.kind&&Object.prototype.hasOwnProperty.call(POST_KINDS,o.kind)?o.kind:null,sort=SORTS.includes(/** @type {any} */(o.sort))?/** @type {string} */(o.sort):'new';
 const home=defaultChannelOf(entity,facts),children=o.children!==false;
 // Independent reads run together: on D1 every query is a round trip.
 const [data,board,stats,titles,counts,bestMin,relatedList,alias,parts,tagBest]=await Promise.all([panel.load(ctx),
  boardPosts(db,{tag:entity.id,children,kind,sort,best:!!o.best,page:o.page||1,limit:PAGE_SIZE,now:o.now}),
  channelStats(db,entity.id,dayStart(o.now,o.l)),recentTitles(db,{tag:entity.id},o.now-2*864e5),contentCounts(db,entity.id),
  channelBestThreshold(db,home,o.now),relatedChannels(db,entity.id,8),o.l==='ko'?koAlias(db,entity.id,nameOf(entity,'ko')):Promise.resolve(null),
  tagChildren(db,entity.id,40),boardPosts(db,{tag:entity.id,best:true,sort:'top',limit:5})]);
 const index=indexable(entity,{...counts,description:!!(entity.descriptions[o.l]||entity.descriptions.en)});
 return {entity,ctx,panel,data,index,bestMin,relatedList,alias,kind,sort,best:!!o.best,children,home,parts,tagBest:tagBest.posts,page:Math.max(1,Math.floor(o.page||1)),board,stats,trending:trendingTerms(titles,nameOf(entity,o.l)),channels:o.channels||[]};
}

const STOP=new Set(['the','and','for','with','this','that','what','how','why','are','you','is','in','on','of','to','a','an','it','질문','후기','정리','이거','이게','그냥','근데','진짜','혹시','어떻게','뭐가','있나요','되나요','있음','없음','해봄','ㅋㅋ','ㅠㅠ','vs','다시','최신','새','후','이번','오늘','지금','같음','좋아짐','해봤는데']);
/**
 * "지금 많이 말하는 것": the words (and two-word phrases) repeated across recent post titles,
 * weighted by comments and upvotes. Shown only when at least two posts share a term.
 * @param {{title:string,weight:number}[]} titles @param {string} channelName
 */
export function trendingTerms(titles,channelName){
 const skip=new Set(channelName.toLowerCase().split(/\s+/));
 /** @type {Map<string,{w:number,n:number,label:string}>} */const score=new Map();
 for(const {title,weight} of titles){
  const words=title.replace(/(\d)[.,](?=\d)/g,'$1\u2024').replace(/[\[\](){}"'“”‘’!?.,:;~…|/]+/g,' ').replace(/\u2024/g,'.').split(/\s+/).filter(Boolean).map(w=>{const x=w.replace(/(은|는|이|가|을|를|에|에서|로|으로|도|만|의|랑|과|와|요)$/,'');return [...x].length>=2?x:w;});
  const seen=new Set();
  for(let i=0;i<words.length;i++){
   for(const n of [1,2]){
    const parts=words.slice(i,i+n);if(parts.length<n)continue;
    const key=parts.join(' ').toLowerCase();
    if(parts.some(p=>STOP.has(p.toLowerCase())||skip.has(p.toLowerCase()))||[...key].length<2||/^\d+$/.test(key)||seen.has(key))continue;
    seen.add(key);
    const s=score.get(key)||{w:0,n:0,label:parts.join(' ')};s.w+=weight*(n===2?1.3:1);s.n++;score.set(key,s);
   }
  }
 }
 const ranked=[...score.entries()].filter(([,s])=>s.n>=2).sort((a,b)=>b[1].w-a[1].w);
 /** @type {string[]} */const out=[];
 for(const [key,s] of ranked){if(out.some(o=>o.toLowerCase().includes(key)||key.includes(o.toLowerCase())))continue;out.push(s.label);if(out.length===6)break;}
 return out;
}

/** @param {Awaited<ReturnType<typeof loadChannel>>} m @param {{origin:string}} site */
export function renderChannel(m,site){
 const {entity:e,ctx}=m,{l,now}=ctx,s=t(l);
 const name=nameOf(e,l),v=verticalOf(e.vertical),td=typeDef(e.vertical,e.type);
 const base=channelUrl(l,e);
 const q=(/** @type {Record<string,string|number|null>} */ p)=>{const u=new URLSearchParams();/** @type {Record<string,string|number|null>} */const all={kind:m.kind,sort:m.sort==='new'?null:m.sort,best:m.best?1:null,sub:m.children?null:0,...p};for(const [k,x] of Object.entries(all))if(x!==null&&x!==undefined&&x!=='')u.set(k,String(x));const str=u.toString();return str?`${base}?${str}`:base;};
 const live=m.panel.live?.(m.data,ctx)||false;
 const subtitle=td?label(td.label,l):'';
 const desc=e.descriptions[l]||e.descriptions.en||'';
 const header=html`<section class="box chh"><span class="tile ${TILE[e.vertical]||''}" aria-hidden="true">${monogram(e,l)}</span>
<div class="chm"><div class="chn1"><h1>${name}${m.alias?html` <span class="ha">${m.alias}</span>`:''}</h1><span class="fine">${subtitle||(v?label(v.label,l):'')} · ${l==='ko'?html`<a href="${channelPath(l,m.home)}">${channelName(m.home,l)} 채널</a>의 태그`:html`a tag of <a href="${channelPath(l,m.home)}">${channelName(m.home,l)}</a>`}${v?html` · <a href="/${l}/${e.vertical}/">${l==='ko'?`${label(v.label,l)} 태그 모음`:`All ${label(v.label,l)} tags`}</a>`:''}</span>${live?html`<span class="live"><i></i>${s.live}</span>`:''}</div>
<span class="fine">${s.followers} <span data-followers="${m.stats.followers}">${compact(m.stats.followers,l)}</span> · ${s.today} ${compact(m.stats.today,l)} · ${s.posts} ${compact(m.stats.total,l)}</span>${desc?html`<p class="desc">${desc}</p>`:''}</div>
<div class="cha" data-island="follow" data-entity="${e.id}" data-tag-name="${name}"><a class="btn" href="${signInUrl(base)}" rel="nofollow" data-signin>${s.follow}</a><a class="btn p" href="${writePath(l,m.home,{tag:e.id})}">${l==='ko'?'이 태그로 글쓰기':'Write with this tag'}</a></div></section>`;
 // 말머리 of the tag's home channel (a post from any channel still shows; the tab filters all of them).
 const home=/** @type {import('../channels.js').Channel} */(channelById(m.home));
 // Tag, sort, 념글 and page links are noindex views: nofollow keeps crawlers on the tag pages.
 const tabs=html`<nav class="mtabs" aria-label="${l==='ko'?'말머리':'Flairs'}"><a href="${q({kind:null,page:null})}"${!m.kind?html` class="on" aria-current="page"`:''}>${s.all}</a>${home.flairs.map(k=>html`<a rel="nofollow" href="${q({kind:k,page:null})}"${m.kind===k?html` class="on" aria-current="page"`:''}>${flairLabel(home.id,k,l)}</a>`)}</nav>`;
 const sortBar=html`<div class="sb">${[['new',s.sortNew],['hot',s.sortHot],['top',s.sortTop],['activity',s.sortActivity]].map(([k,lab])=>html`<a rel="nofollow" href="${q({sort:k==='new'?null:k,page:null})}"${m.sort===k&&!m.best?html` class="on"`:''}>${lab}</a>`)}<span class="sp"></span><a rel="nofollow" class="best${m.best?' on':''}" href="${q({best:m.best?null:1,page:null})}" title="${l==='ko'?`★ 념글: 24시간 안에 추천 ${m.bestMin} 이상, 추천 비율 ${BEST_RULE.minRatio*100}% 이상 (채널 최근 7일 활동 기준)`:`★ Best: ${m.bestMin}+ upvotes and ${BEST_RULE.minRatio*100}%+ ratio within 24 h (the channel's last 7 days)`}">${s.best}</a></div>`;
 const tagOn=new Set([e.id,...(m.children?m.parts.map(x=>x.id):[])]);
 const rows=m.board.posts.map(p=>postRow(p,{l,now,channel:true,tagOn}));
 const pager=m.page>1||m.board.more?html`<nav class="pager" aria-label="${s.page}">${m.page>1?html`<a class="btn" rel="nofollow" href="${q({page:m.page-1===1?null:m.page-1})}">‹ ${s.prev}</a>`:''}<span class="fine">${m.page}</span>${m.board.more?html`<a class="btn" rel="nofollow" href="${q({page:m.page+1})}">${s.next} ›</a>`:''}</nav>`:'';
 const ko=l==='ko';
 const partsText=m.parts.slice(0,4).map(x=>nameOf(x,l)).join(' · ')+(m.parts.length>4?' …':'');
 const scope=html`<div class="bh tagh"><h2>${ko?`${name} 태그 글`:`Posts tagged ${name}`}</h2><span class="x">${ko?'모든 채널에서':'From every channel'}${m.parts.length?html` · ${m.children?(ko?`하위 태그 포함 (${partsText})`:`with its parts (${partsText})`):(ko?'이 태그만':'this tag only')} · <a rel="nofollow" href="${q({sub:m.children?0:null,page:null})}">${m.children?(ko?'이 태그만 보기':'This tag only'):(ko?'하위 태그 포함':'Include parts')}</a>`:''}</span></div>`;
 const foot=html`<p class="pad tagf"><a href="${channelPath(l,home.id)}?tag=${e.id}">${ko?`${channelName(home.id,l)} 채널에서 ${name} 글 모두 보기`:`All ${name} posts in ${channelName(home.id,l)}`} ›</a><a class="btn p" href="${writePath(l,m.home,{tag:e.id})}">${ko?'이 태그로 글쓰기':'Write with this tag'}</a></p>`;
 const boardBox=html`<section class="box board" id="board">${scope}${tabs}${sortBar}
<ol class="plist" aria-label="${ko?`${name} 태그 글`:`Posts tagged ${name}`}">${boardHead(l)}${rows}</ol>
${rows.length?'':html`<p class="empty">${m.kind||m.best?s.emptyKind:(ko?`아직 ${name} 태그를 단 글이 없어요. 첫 글을 써 보세요.`:`No posts tagged ${name} yet. Write the first one.`)}</p>`}${pager}${foot}</section>`;
 const trending=m.trending.length?html`<section class="box kwb"><b>${s.trending}</b>${m.trending.map(k=>html`<a class="kw" href="/${l}/search/?in=${encodeURIComponent(e.id)}&amp;q=${encodeURIComponent(k)}">${k}</a>`)}</section>`:'';
 const wikiRows=m.panel.wiki(m.data,ctx);
 const links=officialLinks(e.official_urls,l);
 const lastSeen=Math.max(0,...ctx.facts.map(f=>f.observed_at||0));
 const wiki=html`<section class="box wiki"><div class="bh wbh"><h2>${s.wiki(name)}</h2><a class="x" href="${base}history">${lastSeen?html`<span>${l==='ko'?`${dateText(lastSeen,'day',l).slice(5)} 확인`:`checked ${dateText(lastSeen,'day',l)}`}</span> · `:''}${s.history}</a></div>${wikiRows}
${links.length?html`<div class="links"><h3 class="wh">${s.official}</h3>${links}</div>`:''}${proposeForm(e,l,td?.props||[])}</section>`;
 const toolIds=(ENTITY_TOOLS[e.id]||(e.type==='game'?[]:td?.tools||[])).filter(id=>id in TOOL_PATHS);
 const tools=toolIds.length?box({title:s.toolsBox},html`<ul class="rows">${toolIds.map(id=>html`<li><a class="tt" href="/${l}/${TOOL_PATHS[id]||id}/">${TOOL_NAMES[id]?.[/** @type {'ko'|'en'} */(l)]||id}</a></li>`)}</ul>`):'';
 const partsBox=m.parts.length?box({title:l==='ko'?'하위 태그':'Parts'},html`<p class="pad tagl">${m.parts.map(x=>html`<a class="rtag" href="${channelUrl(l,x)}">${nameOf(x,l)}</a>`)}</p><p class="pad fine">${l==='ko'?'관계 데이터(요금제·기능·모델 …)로 묶여서 위 태그 글에 함께 나와요.':'Linked by relations (plans, features, models …), so their posts show above too.'}</p>`):'';
 const bestBox=m.tagBest.length?box({title:l==='ko'?`★ ${name} 태그 념글`:`★ Best tagged ${name}`},html`<ol class="rows">${m.tagBest.map(p=>html`<li><a class="tt" href="${postHref(l,p)}">${kindChip(p.kind,l,p.channel_id)}${p.title}</a><span class="up">▲ ${p.up}</span></li>`)}</ol>`):'';
 const rel=m.relatedList.length?box({title:s.related},html`<ul class="rows">${m.relatedList.map(r=>{const pd=/** @type {any} */(PREDICATES)[r.predicate];const how=pd?label(r.dir==='out'?pd:pd.inverse,l):'';return html`<li><a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)}</a><span class="fine">${how}</span></li>`;})}</ul>`):'';
 const body=html`${header}<div class="cols"><main class="mainc">${m.panel.top(m.data,ctx)}${trending}${boardBox}</main><aside class="side">${wiki}${m.panel.side?.(m.data,ctx)}${partsBox}${bestBox}${rel}${tools}</aside></div>`;
 // The Korean spelling people type ("클로드") goes into the title and description too.
 // A feature is named with its product in the title ("음성" → "ChatGPT 음성"): the bare word is ambiguous.
 const parent=e.type==='feature'?m.relatedList.find(r=>r.predicate==='part_of'&&r.dir==='out')?.entity:null;
 const pname=parent?nameOf(parent,l):'';
 const shown=(pname&&!name.startsWith(pname)?`${pname} `:'')+(m.alias?`${name}(${m.alias})`:name);
 // The other spelling goes into the title only while the title stays short.
 const tname=m.alias&&[...m.alias].length>16?shown.replace(`(${m.alias})`,''):shown;
 const title=l==='ko'?`${tname} 채널 — ${td?label(td.label,l)+' ':''}정보·커뮤니티 | Nerulio`:`${name} — news, facts and community | Nerulio`;
 let description=(m.alias&&desc?`${shown}: ${desc}`:desc)||(l==='ko'?`${shown}의 최신 변경, 공식 정보와 커뮤니티 글.`:`Latest changes, official facts and community posts about ${name}.`);
 // A short description is filled out with the channel's own sourced facts (no invented text).
 if([...description].length<80){
  const bits=[];
  for(const p of td?.props||[]){const d=/** @type {any} */(propertyDef(e.vertical,p));if(!d||d.public===false||d.type==='url')continue;const f=pickFact(ctx.facts,p,{region:ctx.region,language:l});if(!f)continue;
   bits.push(`${label(d.label,l)} ${factText(e.vertical,f,l)}`);if(bits.length===3)break;}
  if(bits.length)description=`${description.replace(/[.。]?$/,'.')} ${bits.join(' · ')}.`;
  description+=l==='ko'?' 변경 기록과 커뮤니티 글도 함께 봅니다.':' With change history and community posts.';
 }
 const other=l==='ko'?'en':'ko';
 const filtered=!!(m.kind||m.sort!=='new'||m.best||m.page>1||!m.children);
 const canonical=site.origin+(filtered?q({}):base);
 return page({l,title,description,canonical,alternates:{[l]:site.origin+base,[other]:site.origin+channelUrl(other,e),'x-default':site.origin+channelUrl('en',e)},
  noindex:filtered||!m.index,channels:m.channels.map(c=>({...c,on:c.id===m.home})),scope:{name,id:e.id},body,
  jsonld:channelJsonLd(e,ctx.facts,l,site.origin+base,site.origin),feed:base+'feed.xml'});
}
/** Channels whose readers make things with Nerulio's game-asset tools. */
const ENTITY_TOOLS=/** @type {Record<string,string[]>} */({'app:godot':['sprite-lab','tile-lab','pixel-lab','ui-lab'],'app:blender':['texture-lab'],'app:unity':['sprite-lab','texture-lab','ui-lab'],'app:aseprite':['pixel-lab','sprite-lab']});
/** Tool ids used in vertical configs → existing tool pages (ids without a page yet are not linked). */
const TOOL_PATHS=/** @type {Record<string,string>} */({'sprite-lab':'game/sprite-lab','pixel-lab':'game/pixel-lab','tile-lab':'game/tile-lab','texture-lab':'game/texture-lab','ui-lab':'game/ui-lab'});
const TOOL_NAMES=/** @type {Record<string,{ko:string,en:string}>} */({'vram-fit':{ko:'VRAM 계산기',en:'VRAM calculator'},'sprite-lab':{ko:'스프라이트 랩',en:'Sprite Lab'},'pixel-lab':{ko:'픽셀 랩',en:'Pixel Lab'},'tile-lab':{ko:'타일 랩',en:'Tile Lab'},'texture-lab':{ko:'텍스처 랩',en:'Texture Lab'},'ui-lab':{ko:'UI 랩',en:'UI Lab'}});

/** 정보 제안: a member suggests a value with a source; a moderator accepts it into the wiki
 * (COMMUNITY_VERIFIED — an official value is never replaced). The islands send it to /api/v2/facts/propose.
 * @param {any} e @param {string} l @param {string[]} props @param {string|null} [postId] the post the value comes from
 */
export function proposeForm(e,l,props,postId=null){
 const ko=l==='ko';
 const opts=props.map(p=>({p,def:/** @type {any} */(propertyDef(e.vertical,p))})).filter(x=>x.def&&x.def.public!==false&&x.def.type!=='url');
 if(!opts.length)return '';
 return html`<details class="prop"><summary>${postId?(ko?'이 글의 내용으로 위키 정보 제안하기':'Suggest a wiki value from this post'):(ko?'틀리거나 빠진 정보가 있나요? 제안하기':'Wrong or missing? Suggest a value')}</summary>
<form class="wform" data-island="propose" data-entity="${e.id}"${postId?html` data-post="${postId}"`:''}><label>${ko?'항목':'Field'}<select name="property" required>${opts.map(x=>html`<option value="${x.p}" data-type="${x.def.type||'text'}" data-unit="${x.def.unit||''}">${label(x.def.label,l)}</option>`)}</select></label>
<label>${ko?'값':'Value'}<input name="value" required maxlength="200" placeholder="${ko?'예: 2026-10-20, 12, 공식 표기 그대로':'e.g. 2026-10-20, 12'}"></label>
<label>${ko?'통화 (가격일 때)':'Currency (prices)'}<input name="unit" maxlength="3" placeholder="USD"></label>
<label>${ko?'출처 링크 (공식 페이지 우선)':'Source link (official first)'}<input name="sourceUrl" type="url" required placeholder="https://"></label>
<label>${ko?'메모 (선택)':'Note (optional)'}<input name="note" maxlength="500"></label>
<p class="fine">${ko?'운영자가 출처를 확인한 뒤 “커뮤니티 검증” 값으로 반영합니다. 공식 값은 바꾸지 않습니다.':'A moderator checks the source before it appears as community-verified. Official values are never replaced.'}</p>
<div class="acts"><button class="btn p" type="submit">${ko?'제안 보내기':'Send'}</button></div></form></details>`;
}
