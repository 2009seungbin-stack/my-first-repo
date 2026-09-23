/** Turning detected islands into frames, and frames into a common canvas. Pure functions.
 *
 * A sprite is rarely one connected island: a sword, a hat, a trailing cape or a limb drawn with a
 * one-pixel gap all come back as separate alpha components. `mergeRects` glues components whose
 * rectangles are within `distance` pixels of each other (union-find over rectangle gaps), so one
 * character stays one frame. `readingOrder` then sorts them the way a person reads the sheet.
 *
 * `normalizeFrames` puts every frame on one canvas. It only ever *moves* pixels by whole pixels:
 * nothing is scaled, resampled or filtered, and the frame's boxes, collision polygons and pivot
 * move with the pixels so the model stays self-consistent.
 *
 * "bottom" here means the bottom of the frame's alpha bounding box — the lowest opaque pixel. It is
 * not foot detection: a trailing cape, a shadow or a dust puff below the feet lowers it. */
import {source,boundsIn,checkRect,innerRect,ALPHA_THRESHOLD} from './pixels.js';
import {frameNumber,MAX_FRAMES} from '../primitives.js';
import {labelIslands,labelIslandsAsync} from './islands.js';
import {frame as makeFrame,pivotPixels} from './model.js';
export const ALIGNMENTS=Object.freeze(['center','top','bottom','left','right','bottom-center','top-left','custom']);
const clamp01=v=>v<0?0:v>1?1:v;
const median=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
export const rectGap=(a,b)=>({x:Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w)),y:Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h))});
export const unionRect=rects=>{
 const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));
 return {x,y,w:Math.max(...rects.map(r=>r.x+r.w))-x,h:Math.max(...rects.map(r=>r.y+r.h))-y};
};
/** Merges rectangles whose gap is at most `distance` on both axes. distance 0 merges only touching
 * or overlapping rectangles. Returns one rectangle per group, with the members in `parts`. */
export function mergeRects(rects,{distance=2,maxFrames=MAX_FRAMES}={}){
 if(!Number.isSafeInteger(distance)||distance<0||distance>512)throw Error('Merge distance must be 0…512 pixels');
 const items=rects.map((r,i)=>({...checkRect({...r,x:r.x,y:r.y},Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,'component'),area:r.area??r.w*r.h,index:i}));
 const order=[...items].sort((a,b)=>a.x-b.x||a.y-b.y),parent=items.map((_,i)=>i);
 const find=i=>{while(parent[i]!==i)i=parent[i]=parent[parent[i]];return i;};
 for(let i=0;i<order.length;i++)for(let j=i+1;j<order.length;j++){
  const a=order[i],b=order[j];
  if(b.x>a.x+a.w+distance)break;
  const gap=rectGap(a,b);
  if(gap.x<=distance&&gap.y<=distance){const ra=find(a.index),rb=find(b.index);if(ra!==rb)parent[ra]=rb;}
 }
 const groups=new Map();
 for(const item of items){const root=find(item.index);(groups.get(root)||groups.set(root,[]).get(root)).push(item);}
 if(groups.size>maxFrames)throw Error(`${groups.size} frame candidates: raise the minimum area or the merge distance`);
 return [...groups.values()].map(parts=>({...unionRect(parts),area:parts.reduce((s,p)=>s+p.area,0),parts:parts.map(p=>p.index).sort((a,b)=>a-b)}));
}
const stdev=a=>{if(a.length<2)return 0;const m=a.reduce((s,v)=>s+v,0)/a.length;return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/a.length);};
const spreadOf=a=>{if(a.length<2)return 1;const m=a.reduce((s,v)=>s+v,0)/a.length;return m>0?clamp01(1-stdev(a)/m):0;};
/** Every merge distance at which *something* new joins: for each pair, max(gapX,gapY) is the
 * smallest distance that would join them, so the distinct values of that are the only distances
 * where the answer can change. Trying 0…N one by one would do the same work N times over. */
