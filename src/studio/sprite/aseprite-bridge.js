/** .aseprite ⇄ Studio sprite asset. Pure (RGBA arrays in memory, no PNG, no DOM).
 *
 * In: `asepriteContent(doc)` keeps the layers — every leaf image/tilemap layer becomes a Studio
 * layer (visibility, opacity, blend mode), every cel a cel at its own position. It then proves the
 * layered result is exactly what Aseprite renders (src/game/aseprite.js renderFrame, verified
 * pixel-exact against real Aseprite on 231 files) by composing every frame with the Studio's own
 * compositor. If any pixel differs — compose-groups with group opacity, cel z-index, indexed
 * palettes with alpha, grayscale blend quirks — the frames are imported flattened instead, and the
 * reason is recorded as a decision. Slices become pivots / boxes / 9-slice data; every guess made
 * on the way (which slice is the pivot, what kind of box a slice is) is a decision with
 * alternatives.
 *
 * Out: `asepriteFromAsset(asset, rgbaOf)` writes layers × frames back (documentFromImages), tags
 * as Aseprite ranges (consecutive frames only; anything else is reported, never bent), durations,
 * pivots as a "pivot" slice (or the imported pivot slice's name), rect boxes as slices named as
 * imported, 9-slices restored. */
import {renderFrame,celImage,toSpriteProject,documentFromImages,BLEND_MODES} from '../../game/aseprite.js';
import {mul8} from '../../game/aseprite-blend.js';
import {drawRGBA,blendIndex,celAt} from './frame-image.js';
const sliceName=s=>String(s||'slice').slice(0,120);
/** Documents are JSON (autosave, .nerulio): 64-bit user-data values become decimal strings, which
 * the writer turns back into the same typed int64/uint64 (BigInt(string) is exact). */
export const jsonSafe=v=>typeof v==='bigint'?v.toString():v instanceof Uint8Array?[...v]:Array.isArray(v)?v.map(jsonSafe):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,jsonSafe(x)])):v;
export const boxIdForSlice=name=>'s_'+String(name).replace(/[^\w-]+/g,'_').slice(0,40);
/** @returns {width,height,layers:[{name,visible,opacity,blend,index}], frames:[{duration,cels:[{layer,x,y,width,height,rgba,opacity}]}],
 *   flattened:null|{reason,frame,pixels}, frameMeta:[{pivotX,pivotY,boxes,metadata}], tags:[…], slices:[studio slices], decisions, warnings} */
