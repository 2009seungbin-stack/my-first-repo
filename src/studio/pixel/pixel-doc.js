/** Document edits of the Pixel workspace. Pure: document in, document out (structural sharing),
 * so every edit is one exact undo step. Shapes: docs/STUDIO-SPRITE.md (layers × frames cels) plus
 * the Pixel additions documented in docs/STUDIO-PIXEL.md:
 *   asset.palette          {colors:[[r,g,b,a]…], names?}   the sprite palette (RGB and indexed sprites)
 *   asset.colorMode        'indexed' | absent (RGB)
 *   asset.transparentIndex palette index drawn as transparent in an indexed sprite (default 0)
 *   layer.locked           true = the Pixel tools refuse to paint on it (Aseprite's "editable" off)
 * Pixels never live in the document: a painted cel is a new PNG blob (content-addressed). */
import * as P from '../core/project.js';
import {frame as makeFrame} from '../../game/model.js';
import {normalizePalette} from './indexed.js';
const SHARED=P.SHARED;
const map=(doc,id,fn)=>P.mapAsset(doc,id,fn);
/** The editing target of a frame: the canvas region the Pixel workspace paints on. A sprite with
 * no frames is edited as one picture (its shared cels, the whole canvas). */
export function target(asset,frameIndex){
 const f=asset.frames[frameIndex]||null;
 return f?{frameId:f.id,rect:{...f.sourceRect},frame:f}:{frameId:SHARED,rect:{x:0,y:0,w:asset.width,h:asset.height},frame:null};
}
/** Replaces (or adds) the cel of one layer at one frame ('*' = the layer's shared picture). */
export function setCel(doc,assetId,cel){
 return map(doc,assetId,a=>{
  let hit=false;const next={layerId:cel.layerId,frameId:cel.frameId,blob:cel.blob,x:Math.round(cel.x),y:Math.round(cel.y),opacity:cel.opacity??255};
  const cels=a.cels.map(c=>{if(c.layerId===cel.layerId&&c.frameId===cel.frameId){hit=true;return next;}return c;});
  if(!hit)cels.push(next);
  return {...a,cels};
 });
}
/** Several cels at once (a batch operation = one undo step). */
export function setCels(doc,assetId,list){
 if(!list.length)return doc;
 return map(doc,assetId,a=>{
  const byKey=new Map(list.map(c=>[c.layerId+'|'+c.frameId,{layerId:c.layerId,frameId:c.frameId,blob:c.blob,x:Math.round(c.x),y:Math.round(c.y),opacity:c.opacity??255}]));
  const cels=a.cels.map(c=>{const k=c.layerId+'|'+c.frameId,n=byKey.get(k);if(n){byKey.delete(k);return n;}return c;});
  return {...a,cels:[...cels,...byKey.values()]};
 });
}
/** A painted frame whose frame has a trimmed rect (set by alignment) must not lose the new pixels:
 * the trimmed rect grows to cover `painted` (canvas coordinates, clipped to the source rect) and
 * the frame offset moves by the same amount, so nothing already aligned shifts. */
export function coverPainted(doc,assetId,frameId,painted){
 if(!painted||frameId===SHARED)return doc;
 return map(doc,assetId,a=>{
  let changed=false;
  const frames=a.frames.map(f=>{
   if(f.id!==frameId||!f.trimmedRect)return f;const t=f.trimmedRect,s=f.sourceRect;
   const x0=Math.max(s.x,Math.min(t.x,painted.x)),y0=Math.max(s.y,Math.min(t.y,painted.y)),x1=Math.min(s.x+s.w,Math.max(t.x+t.w,painted.x+painted.w)),y1=Math.min(s.y+s.h,Math.max(t.y+t.h,painted.y+painted.h));
   if(x0===t.x&&y0===t.y&&x1===t.x+t.w&&y1===t.y+t.h)return f;
   changed=true;return makeFrame({...f,trimmedRect:{x:x0,y:y0,w:x1-x0,h:y1-y0},offsetX:f.offsetX-(t.x-x0),offsetY:f.offsetY-(t.y-y0)});
  });
  return changed?{...a,frames}:a;
 });
}
// ------------------------------------------------------------------ layers
const layerName=(a,base='Layer')=>{const taken=new Set(a.layers.map(l=>l.name));let n=a.layers.length+1;while(taken.has(`${base} ${n}`))n++;return `${base} ${n}`;};
/** New empty layer above `aboveId` (or on top). Returns {doc, id}. */
export function addLayer(doc,assetId,{aboveId=null,name=null,id=P.uid('l')}={}){
 let made=id;
 const next=map(doc,assetId,a=>{
  const at=aboveId?a.layers.findIndex(l=>l.id===aboveId)+1:a.layers.length;
  const layer={id:made,name:name||layerName(a),visible:true,opacity:255,blend:'normal'};
  return {...a,layers:[...a.layers.slice(0,at),layer,...a.layers.slice(at)]};
 });
 return {doc:next,id:made};
}
/** Removes a layer and its cels. The last layer cannot go; an asset left without any cel gets a
 * transparent shared cel (`emptyBlob`, a 1×1 transparent PNG) so it stays a valid document. */
