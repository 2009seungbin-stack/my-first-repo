/** Indexed colour for the Pixel workspace: the sprite palette and index ⇄ colour maths. Pure.
 *
 * A sprite's palette lives in the document (`asset.palette = {colors:[[r,g,b,a]…], names?}`), in
 * RGB and indexed sprites alike. An INDEXED sprite (`asset.colorMode = 'indexed'`) stores its cels
 * as indexed PNGs (png8.js), so a pixel IS a palette index: changing entry 5 recolours every pixel
 * that uses 5, reordering entries keeps the picture (indices are remapped), and two entries of the
 * same colour stay two different indices. `asset.transparentIndex` (Aseprite's "transparent colour",
 * default 0) is drawn as transparent. Nearest-colour matching is in Oklab and, like Aseprite's, never
 * picks the transparent index for an opaque pixel. */
import {oklab} from '../../pixel-engine.js';
export const MAX_PALETTE=256;
const clamp=v=>Math.max(0,Math.min(255,Math.round(Number(v)||0)));
export const keyOf=(r,g,b,a=255)=>a?((r&255)|(g&255)<<8|(b&255)<<16|(a&255)<<24)>>>0:0;
export const colorKey=c=>keyOf(c[0],c[1],c[2],c[3]??255);
export const hex=c=>'#'+[c[0],c[1],c[2]].map(v=>clamp(v).toString(16).padStart(2,'0')).join('')+((c[3]??255)<255?clamp(c[3]).toString(16).padStart(2,'0'):'');
export function parseHex(s){
 const m=/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(s||'').trim());if(!m)return null;
 let v=m[1];if(v.length===3)v=[...v].map(c=>c+c).join('');
 return [0,2,4,6].slice(0,v.length/2).map(i=>parseInt(v.slice(i,i+2),16)).concat(v.length===6?[255]:[]);
}
/** Validated palette {colors:[[r,g,b,a]], names?} (throws on garbage, clamps channels). */
export function normalizePalette(raw){
 const list=Array.isArray(raw)?raw:raw?.colors;if(!Array.isArray(list)||!list.length)throw Error('A palette needs at least one colour');
 if(list.length>MAX_PALETTE)throw Error(`A palette holds at most ${MAX_PALETTE} colours`);
 const colors=list.map((c,i)=>{const v=typeof c==='string'?parseHex(c):Array.isArray(c)&&c.length>=3?[c[0],c[1],c[2],c[3]??255]:null;if(!v)throw Error(`Palette colour ${i+1} is not a colour`);return v.map(clamp);});
 const names=Array.isArray(raw?.names)&&raw.names.some(Boolean)?colors.map((_,i)=>String(raw.names[i]||'').slice(0,60)):null;
 return names?{colors,names}:{colors};
}
/** Default palette of a new sprite: DawnBringer 32 (Aseprite's default), index 0 transparent-safe. */
export const DB32=Object.freeze(['#000000','#222034','#45283c','#663931','#8f563b','#df7126','#d9a066','#eec39a','#fbf236','#99e550','#6abe30','#37946e','#4b692f','#524b24','#323c39','#3f3f74','#306082','#5b6ee1','#639bff','#5fcde4','#cbdbfc','#ffffff','#9badb7','#847e87','#696a6a','#595652','#76428a','#ac3232','#d95763','#d77bba','#8f974a','#8a6f30'].map(parseHex));
// ------------------------------------------------------------------ nearest colour
/** Matcher over a palette: nearest(r,g,b,a) → index, cached per exact colour. Alpha counts as a
 * fourth axis so a half-transparent pixel prefers a half-transparent entry. `exclude` (the
 * transparent index) is never returned for a visible pixel. */
