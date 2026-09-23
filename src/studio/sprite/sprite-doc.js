/** Timeline, tag, pivot, box and collision edits for the Sprite workspace. Pure: document in,
 * document out (structural sharing), so every edit is one exact undo step through History.
 * Shapes: docs/STUDIO-SPRITE.md. Frames are the timeline (time order); tags list frame ids.
 *
 * Invariants kept by every edit here:
 *  - a tag's frameIds follow timeline order (descending when the tag was listed backwards, which
 *    is how Aseprite's ping-pong-reverse is represented);
 *  - frame.tag names the innermost tag containing the frame ('' when none);
 *  - the same box across frames keeps the same id (the "scope" edits rely on it). */
import {frame as makeFrame,box as makeBox,polygon as makePolygon,mirrorFrame as mirrorModel,newId} from '../../game/model.js';
import {normalizeFrames} from '../../game/frame-ops.js';
import * as P from '../core/project.js';
export const BOX_COLORS=Object.freeze({hit:'#ff4d5e',hurt:'#3fa9ff',interact:'#ffd23f'});
export const BOX_TYPES=Object.freeze(['hit','hurt','interact']);
/** Stable colour for a custom box type (hash → hue), readable on dark and light art. */
export function boxColor(type){
 if(BOX_COLORS[type])return BOX_COLORS[type];
 let h=0;for(const c of String(type))h=(h*31+c.charCodeAt(0))>>>0;
 const hue=(h%360+60)%360;return `hsl(${hue} 85% 60%)`;
}
export const cleanType=t=>String(t||'').trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,32)||'custom';
const map=(doc,id,fn)=>P.mapAsset(doc,id,fn);
export const indexOf=(asset,id)=>asset.frames.findIndex(f=>f.id===id);
// ------------------------------------------------------------------ selection semantics (pure)
/** Click on frame `id` in timeline order `order` (ids). Plain click selects it; Shift extends a
 * range from the anchor; Ctrl/⌘ toggles it. Returns {selected (timeline order), anchor}. */
export function clickSelect({selected=[],anchor=null},id,{shift=false,mod=false}={},order=[]){
 const pos=new Map(order.map((x,i)=>[x,i]));
 if(shift&&anchor!=null&&pos.has(anchor)){
  const a=pos.get(anchor),b=pos.get(id),[lo,hi]=a<b?[a,b]:[b,a];
  const range=order.slice(lo,hi+1),keep=mod?selected:[];
  return {selected:sortBy([...new Set([...keep,...range])],pos),anchor};
 }
 if(mod){const on=selected.includes(id);return {selected:sortBy(on?selected.filter(x=>x!==id):[...selected,id],pos),anchor:id};}
 return {selected:[id],anchor:id};
}
const sortBy=(ids,pos)=>ids.filter(i=>pos.has(i)).sort((a,b)=>pos.get(a)-pos.get(b));
// ------------------------------------------------------------------ tags ↔ timeline order
const descending=(tag,pos)=>tag.frameIds.length>1&&pos.get(tag.frameIds[0])>pos.get(tag.frameIds[tag.frameIds.length-1]);
/** Re-sorts every tag's frame ids by the (new) timeline order and refreshes frame.tag. */
export function syncTags(asset){
 const pos=new Map(asset.frames.map((f,i)=>[f.id,i]));
 let changed=false;
 const tags=asset.tags.map(t=>{
  const ids=t.frameIds.filter(id=>pos.has(id)),down=descending(t,pos);
  ids.sort((a,b)=>down?pos.get(b)-pos.get(a):pos.get(a)-pos.get(b));
  if(ids.length===t.frameIds.length&&ids.every((x,i)=>x===t.frameIds[i]))return t;
  changed=true;return {...t,frameIds:ids};
 });
 const inner=new Map();for(const t of tags)for(const id of t.frameIds){const cur=inner.get(id);if(!cur||t.frameIds.length<cur.frameIds.length)inner.set(id,t);}
 let fchanged=false;
 const frames=asset.frames.map(f=>{const name=inner.get(f.id)?.name||'';if(f.tag===name)return f;fchanged=true;return {...f,tag:name};});
 return changed||fchanged?{...asset,tags:changed?tags:asset.tags,frames:fchanged?frames:asset.frames}:asset;
}
const tidy=fn=>a=>{const next=fn(a);return next===a?a:syncTags(next);};
/** Positions (timeline order) → contiguous runs [{from,to}] — how the timeline draws tag bars. */
export function runs(indices){
 const s=[...new Set(indices)].sort((a,b)=>a-b),out=[];
 for(const i of s){const last=out[out.length-1];if(last&&i===last.to+1)last.to=i;else out.push({from:i,to:i});}
 return out;
}
export const tagRuns=(asset,tag)=>runs(tag.frameIds.map(id=>indexOf(asset,id)).filter(i=>i>=0));
// ------------------------------------------------------------------ frames in time
/** Moves the frames `ids` (kept in their relative order) so they start at timeline position `to`
 * (position counted in the list *without* the moved frames). Tags follow their frames. */
