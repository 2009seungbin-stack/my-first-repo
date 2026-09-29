// @ts-check
/** /api/v2/admin/* — the owner-only admin app (docs/CLOUDFLARE.md "관리 앱", admin contract).
 *
 * Sign-in is a passkey (WebAuthn): the first credential needs ADMIN_SETUP_CODE, later devices a
 * signed-in admin. The admin is a normal users row with user_profiles.role='admin' on the existing
 * session cookie, so /api/v2/mod/* and the community work for it too.
 *
 * Every endpoint except the passkey ceremonies and /notify answers 404 to anyone who is not an admin
 * (the admin surface is not advertised), and 401 REAUTH when the admin's session is older than 12 h.
 * State-changing requests must come from the site's own origin; /notify instead takes the CI's bearer
 * token. Optional integrations that are not configured answer 503
 * {need, missing:[…], error:{code:'NOT_CONFIGURED', message, need}} (the same shape as server/traffic.js).
 * D1 reads stay small: every screen is one batch of index-range queries. */
import {runtimeConfig,SESSION_TTL_MS} from '../config.js';
import {ApiError,json,errorResponse,readJSON,cookie,clearCookie} from '../http.js';
import {resolveContext,SESSION_COOKIE} from '../identity.js';
import {allowRequest} from '../ratelimit.js';
import {randomToken,sha256,hmacHex,safeEqual,base64url} from '../crypto.js';
import {assertSameOrigin} from '../api.js';
import {makeChallenge,readChallenge,challengeHash,verifyRegistration,verifyAuthentication,WebAuthnError} from '../webauthn.js';
import {parseSubscription,vapidFromEnv} from '../push.js';
import {trafficSummary,handleTraffic} from '../traffic.js';
import {RUNNABLE,STATUS_ADAPTERS,collectorItems} from './admin-collectors.js';
import {normalizePrefs,storedPrefs,adminSubscriptions,deliver,seoulDayStart,seoulDay,checkCollectorFailures,checkUsage,checkStatusStale,checkIncidents,checkFlagDigest,checkReviewDigest,checkNewUsers,DEFAULT_PREFS} from './admin-notify.js';
import {modAction} from './api.js';
import {describeChange} from '../../platform/change-text.js';
import {channelUrl,nameOf} from '../../platform/render/ui.js';
import {propertyDef} from '../../platform/verticals/index.js';

export const REAUTH_MS=12*36e5;
export const D1_FREE_LIMIT=Object.freeze({rowsRead:5_000_000,rowsWritten:100_000});
const DAY=864e5,KST=9*36e5;
const WEBAUTHN_COOKIE='nerulio_webauthn',WEBAUTHN_PATH='/api/v2/admin/passkey/';
const DEFAULT_REPO='2009seungbin-stack/my-first-repo';

/** @typedef {{request:Request,env:any,ctx:any,deps:any,url:URL,cfg:any,now:number,db:any,context:any,body:any,params:string[],admin:any,cookies:string[],fetch:typeof fetch,origin:string}} C */
/** @typedef {{m:string,re:RegExp,fn:(c:C)=>Promise<any>,public?:boolean,bodyLimit?:number}} Route */

/** @param {Record<string,unknown>} body @param {string[]} allowed */
function only(body,allowed){for(const k of Object.keys(body))if(!allowed.includes(k))throw new ApiError('BAD_REQUEST',`Unexpected field: ${k.slice(0,40)}`);return body;}
/** @param {unknown} v @param {[number,number]} range @param {string} field */
function text(v,[min,max],field){
 if(typeof v!=='string')throw new ApiError('BAD_REQUEST',`${field} is required.`,{field});
 const s=v.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 if([...s].length<min||[...s].length>max)throw new ApiError('BAD_REQUEST',`${field} must be ${min}–${max} characters.`,{field});
 return s;
}
/** @param {string} need @param {string} [message] */
/** 503 NOT_CONFIGURED: {need, missing, error:{code, message, need}} — one check for the app. @param {string} need @param {string} [message] @param {string[]} [missing] */
export const notConfigured=(need,message,missing=[need])=>new ApiError('NOT_CONFIGURED',message||`${need} is not configured on this deployment.`,{need},{need,missing});
const ip=(/** @type {Request} */ r)=>r.headers.get('cf-connecting-ip')||'';
/** Per-minute burst limit keyed by client address (or account). @param {C} c @param {string} name @param {number} n @param {string} [who] */
async function limit(c,name,n,who){
 const key=`v2admin:${name}|${who??(ip(c.request)||c.context?.anonId||'?')}`;
 if(!await allowRequest({env:c.env,limiter:c.deps.limiter,key,limit:n,now:c.now}))throw new ApiError('RATE_LIMITED','Too many requests. Please wait a minute.',{retryAfter:60});
}
/** @param {any} db @param {string} userId */
const profileOf=(db,userId)=>db.prepare('SELECT role,display_name FROM user_profiles WHERE user_id=?').bind(userId).first();
const fresh=(/** @type {any} */ user,/** @type {number} */ now)=>now-Number(user.session_created)<=REAUTH_MS;

/** 404 for everyone who is not an admin; 401 REAUTH for an admin whose sign-in is older than 12 h.
 * @param {any} db @param {any} context @param {number} now */
export async function assertAdmin(db,context,now){
 if(!context?.user)throw new ApiError('NOT_FOUND');
 const p=await profileOf(db,context.user.id);
 if(!p||p.role!=='admin')throw new ApiError('NOT_FOUND');
 if(!fresh(context.user,now))throw new ApiError('REAUTH','Sign in again with your passkey.',{reauthAfterMs:REAUTH_MS});
 return {user_id:String(context.user.id),name:String(p.display_name||''),provider:String(context.user.provider),subject:String(context.user.provider_subject)};
}

/* ---------- passkeys ---------- */

/** @param {C} c */
async function newNonce(c){
 const nonce=randomToken();
 c.cookies.push(cookie(WEBAUTHN_COOKIE,nonce,/** @type {any} */({maxAge:300,path:WEBAUTHN_PATH,secure:c.context.secure})));
 return (await sha256('webauthn-nonce\n'+nonce)).slice(0,32);
}
/** The challenge must be ours, unexpired, for this ceremony, and issued to this browser (cookie).
 * @param {C} c @param {'reg'|'auth'} p */
function challengeCheck(c,p){
 return async(/** @type {string} */ ch)=>{
  const d=await readChallenge(c.cfg.secret,ch,c.now),nonce=c.context.cookies[WEBAUTHN_COOKIE];
  if(!d||d.p!==p||typeof nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(nonce))return null;
  return safeEqual(d.n,(await sha256('webauthn-nonce\n'+nonce)).slice(0,32))?d:null;
 };
}
/** @param {C} c */
const credentialCount=async c=>Number((await c.db.prepare('SELECT COUNT(*) AS n FROM admin_credentials').first())?.n||0);

/** Sign-in statements: a new session (the browser's previous one is replaced), the account's oldest
 * sessions beyond MAX_SESSIONS_PER_USER signed out. `signIn()` sets the cookie: call it only after the
 * batch committed, so a refused sign-in never hands out a cookie. @param {C} c @param {string} userId */