export function removeLayer(doc,assetId,layerId,{emptyBlob=null}={}){
 return map(doc,assetId,a=>{
  if(a.layers.length<=1)throw Error('A sprite needs at least one layer');
  const layers=a.layers.filter(l=>l.id!==layerId);if(layers.length===a.layers.length)return a;
  let cels=a.cels.filter(c=>c.layerId!==layerId);
  if(!cels.length){if(!emptyBlob)throw Error('An empty picture is needed for a sprite without pixels');cels=[{layerId:layers[0].id,frameId:SHARED,blob:emptyBlob,x:0,y:0,opacity:255}];}
  return {...a,layers,cels};
 });
}
/** Copy of a layer right above it (cels point at the same blobs: no pixels are copied). */
export function duplicateLayer(doc,assetId,layerId,{id=P.uid('l')}={}){
 let made=null;
 const next=map(doc,assetId,a=>{
  const i=a.layers.findIndex(l=>l.id===layerId);if(i<0)return a;const src=a.layers[i];made=id;
  const copy={...src,id,name:`${src.name} copy`.slice(0,120)};
  return {...a,layers:[...a.layers.slice(0,i+1),copy,...a.layers.slice(i+1)],cels:[...a.cels,...a.cels.filter(c=>c.layerId===layerId).map(c=>({...c,layerId:id}))]};
 });
 return {doc:next,id:made};
}
/** Moves a layer to position `to` (0 = bottom). */
export function moveLayer(doc,assetId,layerId,to){
 return map(doc,assetId,a=>{
  const from=a.layers.findIndex(l=>l.id===layerId);if(from<0)return a;to=Math.max(0,Math.min(a.layers.length-1,to));if(to===from)return a;
  const layers=[...a.layers];const [l]=layers.splice(from,1);layers.splice(to,0,l);return {...a,layers};
 });
}
export function setLayer(doc,assetId,layerId,patch){
 return map(doc,assetId,a=>{let changed=false;const layers=a.layers.map(l=>{if(l.id!==layerId)return l;const n={...l,...patch};
  if(patch.name!=null)n.name=String(patch.name).trim().slice(0,120)||l.name;
  if(patch.opacity!=null)n.opacity=Math.max(0,Math.min(255,Math.round(patch.opacity)));
  if('locked'in patch){if(patch.locked)n.locked=true;else delete n.locked;}
  if(JSON.stringify(n)!==JSON.stringify(l))changed=true;return n;});return changed?{...a,layers}:a;});
}
/** The moments a merge-down must compute: every frame where either layer has its own cel, plus
 * the shared picture when either has one. Each: {frameId, below: cel|null, above: cel|null}. */
export function mergeDownPlan(asset,layerId){
 const i=asset.layers.findIndex(l=>l.id===layerId);if(i<=0)return null;
 const upper=asset.layers[i],lower=asset.layers[i-1],cel=(l,f)=>asset.cels.find(c=>c.layerId===l&&c.frameId===f)||null;
 const moments=new Set(asset.cels.filter(c=>c.layerId===upper.id||c.layerId===lower.id).map(c=>c.frameId));
 const out=[];
 for(const f of moments){
  const shared=f===SHARED,below=cel(lower.id,f)||(shared?null:cel(lower.id,SHARED)),above=cel(upper.id,f)||(shared?null:cel(upper.id,SHARED));
  out.push({frameId:f,below,above});
 }
 return {upper,lower,moments:out};
}
/** Applies a computed merge: `cels` are the lower layer's new cels (one per moment); the upper
 * layer and its cels go away. */
