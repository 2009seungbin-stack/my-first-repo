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
