import test from 'node:test';
import assert from 'node:assert/strict';
import {DITHER_MODES,ditherModeOf,ditherAmountOf,quantizePerceptual} from '../src/pixel-engine.js';

const BW=[[0,0,0],[255,255,255]];
const flat=(v,w,h)=>{const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d[i*4]=d[i*4+1]=d[i*4+2]=v;d[i*4+3]=255;}return d;};
const rows=(data,w,h)=>Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>data[(y*w+x)*4]?'#':'.').join(''));
const run=(mode,amount,v=99,w=4,h=4)=>rows(quantizePerceptual(flat(v,w,h),w,h,2,amount,{palette:BW,ditherMode:mode}),w,h);

test('ditherModeOf resolves link values and old aliases to a real, non-off mode',()=>{
 assert.equal(ditherModeOf('bayer'),'bayer4');
 assert.equal(ditherModeOf('ordered'),'bayer4');
 for(const mode of DITHER_MODES.filter(m=>m!=='none'))assert.equal(ditherModeOf(mode),mode);
 assert.equal(ditherModeOf('none'),'floyd-steinberg');
 assert.equal(ditherModeOf(null),'floyd-steinberg');
 assert.equal(ditherModeOf('<script>'),'floyd-steinberg');
 assert.equal(ditherModeOf('nope','atkinson'),'atkinson');
});

test('ditherAmountOf clamps to 0–1 in 0.1 steps and treats junk as off',()=>{
 assert.equal(ditherAmountOf('0.64'),0.6);
 assert.equal(ditherAmountOf(0.25),0.3);
 assert.equal(ditherAmountOf(7),1);
 assert.equal(ditherAmountOf(-1),0);
 assert.equal(ditherAmountOf(null),0);
 assert.equal(ditherAmountOf('abc'),0);
 assert.equal(ditherAmountOf('1'),1);
});

test('every mode the quick converter offers reaches the quantiser',()=>{
 // sRGB 99 sits just below the black/white midpoint in Oklab, so undithered it is solid black.
 assert.deepEqual(run('none',1),['....','....','....','....']);
 // Bayer 2×2 biases a cell by (m/4 − 3/8)·48 = −18, +6, +18, −6 for m = 0, 2, 3, 1, which lifts
 // exactly the two cells with the positive bias over the midpoint: a checkerboard.
 assert.deepEqual(run('bayer2',1),['.#.#','#.#.','.#.#','#.#.']);
 for(const mode of DITHER_MODES){
  assert.deepEqual(run(mode,0),run('none',1),`${mode} at strength 0 is off`);
  if(mode==='none')continue;
  const cells=run(mode,1,99,8,8).join('');
  assert.ok(cells.includes('#')&&cells.includes('.'),`${mode} mixes both colours`);
 }
 // Ordered dithering depends on position only, so the same input always gives the same cells.
 assert.deepEqual(run('bayer8',1,99,8,8),run('bayer8',1,99,8,8));
 // Atkinson drops a quarter of the error, so a dark grey gets no more white than Floyd–Steinberg.
 const white=mode=>run(mode,1,60,8,8).join('').split('#').length-1;
 assert.ok(white('atkinson')>0&&white('atkinson')<=white('floyd-steinberg'));
});
