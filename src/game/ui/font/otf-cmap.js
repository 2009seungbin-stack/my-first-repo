/** cmap (character → glyph) and name tables for the OpenType parser. Pure; no DOM.
 *
 * cmap: formats 0, 4, 6, 12 and 13 are decoded. The subtable is chosen the way fontTools'
 * getBestCmap does — full-repertoire Unicode first: (3,10) (0,6) (0,4), then BMP (3,1) (0,3)
 * (0,2) (0,1) (0,0) — with two last resorts fontTools does not use: a Windows symbol subtable
 * (3,0), whose U+F020–F0FF codes are also offered at U+0020–00FF as browsers do, and Mac
 * Roman (1,0), translated to Unicode. A subtable in an unsupported format (2, 8, 10) is
 * skipped in favour of the next candidate. Lookups are binary searches on the subtable itself,
 * so parsing a 20 000-glyph CJK cmap costs nothing until codepoints() enumerates it once.
 * Mappings to glyph 0 or to a glyph id ≥ numGlyphs count as unmapped.
 *
 * name: UTF-16BE for platforms 0 and 3, Mac Roman for (1,0). English (Windows 0x409, Mac 0)
 * records win over other languages; Windows over Unicode over Mac. */
import {fail} from './otf-read.js';

const MAC_ROMAN_HIGH='ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';
export const macRoman=c=>c<128?c:MAC_ROMAN_HIGH.charCodeAt(c-128);

const PREFERENCE=[[3,10],[0,6],[0,4],[3,1],[0,3],[0,2],[0,1],[0,0],[3,0],[1,0]];
const SUPPORTED=new Set([0,4,6,12,13]);

/** Builds {lookup(cp)→gid, candidates()→Iterable<cp>} for one subtable. */
function subtable(v,off,format){
 if(format===0){
  v.need(off+6,256,1,'cmap format 0');
  return {lookup:c=>c>=0&&c<256?v.u8(off+6+c):0,*candidates(){for(let c=0;c<256;c++)yield c;}};
 }
 if(format===4){
  const segX2=v.u16(off+6),n=segX2>>1,ends=off+14,starts=ends+segX2+2,deltas=starts+segX2,ranges=deltas+segX2;
  if(segX2&1)fail('cmap format 4: odd segCountX2');
  v.need(ends,n*4+1,2,'cmap format 4 segments');
  const lookup=c=>{
   if(c<0||c>0xffff)return 0;
   let lo=0,hi=n-1;
   while(lo<hi){const m=lo+hi>>1;if(v.u16(ends+m*2)<c)lo=m+1;else hi=m;}
   if(n===0||v.u16(ends+lo*2)<c)return 0;
   const start=v.u16(starts+lo*2);if(c<start)return 0;
   const delta=v.u16(deltas+lo*2),ro=v.u16(ranges+lo*2);
   if(!ro)return c+delta&0xffff;
   const at=ranges+lo*2+ro+(c-start)*2;
   if(at+2>v.length)return 0;// a range pointing past the table maps nothing (fontTools does the same)
   const g=v.u16(at);return g?g+delta&0xffff:0;
  };
  return {lookup,*candidates(){for(let i=0;i<n;i++){const a=v.u16(starts+i*2),b=v.u16(ends+i*2);for(let c=a;c<=b;c++)yield c;}}};
 }
 if(format===6){
  const first=v.u16(off+6),count=v.u16(off+8);v.need(off+10,count,2,'cmap format 6');
  return {lookup:c=>c>=first&&c<first+count?v.u16(off+10+(c-first)*2):0,*candidates(){for(let i=0;i<count;i++)yield first+i;}};
 }
 // 12 and 13: sorted groups {startChar,endChar,glyph}
 const count=v.u32(off+12),g=off+16;
 v.need(g,count,12,`cmap format ${format} groups`);
 const lookup=c=>{
  let lo=0,hi=count-1;
  while(lo<=hi){
   const m=lo+hi>>>1,p=g+m*12,a=v.u32(p),b=v.u32(p+4);
   if(c<a)hi=m-1;else if(c>b)lo=m+1;else return format===12?v.u32(p+8)+(c-a):v.u32(p+8);
  }
  return 0;
 };
 return {lookup,*candidates(){for(let i=0;i<count;i++){const p=g+i*12,a=v.u32(p),b=Math.min(v.u32(p+4),0x10ffff);for(let c=a;c<=b;c++)yield c;}}};
}

