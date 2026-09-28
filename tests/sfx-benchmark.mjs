/** Reproducible render/encode timing sample. Not a pass/fail speed gate. */
import {performance} from 'node:perf_hooks';
import {preset,render,layer} from '../src/sfx/engine.js';
import {encodeWav} from '../src/sfx/wav.js';
import {encodeCompressed} from '../src/sfx/encode.js';
const p=preset('explosion',123);p.rate=48000;p.layers=[...p.layers,layer('fm',{freq:500,hold:.4,release:.3,gain:.25}),layer('voice',{freq:230,hold:.3,release:.5,gain:.22})];
const samples=[];for(let i=0;i<32;i++){const q={...p,seed:123+i};const t=performance.now(),r=render(q);samples.push(performance.now()-t);if(i===0){for(const f of ['wav','ogg','mp3']){const a=performance.now();const out=f==='wav'?encodeWav([r.left,r.right],r.rate,24):await encodeCompressed([r.left,r.right],r.rate,f);console.log(`${f} bytes=${out.length} ms=${(performance.now()-a).toFixed(2)}`);}}}
samples.sort((a,b)=>a-b);console.log(`render 32x four-layer 48 kHz: median=${samples[15].toFixed(2)}ms p95=${samples[30].toFixed(2)}ms max=${samples[31].toFixed(2)}ms`);
