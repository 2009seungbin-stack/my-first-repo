import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {handlePlatformApi} from '../server/platform/api.js';
import {requireAdmin} from '../server/platform/admin.js';
import {COLLECTORS,RUNNABLE,STATUS_ADAPTERS,nextRun,collectorState} from '../server/platform/admin-collectors.js';
import {normalizePrefs,inQuiet,DEFAULT_PREFS,seoulDayStart} from '../server/platform/admin-notify.js';
import {recordRun} from '../platform/collector-health.js';
import {sha256,base64url} from '../server/crypto.js';
import {createLimiter} from '../server/ratelimit.js';
import {ingest} from '../platform/ingest.js';
import {generateAdminKeys} from '../tools/admin-keys.mjs';
import {STATUS_ADAPTERS as PLAN_STATUS,STATUS_SCHEDULE} from '../tools/platform/collector-plan.mjs';
import {SoftAuthenticator} from './passkey-authenticator.mjs';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const ORIGIN='https://nerulio.test',SECRET='test-session-secret-0123456789abcdef-0123456789',CODE='setup-code-0123456789-abcdef';
// 2026-09-29 03:00 UTC = 12:00 KST (outside the default quiet hours 23:00–07:00 KST).
const T0=Date.UTC(2026,8,29,3,0),HOUR=36e5,DAY=864e5;
const KEYS=await generateAdminKeys();
const ACCOUNT='0123456789abcdef0123456789abcdef';
const src=[{id:'src:official',kind:'OFFICIAL',url:'https://example.com/spec',retrieved:'2026-09-01'},{id:'src:forum',kind:'COMMUNITY',url:'https://forum.example.com/t/1',retrieved:'2026-09-01'}];
const SEED={schema:'nerulio.seed/1',vertical:'games',sources:src,entities:[
 {id:'game:steam-1',type:'game',slug:'test-game',names:{en:'Test Game',ko:'테스트 게임'},facts:[{p:'korean_official',v:'none',ver:'OFFICIAL',src:'src:official'}]}]};
/** Every admin endpoint (method, path, body). */
const ADMIN_ENDPOINTS=[['GET','/admin/me'],['GET','/admin/overview'],['GET','/admin/collectors'],['GET','/admin/collectors/steam-news/runs'],['POST','/admin/collectors/run',{adapters:['steam-news']}],
 ['GET','/admin/usage'],['GET','/admin/radar'],['POST','/admin/radar/action',{kind:'change',id:1,action:'hide',reason:'테스트'}],['GET','/admin/community'],['GET','/admin/traffic'],
 ['GET','/admin/push/key'],['POST','/admin/push/subscribe',{}],['DELETE','/admin/push/subscribe',{endpoint:'x'}],['GET','/admin/push/prefs'],['PUT','/admin/push/prefs',{prefs:{}}],['POST','/admin/push/test',{}],['POST','/admin/passkey/remove',{id:'x'}]];

async function harness(extraEnv={}){
 const db=D1Shim.migrated(),clock={now:T0},limiter=createLimiter();
 await ingest(db,SEED,{mode:'seed',actor:'seed',now:T0-30*DAY});
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,ADMIN_SETUP_CODE:CODE,...extraEnv};
 const waits=[],ctx={waitUntil:p=>waits.push(p)},fetched=[];
 const h={db,env,clock,waits,fetched,
  /** Upstream stub: GitHub, Cloudflare GraphQL, push services. */
  upstream:async(url,init)=>new Response(null,{status:201}),
  browser(){
   const jar=new Map();
   const b={jar,
    async call(method,path,{body,origin=ORIGIN,headers={}}={}){
     const hd=new Headers(headers);
     if(jar.size)hd.set('cookie',[...jar].map(([k,v])=>`${k}=${v}`).join('; '));
     if(method!=='GET'&&origin)hd.set('origin',origin);
     if(body!==undefined)hd.set('content-type','application/json');
     const r=await handlePlatformApi(new Request(ORIGIN+'/api/v2'+path,{method,headers:hd,body:body!==undefined?JSON.stringify(body):undefined}),env,ctx,{now:()=>clock.now,limiter,fetch:async(url,init)=>{fetched.push({url:String(url),init});return h.upstream(String(url),init);}});
     for(const sc of r.headers.getSetCookie()){const [kv,...attrs]=sc.split(';');const i=kv.indexOf('=');const k=kv.slice(0,i).trim(),v=kv.slice(i+1).trim();if(attrs.some(a=>/max-age=0/i.test(a))||v==='')jar.delete(k);else jar.set(k,v);}
     const text=await r.text();
     return {status:r.status,headers:r.headers,text,json:text?JSON.parse(text):null};
    }};
   return b;
  },
  /** A normal (Google) member with a session. */
  async member(name,{role}={}){
   const b=h.browser(),id='u-'+name,token=base64url(crypto.getRandomValues(new Uint8Array(32)));
   db.raw.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?,?,?,'google',?,?)").run(id,`${name}@example.test`,name,'sub-'+name,clock.now-DAY);
   db.raw.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(await sha256(token),id,clock.now,clock.now+30*DAY);
   if(role)db.raw.prepare("INSERT INTO user_profiles(user_id,display_name,role,created_at,updated_at) VALUES(?,?,?,?,?)").run(id,name,role,clock.now,clock.now);
   b.jar.set('nerulio_session',token);b.userId=id;return b;
  },
  /** First admin: setup code + passkey. */
  async admin(auth=new SoftAuthenticator()){
   const b=h.browser();
   const o=await b.call('POST','/admin/passkey/register/options',{body:{setupCode:CODE}});
   assert.equal(o.status,200,o.text);
   const cred=await auth.create(o.json,{origin:ORIGIN});
   const v=await b.call('POST','/admin/passkey/register/verify',{body:{credential:cred,name:'Pixel 9'}});
   assert.equal(v.status,200,v.text);assert.deepEqual(v.json,{ok:true});
   b.auth=auth;b.credentialId=cred.id;return b;
  },
  async login(auth,b=h.browser(),o={}){
   const opt=await b.call('POST','/admin/passkey/login/options',{body:{}});
   assert.equal(opt.status,200,opt.text);
   const a=await auth.get(opt.json,{origin:ORIGIN,...o}),nonce=b.jar.get('nerulio_webauthn');
   return {b,res:await b.call('POST','/admin/passkey/login/verify',{body:{credential:a}}),assertion:a,nonce};
  },
  async subscribe(b,prefs){
   const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
   const sub={endpoint:`https://fcm.googleapis.com/fcm/send/${base64url(crypto.getRandomValues(new Uint8Array(12)))}`,keys:{p256dh:base64url(await crypto.subtle.exportKey('raw',ua.publicKey)),auth:base64url(crypto.getRandomValues(new Uint8Array(16)))}};
   const r=await b.call('POST','/admin/push/subscribe',{body:{subscription:sub,...(prefs?{prefs}:{})}});
   assert.equal(r.status,200,r.text);return sub;
  },
  pushes(){return fetched.filter(f=>f.url.startsWith('https://fcm.googleapis.com/'));}
 };
 return h;
}
const vapidEnv={VAPID_PUBLIC_KEY:KEYS.VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY:KEYS.VAPID_PRIVATE_KEY,VAPID_SUBJECT:'mailto:ops@nerulio.test',NOTIFY_TOKEN:KEYS.NOTIFY_TOKEN};

