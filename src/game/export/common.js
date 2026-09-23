/** Shared pieces of the Studio exporters (src/game/export/*). Pure: no DOM, no pixels.
 *
 * Every exporter reads the same two things:
 *   model   {name, frames:[{id,name,canvasW,canvasH,pivotX,pivotY,duration,boxes,collision,tag}],
 *            animations:[{id,name,frameIds,fps,direction,loop}], slices:[…], implicitAnimation}
 *   variant one scale variant of a pack result (src/game/pack/packer.js publicResult())
 * and returns files [{name, text|bytes, type}] plus `notes` (what the target cannot carry) — so
 * what an engine is NOT given is said, never silently dropped. */
import {playbackOrder} from '../model.js';
import {frameNames} from '../exporters/generic-json.js';
export const GENERATOR=Object.freeze({tool:'nerulio-studio',name:'Nerulio Studio',version:'1',url:'https://nerulio.pages.dev/game/studio/'});
export const SCHEMA_VERSION=1;
export const stemOf=s=>String(s||'atlas').replace(/\.[^.]*$/,'').replace(/[^\w.-]+/g,'_').replace(/^[._-]+|[._-]+$/g,'')||'atlas';
/** Page image names of a variant: "hero.png" or "hero-0.png"…, with the scale suffix ("hero@2x.png"). */
export function pageNames(base,variant){
 const n=variant.pages.length,s=variant.suffix||'';
 return n===1?[`${base}${s}.png`]:variant.pages.map((_,i)=>`${base}-${i}${s}.png`);
}
/** Stable, unique, file-safe frame keys shared by every exporter of one export. */
export const frameKeys=model=>frameNames(model.frames);
/** Milliseconds a frame shows: its own duration, else the fps of the first animation using it. */
export function durationOf(frame,model){
 if(frame.duration!=null)return frame.duration;
 const a=model.animations.find(x=>x.frameIds.includes(frame.id));
 return a?1000/a.fps:100;
}
/** One row per model frame, in model order, with everything an atlas format needs. `region` is the
 * rectangle on the page (rotated frames occupy h×w). Pivot is in pixels on the frame canvas. */
export function frameRows(model,variant,{base=stemOf(model.name),keys=frameKeys(model)}={}){
 const names=pageNames(base,variant);
 return model.frames.map(f=>{
  const e=variant.frames[f.id];if(!e)throw Error(`Frame ${f.name||f.id} was not packed`);
  const region={x:e.x,y:e.y,w:e.rotated?e.h:e.w,h:e.rotated?e.w:e.h};
  return {id:f.id,key:keys.get(f.id),frame:f,page:e.page,image:names[e.page],x:e.x,y:e.y,w:e.w,h:e.h,region,rotated:e.rotated,
   trimmed:e.trimmed,sourceW:e.sourceW,sourceH:e.sourceH,ox:e.ox,oy:e.oy,pivotX:e.pivotX,pivotY:e.pivotY,
   pivotPx:{x:e.pivotX*e.sourceW,y:e.pivotY*e.sourceH},aliasOf:e.aliasOf?keys.get(e.aliasOf):null,durationMs:durationOf(f,model),scale:variant.scale};
 });
}
/** Animations with the exact sequence one cycle plays (reverse / ping-pong baked) and per-step ms. */
export function playback(model,keys=frameKeys(model)){
 const byId=new Map(model.frames.map(f=>[f.id,f]));
 return model.animations.map(a=>{
  const order=playbackOrder(a);
  // repeat: 0 = forever, n = play n times (Aseprite's meaning, docs/STUDIO-SPRITE.md §4)
  const repeat=Number.isInteger(a.repeat)?a.repeat:(a.loop===false?1:0);
  return {name:a.name,fps:a.fps,loop:repeat===0,repeat,direction:a.direction||'forward',frameIds:a.frameIds,
   keys:a.frameIds.map(id=>keys.get(id)),steps:order.map(id=>({id,key:keys.get(id),ms:durationOf(byId.get(id),model)}))};
 });
}
export const round=(v,d=6)=>+Number(v).toFixed(d);
export const xmlEsc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const luaStr=s=>'"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"';
export const json=v=>JSON.stringify(v,null,1);
/** Refuses a pack an engine could not describe (e.g. rotated regions for Godot). */
export function requireNoRotation(variant,target){
 const n=Object.values(variant.frames).filter(e=>e.rotated).length;
 if(n)throw Object.assign(Error(`${target} cannot read rotated atlas regions (${n} frame(s) are rotated). Turn "Allow rotation" off for this export — the ${target} preset does.`),{code:'rotation'});
}
/** TexturePacker-style frame entry (Phaser, Pixi, Aseprite JSON): `frame` holds the UNROTATED size
 * (both engines swap it themselves for rotated frames — see node_modules/phaser/src/textures/parsers/JSONHash.js
 * and pixi.js Spritesheet). */
export function tpFrame(r,{pivot=true}={}){
 return {frame:{x:r.x,y:r.y,w:r.w,h:r.h},rotated:!!r.rotated,trimmed:!!r.trimmed,
  spriteSourceSize:{x:r.ox,y:r.oy,w:r.w,h:r.h},sourceSize:{w:r.sourceW,h:r.sourceH},
  ...(pivot?{pivot:{x:round(r.pivotX),y:round(r.pivotY)}}:{})};
}
