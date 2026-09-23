import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {GUIDES,GUIDE_ROUTES,GUIDE_SECTIONS,GUIDE_ENGINES,GUIDE_INDEX,STUDIO_WORKSPACES,guideRoute,guideLastmod,isGuideRoute,guidePath} from '../src/guides.js';
import {INTENTS,ROUTES} from '../src/intents.js';
import {renderMarkdown,renderGuide,wordCount,imageSize,guidePage,guidesIndexPage,COPY} from '../tools/guides-build.mjs';
import {entry,ALL_ROUTES} from '../tools/build.mjs';
const LOCALES=['ko','en','ja'],origin='https://nerulio.example.test/';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const file=p=>new URL('../'+p,import.meta.url);
const jsonLD=out=>[...out.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;

test('the registry: unique slugs, every language, valid dates, sections, engines, tools and related guides',()=>{
 assert(GUIDES.length>=20,`at least 20 guides (${GUIDES.length})`);
 const slugs=new Set();
 for(const g of GUIDES){
  assert.match(g.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/,g.slug);assert(!slugs.has(g.slug),'duplicate slug '+g.slug);slugs.add(g.slug);
  assert(!ROUTES.includes(guidePath(g.slug)),'a guide route must not shadow a tool route');
  assert(validDate(g.updated),`${g.slug} updated ${g.updated}`);assert(g.updated<=new Date().toISOString().slice(0,10),`${g.slug} is dated in the future`);
  if(g.published)assert(validDate(g.published)&&g.published<=g.updated,g.slug);
  assert(GUIDE_SECTIONS.some(([s])=>s===g.section),`${g.slug} section ${g.section}`);
  assert(g.engines.length&&g.engines.every(e=>Object.hasOwn(GUIDE_ENGINES,e)),`${g.slug} engines`);
  assert(g.tools.length&&g.tools.every(id=>Object.hasOwn(INTENTS,id)),`${g.slug} tools ${g.tools}`);
  assert(g.related.length>=2&&g.related.every(s=>s!==g.slug&&GUIDES.some(x=>x.slug===s)),`${g.slug} related ${g.related}`);
  assert(g.open.ws?STUDIO_WORKSPACES.includes(g.open.ws):Object.hasOwn(INTENTS,g.open.tool),`${g.slug} open target`);
  assert(Array.isArray(g.tested),g.slug);
  for(const l of LOCALES){
   assert(g.title[l]?.length>=8,`${g.slug} ${l} title`);assert(g.description[l]?.length>=40,`${g.slug} ${l} description`);
   assert(g.title[l].length<=(l==='en'?75:48),`${g.slug} ${l} title is too long for a search result (${g.title[l].length})`);
   assert(g.description[l].length<=(l==='en'?170:125),`${g.slug} ${l} description is too long (${g.description[l].length})`);
  }
  assert.notEqual(g.title.ko,g.title.en);assert.notEqual(g.title.ja,g.title.en);
 }
 for(const l of LOCALES){const titles=GUIDES.map(g=>g.title[l]);assert.equal(new Set(titles).size,titles.length,`${l} titles are unique`);}
});
test('routes: the index and one route per guide, every language built, lastmod for the sitemap',()=>{
 assert.deepEqual(GUIDE_ROUTES,[GUIDE_INDEX,...GUIDES.map(g=>'guides/'+g.slug)]);
 for(const r of GUIDE_ROUTES){assert(isGuideRoute(r));assert(ALL_ROUTES.includes(r),r);for(const l of LOCALES)assert(ALL_ROUTES.includes(`${l}/${r}`),`${l}/${r}`);assert(validDate(guideLastmod(r)),r);}
 assert.equal(guideRoute('guides/does-not-exist'),null);assert.equal(guideRoute('guides').index,true);
 assert.equal(guideLastmod(GUIDE_INDEX),GUIDES.map(g=>g.updated).sort().at(-1));
});
test('every guide body: renders cleanly in ko/en/ja with the same structure, FAQ, sources and a Nerulio block',()=>{
 for(const g of GUIDES){
  const r=Object.fromEntries(LOCALES.map(l=>{assert(existsSync(file(`content/guides/${g.slug}/${l}.md`)),`${g.slug}/${l}.md`);return [l,renderGuide(g.slug,l)];}));
  for(const l of LOCALES){
   const x=r[l];assert.deepEqual(x.problems,[],`${g.slug}/${l}: ${x.problems.join('; ')}`);
   assert(x.intro.includes('<p>'),`${g.slug}/${l} starts with an intro paragraph`);
   assert(x.faq.length>=3&&x.faq.length<=8,`${g.slug}/${l} FAQ (${x.faq.length})`);
   assert(x.toc.some(t=>t.id==='sources'),`${g.slug}/${l} cites its sources`);
   assert(/href="https:\/\//.test(x.html.slice(x.html.indexOf('id="sources"'))),`${g.slug}/${l} sources are links`);
   assert.deepEqual(x.nerulio.target,g.open,`${g.slug}/${l} Nerulio block opens meta.open`);
   assert(!/\bAI\b/.test(x.nerulio.html),`${g.slug}/${l} Nerulio's heuristics are never called AI`);
  }
  for(const l of ['ko','ja']){
   assert.deepEqual(r[l].toc.map(t=>t.id),r.en.toc.map(t=>t.id),`${g.slug}/${l} has the same sections as en`);
   assert.equal(r[l].steps.length,r.en.steps.length,`${g.slug}/${l} has the same steps as en`);
   assert.deepEqual(r[l].images.map(i=>i.replace(/-(ko|en|ja)\.webp$/,'')),r.en.images.map(i=>i.replace(/-(ko|en|ja)\.webp$/,'')),`${g.slug}/${l} shows the same images`);
  }
  const words=wordCount(r.en.text,'en');assert(words>=900&&words<=2600,`${g.slug} en has ${words} words`);
  for(const l of ['ko','ja'])assert(wordCount(r[l].text,l)>=1400,`${g.slug}/${l} is a full rewrite, not a summary (${wordCount(r[l].text,l)} chars)`);
 }
});
test('images referenced by guides exist, have their real size in the markup and stay small',()=>{
 const seen=new Set();
 for(const g of GUIDES)for(const l of LOCALES)for(const img of renderGuide(g.slug,l).images)seen.add(img);
 for(const img of seen){const b=readFileSync(file(img));assert(b.length<400_000,`${img} is ${b.length} bytes`);const {width,height}=imageSize(file(img));assert(width>=300&&width<=2000&&height>=100,`${img} ${width}×${height}`);}
});
test('social cards exist for the index and every guide in every language (1200×630)',()=>{
 for(const l of LOCALES)for(const name of [`${l}-guides`,...GUIDES.map(g=>`${l}-guide-${g.slug}`)]){
  const p=file(`assets/social/${name}.png`);assert(existsSync(p),name);assert.deepEqual(imageSize(p),{width:1200,height:630},name);
 }
});
test('guide pages: one h1, canonical + hreflang, parseable Article/Breadcrumb/FAQ/HowTo data that matches the page',()=>{
 for(const g of GUIDES)for(const l of LOCALES){
  const out=entry(html,`${l}/guides/${g.slug}`,origin),r=renderGuide(g.slug,l);
  assert.equal((out.match(/<h1[\s>]/g)||[]).length,1,`${l}/${g.slug} h1`);
  assert(out.includes(`<link rel="canonical" href="${origin}${l}/guides/${g.slug}/">`),`${l}/${g.slug} canonical`);
  for(const a of LOCALES)assert(out.includes(`<link rel="alternate" hreflang="${a}" href="${origin}${a}/guides/${g.slug}/">`),`${l}/${g.slug} hreflang ${a}`);
  assert(out.includes(`<link rel="alternate" hreflang="x-default" href="${origin}guides/${g.slug}/">`));
  assert(out.includes(`<html lang="${l}"`)&&out.includes(`assets/social/${l}-guide-${g.slug}.png`)&&out.includes('name="twitter:card"'));
  assert(out.includes(`<time datetime="${g.updated}">`),'a visible Updated date');
  const data=jsonLD(out),type=t=>data.filter(d=>d['@type']===t);
  const [article]=type('Article');assert.equal(article.dateModified,g.updated);assert.equal(article.author.name,'Nerulio');assert.equal(article.headline,g.title[l]);assert.equal(article.inLanguage,l);
  assert.equal(type('BreadcrumbList')[0].itemListElement.length,3);
  const [faq]=type('FAQPage');assert.equal(faq.mainEntity.length,r.faq.length);
  for(const q of faq.mainEntity)assert(out.includes('>'+q.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')+'</h3>')||out.includes(q.name),`${l}/${g.slug} FAQ question is visible: ${q.name}`);
  const howto=type('HowTo');assert.equal(howto.length?howto[0].step.length:0,r.steps.length,'HowTo only for the visible steps');
  for(const s of howto[0]?.step||[])assert(out.includes(`id="${s.url.split('#')[1]}"`));
  const open=g.open.ws?`game/studio/?ws=${g.open.ws}`:INTENTS[g.open.tool].path+'/';assert(out.includes(`class="guide-open"`)&&out.includes(`href="${l}/${open}"`),`${l}/${g.slug} Nerulio button`);
 }
 // the language-neutral URL is the English page (x-default), canonical to /en/
 const neutral=entry(html,`guides/${GUIDES[0].slug}`,origin);
 assert(neutral.includes('data-neutral')&&neutral.includes(`<link rel="canonical" href="${origin}en/guides/${GUIDES[0].slug}/">`)&&neutral.includes('<html lang="en"'));
});
test('the index lists every guide by topic and by engine in every language',()=>{
 for(const l of LOCALES){
  const out=entry(html,`${l}/guides`,origin);
  assert.equal((out.match(/<h1[\s>]/g)||[]).length,1);assert(out.includes(`<link rel="canonical" href="${origin}${l}/guides/">`));
  for(const g of GUIDES)assert(out.includes(`href="${l}/guides/${g.slug}/"`),`${l} index links ${g.slug}`);
  for(const e of new Set(GUIDES.flatMap(g=>g.engines)))assert(out.includes(`id="engine-${e}"`),`${l} engine ${e}`);
  const data=jsonLD(out);assert.equal(data.find(d=>d['@type']==='CollectionPage').mainEntity.itemListElement.length,GUIDES.length);
  assert(out.includes(COPY[l].indexLead.slice(0,20)));
 }
});
test('markdown dialect: escaping, links, steps, callouts, tables, fences and the Nerulio block',()=>{
 const src=readFileSync(file('tests/fixtures/guides/sample.md'),'utf8');
 const slug=GUIDES[0].slug,x=renderMarkdown(src.replace('guide:sample-guide',`guide:${slug}`),{locale:'en',prefix:'en/',slug:'demo'});
 assert.deepEqual(x.problems,[]);
 assert(x.intro.includes(`<a href="en/guides/${slug}/#why">`)&&x.intro.includes('<a href="en/game/pixel-lab/">')&&x.intro.includes('rel="noopener"'));
 assert(x.html.includes('&lt;b&gt;not html&lt;/b&gt;')&&!x.html.includes('<b>not html'),'code is escaped');
 assert(x.html.includes('<a href="en/guides/demo/#why">'),'in-page anchors survive <base href>');
 assert.deepEqual(x.steps.map(s=>s.name),['Open Project Settings','Set the filter','Restart the scene']);
 assert.deepEqual(x.toc.map(t=>t.id),['short-fix','why','nerulio','faq','sources']);
 assert.equal(x.faq.length,2);assert.equal(x.faq[0].a,"Check the node's own texture_filter property.");
 assert(x.html.includes('<td>Mipmaps | none</td>')&&x.html.includes('style="text-align:right"'));
 assert(x.html.includes('class="guide-open" data-studio-ws="sprite" href="en/game/studio/?ws=sprite"'));
 assert(x.html.includes('<li>Two with <code>code</code> and <strong>bold</strong> continued line</li>'));
 const bad=renderMarkdown('## No id\n\n[x](guide:nope) [y](tool:nope)\n\n![a](shot:nope)\n\n:::nerulio ws=nope\nx\n:::\n',{locale:'en',prefix:'',slug:'demo'});
 for(const p of ['## heading without {#id}','unknown guide link','unknown tool link','missing screenshot','unknown workspace'])assert(bad.problems.some(x=>x.startsWith(p)),p);
 assert.equal(wordCount('Hello, world — 2D pixel-art!','en'),4);assert.equal(wordCount('도트 흐림, 해결!','ko'),6);
});
test('pages render without a site URL (preview builds) and mark previews noindex',()=>{
 const g=GUIDES[0],page=guidePage({slug:g.slug,locale:'ko',base:'../../../'}),index=guidesIndexPage({locale:'ja',base:'../../',config:{preview:true}});
 assert(!page.includes('rel="canonical"')&&page.includes('<h1>'));assert(index.includes('noindex'));
});
