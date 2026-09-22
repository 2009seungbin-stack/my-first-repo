/** Small synchronous zlib (RFC 1950/1951) for the Aseprite reader and writer. Pure: no DOM, no
 * Node APIs, so the same code runs in the page, in workers and in Node tests.
 *
 * Why not DecompressionStream / node:zlib: Aseprite cels are many small zlib streams whose
 * decoded size is known in advance. Decoding into a buffer of exactly that size is what makes
 * decompression bombs harmless (output never grows past the declared cel size and decoding stops
 * there), and a synchronous decoder keeps the reader a plain function. Both directions are
 * cross-checked against node:zlib in tests/aseprite.test.mjs, so this is not a closed loop.
 *
 * inflateZlib(src,{size})    → {data, length, complete, excess, adlerOk}
 * deflateZlib(bytes,{level}) → Uint8Array (valid zlib stream, dynamic Huffman blocks) */
export class ZlibError extends Error{constructor(message){super(message);this.name='ZlibError';}}
class TruncatedError extends ZlibError{constructor(){super('Unexpected end of zlib data');}}

const LEN_BASE=new Uint16Array([3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258]);
const LEN_EXTRA=new Uint8Array([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]);
const DIST_BASE=new Uint16Array([1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577]);
const DIST_EXTRA=new Uint8Array([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]);
const CL_ORDER=new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]);

export function adler32(data,start=0,end=data.length){
 let a=1,b=0;
 for(let i=start;i<end;){const n=Math.min(end,i+3800);for(;i<n;i++){a+=data[i];b+=a;}a%=65521;b%=65521;}
 return ((b<<16)|a)>>>0;
}

/** Canonical Huffman decode table: entry = symbol<<4 | codeLength, indexed by the next `bits`
 * input bits (LSB first); -1 marks an unused pattern of an incomplete code. */
function buildTable(lengths,n){
 let max=0;const count=new Uint16Array(16);
 for(let i=0;i<n;i++){const l=lengths[i];if(l){count[l]++;if(l>max)max=l;}}
 if(!max)return {table:new Int32Array(1),bits:0,empty:true};
 let left=1;for(let l=1;l<=15;l++){left=(left<<1)-count[l];if(left<0)throw new ZlibError('Invalid Huffman code (over-subscribed)');}
 const next=new Uint16Array(16);let code=0;for(let l=1;l<=15;l++){code=(code+count[l-1])<<1;next[l]=code;}
 const size=1<<max,table=new Int32Array(size).fill(-1);
 for(let s=0;s<n;s++){
  const l=lengths[s];if(!l)continue;
  let c=next[l]++,r=0;for(let i=0;i<l;i++){r=(r<<1)|(c&1);c>>=1;}
  for(let i=r;i<size;i+=1<<l)table[i]=(s<<4)|l;
 }
 return {table,bits:max,empty:false};
}
let FIXED=null;
function fixedTables(){
 if(FIXED)return FIXED;
 const l=new Uint8Array(288);l.fill(8,0,144);l.fill(9,144,256);l.fill(7,256,280);l.fill(8,280,288);
 return FIXED={lit:buildTable(l,288),dist:buildTable(new Uint8Array(30).fill(5),30)};
}

/** Inflates a zlib stream. With `size`, the output buffer is exactly that many bytes: decoding
 * stops at the first byte that would not fit (`excess:true`; the rest is never decoded, so a
 * decompression bomb costs at most `size` bytes of work), and a stream that ends early leaves the
 * rest zero (`complete:false`). Without `size`, `maxOutput` caps a growing buffer (exceeding it
 * throws). Malformed data throws ZlibError; a cut-off stream returns `truncated:true`. Every loop iteration consumes input
 * or produces bounded output, so it cannot hang. */
