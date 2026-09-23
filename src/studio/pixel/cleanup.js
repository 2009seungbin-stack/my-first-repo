/** The Pixel workspace cleanup pipeline (the upscale / "AI pixel art" fixer). Pure and
 * deterministic: the same frames and options always give the same bytes; nothing leaves the device.
 *
 *   inspect   pixel-check.js inspect(): integer upscale / resampled / already 1× — with confidence
 *   grid      pixel-snap.js findGrid(): ONE scale for the whole animation (profiles of all frames
 *             summed), each frame's own phase; the user can override the scale
 *   snap      one pixel per cell (mode, else Oklab medoid — never a mean)
 *   background  solid border colour made transparent (only when detected, or chosen)
 *   alpha     soft alpha → 0/255
 *   colours   near-identical colours merged (Oklab, frequency first), optional colour budget, or
 *             quantize to a given palette (nearest in Oklab; dithering OFF unless asked; error
 *             diffusion is not offered for animations because it flickers)
 *   fringe    anti-alias pixels between two palette colours snapped to the nearer one (pixel-cleanup.js)
 *   orphans   stray single pixels (off by default: an eye is a legitimate single pixel)
 *   align     frames moved by whole pixels onto the first frame (bounds anchor or best overlap)
 *   outline / shadow  batch, Aseprite-style
 * Returns the new frames plus a report of every number, so the UI can show before/after and why. */
