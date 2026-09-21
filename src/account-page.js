import {entitlement,load,logout,apiPath,current} from './entitlement.js';
import {text,duration} from './service-content.js';
import {track} from './analytics.js';
/** /account/ — plan, today's usage and subscription controls. No file history exists to show. */
const locale=document.documentElement.lang,t=(k,v)=>text(locale,k,v);
const body=document.getElementById('accountBody'),status=document.getElementById('accountStatus');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
function say(key,error=false){status.textContent=key?t(key):'';status.classList.toggle('error',error);}
const dateText=iso=>new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(iso));
function render(){
 const {status:state,me}=current();
 body.setAttribute('aria-busy','false');
 if(state==='unconfigured'||state==='disabled'){body.innerHTML=`<p>${esc(t('serviceOff'))}</p>`;return;}
 if(state==='offline'||!me){body.innerHTML=`<p>${esc(t('serviceDown'))}</p>`;say('serviceDown',true);return;}
 const signIn=apiPath(`auth/google/start?return=${encodeURIComponent(`/${locale}/account/`)}`);
 if(!me.loggedIn){
  body.innerHTML=`<p class="service-lead">${esc(t('signedOutLead'))}</p><dl><dt>${esc(t('plan'))}</dt><dd>${esc(t('free'))}</dd><dt>${esc(t('heavyJobs'))}</dt><dd data-usage>${me.usage.used} / ${me.usage.limit}</dd><dt>${esc(t('reset'))}</dt><dd data-reset>${esc(duration(locale,Date.parse(me.usage.resetAt)-Date.now()))}</dd></dl>
<div class="service-actions"><a class="primary" data-signin href="${esc(signIn)}">${esc(t('signIn'))}</a><a class="secondary" href="${locale}/pricing/">${esc(t('pricing'))}</a></div>`;
 }else{
  const pro=me.plan==='pro',sub=me.subscription;
  const rows=[[t('name'),me.user.name||'—'],[t('email'),me.user.email||'—'],[t('plan'),pro?t('pro'):t('free')],
   [t('heavyJobs'),pro?t('unlimited'):`${me.usage.used} / ${me.usage.limit}`,'data-usage'],...(!pro?[[t('reset'),duration(locale,Date.parse(me.usage.resetAt)-Date.now()),'data-reset']]:[]),[t('ads'),me.ads?t('on'):t('off'),'data-ads'],
   ...(pro&&sub?.currentPeriodEnd?[['',t(sub.cancelAtPeriodEnd?'endsOn':'renewsOn',{date:dateText(sub.currentPeriodEnd)})]]:[])];
  body.innerHTML=`<dl>${rows.map(([k,v,a])=>`<dt>${esc(k)}</dt><dd ${a||''}>${esc(v)}</dd>`).join('')}</dl>
<div class="service-actions">${pro?(me.billing.mode!=='off'&&sub?.provider!=='manual'?`<button type="button" class="secondary" data-manage>${esc(t('manage'))}</button>`:''):`<a class="primary" href="${locale}/pricing/">${esc(t('upgrade'))}</a>`}<button type="button" class="secondary" data-signout>${esc(t('signOut'))}</button></div>`;
 }
}
body.addEventListener('click',async event=>{
 const target=event.target.closest('[data-signout],[data-manage],[data-signin]');if(!target)return;
 if(target.matches('[data-signin]')){track('login_started');return;}
 event.preventDefault();target.disabled=true;
 try{
  if(target.matches('[data-signout]')){await logout();render();return;}
  const r=await fetch(apiPath('billing/portal'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
  const data=await r.json().catch(()=>null);
  if(r.ok&&data?.url)location.assign(data.url);else say('serviceDown',true);
 }catch{say('serviceDown',true);}finally{target.disabled=false;}
});
/** After checkout the webhook, not the redirect, activates Pro. Re-check a few times with
 * backoff (≤ 5 requests), never a tight loop. */
async function awaitActivation(){
 say('activating');
 for(const wait of [2e3,4e3,8e3,16e3,30e3]){
  await new Promise(r=>setTimeout(r,wait));
  const me=await load({force:true});render();
  if(me?.plan==='pro'){say('proActive');track('checkout_completed',{plan:'pro'});return;}
 }
 say('activationSlow');
}
if(!entitlement.enabled){render();}
else{
 await load();render();
 if(params.get('login')==='ok')track('login_completed');
 if(params.get('login')==='failed')say('loginFailed',true);
 if(params.get('checkout')==='sandbox')say('sandbox');
 if(params.get('checkout')==='success'&&current().me?.plan!=='pro')awaitActivation();
 if(params.has('login')||params.has('checkout')||params.has('portal')){const clean=new URL(location.href);for(const k of ['login','reason','checkout','reference','portal'])clean.searchParams.delete(k);history.replaceState(null,'',clean);}
 // Countdown is local arithmetic; it never polls the server.
 setInterval(()=>{const me=current().me,el=body.querySelector('[data-reset]');if(me?.usage?.resetAt&&el)el.textContent=duration(locale,Date.parse(me.usage.resetAt)-Date.now());},60e3);
}