test('every admin endpoint is 404 to visitors and members (even moderators), unknown admin paths too',{skip},async()=>{
 const h=await harness();
 const anon=h.browser(),member=await h.member('m'),mod=await h.member('mo',{role:'moderator'});
 for(const b of [anon,member,mod])for(const [m,p,body] of ADMIN_ENDPOINTS){
  const r=await b.call(m,p,{body});
  assert.equal(r.status,404,`${m} ${p}: ${r.text}`);assert.equal(r.json.error.code,'NOT_FOUND');
 }
 for(const [m,p] of [['GET','/admin'],['GET','/admin/nope'],['PATCH','/admin/me'],['POST','/admin/me'],['GET','/admin/passkey/login/options']])assert.equal((await member.call(m,p,{body:m==='GET'?undefined:{}})).status,404,`${m} ${p}`);
});

test('first passkey: setup code required (constant-time, rate limited), then the path closes',{skip},async()=>{
 const none=await harness({ADMIN_SETUP_CODE:''});
 const r0=await none.browser().call('POST','/admin/passkey/register/options',{body:{setupCode:'x'}});
 assert.equal(r0.status,503);assert.equal(r0.json.error.code,'NOT_CONFIGURED');assert.equal(r0.json.error.need,'ADMIN_SETUP_CODE');
 const short=await harness({ADMIN_SETUP_CODE:'short'});
 assert.equal((await short.browser().call('POST','/admin/passkey/register/options',{body:{setupCode:'short'}})).json.error.need,'ADMIN_SETUP_CODE','a guessable code does not count');
 const h=await harness(),b=h.browser();
 assert.equal((await b.call('POST','/admin/passkey/register/options',{body:{setupCode:CODE},origin:'https://evil.example'})).status,403,'cross-site');
 const bad=await b.call('POST','/admin/passkey/register/options',{body:{setupCode:CODE+'x'}});
 assert.equal(bad.status,403);assert.equal(bad.json.error.code,'FORBIDDEN');
 assert.equal((await b.call('POST','/admin/passkey/register/options',{body:{}})).status,403);
 const statuses=[];for(let i=0;i<5;i++)statuses.push((await b.call('POST','/admin/passkey/register/options',{body:{setupCode:'wrong-'+i}})).status);
 assert.deepEqual(statuses,[403,403,403,429,429],'5 setup attempts per minute per network (2 were made above)');
 h.clock.now+=61e3;
 const admin=await h.admin();
 const me=await admin.call('GET','/admin/me');
 assert.equal(me.status,200,me.text);assert.equal(me.json.admin,true);assert.equal(me.json.devices.length,1);assert.equal(me.json.devices[0].name,'Pixel 9');
 assert.equal(me.json.name,'운영자');
 const u=h.db.raw.prepare("SELECT u.provider,p.role FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.provider='passkey'").get();
 assert.deepEqual({...u},{provider:'passkey',role:'admin'});
 // Once a credential exists the setup code opens nothing, for anyone.
 h.clock.now+=61e3;
 const again=await h.browser().call('POST','/admin/passkey/register/options',{body:{setupCode:CODE}});
 assert.equal(again.status,404);
 // The admin uses the normal moderation endpoints with the same session.
 assert.equal((await admin.call('GET','/mod/queue')).status,200);
 assert(!me.text.includes(CODE)&&!me.text.includes(SECRET));
});

