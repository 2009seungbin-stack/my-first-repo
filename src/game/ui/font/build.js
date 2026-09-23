/** Builds a game font (bitmap or distance field) from an outline font or from a glyph-sheet image.
 * Pure and deterministic: the same font bytes + settings give the same pages and numbers. Runs in
 * the font worker (src/studio/workspaces/ui/font-worker.js) and in Node tests.
 *
 *   renderGlyphs(font, codepoints, settings)  → rendered glyphs (one per code point the font has)
 *   packGlyphs(glyphs, settings)              → pages + placements, most-used glyphs on page 0
 *   assemble(font, glyphs, packed, settings)  → FontModel (src/game/ui/font/formats.js) + page pixels
 *   gridFontModel(image, grid, settings)      → FontModel from a pixel-font sheet
 *
 * Metrics, in atlas pixels at `size` px per em: base = round(ascender·s), lineHeight =
 * round((ascender − descender + lineGap)·s); a glyph box is the outline's bounds widened by the
 * padding (half the distance range for a field) and rounded OUT to whole pixels, so an outline
 * drawn on the font's pixel grid (a pixel font at a native size) lands on whole pixels and stays
 * crisp. BMFont xoffset/yoffset place that box relative to the pen and the line top. */
import {shapeFromCommands} from './shape.js';
import {rasterize} from './raster.js';
import {generateSDF,generatePSDF,generateMSDF,generateMTSDF,encodeField,edgeColoringSimple} from './msdf.js';
import {layoutPages} from '../../pack/layout.js';
import {MaxRectsBin} from '../../pack/bins.js';
export const RENDER_MODES=Object.freeze(['bitmap','mono','sdf','psdf','msdf','mtsdf']);
export const DEFAULT_FONT_SETTINGS=Object.freeze({
 mode:'bitmap',size:32,range:4,padding:1,spacing:2,threshold:.5,
 pageWidth:1024,pageHeight:1024,sizeMode:'pot',maxPages:32,kerning:true,coords:null,alphaOnly:false,
 order:'frequency',file:'font'});
export function normalizeFontSettings(s={}){
 const o={...DEFAULT_FONT_SETTINGS,...s};
 if(!RENDER_MODES.includes(o.mode))throw Error(`Unknown render mode ${o.mode}`);
 const int=(v,lo,hi,name)=>{v=Math.round(Number(v));if(!(v>=lo&&v<=hi))throw Error(`${name} must be ${lo}–${hi}`);return v;};
 o.size=int(o.size,4,512,'Size');o.padding=int(o.padding,0,64,'Padding');o.spacing=int(o.spacing,0,64,'Spacing');
 o.pageWidth=int(o.pageWidth,32,8192,'Page width');o.pageHeight=int(o.pageHeight,32,8192,'Page height');o.maxPages=int(o.maxPages,1,256,'Max pages');
 o.range=Number(o.range);if(!(o.range>=1&&o.range<=64))throw Error('Distance range must be 1–64 px');
 o.threshold=Math.min(1,Math.max(0,Number(o.threshold)||.5));
 if(!['pot','fixed','auto'].includes(o.sizeMode))throw Error(`Unknown page size mode ${o.sizeMode}`);
 return o;
}
export const isField=mode=>mode==='sdf'||mode==='psdf'||mode==='msdf'||mode==='mtsdf';
export const typeOf=mode=>mode==='mono'?'bitmap':mode;
/** Scale and vertical metrics in pixels for a size. */
export function fontMetrics(font,size){
 const s=size/font.unitsPerEm,asc=font.ascender*s,desc=font.descender*s,gap=(font.lineGap||0)*s;
 return {scale:s,base:Math.round(asc),lineHeight:Math.round(asc-desc+gap),ascender:asc,descender:desc,lineGap:gap};
}
/** One glyph → pixels (RGBA, white + alpha for bitmaps; encoded field otherwise) and its metrics.
 * xoffset/yoffset are relative to the pen position on the BASELINE (y down); assemble() converts
 * yoffset to BMFont's line-top origin. */
