/** Size reduction that works on the PDF objects, not only on the obvious page photos.
 * The old pass only touched streams whose dict literally said `/ColorSpace /DeviceRGB`, which
 * almost no writer emits — real files put the colour space in an indirect object, so nothing was
 * ever recompressed. Everything here resolves references, and a normal run keeps every page
 * object, so text, vectors and search survive. Raster mode stays a separate, labelled choice.
 * Passes: placement-aware downsampling · JPEG/Flate image recompression · identical-image
 * dedupe · uncompressed stream re-deflation · metadata and private-data strip · orphan sweep. */
import * as L from '../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js';
import {subsetFonts} from './pdf-subset.js';
const N=k=>L.PDFName.of(k),tick=()=>new Promise(r=>setTimeout(r,0));
const num=v=>v instanceof L.PDFNumber?v.asNumber():undefined;
const IMAGE_FILTERS=new Set(['/FlateDecode','/LZWDecode','/RunLengthDecode','/ASCII85Decode','/ASCIIHexDecode']);
export async function deflate(bytes){
 const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** Filters on a stream, outermost first, as plain strings. */
function filtersOf(ctx,stream){
 const f=ctx.lookup(stream.dict.get(N('Filter')));
 return f instanceof L.PDFName?[String(f)]:f instanceof L.PDFArray?f.asArray().map(x=>String(ctx.lookup(x))):[];
}
function parms(ctx,stream){
 const p=ctx.lookup(stream.dict.get(N('DecodeParms'))||stream.dict.get(N('DP')));
 const first=p instanceof L.PDFArray?p.asArray().map(x=>ctx.lookup(x)).find(x=>x instanceof L.PDFDict):p;
 return first instanceof L.PDFDict?first:null;
}
/** Resolved colour model of an image, or null when it is not one we can honestly re-encode. */
function colorspace(ctx,cs,depth=0){
 if(depth>4||!cs)return null;
 if(cs instanceof L.PDFName){
  const s=String(cs);
  if(s==='/DeviceRGB'||s==='/RGB'||s==='/CalRGB')return {kind:'rgb',comps:3};
  if(s==='/DeviceGray'||s==='/G'||s==='/CalGray')return {kind:'gray',comps:1};
  if(s==='/DeviceCMYK'||s==='/CMYK')return {kind:'cmyk',comps:4};
  return null;
 }
 if(!(cs instanceof L.PDFArray)||!cs.size())return null;
 const head=String(ctx.lookup(cs.get(0)));
 if(head==='/ICCBased'){const s=ctx.lookup(cs.get(1)),n=s instanceof L.PDFStream?num(ctx.lookup(s.dict.get(N('N')))):undefined;return n===1?{kind:'gray',comps:1}:n===3?{kind:'rgb',comps:3}:n===4?{kind:'cmyk',comps:4}:null;}
 if(head==='/CalRGB')return {kind:'rgb',comps:3};
 if(head==='/CalGray')return {kind:'gray',comps:1};
 if(head==='/Indexed'||head==='/I'){
  const base=colorspace(ctx,ctx.lookup(cs.get(1)),depth+1);if(!base||base.kind==='indexed')return null;
  const raw=ctx.lookup(cs.get(3));let table;
  if(raw instanceof L.PDFString||raw instanceof L.PDFHexString)table=raw.asBytes();
  else if(raw instanceof L.PDFRawStream)table=L.decodePDFRawStream(raw).decode();
  if(!table)return null;
  return {kind:'indexed',comps:1,base,table};
 }
 return null;
}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
/** PNG (10-15) and TIFF (2) predictors, undone in place where the layout allows it. */
function unpredict(data,predictor,colors,bpc,columns){
 if(!(predictor>1))return data;
 const bpp=Math.max(1,Math.ceil(colors*bpc/8)),row=Math.ceil(colors*bpc*columns/8);
 if(predictor===2){if(bpc!==8)return null;for(let r=0;r+row<=data.length;r+=row)for(let i=bpp;i<row;i++)data[r+i]=(data[r+i]+data[r+i-bpp])&255;return data;}
 const rows=Math.floor(data.length/(row+1));if(rows<1)return null;
 const out=new Uint8Array(rows*row);let prev=new Uint8Array(row);
 for(let r=0;r<rows;r++){
  const type=data[r*(row+1)],src=data.subarray(r*(row+1)+1,r*(row+1)+1+row),cur=out.subarray(r*row,r*row+row);
  for(let i=0;i<row;i++){const raw=src[i],a=i>=bpp?cur[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;
   cur[i]=type===1?(raw+a)&255:type===2?(raw+b)&255:type===3?(raw+((a+b)>>1))&255:type===4?(raw+paeth(a,b,c))&255:raw;}
  prev=cur;
 }
 return out;
}
/** Raw samples to RGBA. Returns null for anything whose colours we cannot reproduce exactly. */
function toRGBA(samples,w,h,bpc,cs){
 const out=new Uint8ClampedArray(w*h*4);
 const reader=(row,x,channel)=>{// sample value at (x, channel) of a row, normalised to 0-255
  if(bpc===8)return row[x*cs.comps+channel];
  const bit=(x*cs.comps+channel)*bpc,byte=row[bit>>3];if(byte===undefined)return 0;
  const shift=8-bpc-(bit&7),value=(byte>>shift)&((1<<bpc)-1);
  return cs.kind==='indexed'?value:Math.round(value*255/((1<<bpc)-1));
 };
 const rowBytes=Math.ceil(w*cs.comps*bpc/8);
 if(samples.length<rowBytes*h)return null;
 for(let y=0;y<h;y++){
  const row=samples.subarray(y*rowBytes,(y+1)*rowBytes);
  for(let x=0;x<w;x++){
   const o=(y*w+x)*4;out[o+3]=255;
   if(cs.kind==='gray'){const g=reader(row,x,0);out[o]=out[o+1]=out[o+2]=g;}
   else if(cs.kind==='rgb'){out[o]=reader(row,x,0);out[o+1]=reader(row,x,1);out[o+2]=reader(row,x,2);}
   else if(cs.kind==='cmyk'){const c=reader(row,x,0),m=reader(row,x,1),ye=reader(row,x,2),k=reader(row,x,3);out[o]=255-Math.min(255,c+k);out[o+1]=255-Math.min(255,m+k);out[o+2]=255-Math.min(255,ye+k);}
   else{const i=reader(row,x,0),b=cs.base.comps,p=i*b;
    if(b===1)out[o]=out[o+1]=out[o+2]=cs.table[p]??0;
    else if(b===3){out[o]=cs.table[p]??0;out[o+1]=cs.table[p+1]??0;out[o+2]=cs.table[p+2]??0;}
    else{const c=cs.table[p]??0,m=cs.table[p+1]??0,ye=cs.table[p+2]??0,k=cs.table[p+3]??0;out[o]=255-Math.min(255,c+k);out[o+1]=255-Math.min(255,m+k);out[o+2]=255-Math.min(255,ye+k);}}
  }
 }
 return out;
}
// ---- content-stream scan: how large is each image actually drawn?
const DELIM=c=>c<=32||c===40||c===41||c===60||c===62||c===91||c===93||c===123||c===125||c===47||c===37;
const text=(b,i,j)=>{let s='';for(let k=i;k<j;k++)s+=String.fromCharCode(b[k]);return s;};
const ESCAPE={110:10,114:13,116:9,98:8,102:12};
function literal(b,i){// after the opening '('; returns [bytes, indexAfterClosingParen]
 const out=[];let depth=1;
 while(i<b.length&&depth){
  const c=b[i++];
  if(c===92){const e=b[i++];
   if(e>=48&&e<=55){let v=e-48;for(let k=0;k<2&&b[i]>=48&&b[i]<=55;k++)v=v*8+(b[i++]-48);out.push(v&255);}
   else if(e===10)continue;else if(e===13){if(b[i]===10)i++;}
   else out.push(ESCAPE[e]??e);
  }
  else if(c===40){depth++;out.push(c);}
  else if(c===41){if(--depth)out.push(c);}
  else out.push(c);
 }
 return [Uint8Array.from(out),i];
}
function hexString(b,i){// after the opening '<'
 const out=[];let high=-1;
 for(;i<b.length&&b[i]!==62;i++){
  const c=b[i],v=c>=48&&c<=57?c-48:c>=65&&c<=70?c-55:c>=97&&c<=102?c-87:-1;
  if(v<0)continue;
  if(high<0)high=v;else{out.push(high*16+v);high=-1;}
 }
 if(high>=0)out.push(high*16);
 return [Uint8Array.from(out),i+1];
}
export function* operators(b){
 let i=0,args=[];const n=b.length;
 while(i<n){
  const c=b[i];
  if(c===37){while(i<n&&b[i]!==10&&b[i]!==13)i++;continue;}
  if(c<=32){i++;continue;}
  if(c===40){const [bytes,next]=literal(b,i+1);args.push({bytes});i=next;continue;}
  if(c===60&&b[i+1]===60){i+=2;continue;}
  if(c===62&&b[i+1]===62){i+=2;continue;}
  if(c===60){const [bytes,next]=hexString(b,i+1);args.push({bytes});i=next;continue;}
  if(c===91||c===93||c===123||c===125){i++;continue;}
  if(c===47){let j=i+1;while(j<n&&!DELIM(b[j]))j++;args.push(text(b,i,j));i=j;continue;}
  if(c>=48&&c<=57||c===43||c===45||c===46){let j=i;while(j<n&&(b[j]>=48&&b[j]<=57||b[j]===43||b[j]===45||b[j]===46||b[j]===101||b[j]===69))j++;args.push(Number(text(b,i,j)));i=j;continue;}
  let j=i;while(j<n&&!DELIM(b[j]))j++;if(j===i)j=i+1;
  const op=text(b,i,j);i=j;
  if(op==='BI'){// inline image: its binary payload would derail the scanner
   while(i<n&&!(b[i]===69&&b[i+1]===73&&(i+2>=n||DELIM(b[i+2]))))i++;i+=2;args=[];continue;}
  yield [op,args];args=[];
 }
}
const compose=(m,o)=>[m[0]*o[0]+m[1]*o[2],m[0]*o[1]+m[1]*o[3],m[2]*o[0]+m[3]*o[2],m[2]*o[1]+m[3]*o[3],m[4]*o[0]+m[5]*o[2]+o[4],m[4]*o[1]+m[5]*o[3]+o[5]];
function scanContent(ctx,bytes,resources,ctm,sizes,seen,depth){
 const stack=[];let cur=ctm;
 for(const [op,args] of operators(bytes)){
  if(op==='q')stack.push(cur);
  else if(op==='Q')cur=stack.pop()||cur;
  else if(op==='cm'&&args.length>=6)cur=compose(args.slice(-6),cur);
  else if(op==='gs'||op==='BT'||op==='ET')continue;
  else if(op==='Do'){
   const key=args.at(-1);if(typeof key!=='string'||!key.startsWith('/'))continue;
   const xobjects=resources instanceof L.PDFDict?ctx.lookup(resources.get(N('XObject'))):null;if(!(xobjects instanceof L.PDFDict))continue;
   const ref=xobjects.get(N(key.slice(1)));if(!ref)continue;
   const object=ctx.lookup(ref);if(!(object instanceof L.PDFStream))continue;
   const subtype=String(ctx.lookup(object.dict.get(N('Subtype')))||'');
   if(subtype==='/Image'){
    const tag=String(ref),w=Math.hypot(cur[0],cur[1]),h=Math.hypot(cur[2],cur[3]),prev=sizes.get(tag);
    sizes.set(tag,{w:Math.max(prev?.w||0,w),h:Math.max(prev?.h||0,h)});
   }else if(subtype==='/Form'&&depth<8&&!seen.has(String(ref))){
    seen.add(String(ref));
    const matrix=ctx.lookup(object.dict.get(N('Matrix'))),m=matrix instanceof L.PDFArray&&matrix.size()===6?matrix.asArray().map(x=>num(ctx.lookup(x))??0):null;
    let inner;try{inner=L.decodePDFRawStream(object).decode();}catch{seen.delete(String(ref));continue;}
    scanContent(ctx,inner,ctx.lookup(object.dict.get(N('Resources')))||resources,m?compose(m,cur):cur,sizes,seen,depth+1);
    seen.delete(String(ref));
   }
  }
 }
}
/** Every stream in the file that holds page description operators, with the resources that
 * apply to it: page contents, form XObjects, tiling patterns, annotation appearances and Type 3
 * glyph procedures. The font pass must see all of them or it must not trim anything. */
export function contentStreams(doc){
 const ctx=doc.context,out=[],seen=new Set(),queue=[];
 const decode=stream=>{try{return L.decodePDFRawStream(stream).decode();}catch{return null;}};
 const add=(object,resources)=>{
  const stream=ctx.lookup(object);if(!(stream instanceof L.PDFStream)||seen.has(stream))return;
  seen.add(stream);queue.push([stream,ctx.lookup(stream.dict.get(N('Resources')))||resources]);
 };
 /** Anything reachable from a resource dictionary that is itself a content stream. */
 const nested=resources=>{
  if(!(resources instanceof L.PDFDict))return;
  for(const key of ['XObject','Pattern']){
   const dict=ctx.lookup(resources.get(N(key)));if(!(dict instanceof L.PDFDict))continue;
   for(const [,value] of dict.entries()){const object=ctx.lookup(value);if(object instanceof L.PDFStream&&String(ctx.lookup(object.dict.get(N('Subtype')))||'')!=='/Image')add(value,resources);}
  }
  const fonts=ctx.lookup(resources.get(N('Font')));
  if(fonts instanceof L.PDFDict)for(const [,value] of fonts.entries()){
   const font=ctx.lookup(value),procs=font instanceof L.PDFDict?ctx.lookup(font.get(N('CharProcs'))):null;
   if(procs instanceof L.PDFDict)for(const [,glyph] of procs.entries())add(glyph,ctx.lookup(font.get(N('Resources')))||resources);
  }
 };
 for(const page of doc.getPages()){
  // A page's content array is one logical stream: graphics state carries from part to part.
  const resources=page.node.Resources(),contents=ctx.lookup(page.node.get(N('Contents')));
  const parts=(contents instanceof L.PDFArray?contents.asArray():[page.node.get(N('Contents'))]).map(x=>ctx.lookup(x)).filter(s=>s instanceof L.PDFStream&&!seen.has(s));
  if(parts.length){
   for(const part of parts)seen.add(part);
   const decoded=parts.map(decode);
   out.push({bytes:decoded.some(b=>!b)?null:L.mergeUint8Arrays(decoded.flatMap(b=>[b,new Uint8Array([10])])),resources});
  }
  nested(resources);
  const annots=ctx.lookup(page.node.get(N('Annots')));
  if(annots instanceof L.PDFArray)for(let i=0;i<annots.size();i++){
   const appearance=ctx.lookup(ctx.lookup(annots.get(i))?.get?.(N('AP')));if(!(appearance instanceof L.PDFDict))continue;
   for(const [,state] of appearance.entries()){
    const value=ctx.lookup(state);
    if(value instanceof L.PDFStream)add(value,resources);
    else if(value instanceof L.PDFDict)for(const [,leaf] of value.entries())add(leaf,resources);
   }
  }
 }
 for(let i=0;i<queue.length;i++){
  const [stream,resources]=queue[i];
  out.push({bytes:decode(stream),resources});
  nested(resources);
 }
 return out;
}
/** Image ref tag to the largest size in points at which any page draws it. */
export function placements(doc){
 const ctx=doc.context,sizes=new Map();
 for(const page of doc.getPages()){
  let content;
  try{
   const contents=ctx.lookup(page.node.get(N('Contents')));
   const streams=contents instanceof L.PDFArray?contents.asArray().map(x=>ctx.lookup(x)).filter(s=>s instanceof L.PDFStream):contents instanceof L.PDFStream?[contents]:[];
   if(!streams.length)continue;
   content=L.mergeUint8Arrays(streams.map(s=>{const b=L.decodePDFRawStream(s).decode();return L.mergeUint8Arrays([b,new Uint8Array([10])]);}));
  }catch{continue;}
  try{scanContent(ctx,content,page.node.Resources(),[1,0,0,1,0,0],sizes,new Set(),0);}catch{/* unusual content: fall back to the absolute cap */}
 }
 return sizes;
}
// ---- image pass
/** Refs used as a soft or stencil mask: those stay lossless, a JPEG would ring on their edges. */
function maskRefs(doc){
 const out=new Set();
 for(const [,object] of doc.context.enumerateIndirectObjects()){
  const dict=object instanceof L.PDFStream?object.dict:object instanceof L.PDFDict?object:null;if(!dict)continue;
  for(const key of ['SMask','Mask']){const v=dict.get(N(key));if(v instanceof L.PDFRef)out.add(String(v));}
 }
 return out;
}
function hash(bytes){let h1=0x811c9dc5,h2=0x1000193;for(let i=0;i<bytes.length;i++){h1=(h1^bytes[i])*16777619>>>0;h2=(h2+bytes[i]*(i%31+7))>>>0;}return `${bytes.length}:${h1.toString(16)}:${h2.toString(16)}`;}
/** Point every reference in `moves` (old tag → new ref) at its replacement, in one walk. */
function remap(ctx,moves){
 if(!moves.size)return;
 const seen=new Set(),walk=object=>{
  if(object instanceof L.PDFStream)return walk(object.dict);
  if(object instanceof L.PDFDict){
   if(seen.has(object))return;seen.add(object);
   for(const [key,value] of object.entries()){const to=value instanceof L.PDFRef?moves.get(String(value)):null;to?object.set(key,to):walk(value);}
  }else if(object instanceof L.PDFArray){
   if(seen.has(object))return;seen.add(object);
   for(let i=0;i<object.size();i++){const value=object.get(i),to=value instanceof L.PDFRef?moves.get(String(value)):null;to?object.set(i,to):walk(value);}
  }
 };
 for(const [,object] of ctx.enumerateIndirectObjects())walk(object);
}
/** Byte-identical streams (the same logo embedded once per page) collapse onto one object. */
function dedupeStreams(doc,report){
 const ctx=doc.context,first=new Map(),moves=new Map();
 for(const [ref,stream] of ctx.enumerateIndirectObjects()){
  if(!(stream instanceof L.PDFRawStream)||stream.contents.length<256)continue;
  const key=hash(stream.contents)+'|'+stream.dict.toString();
  const kept=first.get(key);
  if(kept){moves.set(String(ref),kept);if(String(ctx.lookup(stream.dict.get(N('Subtype')))||'')==='/Image')report.deduplicatedImages++;else report.deduplicatedStreams++;}
  else first.set(key,ref);
 }
 remap(ctx,moves);
}
async function optimizeImages(doc,{quality,maxSide,dpi,grayscale,grayLimits},progress,encode,report){
 const ctx=doc.context,sizes=placements(doc),masks=maskRefs(doc),encoded=new Map();
 const images=ctx.enumerateIndirectObjects().filter(([,o])=>o instanceof L.PDFRawStream&&String(ctx.lookup(o.dict.get(N('Subtype')))||'')==='/Image');
 for(let i=0;i<images.length;i++){
  const [ref,stream]=images[i],tag=String(ref),dict=stream.dict;
  progress(`image ${i+1} / ${images.length}`);await tick();
  const skip=reason=>{report.skipped[reason]=(report.skipped[reason]||0)+1;};
  try{
   const w=num(ctx.lookup(dict.get(N('Width'))))||0,h=num(ctx.lookup(dict.get(N('Height'))))||0;
   if(!(w>1&&h>1))continue;
   if(ctx.lookup(dict.get(N('ImageMask')))?.asBoolean?.()){skip('stencil');continue;}
   if(ctx.lookup(dict.get(N('Decode')))){skip('custom-decode');continue;}
   const isMask=masks.has(tag),bpc=num(ctx.lookup(dict.get(N('BitsPerComponent'))))||8;
   const filters=filtersOf(ctx,stream),jpeg=filters.length===1&&filters[0]==='/DCTDecode';
   const cs=colorspace(ctx,ctx.lookup(dict.get(N('ColorSpace'))));
   if(!jpeg&&!filters.every(f=>IMAGE_FILTERS.has(f))){skip(filters.join('')||'unfiltered');continue;}
   if(!cs){skip('colorspace');continue;}
   if(cs.kind==='cmyk'&&jpeg){skip('cmyk-jpeg');continue;}
   if(bpc===16||bpc===1&&!isMask&&cs.kind!=='indexed'&&cs.kind!=='gray'){skip(`bpc-${bpc}`);continue;}
   // Two caps, both always applied. The resolution cap uses how large the page actually draws
   // the image — a 2339px scan on an A4 page is 200dpi, the same pixels inside a 60pt logo are
   // 2800dpi. But a page's declared size can be meaningless: every image-to-PDF converter writes
   // a MediaBox of one point per pixel, which makes an A4 scan a 17x24 inch page at a genuine
   // 72dpi, and the resolution cap then correctly finds nothing to do. maxSide is what actually
   // bounds those files, so it is never allowed to be raised out of the way.
   const bound=sizes.get(tag),dots=bound?Math.max(8,dpi*Math.max(bound.w,bound.h)/72):Infinity;
   const scale=Math.min(1,maxSide/Math.max(w,h),dots/Math.max(w,h));
   const tw=Math.max(1,Math.round(w*scale)),th=Math.max(1,Math.round(h*scale));
   // A bilevel or paletted mask at its natural size has nothing left to win from a re-encode.
   if(isMask&&scale===1&&filters.length===1&&filters[0]==='/FlateDecode'){skip('mask-already-small');continue;}
   const key=hash(stream.contents)+`|${tw}x${th}|${isMask?'m':grayscale?'g':grayLimits?'a':'c'}`;
   let done=encoded.get(key);
   if(!done){
    let source;
    if(jpeg)source={blob:new Blob([stream.contents],{type:'image/jpeg'})};
    else{
     const raw=L.decodePDFRawStream(stream).decode(),p=parms(ctx,stream);
     const samples=p?unpredict(raw,num(ctx.lookup(p.get(N('Predictor'))))||1,num(ctx.lookup(p.get(N('Colors'))))||cs.comps,num(ctx.lookup(p.get(N('BitsPerComponent'))))||bpc,num(ctx.lookup(p.get(N('Columns'))))||w):raw;
     if(!samples){skip('predictor');continue;}
     const rgba=toRGBA(samples,w,h,bpc,cs);if(!rgba){skip('samples');continue;}
     source={rgba,width:w,height:h};
    }
    const result=await encode(source,tw,th,{type:isMask?'gray':'jpeg',quality,grayscale:grayscale&&!isMask,limits:isMask||grayscale?null:grayLimits});
    if(!result){skip('encoder');continue;}
    done=isMask?{...result,bytes:await deflate(result.bytes)}:result;
    encoded.set(key,done);
   }
   const bytes=done.bytes,result=done,filter=isMask?'/FlateDecode':'/DCTDecode',space=isMask?'/DeviceGray':'/DeviceRGB',bits=8;
   if(bytes.length>=stream.contents.length*.95){skip('no-gain');continue;}
   const next=dict.clone(ctx);
   next.set(N('Width'),L.PDFNumber.of(result.width));next.set(N('Height'),L.PDFNumber.of(result.height));
   next.set(N('Filter'),N(filter.slice(1)));next.set(N('ColorSpace'),N(space.slice(1)));next.set(N('BitsPerComponent'),L.PDFNumber.of(bits));
   next.set(N('Length'),L.PDFNumber.of(bytes.length));
   for(const key of ['DecodeParms','DP','Decode','Interpolate'])next.delete(N(key));
   ctx.assign(ref,L.PDFRawStream.of(next,bytes));
   report.imageBytesSaved+=stream.contents.length-bytes.length;report.optimizedImages++;
   if(scale<1)report.downsampledImages++;
   if(result.grayscale)report.grayscaleImages++;
   encoded.set(key,ref);
  }catch(e){skip('error');if(report.imageErrors.length<3)report.imageErrors.push(e.message);}
 }
}
// ---- stream, metadata and orphan passes
async function recompressStreams(doc,progress,report){
 const ctx=doc.context,objects=ctx.enumerateIndirectObjects();
 for(let i=0;i<objects.length;i++){
  const [ref,stream]=objects[i];
  if(!(stream instanceof L.PDFRawStream)||stream.contents.length<512)continue;
  if(stream.dict.get(N('Filter'))||['/XRef','/ObjStm'].includes(String(ctx.lookup(stream.dict.get(N('Type')))||'')))continue;
  try{
   const bytes=await deflate(stream.contents);
   if(bytes.length>=stream.contents.length*.95)continue;
   const dict=stream.dict.clone(ctx);dict.set(N('Filter'),N('FlateDecode'));dict.set(N('Length'),L.PDFNumber.of(bytes.length));
   report.streamBytesSaved+=stream.contents.length-bytes.length;report.recompressedStreams++;
   ctx.assign(ref,L.PDFRawStream.of(dict,bytes));
  }catch{/* leave the stream as it was */}
  if(i%64===0){progress(`stream ${i+1} / ${objects.length}`);await tick();}
 }
}
/** XMP packets and application private data (Illustrator/InDesign /PieceInfo) are pure weight.
 * The Info entries are deleted rather than blanked; save({updateMetadata:false}) keeps them gone. */
function stripPrivateData(doc,report){
 const ctx=doc.context,drop=(dict,keys)=>{if(!(dict instanceof L.PDFDict))return;for(const key of keys)if(dict.has(N(key))){dict.delete(N(key));report.metadataRemoved++;}};
 drop(doc.catalog,['Metadata','PieceInfo','SpiderInfo','Legal','OutputIntents']);
 for(const page of doc.getPages())drop(page.node,['Metadata','PieceInfo','LastModified']);
 drop(ctx.lookup(ctx.trailerInfo.Info),['Title','Author','Subject','Keywords','Producer','Creator','CreationDate','ModDate','Trapped']);
}
/** Mark from the trailer and drop what nothing points at any more (old images, unused ICC…). */
export function sweep(doc,report){
 const ctx=doc.context,live=new Set(),queue=[];
 const push=v=>{if(v instanceof L.PDFRef&&!live.has(String(v))){live.add(String(v));queue.push(v);}};
 for(const key of ['Root','Info','Encrypt','ID'])push(ctx.trailerInfo[key]);
 const walk=object=>{
  if(object instanceof L.PDFStream)return walk(object.dict);
  if(object instanceof L.PDFDict)for(const [,value] of object.entries())value instanceof L.PDFRef?push(value):walk(value);
  else if(object instanceof L.PDFArray)for(let i=0;i<object.size();i++){const value=object.get(i);value instanceof L.PDFRef?push(value):walk(value);}
 };
 while(queue.length)walk(ctx.lookup(queue.pop()));
 for(const [ref] of ctx.enumerateIndirectObjects())if(!live.has(String(ref))){ctx.delete(ref);report.sweptObjects++;}
}
export function emptyReport(){return {optimizedImages:0,downsampledImages:0,grayscaleImages:0,deduplicatedImages:0,deduplicatedStreams:0,imageBytesSaved:0,subsetFonts:0,fontBytesSaved:0,fontGlyphs:[],recompressedStreams:0,streamBytesSaved:0,metadataRemoved:0,sweptObjects:0,skipped:{},imageErrors:[]};}
export async function optimize(doc,options,progress,encode){
 const report=emptyReport(),o={quality:.62,maxSide:1700,dpi:144,grayscale:false,grayLimits:null,images:true,streams:true,fonts:true,metadata:false,...options};
 dedupeStreams(doc,report);
 if(o.images)await optimizeImages(doc,o,m=>progress(`Recompressing ${m}`),encode,report);
 if(o.fonts){progress('Trimming embedded fonts');await tick();await subsetFonts(doc,report);}
 if(o.metadata)stripPrivateData(doc,report);
 if(o.streams)await recompressStreams(doc,m=>progress(`Compacting ${m}`),report);
 dedupeStreams(doc,report);
 sweep(doc,report);
 return report;
}
