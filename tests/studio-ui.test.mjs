// UI workspace: ko/en/ja strings parity, document state helpers, the export bundles (UI kit and
// font) re-opened independently, and the embedded engine helpers equal the verified files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {UI_STRINGS} from '../src/studio/workspaces/ui/strings.js';
import {st} from '../src/studio/strings.js';
import * as U from '../src/studio/workspaces/ui/state.js';
import * as N from '../src/game/ui/nine-patch.js';
import {decodePNG} from '../src/game/texture-png.js';
import {buildKitBundle,buildFontBundle,androidName} from '../src/game/ui/export/bundles.js';
import {parseFont} from '../src/game/ui/font/opentype.js';
import {renderGlyphs,packGlyphs,composePages,assemble,pixelGridOf,normalizeFontSettings} from '../src/game/ui/font/build.js';
import {parseBMFont,msdfAtlasJSON} from '../src/game/ui/font/formats.js';
import {encodePNG} from '../src/game/pack/png.js';
import {enginePlan,ENGINES} from '../src/game/ui/engines.js';
import {helperSources} from '../tools/ui-helpers-embed.mjs';
import * as HS from '../src/game/ui/export/helper-sources.js';
const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?flat(v,p+k+'.'):[[p+k,String(v)]]);
const slots=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join();
const fix=p=>new URL(`./fixtures/ui/${p}`,import.meta.url);
const png=async p=>{const d=await decodePNG(new Uint8Array(await readFile(fix(p))));return {width:d.width,height:d.height,data:new Uint8ClampedArray(d.data)};};
test('ko, en and ja have the same keys and {placeholders}; every key the workspace uses exists',async()=>{
 const en=new Map(flat(UI_STRINGS.en));
 for(const l of ['ko','ja']){
  const other=new Map(flat(UI_STRINGS[l]));
  assert.deepEqual([...other.keys()].sort(),[...en.keys()].sort(),l);
  for(const [k,v] of en)assert.equal(slots(other.get(k)),slots(v),`${l} ${k}`);
 }
 assert.equal(st('ko','ui.mode.nine'),'9-슬라이스');assert.equal(st('ja','group.ui'),'UI');
 assert.doesNotMatch(JSON.stringify(UI_STRINGS),/\bAI\b|인공지능|人工知能/,'no "AI" wording for heuristics');
 // literal keys in the source (t('ui.x.y')) must resolve in English
 const dir=new URL('../src/studio/workspaces/ui/',import.meta.url),missing=[];
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.js'))){const src=await readFile(new URL(f,dir),'utf8');
  for(const m of src.matchAll(/\bt\('(ui\.[\w.-]*\w)'\s*[,)]/g))if(!en.has(m[1].slice(3)))missing.push(`${f}: ${m[1]}`);}
 assert.deepEqual(missing,[]);
});
test('state: elements, 9-slices, buttons and fonts are immutable edits; removing an element clears its states',()=>{
 let s=U.EMPTY;
 const a=U.newElement(s,{assetId:'a1',rect:{x:0,y:0,w:190,h:49},name:'buttonLong_blue.png'});s=U.putElements(s,[a]);
 const b=U.newElement(s,{assetId:'a2',rect:{x:0,y:0,w:190,h:45},name:'buttonLong_blue_pressed.png'});s=U.putElements(s,[b]);
 assert.equal(a.name,'buttonLong_blue');assert.equal(U.newElement(s,{assetId:'a1',rect:{x:0,y:0,w:1,h:1},name:'buttonLong_blue'}).name,'buttonLong_blue_2');
 const s2=U.setNine(s,a.id,{border:{left:6,right:6,top:5,bottom:9}});
 assert.notEqual(s2,s);assert.equal(s.elements[a.id].nine,null,'original untouched');
 assert.equal(U.setNine(s2,a.id,{border:{left:6,right:6,top:5,bottom:9}}),s2,'no-op returns the same state');
 assert.deepEqual(s2.elements[a.id].nine.border,{left:6,right:6,top:5,bottom:9});
 // file names say "pressed": suggested, not applied
 const sug=U.suggestButtons(s2);assert.deepEqual(sug,[{normal:a.id,states:{pressed:b.id}}]);
 let btn=U.newButton(s2,{normal:a.id});btn={...btn,states:{...btn.states,pressed:{element:b.id}}};
 const s3=U.putButton(s2,btn);assert.deepEqual(U.suggestButtons(s3),[],'a paired button is not suggested again');
 assert.deepEqual(Object.keys(btn.states),['normal','hover','pressed','disabled','focus']);
 const s4=U.removeElements(s3,[b.id]);assert.equal(s4.buttons[btn.id].states.pressed,undefined);
 assert.equal(U.removeElements(s3,[a.id]).buttons[btn.id],undefined,'a button without its normal state goes');
 assert.throws(()=>U.setButtonState(s3,btn.id,'normal',{from:'hover',ops:{}}),/normal state/);
 const f=U.newFont(s,{name:'Galmuri',source:{kind:'file',blob:'b'.repeat(64),fileName:'g.ttf'}});
 let s5=U.putFont(s,f);s5=U.updateFont(s5,f.id,x=>({...x,charset:{...x.charset,sources:[...x.charset.sources,{id:'c1',kind:'file',blob:'c'.repeat(64),name:'ko.po'}]}}));
 assert.deepEqual([...U.usedFiles(s5)].sort(),['b'.repeat(64),'c'.repeat(64)]);
 assert.deepEqual(U.pruneForAssets(s5,['a1']).elements[b.id],undefined,'elements of a removed image are skipped');
});
test('UI kit bundle: JSON, Godot .tres, Android .9.png, CSS and atlas JSON all carry the same borders',async()=>{
 const img=await png('kenney/blue_button_rectangle_depth_flat.png'),blob='x'.repeat(64);
 const nine={border:{left:6,right:6,top:5,bottom:9},padding:{left:10,right:10,top:6,bottom:12},stretch:{h:'tile',v:'stretch'},drawCenter:true};
 const b=await buildKitBundle({name:'kit',targets:['generic','godot','android','css','phaser','unity'],elements:[{name:'blue btn',blob,rect:{x:0,y:0,w:img.width,h:img.height},nine}],
  buttons:[{name:'ok',states:{normal:{element:'blue btn'},hover:{from:'normal',ops:{brightness:.1}},focus:{from:'normal',ops:{outline:2,outlineColor:'#ff0000'}}}}]},{image:async()=>img});
 const file=n=>b.files.find(f=>f.name===n),text=n=>new TextDecoder().decode(file(n).data);
 const j=JSON.parse(text('kit/nerulio-ui.json'));
 assert.deepEqual(j.elements.blue_btn.nineSlice,nine.border);assert.deepEqual(j.elements.blue_btn.padding,nine.padding);assert.deepEqual(j.elements.blue_btn.stretch,{horizontal:'tile',vertical:'stretch'});
 assert.deepEqual(j.buttons.ok,{normal:'blue_btn',hover:'ok_hover',focus:'ok_focus'});
 assert.deepEqual(j.elements.ok_focus.nineSlice,{left:8,right:8,top:7,bottom:11},'a 2-px focus ring grows every border by 2');
 const tres=text('kit/godot/blue_btn.tres');
 for(const l of ['texture_margin_left = 6.0','texture_margin_bottom = 9.0','content_margin_right = 10.0','axis_stretch_horizontal = 1','path="blue_btn.png"'])assert.ok(tres.includes(l),l);
 assert.ok(!tres.includes('axis_stretch_vertical'),'stretch is the default and is not written');
 assert.match(text('kit/godot/ok_theme.tres'),/Button\/styles\/hover = SubResource/);
 const p9=file(`kit/android/drawable-nodpi/${androidName('blue_btn')}.9.png`),d9=await decodePNG(p9.data);
 const back=N.fromNinePatchPNG(new Uint8ClampedArray(d9.data),d9.width,d9.height);
 assert.deepEqual(back.nine.border,nine.border);assert.deepEqual(back.nine.padding,nine.padding);assert.deepEqual(back.image,img.data,'pixels unchanged');
 assert.match(text('kit/css/kit.css'),/\.ui-blue_btn\{[^}]*border-image-slice:5 6 9 6 fill;[^}]*border-image-repeat:repeat stretch/);
 const atlas=JSON.parse(text('kit/phaser/kit.json')),fr=atlas.frames.blue_btn;
 assert.deepEqual(fr.scale9Borders,{x:6,y:5,w:img.width-12,h:img.height-14});
 const page=await decodePNG(file('kit/phaser/kit_atlas.png').data);
 assert.deepEqual(N.crop(new Uint8ClampedArray(page.data),page.width,page.height,{x:fr.frame.x,y:fr.frame.y,w:fr.frame.w,h:fr.frame.h}),img.data,'the atlas region is the element, byte for byte');
 assert.ok(file('kit/unity/Editor/NerulioUIImporter.cs'));
 assert.equal(androidName('Blue Button-2'),'blue_button_2');assert.equal(androidName('9slice'),'ui_9slice');
});
test('font bundle: a bitmap font from a real TTF re-opens identically in every BMFont flavour',async()=>{
 const f=parseFont(new Uint8Array(await readFile(fix('fonts/KenneyPixel.ttf'))));
 const grid=pixelGridOf(f,[...'HOIEnoxa0'].map(c=>c.codePointAt(0)));
 assert.equal(grid.pixelSize,16,'Kenney Pixel is drawn on a 16-px grid (corpus truth: pixelSize 16)');assert.equal(grid.confidence,'high');
 const o=normalizeFontSettings({mode:'mono',size:16,padding:0,spacing:1});
 const cps=[...'Hello, World! 0123'].map(c=>c.codePointAt(0)).filter((c,i,a)=>a.indexOf(c)===i);
 const r=renderGlyphs(f,cps,o),packed=packGlyphs(r.glyphs,o),pages=composePages(packed,o),m=assemble(f,r,packed,o,{file:'px'});
 // at its native size every glyph pixel is fully on or off: crisp
 for(const p of pages)for(let i=3;i<p.data.length;i+=4)assert.ok(p.data[i]===0||p.data[i]===255);
 const b=buildFontBundle({name:'px',model:m,pages:await Promise.all(pages.map(async p=>({png:await encodePNG(p)}))),targets:['bmfont-text','bmfont-xml','bmfont-bin','msdf-json'],charset:'x',missing:[]});
 const get=n=>b.files.find(x=>x.name===n)?.data;
 for(const n of ['px/bmfont/px.fnt','px/bmfont/px.xml.fnt','px/bmfont/px.bin.fnt']){
  const p=parseBMFont(get(n));assert.equal(p.chars.length,m.glyphs.length,n);assert.equal(p.common.base,m.base);assert.deepEqual(p.pages,['px.png']);
  for(const c of p.chars){const g=m.glyphs.find(x=>x.id===c.id);assert.deepEqual([c.x,c.y,c.width,c.height,c.xoffset,c.yoffset,c.xadvance],[g.x,g.y,g.w,g.h,g.xoffset,g.yoffset,g.xadvance]);}
 }
 assert.deepEqual(JSON.parse(new TextDecoder().decode(get('px/msdf-atlas-gen/px.json'))),msdfAtlasJSON(m));
 assert.ok(get('px/bmfont/px.png'));
});
test('engine plans: modes an engine lacks fall back to stretch with a note',()=>{
 const p=enginePlan('phaser',{w:30,h:10},{border:{left:3,right:3,top:2,bottom:2},stretch:{h:'tile',v:'stretch'}},90,20);
 assert.deepEqual(p.notes,[{code:'mode',engine:'phaser',mode:'tile'}]);assert.equal(p.ops.filter(o=>o.region==='center').length,1);
 for(const e of Object.keys(ENGINES))assert.ok(enginePlan(e,{w:30,h:10},{border:{left:3,right:3,top:2,bottom:2}},90,20).ops.length>=9,e);
});
test('the engine helpers the exporter embeds are the files the engine verifiers ran',async()=>{
 const src=await helperSources();
 for(const [k,v] of Object.entries(src))assert.equal(HS[k],v,`${k}: run node tools/ui-helpers-embed.mjs`);
});
