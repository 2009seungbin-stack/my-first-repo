import {base64url,fromBase64url,randomToken,sha256,sha256Bytes,sign,unsign,safeEqual} from './crypto.js';
import {ApiError,cookie,clearCookie,redirect} from './http.js';
import {OAUTH_COOKIE,SESSION_COOKIE} from './identity.js';
import {OAUTH_TTL_MS,SESSION_TTL_MS} from './config.js';
import {carryOverStatement} from './usage.js';
/** Google OpenID Connect, authorization-code flow with state, PKCE (S256) and nonce.
 * Login is only needed for Pro purchase and account management — never for Free tools. */
export const GOOGLE={auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',issuers:['https://accounts.google.com','accounts.google.com']};
const CALLBACK='/api/v1/auth/google/callback';
/** Only same-site relative paths; never "//host", schemes or backslashes. */
export function safeReturnPath(value){
 const s=String(value||'');
 return /^\/(?![\/\\])[A-Za-z0-9\-._~\/?=&%]*$/.test(s)&&s.length<=256?s:'/account/';
}
export const redirectURI=(ctx,cfg)=>(cfg.siteOrigin||ctx.url.origin)+CALLBACK;
export async function startLogin(ctx,cfg,now){
 if(!cfg.google.clientId||!cfg.google.clientSecret)throw new ApiError('SERVICE_NOT_CONFIGURED','Google sign-in is not configured.');
 const state=randomToken(),verifier=randomToken(48),nonce=randomToken(),returnTo=safeReturnPath(ctx.url.searchParams.get('return'));
 const payload=base64url(new TextEncoder().encode(JSON.stringify({state,verifier,nonce,returnTo,exp:now+OAUTH_TTL_MS})));
 const params=new URLSearchParams({client_id:cfg.google.clientId,redirect_uri:redirectURI(ctx,cfg),response_type:'code',scope:'openid email profile',state,nonce,
  code_challenge:base64url(await sha256Bytes(verifier)),code_challenge_method:'S256',prompt:'select_account'});
 return redirect(`${GOOGLE.auth}?${params}`,[...ctx.setCookies,cookie(OAUTH_COOKIE,await sign(cfg.secret,'oauth/v1',payload),{maxAge:OAUTH_TTL_MS/1000,path:'/api/v1/auth/',secure:ctx.secure})]);
}
function decodeJWTPayload(token){
 const parts=String(token||'').split('.');if(parts.length!==3)throw new ApiError('UPSTREAM_FAILED','Malformed ID token.');
 return JSON.parse(new TextDecoder().decode(fromBase64url(parts[1])));
}
/** The ID token arrives directly from Google's token endpoint over TLS in exchange for a
 * PKCE-bound code, so per OIDC Core §3.1.3.7 TLS authenticates the issuer; every claim
 * (iss, aud, exp, nonce, sub) is still validated. */
export function validateClaims(claims,{clientId,nonce,now}){
 if(!GOOGLE.issuers.includes(claims.iss))return 'issuer';
 if(claims.aud!==clientId&&!(Array.isArray(claims.aud)&&claims.aud.includes(clientId)))return 'audience';
 if(!(Number(claims.exp)*1000>now))return 'expired';
 if(!claims.nonce||!safeEqual(claims.nonce,nonce))return 'nonce';
 if(typeof claims.sub!=='string'||!/^[0-9A-Za-z_-]{1,255}$/.test(claims.sub))return 'subject';
 return '';
}
export async function finishLogin(ctx,cfg,db,now,fetcher=fetch){
 const fail=reason=>redirect(`/account/?login=failed&reason=${encodeURIComponent(reason)}`,[clearCookie(OAUTH_COOKIE,{path:'/api/v1/auth/',secure:ctx.secure})]);
 const q=ctx.url.searchParams;
 if(q.get('error'))return fail('denied');
 const raw=await unsign(cfg.secret,'oauth/v1',ctx.cookies[OAUTH_COOKIE]);
 if(!raw)return fail('state');
 let saved;try{saved=JSON.parse(new TextDecoder().decode(fromBase64url(raw)));}catch{return fail('state');}
 if(!(saved.exp>now)||!q.get('state')||!safeEqual(q.get('state'),saved.state))return fail('state');
 const code=q.get('code');if(!code||code.length>2048)return fail('code');
 let tokens;
 try{
  const response=await fetcher(GOOGLE.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:cfg.google.clientId,client_secret:cfg.google.clientSecret,redirect_uri:redirectURI(ctx,cfg),grant_type:'authorization_code',code_verifier:saved.verifier})});
  if(!response.ok)return fail('exchange');
  tokens=await response.json();
 }catch{return fail('exchange');}
 let claims;try{claims=decodeJWTPayload(tokens.id_token);}catch{return fail('token');}
 const invalid=validateClaims(claims,{clientId:cfg.google.clientId,nonce:saved.nonce,now});
 if(invalid)return fail(invalid);
 const email=claims.email_verified===true||claims.email_verified==='true'?String(claims.email||'').slice(0,320):null;
 const name=String(claims.name||'').slice(0,120)||null;
 // Identity is (google, sub). E-mail is refreshed display data, never the lookup key.
 const user=await db.prepare(`INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,?2,?3,'google',?4,?5)
  ON CONFLICT(provider,provider_subject) DO UPDATE SET email=excluded.email,display_name=excluded.display_name RETURNING id`).bind(randomToken(16),email,name,claims.sub,now).first();
 const token=randomToken();
 const statements=[db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),user.id,now,now+SESSION_TTL_MS)];
 if(ctx.anonId)statements.push(carryOverStatement(db,`a:${ctx.anonId}`,`u:${user.id}`,now));
 await db.batch(statements);
 const target=new URL(safeReturnPath(saved.returnTo),ctx.url.origin);target.searchParams.set('login','ok');
 return redirect(target.pathname+target.search,[...ctx.setCookies,clearCookie(OAUTH_COOKIE,{path:'/api/v1/auth/',secure:ctx.secure}),cookie(SESSION_COOKIE,token,{maxAge:SESSION_TTL_MS/1000,secure:ctx.secure})]);
}
export async function logout(ctx,db){
 const raw=ctx.cookies[SESSION_COOKIE];
 if(raw&&/^[A-Za-z0-9_-]{43}$/.test(raw))await db.prepare('DELETE FROM sessions WHERE token_hash=?1').bind(await sha256(raw)).run();
 return clearCookie(SESSION_COOKIE,{secure:ctx.secure});
}
