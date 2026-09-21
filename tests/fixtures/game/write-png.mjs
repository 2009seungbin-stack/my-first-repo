/** Minimal RGBA PNG writer, so the Godot validation harness needs nothing but Node. Real zlib
 * (node:zlib deflate), real CRCs — the output is a normal PNG that any decoder reads. */
import {deflateSync} from 'node:zlib';
const TABLE=(()=>{const t=new Uint32Array(256);
 for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}
 return t;})();
const crc32=buffer=>{let c=0xffffffff;for(const b of buffer)c=TABLE[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(type,body){
 const out=Buffer.alloc(body.length+12);
 out.writeUInt32BE(body.length,0);
 out.write(type,4,'ascii');
 body.copy(out,8);
 out.writeUInt32BE(crc32(out.subarray(4,8+body.length)),8+body.length);
 return out;
}
export function encodePng({data,width,height}){
 const raw=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++){
  raw[y*(width*4+1)]=0;// filter type 0: none
  Buffer.from(data.buffer,data.byteOffset+y*width*4,width*4).copy(raw,y*(width*4+1)+1);
 }
 const header=Buffer.alloc(13);
 header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);
 header[8]=8;header[9]=6;header[10]=0;header[11]=0;header[12]=0;// 8-bit RGBA, deflate, no interlace
 return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
