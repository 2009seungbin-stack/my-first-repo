import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {classify,deviceOf,browserOf,normalizePath,routeKind,parseHit,writePoint,observeRequest,handleHit,handleTraffic,trafficSummary,trafficQueries,mapTraffic,rangeWindow,missingConfig,clearTrafficCache,coverage,BLOB,BOTS,CATEGORIES} from '../server/traffic.js';
import {handlePlatformApi} from '../server/platform/api.js';
import {createLimiter} from '../server/ratelimit.js';
import {build} from '../tools/build.mjs';
import {configuration} from '../tools/site-config.mjs';
import {serviceRoutes,STATIC_EXCLUDES,PLATFORM_ROUTES} from '../tools/service-build.mjs';
import {withBeacon,BEACON_TAG} from '../tools/traffic-build.mjs';
import {policyContent,TRAFFIC_NOTE} from '../src/policies.js';

const origin='https://nerulio.example.test';
const fakeDataset=()=>{const points=[];return {points,writeDataPoint(p){points.push(p);}};};
const blob=(point,key)=>point.blobs[BLOB[key]-1];
const CHROME='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const page={acceptLanguage:'ko-KR,ko;q=0.9',secFetchMode:'navigate'};

/* ── classification: real User-Agent strings ── */
const CASES=[
 // [UA, cf, expected class, name, category]
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/128.0.6613.119 Safari/537.36',{asn:15169},'verified','Googlebot','search'],
 ['Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.119 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',{asn:15169},'verified','Googlebot','search'],
 ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',{asn:16509},'declared','Googlebot','search'],// spoofed from AWS
 ['Googlebot-Image/1.0',{asn:15169},'verified','Googlebot-Image','search'],
 ['Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',{asn:15169},'verified','Google-InspectionTool','search'],
 ['Mozilla/5.0 (compatible; Storebot-Google/1.0) Chrome/128.0.0.0 Safari/537.36',{asn:15169},'verified','Storebot-Google','search'],
 ['Mediapartners-Google',{asn:15169},'verified','Mediapartners-Google','other'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',{asn:8075},'verified','Bingbot','search'],
 ['Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',{asn:23576},'declared','Yeti (Naver)','search'],
 ['Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html?faqId=28966)',{},'declared','Daumoa (Daum)','search'],
 ['Mozilla/5.0 (compatible; MSIE or Firefox mutant; not on Windows server;) Daumoa 4.0',{},'declared','Daumoa (Daum)','search'],
 ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',{asn:714},'verified','Applebot','search'],
 ['DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',{},'declared','DuckDuckBot','search'],
 ['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',{asn:13238},'verified','YandexBot','search'],
 ['Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',{asn:55967},'verified','Baiduspider','search'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',{asn:8075},'declared','GPTBot','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',{},'declared','OAI-SearchBot','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',{},'declared','ChatGPT-User','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',{},'declared','ClaudeBot','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',{},'declared','Claude-User','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)',{},'declared','Claude-SearchBot','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',{},'declared','PerplexityBot','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',{},'declared','Perplexity-User','ai'],
 ['CCBot/2.0 (https://commoncrawl.org/faq/)',{},'declared','CCBot','ai'],
 ['Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',{},'declared','Bytespider','ai'],
 ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 (Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)',{asn:16509},'declared','Amazonbot','ai'],
 ['meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',{asn:32934},'verified','Meta-ExternalAgent','ai'],
 ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-CloudVertexBot; +https://cloud.google.com/enterprise-search) Chrome/128.0.0.0 Safari/537.36',{asn:15169},'verified','Google-CloudVertexBot','ai'],
 ['cohere-ai',{},'declared','cohere-ai','ai'],
 ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',{},'declared','AhrefsBot','seo'],
 ['Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',{},'declared','SemrushBot','seo'],
 ['Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)',{},'declared','MJ12bot','seo'],
 ['Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot; help@moz.com)',{},'declared','DotBot','seo'],
 ['Mozilla/5.0 (compatible; DataForSeoBot/1.0; +https://dataforseo.com/dataforseo-bot)',{},'declared','DataForSeoBot','seo'],
 ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',{asn:32934},'verified','facebookexternalhit','social'],
 ['facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984',{},'declared','kakaotalk-scrap','social'],
 ['TelegramBot (like TwitterBot)',{},'declared','TelegramBot','social'],
 ['Twitterbot/1.0',{asn:13414},'verified','Twitterbot','social'],
 ['Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',{},'declared','Slackbot','social'],
 ['Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',{},'declared','Discordbot','social'],
 ['WhatsApp/2.23.20.0',{},'declared','WhatsApp','social'],
 ['Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',{},'declared','UptimeRobot','monitor'],
 ['Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',{},'declared','Lighthouse','monitor'],
 ['curl/8.4.0',{},'suspected','curl','library'],
 ['python-requests/2.31.0',{},'suspected','python-requests','library'],
 ['Go-http-client/1.1',{},'suspected','Go-http-client','library'],
 ['Wget/1.21.4',{},'suspected','Wget','library'],
 ['axios/1.6.2',{},'suspected','axios','library'],
 ['okhttp/4.12.0',{},'suspected','okhttp','library'],
 ['Python/3.11 aiohttp/3.9.1',{},'suspected','aiohttp','library'],
 ['Scrapy/2.11.0 (+https://scrapy.org)',{},'suspected','Scrapy','library'],
 ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.6099.109 Safari/537.36',{},'suspected','HeadlessChrome','library'],
 ['',{},'suspected','No user agent','library'],
 ['Mozilla/5.0 (compatible; SomeNewCrawler/0.3; +https://example.com/bot)',{},'declared','SomeNewCrawler','other'],
];
test('classify: search, AI, SEO, social, monitoring and library clients by their real User-Agent',()=>{
 for(const [ua,cf,cls,name,category] of CASES){
  const r=classify({ua,cf,...page});
  assert.deepEqual([r.cls,r.name,r.category],[cls,name,category],ua);
  assert(CATEGORIES.includes(r.category),ua);
 }
 for(const [,name,category] of BOTS)assert(CATEGORIES.includes(category),name);
});
const HUMANS=[
 [CHROME,'desktop','chrome'],
 ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1','mobile','safari'],
 ['Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1','tablet','safari'],
 ['Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36','mobile','samsung'],
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Whale/3.27.254.15 Safari/537.36','desktop','whale'],
 ['Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36;KAKAOTALK 2410960','mobile','kakaotalk'],
 ['Mozilla/5.0 (Linux; Android 13; SM-G991N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.8.2)','mobile','naver'],
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0','desktop','firefox'],
 ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0','desktop','edge'],
 ['Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36','mobile','chrome'],
 ['Mozilla/5.0 (Linux; Android 14; SM-X710N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36','tablet','chrome'],
];
test('classify: people are candidates with a device class and browser family, never a UA string',()=>{
 for(const [ua,device,browser] of HUMANS){
  const r=classify({ua,cf:{asn:4766,country:'KR'},...page});
  assert.deepEqual(r,{cls:'candidate',name:'',category:'',reason:'',device,browser},ua);
  assert.equal(deviceOf(ua),device);assert.equal(browserOf(ua),browser);
 }
});
test('classify: suspected automation behind a browser UA',()=>{
 assert.equal(classify({ua:CHROME,cf:{asn:16509,asOrganization:'Amazon.com, Inc.'},...page}).reason,'datacenter');
 assert.equal(classify({ua:CHROME,cf:{asn:16509,asOrganization:'Amazon.com, Inc.'},...page}).name,'Datacenter · Amazon.com, Inc.');
 assert.equal(classify({ua:CHROME,cf:{asn:13335},...page}).cls,'candidate','Cloudflare WARP carries people');
 assert.equal(classify({ua:CHROME,secFetchMode:'navigate'}).reason,'no-accept-language');
 assert.equal(classify({ua:CHROME,acceptLanguage:'en'}).reason,'no-fetch-metadata');
 assert.equal(classify({ua:HUMANS[1][0],acceptLanguage:'ko'}).cls,'candidate','older Safari may omit Fetch Metadata');
 // Header checks only apply to page navigations; a beacon or robots.txt fetch is judged on the UA.
 assert.equal(classify({ua:CHROME,kind:'beacon'}).cls,'candidate');
 assert.equal(classify({ua:CHROME,kind:'beacon',webdriver:true}).reason,'webdriver');
 assert.equal(classify({ua:'Dalvik/2.1.0 (Linux; U; Android 13)',kind:'beacon'}).cls,'suspected');
 assert.equal(classify({ua:'SomeApp 1.0',kind:'beacon'}).reason,'non-browser-ua');
});
test('classify: Cloudflare verified-bot fields win when present (Bot Management; absent on Free)',()=>{
 assert.deepEqual(Object.values(classify({ua:'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',cf:{verifiedBotCategory:'Search Engine Crawler'}})).slice(0,4),['verified','Yeti (Naver)','search','cloudflare']);
 const r=classify({ua:'Mozilla/5.0 (compatible; Unknownish)',cf:{botManagement:{verifiedBot:true,score:1},verifiedBotCategory:'AI Crawler'}});
 assert.deepEqual([r.cls,r.name,r.category],['verified','AI Crawler','ai']);
 assert.equal(classify({ua:CHROME,cf:{verifiedBotCategory:''},...page}).cls,'candidate');
});

/* ── paths and beacon payload ── */
test('paths: no query except board filters, no foreign URLs',()=>{
 assert.equal(normalizePath('/ko/image/compress/?q=secret-name#x'),'/ko/image/compress/');
 assert.equal(normalizePath('/ko/ai/claude/?kind=tip&sort=new&email=a@b.c'),'/ko/ai/claude/?kind=tip&sort=new');
 assert.equal(normalizePath('/en/index.html'),'/en/');
 for(const bad of ['https://evil.test/','//evil.test/x','relative','/a b',42,null,'/'+'x'.repeat(600)])assert.equal(normalizePath(bad),null,String(bad));
 assert.equal(routeKind('GET','/robots.txt'),'robots');assert.equal(routeKind('HEAD','/sitemap-tools.xml'),'sitemap');assert.equal(routeKind('GET','/sitemap-n2-games.xml'),'sitemap');
 assert.equal(routeKind('GET','/ko/ai/claude/feed.xml'),'feed');assert.equal(routeKind('GET','/ko/image/compress/'),'page');assert.equal(routeKind('GET','/ko/about'),'page');
 for(const p of ['/src/app.js','/assets/a.png','/api/v2/hit','/admin/','/styles.css','/favicon.ico'])assert.equal(routeKind('GET',p),'',p);
 assert.equal(routeKind('POST','/ko/'),'');
});
test('beacon payload: closed set of small fields',()=>{
 assert.deepEqual(parseHit(JSON.stringify({p:'/ko/?q=x',r:'search',d:'mobile',l:'ko',e:1,w:0})),{p:'/ko/',r:'search',d:'mobile',l:'ko',e:true,w:false});
 assert.deepEqual(parseHit(JSON.stringify({p:'/en/',r:'weird',d:'fridge',l:'xx'})),{p:'/en/',r:'other',d:'',l:'other',e:false,w:false});
 for(const bad of ['not json','[]','{"p":"/x/","file":"secret.png"}','{"p":"https://evil.test/"}','{"p":"/src/app.js"}','{"p":"/robots.txt"}'])assert.equal(parseHit(bad),null,bad);
});

/* ── writing ── */
test('writePoint: one data point, fixed blob layout, no binding → no-op',()=>{
 assert.equal(writePoint({},{kind:'hit',cls:'human',path:'/ko/',route:'beacon'}),false);
 const ds=fakeDataset();
 assert.equal(writePoint({TRAFFIC:ds},{kind:'req',cls:'verified',name:'Googlebot',category:'search',path:'/robots.txt',country:'US',reason:'asn',route:'robots',asn:15169},{build:{preview:false}}),true);
 const [p]=ds.points;
 assert.deepEqual(p.indexes,['verified']);assert.deepEqual(p.doubles,[1,15169]);assert.equal(p.blobs.length,14);
 assert.equal(blob(p,'name'),'Googlebot');assert.equal(blob(p,'route'),'robots');assert.equal(blob(p,'env'),'production');assert.equal(blob(p,'country'),'US');
 const throwing={writeDataPoint(){throw Error('quota');}};assert.equal(writePoint({TRAFFIC:throwing},{kind:'hit',cls:'human',path:'/',route:'beacon'}),false,'never throws');
});
test('observeRequest: counts pages and crawler files only; never stores the UA or IP of a person',()=>{
 const ds=fakeDataset(),env={TRAFFIC:ds};
 const req=(p,ua,extra={},cf={})=>Object.assign(new Request(origin+p,{headers:{'user-agent':ua,'cf-connecting-ip':'203.0.113.7',...extra}}),{cf});
 assert.equal(observeRequest(req('/robots.txt','Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',{},{asn:15169,country:'US'}),env),true);
 assert.equal(observeRequest(req('/ko/community/',CHROME,{'accept-language':'ko-KR','sec-fetch-mode':'navigate'},{asn:4766,country:'KR'}),env),true);
 assert.equal(observeRequest(req('/src/app.js',CHROME),env),false);
 assert.equal(observeRequest(req('/robots.txt','curl/8'),{}),false,'no binding');
 const [bot,person]=ds.points;
 assert.equal(blob(bot,'cls'),'verified');assert.equal(blob(bot,'route'),'robots');
 assert.equal(blob(person,'cls'),'candidate');assert.equal(blob(person,'browser'),'chrome');assert.equal(blob(person,'locale'),'ko');assert.equal(person.doubles[1],0,'no ASN for people');
 const all=JSON.stringify(ds.points);assert(!all.includes('203.0.113.7')&&!all.includes('Chrome/129'),'no IP, no UA string');
});
const hitReq=(body,headers={},cf={asn:4766,country:'KR'})=>Object.assign(new Request(origin+'/api/v2/hit',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body),headers:{'content-type':'text/plain;charset=UTF-8','sec-fetch-site':'same-origin',origin,'user-agent':CHROME,'cf-connecting-ip':'198.51.100.4',...headers}}),{cf});
test('POST /api/v2/hit: validates, rate-limits, writes one point; humans vs bots that run JS',async()=>{
 const ds=fakeDataset(),env={TRAFFIC:ds},limiter=createLimiter();
 const hit=(b,h,cf)=>handleHit(hitReq(b,h,cf),env,null,{limiter,now:()=>1e12});
 assert.equal((await hit({p:'/ko/image/compress/',r:'search',d:'mobile',l:'ko',e:1,w:0})).status,204);
 const [p]=ds.points;
 assert.deepEqual([blob(p,'kind'),blob(p,'cls'),blob(p,'path'),blob(p,'ref'),blob(p,'device'),blob(p,'locale'),blob(p,'entry'),blob(p,'country')],['hit','human','/ko/image/compress/','search','mobile','ko','1','KR']);
 // Googlebot renders pages with JavaScript: its beacon counts as the bot, not a person.
 await hit({p:'/ko/',r:'direct',d:'desktop',l:'en',e:1,w:0},{'user-agent':'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.119 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'},{asn:15169});
 assert.deepEqual([blob(ds.points[1],'cls'),blob(ds.points[1],'name'),blob(ds.points[1],'ref'),blob(ds.points[1],'entry')],['verified','Googlebot','','0']);
 await hit({p:'/ko/',r:'direct',d:'desktop',l:'en',e:1,w:1});
 assert.deepEqual([blob(ds.points[2],'cls'),blob(ds.points[2],'reason')],['suspected','webdriver']);
 // Refusals: wrong method, cross-site, oversized, bad JSON, file-looking fields.
 assert.equal((await handleHit(new Request(origin+'/api/v2/hit'),env)).status,405);
 assert.equal((await hit({p:'/ko/'},{'sec-fetch-site':'cross-site',origin:'https://evil.test'})).status,403);
 assert.equal((await hit({p:'/ko/'},{'sec-fetch-site':'',origin:''})).status,403);
 assert.equal((await hit({p:'/ko/'},{'content-type':'application/x-www-form-urlencoded'})).status,415);
 assert.equal((await hit('{"p":"/ko/","r":"'+'x'.repeat(600)+'"}')).status,413);
 assert.equal((await hit({p:'/ko/',name:'passport.png'})).status,400);
 assert.equal(ds.points.length,3);
 // Burst limit per network: extra hits are dropped silently (still 204).
 for(let i=0;i<70;i++)await hit({p:'/en/'});
 assert.equal(ds.points.length,60,"60 per network per minute, the first three included");
 // No binding: 204 and nothing written.
 assert.equal((await handleHit(hitReq({p:'/ko/'}),{},null)).status,204);
});
test('/api/v2/hit is answered by the platform router before any session or D1 work',async()=>{
 const ds=fakeDataset();
 const res=await handlePlatformApi(hitReq({p:'/ko/community/',r:'internal',d:'desktop',l:'ko',e:0,w:0}),{TRAFFIC:ds},null);
 assert.equal(res.status,204);assert.equal(ds.points.length,1);
});

