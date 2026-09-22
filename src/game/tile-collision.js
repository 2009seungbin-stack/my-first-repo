/** Collision shapes for one tile, from its alpha. Pure: RGBA in, plain coordinates out.
 *
 * Three honest readings of the same pixels, because a 2D game wants different ones:
 *  box      one rectangle around everything that is not transparent — the cheap, common case;
 *  rects    a small set of axis-aligned rectangles that together cover exactly the solid pixels
 *           (runs merged downwards), for a tile with a hole or an L shape;
 *  outline  the real rectilinear boundary of the solid region, optionally simplified, for a slope
 *           or a curve. Engines treat each polygon handed to them as solid, so `tileCollision`
 *           returns only the outer loops here: a tile with a hole in it keeps the hole solid.
 *           `rects` represents such a tile exactly, and `traceOutline` still returns the hole
 *           loops (negative signed area) for a caller that can use even-odd filling.
 *
 * Coordinates are pixels inside the tile, origin top-left, y down — the same frame of reference
 * as `rect` in the export envelope. Engines that centre a tile's shape convert in their helper.
 *
 * The outline is traced along pixel edges; it is not a smoothed curve and is not claimed to be
 * one. `simplifyPath` is Ramer-Douglas-Peucker, so an epsilon above 0 trades exactness for
 * fewer points, and the number of points is reported either way.
 * (If `src/game/contour.js` later grows a shared tracer, this module should defer to it.) */
export const MODES=Object.freeze(['none','box','rects','outline']);
export const MAX_POINTS=256;
const isInt=v=>Number.isSafeInteger(v);
/** Solid/empty per pixel. `threshold` is the alpha a pixel must exceed to count as solid. */
export function alphaMask(data,w,h,threshold=0){
 if(!isInt(w)||!isInt(h)||w<1||h<1)throw Error('Invalid dimensions');
 if(data.length!==w*h*4)throw Error('Pixel limit exceeded or invalid RGBA data');
 const mask=new Uint8Array(w*h);
 for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>threshold?1:0;
 return mask;
}
export function solidCount(mask){let n=0;for(let i=0;i<mask.length;i++)n+=mask[i];return n;}
/** The one rectangle that contains every solid pixel, or null when nothing is solid. */
export function boundingBox(mask,w,h){
 let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
 }
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
/** Axis-aligned rectangles covering exactly the solid pixels: horizontal runs per row, extended
 * downwards while the run below has the same span. Never overlaps, never covers an empty pixel. */
export function rectCover(mask,w,h){
 const out=[];let open=[];
 for(let y=0;y<h;y++){
  const runs=[];
  for(let x=0;x<w;x++){
   if(!mask[y*w+x])continue;
   let end=x;while(end+1<w&&mask[y*w+end+1])end++;
   runs.push([x,end]);x=end;
  }
  const next=[];
  for(const run of runs){
   const carried=open.find(o=>!o.done&&o.x0===run[0]&&o.x1===run[1]);
   if(carried){carried.y1=y;carried.done=false;next.push(carried);}
   else next.push({x0:run[0],x1:run[1],y0:y,y1:y,done:false});
  }
  for(const o of open)if(!next.includes(o))out.push(o);
  open=next;
 }
 for(const o of open)out.push(o);
 return out.map(o=>({x:o.x0,y:o.y0,w:o.x1-o.x0+1,h:o.y1-o.y0+1}))
  .sort((a,b)=>a.y-b.y||a.x-b.x);
}
const key=(x,y)=>x*100003+y;
/** Rectilinear boundary loops of the solid region, clockwise for the outside of a shape and
 * counter-clockwise for a hole (y grows downwards). Collinear points are merged. */
export function traceOutline(mask,w,h){
 const edges=new Map();
 const add=(ax,ay,bx,by)=>{
  const k=key(ax,ay);if(!edges.has(k))edges.set(k,[]);
  edges.get(k).push([bx,by]);
 };
 const solid=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x]===1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!solid(x,y))continue;
  if(!solid(x,y-1))add(x,y,x+1,y);
  if(!solid(x+1,y))add(x+1,y,x+1,y+1);
  if(!solid(x,y+1))add(x+1,y+1,x,y+1);
  if(!solid(x-1,y))add(x,y+1,x,y);
 }
 const loops=[];
 for(const [start,ends] of edges){
  while(ends.length){
   const loop=[];
   let cx=Math.floor(start/100003),cy=start%100003;
   let [nx,ny]=ends.shift();
   loop.push([cx,cy]);
   for(let guard=0;guard<4*(w+1)*(h+1);guard++){
    loop.push([nx,ny]);
    if(nx===cx&&ny===cy)break;
    const list=edges.get(key(nx,ny));
    if(!list||!list.length)break;
    // At a pinch point (two solid pixels touching only at a corner) a vertex has two ways out.
    // Turning the way this loop already runs — clockwise on screen, so a positive cross product
    // with y growing downwards — keeps each loop closed instead of splicing them together.
    const from=[nx-loop[loop.length-2][0],ny-loop[loop.length-2][1]];
    let pick=0,best=-Infinity;
    list.forEach(([tx,ty],i)=>{
     const to=[tx-nx,ty-ny];
     const cross=from[0]*to[1]-from[1]*to[0],dot=from[0]*to[0]+from[1]*to[1];
     const turn=cross>0?2:cross<0?0:dot>0?1:-1;// with the loop, against it, straight, back
     if(turn>best){best=turn;pick=i;}
    });
    const [tx,ty]=list.splice(pick,1)[0];
    nx=tx;ny=ty;
   }
   if(loop.length>2&&loop[0][0]===loop[loop.length-1][0]&&loop[0][1]===loop[loop.length-1][1])loop.pop();
   if(loop.length>=4)loops.push(mergeCollinear(loop));
  }
 }
 return loops;
}
function mergeCollinear(points){
 const out=[];
 for(let i=0;i<points.length;i++){
  const a=points[(i-1+points.length)%points.length],b=points[i],c=points[(i+1)%points.length];
  if((b[0]-a[0])*(c[1]-b[1])===(b[1]-a[1])*(c[0]-b[0]))continue;
  out.push(b);
 }
 return out.length>=3?out:points;
}
/** Ramer-Douglas-Peucker on a closed loop. epsilon 0 returns the loop unchanged.
 * A closed loop has no ends to anchor the recursion on, so it is cut at the point farthest from
 * its centroid and again at the point farthest from that one — both are corners of any shape. */
