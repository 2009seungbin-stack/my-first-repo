/** File output of the pipeline: PNG (RGBA or indexed), APNG, GIF, ZIP — all from Nerulio's own pure
 * encoders (deflate in JS, src/game/zlib.js), so the same pixels give the same bytes in every browser
 * and in Node (class A). WebP needs the browser's encoder and is injected (class C).
 * `fitBytes` meets a byte limit honestly: exact colours first, then fewer colours (Wu in Oklab, no
 * dithering), and it says how many colours it took — or that the limit could not be met. */
import {deflateZlib} from '../game/zlib.js';
import {chunk,filterRows} from '../game/pack/png.js';
import {encodeIndexedPNG} from '../studio/pixel/png8.js';
import {encodeGIF} from '../game/export/anim.js';
import {crc32,zipLayout} from '../core.js';
import {paletteFromFrames,quantizeFrames} from '../studio/pixel/converter.js';

const SIG=new Uint8Array([137,80,78,71,13,10,26,10]);
const cat=parts=>{const n=parts.reduce((a,p)=>a+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
const u32=(v,a,o)=>new DataView(a.buffer,a.byteOffset).setUint32(o,v),u16=(v,a,o)=>new DataView(a.buffer,a.byteOffset).setUint16(o,v);
const asBytes=d=>d instanceof Uint8Array?d:new Uint8Array(d.buffer,d.byteOffset,d.byteLength);
/** A short tEXt chunk saying how the file was made (kept tiny; never personal data). */
const text=(k,v)=>chunk('tEXt',new TextEncoder().encode(`${k}\0${v}`));

/** RGBA PNG, colour type 6, best-of-5 row filters, JS deflate. */
export function pngRGBA(data,w,h,{software='Nerulio'}={}){
 const ihdr=new Uint8Array(13);u32(w,ihdr,0);u32(h,ihdr,4);ihdr.set([8,6,0,0,0],8);
 return cat([SIG,chunk('IHDR',ihdr),text('Software',software),chunk('IDAT',deflateZlib(filterRows(asBytes(data),w,h,4))),chunk('IEND',new Uint8Array(0))]);
}
/** Exact colours of the frames (alpha-0 pixels ignored), or null when there are more than `max`.
 * Returns [[r,g,b,a]] with index 0 = transparent. */
function exactPalette(frames,max=255){
 const map=new Map([[-1,0]]),cols=[[0,0,0,0]];
 for(const f of frames){const d=f.data;for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const k=((d[i]<<16|d[i+1]<<8|d[i+2])>>>0)*256+d[i+3];if(!map.has(k)){if(cols.length>max)return null;map.set(k,cols.length);cols.push([d[i],d[i+1],d[i+2],d[i+3]]);}}}
 return {map,cols};
}
function indicesOf(f,pal){const d=f.data,out=new Uint8Array(d.length/4);for(let i=0,p=0;i<d.length;i+=4,p++)out[p]=d[i+3]?pal.map.get(((d[i]<<16|d[i+1]<<8|d[i+2])>>>0)*256+d[i+3]):0;return out;}
/** Fewer colours: one Wu palette for all frames; alpha kept per pixel (quantised to 16 levels so the
 * RGBA palette stays ≤ 256 entries). Returns new frames. */
function reduce(frames,w,h,colors){
 const pal=paletteFromFrames(frames.map(f=>({data:f.data,width:w,height:h})),colors,{algorithm:'wu'});
 const q=quantizeFrames(frames.map(f=>({data:f.data,width:w,height:h})),pal,{dither:'none'});
 return q.map((f,i)=>{const d=new Uint8ClampedArray(f.data);for(let j=3;j<d.length;j+=4)d[j]=d[j]<8?0:d[j]>247?255:Math.round(d[j]/17)*17;return {data:d,ms:frames[i].ms};});
}
/** Still PNG: RGBA, or indexed when the colours fit (smaller, same pixels). */
export function pngStill(data,w,h){
 const pal=exactPalette([{data}],255);
 if(pal&&pal.cols.length<=256){const idx=indicesOf({data},pal);const a=encodeIndexedPNG(idx,w,h,pal.cols,{transparentIndex:0,level:9}),b=pngRGBA(data,w,h);return a.length<b.length?a:b;}
 return pngRGBA(data,w,h);
}
/** APNG, every frame full size, dispose to background, blend source; indexed when ≤ 256 colours. */
export function apng(frames,w,h,{loop=0}={}){
 const pal=exactPalette(frames,255),indexed=!!pal;
 const ihdr=new Uint8Array(13);u32(w,ihdr,0);u32(h,ihdr,4);ihdr.set([8,indexed?3:6,0,0,0],8);
 const actl=new Uint8Array(8);u32(frames.length,actl,0);u32(loop,actl,4);
 const parts=[SIG,chunk('IHDR',ihdr),chunk('acTL',actl)];
 if(indexed){const plte=new Uint8Array(pal.cols.length*3),trns=new Uint8Array(pal.cols.length);pal.cols.forEach((c,i)=>{plte.set(c.slice(0,3),i*3);trns[i]=c[3];});parts.push(chunk('PLTE',plte),chunk('tRNS',trns));}
 parts.push(text('Software','Nerulio'));
 let seq=0;
 frames.forEach((f,i)=>{
  const fc=new Uint8Array(26);u32(seq++,fc,0);u32(w,fc,4);u32(h,fc,8);u32(0,fc,12);u32(0,fc,16);
  let num=Math.max(1,Math.round(f.ms)),den=1000;while(num>65535){num=Math.round(num/10);den/=10;}u16(num,fc,20);u16(den,fc,22);fc[24]=1;fc[25]=0;
  parts.push(chunk('fcTL',fc));
  const raw=indexed?(()=>{const idx=indicesOf(f,pal),r=new Uint8Array((w+1)*h);for(let y=0;y<h;y++)r.set(idx.subarray(y*w,(y+1)*w),y*(w+1)+1);return r;})():filterRows(asBytes(f.data),w,h,4);
  const z=deflateZlib(raw,{level:9});
  if(i===0)parts.push(chunk('IDAT',z));else{const fd=new Uint8Array(z.length+4);u32(seq++,fd,0);fd.set(z,4);parts.push(chunk('fdAT',fd));}
 });
 parts.push(chunk('IEND',new Uint8Array(0)));
 return cat(parts);
}
export function gif(frames,w,h,{loop=0}={}){return encodeGIF(frames.map(f=>({width:w,height:h,data:f.data,delayMs:f.ms})),{palette:'global',loop}).bytes;}

/**
 * Encode one item, meeting maxBytes when it can.
 * @param {{w:number,h:number,frames:{data:Uint8ClampedArray,ms:number}[]}} it
 * @param {{format:'png'|'gif'|'apng'|'webp',maxBytes:number,loop:number,webp?:(data:Uint8ClampedArray,w:number,h:number,q:number)=>Promise<Uint8Array>}} o
 * @returns {Promise<{bytes:Uint8Array,format:string,colors:number|null,quality?:number,over:boolean}>}
 */
export async function fitBytes(it,o){
 const {w,h}=it,animated=it.frames.length>1;
 let format=o.format;
 if(format==='webp'&&(animated||!o.webp))format=animated?'apng':'png';
 if(format==='png'&&animated)format='apng';
 if(format==='webp'){
  const qs=[.92,.85,.75,.6,.45,.3];let bytes=null;
  for(const q of qs){bytes=await /** @type {any} */(o.webp)(it.frames[0].data,w,h,q);if(!o.maxBytes||bytes.length<=o.maxBytes)return {bytes,format,colors:null,quality:q,over:false};}
  return {bytes:/** @type {Uint8Array} */(bytes),format,colors:null,quality:qs[qs.length-1],over:true};
 }
 const enc=frames=>format==='gif'?gif(frames,w,h,{loop:o.loop}):format==='apng'?apng(frames,w,h,{loop:o.loop}):pngStill(frames[0].data,w,h);
 let bytes=enc(it.frames);
 if(!o.maxBytes||bytes.length<=o.maxBytes)return {bytes,format,colors:null,over:false};
 for(const colors of [256,128,64,32,16]){
  const fr=reduce(it.frames,w,h,colors);bytes=enc(fr);
  if(bytes.length<=o.maxBytes)return {bytes,format,colors,over:false};
 }
 return {bytes,format,colors:16,over:true};
}

/** Stored ZIP (images are compressed already), UTF-8 names, from Uint8Arrays. */
export function zipFiles(files){
 const enc=new TextEncoder(),records=files.map(f=>({name:enc.encode(f.name),size:f.bytes.length,crc:crc32(f.bytes)}));
 const {local,central,tail}=zipLayout(records);
 return cat([...local.flatMap((h,i)=>[h,files[i].bytes]),...central,...tail]);
}

// ---------------------------------------------------------------- reading back (checks and tests)
/** Width, height and frame count of a PNG/APNG/GIF/WebP file's header. */
export function probe(bytes){
 const b=bytes,v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b[0]===137&&b[1]===80){let frames=1,p=8,w=0,h=0,type=0;while(p+8<=b.length){const len=v.getUint32(p),t=String.fromCharCode(b[p+4],b[p+5],b[p+6],b[p+7]);if(t==='IHDR'){w=v.getUint32(p+8);h=v.getUint32(p+12);type=b[p+17];}if(t==='acTL')frames=v.getUint32(p+8);p+=12+len;}return {type:frames>1?'apng':'png',w,h,frames,colorType:type};}
 if(b[0]===71&&b[1]===73){let frames=0;for(let i=0;i<b.length-1;i++)if(b[i]===0x21&&b[i+1]===0xf9)frames++;return {type:'gif',w:v.getUint16(6,true),h:v.getUint16(8,true),frames:Math.max(1,frames)};}
 if(b[0]===82&&b[8]===87){const kind=String.fromCharCode(b[12],b[13],b[14],b[15]);let w=0,h=0;
  if(kind==='VP8X'){w=1+(b[24]|b[25]<<8|b[26]<<16);h=1+(b[27]|b[28]<<8|b[29]<<16);}
  else if(kind==='VP8L'){const x=v.getUint32(21,true);w=1+(x&0x3fff);h=1+((x>>14)&0x3fff);}
  else if(kind==='VP8 '){w=v.getUint16(26,true)&0x3fff;h=v.getUint16(28,true)&0x3fff;}
  return {type:'webp',w,h,frames:1};}
 return {type:'unknown',w:0,h:0,frames:0};
}
