/** Grid suggestion for a sprite sheet. Pure data in, ranked guesses out — no DOM.
 *
 * "Divides exactly" is not evidence: a 256×256 sheet divides by 8, 16, 32, 64 and 128. What is
 * evidence is (a) fully transparent separator rows/columns where the grid says a gap should be,
 * (b) periodicity of the row/column alpha-occupancy profiles at the cell pitch (autocorrelation),
 * (c) content bounds that look the same inside every cell, and (d) content that never runs across
 * a cell boundary. Every suggestion carries the numbers it was scored on, so the UI can explain
 * itself instead of asking for trust.
 *
 * GridSpec {cellWidth, cellHeight, marginX, marginY, spacingX, spacingY, columns, rows, cells}
 * Pixels are read through src/game/pixels.js: one horizontal band at a time, never a sheet copy. */
import {source,alphaProfile,autocorrelationAt,eachBand,ALPHA_THRESHOLD} from './pixels.js';
import {MAX_FRAMES} from '../primitives.js';
export const CELL_CANDIDATES=Object.freeze([8,16,24,32,48,64,96,128]);
export const MAX_MARGIN=64,MAX_SPACING=16;
const clamp01=v=>v<0?0:v>1?1:v;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const stdev=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/a.length);};
/** Per-row runs of opaque pixels. One compact structure replaces a full-sheet mask: it gives the
 * row/column profiles, per-cell content bounds and boundary-crossing counts without ever holding
 * more than one band of RGBA. runs are [xStart,xEndExclusive] pairs, rows[y]…rows[y+1] index them. */
export function runLengths(src,{threshold=ALPHA_THRESHOLD,signal}={}){
 const s=source(src),rows=new Int32Array(s.height+1),flat=[];
 eachBand(s,(band,y0)=>{
  for(let y=0;y<band.height;y++){
   let x=0;
   while(x<band.width){
    while(x<band.width&&band.data[(y*band.width+x)*4+3]<=threshold)x++;
    if(x>=band.width)break;
    const start=x;while(x<band.width&&band.data[(y*band.width+x)*4+3]>threshold)x++;
    flat.push(start,x);
   }
   rows[y0+y+1]=flat.length/2;
  }
 },{signal});
 for(let y=1;y<rows.length;y++)if(rows[y]<rows[y-1])rows[y]=rows[y-1];
 return {width:s.width,height:s.height,rows,runs:Int32Array.from(flat),threshold};
}
/** Prefix sums of "this line is fully transparent", so any band's emptiness is O(1). */
const prefix=empty=>{const p=new Int32Array(empty.length+1);for(let i=0;i<empty.length;i++)p[i+1]=p[i]+empty[i];return p;};
const bandEmpty=(p,from,to)=>{const a=Math.max(0,from),b=Math.min(p.length-1,to);return b<=a?{lines:0,empty:0}:{lines:b-a,empty:p[b]-p[a]};};
/** Real sheets space cells apart by a few pixels, not by a quarter of a cell. Without this cap the
 * search finds endless re-descriptions of the same pitch ("32 cells with 16px gaps" for a 48 grid),
 * all of them consistent with the pixels and all of them wrong about the cell. */
export const maxSpacingFor=(cell,maxSpacing=MAX_SPACING)=>Math.min(maxSpacing,Math.max(1,Math.floor(cell/4)));
/** Separator emptiness is a gate, not a weight. A spec that claims a margin or a spacing whose
 * rows/columns are not (almost) all transparent is discarded outright — that is the strongest use
 * of the evidence. Weighting it instead would reward inventing a "spacing" out of the blank space
 * a sprite happens to leave inside its own cell, which is how "45px cells with 3px gaps" wins over
 * the 48px grid that actually made the sheet. */
export const SEPARATOR_GATE=.98;
/** First/last occupied line at or after/before each index, so "where does content sit inside this
 * cell" is O(1) per cell for every candidate. */
