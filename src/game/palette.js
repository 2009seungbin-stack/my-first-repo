/** Palette work for pixel-art game assets: extraction shared across many frames, sorting,
 * editing, strict import/export (.gpl / .hex / JSON), palette locking and shading-preserving
 * recolouring. Pure: no DOM, no canvases — callers hand in {data,width,height} views.
 *
 * Every recolour here is a PALETTE transform, not a pixel transform: an operation produces a new
 * palette of the same length and the pixels are rewritten by index. That is what makes shading
 * relations and animation consistency exact rather than approximate — two frames that used index
 * 4 still both use index 4 afterwards. */
import {oklab,accumulate,paletteFromHistogram,quantizeIndexed,ditherKernel} from '../pixel-engine.js';
export const MAX_COLORS=256;
export const COUNT_PRESETS=Object.freeze([4,8,16,32,64]);
export const SORT_MODES=Object.freeze(['original','luminance','hue','saturation','frequency']);
const clamp255=v=>Math.max(0,Math.min(255,Math.round(v)));
const encode=v=>clamp255(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));
export const rgb=c=>[clamp255(c[0]),clamp255(c[1]),clamp255(c[2])];
export const hex=c=>'#'+rgb(c).map(v=>v.toString(16).padStart(2,'0')).join('');
export const sameColor=(a,b)=>a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
/** Accepts #rgb, #rrggbb, rrggbb and "r g b" / "r,g,b"; returns null instead of guessing. */
export function parseColor(value){
 const s=String(value??'').trim();if(!s)return null;
 const short=s.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);if(short)return short.slice(1).map(v=>parseInt(v+v,16));
 const long=s.match(/^#?([a-f\d]{6})$/i);if(long)return [0,2,4].map(i=>parseInt(long[1].slice(i,i+2),16));
 const triple=s.match(/^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})$/);
 if(triple&&triple.slice(1).every(v=>+v<=255))return triple.slice(1).map(Number);
 return null;
}
/** Oklab → OkLCh. Hue is degrees 0–360; chroma 0 leaves hue at 0 rather than NaN. */
export function okLCh(color){
 const [L,a,b]=oklab(...rgb(color)),C=Math.hypot(a,b);
 return [L,C,C<1e-6?0:(Math.atan2(b,a)*180/Math.PI+360)%360];
}
export function fromOkLCh([L,C,h]){
 const a=C*Math.cos(h*Math.PI/180),b=C*Math.sin(h*Math.PI/180);
 const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 return [encode(4.0767416621*l-3.3077115913*m+.2309699292*s),encode(-1.2684380046*l+2.6097574011*m-.3413193965*s),encode(-.0041960863*l-.7034186147*m+1.707614701*s)];
}
export const lightness=color=>okLCh(color)[0];
const hueDelta=(a,b)=>{const d=Math.abs(((a-b)%360+360)%360);return Math.min(d,360-d);};
/** One palette for a whole animation: every frame feeds ONE alpha-weighted histogram, so a
 * colour that appears in two frames counts twice and no frame gets its own palette. */
export function extract(sources,count,{alphaThreshold=1}={}){
 const n=Math.max(1,Math.min(MAX_COLORS,Math.round(count)));
 const histogram=new Map();let opaque=0,total=0;
 for(const s of sources){
  view(s);accumulate(s.data,histogram);
  for(let i=3;i<s.data.length;i+=4){total++;if(s.data[i]>=alphaThreshold)opaque++;}
 }
 if(!opaque)return {colors:[[0,0,0]],opaque:0,total,buckets:histogram.size};
 return {colors:paletteFromHistogram(histogram,n).map(rgb),opaque,total,buckets:histogram.size};
}
function view(s){
 if(!s||!(s.data instanceof Uint8ClampedArray||s.data instanceof Uint8Array)||!Number.isSafeInteger(s.width)||!Number.isSafeInteger(s.height)||s.width<1||s.height<1||s.data.length!==s.width*s.height*4)throw Error('Each source needs {data,width,height} RGBA pixels');
 return s;
}
/** Exact per-colour pixel counts over any number of frames, by nearest palette entry in Oklab.
 * `exact` counts only pixels whose RGB already equals a palette colour, which is how the Lab
 * knows whether an image is really palettised or merely close. */
