/** The Studio project document. Pure data + pure functions: no DOM, no pixels.
 *
 * It extends the shapes of src/game/model.js (AssetFrame, Animation) instead of inventing new ones,
 * so the exporters and algorithms under src/game keep working on what the Studio edits.
 * The full contract (what a packer/exporter must read) is docs/STUDIO-SPRITE.md.
 *
 * Project {format:'nerulio-project', version:2, id, name, createdAt, assets:Asset[], settings:{}}
 * Asset (kind 'image') — Aseprite-shaped:
 *   width, height          the canvas every cel is placed on
 *   layers[]               {id, name, visible, opacity 0–255, blend}   bottom → top
 *   frames[]               model.js AssetFrame IN TIME ORDER (this is the timeline): a region
 *                          (sourceRect) of the composited canvas, with pivot, boxes, collision,
 *                          duration (ms), tag
 *   cels[]                 {layerId, frameId, blob, x, y, opacity}: pixels of one layer. `frameId`
 *                          is a frame id (that frame's own pixels) or SHARED ('*'): the layer's
 *                          picture used by every frame without a cel of its own (a sprite sheet).
 *                          `blob` = SHA-256 hex of the PNG bytes, stored ONCE outside the document
 *                          (ImageStore / IndexedDB / .nerulio images/)
 *   tags[]                 model.js Animation + {color, repeat}: named frame sequences
 *   slices[]               Aseprite-style {id, name, color, data, keys:[{frame, bounds, center?, pivot?}]}
 *   grid                   {w, h, ox, oy, sx, sy} the grid the frames were cut with, or null
 *   source                 {name, type, size, lastModified} of the imported file (informational)
 *   import                 optional {kind, decisions[], sourceBlob?}: what an importer decided
 *
 * Documents are immutable: every edit returns a new object and shares everything it did not touch.
 * That is what makes History's "undo = previous document" cheap and exact. */
