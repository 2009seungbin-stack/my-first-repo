/** GitHub and Discord sign-in (server/oauth/): the shared flow (state, PKCE, host-bound cookie, safe
 * return paths), each provider against mocked token/user endpoints, identities and linking rules,
 * health flags and the platform's sign-in data. Nothing here contacts a real provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable,migrationFiles} from './d1-shim.mjs';
import {readFileSync} from 'node:fs';
import {handleApi} from '../server/api.js';
import {handlePlatformApi} from '../server/platform/api.js';
import {runtimeConfig} from '../server/config.js';
import {base64url,sha256} from '../server/crypto.js';
import {primaryVerifiedEmail} from '../server/oauth/github.js';
import {configuredProviders,providerCredentials,upstreamFor} from '../server/oauth/providers.js';
import {buttonsHTML,startURL,validReturn} from '../src/signin-brands.js';

const skip=!sqliteAvailable&&'node:sqlite is unavailable in this Node version';
const ORIGIN='https://nerulio.test';
const SECRET='test-session-secret-0123456789abcdef-0123456789';
const NOW=Date.UTC(2026,8,29,10,0,0);
const PROVIDERS={GITHUB_OAUTH_CLIENT_ID:'gh-client',GITHUB_OAUTH_CLIENT_SECRET:'gh-secret',DISCORD_OAUTH_CLIENT_ID:'dc-client',DISCORD_OAUTH_CLIENT_SECRET:'dc-secret'};
const ACCESS='gho_ACCESS_TOKEN_never_stored_0123456789';

/** Mock GitHub + Discord: codes are single-use, like the real token endpoints. `set` changes a response. */
function mockProviders(){
 const state={
  github:{user:{id:583231,login:'octocat',name:'The Octocat'},emails:[{email:'old@example.test',primary:false,verified:true},{email:'octo@example.test',primary:true,verified:true}],emailsStatus:200,tokenStatus:200,userStatus:200,tokenBody:null},
  discord:{user:{id:'80351110224678912',username:'nelly',global_name:'Nelly',email:'nelly@example.test',verified:true},tokenStatus:200,userStatus:200,tokenBody:null},
  used:new Set(),calls:[],down:false
 };
 const fetch=async(url,init={})=>{
  const u=new URL(url);state.calls.push({url:u.href,init});
  if(state.down)throw new TypeError('fetch failed');
  const body=init.body?Object.fromEntries(new URLSearchParams(String(init.body))):{};
  const auth=new Headers(init.headers).get('authorization');
  if(u.href==='https://github.com/login/oauth/access_token'){
   const g=state.github;if(g.tokenStatus!==200)return new Response('down',{status:g.tokenStatus});
   if(g.tokenBody)return Response.json(g.tokenBody);
   if(state.used.has(body.code))return Response.json({error:'bad_verification_code',error_description:'The code passed is incorrect or expired.'});
   state.used.add(body.code);state.lastGithubToken=body;
   return Response.json({access_token:ACCESS,token_type:'bearer',scope:'read:user,user:email'});
  }
  if(u.href==='https://api.github.com/user'){assert.equal(auth,`Bearer ${ACCESS}`);return state.github.userStatus===200?Response.json(state.github.user):new Response('x',{status:state.github.userStatus});}
  if(u.href==='https://api.github.com/user/emails')return state.github.emailsStatus===200?Response.json(state.github.emails):Response.json({message:'Not Found'},{status:state.github.emailsStatus});
  if(u.href==='https://discord.com/api/oauth2/token'){
   const d=state.discord;if(d.tokenStatus!==200)return new Response('down',{status:d.tokenStatus});
   if(d.tokenBody)return Response.json(d.tokenBody,{status:400});
   if(state.used.has(body.code))return Response.json({error:'invalid_grant'},{status:400});
   state.used.add(body.code);state.lastDiscordToken=body;
   return Response.json({access_token:ACCESS,token_type:'Bearer',expires_in:604800,refresh_token:'refresh-never-stored',scope:'identify email'});
  }
  if(u.href==='https://discord.com/api/v10/users/@me'){assert.equal(auth,`Bearer ${ACCESS}`);return state.discord.userStatus===200?Response.json(state.discord.user):new Response('x',{status:state.discord.userStatus});}
  throw new Error('unexpected outbound fetch '+u.href);
 };
 return {state,fetch};
}