export function usage(sources,colors){
 const labs=colors.map(c=>oklab(...c)),counts=new Array(colors.length).fill(0),keys=new Map(colors.map((c,i)=>[c[0]<<16|c[1]<<8|c[2],i]));
 let opaque=0,exact=0;
 for(const s of sources){
  view(s);const d=s.data;
  for(let i=0;i<d.length;i+=4){
   if(!d[i+3])continue;opaque++;
   const direct=keys.get(d[i]<<16|d[i+1]<<8|d[i+2]);
   if(direct!==undefined){counts[direct]++;exact++;continue;}
   const lab=oklab(d[i],d[i+1],d[i+2]);let best=0,dist=Infinity;
   for(let k=0;k<labs.length;k++){const e=(lab[0]-labs[k][0])**2+(lab[1]-labs[k][1])**2+(lab[2]-labs[k][2])**2;if(e<dist){dist=e;best=k;}}
   counts[best]++;
  }
 }
 return {counts,opaque,exact,share:counts.map(c=>opaque?c/opaque:0)};
}
/** Sorting returns the permutation as well, so indices stored elsewhere can follow the palette. */
export function sortPalette(colors,mode='luminance',counts=null){
 if(!SORT_MODES.includes(mode))throw Error(`Unknown palette sort ${mode}`);
 const order=colors.map((c,i)=>i);
 if(mode!=='original'){
  const lch=colors.map(okLCh);
  const key=i=>mode==='luminance'?lch[i][0]:mode==='saturation'?(lch[i][0]>0?lch[i][1]/Math.max(lch[i][0],1e-6):0):mode==='hue'?lch[i][2]:-(counts?.[i]??0);
  // Hue sorts greys (no chroma) last instead of scattering them through the hue circle.
  order.sort((a,b)=>(mode==='hue'?(lch[a][1]<.01)-(lch[b][1]<.01):0)||key(a)-key(b)||lch[a][0]-lch[b][0]||a-b);
 }
 return {order,colors:order.map(i=>colors[i])};
}
/** Ramp = the same colours ordered dark → light. Shading maps by position in this order. */
export const rampOf=colors=>sortPalette(colors,'luminance').colors;
/** A target ramp from ONE base colour: keep the source ramp's Oklab lightness steps, take the
 * base's hue and chroma, and shift hue along the ramp the way hand-painted ramps do (shadows
 * cooler, highlights warmer). Nothing here is claimed to be art direction — it is a starting ramp. */
export function generateRamp(base,source,{hueShift=12,chromaCurve=.35}={}){
 const ramp=rampOf(source),[,C,h]=okLCh(base),mid=(ramp.length-1)/2||1;
 return ramp.map((c,i)=>{
  const L=lightness(c),position=ramp.length>1?(i-mid)/mid:0;
  return fromOkLCh([L,Math.max(0,C*(1+chromaCurve*(1-Math.abs(position)))),(h+hueShift*position+360)%360]);
 });
}
/** Map selected palette entries onto a target ramp by ramp POSITION, never by nearest colour, so
 * the darkest selected colour becomes the darkest target colour and the order cannot invert. */
export function rampMap(colors,selection,target){
 if(!selection.length)throw Error('Pick at least one source colour');
 if(!target.length)throw Error('Pick at least one target colour');
 const picked=[...new Set(selection)].filter(i=>i>=0&&i<colors.length);
 if(!picked.length)throw Error('Pick at least one source colour');
 const ordered=picked.slice().sort((a,b)=>lightness(colors[a])-lightness(colors[b])||a-b);
 const ramp=rampOf(target),out=colors.map(c=>[...c]),steps=ordered.length>1?ordered.length-1:1;
 ordered.forEach((index,at)=>{
  const position=ordered.length>1?at/steps:.5;
  out[index]=ramp[Math.min(ramp.length-1,Math.round(position*(ramp.length-1)))];
 });
 return out;
}
/** Hue-window select in OkLCh: a hue centre ± window, ignoring colours too grey to have a hue.
 * `tolerance` widens the window by the same units so one control can be loosened gradually. */