export function asepriteContent(doc,{verify=true}={}){
 const W=doc.width,H=doc.height,kids=new Map();
 for(const l of doc.layers){const p=l.parent??-1;if(!kids.has(p))kids.set(p,[]);kids.get(p).push(l.index);}
 const visibleUp=i=>{for(let l=doc.layers[i];l;l=l.parent>=0?doc.layers[l.parent]:null)if(!l.visible)return false;return true;};
 const path=i=>{const names=[];for(let l=doc.layers[i];l;l=l.parent>=0?doc.layers[l.parent]:null)names.unshift(l.name);return names.join('/');};
 const order=[];const walk=i=>{const l=doc.layers[i];if(l.type==='group'){for(const c of kids.get(i)||[])walk(c);return;}if(l.type==='unknown'||l.reference)return;order.push(i);};
 for(const i of kids.get(-1)||[])walk(i);
 const layers=order.map(i=>{const l=doc.layers[i];return {index:i,name:path(i).slice(0,120)||`Layer ${i+1}`,visible:visibleUp(i),opacity:l.opacity??255,blend:BLEND_MODES[l.blendMode]||'normal'};});
 const frames=doc.frames.map((fr,f)=>({duration:fr.duration,cels:layers.map((L,li)=>{const c=fr.cels[L.index];if(!c||(c.type==='tilemap'&&doc.layers[L.index].type!=='tilemap'))return null;
  const img=celImage(doc,c);if(!img.width||!img.height)return null;return {layer:li,x:c.x,y:c.y,width:img.width,height:img.height,rgba:img.rgba,opacity:c.opacity??255,zIndex:c.zIndex||0};}).filter(Boolean)}));
 let flattened=null;
 if(!layers.length)flattened={reason:'no image layers'};
 else if(frames.some(fr=>fr.cels.some(c=>c.zIndex)))flattened={reason:'cel z-index reorders layers per frame'};
 if(!flattened&&verify){
  for(let f=0;f<frames.length&&!flattened;f++){
   const want=renderFrame(doc,f).rgba,got=new Uint8Array(W*H*4);
   for(const c of frames[f].cels){const L=layers[c.layer];if(!L.visible)continue;const op=mul8(c.opacity,L.opacity);if(op)drawRGBA(got,W,H,c.rgba,c.width,c.height,c.x,c.y,op,blendIndex(L.blend));}
   let diff=0;for(let i=0;i<want.length;i+=4){if(want[i+3]===0&&got[i+3]===0)continue;if(want[i]!==got[i]||want[i+1]!==got[i+1]||want[i+2]!==got[i+2]||want[i+3]!==got[i+3])diff++;}
   if(diff)flattened={reason:'layered composition differs from Aseprite',frame:f,pixels:diff};
  }
 }
 const out={width:W,height:H,layers,frames,flattened,warnings:[...(doc.warnings||[])]};
 if(flattened){
  out.layers=[{index:-1,name:'Flattened',visible:true,opacity:255,blend:'normal'}];
  out.frames=doc.frames.map((fr,f)=>({duration:fr.duration,cels:[{layer:0,x:0,y:0,width:W,height:H,rgba:renderFrame(doc,f).rgba,opacity:255}]}));
 }
 // pivots / boxes / 9-slices via the verified model mapping, then re-keyed to Studio ids
 const project=toSpriteProject(doc,{name:'frame'}),mapping=project.metadata.aseprite.mapping||[];
 const boxSlices=new Map(mapping.filter(m=>m.as==='box').map(m=>[m.slice,m]));
 out.frameMeta=project.frames.map((pf,i)=>{
  // toSpriteProject lists boxes in doc.slices order (one per box slice with a key on this frame)
  const names=doc.slices.filter(s=>boxSlices.has(s.name)&&keyAt(s,i)).map(s=>s.name);
  return {pivotX:pf.pivotX,pivotY:pf.pivotY,boxes:pf.boxes.map((b,k)=>({...b,id:boxIdForSlice(names[k]??`box${k}`)})),metadata:{aseprite:{frame:i,nineSlices:pf.metadata.aseprite.nineSlices}}};
 });
 out.tags=doc.tags.map(t=>{
  const from=Math.min(t.from,doc.frames.length-1),to=Math.min(Math.max(t.to,from),doc.frames.length-1);
  return {name:t.name,from,to,reverse:t.direction==='pingpong_reverse',direction:t.direction==='pingpong_reverse'?'pingpong':t.direction,repeat:t.repeat|0,color:t.color||null,
   metadata:{aseprite:jsonSafe({direction:t.direction,repeat:t.repeat,color:t.color,userData:t.userData||null,from:t.from,to:t.to})}};
 });
 out.slices=doc.slices.filter(s=>s.keys.length).map(s=>({name:sliceName(s.name),color:s.userData?.color||'#0000ffff',data:s.userData?.text||'',
  keys:s.keys.map(k=>({frame:k.frame,bounds:{x:k.x,y:k.y,w:Math.max(1,k.w),h:Math.max(1,k.h)},...(k.center?{center:{x:k.center.x,y:k.center.y,w:Math.max(1,k.center.w),h:Math.max(1,k.center.h)}}:{}),...(k.pivot?{pivot:{x:k.pivot.x,y:k.pivot.y}}:{})}))}));
 out.sliceBoxes=Object.fromEntries([...boxSlices.keys()].map(n=>[boxIdForSlice(n),n]));
 out.pivotSlice=mapping.find(m=>m.as==='pivot')?.slice??null;
 out.decisions=mapping.map(m=>m.as==='pivot'?{id:'slice:'+m.slice,kind:'pivot-slice',label:m.slice,chosen:'pivot',confidence:m.confidence,reasons:[m.basis],alternatives:['box','ignore']}
  :m.as==='box'?{id:'slice:'+m.slice,kind:'box-slice',label:m.slice,chosen:m.type,confidence:m.confidence,reasons:[m.basis],alternatives:['hit','hurt','interact','custom','ignore'].filter(x=>x!==m.type)}
  :{id:'slice:'+m.slice,kind:'nine-slice',label:m.slice,chosen:'nineSlice',confidence:'high',reasons:[m.basis],alternatives:[]});
 if(flattened)out.decisions.unshift({id:'layers',kind:'layers',label:'layers',chosen:'flattened',confidence:'high',reasons:[flattened.reason+(flattened.pixels?` (frame ${flattened.frame}: ${flattened.pixels} px)`:'')],alternatives:[]});
 else out.decisions.unshift({id:'layers',kind:'layers',label:'layers',chosen:'layered',confidence:'high',reasons:[verify?`${layers.length} layers compose to Aseprite's own render on all ${frames.length} frames`:'not verified'],alternatives:[]});
 return out;
}
function keyAt(s,f){let k=null;for(const key of s.keys)if(key.frame<=f&&(!k||key.frame>=k.frame))k=key;return k&&k.w>0&&k.h>0?k:null;}
// ------------------------------------------------------------------ back out
/** Studio asset → {doc (for writeAseprite), skipped[]}. `rgbaOf(blob)` → {width,height,data}.
 * Frames keep timeline order and duration; each Studio layer becomes an Aseprite layer whose cel
 * is the layer's own pixels for that frame, cut to the frame's region and placed on its canvas. */