export function mergeThresholds(rects,{maxDistance=16}={}){
 const out=new Set();
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
  const gap=rectGap(rects[i],rects[j]),need=Math.max(gap.x,gap.y);
  if(need>0&&need<=maxDistance)out.add(need);
 }
 return [...out].sort((a,b)=>a-b);
}
/** How good a merge distance looks, on the two things a person judges it by: are the frames all
 * about the same size, and does each frame's box actually hold artwork rather than empty space. */
export function mergeEvidence(rects,distance,{maxFrames=MAX_FRAMES}={}){
 const groups=mergeRects(rects,{distance,maxFrames});
 const fill=clamp01(groups.reduce((s,g)=>s+g.area,0)/Math.max(1,groups.reduce((s,g)=>s+g.w*g.h,0)));
 // A single group has no sizes to compare, so its own tightness stands in for consistency —
 // capped, so "everything merged into one box" can never beat a genuinely uniform set of frames.
 const consistency=groups.length>1?(spreadOf(groups.map(g=>g.w))+spreadOf(groups.map(g=>g.h)))/2:Math.min(.8,fill);
 return {distance,frames:groups.length,parts:rects.length,consistency,fill,groups};
}
/** Picks the merge distance by itself. A sprite's hat, sword or cape sits 1–3px off its body, so
 * "one component = one frame" is wrong far more often than it is right; but merging blindly glues
 * neighbouring characters together. So: try only the distances at which something actually joins
 * (`mergeThresholds`), and score each on frame-size consistency, box fill, and how long the answer
 * survives before the next merge happens — the plateau the frame count settles on.
 *
 * If the raw components are already uniform (`UNIFORM_AT_ZERO`), nothing is merged at all: a sheet
 * whose islands are all the same size is a sheet whose islands are the sprites.
 * @returns {distance, frames, candidates, reason} — `reason` is UI-ready. */
export const UNIFORM_AT_ZERO=.85;
export function autoMergeDistance(rects,{maxDistance=16,maxFrames=MAX_FRAMES}={}){
 if(!Number.isSafeInteger(maxDistance)||maxDistance<0||maxDistance>512)throw Error('maxDistance must be 0…512 pixels');
 const base=mergeEvidence(rects,0,{maxFrames});
 if(rects.length<2)return {distance:0,frames:base.frames,candidates:[scored(base,1,maxDistance)],reasonCode:'single',reason:'one island, nothing to merge'};
 const thresholds=mergeThresholds(rects,{maxDistance});
 if(!thresholds.length)return {distance:0,frames:base.frames,candidates:[scored(base,maxDistance+1,maxDistance)],
  reasonCode:'apart',until:maxDistance,reason:`no two islands are within ${maxDistance}px of each other`};
 if(base.consistency>=UNIFORM_AT_ZERO)return {distance:0,frames:base.frames,candidates:[scored(base,thresholds[0],maxDistance)],
  reasonCode:'uniform',consistency:base.consistency,reason:`the islands are already ${Math.round(base.consistency*100)}% the same size, so each one is a frame`};
 const all=[0,...thresholds],candidates=all.map((d,i)=>scored(mergeEvidence(rects,d,{maxFrames}),all[i+1]??maxDistance+1,maxDistance));
 const best=candidates.reduce((a,b)=>b.score>a.score+1e-9?b:a);
 return {distance:best.distance,frames:best.frames,candidates,
  reasonCode:best.distance===0?'noGain':'merged',consistency:best.consistency,until:best.until,
  reason:best.distance===0?'merging nearby islands did not make the frames more consistent'
   :`${best.frames} frames of ${Math.round(best.consistency*100)}% equal size, and nothing else joins until ${best.until}px`};
}
function scored(evidence,nextThreshold,maxDistance){
 const stability=clamp01((nextThreshold-evidence.distance)/Math.max(1,maxDistance));
 // Gluing many separate islands into a single frame is how a sheet whose frames nearly touch
 // becomes "1 frame": nothing can join after everything has, so it looks perfectly stable. A
 // single group from four to seven islands is only a frame when it is compact artwork; eight or
 // more separate islands in one box is a sheet.
 const swallowed=evidence.frames===1&&(evidence.parts>=8||evidence.parts>=4&&evidence.fill<.5);
 return {...evidence,groups:undefined,until:nextThreshold,stability,swallowed,score:swallowed?0:evidence.consistency*.5+evidence.fill*.2+stability*.3};
}
/** Auto reads islands; frames drawn edge to edge touch and come back as one island. When a grid
 * suggestion is available, this says whether Auto's frames straddle its cells — the signal to
 * offer the grid instead of trusting the island count. Pure rectangles in, numbers out. */
