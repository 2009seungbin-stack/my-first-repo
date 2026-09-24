import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {handleApi,ipv6Groups,networkSubjects} from '../server/api.js';
import {runtimeConfig,proPriceIds} from '../server/config.js';
import {grantsPro} from '../server/identity.js';
import {signTicket,parsePrivateJwk} from '../server/tickets.js';
import {verifyTicket,newNonce} from '../src/ticket-verify.js';
import {generateTicketKeys} from '../tools/ticket-keys.mjs';
import {createLimiter} from '../server/ratelimit.js';
import {yearlySaving,yearlyText,priceText,pricingHTML} from '../src/service-content.js';
import {freeAnonStudioLimit} from '../src/quota.js';
import {configuration} from '../tools/site-config.mjs';
import {serviceMeta} from '../tools/service-build.mjs';
import {sha256,base64url} from '../server/crypto.js';

/** docs/MONETIZATION-SECURITY.md — the mechanisms behind the red-team verdicts, one by one. */
const skip=!sqliteAvailable&&'node:sqlite is unavailable in this Node version';
const ORIGIN='https://nerulio.test',SECRET='hardening-session-secret-0123456789abcdef-012345',DAY0=Date.UTC(2026,8,24,10,0,0);
function harness(envExtra={}){
 const db=D1Shim.migrated(),jar={},clock={now:DAY0},limiter=createLimiter();
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,...envExtra};
 const call=async(method,path,{body,ip='203.0.113.5'}={})=>{
  clock.now+=1000;
  const hd=new Headers({'cf-connecting-ip':ip});
  if(Object.keys(jar).length)hd.set('cookie',Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '));
  if(method==='POST'){hd.set('origin',ORIGIN);hd.set('content-type','application/json');}
  const r=await handleApi(new Request(ORIGIN+path,{method,headers:hd,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}},{now:()=>clock.now,random:()=>.5,limiter});
  for(const c of r.headers.getSetCookie()){const [pair]=c.split(';'),i=pair.indexOf('=');if(/Max-Age=0/.test(c))delete jar[pair.slice(0,i)];else jar[pair.slice(0,i)]=pair.slice(i+1);}
  return {status:r.status,json:await r.json()};
 };
 return {db,env,jar,clock,call,authorize:(toolId='studio-pack-export',operationId=crypto.randomUUID())=>call('POST','/api/v1/jobs/authorize',{body:{operationId,toolId}})};
}

test('signed answers: ECDSA P-256 round trip, nonce binding, tamper and key mismatch rejected',async()=>{
 const {privateKey,publicKey}=await generateTicketKeys(),other=await generateTicketKeys();
 const jwk=parsePrivateJwk(privateKey);assert(jwk,'base64url JWK parses');
 assert.match(publicKey,/^[A-Za-z0-9_-]{87}$/);
 const n=newNonce(),t=await signTicket(jwk,{kind:'me',n,plan:'pro',ads:false,loggedIn:true});
 assert.equal((await verifyTicket(publicKey,t,{kind:'me',n,plan:'pro'}))?.plan,'pro');
 assert.equal(await verifyTicket(publicKey,t,{kind:'me',n:newNonce(),plan:'pro'}),null,'another request\'s nonce');
 assert.equal(await verifyTicket(publicKey,t,{kind:'me',n,plan:'free'}),null,'claimed plan differs from the signed one');
 assert.equal(await verifyTicket(other.publicKey,t,{n}),null,'wrong key');
 const [body,sig]=t.split('.');
 const forged=base64url(new TextEncoder().encode(JSON.stringify({v:1,kind:'me',n,plan:'pro',ads:false,loggedIn:true})))+'.'+sig;
 assert.equal(forged===t,true,'same body re-encodes identically (sanity)');
 const tampered=base64url(new TextEncoder().encode(JSON.stringify({v:1,kind:'me',n,plan:'pro',ads:true,loggedIn:true})))+'.'+sig;
 assert.equal(await verifyTicket(publicKey,tampered,{n}),null,'edited payload');
 for(const junk of [undefined,'',body,'a.b','x'.repeat(5000)])assert.equal(await verifyTicket(publicKey,junk,{}),null);
 assert.equal(parsePrivateJwk('not a key'),null);assert.equal(parsePrivateJwk(JSON.stringify({kty:'RSA'})),null);
});