export function inflateZlib(src,{size=null,maxOutput=64*1024*1024,start=0,end=src.length}={}){
 if(end-start<2)throw new ZlibError('zlib stream too short');
 const cmf=src[start],flg=src[start+1];
 if((cmf&15)!==8||(cmf>>4)>7||((cmf<<8)|flg)%31)throw new ZlibError('Not a zlib stream');
 if(flg&32)throw new ZlibError('zlib preset dictionaries are not supported');
 let pos=start+2,bitbuf=0,bitcnt=0,pad=0;
 let out=new Uint8Array(size??Math.min(maxOutput,Math.max(1024,(end-start)*4))),op=0;
 const need=n=>{while(bitcnt<n){if(pos<end)bitbuf|=src[pos++]<<bitcnt;else if(++pad>4)throw new TruncatedError();bitcnt+=8;}};
 const bits=n=>{if(!n)return 0;need(n);const v=bitbuf&((1<<n)-1);bitbuf>>>=n;bitcnt-=n;return v;};
 const decode=t=>{
  if(t.empty)throw new ZlibError('Symbol from an empty Huffman code');
  need(t.bits);const e=t.table[bitbuf&((1<<t.bits)-1)];
  if(e<0)throw new ZlibError('Invalid Huffman code');
  const l=e&15;bitbuf>>>=l;bitcnt-=l;return e>>4;
 };
 // Byte-align and give prefetched whole bytes back to the input (padding bytes are not real).
 const align=()=>{const drop=bitcnt&7;bitbuf>>>=drop;bitcnt-=drop;const back=(bitcnt>>3)-pad;if(back<0)throw new TruncatedError();pos-=back;bitbuf=0;bitcnt=0;pad=0;};
 const room=k=>{
  if(op+k<=out.length)return true;
  if(size!=null)return false;
  if(op+k>maxOutput)throw new ZlibError('Decompressed data exceeds the limit');
  const n=new Uint8Array(Math.min(maxOutput,Math.max(op+k,out.length*2)));n.set(out.subarray(0,op));out=n;return true;
 };
 let excess=false,final=0,truncated=false,adlerOk=null;
 try{
 outer:while(!final){
  final=bits(1);const type=bits(2);
  if(type===0){
   align();
   if(pos+4>end)throw new TruncatedError();
   const len=src[pos]|(src[pos+1]<<8),nlen=src[pos+2]|(src[pos+3]<<8);pos+=4;
   if((len^0xffff)!==nlen)throw new ZlibError('Stored block length mismatch');
   if(pos+len>end)throw new TruncatedError();
   if(len&&!room(len)){const k=out.length-op;out.set(src.subarray(pos,pos+k),op);op+=k;excess=true;break;}
   out.set(src.subarray(pos,pos+len),op);op+=len;pos+=len;
   continue;
  }
  let lit,dist;
  if(type===1)({lit,dist}=fixedTables());
  else if(type===2){
   const hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4;
   if(hlit>286||hdist>30)throw new ZlibError('Invalid dynamic block header');
   const cl=new Uint8Array(19);for(let i=0;i<hclen;i++)cl[CL_ORDER[i]]=bits(3);
   const clt=buildTable(cl,19),lens=new Uint8Array(hlit+hdist);
   for(let i=0;i<hlit+hdist;){
    const sym=decode(clt);
    if(sym<16)lens[i++]=sym;
    else{
     let rep,val=0;
     if(sym===16){if(!i)throw new ZlibError('Repeat with no previous length');val=lens[i-1];rep=3+bits(2);}
     else if(sym===17)rep=3+bits(3);else rep=11+bits(7);
     if(i+rep>hlit+hdist)throw new ZlibError('Code lengths overflow');
     lens.fill(val,i,i+rep);i+=rep;
    }
   }
   if(!lens[256])throw new ZlibError('Missing end-of-block code');
   lit=buildTable(lens.subarray(0,hlit),hlit);dist=buildTable(lens.subarray(hlit),hdist);
  }else throw new ZlibError('Invalid block type');
  for(;;){
   const sym=decode(lit);
   if(sym<256){if(!room(1)){excess=true;break outer;}out[op++]=sym;continue;}
   if(sym===256)break;
   const li=sym-257;if(li>=29)throw new ZlibError('Invalid length symbol');
   const len=LEN_BASE[li]+bits(LEN_EXTRA[li]);
   const ds=decode(dist);if(ds>=30)throw new ZlibError('Invalid distance symbol');
   const d=DIST_BASE[ds]+bits(DIST_EXTRA[ds]);
   if(d>op)throw new ZlibError('Distance too far back');
   if(!room(len)){for(const n=out.length;op<n;op++)out[op]=out[op-d];excess=true;break outer;}
   for(let i=0;i<len;i++,op++)out[op]=out[op-d];
  }
  if(pad*8>bitcnt)throw new TruncatedError();
 }
 // Stopping on a full buffer while already reading past the input means the stream was cut.
 if(excess&&pad*8>bitcnt)throw new TruncatedError();
 if(!excess){
  align();
  if(pos+4<=end)adlerOk=(((src[pos]<<24)|(src[pos+1]<<16)|(src[pos+2]<<8)|src[pos+3])>>>0)===adler32(out,0,op);
 }
 }catch(e){if(!(e instanceof TruncatedError))throw e;truncated=true;excess=false;}
 const data=size!=null?out:out.slice(0,op);
 // `truncated`: the input ended inside the deflate data; bytes decoded so far are kept (the last
 // few may come from the missing tail and be wrong), so callers can warn instead of dropping all.
 return {data,length:op,complete:!truncated&&(size==null||op===size),excess,adlerOk,truncated};
}

