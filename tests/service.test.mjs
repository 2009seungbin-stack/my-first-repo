import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {handleApi,networkSubject} from '../server/api.js';
import worker from '../server/index.js';
import {runtimeConfig} from '../server/config.js';
import {sha256,base64url,hmacHex} from '../server/crypto.js';
import {signSandbox,SANDBOX_SIGNATURE} from '../server/billing/sandbox.js';
import {paddle} from '../server/billing/paddle.js';
import {safeReturnPath,validateClaims} from '../server/auth-google.js';
import {QUOTA_CLASSES,HEAVY_TOOLS,DEFAULT_FREE_DAILY_JOBS,meteredTool,quotaDay,nextReset,freeDailyLimit} from '../src/quota.js';
import {INTENTS} from '../src/intents.js';

const skip=!sqliteAvailable&&'node:sqlite is unavailable in this Node version';
const ORIGIN='https://nerulio.test';
const SECRET='test-session-secret-0123456789abcdef-0123456789';
const DAY0=Date.UTC(2026,8,21,10,0,0);
const uuid=()=>crypto.randomUUID();
/** One isolated "deployment": fresh in-memory D1, cookie jar, controllable clock. */
function harness(envExtra={},{now=DAY0}={}){
 const db=D1Shim.migrated(),jar={},clock={now},outbound=[];
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,...envExtra};
 let fetchImpl=async()=>{throw Error('unexpected outbound fetch');};
 const h={db,env,jar,clock,outbound,
  setFetch(fn){fetchImpl=fn;},
  async call(method,path,{body,headers={},cookies=true,origin=ORIGIN,raw}={}){
   const hd=new Headers(headers);
   if(cookies&&Object.keys(jar).length)hd.set('cookie',Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '));
   if(method==='POST'&&origin&&!hd.has('origin'))hd.set('origin',origin);
   if((body!==undefined||raw!==undefined)&&!hd.has('content-type'))hd.set('content-type','application/json');
   const request=new Request(ORIGIN+path,{method,headers:hd,body:raw??(body!==undefined?JSON.stringify(body):undefined),redirect:'manual'});
   const response=await handleApi(request,env,{waitUntil(){}} ,{now:()=>clock.now,random:()=>0.5,fetch:(...a)=>{outbound.push(a);return fetchImpl(...a);}});
   const setCookies=response.headers.getSetCookie();
   for(const c of setCookies){const [pair]=c.split(';'),i=pair.indexOf('='),k=pair.slice(0,i),v=pair.slice(i+1);if(/Max-Age=0/.test(c))delete jar[k];else jar[k]=v;}
   const text=await response.text();let json=null;try{json=JSON.parse(text);}catch{}
   return {status:response.status,json,headers:response.headers,setCookies};
  },
  authorize(toolId='upscale',operationId=uuid(),extra={}){return h.call('POST','/api/v1/jobs/authorize',{body:{operationId,toolId,...extra}});}
 };
 return h;
}
async function signIn(h,{subject='g-sub-1',email='user@example.test',now=h.clock.now}={}){
 const id=base64url(crypto.getRandomValues(new Uint8Array(16)));
 await h.db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,?2,'Tester','google',?3,?4)").bind(id,email,subject,now).run();
 const token=base64url(crypto.getRandomValues(new Uint8Array(32)));
 await h.db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),id,now,now+30*864e5).run();
 h.jar.nerulio_session=token;return {id,token};
}
async function grantPro(h,userId,{status='active',end=h.clock.now+30*864e5,cancel=0,provider='manual'}={}){
 await h.db.prepare("INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES(?1,?2,?3,'pro',?4,?5,?6,?7)").bind(provider,'sub-'+uuid(),userId,status,end,cancel,h.clock.now).run();
}

test('quota registry covers every tool exactly once and matches the product model',()=>{
 assert.deepEqual(Object.keys(QUOTA_CLASSES).sort(),Object.keys(INTENTS).sort(),'every INTENTS id needs a quota class, and no stale ids');
 assert(Object.values(QUOTA_CLASSES).every(c=>['none','heavy'].includes(c)));
 for(const id of ['crop','resize','convert','pdf-merge','pdf-split','pixel','palette-swap','video-frame','home','image','pdf'])assert.equal(QUOTA_CLASSES[id],'none',id);
 for(const id of ['upscale','remove-bg','compress','video-compress','video-gif','pdf-compress','refiner'])assert.equal(QUOTA_CLASSES[id],'heavy',id);
 assert.equal(meteredTool('remove-bg',{background:'solid'}),'','flood-fill removal is not AI work');
 assert.equal(meteredTool('remove-bg',{background:'portrait'}),'remove-bg');
 assert.equal(meteredTool('crop'),'');
 assert.equal(DEFAULT_FREE_DAILY_JOBS,30);
 assert.equal(freeDailyLimit('10'),10);assert.equal(freeDailyLimit('abc'),30);assert.equal(freeDailyLimit('0'),30);assert.equal(freeDailyLimit(undefined),30);
 assert.equal(quotaDay(Date.UTC(2026,0,1,23,59)),'2026-01-01');assert.equal(nextReset(Date.UTC(2026,0,1,23,59)),Date.UTC(2026,0,2));
 assert(HEAVY_TOOLS.includes('upscale')&&!HEAVY_TOOLS.includes('crop'));
});

