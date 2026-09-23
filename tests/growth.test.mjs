import {GAME_INTENT_PAGES,isGameIntentPage} from '../src/game-seo.js';
import {mayPromote} from '../src/capabilities.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {INTENTS,ALIASES,intentDefaults} from '../src/intents.js';
import {LOCALES} from '../src/i18n.js';
import {BRAND} from '../src/brand.js';
import {ALL_ROUTES,entry,sitemap} from '../tools/build.mjs';
import {imageSitemap} from '../tools/growth-build.mjs';
import {configuration} from '../tools/site-config.mjs';
import {submission} from '../tools/indexnow.mjs';
import {EXAMPLES} from '../src/examples.js';
import {TOOLS} from '../src/tool-registry.js';
import {parsePreset,serializePreset} from '../src/presets.js';
import {eventPayload,EVENTS,setAnalyticsAdapter,setAnalyticsContext,track,trafficSource} from '../src/analytics.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const origin='https://example.test/project/';
test('all canonical intent documents have reciprocal locales, distinct canonical URLs and social metadata',async()=>{
 const canonical=new Set(),map=sitemap(origin);
 for(const [id,intent] of Object.entries(INTENTS))for(const locale of LOCALES){
  const route=locale+(intent.path?'/'+intent.path:''),h=entry(html,route,origin),url=origin+route+'/';
  assert(ALL_ROUTES.includes(route));assert(h.includes(`<html lang="${locale}">`));
  assert.match(h,/<title>[^<]+<\/title>/);assert.match(h,/<meta name="description" content="[^"]+">/);
  assert(h.includes(`rel="canonical" href="${url}"`));assert(!canonical.has(url));canonical.add(url);
  assert.equal(map.includes(`<loc>${url}</loc>`),mayPromote(id));if(!mayPromote(id))assert(h.includes('content="noindex,follow"'));
  for(const l of LOCALES){const alternate=origin+l+'/'+(intent.path?intent.path+'/':'');assert(h.includes(`hreflang="${l}" href="${alternate}"`));}
  assert(h.includes('hreflang="x-default"'));assert(h.includes('name="twitter:card"'));assert(h.includes(`assets/social/${locale}-${id}.png`));
  assert(h.includes('data-ad-exclude'));assert(!h.includes('adsbygoogle.js'));assert(!h.includes('{{brand}}'));assert(h.includes(BRAND.name));
  const png=await readFile(new URL(`../assets/social/${locale}-${id}.png`,import.meta.url));
  assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
  const base=new URL(h.match(/<base href="([^"]+)"/)[1],url);
  for(const m of h.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
   const link=new URL(m[1].replaceAll('&amp;','&'),base);if(link.origin!==new URL(origin).origin)continue;
   const local=link.pathname.slice(new URL(origin).pathname.length).replace(/\/$/,'');assert(ALL_ROUTES.includes(local)||local==='assets/vendor/NOTICES.txt',`Broken link ${route} → ${local}`);
  }
 }
 assert.equal(canonical.size,Object.keys(INTENTS).length*3);
 for(const [alias,id] of Object.entries(ALIASES))for(const l of LOCALES){const h=entry(html,`${l}/${alias}`,origin);assert(h.includes(`rel="canonical" href="${origin}${l}/${INTENTS[id].path}/"`));}
});
test('crawlable examples have actual PNG dimensions and agree with image sitemap',async()=>{
 // Game landing pages show a Studio screenshot instead of the old example pair (their classic page keeps it).
 const xml=imageSitemap(origin),game=(xml.match(/assets\/studio\//g)||[]).length;
 assert.equal((xml.match(/<url>/g)||[]).length,Object.keys(EXAMPLES).filter(id=>mayPromote(id)&&!isGameIntentPage(id)).length*3+game);
 assert(game>=(Object.keys(GAME_INTENT_PAGES).length+1)*3,'every game landing and the hub list their screenshot');
 for(const [id,e] of Object.entries(EXAMPLES))for(const locale of LOCALES){
  const gamePage=isGameIntentPage(id),h=entry(html,`${locale}/${INTENTS[id].path}${gamePage?'/classic':''}`,origin);
  assert(h.indexOf('class="tool-examples"')>h.indexOf('class="workspace-footer"'));
  for(const v of Object.values(e)){
   assert(h.includes(`src="assets/examples/${v.file}" width="${v.width}" height="${v.height}" alt="`));assert(h.includes('loading="lazy" decoding="async"'));
   assert.equal(xml.includes(origin+'assets/examples/'+v.file),mayPromote(id)&&!gamePage);
   const png=await readFile(new URL('../assets/examples/'+v.file,import.meta.url));assert.equal(png.readUInt32BE(16),v.width);assert.equal(png.readUInt32BE(20),v.height);
  }
 }
});
test('recipe presets roundtrip settings while discarding file names, glyph text and invalid values',()=>{
 for(const id of Object.keys(TOOLS)){
  const original=parsePreset(id,'n=64&colors=8&dither=0.3&pack=1&mapping=3,2,1,zero&chars=PRIVATE&filename=secret.png');
  const query=serializePreset(id,original);assert(!query.toString().includes('PRIVATE'));assert(!query.has('chars'));assert(!query.has('filename'));
  assert.deepEqual(parsePreset(id,query),original);
 }
 const bad=parsePreset('refiner','n=Infinity&colors=-99&dither=200&outline=99&width=2.4&background=javascript:secret');
 assert.equal(bad.n,32);assert.equal(bad.colors,2);assert.equal(bad.dither,1);assert.equal(bad.outline,4);assert.equal(bad.width,2);assert.equal(bad.background,'#ffffff');
 const basic=intentDefaults('pixel','','n=64&colors=8&dither=0.4&outline=2&trim=0');assert.equal(basic.n,64);assert.equal(basic.colors,8);assert.equal(basic.dither,.4);assert.equal(basic.outline,2);assert.equal(basic.trim,false);
});
test('analytics is opt-in, vendor-independent and rejects arbitrary strings and private data',()=>{
 const privateData={filename:'medical-record.pdf',contents:'PRIVATE',path:'/secret?q=PRIVATE',error:'PRIVATE',referrer:'https://ref.test/PRIVATE',intent:'refiner',language:'ko',device_class:'mobile'};
 setAnalyticsContext({landing_intent:'refiner',traffic_source:'google'});
 const received=[];setAnalyticsAdapter(e=>received.push(e));
 for(const event of EVENTS){track(event,privateData);const p=eventPayload(event,privateData);assert(!JSON.stringify(p).includes('PRIVATE'));assert(!Object.hasOwn(p,'filename'));assert.equal(p.intent,'refiner');}
 assert.equal(received.length,EVENTS.length);setAnalyticsAdapter(null);track('page_view');assert.equal(received.length,EVENTS.length);
 assert.equal(eventPayload('secret-event'),null);assert(!Object.hasOwn(eventPayload('tool_error',{intent:'secret-name',error_code:'medical-record.pdf'}),'error_code'));
 assert.equal(trafficSource('https://google.com/search?q=PRIVATE','https://example.test'),'google');assert.equal(trafficSource('https://other.test/PRIVATE','https://example.test'),'referral');
 setAnalyticsAdapter(()=>{throw Error('offline');});assert.doesNotThrow(()=>track('download'));setAnalyticsAdapter(null);
});
test('verification and IndexNow are build/deploy concerns and disabled for preview',()=>{
 const config=configuration({SITE_URL:origin,GOOGLE_SITE_VERIFICATION:'issued_token-123',INDEXNOW_KEY:'abcd1234-efgh5678'});
 assert(entry(html,'en/image/compress',origin,config).includes('name="google-site-verification" content="issued_token-123"'));
 const p=submission(config,sitemap(origin));assert.equal(p.host,'example.test');assert(p.urlList.every(u=>u.startsWith(origin)));assert.equal(p.keyLocation,origin+config.indexNowKey+'.txt');
 assert.throws(()=>submission(config,'<loc>https://other.test/</loc>'));assert.throws(()=>configuration({GOOGLE_SITE_VERIFICATION:'"><script>'}));
 const preview=configuration({SITE_URL:origin,SITE_ENV:'preview',GOOGLE_SITE_VERIFICATION:'token',INDEXNOW_KEY:'abcd1234'});assert.equal(preview.indexNowKey,'');assert.equal(preview.searchVerification,'');assert.throws(()=>submission(preview,sitemap(origin)));
});