test('passkey sign-in on a new browser; replay, missing nonce cookie and 12 h re-auth',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 const {b,res,assertion,nonce}=await h.login(admin.auth);
 assert.equal(res.status,200,res.text);assert(b.jar.get('nerulio_session'));assert(!b.jar.has('nerulio_webauthn'),'nonce cookie cleared');
 assert.equal((await b.call('GET','/admin/overview')).status,200);
 // The same assertion again is refused: without the (cleared) nonce cookie, and with it restored
 // (the used challenge is remembered in D1 until it expires).
 assert.equal((await b.call('POST','/admin/passkey/login/verify',{body:{credential:assertion}})).json.error.code,'PASSKEY_REJECTED');
 b.jar.set('nerulio_webauthn',nonce);
 const replay=await b.call('POST','/admin/passkey/login/verify',{body:{credential:assertion}});
 assert.equal(replay.status,409,replay.text);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.provider=?').get('passkey').n,2,'no session from the replay');
 // No nonce cookie: the challenge was not issued to this browser.
 const other=h.browser();const opt=await other.call('POST','/admin/passkey/login/options',{body:{}});
 const a=await admin.auth.get(opt.json,{origin:ORIGIN});other.jar.delete('nerulio_webauthn');
 const r=await other.call('POST','/admin/passkey/login/verify',{body:{credential:a}});
 assert.equal(r.status,400);assert.equal(r.json.error.code,'PASSKEY_REJECTED');
 // Wrong origin inside clientDataJSON.
 const o2=h.browser();const opt2=await o2.call('POST','/admin/passkey/login/options',{body:{}});
 assert.equal((await o2.call('POST','/admin/passkey/login/verify',{body:{credential:await admin.auth.get(opt2.json,{origin:'https://evil.example'})}})).json.error.code,'PASSKEY_REJECTED');
 // An unknown passkey signs nobody in.
 const stranger=new SoftAuthenticator();await stranger.create({rp:{id:'nerulio.test'},user:{id:'eA'},challenge:'eA'},{origin:ORIGIN});
 assert.equal((await h.login(stranger)).res.json.error.code,'PASSKEY_REJECTED');
 // 12 h later: REAUTH on admin endpoints, the passkey signs in again.
 h.clock.now+=12*HOUR+1;
 const stale=await b.call('GET','/admin/overview');
 assert.equal(stale.status,401);assert.equal(stale.json.error.code,'REAUTH');
 assert.equal((await h.login(admin.auth,b)).res.status,200);
 assert.equal((await b.call('GET','/admin/overview')).status,200);
 // Expired challenge (5 minutes).
 const late=h.browser();const opt3=await late.call('POST','/admin/passkey/login/options',{body:{}});
 const a3=await admin.auth.get(opt3.json,{origin:ORIGIN});h.clock.now+=5*60e3+1;
 assert.equal((await late.call('POST','/admin/passkey/login/verify',{body:{credential:a3}})).json.error.code,'PASSKEY_REJECTED');
 // Losing the admin role disables the passkey.
 h.db.raw.prepare("UPDATE user_profiles SET role='user' WHERE role='admin'").run();
 assert.equal((await h.login(admin.auth)).res.json.error.code,'PASSKEY_REJECTED');
});

test('another device is added only by a signed-in admin; the last passkey cannot be removed',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 const opt=await admin.call('POST','/admin/passkey/register/options',{body:{}});
 assert.equal(opt.status,200,opt.text);assert.equal(opt.json.excludeCredentials.length,1);
 const phone2=new SoftAuthenticator({alg:'RS256'});
 const cred=await phone2.create(opt.json,{origin:ORIGIN});
 // Another browser cannot finish this ceremony (no nonce cookie, not signed in).
 assert.notEqual((await h.browser().call('POST','/admin/passkey/register/verify',{body:{credential:cred}})).status,200);
 const v=await admin.call('POST','/admin/passkey/register/verify',{body:{credential:cred,name:'태블릿'}});
 assert.equal(v.status,200,v.text);
 const me=await admin.call('GET','/admin/me');assert.equal(me.json.devices.length,2);
 assert.equal((await h.login(phone2)).res.status,200,'the new device signs in');
 assert.equal((await admin.call('POST','/admin/passkey/remove',{body:{id:cred.id}})).status,200);
 const last=await admin.call('POST','/admin/passkey/remove',{body:{id:admin.credentialId}});
 assert.equal(last.status,409);
 // A stale admin session cannot add devices.
 h.clock.now+=13*HOUR;
 assert.equal((await admin.call('POST','/admin/passkey/register/options',{body:{}})).json.error.code,'REAUTH');
});

test('collector registry matches the adapters and the workflow',{skip},async()=>{
 const dirs=readdirSync(new URL('../collectors/',import.meta.url),{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('_')).map(d=>d.name).sort();
 assert.deepEqual(COLLECTORS.filter(c=>c.id!=='ecb-fx').map(c=>c.id).sort(),dirs);
 for(const id of dirs){
  const a=(await import(new URL(`../collectors/${id}/index.js`,import.meta.url))).default,def=COLLECTORS.find(c=>c.id===id);
  assert.equal(def.vertical,a.vertical,id);assert.equal(def.mode,a.mode||'auto',id);assert.equal(def.freshnessHours,a.freshnessHours,id);
  assert.equal(def.schedule,a.mode==='manual'?'manual':STATUS_ADAPTERS.includes(id)?'30m':'6h',id);
 }
 const wf=readFileSync(new URL('../.github/workflows/collectors.yml',import.meta.url),'utf8');
 assert.match(wf,/\*\/30 \* \* \* \*/);assert.match(wf,/17 \*\/6 \* \* \*/);
 assert(!RUNNABLE.includes('ecb-fx')&&!RUNNABLE.includes('gpu-specs-manual'));
 assert.deepEqual([...STATUS_ADAPTERS],[...PLAN_STATUS],'the 30-minute adapters are the ones collector-plan runs');assert.equal(STATUS_SCHEDULE,'11,41 * * * *');
 // The notify job: its own job, after the collectors, silent without NOTIFY_URL / NOTIFY_TOKEN.
 const job=wf.slice(wf.search(/^  notify:/m));
 assert(job.length>10,'notify job exists');
 assert.match(job,/needs: \[plan, collect, fx\]/);assert.match(job,/always\(\)/);assert.match(job,/secrets\.NOTIFY_TOKEN/);assert.match(job,/vars\.NOTIFY_URL/);
 assert.match(job,/\/api\/v2\/admin\/notify/);assert.match(job,/"kind":"tick"/);assert.match(job,/collector_failed/);assert.match(job,/exit 0/);
 // Next runs (UTC): :00/:30, and :17 past 00/06/12/18.
 assert.equal(nextRun('30m',Date.UTC(2026,8,29,8,31)),Date.UTC(2026,8,29,9,0));
 assert.equal(nextRun('6h',Date.UTC(2026,8,29,8,50)),Date.UTC(2026,8,29,12,17));
 assert.equal(nextRun('6h',Date.UTC(2026,8,29,6,10)),Date.UTC(2026,8,29,6,17));
 assert.equal(nextRun('manual',T0),null);
});

test('collectors: states (a collector without a run record is a problem), runs with rows written',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 const def=id=>COLLECTORS.find(c=>c.id===id);
 await recordRun(h.db,def('claude-status'),{started:T0-20*60e3,finished:T0-19*60e3,error:null,observations:3,changes:2,rowsWritten:40,queries:12});
 await recordRun(h.db,def('steam-news'),{started:T0-HOUR,finished:T0-HOUR+5e3,error:'ingest: D1 REST: daily row write limit',observations:0,changes:0});
 await recordRun(h.db,def('openai-status'),{started:T0-3*HOUR,finished:T0-3*HOUR,error:null,observations:1,changes:0});
 const r=await admin.call('GET','/admin/collectors');
 assert.equal(r.status,200,r.text);
 const by=Object.fromEntries(r.json.items.map(x=>[x.id,x]));
 assert.equal(by['claude-status'].state,'ok');assert.equal(by['claude-status'].rows_written,40);assert.equal(by['claude-status'].changes,2);assert.equal(by['claude-status'].schedule,'30m');
 assert.equal(by['claude-status'].next_run_at,Date.UTC(2026,8,29,3,30));
 assert.equal(by['steam-news'].state,'failing');assert.match(by['steam-news'].last_error,/write limit/);
 assert.equal(by['openai-status'].state,'stale');
 assert.equal(by['steam-store'].state,'never');assert.equal(by['gpu-specs-manual'].state,'manual');
 assert.equal(r.json.items[0].state,'failing','problems first');
 const runs=await admin.call('GET','/admin/collectors/claude-status/runs?limit=5');
 assert.deepEqual(runs.json.items.map(x=>[x.rows_written,x.queries,x.observations,x.changes,x.error]),[[40,12,3,2,null]]);
 assert.equal((await admin.call('GET','/admin/collectors/steam-news/runs')).json.items[0].rows_written,null,'old runs have no count');
 assert.equal((await admin.call('GET','/admin/collectors/..%2Fx/runs')).status,404);
 const ov=await admin.call('GET','/admin/overview');
 assert.equal(ov.json.collectors.failing,1);assert.equal(ov.json.collectors.stale,1);assert.equal(ov.json.collectors.manual,6);assert.equal(ov.json.collectors.ok,1);
 assert.equal(ov.json.collectors.never,COLLECTORS.length-9);
 assert.deepEqual(ov.json.collectors.items.slice(0,1).map(x=>x.id),['steam-news']);
 assert.equal(collectorState(def('steam-news'),null,T0),'never');
});