/** One browser against one isolated deployment (fresh in-memory D1). */
function harness(envExtra=PROVIDERS,{db=D1Shim.migrated(),mock=mockProviders()}={}){
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,...envExtra};
 const clock={now:NOW};
 const browser=()=>{
  const jar={};
  const b={jar,
   async call(method,path,{body,headers={},api=handleApi}={}){
    const hd=new Headers(headers);
    if(Object.keys(jar).length)hd.set('cookie',Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '));
    if(method==='POST'){hd.set('origin',ORIGIN);hd.set('content-type','application/json');}
    const request=new Request(ORIGIN+path,{method,headers:hd,body:body!==undefined?JSON.stringify(body):undefined,redirect:'manual'});
    const response=await api(request,env,{waitUntil(){}},{now:()=>clock.now,random:()=>0.5,fetch:mock.fetch});
    for(const c of response.headers.getSetCookie()){const [pair]=c.split(';'),i=pair.indexOf('='),k=pair.slice(0,i),v=pair.slice(i+1);if(/Max-Age=0/.test(c))delete jar[k];else jar[k]=v;}
    const text=await response.text();let json=null;try{json=JSON.parse(text);}catch{}
    return {status:response.status,json,location:response.headers.get('location'),setCookies:response.headers.getSetCookie()};
   },
   /** start → (provider) → callback. `edit` can tamper with the callback query. */
   async signIn(provider,{ret='/ko/ai/claude/',link=false,edit=q=>q}={}){
    const start=await b.call('GET',`/api/v1/auth/${provider}/start?return=${encodeURIComponent(ret)}${link?'&link=1':''}`);
    if(start.status!==302||!/^https:\/\/(github|discord)\.com\//.test(start.location))return {start,callback:start};
    const loc=new URL(start.location);
    const q=edit(new URLSearchParams({code:'code-'+crypto.randomUUID(),state:loc.searchParams.get('state')}));
    const callback=await b.call('GET',`/api/v1/auth/${provider}/callback?${q}`);
    return {start,loc,callback};
   },
   me(){return b.call('GET','/api/v1/me').then(r=>r.json);}
  };
  return b;
 };
 return {db,env,clock,mock,browser};
}
const count=(db,sql,...a)=>Number(db.raw.prepare(sql).get(...a).n);
const reason=location=>new URL(location,ORIGIN).searchParams.get('reason');

test('health and /me report only fully configured providers; Google stays dormant without its secret',{skip},async()=>{
 const off=harness({}).browser();
 const h0=(await off.call('GET','/api/v1/health')).json;
 assert.deepEqual([h0.google,h0.github,h0.discord,h0.providers],[false,false,false,[]]);
 const on=harness({...PROVIDERS,GOOGLE_OAUTH_CLIENT_ID:'only-an-id'}).browser();
 const h1=(await on.call('GET','/api/v1/health')).json;
 assert.deepEqual([h1.google,h1.github,h1.discord,h1.providers],[false,true,true,['github','discord']]);
 assert.deepEqual((await on.me()).providers,['github','discord']);
 const g=await on.call('GET','/api/v1/auth/google/start');
 assert.equal(g.status,503);assert.equal(g.json.error.code,'SERVICE_NOT_CONFIGURED');
 const all=harness({...PROVIDERS,GOOGLE_OAUTH_CLIENT_ID:'g',GOOGLE_OAUTH_CLIENT_SECRET:'s'}).browser();
 assert.deepEqual((await all.call('GET','/api/v1/health')).json.providers,['google','github','discord'],'display order');
 // Only the id without the secret (or the reverse) is "not configured".
 assert.deepEqual(configuredProviders({oauth:providerCredentials({GITHUB_OAUTH_CLIENT_SECRET:'x',DISCORD_OAUTH_CLIENT_ID:'y'})}),[]);
});

test('GitHub: authorize URL with state + PKCE S256, scopes, host-bound callback and cookie',{skip},async()=>{
 const b=harness().browser();
 const start=await b.call('GET','/api/v1/auth/github/start?return=/ko/ai/claude/');
 assert.equal(start.status,302);
 const loc=new URL(start.location);
 assert.equal(loc.origin+loc.pathname,'https://github.com/login/oauth/authorize');
 assert.equal(loc.searchParams.get('client_id'),'gh-client');
 assert.equal(loc.searchParams.get('scope'),'read:user user:email');
 assert.equal(loc.searchParams.get('redirect_uri'),ORIGIN+'/api/v1/auth/github/callback');
 assert.equal(loc.searchParams.get('code_challenge_method'),'S256');
 assert.match(loc.searchParams.get('code_challenge'),/^[A-Za-z0-9_-]{43}$/);
 assert.match(loc.searchParams.get('state'),/^[A-Za-z0-9_-]{43}$/);
 const c=start.setCookies.find(x=>x.startsWith('nerulio_oauth='));
 for(const attr of ['HttpOnly','Secure','SameSite=Lax','Path=/api/v1/auth/','Max-Age=600'])assert(c.includes(attr),attr);
 assert(!/Domain=/i.test(c),'host-only cookie');
});

test('GitHub: success keys the account by numeric id, keeps only the primary verified e-mail, stores no token',{skip},async()=>{
 const h=harness(),b=h.browser();
 const {loc,callback}=await b.signIn('github');
 assert.equal(callback.status,302);assert.equal(callback.location,'/ko/ai/claude/?login=ok');
 const sent=h.mock.state.lastGithubToken;
 assert.equal(sent.client_secret,'gh-secret');assert.equal(sent.redirect_uri,ORIGIN+'/api/v1/auth/github/callback');
 assert.equal(base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sent.code_verifier)))),loc.searchParams.get('code_challenge'),'PKCE verifier matches');
 const tokenCall=h.mock.state.calls.find(c=>c.url.endsWith('/access_token'));
 assert.equal(new Headers(tokenCall.init.headers).get('accept'),'application/json');
 assert(h.mock.state.calls.filter(c=>c.url.startsWith('https://api.github.com/')).every(c=>new Headers(c.init.headers).get('user-agent')),'GitHub REST requests carry a User-Agent');
 const user=h.db.raw.prepare("SELECT * FROM users WHERE provider='github'").get();
 assert.deepEqual([user.provider_subject,user.email,user.display_name],['583231','octo@example.test','The Octocat']);
 const id=h.db.raw.prepare('SELECT * FROM user_identities WHERE user_id=?').get(user.id);
 assert.deepEqual([id.provider,id.provider_subject,id.email,id.handle],['github','583231','octo@example.test','octocat']);
 const session=callback.setCookies.find(x=>x.startsWith('nerulio_session='));
 for(const attr of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert(session.includes(attr),attr);
 assert(callback.setCookies.some(x=>x.startsWith('nerulio_oauth=;')&&x.includes('Max-Age=0')),'state cookie cleared');
 const me=await b.me();assert.equal(me.loggedIn,true);assert.equal(me.user.email,'octo@example.test');
 // No provider token anywhere in the database.
 const dump=h.db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t=>JSON.stringify(h.db.raw.prepare(`SELECT * FROM "${t.name}"`).all())).join('');
 assert(!dump.includes(ACCESS)&&!dump.includes('refresh-never-stored'),'access tokens are not stored');
 // A renamed GitHub login is the same account (the id is the key, never the login).
 h.mock.state.github.user={id:583231,login:'octocat-renamed',name:null};
 const again=h.browser();await again.signIn('github');
 assert.equal(count(h.db,"SELECT COUNT(*) n FROM users WHERE provider<>'system'"),1);
 assert.equal(h.db.raw.prepare('SELECT handle FROM user_identities').get().handle,'octocat-renamed');
});

