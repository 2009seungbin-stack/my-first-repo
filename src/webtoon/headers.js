/** Small-file-header sniff before allocating full decoded image memory. */
const four=(b,at)=>String.fromCharCode(...new Uint8Array(b.buffer,b.byteOffset+at,4));
export function sniffImageHeader(bytes){
 const u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),b=new DataView(u.buffer,u.byteOffset,u.byteLength);
 if(b.byteLength>=33&&b.getUint32(0)===0x89504e47&&b.getUint32(4)===0x0d0a1a0a&&four(u,12)==='IHDR'){
  for(let at=8;at+12<=b.byteLength;){const len=b.getUint32(at),kind=four(u,at+4);if(kind==='acTL')throw new Error('Animated PNG is not supported; select a still frame');if(kind==='IDAT')break;if(at+len+12>b.byteLength)throw new Error('Could not verify that PNG is still before decoding; re-save as a still PNG');at+=len+12;}
  return {width:b.getUint32(16),height:b.getUint32(20),type:'png'};
 }
 if(b.byteLength>=4&&b.getUint16(0)===0xffd8){let at=2;while(at+9<b.byteLength){if(b.getUint8(at)!==0xff){at++;continue;}const mark=b.getUint8(at+1);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(mark))return {width:b.getUint16(at+7),height:b.getUint16(at+5),type:'jpeg'};const len=b.getUint16(at+2);if(len<2)break;at+=2+len;}}
 if(b.byteLength>=30&&four(u,0)==='RIFF'&&four(u,8)==='WEBP'){
  const chunk=four(u,12);
  if(chunk==='VP8X'){
   if(b.getUint8(20)&0x02)throw new Error('Animated WebP is not supported; select a still frame');
   return {width:1+b.getUint8(24)+(b.getUint8(25)<<8)+(b.getUint8(26)<<16),height:1+b.getUint8(27)+(b.getUint8(28)<<8)+(b.getUint8(29)<<16),type:'webp'};
  }
  if(chunk==='VP8 ')return {width:b.getUint16(26,true)&0x3fff,height:b.getUint16(28,true)&0x3fff,type:'webp'};
  if(chunk==='VP8L'&&b.getUint8(20)===0x2f)return {width:1+b.getUint8(21)+((b.getUint8(22)&0x3f)<<8),height:1+(b.getUint8(22)>>6)+(b.getUint8(23)<<2)+((b.getUint8(24)&0x0f)<<10),type:'webp'};
 }
 throw new Error('Could not read still PNG, JPEG or WebP dimensions before decoding. Re-save the image as PNG.');
}
