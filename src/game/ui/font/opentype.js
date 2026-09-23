/** OpenType / TrueType reader for building game fonts. Pure: no DOM, no Node APIs, no
 * dependencies — the same code runs in the page, in workers and in Node tests.
 *
 * parseFont(bytes,{index}) → Font; sniffFont(bytes) → 'ttf'|'otf'|'ttc'|'woff'|'woff2'|null
 *
 * Containers: bare sfnt (TrueType 0x00010000/'true', OpenType 'OTTO'), TrueType collections
 * (face `index`), WOFF 1.0 (tables inflated lazily with ./zlib.js into buffers of exactly the
 * declared size, so a lying header cannot grow memory). WOFF2 needs Brotli and a glyf transform
 * and is refused with a clear message.
 *
 * Tables: head hhea maxp hmtx cmap name OS/2 post · loca/glyf · CFF · fvar avar gvar HVAR ·
 * GPOS/GDEF (kerning) · kern. CFF2 is refused. EBDT/CBDT/sbix-only fonts parse, report
 * `bitmapOnly`, and glyphPath() explains that they carry no outlines.
 *
 * The Font:
 *  container, outlines, unitsPerEm, ascender/descender/lineGap (hhea, or OS/2 typo metrics when
 *  fsSelection.USE_TYPO_METRICS is set), os2 {typo*, win*, xHeight, capHeight}|null, family,
 *  subfamily (typographic names 16/17 when present), fullName, postScriptName, version,
 *  licenseText (13), licenseUrl (14), copyright, numGlyphs, bitmapOnly, axes, instances,
 *  codepoints(), glyphId(cp), hasGlyph(cp), advance(gid,coords), glyphPath(gid,coords),
 *  kerning(l,r,coords), kerningPairs(gids,coords), normalizeCoords(user).
 *
 * `coords` everywhere is either null (default instance), a user-space object like {wght:700}
 * (missing axes stay at their default), or an already normalized array from normalizeCoords().
 * Paths are in font units, y up, origin at the glyph origin; every contour ends with 'Z'.
 * Results are cached per (glyph, coordinates) and must be treated as read-only.
 *
 * Every read is bounds-checked (./otf-read.js): corrupt or truncated fonts throw a FontError
 * with a readable message; nothing loops on unchecked counts, composite nesting is capped at 16
 * levels and CFF subroutine nesting at 10. */
import {inflateZlib} from '../../zlib.js';
import {View,FontError,fail} from './otf-read.js';
import {readCmap,readName} from './otf-cmap.js';
import {readFvar,readAvar,normalize,readItemVariationStore,readDeltaSetIndexMap,readGvar} from './otf-var.js';
import {makeGlyf} from './otf-glyf.js';
import {makeCFF} from './otf-cff.js';
import {contoursToCommands,commandBounds} from './otf-path.js';
import {readGposKern,readKernTable,gposKern,gposPairs} from './otf-layout.js';

export {FontError};
const MAX_WOFF_TOTAL=512*1024*1024;

const u8=bytes=>{
 if(bytes instanceof Uint8Array)return bytes;
 if(bytes instanceof ArrayBuffer)return new Uint8Array(bytes);
 if(ArrayBuffer.isView(bytes))return new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 fail('parseFont expects a Uint8Array or an ArrayBuffer');
};

/** Cheap header sniff: the first four bytes only. */
export function sniffFont(bytes){
 const b=u8(bytes);if(b.length<4)return null;
 const t=String.fromCharCode(b[0],b[1],b[2],b[3]);
 if(t==='wOFF')return 'woff';
 if(t==='wOF2')return 'woff2';
 if(t==='ttcf')return 'ttc';
 if(t==='OTTO')return 'otf';
 if(t==='true'||(b[0]===0&&b[1]===1&&b[2]===0&&b[3]===0))return 'ttf';
 return null;
}

