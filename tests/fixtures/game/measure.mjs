/** Prints the numbers in the Verification table of docs/SPRITE-LAB.md, so the table is measured
 * rather than remembered.  node tests/fixtures/game/measure.mjs  */
import {detectGrid} from '../../../src/game/grid-detect.js';
import {detectFrames,framesFromRects,normalizeFrames} from '../../../src/game/frame-ops.js';
import {jitterReport,autoFixJitter,findDuplicates,loopSeam} from '../../../src/game/jitter.js';
import {collisionPolygons,traceBoundaries,silhouette} from '../../../src/game/contour.js';
import {outline} from '../../../src/game/outline.js';
import {defringe,detectFringe} from '../../../src/game/defringe.js';
import {packFrames} from '../../../src/game/packing.js';
import {animation} from '../../../src/game/model.js';
import {canvas,box,disc,gridSheet,irregularSheet,walkCycle,stack,hundredFrames,haloedSprite,disconnectedSprite,rand} from '../../game-fixtures.mjs';
const f=(v,n=2)=>Number(v).toFixed(n);
const row=(...cells)=>console.log('| '+cells.join(' | ')+' |');
const build=images=>{const {sheet,rects}=stack(images);return {sheet,...framesFromRects(sheet,rects,{trim:true})};};
const time=fn=>{const t=process.hrtime.bigint();const out=fn();return {out,ms:Number(process.hrtime.bigint()-t)/1e6};};

console.log('\n## grid-detect');
for(const [label,sheet,options] of [
 ['32px cells, margin 4, spacing 2 (15 cells)',gridSheet({cellW:32,cellH:32,cols:5,rows:3,margin:4,spacing:2,draw:(c,i)=>disc(c,16,16,10-i%3,[200,60,60,255])}),{}],
 ['48px cells, edge to edge (12 cells)',gridSheet({cellW:48,cellH:48,cols:6,rows:2,draw:c=>{box(c,10,6,28,36,[90,90,200,255]);disc(c,24,14,7,[240,220,180,255]);}}),{}],
 ['24x48 cells, margin 3, spacing 5, 7px leftover',gridSheet({cellW:24,cellH:48,cols:4,rows:2,margin:3,spacing:5,draw:c=>box(c,4,6,16,36,[30,180,90,255])}),{}],
 ['40px cells with custom:[40]',gridSheet({cellW:40,cellH:40,cols:4,rows:2,margin:2,spacing:4,draw:c=>disc(c,20,22,13,[220,120,40,255])}),{custom:[40]}],
 ['six unrelated sprites, no grid',irregularSheet(),{}]]){
 const {out,ms}=time(()=>detectGrid(sheet,options)),b=out.suggestions[0];
 row(label,`${sheet.width}x${sheet.height}`,b?`${b.cellWidth}x${b.cellHeight} m${b.marginX},${b.marginY} s${b.spacingX},${b.spacingY} = ${b.columns}x${b.rows}`:'none',
  b?`${f(b.score,3)} (${b.confidence})`:'-',`${f(ms,1)} ms`);
}

console.log('\n## frame-ops');
const irregular=irregularSheet();
const found=time(()=>detectFrames(irregular,{distance:2}));
row('irregular sheet, 6 sprites of 6 sizes',`${found.out.components.length} components -> ${found.out.rects.length} frames`,`${f(found.ms,1)} ms`);
const disc6=canvas(100,60);
for(const x of [4,56])for(let y=0;y<1;y++){const s=disconnectedSprite();for(let j=0;j<s.height;j++)for(let i=0;i<s.width;i++){const p=(j*s.width+i)*4;if(s.data[p+3])disc6.data.set(s.data.subarray(p,p+4),((y+j)*100+x+i)*4);}}
row('two characters of 6 loose islands each, distance 4',`${detectFrames(disc6,{distance:0}).rects.length} islands -> ${detectFrames(disc6,{distance:4}).rects.length} frames`,'-');
const hundred=build(hundredFrames());
const norm=time(()=>normalizeFrames(hundred.frames,{align:'bottom-center'}));
row('100 frames of mixed size onto one canvas',`${norm.out.canvasWidth}x${norm.out.canvasHeight}`,`${f(norm.ms,1)} ms`);

