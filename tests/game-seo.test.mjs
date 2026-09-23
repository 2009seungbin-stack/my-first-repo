import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {GAME_INTENT_PAGES,GAME_KEYWORD_PAGES,SHOTS,SPRITE_EXPORTS,TILE_EXPORTS,WORKSPACES,COMMON_FAQ,HUB,UI,classicPath} from '../src/game-seo.js';
import {CAPABILITIES,mayPromote,qualifies} from '../src/capabilities.js';
import {INTENTS,ALIASES,intentFor} from '../src/intents.js';
import {LANDINGS} from '../src/landings.js';
import {TARGETS} from '../src/game/export/targets.js';
import {VERIFY} from '../src/studio/workspaces/tile/verify-status.js';
import {entry,sitemap,ALL_ROUTES} from '../tools/build.mjs';
import {gamePageFor,gameSitemapPaths} from '../tools/game-landing-build.mjs';
import {socialStem} from '../tools/game-seo-build.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),origin='https://nerulio.example.test/';
const L=['ko','en','ja'],pages=[...Object.entries(GAME_INTENT_PAGES),...Object.entries(GAME_KEYWORD_PAGES)];

test('every game page has complete ko/en/ja copy of useful length',()=>{
 for(const [key,p] of pages)for(const l of L){
  const c=p.copy[l];assert(c,`${key} ${l}`);
  assert(c.title.length>=8&&c.title.length<=80,`${key} ${l} title`);assert(c.description.length>=40&&c.description.length<=230,`${key} ${l} description ${c.description.length}`);
  assert(c.lead.length>=40,`${key} ${l} lead`);assert(c.what.length>=3&&c.steps.length>=3&&c.faq.length>=2,`${key} ${l} sections`);
  assert.equal(c.what.length,p.copy.en.what.length,`${key} ${l} what parity`);assert.equal(c.steps.length,p.copy.en.steps.length,`${key} ${l} steps parity`);
  assert(SHOTS[p.shot]&&WORKSPACES[p.ws],key);
  if(p.classic)assert(p.classic[l],`${key} ${l} classic reason`);
 }
 for(const l of L){assert(HUB[l].title&&HUB[l].description);for(const k of Object.keys(UI))assert(UI[k]==='Nerulio'||UI[k][l],`UI ${k} ${l}`);for(const q of COMMON_FAQ)assert(q[l].length===2);}
});
test('the verification labels shown on the pages are the ones the Studio itself uses',()=>{
 const map={verified:'verified',built:'parsed',decoded:'decoded',unverified:'unverified'};
 for(const r of SPRITE_EXPORTS){const t=TARGETS[r.id];assert(t,r.id);assert.equal(map[r.status],t.verify,r.id);if(r.id==='gif')assert.equal(TARGETS.apng.verify,'decoded');}
 for(const r of TILE_EXPORTS)assert.equal(r.status==='partial'?'partial':r.status,VERIFY[r.id].status,r.id);
 assert.equal(SPRITE_EXPORTS.find(r=>r.id==='gamemaker').status,'unverified','GameMaker was never loaded in GameMaker');
});
test('Studio-backed intents qualify only on evidence that names a real check in both browsers',()=>{
 const suite=readFileSync(new URL('./game-landing-browser.py',import.meta.url),'utf8');
 for(const id of Object.keys(GAME_INTENT_PAGES)){
  const c=CAPABILITIES[id];assert(qualifies(c.evidence),id);assert(mayPromote(id),id);assert.equal(c.maturity,'advanced',id);
  const browser=c.evidence.filter(e=>e.suite==='tests/game-landing-browser.py');
  assert(browser.some(e=>e.kind==='workflow')&&browser.some(e=>e.kind==='quality'),id);
  for(const e of browser){assert.deepEqual([...e.engines],['chromium','firefox'],id);assert(suite.includes(`'${e.check.replaceAll("'","\\'")}'`),`${id}: check not in the suite: ${e.check}`);}
  for(const e of c.evidence.filter(e=>e.kind==='engine')){assert.deepEqual([...e.engines],['chromium'],'engine runs drove the UI in Chromium only');assert(existsSync(new URL('../'+e.doc,import.meta.url)),e.doc);}
  assert(c.studio?.workspace===GAME_INTENT_PAGES[id].ws,id);
 }
 for(const id of ['pixel-lab','texture-lab','ui-lab','tile-helper','seamless-tile-checker'])assert.equal(mayPromote(id),false,`${id} is not in the Studio yet and has no evidence`);
});
test('landings, classic pages and keyword pages: routes, canonicals and robots',()=>{
 for(const [id,p] of Object.entries(GAME_INTENT_PAGES)){
  const path=INTENTS[id].path,classic=classicPath(path);
  assert.equal(gamePageFor(path)?.key,id);assert.equal(intentFor(classic),id);assert(ALL_ROUTES.includes(`ja/${classic}`));
  const land=entry(html,`ko/${path}`,origin),old=entry(html,`ko/${classic}`,origin);
  assert(land.includes(`rel="canonical" href="${origin}ko/${path}/"`)&&!land.includes('noindex'),id);
  assert(land.includes('"@type":"SoftwareApplication"')&&land.includes('"applicationCategory":"DeveloperApplication"')&&land.includes('"price":"0"'),id);
  assert(land.includes(`assets/social/ko-${id}.png`)&&land.includes('game/studio/?ws='),id);
  assert.equal(land.includes('data-gl-classic'),!!p.classic,id);
  assert(old.includes('data-classic-robots name="robots" content="noindex,follow"')&&old.includes('id="taskApp"'),id);
 }
 for(const [path,p] of Object.entries(GAME_KEYWORD_PAGES)){
  assert(LANDINGS[path]?.studio===p&&GAME_INTENT_PAGES[p.intent],path);assert.equal(intentFor(path),p.intent);
  const h=entry(html,`ja/${path}`,origin);assert(h.includes(`rel="canonical" href="${origin}ja/${path}/"`)&&!h.includes('noindex'),path);
  assert(h.includes(`assets/social/ja-${socialStem(gamePageFor(path))}.png`),path);
 }
 const hub=entry(html,'en/game',origin);assert(hub.includes(`rel="canonical" href="${origin}en/game/"`)&&!hub.includes('noindex'));
 for(const [key] of pages)assert(hub.includes(`href="en/${INTENTS[key]?.path||key}/"`),`hub links ${key}`);
});
test('screenshots and social cards exist with their stated sizes',()=>{
 for(const s of Object.values(SHOTS))for(const f of [s.file,s.file+'-780']){const b=readFileSync(new URL(`../assets/studio/${f}.webp`,import.meta.url));assert.equal(b.toString('ascii',8,12),'WEBP',f);}
 for(const stem of ['game',...pages.map(([k])=>socialStem(gamePageFor(INTENTS[k]?.path||k)))])for(const l of L){
  const png=readFileSync(new URL(`../assets/social/${l}-${stem}.png`,import.meta.url));assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
 }
});
test('sitemap: home, then every game page, then the file tools',()=>{
 const locs=[...sitemap(origin).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].slice(origin.length));
 const game=new Set(gameSitemapPaths().filter(p=>p==='game'||gamePageFor(p)||mayPromote(intentFor(p)))),at=p=>locs.indexOf(`en/${p}/`);
 assert.deepEqual(locs.slice(0,3),['ko/','en/','ja/']);
 const lastGame=Math.max(...[...game].map(at)),firstFile=Math.min(...['image/compress','pdf/split','video/to-gif'].map(at));
 assert(lastGame>0&&lastGame<firstFile,'game pages come before the file tools');
 for(const [key] of pages)assert(at(INTENTS[key]?.path||key)>0,key);
});
