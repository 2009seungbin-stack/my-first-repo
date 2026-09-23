/** A second look at src/game/grid-detect.js's ranking before the Sprite importer picks a default.
 * The detector is untouched; this only reorders (and, for strips, adds) candidates using the
 * evidence the detector already reports, and says why in `reasons` so the choice stays visible:
 *
 *  1. fitted size   a single-row/column strip whose cells leave a remainder smaller than one cell
 *                   (tank.png 288×26 read as 32×24) gets a candidate with the exact cell size
 *                   (32×26); the cut would otherwise drop pixel rows.
 *  2. split cells   a candidate whose cells are split by empty rows/columns (content stacked inside
 *                   one cell) loses to the candidate of exactly 1/k that size along that axis with
 *                   no splits and k× the filled cells (samurai 48×96 → 48×48).
 *  3. crossings     a candidate whose cell borders cut through content thousands of times loses to
 *                   one that cuts through (almost) nothing (hit-yellow 1024×8 → 1024×1024).
 *  0. island grid   the grid the separate sprites imply (`islandGrid`: every sprite alone in one
 *                   cell) is offered by the importer and, when it cuts, splits and drops nothing,
 *                   outranks a reading that does (a 1,000-frame sheet of differently sized sprites
 *                   in 32 px cells read as 128×64 → 32×32).
 * `rerankGrids` is pure (no pixels); `islandGridSuggestion` measures its candidate with the
 * detector's own cell evidence. */
import {runLengths,cellEvidence} from '../../game/grid-detect.js';
import {alphaProfile,source} from '../../game/pixels.js';
const key=s=>[s.cellWidth,s.cellHeight,s.marginX,s.marginY,s.spacingX,s.spacingY].join();
const clamp01=v=>v<0?0:v>1?1:v;
/** The island grid as a suggestion in the detector's shape, measured with the detector's own
 * cell evidence (crossings, splits, pixels outside cells). High confidence only when no sprite is
 * cut, split or left outside. */
export function islandGridSuggestion(img,rects){
 const g=islandGrid(rects,img.width,img.height);if(!g)return null;
 const spec={cellWidth:g.w,cellHeight:g.h,marginX:0,marginY:0,spacingX:0,spacingY:0,columns:img.width/g.w,rows:img.height/g.h,cells:g.cells};
 const src=source(img),ev=cellEvidence(runLengths(src),spec,alphaProfile(src));
 const clean=ev.crossRatio<=.03&&!ev.splitColumns&&!ev.splitRows&&!ev.outsidePixels;
 const score=clean?Math.max(.8,clamp01(.55+ev.consistency*.25+ev.coverage*.2)):clamp01(.4+ev.consistency*.2)*(1-clamp01(ev.splitRatio))*(1-clamp01(ev.outsideRatio));
 const evidence={boundsConsistency:ev.consistency,coverage:ev.coverage,filledCells:ev.filled,crossingsX:ev.crossX,crossingsY:ev.crossY,crossRatio:ev.crossRatio,
  splitColumns:ev.splitColumns,splitRows:ev.splitRows,splitRatio:ev.splitRatio,outsidePixels:ev.outsidePixels,outsideRatio:ev.outsideRatio,separatorLinesX:0,separatorLinesY:0,periodicityX:0,periodicityY:0,commonSize:true};
 return {...spec,score,confidence:clean?'high':score>=.5?'medium':'low',evidence,islandGrid:true,
  reasons:[`each of the ${rects.length} separate sprites sits alone in one ${g.w}×${g.h} cell`,`${ev.filled} of ${g.cells} cells hold content`]};
}
/** The grid the separate sprites themselves imply: the largest cell size (dividing the sheet
 * exactly, edge to edge) in which every sprite fits inside one cell and no cell holds two. A sheet
 * of differently sized sprites, one per 32 px cell, has no strong alpha periodicity for the
 * detector to read, but its islands show the grid at once. Returns {w,h,cells} or null. */
