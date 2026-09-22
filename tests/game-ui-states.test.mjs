import test from 'node:test';import assert from 'node:assert/strict';
import {adjust,shift,fadeAlpha,grow,variant,rgb,STATES,DEFAULT_OPS} from '../src/game/ui-states.js';
const image=(w,h,fill=[0,0,0,0])=>{const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4)d.set(fill,i);return d;};
const at=(d,w,x,y)=>[...d.subarray((y*w+x)*4,(y*w+x)*4+4)];
test('colour adjustments are the plain formulas and never touch transparent pixels',()=>{
 const d=image(2,1,[100,150,200,255]);d.set([10,20,30,0],4);
 assert.deepEqual(at(adjust(d,2,1,{}),2,0,0),[100,150,200,255]);
 assert.deepEqual(at(adjust(d,2,1,{brightness:1}),2,0,0),[255,255,255,255]);
 assert.deepEqual(at(adjust(d,2,1,{brightness:-1}),2,0,0),[0,0,0,255]);
 assert.deepEqual(at(adjust(d,2,1,{brightness:.5}),2,1,0),[10,20,30,0],'a clear pixel keeps its bytes');
 const flat=at(adjust(d,2,1,{saturation:-1}),2,0,0),luma=Math.round(.2126*100+.7152*150+.0722*200);
 assert.deepEqual(flat,[luma,luma,luma,255]);
 assert.deepEqual(at(adjust(d,2,1,{overlayColor:'#ff0000',overlayAlpha:1}),2,0,0),[255,0,0,255]);
 const half=at(adjust(d,2,1,{overlayColor:'#000000',overlayAlpha:.5}),2,0,0);
 assert.deepEqual(half.slice(0,3),[50,75,100]);
 assert.throws(()=>rgb('red'),/#rrggbb/);
 assert.deepEqual(rgb('#3182f6'),[49,130,246]);
});
test('a pressed offset moves pixels inside the same canvas and clears what it leaves',()=>{
 const d=image(3,1);d.set([9,9,9,255],0);
 const moved=shift(d,3,1,1,0);
 assert.deepEqual(at(moved,3,1,0),[9,9,9,255]);assert.deepEqual(at(moved,3,0,0),[0,0,0,0]);
 assert.deepEqual(at(shift(d,3,1,-1,0),3,0,0),[0,0,0,0],'a pixel pushed off the edge is gone');
 assert.equal(shift(d,3,1,1,0).length,d.length);
});
test('alpha fade and canvas growth keep the artwork itself byte-identical',()=>{
 const d=image(2,2,[10,20,30,200]);
 assert.deepEqual(at(fadeAlpha(d,2,2,.5),2,0,0),[10,20,30,100]);
 const g=grow(d,2,2,3);
 assert.deepEqual([g.width,g.height,g.pad],[8,8,3]);
 assert.deepEqual(at(g.data,8,3,3),[10,20,30,200]);assert.deepEqual(at(g.data,8,0,0),[0,0,0,0]);
});
test('each state variant is exactly its op list, reported back for the UI to show',()=>{
 assert.deepEqual(STATES,['normal','hover','pressed','disabled','focus']);
 const base=image(4,4,[120,120,120,255]);
 const normal=variant(base,4,4,DEFAULT_OPS.normal);
 assert.deepEqual([normal.width,normal.height,normal.applied],[4,4,[]]);
 assert.deepEqual([...normal.data],[...base]);
 const hover=variant(base,4,4,{brightness:.1});
 assert.deepEqual(at(hover.data,4,0,0).slice(0,3),[146,146,146]);
 const disabled=variant(base,4,4,DEFAULT_OPS.disabled);
 const [r,g,b,a]=at(disabled.data,4,0,0);assert.equal(r,g);assert.equal(g,b);assert.equal(a,128);
 const pressed=variant(base,4,4,{offsetY:1});
 assert.deepEqual(at(pressed.data,4,0,0),[0,0,0,0]);assert.deepEqual(at(pressed.data,4,0,1),[120,120,120,255]);
 const focus=variant(base,4,4,{outline:2,outlineColor:'#3182f6'});
 assert.deepEqual([focus.width,focus.height,focus.pad],[8,8,2]);
 assert.deepEqual(at(focus.data,8,2,2),[120,120,120,255],'the base pixels survive the ring');
 assert.deepEqual(at(focus.data,8,1,1),[49,130,246,255],'the ring is the requested colour');
 // src/core.js addOutline uses a square neighbourhood, so a 2px ring fills the 2px corner too.
 assert.deepEqual(at(focus.data,8,0,0),[49,130,246,255]);
 const thin=variant(base,4,4,{outline:1});
 assert.deepEqual([thin.width,thin.height],[6,6]);
 assert.deepEqual(at(thin.data,6,0,0),[49,130,246,255]);
 assert(focus.applied.join(' ').includes('outline 2px'));
});
