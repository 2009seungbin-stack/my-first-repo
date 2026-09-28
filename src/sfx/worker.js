import {render} from './engine.js';
import {encodeWav} from './wav.js';
import {encodeCompressed} from './encode.js';
import {parseJsfxr,renderJsfxr} from './jsfxr-format.js';
let current=null,storedSamples={};
function metrics(left,right,rate){let peak=0,dc=0,rms=0,clippedSamples=0;for(let i=0;i<left.length;i++){const a=left[i],b=right[i];peak=Math.max(peak,Math.abs(a),Math.abs(b));dc+=(a+b)/2;rms+=(a*a+b*b)/2;if(Math.abs(a)>1||Math.abs(b)>1)clippedSamples++;}return {frames:left.length,duration:left.length/rate,peak,dc:dc/left.length,rms:Math.sqrt(rms/left.length),clippedSamples};}
function legacy(value){const p=parseJsfxr(value),b=renderJsfxr(p),left=Float32Array.from(b.pcm),right=left.slice();return {left,right,rate:b.rate,metrics:metrics(left,right,b.rate)};}
self.onmessage=async({data:m})=>{try{if(m.op==='sample'){if(!(m.pcm instanceof Float32Array)||m.pcm.length>48000*180)throw Error('Sample too long');storedSamples[m.sampleId]=m.pcm;self.postMessage({id:m.id,ok:true,op:'sample'});return;}
 if(m.op==='render'){current=m.legacy?legacy(m.legacy):render(m.project,storedSamples);const {left,right,rate,metrics:report}=current;const l=left.slice(),r=right.slice();self.postMessage({id:m.id,ok:true,op:'render',rate,metrics:report,left:l,right:r},[l.buffer,r.buffer]);return;}
 if(m.op==='export'){if(!current)throw Error('Render a sound first');const {left,right,rate}=current;let bytes;if(m.format==='wav')bytes=encodeWav([left,right],rate,m.bits===24?24:16);else bytes=await encodeCompressed([left,right],rate,m.format);self.postMessage({id:m.id,ok:true,op:'export',bytes,format:m.format},[bytes.buffer]);return;}
 throw Error('Unknown SFX job');
 }catch(e){self.postMessage({id:m.id,ok:false,error:String(e?.message||e)});}};