async function sessionStatements(c,userId){
 const token=randomToken(),db=c.db;
 const w=[db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),userId,c.now,c.now+SESSION_TTL_MS)];
 const prev=c.context.cookies[SESSION_COOKIE];
 if(prev&&/^[A-Za-z0-9_-]{43}$/.test(prev))w.push(db.prepare('DELETE FROM sessions WHERE token_hash=?1').bind(await sha256(prev)));
 w.push(db.prepare('DELETE FROM sessions WHERE user_id=?1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=?1 ORDER BY created_at DESC,token_hash LIMIT ?2)').bind(userId,c.cfg.maxSessionsPerUser||5));
 const signIn=()=>{
  // The auth cookie replaces whatever resolveContext decided about the old one.
  c.context.setCookies=c.context.setCookies.filter((/** @type {string} */ s)=>!s.startsWith(SESSION_COOKIE+'='));
  c.cookies.push(cookie(SESSION_COOKIE,token,/** @type {any} */({maxAge:SESSION_TTL_MS/1000,secure:c.context.secure})),clearCookie(WEBAUTHN_COOKIE,{path:WEBAUTHN_PATH,secure:c.context.secure}));
 };
 return {w,signIn};
}
/** @param {C} c @param {any} v */
async function usedStatements(c,v){
 return [c.db.prepare('DELETE FROM webauthn_used WHERE expires_at<?').bind(c.now),
  c.db.prepare('INSERT INTO webauthn_used (challenge_hash,expires_at) VALUES (?,?)').bind(await challengeHash(v.clientChallenge),Number(v.challenge.e)||c.now)];
}
/** @param {any} db @param {any[]} statements */
async function batchOnce(db,statements){
 try{return await db.batch(statements);}
 catch(e){if(/UNIQUE|PRIMARY KEY|constraint/i.test(String(/** @type {any} */(e)?.message)))throw new ApiError('OPERATION_CONFLICT','This passkey response was already used or the passkey is already registered.');throw e;}
}
/** @param {unknown} e */
function passkeyError(e){if(e instanceof WebAuthnError)return new ApiError('PASSKEY_REJECTED','The passkey response was rejected.',{reason:e.message});return e;}

