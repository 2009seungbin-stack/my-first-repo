// @ts-check
/** Channel page (/{l}/{vertical}/{slug}/): header → the channel's live panel → what people are
 * talking about → 말머리 tabs and the board, with the channel wiki on the right. The same entity is
 * the wiki page and the board (게시판), so SEO text and community live on one URL. */
import {html} from './html.js';
import {t} from './strings.js';
import {page,box,nameOf,channelUrl,postUrl,postRow,monogram,TILE,officialLinks,signInUrl} from './ui.js';
import {compact} from './format.js';
import {pickFact,factsFor,channelPosts,channelStats,recentTitles,contentCounts,relatedChannels,koAlias,SORTS} from '../db/channel.js';
import {PREDICATES} from '../schema.js';
import {indexable} from '../seo.js';
import {channelJsonLd} from './jsonld.js';
import {panelFor} from './panels/index.js';
import {POST_KINDS,writableKinds,channelBestThreshold,BEST_RULE,boardOpen} from '../community.js';
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
 * @param {{l:string,now:number,kind?:string|null,sort?:string,best?:boolean,page?:number,channels?:{name:string,href:string,on?:boolean}[]}} o
 */
export async function loadChannel(db,entity,o){
 const region=o.l==='ko'?'KR':'US';
 const facts=(await factsFor(db,[entity.id])).get(entity.id)||[];
 const ctx={db,entity,facts,l:o.l,now:o.now,region};
 const panel=panelFor(entity);
 const kind=o.kind&&Object.prototype.hasOwnProperty.call(POST_KINDS,o.kind)?o.kind:null,sort=SORTS.includes(/** @type {any} */(o.sort))?/** @type {string} */(o.sort):'new';
 // Independent reads run together: on D1 every query is a round trip.
 const [data,board,stats,titles,counts,bestMin,relatedList,alias]=await Promise.all([panel.load(ctx),
  channelPosts(db,entity.id,{kind,sort,best:!!o.best,page:o.page||1,limit:PAGE_SIZE,now:o.now}),
  channelStats(db,entity.id,dayStart(o.now,o.l)),recentTitles(db,entity.id,o.now-2*864e5),contentCounts(db,entity.id),
  channelBestThreshold(db,entity.id,o.now),relatedChannels(db,entity.id,8),o.l==='ko'?koAlias(db,entity.id,nameOf(entity,'ko')):Promise.resolve(null)]);
 const index=indexable(entity,{...counts,description:!!(entity.descriptions[o.l]||entity.descriptions.en)});
 return {entity,ctx,panel,data,index,bestMin,relatedList,alias,kind,sort,best:!!o.best,page:Math.max(1,Math.floor(o.page||1)),board,stats,trending:trendingTerms(titles,nameOf(entity,o.l)),channels:o.channels||[]};
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
 const open=boardOpen(e);
 const base=channelUrl(l,e);
 const q=(/** @type {Record<string,string|number|null>} */ p)=>{const u=new URLSearchParams();/** @type {Record<string,string|number|null>} */const all={kind:m.kind,sort:m.sort==='new'?null:m.sort,best:m.best?1:null,...p};for(const [k,x] of Object.entries(all))if(x!==null&&x!==undefined&&x!=='')u.set(k,String(x));const str=u.toString();return str?`${base}?${str}`:base;};
 const live=m.panel.live?.(m.data,ctx)||false;
 const subtitle=td?label(td.label,l):'';
 const desc=e.descriptions[l]||e.descriptions.en||'';
 const header=html`<section class="box chh"><span class="tile ${TILE[e.vertical]||''}" aria-hidden="true">${monogram(e,l)}</span>
<div class="chm"><div class="chn1"><h1>${s.channel(name)}${m.alias?html` <span class="ha">${m.alias}</span>`:''}</h1><span class="fine">${v&&label(v.label,l)===subtitle?'':subtitle}${v?html`${label(v.label,l)===subtitle?'':' · '}<a href="/${l}/${e.vertical}/">${label(v.label,l)}</a>`:''}</span>${live?html`<span class="live"><i></i>${s.live}</span>`:''}</div>
<span class="fine">${s.followers} <span data-followers="${m.stats.followers}">${compact(m.stats.followers,l)}</span> · ${s.today} ${compact(m.stats.today,l)} · ${s.posts} ${compact(m.stats.total,l)}</span>${desc?html`<p class="desc">${desc}</p>`:''}</div>
<div class="cha" data-island="follow" data-entity="${e.id}"><a class="btn" href="${signInUrl(base)}" rel="nofollow" data-signin>${s.follow}</a>${open?html`<a class="btn p" href="${base}write">${s.write}</a>`:''}</div></section>`;
 const kinds=writableKinds(e.vertical).concat(['news']).filter((k,i,a)=>a.indexOf(k)===i);
 // Tag, sort, 념글 and page links are noindex views: nofollow keeps crawlers on the channels.
 const tabOrder=Object.keys(POST_KINDS).filter(k=>kinds.includes(k));
 const tabs=html`<nav class="mtabs" aria-label="${l==='ko'?'말머리':'Tags'}"><a href="${q({kind:null})}"${!m.kind?html` class="on" aria-current="page"`:''}>${s.all}</a>${tabOrder.map(k=>html`<a rel="nofollow" href="${q({kind:k,page:null})}"${m.kind===k?html` class="on" aria-current="page"`:''}>${/** @type {any} */(s.kind)[k]}</a>`)}</nav>`;
 const sortBar=html`<div class="sb">${[['new',s.sortNew],['hot',s.sortHot],['top',s.sortTop],['activity',s.sortActivity]].map(([k,lab])=>html`<a rel="nofollow" href="${q({sort:k==='new'?null:k,page:null})}"${m.sort===k&&!m.best?html` class="on"`:''}>${lab}</a>`)}<span class="sp"></span><a rel="nofollow" class="best${m.best?' on':''}" href="${q({best:m.best?null:1,page:null})}" title="${l==='ko'?`★ 념글: 24시간 안에 추천 ${m.bestMin} 이상, 추천 비율 ${BEST_RULE.minRatio*100}% 이상 (이 채널 최근 7일 활동 기준)`:`★ Best: ${m.bestMin}+ upvotes and ${BEST_RULE.minRatio*100}%+ ratio within 24 h (this channel's last 7 days)`}">${s.best}</a></div>`;
 const rows=m.board.posts.map(p=>postRow(p,{l,now,href:postUrl(l,e,p.post_no)}));
 const pager=m.page>1||m.board.more?html`<nav class="pager" aria-label="${s.page}">${m.page>1?html`<a class="btn" rel="nofollow" href="${q({page:m.page-1===1?null:m.page-1})}">‹ ${s.prev}</a>`:''}<span class="fine">${m.page}</span>${m.board.more?html`<a class="btn" rel="nofollow" href="${q({page:m.page+1})}">${s.next} ›</a>`:''}</nav>`:'';
 const boardBox=html`<section class="box board" id="board">${tabs}${sortBar}<div class="newbar" data-island="new-posts" data-entity="${e.id}" hidden></div>
<ol class="plist" aria-label="${s.channel(name)}"><li class="pr ph" aria-hidden="true"><span class="no">${s.colNo}</span><span class="tt">${s.colTitle}</span><span class="nick">${s.colAuthor}</span><span class="num w">${s.colDate}</span><span class="num v">${s.colViews}</span><span class="num u">${s.colUp}</span></li>${rows}</ol>
${open?'':html`<p class="empty closed">${l==='ko'?'이 채널 게시판은 준비 중입니다. 정보와 변경 기록, “✓ 작동” 같은 원클릭 리포트는 계속 쓸 수 있어요.':'This channel\'s board opens later. Facts, history and one-click reports work already.'}</p>`}${rows.length||!open?'':html`<p class="empty">${m.kind||m.best?s.emptyKind:s.emptyBoard}</p>`}${pager}</section>`;
 const trending=m.trending.length?html`<section class="box kwb"><b>${s.trending}</b>${m.trending.map(k=>html`<a class="kw" href="/${l}/search/?in=${encodeURIComponent(e.id)}&amp;q=${encodeURIComponent(k)}">${k}</a>`)}</section>`:'';
 const wikiRows=m.panel.wiki(m.data,ctx);
 const links=officialLinks(e.official_urls,l);
 const lastSeen=Math.max(0,...ctx.facts.map(f=>f.observed_at||0));
 const wiki=html`<section class="box wiki"><div class="bh wbh"><h2>${s.wiki(name)}</h2><a class="x" href="${base}history">${lastSeen?html`<span>${l==='ko'?`${dateText(lastSeen,'day',l).slice(5)} 확인`:`checked ${dateText(lastSeen,'day',l)}`}</span> · `:''}${s.history}</a></div>${wikiRows}
${links.length?html`<div class="links"><h3 class="wh">${s.official}</h3>${links}</div>`:''}${proposeForm(e,l,td?.props||[])}</section>`;
 const toolIds=(ENTITY_TOOLS[e.id]||(e.type==='game'?[]:td?.tools||[])).filter(id=>id in TOOL_PATHS);
 const tools=toolIds.length?box({title:s.toolsBox},html`<ul class="rows">${toolIds.map(id=>html`<li><a class="tt" href="/${l}/${TOOL_PATHS[id]||id}/">${TOOL_NAMES[id]?.[/** @type {'ko'|'en'} */(l)]||id}</a></li>`)}</ul>`):'';
 const rel=m.relatedList.length?box({title:s.related},html`<ul class="rows">${m.relatedList.map(r=>{const pd=/** @type {any} */(PREDICATES)[r.predicate];const how=pd?label(r.dir==='out'?pd:pd.inverse,l):'';return html`<li><a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)}</a><span class="fine">${how}</span></li>`;})}</ul>`):'';
 const body=html`${header}<div class="cols"><main class="mainc">${m.panel.top(m.data,ctx)}${trending}${boardBox}</main><aside class="side">${wiki}${m.panel.side?.(m.data,ctx)}${rel}${tools}</aside></div>`;
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
 const canonical=site.origin+(m.kind||m.sort!=='new'||m.best||m.page>1?q({}):base);
 return page({l,title,description,canonical,alternates:{[l]:site.origin+base,[other]:site.origin+channelUrl(other,e),'x-default':site.origin+channelUrl('en',e)},
  noindex:!!(m.kind||m.sort!=='new'||m.best||m.page>1)||!m.index,channels:m.channels.map(c=>({...c,on:c.href===base})),scope:{name,id:e.id},body,
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
