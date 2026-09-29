import {analyze,monoView} from './analysis.js';
import {edit,loudness,normalize,protectSamplePeakInPlace,validateAudio} from './dsp.js';
import {encodeWav,encodeCompressed} from './encode.js';

let source=null,generation=0;
const fail=(id,error)=>self.postMessage({id,type:'error',message:String(error?.message||error)});
function waveform(channels,bins=1200){const n=channels[0].length,out=new Float32Array(bins*2);for(let b=0;b<bins;b++){const a=Math.floor(b*n/bins),z=Math.max(a+1,Math.floor((b+1)*n/bins));let low=1,high=-1;for(let i=a;i<Math.min(n,z);i++)for(const c of channels){low=Math.min(low,c[i]);high=Math.max(high,c[i]);}out[b*2]=low===1?0:low;out[b*2+1]=high===-1?0:high;}return out;}
async function decode(file,id){
 if(!(file instanceof Blob)||file.size>128*1048576)throw Error('Choose an audio file under 128 MiB');const own=++generation;
 const B=await import('../../assets/vendor/mediabunny-1.58.1/mediabunny.min.mjs');const input=new B.Input({source:new B.BlobSource(file),formats:B.ALL_FORMATS});
 try{const track=await input.getPrimaryAudioTrack();if(!track)throw Error('No audio track');const [rate,count,duration]=await Promise.all([track.getSampleRate(),track.getNumberOfChannels(),input.computeDuration([track])]);
  if(!Number.isFinite(duration)||duration<=0||duration>180||![1,2].includes(count)||rate<8000||rate>192000)throw Error('Unsupported duration, channel count or sample rate (maximum 3 minutes, stereo)');
  const capacity=Math.min(Math.ceil(duration*rate)+4096,Math.ceil(180*rate)+4096);if(capacity*count*4>96*1048576)throw Error('Decoded audio exceeds the 96 MiB mobile memory limit');
  const channels=Array.from({length:count},()=>new Float32Array(capacity)),sink=new B.AudioSampleSink(track);let end=0,lastProgress=0;
  for await(const sample of sink.samples()){if(own!==generation){sample.close();return;}try{const offset=Math.max(0,Math.round(sample.timestamp*rate)),frames=sample.numberOfFrames;if(offset>=capacity)continue;const take=Math.min(frames,capacity-offset);for(let c=0;c<count;c++)sample.copyTo(channels[c].subarray(offset,offset+take),{planeIndex:c,format:'f32-planar',frameCount:take});end=Math.max(end,offset+take);if(end-lastProgress>rate*5){lastProgress=end;self.postMessage({id,type:'progress',seconds:end/rate});}}finally{sample.close();}}
  if(own!==generation)return;if(!end)throw Error('No decoded audio frames');source={channels:channels.map(c=>c.subarray(0,end)),rate};validateAudio(source.channels,rate);const peaks=waveform(source.channels);self.postMessage({id,type:'loaded',duration:end/rate,rate,channels:count,peaks},[peaks.buffer]);
 }finally{input.dispose();}
}
self.onmessage=async event=>{const {id,type}=event.data||{};try{
 if(type==='load'){await decode(event.data.file,id);return;}
 if(type==='clear'){generation++;source=null;self.postMessage({id,type:'cleared'});return;}
 if(!source)throw Error('Open an audio file first');
 if(type==='analyze'){const mono=monoView(source.channels),result=analyze(mono,source.rate),meter=loudness(source.channels,source.rate);self.postMessage({id,type:'analysis',result,meter});return;}
 if(type==='render'){const settings=event.data.settings||{},format=event.data.format||'wav';if(format==='m4r')throw Error('UNVERIFIED: AAC-in-MP4 ringtone export is not enabled');
  let channels=edit(source.channels,source.rate,settings),normalization=null;if(settings.targetLufs!==null&&settings.targetLufs!==undefined){normalization=normalize(channels,source.rate,{targetLufs:Number(settings.targetLufs),ceilingDb:-1});channels=normalization.channels;}
  const peakProtection=protectSamplePeakInPlace(channels),meter=loudness(channels,source.rate),bytes=format==='wav'?encodeWav(channels,source.rate):await encodeCompressed(channels,source.rate,format);
  self.postMessage({id,type:'rendered',format,bytes,duration:channels[0].length/source.rate,meter,peakProtection,normalization:normalization&&{appliedDb:normalization.appliedDb,limited:normalization.limited}},[bytes.buffer]);return;}
 throw Error('Unknown Audio Lab request');
 }catch(error){fail(id,error);}};
