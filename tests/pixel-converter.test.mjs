import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleToGrid,paletteFromFrames,quantizeFrames,scaleNearest} from '../src/studio/pixel/converter.js';

test('nearest integer export repeats RGBA and enforces the output budget',()=>{
 const src={width:2,height:1,data:new Uint8Array([10,20,30,40,50,60,70,255])};
 const out=scaleNearest(src,2);
 assert.deepEqual([out.width,out.height],[4,2]);
 assert.deepEqual(Array.from(out.data),[10,20,30,40,10,20,30,40,50,60,70,255,50,60,70,255,
  10,20,30,40,10,20,30,40,50,60,70,255,50,60,70,255]);
 assert.throws(()=>scaleNearest(src,16,{maxPixels:100}));
});
import {runCleanup} from '../src/studio/pixel/cleanup.js';

const frame=(width,height,colors)=>({width,height,data:Uint8Array.from(colors.flat())});

test('cell samplers handle noninteger dimensions and preserve the input',()=>{
 const source=frame(3,2,[[255,0,0,255],[255,0,0,255],[0,0,255,255],[255,0,0,255],[0,0,255,255],[0,0,255,255]]);
 const before=source.data.slice();
 for(const method of ['nearest','median','mode','k-centroid']){
  const r=sampleToGrid(source,2,1,{method});assert.equal(r.width,2);assert.equal(r.height,1);assert.equal(r.data.length,8);
 }
 assert.deepEqual(source.data,before);
});

test('transparent RGB cannot win modal sampling',()=>{
 const source=frame(2,2,[[42,99,200,0],[12,34,56,0],[10,20,30,255],[10,20,30,255]]);
 const r=sampleToGrid(source,1,1,{method:'mode'});
 assert.deepEqual([...r.data],[0,0,0,0]);
});

test('all palette algorithms produce bounded, deterministic shared palettes',()=>{
 const a=frame(4,1,[[0,0,0,255],[0,0,0,255],[255,0,0,255],[0,0,255,255]]);
 const b=frame(4,1,[[0,0,255,255],[0,0,255,255],[255,0,0,255],[255,255,255,255]]);
 for(const algorithm of ['median-cut','k-means','wu']){
  const p=paletteFromFrames([a,b],3,{algorithm});
  assert.ok(p.length>=1&&p.length<=3,algorithm);
  assert.deepEqual(p,paletteFromFrames([a,b],3,{algorithm}),algorithm);
  assert.ok(p.every(c=>c.length===3&&c.every(v=>Number.isInteger(v)&&v>=0&&v<=255)),algorithm);
 }
});

test('dithers stay deterministic, share one palette, and preserve transparent pixels',()=>{
 const source=frame(2,2,[[0,0,0,0],[100,100,100,255],[180,180,180,255],[255,255,255,255]]);
 const palette=[[0,0,0],[255,255,255]];
 for(const dither of ['none','bayer2','bayer4','bayer8','floyd-steinberg','atkinson','blue-noise']){
  const [a]=quantizeFrames([source],palette,{dither,strength:.6});
  const [b]=quantizeFrames([source],palette,{dither,strength:.6});
  assert.deepEqual(a.data,b.data,dither);assert.equal(a.data[3],0,dither);
  for(let i=4;i<a.data.length;i+=4)assert.ok(a.data[i]===0||a.data[i]===255,dither);
 }
});

test('photo conversion uses one palette across frames without changing source frames',()=>{
 const a=frame(4,2,Array.from({length:8},(_,i)=>[i*25,20,100,255]));
 const b=frame(4,2,Array.from({length:8},(_,i)=>[20,i*25,120,255]));
 const original=a.data.slice();
 const result=runCleanup([a,b],{intent:'convert',targetWidth:2,targetHeight:1,sampleMethod:'median',maxColors:3,paletteAlgorithm:'wu',background:null,alphaCut:null,fringe:false,merge:0});
 assert.deepEqual(result.report.steps.map(s=>s.id).slice(0,2),['convert','quantize']);
 assert.deepEqual(result.frames.map(f=>[f.width,f.height]),[[2,1],[2,1]]);
 assert.ok(result.palette.length<=3);
 assert.deepEqual(a.data,original);
});
