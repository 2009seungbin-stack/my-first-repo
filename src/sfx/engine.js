/** Deterministic local SFX engine. Samples are float PCM; export encoders live separately.
 * Inspired by the control vocabulary of sfxr, not a claim of sample-identical rendering.
 * Reference: https://drpetter.se/project_sfxr.html (MIT); https://github.com/chr15m/jsfxr (Unlicense).
 */
export const RATE=[44100,48000];
export const WAVES=['square','saw','sine','triangle','white','pink','brown','bitnoise','pulse','breaker','tan','whistle','rasp','voice','fm'];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(+v)?+v:a));
const frac=x=>x-Math.floor(x);
export function rng(seed){let n=(Number(seed)>>>0)||1;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
export function layer(wave='square',over={}){return {wave,gain:.55,pan:0,start:0,attack:.002,decay:.05,sustain:.65,hold:.07,release:.13,freq:520,slide:0,delta:0,vibDepth:0,vibHz:5,arpSemitones:0,arpHz:0,duty:.5,dutySweep:0,lp:20000,hp:0,resonance:0,phaserMs:0,phaserSweep:0,crushBits:16,repeatHz:0,kind:'synth',...over};}
export function project(seed=1){return {version:1,seed:seed>>>0,rate:44100,master:.72,limiter:true,layers:[layer()],sequence:[],samples:{}};}
const PRESETS={
 coin:[layer('square',{freq:880,slide:1800,hold:.035,release:.11,arpSemitones:12,arpHz:14})],
 jump:[layer('triangle',{freq:350,slide:550,hold:.14,release:.18})],
 laser:[layer('saw',{freq:1700,slide:-2100,hold:.13,release:.16,lp:9000})],
 explosion:[layer('brown',{freq:240,slide:-160,hold:.20,release:.6,lp:3600}),layer('white',{freq:130,hold:.04,release:.3,gain:.18})],
 hit:[layer('white',{freq:680,hold:.015,release:.12,lp:7000}),layer('square',{freq:180,slide:-250,hold:.025,release:.11,gain:.26})],
 powerup:[layer('sine',{freq:390,slide:840,hold:.24,release:.22,arpSemitones:7,arpHz:9})],
 click:[layer('square',{freq:1000,hold:.005,release:.018,gain:.35})],
 ui:[layer('sine',{freq:640,hold:.025,release:.08,gain:.43})]
};
export const PRESET_NAMES=Object.keys(PRESETS);
export function preset(name,seed=1){const random=rng(seed),p=project(seed);p.layers=(PRESETS[name]||PRESETS.ui).map(x=>({...x,freq:Math.max(30,x.freq*(.96+random()*.08))}));return p;}
export function validate(input){if(!input||typeof input!=='object')throw Error('Invalid SFX project');const p=project(input.seed);p.rate=RATE.includes(input.rate)?input.rate:44100;p.master=clamp(input.master,0,2);p.limiter=input.limiter!==false;
 if(!Array.isArray(input.layers)||!input.layers.length||input.layers.length>4)throw Error('Use 1–4 layers');
 p.layers=input.layers.map(raw=>{const x=layer(),o={};if(raw.kind==='sample')o.kind='sample';o.wave=WAVES.includes(raw.wave)?raw.wave:x.wave;
 for(const [k,a,b] of [['gain',0,2],['pan',-1,1],['start',0,180],['attack',0,10],['decay',0,10],['sustain',0,1],['hold',0,180],['release',0,30],['freq',20,20000],['slide',-20000,20000],['delta',-20000,20000],['vibDepth',0,1],['vibHz',0,100],['arpSemitones',-48,48],['arpHz',0,100],['duty',.01,.99],['dutySweep',-1,1],['lp',20,20000],['hp',0,20000],['resonance',0,.99],['phaserMs',-50,50],['phaserSweep',-50,50],['crushBits',1,16],['repeatHz',0,100]])o[k]=clamp(raw[k]??x[k],a,b);
 o.sampleId=typeof raw.sampleId==='string'?raw.sampleId.slice(0,80):'';return {...x,...o};});
 p.sequence=Array.isArray(input.sequence)?input.sequence.slice(0,64).map(s=>({layer:Math.floor(clamp(s.layer,0,3)),at:clamp(s.at,0,180),pitch:clamp(s.pitch,-48,48),gain:clamp(s.gain??1,0,2)})):[];
 return p;
}
function env(t,x){if(t<0)return 0;if(t<x.attack)return x.attack?Math.max(0,t/x.attack):1;t-=x.attack;if(t<x.decay)return 1-(1-x.sustain)*(x.decay?t/x.decay:1);t-=x.decay;if(t<x.hold)return x.sustain;t-=x.hold;return x.release?x.sustain*Math.max(0,1-t/x.release):0;}
function osc(w,phase,duty,random,noise){const f=frac(phase);switch(w){case 'square':case 'pulse':return f<duty?1:-1;case 'saw':return 2*f-1;case 'triangle':return 1-4*Math.abs(f-.5);case 'sine':return Math.sin(phase*2*Math.PI);case 'white':return random()*2-1;case 'pink':noise.pink=.97*noise.pink+.03*(random()*2-1);return noise.pink*3;case 'brown':noise.brown=clamp(noise.brown+(random()-.5)*.12,-1,1);return noise.brown;case 'bitnoise':return (Math.floor(phase*13)&1)?1:-1;case 'breaker':return Math.abs(2*f-1)*2-1;case 'tan':return Math.tanh(3*Math.sin(phase*2*Math.PI));case 'whistle':return .75*Math.sin(phase*2*Math.PI)+.25*Math.sin(phase*8*Math.PI);case 'rasp':return Math.sign(Math.sin(phase*2*Math.PI))*(.6+.4*(random()*2-1));case 'voice':return .55*Math.sin(phase*2*Math.PI)+.3*Math.sin(phase*6*Math.PI)+.15*Math.sin(phase*10*Math.PI);case 'fm':return Math.sin(2*Math.PI*(phase+.2*Math.sin(phase*4*Math.PI)));default:return 0;}}
function renderVoice(dstL,dstR,x,seed,rate,at=0,pitch=0,gain=1,sample=null){const random=rng(seed);const duration=x.attack+x.decay+x.hold+x.release;const start=Math.round((at+x.start)*rate),max=Math.min(dstL.length-start,Math.ceil(duration*rate));if(max<=0)return;let phase=0,lp=0,lp2=0,hp=0,pink=0,brown=0,crush=0,last=-1;const noise={pink,brown};const delayLen=Math.max(1,Math.ceil(.1*rate)),delay=new Float32Array(delayLen);let prev=0;
 for(let i=0;i<max;i++){let t=i/rate;if(x.repeatHz)t=t%(1/x.repeatHz);const e=env(t,x);if(e<=0)continue;let hz=x.freq+x.slide*t+.5*x.delta*t*t;if(x.arpHz)hz*=2**(x.arpSemitones/12*Math.floor(t*x.arpHz));if(x.vibDepth)hz*=2**(x.vibDepth*Math.sin(t*x.vibHz*2*Math.PI));hz=clamp(hz*2**(pitch/12),1,rate*.45);phase+=hz/rate;
 let v;if(x.kind==='sample'){const j=Math.floor(t*rate*2**(pitch/12));v=sample&&j<sample.length?sample[j]:0;}else v=osc(x.wave,phase,clamp(x.duty+x.dutySweep*t,.01,.99),random,noise);
 // Two-stage low-pass with a feedback term, followed by a one-pole high-pass.
 const lpCoef=Math.min(.99,2*Math.PI*Math.min(x.lp,rate*.45)/rate);lp+=(v-lp-x.resonance*(lp-lp2))*lpCoef;lp2+=(lp-lp2)*lpCoef;v=lp2;
 if(x.hp){const hpc=Math.exp(-2*Math.PI*x.hp/rate);hp=hpc*(hp+v-prev);prev=v;v=hp;}
 if(x.phaserMs){const d=Math.min(delayLen-1,Math.max(1,Math.floor(Math.abs(x.phaserMs+x.phaserSweep*t)*rate/1000)));const pos=i%delayLen;v=.7*v+.3*delay[(pos-d+delayLen)%delayLen];delay[pos]=v;}
 const steps=2**x.crushBits;if(x.crushBits<16){const stride=Math.max(1,Math.ceil(16/x.crushBits));if(i%stride===0)crush=Math.round(v*steps)/steps;v=crush;}
 v*=e*x.gain*gain;const pan=clamp(x.pan,-1,1),l=Math.cos((pan+1)*Math.PI/4),r=Math.sin((pan+1)*Math.PI/4);dstL[start+i]+=v*l;dstR[start+i]+=v*r;last=i;
 }
 return last;
}
export function render(raw,samples={}){const p=validate(raw),rate=p.rate;let seconds=0;for(const x of p.layers)seconds=Math.max(seconds,x.start+x.attack+x.decay+x.hold+x.release);for(const s of p.sequence){const x=p.layers[s.layer];if(x)seconds=Math.max(seconds,s.at+x.start+x.attack+x.decay+x.hold+x.release);}seconds=Math.min(180,Math.max(.05,seconds+.015));const n=Math.ceil(seconds*rate),left=new Float32Array(n),right=new Float32Array(n);
 p.layers.forEach((x,i)=>renderVoice(left,right,x,(p.seed+i*2654435761)>>>0,rate,0,0,1,samples[x.sampleId]));p.sequence.forEach((s,j)=>{const x=p.layers[s.layer];if(x)renderVoice(left,right,x,(p.seed+s.layer*131+j*104729)>>>0,rate,s.at,s.pitch,s.gain,samples[x.sampleId]);});
 let peak=0,dc=0,rms=0,clipped=0;for(let i=0;i<n;i++){let a=left[i]*p.master,b=right[i]*p.master;peak=Math.max(peak,Math.abs(a),Math.abs(b));if(Math.abs(a)>1||Math.abs(b)>1)clipped++;if(p.limiter){a=Math.tanh(a);b=Math.tanh(b);}left[i]=a;right[i]=b;dc+=(a+b)/2;rms+=(a*a+b*b)/2;}
 return {left,right,rate,metrics:{duration:n/rate,peak,dc:dc/n,rms:Math.sqrt(rms/n),clippedSamples:clipped,frames:n}};
}
