import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {parseDigest,loadDigest,publishedDigest,digestDataModule,DIGEST_DIR} from '../tools/digest-build.mjs';
import {useDigestArticles,digestLink,digestArticles} from '../platform/digest.js';
import {renderDiscovery} from '../platform/render/discovery.js';
import {matchPlatformRoute,renderPlatformPage,renderSitemap} from '../server/platform/pages.js';
import {build} from '../tools/build.mjs';

const origin='https://nerulio.example.test';
const md=(o)=>`---\ntitle: "${o.title}"\ndate: ${o.date}\n${o.updated?`updated: ${o.updated}\n`:''}summary: "${o.summary||'요약 문장'}"\nstatus: ${o.status}\nsources:\n  - title: "Example source"\n    url: "https://example.com/a"\n  - title: 'Second'\n    url: https://example.com/b\n---\n## 소제목\n\n본문 [출처](https://example.com/a) 와 **강조**.\n`;
/** Fixtures (never the real drafts): a ko+en published pair, a ko-only published article, and drafts. */
const FIXTURES=[
 parseDigest('2026-10-24-pub-pair.ko.md',md({title:'게시된 해설 KO',date:'2026-10-24',updated:'2026-10-26',status:'published'})),
 parseDigest('2026-10-24-pub-pair.en.md',md({title:'Published digest EN',date:'2026-10-24',status:'published'})),
 parseDigest('2026-10-17-ko-only.ko.md',md({title:'한국어만 게시',date:'2026-10-17',status:'published'})),
 parseDigest('2026-10-31-secret-draft.ko.md',md({title:'비공개 초안 제목',date:'2026-10-31',status:'draft'})),
 parseDigest('2026-10-24-pub-pair-draft.en.md',md({title:'Hidden English draft',date:'2026-10-24',status:'draft'})),
];
const fakeEnv={DB:{}};// the digest pages and the bracket page read nothing from D1
const get=async p=>renderPlatformPage(new Request(origin+p),fakeEnv,{origin});
const jsonld=h=>[...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
const withArticles=async(list,fn)=>{useDigestArticles(list);try{await fn();}finally{useDigestArticles([]);}};

test('digest files: frontmatter is validated, drafts and published parse alike',async()=>{
 const a=FIXTURES[0];
 assert.deepEqual({slug:a.slug,locale:a.locale,date:a.date,updated:a.updated,status:a.status},{slug:'pub-pair',locale:'ko',date:'2026-10-24',updated:'2026-10-26',status:'published'});
 assert.deepEqual(a.sources,[{title:'Example source',url:'https://example.com/a'},{title:'Second',url:'https://example.com/b'}]);
 assert.equal(FIXTURES[1].updated,'2026-10-24','updated defaults to date');
 const bad=[
  ['2026-10-24-x.ko.md',md({title:'t',date:'2026-10-25',status:'draft'}),/must match/],
  ['2026-10-24-x.ja.md',md({title:'t',date:'2026-10-24',status:'draft'}),/name must be/],
  ['2026-10-24-x.ko.md',md({title:'t',date:'2026-10-24',status:'live'}),/status/],
  ['2026-10-24-x.ko.md',md({title:'t',date:'2026-10-24',status:'draft'}).replace(/sources:[\s\S]*?---/,'sources:\n---'),/sources/],
  ['2026-10-24-x.ko.md',md({title:'t',date:'2026-10-24',status:'draft'}).replace('https://example.com/b','javascript:alert(1)'),/http/],
  ['2026-10-24-x.ko.md',md({title:'t',date:'2026-10-24',status:'draft'}).replace('status:','author: someone\nstatus:'),/unknown key/],
  ['2026-10-24-x.ko.md','no frontmatter',/frontmatter/],
 ];
 for(const [name,text,re] of bad)assert.throws(()=>parseDigest(name,text),re,name);
 // The repository's own files must always build (drafts included).
 const real=await loadDigest();
 for(const x of real)assert(x.sources.length&&x.title&&x.summary,x.slug);
});

test('the Worker data module carries published articles only',()=>{
 const text=digestDataModule(FIXTURES);
 assert(text.includes('게시된 해설 KO')&&text.includes('Published digest EN'));
 assert(!text.includes('비공개 초안 제목')&&!text.includes('Hidden English draft')&&!text.includes('"draft"'));
 assert.equal(publishedDigest(FIXTURES).length,3);
 // useDigestArticles drops drafts even when handed some.
 useDigestArticles(FIXTURES);try{assert.deepEqual(digestArticles('ko').map(a=>a.slug),['pub-pair','ko-only']);assert.deepEqual(digestArticles('en').map(a=>a.slug),['pub-pair']);}finally{useDigestArticles([]);}
});

test('digest routes sit before the AI tag pages',()=>{
 assert.deepEqual(matchPlatformRoute('/ko/ai/digest/'),{l:'ko',page:'digest'});
 assert.deepEqual(matchPlatformRoute('/en/ai/digest/some-slug/'),{l:'en',page:'digest-article',slug:'some-slug'});
 assert.deepEqual(matchPlatformRoute('/ko/ai/claude/'),{l:'ko',page:'channel',vertical:'ai',slug:'claude',no:null});
 assert.equal(matchPlatformRoute('/ja/ai/digest/'),null);
});

test('with nothing published: the index is noindex, unlinked, and articles do not exist',async()=>{
 useDigestArticles([]);
 for(const l of ['ko','en']){
  assert.equal(digestLink(l),null);
  const r=await get(`/${l}/ai/digest/`);assert.equal(r.status,200);
  const h=await r.text();assert.match(h,/<meta name="robots" content="noindex,follow">/);assert(!h.includes('hreflang'));
  const nav=await (await get(`/${l}/bracket/`)).text();assert(!nav.includes(`/${l}/ai/digest/`),'no menu link');
  assert(!String(renderDiscovery(l)).includes('/ai/digest/'),'no home link');
 }
 assert.equal(await get('/ko/ai/digest/pub-pair/'),null,'unknown article → static 404');
 assert.equal((await get('/ko/ai/digest/?utm=x')).status,301,'junk parameters redirect to the canonical URL');
});

test('drafts are never rendered, listed or linked; published articles render with canonical, hreflang and Article JSON-LD',async()=>{
 await withArticles(FIXTURES,async()=>{
  assert.equal(await get('/ko/ai/digest/secret-draft/'),null,'a draft is a 404');
  const index=await (await get('/ko/ai/digest/')).text();
  assert(!index.includes('noindex'));assert(index.includes('게시된 해설 KO')&&index.includes('한국어만 게시'));
  assert(!index.includes('비공개 초안 제목')&&!index.includes('secret-draft'));
  assert(index.includes(`<link rel="canonical" href="${origin}/ko/ai/digest/">`));
  assert(index.includes(`hreflang="en" href="${origin}/en/ai/digest/"`));
  const r=await get('/ko/ai/digest/pub-pair/');assert.equal(r.status,200);
  const h=await r.text();
  assert(h.includes(`<link rel="canonical" href="${origin}/ko/ai/digest/pub-pair/">`));
  assert(h.includes(`hreflang="en" href="${origin}/en/ai/digest/pub-pair/"`)&&h.includes('hreflang="x-default"'));
  assert.match(h,/content="index,follow/);
  assert(h.includes('<h2>소제목</h2>')&&h.includes('https://example.com/a'));
  assert(h.indexOf('<!--ad:content-1-->')>h.indexOf('<h2>소제목</h2>'),'ad markers only after the content');
  const graph=jsonld(h)[0]['@graph'],art=graph.find(n=>n['@type']==='Article');
  assert.equal(art.headline,'게시된 해설 KO');assert.equal(art.datePublished,'2026-10-24');assert.equal(art.dateModified,'2026-10-26');
  assert.equal(art.publisher['@id'],`${origin}/#organization`);assert.equal(art.author['@id'],`${origin}/#organization`);
  assert.equal(graph.find(n=>n['@id']===`${origin}/#organization`).name,'Nerulio');
  assert(!JSON.stringify(graph).includes('"Person"'),'no invented person author');
  assert.equal(art.citation.length,2);
  // A translation that is still a draft (or missing) gives no hreflang.
  const only=await (await get('/ko/ai/digest/ko-only/')).text();assert(!only.includes('hreflang'));
  assert.equal(await get('/en/ai/digest/ko-only/'),null);
  // The single helper links the digest from the menu's AI entry and the home page's AI area.
  for(const l of ['ko','en']){
   const nav=await (await get(`/${l}/bracket/`)).text();assert(nav.includes(`href="/${l}/ai/digest/" data-digest-link`),l);
   assert(String(renderDiscovery(l)).includes(`href="/${l}/ai/digest/"`),l);
  }
 });
 // Only a language with a published article is linked.
 await withArticles([FIXTURES[2]],async()=>{assert(digestLink('ko'));assert.equal(digestLink('en'),null);assert.match(await (await get('/en/ai/digest/')).text(),/noindex/);});
});

test('the AI sitemap lists published digest pages only',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 try{
  assert(!(await renderSitemap(db,'ai',origin)).includes('/ai/digest/'),'nothing while none is published');
  await withArticles(FIXTURES,async()=>{
   const xml=await renderSitemap(db,'ai',origin);
   for(const u of ['/ko/ai/digest/','/en/ai/digest/','/ko/ai/digest/pub-pair/','/en/ai/digest/pub-pair/','/ko/ai/digest/ko-only/'])assert(xml.includes(`<loc>${origin}${u}</loc>`),u);
   assert(!xml.includes('secret-draft')&&!xml.includes(`${origin}/en/ai/digest/ko-only/`));
   assert.match(xml,new RegExp(`<loc>${origin}/ko/ai/digest/pub-pair/</loc><lastmod>2026-10-26</lastmod>`));
  });
 }finally{db.raw.close();}
});

test('a platform build ships no draft text anywhere in dist/',async()=>{
 const real=await loadDigest(),drafts=real.filter(a=>a.status==='draft');
 const temp=await mkdtemp(path.join(os.tmpdir(),'nerulio-digest-')),out=path.join(temp,'dist');
 try{
  await build({outDir:out,env:{SITE_URL:origin+'/',SERVICE_API:'on',PLATFORM:'on'}});
  const data=await readFile(path.join(out,'_worker.js','platform','digest-data.js'),'utf8');
  assert.equal(data,digestDataModule(real));
  const files=async d=>(await Promise.all((await readdir(d,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]))).flat();
  const text=(await Promise.all((await files(out)).filter(f=>/\.(html|js|mjs|json|xml|txt|md)$/.test(f)).map(f=>readFile(f,'utf8')))).join('\n');
  for(const d of drafts)assert(!text.includes(d.title),`draft "${d.title}" leaked into dist`);
  assert(!(await readdir(out)).includes('content'));
 }finally{await rm(temp,{recursive:true,force:true});}
 assert.equal(DIGEST_DIR.replace(/\\/g,'/').endsWith('content/ai-digest/'),true);
});
