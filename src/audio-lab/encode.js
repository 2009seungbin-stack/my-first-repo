/** Local output codecs. M4R remains unavailable until AAC-in-MP4 and phone QA. */
import {createOggEncoder} from '../../assets/vendor/wasm-media-encoders-0.7.0/dist/esnext/index.mjs';
export function encodeWav(channels,rate){
 if(![1,2].includes(channels.length)||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length)||!Number.isInteger(rate)||rate<8000||rate>192000)throw Error('Invalid PCM');
 const count=channels[0].length,align=channels.length*2,size=count*align;if(size>0xFFFFFFFF-36)throw Error('WAV too large');const out=new Uint8Array(44+size),v=new DataView(out.buffer);
 for(const [offset,s] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<4;i++)out[offset+i]=s.charCodeAt(i);
 v.setUint32(4,36+size,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels.length,true);v.setUint32(24,rate,true);v.setUint32(28,rate*align,true);v.setUint16(32,align,true);v.setUint16(34,16,true);v.setUint32(40,size,true);
 for(let i=0;i<count;i++)for(let c=0;c<channels.length;c++){const value=Math.max(-1,Math.min(1,channels[c][i])),sample=value<0?Math.round(value*32768):Math.round(value*32767);v.setInt16(44+(i*channels.length+c)*2,sample,true);}return out;
}
export async function encodeCompressed(channels,rate,format){
 if(![1,2].includes(channels.length)||channels.some(c=>c.length!==channels[0].length))throw Error('Invalid PCM');
 if(format==='ogg'){const encoder=await createOggEncoder();encoder.configure({sampleRate:rate,channels:channels.length,vbrQuality:4});const parts=[];for(let i=0;i<channels[0].length;i+=8192){const bytes=encoder.encode(channels.map(c=>c.subarray(i,Math.min(channels[0].length,i+8192))));if(bytes.length)parts.push(bytes.slice());}const tail=encoder.finalize();if(tail.length)parts.push(tail.slice());return new Uint8Array(await new Blob(parts).arrayBuffer());}
 if(format==='mp3'){
  const B=await import('../../assets/vendor/mediabunny-1.58.1/mediabunny.min.mjs');
  if(!(await B.canEncodeAudio('mp3'))){const {registerMp3Encoder}=await import('../../assets/vendor/mediabunny-mp3-encoder-1.58.1/mediabunny-mp3-encoder.min.mjs');registerMp3Encoder();}
  const target=new B.BufferTarget(),output=new B.Output({format:new B.Mp3OutputFormat(),target}),source=new B.AudioSampleSource({codec:'mp3',quality:new B.Quality({bitrate:192000})});output.addAudioTrack(source);await output.start();
  for(let i=0;i<channels[0].length;i+=8192){const count=Math.min(8192,channels[0].length-i),data=new Float32Array(count*channels.length);for(let j=0;j<count;j++)for(let c=0;c<channels.length;c++)data[j*channels.length+c]=channels[c][i+j];const sample=new B.AudioSample({data,format:'f32',numberOfChannels:channels.length,sampleRate:rate,timestamp:i/rate});try{await source.add(sample);}finally{sample.close();}}
  await output.finalize();return new Uint8Array(target.buffer);
 }
 throw Error('Unsupported codec');
}
