/** Playback timing for the Sprite workspace. Pure.
 *
 * One cycle is model.js playbackOrder (forward / reverse / ping-pong without doubled end frames);
 * timing is each frame's own duration in ms (the tag's fps only for frames without one). A tag's
 * `repeat` counts cycles (0 = forever); for ping-pong, as in Aseprite, one repeat is one pass in
 * one direction, so repeat 2 = there and back.
 *
 * Steps: [{index (position in the asset's frames), id, duration, from, to}] with cumulative ms. */
import {playbackOrder} from '../../game/model.js';
export const DEFAULT_DURATION=100;
export const durationOf=(f,tag=null)=>f?.duration??(tag?Math.round(1000/tag.fps):DEFAULT_DURATION);
/** Frames of the asset between two positions (inclusive), as a forward "tag" for playback. */
export const rangeTag=(asset,from=0,to=asset.frames.length-1)=>({id:'',name:'',frameIds:asset.frames.slice(Math.min(from,to),Math.max(from,to)+1).map(f=>f.id),fps:10,direction:'forward',repeat:0,loop:true});
/** One cycle of steps (or the whole finite play when `whole`). */
export function steps(asset,tag,{whole=false}={}){
 const pos=new Map(asset.frames.map((f,i)=>[f.id,i])),order=playbackOrder(tag).filter(id=>pos.has(id));
 let seq=order;
 if(whole&&tag.repeat>0){
  if(tag.direction==='pingpong'&&order.length>1){
   // Aseprite: each repeat is one pass; passes alternate direction and share the turning frame
   const ids=tag.frameIds.filter(id=>pos.has(id));seq=[...ids];
   for(let r=1;r<tag.repeat;r++){const pass=r%2?[...ids].reverse():ids;seq=seq.concat(pass.slice(1));}
  }else{seq=[];for(let r=0;r<tag.repeat;r++)seq=seq.concat(order);}
 }
 let at=0;
 return seq.map(id=>{const index=pos.get(id),f=asset.frames[index],duration=Math.max(1,durationOf(f,tag)),from=at;at+=duration;return {index,id,duration,from,to:at};});
}
export const totalMs=list=>list.length?list[list.length-1].to:0;
/** Step shown at time `ms` since playback started. Forever tags wrap; finite ones stop on the last. */
export function stepAt(list,ms,{loop=true}={}){
 if(!list.length)return null;
 const total=totalMs(list);
 if(!loop&&ms>=total)return {...list[list.length-1],done:true};
 const t=total>0?((ms%total)+total)%total:0;
 let lo=0,hi=list.length-1;// binary search: long tags stay cheap at 60 Hz
 while(lo<hi){const mid=(lo+hi)>>1;if(list[mid].to<=t)lo=mid+1;else hi=mid;}
 return list[lo];
}
/** The tag that "owns" a frame position for playback: the innermost (shortest) tag containing it. */
export function tagAt(asset,index){
 const id=asset.frames[index]?.id;if(!id)return null;
 let best=null;for(const t of asset.tags)if(t.frameIds.includes(id)&&(!best||t.frameIds.length<best.frameIds.length))best=t;
 return best;
}
/** Next/previous position for `,` `.`: stays inside `tag` (wrapping) when given, else the asset. */
export function stepIndex(asset,index,dir,tag=null){
 const n=asset.frames.length;if(!n)return -1;
 if(tag){
  const pos=tag.frameIds.map(id=>asset.frames.findIndex(f=>f.id===id)).filter(i=>i>=0).sort((a,b)=>a-b);
  if(pos.length){const k=pos.indexOf(index);if(k<0)return pos[dir>0?0:pos.length-1];return pos[(k+dir+pos.length)%pos.length];}
 }
 return Math.max(0,Math.min(n-1,(index<0?0:index)+dir));
}
/** Onion skin neighbours: [{index, offset, alpha, side:'prev'|'next'}] nearest first. `loopTag`
 * wraps around inside the tag, like Aseprite's "loop tag" onion option. */
export function onionFrames(asset,index,{before=1,after=1,opacity=.5,falloff=.5,tag=null}={}){
 const out=[],order=tag?tag.frameIds.map(id=>asset.frames.findIndex(f=>f.id===id)).filter(i=>i>=0).sort((a,b)=>a-b):asset.frames.map((_,i)=>i);
 const k=order.indexOf(index);if(k<0)return out;
 const add=(n,side)=>{for(let d=1;d<=n;d++){let j=side==='prev'?k-d:k+d;if(tag)j=((j%order.length)+order.length)%order.length;if(j<0||j>=order.length||order[j]===index)break;out.push({index:order[j],offset:side==='prev'?-d:d,alpha:opacity*Math.pow(falloff,d-1),side});}};
 add(before,'prev');add(after,'next');
 return out;
}
