// @ts-check
/** Game channel: latest update (Steam news), whether the Korean patches still work on it, official
 * Korean support, this week's official dates, and a patch × game-version compatibility table. */
import {html,safeHref} from '../html.js';
import {t} from '../strings.js';
import {box,badge,nameOf,channelUrl} from '../ui.js';
import {factText,isoDateText,dday,eventTime} from '../format.js';
import {related,factsFor,pickFact,versionsOf,compatibilityOf,compatReportCounts,eventsFor} from '../../db/channel.js';
import {COMPAT_STATUS_LABEL,label} from '../../labels.js';
import {factRows} from './generic.js';

const DAY=864e5;
/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e,now}=ctx;
 const versions=await versionsOf(db,e.id,12);
 const patches=(await related(db,e.id,'in',['translates'])).map(r=>r.entity);
 const pf=await factsFor(db,patches.map(p=>p.id));
 const compat=(await compatibilityOf(db,{target:e.id})).filter(c=>patches.some(p=>p.id===c.subject_id));
 const counts=new Map();for(const p of patches)counts.set(p.id,await compatReportCounts(db,p.id,e.id));
 const orgs=await related(db,e.id,'out',['developed_by','published_by']);
 const events=await eventsFor(db,[e.id,...patches.map(p=>p.id)],{from:now,to:now+14*DAY,limit:5});
 return {versions,patches:patches.map(p=>({p,facts:pf.get(p.id)||[],counts:counts.get(p.id)||[]})),compat,orgs,events};
}
/** "Caves of Qud 한글패치 (qudkorean)" → "한글패치 (qudkorean)" inside the game's channel. */
const shortName=(/** @type {any} */ p,/** @type {any} */ game,/** @type {string} */ l)=>{const n=nameOf(p,l),g=nameOf(game,l);return n.startsWith(g+' ')?n.slice(g.length+1):n;};
const STATUS_CLASS=/** @type {Record<string,string>} */({supported:'c-y',works:'c-y',works_with_issues:'c-p',broken:'c-n',unsupported:'c-n',unverified_after_update:'c-u',unknown:'c-0'});
const STATUS_MARK=/** @type {Record<string,string>} */({supported:'✓',works:'✓',works_with_issues:'◐',broken:'✕',unsupported:'✕',unverified_after_update:'?',unknown:'–'});

/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l,now,entity:e}=ctx,s=t(l).panel;
 const [cur,prev]=d.versions;
 const lastUpdate=pickFact(ctx.facts,'last_update_at');
 const primary=d.patches[0];
 const pc=primary?currentCompat(d.compat,primary.p.id,cur?.version):null;
 const tally=primary?tallyFor(primary.counts,cur?.version):null;
 const update=box({title:s.latestUpdate,extra:cur?badge(cur.verification==='OFFICIAL'?'AUTOMATED':cur.verification,l,`⚙ Steam${cur.released_at?' '+isoDateText(new Date(cur.released_at).toISOString().slice(0,10)).slice(5):''}`):'',note:cur?.notes_url?html`<a href="${safeHref(cur.notes_url)}" rel="noopener nofollow" target="_blank">${s.patchNotes}</a>`:'',cls:'hl'},
  cur?html`<div class="upd"><div class="kv"><span class="fine">${s.currentVersion}</span><span class="big">${cur.version}</span>${prev?html`<span class="fine">${s.previous(prev.version,Math.max(1,Math.round(((cur.released_at??cur.detected_at)-(prev.released_at??prev.detected_at))/DAY)))}</span>`:''}</div>
<ul class="vl">${d.versions.slice(1,4).map(v=>html`<li>${v.version} <span class="fine">${v.released_at?isoDateText(new Date(v.released_at).toISOString().slice(0,10)):''}</span></li>`)}</ul></div>
${primary?html`<div class="strip"><span class="tt"><a href="${channelUrl(l,primary.p)}"><b>${shortName(primary.p,e,l)}${pickFact(primary.facts,'patch_version')?' '+pickFact(primary.facts,'patch_version')?.value:''}</b></a> ${s.compatWith(cur.version)} ${statusChip(pc,l)}${tally?html` · <span class="fine">${s.works} ${tally.works} · ${s.partial} ${tally.works_with_issues} · ${s.broken} ${tally.broken}</span>`:''}</span>
<span class="vbs" data-island="compat-vote" data-subject="${primary.p.id}" data-target="${e.id}" data-target-version="${cur.version}"><button class="vb y" type="button" disabled>${s.works}</button><button class="vb p" type="button" disabled>${s.partial}</button><button class="vb n" type="button" disabled>${s.broken}</button></span></div>`:''}`
  :html`<p class="empty">${s.noVersion}${lastUpdate?html` ${s.lastUpdate}: ${factText('games',lastUpdate,l)}`:''}</p>`);
 const ko=pickFact(ctx.facts,'korean_official',{region:ctx.region});
 const langs=pickFact(ctx.facts,'official_languages');
 const korean=box({title:s.koreanOfficial},html`<div class="kv pad"><span class="big sm">${ko?factText('games',ko,l):label({en:'Unknown',ko:'확인 안 됨'},l)}</span>${ko?html`<span class="fine">${badge(ko.verification,l)} ${langs?`· ${factText('games',langs,l)}`:''}</span>`:''}</div>`);
 const patchBox=box({title:s.koreanPatch},d.patches.length?html`<ul class="rows">${d.patches.slice(0,4).map(x=>{const v=pickFact(x.facts,'patch_version'),a=pickFact(x.facts,'author_name'),home=pickFact(x.facts,'homepage');return html`<li class="pt"><a class="tt" href="${channelUrl(l,x.p)}">${shortName(x.p,e,l)}${v?html` <b>${v.value}</b>`:''}</a><span class="fine">${a?a.value:''}</span>${home?html`<a class="fine" href="${safeHref(home.value)}" rel="noopener nofollow" target="_blank">${s.linkOnly} ↗</a>`:''}${badge('COMMUNITY',l)}</li>`;})}</ul>`:html`<p class="empty">${s.noPatch}</p>`);
 const week=box({title:s.thisWeek},d.events.length?html`<ul class="rows">${d.events.map(ev=>html`<li class="ev">${ev.starts_at?html`<span class="dday">${dday(ev.starts_at,now,l)}</span>`:''}<span class="tt">${ev.title[l]||ev.title.en}</span><span class="fine">${ev.starts_at?eventTime(ev.starts_at,ev.precision,l):''}</span></li>`)}</ul>`:html`<p class="empty">${s.noEvents}</p>`);
 return html`<div class="g2 b">${update}${korean}</div><div class="g2">${patchBox}${week}</div>`;
}
/** The current row for patch × this game version, falling back to "any version". */
function currentCompat(/** @type {any[]} */ rows,/** @type {string} */ patch,/** @type {string|undefined} */ version){
 const mine=rows.filter(r=>r.subject_id===patch);
 return mine.find(r=>r.target_version===version)||mine.find(r=>r.target_version==='*')||null;
}
function tallyFor(/** @type {{tv:string,result:string,n:number}[]} */ counts,/** @type {string|undefined} */ version){
 const rows=counts.filter(c=>c.tv===version);if(!rows.length)return null;
 /** @type {Record<string,number>} */const o={works:0,works_with_issues:0,broken:0};for(const r of rows)o[r.result]=(o[r.result]||0)+r.n;return o;
}
/** @param {any} row @param {string} l */
function statusChip(row,l){
 if(!row)return html`<span class="st u">${label(COMPAT_STATUS_LABEL.unknown,l)}</span>`;
 const cls=row.status==='unverified_after_update'||row.status==='unknown'?'u':row.status==='broken'?'d':'c';
 return html`<span class="st ${cls}" title="${row.note||''}">${label(/** @type {any} */(COMPAT_STATUS_LABEL)[row.status],l)}</span>${row.verification!=='COMMUNITY'?html` ${badge(row.verification,l)}`:''}`;
}

