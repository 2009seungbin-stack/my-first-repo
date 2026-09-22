/** Engine trust checks on real published CC0 game assets (tests/fixtures/game/cc0, see LICENSE.md)
 * plus the synthetic cases that isolate one rule each. Ground truth comes from the packs' own
 * Tilesheet.txt / spritesheetInfo.txt or a hand count (tools/eval-game-engines.json). */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodePNG} from '../src/game/texture-png.js';
import {labelIslands,labelIslandsAsync} from '../src/game/islands.js';
import {detectFrames,attachSmallIslands,autoVersusGrid,autoMergeDistance} from '../src/game/frame-ops.js';
import {detectColorKey,applyColorKey,keyedSource} from '../src/game/color-key.js';
import {detectGrid,detectGridWithColour} from '../src/game/grid-detect.js';
import {detectGrid as detectTileGrid,autoApply,suggestedGrid,contentStats} from '../src/game/tile-grid.js';
import {LAYOUTS} from '../src/game/autotile.js';
import {inspect,estimateResample,nearestScale} from '../src/game/pixel-check.js';
import {detectFontGrid,CP437} from '../src/game/font-grid.js';
import {classifyTextureName,normalConvention} from '../src/game/texture-set.js';
import {canvas,box,disc,put} from './game-fixtures.mjs';

const fixture=async name=>{
 const png=await decodePNG(new Uint8Array(await readFile(new URL(`./fixtures/game/cc0/${name}`,import.meta.url))));
 return {data:new Uint8ClampedArray(png.data.buffer,png.data.byteOffset,png.data.byteLength),width:png.width,height:png.height};
};
/** Every opaque pixel is inside a frame rectangle or inside a reported unassigned island. */
function unaccounted(img,found,threshold=8){
 const {data,width,height}=img,cover=new Uint8Array(width*height);
 for(const r of found.rects)for(let y=r.y;y<r.y+r.h;y++)cover.fill(1,y*width+r.x,y*width+r.x+r.w);
 for(const r of found.unassigned)for(let y=r.y;y<r.y+r.h;y++)cover.fill(1,y*width+r.x,y*width+r.x+r.w);
 let lost=0;for(let p=0;p<width*height;p++)if(data[p*4+3]>threshold&&!cover[p])lost++;
 return lost;
}
/** Bilinear resize (pixel centres aligned, edges clamped), as image editors do it. */
function bilinear(img,W,H){
 const out=canvas(W,H),sx=img.width/W,sy=img.height/H;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const fx=Math.max(0,(x+.5)*sx-.5),fy=Math.max(0,(y+.5)*sy-.5),x0=Math.min(img.width-1,Math.floor(fx)),y0=Math.min(img.height-1,Math.floor(fy));
  const x1=Math.min(img.width-1,x0+1),y1=Math.min(img.height-1,y0+1),tx=fx-x0,ty=fy-y0;
  for(let k=0;k<4;k++){const a=img.data[(y0*img.width+x0)*4+k],b=img.data[(y0*img.width+x1)*4+k],c=img.data[(y1*img.width+x0)*4+k],d=img.data[(y1*img.width+x1)*4+k];
   out.data[(y*W+x)*4+k]=Math.round((a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty);}
 }
 return out;
}
const crop=(img,x,y,w,h)=>{const out=canvas(w,h);for(let j=0;j<h;j++)out.data.set(img.data.subarray(((y+j)*img.width+x)*4,((y+j)*img.width+x+w)*4),j*w*4);return out;};