test('GitHub: unverified or missing e-mail signs in without an e-mail; e-mail read failure is not fatal',{skip},async()=>{
 assert.equal(primaryVerifiedEmail([{email:'a@x.test',primary:true,verified:false},{email:'b@x.test',primary:false,verified:true}]),null,'primary AND verified only');
 assert.equal(primaryVerifiedEmail({message:'nope'}),null);
 const h=harness();
 h.mock.state.github.emails=[{email:'unverified@example.test',primary:true,verified:false}];
 const a=await h.browser().signIn('github');
 assert.match(a.callback.location,/login=ok/);
 assert.equal(h.db.raw.prepare("SELECT email FROM users WHERE provider='github'").get().email,null);
 const h2=harness();h2.mock.state.github.emailsStatus=404;
 const b=await h2.browser().signIn('github');
 assert.match(b.callback.location,/login=ok/);assert.equal(h2.db.raw.prepare("SELECT email FROM users WHERE provider='github'").get().email,null);
});

test('Discord: identify+email with PKCE; e-mail only when verified; snowflake subject',{skip},async()=>{
 const h=harness(),b=h.browser();
 const {loc,callback}=await b.signIn('discord',{ret:'/en/community/'});
 assert.equal(loc.origin+loc.pathname,'https://discord.com/oauth2/authorize');
 assert.equal(loc.searchParams.get('scope'),'identify email');assert.equal(loc.searchParams.get('response_type'),'code');
 assert.equal(loc.searchParams.get('code_challenge_method'),'S256');assert.equal(loc.searchParams.get('redirect_uri'),ORIGIN+'/api/v1/auth/discord/callback');
 assert.equal(callback.location,'/en/community/?login=ok');
 const sent=h.mock.state.lastDiscordToken;
 assert.deepEqual([sent.grant_type,sent.client_id,sent.client_secret],['authorization_code','dc-client','dc-secret']);
 assert.equal(base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sent.code_verifier)))),loc.searchParams.get('code_challenge'));
 const u=h.db.raw.prepare("SELECT * FROM users WHERE provider='discord'").get();
 assert.deepEqual([u.provider_subject,u.email,u.display_name],['80351110224678912','nelly@example.test','Nelly']);
 const h2=harness();h2.mock.state.discord.user={id:'1234567890',username:'plain',global_name:null,email:'x@example.test',verified:false};
 await h2.browser().signIn('discord');
 const u2=h2.db.raw.prepare("SELECT * FROM users WHERE provider='discord'").get();
 assert.deepEqual([u2.email,u2.display_name],[null,'plain'],'unverified e-mail dropped; username when no display name');
 const h3=harness();h3.mock.state.discord.user={id:'42424242',username:'noemail'};
 assert.match((await h3.browser().signIn('discord')).callback.location,/login=ok/,'no e-mail at all is fine');
});

