// @ts-check
/** Search (/{l}/search/?q=…&in=<channel>): channels first (alias + trigram index, so "5070",
 * "클로드" and "블루 아카이브" all work), then posts whose title matches. Scoped to one channel
 * when the header search was used inside a channel. Never indexed. */
import {html} from './html.js';
import {page,nameOf,channelUrl,postHref,box,kindChip,monogram,TILE,channelName} from './ui.js';
import {channelPath} from '../channels.js';
import {boardTime} from './format.js';
import {searchEntities,searchPosts,entitiesByIds,searchTokens} from '../db/channel.js';
import {typeDef,verticalOf} from '../verticals/index.js';
import {label} from '../labels.js';
import {ENTITY_ID} from '../schema.js';

/** Words that say what the reader wants from a channel ("Claude 장애", "5070 로컬", "GPT 가격"): the
 * page offers that page directly above the results. */
const INTENTS=/** @type {[RegExp,'status'|'price'|'local'][]} */([[/^(장애|다운|먹통|접속|안됨|안돼|오류|에러|상태|서버|outage|down|status)$/,'status'],[/^(가격|요금|요금제|구독료|구독|비용|price|pricing|plans?|cost)$/,'price'],[/^(로컬|로컬llm|로컬ai|vram|local|llm)$/,'local']]);
/** @param {string} q @returns {{intent:'status'|'price'|'local'|null,rest:string}} */
export function searchIntent(q){
 const words=String(q).trim().split(/\s+/).filter(Boolean);let intent=null;const rest=[];
 for(const w of words){const t=searchTokens(w)[0]||'';const hit=INTENTS.find(([re])=>re.test(t));if(hit&&!intent)intent=hit[1];else rest.push(w);}
 return {intent:rest.length?intent:null,rest:rest.join(' ')};
}
/** The page a query with an intent word should lead to, from the best matching channel.
 * @param {string} l @param {'status'|'price'|'local'|null} intent @param {any[]} ents */
function shortcut(l,intent,ents){
 const ko=l==='ko';
 if(intent==='status'){const e=ents.find(x=>x.type==='service');if(e)return {href:channelUrl(l,e)+'status',title:ko?`지금 ${nameOf(e,l)} 장애?`:`Is ${nameOf(e,l)} down?`,text:ko?'공식 장애 기록과 최근 24시간 사용자 리포트':'Official incidents and user reports from the last 24 hours'};}
 if(intent==='local'){const e=ents.find(x=>x.type==='gpu');if(e)return {href:channelUrl(l,e)+'local-llm',title:ko?`${nameOf(e,l)}에서 돌아가는 로컬 LLM`:`Local LLMs on ${nameOf(e,l)}`,text:ko?'모델별 VRAM 추정과 실측 토큰/초':'VRAM estimates and measured tokens/s per model'};}
 if(intent==='price'){const e=ents.find(x=>x.vertical==='ai');if(e)return {href:`/${l}/ai/?type=${e.type==='model'?'model':'plan'}`,title:ko?(e.type==='model'?'AI 모델 API 가격 비교':'AI 요금제 비교'):(e.type==='model'?'AI model API prices':'AI plan prices'),text:ko?`${nameOf(e,l)} 포함 · 공식 가격과 확인일`:`Includes ${nameOf(e,l)} · official prices with dates`};}
 return null;
}