export function moveFrames(doc,assetId,ids,to){
 return map(doc,assetId,tidy(a=>{
  const set=new Set(ids),moving=a.frames.filter(f=>set.has(f.id)),rest=a.frames.filter(f=>!set.has(f.id));
  if(!moving.length)return a;
  to=Math.max(0,Math.min(rest.length,to));
  const frames=[...rest.slice(0,to),...moving,...rest.slice(to)];
  if(frames.every((f,i)=>f===a.frames[i]))return a;
  return {...a,frames};
 }));
}
/** A copy of a frame with a new id and name, own cels copied (they point at the same blobs), boxes
 * keep their ids (they are "the same box" in a new frame). */
function cloneFrame(a,f,name){
 const id=P.uid('f');
 return {frame:makeFrame({...f,id,name:name??f.name,boxes:f.boxes,collision:f.collision,metadata:{...f.metadata,copyOf:f.id}}),
  cels:a.cels.filter(c=>c.frameId===f.id).map(c=>({...c,frameId:id}))};
}
/** Duplicates `ids` right after the last of them (Aseprite "New Frame" duplicates the current one).
 * Every tag that contains the frame just before the insertion point and the one after it (i.e. the
 * insertion is inside the tag) grows to include the copies. Returns {doc, ids: new frame ids}. */
export function duplicateFrames(doc,assetId,ids){
 let made=[];
 const next=map(doc,assetId,tidy(a=>{
  const set=new Set(ids),src=a.frames.filter(f=>set.has(f.id));if(!src.length)return a;
  const last=Math.max(...src.map(f=>indexOf(a,f.id)));
  const copies=src.map(f=>cloneFrame(a,f,uniqueName(a,f.name)));made=copies.map(c=>c.frame.id);
  const frames=[...a.frames.slice(0,last+1),...copies.map(c=>c.frame),...a.frames.slice(last+1)];
  const inserted=new Set(made),left=a.frames[last].id,right=a.frames[last+1]?.id;
  const tags=a.tags.map(t=>{
   const hasLeft=t.frameIds.includes(left),copyOf=new Map(copies.map((c,i)=>[c.frame.id,src[i].id]));
   // a copy joins every tag its original is in when it lands inside or at the end of that tag
   const add=[...inserted].filter(id=>t.frameIds.includes(copyOf.get(id))&&(hasLeft&&(t.frameIds.includes(right)||t.frameIds[t.frameIds.length-1]===left||t.frameIds[0]===left)));
   return add.length?{...t,frameIds:[...t.frameIds,...add]}:t;
  });
  return {...a,frames,tags,cels:[...a.cels,...copies.flatMap(c=>c.cels)]};
 }));
 return {doc:next,ids:made};
}
/** Inserts ready-made frames (and their own cels) at position `at`. Tags around the insertion
 * point grow when the insertion is strictly inside them. Returns {doc, ids}. */
