import {meteredTool,quotaDay,quotaClass} from './quota.js';
import {track} from './analytics.js';
import {verifyTicket,newNonce} from './ticket-verify.js';
/** Client entitlement: the only browser module that talks to /api/v1.
 * - Builds without <meta name="nerulio-service"> have no accounts: nothing is fetched,
 *   no tool is metered, and advertising keeps its previous behaviour.
 * - GET /me runs once per page (memory cache only). Plan/usage are never persisted and nothing
 *   stored in the browser is trusted for entitlement. A failed /me is retried before the next
 *   metered action, so one network blip never pins the page "offline".
 * - authorize(toolId) sends only {operationId, toolId}. Never a file, name, size or bytes.
 * - Fail-CLOSED for metered work on a build that has the service (docs/MONETIZATION-SECURITY.md):
 *   "service not configured", an unknown tool id or an unreachable service are NOT permission.
 *   The only offline allowance is the signed grace tokens the server handed out in /me today
 *   (at most OFFLINE_GRACE_EXPORTS, never more than what is left); each spent token is reported
 *   and charged once the service answers again. A page that never reached the service has none.
 *   Light tools never call the API and are never affected.
 * - Signed answers: when the build carries the service's public key (TICKET_PUBLIC_KEY), the plan
 *   in /me and every "allowed" are accepted only with a valid signature bound to the nonce this
 *   page chose for that request. A rewritten or replayed answer counts as no answer. */
const meta=document.querySelector('meta[name="nerulio-service"]');
let config=null;try{config=meta?JSON.parse(meta.content):null;}catch{config=null;}
const API=config?new URL(config.api||'api/v1/',document.baseURI).pathname:'';
const GRACE_KEY='nerulio.grace.v2';
let status=config?'idle':'disabled';// disabled | idle | loading | ready | unconfigured | offline
let me=null,loading=null,inFlight=false,signInPending=false;
const graceMemory={day:'',tokens:{heavy:[],studio:[]},spent:[],pending:[]},graceRefreshed={};
const listeners=new Set();
const locale=()=>['ko','en','ja'].includes(document.documentElement.lang)?document.documentElement.lang:'en';
const L={signIn:{ko:'로그인',en:'Sign in',ja:'ログイン'},account:{ko:'계정',en:'Account',ja:'アカウント'}};
function emit(){for(const fn of listeners){try{fn(snapshot());}catch{}}}
function snapshot(){return {status,me,config};}
async function request(path,{method='GET',body,timeout=8000}={}){
 const init={method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout?.(timeout)};
 if(body!==undefined){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body);}
 const response=await fetch(API+path,init);
 let data=null;try{data=await response.json();}catch{}
 return {ok:response.ok,status:response.status,data,code:data?.error?.code||''};
}
// ------------------------------------------------------------------ signed offline grace
function graceRead(){
 try{const g=JSON.parse(localStorage.getItem(GRACE_KEY)||'null');if(g&&typeof g==='object')return {day:String(g.day||''),tokens:{heavy:[...(g.tokens?.heavy||[])],studio:[...(g.tokens?.studio||[])]},spent:[...(g.spent||[])],pending:[...(g.pending||[])]};}catch{}
 return graceMemory;
}
function graceWrite(g){Object.assign(graceMemory,g);try{localStorage.setItem(GRACE_KEY,JSON.stringify(g));}catch{}}
/** Keep today's tokens from the server; forget other days (they are worthless after 00:00 UTC). */
function graceStore(grace){
 const old=graceRead();
 if(!grace){if(old.day&&old.day!==quotaDay())graceWrite({day:'',tokens:{heavy:[],studio:[]},spent:[],pending:old.pending});return;}
 const same=old.day===grace.day;
 graceWrite({day:grace.day,tokens:{heavy:[...(grace.heavy||[])],studio:[...(grace.studio||[])]},spent:same?old.spent:[],pending:old.pending});
}
function graceTake(kind){
 const g=graceRead();if(g.day!==quotaDay())return false;
 const token=(g.tokens[kind]||[]).find(t=>!g.spent.includes(t));if(!token)return false;
 g.spent.push(token);g.pending.push(token);graceWrite(g);return true;
}
/** Report tokens spent while offline; each is charged exactly once on the server. */
async function reconcile(){
 const g=graceRead();if(!g.pending.length)return;
 try{
  const r=await request('jobs/reconcile',{method:'POST',body:{tokens:g.pending.slice(0,20).join(',')}});
  if(r.ok||r.status===400||r.status===403){const now=graceRead();now.pending=now.pending.filter(t=>!g.pending.includes(t));graceWrite(now);}
 }catch{}
}
// ------------------------------------------------------------------ /me
function applyUsage(usage,kind){const k=kind==='studio'?'studioUsage':'usage';if(me&&usage&&!me[k]?.unlimited)me[k]={...me[k],...usage};}
export async function load({force=false}={}){
 if(!config)return null;
 if(loading&&!force)return loading;
 status='loading';
 loading=(async()=>{
  try{
   const nonce=newNonce();
   const r=await request(`me?n=${nonce}`,{timeout:6000});
   const trusted=r.ok&&(!config.ticketKey||!!await verifyTicket(config.ticketKey,r.data?.entitlement,{kind:'me',n:nonce,plan:r.data?.plan,ads:r.data?.ads,loggedIn:r.data?.loggedIn}));
   if(r.ok&&!trusted){me=null;status='offline';track('entitlement_unverified');}
   else if(r.ok){me=r.data;status='ready';graceStore(me.plan==='pro'?null:me.grace);track('account_status_loaded',{plan:me.plan});if(me.plan==='pro')track('pro_active',{plan:'pro'});reconcile();}
   else if(r.code==='SERVICE_NOT_CONFIGURED'){me=null;status='unconfigured';}
   else{me=null;status='offline';}
  }catch{me=null;status='offline';}
  emit();renderHeader();return me;
 })();
 return loading;
}
/** Before a metered action: reuse a good /me, retry a failed one (B8). */
async function ensureLoaded(){
 await load();
 if(status!=='ready')await load({force:true});
}
/** Ads are shown only when the server says so. Accounts disabled or not configured keeps
 * the previous site-wide behaviour; if the service is unreachable we do not guess. */
