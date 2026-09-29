// @ts-check
/** The sign-in flow shared by every provider (docs/AUTH.md):
 *   GET /api/v1/auth/{provider}/start?return=/ko/…[&link=1] → provider → GET /api/v1/auth/{provider}/callback
 * - state (256-bit) + PKCE S256 verifier + nonce live in one HMAC-signed, host-only cookie (nerulio_oauth,
 *   Path=/api/v1/auth/, 10 minutes) that also names the provider, so a callback of another provider or
 *   another tab's flow is refused before any token exchange; the cookie is cleared by every callback.
 * - the callback URL is the origin that started the flow, so the host-only cookie comes back with it.
 * - `return` is a same-site relative path only (safeReturnPath): no open redirect.
 * - identity = (provider, provider subject) in user_identities; e-mail never links accounts. A signed-in
 *   member links another provider explicitly (link=1), and may unlink one while another way to sign in
 *   (identity or admin passkey) remains.
 * - provider access tokens are used inside the callback and dropped; only the session token's SHA-256 is stored. */
import {base64url,fromBase64url,randomToken,sha256,sha256Bytes,sign,unsign,safeEqual} from '../crypto.js';
import {ApiError,cookie,clearCookie,redirect} from '../http.js';
import {OAUTH_COOKIE,SESSION_COOKIE} from '../identity.js';
import {OAUTH_TTL_MS,SESSION_TTL_MS} from '../config.js';
import {carryOverStatements} from '../usage.js';
import {PROVIDERS,isProvider,upstreamFor} from './providers.js';

/** @typedef {import('./util.js').ProviderId} ProviderId @typedef {import('./util.js').Profile} Profile @typedef {import('./util.js').Fetch} Fetch */
/** @typedef {{id:string,email?:string|null,display_name?:string|null,provider:string,provider_subject:string}} SessionUser */
/** @typedef {{url:URL,cookies:Record<string,string>,secure:boolean,setCookies:string[],anonId:string|null,user:SessionUser|null}} Ctx */
/** @typedef {{secret:string,oauth:Record<ProviderId,{clientId:string,clientSecret:string}>,oauthTestOrigin?:string,maxSessionsPerUser?:number}} Cfg */

const COOKIE_PATH='/api/v1/auth/';
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const LOCALES=['ko','en','ja'];

/** Only same-site relative paths; never "//host", schemes or backslashes. @param {unknown} value */
export function safeReturnPath(value){
 const s=String(value||'');
 return /^\/(?![\/\\])[A-Za-z0-9\-._~\/?=&%]*$/.test(s)&&s.length<=256?s:'/account/';
}
/** @param {ProviderId} id */
export const callbackPath=id=>`/api/v1/auth/${id}/callback`;
/** The host that started the flow receives the callback. Every origin used for sign-in must be registered
 * with the provider (docs/CLOUDFLARE.md "소셜 로그인"). @param {{url:URL}} ctx @param {ProviderId} id */
export const redirectURI=(ctx,id)=>ctx.url.origin+callbackPath(id);
/** @param {string} path */
const localeOf=path=>/^\/(ko|en|ja)(?:\/|$)/.exec(path||'')?.[1]||'';
/** First supported language of an Accept-Language header, else English. @param {string|null|undefined} header */
export function preferredLocale(header){
 for(const part of String(header||'').split(',')){const tag=part.split(';')[0].trim().toLowerCase().slice(0,2);if(LOCALES.includes(tag))return tag;}
 return 'en';
}
/** @param {Ctx} ctx */
const clearState=ctx=>clearCookie(OAUTH_COOKIE,{path:COOKIE_PATH,secure:ctx.secure});

/** A failed or refused sign-in lands on the account page of the reader's language with a reason the page
 * explains (denied, state, unavailable, linked_elsewhere …) and everything a retry needs.
 * @param {Ctx} ctx @param {{id:ProviderId,reason:string,returnTo:string,link:boolean,acceptLanguage?:string|null}} o */
function failed(ctx,o){
 const l=localeOf(o.returnTo)||preferredLocale(o.acceptLanguage),account=`/${l}/account/`;
 const q=new URLSearchParams({login:'failed',reason:o.reason,provider:o.id});
 if(o.returnTo&&o.returnTo!==account&&o.returnTo!=='/account/')q.set('return',o.returnTo);
 if(o.link)q.set('link','1');
 return redirect(`${account}?${q}`,[...ctx.setCookies,clearState(ctx)]);
}