import {frame as makeFrame,animation as makeAnimation,newId} from '../../game/model.js';
export const PROJECT_FORMAT='nerulio-project',PROJECT_VERSION=2;
/** frameId of a layer's shared picture (a sheet): used by every frame without a cel of its own. */
export const SHARED='*';
export const TAG_COLORS=Object.freeze(['#e8a33d','#4cc2ff','#7bd88f','#ff6b8b','#b48cff','#f5e06e']);
const BLOB_RE=/^[0-9a-f]{64}$/;
export const isBlobId=v=>BLOB_RE.test(String(v));
const int=(v,name,min=0)=>{if(!Number.isSafeInteger(v)||v<min)throw Error(`${name} must be an integer ≥ ${min}`);return v;};
const str=(v,max=200)=>String(v??'').slice(0,max);
export const uid=prefix=>`${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
export function createProject({id=uid('p'),name='Untitled',createdAt=new Date().toISOString()}={}){
 return {format:PROJECT_FORMAT,version:PROJECT_VERSION,id,name:str(name)||'Untitled',createdAt,assets:[],settings:{}};
}
/** A one-layer image asset whose picture is the layer's shared cel (a sheet with no frames yet). */
export function imageAsset({id=uid('a'),name='image',width,height,blob,source=null}){
 int(width,'width',1);int(height,'height',1);if(!BLOB_RE.test(String(blob)))throw Error('blob must be a SHA-256 hex id');
 const layerId='l1';
 return {id,kind:'image',name:str(name)||'image',width,height,
  layers:[{id:layerId,name:'Layer 1',visible:true,opacity:255,blend:'normal'}],
  cels:[{layerId,frameId:SHARED,blob,x:0,y:0,opacity:255}],
  frames:[],tags:[],slices:[],grid:null,
  source:source?{name:str(source.name),type:str(source.type,100),size:Number(source.size)||0,lastModified:Number(source.lastModified)||0}:null};
}
export const assetById=(doc,id)=>doc.assets.find(a=>a.id===id)||null;
/** The blob that stands for the asset as a whole (thumbnails, the Viewer): the bottom layer's
 * shared picture when there is one, else the first cel. */
export const primaryBlob=asset=>{
 if(!asset?.cels?.length)return null;const lid=asset.layers?.[0]?.id;
 return (asset.cels.find(c=>c.frameId===SHARED&&c.layerId===lid)||asset.cels.find(c=>c.frameId===SHARED)||asset.cels[0]).blob;
};
const mapAsset=(doc,id,fn)=>{let hit=false,changed=false;const assets=doc.assets.map(a=>{if(a.id!==id)return a;hit=true;const next=fn(a);if(next!==a)changed=true;return next;});if(!hit)throw Error(`Unknown asset ${id}`);return changed?{...doc,assets}:doc;};
export {mapAsset};
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
 return makeFrame({id:id||uid('f'),name:name??`${stemOf(asset.name)}_${index}`,sourceRect:clampRect(rect,asset),duration:100});
}
export function clampRect(r,asset){
 const x=Math.max(0,Math.min(asset.width-1,Math.round(r.x))),y=Math.max(0,Math.min(asset.height-1,Math.round(r.y)));
 return {x,y,w:Math.max(1,Math.min(asset.width-x,Math.round(r.w))),h:Math.max(1,Math.min(asset.height-y,Math.round(r.h)))};
}
export const frameRect=f=>f.sourceRect;
const pruneTags=(tags,frames)=>{const ids=new Set(frames.map(f=>f.id));let changed=false;const out=tags.map(t=>{const frameIds=t.frameIds.filter(i=>ids.has(i));if(frameIds.length!==t.frameIds.length){changed=true;return {...t,frameIds};}return t;});return changed?out:tags;};
/** Cels of frames that no longer exist are dropped with them (shared cels always stay). */
const pruneCels=(cels,frames)=>{const ids=new Set(frames.map(f=>f.id));const out=cels.filter(c=>c.frameId===SHARED||ids.has(c.frameId));return out.length===cels.length?cels:out;};
export function setFrames(doc,assetId,frames){return mapAsset(doc,assetId,a=>({...a,frames,tags:pruneTags(a.tags,frames),cels:pruneCels(a.cels,frames)}));}
export function addFrames(doc,assetId,rects){
 return mapAsset(doc,assetId,a=>{const frames=[...a.frames];for(const r of rects)frames.push(r.sourceRect?makeFrame(r):frameForRect({...a,frames},r,{index:frames.length}));return {...a,frames};});
}
export function removeFrames(doc,assetId,ids){
 const gone=new Set(ids);
 return mapAsset(doc,assetId,a=>{const frames=a.frames.filter(f=>!gone.has(f.id));return frames.length===a.frames.length?a:{...a,frames,tags:pruneTags(a.tags,frames),cels:pruneCels(a.cels,frames)};});
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
/** Aseprite repeat count: 0 = forever. Documents that only have `loop` get 0 or 1. */
export function repeatOf(spec,prev=null){
 if(Number.isSafeInteger(spec.repeat)&&spec.repeat>=0)return Math.min(spec.repeat,65535);
 if(prev&&Number.isSafeInteger(prev.repeat))return prev.repeat;
 return spec.loop===false?1:0;
}
const tagOut=(t,frames,color)=>{const repeat=repeatOf(t);return {...makeAnimation({...t,loop:repeat===0},frames),color:str(color||TAG_COLORS[0],16),repeat,...(t.metadata&&typeof t.metadata==='object'?{metadata:t.metadata}:{})};};
export function addTag(doc,assetId,spec={}){
 return mapAsset(doc,assetId,a=>{
  const taken=new Set(a.tags.map(t=>t.name));let name=str(spec.name||'tag').trim()||'tag';if(taken.has(name)){let n=2;while(taken.has(`${name}_${n}`))n++;name=`${name}_${n}`;}
  const tag=tagOut({...spec,id:spec.id||uid('g'),name},a.frames,spec.color||TAG_COLORS[a.tags.length%TAG_COLORS.length]);
  return {...a,tags:[...a.tags,tag]};
 });
}
export function updateTag(doc,assetId,tagId,patch){
 return mapAsset(doc,assetId,a=>({...a,tags:a.tags.map(t=>{
  if(t.id!==tagId)return t;
  const next={...t,...patch};if(!('repeat'in patch)&&'loop'in patch)next.repeat=patch.loop===false?Math.max(1,t.repeat||1):0;
  return tagOut({...next,id:t.id},a.frames,next.color??t.color);
 })}));
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
/** Every blob id the document points at (what autosave and the .nerulio writer must keep):
 * image cels, import sources and attached files (settings.files, see below). */
export function referencedBlobs(doc){
 const out=new Set();
 for(const a of doc.assets||[]){for(const c of a.cels||[])out.add(c.blob);if(a.import?.sourceBlob)out.add(a.import.sourceBlob);}
 for(const id of Object.keys(doc.settings?.files||{}))out.add(id);
 return out;
}
// ------------------------------------------------------------------ attached files
/** Non-image files a workspace needs to keep with the project (a font a game font is built from),
 * stored like images: once, by SHA-256 of their bytes, outside the document.
 *   settings.files = {[sha256]: {name, type, size, owner}}   owner = the workspace id that uses it
 * They travel in autosave and in .nerulio files (files/<sha256>) and are verified by hash on open. */
export const referencedFiles=doc=>new Map(Object.entries(doc.settings?.files||{}));
export const isFileBlob=(doc,id)=>!!doc.settings?.files?.[id];
export function attachFile(doc,id,{name='file',type='application/octet-stream',size=0,owner=''}={}){
 if(!BLOB_RE.test(String(id)))throw Error('A file id must be a SHA-256 hex id');
 const cur=doc.settings?.files?.[id],meta={name:str(name,200)||'file',type:str(type,100)||'application/octet-stream',size:Number(size)||0,owner:str(owner,32)};
 if(cur&&JSON.stringify(cur)===JSON.stringify(meta))return doc;
 return {...doc,settings:{...(doc.settings||{}),files:{...(doc.settings?.files||{}),[id]:meta}}};
}
export function detachFile(doc,id){
 if(!doc.settings?.files?.[id])return doc;
 const files={...doc.settings.files};delete files[id];
 return {...doc,settings:{...doc.settings,files}};
}
/** True when there is anything to save: images or attached files. */
export const hasContent=doc=>(doc?.assets?.length||0)>0||Object.keys(doc?.settings?.files||{}).length>0;
/** Older formats → current. The hook exists so autosaved snapshots never strand.
 * v1 → v2: a v1 asset had one `timeline` entry; its cels become the layers' shared pictures. */
export function migrate(raw){
 if(!raw||raw.format!==PROJECT_FORMAT)throw Error('Not a Nerulio project');
 const v=Number(raw.version);
 if(!Number.isInteger(v)||v<1)throw Error('Unknown project version');
 if(v>PROJECT_VERSION)throw Error(`This project was saved by a newer Studio (format ${v}); update to open it`);
 if(v===1)return {...raw,version:2,assets:(raw.assets||[]).map(a=>{
  const {timeline,...rest}=a;
  return {...rest,cels:(a.cels||[]).map(c=>({...c,frameId:SHARED}))};
 })};
 return raw;
}
/** Parses and validates a loaded document; throws with a readable reason instead of opening a
 * project the exporters would later choke on. Output is a fresh object with only known fields. */
export function normalizeProject(raw){
 const d=migrate(raw);
 const doc={format:PROJECT_FORMAT,version:PROJECT_VERSION,id:str(d.id,80)||uid('p'),name:str(d.name)||'Untitled',createdAt:str(d.createdAt,40),assets:[],settings:d.settings&&typeof d.settings==='object'?JSON.parse(JSON.stringify(d.settings)):{}};
 if(doc.settings.files!=null){
  if(typeof doc.settings.files!=='object'||Array.isArray(doc.settings.files))throw Error('settings.files must be an object');
  for(const [id,m] of Object.entries(doc.settings.files)){
   if(!BLOB_RE.test(id))throw Error('An attached file has a bad id');
   doc.settings.files[id]={name:str(m?.name,200)||'file',type:str(m?.type,100)||'application/octet-stream',size:Number(m?.size)||0,owner:str(m?.owner,32)};
  }
 }
 const ids=new Set();
 for(const a of d.assets||[]){
  if(a.kind!=='image')throw Error(`Unsupported asset kind ${a.kind}`);
  if(ids.has(a.id))throw Error(`Duplicate asset id ${a.id}`);ids.add(a.id);
  int(a.width,'width',1);int(a.height,'height',1);
  const layers=(a.layers||[]).map(l=>({id:str(l.id,80),name:str(l.name),visible:l.visible!==false,opacity:Math.max(0,Math.min(255,Math.round(Number(l.opacity??255)))),blend:str(l.blend||'normal',20)}));
  const layerIds=new Set(layers.map(l=>l.id));
  if(layerIds.size!==layers.length)throw Error(`Asset ${a.id}: duplicate layer id`);
  const frames=(a.frames||[]).map(f=>makeFrame(f)),fids=new Set();
  for(const f of frames){if(fids.has(f.id))throw Error(`Duplicate frame id ${f.id}`);if(f.id===SHARED)throw Error('A frame cannot be called *');fids.add(f.id);
   const r=f.sourceRect;if(r.x+r.w>a.width||r.y+r.h>a.height)throw Error(`Frame ${f.id} lies outside its image`);}
  const celKeys=new Set();
  const cels=(a.cels||[]).map(c=>{
   if(!BLOB_RE.test(String(c.blob)))throw Error(`Asset ${a.id}: bad image reference`);
   if(!layerIds.has(c.layerId)||(c.frameId!==SHARED&&!fids.has(c.frameId)))throw Error(`Asset ${a.id}: cel points at a missing layer or frame`);
   const key=c.layerId+'|'+c.frameId;if(celKeys.has(key))throw Error(`Asset ${a.id}: two cels for one layer and frame`);celKeys.add(key);
   return {layerId:c.layerId,frameId:c.frameId,blob:c.blob,x:Math.round(Number(c.x)||0),y:Math.round(Number(c.y)||0),opacity:Math.max(0,Math.min(255,Math.round(Number(c.opacity??255))))};
  });
  if(!cels.length)throw Error(`Asset ${a.id} has no pixels`);
  const tags=(a.tags||[]).map(t=>tagOut(t.metadata?{...t,metadata:JSON.parse(JSON.stringify(t.metadata))}:t,frames,t.color||TAG_COLORS[0]));
  const slices=(a.slices||[]).map(makeSlice);
  const g=a.grid,imp=a.import&&typeof a.import==='object'?normalizeImport(a.import):null;
  doc.assets.push({id:str(a.id,80),kind:'image',name:str(a.name)||'image',width:a.width,height:a.height,layers,cels,frames,tags,slices,
   grid:g?{w:int(g.w,'grid.w',1),h:int(g.h,'grid.h',1),ox:int(g.ox,'grid.ox'),oy:int(g.oy,'grid.oy'),sx:int(g.sx,'grid.sx'),sy:int(g.sy,'grid.sy')}:null,
   source:a.source?{name:str(a.source.name),type:str(a.source.type,100),size:Number(a.source.size)||0,lastModified:Number(a.source.lastModified)||0}:null,
   ...(imp?{import:imp}:{})});
 }
 return doc;
}
/** asset.import: plain JSON (the decisions are UI data), with its one blob reference checked. */
function normalizeImport(x){
 const out=JSON.parse(JSON.stringify(x));
 if(out.sourceBlob!=null&&!BLOB_RE.test(String(out.sourceBlob)))throw Error('Import source is not an image reference');
 out.kind=str(out.kind||'image',40);out.decisions=Array.isArray(out.decisions)?out.decisions.slice(0,64):[];
 return out;
}
export function stats(doc){
 let frames=0,pixels=0;for(const a of doc.assets){frames+=a.frames.length;pixels+=a.width*a.height;}
 return {assets:doc.assets.length,frames,pixels,blobs:referencedBlobs(doc).size};
}
export {newId};