test('/me and authorize carry signatures bound to the request nonce / operationId',{skip},async()=>{
 const {privateKey,publicKey}=await generateTicketKeys();
 const h=harness({TICKET_PRIVATE_KEY:privateKey});
 const n=newNonce(),me=(await h.call('GET',`/api/v1/me?n=${n}`)).json;
 assert(await verifyTicket(publicKey,me.entitlement,{kind:'me',n,plan:'free',ads:true,loggedIn:false}));
 assert.equal((await h.call('GET','/api/v1/me?n=short')).json.entitlement,undefined,'no valid nonce, no signature');
 const op=crypto.randomUUID(),r=(await h.authorize('studio-pack-export',op)).json;
 assert(await verifyTicket(publicKey,r.ticket,{kind:'job',op,tool:'studio-pack-export',plan:'free'}));
 assert.equal(await verifyTicket(publicKey,r.ticket,{kind:'job',op:crypto.randomUUID()}),null,'a ticket is for one operation');
 assert.equal((await h.call('GET','/api/v1/health')).json.tickets,true);
});

test('anonymous Studio allowance → SIGN_IN_REQUIRED; sign-in unlocks the rest; network share for anonymous ids',{skip},async()=>{
 const h=harness();
 for(let i=0;i<3;i++)assert.equal((await h.authorize()).json.allowed,true);
 const r=await h.authorize();
 assert.equal(r.status,403);assert.equal(r.json.error.code,'SIGN_IN_REQUIRED');assert.equal(r.json.signInLimit,10);assert.equal(r.json.reason,'sign_in');
 const me=(await h.call('GET','/api/v1/me')).json.studioUsage;
 assert.deepEqual([me.used,me.limit,me.signInLimit,me.signInRequired],[3,3,10,true]);
 // Heavy file-tool jobs are not affected by the anonymous Studio rule.
 assert.equal((await h.authorize('upscale')).json.allowed,true);
 // New anonymous ids on the same network share ANON_NETWORK_STUDIO_EXPORTS (default 30).
 const k=harness({ANON_NETWORK_STUDIO_EXPORTS:'5'});let ok=0;
 for(let i=0;i<4;i++){for(const c of Object.keys(k.jar))delete k.jar[c];for(let j=0;j<3;j++)if((await k.authorize()).json.allowed)ok++;}
 assert.equal(ok,5);
 assert.equal(freeAnonStudioLimit('0',10),0);assert.equal(freeAnonStudioLimit('50',10),10,'never above the signed-in limit');
 const zero=harness({FREE_ANON_STUDIO_EXPORTS:'0'});assert.equal((await zero.authorize()).json.error.code,'SIGN_IN_REQUIRED','0 = sign in for every engine export');
});

test('logout moves the day\'s counters back to the browser; sessions are capped per account',{skip},async()=>{
 const h=harness();await h.call('GET','/api/v1/me');
 const uid=base64url(crypto.getRandomValues(new Uint8Array(16)));
 await h.db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,'u@e.test','U','google','s',1)").bind(uid).run();
 const token=base64url(crypto.getRandomValues(new Uint8Array(32)));
 await h.db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),uid,h.clock.now,h.clock.now+864e5).run();
 h.jar.nerulio_session=token;
 for(let i=0;i<10;i++)assert.equal((await h.authorize()).json.allowed,true);
 await h.call('POST','/api/v1/auth/logout',{body:{}});
 assert.equal((await h.authorize()).json.error.code,'SIGN_IN_REQUIRED','no second allowance after signing out');
});

