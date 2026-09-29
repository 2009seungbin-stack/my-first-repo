// @ts-check
/** Anonymous (유동) writing: the daily ID, the network key, edit passwords, the bot check, per-network
 * limits, bans, the blocklist and retention. server/platform/api.js calls these for signed-out writes.
 *
 * Decisions (docs/CLOUDFLARE.md "익명 글쓰기와 이미지"):
 *  - network prefix = the IPv4 /24 or the IPv6 /48 of cf-connecting-ip (an IPv4-mapped IPv6 address counts
 *    as IPv4). A home, office or mobile carrier gateway keeps one ID for the day even when the address
 *    inside the prefix changes; the price is that people behind the same carrier prefix can share an ID.
 *  - day = the Korean calendar day (KST, UTC+9): IDs change at 00:00 KST, when Korean readers expect it.
 *  - daily key = HMAC-SHA256(secret, "anon-day/v1" + day + prefix); the public ID is 4 base-62 characters
 *    of it. network key = HMAC-SHA256(secret, "anon-net/v1" + prefix), day-independent, for bans and
 *    limits; stored on content for at most 90 days. Neither can be turned back into an address without
 *    the secret (ANON_ID_SECRET, else SESSION_SECRET). The raw address is never stored.
 *  - edit password: PBKDF2-SHA256, 100,000 iterations (the Workers runtime maximum; ~16 ms), 16-byte
 *    random salt per item, over an HMAC of the password with the secret as a pepper, so a leaked database
 *    alone does not allow guessing short passwords offline.
 *  - bot check: Turnstile. A successful check sets a 10-minute pass (signed cookie bound to this browser's
 *    anonymous id and daily key); comments, votes, reports, uploads and edits may use the pass, a new post
 *    always needs a fresh token. Without TURNSTILE_SECRET_KEY a preview/development deployment allows
 *    anonymous writing with the stricter limits below and a notice; production refuses it
 *    (503 NOT_CONFIGURED) until the secret is set. */
import {hmac,hmacHex,hex,base64url,fromBase64url,safeEqual,sign,unsign,sha256} from '../crypto.js';
import {ApiError,cookie} from '../http.js';
import {verifyTurnstile} from '../turnstile.js';
import {ipv6Groups} from '../api.js';

export const ANON_USER='anon';
export const ANON_PASS_COOKIE='nerulio_anonpass';
const enc=new TextEncoder();
const DAY_MS=864e5,KST=9*36e5;

export const ANON=Object.freeze({
 defaultName:'ㅇㅇ',
 name:/** @type {[number,number]} */([1,12]),
 password:/** @type {[number,number]} */([4,32]),
 pbkdf2Iterations:100000,
 passTtlMs:10*60e3,
 retentionDays:90,
 /** Per network. strict = no bot check configured (preview/development only). */
 limits:{
  normal:{postsPerMinute:2,postsPerDay:20,commentsPerMinute:6,commentsPerDay:150,imagesPerDay:40,reportsPerDay:30,votesPerMinute:30,votesPerDay:300,passwordFailuresPerHour:20},
  strict:{postsPerMinute:1,postsPerDay:5,commentsPerMinute:3,commentsPerDay:30,imagesPerDay:10,reportsPerDay:10,votesPerMinute:10,votesPerDay:50,passwordFailuresPerHour:10},
 },
 /** Wrong passwords per item before it locks for the rest of the hour. */
 passwordFailuresPerItem:8,
 links:{post:2,comment:1},
 /** Images in one post; members' uploads per account per day. */
 imagesPerPost:10,memberImagesPerDay:60,
 /** Identical text: refused from the same network for 24 h, from anyone for 10 minutes. */
 duplicateSameNetworkMs:DAY_MS,duplicateAnyMs:10*60e3,
});
/** Reports (신고): categories, which ones hide at once, and how many distinct reporters hide the rest. */
export const REPORT=Object.freeze({
 threshold:3,
 severe:Object.freeze(['csam','illegal_filming','privacy']),
 /** content_flags.reason (0004 CHECK) for each category; the category itself goes in content_flags.category. */
 reasonOf:Object.freeze(/** @type {Record<string,string>} */({spam:'spam',abuse:'abuse',wrong_info:'wrong_info',source_dispute:'source_dispute',copyright:'copyright',duplicate:'duplicate',other:'other',csam:'abuse',illegal_filming:'abuse',privacy:'other',sexual:'abuse',violence:'abuse'})),
});