export function insertFrames(doc,assetId,at,frames,cels=[]){
 const made=frames.map(f=>f.id);
 const next=map(doc,assetId,tidy(a=>{
  at=Math.max(0,Math.min(a.frames.length,at));
  const left=a.frames[at-1]?.id,right=a.frames[at]?.id;
  const tags=a.tags.map(t=>left&&right&&t.frameIds.includes(left)&&t.frameIds.includes(right)?{...t,frameIds:[...t.frameIds,...made]}:t);
  return {...a,frames:[...a.frames.slice(0,at),...frames,...a.frames.slice(at)],tags,cels:[...a.cels,...cels]};
 }));
 return {doc:next,ids:made};
}
/** An empty (transparent) frame the size of the canvas at position `at`. */
export function emptyFrame(asset,{name}={}){
 const f=asset.frames[0],w=f?f.canvasWidth:asset.width,h=f?f.canvasHeight:asset.height;
 // an empty frame shows a region no layer draws on: its own cels are absent, so it must not fall
 // back to the shared picture — it gets a transparent own cel from the caller (see emptyCels)
 return makeFrame({id:P.uid('f'),name:name??uniqueName(asset,'frame'),sourceRect:f?f.sourceRect:{x:0,y:0,w,h},canvasWidth:w,canvasHeight:h,duration:f?.duration??100,pivotX:f?.pivotX??.5,pivotY:f?.pivotY??1});
}
export function deleteFrames(doc,assetId,ids){return map(P.removeFrames(doc,assetId,ids),assetId,tidy(a=>a));}
export function uniqueName(asset,base){
 const taken=new Set(asset.frames.map(f=>f.name));const stem=String(base||'frame').replace(/_copy\d*$/,'');
 if(!taken.has(stem))return stem;let n=1;while(taken.has(`${stem}_copy${n>1?n:''}`))n++;return `${stem}_copy${n>1?n:''}`;
}
export function renameFrame(doc,assetId,id,name){
 const n=String(name||'').trim().slice(0,120);if(!n)return doc;
 return map(doc,assetId,a=>{const f=a.frames.find(x=>x.id===id);if(!f||f.name===n)return a;return {...a,frames:a.frames.map(x=>x===f?{...x,name:n}:x)};});
}
/** Durations: `ms` for every listed frame (a number), or a function f → ms. */
export function setDurations(doc,assetId,ids,ms){
 const set=new Set(ids);
 return map(doc,assetId,a=>{let changed=false;const frames=a.frames.map(f=>{if(!set.has(f.id))return f;const d=Math.max(1,Math.min(65535,Math.round(typeof ms==='function'?ms(f):ms)));if(f.duration===d)return f;changed=true;return {...f,duration:d};});return changed?{...a,frames}:a;});
}
// ------------------------------------------------------------------ tags
/** New tag over timeline positions from..to (inclusive, any order). */
export function tagFromRange(doc,assetId,from,to,spec={}){
 const a=P.assetById(doc,assetId),lo=Math.max(0,Math.min(from,to)),hi=Math.min(a.frames.length-1,Math.max(from,to));
 if(hi<lo)return doc;
 const frameIds=a.frames.slice(lo,hi+1).map(f=>f.id);
 return map(P.addTag(doc,assetId,{name:spec.name||'tag',frameIds,fps:spec.fps||10,direction:spec.direction||'forward',repeat:spec.repeat??0,color:spec.color,id:spec.id}),assetId,tidy(x=>x));
}
/** A tag covers timeline positions from..to (its bar was dragged). */
export function setTagRange(doc,assetId,tagId,from,to){
 const a=P.assetById(doc,assetId),t=a.tags.find(x=>x.id===tagId);if(!t)return doc;
 const lo=Math.max(0,Math.min(from,to)),hi=Math.min(a.frames.length-1,Math.max(from,to));
 const pos=new Map(a.frames.map((f,i)=>[f.id,i])),down=descending(t,pos);
 let ids=a.frames.slice(lo,hi+1).map(f=>f.id);if(down)ids=ids.reverse();
 return map(P.updateTag(doc,assetId,tagId,{frameIds:ids}),assetId,tidy(x=>x));
}
export function updateTag(doc,assetId,tagId,patch){
 if('name'in patch){const n=String(patch.name||'').trim().slice(0,80);const a=P.assetById(doc,assetId);if(!n)return doc;
  if(a.tags.some(t=>t.id!==tagId&&t.name===n))throw Error(`A tag called "${n}" already exists`);patch={...patch,name:n};}
 return map(P.updateTag(doc,assetId,tagId,patch),assetId,tidy(x=>x));
}
export const removeTag=(doc,assetId,tagId)=>map(P.removeTag(doc,assetId,tagId),assetId,tidy(x=>x));
/** Replaces all tags at once (import, "one animation per row"). */
export function setTags(doc,assetId,specs){
 let d=map(doc,assetId,a=>({...a,tags:[]}));
 for(const s of specs)d=P.addTag(d,assetId,s);
 return map(d,assetId,tidy(x=>x));
}
// ------------------------------------------------------------------ pivots
/** Pivot in frame-canvas pixels (whole or half pixels) for every listed frame. */
export function setPivotPx(doc,assetId,ids,x,y){
 const set=new Set(ids);
 return map(doc,assetId,a=>{let changed=false;const frames=a.frames.map(f=>{if(!set.has(f.id))return f;const px=x/f.canvasWidth,py=y/f.canvasHeight;if(f.pivotX===px&&f.pivotY===py)return f;changed=true;return {...f,pivotX:px,pivotY:py};});return changed?{...a,frames}:a;});
}
/** Pivot moved by (dx, dy) pixels on every listed frame (keyboard nudge keeps per-frame pivots). */
export function nudgePivot(doc,assetId,ids,dx,dy){
 const set=new Set(ids);
 return map(doc,assetId,a=>({...a,frames:a.frames.map(f=>set.has(f.id)?{...f,pivotX:(f.pivotX*f.canvasWidth+dx)/f.canvasWidth,pivotY:(f.pivotY*f.canvasHeight+dy)/f.canvasHeight}:f)}));
}
// ------------------------------------------------------------------ boxes
const snap=v=>Math.round(v);
export function snapBox(b){
 if(b.shape==='rect')return {...b,x:snap(b.x),y:snap(b.y),w:Math.max(1,snap(b.w)),h:Math.max(1,snap(b.h))};
 if(b.shape==='circle')return {...b,cx:snap(b.cx*2)/2,cy:snap(b.cy*2)/2,r:Math.max(.5,snap(b.r*2)/2)};
 return {...b,points:b.points.map(([x,y])=>[snap(x),snap(y)])};
}
/** Adds the same box (same id) to every listed frame. */
export function addBox(doc,assetId,ids,spec){
 const b=makeBox({...snapBox(spec),id:spec.id||P.uid('b'),type:cleanType(spec.type)}),set=new Set(ids);
 return {doc:map(doc,assetId,a=>({...a,frames:a.frames.map(f=>set.has(f.id)&&!f.boxes.some(x=>x.id===b.id)?{...f,boxes:[...f.boxes,b]}:f)})),id:b.id};
}
/** Edits box `boxId` on every listed frame: `patch` object or fn(box, frame) → box. Frames in the
 * scope that do not have the box get it (so "apply to whole tag" also fills gaps). */
