// @ts-check
/** AI service channel (Claude, ChatGPT, Gemini …): service status from the official status page's
 * incident history, what just changed, the models and API prices available now, rollouts, and a
 * wiki with the provider, apps and plans. Every number comes from sourced facts. */
import {html,safeHref} from '../html.js';
import {t} from '../strings.js';
import {box,badge,nameOf,channelUrl} from '../ui.js';
import {money,tokens,boardTime,isoDateText,factText,ago} from '../format.js';
import {related,factsFor,pickFact,eventsFor,changesFor,versionsOf,availabilityFor,rolloutVotes,collectorState,issueReportsSince} from '../../db/channel.js';
import {reportSignal} from '../../status-signal.js';
import {describeChange} from '../../change-text.js';
import {rolloutSummary} from '../../community.js';
import {dateMs} from '../../schema.js';

const DAY=864e5;
/** Status-page collectors per provider (collectors/<adapter>). */
export const STATUS_ADAPTER=/** @type {Record<string,string>} */({'provider:anthropic':'claude-status','provider:openai':'openai-status'});

/** Incident data is trusted as "no incident" only when the status collector succeeded recently. */
export const STATUS_FRESH_MS=2*36e5;
/** @param {{last_success_at:number|null}|null|undefined} c @param {number} now */
export const statusChecked=(c,now)=>!!c?.last_success_at&&now-c.last_success_at<=STATUS_FRESH_MS;

