import test from 'node:test';import assert from 'node:assert/strict';
import {detectGrid,axisProfile,axisSizes,tileRects,sliceMetadata,tileName,cropRGBA,rectHash,hashRGBA,isBlank,
 tileDifference,duplicateGroups,nearDuplicateGroups,transformRGBA,variantSet,COMMON_SIZES,MAX_TILES} from '../src/game/tile-grid.js';

/** Deterministic tile sheets. Each tile gets its own base colour plus per-pixel noise, so tile
 * interiors are busy (like real art) and the seams between tiles are the strong transitions. */
function sheet({tileW=32,tileH=32,cols=4,rows=4,margin=0,spacing=0,noise=10,blank=[],flat=false,seed=7,trailing=null}={}){
 const t=trailing===null?margin:trailing;
 const w=margin+cols*tileW+(cols-1)*spacing+t,h=margin+rows*tileH+(rows-1)*spacing+t;
 const data=new Uint8ClampedArray(w*h*4);
 let s=seed;const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const index=row*cols+col;if(blank.includes(index))continue;
  const base=[40+((index*61)%200),30+((index*103)%210),50+((index*167)%190)];
  const x0=margin+col*(tileW+spacing),y0=margin+row*(tileH+spacing);
  for(let y=0;y<tileH;y++)for(let x=0;x<tileW;x++){
   const p=((y0+y)*w+x0+x)*4,n=flat?0:Math.round((rnd()-.5)*2*noise);
   data[p]=base[0]+n;data[p+1]=base[1]+n;data[p+2]=base[2]+n;data[p+3]=255;
  }
 }
 return {data,w,h,tileW,tileH,cols,rows,margin,spacing};
}
const best=s=>detectGrid(s.data,s.w,s.h)[0];
const shape=c=>[c.tileWidth,c.tileHeight,c.marginX,c.marginY,c.spacingX,c.spacingY,c.cols,c.rows];

