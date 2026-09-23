/** Minimal ZIP reader: stored and deflated entries, ZIP64 sizes/offsets, CRC-checked.
 * The writer is src/core.js `zip()` (stored); this reads that and ordinary archives from other
 * tools. Works on a Blob, reading only the directory and the entries asked for. */
import {blobCRC} from '../../core.js';
const u16=(v,o)=>v.getUint16(o,true),u32=(v,o)=>v.getUint32(o,true),u64=(v,o)=>Number(v.getBigUint64(o,true));
const bytesOf=async(blob,start,end)=>new DataView(await blob.slice(start,end).arrayBuffer());
export async function readZip(blob){
 const size=blob.size,tailLen=Math.min(size,65535+22+20);
 const tail=await bytesOf(blob,size-tailLen,size);
 let eocd=-1;for(let i=tailLen-22;i>=0;i--)if(u32(tail,i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('Not a ZIP archive');
 let count=u16(tail,eocd+10),cdSize=u32(tail,eocd+12),cdOffset=u32(tail,eocd+16);
 if(count===0xffff||cdSize===0xffffffff||cdOffset===0xffffffff){
  const loc=eocd-20;if(loc<0||u32(tail,loc)!==0x07064b50)throw Error('Broken ZIP64 archive');
  const at=u64(tail,loc+8),z=await bytesOf(blob,at,at+56);
  if(u32(z,0)!==0x06064b50)throw Error('Broken ZIP64 archive');
  count=u64(z,32);cdSize=u64(z,40);cdOffset=u64(z,48);
 }
 if(cdOffset+cdSize>size)throw Error('Truncated ZIP archive');
 const cd=await bytesOf(blob,cdOffset,cdOffset+cdSize),dec=new TextDecoder(),entries=[];
 for(let p=0,n=0;n<count;n++){
  if(u32(cd,p)!==0x02014b50)throw Error('Broken ZIP directory');
  const method=u16(cd,p+10),crc=u32(cd,p+16),nameLen=u16(cd,p+28),extraLen=u16(cd,p+30),commentLen=u16(cd,p+32);
  let csize=u32(cd,p+20),usize=u32(cd,p+24),offset=u32(cd,p+42);
  const name=dec.decode(new Uint8Array(cd.buffer,cd.byteOffset+p+46,nameLen));
  for(let x=p+46+nameLen,end=x+extraLen;x+4<=end;){
   const id=u16(cd,x),len=u16(cd,x+2);let y=x+4;
   if(id===1){if(usize===0xffffffff){usize=u64(cd,y);y+=8;}if(csize===0xffffffff){csize=u64(cd,y);y+=8;}if(offset===0xffffffff){offset=u64(cd,y);}}
   x+=4+len;
  }
  entries.push({name,method,crc,csize,usize,offset,dir:name.endsWith('/')});
  p+=46+nameLen+extraLen+commentLen;
 }
 const byName=new Map(entries.map(e=>[e.name,e]));
 async function blobOf(e,type=''){
  const h=await bytesOf(blob,e.offset,e.offset+30);
  if(u32(h,0)!==0x04034b50)throw Error(`Broken ZIP entry ${e.name}`);
  const start=e.offset+30+u16(h,26)+u16(h,28),raw=blob.slice(start,start+e.csize);
  let out;
  if(e.method===0)out=raw.slice(0,raw.size,type);
  else if(e.method===8)out=new Blob([await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()],{type});
  else throw Error(`Unsupported compression in ${e.name}`);
  if(out.size!==e.usize||await blobCRC(out)!==e.crc)throw Error(`Corrupt entry ${e.name} (CRC mismatch)`);
  return out;
 }
 return {entries,has:n=>byName.has(n),entry:n=>byName.get(n)||null,
  async blob(n,type){const e=byName.get(n);if(!e)throw Error(`Missing ${n}`);return blobOf(e,type);},
  async text(n){return (await this.blob(n)).text();}};
}
