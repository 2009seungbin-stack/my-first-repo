/** The Sprite Lab's project: frames, animations and an atlas in the shapes of model.js, plus the
 * edits the Lab performs on them. Pure data in, pure data out — no DOM, no pixels, no canvas.
 *
 * Every Lab stage calls these, so undo is a list of *projects* (a few KB of records), never image
 * snapshots, and the preview and the exporters read the same one object. An edit returns a new
 * project; nothing is mutated, which is what makes `past.push(project)` a correct undo step.
 *
 * Project {frames:AssetFrame[], animations:Animation[], atlas:Atlas|null, settings:{}} */
import {frame as makeFrame,animation as makeAnimation,box as makeBox,polygon,newId,playbackOrder,playbackTimes,setPivot,mirrorFrame,validateProject,BOX_TYPES,DIRECTIONS,PIVOT_PRESETS} from './model.js';
export const TAGS=Object.freeze(['Idle','Walk','Run','Attack','Hit','Death']);
export const BOX_KINDS=Object.freeze([...BOX_TYPES,'custom']);
/** Box types are told apart by a label *and* a hatch pattern, never by colour alone. */
export const BOX_PATTERNS=Object.freeze({hit:'diagonal',hurt:'cross',interact:'dots',custom:'horizontal'});
export const project=({frames=[],animations=[],atlas=null,settings={}}={})=>({frames,animations,atlas,settings});
const replace=(list,id,fn)=>list.map(item=>item.id===id?fn(item):item);
const byId=list=>new Map(list.map(item=>[item.id,item]));
/** An atlas stops describing the frames the moment a frame moves, so any frame edit drops it
 * rather than leaving an export to read stale rectangles. */
const touched=p=>({...p,atlas:null});
export const frameIndex=(p,id)=>p.frames.findIndex(f=>f.id===id);
export const animationOf=(p,id)=>p.animations.find(a=>a.id===id)||null;
export function setFrames(p,frames){return touched({...p,frames,animations:p.animations.map(a=>({...a,frameIds:a.frameIds.filter(id=>frames.some(f=>f.id===id))}))});}
/** Drops frames and every reference to them. An animation left with no frames is dropped too:
 * `validateProject` would refuse to export it, so keeping it would only fail later. */
export function removeFrames(p,ids){
 const gone=new Set(ids),frames=p.frames.filter(f=>!gone.has(f.id));
 const animations=p.animations.map(a=>({...a,frameIds:a.frameIds.filter(id=>!gone.has(id))})).filter(a=>a.frameIds.length);
 return touched({...p,frames,animations});
}
export function reorderFrames(p,ids){
 const map=byId(p.frames),frames=ids.map(id=>map.get(id)).filter(Boolean);
 if(frames.length!==p.frames.length)throw Error('Reordering must list every frame exactly once');
 return {...p,frames};
}
export const mapFrames=(p,ids,fn)=>{const want=new Set(ids);return touched({...p,frames:p.frames.map(f=>want.has(f.id)?fn(f):f)});};
/** Pivot for a set of frames. `pixels` values are per frame, so frames of different canvas sizes
 * each get the pivot that lands on that pixel of *their* canvas. */
export function applyPivotTo(p,ids,pivot){
 if(typeof pivot==='string'){const preset=PIVOT_PRESETS[pivot];if(!preset)throw Error(`Unknown pivot preset ${pivot}`);
  return mapFrames(p,ids,f=>({...f,pivotX:preset[0],pivotY:preset[1]}));}
 const {x,y,pixels=false}=pivot;
 if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('A pivot is a preset name or {x,y}');
 return mapFrames(p,ids,f=>setPivot(f,x,y,{pixels}));
}
/** Adds one box to every named frame. Each frame gets its own copy with its own id, so editing a
 * box on frame 5 cannot silently change frame 4. */
