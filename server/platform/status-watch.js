// @ts-check
/** The moment a home status service (Claude, ChatGPT, Gemini) breaks: an official incident opens on its
 * status page, or its users' "안 돼요" reports start to spike. Each such event is acted on once:
 *  - followers of the service see it in 내 레이더 (a `changes` row on the service, importance 1: 내 레이더
 *    and the channel feed, not the public Radar). An incident filed on the service itself already made
 *    one there (ingest), so only a provider-wide one adds a row;
 *  - STATUS_WEBHOOK_URL, when set (a Discord webhook, or anything that takes Discord's JSON), gets one
 *    message. Without it nothing is sent.
 * Runs on the collectors workflow's 30-minute tick (POST /api/v2/admin/notify {kind:'tick'}) and, for a
 * spike, right after an outage click on that service. Once = a row in admin_alerts claimed atomically
 * (INSERT … ON CONFLICT … RETURNING): `status:inc:<service>:<event id>` for an incident, and
 * `status:spike:<service>` for a spike episode, kept alive while it lasts; a spike after WATCH.spikeGapMs
 * without one is a new episode. User reports are always called user reports, never an outage. */
import {RAIL_SERVICES,isStatusIncident} from '../../platform/render/rail.js';
import {eventsFor,issueReportsSince,entitiesByIds} from '../../platform/db/channel.js';
import {reportSignal} from '../../platform/status-signal.js';
import {nameOf,channelUrl} from '../../platform/render/ui.js';

const HOUR=36e5,DAY=864e5;
export const WATCH=Object.freeze({
 /** Incidents that opened longer ago than this are not news any more (a first run, a stalled collector). */
 incidentWindowMs:6*HOUR,
 /** A spike seen again after this long without one is a new episode. */
 spikeGapMs:2*HOUR,
 webhookTimeoutMs:5000,
});

/** @typedef {{kind:'incident',service:string,short:string,entity:import('../../platform/db/channel.js').Entity,key:string,direct:boolean,event:{id:number,title:Record<string,string>,url:string,starts_at:number|null}}} IncidentEvent */
/** @typedef {{kind:'spike',service:string,short:string,entity:import('../../platform/db/channel.js').Entity,key:string,last:number}} SpikeEvent */
/** @typedef {IncidentEvent|SpikeEvent} StatusEvent */

/** What is happening now: open official incidents that opened recently, and services whose user reports
 * spike (the status page's rule). @param {any} db @param {number} now @param {{ids?:string[],incidents?:boolean}} [o]
 * @returns {Promise<StatusEvent[]>} */
export async function statusEvents(db,now,o={}){
 const services=RAIL_SERVICES.filter(s=>!o.ids||o.ids.includes(s.id));
 if(!services.length)return [];
 const ids=services.map(s=>s.id);
 const [entities,reports,incidents]=await Promise.all([entitiesByIds(db,ids),issueReportsSince(db,ids,now-8*DAY),
  o.incidents===false?Promise.resolve(services.map(()=>[])):Promise.all(services.map(s=>eventsFor(db,[s.id,s.provider],{kinds:['incident','other'],from:now-WATCH.incidentWindowMs,desc:true,limit:10})))]);
 // Which incidents are filed on the service itself (ingest already told its followers).
 const evIds=incidents.flat().map(x=>x.id);
 const direct=new Set(evIds.length?(((await db.prepare(`SELECT event_id,entity_id FROM event_entities WHERE event_id IN (${evIds.map(()=>'?').join(',')})`).bind(...evIds).all()).results)||[]).map((/** @type {any} */ r)=>`${r.event_id}|${r.entity_id}`):[]);
 /** @type {StatusEvent[]} */const out=[];
 services.forEach((s,i)=>{
  const entity=entities.get(s.id);if(!entity)return;
  for(const x of incidents[i])if(isStatusIncident(x)&&x.status!=='ended'&&x.starts_at!==null&&x.starts_at>=now-WATCH.incidentWindowMs)
   out.push({kind:'incident',service:s.id,short:s.short,entity,key:`status:inc:${s.id}:${x.id}`,direct:direct.has(`${x.id}|${s.id}`),event:{id:x.id,title:x.title,url:String(x.url),starts_at:x.starts_at}});
  const sig=reportSignal(reports.filter(r=>r.entity_id===s.id),now);
  if(sig.spike)out.push({kind:'spike',service:s.id,short:s.short,entity,key:`status:spike:${s.id}`,last:sig.last});
 });
 return out;
}

/** Claim an event: true the first time only (one row in admin_alerts; concurrent claims cannot both win).
 * A spike's row is refreshed while it lasts, and claimed again after WATCH.spikeGapMs without one.
 * @param {any} db @param {StatusEvent} ev @param {number} now */
