import test from 'node:test';
import assert from 'node:assert/strict';
import {preset,render,project,layer,validate,WAVES} from '../src/sfx/engine.js';
import {encodeWav} from '../src/sfx/wav.js';
import {encodeCompressed} from '../src/sfx/encode.js';
import {parseJsfxr,toJsfxrBase58,renderJsfxr,originalJsfxr} from '../src/sfx/jsfxr-format.js';

test('seeded noise, repeat rendering and sequence are deterministic',()=>{
 const p=preset('explosion',481),a=render(p),b=render(p);assert.deepEqual(a.left,b.left);assert.deepEqual(a.right,b.right);assert(a.metrics.rms>.001);
 const q=structuredClone(p);q.seed++;assert.notDeepEqual(render(q).left,a.left);
 q.sequence=[{layer:0,at:.4,pitch:12,gain:.8}];const s=render(q);assert(s.left.length>a.left.length);assert(s.metrics.peak>0);
});
test('all waveforms generate finite, nonempty PCM and are not all the same',()=>{
 const sig=[];for(const wave of WAVES){const p=project(7);p.layers=[layer(wave,{hold:.02,release:.03})];const r=render(p);assert(r.left.every(Number.isFinite),wave);assert(r.metrics.rms>.001,wave);sig.push(Array.from(r.left.subarray(500,530)).join(','));}assert(new Set(sig).size>=10);
});
test('sampler uses imported samples and project bounds reject untrusted state',()=>{
 const p=project(7);p.layers=[layer('sine',{kind:'sample',sampleId:'local',hold:.01,release:0,attack:0,decay:0,sustain:1})];const sample=Float32Array.from({length:1000},(_,i)=>i<500?.6:0),r=render(p,{local:sample}),empty=render(p);assert(r.metrics.rms>empty.metrics.rms);assert.throws(()=>validate({...p,layers:Array(5).fill(layer())}),/1–4/);assert.equal(validate({...p,master:Infinity}).master,0);
});
test('envelope, pan, limiter and diagnostics respond to controlled signals',()=>{
 const p=project(7);p.master=1;p.limiter=false;p.layers=[layer('square',{freq:100,attack:.02,decay:0,sustain:1,hold:.04,release:.04,gain:.8,pan:-1,lp:20000})];
 const a=render(p),rms=(arr,lo,hi)=>Math.sqrt(arr.subarray(lo,hi).reduce((s,x)=>s+x*x,0)/(hi-lo));
 assert(rms(a.left,0,100)<rms(a.left,1500,1600),'attack should grow');
 assert(rms(a.left,3000,3300)>rms(a.left,4200,4400),'release should fade');
 assert(rms(a.right,1500,1600)<rms(a.left,1500,1600)*.001,'hard left pan');
 p.layers.push(layer('square',{...p.layers[0],pan:-1,gain:2}));p.master=2;const hot=render(p);assert(hot.metrics.peak>1);assert(hot.metrics.clippedSamples>0);assert(hot.left.some(x=>x>1));
 p.limiter=true;const safe=render(p);assert(safe.metrics.clippedSamples===hot.metrics.clippedSamples);assert(safe.left.every(x=>Math.abs(x)<1));
 assert(Number.isFinite(safe.metrics.dc)&&Math.abs(safe.metrics.dc)<1);assert.equal(safe.metrics.frames,safe.left.length);
});
test('sample import remains silent when missing and seed changes do not alter pure tone',()=>{
 const p=project(333);p.layers=[layer('sine',{freq:440,hold:.04,release:.02})];const a=render(p);p.seed++;const b=render(p);assert.deepEqual(a.left,b.left);
 p.layers=[layer('sine',{kind:'sample',sampleId:'unavailable',attack:0,decay:0,sustain:1,hold:.03,release:0})];const missing=render(p);assert.equal(missing.metrics.rms,0);
});
test('WAV 16/24-bit header, frame count and signed sample bytes are correct',()=>{
 for(const bits of [16,24]){const pcm=[Float32Array.of(-1,0,1),Float32Array.of(0,.5,-.5)],wav=encodeWav(pcm,48000,bits),view=new DataView(wav.buffer);assert.equal(String.fromCharCode(...wav.subarray(0,4)),'RIFF');assert.equal(String.fromCharCode(...wav.subarray(8,12)),'WAVE');assert.equal(view.getUint32(4,true),wav.length-8);assert.equal(view.getUint32(40,true),3*2*bits/8);assert.equal(view.getUint16(34,true),bits);assert.equal(view.getUint32(24,true),48000);assert.equal(view.getUint16(32,true),2*bits/8);if(bits===16)assert.equal(view.getInt16(44,true),-32768);else assert.deepEqual([...wav.subarray(44,47)],[0,0,128]);}
});
test('vendored jsfxr JSON and Base58 round-trip; reference waveform matches upstream',()=>{
 const upstream=originalJsfxr(),p=new upstream.Params();p.wave_type=2;p.p_env_decay=.3;p.p_base_freq=.42;p.sample_rate=44100;p.sample_size=16;const code=toJsfxrBase58(p),back=parseJsfxr(code);assert.equal(back.wave_type,p.wave_type);assert(Math.abs(back.p_base_freq-p.p_base_freq)<1e-5);assert.deepEqual(renderJsfxr(back).pcm,upstream.sfxr.toBuffer(back));assert.throws(()=>parseJsfxr('not-a-code'),/Unrecognized/);
});
test('Ogg Vorbis and MP3 encoders produce recognizable, nonempty containers locally',async()=>{
 const rate=44100,pcm=Float32Array.from({length:rate/10},(_,i)=>.2*Math.sin(2*Math.PI*440*i/rate));const ogg=await encodeCompressed([pcm],rate,'ogg'),mp3=await encodeCompressed([pcm],rate,'mp3');assert.equal(String.fromCharCode(...ogg.subarray(0,4)),'OggS');assert(ogg.length>1000);assert(mp3.length>1000);assert(mp3[0]===0xff||String.fromCharCode(...mp3.subarray(0,3))==='ID3');
});
