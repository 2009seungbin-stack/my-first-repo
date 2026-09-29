/** Member passkeys — the 고정닉 path (server/member-passkey.js): sign-up with a nickname and a passkey,
 * discoverable sign-in, extra devices, removal rules, the bot check, per-network sign-up limits, and the
 * wall between member and admin passkeys. Real WebAuthn bytes from tests/passkey-authenticator.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {handleApi} from '../server/api.js';
import {handlePlatformApi} from '../server/platform/api.js';
import {createLimiter} from '../server/ratelimit.js';
import {sha256,base64url} from '../server/crypto.js';
import {verifyTurnstile} from '../server/turnstile.js';
import {passkeyAvailability,SIGNUPS_PER_NETWORK} from '../server/member-passkey.js';
import {runtimeConfig} from '../server/config.js';
import {SoftAuthenticator} from './passkey-authenticator.mjs';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const ORIGIN='https://nerulio.test',SECRET='test-session-secret-0123456789abcdef-0123456789',CODE='setup-code-0123456789-abcdef';
const T0=Date.UTC(2026,8,29,3,0),DAY=864e5;
const TS={TURNSTILE_SITE_KEY:'0x4AAAAAAAtest',TURNSTILE_SECRET_KEY:'0x4AAAAAAAsecret'};

function harness(extraEnv={}){
 const db=D1Shim.migrated(),clock={now:T0},limiter=createLimiter(),siteverify=[];
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,ADMIN_SETUP_CODE:CODE,...extraEnv};
 /** Siteverify stub: "good" passes for our hostname and action, "testing" answers like Cloudflare's testing keys. */
 const fetch=async(url,init)=>{
  const token=init.body.get('response');siteverify.push(token);
  if(token==='testing')return Response.json({success:true,hostname:'example.com',metadata:{result_with_testing_key:true}});
  return Response.json(token==='good'?{success:true,hostname:'nerulio.test',action:'signup'}:{success:false});
 };
 const h={db,env,clock,siteverify,
  browser(ip='203.0.113.7'){
   const jar=new Map();
   const b={jar,ip,
    async call(method,path,{body,origin=ORIGIN}={}){
     const hd=new Headers({'cf-connecting-ip':b.ip});
     if(jar.size)hd.set('cookie',[...jar].map(([k,v])=>`${k}=${v}`).join('; '));
     if(method!=='GET'&&origin)hd.set('origin',origin);
     if(body!==undefined)hd.set('content-type','application/json');
     const req=new Request(ORIGIN+path,{method,headers:hd,body:body!==undefined?JSON.stringify(body):undefined});
     const deps={now:()=>clock.now,limiter,fetch};
     const r=path.startsWith('/api/v2')?await handlePlatformApi(req,env,null,deps):await handleApi(req,env,null,deps);
     for(const sc of r.headers.getSetCookie()){const [kv,...attrs]=sc.split(';');const i=kv.indexOf('=');const k=kv.slice(0,i).trim(),v=kv.slice(i+1).trim();if(attrs.some(a=>/max-age=0/i.test(a))||v==='')jar.delete(k);else jar.set(k,v);}
     const text=await r.text();
     return {status:r.status,text,json:text?JSON.parse(text):null};
    }};
   return b;
  },
  /** Sign up through both ceremonies; returns the browser (signed in) and its authenticator. */
  async signUp(name,{b=h.browser(),auth=new SoftAuthenticator(),token}={}){
   const o=await b.call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:name,...(token?{turnstileToken:token}:{})}});
   if(o.status!==200)return {b,auth,res:o};
   const cred=await auth.create(o.json,{origin:ORIGIN});
   const res=await b.call('POST','/api/v1/auth/passkey/register/verify',{body:{credential:cred,name:'Galaxy S26'}});
   return {b,auth,res,options:o.json,cred};
  },
  async signIn(auth,b=h.browser(),o={}){
   const opt=await b.call('POST','/api/v1/auth/passkey/login/options',{body:{}});
   assert.equal(opt.status,200,opt.text);
   const a=await auth.get(opt.json,{origin:ORIGIN,...o});
   return {b,res:await b.call('POST','/api/v1/auth/passkey/login/verify',{body:{credential:a}}),assertion:a,cookie:b.jar.get('nerulio_passkey')};
  }};
 return h;
}

