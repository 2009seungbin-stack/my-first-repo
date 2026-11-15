import test from 'node:test';
import assert from 'node:assert/strict';
import {audibleRange,clampSelection,EDGE_THRESHOLD_DB} from '../src/audio-lab/selection.js';
import {COPY} from '../src/audio-lab/strings.js';

const overview=(bins,fill)=>{const p=new Float32Array(bins*2);for(let i=0;i<bins;i++){const v=fill(i);p[i*2]=-v;p[i*2+1]=v;}return p;};
test('audibleRange finds the audible part with one bucket of margin',()=>{
 const p=overview(100,i=>i>=20&&i<60?.5:0),r=audibleRange(p,10);
 assert.equal(EDGE_THRESHOLD_DB,-50);assert.equal(r.start,1.9);assert.equal(r.end,6.1);assert.equal(r.resolution,.1);assert.equal(r.trimmedStart,1.9);assert(Math.abs(r.trimmedEnd-3.9)<1e-9);
 const whole=audibleRange(overview(100,()=>.2),10);assert.equal(whole.start,0);assert.equal(whole.end,10);
});
test('audibleRange respects the threshold and asymmetric peaks',()=>{
 const quiet=10**(-55/20),loud=10**(-45/20),p=overview(50,i=>i===10?loud:quiet);
 const r=audibleRange(p,5);assert.equal(r.start,.9);assert.equal(r.end,1.2);
 assert.equal(audibleRange(p,5,-60).start,0);assert.equal(audibleRange(p,5,-60).end,5);
 const neg=new Float32Array(20);neg[8]=-.4;const n=audibleRange(neg,10);assert.equal(n.start,3);assert.equal(n.end,6);
});
test('audibleRange returns null for silence or unusable input and keeps the minimum length',()=>{
 assert.equal(audibleRange(new Float32Array(200),4),null);assert.equal(audibleRange(new Float32Array(0),4),null);assert.equal(audibleRange(null,4),null);assert.equal(audibleRange(overview(4,()=>1),0),null);
 const tiny=audibleRange(overview(1200,i=>i===600?1:0),.006);assert(tiny.end-tiny.start>=.006-1e-9||tiny.end===.006);assert(tiny.end<=.006);
});
test('clampSelection orders and bounds a selection',()=>{
 assert.deepEqual(clampSelection(-3,99,10),{start:0,end:10});assert.deepEqual(clampSelection(7,2,10),{start:2,end:7});
 const short=clampSelection(4,4,10);assert.equal(short.start,4);assert(Math.abs(short.end-4.01)<1e-12);
 const tail=clampSelection(10,10,10);assert(Math.abs(tail.start-9.99)<1e-12);assert.equal(tail.end,10);
 assert.deepEqual(clampSelection(NaN,NaN,3),{start:0,end:3});assert.deepEqual(clampSelection(1,2,0),{start:0,end:0});
});
test('selection tool strings exist in every language',()=>{
 for(const locale of ['en','ko','ja'])for(const key of ['selectAll','trimEdges','selLength','trimmedEdges','allSilent','space'])assert(COPY[locale][key]?.length>0,`${locale}:${key}`);
});
test('timeTicks picks a readable step for the visible range',async()=>{
 const {timeTicks}=await import('../src/audio-lab/selection.js');
 assert.deepEqual(timeTicks(0,3,8),{step:.5,digits:1,ticks:[0,.5,1,1.5,2,2.5,3]});
 assert.deepEqual(timeTicks(0,180,8),{step:30,digits:0,ticks:[0,30,60,90,120,150,180]});
 assert.deepEqual(timeTicks(12.3,12.9,4),{step:.2,digits:1,ticks:[12.4,12.6,12.8]});
 const fine=timeTicks(1,1.05,8);assert.equal(fine.step,.01);assert.equal(fine.digits,2);assert.deepEqual(fine.ticks,[1,1.01,1.02,1.03,1.04,1.05]);
 assert.deepEqual(timeTicks(5,5,8).ticks,[]);assert.deepEqual(timeTicks(0,NaN,8).ticks,[]);assert.deepEqual(timeTicks(0,10,0).ticks,[]);
 for(const [a,b,m] of [[0,.37,5],[3.3,47,6],[0,600,8],[100,101,3]]){const t=timeTicks(a,b,m);assert(t.ticks.length<=m+2,`${a}-${b}`);assert(t.ticks.every(x=>x>=a-1e-6&&x<=b+1e-6));}
});
