async () => {
 const {modernMedia,releaseOutput}=await import('/src/media-modern.js');
 const file=new File([await(await fetch('/test-results/quality/signal-1080p.mp4')).blob()],'signal.mp4',{type:'video/mp4'});
 const probe=await modernMedia('probe',file);
 const out={probe,cases:[]};
 const b64=async b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b);});
 const cases=[
  ['target',   'convert',{mode:'precise',format:probe.mp4?'mp4':'webm',width:640,fps:30,start:0,end:4,targetMB:.35}],
  ['target-sm','convert',{mode:'precise',format:probe.mp4?'mp4':'webm',width:640,fps:30,start:0,end:4,targetMB:.15}],
  ['mute',     'convert',{mode:'precise',format:probe.mp4?'mp4':'webm',width:480,start:0,end:2,mute:true}],
  ['crop',     'convert',{mode:'precise',format:'webm',width:480,start:0,end:1,crop:'1:1'}],
  ['mp3fade',  'convert',{format:'mp3',start:.5,end:4.5,audioBitrate:192,fadeIn:1,fadeOut:1}],
  ['mp3norm',  'convert',{format:'mp3',start:.5,end:4.5,audioBitrate:192,normalize:true}],
  ['gifspeed', 'gif',{start:0,end:2,width:320,fps:10,colors:64,speed:2}],
  ['gifrev',   'gif',{start:0,end:1,width:240,fps:10,colors:64,reverse:true}],
  ['gifcrop',  'gif',{start:0,end:1,width:320,fps:10,colors:64,crop:'1:1'}],
  ['giftarget','gif',{start:0,end:2,width:480,fps:15,colors:256,targetMB:.25}],
  ['estimate', 'estimate',{start:0,end:2,width:480,fps:15,colors:256}],
  ['thumbs',   'thumbs',{start:0,end:6,count:8,width:120}],
 ];
 for(const [name,action,o] of cases){
  try{const r=await modernMedia(action,file,o);
   const row={name,report:r.report,size:r.blob?r.blob.size:0};
   if(r.thumbs)row.thumbs=r.thumbs.map(t=>t.blob.size);
   if(r.blob&&r.blob.size<3e6)row._data=await b64(r.blob),row._ext=action==='gif'?'gif':(o.format||'bin');
   out.cases.push(row);await releaseOutput(r.blob);}
  catch(e){out.cases.push({name,error:String(e&&e.message||e),errName:e&&e.name});}
 }
 return out;
}
