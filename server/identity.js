import {randomToken,sha256,sign,unsign} from './crypto.js';
import {cookie,clearCookie,parseCookies} from './http.js';
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
 const row=await db.prepare(`SELECT u.id,u.email,u.display_name,u.provider,u.provider_subject,u.flagged_at,u.flag_reason,s.created_at AS session_created,s.expires_at
  FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2`).bind(await sha256(raw),now).first();
 return row||null;
}
/** Does one subscription row grant Pro right now? (docs/BILLING.md, "Pro 판정")
 *  - plan must be 'pro' (a price id sold as Pro) and the row must not be disputed;
 *  - active / trialing: until current_period_end (a scheduled cancellation stays Pro until then);
 *  - canceled, including after a voluntary refund: the paid period is honoured until its end;
 *  - past_due: Pro for PAST_DUE_GRACE_DAYS from the start of the past_due spell;
 *  - anything else (paused, unknown…): Free. */
export function grantsPro(row,now,{pastDueGraceDays=7}={}){
 if(!row||row.plan!=='pro'||row.disputed_at)return false;
 const end=Number(row.current_period_end)||0;
 if(PRO_STATUSES.includes(row.status)||row.status==='canceled')return end>now;
 if(row.status==='past_due')return !!row.past_due_since&&now<Number(row.past_due_since)+pastDueGraceDays*864e5;
 return false;
}
/** Pro is decided only from D1 subscription rows written by verified webhooks (or an operator's
 * 'manual' row). An account flagged by a payment dispute is never Pro. `user` is the session
 * row (or a bare user id when the flag is not needed). */
export async function subscriptionFor(db,user,now,cfg={}){
 const userId=typeof user==='string'?user:user.id;
 const {results=[]}=await db.prepare('SELECT provider,plan,status,current_period_end,cancel_at_period_end,past_due_since,disputed_at,price_id FROM subscriptions WHERE user_id=?1 ORDER BY updated_at DESC LIMIT 20').bind(userId).all();
 if(!results.length)return {plan:'free',subscription:null};
 const flagged=typeof user==='object'&&!!user.flagged_at;
 const active=flagged?null:results.find(r=>grantsPro(r,now,cfg));
 const row=active||results[0];
 const graceDays=cfg.pastDueGraceDays??7;
 return {plan:active?'pro':'free',subscription:{provider:row.provider,status:row.status,
  currentPeriodEnd:row.current_period_end?new Date(Number(row.current_period_end)).toISOString():null,cancelAtPeriodEnd:!!row.cancel_at_period_end,
  pastDue:row.status==='past_due',graceEndsAt:row.status==='past_due'&&row.past_due_since?new Date(Number(row.past_due_since)+graceDays*864e5).toISOString():null,
  disputed:!!row.disputed_at||flagged}};
}
/** Resolves who is calling. Issues an anonymous cookie on first contact (`newAnon`). */
export async function resolveContext(request,cfg,db,now){
 const url=new URL(request.url),cookies=parseCookies(request.headers.get('cookie')),secure=secureCookies(url),setCookies=[];
 let anonId=await readAnon(cookies[ANON_COOKIE],cfg.secret),newAnon=false;
 if(!anonId){const issued=await issueAnon(cfg.secret,secure);anonId=issued.id;newAnon=true;setCookies.push(issued.cookie);}
 const user=cookies[SESSION_COOKIE]?await loadSession(db,cookies[SESSION_COOKIE],now):null;
 // An expired, revoked or malformed session cookie is removed rather than resent forever.
 if(cookies[SESSION_COOKIE]&&!user)setCookies.push(clearCookie(SESSION_COOKIE,{secure}));
 const {plan,subscription}=user?await subscriptionFor(db,user,now,cfg):{plan:'free',subscription:null};
 return {url,cookies,secure,setCookies,anonId,newAnon,user,plan,subscription,subject:user?`u:${user.id}`:`a:${anonId}`};
}
