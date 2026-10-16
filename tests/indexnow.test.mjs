import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {builtPages,changedSince,livePages,waitLive,submission} from '../tools/indexnow.mjs';

const site='https://nerulio.example.test/';
const index=names=>`<sitemapindex>${names.map(name=>`<sitemap><loc>${new URL(name,site)}</loc></sitemap>`).join('')}</sitemapindex>`;
const urlset=entries=>`<urlset>${entries.map(([url,date=''])=>`<url><loc>${url.replaceAll('&','&amp;')}</loc>${date?`<lastmod>${date}</lastmod>`:''}</url>`).join('')}</urlset>`;
const fixtureFetch=(files,calls=[])=>async url=>{
 const href=String(url);calls.push(href);
 return new Response(files[href]||'',{status:Object.hasOwn(files,href)?200:404});
};

test('a platform build reads static canonical pages without requiring D1 sitemaps on disk',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'nerulio-indexnow-platform-'));
 try{
  await writeFile(path.join(dir,'sitemap.xml'),index(['sitemap-game.xml','sitemap-tools.xml','sitemap-images.xml','sitemap-n2-ai.xml','sitemap-n2-hardware.xml']));
  await writeFile(path.join(dir,'sitemap-game.xml'),urlset([[site+'en/game/','2026-10-07']]));
  await writeFile(path.join(dir,'sitemap-tools.xml'),urlset([[site+'ko/tools/','2026-10-06'],[site+'en/tools/','2026-10-06']]));
  assert.deepEqual(await builtPages(dir),new Map([[site+'en/game/','2026-10-07'],[site+'ko/tools/','2026-10-06'],[site+'en/tools/','2026-10-06']]));
  await writeFile(path.join(dir,'sitemap.xml'),index(['sitemap-n2-madeup.xml']));
  await assert.rejects(builtPages(dir),/does not exist/,'only known Worker sitemaps may be missing');
  await writeFile(path.join(dir,'sitemap.xml'),index(['sitemap-guides.xml']));
  await assert.rejects(builtPages(dir),/does not exist/,'a missing static guide sitemap remains a failed build');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a previous single sitemap still supplies removed canonical URLs to the deploy diff',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'nerulio-indexnow-old-'));
 try{
  await writeFile(path.join(dir,'sitemap.xml'),urlset([[site,'2026-09-25'],[site+'en/','2026-09-25']]));
  const before=await builtPages(dir),now=new Map([[site+'en/tools/','2026-10-07']]);
  const urls=changedSince(now,before);
  assert.deepEqual(urls,[site+'en/tools/',site,site+'en/']);
  assert.deepEqual(submission({siteURL:site,indexNowKey:'abcd1234'},urls).urlList,urls);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('the deploy diff notifies additions, date changes and removals once each',()=>{
 const before=new Map([[site+'en/game/','2026-10-06'],[site+'en/old/','2026-10-01'],[site+'en/same/','']]);
 const now=new Map([[site+'en/game/','2026-10-07'],[site+'en/new/',''],[site+'en/same/','']]);
 assert.deepEqual(changedSince(now,before),[site+'en/game/',site+'en/new/',site+'en/old/']);
 assert.deepEqual(changedSince(now,now),[]);
 assert.deepEqual(changedSince(new Map(),before),[...before.keys()],'a removal-only deploy is notified');
});

test('live discovery includes allowed Worker canonical pages and query URLs, but static comparison omits them',async()=>{
 const calls=[],files={
  [site+'sitemap.xml']:index(['sitemap-tools.xml','sitemap-n2-ai.xml','sitemap-n2-hardware.xml','sitemap-images.xml']),
  [site+'sitemap-tools.xml']:urlset([[site+'en/tools/','2026-10-07']]),
  [site+'sitemap-n2-ai.xml']:urlset([[site,''],[site+'en/ai/chatgpt/','2026-10-06']]),
  [site+'sitemap-n2-hardware.xml']:urlset([[site+'ko/hardware/?type=gpu&vs=rtx-4070,rtx-5070','']])
 };
 const fetcher=fixtureFetch(files,calls),all=await livePages(site,{fetcher});
 assert.equal(all.size,4);
 assert(all.has(site+'ko/hardware/?type=gpu&vs=rtx-4070,rtx-5070'),'XML-escaped query canonical URLs are discovered');
 assert(!calls.includes(site+'sitemap-images.xml'),'images do not add page URLs');
 calls.length=0;
 assert.deepEqual(await livePages(site,{includeDynamic:false,fetcher}),new Map([[site+'en/tools/','2026-10-07']]));
 assert.deepEqual(calls,[site+'sitemap.xml',site+'sitemap-tools.xml']);
});

test('live discovery refuses foreign or unknown sitemap fetches',async()=>{
 for(const child of ['https://foreign.example.test/sitemap-tools.xml',site+'sitemap-n2-madeup.xml',site+'nested/sitemap-tools.xml',site+'sitemap-tools.xml?source=other']){
  const calls=[],files={[site+'sitemap.xml']:`<sitemapindex><sitemap><loc>${child}</loc></sitemap></sitemapindex>`};
  await assert.rejects(livePages(site,{fetcher:fixtureFetch(files,calls)}),/Unexpected live sitemap URL/);
  assert.deepEqual(calls,[site+'sitemap.xml'],'the rejected child is never fetched');
 }
});

test('static deployment verification tolerates extra live Worker pages and checks static removals',async()=>{
 const old=site+'en/old/',current=site+'en/tools/',calls=[];
 const files={
  [site+'sitemap.xml']:index(['sitemap-tools.xml','sitemap-n2-ai.xml']),
  [site+'sitemap-tools.xml']:urlset([[current,'2026-10-07']]),
  [site+'sitemap-n2-ai.xml']:urlset([[site,''],[old,'2026-10-06']])
 };
 await waitLive({siteURL:site},new Map([[current,'2026-10-07']]),{removed:[old],timeoutMs:0,fetcher:fixtureFetch(files,calls)});
 assert.deepEqual(calls,[site+'sitemap.xml',site+'sitemap-tools.xml'],'D1 availability is independent of the static build');
 files[site+'sitemap-tools.xml']=urlset([[current,'2026-10-07'],[old,'2026-10-06']]);
 await assert.rejects(waitLive({siteURL:site},new Map([[current,'2026-10-07']]),{removed:[old],timeoutMs:0,fetcher:fixtureFetch(files)}),/Nothing was submitted/,'stale static removals block notification');
});

test('missing or stale undated pages cannot falsely pass deployment verification',async()=>{
 const files={[site+'sitemap.xml']:index(['sitemap-tools.xml']),[site+'sitemap-tools.xml']:urlset([])};
 await assert.rejects(waitLive({siteURL:site},new Map([[site+'en/tools/','']]),{timeoutMs:0,fetcher:fixtureFetch(files)}),/Nothing was submitted/);
 files[site+'sitemap-tools.xml']=urlset([[site+'en/tools/','2026-10-06']]);
 await assert.rejects(waitLive({siteURL:site},new Map([[site+'en/tools/','2026-10-07']]),{timeoutMs:0,fetcher:fixtureFetch(files)}),/Nothing was submitted/);
 await assert.rejects(waitLive({siteURL:site},new Map(),{removed:[site+'en/tools/'],timeoutMs:0,fetcher:fixtureFetch({})}),/Nothing was submitted/,'a sitemap fetch failure cannot pass a removal-only deploy');
});

test('the IndexNow workflow builds current and previous commits with production portal flags',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/indexnow.yml',import.meta.url),'utf8');
 for(const [name,value] of [['SERVICE_API','on'],['PLATFORM','on'],['TOOL_METERING','off']])assert.match(workflow,new RegExp(`      ${name}: '${value}'`));
 assert.match(workflow,/cd \.\.\/previous && node tools\/build\.mjs/);
 assert.match(workflow,/--since \.\.\/previous\/dist --wait-live --submit/);
});