test('state mismatch, expiry, replay and another provider\'s flow are refused before any token exchange',{skip},async()=>{
 const h=harness(),b=h.browser();
 const bad=await b.signIn('github',{edit:q=>{q.set('state','forged-state');return q;}});
 assert.equal(reason(bad.callback.location),'state');
 assert.equal(h.mock.state.calls.length,0,'no exchange on a bad state');
 assert.match(bad.callback.location,/^\/ko\/account\/\?login=failed&reason=state&provider=github&return=%2Fko%2Fai%2Fclaude%2F/);
 // No state cookie at all (a callback opened in another browser).
 const fresh=h.browser();
 const none=await fresh.call('GET','/api/v1/auth/github/callback?code=x&state=y',{headers:{'accept-language':'ja,en;q=0.8'}});
 assert.equal(none.location,'/ja/account/?login=failed&reason=state&provider=github','language from Accept-Language when the flow is unknown');
 // Expired: the 10-minute state is over.
 const s=await b.call('GET','/api/v1/auth/github/start?return=/ko/');h.clock.now+=10*60e3+1;
 const late=await b.call('GET',`/api/v1/auth/github/callback?code=c&state=${new URL(s.location).searchParams.get('state')}`);
 assert.equal(reason(late.location),'state');h.clock.now=NOW;
 // A GitHub flow's cookie does not complete a Discord callback.
 const gs=await b.call('GET','/api/v1/auth/github/start');
 const cross=await b.call('GET',`/api/v1/auth/discord/callback?code=c&state=${new URL(gs.location).searchParams.get('state')}`);
 assert.equal(reason(cross.location),'state');
 assert.equal(h.mock.state.calls.length,0);
 // Replay: the callback clears the state cookie, so the same URL fails; with the cookie restored the
 // provider refuses the used code.
 const s2=await b.call('GET','/api/v1/auth/github/start');const cookie=b.jar.nerulio_oauth;
 const url=`/api/v1/auth/github/callback?code=one-time&state=${new URL(s2.location).searchParams.get('state')}`;
 assert.match((await b.call('GET',url)).location,/login=ok/);
 assert.equal(reason((await b.call('GET',url)).location),'state','replay without the cookie');
 b.jar.nerulio_oauth=cookie;
 assert.equal(reason((await b.call('GET',url)).location),'exchange','replay with a copied cookie: the code is single-use');
 assert.equal(count(h.db,'SELECT COUNT(*) n FROM sessions'),1,'no second session from a replay');
});