export function hueWindow(colors,{hue=0,window=30,tolerance=0,chromaMin=.02}={}){
 const span=Math.max(0,window)+Math.max(0,tolerance);
 return colors.map(c=>{const [,C,h]=okLCh(c);return C>=chromaMin&&hueDelta(h,hue)<=span;});
}
/** Replace every hue-window colour, keeping each one's own lightness (and chroma unless a
 * target chroma is given) so shading inside the region survives the swap. */
export function hueReplace(colors,{hue=0,window=30,tolerance=0,chromaMin=.02,target,chroma=null}={}){
 const to=okLCh(target??[255,0,0]),mask=hueWindow(colors,{hue,window,tolerance,chromaMin}),grey=to[1]<1e-6;
 return {mask,colors:colors.map((c,i)=>{if(!mask[i])return [...c];const [L,C]=okLCh(c);return fromOkLCh([L,chroma!=null?chroma:grey?0:C,to[2]]);})};
}
/** Status presets are ramp/tint recipes a person can adjust, not authored art. Each one mixes
 * every colour towards a hue at a fixed strength and nudges lightness. */
export const STATUS_PRESETS=Object.freeze({
 frozen:{hue:230,strength:.7,lift:.06,chroma:.9},
 poison:{hue:145,strength:.65,lift:-.02,chroma:1.05},
 burn:{hue:40,strength:.6,lift:.04,chroma:1.2},
 ghost:{hue:250,strength:.5,lift:.1,chroma:.25},
 flash:{hue:80,strength:.85,lift:.22,chroma:.35}
});
export function tint(colors,{hue=0,strength=.6,lift=0,chroma=1}={}){
 const s=Math.max(0,Math.min(1,strength));
 return colors.map(c=>{
  const [L,C,h]=okLCh(c),shift=((hue-h+540)%360)-180;
  return fromOkLCh([Math.max(0,Math.min(1,L+lift)),Math.max(0,C*chroma),(h+shift*s+360)%360]);
 });
}
export const TEAM_COLORS=Object.freeze({red:[214,58,58],blue:[52,103,214],green:[62,163,84],yellow:[221,178,48],purple:[136,74,196],orange:[224,120,44],white:[235,238,242],black:[38,42,50]});
/** N team variants from ONE source selection: each variant is the same index re-map with a
 * different base colour, so every variant keeps identical shading relations. */
export function teamVariants(colors,selection,bases,options={}){
 return Object.entries(bases).map(([name,base])=>({name,colors:rampMap(colors,selection,generateRamp(base,selection.map(i=>colors[i]),options))}));
}
/** Colour budget: what is over target and which colours are cheapest to lose. A merge plan maps
 * the rarest colours onto their nearest surviving neighbour in Oklab — never onto each other. */
export function auditBudget(colors,counts,target){
 const limit=Math.max(1,Math.round(target)),over=Math.max(0,colors.length-limit),total=counts.reduce((a,b)=>a+b,0);
 const ranked=colors.map((c,i)=>({index:i,color:c,count:counts[i]??0,share:total?(counts[i]??0)/total:0})).sort((a,b)=>a.count-b.count||a.index-b.index);
 return {limit,actual:colors.length,over,total,offenders:ranked.slice(0,over),rarest:ranked};
}
export function mergePlan(colors,counts,target){
 const {over,rarest}=auditBudget(colors,counts,target);if(!over)return {map:colors.map((_,i)=>i),removed:[]};
 const removed=new Set(rarest.slice(0,over).map(r=>r.index)),keep=colors.map((_,i)=>i).filter(i=>!removed.has(i));
 if(!keep.length)throw Error('A palette cannot shrink below one colour');
 const labs=colors.map(c=>oklab(...c)),map=colors.map((_,i)=>{
  if(!removed.has(i))return i;
  let best=keep[0],d=Infinity;
  for(const k of keep){const e=(labs[i][0]-labs[k][0])**2+(labs[i][1]-labs[k][1])**2+(labs[i][2]-labs[k][2])**2;if(e<d){d=e;best=k;}}
  return best;
 });
 return {map,removed:[...removed].sort((a,b)=>a-b),colors:keep.map(i=>colors[i]),keep};
}
/** Lock: quantise one frame to a fixed palette and hand back both pixels and indices.
 * Error-diffusion modes are refused for animations by the caller, not here (see docs). */