test('collectors/run dispatches the workflow with the chosen adapters, or says what is missing',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 const nc=await admin.call('POST','/admin/collectors/run',{body:{adapters:['steam-news']}});
 assert.equal(nc.status,503);assert.deepEqual(nc.json.error.need,'GITHUB_DISPATCH_TOKEN');assert.deepEqual([nc.json.need,nc.json.missing],['GITHUB_DISPATCH_TOKEN',['GITHUB_DISPATCH_TOKEN']]);
 const token='github_pat_TESTTOKEN_0123456789';h.env.GITHUB_DISPATCH_TOKEN=token;
 for(const adapters of [[],['gpu-specs-manual'],['ecb-fx'],['nope'],'steam-news',[1]])assert.equal((await admin.call('POST','/admin/collectors/run',{body:{adapters}})).status,400,JSON.stringify(adapters));
 h.upstream=async()=>new Response(null,{status:204});
 const ok=await admin.call('POST','/admin/collectors/run',{body:{adapters:['steam-news','steam-store','steam-news']}});
 assert.equal(ok.status,200,ok.text);assert.equal(ok.json.ok,true);assert.match(ok.json.runUrl,/^https:\/\/github\.com\/2009seungbin-stack\/my-first-repo\/actions/);
 const call=h.fetched.at(-1);
 assert.equal(call.url,'https://api.github.com/repos/2009seungbin-stack/my-first-repo/actions/workflows/collectors.yml/dispatches');
 assert.equal(call.init.headers.Authorization,`Bearer ${token}`);
 assert.deepEqual(JSON.parse(call.init.body),{ref:'main',inputs:{adapters:'steam-news,steam-store'}});
 assert(!ok.text.includes(token));
 h.upstream=async()=>new Response('{"message":"Bad credentials"}',{status:401});
 const up=await admin.call('POST','/admin/collectors/run',{body:{adapters:['steam-news']}});
 assert.equal(up.status,502);assert(!up.text.includes(token)&&!up.text.includes('Bad credentials'));
});

