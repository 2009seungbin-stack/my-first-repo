import {randomToken} from './crypto.js';
/** Server-side Turnstile Siteverify. The secret never leaves the Worker; a token is
 * accepted only if Cloudflare confirms it (single-use, bound to our hostname). */
export const SITEVERIFY='https://challenges.cloudflare.com/turnstile/v0/siteverify';
export async function verifyTurnstile({token,secret,ip,expectedAction,hostname},fetcher=fetch){
 if(!secret||typeof token!=='string'||!token||token.length>2048)return false;
 const form=new FormData();
 form.append('secret',secret);form.append('response',token);form.append('idempotency_key',crypto.randomUUID?.()||randomToken(16));
 if(ip)form.append('remoteip',ip);
 try{
  const response=await fetcher(SITEVERIFY,{method:'POST',body:form});
  if(!response.ok)return false;
  const result=await response.json();
  if(result.success!==true)return false;
  if(expectedAction&&result.action!==expectedAction)return false;
  if(hostname&&result.hostname&&result.hostname!==hostname)return false;
  return true;
 }catch{return false;}
}
