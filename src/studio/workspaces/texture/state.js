/** Texture workspace document state (pure). Everything lives in doc.settings.texture, so the shared
 * project format needs no change: settings are kept as JSON by normalizeProject, autosaved, undone
 * and written into .nerulio files.
 *
 *   settings.texture = {
 *     assets: { [assetId]: {
 *       params,            src/game/normals/pipeline.js parameters (kind, bevel, luma, normal, pixel, ao, heightMap)
 *       strokes: [ … ],    height-brush strokes {mode, r, s, hard, pts:[x,y,…], clip:{x,y,w,h}, target?}
 *                          in working-image pixels (the sheet, or the frame strip)
 *       scene: {ambient, lights:[{id,x,y,z,color,energy,radius,falloff,enabled}], rim, specular}
 *                          lights in FRAME-LOCAL pixels, so every frame of an animation is lit alike
 *       normalFrom: assetId | null      use an imported normal map instead of generating one
 *       normalDeclared: 'opengl'|'directx'|null   what the user confirmed an imported map is
 *     } },
 *     roles: { [assetId]: role }        PBR role overrides ('albedo','normal','roughness',…)
 *   } */
import {normalizeParams} from '../../../game/normals/pipeline.js';
import {defaultScene,normLight} from '../../../game/normals/lighting.js';
export const EMPTY=Object.freeze({assets:{},roles:{}});
export const texState=doc=>doc?.settings?.texture||EMPTY;
export function withTexState(doc,fn){
 const cur=texState(doc),next=fn(cur);
 return next===cur?doc:{...doc,settings:{...(doc.settings||{}),texture:next}};
}
export const MAX_STROKES=4000,MAX_LIGHTS=8;
/** The entry of one asset, normalised (a missing or old entry gets defaults; nothing is trusted). */
export function entryOf(state,assetId,{w=64,h=64}={}){
 const e=state.assets?.[assetId]||{};
 const scene=e.scene&&typeof e.scene==='object'?e.scene:defaultScene(w,h);
 return {
  params:normalizeParams(e.params||{}),
  strokes:Array.isArray(e.strokes)?e.strokes.filter(validStroke).slice(-MAX_STROKES):[],
  scene:{ambient:/^#[0-9a-f]{6}$/i.test(scene.ambient||'')?scene.ambient:'#3a3f4d',lights:(scene.lights||[]).slice(0,MAX_LIGHTS).map(normLight),
   rim:{strength:clamp(+scene.rim?.strength||0,0,4),color:/^#[0-9a-f]{6}$/i.test(scene.rim?.color||'')?scene.rim.color:'#9fd0ff',power:clamp(+scene.rim?.power||2,.5,8)},
   specular:{strength:clamp(+scene.specular?.strength||0,0,4),shininess:clamp(Number.isFinite(+scene.specular?.shininess)?+scene.specular.shininess:.5,0,1)}},
  normalFrom:e.normalFrom?String(e.normalFrom):null,
  normalDeclared:['opengl','directx'].includes(e.normalDeclared)?e.normalDeclared:null,
  has:!!state.assets?.[assetId]
 };
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function validStroke(s){
 return s&&typeof s==='object'&&['raise','lower','smooth','flatten','erase'].includes(s.mode)&&Array.isArray(s.pts)&&s.pts.length>=2&&s.pts.length<=20000&&s.pts.every(Number.isFinite)&&Number.isFinite(+s.r)&&+s.r>0;
}
/** Replaces one asset's entry through `fn(entry) → entry` (the entry is created with defaults). */
export function updateEntry(state,assetId,fn,size){
 const cur=entryOf(state,assetId,size),{has,...plain}=cur,next=fn(plain);
 if(has&&JSON.stringify(next)===JSON.stringify(plain))return state;
 return {...state,assets:{...(state.assets||{}),[assetId]:next}};
}
export const setParams=(state,id,patch,size)=>updateEntry(state,id,e=>({...e,params:normalizeParams(deepMerge(e.params,patch))}),size);
export const addStroke=(state,id,stroke,size)=>updateEntry(state,id,e=>({...e,strokes:[...e.strokes,stroke].slice(-MAX_STROKES)}),size);
export const clearStrokes=(state,id,size)=>updateEntry(state,id,e=>({...e,strokes:[]}),size);
export const setScene=(state,id,patch,size)=>updateEntry(state,id,e=>({...e,scene:{...e.scene,...patch}}),size);
export function setLight(state,id,lightId,patch,size){
 return updateEntry(state,id,e=>({...e,scene:{...e.scene,lights:e.scene.lights.map(l=>l.id===lightId?normLight({...l,...patch}):l)}}),size);
}
export function addLight(state,id,light,size){
 return updateEntry(state,id,e=>{if(e.scene.lights.length>=MAX_LIGHTS)return e;const used=new Set(e.scene.lights.map(l=>l.id));let n=e.scene.lights.length+1;while(used.has('l'+n))n++;return {...e,scene:{...e.scene,lights:[...e.scene.lights,normLight({...light,id:'l'+n})]}};},size);
}
export const removeLight=(state,id,lightId,size)=>updateEntry(state,id,e=>({...e,scene:{...e.scene,lights:e.scene.lights.filter(l=>l.id!==lightId)}}),size);
export const setNormalFrom=(state,id,from,size)=>updateEntry(state,id,e=>({...e,normalFrom:from||null}),size);
export const setDeclared=(state,id,conv,size)=>updateEntry(state,id,e=>({...e,normalDeclared:conv||null}),size);
export function setRole(state,assetId,role){const roles={...(state.roles||{})};if(role)roles[assetId]=role;else delete roles[assetId];return {...state,roles};}
/** Entries whose asset no longer exists are dropped (after an asset is removed). */
export function prune(state,assetIds){
 const keep=new Set(assetIds);let changed=false;const assets={},roles={};
 for(const [k,v] of Object.entries(state.assets||{})){if(keep.has(k))assets[k]=v;else changed=true;}
 for(const [k,v] of Object.entries(state.roles||{})){if(keep.has(k))roles[k]=v;else changed=true;}
 return changed?{...state,assets,roles}:state;
}
export function deepMerge(a,b){
 if(!b||typeof b!=='object'||Array.isArray(b))return b===undefined?a:b;
 const out={...(a&&typeof a==='object'?a:{})};
 for(const [k,v] of Object.entries(b))out[k]=v&&typeof v==='object'&&!Array.isArray(v)?deepMerge(out[k],v):v;
 return out;
}
/** The working picture an asset is processed as. Pure: from the document alone.
 *   'sheet'  — no frames, or frames that are regions of the layers' shared pictures (a sprite
 *              sheet): the picture is the composited canvas, regions are the frames' rects.
 *   'strip'  — frames with pixels of their own (an .aseprite, a GIF): each frame is composed on its
 *              own canvas and they are laid out in a grid; regions are the grid cells. */
export function workingLayout(asset){
 const frames=asset.frames||[];
 if(!frames.length)return {mode:'sheet',width:asset.width,height:asset.height,regions:[],frameRects:[]};
 const own=asset.cels.some(c=>c.frameId!=='*');
 const plain=frames.every(f=>!f.trimmedRect&&f.offsetX===0&&f.offsetY===0&&f.canvasWidth===f.sourceRect.w&&f.canvasHeight===f.sourceRect.h);
 if(!own&&plain){const rects=frames.map(f=>({...f.sourceRect}));return {mode:'sheet',width:asset.width,height:asset.height,regions:rects,frameRects:rects};}
 const cw=Math.max(...frames.map(f=>f.canvasWidth)),ch=Math.max(...frames.map(f=>f.canvasHeight)),cols=Math.max(1,Math.min(frames.length,Math.ceil(Math.sqrt(frames.length*ch/cw)))),rows=Math.ceil(frames.length/cols);
 const rects=frames.map((f,i)=>({x:(i%cols)*cw,y:Math.floor(i/cols)*ch,w:f.canvasWidth,h:f.canvasHeight}));
 return {mode:'strip',width:cols*cw,height:rows*ch,regions:rects,frameRects:rects,cols,cell:{w:cw,h:ch}};
}