/** @param {Ctx} ctx @param {Cfg} cfg @param {number} now @param {ProviderId} id */
export async function startLogin(ctx,cfg,now,id){
 const provider=PROVIDERS[id],credentials=cfg.oauth[id];
 if(!credentials.clientId||!credentials.clientSecret)throw new ApiError('SERVICE_NOT_CONFIGURED',`${provider.name} sign-in is not configured.`);
 const q=ctx.url.searchParams,returnTo=safeReturnPath(q.get('return')),link=q.get('link')==='1';
 // Linking adds a way into the signed-in account, so it needs that account's session.
 if(link&&!ctx.user)return failed(ctx,{id,reason:'link_session',returnTo,link});
 const state=randomToken(),verifier=randomToken(48),nonce=randomToken();
 const payload=base64url(new TextEncoder().encode(JSON.stringify({p:id,state,verifier,nonce,returnTo,link:link&&ctx.user?ctx.user.id:'',exp:now+OAUTH_TTL_MS})));
 const location=provider.authorizeURL({clientId:credentials.clientId,redirectURI:redirectURI(ctx,id),state,challenge:base64url(await sha256Bytes(verifier)),nonce},upstreamFor(cfg.oauthTestOrigin||''));
 return redirect(location,[...ctx.setCookies,cookie(OAUTH_COOKIE,await sign(cfg.secret,'oauth/v1',payload),{maxAge:OAUTH_TTL_MS/1000,path:COOKIE_PATH,secure:ctx.secure})]);
}

/** @param {Ctx} ctx @param {Cfg} cfg */
async function savedState(ctx,cfg){
 const raw=await unsign(cfg.secret,'oauth/v1',ctx.cookies[OAUTH_COOKIE]);
 if(!raw)return null;
 try{
  const s=JSON.parse(new TextDecoder().decode(fromBase64url(raw)));
  // Flows started before providers were generalized carry no provider: they were Google's.
  return s&&typeof s==='object'?{...s,p:s.p||'google'}:null;
 }catch{return null;}
}

/**
 * @param {Ctx} ctx @param {Cfg} cfg @param {any} db @param {number} now @param {ProviderId} id
 * @param {{fetch?:Fetch,acceptLanguage?:string|null}} [o]
 */
export async function finishLogin(ctx,cfg,db,now,id,o={}){
 const q=ctx.url.searchParams,saved=await savedState(ctx,cfg);
 const returnTo=saved?safeReturnPath(saved.returnTo):'';
 const fail=(/** @type {string} */ reason)=>failed(ctx,{id,reason,returnTo,link:!!saved?.link,acceptLanguage:o.acceptLanguage});
 // The member pressed "cancel" (access_denied) or the provider refused the request.
 if(q.get('error'))return fail(q.get('error')==='access_denied'?'denied':'provider');
 // Another provider's flow, an expired or replayed flow, or a forged state: refused before any exchange.
 if(!saved||saved.p!==id||!(saved.exp>now)||!q.get('state')||!safeEqual(q.get('state'),saved.state))return fail('state');
 const code=q.get('code');if(!code||code.length>2048)return fail('code');
 const credentials=cfg.oauth[id];
 if(!credentials.clientId||!credentials.clientSecret)return fail('unavailable');
 if(saved.link&&ctx.user?.id!==saved.link)return fail('link_session');
 const result=await PROVIDERS[id].profile({code,verifier:String(saved.verifier),nonce:String(saved.nonce),redirectURI:redirectURI(ctx,id),credentials,now,
  fetch:o.fetch||((input,init)=>fetch(input,init)),upstream:upstreamFor(cfg.oauthTestOrigin||'')});
 if(!result.ok)return fail(result.reason);
 if(saved.link&&ctx.user){
  const refused=await linkIdentity(db,ctx.user,id,result.profile,now);
  if(refused)return fail(refused);
  const target=new URL(returnTo,ctx.url.origin);target.searchParams.set('linked',id);
  return redirect(target.pathname+target.search,[...ctx.setCookies,clearState(ctx)]);
 }
 const {userId,statements}=await accountFor(db,id,result.profile,now);
 const session=await sessionStatements(ctx,cfg,db,now,userId);
 await db.batch([...statements,...session.statements]);
 const target=new URL(returnTo,ctx.url.origin);target.searchParams.set('login','ok');
 return redirect(target.pathname+target.search,[...ctx.setCookies,clearState(ctx),session.cookie]);
}

