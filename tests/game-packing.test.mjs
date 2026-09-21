import test from 'node:test';import assert from 'node:assert/strict';
import {packFrames,blitPage,readRegion,findOverlaps,findAliases,frameKey,ROTATION_SUPPORTED} from '../src/game/packing.js';
import {framesFromRects,normalizeFrames} from '../src/game/frame-ops.js';
import {source,innerRect} from '../src/game/pixels.js';
import {canvas,box,disc,blit,stack,hundredFrames,irregularSheet,walkCycle,rand} from './game-fixtures.mjs';
const build=(images,options)=>{const {sheet,rects}=stack(images);return {sheet,...framesFromRects(sheet,rects,{trim:true,...options})};};
const bytes=a=>[...a];
/** Reads every frame's region out of its drawn page and compares it with the source pixels. */
function verify(sheet,frames,result,label=''){
 const s=source(sheet),pages=result.pages.map((_,i)=>blitPage(sheet,frames,result.atlas,i));
 for(const f of frames){
  const place=result.atlas.frames[f.id];
  assert(place,`${f.name} has an atlas entry ${label}`);
  const region=readRegion(pages[place.page],{x:place.x,y:place.y,w:place.w,h:place.h});
  const expected=s.read(innerRect(f));
  assert.equal(region.width,expected.width,`${f.name} width ${label}`);
  assert.equal(region.height,expected.height,`${f.name} height ${label}`);
  assert.deepEqual(bytes(region.data),bytes(expected.data),`${f.name}: the atlas region is its source pixels ${label}`);
 }
 assert.deepEqual(findOverlaps(result.atlas),[],`no frame overlaps another ${label}`);
 assert.deepEqual(findOverlaps(result.atlas,{includePadding:true}),[],`and padding is respected too ${label}`);
 return pages;
}