test('offline grace tokens: at most what is left, charged once, bound to the identity and the day',{skip},async()=>{
 const h=harness({OFFLINE_GRACE_EXPORTS:'2'});
 const fresh=(await h.call('GET','/api/v1/me')).json;
 assert.deepEqual([fresh.grace.studio,fresh.grace.heavy],[[],[]],'none before a counted job today (a fresh identity collects nothing)');
 await h.authorize();
 const me=(await h.call('GET','/api/v1/me')).json;
 assert.equal(me.grace.studio.length,2);assert.equal(me.grace.heavy.length,0,'per class');
 await h.authorize();
 assert.equal((await h.call('GET','/api/v1/me')).json.grace.studio.length,1,'never more than remaining (3-2)');
 const r1=(await h.call('POST','/api/v1/jobs/reconcile',{body:{tokens:me.grace.studio[0]}})).json;
 const r2=(await h.call('POST','/api/v1/jobs/reconcile',{body:{tokens:me.grace.studio[0]}})).json;
 assert.deepEqual([r1.charged,r2.charged],[1,0]);
 assert.equal((await h.call('GET','/api/v1/me')).json.studioUsage.used,3);
 assert.equal((await h.call('GET','/api/v1/me')).json.grace.studio.length,0);
 const bad=(await h.call('POST','/api/v1/jobs/reconcile',{body:{tokens:'s1.AAAAAAAAAAAAAAAAAAAAAA'}})).json;
 assert.deepEqual(bad,{charged:0,invalid:1});
});

test('network buckets: IPv6 expanded to a real /64, hard cap for all Free identities, burst limiter',{skip},async()=>{
 assert.deepEqual(ipv6Groups('2001:db8::5'),['2001','db8','0','0','0','0','0','5']);
 assert.deepEqual(ipv6Groups('::ffff:192.0.2.1'),['0','0','0','0','0','ffff','c000','201']);
 for(const bad of ['2001:db8::1::2','gggg::1','1:2:3:4:5:6:7:8:9'])assert.equal(ipv6Groups(bad),null,bad);
 const a=await networkSubjects('2001:db8::5',SECRET,DAY0),b=await networkSubjects('2001:db8:0:0:ffff::9',SECRET,DAY0),c=await networkSubjects('2001:db8:0:1::5',SECRET,DAY0);
 assert.equal(a.narrow,b.narrow,'same /64');assert.notEqual(a.narrow,c.narrow);assert.equal(a.wide,c.wide,'same /48');
 const h=harness({NETWORK_DAILY_HARD_LIMIT:'4',ANON_NETWORK_DAILY_JOBS:'2'});
 let ok=0;for(let i=0;i<3;i++){for(const k of Object.keys(h.jar))delete h.jar[k];for(let j=0;j<3;j++)if((await h.authorize('upscale')).json.allowed)ok++;}
 assert.equal(ok,4);const last=await h.authorize('upscale');assert.equal(last.json.error.code,'NETWORK_LIMIT');assert.equal(last.status,429);
 const burst=harness({API_RATE_PER_MINUTE:'5'});burst.clock.now=DAY0;const codes=[];
 for(let i=0;i<8;i++){burst.clock.now-=1000;codes.push((await burst.authorize('upscale')).json.error?.code||'ok');}
 assert.deepEqual(codes.slice(5),['RATE_LIMITED','RATE_LIMITED','RATE_LIMITED']);
});

test('billing policy: dispute revokes + flags, canceled keeps the paid period, past_due grace 3–7 days, price sets',async()=>{
 const now=DAY0,day=864e5;
 assert.equal(grantsPro({plan:'pro',status:'active',current_period_end:now+day},now),true);
 assert.equal(grantsPro({plan:'pro',status:'active',current_period_end:now+day,disputed_at:now-1},now),false);
 assert.equal(grantsPro({plan:'pro',status:'canceled',current_period_end:now+day},now),true);
 assert.equal(grantsPro({plan:'pro',status:'canceled',current_period_end:now-1},now),false);
 assert.equal(grantsPro({plan:'pro',status:'past_due',past_due_since:now-6*day},now,{pastDueGraceDays:7}),true);
 assert.equal(grantsPro({plan:'pro',status:'past_due',past_due_since:now-8*day},now,{pastDueGraceDays:7}),false);
 assert.equal(grantsPro({plan:'other',status:'active',current_period_end:now+day},now),false);
 assert.equal(grantsPro({plan:'pro',status:'paused',current_period_end:now+day},now),false);
 for(const [v,want] of [['3',3],['7',7],['2',7],['8',7],['x',7]])assert.equal(runtimeConfig({PAST_DUE_GRACE_DAYS:v}).pastDueGraceDays,want,v);
 assert.deepEqual(proPriceIds({BILLING_PRICE_ID:'pri_m',BILLING_PRICE_ID_YEARLY:'pri_y',BILLING_PRICE_IDS_LEGACY:' pri_old , ,pri_m'}),['pri_m','pri_y','pri_old']);
});

