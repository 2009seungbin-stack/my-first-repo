import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BRAND} from '../src/brand.js';
import {LOCALES} from '../src/i18n.js';
import {entry,ALL_ROUTES} from '../tools/build.mjs';
import {LOGO_PATH,SITE_ALTERNATE_NAMES} from '../src/seo.js';
/** The brand query ("nerulio"): Google's site name comes from WebSite data on the home page at the
 * site root, the knowledge panel logo from Organization data, and every hreflang target must be a
 * canonical URL. Internal engine/maturity labels must never reach structured data. */
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),origin='https://nerulio.pages.dev/';
const ld=h=>[...h.matchAll(/<script data-site-seo type="application\/ld\+json">(.*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
const attr=(h,re)=>(h.match(re)||[])[1];

test('home: WebSite + Organization + SoftwareApplication named Nerulio, in every language and at /',()=>{
 for(const route of ['',...LOCALES]){
  const h=entry(html,route,origin),nodes=ld(h),by=t=>nodes.find(n=>n['@type']===t);
  const site=by('WebSite'),org=by('Organization'),app=by('SoftwareApplication');
  assert(site&&org&&app,route);
  assert.equal(site.name,BRAND.name);assert.deepEqual(site.alternateName,[...SITE_ALTERNATE_NAMES]);assert.equal(site.url,origin,'WebSite url is the site root');
  assert.equal(site.inLanguage,route||'en');assert.equal(site.publisher['@id'],org['@id']);
  assert.equal(org.name,BRAND.name);assert.equal(org.url,origin);assert.equal(org.logo.url,origin+LOGO_PATH);
  const png=readFileSync(new URL('../'+LOGO_PATH,import.meta.url));
  assert.equal(png.readUInt32BE(16),org.logo.width);assert.equal(png.readUInt32BE(20),org.logo.height);assert(org.logo.width>=112&&org.logo.width===org.logo.height,'square logo, at least 112 px');
  assert.equal(app.name,BRAND.name);assert.equal(app.applicationCategory,'DeveloperApplication');assert.deepEqual(app.offers,{'@type':'Offer',price:'0',priceCurrency:'USD'});
  assert(app.featureList.length>=5&&app.featureList.some(f=>/Godot/.test(f)),route);
  assert.equal(app.url,route?`${origin}${route}/`:origin);
 }
});
test('the brand name is in the title, the first paragraph, og:site_name and application-name of the home page',()=>{
 for(const route of ['',...LOCALES]){
  const h=entry(html,route,origin);
  assert(attr(h,/<title>([^<]*)<\/title>/).startsWith(BRAND.name),route);
  assert(attr(h,/<p class="page-lead" id="taskLead">([^<]*)</).startsWith(BRAND.name),`${route}: the lead starts with the brand`);
  assert(attr(h,/<meta name="description" content="([^"]*)"/).includes(BRAND.name),route);
  assert.equal(attr(h,/property="og:site_name" content="([^"]*)"/),BRAND.name);assert.equal(attr(h,/name="application-name" content="([^"]*)"/),BRAND.name);
 }
});
test('/ is its own canonical and the x-default of the home cluster; elsewhere x-default is the English page',()=>{
 const root=entry(html,'',origin),en=entry(html,'en',origin);
 assert.equal(attr(root,/rel="canonical" href="([^"]+)"/),origin);assert.equal(attr(root,/property="og:url" content="([^"]+)"/),origin);
 assert.equal(attr(en,/rel="canonical" href="([^"]+)"/),origin+'en/');
 for(const h of [root,en])assert.equal(attr(h,/hreflang="x-default" href="([^"]+)"/),origin);
 const canonicalOf=new Map();
 for(const route of ALL_ROUTES){const c=attr(entry(html,route,origin),/rel="canonical" href="([^"]+)"/);if(c)canonicalOf.set(origin+(route?route+'/':''),c);}
 let checked=0;
 for(const route of ALL_ROUTES.filter(r=>/^(ko|en|ja)(\/|$)/.test(r))){
  const h=entry(html,route,origin);if(/noindex/.test(h))continue;
  for(const [,href] of h.matchAll(/rel="alternate" hreflang="[\w-]+" href="([^"]+)"/g)){assert.equal(canonicalOf.get(href),href,`${route}: hreflang target ${href} is not its own canonical`);checked++;}
 }
 assert(checked>1000,`${checked} hreflang links checked`);
});
test('no page leaks internal labels into structured data',()=>{
 for(const route of ALL_ROUTES){
  const data=JSON.stringify(ld(entry(html,route,origin)));
  assert(!/Maturity:|local browser dispatch|"UtilitiesApplication"/.test(data),route);
  for(const n of ld(entry(html,route,origin)).filter(n=>n.featureList))assert(n.featureList.every(f=>typeof f==='string'&&f.length>2&&!/^(basic|advanced|prototype)$/.test(f)),route);
 }
});
