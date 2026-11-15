import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeIndex,progressOf,snippetText} from '../src/game-landing-read.js';
import {GAME_INTENT_PAGES} from '../src/game-seo.js';
import {gamePageFor,gameLandingPage} from '../tools/game-landing-build.mjs';
import {INTENTS} from '../src/intents.js';

test('activeIndex: the last section whose top passed the reading line',()=>{
 assert.equal(activeIndex([],100),-1);
 assert.equal(activeIndex([400,900,1500],100),-1,'above the first section');
 assert.equal(activeIndex([100,900,1500],100),0,'exactly on the line counts');
 assert.equal(activeIndex([-600,-20,700],100),1);
 assert.equal(activeIndex([-900,-500,-100],100),2);
 assert.equal(activeIndex([-600,300,500],100,true),2,'at the end of the page the last section is read');
 assert.equal(activeIndex([-600,Infinity,90],100),2,'a hidden section (no box) is never the one being read');
});
test('progressOf: clamped 0…1 between the start and end of the reading part',()=>{
 assert.equal(progressOf(0,500,2500),0);
 assert.equal(progressOf(500,500,2500),0);
 assert.equal(progressOf(1500,500,2500),0.5);
 assert.equal(progressOf(2500,500,2500),1);
 assert.equal(progressOf(9999,500,2500),1);
 assert.equal(progressOf(100,500,400),0,'a reading part shorter than the window: nothing before it…');
 assert.equal(progressOf(600,500,400),1,'…and done once it is reached');
});
test('snippetText: what the copy button puts on the clipboard',()=>{
 assert.equal(snippetText('a = 1  \r\nb = 2\t\n\n'),'a = 1\nb = 2');
 assert.equal(snippetText('\n  indented stays\n'),'  indented stays');
 assert.equal(snippetText(null),'');
});
test('every "On this page" link of a landing points at a section of that page',()=>{
 const id=Object.keys(GAME_INTENT_PAGES)[0],game=gamePageFor(INTENTS[id].path);
 for(const locale of ['en','ko','ja']){
  const html=gameLandingPage({game,locale,prefix:locale+'/',base:'/',headHTML:''});
  const toc=html.match(/<nav class="gl-toc"[^>]*>([\s\S]*?)<\/nav>/)[1],ids=[...toc.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]);
  assert.ok(ids.length>=5,`${locale}: ${ids.length} sections`);
  for(const x of ids)assert.ok(html.includes(` id="${x}"`),`${locale}: #${x}`);
 }
});
test('the reading aids honour reduced motion and keep 44 px targets',()=>{
 const css=readFileSync(new URL('../src/game-landing.css',import.meta.url),'utf8'),js=readFileSync(new URL('../src/game-landing.js',import.meta.url),'utf8');
 assert.match(js,/prefers-reduced-motion: reduce/);
 assert.match(css,/\.gl-copy\{[^}]*min-height:44px/);
 assert.match(css,/\.gl-top\{[^}]*width:48px;height:48px/);
 assert.match(css,/\.gl-toc:not\(\.gl-hub-nav\) a\{[^}]*line-height:44px/);
});
