// @ts-check
/** Visitor and bot statistics for the owner's admin app (방문자 screen).
 *
 * Two sources, both written as Workers Analytics Engine data points (binding TRAFFIC →
 * dataset nerulio_traffic), never as D1 rows:
 *  - 'hit': the first-party beacon (src/hit.js) posts once per pageview after the page has been
 *    visible for ~1 s or on the first interaction. Bots rarely run JavaScript, so a hit whose
 *    request is not itself a bot is a confirmed human pageview.
 *  - 'req': requests the Worker itself sees — robots.txt, sitemaps, the platform pages and, with
 *    TRAFFIC_HTML (default on in platform builds), every static HTML page. This is where crawlers are visible.
 * Reads go through the Analytics Engine SQL API (CF_ACCOUNT_ID + CF_ANALYTICS_TOKEN with
 * Account Analytics:Read), a handful of queries per range, cached briefly per isolate.
 *
 * Privacy: no IP address is written (the in-memory burst limiter keys on it for one minute and
 * never persists it); for people only a device class, browser family, language, country and
 * the page path without its query are written — never the User-Agent string. For bots the
 * published bot name/category is written. docs/CLOUDFLARE.md "방문자·봇 통계" has the setup. */
import BUILD from './build-info.js';
import {json,errorResponse,ApiError} from './http.js';
import {createLimiter} from './ratelimit.js';

/* ───────────────────────────── classification ───────────────────────────── */

/** Categories of the admin contract. */
export const CATEGORIES=Object.freeze(['search','ai','seo','social','monitor','library','other']);
/** ASNs a crawler's own requests come from. A request whose UA names the crawler AND whose ASN is
 * the operator's own network is 'verified'; the same UA from anywhere else is only 'declared'
 * (it may be spoofed). Only networks that are the operator's alone are listed — shared clouds
 * (Azure for GPTBot/Bing's partners, AWS for Amazonbot, GCP) cannot verify anything. */
const ASN=Object.freeze({google:[15169],microsoft:[8075],apple:[714,6185],yandex:[13238,208722],baidu:[55967,38365],meta:[32934],x:[13414]});
/**
 * Known automated clients, first match wins (specific tokens before generic ones).
 * [UA pattern, display name, category, operator ASNs for verification]
 * Sources (official UA documentation, checked 2026-09):
 *  Google  https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
 *          https://developers.google.com/search/docs/crawling-indexing/google-special-case-crawlers
 *          https://developers.google.com/search/docs/crawling-indexing/google-user-triggered-fetchers
 *  Bing    https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0
 *  Naver   https://searchadvisor.naver.com/guide/seo-basic-robots (Yeti)
 *  Daum    https://webmaster.daum.net (Daumoa)
 *  Apple   https://support.apple.com/en-us/119829 · DuckDuckGo https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot
 *  Yandex  https://yandex.com/support/webmaster/robot-workings/check-yandex-robots.html · Baidu https://help.baidu.com/question?prod_id=99&class=476&id=2996
 *  OpenAI  https://platform.openai.com/docs/bots · Anthropic https://support.claude.com/en/articles/8896518
 *  Perplexity https://docs.perplexity.ai/guides/bots · Common Crawl https://commoncrawl.org/ccbot
 *  Amazon  https://developer.amazon.com/amazonbot · Meta https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
 *  Mistral https://docs.mistral.ai/robots · Ahrefs https://ahrefs.com/robot · Semrush https://www.semrush.com/bot/
 *  Majestic https://mj12bot.com/ · Moz https://moz.com/help/moz-procedures/crawlers/dotbot · DataForSEO https://dataforseo.com/dataforseo-bot
 *  X/Twitter https://developer.x.com/en/docs/x-for-websites/cards/guides/getting-started · Slack https://api.slack.com/robots
 *  Kakao   kakaotalk-scrap (https://devtalk.kakao.com, link preview) · Telegram, WhatsApp, Discord: their link-preview UAs
 *  Bytespider, cohere-ai and the monitoring/library tokens: the UA strings those clients send.
 * @type {ReadonlyArray<readonly [RegExp,string,string,number[]?]>}
 */