/** Korean calendar day (KST) of a time. @param {number} now */
export const kstDay=now=>new Date(now+KST).toISOString().slice(0,10);

/** The prefix that names a client's network: "v4:a.b.c" (/24) or "v6:g0:g1:g2" (/48); "none" without an
 * address (local development only — Cloudflare always sends cf-connecting-ip). @param {string} ip */
export function networkPrefix(ip){
 const s=String(ip||'').trim();
 if(!s)return 'none';
 if(s.includes(':')){
  const g=ipv6Groups(s);if(!g)return 'bad';
  // ::ffff:a.b.c.d is an IPv4 client.
  if(g.slice(0,5).every(x=>x==='0')&&g[5]==='ffff'){const hi=parseInt(g[6],16),lo=parseInt(g[7],16);return `v4:${hi>>8}.${hi&255}.${lo>>8}`;}
  return `v6:${g.slice(0,3).join(':')}`;
 }
 const p=s.split('.');
 if(p.length!==4||!p.every(x=>/^\d{1,3}$/.test(x)&&Number(x)<=255))return 'bad';
 return `v4:${p.slice(0,3).map(Number).join('.')}`;
}
const B62='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** 4 base-62 characters from the first 32 bits of a daily key. @param {Uint8Array} mac */
export function dailyIdOf(mac){
 let n=((mac[0]<<24)>>>0)+(mac[1]<<16)+(mac[2]<<8)+mac[3];n%=62**4;
 let s='';for(let i=0;i<4;i++){s=B62[n%62]+s;n=Math.floor(n/62);}return s;
}
/** The secret behind IDs, network keys and password peppers. @param {any} env @param {{secret:string}} cfg */
export const anonSecret=(env,cfg)=>String(env?.ANON_ID_SECRET||'').length>=32?String(env.ANON_ID_SECRET):cfg.secret;

/** @typedef {{day:string,key:string,id:string,net:string}} AnonIdentity */
/** @param {string} ip @param {string} secret @param {number} now @returns {Promise<AnonIdentity>} */
export async function anonIdentity(ip,secret,now){
 const prefix=networkPrefix(ip),day=kstDay(now);
 const mac=await hmac(secret,`anon-day/v1\n${day}\n${prefix}`);
 return {day,key:hex(mac).slice(0,32),id:dailyIdOf(mac),net:(await hmacHex(secret,`anon-net/v1\n${prefix}`)).slice(0,32)};
}

/* ---------- edit passwords ---------- */

/** @param {string} password @param {string} secret @param {Uint8Array} salt @param {number} iterations */
async function derive(password,secret,salt,iterations){
 const pepper=await hmac(secret,`anon-pw/v1\n${password}`);
 const key=await crypto.subtle.importKey('raw',/** @type {BufferSource} */(/** @type {unknown} */(pepper)),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:/** @type {BufferSource} */(/** @type {unknown} */(salt)),iterations},key,256));
}
/** "pbkdf2-sha256$100000$<salt>$<hash>" (base64url). @param {string} password @param {string} secret @param {number} [iterations] */
export async function hashPassword(password,secret,iterations=ANON.pbkdf2Iterations){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 return `pbkdf2-sha256$${iterations}$${base64url(salt)}$${base64url(await derive(password,secret,salt,iterations))}`;
}
/** @param {string} password @param {string|null|undefined} stored @param {string} secret */
export async function verifyPassword(password,stored,secret){
 const m=/^pbkdf2-sha256\$(\d{1,7})\$([A-Za-z0-9_-]{16,64})\$([A-Za-z0-9_-]{40,90})$/.exec(String(stored||''));
 if(!m||typeof password!=='string')return false;
 const it=Number(m[1]);if(it<1000||it>100000)return false;
 return safeEqual(base64url(await derive(password,secret,fromBase64url(m[2]),it)),m[3]);
}

