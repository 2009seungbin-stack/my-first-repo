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
 * Pure; no pixels. */
const key=s=>[s.cellWidth,s.cellHeight,s.marginX,s.marginY,s.spacingX,s.spacingY].join();
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
  if(!out.some(x=>key(x)===key(f))){const at=out.indexOf(s);out.splice(at,0,f);}
 }
 // 2. split cells → the unsplit sub-grid
 for(let i=0;i<out.length;i++){
  const a=out[i],ea=a.evidence||{};
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
