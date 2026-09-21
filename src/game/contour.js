/** Collision shapes from alpha. Pure geometry: no DOM, no canvas.
 *
 * The silhouette is traced on the *pixel lattice*, not through pixel centres: for every opaque
 * pixel whose neighbour is transparent, the shared edge of the two is a directed boundary segment,
 * and following those segments gives a closed path along real pixel corners. That is the same
 * contour marching squares produces for a binary field, written as edge following so the result is
 * exact integer geometry with no interpolation — right for pixel art.
 *
 * Winding: an outer contour comes back **clockwise as drawn on screen** (y grows downward), which
 * is a positive shoelace sum under the usual Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ) formula; holes come back the
 * other way. Pass `winding:'ccw'` to get the reverse. Where two opaque pixels touch only at a
 * corner the boundary is ambiguous; the walk always takes the clockwise turn, which separates them
 * (4-connected regions) and is what keeps every polygon simple.
 *
 * Simplification is Ramer–Douglas–Peucker, run on the two halves of the closed ring so the start
 * point is not privileged. Tolerance rises until the vertex cap is met, and any tolerance that
 * makes the outline cross itself is rejected — a self-intersecting collision polygon is a bug in
 * every physics engine that takes one. */
import {source,maskOf,checkRect,ALPHA_THRESHOLD} from './pixels.js';
export const WINDINGS=Object.freeze(['cw','ccw']);
const EPS=1e-9;
/** Signed area × 2 (shoelace). Positive = clockwise on screen with y down. */
export function shoelace(points){
 let sum=0;
 for(let i=0;i<points.length;i++){const [x,y]=points[i],[nx,ny]=points[(i+1)%points.length];sum+=x*ny-nx*y;}
 return sum;
}
export const polygonArea=points=>Math.abs(shoelace(points))/2;
export const signedArea=points=>shoelace(points)/2;
/** Alpha silhouette of an image at a threshold. `threshold` is the last alpha value counted as
 * transparent, so 127 keeps everything at least half opaque. */
export function silhouette(img,{threshold=127}={}){return maskOf(img,{threshold});}
/** Grows a mask by `radius` whole pixels, in a canvas enlarged to fit the growth. 8-connectivity
 * grows diagonally (Chebyshev distance), 4-connectivity does not (Manhattan). */
export function dilateMask(mask,radius,{connectivity=8}={}){
 if(!Number.isSafeInteger(radius)||radius<0||radius>256)throw Error('Dilation radius must be 0…256 pixels');
 if(![4,8].includes(connectivity))throw Error('Connectivity is 4 or 8');
 if(!radius)return {...mask,offsetX:0,offsetY:0};
 const width=mask.width+radius*2,height=mask.height+radius*2,bits=new Uint8Array(width*height);
 const dist=new Int32Array(width*height).fill(-1),queue=new Int32Array(width*height);
 let back=0;
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.bits[y*mask.width+x]){
  const p=(y+radius)*width+x+radius;dist[p]=0;bits[p]=1;queue[back++]=p;}
 const steps=connectivity===8?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]];
 for(let front=0;front<back;front++){
  const p=queue[front],d=dist[p];if(d>=radius)continue;
  const x=p%width,y=(p-x)/width;
  for(const [dx,dy] of steps){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const n=ny*width+nx;if(dist[n]>=0)continue;
   dist[n]=d+1;bits[n]=1;queue[back++]=n;
  }
 }
 return {bits,width,height,offsetX:-radius,offsetY:-radius};
}
/** Every closed boundary of a mask, as integer pixel-corner polygons with collinear runs merged.
 * Outer rings have a positive shoelace, holes a negative one. */
