import test from 'node:test';import assert from 'node:assert/strict';
import {components,detect,applyChanges,revertChanges,removeAntiAlias,outlineAudit,colorCensus} from '../src/game/pixel-cleanup.js';
/** Build an indexed frame from rows of single characters; '.' is transparent. */
function indexed(rows){
 const h=rows.length,w=rows[0].length,indices=new Int16Array(w*h);
 rows.forEach((row,y)=>[...row].forEach((ch,x)=>{indices[y*w+x]=ch==='.'?-1:Number(ch);}));
 return {indices,width:w,height:h};
}
const render=(frame,colors)=>{
 const data=new Uint8ClampedArray(frame.width*frame.height*4);
 for(let p=0;p<frame.indices.length;p++){const k=frame.indices[p];if(k<0)continue;data.set(colors[k],p*4);data[p*4+3]=255;}
 return {data,width:frame.width,height:frame.height};
};
test('one component scan finds stray pixels, tiny clusters and enclosed holes',()=>{
 const frame=indexed([
  '0000000',
  '0011000',
  '0010.00',
  '0000100',
  '0000000']);
 const {list}=components(frame);
 assert.equal(list.filter(c=>c.index===1).length,2,'the 1-pixel and the 3-pixel cluster are separate');
 assert.equal(list.find(c=>c.index<0).area,1);
 const found=detect(frame,{minArea:4,maxHole:1});
 assert.deepEqual(found.orphans.items.map(o=>o.seed),[3*7+4]);
 assert.deepEqual(found.orphans.changes,[{at:25,from:1,to:0}]);
 assert.deepEqual(found.clusters.items.map(c=>c.area),[3]);
 assert.deepEqual(found.clusters.changes.map(c=>c.at),[9,10,16]);
 assert.deepEqual(found.holes.changes,[{at:18,from:-1,to:0}]);
 // A preview is a change list; applying and reverting it is exact and costs only that list.
 const applied=applyChanges(frame.indices,[...found.orphans.changes,...found.clusters.changes,...found.holes.changes]);
 assert(applied.every(v=>v===0));
 assert.deepEqual([...revertChanges(applied,[...found.orphans.changes,...found.clusters.changes,...found.holes.changes])],[...frame.indices]);
 // Transparency that reaches the border is background, not a hole.
 const open=indexed(['00.','000','000']);
 assert.deepEqual(detect(open).holes.items,[]);
 assert.throws(()=>detect({indices:[1,2],width:1,height:2}),/indices,width,height/);
});
test('clusters below the threshold are recoloured to the colour that surrounds them',()=>{
 const frame=indexed([
  '000000',
  '022000',
  '022000',
  '000000']);
 const found=detect(frame,{minArea:5});
 assert.equal(found.clusters.items.length,1);
 assert.equal(found.clusters.items[0].area,4);
 assert.equal(found.clusters.items[0].fill,0);
 assert.equal(found.clusters.changes.length,4);
 assert.equal(detect(frame,{minArea:4}).clusters.items.length,0,'exactly at the threshold is kept');
});
test('the anti-alias remover snaps transition pixels to one of the two colours they sit between',()=>{
 const A=[20,24,34],B=[230,230,220],mid=[125,127,127],colors=[A,B];
 // A 5x5 field: left half A, right half B, with one interpolated column between them.
 const w=5,h=5,data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,c=x<2?A:x===2?mid:B;data.set(c,i);data[i+3]=255;}
 const out=removeAntiAlias({data,width:w,height:h},colors,{threshold:.1});
 assert.equal(out.offPalette,5);
 assert.equal(out.transition,5,'every interpolated pixel was decided from its two neighbours');
 assert.equal(out.nearest,0);
 for(let y=0;y<h;y++)assert([0,1].includes(out.indices[y*w+2]));
 // A pixel that is NOT between two palette colours falls back to nearest, and says so.
 const lonely=new Uint8ClampedArray(2*1*4);lonely.set([255,0,255],0);lonely[3]=255;lonely.set(A,4);lonely[7]=255;
 const fell=removeAntiAlias({data:lonely,width:2,height:1},colors,{threshold:.01});
 assert.equal(fell.nearest,1);assert.equal(fell.transition,0);
 // Partial alpha is only rounded when a cut is given, and the count is reported.
 const soft=new Uint8ClampedArray(4);soft.set(A,0);soft[3]=90;
 assert.equal(removeAntiAlias({data:soft,width:1,height:1},colors).alphaSnapped,0);
 assert.equal(removeAntiAlias({data:soft,width:1,height:1},colors,{alphaCut:128}).alphaSnapped,1);
 assert.equal(removeAntiAlias({data:soft,width:1,height:1},colors,{alphaCut:64}).alpha[0],255);
 assert.throws(()=>removeAntiAlias({data:soft,width:1,height:1},[]),/target palette/);
});
test('the outline audit measures thickness and lists gaps without fixing anything',()=>{
 // A 6x6 ring of index 1 around index 2, with one gap on the top edge.
 const frame=indexed([
  '111211',
  '122221',
  '122221',
  '122221',
  '122221',
  '111111']);
 const audit=outlineAudit(frame,1);
 assert.deepEqual(audit.gaps.map(g=>g.x),[3]);
 assert.deepEqual(audit.gapFix,[{at:3,from:2,to:1}]);
 assert.equal(audit.thickness.dominant,1);
 assert.equal(audit.doubled.length,0,'a 1 px ring has no doubled run, corners included');
 const thick=indexed(['1111','1111','1221','1111']);
 assert(outlineAudit(thick,1).doubled.length>0);
 assert.equal(outlineAudit(thick,1).thickness.consistent,false);
 assert.throws(()=>outlineAudit(frame,-1),/outline colour/);
});
test('the colour census separates palette colours from anti-alias leftovers',()=>{
 const colors=[[0,0,0],[255,255,255]];
 const frame=indexed(['01','1.']),image=render(frame,colors);
 image.data[4]=250;// make one pixel off-palette
 const census=colorCensus(image,colors);
 assert.deepEqual([census.opaque,census.distinct,census.offPalette,census.offPalettePixels],[3,3,1,1]);
 assert.equal(census.partial,0);
 image.data[3]=120;
 assert.equal(colorCensus(image,colors).partial,1);
});
