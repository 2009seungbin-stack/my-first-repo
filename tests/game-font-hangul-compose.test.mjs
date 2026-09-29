import test from 'node:test';
import assert from 'node:assert/strict';
import {composeHangulMask,vowelLayout,blankHangulTemplates,hangulTemplateSlot,paintHangulTemplate,missingHangulTemplates,validateHangulTemplates} from '../src/game/font-hangul-compose.js';
import {blankFontProject,validateFontProject,applyHangulComposition} from '../src/game/font-project.js';

const one=index=>Array.from({length:16},(_,at)=>at===index?1:0);
const templates={width:4,height:4,leading:Array.from({length:19},()=>({})),vowel:Array.from({length:21},()=>({})),trailing:Array.from({length:28},()=>({}))};
templates.leading[0]['vertical-open']=one(0);
templates.leading[0]['vertical-final']=one(1);
templates.vowel[0].open=one(4);
templates.vowel[0].final=one(5);
templates.trailing[1].vertical=one(15);
templates.leading[18]['vertical-final']=one(2);
templates.vowel[20].final=one(6);
templates.trailing[27].vertical=one(14);

test('vowel classification chooses positional variants',()=>{
 assert.equal(vowelLayout(0),'vertical');
 assert.equal(vowelLayout(8),'horizontal');
 assert.equal(vowelLayout(9),'mixed');
 assert.equal(vowelLayout(20),'vertical');
 assert.deepEqual([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(vowelLayout).reduce((a,v)=>(a[v]=(a[v]||0)+1,a),{}),
  {vertical:9,horizontal:5,mixed:7});
});

test('open/final and corner syllables use separate hand-drawn mask slots',()=>{
 const ga=composeHangulMask(0xac00,templates),gak=composeHangulMask(0xac01,templates),hih=composeHangulMask(0xd7a3,templates);
 assert.deepEqual(ga.pixels.map((v,i)=>v?i:null).filter(v=>v!==null),[0,4]);
 assert.deepEqual(gak.pixels.map((v,i)=>v?i:null).filter(v=>v!==null),[1,5,15]);
 assert.deepEqual(hih.pixels.map((v,i)=>v?i:null).filter(v=>v!==null),[2,6,14]);
 assert.equal(gak.collisions,0);
 assert.throws(()=>composeHangulMask(0xac1c,templates),/Invalid.*component mask/);
 const override=composeHangulMask(0xac00,templates,{override:one(8)});
 assert.deepEqual(override.pixels,one(8));assert(override.overridden);
});

test('an editable template kit selects position variants and survives project validation',()=>{
 const kit=blankHangulTemplates(8,8);
 assert.deepEqual(hangulTemplateSlot(0xac00,'leading'),{part:'leading',index:0,key:'vertical-open'});
 assert.deepEqual(hangulTemplateSlot(0xac01,'leading'),{part:'leading',index:0,key:'vertical-final'});
 assert.deepEqual(missingHangulTemplates(kit,0xac00),['leading','vowel']);
 paintHangulTemplate(kit,0xac00,'leading',0,1,1);
 paintHangulTemplate(kit,0xac00,'vowel',5,2,1);
 assert.deepEqual(missingHangulTemplates(kit,0xac00),[]);
 assert.deepEqual(missingHangulTemplates(kit,0xac01),['leading','vowel','trailing']);
 const made=composeHangulMask(0xac00,kit);
 assert.deepEqual(made.pixels.flatMap((value,i)=>value?[i]:[]),[8,21]);
 const project=blankFontProject('A');project.hangulTemplates=kit;
 assert.equal(validateFontProject(structuredClone(project)).hangulTemplates.width,8);
 const original=structuredClone(project.glyphs[0]);
 const applied=applyHangulComposition(project,0xac00);
 assert.equal(applied.collisions,0);
 assert.deepEqual(project.glyphs[0],original);
 assert.deepEqual(project.glyphs.at(-1).pixels.flatMap((value,i)=>value?[i]:[]),[8,21]);
 assert.equal(project.glyphs.at(-1).codepoint,0xac00);
 paintHangulTemplate(kit,0xac00,'vowel',0,1,1);
 assert.equal(applyHangulComposition(project,0xac00).collisions,1);
 assert.equal(project.glyphs.length,2);
 assert.throws(()=>paintHangulTemplate(kit,0xac00,'trailing',1,1,1),/no trailing/);
 kit.leading[0]['vertical-open'][0]=2;
 assert.throws(()=>validateHangulTemplates(kit),/Invalid Hangul template/);
});

test('overlap status counts unique cells when three components touch the same pixel',()=>{
 const kit=blankHangulTemplates(2,2);
 for(const part of ['leading','vowel','trailing'])paintHangulTemplate(kit,0xac01,part,0,0,1);
 const made=composeHangulMask(0xac01,kit);
 assert.equal(made.collisions,1);
 assert.deepEqual(made.pixels,[1,0,0,0]);
});
