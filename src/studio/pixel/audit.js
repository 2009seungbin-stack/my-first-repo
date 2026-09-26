/** Palette audit across the frames of an animation. Pure: RGBA images in, a report out.
 *
 * For each frame: how many distinct colours it uses, which of them are NOT in the sprite palette
 * ("stray" colours — usually a stray anti-aliased pixel, a pasted reference or a JPEG leftover), how
 * many pixels each stray colour covers and where the first one is, partial-alpha pixels, and whether
 * the frame is over the colour budget. Across the animation: the union of colours and pairs of
 * colours that are almost the same (ΔE in Oklab below `nearDuplicate`), which is how an
 * accidental second black shows up. Nothing is changed; the report feeds "select strays" / "map
 * strays to the palette" actions in the UI. */
import {oklab} from '../../pixel-engine.js';
import {keyOf} from './indexed.js';
const unkey=k=>[k&255,k>>>8&255,k>>>16&255,k>>>24&255];
/** @param frames [{id, name, data:RGBA, width, height}]  @param palette [[r,g,b,a]] (may be empty = no palette)
 * @param o {budget (max colours per frame, 0 = none), nearDuplicate (Oklab distance), ignoreAlpha}
 * @returns {frames:[…], colors, union, over, strayFrames, nearDuplicates:[[a,b,dE]]} */
export function auditFrames(frames,palette=[],{budget=0,nearDuplicate=.012,nearLevels=4,transparentIndex=-1}={}){
 const inPal=new Set(palette.filter((c,i)=>i!==transparentIndex).map(c=>keyOf(c[0],c[1],c[2],c[3]??255))),union=new Map(),out=[];
 for(const f of frames){
  const d=f.data,w=f.width,seen=new Map(),first=new Map();let partial=0,opaque=0;
  for(let p=0,i=0;i<d.length;i+=4,p++){
   const a=d[i+3];if(!a)continue;opaque++;if(a<255)partial++;
   const k=keyOf(d[i],d[i+1],d[i+2],a);seen.set(k,(seen.get(k)||0)+1);if(!first.has(k))first.set(k,p);
  }
  for(const [k,n]of seen)union.set(k,(union.get(k)||0)+n);
  const stray=inPal.size?[...seen].filter(([k])=>!inPal.has(k)).map(([k,n])=>{const p=first.get(k);return {color:unkey(k),count:n,x:p%w,y:Math.floor(p/w)};}).sort((a,b)=>b.count-a.count):[];
  out.push({id:f.id,name:f.name,distinct:seen.size,opaque,partial,stray,strayPixels:stray.reduce((s,x)=>s+x.count,0),over:budget>0?Math.max(0,seen.size-budget):0});
 }
 const keys=[...union.keys()],labs=keys.map(k=>{const c=unkey(k);return oklab(c[0],c[1],c[2]);}),near=[];
 if(keys.length<=512)for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  const e=Math.hypot(labs[i][0]-labs[j][0],labs[i][1]-labs[j][1],labs[i][2]-labs[j][2]),a=unkey(keys[i]),b=unkey(keys[j]);
  // Oklab stretches the darkest shades, so "a few levels apart on every channel" also counts
  if(e<nearDuplicate||Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]),Math.abs(a[3]-b[3]))<=nearLevels)near.push([a,b,+e.toFixed(4)]);
 }
 return {frames:out,union:union.size,colors:keys.map(unkey),over:out.filter(f=>f.over>0).length,strayFrames:out.filter(f=>f.stray.length).length,nearDuplicates:near,budget,paletteSize:inPal.size};
}
/** Mask of the pixels of one frame whose colour is not in the palette (for "select strays"). */
export function strayMask(img,palette,{transparentIndex=-1}={}){
 const inPal=new Set(palette.filter((c,i)=>i!==transparentIndex).map(c=>keyOf(c[0],c[1],c[2],c[3]??255))),d=img.data,m=new Uint8Array(img.width*img.height);let n=0;
 for(let p=0,i=0;i<d.length;i+=4,p++){if(!d[i+3])continue;if(!inPal.has(keyOf(d[i],d[i+1],d[i+2],d[i+3]))){m[p]=1;n++;}}
 return {mask:m,count:n};
}