export function matcher(colors,{exclude=-1}={}){
 const labs=colors.map(c=>{const l=oklab(c[0],c[1],c[2]);return [l[0],l[1],l[2],(c[3]??255)/255];}),exact=new Map(),cache=new Map();
 colors.forEach((c,i)=>{if(i===exclude)return;const k=colorKey(c);if(!exact.has(k))exact.set(k,i);});
 const nearest=(r,g,b,a=255)=>{
  const k=keyOf(r,g,b,a);const e=exact.get(k);if(e!==undefined)return e;const hit=cache.get(k);if(hit!==undefined)return hit;
  const l=oklab(r,g,b),al=a/255;let best=-1,d=Infinity;
  for(let i=0;i<labs.length;i++){if(i===exclude)continue;const q=labs[i],e2=(l[0]-q[0])**2+(l[1]-q[1])**2+(l[2]-q[2])**2+.25*(al-q[3])**2;if(e2<d){d=e2;best=i;}}
  if(best<0)best=0;cache.set(k,best);return best;
 };
 return {nearest,exact:k=>exact.get(k)};
}
/** RGBA → indices. Exact colours map to their (first) entry; others to the nearest; alpha 0 → the
 * transparent index. `dither` = {pattern:'bayer2'|'bayer4'|'bayer8'} turns on ORDERED dithering
 * between the two palette colours a pixel sits between (the mix ratio measured in linear light, so
 * a 50 % grey between black and white gets ~22 % white pixels, which is what the eye averages to);
 * off by default, and the result depends only on (x, y), so animations do not flicker. */
export function indicesFromRGBA(data,w,h,colors,{transparentIndex=0,dither=null}={}){
 const out=new Uint8Array(w*h),m=matcher(colors,{exclude:transparentIndex}),ti=transparentIndex<0?0:transparentIndex;let off=0;
 const n=dither?.pattern==='bayer8'?8:dither?.pattern==='bayer2'?2:4,mat=dither?bayer(n):null,lin=colors.map(c=>[LIN[c[0]],LIN[c[1]],LIN[c[2]]]);
 for(let p=0;p<w*h;p++){
  const i=p*4,a=data[i+3];if(!a){out[p]=ti;continue;}
  const r=data[i],g=data[i+1],b=data[i+2],e=m.exact(keyOf(r,g,b,a));
  if(e!==undefined){out[p]=e;continue;}
  off++;const A=m.nearest(r,g,b,a);
  if(!mat){out[p]=A;continue;}
  // the colour on the other side: reflect the pixel through A and match again
  const ca=colors[A],B=m.nearest(clamp(2*r-ca[0]),clamp(2*g-ca[1]),clamp(2*b-ca[2]),a);
  if(B===A){out[p]=A;continue;}
  const la=lin[A],lb=lin[B],lc=[LIN[r],LIN[g],LIN[b]],d=[lb[0]-la[0],lb[1]-la[1],lb[2]-la[2]],len=d[0]*d[0]+d[1]*d[1]+d[2]*d[2];
  const t=len?Math.max(0,Math.min(1,((lc[0]-la[0])*d[0]+(lc[1]-la[1])*d[1]+(lc[2]-la[2])*d[2])/len)):0;
  const x=p%w,y=(p-x)/w,th=(mat[(y%n)*n+x%n]+.5)/(n*n);
  out[p]=th<t?B:A;
 }
 return {indices:out,offPalette:off};
}
const LIN=Array.from({length:256},(_,v)=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4);
const bayer=n=>{if(n===1)return [0];const h=n/2,m=bayer(h),o=new Array(n*n),c=[0,2,3,1];for(let y=0;y<n;y++)for(let x=0;x<n;x++)o[y*n+x]=4*m[(y%h)*h+x%h]+c[(y<h?0:2)+(x<h?0:1)];return o;};
/** Indices → straight RGBA (the transparent index → 0,0,0,0). */
export function rgbaFromIndices(indices,colors,{transparentIndex=0}={}){
 const out=new Uint8Array(indices.length*4);
 for(let p=0;p<indices.length;p++){const k=indices[p];if(k===transparentIndex)continue;const c=colors[k]||colors[0];out[p*4]=c[0];out[p*4+1]=c[1];out[p*4+2]=c[2];out[p*4+3]=c[3]??255;}
 return out;
}
/** Packed RGBA value of an index (for the raster planes' colour tests). */
export const valueOfIndex=(colors,i,ti=0)=>i===ti||!colors[i]?0:keyOf(colors[i][0],colors[i][1],colors[i][2],colors[i][3]??255);
export function remap(indices,map){const out=new Uint8Array(indices.length);for(let i=0;i<indices.length;i++)out[i]=map[indices[i]]??indices[i];return out;}
// ------------------------------------------------------------------ palette edits (return {colors, map, transparentIndex})
/** Moves the entries `from` (indices, any order) so they start at position `to` (in the list without
 * them). `map[old] = new` keeps every pixel's colour when applied to the indices. */