/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e,now}=ctx;
 // Independent reads run together (every D1 query is a round trip): first the relations…
 const [offeredBy,partRows,planRel]=await Promise.all([related(db,e.id,'in',['offers']),related(db,e.id,'in',['part_of']),related(db,e.id,'out',['has_plan'])]);
 const provider=offeredBy[0]?.entity||null;
 const [siblingRel,madeBy]=provider?await Promise.all([related(db,provider.id,'out',['offers']),related(db,provider.id,'in',['made_by'])]):[[],[]];
 const siblings=siblingRel.map(r=>r.entity).filter(x=>x.type==='service');
 const services=[e,...siblings.filter(x=>x.id!==e.id)].slice(0,4);
 const features=partRows.map(r=>r.entity).filter(x=>x.type==='feature');
 const plans=planRel.map(r=>r.entity);
 const models=madeBy.map(r=>r.entity).filter(x=>x.type==='model');
 // …then everything that needs them.
 const adapter=provider?STATUS_ADAPTER[provider.id]:undefined;
 const [facts,incidentRows,collectorMap,issueRows]=await Promise.all([factsFor(db,[...plans,...models,...features,...services].map(x=>x.id)),
  eventsFor(db,[...services.map(s=>s.id),...(provider?[provider.id]:[])],{kinds:['incident','other'],from:now-14*DAY,desc:true,limit:20}),
  adapter?collectorState(db,[adapter]):Promise.resolve(new Map()),issueReportsSince(db,services.map(x=>x.id),now-8*DAY)]);
 const f=(/** @type {string} */ id,/** @type {string} */ p)=>pickFact(facts.get(id),p,{region:ctx.region})?.value;
 // Models: current (active/preview) first, newest release first.
 const modelRows=models.map(m=>({m,status:f(m.id,'status'),released:f(m.id,'release_date'),ctx:f(m.id,'context_window'),in:pickFact(facts.get(m.id),'api_input_price'),out:pickFact(facts.get(m.id),'api_output_price'),open:f(m.id,'open_weights')}))
  .filter(r=>(r.status==='active'||r.status==='preview')&&!r.open)
  .sort((a,b)=>String(b.released||'').localeCompare(String(a.released||'')));
 const planRows=plans.map(p=>({p,monthly:pickFact(facts.get(p.id),'price_monthly',{region:ctx.region}),note:pickFact(facts.get(p.id),'price_note',{region:ctx.region,language:ctx.l})?.value}))
  .sort((a,b)=>(a.monthly?.value??1e9)-(b.monthly?.value??1e9));
 // Status: incidents on the service family in the last 14 days, open ones first.
 const incidents=incidentRows.filter(x=>x.url&&/status\./.test(x.url));
 const collector=adapter?collectorMap.get(adapter)||null:null;
 // Nerulio users' outage reports per service: the same signal as the status page.
 /** @type {Map<string,ReturnType<typeof reportSignal>>} */const signals=new Map();
 for(const svc of services)signals.set(svc.id,reportSignal(issueRows.filter(r=>r.entity_id===svc.id),now));
 // Timeline: Radar changes + dated official facts (model releases, service versions) in 90 days.
 const family=[e,...services,...features,...models,...plans,...(provider?[provider]:[])];
 const names=Object.fromEntries(family.map(x=>[x.id,nameOf(x,ctx.l)]));
 const [changes,serviceVersions,avail]=await Promise.all([changesFor(db,family.map(x=>x.id),{minImportance:1,limit:10}),
  Promise.all(services.map(x=>versionsOf(db,x.id,3))),availabilityFor(db,features.map(x=>x.id))]);
 /** @type {{at:number,title:string,ver:string,href?:string}[]} */const timeline=changes.map(c=>{const d=describeChange(c,{name:names[c.entity_id]||'',names},/** @type {'ko'|'en'} */(ctx.l));return {at:c.detected_at,title:d.detail?`${d.title} — ${d.detail}`:d.title,ver:'AUTOMATED'};});
 for(const r of modelRows){if(!r.released)continue;const at=dateMs(String(r.released));if(now-at<=90*DAY&&at<=now)timeline.push({at,title:ctx.l==='ko'?`${nameOf(r.m,'ko')} 출시`:`${nameOf(r.m,'en')} released`,ver:'OFFICIAL',href:channelUrl(ctx.l,r.m)});}
 for(const [i,s] of services.entries())for(const v of serviceVersions[i]){const at=v.released_at??v.detected_at;if(now-at<=90*DAY)timeline.push({at,title:ctx.l==='ko'?`${nameOf(s,'ko')} ${v.version} 출시`:`${nameOf(s,'en')} ${v.version} released`,ver:v.verification,href:v.notes_url||undefined});}
 for(const x of incidents.slice(0,3))timeline.push({at:x.starts_at??x.updated_at,title:x.title[ctx.l]||x.title.en,ver:'AUTOMATED',href:x.url||undefined});
 timeline.sort((a,b)=>b.at-a.at);
 // Rollouts: features that are officially rolling out/in preview/limited somewhere, plus user votes.
 const rollingIds=[...new Set(avail.filter(a=>a.state==='rolling_out'||a.state==='preview').map(a=>a.entity_id))];
 const votes=await rolloutVotes(db,rollingIds);
 const rollouts=rollingIds.slice(0,3).map(id=>({feature:/** @type {any} */(features.find(x=>x.id===id)),summary:rolloutSummary(votes.get(id)||[],now),avail:avail.filter(a=>a.entity_id===id)}));
 // The newest six, plus the cheapest current model when it is older: a table of only the newest
 // made a mid-priced model look like the cheapest one.
 const priced=modelRows.filter(r=>r.in&&(r.in.unit||'USD')==='USD').sort((a,b)=>Number(a.in?.value)-Number(b.in?.value));
 const shown=modelRows.slice(0,6),cheapest=priced[0]||null;
 if(cheapest&&!shown.includes(cheapest))shown.push(cheapest);
 return {provider,services,plans:planRows,models:shown,cheapest:priced.length>1?cheapest?.m.id??null:null,modelCount:modelRows.length,incidents,collector,signals,timeline:dedupe(timeline).slice(0,6),rollouts};
}
/** @param {{title:string}[]} list */
const dedupe=/** @template {{title:string}} T @param {T[]} list @returns {T[]} */ list=>{const seen=new Set();return list.filter(x=>seen.has(x.title)?false:(seen.add(x.title),true));};