test('usage: Cloudflare GraphQL summed over every database; Workers Paid month-to-date, Free per day',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 const nc=await admin.call('GET','/admin/usage');assert.equal(nc.status,503);assert.equal(nc.json.error.need,'CF_ANALYTICS_TOKEN');
 // One shape for every 503 (the traffic module uses it too): top-level need + missing, and the error envelope.
 assert.equal(nc.json.need,'CF_ANALYTICS_TOKEN');assert.deepEqual(nc.json.missing,['CF_ANALYTICS_TOKEN','CF_ACCOUNT_ID']);assert.equal(nc.json.error.code,'NOT_CONFIGURED');
 h.env.CF_ANALYTICS_TOKEN='cf-analytics-token-secret';
 assert.equal((await admin.call('GET','/admin/usage')).json.error.need,'CF_ACCOUNT_ID');
 h.env.CF_ACCOUNT_ID=ACCOUNT;
 let vars=null;
 h.upstream=async(url,init)=>{
  assert.equal(url,'https://api.cloudflare.com/client/v4/graphql');
  const q=JSON.parse(init.body);assert.match(q.query,/d1AnalyticsAdaptiveGroups/);assert.match(q.query,/rowsWritten/);assert.equal(q.variables.accountTag,ACCOUNT);
  vars=q.variables;
  return Response.json({data:{viewer:{accounts:[{d1AnalyticsAdaptiveGroups:[
   {sum:{rowsRead:1000,rowsWritten:70000},dimensions:{date:'2026-09-29',databaseId:'prod'}},
   {sum:{rowsRead:500,rowsWritten:15000},dimensions:{date:'2026-09-29',databaseId:'preview'}},
   {sum:{rowsRead:9,rowsWritten:107000},dimensions:{date:'2026-09-28',databaseId:'preview'}},
   {sum:{rowsRead:1,rowsWritten:3},dimensions:{date:'2026-09-02',databaseId:'prod'}}]}]}},errors:null});
 };
 // Workers Paid (the default): billing period from the 1st (CF_BILLING_DAY), month-to-date vs included.
 const r=await admin.call('GET','/admin/usage');
 assert.equal(r.status,200,r.text);
 assert.deepEqual(vars,{accountTag:ACCOUNT,start:'2026-09-01',end:'2026-09-29'});
 assert.equal(r.json.plan,'paid');assert.equal(r.json.period,'month');
 assert.deepEqual(r.json.today,{rowsRead:1500,rowsWritten:85000});
 assert.deepEqual(r.json.month,{rowsRead:1510,rowsWritten:192003,from:'2026-09-01'});
 assert.deepEqual(r.json.included,{rowsReadMonth:25e9,rowsWrittenMonth:50e6});
 assert.deepEqual(r.json.limit,{rowsRead:25e9,rowsWritten:50e6});
 assert.equal(r.json.days.length,29);assert.deepEqual(r.json.days.at(-2),{day:'2026-09-28',rowsRead:9,rowsWritten:107000});
 assert.equal(r.json.resetAt,Date.UTC(2026,9,1));assert.equal(r.json.databases,2);
 assert(!r.text.includes('cf-analytics-token-secret'));
 const ov=await admin.call('GET','/admin/overview');assert.equal(ov.json.usage.month.rowsWritten,192003);
 // Billing day 15: the period started 2026-09-15.
 const h2=await harness({CF_ANALYTICS_TOKEN:'t2',CF_ACCOUNT_ID:ACCOUNT,CF_BILLING_DAY:'15'});const a2=await h2.admin();h2.upstream=h.upstream;
 const r2=await a2.call('GET','/admin/usage');assert.equal(r2.json.month.from,'2026-09-15');assert.equal(r2.json.month.rowsWritten,192000);assert.equal(r2.json.resetAt,Date.UTC(2026,9,15));
 // Workers Free: today vs the daily limits, 7 days.
 const h3=await harness({CF_ANALYTICS_TOKEN:'t3',CF_ACCOUNT_ID:ACCOUNT,CF_PLAN:'free'});const a3=await h3.admin();h3.upstream=h.upstream;
 const r3=await a3.call('GET','/admin/usage');
 assert.equal(r3.json.plan,'free');assert.equal(r3.json.period,'day');assert.deepEqual(r3.json.limit,{rowsRead:5000000,rowsWritten:100000});
 assert.equal(r3.json.days.length,7);assert.equal(r3.json.month,undefined);assert.equal(vars.start,'2026-09-23');
 h.upstream=async()=>Response.json({data:null,errors:[{message:'not authorized'}]});
 h.clock.now+=5*60e3;
 const bad=await admin.call('GET','/admin/usage');assert.equal(bad.status,502);assert(!bad.text.includes('not authorized'));
});

test('radar: changes, conflicts and proposals; adopt/keep, hide/importance, approve through the moderation path',{skip},async()=>{
 const h=await harness();const admin=await h.admin();const db=h.db;
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',facts:[{p:'korean_official',v:'full_audio',ver:'COMMUNITY',src:'src:forum'}]}]},{mode:'community',actor:'collector:steam-store',now:T0-HOUR});
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',facts:[{p:'korean_official',v:'interface_subtitles',ver:'COMMUNITY',src:'src:forum'}]}]},{mode:'community',actor:'collector:steam-store',now:T0-HOUR+1});
 const m=await h.member('p');
 const prop=await m.call('POST','/facts/propose',{body:{entityId:'game:steam-1',property:'korean_official',value:'full_audio',sourceUrl:'https://example.com/source'}});
 assert.equal(prop.status,201,prop.text);
 const r=await admin.call('GET','/admin/radar');
 assert.equal(r.status,200,r.text);
 assert.equal(r.json.conflicts.length,2);assert.equal(r.json.proposals.length,1);
 const cf=r.json.conflicts.find(x=>x.proposed.value==='full_audio');
 assert.equal(cf.current.value,'none');assert.equal(cf.current.verification,'OFFICIAL');assert.equal(cf.channel,'테스트 게임');assert.equal(cf.proposed.by,'collector:steam-store');
 assert.equal(r.json.proposals[0].current,'none');
 assert(r.json.changes.length>=1&&r.json.changes[0].title);
 // Reason is required.
 assert.equal((await admin.call('POST','/admin/radar/action',{body:{kind:'conflict',id:cf.id,action:'adopt'}})).status,400);
 const other=r.json.conflicts.find(x=>x.id!==cf.id);
 assert.equal((await admin.call('POST','/admin/radar/action',{body:{kind:'conflict',id:other.id,action:'keep',reason:'공식 값 유지'}})).status,200);
 const ad=await admin.call('POST','/admin/radar/action',{body:{kind:'conflict',id:cf.id,action:'adopt',reason:'공식 발표 확인'}});
 assert.equal(ad.status,200,ad.text);
 assert.equal(JSON.parse(db.raw.prepare("SELECT value FROM facts WHERE is_current=1 AND property='korean_official'").get().value),'full_audio');
 assert.equal(db.raw.prepare("SELECT COUNT(*) n FROM fact_conflicts WHERE status='open'").get().n,0);
 assert.equal((await admin.call('POST','/admin/radar/action',{body:{kind:'conflict',id:cf.id,action:'adopt',reason:'다시'}})).status,409);
 const ch=db.raw.prepare("SELECT id FROM changes WHERE kind='fact_changed' AND approved_by LIKE 'admin:%'").get();
 assert(ch,'adopting records a Radar change');
 assert.equal((await admin.call('POST','/admin/radar/action',{body:{kind:'change',id:ch.id,action:'importance',value:3,reason:'중요한 변경'}})).status,200);
 assert.equal((await admin.call('POST','/admin/radar/action',{body:{kind:'change',id:ch.id,action:'importance',value:7,reason:'중요한 변경'}})).status,400);
 assert.equal((await admin.call('POST','/admin/radar/action',{body:{kind:'change',id:ch.id,action:'hide',reason:'중복 기록'}})).status,200);
 assert.deepEqual({...db.raw.prepare('SELECT importance,visibility FROM changes WHERE id=?').get(ch.id)},{importance:3,visibility:'hidden'});
 const pa=await admin.call('POST','/admin/radar/action',{body:{kind:'proposal',id:r.json.proposals[0].id,action:'reject',reason:'출처 불충분'}});
 assert.equal(pa.status,200,pa.text);
 assert.equal(db.raw.prepare('SELECT status FROM fact_proposals').get().status,'rejected');
 assert(db.raw.prepare("SELECT COUNT(*) n FROM moderation_actions WHERE target_kind IN ('conflict','change','proposal')").get().n>=5,'every action is logged');
 assert.equal((await admin.call('POST','/admin/radar/action',{body:{kind:'bogus',id:1,action:'hide',reason:'xx'}})).status,400);
 // Paging.
 for(let i=0;i<60;i++)db.raw.prepare("INSERT INTO changes (entity_id,vertical,kind,importance,effective_at,detected_at) VALUES ('game:steam-1','games','note',1,?,?)").run(T0,T0);
 const p1=await admin.call('GET','/admin/radar');assert.equal(p1.json.changes.length,50);assert(p1.json.next);
 const p2=await admin.call('GET',`/admin/radar?cursor=${p1.json.next}`);assert(p2.json.changes.every(c=>c.id<p1.json.next));assert.deepEqual(p2.json.conflicts,[]);
});