// ---------------------------------------------------------------------------------------------
// Deflate (compression): LZ77 with hash chains + dynamic Huffman blocks.

class BitWriter{
 constructor(n){this.buf=new Uint8Array(Math.max(64,n));this.pos=0;this.bits=0;this.cnt=0;}
 ensure(n){if(this.pos+n>this.buf.length){const b=new Uint8Array(Math.max(this.buf.length*2,this.pos+n));b.set(this.buf.subarray(0,this.pos));this.buf=b;}}
 put(v,n){this.bits|=v<<this.cnt;this.cnt+=n;while(this.cnt>=8){this.ensure(1);this.buf[this.pos++]=this.bits&255;this.bits>>>=8;this.cnt-=8;}}
 flush(){if(this.cnt>0){this.ensure(1);this.buf[this.pos++]=this.bits&255;}this.bits=0;this.cnt=0;}
 bytes(arr){this.ensure(arr.length);this.buf.set(arr,this.pos);this.pos+=arr.length;}
}
const rev=(c,l)=>{let r=0;for(let i=0;i<l;i++){r=(r<<1)|(c&1);c>>=1;}return r;};
/** Length-limited Huffman code lengths from frequencies (Huffman tree, then zlib-style repair
 * of the Kraft sum when a code exceeds `limit`). */
function codeLengths(freq,limit){
 const n=freq.length,lens=new Uint8Array(n),syms=[];
 for(let i=0;i<n;i++)if(freq[i])syms.push(i);
 if(!syms.length)return lens;
 if(syms.length===1){lens[syms[0]]=1;return lens;}
 const leaves=syms.map(s=>({f:freq[s],s,l:null,r:null})).sort((a,b)=>a.f-b.f||a.s-b.s);
 const q2=[];let i=0,j=0;
 const take=()=>(j>=q2.length||(i<leaves.length&&leaves[i].f<=q2[j].f))?leaves[i++]:q2[j++];
 while(leaves.length-i+q2.length-j>1){const a=take(),b=take();q2.push({f:a.f+b.f,s:-1,l:a,r:b});}
 const stack=[[q2[q2.length-1],0]];
 while(stack.length){const [node,d]=stack.pop();if(node.s>=0)lens[node.s]=Math.max(1,d);else{stack.push([node.l,d+1],[node.r,d+1]);}}
 let over=false;for(const s of syms)if(lens[s]>limit){lens[s]=limit;over=true;}
 if(over){
  const cap=2**limit;let kraft=syms.reduce((t,s)=>t+2**(limit-lens[s]),0);
  const order=[...syms].sort((a,b)=>freq[a]-freq[b]);
  while(kraft>cap){for(const s of order){if(lens[s]<limit){kraft-=2**(limit-lens[s]-1);lens[s]++;if(kraft<=cap)break;}}}
 }
 return lens;
}
function canonical(lens){
 const count=new Uint16Array(16),next=new Uint16Array(16),codes=new Uint16Array(lens.length);
 for(const l of lens)if(l)count[l]++;
 let c=0;for(let l=1;l<=15;l++){c=(c+count[l-1])<<1;next[l]=c;}
 for(let s=0;s<lens.length;s++)if(lens[s])codes[s]=rev(next[lens[s]]++,lens[s]);
 return codes;
}
const LEN_SYM=new Uint16Array(259),LEN_XV=new Uint16Array(259);
for(let i=0;i<28;i++)for(let l=LEN_BASE[i];l<LEN_BASE[i+1];l++){LEN_SYM[l]=257+i;LEN_XV[l]=l-LEN_BASE[i];}
LEN_SYM[258]=285;LEN_XV[258]=0;
const DIST_SYM=new Uint8Array(32769);
for(let s=0;s<30;s++){const e=s===29?32769:DIST_BASE[s+1];for(let d=DIST_BASE[s];d<e;d++)DIST_SYM[d]=s;}