export function autoVersusGrid(rects,grid){
 if(!grid||!rects.length)return null;
 const cw=grid.cellWidth,ch=grid.cellHeight;
 const spanning=rects.filter(r=>r.w>cw*1.25+(grid.spacingX||0)||r.h>ch*1.25+(grid.spacingY||0)).length;
 const gridFrames=grid.evidence?.filledCells??grid.cells;
 return {spanning,gridFrames,autoFrames:rects.length,cell:{w:cw,h:ch},
  recommend:grid.confidence!=='low'&&spanning>=2&&gridFrames>rects.length};
}
/** Sorts rectangles the way the sheet reads: rows top to bottom, then left to right inside a row.
 * `rowTolerance:'auto'` uses 35% of the median height, which keeps a tall sprite and a short one
 * on the same row but separates rows that merely overlap by a pixel. */
export function readingOrder(rects,{rowTolerance='auto',rightToLeft=false}={}){
 if(!rects.length)return [];
 const tolerance=rowTolerance==='auto'?Math.max(2,Math.round(median(rects.map(r=>r.h))*.35)):rowTolerance;
 if(!Number.isFinite(tolerance)||tolerance<0)throw Error('rowTolerance must be a non-negative number or "auto"');
 const rows=[];
 for(const r of [...rects].sort((a,b)=>a.y-b.y||a.x-b.x)){
  const centre=r.y+r.h/2,row=rows.find(g=>Math.abs(centre-g.centre)<=tolerance||(r.y<g.bottom&&r.y+r.h>g.top&&Math.abs(centre-g.centre)<=Math.max(tolerance,Math.min(r.h,g.bottom-g.top)/2)));
  if(row){row.items.push(r);row.top=Math.min(row.top,r.y);row.bottom=Math.max(row.bottom,r.y+r.h);row.centre=row.items.reduce((s,i)=>s+i.y+i.h/2,0)/row.items.length;}
  else rows.push({items:[r],top:r.y,bottom:r.y+r.h,centre});
 }
 rows.sort((a,b)=>a.centre-b.centre);
 const out=[];
 rows.forEach((row,index)=>{row.items.sort((a,b)=>rightToLeft?b.x-a.x||a.y-b.y:a.x-b.x||a.y-b.y).forEach(r=>out.push({...r,row:index}));});
 return out;
}
/** Small islands (under `minArea`) are sparks, slash trails, dust, a detached pixel of hair. They
 * belong to a frame far more often than they are frames, but silently dropping them loses real
 * artwork. Each one is attached to the nearest frame when that is unambiguous — close enough,
 * clearly closer than any other frame, and the grown frame does not run into a neighbour —
 * and is otherwise returned as `unassigned` so the caller can show it and offer to include it.
 * Nothing is ever dropped: every small island ends up in exactly one of the two lists.
 * @returns {rects, attached:[{island,frame}], unassigned:[island], reach} */
