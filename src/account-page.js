import {entitlement,load,logout,apiPath,current} from './entitlement.js';
import {text,duration} from './service-content.js';
import {track} from './analytics.js';
import {buttonsHTML,buttonHTML,startURL,iconHTML,isBrand,BRAND_NAME,validReturn} from './signin-brands.js';
import {passkeySupported,passkeySignUp,passkeySignIn,passkeyAddDevice,passkeyRemove,passkeyText,passkeyMessage,turnstileToken,PASSKEY_ICON} from './passkey-client.js';
/** /account/ — the sign-in chooser (member passkey first — 지문으로 가입·로그인 — then the configured
 * providers), plan, today's usage, subscription controls and 연결된 로그인 (link / unlink providers, the
 * account's passkey devices). No file history exists to show.
 * ?return=/ko/… is where sign-in comes back to (channel pages send readers here). */
const locale=document.documentElement.lang,t=(k,v)=>text(locale,k,v);
const body=document.getElementById('accountBody'),status=document.getElementById('accountStatus');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const API=apiPath('');
const accountPath=`/${locale}/account/`;
const returnTo=validReturn(params.get('return'))?params.get('return'):accountPath+(params.get('from')?`?from=${encodeURIComponent(params.get('from'))}`:'');
/** A failed sign-in or link (server/oauth/flow.js reasons), shown once with a retry. */
const failure=params.get('login')==='failed'?{reason:params.get('reason')||'',provider:isBrand(params.get('provider'))?params.get('provider'):'',link:params.get('link')==='1'}:null;
const FAILURE_KEY={denied:'loginDenied',state:'loginExpired',code:'loginExpired',unavailable:'loginUnavailable',linked_elsewhere:'loginLinkedElsewhere',already_linked:'loginAlreadyLinked',link_session:'loginLinkSession'};
function say(key,error=false,vars){status.textContent=key?t(key,vars):'';status.classList.toggle('error',error);}
const dateText=iso=>new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(iso));
const providerName=id=>BRAND_NAME[id]||id;
const pt=(k,v)=>passkeyText(locale,k,v);
/** Passkey sign-up / sign-in first (server/member-passkey.js); '' when the service offers neither. */
function passkeyHTML(me){
 const pk=me.passkey;if(!pk?.signin)return '';
 if(!passkeySupported())return `<p class="service-hint" data-passkey-unsupported>${esc(pt('unsupported'))}</p>`;
 const signup=pk.signup?`<form class="pk-signup" data-passkey-signup novalidate><label for="pkNick">${esc(pt('nickname'))}</label><input id="pkNick" name="displayName" minlength="2" maxlength="20" autocomplete="nickname" required><small class="service-hint">${esc(pt('nickHint'))}</small><button type="submit" class="sib sib-passkey sib-passkey-new" data-provider="passkey-signup">${PASSKEY_ICON}<span>${esc(pt('signUp'))}</span></button></form>`:`<p class="service-hint" data-passkey-signup-off>${esc(pt('signupOff'))}</p>`;
 return `<section class="pk-box" data-passkey><h2>${esc(pt('title'))}</h2><div class="sibs"><button type="button" class="sib sib-passkey" data-passkey-signin>${PASSKEY_ICON}<span>${esc(pt('signIn'))}</span></button></div>${signup}<p class="service-hint pk-warn">${esc(pt('warn'))}</p></section>`;
}
/** After a passkey sign-in or sign-up: back where sign-in was asked for, like the OAuth callback does. */
function signedInGo(){const target=new URL(returnTo,location.origin);target.searchParams.set('login','ok');location.assign(target.pathname+target.search);}
function sayText(message,error){status.textContent=message;status.classList.toggle('error',!!error);}
function failureHTML(providers,loggedIn){
 if(!failure)return '';
 const p=failure.provider,key=FAILURE_KEY[failure.reason]||(p?'loginProviderFailed':'loginFailed');
 // Retry the same provider (and the same link) when it is still offered; a link retry needs a session.
 const retry=p&&providers.includes(p)&&(!failure.link||loggedIn)&&failure.reason!=='linked_elsewhere'&&failure.reason!=='already_linked'
  ?`<a data-retry href="${esc(startURL(p,failure.link?accountPath:returnTo,{link:failure.link,api:API}))}">${esc(t('retry'))}</a>`:'';
 return `<p class="service-error" role="alert" data-login-error="${esc(failure.reason)}">${esc(t(key,{p:providerName(p)||'—'}))}${retry}</p>`;
}
function render(){
 const {status:state,me}=current();
 body.setAttribute('aria-busy','false');
 if(state==='unconfigured'||state==='disabled'){body.innerHTML=`<p>${esc(t('serviceOff'))}</p>`;return;}
 if(state==='offline'||!me){body.innerHTML=`<p>${esc(t('serviceDown'))}</p>`;say('serviceDown',true);return;}
 const providers=Array.isArray(me.providers)?me.providers:[];
 if(!me.loggedIn){
  const su=me.studioUsage,anonNote=su?.signInLimit?`<small class="service-hint" data-studio-anon>${esc(t('studioAnon',{a:su.limit,s:su.signInLimit}))}</small>`:'';
  const pk=passkeyHTML(me);
  const buttons=providers.length?(pk?`<p class="pk-or">${esc(pt('or'))}</p>`:'')+buttonsHTML(providers,locale,returnTo,{api:API}):pk?'':`<p class="service-hint" data-signin-off>${esc(t('signInUnavailable'))}</p>`;
  body.innerHTML=`${failureHTML(providers,false)}<p class="service-lead">${esc(t('signedOutLead'))}</p>${pk}${buttons}<dl style="margin-top:22px"><dt>${esc(t('plan'))}</dt><dd>${esc(t('free'))}</dd><dt>${esc(t('heavyJobs'))}</dt><dd data-usage>${me.usage.used} / ${me.usage.limit}</dd>${su?`<dt>${esc(t('studioExports'))}</dt><dd><span data-studio-usage>${su.used} / ${su.limit}</span>${anonNote}</dd>`:''}<dt>${esc(t('reset'))}</dt><dd data-reset>${esc(duration(locale,Date.parse(me.usage.resetAt)-Date.now()))}</dd></dl>
<div class="service-actions"><a class="secondary" href="${locale}/pricing/">${esc(t('pricing'))}</a></div>`;
 }else{
  const pro=me.plan==='pro',sub=me.subscription;
  const rows=[[t('name'),me.user.name||'—'],[t('email'),me.user.email||'—'],[t('plan'),pro?t('pro'):t('free')],
   [t('heavyJobs'),pro?t('unlimited'):`${me.usage.used} / ${me.usage.limit}`,'data-usage'],...(me.studioUsage?[[t('studioExports'),pro?t('unlimited'):`${me.studioUsage.used} / ${me.studioUsage.limit}`,'data-studio-usage']]:[]),...(!pro?[[t('reset'),duration(locale,Date.parse(me.usage.resetAt)-Date.now()),'data-reset']]:[]),[t('ads'),me.ads?t('on'):t('off'),'data-ads'],
   ...(pro&&sub?.currentPeriodEnd&&!sub.pastDue?[['',t(sub.cancelAtPeriodEnd||sub.status==='canceled'?'endsOn':'renewsOn',{date:dateText(sub.currentPeriodEnd)})]]:[]),
   ...(pro&&sub?.pastDue&&sub.graceEndsAt?[['',t('pastDue',{date:dateText(sub.graceEndsAt)}),'data-past-due']]:[]),
   ...(sub?.disputed?[['',t('disputed'),'data-disputed']]:[])];
  body.innerHTML=`${failureHTML(providers,true)}<dl>${rows.map(([k,v,a])=>`<dt>${esc(k)}</dt><dd ${a||''}>${esc(v)}</dd>`).join('')}</dl>
<div class="service-actions">${pro?(me.billing.mode!=='off'&&sub?.provider!=='manual'?`<button type="button" class="secondary" data-manage>${esc(t('manage'))}</button>`:''):`<a class="primary" href="${locale}/pricing/">${esc(t('upgrade'))}</a>`}<button type="button" class="secondary" data-signout>${esc(t('signOut'))}</button></div>
<section data-linked><h2>${esc(t('linkedTitle'))}</h2><p class="service-hint">${esc(t('linkedHint'))}</p><ul class="identities" data-identities aria-busy="true"><li class="id-sub">${esc(t('linkedLoading'))}</li></ul></section>`;
  loadIdentities();
 }
}
/** 연결된 로그인: linked providers (with unlink while another way in remains) and link buttons for the others. */
function renderIdentities(data){
 const list=body.querySelector('[data-identities]');if(!list)return;
 list.setAttribute('aria-busy','false');
 const linked=new Map(data.identities.map(i=>[i.provider,i]));
 const rows=[];
 for(const id of ['google','github','discord']){
  const i=linked.get(id);
  if(i)rows.push(`<li data-linked-provider="${id}">${iconHTML(id)}<span class="id-main"><span class="id-name">${esc(providerName(id))}</span><span class="id-sub">${esc([i.email,t('linkedSince',{date:dateText(i.since)})].filter(Boolean).join(' · '))}</span></span><button type="button" class="secondary" data-unlink="${id}"${data.canUnlink?'':' disabled'}>${esc(t('unlink'))}</button></li>`);
  else if(data.providers.includes(id))rows.push(`<li data-link-provider="${id}">${buttonHTML(id,locale,startURL(id,accountPath,{link:true,api:API}),{link:true})}</li>`);
 }
 // Member passkeys (this account's devices), each removable while another way in remains.
 for(const d of data.devices||[])rows.push(`<li data-passkey-device="${esc(d.id)}">${PASSKEY_ICON}<span class="id-main"><span class="id-name">${esc(d.name)}</span><span class="id-sub">${esc([pt('created',{date:dateText(d.createdAt)}),d.lastUsedAt?pt('used',{date:dateText(d.lastUsedAt)}):''].filter(Boolean).join(' · '))}</span></span><button type="button" class="secondary" data-remove-passkey="${esc(d.id)}" data-name="${esc(d.name)}"${data.canUnlink?'':' disabled'}>${esc(pt('remove'))}</button></li>`);
 if(current().me?.passkey?.signin&&passkeySupported())rows.push(`<li data-passkey-add-row><button type="button" class="sib sib-passkey" data-passkey-add>${PASSKEY_ICON}<span>${esc(pt('add'))}</span></button></li>`);
 if(data.passkeys)rows.push(`<li><span class="id-main"><span class="id-name">${esc(t('passkeys'))}</span><span class="id-sub">${data.passkeys}</span></span></li>`);
 if(!data.canUnlink&&(linked.size||(data.devices||[]).length))rows.push(`<li class="id-sub" data-unlink-last>${esc(t('unlinkLast'))}</li>`);
 if((data.devices||[]).length)rows.push(`<li class="id-sub pk-warn" data-passkey-warn>${esc(pt('warn'))}</li>`);
 list.innerHTML=rows.join('');
}
async function loadIdentities(){
 try{
  const r=await fetch(apiPath('auth/identities'),{credentials:'same-origin'});const data=await r.json().catch(()=>null);
  if(r.ok&&data)renderIdentities(data);else say('serviceDown',true);
 }catch{say('serviceDown',true);}
}
async function unlink(button){
 const id=button.dataset.unlink;
 if(!confirm(t('unlinkConfirm',{p:providerName(id)})))return;
 button.disabled=true;
 try{
  const r=await fetch(apiPath('auth/unlink'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:id})});
  const data=await r.json().catch(()=>null);
  if(r.ok&&data){renderIdentities(data);say('unlinked',false,{p:providerName(id)});}
  else if(data?.error?.reason==='last_method')say('unlinkLast',true);
  else say('serviceDown',true);
 }catch{say('serviceDown',true);}finally{button.disabled=false;}
}
/** Passkey buttons and the sign-up form. Errors stay on screen (status line); a closed prompt says nothing. */
async function passkeyAction(button,run,onDone){
 button.disabled=true;sayText('');
 try{const r=await run();if(r.ok)return onDone(r.data||{});const m=passkeyMessage(locale,r);if(m)sayText(m,true);}
 catch{say('serviceDown',true);}finally{button.disabled=false;}
}
body.addEventListener('submit',event=>{
 const form=event.target.closest('form[data-passkey-signup]');if(!form)return;
 event.preventDefault();
 const input=form.querySelector('input[name="displayName"]'),name=input.value.trim();
 if([...name].length<2||[...name].length>20){sayText(pt('length'),true);input.focus();return;}
 const siteKey=current().me?.passkey?.turnstileSiteKey||'';
 passkeyAction(form.querySelector('button[type="submit"]'),()=>passkeySignUp({api:API,displayName:name,locale,getToken:k=>turnstileToken(k||siteKey,'signup',{lang:locale,title:pt('challenge'),close:pt('close')})}),
  data=>{track('login_completed',{provider:'passkey'});sayText(pt('welcome',{n:data.displayName||name}));signedInGo();});
});
body.addEventListener('click',async event=>{
 const pk=event.target.closest('[data-passkey-signin],[data-passkey-add],[data-remove-passkey]');
 if(pk){
  event.preventDefault();
  if(pk.matches('[data-passkey-signin]'))return passkeyAction(pk,()=>passkeySignIn({api:API}),()=>{sayText(pt('signedIn'));signedInGo();});
  if(pk.matches('[data-passkey-add]'))return passkeyAction(pk,()=>passkeyAddDevice({api:API}),data=>{renderIdentities({providers:current().me?.providers||[],...data});sayText(pt('added'));});
  if(!confirm(pt('removeConfirm',{n:pk.dataset.name||''})))return;
  return passkeyAction(pk,()=>passkeyRemove({api:API,id:pk.dataset.removePasskey}),data=>{renderIdentities({providers:current().me?.providers||[],...data});sayText(pt('removed'));});
 }
 const target=event.target.closest('[data-signout],[data-manage],[data-provider],[data-retry],[data-unlink]');if(!target)return;
 if(target.matches('[data-provider],[data-retry]')){track('login_started',{provider:target.dataset.provider||failure?.provider||''});return;}
 event.preventDefault();
 if(target.matches('[data-unlink]'))return unlink(target);
 target.disabled=true;
 try{
  if(target.matches('[data-signout]')){await logout();render();try{new BroadcastChannel('nerulio-account').postMessage('changed');}catch{}return;}
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
 if(params.get('login')==='ok'){
  track('login_completed');
  // Tell the tab that opened sign-in (e.g. the Studio, whose project is still in memory).
  try{new BroadcastChannel('nerulio-account').postMessage('signed-in');}catch{}
  if(params.get('from')==='studio'&&current().me?.loggedIn)say('backToStudio');
 }
 if(isBrand(params.get('linked'))&&current().me?.loggedIn)say('linkedOk',false,{p:providerName(params.get('linked'))});
 if(params.get('checkout')==='sandbox')say('sandbox');
 if(params.get('checkout')==='success'&&current().me?.plan!=='pro')awaitActivation();
 // One-time parameters leave the address bar (the error stays on screen until the next render);
 // ?return= stays, so a reload still comes back to the same page after sign-in.
 if(params.has('login')||params.has('linked')||params.has('checkout')||params.has('portal')){const clean=new URL(location.href);for(const k of ['login','reason','provider','link','linked','checkout','reference','portal','from'])clean.searchParams.delete(k);history.replaceState(null,'',clean);}
 // Countdown is local arithmetic; it never polls the server.
 setInterval(()=>{const me=current().me,el=body.querySelector('[data-reset]');if(me?.usage?.resetAt&&el)el.textContent=duration(locale,Date.parse(me.usage.resetAt)-Date.now());},60e3);
}
