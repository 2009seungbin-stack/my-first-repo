import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {siteHeader,MENU_LABEL} from '../tools/game-chrome.mjs';
import {gameHubPage,gamePageFor,gameLandingPage} from '../tools/game-landing-build.mjs';
import {GAME_INTENT_PAGES} from '../src/game-seo.js';
import {INTENTS} from '../src/intents.js';

const links=[{href:'en/game/',label:'All game tools',attrs:{'aria-current':'page'}},{href:'en/',label:'All <tools>'}],studio={href:'en/game/studio/',label:'Studio'};
test('siteHeader: no phone menu unless asked (the home keeps its header)',()=>{
 const html=siteHeader({locale:'en',prefix:'en/',links,studio});
 assert.ok(!html.includes('gs-menu'));
 assert.equal((html.match(/<nav /g)||[]).length,1);
});
test('siteHeader({menu:true}): the same links again in a labelled <details> menu',()=>{
 for(const locale of ['en','ko','ja']){
  const html=siteHeader({locale,prefix:locale+'/',links,studio,menu:true});
  const nav=html.match(/<nav class="gs-nav"[^>]*>([\s\S]*?)<\/nav>/)[1],m=html.match(/<details class="gs-menu"><summary aria-label="([^"]+)">[\s\S]*?<\/summary><nav class="gs-menu-panel" aria-label="([^"]+)">([\s\S]*?)<\/nav><\/details>/);
  assert.ok(m,locale);
  assert.equal(m[1],MENU_LABEL[locale]);assert.equal(m[2],MENU_LABEL[locale]);
  assert.equal(m[3],nav,'the menu lists exactly the centre navigation');
  assert.ok(m[3].includes('All &lt;tools&gt;')&&m[3].includes('aria-current="page"'));
 }
 assert.ok(!siteHeader({locale:'en',prefix:'en/',links:[],studio,menu:true}).includes('gs-menu'),'no empty menu');
});
test('the hub and every landing carry the menu; the hub marks itself as the current page',()=>{
 const game=gamePageFor(INTENTS[Object.keys(GAME_INTENT_PAGES)[0]].path);
 for(const locale of ['en','ko','ja']){
  const o={locale,prefix:locale+'/',base:'/',headHTML:''},hub=gameHubPage(o),page=gameLandingPage({game,...o});
  for(const html of [hub,page])assert.match(html,new RegExp(`<details class="gs-menu"><summary aria-label="${MENU_LABEL[locale]}">`));
  assert.match(hub,new RegExp(`<a href="${locale}/game/" aria-current="page">`));
  assert.ok(!new RegExp(`<a href="${locale}/game/" aria-current="page">`).test(page));
 }
});
test('the menu is a phone control: hidden on desktop, 44 px targets',()=>{
 const css=readFileSync(new URL('../src/game-site.css',import.meta.url),'utf8');
 assert.match(css,/\.gs-menu\{display:none\}/);
 assert.match(css,/@media \(max-width:900px\)\{\n \.gs-nav\{display:none\}\n \.gs-menu\{display:block\}/);
 assert.match(css,/\.gs-menu summary\{[^}]*width:44px;height:44px/);
 assert.match(css,/\.gs-menu-panel a\{[^}]*min-height:44px/);
});
