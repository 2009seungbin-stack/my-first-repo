/** Search-metadata audit of every indexable page, rendered by the build functions (not a stale dist/).
 * Each sitemap page in en, ko and ja must carry a title and description, a self canonical that og:url
 * repeats, reciprocal hreflang with x-default, Open Graph title and description, exactly one <h1>,
 * JSON-LD that parses, a breadcrumb whose every level is a page of the build and ends on the page
 * itself, and FAQ questions that the page really shows.
 *
 *   node --test tests/seo-audit.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entry,ALL_ROUTES} from '../tools/build.mjs';
import {sitemapGroups} from '../tools/sitemaps.mjs';
import {GAME_HUB_CRUMB,toolTrail,breadcrumbData,navigationData,standaloneMetadata} from '../src/seo.js';
import {UI} from '../src/game-seo.js';
import {BRAND} from '../src/brand.js';

const L=['en','ko','ja'],origin='https://nerulio.example.test/';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const groups=sitemapGroups(),PATHS=[...new Set([...groups.game,...groups.tools])];
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attr=(tag,name)=>{const m=tag.match(new RegExp(`\\s${name}="([^"]*)"`));return m?decode(m[1]):null;};
const urlOf=(l,p)=>`${origin}${l}/${p?p+'/':''}`;
/** What a crawler reads from one page. */
function facts(page){
 const head=page.slice(0,page.indexOf('</head>')),metas=[...head.matchAll(/<meta\b[^>]*>/g)].map(m=>m[0]),links=[...head.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]);
 const meta=(key,value)=>metas.filter(t=>attr(t,key)===value).map(t=>attr(t,'content'));
 return {
  title:decode((head.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||''),
  description:meta('name','description'),robots:meta('name','robots').join(','),
  canonical:links.filter(t=>attr(t,'rel')==='canonical').map(t=>attr(t,'href')),
  hreflang:links.filter(t=>attr(t,'rel')==='alternate'&&attr(t,'hreflang')).map(t=>[attr(t,'hreflang'),attr(t,'href')]),
  og:Object.fromEntries(metas.filter(t=>attr(t,'property')).map(t=>[attr(t,'property'),attr(t,'content')])),
  h1:[...page.matchAll(/<h1\b/g)].length,
  ld:[...page.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]),
  visible:page.slice(page.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g,' ')
 };
}
const PAGES=new Map(L.flatMap(l=>PATHS.map(p=>[urlOf(l,p),{l,p,f:facts(entry(html,p?`${l}/${p}`:l,origin,{}))}])));
const BUILT=new Set(ALL_ROUTES.map(r=>`${origin}${r?r+'/':''}`));
const nodes=raw=>{const d=JSON.parse(raw);return Array.isArray(d)?d:d['@graph']||[d];};

