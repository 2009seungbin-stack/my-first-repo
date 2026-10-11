import test from 'node:test';
import assert from 'node:assert/strict';
import {RECIPE_SCHEMA,OPS,OP_PARAMS,FIT_SPECS,PRESETS,validateRecipe,summarize,summaryLine,defaultStep,presetBySlug,presetById,RECIPE_MAX_BYTES} from '../platform/recipe.js';

const base=steps=>({schema:RECIPE_SCHEMA,source:{generator:'chatgpt',prompt:'귀여운 고양이 이모티콘 6×4',ai:true},input:{expect:'sheet'},steps});

test('the op list is exactly the contract §4 catalogue',()=>{
 assert.deepEqual([...OPS],['bg.remove','sheet.split','crop','upscale','fit','pixelize','palette','pixel.snap','sticker.border','caption','motion','export']);
 for(const op of OPS)assert.ok(OP_PARAMS[op],op);
});

test('validateRecipe writes every default out and keeps the source',()=>{
 const r=validateRecipe(base([{op:'sheet.split'},{op:'bg.remove',p:{mode:'ai'}},{op:'fit',p:{preset:'line.sticker'}}]));
 assert.equal(r.ok,true);
 const [split,bg,fit]=r.recipe.steps;
 assert.deepEqual(split,{op:'sheet.split',v:1,p:{mode:'auto',cols:1,rows:1,tolerance:40}});
 assert.equal(bg.p.mode,'ai');assert.equal(bg.p.refine,true);assert.equal(bg.p.model,'birefnet-lite-512@4a3c40c');
 assert.deepEqual([fit.p.w,fit.p.h,fit.p.rev],[370,320,'2026-10']);
 assert.equal(r.recipe.source.generator,'chatgpt');assert.equal(r.recipe.input.expect,'sheet');
 // Idempotent: a normalised recipe validates to itself.
 assert.deepEqual(validateRecipe(r.recipe),r);
 assert.deepEqual(validateRecipe(JSON.stringify(r.recipe)),r);
});

test('numbers are clamped, unknown params dropped, bad enums and types rejected',()=>{
 const r=validateRecipe(base([{op:'crop',p:{margin:9,ratio:'1:1',x:10,y:20,w:300}},{op:'motion',p:{frames:500,ms:'90'}}]));
 assert.equal(r.ok,true);
 assert.equal(r.recipe.steps[0].p.margin,.5);assert.equal('x' in r.recipe.steps[0].p,false);
 assert.equal(r.recipe.steps[1].p.frames,24);assert.equal(r.recipe.steps[1].p.ms,90);
 assert.equal(validateRecipe(base([{op:'crop',p:{shape:'heart'}}])).ok,false);
 assert.equal(validateRecipe(base([{op:'bg.remove',p:{refine:'yes'}}])).ok,false);
 assert.equal(validateRecipe(base([{op:'sticker.border',p:{color:'red'}}])).ok,false);
 assert.equal(validateRecipe(base([{op:'bg.remove',p:{model:'https://evil.example/model.onnx'}}])).ok,false);
});

test('only whitelisted ops: no face swap, undress, age change or watermark removal',()=>{
 for(const op of ['face.swap','body.reshape','clothes.remove','age.change','watermark.remove','eval','script'])
  assert.equal(validateRecipe(base([{op}])).ok,false,op);
 assert.equal(validateRecipe(base([{op:'crop',v:2}])).ok,false);
});

test('limits: schema, step count, size, export last',()=>{
 assert.equal(validateRecipe({...base([{op:'crop'}]),schema:'other/1'}).ok,false);
 assert.equal(validateRecipe(base([])).ok,false);
 assert.equal(validateRecipe(base(Array.from({length:21},()=>({op:'crop'})))).ok,false);
 assert.equal(validateRecipe(base(Array.from({length:20},()=>({op:'crop'})))).ok,true);
 assert.equal(validateRecipe(base([{op:'export'},{op:'crop'}])).ok,false);
 assert.equal(validateRecipe('{nope').ok,false);
 assert.equal(validateRecipe(null).ok,false);
 assert.equal(validateRecipe([1]).ok,false);
 const long=validateRecipe({...base([{op:'crop'}]),title:'x'.repeat(500),source:{generator:'nope',prompt:'p'.repeat(5000)}});
 assert.equal(long.ok,true);assert.equal(long.recipe.title.length,80);assert.equal(long.recipe.source.prompt.length,2000);assert.equal(long.recipe.source.generator,'other');
 for(const p of PRESETS)assert.ok(JSON.stringify(p.recipe).length<RECIPE_MAX_BYTES);
});

test('fit presets carry the official numbers (PIPELINE report §1.3)',()=>{
 assert.deepEqual([FIT_SPECS['line.sticker'].w,FIT_SPECS['line.sticker'].h,FIT_SPECS['line.sticker'].even,FIT_SPECS['line.sticker'].maxBytes],[370,320,true,1_000_000]);
 assert.deepEqual([FIT_SPECS['kakao.static'].w,FIT_SPECS['kakao.static'].h,FIT_SPECS['kakao.static'].maxBytes],[360,360,150_000]);
 assert.deepEqual([FIT_SPECS['discord.emoji'].w,FIT_SPECS['discord.emoji'].maxBytes],[128,256_000]);
 assert.deepEqual([FIT_SPECS['telegram.sticker'].w,FIT_SPECS['telegram.sticker'].side],[512,'long']);
 assert.deepEqual([FIT_SPECS['wall.iphone17'].w,FIT_SPECS['wall.iphone17'].h],[1206,2622]);
 // A preset overrides hand-written sizes (the spec is the spec).
 const r=validateRecipe(base([{op:'fit',p:{preset:'kakao.static',w:999,h:10,mode:'cover'}}]));
 assert.deepEqual([r.recipe.steps[0].p.w,r.recipe.steps[0].p.h,r.recipe.steps[0].p.mode],[360,360,'contain']);
});

test('summarize: Korean and English labels for the recipe card',()=>{
 const line=presetById('line.sticker').recipe;
 const ko=summarize(line,'ko');
 assert.equal(ko.preset,'LINE 스탬프 370×320');
 assert.deepEqual(ko.steps.map(s=>s.name),['시트 나누기','배경 지우기','자르기','흰 테두리','규격 맞추기','저장 형식']);
 assert.match(ko.steps[3].detail,/^7px/);// 0.018 × 370
 assert.equal(summarize(line,'en').steps[0].name,'Split sheet');
 assert.equal(summaryLine(line,'ko'),'시트 나누기 → 배경 지우기 → 자르기 → 흰 테두리 7px → LINE 스탬프 370×320');
 const off=validateRecipe(base([{op:'crop'},{op:'sticker.border',off:true}]));
 assert.equal(summarize(off.recipe,'ko').steps.length,1);
});

test('presets: every slug resolves and every recipe is valid',()=>{
 for(const slug of ['kakao-emoticon','line-sticker','discord-emoji','telegram-sticker','round-pfp','phone-wallpaper','ai-pixel-fix']){
  const p=presetBySlug(slug);assert.ok(p,slug);assert.equal(validateRecipe(p.recipe).ok,true);
 }
 assert.throws(()=>defaultStep('crop',{ratio:'7:7'}));
 assert.equal(defaultStep('motion').p.kind,'bounce');
});
