// @ts-check
/** Discord OAuth2: authorization code + PKCE (S256), scopes `identify email`. The subject is the user
 * id (snowflake); the e-mail is kept only when Discord reports it `verified`. Discord allows several
 * redirect URIs per application, so one application can serve preview and production. The access
 * token is used for one read of /users/@me and then dropped (never stored). */
import {call,failure,textOrNull,emailOrNull} from './util.js';

export const DISCORD=Object.freeze({auth:'https://discord.com/oauth2/authorize',token:'https://discord.com/api/oauth2/token',user:'https://discord.com/api/v10/users/@me'});

/** @type {import('./util.js').Provider} */
export const discord={
 id:'discord',name:'Discord',
 authorizeURL:({clientId,redirectURI,state,challenge},upstream)=>`${upstream(DISCORD.auth)}?${new URLSearchParams({response_type:'code',client_id:clientId,
  scope:'identify email',state,redirect_uri:redirectURI,code_challenge:challenge,code_challenge_method:'S256'})}`,
 async profile({code,verifier,redirectURI,credentials,fetch,upstream}){
  // Discord's token endpoint accepts application/x-www-form-urlencoded only.
  const token=await call(fetch,upstream(DISCORD.token),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
   body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectURI,client_id:credentials.clientId,client_secret:credentials.clientSecret,code_verifier:verifier})});
  if(token.status!==200)return {ok:false,reason:failure(token.status)};
  const access=token.data?.access_token;
  if(typeof access!=='string'||!access)return {ok:false,reason:'exchange'};
  const user=await call(fetch,upstream(DISCORD.user),{headers:{Authorization:`Bearer ${access}`,Accept:'application/json'}});
  if(user.status!==200||!user.data)return {ok:false,reason:failure(user.status)};
  const u=user.data;
  if(typeof u.id!=='string'||!/^\d{1,25}$/.test(u.id))return {ok:false,reason:'subject'};
  const username=typeof u.username==='string'&&/^[a-z0-9_.]{2,32}$/i.test(u.username)?u.username:null;
  return {ok:true,profile:{subject:u.id,email:u.verified===true?emailOrNull(u.email):null,name:textOrNull(u.global_name,120)||username,handle:username}};
 }
};