export function simplifyPath(points,epsilon=0){
 if(epsilon<=0||points.length<4)return points;
 const far=(list,from)=>{
  let at=0,best=-1;
  list.forEach((p,i)=>{const d=(p[0]-from[0])**2+(p[1]-from[1])**2;if(d>best){best=d;at=i;}});
  return at;
 };
 const centre=[points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length];
 const start=far(points,centre),loop=[...points.slice(start),...points.slice(0,start)];
 const distance=(p,a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(!len)return Math.hypot(p[0]-a[0],p[1]-a[1]);
  return Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/len;
 };
 let split=far(loop,loop[0]);
 // The second anchor has to be an interior point, or one half of the loop is empty and the whole
 // loop collapses to the two anchors. The point farthest from the chord is the honest choice.
 if(split<=0||split>=loop.length-1){
  split=1;let best=-1;
  for(let i=1;i<loop.length-1;i++){const d=distance(loop[i],loop[0],loop[loop.length-1]);if(d>best){best=d;split=i;}}
 }
 const keep=new Uint8Array(loop.length);keep[0]=1;keep[split]=1;keep[loop.length-1]=1;
 const walk=(from,to)=>{
  let worst=-1,at=-1;
  for(let i=from+1;i<to;i++){const d=distance(loop[i],loop[from],loop[to]);if(d>worst){worst=d;at=i;}}
  if(worst>epsilon&&at>0){keep[at]=1;walk(from,at);walk(at,to);}
 };
 walk(0,split);walk(split,loop.length-1);
 const out=loop.filter((_,i)=>keep[i]);
 return out.length>=3?out:points;
}
/** Collision for one tile, in tile pixels. Returns [] when the tile has nothing solid in it.
 * `holes:'keep'` returns the hole loops too, for even-odd filling. */
export function tileCollision(data,w,h,{mode='box',threshold=0,epsilon=0,maxPoints=MAX_POINTS,holes='drop'}={}){
 if(!MODES.includes(mode))throw Error(`Unknown collision mode ${mode}`);
 if(mode==='none')return [];
 const mask=alphaMask(data,w,h,threshold),solid=solidCount(mask);
 if(!solid)return [];
 if(solid===w*h&&mode!=='outline')return [rectPoints({x:0,y:0,w,h})];
 if(mode==='box'){const box=boundingBox(mask,w,h);return box?[rectPoints(box)]:[];}
 if(mode==='rects')return rectCover(mask,w,h).map(rectPoints);
 const trace=()=>{const all=traceOutline(mask,w,h);return holes==='keep'?all:all.filter(l=>signedArea(l)>0);};
 let loops=trace();
 if(epsilon>0)loops=loops.map(l=>simplifyPath(l,epsilon));
 // Bounded by construction: raise the tolerance rather than hand an engine 4000 points, and if
 // the shape is genuinely that broken up (pixel dust, a checkerboard), keep the largest loops
 // that fit and fall back to the bounding box rather than return something unusable.
 const total=list=>list.reduce((n,l)=>n+l.length,0);
 let step=Math.max(epsilon,.5);
 while(total(loops)>maxPoints&&step<Math.max(w,h)){
  step*=2;loops=trace().map(l=>simplifyPath(l,step));
 }
 if(total(loops)>maxPoints){
  const kept=[];let n=0;
  for(const l of [...loops].sort((a,b)=>polygonArea(b)-polygonArea(a))){
   if(n+l.length>maxPoints)break;
   kept.push(l);n+=l.length;
  }
  loops=kept.length?kept:[rectPoints(boundingBox(mask,w,h))];
 }
 return loops;
}
const rectPoints=r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
/** Shoelace area. Positive is the outside of a shape and negative a hole, with y downwards. */
export const signedArea=points=>{
 let sum=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1];}
 return sum/2;
};
/** Area a polygon covers, for checking a shape against its pixels. */
export const polygonArea=points=>Math.abs(signedArea(points));
