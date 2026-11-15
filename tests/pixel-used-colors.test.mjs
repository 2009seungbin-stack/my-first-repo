import test from 'node:test';
import assert from 'node:assert/strict';
import {usedColors,parsePalette} from '../src/pixel-engine.js';
import {toGPL,toHexText,parsePaletteFile} from '../src/game/palette.js';

const px=(...pixels)=>Uint8ClampedArray.from(pixels.flat());
const RED=[255,0,0,255],GREEN=[0,255,0,255],BLUE=[0,0,255,255],CLEAR=[9,9,9,0];

test('usedColors lists distinct opaque colours, most used first, ties in first-seen order',()=>{
 assert.deepEqual(usedColors(px(RED,GREEN,GREEN,BLUE,GREEN,BLUE)),[[0,255,0],[0,0,255],[255,0,0]]);
 assert.deepEqual(usedColors(px(BLUE,RED,GREEN)),[[0,0,255],[255,0,0],[0,255,0]]);
 assert.deepEqual(usedColors(px(RED,RED,RED)),[[255,0,0]]);
});

test('usedColors ignores transparent pixels and premultiplied translucent edges',()=>{
 // A half-transparent red read back from a canvas can come out as 254: it must not add a colour.
 assert.deepEqual(usedColors(px(CLEAR,RED,[254,0,0,128],[254,0,0,128],[254,0,0,128])),[[255,0,0]]);
 assert.deepEqual(usedColors(px(CLEAR,CLEAR)),[]);
 assert.deepEqual(usedColors(new Uint8ClampedArray(0)),[]);
 // A sprite with no fully opaque pixel still gets its colours.
 assert.deepEqual(usedColors(px(CLEAR,[10,20,30,128],[10,20,30,40],[1,2,3,200])),[[10,20,30],[1,2,3]]);
});

test('usedColors stops at the requested number of colours',()=>{
 const many=px(...Array.from({length:300},(_,i)=>[i&255,i>>8,7,255]));
 assert.equal(usedColors(many).length,256);
 assert.deepEqual(usedColors(px(RED,GREEN,GREEN,BLUE),2),[[0,255,0],[255,0,0]]);
});

test('the saved palette files load back to the same colours',()=>{
 const colors=usedColors(px(RED,GREEN,GREEN,BLUE,[15,56,15,255]));
 assert.equal(toHexText(colors),'#00ff00\n#ff0000\n#0000ff\n#0f380f\n');
 assert.deepEqual(parsePalette(toHexText(colors)),colors);
 const gpl=toGPL(colors,{name:'hero',columns:4});
 assert.ok(gpl.startsWith('GIMP Palette\nName: hero\nColumns: 4\n'));
 assert.deepEqual(parsePalette(gpl),colors);
 assert.deepEqual(parsePaletteFile(gpl,'hero-palette.gpl').colors,colors);
});

test('a palette file loaded into the custom box reads as the same colours in the converter',()=>{
 // The quick converter writes parsePaletteFile(...) into its textarea with toHexText and then
 // parses that text with parsePalette, so the three must agree for every supported file type.
 const expected=[[15,56,15],[48,98,48],[139,172,15],[155,188,15]];
 const files={
  'gb.hex':'0f380f\n306230\n8bac0f\n9bbc0f\n',
  'gb.txt':'#0F380F\n#306230\n#8BAC0F\n#9BBC0F',
  'gb.gpl':'GIMP Palette\nName: Game Boy\nColumns: 4\n#\n 15  56  15\tdarkest\n 48  98  48\tdark\n139 172  15\tlight\n155 188  15\tlightest\n',
  'gb.json':JSON.stringify({name:'gb',colors:['#0f380f','#306230','#8bac0f','#9bbc0f']})
 };
 for(const [name,body] of Object.entries(files)){
  const parsed=parsePaletteFile(body,name);
  assert.deepEqual(parsed.colors,expected,name);
  assert.deepEqual(parsePalette(toHexText(parsed.colors).trim()),expected,name);
 }
 assert.throws(()=>parsePaletteFile('not a palette at all','bad.txt'));
});
