import test from 'node:test';import assert from 'node:assert/strict';
import {mergeRects,readingOrder,detectFrames,framesFromRects,alignOffset,shiftFrame,normalizeFrames,applyPivot,tightenFrames,unionRect,rectGap,ALIGNMENTS} from '../src/game/frame-ops.js';
import {frame,pivotPixels} from '../src/game/model.js';
import {innerRect} from '../src/game/pixels.js';
import {canvas,box,disc,blit,gridSheet,irregularSheet,disconnectedSprite,walker,hundredFrames,bbox} from './game-fixtures.mjs';

test('nearby components merge into one frame; distant ones stay apart',()=>{
 const sprite=disconnectedSprite(),sheet=canvas(100,60);
 blit(sheet,sprite,4,4);blit(sheet,sprite,56,4);
 const loose=detectFrames(sheet,{distance:0});
 assert(loose.rects.length>=10,`islands stay separate at distance 0 (${loose.rects.length})`);
 const merged=detectFrames(sheet,{distance:4});
 assert.equal(merged.rects.length,2,'each character becomes one frame');
 assert.deepEqual(merged.rects.map(r=>r.parts.length),[6,6],'six islands each: head, torso, two arms, two legs');
 assert.deepEqual(merged.rects[0],{...merged.rects[0],x:4+6,y:4+2,w:29,h:44},JSON.stringify(merged.rects[0]));
 assert.equal(merged.rows,1);
});
test('rectangle gaps and unions are measured, not guessed',()=>{
 assert.deepEqual(rectGap({x:0,y:0,w:10,h:10},{x:13,y:0,w:5,h:5}),{x:3,y:0});
 assert.deepEqual(rectGap({x:0,y:0,w:10,h:10},{x:4,y:4,w:5,h:5}),{x:0,y:0},'overlap is gap zero');
 assert.deepEqual(unionRect([{x:2,y:5,w:3,h:3},{x:10,y:1,w:2,h:2}]),{x:2,y:1,w:10,h:7});
 assert.throws(()=>mergeRects([{x:0,y:0,w:1,h:1}],{distance:-1}),/0…512/);
 assert.deepEqual(mergeRects([{x:0,y:0,w:4,h:4},{x:4,y:0,w:4,h:4}],{distance:0}).length,1,'touching merges at distance 0');
 assert.deepEqual(mergeRects([{x:0,y:0,w:4,h:4},{x:5,y:0,w:4,h:4}],{distance:0}).length,2);
 const chain=mergeRects([{x:0,y:0,w:4,h:4},{x:6,y:0,w:4,h:4},{x:12,y:0,w:4,h:4}],{distance:2});
 assert.equal(chain.length,1,'merging chains through the middle rectangle');
});
test('reading order follows rows even when frame heights differ',()=>{
 const rects=[{x:60,y:2,w:10,h:30},{x:4,y:6,w:10,h:14},{x:30,y:0,w:10,h:34},{x:4,y:50,w:10,h:20},{x:40,y:52,w:10,h:16}];
 const sorted=readingOrder(rects);
 assert.deepEqual(sorted.map(r=>[r.x,r.row]),[[4,0],[30,0],[60,0],[4,1],[40,1]]);
 assert.deepEqual(readingOrder(rects,{rightToLeft:true}).map(r=>r.x),[60,30,4,40,4]);
 assert.deepEqual(readingOrder(rects,{rowTolerance:1000}).map(r=>r.row),[0,0,0,0,0],'a huge tolerance means one row');
 assert.deepEqual(readingOrder([]),[]);
 assert.throws(()=>readingOrder(rects,{rowTolerance:-2}),/rowTolerance/);
});
test('an irregular sheet of differently sized sprites yields exactly those frames',()=>{
 const sheet=irregularSheet(),{rects}=detectFrames(sheet,{distance:2});
 assert.equal(rects.length,sheet.placed.length);
 const {frames,empty}=framesFromRects(sheet,rects);
 assert.deepEqual(empty,[]);
 for(const f of frames){
  assert.deepEqual(f.trimmedRect,f.sourceRect,'a tight component is its own trim');
  assert(sheet.placed.some(p=>p.x===f.sourceRect.x&&p.y===f.sourceRect.y&&p.w===f.sourceRect.w&&p.h===f.sourceRect.h),`${f.name} matches a drawn sprite`);
 }
 assert.deepEqual(frames.map(f=>f.name),frames.map((_,i)=>`frame_${String(i+1).padStart(3,'0')}`));
});
test('blank cells are skipped and trimming records the alpha bounds inside the cell',()=>{
 const sheet=gridSheet({cellW:32,cellH:32,cols:3,rows:1,draw:(c,i)=>i===1?null:box(c,8,10,12,14,[9,9,9,255])});
 const rects=[{x:0,y:0,w:32,h:32},{x:32,y:0,w:32,h:32},{x:64,y:0,w:32,h:32}];
 const {frames,empty}=framesFromRects(sheet,rects);
 assert.deepEqual(empty,[1]);assert.equal(frames.length,2);
 assert.deepEqual(frames[0].trimmedRect,{x:8,y:10,w:12,h:14});
 assert.deepEqual([frames[0].offsetX,frames[0].offsetY,frames[0].canvasWidth],[8,10,32]);
 assert.deepEqual(frames[1].trimmedRect,{x:64+8,y:10,w:12,h:14});
 const untrimmed=framesFromRects(sheet,rects,{trim:false});
 assert.equal(untrimmed.frames[0].trimmedRect,null);
});
test('alignment places the alpha bounding box, and "bottom" is the lowest opaque pixel',()=>{
 assert.deepEqual(alignOffset(10,20,40,40,'center'),{x:15,y:10});
 assert.deepEqual(alignOffset(10,20,40,40,'top'),{x:15,y:0});
 assert.deepEqual(alignOffset(10,20,40,40,'bottom'),{x:15,y:20});
 assert.deepEqual(alignOffset(10,20,40,40,'bottom-center'),{x:15,y:20});
 assert.deepEqual(alignOffset(10,20,40,40,'left'),{x:0,y:10});
 assert.deepEqual(alignOffset(10,20,40,40,'right'),{x:30,y:10});
 assert.deepEqual(alignOffset(10,20,40,40,'top-left'),{x:0,y:0});
 assert.deepEqual(alignOffset(10,20,40,40,'custom',{anchorX:0,anchorY:.25}),{x:0,y:5});
 assert.deepEqual(alignOffset(10,20,40,40,'bottom',{padding:4}),{x:15,y:16});
 assert.throws(()=>alignOffset(50,10,40,40,'center'),/does not fit/);
 assert.throws(()=>alignOffset(10,10,40,40,'middle'),/Unknown alignment/);
 assert.deepEqual(ALIGNMENTS.includes('bottom-center'),true);
});
test('normalize moves pixels by whole pixels and carries pivot, boxes and collision along',()=>{
 const a=frame({name:'a',sourceRect:{x:0,y:0,w:20,h:30},trimmedRect:{x:4,y:6,w:10,h:20},pivotX:.5,pivotY:1,
  boxes:[{shape:'rect',type:'hit',x:5,y:8,w:6,h:4},{shape:'circle',type:'hurt',cx:9,cy:16,r:3}],collision:[[[4,6],[14,6],[14,26]]]});
 const b=frame({name:'b',sourceRect:{x:0,y:0,w:20,h:30},trimmedRect:{x:2,y:2,w:16,h:26}});
 const before=pivotPixels(a);
 const out=normalizeFrames([a,b],{align:'bottom-center',padding:2});
 assert.deepEqual([out.canvasWidth,out.canvasHeight],[16+4,26+4]);
 const [na,nb]=out.frames;
 assert.deepEqual([nb.offsetX,nb.offsetY],[2,2],'the largest frame sits in the padding');
 assert.deepEqual([na.offsetX,na.offsetY],[5,8],'centred across, bounding-box bottom down inside the padding');
 const dx=na.offsetX-a.offsetX,dy=na.offsetY-a.offsetY;
 assert.deepEqual(pivotPixels(na),{x:before.x+dx,y:before.y+dy},'the pivot stays on the same artwork pixel');
 assert.deepEqual([na.boxes[0].x,na.boxes[0].y],[5+dx,8+dy]);
 assert.deepEqual([na.boxes[1].cx,na.boxes[1].cy],[9+dx,16+dy]);
 assert.deepEqual(na.collision[0][0],[4+dx,6+dy]);
 assert.deepEqual(out.shifts.map(s=>[s.dx,s.dy]),[[dx,dy],[0,0]]);
 assert.equal(na.canvasWidth,out.canvasWidth);
 assert.deepEqual(applyPivot(na,'center'),{...na,pivotX:.5,pivotY:.5});
 assert.deepEqual(applyPivot(na,{x:10,y:4,pixels:true}),{...na,pivotX:10/na.canvasWidth,pivotY:4/na.canvasHeight});
 assert.throws(()=>applyPivot(na,'elbow'),/Unknown pivot preset/);
});
test('normalize never scales: an explicit canvas that is too small is refused, not resampled',()=>{
 const big=frame({sourceRect:{x:0,y:0,w:64,h:64}}),small=frame({sourceRect:{x:0,y:0,w:8,h:8}});
 assert.throws(()=>normalizeFrames([big,small],{width:32,height:32}),/never scaled/);
 const out=normalizeFrames([big,small],{width:80,height:80,align:'center'});
 assert.deepEqual([out.frames[0].offsetX,out.frames[1].offsetX],[8,36]);
 assert.deepEqual(out.warnings.length>0,true);
 assert.throws(()=>normalizeFrames([]),/at least one/);
 assert.throws(()=>normalizeFrames([big],{padding:-1}),/Padding/);
 assert.throws(()=>shiftFrame(big,1.5,0),/whole pixels/);
});
test('a 100-frame animation of mixed sizes normalizes onto one canvas with content preserved',()=>{
 const images=hundredFrames();
 const sheetW=Math.max(...images.map(i=>i.width)),sheet=canvas(sheetW,images.reduce((s,i)=>s+i.height+2,0));
 let y=0;const rects=images.map(img=>{blit(sheet,img,0,y);const r={x:0,y,w:img.width,h:img.height};y+=img.height+2;return r;});
 const {frames}=framesFromRects(sheet,rects);
 assert.equal(frames.length,100);
 const out=normalizeFrames(frames,{align:'bottom-center'});
 assert.deepEqual([out.canvasWidth,out.canvasHeight],[Math.max(...images.map(i=>i.width-2)),Math.max(...images.map(i=>i.height-2))]);
 for(const f of out.frames){
  const inner=innerRect(f);
  assert(f.offsetX>=0&&f.offsetY>=0&&f.offsetX+inner.w<=out.canvasWidth&&f.offsetY+inner.h<=out.canvasHeight,`${f.name} fits`);
  assert.equal(f.offsetY+inner.h,out.canvasHeight,'every bounding box bottom lands on the canvas bottom');
 }
 const tight=tightenFrames(out.frames);
 for(let i=0;i<tight.length;i++){
  assert.deepEqual(tight[i].sourceRect,innerRect(out.frames[i]));
  assert.deepEqual([tight[i].offsetX,tight[i].offsetY],[0,0]);
  assert.equal(Math.round(tight[i].pivotX*tight[i].canvasWidth),Math.round(pivotPixels(out.frames[i]).x-out.frames[i].offsetX));
 }
});
