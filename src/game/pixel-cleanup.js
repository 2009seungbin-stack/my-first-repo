/** Pixel-art cleanup on an INDEXED frame: stray pixels, tiny clusters, enclosed holes, anti-alias
 * transition pixels and outline problems. Pure — no DOM.
 *
 * Everything is reported as CANDIDATES first (a list of {at,from,to} pixel changes) and applied
 * only when the caller asks, which is what makes preview, apply and undo the same small data:
 * a change list of the pixels that actually differ, never a copy of the image.
 * An index of -1 means "transparent" and is never written over unless a hole fix says so. */
import {oklab} from '../pixel-engine.js';
const NEIGHBOURS4=[[1,0],[-1,0],[0,1],[0,-1]];
const NEIGHBOURS8=[...NEIGHBOURS4,[1,1],[1,-1],[-1,1],[-1,-1]];
function frameView(f){
 if(!f||!(f.indices instanceof Int16Array)||!Number.isSafeInteger(f.width)||!Number.isSafeInteger(f.height)||f.indices.length!==f.width*f.height)throw Error('Needs {indices,width,height} for one frame');
 return f;
}
const majority=counts=>{let best=-1,n=0;for(const [k,v] of counts)if(v>n||v===n&&k<best){best=k;n=v;}return {index:best,count:n};};
/** One 4-connected component scan over equal indices. Components of transparency are included so
 * holes and clusters come from the same pass. */
export function components(frame,{connectivity=4}={}){
 const {indices,width:w,height:h}=frameView(frame),seen=new Int32Array(indices.length).fill(-1),out=[],steps=connectivity===8?NEIGHBOURS8:NEIGHBOURS4,stack=new Int32Array(indices.length);
 for(let start=0;start<indices.length;start++){
  if(seen[start]>=0)continue;
  const value=indices[start],id=out.length,border=new Map();let top=0,area=0,touchesEdge=false,minX=w,minY=h,maxX=-1,maxY=-1;
  stack[top++]=start;seen[start]=id;
  while(top){
   const at=stack[--top],x=at%w,y=(at-x)/w;area++;
   if(x===0||y===0||x===w-1||y===h-1)touchesEdge=true;
   if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
   for(const [dx,dy] of steps){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const to=ny*w+nx;
    if(indices[to]===value){if(seen[to]<0){seen[to]=id;stack[top++]=to;}}
    else border.set(indices[to],(border.get(indices[to])||0)+1);
   }
  }
  out.push({id,index:value,area,border,touchesEdge,rect:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},seed:start});
 }
 return {list:out,labels:seen};
}
const changeList=(frame,ids,labels,to)=>{
 const wanted=new Map(ids.map((id,i)=>[id,to[i]])),changes=[];
 for(let at=0;at<labels.length;at++){const target=wanted.get(labels[at]);if(target!==undefined&&target!==frame.indices[at])changes.push({at,from:frame.indices[at],to:target});}
 return changes;
};
/** Stray single pixels, clusters below `minArea`, and enclosed transparent holes up to `maxHole`.
 * Each group carries its own change list so the UI can preview and apply them independently. */
export function detect(frame,{minArea=4,maxHole=1,connectivity=4}={}){
 const {list,labels}=components(frame,{connectivity}),groups={orphans:[],clusters:[],holes:[]};
 const pick=[[],[]],hole=[[],[]],tiny=[[],[]];
 for(const c of list){
  if(c.index<0){
   // A hole is transparency that never reaches the image edge and is ringed by opaque pixels.
   if(c.area>maxHole||c.touchesEdge)continue;
   const solid=[...c.border].filter(([k])=>k>=0);if(!solid.length)continue;
   const fill=majority(solid).index;hole[0].push(c.id);hole[1].push(fill);groups.holes.push({...c,fill});
   continue;
  }
  const solid=[...c.border].filter(([k])=>k>=0);if(!solid.length)continue;
  const to=majority(solid).index;
  if(c.area===1){pick[0].push(c.id);pick[1].push(to);groups.orphans.push({...c,fill:to});}
  else if(c.area<minArea){tiny[0].push(c.id);tiny[1].push(to);groups.clusters.push({...c,fill:to});}
 }
 return {
  orphans:{items:groups.orphans,changes:changeList(frame,pick[0],labels,pick[1])},
  clusters:{items:groups.clusters,changes:changeList(frame,tiny[0],labels,tiny[1])},
  holes:{items:groups.holes,changes:changeList(frame,hole[0],labels,hole[1])}
 };
}
export function applyChanges(indices,changes){
 const out=Int16Array.from(indices);for(const c of changes)out[c.at]=c.to;return out;
}
export const revertChanges=(indices,changes)=>{const out=Int16Array.from(indices);for(const c of changes)out[c.at]=c.from;return out;};
const squared=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const segmentDistance=(p,a,b)=>{
 const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],len=ab[0]**2+ab[1]**2+ab[2]**2;
 if(len<1e-12)return Math.hypot(p[0]-a[0],p[1]-a[1],p[2]-a[2]);
 const t=Math.max(0,Math.min(1,((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1]+(p[2]-a[2])*ab[2])/len));
 return Math.hypot(p[0]-a[0]-ab[0]*t,p[1]-a[1]-ab[1]*t,p[2]-a[2]-ab[2]*t);
};
/** Anti-alias remover. An anti-aliased edge pixel is not simply "off palette": it sits BETWEEN two
 * palette colours that meet along that edge. So a pixel whose colour is not in the palette is
 * snapped to the nearer end of the closest neighbour pair whose segment it lies on (within
 * `threshold` in Oklab), and only falls back to the globally nearest palette entry when it has no
 * two distinct palette-exact neighbours. Deciding from the ORIGINAL pixels (not progressively
 * rewritten ones) keeps the result independent of scan order.
 * Alpha is only touched when `alphaCut` is given, and then only by rounding it to 0 or 255. */
