import {MAX_FRAMES,frameNumber,positive,placement,rectangle} from './primitives.js';
/** Pure frame model shared by the sprite slicer, the frame normaliser and their exports.
 * No DOM, no canvas, no application state: rectangles in source-sheet pixels in, rectangles
 * and layout out. A frame is the single source of truth for the overlay, the strip, the
 * animation preview and every exported file, so a preview can never disagree with a download:
 *   {id, sourceRect:{x,y,w,h}, trimmedRect:{x,y,w,h}|null, canvasWidth, canvasHeight,
 *    offsetX, offsetY, pivotX, pivotY, duration, tag}
 * `sourceRect` is where the frame sits on the sheet; `trimmedRect` is the opaque part of it
 * (also in sheet pixels); canvas/offset describe where that part lands on the output canvas. */
export const SCHEMA_VERSION=1;
export const CELL_SIZES=Object.freeze([8,16,24,32,48,64,96,128]);
export const ANCHORS=Object.freeze({'bottom-center':{align:'bottom',anchor:.5},center:{align:'center',anchor:.5},'top-left':{align:'top',anchor:0}});
const median=list=>{if(!list.length)return 0;const s=[...list].sort((a,b)=>a-b);return s[s.length>>1];};
export const rect=(x,y,w,h)=>({x,y,w,h});
export const boxOf=f=>f.trimmedRect||f.sourceRect;
export function makeFrame(id,sourceRect,extra={}){
 const r=rect(sourceRect.x,sourceRect.y,sourceRect.w,sourceRect.h);
 return {id,sourceRect:r,trimmedRect:null,canvasWidth:r.w,canvasHeight:r.h,offsetX:0,offsetY:0,pivotX:.5,pivotY:1,duration:null,tag:'',...extra};
}
/** Undo is a snapshot of this array, never of pixels: frames stay small and serialisable. */
export const snapshot=frames=>JSON.parse(JSON.stringify(frames));
export function clampRect(r,w,h){
 const x=Math.max(0,Math.min(w-1,Math.round(r.x))),y=Math.max(0,Math.min(h-1,Math.round(r.y)));
 return rectangle({x,y,w:Math.max(1,Math.min(w-x,Math.round(r.w))),h:Math.max(1,Math.min(h-y,Math.round(r.h)))},w,h);
}
/** Boxes that overlap, touch, or sit within `distance` of each other describe one sprite. */
export function mergeRects(rects,distance=0){
 if(!Number.isInteger(distance)||distance<0||distance>4096)throw Error('Invalid merge distance');
 const out=rects.map(r=>({...r}));
 for(let merged=true;merged;){
  merged=false;
  for(let i=0;i<out.length&&!merged;i++)for(let j=i+1;j<out.length;j++){
   const a=out[i],b=out[j];
   if(a.x-distance>b.x+b.w||b.x-distance>a.x+a.w||a.y-distance>b.y+b.h||b.y-distance>a.y+a.h)continue;
   out[i]=union(a,b);out.splice(j,1);merged=true;break;
  }
 }
 return out;
}
export function union(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y,area:(a.area||a.w*a.h)+(b.area||b.w*b.h)};}
/** Cells of a sheet with a margin before the first cell and a gutter between cells. A cell that
 * would reach past an edge is dropped rather than clipped (primitives.grid needs exact division). */
export function gridFrames(w,h,{cellW,cellH,offsetX=0,offsetY=0,spacingX=0,spacingY=0,columns=0,rows=0}={}){
 positive(w);positive(h);positive(cellW,w);positive(cellH,h);
 for(const v of [offsetX,offsetY,spacingX,spacingY])if(!Number.isInteger(v)||v<0||v>8192)throw Error('Invalid grid margin or spacing');
 for(const v of [columns,rows])if(!Number.isInteger(v)||v<0||v>MAX_FRAMES)throw Error('Invalid column or row count');
 const fits=(size,offset,cell,gap)=>Math.max(0,Math.floor((size-offset+gap)/(cell+gap)));
 const cols=columns||fits(w,offsetX,cellW,spacingX),lines=rows||fits(h,offsetY,cellH,spacingY);
 if(!cols||!lines)throw Error('The grid does not fit inside the image');
 if(cols*lines>MAX_FRAMES)throw Error(`At most ${MAX_FRAMES} frames`);
 const out=[];
 for(let r=0;r<lines;r++)for(let c=0;c<cols;c++){
  const x=offsetX+c*(cellW+spacingX),y=offsetY+r*(cellH+spacingY);
  if(x+cellW<=w&&y+cellH<=h)out.push({x,y,w:cellW,h:cellH,row:r,column:c});
 }
 if(!out.length)throw Error('The grid does not fit inside the image');
 return out;
}
/** The order a person reads the sheet in: rows top to bottom, each row left to right. A box joins
 * the row it still overlaps vertically, so a bobbing walk cycle stays on one line. */
