// @ts-check
/** Search (/{l}/search/?q=…&in=<channel>): channels first (alias + trigram index, so "5070",
 * "클로드" and "블루 아카이브" all work), then posts whose title matches. Scoped to one channel
 * when the header search was used inside a channel. Never indexed. */
import {html} from './html.js';
import {page,nameOf,channelUrl,postUrl,box,kindChip,monogram,TILE} from './ui.js';
import {boardTime} from './format.js';
import {searchEntities,searchPosts,entitiesByIds} from '../db/channel.js';
import {typeDef,verticalOf} from '../verticals/index.js';
import {label} from '../labels.js';
import {ENTITY_ID} from '../schema.js';

/** @param {any} db @param {{l:string,now:number,q:string,in?:string|null,channels?:{name:string,href:string}[]}} o */
export async function loadSearch(db,o){
 const q=String(o.q||'').slice(0,80).trim();
 const scope=o.in&&ENTITY_ID.test(o.in)?(await entitiesByIds(db,[o.in])).get(o.in)||null:null;
 const entities=q&&!scope?await searchEntities(db,q,{limit:20}):[];
 const posts=q?await searchPosts(db,q,{entityId:scope?.id,limit:30}):[];
 return {q,scope,entities,posts,l:o.l,now:o.now,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadSearch>>} m @param {{origin:string}} site */
export function renderSearch(m,site){
 const {l,now,q,scope}=m,ko=l==='ko';
 const head=html`<section class="box"><form class="sform" role="search" action="/${l}/search/" method="get">${scope?html`<input type="hidden" name="in" value="${scope.id}"><span class="qchip">${nameOf(scope,l)}</span>`:''}<input type="search" name="q" value="${q}" aria-label="${ko?'검색어':'Search'}" placeholder="${ko?'채널, 게임, 모델, GPU, 글 검색':'Search channels, games, models, GPUs, posts'}" autofocus><button class="btn p" type="submit">${ko?'검색':'Search'}</button></form>
${scope?html`<p class="fine pad">${ko?`${nameOf(scope,l)} 채널 안에서 찾았어요. `:`Searching inside ${nameOf(scope,l)}. `}<a href="/${l}/search/?q=${encodeURIComponent(q)}">${ko?'전체에서 찾기 ›':'Search everywhere ›'}</a></p>`:''}</section>`;
 const chans=m.entities.length?box({title:ko?`채널 ${m.entities.length}`:`Channels (${m.entities.length})`},html`<ul class="rows">${m.entities.map(e=>{const td=typeDef(e.vertical,e.type),v=verticalOf(e.vertical);return html`<li><span class="tile sm ${TILE[e.vertical]||''}" aria-hidden="true">${monogram(e,l)}</span><a class="tt" href="${channelUrl(l,e)}">${nameOf(e,l)}</a><span class="fine">${[td?label(td.label,l):'',v?label(v.label,l):''].filter(Boolean).join(' · ')}</span></li>`;})}</ul>`):'';
 const posts=q?box({title:ko?`글 ${m.posts.length}`:`Posts (${m.posts.length})`},m.posts.length?html`<ol class="plist">${m.posts.map(p=>html`<li class="lr"><span class="fine">${boardTime(p.created_at,now,l)}</span><a class="tt" href="${p.entity?postUrl(l,p.entity,p.post_no):'#'}">${kindChip(p.kind,l)}${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a>${p.entity?html`<a class="chn" href="${channelUrl(l,p.entity)}">${nameOf(p.entity,l)}</a>`:''}<span class="up">${p.up?`▲ ${p.up}`:''}</span></li>`)}</ol>`:html`<p class="empty">${ko?'제목에 이 단어가 들어간 글이 없습니다.':'No post titles match.'}</p>`):'';
 const none=q&&!m.entities.length&&!m.posts.length?html`<p class="empty">${ko?'찾는 채널이 없나요? 채널은 출처가 있는 정보가 모이면 열립니다.':'Nothing found.'}</p>`:'';
 const body=html`<div class="narrow">${head}${chans}${posts}${none}</div>`;
 return page({l,title:q?(ko?`"${q}" 검색 | Nerulio`:`"${q}" — search | Nerulio`):(ko?'검색 | Nerulio':'Search | Nerulio'),description:ko?'Nerulio 채널과 글 검색':'Search Nerulio channels and posts',
  canonical:site.origin+`/${l}/search/`,noindex:true,channels:m.channels,scope:scope?{name:nameOf(scope,l),id:scope.id}:null,body});
}
