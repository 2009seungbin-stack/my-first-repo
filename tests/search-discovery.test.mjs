import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entry} from '../tools/build.mjs';
import {pagePath,setPortal} from '../src/seo.js';
import {sitemapGroups} from '../tools/sitemaps.mjs';
import {LOCALES} from '../src/i18n.js';
import {searchDiscoveryFiles,searchDiscoveryLinks,discoveryPage} from '../tools/search-discovery.mjs';

const root='https://nerulio.example.test/',html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fixture=(url,robots='',canonical=url)=>`<html><head><title>Tool &amp; details</title><meta content='Real &quot;capabilities&quot; &amp; limits.' name='description'><meta name='robots' content='${robots}'><link href='${canonical}' rel='canonical'></head></html>`;

test('discovery inventory uses real rendered metadata and only self-canonical indexable pages',async()=>{
 setPortal(false);
 const files=await searchDiscoveryFiles(root,{readPage:route=>entry(html,route,root),lastmod:()=>null});
 const index=JSON.parse(files['search-discovery.json']),urls=new Set(index.pages.map(p=>p.url));
 assert.equal(index.version,1);assert.equal(index.site.url,root);assert.deepEqual(index.site.languages,LOCALES);
 assert.equal(urls.size,index.pages.length,'each canonical appears once');
 assert.equal(index.pages.length,Object.values(sitemapGroups()).flat().length*LOCALES.length,'all localized indexable registry pages are represented');
 for(const page of index.pages){
  const rendered=entry(html,pagePath(page.path,page.language).replace(/\/$/,''),root);
  assert(rendered.includes(`rel="canonical" href="${page.url}"`),page.url);
  assert(!/name="robots"[^>]+content="[^"]*noindex/.test(rendered),page.url);
  assert(page.title.length&&page.description.length,page.url);assert(!('lastmod' in page),'unknown dates are omitted');
 }
 for(const excluded of ['admin','account','game/studio','image-to-pixel-art','sprite-slicer/classic','game/pixel-lab/app'])assert(!index.pages.some(p=>p.path===excluded),excluded);
 const guide=files['llms.txt'];assert.match(guide,/^# Nerulio\n/);
 assert(Buffer.byteLength(guide)<18000,'curated navigation stays compact');
 const linked=[...guide.matchAll(/^- \[[^\n]+\]\((https?:[^\n]+)\):/gm)].map(m=>m[1]);
 assert(linked.length>20&&linked.length<50,'entry points, not hundreds of keyword pages');
 for(const url of linked)assert(urls.has(url)||['search-discovery.json','sitemap.xml','robots.txt'].some(p=>url===new URL(p,root).href),url);
 assert.doesNotMatch(guide,/ranking boost|guaranteed|best in the world|llms-full/i);
});

test('portal builds describe their actual dedicated tools directory and preserve content dates',async()=>{
 setPortal(true);
 try{
  const date='2026-09-30T10:15:00Z';
  const files=await searchDiscoveryFiles(root,{readPage:route=>entry(html,route,root,{platform:true,metering:false}),lastmod:route=>route==='en'?date:null});
  const index=JSON.parse(files['search-discovery.json']);
  assert.equal(index.pages.find(p=>p.path===''&&p.language==='en').url,root+'en/tools/');
  assert.equal(index.pages.find(p=>p.path===''&&p.language==='ko').url,root+'ko/tools/');
  assert.equal(index.pages.find(p=>p.path===''&&p.language==='ja').url,root+'ja/');
  assert.equal(index.pages.find(p=>p.path===''&&p.language==='en').lastmod,date);
  assert(!index.pages.some(p=>p.url===root+'en/'),'the Worker portal is not misrepresented as a static tool home');
  assert.match(files['llms.txt'],/https:\/\/nerulio\.example\.test\/en\/tools\//);
 }finally{setPortal(false);}
});

test('preview and no-origin builds publish no discovery files or pointers and never read pages',async()=>{
 assert.deepEqual(await searchDiscoveryFiles('',{readPage:()=>{throw Error('Preview must not read or publish pages');}}),{});
 assert.deepEqual(await searchDiscoveryFiles(''),{});assert.equal(searchDiscoveryLinks(''),'');
 assert.equal(searchDiscoveryLinks(root),'<link rel="describedby" type="text/plain" href="https://nerulio.example.test/llms.txt">');
 await assert.rejects(searchDiscoveryFiles('https://u:p@example.test/'),/SITE_URL/);
});

test('emitted noindex declarations, aliases and conflicting canonicals cannot enter discovery',async()=>{
 const opts={url:root+'en/tool/',language:'en',path:'tool',group:'tools'};
 for(const robots of ['noindex,follow','NONE','max-snippet:120, noindex'])assert.equal(discoveryPage(fixture(opts.url,robots),opts),null,robots);
 assert.equal(discoveryPage(fixture(opts.url,'',root+'en/other/'),opts),null);
 assert.equal(discoveryPage(fixture(opts.url).replace('</head>',`<link rel="canonical" href="${root}ko/tool/"></head>`),opts),null);
 assert.equal(discoveryPage(fixture(opts.url).replace("name='robots'", "name='googlebot'").replace("content=''", "content='noindex'"),opts),null);
 const page=discoveryPage(fixture(opts.url),opts);assert.equal(page.title,'Tool & details');assert.equal(page.description,'Real "capabilities" & limits.');
 assert(!('lastmod' in page));assert.throws(()=>discoveryPage(fixture(opts.url),{...opts,lastmod:'2026-99-99'}),/Invalid discovery content date/);
});

test('service pricing can join only when an emitted indexable page exists and metadata failures fail clearly',async()=>{
 setPortal(false);
 const files=await searchDiscoveryFiles(root,{extra:['pricing'],readPage:route=>fixture(new URL(route+'/',root).href),lastmod:()=>null});
 const index=JSON.parse(files['search-discovery.json']);assert.equal(index.pages.filter(p=>p.path==='pricing').length,3);
 assert.match(files['llms.txt'],/en\/pricing\//);
 await assert.rejects(searchDiscoveryFiles(root,{readPage:route=>{if(route==='en')throw Error('Missing build output');return fixture(new URL(route+'/',root).href);}}),/Cannot read discovery page: en/);
 assert.throws(()=>discoveryPage(fixture(root+'en/').replace(/<title>.*?<\/title>/,''),{url:root+'en/'}),/lacks a title or description/);
});

test('discovery is reproducible, handles base paths and keeps Markdown descriptions on one line',async()=>{
 setPortal(false);const origin=root+'project/';
 const options={readPage:route=>fixture(new URL(route+'/',origin).href).replace('Tool &amp; details','Tool [alpha]\n&lt;example&gt;'),lastmod:()=>null};
 const files=await searchDiscoveryFiles(origin,options);assert.deepEqual(await searchDiscoveryFiles(origin,options),files);
 assert.match(files['llms.txt'],/Tool \\\[alpha\\\] &lt;example&gt;/);
 const index=JSON.parse(files['search-discovery.json']);assert(index.pages.every(p=>p.url.startsWith(origin)));
 assert(!('generated' in index),'build timestamps do not impersonate freshness');
});