console.log('\n## jitter');
const r=rand(5),shakes=Array.from({length:12},()=>[Math.round(r()*6)-3,Math.round(r()*6)-3]);
const shaken=build(walkCycle(12,{jitter:i=>shakes[i]}));
const before=jitterReport(shaken.sheet,shaken.frames,{reference:'alpha-centroid'});
const fixed=time(()=>autoFixJitter(shaken.sheet,shaken.frames,{reference:'alpha-centroid'}));
row('12-frame walk, +/-3px injected jitter, alpha centroid',`max ${f(before.metrics.max)}px, RMS ${f(before.metrics.rms)}px`,
 `max ${f(fixed.out.after.max)}px, RMS ${f(fixed.out.after.rms)}px`,`${f(fixed.ms,1)} ms`);
const r2=rand(9),shakes2=Array.from({length:16},()=>[Math.round(r2()*6)-3,Math.round(r2()*6)-3]);
const glide=i=>[i,Math.round(Math.sin(i/16*Math.PI*2)*6)];
const clean=build(walkCycle(16,{pad:28,motion:glide})),noisy=build(walkCycle(16,{pad:28,jitter:i=>shakes2[i],motion:glide}));
const path=p=>jitterReport(p.sheet,p.frames,{reference:'alpha-centroid'}).series;
const off=(a,b)=>{const d=a.map((v,i)=>v-b[i]),m=d.reduce((s,v)=>s+v,0)/d.length;return Math.sqrt(d.reduce((s,v)=>s+(v-m)**2,0)/d.length);};
const truth=path(clean),dirty=path(noisy);
const kept=autoFixJitter(noisy.sheet,noisy.frames,{reference:'alpha-centroid',preserveTrend:true,window:11});
const keptPath=path({sheet:noisy.sheet,frames:kept.frames});
const flat=autoFixJitter(noisy.sheet,noisy.frames,{reference:'alpha-centroid'});
const flatPath=path({sheet:noisy.sheet,frames:flat.frames});
const range=a=>Math.max(...a)-Math.min(...a);
row('16-frame walk, 15px pan + 12px bob + jitter: distance from the intended path (RMS)',
 `before x ${f(off(dirty.x,truth.x))} / y ${f(off(dirty.y,truth.y))}`,
 `preserveTrend x ${f(off(keptPath.x,truth.x))} / y ${f(off(keptPath.y,truth.y))}`,'-');
row('same, motion left in the result (range)',`intended x ${f(range(truth.x),0)} / y ${f(range(truth.y),0)}px`,
 `preserveTrend x ${f(range(keptPath.x),0)} / y ${f(range(keptPath.y),0)}px`,`preserveTrend off x ${f(range(flatPath.x),0)} / y ${f(range(flatPath.y),0)}px`);
const dup=time(()=>findDuplicates(hundred.sheet,hundred.frames));
row('duplicate scan over 100 frames',`${dup.out.exact.reduce((s,g)=>s+g.duplicates.length,0)} exact, ${dup.out.near.length} near, ${dup.out.blank.length} blank`,`${f(dup.ms,1)} ms`);
const loop=loopSeam(shaken.sheet,shaken.frames,{reference:'alpha-centroid'});
row('loop seam of the shaken walk',`${f(loop.positionDelta.distance)}px jump, IoU ${f(loop.silhouetteIoU,3)}`,`${loop.warnings.length} warning(s)`);

