/** Embedded TrueType programs are usually the largest thing left in a text-only PDF: a full
 * Georgia is 220 KB for the 60 glyphs a letter actually uses. This pass keeps the outlines the
 * document draws and empties the rest, leaving `numGlyphs`, the glyph ids, the widths and the
 * character map exactly as they were — so no content stream has to be rewritten and nothing can
 * shift. It refuses to touch a font whenever the scan cannot account for every use of it:
 * an unreadable content stream, a font selected by a name that is not in scope, text shown with
 * a font inherited from a caller, a non-Identity CMap or a CFF/Type1 program all block it.
 * The dropped outlines are gone for good, exactly as in any other subsetting compressor. */
import * as L from '../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js';
import {contentStreams,operators,deflate} from './pdf-optimize.js';
const N=k=>L.PDFName.of(k);
const u16=(b,o)=>(b[o]<<8)|b[o+1],u32=(b,o)=>((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;
const put16=(b,o,v)=>{b[o]=v>>8&255;b[o+1]=v&255;},put32=(b,o,v)=>{b[o]=v>>>24&255;b[o+1]=v>>>16&255;b[o+2]=v>>>8&255;b[o+3]=v&255;};
const tag=(b,o)=>String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3]);
const SHOW=new Set(['Tj','TJ',"'",'"']);
const DROP=new Set(['GSUB','GPOS','GDEF','BASE','JSTF','DSIG','LTSH','VDMX','hdmx','gasp','kern','morx','mort','prop','feat','trak','opbd','bsln','lcar','just','Zapf','PCLT','EBDT','EBLC','EBSC','CBDT','CBLC','sbix','SVG ','VORG','MATH','meta','FFTM','vhea','vmtx']);
const CP1252=[0x20ac,0x81,0x201a,0x192,0x201e,0x2026,0x2020,0x2021,0x2c6,0x2030,0x160,0x2039,0x152,0x8d,0x17d,0x8f,0x90,0x2018,0x2019,0x201c,0x201d,0x2022,0x2013,0x2014,0x2dc,0x2122,0x161,0x203a,0x153,0x9d,0x17e,0x178];
function directory(bytes){
 if(bytes.length<12)return null;
 const version=u32(bytes,0);
 if(version!==0x00010000&&version!==0x74727565)return null;// OTTO (CFF) and ttcf are out of scope
 const count=u16(bytes,4),tables=new Map();
 if(bytes.length<12+count*16)return null;
 for(let i=0;i<count;i++){
  const o=12+i*16,offset=u32(bytes,o+8),length=u32(bytes,o+12);
  if(offset+length>bytes.length)return null;
  tables.set(tag(bytes,o),bytes.subarray(offset,offset+length));
 }
 return tables;
}
function checksum(b){let sum=0;for(let i=0;i<b.length;i+=4)sum=(sum+((((b[i]||0)<<24)|((b[i+1]||0)<<16)|((b[i+2]||0)<<8)|(b[i+3]||0))>>>0))>>>0;return sum>>>0;}
function assemble(tables){
 const tags=[...tables.keys()].sort(),entries=[];let offset=12+tags.length*16;
 for(const name of tags){const data=tables.get(name);entries.push({name,data,offset});offset+=data.length+3&~3;}
 const out=new Uint8Array(offset),count=tags.length,pow=Math.max(0,Math.floor(Math.log2(count))),search=16*2**pow;
 put32(out,0,0x00010000);put16(out,4,count);put16(out,6,search);put16(out,8,pow);put16(out,10,count*16-search);
 const head=tables.get('head');if(head)put32(head,8,0);
 entries.forEach((entry,i)=>{
  const o=12+i*16;for(let k=0;k<4;k++)out[o+k]=entry.name.charCodeAt(k);
  put32(out,o+4,checksum(entry.data));put32(out,o+8,entry.offset);put32(out,o+12,entry.data.length);
  out.set(entry.data,entry.offset);
 });
 const slot=entries.find(e=>e.name==='head');
 if(slot)put32(out,slot.offset+8,0xb1b0afba-checksum(out)>>>0);
 return out;
}
/** Keep the wanted glyphs' outlines, empty every other one, and rewrite `loca` to match. */
function trim(tables,wanted){
 const head=tables.get('head'),maxp=tables.get('maxp'),loca=tables.get('loca'),glyf=tables.get('glyf');
 if(!head||!maxp||!loca||!glyf||head.length<54||maxp.length<6)return null;
 const long=u16(head,50)===1,count=u16(maxp,4);
 if(loca.length<(count+1)*(long?4:2))return null;
 const at=i=>long?u32(loca,i*4):u16(loca,i*2)*2;
 const keep=new Set(wanted);keep.add(0);
 for(const queue=[...keep];queue.length;){
  const glyph=queue.pop();if(glyph>=count)continue;
  const start=at(glyph),end=at(glyph+1);
  if(end<=start+10||end>glyf.length||u16(glyf,start)<0x8000)continue;
  for(let o=start+10;o+4<=end;){
   const flags=u16(glyf,o),index=u16(glyf,o+2);
   if(!keep.has(index)){keep.add(index);queue.push(index);}
   o+=4+(flags&1?4:2)+(flags&8?2:flags&0x40?4:flags&0x80?8:0);
   if(!(flags&0x20))break;
  }
 }
 let total=0;const spans=[];
 for(let glyph=0;glyph<count;glyph++){
  const start=at(glyph),end=at(glyph+1),live=keep.has(glyph)&&end>start&&end<=glyf.length;
  const length=live?end-start:0;spans.push({start,length});total+=length+3&~3;
 }
 const outGlyf=new Uint8Array(total),outLoca=new Uint8Array((count+1)*(long?4:2));
 const write=(i,value)=>long?put32(outLoca,i*4,value):put16(outLoca,i*2,value>>1);
 let cursor=0;
 for(let glyph=0;glyph<count;glyph++){
  write(glyph,cursor);const span=spans[glyph];
  if(span.length){outGlyf.set(glyf.subarray(span.start,span.start+span.length),cursor);cursor+=span.length+3&~3;}
 }
 write(count,cursor);
 const next=new Map(tables);next.set('glyf',outGlyf);next.set('loca',outLoca);
 for(const name of DROP)next.delete(name);
 if(next.has('post')){const post=new Uint8Array(32);post.set(tables.get('post').subarray(4,32),4);put32(post,0,0x00030000);next.set('post',post);}
 return {bytes:assemble(next),glyphs:keep.size,of:count};
}
// ---- which glyphs the document actually draws
function cmapReader(tables){
 const cmap=tables.get('cmap');if(!cmap||cmap.length<4)return null;
 const subtables=[];
 for(let i=0,n=u16(cmap,2);i<n;i++){
  const o=4+i*8;if(o+8>cmap.length)break;
  const platform=u16(cmap,o),encoding=u16(cmap,o+2),offset=u32(cmap,o+4);
  if(offset<cmap.length)subtables.push({platform,encoding,data:cmap.subarray(offset)});
 }
 const lookup=(data,code)=>{
  const format=u16(data,0);
  if(format===0)return code<256&&6+code<data.length?data[6+code]:0;
  if(format===6){const first=u16(data,6),n=u16(data,8);return code>=first&&code<first+n?u16(data,10+(code-first)*2):0;}
  if(format===4){
   const seg=u16(data,6)/2,ends=14,starts=ends+seg*2+2,deltas=starts+seg*2,ranges=deltas+seg*2;
   for(let s=0;s<seg;s++){
    if(code>u16(data,ends+s*2))continue;
    const start=u16(data,starts+s*2);if(code<start)return 0;
    const offset=u16(data,ranges+s*2);
    if(!offset)return code+u16(data,deltas+s*2)&0xffff;
    const at=ranges+s*2+offset+(code-start)*2;
    if(at+1>=data.length)return 0;
    const glyph=u16(data,at);return glyph?glyph+u16(data,deltas+s*2)&0xffff:0;
   }
   return 0;
  }
  if(format===12){
   for(let g=0,n=u32(data,12);g<n;g++){const o=16+g*12;if(o+12>data.length)break;
    if(code>=u32(data,o)&&code<=u32(data,o+4))return u32(data,o+8)+(code-u32(data,o));}
   return 0;
  }
  return 0;
 };
 // A byte code in a simple font could mean several things; keep the glyph for every reading.
 return code=>{
  const unicode=code>=0x80&&code<0xa0?CP1252[code-0x80]:code,out=[];
  for(const {platform,encoding,data} of subtables){
   try{
    if(platform===3&&encoding===0)out.push(lookup(data,0xf000+code),lookup(data,code));
    else if(platform===1||platform===0&&encoding===0)out.push(lookup(data,code));
    else out.push(lookup(data,unicode),lookup(data,code));
   }catch{/* a malformed subtable simply contributes nothing */}
  }
  return out.filter(Boolean);
 };
}
/** Per font dict: which embedded program it uses and how its codes become glyph ids. */
function analyse(ctx,ref,programs){
 const font=ctx.lookup(ref);if(!(font instanceof L.PDFDict))return null;
 const subtype=String(ctx.lookup(font.get(N('Subtype')))||'');
 if(subtype==='/Type0'){
  const encoding=String(ctx.lookup(font.get(N('Encoding')))||'');
  const descendants=ctx.lookup(font.get(N('DescendantFonts')));
  const child=descendants instanceof L.PDFArray?ctx.lookup(descendants.get(0)):null;
  if(!(child instanceof L.PDFDict))return {blocked:true};
  if(!['/Identity-H','/Identity-V'].includes(encoding)||String(ctx.lookup(child.get(N('Subtype')))||'')!=='/CIDFontType2')return {blocked:true};
  const map=ctx.lookup(child.get(N('CIDToGIDMap'))),file=program(ctx,child,programs);
  if(!file)return {blocked:true};
  let table=null;
  if(map instanceof L.PDFStream){try{table=L.decodePDFRawStream(map).decode();}catch{return {blocked:true};}}
  else if(map&&String(map)!=='/Identity')return {blocked:true};
  return {file,codes:bytes=>{const out=[];for(let i=0;i+1<bytes.length;i+=2){const cid=(bytes[i]<<8)|bytes[i+1];out.push(table?(table[cid*2]<<8)|table[cid*2+1]:cid);}return out;}};
 }
 if(subtype==='/TrueType'){
  if(ctx.lookup(font.get(N('Encoding'))) instanceof L.PDFDict)return {blocked:true};// /Differences needs glyph names
  const file=program(ctx,font,programs);if(!file)return {blocked:true};
  const reader=cmapReader(file.tables);if(!reader)return {blocked:true};
  return {file,codes:bytes=>{const out=[];for(const code of bytes)out.push(...reader(code));return out;}};
 }
 return {blocked:true};// Type 1, Type 3 and CFF programs are left alone
}
function program(ctx,font,programs){
 const descriptor=ctx.lookup(font.get(N('FontDescriptor')));if(!(descriptor instanceof L.PDFDict))return null;
 const ref=descriptor.get(N('FontFile2'));if(!(ref instanceof L.PDFRef))return null;
 const key=String(ref);
 if(!programs.has(key)){
  const stream=ctx.lookup(ref);let bytes=null;
  try{bytes=stream instanceof L.PDFRawStream?L.decodePDFRawStream(stream).decode():null;}catch{bytes=null;}
  const tables=bytes?directory(bytes):null;
  programs.set(key,tables?{ref,stream,bytes,tables,used:new Set()}:null);
 }
 return programs.get(key);
}
export function usedGlyphs(doc){
 const ctx=doc.context,programs=new Map(),fonts=new Map(),reject=new Set();
 const plan=ref=>{const key=String(ref);if(!fonts.has(key))fonts.set(key,analyse(ctx,ref,programs));return fonts.get(key);};
 let blockAll=false;
 for(const {bytes,resources} of contentStreams(doc)){
  const dict=resources instanceof L.PDFDict?ctx.lookup(resources.get(N('Font'))):null;
  const inScope=dict instanceof L.PDFDict?dict.entries().map(([,v])=>v).filter(v=>v instanceof L.PDFRef):[];
  if(!bytes){for(const ref of inScope)reject.add(String(plan(ref)?.file?.ref||''));if(!dict)blockAll=true;continue;}
  let active=null;const stack=[];
  for(const [op,args] of operators(bytes)){
   if(op==='q')stack.push(active);
   else if(op==='Q')active=stack.length?stack.pop():active;
   else if(op==='Tf'){
    const key=args.find(a=>typeof a==='string'&&a.startsWith('/'));
    const ref=key&&dict instanceof L.PDFDict?dict.get(N(key.slice(1))):null;
    if(!(ref instanceof L.PDFRef)){active='unknown';for(const other of inScope)reject.add(String(plan(other)?.file?.ref||''));}
    else active=plan(ref);
   }
   else if(SHOW.has(op)){
    if(!active||active==='unknown'||active.blocked){blockAll=blockAll||!active;continue;}
    for(const arg of args)if(arg&&arg.bytes)for(const glyph of active.codes(arg.bytes))active.file.used.add(glyph);
   }
  }
 }
 for(const entry of programs.values())if(entry&&(blockAll||reject.has(String(entry.ref))))entry.used=null;
 return [...programs.values()].filter(entry=>entry&&entry.used);
}
/** Trim every embedded TrueType program we could fully account for. Never grows a font. */
export async function subsetFonts(doc,report){
 for(const entry of usedGlyphs(doc)){
  try{
   if(!entry.used.size)continue;
   const result=trim(entry.tables,entry.used);if(!result)continue;
   const bytes=await deflate(result.bytes);
   if(bytes.length>=entry.stream.contents.length*.95)continue;
   const dict=entry.stream.dict.clone(doc.context);
   dict.set(N('Filter'),N('FlateDecode'));dict.set(N('Length'),L.PDFNumber.of(bytes.length));dict.set(N('Length1'),L.PDFNumber.of(result.bytes.length));
   for(const key of ['Length2','Length3','DecodeParms','DP'])dict.delete(N(key));
   report.fontBytesSaved+=entry.stream.contents.length-bytes.length;report.subsetFonts++;
   report.fontGlyphs.push(`${result.glyphs}/${result.of}`);
   doc.context.assign(entry.ref,L.PDFRawStream.of(dict,bytes));
  }catch(e){if(report.imageErrors.length<3)report.imageErrors.push(e.message);}
 }
}