import {inspect} from '../../game/pixel-check.js';
import {findGrid,sampleCells,mergeColors,detectBackground,removeBackground,hardAlpha,axisProfiles,addProfiles,bestShift,anchorOf,colorNoise} from '../../game/pixel-snap.js';
import {recoverSource} from '../../game/pixel-check.js';
import {removeAntiAlias,detect,applyChanges} from '../../game/pixel-cleanup.js';
import {indicesFromRGBA,keyOf} from './indexed.js';
import {planeFromRGBA,rgbaView,outline as outlinePlane,dropShadow,pack} from './raster.js';
export const DEFAULTS=Object.freeze({scale:'auto',snap:true,background:'auto',alphaCut:128,merge:'auto',maxColors:0,palette:null,dither:'none',fringe:true,orphans:false,align:'off',alignRadius:4,outline:null,shadow:null,grow:0});
const copy=img=>({data:new Uint8Array(img.data),width:img.width,height:img.height});
/** What the frames are (no changes): the verdict of the first frame, the shared grid, background. */
export function analyse(frames,opts={}){
 const o={...DEFAULTS,...opts},first=frames[0];
 const check=inspect(first);
 const forced=typeof o.scale==='number'&&o.scale>1?o.scale:null;
 let grid=null;
 let prof=null;if(frames.length>1)for(const f of frames)prof=addProfiles(prof,axisProfiles(f));
 const shared=findGrid(first,{scale:forced,profiles:prof});
 // pixel-check's verdict decides, except that a clear SMOOTH lattice (second-difference kinks, which
 // crisp 1× art does not have) counts as a resample even when that verdict says "already 1×"
 const smooth=shared.kind==='lattice'&&shared.order===2&&(shared.confidence==='high'||shared.confidence==='medium');
 if(forced||(check.verdict!=='unit'&&shared.kind!=='unit')||smooth)
  grid={...shared,perFrame:frames.map((f,i)=>i===0?shared:shared.kind==='integer'?findGrid(f,{}):findGrid(f,{scale:shared.scaleX}))};
 const bg=o.background==='auto'?detectBackground(first):null;
 return {check,grid,background:bg,noise:colorNoise(first),frames:frames.length};
}
/** Runs the pipeline. @returns {frames:[{data,width,height}], palette:[[r,g,b]], report} */
export function runCleanup(frames,opts={},analysis=null){
 const o={...DEFAULTS,...opts},A=analysis||analyse(frames,o),report={steps:[]};
 let out=frames.map(copy);
 // 1. snap to 1×
 if(o.snap&&A.grid&&A.grid.kind!=='unit'){
  out=out.map((f,i)=>{const g=A.grid.perFrame[i]||A.grid;
   if(g.kind==='integer'){const r=recoverSource(f,g.scale,{x:(g.scale-g.phaseX)%g.scale,y:(g.scale-g.phaseY)%g.scale});return {data:new Uint8Array(r.data),width:r.width,height:r.height};}
   return sampleCells(f,g,{noisy:A.noise.noisy});});
  report.steps.push({id:'snap',kind:A.grid.kind,scale:A.grid.scale,scaleX:A.grid.scaleX,scaleY:A.grid.scaleY,confidence:A.grid.confidence,size:out.map(f=>[f.width,f.height]),moved:A.grid.moved||0});
 }
 // 2. background → transparent
 const bgColor=o.background==='auto'?A.background?.color:Array.isArray(o.background)?o.background:null;
 if(bgColor){let removed=0;out=out.map(f=>{const r=removeBackground(f,bgColor);removed+=r.removed;return r;});report.steps.push({id:'background',color:bgColor,removed,share:A.background?.share??null});}
 // 3. hard alpha
 if(o.alphaCut!=null){let n=0;out=out.map(f=>{const r=hardAlpha(f,o.alphaCut);n+=r.changed;return r;});report.steps.push({id:'alpha',cut:o.alphaCut,changed:n});}
 // 4. colours: one palette for every frame
 let palette=null;
 if(o.palette?.length){
  const pal=o.palette.map(c=>[c[0],c[1],c[2],255]),dither=o.dither&&o.dither!=='none'?{pattern:o.dither}:null;let changed=0;
  out=out.map(f=>{const opaque=Uint8Array.from(f.data);for(let i=3;i<opaque.length;i+=4)if(opaque[i])opaque[i]=255;
   const {indices}=indicesFromRGBA(opaque,f.width,f.height,pal,{transparentIndex:-1,dither}),d=new Uint8Array(f.data);
   for(let p=0,i=0;i<d.length;i+=4,p++){if(!d[i+3])continue;const c=pal[indices[p]];if(c[0]!==d[i]||c[1]!==d[i+1]||c[2]!==d[i+2])changed++;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];}return {data:d,width:f.width,height:f.height};});
  palette=o.palette.map(c=>[c[0],c[1],c[2]]);report.steps.push({id:'quantize',colors:palette.length,changed,dither:o.dither||'none'});
 }else{
  // all frames side by side → one merge, so every frame ends up on the same colours. 'auto' merges
  // only noisy input (clean pixel art keeps every exact colour, including close shades of a ramp)
  const strip=stack(out),noise=colorNoise(strip),threshold=o.merge==='auto'?(noise.noisy?.04:A.grid?.order===2?.02:0):Number(o.merge)||0;
  if(threshold||o.maxColors){const r=mergeColors(strip,{threshold,maxColors:o.maxColors||0,represent:noise.noisy&&A.grid?.order!==2?'mean':'mode'});/* least-squares output is already exact ±1: keep its dominant exact colour */out=unstack(r,out);palette=r.palette;
   report.steps.push({id:'merge',before:r.before,after:r.after,threshold,maxColors:o.maxColors,noisy:noise.noisy,share:noise.share});}
  else{palette=exactColors(out);report.steps.push({id:'merge',before:noise.distinct,after:noise.distinct,threshold:0,noisy:false,share:noise.share});}
 }
 // 5. fringe: anti-alias pixels between palette colours
 if(o.fringe&&palette?.length>=2){
  let fixed=0;out=out.map(f=>{const r=removeAntiAlias(f,palette,{threshold:.08});const d=new Uint8Array(f.data);for(let p=0;p<r.indices.length;p++){if(r.indices[p]<0||!d[p*4+3])continue;const c=palette[r.indices[p]];if(c[0]!==d[p*4]||c[1]!==d[p*4+1]||c[2]!==d[p*4+2])fixed++;d.set(c,p*4);}return {data:d,width:f.width,height:f.height};});
  report.steps.push({id:'fringe',fixed});
 }
 // 6. orphans
 if(o.orphans&&palette?.length){
  let n=0;const key=new Map(palette.map((c,i)=>[keyOf(c[0],c[1],c[2]),i]));
  out=out.map(f=>{const idx=new Int16Array(f.width*f.height).fill(-1);for(let p=0;p<idx.length;p++)if(f.data[p*4+3])idx[p]=key.get(keyOf(f.data[p*4],f.data[p*4+1],f.data[p*4+2]))??-1;
   const det=detect({indices:idx,width:f.width,height:f.height},{minArea:2}),ch=det.orphans.changes;n+=ch.length;const next=applyChanges(idx,ch),d=new Uint8Array(f.data);
   for(const c of ch){const col=palette[next[c.at]];if(col)d.set(col,c.at*4);}return {data:d,width:f.width,height:f.height};});
  report.steps.push({id:'orphans',fixed:n});
 }
 // 7. one canvas + alignment
 if(out.length>1||o.grow){
  const W=Math.max(...out.map(f=>f.width))+2*o.grow,H=Math.max(...out.map(f=>f.height))+2*o.grow;
  const shifts=out.map(()=>({dx:o.grow,dy:o.grow}));
  if(o.align!=='off'&&out.length>1){
   const ref=out[0],ra=anchorOf(ref);
   for(let i=1;i<out.length;i++){
    if(o.align==='bounds'){const a=anchorOf(out[i]);if(ra&&a){shifts[i].dx+=ra.x-a.x;shifts[i].dy+=ra.y-a.y;}}
    else{const s=bestShift(ref,out[i],{radius:o.alignRadius});shifts[i].dx+=s.dx;shifts[i].dy+=s.dy;}
   }
   report.steps.push({id:'align',mode:o.align,shifts:shifts.map(s=>[s.dx-o.grow,s.dy-o.grow]),max:Math.max(0,...shifts.map(s=>Math.abs(s.dx-o.grow)+Math.abs(s.dy-o.grow)))});
  }
  out=out.map((f,i)=>place(f,W,H,shifts[i].dx,shifts[i].dy));
 }
 // 8. outline / shadow (Aseprite's Edit › FX)
 if(o.outline){const v=pack(...o.outline.color.slice(0,3),255);let n=0;out=out.map(f=>{const r=outlinePlane(planeFromRGBA(f.data,f.width,f.height),v,{place:o.outline.place||'outside',matrix:o.outline.matrix||'circle'});n+=r.changed;return {data:new Uint8Array(rgbaView(r.plane)),width:f.width,height:f.height};});report.steps.push({id:'outline',changed:n});if(palette&&!palette.some(c=>c[0]===o.outline.color[0]&&c[1]===o.outline.color[1]&&c[2]===o.outline.color[2]))palette=[...palette,o.outline.color.slice(0,3)];}
 if(o.shadow){const v=pack(...o.shadow.color.slice(0,3),255);let n=0;out=out.map(f=>{const r=dropShadow(planeFromRGBA(f.data,f.width,f.height),v,{dx:o.shadow.dx??1,dy:o.shadow.dy??1});n+=r.changed;return {data:new Uint8Array(rgbaView(r.plane)),width:f.width,height:f.height};});report.steps.push({id:'shadow',changed:n});if(palette&&!palette.some(c=>c[0]===o.shadow.color[0]&&c[1]===o.shadow.color[1]&&c[2]===o.shadow.color[2]))palette=[...palette,o.shadow.color.slice(0,3)];}
 report.colors=countColors(out);report.size=out.map(f=>[f.width,f.height]);
 return {frames:out,palette,report,analysis:A};
}
const cl=v=>Math.max(0,Math.min(255,Math.round(v)));
const bayerM=n=>{if(n===1)return [0];const h=n/2,m=bayerM(h),o=new Array(n*n),c=[0,2,3,1];for(let y=0;y<n;y++)for(let x=0;x<n;x++)o[y*n+x]=4*m[(y%h)*h+x%h]+c[(y<h?0:2)+(x<h?0:1)];return o;};
function stack(frames){const W=Math.max(...frames.map(f=>f.width)),H=frames.reduce((s,f)=>s+f.height,0),d=new Uint8Array(W*H*4);let y=0;for(const f of frames){for(let r=0;r<f.height;r++)d.set(f.data.subarray(r*f.width*4,(r+1)*f.width*4),((y+r)*W)*4);y+=f.height;}return {data:d,width:W,height:H};}
function unstack(img,frames){let y=0;return frames.map(f=>{const d=new Uint8Array(f.width*f.height*4);for(let r=0;r<f.height;r++)d.set(img.data.subarray(((y+r)*img.width)*4,((y+r)*img.width+f.width)*4),r*f.width*4);y+=f.height;return {data:d,width:f.width,height:f.height};});}
function place(f,W,H,dx,dy){const d=new Uint8Array(W*H*4);for(let y=0;y<f.height;y++){const ty=y+dy;if(ty<0||ty>=H)continue;const x0=Math.max(0,-dx),x1=Math.min(f.width,W-dx);if(x1>x0)d.set(f.data.subarray((y*f.width+x0)*4,(y*f.width+x1)*4),(ty*W+dx+x0)*4);}return {data:d,width:W,height:H};}
function exactColors(frames){const s=new Map();for(const f of frames)for(let i=0;i<f.data.length;i+=4)if(f.data[i+3]){const k=keyOf(f.data[i],f.data[i+1],f.data[i+2]);if(!s.has(k))s.set(k,[f.data[i],f.data[i+1],f.data[i+2]]);}return s.size<=256?[...s.values()]:null;}
function countColors(frames){const s=new Set();for(const f of frames)for(let i=0;i<f.data.length;i+=4)if(f.data[i+3])s.add(keyOf(f.data[i],f.data[i+1],f.data[i+2],f.data[i+3]));return s.size;}
