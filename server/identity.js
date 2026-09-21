import {randomToken,sha256,sign,unsign} from './crypto.js';
import {cookie,parseCookies} from './http.js';
import {ANON_TTL_MS,PRO_STATUSES} from './config.js';
/** Identity model:
 *  - anonymous: signed random id in nerulio_anon (no DB row until a heavy job is authorized)
 *  - signed-in: random session token in nerulio_session; D1 keeps only SHA-256(token)
 * Neither is derived from files, file names, e-mail or device fingerprints. */
export const ANON_COOKIE='nerulio_anon',SESSION_COOKIE='nerulio_session',HUMAN_COOKIE='nerulio_human',OAUTH_COOKIE='nerulio_oauth';
const TOKEN=/^[A-Za-z0-9_-]{43}$/,ANON_ID=/^[A-Za-z0-9_-]{22}$/;
export const secureCookies=url=>!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
export async function readAnon(value,secret){
 const id=await unsign(secret,'anon/v1',value);
 return id&&ANON_ID.test(id)?id:null;
}
export async function issueAnon(secret,secure){
 const id=randomToken(16);
 return {id,cookie:cookie(ANON_COOKIE,await sign(secret,'anon/v1',id),{maxAge:ANON_TTL_MS/1000,secure})};
}
export async function loadSession(db,raw,now){
 if(!TOKEN.test(raw||''))return null;
 const row=await db.prepare(`SELECT u.id,u.email,u.display_name,u.provider,u.provider_subject,s.created_at AS session_created,s.expires_at
  FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2`).bind(await sha256(raw),now).first();
 return row||null;
}
/** Pro is decided only from D1 subscription rows written by verified webhooks. A scheduled
 * cancellation keeps Pro until current_period_end; expiry falls back to Free with no job. */
export async function subscriptionFor(db,userId,now){
 const row=await db.prepare(`SELECT provider,plan,status,current_period_end,cancel_at_period_end FROM subscriptions WHERE user_id=?1
  ORDER BY (plan='pro' AND status IN (${PRO_STATUSES.map(s=>`'${s}'`).join(',')}) AND current_period_end>?2) DESC,updated_at DESC LIMIT 1`).bind(userId,now).first();
 if(!row)return {plan:'free',subscription:null};
 const pro=row.plan==='pro'&&PRO_STATUSES.includes(row.status)&&Number(row.current_period_end)>now;
 return {plan:pro?'pro':'free',subscription:{provider:row.provider,status:row.status,currentPeriodEnd:row.current_period_end?new Date(Number(row.current_period_end)).toISOString():null,cancelAtPeriodEnd:!!row.cancel_at_period_end}};
}
/** Resolves who is calling. Issues an anonymous cookie on first contact. */
export async function resolveContext(request,cfg,db,now){
 const url=new URL(request.url),cookies=parseCookies(request.headers.get('cookie')),secure=secureCookies(url),setCookies=[];
 let anonId=await readAnon(cookies[ANON_COOKIE],cfg.secret);
 if(!anonId){const issued=await issueAnon(cfg.secret,secure);anonId=issued.id;setCookies.push(issued.cookie);}
 const user=cookies[SESSION_COOKIE]?await loadSession(db,cookies[SESSION_COOKIE],now):null;
 const {plan,subscription}=user?await subscriptionFor(db,user.id,now):{plan:'free',subscription:null};
 return {url,cookies,secure,setCookies,anonId,user,plan,subscription,subject:user?`u:${user.id}`:`a:${anonId}`};
}