test('community stats for a Seoul day: tiles, 7-day spark, channels, verticals, new users (no e-mail)',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 const a=await h.member('writer');
 const p=await a.call('POST','/posts',{body:{entityId:'game:steam-1',kind:'question',title:'첫 질문입니다',body:'본문'}});assert.equal(p.status,201,p.text);
 const b=await h.member('reader');
 assert.equal((await b.call('POST','/comments',{body:{postId:p.json.id,body:'답글'}})).status,201);
 // A post yesterday (Seoul) for the sparkline.
 h.db.raw.prepare("UPDATE discussions SET created_at=? WHERE id=?").run(seoulDayStart(T0)-HOUR,p.json.id);
 const q=await a.call('POST','/posts',{body:{entityId:'game:steam-1',kind:'question',title:'두 번째 질문',body:'본문'}});assert.equal(q.status,201);
 const r=await admin.call('GET','/admin/community');
 assert.equal(r.status,200,r.text);
 assert.equal(r.json.day,'2026-09-29');
 assert.deepEqual(r.json.tiles,{posts:1,comments:1,users:0,flags:0});
 assert.deepEqual(r.json.spark.slice(-2),[{day:'2026-09-28',posts:1,comments:0},{day:'2026-09-29',posts:1,comments:1}]);
 assert.deepEqual(r.json.channels.map(x=>[x.name,x.posts,x.comments]),[['테스트 게임',1,1]]);
 assert.deepEqual(r.json.verticals,[{vertical:'games',name:'게임',url:'/ko/community/games/',posts:1,comments:1}],'posts per channel');
 const y=await admin.call('GET','/admin/community?day=2026-09-28');
 assert.equal(y.json.tiles.users,2,'members created 2026-09-28 (KST)');
 assert(y.json.newUsers.every(u=>!('email' in u))&&!y.text.includes('@example.test'));
 assert.equal((await admin.call('GET','/admin/community?day=2026-13-40')).status,400);
});

test('overview: one screen of numbers, traffic null until the traffic module is configured',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 const r=await admin.call('GET','/admin/overview');
 assert.equal(r.status,200,r.text);
 for(const k of ['generatedAt','collectors','usage','radar','flags','community','status','graph','traffic'])assert(k in r.json,k);
 assert.equal(r.json.usage,null);assert.equal(r.json.traffic,null);
 assert.deepEqual(r.json.status.map(s=>[s.service,s.state]),[['Claude','never'],['OpenAI','never']]);
 assert.equal(r.json.graph.entities,1);assert.equal(r.json.flags.open,0);
 const t=await admin.call('GET','/admin/traffic?range=7d');assert.equal(t.status,503);assert.equal(t.json.error.code,'NOT_CONFIGURED');assert(Array.isArray(t.json.missing));
 // The gate the traffic module calls: (request, env, ctx) → admin, or an ApiError.
 const req=(cookie,method='GET')=>new Request(ORIGIN+'/api/v2/admin/traffic',{method,headers:{cookie,origin:'https://evil.example'}});
 const cookie=[...admin.jar].map(([k,v])=>`${k}=${v}`).join('; ');
 assert.equal((await requireAdmin(req(cookie),h.env,null,{now:()=>h.clock.now})).name,'운영자');
 await assert.rejects(requireAdmin(req(''),h.env,null,{now:()=>h.clock.now}),e=>e.code==='NOT_FOUND');
 await assert.rejects(requireAdmin(req(cookie,'POST'),h.env,null,{now:()=>h.clock.now}),e=>e.code==='FORBIDDEN_ORIGIN');
 await assert.rejects(requireAdmin(req(cookie),h.env,null,{now:()=>h.clock.now+13*HOUR}),e=>e.code==='REAUTH');
});

