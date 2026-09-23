/** Animated GIF → every frame as a full-canvas RGBA picture, with delays and disposal applied the
 * way browsers show it. Pure (bytes in, data out): runs in a page, a worker and node:test.
 *
 * - Frames are composited on a transparent logical screen (browsers ignore the background colour).
 * - Disposal: 0/1 keep, 2 clear the frame's rectangle to transparent, 3 restore what was there.
 * - Delays are in centiseconds; like every major browser, a delay of 0 or 1 cs is played as 100 ms.
 *   The raw value is kept (`rawDelay`) so the importer can offer "use the file's delays" instead.
 * - Truncated image data decodes as far as it goes (the rest of that frame stays transparent) and
 *   is reported in `warnings`, like a browser shows a partial frame. */
export class GifError extends Error{constructor(m){super(m);this.name='GifError';}}
export const GIF_LIMITS=Object.freeze({frames:4096,pixels:268e6});
const INTERLACE=[[0,8],[4,8],[2,4],[1,2]];
export const isGIF=b=>b.length>=6&&b[0]===0x47&&b[1]===0x49&&b[2]===0x46&&b[3]===0x38&&(b[4]===0x37||b[4]===0x39)&&b[5]===0x61;
/** @returns {width, height, loop (NETSCAPE count: 0 = forever, n = n more times, null = no loop block: play once), frames:[{rgba, delay, rawDelay, disposal, rect, transparent}], warnings} */
export function decodeGIF(input,{limits={}}={}){
 const L={...GIF_LIMITS,...limits},b=input instanceof Uint8Array?input:new Uint8Array(input);
 if(!isGIF(b))throw new GifError('Not a GIF file');
 let p=6;const u16=()=>{if(p+2>b.length)throw new GifError('Truncated GIF');const v=b[p]|b[p+1]<<8;p+=2;return v;};
 const W=u16(),H=u16(),flags=b[p++];p+=2;// background index, aspect
 if(!W||!H)throw new GifError('GIF has no size');
 let gct=null;if(flags&0x80){const n=3*(1<<((flags&7)+1));if(p+n>b.length)throw new GifError('Truncated GIF palette');gct=b.subarray(p,p+n);p+=n;}
 const frames=[],warnings=[];let gce=null,loop=null,pixels=0;
 const canvas=new Uint8Array(W*H*4);
 const subBlocks=()=>{const parts=[];let total=0;while(p<b.length){const n=b[p++];if(!n)return {parts,total,ok:true};if(p+n>b.length){parts.push(b.subarray(p));total+=b.length-p;p=b.length;return {parts,total,ok:false};}parts.push(b.subarray(p,p+n));total+=n;p+=n;}return {parts,total,ok:false};};
 while(p<b.length){
  const k=b[p++];
  if(k===0x3B)break;
  if(k===0x21){
   const label=b[p++];
   if(label===0xF9){const s=subBlocks();const d=s.parts[0]||new Uint8Array(4);gce={disposal:(d[0]>>2)&7,transparent:d[0]&1?d[3]:-1,delay:d[1]|d[2]<<8};}
   else if(label===0xFF){const s=subBlocks();const id=s.parts[0]?String.fromCharCode(...s.parts[0].subarray(0,11)):'';if((id==='NETSCAPE2.0'||id==='ANIMEXTS1.0')&&s.parts[1]&&s.parts[1][0]===1)loop=s.parts[1][1]|s.parts[1][2]<<8;}
   else subBlocks();
   continue;
  }
  if(k!==0x2C){warnings.push(`Unknown block 0x${k.toString(16)} at byte ${p-1}; stopped reading`);break;}
  const x=u16(),y=u16(),w=u16(),h=u16(),f=b[p++];
  let lct=null;if(f&0x80){const n=3*(1<<((f&7)+1));if(p+n>b.length)throw new GifError('Truncated GIF palette');lct=b.subarray(p,p+n);p+=n;}
  const minCode=b[p++],data=subBlocks();
  if(frames.length>=L.frames)throw new GifError(`More than ${L.frames} frames`);
  pixels+=W*H;if(pixels>L.pixels)throw new GifError('GIF is too large to decode');
  const pal=lct||gct;if(!pal){warnings.push(`Frame ${frames.length} has no palette; drawn transparent`);}
  const g=gce||{disposal:0,transparent:-1,delay:0};gce=null;
  const idx=new Uint8Array(w*h),got=lzw(data,minCode,idx);
  if(got<w*h||!data.ok)warnings.push(`Frame ${frames.length} is truncated (${got} of ${w*h} pixels)`);
  const saved=g.disposal===3?canvas.slice():null;
  if(pal){
   const rows=(f&0x40)?interlacedRows(h):null,n=Math.min(got,w*h),palN=pal.length/3;
   for(let i=0;i<n;i++){
    const r=Math.floor(i/w),c=i-r*w,cy=y+(rows?rows[r]:r),cx=x+c;
    if(cx>=W||cy>=H)continue;const v=idx[i];if(v===g.transparent||v>=palN)continue;
    const o=(cy*W+cx)*4;canvas[o]=pal[v*3];canvas[o+1]=pal[v*3+1];canvas[o+2]=pal[v*3+2];canvas[o+3]=255;
   }
  }
  const delay=g.delay*10;
  frames.push({rgba:canvas.slice(),delay:g.delay<=1?100:delay,rawDelay:delay,disposal:g.disposal,rect:{x,y,w,h},transparent:g.transparent});
  if(g.disposal===2){for(let yy=y;yy<Math.min(H,y+h);yy++)canvas.fill(0,(yy*W+x)*4,(yy*W+Math.min(W,x+w))*4);}
  else if(g.disposal===3&&saved)canvas.set(saved);
 }
 if(!frames.length)throw new GifError('GIF has no frames');
 return {width:W,height:H,loop,frames,warnings};
}
function interlacedRows(h){const out=new Int32Array(h);let k=0;for(const [start,step]of INTERLACE)for(let r=start;r<h;r+=step)out[k++]=r;return out;}
/** LZW (GIF variant, variable code size ≤ 12). Returns how many indices were written. */
function lzw({parts},minCode,out){
 if(minCode<2||minCode>11)minCode=Math.max(2,Math.min(11,minCode));
 const clear=1<<minCode,end=clear+1,prefix=new Int16Array(4096),suffix=new Uint8Array(4096),stack=new Uint8Array(4097);
 let size=minCode+1,mask=(1<<size)-1,avail=clear+2,old=-1,first=0,bits=0,acc=0,n=0,pi=0,bi=0;
 for(let i=0;i<clear;i++){prefix[i]=-1;suffix[i]=i;}
 const total=out.length;
 for(;;){
  while(bits<size){if(pi>=parts.length)return n;const part=parts[pi];if(bi>=part.length){pi++;bi=0;continue;}acc|=part[bi++]<<bits;bits+=8;}
  const code=acc&mask;acc>>>=size;bits-=size;
  if(code===clear){size=minCode+1;mask=(1<<size)-1;avail=clear+2;old=-1;continue;}
  if(code===end)return n;
  if(old===-1){if(code>=clear)return n;out[n++]=suffix[code];old=code;first=code;if(n>=total)return n;continue;}
  let c=code,sp=0;
  if(code>=avail){if(code>avail)return n;stack[sp++]=first;c=old;}
  while(c>=clear){stack[sp++]=suffix[c];c=prefix[c];if(sp>4096)return n;}
  first=suffix[c];stack[sp++]=first;
  if(avail<4096){prefix[avail]=old;suffix[avail]=first;avail++;if((avail&mask)===0&&avail<4096){size++;mask=(1<<size)-1;}}
  old=code;
  while(sp>0&&n<total)out[n++]=stack[--sp];
  if(n>=total)return n;
 }
}
