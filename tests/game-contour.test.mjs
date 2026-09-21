import test from 'node:test';import assert from 'node:assert/strict';
import {collisionPolygons,frameCollision,traceBoundaries,silhouette,dilateMask,simplifyClosed,simplifyPolyline,simplifyToCap,shapeError,convexHull,boundingCircle,boundingRect,rectPolygon,isSimplePolygon,segmentsIntersect,pointInPolygon,polygonArea,signedArea,shoelace,dropCollinear,distanceToPolygon,WINDINGS} from '../src/game/contour.js';
import {framesFromRects} from '../src/game/frame-ops.js';
import {canvas,box,disc,blit,stack,walker,blobWithHole,disconnectedSprite,rand} from './game-fixtures.mjs';
const closed=p=>p.length>=3&&isSimplePolygon(p);
const ringOf=img=>traceBoundaries(silhouette(img))[0].points;

test('a rectangle traces to its four corners, clockwise on screen, with a positive shoelace',()=>{
 const img=canvas(20,20);box(img,4,6,8,10,[0,0,0,255]);
 const rings=traceBoundaries(silhouette(img));
 assert.equal(rings.length,1);
 assert.deepEqual(rings[0].points,[[4,6],[12,6],[12,16],[4,16]],'pixel corners, not pixel centres');
 assert(rings[0].signedArea>0,'an outer contour is clockwise on screen (positive shoelace)');
 assert.equal(rings[0].area,80,'and its area is exactly the 8×10 pixels it covers');
 assert.equal(shoelace([[0,0],[1,0],[1,1],[0,1]]),2);
 assert.equal(signedArea([[0,0],[1,0],[1,1],[0,1]]),1);
 assert.equal(polygonArea([[0,0],[1,0],[1,1],[0,1]]),1);
 const out=collisionPolygons(img,{tolerance:0});
 assert.deepEqual(out.polygons[0].points,[[4,6],[12,6],[12,16],[4,16]]);
 assert.deepEqual(collisionPolygons(img,{tolerance:0,winding:'ccw'}).polygons[0].points,[[4,16],[12,16],[12,6],[4,6]]);
 assert.deepEqual(WINDINGS,['cw','ccw']);
 assert.throws(()=>collisionPolygons(img,{winding:'anticlockwise'}),/Winding is/);
});
test('a hole is traced with the opposite winding and only when asked for',()=>{
 const img=blobWithHole(48);
 const plain=collisionPolygons(img,{tolerance:1.5});
 assert.equal(plain.polygons[0].holes.length,0);
 const withHoles=collisionPolygons(img,{tolerance:1.5,holes:true});
 assert.equal(withHoles.polygons.length,1);
 assert.equal(withHoles.polygons[0].holes.length,1);
 assert(shoelace(withHoles.polygons[0].points)>0&&shoelace(withHoles.polygons[0].holes[0])<0,'outer clockwise, hole counter-clockwise');
 assert(closed(withHoles.polygons[0].holes[0]));
 const inner=withHoles.polygons[0].holes[0];
 assert(inner.every(([x,y])=>Math.hypot(x-24,y-24)<9),'the hole sits where the fixture put it');
});
test('disconnected body parts come back as separate polygons, largest first',()=>{
 const img=disconnectedSprite();
 const out=collisionPolygons(img,{tolerance:1,maxVertices:16});
 assert.equal(out.shapes,6,'head, torso, two arms, two legs');
 assert.deepEqual(out.polygons.map(p=>p.area).every((a,i,arr)=>!i||arr[i-1]>=a),true,'largest first');
 for(const p of out.polygons)assert(closed(p.points),'every polygon is closed and simple');
 const capped=collisionPolygons(img,{maxPolygons:2});
 assert.equal(capped.polygons.length,2);
 assert(capped.warnings.some(w=>/only the 2 largest/.test(w)),JSON.stringify(capped.warnings));
});
test('outward padding grows the outline by whole pixels and may go negative',()=>{
 const img=canvas(20,20);box(img,0,0,4,4,[0,0,0,255]);
 const grown=collisionPolygons(img,{tolerance:0,padding:2,connectivity:4});
 const xs=grown.polygons[0].points.map(p=>p[0]),ys=grown.polygons[0].points.map(p=>p[1]);
 assert.equal(Math.min(...xs),-2,'padding runs outside the canvas and says so in the coordinates');
 assert.equal(Math.max(...xs),6);assert.equal(Math.min(...ys),-2);
 assert(grown.polygons[0].points.length>8,`4-connectivity bevels the corners into a staircase (${grown.polygons[0].points.length} vertices)`);
 assert(closed(grown.polygons[0].points));
 const square=collisionPolygons(img,{tolerance:0,padding:2,connectivity:8});
 assert.deepEqual(square.polygons[0].points,[[-2,-2],[6,-2],[6,6],[-2,6]],'8-connectivity keeps it square');
 assert.throws(()=>dilateMask(silhouette(img),2,{connectivity:6}),/Connectivity is 4 or 8/);
 assert.throws(()=>dilateMask(silhouette(img),-1),/0…256/);
});
test('simplification honours the vertex cap and reports the shape error it cost',()=>{
 const img=canvas(64,64);disc(img,32,32,28,[0,0,0,255]);
 const traced=ringOf(img);
 assert(traced.length>40,`a 28px disc traces to many steps (${traced.length})`);
 for(const cap of [8,12,16,24,32]){
  const out=collisionPolygons(img,{tolerance:.5,maxVertices:cap});
  const p=out.polygons[0];
  assert(p.vertices<=cap,`${p.vertices} vertices is within the cap of ${cap}`);
  assert(closed(p.points),`the ${cap}-vertex outline is simple`);
  assert(out.error.maxDeviation<=Math.max(4,64/cap),`deviation ${out.error.maxDeviation.toFixed(2)}px at cap ${cap}`);
  assert(out.error.areaDeltaPercent<14,`area within 14% at cap ${cap} (${out.error.areaDeltaPercent.toFixed(1)}%)`);
 }
 const tight=collisionPolygons(img,{tolerance:.5,maxVertices:32}),loose=collisionPolygons(img,{tolerance:.5,maxVertices:8});
 assert(tight.error.maxDeviation<loose.error.maxDeviation,'a bigger cap is a closer fit');
 assert(tight.polygons[0].vertices>loose.polygons[0].vertices);
 assert.throws(()=>simplifyToCap(traced,{maxVertices:2}),/at least 3/);
});
test('no returned polygon ever crosses itself, over many random blobs',()=>{
 const r=rand(21);let checked=0;
 for(let trial=0;trial<40;trial++){
  const img=canvas(56,56);
  for(let k=0;k<4+Math.floor(r()*5);k++)disc(img,6+r()*44,6+r()*44,3+r()*11,[0,0,0,255]);
  for(const cap of [6,10,16]){
   const out=collisionPolygons(img,{tolerance:.5,maxVertices:cap,holes:true});
   for(const p of out.polygons){
    assert(isSimplePolygon(p.points),`trial ${trial} cap ${cap}: outline crosses itself\n${JSON.stringify(p.points)}`);
    for(const h of p.holes)assert(isSimplePolygon(h),`trial ${trial}: hole crosses itself`);
    checked++;
   }
  }
 }
 assert(checked>100,`enough polygons were checked (${checked})`);
});
test('the segment-intersection test that proves it is itself correct',()=>{
 assert.equal(segmentsIntersect([0,0],[10,10],[0,10],[10,0]),true,'a clean crossing');
 assert.equal(segmentsIntersect([0,0],[10,0],[0,1],[10,1]),false,'parallel');
 assert.equal(segmentsIntersect([0,0],[10,0],[5,0],[15,0]),true,'collinear overlap counts');
 assert.equal(segmentsIntersect([0,0],[10,0],[10,0],[10,10]),true,'a shared endpoint counts');
 assert.equal(segmentsIntersect([0,0],[4,0],[5,0],[9,0]),false,'collinear but apart');
 assert.equal(isSimplePolygon([[0,0],[10,0],[10,10],[0,10]]),true);
 assert.equal(isSimplePolygon([[0,0],[10,10],[10,0],[0,10]]),false,'a bow tie is not simple');
 assert.equal(isSimplePolygon([[0,0],[10,0],[0,0],[5,10]]),false,'a repeated vertex is not simple');
 assert.equal(isSimplePolygon([[0,0],[1,1]]),false);
 assert.equal(pointInPolygon([5,5],[[0,0],[10,0],[10,10],[0,10]]),true);
 assert.equal(pointInPolygon([15,5],[[0,0],[10,0],[10,10],[0,10]]),false);
 assert.equal(distanceToPolygon([5,-3],[[0,0],[10,0],[10,10],[0,10]]),3);
});
test('RDP keeps the ends, drops what is within tolerance, and is start-independent for a ring',()=>{
 assert.deepEqual(simplifyPolyline([[0,0],[5,.4],[10,0]],1),[[0,0],[10,0]]);
 assert.deepEqual(simplifyPolyline([[0,0],[5,4],[10,0]],1),[[0,0],[5,4],[10,0]]);
 assert.deepEqual(simplifyPolyline([[0,0],[1,1]],1),[[0,0],[1,1]]);
 const ring=[[0,0],[5,0],[10,0],[10,5],[10,10],[5,10],[0,10],[0,5]];
 assert.deepEqual(simplifyClosed(ring,1).length,4,'a square with midpoints simplifies to four corners');
 const rotated=[...ring.slice(3),...ring.slice(0,3)];
 assert.deepEqual(new Set(simplifyClosed(rotated,1).map(p=>p.join())),new Set(simplifyClosed(ring,1).map(p=>p.join())),'where the trace started does not change the answer');
 assert.deepEqual(dropCollinear(ring),[[0,0],[10,0],[10,10],[0,10]]);
 assert.deepEqual(dropCollinear([[0,0],[5,0],[10,0]]).length,3,'a degenerate ring is left alone');
 const err=shapeError(ring,simplifyClosed(ring,1));
 assert.equal(err.maxDeviation,0,'those midpoints were on the line, so nothing was lost');
 assert.equal(err.areaDeltaPercent,0);
});
test('hull, rect and circle fallbacks are exact, not eyeballed',()=>{
 const img=canvas(40,40);box(img,4,4,10,10,[0,0,0,255]);box(img,26,26,10,10,[0,0,0,255]);
 const hull=collisionPolygons(img,{shape:'hull'});
 assert.equal(hull.polygons.length,2,'a hull per shape, not one hull over both');
 assert(hull.polygons.every(p=>p.vertices===4));
 assert.deepEqual(convexHull([[0,0],[10,0],[10,10],[0,10],[5,5]]),[[0,0],[10,0],[10,10],[0,10]],'interior points are dropped');
 assert(shoelace(convexHull([[0,0],[10,0],[10,10],[0,10]]))>0,'the hull has the same winding as an outer contour');
 const rect=collisionPolygons(img,{shape:'rect'});
 assert.deepEqual(rect.rect,{x:4,y:4,w:32,h:32});
 assert.deepEqual(rect.polygons[0].points,rectPolygon(rect.rect));
 assert.deepEqual(boundingRect(silhouette(img)),{x:4,y:4,w:32,h:32});
 const circle=collisionPolygons(img,{shape:'circle'});
 assert.equal(+circle.circle.cx.toFixed(6),20);assert.equal(+circle.circle.cy.toFixed(6),20);
 assert.equal(+circle.circle.r.toFixed(6),+Math.hypot(16,16).toFixed(6),'the two far corners define it');
 const three=boundingCircle([[0,0],[10,0],[5,9]]);
 assert(three.r>=5&&[[0,0],[10,0],[5,9]].every(p=>Math.hypot(p[0]-three.cx,p[1]-three.cy)<=three.r+1e-6));
 assert.equal(boundingCircle([]),null);
 assert.deepEqual(boundingCircle([[3,4]]),{cx:3,cy:4,r:0});
 assert.throws(()=>collisionPolygons(img,{shape:'capsule'}),/Unknown collision shape/);
});
test('a transparent image and the alpha threshold are handled honestly',()=>{
 const blank=collisionPolygons(canvas(16,16));
 assert.deepEqual(blank.polygons,[]);assert(blank.warnings.some(w=>/fully transparent/.test(w)));
 const faded=canvas(16,16);
 for(let y=4;y<12;y++)for(let x=4;x<12;x++)faded.data.set([0,0,0,100],(y*16+x)*4);
 assert.deepEqual(collisionPolygons(faded,{threshold:127}).polygons,[],'half-transparent pixels do not collide by default');
 assert.equal(collisionPolygons(faded,{threshold:64,tolerance:0}).polygons[0].area,64,'lower the threshold and they do');
 const speck=canvas(16,16);box(speck,1,1,1,1,[0,0,0,255]);
 assert.deepEqual(collisionPolygons(speck,{minArea:4}).polygons,[]);
 assert(collisionPolygons(speck,{minArea:4}).warnings.some(w=>/speck/.test(w)));
});
test('frameCollision returns polygons in frame-canvas pixels for a real frame',()=>{
 const img=canvas(32,48);disc(img,16,20,10,[20,30,40,255]);
 const {sheet,rects}=stack([img]);
 const {frames}=framesFromRects(sheet,rects,{trim:true});
 const f=frames[0];
 const out=frameCollision(sheet,f,{tolerance:1,maxVertices:12});
 assert.equal(out.polygons.length,1);
 assert(out.polygons[0].vertices<=12&&closed(out.polygons[0].points));
 const xs=out.polygons[0].points.map(p=>p[0]),ys=out.polygons[0].points.map(p=>p[1]);
 assert(Math.min(...xs)>=f.offsetX-1&&Math.max(...xs)<=f.offsetX+f.trimmedRect.w+1,`x within the frame canvas (${Math.min(...xs)}…${Math.max(...xs)})`);
 assert(Math.min(...ys)>=f.offsetY-1&&Math.max(...ys)<=f.offsetY+f.trimmedRect.h+1);
 assert(ys.some(y=>y>0),'and it is placed at the frame offset, not at the origin');
 const asRect=frameCollision(sheet,f,{shape:'rect'});
 assert.deepEqual(asRect.rect,{x:f.offsetX,y:f.offsetY,w:f.trimmedRect.w,h:f.trimmedRect.h});
});