export function updateBox(doc,assetId,ids,boxId,patch,{fill=false,template=null}={}){
 const set=new Set(ids);
 return map(doc,assetId,a=>{let changed=false;const frames=a.frames.map(f=>{
  if(!set.has(f.id))return f;const has=f.boxes.find(b=>b.id===boxId);
  if(!has){if(!fill||!template)return f;changed=true;return {...f,boxes:[...f.boxes,makeBox(snapBox({...template,...(typeof patch==='function'?patch(template,f):patch),id:boxId}))]};}
  const next=makeBox(snapBox({...has,...(typeof patch==='function'?patch(has,f):patch),id:boxId}));
  if(JSON.stringify(next)===JSON.stringify(has))return f;changed=true;
  return {...f,boxes:f.boxes.map(b=>b===has?next:b)};
 });return changed?{...a,frames}:a;});
}
export function removeBox(doc,assetId,ids,boxId){
 const set=new Set(ids);
 return map(doc,assetId,a=>{let changed=false;const frames=a.frames.map(f=>{if(!set.has(f.id)||!f.boxes.some(b=>b.id===boxId))return f;changed=true;return {...f,boxes:f.boxes.filter(b=>b.id!==boxId)};});return changed?{...a,frames}:a;});
}
/** Copies every box of frame `fromId` to the listed frames (replacing boxes with the same id). */
export function copyBoxes(doc,assetId,fromId,toIds,{boxIds=null}={}){
 const a=P.assetById(doc,assetId),src=a.frames.find(f=>f.id===fromId);if(!src)return doc;
 const pick=src.boxes.filter(b=>!boxIds||boxIds.includes(b.id)),ids=new Set(pick.map(b=>b.id)),set=new Set(toIds);
 return map(doc,assetId,x=>({...x,frames:x.frames.map(f=>set.has(f.id)&&f.id!==fromId?{...f,boxes:[...f.boxes.filter(b=>!ids.has(b.id)),...pick]}:f)}));
}
// ------------------------------------------------------------------ collision
export function setCollision(doc,assetId,byFrame){
 return map(doc,assetId,a=>{let changed=false;const frames=a.frames.map(f=>{const p=byFrame.get(f.id);if(!p)return f;changed=true;return {...f,collision:p.map(makePolygon)};});return changed?{...a,frames}:a;});
}
export function setCollisionPoint(doc,assetId,ids,polyIndex,pointIndex,x,y){
 const set=new Set(ids);
 return map(doc,assetId,a=>({...a,frames:a.frames.map(f=>{if(!set.has(f.id)||!f.collision[polyIndex])return f;const poly=f.collision[polyIndex].map((p,i)=>i===pointIndex?[snap(x),snap(y)]:p);return {...f,collision:f.collision.map((p,i)=>i===polyIndex?poly:p)};})}));
}
// ------------------------------------------------------------------ mirror
/** Horizontal mirror of a frame's metadata in place (pivot, boxes, collision); pixels are the
 * caller's job (a new own cel). Keeps the frame id and box ids. */