/** @param {C} c */
async function registerOptions(c){
 only(c.body,['setupCode']);
 await limit(c,'passkey',10);
 const user=c.context.user,profile=user?await profileOf(c.db,user.id):null;
 let mode,handle,userId=null;/** @type {{type:'public-key',id:string}[]} */let exclude=[];
 if(profile?.role==='admin'){
  // Another device for a signed-in admin.
  if(!fresh(user,c.now))throw new ApiError('REAUTH','Sign in again with your passkey.');
  mode='add';userId=String(user.id);
  handle=user.provider==='passkey'&&/^[A-Za-z0-9_-]{16,64}$/.test(user.provider_subject)?String(user.provider_subject):base64url(crypto.getRandomValues(new Uint8Array(16)));
  exclude=((await c.db.prepare('SELECT id FROM admin_credentials WHERE user_id=?').bind(userId).all()).results||[]).map((/** @type {any} */ r)=>({type:'public-key',id:String(r.id)}));
 }else{
  // The very first admin credential, with the setup code. Afterwards this path does not exist.
  if(await credentialCount(c))throw new ApiError('NOT_FOUND');
  const code=String(c.env.ADMIN_SETUP_CODE||'');
  if(code.length<16)throw notConfigured('ADMIN_SETUP_CODE','ADMIN_SETUP_CODE (16+ characters) is not set on this deployment.');
  await limit(c,'setup',5);await limit(c,'setup',30,'*');
  const given=typeof c.body.setupCode==='string'&&c.body.setupCode.length<=256?c.body.setupCode:'';
  // Constant time and length-hiding: compare keyed digests, never the raw strings.
  if(!given||!safeEqual(await hmacHex(c.cfg.secret,'admin-setup\n'+given),await hmacHex(c.cfg.secret,'admin-setup\n'+code)))throw new ApiError('FORBIDDEN','Setup code rejected.',{field:'setupCode'});
  mode='setup';handle=base64url(crypto.getRandomValues(new Uint8Array(16)));
 }
 const n=await newNonce(c);
 return {
  rp:{id:c.url.hostname,name:'Nerulio 관리'},
  user:{id:handle,name:'nerulio-admin',displayName:'Nerulio 관리자'},
  challenge:await makeChallenge(c.cfg.secret,{p:'reg',m:mode,h:handle,u:userId,n},c.now),
  pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
  timeout:120000,attestation:'none',excludeCredentials:exclude,
  authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'preferred'},
  extensions:{credProps:true}
 };
}
/** @param {C} c */
async function registerVerify(c){
 only(c.body,['credential','name']);
 await limit(c,'passkey',10);
 const name=c.body.name===undefined||c.body.name===''?'이 기기':text(c.body.name,[1,40],'name');
 let v;try{v=await verifyRegistration(c.body.credential,{origin:c.url.origin,rpId:c.url.hostname,checkChallenge:challengeCheck(c,'reg')});}catch(e){throw passkeyError(e);}
 const d=v.challenge,db=c.db;
 const cred=(/** @type {string} */ uid)=>db.prepare('INSERT INTO admin_credentials (id,user_id,public_key,alg,sign_count,transports,name,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(v.credentialId,uid,v.publicKey,v.alg,v.signCount,JSON.stringify(v.transports),name,c.now);
 if(d.m==='add'){
  const user=c.context.user;
  if(!user||user.id!==d.u)throw new ApiError('NOT_FOUND');
  const p=await profileOf(db,user.id);if(p?.role!=='admin')throw new ApiError('NOT_FOUND');
  if(!fresh(user,c.now))throw new ApiError('REAUTH','Sign in again with your passkey.');
  await batchOnce(db,[...await usedStatements(c,v),cred(String(user.id))]);
  c.cookies.push(clearCookie(WEBAUTHN_COOKIE,{path:WEBAUTHN_PATH,secure:c.context.secure}));
  return {ok:true};
 }
 if(d.m!=='setup'||typeof d.h!=='string')throw new ApiError('BAD_REQUEST');
 if(await credentialCount(c))throw new ApiError('NOT_FOUND');
 const uid=randomToken(16),session=await sessionStatements(c,uid);
 await batchOnce(db,[...await usedStatements(c,v),
  db.prepare("INSERT INTO users (id,email,display_name,provider,provider_subject,created_at) VALUES (?,NULL,'Nerulio 관리자','passkey',?,?)").bind(uid,d.h,c.now),
  // Public nickname: 운영자 (reserved for staff), unless some account already holds it.
  db.prepare("INSERT INTO user_profiles (user_id,display_name,role,tier,created_at,updated_at) VALUES (?,CASE WHEN EXISTS (SELECT 1 FROM user_profiles WHERE lower(display_name)='운영자') THEN ? ELSE '운영자' END,'admin','curator',?,?)").bind(uid,`운영자-${uid.slice(0,4).toLowerCase()}`,c.now,c.now),
  cred(uid),...session.w]);
 session.signIn();
 return {ok:true};
}
/** @param {C} c */
async function loginOptions(c){
 only(c.body,[]);
 await limit(c,'passkey',10);
 const n=await newNonce(c);
 // Discoverable credentials: no allowCredentials, so the page does not learn which ids exist.
 return {challenge:await makeChallenge(c.cfg.secret,{p:'auth',n},c.now),rpId:c.url.hostname,timeout:120000,userVerification:'preferred',allowCredentials:[]};
}
/** @param {C} c */
async function loginVerify(c){
 only(c.body,['credential']);
 await limit(c,'passkey',10);
 /** @type {any} */let row=null;
 let v;
 try{
  v=await verifyAuthentication(c.body.credential,{origin:c.url.origin,rpId:c.url.hostname,checkChallenge:challengeCheck(c,'auth'),
   getCredential:async id=>{
    row=await c.db.prepare('SELECT c.id,c.user_id,c.public_key,c.sign_count,p.role FROM admin_credentials c LEFT JOIN user_profiles p ON p.user_id=c.user_id WHERE c.id=?').bind(id).first();
    // A credential whose account lost the admin role no longer signs anyone in.
    return row&&row.role==='admin'?{publicKey:String(row.public_key),signCount:Number(row.sign_count)}:null;
   }});
 }catch(e){throw passkeyError(e);}
 const session=await sessionStatements(c,String(row.user_id));
 await batchOnce(c.db,[...await usedStatements(c,v),
  c.db.prepare('UPDATE admin_credentials SET sign_count=?,last_used_at=? WHERE id=?').bind(v.signCount,c.now,v.credentialId),
  ...session.w]);
 session.signIn();
 return {ok:true};
}
/** Remove one of my passkeys (a lost phone); the last one cannot be removed. @param {C} c */
async function removePasskey(c){
 only(c.body,['id']);
 const id=String(c.body.id||'');
 const rows=(await c.db.prepare('SELECT id FROM admin_credentials WHERE user_id=?').bind(c.admin.user_id).all()).results||[];
 if(!rows.some((/** @type {any} */ r)=>r.id===id))throw new ApiError('NOT_FOUND','No such passkey.');
 if(rows.length<2)throw new ApiError('OPERATION_CONFLICT','The last passkey cannot be removed.');
 await c.db.prepare('DELETE FROM admin_credentials WHERE id=? AND user_id=?').bind(id,c.admin.user_id).run();
 return {ok:true};
}
/** @param {C} c */
async function me(c){
 const devices=((await c.db.prepare('SELECT id,name,created_at,last_used_at FROM admin_credentials WHERE user_id=? ORDER BY created_at').bind(c.admin.user_id).all()).results||[])
  .map((/** @type {any} */ r)=>({id:String(r.id),name:String(r.name),created_at:Number(r.created_at),last_used_at:r.last_used_at==null?null:Number(r.last_used_at)}));
 return {admin:true,name:c.admin.name,devices,reauthAt:Number(c.context.user.session_created)+REAUTH_MS,push:{configured:!!vapidFromEnv(c.env,c.origin)}};
}

/* ---------- overview ---------- */

/** Graph size changes slowly and costs a full count: kept in the edge cache for 15 minutes.
 * @param {C} c @returns {Promise<{entities:number,facts:number,events:number}|null>} */
async function cachedGraph(c){
 const cache=/** @type {any} */(globalThis).caches?.default;if(!cache)return null;
 try{const hit=await cache.match(new Request(`${c.url.origin}/api/v2/admin/_cache/graph`));return hit?await hit.json():null;}catch{return null;}
}
/** @param {C} c @param {{entities:number,facts:number,events:number}} g */
function storeGraph(c,g){
 const cache=/** @type {any} */(globalThis).caches?.default;if(!cache)return;
 const p=cache.put(new Request(`${c.url.origin}/api/v2/admin/_cache/graph`),new Response(JSON.stringify(g),{headers:{'content-type':'application/json','cache-control':'max-age=900'}})).catch(()=>{});
 c.ctx?.waitUntil?.(p);
}
const STATUS_HOST=/** @type {Record<string,string>} */({'claude-status':'status.claude.com','openai-status':'status.openai.com'});

/** @param {C} c */
async function overview(c){
 const db=c.db,since=seoulDayStart(c.now),graph=await cachedGraph(c);
 const results=await db.batch([
  db.prepare('SELECT adapter,vertical,mode,freshness_hours,last_attempt_at,last_success_at,last_error,consecutive_failures FROM collectors'),
  db.prepare("SELECT COUNT(*) AS n,COALESCE(SUM(importance>=2),0) AS major FROM changes WHERE detected_at>=? AND visibility<>'hidden'").bind(since),
  db.prepare("SELECT COUNT(*) AS n FROM content_flags WHERE status='open'"),
  db.prepare("SELECT COUNT(*) AS n FROM discussions WHERE status IN ('published','locked') AND created_at>=? AND author_id NOT LIKE 'system:%'").bind(since),
  db.prepare("SELECT COUNT(*) AS n FROM comments WHERE created_at>=? AND status='published'").bind(since),
  db.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at>=? AND provider<>'system' AND id NOT IN (SELECT user_id FROM admin_credentials)").bind(since),
  db.prepare("SELECT id,url,starts_at FROM events WHERE kind='incident' AND status NOT IN ('ended','cancelled') AND starts_at>=? AND (url LIKE 'https://status.claude.com/%' OR url LIKE 'https://status.openai.com/%') ORDER BY starts_at DESC LIMIT 10").bind(c.now-14*DAY),
  ...(graph?[]:[db.prepare("SELECT COUNT(*) AS n FROM entities WHERE status='active'"),db.prepare('SELECT COUNT(*) AS n FROM facts WHERE is_current=1'),db.prepare('SELECT COUNT(*) AS n FROM events')])
 ]);
 const n=(/** @type {number} */ i,k='n')=>Number(results[i]?.results?.[0]?.[k]||0);
 const rows=results[0].results||[],items=collectorItems(rows,c.now);
 /** @type {Record<string,number>} */const counts={ok:0,failing:0,stale:0,manual:0,never:0};for(const x of items)counts[x.state]++;
 const g=graph||{entities:n(7),facts:n(8),events:n(9)};if(!graph)storeGraph(c,g);
 const incidents=results[6].results||[];
 const status=STATUS_ADAPTERS.map(id=>{
  const row=rows.find((/** @type {any} */ r)=>r.adapter===id),host=STATUS_HOST[id],inc=incidents.find((/** @type {any} */ e)=>String(e.url).startsWith(`https://${host}/`));
  const last=row?.last_success_at==null?null:Number(row.last_success_at);
  const state=inc?'incident':last===null?'never':c.now-last>2*36e5?'stale':'ok';
  return {service:id==='claude-status'?'Claude':'OpenAI',adapter:id,state,since:inc?Number(inc.starts_at):last,checkedAt:last,url:inc?String(inc.url):`https://${host}/`};
 });
 const [usage,traffic]=await Promise.all([getUsage(c).catch(()=>null),Promise.resolve().then(()=>trafficSummary(c.env,c.now)).catch(()=>null)]);
 return {generatedAt:c.now,
  collectors:{...counts,items:items.filter(x=>x.state==='failing'||x.state==='never'||x.state==='stale').slice(0,8)},
  usage,radar:{today:n(1),importance2plus:n(1,'major')},flags:{open:n(2)},
  community:{postsToday:n(3),commentsToday:n(4),newUsersToday:n(5)},status,graph:g,traffic:traffic??null};
}

/* ---------- collectors ---------- */

const RUN_COLS='c.adapter,c.vertical,c.mode,c.freshness_hours,c.last_attempt_at,c.last_success_at,c.last_error,c.consecutive_failures,r.observations,r.changes,r.rows_written';
/** @param {C} c */
async function collectors(c){
 // The latest run per collector through the (adapter,id) index: one row each, never the whole history.
 const rows=(await c.db.prepare(`SELECT ${RUN_COLS} FROM collectors c LEFT JOIN collector_runs r ON r.id=(SELECT MAX(id) FROM collector_runs WHERE adapter=c.adapter)`).all()).results||[];
 return {generatedAt:c.now,items:collectorItems(rows,c.now)};
}
/** @param {C} c */
async function collectorRuns(c){
 const id=c.params[0];if(!/^[a-z0-9-]{1,64}$/.test(id))throw new ApiError('NOT_FOUND');
 const n=Math.min(100,Math.max(1,Number(c.url.searchParams.get('limit'))||20));
 const rows=(await c.db.prepare('SELECT id,started_at,finished_at,status,error,observations,changes,rows_written,queries FROM collector_runs WHERE adapter=? ORDER BY id DESC LIMIT ?').bind(id,n).all()).results||[];
 const num=(/** @type {unknown} */ v)=>v==null?null:Number(v);
 return {items:rows.map((/** @type {any} */ r)=>({id:Number(r.id),started_at:Number(r.started_at),finished_at:num(r.finished_at),status:String(r.status),error:r.error??null,observations:Number(r.observations),changes:Number(r.changes),rows_written:num(r.rows_written),queries:num(r.queries)}))};
}
/** "지금 실행": workflow_dispatch of the collectors workflow with the chosen adapters. @param {C} c */
async function runCollectors(c){
 only(c.body,['adapters']);
 const a=c.body.adapters;
 if(!Array.isArray(a)||!a.length||a.length>RUNNABLE.length||!a.every(x=>typeof x==='string'&&RUNNABLE.includes(x)))throw new ApiError('BAD_REQUEST','adapters must be a list of automated collector ids.',{field:'adapters'});
 const token=String(c.env.GITHUB_DISPATCH_TOKEN||'');
 if(!token)throw notConfigured('GITHUB_DISPATCH_TOKEN');
 await limit(c,'dispatch',3,c.admin.user_id);
 const repo=/^[\w.-]+\/[\w.-]+$/.test(String(c.env.GITHUB_REPO||''))?String(c.env.GITHUB_REPO):DEFAULT_REPO;
 const ref=/^[\w./-]{1,100}$/.test(String(c.env.GITHUB_DISPATCH_REF||''))?String(c.env.GITHUB_DISPATCH_REF):'main';
 let res;
 try{res=await c.fetch(`https://api.github.com/repos/${repo}/actions/workflows/collectors.yml/dispatches`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'nerulio-admin','Content-Type':'application/json'},body:JSON.stringify({ref,inputs:{adapters:[...new Set(/** @type {string[]} */(a))].join(',')}})});}
 catch{throw new ApiError('UPSTREAM_FAILED','GitHub did not answer.');}
 if(res.status!==204&&res.status!==200)throw new ApiError('UPSTREAM_FAILED','GitHub refused the workflow dispatch.',{upstreamStatus:res.status});
 return {ok:true,runUrl:`https://github.com/${repo}/actions/workflows/collectors.yml`};
}

