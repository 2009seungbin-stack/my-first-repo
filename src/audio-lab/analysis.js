/** Bounded, deterministic music analysis. All functions are pure and run in a Worker. */
const MAJOR=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NAMES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const TWO_PI=2*Math.PI;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function monoView(channels,limit=Infinity){
 if(!Array.isArray(channels)||!channels.length||channels.length>8)throw Error('channels');
 const n=Math.min(limit,channels[0].length);if(!Number.isInteger(n)||n<0||channels.some(c=>!(c instanceof Float32Array)||c.length<n))throw Error('samples');
 if(channels.length===1)return channels[0].subarray(0,n);
 const out=new Float32Array(n),power=new Float64Array(channels.length);let midPower=0;
 for(let i=0;i<n;i++){let v=0;for(let c=0;c<channels.length;c++){const sample=channels[c][i];v+=sample;power[c]+=sample*sample;}out[i]=v/channels.length;midPower+=out[i]*out[i];}
 // A wide stereo recording can contain anti-phase material. Do not assign
 // 'silence' solely because averaging its channels canceled the music.
 const strongest=power.indexOf(Math.max(...power));return midPower<power[strongest]*.1?channels[strongest].subarray(0,n):out;
}
export function decimate(input,factor){
 if(!Number.isInteger(factor)||factor<1)throw Error('factor');if(factor===1)return input;
 const n=Math.ceil(input.length/factor),out=new Float32Array(n);for(let i=0;i<n;i++){let v=0,k=0;for(let j=i*factor;j<Math.min(input.length,(i+1)*factor);j++){v+=input[j];k++;}out[i]=v/k;}return out;
}
/** In-place radix-2 FFT on reusable real/imaginary arrays. */
export function fft(re,im){
 const n=re.length;if(n!==im.length||!n||(n&(n-1)))throw Error('fft size');
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const a=-TWO_PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let off=0;off<n;off+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const u=off+j,v=u+len/2,tr=cr*re[v]-ci*im[v],ti=cr*im[v]+ci*re[v];re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;const next=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=next;}}}
}
const hann=(n,i)=>.5-.5*Math.cos(TWO_PI*i/(n-1));
function spectrum(input,start,re,im){for(let i=0;i<re.length;i++){re[i]=(input[start+i]||0)*hann(re.length,i);im[i]=0;}fft(re,im);}
function pearson(a,b){const n=a.length;let sa=0,sb=0,saa=0,sbb=0,sab=0;for(let i=0;i<n;i++){sa+=a[i];sb+=b[i];saa+=a[i]*a[i];sbb+=b[i]*b[i];sab+=a[i]*b[i];}const num=sab-sa*sb/n,den=Math.sqrt(Math.max(0,saa-sa*sa/n)*Math.max(0,sbb-sb*sb/n));return den?num/den:0;}
export function estimateTempo(input,sampleRate){
 if(!(input instanceof Float32Array)||!(sampleRate>=8000&&sampleRate<=192000))throw Error('audio');
 const factor=Math.max(1,Math.floor(sampleRate/11025)),x=decimate(input,factor),sr=sampleRate/factor,nfft=1024,hop=128;
 if(x.length<sr*3)return {bpm:null,confidence:0,candidates:[],reason:'too-short'};
 const frames=Math.floor((x.length-nfft)/hop)+1;if(frames<16)return {bpm:null,confidence:0,candidates:[],reason:'too-short'};
 const re=new Float64Array(nfft),im=new Float64Array(nfft),prev=new Float64Array(nfft/2),onset=new Float64Array(frames);let total=0;
 for(let f=0;f<frames;f++){spectrum(x,f*hop,re,im);let flux=0;for(let k=2;k<nfft/2;k++){const hz=k*sr/nfft,mag=Math.hypot(re[k],im[k]);if(hz>=35&&hz<=5000){const diff=mag-prev[k];if(diff>0)flux+=diff*(hz<180?1.8:1);}prev[k]=mag;}onset[f]=flux;total+=flux;}
 if(total<1e-5)return {bpm:null,confidence:0,candidates:[],reason:'no-onsets'};
 // Local mean removal makes slowly varying level changes less likely to masquerade as beats.
 const norm=new Float64Array(frames);for(let i=0;i<frames;i++){let m=0,c=0;for(let j=Math.max(0,i-8);j<=Math.min(frames-1,i+8);j++){m+=onset[j];c++;}norm[i]=Math.max(0,onset[i]-m/c);}
 const rate=sr/hop,lo=Math.floor(rate*60/220),hi=Math.ceil(rate*60/50),scores=[];
 // Strong onset spacing provides an independent pulse cue when an accented
 // downbeat makes the autocorrelation prefer half time.
 const floor=Math.max(...norm)*.18,events=[];
 for(let i=1;i<frames-1;i++)if(norm[i]>floor&&norm[i]>=norm[i-1]&&norm[i]>norm[i+1]){
  if(events.length&&i-events.at(-1)<rate*.19){if(norm[i]>norm[events.at(-1)])events[events.length-1]=i;}
  else events.push(i);
 }
 const gaps=events.slice(1).map((v,i)=>v-events[i]).filter(g=>g>=rate*60/240&&g<=rate*60/50).sort((a,b)=>a-b);
 const pulseBpm=gaps.length>=5?60*rate/gaps[Math.floor(gaps.length/2)]:null;
 for(let lag=lo;lag<=hi;lag++){let sum=0,a=0,b=0;for(let i=lag;i<frames;i++){sum+=norm[i]*norm[i-lag];a+=norm[i]*norm[i];b+=norm[i-lag]*norm[i-lag];}const c=sum/Math.sqrt(a*b||1),bpm=60*rate/lag;if(bpm>=50&&bpm<=220)scores.push({bpm,score:c,lag});}
 // A regular accent every other click produces a stronger 60 BPM lag than the
 // constructed 120 BPM pulse. Prefer the common beat band mildly, but expose
 // both candidates rather than hiding a musically real half-time reading.
 scores.sort((a,b)=>b.score*(b.bpm>=80&&b.bpm<=180?1.3:1)-a.score*(a.bpm>=80&&a.bpm<=180?1.3:1));
 if(pulseBpm&&pulseBpm>=50&&pulseBpm<=220){const index=scores.findIndex(v=>Math.abs(Math.log2(v.bpm/pulseBpm))<.06),leader=scores[0],pulse=scores[index];if(pulse&&leader&&pulse.score>leader.score*.7&&Math.abs(Math.log2(pulse.bpm/leader.bpm))>.7)scores.unshift(...scores.splice(index,1));}
 const best=scores[0];if(!best||best.score<.08)return {bpm:null,confidence:0,candidates:[],reason:'weak-beat'};
 const rivals=scores.filter(x=>Math.abs(Math.log2(x.bpm/best.bpm))>.08&&Math.abs(Math.log2(x.bpm/best.bpm)-1)>.08&&Math.abs(Math.log2(x.bpm/best.bpm)+1)>.08);
 const harmonic=scores.filter(x=>Math.abs(Math.abs(Math.log2(x.bpm/best.bpm))-1)<.08).sort((a,b)=>b.score-a.score)[0];
 const margin=best.score-(rivals[0]?.score||0),ambiguous=!!harmonic&&harmonic.score/best.score>.75,confidence=clamp(.55*best.score+.45*margin*2,0,1)*(ambiguous?.65:1);
 if(confidence<.2)return {bpm:null,confidence,candidates:[],reason:'weak-beat'};
 const left=scores.find(x=>x.lag===best.lag-1)?.score,right=scores.find(x=>x.lag===best.lag+1)?.score;
 const denominator=left!==undefined&&right!==undefined?left-2*best.score+right:0;
 const offset=denominator<-.0001?clamp(.5*(left-right)/denominator,-.5,.5):0;
 const beatSeconds=(best.lag+offset)/rate,bpm=60/beatSeconds;
 const candidates=[bpm,bpm/2,bpm*2].filter(v=>v>=35&&v<=300).map(v=>Math.round(v*10)/10);
 return {bpm:Math.round(bpm*10)/10,confidence,candidates,reason:ambiguous?'half-double':confidence<.27?'ambiguous':null,beatSeconds};
}
export function estimateKey(input,sampleRate){
 if(!(input instanceof Float32Array)||!(sampleRate>=8000&&sampleRate<=192000))throw Error('audio');
 const factor=Math.max(1,Math.floor(sampleRate/22050)),x=decimate(input,factor),sr=sampleRate/factor,nfft=4096,hop=2048;
 if(x.length<sr*2)return {key:null,confidence:0,reason:'too-short',alternatives:[]};
 const re=new Float64Array(nfft),im=new Float64Array(nfft),chroma=new Float64Array(12),chunks=Array.from({length:4},()=>new Float64Array(12));let frames=0;
 for(let start=0;start+nfft<=x.length;start+=hop){spectrum(x,start,re,im);let frameEnergy=0;for(let k=10;k<nfft/2;k++){const hz=k*sr/nfft;if(hz<65||hz>4200)continue;const mag=Math.hypot(re[k],im[k]);frameEnergy+=mag*mag;}
  if(frameEnergy<1e-6)continue;let frameSum=0;const local=new Float64Array(12);
  for(let k=10;k<nfft/2;k++){const hz=k*sr/nfft;if(hz<65||hz>4200)continue;const mag=Math.hypot(re[k],im[k]);if(mag<1e-5)continue;const midi=69+12*Math.log2(hz/440),pc=((Math.round(midi)%12)+12)%12;const cent=Math.abs(midi-Math.round(midi));const weight=Math.sqrt(mag)/(1+hz/2000)*Math.max(0,1-cent);local[pc]+=weight;frameSum+=weight;}
  if(!frameSum)continue;const chunk=Math.min(3,Math.floor(start/x.length*4));for(let pc=0;pc<12;pc++){const v=local[pc]/frameSum;chroma[pc]+=v;chunks[chunk][pc]+=v;}frames++;
 }
 if(frames<8)return {key:null,confidence:0,reason:'no-tonality',alternatives:[]};
 const distribution=Array.from(chroma,v=>v/frames),active=distribution.filter(v=>v>.06).length;
 if(active<4||Math.max(...distribution)>.55)return {key:null,confidence:0,reason:'insufficient-harmony',alternatives:[],chroma:distribution};
 const score=arr=>{const list=[];for(let tonic=0;tonic<12;tonic++)for(const [mode,profile] of [['major',MAJOR],['minor',MINOR]]){const rotated=Array.from({length:12},(_,pc)=>profile[(pc-tonic+12)%12]);list.push({tonic,mode,score:pearson(arr,rotated)});}return list.sort((a,b)=>b.score-a.score);};
 const ranked=score(chroma),first=ranked[0],second=ranked[1],stable=chunks.map(c=>score(c)[0]).filter(c=>c.score>.1).filter(c=>c.tonic===first.tonic&&c.mode===first.mode).length/4;
 const margin=first.score-second.score,confidence=clamp(.55*first.score+.25*margin*3+.2*stable,0,1);
 const label=c=>`${NAMES[c.tonic]} ${c.mode}`;
 return {key:confidence<.2?null:label(first),confidence,alternatives:ranked.slice(1,4).map(c=>({key:label(c),score:Math.round(c.score*1000)/1000})),chroma:Array.from(chroma,v=>v/frames),reason:confidence<.2?'ambiguous':confidence<.45?'low-confidence':null};
}
export function analyze(input,sampleRate){return {tempo:estimateTempo(input,sampleRate),key:estimateKey(input,sampleRate)};}