test('migrations build the full schema on a fresh database',{skip},async()=>{
 const db=D1Shim.migrated();
 const tables=db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name);
 for(const t of ['billing_events','daily_usage','job_authorizations','sessions','subscriptions','users'])assert(tables.includes(t),t);
 const cols=t=>db.raw.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name);
 assert.deepEqual(cols('users'),['id','email','display_name','provider','provider_subject','created_at','flagged_at','flag_reason']);
 assert(['token_hash','user_id','created_at','expires_at'].every(c=>cols('sessions').includes(c)));
 assert(['user_id','provider','external_customer_id','external_subscription_id','plan','status','current_period_end','cancel_at_period_end','updated_at'].every(c=>cols('subscriptions').includes(c)));
 assert(['subject_id','day','used'].every(c=>cols('daily_usage').includes(c)));
 assert(['operation_id','subject_id','tool_id','allowed','used_after','created_at'].every(c=>cols('job_authorizations').includes(c)));
 assert(['provider','event_id','processed_at'].every(c=>cols('billing_events').includes(c)));
 assert(!Object.values({u:cols('users'),s:cols('sessions')}).flat().some(c=>/file|name_of|path|blob|content/.test(c)),'no file-related columns');
 // unique identity and de-duplication constraints
 db.raw.exec("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES('a',NULL,NULL,'google','s1',1)");
 assert.throws(()=>db.raw.exec("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES('b',NULL,NULL,'google','s1',1)"),/UNIQUE/);
 db.raw.exec("INSERT INTO billing_events(provider,event_id,processed_at) VALUES('p','e',1)");
 assert.throws(()=>db.raw.exec("INSERT INTO billing_events(provider,event_id,processed_at) VALUES('p','e',2)"),/UNIQUE|PRIMARY/);
 assert.throws(()=>db.raw.exec("INSERT INTO sessions VALUES('h','missing',1,2)"),/FOREIGN KEY/);
});

test('anonymous identity: secure random cookie issued once, then reused',{skip},async()=>{
 const h=harness();
 const first=await h.call('GET','/api/v1/me');
 assert.equal(first.status,200);
 const anon=first.setCookies.find(c=>c.startsWith('nerulio_anon='));
 assert(anon,'anonymous cookie issued on first contact');
 for(const attr of ['HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age='])assert(anon.includes(attr),attr);
 assert.match(h.jar.nerulio_anon,/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/,'random id + HMAC');
 const {grace,...rest}=first.json;
 assert.deepEqual(rest,{loggedIn:false,plan:'free',ads:true,usage:{used:0,limit:30,remaining:30,resetAt:new Date(Date.UTC(2026,8,22)).toISOString()},studioUsage:{used:0,limit:3,remaining:3,resetAt:new Date(Date.UTC(2026,8,22)).toISOString(),signInLimit:10,signInRequired:false},billing:{mode:'off',yearly:false},turnstileSiteKey:''});
 // Signed offline allowance: 3 opaque tokens per class for today, bound to this identity.
 assert.equal(grace.day,'2026-09-21');assert.equal(grace.heavy.length,3);assert.equal(grace.studio.length,3);
 assert(grace.studio.every(t=>/^s[1-3]\.[A-Za-z0-9_-]{22}$/.test(t)));
 const again=await h.call('GET','/api/v1/me');
 assert.equal(again.setCookies.length,0,'same identity kept');
 // A forged or tampered cookie is replaced, not trusted.
 const [id]=h.jar.nerulio_anon.split('.');h.jar.nerulio_anon=id+'.AAAA';
 const forged=await h.call('GET','/api/v1/me');
 assert(forged.setCookies.some(c=>c.startsWith('nerulio_anon=')));
 // No database rows exist for an anonymous visitor who never ran a heavy job.
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM daily_usage').get().n,0);
});

test('API responses are JSON, private, and never CORS-enabled',{skip},async()=>{
 const h=harness();
 for(const [m,p] of [['GET','/api/v1/me'],['GET','/api/v1/health'],['GET','/api/v1/nope'],['POST','/api/v1/me']]){
  const r=await h.call(m,p,{body:m==='POST'?{}:undefined});
  assert.match(r.headers.get('content-type'),/^application\/json/);
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert(![...r.headers.keys()].some(k=>k.startsWith('access-control-')),'no CORS headers');
 }
 const missing=await h.call('GET','/api/v1/nope');assert.equal(missing.status,404);assert.equal(missing.json.error.code,'NOT_FOUND');
 const wrong=await h.call('POST','/api/v1/me',{body:{}});assert.equal(wrong.status,405);assert.equal(wrong.headers.get('allow'),'GET');
 const health=await h.call('GET','/api/v1/health');assert.deepEqual({ok:health.json.ok,database:health.json.database,configured:health.json.configured},{ok:true,database:true,configured:true});
 assert(!JSON.stringify(health.json).includes(SECRET));
});

