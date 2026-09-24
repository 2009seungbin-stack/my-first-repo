import {quotaClass,quotaDay,counterSubject,STUDIO_SUBJECT_SUFFIX} from '../src/quota.js';
import {runtimeConfig,HUMAN_TTL_MS} from './config.js';
import {ApiError,json,errorResponse,readJSON,readBody,cookie} from './http.js';
import {hmacHex,sign,unsign} from './crypto.js';
import {resolveContext,HUMAN_COOKIE} from './identity.js';
import {usageFor,authorizeJob,networkUsage,cleanupStatements,resetAt,graceTokens,readGraceToken,bumpEvent} from './usage.js';
import {startLogin,finishLogin,logout} from './auth-google.js';
import {verifyTurnstile} from './turnstile.js';
import {billingProvider} from './billing/index.js';
import {applyBillingEvent} from './billing/webhook.js';
import {allowRequest} from './ratelimit.js';
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
/** Full 8×16-bit groups of an IPv6 address ('::' and an embedded IPv4 tail expanded), or null.
 * Splitting the compressed text form would put host bits into the "/64" of any prefix with zero
 * groups (2001:db8::5 vs 2001:db8::6), letting one /64 rotate through many buckets. */
export function ipv6Groups(ip){
 let s=String(ip||'').toLowerCase().replace(/^\[|\]$/g,'').split('%')[0];
 const v4=/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
 if(v4){const b=v4.slice(1).map(Number);if(b.some(x=>x>255))return null;s=s.slice(0,v4.index)+((b[0]<<8)|b[1]).toString(16)+':'+((b[2]<<8)|b[3]).toString(16);}
 const halves=s.split('::');if(halves.length>2)return null;
 const head=halves[0]?halves[0].split(':'):[],tail=halves.length===2&&halves[1]?halves[1].split(':'):[];
 const fill=8-head.length-tail.length;if(halves.length===1?fill!==0:fill<1)return null;
 const groups=[...head,...Array(halves.length===2?fill:0).fill('0'),...tail];
 if(groups.length!==8||!groups.every(g=>/^[0-9a-f]{1,4}$/.test(g)))return null;
 return groups.map(g=>parseInt(g,16).toString(16));
}
/** Network keys of a client address: narrow = the IPv4 address or the IPv6 /64; wide = the
 * IPv4 /24 or the IPv6 /48. Keyed daily HMACs: not reversible, different every UTC day. */
export async function networkSubjects(ip,secret,now){
 if(!ip)return null;
 let narrow,wide;
 if(ip.includes(':')){const g=ipv6Groups(ip);if(!g)return null;narrow=g.slice(0,4).join(':');wide=g.slice(0,3).join(':');}
 else{const p=ip.split('.');if(p.length!==4)return null;narrow=ip;wide=p.slice(0,3).join('.');}
 const day=quotaDay(now);
 return {narrow:'n:'+(await hmacHex(secret,`net\n${day}\n${narrow}`)).slice(0,32),wide:'w:'+(await hmacHex(secret,`wide\n${day}\n${wide}`)).slice(0,32)};
}
/** Back-compat: the narrow network bucket only. */
export async function networkSubject(ip,secret,now){return (await networkSubjects(ip,secret,now))?.narrow||'';}
const publicUsage=(plan,usage)=>plan==='pro'?{unlimited:true}:usage;
const limitFor=(cfg,cls)=>cls==='studio'?cfg.freeDailyStudio:cfg.freeDailyJobs;
/** The Studio limit that applies to this identity: anonymous identities get FREE_ANON_STUDIO_EXPORTS,
 * after which a free sign-in unlocks the rest of FREE_DAILY_STUDIO_EXPORTS. */
