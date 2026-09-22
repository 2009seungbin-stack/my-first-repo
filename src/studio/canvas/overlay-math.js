/** Hit-testing and direct-manipulation math for overlay shapes (rects, points, polygons, guides).
 * Pure: image-space numbers in, image-space numbers out. Tolerances are passed in image px, so the
 * caller converts "6 screen pixels" with `px / scale` once. */
export const HANDLES=Object.freeze(['nw','n','ne','e','se','s','sw','w']);
export const HANDLE_CURSORS=Object.freeze({nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',move:'move'});
export function handlePoints(r){
 const x0=r.x,y0=r.y,x1=r.x+r.w,y1=r.y+r.h,cx=r.x+r.w/2,cy=r.y+r.h/2;
 return {nw:[x0,y0],n:[cx,y0],ne:[x1,y0],e:[x1,cy],se:[x1,y1],s:[cx,y1],sw:[x0,y1],w:[x0,cy]};
}
/** Which resize handle (if any) is within `tol` of p. Corners win over edges on tiny rects. */
export function hitHandle(r,p,tol){
 const pts=handlePoints(r);let best=null,bd=Infinity;
 for(const h of HANDLES){const [x,y]=pts[h],d=Math.max(Math.abs(p.x-x),Math.abs(p.y-y));if(d<=tol&&(d<bd||d===bd&&h.length===2)){bd=d;best=h;}}
 return best;
}
export const hitRect=(r,p,tol=0)=>p.x>=r.x-tol&&p.y>=r.y-tol&&p.x<=r.x+r.w+tol&&p.y<=r.y+r.h+tol;
export const rectsIntersect=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
export const rectContains=(outer,inner)=>inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.w<=outer.x+outer.w&&inner.y+inner.h<=outer.y+outer.h;
/** Rect from two corner points, snapped to whole pixels, at least 1×1. */
export function rectFromPoints(a,b){
 const x0=Math.floor(Math.min(a.x,b.x)),y0=Math.floor(Math.min(a.y,b.y)),x1=Math.ceil(Math.max(a.x,b.x)),y1=Math.ceil(Math.max(a.y,b.y));
 return {x:x0,y:y0,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0)};
}
/** Result of dragging `handle` ('move' or a HANDLES name) of `start` by (dx, dy) image px.
 * Snaps to whole pixels, keeps w/h ≥ min, and keeps the rect inside `bounds` when given —
 * moving slides along the edge, resizing stops at it, so the opposite edge never moves. */
export function dragRect(start,handle,dx,dy,{min=1,bounds=null,snap=true}={}){
 const q=v=>snap?Math.round(v):v;dx=q(dx);dy=q(dy);
 if(handle==='move'){
  let x=start.x+dx,y=start.y+dy;
  if(bounds){x=Math.min(Math.max(bounds.x,x),bounds.x+bounds.w-start.w);y=Math.min(Math.max(bounds.y,y),bounds.y+bounds.h-start.h);}
  return {x,y,w:start.w,h:start.h};
 }
 let x0=start.x,y0=start.y,x1=start.x+start.w,y1=start.y+start.h;
 if(handle.includes('w'))x0=Math.min(x0+dx,x1-min);
 if(handle.includes('e'))x1=Math.max(x1+dx,x0+min);
 if(handle.includes('n'))y0=Math.min(y0+dy,y1-min);
 if(handle.includes('s'))y1=Math.max(y1+dy,y0+min);
 if(bounds){x0=Math.max(bounds.x,x0);y0=Math.max(bounds.y,y0);x1=Math.min(bounds.x+bounds.w,x1);y1=Math.min(bounds.y+bounds.h,y1);}
 return {x:x0,y:y0,w:Math.max(min,x1-x0),h:Math.max(min,y1-y0)};
}
/** Moves several rects by one shared delta, clamped so that none leaves `bounds`. */
export function moveRects(rects,dx,dy,bounds=null){
 dx=Math.round(dx);dy=Math.round(dy);
 if(bounds&&rects.length){
  const minX=Math.min(...rects.map(r=>r.x)),minY=Math.min(...rects.map(r=>r.y)),maxX=Math.max(...rects.map(r=>r.x+r.w)),maxY=Math.max(...rects.map(r=>r.y+r.h));
  dx=Math.min(Math.max(dx,bounds.x-minX),bounds.x+bounds.w-maxX);dy=Math.min(Math.max(dy,bounds.y-minY),bounds.y+bounds.h-maxY);
 }
 return {dx,dy,rects:rects.map(r=>({...r,x:r.x+dx,y:r.y+dy}))};
}
export function pointInPolygon(pts,p){
 let inside=false;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>p.y)!==(yj>p.y)&&p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi)inside=!inside;}
 return inside;
}
export function distToSegment(p,a,b){
 const vx=b[0]-a[0],vy=b[1]-a[1],len=vx*vx+vy*vy,t=len?Math.max(0,Math.min(1,((p.x-a[0])*vx+(p.y-a[1])*vy)/len)):0;
 return Math.hypot(p.x-(a[0]+t*vx),p.y-(a[1]+t*vy));
}
/** {part:'vertex'|'edge'|'inside', index} or null. Vertices beat edges beat the interior. */
export function hitPolygon(pts,p,tol){
 for(let i=0;i<pts.length;i++)if(Math.max(Math.abs(pts[i][0]-p.x),Math.abs(pts[i][1]-p.y))<=tol)return {part:'vertex',index:i};
 for(let i=0;i<pts.length;i++)if(distToSegment(p,pts[i],pts[(i+1)%pts.length])<=tol)return {part:'edge',index:i};
 return pointInPolygon(pts,p)?{part:'inside',index:-1}:null;
}
export const hitPoint=(pt,p,tol)=>Math.max(Math.abs(pt.x-p.x),Math.abs(pt.y-p.y))<=tol;
/** Guide {axis:'x'|'y', pos}: a vertical line at x=pos or a horizontal one at y=pos. */
export const hitGuide=(g,p,tol)=>Math.abs((g.axis==='x'?p.x:p.y)-g.pos)<=tol;
export function bounds(items){
 if(!items.length)return null;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const r of items){x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.h);}
 return {x:x0,y:y0,w:x1-x0,h:y1-y0};
}
/** Uniform-grid spatial index over rect-like items {x,y,w,h}: O(visible) culling and O(1)-ish
 * point queries, so 10 000 frame boxes pan and hover as fast as 10. Rebuild on change (O(n)). */
