/** Colour-keyed sheets: find the key colour, and read the sheet with that colour as transparency.
 *
 * Old-school and engine-exported sheets often have no alpha at all: every cell sits on magenta,
 * cyan, lime or a flat dark colour, and the grid lines between cells are that colour too. To the
 * alpha-only detectors such a sheet is one opaque block ("1 frame", "32×64 low 0%"). The key is
 * found from evidence, not assumed:
 *   border   — share of the outer border in one exact colour (margins, and the key around cells)
 *   sheet    — share of the whole sheet in that colour (a key is a large part of a sprite sheet)
 *   lines    — full rows/columns in that colour (the spacing lines of a keyed grid)
 *   alpha    — a sheet that already uses transparency around its content has no key to find
 * The result carries a confidence and the numbers behind it; callers only apply it by
 * themselves when it is `high`, and always show it so it can be switched off.
 * Pure: {data,width,height} RGBA or a lazy source (src/game/pixels.js) in, plain data out. */
import {source,eachBand,ALPHA_THRESHOLD} from './pixels.js';
const clamp01=v=>v<0?0:v>1?1:v;
const pack=(r,g,b)=>r<<16|g<<8|b;
const unpack=k=>[k>>16&255,k>>8&255,k&255];
/** Conventional key colours: a sprite rarely uses them, so they need slightly less evidence. */
const CONVENTIONAL=[[255,0,255],[0,255,255],[0,255,0],[255,0,0],[0,0,255],[255,255,0]];
const isConventional=c=>CONVENTIONAL.some(k=>Math.abs(k[0]-c[0])<=8&&Math.abs(k[1]-c[1])<=8&&Math.abs(k[2]-c[2])<=8);
export const KEY_TOLERANCE_MAX=64;
/** Detects the key colour of a sheet. Returns null when there is no single border colour at all.
 * @returns {color,[r,g,b], tolerance, confidence:'high'|'medium'|'low', score, apply, reasons,
 *           evidence:{borderShare, sheetShare, fullLines, transparentShare, conventional}} */
export function detectColorKey(src,{threshold=ALPHA_THRESHOLD,signal}={}){
 const s=source(src),{width:w,height:h}=s;
 const border=new Map();let borderTotal=0,borderClear=0;
 const take=img=>{for(let i=0;i<img.data.length;i+=4){borderTotal++;if(img.data[i+3]<=threshold){borderClear++;continue;}const k=pack(img.data[i],img.data[i+1],img.data[i+2]);border.set(k,(border.get(k)||0)+1);}};
 take(s.read({x:0,y:0,w,h:1}));if(h>1)take(s.read({x:0,y:h-1,w,h:1}));
 if(h>2){take(s.read({x:0,y:1,w:1,h:h-2}));if(w>1)take(s.read({x:w-1,y:1,w:1,h:h-2}));}
 let top=-1,topCount=0;for(const [k,n] of border)if(n>topCount){top=k;topCount=n;}
 if(top<0)return null;
 const color=unpack(top);
 // Tolerance from the border itself: a PNG key is exact; a JPEG-damaged key spreads a little.
 // Only near-key border pixels are considered, so a sprite touching the border cannot widen it.
 const dists=[];
 for(const [k,n] of border){const c=unpack(k),d=Math.hypot(c[0]-color[0],c[1]-color[1],c[2]-color[2]);if(d>0&&d<=48)for(let i=0;i<Math.min(n,64);i++)dists.push(d);}
 dists.sort((a,b)=>a-b);
 const spread=dists.length?dists[Math.floor(dists.length*.95)]:0;
 const nearShare=(topCount+dists.length)/Math.max(1,borderTotal-borderClear);
 const tolerance=Math.min(KEY_TOLERANCE_MAX,spread&&nearShare>0?Math.ceil(spread)+2:0);
 const limit=tolerance*tolerance,matches=(d,i)=>{const r=d[i]-color[0],g=d[i+1]-color[1],b=d[i+2]-color[2];return r*r+g*g+b*b<=limit;};
 const rowFull=new Uint8Array(h),colKey=new Uint32Array(w);let keyed=0,clear=0,total=0;
 eachBand(s,(band,y0)=>{
  for(let y=0;y<band.height;y++){let n=0;
   for(let x=0;x<band.width;x++){const i=(y*band.width+x)*4;total++;
    if(band.data[i+3]<=threshold){clear++;continue;}
    if(matches(band.data,i)){keyed++;n++;colKey[x]++;}}
   rowFull[y0+y]=n===band.width?1:0;}
 },{signal});
 let fullLines=0;for(let y=0;y<h;y++)fullLines+=rowFull[y];for(let x=0;x<w;x++)if(colKey[x]===h)fullLines++;
 const borderShare=topCount/borderTotal,sheetShare=keyed/total,transparentShare=clear/total,conventional=isConventional(color);
 // A sheet whose border is mostly transparent already uses alpha; a key would erase content.
 const alphaSheet=borderClear/borderTotal>.5;
 // Two independent ways to be sure: the border is overwhelmingly one colour, or it is mostly
 // that colour *and* whole rows/columns of it run between the cells. Either way the colour must
 // be a real part of the sheet but not all of it (a flat image is not a sheet on a background).
 const lines=fullLines>=4,body=sheetShare>=.1&&sheetShare<=.97;
 const confidence=alphaSheet||!body?'low':borderShare>=.75||borderShare>=.4&&lines?'high':borderShare>=.4?'medium':'low';
 let score=clamp01(borderShare)*.55+clamp01(sheetShare/.35)*.25+(lines?.12:0)+(conventional?.08:0);
 if(alphaSheet||!body)score*=.3;
 score=confidence==='high'?Math.max(score,.8):confidence==='medium'?Math.min(Math.max(score,.5),.79):Math.min(score,.49);
 const pct=v=>`${Math.round(v*100)}%`;
 const reasons=[`${pct(borderShare)} of the border is ${hex(color)}`,`${pct(sheetShare)} of the sheet is that colour`];
 if(fullLines)reasons.push(`${fullLines} full row/column lines are that colour (spacing between cells)`);
 if(conventional)reasons.push('it is a conventional key colour');
 if(alphaSheet)reasons.push(`the sheet already uses transparency (${pct(borderClear/borderTotal)} of the border)`);
 if(tolerance)reasons.push(`near-key border pixels spread up to ${Math.round(spread)} levels, so the range is ${tolerance}`);
 return {color,tolerance,confidence,score,apply:confidence==='high',reasons,
  evidence:{borderShare,sheetShare,fullLines,transparentShare,conventional,alphaSheet}};
}
export const hex=c=>'#'+c.slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
/** A copy of the pixels with every key-coloured pixel made fully transparent (colour kept, so a
 * later export does not bleed a different colour into the edges). Global, like an engine's
 * transparent-colour import: key pixels enclosed by a sprite are background too. */
export function applyColorKey(img,color,{tolerance=0}={}){
 const {data,width,height}=img,out=new Uint8ClampedArray(data),limit=tolerance*tolerance;
 for(let i=0;i<out.length;i+=4){const r=out[i]-color[0],g=out[i+1]-color[1],b=out[i+2]-color[2];if(r*r+g*g+b*b<=limit)out[i+3]=0;}
 return {data:out,width,height};
}
/** Same as applyColorKey but lazy: a source whose reads come back keyed, so a large sheet is
 * never copied whole. */
export function keyedSource(src,color,{tolerance=0}={}){
 const s=source(src);
 return {width:s.width,height:s.height,read(r){const img=s.read(r);return applyColorKey(img,color,{tolerance});}};
}