/* ---------- bot check ---------- */

/** How anonymous writing works on this deployment. @param {{environment:string,turnstile:{siteKey:string,secret:string}}} cfg
 * @returns {{enabled:boolean,mode:'turnstile'|'strict'|'off',siteKey:string}} */
export function anonMode(cfg){
 if(cfg.turnstile.secret&&cfg.turnstile.siteKey)return {enabled:true,mode:'turnstile',siteKey:cfg.turnstile.siteKey};
 if(cfg.environment==='production')return {enabled:false,mode:'off',siteKey:''};
 return {enabled:true,mode:'strict',siteKey:''};
}
/** Refuse anonymous writing where it is switched off. The error carries the admin app's NOT_CONFIGURED shape. */
/** @param {ReturnType<typeof anonMode>} mode @param {{turnstile:{siteKey:string,secret:string}}} cfg */
export function assertAnonEnabled(mode,cfg){
 if(mode.enabled)return;
 const missing=[...(cfg.turnstile.secret?[]:['TURNSTILE_SECRET_KEY']),...(cfg.turnstile.siteKey?[]:['TURNSTILE_SITE_KEY'])];
 throw new ApiError('NOT_CONFIGURED','Anonymous writing needs Turnstile on this deployment.',{need:missing[0]},{need:missing[0],missing});
}
/**
 * The Turnstile gate of one anonymous write. `fresh` = a new token is required (new posts); otherwise a
 * pass from a check in the last 10 minutes (same browser, same daily key) is enough.
 * @param {{cfg:any,context:any,ident:AnonIdentity,token:unknown,fresh:boolean,ip:string,now:number,fetch?:any,mode:ReturnType<typeof anonMode>}} o
 */
export async function humanGate(o){
 if(o.mode.mode!=='turnstile')return;
 const passId=`${o.context.anonId}~${o.ident.key}`;
 if(!o.fresh){
  const v=await unsign(o.cfg.secret,'anonpass/v1',o.context.cookies[ANON_PASS_COOKIE]);
  if(v){const i=v.lastIndexOf('~');if(v.slice(0,i)===passId&&Number(v.slice(i+1))>o.now)return;}
 }
 if(typeof o.token!=='string'||!o.token)throw new ApiError('CHALLENGE_REQUIRED','Please confirm you are human.',{siteKey:o.mode.siteKey});
 const ok=await verifyTurnstile({token:o.token,secret:o.cfg.turnstile.secret,ip:o.ip,expectedAction:'community',hostname:o.context.url.hostname,allowTestingKey:o.cfg.environment!=='production'},o.fetch||fetch);
 if(!ok)throw new ApiError('CHALLENGE_FAILED','The human check failed. Please try again.',{siteKey:o.mode.siteKey});
 o.context.setCookies.push(cookie(ANON_PASS_COOKIE,await sign(o.cfg.secret,'anonpass/v1',`${passId}~${o.now+ANON.passTtlMs}`),{maxAge:ANON.passTtlMs/1000,secure:o.context.secure}));
}

/* ---------- limits, bans ---------- */

/** Count one event against a daily limit; false when the limit is reached (nothing is counted then).
 * @param {any} db @param {string} key @param {string} day @param {number} limit */
export async function takeDaily(db,key,day,limit){
 if(limit<=0)return false;
 const r=await db.prepare('INSERT INTO anon_counters (key,day,n) VALUES (?1,?2,1) ON CONFLICT(key,day) DO UPDATE SET n=n+1 WHERE n<?3 RETURNING n').bind(key,day,limit).first();
 return !!r;
}
/** @param {any} db @param {string} key @param {string} day */
export async function readDaily(db,key,day){return Number((await db.prepare('SELECT n FROM anon_counters WHERE key=? AND day=?').bind(key,day).first())?.n||0);}
/** Hour bucket used for password failures. @param {number} now */
export const hourKey=now=>new Date(now).toISOString().slice(0,13);
/** @param {any} db @param {string} net @param {number} now */
export async function assertNotBanned(db,net,now){
 const b=await db.prepare('SELECT until FROM anon_bans WHERE net=? AND until>?').bind(net,now).first();
 if(b)throw new ApiError('FORBIDDEN','Anonymous writing from this network is blocked for now.',{until:new Date(Number(b.until)).toISOString(),reason:'banned'});
}

