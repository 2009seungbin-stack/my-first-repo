import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleToGrid,paletteFromFrames,quantizeFrames} from '../src/studio/pixel/converter.js';

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
