// @ts-check
/** Push notifications to the admin's devices: preferences, quiet hours (Asia/Seoul), and the checks
 * behind POST /api/v2/admin/notify (called by the collectors workflow) and the instant new-flag push.
 * Every alert is delivered once: a small admin_alerts row is written only when a push was sent, so a
 * check that runs every 30 minutes costs reads, not writes. During quiet hours only critical alerts
 * (a collector failure, D1 usage ≥ 95%) are sent; the others are not marked and go out after. */
import {ApiError} from '../http.js';
import {sendPush,vapidFromEnv} from '../push.js';
import {STATUS_ADAPTERS} from './admin-collectors.js';

const KST=9*36e5,HOUR=36e5,DAY=864e5;
export const STATUS_STALE_MS=2*HOUR;

/** @typedef {{collectorFailN:1|2|3,statusStale:boolean,usageThresholds:number[],flags:'instant'|'hourly'|'off',aiIncident:boolean,proposals:boolean,newUsers:boolean,quiet:{from:string,to:string}|null}} Prefs */
/** @type {Readonly<Prefs>} */
export const DEFAULT_PREFS=Object.freeze({collectorFailN:1,statusStale:true,usageThresholds:[80,90,95],flags:'instant',aiIncident:true,proposals:true,newUsers:false,quiet:{from:'23:00',to:'07:00'}});
const HHMM=/^([01]\d|2[0-3]):[0-5]\d$/;

/** Validate a prefs object from the app (unknown keys refused; missing keys keep `base`).
 * @param {unknown} input @param {Prefs} [base] @returns {Prefs} */
export function normalizePrefs(input,base=DEFAULT_PREFS){
 if(input===undefined||input===null)return {...base,usageThresholds:[...base.usageThresholds]};
 if(typeof input!=='object'||Array.isArray(input))throw new ApiError('BAD_REQUEST','prefs must be an object.',{field:'prefs'});
 const p=/** @type {Record<string,unknown>} */(input),out={...base,usageThresholds:[...base.usageThresholds]};
 const bad=(/** @type {string} */ f)=>{throw new ApiError('BAD_REQUEST',`Invalid prefs.${f}.`,{field:`prefs.${f}`});};
 for(const k of Object.keys(p))if(!(k in DEFAULT_PREFS))bad(k.slice(0,40));
 if('collectorFailN' in p){if(![1,2,3].includes(/** @type {number} */(p.collectorFailN)))bad('collectorFailN');out.collectorFailN=/** @type {1|2|3} */(p.collectorFailN);}
 for(const k of /** @type {const} */(['statusStale','aiIncident','proposals','newUsers']))if(k in p){if(typeof p[k]!=='boolean')bad(k);out[k]=/** @type {boolean} */(p[k]);}
 if('usageThresholds' in p){const t=p.usageThresholds;if(!Array.isArray(t)||t.length>5||!t.every(x=>Number.isInteger(x)&&x>=1&&x<=100))bad('usageThresholds');out.usageThresholds=[...new Set(/** @type {number[]} */(t))].sort((a,b)=>a-b);}
 if('flags' in p){if(!['instant','hourly','off'].includes(/** @type {string} */(p.flags)))bad('flags');out.flags=/** @type {Prefs['flags']} */(p.flags);}
 if('quiet' in p){const q=/** @type {any} */(p.quiet);if(q===null)out.quiet=null;else if(!q||typeof q!=='object'||!HHMM.test(q.from)||!HHMM.test(q.to)||Object.keys(q).some(k=>k!=='from'&&k!=='to'))bad('quiet');else out.quiet={from:q.from,to:q.to};}
 return out;
}
/** Stored prefs (JSON text) → Prefs, tolerating old or broken rows. @param {unknown} text */
export function storedPrefs(text){try{return normalizePrefs(JSON.parse(String(text||'{}')));}catch{return normalizePrefs(undefined);}}

