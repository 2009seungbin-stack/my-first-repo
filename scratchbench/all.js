async () => {
 const {modernMedia,releaseOutput}=await import('/src/media-modern.js');
 const B=await import('/assets/vendor/mediabunny-1.58.1/mediabunny.min.mjs');
 const file=new File([await(await fetch('/test-results/quality/signal-1080p.mp4')).blob()],'signal.mp4',{type:'video/mp4'});
 const silent=new File([await(await fetch('/test-results/quality/signal-60-noaudio.webm')).blob()],'silent.webm');
 const four=new File([await(await fetch('/test-results/quality/signal-4k.mp4')).blob()],'4k.mp4');
 const probe=await modernMedia('probe',file);
 const out={probe,enc:{},cases:[]};
 for(const c of ['aac','opus','mp3','vorbis','pcm-s16','flac'])out.enc['a_'+c]=await B.canEncodeAudio(c).catch(e=>String(e));
 const cases=[
  ['fast',file,'convert',{mode:'fast',format:'mp4',start:1,end:4}],
  ['precise',file,'convert',{mode:'precise',format:probe.mp4?'mp4':'webm',width:640,fps:24,start:1.25,end:3.75,preset:'balanced',bitrate:400000}],
  ['target',file,'convert',{mode:'precise',format:probe.mp4?'mp4':'webm',width:640,fps:30,start:0,end:4,targetMB:.35}],
  ['mp3',file,'convert',{format:'mp3',start:.5,end:4.5,audioBitrate:192}],
  ['wav',file,'convert',{format:'wav',start:.5,end:4.5,sampleRate:44100}],
  ['silent',silent,'convert',{mode:'precise',format:probe.mp4?'mp4':'webm',start:0,end:1,width:1280,fps:60}],
  ['frame4k',four,'frame',{time:1,format:'png'}],
  ['gif',file,'gif',{start:0,end:2,width:640,fps:12,colors:128,dither:0}],
 ];
 for(const [name,f,action,o] of cases){
  try{const r=await modernMedia(action,f,o);out.cases.push({name,options:o,report:r.report,size:r.blob.size});await releaseOutput(r.blob);}
  catch(e){out.cases.push({name,options:o,error:String(e&&e.message||e),errName:e&&e.name});}
 }
 return out;
}