/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l,now,entity:e}=ctx,s=t(l).panel;
 const statusUrl=pickFact(ctx.facts,'status_page')?.value;
 const open=d.incidents.filter(x=>x.status!=='ended'),fresh=statusChecked(d.collector,now);
 const serviceRow=(/** @type {import('../ui.js').Entity} */ svc)=>{
  const inc=open.find(x=>incidentMatches(x,svc,d.services.length));
  // Without a recent successful status check, "no incident" would be a claim nobody verified.
  // Users' reports speak even when the official status is unknown: a spike is shown on its own.
  const sig=d.signals.get(svc.id),spike=!inc&&!!sig?.spike;
  const state=inc?'warn':spike?'warn':fresh?'ok':'unk';
  const text=inc?s.incident:spike?(l==='ko'?`사용자 리포트 급증 · 1시간 ${sig?.last}건`:`User reports spiking · ${sig?.last} in 1h`):fresh?s.noIncident:(l==='ko'?'공식 상태 확인 전':'Official status not checked yet');
  const users=!spike&&sig?.total24?html`<a class="fine" href="${channelUrl(l,svc)}status">${l==='ko'?`리포트 ${sig.total24}건/24시간`:`${sig.total24} reports/24h`}</a>`:'';
  return html`<li class="srow"><span class="dot ${state}" aria-hidden="true"></span><a href="${channelUrl(l,svc)}">${nameOf(svc,l)}</a>${users}<a class="sv ${inc||spike?'bad':''}" href="${channelUrl(l,svc)}status">${text}</a></li>`;
 };
 const status=box({title:s.status,extra:open.length?html`<span class="live"><i></i></span>`:'',note:html`${d.collector?.last_success_at?s.lastChecked(ago(d.collector.last_success_at,now,l))+' · ':(l==='ko'?'상태 수집 전 · ':'Not collected yet · ')}${statusUrl?html`<a href="${safeHref(statusUrl)}" rel="noopener" target="_blank">${s.statusOpen}</a>`:s.statusSrc}`},
  html`<ul class="rows">${d.services.map(serviceRow)}</ul>${open.slice(0,2).map(x=>html`<a class="alert" href="${safeHref(x.url)}" rel="noopener" target="_blank"><b>${x.starts_at?boardTime(x.starts_at,now,l):''}~</b> ${x.title[l]||x.title.en}</a>`)}<p class="fine">${s.statusNote} · <a href="${channelUrl(l,e)}status">${l==='ko'?'사용자 리포트 보기 ›':'User reports ›'}</a></p>`);
 const changed=box({title:s.justChanged,note:s.justChangedSrc},d.timeline.length?html`<ul class="rows tk">${d.timeline.map(x=>html`<li><span class="tm">${boardTime(x.at,now,l)}</span>${x.href?html`<a class="tt" href="${safeHref(x.href)}">${x.title}</a>`:html`<span class="tt">${x.title}</span>`}${badge(x.ver,l)}</li>`)}</ul>`:html`<p class="empty">${s.nothingNew}</p>`);
 const models=d.models.length?box({title:s.models,extra:badge('OFFICIAL',l),note:checked(d.models.map(r=>r.in?.observed_at||0),l)},html`<div class="tw"><table class="mt"><thead><tr><th>${s.modelCol}</th><th>${s.ctxCol}</th><th>${s.priceCol}</th><th>${s.releasedCol}</th></tr></thead><tbody>${d.models.map(r=>{
  const fresh=r.released&&now-dateMs(String(r.released))<=30*DAY&&dateMs(String(r.released))<=now;
  return html`<tr><td><a href="${channelUrl(l,r.m)}"><b>${nameOf(r.m,l)}</b></a>${fresh?html` <span class="st new">${s.newBadge}</span>`:''}${r.status==='preview'?html` <span class="st u">${factText('ai',{property:'status',value:'preview'},l)}</span>`:''}${r.m.id===d.cheapest?html` <span class="st c">${l==='ko'?'최저가':'Cheapest'}</span>`:''}</td><td>${r.ctx?tokens(Number(r.ctx)):'–'}</td><td>${r.in&&r.out?`${money(Number(r.in.value),r.in.unit||'USD',l)} / ${money(Number(r.out.value),r.out.unit||'USD',l)}`:'–'}</td><td>${r.released?isoDateText(String(r.released)).slice(2):'–'}</td></tr>`;})}</tbody></table></div><p class="fine pad">${d.provider?html`<a href="/${l}/ai/?type=model&org=${d.provider.slug}&sort=cheap">${l==='ko'?`${nameOf(d.provider,l)} 모델 전체 (싼 순) ›`:`All ${nameOf(d.provider,l)} models ›`}</a> · `:''}<a href="/${l}/ai/?type=model">${l==='ko'?'모든 회사 모델 가격 비교 ›':'Compare all model prices ›'}</a></p>`):'';
 return html`<div class="g2 a">${status}${changed}</div>${models}`;
}
/** An open incident is shown on a service row when its title names that service; otherwise on the first row. */
function incidentMatches(/** @type {any} */ x,/** @type {import('../ui.js').Entity} */ svc,/** @type {number} */ n){
 const title=String(x.title.en||'').toLowerCase(),nm=String(svc.names.en||'').toLowerCase();
 return title.includes(nm)||n===1;
}
/** "9/28 확인" from the newest observed_at. @param {number[]} times @param {string} l */
function checked(times,l){const m=Math.max(0,...times);if(!m)return '';const d=new Date(m);return t(l).sourceChecked(l==='ko'?`${d.getUTCMonth()+1}/${d.getUTCDate()}`:d.toISOString().slice(0,10));}

