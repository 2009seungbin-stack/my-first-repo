// Admin PWA (src/admin): pure modules, the service worker's handlers, and the build rules
// (dist/admin only with SERVICE_API=on + PLATFORM=on, noindex, never in a sitemap, never on the Worker).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {relTime,clock,dayClock,num,compact,pct,duration,hoursSpan,shiftDay,kstDay,toMs,dateTime} from '../src/admin/lib/format.js';
import {toB64url,fromB64url,creationOptions,requestOptions,registrationJSON,authenticationJSON,vapidKey} from '../src/admin/lib/b64.js';
import {parseError,createApi,AdminError,errorText,gated} from '../src/admin/lib/api.js';
import {groupCollectors,filterCollectors,rerunIds,homeAlert,usageView,badges,normalizePrefs,DEFAULT_PREFS,trafficView,trafficTile,shortError,errorAdvice} from '../src/admin/lib/model.js';
import {needText} from '../src/admin/lib/labels.js';
import {deviceName} from '../src/admin/lib/passkey.js';
import {adminBundle,adminFiles,prepareServiceWorker,ADMIN_CSP,ADMIN_HEADERS} from '../tools/admin-build.mjs';
import {build} from '../tools/build.mjs';
import {serviceRoutes} from '../tools/service-build.mjs';
import {fixtures} from './admin-fixtures.mjs';

// 2026-09-29 09:24:00 KST = 00:24 UTC
const NOW=Date.UTC(2026,8,29,0,24,0),M=6e4,H=36e5,D=864e5;

