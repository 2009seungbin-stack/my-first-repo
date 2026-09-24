/** Red-team harness (docs/MONETIZATION-SECURITY.md): attacks on the account service API, run
 * in-process against server/api.js with an isolated in-memory D1 (tests/d1-shim.mjs).
 * Verdicts: BLOCKED (attack stopped or bounded as designed), ACCEPTED (still possible, documented
 * as an accepted residual), PARTIAL / WORKS (a bypass that should not exist — a regression).
 * `node tests/redteam/api-attacks.mjs` prints every row and writes test-results/redteam/api.json;
 * it exits 1 if any row is WORKS or PARTIAL. tests/redteam.test.mjs runs it in `npm test`.
 * Never contacts a real service: outbound fetch throws. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {D1Shim} from '../d1-shim.mjs';
import {handleApi} from '../../server/api.js';
import {runtimeConfig} from '../../server/config.js';
import {createLimiter} from '../../server/ratelimit.js';
import {sha256,base64url,hmacHex,sign} from '../../server/crypto.js';
import {signSandbox,SANDBOX_SIGNATURE} from '../../server/billing/sandbox.js';
import {carryOverStatements} from '../../server/usage.js';
import {readAnon} from '../../server/identity.js';

const ORIGIN='https://nerulio.test';
const SECRET='redteam-session-secret-0123456789abcdef-0123456789';
const DAY0=Date.UTC(2026,8,24,10,0,0);
const uuid=()=>crypto.randomUUID();
export const results=[];
function record(id,title,verdict,evidence){results.push({id,title,verdict,evidence});if(!process.env.REDTEAM_QUIET)console.log(`${verdict.padEnd(8)} ${id} ${title}\n         ${JSON.stringify(evidence)}`);}

/** One isolated deployment. Every request advances the clock by `step` ms so a script spread
 * over minutes is modelled (the per-minute burst limiter is attacked separately in A13). */
function harness(envExtra={},{now=DAY0,step=1500}={}){
 const db=D1Shim.migrated(),clock={now},limiter=createLimiter();
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,FREE_DAILY_STUDIO_EXPORTS:'10',...envExtra};
 let writes=0;const batch=db.batch.bind(db);db.batch=async s=>{const r=await batch(s);writes+=r.reduce((n,x)=>n+(x.meta?.changes||0),0);return r;};
 const h={db,env,clock,get writes(){return writes;},step,
  browser(ip='203.0.113.7'){
   const jar={};
   const b={jar,ip,
    async call(method,path,{body,headers={},origin=ORIGIN,raw,noCookies=false}={}){
     h.clock.now+=h.step;
     const hd=new Headers(headers);
     if(!noCookies&&Object.keys(jar).length)hd.set('cookie',Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '));
     if(method==='POST'&&origin&&!hd.has('origin'))hd.set('origin',origin);
     if(b.ip&&!hd.has('cf-connecting-ip'))hd.set('cf-connecting-ip',b.ip);
     if((body!==undefined||raw!==undefined)&&!hd.has('content-type'))hd.set('content-type','application/json');
     const request=new Request(ORIGIN+path,{method,headers:hd,body:raw??(body!==undefined?JSON.stringify(body):undefined),redirect:'manual'});
     const response=await handleApi(request,env,{waitUntil(){}},{now:()=>clock.now,random:()=>0.5,limiter,fetch:async()=>{throw Error('no outbound fetch in red-team runs');}});
     for(const c of response.headers.getSetCookie()){const [pair]=c.split(';'),i=pair.indexOf('='),k=pair.slice(0,i),v=pair.slice(i+1);if(/Max-Age=0/.test(c))delete jar[k];else jar[k]=v;}
     const text=await response.text();let json=null;try{json=JSON.parse(text);}catch{}
     return {status:response.status,json,code:json?.error?.code||''};
    },
    export(toolId='studio-pack-export',operationId=uuid(),extra={}){return b.call('POST','/api/v1/jobs/authorize',{body:{operationId,toolId,...extra}});},
    me(){return b.call('GET','/api/v1/me');}
   };
   return b;
  }
 };
 return h;
}
async function createUser(h,subject){
 const id=base64url(crypto.getRandomValues(new Uint8Array(16)));
 await h.db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,?2,'RT','google',?3,?4)").bind(id,subject+'@example.test',subject,h.clock.now).run();
 return id;
}
async function newSession(h,userId,at=h.clock.now){
 const token=base64url(crypto.getRandomValues(new Uint8Array(32)));
 await h.db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),userId,at,at+30*864e5).run();
 return token;
}
const allowed=r=>r.status===200&&r.json?.allowed===true;
async function exhaust(b,n=10,tool='studio-pack-export'){let ok=0,last='';for(let i=0;i<n;i++){const r=await b.export(tool);if(allowed(r))ok++;else last=r.code;}return {ok,last};}
const codes=rs=>rs.reduce((m,r)=>(m[r]=(m[r]||0)+1,m),{});

