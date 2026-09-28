/** Manual 3-minute Worker-sized input budget check. Not a mobile benchmark. */
import {performance} from 'node:perf_hooks';
import {estimateTempo,estimateKey,monoView} from '../src/audio-lab/analysis.js';
import {loudness,edit} from '../src/audio-lab/dsp.js';
const sr=48000,n=sr*180,channels=[new Float32Array(n),new Float32Array(n)];
for(let i=0;i<n;i++){const t=i/sr,click=t%(.5)<.008?.15:0,s=.1*Math.sin(2*Math.PI*440*t)+click;channels[0][i]=s;channels[1][i]=s*.9;}
const results={},run=(name,fn)=>{const start=performance.now(),value=fn();results[name]={ms:Math.round(performance.now()-start),rssMiB:Math.round(process.memoryUsage().rss/1048576),result:name==='analyze'?value:name.startsWith('render')?value[0].length:value};};
run('analyze',()=>{const mono=monoView(channels);return {tempo:estimateTempo(mono,sr),key:estimateKey(mono,sr).key};});
run('loudness',()=>loudness(channels,sr));
run('render',()=>edit(channels,sr,{start:0,end:180,fadeIn:.1,fadeOut:.1}));
run('render-shift',()=>edit(channels,sr,{start:0,end:180,speed:1.25,semitones:3}));
console.log(JSON.stringify({sampleRate:sr,seconds:180,channels:2,originalPcmMiB:Math.round(n*2*4/1048576),results},null,2));
