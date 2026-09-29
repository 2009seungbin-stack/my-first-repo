// @ts-check
/** Member passkeys — the 고정닉 path (docs/CLOUDFLARE.md "고정닉(패스키) 가입"):
 *   POST /api/v1/auth/passkey/register/options {displayName, turnstileToken?}  → creation options
 *   POST /api/v1/auth/passkey/register/verify  {credential, name?}            → new account + session
 *   POST /api/v1/auth/passkey/login/options    {}                             → request options (discoverable)
 *   POST /api/v1/auth/passkey/login/verify     {credential}                   → session
 *   POST /api/v1/auth/passkey/add/options      {}                             → another device (signed in)
 *   POST /api/v1/auth/passkey/add/verify       {credential, name?}
 *   POST /api/v1/auth/passkey/remove           {id}                           → keeps at least one way in
 *
 * The WebAuthn checks are server/webauthn.js (the admin app's verifier). Member ceremonies differ from the
 * admin's in every place that grants access:
 *  - challenges carry purpose 'm-reg' / 'm-auth' (the admin accepts only 'reg' / 'auth'), so a challenge
 *    issued here cannot finish an admin ceremony and vice versa;
 *  - member credentials live in member_credentials; the admin app reads admin_credentials only;
 *  - an account with role 'admin' can neither add a member passkey nor sign in with one, so a member
 *    passkey never yields a session that the admin app would accept.
 * Challenges are bound to this browser by a nonce cookie (Path=/api/v1/auth/passkey/, 5 minutes) and are
 * single-use (webauthn_used). Sign-up needs a Turnstile check when TURNSTILE_SECRET_KEY is set; a production
 * build without it refuses sign-up (503 NOT_CONFIGURED), previews allow fewer sign-ups per network. */
import {ApiError,cookie,clearCookie} from './http.js';
import {randomToken,sha256,safeEqual,base64url} from './crypto.js';
import {makeChallenge,readChallenge,challengeHash,verifyRegistration,verifyAuthentication,WebAuthnError} from './webauthn.js';
import {verifyTurnstile} from './turnstile.js';
import {sessionStatements,signInMethods} from './oauth/flow.js';
import {quotaDay} from '../src/quota.js';
import {LIMITS} from '../platform/community.js';
import {reservedNickname} from './platform/api.js';

export const PASSKEY_COOKIE='nerulio_passkey';
const COOKIE_PATH='/api/v1/auth/passkey/';
/** A signed-in member adds a device only with a session younger than this (a stolen old cookie cannot). */
export const ADD_DEVICE_SESSION_MS=12*36e5;
/** Sign-ups per network (/24 or /48) per UTC day: with Turnstile, and on a preview without it. */
export const SIGNUPS_PER_NETWORK=Object.freeze({verified:5,unverified:2});
const SIGNUP_SUFFIX='#signup';

/** What the sign-in UIs may offer. signup: false on a production build without Turnstile.
 * @param {any} cfg @returns {{signin:boolean,signup:boolean,turnstileSiteKey:string}} */
export function passkeyAvailability(cfg){
 const turnstile=!!(cfg.turnstile?.siteKey&&cfg.turnstile?.secret);
 return {signin:!!cfg.configured,signup:!!cfg.configured&&(turnstile||cfg.environment!=='production'),turnstileSiteKey:turnstile?String(cfg.turnstile.siteKey):''};
}
/** @param {string} need @param {string} message */
const notConfigured=(need,message)=>new ApiError('NOT_CONFIGURED',message,{need},{need,missing:[need]});

