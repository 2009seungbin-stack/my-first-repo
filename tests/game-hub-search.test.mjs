import test from 'node:test';
import assert from 'node:assert/strict';
import {fold,tokensOf,matchesQuery,matchesChip,chipById,cardText,filterCards,readState,writeState,HUB_CHIPS} from '../src/game-hub-search.js';
import {gameHubPage,gameGroups,hubChipCounts,HUB_SEARCH_UI} from '../tools/game-landing-build.mjs';

test('fold: case, width and spacing do not matter',()=>{
 assert.equal(fold('  Godot   ４  TileSet '),'godot 4 tileset');
 assert.equal(fold('ＰＮＧ'),'png');
 assert.equal(fold(null),'');
 assert.deepEqual(tokensOf('  Sprite   SHEET '),['sprite','sheet']);
});
test('matchesQuery: every word must be in the card, an empty query matches',()=>{
 const text=cardText('Aseprite to Godot','Export SpriteFrames from an .aseprite file','game/aseprite-to-godot');
 assert.ok(matchesQuery(text,''));
 assert.ok(matchesQuery(text,'godot ASEPRITE'));
 assert.ok(matchesQuery(text,'aseprite-to-godot'),'the URL slug is searchable as written');
 assert.ok(matchesQuery(text,'aseprite to godot'),'and as words');
 assert.ok(!matchesQuery(text,'godot unity'));
});
test('chips: any term matches, unknown chips filter nothing',()=>{
 assert.ok(matchesChip(fold('타일셋 자르기'),chipById('tile')));
 assert.ok(matchesChip(fold('タイルセットを分割'),chipById('tile')));
 assert.ok(!matchesChip(fold('Sprite sheet packer'),chipById('tile')));
 assert.equal(chipById('nope'),null);
 assert.ok(matchesChip('anything',null));
 for(const c of HUB_CHIPS){
  assert.match(c.id,/^[a-z]+$/);
  for(const l of ['en','ko','ja'])assert.ok(c.label[l],`${c.id} label ${l}`);
  for(const w of [...c.terms,...(c.not||[])])assert.equal(w,fold(w),`${c.id}: term "${w}" must be folded text`);
 }
 assert.equal(new Set(HUB_CHIPS.map(c=>c.id)).size,HUB_CHIPS.length);
});
test('chips: a term inside another word or name does not count',()=>{
 // TexturePacker is an atlas format, not a texture page.
 const packer=cardText('TexturePacker to Godot 4','Open a TexturePacker JSON atlas and its PNG','game/texturepacker-to-godot');
 assert.ok(!matchesChip(packer,chipById('texture')));
 assert.ok(matchesChip(packer,chipById('godot')));
 assert.ok(matchesChip(cardText('Seamless texture checker','','game/seamless-tile-checker'),chipById('texture')));
 assert.ok(matchesChip(cardText('Normal map for a TexturePacker atlas','','x'),chipById('texture')),'another term still matches');
 // "tiled" as an adjective is not the Tiled editor.
 assert.ok(!matchesChip(fold('check the wrap test, see it tiled 3×3'),chipById('tiled')));
 assert.ok(matchesChip(fold('Exports for Godot and Tiled'),chipById('tiled')));
 // 스타일 / スタイル (style) and a lone 타일 / タイル are not a tileset page.
 assert.ok(!matchesChip(fold('픽셀 아트 스타일 변환'),chipById('tile')));
 assert.ok(!matchesChip(fold('ドット絵スタイルに変換'),chipById('tile')));
 assert.ok(!matchesChip(fold('任意サイズで引き伸ばし・タイルのプレビュー'),chipById('tile')));
 assert.ok(matchesChip(fold('오토타일 47개 생성'),chipById('tile')));
 assert.ok(matchesChip(fold('オートタイルを作る'),chipById('tile')));
});
test('filterCards: query and chip combine',()=>{
 const texts=[cardText('Godot tileset','','a'),cardText('Unity tileset','','b'),cardText('Godot sprite sheet','','c')];
 assert.deepEqual(filterCards(texts),[0,1,2]);
 assert.deepEqual(filterCards(texts,{q:'tileset'}),[0,1]);
 assert.deepEqual(filterCards(texts,{chip:'godot'}),[0,2]);
 assert.deepEqual(filterCards(texts,{q:'tileset',chip:'godot'}),[0]);
 assert.deepEqual(filterCards(texts,{q:'zzz'}),[]);
});
test('URL state: round trip, other parameters kept, junk dropped',()=>{
 assert.deepEqual(readState('?q=%20godot%20&f=tile'),{q:'godot',chip:'tile'});
 assert.deepEqual(readState('?f=evil'),{q:'',chip:''});
 assert.deepEqual(readState(''),{q:'',chip:''});
 assert.equal(readState('?q='+'x'.repeat(200)).q.length,80);
 assert.equal(writeState('',{q:'',chip:''}),'');
 assert.equal(writeState('?utm=1&q=old&f=unity',{q:' sprite sheet ',chip:'godot'}),'?utm=1&q=sprite+sheet&f=godot');
 assert.equal(writeState('?q=old',{q:'',chip:'nope'}),'');
 const s={q:'타일셋 godot',chip:'tile'};
 assert.deepEqual(readState(writeState('',s)),s);
});
test('hub markup: one card per game page, chip counts are what the filter shows',()=>{
 const total=Object.values(gameGroups()).flat().length;
 for(const locale of ['en','ko','ja']){
  const html=gameHubPage({locale,prefix:locale+'/',base:'/',headHTML:''});
  const cards=[...html.matchAll(/<li data-path="([^"]+)"><a href="[^"]+"><b>([\s\S]*?)<\/b><small>([\s\S]*?)<\/small>/g)];
  assert.ok(cards.length>=total,`${locale}: ${cards.length} cards for ${total} game pages`);
  const plain=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  const texts=cards.map(m=>cardText(plain(m[2]),plain(m[3]),m[1]));
  const chips=[...html.matchAll(/data-gl-hub-chip="([a-z]+)" aria-pressed="false">[^<]*<small>(\d+)<\/small>/g)];
  assert.ok(chips.length>=6,`${locale}: ${chips.length} chips`);
  assert.deepEqual(chips.map(m=>[m[1],+m[2]]),hubChipCounts(texts).map(x=>[x.chip.id,x.count]),locale);
  for(const [,id,n] of chips)assert.equal(filterCards(texts,{chip:id}).length,+n,`${locale} ${id}`);
  // The block is chrome (not dated content), starts hidden (the script shows it) and has no <form>.
  assert.match(html,/<div class="gl-hub-search" data-chrome data-gl-hub-search [^>]*hidden>/);
  assert.ok(!/<form\b/.test(html));
  const groupCounts=[...html.matchAll(/<h2 data-count="(\d+)">/g)].reduce((a,m)=>a+ +m[1],0);
  assert.equal(groupCounts,cards.length,`${locale}: group counts add up`);
  for(const k of Object.keys(HUB_SEARCH_UI))assert.ok(HUB_SEARCH_UI[k][locale],`${k} ${locale}`);
 }
});
