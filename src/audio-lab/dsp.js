/** Browser-local audio editing DSP. No network, DOM or implicit file persistence. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const db=x=>20*Math.log10(Math.max(1e-12,x));
const gain=dB=>10**(dB/20);
export function validateAudio(channels,sampleRate){
 if(!Array.isArray(channels)||!channels.length||channels.length>2||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length)||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('invalid audio');
 if(channels[0].length>sampleRate*180)throw Error('audio exceeds 3 minute limit');
 for(const channel of channels)for(const sample of channel)if(!Number.isFinite(sample))throw Error('audio contains non-finite samples');
 return channels[0].length;
}
/** 4-point interpolation keeps the resampling path bounded and dependency-free. */
export function resample(channels,ratio){
 if(!Number.isFinite(ratio)||ratio<.25||ratio>4)throw Error('resample ratio');
 if(ratio===1)return channels;
 const n=channels[0].length,outLen=Math.max(1,Math.round(n/ratio));
 return channels.map(src=>{const dst=new Float32Array(outLen);for(let i=0;i<outLen;i++)dst[i]=at(src,i,ratio);return dst;});
}
function at(src,index,ratio){if(ratio===1)return src[Math.min(src.length-1,index)];const x=index*ratio,j=Math.floor(x),t=x-j,n=src.length;
 const p0=src[clamp(j-1,0,n-1)],p1=src[clamp(j,0,n-1)],p2=src[clamp(j+1,0,n-1)],p3=src[clamp(j+2,0,n-1)];
 return p1+.5*t*(p2-p0+t*(2*p0-5*p1+4*p2-p3+t*(3*(p1-p2)+p3-p0)));
}
/** WSOLA time scaling with a shared stereo offset to preserve stereo coherence. */
export function stretch(channels,speed){
 return stretchVirtual(channels,speed,1);
}
function stretchVirtual(channels,speed,ratio){
 if(!Number.isFinite(speed)||speed<.25||speed>4)throw Error('speed');if(speed===1)return ratio===1?channels:resample(channels,ratio);
 const n=Math.max(1,Math.round(channels[0].length/ratio)),outLen=Math.max(1,Math.round(n/speed)),frame=Math.min(2048,Math.max(256,2**Math.floor(Math.log2(Math.max(256,n/4))))),hop=frame/2,search=Math.min(128,hop/4);
 const out=channels.map(()=>new Float32Array(outLen)),weight=new Float32Array(outLen),window=Float32Array.from({length:frame},(_,i)=>Math.sin(Math.PI*(i+.5)/frame)**2);
 let prevSource=0;
 // Centering the analysis frame around the intended source time cancels the
 // systematic transient lead/lag otherwise introduced by overlap-add.
 for(let dest=0;dest<outLen;dest+=hop){const expected=dest*speed+(speed-1)*frame,maxStart=Math.max(0,n-frame),nominal=clamp(Math.round(expected),0,maxStart);let start=nominal;
  if(dest>0){let best=-Infinity;for(let delta=-search;delta<=search;delta+=4){const candidate=clamp(nominal+delta,0,maxStart);let cross=0,aa=0,bb=0;
    for(let k=0;k<hop&&dest+k<outLen;k+=16){const before=weight[dest+k]?out[0][dest+k]/weight[dest+k]:0,after=at(channels[0],Math.min(n-1,candidate+k),ratio);cross+=before*after;aa+=before*before;bb+=after*after;}
    const score=cross/Math.sqrt(aa*bb+1e-12)-Math.abs(candidate-prevSource-speed*hop)*.00001;if(score>best){best=score;start=candidate;}
   }
  }
  prevSource=start;
  for(let k=0;k<frame&&dest+k<outLen;k++){const w=window[k],srcIndex=start+k;if(srcIndex>=n)break;weight[dest+k]+=w;for(let c=0;c<channels.length;c++)out[c][dest+k]+=at(channels[c],srcIndex,ratio)*w;}
 }
 for(let i=0;i<outLen;i++)for(const c of out)c[i]=weight[i]?c[i]/weight[i]:0;
 return out;
}
/** Pitch in semitones and time speed are independent: resample then compensate duration via WSOLA. */
export function shift(channels,{speed=1,semitones=0}={}){
 if(!Number.isFinite(semitones)||Math.abs(semitones)>12||!Number.isFinite(speed)||speed<.5||speed>2)throw Error('shift settings');
 const pitch=2**(semitones/12);return stretchVirtual(channels,speed/pitch,pitch);
}
export function silenceBounds(channels,sampleRate,{thresholdDb=-42,dwellMs=80,padMs=15}={}){
 const n=channels[0].length,window=Math.max(1,Math.round(sampleRate*.01)),threshold=gain(thresholdDb),dwell=Math.ceil(sampleRate*dwellMs/1000),pad=Math.round(sampleRate*padMs/1000);let first=-1,last=-1,run=0;
 for(let i=0;i<n;i+=window){let peak=0;for(const c of channels)for(let j=i;j<Math.min(n,i+window);j++)peak=Math.max(peak,Math.abs(c[j]));if(peak>=threshold){if(first<0)first=i;last=Math.min(n,i+window);run=0;}else run+=window;}
 if(first<0)return {start:0,end:0,silent:true};
 // Preserve internal silence; short quiet edges below dwell are intentional.
 return {start:first>=dwell?clamp(first-pad,0,n):0,end:n-last>=dwell?clamp(last+pad,0,n):n,silent:false,dwellSamples:dwell};
}
export function nearestZeroCrossing(channels,sampleRate,index,{radiusMs=10}={}){
 validateAudio(channels,sampleRate);const n=channels[0].length,center=clamp(Math.round(index),0,n),radius=Math.round(clamp(radiusMs,0,20)*sampleRate/1000);let best=center,bestScore=Infinity;
 for(let i=Math.max(1,center-radius);i<Math.min(n,center+radius+1);i++){
  let score=0,crossings=0;for(const channel of channels){const a=channel[i-1],b=channel[i];score+=Math.abs(a)+Math.abs(b);if(a===0||b===0||(a<0)!==(b<0))crossings++;}
  if(!crossings)continue;score+=Math.abs(i-center)/Math.max(1,radius)*.01;if(score<bestScore){bestScore=score;best=i;}
 }
 return best;
}
export function edit(channels,sampleRate,{start=0,end=channels[0].length/sampleRate,fadeIn=0,fadeOut=0,speed=1,semitones=0,removeSilence=false,snapToZero=false}={}){
 validateAudio(channels,sampleRate);let a=clamp(Math.round(start*sampleRate),0,channels[0].length),b=clamp(Math.round(end*sampleRate),a,channels[0].length);
 if(snapToZero){a=nearestZeroCrossing(channels,sampleRate,a);b=nearestZeroCrossing(channels,sampleRate,b);if(b<=a)b=Math.min(channels[0].length,a+1);}
 if(removeSilence){const bound=silenceBounds(channels.map(c=>c.subarray(a,b)),sampleRate),base=a;if(bound.silent)throw Error('Selected range is silent; turn off silence trim or choose another range');a=base+bound.start;b=base+bound.end;}
 const outputFrames=Math.ceil((b-a)/speed);if(outputFrames>sampleRate*180||outputFrames*channels.length*4>96*1048576)throw Error('Output exceeds the 3 minute / 96 MiB memory limit; shorten selection or increase speed');
 let out=channels.map(c=>c.subarray(a,b));out=shift(out,{speed,semitones});if(speed===1&&semitones===0)out=out.map(c=>new Float32Array(c));
 const fi=Math.round(clamp(fadeIn,0,out[0].length/sampleRate)*sampleRate),fo=Math.round(clamp(fadeOut,0,out[0].length/sampleRate)*sampleRate);
 for(const c of out)for(let i=0;i<c.length;i++){let v=1;if(fi&&i<fi)v*=i/fi;if(fo&&i>=c.length-fo)v*=Math.max(0,(c.length-1-i)/fo);c[i]*=v;}
 return out;
}
function biquad(type,sr){
 // ITU-R BS.1770 K weighting frequencies/G/Q (same topology as libebur128).
 const f=type==='shelf'?1681.974450955533:38.13547087602444,q=type==='shelf'?.7071752369554196:.5003270373238773,A=type==='shelf'?10**(3.999843853973347/40):1,w=2*Math.PI*f/sr,co=Math.cos(w),si=Math.sin(w),alpha=si/(2*q);
 let b0,b1,b2,a0,a1,a2;
 if(type==='shelf'){const beta=2*Math.sqrt(A)*alpha;b0=A*((A+1)+(A-1)*co+beta);b1=-2*A*((A-1)+(A+1)*co);b2=A*((A+1)+(A-1)*co-beta);a0=(A+1)-(A-1)*co+beta;a1=2*((A-1)-(A+1)*co);a2=(A+1)-(A-1)*co-beta;}
 else{b0=(1+co)/2;b1=-(1+co);b2=(1+co)/2;a0=1+alpha;a1=-2*co;a2=1-alpha;}
 return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];
}
export function loudness(channels,sampleRate){
 validateAudio(channels,sampleRate);const n=channels[0].length,block=Math.round(sampleRate*.4),hop=Math.round(sampleRate*.1);if(n<block){let peak=0;for(const c of channels)for(const v of c)peak=Math.max(peak,Math.abs(v));return {integrated:null,momentary:null,shortTerm:null,reason:'too-short',samplePeak:peak?db(peak):null};}
 // Keep only one 400 ms ring of filtered energy, not a Float64 copy of the
 // entire 3-minute decoded file. This also preserves bounded Worker memory.
 const states=channels.map(()=>({s1:0,s2:0,h1:0,h2:0})),shelf=biquad('shelf',sampleRate),high=biquad('high',sampleRate),ring=new Float64Array(block),longBlock=Math.round(sampleRate*3),longRing=new Float64Array(longBlock),blocks=[];let sum=0,longSum=0,samplePeak=0;
 for(let i=0;i<n;i++){let energy=0;for(let c=0;c<channels.length;c++){const x=channels[c][i],state=states[c];samplePeak=Math.max(samplePeak,Math.abs(x));const y=shelf[0]*x+state.s1;state.s1=shelf[1]*x-shelf[3]*y+state.s2;state.s2=shelf[2]*x-shelf[4]*y;const z=high[0]*y+state.h1;state.h1=high[1]*y-high[3]*z+state.h2;state.h2=high[2]*y-high[4]*z;energy+=z*z;}
  const idx=i%block;sum+=energy-ring[idx];ring[idx]=energy;const longIdx=i%longBlock;longSum+=energy-longRing[longIdx];longRing[longIdx]=energy;if(i+1>=block&&(i+1-block)%hop===0)blocks.push(sum/block);
 }
 const loud=e=>-.691+10*Math.log10(Math.max(1e-20,e)),momentary=loud(sum/block),shortTerm=n>=longBlock?loud(longSum/longBlock):null;
 const above=blocks.filter(e=>loud(e)>-70);if(!above.length)return {integrated:null,momentary:null,shortTerm:null,reason:'silent',samplePeak:0};
 const mean=above.reduce((a,b)=>a+b,0)/above.length,gate=loud(mean)-10,selected=above.filter(e=>loud(e)>gate),average=selected.reduce((a,b)=>a+b,0)/selected.length;
 return {integrated:loud(average),momentary:momentary>-70?momentary:null,shortTerm:shortTerm!==null&&shortTerm>-70?shortTerm:null,samplePeak:db(samplePeak),gatedBlocks:selected.length,totalBlocks:blocks.length};
}
export function normalize(channels,sampleRate,{targetLufs=-23,ceilingDb=-1}={}){
 if(!Number.isFinite(targetLufs)||targetLufs<-35||targetLufs>-8||!Number.isFinite(ceilingDb)||ceilingDb>0||ceilingDb<-6)throw Error('loudness target');
 const before=loudness(channels,sampleRate);if(before.integrated===null)return {channels,measured:before,appliedDb:0,reason:before.reason};
 const requested=targetLufs-before.integrated,limit=ceilingDb-before.samplePeak,appliedDb=Math.min(requested,limit),scale=gain(appliedDb);
 const out=channels.map(c=>Float32Array.from(c,v=>v*scale));return {channels:out,measured:before,after:loudness(out,sampleRate),appliedDb,limited:appliedDb<requested-.01};
}
/** Guard decoded floating-point peaks above 0 dBFS before integer or lossy encoding. */
export function protectSamplePeakInPlace(channels,{ceilingDb=0}={}){
 if(!Number.isFinite(ceilingDb)||ceilingDb>0||ceilingDb<-6)throw Error('sample peak ceiling');
 let peak=0;for(const channel of channels)for(const value of channel)peak=Math.max(peak,Math.abs(value));
 const ceiling=gain(ceilingDb);if(peak<=ceiling)return {appliedDb:0,inputPeakDb:peak?db(peak):null};
 const scale=ceiling/peak;for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]*=scale;
 return {appliedDb:db(scale),inputPeakDb:db(peak)};
}