// ---- B1: no silent loss of small islands ---------------------------------------------------
test('B1: sparks and slash pixels are attached to a frame or reported — never dropped',()=>{
 // 4 characters in 32px cells; a 2×2 spark and three single FX pixels in two of the cells.
 const img=canvas(128,32),C=[40,80,200,255],FX=[255,214,90,255];
 for(let i=0;i<4;i++)box(img,i*32+11,6,10,24,C);
 box(img,32+3,10,2,2,FX);for(let k=0;k<3;k++)put(img,96+28,4+k*3,FX);
 put(img,64+1,1,FX);// a stray pixel equidistant-ish from nothing useful: must be reported
 const found=detectFrames(img,{minArea:16});
 assert.equal(found.rects.length,4,'the four characters');
 assert.equal(unaccounted(img,found),0,'every opaque pixel is in a frame or listed');
 assert.equal(found.smallCount,5);
 assert.equal(found.attached.length+found.unassigned.length,5);
 assert.equal(found.unassignedPixels,found.unassigned.reduce((s,i)=>s+i.area,0));
});
test('B1 on real art: Super Sprite Boy keeps all of its detached hair and shine pixels',async()=>{
 const img=await fixture('oga-super-sprite-boy-32px.png');
 const found=detectFrames(img,{minArea:16});
 assert.equal(found.rects.length,30,'30 frames, as published');
 assert.equal(unaccounted(img,found),0);
 assert(found.attached.length>0,'the small islands were attached, not dropped');
});
test('small islands next to two frames at once are reported instead of guessed',()=>{
 const rects=[{x:0,y:0,w:10,h:10,area:100},{x:20,y:0,w:10,h:10,area:100}];
 const out=attachSmallIslands(rects,[{x:14,y:4,w:2,h:2,area:4},{x:11,y:4,w:1,h:1,area:1}]);
 assert.equal(out.unassigned.length,1,'the one in the middle is ambiguous');
 assert.equal(out.attached.length,1,'the one touching the left frame joins it');
 assert.equal(out.rects[0].w,12);
});
// ---- B7: large sheets ------------------------------------------------------------------------
test('B7: a 4096² sheet is labelled band by band in a few seconds, with nothing lost',async()=>{
 const W=4096,img=canvas(W,W),C=[200,90,40,255];
 let frames=0;
 for(let y=0;y+60<=W;y+=64)for(let x=0;x+60<=W;x+=64){box(img,x+8,y+4,40,52,C);if(frames%9===0)put(img,x+1,y+1,C);frames++;}
 const t0=performance.now(),found=detectFrames(img,{minArea:16}),dt=performance.now()-t0;
 assert.equal(found.rects.length,frames);
 assert(dt<8000,`took ${Math.round(dt)} ms`);
 assert.equal(found.smallCount,Math.ceil(frames/9));
 assert.equal(found.attached.length+found.unassigned.length,found.smallCount);
 // The async form gives the same islands and yields between bands.
 let pauses=0;const again=await labelIslandsAsync(crop(img,0,0,1024,1024),{minArea:16,pause:async()=>{pauses++;}});
 assert.equal(again.islands.length,labelIslands(crop(img,0,0,1024,1024),{minArea:16}).islands.length);
 assert(pauses>0);
});
test('island labelling does not depend on the band height',()=>{
 const img=canvas(64,64);disc(img,20,20,9,[1,2,3,255]);box(img,40,5,3,50,[9,9,9,255]);put(img,60,60,[9,9,9,255]);
 const a=labelIslands(img,{minArea:4}),b=labelIslands(img,{minArea:4,bandPixels:64});
 assert.deepEqual(a,b);assert.equal(a.islands.length,2);assert.equal(a.smallCount,1);
});
test('Auto never swallows a whole sheet of separate islands into one frame',async()=>{
 const img=await fixture('oga-sumo-hulk-x4-64px.png');
 const found=detectFrames(img,{minArea:16});
 assert(found.rects.length>1,'not "1 frame"');
 // The frames touch, so islands cannot give 36; the grid can, and Auto says so.
 const grid=detectGrid(img,{limit:3}).suggestions[0];
 assert.deepEqual([grid.cellWidth,grid.cellHeight],[64,64]);
 const hint=autoVersusGrid(found.rects,grid);
 assert(hint.recommend);assert.equal(hint.gridFrames,36);
});
test('the Auto reason always has a code the UI can word (no "until px")',()=>{
 assert.equal(autoMergeDistance([{x:0,y:0,w:4,h:4,area:16}]).reasonCode,'single');
 const apart=autoMergeDistance([{x:0,y:0,w:4,h:4,area:16},{x:90,y:0,w:9,h:30,area:270}]);
 assert.equal(apart.reasonCode,'apart');assert.equal(apart.until,16);
});
// ---- B2/B3: colour keys, margin and spacing --------------------------------------------------
test('B2/B3: a magenta sheet with a 2px margin and 1px spacing is keyed and gridded exactly',()=>{
 const K=[255,0,255,255],img=canvas(2*2+8*32+7,2*2+4*32+3,K);
 for(let r=0;r<4;r++)for(let c=0;c<8;c++){const x=2+c*33,y=2+r*33;box(img,x,y,32,32,K);box(img,x+9,y+5,12,24,[40,90,200,255]);disc(img,x+15,y+8,4,[240,200,160,255]);}
 const key=detectColorKey(img);
 assert.deepEqual(key.color,[255,0,255]);assert.equal(key.confidence,'high');assert(key.apply);
 const keyed=applyColorKey(img,key.color,{tolerance:key.tolerance});
 const best=detectGrid(keyed).suggestions[0];
 assert.deepEqual([best.cellWidth,best.cellHeight,best.marginX,best.marginY,best.spacingX,best.spacingY],[32,32,2,2,1,1]);
 assert.equal(detectFrames(keyed,{minArea:16}).rects.length,32);
 // The lazy form reads the same pixels.
 const lazy=keyedSource(img,key.color);
 assert.deepEqual(lazy.read({x:0,y:0,w:10,h:1}).data,keyed.data.subarray(0,40));
});
test('B2 on real art: Kenney roguelike dungeon, magenta, 16px + 1px spacing',async()=>{
 const img=await fixture('kenney-roguelike-dungeon-magenta-16px-s1.png');
 const key=detectColorKey(img);
 assert.deepEqual(key.color,[255,0,255]);assert.equal(key.confidence,'high');
 assert(key.evidence.fullLines>=4,'the spacing lines are key-coloured');
 const best=detectGrid(applyColorKey(img,key.color)).suggestions[0];
 assert.deepEqual([best.cellWidth,best.cellHeight,best.spacingX,best.spacingY,best.marginX],[16,16,1,1,0]);
});
test('a sheet that already uses alpha, and an opaque texture, get no key applied',async()=>{
 const alpha=await fixture('kenney-micro-roguelike-8px-s1.png');
 assert.notEqual(detectColorKey(alpha)?.confidence,'high');
 const noise=canvas(64,64);for(let i=0;i<noise.data.length;i+=4)noise.data.set([(i*7)%255,(i*13)%255,(i*3)%255,255],i);
 assert.equal(detectColorKey(noise)?.apply??false,false);
});
test('opaque packed tiles: the colour-transition detector fills in for alpha',async()=>{
 const img=await fixture('kenney-tiny-dungeon-packed-16px.png');
 const best=detectGridWithColour(img).suggestions[0];
 assert.deepEqual([best.cellWidth,best.cellHeight],[16,16]);
});
// ---- B10: tile grids --------------------------------------------------------------------------
function blobSheet(size){
 const l=LAYOUTS.blob47,img=canvas(8*size,6*size),rim=Math.max(1,Math.round(size/8));
 for(const s of l.slots){const x=s.col*size,y=s.row*size;box(img,x,y,size,size,[86,160,70,255]);
  const R=[52,96,44,255];if(!s.edges.n)box(img,x,y,size,rim,R);if(!s.edges.s)box(img,x,y+size-rim,size,rim,R);if(!s.edges.w)box(img,x,y,rim,size,R);if(!s.edges.e)box(img,x+size-rim,y,rim,size,R);}
 return img;
}
test('B10: a 16px blob-47 sheet reads as 16×16, and a low-confidence guess is never applied',()=>{
 const img=blobSheet(16),list=detectTileGrid(img.data,img.width,img.height);
 assert.deepEqual([list[0].tileWidth,list[0].tileHeight,list[0].cols,list[0].rows],[16,16,8,6]);
 for(const c of list)assert(['high','medium','low'].includes(c.confidence));
 const applied=autoApply(list),suggested=suggestedGrid(list);
 if(list[0].confidence!=='high')assert.equal(applied,null,'only a high-confidence grid is applied without asking');
 if(suggested)assert.equal(suggested.confirm,list[0].confidence!=='high');
 const stats=contentStats(img.data,img.width,img.height,{tileWidth:16,tileHeight:16,cols:8,rows:6});
 assert.equal(stats.blank,1);assert.equal(stats.solid,47);
});
test('B10 on real art: the caeles 16px blob template and Kenney micro roguelike',async()=>{
 const blob=await fixture('oga-caeles-blob47-16px.png');
 const a=detectTileGrid(blob.data,blob.width,blob.height)[0];
 assert.deepEqual([a.tileWidth,a.tileHeight,a.cols,a.rows],[16,16,7,7]);
 const kenney=await fixture('kenney-micro-roguelike-8px-s1.png');
 const b=detectTileGrid(kenney.data,kenney.width,kenney.height)[0];
 assert.deepEqual([b.tileWidth,b.tileHeight,b.spacingX,b.spacingY],[8,8,1,1]);
 assert.equal(b.confidence,'high');assert.equal(autoApply([b]),b);
});
// ---- B9: resampled upscales ---------------------------------------------------------------
test('B9: a 3.78× bilinear upscale of real pixel art is reported as resampled ≈3.78×, not 1×',async()=>{
 const art=crop(await fixture('kenney-tiny-dungeon-packed-16px.png'),0,112,96,64);
 const r=inspect(bilinear(art,Math.round(96*3.78),Math.round(64*3.78)));
 assert.equal(r.verdict,'resampled');
 assert(Math.abs(r.resample.scale-3.78)<.06,`scale ${r.resample.scale}`);
 assert.equal(r.resample.integer,false);assert.equal(r.resample.smoothed,true);
 assert.notEqual(r.resample.confidence,'low');
 // 4× nearest then shrunk to 121/128 (the audit case) — also non-integer and smoothed.
 const r2=inspect(bilinear(nearestScale(art,4),Math.round(384*121/128),Math.round(256*121/128)));
 assert.equal(r2.verdict,'resampled');assert(Math.abs(r2.resample.scale-3.78)<.06);
});
test('B9: crisp 1× art and an exact integer upscale are not called resampled',async()=>{
 const art=crop(await fixture('kenney-tiny-dungeon-packed-16px.png'),0,112,96,64);
 assert.equal(inspect(art).verdict,'unit');
 const x3=inspect(nearestScale(art,3));assert.equal(x3.verdict,'integer');assert.equal(x3.resample.scale,3);
 const sumo=inspect(await fixture('oga-sumo-hulk-x4-64px.png'));assert.equal(sumo.verdict,'integer');assert.equal(sumo.scale.scale,4);
 const r=estimateResample(art);assert.equal(r.confidence==='high'&&r.coherence>=.6,false);
});
// ---- B14: bitmap fonts -------------------------------------------------------------------------
test('B14 on real art: the oldschool charmap is 18×7 cells of 7×9, ASCII from the space',async()=>{
 const img=await fixture('oga-charmap-oldschool-7x9.png'),key=detectColorKey(img);
 assert.deepEqual(key.color,[0,0,0]);
 const f=detectFontGrid(applyColorKey(img,key.color));
 assert.deepEqual([f.cellW,f.cellH,f.cols,f.rows,f.first,f.preset],[7,9,18,7,32,'ascii']);
 assert.equal(f.chars[0],' ');assert.equal(f.chars[1],'!');assert.equal(f.chars.at(-1),'~');assert.equal(f.glyphs,95);
});
test('a 16×16 grid of 8×8 glyphs is read as code page 437',()=>{
 const img=canvas(128,128);
 for(let i=1;i<255;i++){const x=(i%16)*8,y=Math.floor(i/16)*8;box(img,x+1+(i%3),y+1,3+(i%2),5+(i%2),[255,255,255,255]);}
 const f=detectFontGrid(img);
 assert.deepEqual([f.cellW,f.cellH,f.cells,f.preset,f.first],[8,8,256,'cp437',0]);
 assert.equal(Array.from(f.chars)[65],'A');assert.equal(CP437.length,256);assert.equal(CP437[1],'☺');
});
// ---- B12: texture names -------------------------------------------------------------------------
test('ambientCG names classify: NormalGL/NormalDX are normals with their convention',()=>{
 assert.equal(classifyTextureName('Rock030_1K-PNG_NormalGL.png').role,'normal');
 assert.equal(classifyTextureName('Rock030_1K-PNG_NormalDX.png').role,'normal');
 assert.equal(classifyTextureName('Rock030_1K-PNG_Displacement.png').role,'height');
 assert.equal(normalConvention('Rock030_1K-PNG_NormalGL.png'),'opengl');
 assert.equal(normalConvention('Rock030_1K-PNG_NormalDX.png'),'directx');
 assert.equal(normalConvention('rock_normal.png'),null);
});