export const BOTS=Object.freeze([
 // AI crawlers and assistants (before search: several share a vendor with a search crawler).
 [/GPTBot/i,'GPTBot','ai'],[/OAI-SearchBot/i,'OAI-SearchBot','ai'],[/ChatGPT-User/i,'ChatGPT-User','ai'],[/ChatGPT Agent/i,'ChatGPT Agent','ai'],
 [/ClaudeBot/i,'ClaudeBot','ai'],[/Claude-User/i,'Claude-User','ai'],[/Claude-SearchBot/i,'Claude-SearchBot','ai'],[/Claude-Web/i,'Claude-Web','ai'],[/anthropic-ai/i,'anthropic-ai','ai'],
 [/PerplexityBot/i,'PerplexityBot','ai'],[/Perplexity-User/i,'Perplexity-User','ai'],
 [/Google-CloudVertexBot/i,'Google-CloudVertexBot','ai',ASN.google],[/CCBot/,'CCBot','ai'],[/Bytespider/i,'Bytespider','ai'],
 [/Amazonbot/i,'Amazonbot','ai'],[/Meta-ExternalAgent/i,'Meta-ExternalAgent','ai',ASN.meta],[/Meta-ExternalFetcher/i,'Meta-ExternalFetcher','ai',ASN.meta],[/FacebookBot/i,'FacebookBot','ai',ASN.meta],
 [/cohere-training-data-crawler/i,'cohere-training-data-crawler','ai'],[/cohere-ai/i,'cohere-ai','ai'],[/MistralAI-User/i,'MistralAI-User','ai'],
 [/DuckAssistBot/i,'DuckAssistBot','ai'],[/YouBot/i,'YouBot','ai'],[/Diffbot/i,'Diffbot','ai'],[/AI2Bot/i,'AI2Bot','ai'],[/ImagesiftBot/i,'ImagesiftBot','ai'],
 [/Timpibot/i,'Timpibot','ai'],[/Kangaroo Bot/i,'Kangaroo Bot','ai'],[/omgili/i,'Omgili','ai'],[/Applebot-Extended/i,'Applebot-Extended','ai',ASN.apple],
 // Search engines.
 [/AdsBot-Google/i,'AdsBot-Google','other',ASN.google],[/Mediapartners-Google/i,'Mediapartners-Google','other',ASN.google],
 [/Googlebot-Image/i,'Googlebot-Image','search',ASN.google],[/Googlebot-Video/i,'Googlebot-Video','search',ASN.google],[/Googlebot-News/i,'Googlebot-News','search',ASN.google],
 [/Storebot-Google/i,'Storebot-Google','search',ASN.google],[/Google-InspectionTool/i,'Google-InspectionTool','search',ASN.google],[/GoogleOther/i,'GoogleOther','other',ASN.google],
 [/Googlebot/i,'Googlebot','search',ASN.google],[/FeedFetcher-Google/i,'FeedFetcher-Google','other',ASN.google],[/Google-Read-Aloud/i,'Google-Read-Aloud','other',ASN.google],
 [/Google-Site-Verification/i,'Google-Site-Verification','search',ASN.google],[/APIs-Google/i,'APIs-Google','other',ASN.google],
 [/bingbot/i,'Bingbot','search',ASN.microsoft],[/BingPreview/i,'BingPreview','search',ASN.microsoft],[/adidxbot/i,'AdIdxBot','other',ASN.microsoft],[/MicrosoftPreview/i,'MicrosoftPreview','social',ASN.microsoft],
 [/Yeti\//i,'Yeti (Naver)','search'],[/Daumoa|\bDaum\//,'Daumoa (Daum)','search'],[/Applebot/i,'Applebot','search',ASN.apple],[/DuckDuckBot/i,'DuckDuckBot','search'],
 [/YandexBot/i,'YandexBot','search',ASN.yandex],[/Yandex\w*\//,'Yandex','search',ASN.yandex],[/Baiduspider/i,'Baiduspider','search',ASN.baidu],
 [/Sogou/i,'Sogou','search'],[/SeznamBot/i,'SeznamBot','search'],[/PetalBot/i,'PetalBot','search'],[/MojeekBot/i,'MojeekBot','search'],[/coccocbot/i,'coccocbot','search'],
 [/Qwantify|Qwantbot/i,'Qwantbot','search'],[/Slurp/,'Yahoo Slurp','search'],[/Seekport/i,'SeekportBot','search'],[/Bravebot/i,'Bravebot','search'],
 // SEO tools.
 [/AhrefsSiteAudit/i,'AhrefsSiteAudit','seo'],[/AhrefsBot/i,'AhrefsBot','seo'],[/SemrushBot|SiteAuditBot/i,'SemrushBot','seo'],[/MJ12bot/i,'MJ12bot','seo'],
 [/DotBot/,'DotBot','seo'],[/rogerbot/i,'rogerbot','seo'],[/DataForSeoBot/i,'DataForSeoBot','seo'],[/BLEXBot/i,'BLEXBot','seo'],[/serpstatbot/i,'serpstatbot','seo'],
 [/Screaming Frog/i,'Screaming Frog','seo'],[/Barkrowler/i,'Barkrowler','seo'],[/SEOkicks/i,'SEOkicks','seo'],[/SenutoBot/i,'SenutoBot','seo'],[/Sitebulb/i,'Sitebulb','seo'],
 // Link previews and social. Kakao's scraper also says facebookexternalhit and Telegram's says
 // "like TwitterBot", so both come before those two.
 [/kakaotalk-scrap/i,'kakaotalk-scrap','social'],[/TelegramBot/i,'TelegramBot','social'],
 [/facebookexternalhit|facebookcatalog/i,'facebookexternalhit','social',ASN.meta],[/Twitterbot/i,'Twitterbot','social',ASN.x],[/Slackbot/i,'Slackbot','social'],
 [/Discordbot/i,'Discordbot','social'],[/WhatsApp\//,'WhatsApp','social'],
 [/LinkedInBot/i,'LinkedInBot','social'],[/Pinterestbot|Pinterest\/0\./i,'Pinterestbot','social'],[/redditbot/i,'redditbot','social'],[/Embedly/i,'Embedly','social'],
 [/Iframely/i,'Iframely','social'],[/SkypeUriPreview/i,'SkypeUriPreview','social'],[/Mastodon\//,'Mastodon','social'],[/Bluesky Cardyb/i,'Bluesky','social'],[/vkShare/i,'vkShare','social'],
 // Monitoring and performance tools.
 [/UptimeRobot/i,'UptimeRobot','monitor'],[/Pingdom/i,'Pingdom','monitor'],[/StatusCake/i,'StatusCake','monitor'],[/Better Uptime|BetterStack/i,'Better Stack','monitor'],
 [/Site24x7/i,'Site24x7','monitor'],[/Checkly/i,'Checkly','monitor'],[/DatadogSynthetics/i,'Datadog Synthetics','monitor'],[/Chrome-Lighthouse|Google Page Speed/i,'Lighthouse','monitor'],
 [/GTmetrix/i,'GTmetrix','monitor'],[/HetrixTools/i,'HetrixTools','monitor'],[/Uptime-Kuma/i,'Uptime Kuma','monitor'],[/Freshping/i,'Freshping','monitor'],
 [/NewRelicPinger/i,'New Relic','monitor'],[/W3C_Validator|W3C-checklink/i,'W3C Validator','monitor'],[/check_http|monitoring-plugins/i,'check_http','monitor'],
 // Archivers, feed readers, scanners.
 [/archive\.org_bot|ia_archiver/i,'Internet Archive','other'],[/Feedly|Feedbin|Inoreader|NewsBlur/i,'Feed reader','other'],
 [/CensysInspect/i,'Censys','other'],[/Expanse/i,'Expanse','other'],[/zgrab/i,'zgrab','other'],[/masscan/i,'masscan','other'],[/Nuclei/i,'Nuclei','other'],[/InternetMeasurement/i,'InternetMeasurement','other'],[/Nmap/i,'Nmap','other']
]);
/** Automation that does not call itself a bot → 'suspected' (library/headless), name shown as-is. */
/** @type {ReadonlyArray<readonly [RegExp,string]>} */
export const LIBRARIES=Object.freeze([
 [/HeadlessChrome/,'HeadlessChrome'],[/PhantomJS/i,'PhantomJS'],[/Puppeteer/i,'Puppeteer'],[/Playwright/i,'Playwright'],[/Selenium|webdriver/i,'Selenium'],
 [/\bcurl\//i,'curl'],[/\bWget\//i,'Wget'],[/python-requests/i,'python-requests'],[/python-urllib|Python-urllib/i,'python-urllib'],[/aiohttp/i,'aiohttp'],[/python-httpx|\bhttpx\//i,'httpx'],
 [/Scrapy/i,'Scrapy'],[/Go-http-client/i,'Go-http-client'],[/okhttp/i,'okhttp'],[/Apache-HttpClient/i,'Apache-HttpClient'],[/\bJava\//,'Java'],[/node-fetch/i,'node-fetch'],
 [/undici/i,'undici'],[/axios/i,'axios'],[/^node$|\bNode\.js\b/i,'Node.js'],[/libwww-perl/i,'libwww-perl'],[/GuzzleHttp/i,'Guzzle'],[/^PHP|\bPHP\//,'PHP'],[/^Ruby|Faraday/,'Ruby'],
 [/HTTPie/i,'HTTPie'],[/PostmanRuntime/i,'Postman'],[/\bDeno\//,'Deno'],[/\bBun\//,'Bun'],[/reqwest/i,'reqwest'],[/colly/i,'colly'],[/Dalvik\//,'Dalvik (Android app)'],[/CFNetwork\/.*Darwin/,'CFNetwork (Apple app)']
]);
/** Hosting networks people rarely browse from. A browser-looking request from one is 'suspected'
 * (VPN users included — a known false positive). Consumer relays are deliberately absent:
 * Cloudflare WARP / iCloud Private Relay (13335, 36183, 54113) and Microsoft/Google corporate
 * networks (8075, 15169) carry real people. */
export const DATACENTER_ASNS=new Set([16509,14618,396982,14061,24940,213230,16276,63949,20473,45102,37963,132203,45090,31898,51167,12876,60781,28753,9009,47583,8100,36352,53667,60068,212238,136907,55990,19318,46844,40021,62567,202425,210644]);
/** Cloudflare verified-bot categories (Enterprise Bot Management only; absent on Free) → ours. */
const CF_CATEGORY=Object.freeze({'Search Engine Crawler':'search','Search Engine Optimization':'seo','AI Crawler':'ai','AI Assistant':'ai','AI Search':'ai','Page Preview':'social','Monitoring & Analytics':'monitor','Feed Fetcher':'other','Advertising & Marketing':'other','Aggregator':'other','Archiver':'other','Academic Research':'other','Accessibility':'other','Security':'other','Webhooks':'other','Other':'other'});
const GENERIC_BOT=/bot\b|bot\/|crawl|spider|slurp|scrap|fetcher|archiver|preview|checker|monitor|headless|validator/i;

/** @param {string} ua */
export function deviceOf(ua){
 if(/iPad|Tablet|PlayBook|Silk\/|Kindle|Android(?!.*Mobile)/i.test(ua))return 'tablet';
 if(/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua))return 'mobile';
 return 'desktop';
}
/** Browser family only — the version and the rest of the UA are never written. @param {string} ua */
export function browserOf(ua){
 if(/KAKAOTALK/i.test(ua))return 'kakaotalk';
 if(/NAVER\(inapp|NAVER\//.test(ua))return 'naver';
 if(/Instagram|FBAN|FBAV|Line\/|Twitter for|TikTok|musical_ly/i.test(ua))return 'inapp';
 if(/Whale\//.test(ua))return 'whale';
 if(/SamsungBrowser\//.test(ua))return 'samsung';
 if(/Edg(?:e|A|iOS)?\//.test(ua))return 'edge';
 if(/OPR\/|Opera/.test(ua))return 'opera';
 if(/Firefox\/|FxiOS\//.test(ua))return 'firefox';
 if(/CriOS\/|Chrome\/|Chromium\//.test(ua))return 'chrome';
 if(/Version\/[\d.]+.*Safari\//.test(ua))return 'safari';
 return 'other';
}
/**
 * One request → one class. Pure: everything it reads is passed in.
 *  verified  — a known crawler confirmed by Cloudflare (cf.botManagement / cf.verifiedBotCategory,
 *              Enterprise only) or by coming from the operator's own ASN.
 *  declared  — the UA says it is a bot, but nothing confirms it (may be spoofed).
 *  suspected — no bot claim, but automation: HTTP library, headless browser, empty or non-browser
 *              UA, navigator.webdriver, a hosting ASN, or (page requests) a browser UA missing the
 *              headers every real browser sends (Accept-Language, Sec-Fetch-Mode).
 *  candidate — looks like a person. Only a beacon hit (JavaScript ran, page stayed visible)
 *              promotes it to 'human'.
 * @param {{ua?:string|null,acceptLanguage?:string|null,secFetchMode?:string|null,cf?:any,kind?:'page'|'beacon'|'file',webdriver?:boolean}} input
 * @returns {{cls:'verified'|'declared'|'suspected'|'candidate',name:string,category:string,reason:string,device:string,browser:string}}
 */
export function classify({ua,acceptLanguage=null,secFetchMode=null,cf=null,kind='page',webdriver=false}){
 const s=String(ua||'').slice(0,512),asn=Number(cf?.asn)||0;
 const bm=cf?.botManagement,cfCat=typeof cf?.verifiedBotCategory==='string'?cf.verifiedBotCategory:'';
 /** @param {'verified'|'declared'|'suspected'} cls @param {string} name @param {string} category @param {string} reason */
 const bot=(cls,name,category,reason)=>({cls,name,category,reason,device:'bot',browser:'bot'});
 const known=BOTS.find(([re])=>re.test(s));
 if(bm?.verifiedBot===true||cfCat){
  const category=known?.[2]||/** @type {any} */(CF_CATEGORY)[cfCat]||'other';
  return bot('verified',known?.[1]||cfCat||'Verified bot',category,'cloudflare');
 }
 if(known){
  const [,name,category,asns]=known;
  return asns&&asn&&asns.includes(asn)?bot('verified',name,category,'asn'):bot('declared',name,category,'ua');
 }
 if(!s.trim())return bot('suspected','No user agent','library','empty-ua');
 const lib=LIBRARIES.find(([re])=>re.test(s));
 if(lib)return bot('suspected',lib[1],'library',/Headless|PhantomJS|Puppeteer|Playwright|Selenium|webdriver/i.test(lib[1])?'headless':'library');
 // CUBOT is a phone brand, not a bot.
 if(GENERIC_BOT.test(s.replace(/cubot/gi,''))){
  const m=/([A-Za-z][\w.-]{1,40}?(?:bot|crawler|spider))\b/i.exec(s)||/([A-Za-z][\w.-]{1,40})\//.exec(s);
  return bot('declared',m?m[1]:'Unknown bot','other','ua');
 }
 if(webdriver)return bot('suspected','WebDriver','library','webdriver');
 if(!/^Mozilla\/5\.0 \(/.test(s)){
  const m=/^([A-Za-z][\w .-]{0,39}?)(?:\/|\s|$)/.exec(s);
  return bot('suspected',m?m[1].trim():'Non-browser client','library','non-browser-ua');
 }
 if(kind==='page'){
  if(!acceptLanguage)return bot('suspected','Browser without Accept-Language','other','no-accept-language');
  // Chromium sends Sec-Fetch-* since 76 and Firefox since 90; a navigation without them is scripted.
  const chrome=/Chrome\/(\d+)/.exec(s),firefox=/Firefox\/(\d+)/.exec(s);
  if(!secFetchMode&&((chrome&&Number(chrome[1])>=80)||(firefox&&Number(firefox[1])>=90)))return bot('suspected','Browser without Fetch Metadata','other','no-fetch-metadata');
 }
 if(asn&&DATACENTER_ASNS.has(asn))return bot('suspected',`Datacenter · ${String(cf?.asOrganization||'AS'+asn).slice(0,40)}`,'other','datacenter');
 return {cls:'candidate',name:'',category:'',reason:'',device:deviceOf(s),browser:browserOf(s)};
}

/* ─────────────────────────────── writing ─────────────────────────────── */

/** Analytics Engine blob layout (blob1…blob14). SQL below refers to these by position. */
export const BLOB=Object.freeze({kind:1,cls:2,name:3,category:4,path:5,ref:6,device:7,browser:8,locale:9,country:10,reason:11,route:12,env:13,entry:14});
export const REFERRERS=Object.freeze(['search','social','ai','direct','internal','other']);
export const DEVICES=Object.freeze(['mobile','tablet','desktop']);
export const LOCALES=Object.freeze(['ko','en','ja','zh','es','fr','de','pt','ru','vi','th','id','it','tr']);
/** Query parameters kept on a counted path (board views); everything else is dropped. */
export const QUERY_ALLOW=Object.freeze(['kind','sort']);
const envName=(build=BUILD)=>build.preview?'preview':'production';

/** '/ko/image/compress/?q=secret#x' → '/ko/image/compress/'. null when it is not a site path.
 * @param {unknown} value */
export function normalizePath(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.length>512||/[\u0000-\u001f\u007f\s\\]/.test(value))return null;
 let u;try{u=new URL(value,'https://x.invalid');}catch{return null;}
 let p=u.pathname.replace(/\/index\.html$/,'/').replace(/\/{2,}/g,'/');
 const q=QUERY_ALLOW.filter(k=>u.searchParams.has(k)).map(k=>`${k}=${encodeURIComponent(String(u.searchParams.get(k)).slice(0,24))}`);
 if(q.length)p+='?'+q.join('&');
 return p.slice(0,200);
}
/** What a request the Worker handles is, for counting ('' = not counted). @param {string} method @param {string} path */
export function routeKind(method,path){
 if(method!=='GET'&&method!=='HEAD')return '';
 if(/^\/(api|_worker\.js|admin|src|assets|ai-runtime|verify|cdn-cgi)(\/|$)/.test(path))return '';
 if(path==='/robots.txt')return 'robots';
 if(/^\/sitemap[\w-]*\.xml$/.test(path))return 'sitemap';
 if(path==='/ads.txt')return 'ads';
 if(/\/feed\.xml$/.test(path))return 'feed';
 if(path.endsWith('/')||path.endsWith('.html')||!/\.[a-z0-9]{1,8}$/i.test(path))return 'page';
 return '';
}
/**
 * @param {any} env
 * @param {{kind:'hit'|'req',cls:string,name?:string,category?:string,path:string,ref?:string,device?:string,browser?:string,locale?:string,country?:string,reason?:string,route:string,entry?:boolean,asn?:number}} p
 * @param {{build?:any}} [o]
 * @returns {boolean} whether a data point was written
 */
export function writePoint(env,p,{build=BUILD}={}){
 const ds=env?.TRAFFIC;if(!ds||typeof ds.writeDataPoint!=='function')return false;
 const blobs=[p.kind,p.cls,p.name||'',p.category||'',p.path,p.ref||'',p.device||'',p.browser||'',p.locale||'',String(p.country||'').slice(0,2),p.reason||'',p.route,envName(build),p.entry?'1':'0'];
 try{ds.writeDataPoint({indexes:[p.cls],blobs:blobs.map(b=>String(b).slice(0,200)),doubles:[1,Number(p.asn)||0]});return true;}catch{return false;}
}
/** Accept-Language → the first language subtag we report. @param {string|null} header */
export function localeOf(header){const l=String(header||'').trim().slice(0,2).toLowerCase();return LOCALES.includes(l)?l:l?'other':'';}

/**
 * Worker middleware: count one request the Worker is already handling (robots, sitemaps,
 * platform pages, and all HTML unless TRAFFIC_HTML=off). Synchronous and never throws;
 * writeDataPoint does not block the response.
 * @param {Request} request @param {any} env @param {URL} [url] @param {{build?:any}} [o]
 */
export function observeRequest(request,env,url=new URL(request.url),o={}){
 try{
  if(!env?.TRAFFIC)return false;
  const route=routeKind(request.method,url.pathname);if(!route)return false;
  const path=normalizePath(url.pathname+url.search);if(!path)return false;
  const h=request.headers,cf=/** @type {any} */(request).cf||null;
  const c=classify({ua:h.get('user-agent'),acceptLanguage:h.get('accept-language'),secFetchMode:h.get('sec-fetch-mode'),cf,kind:route==='page'?'page':'file'});
  return writePoint(env,{kind:'req',cls:c.cls,name:c.name,category:c.category,path,device:c.device,browser:c.browser,locale:c.cls==='candidate'?localeOf(h.get('accept-language')):'',country:cf?.country,reason:c.reason,route,asn:c.cls==='candidate'?0:Number(cf?.asn)||0},o);
 }catch{return false;}
}

const hitLimiter=createLimiter({max:5000});
/** Pageviews one network may report per minute before hits are dropped (not an error). */
export const HIT_RATE_PER_MINUTE=60;
/**
 * POST /api/v2/hit — the beacon. Always cheap: validate, classify, one data point, 204.
 * Missing binding → 204 without writing (the beacon never sees an error).
 * @param {Request} request @param {any} env @param {any} [ctx]
 * @param {{now?:()=>number,limiter?:any,build?:any}} [deps]
 */
export async function handleHit(request,env,ctx,deps={}){
 const noContent=()=>new Response(null,{status:204,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 try{
  if(request.method!=='POST')return errorResponse(new ApiError('METHOD_NOT_ALLOWED'),{Allow:'POST'});
  const url=new URL(request.url),h=request.headers;
  // Same-origin only (sendBeacon sends Origin and Sec-Fetch-Site: same-origin). Not a security
  // boundary — anyone can forge headers — but it stops other sites from counting into ours.
  const site=h.get('sec-fetch-site'),origin=h.get('origin');
  if((site&&site!=='same-origin')||(origin&&origin!==url.origin)||(!site&&!origin))throw new ApiError('FORBIDDEN_ORIGIN');
  if(!/^(text\/plain|application\/json)(\s*;|$)/i.test(h.get('content-type')||''))throw new ApiError('UNSUPPORTED_MEDIA_TYPE');
  if(Number(h.get('content-length')||0)>512)throw new ApiError('PAYLOAD_TOO_LARGE');
  const text=(await request.text()).slice(0,1024);if(text.length>512)throw new ApiError('PAYLOAD_TOO_LARGE');
  const body=parseHit(text);if(!body)throw new ApiError('BAD_REQUEST','Invalid hit.');
  if(!env?.TRAFFIC)return noContent();
  const ip=h.get('cf-connecting-ip')||'';
  if(ip&&!(deps.limiter||hitLimiter).hit('hit:'+ip,HIT_RATE_PER_MINUTE,(deps.now||Date.now)()))return noContent();
  const cf=/** @type {any} */(request).cf||null;
  const c=classify({ua:h.get('user-agent'),cf,kind:'beacon',webdriver:body.w});
  const human=c.cls==='candidate';
  writePoint(env,{kind:'hit',cls:human?'human':c.cls,name:c.name,category:c.category,path:body.p,ref:human?body.r:'',device:human?body.d||c.device:'bot',browser:c.browser,locale:human?body.l:'',country:cf?.country,reason:c.reason,route:'beacon',entry:human&&body.e,asn:human?0:Number(cf?.asn)||0},{build:deps.build});
  return noContent();
 }catch(e){return errorResponse(e instanceof ApiError?e:new ApiError('BAD_REQUEST'));}
}
/** Validated beacon payload {p,r,d,l,e,w} or null. @param {string} text */
export function parseHit(text){
 let v;try{v=JSON.parse(text);}catch{return null;}
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 for(const k of Object.keys(v))if(!['p','r','d','l','e','w'].includes(k))return null;
 const p=normalizePath(v.p);if(!p||routeKind('GET',p.split('?')[0])!=='page')return null;
 const r=REFERRERS.includes(v.r)?v.r:'other',d=DEVICES.includes(v.d)?v.d:'';
 const l=typeof v.l==='string'?(LOCALES.includes(v.l)?v.l:'other'):'';
 return {p,r,d,l,e:v.e===1||v.e===true,w:v.w===1||v.w===true};
}

/* ─────────────────────────────── reading ─────────────────────────────── */

export const RANGES=Object.freeze(['today','7d','30d']);
const KST=9*3600e3,DAY=864e5;
/** Owner's day boundaries are Korea time. @param {string} range @param {number} now */
export function rangeWindow(range,now){
 const today=Math.floor((now+KST)/DAY)*DAY-KST;
 const days=range==='30d'?30:range==='7d'?7:1;
 return {start:today-(days-1)*DAY,end:now,step:range==='today'?3600e3:DAY,unit:range==='today'?'HOUR':'DAY'};
}
const b=(/** @type {keyof typeof BLOB} */k)=>`blob${BLOB[k]}`;
const BOT_CLASSES="('verified','declared','suspected')";
/** The five SQL API queries behind one range (few, so the 10k/day read-query allowance lasts).
 * @param {string} range @param {number} now @param {{dataset?:string,build?:any}} [o] */
export function trafficQueries(range,now,{dataset='nerulio_traffic',build=BUILD}={}){
 if(!/^[A-Za-z0-9_]{1,64}$/.test(dataset))throw Error('invalid dataset name');
 const w=rangeWindow(range,now),where=`timestamp >= toDateTime(${Math.floor(w.start/1000)}) AND ${b('env')} = '${envName(build)}'`;
 const from=`FROM ${dataset} WHERE ${where}`;
 return {
  series:`SELECT toUnixTimestamp(toStartOfInterval(timestamp, INTERVAL '1' ${w.unit}, 'Asia/Seoul')) AS t, sumIf(_sample_interval, ${b('cls')} = 'human') AS human, sumIf(_sample_interval, ${b('cls')} = 'candidate') AS candidate, sumIf(_sample_interval, ${b('cls')} = 'verified') AS verified, sumIf(_sample_interval, ${b('cls')} = 'declared') AS declared, sumIf(_sample_interval, ${b('cls')} = 'suspected') AS suspected, sumIf(_sample_interval, ${b('cls')} = 'human' AND ${b('entry')} = '1') AS entries, sumIf(_sample_interval, ${b('cls')} IN ${BOT_CLASSES} AND ${b('category')} = 'ai') AS ai ${from} GROUP BY t ORDER BY t FORMAT JSON`,
  bots:`SELECT ${b('name')} AS name, ${b('category')} AS category, ${b('cls')} AS cls, sum(_sample_interval) AS n ${from} AND ${b('cls')} IN ${BOT_CLASSES} GROUP BY name, category, cls ORDER BY n DESC LIMIT 60 FORMAT JSON`,
  humanPages:`SELECT ${b('path')} AS path, sum(_sample_interval) AS n ${from} AND ${b('cls')} = 'human' GROUP BY path ORDER BY n DESC LIMIT 10 FORMAT JSON`,
  botPages:`SELECT ${b('path')} AS path, sum(_sample_interval) AS n ${from} AND ${b('cls')} IN ${BOT_CLASSES} GROUP BY path ORDER BY n DESC LIMIT 10 FORMAT JSON`,
  breakdown:`SELECT ${b('ref')} AS ref, ${b('device')} AS device, ${b('browser')} AS browser, ${b('locale')} AS locale, ${b('country')} AS country, sum(_sample_interval) AS n ${from} AND ${b('cls')} = 'human' GROUP BY ref, device, browser, locale, country ORDER BY n DESC LIMIT 2000 FORMAT JSON`
 };
}
const num=(/** @type {any} */v)=>{const n=Number(v);return Number.isFinite(n)?Math.round(n):0;};
/** @param {Record<string,number>} m @param {string} k @param {number} n */
const add=(m,k,n)=>{m[k||'unknown']=(m[k||'unknown']||0)+n;};
/** What the Worker sees in this build, for the screen's coverage note. @param {any} build @param {any} env */
export function coverage(build=BUILD,env={}){
 const html=!!(build.trafficHtml||build.adsHtml);
 const note=html
  ?'모든 HTML 요청이 Worker를 거쳐 봇까지 집계됩니다. 사람은 비콘(페이지 1초 이상 표시)으로 확인합니다.'
  :'정적 HTML은 Worker를 거치지 않아 봇은 robots.txt·사이트맵·커뮤니티/채널 페이지에서만 보입니다. 사람은 비콘으로 모든 페이지에서 집계됩니다. 전체 봇 집계는 TRAFFIC_HTML=off를 지우고 다시 배포하세요.';
 return {workerSeesHtml:html,note,recording:!!env?.TRAFFIC,seen:['beacon','robots.txt','sitemaps','platform pages',...(html?['static HTML']:[])],unseen:html?['JS/CSS/images (assets)']:['static HTML without JavaScript (bots on tool pages)','JS/CSS/images (assets)']};
}
/**
 * SQL API rows → the admin contract shape.
 * @param {string} range @param {number} now
 * @param {{series:any[],bots:any[],humanPages:any[],botPages:any[],breakdown:any[]}} rows
 * @param {{build?:any,env?:any}} [o]
 */
export function mapTraffic(range,now,rows,{build=BUILD,env={}}={}){
 const w=rangeWindow(range,now),byT=new Map();
 const totals={human:0,verifiedBot:0,declaredBot:0,suspectedBot:0};let candidates=0,entries=0,ai=0;
 for(const r of rows.series||[]){
  const t=num(r.t)*1000,v={human:num(r.human),verified:num(r.verified),declared:num(r.declared),suspected:num(r.suspected)};
  totals.human+=v.human;totals.verifiedBot+=v.verified;totals.declaredBot+=v.declared;totals.suspectedBot+=v.suspected;candidates+=num(r.candidate);entries+=num(r.entries);ai+=num(r.ai);
  byT.set(t,{human:v.human,bot:v.verified+v.declared+v.suspected});
 }
 // Every bucket from the window start to now, zero-filled, so the chart has a steady x axis.
 const series=[];for(let t=w.start;t<=w.end;t+=w.step){const v=byT.get(t)||{human:0,bot:0};series.push({t:new Date(t).toISOString(),human:v.human,bot:v.bot});}
 const bots=(rows.bots||[]).map(r=>({name:String(r.name||'Unknown'),category:CATEGORIES.includes(r.category)?String(r.category):'other',verified:r.cls==='verified',requests:num(r.n),...(r.cls==='suspected'?{suspected:true}:{})})).filter(x=>x.requests>0).sort((a,b)=>b.requests-a.requests).slice(0,30);
 const pages=(/** @type {any[]} */list)=>(list||[]).map(r=>({path:String(r.path),n:num(r.n)})).filter(x=>x.n>0);
 /** @type {Record<string,Record<string,number>>} */const br={sources:{},devices:{},browsers:{},locales:{}};const countries=/** @type {Record<string,number>} */({});
 for(const r of rows.breakdown||[]){const n=num(r.n);add(br.sources,r.ref,n);add(br.devices,r.device,n);add(br.browsers,r.browser,n);add(br.locales,r.locale,n);add(countries,r.country,n);}
 return {
  range,generatedAt:new Date(now).toISOString(),
  totals,
  // visitors = pageviews that started a visit (the tab's first counted page): an estimate, no identifiers.
  humans:{pageviews:totals.human,visitors:entries,unconfirmed:candidates,...br,countries:Object.entries(countries).map(([country,n])=>({country,n})).sort((a,b)=>b.n-a.n).slice(0,15)},
  bots,aiBotRequests:ai,
  topPages:{human:pages(rows.humanPages),bot:pages(rows.botPages)},
  series,
  coverage:coverage(build,env)
 };
}
/** Which settings are missing for reading. The binding comes first: without it nothing is recorded. @param {any} env */
export function missingConfig(env){
 return [!env?.TRAFFIC&&'TRAFFIC',!/^[0-9a-f]{32}$/i.test(String(env?.CF_ACCOUNT_ID||''))&&'CF_ACCOUNT_ID',!env?.CF_ANALYTICS_TOKEN&&'CF_ANALYTICS_TOKEN'].filter(Boolean).map(String);
}
/** One SQL API call → rows. @param {any} env @param {string} sql @param {typeof fetch} [fetchImpl] */
export async function sqlQuery(env,sql,fetchImpl=fetch){
 const res=await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,{method:'POST',headers:{Authorization:`Bearer ${env.CF_ANALYTICS_TOKEN}`,'Content-Type':'text/plain'},body:sql});
 if(!res.ok)throw new ApiError('UPSTREAM_FAILED','Analytics Engine query failed.',{status:res.status});
 const body=/** @type {any} */(await res.json().catch(()=>null));
 if(!body||!Array.isArray(body.data))throw new ApiError('UPSTREAM_FAILED','Analytics Engine returned no data.');
 return body.data;
}
/** Per-isolate cache: the admin screen and the overview reuse one set of queries for a minute. */
const CACHE_MS=60e3,cache=new Map();
export function clearTrafficCache(){cache.clear();}
/**
 * @param {any} env @param {string} range @param {number} now
 * @param {{fetch?:typeof fetch,build?:any}} [deps]
 */
export async function getTraffic(env,range,now,deps={}){
 const build=deps.build||BUILD,dataset=String(env.TRAFFIC_DATASET||'nerulio_traffic');
 const key=`${range}|${dataset}|${envName(build)}`,hit=cache.get(key);
 if(hit&&now-hit.at<CACHE_MS)return hit.value;
 const q=trafficQueries(range,now,{dataset,build}),names=/** @type {(keyof typeof q)[]} */(Object.keys(q));
 const results=await Promise.all(names.map(n=>sqlQuery(env,q[n],deps.fetch)));
 const value=mapTraffic(range,now,/** @type {any} */(Object.fromEntries(names.map((n,i)=>[n,results[i]]))),{build,env});
 if(cache.size>20)cache.clear();
 cache.set(key,{at:now,value});
 return value;
}
/** 503 NOT_CONFIGURED in the platform error envelope, plus the contract's top-level `need`. @param {string[]} missing */
function notConfigured(missing){return json({need:missing[0],missing,error:{code:'NOT_CONFIGURED',message:'Traffic statistics are not configured.',need:missing[0],missing}},503);}
/**
 * GET /api/v2/admin/traffic?range=today|7d|30d — the coordinator mounts this in the admin router.
 * requireAdmin(request, env, ctx) is the BACKEND agent's gate: it may throw an ApiError or return
 * a Response to refuse; anything else lets the request through. Without it: 404 (fail closed).
 * @param {Request} request @param {any} env @param {any} ctx
 * @param {{requireAdmin?:(request:Request,env:any,ctx:any)=>any,now?:()=>number,fetch?:typeof fetch,build?:any}} [o]
 */
export async function handleTraffic(request,env,ctx,o={}){
 try{
  if(typeof o.requireAdmin!=='function')throw new ApiError('NOT_FOUND');
  const gate=await o.requireAdmin(request,env,ctx);if(gate instanceof Response)return gate;
  if(request.method!=='GET')return errorResponse(new ApiError('METHOD_NOT_ALLOWED'),{Allow:'GET'});
  const range=new URL(request.url).searchParams.get('range')||'today';
  if(!RANGES.includes(range))throw new ApiError('BAD_REQUEST','range must be today, 7d or 30d.');
  const missing=missingConfig(env);if(missing.length)return notConfigured(missing);
  return json(await getTraffic(env,range,(o.now||Date.now)(),{fetch:o.fetch,build:o.build}));
 }catch(e){
  if(!(e instanceof ApiError))console.error('traffic',/** @type {any} */(e)?.message);
  return errorResponse(e instanceof ApiError?e:new ApiError('UPSTREAM_FAILED'));
 }
}
/**
 * The overview's compact block: today's numbers, or null when not configured or unreachable
 * (the overview must never fail because of traffic).
 * @param {any} env @param {number} [now] @param {{fetch?:typeof fetch,build?:any}} [deps]
 * @returns {Promise<null|{humanPageviews:number,botRequests:number,aiBotRequests:number,topBot:null|{name:string,category:string,verified:boolean,requests:number}}>}
 */
export async function trafficSummary(env,now=Date.now(),deps={}){
 if(missingConfig(env).length)return null;
 try{
  const t=await getTraffic(env,'today',now,deps);
  const top=t.bots[0]||null;
  return {humanPageviews:t.humans.pageviews,botRequests:t.totals.verifiedBot+t.totals.declaredBot+t.totals.suspectedBot,aiBotRequests:t.aiBotRequests,topBot:top&&{name:top.name,category:top.category,verified:top.verified,requests:top.requests}};
 }catch(e){console.error('traffic summary',/** @type {any} */(e)?.message);return null;}
}