test('unconfigured deployment reports SERVICE_NOT_CONFIGURED instead of failing hard',{skip},async()=>{
 const r=await handleApi(new Request(ORIGIN+'/api/v1/me'),{SITE_URL:ORIGIN});
 assert.equal(r.status,503);assert.equal((await r.json()).error.code,'SERVICE_NOT_CONFIGURED');
 const health=await handleApi(new Request(ORIGIN+'/api/v1/health'),{});
 assert.equal(health.status,200);assert.equal((await health.json()).configured,false);
});

test('daily quota: 0→1, 29→30, 30 denied, then next UTC day resets',{skip},async()=>{
 const h=harness();
 const one=await h.authorize();
 assert.equal(one.status,200);assert.deepEqual({allowed:one.json.allowed,used:one.json.used,limit:one.json.limit,remaining:one.json.remaining},{allowed:true,used:1,limit:30,remaining:29});
 for(let i=2;i<=29;i++)assert.equal((await h.authorize()).json.used,i);
 const thirtieth=await h.authorize();assert.equal(thirtieth.json.allowed,true);assert.equal(thirtieth.json.used,30);assert.equal(thirtieth.json.remaining,0);
 const denied=await h.authorize();
 assert.equal(denied.status,429);
 assert.equal(denied.json.allowed,false);assert.equal(denied.json.reason,'daily_limit');assert.equal(denied.json.error.code,'DAILY_LIMIT');
 assert.equal(denied.json.resetAt,new Date(Date.UTC(2026,8,22)).toISOString());
 assert.equal(h.db.raw.prepare('SELECT used FROM daily_usage WHERE subject_id LIKE ?').get('a:%').used,30,'never exceeds the limit');
 assert.equal((await h.call('GET','/api/v1/usage')).json.usage.remaining,0);
 h.clock.now=Date.UTC(2026,8,22,0,0,1);
 const tomorrow=await h.authorize();assert.equal(tomorrow.json.allowed,true);assert.equal(tomorrow.json.used,1);
});

test('FREE_DAILY_JOBS changes the limit without code changes',{skip},async()=>{
 const h=harness({FREE_DAILY_JOBS:'3'});
 for(let i=0;i<3;i++)assert.equal((await h.authorize()).json.allowed,true);
 assert.equal((await h.authorize()).status,429);
 assert.equal((await h.call('GET','/api/v1/me')).json.usage.limit,3);
});

test('operationId retry never double-charges; reuse for another tool conflicts',{skip},async()=>{
 const h=harness(),op=uuid();
 const a=await h.authorize('upscale',op),b=await h.authorize('upscale',op),c=await h.authorize('upscale',op.toUpperCase());
 assert.deepEqual([a.json.used,b.json.used,c.json.used],[1,1,1]);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM job_authorizations').get().n,1);
 const conflict=await h.authorize('compress',op);assert.equal(conflict.status,409);assert.equal(conflict.json.error.code,'OPERATION_CONFLICT');
 // Denied decisions are also stable on retry.
 const small=harness({FREE_DAILY_JOBS:'1'});await small.authorize();const deniedOp=uuid();
 assert.equal((await small.authorize('upscale',deniedOp)).status,429);
 small.clock.now+=60e3;assert.equal((await small.authorize('upscale',deniedOp)).status,429);
});

test('concurrent tabs cannot exceed the limit',{skip},async()=>{
 const h=harness({FREE_DAILY_JOBS:'30'});await h.call('GET','/api/v1/me');
 const results=await Promise.all(Array.from({length:60},()=>h.authorize()));
 assert.equal(results.filter(r=>r.json.allowed===true).length,30);
 assert.equal(results.filter(r=>r.status===429).length,30);
 assert.deepEqual(results.filter(r=>r.json.allowed).map(r=>r.json.used).sort((a,b)=>a-b),Array.from({length:30},(_,i)=>i+1),'each allowed job has a unique counter value');
});

test('authorize validates tools and rejects anything that is not an id',{skip},async()=>{
 const h=harness();
 assert.equal((await h.authorize('not-a-tool')).json.error.code,'UNKNOWN_TOOL');
 assert.equal((await h.authorize('crop')).json.error.code,'NOT_METERED');
 assert.equal((await h.authorize('upscale','123')).json.error.code,'INVALID_OPERATION');
 for(const extra of [{fileName:'secret.png'},{file:'iVBORw0KGgo='},{size:'1234'},{image:'data:image/png;base64,AAAA'}]){
  const r=await h.authorize('upscale',uuid(),extra);assert.equal(r.status,400,JSON.stringify(extra));assert.equal(r.json.error.code,'BAD_REQUEST');
 }
 const big=await h.call('POST','/api/v1/jobs/authorize',{raw:JSON.stringify({operationId:uuid(),toolId:'upscale',pad:'x'.repeat(5000)})});
 assert.equal(big.status,413);
 const form=await h.call('POST','/api/v1/jobs/authorize',{raw:'toolId=upscale',headers:{'content-type':'application/x-www-form-urlencoded'}});
 assert.equal(form.status,415);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM job_authorizations').get().n,0,'rejected calls create no rows');
});

