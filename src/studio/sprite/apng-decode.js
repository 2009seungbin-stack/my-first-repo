/** Animated PNG → every frame as a full-canvas RGBA picture, with delays, dispose and blend ops
 * applied as the APNG spec (and browsers) show it. No DOM: each frame's fdAT/IDAT data is wrapped
 * into a standalone PNG and decoded by src/game/texture-png.js (exact bytes, no canvas).
 *
 * dispose: 0 none, 1 clear the frame region to transparent, 2 restore the previous picture
 * (2 on the first frame is treated as 1, per spec). blend: 0 replace the region, 1 "over".
 * A delay denominator of 0 means 1/100 s. A delay of 0 is kept as 0 in `rawDelay`; `delay` plays
 * it as 100 ms like Chromium. The default image is a frame only when an fcTL precedes IDAT. */
import {pngChunks,decodePNG,isPNG} from '../../game/texture-png.js';
import {crc32} from '../../core.js';
export class ApngError extends Error{constructor(m){super(m);this.name='ApngError';}}
const SIG=new Uint8Array([137,80,78,71,13,10,26,10]);
const be32=(d,o)=>(d[o]<<24|d[o+1]<<16|d[o+2]<<8|d[o+3])>>>0,be16=(d,o)=>d[o]<<8|d[o+1];
function chunk(type,data){
 const out=new Uint8Array(12+data.length),v=new DataView(out.buffer);
 v.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);
 v.setUint32(8+data.length,crc32(out.subarray(4,8+data.length)));return out;
}
const concat=parts=>{const n=parts.reduce((s,p)=>s+p.length,0),o=new Uint8Array(n);let at=0;for(const p of parts){o.set(p,at);at+=p.length;}return o;};
/** True for a PNG with an acTL chunk before its image data. */
export function isAPNG(bytes){try{if(!isPNG(bytes))return false;for(const c of pngChunks(bytes)){if(c.type==='acTL')return true;if(c.type==='IDAT')return false;}}catch{}return false;}
export async function decodeAPNG(input,{maxFrames=4096,maxPixels=268e6}={}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input),chunks=pngChunks(bytes);
 const ihdr=chunks[0].data,W=be32(ihdr,0),H=be32(ihdr,4);
 const actl=chunks.find(c=>c.type==='acTL');if(!actl)throw new ApngError('Not an animated PNG (no acTL chunk)');
 const plays=be32(actl.data,4),shared=chunks.filter(c=>['PLTE','tRNS','sRGB','gAMA','cHRM','iCCP','sBIT'].includes(c.type));
 // group: fcTL → following IDAT/fdAT data
 const specs=[];let cur=null,seenIDAT=false;
 for(const c of chunks){
  if(c.type==='fcTL'){const d=c.data;cur={w:be32(d,4),h:be32(d,8),x:be32(d,12),y:be32(d,16),num:be16(d,20),den:be16(d,22),dispose:d[24],blend:d[25],data:[]};specs.push(cur);}
  else if(c.type==='IDAT'){seenIDAT=true;if(cur&&!cur.fromIDAT&&!cur.data.length){cur.fromIDAT=true;}if(cur?.fromIDAT)cur.data.push(c.data);}
  else if(c.type==='fdAT'){if(cur&&!cur.fromIDAT)cur.data.push(c.data.subarray(4));else if(cur)cur.data.push(c.data.subarray(4));}
 }
 if(!seenIDAT)throw new ApngError('APNG has no image data');
 const frames=[],warnings=[],canvas=new Uint8Array(W*H*4);let pixels=0;
 for(let i=0;i<specs.length;i++){
  const s=specs[i];if(!s.data.length){warnings.push(`Frame ${i} has no data`);continue;}
  if(frames.length>=maxFrames)throw new ApngError(`More than ${maxFrames} frames`);
  pixels+=W*H;if(pixels>maxPixels)throw new ApngError('APNG is too large to decode');
  if(s.x+s.w>W||s.y+s.h>H||!s.w||!s.h)throw new ApngError(`Frame ${i} lies outside the canvas`);
  const head=new Uint8Array(ihdr);new DataView(head.buffer).setUint32(0,s.w);new DataView(head.buffer).setUint32(4,s.h);
  const png=concat([SIG,chunk('IHDR',head),...shared.map(c=>chunk(c.type,c.data)),...s.data.map(d=>chunk('IDAT',d)),chunk('IEND',new Uint8Array(0))]);
  const img=await decodePNG(png,{maxPixels});
  const dispose=i===0&&s.dispose===2?1:s.dispose,saved=dispose===2?canvas.slice():null;
  for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){
   const si=(y*s.w+x)*4,di=((s.y+y)*W+s.x+x)*4,a=img.data[si+3];
   if(s.blend===0||a===255||canvas[di+3]===0){canvas[di]=img.data[si];canvas[di+1]=img.data[si+1];canvas[di+2]=img.data[si+2];canvas[di+3]=a;if(s.blend===1&&a===0)canvas.fill(0,di,di+4);continue;}
   if(a===0)continue;
   const da=canvas[di+3],u=a,v=(255-a)*da/255,al=u+v;
   for(let c=0;c<3;c++)canvas[di+c]=Math.round((img.data[si+c]*u+canvas[di+c]*v)/al);
   canvas[di+3]=Math.round(al);
  }
  const rawDelay=Math.round(s.num*1000/(s.den||100));
  frames.push({rgba:canvas.slice(),delay:rawDelay<=10?100:rawDelay,rawDelay,disposal:dispose,blend:s.blend,rect:{x:s.x,y:s.y,w:s.w,h:s.h}});
  if(dispose===1)for(let y=s.y;y<s.y+s.h;y++)canvas.fill(0,(y*W+s.x)*4,(y*W+s.x+s.w)*4);
  else if(dispose===2&&saved)canvas.set(saved);
 }
 if(!frames.length)throw new ApngError('APNG has no frames');
 return {width:W,height:H,plays,frames,warnings};
}
