/** Exact PNG writer for atlas pages and animation frames. No canvas (a canvas stores premultiplied
 * pixels and would round semi-transparent colours), no gAMA/iCCP/sRGB chunk (a reader must not
 * colour-manage a game texture). Pages with 256 colours or fewer are written as indexed PNG
 * (PLTE+tRNS), which is lossless and usually much smaller for pixel art.
 * Runs in the page, the pack worker and Node (CompressionStream). */
import {crc32} from '../../core.js';
const SIGNATURE=new Uint8Array([137,80,78,71,13,10,26,10]);
export function chunk(type,data){
 const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);
 view.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);
 view.setUint32(out.length-4,crc32(out.subarray(4,out.length-4)));return out;
}
export async function deflate(bytes){
 const stream=new CompressionStream('deflate'),writer=stream.writable.getWriter();
 const done=new Response(stream.readable).arrayBuffer();
 writer.write(bytes);writer.close();return new Uint8Array(await done);
}
const concat=parts=>{const n=parts.reduce((a,p)=>a+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
/** Filtered scanlines: per row, the filter (None/Sub/Up/Average/Paeth) with the smallest sum of
 * absolute values, the usual libpng heuristic. Deterministic. */
export function filterRows(data,w,h,bpp){
 const stride=w*bpp,out=new Uint8Array((stride+1)*h),cand=Array.from({length:5},()=>new Uint8Array(stride));
 for(let y=0;y<h;y++){
  const row=data.subarray(y*stride,(y+1)*stride),up=y?data.subarray((y-1)*stride,y*stride):null;
  let best=0,bestSum=Infinity;
  for(let f=0;f<5;f++){
   const c=cand[f];let sum=0;
   for(let i=0;i<stride;i++){
    const a=i>=bpp?row[i-bpp]:0,b=up?up[i]:0,cc=up&&i>=bpp?up[i-bpp]:0;
    const v=f===0?row[i]:f===1?row[i]-a:f===2?row[i]-b:f===3?row[i]-((a+b)>>1):row[i]-paeth(a,b,cc);
    c[i]=v&255;sum+=c[i]<128?c[i]:256-c[i];
   }
   if(sum<bestSum){bestSum=sum;best=f;}
  }
  out[y*(stride+1)]=best;out.set(cand[best],y*(stride+1)+1);
 }
 return out;
}
/** Colours of an RGBA image in first-seen order, or null when there are more than `max`. Alpha-0
 * pixels all become one transparent entry (RGB under alpha 0 is not kept in indexed output; use
 * `indexed:'never'` when those bytes matter). */
export function paletteOf(data,max=256){
 const map=new Map(),colors=[];
 for(let i=0;i<data.length;i+=4){
  const a=data[i+3],key=a?((data[i]<<24|data[i+1]<<16|data[i+2]<<8|a)>>>0):0;
  if(!map.has(key)){if(colors.length>=max)return null;map.set(key,colors.length);colors.push(a?[data[i],data[i+1],data[i+2],a]:[0,0,0,0]);}
 }
 return {map,colors};
}
/** @param img {width,height,data RGBA}  @param indexed 'auto' | 'never' */
export async function encodePNG(img,{indexed='auto'}={}){
 const {width:w,height:h,data}=img;
 if(data.length!==w*h*4)throw Error('Image data does not match its size');
 const ihdr=new Uint8Array(13),v=new DataView(ihdr.buffer);v.setUint32(0,w);v.setUint32(4,h);
 const pal=indexed==='auto'?paletteOf(data):null;
 if(pal){
  const n=pal.colors.length,bits=n<=2?1:n<=4?2:n<=16?4:8;
  ihdr.set([bits,3,0,0,0],8);
  const stride=Math.ceil(w*bits/8),raw=new Uint8Array((stride+1)*h);
  for(let y=0;y<h;y++){
   const base=y*(stride+1)+1;
   for(let x=0;x<w;x++){
    const i=(y*w+x)*4,a=data[i+3],idx=pal.map.get(a?((data[i]<<24|data[i+1]<<16|data[i+2]<<8|a)>>>0):0);
    const bit=x*bits;raw[base+(bit>>3)]|=idx<<(8-bits-(bit&7));
   }
  }
  const plte=new Uint8Array(n*3),trns=new Uint8Array(n);
  pal.colors.forEach(([r,g,b,a],k)=>{plte.set([r,g,b],k*3);trns[k]=a;});
  let last=n;while(last>0&&trns[last-1]===255)last--;
  const parts=[SIGNATURE,chunk('IHDR',ihdr),chunk('PLTE',plte)];
  if(last)parts.push(chunk('tRNS',trns.subarray(0,last)));
  parts.push(chunk('IDAT',await deflate(raw)),chunk('IEND',new Uint8Array(0)));
  return concat(parts);
 }
 ihdr.set([8,6,0,0,0],8);
 return concat([SIGNATURE,chunk('IHDR',ihdr),chunk('IDAT',await deflate(filterRows(data,w,h,4))),chunk('IEND',new Uint8Array(0))]);
}