const studioLimitFor=(ctx,cfg)=>ctx.user?cfg.freeDailyStudio:cfg.freeAnonStudio;
const signInUnlocks=(ctx,cfg)=>!ctx.user&&cfg.freeAnonStudio<cfg.freeDailyStudio;
async function counter(ctx,cfg,db,now,cls){
 const limit=cls==='studio'?studioLimitFor(ctx,cfg):limitFor(cfg,cls);
 // A brand-new anonymous identity has no row yet (a dead session cookie does not make it new).
 const usage=ctx.newAnon&&!ctx.user?{used:0,limit,remaining:limit,resetAt:resetAt(now)}:await usageFor(db,counterSubject(ctx.subject,cls),limit,now);
 if(cls==='studio'&&signInUnlocks(ctx,cfg))return {...usage,signInLimit:cfg.freeDailyStudio,signInRequired:usage.remaining===0};
 return usage;
}
const ANON_STUDIO='#anon-studio';
const clientIP=request=>request.headers.get('cf-connecting-ip')||'';
async function me(request,ctx,cfg,db,now){
 const [usage,studio]=ctx.plan==='pro'?[null,null]:await Promise.all([counter(ctx,cfg,db,now,'heavy'),counter(ctx,cfg,db,now,'studio')]);
 // Signed offline allowance: only for Free identities, never more than what is left today.
 let grace;
 if(ctx.plan!=='pro'&&cfg.graceExports>0){
  grace={day:quotaDay(now),heavy:await graceTokens(cfg.secret,ctx.subject,'heavy',now,Math.min(cfg.graceExports,usage.remaining)),
   studio:await graceTokens(cfg.secret,ctx.subject,'studio',now,Math.min(cfg.graceExports,studio.remaining))};
 }
 // Distinct networks per signed-in account per day (aggregate sharing signal; admin stats).
 if(ctx.user){
  const nets=await networkSubjects(clientIP(request),cfg.secret,now);
  if(nets)try{await db.prepare('INSERT INTO account_activity(user_id,day,network,pro) VALUES(?1,?2,?3,?4) ON CONFLICT DO NOTHING').bind(ctx.user.id,quotaDay(now),nets.narrow,ctx.plan==='pro'?1:0).run();}catch{}
 }
 return {
  loggedIn:!!ctx.user,plan:ctx.plan,ads:ctx.plan!=='pro',usage:publicUsage(ctx.plan,usage),studioUsage:publicUsage(ctx.plan,studio),
  ...(ctx.user?{user:{name:ctx.user.display_name||'',email:ctx.user.email||''},subscription:ctx.subscription}:{}),
  ...(grace?{grace}:{}),
  billing:{mode:cfg.billing.mode,yearly:!!cfg.billing.prices.year},
  turnstileSiteKey:cfg.turnstile.siteKey&&cfg.turnstile.secret?cfg.turnstile.siteKey:''
 };
}
/** A solved Turnstile check is bound to the identity that solved it (the account when signed
 * in, else the anonymous id), so one solve cannot vouch for a row of farmed accounts. */
async function humanFor(ctx,cfg,now){
 const value=await unsign(cfg.secret,'human/v1',ctx.cookies[HUMAN_COOKIE]);
 if(!value)return false;const i=value.lastIndexOf('~'),id=value.slice(0,i),exp=value.slice(i+1);
 return id===ctx.subject&&Number(exp)>now;
}
async function rateLimit(request,ctx,env,deps,cfg,now,route,nets){
 const key=`${route}|${nets?.narrow||'a:'+ctx.anonId}`;
 if(!await allowRequest({env,limiter:deps.limiter,key,limit:cfg.ratePerMinute,now})){
  await bumpEvent(env.DB,now,'rate_limited');
  throw new ApiError('RATE_LIMITED','Too many requests. Please wait a minute.',{retryAfter:60});
 }
}
/** Network caps for Free identities (anonymous AND signed-in): a hard daily ceiling per network
 * and per surrounding /24 or /48, and a Turnstile check past the soft limit. */