/** Minutes since 00:00 in Seoul. @param {number} now */
export const seoulMinutes=now=>Math.floor(((now+KST)%DAY)/6e4);
/** Seoul calendar day (YYYY-MM-DD). @param {number} now */
export const seoulDay=now=>new Date(now+KST).toISOString().slice(0,10);
/** 00:00 Seoul of the day containing `now`, in epoch ms. @param {number} now */
export const seoulDayStart=now=>Math.floor((now+KST)/DAY)*DAY-KST;
/** @param {Prefs} prefs @param {number} now */
export function inQuiet(prefs,now){
 if(!prefs.quiet)return false;
 const m=(/** @type {string} */ s)=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
 const from=m(prefs.quiet.from),to=m(prefs.quiet.to),t=seoulMinutes(now);
 if(from===to)return false;
 return from<to?t>=from&&t<to:t>=from||t<to;
}

/** @typedef {{title:string,body:string,url?:string,tag?:string,kind:string}} Message */
/** @typedef {{endpoint:string,p256dh:string,auth:string,prefs:Prefs,user_id:string}} Sub */

/** Admin devices with their prefs. @param {any} db @param {string} [userId] @returns {Promise<Sub[]>} */
export async function adminSubscriptions(db,userId){
 const rows=(await db.prepare(`SELECT s.endpoint,s.p256dh,s.auth,s.prefs,s.user_id FROM push_subscriptions s JOIN user_profiles p ON p.user_id=s.user_id WHERE p.role='admin'${userId?' AND s.user_id=?':''} LIMIT 20`).bind(...(userId?[userId]:[])).all()).results||[];
 return rows.map((/** @type {any} */ r)=>({endpoint:String(r.endpoint),p256dh:String(r.p256dh),auth:String(r.auth),user_id:String(r.user_id),prefs:storedPrefs(r.prefs)}));
}

/**
 * Send `message` to the given devices. Gone subscriptions (404/410) are deleted; other failures are
 * counted on the row. Returns counts.
 * @param {any} env @param {any} db @param {Sub[]} subs @param {Message} message
 * @param {{now:number,fetch?:typeof fetch,origin:string,urgency?:'normal'|'high',topic?:string}} o
 */
export async function deliver(env,db,subs,message,o){
 const vapid=vapidFromEnv(env,o.origin);
 if(!vapid)throw new ApiError('NOT_CONFIGURED','Web Push is not configured.',{need:'VAPID_PRIVATE_KEY'},{need:'VAPID_PRIVATE_KEY',missing:['VAPID_PRIVATE_KEY']});
 let sent=0,failed=0;const w=[];
 for(const s of subs){
  let status=0;
  try{status=await sendPush(s,{...message,url:message.url||'/admin/'},{vapid,now:o.now,fetch:o.fetch,urgency:o.urgency,topic:o.topic});}catch{status=0;}
  if(status>=200&&status<300){sent++;w.push(db.prepare('UPDATE push_subscriptions SET last_sent_at=?,failures=0 WHERE endpoint=?').bind(o.now,s.endpoint));}
  else{failed++;w.push(status===404||status===410?db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(s.endpoint):db.prepare('UPDATE push_subscriptions SET failures=failures+1 WHERE endpoint=?').bind(s.endpoint));}
 }
 if(w.length)await db.batch(w);
 return {sent,failed};
}