/* ── reading ── */
const NOW=Date.UTC(2026,8,29,6,30);// 15:30 KST
test('rangeWindow: Korea-time day boundaries',()=>{
 const t=rangeWindow('today',NOW);assert.equal(new Date(t.start).toISOString(),'2026-09-28T15:00:00.000Z');assert.equal(t.unit,'HOUR');
 assert.equal(new Date(rangeWindow('7d',NOW).start).toISOString(),'2026-09-22T15:00:00.000Z');
 assert.equal(new Date(rangeWindow('30d',NOW).start).toISOString(),'2026-08-30T15:00:00.000Z');
});
test('trafficQueries: five sampled-aware queries scoped to this environment',()=>{
 const q=trafficQueries('7d',NOW,{build:{preview:true}});
 assert.deepEqual(Object.keys(q),['series','bots','humanPages','botPages','breakdown']);
 for(const sql of Object.values(q)){
  assert(sql.includes('FROM nerulio_traffic')&&sql.includes("blob13 = 'preview'")&&sql.includes('_sample_interval')&&sql.endsWith('FORMAT JSON'),sql);
  assert(sql.includes(`toDateTime(${Math.floor(rangeWindow('7d',NOW).start/1000)})`));
 }
 assert(q.series.includes("INTERVAL '1' DAY, 'Asia/Seoul'"));assert(trafficQueries('today',NOW).series.includes("INTERVAL '1' HOUR"));
 assert.throws(()=>trafficQueries('today',NOW,{dataset:'x; DROP'}));
});
const ROWS={
 series:[{t:String((Date.UTC(2026,8,28,15)+3*3600e3)/1000),human:'5',candidate:'2',verified:'10',declared:'3',suspected:'4',entries:'2',ai:'6'},{t:(Date.UTC(2026,8,29,5))/1000,human:1,candidate:0,verified:0,declared:1,suspected:0,entries:1,ai:1}],
 bots:[{name:'Googlebot',category:'search',cls:'verified',n:'10'},{name:'GPTBot',category:'ai',cls:'declared',n:'4'},{name:'curl',category:'library',cls:'suspected',n:'4'},{name:'Odd',category:'weird',cls:'declared',n:'0'}],
 humanPages:[{path:'/ko/image/compress/',n:'4'},{path:'/ko/',n:'2'}],
 botPages:[{path:'/robots.txt',n:'9'}],
 breakdown:[{ref:'search',device:'mobile',browser:'chrome',locale:'ko',country:'KR',n:'4'},{ref:'direct',device:'desktop',browser:'whale',locale:'ko',country:'KR',n:'2'}]
};
test('mapTraffic: SQL rows → the admin contract shape',()=>{
 const t=mapTraffic('today',NOW,ROWS,{build:{trafficHtml:false},env:{TRAFFIC:{}}});
 assert.equal(t.range,'today');assert.equal(t.generatedAt,new Date(NOW).toISOString());
 assert.deepEqual(t.totals,{human:6,verifiedBot:10,declaredBot:4,suspectedBot:4});
 assert.equal(t.humans.pageviews,6);assert.equal(t.humans.visitors,3);assert.equal(t.humans.unconfirmed,2);
 assert.deepEqual(t.humans.sources,{search:4,direct:2});assert.deepEqual(t.humans.countries,[{country:'KR',n:6}]);
 assert.deepEqual(t.bots,[{name:'Googlebot',category:'search',verified:true,requests:10},{name:'GPTBot',category:'ai',verified:false,requests:4},{name:'curl',category:'library',verified:false,requests:4,suspected:true}]);
 assert.equal(t.aiBotRequests,7);
 assert.deepEqual(t.topPages,{human:[{path:'/ko/image/compress/',n:4},{path:'/ko/',n:2}],bot:[{path:'/robots.txt',n:9}]});
 // Zero-filled hourly series from 00:00 KST to now (15:30) → 16 buckets.
 assert.equal(t.series.length,16);assert.deepEqual(t.series[3],{t:'2026-09-28T18:00:00.000Z',human:5,bot:17});assert.deepEqual(t.series[14],{t:'2026-09-29T05:00:00.000Z',human:1,bot:1});
 assert.equal(t.series.reduce((s,x)=>s+x.human,0),t.totals.human);
 assert.equal(t.coverage.workerSeesHtml,false);assert.equal(typeof t.coverage.note,'string');assert.equal(t.coverage.recording,true);
 assert.equal(mapTraffic('30d',NOW,{series:[],bots:[],humanPages:[],botPages:[],breakdown:[]}).series.length,30);
 assert.equal(coverage({trafficHtml:true}).workerSeesHtml,true);assert.equal(coverage({adsHtml:true}).workerSeesHtml,true);
});
const CONFIGURED={TRAFFIC:fakeDataset(),CF_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',CF_ANALYTICS_TOKEN:'token-xyz'};
function fakeSql(){
 const calls=[];
 const f=async(url,init)=>{
  calls.push({url,init});
  const sql=String(init.body),key=sql.includes('AS entries')?'series':sql.includes('AS name')?'bots':sql.includes('AS ref')?'breakdown':sql.includes("= 'human' GROUP BY path")?'humanPages':'botPages';
  return new Response(JSON.stringify({meta:[],data:ROWS[key],rows:ROWS[key].length}),{headers:{'content-type':'application/json'}});
 };
 return {calls,fetch:f};
}
const admin=async()=>{};
test('GET /api/v2/admin/traffic: admin gate, range validation, NOT_CONFIGURED, SQL API, cache',async()=>{
 clearTrafficCache();
 const get=(q='',env=CONFIGURED,o={})=>handleTraffic(new Request(origin+'/api/v2/admin/traffic'+q),env,null,{requireAdmin:admin,now:()=>NOW,...o});
 assert.equal((await handleTraffic(new Request(origin+'/api/v2/admin/traffic'),CONFIGURED,null)).status,404,'fails closed without a gate');
 const refused=await get('',CONFIGURED,{requireAdmin:async()=>{const {ApiError}=await import('../server/http.js');throw new ApiError('NOT_FOUND');}});assert.equal(refused.status,404);
 const reauth=await get('',CONFIGURED,{requireAdmin:()=>new Response('{"error":"REAUTH"}',{status:401})});assert.equal(reauth.status,401);
 assert.equal((await get('?range=90d')).status,400);
 assert.equal((await handleTraffic(new Request(origin+'/api/v2/admin/traffic',{method:'POST'}),CONFIGURED,null,{requireAdmin:admin})).status,405);
 for(const [env,need] of [[{},'TRAFFIC'],[{TRAFFIC:{}},'CF_ACCOUNT_ID'],[{TRAFFIC:{},CF_ACCOUNT_ID:'0123456789abcdef0123456789abcdef'},'CF_ANALYTICS_TOKEN']]){
  const r=await get('',env);assert.equal(r.status,503);const b=await r.json();assert.equal(b.need,need);assert.equal(b.error.code,'NOT_CONFIGURED');
 }
 assert.deepEqual(missingConfig({}),['TRAFFIC','CF_ACCOUNT_ID','CF_ANALYTICS_TOKEN']);
 const sql=fakeSql();
 const r=await get('?range=7d',CONFIGURED,{fetch:sql.fetch});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const body=await r.json();assert.equal(body.range,'7d');assert.deepEqual(body.totals,{human:6,verifiedBot:10,declaredBot:4,suspectedBot:4});
 assert.equal(sql.calls.length,5);
 assert.equal(sql.calls[0].url,'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/analytics_engine/sql');
 assert.equal(sql.calls[0].init.headers.Authorization,'Bearer token-xyz');assert.equal(sql.calls[0].init.method,'POST');
 await get('?range=7d',CONFIGURED,{fetch:sql.fetch});assert.equal(sql.calls.length,5,'cached for a minute');
 const failing=async()=>new Response('{"errors":[{"message":"denied"}]}',{status:403});
 clearTrafficCache();const bad=await get('?range=today',CONFIGURED,{fetch:failing});assert.equal(bad.status,502);assert.equal((await bad.json()).error.code,'UPSTREAM_FAILED');
});
test('trafficSummary: compact overview block, null when not configured or unreachable',async()=>{
 clearTrafficCache();
 assert.equal(await trafficSummary({},NOW),null);
 const sql=fakeSql();
 assert.deepEqual(await trafficSummary(CONFIGURED,NOW,{fetch:sql.fetch}),{humanPageviews:6,botRequests:18,aiBotRequests:7,topBot:{name:'Googlebot',category:'search',verified:true,requests:10}});
 clearTrafficCache();
 assert.equal(await trafficSummary(CONFIGURED,NOW,{fetch:async()=>{throw Error('network');}}),null);
});

/* ── the beacon script ── */
function runBeacon({referrer='',session={},webdriver=false,visible='visible',coarse=true,path='/ko/image/compress/',search='?q=private&sort=new'}={}){
 const sent=[],timers=[],listeners={};const store={...session};
 const ctx={
  navigator:{sendBeacon:(u,b)=>{sent.push({u,b:JSON.parse(b)});return true;},webdriver,language:'ko-KR'},
  document:{referrer,visibilityState:visible,prerendering:false,addEventListener:(t,f)=>{(listeners['doc:'+t]||=[]).push(f);}},
  window:null,location:{pathname:path,search,hostname:'nerulio.com'},screen:{width:412,height:915},
  sessionStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}},
  URL,URLSearchParams,JSON,Math,String,
  setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout:()=>{}
 };
 ctx.window={matchMedia:()=>({matches:coarse}),addEventListener:(t,f)=>{(listeners['win:'+t]||=[]).push(f);}};
 return readFile(new URL('../src/hit.js',import.meta.url),'utf8').then(src=>{vm.runInNewContext(src,ctx);return {sent,timers,listeners,store};});
}
test('src/hit.js: one beacon after ~1 s visible, allow-listed query, referrer class, entry flag',async()=>{
 const a=await runBeacon({referrer:'https://www.google.com/'});
 assert.equal(a.sent.length,0,'nothing before the page has been visible for a second');
 assert.equal(a.timers[0].ms,1000);a.timers[0].f();
 assert.deepEqual(a.sent,[{u:'/api/v2/hit',b:{p:'/ko/image/compress/?sort=new',r:'search',d:'mobile',l:'ko',e:1,w:0}}]);
 assert.equal(a.store['nerulio.hit'],'1');
 a.listeners['win:pointerdown'][0]();assert.equal(a.sent.length,1,'once per pageview');
 const b=await runBeacon({session:{'nerulio.hit':'1'}});b.timers[0].f();
 assert.deepEqual([b.sent[0].b.r,b.sent[0].b.e],['internal',0],'no-referrer site: the tab flag marks internal navigation');
 const c=await runBeacon({referrer:'https://chatgpt.com/'});c.listeners['win:keydown'][0]();assert.equal(c.sent[0].b.r,'ai','first interaction sends at once');
 const d=await runBeacon({referrer:'https://cafe.naver.com/some',coarse:false});d.timers[0].f();assert.deepEqual([d.sent[0].b.r,d.sent[0].b.d],['social','desktop']);
 const e=await runBeacon({visible:'hidden'});assert.equal(e.timers.length,0,'background tabs are not counted until shown');
 const f=await runBeacon({webdriver:true});f.timers[0].f();assert.equal(f.sent[0].b.w,1);
 const g=await runBeacon({path:'/admin/'});assert.equal(g.timers.length,0,'the admin app is never counted');
});