export function addBoxTo(p,ids,spec){
 const template=makeBox({...spec,id:undefined});
 return mapFrames(p,ids,f=>({...f,boxes:[...f.boxes,{...template,id:newId('b')}]}));
}
export function updateBox(p,frameId,boxId,patch){
 return mapFrames(p,[frameId],f=>({...f,boxes:replace(f.boxes,boxId,b=>makeBox({...b,...patch,id:b.id}))}));
}
export const removeBox=(p,frameId,boxId)=>mapFrames(p,[frameId],f=>({...f,boxes:f.boxes.filter(b=>b.id!==boxId)}));
export const setCollision=(p,ids,polygons)=>mapFrames(p,ids,f=>({...f,collision:polygons.map(polygon)}));
export const setFrameCollision=(p,byFrame)=>touched({...p,frames:p.frames.map(f=>byFrame.has(f.id)?{...f,collision:byFrame.get(f.id).map(polygon)}:f)});
export const setDuration=(p,ids,duration)=>mapFrames(p,ids,f=>makeFrame({...f,duration}));
export const setTag=(p,ids,tag)=>mapFrames(p,ids,f=>({...f,tag:String(tag||'')}));
/** A name a user can read and an exporter can key on: unique within the project. */
export function uniqueAnimationName(p,wanted='Walk'){
 const base=String(wanted||'Walk').trim()||'Walk',taken=new Set(p.animations.map(a=>a.name));
 if(!taken.has(base))return base;
 for(let n=2;;n++)if(!taken.has(`${base}_${n}`))return `${base}_${n}`;
}
export function addAnimation(p,spec={}){
 const animation=makeAnimation({...spec,name:uniqueAnimationName(p,spec.name)},p.frames);
 return {...p,animations:[...p.animations,animation]};
}
export function updateAnimation(p,id,patch){
 const current=animationOf(p,id);
 if(!current)throw Error(`Unknown animation ${id}`);
 const name=patch.name!==undefined&&patch.name!==current.name?uniqueAnimationName(p,patch.name):current.name;
 return {...p,animations:replace(p.animations,id,a=>makeAnimation({...a,...patch,name,id:a.id},p.frames))};
}
export const removeAnimation=(p,id)=>({...p,animations:p.animations.filter(a=>a.id!==id)});
/** A mirrored animation: new frames from `mirrorFrame` (metadata flipped; the pixels are flipped by
 * the caller at preview and export time) plus an animation that plays them in the same order. */
export function mirrorAnimation(p,id,{suffix='_mirror'}={}){
 const source=animationOf(p,id);
 if(!source)throw Error(`Unknown animation ${id}`);
 const map=byId(p.frames),made=new Map();
 for(const frameId of source.frameIds)if(!made.has(frameId)){
  const original=map.get(frameId);
  if(!original)throw Error(`Animation references unknown frame ${frameId}`);
  made.set(frameId,{...mirrorFrame(original),name:`${original.name}${suffix}`});
 }
 const frames=[...p.frames,...made.values()];
 return addAnimation({...p,frames},{name:`${source.name}${suffix}`,frameIds:source.frameIds.map(fid=>made.get(fid).id),
  fps:source.fps,direction:source.direction,loop:source.loop});
}
/** The exact steps one cycle plays, with the frame record and the cumulative time of each — what
 * the preview steps through and what a timeline scrubber is indexed by. */
export function playback(p,animation){
 if(!animation)return [];
 const map=byId(p.frames),order=playbackOrder(animation),times=playbackTimes(animation,p.frames);
 let at=0;
 return order.map((id,step)=>{const frame=map.get(id);const from=at;at+=times[step];return {step,id,frame,duration:times[step],from,to:at};});
}
export const cycleMs=(p,animation)=>playback(p,animation).reduce((s,step)=>s+step.duration,0);
/** Which step a cycle is showing at time t. Used by the preview; also proves preview == export,
 * because the steps come from `playbackOrder`/`playbackTimes` and nothing else. */
export function stepAt(steps,ms){
 if(!steps.length)return null;
 const total=steps[steps.length-1].to;
 const at=total>0?((ms%total)+total)%total:0;
 return steps.find(s=>at>=s.from&&at<s.to)||steps[steps.length-1];
}
/** Frames × box types for one animation: where each kind of box is active, and where it is missing.
 * `rows` is one row per box type present anywhere in the animation, `cells[i]` counts the boxes of
 * that type on step i — the grid the hitbox timeline draws. */
export function boxTimeline(p,animation){
 const steps=playback(p,animation),kinds=[];
 for(const step of steps)for(const box of step.frame?.boxes||[])if(!kinds.includes(box.type))kinds.push(box.type);
 return {steps:steps.map(s=>({step:s.step,id:s.id,name:s.frame?.name||'',duration:s.duration})),
  rows:kinds.map(type=>({type,pattern:BOX_PATTERNS[type]||BOX_PATTERNS.custom,
   cells:steps.map(s=>(s.frame?.boxes||[]).filter(b=>b.type===type).length)}))};
}
/** The frames of an animation between two 1-based step numbers, inclusive — "frames 4–6 of Attack".
 * Ids are de-duplicated, because a ping-pong step list shows the same frame twice. */
export function stepRange(p,animation,from,to){
 const steps=playback(p,animation),lo=Math.max(1,Math.min(from,to)),hi=Math.min(steps.length,Math.max(from,to));
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||hi<lo)throw Error(`Frames ${from}–${to} are outside this animation's ${steps.length} steps`);
 return [...new Set(steps.slice(lo-1,hi).map(s=>s.id))];
}
export const problems=p=>validateProject(p);
/** Settings — never pixels — that a URL query can carry, so a slicing or packing recipe is
 * shareable while the sheet stays on the device. Unknown keys and out-of-range values are dropped
 * rather than trusted. */
