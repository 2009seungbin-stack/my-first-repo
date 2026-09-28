// @ts-check
/** Change history (/{l}/{vertical}/{slug}/history): every recorded change of the channel's entity,
 * newest first, grouped by day, each with where it came from — the SteamDB-style log that the live
 * panels summarise. Old values stay forever (facts are closed, never overwritten). */
import {html,safeHref} from './html.js';
import {t} from './strings.js';
import {page,nameOf,channelUrl,badge} from './ui.js';
import {dateText} from './format.js';
import {historyOf} from '../db/channel.js';
import {describeChange} from '../change-text.js';

const SOURCE_VER=/** @type {Record<string,string>} */({OFFICIAL:'OFFICIAL',OFFICIAL_API:'AUTOMATED',FEED:'AUTOMATED',CURATED:'OFFICIAL',COMMUNITY:'COMMUNITY',MANUAL_SOURCE:'OFFICIAL',ESTIMATE_METHOD:'ESTIMATE'});

/** @param {any} db @param {import('../db/channel.js').Entity} entity @param {{l:string,now:number,channels?:{name:string,href:string}[]}} o */
export async function loadHistory(db,entity,o){
 return {entity,rows:await historyOf(db,entity.id,{limit:200}),l:o.l,now:o.now,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadHistory>>} m @param {{origin:string}} site */
export function renderHistory(m,site){
 const {entity:e,l}=m,s=t(l),ko=l==='ko',name=nameOf(e,l),base=channelUrl(l,e);
 /** @type {Map<string,typeof m.rows>} */const days=new Map();
 for(const r of m.rows){const d=dateText(r.effective_at,'day',l);days.set(d,[...(days.get(d)||[]),r]);}
 const body=html`<div class="crumb"><a class="chl" href="${base}">${s.channel(name)}</a><span class="sp"></span><a class="btn" href="${base}">${s.list}</a></div>
<section class="box"><div class="bh"><h1 class="wt">${ko?`${name} 변경 기록`:`${name} change history`}</h1><span class="x">${ko?`${m.rows.length}건 · 출처와 함께 기록`:`${m.rows.length} entries · with sources`}</span></div>
${m.rows.length?html`<ol class="hist">${[...days.entries()].map(([d,rows])=>html`<li><h2 class="hd2"><time>${d}</time></h2><ul class="rows">${rows.map(r=>{
 const x=describeChange(r,{name},/** @type {'ko'|'en'} */(l));
 return html`<li><span class="tt">${x.title}${x.detail?html` <span class="fine">${x.detail}</span>`:''}</span>${r.source_url?html`<a class="fine" href="${safeHref(r.source_url)}" rel="noopener nofollow" target="_blank">${ko?'출처':'source'} ↗</a>`:''}${r.source_kind?badge(SOURCE_VER[r.source_kind]||'UNKNOWN',l):''}</li>`;})}</ul></li>`)}</ol>`
 :html`<p class="empty">${ko?'아직 기록된 변경이 없습니다.':'No recorded changes yet.'}</p>`}
<p class="fine pad">${ko?'값이 바뀌면 이전 값은 지우지 않고 기간을 닫아 남깁니다. 공식 값은 커뮤니티 제보로 덮어쓰지 않습니다.':'When a value changes the old one is kept with its period closed. Community reports never overwrite official values.'}</p></section>`;
 return page({l,title:ko?`${name} 변경 기록 — 버전·가격·스펙 이력 | Nerulio`:`${name} change history | Nerulio`,
  description:ko?`${name}의 버전, 가격, 스펙, 일정이 언제 어떻게 바뀌었는지 출처와 함께 정리한 기록.`:`When and how ${name}'s versions, prices, specs and dates changed, with sources.`,
  canonical:site.origin+base+'history',alternates:{[l]:site.origin+base+'history',[ko?'en':'ko']:site.origin+channelUrl(ko?'en':'ko',e)+'history'},noindex:m.rows.length<3,
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:{name,id:e.id},body});
}