test('every frame of an irregular sheet reads back from the atlas as its own pixels',()=>{
 const sheet=irregularSheet();
 const {frames}=framesFromRects(sheet,sheet.placed);
 const result=packFrames(sheet,frames,{padding:2});
 verify(sheet,frames,result);
 assert.equal(result.atlas.pages,1);
 assert.equal(result.unique,frames.length);
 assert.equal(result.efficiency>.3,true,`efficiency ${result.efficiency.toFixed(3)}`);
 assert.equal(ROTATION_SUPPORTED,false);
 assert.throws(()=>packFrames(sheet,frames,{rotate:true}),/cannot describe one/);
 assert.throws(()=>packFrames(sheet,[]),/at least one/);
 assert.throws(()=>packFrames(sheet,frames,{padding:-1}),/0…256/);
 assert.throws(()=>packFrames(sheet,frames,{extrude:100}),/0…64/);
 assert.throws(()=>packFrames(sheet,frames,{maxSize:4}),/8…32768/);
});
test('a 100-frame animation packs on one page and every region matches',()=>{
 const images=hundredFrames();
 const {sheet,frames}=build(images);
 assert.equal(frames.length,100);
 const result=packFrames(sheet,frames,{padding:2,dedupe:false});
 verify(sheet,frames,result,'(100 frames)');
 assert.equal(result.unique,100);
 assert(result.efficiency>.6,`packing efficiency on the 100-frame fixture is ${(result.efficiency*100).toFixed(1)}%`);
 assert(result.paddedEfficiency>result.efficiency);
 assert.equal(result.atlas.pages,1);
 assert.deepEqual(Object.keys(result.atlas.frames).length,100);
});
test('the 20 repeated frames of that animation are stored once and aliased',()=>{
 const {sheet,frames}=build(hundredFrames());
 const result=packFrames(sheet,frames,{padding:2,dedupe:true});
 assert.equal(result.unique,80,'80 distinct images, 20 repeats');
 assert.equal(Object.keys(result.aliases).length,20);
 verify(sheet,frames,result,'(aliased)');
 for(const [id,target] of Object.entries(result.aliases)){
  const a=result.atlas.frames[id],b=result.atlas.frames[target];
  assert.equal(a.aliasOf,target);
  assert.deepEqual([a.page,a.x,a.y,a.w,a.h],[b.page,b.x,b.y,b.w,b.h],'an alias points at the same region');
  assert.equal(b.aliasOf,null,'and the region it points at is a real one');
 }
 const plain=packFrames(sheet,frames,{padding:2,dedupe:false});
 assert(result.efficiency>plain.efficiency||result.atlas.width*result.atlas.height<plain.atlas.width*plain.atlas.height,
  `de-duplication saves space (${result.atlas.width}×${result.atlas.height} vs ${plain.atlas.width}×${plain.atlas.height})`);
 assert(result.warnings.some(w=>/stored once/.test(w)));
});
test('a content hash is confirmed byte for byte, so nothing is aliased by accident',()=>{
 const a=canvas(8,8);box(a,0,0,8,8,[1,2,3,255]);
 const b=canvas(8,8);box(b,0,0,8,8,[1,2,3,255]);
 const c=canvas(8,8);box(c,0,0,8,8,[1,2,4,255]);
 const {sheet,frames}=build([a,b,c]);
 const {aliasOf,representatives}=findAliases(sheet,frames);
 assert.equal(aliasOf.get(frames[1].id),frames[0].id);
 assert.equal(aliasOf.has(frames[2].id),false,'one channel off by one is not the same frame');
 assert.equal(representatives.size,2);
 assert.equal(frameKey(sheet,frames[0]).key,frameKey(sheet,frames[1]).key);
 assert.notEqual(frameKey(sheet,frames[0]).key,frameKey(sheet,frames[2]).key);
 assert.deepEqual([frameKey(sheet,frames[0]).w,frameKey(sheet,frames[0]).h],[8,8]);
});
test('frames that exceed the atlas size go on further pages, none of them lost',()=>{
 const r=rand(4),images=Array.from({length:40},(_,i)=>{
  const s=48+Math.floor(r()*40),img=canvas(s,s);
  box(img,0,0,s,s,[20+i*5%200,60,180,255]);disc(img,s/2,s/2,s/4,[250,250,20,255]);
  return img;});
 const {sheet,frames}=build(images);
 const result=packFrames(sheet,frames,{maxSize:128,padding:1,dedupe:false});
 assert(result.atlas.pages>=6,`40 frames of ~64px need several 128px pages (${result.atlas.pages})`);
 assert(result.atlas.pages<=40);
 assert.equal(result.pages.length,result.atlas.pages);
 assert.deepEqual(result.pages.map(p=>p.index),result.pages.map((_,i)=>i),'pages are numbered atlas-0, atlas-1, …');
 assert.equal(new Set(Object.values(result.atlas.frames).map(p=>p.page)).size,result.atlas.pages,'every page holds something');
 assert(result.pages.every(p=>p.width<=128&&p.height<=128),'no page is grown past the limit');
 assert.equal(result.pages.reduce((s,p)=>s+p.frames.length,0),40,'every frame is on exactly one page');
 verify(sheet,frames,result,'(multi-page)');
 assert(result.warnings.some(w=>/need \d+ pages/.test(w)),JSON.stringify(result.warnings));
 assert.throws(()=>packFrames(sheet,frames,{maxSize:128,maxPages:2}),/more than 2 atlas pages/);
 assert.throws(()=>packFrames(sheet,frames,{maxSize:32}),/larger than the 32px/);
});
test('extrude copies the edge pixels outside the recorded rect, padding stays empty',()=>{
 const img=canvas(6,6);
 for(let y=0;y<6;y++)for(let x=0;x<6;x++)img.data.set([x*40,y*40,90,255],(y*6+x)*4);
 const other=canvas(6,6);box(other,0,0,6,6,[9,9,9,255]);
 const {sheet,frames}=build([img,other]);
 const result=packFrames(sheet,frames,{padding:3,extrude:2,dedupe:false});
 const pages=verify(sheet,frames,result,'(extruded)');
 assert.equal(result.atlas.extrude,2);assert.equal(result.atlas.padding,3);
 const place=result.atlas.frames[frames[0].id],page=pages[place.page];
 const px=(x,y)=>[...page.data.subarray((y*page.width+x)*4,(y*page.width+x)*4+4)];
 assert.deepEqual(px(place.x,place.y),[0,0,90,255],'the sprite starts exactly at the recorded rect');
 assert.deepEqual(px(place.x-1,place.y),[0,0,90,255],'one pixel out is the copied left edge');
 assert.deepEqual(px(place.x-2,place.y-2),[0,0,90,255],'and the corner is the copied corner');
 assert.deepEqual(px(place.x-3,place.y),[0,0,0,0],'beyond the extrude belt the padding is empty');
 assert.deepEqual(px(place.x+place.w+1,place.y),[200,0,90,255],'the right belt copies the right edge');
});
test('power-of-two pages and a per-page efficiency figure',()=>{
 const {sheet,frames}=build(hundredFrames());
 const pot=packFrames(sheet,frames,{padding:2,pot:true});
 assert((pot.atlas.width&(pot.atlas.width-1))===0&&(pot.atlas.height&(pot.atlas.height-1))===0,`${pot.atlas.width}×${pot.atlas.height} is power of two`);
 verify(sheet,frames,pot,'(pot)');
 for(const page of pot.pages)assert(page.efficiency>0&&page.efficiency<=1,`page ${page.index} efficiency ${page.efficiency}`);
 assert.equal(pot.atlas.pageSizes.length,pot.pages.length);
 const tight=packFrames(sheet,frames,{padding:0,extrude:0});
 assert(tight.efficiency>pot.efficiency,`no padding packs tighter (${(tight.efficiency*100).toFixed(1)}% vs ${(pot.efficiency*100).toFixed(1)}%)`);
});
test('a normalized walk cycle packs, and its aliased duplicate frames still read back right',()=>{
 // The cycle's rounded sine gives leg lifts 0,2,3,2,0,-2,-3,-2: only five distinct poses, so five
 // of the ten frames here (eight plus two deliberate repeats) are the same pixels as another.
 const images=walkCycle(8);
 const {sheet,frames}=build([...images,images[0],images[1]]);
 const normalized=normalizeFrames(frames,{align:'bottom-center',padding:1});
 const result=packFrames(sheet,normalized.frames,{padding:2});
 assert.equal(Object.keys(result.aliases).length,5,'every repeated pose is aliased, not only the appended ones');
 verify(sheet,normalized.frames,result,'(normalized)');
 assert.equal(result.unique,5);
 const pages=result.pages.map((_,i)=>blitPage(sheet,normalized.frames,result.atlas,i));
 assert.equal(pages.length,1);
 assert.throws(()=>blitPage(sheet,normalized.frames.slice(1),result.atlas,0),/not in the frame list/);
});
