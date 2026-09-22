import {SCHEMA_VERSION} from '../model.js';
import {engineBorders} from '../nine-slice.js';
/** The generic export envelope (docs/GAME-LABS.md) for UI assets: atlases, button state sets
 * and single panels. Pure. One builder for every UI Lab download, so `rect` in the JSON is
 * always the rect the packer used and the nine-slice numbers are always derived, never typed
 * twice. Nothing engine-specific is written: engines get these numbers plus a setup note. */
export const TOOL_VERSION='1';
const rect=r=>({x:r.x,y:r.y,w:r.w,h:r.h});
export function envelope({tool,image,width,height,engineTarget='generic',frames=[],extra={}}){
 if(!tool)throw Error('An envelope names the tool that wrote it');
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw Error('Invalid atlas size');
 const names=new Set();
 const entries=frames.map(f=>{
  if(!f.name)throw Error('Every frame needs a name');
  if(names.has(f.name))throw Error(`Duplicate frame name ${f.name}`);
  names.add(f.name);
  const r=rect(f.rect),source=f.sourceSize?{w:f.sourceSize.w,h:f.sourceSize.h}:{w:r.w,h:r.h};
  const entry={page:0,rect:r,rotated:!!f.rotated,aliasOf:f.aliasOf??null,sourceSize:source,
   offset:{x:f.offset?.x??0,y:f.offset?.y??0},pivot:{x:f.pivot?.x??.5,y:f.pivot?.y??.5},
   duration:f.duration??null,tag:f.tag??'',boxes:f.boxes??[],collision:f.collision??[]};
  if(f.nineSlice){
   const b=engineBorders(f.nineSlice,r.w,r.h);
   entry.nineSlice={pixels:b.pixels,normalized:b.normalized,godot4:b.godot4,unity:b.unity};
  }
  if(f.state)entry.state=f.state;
  return [f.name,entry];
 });
 return {meta:{tool,toolVersion:TOOL_VERSION,schemaVersion:SCHEMA_VERSION,engineTarget,image,size:{w:width,h:height}},
  frames:Object.fromEntries(entries),animations:{},...extra};
}
