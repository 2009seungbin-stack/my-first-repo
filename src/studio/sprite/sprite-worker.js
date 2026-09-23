/** Off-main-thread work for the Sprite workspace: sheet analysis (key colour, grid, islands, cell
 * occupancy) and decoding animated files (GIF, APNG, .aseprite) into cel PNGs.
 * Messages {id, op, …} → {id, ok, result|error}. Exact pixels throughout: PNGs are decoded and
 * encoded in JavaScript (src/game/texture-png.js), never through a canvas. */
import {decodePNG,encodeRGBAPNG} from '../../game/texture-png.js';
import {detectColorKey,applyColorKey,hex} from '../../game/color-key.js';
import {detectGridWithColour,cellRect} from '../../game/grid-detect.js';
import {detectFrames,autoVersusGrid} from '../../game/frame-ops.js';
import {ALPHA_THRESHOLD} from '../../game/pixels.js';
import {decodeGIF} from './gif-decode.js';
import {decodeAPNG} from './apng-decode.js';
import {readAseprite} from '../../game/aseprite.js';
import {asepriteContent} from './aseprite-bridge.js';
import {opaqueBounds,cropRGBA} from './frame-image.js';
import {rerankGrids,islandGridSuggestion} from './grid-rerank.js';
let cache={key:'',img:null};
const EVIDENCE=['separatorLinesX','separatorLinesY','separatorRatioX','separatorRatioY','periodicityX','periodicityY','boundsConsistency','crossingsX','crossingsY','splitColumns','splitRows','commonSize','outsidePixels','filledCells'];
const pickEvidence=e=>Object.fromEntries(EVIDENCE.filter(k=>k in e).map(k=>[k,e[k]]));
async function pixels(key,blob){
 if(cache.key===key&&cache.img)return cache.img;
 const img=await decodePNG(new Uint8Array(await blob.arrayBuffer()),{maxPixels:268e6});
 cache={key,img:{data:img.data,width:img.width,height:img.height}};return cache.img;
}
function nonEmpty(img,r){
 const {data,width}=img;
 for(let y=Math.max(0,r.y);y<Math.min(img.height,r.y+r.h);y++){let i=(y*width+Math.max(0,r.x))*4+3;for(let x=Math.max(0,r.x);x<Math.min(width,r.x+r.w);x++,i+=4)if(data[i]>ALPHA_THRESHOLD)return true;}
 return false;
}
function occupancy(img,g){
 const out=[],cols=g.columns,rows=g.rows;
 if(cols*rows>40000)return null;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const r=cellRect(g,col,row);if(r.x+r.w>img.width||r.y+r.h>img.height)continue;out.push({...r,row,col,empty:!nonEmpty(img,r)});}
 return out;
}
const toPNG=async img=>{const b=await encodeRGBAPNG(img.data,img.width,img.height);return b;};
/** A cel from a full-canvas RGBA picture: cropped to its opaque bounds (null when empty). */
async function celFrom(rgba,width,height){
 const img={width,height,data:rgba},b=opaqueBounds(img,0);if(!b)return null;
 const part=b.w===width&&b.h===height?img:cropRGBA(img,b);
 return {x:b.x,y:b.y,width:b.w,height:b.h,png:await toPNG(part)};
}
async function analyze({key,blob,keyMode='auto',keyColor=null,tolerance=0,signal}){
 const t0=performance.now(),orig=await pixels(key,blob);
 let info=null,img=orig,keyed=null;
 {// the key is always measured (so "No key colour" can say how sure it is and offer the key back)
  info=keyColor?{color:keyColor,tolerance,confidence:'high',score:1,apply:true,reasons:['chosen by you'],evidence:{}}:detectColorKey(orig);
  const use=info&&keyMode!=='none'&&(keyMode==='force'||keyColor||info.apply);
  if(use){img=applyColorKey(orig,info.color,{tolerance:info.tolerance});keyed=await toPNG(img);}
  if(info)info={mode:keyMode,evidence:info.evidence?{borderShare:info.evidence.borderShare,sheetShare:info.evidence.sheetShare,fullLines:info.evidence.fullLines,alphaSheet:info.evidence.alphaSheet,conventional:info.evidence.conventional}:null,color:info.color,hex:hex(info.color),tolerance:info.tolerance,confidence:info.confidence,score:info.score,reasons:info.reasons,applied:!!use};
 }
 let auto=null;
 try{
  const found=detectFrames(img,{minArea:Math.min(16,img.width*img.height),distance:'auto'});
  auto={rects:found.rects.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,row:r.row})),reason:found.auto?.reason||'',reasonCode:found.auto?.reasonCode||'',consistency:found.auto?.consistency??null,distance:found.distance,
   attached:found.attached.length,unassigned:found.unassigned.length,unassignedRects:found.unassigned.slice(0,2000).map(r=>({x:r.x,y:r.y,w:r.w,h:r.h}))};
 }catch(e){auto={rects:[],reason:String(e.message||e),reasonCode:'error',attached:0,unassigned:0,unassignedRects:[]};}
 const grid=detectGridWithColour(img,{limit:5});
 let suggestions=grid.suggestions;
 // The grid the separate sprites imply (one sprite per cell) is always offered, measured by the
 // same detector; a sheet of differently sized sprites has little periodicity for it to read.
 const ig=islandGridSuggestion(img,auto.rects);
 if(ig){
  const same=suggestions.findIndex(s=>s.cellWidth===ig.cellWidth&&s.cellHeight===ig.cellHeight&&!s.marginX&&!s.marginY&&!s.spacingX&&!s.spacingY);
  if(same<0)suggestions=[...suggestions,ig];
  else suggestions=suggestions.map((s,i)=>i===same?{...s,islandGrid:true,reasons:[ig.reasons[0],...(s.reasons||[])]}:s);
 }
 const grids=rerankGrids(suggestions,{width:img.width,height:img.height}).map(s=>({engineRank:s.engineRank,fitted:!!s.fitted,cellWidth:s.cellWidth,cellHeight:s.cellHeight,marginX:s.marginX,marginY:s.marginY,spacingX:s.spacingX,spacingY:s.spacingY,columns:s.columns,rows:s.rows,cells:s.cells,score:s.score,confidence:s.confidence,source:s.source||'alpha',
  reasons:s.reasons||[],filled:s.evidence?.filledCells,evidence:s.evidence&&!s.source?.startsWith?.('colour')?pickEvidence(s.evidence):null,reranked:s.reasons?.[0]?.startsWith('ranked above')||!!s.fitted}));
 const cells={};grids.forEach((g,i)=>{const o=occupancy(img,g);if(o)cells[i]=o;});
 const hint=grid.suggestions[0]&&auto.rects.length?autoVersusGrid(auto.rects,grid.suggestions[0]):null;
 return {width:img.width,height:img.height,key:info,keyed,grids,cells,auto,hint:hint?{recommend:hint.recommend,spanning:hint.spanning}:null,ms:performance.now()-t0};
}
async function animation({bytes,kind}){
 const dec=kind==='gif'?decodeGIF(bytes):await decodeAPNG(bytes);
 const frames=[];
 for(const f of dec.frames)frames.push({delay:f.delay,rawDelay:f.rawDelay,disposal:f.disposal,cel:await celFrom(f.rgba,dec.width,dec.height)});
 return {width:dec.width,height:dec.height,loop:kind==='gif'?dec.loop:dec.plays,frames,warnings:dec.warnings};
}
async function aseprite({bytes}){
 const doc=readAseprite(bytes),c=asepriteContent(doc);
 const frames=[];
 for(const fr of c.frames){
  const cels=[];
  for(const cel of fr.cels){const img={width:cel.width,height:cel.height,data:cel.rgba},b=opaqueBounds(img,0);
   // keep RGB under alpha 0 exactly: only trim fully zero borders (what Aseprite itself skips)
   const zb=zeroBounds(img)||b;if(!zb)continue;const part=zb.w===cel.width&&zb.h===cel.height?img:cropRGBA(img,zb);
   cels.push({layer:cel.layer,x:cel.x+zb.x,y:cel.y+zb.y,opacity:cel.opacity,png:await toPNG(part),width:zb.w,height:zb.h});}
  frames.push({duration:fr.duration,cels});
 }
 return {width:c.width,height:c.height,layers:c.layers,frames,frameMeta:c.frameMeta,tags:c.tags,slices:c.slices,decisions:c.decisions,sliceBoxes:c.sliceBoxes,pivotSlice:c.pivotSlice,
  flattened:c.flattened,warnings:c.warnings.slice(0,20),colorMode:doc.colorMode,frameCount:doc.frames.length};
}
/** Bounds of pixels that are not all-zero (r|g|b|a) — the exact extent Aseprite draws. */
function zeroBounds(img){
 const {width:w,height:h,data}=img;let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(data[i]|data[i+1]|data[i+2]|data[i+3]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
async function cells({key,blob,spec}){
 const img=await pixels(key,blob);
 return {cells:occupancy(img,{cellWidth:spec.w,cellHeight:spec.h,marginX:spec.ox,marginY:spec.oy,spacingX:spec.sx,spacingY:spec.sy,
  columns:Math.max(0,Math.floor((img.width-spec.ox+spec.sx)/(spec.w+spec.sx))),rows:Math.max(0,Math.floor((img.height-spec.oy+spec.sy)/(spec.h+spec.sy)))})};
}
const OPS={analyze,animation,aseprite,cells};
self.onmessage=async({data})=>{
 const {id,op}=data;
 try{const fn=OPS[op];if(!fn)throw Error('unknown op '+op);self.postMessage({id,ok:true,result:await fn(data)});}
 catch(e){self.postMessage({id,ok:false,error:String(e?.message||e)});}
};
