// @ts-check
/** Google OpenID Connect: authorization code + PKCE (S256) + nonce; scope `openid email profile`.
 * Dormant until GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are both set. */
import {fromBase64url,safeEqual} from '../crypto.js';
import {call,failure,textOrNull,emailOrNull} from './util.js';

export const GOOGLE=Object.freeze({auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',issuers:Object.freeze(['https://accounts.google.com','accounts.google.com'])});

/** @param {unknown} token */
function decodeJWTPayload(token){
 const parts=String(token||'').split('.');if(parts.length!==3)throw new Error('malformed');
 return JSON.parse(new TextDecoder().decode(fromBase64url(parts[1])));
}
/** The ID token arrives directly from Google's token endpoint over TLS in exchange for a
 * PKCE-bound code, so per OIDC Core §3.1.3.7 TLS authenticates the issuer; every claim
 * (iss, aud, exp, nonce, sub) is still validated. Returns '' or the failed check.
 * @param {any} claims @param {{clientId:string,nonce:string,now:number}} o */
export function validateClaims(claims,{clientId,nonce,now}){
 if(!GOOGLE.issuers.includes(claims.iss))return 'issuer';
 if(claims.aud!==clientId&&!(Array.isArray(claims.aud)&&claims.aud.includes(clientId)))return 'audience';
 if(!(Number(claims.exp)*1000>now))return 'expired';
 if(!claims.nonce||!safeEqual(claims.nonce,nonce))return 'nonce';
 if(typeof claims.sub!=='string'||!/^[0-9A-Za-z_-]{1,255}$/.test(claims.sub))return 'subject';
 return '';
}

/** @type {import('./util.js').Provider} */
export const google={
 id:'google',name:'Google',
 authorizeURL:({clientId,redirectURI,state,challenge,nonce},upstream)=>`${upstream(GOOGLE.auth)}?${new URLSearchParams({client_id:clientId,redirect_uri:redirectURI,response_type:'code',
  scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'})}`,
 async profile({code,verifier,nonce,redirectURI,credentials,now,fetch,upstream}){
  const token=await call(fetch,upstream(GOOGLE.token),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
   body:new URLSearchParams({code,client_id:credentials.clientId,client_secret:credentials.clientSecret,redirect_uri:redirectURI,grant_type:'authorization_code',code_verifier:verifier})});
  if(token.status!==200||!token.data)return {ok:false,reason:failure(token.status)};
  let claims;try{claims=decodeJWTPayload(token.data.id_token);}catch{return {ok:false,reason:'token'};}
  const invalid=validateClaims(claims,{clientId:credentials.clientId,nonce,now});
  if(invalid)return {ok:false,reason:invalid};
  const verified=claims.email_verified===true||claims.email_verified==='true';
  return {ok:true,profile:{subject:claims.sub,email:verified?emailOrNull(claims.email):null,name:textOrNull(claims.name,120),handle:null}};
 }
};