/** sfnt table directory at `at` → Map tag → View (bytes shared, no copies). */
function sfntTables(file,at){
 const numTables=file.u16(at+4);
 file.need(at+12,numTables,16,'table directory');
 const tables=new Map();
 for(let i=0;i<numTables;i++){
  const r=at+12+i*16,tag=file.tag(r),off=file.u32(r+8),len=file.u32(r+12);
  if(off+len>file.length)fail(`${tag.trim()}: table lies outside the file (offset ${off}, length ${len}, file ${file.length} bytes) — the font is truncated or corrupt`);
  if(!tables.has(tag))tables.set(tag,()=>new View(file.b,off,off+len,tag.trim()));
 }
 return tables;
}
function woffTables(file){
 const numTables=file.u16(12);file.need(44,numTables,20,'WOFF table directory');
 const tables=new Map();let total=0;
 for(let i=0;i<numTables;i++){
  const r=44+i*20,tag=file.tag(r),off=file.u32(r+4),comp=file.u32(r+8),orig=file.u32(r+12),name=tag.trim();
  if(off+comp>file.length)fail(`WOFF: ${name} table lies outside the file — the font is truncated or corrupt`);
  if(comp>orig)fail(`WOFF: ${name} table is larger compressed than uncompressed — the file is corrupt`);
  total+=orig;if(total>MAX_WOFF_TOTAL)fail('WOFF: declared table sizes exceed 512 MB');
  tables.set(tag,()=>{
   if(comp===orig)return new View(file.b,off,off+orig,name);
   let r;
   try{r=inflateZlib(file.b,{size:orig,start:off,end:off+comp});}
   catch(e){fail(`WOFF: ${name} table does not decompress (${e.message})`);}
   if(!r.complete||r.excess)fail(`WOFF: ${name} table decompresses to a different size than declared (${orig} bytes)`);
   return new View(r.data,0,orig,name);
  });
 }
 return tables;
}

export function parseFont(bytes,{index=0}={}){
 const file=new View(u8(bytes),0,undefined,'font');
 if(file.length<12)fail('Not a font: the file is too small');
 const kind=sniffFont(file.b);
 let container,getters;
 if(kind==='woff2')fail('WOFF2 is not supported: convert it to TTF/OTF first');
 else if(kind==='woff'){container='woff';getters=woffTables(file);}
 else if(kind==='ttc'){
  const n=file.u32(8);
  if(!Number.isInteger(index)||index<0||index>=n)fail(`Font collection has ${n} face${n===1?'':'s'}; face ${index} does not exist`);
  file.need(12,n,4,'TTC offsets');
  const at=file.u32(12+index*4),t=file.tag(at);
  if(t!=='OTTO'&&t!=='true'&&file.u32(at)!==0x00010000)fail(`Font collection face ${index} is not an sfnt font`);
  container='ttc';getters=sfntTables(file,at);
 }else if(kind==='ttf'||kind==='otf'){container='sfnt';getters=sfntTables(file,0);}
 else{
  const t=file.tag(0);
  if(t==='typ1')fail('PostScript Type 1 fonts in sfnt wrappers are not supported');
  fail('Not a TrueType/OpenType font (unrecognised header)');
 }
 return new Font(container,getters);
}

