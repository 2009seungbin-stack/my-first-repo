import {FORMAT as FONT_FORMAT} from './bmfont.js';
import {validateHangulTemplates,missingHangulTemplates,composeHangulMask} from './font-hangul-compose.js';

export const PROJECT_FORMAT='nerulio-bitmap-font-project-v2';
const cp=ch=>ch.codePointAt(0);
const validInt=(n,lo,hi,label)=>{if(!Number.isInteger(n)||n<lo||n>hi)throw Error(`Invalid ${label}`);return n;};
const glyph=(codepoint,w,h,xOffset=0,yOffset=0,xAdvance=w,pixels=null)=>({
 codepoint:validInt(codepoint,0,0x10ffff,'code point'),w:validInt(w,0,512,'glyph width'),h:validInt(h,0,512,'glyph height'),
 xOffset:validInt(xOffset,-4096,4096,'left bearing'),yOffset:validInt(yOffset,-4096,4096,'top bearing'),
 xAdvance:validInt(xAdvance,0,4096,'advance'),pixels:pixels?Array.from(pixels):Array(w*h).fill(0)
});
export function blankFontProject(chars='ABCDEFGH',{cellW=8,cellH=8,baseline=7,face='Nerulio Pixel'}={}){
 validInt(cellW,1,128,'cell width');validInt(cellH,1,128,'cell height');validInt(baseline,0,cellH,'baseline');
 const unique=[...new Set([...chars].map(cp))];if(!unique.length||unique.length>1024)throw Error('Choose 1–1024 characters to draw');
 return {format:PROJECT_FORMAT,face,ascent:baseline,descent:cellH-baseline,lineHeight:cellH,
  glyphs:unique.map(code=>glyph(code,cellW,cellH,0,0,cellW)),kernings:[]};
}
export function projectFromGrid(data,width,height,{cellW,cellH,chars,baseline=cellH,threshold=8,face='Nerulio Pixel'}={}){
 if(data.length!==width*height*4)throw Error('Invalid RGBA sheet');
 const project=blankFontProject(chars,{cellW,cellH,baseline,face}),columns=Math.floor(width/cellW),rows=Math.floor(height/cellH);
 if(project.glyphs.length>columns*rows)throw Error('Character order exceeds sheet cells');
 project.glyphs.forEach((g,i)=>{const sx=i%columns*cellW,sy=Math.floor(i/columns)*cellH;
  for(let y=0;y<cellH;y++)for(let x=0;x<cellW;x++)g.pixels[y*cellW+x]=data[((sy+y)*width+sx+x)*4+3]>threshold?1:0;
 });
 return project;
}
/** Copy a v1 grid/measured/font-file atlas into editable glyphs without changing source bytes. */
export function projectFromAtlas(data,font,{threshold=8}={}){
 if(!font?.glyphs?.length||data.length!==font.width*font.height*4)throw Error('Invalid font atlas');
 const ascent=validInt(font.baseline,0,4096,'baseline'),lineHeight=validInt(font.lineHeight,1,4096,'line height');
 if(ascent>lineHeight)throw Error('Baseline exceeds line height');
 const project={format:PROJECT_FORMAT,face:String(font.face||'Nerulio Pixel'),ascent,descent:lineHeight-ascent,lineHeight,glyphs:[],kernings:(font.kernings||[]).map(k=>({...k}))};
 for(const source of font.glyphs){
  const {x,y,w,h}=source;
  if(![x,y,w,h].every(Number.isInteger)||x<0||y<0||x+w>font.width||y+h>font.height)throw Error('Glyph rectangle outside atlas');
  const pixels=[];for(let row=0;row<h;row++)for(let column=0;column<w;column++)pixels.push(data[((y+row)*font.width+x+column)*4+3]>threshold?1:0);
  project.glyphs.push(glyph(source.codepoint,w,h,source.xOffset,source.yOffset,source.xAdvance,pixels));
 }
 return validateFontProject(project);
}
export function projectFromBdf(bdf){
 if(!bdf?.glyphs?.length)throw Error('BDF has no encoded glyphs');
 return {format:PROJECT_FORMAT,face:bdf.face,ascent:bdf.ascent,descent:bdf.descent,lineHeight:bdf.lineHeight,
  glyphs:bdf.glyphs.map(g=>glyph(g.codepoint,g.w,g.h,g.xOffset,g.yOffset,g.xAdvance,g.mask)),kernings:[]};
}
export function validateFontProject(project){
 if(project?.format!==PROJECT_FORMAT||!Array.isArray(project.glyphs)||!project.glyphs.length)throw Error('Invalid font project');
 validInt(project.ascent,0,4096,'ascent');validInt(project.descent,0,4096,'descent');
 validInt(project.lineHeight,1,4096,'line height');
 if(project.hangulTemplates)validateHangulTemplates(project.hangulTemplates);
 if(project.glyphs.length>12000)throw Error('Glyph count exceeds project limit');
 const seen=new Set();for(const g of project.glyphs){
  glyph(g.codepoint,g.w,g.h,g.xOffset,g.yOffset,g.xAdvance);
  if(g.pixels?.length!==g.w*g.h||g.pixels.some(v=>v!==0&&v!==1))throw Error('Invalid glyph pixels');
  if(seen.has(g.codepoint))throw Error('Duplicate character');seen.add(g.codepoint);
 }
 for(const k of project.kernings||[]){validInt(k.first,0,0x10ffff,'kerning first');validInt(k.second,0,0x10ffff,'kerning second');validInt(k.amount,-32768,32767,'kerning amount');}
 return project;
}
export function setGlyphPixel(project,codepoint,x,y,ink){
 const g=project.glyphs.find(item=>item.codepoint===codepoint);if(!g)throw Error('Glyph not in project');
 validInt(x,0,g.w-1,'pixel x');validInt(y,0,g.h-1,'pixel y');
 g.pixels[y*g.w+x]=ink?1:0;return project;
}
export function addGlyph(project,codepoint,{w=8,h=8,xAdvance=w}={}){
 validInt(codepoint,0,0x10ffff,'code point');
 if(codepoint>=0xd800&&codepoint<=0xdfff)throw Error('A surrogate is not a Unicode character');
 if(project.glyphs.length>=1024)throw Error('Editable glyph limit is 1,024; large sets require a separately verified export');
 if(project.glyphs.some(g=>g.codepoint===codepoint))throw Error('Character already exists in this project');
 project.glyphs.push(glyph(codepoint,w,h,0,0,xAdvance));return project;
}
export function applyHangulComposition(project,codepoint){
 const templates=project.hangulTemplates;
 if(!templates||missingHangulTemplates(templates,codepoint).length)throw Error('Hangul component masks are incomplete');
 const made=composeHangulMask(codepoint,templates);
 let target=project.glyphs.find(g=>g.codepoint===codepoint);
 if(!target){addGlyph(project,codepoint,{w:made.width,h:made.height,xAdvance:made.width});target=project.glyphs.at(-1);}
 target.w=made.width;target.h=made.height;target.pixels=made.pixels;
 target.xOffset=0;target.yOffset=0;target.xAdvance=made.width;
 return made;
}
export function resizeGlyph(project,codepoint,width,height){
 const g=project.glyphs.find(item=>item.codepoint===codepoint);if(!g)throw Error('Glyph not in project');
 validInt(width,1,128,'glyph width');validInt(height,1,128,'glyph height');
 const pixels=Array(width*height).fill(0);
 for(let y=0;y<Math.min(g.h,height);y++)for(let x=0;x<Math.min(g.w,width);x++)pixels[y*width+x]=g.pixels[y*g.w+x];
 g.w=width;g.h=height;g.pixels=pixels;return project;
}
export function fillGlyph(project,codepoint,x,y,ink){
 const g=project.glyphs.find(item=>item.codepoint===codepoint);if(!g)throw Error('Glyph not in project');
 validInt(x,0,g.w-1,'pixel x');validInt(y,0,g.h-1,'pixel y');
 const next=ink?1:0,old=g.pixels[y*g.w+x];if(old===next)return project;
 const seen=new Uint8Array(g.w*g.h),queue=[y*g.w+x];seen[queue[0]]=1;
 for(let head=0;head<queue.length;head++){
  const at=queue[head],cx=at%g.w,cy=Math.floor(at/g.w);
  if(g.pixels[at]!==old)continue;g.pixels[at]=next;
  for(const [nx,ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]])if(nx>=0&&nx<g.w&&ny>=0&&ny<g.h){
   const ni=ny*g.w+nx;if(!seen[ni]){seen[ni]=1;queue.push(ni);}
  }
 }
 return project;
}
export function rectangleGlyph(project,codepoint,x0,y0,x1,y1,ink){
 const g=project.glyphs.find(item=>item.codepoint===codepoint);if(!g)throw Error('Glyph not in project');
 for(const [value,limit,label] of [[x0,g.w-1,'x0'],[x1,g.w-1,'x1'],[y0,g.h-1,'y0'],[y1,g.h-1,'y1']])validInt(value,0,limit,label);
 for(let y=Math.min(y0,y1);y<=Math.max(y0,y1);y++)for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x++)
  g.pixels[y*g.w+x]=ink?1:0;
 return project;
}
export function setKerning(project,first,second,amount){
 validInt(amount,-32768,32767,'kerning amount');
 const keys=new Set(project.glyphs.map(g=>g.codepoint));if(!keys.has(first)||!keys.has(second))throw Error('Kerning characters must be in this font');
 const i=project.kernings.findIndex(k=>k.first===first&&k.second===second);
 if(i>=0)project.kernings.splice(i,1);if(amount)project.kernings.push({first,second,amount});
 project.kernings.sort((a,b)=>a.first-b.first||a.second-b.second);return project;
}
/** One-page RGBA atlas and v1-compatible metric fields, with v2 kerning data. */
export function renderFontProject(project,{maxSide=4096,maxPixels=16_777_216}={}){
 validateFontProject(project);
 const list=project.glyphs,cellW=Math.max(1,...list.map(g=>g.w)),cellH=Math.max(1,...list.map(g=>g.h));
 const columns=Math.max(1,Math.min(list.length,Math.floor(maxSide/cellW),Math.ceil(Math.sqrt(list.length*cellH/cellW))));
 const rows=Math.ceil(list.length/columns),width=columns*cellW,height=rows*cellH;
 if(width>maxSide||height>maxSide||width*height>maxPixels)throw Error(`Font atlas needs ${width}×${height} pixels; choose fewer glyphs or smaller cells`);
 const data=new Uint8ClampedArray(width*height*4),metrics=[];
 list.forEach((g,i)=>{const ox=i%columns*cellW,oy=Math.floor(i/columns)*cellH;
  for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++)if(g.pixels[y*g.w+x]){
   const at=((oy+y)*width+ox+x)*4;data[at]=data[at+1]=data[at+2]=data[at+3]=255;
  }
  metrics.push({char:String.fromCodePoint(g.codepoint),codepoint:g.codepoint,x:ox,y:oy,w:g.w,h:g.h,xOffset:g.xOffset,yOffset:g.yOffset,xAdvance:g.xAdvance});
 });
 return {data,width,height,font:{format:FONT_FORMAT,mode:'draw',face:project.face,size:project.lineHeight,image:'font.png',width,height,
  lineHeight:project.lineHeight,baseline:project.ascent,spacing:0,glyphs:metrics,kernings:project.kernings.map(k=>({...k}))}};
}
