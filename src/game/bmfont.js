/** Bitmap fonts: character sets, glyph metrics measured from alpha, the BMFont text format
 * (written and read back), and the missing-glyph comparison. Pure; no DOM, no canvas.
 *
 * One font object feeds every output, so font.json, font.fnt and the checker can never
 * disagree: {format, face, size, lineHeight, baseline, image, width, height, mode,
 *            glyphs:[{char,codepoint,x,y,w,h,xOffset,yOffset,xAdvance}]}
 * x/y/w/h are atlas pixels, origin top-left. xOffset/yOffset place the glyph relative to the
 * pen position and the line top, exactly as BMFont's xoffset/yoffset do. */
export const FORMAT='nerulio-bitmap-font-v1';
const cp=c=>c.codePointAt(0);
const range=(a,b)=>{const out=[];for(let i=a;i<=b;i++)out.push(String.fromCodePoint(i));return out;};
/** Script ranges used to pick "the characters this text actually uses". Deliberately never
 * enumerated as a preset: a full Hangul set is 11,172 glyphs and nobody wants that atlas. */
export const SCRIPTS=Object.freeze({
 latin:[[0x20,0x7e],[0xa0,0xff]],
 ko:[[0x1100,0x11ff],[0x3130,0x318f],[0xac00,0xd7a3]],
 ja:[[0x3000,0x303f],[0x3040,0x309f],[0x30a0,0x30ff],[0x31f0,0x31ff],[0x4e00,0x9fff],[0xff00,0xff9f]]
});
export const PRESETS=Object.freeze(['text','ascii','latin1','ko','ja']);
const inScript=(code,name)=>SCRIPTS[name].some(([a,b])=>code>=a&&code<=b);
/** Unique characters for a preset. 'text', 'ko' and 'ja' read the pasted text (filtered to the
 * script for the last two); 'ascii' and 'latin1' are the two fixed sets small enough to ship. */
export function charset(text='',preset='text'){
 if(!PRESETS.includes(preset))throw Error('Unknown character-set preset');
 if(preset==='ascii')return range(0x20,0x7e);
 if(preset==='latin1')return [...range(0x20,0x7e),...range(0xa0,0xff)];
 const seen=new Set();
 for(const ch of String(text)){
  const code=cp(ch);
  if(code<0x20&&code!==0x09||code===0x7f||ch==='\n'||ch==='\r')continue;
  if(preset!=='text'&&!inScript(code,preset))continue;
  seen.add(ch);
 }
 return [...seen].sort((a,b)=>cp(a)-cp(b));
}
/** Where each character is used: count plus the first few 1-based line numbers. */
export function occurrences(text){
 const map=new Map(),lines=String(text).split(/\r\n|\r|\n/);
 lines.forEach((line,i)=>{for(const ch of line){let e=map.get(ch);if(!e)map.set(ch,e={char:ch,codepoint:cp(ch),count:0,lines:[]});e.count++;if(e.lines.length<5&&e.lines.at(-1)!==i+1)e.lines.push(i+1);}});
 return map;
}
/** Characters the font has no glyph for, most used first. Whitespace and line breaks are not
 * glyphs a font must draw, so they are reported separately from real gaps. */
export function missingCharacters(text,codepoints,{skipSpaces=true}={}){
 const have=codepoints instanceof Set?codepoints:new Set(codepoints);
 const out=[];
 for(const entry of occurrences(text).values()){
  if(have.has(entry.codepoint))continue;
  if(skipSpaces&&/^\s$/.test(entry.char))continue;
  out.push(entry);
 }
 return out.sort((a,b)=>b.count-a.count||a.codepoint-b.codepoint);
}
/** Localisation files carry the strings inside a structure; this pulls the human text out so
 * the checker compares glyphs, not syntax. */
