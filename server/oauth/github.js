// @ts-check
/** GitHub OAuth App: authorization code + PKCE (S256; GitHub accepts it since 2025, and `plain` is
 * refused), scopes `read:user user:email`. The subject is the numeric user id — never the login,
 * which the user can rename and someone else can then take. The e-mail comes from /user/emails and
 * only the primary address GitHub marks as verified is kept; there may be none.
 * The access token is used for the two reads below and then dropped (never stored). */
import {call,failure,textOrNull,emailOrNull} from './util.js';

export const GITHUB=Object.freeze({auth:'https://github.com/login/oauth/authorize',token:'https://github.com/login/oauth/access_token',
 user:'https://api.github.com/user',emails:'https://api.github.com/user/emails'});
/** REST headers: GitHub rejects API requests without a User-Agent. @param {string} token */
const api=token=>({Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Nerulio'});

/** @param {any} list @returns {string|null} */
export function primaryVerifiedEmail(list){
 if(!Array.isArray(list))return null;
 const hit=list.find(e=>e&&e.primary===true&&e.verified===true);
 return hit?emailOrNull(hit.email):null;
}

/** @type {import('./util.js').Provider} */
export const github={
 id:'github',name:'GitHub',
 authorizeURL:({clientId,redirectURI,state,challenge},upstream)=>`${upstream(GITHUB.auth)}?${new URLSearchParams({client_id:clientId,redirect_uri:redirectURI,
  scope:'read:user user:email',state,code_challenge:challenge,code_challenge_method:'S256',allow_signup:'true'})}`,
 async profile({code,verifier,redirectURI,credentials,fetch,upstream}){
  // GitHub answers token errors with 200 and {"error":…}; only an access_token counts.
  const token=await call(fetch,upstream(GITHUB.token),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json','User-Agent':'Nerulio'},
   body:new URLSearchParams({client_id:credentials.clientId,client_secret:credentials.clientSecret,code,redirect_uri:redirectURI,code_verifier:verifier})});
  if(token.status!==200)return {ok:false,reason:failure(token.status)};
  const access=token.data?.access_token;
  if(typeof access!=='string'||!access)return {ok:false,reason:'exchange'};
  const user=await call(fetch,upstream(GITHUB.user),{headers:api(access)});
  if(user.status!==200||!user.data)return {ok:false,reason:failure(user.status)};
  const id=user.data.id;
  if(!Number.isSafeInteger(id)||id<=0)return {ok:false,reason:'subject'};
  // A failed e-mail read is not a failed sign-in: the account simply has no e-mail on file.
  const emails=await call(fetch,upstream(GITHUB.emails),{headers:api(access)});
  const login=typeof user.data.login==='string'&&/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(user.data.login)?user.data.login:null;
  return {ok:true,profile:{subject:String(id),email:emails.status===200?primaryVerifiedEmail(emails.data):null,name:textOrNull(user.data.name,120)||login,handle:login}};
 }
};
