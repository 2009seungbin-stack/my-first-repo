import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/studio/canvas/view-math.js';
import * as O from '../src/studio/canvas/overlay-math.js';
import {History,edit} from '../src/studio/core/history.js';
import {Keymap,DEFAULT_KEYS,parseCombo,eventCombo,displayCombo,isTypingTarget} from '../src/studio/core/keymap.js';
import * as P from '../src/studio/core/project.js';
import {writeProjectFile,readProjectFile,sha256Hex,imagePath} from '../src/studio/core/nerulio-file.js';
import {readZip} from '../src/studio/core/zip-read.js';
import {zip} from '../src/core.js';
import {STUDIO_STRINGS,st} from '../src/studio/strings.js';
import {WorkspaceRegistry} from '../src/studio/workspaces/registry.js';

// ---------------------------------------------------------------- canvas math
test('zoom levels are integer or 1/n only, ordered, and stepping stays on the list',()=>{
 for(const z of V.ZOOMS)assert(V.isValidZoom(z),String(z));
 assert.deepEqual([...V.ZOOMS].sort((a,b)=>a-b),[...V.ZOOMS]);
 assert.equal(V.stepZoom(1,1),2);assert.equal(V.stepZoom(1,-1),1/2);assert.equal(V.stepZoom(8,1),10);
 assert.equal(V.stepZoom(V.MAX_ZOOM,1),V.MAX_ZOOM);assert.equal(V.stepZoom(V.MIN_ZOOM,-1),V.MIN_ZOOM);
 assert(!V.isValidZoom(2.716)&&!V.isValidZoom(1.5)&&!V.isValidZoom(0.4));
 assert.equal(V.floorZoom(2.716),2);assert.equal(V.floorZoom(0.4),1/3);assert.equal(V.floorZoom(6.15),6);
 assert.equal(V.zoomPercent(1/3),'33.3');assert.equal(V.zoomPercent(4),'400');
});
test('zoom anchored at the cursor keeps the image point under it (within a device pixel)',()=>{
 let v=V.view(3,-120,57);
 for(const [ax,ay]of [[0,0],[517,311],[1440,900],[33.5,77.25]]){
  for(const target of [1,2,8,32,1/4,128]){
   const before=V.toImage(v,ax,ay),next=V.zoomAt(v,target,ax,ay),after=V.toImage(next,ax,ay);
   assert(Number.isInteger(next.x)&&Number.isInteger(next.y));
   assert(Math.abs(after.x-before.x)*target<=0.5+1e-9&&Math.abs(after.y-before.y)*target<=0.5+1e-9,`${ax},${ay} @${target}`);
  }
 }
 // repeated in/out steps do not drift the anchor by a whole image pixel
 for(let i=0;i<40;i++)v=V.zoomAt(v,V.stepZoom(v.scale,i%3?1:-1),700,400);
 const p=V.toImage(v,700,400);assert(Number.isFinite(p.x));
});
test('screen ↔ image transforms are inverse and pixelAt is exact at pixel edges',()=>{
 const v=V.view(4,10,20);
 const s=V.toScreen(v,7,3);assert.deepEqual(s,{x:38,y:32});assert.deepEqual(V.toImage(v,38,32),{x:7,y:3});
 assert.deepEqual(V.pixelAt(v,38,32,16,16),{x:7,y:3});assert.deepEqual(V.pixelAt(v,41.99,35.99,16,16),{x:7,y:3});
 assert.deepEqual(V.pixelAt(v,42,36,16,16),{x:8,y:4});assert.equal(V.pixelAt(v,9,20,16,16),null);assert.equal(V.pixelAt(v,10+64,20,16,16),null);
 const half=V.view(1/2,0,0);assert.deepEqual(V.toImage(half,5,5),{x:10,y:10});
});
test('fit picks the largest integer (or 1/n) zoom that fits, and centres on whole pixels',()=>{
 assert.equal(V.fitZoom(256,64,1000,700),3);// 3.9 → 3, never 3.9
 assert.equal(V.fitZoom(4096,4096,1200,800),1/6);// 0.195 → 1/6
 assert.equal(V.fitZoom(16,16,1000,1000,{max:16}),16);
 const f=V.fitView(256,64,1000,700);assert.equal(f.scale,3);assert.equal(f.x,Math.round((1000-768)/2));assert(Number.isInteger(f.y));
 assert.equal(V.fitZoom(100,100,20,20,{pad:40}),V.floorZoom(1/100));
});
test('clamping keeps part of the image visible; visible rect is clipped to the image',()=>{
 const c=V.clampView(V.view(2,-10000,5000),100,100,800,600,48);
 assert(c.x+200>=48&&c.y<=600-48);
 assert.deepEqual(V.visibleRect(V.view(2,-20,-40),100,100,64,64),{x:10,y:20,w:50,h:44});
 assert.deepEqual(V.visibleRect(V.view(1,500,500),100,100,64,64),{x:0,y:0,w:0,h:0});
});
test('snapping: corners to pixel edges, points to centres',()=>{
 assert.deepEqual(V.snapPoint({x:3.49,y:3.51}),{x:3,y:4});assert.deepEqual(V.snapPoint({x:3.49,y:3.51},'center'),{x:3.5,y:3.5});
 assert.deepEqual(V.snapPoint({x:-0.2,y:7.99},'floor'),{x:-1,y:7});assert.deepEqual(V.snapPoint({x:1.2,y:1.7},'none'),{x:1.2,y:1.7});
});
test('pixel grid appears at 8 device px per pixel; custom grid ranges and cell counts',()=>{
 assert.equal(V.pixelGridAlpha(6),0);assert(V.pixelGridAlpha(8)>0);assert.equal(V.pixelGridAlpha(64),1);
 const g=V.normalizeGrid({w:16,h:16,ox:1,oy:1,sx:1,sy:1});
 assert.deepEqual(V.gridCell(g,2,1),{x:35,y:18,w:16,h:16});
 assert.deepEqual(V.gridCellsIn(g,203,118),{cols:11,rows:6,count:66});// Kenney 1px-spaced 16px sheet shape
 const r=V.gridRange(g,{x:0,y:0,w:50,h:20});assert.deepEqual([r.c0,r.c1,r.r0,r.r1],[0,2,0,1]);
 assert.deepEqual(V.normalizeGrid({w:'x',h:0,ox:-3}),{w:16,h:1,ox:0,oy:0,sx:0,sy:0});
 assert.equal(V.rulerStep(1,48),50);assert.equal(V.rulerStep(8,48),10);assert.equal(V.rulerStep(1/8,48),500);
});
test('wheel: pinch deltas accumulate into whole steps; mouse vs trackpad heuristic',()=>{
 let acc=0,steps=0;for(let i=0;i<30;i++){const r=V.wheelSteps(acc,-4);acc=r.rest;steps+=r.steps;}
 assert.equal(steps,-2);
 assert(V.looksLikeMouseWheel({deltaMode:0,deltaX:0,deltaY:100}));assert(V.looksLikeMouseWheel({deltaMode:1,deltaY:3}));
 assert(!V.looksLikeMouseWheel({deltaMode:0,deltaX:0,deltaY:4}));assert(!V.looksLikeMouseWheel({deltaMode:0,deltaX:2,deltaY:100}));assert(!V.looksLikeMouseWheel({deltaY:33.3}));
});
// ---------------------------------------------------------------- overlay math
test('handles and rect drags snap to pixels, keep a minimum size and respect bounds',()=>{
 const r={x:10,y:10,w:20,h:10};
 assert.equal(O.hitHandle(r,{x:10.4,y:9.8},1),'nw');assert.equal(O.hitHandle(r,{x:20,y:20.5},1),'s');assert.equal(O.hitHandle(r,{x:20,y:15},1),null);
 assert.deepEqual(O.dragRect(r,'move',3.4,-2.6),{x:13,y:7,w:20,h:10});
 assert.deepEqual(O.dragRect(r,'se',5.2,5.7),{x:10,y:10,w:25,h:16});
 assert.deepEqual(O.dragRect(r,'w',50,0),{x:29,y:10,w:1,h:10});// never inverts
 assert.deepEqual(O.dragRect(r,'nw',-100,-100,{bounds:{x:0,y:0,w:64,h:64}}),{x:0,y:0,w:30,h:20});
 assert.deepEqual(O.dragRect(r,'move',100,0,{bounds:{x:0,y:0,w:64,h:64}}),{x:44,y:10,w:20,h:10});
 const m=O.moveRects([{x:0,y:0,w:4,h:4},{x:10,y:10,w:4,h:4}],-3,55,{x:0,y:0,w:32,h:32});assert.deepEqual([m.dx,m.dy],[0,18]);
 assert.deepEqual(O.rectFromPoints({x:5.7,y:9.2},{x:1.2,y:3.9}),{x:1,y:3,w:5,h:7});
});
test('polygon, point and guide hit-testing',()=>{
 const tri=[[0,0],[10,0],[0,10]];
 assert.deepEqual(O.hitPolygon(tri,{x:10.3,y:0.2},0.5),{part:'vertex',index:1});
 assert.deepEqual(O.hitPolygon(tri,{x:5,y:5.2},0.5),{part:'edge',index:1});
 assert.deepEqual(O.hitPolygon(tri,{x:2,y:2},0.5),{part:'inside',index:-1});assert.equal(O.hitPolygon(tri,{x:9,y:9},0.5),null);
 assert(O.hitPoint({x:4,y:4},{x:4.9,y:3.2},1));assert(!O.hitPoint({x:4,y:4},{x:5.2,y:4},1));
 assert(O.hitGuide({axis:'x',pos:12},{x:12.4,y:900},.5));assert(!O.hitGuide({axis:'y',pos:12},{x:12,y:13},.5));
});
test('RectIndex answers the same as a linear scan on 5 000 rects',()=>{
 const items=[];let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<5000;i++)items.push({x:Math.floor(rnd()*4000),y:Math.floor(rnd()*4000),w:1+Math.floor(rnd()*64),h:1+Math.floor(rnd()*64)});
 const idx=new O.RectIndex(items);
 for(let k=0;k<50;k++){
  const q={x:Math.floor(rnd()*4000),y:Math.floor(rnd()*4000),w:Math.floor(rnd()*600),h:Math.floor(rnd()*600)};
  const want=items.map((it,i)=>[it,i]).filter(([it])=>it.x<=q.x+q.w&&q.x<=it.x+it.w&&it.y<=q.y+q.h&&q.y<=it.y+it.h).map(([,i])=>i);
  assert.deepEqual(idx.query(q),want);
 }
 assert.deepEqual(new O.RectIndex([]).query({x:0,y:0,w:9,h:9}),[]);
 assert.deepEqual(idx.query({x:-1e6,y:-1e6,w:3e6,h:3e6}).length,5000);
});
// ---------------------------------------------------------------- history
test('history: do/undo/redo, redo branch dropped by a new edit, dirty tracking',()=>{
 const h=new History({n:0});
 const inc=by=>edit(`+${by}`,d=>({n:d.n+by}));
 h.execute(inc(1));h.execute(inc(2));assert.equal(h.doc.n,3);assert(h.dirty);
 h.markSaved();assert(!h.dirty);
 assert(h.undo());assert.equal(h.doc.n,1);assert(h.dirty);assert.equal(h.redoLabel,'+2');
 h.execute(inc(10));assert.equal(h.doc.n,11);assert(!h.canRedo);assert.equal(h.entries.length,2);
 h.undo();h.undo();assert.equal(h.doc.n,0);assert(!h.undo());
 h.jump(2);assert.equal(h.doc.n,11);h.jump(0);assert.equal(h.doc.n,0);
 assert.equal(h.execute(edit('noop',d=>d)),null);assert.equal(h.entries.length,2);
});
test('history: drag commands merge into one step; a merge back to the start removes it',()=>{
 let t=0;const h=new History({x:0},{now:()=>t,mergeWindow:500});
 const move=x=>edit('Move',d=>({x}),{mergeKey:'drag-1',open:true});
 for(let x=1;x<=40;x++){t+=16;h.execute(move(x));}
 assert.equal(h.entries.length,1);assert.equal(h.doc.x,40);
 t+=5000;h.execute(move(41));assert.equal(h.entries.length,1,'open drag keeps merging past the window');
 h.close('drag-1');t+=10;h.execute(move(42));assert.equal(h.entries.length,2,'closed entry starts a new step');
 h.undo();h.undo();assert.equal(h.doc.x,0);
 // nudges merge within the window only
 const h2=new History({x:0},{now:()=>t,mergeWindow:500});const nudge=()=>edit('Nudge',d=>({x:d.x+1}),{mergeKey:'nudge'});
 h2.execute(nudge());t+=100;h2.execute(nudge());t+=2000;h2.execute(nudge());assert.equal(h2.entries.length,2);
 const h3=new History({x:0});h3.execute(edit('a',()=>({x:5}),{mergeKey:'k'}));const same=h3.doc;
 h3.execute(edit('b',()=>h3.entries[0].before,{mergeKey:'k'}));assert.equal(h3.entries.length,0);assert.notEqual(h3.doc,same);
});
test('history: custom do/undo commands, limit, listeners',()=>{
 const log=[],h=new History(null,{limit:3});let events=0;h.subscribe(()=>events++);
 for(let i=0;i<5;i++)h.execute({label:'c'+i,do:()=>log.push('do'+i),undo:()=>log.push('undo'+i)});
 assert.equal(h.entries.length,3);assert.equal(h.index,3);h.undo();assert.deepEqual(log.slice(-1),['undo4']);h.redo();assert.deepEqual(log.slice(-1),['do4']);
 assert(events>=7);assert.throws(()=>h.execute({label:'bad'}));
});
// ---------------------------------------------------------------- keymap
test('keymap: parse, event matching by physical key (IME-safe), symbols, display',()=>{
 assert.equal(parseCombo('shift+mod+z'),'Mod+Shift+Z');assert.equal(parseCombo('Mod++'),'Mod++');assert.equal(parseCombo('?'),'?');assert.throws(()=>parseCombo('Mod+A+B'));
 const ev=(o)=>({ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...o});
 assert.equal(eventCombo(ev({code:'KeyZ',key:'ㅋ',ctrlKey:true})),'Mod+Z');
 assert.equal(eventCombo(ev({code:'KeyZ',key:'Z',ctrlKey:true,shiftKey:true})),'Mod+Shift+Z');
 assert.equal(eventCombo(ev({code:'KeyZ',key:'z',metaKey:true}),{mac:true}),'Mod+Z');
 assert.equal(eventCombo(ev({code:'Slash',key:'?',shiftKey:true})),'?');
 assert.equal(eventCombo(ev({code:'Equal',key:'+',shiftKey:true})),'+');
 assert.equal(eventCombo(ev({code:'Quote',key:'"',shiftKey:true,ctrlKey:true})),"Mod+Shift+'");
 assert.equal(eventCombo(ev({code:'Space',key:' '})),'Space');assert.equal(eventCombo(ev({code:'Digit1',key:'1'})),'1');
 assert.equal(eventCombo(ev({code:'Comma',key:','})),',');
 const k=new Keymap();
 assert.equal(k.lookup('Mod+Z'),'edit.undo');assert.equal(k.lookup('Mod+Y'),'edit.redo');assert.equal(k.lookup('Mod+Shift+Z'),'edit.redo');
 assert.equal(k.lookup('Mod+K'),'app.palette');assert.equal(k.lookup('?'),'app.shortcuts');assert.equal(k.lookup('1'),'view.zoom100');assert.equal(k.lookup('0'),'view.fit');
 assert.deepEqual(Keymap.conflicts(DEFAULT_KEYS),[]);
 assert.equal(displayCombo('Mod+Shift+Z'),'Ctrl+Shift+Z');assert.equal(displayCombo('Mod+Shift+Z',{mac:true}),'⌘⇧Z');assert.equal(displayCombo('Mod++'),'Ctrl++');
 assert(isTypingTarget({tagName:'INPUT',type:'number'}));assert(!isTypingTarget({tagName:'INPUT',type:'checkbox'}));assert(isTypingTarget({tagName:'DIV',isContentEditable:true}));assert(!isTypingTarget({tagName:'BUTTON'}));
});
// ---------------------------------------------------------------- project + file
const HASH='a'.repeat(64),HASH2='b'.repeat(64);
function sampleDoc(){
 let d=P.createProject({id:'p1',name:'Hero',createdAt:'2026-09-23T00:00:00.000Z'});
 const a=P.imageAsset({id:'a1',name:'hero_sheet.png',width:128,height:64,blob:HASH,source:{name:'hero_sheet.png',type:'image/png',size:1234,lastModified:5}});
 d=P.addAssets(d,[a,P.imageAsset({id:'a2',name:'tiles.png',width:32,height:32,blob:HASH2})]);
 d=P.setFrames(d,'a1',P.framesFromCells(a,[{x:0,y:0,w:32,h:32},{x:32,y:0,w:32,h:32},{x:64,y:0,w:32,h:32}]));
 d=P.setGrid(d,'a1',{w:32,h:32,ox:0,oy:0,sx:0,sy:0});
 const ids=P.assetById(d,'a1').frames.map(f=>f.id);
 d=P.addTag(d,'a1',{name:'walk',frameIds:ids.slice(0,2),fps:10,direction:'pingpong'});
 d=P.addSlice(d,'a1',{name:'hitbox',keys:[{frame:0,bounds:{x:8,y:4,w:16,h:24},pivot:{x:16,y:31}}]});
 d=P.updateFrame(d,'a1',ids[0],{pivotX:.5,pivotY:1,duration:120,boxes:[{type:'hit',shape:'rect',x:1,y:2,w:3,h:4}]});
 return d;
}
test('project edits are immutable and share untouched parts',()=>{
 const d=sampleDoc(),a=P.assetById(d,'a1'),f=a.frames[1];
 const d2=P.setFrameRects(d,'a1',{[f.id]:{x:40,y:2,w:30,h:30}});
 assert.notEqual(d2,d);assert.equal(P.assetById(d2,'a2'),P.assetById(d,'a2'));
 assert.equal(P.assetById(d2,'a1').frames[0],a.frames[0]);assert.deepEqual(P.assetById(d2,'a1').frames[1].sourceRect,{x:40,y:2,w:30,h:30});
 assert.deepEqual(a.frames[1].sourceRect,{x:32,y:0,w:32,h:32},'original untouched');
 assert.equal(P.setFrameRects(d,'a1',{[f.id]:{...f.sourceRect}}),d,'no-op returns the same document');
 const clamped=P.setFrameRects(d,'a1',{[f.id]:{x:120,y:60,w:30,h:30}});assert.deepEqual(P.assetById(clamped,'a1').frames[1].sourceRect,{x:120,y:60,w:8,h:4});
 const removed=P.removeFrames(d,'a1',[a.frames[0].id]);assert.deepEqual(P.assetById(removed,'a1').tags[0].frameIds,[a.frames[1].id],'tags lose removed frames');
 assert.equal(P.addTag(d,'a1',{name:'walk',frameIds:[]}).assets[0].tags[1].name,'walk_2');
 assert.deepEqual([...P.referencedBlobs(d)],[HASH,HASH2]);assert.deepEqual(P.stats(d),{assets:2,frames:3,pixels:128*64+32*32,blobs:2});
 assert.throws(()=>P.renameAsset(d,'nope','x'));
});
test('normalizeProject accepts its own output and rejects broken documents with reasons',()=>{
 const d=sampleDoc(),again=P.normalizeProject(JSON.parse(JSON.stringify(d)));assert.deepEqual(again,d);
 const bad=JSON.parse(JSON.stringify(d));bad.assets[0].frames[0].sourceRect.x=120;assert.throws(()=>P.normalizeProject(bad),/outside its image/);
 const bad2=JSON.parse(JSON.stringify(d));bad2.assets[0].cels[0].blob='../../x';assert.throws(()=>P.normalizeProject(bad2),/image reference/);
 const newer=JSON.parse(JSON.stringify(d));newer.version=99;assert.throws(()=>P.normalizeProject(newer),/newer Studio/);
 assert.throws(()=>P.normalizeProject({format:'x'}),/Not a Nerulio project/);
 const dupe=JSON.parse(JSON.stringify(d));dupe.assets[1].id='a1';assert.throws(()=>P.normalizeProject(dupe),/Duplicate asset/);
});
const png=(n)=>{// a real (tiny) PNG-like payload; the file layer only hashes and stores bytes
 const b=new Uint8Array(64+n);b.set([137,80,78,71,13,10,26,10]);for(let i=8;i<b.length;i++)b[i]=(i*31+n)&255;return new Blob([b],{type:'image/png'});};
