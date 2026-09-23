/** Studio Sprite workspace: pure modules (document shape v2, frame images, playback, timeline
 * edits, import planning, GIF/APNG decoding, Aseprite bridge). Browser flows are in
 * tests/studio-sprite-browser.py. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/studio/core/project.js';
import {frameDraws,composeFrame,composeCanvas,celAt,flipRGBA,opaqueBounds} from '../src/studio/sprite/frame-image.js';

const H1='a'.repeat(64),H2='b'.repeat(64),H3='c'.repeat(64);
const solid=(w,h,[r,g,b,a])=>{const d=new Uint8Array(w*h*4);for(let i=0;i<w*h;i++)d.set([r,g,b,a],i*4);return {width:w,height:h,data:d};};

test('v1 documents migrate: the single timeline cel becomes the shared picture',()=>{
 const v1={format:'nerulio-project',version:1,id:'p',name:'old',createdAt:'',settings:{},assets:[{id:'a',kind:'image',name:'s.png',width:8,height:4,
  layers:[{id:'l1',name:'Layer 1',visible:true,opacity:255,blend:'normal'}],timeline:[{id:'t1',duration:100}],cels:[{layerId:'l1',frameId:'t1',blob:H1,x:0,y:0,opacity:255}],
  frames:[{id:'f1',name:'f1',sourceRect:{x:0,y:0,w:4,h:4}},{id:'f2',name:'f2',sourceRect:{x:4,y:0,w:4,h:4}}],tags:[{id:'g',name:'walk',frameIds:['f1','f2'],fps:12,direction:'forward',loop:true,color:'#fff'}],slices:[],grid:null,source:null}]};
 const d=P.normalizeProject(v1),a=d.assets[0];
 assert.equal(d.version,2);assert.equal(a.timeline,undefined);
 assert.deepEqual(a.cels,[{layerId:'l1',frameId:P.SHARED,blob:H1,x:0,y:0,opacity:255}]);
 assert.equal(a.tags[0].repeat,0);assert.equal(P.primaryBlob(a),H1);
 assert.deepEqual(P.normalizeProject(JSON.parse(JSON.stringify(d))),d,'v2 output normalizes to itself');
});
test('v2 validation: cels must point at a layer and at a frame or the shared slot, once',()=>{
 let d=P.addAssets(P.createProject({id:'p'}),[P.imageAsset({id:'a',width:8,height:8,blob:H1})]);
 d=P.addFrames(d,'a',[{x:0,y:0,w:4,h:4}]);const fid=d.assets[0].frames[0].id;
 const good=JSON.parse(JSON.stringify(d));good.assets[0].cels.push({layerId:'l1',frameId:fid,blob:H2,x:0,y:0,opacity:255});
 assert.equal(P.normalizeProject(good).assets[0].cels.length,2);
 const bad=JSON.parse(JSON.stringify(good));bad.assets[0].cels[1].frameId='nope';assert.throws(()=>P.normalizeProject(bad),/missing layer or frame/);
 const twice=JSON.parse(JSON.stringify(good));twice.assets[0].cels.push({...twice.assets[0].cels[1]});assert.throws(()=>P.normalizeProject(twice),/two cels/);
 const imp=JSON.parse(JSON.stringify(good));imp.assets[0].import={kind:'sheet',decisions:[],sourceBlob:H3};
 assert.ok(P.referencedBlobs(P.normalizeProject(imp)).has(H3),'the untouched original stays in the project');
 // removing a frame drops its own cels, never the shared picture
 const gone=P.removeFrames(P.normalizeProject(good),'a',[fid]);assert.deepEqual(gone.assets[0].cels.map(c=>c.frameId),[P.SHARED]);
});
test('tags carry an Aseprite repeat count; loop stays in step with it',()=>{
 let d=P.addAssets(P.createProject({id:'p'}),[P.imageAsset({id:'a',width:8,height:8,blob:H1})]);
 d=P.addFrames(d,'a',[{x:0,y:0,w:4,h:4},{x:4,y:0,w:4,h:4}]);const ids=d.assets[0].frames.map(f=>f.id);
 d=P.addTag(d,'a',{id:'g',name:'hit',frameIds:ids,repeat:2,direction:'pingpong'});
 assert.deepEqual([d.assets[0].tags[0].repeat,d.assets[0].tags[0].loop],[2,false]);
 d=P.updateTag(d,'a','g',{repeat:0});assert.deepEqual([d.assets[0].tags[0].repeat,d.assets[0].tags[0].loop],[0,true]);
 d=P.updateTag(d,'a','g',{name:'hit2'});assert.equal(d.assets[0].tags[0].repeat,0,'unrelated edits keep repeat');
});
test('frame image: own cel beats the shared picture, hidden layers are skipped, trim and offset place pixels',()=>{
 const asset={id:'a',width:4,height:2,layers:[{id:'l1',visible:true,opacity:255,blend:'normal'},{id:'l2',visible:true,opacity:255,blend:'normal'}],
  cels:[{layerId:'l1',frameId:P.SHARED,blob:H1,x:0,y:0,opacity:255},{layerId:'l2',frameId:'f2',blob:H2,x:1,y:0,opacity:255}],frames:[]};
 const img={[H1]:solid(4,2,[255,0,0,255]),[H2]:solid(1,1,[0,0,255,255])};
 const f1={id:'f1',sourceRect:{x:0,y:0,w:2,h:2},trimmedRect:null,canvasWidth:2,canvasHeight:2,offsetX:0,offsetY:0};
 const f2={id:'f2',sourceRect:{x:0,y:0,w:2,h:2},trimmedRect:null,canvasWidth:2,canvasHeight:2,offsetX:0,offsetY:0};
 assert.equal(frameDraws(asset,f1).length,1);assert.equal(frameDraws(asset,f2).length,2);
 assert.equal(celAt(asset,'l2','f1'),null);
 const out=composeFrame(asset,f2,b=>img[b]);
 assert.deepEqual([...out.data.subarray(4,8)],[0,0,255,255],'layer 2 draws over layer 1 at its x');
 assert.deepEqual([...out.data.subarray(0,4)],[255,0,0,255]);
 const hidden={...asset,layers:[asset.layers[0],{...asset.layers[1],visible:false}]};
 assert.deepEqual([...composeFrame(hidden,f2,b=>img[b]).data.subarray(4,8)],[255,0,0,255]);
 // a trimmed frame placed on a larger canvas
 const f3={id:'f3',sourceRect:{x:0,y:0,w:4,h:2},trimmedRect:{x:1,y:0,w:1,h:1},canvasWidth:3,canvasHeight:3,offsetX:2,offsetY:2};
 const o3=composeFrame(hidden,f3,b=>img[b]);assert.equal(o3.width,3);
 assert.deepEqual([...o3.data.subarray((2*3+2)*4,(2*3+2)*4+4)],[255,0,0,255]);assert.equal(o3.data.subarray(0,8*4).some(v=>v),false);
 // half-transparent normal blend follows Aseprite's integer rule
 const blend={...asset,cels:[asset.cels[0],{...asset.cels[1],opacity:128}]};
 const px=composeCanvas(blend,f2,b=>img[b]).data.subarray(4,8);assert.deepEqual([...px],[127,0,128,255]);
});
test('flip and opaque bounds',()=>{
 const a={width:3,height:1,data:new Uint8Array([1,2,3,4,0,0,0,0,9,9,9,9])};
 assert.deepEqual([...flipRGBA(a).data],[9,9,9,9,0,0,0,0,1,2,3,4]);
 assert.deepEqual(opaqueBounds(a),{x:0,y:0,w:3,h:1});assert.equal(opaqueBounds({width:1,height:1,data:new Uint8Array(4)}),null);
});