test('CSRF: state-changing endpoints require our origin',{skip},async()=>{
 const h=harness();await h.call('GET','/api/v1/me');
 assert.equal((await h.authorize()).status,200,'same origin accepted');
 const evil=await h.call('POST','/api/v1/jobs/authorize',{origin:'https://evil.example',body:{operationId:uuid(),toolId:'upscale'}});
 assert.equal(evil.status,403);assert.equal(evil.json.error.code,'FORBIDDEN_ORIGIN');
 const noOrigin=await h.call('POST','/api/v1/jobs/authorize',{origin:null,body:{operationId:uuid(),toolId:'upscale'}});
 assert.equal(noOrigin.status,403);
 const sameSite=await h.call('POST','/api/v1/auth/logout',{headers:{'sec-fetch-site':'same-site'},body:{}});
 assert.equal(sameSite.status,403,'sibling subdomains are not trusted');
 const noOriginFetchMeta=await h.call('POST','/api/v1/auth/logout',{origin:null,headers:{'sec-fetch-site':'same-origin'},body:{}});
 assert.equal(noOriginFetchMeta.status,200);
 for(const path of ['/api/v1/billing/checkout','/api/v1/auth/logout','/api/v1/billing/portal']){
  assert.equal((await h.call('POST',path,{origin:'https://evil.example',body:{}})).status,403,path);
 }
});

test('Pro is unlimited, has no ads, and never touches the daily counter',{skip},async()=>{
 const h=harness({FREE_DAILY_JOBS:'2'}),{id}=await signIn(h);await grantPro(h,id);
 const me=await h.call('GET','/api/v1/me');
 assert.equal(me.json.loggedIn,true);assert.equal(me.json.plan,'pro');assert.equal(me.json.ads,false);assert.deepEqual(me.json.usage,{unlimited:true});
 assert.equal(me.json.user.email,'user@example.test');
 for(let i=0;i<5;i++){const r=await h.authorize();assert.equal(r.json.allowed,true);assert.equal(r.json.unlimited,true);}
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM daily_usage').get().n,0);
});

test('expired Pro falls back to Free; scheduled cancellation stays Pro until period end',{skip},async()=>{
 const h=harness(),{id}=await signIn(h);
 await grantPro(h,id,{end:h.clock.now+3600e3,cancel:1});
 let me=(await h.call('GET','/api/v1/me')).json;
 assert.equal(me.plan,'pro');assert.equal(me.subscription.cancelAtPeriodEnd,true);
 h.clock.now+=3600e3+1;
 me=(await h.call('GET','/api/v1/me')).json;
 assert.equal(me.plan,'free');assert.equal(me.ads,true);assert.equal(me.usage.limit,30);
 // Canceled (incl. after a voluntary refund) keeps the paid period, then Free; paused is never Pro.
 const other=harness(),{id:u2}=await signIn(other);await grantPro(other,u2,{status:'canceled',end:other.clock.now+3600e3});
 assert.equal((await other.call('GET','/api/v1/me')).json.plan,'pro','the paid period of a canceled subscription is honoured');
 other.clock.now+=3600e3+1;
 assert.equal((await other.call('GET','/api/v1/me')).json.plan,'free','canceled and past its period end is Free');
 const third=harness(),{id:pausedUser}=await signIn(third);await grantPro(third,pausedUser,{status:'paused'});
 assert.equal((await third.call('GET','/api/v1/me')).json.plan,'free','paused is not Pro');
 const pastDue=harness(),{id:u3}=await signIn(pastDue);await grantPro(pastDue,u3,{status:'past_due'});
 assert.equal((await pastDue.call('GET','/api/v1/me')).json.plan,'free');
});

test('sessions: only a hash is stored, expiry ends the session, logout deletes it server-side',{skip},async()=>{
 const h=harness(),{token}=await signIn(h);
 const stored=h.db.raw.prepare('SELECT token_hash FROM sessions').get().token_hash;
 assert.equal(stored,await sha256(token));assert.notEqual(stored,token);
 assert.equal((await h.call('GET','/api/v1/me')).json.loggedIn,true);
 const logout=await h.call('POST','/api/v1/auth/logout',{body:{}});
 assert.equal(logout.status,200);
 assert(logout.setCookies.some(c=>c.startsWith('nerulio_session=;')&&c.includes('Max-Age=0')&&c.includes('HttpOnly')));
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
 h.jar.nerulio_session=token;const replay=await h.call('GET','/api/v1/me');
 assert.equal(replay.json.loggedIn,false,'a replayed token is dead');
 assert(replay.setCookies.some(c=>c.startsWith('nerulio_session=;')&&c.includes('Max-Age=0')),'dead session cookie is cleared');
 const e=harness();await signIn(e);e.clock.now+=30*864e5+1;
 assert.equal((await e.call('GET','/api/v1/me')).json.loggedIn,false,'expired session');
 h.jar.nerulio_session='not-a-token';assert.equal((await h.call('GET','/api/v1/me')).json.loggedIn,false);
});