/** A new session for `userId` on this browser: its previous session is replaced, today's anonymous usage
 * carries over, and at most MAX_SESSIONS_PER_USER sessions stay alive (the oldest are signed out).
 * @param {Ctx} ctx @param {Cfg} cfg @param {any} db @param {number} now @param {string} userId */
export async function sessionStatements(ctx,cfg,db,now,userId){
 const token=randomToken();
 const statements=[db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),userId,now,now+SESSION_TTL_MS)];
 const previous=ctx.cookies[SESSION_COOKIE];
 if(previous&&TOKEN.test(previous))statements.push(db.prepare('DELETE FROM sessions WHERE token_hash=?1').bind(await sha256(previous)));
 if(ctx.anonId)statements.push(...carryOverStatements(db,`a:${ctx.anonId}`,`u:${userId}`,now));
 statements.push(db.prepare('DELETE FROM sessions WHERE user_id=?1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=?1 ORDER BY created_at DESC,token_hash LIMIT ?2)').bind(userId,cfg.maxSessionsPerUser||5));
 return {statements,cookie:cookie(SESSION_COOKIE,token,{maxAge:SESSION_TTL_MS/1000,secure:ctx.secure})};
}

/** The account that owns (provider, subject): its identity row, else (accounts from before 0011 or
 * inserted directly) the users row created with that identity. @param {any} db @param {string} provider @param {string} subject @returns {Promise<string|null>} */
export async function ownerOf(db,provider,subject){
 const row=await db.prepare('SELECT user_id FROM user_identities WHERE provider=?1 AND provider_subject=?2').bind(provider,subject).first();
 if(row)return String(row.user_id);
 const legacy=await db.prepare('SELECT id FROM users WHERE provider=?1 AND provider_subject=?2').bind(provider,subject).first();
 return legacy?String(legacy.id):null;
}
/** @param {any} db @param {string} userId @param {ProviderId} id @param {Profile} p @param {number} now */
const upsertIdentity=(db,userId,id,p,now)=>db.prepare(`INSERT INTO user_identities(provider,provider_subject,user_id,email,display_name,handle,created_at,last_login_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?7)
 ON CONFLICT(provider,provider_subject) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,handle=excluded.handle,last_login_at=excluded.last_login_at`).bind(id,p.subject,userId,p.email,p.name,p.handle,now);

/** Sign-in: the account of (provider, subject), or a new account. Never matched by e-mail: a Discord
 * account with the same address as someone's Google account is a different person until proven otherwise.
 * Returns the statements that refresh the identity (committed together with the new session).
 * @param {any} db @param {ProviderId} id @param {Profile} profile @param {number} now */
export async function accountFor(db,id,profile,now){
 let userId=await ownerOf(db,id,profile.subject);
 const statements=[];
 if(!userId){
  // Two simultaneous first sign-ins of one subject both end on the same row (ON CONFLICT … RETURNING).
  const row=await db.prepare(`INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,?2,?3,?4,?5,?6)
   ON CONFLICT(provider,provider_subject) DO UPDATE SET email=COALESCE(excluded.email,users.email) RETURNING id`).bind(randomToken(16),profile.email,profile.name,id,profile.subject,now).first();
  userId=String(row.id);
 }else{
  // The account's e-mail and name follow its first identity; another identity only fills a gap.
  statements.push(db.prepare(`UPDATE users SET email=CASE WHEN provider=?2 AND provider_subject=?3 THEN COALESCE(?4,email) ELSE COALESCE(email,?4) END,
   display_name=CASE WHEN provider=?2 AND provider_subject=?3 THEN COALESCE(?5,display_name) ELSE COALESCE(display_name,?5) END WHERE id=?1`).bind(userId,id,profile.subject,profile.email,profile.name));
 }
 statements.push(upsertIdentity(db,userId,id,profile,now));
 return {userId,statements};
}

/** @typedef {{provider:string,subject:string,email:string|null,since:number,lastUsed:number|null}} Identity */
/** The sign-in identities of an account (oldest first). An account from before 0011 (or inserted directly)
 * gets its first identity row on first use. @param {any} db @param {SessionUser} user @param {number} now @returns {Promise<Identity[]>} */