export const ATTACH_LIMIT=20_000;
export function attachSmallIslands(rects,small,{distance=0,reach='auto'}={}){
 const groups=rects.map(r=>({...r,parts:r.parts?[...r.parts]:[],smallParts:[]})),attached=[],unassigned=[];
 if(!small.length||!groups.length)return {rects:groups,attached,unassigned:[...small],reach:0};
 const limit=reach==='auto'?Math.max(distance,2,Math.round(median(groups.map(g=>Math.min(g.w,g.h)))*.5)):reach;
 if(small.length>ATTACH_LIMIT)return {rects:groups,attached,unassigned:[...small],reach:limit};
 const gapOf=(a,b)=>{const g=rectGap(a,b);return Math.max(g.x,g.y);};
 const overlaps=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
 // Nearest first, so a spark grows its frame before a farther one is judged against it.
 const order=small.map(island=>{let best=Infinity;for(const g of groups)best=Math.min(best,gapOf(island,g));return {island,best};}).sort((a,b)=>a.best-b.best);
 for(const {island} of order){
  let first=-1,firstGap=Infinity,secondGap=Infinity;
  groups.forEach((g,i)=>{const gap=gapOf(island,g);if(gap<firstGap){secondGap=firstGap;firstGap=gap;first=i;}else if(gap<secondGap)secondGap=gap;});
  const g=groups[first];
  const inside=island.x>=g.x&&island.y>=g.y&&island.x+island.w<=g.x+g.w&&island.y+island.h<=g.y+g.h;
  const clear=inside||firstGap<=limit&&(secondGap===Infinity||secondGap>=firstGap*2+2);
  const grown=inside?g:unionRect([g,island]);
  if(!clear||!inside&&groups.some((other,i)=>i!==first&&overlaps(grown,other))){unassigned.push(island);continue;}
  Object.assign(g,{x:grown.x,y:grown.y,w:grown.w,h:grown.h,area:g.area+island.area});g.smallParts.push(island);
  attached.push({island,frame:first});
 }
 return {rects:groups,attached,unassigned,reach:limit};
}
/** Frames from labelled islands (src/game/islands.js): merge → attach small islands → order. */
export function framesFromIslands(labelled,{distance='auto',rowTolerance='auto',maxFrames=MAX_FRAMES,maxDistance=16,rightToLeft=false,attach=true}={}){
 const found=labelled.islands,small=labelled.small||[];
 const auto=distance==='auto'?(found.length?autoMergeDistance(found,{maxDistance,maxFrames}):{distance:0,frames:0,candidates:[],reason:'the sheet is empty'}):null;
 const used=auto?auto.distance:distance;
 const merged=mergeRects(found,{distance:used,maxFrames});
 const placed=attach?attachSmallIslands(merged,small,{distance:used}):{rects:merged,attached:[],unassigned:[...small],reach:0};
 const rects=readingOrder(placed.rects,{rowTolerance,rightToLeft});
 const attachedPixels=placed.attached.reduce((s,a)=>s+a.island.area,0);
 return {components:found,rects,rows:rects.length?rects[rects.length-1].row+1:0,distance:used,auto,
  attached:placed.attached,unassigned:placed.unassigned,reach:placed.reach,
  // Exact even when the small-island list was truncated: whatever is not attached is reported.
  smallCount:labelled.smallCount??small.length,unassignedPixels:(labelled.smallPixels??small.reduce((s,i)=>s+i.area,0))-attachedPixels};
}
/** Detects frames on a sheet: alpha islands → merged into frames → small islands attached or
 * reported → read in order. `distance:'auto'` lets `autoMergeDistance` choose, and reports what
 * it chose and why. The sheet is read band by band (no size cap below MAX_SHEET_PIXELS); every
 * opaque pixel ends up inside a frame rectangle or in `unassigned`. */
export function detectFrames(src,{threshold=ALPHA_THRESHOLD,minArea=4,maxFrames=MAX_FRAMES,...options}={}){
 return framesFromIslands(labelIslands(src,{threshold,minArea,maxIslands:maxFrames}),{maxFrames,...options});
}
/** detectFrames that yields between bands (`pause`, e.g. resources.yieldUI) for large sheets. */
export async function detectFramesAsync(src,{threshold=ALPHA_THRESHOLD,minArea=4,maxFrames=MAX_FRAMES,pause,progress,signal,...options}={}){
 const labelled=await labelIslandsAsync(src,{threshold,minArea,maxIslands:maxFrames,pause,progress,signal});
 signal?.throwIfAborted?.();
 return framesFromIslands(labelled,{maxFrames,...options});
}
/** Model frames for a list of sheet rectangles. `trim` records the alpha bounding box inside each
 * rectangle as `trimmedRect` (the pixels stay where they are; nothing is cropped yet). */