test('denied consent, provider 5xx, network failure and token errors come back as clear reasons',{skip},async()=>{
 const h=harness(),b=h.browser();
 const denied=await b.signIn('discord',{ret:'/ko/games/caves-of-qud/write',edit:()=>new URLSearchParams({error:'access_denied',error_description:'The resource owner or authorization server denied the request',state:'x'})});
 assert.equal(denied.callback.location,'/ko/account/?login=failed&reason=denied&provider=discord&return=%2Fko%2Fgames%2Fcaves-of-qud%2Fwrite');
 assert(denied.callback.setCookies.some(x=>x.startsWith('nerulio_oauth=;')),'state cleared on denial');
 h.mock.state.github.tokenStatus=502;
 assert.equal(reason((await b.signIn('github')).callback.location),'unavailable');
 h.mock.state.github.tokenStatus=200;h.mock.state.github.userStatus=503;
 assert.equal(reason((await b.signIn('github')).callback.location),'unavailable');
 h.mock.state.github.userStatus=200;h.mock.state.github.tokenBody={error:'bad_verification_code'};
 assert.equal(reason((await b.signIn('github')).callback.location),'exchange','GitHub answers errors with 200');
 h.mock.state.discord.tokenStatus=500;
 assert.equal(reason((await b.signIn('discord')).callback.location),'unavailable');
 h.mock.state.discord.tokenStatus=200;h.mock.state.down=true;
 assert.equal(reason((await b.signIn('discord')).callback.location),'unavailable','network error / timeout');
 h.mock.state.down=false;h.mock.state.discord.user={id:'not-a-snowflake',username:'x'};
 assert.equal(reason((await b.signIn('discord')).callback.location),'subject');
 assert.equal(count(h.db,"SELECT COUNT(*) n FROM users WHERE provider<>'system'"),0,'no account from a failed sign-in');
 assert.equal((await b.me()).loggedIn,false);
});

test('return paths: only same-site relative paths survive; the rest fall back to /account/',{skip},async()=>{
 const h=harness();
 for(const bad of ['//evil.example/x','https://evil.example/','/\\evil.example','javascript:alert(1)','/a b','/%0d%0aSet-Cookie:x'.replace('%0d%0a','\r\n')]){
  const b=h.browser();
  const {callback}=await b.signIn('github',{ret:bad});
  assert.equal(callback.location,'/account/?login=ok',JSON.stringify(bad));
 }
 assert.equal(validReturn('/ko/ai/claude/5'),true);assert.equal(validReturn('//x'),false);
 assert.equal(startURL('github','https://evil.example/'),'/api/v1/auth/github/start?return=%2Faccount%2F');
});

test('identities: one account per (provider, subject); the same e-mail on two providers is two accounts',{skip},async()=>{
 const h=harness();
 h.mock.state.github.emails=[{email:'same@example.test',primary:true,verified:true}];
 h.mock.state.discord.user={...h.mock.state.discord.user,email:'same@example.test',verified:true};
 await h.browser().signIn('github');await h.browser().signIn('discord');
 assert.equal(count(h.db,"SELECT COUNT(*) n FROM users WHERE provider<>'system'"),2,'never linked by e-mail');
 assert.equal(count(h.db,'SELECT COUNT(DISTINCT user_id) n FROM user_identities'),2);
});