export function mirrorFrameMeta(f){const m=mirrorModel(f);return {...m,id:f.id,metadata:{...f.metadata,mirrored:!f.metadata?.mirrored},boxes:m.boxes.map((b,i)=>({...b,id:f.boxes[i].id}))};}
// ------------------------------------------------------------------ alignment
/** normalizeFrames (src/game/frame-ops.js) on the listed frames: one canvas size, pixels aligned by
 * whole pixels — boxes, collision and pivots move with the pixels. Metadata only, no new pixels. */
export function normalizeCanvas(doc,assetId,ids,options){
 const a=P.assetById(doc,assetId),set=new Set(ids),pick=a.frames.filter(f=>set.has(f.id));
 if(!pick.length)return {doc,result:null};
 const result=normalizeFrames(pick,options),byId=new Map(result.frames.map(f=>[f.id,f]));
 return {doc:map(doc,assetId,x=>({...x,frames:x.frames.map(f=>byId.get(f.id)||f)})),result};
}
/** Moves each listed frame's pixels on its canvas by (dx, dy) (jitter fix / manual anchor). */
export function shiftFrames(doc,assetId,shifts){
 return map(doc,assetId,a=>({...a,frames:a.frames.map(f=>{const s=shifts.get(f.id);if(!s||(!s.dx&&!s.dy))return f;
  const W=f.canvasWidth,H=f.canvasHeight,inner=f.trimmedRect||f.sourceRect;
  const ox=Math.max(0,Math.min(W-inner.w,f.offsetX+s.dx)),oy=Math.max(0,Math.min(H-inner.h,f.offsetY+s.dy)),dx=ox-f.offsetX,dy=oy-f.offsetY;
  return makeFrame({...f,offsetX:ox,offsetY:oy,boxes:f.boxes.map(b=>b.shape==='rect'?{...b,x:b.x+dx,y:b.y+dy}:b.shape==='circle'?{...b,cx:b.cx+dx,cy:b.cy+dy}:{...b,points:b.points.map(([x,y])=>[x+dx,y+dy])}),collision:f.collision.map(p=>p.map(([x,y])=>[x+dx,y+dy]))});})}));
}
// ------------------------------------------------------------------ layers
export function setLayer(doc,assetId,layerId,patch){
 return map(doc,assetId,a=>({...a,layers:a.layers.map(l=>l.id===layerId?{...l,...patch,name:String(patch.name??l.name).slice(0,120)||l.name}:l)}));
}
/** Replaces an asset's content (import apply): frames, cels, tags, layers, size, grid, import. */
export function replaceContent(doc,assetId,{frames,cels,tags,layers,width,height,grid,importInfo,slices}){
 return map(doc,assetId,a=>syncTags({...a,...(width?{width,height}:{}),...(layers?{layers}:{}),...(cels?{cels}:{}),frames:frames??a.frames,tags:tags??a.tags,
  ...(grid!==undefined?{grid}:{}),...(slices?{slices}:{}),...(importInfo!==undefined?{import:importInfo}:{})}));
}
export {newId};
