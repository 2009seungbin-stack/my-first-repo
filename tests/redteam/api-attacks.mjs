/** Red-team harness (Phase 1, docs/MONETIZATION-SECURITY.md): attacks on the account service
 * API, run in-process against server/api.js with an isolated in-memory D1 (tests/d1-shim.mjs).
 * It records what an attacker gets TODAY — it is not a pass/fail suite and is deliberately not
 * matched by `npm test` (tests/*.test.mjs). Every attack prints WORKS (bypass succeeded),
 * PARTIAL or BLOCKED with evidence, and the full log goes to test-results/redteam/api.json.
 * Never contacts a real service: outbound fetch throws.
 *   node tests/redteam/api-attacks.mjs */
import {mkdirSync,writeFileSync} from 'node:fs';
import {D1Shim} from '../d1-shim.mjs';
import {handleApi} from '../../server/api.js';
import {runtimeConfig} from '../../server/config.js';
import {sha256,base64url,hmacHex,sign} from '../../server/crypto.js';
import {signSandbox,SANDBOX_SIGNATURE} from '../../server/billing/sandbox.js';

const ORIGIN='https://nerulio.test';
const SECRET='redteam-session-secret-0123456789abcdef-0123456789';
const DAY0=Date.UTC(2026,8,24,10,0,0);
const uuid=()=>crypto.randomUUID();
const results=[];
function record(id,title,verdict,evidence){results.push({id,title,verdict,evidence});console.log(`${verdict.padEnd(7)} ${id} ${title}\n        ${JSON.stringify(evidence)}`);}