class Font{
 constructor(container,getters){
  const cache=new Map();
  const table=tag=>{
   const key=tag.padEnd(4,' ');
   if(!cache.has(key)){const g=getters.get(key);cache.set(key,g?g():null);}
   return cache.get(key);
  };
  const need=tag=>table(tag)||fail(`Required '${tag}' table is missing`);
  this._table=table;
  this.container=container;
  const head=need('head'),hhea=need('hhea'),maxp=need('maxp');
  this.unitsPerEm=head.u16(18);
  if(this.unitsPerEm<1||this.unitsPerEm>16384)fail(`head.unitsPerEm ${this.unitsPerEm} is out of range`);
  this.numGlyphs=maxp.u16(4);
  if(!this.numGlyphs)fail('The font has no glyphs (maxp.numGlyphs is 0)');
  const hm=hhea.u16(34),hmtx=need('hmtx');
  if(!hm)fail('hhea.numberOfHMetrics is 0');
  const nhm=Math.min(hm,this.numGlyphs);
  if(hmtx.length<nhm*4)fail(`hmtx: ${nhm} metrics need ${nhm*4} bytes, the table has ${hmtx.length} — the font is truncated or corrupt`);
  const lsbCount=Math.max(0,Math.min(this.numGlyphs-nhm,(hmtx.length-nhm*4)>>1));
  this._hmtx={
   advance:g=>g>=0&&g<this.numGlyphs?hmtx.u16((g<nhm?g:nhm-1)*4):0,
   lsb:g=>g<nhm?hmtx.i16(g*4+2):g-nhm<lsbCount?hmtx.i16(nhm*4+(g-nhm)*2):0
  };
  const names=table('name')?readName(table('name')):new Map();
  this._names=names;
  const nm=id=>names.get(id)??'';
  this.family=nm(16)||nm(1);this.subfamily=nm(17)||nm(2);this.fullName=nm(4);this.postScriptName=nm(6);
  this.version=nm(5);this.licenseText=nm(13);this.licenseUrl=nm(14);this.copyright=nm(0);
  this.ascender=hhea.i16(4);this.descender=hhea.i16(6);this.lineGap=hhea.i16(8);
  const os2=table('OS/2');this.os2=null;
  if(os2&&os2.length>=78){
   this.os2={typoAscender:os2.i16(68),typoDescender:os2.i16(70),typoLineGap:os2.i16(72),winAscent:os2.u16(74),winDescent:os2.u16(76),
    xHeight:os2.u16(0)>=2&&os2.length>=90?os2.i16(86):null,capHeight:os2.u16(0)>=2&&os2.length>=90?os2.i16(88):null,
    fsSelection:os2.u16(62),weightClass:os2.u16(4),widthClass:os2.u16(6)};
   if(this.os2.fsSelection&0x80){this.ascender=this.os2.typoAscender;this.descender=this.os2.typoDescender;this.lineGap=this.os2.typoLineGap;}
  }
  const post=table('post');
  this.post=post&&post.length>=16?{italicAngle:post.fixed(4),underlinePosition:post.i16(8),underlineThickness:post.i16(10),isFixedPitch:post.u32(12)!==0}:null;
  const cmap=table('cmap');
  this._cmap=cmap?readCmap(cmap,this.numGlyphs):{glyphId:()=>0,codepoints:()=>[]};
  // outlines
  const glyf=table('glyf'),loca=table('loca'),cff=table('CFF '),cff2=table('CFF2');
  const bitmaps=!!(table('EBDT')||table('CBDT')||table('sbix'));
  this.outlines='none';this._glyf=null;this._cff=null;
  if(cff){this.outlines='cff';this._cff=makeCFF(cff,this.numGlyphs);}
  else if(glyf&&loca&&!(bitmaps&&glyf.length===0)){
   this.outlines='truetype';
   const longLoca=head.i16(50)===1;
   this._glyfArgs={loca,glyf,longLoca,numGlyphs:this.numGlyphs,hmtx:this._hmtx};
  }
  else if(cff2)fail('CFF2 outlines (variable OpenType/CFF2) are not supported: convert the font to TrueType (glyf) or static CFF first');
  this.bitmapOnly=this.outlines==='none'&&bitmaps;
  // variations
  const fvar=table('fvar');
  this.axes=[];this.instances=[];this._avar=null;
  if(fvar){
   const f=readFvar(fvar,names);
   this.axes=f.axes.map(({tag,min,default:d,max,name})=>({tag,min,default:d,max,name}));
   this._axes=f.axes;this.instances=f.instances;
   const avar=table('avar');if(avar)this._avar=readAvar(avar,f.axes.length);
  }
  if(this._glyfArgs){
   const gv=fvar&&table('gvar');
   this._glyf=makeGlyf({...this._glyfArgs,gvar:gv?readGvar(gv,this.axes.length,this.numGlyphs):null});
   delete this._glyfArgs;
  }
  this._hvar=undefined;this._kern=undefined;
  this._paths=new Map();
 }

 codepoints(){return this._cmap.codepoints();}
 glyphId(cp){return this._cmap.glyphId(cp);}
 hasGlyph(cp){return this._cmap.glyphId(cp)!==0;}