/* ---------- D1 usage (Cloudflare GraphQL Analytics) ---------- */

const USAGE_QUERY=`query AdminD1Usage($accountTag: string!, $start: Date, $end: Date) {
 viewer { accounts(filter: {accountTag: $accountTag}) {
  d1AnalyticsAdaptiveGroups(limit: 10000, filter: {date_geq: $start, date_leq: $end}) { sum { rowsRead rowsWritten } dimensions { date databaseId } }
 } }
}`;
/** @type {{key:string,at:number,value:any}|null} */let usageMemo=null;
/** Workers Paid: D1 includes 25 billion rows read and 50 million rows written per month (billing
 * period, from the subscription date); Workers Free: 5 million / 100,000 per day, reset 00:00 UTC.
 * developers.cloudflare.com/d1/platform/pricing (checked 2026-09-29). */
export const D1_PAID_INCLUDED=Object.freeze({rowsReadMonth:25_000_000_000,rowsWrittenMonth:50_000_000});
/** First day (UTC, YYYY-MM-DD) of the billing period containing `now`. CF_BILLING_DAY is the day of
 * the month the Workers Paid subscription renews (1–28, default 1). @param {number} now @param {number} billingDay */
export function periodStart(now,billingDay){
 const d=new Date(now),y=d.getUTCFullYear(),m=d.getUTCMonth();
 return new Date(Date.UTC(y,d.getUTCDate()>=billingDay?m:m-1,billingDay)).toISOString().slice(0,10);
}
/**
 * Account-wide D1 rows read/written (all databases: limits and included amounts are per account).
 * plan 'paid' (default; CF_PLAN=free for the old daily limits): month-to-date against the monthly
 * included amounts. `limit` mirrors the amounts the percentage is measured against.
 * @param {{env:any,now:number,fetch:typeof fetch}} c
 */
export async function getUsage(c){
 const token=String(c.env.CF_ANALYTICS_TOKEN||''),account=String(c.env.CF_ACCOUNT_ID||'');
 const missing=[...(token?[]:['CF_ANALYTICS_TOKEN']),...(/^[0-9a-f]{32}$/.test(account)?[]:['CF_ACCOUNT_ID'])];
 if(missing.length)throw notConfigured(missing[0],undefined,missing);
 const plan=String(c.env.CF_PLAN||'paid').toLowerCase()==='free'?'free':'paid';
 const bd=Number(c.env.CF_BILLING_DAY),billingDay=Number.isInteger(bd)&&bd>=1&&bd<=28?bd:1;
 const key=await sha256([account,token,plan,billingDay].join('|'));
 if(usageMemo&&usageMemo.key===key&&c.now-usageMemo.at<120e3)return usageMemo.value;
 const day=(/** @type {number} */ t)=>new Date(t).toISOString().slice(0,10),today=day(c.now),week=day(c.now-6*DAY);
 const period=periodStart(c.now,billingDay),start=plan==='paid'&&period<week?period:week;
 let body;
 try{
  const res=await c.fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:USAGE_QUERY,variables:{accountTag:account,start,end:today}})});
  body=/** @type {any} */(await res.json().catch(()=>null));
  if(!res.ok||!body||body.errors?.length)throw 0;
 }catch{throw new ApiError('UPSTREAM_FAILED','Cloudflare analytics did not answer.');}
 const groups=body.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups;
 if(!Array.isArray(groups))throw new ApiError('UPSTREAM_FAILED','Unexpected analytics response.');
 /** @type {Map<string,{rowsRead:number,rowsWritten:number}>} */const by=new Map();
 for(let t=Date.parse(start+'T00:00:00Z');day(t)<=today;t+=DAY)by.set(day(t),{rowsRead:0,rowsWritten:0});
 for(const g of groups){const d=by.get(String(g?.dimensions?.date));if(!d)continue;d.rowsRead+=Number(g.sum?.rowsRead)||0;d.rowsWritten+=Number(g.sum?.rowsWritten)||0;}
 const days=[...by].map(([d,v])=>({day:d,...v}));
 const todayRow={...(by.get(today)||{rowsRead:0,rowsWritten:0})},databases=new Set(groups.map((/** @type {any} */ g)=>g?.dimensions?.databaseId)).size;
 let value;
 if(plan==='free')value={plan,period:'day',today:todayRow,limit:{...D1_FREE_LIMIT},days,resetAt:Math.floor(c.now/DAY)*DAY+DAY,databases};
 else{
  const month={rowsRead:0,rowsWritten:0,from:period};
  for(const d of days)if(d.day>=period){month.rowsRead+=d.rowsRead;month.rowsWritten+=d.rowsWritten;}
  const p=new Date(period+'T00:00:00Z'),next=Date.UTC(p.getUTCFullYear(),p.getUTCMonth()+1,billingDay);
  value={plan,period:'month',today:todayRow,month,included:{...D1_PAID_INCLUDED},limit:{rowsRead:D1_PAID_INCLUDED.rowsReadMonth,rowsWritten:D1_PAID_INCLUDED.rowsWrittenMonth},days,resetAt:next,databases};
 }
 usageMemo={key,at:c.now,value};
 return value;
}
/** The numbers a usage alert compares (month-to-date on Workers Paid, today on Free). @param {any} u */
export function usageLevel(u){
 const used=u.plan==='free'||!u.month?u.today:u.month;
 return {rowsWritten:used.rowsWritten,rowsRead:used.rowsRead,limitWritten:u.limit.rowsWritten,limitRead:u.limit.rowsRead,day:u.plan==='free'||!u.month?u.days.at(-1)?.day:u.month.from,period:/** @type {'day'|'month'} */(u.plan==='free'||!u.month?'day':'month')};
}

