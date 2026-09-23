/** Game-font files from one font model, and readers for the ones people already have.
 * Pure: model in, strings/bytes out. No DOM.
 *
 * FontModel (what the builder produces; every writer reads only this):
 *  {face, size,                     render size in px per em (BMFont `size`, msdf-atlas-gen `size`)
 *   type:'bitmap'|'sdf'|'psdf'|'msdf'|'mtsdf', distanceRange (px; 0 for bitmap),
 *   lineHeight, base,               px: line advance, and baseline distance from the line top
 *   ascender, descender, lineGap,   px (descender negative), from the font's own metrics
 *   unitsPerEm, underlineY, underlineThickness (em, optional),
 *   padding:[up,right,down,left], spacing:[x,y],
 *   pages:[{file, width, height}],  page images are written by the caller (PNG)
 *   glyphs:[{id (code point), page, x, y, w, h, xoffset, yoffset, xadvance,     BMFont numbers (px, ints)
 *            advance (em), plane:{left,bottom,right,top}|null (em, y up, quad of texel centres)}],
 *   kerning:[{first, second, amount (px int), em (float)}]}
 *
 * Distance fields follow the msdf-bmfont-xml convention engines read (Pixi 8, three-bmfont-text):
 * `distanceField fieldType=msdf distanceRange=4` in text, `<distanceField …/>` in XML. The binary
 * format has no place for it, so a binary .fnt is only written for bitmap fonts. */
export const TYPES=Object.freeze(['bitmap','sdf','psdf','msdf','mtsdf']);
const q=s=>`"${String(s).replace(/"/g,"'")}"`;
const xml=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/** BMFont channel flags: 0 glyph, 1 outline, 2 both, 3 zero, 4 one. A bitmap page is white with the
 * glyph in alpha; a distance field is data in the colour channels (and alpha for mtsdf / TMP sdf). */