// ---------------------------------------------------------------- A1 identity reset
{
 const h=harness(),cfg=runtimeConfig(h.env);let total=0;const refusals=[];
 for(let i=0;i<50;i++){const b=h.browser();const r=await exhaust(b,4);total+=r.ok;if(r.last)refusals.push(r.last);}
 record('A1','Clear cookies / incognito / 2nd browser on one network: fresh anonymous ids share the network\'s anonymous Studio allowance, then must sign in (free)',
  total<=cfg.anonNetworkStudio&&refusals.at(-1)==='SIGN_IN_REQUIRED'?'BLOCKED':'WORKS',{freshBrowsers:50,anonPerIdentity:cfg.freeAnonStudio,anonPerNetwork:cfg.anonNetworkStudio,studioExportsAllowed:total,refusals:codes(refusals)});
}
{
 const h=harness({TURNSTILE_SITE_KEY:'1x-site',TURNSTILE_SECRET_KEY:'1x-secret'}),cfg=runtimeConfig(h.env);
 let total=0,challengedAt=null;
 for(let i=0;i<40&&challengedAt===null;i++){const b=h.browser('203.0.113.7');for(let j=0;j<31;j++){const r=await b.export('upscale');if(allowed(r))total++;else if(r.code==='CHALLENGE_REQUIRED'){challengedAt=total;break;}}}
 record('A1b','Fresh cookies on one IPv4 for file-tool heavy jobs: a script without a human is stopped at the network soft limit (Turnstile)',challengedAt!==null&&challengedAt<=cfg.networkSoftLimit?'BLOCKED':'WORKS',{softLimit:cfg.networkSoftLimit,heavyJobsBeforeChallenge:challengedAt,hardLimit:cfg.networkHardLimit});
}
{
 const h=harness(),cfg=runtimeConfig(h.env);let v4=0,v6=0;const r4=[],r6=[];
 for(let i=0;i<60;i++){const r=await exhaust(h.browser(`198.51.100.${i+1}`),4);v4+=r.ok;if(r.last)r4.push(r.last);}
 for(let i=0;i<60;i++){const r=await exhaust(h.browser(`2001:db8:77:${(i+1).toString(16)}::1`),4);v6+=r.ok;if(r.last)r6.push(r.last);}
 record('A1c','VPN / address rotation inside one /24 (IPv4) or one /48 (IPv6): bounded by the wide network bucket, then sign-in',v4<=cfg.anonWideStudio&&v6<=cfg.anonWideStudio?'BLOCKED':'WORKS',
  {ipv4InOne24:60,ipv4Exports:v4,ipv6Slash64sInOne48:60,ipv6Exports:v6,wideCap:cfg.anonWideStudio,refusals:codes([...r4,...r6])});
 const h2=harness();let spread=0;for(let i=0;i<40;i++)spread+=(await exhaust(h2.browser(`10.${i+1}.${i+2}.9`),4)).ok;
 record('A1d','Residential-proxy pool (every request from a different /24): 3 anonymous exports per network, never more — cannot be tied together without fingerprinting',spread===40*cfg.freeAnonStudio?'ACCEPTED':'WORKS',{networks:40,exports:spread,perNetwork:cfg.freeAnonStudio,note:'accepted residual: each extra 3 costs a fresh network; signed-in use costs a Google account'});
}
// ---------------------------------------------------------------- A2 idempotency replay
{
 const h=harness(),b=h.browser();
 const u=await createUser(h,'replayer');b.jar.nerulio_session=await newSession(h,u);
 const first=uuid();await b.export('studio-pack-export',first);
 await exhaust(b,9);const denied=await b.export();
 const replays=[];for(let i=0;i<3;i++)replays.push(await b.export('studio-pack-export',first));
 const me=await b.me();
 record('A2','Replay an earlier allowed operationId within the 10-minute retry window: returns the ORIGINAL decision flagged replay, never a new count',replays.every(r=>r.json?.replay===true)&&me.json.studioUsage.used===10?'ACCEPTED':'WORKS',
  {deniedStatus:denied.status,replayFlags:replays.map(r=>r.json?.replay),usedAfterReplays:me.json.studioUsage.used,note:'by design (lost-response retry); the replay re-confirms an export that was already counted'});
 const conflict=await b.export('studio-tile-export',first);
 record('A2b','Replay an operationId for a different action',conflict.status===409?'BLOCKED':'WORKS',{status:conflict.status,code:conflict.code});
 h.clock.now+=11*60e3;const old=await b.export('studio-pack-export',first);
 record('A2c','Replay an allowed operationId after the retry window (e.g. days later)',old.code==='OPERATION_EXPIRED'?'BLOCKED':'WORKS',{status:old.status,code:old.code});
}
// ---------------------------------------------------------------- A3 race at the limit
{
 const h=harness(),b=h.browser();const u=await createUser(h,'racer');b.jar.nerulio_session=await newSession(h,u);await exhaust(b,9);
 const rs=await Promise.all(Array.from({length:30},()=>b.export()));const me=await b.me();
 record('A3','30 parallel exports at 9/10 (distinct operationIds, one identity)',rs.filter(allowed).length===1&&me.json.studioUsage.used===10?'BLOCKED':'WORKS',{allowed:rs.filter(allowed).length,used:me.json.studioUsage.used});
}
// ---------------------------------------------------------------- A4 forged request bodies
{
 const h=harness(),b=h.browser();
 const cases={unknownTool:{operationId:uuid(),toolId:'studio-everything'},lightTool:{operationId:uuid(),toolId:'studio-save-project'},suffixInjection:{operationId:uuid(),toolId:'studio-pack-export#studio'},
  protoKey:{operationId:uuid(),toolId:'__proto__'},extraField:{operationId:uuid(),toolId:'studio-pack-export',used:'-5'},subjectField:{operationId:uuid(),toolId:'studio-pack-export',subject:'u:victim'},
  numericOp:{operationId:12345,toolId:'studio-pack-export'},notUuid:{operationId:'x'.repeat(36),toolId:'studio-pack-export'},arrayTool:{operationId:uuid(),toolId:['studio-pack-export']},
  graceToolId:{operationId:uuid(),toolId:'grace:studio'}};
 const out={};for(const [k,body]of Object.entries(cases)){const r=await b.call('POST','/api/v1/jobs/authorize',{body});out[k]=r.status+' '+r.code+(r.json?.allowed?' ALLOWED':'');}
 out.jsonArray=(await b.call('POST','/api/v1/jobs/authorize',{raw:'[]'})).code;
 out.oversize=(await b.call('POST','/api/v1/jobs/authorize',{raw:JSON.stringify({operationId:uuid(),toolId:'studio-pack-export',turnstileToken:'x'.repeat(5000)})})).code;
 const me=await b.me();
 record('A4','Forged bodies: unknown/light/grace tool ids, #studio suffix injection, negative "used", foreign subject, wrong types, oversize',Object.values(out).some(v=>String(v).includes('ALLOWED'))||me.json.studioUsage.used!==0?'WORKS':'BLOCKED',{...out,studioUsedAfter:me.json.studioUsage.used});
 const cfg=['0','-1','1e9','99999999999999999999','NaN','10.5'].map(v=>[v,runtimeConfig({FREE_DAILY_STUDIO_EXPORTS:v}).freeDailyStudio,runtimeConfig({FREE_ANON_STUDIO_EXPORTS:v}).freeAnonStudio]);
 record('A4b','Negative / overflow / non-integer limits fall back to defaults (anonymous 0 is allowed: "always sign in")',cfg.every(([v,n,a])=>n===10&&(v==='0'?a===0:a===3))?'BLOCKED':'WORKS',{cfg});
}
// ---------------------------------------------------------------- A5 cookie / session tampering
{
 const h=harness(),victim=h.browser();await exhaust(victim,3);
 const forger=h.browser();forger.jar.nerulio_anon=base64url(crypto.getRandomValues(new Uint8Array(16))).slice(0,22)+'.AAAA';
 const r=await forger.me();
 record('A5','Forged / unsigned nerulio_anon cookie is replaced (cannot choose or reset an id)',forger.jar.nerulio_anon.endsWith('.AAAA')?'WORKS':'BLOCKED',{newCookieIssued:!forger.jar.nerulio_anon.endsWith('.AAAA'),studioUsed:r.json.studioUsage.used});
 const clone=h.browser();Object.assign(clone.jar,victim.jar);const c=await clone.export();
 record('A5b','Restoring a backed-up cookie jar (or sharing one cookie) does not reset the counter',allowed(c)?'WORKS':'BLOCKED',{status:c.status,code:c.code});
 const guess=h.browser();guess.jar.nerulio_session=base64url(crypto.getRandomValues(new Uint8Array(32)));const g=await guess.me();
 record('A5c','Guessed/forged session token',g.json.loggedIn?'WORKS':'BLOCKED',{loggedIn:g.json.loggedIn,plan:g.json.plan,staleCookieCleared:!('nerulio_session'in guess.jar)});
 const d=h.browser('192.0.2.50');await exhaust(d,3);d.jar.nerulio_session=base64url(crypto.getRandomValues(new Uint8Array(32)));const dm=await d.me();
 record('A5d','Stale session cookie + used anonymous cookie: /me reports the real anonymous counter',dm.json.studioUsage.used===3&&dm.json.studioUsage.remaining===0?'BLOCKED':'PARTIAL',{meUsed:dm.json.studioUsage.used,meRemaining:dm.json.studioUsage.remaining});
 const w=await harness({SESSION_SECRET:'short-secret'}).browser().me();
 record('A5e','SESSION_SECRET shorter than 32 chars disables the service instead of running weak',w.status===503?'BLOCKED':'WORKS',{status:w.status,code:w.code});
 const h2=harness(),rb=h2.browser();await exhaust(rb,3);
 h2.env.SESSION_SECRET_PREVIOUS=SECRET;h2.env.SESSION_SECRET=SECRET+'-rotated';const after=await rb.export();
 record('A5f','Rotating SESSION_SECRET with SESSION_SECRET_PREVIOUS set keeps every anonymous counter (cookie re-signed)',!allowed(after)&&after.code==='SIGN_IN_REQUIRED'?'BLOCKED':'WORKS',{afterRotation:after.code,reSigned:!!rb.jar.nerulio_anon,note:'rotating WITHOUT SESSION_SECRET_PREVIOUS still resets anonymous counters (documented in CLOUDFLARE.md)'});
}
// ---------------------------------------------------------------- A6 CSRF / origin
{
 const h=harness(),b=h.browser();
 const hit=async(headers,opts={})=>{const r=await b.call('POST','/api/v1/jobs/authorize',{body:{operationId:uuid(),toolId:'studio-pack-export'},headers,...opts});return r.status+' '+(r.code||'ok');};
 const out={evilOrigin:await hit({origin:'https://evil.test'}),crossSite:await hit({'sec-fetch-site':'cross-site'},{origin:null}),sameSiteSibling:await hit({'sec-fetch-site':'same-site',origin:'https://preview.nerulio.test'}),
  noOriginNoFetchSite:await hit({},{origin:null}),textPlain:await hit({'content-type':'text/plain'}),nullOrigin:await hit({origin:'null'})};
 for(const path of ['/api/v1/auth/logout','/api/v1/jobs/reconcile'])out[path]=(await b.call('POST',path,{body:path.endsWith('reconcile')?{tokens:''}:{},headers:{origin:'https://evil.test'}})).code;
 record('A6','CSRF on state-changing endpoints (authorize, reconcile, logout)',Object.values(out).some(v=>String(v).endsWith('ok'))?'WORKS':'BLOCKED',out);
 const scripted=await hit({origin:ORIGIN,'sec-fetch-site':'same-origin'});
 record('A6b','A script sends Origin + Sec-Fetch-Site and is accepted — CSRF checks are not bot checks',scripted.endsWith('ok')?'ACCEPTED':'BLOCKED',{status:scripted,note:'bots are handled by the quota, network buckets, Turnstile and the rate limiter'});
}
// ---------------------------------------------------------------- A7 sign-in carry-over / logout / farming
{
 const h=harness(),b=h.browser();await exhaust(b,3);
 const uidA=await createUser(h,'acct-a');const aid=await readAnon(b.jar.nerulio_anon,SECRET);
 await h.db.batch(carryOverStatements(h.db,`a:${aid}`,`u:${uidA}`,h.clock.now));
 b.jar.nerulio_session=await newSession(h,uidA);
 const afterLogin=await exhaust(b,10);
 record('A7','Anonymous 3/3, then sign in: the counter carries over, the account continues to 10 in total (sign-in is not a reset)',afterLogin.ok===7&&afterLogin.last==='DAILY_LIMIT'?'BLOCKED':'WORKS',{exportsAfterSignIn:afterLogin.ok,then:afterLogin.last});
 const h2=harness(),c=h2.browser();await c.me();
 const uidB=await createUser(h2,'acct-b');c.jar.nerulio_session=await newSession(h2,uidB);
 const asUser=await exhaust(c,11);
 await c.call('POST','/api/v1/auth/logout',{body:{}});
 const asAnon=await exhaust(c,4);
 record('A7b','Use the account\'s allowance, sign out, continue anonymously: the counter moves back to the browser (no second allowance)',asAnon.ok===0?'BLOCKED':'WORKS',{exportsAsUser:asUser.ok,exportsAsAnonAfterLogout:asAnon.ok,refusal:asAnon.last});
 const h3=harness({TURNSTILE_SITE_KEY:'1x-site',TURNSTILE_SECRET_KEY:'1x-secret'}),cfg3=runtimeConfig(h3.env);let farm=0;const fr=[];
 for(let i=0;i<30;i++){const u=await createUser(h3,'farm-'+i),fb=h3.browser();fb.jar.nerulio_session=await newSession(h3,u);const r=await exhaust(fb,10);farm+=r.ok;if(r.last)fr.push(r.last);}
 record('A7c','Account farming from one network (30 Google accounts, unattended): after the soft limit every account must pass its own human check',farm<=cfg3.networkSoftLimit+10?'BLOCKED':'WORKS',{accounts:30,exportsAllowed:farm,softLimit:cfg3.networkSoftLimit,refusals:codes(fr)});
 const h4=harness(),cfg4=runtimeConfig(h4.env);let farm4=0;
 for(let i=0;i<30;i++){const u=await createUser(h4,'farm-'+i),fb=h4.browser();fb.jar.nerulio_session=await newSession(h4,u);farm4+=(await exhaust(fb,10)).ok;}
 record('A7d','The same WITHOUT Turnstile keys: only the hard network cap applies — Turnstile keys are a required setup step',farm4<=cfg4.networkHardLimit?'ACCEPTED':'WORKS',{accounts:30,exportsAllowed:farm4,hardLimit:cfg4.networkHardLimit,note:'bounded by NETWORK_DAILY_HARD_LIMIT; set TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY before turning accounts on'});
}
// ---------------------------------------------------------------- A8 time
{
 const h=harness({},{step:0}),b=h.browser();await exhaust(b,3);
 const hdr=await b.call('POST','/api/v1/jobs/authorize',{body:{operationId:uuid(),toolId:'studio-pack-export'},headers:{date:'Wed, 01 Jan 2031 00:00:00 GMT'}});
 h.clock.now=Date.UTC(2026,8,24,23,59,59,999);const edge=await b.export();
 h.clock.now=Date.UTC(2026,8,25,0,0,0,0);const next=await b.export();
 record('A8','Time manipulation: the day is the Worker\'s UTC clock; client Date headers are ignored; reset exactly at 00:00 UTC',!allowed(hdr)&&!allowed(edge)&&allowed(next)?'BLOCKED':'WORKS',{clientDateHeader:hdr.code,beforeMidnight:edge.code,afterMidnight:next.status});
}
// ---------------------------------------------------------------- A9 Pro forging via billing
{
 const env={BILLING_PROVIDER:'sandbox',BILLING_WEBHOOK_SECRET:'whsec-redteam'};
 const h=harness(env,{step:0}),b=h.browser();const uid=await createUser(h,'victim-pro');b.jar.nerulio_session=await newSession(h,uid);
 const ev=(o={})=>({id:'evt-'+uuid(),type:'subscription.updated',occurredAt:new Date(h.clock.now).toISOString(),data:{subscriptionId:'sub-1',customerId:'cus-1',userId:uid,plan:'pro',status:'active',currentPeriodEnd:new Date(h.clock.now+30*864e5).toISOString(),cancelAtPeriodEnd:false,...o}});
 const post=async(body,sig)=>b.call('POST','/api/v1/billing/webhook',{raw:body,origin:null,headers:sig===undefined?{}:{[SANDBOX_SIGNATURE]:sig},noCookies:true});
 const ts=()=>Math.floor(h.clock.now/1000),out={};
 let body=JSON.stringify(ev());
 out.unsigned=(await post(body)).status;
 out.wrongSecret=(await post(body,await signSandbox('guess',body,ts()))).status;
 out.staleTimestamp=(await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,ts()-600))).status;
 const okSig=await signSandbox(env.BILLING_WEBHOOK_SECRET,body,ts());
 out.bodyTampered=(await post(body.replace('"active"','"trialing"'),okSig)).status;
 out.validOnce=(await post(body,okSig)).json;out.replayWithin5min=(await post(body,okSig)).json;
 record('A9','Forging Pro through the webhook: unsigned, wrong secret, stale timestamp, tampered body, replay',out.unsigned===401&&out.wrongSecret===401&&out.staleTimestamp===401&&out.bodyTampered===401&&out.replayWithin5min.duplicate===true?'BLOCKED':'WORKS',out);
 h.clock.now+=60e3;body=JSON.stringify(ev({status:'paused'}));await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,ts()));
 const oldActive=ev();oldActive.occurredAt=new Date(h.clock.now-30e3).toISOString();body=JSON.stringify(oldActive);await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,ts()));
 const plan=(await b.me()).json.plan;
 record('A9b','Out-of-order delivery: an older "active" event after "paused" does not resurrect Pro',plan==='free'?'BLOCKED':'WORKS',{plan});
 body=JSON.stringify(ev({userId:'no-such-user',subscriptionId:'sub-x'}));const ign=await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,ts()));
 const row=await h.db.prepare("SELECT state FROM billing_events ORDER BY processed_at DESC LIMIT 1").first();
 record('A9c','Signed event for an unknown user id is recorded as ignored, grants nothing',row.state==='ignored'?'BLOCKED':'WORKS',{response:ign.json,state:row.state});
 const pagesProd=runtimeConfig({NERULIO_ENV:'development',...env,DB:{},SESSION_SECRET:SECRET},{service:true,preview:false,pages:true});
 const local=runtimeConfig({NERULIO_ENV:'development',...env,DB:{},SESSION_SECRET:SECRET},{service:true,preview:false,pages:false});
 record('A9d','Production build on Cloudflare Pages + NERULIO_ENV=development: the variable is ignored, sandbox billing stays off',pagesProd.billing.mode==='off'&&pagesProd.environment==='production'?'BLOCKED':'WORKS',{pagesProductionBuild:pagesProd.billing.mode,environment:pagesProd.environment,warning:pagesProd.environmentOverrideRefused,localTestBuild:local.billing.mode});
}
{
 // Paddle: chargeback, refund, past_due, yearly price.
 const env={BILLING_PROVIDER:'paddle',BILLING_MODE:'sandbox',BILLING_API_KEY:'k',BILLING_WEBHOOK_SECRET:'pdl_whsec',BILLING_PRICE_ID:'pri_monthly_499',BILLING_PRICE_ID_YEARLY:'pri_yearly_4000'};
 const setup=async name=>{
  const h=harness(env,{step:0}),b=h.browser();const uid=await createUser(h,name);b.jar.nerulio_session=await newSession(h,uid);
  const post=async p=>{const body=JSON.stringify(p),t=Math.floor(h.clock.now/1000);return b.call('POST','/api/v1/billing/webhook',{raw:body,origin:null,noCookies:true,headers:{'paddle-signature':`ts=${t};h1=${await hmacHex(env.BILLING_WEBHOOK_SECRET,`${t}:${body}`)}`}});};
  const sub=(o={})=>({id:'sub_01',customer_id:'ctm_01',custom_data:{nerulio_user_id:uid},items:[{price:{id:'pri_monthly_499'}}],status:'active',current_billing_period:{ends_at:new Date(h.clock.now+30*864e5).toISOString()},scheduled_change:null,...o});
  let n=0;const send=(type,data)=>post({event_id:`evt_${name}_${++n}`,event_type:type,occurred_at:new Date(h.clock.now).toISOString(),data});
  await send('subscription.activated',sub());
  // Sessions last 30 days; tests that jump weeks ahead sign in again so only billing decides.
  const renew=async()=>{b.jar.nerulio_session=await newSession(h,uid);};
  return {h,b,uid,send,sub,renew};
 };
 {
  const {h,b,uid,send}=await setup('disputer');const before=(await b.me()).json.plan;h.clock.now+=3600e3;
  await send('adjustment.created',{id:'adj_1',action:'chargeback',status:'approved',subscription_id:'sub_01',customer_id:'ctm_01',transaction_id:'txn_1'});
  const after=(await b.me()).json;
  h.clock.now+=60e3;await send('subscription.updated',{id:'sub_01',customer_id:'ctm_01',custom_data:{nerulio_user_id:uid},items:[{price:{id:'pri_monthly_499'}}],status:'active',current_billing_period:{ends_at:new Date(h.clock.now+30*864e5).toISOString()}});
  const later=(await b.me()).json.plan;
  const flag=await h.db.prepare('SELECT flag_reason FROM users WHERE id=?1').bind(uid).first();
  const again=await b.call('POST','/api/v1/billing/checkout',{body:{interval:'month'}});
  record('A10','Chargeback / dispute: Pro revoked at once, account flagged, a later "active" event does not restore it, new checkout refused',before==='pro'&&after.plan==='free'&&later==='free'&&flag.flag_reason==='chargeback'&&again.code==='ACCOUNT_FLAGGED'?'BLOCKED':'WORKS',
   {planBefore:before,planAfterChargeback:after.plan,disputedShown:after.subscription?.disputed,planAfterLaterActiveEvent:later,flag:flag.flag_reason,checkout:again.code});
 }
 {
  const {h,b,send,sub,renew}=await setup('refunder');h.clock.now+=3600e3;
  await send('adjustment.created',{id:'adj_2',action:'refund',status:'approved',subscription_id:'sub_01',customer_id:'ctm_01'});
  h.clock.now+=60e3;await send('subscription.canceled',sub({status:'canceled',current_billing_period:null}));
  const during=(await b.me()).json.plan;h.clock.now+=31*864e5;await renew();const after=(await b.me()).json.plan;
  record('A10r','Voluntary refund + cancel: Pro until the paid period ends, then Free (owner policy)',during==='pro'&&after==='free'?'ACCEPTED':'WORKS',{planDuringPaidPeriod:during,planAfterPeriodEnd:after});
 }
 {
  const {h,b,send,sub,renew}=await setup('pastdue');h.clock.now+=31*864e5;await renew();
  await send('subscription.past_due',sub({status:'past_due',current_billing_period:{ends_at:new Date(h.clock.now-864e5).toISOString()}}));
  h.clock.now+=6*864e5;const day6=(await b.me()).json;
  h.clock.now+=864e5+60e3;const day8=(await b.me()).json.plan;
  record('A10b','past_due: Pro for the 7-day grace (PAST_DUE_GRACE_DAYS), then Free',day6.plan==='pro'&&day6.subscription.pastDue&&day8==='free'?'BLOCKED':'WORKS',{day6:day6.plan,graceEndsAt:day6.subscription.graceEndsAt,day8});
 }
 {
  const {paddle}=await import('../../server/billing/paddle.js');
  const n=id=>paddle.normalizeWebhook({event_id:'e',event_type:'subscription.activated',occurred_at:new Date().toISOString(),data:{id:'s',status:'active',items:[{price:{id}}]}},env).subscription.plan;
  const out={monthly:n('pri_monthly_499'),yearly:n('pri_yearly_4000'),unknown:n('pri_attacker_1')};
  record('A10c','Monthly and yearly prices are Pro; an unknown price id never is',out.monthly==='pro'&&out.yearly==='pro'&&out.unknown==='other'?'BLOCKED':'WORKS',out);
 }
}
// ---------------------------------------------------------------- A11 Pro session sharing
{
 const h=harness({},{step:0}),uid=await createUser(h,'pro-sharer'),cfg=runtimeConfig(h.env);
 await h.db.prepare("INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES('manual','m1',?1,'pro','active',?2,0,?3)").bind(uid,h.clock.now+30*864e5,h.clock.now).run();
 const token=await newSession(h,uid);let pro=0;
 for(let i=0;i<50;i++){const b=h.browser(`192.0.2.${i+1}`);b.jar.nerulio_session=token;if((await b.me()).json.plan==='pro')pro++;}
 // Sessions come from sign-ins; simulate 30 sign-ins through the callback's own cap statement.
 for(let i=0;i<30;i++){h.clock.now+=1000;await newSession(h,uid);await h.db.prepare('DELETE FROM sessions WHERE user_id=?1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=?1 ORDER BY created_at DESC,token_hash LIMIT ?2)').bind(uid,cfg.maxSessionsPerUser).run();}
 const n=(await h.db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?1').bind(uid).first()).n;
 const admin=await createUser(h,'admin-sub');const ab=h.browser();ab.jar.nerulio_session=await newSession(h,admin);
 h.env.ADMIN_GOOGLE_SUBJECTS='admin-sub';const stats=(await ab.call('GET','/api/v1/admin/stats')).json;
 const flagged=stats.sharingSuspects?.find(s=>s.userId===uid);
 record('A11','Pro sharing: one session cookie from 50 networks still works, but sessions are capped and the account is listed for review',n<=cfg.maxSessionsPerUser&&flagged?'ACCEPTED':'WORKS',{networksServedPro:pro,liveSessionsAfter30SignIns:n,cap:cfg.maxSessionsPerUser,adminSharingSuspect:flagged});
}
// ---------------------------------------------------------------- A12 admin
{
 const h=harness({ADMIN_GOOGLE_SUBJECTS:'admin-sub'},{step:0}),b=h.browser();
 const anon=await b.call('GET','/api/v1/admin/stats');
 const uid=await createUser(h,'someone');b.jar.nerulio_session=await newSession(h,uid);const user=await b.call('GET','/api/v1/admin/stats');
 const aid=await createUser(h,'admin-sub');const ab=h.browser();ab.jar.nerulio_session=await newSession(h,aid);h.clock.now+=13*3600e3;const stale=await ab.call('GET','/api/v1/admin/stats');
 record('A12','Admin stats/cleanup for anonymous, normal and stale-admin sessions',[anon,user,stale].every(r=>r.status===404)?'BLOCKED':'WORKS',{anonymous:anon.status,user:user.status,adminSessionOlderThan12h:stale.status});
}
// ---------------------------------------------------------------- A13 write amplification / burst
{
 const h=harness({},{step:0}),cfg=runtimeConfig(h.env);const st=[];
 for(let i=0;i<400;i++){const b=h.browser('203.0.113.99');st.push((await b.export('upscale')).code||'ok');}
 const c=codes(st);
 record('A13','Burst of 400 cookie-less authorize calls from one network within a minute (no WAF on *.pages.dev): the app-level limiter answers 429 before D1 is written',c.RATE_LIMITED>0&&(c.ok||0)<=cfg.ratePerMinute?'BLOCKED':'WORKS',{perMinute:cfg.ratePerMinute,results:c,d1RowChanges:h.writes,note:'stopgap per isolate; a WAF rate-limiting rule on a custom domain is the owner action'});
}
// ---------------------------------------------------------------- A14 Turnstile human cookie binding
{
 const h=harness({TURNSTILE_SITE_KEY:'k',TURNSTILE_SECRET_KEY:'s',ANON_NETWORK_DAILY_JOBS:'1'});
 const a=h.browser();await a.export('upscale');
 const idA=await readAnon(a.jar.nerulio_anon,SECRET);
 a.jar.nerulio_human=await sign(SECRET,'human/v1',`a:${idA}~${h.clock.now+3600e3}`);
 const bb=h.browser();bb.jar.nerulio_human=a.jar.nerulio_human;const r=await bb.export('upscale');
 const aOk=await a.export('upscale');
 const u=await createUser(h,'farm-x');const ub=h.browser();ub.jar.nerulio_anon=a.jar.nerulio_anon;ub.jar.nerulio_human=a.jar.nerulio_human;ub.jar.nerulio_session=await newSession(h,u);const ur=await ub.export('upscale');
 record('A14','A solved-challenge cookie vouches only for its own identity (not another anonymous id, not an account signed in on the same browser)',r.code==='CHALLENGE_REQUIRED'&&allowed(aOk)&&ur.code==='CHALLENGE_REQUIRED'?'BLOCKED':'WORKS',{otherAnonymousId:r.code,sameIdentity:aOk.status,accountOnSameBrowser:ur.code});
}
// ---------------------------------------------------------------- A15 offline grace tokens
{
 const h=harness(),b=h.browser();const before=(await b.me()).json.grace.studio.length;await b.export();const me=(await b.me()).json;const tokens=me.grace.studio;
 const forged=await b.call('POST','/api/v1/jobs/reconcile',{body:{tokens:'s1.AAAAAAAAAAAAAAAAAAAAAA,s9.BBBBBBBBBBBBBBBBBBBBBB'}});
 const other=h.browser('198.51.100.200');const stolen=await other.call('POST','/api/v1/jobs/reconcile',{body:{tokens:tokens.join(',')}});
 const first=await b.call('POST','/api/v1/jobs/reconcile',{body:{tokens:tokens.slice(0,2).join(',')}});
 const again=await b.call('POST','/api/v1/jobs/reconcile',{body:{tokens:tokens.slice(0,2).join(',')}});
 const after=(await b.me()).json;
 h.clock.now=Date.UTC(2026,8,25,1);const stale=await b.call('POST','/api/v1/jobs/reconcile',{body:{tokens:tokens.join(',')}});
 const freshIdentity=(await h.browser('198.51.100.201').me()).json.grace.studio.length;
 record('A15','Offline grace: none for a fresh identity; forged, foreign or yesterday\'s tokens are rejected; genuine ones are charged exactly once; never more than what is left',
  before===0&&freshIdentity===0&&forged.json.charged===0&&forged.json.invalid===2&&stolen.json.charged===0&&first.json.charged===2&&again.json.charged===0&&after.studioUsage.used===3&&after.grace.studio.length===0&&stale.json.charged===0?'BLOCKED':'WORKS',
  {tokensBeforeFirstJob:before,issuedAfterOneExport:tokens.length,forged:forged.json,foreignIdentity:stolen.json,genuine:first.json,genuineAgain:again.json,usedAfter:after.studioUsage.used,tokensNowOffered:after.grace.studio.length,nextDay:stale.json,freshIdentityTokens:freshIdentity});
}
// ---------------------------------------------------------------- A16 IPv6 representation
{
 const h=harness(),cfg=runtimeConfig(h.env);let total=0;
 for(let i=0;i<40;i++)total+=(await exhaust(h.browser(`2001:db8::${(i+1).toString(16)}`),4)).ok;
 record('A16','Hosts of one IPv6 /64 whose prefix has zero groups (2001:db8::1, ::2, …) count as ONE network',total<=cfg.anonNetworkStudio?'BLOCKED':'WORKS',{hosts:40,exports:total,cap:cfg.anonNetworkStudio});
}
// ---------------------------------------------------------------- A17 anonymous → sign-in flow
{
 const h=harness(),b=h.browser();const anon=await exhaust(b,4);const me=(await b.me()).json.studioUsage;
 record('A17','Anonymous identity: 3 engine exports, then SIGN_IN_REQUIRED (not a daily-limit wall); /me says sign-in unlocks 10',anon.ok===3&&anon.last==='SIGN_IN_REQUIRED'&&me.signInRequired&&me.signInLimit===10?'BLOCKED':'WORKS',{anonExports:anon.ok,refusal:anon.last,me});
}

mkdirSync(new URL('../../test-results/redteam/',import.meta.url),{recursive:true});
writeFileSync(new URL('../../test-results/redteam/api.json',import.meta.url),JSON.stringify({ranAt:new Date().toISOString(),results},null,1));
const tally=results.reduce((m,r)=>(m[r.verdict]=(m[r.verdict]||0)+1,m),{});
if(!process.env.REDTEAM_QUIET)console.log('\nSUMMARY',JSON.stringify(tally));
if(process.argv[1]?.endsWith('api-attacks.mjs'))process.exitCode=results.some(r=>['WORKS','PARTIAL'].includes(r.verdict))?1:0;