async function networkGate(request,ctx,cfg,db,now,deps,nets,body,cls){
 if(!nets)return;
 const [narrow,wide]=await Promise.all([networkUsage(db,nets.narrow,now),networkUsage(db,nets.wide,now)]);
 if(narrow>=cfg.networkHardLimit||wide>=cfg.networkWideLimit){
  await bumpEvent(db,now,'network_limit');
  throw new ApiError('NETWORK_LIMIT','Free usage from this network is paused until the daily reset.',{},{allowed:false,reason:'network_limit',kind:cls,resetAt:resetAt(now)});
 }
 if(cfg.turnstile.secret&&narrow>=cfg.networkSoftLimit&&!(await humanFor(ctx,cfg,now))){
  if(!body.turnstileToken)throw new ApiError('CHALLENGE_REQUIRED','Please confirm you are human.',{siteKey:cfg.turnstile.siteKey});
  const ok=await verifyTurnstile({token:body.turnstileToken,secret:cfg.turnstile.secret,ip:clientIP(request),expectedAction:'quota',hostname:ctx.url.hostname},deps.fetch);
  if(!ok)throw new ApiError('CHALLENGE_FAILED');
  ctx.setCookies.push(cookie(HUMAN_COOKIE,await sign(cfg.secret,'human/v1',`${ctx.subject}~${now+HUMAN_TTL_MS}`),{maxAge:HUMAN_TTL_MS/1000,secure:ctx.secure}));
 }
}
async function authorize(request,ctx,cfg,env,now,deps){
 const db=env.DB;
 const body=fields(await readJSON(request,1024),['operationId','toolId','turnstileToken']);
 if(!UUID.test(body.operationId||''))throw new ApiError('INVALID_OPERATION','operationId must be a UUID.');
 const cls=quotaClass(body.toolId);
 if(!cls)throw new ApiError('UNKNOWN_TOOL');
 if(cls!=='heavy'&&cls!=='studio')throw new ApiError('NOT_METERED','This tool does not use the daily limit.');
 if(ctx.plan==='pro')return {allowed:true,unlimited:true,plan:'pro'};
 const nets=await networkSubjects(clientIP(request),cfg.secret,now);
 await rateLimit(request,ctx,env,deps,cfg,now,'authorize',nets);
 await networkGate(request,ctx,cfg,db,now,deps,nets,body,cls);
 // Anonymous Studio exports are also counted per network: once a network has used its anonymous
 // share today, new anonymous identities there (cleared cookies, incognito) must sign in.
 const anonStudio=cls==='studio'&&!ctx.user,buckets=nets?[nets.narrow,nets.wide]:[];
 if(anonStudio&&nets){
  const [n,w]=await Promise.all([networkUsage(db,nets.narrow+ANON_STUDIO,now),networkUsage(db,nets.wide+ANON_STUDIO,now)]);
  if(n>=cfg.anonNetworkStudio||w>=cfg.anonWideStudio){
   const own=await usageFor(db,counterSubject(ctx.subject,cls),cfg.freeAnonStudio,now);
   await bumpEvent(db,now,'sign_in_required');
   throw new ApiError('SIGN_IN_REQUIRED','Sign in (free) to continue exporting today.',{},{allowed:false,reason:'sign_in',kind:cls,used:own.used,limit:cfg.freeAnonStudio,signInLimit:cfg.freeDailyStudio,remaining:0,resetAt:resetAt(now)});
  }
  buckets.push(nets.narrow+ANON_STUDIO,nets.wide+ANON_STUDIO);
 }
 // 'heavy' (file tools) and 'studio' (Studio exports) are separate counters of the same identity.
 const limit=cls==='studio'?studioLimitFor(ctx,cfg):limitFor(cfg,cls);
 const result=await authorizeJob(db,{subject:counterSubject(ctx.subject,cls),operationId:body.operationId.toLowerCase(),toolId:body.toolId,limit,now,networkSubjects:buckets});
 if(deps.ctx&&deps.random()<1/500)deps.ctx.waitUntil(db.batch(cleanupStatements(db,now)).catch(()=>{}));
 if(!result.allowed){
  if(cls==='studio'&&signInUnlocks(ctx,cfg)){
   await bumpEvent(db,now,'sign_in_required');
   throw new ApiError('SIGN_IN_REQUIRED','Sign in (free) to continue exporting today.',{},{allowed:false,reason:'sign_in',kind:cls,used:result.used,limit:result.limit,signInLimit:cfg.freeDailyStudio,remaining:0,resetAt:result.resetAt});
  }
  await bumpEvent(db,now,'daily_limit');
  throw new ApiError('DAILY_LIMIT',undefined,{},{allowed:false,reason:'daily_limit',kind:cls,used:result.used,limit:result.limit,remaining:0,resetAt:result.resetAt});
 }
 return {...result,plan:'free',kind:cls};
}
/** The page spent signed offline tokens while the service was unreachable; charge each exactly
 * once (idempotent per token). Forged, foreign or stale tokens are counted as abuse signals. */
