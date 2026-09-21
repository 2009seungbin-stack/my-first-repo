/** Container inspection uses small range reads. Never silently flatten animation. */
export async function inspectImage(file){
 const first=new Uint8Array(await file.slice(0,64).arrayBuffer()),text=(b,a,n)=>String.fromCharCode(...b.subarray(a,a+n));
 if(text(first,0,3)==='GIF')return {format:'gif',animation:'unsupported'};
 if(text(first,1,3)==='PNG'){
  let pos=8;while(pos+12<=file.size){
   const b=new Uint8Array(await file.slice(pos,pos+8).arrayBuffer());if(b.length!==8)break;
   const len=new DataView(b.buffer).getUint32(0),kind=text(b,4,4);
   if(kind==='acTL')return {format:'png',animation:true};if(kind==='IDAT'||kind==='IEND')break;
   pos+=len+12;
  }return {format:'png',animation:false};
 }
 if(text(first,0,4)==='RIFF'&&text(first,8,4)==='WEBP')return {format:'webp',animation:text(first,12,4)==='VP8X'&&!!(first[20]&2)};
 if(text(first,4,4)==='ftyp'){
  const brands=text(first,8,first.length-8);return {format:'isobmff',animation:/avis|msf1/.test(brands)};
 }
 return {format:first[0]===255&&first[1]===216?'jpeg':'unknown',animation:false};
}
