// Texture workspace (pure parts of src/studio/workspaces/texture/): ko/en/ja parity, document
// state (one entry per asset, undo-friendly immutable edits), the working-picture layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TEX_STRINGS} from '../src/studio/workspaces/texture/strings.js';
import {st} from '../src/studio/strings.js';
import * as St from '../src/studio/workspaces/texture/state.js';
import {createProject,imageAsset,normalizeProject,setFrames,framesFromCells} from '../src/studio/core/project.js';
import {COMING} from '../src/studio/workspaces/coming.js';
const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?flat(v,p+k+'.'):[[p+k,String(v)]]);
const slots=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join();
const BLOB='a'.repeat(64);
test('ko, en and ja have the same keys and {placeholders}; no "AI" wording',()=>{
 const en=new Map(flat(TEX_STRINGS.en));
 for(const l of ['ko','ja']){const o=new Map(flat(TEX_STRINGS[l]));assert.deepEqual([...o.keys()].sort(),[...en.keys()].sort(),l);for(const [k,v] of en)assert.equal(slots(o.get(k)),slots(v),`${l} ${k}`);}
 assert.equal(st('ko','tex.panel.normal'),'노멀 맵');assert.equal(st('ja','group.texture'),'テクスチャ');
 assert.doesNotMatch(JSON.stringify(TEX_STRINGS),/\bAI\b|인공지능|人工知能/);
 assert(!COMING.some(w=>w.id==='texture'),'Texture is a ready workspace, not "coming"');
});
test('state: edits are immutable, create the entry with defaults, and survive normalizeProject (.nerulio / autosave)',()=>{
 let doc=createProject();doc={...doc,assets:[imageAsset({id:'a1',name:'hero.png',width:64,height:32,blob:BLOB})]};
 const size={w:32,h:32};
 const d1=St.withTexState(doc,s=>St.setParams(s,'a1',{bevel:{width:6}},size));
 assert.notEqual(d1,doc);assert.equal(St.texState(doc),St.EMPTY,'the old document is untouched');
 assert.equal(St.entryOf(St.texState(d1),'a1').params.bevel.width,6);
 const d2=St.withTexState(d1,s=>St.addLight(s,'a1',{x:3,y:4,z:9},size));
 const lights=St.entryOf(St.texState(d2),'a1').scene.lights;assert.equal(lights.length,2);assert.equal(lights[1].z,9);
 const d3=St.withTexState(d2,s=>St.setLight(s,'a1',lights[1].id,{x:10},size));assert.equal(St.entryOf(St.texState(d3),'a1').scene.lights[1].x,10);
 const stroke={mode:'raise',r:3,s:1,hard:.5,pts:[1,2,3,4],clip:{x:0,y:0,w:32,h:32}};
 const d4=St.withTexState(d3,s=>St.addStroke(s,'a1',stroke,size));
 assert.equal(St.withTexState(d4,s=>St.setParams(s,'a1',{},size)),d4,'a no-op edit returns the same document (no empty undo step)');
 const back=normalizeProject(JSON.parse(JSON.stringify(d4)));
 assert.deepEqual(back.settings.texture,d4.settings.texture,'settings.texture round-trips through the project format');
 const e=St.entryOf(St.texState(back),'a1');assert.equal(e.strokes.length,1);assert.deepEqual(e.strokes[0].pts,[1,2,3,4]);
 const bad=St.entryOf({assets:{a1:{strokes:[{mode:'x',pts:[1]},stroke],scene:{lights:[{x:'q'}],ambient:'red'}}}},'a1');
 assert.equal(bad.strokes.length,1);assert.equal(bad.scene.ambient,'#3a3f4d');assert.equal(bad.scene.lights[0].x,0);
 assert.deepEqual(Object.keys(St.prune(St.texState(d4),[]).assets),[]);
 assert.equal(St.texState(St.withTexState(d4,s=>St.setRole(s,'a1','albedo'))).roles.a1,'albedo');
 // the confirmed red flip of an imported map: on, round-trips, off removes the key again
 const d5=St.withTexState(d4,s=>St.setRedFlipped(s,'a1',true,size));
 assert.equal(St.entryOf(St.texState(normalizeProject(JSON.parse(JSON.stringify(d5)))),'a1').normalRedFlipped,true);
 const d6=St.withTexState(d5,s=>St.setRedFlipped(s,'a1',false,size));
 assert.equal('normalRedFlipped' in St.texState(d6).assets.a1,false);assert.deepEqual(St.texState(d6).assets.a1,St.texState(d4).assets.a1);
});
test('working layout: a sheet keeps its frames as regions; frames with their own pixels become a grid',()=>{
 const a=imageAsset({id:'a1',name:'s.png',width:96,height:64,blob:BLOB});
 assert.deepEqual(St.workingLayout(a).regions,[]);
 let doc={...createProject(),assets:[a]};
 doc=setFrames(doc,'a1',framesFromCells(a,[0,1,2,3,4,5].map(i=>({x:(i%3)*32,y:Math.floor(i/3)*32,w:32,h:32}))));
 const L=St.workingLayout(doc.assets[0]);assert.equal(L.mode,'sheet');assert.equal(L.regions.length,6);assert.deepEqual(L.regions[4],{x:32,y:32,w:32,h:32});
 const f=doc.assets[0].frames;const own={...doc.assets[0],cels:[...doc.assets[0].cels,...f.map(x=>({layerId:'l1',frameId:x.id,blob:BLOB,x:0,y:0,opacity:255}))]};
 const S=St.workingLayout(own);assert.equal(S.mode,'strip');assert.equal(S.frameRects.length,6);assert(S.width*S.height>=6*32*32);
 assert.equal(new Set(S.frameRects.map(r=>r.x+','+r.y)).size,6,'no two frames share a cell');
});
