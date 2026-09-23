/** The Studio project document. Pure data + pure functions: no DOM, no pixels.
 *
 * It extends the shapes of src/game/model.js (AssetFrame, Animation) instead of inventing new ones,
 * so the exporters and algorithms under src/game keep working on what the Studio edits.
 *
 * Project {format:'nerulio-project', version, id, name, createdAt, assets:Asset[], settings:{}}
 * Asset (kind 'image') — one picture source, Aseprite-shaped for the long term:
 *   width, height          canvas size in pixels
 *   layers[]               {id, name, visible, opacity 0–255, blend}
 *   timeline[]             animation frames in time {id, duration ms}  (Aseprite "frames")
 *   cels[]                 {layerId, frameId, blob, x, y, opacity}: pixels of one layer at one time,
 *                          `blob` is the content id (SHA-256 hex of the PNG bytes) of an image stored
 *                          ONCE outside the document (ImageStore / IndexedDB / .nerulio images/)
 *   frames[]               model.js AssetFrame: regions cut from the picture (sheet cells) with
 *                          pivot, boxes, collision, duration, tag
 *   tags[]                 model.js Animation + {color}: named frame sequences ("walk", "idle")
 *   slices[]               Aseprite-style {id, name, color, data, keys:[{frame, bounds, center?, pivot?}]}
 *   grid                   {w, h, ox, oy, sx, sy} the grid the frames were cut with, or null
 *   source                 {name, type, size, lastModified} of the imported file (informational)
 *
 * Documents are immutable: every edit returns a new object and shares everything it did not touch.
 * That is what makes History's "undo = previous document" cheap and exact. */