test('.nerulio round trip is exact: same document, same image bytes, verified hashes',async()=>{
 const img1=png(300),img2=png(17),id1=await sha256Hex(img1),id2=await sha256Hex(img2);
 let d=P.createProject({id:'p9',name:'Round trip',createdAt:'2026-09-23T01:02:03.000Z'});
 const a=P.imageAsset({id:'a1',name:'sheet.png',width:64,height:32,blob:id1}),b=P.imageAsset({id:'a2',name:'b.png',width:8,height:8,blob:id2});
 d=P.addAssets(d,[a,b,P.imageAsset({id:'a3',name:'same-pixels-again.png',width:64,height:32,blob:id1})]);
 d=P.setFrames(d,'a1',P.framesFromCells(a,[{x:0,y:0,w:32,h:32},{x:32,y:0,w:32,h:32}]));
 d=P.addTag(d,'a1',{name:'idle',frameIds:P.assetById(d,'a1').frames.map(f=>f.id)});
 d=P.addSlice(d,'a2',{name:'nine',keys:[{frame:0,bounds:{x:0,y:0,w:8,h:8},center:{x:2,y:2,w:4,h:4}}]});
 const store=new Map([[id1,img1],[id2,img2]]);
 const file=await writeProjectFile(d,id=>store.get(id),{savedAt:'2026-09-23T01:02:04.000Z'});
 const z=await readZip(file);
 assert.deepEqual(z.entries.map(e=>e.name).sort(),['images/'+id1+'.png','images/'+id2+'.png','project.json'].sort(),'each image stored once');
 const back=await readProjectFile(file);
 assert.deepEqual(back.doc,d);assert.equal(back.savedAt,'2026-09-23T01:02:04.000Z');
 for(const [id,blob]of store)assert.deepEqual(new Uint8Array(await back.blobs.get(id).arrayBuffer()),new Uint8Array(await blob.arrayBuffer()));
 // second trip is byte-identical given the same timestamp
 const again=await writeProjectFile(back.doc,id=>back.blobs.get(id),{savedAt:back.savedAt});
 assert.deepEqual(new Uint8Array(await again.arrayBuffer()),new Uint8Array(await file.arrayBuffer()));
});
test('.nerulio reader rejects tampered images, missing images and non-projects',async()=>{
 const img=png(40),id=await sha256Hex(img);
 const d=P.addAssets(P.createProject({id:'p'}),[P.imageAsset({id:'a',width:4,height:4,blob:id})]);
 const manifest=JSON.stringify({format:'nerulio-project-file',fileVersion:1,savedAt:'x',project:d});
 const tampered=await zip([{name:'project.json',blob:new Blob([manifest])},{name:imagePath(id),blob:png(41)}],{paths:true});
 await assert.rejects(readProjectFile(tampered),/checksum/);
 const missing=await zip([{name:'project.json',blob:new Blob([manifest])}],{paths:true});
 await assert.rejects(readProjectFile(missing),/not in the file/);
 await assert.rejects(readProjectFile(await zip([{name:'a.txt',blob:new Blob(['x'])}],{paths:true})),/no project.json/);
 await assert.rejects(readProjectFile(new Blob(['not a zip'])),/Not a ZIP/);
});
test('zip reader inflates deflated entries and checks CRCs',async()=>{
 // Build a one-entry deflated ZIP by hand around CompressionStream('deflate-raw').
 const data=new TextEncoder().encode('hello hello hello hello studio'.repeat(20));
 const comp=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
 const {crc32}=await import('../src/core.js');const crc=crc32(data),name=new TextEncoder().encode('t.txt');
 const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(8,8,true);lv.setUint32(14,crc,true);lv.setUint32(18,comp.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
 const cen=new Uint8Array(46+name.length),cv=new DataView(cen.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(10,8,true);cv.setUint32(16,crc,true);cv.setUint32(20,comp.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,0,true);cen.set(name,46);
 const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,1,true);ev.setUint16(10,1,true);ev.setUint32(12,cen.length,true);ev.setUint32(16,local.length+comp.length,true);
 const z=await readZip(new Blob([local,comp,cen,end]));assert.equal(await z.text('t.txt'),new TextDecoder().decode(data));
 const broken=comp.slice();broken[broken.length>>1]^=0xff;
 await assert.rejects((async()=>{const zz=await readZip(new Blob([local,broken,cen,end]));await zz.text('t.txt');})());
});
// ---------------------------------------------------------------- strings + workspace API
test('studio strings exist in ko, en and ja with the same keys and placeholders',()=>{
 const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?keys(v,p+k+'.'):[p+k]);
 const en=keys(STUDIO_STRINGS.en).sort();
 for(const l of ['ko','ja']){assert.deepEqual(keys(STUDIO_STRINGS[l]).sort(),en,l);
  for(const k of en){const slots=s=>[...String(s).matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join();assert.equal(slots(st(l,k)),slots(st('en',k)),`${l}:${k}`);}
  for(const k of en)assert(!/[가-힣]/.test(st('ja',k)),`ja has Hangul in ${k}`);
 }
 assert.equal(st('en','status.zoom',{z:'400'}),'400%');assert.equal(st('xx','menu.file'),st('en','menu.file'));
});
test('workspace registry validates plug-ins and keeps registration order',()=>{
 const r=new WorkspaceRegistry();
 r.register({id:'viewer',title:'ws.viewer',status:'ready',activate(){return {};}});
 r.register({id:'sprite',title:'ws.sprite',status:'coming',phase:'P1'});
 assert.deepEqual(r.list().map(w=>w.id),['viewer','sprite']);
 assert.throws(()=>r.register({id:'viewer',title:'x',status:'ready',activate(){}}),/already/);
 assert.throws(()=>r.register({id:'x',title:'x',status:'ready'}),/activate/);
 assert.throws(()=>r.register({id:'Bad Id',title:'x',status:'coming'}),/id/);
 assert.equal(r.firstReady().id,'viewer');
});