test('sign-up: nickname + passkey → an account with a session; the nickname is public, nothing else',{skip},async()=>{
 const h=harness();
 const {b,res,options,cred}=await h.signUp('밤샘러너');
 assert.equal(res.status,200,res.text);assert.deepEqual(res.json,{ok:true,displayName:'밤샘러너'});
 assert.equal(options.rp.id,'nerulio.test');assert.equal(options.authenticatorSelection.residentKey,'required');assert.equal(options.authenticatorSelection.userVerification,'preferred');
 assert.equal(options.attestation,'none');assert.deepEqual(options.pubKeyCredParams.map(p=>p.alg),[-7,-257]);
 assert(b.jar.get('nerulio_session'),'signed in');assert(!b.jar.has('nerulio_passkey'),'ceremony cookie cleared');
 const st=await b.call('GET','/api/v2/state');
 assert.equal(st.json.signedIn,true);assert.equal(st.json.user.name,'밤샘러너');assert.equal(st.json.passkey.signin,true);
 const u=h.db.raw.prepare("SELECT u.id,u.provider,u.provider_subject,u.email,u.display_name,p.role,p.display_name AS nick FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.provider='passkey'").get();
 assert.equal(u.provider_subject,options.user.id);assert.equal(u.email,null);assert.equal(u.display_name,null);assert.equal(u.role,'user');assert.equal(u.nick,'밤샘러너');
 assert.deepEqual({...h.db.raw.prepare("SELECT provider,provider_subject FROM user_identities WHERE user_id=?").get(u.id)},{provider:'passkey',provider_subject:options.user.id});
 const c=h.db.raw.prepare('SELECT id,user_id,alg,name FROM member_credentials').get();
 assert.equal(c.id,cred.id);assert.equal(c.user_id,u.id);assert.equal(c.alg,-7);assert.equal(c.name,'Galaxy S26');
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM admin_credentials').get().n,0,'never an admin credential');
 // The account page lists the device; it is the only way in, so it cannot be removed.
 const ids=await b.call('GET','/api/v1/auth/identities');
 assert.deepEqual(ids.json.identities,[]);assert.equal(ids.json.devices.length,1);assert.equal(ids.json.devices[0].name,'Galaxy S26');assert.equal(ids.json.canUnlink,false);
 const last=await b.call('POST','/api/v1/auth/passkey/remove',{body:{id:cred.id}});
 assert.equal(last.status,409);assert.equal(last.json.error.reason,'last_method');
 // Writing uses the fixed nickname.
 const me=await b.call('GET','/api/v1/me');assert.equal(me.json.loggedIn,true);assert.deepEqual(me.json.passkey,{signin:true,signup:true,turnstileSiteKey:''});
});

test('sign-in: a discoverable credential, no allowCredentials; replays and other origins refused',{skip},async()=>{
 const h=harness();
 const {auth}=await h.signUp('로그라이커');
 const {b,res,assertion,cookie}=await h.signIn(auth);
 assert.equal(res.status,200,res.text);assert.equal(res.json.displayName,'로그라이커');assert(b.jar.get('nerulio_session'));
 const opt=await h.browser().call('POST','/api/v1/auth/passkey/login/options',{body:{}});
 assert.deepEqual(opt.json.allowCredentials,[]);assert.equal(opt.json.rpId,'nerulio.test');
 assert(h.db.raw.prepare('SELECT last_used_at FROM member_credentials').get().last_used_at,'last use recorded');
 // The same assertion again, even with the ceremony cookie it was issued to, is refused (webauthn_used).
 const again=h.browser();again.jar.set('nerulio_passkey',cookie);
 const r1=await again.call('POST','/api/v1/auth/passkey/login/verify',{body:{credential:assertion}});
 assert.equal(r1.status,400);assert.equal(r1.json.error.code,'PASSKEY_REJECTED');assert(!again.jar.has('nerulio_session'));
 assert.equal((await h.browser().call('POST','/api/v1/auth/passkey/login/verify',{body:{credential:assertion}})).status,400,'no cookie');
 // A signed response for another origin, or a tampered signature.
 const x=await h.signIn(auth,h.browser(),{origin:'https://evil.example'});assert.equal(x.res.status,400);
 // An unknown credential.
 const stranger=new SoftAuthenticator();await stranger.create({rp:{id:'nerulio.test'},user:{id:'eA'},challenge:'eA'},{origin:ORIGIN});
 const y=await h.signIn(stranger);assert.equal(y.res.status,400);assert.equal(y.res.json.error.reason,'unknown credential');
 // Challenges expire after 5 minutes.
 const late=h.browser();const o2=await late.call('POST','/api/v1/auth/passkey/login/options',{body:{}});
 h.clock.now+=5*60e3+1;
 const a2=await auth.get(o2.json,{origin:ORIGIN});
 assert.equal((await late.call('POST','/api/v1/auth/passkey/login/verify',{body:{credential:a2}})).status,400);
 // Cross-site POSTs are refused before anything happens.
 assert.equal((await h.browser().call('POST','/api/v1/auth/passkey/login/options',{body:{},origin:'https://evil.example'})).status,403);
});