export function applyMergeDown(doc,assetId,layerId,cels){
 return map(doc,assetId,a=>{
  const i=a.layers.findIndex(l=>l.id===layerId);if(i<=0)return a;const lower=a.layers[i-1].id;
  const keep=a.cels.filter(c=>c.layerId!==layerId&&!(c.layerId===lower&&cels.some(n=>n.frameId===c.frameId)));
  return {...a,layers:a.layers.filter(l=>l.id!==layerId),cels:[...keep,...cels.map(c=>({layerId:lower,frameId:c.frameId,blob:c.blob,x:c.x,y:c.y,opacity:c.opacity??255}))]};
 });
}
// ------------------------------------------------------------------ palette and colour mode
export function setPalette(doc,assetId,palette,{transparentIndex}={}){
 const p=normalizePalette(palette);
 return map(doc,assetId,a=>{
  const next={...a,palette:p};
  if(transparentIndex!==undefined){if(transparentIndex==null||transparentIndex<0)delete next.transparentIndex;else next.transparentIndex=Math.min(p.colors.length-1,transparentIndex);}
  else if(a.transparentIndex!=null&&a.transparentIndex>=p.colors.length)next.transparentIndex=0;
  return JSON.stringify(next.palette)===JSON.stringify(a.palette)&&next.transparentIndex===a.transparentIndex?a:next;
 });
}
/** Colour mode switch with the cels already converted by the caller (indexed PNGs or RGBA). */
export function setColorMode(doc,assetId,mode,{palette=null,transparentIndex=0,cels=[]}={}){
 let d=cels.length?setCels(doc,assetId,cels):doc;
 return map(d,assetId,a=>{
  const next={...a,...(palette?{palette:normalizePalette(palette)}:{})};
  if(mode==='indexed'){next.colorMode='indexed';next.transparentIndex=transparentIndex;}
  else{delete next.colorMode;delete next.transparentIndex;}
  return next;
 });
}
export const isIndexed=a=>a?.colorMode==='indexed'&&!!a.palette?.colors?.length;
export const transparentIndexOf=a=>isIndexed(a)?(a.transparentIndex??0):-1;
// ------------------------------------------------------------------ new sprites
/** A new sprite: one transparent layer, one frame over the whole canvas (so it can be animated). */
export function newSprite({name='Sprite',width,height,blob,palette=null,colorMode='rgb',transparentIndex=0,id=P.uid('a')}){
 const a=P.imageAsset({id,name,width,height,blob});
 const f=P.frameForRect(a,{x:0,y:0,w:width,h:height},{id:P.uid('f'),name:`${String(name).replace(/\.[^.]+$/,'')||'frame'}_0`,index:0});
 const out={...a,frames:[f],layers:[{...a.layers[0],name:'Layer 1'}]};
 if(palette)out.palette=normalizePalette(palette);
 if(colorMode==='indexed'&&out.palette){out.colorMode='indexed';out.transparentIndex=transparentIndex;}
 return out;
}
/** Frames for a picture that has none yet ("animate this image"): one frame over the canvas. */
export function frameFromCanvas(doc,assetId){
 return map(doc,assetId,a=>a.frames.length?a:{...a,frames:[P.frameForRect(a,{x:0,y:0,w:a.width,h:a.height},{id:P.uid('f'),index:0})]});
}
// ------------------------------------------------------------------ canvas size
/** Aseprite's Sprite › Canvas Size: adds (or, negative, removes) `left/top/right/bottom` pixels
 * around the canvas without scaling anything. Cels move by (left, top) — their pixels are not
 * re-encoded; frames that cover the whole canvas (animations, new sprites) grow with it, keeping
 * their pivot / boxes / collision on the same pixels; regions of a sheet move with the pixels
 * (a region the new canvas would cut is refused). Slices and the cut grid move too. */
export function canvasSize(doc,assetId,{left=0,top=0,right=0,bottom=0}){
 return map(doc,assetId,a=>{
  const W=a.width+left+right,H=a.height+top+bottom;
  if(!(W>=1&&H>=1))throw Error('The canvas must keep at least 1×1 pixel');
  if(W>32768||H>32768)throw Error('The canvas is limited to 32768 px per side');
  if(!left&&!top&&!right&&!bottom)return a;
  const whole=f=>f.sourceRect.x===0&&f.sourceRect.y===0&&f.sourceRect.w===a.width&&f.sourceRect.h===a.height&&!f.trimmedRect&&f.offsetX===0&&f.offsetY===0&&f.canvasWidth===a.width&&f.canvasHeight===a.height;
  const mv=(x,y)=>[x+left,y+top];
  const frames=a.frames.map(f=>{
   if(whole(f)){
    const bx=b=>b.shape==='rect'?{...b,x:b.x+left,y:b.y+top}:b.shape==='circle'?{...b,cx:b.cx+left,cy:b.cy+top}:{...b,points:b.points.map(p=>mv(...p))};
    return makeFrame({...f,sourceRect:{x:0,y:0,w:W,h:H},trimmedRect:null,canvasWidth:W,canvasHeight:H,offsetX:0,offsetY:0,pivotX:(f.pivotX*a.width+left)/W,pivotY:(f.pivotY*a.height+top)/H,
     boxes:f.boxes.map(bx),collision:f.collision.map(poly=>poly.map(p=>mv(...p)))});
   }
   const r=f.sourceRect,n={x:r.x+left,y:r.y+top,w:r.w,h:r.h};
   if(n.x<0||n.y<0||n.x+n.w>W||n.y+n.h>H)throw Error(`Frame ${f.name||f.id} would be cut by the new canvas`);
   const t=f.trimmedRect?{...f.trimmedRect,x:f.trimmedRect.x+left,y:f.trimmedRect.y+top}:null;
   return makeFrame({...f,sourceRect:n,trimmedRect:t});
  });
  const cels=a.cels.map(c=>({...c,x:c.x+left,y:c.y+top}));
  const slices=(a.slices||[]).map(s=>({...s,keys:s.keys.map(k=>({...k,bounds:{...k.bounds,x:k.bounds.x+left,y:k.bounds.y+top}}))}));// centre and pivot are relative to the bounds
  const grid=a.grid?{...a.grid,ox:Math.max(0,a.grid.ox+left),oy:Math.max(0,a.grid.oy+top)}:a.grid;
  return {...a,width:W,height:H,frames,cels,slices,grid};
 });
}