export function framesFromRects(src,rects,{trim=true,threshold=ALPHA_THRESHOLD,trimThreshold=0,prefix='frame_',tag='',pivotX,pivotY,skipEmpty=true,names}={}){
 const s=source(src),frames=[],empty=[];
 rects.forEach((r,i)=>{
  const sourceRect=checkRect(r,s.width,s.height,`frame ${i}`);
  // Trimming keeps every pixel that is not fully transparent: the alpha threshold decides what
  // counts as an island, not what may be cut away. A faint glow (alpha 1…8) at the edge of an FX
  // frame is art, and trimming it off changed every frame of a real 4096² hit-effect sheet.
  const trimmed=trim||skipEmpty?boundsIn(s,sourceRect,{threshold:Math.min(threshold,trimThreshold)}):null;
  if(!trimmed&&skipEmpty){empty.push(i);return;}
  frames.push(makeFrame({name:names?.[i]??`${prefix}${frameNumber(frames.length,rects.length)}`,sourceRect,trimmedRect:trim?trimmed:null,tag,
   ...(pivotX==null?{}:{pivotX}),...(pivotY==null?{}:{pivotY}),metadata:{row:r.row??0,parts:r.parts?.length??1}}));
 });
 return {frames,empty};
}
/** Where a frame's inner pixels sit on a padded canvas. Integer pixels only. */
export function alignOffset(innerW,innerH,canvasW,canvasH,align='bottom-center',{padding=0,anchorX=.5,anchorY=1}={}){
 if(!ALIGNMENTS.includes(align))throw Error(`Unknown alignment ${align}`);
 const boxW=canvasW-padding*2,boxH=canvasH-padding*2;
 if(innerW>boxW||innerH>boxH)throw Error(`A ${innerW}×${innerH} frame does not fit a ${canvasW}×${canvasH} canvas with ${padding}px padding`);
 const ax=align==='left'||align==='top-left'?0:align==='right'?1:align==='custom'?clamp01(anchorX):.5;
 const ay=align==='top'||align==='top-left'?0:align==='center'||align==='left'||align==='right'?.5:align==='custom'?clamp01(anchorY):1;
 return {x:padding+Math.round((boxW-innerW)*ax),y:padding+Math.round((boxH-innerH)*ay)};
}
/** Moves a frame's pixels to a new canvas position, taking pivot, hitboxes and collision with
 * them. Nothing is resampled: dx/dy are whole pixels. */
export function shiftFrame(f,dx,dy,canvasWidth=f.canvasWidth,canvasHeight=f.canvasHeight,{keepPivot=true}={}){
 if(!Number.isSafeInteger(dx)||!Number.isSafeInteger(dy))throw Error('A frame can only be moved by whole pixels');
 const pivot=pivotPixels(f);
 return makeFrame({...f,canvasWidth,canvasHeight,offsetX:f.offsetX+dx,offsetY:f.offsetY+dy,
  pivotX:keepPivot?(pivot.x+dx)/canvasWidth:f.pivotX,pivotY:keepPivot?(pivot.y+dy)/canvasHeight:f.pivotY,
  boxes:f.boxes.map(b=>b.shape==='rect'?{...b,x:b.x+dx,y:b.y+dy}:b.shape==='circle'?{...b,cx:b.cx+dx,cy:b.cy+dy}:{...b,points:b.points.map(([x,y])=>[x+dx,y+dy])}),
  collision:f.collision.map(p=>p.map(([x,y])=>[x+dx,y+dy]))});
}
/** Puts every frame on one canvas.
 * @param frames  model frames
 * @param width/height  explicit canvas, or omitted to use the largest frame + padding
 * @param align   one of ALIGNMENTS; 'bottom' and 'bottom-center' align the alpha bounding box's
 *                bottom edge, which is the lowest opaque pixel — not the character's feet
 * @param pivot   a PIVOT_PRESETS name, 'keep' (default: the pivot stays on the same pixel of the
 *                artwork) or explicit {x,y} normalised values
 * @returns {frames, canvasWidth, canvasHeight, shifts, warnings} */