export function extractText(name,content){
 const ext=/\.([a-z0-9]+)$/i.exec(String(name||''))?.[1]?.toLowerCase()||'';
 const text=String(content);
 if(ext==='json'){
  const out=[],walk=v=>{if(typeof v==='string')out.push(v);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
  try{walk(JSON.parse(text));}catch{throw Error('This JSON file could not be parsed');}
  return out.join('\n');
 }
 if(ext==='po'){
  // msgstr "…" plus its continuation lines; msgid is the source key, not shipped text.
  const out=[];let take=false;
  for(const line of text.split(/\r?\n/)){
   const m=/^\s*(msgstr(?:\[\d+\])?|msgid|msgctxt)?\s*"((?:\\.|[^"\\])*)"\s*$/.exec(line);
   if(!m){take=false;continue;}
   if(m[1])take=m[1].startsWith('msgstr');
   if(take)out.push(m[2].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\'));
  }
  return out.join('\n');
 }
 if(ext==='csv'||ext==='tsv'){
  const sep=ext==='tsv'?'\t':',';
  return text.split(/\r?\n/).map(line=>{
   const cells=[];let cell='',quoted=false;
   for(let i=0;i<line.length;i++){
    const c=line[i];
    if(quoted){if(c==='"'&&line[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"')quoted=true;else if(c===sep){cells.push(cell);cell='';}else cell+=c;
   }
   cells.push(cell);return cells.join(' ');
  }).join('\n');
 }
 return text;
}
/** Opaque bounds of one cell, in image coordinates, or null when the cell is empty. */
export function glyphBounds(data,w,h,cell,threshold=8){
 if(data.length!==w*h*4)throw Error('Invalid RGBA data');
 let x0=cell.x+cell.w,y0=cell.y+cell.h,x1=-1,y1=-1;
 for(let y=cell.y;y<cell.y+cell.h;y++)for(let x=cell.x;x<cell.x+cell.w;x++){
  if(data[(y*w+x)*4+3]<=threshold)continue;
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
 }
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
/** Fixed-cell font: every glyph is its whole cell and every advance is the cell width. This is
 * the original bitmap-font behaviour and stays byte-for-byte compatible with it. */
export function gridFont({width,height,cellW,cellH,chars,baseline,image='font.png',face='Nerulio Grid',spacing=0}){
 const list=Array.from(chars||'');
 if(!Number.isSafeInteger(cellW)||!Number.isSafeInteger(cellH)||cellW<1||cellH<1)throw Error('Invalid cell size');
 // Real font sheets often end in a strip narrower than a cell (a 128px sheet of 18 7px glyphs);
 // that strip is not a glyph, so the grid is whole cells from the top-left and the rest is ignored.
 if(cellW>width||cellH>height)throw Error('The cell is larger than the sheet');
 const columns=Math.floor(width/cellW),cells=columns*Math.floor(height/cellH);
 if(!list.length||list.length>cells||new Set(list).size!==list.length)throw Error('Character order must be nonempty, unique, and fit the grid');
 const base=baseline??cellH;
 if(!Number.isInteger(base)||base<0||base>cellH)throw Error('Invalid baseline');
 return {format:FORMAT,mode:'grid',face,size:cellH,image,width,height,lineHeight:cellH,baseline:base,spacing,
  glyphs:list.map((char,i)=>({char,codepoint:cp(char),x:i%columns*cellW,y:Math.floor(i/columns)*cellH,w:cellW,h:cellH,xOffset:0,yOffset:0,xAdvance:cellW}))};
}
/** Proportional font from the same grid: each glyph keeps only its opaque pixels, so the
 * advance is the measured ink width plus spacing and the offsets put the ink back where it was.
 * `advances` (char → px) overrides that when the real advance is known, which it is for a glyph
 * rendered from a TTF: a space has no ink but still moves the pen.
 * There is no kerning: BMFont kerning pairs need font-level data a bitmap sheet does not carry. */
export function measuredFont({data,width,height,cellW,cellH,chars,baseline,image='font.png',face='Nerulio Measured',spacing=1,threshold=8,spaceAdvance=null,advances=null}){
 const grid=gridFont({width,height,cellW,cellH,chars,baseline,image,face,spacing});
 const known=char=>advances?.has?.(char)?Math.max(0,Math.round(advances.get(char)+spacing)):null;
 const glyphs=grid.glyphs.map(g=>{
  const b=glyphBounds(data,width,height,{x:g.x,y:g.y,w:cellW,h:cellH},threshold);
  if(!b)return {...g,w:0,h:0,xOffset:0,yOffset:0,xAdvance:known(g.char)??Math.max(1,spaceAdvance??Math.round(cellW/3))};
  return {char:g.char,codepoint:g.codepoint,x:b.x,y:b.y,w:b.w,h:b.h,xOffset:b.x-g.x,yOffset:b.y-g.y,xAdvance:known(g.char)??b.x-g.x+b.w+spacing};
 });
 return {...grid,mode:'measured',glyphs};
}
const quote=s=>`"${String(s).replace(/["\\]/g,'')}"`;
/** BMFont text format (documented and plain text), one line per record. */
export function fntText(font){
 const g=font.glyphs;
 return [`info face=${quote(font.face)} size=${font.size} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=${font.spacing||0},${font.spacing||0} outline=0`,
  `common lineHeight=${font.lineHeight} base=${font.baseline} scaleW=${font.width} scaleH=${font.height} pages=1 packed=0 alphaChnl=0 redChnl=0 greenChnl=0 blueChnl=0`,
  `page id=0 file=${quote(font.image)}`,
  `chars count=${g.length}`,
  ...g.map(c=>`char id=${c.codepoint} x=${c.x} y=${c.y} width=${c.w} height=${c.h} xoffset=${c.xOffset} yoffset=${c.yOffset} xadvance=${c.xAdvance} page=0 chnl=15`),
  'kernings count=0',''].join('\n');
}
/** Reads the format back. Used by the missing-glyph checker on a .fnt the user already has,
 * and by the tests to prove the writer and the reader agree. */
export function parseFnt(text){
 const out={info:{},common:{},pages:[],chars:[],kernings:[]};
 for(const raw of String(text).split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const tag=line.split(/\s+/,1)[0],fields={};
  for(const m of line.slice(tag.length).matchAll(/([a-zA-Z]+)=("(?:[^"]*)"|[-\d,]+|[^\s]+)/g)){
   const key=m[1];let value=m[2];
   if(value.startsWith('"'))fields[key]=value.slice(1,-1);
   else if(value.includes(','))fields[key]=value.split(',').map(Number);
   else fields[key]=Number.isNaN(Number(value))?value:Number(value);
  }
  if(tag==='info')out.info=fields;
  else if(tag==='common')out.common=fields;
  else if(tag==='page')out.pages[fields.id||0]=fields.file;
  else if(tag==='char')out.chars.push(fields);
  else if(tag==='kerning')out.kernings.push(fields);
 }
 if(!out.chars.length)throw Error('This .fnt file has no char records');
 return out;
}
/** Every codepoint a .fnt provides a glyph for. */
export const fntCodepoints=parsed=>new Set(parsed.chars.map(c=>c.id));
/** Font object from a parsed .fnt, so an imported font previews like a generated one. */
export function fontFromFnt(parsed,{image=''}={}){
 return {format:FORMAT,mode:'imported',face:parsed.info.face||'imported',size:parsed.info.size||parsed.common.lineHeight||0,
  image:image||parsed.pages[0]||'',width:parsed.common.scaleW||0,height:parsed.common.scaleH||0,
  lineHeight:parsed.common.lineHeight||0,baseline:parsed.common.base||0,spacing:Array.isArray(parsed.info.spacing)?parsed.info.spacing[0]:0,
  glyphs:parsed.chars.map(c=>({char:String.fromCodePoint(c.id),codepoint:c.id,x:c.x,y:c.y,w:c.width,h:c.height,xOffset:c.xoffset,yOffset:c.yoffset,xAdvance:c.xadvance}))};
}
/** Pen positions for one line of text, using only the font's own metrics. */
export function layoutLine(font,text){
 const by=new Map(font.glyphs.map(g=>[g.codepoint,g]));
 let pen=0;const out=[];
 for(const ch of String(text)){
  const g=by.get(cp(ch));
  if(!g){out.push({char:ch,missing:true,x:pen});continue;}
  out.push({char:ch,glyph:g,x:pen+g.xOffset,y:g.yOffset});
  pen+=g.xAdvance;
 }
 return {items:out,width:pen};
}
