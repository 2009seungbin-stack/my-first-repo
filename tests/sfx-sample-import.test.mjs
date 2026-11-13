import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSample} from '../src/sfx/sample-import.js';
const audio=(arrays,rate=44100)=>{const channels=arrays.map(x=>Float32Array.from(x));return {numberOfChannels:channels.length,sampleRate:rate,length:channels[0].length,getChannelData:i=>channels[i]};};

test('a mono source retains its samples; channel average keeps a right-only stereo source audible',()=>{
 const values=[0,.5,-.25,.125];
 assert.deepEqual([...prepareSample(audio([values])).pcm],values);
 const a=prepareSample(audio([[0,0,0,0],values]));
 assert.deepEqual([...a.pcm],values.map(x=>x/2));assert.equal(a.cancelled,false);assert.equal(a.sourceChannels,2);
 assert.deepEqual([...prepareSample(audio([values,values])).pcm],values);
});

test('explicit channel choice preserves polarity; an absent channel does not silently fall back',()=>{
 const b=audio([[.5,-.5],[.25,-.25]]);
 assert.deepEqual([...prepareSample(b,{mode:'channel1'}).pcm],[.5,-.5]);
 assert.deepEqual([...prepareSample(b,{mode:'channel2'}).pcm],[.25,-.25]);
 assert.throws(()=>prepareSample(audio([[.5]]),{mode:'channel2'}),/SAMPLE_CHANNEL_MISSING/);
 assert.throws(()=>prepareSample(b,{mode:'unknown'}),/channel choice/);
});

test('opposite channels identify actual cancellation; silent inputs and selected channels do not',()=>{
 const b=audio([[.5,-.5],[-.5,.5]]),mix=prepareSample(b);
 assert.deepEqual([...mix.pcm],[0,0]);assert.equal(mix.cancelled,true);
 assert.equal(prepareSample(b,{mode:'channel2'}).cancelled,false);
 assert.equal(prepareSample(audio([[0,0],[0,0]])).cancelled,false);
 assert.deepEqual([...prepareSample(audio([[.5],[0],[-.5],[1]])).pcm],[.25]);
});

test('the rate conversion keeps linear interpolation and the last-sample fade',()=>{
 const a=prepareSample(audio([[0,1]],24000),{rate:48000});
 assert.deepEqual([...a.pcm],[0,.5,1,.5]);assert.equal(a.duration,2/24000);
 assert.throws(()=>prepareSample(audio([[1]]),{rate:0}),/Invalid decoded/);
 assert.throws(()=>prepareSample(audio([[NaN]])),/Invalid decoded/);
});

test('import still caps the sample voice at 180 seconds',()=>{
 const channel=new Float32Array(181000).fill(.25);
 const a=prepareSample({numberOfChannels:1,sampleRate:1000,length:channel.length,getChannelData:()=>channel});
 assert.equal(a.pcm.length,180*44100);assert.equal(a.duration,180);assert.equal(a.truncated,true);
 assert.equal(a.pcm[0],.25);assert.equal(a.pcm.at(-1),.25);
});
