import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANDINGS,LANDING_PATHS,landingText} from '../src/landings.js';
import {INTENTS,intentFor,intentDefaults,ROUTES,ALIASES} from '../src/intents.js';
import {mayPromote} from '../src/capabilities.js';
import {entry,sitemap,ALL_ROUTES} from '../tools/build.mjs';
import {toolContent} from '../src/content.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),origin='https://nerulio.example.test/';

test('every landing is a real tool with a real preset and complete ko/en/ja copy',()=>{
 assert(LANDING_PATHS.length>=30);
 for(const p of LANDING_PATHS){
  const l=LANDINGS[p];assert(INTENTS[l.intent],p);
  assert.equal(intentFor(p),l.intent,p);assert(ROUTES.includes(p)&&!Object.hasOwn(ALIASES,p)&&!Object.values(INTENTS).some(i=>i.path===p),p);
  for(const locale of ['ko','en','ja']){const t=landingText(p,locale);for(const k of ['title','headline','description'])assert(t[k]&&t[k].length>3,`${p} ${locale} ${k}`);assert(t.intro.length>=2,`${p} ${locale} intro`);}
 }
 assert.equal(intentDefaults('convert','image/png-to-jpg').format,'jpeg');
 assert.equal(intentDefaults('convert','image/png-to-jpg','?format=webp').format,'webp','the URL still wins');
 assert.equal(intentDefaults('compress','image/compress-to-1mb').kb,1000);
 const yt=intentDefaults('resize','image/resize/youtube-thumbnail');assert.deepEqual([yt.width,yt.height,yt.fit],[1280,720,'cover']);
 assert.equal(intentDefaults('heic','image/heic-to-png').format,'png');
 assert.equal(intentDefaults('compress','image/heic-to-png').kb,500,'a preset only applies to its own tool');
});
test('no two indexable pages share a title or description in any language',()=>{
 for(const locale of ['ko','en','ja']){
  const seen=new Map();
  for(const route of ROUTES.filter(r=>!Object.hasOwn(ALIASES,r))){
   const out=entry(html,`${locale}/${route}`,origin);if(out.includes('noindex'))continue;
   for(const [,v] of [out.match(/<title>([^<]*)/),out.match(/<meta name="description" content="([^"]*)/)]){assert(!seen.has(v),`${locale}/${route} duplicates ${seen.get(v)}: ${v}`);seen.set(v,route);}
  }
 }
});
test('landing pages: self canonical, inherit the base tool indexing decision, appear in sitemap only when indexable',()=>{
 const xml=sitemap(origin);
 for(const p of LANDING_PATHS){
  const out=entry(html,`ja/${p}`,origin),indexable=mayPromote(LANDINGS[p].intent);
  assert(out.includes(`rel="canonical" href="${origin}ja/${p}/"`),p);
  assert.equal(out.includes('noindex'),!indexable,p);
  assert.equal(xml.includes(`<loc>${origin}ko/${p}/</loc>`),indexable,p);
  assert(out.includes(`<title>${landingText(p,'ja').title} · `),p);
 }
 assert(LANDING_PATHS.filter(p=>mayPromote(LANDINGS[p].intent)).length>=20,'most landings are for qualified tools');
});
test('base tool pages link to their tasks and every link resolves',()=>{
 const content=toolContent('compress','en');
 for(const p of LANDING_PATHS.filter(p=>LANDINGS[p].intent==='compress'))assert(content.includes(`href="en/${p}/"`),p);
 for(const p of LANDING_PATHS)assert(ALL_ROUTES.includes(`ko/${p}`)&&ALL_ROUTES.includes(p),p);
});