export async function adsAllowed(){
 if(!config)return true;
 await load();
 return status==='unconfigured'||(status==='ready'&&me?.ads===true);
}
// ------------------------------------------------------------------ sign-in (free, new tab)
/** The Google sign-in URL. It opens in a NEW tab so the page (and the Studio project in memory)
 * is never navigated away; the account page tells this tab when sign-in finished. */
export function signInURL(from=''){
 const back=`/${locale()}/account/${from?`?from=${encodeURIComponent(from)}`:''}`;
 return API+`auth/google/start?return=${encodeURIComponent(back)}`;
}
export function openSignIn(from=''){
 signInPending=true;track('login_started',{from});
 window.open(signInURL(from),'_blank','noopener');
}
async function refreshAfterSignIn(){
 if(!signInPending||!config)return;
 const was=me?.loggedIn;await load({force:true});
 if(me?.loggedIn&&!was){signInPending=false;for(const fn of signInListeners){try{fn(me);}catch{}}}
}
const signInListeners=new Set();
export const onSignIn=fn=>{signInListeners.add(fn);return ()=>signInListeners.delete(fn);};
if(config){
 addEventListener('focus',()=>{refreshAfterSignIn();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshAfterSignIn();});
 try{const bc=new BroadcastChannel('nerulio-account');bc.onmessage=e=>{if(e.data==='signed-in'){signInPending=true;refreshAfterSignIn();}else if(e.data==='changed')load({force:true});};}catch{}
}
// ------------------------------------------------------------------ authorize
// UI chunks load lazily; if one cannot load (e.g. during an outage) the decision stands anyway.
async function notice(key,vars){try{(await import('./service-ui.js')).toast(key,vars);}catch{}}
async function send(toolId,operationId,turnstileToken){
 const body={operationId,toolId};if(turnstileToken)body.turnstileToken=turnstileToken;
 try{return await request('jobs/authorize',{method:'POST',body});}
 catch{
  // One retry with the SAME operation id: the server's idempotency record means a lost
  // response can never be charged twice.
  await new Promise(r=>setTimeout(r,800));
  try{return await request('jobs/authorize',{method:'POST',body});}catch{return {ok:false,status:0,data:null,code:'NETWORK'};}
 }
}
const OUTAGE=r=>r.status===0||r.status>=500||['NETWORK','OFFLINE','SERVICE_NOT_CONFIGURED','INTERNAL','UPSTREAM_FAILED'].includes(r.code);
/** Resolve before starting local processing. Returns true to run, false to stop without
 * touching the current file, selection, settings or previous result.
 * `ui` lets an app with its own look (the Studio) replace the site's toasts and dialogs:
 * {notice(key,vars), limit(info), signIn(info), lowAt}. */
