import {quotaClass,quotaDay,counterSubject,STUDIO_SUBJECT_SUFFIX} from '../src/quota.js';
import {runtimeConfig,HUMAN_TTL_MS} from './config.js';
import {ApiError,json,errorResponse,readJSON,readBody,cookie} from './http.js';
import {hmacHex,sign,unsign} from './crypto.js';
import {resolveContext,HUMAN_COOKIE} from './identity.js';
import {usageFor,authorizeJob,networkUsage,cleanupStatements,resetAt} from './usage.js';
import {startLogin,finishLogin,logout} from './auth-google.js';
import {verifyTurnstile} from './turnstile.js';
import {billingProvider} from './billing/index.js';
import {applyBillingEvent} from './billing/webhook.js';
export const API_VERSION='1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** State-changing browser endpoints accept only Nerulio's own origin. There is no CORS:
 * no Access-Control-Allow-* header is ever sent, so other sites cannot read responses. */
export function assertSameOrigin(request,cfg){
 const url=new URL(request.url),origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 const allowed=new Set([url.origin,cfg.siteOrigin].filter(Boolean));
 if(site&&site!=='same-origin')throw new ApiError('FORBIDDEN_ORIGIN');
 if(origin?!allowed.has(origin):site!=='same-origin')throw new ApiError('FORBIDDEN_ORIGIN');
}
/** Bodies are a closed set of small scalar fields. Anything else (a file, base64, a
 * filename…) is rejected before any processing — a structural privacy guarantee. */
function fields(body,allowed){
 for(const [k,v]of Object.entries(body)){
  if(!allowed.includes(k))throw new ApiError('BAD_REQUEST',`Unexpected field: ${k.slice(0,40)}`);
  if(typeof v!=='string'||v.length>2048)throw new ApiError('BAD_REQUEST',`Invalid field: ${k}`);
 }
 return body;
}
/** Abuse bucket for anonymous identities: keyed hash of the day and the client network
 * (/64 for IPv6). It cannot be reversed to an address and changes every UTC day. */