/** @param {Record<string,unknown>} body @param {string[]} allowed */
function only(body,allowed){for(const k of Object.keys(body))if(!allowed.includes(k))throw new ApiError('BAD_REQUEST',`Unexpected field: ${k.slice(0,40)}`);return body;}
/** Nickname rules shared with the 내 정보 form (server/platform/api.js POST /profile). @param {unknown} v */
export function nickname(v){
 if(typeof v!=='string')throw new ApiError('BAD_REQUEST','displayName is required.',{field:'displayName'});
 const s=v.replace(/[\u0000-\u001f\u007f]/g,'').trim(),n=[...s].length;
 if(n<LIMITS.nickname[0]||n>LIMITS.nickname[1])throw new ApiError('BAD_REQUEST',`displayName must be ${LIMITS.nickname[0]}–${LIMITS.nickname[1]} characters.`,{field:'displayName'});
 if(reservedNickname(s))throw new ApiError('BAD_REQUEST','This nickname is reserved.',{field:'displayName'});
 return s;
}
/** @param {any} db @param {string} name */
const nicknameTaken=async(db,name)=>!!(await db.prepare('SELECT 1 FROM user_profiles WHERE lower(display_name)=lower(?)').bind(name).first());
/** @param {unknown} v @param {string} l */
function deviceName(v,l){
 if(v===undefined||v===null||v==='')return l==='ko'?'이 기기':'This device';
 if(typeof v!=='string')throw new ApiError('BAD_REQUEST','Invalid name.',{field:'name'});
 const s=v.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 if(!s||[...s].length>40)throw new ApiError('BAD_REQUEST','name must be 1–40 characters.',{field:'name'});
 return s;
}
/** @param {unknown} e */
function passkeyError(e){if(e instanceof WebAuthnError)return new ApiError('PASSKEY_REJECTED','The passkey response was rejected.',{reason:e.message});return e;}
/** @param {any} db @param {any[]} statements */
async function batchOnce(db,statements){
 try{return await db.batch(statements);}
 catch(e){if(/UNIQUE|PRIMARY KEY|constraint/i.test(String(/** @type {any} */(e)?.message)))throw new ApiError('OPERATION_CONFLICT','This passkey response was already used, or the nickname was just taken.');throw e;}
}

/** @typedef {{request:Request,ctx:any,cfg:any,db:any,now:number,body:any,deps:any,nets:{narrow:string,wide:string}|null,ip:string}} P */

/** A fresh nonce cookie for one ceremony; the challenge carries its hash. @param {P} p */
async function newNonce(p){
 const nonce=randomToken();
 p.ctx.setCookies.push(cookie(PASSKEY_COOKIE,nonce,{maxAge:300,path:COOKIE_PATH,secure:p.ctx.secure}));
 return (await sha256('member-passkey-nonce\n'+nonce)).slice(0,32);
}
const clearNonce=(/** @type {P} */ p)=>p.ctx.setCookies.push(clearCookie(PASSKEY_COOKIE,{path:COOKIE_PATH,secure:p.ctx.secure}));
/** The challenge must be ours, unexpired, of this ceremony, issued to this browser and never used.
 * @param {P} p @param {'m-reg'|'m-auth'} purpose */
function challengeCheck(p,purpose){
 return async(/** @type {string} */ ch)=>{
  const d=await readChallenge(p.cfg.secret,ch,p.now),nonce=p.ctx.cookies[PASSKEY_COOKIE];
  if(!d||d.p!==purpose||typeof nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(nonce))return null;
  if(!safeEqual(d.n,(await sha256('member-passkey-nonce\n'+nonce)).slice(0,32)))return null;
  if(await p.db.prepare('SELECT 1 FROM webauthn_used WHERE challenge_hash=?').bind(await challengeHash(ch)).first())return null;
  return d;
 };
}
/** @param {P} p @param {any} v */
async function usedStatements(p,v){
 return [p.db.prepare('DELETE FROM webauthn_used WHERE expires_at<?').bind(p.now),
  p.db.prepare('INSERT INTO webauthn_used (challenge_hash,expires_at) VALUES (?,?)').bind(await challengeHash(v.clientChallenge),Number(v.challenge.e)||p.now)];
}
/** @param {P} p */
const signupSubject=p=>(p.nets?.wide||'w:unknown')+SIGNUP_SUFFIX;
/** @param {P} p */
const signupLimit=p=>{const n=Number(p.cfg.memberSignupsPerNetwork);return Number.isInteger(n)&&n>=1?n:p.cfg.turnstile?.secret?SIGNUPS_PER_NETWORK.verified:SIGNUPS_PER_NETWORK.unverified;};
/** @param {P} p */
async function assertSignupQuota(p){
 const row=await p.db.prepare('SELECT used FROM daily_usage WHERE subject_id=?1 AND day=?2').bind(signupSubject(p),quotaDay(p.now)).first();
 if(Number(row?.used||0)>=signupLimit(p))throw new ApiError('NETWORK_LIMIT','Too many new accounts from this network today. Please try again tomorrow.',{retryAfter:3600});
}
/** The admin role never signs in with a member passkey. @param {any} db @param {string} userId */
const roleOf=async(db,userId)=>String((await db.prepare('SELECT role FROM user_profiles WHERE user_id=?').bind(userId).first())?.role||'user');
/** The WebAuthn user handle of an account's passkeys (one per account), or null. @param {any} db @param {string} userId */
const handleOf=async(db,userId)=>{const r=await db.prepare("SELECT provider_subject FROM user_identities WHERE user_id=? AND provider='passkey'").bind(userId).first();return r?String(r.provider_subject):null;};
/** @param {P} p @param {{handle:string,name:string,displayName:string,exclude?:{type:'public-key',id:string}[],data:Record<string,unknown>}} o */
async function creationOptions(p,o){
 const n=await newNonce(p);
 return {
  rp:{id:p.ctx.url.hostname,name:'Nerulio'},
  user:{id:o.handle,name:o.name,displayName:o.displayName},
  challenge:await makeChallenge(p.cfg.secret,{...o.data,p:'m-reg',n},p.now),
  pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
  timeout:120000,attestation:'none',excludeCredentials:o.exclude||[],
  authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'preferred'},
  extensions:{credProps:true}
 };
}

