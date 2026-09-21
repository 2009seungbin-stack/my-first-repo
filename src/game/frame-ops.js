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
import {components,frameNumber,MAX_FRAMES} from '../primitives.js';
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
/** Detects frames on a sheet: alpha components → merged into frames → read in order.
 * Needs the sheet's pixels because `primitives.components` labels them (and inherits its
 * 4-megapixel analysis cap); everything after that works on rectangles only. */
export function detectFrames(src,{threshold=ALPHA_THRESHOLD,minArea=4,distance=2,rowTolerance='auto',maxFrames=MAX_FRAMES,rightToLeft=false}={}){
 const s=source(src),sheet=s.read({x:0,y:0,w:s.width,h:s.height});
 const found=components(sheet.data,sheet.width,sheet.height,{threshold,minArea,maxFrames});
 const rects=readingOrder(mergeRects(found,{distance,maxFrames}),{rowTolerance,rightToLeft});
 return {components:found,rects,rows:rects.length?rects[rects.length-1].row+1:0};
}
/** Model frames for a list of sheet rectangles. `trim` records the alpha bounding box inside each
 * rectangle as `trimmedRect` (the pixels stay where they are; nothing is cropped yet). */
export function framesFromRects(src,rects,{trim=true,threshold=ALPHA_THRESHOLD,prefix='frame_',tag='',pivotX,pivotY,skipEmpty=true,names}={}){
 const s=source(src),frames=[],empty=[];
 rects.forEach((r,i)=>{
  const sourceRect=checkRect(r,s.width,s.height,`frame ${i}`);
  const trimmed=trim||skipEmpty?boundsIn(s,sourceRect,{threshold}):null;
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
