import test from 'node:test';
import assert from 'node:assert/strict';
import {isMac,shortcutOf,shortcutLabel,splitIntake,sizeDelta} from '../src/task/keys.js';
import {ui,UI_LOCALES} from '../src/task/strings.js';
import {taskPage} from '../tools/task-build.mjs';

test('Ctrl+O / Ctrl+S map to open / save; ⌘ on Apple devices', ()=>{
 assert.equal(shortcutOf({key:'o',ctrlKey:true}),'open');
 assert.equal(shortcutOf({key:'S',ctrlKey:true}),'save');
 assert.equal(shortcutOf({key:'s',metaKey:true},{mac:true}),'save');
 assert.equal(shortcutOf({key:'o',metaKey:true},{mac:true}),'open');
 // The other platform's modifier is not ours.
 assert.equal(shortcutOf({key:'s',metaKey:true}),'');
 assert.equal(shortcutOf({key:'s',ctrlKey:true},{mac:true}),'');
});
test('plain keys, Shift/Alt chords, key repeat and IME composition are left alone', ()=>{
 for(const e of [{key:'s'},{key:'s',ctrlKey:true,shiftKey:true},{key:'o',ctrlKey:true,altKey:true},{key:'s',ctrlKey:true,repeat:true},{key:'s',ctrlKey:true,isComposing:true},{key:'p',ctrlKey:true},{ctrlKey:true},null])assert.equal(shortcutOf(e),'');
});
test('shortcut labels follow the platform', ()=>{
 assert.equal(shortcutLabel('open'),'Ctrl+O');assert.equal(shortcutLabel('save'),'Ctrl+S');assert.equal(shortcutLabel('paste'),'Ctrl+V');
 assert.equal(shortcutLabel('save',{mac:true}),'⌘S');assert.equal(shortcutLabel('nope'),'');
 assert.equal(isMac('MacIntel'),true);assert.equal(isMac('macOS'),true);assert.equal(isMac('iPhone'),true);assert.equal(isMac('Win32'),false);assert.equal(isMac('Linux x86_64'),false);assert.equal(isMac(),false);
});
test('a mixed drop is split into accepted and skipped files, order kept', ()=>{
 const kindOf=f=>f.type.split('/')[0],files=[{name:'a.png',type:'image/png'},{name:'b.pdf',type:'application/pdf'},{name:'c.jpg',type:'image/jpeg'}];
 const {ok,skipped}=splitIntake(files,['image'],kindOf);
 assert.deepEqual(ok.map(f=>f.name),['a.png','c.jpg']);assert.deepEqual(skipped.map(f=>f.name),['b.pdf']);
 assert.deepEqual(splitIntake([],['image'],kindOf),{ok:[],skipped:[]});assert.deepEqual(splitIntake(null,['image'],kindOf),{ok:[],skipped:[]});
});
test('size delta is signed, rounded and silent without a source size', ()=>{
 assert.equal(sizeDelta(1000,380),'−62%');assert.equal(sizeDelta(1000,1080),'+8%');assert.equal(sizeDelta(1000,1000),'=');assert.equal(sizeDelta(1000,1004),'=');
 assert.equal(sizeDelta(0,10),'');assert.equal(sizeDelta(undefined,10),'');assert.equal(sizeDelta(10,NaN),'');assert.equal(sizeDelta(100,0),'−100%');
});
test('every shell string exists in ko, en and ja', ()=>{
 for(const l of UI_LOCALES)for(const key of ['skipped','dropover.title','keys.open','keys.save','keys.paste','keys.label']){
  const v=ui(l,key,{n:2,kind:'PDF'});assert.ok(v&&v!==key,`${l}:${key}`);if(l!=='en')assert.notEqual(v,ui('en',key,{n:2,kind:'PDF'}),`${l}:${key} is translated`);
 }
 assert.match(ui('en','skipped',{n:2,kind:'PDF'}),/2.*PDF/);
});
test('task pages carry the drop-anywhere overlay in the page language', ()=>{
 for(const l of UI_LOCALES){
  const html=taskPage({id:'compress',locale:l,prefix:l+'/',base:'/',title:'t',heading:'h',description:'d',headHTML:'',contentHTML:''});
  assert.ok(html.includes('class="task-dropover" aria-hidden="true"'));assert.ok(html.includes(`data-ui="dropover.title">${ui(l,'dropover.title')}<`));assert.ok(html.includes('id="dropKinds"'));
 }
});
