import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodePNG} from '../src/game/texture-png.js';
import * as N from '../src/game/ui/nine-patch.js';
const load=async name=>{const p=await decodePNG(new Uint8Array(await readFile(new URL(`./fixtures/ui/kenney/${name}`,import.meta.url))));return {data:new Uint8ClampedArray(p.data),w:p.width,h:p.height};};
// Ground truth from the corpus manifest (inspect_ui.py + looked at): nineSlice insets per file.
const TRUTH={
 'blue_button_rectangle_depth_flat.png':{left:6,top:5,right:6,bottom:9},
 'blue_button_rectangle_flat.png':{left:6,top:5,right:6,bottom:5},
 'blue_button_square_depth_border.png':{left:8,top:8,right:8,bottom:12},
 'blue_button_square_border.png':{left:8,top:8,right:8,bottom:8},
 'blue_double_button_rectangle_depth_flat.png':{left:12,top:11,right:12,bottom:19}
};
const px=(d,w,x,y)=>Array.from(d.subarray((y*w+x)*4,(y*w+x)*4+4));
/** Every destination pixel is drawn by exactly one op (no gaps, no overlaps). */
function coverage(plan){
 const W=plan.targetW,H=plan.targetH,hits=new Uint8Array(W*H);
 for(const o of plan.ops)for(let y=o.clip.y;y<o.clip.y+o.clip.h;y++)for(let x=o.clip.x;x<o.clip.x+o.clip.w;x++){
  assert.ok(x>=o.dx&&x<o.dx+o.dw&&y>=o.dy&&y<o.dy+o.dh,'clip inside its destination rect');hits[y*W+x]++;}
 return {gaps:hits.filter(v=>v===0).length,overlaps:hits.filter(v=>v>1).length};
}
test('suggested borders match the corpus truth on real Kenney buttons, with confidence per axis',async()=>{
 for(const [name,want] of Object.entries(TRUTH)){
  const {data,w,h}=await load(name),s=N.suggestNine(data,w,h);
  assert.deepEqual(s.border,want,name);assert.equal(s.stretch.h,'stretch');assert.equal(s.stretch.v,'stretch');
  assert.equal(s.confidence,'high',name);
 }
 // a vertical gradient: horizontal 3-slice only; the vertical axis says it has no evidence
 const {data,w,h}=await load('blue_button_rectangle_depth_gradient.png'),s=N.suggestNine(data,w,h);
 assert.equal(s.border.left,6);assert.equal(s.border.right,6);assert.equal(s.vertical.confidence,'none');assert.equal(s.confidence,'low');
});
test('a repeating pattern suggests tile mode with one period as the middle',()=>{
 // 30×6: 4-px corners, a middle of stripes with period 3 (two colours), no identical neighbours
 const w=30,h=6,d=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=x<4||x>=26?[200,x*7,0,255]:[(x-4)%3===0?10:(x-4)%3===1?90:170,50,50,255];d.set(c,(y*w+x)*4);}
 const s=N.suggestNine(d,w,h);
 assert.equal(s.horizontal.mode,'tile');assert.equal(s.horizontal.period,3);assert.equal(s.stretch.h,'tile');
 assert.equal(s.border.right,w-s.border.left-3);
});
test('validation: clean borders pass; a guide inside the corner art and a stretched gradient are bad patches',async()=>{
 const a=await load('blue_button_rectangle_depth_flat.png');
 assert.deepEqual(N.validateNine(a.data,a.w,a.h,{border:TRUTH['blue_button_rectangle_depth_flat.png']}),[]);
 const cut=N.validateNine(a.data,a.w,a.h,{border:{left:2,right:6,top:5,bottom:9}});
 const c=cut.find(i=>i.code==='cut-corner'&&i.side==='left');
 assert.ok(c,'the rounded corner continues past a 2-px guide');assert.equal(c.suggest,6,'moving the guide to 6 fixes it');
 const g=await load('blue_button_rectangle_depth_gradient.png');
 const issues=N.validateNine(g.data,g.w,g.h,{border:{left:6,right:6,top:5,bottom:9}});
 assert.ok(issues.some(i=>i.code==='gradient'&&i.axis==='v'),'stretching a vertical gradient is reported');
 assert.ok(!issues.some(i=>i.code==='gradient'&&i.axis==='h'),'the horizontal band is clean');
 assert.ok(N.validateNine(a.data,a.w,a.h,{border:{left:6,right:6,top:5,bottom:9},padding:{left:100,right:100,top:0,bottom:0}}).some(i=>i.code==='padding'));
 assert.deepEqual(N.validateNine(new Uint8ClampedArray(16),2,2,{}),[{code:'empty',severity:'error'}]);
});
test('draw plans cover every target pixel exactly once in every mode, anchor and DPI scale',async()=>{
 const size={w:192,h:64},nine={border:TRUTH['blue_button_rectangle_depth_flat.png']};
 for(const h of N.MODES)for(const v of N.MODES)for(const anchor of ['start','center','end'])for(const scale of [1,2,3,1.5])for(const [tw,th] of [[500,140],[37,23],[10,7],[1,1],[640,201]]){
  const plan=N.ninePlan(size,{...nine,stretch:{h,v}},tw,th,{scale,anchor});
  const c=coverage(plan);assert.equal(c.gaps,0,`${h}/${v}/${anchor}@${scale} ${tw}×${th} gaps`);assert.equal(c.overlaps,0,`${h}/${v}/${anchor}@${scale} ${tw}×${th} overlaps`);
 }
});
test('rendering: corners are the source pixels at 1×, nearest 2×/3× at DPI scale, stretched bands stay uniform',async()=>{
 const {data,w,h}=await load('blue_button_rectangle_depth_flat.png'),b=TRUTH['blue_button_rectangle_depth_flat.png'];
 for(const scale of [1,2,3]){
  const plan=N.ninePlan({w,h},{border:b},420,130,{scale}),out=N.renderPlan(data,w,h,plan);
  for(let y=0;y<b.top*scale;y++)for(let x=0;x<b.left*scale;x++)assert.deepEqual(px(out,420,x,y),px(data,w,Math.floor(x/scale),Math.floor(y/scale)),`top-left @${scale}`);
  for(let y=0;y<b.bottom*scale;y++)for(let x=0;x<b.right*scale;x++)assert.deepEqual(px(out,420,420-b.right*scale+x,130-b.bottom*scale+y),px(data,w,w-b.right+Math.floor(x/scale),h-b.bottom+Math.floor(y/scale)),`bottom-right @${scale}`);
  // the stretched middle: every destination column in the band equals the source's middle column
  const mid=Math.floor(w/2);
  for(let x=b.left*scale;x<420-b.right*scale;x+=13)assert.deepEqual(px(out,420,x,60),px(data,w,mid,Math.min(h-1-b.bottom,b.top+Math.floor((60-b.top*scale)*(h-b.top-b.bottom)/(130-(b.top+b.bottom)*scale)))));
 }
});
test('tile mode keeps the source period and puts the partial tile where the anchor says',()=>{
 // 3-px corners + a 4-px middle of four distinct colours
 const w=10,h=1,d=new Uint8ClampedArray(w*4);
 for(let x=0;x<w;x++)d.set(x<3||x>=7?[0,0,0,255]:[x*40,0,0,255],x*4);
 const row=(anchor,tw)=>{const p=N.ninePlan({w,h},{border:{left:3,right:3,top:0,bottom:0},stretch:{h:'tile',v:'stretch'}},tw,1,{anchor});return Array.from({length:tw},(_,x)=>N.renderPlan(d,w,h,p)[x*4]);};
 assert.deepEqual(row('start',16),[0,0,0,120,160,200,240,120,160,200,240,120,160,0,0,0]);
 assert.deepEqual(row('end',16),[0,0,0,200,240,120,160,200,240,120,160,200,240,0,0,0]);
 // CSS `repeat`: one tile centred in the 10-px band ([6,10)), partial tiles at both ends
 assert.deepEqual(row('center',16),[0,0,0,160,200,240,120,160,200,240,120,160,200,0,0,0]);
 // tile-fit: whole tiles only, as many as round(10/4) = 3, each stretched to 3 or 4 px (3·4·3)
 const p=N.ninePlan({w,h},{border:{left:3,right:3,top:0,bottom:0},stretch:{h:'tile-fit',v:'stretch'}},16,1);
 assert.deepEqual(p.ops.filter(o=>o.region==='center').map(o=>[o.dx,o.dw,o.clip.w]),[[3,3,3],[6,4,4],[10,3,3]]);
});
test('targets smaller than the corners squash them and say so; fractional scales are flagged',()=>{
 const p=N.ninePlan({w:192,h:64},{border:{left:6,right:6,top:5,bottom:9}},8,10);
 assert.deepEqual(p.warnings.map(w=>w.code),['narrow','short']);assert.equal(p.effective.left+p.effective.right,8);
 assert.ok(N.ninePlan({w:192,h:64},{border:{left:5,right:5,top:5,bottom:9}},300,100,{scale:1.5}).warnings.some(w=>w.code==='fractional'));
 assert.deepEqual(N.contentRect({border:{left:6,right:6,top:5,bottom:9},padding:{left:10,right:10,top:4,bottom:12}},{w:192,h:64},300,80,2),{x:20,y:8,w:260,h:48});
});
test('Android .9.png: written marks read back to the same borders, padding and pixels',async()=>{
 const {data,w,h}=await load('blue_button_square_depth_border.png');
 const nine=N.normalizeNine({border:{left:8,right:8,top:8,bottom:12},padding:{left:10,right:10,top:9,bottom:14}},w,h);
 const p=N.toNinePatchPNG(data,w,h,nine);assert.equal(p.width,w+2);assert.equal(p.height,h+2);
 assert.deepEqual(px(p.data,p.width,0,0),[0,0,0,0],'corner of the frame stays empty');
 const back=N.fromNinePatchPNG(p.data,p.width,p.height);
 assert.ok(N.nineEquals(back.nine,nine));assert.deepEqual(back.image,data);assert.deepEqual(back.invalidMarks,[]);
 // no padding given → bottom/right marks equal the stretch band, which reads back as padding = border
 const q=N.fromNinePatchPNG(N.toNinePatchPNG(data,w,h,{border:nine.border}).data,w+2,h+2);assert.deepEqual(q.nine.padding,nine.border);
 // a frame with a stray colour is reported, a frame with no marks is refused
 const bad=new Uint8ClampedArray(p.data);bad.set([0,0,255,255],5*4);assert.deepEqual(N.fromNinePatchPNG(bad,p.width,p.height).invalidMarks,['top']);
 assert.throws(()=>N.fromNinePatchPNG(new Uint8ClampedArray(16*16*4),16,16),/no stretch marks/);
});
