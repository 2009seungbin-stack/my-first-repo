/** Builds Studio sprite assets from what an importer decoded. Pure: blob ids in (the caller has
 * already stored each PNG), documents out. The result always passes project.normalizeProject. */
import {frame as makeFrame,animation as makeAnimation,box as makeBox} from '../../game/model.js';
import {TAG_COLORS,uid,makeSlice,SHARED} from '../core/project.js';
import {syncTags} from './sprite-doc.js';
const str=(v,n=120)=>String(v??'').slice(0,n);
/** Tag specs → tags. A spec is {name, positions:[frame index…]} or an Aseprite range
 * {name, from, to, reverse?}. Names are made unique; colours cycle. */
export function buildTags(frames,specs){
 const taken=new Set(),out=[];
 specs.forEach((s,i)=>{
  let ids=s.positions?s.positions.map(p=>frames[p]?.id).filter(Boolean):frames.slice(s.from,s.to+1).map(f=>f.id);
  if(s.reverse)ids=ids.reverse();
  if(!ids.length)return;
  let name=str(s.name||'tag',80).trim()||'tag';if(taken.has(name)){let n=2;while(taken.has(`${name}_${n}`))n++;name=`${name}_${n}`;}taken.add(name);
  const repeat=Number.isSafeInteger(s.repeat)&&s.repeat>=0?s.repeat:0;
  out.push({...makeAnimation({id:s.id||uid('g'),name,frameIds:ids,fps:s.fps||10,direction:s.direction||'forward',loop:repeat===0},frames),
   color:s.color||TAG_COLORS[i%TAG_COLORS.length],repeat,...(s.metadata?{metadata:s.metadata}:{})});
 });
 return out;
}
/** An animated asset: each frame has its own cels (GIF, APNG, loose files, .aseprite).
 * frames: [{name, duration, cels:[{layer, blob, x, y, opacity}], pivotX?, pivotY?, boxes?, metadata?}] */
export function animatedAsset({id=uid('a'),name,width,height,layers=[{name:'Layer 1'}],frames,tags=[],slices=[],importInfo=null,source=null}){
 const L=layers.map((l,i)=>({id:'l'+(i+1),name:str(l.name||`Layer ${i+1}`)||`Layer ${i+1}`,visible:l.visible!==false,opacity:Math.max(0,Math.min(255,l.opacity??255)),blend:l.blend||'normal'}));
 const F=[],cels=[];
 frames.forEach((f,i)=>{
  const fid=uid('f')+i.toString(36);
  F.push(makeFrame({id:fid,name:str(f.name??`${stem(name)}_${i}`),sourceRect:{x:0,y:0,w:width,h:height},canvasWidth:width,canvasHeight:height,
   duration:Math.max(1,Math.round(f.duration??100)),pivotX:f.pivotX??.5,pivotY:f.pivotY??1,boxes:(f.boxes||[]).map(makeBox),metadata:f.metadata||{}}));
  for(const c of f.cels||[])cels.push({layerId:L[c.layer]?.id||'l1',frameId:fid,blob:c.blob,x:c.x|0,y:c.y|0,opacity:c.opacity??255});
 });
 const asset={id,kind:'image',name:str(name)||'sprite',width,height,layers:L,cels,frames:F,tags:buildTags(F,tags),
  slices:slices.map(s=>makeSlice(s)),grid:null,source:sourceOf(source),...(importInfo?{import:importInfo}:{})};
 return syncTags(asset);
}
/** Frames cut from the asset's shared picture (a sheet): rects in reading order. */
export function sheetFrames(asset,rects,{duration=100,prefix=stem(asset.name)}={}){
 const pad=String(Math.max(0,rects.length-1)).length;
 return rects.map((r,i)=>makeFrame({id:uid('f')+i.toString(36),name:`${prefix}_${String(i).padStart(pad,'0')}`,sourceRect:{x:r.x,y:r.y,w:r.w,h:r.h},duration,metadata:{row:r.row??0,col:r.col??0}}));
}
export const stem=n=>String(n||'sprite').replace(/^.*[\\/]/,'').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,60)||'sprite';
const sourceOf=s=>s?{name:str(s.name),type:str(s.type,100),size:Number(s.size)||0,lastModified:Number(s.lastModified)||0}:null;
/** Sprite Lab project JSON (src/game/project.js format) onto a sheet asset of the same size. */
export function labProjectFrames(asset,loaded){
 const frames=loaded.frames.map(f=>makeFrame({...f,id:uid('f'),duration:f.duration??Math.round(1000/(loaded.animations.find(a=>a.frameIds.includes(f.id))?.fps||10)),metadata:{...f.metadata,labId:f.id}}));
 const byLab=new Map(frames.map(f=>[f.metadata.labId,f.id]));
 const tags=loaded.animations.map(a=>({name:a.name,positions:a.frameIds.map(id=>frames.findIndex(f=>f.id===byLab.get(id))).filter(i=>i>=0),direction:a.direction,repeat:a.loop===false?1:0,fps:a.fps}));
 return {frames,tags:buildTags(frames,tags)};
}
export {SHARED};