/* ── build: flags, routes, beacon tag, privacy text ── */
async function withBuild(env,fn){
 const temp=await mkdtemp(path.join(os.tmpdir(),'nerulio-traffic-')),outDir=path.join(temp,'dist');
 try{await build({outDir,env});await fn(outDir,f=>readFile(path.join(outDir,f),'utf8'));}finally{await rm(temp,{recursive:true,force:true});}
}
test('TRAFFIC_HTML is validated, needs the platform Worker and defaults to on there',()=>{
 assert.throws(()=>configuration({TRAFFIC_HTML:'yes'}),/TRAFFIC_HTML must be on or off/);
 assert.throws(()=>configuration({SERVICE_API:'on',TRAFFIC_HTML:'on'}),/PLATFORM=on/);
 assert.equal(configuration({SERVICE_API:'on',PLATFORM:'on'}).traffic,true);
 assert.equal(configuration({SERVICE_API:'on'}).traffic,false);
 assert.equal(configuration({}).trafficHtml,false);
 assert.equal(configuration({SERVICE_API:'on'}).trafficHtml,false);
 assert.equal(configuration({SERVICE_API:'on',PLATFORM:'on'}).trafficHtml,true,'default on (Workers Paid)');
 assert.equal(configuration({SERVICE_API:'on',PLATFORM:'on',TRAFFIC_HTML:'off'}).trafficHtml,false);
});
test('_routes.json: crawler files always, HTML unless TRAFFIC_HTML=off; other builds unchanged',()=>{
 assert.deepEqual(serviceRoutes({service:true}),{version:1,include:['/api/*','/_worker.js/*'],exclude:[]});
 const plain=serviceRoutes({service:true,platform:true,traffic:true});
 assert.deepEqual(plain.include,['/api/*','/_worker.js/*',...PLATFORM_ROUTES,'/robots.txt','/sitemap*']);assert(!plain.include.includes('/*'));
 const html=serviceRoutes({service:true,platform:true,traffic:true,trafficHtml:true});
 assert.deepEqual(html.include,['/*']);
 for(const p of ['/src/*','/assets/*','/ai-runtime/*','/verify/*','/styles.css','/favicon.ico','/ads.txt'])assert(html.exclude.includes(p),p);
 for(const p of ['/robots.txt','/sitemap.xml','/sitemap-tools.xml'])assert(!html.exclude.includes(p),p);
 const ads=serviceRoutes({service:true,platform:true,traffic:true,client:'ca-pub-3141592653589793'});
 assert(!ads.exclude.includes('/robots.txt')&&ads.exclude.includes('/src/*'));
 assert.deepEqual(serviceRoutes({client:'ca-pub-3141592653589793'}).exclude,[...STATIC_EXCLUDES],'ads build without traffic unchanged');
 for(const r of [plain,html,ads])assert(r.include.length+r.exclude.length<=100&&[...r.include,...r.exclude].every(x=>x.length<=100),'_routes.json limits');
});
test('platform build: beacon on every static page, Worker flags, privacy text; default build has none',async()=>{
 await withBuild({SITE_URL:origin+'/',SERVICE_API:'on',PLATFORM:'on',TRAFFIC_HTML:'off'},async(out,read)=>{
  for(const f of ['ko/index.html','en/image/compress/index.html','ko/privacy/index.html','ko/game/index.html','ko/pricing/index.html','index.html'])assert.equal((await read(f)).split(BEACON_TAG).length,2,f);
  assert((await read('src/hit.js')).includes("sendBeacon('/api/v2/hit'"));
  assert.match(await read('_worker.js/server/build-info.js'),/"traffic":true,"trafficHtml":false/);
  assert((await read('_worker.js/server/traffic.js')).includes('export function classify'));
  const routes=JSON.parse(await read('_routes.json'));assert(routes.include.includes('/robots.txt')&&routes.include.includes('/sitemap*'));
  assert((await read('ko/privacy/index.html')).includes('nerulio.hit'));
  // The built Worker counts robots.txt and passes it through untouched.
  const {default:worker}=await import(pathToFileURL(path.join(out,'_worker.js','index.js')).href);
  const ds=fakeDataset(),env={TRAFFIC:ds,ASSETS:{fetch:async()=>new Response('User-agent: *\n',{headers:{'content-type':'text/plain'}})}};
  const res=await worker.fetch(Object.assign(new Request(origin+'/robots.txt',{headers:{'user-agent':'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)'}}),{cf:{asn:23576,country:'KR'}}),env,{waitUntil(){}});
  assert.equal(await res.text(),'User-agent: *\n');assert.equal(ds.points.length,1);assert.equal(blob(ds.points[0],'name'),'Yeti (Naver)');
  const hit=await worker.fetch(hitReq({p:'/ko/',r:'direct',d:'desktop',l:'ko',e:1,w:0}),env,{waitUntil(){}});
  assert.equal(hit.status,204);assert.equal(blob(ds.points[1],'cls'),'human');
 });
 await withBuild({SITE_URL:origin+'/',SERVICE_API:'on',PLATFORM:'on'},async(out,read)=>{
  assert.deepEqual(JSON.parse(await read('_routes.json')).include,['/*'],'default: every HTML page through the Worker');
  assert.match(await read('_worker.js/server/build-info.js'),/"trafficHtml":true/);
 });
 await withBuild({SITE_URL:origin+'/',SERVICE_API:'on'},async(out,read)=>{
  assert(!(await read('ko/index.html')).includes('hit.js'),'service-only build: no beacon');
  assert(!(await read('ko/privacy/index.html')).includes('nerulio.hit'));
  assert.match(await read('_worker.js/server/build-info.js'),/"traffic":false/);
 });
 await withBuild({SITE_URL:origin+'/'},async(out,read)=>{
  assert(!(await read('ko/index.html')).includes('hit.js'),'static build: no beacon');
 });
});
test('beacon tag and privacy note helpers',()=>{
 assert.equal(withBeacon('<head></head>',{traffic:false}),'<head></head>');
 assert.equal(withBeacon('<head></head>',{traffic:true}),`<head>${BEACON_TAG}</head>`);
 assert.equal(withBeacon(`<head>${BEACON_TAG}</head>`,{traffic:true}),`<head>${BEACON_TAG}</head>`);
 for(const l of ['ko','en','ja']){
  assert(policyContent('privacy',l,false,true,false,true).includes(TRAFFIC_NOTE[l].slice(0,20)),l);
  assert(!policyContent('privacy',l,false,true,false,false).includes('nerulio.hit'),l);
 }
});