test('every sitemap page is indexable with a title, one description, a self canonical and one h1',()=>{
 assert(PAGES.size>=480,`only ${PAGES.size} pages rendered`);
 for(const [url,{l,f}] of PAGES){
  assert(!/noindex/.test(f.robots),`${url}: listed in the sitemap but noindex`);
  assert(f.title.trim().length>=8&&f.title.includes(BRAND.name),`${url}: title "${f.title}"`);
  assert.equal(f.description.length,1,`${url}: ${f.description.length} meta descriptions`);
  assert(f.description[0].trim().length>=(l==='en'?40:15),`${url}: description too short to describe the page "${f.description[0]}"`);
  assert.deepEqual(f.canonical,[url],`${url}: canonical`);
  assert.equal(f.h1,1,`${url}: ${f.h1} <h1>`);
 }
});
test('titles are unique within a language',()=>{
 for(const l of L){
  const seen=new Map();
  for(const [url,{l:pl,f}] of PAGES)if(pl===l)seen.set(f.title,[...(seen.get(f.title)||[]),url]);
  assert.deepEqual([...seen].filter(([,u])=>u.length>1).map(([t,u])=>`${t}: ${u.join(' ')}`),[],`[${l}] duplicate titles`);
 }
});
test('hreflang names ko, en, ja and x-default, includes the page itself and is returned by every target',()=>{
 for(const [url,{f}] of PAGES){
  assert.deepEqual(f.hreflang.map(([l])=>l).sort(),['en','ja','ko','x-default'],`${url}: hreflang languages`);
  assert(f.hreflang.some(([,h])=>h===url),`${url}: hreflang without itself`);
  for(const [l,h] of f.hreflang){
   const target=PAGES.get(h);
   if(!target){assert(l==='x-default'&&BUILT.has(h),`${url}: hreflang ${l} → ${h} is not a page of the build`);continue;}
   assert(target.f.hreflang.some(([,back])=>back===url),`${url}: ${h} does not link back`);
   if(l!=='x-default')assert.equal(target.l,l,`${url}: hreflang ${l} points at a ${target.l} page`);
  }
 }
});
test('Open Graph: title, description and og:url equal to the canonical on every page',()=>{
 for(const [url,{f}] of PAGES){
  assert(f.og['og:title'],`${url}: no og:title`);
  assert(f.og['og:description'],`${url}: no og:description`);
  assert.equal(f.og['og:url'],url,`${url}: og:url`);
 }
});
test('JSON-LD parses, breadcrumbs walk real pages down to the page itself, FAQ questions are on the page',()=>{
 let crumbs=0,faq=0;
 for(const [url,{p,f}] of PAGES){
  for(const raw of f.ld){
   let list;assert.doesNotThrow(()=>{list=nodes(raw);},`${url}: JSON-LD does not parse`);
   assert(!raw.includes('</'),`${url}: unescaped markup in JSON-LD`);
   for(const n of list){
    assert(n['@type'],`${url}: JSON-LD node without @type`);
    if(n['@type']==='BreadcrumbList'){
     crumbs++;const items=n.itemListElement;
     assert(items.length>=2,`${url}: breadcrumb with ${items.length} level`);
     items.forEach((x,i)=>{
      assert.equal(x.position,i+1,`${url}: breadcrumb positions`);
      assert(String(x.name||'').trim(),`${url}: breadcrumb level ${i+1} has no name`);
      assert(BUILT.has(x.item),`${url}: breadcrumb level ${x.item} is not a page of the build`);
     });
     assert.equal(items.at(-1).item,url,`${url}: breadcrumb does not end on the page`);
     assert.equal(new Set(items.map(x=>x.item)).size,items.length,`${url}: breadcrumb repeats a level`);
     if(p.startsWith('game/'))assert.equal(items[1].item,urlOf(url.slice(origin.length,origin.length+2),'game'),`${url}: a page under /game/ whose breadcrumb skips the game hub`);
    }
    if(n['@type']==='FAQPage')for(const q of n.mainEntity){
     faq++;
     assert(q.acceptedAnswer?.text,`${url}: FAQ question without an answer`);
     assert(decode(f.visible).includes(q.name),`${url}: FAQ question not shown on the page: ${q.name}`);
    }
   }
  }
 }
 assert(crumbs>=400&&faq>=400,`breadcrumbs ${crumbs}, FAQ questions ${faq}`);
});
test('every page under /game/ has a breadcrumb through the game hub, in the language of the page',()=>{
 for(const [url,{l,p,f}] of PAGES){
  if(!p.startsWith('game/'))continue;
  const list=f.ld.flatMap(nodes).filter(n=>n['@type']==='BreadcrumbList');
  assert.equal(list.length,1,`${url}: ${list.length} breadcrumbs`);
  assert.deepEqual(list[0].itemListElement.slice(0,2).map(x=>x.name),[BRAND.name,UI.hub[l]],url);
 }
});
test('breadcrumb helpers: hub name pinned to the game hub, trail and JSON-LD shape',()=>{
 for(const l of L)assert.equal(GAME_HUB_CRUMB.name[l],UI.hub[l],`hub name [${l}]`);
 assert.deepEqual(toolTrail('game/store-art-pack','Store Art Pack','en'),[[BRAND.name,''],['Game studio','game'],['Store Art Pack','game/store-art-pack']]);
 assert.deepEqual(toolTrail('image/compress','Compress image','en'),[[BRAND.name,''],['Compress image','image/compress']]);
 assert.deepEqual(toolTrail('gamepad-tester','x','ko'),[[BRAND.name,''],['x','gamepad-tester']],'only a /game/ path segment counts');
 assert.equal(breadcrumbData(toolTrail('game/x','X','ja'),'ja',''),'','no site URL, no absolute URLs to state');
 assert.equal(breadcrumbData([[BRAND.name,'']],'en',origin),'','a single level is not a trail');
 const ld=JSON.parse(breadcrumbData(toolTrail('game/x','A </script> B','ja'),'ja',origin).match(/>(.*)<\/script>$/)[1]);
 assert.deepEqual(ld.itemListElement.map(x=>[x.position,x.name,x.item]),[[1,BRAND.name,`${origin}ja/`],[2,'ゲームスタジオ',`${origin}ja/game/`],[3,'A </script> B',`${origin}ja/game/x/`]]);
 const nav=JSON.parse(navigationData('store-art-pack','ko',origin).match(/>(.*)<\/script>$/)[1]);
 assert.deepEqual(nav.itemListElement.map(x=>x.item),[`${origin}ko/`,`${origin}ko/game/`,`${origin}ko/game/store-art-pack/`]);
 assert.equal(navigationData('home','en',origin),'');
 const head=standaloneMetadata({path:'game/sfx-generator',title:'A "quoted" <tool>',description:'Made & saved locally.',locale:'en',siteURL:origin});
 assert(head.includes('<meta property="og:title" content="A &quot;quoted&quot; &lt;tool&gt; · Nerulio">')&&head.includes('<meta property="og:description" content="Made &amp; saved locally.">'),'escaped Open Graph');
 assert(head.includes('name="twitter:card"')&&head.includes('"@type":"BreadcrumbList"'));
});
test('no orphans: every sitemap page is linked from another page; the avatar maker and the store art pack from two or more',()=>{
 const inbound=new Map();
 for(const [url,{f}] of PAGES)for(const m of f.visible.matchAll(/<a\b[^>]*\shref="([^"#?]+)[^"]*"/g)){
  // Every page sets <base href> to the site root, so a relative link resolves against the origin.
  let target;try{target=new URL(decode(m[1]),origin).href;}catch{continue;}
  if(!target.endsWith('/'))target+='/';
  if(target!==url&&PAGES.has(target))inbound.set(target,(inbound.get(target)||new Set()).add(url));
 }
 for(const [url,{l,p}] of PAGES){
  const from=[...(inbound.get(url)||[])];
  assert(from.length>=1,`${url}: no other page links to it`);
  if(p)assert(from.some(u=>PAGES.get(u).l===l),`${url}: not linked from any ${l} page`);
 }
 for(const l of L)for(const p of ['game/pixel-avatar-maker','game/store-art-pack'])assert(inbound.get(urlOf(l,p)).size>=2,`${urlOf(l,p)}: linked from ${inbound.get(urlOf(l,p)).size} page`);
});
