import test from 'node:test';import assert from 'node:assert/strict';
import {borders,clampBorders,suggestBorders,nineSlicePlan,minimumSize,engineBorders} from '../src/game/nine-slice.js';
/** A panel whose edges repeat and whose middle is flat: border pixels depend on how far they
 * are from their own edge, middle pixels do not depend on x or y at all. Real 9-patch art has
 * exactly this property, which is why a run of identical columns finds the border. */
function panel(w,h,b){
 const d=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const bx=x<b?x:x>=w-b?w-1-x:-1,by=y<b?y:y>=h-b?h-1-y:-1,i=(y*w+x)*4;
  d.set([bx<0?200:20+bx*30,by<0?100:20+by*30,90,255],i);
 }
 for(const [x,y,c] of [[0,0,[255,0,0,255]],[w-1,0,[0,255,0,255]],[0,h-1,[0,0,255,255]],[w-1,h-1,[255,255,0,255]]])d.set(c,(y*w+x)*4);
 return d;
}
const cover=plan=>{
 const seen=new Uint16Array(plan.targetW*plan.targetH);
 for(const o of plan.ops)for(let y=o.dy;y<o.dy+o.dh;y++)for(let x=o.dx;x<o.dx+o.dw;x++)seen[y*plan.targetW+x]++;
 return {gaps:[...seen].filter(v=>v===0).length,overlaps:[...seen].filter(v=>v>1).length};
};
test('borders are validated against the image they belong to',()=>{
 assert.deepEqual(borders({left:6,right:6,top:6,bottom:6},24,16),{left:6,right:6,top:6,bottom:6});
 assert.throws(()=>borders({left:13,right:12},24,16),/width/);
 assert.throws(()=>borders({top:9,bottom:8},24,16),/height/);
 assert.throws(()=>borders({left:-1},24,16),/non-negative/);
 assert.throws(()=>borders({left:1.5},24,16),/integer/);
 assert.deepEqual(clampBorders({left:40,right:6,top:0,bottom:0},24,16),{left:18,right:6,top:0,bottom:0});
});
test('the largest run of identical columns and rows is the suggested stretch area',()=>{
 const s=suggestBorders(panel(24,16,6),24,16);
 assert.deepEqual([s.left,s.right,s.top,s.bottom],[6,6,6,6]);
 assert.deepEqual([s.columnRun,s.rowRun,s.confident],[12,4,true]);
 // A gradient has no repeating line: the suggestion says so instead of inventing borders.
 const ramp=new Uint8ClampedArray(8*8*4);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)ramp.set([x*30,y*30,0,255],(y*8+x)*4);
 const g=suggestBorders(ramp,8,8);assert.equal(g.confident,false);assert.deepEqual([g.left,g.right,g.top,g.bottom],[0,0,0,0]);
 assert.throws(()=>suggestBorders(new Uint8ClampedArray(4),2,2),/RGBA/);
});
test('a stretch plan tiles nothing, covers the target exactly and never resamples a corner',()=>{
 const plan=nineSlicePlan({w:24,h:16},{left:6,right:6,top:6,bottom:6},300,80);
 assert.equal(plan.ops.length,9);assert.deepEqual(plan.warnings,[]);
 assert.deepEqual(cover(plan),{gaps:0,overlaps:0});
 for(const o of plan.ops.filter(o=>o.region.includes('-'))){
  assert.deepEqual([o.sw,o.sh],[o.dw,o.dh],o.region);// corner: same pixels, same size
  assert.deepEqual([o.sw,o.sh],[6,6]);
 }
 const byRegion=Object.fromEntries(plan.ops.map(o=>[o.region,o]));
 assert.deepEqual([byRegion['top-right'].dx,byRegion['top-right'].dy],[294,0]);
 assert.deepEqual([byRegion['bottom-left'].dx,byRegion['bottom-left'].dy],[0,74]);
 assert.deepEqual([byRegion.center.dx,byRegion.center.dy,byRegion.center.dw,byRegion.center.dh],[6,6,288,68]);
 assert.deepEqual(minimumSize(plan.borders),{w:12,h:12});
});
test('an integer scale multiplies the corners instead of stretching them',()=>{
 const plan=nineSlicePlan({w:24,h:16},{left:6,right:6,top:6,bottom:6},200,100,{scale:3});
 const tl=plan.ops.find(o=>o.region==='top-left');
 assert.deepEqual([tl.sw,tl.sh,tl.dw,tl.dh],[6,6,18,18]);
 assert.deepEqual(cover(plan),{gaps:0,overlaps:0});
});
test('a target smaller than its corners is reported and still drawn inside the box',()=>{
 const plan=nineSlicePlan({w:24,h:16},{left:6,right:6,top:6,bottom:6},8,4);
 assert.deepEqual(plan.warnings.map(w=>w.code),['narrow','short']);
 assert.deepEqual(plan.effective,{left:4,right:4,top:2,bottom:2});
 assert.deepEqual(cover(plan),{gaps:0,overlaps:0});
 for(const o of plan.ops)assert(o.dx+o.dw<=8&&o.dy+o.dh<=4,o.region);
});
test('tiled edges repeat at their natural size and clip the last tile',()=>{
 const plan=nineSlicePlan({w:24,h:16},{left:6,right:6,top:6,bottom:6},40,30,{mode:'tile'});
 const top=plan.ops.filter(o=>o.region==='top');
 assert.equal(top.length,3);// inner width 28 over a 12px tile
 assert.deepEqual(top.map(o=>o.dw),[12,12,4]);
 assert.deepEqual(top.map(o=>o.sw),[12,12,4]);
 assert.equal(plan.ops.filter(o=>o.region==='center').length,3*5);// 3 across, 5 down (18 / 4)
 assert.deepEqual(cover(plan),{gaps:0,overlaps:0});
 // One-pixel middles would mean one draw call per pixel; the plan stretches and says so.
 const huge=nineSlicePlan({w:3,h:3},{left:1,right:1,top:1,bottom:1},800,200,{mode:'tile'});
 assert.equal(huge.mode,'stretch');assert.equal(huge.warnings[0].code,'tileLimit');
});
test('every engine mapping is derived from the same four pixel numbers',()=>{
 const e=engineBorders({left:6,right:7,top:8,bottom:9},24,32);
 assert.deepEqual(e.pixels,{left:6,right:7,top:8,bottom:9});
 assert.deepEqual(e.normalized,{left:6/24,right:7/24,top:8/32,bottom:9/32});
 assert.deepEqual(e.godot4,{patch_margin_left:6,patch_margin_right:7,patch_margin_top:8,patch_margin_bottom:9});
 assert.deepEqual(e.unity.border,[6,9,7,8]);// Unity's Sprite Editor order is L, B, R, T
});