export function lockFrame(source,colors,{mode='none',amount=1}={}){
 view(source);const {data,indices}=quantizeIndexed(source.data,source.width,source.height,colors,{mode,amount});
 return {data,indices,alpha:alphaOf(source.data),width:source.width,height:source.height};
}
/** Per-pixel alpha, so every later stage carries the original silhouette instead of re-deriving it. */
export const alphaOf=data=>{const out=new Uint8ClampedArray(data.length/4);for(let p=0;p<out.length;p++)out[p]=data[p*4+3];return out;};
/** Rewrite pixels from indices and a palette. Alpha is carried from the original frame, so a
 * recolour can never move or soften a silhouette. */
export function recolorIndexed(indices,alpha,colors,{width,height}={}){
 if(indices.length!==alpha.length)throw Error('Indices and alpha describe different images');
 const out=new Uint8ClampedArray(indices.length*4);
 for(let p=0;p<indices.length;p++){const i=p*4,k=indices[p];if(k<0||!alpha[p])continue;out.set(colors[Math.min(k,colors.length-1)],i);out[i+3]=alpha[p];}
 return {data:out,width,height};
}
export const remapIndices=(indices,map)=>{const out=new Int16Array(indices.length);for(let i=0;i<indices.length;i++)out[i]=indices[i]<0?-1:map[indices[i]]??indices[i];return out;};
/** True when a dither mode can make an unchanged region differ between frames. Error diffusion
 * carries a running error that depends on every earlier pixel, so a change anywhere upstream
 * shifts decisions downstream; an ordered matrix depends only on (x, y). */
export const flickers=mode=>ditherKernel(mode).kind==='diffusion';
// ── import / export ───────────────────────────────────────────────────────────────────────────
const GPL_HEADER='GIMP Palette';
/** Strict GIMP palette reader: header required, Name/Columns optional, '#' comments and blank
 * lines skipped, colour lines are exactly three 0–255 integers plus an optional name. */
