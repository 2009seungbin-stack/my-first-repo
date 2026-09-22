import test from 'node:test';import assert from 'node:assert/strict';
import {parseColor,relativeLuminance,contrastRatio,flatten,wcag,round2} from '../src/game/contrast.js';
test('colours are read in every notation the pickers produce',()=>{
 assert.deepEqual(parseColor('#fff'),[255,255,255,1]);
 assert.deepEqual(parseColor('3182f6'),[49,130,246,1]);
 assert.deepEqual(parseColor('#00000080'),[0,0,0,128/255]);
 assert.deepEqual(parseColor([1,2,3]),[1,2,3,1]);
 assert.throws(()=>parseColor('blue'),/#rgb/);
});
test('relative luminance and the contrast ratio are the published formulas',()=>{
 assert.equal(relativeLuminance('#000000'),0);
 assert.equal(relativeLuminance('#ffffff'),1);
 assert.equal(contrastRatio('#000000','#ffffff'),21);
 assert.equal(contrastRatio('#ffffff','#000000'),21,'order does not matter');
 assert.equal(contrastRatio('#3182f6','#3182f6'),1);
 // WCAG's own example: #767676 is the darkest grey that still reaches 4.5:1 on white.
 assert.equal(round2(contrastRatio('#767676','#ffffff')),4.54);
 assert.equal(round2(contrastRatio('#ffffff','#3182f6')),3.71);
});
test('a translucent colour is judged by what it composites to',()=>{
 assert.deepEqual(flatten('#00000080','#ffffff').slice(0,3).map(Math.round),[127,127,127]);
 assert.equal(contrastRatio('#000000ff','#ffffff'),21);
 assert(contrastRatio('#00000080','#ffffff')<21);
});
test('WCAG text thresholds, including the large-text exception',()=>{
 assert.deepEqual(wcag(4.6,{fontSizePx:16}),{large:false,aa:true,aaa:false,ui:true,needed:{aa:4.5,aaa:7}});
 assert.equal(wcag(3.1,{fontSizePx:24}).aa,true);
 assert.equal(wcag(3.1,{fontSizePx:19,bold:true}).large,true);
 assert.equal(wcag(3.1,{fontSizePx:19}).aa,false);
 assert.equal(wcag(21,{fontSizePx:12}).aaa,true);
});
