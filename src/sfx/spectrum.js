/** Averaged magnitude spectrum for the SFX preview. Pure DSP on float PCM; no Web Audio dependency.
 * The preview is a Hann-windowed, power-averaged FFT. It is a visual aid, not a calibrated loudness meter.
 */
/** Radix-2 FFT. Returns n/2 amplitudes: a cosine of amplitude A centred on bin k gives A at index k; DC gives the mean. */
export function fftMagnitudes(input){const n=input.length;if(n<2||(n&(n-1)))throw Error('FFT size must be a power of two');const re=Float64Array.from(input),im=new Float64Array(n);
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const t=re[i];re[i]=re[j];re[j]=t;}}
 for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang),half=len>>1;for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<half;k++){const a=i+k,b=a+half,xr=re[b]*cr-im[b]*ci,xi=re[b]*ci+im[b]*cr;re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}}
 const out=new Float64Array(n>>1);for(let i=0;i<out.length;i++)out[i]=Math.hypot(re[i],im[i])*2/n;out[0]/=2;return out;}
/** Power-average of up to maxFrames half-overlapping Hann frames of the mono mix. Silent frames are skipped. */
export function averageSpectrum(left,right,rate,size=2048,maxFrames=48){const n=left.length,hop=size>>1,total=Math.max(1,Math.ceil(Math.max(0,n-size)/hop)+1),stride=Math.max(1,Math.ceil(total/maxFrames)),bins=size>>1,power=new Float64Array(bins),frame=new Float64Array(size);let frames=0;
 for(let f=0;f<total;f+=stride){const at=f*hop;let energy=0;for(let i=0;i<size;i++){const j=at+i,v=j<n?(left[j]+(right?right[j]:left[j]))*.5:0;frame[i]=v*(.5-.5*Math.cos(2*Math.PI*i/size));energy+=v*v;}
  if(energy<=1e-12)continue;const m=fftMagnitudes(frame);for(let i=0;i<bins;i++){const a=m[i]*2;power[i]+=a*a;}frames++;}
 const mags=new Float64Array(bins);let peak=0,peakBin=0;if(frames)for(let i=0;i<bins;i++){mags[i]=Math.sqrt(power[i]/frames);if(i>0&&mags[i]>peak){peak=mags[i];peakBin=i;}}
 let shift=0;if(peakBin>0&&peakBin<bins-1){const a=Math.log(mags[peakBin-1]+1e-12),b=Math.log(mags[peakBin]+1e-12),c=Math.log(mags[peakBin+1]+1e-12),d=a-2*b+c;if(d<0)shift=Math.max(-.5,Math.min(.5,.5*(a-c)/d));}
 return {mags,binHz:rate/size,peak,peakHz:peak>0?(peakBin+shift)*rate/size:0,frames};}
/** Log-spaced display bands in dB relative to full scale, clamped to [floorDb, 0]. */
export function spectrumBands(mags,binHz,count=96,minHz=40,maxHz=20000,floorDb=-84){const out=new Float64Array(count),ratio=maxHz/minHz,last=mags.length-1;
 for(let k=0;k<count;k++){const lo=minHz*ratio**(k/count),hi=minHz*ratio**((k+1)/count),a=Math.ceil(lo/binHz),b=Math.min(last,Math.ceil(hi/binHz)-1);let v=0;
  if(a<=b){for(let i=a;i<=b;i++)v=Math.max(v,mags[i]);}else{const x=Math.min(last,Math.sqrt(lo*hi)/binHz),i=Math.floor(x),t=x-i;v=mags[i]*(1-t)+(mags[Math.min(last,i+1)]||0)*t;}
  out[k]=Math.max(floorDb,Math.min(0,20*Math.log10(v+1e-12)));}
 return out;}