function occupiedIndex(counts){
 const n=counts.length,next=new Int32Array(n+1).fill(-1),prev=new Int32Array(n+1).fill(-1);
 for(let i=n-1;i>=0;i--)next[i]=counts[i]?i:next[i+1];
 for(let i=0;i<n;i++)prev[i+1]=counts[i]?i:prev[i];
 return {next,prev};
}
/** Ranks (cell, margin, spacing) triples on one axis: separator emptiness, autocorrelation at the
 * pitch, how much of the axis the cells account for, and a dip of the profile at cell boundaries. */
export function axisCandidates(dim,counts,empty,{candidates,common=new Set(candidates),maxMargin=MAX_MARGIN,maxSpacing=MAX_SPACING,minCells=1}={}){
 // One answer per pitch: "45px cells with 3px gaps" and "48px cells edge to edge" describe the
 // same slicing, so they compete and only the better description survives.
 const p=prefix(empty),total=counts.reduce((s,v)=>s+v,0),avg=total/dim,occ=occupiedIndex(counts),byPitch=new Map();
 for(const cell of candidates){
  if(cell<2||cell>dim)continue;
  for(let spacing=0;spacing<=Math.min(maxSpacingFor(cell,maxSpacing),dim-cell);spacing++){
   const pitch=cell+spacing;
   for(let margin=0;margin<=Math.min(maxMargin,dim-cell);margin++){
    const count=Math.floor((dim-2*margin+spacing)/pitch);
    if(count<minCells)continue;
    const span=margin*2+count*pitch-spacing;
    if(span>dim)continue;
    let lines=0,blank=0;
    const head=bandEmpty(p,0,margin),tail=bandEmpty(p,margin+count*pitch-spacing,dim);
    lines+=head.lines+tail.lines;blank+=head.empty+tail.empty;
    for(let i=1;i<count&&spacing;i++){const g=bandEmpty(p,margin+i*pitch-spacing,margin+i*pitch);lines+=g.lines;blank+=g.empty;}
    const separator=lines?blank/lines:null;
    if(separator!==null&&separator<SEPARATOR_GATE&&(spacing||margin))continue;
    const periodicity=count>1?autocorrelationAt(counts,pitch):0;
    let dip=0;
    if(count>1&&avg>0){const edges=[];for(let i=1;i<count;i++){const b=margin+i*pitch-spacing;edges.push((counts[b-1]+counts[Math.min(dim-1,b)])/2);}dip=clamp01(1-mean(edges)/avg);}
    // Where the margin sits is otherwise ambiguous (shifting every cell by the same amount stays
    // consistent), so prefer the offset that leaves content evenly inset inside its cell.
    const pads=[];
    for(let i=0;i<count;i++){const a=margin+i*pitch,b=a+cell,first=occ.next[a],last=occ.prev[b];
     if(first>=0&&first<b&&last>=a)pads.push(Math.abs(first-a-(b-1-last)));}
    const symmetry=pads.length?clamp01(1-mean(pads)/cell):0;
    const tiling=count*cell/dim;
    const score=clamp01(periodicity*.32+tiling*.26+symmetry*.22+dip*.20)*(common.has(cell)?1:.92);
    const spec={cell,margin,spacing,pitch,count,separator,separatorLines:lines,periodicity,dip,tiling,symmetry,exact:span===dim,score};
    const rival=byPitch.get(pitch);
    if(!rival||spec.score>rival.score)byPitch.set(pitch,spec);
   }
  }
 }
 return [...byPitch.values()].sort((a,b)=>b.score-a.score);
}
/** Cell sizes the sheet itself suggests: the strongest autocorrelation peaks of a profile. */
export function periodCandidates(counts,{min=4,max=512,limit=3}={}){
 const top=Math.min(max,Math.floor(counts.length/2)),peaks=[];
 for(let lag=min;lag<=top;lag++){
  const v=autocorrelationAt(counts,lag);
  if(v<=autocorrelationAt(counts,lag-1)||v<autocorrelationAt(counts,lag+1)||v<.25)continue;
  peaks.push({lag,value:v});
 }
 return peaks.sort((a,b)=>b.value-a.value).slice(0,limit);
}
export const cellRect=(spec,col,row)=>({x:spec.marginX+col*(spec.cellWidth+spec.spacingX),y:spec.marginY+row*(spec.cellHeight+spec.spacingY),w:spec.cellWidth,h:spec.cellHeight});
/** Every cell of a suggestion, in reading order. */
export function gridCells(spec){
 const out=[];
 for(let row=0;row<spec.rows;row++)for(let col=0;col<spec.columns;col++)out.push({...cellRect(spec,col,row),col,row});
 return out;
}
/** Content bounds inside every cell, how often content runs across a cell boundary, and whether a
 * cell could still be split by a blank line (which means the cell is too big). Reads only the
 * run-length structure, so an extra candidate costs no pixels. */