export async function claimEvent(db,ev,now){
 if(ev.kind==='incident')return !!(await db.prepare('INSERT INTO admin_alerts (key,at) VALUES (?,?) ON CONFLICT(key) DO NOTHING RETURNING key').bind(ev.key,now).first());
 const won=!!(await db.prepare('INSERT INTO admin_alerts (key,at) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET at=excluded.at WHERE admin_alerts.at<?3 RETURNING key').bind(ev.key,now,now-WATCH.spikeGapMs).first());
 if(!won)await db.prepare('UPDATE admin_alerts SET at=? WHERE key=? AND at<?').bind(now,ev.key,now).run();
 return won;
}

/** The wording of an event, ko and en. @param {StatusEvent} ev */
export function eventText(ev){
 const ko=nameOf(ev.entity,'ko'),en=nameOf(ev.entity,'en');
 if(ev.kind==='incident'){
  const t=ev.event.title.ko||ev.event.title.en||'';
  return {ko:`${ko}: 공식 장애 — ${t}`,en:`${en}: official incident — ${ev.event.title.en||t}`};
 }
 return {ko:`${ko}: 사용자 ‘안 돼요’ 리포트 급증 (Nerulio 사용자 리포트)`,en:`${en}: user “not working” reports spiking (Nerulio user reports)`};
}

/** The Discord-compatible message of an event (no mentions ever). @param {StatusEvent} ev @param {string} origin */
export function webhookMessage(ev,origin){
 const page=origin+channelUrl('ko',ev.entity)+'status',t=eventText(ev);
 const embed=ev.kind==='incident'
  ?{title:`[공식 장애] ${t.ko}`,url:page,color:0xe5484d,description:`공식 상태 페이지에 장애가 올라왔어요.\n원문: ${ev.event.url}\n사용자 리포트와 실시간 상태: ${page}`}
  :{title:`[사용자 리포트 급증] ${nameOf(ev.entity,'ko')}`,url:page,color:0xf59e0b,description:`Nerulio 사용자들의 ‘안 돼요’ 리포트가 평소보다 많아요 (최근 1시간 ${ev.last}건). 공식 장애 여부는 공식 상태 페이지 기준으로 따로 확인하세요.\n${page}`};
 return {username:'Nerulio',content:embed.title,embeds:[embed],allowed_mentions:{parse:[]}};
}
/** STATUS_WEBHOOK_URL as a URL, or null when it is not set (or not an https URL). @param {any} env */
export function webhookUrl(env){
 const v=String(env?.STATUS_WEBHOOK_URL||'').trim();
 if(!v)return null;
 try{const u=new URL(v);return u.protocol==='https:'&&!/^(localhost|127\.|\[)/.test(u.hostname)?u.href:null;}catch{return null;}
}

/**
 * Act on what is new: claim each event, tell the service's followers, post the webhook. Never throws.
 * @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string}} c @param {{ids?:string[],incidents?:boolean}} [o]
 * @returns {Promise<{events:number,new:{kind:string,service:string}[],webhook:'off'|number[]}>}
 */
export async function watchStatus(c,o={}){
 const hook=webhookUrl(c.env),posted=/** @type {number[]} */([]),fresh=[];
 try{
  const events=await statusEvents(c.db,c.now,o);
  for(const ev of events){
   if(!await claimEvent(c.db,ev,c.now))continue;
   fresh.push({kind:ev.kind,service:ev.service});
   // Followers: 내 레이더 (importance 1). An incident filed on the service itself is there already.
   if(ev.kind==='spike'||!ev.direct){
    const t=eventText(ev);
    // An official incident is an 'incident'; a spike of user reports is only a 'note' about the service.
    await c.db.prepare("INSERT INTO changes (entity_id,vertical,kind,summary,importance,ref_id,visibility,effective_at,detected_at) VALUES (?,?,?,?,1,?,'public',?,?)")
     .bind(ev.service,ev.entity.vertical,ev.kind==='incident'?'incident':'note',JSON.stringify(t),ev.kind==='incident'?`status-incident:${ev.event.id}`:`status-spike:${c.now}`,ev.kind==='incident'?(ev.event.starts_at??c.now):c.now,c.now).run();
   }
   if(hook){
    let status=0;
    try{
     const signal=typeof AbortSignal!=='undefined'&&'timeout' in AbortSignal?AbortSignal.timeout(WATCH.webhookTimeoutMs):undefined;
     const res=await (c.fetch||fetch)(hook,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(webhookMessage(ev,c.origin)),signal});
     status=res.status;
    }catch{status=0;}
    // Posted once, whatever the answer: a failed post is logged, never retried into a flood.
    if(status<200||status>=300)console.error('status webhook',ev.key,status);
    posted.push(status);
   }
  }
  return {events:events.length,new:fresh,webhook:hook?posted:'off'};
 }catch(e){
  console.error('status watch',/** @type {any} */(e)?.message);
  return {events:0,new:fresh,webhook:hook?posted:'off'};
 }
}