import {frame as makeFrame,animation as makeAnimation,newId} from '../../game/model.js';
export const PROJECT_FORMAT='nerulio-project',PROJECT_VERSION=1;
export const TAG_COLORS=Object.freeze(['#e8a33d','#4cc2ff','#7bd88f','#ff6b8b','#b48cff','#f5e06e']);
const BLOB_RE=/^[0-9a-f]{64}$/;
const int=(v,name,min=0)=>{if(!Number.isSafeInteger(v)||v<min)throw Error(`${name} must be an integer ≥ ${min}`);return v;};
const str=(v,max=200)=>String(v??'').slice(0,max);
export const uid=prefix=>`${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
export function createProject({id=uid('p'),name='Untitled',createdAt=new Date().toISOString()}={}){
 return {format:PROJECT_FORMAT,version:PROJECT_VERSION,id,name:str(name)||'Untitled',createdAt,assets:[],settings:{}};
}
/** A one-layer, one-cel image asset around an already stored blob. */
export function imageAsset({id=uid('a'),name='image',width,height,blob,source=null}){
 int(width,'width',1);int(height,'height',1);if(!BLOB_RE.test(String(blob)))throw Error('blob must be a SHA-256 hex id');
 const layerId='l1',frameId='t1';
 return {id,kind:'image',name:str(name)||'image',width,height,
  layers:[{id:layerId,name:'Layer 1',visible:true,opacity:255,blend:'normal'}],
  timeline:[{id:frameId,duration:100}],
  cels:[{layerId,frameId,blob,x:0,y:0,opacity:255}],
  frames:[],tags:[],slices:[],grid:null,
  source:source?{name:str(source.name),type:str(source.type,100),size:Number(source.size)||0,lastModified:Number(source.lastModified)||0}:null};
}
export const assetById=(doc,id)=>doc.assets.find(a=>a.id===id)||null;
/** The blob shown for an asset's first (and in P0 only) cel. */
export const primaryBlob=asset=>asset?.cels?.[0]?.blob||null;
const mapAsset=(doc,id,fn)=>{let hit=false,changed=false;const assets=doc.assets.map(a=>{if(a.id!==id)return a;hit=true;const next=fn(a);if(next!==a)changed=true;return next;});if(!hit)throw Error(`Unknown asset ${id}`);return changed?{...doc,assets}:doc;};
export const renameProject=(doc,name)=>str(name).trim()&&str(name).trim()!==doc.name?{...doc,name:str(name).trim()}:doc;
export function addAssets(doc,assets){return assets.length?{...doc,assets:[...doc.assets,...assets]}:doc;}
export function removeAssets(doc,ids){const gone=new Set(ids),assets=doc.assets.filter(a=>!gone.has(a.id));return assets.length===doc.assets.length?doc:{...doc,assets};}
export function renameAsset(doc,id,name){const n=str(name).trim();return mapAsset(doc,id,a=>n&&n!==a.name?{...a,name:n}:a);}
export function moveAsset(doc,id,to){
 const from=doc.assets.findIndex(a=>a.id===id);if(from<0)throw Error(`Unknown asset ${id}`);
 to=Math.max(0,Math.min(doc.assets.length-1,to));if(to===from)return doc;
 const assets=[...doc.assets];const [a]=assets.splice(from,1);assets.splice(to,0,a);return {...doc,assets};
}
// ------------------------------------------------------------------ frames (sheet regions)
const stemOf=name=>String(name||'frame').replace(/\.[^.]+$/,'').replace(/[^\w.-]+/g,'_')||'frame';
/** A frame over `rect` of the asset. Untrimmed: the frame canvas is the rect itself. */
export function frameForRect(asset,rect,{id,name,index=asset.frames.length}={}){
 return makeFrame({id:id||uid('f'),name:name??`${stemOf(asset.name)}_${index}`,sourceRect:clampRect(rect,asset)});
}
export function clampRect(r,asset){
 const x=Math.max(0,Math.min(asset.width-1,Math.round(r.x))),y=Math.max(0,Math.min(asset.height-1,Math.round(r.y)));
 return {x,y,w:Math.max(1,Math.min(asset.width-x,Math.round(r.w))),h:Math.max(1,Math.min(asset.height-y,Math.round(r.h)))};
}
export const frameRect=f=>f.sourceRect;
const pruneTags=(tags,frames)=>{const ids=new Set(frames.map(f=>f.id));let changed=false;const out=tags.map(t=>{const frameIds=t.frameIds.filter(i=>ids.has(i));if(frameIds.length!==t.frameIds.length){changed=true;return {...t,frameIds};}return t;});return changed?out:tags;};
export function setFrames(doc,assetId,frames){return mapAsset(doc,assetId,a=>({...a,frames,tags:pruneTags(a.tags,frames)}));}
export function addFrames(doc,assetId,rects){
 return mapAsset(doc,assetId,a=>{const frames=[...a.frames];for(const r of rects)frames.push(r.sourceRect?makeFrame(r):frameForRect({...a,frames},r,{index:frames.length}));return {...a,frames};});
}
export function removeFrames(doc,assetId,ids){
 const gone=new Set(ids);
 return mapAsset(doc,assetId,a=>{const frames=a.frames.filter(f=>!gone.has(f.id));return frames.length===a.frames.length?a:{...a,frames,tags:pruneTags(a.tags,frames)};});
}
/** Moves/resizes frames: `rects` maps frame id → new sourceRect. The frame stays untrimmed and its
 * pivot stays normalised, so a pivot at bottom-centre stays at bottom-centre of the new rect. */
export function setFrameRects(doc,assetId,rects){
 return mapAsset(doc,assetId,a=>{
  let changed=false;
  const frames=a.frames.map(f=>{
   const r=rects instanceof Map?rects.get(f.id):rects[f.id];if(!r)return f;
   const c=clampRect(r,a),s=f.sourceRect;if(c.x===s.x&&c.y===s.y&&c.w===s.w&&c.h===s.h)return f;
   changed=true;return {...f,sourceRect:c,trimmedRect:null,canvasWidth:c.w,canvasHeight:c.h,offsetX:0,offsetY:0};
  });
  return changed?{...a,frames}:a;
 });
}
export function updateFrame(doc,assetId,frameId,patch){
 return mapAsset(doc,assetId,a=>{let hit=false;const frames=a.frames.map(f=>{if(f.id!==frameId)return f;hit=true;return makeFrame({...f,...patch,id:f.id});});if(!hit)throw Error(`Unknown frame ${frameId}`);return {...a,frames};});
}
export function setGrid(doc,assetId,grid){return mapAsset(doc,assetId,a=>JSON.stringify(a.grid)===JSON.stringify(grid)?a:{...a,grid:grid?{...grid}:null});}
/** Frames for every listed grid cell, in reading order, replacing the asset's frames. */
export function framesFromCells(asset,cells){return cells.map((r,i)=>frameForRect(asset,r,{index:i}));}
// ------------------------------------------------------------------ tags (animations)
export function addTag(doc,assetId,spec={}){
 return mapAsset(doc,assetId,a=>{
  const taken=new Set(a.tags.map(t=>t.name));let name=str(spec.name||'tag').trim()||'tag';if(taken.has(name)){let n=2;while(taken.has(`${name}_${n}`))n++;name=`${name}_${n}`;}
  const tag={...makeAnimation({...spec,id:spec.id||uid('g'),name},a.frames),color:spec.color||TAG_COLORS[a.tags.length%TAG_COLORS.length]};
  return {...a,tags:[...a.tags,tag]};
 });
}
export function updateTag(doc,assetId,tagId,patch){
 return mapAsset(doc,assetId,a=>({...a,tags:a.tags.map(t=>t.id===tagId?{...makeAnimation({...t,...patch,id:t.id},a.frames),color:patch.color??t.color}:t)}));
}
export const removeTag=(doc,assetId,tagId)=>mapAsset(doc,assetId,a=>({...a,tags:a.tags.filter(t=>t.id!==tagId)}));
// ------------------------------------------------------------------ slices
const rectOf=(r,name)=>({x:int(r.x,name+'.x',-1e9),y:int(r.y,name+'.y',-1e9),w:int(r.w,name+'.w',1),h:int(r.h,name+'.h',1)});
function sliceKey(k){
 const out={frame:int(k.frame??0,'slice.frame'),bounds:rectOf(k.bounds,'slice.bounds')};
 if(k.center)out.center=rectOf(k.center,'slice.center');
 if(k.pivot)out.pivot={x:int(k.pivot.x,'slice.pivot.x',-1e9),y:int(k.pivot.y,'slice.pivot.y',-1e9)};
 return out;
}
export function makeSlice(s){
 if(!Array.isArray(s.keys)||!s.keys.length)throw Error('A slice needs at least one key');
 return {id:s.id||uid('s'),name:str(s.name||'slice'),color:str(s.color||'#0000ffff',16),data:str(s.data,4000),keys:s.keys.map(sliceKey).sort((a,b)=>a.frame-b.frame)};
}
export const addSlice=(doc,assetId,spec)=>mapAsset(doc,assetId,a=>({...a,slices:[...a.slices,makeSlice(spec)]}));
export const updateSlice=(doc,assetId,id,patch)=>mapAsset(doc,assetId,a=>({...a,slices:a.slices.map(s=>s.id===id?makeSlice({...s,...patch,id}):s)}));
export const removeSlice=(doc,assetId,id)=>mapAsset(doc,assetId,a=>({...a,slices:a.slices.filter(s=>s.id!==id)}));
// ------------------------------------------------------------------ load / validate
/** Every blob id the document points at (what autosave and the .nerulio writer must keep). */
export function referencedBlobs(doc){const out=new Set();for(const a of doc.assets||[])for(const c of a.cels||[])out.add(c.blob);return out;}
/** Older formats → current. Version 1 is the first; the hook exists so snapshots never strand. */
export function migrate(raw){
 if(!raw||raw.format!==PROJECT_FORMAT)throw Error('Not a Nerulio project');
 const v=Number(raw.version);
 if(!Number.isInteger(v)||v<1)throw Error('Unknown project version');
 if(v>PROJECT_VERSION)throw Error(`This project was saved by a newer Studio (format ${v}); update to open it`);
 return raw;
}
/** Parses and validates a loaded document; throws with a readable reason instead of opening a
 * project the exporters would later choke on. Output is a fresh object with only known fields. */
export function normalizeProject(raw){
 const d=migrate(raw);
 const doc={format:PROJECT_FORMAT,version:PROJECT_VERSION,id:str(d.id,80)||uid('p'),name:str(d.name)||'Untitled',createdAt:str(d.createdAt,40),assets:[],settings:d.settings&&typeof d.settings==='object'?JSON.parse(JSON.stringify(d.settings)):{}};
 const ids=new Set();
 for(const a of d.assets||[]){
  if(a.kind!=='image')throw Error(`Unsupported asset kind ${a.kind}`);
  if(ids.has(a.id))throw Error(`Duplicate asset id ${a.id}`);ids.add(a.id);
  int(a.width,'width',1);int(a.height,'height',1);
  const layers=(a.layers||[]).map(l=>({id:str(l.id,80),name:str(l.name),visible:l.visible!==false,opacity:Math.max(0,Math.min(255,Math.round(Number(l.opacity??255)))),blend:str(l.blend||'normal',20)}));
  const timeline=(a.timeline||[]).map(t=>({id:str(t.id,80),duration:Math.max(1,Math.round(Number(t.duration)||100))}));
  const layerIds=new Set(layers.map(l=>l.id)),timeIds=new Set(timeline.map(t=>t.id));
  const cels=(a.cels||[]).map(c=>{
   if(!BLOB_RE.test(String(c.blob)))throw Error(`Asset ${a.id}: bad image reference`);
   if(!layerIds.has(c.layerId)||!timeIds.has(c.frameId))throw Error(`Asset ${a.id}: cel points at a missing layer or frame`);
   return {layerId:c.layerId,frameId:c.frameId,blob:c.blob,x:Math.round(Number(c.x)||0),y:Math.round(Number(c.y)||0),opacity:Math.max(0,Math.min(255,Math.round(Number(c.opacity??255))))};
  });
  if(!cels.length)throw Error(`Asset ${a.id} has no pixels`);
  const frames=(a.frames||[]).map(f=>makeFrame(f)),fids=new Set();
  for(const f of frames){if(fids.has(f.id))throw Error(`Duplicate frame id ${f.id}`);fids.add(f.id);
   const r=f.sourceRect;if(r.x+r.w>a.width||r.y+r.h>a.height)throw Error(`Frame ${f.id} lies outside its image`);}
  const tags=(a.tags||[]).map(t=>({...makeAnimation(t,frames),color:str(t.color||TAG_COLORS[0],16)}));
  const slices=(a.slices||[]).map(makeSlice);
  const g=a.grid;
  doc.assets.push({id:str(a.id,80),kind:'image',name:str(a.name)||'image',width:a.width,height:a.height,layers,timeline,cels,frames,tags,slices,
   grid:g?{w:int(g.w,'grid.w',1),h:int(g.h,'grid.h',1),ox:int(g.ox,'grid.ox'),oy:int(g.oy,'grid.oy'),sx:int(g.sx,'grid.sx'),sy:int(g.sy,'grid.sy')}:null,
   source:a.source?{name:str(a.source.name),type:str(a.source.type,100),size:Number(a.source.size)||0,lastModified:Number(a.source.lastModified)||0}:null});
 }
 return doc;
}
export function stats(doc){
 let frames=0,pixels=0;for(const a of doc.assets){frames+=a.frames.length;pixels+=a.width*a.height;}
 return {assets:doc.assets.length,frames,pixels,blobs:referencedBlobs(doc).size};
}
export {newId};