function idToken(claims){const enc=o=>base64url(new TextEncoder().encode(JSON.stringify(o)));return `${enc({alg:'RS256'})}.${enc(claims)}.sig`;}
test('Google OAuth: state + PKCE + nonce, subject-keyed identity, anonymous usage carried over',{skip},async()=>{
 const h=harness({GOOGLE_OAUTH_CLIENT_ID:'client-1',GOOGLE_OAUTH_CLIENT_SECRET:'shh'});
 await h.authorize();await h.authorize();// 2 anonymous jobs today
 await h.authorize('studio-pack-export');// and 1 Studio export (its own counter)
 const start=await h.call('GET','/api/v1/auth/google/start?return=/ko/pricing/');
 assert.equal(start.status,302);
 const loc=new URL(start.headers.get('location'));
 assert.equal(loc.origin+loc.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
 assert.equal(loc.searchParams.get('code_challenge_method'),'S256');
 assert.equal(loc.searchParams.get('redirect_uri'),ORIGIN+'/api/v1/auth/google/callback');
 assert(loc.searchParams.get('state')&&loc.searchParams.get('nonce')&&loc.searchParams.get('code_challenge'));
 const oauthCookie=start.setCookies.find(c=>c.startsWith('nerulio_oauth='));
 assert(oauthCookie.includes('HttpOnly')&&oauthCookie.includes('Path=/api/v1/auth/'));
 // state mismatch is rejected before any token exchange
 const bad=await h.call('GET','/api/v1/auth/google/callback?code=c&state=wrong');
 assert.equal(bad.status,302);assert.match(bad.headers.get('location'),/login=failed&reason=state/);assert.equal(h.outbound.length,0);
 // restart (the failed attempt cleared the cookie) and complete successfully
 const s2=await h.call('GET','/api/v1/auth/google/start?return=/ko/pricing/'),l2=new URL(s2.headers.get('location'));
 let exchanged;
 h.setFetch(async(url,init)=>{exchanged=Object.fromEntries(new URLSearchParams(init.body));return Response.json({id_token:idToken({iss:'https://accounts.google.com',aud:'client-1',exp:Math.floor(h.clock.now/1000)+300,nonce:l2.searchParams.get('nonce'),sub:'1098',email:'a@example.test',email_verified:true,name:'A'})});});
 const ok=await h.call('GET',`/api/v1/auth/google/callback?code=abc&state=${l2.searchParams.get('state')}`);
 assert.equal(ok.status,302);assert.equal(ok.headers.get('location'),'/ko/pricing/?login=ok');
 const verifier=exchanged.code_verifier;
 assert.equal(base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)))),l2.searchParams.get('code_challenge'),'PKCE verifier matches challenge');
 assert.equal(exchanged.client_secret,'shh');
 const session=ok.setCookies.find(c=>c.startsWith('nerulio_session='));
 for(const attr of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert(session.includes(attr),attr);
 const me=(await h.call('GET','/api/v1/me')).json;
 assert.equal(me.loggedIn,true);assert.equal(me.usage.used,2,'signing in is not a quota reset');
 assert.equal(me.studioUsage.used,1,'Studio exports carry over on sign-in too');
 assert.equal(h.db.raw.prepare("SELECT provider_subject FROM users").get().provider_subject,'1098');
 // same Google subject with a different e-mail is the same account
 const s3=await h.call('GET','/api/v1/auth/google/start'),l3=new URL(s3.headers.get('location'));
 h.setFetch(async()=>Response.json({id_token:idToken({iss:'accounts.google.com',aud:'client-1',exp:Math.floor(h.clock.now/1000)+300,nonce:l3.searchParams.get('nonce'),sub:'1098',email:'changed@example.test',email_verified:true})}));
 await h.call('GET',`/api/v1/auth/google/callback?code=x&state=${l3.searchParams.get('state')}`);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM users').get().n,1);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n,1,'re-login replaces the previous session');
});

test('OAuth claim validation and return-path allowlist',()=>{
 const base={iss:'https://accounts.google.com',aud:'c',exp:2e9,nonce:'n',sub:'1'};
 assert.equal(validateClaims(base,{clientId:'c',nonce:'n',now:1e12}),'');
 assert.equal(validateClaims({...base,iss:'https://evil'},{clientId:'c',nonce:'n',now:1e12}),'issuer');
 assert.equal(validateClaims({...base,aud:'other'},{clientId:'c',nonce:'n',now:1e12}),'audience');
 assert.equal(validateClaims({...base,nonce:'x'},{clientId:'c',nonce:'n',now:1e12}),'nonce');
 assert.equal(validateClaims({...base,exp:1},{clientId:'c',nonce:'n',now:1e12}),'expired');
 for(const bad of ['//evil.com','https://evil.com','/\\evil','javascript:alert(1)','','/a b'])assert.equal(safeReturnPath(bad),'/account/',bad);
 assert.equal(safeReturnPath('/ja/pricing/'),'/ja/pricing/');
});

async function sandboxWebhook(h,event,{secret='whsec-test',t=Math.floor(h.clock.now/1000),tamper=false}={}){
 const body=JSON.stringify(event);
 const sig=await signSandbox(secret,body,t);
 return h.call('POST','/api/v1/billing/webhook',{raw:tamper?body.replace('pro','PRO'):body,origin:null,headers:{[SANDBOX_SIGNATURE]:sig,'content-type':'application/json'}});
}
const subEvent=(userId,over={})=>({id:'evt-'+uuid(),type:'subscription.updated',occurredAt:new Date(DAY0).toISOString(),data:{subscriptionId:'sub-1',customerId:'cus-1',userId,plan:'pro',status:'active',currentPeriodEnd:new Date(DAY0+30*864e5).toISOString(),cancelAtPeriodEnd:false,...over}});

