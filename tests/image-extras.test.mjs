import test from 'node:test';
import assert from 'node:assert/strict';
import {say,EXTRA_LOCALES,TARGETS,targetLabel,targetVerdict,targetTally,presetLabel,chosenLabel} from '../src/task/image-extras.js';
import {SOCIAL} from '../src/landings.js';

test('image tool strings exist in ko, en and ja with the same placeholders',()=>{
 assert.deepEqual(EXTRA_LOCALES.sort(),['en','ja','ko']);
 const keys=['targetGroup','targetOff','targetMet','targetMissed','targetTryShrink','targetShort','targetShortMissed','targetTally','alphaFilled','grew','pngLossless','noAvif','ssimNote','presetGroup','swap'];
 const holes=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
 for(const key of keys){
  const en=say('en',key);assert.notEqual(en,key,`${key} is defined`);
  for(const l of ['ko','ja']){const s=say(l,key);assert.notEqual(s,key);assert.notEqual(s,en,`${l}.${key} is translated`);assert.equal(holes(s),holes(en),`${l}.${key} placeholders`);}
 }
});
test('say fills placeholders, keeps unknown ones and falls back to English',()=>{
 assert.equal(say('en','targetTally',{n:3,m:4,t:'100 KB'}),'3 of 4 under 100 KB');
 assert.equal(say('ko','targetTally',{n:3,m:4,t:'100 KB'}),'4개 중 3개가 100 KB 이하');
 assert.equal(say('en','targetShort',{}),'under {t} ✓');
 assert.equal(say('fr','swap'),say('en','swap'));
 // tests/task-browser.py looks for this opening phrase when a retained original still misses the target.
 assert.equal(say('en','targetMissed',{t:'1 KB',b:'10 KB',over:'9 KB'}),'Target size not reached. The smallest result with these settings is 10 KB, 9 KB over the 1 KB target.');
 assert.equal(say('en','nope'),'nope');
});
test('target labels and presets',()=>{
 assert.deepEqual(TARGETS,[100,500,1024,2048]);
 assert.deepEqual(TARGETS.map(targetLabel),['100 KB','500 KB','1 MB','2 MB']);
 assert.equal(targetLabel(1500),'1500 KB');
});
test('targetVerdict never rounds a miss into a success',()=>{
 assert.equal(targetVerdict(5000,0),null);
 assert.deepEqual(targetVerdict(100*1024,100),{met:true,limit:102400,over:0});
 assert.deepEqual(targetVerdict(100*1024+1,100),{met:false,limit:102400,over:1});
 assert.equal(targetVerdict(1,100).met,true);
});
test('targetTally counts met files only when one target applies to the whole batch',()=>{
 assert.deepEqual(targetTally([{targetKb:100,met:true},{targetKb:100,met:false},{targetKb:100,met:true}]),{kb:100,met:2,total:3});
 assert.equal(targetTally([{targetKb:0,met:true}]),null);
 assert.equal(targetTally([{targetKb:100,met:true},{targetKb:500,met:true}]),null);
 assert.equal(targetTally([]),null);
});
test('chosenLabel reports the picked codec and floors the similarity score',()=>{
 assert.equal(chosenLabel({format:'webp',quality:.8,ssim:.97499},'Quality'),'WebP · Quality 80 · SSIM 0.974');
 assert.equal(chosenLabel({format:'jpeg',quality:.4375,ssim:.9999},'화질'),'JPG · 화질 44 · SSIM 0.999');
 assert.equal(chosenLabel({format:'png',quality:.8,ssim:1}),'PNG · SSIM 1.000');
 assert.equal(chosenLabel({format:'avif',quality:null,ssim:NaN}),'AVIF');
});
test('every platform size has a short chip label',()=>{
 for(const [slug,[,w,h]]of Object.entries(SOCIAL)){const label=presetLabel(slug,w,h);assert.ok(label&&label!==`${w}×${h}`,`${slug} has a named label`);assert.ok(label.length<=14);}
 assert.equal(presetLabel('unknown',640,480),'640×480');
 // Chip labels are localized, not English shorthand shown to everyone.
 for(const l of ['ko','en','ja'])for(const [slug,[,w,h]]of Object.entries(SOCIAL)){const label=presetLabel(slug,w,h,l);assert.ok(label&&label!==`${w}×${h}`,`${l}.${slug}`);assert.ok(label.length<=14,`${l}.${slug} is short`);}
 assert.equal(presetLabel('youtube-banner',2560,1440,'ko'),'유튜브 배너');
 assert.equal(presetLabel('x-header',1500,500,'ja'),'Xヘッダー');
 assert.equal(presetLabel('x-header',1500,500,'fr'),presetLabel('x-header',1500,500,'en'));
});
