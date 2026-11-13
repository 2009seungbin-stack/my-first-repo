/** Mono sample voices use either an equal channel average or one explicitly selected channel.
 * This is not a spatial/speaker-layout downmix. Resampling retains the importer's interpolation. */
export function prepareSample(buffer,{rate=44100,mode='mix'}={}){
 if(!['mix','channel1','channel2'].includes(mode))throw Error('Invalid sample channel choice');
 const count=buffer?.numberOfChannels,sourceRate=buffer?.sampleRate,length=buffer?.length;
 if(![44100,48000].includes(rate)||!Number.isInteger(count)||count<1||count>32||!Number.isFinite(sourceRate)||sourceRate<=0||!Number.isInteger(length)||length<1)throw Error('Invalid decoded sample');
 if(mode==='channel2'&&count<2)throw Error('SAMPLE_CHANNEL_MISSING');
 const indices=mode==='mix'?Array.from({length:count},(_,i)=>i):[mode==='channel2'?1:0];
 const channels=indices.map(i=>buffer.getChannelData(i));
 if(channels.some(c=>!(c instanceof Float32Array)||c.length!==length))throw Error('Invalid decoded sample');
 const duration=Math.min(180,length/sourceRate),n=Math.ceil(duration*rate),pcm=new Float32Array(n);
 let channelPeak=0,monoPeak=0;
 for(let i=0;i<n;i++){
  const pos=i*sourceRate/rate,j=Math.floor(pos),f=pos-j;let sum=0;
  for(const channel of channels){
   const a=j<length?channel[j]:0,b=j+1<length?channel[j+1]:0;
   if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Invalid decoded sample');
   const v=a*(1-f)+b*f;sum+=v;channelPeak=Math.max(channelPeak,Math.abs(v));
  }
  pcm[i]=sum/channels.length;monoPeak=Math.max(monoPeak,Math.abs(pcm[i]));
 }
 return {pcm,rate,duration,mode,sourceChannels:count,channelPeak,monoPeak,
  cancelled:mode==='mix'&&count>1&&channelPeak>1e-6&&monoPeak<=channelPeak*1e-4,
  truncated:length/sourceRate>180};
}
