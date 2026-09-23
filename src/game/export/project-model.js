/** The Studio project document (format 2, docs/STUDIO-SPRITE.md) → what the packer and the
 * exporters read. Pure.
 *
 * A frame's pixels are the composite of its cels (own cel per layer, else the layer's shared '*'
 * cel) cut to `trimmedRect || sourceRect` — exactly src/studio/sprite/frame-image.js. Frames that
 * draw the same cels (every frame of a sprite sheet) share ONE composited source, so a 4096² sheet
 * is composited once, not once per frame. `sources[]` says what to composite; the pack worker does
 * it with composeCanvas and the exact PNG decoder.
 *
 * An asset with no frames is one whole-canvas frame (a loose PNG). When the project has no tags at
 * all, one IMPLICIT animation is made so engines that need one (Godot SpriteFrames, Unity clips)
 * get something to play; `implicitAnimation` is set and the UI shows its name, frame count and fps
 * before export — never silently. This is the one place that knows the document shape. */
import {frameDraws} from '../../studio/sprite/frame-image.js';
const stem=s=>String(s||'frame').replace(/\.[^.]+$/,'');
const WHOLE='__whole__';
/** Common name of a run of frames: "run_0".."run_5" → "run"; "attack (1)".."attack (10)" → "attack". */
export function commonName(names){
 if(!names.length)return 'default';
 let p=names[0];for(const n of names)while(p&&!n.startsWith(p))p=p.slice(0,-1);
 p=p.replace(/[\s_\-.(]*\d*$/,'').replace(/[\s_\-.(]+$/,'');
 return p||'default';
}
/** Key of what a frame's moment composites from: identical keys → one shared source image. */
export function sourceKey(asset,frameId){
 const draws=frameDraws(asset,frameId);
 return `${asset.id}|${asset.width}x${asset.height}|`+draws.map(d=>`${d.cel.blob}@${d.cel.x},${d.cel.y}*${d.opacity}/${d.blend}`).join(';');
}
export function modelFromDoc(doc,{assetIds=null,fps=12}={}){
 const assets=(doc.assets||[]).filter(a=>a.kind==='image'&&(!assetIds||assetIds.includes(a.id)));
 const frames=[],packFrames=[],animations=[],sources=new Map(),blobs=new Set();
 const source=(a,frameId)=>{const key=sourceKey(a,frameId);if(!sources.has(key))sources.set(key,{key,assetId:a.id,frameId});
  for(const d of frameDraws(a,frameId))blobs.add(d.cel.blob);return key;};
 for(const a of assets){
  if(a.frames?.length){
   for(const f of a.frames){
    const inner=f.trimmedRect||f.sourceRect,src=source(a,f.id);
    frames.push({id:f.id,name:f.name||stem(a.name),assetId:a.id,canvasW:f.canvasWidth,canvasH:f.canvasHeight,pivotX:f.pivotX,pivotY:f.pivotY,
     duration:f.duration,tag:f.tag||'',boxes:f.boxes||[],collision:f.collision||[]});
    packFrames.push({id:f.id,name:f.name,src,rect:{...inner},canvasW:f.canvasWidth,canvasH:f.canvasHeight,offX:f.offsetX||0,offY:f.offsetY||0,pivotX:f.pivotX,pivotY:f.pivotY});
   }
   for(const t of a.tags||[])if(t.frameIds.length){
    const repeat=Number.isInteger(t.repeat)?t.repeat:(t.loop===false?1:0);
    animations.push({id:t.id,name:t.name,frameIds:[...t.frameIds],fps:t.fps,direction:t.direction||'forward',loop:repeat===0,repeat,color:t.color});
   }
  }else{
   const id=`${a.id}:image`,src=source(a,WHOLE);
   frames.push({id,name:stem(a.name),assetId:a.id,canvasW:a.width,canvasH:a.height,pivotX:.5,pivotY:1,duration:null,tag:'',boxes:[],collision:[]});
   packFrames.push({id,name:stem(a.name),src,rect:{x:0,y:0,w:a.width,h:a.height},canvasW:a.width,canvasH:a.height,offX:0,offY:0,pivotX:.5,pivotY:1});
  }
 }
 // Animation names must be unique across assets (engines key animations by name).
 const taken=new Set();for(const an of animations){let n=an.name,k=2;while(taken.has(n))n=`${an.name}_${k++}`;an.name=n;taken.add(n);}
 let implicitAnimation=null;
 if(!animations.length&&frames.length){
  const name=commonName(frames.map(f=>f.name));
  implicitAnimation={name,frames:frames.length,fps};
  animations.push({id:'implicit',name,frameIds:frames.map(f=>f.id),fps,direction:'forward',loop:true,repeat:0,implicit:true});
 }
 return {model:{name:doc.name||'atlas',frames,animations,implicitAnimation},packFrames,sources:[...sources.values()],blobs:[...blobs]};
}