export function readingOrder(rects,tolerance=0){
 if(!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid row tolerance');
 const rows=[];
 for(const r of [...rects].sort((a,b)=>a.y-b.y||a.x-b.x)){
  const row=rows.find(list=>r.y<=list.bottom+tolerance);
  if(row){row.push(r);row.bottom=Math.max(row.bottom,r.y+r.h-1);}
  else{const list=[r];list.bottom=r.y+r.h-1;rows.push(list);}
 }
 return rows.flatMap(list=>list.sort((a,b)=>a.x-b.x));
}
export const rowTolerance=rects=>rects.length?Math.round(median(rects.map(r=>r.h))/2):0;
export function orderFrames(frames,tolerance=0){
 const order=new Map(readingOrder(frames.map(f=>({...f.sourceRect,id:f.id})),tolerance).map((r,i)=>[r.id,i]));
 return [...frames].sort((a,b)=>order.get(a.id)-order.get(b.id));
}
export function mergeFrames(frames,ids){
 const set=new Set(ids),chosen=frames.filter(f=>set.has(f.id));
 if(chosen.length<2)return frames;
 const merged=makeFrame(chosen[0].id,chosen.reduce((a,f)=>union(a,f.sourceRect),chosen[0].sourceRect),{tag:chosen[0].tag});
 const out=[];let placed=false;
 for(const f of frames){if(!set.has(f.id))out.push(f);else if(!placed){out.push(merged);placed=true;}}
 return out;
}
/** Where every frame lands on its output canvas. `each` gives every frame its own canvas;
 * `common` gives all of them one canvas, which is what an engine's animation player expects. */
export function layoutFrames(frames,{mode='each',align='bottom',anchor=.5,padding=0,width=0,height=0}={}){
 if(!frames.length)return {frames:[],width:0,height:0};
 if(!Number.isInteger(padding)||padding<0||padding>512)throw Error('Invalid padding');
 const boxes=frames.map(boxOf);
 const inner={w:mode==='common'?(width||Math.max(...boxes.map(b=>b.w))):0,h:mode==='common'?(height||Math.max(...boxes.map(b=>b.h))):0};
 const out=frames.map((f,i)=>{
  const b=boxes[i],canvasW=mode==='common'?inner.w+padding*2:b.w+padding*2,canvasH=mode==='common'?inner.h+padding*2:b.h+padding*2;
  positive(canvasW);positive(canvasH);
  const p=mode==='common'?placement(b.w,b.h,inner.w,inner.h,align,anchor):{x:0,y:0};
  return {...f,canvasWidth:canvasW,canvasHeight:canvasH,offsetX:p.x+padding,offsetY:p.y+padding};
 });
 return {frames:out,width:mode==='common'?out[0].canvasWidth:0,height:mode==='common'?out[0].canvasHeight:0,uniform:mode==='common'};
}
export const frameName=(prefix,i,count,ext='png')=>`${prefix}_${frameNumber(i,count)}.${ext}`;
/** JSON only, frame rects in source-sheet pixels, in the order the strip shows. */
export function metadata(frames,{tool,sourceWidth,sourceHeight,mode='auto',fps=12,prefix='sprite',extra={}}={}){
 return {schemaVersion:SCHEMA_VERSION,tool,mode,fps,source:{width:sourceWidth,height:sourceHeight},
  frameWidth:frames.length&&frames.every(f=>f.canvasWidth===frames[0].canvasWidth)?frames[0].canvasWidth:null,
  frameHeight:frames.length&&frames.every(f=>f.canvasHeight===frames[0].canvasHeight)?frames[0].canvasHeight:null,
  frames:frames.map((f,i)=>({name:frameName(prefix,i,frames.length),index:i,
   x:boxOf(f).x,y:boxOf(f).y,w:boxOf(f).w,h:boxOf(f).h,
   sourceRect:f.sourceRect,trimmedRect:f.trimmedRect,
   canvasWidth:f.canvasWidth,canvasHeight:f.canvasHeight,offsetX:f.offsetX,offsetY:f.offsetY,
   pivotX:f.pivotX,pivotY:f.pivotY,duration:f.duration,tag:f.tag})),...extra};
}
/** Which rectangles each row of the sheet touches: lets one pass over the rows measure every
 * frame without ever scanning a pixel twice or holding the whole sheet. */
export function rowBuckets(rects,h){
 const map=new Map();
 rects.forEach((r,i)=>{for(let y=Math.max(0,r.y);y<Math.min(h,r.y+r.h);y++){const list=map.get(y);if(list)list.push(i);else map.set(y,[i]);}});
 return map;
}
export const emptyBounds=()=>({x0:Infinity,x1:-1,y0:Infinity,y1:-1});
export const accBox=a=>a.x1<0?null:{x:a.x0,y:a.y0,w:a.x1-a.x0+1,h:a.y1-a.y0+1};
/** One strip of rows: grows each rectangle's opaque bounds and marks the content profile. */
export function scanRows(data,w,y0,rows,{rects,acc,buckets,columns=null,rowFlags=null,threshold=8}){
 if(data.length!==w*rows*4)throw Error('Invalid RGBA strip');
 for(let row=0;row<rows;row++){
  const y=y0+row,base=row*w;
  if(columns||rowFlags)for(let x=0;x<w;x++)if(data[(base+x)*4+3]>threshold){if(columns)columns[x]=1;if(rowFlags)rowFlags[y]=1;}
  for(const i of buckets.get(y)||[]){
   const r=rects[i],a=acc[i],end=Math.min(w,r.x+r.w);
   for(let x=Math.max(0,r.x);x<end;x++)if(data[(base+x)*4+3]>threshold){if(x<a.x0)a.x0=x;if(x>a.x1)a.x1=x;if(y<a.y0)a.y0=y;if(y>a.y1)a.y1=y;}
  }
 }
}
/** Which columns and rows of a sheet hold anything: the basis of separator detection. */
export function contentProfile(data,w,h,threshold=8){
 if(data.length!==w*h*4)throw Error('Invalid RGBA data');
 const columns=new Uint8Array(w),rows=new Uint8Array(h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>threshold){columns[x]=1;rows[y]=1;}
 return {columns,rows};
}
export function contentRuns(flags){
 const runs=[];
 for(let i=0;i<flags.length;i++){if(!flags[i])continue;const start=i;while(i<flags.length&&flags[i])i++;runs.push({start,len:i-start});}
 return runs;
}
/** Cell size, margin and gutter read off one axis of transparent separator lines. */
export function axisGuess(flags){
 const runs=contentRuns(flags);if(runs.length<2)return null;
 const lens=[...new Set(runs.map(r=>r.len))],gaps=runs.slice(1).map((r,i)=>r.start-(runs[i].start+runs[i].len)),gapSet=[...new Set(gaps)];
 if(lens.length===1&&gapSet.length===1)return {cell:lens[0],offset:runs[0].start,spacing:gapSet[0],count:runs.length};
 const pitch=median(runs.slice(1).map((r,i)=>r.start-runs[i].start)),gap=median(gaps);
 if(pitch<=gap)return null;
 return {cell:pitch-gap,offset:runs[0].start,spacing:Math.max(0,gap),count:runs.length};
}
/** Recommended cell sizes, never a forced pick: separator spacing first, then the detected
 * sprites' own extent, then the sizes that divide the sheet exactly (8…128). */
export function suggestCells(w,h,{rects=[],profile=null,sizes=CELL_SIZES}={}){
 const out=[],add=(cellW,cellH,reason,rest={})=>{
  if(!(cellW>=1&&cellH>=1&&cellW<=w&&cellH<=h))return;
  const key=[Math.round(cellW),Math.round(cellH),rest.offsetX|0,rest.offsetY|0,rest.spacingX|0,rest.spacingY|0].join(':');
  if(out.some(s=>s.key===key))return;
  out.push({key,cellW:Math.round(cellW),cellH:Math.round(cellH),reason,offsetX:0,offsetY:0,spacingX:0,spacingY:0,...rest,
   columns:Math.max(1,Math.floor((w-(rest.offsetX||0)+(rest.spacingX||0))/(Math.round(cellW)+(rest.spacingX||0)))),
   rows:Math.max(1,Math.floor((h-(rest.offsetY||0)+(rest.spacingY||0))/(Math.round(cellH)+(rest.spacingY||0))))});
 };
 if(profile){
  const x=axisGuess(profile.columns),y=axisGuess(profile.rows);
  if(x&&y)add(x.cell,y.cell,'separators',{offsetX:x.offset,offsetY:y.offset,spacingX:x.spacing,spacingY:y.spacing});
  if(x&&!y)add(x.cell,h,'separators',{offsetX:x.offset,spacingX:x.spacing});
 }
 if(rects.length)add(Math.max(...rects.map(r=>r.w)),Math.max(...rects.map(r=>r.h)),'frames');
 if(rects.length)add(median(rects.map(r=>r.w)),median(rects.map(r=>r.h)),'frames');
 for(const s of sizes)if(w%s===0&&h%s===0)add(s,s,'divides');
 return out.slice(0,6);
}