export function asepriteFromAsset(asset,rgbaOf,{layerNames=true}={}){
 const frames=asset.frames,skipped=[];
 if(!frames.length)throw Error('The sprite has no frames');
 const W=Math.max(...frames.map(f=>f.canvasWidth)),H=Math.max(...frames.map(f=>f.canvasHeight));
 const layers=asset.layers.map(l=>({name:layerNames?l.name:'Layer',visible:l.visible,opacity:l.opacity,blendMode:blendIndex(l.blend)}));
 const docFrames=frames.map(f=>{
  const images={},cels={},inner=f.trimmedRect||f.sourceRect;
  asset.layers.forEach((l,li)=>{
   const cel=celAt(asset,l.id,f.id);if(!cel)return;
   // the layer's own opacity lives on the Aseprite layer; the cel keeps its own opacity
   const src=rgbaOf(cel.blob);if(!src)throw Error(`Image ${String(cel.blob).slice(0,8)} is not loaded`);
   const full=new Uint8Array(W*H*4),layerOnly=rawLayer(cel,src,inner),n=Math.min(inner.w,W-f.offsetX);
   for(let y=0;y<inner.h&&n>0;y++){const ty=y+f.offsetY;if(ty>=H)break;full.set(layerOnly.subarray(y*inner.w*4,(y*inner.w+n)*4),(ty*W+f.offsetX)*4);}
   images[li]=full;cels[li]={opacity:cel.opacity};
  });
  return {duration:Math.max(1,Math.round(f.duration??100)),images,cels};
 });
 const index=new Map(frames.map((f,i)=>[f.id,i]));
 const tags=[];
 for(const t of asset.tags){
  const idx=t.frameIds.map(id=>index.get(id));
  if(!idx.length||idx.some(i=>i==null)){skipped.push({tag:t.name,reason:'unknown or no frames'});continue;}
  const up=idx.every((v,k)=>k===0||v===idx[k-1]+1),down=idx.every((v,k)=>k===0||v===idx[k-1]-1);
  if(!up&&!down){skipped.push({tag:t.name,reason:'frames are not consecutive in the timeline'});continue;}
  let direction=t.direction;
  if(down&&idx.length>1)direction=t.direction==='forward'?'reverse':t.direction==='reverse'?'forward':'pingpong_reverse';
  const orig=t.metadata?.aseprite;
  if(orig&&idx.length===1&&orig.direction&&(orig.direction==='pingpong_reverse'?'pingpong':orig.direction)===t.direction)direction=orig.direction;
  tags.push({name:t.name,from:Math.min(...idx),to:Math.max(...idx),direction,repeat:t.repeat|0,color:hexColor(t.color),userData:orig?.userData??null});
 }
 // slices: pivots, rect boxes (named as imported), 9-slices, and imported slices nothing replaced
 const slices=[],keyed=(name,valueAt,extra={})=>{
  const keys=[];let last='';
  frames.forEach((f,i)=>{const v=valueAt(f);const s=JSON.stringify(v);if(s!==last){keys.push(v?{frame:i,...v}:{frame:i,x:0,y:0,w:0,h:0});last=s;}});
  if(keys.some(k=>k.w>0))slices.push({name,keys,userData:extra.userData??null});
 };
 const imported=new Map((asset.slices||[]).map(s=>[s.name,s]));
 const pivotName=asset.import?.pivotSlice||'pivot';
 const pivotOriginal=imported.get(pivotName);
 const defaultPivot=frames.every(f=>f.pivotX===.5&&f.pivotY===1)&&!pivotOriginal;
 if(!defaultPivot)keyed(pivotName,f=>{
  const px={x:Math.round(f.pivotX*f.canvasWidth),y:Math.round(f.pivotY*f.canvasHeight)};
  // keep the imported slice's own bounds when the pivot did not move
  const k=pivotOriginal&&keyOf(pivotOriginal,index.get(f.id));
  if(k&&k.pivot&&k.bounds.x+k.pivot.x===px.x&&k.bounds.y+k.pivot.y===px.y)return {...k.bounds,pivot:k.pivot};
  return {x:0,y:0,w:f.canvasWidth,h:f.canvasHeight,pivot:px};
 },{userData:sliceUD(pivotOriginal)});
 const names=asset.import?.sliceBoxes||{},slots=new Map();
 for(const f of frames){const count={};for(const b of f.boxes){if(b.shape!=='rect'){skipped.push({frame:f.name,box:b.id,reason:`${b.shape} boxes have no Aseprite slice form`});continue;}
  const n=names[b.id];if(n){slots.set(n,{id:b.id});continue;}const k=count[b.type]=(count[b.type]||0)+1;const name=`${b.type}${k>1?k:''}`;if(!slots.has(name))slots.set(name,{type:b.type,n:k});}}
 for(const [name,slot]of slots)keyed(name,f=>{const b=slot.id?f.boxes.find(x=>x.id===slot.id):f.boxes.filter(x=>x.shape==='rect'&&x.type===slot.type&&!names[x.id])[slot.n-1];return b?{x:Math.round(b.x),y:Math.round(b.y),w:Math.max(1,Math.round(b.w)),h:Math.max(1,Math.round(b.h))}:null;},{userData:sliceUD(imported.get(name))});
 const nineNames=new Set(frames.flatMap(f=>(f.metadata?.aseprite?.nineSlices||[]).map(n=>n.name)));
 for(const name of nineNames)keyed(name,f=>{const n=(f.metadata?.aseprite?.nineSlices||[]).find(x=>x.name===name);return n?{...n.bounds,center:n.center}:null;},{userData:sliceUD(imported.get(name))});
 const doc=documentFromImages({width:W,height:H,layers,frames:docFrames,tags,slices});
 return {doc,skipped};
}
function rawLayer(cel,src,inner){
 // the cel's pixels as they are (no opacity applied), cut to the frame's inner rect
 const out=new Uint8Array(inner.w*inner.h*4);
 drawRGBA(out,inner.w,inner.h,src.data,src.width,src.height,cel.x-inner.x,cel.y-inner.y,255,0);
 return out;
}
const keyOf=(s,f)=>{let k=null;for(const key of s.keys)if(key.frame<=f&&(!k||key.frame>=k.frame))k=key;return k;};
const sliceUD=s=>s?{text:s.data||null,color:s.color||null,properties:null}:null;
function hexColor(c){if(!c)return null;const m=/^#?([0-9a-f]{6})/i.exec(String(c));return m?'#'+m[1]:null;}