test('linking: a signed-in member adds Discord to the GitHub account; refused when it belongs to someone else',{skip},async()=>{
 const h=harness(),b=h.browser();
 await b.signIn('github');
 const uid=h.db.raw.prepare("SELECT id FROM users WHERE provider='github'").get().id;
 const sessionBefore=b.jar.nerulio_session;
 const link=await b.signIn('discord',{ret:'/ko/account/',link:true});
 assert.equal(link.callback.location,'/ko/account/?linked=discord');
 assert.equal(b.jar.nerulio_session,sessionBefore,'linking keeps the session');
 assert.deepEqual(h.db.raw.prepare('SELECT provider FROM user_identities WHERE user_id=? ORDER BY provider').all(uid).map(r=>r.provider),['discord','github']);
 const ids=(await b.call('GET','/api/v1/auth/identities')).json;
 assert.deepEqual(ids.identities.map(i=>i.provider).sort(),['discord','github']);assert.equal(ids.canUnlink,true);assert.deepEqual(ids.providers,['github','discord']);
 // Discord alone now signs in to the same account.
 const other=h.browser();await other.signIn('discord');
 assert.equal(h.db.raw.prepare('SELECT user_id FROM sessions ORDER BY created_at DESC').get().user_id,uid);
 assert.equal(count(h.db,"SELECT COUNT(*) n FROM users WHERE provider<>'system'"),1);
 // Someone else's Discord account cannot be linked here.
 const c=h.browser();h.mock.state.discord.user={id:'999999999',username:'carol',verified:true,email:'c@example.test'};await c.signIn('discord');
 h.mock.state.github.user={id:777,login:'dave'};const d=h.browser();await d.signIn('github');
 const refused=await d.signIn('discord',{ret:'/ko/account/',link:true});
 assert.equal(reason(refused.callback.location),'linked_elsewhere');
 // A second Discord account on the same Nerulio account is refused too.
 h.mock.state.discord.user={id:'555555555',username:'second'};
 assert.equal(reason((await b.signIn('discord',{ret:'/ko/account/',link:true})).callback.location),'already_linked');
 // Linking needs a session (start) and the same session at the callback.
 const anon=h.browser();
 const noSession=await anon.call('GET','/api/v1/auth/discord/start?link=1&return=/ko/account/');
 assert.equal(reason(noSession.location),'link_session');assert(!noSession.location.startsWith('https://'));
 const e=h.browser();h.mock.state.github.user={id:888,login:'erin'};await e.signIn('github');
 const st=await e.call('GET','/api/v1/auth/discord/start?link=1&return=/ko/account/');
 await e.call('POST','/api/v1/auth/logout',{body:{}});
 assert.equal(reason((await e.call('GET',`/api/v1/auth/discord/callback?code=z&state=${new URL(st.location).searchParams.get('state')}`)).location),'link_session');
});

