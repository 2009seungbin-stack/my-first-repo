import test from 'node:test';
import assert from 'node:assert/strict';
import {INTENTS} from '../src/intents.js';
import {LANDINGS} from '../src/landings.js';
import {HUB_GROUPS} from '../src/game-seo.js';
import {contentHash} from '../tools/lastmod.mjs';
import {gameGroups,gameNeighbors,gamePageFor,gameLandingPage,PAGER_UI} from '../tools/game-landing-build.mjs';

const routeOf=key=>INTENTS[key]?INTENTS[key].path:key;
const all=Object.values(gameGroups()).flat();

test('gameNeighbors: one chain through every game page, both directions agree',()=>{
 assert.ok(all.length>50);
 assert.equal(new Set(all).size,all.length,'a page is in one group only');
 const first=all.filter(k=>!gameNeighbors(k).prev),last=all.filter(k=>!gameNeighbors(k).next);
 assert.equal(first.length,1);assert.equal(last.length,1);
 const seen=[];
 for(let k=first[0];k;k=gameNeighbors(k).next){
  assert.ok(!seen.includes(k),`loop at ${k}`);seen.push(k);
  const n=gameNeighbors(k);
  assert.notEqual(n.prev,k);assert.notEqual(n.next,k);
  if(n.next)assert.equal(gameNeighbors(n.next).prev,k,`${k} → ${n.next} → back`);
  assert.ok(gameGroups()[n.group].includes(k));
  assert.equal(n.size,gameGroups()[n.group].length);
 }
 assert.equal(seen.length,all.length,'walking "next" from the first page visits every page');
 assert.equal(gameNeighbors('no/such-page'),null);
});
test('every landing ends with previous / group / next links that exist',()=>{
 for(const key of all){
  const game=gamePageFor(routeOf(key));assert.ok(game,key);
  const n=gameNeighbors(game.key);assert.ok(n,`${key}: the page is on the hub`);
  for(const locale of ['en','ko','ja']){
   const prefix=locale+'/',html=gameLandingPage({game,locale,prefix,base:'/',headHTML:''});
   const nav=html.match(/<nav class="gl-pager" data-chrome aria-label="([^"]+)">([\s\S]*?)<\/nav>/);
   assert.ok(nav,`${locale} ${key}: pager`);
   assert.equal(nav[1],PAGER_UI.label[locale]);
   const hrefs=[...nav[2].matchAll(/<a class="gl-pager-step (is-\w+)" href="([^"]+)"/g)].map(m=>[m[1],m[2]]);
   const want=[...(n.prev?[['is-prev',`${prefix}${routeOf(n.prev)}/`]]:[]),['is-group',`${prefix}game/#hub-${n.group}`],...(n.next?[['is-next',`${prefix}${routeOf(n.next)}/`]]:[])];
   assert.deepEqual(hrefs,want,`${locale} ${key}`);
   for(const [,href] of hrefs.filter(([c])=>c!=='is-group')){const p=href.slice(prefix.length,-1);assert.ok(Object.values(INTENTS).some(i=>i.path===p)||LANDINGS[p],`${href} is a page`);}
   assert.ok(HUB_GROUPS[n.group][locale]&&nav[2].includes('<b>'),`${locale} ${key}: labels`);
  }
 }
});
test('the pager is chrome: it does not change the dated content of a page',()=>{
 const game=gamePageFor(routeOf(all[3])),html=gameLandingPage({game,locale:'en',prefix:'en/',base:'/',headHTML:''});
 const without=html.replace(/<nav class="gl-pager"[\s\S]*?<\/nav>/,'');
 assert.notEqual(without,html);
 assert.equal(contentHash(html),contentHash(without));
});