export async function networkSubject(ip,secret,now){
 if(!ip)return '';
 const net=ip.includes(':')?ip.split(':').slice(0,4).join(':'):ip;
 return 'n:'+(await hmacHex(secret,`net\n${quotaDay(now)}\n${net}`)).slice(0,32);
}
const publicUsage=(plan,usage)=>plan==='pro'?{unlimited:true}:usage;
/** Free counters of one class; a brand-new anonymous identity has no row yet, so skip the read. */
const limitFor=(cfg,cls)=>cls==='studio'?cfg.freeDailyStudio:cfg.freeDailyJobs;
async function counter(ctx,cfg,db,now,cls){
 const limit=limitFor(cfg,cls);
 if(ctx.setCookies.length&&!ctx.user)return {used:0,limit,remaining:limit,resetAt:resetAt(now)};
 return usageFor(db,counterSubject(ctx.subject,cls),limit,now);
}
async function me(ctx,cfg,db,now){
 const [usage,studio]=ctx.plan==='pro'?[null,null]:await Promise.all([counter(ctx,cfg,db,now,'heavy'),counter(ctx,cfg,db,now,'studio')]);
 return {
  loggedIn:!!ctx.user,plan:ctx.plan,ads:ctx.plan!=='pro',usage:publicUsage(ctx.plan,usage),studioUsage:publicUsage(ctx.plan,studio),
  ...(ctx.user?{user:{name:ctx.user.display_name||'',email:ctx.user.email||''},subscription:ctx.subscription}:{}),
  billing:{mode:cfg.billing.mode},
  turnstileSiteKey:cfg.turnstile.siteKey&&cfg.turnstile.secret?cfg.turnstile.siteKey:''
 };
}
async function humanFor(ctx,cfg,now){
 const value=await unsign(cfg.secret,'human/v1',ctx.cookies[HUMAN_COOKIE]);
 if(!value)return false;const [id,exp]=value.split('~');
 return id===ctx.anonId&&Number(exp)>now;
}
async function authorize(request,ctx,cfg,db,now,deps){
 const body=fields(await readJSON(request,1024),['operationId','toolId','turnstileToken']);
 if(!UUID.test(body.operationId||''))throw new ApiError('INVALID_OPERATION','operationId must be a UUID.');
 const cls=quotaClass(body.toolId);
 if(!cls)throw new ApiError('UNKNOWN_TOOL');
 if(cls!=='heavy'&&cls!=='studio')throw new ApiError('NOT_METERED','This tool does not use the daily limit.');
 if(ctx.plan==='pro')return {allowed:true,unlimited:true,plan:'pro'};
 let network='';
 if(!ctx.user){
  network=await networkSubject(request.headers.get('cf-connecting-ip'),cfg.secret,now);
  if(network&&cfg.turnstile.secret&&!(await humanFor(ctx,cfg,now))&&await networkUsage(db,network,now)>=cfg.anonNetworkSoftLimit){
   if(!body.turnstileToken)throw new ApiError('CHALLENGE_REQUIRED','Please confirm you are human.',{siteKey:cfg.turnstile.siteKey});
   const ok=await verifyTurnstile({token:body.turnstileToken,secret:cfg.turnstile.secret,ip:request.headers.get('cf-connecting-ip'),expectedAction:'quota',hostname:ctx.url.hostname},deps.fetch);
   if(!ok)throw new ApiError('CHALLENGE_FAILED');
   ctx.setCookies.push(cookie(HUMAN_COOKIE,await sign(cfg.secret,'human/v1',`${ctx.anonId}~${now+HUMAN_TTL_MS}`),{maxAge:HUMAN_TTL_MS/1000,secure:ctx.secure}));
  }
 }
 // 'heavy' (file tools) and 'studio' (Studio exports) are separate counters of the same identity.
 const result=await authorizeJob(db,{subject:counterSubject(ctx.subject,cls),operationId:body.operationId.toLowerCase(),toolId:body.toolId,limit:limitFor(cfg,cls),now,networkSubject:network});
 if(deps.ctx&&deps.random()<1/500)deps.ctx.waitUntil(db.batch(cleanupStatements(db,now)).catch(()=>{}));
 if(!result.allowed)throw new ApiError('DAILY_LIMIT',undefined,{},{allowed:false,reason:'daily_limit',kind:cls,used:result.used,limit:result.limit,remaining:0,resetAt:result.resetAt});
 return {...result,plan:'free',kind:cls};
}
async function checkout(request,ctx,cfg,env,deps){
 const body=fields(await readJSON(request,4096),['turnstileToken','locale']);
 if(!ctx.user)throw new ApiError('LOGIN_REQUIRED');
 if(ctx.plan==='pro')throw new ApiError('ALREADY_PRO','You already have Nerulio Pro.');
 const provider=billingProvider(cfg);if(!provider)throw new ApiError('BILLING_UNAVAILABLE','Purchases are not available yet.');
 if(cfg.turnstile.secret){
  if(!body.turnstileToken)throw new ApiError('CHALLENGE_REQUIRED','Please confirm you are human.',{siteKey:cfg.turnstile.siteKey});
  if(!await verifyTurnstile({token:body.turnstileToken,secret:cfg.turnstile.secret,ip:request.headers.get('cf-connecting-ip'),expectedAction:'checkout',hostname:ctx.url.hostname},deps.fetch))throw new ApiError('CHALLENGE_FAILED');
 }
 // Return to the host the buyer is on (already same-origin checked), not a configured one.
 const origin=ctx.url.origin,{url}=await provider.createCheckout({user:ctx.user,cfg,env,origin,fetcher:deps.fetch});
 const target=new URL(url,origin);
 if(target.protocol!=='https:'&&target.origin!==origin)throw new ApiError('UPSTREAM_FAILED');
 return {url:target.href,mode:cfg.billing.mode};
}
async function portal(ctx,cfg,db,env,deps){
 if(!ctx.user)throw new ApiError('LOGIN_REQUIRED');
 const provider=billingProvider(cfg);if(!provider)throw new ApiError('BILLING_UNAVAILABLE');
 const row=await db.prepare('SELECT external_customer_id,external_subscription_id FROM subscriptions WHERE user_id=?1 AND provider=?2 ORDER BY updated_at DESC LIMIT 1').bind(ctx.user.id,cfg.billing.provider).first();
 if(!row)throw new ApiError('BILLING_UNAVAILABLE','No subscription to manage.');
 return provider.portal({customerId:row.external_customer_id,subscriptionId:row.external_subscription_id,env,origin:ctx.url.origin,fetcher:deps.fetch});
}
async function webhook(request,cfg,db,env,now){
 const provider=billingProvider(cfg);if(!provider)throw new ApiError('BILLING_UNAVAILABLE');
 const body=await readBody(request,256*1024);
 if(!await provider.verifyWebhook({headers:request.headers,body,env,now}))throw new ApiError('INVALID_SIGNATURE','Webhook signature rejected.');
 let payload;try{payload=JSON.parse(body);}catch{throw new ApiError('INVALID_JSON');}
 const event=provider.normalizeWebhook(payload,env);if(!event)throw new ApiError('BAD_REQUEST','Unrecognized event.');
 const {duplicate}=await applyBillingEvent(db,provider.name,event,now);
 return {received:true,duplicate};
}
/** Aggregate counts only. There is nothing per-file to show: no file data reaches the server. */
async function adminStats(ctx,cfg,db,now){
 const u=ctx.user;
 // Unknown to non-admins (404), and admins must have signed in within the last 12 hours.
 if(!u||!cfg.adminSubjects.includes(u.provider_subject)||u.provider!=='google'||now-Number(u.session_created)>12*3600e3)throw new ApiError('NOT_FOUND');
 const day=quotaDay(now),since=now-864e5;
 const [users,pro,usage,jobs,events]=await db.batch([
  db.prepare('SELECT COUNT(*) n FROM users'),
  db.prepare(`SELECT COUNT(DISTINCT user_id) n FROM subscriptions WHERE plan='pro' AND status IN ('active','trialing') AND current_period_end>?1`).bind(now),
  db.prepare(`SELECT COALESCE(SUM(CASE WHEN subject_id LIKE ?2 THEN 0 ELSE used END),0) n,COALESCE(SUM(CASE WHEN subject_id LIKE ?2 THEN used ELSE 0 END),0) studio FROM daily_usage WHERE day=?1 AND subject_id NOT LIKE 'n:%'`).bind(day,'%'+STUDIO_SUBJECT_SUFFIX),
  db.prepare('SELECT COALESCE(SUM(allowed=0),0) denied,COUNT(*) total FROM job_authorizations WHERE created_at>=?1').bind(Date.parse(day)),
  db.prepare(`SELECT COALESCE(SUM(state='ignored'),0) ignored,COUNT(*) total FROM billing_events WHERE processed_at>=?1`).bind(since)
 ]);
 return {day,users:users.results[0].n,proActive:pro.results[0].n,freeHeavyJobsToday:usage.results[0].n,freeStudioExportsToday:usage.results[0].studio,authorizationsToday:jobs.results[0].total,deniedToday:jobs.results[0].denied,
  billingEvents24h:events.results[0].total,billingEventsIgnored24h:events.results[0].ignored,billing:cfg.billing.mode,environment:cfg.environment};
}
const ROUTES={
 'GET /health':1,'GET /me':1,'GET /usage':1,'POST /jobs/authorize':1,'GET /auth/google/start':1,'GET /auth/google/callback':1,
 'POST /auth/logout':1,'POST /billing/checkout':1,'POST /billing/portal':1,'POST /billing/webhook':1,'GET /admin/stats':1,'POST /admin/cleanup':1
};
export async function handleApi(request,env={},ctx=null,deps={}){
 deps={fetch:deps.fetch||((...a)=>fetch(...a)),now:deps.now||Date.now,random:deps.random||Math.random,ctx};
 const url=new URL(request.url),route=url.pathname.replace(/^\/api\/v1/,'').replace(/\/+$/,'')||'/',key=`${request.method} ${route}`;
 let context=null;
 try{
  if(!ROUTES[key]){
   const methods=['GET','POST'].filter(m=>ROUTES[`${m} ${route}`]);
   if(methods.length)return errorResponse(new ApiError('METHOD_NOT_ALLOWED'),{Allow:methods.join(', ')});
   throw new ApiError('NOT_FOUND');
  }
  const cfg=runtimeConfig(env),now=deps.now(),db=env.DB;
  if(key==='GET /health'){
   let database=false;if(db)try{database=(await db.prepare('SELECT 1 AS ok').first())?.ok===1;}catch{}
   return json({ok:true,api:API_VERSION,environment:cfg.environment,configured:cfg.configured,database,billing:cfg.billing.mode,google:!!(cfg.google.clientId&&cfg.google.clientSecret),turnstile:!!(cfg.turnstile.siteKey&&cfg.turnstile.secret)});
  }
  if(!cfg.configured)throw new ApiError('SERVICE_NOT_CONFIGURED');
  if(key==='POST /billing/webhook')return json(await webhook(request,cfg,db,env,now));
  if(request.method==='POST')assertSameOrigin(request,cfg);
  context=await resolveContext(request,cfg,db,now);
  const done=(body,status=200)=>json(body,status,{'Set-Cookie':context.setCookies});
  switch(key){
   case 'GET /me':return done(await me(context,cfg,db,now));
   case 'GET /usage':return done(context.plan==='pro'?{plan:'pro',usage:{unlimited:true},studioUsage:{unlimited:true}}:{plan:context.plan,usage:await usageFor(db,context.subject,cfg.freeDailyJobs,now),studioUsage:await usageFor(db,counterSubject(context.subject,'studio'),cfg.freeDailyStudio,now)});
   case 'POST /jobs/authorize':return done(await authorize(request,context,cfg,db,now,deps));
   case 'GET /auth/google/start':return await startLogin(context,cfg,now);
   case 'GET /auth/google/callback':return await finishLogin(context,cfg,db,now,deps.fetch);
   case 'POST /auth/logout':context.setCookies.push(await logout(context,db));return done({loggedIn:false});
   case 'POST /billing/checkout':return done(await checkout(request,context,cfg,env,deps));
   case 'POST /billing/portal':return done(await portal(context,cfg,db,env,deps));
   case 'GET /admin/stats':return done(await adminStats(context,cfg,db,now));
   case 'POST /admin/cleanup':await adminStats(context,cfg,db,now);await db.batch(cleanupStatements(db,now));return done({cleaned:true});
  }
  throw new ApiError('NOT_FOUND');
 }catch(error){
  if(!(error instanceof ApiError))console.error('api',key,error?.name,error?.message);
  return errorResponse(error,context?{'Set-Cookie':context.setCookies}:{});
 }
}
