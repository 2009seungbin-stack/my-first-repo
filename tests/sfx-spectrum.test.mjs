import test from 'node:test';
import assert from 'node:assert/strict';
import {fftMagnitudes,averageSpectrum,spectrumBands} from '../src/sfx/spectrum.js';
import {preset,render,project,layer} from '../src/sfx/engine.js';

const near=(a,b,tol,label)=>assert(Math.abs(a-b)<=tol,`${label||''} ${a} vs ${b} ± ${tol}`);
const sine=(hz,amp,n,rate=44100)=>Float32Array.from({length:n},(_,i)=>amp*Math.sin(2*Math.PI*hz*i/rate));

test('fftMagnitudes matches known transforms',()=>{
 const impulse=new Float64Array(16);impulse[0]=1;const flat=fftMagnitudes(impulse);near(flat[0],1/16,1e-12,'dc');for(let i=1;i<8;i++)near(flat[i],2/16,1e-12,'bin '+i);
 const dc=fftMagnitudes(new Float64Array(8).fill(.75));near(dc[0],.75,1e-12);for(let i=1;i<4;i++)near(dc[i],0,1e-12);
 const cos=fftMagnitudes(Float64Array.from({length:64},(_,i)=>.8*Math.cos(2*Math.PI*3*i/64)+.25*Math.sin(2*Math.PI*9*i/64)));
 for(let i=0;i<32;i++)near(cos[i],i===3?.8:i===9?.25:0,1e-9,'bin '+i);
 assert.throws(()=>fftMagnitudes(new Float64Array(12)),/power of two/);assert.throws(()=>fftMagnitudes(new Float64Array(1)),/power of two/);
});
test('averageSpectrum reports the amplitude and frequency of a tone',()=>{
 const rate=44100,centred=46*rate/2048,a=sine(centred,.5,rate/2),s=averageSpectrum(a,a,rate);
 near(s.peak,.5,.005,'amplitude');near(s.peakHz,centred,1,'bin-centred frequency');near(s.binHz,rate/2048,1e-9);assert(s.frames>1&&s.frames<=48);
 const b=sine(1000,.3,rate/2),t=averageSpectrum(b,b,rate);near(t.peakHz,1000,4,'interpolated frequency');assert(t.peak>.25&&t.peak<=.31);
 const mono=averageSpectrum(b,null,rate);near(mono.peakHz,t.peakHz,1e-9);
 const short=sine(2000,.4,300),u=averageSpectrum(short,short,rate);near(u.peakHz,2000,80,'zero-padded short sound');assert.equal(u.frames,1);
});
test('averageSpectrum handles silence, cancellation and long input',()=>{
 const z=new Float32Array(5000),s=averageSpectrum(z,z,48000);assert.equal(s.peak,0);assert.equal(s.peakHz,0);assert.equal(s.frames,0);assert(s.mags.every(x=>x===0));
 const a=sine(500,.5,8000),inv=a.map(x=>-x);assert.equal(averageSpectrum(a,inv,44100).peak,0);
 const long=sine(3000,.2,44100*20),t=averageSpectrum(long,long,44100);assert(t.frames<=48);near(t.peakHz,3000,4);
});
test('spectrumBands maps tones to log-spaced dB bands',()=>{
 const rate=44100,n=rate/2,mix=Float32Array.from({length:n},(_,i)=>.5*Math.sin(2*Math.PI*440*i/rate)+.05*Math.sin(2*Math.PI*3000*i/rate)),s=averageSpectrum(mix,mix,rate),bands=spectrumBands(s.mags,s.binHz,96,40,20000,-84);
 assert.equal(bands.length,96);assert(bands.every(x=>x>=-84&&x<=0));
 const index=hz=>Math.floor(96*Math.log(hz/40)/Math.log(20000/40)),top=bands.indexOf(Math.max(...bands));
 assert(Math.abs(top-index(440))<=1,`top band ${top}`);near(bands[index(440)]-bands[index(3000)],20,2.5,'20 dB between tones');near(bands[index(440)],20*Math.log10(.5),2.5,'within Hann scalloping loss');
 assert(bands[index(12000)]<-60);assert.equal(spectrumBands(new Float64Array(1024),rate/2048)[10],-84);
});
test('rendered presets have a plausible dominant frequency',()=>{
 const ui=render(preset('ui',5)),s=averageSpectrum(ui.left,ui.right,ui.rate);assert(s.peakHz>605&&s.peakHz<675,`ui ${s.peakHz}`);
 const p=project(3);p.layers=[layer('sine',{freq:2000,attack:0,decay:0,sustain:1,hold:.2,release:0})];const r=render(p),t=averageSpectrum(r.left,r.right,r.rate);near(t.peakHz,2000,6);
});
