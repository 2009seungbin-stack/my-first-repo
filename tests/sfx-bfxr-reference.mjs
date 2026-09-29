/** Optional comparison with WAVs exported by the operator from Bfxr2.
 * Run: node tests/sfx-bfxr-reference.mjs test-results/bfxr-waves
 * It compares selected waveform names and broad signal metrics, not Bfxr parameter parity.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {preset,render} from '../src/sfx/engine.js';

const names={Square:'square',Saw:'saw',Sin:'sine',Triangle:'triangle',White:'white',Rasp:'rasp',Tan:'tan',Whistle:'whistle',Breaker:'breaker',Bitnoise:'bitnoise',FMSyn:'fm',Voice:'voice'};
function metrics(values,rate){let square=0,peak=0,zero=0;for(let i=0;i<values.length;i++){const v=values[i];square+=v*v;peak=Math.max(peak,Math.abs(v));if(i&&Math.sign(v)!==Math.sign(values[i-1]))zero++;}return {seconds:+(values.length/rate).toFixed(3),peak:+peak.toFixed(3),rms:+Math.sqrt(square/values.length).toFixed(3),zeroCrossings:zero};}
function pcm16(file){const bytes=readFileSync(file),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error(`Invalid WAV: ${file}`);let format,channels,rate,offset=12,count=0;while(offset+8<=bytes.length){const name=bytes.toString('ascii',offset,offset+4),length=view.getUint32(offset+4,true),start=offset+8;if(name==='fmt '){format=view.getUint16(start,true);channels=view.getUint16(start+2,true);rate=view.getUint32(start+4,true);if(view.getUint16(start+14,true)!==16)throw Error('Expected 16-bit Bfxr WAV');}if(name==='data'){offset=start;count=length;break;}offset=start+length+(length&1);}if(format!==1||!channels||!rate||!count)throw Error(`Unsupported WAV: ${file}`);const frames=count/(channels*2),samples=new Float32Array(frames);for(let i=0;i<frames;i++)samples[i]=view.getInt16(offset+i*channels*2,true)/32768;return {samples,rate};}
const folder=process.argv[2];if(!folder)throw Error('Pass directory of operator-exported Bfxr WAVs');
for(const [file,wave] of Object.entries(names)){const bfxr=pcm16(join(folder,`${file}.wav`)),p=preset('coin',1);p.layers[0].wave=wave;const nerulio=render(p);console.log(JSON.stringify({wave,bfxr:metrics(bfxr.samples,bfxr.rate),nerulio:metrics(nerulio.left,nerulio.rate)}));}
