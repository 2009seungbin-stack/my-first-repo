import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import * as P from '../src/primitives.js';
import {safeArchivePath, zip, crc32} from '../src/core.js';
import {pngRGBA, ico} from '../src/recipes.js';
const image=(w,h)=>new Uint8ClampedArray(w*h*4);
const pixel=(d,w,x,y,c=[255,0,0,255])=>d.set(c,(y*w+x)*4);
test('alpha bounds preserve exact inclusive edges; empty is null',()=>{
 const d=image(8,6);assert.equal(P.bounds(d,8,6),null);pixel(d,8,0,0);pixel(d,8,7,5);assert.deepEqual(P.bounds(d,8,6),{x:0,y:0,w:8,h:6});
});
test('8-connected components, threshold, minimum area and frame cap',()=>{
 const d=image(8,6);pixel(d,8,1,1);pixel(d,8,2,2);pixel(d,8,6,4);assert.equal(P.components(d,8,6,{minArea:1}).length,2);assert.equal(P.components(d,8,6,{minArea:2}).length,1);assert.throws(()=>P.components(d,8,6,{minArea:1,maxFrames:1}));
});
test('analysis dimensions and RGBA buffers are bounded before allocation',()=>{
 assert.throws(()=>P.pixels([],2,2));assert.throws(()=>P.pixels({length:4000001*4},8192,8192));assert.throws(()=>P.grid(9,8,4,4));assert.throws(()=>P.grid(4096,4096,1,1));
});
test('frame rectangles reject zero, fractional, negative and out-of-bounds extents',()=>{
 for(const r of [{x:-1,y:0,w:1,h:1},{x:0,y:0,w:0,h:1},{x:0,y:0,w:9,h:1},{x:.5,y:0,w:1,h:1}])assert.throws(()=>P.rectangle(r,8,8));
 assert.deepEqual(P.rectangle({x:4,y:4,w:4,h:4},8,8),{x:4,y:4,w:4,h:4});
});
for(const n of [16,32,64,128,47])test(`sheet metadata uses actual ${n}px coordinates`,()=>{
 const s=P.sheetLayout(5,n,n,3,2);assert.equal(s.width,3*(n+4));assert.equal(s.height,2*(n+4));assert.deepEqual([s.frames[4].x,s.frames[4].y],[n+6,n+6]);
});
test('normalize alignments and custom horizontal anchor',()=>{
 assert.deepEqual(P.placement(4,6,10,10,'bottom'),{x:3,y:4});assert.deepEqual(P.placement(4,6,10,10,'center'),{x:3,y:2});assert.deepEqual(P.placement(4,6,10,10,'top',0),{x:0,y:0});assert.throws(()=>P.placement(11,1,10,10));
});
test('palette exact/similar replacement preserves alpha and bounded shade offset',()=>{
 const d=new Uint8ClampedArray([255,0,0,255,250,0,0,200,0,255,0,255]);
 const a=P.swap(d,3,1,{from:[255,0,0],to:[0,0,255],tolerance:0});assert.deepEqual([...a],[0,0,255,255,250,0,0,200,0,255,0,255]);
 const b=P.swap(d,3,1,{from:[255,0,0],to:[0,0,255],tolerance:5,shading:true});assert.equal(b[7],200);assert.equal(b[6],254);assert.deepEqual([...d.slice(0,4)],[255,0,0,255]);
});
test('RGBA channel packing maps luminance and constants including alpha zero',()=>{
 const a=new Uint8ClampedArray([10,10,10,255]),b=new Uint8ClampedArray([80,80,80,255]),c=new Uint8ClampedArray([220,220,220,255]);
 assert.deepEqual([...P.packChannels([a,b,c],1,1,[2,0,1,'zero'])],[220,10,80,0]);assert.throws(()=>P.packChannels([a],1,1,[0,1,0,'one']));
});
test('height gradient normal on flat surface and green orientation',()=>{
 const d=new Uint8ClampedArray([50,50,50,255,50,50,50,255]);assert.deepEqual([...P.mapTexture(d,2,1,{mode:'normal'})],[128,128,255,255,128,128,255,255]);
 const ramp=new Uint8ClampedArray([0,0,0,255,255,255,255,255]);const a=P.mapTexture(ramp,1,2,{mode:'normal'}),b=P.mapTexture(ramp,1,2,{mode:'normal',invertY:true});assert.equal(a[1]+b[1],255);
});
test('atlas edge extrusion does not leak pixels between neighboring tiles',()=>{
 const d=new Uint8ClampedArray([255,0,0,255,0,255,0,255]);const out=P.extrude(d,2,1,1,1,1);assert.equal(out.width,6);assert.equal(out.height,3);
 for(let y=0;y<3;y++)for(let x=0;x<6;x++)assert.deepEqual([...out.data.slice((y*6+x)*4,(y*6+x)*4+4)],x<3?[255,0,0,255]:[0,255,0,255]);
});
test('margin crop keeps nonwhite content and clips padding to image',()=>{
 const d=new Uint8ClampedArray(6*6*4).fill(255);pixel(d,6,2,2,[30,30,30,255]);assert.deepEqual(P.marginBounds(d,6,6,245,1),{x:1,y:1,w:3,h:3});d.fill(255);assert.equal(P.marginBounds(d,6,6),null);
});
test('bitmap font metadata validates Unicode order and exact source cell coordinates',()=>{
 const m=P.fontMetadata(16,8,8,8,'Aあ',6);assert.deepEqual(m.glyphs.map(g=>[g.codepoint,g.x,g.y]),[[65,0,0],[12354,8,0]]);assert.throws(()=>P.fontMetadata(16,8,8,8,'AA'));assert.throws(()=>P.fontMetadata(16,8,8,8,'ABC'));
});
test('safe ZIP paths preserve nested folders and reject traversal and absolute paths',async()=>{
 assert.equal(safeArchivePath('Etsy/photo.png'),'Etsy/photo.png');for(const n of ['../x','/x','x/../y','x//y','C:/x','x\\y'])assert.throws(()=>safeArchivePath(n));
 const blob=await zip([{name:'Etsy/A.png',blob:new Blob(['a'])},{name:'Etsy/a.png',blob:new Blob(['b'])}],{paths:true});const text=new TextDecoder().decode(await blob.arrayBuffer());assert(text.includes('Etsy/A.png'));assert(text.includes('Etsy/a-2.png'));
});
test('straight-alpha PNG independently inflates and preserves invisible RGB bytes',async()=>{
 const input=new Uint8ClampedArray([220,10,80,0,123,234,45,128]);const bytes=new Uint8Array(await pngRGBA(input,2,1).arrayBuffer()),v=new DataView(bytes.buffer);let pos=8,idat;
 while(pos<bytes.length){const n=v.getUint32(pos),name=new TextDecoder().decode(bytes.slice(pos+4,pos+8));assert.equal(crc32(bytes.subarray(pos+4,pos+8+n)),v.getUint32(pos+8+n));if(name==='IDAT')idat=bytes.slice(pos+8,pos+8+n);pos+=12+n;}
 assert.deepEqual([...inflateSync(idat)],[0,...input]);
});
test('modern ICO has exact embedded lengths, offsets and PNG signatures',async()=>{
 const png=pngRGBA(new Uint8ClampedArray(16*16*4),16,16),b=new Uint8Array(await (await ico([{size:16,blob:png}])).arrayBuffer()),v=new DataView(b.buffer);assert.equal(v.getUint16(2,true),1);assert.equal(v.getUint16(4,true),1);assert.equal(v.getUint32(14,true),png.size);assert.equal(v.getUint32(18,true),22);assert.deepEqual([...b.slice(22,30)],[137,80,78,71,13,10,26,10]);
});
test('frame recipes accept 4096 frames and keep sortable names past 999',()=>{
 assert.equal(P.grid(64*64,64*64,64,64).length,4096);assert.throws(()=>P.grid(4097,1,1,1),/4096/);
 const small=P.sheetLayout(12,8,8,4);assert.equal(small.frames[0].name,'frame-001','existing three-digit names are unchanged');
 const big=P.sheetLayout(4096,16,16,64);assert.equal(big.frames.length,4096);assert.equal(big.width,1024);assert.equal(big.height,1024);
 const names=big.frames.map(f=>f.name);assert.equal(names[0],'frame-0001');assert.equal(names[4095],'frame-4096');assert.deepEqual([...names].sort(),names,'lexical order equals frame order');
 assert.throws(()=>P.sheetLayout(4097,1,1,1));
 const dots=n=>{const a=new Uint8ClampedArray(n*n*4);for(let y=0;y<n;y+=2)for(let x=0;x<n;x+=2)a[(y*n+x)*4+3]=255;return a;};
 assert.equal(P.components(dots(128),128,128,{minArea:1}).length,4096,'4096 isolated parts, far past the old 256 cap');
 assert.throws(()=>P.components(dots(130),130,130,{minArea:1}),/Too many/);
});