test('billing webhook: signature required, activation is webhook-driven and idempotent',{skip},async()=>{
 const h=harness({BILLING_PROVIDER:'sandbox',BILLING_WEBHOOK_SECRET:'whsec-test'}),{id}=await signIn(h);
 // Checkout alone never grants Pro.
 const checkout=await h.call('POST','/api/v1/billing/checkout',{body:{}});
 assert.equal(checkout.status,200);assert.match(checkout.json.url,/^https:\/\/nerulio\.test\/account\/\?checkout=sandbox/);
 assert.equal((await h.call('GET','/api/v1/me')).json.plan,'free','redirect/checkout is not entitlement');
 const event=subEvent(id);
 assert.equal((await sandboxWebhook(h,event,{secret:'wrong'})).status,401);
 assert.equal((await sandboxWebhook(h,event,{tamper:true})).status,401);
 assert.equal((await sandboxWebhook(h,event,{t:Math.floor(h.clock.now/1000)-3600})).status,401,'stale signature');
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM subscriptions').get().n,0);
 const first=await sandboxWebhook(h,event);assert.equal(first.status,200);assert.equal(first.json.duplicate,false);
 assert.equal((await h.call('GET','/api/v1/me')).json.plan,'pro');
 const dup=await sandboxWebhook(h,event);assert.equal(dup.json.duplicate,true);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM billing_events').get().n,1);
 // An older event delivered late cannot overwrite newer state.
 await sandboxWebhook(h,subEvent(id,{status:'canceled',currentPeriodEnd:null}),{});// same occurredAt → applies (>=)
 let cur=(await h.call('GET','/api/v1/me')).json;
 assert.equal(cur.subscription.status,'canceled');assert.equal(cur.plan,'pro','canceled keeps the stored paid period');
 const newer={...subEvent(id,{status:'active'}),occurredAt:new Date(DAY0+1000).toISOString()};await sandboxWebhook(h,newer);
 const older={...subEvent(id,{status:'canceled'}),occurredAt:new Date(DAY0-1000).toISOString()};await sandboxWebhook(h,older);
 assert.equal((await h.call('GET','/api/v1/me')).json.plan,'pro','out-of-order older event ignored');
 // Scheduled cancellation keeps Pro until period end.
 await sandboxWebhook(h,{...subEvent(id,{cancelAtPeriodEnd:true}),occurredAt:new Date(DAY0+2000).toISOString()});
 const me=(await h.call('GET','/api/v1/me')).json;assert.equal(me.plan,'pro');assert.equal(me.subscription.cancelAtPeriodEnd,true);
 // Unknown user → recorded as ignored, nothing granted.
 await sandboxWebhook(h,{...subEvent('ghost',{subscriptionId:'sub-ghost'})});
 assert.equal(h.db.raw.prepare("SELECT state FROM billing_events WHERE event_type='subscription.updated' ORDER BY processed_at DESC, rowid DESC LIMIT 1").get()?.state!==undefined,true);
 assert.equal(h.db.raw.prepare("SELECT COUNT(*) n FROM subscriptions WHERE external_subscription_id='sub-ghost'").get().n,0);
 assert.equal((await h.call('POST','/api/v1/billing/checkout',{body:{}})).json.error.code,'ALREADY_PRO');
});

test('billing safety: sandbox refused on production builds, live refused on previews, checkout needs login',{skip},async()=>{
 assert.equal(runtimeConfig({BILLING_PROVIDER:'sandbox'},{preview:false}).billing.mode,'off');
 assert.equal(runtimeConfig({BILLING_PROVIDER:'sandbox',NERULIO_ENV:'development'},{preview:false}).billing.mode,'sandbox');
 assert.equal(runtimeConfig({BILLING_PROVIDER:'sandbox'},{preview:true}).billing.mode,'sandbox');
 const paddleEnv={BILLING_PROVIDER:'paddle',BILLING_API_KEY:'k',BILLING_WEBHOOK_SECRET:'w',BILLING_PRICE_ID:'pri_1'};
 assert.equal(runtimeConfig({...paddleEnv,BILLING_MODE:'live'},{preview:true}).billing.mode,'off');
 assert.equal(runtimeConfig({...paddleEnv,BILLING_MODE:'live'},{preview:false}).billing.mode,'live');
 assert.equal(runtimeConfig({...paddleEnv,BILLING_MODE:'sandbox'},{preview:true}).billing.mode,'sandbox');
 assert.equal(runtimeConfig({BILLING_PROVIDER:'paddle'},{preview:false}).billing.mode,'off','no credentials → off, never fake');
 const h=harness({BILLING_PROVIDER:'sandbox',BILLING_WEBHOOK_SECRET:'whsec-test'});
 assert.equal((await h.call('POST','/api/v1/billing/checkout',{body:{}})).json.error.code,'LOGIN_REQUIRED');
 const off=harness();await signIn(off);
 assert.equal((await off.call('POST','/api/v1/billing/checkout',{body:{}})).json.error.code,'BILLING_UNAVAILABLE');
 assert.equal((await off.call('POST','/api/v1/billing/webhook',{raw:'{}',origin:null})).status,503);
});

