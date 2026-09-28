import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBdf} from '../src/game/font-bdf.js';

test('two real CC0 BDFs import their glyph count, baseline, pixels and advances',()=>{
 for(const filename of ['sq.bdf','sqb.bdf']){
  const font=parseBdf(readFileSync(new URL(`./fixtures/font-maker/${filename}`,import.meta.url),'utf8'));
  assert.equal(font.glyphs.length,192);assert.equal(font.ascent,12);assert.equal(font.descent,3);
  const a=font.glyphs.find(g=>g.codepoint===65),space=font.glyphs.find(g=>g.codepoint===32);
  assert.deepEqual([a.w,a.h,a.xOffset,a.yOffset,a.xAdvance],[7,13,0,2,7]);
  assert.equal(a.mask.length,91);assert(a.mask.reduce((sum,v)=>sum+v,0)>10);
  assert.equal(space.xAdvance,7);
 }
});

test('BDF reports malformed rows with a line number and rejects inconsistent glyph counts',()=>{
 const good=`STARTFONT 2.1\nFONT Demo\nFONTBOUNDINGBOX 8 8 0 0\nSTARTPROPERTIES 2\nFONT_ASCENT 8\nFONT_DESCENT 0\nENDPROPERTIES\nCHARS 1\nSTARTCHAR A\nENCODING 65\nDWIDTH 8 0\nBBX 8 1 0 0\nBITMAP\n80\nENDCHAR\nENDFONT\n`;
 const font=parseBdf(good);assert.equal(font.glyphs[0].mask[0],1);assert.equal(font.glyphs[0].mask[1],0);
 assert.throws(()=>parseBdf(good.replace('80\n','GG\n')),/BDF line 14: BITMAP row/);
 assert.throws(()=>parseBdf(good.replace('CHARS 1','CHARS 2')),/CHARS count/);
});
