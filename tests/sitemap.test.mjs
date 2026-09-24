import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOCALES} from '../src/i18n.js';
import {INTENTS} from '../src/intents.js';
import {mayPromote} from '../src/capabilities.js';
import {GAME_HUB_PATH} from '../src/game-seo.js';
import {entry,ALL_ROUTES} from '../tools/build.mjs';
import {sitemapFiles,sitemapGroups,SITEMAP_FILES,SITEMAP_LIMITS,W3C_DATETIME} from '../tools/sitemaps.mjs';
import {contentText,contentHash,pageHashes,lastmodResolver,readLedger,staleRoutes} from '../tools/lastmod.mjs';
import {gamePageFor} from '../tools/game-landing-build.mjs';
import {GUIDES} from '../tools/guides-registry.mjs';
import {builtPages,changedSince,submission} from '../tools/indexnow.mjs';
/** Structural checks of what sitemaps.org's sitemap.xsd / siteindex.xsd require, without network or
 * lxml (CI). The full schema validation, with the official XSDs, is tools/validate-sitemaps.py. */
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),origin='https://nerulio.example.test/';
const hashes=pageHashes(entry,ALL_ROUTES,html),lastmod=lastmodResolver(hashes,{fallback:'2026-09-24T00:00:00Z'});
const files=sitemapFiles(origin,{lastmod});
const URL_RE=/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?((?:<xhtml:link rel="alternate" hreflang="[\w-]+" href="[^"]+"\/>)*)<\/url>/g;
const parse=xml=>[...xml.matchAll(URL_RE)].map(m=>({loc:m[1],lastmod:m[2]||null,alt:Object.fromEntries([...m[3].matchAll(/hreflang="([\w-]+)" href="([^"]+)"/g)].map(x=>[x[1],x[2]]))}));

test('sitemap.xml is an index of the game, tools and images sitemaps (+ guides once there are guides)',()=>{
 const index=files['sitemap.xml'];
 assert.match(index,/^<\?xml version="1.0" encoding="UTF-8"\?><sitemapindex xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">(<sitemap><loc>[^<]+<\/loc>(<lastmod>[^<]+<\/lastmod>)?<\/sitemap>)+<\/sitemapindex>$/);
 const listed=[...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].slice(origin.length));
 assert.deepEqual(listed,[SITEMAP_FILES.game,...(GUIDES.length?[SITEMAP_FILES.guides]:[]),SITEMAP_FILES.tools,SITEMAP_FILES.images]);
 for(const f of listed)assert(files[f],`${f} is written`);
 for(const d of [...index.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m=>m[1]))assert.match(d,W3C_DATETIME);
});
test('every page sitemap is a valid urlset within the limits, with complete reciprocal hreflang and W3C lastmod',()=>{
 const seen=new Map();
 for(const f of [SITEMAP_FILES.game,SITEMAP_FILES.tools,...(files[SITEMAP_FILES.guides]?[SITEMAP_FILES.guides]:[])]){
  const xml=files[f],urls=parse(xml);
  assert.match(xml,/^<\?xml version="1.0" encoding="UTF-8"\?><urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9" xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml">(<url>.*?<\/url>)+<\/urlset>$/,f);
  assert.equal(urls.length,(xml.match(/<url>/g)||[]).length,`${f}: every <url> has the loc, lastmod, links order of the schema`);
  assert(urls.length>0&&urls.length<=SITEMAP_LIMITS.urls&&Buffer.byteLength(xml)<=SITEMAP_LIMITS.bytes,f);
  for(const u of urls){
   assert(u.loc.length>=12&&u.loc.length<=2048&&u.loc.startsWith(origin)&&!/[?#]/.test(u.loc),u.loc);
   assert(!seen.has(u.loc),`${u.loc} in ${f} and ${seen.get(u.loc)}`);seen.set(u.loc,f);
   assert.deepEqual(Object.keys(u.alt),[...LOCALES,'x-default'],u.loc);
   assert(Object.values(u.alt).includes(u.loc),`${u.loc} is its own alternate`);
   if(u.lastmod){assert.match(u.lastmod,W3C_DATETIME,u.loc);assert(Date.parse(u.lastmod)<=Date.now(),`${u.loc} lastmod in the future`);}
  }
 }
 const all=[...seen.keys()].map(l=>parse(files[seen.get(l)]).find(u=>u.loc===l));
 const byLoc=new Map(all.map(u=>[u.loc,u]));
 for(const u of all)for(const l of LOCALES)assert.deepEqual(byLoc.get(u.alt[l])?.alt,u.alt,`${u.loc}: ${l} alternate lists the same set`);
 assert.equal(parse(files[SITEMAP_FILES.game]).concat(parse(files[SITEMAP_FILES.tools])).filter(u=>!u.lastmod&&!u.loc.includes('/guides/')).length,0,'every game and tool page has a lastmod');
});
test('game sitemap: home, the hub, then every indexable game page; file tools only in the tools sitemap',()=>{
 const g=sitemapGroups(),game=parse(files[SITEMAP_FILES.game]).map(u=>u.loc.slice(origin.length)),tools=parse(files[SITEMAP_FILES.tools]).map(u=>u.loc.slice(origin.length));
 assert.deepEqual(game.slice(0,7),['ko/','en/','ja/','',`ko/${GAME_HUB_PATH}/`,`en/${GAME_HUB_PATH}/`,`ja/${GAME_HUB_PATH}/`],'home in ko/en/ja and at / (its x-default), then the hub');
 for(const p of g.game.slice(2))assert(gamePageFor(p)||INTENTS[Object.keys(INTENTS).find(k=>INTENTS[k].path===p)],`${p} is a game page`);
 for(const p of ['image/compress','pdf/split','video/to-gif','about'])assert(tools.includes(`en/${p}/`)&&!game.includes(`en/${p}/`),p);
 for(const p of g.game)assert(p===''||p===GAME_HUB_PATH||mayPromote(gamePageFor(p)?.id||Object.keys(INTENTS).find(k=>INTENTS[k].path===p)),`${p} listed only when indexable`);
 for(const p of ['game/studio','sprite-slicer/classic','game/pixel-lab/app'])assert(!game.includes(`en/${p}/`)&&!tools.includes(`en/${p}/`),`${p} (app or noindex tool page) is never listed`);
 assert(g.game.length>=60,`at least 60 game pages (${g.game.length})`);
});
test('preview builds publish no URL; the image sitemap stays a urlset',()=>{
 const p=sitemapFiles('');assert(!p['sitemap.xml'].includes('<loc>'));assert(!p[SITEMAP_FILES.images].includes('<loc>'));
 assert.match(files[SITEMAP_FILES.images],/<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9" xmlns:image="http:\/\/www.google.com\/schemas\/sitemap-image\/1.1">/);
});
test('lastmod: the ledger date while the content is unchanged, the commit date once it changes, never the build time',()=>{
 const a='<html><head><title>T</title><meta name="description" content="D"></head><body><header>menu</header><main><h1>Hi</h1><p>x</p><script>1</script><footer class="site-footer">f</footer></main><footer>g</footer></body></html>';
 assert.equal(contentText(a),'T D Hi x');
 assert.equal(contentHash(a),contentHash(a.replace('<script>1</script>','<script>2</script>').replace('>f<','>new footer link<')),'scripts and footers are not content');
 assert.notEqual(contentHash(a),contentHash(a.replace('<p>x</p>','<p>y</p>')));
 assert.notEqual(contentHash(a),contentHash(a.replace('<p>x</p>','<p><a href="en/a/">x</a></p>')),'a link target is content');
 const h=new Map([['en/a','h1'],['en/b','h2']]),r=lastmodResolver(h,{ledger:{'en/a':['h1','2026-09-21T10:00:00+09:00'],'en/b':['old','2026-09-20']},fallback:'2026-09-24T12:00:00+09:00'});
 assert.equal(r('en/a'),'2026-09-21T10:00:00+09:00');assert.equal(r('en/b'),'2026-09-24T12:00:00+09:00');assert.equal(r('en/c'),null);
 assert.equal(lastmodResolver(h,{ledger:{},fallback:null})('en/a'),null,'no git and no ledger entry: no lastmod rather than an invented one');
});
test('the lastmod ledger is current (run `node tools/lastmod.mjs --write` after changing page content)',()=>{
 const stale=staleRoutes(hashes,readLedger());
 assert.deepEqual(stale.slice(0,10),[],`${stale.length} pages changed since tools/lastmod-ledger.json was written`);
 for(const [,[,d]] of Object.entries(readLedger()))assert.match(d,W3C_DATETIME);
});
test('IndexNow follows the index and submits only new or changed pages',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');
 const dir=await mkdtemp(path.join(os.tmpdir(),'nerulio-indexnow-'));
 try{
  for(const [f,xml] of Object.entries(files))await writeFile(path.join(dir,f),xml);
  const pages=await builtPages(dir);
  assert.equal(pages.size,parse(files[SITEMAP_FILES.game]).length+parse(files[SITEMAP_FILES.tools]).length+(files[SITEMAP_FILES.guides]?parse(files[SITEMAP_FILES.guides]).length:0));
  const before=new Map(pages);before.delete(origin+'en/');before.set(origin+'ko/','2020-01-01');
  assert.deepEqual(changedSince(pages,before).sort(),[origin+'en/',origin+'ko/'].sort());
  assert.deepEqual(changedSince(pages,pages),[]);
  const body=submission({siteURL:origin,indexNowKey:'abcd1234'},changedSince(pages,before));
  assert.equal(body.urlList.length,2);assert.equal(body.keyLocation,origin+'abcd1234.txt');
 }finally{await rm(dir,{recursive:true,force:true});}
});
