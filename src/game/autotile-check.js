/** Does a tileset's art agree with the autotile rule each tile was placed in? Pure; no DOM.
 *
 * `completeness` (autotile.js) only knows whether a slot has *a* tile. A sheet can fill every slot
 * and still be wrong: a tile drawn with an open top edge sitting in a slot whose top must connect
 * leaves a seam in every map. That is measurable wherever the set has its two reference tiles —
 * the full interior tile (every side connects) and the isolated tile (no side connects). Each side
 * of every tile is compared with the same side of both references: a side the rule says connects
 * should look like the interior's side, one it says is open should look like the isolated tile's.
 * Sides where the two references look alike carry no information and are skipped, so the check
 * says "not measurable" rather than guessing. corner16 is not checked (its sides are halves). */
import {layoutOf,SIDES,N,E,S,W} from './autotile.js';
const FULL_KEY={blob47:255,edge16:15,minimal9:15};
const ISOLATED_KEY={blob47:0,edge16:0};
/** One side of a tile as RGBA bytes, in a fixed direction (left→right, top→bottom). */
export function sideLine({data,w,h},side){
 const out=new Uint8ClampedArray((side==='n'||side==='s'?w:h)*4);
 for(let i=0;i<out.length/4;i++){
  const x=side==='n'||side==='s'?i:side==='e'?w-1:0,y=side==='e'||side==='w'?i:side==='s'?h-1:0,p=(y*w+x)*4;
  out.set(data.subarray(p,p+4),i*4);
 }
 return out;
}
/** Mean per-pixel difference of two lines, 0…255; alpha differences count double. */
export function lineDifference(a,b){
 if(a.length!==b.length)return 255;
 let sum=0;for(let i=0;i<a.length;i+=4)sum+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+2*Math.abs(a[i+3]-b[i+3]))/5;
 return sum/(a.length/4);
}
/** @param kind   'blob47' | 'edge16' | 'minimal9' | 'corner16'
 * @param tileAt (slotIndex) => {data,w,h} | null — the art sitting in that slot
 * @returns {measurable, reason?, checked, sides, mismatches:[{slot,index,name,sides:[{side,expected,toFull,toOpen}]}]} */
export function artMismatch(kind,tileAt,{margin=6,informative=10}={}){
 const layout=layoutOf(kind);
 if(!(kind in FULL_KEY))return {measurable:false,reason:'corner sets are not checked side by side',checked:0,sides:0,mismatches:[]};
 const full=layout.byKey.get(FULL_KEY[kind]),iso=kind in ISOLATED_KEY?layout.byKey.get(ISOLATED_KEY[kind]):null;
 const fullArt=full?tileAt(full.index):null,isoArt=iso?tileAt(iso.index):null;
 if(!fullArt)return {measurable:false,reason:'the full interior tile is missing',checked:0,sides:0,mismatches:[]};
 // Without an isolated tile, the open-side reference is the side the full tile does not have:
 // for minimal9 the top-left tile's north side is open, and so on.
 const openRef={};
 for(const side of SIDES){
  if(isoArt){openRef[side]=sideLine(isoArt,side);continue;}
  const bit={n:N,e:E,s:S,w:W}[side],donor=layout.slots.find(s=>!(s.mask&bit)&&tileAt(s.index));
  openRef[side]=donor?sideLine(tileAt(donor.index),side):null;
 }
 const fullRef=Object.fromEntries(SIDES.map(side=>[side,sideLine(fullArt,side)]));
 const useful=Object.fromEntries(SIDES.map(side=>[side,!!openRef[side]&&lineDifference(fullRef[side],openRef[side])>=informative]));
 if(!SIDES.some(side=>useful[side]))return {measurable:false,reason:'connected and open sides look alike in this set',checked:0,sides:0,mismatches:[]};
 const mismatches=[];let checked=0,sides=0;
 for(const slot of layout.slots){
  const art=tileAt(slot.index);if(!art||art.w!==fullArt.w||art.h!==fullArt.h)continue;
  checked++;const wrong=[];
  for(const side of SIDES){
   if(!useful[side])continue;sides++;
   const line=sideLine(art,side),toFull=lineDifference(line,fullRef[side]),toOpen=lineDifference(line,openRef[side]),expected=slot.edges[side];
   if(expected&&toFull>toOpen+margin||!expected&&toOpen>toFull+margin)wrong.push({side,expected:expected?'connected':'open',toFull:+toFull.toFixed(1),toOpen:+toOpen.toFixed(1)});
  }
  if(wrong.length)mismatches.push({slot:slot.index,index:slot.index,name:slot.name,sides:wrong});
 }
 return {measurable:true,checked,sides,mismatches};
}