export function islandGrid(rects,width,height,{min=8}={}){
 if(!rects||rects.length<4)return null;
 const fits=(P,len,pos,size)=>len%P===0&&rects.every(r=>Math.floor(pos(r)/P)===Math.floor((pos(r)+size(r)-1)/P));
 const xs=[],ys=[];
 for(let P=min;P<=width/2;P++)if(fits(P,width,r=>r.x,r=>r.w))xs.push(P);
 for(let P=min;P<=height;P++)if(fits(P,height,r=>r.y,r=>r.h))ys.push(P);
 let best=null;
 for(const w of xs)for(const h of ys){
  const seen=new Set();let unique=true;
  for(const r of rects){const k=Math.floor(r.x/w)+','+Math.floor(r.y/h);if(seen.has(k)){unique=false;break;}seen.add(k);}
  if(!unique)continue;
  const area=w*h,sq=Math.abs(w-h);
  if(!best||area>best.w*best.h||area===best.w*best.h&&sq<Math.abs(best.w-best.h))best={w,h,cells:(width/w)*(height/h)};
 }
 return best;
}
export function rerankGrids(list,{width,height}){
 const out=list.map((s,i)=>({...s,engineRank:i,reasons:[...(s.reasons||[])]}));
 // 1. fitted strips
 for(const s of [...out]){
  if(s.marginX||s.marginY||s.spacingX||s.spacingY)continue;
  const rows=Math.floor(height/s.cellHeight),cols=Math.floor(width/s.cellWidth);
  const fitH=rows>=1&&rows<=2&&height%rows===0&&height-rows*s.cellHeight>0&&height-rows*s.cellHeight<s.cellHeight?height/rows:null;
  const fitW=cols>=1&&cols<=2&&width%cols===0&&width-cols*s.cellWidth>0&&width-cols*s.cellWidth<s.cellWidth?width/cols:null;
  if(!fitH&&!fitW)continue;
  const f={...s,cellWidth:fitW||s.cellWidth,cellHeight:fitH||s.cellHeight,rows:fitH?rows:s.rows,columns:fitW?cols:s.columns,fitted:true,engineRank:s.engineRank,
   reasons:[`${s.cellWidth}×${s.cellHeight} leaves ${fitH?height-rows*s.cellHeight:width-cols*s.cellWidth} px of the strip outside every cell; ${fitW||s.cellWidth}×${fitH||s.cellHeight} covers it exactly`,...s.reasons]};
  const had=out.findIndex(x=>key(x)===key(f)),at=out.indexOf(s);
  if(had<0)out.splice(at,0,f);
  else if(had>at){const [x]=out.splice(had,1);out.splice(at,0,{...x,reasons:[f.reasons[0],...x.reasons]});}
 }
 // 0. the grid the sprites themselves imply wins over a reading that cuts, splits or drops them
 const clean=s=>{const e=s.evidence||{};return !(e.splitRows||e.splitColumns)&&!e.outsidePixels&&(e.crossRatio!=null?e.crossRatio<=.03:!((e.crossingsX||0)+(e.crossingsY||0)));};
 const isl=out.findIndex(s=>s.islandGrid&&clean(s));
 if(isl>0&&!clean(out[0])){const [x]=out.splice(isl,1);const top=out[0];out.unshift({...x,reasons:[`ranked above ${top.cellWidth}×${top.cellHeight}, which ${top.evidence?.outsidePixels?'leaves pixels outside its cells':(top.evidence?.splitRows||top.evidence?.splitColumns)?'puts several sprites in one cell':'cuts through sprites'}`,...x.reasons]});}
 // 2. split cells → the unsplit sub-grid (one axis, or both: 128×64 cells holding 8 sprites → 32×32)
 for(let i=0;i<out.length;i++){
  const a=out[i],ea=a.evidence||{};
  if((ea.splitRows||0)+(ea.splitColumns||0)>0){
   const j=out.findIndex((b,k)=>k>i&&b.marginX===a.marginX&&b.marginY===a.marginY&&!b.spacingX&&!b.spacingY&&!a.spacingX&&!a.spacingY&&
    a.cellWidth%b.cellWidth===0&&a.cellHeight%b.cellHeight===0&&a.cellWidth*a.cellHeight>b.cellWidth*b.cellHeight&&!(b.evidence?.splitRows)&&!(b.evidence?.splitColumns)&&
    (b.evidence?.filledCells??b.cells)>=.9*(a.cellWidth/b.cellWidth)*(a.cellHeight/b.cellHeight)*(ea.filledCells??a.cells)*.9);
   if(j>=0){const b=out[j];out.splice(j,1);out.splice(i,0,{...b,reasons:[`ranked above ${a.cellWidth}×${a.cellHeight}: empty rows/columns split its cells, so each of its cells holds several sprites`,...b.reasons]});continue;}
  }
  for(const axis of ['rows','cols']){
   const split=axis==='rows'?ea.splitRows:ea.splitColumns;if(!split)continue;
   const j=out.findIndex((b,k)=>k>i&&b.marginX===a.marginX&&b.marginY===a.marginY&&
    (axis==='rows'?b.cellWidth===a.cellWidth&&a.cellHeight%b.cellHeight===0&&a.cellHeight>b.cellHeight&&!(b.evidence?.splitRows):b.cellHeight===a.cellHeight&&a.cellWidth%b.cellWidth===0&&a.cellWidth>b.cellWidth&&!(b.evidence?.splitColumns))&&
    (b.evidence?.filledCells??b.cells)>=0.9*(axis==='rows'?a.cellHeight/b.cellHeight:a.cellWidth/b.cellWidth)*(ea.filledCells??a.cells));
   if(j<0)continue;
   const b=out[j];out.splice(j,1);out.splice(i,0,{...b,reasons:[`ranked above ${a.cellWidth}×${a.cellHeight}: empty ${axis==='rows'?'rows':'columns'} split ${split} of its cells, so each of its cells holds several sprites`,...b.reasons]});
   break;
  }
 }
 // 3. crossings
 const top=out[0],cross=s=>(s.evidence?.crossingsX||0)+(s.evidence?.crossingsY||0);
 if(top&&cross(top)>10*Math.max(1,top.evidence?.filledCells??top.cells)){
  const j=out.findIndex((s,k)=>k>0&&cross(s)<=cross(top)*.01);
  if(j>0){const b=out[j];out.splice(j,1);out.unshift({...b,reasons:[`ranked above ${top.cellWidth}×${top.cellHeight}: its cell borders cut through content ${cross(top)} times, this grid's ${cross(b)} times`,...b.reasons]});}
 }
 return out;
}