test('a plain sheet is detected at its own tile size',()=>{
 const s=sheet({tileW:32,tileH:32,cols:4,rows:4});
 assert.deepEqual(shape(best(s)),[32,32,0,0,0,0,4,4]);
});
test('margin 1 and spacing 2 are found, not just the size that divides',()=>{
 const s=sheet({tileW:16,tileH:16,cols:4,rows:3,margin:1,spacing:2});
 assert.deepEqual([s.w,s.h],[72,54]);
 const top=best(s);
 assert.deepEqual(shape(top),[16,16,1,1,2,2,4,3]);
 assert.equal(top.evidence.separators,1,'every reserved line really is blank');
 assert(top.score>.9,String(top.score));
 // The no-margin sizes that do divide 72 must all rank below it.
 const ranked=detectGrid(s.data,s.w,s.h,{limit:12});
 const naive=ranked.find(c=>!c.marginX&&!c.spacingX&&c.tileWidth===8);
 assert(!naive||naive.score<top.score-.2,'an exact divisor without evidence must not tie');
});
test('a size several candidates divide is resolved by where the edges repeat',()=>{
 // 128×128 with real 32px tiles: 8, 16, 32 and 64 all divide it exactly.
 const s=sheet({tileW:32,tileH:32,cols:4,rows:4});
 for(const size of [8,16,32,64])assert.equal(128%size,0);
 const ranked=detectGrid(s.data,s.w,s.h,{limit:12});
 assert.deepEqual(shape(ranked[0]),[32,32,0,0,0,0,4,4]);
 const score=size=>ranked.find(c=>c.tileWidth===size&&c.tileHeight===size&&!c.marginX&&!c.spacingX)?.score??0;
 assert(score(32)>score(64)+.1,`32 (${score(32)}) must beat 64 (${score(64)})`);
 assert(score(32)>score(16)+.1,`32 (${score(32)}) must beat 16 (${score(16)})`);
 assert(score(32)>score(8)+.1,`32 (${score(32)}) must beat 8 (${score(8)})`);
 // The evidence is reported, not hidden: half the period explains only some strong edges.
 assert(ranked[0].evidence.strongEdgesExplained>.9);
});
test('non-square tiles and an odd sheet size are detected too',()=>{
 assert.deepEqual(shape(best(sheet({tileW:16,tileH:32,cols:5,rows:2}))),[16,32,0,0,0,0,5,2]);
 const odd=sheet({tileW:15,tileH:15,cols:7,rows:4});
 assert.deepEqual([odd.w,odd.h],[105,60]);
 assert(axisSizes(105).includes(15));
 assert.deepEqual(shape(best(odd)),[15,15,0,0,0,0,7,4]);
});
test('blank tiles do not move the grid and every candidate carries its numbers',()=>{
 const s=sheet({tileW:32,tileH:32,cols:4,rows:4,blank:[1,2,6,11,15]});
 const top=best(s);assert.deepEqual(shape(top),[32,32,0,0,0,0,4,4]);
 for(const c of detectGrid(s.data,s.w,s.h)){
  assert(c.score>=0&&c.score<=1);assert(c.count===c.cols*c.rows);
  for(const key of ['separators','repeatedEdges','boundaryEdges','strongEdgesExplained','contentStops'])assert(key in c.evidence,key);
 }
 assert.equal(detectGrid(s.data,s.w,s.h,{limit:3}).length,3);
});
test('a line profile reports blank, flat and strong lines honestly',()=>{
 const s=sheet({tileW:8,tileH:8,cols:2,rows:1,margin:1,spacing:2,flat:true});
 const p=axisProfile(s.data,s.w,s.h,'x');
 assert.equal(p.len,s.w);
 assert.equal(p.clear[0],1);assert.equal(p.clear[9],1,'the spacing column is blank');
 assert.equal(p.uniform[3],0,'a tile column is not flat over the whole sheet: the margin row is blank');
 // The same sheet without a margin: now a flat tile really is a flat column.
 const tight=sheet({tileW:8,tileH:8,cols:2,rows:1,spacing:2,flat:true});
 const q=axisProfile(tight.data,tight.w,tight.h,'x');
 assert.equal(q.uniform[3],1);assert.equal(q.clear[8],1);
 assert(p.strongLines.includes(1)&&p.strongLines.includes(9),p.strongLines.join(','));
 assert.throws(()=>axisProfile(new Uint8ClampedArray(8),2,2,'x'),/RGBA/);
});
test('tile rectangles are exact and refuse a grid that does not fit',()=>{
 const g=tileRects({width:72,height:54,tileWidth:16,tileHeight:16,marginX:1,marginY:1,spacingX:2,spacingY:2});
 assert.deepEqual([g.cols,g.rows,g.count],[4,3,12]);
 assert.deepEqual(g.rects[0],{index:0,col:0,row:0,x:1,y:1,w:16,h:16});
 assert.deepEqual(g.rects[5],{index:5,col:1,row:1,x:19,y:19,w:16,h:16});
 assert.deepEqual(g.rects[11],{index:11,col:3,row:2,x:55,y:37,w:16,h:16});
 assert(g.rects.every(r=>r.x+r.w<=72&&r.y+r.h<=54));
 assert.throws(()=>tileRects({width:10,height:10,tileWidth:16,tileHeight:16}),/No tile fits/);
 assert.throws(()=>tileRects({width:64,height:64,tileWidth:16,tileHeight:16,cols:5}),/does not fit/);
 assert.throws(()=>tileRects({width:64,height:64,tileWidth:0,tileHeight:16}),/tileWidth/);
 assert.throws(()=>tileRects({width:128,height:64,tileWidth:1,tileHeight:1}),new RegExp(`${MAX_TILES} tiles`));
 assert.equal(tileName(7,12),'tile-007');assert.equal(tileName(7,4096),'tile-0007');
});
test('slice metadata says exactly where each tile came from',()=>{
 const g=tileRects({width:72,height:54,tileWidth:16,tileHeight:16,marginX:1,marginY:1,spacingX:2,spacingY:2});
 const meta=sliceMetadata(g,{image:'terrain.png',width:72,height:54});
 assert.deepEqual(meta.meta,{tool:'nerulio-tile-lab',toolVersion:'1',schemaVersion:1,engineTarget:'generic',image:'terrain.png',size:{w:72,h:54}});
 assert.deepEqual(meta.tileSet,{tileSize:{w:16,h:16},margins:{x:1,y:1},separation:{x:2,y:2},columns:4,rows:3,count:12});
 assert.equal(Object.keys(meta.frames).length,12);
 const f=meta.frames['tile-005.png'];
 assert.deepEqual(f.rect,{x:19,y:19,w:16,h:16});assert.deepEqual(f.tile,{index:5,col:1,row:1});
 assert.deepEqual([f.page,f.rotated,f.aliasOf,f.duration],[0,false,null,null]);
 for(const [name,frame] of Object.entries(meta.frames)){
  const own=g.rects[frame.tile.index];
  assert.deepEqual(frame.rect,{x:own.x,y:own.y,w:own.w,h:own.h},name);
 }
});
test('a sliced tile equals its source region byte for byte',()=>{
 const s=sheet({tileW:16,tileH:16,cols:3,rows:2,margin:1,spacing:2});
 const g=tileRects({width:s.w,height:s.h,tileWidth:16,tileHeight:16,marginX:1,marginY:1,spacingX:2,spacingY:2});
 for(const r of g.rects){
  const tile=cropRGBA(s.data,s.w,s.h,r);
  assert.equal(tile.length,16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)for(let k=0;k<4;k++)
   assert.equal(tile[(y*16+x)*4+k],s.data[((r.y+y)*s.w+r.x+x)*4+k],`${r.index} ${x},${y},${k}`);
  assert.equal(rectHash(s.data,s.w,s.h,r),hashRGBA(tile));
 }
 assert.throws(()=>cropRGBA(s.data,s.w,s.h,{x:s.w-2,y:0,w:16,h:16}),/outside/);
});
test('blank tiles, exact duplicates and near duplicates are separated',()=>{
 const s=sheet({tileW:16,tileH:16,cols:4,rows:1,blank:[3]});
 const g=tileRects({width:s.w,height:s.h,tileWidth:16,tileHeight:16});
 const tiles=g.rects.map(r=>cropRGBA(s.data,s.w,s.h,r));
 assert.deepEqual(g.rects.map(r=>isBlank(s.data,s.w,s.h,r)),[false,false,false,true]);
 // Tile 2 copied over tile 0 is an exact duplicate; one changed pixel makes it only near-exact.
 const copies=[tiles[0],tiles[1],new Uint8ClampedArray(tiles[0]),new Uint8ClampedArray(tiles[0])];
 copies[3][40]=(copies[3][40]+9)%256;
 assert.deepEqual(duplicateGroups(copies.map(hashRGBA)),[[0,2]]);
 const near=nearDuplicateGroups(copies,{maxMean:2,maxPixel:32});
 assert.deepEqual(near.map(g=>g.indices),[[0,2,3]]);
 assert.equal(duplicateGroups(copies.map(hashRGBA)).length,1);
 const d=tileDifference(copies[0],copies[3]);
 assert.equal(d.pixels,256);assert(d.mean>0&&d.mean<1);assert(d.max>=9);
 assert.deepEqual(tileDifference(tiles[0],tiles[0]),{mean:0,max:0,pixels:256});
 assert.throws(()=>tileDifference(tiles[0],new Uint8ClampedArray(4)),/same size/);
});
test('rotations and flips are exact and symmetric variants are dropped',()=>{
 const w=3,h=2,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++)data.set([i*20,0,0,255],i*4);
 const r90=transformRGBA(data,w,h,'rot90');
 assert.deepEqual([r90.w,r90.h],[2,3]);
 assert.equal(r90.data[(0*2+1)*4],0,'the top-left pixel moves to the top-right');
 assert.equal(r90.data[(0*2+0)*4],60,'the bottom-left pixel moves to the top-left');
 const back=transformRGBA(transformRGBA(r90.data,2,3,'rot90').data,3,2,'rot180');
 assert.deepEqual([...back.data],[...data],'four quarter turns are the identity');
 assert.deepEqual([...transformRGBA(data,w,h,'flipX').data].slice(0,4),[40,0,0,255]);
 assert.equal(variantSet(data,w,h).length,5,'an asymmetric tile has five distinct variants');
 // A tile that is symmetric under every transform produces none.
 const flatTile=new Uint8ClampedArray(4*4*4).fill(200);
 assert.equal(variantSet(flatTile,4,4).length,0);
 const mirrored=new Uint8ClampedArray(4*4*4);
 for(let y=0;y<4;y++)for(let x=0;x<4;x++)mirrored.set([y*50,0,0,255],(y*4+x)*4);
 assert.deepEqual(variantSet(mirrored,4,4).map(v=>v.kind),['rot90','rot180','rot270']);
 assert.throws(()=>transformRGBA(data,w,h,'shear'),/Unknown variant/);
 assert(COMMON_SIZES.includes(16));
});