export function removeAntiAlias(source,colors,{threshold=.08,alphaCut=null,connectivity=8}={}){
 const {data,width:w,height:h}=source,steps=connectivity===8?NEIGHBOURS8:NEIGHBOURS4;
 if(!colors?.length)throw Error('Anti-alias removal needs the target palette');
 const key=new Map(colors.map((c,i)=>[c[0]<<16|c[1]<<8|c[2],i])),labs=colors.map(c=>oklab(...c));
 const exact=new Int16Array(w*h).fill(-1),indices=new Int16Array(w*h).fill(-1),alpha=new Uint8ClampedArray(w*h);
 let alphaSnapped=0;
 for(let p=0;p<w*h;p++){
  const i=p*4;alpha[p]=alphaCut==null?data[i+3]:data[i+3]>=alphaCut?255:0;
  if(alpha[p]!==data[i+3])alphaSnapped++;
  if(alpha[p])exact[p]=key.get(data[i]<<16|data[i+1]<<8|data[i+2])??-1;
 }
 let transition=0,nearest=0,offPalette=0;
 for(let p=0;p<w*h;p++){
  if(!alpha[p])continue;
  if(exact[p]>=0){indices[p]=exact[p];continue;}
  offPalette++;
  const i=p*4,lab=oklab(data[i],data[i+1],data[i+2]),x=p%w,y=(p-x)/w,around=new Set();
  for(const [dx,dy] of steps){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const k=exact[ny*w+nx];if(k>=0)around.add(k);}
  const pool=[...around];let pair=null,bestDistance=Infinity;
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++){
   const d=segmentDistance(lab,labs[pool[a]],labs[pool[b]]);if(d<bestDistance){bestDistance=d;pair=[pool[a],pool[b]];}
  }
  if(pair&&bestDistance<=threshold){indices[p]=squared(lab,labs[pair[0]])<=squared(lab,labs[pair[1]])?pair[0]:pair[1];transition++;continue;}
  let fallback=0,d=Infinity;
  for(let k=0;k<labs.length;k++){const e=squared(lab,labs[k]);if(e<d){d=e;fallback=k;}}
  indices[p]=fallback;nearest++;
 }
 return {indices,alpha,width:w,height:h,transition,nearest,offPalette,alphaSnapped};
}
/** Outline audit. `outline` is the palette index treated as the outline colour (usually the
 * darkest entry, or one the user picked). Nothing is fixed here; the lists are candidates.
 *  gap        — a silhouette-border pixel that is NOT the outline colour, so the outline is open
 *  doubled    — a straight outline edge that is 2 px or more thick inward
 *  thickness  — the measurements themselves, so "1 px outline" is a number and not an impression
 * Thickness is measured only where exactly one of the four neighbours is outside the silhouette,
 * i.e. on straight edges: at a corner two directions point outward and the thickness a person
 * would name is ambiguous, so corners are skipped rather than guessed. */
export function outlineAudit(frame,outline){
 const {indices,width:w,height:h}=frameView(frame);
 if(!Number.isInteger(outline)||outline<0)throw Error('Pick the outline colour first');
 const inside=(x,y)=>x>=0&&y>=0&&x<w&&y<h;
 const isOutline=(x,y)=>inside(x,y)&&indices[y*w+x]===outline;
 const exterior=(x,y)=>!inside(x,y)||indices[y*w+x]<0;
 const measured=new Map(),gaps=[],doubled=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x;if(indices[p]<0)continue;
  const open=NEIGHBOURS4.filter(([dx,dy])=>exterior(x+dx,y+dy));
  if(indices[p]!==outline){if(open.length)gaps.push({at:p,x,y,from:indices[p]});continue;}
  if(open.length!==1)continue;
  const [dx,dy]=open[0];let n=0;while(isOutline(x-dx*n,y-dy*n))n++;
  measured.set(n,(measured.get(n)||0)+1);
  if(n>1)doubled.push({at:p,x,y,thickness:n});
 }
 const lengths=[...measured.keys()].sort((a,b)=>a-b),top=[...measured].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]??0;
 return {gaps,doubled,measured,thickness:{min:lengths[0]??0,max:lengths[lengths.length-1]??0,dominant:top,consistent:lengths.length<=1},
  // Conservative auto-fix: close the outline where it is open; never thin an outline, because
  // removing a doubled pixel moves the silhouette by a pixel.
  gapFix:gaps.map(g=>({at:g.at,from:g.from,to:outline}))};
}
/** How many distinct RGB values a frame really holds, and how many of them are in the palette. */
export function colorCensus(source,colors=[]){
 const {data}=source,seen=new Map(),inPalette=new Set(colors.map(c=>c[0]<<16|c[1]<<8|c[2]));
 let opaque=0,partial=0;
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;opaque++;if(data[i+3]<255)partial++;
  const k=data[i]<<16|data[i+1]<<8|data[i+2];seen.set(k,(seen.get(k)||0)+1);
 }
 const off=[...seen.keys()].filter(k=>!inPalette.has(k));
 return {distinct:seen.size,opaque,partial,offPalette:off.length,offPalettePixels:off.reduce((n,k)=>n+seen.get(k),0)};
}