test('nicknames: length, reserved names and case-insensitive uniqueness (409), also against OAuth members',{skip},async()=>{
 const h=harness();
 for(const bad of ['a','운영자','관리자님','admin','Nerulio','레이더봇','user-abc123','x'.repeat(21)]){
  const r=await h.browser().call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:bad}});
  assert.equal(r.status,400,bad);assert.equal(r.json.error.field,'displayName',bad);
 }
 assert.equal((await h.signUp('NightOwl')).res.status,200);
 const dup=await h.browser('198.51.100.9').call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'nightowl'}});
 assert.equal(dup.status,409);assert.equal(dup.json.error.field,'displayName');
 // Taken between the two steps: the unique index refuses the second account, nothing half-created.
 const a=h.browser('198.51.100.10'),b=h.browser('198.51.100.11'),auth1=new SoftAuthenticator(),auth2=new SoftAuthenticator();
 const o1=await a.call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'동시가입'}});
 const o2=await b.call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'동시가입'}});
 assert.equal((await a.call('POST','/api/v1/auth/passkey/register/verify',{body:{credential:await auth1.create(o1.json,{origin:ORIGIN})}})).status,200);
 const lost=await b.call('POST','/api/v1/auth/passkey/register/verify',{body:{credential:await auth2.create(o2.json,{origin:ORIGIN})}});
 assert.equal(lost.status,409);assert.equal(h.db.raw.prepare("SELECT COUNT(*) n FROM users WHERE provider='passkey'").get().n,2);
 // Unknown fields and a signed-in sign-up are refused.
 assert.equal((await h.browser().call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'새이름',role:'admin'}})).status,400);
 const {b:member}=await h.signUp('이미회원',{b:h.browser('198.51.100.12')});
 assert.equal((await member.call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'두번째'}})).json.error.reason,'signed_in');
});

test('sign-ups per network per day: 2 without Turnstile, 5 with it; /24 neighbours share, tomorrow resets',{skip},async()=>{
 const h=harness();
 assert.equal((await h.signUp('첫째',{b:h.browser('192.0.2.1')})).res.status,200);
 assert.equal((await h.signUp('둘째',{b:h.browser('192.0.2.2')})).res.status,200);
 const third=await h.signUp('셋째',{b:h.browser('192.0.2.200')});
 assert.equal(third.res.status,429);assert.equal(third.res.json.error.code,'NETWORK_LIMIT');
 assert.equal((await h.signUp('다른망',{b:h.browser('192.0.3.1')})).res.status,200,'another /24');
 h.clock.now+=DAY;
 assert.equal((await h.signUp('다음날',{b:h.browser('192.0.2.3')})).res.status,200);
 const t=harness(TS);
 for(let i=0;i<SIGNUPS_PER_NETWORK.verified;i++)assert.equal((await t.signUp(`회원${i}`,{b:t.browser(`192.0.2.${i+1}`),token:'good'})).res.status,200,String(i));
 assert.equal((await t.signUp('여섯째',{b:t.browser('192.0.2.99'),token:'good'})).res.status,429);
});

