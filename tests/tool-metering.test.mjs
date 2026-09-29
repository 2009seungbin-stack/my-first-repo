import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {handleApi} from '../server/api.js';
import {runtimeConfig} from '../server/config.js';
import {sha256,base64url} from '../server/crypto.js';
import {verifyTicket,newNonce} from '../src/ticket-verify.js';
import {generateTicketKeys} from '../tools/ticket-keys.mjs';
import {build,ALL_ROUTES} from '../tools/build.mjs';
import {configuration,adHead} from '../tools/site-config.mjs';
import {serviceMeta} from '../tools/service-build.mjs';
import {POLICY_ROUTES} from '../src/policies.js';
import {policyContent} from '../src/policies.js';
import {locationParts} from '../src/i18n.js';
import {BEACON_TAG} from '../tools/traffic-build.mjs';
const PORTAL_TAG='<meta name="nerulio-portal" content="on">';

/** TOOL_METERING=off (docs/PRICING-MODEL.md, docs/CLOUDFLARE.md): a SERVICE_API + PLATFORM build whose
 * creator tools behave exactly like a build without accounts, while the account layer keeps working. */
const skip=!sqliteAvailable&&'node:sqlite is unavailable in this Node version';
const ORIGIN='https://nerulio.test',SECRET='metering-off-session-secret-0123456789abcdef-01',DAY0=Date.UTC(2026,8,29,10,0,0);
const SITE='https://nerulio.example.test/';
const AD={ADSENSE_CLIENT:'ca-pub-3141592653589793',ADSENSE_SLOT_CONTENT_1:'1234567890',ADSENSE_SLOT_STUDIO:'2345678901',ADSENSE_CMP_READY:'true'};

function harness(envExtra={}){
 const db=D1Shim.migrated(),jar={},clock={now:DAY0};
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,...envExtra};
 /** Browser-like fetch: same-origin cookies and Origin on POST, answered by the Worker in-process. */
 const fetch=async(url,init={})=>{
  clock.now+=1000;
  const hd=new Headers(init.headers||{});hd.set('cf-connecting-ip','203.0.113.9');
  if(Object.keys(jar).length)hd.set('cookie',Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '));
  if((init.method||'GET')==='POST')hd.set('origin',ORIGIN);
  const r=await handleApi(new Request(new URL(url,ORIGIN),{method:init.method||'GET',headers:hd,body:init.body}),env,{waitUntil(){}},{now:()=>clock.now,random:()=>.5});
  for(const c of r.headers.getSetCookie()){const [pair]=c.split(';'),i=pair.indexOf('=');if(/Max-Age=0/.test(c))delete jar[pair.slice(0,i)];else jar[pair.slice(0,i)]=pair.slice(i+1);}
  return r;
 };
 const call=async(method,p,body)=>{const r=await fetch(p,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json()};};
 return {db,env,jar,clock,fetch,call,authorize:(toolId,operationId=crypto.randomUUID())=>call('POST','/api/v1/jobs/authorize',{operationId,toolId})};
}
async function signIn(h){
 const id=base64url(crypto.getRandomValues(new Uint8Array(16))),token=base64url(crypto.getRandomValues(new Uint8Array(32)));
 await h.db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,'m@example.test','Member','google','g-meter',?2)").bind(id,h.clock.now).run();
 await h.db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),id,h.clock.now,h.clock.now+864e5).run();
 h.jar.nerulio_session=token;return id;
}
const rows=async(db,sql)=>(await db.prepare(sql).all()).results;