/* ---------- radar / data ---------- */

/** @param {any} r */
const ent=r=>({vertical:String(r.vertical),slug:String(r.slug),names:(()=>{try{return JSON.parse(String(r.names||'{}'));}catch{return {};}})()});
const js=(/** @type {unknown} */ v)=>{if(v==null)return null;try{return JSON.parse(String(v));}catch{return v;}};
/** @param {C} c */
async function radar(c){
 const cursor=Number(c.url.searchParams.get('cursor'))||0,min=Math.min(3,Math.max(0,Number(c.url.searchParams.get('min'))||0));
 const db=c.db,first=!cursor;
 const [ch,cf,pr]=await db.batch([
  db.prepare(`SELECT c.id,c.entity_id,c.vertical,c.kind,c.property,c.scope,c.old_value,c.new_value,c.summary,c.importance,c.visibility,c.source_id,c.detected_at,c.effective_at,e.slug,e.names FROM changes c JOIN entities e ON e.id=c.entity_id WHERE c.id<?${min?' AND c.importance>=?':''} ORDER BY c.id DESC LIMIT 51`).bind(cursor||Number.MAX_SAFE_INTEGER,...(min?[min]:[])),
  first?db.prepare(`SELECT k.id,k.value,k.verification,k.source_id,k.created_by,k.created_at,f.id AS fact_id,f.property,f.value AS cur_value,f.unit,f.verification AS cur_verification,f.source_id AS cur_source,f.region,f.is_current,e.id AS entity_id,e.vertical,e.slug,e.names
   FROM fact_conflicts k JOIN facts f ON f.id=k.fact_id JOIN entities e ON e.id=f.entity_id WHERE k.status='open' ORDER BY k.created_at DESC LIMIT 50`):db.prepare('SELECT 1 WHERE 0'),
  first?db.prepare(`SELECT f.id,f.entity_id,f.property,f.value,f.unit,f.source_url,f.note,f.created_at,e.vertical,e.slug,e.names,COALESCE(p.display_name,'user-'||lower(substr(f.user_id,1,6))) AS author,
   (SELECT x.value FROM facts x WHERE x.entity_id=f.entity_id AND x.property=f.property AND x.is_current=1 AND x.plan='*' ORDER BY CASE x.verification WHEN 'OFFICIAL' THEN 0 WHEN 'AUTOMATED' THEN 1 WHEN 'COMMUNITY_VERIFIED' THEN 2 ELSE 3 END,CASE x.region WHEN 'KR' THEN 0 WHEN '*' THEN 1 ELSE 2 END LIMIT 1) AS cur_value
   FROM fact_proposals f JOIN entities e ON e.id=f.entity_id LEFT JOIN user_profiles p ON p.user_id=f.user_id WHERE f.status='open' ORDER BY f.created_at LIMIT 50`):db.prepare('SELECT 1 WHERE 0')]);
 const rows=ch.results||[],more=rows.length>50;if(more)rows.length=50;
 const label=(/** @type {string} */ v,/** @type {string} */ p)=>propertyDef(v,p)?.label?.ko||p;
 const changes=rows.map((/** @type {any} */ r)=>{const e=ent(r),name=nameOf(e,'ko'),d=describeChange(r,{name},'ko');
  return {id:Number(r.id),entity_id:String(r.entity_id),channel:name,vertical:e.vertical,url:channelUrl('ko',e),kind:String(r.kind),property:r.property??null,title:d.title,detail:d.detail,importance:Number(r.importance),visibility:String(r.visibility),source:r.source_id??null,detected_at:Number(r.detected_at),effective_at:Number(r.effective_at)};});
 const conflicts=(cf.results||[]).map((/** @type {any} */ r)=>{const e=ent(r);
  return {id:Number(r.id),fact_id:Number(r.fact_id),entity_id:String(r.entity_id),channel:nameOf(e,'ko'),vertical:e.vertical,url:channelUrl('ko',e),property:String(r.property),label:label(e.vertical,String(r.property)),region:String(r.region),
   current:{value:js(r.cur_value),unit:r.unit??null,verification:String(r.cur_verification),source:r.cur_source??null,isCurrent:!!r.is_current},
   proposed:{value:js(r.value),verification:String(r.verification),source:r.source_id??null,by:String(r.created_by)},created_at:Number(r.created_at)};});
 const proposals=(pr.results||[]).map((/** @type {any} */ r)=>{const e=ent(r);
  return {id:String(r.id),entity_id:String(r.entity_id),channel:nameOf(e,'ko'),vertical:e.vertical,url:channelUrl('ko',e),property:String(r.property),label:label(e.vertical,String(r.property)),value:js(r.value),unit:r.unit??null,current:r.cur_value==null?null:js(r.cur_value),source:String(r.source_url),note:r.note??null,author:String(r.author),created_at:Number(r.created_at)};});
 return {changes,conflicts,proposals,next:more?changes[changes.length-1].id:null};
}

/** @param {C} c @param {{vertical:string,slug:string}} e */
async function purgeChannel(c,e){
 const cache=/** @type {any} */(globalThis).caches?.default;if(!cache)return;
 await Promise.all(['ko','en'].map(l=>cache.delete(new Request(c.origin+channelUrl(l,e))).catch(()=>false)));
}
/** @param {C} c @param {string} action @param {string} kind @param {string|number} id @param {string} reason @param {unknown} [meta] */
const logAction=(c,action,kind,id,reason,meta={})=>c.db.prepare('INSERT INTO moderation_actions (actor_id,action,target_kind,target_id,reason,meta,created_at) VALUES (?,?,?,?,?,?,?)').bind(c.admin.user_id,action,kind,String(id),reason,JSON.stringify(meta),c.now);