/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function wiki(d,ctx){
 const {l}=ctx,s=t(l).panel,ff=ctx.facts;
 const platforms=pickFact(ff,'platforms');
 const dev=d.services.filter(x=>x.id!==ctx.entity.id);
 return html`<table class="wk"><tbody>
${d.provider?html`<tr><th>${s.provider}</th><td><a href="${channelUrl(l,d.provider)}">${nameOf(d.provider,l)}</a></td></tr>`:''}
${platforms?html`<tr><th>${s.apps}</th><td>${factText('ai',platforms,l)}</td></tr>`:''}
${dev.length?html`<tr><th>${s.developer}</th><td>${dev.map((x,i)=>html`${i?' · ':''}<a href="${channelUrl(l,x)}">${nameOf(x,l)}</a>`)}</td></tr>`:''}
${pickFact(ff,'release_date')?html`<tr><th>${t(l).panel.releasedCol}</th><td>${factText('ai',/** @type {any} */(pickFact(ff,'release_date')),l)}</td></tr>`:''}
</tbody></table>
${d.plans.length?html`<h3 class="wh">${s.plans} ${badge('OFFICIAL',l)}</h3><table class="wk"><tbody>${d.plans.map(r=>html`<tr><th><a href="${channelUrl(l,r.p)}">${planShort(r.p,ctx.entity,l)}</a></th><td><span title="${r.note||''}">${r.monthly?money(Number(r.monthly.value),r.monthly.unit||'USD',l):'–'}</span></td></tr>`)}</tbody></table><p class="fine pad">${s.priceNote}</p>`:''}`;
}
/** "Claude Team (스탠다드 시트)" → "Team (스탠다드 시트)" inside the Claude channel. */
function planShort(/** @type {any} */ p,/** @type {any} */ e,/** @type {string} */ l){const n=nameOf(p,l),svc=nameOf(e,l);return n.startsWith(svc+' ')?n.slice(svc.length+1):n;}

/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function side(d,ctx){
 const {l}=ctx,s=t(l).panel;
 if(!d.rollouts.length)return '';
 return box({title:s.rollout},html`${d.rollouts.map(r=>html`<div class="ro"><a href="${channelUrl(l,r.feature)}"><b>${nameOf(r.feature,l)}</b></a>
${r.summary.total.pct!==null?html`<div class="meter"><span class="bar"><i style="width:${r.summary.total.pct}%"></i></span><b>${r.summary.total.pct}%</b></div>`:''}
<span class="fine">${s.reports(r.summary.total.n)} · ${s.rolloutNote}</span>
<div class="vbs" data-island="rollout-vote" data-feature="${r.feature.id}"><button class="vb" type="button" disabled>${s.haveIt}</button><button class="vb" type="button" disabled>${s.notYet}</button></div></div>`)}`);
}

/** @type {import('./index.js').Panel} */
export default {id:'ai-service',types:['ai:service'],load,top,wiki,side,live:d=>d.incidents.some((/** @type {{status:string}} */ x)=>x.status!=='ended')};
