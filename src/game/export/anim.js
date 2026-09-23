/** Animated previews for sharing: GIF (adaptive palette, global or per frame, per-frame delays,
 * 1-bit transparency) and APNG (exact RGBA, per-frame delays in ms). Pure encoders: frames in,
 * bytes out; they run in the pack worker and in Node. (WebM needs the browser's VideoEncoder and
 * lives in webm.js.)
 *
 * GIF facts that decide the output, each a common way to get it wrong:
 *  * Delays are in 1/100 s. Browsers and Discord treat 0–1 cs as 10 cs, so the shortest delay
 *    written is 2 cs and anything rounded is reported.
 *  * Transparency is one palette entry; alpha ≥ 128 is opaque, below is transparent. Every frame is
 *    a full frame with disposal "restore to background", so transparent frames never stack
 *    (ezgif's "don't stack frames" trap).
 *  * ≤ 255 colours (almost all pixel art) → the palette is exact. More → median cut on the frames'
 *    colours (global) or each frame's own (local), nearest-colour mapping, no dithering. */
import {chunk,deflate,filterRows} from '../pack/png.js';
const concat=parts=>{const n=parts.reduce((a,p)=>a+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};

// ------------------------------------------------------------------ palette
function colorsOf(frames){
 const counts=new Map();
 for(const f of frames){const d=f.data;for(let i=0;i<d.length;i+=4)if(d[i+3]>=128){const k=d[i]<<16|d[i+1]<<8|d[i+2];counts.set(k,(counts.get(k)||0)+1);}}
 return counts;
}
/** Median cut over exact colours weighted by count. Deterministic (stable sorts, index ties). */
export function medianCut(counts,max){
 const list=[...counts].map(([k,n])=>[k>>16&255,k>>8&255,k&255,n]);
 if(list.length<=max)return list.map(c=>c.slice(0,3));
 let boxes=[list];
 const range=(b,c)=>{let lo=255,hi=0;for(const p of b){if(p[c]<lo)lo=p[c];if(p[c]>hi)hi=p[c];}return hi-lo;};
 while(boxes.length<max){
  let bi=-1,score=-1,ch=0;
  boxes.forEach((b,i)=>{if(b.length<2)return;const r=[0,1,2].map(c=>range(b,c)),m=Math.max(...r),w=b.reduce((n,p)=>n+p[3],0),s=m*Math.sqrt(w);if(s>score){score=s;bi=i;ch=r.indexOf(m);}});
  if(bi<0)break;
  const b=boxes[bi].map((p,i)=>[p,i]).sort((x,y)=>x[0][ch]-y[0][ch]||x[1]-y[1]).map(x=>x[0]),half=b.reduce((n,p)=>n+p[3],0)/2;
  let acc=0,cut=1;for(;cut<b.length;cut++){acc+=b[cut-1][3];if(acc>=half)break;}
  boxes.splice(bi,1,b.slice(0,cut),b.slice(cut));
 }
 return boxes.map(b=>{let r=0,g=0,bl=0,n=0;for(const p of b){r+=p[0]*p[3];g+=p[1]*p[3];bl+=p[2]*p[3];n+=p[3];}return [Math.round(r/n),Math.round(g/n),Math.round(bl/n)];});
}
function mapper(palette){
 const exact=new Map(palette.map((c,i)=>[c[0]<<16|c[1]<<8|c[2],i])),cache=new Map();
 return (r,g,b)=>{const k=r<<16|g<<8|b;let i=exact.get(k);if(i!==undefined)return i;i=cache.get(k);if(i!==undefined)return i;
  let best=0,bd=Infinity;palette.forEach((c,j)=>{const d=(c[0]-r)**2*2+(c[1]-g)**2*4+(c[2]-b)**2*3;if(d<bd){bd=d;best=j;}});cache.set(k,best);return best;};
}
// ------------------------------------------------------------------ LZW
function lzw(indices,minCode){
 const out=[];let cur=0,bits=0;
 const put=(code,size)=>{cur|=code<<bits;bits+=size;while(bits>=8){out.push(cur&255);cur>>>=8;bits-=8;}};
 const clear=1<<minCode,eoi=clear+1;let size=minCode+1,next=eoi+1,dict=new Map();
 put(clear,size);
 let prefix=indices[0];
 for(let i=1;i<indices.length;i++){
  const k=indices[i],key=prefix*4096+k,hit=dict.get(key);
  if(hit!==undefined){prefix=hit;continue;}
  put(prefix,size);
  if(next<4096){dict.set(key,next++);if(next>(1<<size)&&size<12)size++;}
  else{put(clear,size);dict=new Map();size=minCode+1;next=eoi+1;}
  prefix=k;
 }
 put(prefix,size);put(eoi,size);if(bits)out.push(cur&255);
 const blocks=[];for(let i=0;i<out.length;i+=255){const part=out.slice(i,i+255);blocks.push(part.length,...part);}
 blocks.push(0);return blocks;
}
/** @param frames [{width,height,data RGBA,delayMs}] (same size) @param palette 'global'|'local' */
export function encodeGIF(frames,{palette:mode='global',loop=0}={}){
 if(!frames.length)throw Error('No frames');
 const W=frames[0].width,H=frames[0].height;
 if(frames.some(f=>f.width!==W||f.height!==H))throw Error('GIF frames must share one size');
 if(W>65535||H>65535)throw Error('GIF is limited to 65535 px');
 const bytes=[],word=n=>bytes.push(n&255,n>>8&255),notes=[];
 const alphaSoft=frames.some(f=>{for(let i=3;i<f.data.length;i+=4)if(f.data[i]>0&&f.data[i]<255)return true;return false;});
 if(alphaSoft)notes.push('GIF has 1-bit transparency: semi-transparent pixels became opaque (alpha ≥ 128) or transparent.');
 const table=cols=>{let n=2,bitsz=1;while(n<cols.length+1){n*=2;bitsz++;}const t=new Uint8Array(n*3);cols.forEach((c,i)=>t.set(c,(i+1)*3));return {t,bits:bitsz};};// index 0 = transparent
 let global=null,exact=true;
 if(mode==='global'){const counts=colorsOf(frames);const pal=medianCut(counts,255);exact=counts.size<=255;global={pal,...table(pal),map:mapper(pal)};}
 bytes.push(...new TextEncoder().encode('GIF89a'));word(W);word(H);
 if(global){bytes.push(0x80|0x70|(global.bits-1),0,0);bytes.push(...global.t);}else bytes.push(0x70,0,0);
 bytes.push(0x21,0xff,11,...new TextEncoder().encode('NETSCAPE2.0'),3,1);word(loop);bytes.push(0);
 let rounded=0;
 for(const f of frames){
  let use=global;
  if(!use){const counts=colorsOf([f]);const pal=medianCut(counts,255);if(counts.size>255)exact=false;use={pal,...table(pal),map:mapper(pal)};}
  const cs=Math.max(2,Math.round(f.delayMs/10));if(Math.abs(cs*10-f.delayMs)>.5)rounded++;
  bytes.push(0x21,0xf9,4,(2<<2)|1);word(cs);bytes.push(0,0);// disposal 2, transparent index 0
  bytes.push(0x2c);word(0);word(0);word(W);word(H);
  bytes.push(global?0:0x80|(use.bits-1));if(!global)bytes.push(...use.t);
  const idx=new Uint16Array(W*H),d=f.data;
  for(let i=0,p=0;i<idx.length;i++,p+=4)idx[i]=d[p+3]<128?0:use.map(d[p],d[p+1],d[p+2])+1;
  const minCode=Math.max(2,use.bits);bytes.push(minCode);
  const blocks=lzw(idx,minCode);for(let i=0;i<blocks.length;i++)bytes.push(blocks[i]);
 }
 bytes.push(0x3b);
 if(!exact)notes.push('More than 255 colours: the GIF palette is reduced (median cut, no dithering). APNG keeps every colour.');
 if(rounded)notes.push(`${rounded} frame delay(s) rounded to GIF's 1/100 s (minimum 20 ms).`);
 return {bytes:new Uint8Array(bytes),notes,exact};
}
/** APNG: exact RGBA frames, each shown for its own ms (delay_num/delay_den = ms/1000). */
export async function encodeAPNG(frames,{loop=0}={}){
 if(!frames.length)throw Error('No frames');
 const W=frames[0].width,H=frames[0].height;
 if(frames.some(f=>f.width!==W||f.height!==H))throw Error('APNG frames must share one size');
 const u32=(v,a,o)=>new DataView(a.buffer).setUint32(o,v),u16=(v,a,o)=>new DataView(a.buffer).setUint16(o,v);
 const ihdr=new Uint8Array(13);u32(W,ihdr,0);u32(H,ihdr,4);ihdr.set([8,6,0,0,0],8);
 const actl=new Uint8Array(8);u32(frames.length,actl,0);u32(loop,actl,4);
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('acTL',actl)];
 let seq=0;
 for(let i=0;i<frames.length;i++){
  const f=frames[i],fc=new Uint8Array(26);
  u32(seq++,fc,0);u32(W,fc,4);u32(H,fc,8);u32(0,fc,12);u32(0,fc,16);
  let num=Math.round(f.delayMs),den=1000;while(num>65535){num=Math.round(num/10);den/=10;}
  u16(num,fc,20);u16(den,fc,22);fc[24]=1;fc[25]=0;// dispose to background, blend source
  parts.push(chunk('fcTL',fc));
  const z=await deflate(filterRows(f.data,W,H,4));
  if(i===0)parts.push(chunk('IDAT',z));
  else{const fd=new Uint8Array(z.length+4);u32(seq++,fd,0);fd.set(z,4);parts.push(chunk('fdAT',fd));}
 }
 parts.push(chunk('IEND',new Uint8Array(0)));
 return {bytes:concat(parts),notes:[]};
}