/** Sign-up, step 1: nickname and bot check first, then the passkey. @param {P} p */
async function registerOptions(p){
 only(p.body,['displayName','turnstileToken','locale']);
 if(p.ctx.user)throw new ApiError('OPERATION_CONFLICT','You are already signed in. Add this device to your account instead.',{reason:'signed_in'});
 const secret=p.cfg.turnstile?.secret;
 if(!secret&&p.cfg.environment==='production')throw notConfigured('TURNSTILE_SECRET_KEY','Sign-up needs a Turnstile bot check on this deployment (TURNSTILE_SECRET_KEY).');
 const name=nickname(p.body.displayName);
 if(await nicknameTaken(p.db,name))throw new ApiError('OPERATION_CONFLICT','This nickname is taken.',{field:'displayName'});
 await assertSignupQuota(p);
 if(secret){
  const token=p.body.turnstileToken;
  if(!token)throw new ApiError('CHALLENGE_REQUIRED','Please confirm you are human.',{siteKey:p.cfg.turnstile.siteKey});
  if(!await verifyTurnstile({token,secret,ip:p.ip,expectedAction:'signup',hostname:p.ctx.url.hostname,allowTestingKey:p.cfg.environment!=='production'},p.deps.fetch))throw new ApiError('CHALLENGE_FAILED');
 }
 const handle=base64url(crypto.getRandomValues(new Uint8Array(16)));
 return creationOptions(p,{handle,name,displayName:name,data:{m:'signup',h:handle,d:name,l:p.body.locale==='en'||p.body.locale==='ja'?p.body.locale:'ko'}});
}
/** Another device for the signed-in member (any sign-in method; never an admin account). @param {P} p */
async function addOptions(p){
 only(p.body,[]);
 const user=p.ctx.user;
 if(!user)throw new ApiError('LOGIN_REQUIRED');
 if(await roleOf(p.db,user.id)==='admin')throw new ApiError('FORBIDDEN','Admin accounts use the admin app\'s passkeys.');
 if(p.now-Number(user.session_created)>ADD_DEVICE_SESSION_MS)throw new ApiError('REAUTH','Sign in again before adding a device.');
 const handle=await handleOf(p.db,user.id)||base64url(crypto.getRandomValues(new Uint8Array(16)));
 const exclude=((await p.db.prepare('SELECT id FROM member_credentials WHERE user_id=?').bind(user.id).all()).results||[]).map((/** @type {any} */ r)=>({type:/** @type {'public-key'} */('public-key'),id:String(r.id)}));
 const prof=await p.db.prepare('SELECT display_name FROM user_profiles WHERE user_id=?').bind(user.id).first();
 const name=String(prof?.display_name||'Nerulio');
 return creationOptions(p,{handle,name,displayName:name,exclude,data:{m:'add',h:handle,u:user.id}});
}
/** Sign-up or add-device, step 2. @param {P} p @param {'signup'|'add'} mode */
async function registerVerify(p,mode){
 only(p.body,['credential','name']);
 let v;
 try{v=await verifyRegistration(p.body.credential,{origin:p.ctx.url.origin,rpId:p.ctx.url.hostname,checkChallenge:challengeCheck(p,'m-reg')});}catch(e){throw passkeyError(e);}
 const d=v.challenge,db=p.db;
 if(d.m!==mode||typeof d.h!=='string')throw new ApiError('PASSKEY_REJECTED','The passkey response was rejected.',{reason:'wrong ceremony'});
 const cred=(/** @type {string} */ uid,/** @type {string} */ name)=>db.prepare('INSERT INTO member_credentials (id,user_id,public_key,alg,sign_count,transports,name,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(v.credentialId,uid,v.publicKey,v.alg,v.signCount,JSON.stringify(v.transports),name,p.now);
 if(mode==='add'){
  const user=p.ctx.user;
  if(!user||user.id!==d.u)throw new ApiError('LOGIN_REQUIRED');
  if(await roleOf(db,user.id)==='admin')throw new ApiError('FORBIDDEN','Admin accounts use the admin app\'s passkeys.');
  await batchOnce(db,[...await usedStatements(p,v),
   db.prepare("INSERT OR IGNORE INTO user_identities (provider,provider_subject,user_id,created_at,last_login_at) VALUES ('passkey',?,?,?,NULL)").bind(d.h,user.id,p.now),
   cred(String(user.id),deviceName(p.body.name,'ko'))]);
  clearNonce(p);
  return {ok:true,...await signInMethods(db,user,p.now)};
 }
 if(p.ctx.user)throw new ApiError('OPERATION_CONFLICT','You are already signed in. Add this device to your account instead.',{reason:'signed_in'});
 const name=nickname(d.d);
 if(await nicknameTaken(db,name))throw new ApiError('OPERATION_CONFLICT','This nickname is taken.',{field:'displayName'});
 await assertSignupQuota(p);
 const uid=randomToken(16),session=await sessionStatements(p.ctx,p.cfg,db,p.now,uid);
 // users first (the rest reference it); the unique nickname index settles a race between two sign-ups.
 await batchOnce(db,[...await usedStatements(p,v),
  db.prepare("INSERT INTO users (id,email,display_name,provider,provider_subject,created_at) VALUES (?,NULL,NULL,'passkey',?,?)").bind(uid,d.h,p.now),
  db.prepare("INSERT INTO user_identities (provider,provider_subject,user_id,created_at,last_login_at) VALUES ('passkey',?,?,?,?)").bind(d.h,uid,p.now,p.now),
  db.prepare("INSERT INTO user_profiles (user_id,display_name,role,tier,locale,created_at,updated_at) VALUES (?,?,'user','new',?,?,?)").bind(uid,name,String(d.l||'ko'),p.now,p.now),
  cred(uid,deviceName(p.body.name,String(d.l||'ko'))),
  db.prepare('INSERT INTO daily_usage(subject_id,day,used) VALUES(?1,?2,1) ON CONFLICT(subject_id,day) DO UPDATE SET used=used+1').bind(signupSubject(p),quotaDay(p.now)),
  ...session.statements]);
 p.ctx.setCookies.push(session.cookie);clearNonce(p);
 return {ok:true,displayName:name};
}
/** @param {P} p */
async function loginOptions(p){
 only(p.body,[]);
 const n=await newNonce(p);
 // Discoverable credentials: no allowCredentials, so the page never learns which ids exist.
 return {challenge:await makeChallenge(p.cfg.secret,{p:'m-auth',n},p.now),rpId:p.ctx.url.hostname,timeout:120000,userVerification:'preferred',allowCredentials:[]};
}
/** @param {P} p */
async function loginVerify(p){
 only(p.body,['credential']);
 /** @type {any} */let row=null;
 let v;
 try{
  v=await verifyAuthentication(p.body.credential,{origin:p.ctx.url.origin,rpId:p.ctx.url.hostname,checkChallenge:challengeCheck(p,'m-auth'),
   getCredential:async id=>{
    row=await p.db.prepare("SELECT c.id,c.user_id,c.public_key,c.sign_count,COALESCE(pr.role,'user') AS role,i.provider_subject AS handle FROM member_credentials c LEFT JOIN user_profiles pr ON pr.user_id=c.user_id LEFT JOIN user_identities i ON i.user_id=c.user_id AND i.provider='passkey' WHERE c.id=?").bind(id).first();
    // Never an admin session from a member passkey (the admin app has its own credentials).
    return row&&row.role!=='admin'?{publicKey:String(row.public_key),signCount:Number(row.sign_count)}:null;
   }});
 }catch(e){throw passkeyError(e);}
 // The authenticator names the account it created the credential for: it must be this one.
 if(v.userHandle&&row.handle&&v.userHandle!==row.handle)throw new ApiError('PASSKEY_REJECTED','The passkey response was rejected.',{reason:'user handle mismatch'});
 const session=await sessionStatements(p.ctx,p.cfg,p.db,p.now,String(row.user_id));
 await batchOnce(p.db,[...await usedStatements(p,v),
  p.db.prepare('UPDATE member_credentials SET sign_count=?,last_used_at=? WHERE id=?').bind(v.signCount,p.now,v.credentialId),
  p.db.prepare("UPDATE user_identities SET last_login_at=? WHERE user_id=? AND provider='passkey'").bind(p.now,String(row.user_id)),
  ...session.statements]);
 p.ctx.setCookies.push(session.cookie);clearNonce(p);
 const prof=await p.db.prepare('SELECT display_name FROM user_profiles WHERE user_id=?').bind(String(row.user_id)).first();
 return {ok:true,displayName:prof?.display_name?String(prof.display_name):null};
}
/** Remove one of my passkeys (a lost phone) while another way in remains. @param {P} p */
async function remove(p){
 only(p.body,['id']);
 const user=p.ctx.user;if(!user)throw new ApiError('LOGIN_REQUIRED');
 const id=String(p.body.id||'');
 const mine=await p.db.prepare('SELECT id FROM member_credentials WHERE id=? AND user_id=?').bind(id,user.id).first();
 if(!mine)throw new ApiError('NOT_FOUND','No such passkey.');
 const methods=await signInMethods(p.db,user,p.now);
 if(!methods.canUnlink)throw new ApiError('OPERATION_CONFLICT','This is the only way to sign in to this account.',{reason:'last_method'});
 const statements=[p.db.prepare('DELETE FROM member_credentials WHERE id=? AND user_id=?').bind(id,user.id)];
 // The last member passkey gone: the passkey identity goes too (another method remains, checked above).
 if(methods.devices.length===1)statements.push(p.db.prepare("DELETE FROM user_identities WHERE user_id=? AND provider='passkey'").bind(user.id));
 await p.db.batch(statements);
 return {ok:true,...await signInMethods(p.db,user,p.now)};
}

export const PASSKEY_ROUTES=Object.freeze({'POST /auth/passkey/register/options':1,'POST /auth/passkey/register/verify':1,'POST /auth/passkey/login/options':1,'POST /auth/passkey/login/verify':1,'POST /auth/passkey/add/options':1,'POST /auth/passkey/add/verify':1,'POST /auth/passkey/remove':1});
/** @param {string} key @param {P} p */
export function handlePasskey(key,p){
 switch(key){
  case 'POST /auth/passkey/register/options':return registerOptions(p);
  case 'POST /auth/passkey/register/verify':return registerVerify(p,'signup');
  case 'POST /auth/passkey/add/options':return addOptions(p);
  case 'POST /auth/passkey/add/verify':return registerVerify(p,'add');
  case 'POST /auth/passkey/login/options':return loginOptions(p);
  case 'POST /auth/passkey/login/verify':return loginVerify(p);
  case 'POST /auth/passkey/remove':return remove(p);
 }
 throw new ApiError('NOT_FOUND');
}
