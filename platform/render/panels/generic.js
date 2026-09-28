// @ts-check
/** Fallback for channels without a dedicated panel (companies, plans, voice actors …): recent
 * changes and upcoming dates on top, the entity's facts in the wiki box. */
import {html} from '../html.js';
import {t} from '../strings.js';
import {box,badge,nameOf} from '../ui.js';
import {boardTime,factText,dday,eventTime} from '../format.js';
import {changesFor,eventsFor} from '../../db/channel.js';
import {describeChange} from '../../change-text.js';
import {typeDef,propertyDef} from '../../verticals/index.js';
import {label} from '../../labels.js';

/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e,now}=ctx;
 return {changes:await changesFor(db,[e.id],{minImportance:1,limit:5}),events:await eventsFor(db,[e.id],{from:now,limit:5})};
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l,now,entity:e}=ctx,s=t(l).panel;
 if(!d.changes.length&&!d.events.length)return '';
 const name=nameOf(e,l);
 return html`<div class="g2">${d.changes.length?box({title:s.justChanged},html`<ul class="rows tk">${d.changes.map(c=>{const x=describeChange(c,{name},/** @type {'ko'|'en'} */(l));return html`<li><span class="tm">${boardTime(c.detected_at,now,l)}</span><span class="tt">${x.title}${x.detail?` — ${x.detail}`:''}</span>${badge('AUTOMATED',l)}</li>`;})}</ul>`):''}
${d.events.length?box({title:s.schedule},html`<ul class="rows">${d.events.map(ev=>html`<li class="ev">${ev.starts_at?html`<span class="dday">${dday(ev.starts_at,now,l)}</span>`:''}<span class="tt">${ev.title[l]||ev.title.en}</span><span class="fine">${ev.starts_at?eventTime(ev.starts_at,ev.precision,l):''}</span>${badge(ev.verification,l,'✓')}</li>`)}</ul>`):''}</div>`;
}
/** The type's properties in their configured order, each with its verification. @param {import('./index.js').PanelContext} ctx @param {string[]} [only] */
export function factRows(ctx,only){
 const {entity:e,l,facts}=ctx;
 const order=only||typeDef(e.vertical,e.type)?.props||[];
 const rows=[];
 for(const p of order){
  const f=facts.find(x=>x.property===p&&x.plan==='*'&&(x.region===ctx.region||x.region==='*'||x.region==='GLOBAL'))||facts.find(x=>x.property===p&&x.plan==='*');
  if(!f||p==='homepage')continue;
  const def=propertyDef(e.vertical,p);
  rows.push(html`<tr><th>${def?label(def.label,l):p}</th><td>${factText(e.vertical,f,l)}${f.verification!=='OFFICIAL'?html` ${badge(f.verification,l)}`:''}</td></tr>`);
 }
 return rows;
}
/** @param {unknown} _d @param {import('./index.js').PanelContext} ctx */
function wiki(_d,ctx){const rows=factRows(ctx);return rows.length?html`<table class="wk"><tbody>${rows}</tbody></table>`:'';}

/** @type {import('./index.js').Panel} */
export default {id:'generic',types:[],load,top,wiki};