async function reconcile(request,ctx,cfg,env,now,deps){
 const db=env.DB;
 const body=fields(await readJSON(request,2048),['tokens']);
 const tokens=[...new Set(String(body.tokens||'').split(',').map(s=>s.trim()).filter(Boolean))].slice(0,20);
 if(ctx.plan==='pro')return {charged:0,invalid:0};
 const nets=await networkSubjects(clientIP(request),cfg.secret,now);
 await rateLimit(request,ctx,env,deps,cfg,now,'reconcile',nets);
 let charged=0,invalid=0;
 for(const token of tokens){
  const g=await readGraceToken(cfg.secret,ctx.subject,token,now,cfg.graceExports);
  if(!g){invalid++;continue;}
  const r=await authorizeJob(db,{subject:counterSubject(ctx.subject,g.cls),operationId:`grace-${quotaDay(now)}-${g.cls}-${g.i}`,toolId:`grace:${g.cls}`,limit:1e9,now,networkSubjects:nets?[nets.narrow,nets.wide]:[],replayWindow:Infinity});
  if(r.allowed&&!r.replay)charged++;
 }
 if(invalid)await bumpEvent(db,now,'grace_invalid');
 return {charged,invalid};
}
async function checkout(request,ctx,cfg,env,deps,now){
 const body=fields(await readJSON(request,4096),['turnstileToken','locale','interval']);
 if(!ctx.user)throw new ApiError('LOGIN_REQUIRED');
 if(ctx.user.flagged_at)throw new ApiError('ACCOUNT_FLAGGED','This account needs a review before a new purchase. Please contact support.');
 if(ctx.plan==='pro')throw new ApiError('ALREADY_PRO','You already have Nerulio Pro.');
 const provider=billingProvider(cfg);if(!provider)throw new ApiError('BILLING_UNAVAILABLE','Purchases are not available yet.');
 const interval=body.interval==='year'?'year':'month',priceId=cfg.billing.prices[interval];
 if(!priceId&&provider.name!=='sandbox')throw new ApiError('PRICE_UNAVAILABLE','This billing interval is not offered.');
 const nets=await networkSubjects(clientIP(request),cfg.secret,now);
 await rateLimit(request,ctx,env,deps,cfg,now,'checkout',nets);
 if(cfg.turnstile.secret){
  if(!body.turnstileToken)throw new ApiError('CHALLENGE_REQUIRED','Please confirm you are human.',{siteKey:cfg.turnstile.siteKey});
  if(!await verifyTurnstile({token:body.turnstileToken,secret:cfg.turnstile.secret,ip:clientIP(request),expectedAction:'checkout',hostname:ctx.url.hostname},deps.fetch))throw new ApiError('CHALLENGE_FAILED');
 }
 // Return to the host the buyer is on (already same-origin checked), not a configured one.
 const origin=ctx.url.origin,{url}=await provider.createCheckout({user:ctx.user,cfg,env,origin,priceId,interval,fetcher:deps.fetch});
 const target=new URL(url,origin);
 if(target.protocol!=='https:'&&target.origin!==origin)throw new ApiError('UPSTREAM_FAILED');
 return {url:target.href,mode:cfg.billing.mode,interval};
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
/** Aggregate counts only. There is nothing per-file to show: no file data reaches the server.
 * The sharing list names opaque account ids only (for an operator to review), never networks. */
async function adminStats(ctx,cfg,db,now){
 const u=ctx.user;
 // Unknown to non-admins (404), and admins must have signed in within the last 12 hours.
 if(!u||!cfg.adminSubjects.includes(u.provider_subject)||u.provider!=='google'||now-Number(u.session_created)>12*3600e3)throw new ApiError('NOT_FOUND');
 const day=quotaDay(now),since=now-864e5;
 const [users,pro,usage,jobs,events,flags,refusals,sharing,pastDue]=await db.batch([
  db.prepare('SELECT COUNT(*) n FROM users'),
  db.prepare(`SELECT COUNT(DISTINCT user_id) n FROM subscriptions WHERE plan='pro' AND disputed_at IS NULL AND ((status IN ('active','trialing','canceled') AND current_period_end>?1) OR (status='past_due' AND past_due_since>?2))`).bind(now,now-cfg.pastDueGraceDays*864e5),
  db.prepare(`SELECT COALESCE(SUM(CASE WHEN subject_id LIKE ?2 THEN 0 ELSE used END),0) n,COALESCE(SUM(CASE WHEN subject_id LIKE ?2 THEN used ELSE 0 END),0) studio FROM daily_usage WHERE day=?1 AND subject_id NOT LIKE 'n:%' AND subject_id NOT LIKE 'w:%'`).bind(day,'%'+STUDIO_SUBJECT_SUFFIX),
  db.prepare('SELECT COALESCE(SUM(allowed=0),0) denied,COUNT(*) total FROM job_authorizations WHERE created_at>=?1').bind(Date.parse(day)),
  db.prepare(`SELECT COALESCE(SUM(state='ignored'),0) ignored,COUNT(*) total FROM billing_events WHERE processed_at>=?1`).bind(since),
  db.prepare('SELECT COUNT(*) n FROM users WHERE flagged_at IS NOT NULL'),
  db.prepare('SELECT kind,n FROM daily_events WHERE day=?1').bind(day),
  db.prepare('SELECT user_id,COUNT(*) networks,MAX(pro) pro FROM account_activity WHERE day=?1 GROUP BY user_id HAVING COUNT(*)>=?2 ORDER BY networks DESC LIMIT 20').bind(day,cfg.sharingNetworks),
  db.prepare(`SELECT COUNT(*) n FROM subscriptions WHERE status='past_due'`)
 ]);
 return {day,users:users.results[0].n,proActive:pro.results[0].n,freeHeavyJobsToday:usage.results[0].n,freeStudioExportsToday:usage.results[0].studio,authorizationsToday:jobs.results[0].total,deniedToday:jobs.results[0].denied,
  refusalsToday:Object.fromEntries(refusals.results.map(r=>[r.kind,r.n])),flaggedAccounts:flags.results[0].n,pastDueSubscriptions:pastDue.results[0].n,
  sharingSuspects:sharing.results.map(r=>({userId:r.user_id,networks:r.networks,pro:!!r.pro})),sharingThreshold:cfg.sharingNetworks,
  billingEvents24h:events.results[0].total,billingEventsIgnored24h:events.results[0].ignored,billing:cfg.billing.mode,environment:cfg.environment};
}
const ROUTES={
 'GET /health':1,'GET /me':1,'GET /usage':1,'POST /jobs/authorize':1,'POST /jobs/reconcile':1,'GET /auth/google/start':1,'GET /auth/google/callback':1,
 'POST /auth/logout':1,'POST /billing/checkout':1,'POST /billing/portal':1,'POST /billing/webhook':1,'GET /admin/stats':1,'POST /admin/cleanup':1
};
export async function handleApi(request,env={},ctx=null,deps={}){
 deps={fetch:deps.fetch||((...a)=>fetch(...a)),now:deps.now||Date.now,random:deps.random||Math.random,limiter:deps.limiter,ctx};
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
   return json({ok:true,api:API_VERSION,environment:cfg.environment,configured:cfg.configured,database,billing:cfg.billing.mode,google:!!(cfg.google.clientId&&cfg.google.clientSecret),turnstile:!!(cfg.turnstile.siteKey&&cfg.turnstile.secret),
    ...(cfg.environmentOverrideRefused?{warning:'NERULIO_ENV=development is ignored on this build'}:{})});
  }
  if(!cfg.configured)throw new ApiError('SERVICE_NOT_CONFIGURED');
  if(key==='POST /billing/webhook')return json(await webhook(request,cfg,db,env,now));
  if(request.method==='POST')assertSameOrigin(request,cfg);
  context=await resolveContext(request,cfg,db,now);
  const done=(body,status=200)=>json(body,status,{'Set-Cookie':context.setCookies});
  switch(key){
   case 'GET /me':return done(await me(request,context,cfg,db,now));
   case 'GET /usage':{
    if(context.plan==='pro')return done({plan:'pro',usage:{unlimited:true},studioUsage:{unlimited:true}});
    const [usage,studioUsage]=await Promise.all([counter(context,cfg,db,now,'heavy'),counter(context,cfg,db,now,'studio')]);
    return done({plan:context.plan,usage,studioUsage});
   }
   case 'POST /jobs/authorize':return done(await authorize(request,context,cfg,env,now,deps));
   case 'POST /jobs/reconcile':return done(await reconcile(request,context,cfg,env,now,deps));
   case 'GET /auth/google/start':{
    await rateLimit(request,context,env,deps,cfg,now,'signin',await networkSubjects(clientIP(request),cfg.secret,now));
    return await startLogin(context,cfg,now);
   }
   case 'GET /auth/google/callback':return await finishLogin(context,cfg,db,now,deps.fetch);
   case 'POST /auth/logout':context.setCookies.push(await logout(context,db,now));return done({loggedIn:false});
   case 'POST /billing/checkout':return done(await checkout(request,context,cfg,env,deps,now));
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
