import test from 'node:test';import assert from 'node:assert/strict';
import {alphaMask,solidCount,boundingBox,rectCover,traceOutline,simplifyPath,tileCollision,polygonArea,signedArea,MODES,MAX_POINTS}
 from '../src/game/tile-collision.js';

/** A tile from an ASCII picture: '#' is solid, '.' is transparent. */
function tile(rows){
 const h=rows.length,w=rows[0].length,data=new Uint8ClampedArray(w*h*4);
 rows.forEach((row,y)=>[...row].forEach((c,x)=>{
  const p=(y*w+x)*4;
  if(c==='#'){data[p]=200;data[p+1]=120;data[p+2]=60;data[p+3]=255;}
  else if(c==='+'){data[p+3]=40;} // faint: solid only below a raised threshold
 }));
 return {data,w,h};
}
const inside=(mask,w,h,points)=>{
 // Every solid pixel's centre must be inside at least one polygon, and no polygon may claim an
 // empty one. Tested with the crossing-number rule so the check is independent of the tracer.
 const hit=(px,py)=>points.some(poly=>{
  let on=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const [xi,yi]=poly[i],[xj,yj]=poly[j];
   if(yi>py!==yj>py&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)on=!on;
  }
  return on;
 });
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(hit(x+.5,y+.5)!==!!mask[y*w+x])return {x,y};
 return null;
};