 /** {tag:userValue} → normalized coordinates (fvar + avar), one per axis in fvar order. */
 normalizeCoords(user={}){
  if(!this.axes.length)return new Float64Array(0);
  return normalize(this._axes,this._avar,user);
 }
 /** null for "default instance", else a normalized Float64Array. */
 _coords(coords){
  if(coords==null||!this.axes.length)return null;
  let n;
  if(Array.isArray(coords)||ArrayBuffer.isView(coords)){
   if(coords.length!==this.axes.length)fail(`Expected ${this.axes.length} normalized coordinates, got ${coords.length}`);
   n=Float64Array.from(coords,x=>Math.max(-1,Math.min(1,Number(x)||0)));
  }else n=this.normalizeCoords(coords);
  return n.some(x=>x!==0)?n:null;
 }
 _hvarTable(){
  if(this._hvar===undefined){
   const h=this._table('HVAR');this._hvar=null;
   if(h&&this.axes.length){
    const store=readItemVariationStore(h.sub(h.u32(4))),mapOff=h.u32(8);
    this._hvar={store,map:mapOff?readDeltaSetIndexMap(h.sub(mapOff)):g=>[0,g]};
   }
  }
  return this._hvar;
 }

 /** Advance width in font units (not rounded for variable instances). */
 advance(gid,coords=null){
  this._gid(gid);
  const base=this._hmtx.advance(gid),c=this._coords(coords);
  if(!c)return base;
  const hvar=this._hvarTable();
  if(hvar){const [o,i]=hvar.map(gid);return base+hvar.store.delta(o,i,c);}
  if(this._glyf){const p=this._glyf.points(gid,c,Array.prototype.join.call(c,','));return p.pp2x-p.pp1x;}
  return base;
 }

 /** {commands, bounds} in font units, y up, origin at the glyph origin. */
 glyphPath(gid,coords=null){
  this._gid(gid);
  if(this.outlines==='none')fail(this.bitmapOnly?'This font only contains embedded bitmaps (EBDT/CBDT/sbix): it has no outlines to render — use the bitmap font directly or pick an outline font':'This font has no outlines (no glyf or CFF table)');
  const c=this._coords(coords),key=c?Array.prototype.join.call(c,','):'';
  const ck=gid+'|'+key,hit=this._paths.get(ck);if(hit)return hit;
  let commands;
  if(this._cff)commands=this._cff.path(gid);
  else{
   const p=this._glyf.points(gid,c,key);
   let xy=p.xy;
   if(p.pp1x!==0){xy=Float64Array.from(xy);for(let i=0;i<xy.length;i+=2)xy[i]-=p.pp1x;}
   commands=contoursToCommands(xy,p.on,p.ends);
  }
  const out={commands,bounds:commandBounds(commands)};
  if(this._paths.size>8192)this._paths.clear();
  this._paths.set(ck,out);
  return out;
 }

 _kernData(){
  if(this._kern===undefined){
   this._kern=null;
   const gpos=this._table('GPOS');
   if(gpos){
    let store=null;const gdef=this._table('GDEF');
    if(gdef&&this.axes.length&&gdef.u16(2)>=3&&gdef.length>=18){const o=gdef.u32(14);if(o)store=readItemVariationStore(gdef.sub(o));}
    const g=readGposKern(gpos,store);
    if(g.has)this._kern={gpos:g.lookups};
   }
   if(!this._kern){const k=this._table('kern');const pairs=k?readKernTable(k):null;if(pairs&&pairs.size)this._kern={table:pairs};}
  }
  return this._kern;
 }
 /** Horizontal kerning between two glyphs in font units (0 when none). */
 kerning(left,right,coords=null){
  const k=this._kernData();if(!k)return 0;
  if(k.table)return k.table.get(left*65536+right)||0;
  return gposKern(k.gpos,left,right,this._coords(coords));
 }
 /** Every non-zero [left,right,value] among `gids`, sorted by left then right. */
 kerningPairs(gids,coords=null){
  const k=this._kernData();if(!k)return [];
  let map;
  if(k.table){
   const set=new Set(gids);map=new Map();
   for(const [key,v] of k.table)if(v&&set.has(Math.floor(key/65536))&&set.has(key%65536))map.set(key,v);
  }else map=gposPairs(k.gpos,gids,this.numGlyphs,this._coords(coords));
  const out=[];for(const [key,v] of map)if(v)out.push([Math.floor(key/65536),key%65536,v]);
  return out.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 }
 /** Name table string by id ('' when absent). */
 name(id){return this._names.get(id)??'';}
 _gid(gid){if(!Number.isInteger(gid)||gid<0||gid>=this.numGlyphs)fail(`Glyph ${gid} does not exist (the font has ${this.numGlyphs} glyphs)`);}
}