/** @param {C} c */
async function radarAction(c){
 only(c.body,['kind','id','action','value','reason']);
 const {kind,action}=c.body,reason=text(c.body.reason,[2,500],'reason'),db=c.db,actor=`admin:${c.admin.user_id}`;
 await limit(c,'radar',60,c.admin.user_id);
 if(kind==='proposal'){
  if(action!=='approve'&&action!=='reject')throw new ApiError('BAD_REQUEST','Invalid action.',{field:'action'});
  if(typeof c.body.id!=='string'||!/^[\w-]{1,64}$/.test(c.body.id))throw new ApiError('BAD_REQUEST','Invalid id.',{field:'id'});
  // The same path as the moderation queue: an accepted value goes through the ingest pipeline.
  return modAction(db,c.admin.user_id,'admin',{target:`proposal:${c.body.id}`,action:action==='approve'?'accept':'reject',reason},c.now,c.origin);
 }
 const id=Number(c.body.id);if(!Number.isSafeInteger(id)||id<1)throw new ApiError('BAD_REQUEST','Invalid id.',{field:'id'});
 if(kind==='conflict'){
  if(action!=='adopt'&&action!=='keep')throw new ApiError('BAD_REQUEST','Invalid action.',{field:'action'});
  const k=await db.prepare(`SELECT k.id,k.status,k.value,k.verification,k.source_id,k.snapshot_id,f.id AS fact_id,f.entity_id,f.property,f.region,f.language,f.platform,f.plan,f.app_version,f.value AS cur_value,f.unit,f.is_current,e.vertical,e.slug
   FROM fact_conflicts k JOIN facts f ON f.id=k.fact_id JOIN entities e ON e.id=f.entity_id WHERE k.id=?`).bind(id).first();
  if(!k)throw new ApiError('NOT_FOUND','No such conflict.');
  if(k.status!=='open')throw new ApiError('OPERATION_CONFLICT','Already resolved.');
  if(action==='keep'){
   await db.batch([db.prepare("UPDATE fact_conflicts SET status='rejected',resolved_by=?,resolved_at=? WHERE id=? AND status='open'").bind(actor,c.now,id),logAction(c,'resolve_conflict','conflict',id,reason,{keep:true})]);
   return {ok:true};
  }
  // Adopt: the proposed value becomes the current fact (same scope), with a Radar change, exactly
  // what ingest would have written had the value been trusted enough.
  if(!k.is_current)throw new ApiError('OPERATION_CONFLICT','The current value changed since; this conflict is out of date.');
  const scope={region:k.region,language:k.language,platform:k.platform,plan:k.plan,app_version:k.app_version};
  await db.batch([
   db.prepare("UPDATE fact_conflicts SET status='accepted',resolved_by=?,resolved_at=? WHERE id=? AND status='open'").bind(actor,c.now,id),
   db.prepare('UPDATE facts SET is_current=0,valid_until=? WHERE id=? AND is_current=1').bind(c.now,k.fact_id),
   db.prepare('INSERT INTO facts (entity_id,property,region,language,platform,plan,app_version,value,unit,verification,confidence,source_id,snapshot_id,note,valid_from,observed_at,is_current,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,1,?,?)')
    .bind(k.entity_id,k.property,k.region,k.language,k.platform,k.plan,k.app_version,k.value,k.unit??null,k.verification,k.source_id??null,k.snapshot_id??null,`Adopted by an admin from conflict #${id} (${reason})`.slice(0,300),c.now,c.now,actor,c.now),
   db.prepare("INSERT INTO changes (entity_id,vertical,kind,property,scope,old_value,new_value,importance,source_id,visibility,approved_by,effective_at,detected_at) VALUES (?,?,'fact_changed',?,?,?,?,2,?,'public',?,?,?)")
    .bind(k.entity_id,k.vertical,k.property,JSON.stringify(scope),k.cur_value,k.value,k.source_id??null,actor,c.now,c.now),
   db.prepare('UPDATE entities SET version=version+1,updated_at=? WHERE id=?').bind(c.now,k.entity_id),
   logAction(c,'resolve_conflict','conflict',id,reason,{adopt:true,fact:Number(k.fact_id)})]);
  await purgeChannel(c,{vertical:String(k.vertical),slug:String(k.slug)});
  return {ok:true};
 }
 if(kind==='change'){
  const r=await db.prepare('SELECT c.id,c.visibility,c.importance,e.vertical,e.slug FROM changes c JOIN entities e ON e.id=c.entity_id WHERE c.id=?').bind(id).first();
  if(!r)throw new ApiError('NOT_FOUND','No such change.');
  let st;
  if(action==='hide')st=db.prepare("UPDATE changes SET visibility='hidden',approved_by=? WHERE id=?").bind(actor,id);
  else if(action==='approve')st=db.prepare("UPDATE changes SET visibility='public',approved_by=? WHERE id=?").bind(actor,id);
  else if(action==='importance'){
   const v=c.body.value;if(!Number.isInteger(v)||v<0||v>3)throw new ApiError('BAD_REQUEST','importance must be 0–3.',{field:'value'});
   st=db.prepare('UPDATE changes SET importance=?,approved_by=? WHERE id=?').bind(v,actor,id);
  }else throw new ApiError('BAD_REQUEST','Invalid action.',{field:'action'});
  await db.batch([st,logAction(c,action==='importance'?'change_importance':action==='hide'?'change_hide':'change_approve','change',id,reason,{from:{visibility:r.visibility,importance:Number(r.importance)},...(action==='importance'?{importance:c.body.value}:{})})]);
  await purgeChannel(c,{vertical:String(r.vertical),slug:String(r.slug)});
  return {ok:true};
 }
 throw new ApiError('BAD_REQUEST','kind must be conflict, proposal or change.',{field:'kind'});
}

/* ---------- community ---------- */

/** @param {C} c */
async function community(c){
 const q=c.url.searchParams.get('day');
 let from;
 if(q){if(!/^\d{4}-\d{2}-\d{2}$/.test(q)||Number.isNaN(Date.parse(q+'T00:00:00Z')))throw new ApiError('BAD_REQUEST','day must be YYYY-MM-DD.',{field:'day'});from=Date.parse(q+'T00:00:00Z')-KST;}
 else from=seoulDayStart(c.now);
 const to=from+DAY,from7=from-6*DAY,db=c.db;
 const POSTS="FROM discussions WHERE status IN ('published','locked') AND author_id NOT LIKE 'system:%' AND created_at>=? AND created_at<?";
 const ACTIVITY=`SELECT entity_id,1 AS p,0 AS c ${POSTS} UNION ALL SELECT d.entity_id,0,1 FROM comments x JOIN discussions d ON d.id=x.discussion_id WHERE x.status='published' AND x.created_at>=? AND x.created_at<?`;
 const [posts,comments,users,flags,sp,sc,channels,verticals,newUsers]=await db.batch([
  db.prepare(`SELECT COUNT(*) AS n ${POSTS}`).bind(from,to),
  db.prepare("SELECT COUNT(*) AS n FROM comments WHERE status='published' AND created_at>=? AND created_at<?").bind(from,to),
  db.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at>=? AND created_at<? AND provider<>'system' AND id NOT IN (SELECT user_id FROM admin_credentials)").bind(from,to),
  db.prepare('SELECT COUNT(*) AS n FROM content_flags WHERE created_at>=? AND created_at<?').bind(from,to),
  db.prepare(`SELECT CAST((created_at+?)/86400000 AS INTEGER) AS d,COUNT(*) AS n ${POSTS} GROUP BY d`).bind(KST,from7,to),
  db.prepare("SELECT CAST((created_at+?)/86400000 AS INTEGER) AS d,COUNT(*) AS n FROM comments WHERE status='published' AND created_at>=? AND created_at<? GROUP BY d").bind(KST,from7,to),
  db.prepare(`SELECT a.entity_id,SUM(a.p) AS posts,SUM(a.c) AS comments,e.vertical,e.slug,e.names FROM (${ACTIVITY}) a JOIN entities e ON e.id=a.entity_id GROUP BY a.entity_id ORDER BY SUM(a.p)+SUM(a.c) DESC,SUM(a.p) DESC LIMIT 10`).bind(from,to,from,to),
  db.prepare(`SELECT e.vertical,SUM(a.p) AS posts,SUM(a.c) AS comments FROM (${ACTIVITY}) a JOIN entities e ON e.id=a.entity_id GROUP BY e.vertical ORDER BY SUM(a.p) DESC,SUM(a.c) DESC`).bind(from,to,from,to),
  db.prepare(`SELECT u.id,u.created_at,COALESCE(p.display_name,'user-'||lower(substr(u.id,1,6))) AS name,
   (SELECT COUNT(*) FROM discussions d WHERE d.author_id=u.id AND d.status IN ('published','locked')) AS posts,(SELECT COUNT(*) FROM comments x WHERE x.author_id=u.id AND x.status='published') AS comments
   FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.created_at>=? AND u.created_at<? AND u.provider<>'system' AND u.id NOT IN (SELECT user_id FROM admin_credentials) ORDER BY u.created_at DESC LIMIT 20`).bind(from,to)]);
 const n=(/** @type {any} */ r)=>Number(r.results?.[0]?.n||0);
 const byDay=(/** @type {any} */ r)=>new Map((r.results||[]).map((/** @type {any} */ x)=>[Number(x.d),Number(x.n)]));
 const ps=byDay(sp),cs=byDay(sc),d0=Math.floor((from+KST)/DAY);
 return {day:new Date(from+KST).toISOString().slice(0,10),
  tiles:{posts:n(posts),comments:n(comments),users:n(users),flags:n(flags)},
  spark:Array.from({length:7},(_,i)=>{const d=d0-6+i;return {day:new Date(d*DAY).toISOString().slice(0,10),posts:ps.get(d)||0,comments:cs.get(d)||0};}),
  channels:(channels.results||[]).map((/** @type {any} */ r)=>{const e=ent(r);return {entity_id:String(r.entity_id),name:nameOf(e,'ko'),vertical:e.vertical,url:channelUrl('ko',e),posts:Number(r.posts),comments:Number(r.comments)};}),
  verticals:(verticals.results||[]).map((/** @type {any} */ r)=>({vertical:String(r.vertical),posts:Number(r.posts),comments:Number(r.comments)})),
  newUsers:(newUsers.results||[]).map((/** @type {any} */ r)=>({id:String(r.id),name:String(r.name),created_at:Number(r.created_at),posts:Number(r.posts),comments:Number(r.comments)}))};
}

