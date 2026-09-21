import test from 'node:test';import assert from 'node:assert/strict';
import {seamReport,edgeMatch,bestEdge,makeSeamless,heatmap,SIDES} from '../src/game/seams.js';

const tile=(w,h,fn)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),(y*w+x)*4);return {data,w,h};};
/** cos over a whole period wraps perfectly; a linear ramp does not. */
const wrapping=(w,h)=>tile(w,h,(x,y)=>{const v=Math.round(128+60*Math.cos(2*Math.PI*x/w)+40*Math.cos(2*Math.PI*y/h));return [v,v,v,255];});
const ramp=(w,h)=>tile(w,h,(x,y)=>{const v=Math.round(x/(w-1)*255);return [v,v,Math.round(y/(h-1)*255),255];});

test('a tile that wraps reports no seam; a ramp reports one with its size',()=>{
 const good=wrapping(32,32),r=seamReport(good.data,32,32);
 assert(r.seamless,JSON.stringify([r.horizontal.mean,r.horizontal.neighbourMean]));
 assert(r.horizontal.ratio<1.3&&r.vertical.ratio<1.3);
 assert.deepEqual([r.width,r.height],[32,32]);
 const bad=ramp(32,32),b=seamReport(bad.data,32,32);
 assert.equal(b.seamless,false);
 assert(b.horizontal.mean>240,String(b.horizontal.mean));
 assert(b.horizontal.ratio>20,String(b.horizontal.ratio));
 assert.equal(b.horizontal.profile.length,32);assert.equal(b.vertical.profile.length,32);
 assert(b.vertical.mean>240,'the ramp is discontinuous both ways');
 assert.throws(()=>seamReport(bad.data,1,1),/at least 2/);
 assert.throws(()=>seamReport(new Uint8ClampedArray(16),8,8),/RGBA/);
});
test('make-seamless removes the seam it was asked about',()=>{
 const bad=ramp(64,64),before=seamReport(bad.data,64,64);
 const healed=makeSeamless(bad.data,64,64),after=seamReport(healed,64,64);
 assert(before.horizontal.mean>240&&before.vertical.mean>240);
 assert(after.horizontal.mean<8,String(after.horizontal.mean));
 assert(after.vertical.mean<8,String(after.vertical.mean));
 assert(after.seamless);
 // It really did alter the art: that is the honest part of the feature.
 assert.notDeepEqual([...healed],[...bad.data]);
 assert.equal(healed.length,bad.data.length);
 // Outside the blended bands the pixels are the offset original, unchanged.
 const at=(d,x,y)=>d[(y*64+x)*4];
 assert.equal(at(healed,0,0),at(bad.data,32,32),'the corner is the offset original');
 assert.throws(()=>makeSeamless(bad.data,64,64,{blendX:32}),/smaller than half/);
 const narrow=makeSeamless(bad.data,64,64,{blendX:1,blendY:1});
 assert(seamReport(narrow,64,64).horizontal.mean<8,'a one-pixel band still joins the wrap');
});
test('edge matching answers which tile goes next to which',()=>{
 // Two halves of one wrapping texture: b continues a on its right.
 const whole=wrapping(64,32);
 const half=(x0)=>tile(32,32,(x,y)=>{const p=((y*64)+x0+x)*4;return [whole.data[p],whole.data[p+1],whole.data[p+2],whole.data[p+3]];});
 const a=half(0),b=half(32);
 const right=edgeMatch(a,b,'right');
 assert(right.fits,JSON.stringify([right.mean,right.neighbourMean]));
 assert.equal(right.profile.length,32);assert.equal(right.side,'right');
 const ranked=bestEdge(a,b);
 assert.equal(ranked.length,4);
 assert(ranked[0].mean<=ranked[3].mean);
 assert(['right','left'].includes(ranked[0].side),ranked[0].side);
 // A tile whose touching line is unrelated does not fit.
 const wrong=tile(32,32,()=>[255,0,255,255]);
 const off=edgeMatch(a,wrong,'right');
 assert.equal(off.fits,false);assert(off.ratio>3);
 assert.throws(()=>edgeMatch(a,tile(16,16,()=>[0,0,0,255]),'right'),/share the edge/);
 assert.throws(()=>edgeMatch(a,b,'middle'),/Unknown side/);
 assert.deepEqual([...SIDES].sort(),['bottom','left','right','top']);
});
test('a heatmap is normalised against its own worst line',()=>{
 const h=heatmap(Float64Array.from([0,5,10]));
 assert.equal(h.max,10);assert.deepEqual([...h.values],[0,.5,1]);
 assert.deepEqual([...heatmap(Float64Array.from([0,0])).values],[0,0]);
});
