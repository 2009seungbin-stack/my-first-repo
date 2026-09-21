async () => {
 const {modernMedia,releaseOutput}=await import('/src/media-modern.js');
 const B=await import('/assets/vendor/mediabunny-1.58.1/mediabunny.min.mjs');
 const file=new File([await(await fetch('/test-results/quality/signal-1080p.mp4')).blob()],'signal.mp4',{type:'video/mp4'});
 const probe=await modernMedia('probe',file);
 const out={probe,encodableAudio:{},cases:[]};
 for(const c of ['aac','opus','mp3','vorbis','pcm-s16']){try{out.encodableAudio[c]=await B.canEncodeAudio(c);}catch(e){out.encodableAudio[c]=String(e);}}
 for(const c of ['avc','vp9','vp8','av1']){try{out['enc_'+c]=await B.canEncodeVideo(c,{width:640,height:360});}catch(e){out['enc_'+c]=String(e);}}
 const options=[{mode:'precise',format:probe.mp4?'mp4':'webm',width:640,fps:30,start:0,end:4,targetMB:.35},
   {mode:'precise',format:probe.mp4?'mp4':'webm',width:640,fps:24,start:1.25,end:3.75,preset:'balanced',bitrate:400000}];
 for(const o of options){
  try{const r=await modernMedia('convert',file,o);out.cases.push({options:o,report:r.report});await releaseOutput(r.blob);}
  catch(e){out.cases.push({options:o,error:String(e&&e.message||e)});}
 }
 return out;
}