test('format: Korean relative times and KST clock times',()=>{
 assert.equal(relTime(NOW-10e3,NOW),'방금');
 assert.equal(relTime(NOW-3*M,NOW),'3분 전');
 assert.equal(relTime(NOW-2*H,NOW),'2시간 전');
 assert.equal(relTime(NOW+15*M,NOW),'15분 뒤');
 assert.equal(relTime(NOW+5*H,NOW),'5시간 뒤');
 assert.equal(relTime(NOW-26*H,NOW),'어제');
 assert.equal(relTime(NOW-4*D,NOW),'4일 전');
 assert.equal(relTime(NOW-30*D,NOW),'8/30');
 assert.equal(relTime(null,NOW),'—');
 assert.equal(clock(NOW),'09:24');                         // KST, not UTC
 assert.equal(clock(Date.UTC(2026,8,28,15,0)),'00:00');    // 15:00 UTC = midnight KST
 assert.equal(kstDay(Date.UTC(2026,8,28,15,30)),'2026-09-29');
 assert.equal(dayClock(NOW-34*M,NOW),'08:50');
 assert.equal(dayClock(NOW-12*H,NOW),'어제 21:24');
 assert.equal(dayClock(NOW-3*D,NOW),'9/26 09:24');
 assert.equal(dateTime(NOW),'9/29 09:24');
 assert.equal(toMs(1790000000),1790000000000,'epoch seconds');
 assert.equal(toMs('2026-09-29T00:24:00Z'),NOW);
 assert.equal(toMs('bogus'),null);
});
test('format: numbers, magnitudes, shares, durations',()=>{
 assert.equal(num(1240),'1,240');assert.equal(num(null),'—');assert.equal(num('x'),'—');
 assert.equal(compact(100000),'10만');assert.equal(compact(5000000),'500만');assert.equal(compact(50_000_000),'5000만');assert.equal(compact(25_000_000_000),'250억');assert.equal(compact(12500),'1.3만');assert.equal(compact(980),'980');
 assert.equal(pct(1240,100000),'1.2%');assert.equal(pct(45.6,100),'46%');assert.equal(pct(1,100000),'<0.1%');assert.equal(pct(0,0),'0%');
 assert.equal(duration(NOW,NOW+7600),'7.6초');assert.equal(duration(NOW,NOW+125000),'2분 5초');assert.equal(duration(NOW,NOW-1),'');
 assert.equal(hoursSpan(24),'24시간');assert.equal(hoursSpan(168),'7일');assert.equal(hoursSpan(0.5),'30분');
 assert.equal(shiftDay('2026-10-01',-1),'2026-09-30');assert.equal(shiftDay('2026-12-31',1),'2027-01-01');
});
test('base64url round trip, including lengths that need padding and the + / alphabet',()=>{
 for(let n=0;n<70;n++){
  const bytes=new Uint8Array(n).map((_,i)=>(i*37+n*11)&255);
  const s=toB64url(bytes);
  assert(!/[+/=]/.test(s),s);
  assert.deepEqual([...fromB64url(s)],[...bytes]);
 }
 assert.deepEqual([...fromB64url('-_8')],[...fromB64url('+/8=')],'standard base64 is accepted too');
 assert.throws(()=>fromB64url('abc$'));assert.throws(()=>fromB64url('a'));
 assert.equal(toB64url(new Uint8Array([251,255]).buffer),'-_8');
 assert.equal(vapidKey('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U').length,65);
});
test('WebAuthn options: base64url fields become ArrayBuffers (bare or {publicKey})',()=>{
 const ch=toB64url(new Uint8Array([1,2,3,4])),uid=toB64url(new TextEncoder().encode('handle')),cid=toB64url(new Uint8Array([9,9]));
 const c=creationOptions({publicKey:{challenge:ch,rp:{id:'nerulio.com',name:'N'},user:{id:uid,name:'o',displayName:'운영자'},pubKeyCredParams:[{type:'public-key',alg:-7}],excludeCredentials:[{id:cid,type:'public-key',transports:['internal']}]}});
 assert(c.challenge instanceof ArrayBuffer&&c.user.id instanceof ArrayBuffer&&c.excludeCredentials[0].id instanceof ArrayBuffer);
 assert.deepEqual([...new Uint8Array(c.challenge)],[1,2,3,4]);
 assert.equal(new TextDecoder().decode(c.user.id),'handle');
 assert.equal(c.rp.id,'nerulio.com');assert.deepEqual(c.excludeCredentials[0].transports,['internal']);
 const r=requestOptions({challenge:ch,rpId:'nerulio.com',allowCredentials:[{id:cid}]});
 assert(r.challenge instanceof ArrayBuffer&&r.allowCredentials[0].id instanceof ArrayBuffer&&r.allowCredentials[0].type==='public-key');
 assert.throws(()=>creationOptions({challenge:ch}),/Invalid creation options/);
 assert.throws(()=>requestOptions({}),/Invalid request options/);
});
test('WebAuthn credentials → JSON with base64url fields',()=>{
 const buf=a=>new Uint8Array(a).buffer;
 const reg=registrationJSON({id:'AQI',rawId:buf([1,2]),type:'public-key',authenticatorAttachment:'platform',response:{clientDataJSON:buf([123,125]),attestationObject:buf([5,6,7]),getTransports:()=>['internal','hybrid'],getPublicKeyAlgorithm:()=>-7,getPublicKey:()=>buf([8]),getAuthenticatorData:()=>buf([9])},getClientExtensionResults:()=>({credProps:{rk:true}})});
 assert.deepEqual(reg,{id:'AQI',rawId:'AQI',type:'public-key',authenticatorAttachment:'platform',response:{clientDataJSON:'e30',attestationObject:'BQYH',transports:['internal','hybrid'],publicKeyAlgorithm:-7,publicKey:'CA',authenticatorData:'CQ'},clientExtensionResults:{credProps:{rk:true}}});
 const auth=authenticationJSON({id:'AQI',rawId:buf([1,2]),type:'public-key',response:{clientDataJSON:buf([123,125]),authenticatorData:buf([1]),signature:buf([2]),userHandle:null}});
 assert.deepEqual(auth.response,{clientDataJSON:'e30',authenticatorData:'AQ',signature:'Ag',userHandle:null});
 assert.equal(auth.authenticatorAttachment,null);
});
test('API errors: envelope and contract shorthand shapes',()=>{
 assert.deepEqual(parseError(503,{error:'NOT_CONFIGURED',need:'GITHUB_DISPATCH_TOKEN'}),{code:'NOT_CONFIGURED',need:'GITHUB_DISPATCH_TOKEN',message:'',missing:[]});
 assert.deepEqual(parseError(503,{error:{code:'NOT_CONFIGURED',message:'x',need:'CF_ANALYTICS_TOKEN'}}),{code:'NOT_CONFIGURED',need:'CF_ANALYTICS_TOKEN',message:'x',missing:[]});
 assert.equal(parseError(503,{error:{code:'SERVICE_NOT_CONFIGURED'}}).code,'NOT_CONFIGURED');
 assert.equal(parseError(401,{error:'REAUTH'}).code,'REAUTH');
 // server/traffic.js 503: {need, missing, error:{code,message,need}}
 assert.deepEqual(parseError(503,{need:'TRAFFIC',missing:['TRAFFIC','CF_ACCOUNT_ID'],error:{code:'NOT_CONFIGURED',message:'m',need:'TRAFFIC'}}),{code:'NOT_CONFIGURED',need:'TRAFFIC',message:'m',missing:['TRAFFIC','CF_ACCOUNT_ID']});
 assert.equal(parseError(404,null).code,'NOT_FOUND');
 assert(gated('/api/v2/admin/overview')&&gated('/api/v2/mod/queue')&&!gated('/api/v2/admin/passkey/login/options')&&!gated('/api/v1/auth/logout'));
 assert.match(errorText(new AdminError({status:503,code:'NOT_CONFIGURED',need:'GITHUB_DISPATCH_TOKEN'})),/설정 필요: .*GitHub 실행 토큰/);
 assert.equal(errorText(new AdminError({status:409,code:'OPERATION_CONFLICT',message:'Already hidden.'})),'이미 임시조치된 대상이에요.');
 assert.equal(errorText(new AdminError({status:500,code:'INTERNAL',message:'D1 exploded'})),'서버 오류: D1 exploded','unknown server text is shown as sent');
 assert.match(errorText(new AdminError({status:0,code:'NETWORK'})),/인터넷/);
 assert.match(needText('CF_ANALYTICS_TOKEN').what,/Cloudflare 분석 토큰이 필요해요/);
 assert.match(needText('SOMETHING_NEW').how,/SOMETHING_NEW/);
});
/** A fetch double: answers from a list of [status, body, headers?] and records calls. */
function fakeFetch(answers){
 const calls=[];
 const f=async(url,init)=>{calls.push({url,init});const [status,body,headers={}]=answers.shift()||[500,{}];return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});};
 return {f,calls};
}
test('API client: REAUTH re-runs the passkey once and retries; concurrent requests share it',async()=>{
 const {f,calls}=fakeFetch([[401,{error:'REAUTH'}],[401,{error:'REAUTH'}],[200,{a:1}],[200,{b:2}]]);
 let reauths=0;
 const api=createApi({fetch:f,reauth:async()=>{reauths++;await new Promise(r=>setTimeout(r,10));}});
 const [a,b]=await Promise.all([api.get('/api/v2/admin/overview'),api.get('/api/v2/admin/collectors')]);
 assert.equal(reauths,1,'one fingerprint for both');
 assert.deepEqual([a,b].sort((x,y)=>Object.keys(x)[0].localeCompare(Object.keys(y)[0])),[{a:1},{b:2}]);
 assert.equal(calls.length,4);
 assert.equal(calls[0].init.credentials,'same-origin');
 // A second REAUTH after the retry is an error, not a loop.
 const t=fakeFetch([[401,{error:'REAUTH'}],[401,{error:'REAUTH'}]]);
 await assert.rejects(createApi({fetch:t.f,reauth:async()=>{}}).get('/api/v2/admin/me'),e=>e.code==='REAUTH');
 // A cancelled re-auth rejects the request.
 const c=fakeFetch([[401,{error:'REAUTH'}]]);
 await assert.rejects(createApi({fetch:c.f,reauth:async()=>{throw new AdminError({status:401,code:'REAUTH'});}}).get('/api/v2/admin/me'),e=>e.code==='REAUTH');
});
test('API client: 404 means "not an admin" only when /me agrees; NOT_CONFIGURED carries need; offline copies are flagged',async()=>{
 let out=0;
 const one=fakeFetch([[404,{error:{code:'NOT_FOUND'}}]]);
 await assert.rejects(createApi({fetch:one.f,signedOut:()=>out++}).get('/api/v2/admin/me'),e=>e.code==='NOT_ADMIN');
 assert.equal(out,1);
 const two=fakeFetch([[404,{error:{code:'NOT_FOUND',message:'No such collector.'}}]]);
 await assert.rejects(createApi({fetch:two.f,signedOut:()=>out++,stillAdmin:async()=>true}).get('/api/v2/admin/collectors/x/runs'),e=>e.code==='NOT_FOUND');
 assert.equal(out,1,'still an admin: no sign-out');
 const three=fakeFetch([[404,{}]]);
 await assert.rejects(createApi({fetch:three.f,signedOut:()=>out++,stillAdmin:async()=>false}).get('/api/v2/admin/overview'),e=>e.code==='NOT_ADMIN');
 assert.equal(out,2);
 const nc=fakeFetch([[503,{error:'NOT_CONFIGURED',need:'CF_ANALYTICS_TOKEN'}]]);
 await assert.rejects(createApi({fetch:nc.f}).get('/api/v2/admin/usage'),e=>e.code==='NOT_CONFIGURED'&&e.need==='CF_ANALYTICS_TOKEN');
 let served=null;
 const off=fakeFetch([[200,{ok:1},{'x-admin-offline':'1234'}]]);
 await createApi({fetch:off.f,served:(p,t)=>{served=t;}}).get('/api/v2/admin/overview');
 assert.equal(served,1234);
 const sw503=fakeFetch([[503,{error:{code:'OFFLINE'}}]]);
 await assert.rejects(createApi({fetch:sw503.f}).get('/api/v2/admin/overview'),e=>e.code==='NETWORK');
 await assert.rejects(createApi({fetch:async()=>{throw new TypeError('Failed to fetch');}}).post('/api/v2/mod/action',{}),e=>e.code==='NETWORK');
 const post=fakeFetch([[200,{ok:true}]]);
 await createApi({fetch:post.f}).post('/api/v2/admin/collectors/run',{adapters:['a']});
 assert.equal(post.calls[0].init.method,'POST');assert.equal(post.calls[0].init.headers['content-type'],'application/json');assert.equal(post.calls[0].init.body,'{"adapters":["a"]}');
});
test('collectors: problems first, schedules, filters, re-run ids',()=>{
 const f=fixtures(NOW),items=f.collectors.items;
 const g=groupCollectors(items);
 assert.deepEqual(g.problems.map(c=>c.state),['failing','never','never','never','never']);
 assert.equal(g.problems[0].id,'steam-news');
 assert.deepEqual(g.bySchedule['30m'].map(c=>c.id),['claude-status','openai-status']);
 assert.equal(g.bySchedule.manual.length,6);
 assert.deepEqual(g.counts,{all:21,problem:5,ok:10,manual:6});
 assert.equal(filterCollectors(items,'problem').length,5);assert.equal(filterCollectors(items,'ok').length,10);assert.equal(filterCollectors(items,'all').length,21);
 assert.deepEqual(rerunIds(items),['steam-news','steam-news-subculture','steam-store','studio-compat-kb-watch','studio-github-releases']);
 assert.deepEqual(groupCollectors(undefined).counts,{all:0,problem:0,ok:0,manual:0});
 assert.equal(shortError(items[0].last_error),'D1 무료 쓰기 한도 초과');
 assert.equal(shortError('fetch x: HTTP 503 upstream'),'상대 사이트 오류 (503)');
 assert.match(errorAdvice('The operation timed out'),/응답/);
});
test('home: alert card, badges, usage (Workers Paid monthly and the old daily shape)',()=>{
 const f=fixtures(NOW);
 const a=homeAlert(f.overview,NOW);
 assert.equal(a.parts[0].title,'steam-news 실패');
 assert.match(a.parts[1].body,/4개 수집기는 실행 기록이 없습니다/);
 assert.equal(a.rerun.length,5);assert.equal(a.dailyReset,false);
 const calm={...f.overview,collectors:{ok:10,failing:0,stale:0,never:0,manual:6,items:[]},status:[{service:'Claude',state:'operational'}]};
 assert.equal(homeAlert(calm,NOW),null);
 assert.equal(homeAlert({...calm,status:[{service:'Claude',state:'major_outage'}]},NOW).parts[0].title,'Claude 장애');
 assert.equal(homeAlert({...calm,status:[{service:'OpenAI',state:'incident'}]},NOW).parts[0].title,'OpenAI 장애','the backend says incident');
 assert.deepEqual(badges(f.overview),{collectors:5,mod:2,data:3});
 const m=usageView(f.usage);
 assert.equal(m.period,'month');assert.equal(m.limitW,50_000_000);assert.equal(m.written,6_120_000);assert.equal(m.today.w,212400);assert.equal(m.level,'ok');
 const hot=usageView({...f.usage,month:{rowsRead:1,rowsWritten:41_000_000}});
 assert.equal(hot.level,'warn');
 assert.match(homeAlert({...calm,usage:{...f.usage,month:{rowsRead:1,rowsWritten:41_000_000}}},NOW).parts[0].title,/^이번 달 D1 쓰기 82%/);
 const d=usageView(f.usageDaily);
 assert.equal(d.period,'day');assert.equal(d.limitW,100000);assert.equal(d.written,1240);
 assert.equal(homeAlert({...calm,usage:{today:{rowsWritten:100000},limit:{rowsWritten:100000}}},NOW).dailyReset,true);
 assert.equal(usageView(null),null);assert.equal(usageView({}),null);
});
test('notification prefs: normalized to the contract',()=>{
 assert.deepEqual(normalizePrefs(null),{...DEFAULT_PREFS,usageThresholds:[80,90,95],quiet:{from:'23:00',to:'07:00'}});
 const p=normalizePrefs({collectorFailN:3,usageThresholds:[95,80,80,70],flags:'hourly',quiet:null,statusStale:false,extra:1});
 assert.deepEqual(p,{collectorFailN:3,statusStale:false,usageThresholds:[80,95],flags:'hourly',aiIncident:true,proposals:false,newUsers:false,quiet:null});
 assert.equal(normalizePrefs({collectorFailN:7,flags:'sometimes',quiet:{from:'25:00',to:'07:00'}}).collectorFailN,1);
 assert.deepEqual(normalizePrefs({quiet:{from:'25:00',to:'07:00'}}).quiet,{from:'23:00',to:'07:00'});
 assert.deepEqual(Object.keys(normalizePrefs({})).sort(),['aiIncident','collectorFailN','flags','newUsers','proposals','quiet','statusStale','usageThresholds']);
});
test('traffic: totals, bot categories, verified flags, coverage',()=>{
 const f=fixtures(NOW),v=trafficView(f.traffic);
 assert.equal(v.human,2210);assert.equal(v.bot,2108+2552+550);assert.equal(v.pageviews,1834);assert.equal(v.visitors,612);assert.equal(v.unconfirmed,37);
 assert.equal(v.bots[0].name,'Googlebot');assert.equal(v.maxBot,1622);
 assert.deepEqual(v.bots.filter(b=>['Googlebot','GPTBot','python-requests'].includes(b.name)).map(b=>b.cls),['verified','declared','suspected']);
 assert.equal(v.byCategory.ai,804+412+272);assert.equal(v.aiBotRequests,1488);
 assert.deepEqual(v.breakdown.sources[0],{key:'search',n:820});assert.deepEqual(v.breakdown.countries[0],{key:'KR',n:1502});
 assert.deepEqual(v.coverage.unseen.length,2);
 assert.equal(v.coverage.workerSeesHtml,false);assert.match(v.coverage.note,/Worker/);
 assert.equal(v.series.length,24);
 const empty=trafficView({});assert.equal(empty.all,0);assert.equal(empty.coverage.workerSeesHtml,true);assert.equal(empty.visitors,null);
 assert.deepEqual(trafficTile(f.overview.traffic),{human:1834,bot:5210,ai:1488,topBot:'Googlebot',topBotRequests:1622});
 assert.equal(trafficTile({humanPageviews:1,botRequests:2,aiBotRequests:0,topBot:'GPTBot'}).topBot,'GPTBot');
 assert.equal(trafficTile(null),null);
});
test('device names from the user agent',()=>{
 assert.equal(deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'),'Android 휴대폰');
 assert.equal(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),'Windows PC');
 assert.equal(deviceName(''),'이 기기');
});

