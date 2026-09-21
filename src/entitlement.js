import {meteredTool,quotaDay} from './quota.js';
import {track} from './analytics.js';
/** Client entitlement: the only browser module that talks to /api/v1.
 * - Builds without <meta name="nerulio-service"> have no accounts: nothing is fetched,
 *   no tool is metered, and advertising keeps its previous behaviour.
 * - GET /me runs once per page (memory cache only). Plan/usage are never persisted in
 *   storage and nothing stored in the browser is trusted for entitlement.
 * - authorize(toolId) sends only {operationId, toolId}. Never a file, name, size or bytes.
 * - Fail-open: light tools never call the API; if the service is unreachable a small
 *   daily grace allowance keeps heavy tools usable during an outage. */
const meta=document.querySelector('meta[name="nerulio-service"]');
let config=null;try{config=meta?JSON.parse(meta.content):null;}catch{config=null;}
const API=config?new URL(config.api||'api/v1/',document.baseURI).pathname:'';
export const GRACE_JOBS=3;
const GRACE_KEY='nerulio.grace.v1';
let status=config?'idle':'disabled';// disabled | idle | loading | ready | unconfigured | offline
let me=null,loading=null,inFlight=false,graceMemory=0;
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
function applyUsage(usage){if(me&&usage&&!me.usage?.unlimited)me.usage={...me.usage,...usage};}
export async function load({force=false}={}){
 if(!config)return null;
 if(loading&&!force)return loading;
 status='loading';
 loading=(async()=>{
  try{
   const r=await request('me',{timeout:6000});
   if(r.ok){me=r.data;status='ready';track('account_status_loaded',{plan:me.plan});if(me.plan==='pro')track('pro_active',{plan:'pro'});}
   else if(r.code==='SERVICE_NOT_CONFIGURED'){me=null;status='unconfigured';}
   else{me=null;status='offline';}
  }catch{me=null;status='offline';}
  emit();renderHeader();return me;
 })();
 return loading;
}
/** Ads are shown only when the server says so. Accounts disabled or not configured keeps
 * the previous site-wide behaviour; if the service is unreachable we do not guess. */
export async function adsAllowed(){
 if(!config)return true;
 await load();
 return status==='unconfigured'||(status==='ready'&&me?.ads===true);
}
function graceTake(){
 const day=quotaDay();
 try{
  const saved=JSON.parse(localStorage.getItem(GRACE_KEY)||'null'),used=saved?.day===day?saved.used:0;
  if(used>=GRACE_JOBS)return false;
  localStorage.setItem(GRACE_KEY,JSON.stringify({day,used:used+1}));return true;
 }catch{if(graceMemory>=GRACE_JOBS)return false;graceMemory++;return true;}
}
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
/** Resolve before starting local processing. Returns true to run, false to stop without
 * touching the current file, selection, settings or previous result. */
export async function authorize(toolId,options={}){
 const id=meteredTool(toolId,options);
 if(!id||!config)return true;
 if(inFlight)return false;// a second click while the first check is pending
 inFlight=true;
 try{
  await load();
  if(status==='unconfigured')return true;
  if(me?.plan==='pro')return true;// Pro: direct local processing for this page session
  const operationId=crypto.randomUUID();
  let r=status==='offline'?{ok:false,code:'OFFLINE'}:await send(id,operationId);
  if(r.code==='CHALLENGE_REQUIRED'){
   const token=await import('./human-check.js').then(m=>m.challenge(r.data.error.siteKey,'quota',locale())).catch(()=>'');
   if(!token)return false;
   r=await send(id,operationId,token);
  }
  if(r.ok&&r.data?.allowed){
   if(r.data.unlimited){if(me){me.plan='pro';me.ads=false;me.usage={unlimited:true};}return true;}
   applyUsage({used:r.data.used,limit:r.data.limit,remaining:r.data.remaining,resetAt:r.data.resetAt});emit();
   track('quota_authorized',{intent:id,plan:'free'});
   if(r.data.remaining<=5)notice('remaining',{n:r.data.remaining});
   return true;
  }
  if(r.code==='DAILY_LIMIT'){
   applyUsage({used:r.data.used,limit:r.data.limit,remaining:0,resetAt:r.data.resetAt});emit();
   track('quota_denied',{intent:id,plan:'free'});
   try{await (await import('./upgrade-modal.js')).showLimit({resetAt:r.data.resetAt,locale:locale(),pricing:config.pricing});}catch{}
   return false;
  }
  if(r.code==='CHALLENGE_FAILED'){notice('challengeFailed');return false;}
  // Version skew between page and Worker must never block a tool.
  if(['UNKNOWN_TOOL','NOT_METERED'].includes(r.code))return true;
  // Outage (network, 5xx, unexpected): limited local grace, then pause heavy tools only.
  if(graceTake()){notice('graceUsed');return true;}
  notice('paused');return false;
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
export const entitlement=Object.freeze({enabled,load,adsAllowed,authorize,logout,onChange,current,apiPath});
if(config&&document.getElementById('accountLink')){
 new MutationObserver(renderHeader).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 // Off the critical path: the first paint and the tool UI never wait for the account call.
 (window.requestIdleCallback||(fn=>setTimeout(fn,300)))(()=>load(),{timeout:2500});
}