/** Alert keys already delivered. @param {any} db @param {string[]} keys */
async function delivered(db,keys){
 if(!keys.length)return new Set();
 const rows=(await db.prepare(`SELECT key FROM admin_alerts WHERE key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all()).results||[];
 return new Set(rows.map((/** @type {any} */ r)=>String(r.key)));
}
/** @param {any} db @param {string[]} keys @param {number} now */
const mark=(db,keys,now)=>keys.length?db.batch(keys.map(k=>db.prepare('INSERT INTO admin_alerts (key,at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET at=excluded.at').bind(k,now))):Promise.resolve();
/** Last time a periodic digest went out. @param {any} db @param {string} key */
async function markerAt(db,key){const r=await db.prepare('SELECT at FROM admin_alerts WHERE key=?').bind(key).first();return r?Number(r.at):null;}

/**
 * One alert to the devices whose prefs want it. `wants(prefs)` picks the devices; `critical` alerts
 * ignore quiet hours. The alert is marked delivered (key) only when at least one device got it.
 * @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c
 * @param {{key:string|null,wants:(p:Prefs)=>boolean,critical?:boolean,message:Message,topic?:string}} a
 */
async function alert(c,a){
 const targets=c.subs.filter(s=>a.wants(s.prefs)&&(a.critical||!inQuiet(s.prefs,c.now)));
 if(!targets.length)return {sent:0,failed:0,held:c.subs.some(s=>a.wants(s.prefs))};
 const r=await deliver(c.env,c.db,targets,a.message,{now:c.now,fetch:c.fetch,origin:c.origin,urgency:a.critical?'high':'normal',topic:a.topic});
 if(r.sent&&a.key)await mark(c.db,[a.key],c.now);
 return {...r,held:false};
}

/* ---------- the checks ---------- */

/** Collector failures: once per failure streak per threshold, when a collector's consecutive failures
 * reach the device's collectorFailN. When the run failed but nothing was recorded (a D1 write limit
 * can stop the run record too), devices with N=1 get one "workflow failed" alert per run.
 * @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c @param {any} payload */
export async function checkCollectorFailures(c,payload){
 const rows=(await c.db.prepare('SELECT adapter,last_success_at,last_error,consecutive_failures,last_attempt_at FROM collectors WHERE last_error IS NOT NULL AND last_attempt_at>=?').bind(c.now-6*HOUR).all()).results||[];
 const out=[];
 for(const n of /** @type {const} */([1,2,3])){
  const hit=rows.filter((/** @type {any} */ r)=>Number(r.consecutive_failures)>=n);
  if(!hit.length)continue;
  const keys=hit.map((/** @type {any} */ r)=>`cf:${r.adapter}:${r.last_success_at??0}:${n}`),done=await delivered(c.db,keys);
  const fresh=hit.filter((/** @type {any} */ _r,/** @type {number} */ i)=>!done.has(keys[i]));
  if(!fresh.length)continue;
  const names=fresh.map((/** @type {any} */ r)=>String(r.adapter)),first=/** @type {any} */(fresh[0]);
  const body=`${names.slice(0,3).join(', ')}${names.length>3?` 외 ${names.length-3}개`:''} 실패${n>1?` (연속 ${n}회)`:''} · ${String(first.last_error).replace(/\s+/g,' ').slice(0,90)}`;
  const r=await alert(c,{key:null,wants:p=>p.collectorFailN===n,critical:true,topic:'collectors',message:{kind:'collector_failed',title:'수집기 실패',body,url:names.length===1?`/admin/#/collectors/${encodeURIComponent(names[0])}`:'/admin/#/collectors',tag:'collectors'}});
  if(r.sent)await mark(c.db,keys.filter((/** @type {string} */ k)=>!done.has(k)),c.now);
  out.push({n,adapters:names,...r});
 }
 if(!out.length&&payload&&payload.failed!==false&&!rows.length){
  const run=typeof payload.runUrl==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+/.test(payload.runUrl)?payload.runUrl:null;
  const key=`cfrun:${run?run.replace(/\D+/g,'').slice(-20):Math.floor(c.now/HOUR)}`;
  if(!(await delivered(c.db,[key])).has(key))out.push(await alert(c,{key,wants:p=>p.collectorFailN===1,critical:true,topic:'collectors',message:{kind:'collector_failed',title:'수집기 워크플로 실패',body:'실행 기록이 남지 않았습니다 (D1 쓰기 한도일 수 있음). GitHub 로그를 확인하세요.',url:'/admin/#/collectors',tag:'collectors'}}));
 }
 return out;
}

/** D1 usage (account-wide; month-to-date against the Workers Paid included amounts, or today against
 * the Free daily limits): the newly crossed threshold per device, once per period (`day` = the
 * period's first day). ≥ 95% is critical.
 * @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c
 * @param {{rowsWritten:number,rowsRead:number,limitWritten:number,limitRead:number,day:string,period?:'day'|'month'}} u */
export async function checkUsage(c,u){
 const pct=Math.max(u.rowsWritten/u.limitWritten,u.rowsRead/u.limitRead)*100;
 const levels=[...new Set(c.subs.flatMap(s=>s.prefs.usageThresholds))].filter(l=>pct>=l).sort((a,b)=>b-a);
 if(!levels.length)return [];
 const keys=levels.map(l=>`usage:${u.day}:${l}`),done=await delivered(c.db,keys);
 const out=[];
 for(const [i,l] of levels.entries()){
  if(done.has(keys[i]))continue;
  // A device that already got a higher level today, or has a higher new level, gets only that one.
  const wants=(/** @type {Prefs} */ p)=>p.usageThresholds.includes(l)&&!levels.some(h=>h>l&&p.usageThresholds.includes(h));
  const w=u.rowsWritten/u.limitWritten>=u.rowsRead/u.limitRead;
  const r=await alert(c,{key:null,wants,critical:l>=95,topic:'usage',message:{kind:'usage',title:`D1 ${w?'쓰기':'읽기'} ${Math.floor(pct)}%`,body:`${u.period==='month'?'이번 달':'오늘(UTC)'} ${w?`쓰기 ${u.rowsWritten.toLocaleString('en-US')} / ${u.limitWritten.toLocaleString('en-US')}행`:`읽기 ${u.rowsRead.toLocaleString('en-US')} / ${u.limitRead.toLocaleString('en-US')}행`}${u.period==='month'?' · 포함량 대비':' · 09:00(KST)에 초기화'}`,url:'/admin/#/usage',tag:'usage'}});
  // Delivered, or no device wants this level (they got a higher one): done for today. Held back by
  // quiet hours: not marked, so it goes out on the first check after them.
  if(r.sent||!r.held)await mark(c.db,[keys[i]],c.now);
  out.push({level:l,...r});
 }
 return out;
}

/** Claude/OpenAI status collectors that have not succeeded for 2 hours: once per episode.
 * @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c */
export async function checkStatusStale(c){
 const rows=(await c.db.prepare(`SELECT adapter,last_success_at FROM collectors WHERE adapter IN (${STATUS_ADAPTERS.map(()=>'?').join(',')})`).bind(...STATUS_ADAPTERS).all()).results||[];
 const by=new Map(rows.map((/** @type {any} */ r)=>[String(r.adapter),r.last_success_at==null?null:Number(r.last_success_at)]));
 const out=[];
 for(const id of STATUS_ADAPTERS){
  const last=by.get(id)??null;
  if(last!==null&&c.now-last<=STATUS_STALE_MS)continue;
  const key=`stale:${id}:${last??0}`;
  if((await delivered(c.db,[key])).has(key))continue;
  const r=await alert(c,{key,wants:p=>p.statusStale,topic:'status',message:{kind:'status_stale',title:`${id==='claude-status'?'Claude':'OpenAI'} 상태 수집 멈춤`,body:last?`마지막 성공 ${Math.round((c.now-last)/6e4)}분 전 · "지금 장애?" 화면이 확인 전으로 바뀝니다.`:'아직 한 번도 성공하지 않았습니다.',url:`/admin/#/collectors/${id}`,tag:'status'}});
  out.push({adapter:id,...r});
 }
 return out;
}

/** Official incidents opened on status.claude.com / status.openai.com in the last 6 hours.
 * @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c */
export async function checkIncidents(c){
 if(!c.subs.some(s=>s.prefs.aiIncident))return [];
 const rows=(await c.db.prepare("SELECT id,title,url,starts_at FROM events WHERE kind='incident' AND status NOT IN ('ended','cancelled') AND starts_at>=? AND (url LIKE 'https://status.claude.com/%' OR url LIKE 'https://status.openai.com/%') ORDER BY starts_at DESC LIMIT 5").bind(c.now-6*HOUR).all()).results||[];
 const out=[];
 for(const e of rows){
  const key=`inc:${e.id}`;if((await delivered(c.db,[key])).has(key))continue;
  let t={};try{t=JSON.parse(String(e.title));}catch{}
  const who=String(e.url).includes('claude')?'Claude':'OpenAI';
  out.push(await alert(c,{key,wants:p=>p.aiIncident,topic:'incident',message:{kind:'ai_incident',title:`${who} 공식 장애`,body:String(/** @type {any} */(t).ko||/** @type {any} */(t).en||'').slice(0,120),url:String(e.url),tag:`inc-${e.id}`}}));
 }
 return out;
}

/** Open flags since the last hourly digest (devices with flags:'hourly'). @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c */
export async function checkFlagDigest(c){
 if(!c.subs.some(s=>s.prefs.flags==='hourly'))return null;
 const last=await markerAt(c.db,'digest:flags');
 if(last!==null&&c.now-last<HOUR-5*6e4)return null;
 const since=last??c.now-HOUR;
 const n=Number((await c.db.prepare("SELECT COUNT(*) AS n FROM content_flags WHERE status='open' AND created_at>?").bind(since).first())?.n||0);
 if(!n)return null;
 return alert(c,{key:'digest:flags',wants:p=>p.flags==='hourly',topic:'flags',message:{kind:'flags',title:`새 신고 ${n}건`,body:'지난 1시간 동안 접수된 신고가 처리를 기다립니다.',url:'/admin/#/flags',tag:'flags'}});
}

/** Once a day after 09:00 KST: fact proposals and fact conflicts waiting for review. @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c */
export async function checkReviewDigest(c){
 if(!c.subs.some(s=>s.prefs.proposals)||seoulMinutes(c.now)<9*60)return null;
 const key=`digest:review:${seoulDay(c.now)}`;
 if((await delivered(c.db,[key])).has(key))return null;
 const [p,f]=await c.db.batch([c.db.prepare("SELECT COUNT(*) AS n FROM fact_proposals WHERE status='open'"),c.db.prepare("SELECT COUNT(*) AS n FROM fact_conflicts WHERE status='open'")]);
 const np=Number(p.results?.[0]?.n||0),nf=Number(f.results?.[0]?.n||0);
 if(!np&&!nf)return null;
 return alert(c,{key,wants:p=>p.proposals,topic:'review',message:{kind:'review',title:'검토 대기',body:`정보 제안 ${np}건 · 사실 충돌 ${nf}건`,url:'/admin/#/radar',tag:'review'}});
}

/** New accounts since the last alert. @param {{env:any,db:any,now:number,fetch?:typeof fetch,origin:string,subs:Sub[]}} c */
export async function checkNewUsers(c){
 if(!c.subs.some(s=>s.prefs.newUsers))return null;
 const last=await markerAt(c.db,'digest:users');
 if(last===null){await mark(c.db,['digest:users'],c.now);return null;}
 const n=Number((await c.db.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at>? AND provider NOT IN ('system','passkey')").bind(last).first())?.n||0);
 if(!n)return null;
 return alert(c,{key:'digest:users',wants:p=>p.newUsers,topic:'users',message:{kind:'new_users',title:`새 가입자 ${n}명`,body:'커뮤니티 화면에서 확인하세요.',url:'/admin/#/community',tag:'users'}});
}

/** A new content flag (POST /api/v2/flags) → an instant push for devices with flags:'instant'.
 * Runs in ctx.waitUntil; never throws. @param {any} env @param {{target:string,reason:string}} flag @param {{now:number,fetch?:typeof fetch,origin:string}} o */
export async function notifyNewFlag(env,flag,o){
 try{
  if(!env?.DB||!vapidFromEnv(env,o.origin))return;
  const subs=(await adminSubscriptions(env.DB)).filter(s=>s.prefs.flags==='instant');
  if(!subs.length)return;
  const REASON=/** @type {Record<string,string>} */({spam:'스팸·광고',abuse:'욕설·비하',wrong_info:'잘못된 정보',source_dispute:'출처 이의',duplicate:'중복',copyright:'저작권',other:'기타'});
  const KIND=/** @type {Record<string,string>} */({discussion:'글',comment:'댓글',report:'리포트',wiki_revision:'위키',fact:'사실값',entity:'채널',user:'사용자'});
  await alert({env,db:env.DB,now:o.now,fetch:o.fetch,origin:o.origin,subs},{key:null,wants:()=>true,topic:'flags',message:{kind:'flag',title:'새 신고',body:`${KIND[flag.target.split(':')[0]]||'항목'} · ${REASON[flag.reason]||flag.reason}`,url:'/admin/#/flags',tag:'flags'}});
 }catch(e){console.error('admin/notify flag',/** @type {any} */(e)?.message);}
}