test('Turnstile: required when configured, action "signup"; testing keys only outside production; production without it: NOT_CONFIGURED',{skip},async()=>{
 const h=harness(TS);
 const none=await h.browser().call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'봇아님'}});
 assert.equal(none.status,403);assert.equal(none.json.error.code,'CHALLENGE_REQUIRED');assert.equal(none.json.error.siteKey,TS.TURNSTILE_SITE_KEY);
 const bad=await h.browser().call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'봇아님',turnstileToken:'bad'}});
 assert.equal(bad.json.error.code,'CHALLENGE_FAILED');
 assert.equal((await h.signUp('봇아님',{token:'good'})).res.status,200);
 assert.equal((await h.signUp('테스트키',{b:h.browser('198.51.100.1'),token:'testing'})).res.status,200,'testing key on a development build');
 // verifyTurnstile itself: a testing-key answer passes only with allowTestingKey.
 const f=async()=>Response.json({success:true,hostname:'example.com',metadata:{result_with_testing_key:true}});
 assert.equal(await verifyTurnstile({token:'t',secret:'s',hostname:'nerulio.com',expectedAction:'signup'},f),false);
 assert.equal(await verifyTurnstile({token:'t',secret:'s',hostname:'nerulio.com',expectedAction:'signup',allowTestingKey:true},f),true);
 // A production build: no secret → sign-up refused with the admin envelope; with a secret, testing keys refused.
 const prod={preview:false,pages:true,siteURL:'https://nerulio.com'};
 assert.deepEqual(passkeyAvailability(runtimeConfig({DB:{},SESSION_SECRET:SECRET},prod)),{signin:true,signup:false,turnstileSiteKey:''});
 assert.deepEqual(passkeyAvailability(runtimeConfig({DB:{},SESSION_SECRET:SECRET,...TS},prod)),{signin:true,signup:true,turnstileSiteKey:TS.TURNSTILE_SITE_KEY});
 assert.equal(passkeyAvailability(runtimeConfig({DB:{},SESSION_SECRET:SECRET},{preview:true,pages:true,siteURL:''})).signup,true,'previews allow sign-up without Turnstile (stricter limit)');
});

test('production without TURNSTILE_SECRET_KEY: 503 NOT_CONFIGURED {need, missing, error.need}; sign-in still works',{skip},async()=>{
 const h=harness({NERULIO_ENV:'production'});
 // server/config.js treats a non-Pages build without NERULIO_ENV=development as production.
 const r=await h.browser().call('POST','/api/v1/auth/passkey/register/options',{body:{displayName:'프로덕션'}});
 assert.equal(r.status,503,r.text);assert.equal(r.json.need,'TURNSTILE_SECRET_KEY');assert.deepEqual(r.json.missing,['TURNSTILE_SECRET_KEY']);
 assert.equal(r.json.error.code,'NOT_CONFIGURED');assert.equal(r.json.error.need,'TURNSTILE_SECRET_KEY');
 assert.equal((await h.browser().call('POST','/api/v1/auth/passkey/login/options',{body:{}})).status,200);
 assert.equal((await h.browser().call('GET','/api/v1/health')).json.passkey.signup,false);
});

test('member passkeys never reach the admin app; admin accounts cannot add or use member passkeys',{skip},async()=>{
 const h=harness();
 const {b:member,auth}=await h.signUp('일반회원');
 // A member session: every admin endpoint is 404.
 for(const [m,p,body] of [['GET','/api/v2/admin/me'],['GET','/api/v2/admin/overview'],['GET','/api/v2/admin/community'],['POST','/api/v2/admin/passkey/remove',{id:'x'}],['POST','/api/v2/admin/radar/action',{kind:'change',id:1,action:'hide',reason:'x'}]]){
  const r=await member.call(m,p,{body});assert.equal(r.status,404,`${m} ${p}`);
 }
 // The member credential against the admin sign-in: a member challenge is not an admin challenge…
 const mo=await member.call('POST','/api/v1/auth/passkey/login/options',{body:{}});
 const a1=await auth.get(mo.json,{origin:ORIGIN});
 const x1=await member.call('POST','/api/v2/admin/passkey/login/verify',{body:{credential:a1}});
 assert.equal(x1.status,400);assert.equal(x1.json.error.code,'PASSKEY_REJECTED');
 // …and with a genuine admin challenge the credential is unknown to the admin app.
 const ab=h.browser();const ao=await ab.call('POST','/api/v2/admin/passkey/login/options',{body:{}});
 const a2=await auth.get(ao.json,{origin:ORIGIN});
 const x2=await ab.call('POST','/api/v2/admin/passkey/login/verify',{body:{credential:a2}});
 assert.equal(x2.status,400);assert.equal(x2.json.error.reason,'unknown credential');assert(!ab.jar.has('nerulio_session'));
 // An admin challenge cannot finish a member sign-in either.
 const mb=h.browser();await mb.call('POST','/api/v1/auth/passkey/login/options',{body:{}});
 mb.jar.set('nerulio_passkey',ab.jar.get('nerulio_webauthn')||'x');
 assert.equal((await mb.call('POST','/api/v1/auth/passkey/login/verify',{body:{credential:a2}})).status,400);
 // The admin (setup code + admin passkey) cannot add a member passkey.
 const admin=h.browser('198.51.100.50'),adminAuth=new SoftAuthenticator();
 const ro=await admin.call('POST','/api/v2/admin/passkey/register/options',{body:{setupCode:CODE}});
 assert.equal((await admin.call('POST','/api/v2/admin/passkey/register/verify',{body:{credential:await adminAuth.create(ro.json,{origin:ORIGIN})}})).status,200);
 const add=await admin.call('POST','/api/v1/auth/passkey/add/options',{body:{}});
 assert.equal(add.status,403);
 // Even a member credential planted on the admin account signs nobody in.
 const adminId=h.db.raw.prepare("SELECT user_id FROM user_profiles WHERE role='admin'").get().user_id;
 h.db.raw.prepare('UPDATE member_credentials SET user_id=?').run(adminId);
 const planted=await h.signIn(auth);assert.equal(planted.res.status,400);assert(!planted.b.jar.has('nerulio_session'));
});

