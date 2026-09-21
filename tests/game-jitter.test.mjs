import test from 'node:test';import assert from 'node:assert/strict';
import {frameAnchors,anchorPoint,anchorSeries,jitterReport,autoFixJitter,frameSignature,findDuplicates,framePixelDiff,loopSeam,frameDifference,onionLayers,smooth,hamming,resolveReference,canvasImage,REFERENCES} from '../src/game/jitter.js';
import {framesFromRects,normalizeFrames} from '../src/game/frame-ops.js';
import {frame,animation} from '../src/game/model.js';
import {innerRect} from '../src/game/pixels.js';
import {canvas,box,disc,blit,walker,walkCycle,stack,rand,opaque,bbox} from './game-fixtures.mjs';
const build=images=>{const {sheet,rects}=stack(images);return {sheet,...framesFromRects(sheet,rects,{trim:true})};};

test('anchors measure where the artwork really is, in canvas pixels',()=>{
 const img=canvas(20,20);box(img,4,6,8,10,[10,20,30,255]);
 const {sheet,frames}=build([img]);
 const a=frameAnchors(sheet,frames[0]);
 assert.deepEqual(a.bbox,{x:4,y:6,w:8,h:10});
 assert.deepEqual(a.boundsCentre,{x:8,y:11});
 assert.deepEqual(a.bottom,{x:8,y:16},'the bottom anchor is the lower edge of the lowest opaque row');
 assert.deepEqual(a.alphaCentroid,{x:8,y:11});
 assert.deepEqual(a.pivot,{x:10,y:20},'the pivot is the declared one, not a measurement');
 assert.equal(a.opaque,80);assert.equal(a.blank,false);
 assert.deepEqual(REFERENCES,['pivot','bottom-center','bounds-centre','alpha-centroid']);
 assert.equal(resolveReference('bottom-centre'),'bottom-center');
 assert.throws(()=>resolveReference('feet'),/Unknown reference/);
 const blank=build([canvas(20,20)]);
 assert.throws(()=>framesFromRects(blank.sheet,[{x:0,y:0,w:20,h:20}],{skipEmpty:false}).frames.map(f=>anchorPoint(frameAnchors(blank.sheet,f),'bottom-center')),/blank/);
});
test('the walker fixture keeps a constant pixel count, so a clean cycle measures zero jitter',()=>{
 const images=walkCycle(8);
 const counts=new Set(images.map(i=>opaque(i)));
 assert.equal(counts.size,1,`the silhouette changes shape but not mass (${[...counts]})`);
 assert(new Set(images.map(i=>JSON.stringify(bbox(i)))).size>1,'and the bounding box really does change');
 const {sheet,frames}=build(images);
 const report=jitterReport(sheet,frames,{reference:'alpha-centroid'});
 assert.equal(report.metrics.rms,0);assert.equal(report.metrics.max,0);assert.deepEqual(report.warnings,[]);
});
test('injected +/-3px jitter is measured and then removed to 0px, without resampling',()=>{
 const r=rand(5),shakes=Array.from({length:12},()=>[Math.round(r()*6)-3,Math.round(r()*6)-3]);
 const images=walkCycle(12,{jitter:i=>shakes[i]});
 const {sheet,frames}=build(images);
 const before=jitterReport(sheet,frames,{reference:'alpha-centroid'});
 assert(before.metrics.max>=3,`the shake is visible before the fix (${before.metrics.max})`);
 assert(before.residual.rms>1,`residual ${before.residual.rms.toFixed(2)}`);
 const fix=autoFixJitter(sheet,frames,{reference:'alpha-centroid'});
 assert(fix.after.rms<=.5,`RMS after the fix must be at most 0.5px, got ${fix.after.rms}`);
 assert.equal(fix.after.rms,0,'integer jitter cancels exactly');
 assert.equal(fix.after.max,0);
 for(let i=0;i<frames.length;i++){
  assert.deepEqual(innerRect(fix.frames[i]),innerRect(frames[i]),'the source pixels are untouched: only the offset changes');
  const s=fix.shifts[i];assert(Number.isSafeInteger(s.dx)&&Number.isSafeInteger(s.dy),'whole-pixel shifts only');
 }
 assert(fix.frames.every(f=>f.canvasWidth===fix.canvasWidth&&f.canvasHeight===fix.canvasHeight));
 assert(fix.canvasWidth>=frames[0].canvasWidth&&fix.canvasHeight>=frames[0].canvasHeight,'the canvas never shrinks under a fix');
});
test('preserveTrend keeps a deliberate pan and a bob while still removing the shake',()=>{
 const r=rand(9),shakes=Array.from({length:16},()=>[Math.round(r()*6)-3,Math.round(r()*6)-3]);
 const glide=i=>[i,Math.round(Math.sin(i/16*Math.PI*2)*6)];
 const clean=build(walkCycle(16,{pad:28,motion:glide}));
 const {sheet,frames}=build(walkCycle(16,{pad:28,jitter:i=>shakes[i],motion:glide}));
 const path=p=>{const s=jitterReport(p.sheet,p.frames,{reference:'alpha-centroid'}).series;return {x:s.x,y:s.y};};
 const truth=path(clean),noisy=path({sheet,frames});
 // Distance from the intended path, with any constant offset removed: that is what "flattened" or
 // "still shaking" actually means, measured against the motion the fixture put in.
 const off=(a,b)=>{const d=a.map((v,i)=>v-b[i]),m=d.reduce((s,v)=>s+v,0)/d.length;return Math.sqrt(d.reduce((s,v)=>s+(v-m)**2,0)/d.length);};
 assert(Math.max(off(noisy.x,truth.x),off(noisy.y,truth.y))>=1.6,`the shake is there to start with (${off(noisy.x,truth.x).toFixed(2)}, ${off(noisy.y,truth.y).toFixed(2)})`);
 const flat=autoFixJitter(sheet,frames,{reference:'alpha-centroid'});
 assert.equal(flat.after.max,0,'without preserveTrend every frame is pinned to one place');
 const kept=autoFixJitter(sheet,frames,{reference:'alpha-centroid',preserveTrend:true,window:11});
 const fixed=path({sheet,frames:kept.frames});
 const [fx,fy]=[off(fixed.x,truth.x),off(fixed.y,truth.y)];
 assert(fx<=1&&fy<=1,`the fixed path follows the intended one to under 1px RMS (${fx.toFixed(2)}, ${fy.toFixed(2)})`);
 assert(fx<off(noisy.x,truth.x)/1.8&&fy<off(noisy.y,truth.y)/1.8,'and at least 1.8x closer to it than before');
 assert(kept.afterResidual.rms<kept.beforeResidual.rms/2,`wobble halved at least: ${kept.beforeResidual.rms.toFixed(2)} → ${kept.afterResidual.rms.toFixed(2)}`);
 const range=a=>Math.max(...a)-Math.min(...a);
 assert(range(fixed.y)>=range(truth.y)-1,`the 12px bob survives (${range(fixed.y).toFixed(1)} vs ${range(truth.y).toFixed(1)})`);
 assert(range(fixed.x)>=range(truth.x)-1,`the 15px pan survives (${range(fixed.x).toFixed(1)} vs ${range(truth.x).toFixed(1)})`);
 assert(kept.after.max>0,'the two modes really differ');
});
test('a non-uniform canvas is refused with an instruction, and clamping is reported',()=>{
 const a=frame({sourceRect:{x:0,y:0,w:10,h:10}}),b=frame({sourceRect:{x:0,y:0,w:12,h:10}});
 const sheet=canvas(24,10);box(sheet,0,0,24,10,[5,5,5,255]);
 assert.throws(()=>autoFixJitter(sheet,[a,b]),/normalize the frames first/);
 assert.deepEqual(smooth([0,10,0,10,0],5,{mode:'mean'}).map(v=>+v.toFixed(2)),[3.33,5,4,5,3.33]);
 assert.deepEqual(smooth([0,1,4,9,16],5).map(v=>+v.toFixed(6)),[0,1,4,9,16],'a parabola passes through a quadratic fit untouched');
 assert.throws(()=>smooth([1,2,3],3,{mode:'gauss'}),/Unknown smoothing mode/);
 assert.throws(()=>smooth([1,2],0),/positive integer/);
});
test('duplicate, near-duplicate, blank and almost-empty frames are named',()=>{
 const base=walker(24,40),shifted=canvas(24,40);blit(shifted,base,1,0);
 const speck=canvas(24,40);box(speck,3,3,2,2,[255,255,255,255]);
 const nearly=canvas(24,40);blit(nearly,base,0,0);nearly.data[(20*24+12)*4]=0;nearly.data[(20*24+12)*4+1]=0;
 const images=[base,{...base,data:new Uint8ClampedArray(base.data)},nearly,shifted,canvas(24,40),speck];
 const {sheet,rects}=stack(images);
 const {frames}=framesFromRects(sheet,rects,{trim:true,skipEmpty:false});
 const dup=findDuplicates(sheet,frames);
 assert.equal(dup.exact.length,1);assert.deepEqual(dup.exact[0].duplicates,[frames[1].id],'frame 2 is byte-identical to frame 1');
 assert(dup.near.some(n=>n.a===frames[0].id&&n.b===frames[2].id),`a one-pixel recolour is a near duplicate: ${JSON.stringify(dup.near.map(n=>n.names))}`);
 assert.deepEqual(dup.blank,[frames[4].id]);
 assert.deepEqual(dup.almostEmpty.map(e=>e.id),[frames[5].id]);
 assert(dup.almostEmpty[0].coverage<.005);
 assert.equal(frameSignature(sheet,frames[0]).hash,frameSignature(sheet,frames[1]).hash);
 assert.notEqual(frameSignature(sheet,frames[0]).hash,frameSignature(sheet,frames[2]).hash);
 assert.equal(hamming(new Uint8Array([1,0,1]),new Uint8Array([1,1,1])),1);
});
test('the loop seam reports the jump, the silhouette overlap and a doubled end frame',()=>{
 const images=walkCycle(8);
 const doubled=build([...images,images[0]]);
 const seam=loopSeam(doubled.sheet,doubled.frames,{reference:'alpha-centroid'});
 assert.equal(seam.identical,true);assert.equal(seam.silhouetteIoU,1);
 assert.deepEqual(seam.positionDelta,{dx:0,dy:0,distance:0});
 assert(seam.warnings.some(w=>/plays twice/.test(w)),JSON.stringify(seam.warnings));
 const drift=walkCycle(8,{jitter:i=>[i===7?5:0,0]});
 const bad=build(drift);
 const seam2=loopSeam(bad.sheet,bad.frames,{reference:'alpha-centroid'});
 assert.equal(seam2.identical,false);
 assert.equal(seam2.positionDelta.dx,-5,'the last frame sits 5px to the right of the first');
 assert(seam2.warnings.some(w=>/jumps 5\.0px/.test(w)),JSON.stringify(seam2.warnings));
 assert(seam2.silhouetteIoU<1&&seam2.meanPixelDiff>0);
 assert.throws(()=>loopSeam(bad.sheet,[bad.frames[0]]),/at least two/);
});
test('frame difference and onion layers give the numbers a viewer needs',()=>{
 const a=canvas(16,16);box(a,2,2,6,6,[255,0,0,255]);
 const b=canvas(16,16);box(b,2,2,6,6,[255,0,0,255]);box(b,9,9,3,3,[0,255,0,255]);
 const {sheet,frames}=build([a,b]);
 const diff=frameDifference(sheet,frames[0],frames[1],{mode:'alpha'});
 assert.equal(diff.changed,9);assert.equal(diff.mask.reduce((s,v)=>s+v,0),9);
 assert.equal(diff.width,frames[0].canvasWidth);
 assert.equal(frameDifference(sheet,frames[0],frames[0]).changed,0);
 assert.throws(()=>frameDifference(sheet,frames[0],frames[1],{mode:'sobel'}),/Unknown difference mode/);
 const pair=framePixelDiff(sheet,frames[0],frames[1]);
 assert.equal(pair.identical,false);assert(pair.silhouetteIoU>.7&&pair.silhouetteIoU<1);
 assert.equal(canvasImage(sheet,frames[0]).data.length,16*16*4);
 const many=build(walkCycle(6)).frames;
 assert.deepEqual(onionLayers(many,0,{before:2,after:2}).map(l=>l.offset),[0,1,2]);
 assert.deepEqual(onionLayers(many,3,{before:2,after:1}).map(l=>[l.offset,+l.opacity.toFixed(2)]),[[-2,.25],[-1,.5],[0,1],[1,.5]]);
 assert.throws(()=>onionLayers(many,99),/inside the animation/);
 assert.throws(()=>onionLayers(many,0,{before:99}),/0…16/);
});
test('a 100-frame animation is measured in playback order, ping-pong included',()=>{
 const images=walkCycle(100,{pad:10,jitter:i=>[i%3-1,0]});
 const {sheet,frames}=build(images);
 const anim=animation({name:'walk',frameIds:frames.map(f=>f.id),fps:24,direction:'pingpong'},frames);
 const report=jitterReport(sheet,frames,{animation:anim,reference:'alpha-centroid'});
 assert.equal(report.points.length,198,'ping-pong does not double the end frames');
 assert.equal(report.metrics.max,2,'the injected -1/0/+1 cycle steps by 2 when it wraps');
 const series=anchorSeries(sheet,frames,{animation:anim});
 assert.equal(series.length,198);
 const fix=autoFixJitter(sheet,frames,{reference:'alpha-centroid'});
 assert.equal(fix.after.max,0);assert.equal(fix.frames.length,100);
});