export function cellEvidence(rl,spec,profile=null){
 const cells=new Array(spec.columns*spec.rows).fill(null);
 const colOf=x=>{const t=x-spec.marginX,pitch=spec.cellWidth+spec.spacingX,c=Math.floor(t/pitch);return t<0||c<0||c>=spec.columns||t-c*pitch>=spec.cellWidth?-1:c;};
 const rowOf=y=>{const t=y-spec.marginY,pitch=spec.cellHeight+spec.spacingY,r=Math.floor(t/pitch);return t<0||r<0||r>=spec.rows||t-r*pitch>=spec.cellHeight?-1:r;};
 const verticalEdges=[];for(let i=1;i<spec.columns;i++)verticalEdges.push(spec.marginX+i*(spec.cellWidth+spec.spacingX));
 let crossX=0,rowsWithContent=0,outside=0,inside=0;
 for(let y=0;y<rl.height;y++){
  const from=rl.rows[y],to=rl.rows[y+1];if(to<=from)continue;
  const row=rowOf(y);let any=false;
  for(let i=from;i<to;i++){
   const x0=rl.runs[i*2],x1=rl.runs[i*2+1];any=true;
   for(const edge of verticalEdges)if(x0<edge&&x1>edge)crossX++;
   if(row<0){outside+=x1-x0;continue;}
   for(let x=x0;x<x1;){
    const col=colOf(x);
    if(col<0){outside++;x++;continue;}
    const cx=spec.marginX+col*(spec.cellWidth+spec.spacingX),end=Math.min(x1,cx+spec.cellWidth);
    const cell=cells[row*spec.columns+col]||(cells[row*spec.columns+col]={x0:x,x1:end,y0:y,y1:y,area:0});
    if(x<cell.x0)cell.x0=x;if(end>cell.x1)cell.x1=end;if(y<cell.y0)cell.y0=y;if(y>cell.y1)cell.y1=y;
    cell.area+=end-x;inside+=end-x;x=end;
   }
  }
  if(any)rowsWithContent++;
 }
 let crossY=0,boundaryRows=0;
 for(let i=1;i<spec.rows;i++){
  const b=spec.marginY+i*(spec.cellHeight+spec.spacingY);if(b<1||b>=rl.height)continue;
  boundaryRows++;crossY+=sharedColumns(rl,b-1,b);
 }
 const filled=cells.filter(Boolean),widths=filled.map(c=>c.x1-c.x0),heights=filled.map(c=>c.y1-c.y0+1);
 const offsets=[],bottoms=[];
 cells.forEach((c,i)=>{if(!c)return;const col=i%spec.columns,row=Math.floor(i/spec.columns),r=cellRect(spec,col,row);offsets.push(c.x0-r.x);bottoms.push(r.y+r.h-1-c.y1);});
 const spread=(v,size)=>size>0?clamp01(1-stdev(v)/(size*.5)):0;
 const consistency=filled.length>1?clamp01((spread(widths,spec.cellWidth)+spread(heights,spec.cellHeight)+spread(offsets,spec.cellWidth)+spread(bottoms,spec.cellHeight))/4):filled.length?.5:0;
 const crossRatio=clamp01((crossX/Math.max(1,rowsWithContent*Math.max(1,verticalEdges.length))+crossY/Math.max(1,boundaryRows*Math.max(1,rl.width)))/2);
 let splitX=0,spanX=0,splitY=0,spanY=0;
 if(profile)for(const c of filled){
  spanX+=c.x1-c.x0;for(let x=c.x0+1;x<c.x1-1;x++)if(profile.emptyCols[x])splitX++;
  spanY+=c.y1-c.y0+1;for(let y=c.y0+1;y<c.y1;y++)if(profile.emptyRows[y])splitY++;
 }
 const splitRatio=profile?mean([spanX?splitX/spanX:0,spanY?splitY/spanY:0]):0;
 return {cells,filled:filled.length,coverage:cells.length?filled.length/cells.length:0,consistency,crossX,crossY,crossRatio,
  splitColumns:splitX,splitRows:splitY,splitRatio,
  outsidePixels:outside,insidePixels:inside,outsideRatio:inside+outside?outside/(inside+outside):0};
}
function sharedColumns(rl,y0,y1){
 const a=[],from=rl.rows[y0],to=rl.rows[y0+1];
 for(let i=from;i<to;i++)a.push([rl.runs[i*2],rl.runs[i*2+1]]);
 if(!a.length)return 0;
 let shared=0;
 for(let i=rl.rows[y1];i<rl.rows[y1+1];i++){
  const x0=rl.runs[i*2],x1=rl.runs[i*2+1];
  for(const [a0,a1] of a){const lo=Math.max(x0,a0),hi=Math.min(x1,a1);if(hi>lo)shared+=hi-lo;}
 }
 return shared;
}
/** Suggests grids for a sheet, best first.
 * @param src        {data,width,height} RGBA or {width,height,read(rect)}
 * @param candidates cell sizes to try (default CELL_CANDIDATES + sizes the sheet's own periodicity
 *                   suggests + anything in `custom`)
 * @returns {profile, suggestions:[GridSpec & {score,confidence,evidence,reasons}], candidates} */