console.log('\n## contour');
const blob=canvas(64,64);disc(blob,32,32,28,[0,0,0,255]);
const traced=traceBoundaries(silhouette(blob))[0].points.length;
for(const cap of [6,8,12,16,24,32]){
 const {out,ms}=time(()=>collisionPolygons(blob,{tolerance:.5,maxVertices:cap}));
 row(`56px disc, vertex cap ${cap}`,`${traced} traced -> ${out.polygons[0].vertices}`,`max deviation ${f(out.error.maxDeviation)}px`,`area ${f(out.error.areaDeltaPercent,1)}%`,`${f(ms,1)} ms`);
}
const person=collisionPolygons(disconnectedSprite(),{tolerance:1,maxVertices:12});
row('6 loose body parts, cap 12 each',`${person.shapes} polygons, ${person.vertices} vertices total`,`max deviation ${f(person.error.maxDeviation)}px`,`area ${f(person.error.areaDeltaPercent,1)}%`,'-');
const hull=collisionPolygons(blob,{shape:'hull'});
row('56px disc, convex hull',`${hull.polygons[0].vertices} vertices`,`max deviation ${f(hull.error.maxDeviation)}px`,`area ${f(hull.error.areaDeltaPercent,1)}%`,'-');

console.log('\n## outline / defringe');
const sprite=canvas(32,32);disc(sprite,16,16,10,[30,200,120,255]);
for(const [mode,conn,radius] of [['outer',8,1],['outer',4,1],['outer',8,2],['inner',8,1],['both',8,1]]){
 const {out,ms}=time(()=>outline(sprite,{mode,connectivity:conn,radius}));
 row(`${mode} outline, radius ${radius}, ${conn}-connected`,`${out.changed} pixels painted`,`${f(ms,2)} ms`);
}
const halo=haloedSprite();
const hb=detectFringe(halo),hf=time(()=>defringe(halo,{radius:3}));
row('white-haloed 32px sprite',`detected ${hb.type}, edge luma ${f(hb.meanEdgeLuma,1)} vs interior ${f(hb.meanInteriorLuma,1)} (delta ${f(hb.delta,1)})`,
 `after: edge ${f(hf.out.after.meanEdgeLuma,1)}, delta ${f(hf.out.after.delta,1)}, type ${hf.out.after.type}`,
 `${hf.out.changed.count} px changed, alpha identical: ${hf.out.alphaUnchanged}`,`${f(hf.ms,2)} ms`);

console.log('\n## packing');
for(const [label,options] of [['padding 2, dedupe off',{padding:2,dedupe:false}],['padding 2, dedupe on',{padding:2,dedupe:true}],
 ['padding 0',{padding:0,dedupe:false}],['padding 2, power of two',{padding:2,pot:true,dedupe:false}],['padding 2, extrude 1',{padding:2,extrude:1,dedupe:false}]]){
 const {out,ms}=time(()=>packFrames(hundred.sheet,hundred.frames,options));
 row(`100-frame fixture, ${label}`,`${out.atlas.pages} page(s) ${out.pages.map(p=>`${p.width}x${p.height}`).join(', ')}`,
  `${out.unique} stored, ${Object.keys(out.aliases).length} aliased`,`efficiency ${f(out.efficiency*100,1)}%`,`${f(ms,0)} ms`);
}
const r3=rand(4),bigs=Array.from({length:40},(_,i)=>{const s=48+Math.floor(r3()*40),img=canvas(s,s);
 box(img,0,0,s,s,[20+i*5%200,60,180,255]);disc(img,s/2,s/2,s/4,[250,250,20,255]);return img;});
const many=build(bigs);
const multi=time(()=>packFrames(many.sheet,many.frames,{maxSize:128,padding:1,dedupe:false}));
row('40 frames of 48-87px at maxSize 128',`${multi.out.atlas.pages} pages`,`${multi.out.pages.map(p=>p.frames.length).join('/')} frames per page`,
 `efficiency ${f(multi.out.efficiency*100,1)}%`,`${f(multi.ms,0)} ms`);