export async function identitiesOf(db,user,now){
 const read=async()=>/** @type {any[]} */((await db.prepare('SELECT provider,provider_subject,email,created_at,last_login_at FROM user_identities WHERE user_id=?1 ORDER BY created_at,provider').bind(user.id).all()).results||[]);
 let rows=await read();
 if(!rows.length&&isProvider(user.provider)){
  await db.prepare('INSERT OR IGNORE INTO user_identities(provider,provider_subject,user_id,email,display_name,handle,created_at,last_login_at) VALUES(?1,?2,?3,?4,?5,NULL,?6,NULL)')
   .bind(user.provider,user.provider_subject,user.id,user.email??null,user.display_name??null,now).run();
  rows=await read();
 }
 return rows.map(r=>({provider:String(r.provider),subject:String(r.provider_subject),email:r.email?String(r.email):null,since:Number(r.created_at),lastUsed:r.last_login_at==null?null:Number(r.last_login_at)}));
}
/** Admin passkeys also sign in to an account (server/platform/admin.js). @param {any} db @param {string} userId */
const passkeysOf=async(db,userId)=>Number((await db.prepare('SELECT COUNT(*) AS n FROM admin_credentials WHERE user_id=?1').bind(userId).first())?.n||0);

/** Link (provider, subject) to the signed-in account. Returns '' or why it was refused:
 * linked_elsewhere (another Nerulio account signs in with it — accounts are never merged silently),
 * already_linked (this account already has a different account of that provider).
 * @param {any} db @param {SessionUser} user @param {ProviderId} id @param {Profile} profile @param {number} now */
export async function linkIdentity(db,user,id,profile,now){
 const owner=await ownerOf(db,id,profile.subject);
 if(owner&&owner!==user.id)return 'linked_elsewhere';
 const mine=await identitiesOf(db,user,now);
 if(!owner&&mine.some(i=>i.provider===id))return 'already_linked';
 await upsertIdentity(db,user.id,id,profile,now).run();
 return '';
}

/** What the account page shows under 연결된 로그인. @param {any} db @param {SessionUser} user @param {number} now */
export async function signInMethods(db,user,now){
 const [identities,passkeys]=await Promise.all([identitiesOf(db,user,now),passkeysOf(db,user.id)]);
 return {identities:identities.map(i=>({provider:i.provider,email:i.email,since:new Date(i.since).toISOString()})),passkeys,canUnlink:identities.length+passkeys>1};
}

/** Remove one provider from the signed-in account, only while another way to sign in remains.
 * @param {any} db @param {SessionUser} user @param {unknown} provider @param {number} now */
export async function unlinkIdentity(db,user,provider,now){
 if(!isProvider(provider))throw new ApiError('BAD_REQUEST','Unknown provider.');
 const list=await identitiesOf(db,user,now),target=list.find(i=>i.provider===provider);
 if(!target)throw new ApiError('NOT_FOUND','This sign-in method is not linked.');
 const rest=list.filter(i=>i!==target);
 if(rest.length+await passkeysOf(db,user.id)<1)throw new ApiError('OPERATION_CONFLICT','This is the only way to sign in to this account.',{reason:'last_method'});
 const statements=[db.prepare('DELETE FROM user_identities WHERE provider=?1 AND provider_subject=?2 AND user_id=?3').bind(target.provider,target.subject,user.id)];
 // users.provider/provider_subject names the account's first identity (and is UNIQUE): hand it to the next
 // one, so the unlinked provider account can later sign up on its own without colliding.
 if(user.provider===target.provider&&user.provider_subject===target.subject){
  const next=rest[0];
  statements.push(db.prepare('UPDATE users SET provider=?2,provider_subject=?3 WHERE id=?1').bind(user.id,next?next.provider:'unlinked',next?next.subject:user.id));
 }
 await db.batch(statements);
 return signInMethods(db,{...user,...(statements.length>1?{provider:rest[0]?.provider||'unlinked',provider_subject:rest[0]?.subject||user.id}:{})},now);
}

/** Signing out deletes the session and moves today's counters back onto this browser's
 * anonymous identity (MAX), so "use the account's allowance, sign out, continue anonymously"
 * is not a second allowance. @param {Ctx} ctx @param {any} db */
export async function logout(ctx,db,now=Date.now()){
 const raw=ctx.cookies[SESSION_COOKIE],statements=[];
 if(raw&&TOKEN.test(raw))statements.push(db.prepare('DELETE FROM sessions WHERE token_hash=?1').bind(await sha256(raw)));
 if(ctx.user&&ctx.anonId)statements.push(...carryOverStatements(db,`u:${ctx.user.id}`,`a:${ctx.anonId}`,now));
 if(statements.length)await db.batch(statements);
 return clearCookie(SESSION_COOKIE,{secure:ctx.secure});
}
