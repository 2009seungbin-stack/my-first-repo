import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hangulParts,composeHangul,ksX1001Hangul,isKsX1001Hangul,kanaSet,estimateGlyphAtlas} from '../src/game/font-hangul.js';

test('Unicode modern Hangul decomposition and composition are a full 11,172-way bijection',()=>{
 for(let cp=0xac00;cp<=0xd7a3;cp++){
  const {leading,vowel,trailing}=hangulParts(cp);
  assert.equal(composeHangul(leading,vowel,trailing),cp);
 }
 assert.deepEqual(hangulParts(0xac00),{leading:0,vowel:0,trailing:0});
 assert.deepEqual(hangulParts(0xac01),{leading:0,vowel:0,trailing:1});
 assert.equal(composeHangul(18,20,27),0xd7a3);
 assert.throws(()=>hangulParts(0xd7a4),/Not a modern/);
});

test('KS X 1001 repertoire has the pinned 2,350 members from Unicode Technical Note 60 v2',()=>{
 const codes=ksX1001Hangul();assert.equal(codes.length,2350);
 assert.equal(new Set(codes).size,2350);assert(codes.every(isKsX1001Hangul));
 assert(isKsX1001Hangul(0xac00));assert(!isKsX1001Hangul(0xac02));
 const ordered=String.fromCodePoint(...codes);
 assert.equal(createHash('sha256').update(ordered).digest('hex'),'a2ad322f6152c68feff8c74f85063e9d754c22df425fb8433a389af6ab76f074');
});

test('kana is explicit and large atlas estimates block one-page claims',()=>{
 assert.equal(kanaSet().length,86+90);
 assert.equal(estimateGlyphAtlas(2350,16,16).onePageFits,true);
 const full=estimateGlyphAtlas(11172,32,32,{maxSide:2048,maxPixels:4_194_304});
 assert.equal(full.onePageFits,false);assert(full.minimumPages>1);
});
