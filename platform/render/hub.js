// @ts-check
/** Vertical hub (/{l}/{vertical}/, e.g. /ko/games/): every channel of the vertical by type — the
 * channel directory behind "전체 채널" and the crawl path to every channel page. */
import {html} from './html.js';
import {page,nameOf,channelUrl,box,monogram,TILE} from './ui.js';
import {compact} from './format.js';
import {hubEntities,typeCounts} from '../db/channel.js';
import {verticalOf,typeDef} from '../verticals/index.js';
import {label} from '../labels.js';

export const HUB_PAGE_SIZE=60;
/** @param {any} db @param {string} vertical @param {{l:string,type?:string|null,page?:number,channels?:{name:string,href:string}[]}} o */
export async function loadHub(db,vertical,o){
 const v=verticalOf(vertical);if(!v)return null;
 const counts=await typeCounts(db,vertical);
 const type=o.type&&Object.prototype.hasOwnProperty.call(v.types,o.type)?o.type:null;
 const pageNo=Math.max(1,Math.floor(o.page||1));
 const types=(type?[type]:v.hubTypes.filter(t=>counts[t]));
 const groups=[];
 for(const t of types)groups.push({type:t,total:counts[t]||0,rows:await hubEntities(db,vertical,{type:t,limit:type?HUB_PAGE_SIZE:12,offset:type?(pageNo-1)*HUB_PAGE_SIZE:0})});
 return {vertical,v,type,page:pageNo,counts,groups,l:o.l,channels:o.channels||[]};
}
/** @param {NonNullable<Awaited<ReturnType<typeof loadHub>>>} m @param {{origin:string}} site */
export function renderHub(m,site){
 const {l,v,vertical}=m,ko=l==='ko',base=`/${l}/${vertical}/`;
 const tabs=html`<nav class="ftabs" aria-label="${ko?'종류':'Type'}"><a href="${base}"${!m.type?html` class="on" aria-current="page"`:''}>${ko?'전체':'All'}</a>${v.hubTypes.filter(t=>m.counts[t]).map(t=>html`<a href="${base}?type=${t}"${m.type===t?html` class="on" aria-current="page"`:''}>${label(/** @type {any} */(typeDef(vertical,t)).plural,l)} <span class="fine">${m.counts[t]}</span></a>`)}</nav>`;
 const groups=m.groups.map(g=>box({title:label(/** @type {any} */(typeDef(vertical,g.type)).plural,l),note:!m.type&&g.total>g.rows.length?html`<a href="${base}?type=${g.type}">${ko?`${g.total}개 모두 보기 ›`:`All ${g.total} ›`}</a>`:`${g.total}`},
  html`<ul class="hubg">${g.rows.map(r=>html`<li><span class="tile sm ${TILE[vertical]||''}" aria-hidden="true">${monogram(r.entity,l)}</span><a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)}</a>${r.posts?html`<span class="fine">${ko?'글':'posts'} ${compact(r.posts,l)}</span>`:''}</li>`)}</ul>`));
 const total=m.type?m.counts[m.type]||0:0,last=Math.ceil(total/HUB_PAGE_SIZE);
 const pager=m.type&&last>1?html`<nav class="pager" aria-label="${ko?'페이지':'Page'}">${m.page>1?html`<a class="btn" href="${base}?type=${m.type}${m.page-1>1?`&page=${m.page-1}`:''}">‹</a>`:''}<span class="fine">${m.page} / ${last}</span>${m.page<last?html`<a class="btn" href="${base}?type=${m.type}&page=${m.page+1}">›</a>`:''}</nav>`:'';
 const body=html`<section class="box chh rh"><div class="chm"><div class="chn1"><h1>${label(v.label,l)}</h1><span class="fine">${label(v.tagline,l)}</span></div>${tabs}</div></section>${groups}${pager}`;
 const other=ko?'en':'ko';
 return page({l,title:ko?`${label(v.label,l)} 채널 — ${label(v.tagline,l)} | Nerulio`:`${label(v.label,l)} channels — ${label(v.tagline,l)} | Nerulio`,description:label(v.tagline,l),
  canonical:site.origin+base+(m.type?`?type=${m.type}${m.page>1?`&page=${m.page}`:''}`:''),alternates:{[l]:site.origin+base,[other]:site.origin+`/${other}/${vertical}/`},noindex:m.page>1,channels:m.channels,body});
}
