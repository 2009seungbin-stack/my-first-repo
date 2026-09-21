/** /verify/ — hosts the Turnstile widget under its own CSP and hands the token to the
 * parent Nerulio page (same origin only). The token is useless until the Worker's
 * Siteverify call accepts it. */
const q=new URLSearchParams(location.search);
const siteKey=q.get('sitekey')||'',action=q.get('action')||'';
const post=data=>{if(window.parent!==window)window.parent.postMessage({type:'nerulio-turnstile',...data},location.origin);};
if(/^[0-9A-Za-z_-]{1,100}$/.test(siteKey)&&['quota','checkout'].includes(action)&&window.parent!==window){
 window.__nerulioTurnstile=()=>window.turnstile.render('#turnstile',{sitekey:siteKey,action,language:['ko','en','ja'].includes(q.get('lang'))?q.get('lang'):'auto',
  callback:token=>post({token}),'error-callback':()=>post({error:true}),'expired-callback':()=>post({error:true})});
 const script=document.createElement('script');
 script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__nerulioTurnstile';
 script.async=true;script.onerror=()=>post({error:true});
 document.head.append(script);
}else post({error:true});
