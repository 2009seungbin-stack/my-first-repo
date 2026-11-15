import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePeak,NORMALIZE_PEAK_DB} from '../src/sfx/normalize.js';
import {preset,render} from '../src/sfx/engine.js';
import {encodeWav} from '../src/sfx/wav.js';
import {COPY} from '../src/sfx/strings.js';

const near=(a,b,tol=1e-6)=>assert(Math.abs(a-b)<=tol,`${a} vs ${b}`);
const peakOf=(...xs)=>Math.max(...xs.map(x=>x.reduce((m,v)=>Math.max(m,Math.abs(v)),0)));
test('normalizePeak scales both channels by one gain to -1 dBFS',()=>{
 const left=Float32Array.from([0,.25,-.1,.05]),right=Float32Array.from([.125,-.2,0,.01]),copyL=left.slice(),r=normalizePeak(left,right);
 assert.equal(NORMALIZE_PEAK_DB,-1);near(r.peak,.25);near(r.gain,10**(-1/20)/.25,1e-9);near(r.gainDb,20*Math.log10(10**(-1/20)/.25),1e-9);near(peakOf(r.left,r.right),10**(-1/20));
 near(r.right[0]/r.left[1],.125/.25);near(r.left[2]/r.left[1],-.1/.25);assert.deepEqual(left,copyL);assert.notEqual(r.left,left);
 const custom=normalizePeak(left,right,-6);near(peakOf(custom.left,custom.right),10**(-6/20));
});
test('normalizePeak attenuates hot audio and leaves silence untouched',()=>{
 const hot=Float32Array.from([1.6,-2,.4]),h=normalizePeak(hot,hot);assert(h.gain<1);assert(h.gainDb<0);near(peakOf(h.left),10**(-1/20));
 const z=new Float32Array(64),s=normalizePeak(z,z);assert.equal(s.gain,1);assert.equal(s.gainDb,0);assert.equal(s.left,z);assert.equal(s.peak,0);
 const empty=normalizePeak(new Float32Array(0),new Float32Array(0));assert.equal(empty.gain,1);
});
test('a normalised preset fills the 16-bit WAV range without clipping',()=>{
 const sound=render(preset('coin',12)),n=normalizePeak(sound.left,sound.right),bytes=encodeWav([n.left,n.right],sound.rate,16),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert(sound.metrics.peak<.5,'presets are quiet before normalising');let max=0;for(let off=44;off<bytes.length;off+=2)max=Math.max(max,Math.abs(view.getInt16(off,true)));
 assert(max<=32767);assert(Math.abs(max/32767-10**(-1/20))<.002,`peak ${max}`);
 for(const locale of ['en','ko','ja'])for(const key of ['normalize','gainApplied'])assert(COPY[locale][key]?.length>0,`${locale}:${key}`);
});
