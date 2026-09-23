/** The Studio project document → what the packer and the exporters read. Pure.
 *
 * Every image asset contributes its frames (docs/STUDIO.md: `frames[]` are model.js AssetFrames cut
 * from the asset's picture) and its tags (model.js Animations). An asset with no frames is one
 * whole-image frame — a folder of loose frame PNGs is packed as is. This is the one place that
 * knows the document shape; when the Sprite workspace (P1a) adds cel-based frames, only this
 * adapter changes.
 *
 * When the project has no tags at all, one IMPLICIT animation is made so engines that need an
 * animation (Godot SpriteFrames, Unity clips) get something to play; `implicitAnimation` is set,
 * and the UI shows its name, frame count and fps before export — never silently. */
import {primaryBlob} from '../../studio/core/project.js';
const stem=s=>String(s||'frame').replace(/\.[^.]+$/,'');
/** Common name of a run of frames: "run_0".."run_5" → "run"; "attack (1)".."attack (10)" → "attack". */
export function commonName(names){
 if(!names.length)return 'default';
 let p=names[0];for(const n of names)while(p&&!n.startsWith(p))p=p.slice(0,-1);
 p=p.replace(/[\s_\-.(]*\d*$/,'').replace(/[\s_\-.(]+$/,'');
 return p||'default';
}
export function modelFromDoc(doc,{assetIds=null,fps=12}={}){
 const assets=(doc.assets||[]).filter(a=>a.kind==='image'&&(!assetIds||assetIds.includes(a.id)));
 const frames=[],packFrames=[],animations=[],blobs=new Set();
 for(const a of assets){
  const blob=primaryBlob(a);if(!blob)continue;blobs.add(blob);
  if(a.frames?.length){
   for(const f of a.frames){
    const inner=f.trimmedRect||f.sourceRect;
    frames.push({id:f.id,name:f.name||stem(a.name),assetId:a.id,canvasW:f.canvasWidth,canvasH:f.canvasHeight,pivotX:f.pivotX,pivotY:f.pivotY,
     duration:f.duration,tag:f.tag||'',boxes:f.boxes||[],collision:f.collision||[]});
    packFrames.push({id:f.id,name:f.name,src:blob,rect:{...inner},canvasW:f.canvasWidth,canvasH:f.canvasHeight,offX:f.offsetX||0,offY:f.offsetY||0,pivotX:f.pivotX,pivotY:f.pivotY});
   }
   for(const t of a.tags||[])if(t.frameIds.length)animations.push({id:t.id,name:t.name,frameIds:[...t.frameIds],fps:t.fps,direction:t.direction||'forward',loop:t.loop!==false,color:t.color});
  }else{
   const id=`${a.id}:image`,duration=a.timeline?.length===1&&a.timeline[0].duration!==100?a.timeline[0].duration:null;
   frames.push({id,name:stem(a.name),assetId:a.id,canvasW:a.width,canvasH:a.height,pivotX:.5,pivotY:1,duration,tag:'',boxes:[],collision:[]});
   packFrames.push({id,name:stem(a.name),src:blob,rect:{x:0,y:0,w:a.width,h:a.height},canvasW:a.width,canvasH:a.height,offX:0,offY:0,pivotX:.5,pivotY:1});
  }
 }
 // Animation names must be unique across assets (engines key animations by name).
 const taken=new Set();for(const an of animations){let n=an.name,k=2;while(taken.has(n))n=`${an.name}_${k++}`;an.name=n;taken.add(n);}
 let implicitAnimation=null;
 if(!animations.length&&frames.length){
  const name=commonName(frames.map(f=>f.name));
  implicitAnimation={name,frames:frames.length,fps};
  animations.push({id:'implicit',name,frameIds:frames.map(f=>f.id),fps,direction:'forward',loop:true,implicit:true});
 }
 return {model:{name:doc.name||'atlas',frames,animations,implicitAnimation},packFrames,blobs:[...blobs]};
}