export function traceBoundaries(mask){
 const {bits,width,height}=mask,inside=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&bits[y*width+x]===1;
 const stride=width+1,out=new Map();// vertex id -> [{to, dx, dy, used}]
 const add=(x,y,dx,dy)=>{const id=y*stride+x,list=out.get(id);const edge={x,y,dx,dy,used:false};if(list)list.push(edge);else out.set(id,[edge]);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(!inside(x,y))continue;
  if(!inside(x,y-1))add(x,y,1,0);
  if(!inside(x+1,y))add(x+1,y,0,1);
  if(!inside(x,y+1))add(x+1,y+1,-1,0);
  if(!inside(x-1,y))add(x,y+1,0,-1);
 }
 const rings=[];
 for(const [,list] of out)for(const start of list){
  if(start.used)continue;
  const path=[];let edge=start;
  while(edge&&!edge.used){
   edge.used=true;path.push([edge.x,edge.y]);
   const nx=edge.x+edge.dx,ny=edge.y+edge.dy,candidates=out.get(ny*stride+nx)||[];
   const prefer=[[-edge.dy,edge.dx],[edge.dx,edge.dy],[edge.dy,-edge.dx],[-edge.dx,-edge.dy]];
   let next=null;
   for(const [px,py] of prefer){next=candidates.find(c=>!c.used&&c.dx===px&&c.dy===py);if(next)break;}
   edge=next;
  }
  for(const loop of splitAtRepeats(path))if(loop.length>=3){const ring=dropCollinear(loop);if(ring.length>=3)rings.push(ring);}
 }
 return rings.map(points=>({points,signedArea:signedArea(points),area:polygonArea(points)}))
  .filter(r=>r.area>0).sort((a,b)=>b.area-a.area);
}
/** Where two regions touch only at a corner the walk passes through the same lattice point twice,
 * which would be a figure-eight — legal as a topological boundary, useless as a collision polygon.
 * Cutting the path at every repeated point turns it back into separate simple rings. This runs on
 * the full lattice path, before collinear runs are merged, so a point that a straight run merely
 * passes over is caught too. */
export function splitAtRepeats(path){
 const rings=[],seen=new Map(),stack=[];
 const key=p=>`${p[0]},${p[1]}`;
 for(const p of path){
  const k=key(p);
  if(seen.has(k)){
   const loop=stack.splice(seen.get(k));
   for(const q of loop)seen.delete(key(q));
   if(loop.length>=3)rings.push(loop);
  }
  seen.set(k,stack.length);stack.push(p);
 }
 if(stack.length>=3)rings.push(stack);
 return rings;
}
/** The trace can start in the middle of a straight run, which leaves one vertex sitting on a line
 * between its neighbours. Drop those so an untouched outline is already minimal. */
