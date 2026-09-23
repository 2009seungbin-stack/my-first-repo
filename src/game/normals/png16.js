/** 16-bit greyscale PNG in and out — for height maps, where 8 bits give 256 terraces that a
 * normal map shows as stripes. src/game/texture-png.js keeps only the high byte of 16-bit files
 * (the rest of its pipeline is 8-bit); this module keeps all 16. No DOM (CompressionStream only). */
import {crc32} from '../core.js';
import {pngChunks} from '../texture-png.js';
const SIGNATURE=[137,80,78,71,13,10,26,10];
const chunk=(type,data)=>{
 const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);
 view.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);
 view.setUint32(out.length-4,crc32(out.subarray(4,out.length-4)));return out;
};
async function pipe(stream,parts){
 const writer=stream.writable.getWriter(),reader=stream.readable.getReader(),out=[];let total=0;
 const read=(async()=>{for(;;){const {value,done}=await reader.read();if(done)break;out.push(value);total+=value.length;}})();
 for(const p of parts)await writer.write(p);await writer.close();await read;
 const all=new Uint8Array(total);let at=0;for(const b of out){all.set(b,at);at+=b.length;}return all;
}
/** Uint16 samples (w·h) → PNG bytes (colour type 0, bit depth 16, filter 0 per row). */
export async function encodeGray16PNG(samples,w,h){
 if(samples.length!==w*h)throw Error('Samples do not match the image');
 const header=new Uint8Array(13),view=new DataView(header.buffer);
 view.setUint32(0,w);view.setUint32(4,h);header.set([16,0,0,0,0],8);
 const raw=new Uint8Array(h*(1+w*2));
 for(let y=0;y<h;y++){const row=y*(1+w*2);raw[row]=0;for(let x=0;x<w;x++){const v=samples[y*w+x];raw[row+1+x*2]=v>>8;raw[row+2+x*2]=v&255;}}
 const idat=await pipe(new CompressionStream('deflate'),[raw]);
 const parts=[new Uint8Array(SIGNATURE),chunk('IHDR',header),chunk('IDAT',idat),chunk('IEND',new Uint8Array())];
 const len=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(len);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}
 return out;
}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
/** A greyscale PNG (8 or 16 bit, colour types 0/4; RGB is reduced to its first channel) → exact
 * samples: {width, height, depth, samples (Uint16Array for 16-bit, Uint8Array otherwise)}.
 * Returns null when the file is not a plain greyscale or RGB PNG (the caller then uses the 8-bit path). */
export async function decodeGrayPNG(bytes){
 const chunks=pngChunks(bytes),ih=chunks[0].data,dv=new DataView(ih.buffer,ih.byteOffset,ih.byteLength);
 const w=dv.getUint32(0),h=dv.getUint32(4),depth=ih[8],ct=ih[9],interlace=ih[12];
 if(interlace||![8,16].includes(depth)||![0,2,4,6].includes(ct))return null;
 const ch={0:1,2:3,4:2,6:4}[ct],bpp=ch*depth/8,stride=w*bpp;
 const raw=await pipe(new DecompressionStream('deflate'),chunks.filter(c=>c.type==='IDAT').map(c=>c.data));
 const img=new Uint8Array(h*stride);
 for(let y=0,at=0;y<h;y++){
  const f=raw[at++],row=y*stride;img.set(raw.subarray(at,at+stride),row);at+=stride;
  for(let i=0;i<stride;i++){const L=i>=bpp?img[row+i-bpp]:0,U=y?img[row-stride+i]:0,UL=y&&i>=bpp?img[row-stride+i-bpp]:0;
   img[row+i]=(img[row+i]+(f===1?L:f===2?U:f===3?(L+U)>>1:f===4?paeth(L,U,UL):0))&255;}
 }
 const samples=depth===16?new Uint16Array(w*h):new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const i=p*bpp;samples[p]=depth===16?img[i]<<8|img[i+1]:img[i];}
 return {width:w,height:h,depth,samples};
}