test('devices: a signed-in member adds another passkey (fresh session only), removes one, never the last way in',{skip},async()=>{
 const h=harness();
 const {b,auth,cred}=await h.signUp('두기기');
 const phone2=new SoftAuthenticator();
 const o=await b.call('POST','/api/v1/auth/passkey/add/options',{body:{}});
 assert.equal(o.status,200,o.text);assert.deepEqual(o.json.excludeCredentials.map(c=>c.id),[cred.id]);
 const user=h.db.raw.prepare("SELECT provider_subject FROM user_identities WHERE provider='passkey'").get();
 assert.equal(o.json.user.id,user.provider_subject,'same user handle for every device of the account');
 const v=await b.call('POST','/api/v1/auth/passkey/add/verify',{body:{credential:await phone2.create(o.json,{origin:ORIGIN}),name:'태블릿'}});
 assert.equal(v.status,200,v.text);assert.equal(v.json.devices.length,2);assert.equal(v.json.canUnlink,true);
 assert.equal((await h.signIn(phone2)).res.status,200,'the new device signs in');
 const rm=await b.call('POST','/api/v1/auth/passkey/remove',{body:{id:cred.id}});
 assert.equal(rm.status,200);assert.deepEqual(rm.json.devices.map(d=>d.name),['태블릿']);
 assert.equal((await h.signIn(auth)).res.status,400,'the removed passkey no longer signs in');
 assert.equal((await b.call('POST','/api/v1/auth/passkey/remove',{body:{id:'nope'}})).status,404);
 // Signed out: 401; a stale session (> 12 h) must sign in again before adding a device.
 assert.equal((await h.browser().call('POST','/api/v1/auth/passkey/add/options',{body:{}})).status,401);
 h.clock.now+=13*36e5;
 const stale=await b.call('POST','/api/v1/auth/passkey/add/options',{body:{}});
 assert.equal(stale.status,401);assert.equal(stale.json.error.code,'REAUTH');
});

test('an OAuth member may add a passkey; then either can be removed while the other remains',{skip},async()=>{
 const h=harness();
 const b=h.browser(),id='u-oauth',token=base64url(crypto.getRandomValues(new Uint8Array(32)));
 h.db.raw.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?,?,?,'github','4242',?)").run(id,'o@example.test','Octo',T0-DAY);
 h.db.raw.prepare("INSERT INTO user_identities(provider,provider_subject,user_id,email,created_at) VALUES('github','4242',?,?,?)").run(id,'o@example.test',T0-DAY);
 h.db.raw.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(await sha256(token),id,T0,T0+DAY);
 b.jar.set('nerulio_session',token);
 const auth=new SoftAuthenticator();
 const o=await b.call('POST','/api/v1/auth/passkey/add/options',{body:{}});
 assert.equal((await b.call('POST','/api/v1/auth/passkey/add/verify',{body:{credential:await auth.create(o.json,{origin:ORIGIN})}})).status,200);
 const un=await b.call('POST','/api/v1/auth/unlink',{body:{provider:'github'}});
 assert.equal(un.status,200,un.text);assert.deepEqual(un.json.identities,[]);assert.equal(un.json.devices.length,1);assert.equal(un.json.canUnlink,false);
 assert.equal(h.db.raw.prepare('SELECT provider FROM users WHERE id=?').get(id).provider,'passkey','the account now names its passkey');
 const s=await h.signIn(auth);assert.equal(s.res.status,200);
 assert.equal((await s.b.call('GET','/api/v2/state')).json.signedIn,true);
});