test('TOOL_METERING: validated, default on with SERVICE_API, off only by explicit choice',()=>{
 assert.equal(configuration({}).metering,false,'no accounts, nothing to meter');
 assert.equal(configuration({SERVICE_API:'on'}).metering,true,'default = current behaviour');
 assert.equal(configuration({SERVICE_API:'on',TOOL_METERING:'on'}).metering,true);
 assert.equal(configuration({SERVICE_API:'on',PLATFORM:'on',TOOL_METERING:'off'}).metering,false);
 assert.equal(configuration({TOOL_METERING:'off'}).metering,false,'off without accounts is harmless');
 assert.throws(()=>configuration({SERVICE_API:'on',TOOL_METERING:'no'}),/TOOL_METERING must be on or off/);
 assert.throws(()=>configuration({TOOL_METERING:'on'}),/SERVICE_API=on/);
 // Head fragments: with metering off a service config emits exactly what a build without accounts does.
 const off={service:true,metering:false,client:AD.ADSENSE_CLIENT,slots:{'content-1':'1234567890'},pricing:{},freeDailyJobs:30};
 assert.equal(serviceMeta(off),'','tool pages carry no account meta');
 assert.equal(adHead(off),adHead({...off,service:false}),'ads load as in a build without accounts (everyone Free)');
 assert.match(serviceMeta({...off,accountPage:true}),/&quot;metering&quot;:false/);
 assert(!serviceMeta({...off,accountPage:true}).includes('freeDailyJobs'),'no limits advertised');
 // Worker: build-time off or runtime off, either one switches metering off.
 assert.equal(runtimeConfig({}).metering,true);
 assert.equal(runtimeConfig({TOOL_METERING:'off'}).metering,false);
 assert.equal(runtimeConfig({},{service:true,metering:false}).metering,false);
 assert.equal(runtimeConfig({TOOL_METERING:'on'},{service:true,metering:false}).metering,false,'a build without the metered pages cannot be re-metered at runtime');
 // Privacy text: accounts without limits, no grace counter, no "daily limit" promise.
 const privacy=policyContent('privacy','en',false,'accounts');
 assert(privacy.includes('no daily limits')&&privacy.includes('nerulio_session')&&!privacy.includes('nerulio.grace')&&!privacy.includes('Pro payments'));
});

