/** Local Ogg Vorbis and MP3 encoding. Codec sources, notices and build instructions
 * are distributed beside the bundles in assets/vendor. No audio leaves the device. */
import {createOggEncoder} from '../../assets/vendor/wasm-media-encoders-0.7.0/dist/esnext/index.mjs';
export async function encodeCompressed(channels,rate,format){if(channels.length<1||channels.length>2||channels.some(c=>c.length!==channels[0].length))throw Error('Invalid PCM channels');if(format==='mp3')return encodeMp3(channels,rate);if(format!=='ogg')throw Error('Unsupported compressed format');const encoder=await createOggEncoder();encoder.configure({sampleRate:rate,channels:channels.length,vbrQuality:4});const parts=[],n=channels[0].length,chunk=8192;for(let i=0;i<n;i+=chunk){const packet=encoder.encode(channels.map(c=>c.subarray(i,Math.min(i+chunk,n))));if(packet.length)parts.push(packet.slice());}const tail=encoder.finalize();if(tail.length)parts.push(tail.slice());return new Uint8Array(await new Blob(parts).arrayBuffer());}
async function encodeMp3(channels,rate){
 const B=await import('../../assets/vendor/mediabunny-1.58.1/mediabunny.min.mjs');
 if(!(await B.canEncodeAudio('mp3'))){const {registerMp3Encoder}=await import('../../assets/vendor/mediabunny-mp3-encoder-1.58.1/mediabunny-mp3-encoder.min.mjs');registerMp3Encoder();}
 const target=new B.BufferTarget(),output=new B.Output({format:new B.Mp3OutputFormat(),target}),source=new B.AudioSampleSource({codec:'mp3',quality:new B.Quality({bitrate:192000})});
 output.addAudioTrack(source);await output.start();
 const n=channels[0].length,chunk=8192;
 for(let i=0;i<n;i+=chunk){const count=Math.min(chunk,n-i),data=new Float32Array(count*channels.length);for(let j=0;j<count;j++)for(let c=0;c<channels.length;c++)data[j*channels.length+c]=channels[c][i+j];const sample=new B.AudioSample({data,format:'f32',numberOfChannels:channels.length,sampleRate:rate,timestamp:i/rate});try{await source.add(sample);}finally{sample.close();}}
 await output.finalize();return new Uint8Array(target.buffer);
}
