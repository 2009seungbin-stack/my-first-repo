/** Repair only the observed duplicated SPS/PPS header signature in encoder avcC metadata.
 * Firefox 155 on this host produced 67 67 <profile> / 68 68 ... parameter sets.
 * Do not rewrite encoded video packets, valid descriptions, or unknown malformed records.
 */
export function repairAvcDescription(description){
 const data=ArrayBuffer.isView(description)?new Uint8Array(description.buffer,description.byteOffset,description.byteLength):new Uint8Array(description);
 if(data.length<8||data[0]!==1)return description;
 const groups=[];let at=6,changed=false;
 for(let group=0;group<2;group++){
  if(at>=data.length)return description;
  const count=group===0?data[5]&31:data[at++],units=[];
  for(let i=0;i<count;i++){
   if(at+2>data.length)return description;const size=data[at]*256+data[at+1];at+=2;
   if(!size||at+size>data.length)return description;let nal=data.subarray(at,at+size);at+=size;
   if(group===0&&nal.length>5&&nal[0]===0x67&&nal[1]===0x67&&nal[2]===data[1]&&nal[3]===data[2]&&nal[4]===data[3]){nal=nal.subarray(1);changed=true;}
   else if(group===1&&changed&&nal.length>2&&nal[0]===0x68&&nal[1]===0x68)nal=nal.subarray(1);
   units.push(nal);
  }
  groups.push(units);
 }
 if(!changed)return description;
 const parts=[data.slice(0,6)];parts[0][4]|=0xfc;parts[0][5]|=0xe0;
 groups.forEach((units,index)=>{if(index)parts.push(new Uint8Array([units.length]));for(const nal of units)parts.push(new Uint8Array([nal.length>>8,nal.length&255]),nal);});
 parts.push(data.subarray(at));const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}
export function installAvcMetadataRepair(scope=globalThis){
 const Native=scope.VideoEncoder;if(!Native)return ()=>0;let repairs=0;
 scope.VideoEncoder=class extends Native{
  constructor(init){super({...init,output:(packet,meta)=>{
   const config=meta?.decoderConfig;
   if(config?.description&&/^avc[13]\./.test(config.codec)){
    const description=repairAvcDescription(config.description);
    if(description!==config.description){repairs++;meta={...meta,decoderConfig:{...config,description}};}
   }
   init.output(packet,meta);
  }});}
 };
 return ()=>repairs;
}
