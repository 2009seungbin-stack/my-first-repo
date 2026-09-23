/** Builds one export bundle (the files of a ZIP) from a pack result that still holds its pixels.
 * Runs where the pixels are (the pack worker, or Node in tests and tools). Text comes from the pure
 * exporters; images are drawn here: atlas pages (renderPage), per-frame and strip images
 * (`compose` jobs), animated previews (anim.js) and `.aseprite` (src/game/aseprite.js writer). */
import {TARGETS} from './targets.js';
import {stemOf,playback,frameKeys,frameRows} from './common.js';
import {asepriteSequence} from './atlas-json.js';
import {pivotCell,defoldFolder} from './engines.js';
import {renderPage,compose,canvasOf} from '../pack/sprites.js';
import {publicResult} from '../pack/packer.js';
import {encodePNG} from '../pack/png.js';
import {encodeGIF,encodeAPNG} from './anim.js';
import {documentFromSpriteProject,writeAseprite} from '../aseprite.js';
const enc=new TextEncoder();
/** Frames of each animation on one pivot-aligned cell, in playback order (for GIF/APNG/WebM). */
export function animationFrames(model,variant,{scale=1}={}){
 const keys=frameKeys(model),rows=frameRows(model,variant,{keys}),byKey=new Map(rows.map(r=>[r.key,r]));
 let anims=playback(model,keys);
 if(!anims.length)anims=[{name:stemOf(model.name),steps:rows.map(r=>({id:r.id,key:r.key,ms:r.durationMs}))}];
 return anims.map(a=>{
  const list=a.steps.map(s=>byKey.get(s.key)),cell=pivotCell(list);
  return {name:a.name,loop:a.loop!==false,repeat:a.repeat||0,frames:a.steps.map((s,i)=>{
   const img=compose({width:cell.w,height:cell.h,items:[{id:list[i].id,...cell.offset(list[i])}]},variant.sprites);
   return {...(scale>1?upscale(img,scale):img),delayMs:s.ms};
  })};
 });
}
export function upscale(img,k){
 const W=img.width*k,H=img.height*k,out=new Uint8Array(W*H*4);
 for(let y=0;y<H;y++){const sy=Math.floor(y/k);for(let x=0;x<W;x++){const f=(sy*img.width+Math.floor(x/k))*4,t=(y*W+x)*4;out[t]=img.data[f];out[t+1]=img.data[f+1];out[t+2]=img.data[f+2];out[t+3]=img.data[f+3];}}
 return {width:W,height:H,data:out};
}
/** @param packed internal pack result (packAtlas) @returns {root, files:[{name,bytes}], notes} */
export async function buildBundle(target,model,packed,{base=stemOf(model.name),animScale=1,gifPalette='global',onProgress=()=>{}}={}){
 const t=TARGETS[target];if(!t)throw Error(`Unknown export target ${target}`);
 const pub=publicResult(packed),files=[],notes=[],add=(name,data)=>files.push({name,bytes:typeof data==='string'?enc.encode(data):data});
 const pngCache=new Map();
 const pagePng=async(vi,page)=>{const k=`${vi}:${page}`;if(!pngCache.has(k)){onProgress({phase:'png',variant:vi,page});
  pngCache.set(k,await encodePNG(renderPage(packed.variants[vi].pages[page],packed.variants[vi].sprites,{extrude:packed.settings.extrude,premultiply:packed.settings.premultiply})));}return pngCache.get(k);};
 const withPixels=vi=>({...pub.variants[vi],sprites:packed.variants[vi].sprites});
 if(t.anim){
  if(t.anim==='webm')throw Error('WebM is encoded in the page (WebCodecs); use buildWebM from webm.js.');
  const v=withPixels(0);
  for(const a of animationFrames(model,v,{scale:animScale})){
   const name=`${base}_${stemOf(a.name)}`;
   const out=t.anim==='gif'?encodeGIF(a.frames,{palette:gifPalette,loop:a.loop?0:a.repeat>1?a.repeat-1:null}):await encodeAPNG(a.frames,{loop:a.loop?0:Math.max(1,a.repeat)});
   add(`${name}.${t.anim==='gif'?'gif':'png'}`,out.bytes);notes.push(...out.notes.map(n=>`${a.name}: ${n}`));
  }
  return {root:`${base}_${target}`,files,notes};
 }
 if(t.aseprite){
  // One Aseprite frame per sequence entry (tags are from..to runs), every frame on one
  // pivot-aligned canvas so nothing jumps when Aseprite plays it.
  const v=withPixels(0),keys=frameKeys(model),rows=frameRows(model,v,{keys}),byId=new Map(rows.map(r=>[r.id,r]));
  const {seq}=asepriteSequence(model),cell=pivotCell(rows);
  const occurrences=new Map(),frames=[],images=new Map();
  seq.forEach((id,i)=>{const r=byId.get(id),n=(occurrences.get(id)||0)+1;occurrences.set(id,n);const nid=n===1?id:`${id}#${n}`;
   const o=cell.offset(r);
   frames.push({id:nid,canvasWidth:cell.w,canvasHeight:cell.h,duration:r.durationMs,pivotX:cell.originX/cell.w,pivotY:cell.originY/cell.h,
    boxes:(r.frame.boxes||[]).map(b=>b.shape==='rect'?{...b,x:b.x+o.x,y:b.y+o.y}:b),metadata:{}});
   const img=compose({width:cell.w,height:cell.h,items:[{id,...o}]},v.sprites);images.set(nid,{width:img.width,height:img.height,rgba:img.data});});
  // animations map onto the sequence entries that asepriteSequence laid out for them
  const {tags}=asepriteSequence(model);
  const animations=tags.map(({anim:a,from,to})=>({...a,frameIds:frames.slice(from,to+1).map(f=>f.id)}));
  const {doc,skipped}=documentFromSpriteProject({frames,animations},images);
  for(const s of skipped)notes.push(`.aseprite: ${s.animation||s.frame}: ${s.reason}`);
  add(`${base}.aseprite`,writeAseprite(doc));
  return {root:`${base}_${target}`,files,notes};
 }
 const variants=t.frames?[0]:pub.variants.map((_,i)=>i);
 for(const vi of variants){
  const v=pub.variants[vi];
  const out=t.build(model,v,{base});
  for(const f of out.files)add(f.name,f.text??f.bytes);
  for(const n of out.notes||[])if(!notes.includes(n))notes.push(n);
  for(const name of out.images||[]){const page=pageIndex(name,out.images);add(name,await pagePng(vi,page));}
  for(const job of out.composes||[]){onProgress({phase:'frames',name:job.name});add(job.name,await encodePNG(compose(job,packed.variants[vi].sprites)));}
 }
 if(t.frames&&pub.variants.length>1)notes.push(`${t.label} uses the first scale variant only (@${pub.variants[0].scale}x).`);
 const root=t.root==='defold'?defoldFolder(base):`${base}_${target}`;
 // dedupe names (README written per variant)
 const seen=new Map();for(const f of files)seen.set(f.name,f);
 return {root,files:[...seen.values()],notes};
}
const pageIndex=(name,list)=>list.indexOf(name);