test('SERVICE_API+PLATFORM+TOOL_METERING=off build: every tool page equals the no-service build (ads on)',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'nerulio-meter-'));
 try{
  const plain=path.join(temp,'a','dist'),off=path.join(temp,'b','dist');
  await build({outDir:plain,env:{SITE_URL:SITE,...AD}});
  await build({outDir:off,env:{SITE_URL:SITE,...AD,SERVICE_API:'on',PLATFORM:'on',TOOL_METERING:'off'}});
  const read=(dir,f)=>readFile(path.join(dir,f),'utf8');
  let compared=0;
  for(const route of ALL_ROUTES){
   const where=locationParts('/'+route);
   if(POLICY_ROUTES.includes(where.path))continue;
   // The home pages move with the portal (tests/service-build.test.mjs checks them).
   if(!where.path)continue;
   const f=path.join(route,'index.html'),a=await read(plain,f),b=await read(off,f);
   // The only additions are the platform's visitor-statistics beacon (TRAFFIC; not metering) and the
   // portal: its marker and the Korean and English tool home at /{ko,en}/tools/ in links and hreflang.
   assert(b.includes(BEACON_TAG),`${f} has the traffic beacon`);
   const unportal=(/** @type {string} */ x)=>x.replace(PORTAL_TAG,'').replace(/(\/|")(ko|en)\/tools\//g,'$1$2/');
   assert.equal(unportal(b.replace(BEACON_TAG,'')),a,`${f} differs from the build without accounts`);
   compared++;
  }
  assert(compared>800,`compared ${compared} pages`);
  // Explicitly: no metering code path is reachable from a tool, Studio or landing page.
  for(const f of ['ko/image/upscale/index.html','en/video/compress/index.html','ko/game/studio/index.html','en/game/index.html','ko/index.html']){
   const html=await read(off,f);
   assert(!html.includes('nerulio-service'),`${f}: no account meta → entitlement.js fetches nothing`);
   assert(!html.includes('src/ads.js')||html.includes('adsbygoogle.js?client='),`${f}: ads are not gated on /me`);
  }
  const studio=await read(off,'ko/game/studio/index.html');
  assert(studio.includes('nerulio-studio-ad')&&!studio.includes('nerulio-service'),'Studio: ad column config only, as in the production build');
  // Tool sitemaps and robots are unchanged; pricing is neither built nor listed.
  const areaSitemaps=(await readdir(plain)).filter(f=>/^sitemap-.*\.xml$/.test(f));
  assert(areaSitemaps.length>=2,areaSitemaps.join());
  // sitemap-game.xml lists the home, which moves to /{ko,en}/tools/ with the portal (tests/service-build.test.mjs).
  // (Their <lastmod> follows each page's content hash, and the portal's breadcrumb root is the moved tool home.)
  const noDates=(/** @type {string} */ x)=>x.replace(/<lastmod>[^<]*<\/lastmod>/g,'');
  for(const f of [...areaSitemaps.filter(f=>f!=='sitemap-game.xml'),'robots.txt'])assert.equal(noDates(await read(off,f)),noDates(await read(plain,f)),f);
  for(const f of (await readdir(off)).filter(f=>/^sitemap.*\.xml$/.test(f)))assert(!(await read(off,f)).includes('/pricing/'),f);
  for(const l of ['','ko/','en/','ja/'])await assert.rejects(read(off,`${l}pricing/index.html`),`${l}pricing is not built`);
  // The account layer stays: account page (sign-in for the platform), Worker, admin app, verify frame.
  const account=await read(off,'ko/account/index.html');
  assert(account.includes('src/account-page.js')&&/<meta name="nerulio-service" content="[^"]*&quot;metering&quot;:false/.test(account));
  assert(account.includes('하루 사용 제한 없이')&&!account.includes('스튜디오 엔진 내보내기 횟수가 늘어나고'),'account lead promises no limits and no unlocks');
  assert.match(await read(off,'_worker.js/server/build-info.js'),/"platform":true.*"metering":false/);
  assert((await read(off,'admin/index.html')).length>0);
  assert((await read(off,'verify/index.html')).includes('noindex'));
  // Policy pages: same as before except the privacy text describes accounts without limits.
  const privacy=await read(off,'en/privacy/index.html');
  assert(privacy.includes('data-service="accounts"')&&privacy.includes('no daily limits')&&!privacy.includes('nerulio.grace')&&!privacy.includes('nerulio-service'));
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('Worker with metering off: stale pages are always allowed, nothing is counted or written',{skip},async()=>{
 const {privateKey,publicKey}=await generateTicketKeys();
 const h=harness({TOOL_METERING:'off',FREE_DAILY_JOBS:'2',FREE_DAILY_STUDIO_EXPORTS:'2',FREE_ANON_STUDIO_EXPORTS:'1',TICKET_PRIVATE_KEY:privateKey,BILLING_PROVIDER:'sandbox'});
 assert.equal((await h.call('GET','/api/v1/health')).json.metering,false);
 const n=newNonce(),me=(await h.call('GET',`/api/v1/me?n=${n}`)).json;
 assert.equal(me.metering,false);assert.equal(me.ads,true);assert.deepEqual([me.usage,me.studioUsage],[{unlimited:true},{unlimited:true}]);
 assert.equal(me.grace,undefined,'no offline tokens');
 assert(await verifyTicket(publicKey,me.entitlement,{kind:'me',n,plan:'free',ads:true,loggedIn:false}),'signed answer still verifies');
 // A page built while metering was on keeps calling authorize: far past every limit, always allowed.
 for(let i=0;i<8;i++){
  const op=crypto.randomUUID(),r=await h.authorize('upscale',op);
  assert.equal(r.status,200);assert.equal(r.json.allowed,true);assert.equal(r.json.metered,false);
  assert(r.json.remaining>5,'the old page shows no "remaining" toast');
  assert(await verifyTicket(publicKey,r.json.ticket,{kind:'job',op,tool:'upscale',plan:'free'}),'old pages that check signatures accept it');
 }
 for(let i=0;i<6;i++)assert.equal((await h.authorize('studio-pack-export')).json.allowed,true,`anonymous Studio export ${i+1}`);
 // The id contract is unchanged, so a stale page never sees a surprising code for a real export.
 assert.equal((await h.authorize('crop')).json.error.code,'NOT_METERED');
 assert.equal((await h.authorize('no-such-tool')).json.error.code,'UNKNOWN_TOOL');
 assert.deepEqual(await rows(h.db,'SELECT * FROM daily_usage'),[],'no counters');
 assert.deepEqual(await rows(h.db,'SELECT * FROM job_authorizations'),[],'no operation records');
 assert.deepEqual((await h.call('POST','/api/v1/jobs/reconcile',{tokens:'s1.AAAAAAAAAAAAAAAAAAAAAA'})).json,{charged:0,invalid:0,metered:false});
 assert.equal((await h.call('GET','/api/v1/usage')).json.metering,false);
 // Accounts still work; Pro is not sold while nothing is limited.
 const uid=await signIn(h);
 const signed=(await h.call('GET','/api/v1/me')).json;
 assert.equal(signed.loggedIn,true);assert.equal(signed.user.email,'m@example.test');assert.equal(signed.metering,false);
 assert.equal((await h.call('GET','/api/v1/auth/identities')).status,200);
 const checkout=await h.call('POST','/api/v1/billing/checkout',{locale:'en'});
 assert.equal(checkout.status,503);assert.equal(checkout.json.error.code,'BILLING_UNAVAILABLE');
 assert.equal((await h.call('POST','/api/v1/auth/logout',{})).json.loggedIn,false);
 assert(uid);
 // Contrast: the same deployment with metering on refuses at the configured limit.
 const on=harness({FREE_DAILY_JOBS:'2'});
 const codes=[];for(let i=0;i<3;i++)codes.push((await on.authorize('upscale')).json.error?.code||'ok');
 assert.deepEqual(codes,['ok','ok','DAILY_LIMIT']);
});

/** src/entitlement.js in a minimal page: meta content, fetch → the in-process Worker. */
async function page(meta,h,tag){
 const calls=[];
 globalThis.document={baseURI:ORIGIN+'/',documentElement:{lang:'en'},querySelector:s=>s==='meta[name="nerulio-service"]'&&meta?{content:JSON.stringify(meta)}:null,getElementById:()=>null,addEventListener(){},body:{append(){}},head:{append(){}},createElement:()=>({classList:{toggle(){}},setAttribute(){},dataset:{}})};
 globalThis.addEventListener=()=>{};globalThis.BroadcastChannel=class{postMessage(){}close(){}};
 globalThis.fetch=async(url,init)=>{calls.push(String(url));return h.fetch(url,init);};
 const mod=await import(`../src/entitlement.js?${tag}`);
 return {mod,calls};
}
test('client: tool metering off means no /me, no authorize and ads for everyone',{skip},async()=>{
 const saved={document:globalThis.document,fetch:globalThis.fetch,addEventListener:globalThis.addEventListener,BroadcastChannel:globalThis.BroadcastChannel};
 try{
  const h=harness({TOOL_METERING:'off'});
  // The account page of an off build: {metering:false} in its meta.
  const a=await page({api:'api/v1/',metering:false},h,'account');
  for(let i=0;i<40;i++)assert.equal(await a.mod.authorize('upscale'),true);
  assert.equal(await a.mod.authorize('studio-pack-export'),true);
  assert.equal(await a.mod.adsAllowed(),true);assert.equal(a.mod.meteringOn(),false);
  assert.deepEqual(a.calls,[],'nothing fetched for tools or ads');
  // A page built while metering was on, served by a Worker that now has it off: one /me, then local.
  const b=await page({api:'api/v1/',pricing:{},freeDailyJobs:30},h,'stale');
  for(let i=0;i<40;i++)assert.equal(await b.mod.authorize('upscale'),true,`heavy job ${i+1}`);
  for(let i=0;i<5;i++)assert.equal(await b.mod.authorize('studio-pack-export'),true,`Studio export ${i+1}`);
  assert.equal(await b.mod.adsAllowed(),true);assert.equal(b.mod.meteringOn(),false);
  assert.deepEqual(b.calls.map(u=>u.replace(/\?.*/,'')),['/api/v1/me'],'no authorize call');
  // Signed builds: "metering:false" is part of the signed /me answer. A rewritten answer from a metered
  // Worker (an extension adding metering:false) is not trusted, so it cannot switch limits off.
  const keys=await generateTicketKeys(),metered=harness({TICKET_PRIVATE_KEY:keys.privateKey,FREE_DAILY_JOBS:'1'});
  const forge={fetch:async(url,init)=>{const r=await metered.fetch(url,init);if(!String(url).includes('/me'))return r;const j=await r.json();return new Response(JSON.stringify({...j,metering:false}),{status:r.status,headers:{'content-type':'application/json'}});}};
  const d=await page({api:'api/v1/',ticketKey:keys.publicKey},forge,'forged');
  assert.equal(await d.mod.authorize('upscale'),false,'an unsigned "metering:false" is no answer: fail-closed');
  assert.equal(d.mod.current().status,'offline');
  const off=harness({TICKET_PRIVATE_KEY:keys.privateKey,TOOL_METERING:'off'});
  const e=await page({api:'api/v1/',ticketKey:keys.publicKey},off,'signed-off');
  for(let i=0;i<3;i++)assert.equal(await e.mod.authorize('upscale'),true,'a signed metering:false is honoured');
  assert.deepEqual(e.calls.map(u=>u.replace(/\?.*/,'')),['/api/v1/me']);
  // No account meta at all (every tool page of an off build): nothing is ever fetched.
  const c=await page(null,h,'tool');
  assert.equal(await c.mod.authorize('upscale'),true);assert.equal(await c.mod.adsAllowed(),true);assert.deepEqual(c.calls,[]);
 }finally{Object.assign(globalThis,saved);}
});