/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function wiki(d,ctx){
 const {l,entity:e}=ctx,s=t(l).panel;
 const dev=d.orgs.filter(o=>o.predicate==='developed_by'),pub=d.orgs.filter(o=>o.predicate==='published_by');
 const orgRow=(/** @type {string} */ lab,/** @type {any[]} */ list)=>list.length?html`<tr><th>${lab}</th><td>${list.map((o,i)=>html`${i?' · ':''}<a href="${channelUrl(l,o.entity)}">${nameOf(o.entity,l)}</a>`)}</td></tr>`:'';
 // Matrix: game versions (rows, newest first; '*' = any version) × patches (columns).
 const versions=[...new Set(d.compat.map(c=>c.target_version))].sort((a,b)=>a==='*'?1:b==='*'?-1:b.localeCompare(a,undefined,{numeric:true})).slice(0,5);
 const cols=d.patches.filter(x=>d.compat.some(c=>c.subject_id===x.p.id)).slice(0,3);
 return html`<table class="wk"><tbody>${orgRow(l==='ko'?'개발':'Developer',dev)}${orgRow(l==='ko'?'배급':'Publisher',pub)}${factRows(ctx,['release_date','platforms','official_languages','genres'])}</tbody></table>
${cols.length?html`<h3 class="wh">${s.compatTable}</h3><div class="tw"><table class="mx"><thead><tr><th></th>${cols.map(x=>html`<th title="${nameOf(x.p,l)}">${shortName(x.p,e,l).replace(/^한글패치\s*|^Korean patch\s*/i,'')||'—'}</th>`)}</tr></thead><tbody>${versions.map(v=>html`<tr><th>${v==='*'?(l==='ko'?'버전 무관':'any'):v}</th>${cols.map(x=>{const r=d.compat.find(c=>c.subject_id===x.p.id&&c.target_version===v);return r?html`<td class="${STATUS_CLASS[r.status]}" title="${label(/** @type {any} */(COMPAT_STATUS_LABEL)[r.status],l)}${r.subject_version&&r.subject_version!=='*'?` · ${r.subject_version}`:''}${r.note?` — ${r.note}`:''}">${STATUS_MARK[r.status]}${r.confirmations?` ${r.confirmations}`:''}</td>`:html`<td class="c-0">–</td>`;})}</tr>`)}</tbody></table></div>`:''}`;
}

/** @type {import('./index.js').Panel} */
export default {id:'game',types:['games:game'],load,top,wiki,live:(d,ctx)=>{const v=d.versions[0];return !!v&&ctx.now-(v.released_at??v.detected_at)<3*DAY;}};