export async function authorize(toolId,options={},ui={}){
 const id=meteredTool(toolId,options);
 if(!id||!config)return true;
 const kind=quotaClass(id),say=ui.notice||notice,lowAt=ui.lowAt??5;
 if(inFlight)return false;// a second click while the first check is pending
 inFlight=true;
 try{
  await ensureLoaded();
  if(status==='ready'&&me?.plan==='pro')return true;// Pro: direct local processing for this page session
  const operationId=crypto.randomUUID();
  let r=status==='ready'?await send(id,operationId):{ok:false,status:0,code:status==='unconfigured'?'SERVICE_NOT_CONFIGURED':'OFFLINE'};
  if(r.code==='CHALLENGE_REQUIRED'){
   const token=await import('./human-check.js').then(m=>m.challenge(r.data.error.siteKey,'quota',locale())).catch(()=>'');
   if(!token)return false;
   r=await send(id,operationId,token);
  }
  if(r.ok&&r.data?.allowed){
   // An "allowed" that the service did not sign for THIS operation is not a permission.
   if(config.ticketKey&&!await verifyTicket(config.ticketKey,r.data.ticket,{kind:'job',op:operationId,tool:id,plan:r.data.unlimited?'pro':'free'})){track('ticket_rejected',{intent:id});say('paused',{kind});return false;}
   if(r.data.unlimited){if(me){me.plan='pro';me.ads=false;me.usage={unlimited:true};me.studioUsage={unlimited:true};}emit();return true;}
   applyUsage({used:r.data.used,limit:r.data.limit,remaining:r.data.remaining,resetAt:r.data.resetAt},kind);emit();
   // Offline tokens are issued only after a counted job today: fetch them once, in the background.
   if(!graceRefreshed[kind]&&r.data.remaining>0&&!graceRead().tokens[kind]?.length){graceRefreshed[kind]=true;setTimeout(()=>{if(!inFlight)load({force:true});},0);}
   track('quota_authorized',{intent:id,plan:'free'});
   if(r.data.remaining<=lowAt)say('remaining',{n:r.data.remaining,kind});
   return true;
  }
  const info={resetAt:r.data?.resetAt,used:r.data?.used,limit:r.data?.limit,signInLimit:r.data?.signInLimit,kind,locale:locale(),pricing:config.pricing};
  if(r.code==='DAILY_LIMIT'){
   applyUsage({used:r.data.used,limit:r.data.limit,remaining:0,resetAt:r.data.resetAt},kind);emit();
   track('quota_denied',{intent:id,plan:'free'});
   try{if(ui.limit)await ui.limit(info);else await (await import('./upgrade-modal.js')).showLimit(info);}catch{}
   return false;
  }
  if(r.code==='SIGN_IN_REQUIRED'){
   applyUsage({used:r.data.used,limit:r.data.limit,remaining:0,resetAt:r.data.resetAt,signInRequired:true},kind);emit();
   track('sign_in_prompt',{intent:id});
   try{if(ui.signIn)await ui.signIn(info);else say('signInRequired',{kind});}catch{}
   return false;
  }
  if(r.code==='NETWORK_LIMIT'){say('networkLimit',{kind,resetAt:r.data?.resetAt});return false;}
  if(r.code==='RATE_LIMITED'){say('rateLimited',{kind});return false;}
  if(r.code==='CHALLENGE_FAILED'){say('challengeFailed',{kind});return false;}
  // The page and the Worker disagree about this tool (a deploy happened): reload, never "free".
  if(['UNKNOWN_TOOL','NOT_METERED'].includes(r.code)){say('updated',{kind});return false;}
  // Outage (network, 5xx, not configured): only today's signed tokens, then pause. If /me still
  // answers, only the authorize call is being blocked — that is not an outage.
  if(OUTAGE(r)&&status==='ready'){await load({force:true});if(status==='ready'){say('paused',{kind});return false;}}
  if(OUTAGE(r)&&graceTake(kind)){say('graceUsed',{kind});track('quota_grace',{intent:id});return true;}
  say('paused',{kind});return false;
 }finally{inFlight=false;}
}
export async function logout(){
 const r=await request('auth/logout',{method:'POST',body:{}});
 if(r.ok){track('logout');me=null;await load({force:true});}
 return r.ok;
}
export const onChange=fn=>{listeners.add(fn);return ()=>listeners.delete(fn);};
export const current=snapshot;
export const apiPath=path=>API+path;
export const enabled=!!config;
/** Header: "Sign in", "Account" or a Pro badge. Opens in a new tab so work in memory stays. */
function renderHeader(){
 const link=document.getElementById('accountLink');if(!link)return;
 if(status!=='ready'||!me){link.hidden=true;return;}
 const l=locale();
 link.href=`${l}/account/`;link.hidden=false;
 link.classList.toggle('is-pro',me.plan==='pro');
 link.textContent=me.plan==='pro'?'Pro':me.loggedIn?L.account[l]:L.signIn[l];
}
export const entitlement=Object.freeze({enabled,load,adsAllowed,authorize,logout,onChange,current,apiPath,signInURL,openSignIn,onSignIn});
if(config&&document.getElementById('accountLink')){
 new MutationObserver(renderHeader).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 // Off the critical path: the first paint and the tool UI never wait for the account call.
 (window.requestIdleCallback||(fn=>setTimeout(fn,300)))(()=>load(),{timeout:2500});
}
