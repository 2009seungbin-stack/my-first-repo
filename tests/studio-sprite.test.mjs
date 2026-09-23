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
// ------------------------------------------------------------------ playback, timeline edits, import planning, decoders, Aseprite bridge
import {readFileSync} from 'node:fs';
import {steps,stepAt,stepIndex,onionFrames,totalMs} from '../src/studio/sprite/playback.js';
import * as D from '../src/studio/sprite/sprite-doc.js';
import {frameKey,groupFrameFiles,placeFrames,sheetPlan} from '../src/studio/sprite/import-plan.js';
import {rerankGrids} from '../src/studio/sprite/grid-rerank.js';
import {decodeGIF} from '../src/studio/sprite/gif-decode.js';
import {decodeAPNG,isAPNG} from '../src/studio/sprite/apng-decode.js';
import {asepriteContent,asepriteFromAsset} from '../src/studio/sprite/aseprite-bridge.js';
import {animatedAsset} from '../src/studio/sprite/import-build.js';
import {parseAtlas,atlasFrames} from '../src/studio/sprite/atlas-data.js';
import {readAseprite,writeAseprite,renderFrame} from '../src/game/aseprite.js';
const fx=p=>new URL('./fixtures/'+p,import.meta.url);
function sheetDoc(n=6){let d=P.addAssets(P.createProject({id:'p'}),[P.imageAsset({id:'a',width:8*n,height:8,blob:H1})]);d=P.addFrames(d,'a',[...Array(n)].map((_,i)=>({x:i*8,y:0,w:8,h:8})));return d;}
const diffPx=(x,y)=>{let d=0;for(let j=0;j<x.length;j+=4)if((x[j+3]||y[j+3])&&(x[j]!==y[j]||x[j+1]!==y[j+1]||x[j+2]!==y[j+2]||x[j+3]!==y[j+3]))d++;return d;};
test('playback: per-frame durations, ping-pong without doubled ends, repeat counts passes',()=>{
 const d=sheetDoc(4),a=d.assets[0],ids=a.frames.map(f=>f.id);
 const fr=a.frames.map((f,i)=>({...f,duration:[100,200,100,50][i]})),as={...a,frames:fr};
 const fwd=steps(as,{frameIds:ids,direction:'forward',repeat:0,fps:10});
 assert.deepEqual(fwd.map(s=>s.index),[0,1,2,3]);assert.equal(totalMs(fwd),450);
 assert.equal(stepAt(fwd,120).index,1);assert.equal(stepAt(fwd,470).index,0,'forever wraps');
 assert.deepEqual(steps(as,{frameIds:ids,direction:'pingpong',repeat:0,fps:10}).map(s=>s.index),[0,1,2,3,2,1]);
 assert.deepEqual(steps(as,{frameIds:ids,direction:'pingpong',repeat:2,fps:10},{whole:true}).map(s=>s.index),[0,1,2,3,2,1,0],'Aseprite: repeat 2 = there and back');
 const once=steps(as,{frameIds:ids,direction:'reverse',repeat:1,fps:10},{whole:true});assert.deepEqual(once.map(s=>s.index),[3,2,1,0]);assert.equal(stepAt(once,9999,{loop:false}).done,true);
 const tag={frameIds:ids.slice(1,3)};assert.equal(stepIndex(as,2,1,tag),1,'"." wraps inside the tag');assert.equal(stepIndex(as,1,-1,tag),2);assert.equal(stepIndex(as,3,1),3,'no tag: clamps');
 assert.deepEqual(onionFrames(as,1,{before:1,after:2,opacity:.5,falloff:.5}).map(o=>[o.index,o.side,o.alpha]),[[0,'prev',.5],[2,'next',.5],[3,'next',.25]]);
});
test('timeline edits: Shift/Ctrl selection, move keeps tags in order, duplicate grows the tag, delete prunes',()=>{
 let d=sheetDoc(6);const ids=d.assets[0].frames.map(f=>f.id);
 let s=D.clickSelect({},ids[1],{},ids);s=D.clickSelect(s,ids[4],{shift:true},ids);assert.deepEqual(s.selected,ids.slice(1,5));
 s=D.clickSelect(s,ids[2],{mod:true},ids);assert.deepEqual(s.selected,[ids[1],ids[3],ids[4]]);
 d=D.tagFromRange(d,'a',1,3,{name:'walk'});const tag=()=>d.assets[0].tags[0];
 assert.deepEqual(tag().frameIds,ids.slice(1,4));assert.equal(d.assets[0].frames[2].tag,'walk');
 d=D.moveFrames(d,'a',[ids[3]],0);assert.deepEqual(d.assets[0].frames.map(f=>f.id),[ids[3],ids[0],ids[1],ids[2],ids[4],ids[5]]);
 assert.deepEqual(tag().frameIds,[ids[3],ids[1],ids[2]],'the tag lists its frames in the new timeline order, still forward');
 const r=D.duplicateFrames(d,'a',[ids[2]]);d=r.doc;assert.equal(d.assets[0].frames.length,7);assert.ok(tag().frameIds.includes(r.ids[0]),'the copy joins the tag it was made in');
 d=D.deleteFrames(d,'a',[ids[1]]);assert.ok(!tag().frameIds.includes(ids[1]));
 d=D.setDurations(d,'a',[ids[0],ids[2]],80);assert.deepEqual(d.assets[0].frames.filter(f=>f.duration===80).map(f=>f.id).sort(),[ids[0],ids[2]].sort());
 let e=sheetDoc(4);const eid=e.assets[0].frames.map(f=>f.id);e=P.addTag(e,'a',{id:'r',name:'r',frameIds:[eid[2],eid[1]],direction:'pingpong'});
 e=D.moveFrames(e,'a',[eid[3]],0);assert.deepEqual(e.assets[0].tags[0].frameIds,[eid[2],eid[1]],'a backwards-listed tag (ping-pong reverse) stays backwards');
});
test('boxes with scope keep one id; relative moves, fill, copy, remove; pivot in pixels; mirror metadata',()=>{
 let d=sheetDoc(3);const ids=d.assets[0].frames.map(f=>f.id);
 const r=D.addBox(d,'a',ids,{shape:'rect',type:'Hit',x:1.4,y:1.6,w:3.2,h:2});d=r.doc;
 assert.ok(d.assets[0].frames.every(f=>f.boxes.length===1&&f.boxes[0].id===r.id&&f.boxes[0].x===1&&f.boxes[0].y===2&&f.boxes[0].type==='hit'));
 d=D.updateBox(d,'a',[ids[0]],r.id,b=>({x:b.x+2}));assert.deepEqual(d.assets[0].frames.map(f=>f.boxes[0].x),[3,1,1]);
 d=D.removeBox(d,'a',[ids[1]],r.id);assert.equal(d.assets[0].frames[1].boxes.length,0);
 d=D.updateBox(d,'a',ids,r.id,{y:5},{fill:true,template:d.assets[0].frames[0].boxes[0]});assert.ok(d.assets[0].frames.every(f=>f.boxes[0]?.y===5),'a scope edit fills frames that lacked the box');
 d=D.copyBoxes(d,'a',ids[0],[ids[2]]);assert.equal(d.assets[0].frames[2].boxes[0].x,3);
 d=D.setPivotPx(d,'a',[ids[0]],4,7);assert.deepEqual([d.assets[0].frames[0].pivotX,d.assets[0].frames[0].pivotY],[.5,7/8]);
 const m=D.mirrorFrameMeta(d.assets[0].frames[0]);assert.equal(m.id,ids[0]);assert.equal(m.boxes[0].id,r.id);assert.equal(m.boxes[0].x,8-3-3);
 assert.equal(D.boxColor('hurt'),'#3fa9ff');assert.equal(D.cleanType(' Grab Box '),'grab_box');
});
test('frame files: walk_01, walk-2, "attack 3", "attack (10)" group by name in natural order; placement bottom-centres',()=>{
 assert.deepEqual(['walk_01.png','walk-2.png','attack 3.png','attack (10).png','run/0003.png','hero_run_0.png','player_walk1.png'].map(n=>{const k=frameKey(n);return [k.base,k.index];}),
  [['walk',1],['walk',2],['attack',3],['attack',10],['run',3],['hero_run',0],['player_walk',1]]);
 const names=['walk_10.png','attack 3.png','walk_2.png','attack (1).png','walk_01.png','idle.png'],g=groupFrameFiles(names);
 assert.deepEqual(g.groups.map(x=>[x.name,x.items.map(i=>names[i])]),[['walk',['walk_01.png','walk_2.png','walk_10.png']],['attack',['attack (1).png','attack 3.png']],['idle',['idle.png']]]);
 assert.equal(g.decision.chosen,'names');assert.equal(groupFrameFiles(names,{mode:'single'}).groups.length,1);
 const p=placeFrames([{w:10,h:20},{w:6,h:10}]);assert.deepEqual([p.width,p.height,p.offsets[1]],[10,20,{x:2,y:10}]);assert.equal(p.decision.chosen,'bottom-center');
 assert.equal(placeFrames([{w:4,h:4},{w:4,h:4}]).decision,null);
});
test('sheet plan: grid cells skip empties, rows become tags, alternatives listed, islands on request',()=>{
 const cells=[{x:0,y:0,w:8,h:8,row:0,col:0,empty:false},{x:8,y:0,w:8,h:8,row:0,col:1,empty:false},{x:0,y:8,w:8,h:8,row:1,col:0,empty:false},{x:8,y:8,w:8,h:8,row:1,col:1,empty:true}];
 const analysis={width:16,height:16,key:null,grids:[{cellWidth:8,cellHeight:8,marginX:0,marginY:0,spacingX:0,spacingY:0,confidence:'high',score:.9,reasons:['r']}],cells:{0:cells},
  auto:{rects:[{x:0,y:0,w:16,h:8,row:0}],reason:'x',reasonCode:'uniform',attached:0,unassigned:0}};
 const p=sheetPlan(analysis);
 assert.equal(p.rects.length,3);assert.deepEqual(p.tags.map(t=>t.positions),[[0,1],[2]]);
 const slice=p.decisions.find(d=>d.id==='slice');assert.equal(slice.chosen,'grid:0');assert.ok(slice.alternatives.includes('auto')&&slice.alternatives.includes('custom'));
 assert.equal(p.decisions.find(d=>d.id==='animations').chosen,'rows');assert.equal(p.decisions.find(d=>d.id==='timing').confidence,'low');
 const q=sheetPlan(analysis,{slice:'auto',animations:'single'});assert.equal(q.rects.length,1);assert.equal(q.tags.length,1);
 assert.equal(sheetPlan(analysis,{slice:'custom',grid:{w:16,h:8,ox:0,oy:0,sx:0,sy:0}}).rects.length,2);
});
test('grid re-rank: split cells lose to the unsplit sub-grid; strips get an exact cell; crossings demote',()=>{
 const g=(w,h,e,extra={})=>({cellWidth:w,cellHeight:h,marginX:0,marginY:0,spacingX:0,spacingY:0,columns:1,rows:1,cells:e.filledCells,score:.8,confidence:'high',reasons:[],evidence:e,...extra});
 const r=rerankGrids([g(48,96,{splitRows:72,filledCells:30}),g(48,48,{filledCells:60,crossingsY:2})],{width:288,height:480});
 assert.deepEqual([r[0].cellWidth,r[0].cellHeight],[48,48]);assert.match(r[0].reasons[0],/ranked above 48×96/);
 const s=rerankGrids([g(32,24,{filledCells:9},{columns:9,rows:1})],{width:288,height:26});assert.deepEqual([s[0].cellWidth,s[0].cellHeight,s[0].fitted],[32,26,true]);
 const c=rerankGrids([g(1024,8,{filledCells:796,crossingsY:116976}),g(1024,1024,{filledCells:14,crossingsY:0})],{width:4096,height:4096});assert.deepEqual([c[0].cellWidth,c[0].cellHeight],[1024,1024]);
});
test('GIF decoder: real CC0 GIF, 6 frames with delays and loop count; truncation is reported',()=>{
 const bytes=readFileSync(fx('sprite/trooper_run.gif')),g=decodeGIF(bytes);
 assert.equal(g.frames.length,6);assert.deepEqual([g.width,g.height],[32,32]);assert.ok(g.frames.every(f=>f.delay===120&&f.rawDelay===120));assert.equal(g.loop,0);assert.deepEqual(g.warnings,[]);
 assert.throws(()=>decodeGIF(new Uint8Array([1,2,3,4,5,6,7])),/Not a GIF/);
 assert.ok(decodeGIF(bytes.subarray(0,900)).warnings.length>0);
});
test('APNG decoder: frames equal the GIF they were made from',async()=>{
 const bytes=new Uint8Array(readFileSync(fx('sprite/trooper_run.apng.png')));assert.ok(isAPNG(bytes));
 const a=await decodeAPNG(bytes),g=decodeGIF(readFileSync(fx('sprite/trooper_run.gif')));
 assert.equal(a.frames.length,6);for(let i=0;i<6;i++)assert.equal(diffPx(a.frames[i].rgba,g.frames[i].rgba),0,'frame '+i);
});
test('Aseprite bridge: layers kept only when exact; round trip keeps tags, durations and pixels',()=>{
 for(const name of ['indexed-features','blend-rgba','tilemap-flips']){
  const doc=readAseprite(readFileSync(fx(`aseprite/${name}.aseprite`))),c=asepriteContent(doc),blobs=new Map();let k=0;
  const frames=c.frames.map((fr,i)=>({name:'f'+i,duration:fr.duration,...c.frameMeta[i],cels:fr.cels.map(cel=>{const id=(++k).toString(16).padStart(64,'0');blobs.set(id,{width:cel.width,height:cel.height,data:cel.rgba});return {layer:cel.layer,blob:id,x:cel.x,y:cel.y,opacity:cel.opacity};})}));
  const asset=animatedAsset({name,width:c.width,height:c.height,layers:c.layers,frames,tags:c.tags,slices:c.slices,importInfo:{kind:'aseprite',decisions:c.decisions,sliceBoxes:c.sliceBoxes,pivotSlice:c.pivotSlice}});
  P.normalizeProject({...P.createProject({id:'p'}),assets:[asset]});
  const back=readAseprite(writeAseprite(asepriteFromAsset(asset,id=>blobs.get(id)).doc));
  assert.deepEqual(back.frames.map(f=>f.duration),doc.frames.map(f=>f.duration),name);
  assert.deepEqual(back.tags.map(t=>[t.name,t.from,t.to,t.direction,t.repeat]),doc.tags.map(t=>[t.name,t.from,t.to,t.direction,t.repeat]),name);
  for(let i=0;i<doc.frames.length;i++)assert.equal(diffPx(renderFrame(doc,i).rgba,renderFrame(back,i).rgba),0,`${name} frame ${i}`);
 }
});
test('atlas data: Aseprite JSON hash (torch) and Starling XML → named frames',()=>{
 const a=parseAtlas(readFileSync(fx('game/corpus/torch/Torch_Hash.json'),'utf8'),'Torch_Hash.json');assert.equal(a.format,'aseprite-json');
 const {frames,decisions}=atlasFrames(a,{width:4096,height:4096});assert.ok(frames.length>=4&&frames.every(f=>f.duration>0));assert.equal(decisions[0].id,'frames');
 const x=parseAtlas('<TextureAtlas imagePath="s.png"><SubTexture name="walk_01.png" x="0" y="0" width="8" height="8"/><SubTexture name="walk_02.png" x="8" y="0" width="8" height="8" frameX="-1" frameY="-2" frameWidth="10" frameHeight="12"/></TextureAtlas>');
 const r=atlasFrames(x,{width:16,height:8});assert.equal(r.frames[1].canvasWidth,10);assert.equal(r.frames[1].offsetX,1);assert.equal(r.tags[0].name,'walk');
});