test('an alpha mask is a threshold, and it says so',()=>{
 const t=tile(['#+.','.#+']);
 assert.deepEqual([...alphaMask(t.data,t.w,t.h)],[1,1,0,0,1,1]);
 assert.deepEqual([...alphaMask(t.data,t.w,t.h,64)],[1,0,0,0,1,0]);
 assert.equal(solidCount(alphaMask(t.data,t.w,t.h,64)),2);
 assert.throws(()=>alphaMask(new Uint8ClampedArray(4),2,2),/RGBA/);
 assert.throws(()=>alphaMask(t.data,0,2),/dimensions/);
 assert.deepEqual([...MODES],['none','box','rects','outline']);
});
test('the box is the bounding rectangle of what is not transparent',()=>{
 const t=tile(['....','.##.','.##.','....']);
 assert.deepEqual(boundingBox(alphaMask(t.data,t.w,t.h),4,4),{x:1,y:1,w:2,h:2});
 assert.deepEqual(tileCollision(t.data,4,4,{mode:'box'}),[[[1,1],[3,1],[3,3],[1,3]]]);
 assert.equal(boundingBox(alphaMask(tile(['..','..']).data,2,2),2,2),null);
 assert.deepEqual(tileCollision(tile(['..','..']).data,2,2,{mode:'box'}),[],'an empty tile gets no shape');
 assert.deepEqual(tileCollision(t.data,4,4,{mode:'none'}),[]);
 assert.throws(()=>tileCollision(t.data,4,4,{mode:'convex'}),/Unknown collision mode/);
});
test('a full tile is one rectangle over the whole tile',()=>{
 const t=tile(['##','##']);
 for(const mode of ['box','rects'])assert.deepEqual(tileCollision(t.data,2,2,{mode}),[[[0,0],[2,0],[2,2],[0,2]]],mode);
 assert.equal(polygonArea(tileCollision(t.data,2,2,{mode:'box'})[0]),4);
});
test('rectangles cover exactly the solid pixels, with runs merged downwards',()=>{
 // An L: three columns on top, one below.
 const t=tile(['###','#..','#..']);
 const rects=rectCover(alphaMask(t.data,3,3),3,3);
 assert.deepEqual(rects,[{x:0,y:0,w:3,h:1},{x:0,y:1,w:1,h:2}]);
 assert.equal(rects.reduce((n,r)=>n+r.w*r.h,0),solidCount(alphaMask(t.data,3,3)),'no overlap, no empty pixel');
 // A ring: the hole is simply not covered.
 const ring=tile(['###','#.#','###']);
 const cover=rectCover(alphaMask(ring.data,3,3),3,3);
 assert.equal(cover.reduce((n,r)=>n+r.w*r.h,0),8);
 assert(!inside(alphaMask(ring.data,3,3),3,3,cover.map(r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]])),'the hole stays empty');
});
test('the outline traces the real boundary, and a hole is its own loop',()=>{
 const ring=tile(['###','#.#','###']);
 const loops=traceOutline(alphaMask(ring.data,3,3),3,3);
 assert.equal(loops.length,2,JSON.stringify(loops));
 const areas=loops.map(polygonArea).sort((a,b)=>b-a);
 assert.deepEqual(areas,[9,1],'the outer square is 3x3 and the hole is 1x1');
 // The outer loop is the four corners of the tile, with collinear points merged away.
 const outer=loops.find(l=>polygonArea(l)===9);
 assert.equal(outer.length,4);
 assert.deepEqual([...outer].sort(),[[0,0],[0,3],[3,0],[3,3]].sort());
 // Orientation says which loop is the hole, and an engine that fills every polygon it is given
 // must not be handed the hole: outline mode returns the outer loop only.
 assert(signedArea(outer)>0&&signedArea(loops.find(l=>l!==outer))<0);
 assert.deepEqual(tileCollision(ring.data,3,3,{mode:'outline'}),[outer]);
 assert.equal(tileCollision(ring.data,3,3,{mode:'outline',holes:'keep'}).length,2);
 assert.equal(tileCollision(ring.data,3,3,{mode:'rects'}).length,4,'boxes represent the hole exactly');
 // A staircase keeps every step: 2 points per step plus the closing corner.
 const stair=tile(['#..','##.','###']);
 const steps=traceOutline(alphaMask(stair.data,3,3),3,3);
 assert.equal(steps.length,1);
 assert.equal(polygonArea(steps[0]),6);
 assert.equal(steps[0].length,8);
 assert.equal(inside(alphaMask(stair.data,3,3),3,3,steps),null,'the traced shape is exactly the solid pixels');
});
test('two pixels touching only at a corner stay two closed loops',()=>{
 const pinch=tile(['#.','.#']);
 const loops=traceOutline(alphaMask(pinch.data,2,2),2,2);
 assert.equal(loops.length,2,JSON.stringify(loops));
 assert.deepEqual(loops.map(polygonArea),[1,1]);
 assert.equal(inside(alphaMask(pinch.data,2,2),2,2,loops),null);
});
test('simplify trades exactness for points, and only when asked',()=>{
 // A 16px slope tile: the hypotenuse is a staircase, which is exactly what a physics body does
 // not need 34 points for.
 const rows=[];
 for(let y=0;y<16;y++)rows.push([...Array(16)].map((_,x)=>x<=y?'#':'.').join(''));
 const slope=tile(rows),mask=alphaMask(slope.data,16,16);
 const exact=traceOutline(mask,16,16);
 assert.equal(exact.length,1);
 assert.equal(exact[0].length,34,'every step of the staircase is a corner, plus the two right angles');
 assert.equal(simplifyPath(exact[0],0),exact[0],'epsilon 0 changes nothing');
 const few=simplifyPath(exact[0],1.5);
 assert(few.length<=5&&few.length>=3,`${few.length} of ${exact[0].length}`);
 assert(polygonArea(few)>polygonArea(exact[0])*.85,'a simplified slope still covers the slope');
 assert.equal(simplifyPath([[0,0],[1,0],[0,1]],2).length,3,'a triangle cannot be simplified away');
});
test('an outline is bounded: pixel dust never hands an engine thousands of points',()=>{
 // A checkerboard is the worst case: 512 one-pixel loops that no tolerance can merge.
 const rows=[];
 for(let y=0;y<32;y++)rows.push([...Array(32)].map((_,x)=>(x+y)%2===0?'#':'.').join(''));
 const dust=tile(rows);
 const raw=traceOutline(alphaMask(dust.data,32,32),32,32);
 assert.equal(raw.length,512);
 assert(raw.reduce((n,l)=>n+l.length,0)>MAX_POINTS,'this shape really is a hard case');
 const shapes=tileCollision(dust.data,32,32,{mode:'outline'});
 assert(shapes.reduce((n,l)=>n+l.length,0)<=MAX_POINTS,shapes.reduce((n,l)=>n+l.length,0));
 assert(shapes.length>=1);
 // A comb (solid on top, every other column below) is representable, so it stays exact.
 const comb=[];
 for(let y=0;y<32;y++)comb.push([...Array(32)].map((_,x)=>y<16||x%2===0?'#':'.').join(''));
 const teeth=tileCollision(tile(comb).data,32,32,{mode:'outline'});
 assert.equal(teeth.length,1);
 assert.equal(polygonArea(teeth[0]),32*16+16*16);
 assert.equal(inside(alphaMask(tile(comb).data,32,32),32,32,teeth),null);
 // A plain tile stays exact at the default settings.
 const plain=tile(['.##.','####','####','.##.']);
 const exact=tileCollision(plain.data,4,4,{mode:'outline'});
 assert.equal(exact.length,1);
 assert.equal(polygonArea(exact[0]),12);
 assert.equal(inside(alphaMask(plain.data,4,4),4,4,exact),null);
});
