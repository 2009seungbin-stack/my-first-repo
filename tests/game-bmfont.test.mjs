import test from 'node:test';import assert from 'node:assert/strict';
import {charset,occurrences,missingCharacters,extractText,glyphBounds,gridFont,measuredFont,fntText,parseFnt,fntCodepoints,fontFromFnt,layoutLine,PRESETS,FORMAT} from '../src/game/bmfont.js';
const ink=(w,h,cells)=>{const d=new Uint8ClampedArray(w*h*4);for(const [x0,y0,x1,y1] of cells)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)d.set([255,255,255,255],(y*w+x)*4);return d;};
test('character sets come from the text, never from a whole script',()=>{
 assert.deepEqual(PRESETS,['text','ascii','latin1','ko','ja']);
 const ascii=charset('','ascii');assert.equal(ascii.length,95);assert.equal(ascii[0],' ');assert.equal(ascii.at(-1),'~');
 assert.equal(charset('','latin1').length,191);
 const mixed='Play 시작 スタート!';
 assert.deepEqual(charset(mixed,'ko'),['시','작']);
 assert.deepEqual(charset(mixed,'ja'),['ス','タ','ト','ー']);// sorted by codepoint, so U+30FC is last
 assert.equal(charset('','ko').length,0,'an empty text yields no Hangul at all');
 assert.deepEqual(charset('bab\n','text'),['a','b']);
 assert.throws(()=>charset('','all'),/preset/);
});
test('occurrences and missing glyphs report counts and where they are used',()=>{
 const counts=occurrences('ab\nba b');
 assert.deepEqual([counts.get('a').count,counts.get('a').lines],[2,[1,2]]);
 const missing=missingCharacters('시작 Play 시작',new Set([...'Play '].map(c=>c.codePointAt(0))));
 assert.deepEqual(missing.map(m=>[m.char,m.count]),[['시',2],['작',2]]);
 assert.deepEqual(missing[0].lines,[1]);
 assert.equal(missingCharacters('  \n ',new Set()).length,0,'whitespace is not a missing glyph');
});
test('localisation files are unwrapped to the text they ship',()=>{
 assert.equal(extractText('ui.json',JSON.stringify({a:'Start',b:{c:['시작','Quit']},n:3})),'Start\n시작\nQuit');
 assert.throws(()=>extractText('ui.json','{oops'),/parsed/);
 assert.equal(extractText('ui.po','msgid "start"\nmsgstr "시작"\n\nmsgid "quit"\nmsgstr "종료"\n'),'시작\n종료');
 assert.equal(extractText('ui.csv','key,en,ko\nstart,"Start, now",시작'),'key en ko\nstart Start, now 시작');
 assert.equal(extractText('notes.txt','raw'),'raw');
});
test('a fixed grid font keeps the exact Unicode glyph coordinates it always had',()=>{
 const f=gridFont({width:16,height:8,cellW:8,cellH:8,chars:'Aあ',baseline:6});
 assert.equal(f.format,FORMAT);assert.equal(f.mode,'grid');
 assert.deepEqual(f.glyphs.map(g=>[g.codepoint,g.x,g.y,g.w,g.h,g.xAdvance]),[[65,0,0,8,8,8],[12354,8,0,8,8,8]]);
 assert.deepEqual([f.lineHeight,f.baseline,f.width,f.height],[8,6,16,8]);
 assert.throws(()=>gridFont({width:16,height:8,cellW:8,cellH:8,chars:'AA'}),/unique/);
 assert.throws(()=>gridFont({width:16,height:8,cellW:8,cellH:8,chars:'ABC'}),/fit the grid/);
 // A sheet may end in a strip narrower than a cell (a 128px sheet of 18 glyphs 7px wide, as
 // OpenGameArt's oldschool charmap is): the grid is whole cells, the strip is ignored.
 assert.deepEqual(gridFont({width:9,height:8,cellW:8,cellH:8,chars:'A'}).glyphs.map(g=>[g.x,g.w]),[[0,8]]);
 assert.throws(()=>gridFont({width:9,height:8,cellW:8,cellH:8,chars:'AB'}),/fit the grid/);
 assert.throws(()=>gridFont({width:6,height:8,cellW:8,cellH:8,chars:'A'}),/larger than the sheet/);
 assert.throws(()=>gridFont({width:16,height:8,cellW:8,cellH:8,chars:'A',baseline:9}),/baseline/);
});
test('a measured font takes its advances from the alpha of each cell',()=>{
 // cell 0 has ink in columns 2..4 rows 1..6; cell 1 is empty; cell 2 is full width.
 const data=ink(24,8,[[2,1,4,6],[16,0,23,7]]);
 assert.deepEqual(glyphBounds(data,24,8,{x:0,y:0,w:8,h:8}),{x:2,y:1,w:3,h:6});
 assert.equal(glyphBounds(data,24,8,{x:8,y:0,w:8,h:8}),null);
 const f=measuredFont({data,width:24,height:8,cellW:8,cellH:8,chars:'i l',baseline:7,spacing:1});
 assert.deepEqual(f.glyphs.map(g=>[g.char,g.x,g.y,g.w,g.h,g.xOffset,g.yOffset,g.xAdvance]),
  [['i',2,1,3,6,2,1,6],[' ',8,0,0,0,0,0,3],['l',16,0,8,8,0,0,9]]);
 assert.equal(layoutLine(f,'il').width,15);
 assert.equal(layoutLine(f,'iX').items[1].missing,true);
 // A real advance is known when the glyph came from a font file; an empty cell still moves the pen.
 const real=measuredFont({data,width:24,height:8,cellW:8,cellH:8,chars:'i l',baseline:7,spacing:1,
  advances:new Map([['i',3.4],[' ',4.2],['l',7.6]])});
 assert.deepEqual(real.glyphs.map(g=>g.xAdvance),[4,5,9]);
});
test('the BMFont text we write is the BMFont text we can read back',()=>{
 const font=gridFont({width:32,height:16,cellW:8,cellH:8,chars:'Aあ漢z',baseline:6,image:'ui-font.png',face:'Nerulio Test'});
 const parsed=parseFnt(fntText(font));
 assert.equal(parsed.info.face,'Nerulio Test');assert.equal(parsed.info.size,8);assert.equal(parsed.info.unicode,1);
 assert.deepEqual([parsed.common.lineHeight,parsed.common.base,parsed.common.scaleW,parsed.common.scaleH,parsed.common.pages],[8,6,32,16,1]);
 assert.equal(parsed.pages[0],'ui-font.png');
 assert.equal(parsed.chars.length,4);
 assert.deepEqual(parsed.chars.map(c=>[c.id,c.x,c.y,c.width,c.height,c.xadvance,c.page,c.chnl]),
  font.glyphs.map(g=>[g.codepoint,g.x,g.y,g.w,g.h,g.xAdvance,0,15]));
 assert.deepEqual([...fntCodepoints(parsed)],[65,12354,28450,122]);
 const back=fontFromFnt(parsed);
 assert.deepEqual(back.glyphs,font.glyphs.map(g=>({...g})));
 assert(fntText(font).includes('char id=12354 x=8 y=0 width=8 height=8'));
 assert(fntText(font).endsWith('kernings count=0\n'));
 assert.throws(()=>parseFnt('info face="x"'),/char records/);
});