test('Paddle adapter: signature verification and normalization',async()=>{
 const env={BILLING_WEBHOOK_SECRET:'pdl_ntfset_secret',BILLING_PRICE_ID:'pri_pro'};
 const body=JSON.stringify({event_id:'evt_1',event_type:'subscription.updated',occurred_at:'2026-09-21T10:00:00Z',data:{id:'sub_1',status:'active',customer_id:'ctm_1',custom_data:{nerulio_user_id:'u1'},items:[{price:{id:'pri_pro'}}],current_billing_period:{ends_at:'2026-10-21T10:00:00Z'},scheduled_change:{action:'cancel'}}});
 const ts=Math.floor(DAY0/1000),h1=await hmacHex(env.BILLING_WEBHOOK_SECRET,`${ts}:${body}`);
 const headers=new Headers({'paddle-signature':`ts=${ts};h1=${h1}`});
 assert.equal(await paddle.verifyWebhook({headers,body,env,now:DAY0}),true);
 assert.equal(await paddle.verifyWebhook({headers,body:body+' ',env,now:DAY0}),false);
 assert.equal(await paddle.verifyWebhook({headers,body,env,now:DAY0+3600e3}),false,'replay window');
 const e=paddle.normalizeWebhook(JSON.parse(body),env);
 assert.deepEqual(e.subscription,{externalSubscriptionId:'sub_1',externalCustomerId:'ctm_1',userId:'u1',plan:'pro',priceId:'pri_pro',status:'active',currentPeriodEnd:Date.parse('2026-10-21T10:00:00Z'),cancelAtPeriodEnd:true});
 assert.equal(paddle.normalizeWebhook({...JSON.parse(body),data:{...JSON.parse(body).data,items:[{price:{id:'pri_other'}}]}},env).subscription.plan,'other');
});