export function channels(m){
 if(m.type==='bitmap')return {alphaChnl:0,redChnl:4,greenChnl:4,blueChnl:4};
 if(m.type==='mtsdf')return {alphaChnl:0,redChnl:0,greenChnl:0,blueChnl:0};
 return {alphaChnl:4,redChnl:0,greenChnl:0,blueChnl:0};
}
const check=m=>{
 if(!TYPES.includes(m.type))throw Error(`Unknown font type ${m.type}`);
 if(!m.pages?.length)throw Error('A font needs at least one page');
 for(const g of m.glyphs)if(!(g.page>=0&&g.page<m.pages.length))throw Error(`Glyph ${g.id} points at a missing page`);
};
export function fntText(m){
 check(m);const c=channels(m),p=m.padding||[0,0,0,0],s=m.spacing||[0,0];
 const lines=[
  `info face=${q(m.face)} size=${m.size} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=${m.type==='bitmap'&&m.smooth===false?0:1} aa=1 padding=${p.join(',')} spacing=${s.join(',')} outline=0`,
  `common lineHeight=${m.lineHeight} base=${m.base} scaleW=${m.pages[0].width} scaleH=${m.pages[0].height} pages=${m.pages.length} packed=0 alphaChnl=${c.alphaChnl} redChnl=${c.redChnl} greenChnl=${c.greenChnl} blueChnl=${c.blueChnl}`,
  ...m.pages.map((pg,i)=>`page id=${i} file=${q(pg.file)}`)];
 if(m.type!=='bitmap')lines.push(`distanceField fieldType=${m.type} distanceRange=${m.distanceRange}`);
 lines.push(`chars count=${m.glyphs.length}`);
 for(const g of m.glyphs)lines.push(`char id=${g.id} x=${g.x} y=${g.y} width=${g.w} height=${g.h} xoffset=${g.xoffset} yoffset=${g.yoffset} xadvance=${g.xadvance} page=${g.page} chnl=15`);
 const k=(m.kerning||[]).filter(e=>e.amount);// BMFont amounts are whole pixels; sub-pixel pairs live in the JSON
 lines.push(`kernings count=${k.length}`);
 for(const e of k)lines.push(`kerning first=${e.first} second=${e.second} amount=${e.amount}`);
 return lines.join('\n')+'\n';
}
export function fntXML(m){
 check(m);const c=channels(m),p=m.padding||[0,0,0,0],s=m.spacing||[0,0],k=(m.kerning||[]).filter(e=>e.amount);
 return ['<?xml version="1.0"?>','<font>',
  `  <info face="${xml(m.face)}" size="${m.size}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="${p.join(',')}" spacing="${s.join(',')}" outline="0"/>`,
  `  <common lineHeight="${m.lineHeight}" base="${m.base}" scaleW="${m.pages[0].width}" scaleH="${m.pages[0].height}" pages="${m.pages.length}" packed="0" alphaChnl="${c.alphaChnl}" redChnl="${c.redChnl}" greenChnl="${c.greenChnl}" blueChnl="${c.blueChnl}"/>`,
  '  <pages>',...m.pages.map((pg,i)=>`    <page id="${i}" file="${xml(pg.file)}"/>`),'  </pages>',
  ...(m.type!=='bitmap'?[`  <distanceField fieldType="${m.type}" distanceRange="${m.distanceRange}"/>`]:[]),
  `  <chars count="${m.glyphs.length}">`,
  ...m.glyphs.map(g=>`    <char id="${g.id}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" xoffset="${g.xoffset}" yoffset="${g.yoffset}" xadvance="${g.xadvance}" page="${g.page}" chnl="15"/>`),
  '  </chars>',
  `  <kernings count="${k.length}">`,...k.map(e=>`    <kerning first="${e.first}" second="${e.second}" amount="${e.amount}"/>`),'  </kernings>',
  '</font>',''].join('\n');
}
/** AngelCode BMFont binary, version 3 (little endian; blocks: 1 info, 2 common, 3 pages, 4 chars, 5 kerning). */
export function fntBinary(m){
 check(m);
 if(m.type!=='bitmap')throw Error('The binary .fnt format has no field for distance-field fonts; use the text or XML .fnt');
 const enc=new TextEncoder(),name=enc.encode(String(m.face)),names=m.pages.map(p=>enc.encode(p.file));
 if(names.some(n=>n.length!==names[0].length))throw Error('Binary .fnt pages must have file names of equal length');
 const k=(m.kerning||[]).filter(e=>e.amount),c=channels(m),p=m.padding||[0,0,0,0],s=m.spacing||[0,0];
 const sizes=[14+name.length+1,15,names.reduce((n,x)=>n+x.length+1,0),m.glyphs.length*20,k.length*10];
 const total=4+sizes.reduce((n,x,i)=>n+(i===4&&!k.length?0:5+x),0),out=new Uint8Array(total),v=new DataView(out.buffer);
 out.set([66,77,70,3]);let o=4;
 const block=(type,size)=>{v.setUint8(o,type);v.setInt32(o+1,size,true);o+=5;};
 const u8=x=>{v.setUint8(o,x);o+=1;},u16=x=>{v.setUint16(o,x,true);o+=2;},i16=x=>{v.setInt16(o,x,true);o+=2;},u32=x=>{v.setUint32(o,x,true);o+=4;};
 const fits=(x,lo,hi,what)=>{if(!(x>=lo&&x<=hi))throw Error(`${what} ${x} does not fit the binary .fnt format`);return x;};
 block(1,sizes[0]);i16(fits(m.size,-32768,32767,'size'));u8(0b11);u8(0);u16(100);u8(1);for(const x of p)u8(fits(x,0,255,'padding'));u8(fits(s[0],0,255,'spacing'));u8(fits(s[1],0,255,'spacing'));u8(0);out.set(name,o);o+=name.length+1;
 block(2,15);u16(fits(m.lineHeight,0,65535,'lineHeight'));u16(fits(m.base,0,65535,'base'));u16(m.pages[0].width);u16(m.pages[0].height);u16(m.pages.length);u8(0);u8(c.alphaChnl);u8(c.redChnl);u8(c.greenChnl);u8(c.blueChnl);
 block(3,sizes[2]);for(const n of names){out.set(n,o);o+=n.length+1;}
 block(4,sizes[3]);for(const g of m.glyphs){u32(g.id);u16(g.x);u16(g.y);u16(g.w);u16(g.h);i16(fits(g.xoffset,-32768,32767,'xoffset'));i16(fits(g.yoffset,-32768,32767,'yoffset'));i16(fits(g.xadvance,-32768,32767,'xadvance'));u8(g.page);u8(15);}
 if(k.length){block(5,sizes[4]);for(const e of k){u32(e.first);u32(e.second);i16(fits(e.amount,-32768,32767,'kerning'));}}
 return out;
}
/** msdf-atlas-gen JSON (its `-json` output layout). Plane and atlas bounds are the quad through the
 * outermost texel centres, as msdf-atlas-gen writes them (half a texel inside the glyph box).
 * A multi-page font adds `atlas.pages` and a per-glyph `page` (msdf-atlas-gen itself writes one page). */
