/** Atlas data files that come with a sheet: Aseprite JSON (hash or array, with frameTags and
 * durations), TexturePacker JSON (hash or array, trimmed frames) and Starling/Sparrow XML.
 * Pure: text in, model frames out. Frame names are kept; animations come from Aseprite's
 * frameTags when present, otherwise from the names (walk_01, walk_02 … → "walk"). */
import {frame as makeFrame} from '../../game/model.js';
import {uid} from '../core/project.js';
import {groupFrameFiles} from './import-plan.js';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
export function parseAtlas(text,fileName=''){
 const s=String(text).trim();
 if(s.startsWith('{')){
  const j=JSON.parse(s);if(!j.frames)throw Error('No "frames" in this JSON');
  const list=Array.isArray(j.frames)?j.frames.map(f=>({...f,name:f.filename??f.name})):Object.entries(j.frames).map(([name,f])=>({...f,name}));
  const aseprite=/aseprite/i.test(j.meta?.app||'')||list.some(f=>f.duration!=null);
  return {format:aseprite?'aseprite-json':'texturepacker-json',image:j.meta?.image?String(j.meta.image).replace(/^.*[\\/]/,''):'',size:j.meta?.size||null,
   frames:list.map(f=>({name:String(f.name),x:num(f.frame?.x),y:num(f.frame?.y),w:num(f.frame?.w),h:num(f.frame?.h),rotated:!!f.rotated,trimmed:!!f.trimmed,
    sss:f.spriteSourceSize||null,ss:f.sourceSize||null,duration:f.duration!=null?num(f.duration):null,pivot:f.pivot||null})),
   tags:(j.meta?.frameTags||[]).map(t=>({name:String(t.name),from:num(t.from),to:num(t.to),direction:String(t.direction||'forward'),repeat:t.repeat!=null?num(t.repeat):0}))};
 }
 if(s.startsWith('<')){
  const image=/imagePath\s*=\s*"([^"]*)"/i.exec(s)?.[1]||'',frames=[];
  for(const m of s.matchAll(/<SubTexture\b([^>]*)\/?>/gi)){
   const a={};for(const x of m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g))a[x[1]]=x[2];
   const fw=a.frameWidth!=null?num(a.frameWidth):null,fh=a.frameHeight!=null?num(a.frameHeight):null;
   frames.push({name:a.name||`frame${frames.length}`,x:num(a.x),y:num(a.y),w:num(a.width),h:num(a.height),rotated:a.rotated==='true',trimmed:fw!=null,
    sss:fw!=null?{x:-num(a.frameX),y:-num(a.frameY),w:num(a.width),h:num(a.height)}:null,ss:fw!=null?{w:fw,h:fh}:null,duration:null,pivot:a.pivotX!=null?{x:num(a.pivotX),y:num(a.pivotY)}:null});
  }
  if(!frames.length)throw Error('No SubTexture elements in this XML');
  return {format:'starling-xml',image:image.replace(/^.*[\\/]/,''),size:null,frames,tags:[]};
 }
 throw Error(`${fileName||'This file'} is not atlas data`);
}
/** Model frames (regions of the sheet) + tag specs + decisions. */
export function atlasFrames(atlas,{width,height}){
 const decisions=[],frames=[];let rotated=0,outside=0;
 for(const f of atlas.frames){
  const w=f.rotated?f.h:f.w,h=f.rotated?f.w:f.h;
  if(f.rotated)rotated++;
  if(f.x<0||f.y<0||f.x+w>width||f.y+h>height||w<1||h<1){outside++;continue;}
  const trimmed=f.sss&&f.ss&&(f.sss.x||f.sss.y||f.ss.w!==w||f.ss.h!==h)&&!f.rotated;
  const cw=trimmed?Math.max(w+f.sss.x,f.ss.w):w,ch=trimmed?Math.max(h+f.sss.y,f.ss.h):h;
  frames.push(makeFrame({id:uid('f')+frames.length.toString(36),name:f.name.replace(/\.(png|gif|webp|ase|aseprite)$/i,''),sourceRect:{x:f.x,y:f.y,w,h},
   canvasWidth:cw,canvasHeight:ch,offsetX:trimmed?Math.max(0,f.sss.x):0,offsetY:trimmed?Math.max(0,f.sss.y):0,duration:f.duration??100,
   pivotX:f.pivot&&Number.isFinite(f.pivot.x)?f.pivot.x:.5,pivotY:f.pivot&&Number.isFinite(f.pivot.y)?f.pivot.y:1,metadata:{atlas:{name:f.name,rotated:f.rotated||undefined}}}));
 }
 let tags=[];
 if(atlas.tags.length){
  tags=atlas.tags.map(t=>({name:t.name,from:Math.min(t.from,frames.length-1),to:Math.min(t.to,frames.length-1),reverse:t.direction==='pingpong_reverse',direction:t.direction==='pingpong_reverse'?'pingpong':['forward','reverse','pingpong'].includes(t.direction)?t.direction:'forward',repeat:t.repeat|0}));
  decisions.push({id:'animations',label:'animations',chosen:'tags',confidence:'high',reasons:[`${tags.length} frame tags in ${atlas.format}`],alternatives:[]});
 }else{
  const g=groupFrameFiles(frames.map(f=>f.name));
  // frames follow the grouping order so each animation is one run on the timeline
  const order=g.order.map(i=>frames[i]);frames.splice(0,frames.length,...order);
  const pos=new Map(g.order.map((orig,k)=>[orig,k]));
  tags=g.groups.map(gr=>({name:gr.name,positions:gr.items.map(i=>pos.get(i))}));
  decisions.push({...g.decision});
 }
 decisions.unshift({id:'frames',label:'frames',chosen:String(frames.length),confidence:'high',reasons:[`${frames.length} named frames from ${atlas.format}`,...(outside?[`${outside} frames lie outside the image and were left out`]:[]),
  ...(atlas.frames.some(f=>f.duration!=null)?['per-frame durations from the file']:['the file has no timing; 100 ms per frame'])],alternatives:[]});
 return {frames,tags,decisions,rotated};
}
