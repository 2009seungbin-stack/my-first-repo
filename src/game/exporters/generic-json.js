/** The one export envelope every Sprite Lab exporter is built from. Pure data: no DOM, no files.
 *
 * Everything comes from the model — frame rects, pivots, per-frame durations, tags, hitboxes,
 * collision polygons — and the playback sequence comes from `playbackOrder`/`playbackTimes`, the
 * same two functions the preview plays. So "preview == export" is not a promise anyone has to
 * remember to keep: a ping-pong animation cannot repeat its end frames in one place and not the
 * other, because there is only one definition of the sequence.
 *
 * Coordinates: `rect` is in atlas pixels, origin top-left, y down. `offset` is where the stored
 * pixels sit inside the frame's own canvas (`sourceSize`). `pivot` is normalised on that canvas.
 * `boxes` and `collision` are in frame-canvas pixels, y down. An engine with a bottom-left origin
 * converts in its own exporter and its own helper — never here. */
import {SCHEMA_VERSION,playbackOrder,playbackTimes,validateProject} from '../model.js';
export const TOOL='nerulio-sprite-lab';
export const TOOL_VERSION='1';
export const ENGINE_TARGETS=Object.freeze(['generic','godot-4','unity-2022']);
/** Page image names. One page is `atlas.png`; several are `atlas-0.png`, `atlas-1.png`, … so a
 * single-page export does not carry an index nobody needs. */
export function imageNames(pages=1,{base='atlas',extension='png'}={}){
 if(!Number.isSafeInteger(pages)||pages<1||pages>256)throw Error('An atlas has 1…256 pages');
 const stem=String(base||'atlas').replace(/[^\w.-]+/g,'_').replace(/\.[^.]*$/,'')||'atlas';
 return pages===1?[`${stem}.${extension}`]:Array.from({length:pages},(_,i)=>`${stem}-${i}.${extension}`);
}
/** Unique, file-safe keys for the frame map. A frame with no name, or one whose name is already
 * taken, gets a numbered suffix; the mapping is returned so every exporter agrees on the keys. */
export function frameNames(frames){
 const used=new Set(),names=new Map();
 frames.forEach((f,i)=>{
  const base=String(f.name||'').trim().replace(/\.[^.]*$/,'').replace(/[^\w.-]+/g,'_')||`frame_${String(i+1).padStart(3,'0')}`;
  let name=base;
  for(let n=2;used.has(name);n++)name=`${base}_${n}`;
  used.add(name);names.set(f.id,name);
 });
 return names;
}
const rect=r=>({x:r.x,y:r.y,w:r.w,h:r.h});
/** Builds the envelope. Throws rather than emit data an engine would read as a lie: a frame with
 * no atlas region, an animation naming a frame that is not there, a duplicate animation name. */