export function parseGPL(text){
 const lines=String(text).replace(/^﻿/,'').split(/\r\n|\r|\n/);
 let at=0;while(at<lines.length&&!lines[at].trim())at++;
 if(lines[at]?.trim()!==GPL_HEADER)throw Error('Not a GIMP palette: the first line must be "GIMP Palette"');
 at++;let name='',columns=0;const colors=[],names=[];
 for(;at<lines.length;at++){
  const line=lines[at],s=line.trim();
  if(!s||s.startsWith('#'))continue;
  const meta=s.match(/^(Name|Columns):\s*(.*)$/i);
  if(meta&&!colors.length){
   if(meta[1].toLowerCase()==='name')name=meta[2].trim();
   else{const n=Number(meta[2].trim());if(!Number.isInteger(n)||n<0||n>256)throw Error(`Invalid Columns value on line ${at+1}`);columns=n;}
   continue;
  }
  const m=s.match(/^(\d{1,3})[ \t]+(\d{1,3})[ \t]+(\d{1,3})(?:[ \t]+(.*))?$/);
  if(!m)throw Error(`Line ${at+1} is not a GIMP palette colour: "${s.slice(0,40)}"`);
  const channels=m.slice(1,4).map(Number);
  if(channels.some(v=>v>255))throw Error(`Line ${at+1} has a channel above 255`);
  if(colors.length>=MAX_COLORS)throw Error(`A palette holds at most ${MAX_COLORS} colours`);
  colors.push(channels);names.push((m[4]||'').trim());
 }
 if(!colors.length)throw Error('This GIMP palette has no colours');
 return {format:'gpl',name,columns,colors,names};
}
export function toGPL(colors,{name='Palette',columns=0,names=[]}={}){
 const pad=v=>String(clamp255(v)).padStart(3,' ');
 const rows=colors.map((c,i)=>`${pad(c[0])} ${pad(c[1])} ${pad(c[2])}\t${(names[i]||hex(c).slice(1).toUpperCase())}`);
 return `${GPL_HEADER}\nName: ${String(name).replace(/[\r\n]+/g,' ').trim()||'Palette'}\nColumns: ${Math.max(0,Math.min(256,Math.round(columns)))}\n#\n${rows.join('\n')}\n`;
}
/** Lospec-style hex list: one colour per line, or several separated by commas/spaces, '#' optional. */
export function parseHexList(text){
 const colors=[];
 for(const [row,line] of String(text).replace(/^﻿/,'').split(/\r\n|\r|\n/).entries()){
  // '#' starts a colour only when a hex digit follows it; "# 16 colours" is a comment.
  const s=line.trim();if(!s||/^(;|\/\/|#(?![a-f\d]))/i.test(s))continue;
  for(const token of s.split(/[\s,;]+/).filter(Boolean)){
   const c=parseColor(token);if(!c)throw Error(`Line ${row+1} is not a colour: "${token.slice(0,20)}"`);
   if(colors.length>=MAX_COLORS)throw Error(`A palette holds at most ${MAX_COLORS} colours`);
   colors.push(c);
  }
 }
 if(!colors.length)throw Error('No colours found');
 return {format:'hex',name:'',columns:0,colors,names:colors.map(()=>'')};
}
export const toHexText=colors=>colors.map(c=>hex(c)).join('\n')+'\n';
export const toPaletteJSON=(colors,{name='Palette',source=''}={})=>JSON.stringify({name,colors:colors.map(c=>hex(c)),rgb:colors.map(c=>rgb(c)),count:colors.length,source},null,1)+'\n';
export function parsePaletteJSON(text){
 let value;try{value=JSON.parse(text);}catch{throw Error('This file is not valid JSON');}
 const list=Array.isArray(value)?value:Array.isArray(value?.colors)?value.colors:Array.isArray(value?.rgb)?value.rgb:null;
 if(!list?.length)throw Error('JSON palettes need a "colors" array of #RRGGBB values');
 if(list.length>MAX_COLORS)throw Error(`A palette holds at most ${MAX_COLORS} colours`);
 const colors=list.map((entry,i)=>{
  const c=Array.isArray(entry)?(entry.length>=3&&entry.slice(0,3).every(v=>Number.isInteger(v)&&v>=0&&v<=255)?entry.slice(0,3):null):parseColor(typeof entry==='string'?entry:entry?.hex??entry?.color);
  if(!c)throw Error(`Colour ${i+1} is not a #RRGGBB value or [r,g,b] triple`);
  return c;
 });
 return {format:'json',name:String(value?.name||''),columns:0,colors,names:colors.map(()=>'')};
}
/** One entry point for a dropped palette file or pasted text; the format is detected, never guessed
 * from the extension alone, so a .txt holding a GIMP palette still reads correctly. */
export function parsePaletteFile(text,filename=''){
 const body=String(text).replace(/^﻿/,''),head=body.trim();
 if(head.startsWith('{')||head.startsWith('['))return parsePaletteJSON(body);
 if(/^\s*GIMP Palette/.test(body))return parseGPL(body);
 if(/\.json$/i.test(filename))return parsePaletteJSON(body);
 return parseHexList(body);
}
export const PALETTE_FORMATS=Object.freeze({gpl:{ext:'gpl',label:'GIMP (.gpl)',write:toGPL},hex:{ext:'hex',label:'HEX list (.hex)',write:toHexText},json:{ext:'json',label:'JSON (.json)',write:toPaletteJSON}});
export function serializePalette(format,colors,options={}){
 const spec=PALETTE_FORMATS[format];if(!spec)throw Error(`Unknown palette format ${format}`);
 return spec.write(colors,options);
}