test('Turnstile: only suspicious anonymous traffic is challenged, verified server-side',{skip},async()=>{
 const h=harness({FREE_DAILY_JOBS:'100',ANON_NETWORK_DAILY_JOBS:'3',TURNSTILE_SITE_KEY:'0x4-site',TURNSTILE_SECRET_KEY:'0x4-secret'});
 const ip={'cf-connecting-ip':'203.0.113.9'};
 const run=(extra={})=>h.call('POST','/api/v1/jobs/authorize',{headers:ip,body:{operationId:uuid(),toolId:'upscale',...extra}});
 for(let i=0;i<3;i++)assert.equal((await run()).status,200,'normal use is never challenged');
 delete h.jar.nerulio_anon;// a "fresh identity" from the same network
 const challenged=await run();assert.equal(challenged.status,403);assert.equal(challenged.json.error.code,'CHALLENGE_REQUIRED');assert.equal(challenged.json.error.siteKey,'0x4-site');
 let sent;h.setFetch(async(url,init)=>{sent={url,form:Object.fromEntries(init.body)};return Response.json({success:false});});
 assert.equal((await run({turnstileToken:'bad'})).json.error.code,'CHALLENGE_FAILED');
 assert.equal(sent.url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(sent.form.secret,'0x4-secret');assert.equal(sent.form.remoteip,'203.0.113.9');
 h.setFetch(async()=>Response.json({success:true,action:'quota',hostname:'nerulio.test'}));
 const ok=await run({turnstileToken:'good'});assert.equal(ok.status,200);
 assert(ok.setCookies.some(c=>c.startsWith('nerulio_human=')&&c.includes('HttpOnly')));
 h.setFetch(async()=>{throw Error('no more challenges expected');});
 assert.equal((await run()).status,200,'a verified human is not asked again');
 // Signed-in users and Pro are never challenged by the network bucket.
 const subject=await networkSubject('203.0.113.9',SECRET,DAY0);assert.match(subject,/^n:[0-9a-f]{32}$/);assert(!subject.includes('203'));
 const v6=await networkSubject('2001:db8:1:2:aaaa::1',SECRET,DAY0);assert.equal(v6,await networkSubject('2001:db8:1:2:bbbb::9',SECRET,DAY0),'IPv6 bucketed by /64');
 // Without Turnstile configured nobody is challenged.
 const plain=harness({FREE_DAILY_JOBS:'100',ANON_NETWORK_DAILY_JOBS:'1'});
 for(let i=0;i<3;i++){delete plain.jar.nerulio_anon;assert.equal((await plain.call('POST','/api/v1/jobs/authorize',{headers:ip,body:{operationId:uuid(),toolId:'upscale'}})).status,200);}
});

test('admin stats are aggregate-only and hidden from non-admins',{skip},async()=>{
 const h=harness({ADMIN_GOOGLE_SUBJECTS:'admin-sub'});
 assert.equal((await h.call('GET','/api/v1/admin/stats')).status,404);
 await signIn(h,{subject:'someone'});assert.equal((await h.call('GET','/api/v1/admin/stats')).status,404);
 const a=harness({ADMIN_GOOGLE_SUBJECTS:'admin-sub'});await a.authorize();await a.authorize('studio-tile-export');await a.authorize('studio-tile-export');await signIn(a,{subject:'admin-sub'});
 const stats=await a.call('GET','/api/v1/admin/stats');
 assert.equal(stats.status,200);assert.equal(stats.json.users,1);assert.equal(stats.json.freeHeavyJobsToday,1);assert.equal(stats.json.freeStudioExportsToday,2);
 assert(!JSON.stringify(stats.json).includes('@'),'no personal data');
 a.clock.now+=13*3600e3;assert.equal((await a.call('GET','/api/v1/admin/stats')).status,404,'admin must have signed in recently');
});

test('Worker entry routes /api/v1 to the API and everything else to static assets',{skip},async()=>{
 const seen=[];const env={ASSETS:{fetch:async r=>{seen.push(new URL(r.url).pathname);return new Response('<html><script src="x.js"></script></html>',{headers:{'content-type':'text/html'}});}}};
 const health=await worker.fetch(new Request(ORIGIN+'/api/v1/health'),env,{waitUntil(){}});
 assert.equal(health.status,200);assert.equal((await health.json()).configured,false);
 const other=await worker.fetch(new Request(ORIGIN+'/api/v2/x'),env,{});assert.equal(other.status,404);
 const page=await worker.fetch(new Request(ORIGIN+'/en/image/crop/'),env,{});
 assert.deepEqual(seen,['/en/image/crop/']);assert.equal(await page.text(),'<html><script src="x.js"></script></html>','no rewrite in non-ad builds');
});

test('Studio exports: own daily counter (FREE_DAILY_STUDIO_EXPORTS), separate from file-tool heavy jobs',{skip},async()=>{
 const h=harness({FREE_DAILY_JOBS:'2',FREE_DAILY_STUDIO_EXPORTS:'3'});
 let me=(await h.call('GET','/api/v1/me')).json;
 assert.deepEqual({used:me.studioUsage.used,limit:me.studioUsage.limit,remaining:me.studioUsage.remaining},{used:0,limit:3,remaining:3});
 for(let i=1;i<=3;i++){const r=await h.authorize(i===2?'studio-tile-export':i===3?'studio-texture-export':'studio-pack-export');assert.equal(r.status,200);assert.deepEqual([r.json.allowed,r.json.used,r.json.remaining,r.json.kind],[true,i,3-i,'studio']);}
 const denied=await h.authorize('studio-pack-export');
 assert.equal(denied.status,429);assert.equal(denied.json.error.code,'DAILY_LIMIT');assert.equal(denied.json.kind,'studio');assert.equal(denied.json.limit,3);
 assert.equal(denied.json.resetAt,new Date(Date.UTC(2026,8,22)).toISOString());
 // the file tools' counter is untouched by Studio exports, and vice versa
 assert.equal((await h.authorize('upscale')).json.used,1);assert.equal((await h.authorize('upscale')).json.used,2);assert.equal((await h.authorize('upscale')).status,429);
 me=(await h.call('GET','/api/v1/me')).json;
 assert.equal(me.usage.used,2);assert.equal(me.studioUsage.used,3);assert.equal(me.studioUsage.remaining,0);
 const usage=(await h.call('GET','/api/v1/usage')).json;assert.equal(usage.studioUsage.remaining,0);assert.equal(usage.usage.remaining,0);
 assert.equal(h.db.raw.prepare("SELECT used FROM daily_usage WHERE subject_id LIKE 'a:%#studio'").get().used,3,'never exceeds the Studio limit');
 h.clock.now=Date.UTC(2026,8,22,0,0,1);
 assert.equal((await h.authorize('studio-pack-export')).json.used,1,'resets at 00:00 UTC');
});
test('Studio: light actions are never metered, unknown ids are rejected, Pro is unlimited',{skip},async()=>{
 const h=harness({FREE_DAILY_STUDIO_EXPORTS:'1'});
 for(const id of ['studio-import','studio-save-project','studio-autosave','studio-aseprite-export','studio-texture-quick-png','studio-pack-preview'])assert.equal((await h.authorize(id)).json.error.code,'NOT_METERED',id);
 assert.equal((await h.authorize('studio-anything')).json.error.code,'UNKNOWN_TOOL');
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM daily_usage').get().n,0);
 const p=harness({FREE_DAILY_STUDIO_EXPORTS:'1'}),{id}=await signIn(p);await grantPro(p,id);
 const me=(await p.call('GET','/api/v1/me')).json;assert.deepEqual(me.studioUsage,{unlimited:true});assert.equal(me.ads,false);
 for(let i=0;i<4;i++){const r=await p.authorize('studio-pack-export');assert.equal(r.json.allowed,true);assert.equal(r.json.unlimited,true);}
 assert.equal(p.db.raw.prepare('SELECT COUNT(*) n FROM daily_usage').get().n,0);
});
test('Studio export limit config: default 10, invalid values fall back, network soft limit covers both counters',()=>{
 assert.equal(runtimeConfig({}).freeDailyStudio,10);assert.equal(runtimeConfig({FREE_DAILY_STUDIO_EXPORTS:'25'}).freeDailyStudio,25);
 for(const v of ['0','-1','abc','10001','2.5'])assert.equal(runtimeConfig({FREE_DAILY_STUDIO_EXPORTS:v}).freeDailyStudio,10,v);
 assert.equal(runtimeConfig({FREE_DAILY_JOBS:'30',FREE_DAILY_STUDIO_EXPORTS:'10'}).anonNetworkSoftLimit,160);
});