/** @param {any} db @param {{l:string,now:number,q:string,in?:string|null,more?:boolean,channels?:{name:string,href:string}[]}} o */
export async function loadSearch(db,o){
 const q=String(o.q||'').slice(0,80).trim();
 const scope=o.in&&ENTITY_ID.test(o.in)?(await entitiesByIds(db,[o.in])).get(o.in)||null:null;
 const {intent,rest}=searchIntent(q);
 // "Claude 장애": channels for "Claude"; posts must contain every word, or else just "Claude".
 const limit=o.more?60:20;
 const entities=q&&!scope?await searchEntities(db,intent?rest:q,{limit:limit+1}):[];
 const moreChannels=entities.length>limit;if(moreChannels)entities.length=limit;
 let posts=q?await searchPosts(db,q,{entityId:scope?.id,limit:30}):[];
 if(!posts.length&&intent)posts=await searchPosts(db,rest,{entityId:scope?.id,limit:30});
 return {q,scope,entities,posts,go:shortcut(o.l,intent,scope?[scope]:entities),moreChannels,more:!!o.more,l:o.l,now:o.now,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadSearch>>} m @param {{origin:string}} site */
export function renderSearch(m,site){
 const {l,now,q,scope}=m,ko=l==='ko';
 const head=html`<section class="box"><form class="sform" role="search" action="/${l}/search/" method="get">${scope?html`<input type="hidden" name="in" value="${scope.id}"><span class="qchip">${nameOf(scope,l)}</span>`:''}<input type="search" name="q" value="${q}" aria-label="${ko?'검색어':'Search'}" placeholder="${ko?'채널, 게임, 모델, GPU, 글 검색':'Search channels, games, models, GPUs, posts'}" autofocus><button class="btn p" type="submit">${ko?'검색':'Search'}</button></form>
${scope?html`<p class="fine pad">${ko?`${nameOf(scope,l)} 채널 안에서 찾았어요. `:`Searching inside ${nameOf(scope,l)}. `}<a href="/${l}/search/?q=${encodeURIComponent(q)}">${ko?'전체에서 찾기 ›':'Search everywhere ›'}</a></p>`:''}</section>`;
 const chans=m.entities.length?box({title:ko?`채널 ${m.entities.length}`:`Channels (${m.entities.length})`},html`<ul class="rows">${m.entities.map(e=>{const td=typeDef(e.vertical,e.type),v=verticalOf(e.vertical);return html`<li><span class="tile sm ${TILE[e.vertical]||''}" aria-hidden="true">${monogram(e,l)}</span><a class="tt" href="${channelUrl(l,e)}">${nameOf(e,l)}</a><span class="fine">${[...new Set([td?label(td.label,l):'',v?label(v.label,l):''].filter(Boolean))].join(' · ')}</span></li>`;})}</ul>${m.moreChannels&&!m.more?html`<p class="pad"><a rel="nofollow" href="/${l}/search/?q=${encodeURIComponent(q)}&amp;more=1">${ko?'채널 더 보기 ›':'More channels ›'}</a></p>`:''}`):'';
 const posts=q?box({title:ko?`글 ${m.posts.length}`:`Posts (${m.posts.length})`},m.posts.length?html`<ol class="plist">${m.posts.map(p=>html`<li class="lr"><span class="fine">${boardTime(p.created_at,now,l)}</span><a class="tt" href="${postHref(l,p)}">${kindChip(p.kind,l,p.channel_id)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a><a class="chn" href="${channelPath(l,p.channel_id)}">${channelName(p.channel_id,l)}</a>${p.tags[0]?html`<a class="rtag" href="${channelUrl(l,p.tags[0])}">${nameOf(p.tags[0],l)}</a>`:''}<span class="up">${p.up?`▲ ${p.up}`:''}</span></li>`)}</ol>`:html`<p class="empty">${ko?'제목에 이 단어가 들어간 글이 없습니다.':'No post titles match.'}</p>`):'';
 const none=q&&!m.entities.length&&!m.posts.length?html`<p class="empty">${ko?'찾는 채널이 없나요? 채널은 출처가 있는 정보가 모이면 열립니다.':'Nothing found.'}</p>`:'';
 const go=m.go?html`<a class="box go" href="${m.go.href}"><b>${m.go.title} ›</b><span class="fine">${m.go.text}</span></a>`:'';
 const body=html`<div class="narrow">${head}${go}${chans}${posts}${none}</div>`;
 return page({l,title:q?(ko?`"${q}" 검색 | Nerulio`:`"${q}" — search | Nerulio`):(ko?'검색 | Nerulio':'Search | Nerulio'),description:ko?'Nerulio 채널과 글 검색':'Search Nerulio channels and posts',
  canonical:site.origin+`/${l}/search/`,noindex:true,channels:m.channels,scope:scope?{name:nameOf(scope,l),id:scope.id}:null,body});
}