/* ---------- service worker (run in a vm with fake worker globals) ---------- */
function loadSW(source,{net=async()=>new Response('{}',{status:200})}={}){
 const listeners={},stores=new Map(),shown=[],opened=[],clientsList=[];
 const cacheOf=name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);const key=r=>typeof r==='string'?new URL(r,'https://nerulio.com').href:r.url;
  return {put:async(r,res)=>{m.set(key(r),res);},match:async r=>{const x=m.get(key(r));return x?x.clone():undefined;},addAll:async list=>{for(const r of list)m.set(key(r),new Response('shell'));}};};
 const caches={open:async n=>cacheOf(n),keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)};
 const self={location:new URL('https://nerulio.com/admin/sw.js'),addEventListener:(t,fn)=>{listeners[t]=fn;},skipWaiting:async()=>{},
  registration:{showNotification:async(title,opts)=>{shown.push({title,opts});},pushManager:{subscribe:async()=>null}},
  clients:{claim:async()=>{},matchAll:async()=>clientsList,openWindow:async u=>{opened.push(u);}}};
 // Relative URLs resolve against the worker's location, as in a real service worker.
 const Req=class extends Request{constructor(u,i){super(typeof u==='string'?new URL(u,'https://nerulio.com/admin/sw.js').href:u,i);}};
 const ctx=vm.createContext({self,caches,fetch:(...a)=>net(...a),Request:Req,Response,Headers,URL,JSON,Date,Number,String,Promise,console,setTimeout});
 vm.runInContext(source,ctx);
 const fire=async(type,ev)=>{const waits=[];let responded=null;const e={...ev,waitUntil:p=>waits.push(p),respondWith:p=>{responded=p;}};listeners[type](e);await Promise.all(waits);return responded?await responded:null;};
 return {listeners,stores,shown,opened,clientsList,fire};
}
test('service worker: push shows a notification with a deep link; click focuses the app on that screen',async()=>{
 const src=await readFile(new URL('../src/admin/sw.js',import.meta.url),'utf8');
 const sw=loadSW(src);
 const data=o=>({json:()=>o,text:()=>JSON.stringify(o)});
 await sw.fire('push',{data:data({kind:'collector_failed',payload:{id:'steam-news'},title:'수집기 steam-news 실패',body:'D1 쓰기 한도 초과'})});
 assert.equal(sw.shown[0].title,'수집기 steam-news 실패');
 assert.equal(sw.shown[0].opts.data.url,'/admin/#/collectors/steam-news');
 assert.equal(sw.shown[0].opts.badge,'/admin/icons/badge-96.png');
 await sw.fire('push',{data:data({kind:'flag',url:'/admin/#/mod'})});
 assert.equal(sw.shown[1].title,'새 신고');assert.equal(sw.shown[1].opts.data.url,'/admin/#/mod');
 await sw.fire('push',{data:data({kind:'usage',url:'https://evil.example/#/x'})});
 assert.equal(sw.shown[2].opts.data.url,'/admin/#/','foreign links never become the target');
 await sw.fire('push',{data:{json:()=>{throw Error('text');},text:()=>'plain'}});
 assert.equal(sw.shown[3].title,'Nerulio 관리');assert.equal(sw.shown[3].opts.body,'plain');
 // click: an open app window gets focus and a navigate message; none → a new window.
 const posted=[];let focused=0;
 sw.clientsList.push({url:'https://nerulio.com/ko/community/',postMessage(){},focus(){}},{url:'https://nerulio.com/admin/#/',postMessage:m=>posted.push(m),focus:async()=>{focused++;}});
 let closed=0;
 await sw.fire('notificationclick',{notification:{data:{url:'/admin/#/collectors/steam-news'},close:()=>closed++}});
 assert.deepEqual(JSON.parse(JSON.stringify(posted)),[{type:'navigate',hash:'#/collectors/steam-news'}]);assert.equal(focused,1);assert.equal(closed,1);
 sw.clientsList.length=0;
 await sw.fire('notificationclick',{notification:{data:{url:'/admin/#/mod'},close(){}}});
 assert.deepEqual([...sw.opened],['/admin/#/mod']);
});
test('service worker: network-first admin data with an offline copy; passkey and writes untouched',async()=>{
 const src=await readFile(new URL('../src/admin/sw.js',import.meta.url),'utf8');
 let online=true;
 const sw=loadSW(src,{net:async req=>{if(!online)throw new TypeError('offline');return new Response(JSON.stringify({url:req.url}),{status:200,headers:{'content-type':'application/json'}});}});
 const get=url=>({request:new Request(url)});
 const r1=await sw.fire('fetch',get('https://nerulio.com/api/v2/admin/overview'));
 assert.equal(r1.status,200);assert.equal(r1.headers.get('x-admin-offline'),null);
 online=false;
 const r2=await sw.fire('fetch',get('https://nerulio.com/api/v2/admin/overview'));
 assert.equal(r2.status,200);assert(Number(r2.headers.get('x-admin-offline'))>0,'offline copy is flagged');
 assert.equal((await r2.json()).url,'https://nerulio.com/api/v2/admin/overview');
 const r3=await sw.fire('fetch',get('https://nerulio.com/api/v2/admin/traffic?range=7d'));
 assert.equal(r3.status,503);assert.equal((await r3.json()).error.code,'OFFLINE');
 assert.equal(await sw.fire('fetch',get('https://nerulio.com/api/v2/admin/passkey/login/options')),null,'passkey: network only');
 assert.equal(await sw.fire('fetch',{request:new Request('https://nerulio.com/api/v2/mod/action',{method:'POST',body:'{}'})}),null,'writes: network only');
 assert.equal(await sw.fire('fetch',get('https://nerulio.com/ko/community/')),null,'outside the app: untouched');
 await sw.fire('message',{data:{type:'clear-data'}});
 assert(!sw.stores.has('admin-data'),'sign-out clears the offline copies');
});
test('service worker: the build fills in the version and the whole app shell',async()=>{
 const {version,files}=await adminBundle();
 assert.match(version,/^[0-9a-f]{10}$/);
 const sw=String(files.get('sw.js'));
 assert(sw.includes(`const VERSION='${version}';`));
 const shell=JSON.parse(/const SHELL=(\[.*?\]);/.exec(sw)[1]);
 const all=await adminFiles();
 for(const f of all)if(f!=='sw.js'&&f!=='index.html')assert(shell.includes('/admin/'+f),`${f} is precached`);
 assert(shell.includes('/admin/')&&!shell.includes('/admin/sw.js'));
 assert(String(files.get('index.html')).includes(`<meta name="admin-version" content="${version}">`));
 assert.throws(()=>prepareServiceWorker('nothing here',[],'x'),/placeholders/);
 // The installed worker precaches every file of the shell.
 const box=loadSW(sw);await box.fire('install',{});
 assert.equal(box.stores.get(`admin-shell-${version}`).size,shell.length);
});
test('admin source: no inline scripts or style attributes, no innerHTML, no eval (strict CSP)',async()=>{
 for(const f of await adminFiles()){
  if(!/\.(js|html|css)$/.test(f))continue;
  const text=await readFile(new URL('../src/admin/'+f,import.meta.url),'utf8');
  assert(!/<script(?![^>]*\bsrc=)/.test(text),`${f}: inline script`);
  assert(!/\sstyle="/.test(text),`${f}: style attribute`);
  assert(!/\.innerHTML\s*=|insertAdjacentHTML|\beval\(|new Function\(/.test(text),`${f}: HTML/eval sink`);
  assert(!/setAttribute\(\s*['"]style['"]/.test(text),`${f}: style attribute via setAttribute`);
 }
 assert(!ADMIN_CSP.includes('unsafe-inline')&&!ADMIN_CSP.includes('unsafe-eval')&&ADMIN_CSP.includes("script-src 'self';"));
});

/* ---------- build ---------- */
const origin='https://nerulio.example.test/';
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
async function withBuild(env,fn){
 const temp=await mkdtemp(path.join(os.tmpdir(),'nerulio-admin-')),outDir=path.join(temp,'dist');
 try{await build({outDir,env});await fn(outDir,f=>readFile(path.join(outDir,f),'utf8'));}finally{await rm(temp,{recursive:true,force:true});}
}
test('build: no admin app without SERVICE_API=on + PLATFORM=on (and never under /src)',async()=>{
 for(const env of [{SITE_URL:origin},{SITE_URL:origin,SERVICE_API:'on'}])await withBuild(env,async(out,read)=>{
  await assert.rejects(stat(path.join(out,'admin')),'no dist/admin');
  await assert.rejects(stat(path.join(out,'src','admin')),'src/admin is never copied');
  assert(!(await read('_headers')).includes('/admin/'),'no admin headers');
 });
});
test('build: SERVICE_API=on + PLATFORM=on ships /admin statically, noindex, out of sitemaps and off the Worker',async()=>{
 await withBuild({SITE_URL:origin,SERVICE_API:'on',PLATFORM:'on'},async(out,read)=>{
  const all=(await files(path.join(out,'admin'))).map(f=>path.relative(path.join(out,'admin'),f).split(path.sep).join('/')).sort();
  assert.deepEqual(all,await adminFiles(),'every app file, nothing else');
  await assert.rejects(stat(path.join(out,'src','admin')));
  const html=await read('admin/index.html');
  assert(html.includes('<meta name="robots" content="noindex,nofollow">'));
  assert(/<meta name="admin-version" content="[0-9a-f]{10}">/.test(html));
  assert(!(await read('admin/sw.js')).includes("const VERSION='dev'"));
  const headers=await read('_headers');
  assert(headers.includes(ADMIN_HEADERS.trim()));
  assert(/\/admin\/\*\n  ! Content-Security-Policy\n  Content-Security-Policy: [^\n]*script-src 'self';[^\n]*\n  ! X-Robots-Tag\n  X-Robots-Tag: noindex, nofollow/.test(headers));
  const routes=JSON.parse(await read('_routes.json'));
  // Traffic builds route every page through the Worker ('/*'); /admin/* must then be excluded.
  assert(!routes.include.some(r=>r.startsWith('/admin'))&&(!routes.include.includes('/*')||routes.exclude.includes('/admin/*')),'/admin/* is static: no Worker invocation');
  for(const f of (await readdir(out)).filter(f=>/^sitemap.*\.xml$/.test(f)))assert(!(await read(f)).includes('/admin'),`${f} lists no admin URL`);
  assert(!(await read('robots.txt')).includes('/admin'),'robots.txt does not advertise the path');
  const manifest=JSON.parse(await read('admin/manifest.webmanifest'));
  assert.equal(manifest.scope,'/admin/');assert.equal(manifest.start_url,'/admin/#/');
  for(const i of manifest.icons)await stat(path.join(out,i.src));
 });
 // Ads builds route HTML through the Worker; /admin/* stays excluded there too.
 assert(serviceRoutes({client:'ca-pub-3141592653589793'}).exclude.includes('/admin/*'));
});