test('push: key, subscribe (push services only), prefs, test push, gone subscriptions removed',{skip},async()=>{
 const h0=await harness();const a0=await h0.admin();
 const nk=await a0.call('GET','/admin/push/key');assert.equal(nk.status,503);assert.equal(nk.json.error.need,'VAPID_PUBLIC_KEY');assert.deepEqual(nk.json.missing,['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY']);
 const h=await harness(vapidEnv);const admin=await h.admin();
 const k=await admin.call('GET','/admin/push/key');assert.deepEqual(k.json,{publicKey:KEYS.VAPID_PUBLIC_KEY});
 assert(!k.text.includes(KEYS.VAPID_PRIVATE_KEY));
 const bad=await admin.call('POST','/admin/push/subscribe',{body:{subscription:{endpoint:'https://169.254.169.254/x',keys:{p256dh:KEYS.VAPID_PUBLIC_KEY,auth:'AAAAAAAAAAAAAAAAAAAAAA'}}}});
 assert.equal(bad.status,400);
 const sub=await h.subscribe(admin,{flags:'hourly'});
 const g=await admin.call('GET',`/admin/push/prefs?endpoint=${encodeURIComponent(sub.endpoint)}`);
 assert.equal(g.json.subscribed,true);assert.equal(g.json.prefs.flags,'hourly');assert.equal(g.json.prefs.collectorFailN,1);
 const put=await admin.call('PUT','/admin/push/prefs',{body:{prefs:{collectorFailN:2,quiet:null}}});
 assert.equal(put.status,200,put.text);assert.equal(put.json.prefs.collectorFailN,2);assert.equal(put.json.prefs.flags,'hourly','other keys kept');assert.equal(put.json.prefs.quiet,null);
 assert.equal((await admin.call('PUT','/admin/push/prefs',{body:{prefs:{collectorFailN:9}}})).status,400);
 assert.equal((await admin.call('PUT','/admin/push/prefs',{body:{prefs:{bogus:1}}})).status,400);
 const t=await admin.call('POST','/admin/push/test',{body:{}});
 assert.equal(t.status,200,t.text);assert.deepEqual([t.json.ok,t.json.sent],[true,1]);
 const push=h.pushes().at(-1);
 assert.equal(push.url,sub.endpoint);assert.equal(push.init.headers['Content-Encoding'],'aes128gcm');assert.match(push.init.headers.Authorization,/^vapid t=.+, k=/);
 h.upstream=async()=>new Response(null,{status:410});
 assert.equal((await admin.call('POST','/admin/push/test',{body:{}})).json.sent,0);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0,'410 Gone deletes the subscription');
 const s2=await h.subscribe(admin);
 assert.equal((await admin.call('DELETE','/admin/push/subscribe',{body:{endpoint:s2.endpoint}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);
 assert.equal((await admin.call('DELETE','/admin/push/subscribe',{body:{endpoint:s2.endpoint},origin:'https://evil.example'})).status,403);
});

test('prefs and quiet hours (Asia/Seoul)',()=>{
 assert.deepEqual(normalizePrefs(undefined),{...DEFAULT_PREFS,usageThresholds:[80,90,95]});
 assert.deepEqual(normalizePrefs({usageThresholds:[95,80,80]}).usageThresholds,[80,95]);
 assert.throws(()=>normalizePrefs({quiet:{from:'25:00',to:'07:00'}}));
 assert.throws(()=>normalizePrefs({flags:'sometimes'}));
 assert.throws(()=>normalizePrefs([]));
 const p=normalizePrefs({quiet:{from:'23:00',to:'07:00'}});
 assert.equal(inQuiet(p,Date.UTC(2026,8,29,14,30)),true,'23:30 KST');
 assert.equal(inQuiet(p,Date.UTC(2026,8,29,21,59)),true,'06:59 KST');
 assert.equal(inQuiet(p,Date.UTC(2026,8,29,22,0)),false,'07:00 KST');
 assert.equal(inQuiet(p,T0),false,'12:00 KST');
 assert.equal(inQuiet(normalizePrefs({quiet:{from:'13:00',to:'15:00'}}),Date.UTC(2026,8,29,5,0)),true,'14:00 KST');
 assert.equal(inQuiet(normalizePrefs({quiet:null}),Date.UTC(2026,8,29,15,0)),false);
});

test('notify (CI): bearer token, collector failures once per streak, usage thresholds, quiet hours, tick',{skip},async()=>{
 const n0=await harness();
 const r0=await n0.browser().call('POST','/admin/notify',{body:{kind:'tick'},origin:null});
 assert.equal(r0.status,503);assert.equal(r0.json.error.need,'NOTIFY_TOKEN');
 const h=await harness({...vapidEnv,CF_ANALYTICS_TOKEN:'cf-analytics-token-secret',CF_ACCOUNT_ID:ACCOUNT,CF_PLAN:'free'});
 const ci=h.browser(),auth={authorization:`Bearer ${KEYS.NOTIFY_TOKEN}`};
 const notify=(body,headers=auth)=>ci.call('POST','/admin/notify',{body,headers,origin:null});
 assert.equal((await notify({kind:'tick'},{authorization:'Bearer wrong'})).status,401);
 assert.equal((await notify({kind:'tick'},{})).status,401);
 assert.equal((await notify({kind:'nope'})).status,400);
 const none=await notify({kind:'tick'});assert.equal(none.status,200);assert.equal(none.json.devices,0);
 const admin=await h.admin();
 await h.subscribe(admin);
 let written=50000;
 h.upstream=async url=>url.startsWith('https://api.cloudflare.com/')?Response.json({data:{viewer:{accounts:[{d1AnalyticsAdaptiveGroups:[{sum:{rowsRead:10,rowsWritten:written},dimensions:{date:'2026-09-29',databaseId:'a'}}]}]}}}):new Response(null,{status:201});
 const def=id=>COLLECTORS.find(c=>c.id===id);
 // Collector failure: pushed once per failure streak.
 await recordRun(h.db,def('steam-news'),{started:T0-60e3,finished:T0-30e3,error:'ingest: boom',observations:0,changes:0});
 let before=h.pushes().length;
 const f1=await notify({kind:'collector_failed',payload:{runUrl:'https://github.com/o/r/actions/runs/123'}});
 assert.equal(f1.status,200,f1.text);assert.equal(h.pushes().length,before+1);
 await notify({kind:'collector_failed',payload:{}});
 assert.equal(h.pushes().length,before+1,'same streak: no second push');
 // Usage: 50% → nothing; 85% → the 80 alert once; 96% → the 95 alert even in quiet hours.
 before=h.pushes().length;
 await notify({kind:'usage'});assert.equal(h.pushes().length,before);
 written=85000;h.clock.now+=3*60e3;
 await notify({kind:'usage'});assert.equal(h.pushes().length,before+1);
 await notify({kind:'usage'});assert.equal(h.pushes().length,before+1,'80% once a day');
 // Quiet hours: 23:30 KST. 90% is held; 96% (critical) goes out.
 h.clock.now=Date.UTC(2026,8,29,14,30);written=91000;
 await notify({kind:'usage'});assert.equal(h.pushes().length,before+1,'90% held during quiet hours');
 written=96000;h.clock.now+=3*60e3;
 const u=await notify({kind:'usage'});assert.equal(h.pushes().length,before+2,u.text);
 // Status collectors never succeeded → one stale alert each (held in quiet hours, sent after).
 before=h.pushes().length;
 await notify({kind:'status_stale'});assert.equal(h.pushes().length,before,'quiet');
 h.clock.now=Date.UTC(2026,8,29,23,0);   // 08:00 KST
 const s=await notify({kind:'tick'});assert.equal(s.status,200,s.text);
 assert.equal(h.pushes().length,before+2,JSON.stringify(s.json.results));
 await notify({kind:'tick'});assert.equal(h.pushes().length,before+2,'each stale episode once');
 // A workflow failure with nothing recorded → one generic alert per run.
 const h2=await harness(vapidEnv);const a2=await h2.admin();await h2.subscribe(a2);
 const ci2=h2.browser(),n2=body=>ci2.call('POST','/admin/notify',{body,headers:auth,origin:null});
 await n2({kind:'collector_failed',payload:{runUrl:'https://github.com/o/r/actions/runs/77'}});
 await n2({kind:'collector_failed',payload:{runUrl:'https://github.com/o/r/actions/runs/77'}});
 assert.equal(h2.pushes().length,1);
 assert(!s.text.includes(KEYS.NOTIFY_TOKEN)&&!s.text.includes('cf-analytics-token-secret'));
});

test('a new flag reaches the admin at once (instant), not when prefs say off',{skip},async()=>{
 const h=await harness(vapidEnv);const admin=await h.admin();const sub=await h.subscribe(admin);
 const m=await h.member('flagger');
 const p=await m.call('POST','/posts',{body:{entityId:'game:steam-1',kind:'question',title:'질문 제목입니다',body:'x'}});
 const r=await m.call('POST','/flags',{body:{target:`discussion:${p.json.id}`,reason:'spam'}});
 assert.equal(r.status,201);
 await Promise.all(h.waits);
 assert.equal(h.pushes().length,1);assert.equal(h.pushes()[0].url,sub.endpoint);
 await admin.call('PUT','/admin/push/prefs',{body:{prefs:{flags:'off'}}});
 const m2=await h.member('flagger2');
 await m2.call('POST','/flags',{body:{target:`discussion:${p.json.id}`,reason:'abuse'}});
 await Promise.all(h.waits);
 assert.equal(h.pushes().length,1);
});

test('recordRun stays compatible with a database that has no rows_written column yet',{skip},async()=>{
 const db=D1Shim.migrated();
 db.raw.exec('ALTER TABLE collector_runs DROP COLUMN rows_written');
 await recordRun(db,{id:'x',vertical:'ai'},{started:1,finished:2,error:null,observations:1,changes:0,rowsWritten:5,queries:2});
 assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM collector_runs').get().n,1);
});

test('malformed path parameters are a 404, not a crash',{skip},async()=>{
 const h=await harness();const admin=await h.admin();
 assert.equal((await admin.call('GET','/admin/collectors/%E0%A4%A/runs')).status,404);
});

test('new tags: a member proposes, the admin picks the kind and approves (entity + alias, noindex) or rejects',{skip},async()=>{
 const h=await harness();const admin=await h.admin();const db=h.db;
 const m=await h.member('p');
 const a=await m.call('POST','/tags/propose',{body:{name:'Hollow Knight Silksong',channel:'games',sourceUrl:'https://store.steampowered.com/app/1030300/'}});
 assert.equal(a.status,201,a.text);
 const b=await m.call('POST','/tags/propose',{body:{name:'이상한 태그',channel:'games'}});
 const r=await admin.call('GET','/admin/radar');
 assert.equal(r.status,200,r.text);
 const t=r.json.tags.find(x=>x.id===a.json.id);
 assert(t&&t.name==='Hollow Knight Silksong'&&t.types.some(x=>x.id==='game'),JSON.stringify(r.json.tags));
 const act=body=>admin.call('POST','/admin/radar/action',{body:{kind:'tag',...body}});
 assert.equal((await act({id:a.json.id,action:'approve',value:'gpu',reason:'확인'})).status,400,'a kind of the proposal\'s channel only');
 assert.equal((await act({id:a.json.id,action:'approve',value:'game'})).status,400,'reason required');
 const ok=await act({id:a.json.id,action:'approve',value:'game',reason:'공식 스토어 확인'});
 assert.equal(ok.status,200,ok.text);assert.equal(ok.json.entity,'game:hollow-knight-silksong');
 const e=db.raw.prepare("SELECT vertical,type,slug,status,index_state FROM entities WHERE id='game:hollow-knight-silksong'").get();
 assert.deepEqual({...e},{vertical:'games',type:'game',slug:'hollow-knight-silksong',status:'active',index_state:'noindex'});
 assert.equal(db.raw.prepare("SELECT status FROM tag_proposals WHERE id=?").get(a.json.id).status,'accepted');
 assert.equal((await act({id:a.json.id,action:'approve',value:'game',reason:'다시'})).status,409);
 assert.equal((await act({id:b.json.id,action:'reject',reason:'대상이 불분명'})).status,200);
 assert.equal(db.raw.prepare("SELECT status FROM tag_proposals WHERE id=?").get(b.json.id).status,'rejected');
 // The new tag can be used at once.
 const p=await m.call('POST','/posts',{body:{channel:'games',kind:'question',tags:['game:hollow-knight-silksong'],title:'실크송 질문',body:'본문'}});
 assert.equal(p.status,201,p.text);
});
