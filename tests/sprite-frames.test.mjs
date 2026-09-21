import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/sprite-frames.js';
const image=(w,h)=>new Uint8ClampedArray(w*h*4);
const fill=(d,w,r,alpha=255)=>{for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)d.set([200,40,60,alpha],(y*w+x)*4);};
const plain=r=>({x:r.x,y:r.y,w:r.w,h:r.h});

test('merge joins overlapping and adjacent boxes, keeps a real gap apart',()=>{
 const a={x:0,y:0,w:6,h:6},b={x:6,y:2,w:4,h:4},far={x:20,y:0,w:4,h:4};
 assert.equal(F.mergeRects([a,far],0).length,2);
 assert.deepEqual(plain(F.mergeRects([a,b],0)[0]),{x:0,y:0,w:10,h:6});
 assert.equal(F.mergeRects([a,{x:8,y:0,w:2,h:2}],0).length,2);
 assert.equal(F.mergeRects([a,{x:8,y:0,w:2,h:2}],2).length,1);
 assert.throws(()=>F.mergeRects([a],-1));
});
test('grid cells honour margin and gutter and drop a cell that would overhang',()=>{
 assert.deepEqual(F.gridFrames(4,2,{cellW:2,cellH:2}).map(plain),[{x:0,y:0,w:2,h:2},{x:2,y:0,w:2,h:2}]);
 const spaced=F.gridFrames(20,8,{cellW:4,cellH:4,offsetX:2,offsetY:2,spacingX:2,spacingY:2});
 assert.deepEqual(spaced.map(f=>f.x),[2,8,14]);
 assert.equal(spaced.length,3);// only one row fits below a 2px margin
 assert.deepEqual(F.gridFrames(9,4,{cellW:4,cellH:4}).length,2);// the 1px remainder is not a cell
 assert.throws(()=>F.gridFrames(8,8,{cellW:9,cellH:2}));
 assert.throws(()=>F.gridFrames(8,8,{cellW:2,cellH:2,spacingX:-1}));
});
test('reading order is row-major and a bobbing row stays one row',()=>{
 const rects=[{x:30,y:1,w:10,h:10},{x:0,y:0,w:10,h:10},{x:15,y:3,w:10,h:10},{x:0,y:40,w:10,h:10}];
 assert.deepEqual(F.readingOrder(rects,0).map(r=>r.x),[0,15,30,0]);
 assert.equal(F.rowTolerance(rects),5);
});
test('a common canvas is the widest and tallest frame plus padding, and every frame fits',()=>{
 const frames=[F.makeFrame(1,{x:0,y:0,w:4,h:8}),F.makeFrame(2,{x:0,y:0,w:6,h:3})];
 const laid=F.layoutFrames(frames,{mode:'common',align:'bottom',anchor:.5});
 assert.deepEqual([laid.width,laid.height],[6,8]);
 assert.deepEqual(laid.frames.map(f=>[f.offsetX,f.offsetY]),[[1,0],[0,5]]);// identical bottom edge
 const padded=F.layoutFrames(frames,{mode:'common',align:'top',anchor:0,padding:2});
 assert.deepEqual([padded.width,padded.height,padded.frames[0].offsetX],[10,12,2]);
 assert.deepEqual(F.layoutFrames(frames,{mode:'each'}).frames.map(f=>[f.canvasWidth,f.canvasHeight]),[[4,8],[6,3]]);
 assert.throws(()=>F.layoutFrames(frames,{mode:'common',width:5,height:8}));
});
test('trimmed rectangles drive the layout and the exported box',()=>{
 const f=F.makeFrame(1,{x:10,y:10,w:20,h:20},{trimmedRect:{x:12,y:14,w:4,h:6}});
 assert.deepEqual(F.boxOf(f),{x:12,y:14,w:4,h:6});
 assert.deepEqual(F.layoutFrames([f],{mode:'common'}).frames[0].canvasWidth,4);
});
test('one pass over the rows measures every frame and the content profile',()=>{
 const w=12,h=8,d=image(w,h);fill(d,w,{x:1,y:1,w:3,h:2});fill(d,w,{x:8,y:4,w:2,h:3});
 const rects=[{x:0,y:0,w:6,h:8},{x:6,y:0,w:6,h:8},{x:0,y:0,w:1,h:1}];
 const acc=rects.map(F.emptyBounds),buckets=F.rowBuckets(rects,h),columns=new Uint8Array(w),rowFlags=new Uint8Array(h);
 for(let y=0;y<h;y+=3){const rows=Math.min(3,h-y);
  F.scanRows(d.subarray(y*w*4,(y+rows)*w*4),w,y,rows,{rects,acc,buckets,columns,rowFlags});}
 assert.deepEqual(acc.map(F.accBox),[{x:1,y:1,w:3,h:2},{x:8,y:4,w:2,h:3},null]);
 assert.deepEqual([...columns].join(''),'011100001100');
 assert.deepEqual([...rowFlags].join(''),'01101110');
 assert.throws(()=>F.scanRows(d,w,0,3,{rects,acc,buckets}));
});
test('separator runs give the cell, the margin and the gutter of one axis',()=>{
 const flags=new Uint8Array([0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1]);
 assert.deepEqual(F.contentRuns(flags).map(r=>r.start),[2,8,14]);
 assert.deepEqual(F.axisGuess(flags),{cell:4,offset:2,spacing:2,count:3});
 assert.equal(F.axisGuess(new Uint8Array([1,1,1,1])),null);
});
test('cell suggestions are ranked, deduplicated and never leave the sheet',()=>{
 const columns=new Uint8Array(64),rows=new Uint8Array(32);
 for(let i=0;i<64;i++)columns[i]=i%16<12?1:0;
 for(let i=0;i<32;i++)rows[i]=i%16<12?1:0;
 const out=F.suggestCells(64,32,{rects:[{x:0,y:0,w:12,h:12}],profile:{columns,rows}});
 assert.equal(out[0].reason,'separators');
 assert.deepEqual([out[0].cellW,out[0].cellH,out[0].spacingX,out[0].columns],[12,12,4,4]);
 assert.ok(out.some(s=>s.reason==='divides'&&s.cellW===16));
 assert.ok(out.every(s=>s.cellW<=64&&s.cellH<=32));
 assert.ok(out.length<=6);
});
test('merging frames keeps the first slot and the union rectangle',()=>{
 const frames=[F.makeFrame(1,{x:0,y:0,w:4,h:4}),F.makeFrame(2,{x:10,y:0,w:4,h:4}),F.makeFrame(3,{x:2,y:6,w:4,h:4})];
 const merged=F.mergeFrames(frames,[1,3]);
 assert.deepEqual(merged.map(f=>f.id),[1,2]);
 assert.deepEqual(merged[0].sourceRect,{x:0,y:0,w:6,h:10});
 assert.equal(F.mergeFrames(frames,[1]).length,3);
});
test('a frame snapshot is plain JSON and undo-sized',()=>{
 const frames=[F.makeFrame(7,{x:1,y:2,w:3,h:4})];
 const copy=F.snapshot(frames);copy[0].sourceRect.x=99;
 assert.equal(frames[0].sourceRect.x,1);
 assert.deepEqual(Object.keys(frames[0]),['id','sourceRect','trimmedRect','canvasWidth','canvasHeight','offsetX','offsetY','pivotX','pivotY','duration','tag']);
});
test('metadata is schema-versioned JSON in strip order with source-sheet rectangles',()=>{
 const frames=F.layoutFrames([F.makeFrame(1,{x:4,y:0,w:4,h:8}),F.makeFrame(2,{x:0,y:0,w:6,h:8})],{mode:'common'}).frames;
 const meta=F.metadata(frames,{tool:'nerulio-sprite-slicer',sourceWidth:20,sourceHeight:8,prefix:'walk'});
 assert.equal(meta.schemaVersion,1);
 assert.equal(meta.tool,'nerulio-sprite-slicer');
 assert.deepEqual([meta.frameWidth,meta.frameHeight],[6,8]);
 assert.deepEqual(meta.frames.map(f=>f.name),['walk_001.png','walk_002.png']);
 assert.deepEqual([meta.frames[0].x,meta.frames[0].w],[4,4]);
 assert.equal(JSON.parse(JSON.stringify(meta)).frames[1].pivotY,1);
});
test('rectangles are clamped into the sheet',()=>{
 assert.deepEqual(F.clampRect({x:-4,y:-4,w:200,h:3.4},10,10),{x:0,y:0,w:10,h:3});
 assert.deepEqual(F.clampRect({x:9,y:9,w:5,h:5},10,10),{x:9,y:9,w:1,h:1});
});