export function renderGlyph(font,codepoint,settings){
 const o=settings.size?settings:normalizeFontSettings(settings);
 const gid=font.glyphId(codepoint);
 if(!gid&&codepoint!==0x20)return null;
 const s=o.size/font.unitsPerEm,adv=font.advance(gid,o.coords);
 const {commands,bounds}=font.glyphPath(gid,o.coords);
 const base={id:codepoint,gid,xadvance:Math.round(adv*s),advance:adv/font.unitsPerEm};
 if(!bounds||!commands.length||bounds.xMax<=bounds.xMin||bounds.yMax<=bounds.yMin)return {...base,w:0,h:0,x0:0,y0:0,data:null,plane:null};
 const field=isField(o.mode),pad=field?o.range/2+o.padding:o.padding;
 const x0=Math.floor(bounds.xMin*s-pad+1e-9),x1=Math.ceil(bounds.xMax*s+pad-1e-9),y0=Math.floor(-bounds.yMax*s-pad+1e-9),y1=Math.ceil(-bounds.yMin*s+pad-1e-9);
 const w=x1-x0,h=y1-y0;
 if(w*h>4096*4096)throw Error(`Glyph U+${codepoint.toString(16).toUpperCase()} is too large at this size`);
 const shape=shapeFromCommands(commands,{scale:s,dx:-x0,dy:-y0,flipY:true});
 let data;
 if(!field){
  const cov=rasterize(shape,w,h);data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<cov.length;i++){const a=o.mode==='mono'?(cov[i]>=o.threshold?255:0):Math.round(cov[i]*255);data[i*4]=data[i*4+1]=data[i*4+2]=255;data[i*4+3]=a;}
 }else{
  const opts={range:o.range};
  if(o.mode==='sdf')data=encodeField(generateSDF(shape,w,h,opts),w,h,1,{range:o.range,alphaOnly:o.alphaOnly});
  else if(o.mode==='psdf')data=encodeField(generatePSDF(shape,w,h,opts),w,h,1,{range:o.range,alphaOnly:o.alphaOnly});
  else{edgeColoringSimple(shape,{angleThreshold:3,seed:0});
   data=o.mode==='msdf'?encodeField(generateMSDF(shape,w,h,opts),w,h,3,{range:o.range}):encodeField(generateMTSDF(shape,w,h,opts),w,h,4,{range:o.range});}
 }
 // the quad through the outermost texel centres, in em units, y up (msdf-atlas-gen convention)
 const em=o.size;
 return {...base,w,h,x0,y0,data,plane:{left:(x0+.5)/em,right:(x1-.5)/em,top:-(y0+.5)/em,bottom:-(y1-.5)/em}};
}
export function renderGlyphs(font,codepoints,settings,{progress=()=>{},signal}={}){
 const o=normalizeFontSettings(settings),out=[],missing=[];
 for(let i=0;i<codepoints.length;i++){
  if(signal?.aborted)throw Object.assign(Error('Cancelled'),{name:'AbortError'});
  const g=renderGlyph(font,codepoints[i],o);
  if(g)out.push(g);else missing.push(codepoints[i]);
  if(i%64===63)progress(i+1,codepoints.length);
 }
 return {glyphs:out,missing};
}
// ------------------------------------------------------------------ packing
/** Glyphs arrive in charset order (most used first). Everything that fits one page is packed as
 * small as possible by the Studio packer; otherwise pages are filled in order at the page size, so
 * page 0 holds the most used glyphs — the page a CJK game touches most — and later pages the rare. */
