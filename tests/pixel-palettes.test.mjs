import test from 'node:test';
import assert from 'node:assert/strict';
import {PALETTES,PALETTE_LABELS,PALETTE_GROUPS,paletteLabel,paletteOptions,paletteSwatches} from '../src/pixel-palettes.js';
import {parsePalette} from '../src/pixel-engine.js';

const SIZES={gameboy:4,pico8:16,sweetie16:16,endesga32:32,nes:53,mono:2,gray4:4,nokia3310:2,cga16:16,ega64:64,c64:16,zxspectrum:15,db16:16,db32:32,arne16:16,slso8:8,nyx8:8,oil6:6,ammo8:8,kirokaze:4,icecream:4,ayy4:4};

test('every built-in palette is a list of unique lowercase #rrggbb colours of the documented size',()=>{
 assert.deepEqual(Object.keys(PALETTES).sort(),Object.keys(SIZES).sort());
 for(const [key,colors] of Object.entries(PALETTES)){
  assert.equal(colors.length,SIZES[key],key);
  for(const c of colors)assert.match(c,/^#[0-9a-f]{6}$/,`${key} ${c}`);
  assert.equal(new Set(colors).size,colors.length,`${key} has duplicates`);
  assert.equal(parsePalette(colors.join('\n')).length,colors.length,`${key} survives the converter's parser`);
 }
});

test('hardware palettes carry their known colour values',()=>{
 // IBM CGA/EGA text colours: 0xAA primaries, the famous brown, then the 0x55-lifted bright row.
 assert.deepEqual(PALETTES.cga16.slice(0,8),['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#aa5500','#aaaaaa']);
 assert.deepEqual(PALETTES.cga16.slice(8),['#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff']);
 // EGA: two bits per channel, so exactly the 4×4×4 lattice, which contains all of CGA 16.
 const levels=new Set(['00','55','aa','ff']);
 for(const c of PALETTES.ega64)for(const i of [1,3,5])assert.ok(levels.has(c.slice(i,i+2)),c);
 assert.equal(PALETTES.ega64[0],'#000000');assert.equal(PALETTES.ega64[63],'#ffffff');
 for(const c of PALETTES.cga16)assert.ok(PALETTES.ega64.includes(c),c);
 // Commodore 64 (Pepto's measured VIC-II colours).
 assert.deepEqual(PALETTES.c64.slice(2,8),['#68372b','#70a4b2','#6f3d86','#588d43','#352879','#b8c76f']);
 // ZX Spectrum: eight 0xD7 colours plus seven bright 0xFF ones (bright black is still black).
 assert.deepEqual(PALETTES.zxspectrum.slice(0,8),['#000000','#0000d7','#d70000','#d700d7','#00d700','#00d7d7','#d7d700','#d7d7d7']);
 assert.deepEqual(PALETTES.zxspectrum.slice(8),['#0000ff','#ff0000','#ff00ff','#00ff00','#00ffff','#ffff00','#ffffff']);
 assert.deepEqual(PALETTES.gray4,['#000000','#555555','#aaaaaa','#ffffff']);
 assert.deepEqual(PALETTES.nokia3310,['#43523d','#c7f0d8']);
});

test('community palettes carry their published colour values',()=>{
 assert.deepEqual(PALETTES.db16,['#140c1c','#442434','#30346d','#4e4a4e','#854c30','#346524','#d04648','#757161','#597dce','#d27d2c','#8595a1','#6daa2c','#d2aa99','#6dc2ca','#dad45e','#deeed6']);
 assert.deepEqual(PALETTES.db32.slice(0,8),['#000000','#222034','#45283c','#663931','#8f563b','#df7126','#d9a066','#eec39a']);
 assert.deepEqual(PALETTES.db32.slice(-4),['#d95763','#d77bba','#8f974a','#8a6f30']);
 assert.deepEqual(PALETTES.arne16.slice(3,9),['#be2633','#e06f8b','#493c2b','#a46422','#eb8931','#f7e26b']);
 assert.deepEqual(PALETTES.slso8,['#0d2b45','#203c56','#544e68','#8d697a','#d08159','#ffaa5e','#ffd4a3','#ffecd6']);
 assert.deepEqual(PALETTES.oil6,['#fbf5ef','#f2d3ab','#c69fa5','#8b6d9c','#494d7e','#272744']);
 assert.deepEqual(PALETTES.kirokaze,['#332c50','#46878f','#94e344','#e2f3e4']);
 assert.deepEqual(PALETTES.icecream,['#7c3f58','#eb6b6f','#f9a875','#fff6d3']);
 assert.deepEqual(PALETTES.ayy4,['#00303b','#ff7777','#ffce96','#f1f2da']);
 // The palettes that shipped before stay byte-identical.
 assert.deepEqual(PALETTES.gameboy,['#0f380f','#306230','#8bac0f','#9bbc0f']);
 assert.equal(PALETTES.pico8[8],'#ff004d');assert.equal(PALETTES.sweetie16[0],'#1a1c2c');
});

test('labels and menu groups cover every palette exactly once, in every tool language',()=>{
 const grouped=PALETTE_GROUPS.flatMap(g=>g.keys);
 assert.deepEqual([...grouped].sort(),Object.keys(PALETTES).sort());
 assert.equal(new Set(grouped).size,grouped.length);
 assert.deepEqual(Object.keys(PALETTE_LABELS).sort(),Object.keys(PALETTES).sort());
 for(const locale of ['ko','en','ja']){
  for(const g of PALETTE_GROUPS)assert.ok(g.label[locale],`${g.id} ${locale}`);
  for(const key of Object.keys(PALETTES))assert.ok(paletteLabel(key,locale).length>1,`${key} ${locale}`);
 }
 assert.equal(paletteLabel('gray4','ko'),'2비트 회색조');assert.equal(paletteLabel('gray4','ja'),'2ビット グレースケール');
 assert.equal(paletteLabel('c64','ja'),'Commodore 64');assert.equal(paletteLabel('gray4','fr'),'2-bit grayscale');
 assert.equal(paletteLabel('nope'),'nope');
});

test('paletteOptions renders grouped, escaped options and marks only the current palette',()=>{
 const html=paletteOptions('db32','en');
 assert.equal((html.match(/<optgroup /g)||[]).length,2);
 assert.ok(html.includes('<optgroup label="Consoles &amp; computers">'));
 assert.equal((html.match(/<option /g)||[]).length,Object.keys(PALETTES).length);
 assert.equal((html.match(/ selected/g)||[]).length,1);
 assert.ok(html.includes('<option value="db32" selected>DawnBringer 32 (32)</option>'));
 assert.ok(paletteOptions('','ko').includes('label="게임기 · 컴퓨터"'));
 assert.ok(paletteOptions('','ja').includes('label="コミュニティパレット"'));
 assert.ok(!paletteOptions('','ko').includes(' selected'));
 assert.ok(paletteOptions('','xx').includes('Community palettes'));
});

test('paletteSwatches emits one chip per colour and nothing for an unknown key',()=>{
 const html=paletteSwatches('gameboy');
 assert.equal((html.match(/class="plab-chip"/g)||[]).length,4);
 assert.ok(html.includes('style="--c:#0f380f" title="#0f380f"'));
 assert.equal(paletteSwatches('custom'),'');assert.equal(paletteSwatches('auto'),'');
});
