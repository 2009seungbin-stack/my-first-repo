/** Animations from frame file names. Pure; no DOM.
 *
 * Exported frames are named like walk_01.png, walk-2.png, attack 3.png, hero_run_0.png or
 * player_walk1.png: a name, an optional separator, a frame number. Frames that share the name
 * part are one animation, ordered by the number as a number (walk_2 before walk_10), and the
 * animations keep the order in which their first frame appeared. A name with no trailing number
 * is its own one-frame animation. */
export const naturalCompare=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
/** {base, index, stem}: base is the animation name, index the frame number (or null). */
export function animationKey(fileName){
 const stem=String(fileName).replace(/^.*[\\/]/,'').replace(/\.[a-z0-9]{1,5}$/i,'');
 const m=/^(.*?)[\s_.\-]*(\d+)$/.exec(stem);
 if(!m||!m[1].trim())return {base:stem,index:m?Number(m[2]):null,stem};
 return {base:m[1].replace(/[\s_.\-]+$/,''),index:Number(m[2]),stem};
}
/** @param names file names in their current order
 * @returns [{name, frames:[positions into `names`]}] */
export function groupAnimations(names){
 const groups=new Map();
 names.forEach((n,position)=>{const k=animationKey(n),key=k.base.toLowerCase();
  if(!groups.has(key))groups.set(key,{name:k.base,items:[]});
  groups.get(key).items.push({position,index:k.index,stem:k.stem});});
 return [...groups.values()].map(g=>({name:g.name,frames:g.items.sort((a,b)=>a.index!=null&&b.index!=null?a.index-b.index||naturalCompare(a.stem,b.stem):naturalCompare(a.stem,b.stem)).map(i=>i.position)}));
}
/** One canvas for frames of different sizes: the largest width and height, each frame placed
 * bottom-centred, whole pixels. Returned per frame as the offset the data file records
 * (spriteSourceSize / sourceSize), so an engine plays the frames exactly as the preview shows. */
export function sharedCanvas(sizes){
 const w=Math.max(1,...sizes.map(s=>s.w)),h=Math.max(1,...sizes.map(s=>s.h));
 return {w,h,offsets:sizes.map(s=>({x:Math.floor((w-s.w)/2),y:h-s.h}))};
}