export function msdfAtlasJSON(m,{yOrigin='bottom'}={}){
 check(m);
 const pg=m.pages[0],H=pg.height,multi=m.pages.length>1;
 const r=v=>Math.round(v*1e6)/1e6;
 const glyphs=m.glyphs.map(g=>{
  const o={unicode:g.id,advance:r(g.advance)};
  if(g.plane&&g.w>0&&g.h>0){
   o.planeBounds={left:r(g.plane.left),bottom:r(g.plane.bottom),right:r(g.plane.right),top:r(g.plane.top)};
   const l=g.x+.5,rt=g.x+g.w-.5,top=g.y+.5,bot=g.y+g.h-.5;
   o.atlasBounds=yOrigin==='top'?{left:l,bottom:bot,right:rt,top}:{left:l,bottom:H-bot,right:rt,top:H-top};
  }
  if(multi)o.page=g.page;
  return o;
 });
 const em=m.size;
 return {atlas:{type:m.type==='bitmap'?'softmask':m.type,distanceRange:m.type==='bitmap'?0:m.distanceRange,distanceRangeMiddle:0,size:em,width:pg.width,height:pg.height,yOrigin,...(multi?{pages:m.pages.length,files:m.pages.map(p=>p.file)}:{})},
  name:m.face,
  metrics:{emSize:1,lineHeight:r(m.lineHeight/em),ascender:r(m.ascender/em),descender:r(m.descender/em),underlineY:r(m.underlineY??-.1),underlineThickness:r(m.underlineThickness??.05)},
  glyphs,
  kerning:(m.kerning||[]).map(e=>({unicode1:e.first,unicode2:e.second,advance:r(e.em??e.amount/em)}))};
}
// ------------------------------------------------------------------ readers
/** Any BMFont (.fnt text, XML or binary) → {info, common, pages[], chars[], kernings[], distanceField|null}
 * with the text format's field names (id, x, y, width, height, xoffset, yoffset, xadvance, page). */