/* ---------- the gate other admin modules use (server/traffic.js handleTraffic) ---------- */

/**
 * Admin gate with the (request, env, ctx) signature: throws ApiError (404 for non-admins, 401 REAUTH,
 * 403 FORBIDDEN_ORIGIN for a cross-site write, 503 when the service is not configured) or returns the
 * admin. `deps` carries the test clock / limiter like handlePlatformApi's.
 * @param {Request} request @param {any} env @param {any} _ctx @param {{now?:()=>number}} [deps]
 */
export async function requireAdmin(request,env,_ctx,deps={}){
 const cfg=runtimeConfig(env),now=(deps.now||Date.now)();
 if(!cfg.configured)throw new ApiError('SERVICE_NOT_CONFIGURED');
 if(request.method!=='GET'&&request.method!=='HEAD')assertSameOrigin(request,cfg);
 return assertAdmin(env.DB,await resolveContext(request,cfg,env.DB,now),now);
}

/* ---------- push ---------- */

/** @param {C} c */
async function pushKey(c){
 const v=vapidFromEnv(c.env,c.origin);
 if(!v){const missing=[...(/^[A-Za-z0-9_-]{87}$/.test(String(c.env.VAPID_PUBLIC_KEY||''))?[]:['VAPID_PUBLIC_KEY']),...(/^[A-Za-z0-9_-]{43}$/.test(String(c.env.VAPID_PRIVATE_KEY||''))?[]:['VAPID_PRIVATE_KEY'])];throw notConfigured(missing[0],undefined,missing);}
 return {publicKey:v.publicKey};
}
/** @param {C} c */
async function subscribe(c){
 only(c.body,['subscription','prefs']);
 await limit(c,'push',10,c.admin.user_id);
 let s;try{s=parseSubscription(c.body.subscription);}catch(e){throw new ApiError('BAD_REQUEST','Invalid push subscription.',{field:`subscription.${String(/** @type {any} */(e)?.message||'')}`});}
 const prefs=normalizePrefs(c.body.prefs);
 await c.db.batch([
  c.db.prepare(`INSERT INTO push_subscriptions (endpoint,user_id,p256dh,auth,prefs,created_at,updated_at) VALUES (?,?,?,?,?,?,?)
   ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,prefs=excluded.prefs,updated_at=excluded.updated_at,failures=0`).bind(s.endpoint,c.admin.user_id,s.p256dh,s.auth,JSON.stringify(prefs),c.now,c.now),
  // At most 10 devices per admin: the least recently updated ones go.
  c.db.prepare('DELETE FROM push_subscriptions WHERE user_id=?1 AND endpoint NOT IN (SELECT endpoint FROM push_subscriptions WHERE user_id=?1 ORDER BY updated_at DESC LIMIT 10)').bind(c.admin.user_id)]);
 return {ok:true,prefs};
}
/** @param {C} c */
async function unsubscribe(c){
 only(c.body,['endpoint']);
 if(typeof c.body.endpoint!=='string'||c.body.endpoint.length>1024)throw new ApiError('BAD_REQUEST','Invalid endpoint.',{field:'endpoint'});
 await c.db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(c.body.endpoint,c.admin.user_id).run();
 return {ok:true};
}
/** @param {C} c */
async function getPrefs(c){
 const ep=c.url.searchParams.get('endpoint');
 const row=ep?await c.db.prepare('SELECT prefs FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(ep,c.admin.user_id).first():await c.db.prepare('SELECT prefs FROM push_subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT 1').bind(c.admin.user_id).first();
 return {prefs:row?storedPrefs(row.prefs):normalizePrefs(undefined),subscribed:!!row,defaults:DEFAULT_PREFS};
}
/** Update prefs of one device (endpoint) or of all my devices; missing keys keep their value. @param {C} c */
async function putPrefs(c){
 only(c.body,['prefs','endpoint']);
 await limit(c,'push',30,c.admin.user_id);
 const ep=c.body.endpoint;
 if(ep!==undefined&&(typeof ep!=='string'||ep.length>1024))throw new ApiError('BAD_REQUEST','Invalid endpoint.',{field:'endpoint'});
 const rows=((ep?await c.db.prepare('SELECT endpoint,prefs FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(ep,c.admin.user_id).all():await c.db.prepare('SELECT endpoint,prefs FROM push_subscriptions WHERE user_id=?').bind(c.admin.user_id).all()).results)||[];
 if(!rows.length){normalizePrefs(c.body.prefs);throw new ApiError('NOT_FOUND','This device has no push subscription yet.');}
 const out=rows.map((/** @type {any} */ r)=>({endpoint:String(r.endpoint),prefs:normalizePrefs(c.body.prefs,storedPrefs(r.prefs))}));
 await c.db.batch(out.map((/** @type {{endpoint:string,prefs:any}} */ o)=>c.db.prepare('UPDATE push_subscriptions SET prefs=?,updated_at=? WHERE endpoint=?').bind(JSON.stringify(o.prefs),c.now,o.endpoint)));
 return {ok:true,prefs:out[0].prefs,devices:out.length};
}
/** @param {C} c */
async function pushTest(c){
 only(c.body,['endpoint']);
 await limit(c,'push-test',5,c.admin.user_id);
 let subs=await adminSubscriptions(c.db,c.admin.user_id);
 if(typeof c.body.endpoint==='string')subs=subs.filter(s=>s.endpoint===c.body.endpoint);
 if(!vapidFromEnv(c.env,c.origin))throw notConfigured('VAPID_PRIVATE_KEY');
 if(!subs.length)return {ok:false,sent:0,failed:0};
 const r=await deliver(c.env,c.db,subs,{kind:'test',title:'Nerulio 관리',body:'테스트 알림입니다. 이 기기에서 알림을 받을 수 있어요.',url:'/admin/#/settings',tag:'test'},{now:c.now,fetch:c.fetch,origin:c.origin,urgency:'high'});
 return {ok:r.sent>0,...r};
}

/* ---------- notify (CI → push) ---------- */

/** POST /api/v2/admin/notify, Authorization: Bearer NOTIFY_TOKEN.
 * kind: collector_failed {runUrl?, label?: 'seed-sync'} | usage | status_stale | tick (every periodic check at once).
 * @param {C} c */
async function notify(c){
 const token=String(c.env.NOTIFY_TOKEN||'');
 if(token.length<32)throw notConfigured('NOTIFY_TOKEN');
 await limit(c,'notify',30);
 const m=/^Bearer ([\x21-\x7e]{1,512})$/.exec(c.request.headers.get('authorization')||'');
 if(!m||!safeEqual(await hmacHex(c.cfg.secret,'notify\n'+m[1]),await hmacHex(c.cfg.secret,'notify\n'+token)))throw new ApiError('INVALID_SIGNATURE','Bad notify token.');
 const body=await readJSON(c.request,4096);only(body,['kind','payload']);
 const kind=String(body.kind||'');
 if(!['collector_failed','usage','status_stale','tick'].includes(kind))throw new ApiError('BAD_REQUEST','Unknown kind.',{field:'kind'});
 if(!vapidFromEnv(c.env,c.origin))throw notConfigured('VAPID_PRIVATE_KEY');
 const subs=await adminSubscriptions(c.db);
 if(!subs.length)return {ok:true,devices:0,results:{}};
 const x={env:c.env,db:c.db,now:c.now,fetch:c.fetch,origin:c.origin,subs};
 /** @type {Record<string,unknown>} */const results={};
 /** @param {string} name @param {()=>Promise<unknown>} f */
 const step=async(name,f)=>{try{results[name]=await f();}catch(e){results[name]={error:e instanceof ApiError?e.code:'INTERNAL'};if(!(e instanceof ApiError))console.error('admin/notify',name,/** @type {any} */(e)?.message);}};
 const usage=async()=>checkUsage(x,usageLevel(await getUsage(x)));
 if(kind==='collector_failed')await step('collectors',()=>checkCollectorFailures(x,body.payload&&typeof body.payload==='object'?body.payload:{}));
 if(kind==='usage'||kind==='tick')await step('usage',usage);
 if(kind==='status_stale'||kind==='tick')await step('status',()=>checkStatusStale(x));
 if(kind==='tick'){
  await step('incidents',()=>checkIncidents(x));
  await step('flags',()=>checkFlagDigest(x));
  await step('review',()=>checkReviewDigest(x));
  await step('users',()=>checkNewUsers(x));
 }
 return {ok:true,devices:subs.length,day:seoulDay(c.now),results};
}

/* ---------- router ---------- */

/** @type {Route[]} */
const ROUTES=[
 {m:'POST',re:/^\/admin\/passkey\/register\/options$/,fn:registerOptions,public:true},
 {m:'POST',re:/^\/admin\/passkey\/register\/verify$/,fn:registerVerify,public:true,bodyLimit:32*1024},
 {m:'POST',re:/^\/admin\/passkey\/login\/options$/,fn:loginOptions,public:true},
 {m:'POST',re:/^\/admin\/passkey\/login\/verify$/,fn:loginVerify,public:true,bodyLimit:16*1024},
 {m:'POST',re:/^\/admin\/passkey\/remove$/,fn:removePasskey},
 {m:'GET',re:/^\/admin\/me$/,fn:me},
 {m:'GET',re:/^\/admin\/overview$/,fn:overview},
 {m:'GET',re:/^\/admin\/collectors$/,fn:collectors},
 {m:'GET',re:/^\/admin\/collectors\/([^/]{1,64})\/runs$/,fn:collectorRuns},
 {m:'POST',re:/^\/admin\/collectors\/run$/,fn:runCollectors},
 {m:'GET',re:/^\/admin\/usage$/,fn:c=>getUsage(c)},
 {m:'GET',re:/^\/admin\/radar$/,fn:radar},
 {m:'POST',re:/^\/admin\/radar\/action$/,fn:radarAction},
 {m:'GET',re:/^\/admin\/community$/,fn:community},
 {m:'GET',re:/^\/admin\/push\/key$/,fn:pushKey},
 {m:'POST',re:/^\/admin\/push\/subscribe$/,fn:subscribe},
 {m:'DELETE',re:/^\/admin\/push\/subscribe$/,fn:unsubscribe},
 {m:'GET',re:/^\/admin\/push\/prefs$/,fn:getPrefs},
 {m:'PUT',re:/^\/admin\/push\/prefs$/,fn:putPrefs},
 {m:'POST',re:/^\/admin\/push\/test$/,fn:pushTest},
 {m:'POST',re:/^\/admin\/notify$/,fn:notify,public:true},
];

/** Does this /api/v2 route belong to the admin app? @param {string} route */
export const isAdminRoute=route=>route==='/admin'||route.startsWith('/admin/');

/**
 * @param {Request} request @param {any} env @param {any} ctx
 * @param {{now?:()=>number,limiter?:any,fetch?:typeof fetch}} [deps]
 */
export async function handleAdminApi(request,env,ctx,deps={}){
 const url=new URL(request.url),route=url.pathname.replace(/^\/api\/v2/,'').replace(/\/+$/,'');
 /** @type {any} */let context=null;
 /** @type {string[]} */const cookies=[];
 try{
  let params=/** @type {string[]} */([]);
  // Unknown path or method: 404 like any other missing page (nothing about the admin surface leaks).
  const r=ROUTES.find(x=>{if(x.m!==request.method)return false;const mm=x.re.exec(route);if(mm)params=mm.slice(1).map(p=>{try{return decodeURIComponent(p);}catch{return "";}});return !!mm;});
  if(!r){
   // GET /admin/traffic belongs to server/traffic.js; it asks this module's gate first.
   if(route==='/admin/traffic')return handleTraffic(request,env,ctx,{requireAdmin:(/** @type {Request} */ rq,/** @type {any} */ e,/** @type {any} */ cx)=>requireAdmin(rq,e,cx,deps),now:deps.now,fetch:deps.fetch});
   throw new ApiError('NOT_FOUND');
  }
  const cfg=runtimeConfig(env),now=(deps.now||Date.now)(),db=env.DB;
  if(!cfg.configured)throw new ApiError('SERVICE_NOT_CONFIGURED');
  /** @type {C} */
  const c={request,env,ctx,deps,url,cfg,now,db,context:null,body:{},params,admin:null,cookies,fetch:deps.fetch||((/** @type {any[]} */ ...a)=>fetch(.../** @type {[any,any]} */(a))),origin:cfg.siteOrigin||url.origin};
  if(r.fn===notify)return json(await notify(c));
  if(request.method!=='GET')assertSameOrigin(request,cfg);
  context=c.context=await resolveContext(request,cfg,db,now);
  if(!r.public)c.admin=await assertAdmin(db,context,now);
  if(request.method!=='GET')c.body=await readJSON(request,r.bodyLimit||8192);
  const out=await r.fn(c);
  return json(out,200,{'Set-Cookie':[...context.setCookies,...cookies]});
 }catch(error){
  if(!(error instanceof ApiError))console.error('api/v2/admin',route,/** @type {any} */(error)?.name,/** @type {any} */(error)?.message);
  return errorResponse(error,context?{'Set-Cookie':[...context.setCookies,...cookies]}:{});
 }
}