export function packGlyphs(glyphs,settings){
 const o=normalizeFontSettings(settings),inked=glyphs.filter(g=>g.w>0&&g.h>0);
 const items=inked.map((g,i)=>({id:String(i),w:g.w,h:g.h}));
 const layoutSettings={maxWidth:o.pageWidth,maxHeight:o.pageHeight,sizeMode:o.sizeMode==='fixed'?'fixed':o.sizeMode==='pot'?'pot':'auto',fixedWidth:o.pageWidth,fixedHeight:o.pageHeight,
  shapePadding:o.spacing,borderPadding:Math.min(1,o.spacing),extrude:0,allowRotation:false,multipack:false,maxPages:1,effort:'fast'};
 if(!items.length)return {pages:[{width:Math.max(1,Math.min(o.pageWidth,8)),height:Math.max(1,Math.min(o.pageHeight,8))}],placements:new Map()};
 const big=inked.find(g=>g.w+2>o.pageWidth||g.h+2>o.pageHeight);
 if(big)throw Error(`Glyph U+${big.id.toString(16).toUpperCase()} (${big.w}×${big.h}) does not fit a ${o.pageWidth}×${o.pageHeight} page`);
 let single=null;
 try{single=layoutPages(items,layoutSettings);}catch(e){if(!['no-fit','too-many-pages'].includes(e.code))throw e;}
 const placements=new Map(),pages=[];
 if(single&&single.pages.length===1){
  const pg=single.pages[0];pages.push({width:pg.width,height:pg.height});
  for(const p of pg.placements)placements.set(inked[Number(p.id)],{page:0,x:p.x,y:p.y});
  return {pages,placements};
 }
 // multi-page, in charset order: fill a full page, then the next
 const b=layoutSettings.borderPadding,sp=o.spacing;
 let rest=inked.map((g,i)=>i);
 while(rest.length){
  if(pages.length>=o.maxPages)throw Object.assign(Error(`These glyphs need more than ${o.maxPages} pages of ${o.pageWidth}×${o.pageHeight}; raise the page size or the page limit`),{code:'too-many-pages'});
  const bin=new MaxRectsBin(o.pageWidth-2*b+sp,o.pageHeight-2*b+sp,{heuristic:'bssf'});
  const left=[],page=pages.length;let usedW=0,usedH=0,placedAny=false;
  for(const i of rest){
   const g=inked[i],n=bin.insert(g.w+sp,g.h+sp);
   if(!n){left.push(i);continue;}
   placedAny=true;placements.set(g,{page,x:b+n.x,y:b+n.y});usedW=Math.max(usedW,b+n.x+g.w);usedH=Math.max(usedH,b+n.y+g.h);
  }
  if(!placedAny)throw Error('A glyph could not be placed on an empty page');
  const last=!left.length,pot=v=>{let p=1;while(p<v)p*=2;return p;};
  pages.push(last&&o.sizeMode!=='fixed'?{width:Math.min(o.pageWidth,o.sizeMode==='pot'?pot(usedW+b):usedW+b),height:Math.min(o.pageHeight,o.sizeMode==='pot'?pot(usedH+b):usedH+b)}:{width:o.pageWidth,height:o.pageHeight});
  rest=left;
 }
 // engines expect one page size in `common scaleW/scaleH`: keep every page the size of the first
 for(const p of pages){p.width=pages[0].width;p.height=pages[0].height;}
 return {pages,placements};
}
/** Page pixels: each glyph's RGBA copied into its place (transparent elsewhere; distance-field pages
 * are filled with the "far outside" value so bilinear sampling at a glyph edge stays outside). */
export function composePages(packed,settings){
 const o=normalizeFontSettings(settings),field=isField(o.mode);
 const pages=packed.pages.map(p=>({width:p.width,height:p.height,data:new Uint8ClampedArray(p.width*p.height*4)}));
 // background: bitmaps are white with alpha 0 (no dark fringe under bilinear filtering); a field is
 // "far outside" in every channel it uses
 for(const p of pages){const d=p.data;for(let i=0;i<d.length;i+=4){
  if(!field||o.alphaOnly){d[i]=d[i+1]=d[i+2]=255;d[i+3]=0;}
  else{d[i]=d[i+1]=d[i+2]=0;d[i+3]=o.mode==='mtsdf'?0:255;}}}
 for(const [g,pl] of packed.placements){
  const pg=pages[pl.page];
  for(let y=0;y<g.h;y++)pg.data.set(g.data.subarray(y*g.w*4,(y+1)*g.w*4),((pl.y+y)*pg.width+pl.x)*4);
 }
 return pages;
}
/** Kerning between every pair of the rendered glyphs, from the font's GPOS/kern data. */
export function kerningFor(font,glyphs,settings){
 const o=normalizeFontSettings(settings);if(!o.kerning||!font.kerningPairs)return [];
 const byGid=new Map();for(const g of glyphs){let l=byGid.get(g.gid);if(!l)byGid.set(g.gid,l=[]);l.push(g.id);}
 const s=o.size/font.unitsPerEm,out=[];
 for(const [l,r,v] of font.kerningPairs(byGid.keys(),o.coords))for(const a of byGid.get(l)||[])for(const b of byGid.get(r)||[])out.push({first:a,second:b,amount:Math.round(v*s),em:v/font.unitsPerEm});
 return out.sort((a,b)=>a.first-b.first||a.second-b.second);
}
/** Everything the writers need, from rendered + packed glyphs. */
export function assemble(font,rendered,packed,settings,{face=font.family||'font',file='font'}={}){
 const o=normalizeFontSettings(settings),m=fontMetrics(font,o.size),field=isField(o.mode),pad=field?Math.ceil(o.range/2)+o.padding:o.padding;
 const multi=packed.pages.length>1,pageFile=i=>multi?`${file}_${i}.png`:`${file}.png`;
 const glyphs=rendered.glyphs.map(g=>{
  const pl=packed.placements.get(g)||{page:0,x:0,y:0};
  return {id:g.id,page:g.w?pl.page:0,x:g.w?pl.x:0,y:g.w?pl.y:0,w:g.w,h:g.h,xoffset:g.x0,yoffset:m.base+g.y0,xadvance:g.xadvance,advance:g.advance,plane:g.plane};
 });
 return {face,size:o.size,type:typeOf(o.mode),distanceRange:field?o.range:0,mono:o.mode==='mono',
  lineHeight:m.lineHeight,base:m.base,ascender:m.ascender,descender:m.descender,lineGap:m.lineGap,unitsPerEm:font.unitsPerEm,
  padding:[pad,pad,pad,pad],spacing:[o.spacing,o.spacing],
  pages:packed.pages.map((p,i)=>({file:pageFile(i),width:p.width,height:p.height})),
  glyphs,kerning:kerningFor(font,rendered.glyphs,o),missing:rendered.missing,alphaOnly:!!o.alphaOnly};
}
// ------------------------------------------------------------------ pixel fonts from outlines
/** A TrueType pixel font draws on a grid of font units: every coordinate is a multiple of one
 * "pixel". Rendered at upem/quantum px (or a whole multiple) it is crisp; at any other size it
 * blurs. This finds that grid from real glyph outlines and says how sure it is. */