export function parseBMFont(input){
 const bytes=typeof input==='string'?null:input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes&&bytes[0]===66&&bytes[1]===77&&bytes[2]===70)return parseBinary(bytes);
 const text=typeof input==='string'?input:new TextDecoder().decode(bytes);
 return /^\s*(<\?xml|<font[\s>])/.test(text)?parseXML(text):parseTextFnt(text);
}
function fieldsOf(s){
 const f={};
 for(const m of s.matchAll(/([A-Za-z]+)=("([^"]*)"|[^\s"]+)/g)){
  const v=m[3]??m[2];
  f[m[1]]=m[3]!=null&&!/^(padding|spacing)$/.test(m[1])?v:v.includes(',')?v.split(',').map(Number):Number.isNaN(Number(v))?v:Number(v);
 }
 return f;
}
function parseTextFnt(text){
 const out={info:{},common:{},pages:[],chars:[],kernings:[],distanceField:null};
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;const tag=line.split(/\s+/,1)[0],f=fieldsOf(line.slice(tag.length));
  if(tag==='info')out.info=f;else if(tag==='common')out.common=f;else if(tag==='page')out.pages[f.id||0]=f.file;
  else if(tag==='char')out.chars.push(f);else if(tag==='kerning')out.kernings.push(f);else if(tag==='distanceField')out.distanceField=f;
 }
 if(!out.chars.length)throw Error('This .fnt file has no char records');
 return out;
}
function parseXML(text){
 const out={info:{},common:{},pages:[],chars:[],kernings:[],distanceField:null};
 const unx=s=>s.replace(/&(amp|lt|gt|quot|apos);/g,(m,e)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e]));
 for(const m of text.matchAll(/<(info|common|page|char|kerning|distanceField)\b([^>]*?)\/?>/g)){
  const f={};for(const a of m[2].matchAll(/([A-Za-z]+)="([^"]*)"/g)){const v=unx(a[2]);f[a[1]]=/^(face|charset|file|fieldType)$/.test(a[1])?v:v.includes(',')?v.split(',').map(Number):Number.isNaN(Number(v))?v:Number(v);}
  if(m[1]==='info')out.info=f;else if(m[1]==='common')out.common=f;else if(m[1]==='page')out.pages[f.id||0]=f.file;
  else if(m[1]==='char')out.chars.push(f);else if(m[1]==='kerning')out.kernings.push(f);else out.distanceField=f;
 }
 if(!out.chars.length)throw Error('This XML .fnt file has no char records');
 return out;
}
function parseBinary(b){
 if(b[3]!==3)throw Error(`Binary .fnt version ${b[3]} is not supported (version 3 is)`);
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),out={info:{},common:{},pages:[],chars:[],kernings:[],distanceField:null};
 const cstr=(o,end)=>{let e=o;while(e<end&&b[e])e++;return [new TextDecoder().decode(b.subarray(o,e)),e+1];};
 let o=4;
 while(o+5<=b.length){
  const type=b[o],size=v.getInt32(o+1,true);o+=5;const end=o+size;if(size<0||end>b.length)throw Error('Truncated binary .fnt');
  if(type===1){out.info={size:v.getInt16(o,true),smooth:b[o+2]&1,unicode:b[o+2]>>1&1,italic:b[o+2]>>2&1,bold:b[o+2]>>3&1,stretchH:v.getUint16(o+4,true),aa:b[o+6],padding:[b[o+7],b[o+8],b[o+9],b[o+10]],spacing:[b[o+11],b[o+12]],outline:b[o+13],face:cstr(o+14,end)[0]};}
  else if(type===2)out.common={lineHeight:v.getUint16(o,true),base:v.getUint16(o+2,true),scaleW:v.getUint16(o+4,true),scaleH:v.getUint16(o+6,true),pages:v.getUint16(o+8,true),packed:b[o+10]>>7&1,alphaChnl:b[o+11],redChnl:b[o+12],greenChnl:b[o+13],blueChnl:b[o+14]};
  else if(type===3){let p=o;while(p<end){const [s,n]=cstr(p,end);out.pages.push(s);p=n;}}
  else if(type===4)for(let p=o;p+20<=end;p+=20)out.chars.push({id:v.getUint32(p,true),x:v.getUint16(p+4,true),y:v.getUint16(p+6,true),width:v.getUint16(p+8,true),height:v.getUint16(p+10,true),xoffset:v.getInt16(p+12,true),yoffset:v.getInt16(p+14,true),xadvance:v.getInt16(p+16,true),page:b[p+18],chnl:b[p+19]});
  else if(type===5)for(let p=o;p+10<=end;p+=10)out.kernings.push({first:v.getUint32(p,true),second:v.getUint32(p+4,true),amount:v.getInt16(p+8,true)});
  o=end;
 }
 if(!out.chars.length)throw Error('This binary .fnt file has no char records');
 return out;
}
/** A parsed BMFont back into a font model (pages without pixels: the caller loads the PNGs). */
export function modelFromBMFont(p){
 const df=p.distanceField,type=df&&TYPES.includes(df.fieldType)?df.fieldType:'bitmap';
 const size=Math.abs(p.info.size||p.common.lineHeight||0)||1;
 return {face:p.info.face||'font',size,type,distanceRange:type==='bitmap'?0:Number(df.distanceRange)||0,
  lineHeight:p.common.lineHeight||0,base:p.common.base||0,ascender:p.common.base||0,descender:(p.common.base||0)-(p.common.lineHeight||0),lineGap:0,
  padding:Array.isArray(p.info.padding)?p.info.padding:[0,0,0,0],spacing:Array.isArray(p.info.spacing)?p.info.spacing:[0,0],
  pages:p.pages.map(f=>({file:f,width:p.common.scaleW||0,height:p.common.scaleH||0})),
  glyphs:p.chars.map(c=>({id:c.id,page:c.page||0,x:c.x,y:c.y,w:c.width,h:c.height,xoffset:c.xoffset,yoffset:c.yoffset,xadvance:c.xadvance,advance:c.xadvance/size,plane:null})),
  kerning:p.kernings.map(k=>({first:k.first,second:k.second,amount:k.amount,em:k.amount/size}))};
}
/** Pen positions for one line, the way a BMFont renderer places glyphs (kerning included). */
export function layoutText(m,text,{kerning=true}={}){
 const by=new Map(m.glyphs.map(g=>[g.id,g])),kern=new Map();
 if(kerning)for(const k of m.kerning||[])kern.set(k.first*0x110000+k.second,k.amount);
 const items=[];let x=0,y=0,prev=null,width=0;
 for(const ch of String(text)){
  const c=ch.codePointAt(0);
  if(c===10){width=Math.max(width,x);x=0;y+=m.lineHeight;prev=null;continue;}
  const g=by.get(c);
  if(!g){items.push({id:c,missing:true,x,y});prev=null;continue;}
  if(prev!=null)x+=kern.get(prev*0x110000+c)||0;
  items.push({id:c,glyph:g,x:x+g.xoffset,y:y+g.yoffset});
  x+=g.xadvance;prev=c;
 }
 return {items,width:Math.max(width,x),height:y+m.lineHeight};
}