/** → {platformID, encodingID, format, glyphId(cp), codepoints()} */
export function readCmap(v,numGlyphs){
 const n=v.u16(2);v.need(4,n,8,'cmap encoding records');
 const recs=[];
 for(let i=0;i<n;i++){
  const p=v.u16(4+i*8),e=v.u16(6+i*8),off=v.u32(8+i*8);
  if(off+2>v.length)continue;
  recs.push({p,e,off,format:v.u16(off)});
 }
 let pick=null;
 for(const [p,e] of PREFERENCE){pick=recs.find(r=>r.p===p&&r.e===e&&SUPPORTED.has(r.format));if(pick)break;}
 if(!pick)return {platformID:null,encodingID:null,format:null,glyphId:()=>0,codepoints:()=>[]};
 const st=subtable(v,pick.off,pick.format),valid=g=>g>0&&g<numGlyphs?g:0;
 let raw=c=>valid(st.lookup(c)),source=st.candidates.bind(st);
 if(pick.p===1){// Mac Roman bytes → Unicode
  const back=new Map();for(let c=0;c<256;c++)back.set(macRoman(c),c);
  raw=c=>back.has(c)?valid(st.lookup(back.get(c))):0;
  source=function*(){for(const c of st.candidates())if(c<256)yield macRoman(c);};
 }else if(pick.p===3&&pick.e===0){// symbol fonts: U+F0xx, also reachable as U+00xx
  const direct=raw;
  raw=c=>direct(c)||(c>=0x20&&c<=0xff?direct(c+0xf000):0);
  source=function*(){for(const c of st.candidates()){yield c;if(c>=0xf020&&c<=0xf0ff)yield c-0xf000;}};
 }
 let list=null;
 return {platformID:pick.p,encodingID:pick.e,format:pick.format,glyphId:c=>Number.isInteger(c)?raw(c):0,
  codepoints(){
   if(!list){
    const seen=[];for(const c of source())if(raw(c))seen.push(c);
    seen.sort((a,b)=>a-b);list=seen.filter((c,i)=>!i||c!==seen[i-1]);
   }
   return list.slice();
  }};
}

function utf16(bytes){let s='';for(let i=0;i+1<bytes.length;i+=2)s+=String.fromCharCode(bytes[i]<<8|bytes[i+1]);return s;}
/** → Map nameID → string (best record per id). */
export function readName(v){
 const count=v.u16(2),strings=v.u16(4);v.need(6,count,12,'name records');
 const best=new Map();
 const rank=(p,e,l)=>p===3&&(e===1||e===10||e===0)?(l===0x409?0:1):p===0?2:p===1&&e===0?(l===0?3:4):-1;
 for(let i=0;i<count;i++){
  const o=6+i*12,p=v.u16(o),e=v.u16(o+2),l=v.u16(o+4),id=v.u16(o+6),len=v.u16(o+8),off=v.u16(o+10);
  const r=rank(p,e,l);if(r<0)continue;
  if(strings+off+len>v.length)continue;// one broken record must not hide the good ones
  const cur=best.get(id);if(cur&&cur.r<=r)continue;
  best.set(id,{r,p,o:strings+off,len});
 }
 const out=new Map();
 for(const [id,{p,o,len}] of best){
  const b=v.bytes(o,len);
  out.set(id,p===1?Array.from(b,c=>String.fromCharCode(macRoman(c))).join(''):utf16(b));
 }
 return out;
}