test('NERULIO_ENV=development is ignored on a Cloudflare Pages build (sandbox billing stays off)',()=>{
 const env={NERULIO_ENV:'development',BILLING_PROVIDER:'sandbox',BILLING_WEBHOOK_SECRET:'w',DB:{},SESSION_SECRET:SECRET};
 const pages=runtimeConfig(env,{preview:false,pages:true});
 assert.equal(pages.environment,'production');assert.equal(pages.billing.mode,'off');assert.equal(pages.environmentOverrideRefused,true);
 assert.equal(runtimeConfig(env,{preview:false,pages:false}).billing.mode,'sandbox','local test builds keep the sandbox');
 assert.equal(configuration({CF_PAGES:'1'}).pagesBuild,true);assert.equal(configuration({}).pagesBuild,false);
});

test('pricing: monthly + yearly from config, saving computed (4.99×12 → 40 ≈ 33%), shown in ko/en/ja',async()=>{
 const pricing=configuration({PRO_PRICE_MONTHLY_AMOUNT:'4.99',PRO_PRICE_YEARLY_AMOUNT:'40',PRO_PRICE_CURRENCY:'usd'}).pricing;
 assert.deepEqual(pricing,{amount:'4.99',currency:'USD',interval:'month',yearlyAmount:'40'});
 assert.equal(yearlySaving(pricing),33);
 assert.equal(yearlySaving({amount:'10',yearlyAmount:'120'}),0,'no fake saving');
 assert.equal(priceText(pricing,'en'),'$4.99 / month');
 assert.equal(yearlyText(pricing,'en'),'$40.00 / year · save 33%');
 assert.match(yearlyText(pricing,'ko'),/33% 절약/);assert.match(yearlyText(pricing,'ja'),/33%お得/);
 for(const l of ['en','ko','ja']){const html=pricingHTML(l,{pricing,freeDailyJobs:30,freeDailyStudio:10,freeAnonStudio:3});assert.match(html,/data-price-yearly/);assert(!html.includes('{a}')&&!html.includes('{s}'),l);}
 assert.equal(configuration({PRO_PRICE_AMOUNT:'4.99',PRO_PRICE_CURRENCY:'USD'}).pricing.amount,'4.99','old name still works');
 assert.throws(()=>configuration({PRO_PRICE_YEARLY_AMOUNT:'forty',PRO_PRICE_CURRENCY:'USD'}),/PRO_PRICE_YEARLY_AMOUNT/);
 assert.throws(()=>configuration({PRO_PRICE_YEARLY_AMOUNT:'40'}),/PRO_PRICE_CURRENCY/);
});

test('build: the ticket public key reaches the page, the private key never does',async()=>{
 const {privateKey,publicKey}=await generateTicketKeys();
 assert.throws(()=>configuration({TICKET_PUBLIC_KEY:'nope'}),/TICKET_PUBLIC_KEY/);
 const cfg=configuration({SERVICE_API:'on',TICKET_PUBLIC_KEY:publicKey,TICKET_PRIVATE_KEY:privateKey});
 const meta=serviceMeta(cfg);
 assert(meta.includes(publicKey));assert(!meta.includes(privateKey));
 assert.equal(JSON.parse(meta.match(/content="([^"]+)"/)[1].replace(/&quot;/g,'"')).freeAnonStudio,3);
});
