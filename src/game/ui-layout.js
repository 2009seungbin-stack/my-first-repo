/** UI layout arithmetic: anchor presets, safe areas, screen presets, greedy line breaking and
 * rectangle merging. Pure; no DOM. Text widths are measured by the caller (a canvas can) and
 * passed in as numbers, so the same breaking runs in a test and in the page.
 *
 * The anchor maths follow Godot 4's Control model (anchor_left/top/right/bottom in 0…1 plus
 * pixel offsets); Unity's RectTransform presets are the same four numbers under other names.
 * It is a simulation of that arithmetic, not an engine layout pass. */
export const ANCHORS=Object.freeze({
 'top-left':[0,0,0,0],'top-center':[.5,0,.5,0],'top-right':[1,0,1,0],
 'center-left':[0,.5,0,.5],center:[.5,.5,.5,.5],'center-right':[1,.5,1,.5],
 'bottom-left':[0,1,0,1],'bottom-center':[.5,1,.5,1],'bottom-right':[1,1,1,1],
 'top-wide':[0,0,1,0],'bottom-wide':[0,1,1,1],'left-wide':[0,0,0,1],'right-wide':[1,0,1,1],
 'hcenter-wide':[.5,0,.5,1],'vcenter-wide':[0,.5,1,.5],'full-rect':[0,0,1,1]
});
const axis=(a0,a1,parent,size,margin)=>a0!==a1
 ? [a0*parent+margin,(a1-a0)*parent-margin*2]                 // stretched: parent span minus margins
 : [a0*(parent-size)+margin*(1-2*a0),size];                   // pinned: margin pushes away from that edge
/** Where a child of a given size lands inside a parent for one anchor preset. */
export function anchoredRect(preset,parent,child,margin=0){
 const a=ANCHORS[preset];if(!a)throw Error('Unknown anchor preset');
 const [x,w]=axis(a[0],a[2],parent.w,child.w,margin),[y,h]=axis(a[1],a[3],parent.h,child.h,margin);
 return {x:Math.round(x),y:Math.round(y),w:Math.max(0,Math.round(w)),h:Math.max(0,Math.round(h)),
  anchors:{left:a[0],top:a[1],right:a[2],bottom:a[3]},stretched:{x:a[0]!==a[2],y:a[1]!==a[3]}};
}
/** Broadcast-style safe areas. 90% title-safe / 93% action-safe is the long-published
 * television convention (see docs/UI-LAB.md for the sources); console and phone cut-outs are
 * device-specific, so those are custom insets rather than invented presets. */
export const SAFE_AREAS=Object.freeze([{id:'title-safe',percent:90},{id:'action-safe',percent:93},{id:'action-safe-95',percent:95}]);
export function safeRect(w,h,{percent=null,insets=null}={}){
 if(insets){const i={top:0,right:0,bottom:0,left:0,...insets};return {x:i.left,y:i.top,w:Math.max(0,w-i.left-i.right),h:Math.max(0,h-i.top-i.bottom)};}
 const p=Math.max(1,Math.min(100,Number(percent)||100))/100;
 const iw=Math.round(w*p),ih=Math.round(h*p);
 return {x:Math.round((w-iw)/2),y:Math.round((h-ih)/2),w:iw,h:ih};
}
export const SCREENS=Object.freeze([{id:'720p',w:1280,h:720},{id:'1080p',w:1920,h:1080},{id:'1440p',w:2560,h:1440},{id:'4k',w:3840,h:2160}]);
export const ASPECTS=Object.freeze([{id:'4:3',ratio:4/3},{id:'16:9',ratio:16/9},{id:'16:10',ratio:16/10},{id:'21:9',ratio:21/9}]);
/** Interface scales people actually pick. A non-integer scale of a pixel-art asset cannot map
 * source pixels onto whole screen pixels, which is what the blur in the comparison is. */
export const SCALES=Object.freeze([1,1.25,1.5,1.75,2,2.5,3]);
export const isCrisp=scale=>Number.isInteger(scale);
export const crispBelow=scale=>Math.max(1,Math.floor(scale));
/** Greedy line breaking over pre-measured chunks. A chunk is a word (with `space` width after
 * it) for spaced scripts, or a single character for Japanese and Korean text without spaces. */
export function wrap(chunks,boxWidth,{spaceWidth=0}={}){
 const lines=[];let line=[],width=0,widest=0;
 for(const chunk of chunks){
  const gap=line.length?(chunk.space??spaceWidth):0;
  if(line.length&&width+gap+chunk.width>boxWidth){lines.push({chunks:line,width});widest=Math.max(widest,width);line=[chunk];width=chunk.width;continue;}
  line.push(chunk);width+=gap+chunk.width;
 }
 if(line.length){lines.push({chunks:line,width});widest=Math.max(widest,width);}
 return {lines,width:widest,count:lines.length};
}
/** What a fixed-size button or panel does with a string: fits, wraps to more lines than it has
 * room for, or overflows on one line. The caller says which of those its UI actually allows. */
export function textFit({width,lineHeight,boxWidth,boxHeight,chunks=null,spaceWidth=0,mode='single'}){
 const pad=0;
 if(mode==='wrap'&&chunks){
  const w=wrap(chunks,boxWidth-pad,{spaceWidth}),needed=w.count*lineHeight;
  return {mode:'wrap',lines:w.count,width:Math.ceil(w.width),needed,fits:w.width<=boxWidth&&needed<=boxHeight,
   status:w.width>boxWidth?'overflow':needed>boxHeight?'clipped':w.count>1?'wrapped':'fits',overBy:Math.max(0,Math.ceil(w.width-boxWidth))};
 }
 const fits=width<=boxWidth&&lineHeight<=boxHeight;
 return {mode:'single',lines:1,width:Math.ceil(width),needed:lineHeight,fits,
  status:width>boxWidth?(mode==='truncate'?'truncated':'overflow'):lineHeight>boxHeight?'clipped':'fits',overBy:Math.max(0,Math.ceil(width-boxWidth))};
}
/** Merges rectangles whose gap is at most `distance` px, so a button and the glyph on top of it
 * become one element instead of two. Repeats until nothing merges: transitive by construction. */
export function mergeRects(rects,distance=0){
 const d=Math.max(0,Number(distance)||0);
 let list=rects.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,parts:r.parts??1}));
 for(let changed=true;changed;){
  changed=false;
  outer:for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const a=list[i],b=list[j];
   if(a.x-d>b.x+b.w||b.x-d>a.x+a.w||a.y-d>b.y+b.h||b.y-d>a.y+a.h)continue;
   const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
   list.splice(j,1);list[i]={x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y,parts:a.parts+b.parts};
   changed=true;break outer;
  }
 }
 return list.sort((a,b)=>a.y-b.y||a.x-b.x);
}