export function pixelGridOf(font,codepoints){
 const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;};
 let g=0,points=0,curves=0,glyphs=0;
 for(const c of codepoints){
  const gid=font.glyphId(c);if(!gid)continue;const {commands}=font.glyphPath(gid);if(!commands.length)continue;glyphs++;
  for(const k of commands){
   if(k.type==='Q'||k.type==='C')curves++;
   for(const v of [k.x,k.y,k.x1,k.y1,k.x2,k.y2])if(v!=null){if(!Number.isInteger(v))return {pixelSize:null,confidence:'none',reason:'fractional coordinates'};g=gcd(g,v);points++;}
  }
  if(glyphs>=64)break;
 }
 if(!g||points<8)return {pixelSize:null,confidence:'none',reason:'no outline points'};
 const size=font.unitsPerEm/g;
 if(!Number.isInteger(size)||size>96||size<4)return {pixelSize:null,quantum:g,confidence:'none',reason:'grid does not divide the em'};
 return {pixelSize:size,quantum:g,glyphs,points,curves,confidence:curves?'medium':'high',sizes:[1,2,3,4].map(k=>size*k)};
}
// ------------------------------------------------------------------ fonts from a glyph sheet
/** Pixel font from an image grid: fixed cells, or each glyph's ink bounds ("measured"), with
 * per-glyph overrides and hand-made kerning pairs. The page is the sheet itself (after the colour
 * key), so a pixel art font is shipped exactly as drawn.
 * grid {cellW, cellH, cols, rows, ox, oy, sx, sy}; chars = the order (one per cell, reading order). */