test('unlink: allowed while another way in remains; the first identity is handed over; last method refused',{skip},async()=>{
 const h=harness(),b=h.browser();
 await b.signIn('github');await b.signIn('discord',{ret:'/ko/account/',link:true});
 const uid=h.db.raw.prepare("SELECT id FROM users WHERE provider='github'").get().id;
 const r=await b.call('POST','/api/v1/auth/unlink',{body:{provider:'github'}});
 assert.equal(r.status,200);assert.deepEqual(r.json.identities.map(i=>i.provider),['discord']);assert.equal(r.json.canUnlink,false);
 const u=h.db.raw.prepare('SELECT provider,provider_subject FROM users WHERE id=?').get(uid);
 assert.deepEqual([u.provider,u.provider_subject],['discord','80351110224678912'],'users row now names the remaining identity');
 const last=await b.call('POST','/api/v1/auth/unlink',{body:{provider:'discord'}});
 assert.equal(last.status,409);assert.equal(last.json.error.reason,'last_method');
 assert.equal((await b.call('POST','/api/v1/auth/unlink',{body:{provider:'google'}})).status,404);
 assert.equal((await b.call('POST','/api/v1/auth/unlink',{body:{provider:'myspace'}})).status,400);
 assert.equal((await b.call('POST','/api/v1/auth/unlink',{body:{provider:'discord',extra:'x'}})).status,400);
 // The unlinked GitHub account is free again: it signs up as a new account.
 await h.browser().signIn('github');
 assert.equal(count(h.db,"SELECT COUNT(*) n FROM users WHERE provider<>'system'"),2);
 // An admin passkey counts as a remaining way in.
 h.db.raw.prepare("INSERT INTO admin_credentials(id,user_id,public_key,alg,name,created_at) VALUES('cred',?, 'pk',-7,'phone',1)").run(uid);
 assert.equal((await b.call('POST','/api/v1/auth/unlink',{body:{provider:'discord'}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT provider FROM users WHERE id=?').get(uid).provider,'unlinked');
 // Signed out: 401; cross-site: 403.
 const anon=h.browser();assert.equal((await anon.call('POST','/api/v1/auth/unlink',{body:{provider:'github'}})).status,401);
 assert.equal((await anon.call('GET','/api/v1/auth/identities')).status,401);
});

test('accounts from before 0011: backfilled by the migration, and lazily when inserted directly',{skip},async()=>{
 const db=new D1Shim();
 for(const f of migrationFiles().filter(f=>f<'0011'))db.raw.exec(readFileSync(new URL(`../migrations/${f}`,import.meta.url),'utf8'));
 db.raw.exec("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES('old','o@example.test','Old','google','g-sub',5)");
 for(const f of migrationFiles().filter(f=>f>='0011'))db.raw.exec(readFileSync(new URL(`../migrations/${f}`,import.meta.url),'utf8'));
 assert.deepEqual({...db.raw.prepare('SELECT provider,provider_subject,user_id,email FROM user_identities').get()},{provider:'google',provider_subject:'g-sub',user_id:'old',email:'o@example.test'});
 assert.equal(count(db,"SELECT COUNT(*) n FROM user_identities WHERE provider='system'"),0,'the Radar bot is not an identity');
 // Inserted directly (tests, operators): the identity appears on first use.
 const h=harness(PROVIDERS),b=h.browser();
 h.db.raw.exec("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES('direct',NULL,'D','github','583231',5)");
 const token=base64url(crypto.getRandomValues(new Uint8Array(32)));
 h.db.raw.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(await sha256(token),'direct',NOW,NOW+864e5);
 b.jar.nerulio_session=token;
 assert.deepEqual((await b.call('GET','/api/v1/auth/identities')).json.identities.map(i=>i.provider),['github']);
 // …and a GitHub sign-in with that id finds the same account.
 await h.browser().signIn('github');
 assert.equal(count(h.db,"SELECT COUNT(*) n FROM users WHERE provider<>'system'"),1);
});

test('OAUTH_TEST_ORIGIN (local E2E mock) is honoured only on local development builds',()=>{
 const env={OAUTH_TEST_ORIGIN:'http://127.0.0.1:9911',NERULIO_ENV:'development'};
 assert.equal(runtimeConfig(env,{preview:false,pages:false}).oauthTestOrigin,'http://127.0.0.1:9911');
 assert.equal(runtimeConfig(env,{preview:false,pages:true}).oauthTestOrigin,'','ignored on Pages builds');
 assert.equal(runtimeConfig(env,{preview:true,pages:true}).oauthTestOrigin,'','ignored on preview');
 assert.equal(runtimeConfig({...env,NERULIO_ENV:''},{preview:false,pages:false}).oauthTestOrigin,'','ignored outside development');
 assert.equal(runtimeConfig({...env,OAUTH_TEST_ORIGIN:'https://evil.example'},{preview:false,pages:false}).oauthTestOrigin,'','loopback http only');
 assert.equal(upstreamFor('http://127.0.0.1:9911')('https://github.com/login/oauth/authorize?a=1'),'http://127.0.0.1:9911/github.com/login/oauth/authorize?a=1');
 assert.equal(upstreamFor('')('https://discord.com/api/oauth2/token'),'https://discord.com/api/oauth2/token');
});

test('branded buttons: configured providers only, in order, escaped, with the brand colours class',()=>{
 const html=buttonsHTML(['discord','github','myspace'],'ko','/ko/ai/claude/?sort=top&page=2');
 assert.deepEqual([...html.matchAll(/data-provider="(\w+)"/g)].map(m=>m[1]),['github','discord']);
 assert(html.includes('GitHub로 계속하기')&&html.includes('Discord로 계속하기'));
 assert(html.includes('href="/api/v1/auth/github/start?return=%2Fko%2Fai%2Fclaude%2F%3Fsort%3Dtop%26page%3D2"'));
 assert(html.includes('class="sib sib-github"')&&html.includes('class="sib sib-discord"'));
 assert.equal(buttonsHTML([],'ko','/ko/'),'');
 assert(buttonsHTML(['google'],'en','/en/').includes('Continue with Google'));
 assert(buttonsHTML(['google'],'ja','/ja/').includes('Googleで続ける'));
 assert(buttonsHTML(['github'],'ko','/ko/account/',{link:true}).includes('link=1'));
});

test('platform state: configured providers for the sign-in sheet; a GitHub/Discord handle offered as nickname',{skip},async()=>{
 const h=harness(),b=h.browser();
 const anon=(await h.browser().call('GET','/api/v2/state',{api:handlePlatformApi})).json;
 assert.equal(anon.signedIn,false);assert.deepEqual(anon.providers,['github','discord']);
 await b.signIn('github');
 const st=(await b.call('GET','/api/v2/state',{api:handlePlatformApi})).json;
 assert.match(st.user.name,/^user-/,'the public nickname is never the provider name by itself');
 assert.equal(st.user.suggest,'octocat','the GitHub handle is offered, not the display name');
 const saved=await b.call('POST','/api/v2/profile',{api:handlePlatformApi,body:{displayName:'NightOwl'}});
 assert.equal(saved.status,200);
 assert.equal((await b.call('GET','/api/v2/state',{api:handlePlatformApi})).json.user.suggest,undefined,'no suggestion once a nickname is chosen');
 // A handle someone else already uses (case-insensitive) or a reserved one is not offered.
 h.mock.state.discord.user={id:'31337',username:'nightowl'};
 const c=h.browser();await c.signIn('discord');
 assert.equal((await c.call('GET','/api/v2/state',{api:handlePlatformApi})).json.user.suggest,undefined);
 h.mock.state.discord.user={id:'31338',username:'admin_team'};
 const d=h.browser();await d.signIn('discord');
 assert.equal((await d.call('GET','/api/v2/state',{api:handlePlatformApi})).json.user.suggest,undefined,'reserved');
 // Google identities never produce a suggestion (their names can be legal names).
 assert.equal(count(h.db,"SELECT COUNT(*) n FROM user_identities WHERE provider='google' AND handle IS NOT NULL"),0);
});

test('platform pages: the front box shows the configured buttons; every sign-in link goes to the chooser with a return path',async()=>{
 const {renderFront}=await import('../platform/render/front.js');
 const {renderMe}=await import('../platform/render/me.js');
 const {signInUrl}=await import('../platform/render/ui.js');
 const m={l:'ko',now:NOW,vertical:null,best:[],news:[],changes:[],reports:[],questions:[],popular:[],releases:[],upcoming:[],channels:[]};
 const on=String(renderFront(/** @type {any} */(m),{origin:ORIGIN,providers:['github','discord']}));
 const box=on.slice(on.indexOf('class="box login"'),on.indexOf('</section>',on.indexOf('class="box login"')));
 assert(box.includes('GitHub로 계속하기')&&box.includes('Discord로 계속하기')&&!box.includes('Google'),'configured providers only');
 assert(box.includes('/api/v1/auth/github/start?return=%2Fko%2Fcommunity%2F'));
 const off=String(renderFront(/** @type {any} */(m),{origin:ORIGIN,providers:[]}));
 assert(off.includes(`href="/ko/account/?return=%2Fko%2Fcommunity%2F" rel="nofollow" data-signin`),'no provider: a plain link to the chooser');
 assert(!/auth\/google\/start/.test(on+off));
 // Header 로그인 comes back to the page it was clicked on.
 assert(on.includes('class="hb solid" href="/ko/account/?return=%2Fko%2Fcommunity%2F" rel="nofollow" data-signin'));
 assert.equal(signInUrl('/en/ai/claude/write'),'/en/account/?return=%2Fen%2Fai%2Fclaude%2Fwrite');
 const me=String(renderMe({l:'ko'},{origin:ORIGIN}));
 assert(me.includes('data-suggested hidden')&&me.includes('Google·GitHub·Discord'));
});
