import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {build,entry,ALL_ROUTES,sitemap} from '../tools/build.mjs';
import {configuration,headers} from '../tools/site-config.mjs';
import {INTENTS,ALIASES} from '../src/intents.js';
import {guide,toolContent} from '../src/content.js';
import {POLICY_ROUTES,policies} from '../src/policies.js';
import {normalizeSiteURL} from '../src/seo.js';
import {secureResponse,adCSP} from '../tools/ads-worker.mjs';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const origin='https://fileforge.example.test/';
// Synthetic fixture, never deployed or sent to Google.
const client='ca-pub-3141592653589793';

test('configuration rejects malformed domain and ad values before building',()=>{
 for(const SITE_URL of ['javascript:alert(1)','https://user:pass@host.test','https://host.test/?query=1','https://host.test/#fragment'])assert.throws(()=>configuration({SITE_URL}));
 for(const ADSENSE_CLIENT of ['ca-pub-123','invalid','ca-pub-XXXXXXXX','ca-pub-1234567890123456"'])assert.throws(()=>configuration({ADSENSE_CLIENT,SITE_URL:origin}));
 assert.throws(()=>configuration({ADSENSE_CLIENT:client}));
 assert.throws(()=>configuration({ADSENSE_CLIENT:client,SITE_URL:'http://localhost/'}));
 assert.throws(()=>configuration({ADSENSE_CLIENT:client,SITE_URL:origin,ADSENSE_SLOT_CONTENT_1:'1234567890'}));
 assert.throws(()=>configuration({ADSENSE_SLOT_CONTENT_1:'wrong'}));
 assert.throws(()=>configuration({ADSENSE_VERIFICATION_CLIENT:'invalid',SITE_URL:origin}));
 assert.throws(()=>configuration({ADSENSE_VERIFICATION_CLIENT:client}));
 assert.throws(()=>configuration({ADSENSE_VERIFICATION_CLIENT:client,ADSENSE_CLIENT:'ca-pub-1234567890123456',SITE_URL:origin}));
 assert.equal(normalizeSiteURL('https://host.test'),'https://host.test/');
});
test('preview blocks inherited production advertising',()=>{
 for(const env of [{SITE_ENV:'preview'},{CF_PAGES_BRANCH:'feature/seo'}]){
  const c=configuration({...env,SITE_URL:origin,ADSENSE_CLIENT:client,ADSENSE_SLOT_CONTENT_1:'1234567890'});
  assert.equal(c.client,'');assert.deepEqual(c.slots,{});assert(c.preview);
 }
});
test('every tool has three complete, purpose-specific guides',()=>{
 for(const locale of ['ko','en','ja']){
  const signatures=new Set();
  for(const id of Object.keys(INTENTS)){
   const g=guide(id,locale);assert.equal(g.length,5);assert.equal(g[0].split('|').length,3);
   g.forEach(v=>assert(v.length>10));signatures.add(g.join('|'));
   if(locale!=='ko')assert(!/[가-힣]/.test(g.join('')));
   const text=toolContent(id,locale);assert(text.includes('<ol>'));assert.equal((text.match(/<details>/g)||[]).length,3);
  }
  assert.equal(signatures.size,Object.keys(INTENTS).length);
 }
});
test('policy pages are standalone localized documents with truthful contact and ad status',()=>{
 for(const locale of ['ko','en','ja'])for(const page of POLICY_ROUTES){
  const h=entry(html,`${locale}/${page}`,origin);
  assert(h.includes(`<html lang="${locale}">`));assert(!h.includes('src/app.js'));assert(h.includes('src/policy-page.js'));
  assert.equal((h.match(/<h1>/g)||[]).length,1);assert(h.includes(`href="${origin}${locale}/${page}/"`));
  for(const [title,body]of policies[locale][page])assert(title&&body);
  if(page==='contact')assert(h.includes('https://github.com/2009seungbin-stack/my-first-repo/issues'));
  assert(!h.includes('mailto:'));assert(!h.includes('adsbygoogle.js'));
 }
});
test('canonical aliases consolidate and query combinations never enter sitemap',()=>{
 for(const [alias,id]of Object.entries(ALIASES))assert(entry(html,`ja/${alias}`,origin).includes(`rel="canonical" href="${origin}ja/${INTENTS[id].path}/"`));
 const xml=sitemap(origin);for(const [,url]of xml.matchAll(/<loc>([^<]+)<\/loc>/g))assert(!url.includes('?'));assert(!xml.includes('/png-to-webp/'));
 assert.equal((xml.match(/<url>/g)||[]).length,(Object.keys(INTENTS).length+POLICY_ROUTES.length)*3);
 for(const l of ['en','ko','ja','x-default'])assert(xml.includes(`hreflang="${l}"`));
});
test('reading content follows the full workspace, and disabled ads leave no boxes',()=>{
 const h=entry(html,'en/image/upscale');
 assert(h.indexOf('id="siteContent"')>h.indexOf('class="workspace-footer"'));
 assert(!h.includes('class="ad-slot"'));assert(!h.includes('adsbygoogle'));assert(!h.includes('src/ads.js'));
 assert(!h.includes('rel="canonical"'));assert(!h.includes('hreflang='));assert(!h.includes('property="og:url"'));
 const data=JSON.parse(h.match(/type="application\/ld\+json">([^<]+)/)[1]);
 assert.equal(data['@type'],'WebApplication');assert(!data.aggregateRating);assert(!data.offers);assert(!data.url);
});
test('CSP keeps ads blocked by default; ad-enabled responses use fresh nonces',async()=>{
 const source=await readFile(new URL('../_headers',import.meta.url),'utf8');
 assert(!headers(source,{}).includes('googlesyndication'));
 assert(headers(source,{preview:true}).includes('X-Robots-Tag: noindex, nofollow'));
 const input=()=>new Response('<script src="src/app.js"></script><script type="module" src="src/ads.js"></script>',{headers:{'Content-Type':'text/html','ETag':'old','Content-Length':'12'}});
 const a=await secureResponse(input()),b=await secureResponse(input());
 const body=await a.text(),value=body.match(/nonce="([^"]+)"/)[1];
 assert.equal(a.headers.get('Content-Security-Policy'),adCSP(value));assert(a.headers.get('Content-Security-Policy').includes("'strict-dynamic'"));
 assert.notEqual(a.headers.get('Content-Security-Policy'),b.headers.get('Content-Security-Policy'));
 assert.equal((body.match(/nonce=/g)||[]).length,2);assert.equal(a.headers.get('Cache-Control'),'no-store');assert(!a.headers.has('ETag'));assert(!a.headers.has('Content-Length'));
});
test('build matrix: no domain, production domain, ads, then clean disabled rebuild and preview',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'fileforge-build-')),outDir=path.join(temp,'dist');
 const read=f=>readFile(path.join(outDir,f),'utf8');
 try{
  await build({outDir,env:{}});
  for(const route of ALL_ROUTES)assert((await stat(path.join(outDir,route,'index.html'))).isFile());
  assert.equal((await read('sitemap.xml')).includes('<loc>'),false);
  assert.equal(await read('robots.txt'),'User-agent: *\nAllow: /\n');
  await assert.rejects(read('ads.txt'));
  for(const f of ['src/app.js','src/worker.js','src/site-content.js','content.css','404.html','_headers'])assert((await stat(path.join(outDir,f))).isFile());
  await build({outDir,env:{SITE_URL:origin}});
  assert((await read('robots.txt')).includes(`Sitemap: ${origin}sitemap.xml`));
  assert((await read('en/image/upscale/index.html')).includes(`property="og:url" content="${origin}en/image/upscale/"`));
  await build({outDir,env:{SITE_URL:origin,ADSENSE_VERIFICATION_CLIENT:client}});
  assert.equal(await read('ads.txt'),`google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n`);
  for(const route of ALL_ROUTES){
   const verified=await read(path.join(route,'index.html'));
   assert(!verified.includes('adsbygoogle.js'));assert(!verified.includes('src/ads.js'));assert(!verified.includes('Google AdSense is enabled'));
  }
  await assert.rejects(read('_worker.js'));await assert.rejects(read('_routes.json'));
  assert.equal(await read('_headers'),headers(await readFile(new URL('../_headers',import.meta.url),'utf8'),{}));
  await build({outDir,env:{SITE_URL:origin,ADSENSE_VERIFICATION_CLIENT:client,SITE_ENV:'preview'}});
  await assert.rejects(read('ads.txt'));
  await build({outDir,env:{SITE_URL:origin,ADSENSE_CLIENT:client,ADSENSE_SLOT_CONTENT_1:'1234567890',ADSENSE_SLOT_CONTENT_2:'9876543210',ADSENSE_CMP_READY:'true'}});
  const enabled=await read('en/image/upscale/index.html');assert(enabled.includes(`adsbygoogle.js?client=${client}`));assert(enabled.includes('src/ads.js'));
  assert.equal(await read('ads.txt'),`google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n`);
  assert((await read('_worker.js')).includes('env.ASSETS.fetch'));assert(JSON.parse(await read('_routes.json')).include.includes('/*'));
  assert((await read('en/privacy/index.html')).includes('Google AdSense is enabled'));
  await build({outDir,env:{}});await assert.rejects(read('ads.txt'));await assert.rejects(read('_worker.js'));assert(!(await read('_headers')).includes('googlesyndication'));
  assert(!(await read('index.html')).includes('adsbygoogle.js'));
  await build({outDir,env:{SITE_URL:origin,ADSENSE_CLIENT:client,CF_PAGES_BRANCH:'preview'}});
  assert((await read('robots.txt')).includes('Disallow: /'));assert((await read('en/image/upscale/index.html')).includes('noindex,nofollow'));
  assert(!(await read('sitemap.xml')).includes('<loc>'));await assert.rejects(read('ads.txt'));
 }finally{await rm(temp,{recursive:true,force:true});}
});