export function gridFontModel(image,grid,{chars,measure='ink',baseline=null,lineHeight=null,spacing=1,spaceAdvance=null,threshold=8,overrides={},kerning=[],face='Pixel Font',file='font',size=null}={}){
 const {width:W,height:H,data}=image;
 if(data.length!==W*H*4)throw Error('Invalid image data');
 const list=Array.from(chars||'');
 const cells=grid.cols*grid.rows;if(!list.length)throw Error('The character order is empty');
 if(list.length>cells)throw Error(`The order has ${list.length} characters for ${cells} cells`);
 const base=baseline??grid.cellH,glyphs=[];
 list.forEach((ch,i)=>{
  if(ch==='\u0000')return;// a deliberately skipped cell
  const col=i%grid.cols,row=Math.floor(i/grid.cols),cx=grid.ox+col*(grid.cellW+grid.sx),cy=grid.oy+row*(grid.cellH+grid.sy);
  if(cx+grid.cellW>W||cy+grid.cellH>H)return;
  const id=ch.codePointAt(0),ov=overrides[id]||{};
  let x0=cx+grid.cellW,y0=cy+grid.cellH,x1=-1,y1=-1;
  for(let y=cy;y<cy+grid.cellH;y++)for(let x=cx;x<cx+grid.cellW;x++)if(data[(y*W+x)*4+3]>threshold){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  const empty=x1<0;
  let g;
  if(measure==='fixed')g={id,page:0,x:cx,y:cy,w:grid.cellW,h:grid.cellH,xoffset:0,yoffset:0,xadvance:grid.cellW};
  else if(empty)g={id,page:0,x:0,y:0,w:0,h:0,xoffset:0,yoffset:0,xadvance:spaceAdvance??Math.max(1,Math.round(grid.cellW/2))};
  else g={id,page:0,x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,xoffset:0,yoffset:y0-cy,xadvance:x1-x0+1+spacing,inkLeft:x0-cx};
  if(ov.xadvance!=null)g.xadvance=ov.xadvance;if(ov.xoffset!=null)g.xoffset=ov.xoffset;if(ov.yoffset!=null)g.yoffset=ov.yoffset;
  const em=size||grid.cellH;
  g.advance=g.xadvance/em;g.plane=g.w?{left:g.xoffset/em,right:(g.xoffset+g.w)/em,top:(base-g.yoffset)/em,bottom:(base-g.yoffset-g.h)/em}:null;
  glyphs.push(g);
 });
 const lh=lineHeight??grid.cellH,em=size||grid.cellH;
 return {face,size:em,type:'bitmap',distanceRange:0,lineHeight:lh,base,ascender:base,descender:base-lh,lineGap:0,unitsPerEm:em,
  padding:[0,0,0,0],spacing:[spacing,0],pages:[{file:`${file}.png`,width:W,height:H}],glyphs,
  kerning:kerning.filter(k=>k.amount).map(k=>({first:k.first,second:k.second,amount:Math.round(k.amount),em:k.amount/em})),missing:[]};
}
/** Kerning suggestions for a pixel font from glyph shapes: for each pair, the tightest horizontal
 * gap between the left glyph's right edge profile and the right glyph's left profile, row by row
 * on the shared baseline. Pairs whose gap is wider than the font's typical gap get a negative
 * amount ('AV', 'To', 'LT'). Suggestions only — the caller shows them and applies what is chosen. */
export function suggestKerning(image,model,{pairs=null,maxPairs=200,minGain=1}={}){
 const {width:W,data}=image,by=new Map(model.glyphs.filter(g=>g.w).map(g=>[g.id,g]));
 const profile=(g,side)=>{const rows=new Map();for(let y=0;y<g.h;y++){let edge=null;for(let k=0;k<g.w;k++){const x=side==='right'?g.x+g.w-1-k:g.x+k;if(data[((g.y+y)*W+x)*4+3]>8){edge=k;break;}}if(edge!=null)rows.set(g.yoffset+y,edge);}return rows;};
 const cacheR=new Map(),cacheL=new Map(),R=g=>{let p=cacheR.get(g);if(!p)cacheR.set(g,p=profile(g,'right'));return p;},L=g=>{let p=cacheL.get(g);if(!p)cacheL.set(g,p=profile(g,'left'));return p;};
 const gap=(a,b)=>{const ra=R(a),lb=L(b);let best=Infinity;for(const [y,ea] of ra){const eb=lb.get(y);if(eb==null)continue;
  // pen: a's box ends at a.xoffset+a.w, advance puts b at a.xadvance; space between inks on this row
  best=Math.min(best,(a.xadvance-(a.xoffset+a.w))+ea+eb+b.xoffset);}return best;};
 const ids=[...by.keys()],candidates=pairs||ids.flatMap(a=>ids.map(b=>[a,b]));
 const gaps=[];for(const [a,b] of candidates){const g=gap(by.get(a),by.get(b));if(Number.isFinite(g))gaps.push(g);}
 if(!gaps.length)return {typical:null,pairs:[]};
 gaps.sort((x,y)=>x-y);const typical=gaps[Math.floor(gaps.length/2)];
 const out=[];
 for(const [a,b] of candidates){
  const ga=by.get(a),gb=by.get(b),rows=[...R(ga).keys()].filter(y=>L(gb).has(y)).length;
  if(!rows)continue;// no shared rows: nothing touches, kerning would be a guess
  const g=gap(ga,gb);if(!Number.isFinite(g))continue;
  const amount=typical-g;
  if(amount<=-minGain)out.push({first:a,second:b,amount,gap:g,rows,confidence:rows>=3?'high':'low'});
 }
 out.sort((x,y)=>x.amount-y.amount||x.first-y.first||x.second-y.second);
 return {typical,pairs:out.slice(0,maxPairs)};
}