function writeBlock(w,syms,count,final){
 // syms: literal byte, or 0x80000000 | len<<16 | dist
 const lf=new Uint32Array(286),df=new Uint32Array(30);
 for(let i=0;i<count;i++){const v=syms[i];if(v>=0x80000000){lf[LEN_SYM[(v>>>16)&0x1ff]]++;df[DIST_SYM[v&0xffff]]++;}else lf[v]++;}
 lf[256]=1;
 const ll=codeLengths(lf,15),dl=codeLengths(df,15);
 if(!dl.some(Boolean))dl[0]=1; // at least one distance code must exist
 let hlit=286;while(hlit>257&&!ll[hlit-1])hlit--;
 let hdist=30;while(hdist>1&&!dl[hdist-1])hdist--;
 const all=new Uint8Array(hlit+hdist);all.set(ll.subarray(0,hlit));all.set(dl.subarray(0,hdist),hlit);
 const rle=[];
 for(let i=0;i<all.length;){
  const v=all[i];let r=1;while(i+r<all.length&&all[i+r]===v)r++;
  if(v===0&&r>=3){const k=Math.min(r,138);rle.push(k>=11?[18,k-11]:[17,k-3]);i+=k;continue;}
  if(v!==0&&r>=4){rle.push([v]);const k=Math.min(r-1,6);rle.push([16,k-3]);i+=1+k;continue;}
  rle.push([v]);i++;
 }
 const cf=new Uint32Array(19);for(const [s] of rle)cf[s]++;
 const cl=codeLengths(cf,7),cc=canonical(cl);
 let hclen=19;while(hclen>4&&!cl[CL_ORDER[hclen-1]])hclen--;
 w.put(final?1:0,1);w.put(2,2);w.put(hlit-257,5);w.put(hdist-1,5);w.put(hclen-4,4);
 for(let i=0;i<hclen;i++)w.put(cl[CL_ORDER[i]],3);
 for(const [s,x] of rle){w.put(cc[s],cl[s]);if(s===16)w.put(x,2);else if(s===17)w.put(x,3);else if(s===18)w.put(x,7);}
 const lc=canonical(ll),dc=canonical(dl);
 for(let i=0;i<count;i++){
  const v=syms[i];
  if(v>=0x80000000){
   const len=(v>>>16)&0x1ff,d=v&0xffff,ls=LEN_SYM[len],li=ls-257;
   w.put(lc[ls],ll[ls]);if(LEN_EXTRA[li])w.put(LEN_XV[len],LEN_EXTRA[li]);
   const ds=DIST_SYM[d];w.put(dc[ds],dl[ds]);if(DIST_EXTRA[ds])w.put(d-DIST_BASE[ds],DIST_EXTRA[ds]);
  }else w.put(lc[v],ll[v]);
 }
 w.put(lc[256],ll[256]);
}

/** zlib-compresses `data`. level 0 = stored blocks; 1…9 trade speed for match-search depth. */
export function deflateZlib(data,{level=6}={}){
 const n=data.length,w=new BitWriter((n>>1)+64);
 w.put(0x78,8);w.put(0x9c,8); // CMF/FLG: deflate, 32K window, FCHECK valid
 if(n===0){w.put(1,1);w.put(1,2);w.put(0,7);} // one final fixed block holding only end-of-block
 else if(level===0){
  for(let p=0;p<n;){
   const k=Math.min(65535,n-p);w.put(p+k>=n?1:0,1);w.put(0,2);w.flush();
   w.bytes(new Uint8Array([k&255,k>>8,~k&255,(~k>>8)&255]));w.bytes(data.subarray(p,p+k));p+=k;
  }
 }else{
  const lv=Math.min(9,level),maxChain=[0,4,8,16,32,64,128,256,1024,4096][lv],nice=[0,8,16,32,32,64,128,128,258,258][lv];
  const HB=15,head=new Int32Array(1<<HB).fill(-1),prev=new Int32Array(32768);
  const hash=i=>(Math.imul((data[i]<<16)|(data[i+1]<<8)|data[i+2],0x9E3779B1)>>>(32-HB));
  const BLOCK=1<<16,syms=new Uint32Array(BLOCK);let count=0;
  const insert=i=>{if(i+2<n){const h=hash(i);prev[i&32767]=head[h];head[h]=i;}};
  for(let i=0;i<n;){
   let bestLen=0,bestDist=0;
   if(i+2<n){
    const h=hash(i),maxLen=Math.min(258,n-i);let cand=head[h],chain=maxChain;
    while(cand>=0&&i-cand<=32768&&chain-->0){
     if(data[cand+bestLen]===data[i+bestLen]){
      let l=0;while(l<maxLen&&data[cand+l]===data[i+l])l++;
      if(l>bestLen){bestLen=l;bestDist=i-cand;if(l>=nice||l===maxLen)break;}
     }
     const p=prev[cand&32767];if(p>=cand)break;cand=p;
    }
    prev[i&32767]=head[h];head[h]=i;
   }
   if(bestLen>=3){syms[count++]=(0x80000000|(bestLen<<16)|bestDist)>>>0;for(let k=1;k<bestLen;k++)insert(i+k);i+=bestLen;}
   else syms[count++]=data[i++];
   if(count===BLOCK){writeBlock(w,syms,count,i>=n);count=0;}
  }
  if(count)writeBlock(w,syms,count,true);
 }
 w.flush();
 const a=adler32(data);w.bytes(new Uint8Array([a>>>24,(a>>>16)&255,(a>>>8)&255,a&255]));
 return w.buf.slice(0,w.pos);
}