export class RectIndex{
 constructor(items=[],cell=0){
  this.items=items;
  const b=bounds(items);
  // A cell about four typical items wide keeps buckets short without exploding their count.
  const typical=items.length?Math.max(1,items.reduce((s,r)=>s+Math.max(r.w,r.h),0)/items.length):64;
  this.cell=cell||Math.max(8,Math.round(typical*2));this.buckets=new Map();this.b=b;
  items.forEach((r,i)=>{for(const k of this.keys(r))(this.buckets.get(k)||this.buckets.set(k,[]).get(k)).push(i);});
 }
 *keys(r){
  const c=this.cell,cx0=Math.floor(r.x/c),cy0=Math.floor(r.y/c),cx1=Math.floor((r.x+Math.max(r.w,0))/c),cy1=Math.floor((r.y+Math.max(r.h,0))/c);
  for(let y=cy0;y<=cy1;y++)for(let x=cx0;x<=cx1;x++)yield x+','+y;
 }
 /** Indices of items intersecting `rect` (or touching it, with `pad`), ascending. */
 query(rect,pad=0){
  if(!this.items.length)return [];
  const r={x:rect.x-pad,y:rect.y-pad,w:rect.w+2*pad,h:rect.h+2*pad},c=this.cell;
  const span=(Math.floor((r.x+r.w)/c)-Math.floor(r.x/c)+1)*(Math.floor((r.y+r.h)/c)-Math.floor(r.y/c)+1);
  if(span>this.buckets.size){// the rect covers more cells than exist: a scan is cheaper
   const out=[];this.items.forEach((it,i)=>{if(it.x<=r.x+r.w&&r.x<=it.x+it.w&&it.y<=r.y+r.h&&r.y<=it.y+it.h)out.push(i);});return out;
  }
  const seen=new Set();
  for(const k of this.keys(r))for(const i of this.buckets.get(k)||[]){const it=this.items[i];if(it.x<=r.x+r.w&&r.x<=it.x+it.w&&it.y<=r.y+r.h&&r.y<=it.y+it.h)seen.add(i);}
  return [...seen].sort((a,b)=>a-b);
 }
 at(p,tol=0){return this.query({x:p.x,y:p.y,w:0,h:0},tol);}
}