export function exportProject({frames=[],animations=[],atlas=null}={},{engineTarget='generic',base='atlas',extension='png',tool=TOOL,toolVersion=TOOL_VERSION,names=null,meta={}}={}){
 if(!ENGINE_TARGETS.includes(engineTarget))throw Error(`engineTarget must be one of ${ENGINE_TARGETS.join(', ')}`);
 if(!frames.length)throw Error('Nothing to export: add at least one frame.');
 const problems=validateProject({frames,animations});
 if(problems.length)throw Error(`This project cannot be exported yet:\n- ${problems.join('\n- ')}`);
 if(!atlas||!atlas.frames)throw Error('Pack the frames before exporting: the atlas region of every frame is part of the data.');
 const missing=frames.filter(f=>!atlas.frames[f.id]).map(f=>f.name||f.id);
 if(missing.length)throw Error(`No atlas region for ${missing.length} frame(s): ${missing.slice(0,5).join(', ')}`);
 const key=names||frameNames(frames),pages=atlas.pages||1,images=imageNames(pages,{base,extension});
 const pageSizes=atlas.pageSizes||[{width:atlas.width,height:atlas.height}];
 const out={meta:{tool,toolVersion,schemaVersion:SCHEMA_VERSION,engineTarget,image:images[0],images,pages,
   size:{w:pageSizes[0].width,h:pageSizes[0].height},pageSizes:pageSizes.map(p=>({w:p.width,h:p.height})),
   padding:atlas.padding||0,extrude:atlas.extrude||0,rotated:false,...meta},
  frames:{},animations:{}};
 for(const f of frames){
  const place=atlas.frames[f.id];
  out.frames[key.get(f.id)]={page:place.page||0,rect:rect(place),rotated:false,
   aliasOf:place.aliasOf?key.get(place.aliasOf)??null:null,
   sourceSize:{w:f.canvasWidth,h:f.canvasHeight},offset:{x:f.offsetX,y:f.offsetY},
   pivot:{x:f.pivotX,y:f.pivotY},duration:f.duration,tag:f.tag||'',
   boxes:f.boxes.map(b=>({...b})),collision:f.collision.map(p=>p.map(([x,y])=>[x,y])),
   ...(Object.keys(f.metadata||{}).length?{metadata:{...f.metadata}}:{})};
 }
 for(const a of animations){
  const order=playbackOrder(a),times=playbackTimes(a,frames);
  out.animations[a.name]={frames:a.frameIds.map(id=>key.get(id)),fps:a.fps,direction:a.direction,loop:a.loop,
   playback:{frames:order.map(id=>key.get(id)),durations:times},
   totalMs:times.reduce((s,v)=>s+v,0)};
 }
 return out;
}
export const projectJson=(project,options)=>JSON.stringify(exportProject(project,options),null,2);
/** The TexturePacker "JSON (hash)" fields for one envelope frame: `frame` (the region, unrotated
 * size), `trimmed`, `spriteSourceSize` (where the stored pixels sit on the frame canvas) and
 * `sourceSize`. Phaser's `load.atlas` and PixiJS's `Assets.load` read exactly these and ignore the
 * rest, so the generic file loads in both as it is. */
export function texturePackerFrame(f){
 return {frame:{x:f.rect.x,y:f.rect.y,w:f.rect.w,h:f.rect.h},rotated:false,
  trimmed:f.offset.x!==0||f.offset.y!==0||f.rect.w!==f.sourceSize.w||f.rect.h!==f.sourceSize.h,
  spriteSourceSize:{x:f.offset.x,y:f.offset.y,w:f.rect.w,h:f.rect.h},sourceSize:{w:f.sourceSize.w,h:f.sourceSize.h}};
}
/** Files a generic export writes beside the atlas images. The envelope is also a valid
 * TexturePacker JSON hash (frame / spriteSourceSize / sourceSize next to rect / offset), so the
 * web engines' standard atlas loaders take it directly. A multi-page export adds one hash file per
 * page, because those loaders read one image per file. */
export function genericBundle(project,options={}){
 const data=exportProject(project,{...options,engineTarget:'generic'});
 for(const f of Object.values(data.frames))Object.assign(f,texturePackerFrame(f));
 data.meta={...data.meta,app:data.meta.tool,format:'RGBA8888',scale:'1'};
 const stem=data.meta.image.replace(/\.[^.]*$/,'').replace(/-0$/,'');
 const files=[{name:`${stem}.json`,text:JSON.stringify(data,null,2),type:'application/json'}];
 if(data.meta.pages>1)data.meta.images.forEach((image,page)=>{
  const frames=Object.fromEntries(Object.entries(data.frames).filter(([,f])=>f.page===page).map(([k,f])=>[k,texturePackerFrame(f)]));
  files.push({name:`${image.replace(/\.[^.]*$/,'')}.texturepacker.json`,type:'application/json',
   text:JSON.stringify({frames,meta:{app:data.meta.tool,image,format:'RGBA8888',size:data.meta.pageSizes[page],scale:'1'}},null,2)});
 });
 return files;
}
