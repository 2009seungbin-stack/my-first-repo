import {entitlement,load,apiPath,current} from './entitlement.js';
import {text} from './service-content.js';
import {track} from './analytics.js';
/** /pricing/ — static plan comparison; the Pro action depends on /me. Checkout goes to the
 * provider; Pro starts only after the provider's signed webhook reaches the Worker. */
const locale=document.documentElement.lang,t=(k,v)=>text(locale,k,v);
const action=document.getElementById('proAction');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const note=key=>`<p class="plan-note">${esc(t(key))}</p>`;
function render(){
 const {status,me}=current();
 if(status!=='ready'||!me){action.innerHTML=note(status==='offline'?'serviceDown':'purchasesClosed');return;}
 if(me.plan==='pro'){action.innerHTML=`${note('youArePro')}<a class="secondary" href="${locale}/account/">${esc(t('account'))}</a>`;return;}
 if(me.billing.mode==='off'){action.innerHTML=note('purchasesClosed');return;}
 if(!me.loggedIn){action.innerHTML=`<a class="primary" data-signin href="${esc(apiPath(`auth/google/start?return=${encodeURIComponent(`/${locale}/pricing/`)}`))}">${esc(t('signInToUpgrade'))}</a>`;return;}
 action.innerHTML=`<button type="button" class="primary" data-checkout>${esc(t('upgrade'))}</button><p class="plan-note" data-checkout-status role="status"></p>`;
}
action.addEventListener('click',async event=>{
 if(event.target.closest('[data-signin]')){track('login_started');return;}
 const button=event.target.closest('[data-checkout]');if(!button)return;
 button.disabled=true;const out=action.querySelector('[data-checkout-status]');
 try{
  const post=body=>fetch(apiPath('billing/checkout'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let r=await post({locale}),data=await r.json().catch(()=>null);
  if(data?.error?.code==='CHALLENGE_REQUIRED'){
   const token=await (await import('./human-check.js')).challenge(data.error.siteKey,'checkout',locale);
   if(!token){button.disabled=false;return;}
   r=await post({locale,turnstileToken:token});data=await r.json().catch(()=>null);
  }
  if(r.ok&&data?.url){track('checkout_started',{plan:'free'});location.assign(data.url);return;}
  out.textContent=t(data?.error?.code==='CHALLENGE_FAILED'?'challengeFailed':data?.error?.code==='ALREADY_PRO'?'youArePro':'serviceDown');
 }catch{out.textContent=t('serviceDown');}
 button.disabled=false;
});
if(entitlement.enabled){await load();render();}else render();
