// @ts-check
/** Studio channel (DAW, plugin, audio interface, creative app): latest version and "safe to
 * upgrade?" — the official OS compatibility per OS release — plus how many plugins run in it. */
import {html,safeHref} from '../html.js';
import {t} from '../strings.js';
import {box,badge,nameOf,channelUrl} from '../ui.js';
import {isoDateText} from '../format.js';
import {related,factsFor,pickFact,versionsOf,compatibilityOf,entitiesByIds} from '../../db/channel.js';
import {COMPAT_STATUS_LABEL,label} from '../../labels.js';
import {factRows} from './generic.js';

/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e}=ctx;
 const versions=await versionsOf(db,e.id,5);
 const compat=await compatibilityOf(db,{subject:e.id});
 const targets=await entitiesByIds(db,compat.map(c=>c.target_id));
 const tf=await factsFor(db,[...targets.keys()]);
 const os=compat.filter(c=>targets.get(c.target_id)?.type==='os_release').map(c=>({c,os:/** @type {any} */(targets.get(c.target_id)),released:String(pickFact(tf.get(c.target_id),'release_date')?.value||''),family:String(pickFact(tf.get(c.target_id),'os_family')?.value||'')}))
  .sort((a,b)=>a.family.localeCompare(b.family)||b.released.localeCompare(a.released));
 const hosts=compat.filter(c=>targets.get(c.target_id)?.type==='app').map(c=>({c,app:/** @type {any} */(targets.get(c.target_id))}));
 const plugins=e.type==='app'?(await related(db,e.id,'in',['supports_host'])).length:0;
 const maker=(await related(db,e.id,'out',['made_by','developed_by']))[0]?.entity||null;
 return {versions,os,hosts,plugins,maker};
}
const MARK=/** @type {Record<string,string>} */({supported:'✓',works:'✓',works_with_issues:'◐',broken:'✕',unsupported:'✕',unverified_after_update:'?',unknown:'?'});
const CLS=/** @type {Record<string,string>} */({supported:'c',works:'c',works_with_issues:'u',broken:'d',unsupported:'d',unverified_after_update:'u',unknown:'u'});

/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l}=ctx,s=t(l).panel;
 const cur=d.versions[0],latest=pickFact(ctx.facts,'latest_version');
 const version=box({title:s.latestVersion,extra:cur?badge(cur.verification,l):latest?badge(latest.verification,l):''},cur||latest?html`<div class="kv pad"><span class="big">${cur?cur.version:latest?.value}</span>${cur?.released_at?html`<span class="fine">${isoDateText(new Date(cur.released_at).toISOString().slice(0,10))}</span>`:''}${cur?.notes_url?html`<a class="fine" href="${safeHref(cur.notes_url)}" rel="noopener" target="_blank">${s.patchNotes}</a>`:''}</div>
${d.versions.length>1?html`<ul class="rows">${d.versions.slice(1,4).map(v=>html`<li><span class="tt">${v.version}</span><span class="fine">${v.released_at?isoDateText(new Date(v.released_at).toISOString().slice(0,10)):''}</span></li>`)}</ul>`:''}
${d.plugins?html`<p class="fine pad">${s.plugins(d.plugins)}</p>`:''}`:html`<p class="empty">${s.noVersion}</p>`);
 // One row per OS (or host app); one chip per app version, newest first.
 /** @type {Map<string,{name:string,href:string,cells:any[]}>} */const byTarget=new Map();
 for(const x of [...d.os.map(o=>({t:o.os,c:o.c})),...d.hosts.map(h=>({t:h.app,c:h.c}))]){const r=byTarget.get(x.t.id)||{name:nameOf(x.t,l),href:channelUrl(l,x.t),cells:[]};r.cells.push(x.c);byTarget.set(x.t.id,r);}
 const rows=[...byTarget.values()].slice(0,8);
 const cell=(/** @type {any} */ c)=>{const st=label(/** @type {any} */(COMPAT_STATUS_LABEL)[c.status],l),v=c.subject_version&&c.subject_version!=='*'?c.subject_version.replace(/\.\*$/,''):'';return html`<span class="st ${CLS[c.status]||'u'}" title="${v?`${nameOf(ctx.entity,l)} ${v}: `:''}${st}${c.note?` — ${c.note}`:''}">${v?`${v} `:''}${MARK[c.status]||st}</span>`;};
 const upgrade=box({title:s.upgrade,extra:rows.length?badge('OFFICIAL',l):'',note:s.osCompat},rows.length?html`<ul class="rows">${rows.map(r=>html`<li><a class="tt" href="${r.href}">${r.name}</a><span class="osv">${r.cells.sort((a,b)=>String(b.subject_version).localeCompare(String(a.subject_version),undefined,{numeric:true})).map(cell)}</span></li>`)}</ul>`:html`<p class="empty">${l==='ko'?'등록된 OS 호환 정보가 없습니다.':'No OS compatibility listed yet.'}</p>`);
 return html`<div class="g2 a">${version}${upgrade}</div>`;
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function wiki(d,ctx){
 const {l}=ctx;
 return html`<table class="wk"><tbody>${d.maker?html`<tr><th>${l==='ko'?'개발사':'Developer'}</th><td><a href="${channelUrl(l,d.maker)}">${nameOf(d.maker,l)}</a></td></tr>`:''}${factRows(ctx)}</tbody></table>`;
}

/** @type {import('./index.js').Panel} */
export default {id:'studio',types:['studio:app','studio:plugin','studio:audio_device'],load,top,wiki};