function harness(envExtra={},{now=DAY0,build}={}){
 const db=D1Shim.migrated(),clock={now};
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,FREE_DAILY_STUDIO_EXPORTS:'10',...envExtra};
 let writes=0;const batch=db.batch.bind(db);db.batch=async s=>{const r=await batch(s);writes+=r.reduce((n,x)=>n+(x.meta?.changes||0),0);return r;};
 const h={db,env,clock,get writes(){return writes;},
  /** A browser = its own cookie jar. `ip` becomes CF-Connecting-IP (on Cloudflare the edge sets it). */
  browser(ip='203.0.113.7'){
   const jar={};
   const b={jar,ip,
    async call(method,path,{body,headers={},origin=ORIGIN,raw,noCookies=false}={}){
     const hd=new Headers(headers);
     if(!noCookies&&Object.keys(jar).length)hd.set('cookie',Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '));
     if(method==='POST'&&origin&&!hd.has('origin'))hd.set('origin',origin);
     if(b.ip&&!hd.has('cf-connecting-ip'))hd.set('cf-connecting-ip',b.ip);
     if((body!==undefined||raw!==undefined)&&!hd.has('content-type'))hd.set('content-type','application/json');
     const request=new Request(ORIGIN+path,{method,headers:hd,body:raw??(body!==undefined?JSON.stringify(body):undefined),redirect:'manual'});
     const response=await handleApi(request,env,{waitUntil(){}},{now:()=>clock.now,random:()=>0.5,fetch:async()=>{throw Error('no outbound fetch in red-team runs');}});
     for(const c of response.headers.getSetCookie()){const [pair]=c.split(';'),i=pair.indexOf('='),k=pair.slice(0,i),v=pair.slice(i+1);if(/Max-Age=0/.test(c))delete jar[k];else jar[k]=v;}
     const text=await response.text();let json=null;try{json=JSON.parse(text);}catch{}
     return {status:response.status,json,location:response.headers.get('location')};
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
async function newSession(h,userId){
 const token=base64url(crypto.getRandomValues(new Uint8Array(32)));
 await h.db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),userId,h.clock.now,h.clock.now+30*864e5).run();
 return token;
}
const allowed=r=>r.status===200&&r.json?.allowed===true;
async function exhaust(b,n=10,tool='studio-pack-export'){let ok=0;for(let i=0;i<n;i++)if(allowed(await b.export(tool)))ok++;return ok;}

// ---------------------------------------------------------------- A1 identity reset
{
 const h=harness();let total=0;
 for(let i=0;i<50;i++){const b=h.browser();total+=await exhaust(b,11);}
 record('A1','Clear cookies / incognito / second browser: every fresh anonymous cookie gets a new full allowance (no Turnstile configured)',total>10?'WORKS':'BLOCKED',{freshBrowsers:50,sameIP:true,limitPerIdentity:10,studioExportsAllowed:total,d1RowsWritten:h.writes});
}
{
 const h=harness({TURNSTILE_SITE_KEY:'1x-site',TURNSTILE_SECRET_KEY:'1x-secret'});
 let total=0,challengedAt=null;
 for(let i=0;i<40&&challengedAt===null;i++){const b=h.browser('203.0.113.7');for(let j=0;j<11;j++){const r=await b.export();if(allowed(r))total++;else if(r.json?.error?.code==='CHALLENGE_REQUIRED'){challengedAt=total;break;}}}
 record('A1b','Same with Turnstile configured: fresh cookies from one IPv4 are only challenged after the network soft limit',challengedAt!==null&&challengedAt>10?'PARTIAL':'BLOCKED',{softLimitDefault:runtimeConfig(h.env).anonNetworkSoftLimit,exportsAllowedBeforeFirstChallenge:challengedAt,note:'challenge is solvable by a human per new cookie; heavy jobs and Studio exports share this bucket'});
 let rot=0,challenged=0;
 for(let i=0;i<40;i++){const b=h.browser(`198.51.100.${i+1}`);for(let j=0;j<11;j++){const r=await b.export();if(allowed(r))rot++;else if(r.json?.error?.code==='CHALLENGE_REQUIRED')challenged++;}}
 let v6=0;for(let i=0;i<40;i++){const b=h.browser(`2001:db8:${(i+1).toString(16)}:${i}::1`);v6+=await exhaust(b,11);}
 record('A1c','VPN / IP rotation (distinct IPv4, or distinct IPv6 /64 inside one /48) is never challenged',rot>40?'WORKS':'BLOCKED',{ipv4Addresses:40,exportsAllowed:rot,challenged,ipv6Slash64s:40,ipv6ExportsAllowed:v6});
}
// ---------------------------------------------------------------- A2 idempotency replay
{
 const h=harness(),b=h.browser();
 const first=uuid();await b.export('studio-pack-export',first);
 await exhaust(b,9);const denied=await b.export();
 const replays=[];for(let i=0;i<5;i++)replays.push(await b.export('studio-pack-export',first));
 const me=await b.me();
 record('A2','Replaying an earlier ALLOWED operationId after the limit returns allowed:true again, uncharged',replays.every(allowed)?'WORKS':'BLOCKED',
  {deniedStatus:denied.status,replayResults:replays.map(r=>r.json?.allowed),usedAfterReplays:me.json.studioUsage.used,note:'harmless today only because the client ignores the server; any signed-ticket design must not re-issue on replay'});
 const conflict=await b.export('studio-tile-export',first);
 record('A2b','Replaying an operationId for a different action',conflict.status===409?'BLOCKED':'WORKS',{status:conflict.status,code:conflict.json?.error?.code});
 h.clock.now+=2*864e5;const old=await b.export('studio-pack-export',first);
 record('A2c','Replaying a 2-day-old allowed operationId (before the 3-day cleanup)',allowed(old)?'WORKS':'BLOCKED',{allowed:old.json?.allowed,resetAtReported:old.json?.resetAt});
}
// ---------------------------------------------------------------- A3 race at the limit
{
 const h=harness(),b=h.browser();await exhaust(b,9);
 const rs=await Promise.all(Array.from({length:30},()=>b.export()));
 const me=await b.me();
 record('A3','30 parallel exports at 9/10 (distinct operationIds, one identity) — in-process D1 shim; the workerd run is in tests/redteam/browser-attacks.py',rs.filter(allowed).length===1?'BLOCKED':'WORKS',{allowed:rs.filter(allowed).length,used:me.json.studioUsage.used});
}
// ---------------------------------------------------------------- A4 forged request bodies
{
 const h=harness(),b=h.browser();
 const cases={
  unknownTool:{operationId:uuid(),toolId:'studio-everything'},
  lightTool:{operationId:uuid(),toolId:'studio-save-project'},
  suffixInjection:{operationId:uuid(),toolId:'studio-pack-export#studio'},
  protoKey:{operationId:uuid(),toolId:'__proto__'},
  extraField:{operationId:uuid(),toolId:'studio-pack-export',used:'-5'},
  subjectField:{operationId:uuid(),toolId:'studio-pack-export',subject:'u:victim'},
  numericOp:{operationId:12345,toolId:'studio-pack-export'},
  notUuid:{operationId:'x'.repeat(36),toolId:'studio-pack-export'},
  arrayTool:{operationId:uuid(),toolId:['studio-pack-export']}
 };
 const out={};for(const [k,body]of Object.entries(cases)){const r=await b.call('POST','/api/v1/jobs/authorize',{body});out[k]=r.status+' '+(r.json?.error?.code||'')+(r.json?.allowed?' ALLOWED':'');}
 const arr=await b.call('POST','/api/v1/jobs/authorize',{raw:'[]'});out.jsonArray=arr.status+' '+arr.json?.error?.code;
 const big=await b.call('POST','/api/v1/jobs/authorize',{raw:JSON.stringify({operationId:uuid(),toolId:'studio-pack-export',turnstileToken:'x'.repeat(5000)})});out.oversize=big.status+' '+big.json?.error?.code;
 const me=await b.me();
 record('A4','Forged bodies: unknown/light tool ids, #studio suffix injection, negative "used", foreign subject, wrong types, oversize',Object.values(out).some(v=>v.includes('ALLOWED'))||me.json.studioUsage.used!==0?'WORKS':'BLOCKED',{...out,studioUsedAfter:me.json.studioUsage.used});
 const cfg=['0','-1','1e9','99999999999999999999','NaN','10.5'].map(v=>[v,runtimeConfig({FREE_DAILY_STUDIO_EXPORTS:v}).freeDailyStudio]);
 record('A4b','Negative / overflow / non-integer limit configuration falls back to the default',cfg.every(([,n])=>n===10)?'BLOCKED':'WORKS',{cfg});
}
// ---------------------------------------------------------------- A5 cookie / session tampering
{
 const h=harness(),victim=h.browser();await exhaust(victim,10);
 const forger=h.browser();forger.jar.nerulio_anon=base64url(crypto.getRandomValues(new Uint8Array(16))).slice(0,22)+'.AAAA';
 const r=await forger.me();
 record('A5','Forged / unsigned nerulio_anon cookie is replaced (cannot choose or reset an id)',forger.jar.nerulio_anon.endsWith('.AAAA')?'WORKS':'BLOCKED',{newCookieIssued:!forger.jar.nerulio_anon.endsWith('.AAAA'),studioUsed:r.json.studioUsage.used});
 // "Undo" the day: re-use an OLD anon cookie from before usage (backup + restore of the cookie jar) does not help, the counter is server side.
 const snapshot={...victim.jar};const clone=h.browser();Object.assign(clone.jar,snapshot);
 const c=await clone.export();
 record('A5b','Restoring a backed-up cookie jar (or sharing one cookie between browsers) does not reset the counter',allowed(c)?'WORKS':'BLOCKED',{status:c.status,code:c.json?.error?.code});
 const guess=h.browser();guess.jar.nerulio_session=base64url(crypto.getRandomValues(new Uint8Array(32)));const g=await guess.me();
 record('A5c','Guessed/forged session token',g.json.loggedIn?'WORKS':'BLOCKED',{loggedIn:g.json.loggedIn,plan:g.json.plan,staleCookieCleared:!('nerulio_session'in guess.jar)});
 // Display bug: a dead session cookie next to a used anon cookie makes /me report a full allowance.
 const d=h.browser();await exhaust(d,10);d.jar.nerulio_session=base64url(crypto.getRandomValues(new Uint8Array(32)));const dm=await d.me();const da=await d.export();
 record('A5d','Stale session cookie + used anonymous cookie: /me shows a full allowance (display only; authorize still denies)',dm.json.studioUsage.remaining===10&&!allowed(da)?'PARTIAL':'BLOCKED',{meRemaining:dm.json.studioUsage.remaining,authorizeStatus:da.status});
 const weak=harness({SESSION_SECRET:'short-secret'}).browser();const w=await weak.me();
 record('A5e','SESSION_SECRET shorter than 32 chars disables the service instead of running weak',w.status===503?'BLOCKED':'WORKS',{status:w.status,code:w.json?.error?.code});
 // Secret rotation = everybody's anonymous id changes = everybody's anonymous counter resets.
 const h2=harness(),rb=h2.browser();await exhaust(rb,10);h2.env.SESSION_SECRET=SECRET+'-rotated';const after=await rb.export();
 record('A5f','Rotating SESSION_SECRET resets every anonymous counter (operator action, no keyring)',allowed(after)?'WORKS':'BLOCKED',{allowedAfterRotation:allowed(after)});
}
// ---------------------------------------------------------------- A6 CSRF / origin
{
 const h=harness(),b=h.browser();
 const hit=async(headers,opts={})=>{const r=await b.call('POST','/api/v1/jobs/authorize',{body:{operationId:uuid(),toolId:'studio-pack-export'},headers,...opts});return r.status+' '+(r.json?.error?.code||'ok');};
 const out={
  evilOrigin:await hit({origin:'https://evil.test'}),
  crossSite:await hit({'sec-fetch-site':'cross-site'},{origin:null}),
  sameSiteSibling:await hit({'sec-fetch-site':'same-site',origin:'https://preview.nerulio.test'}),
  noOriginNoFetchSite:await hit({},{origin:null}),
  textPlain:await hit({'content-type':'text/plain'}),
  nullOrigin:await hit({origin:'null'})
 };
 const lo=await b.call('POST','/api/v1/auth/logout',{body:{},headers:{origin:'https://evil.test'}});out.logoutEvilOrigin=lo.status+' '+lo.json?.error?.code;
 record('A6','CSRF on state-changing endpoints (a foreign page burning a victim\'s quota or logging them out)',Object.values(out).some(v=>v.endsWith('ok'))?'WORKS':'BLOCKED',out);
 const scripted=await hit({origin:ORIGIN,'sec-fetch-site':'same-origin'});
 record('A6b','A script (curl/Node) simply sends Origin + Sec-Fetch-Site and is accepted — CSRF checks are not bot checks',scripted.endsWith('ok')?'WORKS':'BLOCKED',{status:scripted,note:'expected; bots are handled by quota + Turnstile, not by origin checks'});
}
// ---------------------------------------------------------------- A7 sign-in carry-over / logout / farming
{
 const h=harness(),b=h.browser();
 await exhaust(b,10);
 const uidA=await createUser(h,'acct-a');
 // Simulate the callback's carry-over exactly as finishLogin does.
 const {carryOverStatements}=await import('../../server/usage.js');
 const anonId=(await import('../../server/identity.js')).readAnon;
 const aid=await anonId(b.jar.nerulio_anon,SECRET);
 await h.db.batch(carryOverStatements(h.db,`a:${aid}`,`u:${uidA}`,h.clock.now));
 b.jar.nerulio_session=await newSession(h,uidA);
 const afterLogin=await b.export();
 record('A7','Anonymous 10/10 then sign in: the counter carries over (sign-in is not a reset)',allowed(afterLogin)?'WORKS':'BLOCKED',{status:afterLogin.status});
 // Reverse order: use the account's allowance first, then log out → the anonymous cookie still has its own full allowance.
 const h2=harness(),c=h2.browser();await c.me();
 const uidB=await createUser(h2,'acct-b');c.jar.nerulio_session=await newSession(h2,uidB);
 const asUser=await exhaust(c,11);
 await c.call('POST','/api/v1/auth/logout',{body:{}});
 const asAnon=await exhaust(c,11);
 // …and a second Google account signed in after that carries the anon count (MAX), a third fresh browser + account gives another 10.
 record('A7b','Account first, then log out: the same browser gets a second full allowance as anonymous',asAnon>0?'WORKS':'BLOCKED',{exportsAsUser:asUser,exportsAsAnonAfterLogout:asAnon});
 let farm=0;for(let i=0;i<20;i++){const u=await createUser(h2,'farm-'+i),fb=h2.browser();fb.jar.nerulio_session=await newSession(h2,u);farm+=await exhaust(fb,11);}
 record('A7c','Account farming: every free Google account is a new 10/day (20 accounts from one IP, no per-IP cap for signed-in users)',farm>10?'WORKS':'BLOCKED',{accounts:20,exportsAllowed:farm});
}
// ---------------------------------------------------------------- A8 time
{
 const h=harness(),b=h.browser();await exhaust(b,10);
 const pre=await b.export('studio-pack-export',uuid(),{});
 const clientClock=await b.call('POST','/api/v1/jobs/authorize',{body:{operationId:uuid(),toolId:'studio-pack-export'},headers:{date:'Wed, 01 Jan 2031 00:00:00 GMT'}});
 h.clock.now=Date.UTC(2026,8,24,23,59,59,999);const edge=await b.export();
 h.clock.now=Date.UTC(2026,8,25,0,0,0,0);const next=await b.export();
 record('A8','Time manipulation: the day is the Worker\'s UTC clock; client Date headers are ignored; reset exactly at 00:00 UTC',!allowed(pre)&&!allowed(clientClock)&&!allowed(edge)&&allowed(next)?'BLOCKED':'WORKS',{beforeMidnight:edge.status,afterMidnight:next.status});
}
// ---------------------------------------------------------------- A9 Pro forging via billing
{
 const env={BILLING_PROVIDER:'sandbox',BILLING_WEBHOOK_SECRET:'whsec-redteam'};
 const h=harness(env),b=h.browser();const uid=await createUser(h,'victim-pro');b.jar.nerulio_session=await newSession(h,uid);
 const ev=(o={})=>({id:'evt-'+uuid(),type:'subscription.updated',occurredAt:new Date(h.clock.now).toISOString(),data:{subscriptionId:'sub-1',customerId:'cus-1',userId:uid,plan:'pro',status:'active',currentPeriodEnd:new Date(h.clock.now+30*864e5).toISOString(),cancelAtPeriodEnd:false,...o}});
 const post=async(body,sig)=>b.call('POST','/api/v1/billing/webhook',{raw:body,origin:null,headers:sig===undefined?{}:{[SANDBOX_SIGNATURE]:sig},noCookies:true});
 const out={};
 let body=JSON.stringify(ev());
 out.unsigned=(await post(body)).status;
 out.wrongSecret=(await post(body,await signSandbox('guess',body,Math.floor(h.clock.now/1000)))).status;
 const tsOld=Math.floor(h.clock.now/1000)-600;out.staleTimestamp=(await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,tsOld))).status;
 const okSig=await signSandbox(env.BILLING_WEBHOOK_SECRET,body,Math.floor(h.clock.now/1000));
 out.bodyTampered=(await post(body.replace('"active"','"trialing"'),okSig)).status;
 out.validOnce=(await post(body,okSig)).json;out.replayWithin5min=(await post(body,okSig)).json;
 out.planNow=(await b.me()).json.plan;
 record('A9','Forging Pro through the webhook: unsigned, wrong secret, stale timestamp, tampered body, replay',out.unsigned===401&&out.wrongSecret===401&&out.staleTimestamp===401&&out.bodyTampered===401&&out.replayWithin5min.duplicate===true?'BLOCKED':'WORKS',out);
 // Out-of-order: a delayed old "active" after a "canceled".
 h.clock.now+=60e3;body=JSON.stringify(ev({status:'canceled',currentPeriodEnd:null}));await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,Math.floor(h.clock.now/1000)));
 const oldActive=ev();oldActive.occurredAt=new Date(h.clock.now-30e3).toISOString();body=JSON.stringify(oldActive);await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,Math.floor(h.clock.now/1000)));
 record('A9b','Out-of-order delivery: an older "active" event after "canceled" does not resurrect Pro',(await b.me()).json.plan==='free'?'BLOCKED':'WORKS',{plan:(await b.me()).json.plan});
 // Someone else's user id in a validly signed event grants THAT user Pro (only the provider can sign); no user → ignored.
 body=JSON.stringify({...ev({userId:'no-such-user',subscriptionId:'sub-x'})});const ign=await post(body,await signSandbox(env.BILLING_WEBHOOK_SECRET,body,Math.floor(h.clock.now/1000)));
 const row=await h.db.prepare("SELECT state FROM billing_events ORDER BY processed_at DESC LIMIT 1").first();
 record('A9c','Signed event for an unknown user id is recorded as ignored, grants nothing',row.state==='ignored'?'BLOCKED':'WORKS',{response:ign.json,state:row.state});
 // Production build + NERULIO_ENV=development re-enables the sandbox provider.
 const prodDev=runtimeConfig({NERULIO_ENV:'development',...env,DB:{},SESSION_SECRET:SECRET},{service:true,preview:false});
 const prod=runtimeConfig({...env,DB:{},SESSION_SECRET:SECRET},{service:true,preview:false});
 record('A9d','Production build: sandbox billing is refused — unless NERULIO_ENV=development is (mis)set, which silently re-enables it',prodDev.billing.mode==='sandbox'?'WORKS':'BLOCKED',{productionBuild:prod.billing.mode,productionBuildWithNERULIO_ENV_development:prodDev.billing.mode,note:'operator footgun; exploitation still needs BILLING_WEBHOOK_SECRET'});
}
{
 // Refund / chargeback on Paddle: adjustment.* events carry no subscription → ignored; Pro stays until period end.
 const env={BILLING_PROVIDER:'paddle',BILLING_MODE:'sandbox',BILLING_API_KEY:'k',BILLING_WEBHOOK_SECRET:'pdl_whsec',BILLING_PRICE_ID:'pri_pro'};
 const h=harness(env),b=h.browser();const uid=await createUser(h,'refund-user');b.jar.nerulio_session=await newSession(h,uid);
 const post=async p=>{const body=JSON.stringify(p),ts=Math.floor(h.clock.now/1000);return b.call('POST','/api/v1/billing/webhook',{raw:body,origin:null,noCookies:true,headers:{'paddle-signature':`ts=${ts};h1=${await hmacHex(env.BILLING_WEBHOOK_SECRET,`${ts}:${body}`)}`}});};
 const sub={id:'sub_01',customer_id:'ctm_01',custom_data:{nerulio_user_id:uid},items:[{price:{id:'pri_pro'}}],status:'active',current_billing_period:{ends_at:new Date(h.clock.now+30*864e5).toISOString()},scheduled_change:null};
 await post({event_id:'evt_1',event_type:'subscription.activated',occurred_at:new Date(h.clock.now).toISOString(),data:sub});
 const pro=(await b.me()).json.plan;
 h.clock.now+=3600e3;
 const refund=await post({event_id:'evt_2',event_type:'adjustment.created',occurred_at:new Date(h.clock.now).toISOString(),data:{id:'adj_1',action:'refund',status:'approved',subscription_id:'sub_01',transaction_id:'txn_1'}});
 const cb=await post({event_id:'evt_3',event_type:'adjustment.created',occurred_at:new Date(h.clock.now).toISOString(),data:{id:'adj_2',action:'chargeback',status:'approved',subscription_id:'sub_01',transaction_id:'txn_1'}});
 const after=(await b.me()).json.plan;
 record('A10','Paddle refund / chargeback (adjustment.created) is ignored: the user keeps Pro until the paid period ends',after==='pro'?'WORKS':'BLOCKED',{planAfterActivation:pro,refund:refund.json,chargeback:cb.json,planAfterRefundAndChargeback:after});
 await post({event_id:'evt_4',event_type:'subscription.past_due',occurred_at:new Date(h.clock.now+1).toISOString(),data:{...sub,status:'past_due'}});
 record('A10b','past_due (card retry in progress) drops Pro immediately — policy decision, no grace period',(await b.me()).json.plan==='free'?'PARTIAL':'BLOCKED',{planDuringPastDue:(await b.me()).json.plan});
 // A second Pro price (e.g. yearly) is not Pro.
 const {paddle}=await import('../../server/billing/paddle.js');
 const yearly=paddle.normalizeWebhook({event_id:'e',event_type:'subscription.activated',occurred_at:new Date().toISOString(),data:{...sub,items:[{price:{id:'pri_pro_yearly'}}]}},env);
 record('A10c','Only one BILLING_PRICE_ID is Pro: a yearly or discounted price would be stored as plan "other" (paying customer without Pro)',yearly.subscription.plan==='other'?'PARTIAL':'BLOCKED',{plan:yearly.subscription.plan});
}
// ---------------------------------------------------------------- A11 Pro session sharing
{
 const h=harness(),uid=await createUser(h,'pro-sharer');
 await h.db.prepare("INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES('manual','m1',?1,'pro','active',?2,0,?3)").bind(uid,h.clock.now+30*864e5,h.clock.now).run();
 const token=await newSession(h,uid);let pro=0;
 for(let i=0;i<50;i++){const b=h.browser(`192.0.2.${i+1}`);b.jar.nerulio_session=token;if((await b.me()).json.plan==='pro')pro++;}
 const sessions=[];for(let i=0;i<30;i++)sessions.push(await newSession(h,uid));
 const n=(await h.db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?1').bind(uid).first()).n;
 const trail=(await h.db.prepare('SELECT COUNT(*) n FROM job_authorizations WHERE subject_id=?1').bind('u:'+uid).first()).n;
 record('A11','Pro sharing: one Pro session cookie used from 50 networks, unlimited concurrent sessions per account, and Pro use leaves no trace',pro===50?'WORKS':'BLOCKED',{networksServedPro:pro,concurrentSessionsForOneUser:n,authorizationRowsForProUser:trail});
}
// ---------------------------------------------------------------- A12 admin
{
 const h=harness({ADMIN_GOOGLE_SUBJECTS:'admin-sub'}),b=h.browser();
 const anon=await b.call('GET','/api/v1/admin/stats');
 const uid=await createUser(h,'someone');b.jar.nerulio_session=await newSession(h,uid);const user=await b.call('GET','/api/v1/admin/stats');
 const aid=await createUser(h,'admin-sub');const ab=h.browser();ab.jar.nerulio_session=await newSession(h,aid);h.clock.now+=13*3600e3;const stale=await ab.call('GET','/api/v1/admin/stats');
 record('A12','Admin stats/cleanup for anonymous, normal and stale-admin sessions',[anon,user,stale].every(r=>r.status===404)?'BLOCKED':'WORKS',{anonymous:anon.status,user:user.status,adminSessionOlderThan12h:stale.status});
}
// ---------------------------------------------------------------- A13 write amplification (cost / DoS)
{
 const h=harness();const before=h.writes;
 for(let i=0;i<200;i++){const b=h.browser(`203.0.113.${i%250}`);await b.export();}
 const per=(h.writes-before)/200;
 record('A13','Unauthenticated write amplification: each cookie-less authorize writes D1 rows; nothing rate-limits /api on *.pages.dev (WAF needs a custom domain)',per>=3?'WORKS':'BLOCKED',{requests:200,d1RowChangesPerRequest:per,requestsToExhaustD1FreeWrites100k:Math.round(1e5/per)});
}
// ---------------------------------------------------------------- A14 Turnstile human cookie binding
{
 const h=harness({TURNSTILE_SITE_KEY:'k',TURNSTILE_SECRET_KEY:'s',ANON_NETWORK_DAILY_JOBS:'1'});
 const a=h.browser();await a.export();
 // Mint what a solved challenge would give identity A, then present it with identity B.
 const {readAnon}=await import('../../server/identity.js');const idA=await readAnon(a.jar.nerulio_anon,SECRET);
 a.jar.nerulio_human=await sign(SECRET,'human/v1',`${idA}~${h.clock.now+3600e3}`);
 const bb=h.browser();bb.jar.nerulio_human=a.jar.nerulio_human;const r=await bb.export();
 const aOk=await a.export();
 record('A14','A solved-challenge cookie is bound to its anonymous id (cannot be shared across fresh identities)',r.json?.error?.code==='CHALLENGE_REQUIRED'&&allowed(aOk)?'BLOCKED':'WORKS',{otherIdentity:r.json?.error?.code,sameIdentity:aOk.status});
}
mkdirSync(new URL('../../test-results/redteam/',import.meta.url),{recursive:true});
writeFileSync(new URL('../../test-results/redteam/api.json',import.meta.url),JSON.stringify({ranAt:new Date().toISOString(),results},null,1));
const tally=results.reduce((m,r)=>(m[r.verdict]=(m[r.verdict]||0)+1,m),{});
console.log('\nSUMMARY',JSON.stringify(tally));
