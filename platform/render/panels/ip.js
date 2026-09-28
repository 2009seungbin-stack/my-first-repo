// @ts-check
/** Anime/IP channel (work, franchise, character): countdown to the next official date, the coming
 * D-days (broadcasts, collab cafés, pop-ups, pre-order deadlines), official merchandise with
 * pre-order windows, and the cast in the wiki box. */
import {html,safeHref} from '../html.js';
import {t} from '../strings.js';
import {box,badge,nameOf,channelUrl} from '../ui.js';
import {eventTime,dday,daysUntil,isoDateText,money} from '../format.js';
import {related,relatedMany,factsFor,pickFact,eventsFor} from '../../db/channel.js';
import {factRows} from './generic.js';
import {dateMs} from '../../schema.js';

/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e,now}=ctx;
 /** @type {import('../ui.js').Entity[]} */let works=[];
 /** @type {import('../ui.js').Entity[]} */let characters=[];
 if(e.type==='franchise')works=(await related(db,e.id,'in',['belongs_to'])).map(r=>r.entity);
 if(e.type==='work')characters=(await related(db,e.id,'in',['appears_in'])).map(r=>r.entity);
 if(e.type==='character')works=(await related(db,e.id,'out',['appears_in'])).map(r=>r.entity);
 const family=[e,...works,...characters];
 const events=await eventsFor(db,family.map(x=>x.id),{from:now,limit:8});
 const merchRel=(await Promise.all(family.map(x=>related(db,x.id,'in',['merchandise_of'])))).flat().map(r=>r.entity);
 const merch=[...new Map(merchRel.map(m=>[m.id,m])).values()];
 const mf=await factsFor(db,merch.map(m=>m.id));
 const goods=merch.map(m=>({m,price:pickFact(mf.get(m.id),'price',{region:ctx.region}),end:pickFact(mf.get(m.id),'preorder_end')?.value,release:pickFact(mf.get(m.id),'release_date')?.value,maker:pickFact(mf.get(m.id),'manufacturer_name')?.value}))
  .sort((a,b)=>String(a.end||a.release||'9').localeCompare(String(b.end||b.release||'9'))).slice(0,4);
 const voices=await relatedMany(db,characters.map(c=>c.id),'voiced_by');
 const staff=await related(db,e.id,'out',['produced_by','created_by','adapted_from','belongs_to']);
 return {events,goods,cast:characters.slice(0,8).map(c=>({c,voices:voices.get(c.id)||[]})),works:works.slice(0,6),staff};
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l,now}=ctx,s=t(l).panel;
 const next=d.events.find(x=>x.starts_at&&x.starts_at>=now&&(x.precision==='time'||x.precision==='day'));
 let cd=null;
 if(next?.starts_at){const ms=next.starts_at-now,dd=Math.floor(ms/864e5),hh=Math.floor(ms%864e5/36e5),mm=Math.floor(ms%36e5/6e4);cd=next.precision==='time'?[[dd,s.countdown.d],[String(hh).padStart(2,'0'),s.countdown.h],[String(mm).padStart(2,'0'),s.countdown.m]]:[[daysUntil(next.starts_at,now,l),s.countdown.d]];}
 const nextBox=box({title:s.nextUp,extra:next?badge(next.verification,l):''},next?html`<div class="pad nx"><span><b>${next.title[l]||next.title.en}</b></span><span class="fine">${eventTime(/** @type {number} */(next.starts_at),next.precision,l)}${next.location?` · ${next.location}`:''}</span>
<div class="cd" data-island="countdown" data-at="${next.starts_at}">${(cd||[]).map(([n,u])=>html`<span><b>${n}</b><small>${u}</small></span>`)}</div>${next.url?html`<a class="fine" href="${safeHref(next.url)}" rel="noopener" target="_blank">${l==='ko'?'공식 공지 ↗':'Official notice ↗'}</a>`:''}</div>`:html`<p class="empty">${s.noUpcoming}</p>`);
 const sched=box({title:s.schedule},d.events.length?html`<ul class="rows">${d.events.slice(0,6).map(ev=>html`<li class="ev">${ev.starts_at?html`<span class="dday${ev.starts_at-now>14*864e5?' g':''}">${dday(ev.starts_at,now,l)}</span>`:''}${ev.url?html`<a class="tt" href="${safeHref(ev.url)}" rel="noopener" target="_blank">${ev.title[l]||ev.title.en}</a>`:html`<span class="tt">${ev.title[l]||ev.title.en}</span>`}${badge(ev.verification,l,'✓')}</li>`)}</ul>`:html`<p class="empty">${s.noUpcoming}</p>`);
 const goods=d.goods.length?box({title:s.goods,note:s.goodsNote},html`<ul class="goods">${d.goods.map(g=>{const end=g.end?dateMs(String(g.end)):null;return html`<li><a href="${channelUrl(l,g.m)}"><b>${nameOf(g.m,l)}</b></a><span class="fine">${g.maker||''}</span><span>${end&&end>=now?html`<span class="st soon">${s.preorderEnds(dday(end,now,l))}</span> `:''}${g.release?html`<span class="fine">${s.releases(isoDateText(String(g.release)))}</span>`:''}</span>${g.price?html`<span class="fine">${money(Number(g.price.value),g.price.unit||'JPY',l)}</span>`:''}</li>`;})}</ul>`):'';
 return html`<div class="g2 a">${nextBox}${sched}</div>${goods}`;
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function wiki(d,ctx){
 const {l}=ctx,s=t(l).panel;
 const PRED=/** @type {Record<string,{ko:string,en:string}>} */({produced_by:{ko:'제작',en:'Studio'},created_by:{ko:'원작자',en:'Creator'},adapted_from:{ko:'원작',en:'Based on'},belongs_to:{ko:'프랜차이즈',en:'Franchise'}});
 return html`<table class="wk"><tbody>${d.staff.map(r=>html`<tr><th>${PRED[r.predicate]?.[/** @type {'ko'|'en'} */(l)]||r.predicate}</th><td><a href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)}</a></td></tr>`)}${factRows(ctx)}</tbody></table>
${d.cast.length?html`<h3 class="wh">${s.cast}</h3><ul class="rows">${d.cast.map(x=>html`<li><a class="tt" href="${channelUrl(l,x.c)}">${nameOf(x.c,l)}</a><span class="fine">${x.voices.map((v,i)=>html`${i?' · ':''}<a href="${channelUrl(l,v)}">${nameOf(v,l)}</a>`)}</span></li>`)}</ul>`:''}
${d.works.length?html`<h3 class="wh">${s.worksList}</h3><ul class="rows">${d.works.map(w=>html`<li><a class="tt" href="${channelUrl(l,w)}">${nameOf(w,l)}</a></li>`)}</ul>`:''}`;
}

/** @type {import('./index.js').Panel} */
export default {id:'ip',types:['subculture:work','subculture:franchise','subculture:character'],load,top,wiki,live:(d,ctx)=>d.events.some((/** @type {any} */ x)=>x.starts_at&&x.starts_at-ctx.now<864e5&&x.starts_at>=ctx.now)};