/* ---------- text checks ---------- */

/** Links in a text: http(s) URLs and www. hosts. @param {string} text */
export const countLinks=text=>(String(text).match(/https?:\/\/|(^|[\s(])www\.[a-z0-9-]/gi)||[]).length;
/** Host names linked from a text (lower case, no www.). @param {string} text */
export function linkedHosts(text){
 const out=new Set();
 for(const m of String(text).matchAll(/(?:https?:\/\/|(?:^|[\s(])www\.)([a-z0-9.-]{1,253})/gi))out.add(m[1].toLowerCase().replace(/^www\./,'').replace(/\.$/,''));
 return [...out];
}
/** Text as compared for floods and keywords: NFKC, lower case, no spaces or zero-width characters. @param {string} s */
export const normalizeText=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s​-‍⁠﻿]+/g,'');
/** @param {string} s */
export const textHash=async s=>(await sha256('anon-text/v1\n'+normalizeText(s))).slice(0,32);

/** @type {{at:number,rows:{kind:string,pattern:string,action:string}[]}|null} */let blockCache=null;
export const resetBlocklistCache=()=>{blockCache=null;};
/** 'reject' | 'hide' | null for a text (keywords, and domains of its links). Cached per isolate for a minute.
 * @param {any} db @param {string} text @param {number} now */
export async function blocklistVerdict(db,text,now){
 if(!blockCache||now-blockCache.at>60e3){
  let rows=[];try{rows=(await db.prepare('SELECT kind,pattern,action FROM blocklist LIMIT 2000').all()).results||[];}catch{rows=[];}
  blockCache={at:now,rows:rows.map((/** @type {any} */ r)=>({kind:String(r.kind),pattern:String(r.pattern),action:String(r.action)}))};
 }
 if(!blockCache.rows.length)return null;
 const norm=normalizeText(text),hosts=linkedHosts(text);let verdict=null;
 for(const r of blockCache.rows){
  const p=r.kind==='keyword'?normalizeText(r.pattern):r.pattern.toLowerCase().replace(/^www\./,'');
  if(!p)continue;
  const hit=r.kind==='keyword'?norm.includes(p):hosts.some(h=>h===p||h.endsWith('.'+p));
  if(hit){if(r.action==='reject')return 'reject';verdict='hide';}
 }
 return verdict;
}

/* ---------- retention ---------- */

/** Everything anonymous writing keeps about a network ends after 90 days: the network key on posts,
 * comments and uploads, voter and reporter keys, old counters and expired bans.
 * @param {any} db @param {number} now */
export function anonCleanupStatements(db,now){
 const cut=now-ANON.retentionDays*DAY_MS,oldDay=kstDay(now-3*DAY_MS);
 return [
  db.prepare('UPDATE discussions SET anon_net=NULL WHERE anon_net IS NOT NULL AND created_at<?').bind(cut),
  db.prepare('UPDATE comments SET anon_net=NULL WHERE anon_net IS NOT NULL AND created_at<?').bind(cut),
  db.prepare('UPDATE uploads SET anon_net=NULL WHERE anon_net IS NOT NULL AND created_at<?').bind(cut),
  db.prepare("UPDATE anon_votes SET voter='x'||lower(hex(randomblob(12))) WHERE created_at<? AND voter NOT LIKE 'x%'").bind(cut),
  db.prepare('UPDATE content_flags SET reporter_key=NULL WHERE reporter_key IS NOT NULL AND created_at<?').bind(cut),
  db.prepare('DELETE FROM anon_counters WHERE day<?').bind(oldDay),
  db.prepare('DELETE FROM anon_bans WHERE until<?').bind(now),
 ];
}
