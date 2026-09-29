import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {build} from '../tools/build.mjs';
import {configuration,adHead} from '../tools/site-config.mjs';
import {serviceRoutes,STATIC_EXCLUDES} from '../tools/service-build.mjs';
import {priceText} from '../src/service-content.js';
const origin='https://nerulio.example.test/';
const client='ca-pub-3141592653589793';// synthetic, never sent to Google
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
async function withBuild(env,fn){
 const temp=await mkdtemp(path.join(os.tmpdir(),'nerulio-service-')),outDir=path.join(temp,'dist');
 try{await build({outDir,env});await fn(outDir,f=>readFile(path.join(outDir,f),'utf8'));}finally{await rm(temp,{recursive:true,force:true});}
}
test('SERVICE_API is opt-in and validated; prices come only from configuration',()=>{
 assert.equal(configuration({}).service,false);
 assert.equal(configuration({SERVICE_API:'on'}).service,true);
 assert.throws(()=>configuration({SERVICE_API:'yes'}));
 assert.throws(()=>configuration({PRO_PRICE_AMOUNT:'4,99',PRO_PRICE_CURRENCY:'USD'}));
 assert.throws(()=>configuration({PRO_PRICE_AMOUNT:'4.99',PRO_PRICE_CURRENCY:'dollars'}));
 assert.throws(()=>configuration({PRO_PRICE_INTERVAL:'week'}));
 assert.equal(configuration({FREE_DAILY_JOBS:'20'}).freeDailyJobs,20);
 assert.equal(priceText({amount:'',currency:''},'en'),'Price announced at launch');
 assert.equal(priceText({amount:'4.99',currency:'USD',interval:'month'},'en'),'$4.99 / month');
 assert.equal(priceText({amount:'49',currency:'USD',interval:'year'},'en'),'$49.00 / year');
 // Legacy ad head keeps the static script; service ad head defers to the runtime loader.
 assert(adHead({client,slots:{}}).includes('adsbygoogle.js'));
 const runtime=adHead({client,slots:{},service:true});assert(!runtime.includes('adsbygoogle.js')&&runtime.includes('src/ads.js'));
});
test('default build is the unchanged static site: no Worker, no account pages, no service meta',async()=>{
 await withBuild({SITE_URL:origin},async(out,read)=>{
  await assert.rejects(stat(path.join(out,'_worker.js')));await assert.rejects(read('_routes.json'));
  await assert.rejects(read('pricing/index.html'));await assert.rejects(read('verify/index.html'));
  const page=await read('en/image/upscale/index.html');
  assert(!page.includes('nerulio-service'));assert(page.includes('id="accountLink"')&&/id="accountLink"[^>]*hidden/.test(page));
  for(const f of ['sitemap.xml','sitemap-game.xml','sitemap-tools.xml'])assert(!(await read(f)).includes('/pricing/'),f);
  assert(!(await read('en/privacy/index.html')).includes('nerulio_anon'));
 });
});
test('service build: Worker bundle, API-only routes, pages, headers, privacy text',async()=>{
 const secrets={GOOGLE_OAUTH_CLIENT_SECRET:'google-secret-xyz-123',GITHUB_OAUTH_CLIENT_SECRET:'github-oauth-secret-xyz-0123456789abcdef',DISCORD_OAUTH_CLIENT_SECRET:'discord-oauth-secret-xyz-0123456789',BILLING_WEBHOOK_SECRET:'whsec-xyz-456',SESSION_SECRET:'session-secret-xyz-789-0123456789abcdef',TURNSTILE_SECRET_KEY:'0x4-turnstile-secret-xyz',
  // Admin app credentials (server/platform/admin.js) are runtime secrets too.
  ADMIN_SETUP_CODE:'admin-setup-code-xyz-0123456789',VAPID_PRIVATE_KEY:'vapid-private-xyz-0123456789abcdefghijklmnopq',NOTIFY_TOKEN:'notify-token-xyz-0123456789abcdefghijkl',GITHUB_DISPATCH_TOKEN:'github_pat_xyz_0123456789',CF_ANALYTICS_TOKEN:'cf-analytics-xyz-0123456789'};
 await withBuild({SITE_URL:origin,SERVICE_API:'on',PRO_PRICE_AMOUNT:'4.99',PRO_PRICE_CURRENCY:'USD',...secrets},async(out,read)=>{
  // Worker: every relative import resolves inside the _worker.js directory.
  const worker=path.join(out,'_worker.js'),sources=(await files(worker)).filter(f=>f.endsWith('.js')||f.endsWith('.mjs'));
  assert(sources.some(f=>f.endsWith(path.join('_worker.js','index.js'))));
  for(const f of sources)for(const [,spec] of (await readFile(f,'utf8')).matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g)){
   assert(spec.startsWith('.'),`${f} imports bare module ${spec}`);
   await stat(path.resolve(path.dirname(f),spec));
  }
  assert.match(await read('_worker.js/server/build-info.js'),/"adsHtml":false,"preview":false/);
  assert.deepEqual(JSON.parse(await read('_routes.json')),{version:1,include:['/api/*','/_worker.js/*'],exclude:[]},'static assets never wake the Worker');
  // Pages
  for(const l of ['','ko/','en/','ja/'])for(const r of ['pricing','account'])assert((await read(`${l}${r}/index.html`)).includes(`src/${r}-page.js`));
  assert((await read('ko/pricing/index.html')).includes('US$4.99'));
  assert((await read('en/account/index.html')).includes('noindex,nofollow'));
  assert((await read('sitemap-tools.xml')).includes('/en/pricing/'));for(const f of ['sitemap.xml','sitemap-game.xml','sitemap-tools.xml'])assert(!(await read(f)).includes('/account/'),f);
  const verify=await read('verify/index.html');assert(verify.includes('noindex')&&!/<script(?![^>]*\bsrc=)/.test(verify),'no inline script');
  const headers=await read('_headers');
  assert(headers.startsWith('/*'));assert(/\/verify\/\*\n  ! Content-Security-Policy\n  Content-Security-Policy: [^\n]*challenges\.cloudflare\.com[^\n]*frame-ancestors 'self'/.test(headers));
  assert(!/\/\*[^\n]*\/\*/.test(headers.split('\n').filter(l=>/^\S/.test(l)).join('\n')),'one splat per _headers rule');
  const tool=await read('ko/image/upscale/index.html');
  assert(tool.includes('<meta name="nerulio-service"'));
  assert((await read('en/privacy/index.html')).includes('nerulio_anon'));
  // No credential that existed in the build environment reaches any published file.
  for(const f of await files(out)){
   const text=await readFile(f,'utf8').catch(()=>'');
   for(const [name,value] of Object.entries(secrets))assert(!text.includes(value),`${name} leaked into ${path.relative(out,f)}`);
  }
 });
});
test('service + ads build: HTML through the Worker for nonces, static assets excluded',async()=>{
 await withBuild({SITE_URL:origin,SERVICE_API:'on',ADSENSE_CLIENT:client,ADSENSE_SLOT_CONTENT_1:'1234567890',ADSENSE_CMP_READY:'true'},async(out,read)=>{
  const routes=JSON.parse(await read('_routes.json'));
  assert.deepEqual(routes.include,['/*']);for(const p of ['/src/*','/assets/*','/verify/*','/sitemap-images.xml'])assert(routes.exclude.includes(p),p);
  assert.match(await read('_worker.js/server/build-info.js'),/"adsHtml":true/);
  const page=await read('en/image/upscale/index.html');
  assert(!page.includes('adsbygoogle.js'),'AdSense is injected at runtime only for Free');
  assert(page.includes('src/ads.js')&&page.includes('adsense-config'));
  assert(!(await read('en/pricing/index.html')).includes('adsense-config'),'no ads on account pages');
 });
 assert.equal(serviceRoutes({client}).exclude.length,STATIC_EXCLUDES.length);
 assert(serviceRoutes({client}).exclude.length<=100&&serviceRoutes({client}).exclude.every(r=>r.length<=100),'_routes.json limits');
});
test('tool UI never hard-codes quota classes',async()=>{
 for(const f of ['app','experience','toolkit','entitlement','ads']){
  const src=await readFile(new URL(`../src/${f}.js`,import.meta.url),'utf8');
  assert(!/['"]heavy['"]/.test(src),`${f}.js must use src/quota.js`);
 }
 const entitlement=await readFile(new URL('../src/entitlement.js',import.meta.url),'utf8');
 assert(!/localStorage\.[gs]etItem\([^)]*(pro|plan)/i.test(entitlement),'entitlement never persists plan in storage');
 assert(!/FormData|Blob|arrayBuffer|readAsDataURL|\.name\b/.test(entitlement),'entitlement never touches file data');
});
test('REDIRECT_TO builds a redirect-only deployment for a retired address',async()=>{
 for(const bad of ['http://nerulio.pages.dev','https://nerulio.pages.dev/path','https://nerulio.pages.dev/?q=1','nerulio.pages.dev'])assert.throws(()=>configuration({REDIRECT_TO:bad}),bad);
 assert.equal(configuration({REDIRECT_TO:'https://nerulio.pages.dev/'}).redirectTo,'https://nerulio.pages.dev');
 await withBuild({REDIRECT_TO:'https://nerulio.pages.dev',SITE_URL:'https://fileforge-studio.pages.dev'},async(out,read)=>{
  assert.equal(await read('_redirects'),'/* https://nerulio.pages.dev/:splat 301\n');
  assert.deepEqual(await readdir(out),['_redirects'],'nothing else is served from the old address');
 });
});
test('platform build: PLATFORM=on routes the channel/community prefixes to the Worker and ships the renderers',async()=>{
 assert.throws(()=>configuration({SITE_URL:origin,PLATFORM:'on'}),/SERVICE_API=on/);
 assert.throws(()=>configuration({SITE_URL:origin,SERVICE_API:'on',PLATFORM:'yes'}),/PLATFORM must be on or off/);
 // TRAFFIC_HTML=off: only the platform prefixes are dynamic (the default routes all HTML for bot statistics; tests/traffic.test.mjs).
 await withBuild({SITE_URL:origin,SERVICE_API:'on',PLATFORM:'on',TRAFFIC_HTML:'off'},async(out,read)=>{
  const routes=JSON.parse(await read('_routes.json'));
  for(const p of ['/api/*','/ko/community/*','/en/ai/*','/ko/games/*','/ko/subculture/*'])assert(routes.include.includes(p),p);
  assert(!routes.include.includes('/*')&&!routes.include.some(r=>r.startsWith('/ko/image')),'tool pages stay static');
  assert.match(await read('_worker.js/server/build-info.js'),/"platform":true/);
  assert((await read('_worker.js/platform/render/channel.js')).includes('renderChannel'));
  assert((await read('src/platform/n2.css')).includes('.pr{'));
  assert(routes.include.includes('/sitemap-n2-*'));
  assert((await read('sitemap.xml')).includes('sitemap-n2-games.xml'),'entity sitemaps are listed in the index');
  assert((await read('_worker.js/platform/seo.js')).includes('indexable'));
  const site=origin.replace(/\/$/,'');
  // The portal: / and /en/ are Worker pages (/ko/ redirects there); the tool home moves to /ko/tools/ and /en/tools/.
  for(const p of ['/','/ko/','/en/'])assert(routes.include.includes(p),p);
  for(const l of ['ko','en']){
   const home=await read(`${l}/tools/index.html`);
   assert(home.includes(`<link data-site-seo rel="canonical" href="${site}/${l}/tools/">`),`${l} tool home canonical`);
   assert(home.includes(`hreflang="ja" href="${site}/ja/"`)&&home.includes(`hreflang="x-default" href="${site}/en/tools/"`)&&home.includes('<base href="../../">'));
   assert(home.includes('<meta name="nerulio-portal" content="on">'));
  }
  assert((await read('ja/index.html')).includes(`hreflang="ko" href="${site}/ko/tools/"`),'the Japanese home points at the moved homes');
  const task=await read('ko/image/compress/index.html');
  assert(task.includes('data-tools-home href="ko/tools/"'),'← 모든 도구 goes to the tool home');
  const game=await read('sitemap-game.xml');
  assert(game.includes(`<loc>${site}/ko/tools/</loc>`)&&game.includes(`<loc>${site}/ja/</loc>`)&&!game.includes(`<loc>${site}/ko/</loc>`)&&!game.includes(`<loc>${site}/</loc>`),'the tool home in the sitemap, the portal in the n2 sitemap');
 });
 // Without the platform nothing moves.
 await withBuild({SITE_URL:origin},async(out,read)=>{
  const site=origin.replace(/\/$/,'');
  await assert.rejects(read('ko/tools/index.html'));
  assert((await read('ko/index.html')).includes(`<link data-site-seo rel="canonical" href="${site}/ko/">`));
  assert(!(await read('ko/index.html')).includes('nerulio-portal'));
  assert((await read('ko/image/compress/index.html')).includes('data-tools-home href="ko/"'));
 });
});
