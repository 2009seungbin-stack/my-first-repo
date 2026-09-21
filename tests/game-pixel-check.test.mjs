import test from 'node:test';import assert from 'node:assert/strict';
import {detectScale,gridAnalysis,runLengths,recoverSource,nearestScale,silhouette,alphaMask,maskDifference,edgeQuality,inspect,MAX_SCALE} from '../src/game/pixel-check.js';
/** A small deterministic 1× sprite: a diagonal plus a hole, so every axis has colour changes. */
function sprite(w=8,h=8){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,on=(x+y)%3!==0;
  data[i]=on?30+x*20:220;data[i+1]=on?40+y*18:60;data[i+2]=on?120:200;data[i+3]=x===0&&y===0?0:255;
 }
 return {data,width:w,height:h};
}
/** Non-integer nearest resize: the factor is 5/2, so runs alternate 2 and 3 px. */
function resizeNearest(source,factor){
 const width=Math.round(source.width*factor),height=Math.round(source.height*factor),out=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const sx=Math.min(source.width-1,Math.floor(x/factor)),sy=Math.min(source.height-1,Math.floor(y/factor));
  const i=(sy*source.width+sx)*4,o=(y*width+x)*4;for(let k=0;k<4;k++)out[o+k]=source.data[i+k];
 }
 return {data:out,width,height};
}
test('integer block detection finds 1x, 3x and 4x exactly and recovers the source',()=>{
 const base=sprite();
 assert.equal(detectScale(base).scale,1);
 assert.equal(detectScale(base).confident,false,'a 1x sprite has no block grid to prove');
 assert.equal(inspect(base).verdict,'unit');
 for(const scale of [2,3,4,8]){
  const big=nearestScale(base,scale),found=detectScale(big);
  assert.equal(found.scale,scale,`scale ${scale}`);
  assert(found.exact&&found.confident&&found.divides);
  assert.deepEqual(found.offset,{x:0,y:0});
  const report=inspect(big);
  assert.equal(report.verdict,'integer');
  assert.deepEqual(report.logical,{width:base.width,height:base.height});
  assert.equal(report.offGrid,false);
  const back=recoverSource(big,found.scale,found.offset);
  assert.deepEqual([back.width,back.height],[base.width,base.height]);
  assert.deepEqual([...back.data],[...base.data],'recovering 1x returns the original pixels');
 }
});
test('an off-grid crop of an upscaled sprite is still recognised, and the offset is reported',()=>{
 const big=nearestScale(sprite(),4),w=big.width-2,h=big.height-3,out=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((y+3)*big.width+(x+2))*4,o=(y*w+x)*4;for(let k=0;k<4;k++)out[o+k]=big.data[i+k];}
 const found=detectScale({data:out,width:w,height:h});
 assert.equal(found.scale,4);
 assert.deepEqual(found.offset,{x:2,y:3});
 assert.equal(inspect({data:out,width:w,height:h}).offGrid,true);
});
test('a non-integer nearest resize is reported as non-integer with a run-length estimate',()=>{
 const scaled=resizeNearest(sprite(),2.5),found=detectScale(scaled);
 assert.equal(found.exact,false);
 assert.equal(found.confident,false);
 assert(found.estimate>2.3&&found.estimate<2.7,`estimate ${found.estimate}`);
 assert.equal(inspect(scaled).verdict,'non-integer');
 const runs=runLengths(scaled);
 assert(runs.min>=2,'no single-pixel detail survives a 2.5x nearest resize');
 assert.equal(runs.counts.get(1)||0,0);
 assert(runs.shortMean<=runs.mean&&runs.shortMean>=runs.min,`shortMean ${runs.shortMean}`);
 // With a flat border added, the plain mean is dragged up while the short-run mean is not.
 const bordered=(()=>{const w=scaled.width,h=scaled.height,data=new Uint8ClampedArray(scaled.data);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<8||y<8){const i=(y*w+x)*4;data[i]=9;data[i+1]=9;data[i+2]=9;data[i+3]=255;}
  return runLengths({data,width:w,height:h});})();
 assert(bordered.shortMean<bordered.mean,`${bordered.shortMean} vs ${bordered.mean}`);
 assert(bordered.shortMean<3,`short-run mean stays near the real factor: ${bordered.shortMean}`);
});
test('grid analysis reports only the columns and rows where colour actually changes',()=>{
 const flat={data:new Uint8ClampedArray(4*4*4).fill(255),width:4,height:4};
 assert.deepEqual(gridAnalysis(flat),{columns:[],rows:[],width:4,height:4});
 assert.equal(detectScale(flat).confident,false,'a single-colour image has no measurable scale');
 const grid=gridAnalysis(nearestScale(sprite(4,4),3));
 assert.deepEqual(grid.columns,[3,6,9]);
 assert.deepEqual(grid.rows,[3,6,9]);
 assert.throws(()=>detectScale({data:new Uint8ClampedArray(5),width:2,height:2}),/RGBA pixels/);
 assert.equal(MAX_SCALE,16);
});
test('interpolated edges are counted; nearest-scaled pixels have none',()=>{
 const base=sprite(),sharp=edgeQuality(nearestScale(base,3));
 assert.equal(sharp.intermediate,0,'nearest scaling invents no intermediate colours');
 assert.equal(sharp.partialAlpha,0);
 // A three-step gradient row: the middle pixel lies between its neighbours.
 const w=3,h=1,data=new Uint8ClampedArray(w*h*4);
 for(const [x,c] of [[0,[0,0,0]],[1,[128,128,128]],[2,[255,255,255]]]){const i=x*4;data.set(c,i);data[i+3]=255;}
 const soft=edgeQuality({data,width:w,height:h});
 assert.equal(soft.intermediate,1);
 assert.equal(soft.edges,1);
 assert.equal(soft.share,1);
 assert(inspect({data,width:w,height:h}).blurred);
});
test('the silhouette keeps the shape exactly and mask comparison counts moved pixels',()=>{
 const base=sprite(),flat=silhouette(base,[0,0,0]);
 assert.deepEqual([...alphaMask(flat)],[...alphaMask(base)]);
 assert.equal(maskDifference(alphaMask(flat),alphaMask(base)),0);
 for(let i=0;i<flat.data.length;i+=4)if(flat.data[i+3])assert.deepEqual([...flat.data.slice(i,i+3)],[0,0,0]);
 const moved=silhouette(base);moved.data[7]=0;
 assert.equal(maskDifference(alphaMask(moved),alphaMask(base)),1);
 assert.throws(()=>maskDifference(new Uint8Array(2),new Uint8Array(3)),/different images/);
 assert.throws(()=>nearestScale(base,0),/1–64/);
 assert.throws(()=>recoverSource(base,1.5),/whole-number scale/);
});
test('inspect answers the colour budget without inventing a score',()=>{
 const report=inspect(sprite(),{targetColors:4});
 assert.equal(report.budget.target,4);
 assert.equal(report.budget.actual,report.distinct);
 assert.equal(report.budget.over,Math.max(0,report.distinct-4));
 assert.equal(inspect(sprite()).budget,null);
 assert.equal(report.opaque,63,'the one transparent pixel is not counted');
});