export function movePaletteEntries(colors,from,to,{transparentIndex=0}={}){
 const set=new Set(from),moving=colors.map((c,i)=>i).filter(i=>set.has(i)),rest=colors.map((c,i)=>i).filter(i=>!set.has(i));
 to=Math.max(0,Math.min(rest.length,to));
 const order=[...rest.slice(0,to),...moving,...rest.slice(to)],map=new Array(colors.length);
 order.forEach((old,n)=>{map[old]=n;});
 return {colors:order.map(i=>colors[i]),map,order,transparentIndex:transparentIndex>=0?map[transparentIndex]:transparentIndex};
}
/** Removes entries; pixels that used them move to the nearest remaining colour. */
export function removePaletteEntries(colors,remove,{transparentIndex=0}={}){
 const gone=new Set(remove.filter(i=>i!==transparentIndex)),keep=colors.map((c,i)=>i).filter(i=>!gone.has(i));
 if(!keep.length)throw Error('A palette cannot be empty');
 const next=keep.map(i=>colors[i]),newTi=transparentIndex>=0?keep.indexOf(transparentIndex):-1,m=matcher(next,{exclude:newTi}),map=new Array(colors.length);
 keep.forEach((old,n)=>{map[old]=n;});
 for(const i of gone){const c=colors[i];map[i]=m.nearest(c[0],c[1],c[2],c[3]??255);}
 return {colors:next,map,transparentIndex:newTi};
}
/** Sort: returns the moved palette and the index map (pixels keep their colours). */
export function sortPaletteEntries(colors,mode='luminance',{transparentIndex=0,counts=null}={}){
 const lab=colors.map(c=>{const l=oklab(c[0],c[1],c[2]);return {L:l[0],C:Math.hypot(l[1],l[2]),H:(Math.atan2(l[2],l[1])*180/Math.PI+360)%360};});
 const idx=colors.map((c,i)=>i).filter(i=>i!==transparentIndex);
 const key=i=>mode==='hue'?(lab[i].C<.02?1e3+lab[i].L:lab[i].H*10+lab[i].L):mode==='saturation'?-lab[i].C:mode==='usage'?-(counts?.[i]??0):lab[i].L;
 idx.sort((a,b)=>key(a)-key(b)||a-b);
 const order=transparentIndex>=0&&transparentIndex<colors.length?[transparentIndex,...idx]:idx,map=new Array(colors.length);
 order.forEach((old,n)=>{map[old]=n;});
 return {colors:order.map(i=>colors[i]),map,order,transparentIndex:transparentIndex>=0?0:-1};
}
/** Palette of exactly the colours an image uses (lossless when ≤ 255 colours), most used first,
 * with a transparent entry at index 0. Returns null when there are too many colours. */
export function exactPalette(sources,{max=MAX_PALETTE}={}){
 const count=new Map();
 for(const s of sources){const d=s.data||s;for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const k=keyOf(d[i],d[i+1],d[i+2],d[i+3]);count.set(k,(count.get(k)||0)+1);}}
 if(count.size>max-1)return null;
 const colors=[[0,0,0,0],...[...count].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).map(([k])=>[k&255,k>>>8&255,k>>>16&255,k>>>24&255])];
 return {colors,transparentIndex:0,counts:[0,...[...count.values()].sort((a,b)=>b-a)]};
}
/** Usage count per palette index over index buffers. */
export function usageCounts(buffers,size){const c=new Array(size).fill(0);for(const b of buffers)for(let i=0;i<b.length;i++)c[b[i]]++;return c;}