export const SETTINGS=Object.freeze({
 mode:{values:['auto','grid']},merge:{min:0,max:256},autoMerge:{bool:true},threshold:{min:0,max:254},minArea:{min:1,max:1_000_000},
 cellW:{min:1,max:8192},cellH:{min:1,max:8192},offsetX:{min:0,max:8192},offsetY:{min:0,max:8192},spacingX:{min:0,max:8192},spacingY:{min:0,max:8192},
 skipEmpty:{bool:true},trim:{bool:true},canvas:{values:['auto','exact']},canvasW:{min:1,max:8192},canvasH:{min:1,max:8192},
 align:{values:['center','top','bottom','left','right','bottom-center','top-left']},padding:{min:0,max:256},
 fps:{min:1,max:240},direction:{values:[...DIRECTIONS]},zoom:{min:1,max:16},bg:{values:['checker','black','white','magenta']},
 reference:{values:['pivot','bottom-center','bounds-centre','alpha-centroid']},preserveTrend:{bool:true},
 onionBefore:{min:0,max:8},onionAfter:{min:0,max:8},
 atlasPadding:{min:0,max:256},extrude:{min:0,max:64},pot:{bool:true},maxSize:{min:8,max:32768},dedupe:{bool:true},
 target:{values:['generic','godot','unity']},outline:{min:0,max:16},defringe:{bool:true},
 collisionTolerance:{min:0,max:64},collisionVertices:{min:3,max:64},collisionThreshold:{min:0,max:254},collisionPadding:{min:0,max:32},
 collisionShape:{values:['polygon','hull','rect','circle']}});
export function settingsQuery(settings={},defaults={}){
 const q=new URLSearchParams();
 for(const [key,spec] of Object.entries(SETTINGS)){
  const value=settings[key];
  if(value===undefined||value===null||value===defaults[key])continue;
  q.set(key,spec.bool?(value?'1':'0'):String(value));
 }
 return q.toString();
}
export function settingsFromQuery(search,defaults={}){
 const q=search instanceof URLSearchParams?search:new URLSearchParams(String(search||'')),out={...defaults};
 for(const [key,spec] of Object.entries(SETTINGS)){
  if(!q.has(key))continue;
  const raw=q.get(key);
  if(spec.bool){out[key]=raw==='1'||raw==='true';continue;}
  if(spec.values){if(spec.values.includes(raw))out[key]=raw;continue;}
  const n=Number(raw);
  if(Number.isFinite(n))out[key]=Math.max(spec.min,Math.min(spec.max,Math.round(n)));
 }
 return out;
}
/** A project JSON a person can keep beside their sheet: records only, no image data. Loading it
 * asks for the sheet again — which is why `sheet` records the size it was cut from, so a different
 * sheet is refused instead of producing frames that point at nothing. */
export const PROJECT_FORMAT='nerulio-sprite-lab-project';
export function projectFile(p,{sheetWidth,sheetHeight,sheetName=''}={}){
 return {format:PROJECT_FORMAT,version:1,sheet:{name:sheetName,width:sheetWidth,height:sheetHeight},
  settings:{...p.settings},
  frames:p.frames.map(f=>({id:f.id,name:f.name,sourceRect:f.sourceRect,trimmedRect:f.trimmedRect,canvasWidth:f.canvasWidth,canvasHeight:f.canvasHeight,
   offsetX:f.offsetX,offsetY:f.offsetY,pivotX:f.pivotX,pivotY:f.pivotY,duration:f.duration,tag:f.tag,boxes:f.boxes,collision:f.collision,metadata:f.metadata})),
  animations:p.animations.map(a=>({id:a.id,name:a.name,frameIds:a.frameIds,fps:a.fps,direction:a.direction,loop:a.loop}))};
}
export function readProjectFile(data,{sheetWidth,sheetHeight}={}){
 if(!data||data.format!==PROJECT_FORMAT)throw Error('This is not a Sprite Lab project file.');
 if(sheetWidth!=null&&data.sheet&&(data.sheet.width!==sheetWidth||data.sheet.height!==sheetHeight))
  throw Error(`This project was made from a ${data.sheet.width}×${data.sheet.height} sheet; the one you opened is ${sheetWidth}×${sheetHeight}.`);
 const frames=(data.frames||[]).map(f=>makeFrame(f));
 const loaded=project({frames,animations:(data.animations||[]).map(a=>makeAnimation(a,frames)),settings:data.settings||{}});
 const errors=validateProject(loaded);
 if(errors.length)throw Error(`This project file is not consistent:\n- ${errors.join('\n- ')}`);
 return loaded;
}