export function normalizeFrames(frames,{width,height,align='bottom-center',padding=0,pivot='keep',anchorX=.5,anchorY=1}={}){
 if(!frames.length)throw Error('Add at least one frame.');
 if(!Number.isSafeInteger(padding)||padding<0||padding>256)throw Error('Padding must be 0…256 pixels');
 const inners=frames.map(f=>innerRect(f)),maxW=Math.max(...inners.map(r=>r.w)),maxH=Math.max(...inners.map(r=>r.h));
 const canvasWidth=width??maxW+padding*2,canvasHeight=height??maxH+padding*2;
 if(!Number.isSafeInteger(canvasWidth)||!Number.isSafeInteger(canvasHeight)||canvasWidth<1||canvasHeight<1)throw Error('Canvas size must be positive integers');
 const tooBig=frames.filter((f,i)=>inners[i].w>canvasWidth-padding*2||inners[i].h>canvasHeight-padding*2);
 if(tooBig.length)throw Error(`${tooBig.length} frame(s) do not fit ${canvasWidth}×${canvasHeight} with ${padding}px padding (largest is ${maxW}×${maxH}); pixels are never scaled, so raise the canvas`);
 const warnings=[],shifts=[],out=frames.map((f,i)=>{
  const to=alignOffset(inners[i].w,inners[i].h,canvasWidth,canvasHeight,align,{padding,anchorX,anchorY});
  const dx=to.x-f.offsetX,dy=to.y-f.offsetY;
  shifts.push({id:f.id,name:f.name,dx,dy});
  const moved=shiftFrame(f,dx,dy,canvasWidth,canvasHeight,{keepPivot:pivot==='keep'});
  if(pivot!=='keep'&&pivot)return applyPivot(moved,pivot);
  return moved;
 });
 const grew=frames.filter((f,i)=>f.canvasWidth!==canvasWidth||f.canvasHeight!==canvasHeight).length;
 if(grew)warnings.push(`${grew} frame(s) changed canvas to ${canvasWidth}×${canvasHeight}`);
 if(padding*2>=Math.min(canvasWidth,canvasHeight))warnings.push('Padding leaves no room for the artwork');
 return {frames:out,canvasWidth,canvasHeight,align,padding,shifts,warnings};
}
/** pivot: a PIVOT_PRESETS name, {x,y} normalised, or {x,y,pixels:true}. */
export function applyPivot(f,pivot){
 const presets={center:[.5,.5],'bottom-center':[.5,1],'top-left':[0,0],'top-center':[.5,0],'bottom-left':[0,1],top:[.5,0],bottom:[.5,1],left:[0,.5],right:[1,.5]};
 if(typeof pivot==='string'){const p=presets[pivot];if(!p)throw Error(`Unknown pivot preset ${pivot}`);return {...f,pivotX:p[0],pivotY:p[1]};}
 if(pivot&&Number.isFinite(pivot.x)&&Number.isFinite(pivot.y))return {...f,pivotX:pivot.pixels?pivot.x/f.canvasWidth:pivot.x,pivotY:pivot.pixels?pivot.y/f.canvasHeight:pivot.y};
 throw Error('A pivot is a preset name, {x,y} or {x,y,pixels:true}');
}
/** Crops each frame to its own alpha bounds: sourceRect becomes the trimmed rectangle and the
 * canvas shrinks to match. Useful before packing; `normalizeFrames` is the opposite direction. */
export function tightenFrames(frames){
 return frames.map(f=>{const inner=innerRect(f);
  return makeFrame({...f,sourceRect:inner,trimmedRect:null,canvasWidth:inner.w,canvasHeight:inner.h,offsetX:0,offsetY:0,
   pivotX:(pivotPixels(f).x-f.offsetX)/inner.w,pivotY:(pivotPixels(f).y-f.offsetY)/inner.h,
   boxes:f.boxes.map(b=>b.shape==='rect'?{...b,x:b.x-f.offsetX,y:b.y-f.offsetY}:b.shape==='circle'?{...b,cx:b.cx-f.offsetX,cy:b.cy-f.offsetY}:{...b,points:b.points.map(([x,y])=>[x-f.offsetX,y-f.offsetY])}),
   collision:f.collision.map(p=>p.map(([x,y])=>[x-f.offsetX,y-f.offsetY]))});});
}