export function dropCollinear(points){
 let out=[...points];
 for(let pass=0;pass<2;pass++){
  const keep=out.filter((p,i)=>{
   const a=out[(i-1+out.length)%out.length],b=out[(i+1)%out.length];
   return Math.abs(cross(a[0],a[1],b[0],b[1],p[0],p[1]))>EPS;
  });
  if(keep.length<3||keep.length===out.length)return keep.length>=3?keep:out;
  out=keep;
 }
 return out;
}
export function pointInPolygon([px,py],points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [xi,yi]=points[i],[xj,yj]=points[j];
  if(yi>py!==yj>py&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
const cross=(ax,ay,bx,by,cx,cy)=>(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
const onSegment=(ax,ay,bx,by,px,py)=>Math.min(ax,bx)-EPS<=px&&px<=Math.max(ax,bx)+EPS&&Math.min(ay,by)-EPS<=py&&py<=Math.max(ay,by)+EPS;
/** True when segments a-b and c-d share any point, touching included. */
export function segmentsIntersect([ax,ay],[bx,by],[cx,cy],[dx,dy]){
 const d1=cross(cx,cy,dx,dy,ax,ay),d2=cross(cx,cy,dx,dy,bx,by),d3=cross(ax,ay,bx,by,cx,cy),d4=cross(ax,ay,bx,by,dx,dy);
 if(((d1>EPS&&d2<-EPS)||(d1<-EPS&&d2>EPS))&&((d3>EPS&&d4<-EPS)||(d3<-EPS&&d4>EPS)))return true;
 if(Math.abs(d1)<=EPS&&onSegment(cx,cy,dx,dy,ax,ay))return true;
 if(Math.abs(d2)<=EPS&&onSegment(cx,cy,dx,dy,bx,by))return true;
 if(Math.abs(d3)<=EPS&&onSegment(ax,ay,bx,by,cx,cy))return true;
 if(Math.abs(d4)<=EPS&&onSegment(ax,ay,bx,by,dx,dy))return true;
 return false;
}
/** No two non-adjacent edges of the ring may touch, and no vertex may repeat. */
export function isSimplePolygon(points){
 const n=points.length;
 if(n<3)return false;
 const seen=new Set();
 for(const [x,y] of points){const key=`${x},${y}`;if(seen.has(key))return false;seen.add(key);}
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
  if(j===i+1||(i===0&&j===n-1))continue;
  if(segmentsIntersect(points[i],points[(i+1)%n],points[j],points[(j+1)%n]))return false;
 }
 return true;
}
const pointSegmentDistance=([px,py],[ax,ay],[bx,by])=>{
 const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
 const t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;
 return Math.hypot(px-ax-t*dx,py-ay-t*dy);
};
export const distanceToPolygon=(point,points)=>{
 let best=Infinity;
 for(let i=0;i<points.length;i++)best=Math.min(best,pointSegmentDistance(point,points[i],points[(i+1)%points.length]));
 return best;
};
/** Ramer–Douglas–Peucker on an open polyline; the ends are always kept. */
export function simplifyPolyline(points,tolerance){
 if(points.length<3)return [...points];
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){
  const [from,to]=stack.pop();
  let worst=-1,at=-1;
  for(let i=from+1;i<to;i++){const d=pointSegmentDistance(points[i],points[from],points[to]);if(d>worst){worst=d;at=i;}}
  if(worst>tolerance&&at>0){keep[at]=1;stack.push([from,at],[at,to]);}
 }
 return points.filter((_,i)=>keep[i]);
}
/** RDP for a ring. The ring is cut at its two most distant points so the result does not depend on
 * where the trace happened to start. */
export function simplifyClosed(points,tolerance){
 if(points.length<=4||tolerance<=0)return [...points];
 const cx=points.reduce((s,p)=>s+p[0],0)/points.length,cy=points.reduce((s,p)=>s+p[1],0)/points.length;
 let a=0;for(let i=1;i<points.length;i++)if(Math.hypot(points[i][0]-cx,points[i][1]-cy)>Math.hypot(points[a][0]-cx,points[a][1]-cy))a=i;
 let b=a;for(let i=0;i<points.length;i++)if(Math.hypot(points[i][0]-points[a][0],points[i][1]-points[a][1])>Math.hypot(points[b][0]-points[a][0],points[b][1]-points[a][1]))b=i;
 if(a===b)return [...points];
 const ring=[...points.slice(a),...points.slice(0,a)],cut=(b-a+points.length)%points.length;
 const first=simplifyPolyline(ring.slice(0,cut+1),tolerance),second=simplifyPolyline([...ring.slice(cut),ring[0]],tolerance);
 const out=[...first.slice(0,-1),...second.slice(0,-1)];
 return out.length>=3?out:[...points];
}
/** Raises the tolerance until the ring fits `maxVertices`, and never returns a ring that crosses
 * itself: if a tolerance introduces a crossing it is skipped and a lower one is used. */
export function simplifyToCap(points,{tolerance=1,maxVertices=24,maxTolerance=128,step=1.25,maxIterations=64}={}){
 if(!(tolerance>0))return {points:[...points],tolerance:0,iterations:0,cappedAt:null,simple:isSimplePolygon(points)};
 if(!Number.isSafeInteger(maxVertices)||maxVertices<3)throw Error('maxVertices must be at least 3');
 let fallback=null,iterations=0;
 for(let i=0,t=tolerance;i<maxIterations&&t<=maxTolerance;i++,t*=step){
  iterations=i+1;
  const out=simplifyClosed(points,t);
  if(!isSimplePolygon(out)){if(out.length<=3)break;continue;}// this tolerance folds the outline over itself
  if(out.length<=maxVertices)return {points:out,tolerance:t,iterations,cappedAt:maxVertices,simple:true};
  if(!fallback||out.length<fallback.points.length)fallback={points:out,tolerance:t,iterations,simple:true};
  if(out.length<=3)break;
 }
 return fallback?{...fallback,cappedAt:maxVertices}:{points:[...points],tolerance:0,iterations,cappedAt:maxVertices,simple:isSimplePolygon(points)};
}
/** How far the simplified ring strays from the traced one, in pixels and in area. */
export function shapeError(original,simplified){
 let maxDeviation=0;
 for(const p of original)maxDeviation=Math.max(maxDeviation,distanceToPolygon(p,simplified));
 for(const p of simplified)maxDeviation=Math.max(maxDeviation,distanceToPolygon(p,original));
 const a=polygonArea(original),b=polygonArea(simplified);
 return {maxDeviation,areaOriginal:a,areaSimplified:b,areaDeltaPercent:a?Math.abs(b-a)/a*100:0};
}
/** Andrew's monotone chain. Returns the hull clockwise on screen (same winding as a traced outer
 * contour), starting at the leftmost-lowest point. */
export function convexHull(points){
 const pts=[...new Map(points.map(p=>[`${p[0]},${p[1]}`,p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 if(pts.length<3)return pts;
 const half=list=>{const out=[];for(const p of list){while(out.length>=2&&cross(out[out.length-2][0],out[out.length-2][1],out[out.length-1][0],out[out.length-1][1],p[0],p[1])<=0)out.pop();out.push(p);}return out;};
 const lower=half(pts),upper=half([...pts].reverse());
 const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];
 return shoelace(hull)<0?hull.reverse():hull;
}
/** Smallest enclosing circle. Exact (not a centroid-plus-max-radius approximation): the circle is
 * determined by two or three points of the convex hull, which is what this searches for. The hull
 * is taken first because the search is cubic in the number of candidate points. */
export function boundingCircle(input){
 if(!input.length)return null;
 const points=input.length>8?convexHull(input):input;
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const from2=(a,b)=>({cx:(a[0]+b[0])/2,cy:(a[1]+b[1])/2,r:dist(a,b)/2});
 const from3=(a,b,c)=>{
  const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));
  if(Math.abs(d)<EPS)return null;
  const ux=((a[0]**2+a[1]**2)*(b[1]-c[1])+(b[0]**2+b[1]**2)*(c[1]-a[1])+(c[0]**2+c[1]**2)*(a[1]-b[1]))/d;
  const uy=((a[0]**2+a[1]**2)*(c[0]-b[0])+(b[0]**2+b[1]**2)*(a[0]-c[0])+(c[0]**2+c[1]**2)*(b[0]-a[0]))/d;
  return {cx:ux,cy:uy,r:dist([ux,uy],a)};
 };
 const has=(c,p)=>!!c&&dist([c.cx,c.cy],p)<=c.r+1e-7;
 const trivial=set=>set.length===0?{cx:0,cy:0,r:0}:set.length===1?{cx:set[0][0],cy:set[0][1],r:0}:set.length===2?from2(set[0],set[1])
  :[from3(set[0],set[1],set[2]),from2(set[0],set[1]),from2(set[0],set[2]),from2(set[1],set[2])].filter(Boolean).filter(c=>set.every(p=>has(c,p))).sort((a,b)=>a.r-b.r)[0]||from2(set[0],set[1]);
 let circle=trivial(points.slice(0,1));
 for(let i=1;i<points.length;i++){
  if(has(circle,points[i]))continue;
  circle=trivial([points[i]]);
  for(let j=0;j<i;j++){
   if(has(circle,points[j]))continue;
   circle=from2(points[i],points[j]);
   for(let k=0;k<j;k++)if(!has(circle,points[k]))circle=trivial([points[i],points[j],points[k]]);
  }
 }
 return circle;
}
export function boundingRect(mask){
 let x0=mask.width,y0=mask.height,x1=-1,y1=-1;
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.bits[y*mask.width+x]){
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
export const rectPolygon=r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
/** Collision polygons for one image (a frame canvas, or any RGBA rectangle).
 * @param threshold    alpha at or below this is transparent (127 = at least half opaque counts)
 * @param padding      whole pixels of outward growth before tracing; coordinates may go negative
 * @param tolerance    starting RDP tolerance in pixels
 * @param maxVertices  hard cap per polygon; tolerance rises until it is met
 * @param holes        true also returns the inner rings of each polygon
 * @param shape        'polygon' (default), 'hull', 'rect' or 'circle'
 * @returns {polygons, error, winding, threshold, tolerance, simple, warnings} */
export function collisionPolygons(img,{threshold=127,padding=0,tolerance=1,maxVertices=24,holes=false,minArea=4,maxPolygons=8,winding='cw',connectivity=8,shape='polygon'}={}){
 if(!WINDINGS.includes(winding))throw Error(`Winding is ${WINDINGS.join(' or ')}`);
 if(!['polygon','hull','rect','circle'].includes(shape))throw Error(`Unknown collision shape ${shape}`);
 const mask=dilateMask(silhouette(img,{threshold}),padding,{connectivity});
 const shift=p=>[p[0]+(mask.offsetX||0),p[1]+(mask.offsetY||0)];
 const rect=boundingRect(mask),warnings=[];
 if(!rect)return {polygons:[],error:null,winding,threshold,tolerance:0,simple:true,warnings:['The image is fully transparent, so there is nothing to collide with.'],shape};
 // Outer rings get the requested winding; holes get the opposite one, which is how every engine
 // and every even-odd fill rule tells a hole from a shape.
 const orient=(points,wantCw)=>(shoelace(points)>0)===wantCw?points:[...points].reverse();
 const turn=points=>orient(points,winding==='cw'),turnHole=points=>orient(points,winding!=='cw');
 if(shape==='rect'){const r={x:rect.x+(mask.offsetX||0),y:rect.y+(mask.offsetY||0),w:rect.w,h:rect.h};
  return {polygons:[{points:turn(rectPolygon(r)),vertices:4,area:r.w*r.h,holes:[]}],rect:r,error:null,winding,threshold,tolerance:0,simple:true,warnings,shape};}
 const rings=traceBoundaries(mask);
 if(!rings.length)return {polygons:[],error:null,winding,threshold,tolerance:0,simple:true,warnings:['No boundary could be traced.'],shape};
 const outers=rings.filter(r=>r.signedArea>0&&r.area>=minArea),inners=rings.filter(r=>r.signedArea<0&&r.area>=minArea);
 if(rings.length>outers.length+inners.length)warnings.push(`${rings.length-outers.length-inners.length} speck(s) under ${minArea}px² were dropped.`);
 if(outers.length>maxPolygons)warnings.push(`${outers.length} separate shapes; only the ${maxPolygons} largest are returned.`);
 const kept=outers.slice(0,maxPolygons);
 if(shape==='circle'){
  const all=kept.flatMap(r=>r.points).map(shift),circle=boundingCircle(all);
  return {polygons:[],circle,error:null,winding,threshold,tolerance:0,simple:true,warnings,shape};
 }
 const polygons=[],errors=[];
 let simple=true,usedTolerance=0;
 for(const ring of kept){
  const traced=ring.points.map(shift);
  const base=shape==='hull'?convexHull(traced):traced;
  const fit=shape==='hull'?{points:base,tolerance:0,iterations:0,simple:isSimplePolygon(base)}:simplifyToCap(base,{tolerance,maxVertices});
  if(!fit.simple){simple=false;warnings.push('One outline could not be simplified without crossing itself; the traced outline is used instead.');}
  if(fit.points.length>maxVertices)warnings.push(`One outline needs ${fit.points.length} vertices to stay simple, above the cap of ${maxVertices}.`);
  usedTolerance=Math.max(usedTolerance,fit.tolerance);
  const error=shapeError(traced,fit.points);
  errors.push(error);
  polygons.push({points:turn(fit.points),vertices:fit.points.length,area:polygonArea(fit.points),tracedVertices:traced.length,
   tolerance:fit.tolerance,iterations:fit.iterations,error,
   holes:holes?inners.filter(h=>pointInPolygon(shift(h.points[0]),traced)).map(h=>turnHole(h.points.map(shift))):[]});
 }
 const error=errors.length?{maxDeviation:Math.max(...errors.map(e=>e.maxDeviation)),
  areaDeltaPercent:errors.reduce((s,e)=>s+e.areaOriginal*e.areaDeltaPercent,0)/Math.max(1,errors.reduce((s,e)=>s+e.areaOriginal,0)),
  areaOriginal:errors.reduce((s,e)=>s+e.areaOriginal,0),areaSimplified:errors.reduce((s,e)=>s+e.areaSimplified,0)}:null;
 return {polygons,error,winding,threshold,tolerance:usedTolerance,simple,warnings,shape,
  shapes:kept.length,vertices:polygons.reduce((s,p)=>s+p.vertices,0)};
}
/** The same, for one frame of the model: reads only that frame's rectangle and returns polygons in
 * frame-canvas pixels, ready for AssetFrame.collision. */
export function frameCollision(src,f,options={}){
 const s=source(src),inner=f.trimmedRect||f.sourceRect,img=s.read(checkRect(inner,s.width,s.height,'frame'));
 const out=collisionPolygons(img,options);
 const move=p=>[p[0]+f.offsetX,p[1]+f.offsetY];
 return {...out,polygons:out.polygons.map(p=>({...p,points:p.points.map(move),holes:p.holes.map(h=>h.map(move))})),
  circle:out.circle?{...out.circle,cx:out.circle.cx+f.offsetX,cy:out.circle.cy+f.offsetY}:undefined,
  rect:out.rect?{...out.rect,x:out.rect.x+f.offsetX,y:out.rect.y+f.offsetY}:undefined};
}