export function detectGrid(src,{candidates=CELL_CANDIDATES,custom=[],threshold=ALPHA_THRESHOLD,maxMargin=MAX_MARGIN,maxSpacing=MAX_SPACING,minCells=1,limit=6,perAxis=4,signal}={}){
 const s=source(src),profile=alphaProfile(s,{threshold,signal}),rl=runLengths(s,{threshold,signal});
 if(!profile.opaque)return {profile,suggestions:[],candidates:{x:[],y:[]},reason:'The sheet is fully transparent.'};
 const derivedX=periodCandidates(profile.cols),derivedY=periodCandidates(profile.rows);
 // A measured pitch P means cell+spacing=P, so every cell from P down to P-maxSpacing is a real
 // candidate — that is how a 40px cell with 5px spacing is found without 40 being a preset.
 const fromPitch=peaks=>peaks.flatMap(({lag})=>{const out=[];for(let s=0;s<=maxSpacingFor(lag,maxSpacing);s++)out.push(lag-s);return out;});
 const listX=[...new Set([...candidates,...custom,...fromPitch(derivedX)])].filter(v=>Number.isSafeInteger(v)&&v>1).sort((a,b)=>a-b);
 const listY=[...new Set([...candidates,...custom,...fromPitch(derivedY)])].filter(v=>Number.isSafeInteger(v)&&v>1).sort((a,b)=>a-b);
 const common=new Set([...candidates,...custom]);
 const axisX=axisCandidates(s.width,profile.cols,profile.emptyCols,{candidates:listX,common,maxMargin,maxSpacing,minCells}),
       axisY=axisCandidates(s.height,profile.rows,profile.emptyRows,{candidates:listY,common,maxMargin,maxSpacing,minCells});
 const suggestions=[];
 for(const x of axisX.slice(0,perAxis))for(const y of axisY.slice(0,perAxis)){
  const spec={cellWidth:x.cell,cellHeight:y.cell,marginX:x.margin,marginY:y.margin,spacingX:x.spacing,spacingY:y.spacing,columns:x.count,rows:y.count,cells:x.count*y.count};
  if(spec.cells>MAX_FRAMES)continue;
  const ev=cellEvidence(rl,spec,profile);
  if(!ev.filled)continue;
  const periodicity=mean([x.periodicity,y.periodicity]),tiling=mean([x.tiling,y.tiling]),symmetry=mean([x.symmetry,y.symmetry]);
  const commonSize=(common.has(x.cell)?1:.92)*(common.has(y.cell)?1:.92);
  let score=clamp01(periodicity*.24+ev.consistency*.24+tiling*.20+symmetry*.12+ev.coverage*.10+(1-ev.outsideRatio)*.10);
  score*=(1-clamp01(ev.crossRatio*8))*(1-clamp01(ev.outsideRatio))*(1-clamp01(ev.splitRatio))*commonSize;
  const evidence={separatorRatioX:x.separator,separatorRatioY:y.separator,separatorLinesX:x.separatorLines,separatorLinesY:y.separatorLines,
   periodicityX:x.periodicity,periodicityY:y.periodicity,boundaryDipX:x.dip,boundaryDipY:y.dip,boundsConsistency:ev.consistency,
   coverage:ev.coverage,filledCells:ev.filled,crossingsX:ev.crossX,crossingsY:ev.crossY,crossRatio:ev.crossRatio,
   splitColumns:ev.splitColumns,splitRows:ev.splitRows,splitRatio:ev.splitRatio,tiling,symmetry,commonSize:commonSize===1,
   outsidePixels:ev.outsidePixels,outsideRatio:ev.outsideRatio,exactFitX:x.exact,exactFitY:y.exact};
  suggestions.push({...spec,score,confidence:score>=.75?'high':score>=.5?'medium':'low',evidence,reasons:reasonsFor(spec,evidence)});
 }
 suggestions.sort((a,b)=>b.score-a.score||a.cells-b.cells);
 const best=suggestions.slice(0,limit);
 return {profile,runs:rl,suggestions:best,candidates:{x:axisX,y:axisY,derivedX,derivedY}};
}
function reasonsFor(spec,e){
 const out=[],pct=v=>`${Math.round(v*100)}%`;
 if(e.separatorLinesX+e.separatorLinesY>0)out.push(`${e.separatorLinesX+e.separatorLinesY} margin/spacing row and column lines, ${pct(mean([e.separatorRatioX,e.separatorRatioY].filter(v=>v!==null)))} of them fully transparent`);
 else out.push('no margin or spacing: cells are edge to edge, so separator lines carry no evidence');
 out.push(`occupancy repeats every ${spec.cellWidth+spec.spacingX}px across and ${spec.cellHeight+spec.spacingY}px down (autocorrelation ${e.periodicityX.toFixed(2)} / ${e.periodicityY.toFixed(2)})`);
 out.push(`content bounds agree between cells at ${pct(e.boundsConsistency)}`);
 out.push(e.crossingsX+e.crossingsY?`content runs across cell boundaries in ${e.crossingsX+e.crossingsY} places`:'no content crosses a cell boundary');
 if(e.splitColumns+e.splitRows)out.push(`a blank line still splits content inside the cells (${e.splitColumns} columns, ${e.splitRows} rows) — the cell may be too large`);
 if(!e.commonSize)out.push('this cell size is not one of the common authoring sizes, so it needs stronger evidence');
 if(e.outsidePixels)out.push(`${e.outsidePixels} opaque pixels fall outside the cells`);
 out.push(`${e.filledCells} of ${spec.cells} cells hold content`);
 return out;
}
