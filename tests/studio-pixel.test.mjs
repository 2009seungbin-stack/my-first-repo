// Pixel workspace (P2): pure modules — raster tools, strokes, indexed colour, indexed PNG, palette
// files, ramps, audit, document edits and the cleanup (grid snap) engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/studio/pixel/raster.js';
import {Stroke} from '../src/studio/pixel/stroke.js';
import * as I from '../src/studio/pixel/indexed.js';
import {encodeIndexedPNG,decodeIndexedPNG} from '../src/studio/pixel/png8.js';
import {decodePNG} from '../src/game/texture-png.js';
import * as PIO from '../src/studio/pixel/palette-io.js';
import {hueShiftRamp,blendRamp,isRamp} from '../src/studio/pixel/ramps.js';
import {auditFrames,strayMask} from '../src/studio/pixel/audit.js';
import * as PD from '../src/studio/pixel/pixel-doc.js';
import * as P from '../src/studio/core/project.js';
import * as S from '../src/game/pixel-snap.js';
import {runCleanup,analyse} from '../src/studio/pixel/cleanup.js';
import {okLCh} from '../src/game/palette.js';

const BLOB='a'.repeat(64),BLOB2='b'.repeat(64),BLOB3='c'.repeat(64);
const RED=R.pack(255,0,0),BLUE=R.pack(0,0,255),GREEN=R.pack(0,255,0),BLACK=R.pack(0,0,0);
const P0=(w,h,fill=0)=>R.plane(w,h,R.RGBA,fill);
const at=(p,x,y)=>p.data[y*p.w+x];
const count=(p,v)=>p.data.reduce((n,x)=>n+(x===v?1:0),0);
const ascii=p=>{let s='';for(let y=0;y<p.h;y++){for(let x=0;x<p.w;x++)s+=p.data[y*p.w+x]?'#':'.';s+='\n';}return s;};

// ------------------------------------------------------------------ raster
test('Bresenham lines are 8-connected, inclusive and symmetric', ()=>{
 const a=R.linePoints(0,0,7,3);assert.deepEqual(a[0],[0,0]);assert.deepEqual(a.at(-1),[7,3]);assert.equal(a.length,8);
 for(let i=1;i<a.length;i++)assert.ok(Math.abs(a[i][0]-a[i-1][0])<=1&&Math.abs(a[i][1]-a[i-1][1])<=1);
 assert.equal(R.linePoints(3,3,3,3).length,1);
 assert.deepEqual(R.linePoints(0,0,4,4).map(p=>p[0]-p[1]),[0,0,0,0,0]);
});
test('Shift-constrained lines snap to pixel-art angles (0°, 2:1, 45°, 1:2, 90°)', ()=>{
 assert.deepEqual(R.snapLineEnd(0,0,10,1),[10,0]);
 assert.deepEqual(R.snapLineEnd(0,0,10,5),[10,5]);
 assert.deepEqual(R.snapLineEnd(0,0,9,8),[9,9].map((v,i)=>i?9:9));
 assert.deepEqual(R.snapLineEnd(0,0,-2,11),[0,11]);assert.deepEqual(R.snapLineEnd(0,0,-3,11),[-6,12]);
 const [x,y]=R.snapLineEnd(5,5,15,11);assert.equal((x-5)/(y-5),2);
});
test('rectangles and ellipses: outline and filled, gap-free and symmetric', ()=>{
 assert.equal(R.rectPixels(0,0,4,3).length,14);assert.equal(R.rectPixels(4,3,0,0,true).length,20);
 for(const [w,h]of [[5,5],[8,5],[9,14],[2,7],[16,16],[1,1],[3,1]]){
  const e=R.ellipsePixels(0,0,w-1,h-1),set=new Set(e.map(p=>p+''));
  assert.ok(e.every(([x,y])=>x>=0&&y>=0&&x<w&&y<h),`${w}x${h} inside its box`);
  // symmetric in both axes
  assert.ok(e.every(([x,y])=>set.has([w-1-x,y]+'')&&set.has([x,h-1-y]+'')),`${w}x${h} symmetric`);
  // touches all four sides of the box
  assert.ok(e.some(p=>p[0]===0)&&e.some(p=>p[0]===w-1)&&e.some(p=>p[1]===0)&&e.some(p=>p[1]===h-1),`${w}x${h} spans its box`);
  // closed: every outline pixel has at least two 8-neighbours on the outline (w,h ≥ 3)
  if(w>=3&&h>=3)assert.ok(e.every(([x,y])=>[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].filter(([dx,dy])=>set.has([x+dx,y+dy]+'')).length>=2),`${w}x${h} closed`);
  const f=R.ellipsePixels(0,0,w-1,h-1,true),fs=new Set(f.map(p=>p+''));assert.ok(e.every(p=>fs.has(p+'')),'filled covers the outline');
 }
});
test('pixel-perfect drops L-corners only', ()=>{
 const path=[[0,0],[1,0],[1,1],[2,1],[3,1],[3,2]];
 assert.deepEqual(R.pixelPerfect(path),[[0,0],[1,1],[2,1],[3,2]]);
 const straight=[[0,0],[1,0],[2,0],[3,0]];assert.deepEqual(R.pixelPerfect(straight),straight);
 const diag=[[0,0],[1,1],[2,2]];assert.deepEqual(R.pixelPerfect(diag),diag);
});
test('bucket: contiguous vs global, tolerance, selection limit', ()=>{
 const p=P0(6,3);p.data.fill(RED);p.data[2]=p.data[8]=p.data[14]=BLUE;// a blue column at x=2 splits red
 const c=R.floodMask(p,0,0);assert.equal(c.count,6);
 const g=R.floodMask(p,0,0,{contiguous:false});assert.equal(g.count,15);
 const q=P0(4,1);q.data.set([R.pack(100,0,0),R.pack(104,0,0),R.pack(110,0,0),R.pack(100,0,0)]);
 assert.equal(R.floodMask(q,0,0,{tolerance:4}).count,2);assert.equal(R.floodMask(q,0,0,{tolerance:10}).count,4);
 const limit=new Uint8Array(18);limit[0]=limit[1]=1;assert.equal(R.floodMask(p,0,0,{limit}).count,2);
 // indexed: tolerance compares palette colours
 const cols=[[0,0,0,0],[100,0,0,255],[103,0,0,255],[0,0,200,255]],ip={w:4,h:1,data:Uint8Array.from([1,2,3,1])};
 assert.equal(R.floodMask(ip,0,0,{kind:R.INDEXED,tolerance:5,colorOf:i=>cols[i]}).count,2);
});
test('selection masks: rect, lasso, combine, invert, bounds, marching-ant edges', ()=>{
 const m=R.maskFromRect(8,8,{x:2,y:1,w:3,h:4});assert.equal(R.maskCount(m),12);assert.deepEqual(R.maskBounds(m,8,8),{x:2,y:1,w:3,h:4});
 const tri=R.maskFromPolygon(10,10,[[0,0],[10,0],[0,10]]);assert.ok(R.maskCount(tri)>=45&&R.maskCount(tri)<=65,String(R.maskCount(tri)));
 const b=R.maskFromRect(8,8,{x:4,y:1,w:3,h:4});
 assert.equal(R.maskCount(R.combineMask(m,b,'add')),20);assert.equal(R.maskCount(R.combineMask(m,b,'subtract')),8);assert.equal(R.maskCount(R.combineMask(m,b,'intersect')),4);
 assert.equal(R.maskCount(R.invertMask(m)),52);
 assert.equal(R.maskEdges(m,8,8).length/4,4,'a rectangle is four merged segments');
 const two=R.combineMask(R.maskFromRect(8,8,{x:0,y:0,w:2,h:2}),R.maskFromRect(8,8,{x:2,y:2,w:2,h:2}),'add');assert.equal(R.maskEdges(two,8,8).length/4,8);
});
test('floating pieces: lift/cut, stamp, flip, 4× rotate = identity, rotate keeps the centre', ()=>{
 const p=P0(5,4);p.data[0]=RED;p.data[1]=BLUE;p.data[5]=GREEN;
 const m=R.maskFromRect(5,4,{x:0,y:0,w:2,h:2});const {piece,plane}=R.lift(p,m,{cut:true});
 assert.equal(piece.w,2);assert.equal(count(plane,0),20);assert.equal(at(p,0,0),RED,'lift without cut leaves the source alone');
 const f=R.flipPiece(piece,'x');assert.equal(f.data[0],BLUE);assert.equal(f.data[3],GREEN);
 let r=piece;for(let i=0;i<4;i++)r=R.rotatePiece(r,'cw');assert.deepEqual([...r.data],[...piece.data]);assert.equal(r.x,piece.x);assert.equal(r.y,piece.y);
 const tall={x:4,y:2,w:2,h:6,data:new Uint32Array(12).fill(RED),mask:new Uint8Array(12).fill(1)},t=R.rotatePiece(tall,'cw');
 assert.equal(t.w,6);assert.equal(t.h,2);assert.equal(t.x*2+t.w,tall.x*2+tall.w);assert.equal(t.y*2+t.h,tall.y*2+tall.h);
 const q=P0(5,4);R.stamp(q,{...piece,x:3,y:2});assert.equal(at(q,3,2),RED);assert.equal(at(q,4,2),BLUE);assert.equal(at(q,3,3),GREEN);assert.equal(at(q,4,3),0,'transparent piece pixels do not overwrite');
});
test('outline (outside/inside, circle/square matrix), drop shadow, replace colour', ()=>{
 const p=P0(7,7);p.data[3*7+3]=RED;
 assert.equal(R.outline(p,BLACK,{place:'outside',matrix:'circle'}).changed,4);
 assert.equal(R.outline(p,BLACK,{place:'outside',matrix:'square'}).changed,8);
 const sq=P0(7,7);for(let y=2;y<5;y++)for(let x=2;x<5;x++)sq.data[y*7+x]=RED;
 assert.equal(R.outline(sq,BLACK,{place:'inside'}).changed,8);
 const lim=R.maskFromRect(7,7,{x:0,y:0,w:7,h:3});assert.equal(R.outline(sq,BLACK,{place:'outside',limit:lim}).changed,5);
 const s=R.dropShadow(sq,BLACK,{dx:1,dy:1});assert.equal(s.changed,5);assert.equal(at(s.plane,5,5),BLACK);
 const rc=R.replaceColor(sq,RED,BLUE);assert.equal(rc.changed,9);assert.equal(count(rc.plane,BLUE),9);
});
test('ordered dither: 0 and 1 are solid, 0.5 is half, pattern anchored to the canvas', ()=>{
 for(const pat of Object.keys(R.DITHER_PATTERNS)){
  let n=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++)n+=R.ditherOn(x,y,pat,.5)?1:0;assert.equal(n,32,pat);
  let a=0,b=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){a+=R.ditherOn(x,y,pat,0)?1:0;b+=R.ditherOn(x,y,pat,1)?1:0;}assert.equal(a,0);assert.equal(b,64);
 }
 assert.equal(R.ditherOn(-1,-1,'bayer4',.3),R.ditherOn(3,3,'bayer4',.3));
});
// ------------------------------------------------------------------ strokes
test('pencil: freehand fills gaps; pixel-perfect removes L corners; revert is exact', ()=>{
 const p=P0(10,10),s=new Stroke(p,{value:RED,pixelPerfect:true});
 s.point(0,0);s.point(1,0);s.point(1,1);s.point(2,1);s.point(5,1);
 assert.equal(at(p,1,0),0,'L corner at (1,0) given back');assert.equal(at(p,1,1),RED);assert.equal(at(p,5,1),RED);assert.equal(at(p,3,1),RED,'gap filled');
 const plain=P0(10,10),t=new Stroke(plain,{value:RED});t.point(0,0);t.point(1,0);t.point(1,1);assert.equal(at(plain,1,0),RED);
 s.revert();assert.equal(count(p,0),100);
});
test('pixel-perfect keeps a corner pixel that another part of the stroke painted', ()=>{
 const p=P0(6,6),s=new Stroke(p,{value:RED,pixelPerfect:true});
 s.point(1,0);s.point(1,1);s.point(1,2);// vertical line through (1,1)
 s.point(0,2);s.point(0,1);s.point(1,1);s.point(2,1);// comes back through (1,1)
 assert.equal(at(p,1,1),RED);
});
test('brush sizes and shapes; symmetry mirrors footprints exactly', ()=>{
 assert.equal(R.brushOffsets(1).length/2,1);assert.equal(R.brushOffsets(4).length/2,16);assert.equal(R.brushOffsets(16).length/2,256);
 const round=R.brushOffsets(5,'round').length/2;assert.ok(round<25&&round>=13,String(round));
 const p=P0(16,8),s=new Stroke(p,{value:RED,size:2,symmetry:{mode:'x',axisX:8}});s.point(2,3);
 for(let y=0;y<8;y++)for(let x=0;x<16;x++)assert.equal(at(p,x,y)===RED,at(p,15-x,y)===RED,`mirror ${x},${y}`);
 const q=P0(9,9),t=new Stroke(q,{value:RED,symmetry:{mode:'both',axisX:4.5,axisY:4.5}});t.point(1,2);
 assert.deepEqual([at(q,1,2),at(q,7,2),at(q,1,6),at(q,7,6)],[RED,RED,RED,RED]);assert.equal(count(q,RED),4);
 const onAxis=P0(9,9),u=new Stroke(onAxis,{value:RED,symmetry:{mode:'x',axisX:4.5}});u.point(4,0);assert.equal(count(onAxis,RED),1,'a pixel on the axis mirrors onto itself');
});
test('inks: shading moves one ramp step per stroke; alpha ink does not build up; lock alpha; replace', ()=>{
 const ramp=[R.pack(20,20,20),R.pack(80,80,80),R.pack(160,160,160),R.pack(240,240,240)];
 const p=P0(4,1);p.data.set([ramp[1],ramp[1],BLUE,0]);
 const s=new Stroke(p,{ink:'shading',ramp,rampDir:1});s.point(0,0);s.point(1,0);s.point(0,0);s.point(3,0);
 assert.equal(at(p,0,0),ramp[2]);assert.equal(at(p,1,0),ramp[2]);assert.equal(at(p,2,0),BLUE,'colours outside the ramp are left alone');assert.equal(at(p,3,0),0);
 const d=P0(2,1);d.data.set([ramp[0],0]);new Stroke(d,{ink:'shading',ramp,rampDir:-1}).point(0,0);assert.equal(at(d,0,0),ramp[0],'clamped at the dark end');
 const a=P0(2,1);a.data[0]=R.pack(0,0,255);const half=R.pack(255,0,0,128),st=new Stroke(a,{ink:'alpha',value:half});st.point(0,0);st.point(1,0);st.point(0,0);
 const once=R.unpack(at(a,0,0));assert.ok(once[0]>100&&once[0]<160&&once[2]>90,String(once));assert.equal(at(a,1,0),half,'over transparent the colour is written as is');
 const l=P0(2,1);l.data[0]=R.pack(10,10,10,200);new Stroke(l,{ink:'lockAlpha',value:RED}).point(0,0);assert.deepEqual(R.unpack(at(l,0,0)),[255,0,0,200]);
 const l2=P0(2,1);const st2=new Stroke(l2,{ink:'lockAlpha',value:RED});st2.point(0,0);st2.point(1,0);assert.equal(count(l2,0),2);
 const rp=P0(3,1);rp.data.set([RED,BLUE,RED]);const r=new Stroke(rp,{ink:'replace',from:RED,value:GREEN,size:3});r.point(1,0);assert.deepEqual([...rp.data],[GREEN,BLUE,GREEN]);
});
test('dither brush paints both colours on the pattern, or leaves pixels; selection limits paint', ()=>{
 const p=P0(4,4),s=new Stroke(p,{value:RED,value2:BLUE,size:4,dither:{pattern:'checker',density:.5}});s.point(2,2);
 assert.equal(count(p,RED),8);assert.equal(count(p,BLUE),8);
 const q=P0(4,4),t=new Stroke(q,{value:RED,value2:null,size:4,dither:{pattern:'checker',density:.5}});t.point(2,2);assert.equal(count(q,RED),8);assert.equal(count(q,0),8);
 const m=R.maskFromRect(4,4,{x:0,y:0,w:2,h:4}),z=P0(4,4),u=new Stroke(z,{value:RED,size:4,limit:m});u.point(2,2);assert.equal(count(z,RED),8);
});
test('shape strokes redraw from the snapshot on every move (line tool preview)', ()=>{
 const p=P0(10,10);p.data[99]=GREEN;const s=new Stroke(p,{value:RED});
 s.shape(R.linePoints(0,0,9,0));s.shape(R.linePoints(0,0,0,9));
 assert.equal(count(p,RED),10);assert.equal(at(p,5,0),0);assert.equal(at(p,9,9),GREEN);
 const i=R.plane(4,4,R.INDEXED,0),t=new Stroke(i,{kind:R.INDEXED,value:3});t.shape(R.rectPixels(0,0,3,3));assert.equal(i.data.filter(v=>v===3).length,12);
});
// ------------------------------------------------------------------ indexed colour + PNG-8
const PAL=[[0,0,0,0],[0,0,0,255],[255,0,0,255],[0,0,255,255],[255,255,255,255],[255,0,0,255]];
test('indexed: exact, nearest (never the transparent index), transparency, ordered dither', ()=>{
 const rgba=Uint8Array.from([255,0,0,255, 250,10,5,255, 0,0,0,0, 0,0,0,255, 10,10,240,255, 1,1,1,255]);
 const {indices,offPalette}=I.indicesFromRGBA(rgba,6,1,PAL,{transparentIndex:0});
 assert.deepEqual([...indices],[2,2,0,1,3,1]);assert.equal(offPalette,3);
 assert.deepEqual([...I.rgbaFromIndices(indices,PAL,{transparentIndex:0})].slice(0,12),[255,0,0,255,255,0,0,255,0,0,0,0]);
 const grey=new Uint8Array(64*4);for(let i=0;i<64;i++)grey.set([128,128,128,255],i*4);
 const bw=[[0,0,0,0],[0,0,0,255],[255,255,255,255]];
 const d=I.indicesFromRGBA(grey,8,8,bw,{dither:{pattern:'bayer4'}});const whites=d.indices.filter(v=>v===2).length;assert.ok(whites>=10&&whites<=18,'~22 % white for 50 % sRGB grey: '+whites);
 assert.equal(new Set(I.indicesFromRGBA(grey,8,8,bw).indices).size,1,'no dither = one colour');
});
test('palette edits in indexed mode keep the picture: move, remove, sort; duplicates stay distinct', ()=>{
 const idx=Uint8Array.from([1,2,3,4,5,0]),before=I.rgbaFromIndices(idx,PAL);
 const mv=I.movePaletteEntries(PAL,[4,5],1);assert.deepEqual([...I.rgbaFromIndices(I.remap(idx,mv.map),mv.colors,{transparentIndex:mv.transparentIndex})],[...before]);
 assert.deepEqual(mv.colors[1],[255,255,255,255]);
 const rm=I.removePaletteEntries(PAL,[5]);const after=I.rgbaFromIndices(I.remap(idx,rm.map),rm.colors,{transparentIndex:rm.transparentIndex});assert.deepEqual([...after],[...before],'the duplicate red folds onto red');
 const so=I.sortPaletteEntries(PAL,'luminance');assert.deepEqual([...I.rgbaFromIndices(I.remap(idx,so.map),so.colors,{transparentIndex:so.transparentIndex})],[...before]);assert.equal(so.transparentIndex,0);
 // true indexed: two entries with the same colour are still two indices
 const dup=I.indicesFromRGBA(I.rgbaFromIndices(Uint8Array.from([2,5]),PAL),2,1,PAL);assert.deepEqual([...dup.indices],[2,2],'RGBA alone cannot tell them apart — which is why cels are stored indexed');
 const ex=I.exactPalette([{data:before}]);assert.equal(ex.colors.length,5);assert.deepEqual(ex.colors[0],[0,0,0,0]);
});
test('indexed PNG: encode → decode keeps indices and palette; decodePNG gives the same RGBA', async()=>{
 const w=13,h=7,idx=new Uint8Array(w*h);for(let i=0;i<idx.length;i++)idx[i]=(i*7)%PAL.length;
 const png=encodeIndexedPNG(idx,w,h,PAL,{transparentIndex:0}),back=decodeIndexedPNG(png);
 assert.deepEqual([...back.indices],[...idx]);assert.equal(back.colors.length,PAL.length);assert.deepEqual(back.colors[0],[0,0,0,0]);assert.deepEqual(back.colors[5],[255,0,0,255]);
 const rgba=await decodePNG(png);assert.deepEqual([...rgba.data],[...I.rgbaFromIndices(idx,PAL,{transparentIndex:0})]);
 assert.deepEqual(encodeIndexedPNG(idx,w,h,PAL),png,'deterministic bytes');
 const semi=encodeIndexedPNG(Uint8Array.from([1]),1,1,[[0,0,0,0],[10,20,30,128]],{transparentIndex:0});assert.deepEqual([...(await decodePNG(semi)).data],[10,20,30,128]);
});
// ------------------------------------------------------------------ palette files
test('palette files: GPL (Lospec header, CRLF, RGBA), JASC, RIFF, ASE swatches, ACT, HEX, JSON', ()=>{
 const lospec='GIMP Palette\r\n#Palette Name: PICO-8\r\n#Description: <a href="x">y</a>\r\n#Colors: 3\r\n0\t0\t0\t000000\r\n29\t43\t83\t1d2b53\r\n255\t241\t232\tfff1e8\r\n';
 const g=PIO.readPalette(lospec,'pico-8.gpl');assert.equal(g.name,'PICO-8');assert.deepEqual(g.colors[1],[29,43,83,255]);
 const rgba=[[1,2,3,255],[4,5,6,7]];const rt=PIO.readPalette(PIO.toGPL(rgba,{name:'X'}));assert.deepEqual(rt.colors,rgba);
 assert.deepEqual(PIO.readPalette(PIO.toJASC(g.colors)).colors,g.colors);
 const ase=PIO.toASEF(g.colors,{names:['a','b','c']}),ar=PIO.readPalette(ase,'x.ase');assert.deepEqual(ar.colors,g.colors);assert.deepEqual(ar.names,['a','b','c']);
 assert.deepEqual(PIO.readPalette(PIO.toACT(g.colors),'x.act').colors,g.colors);
 assert.deepEqual(PIO.readPalette('000000\n1d2b53\nfff1e8\n').colors,g.colors);
 assert.deepEqual(PIO.readPalette('{"name":"pico-8","author":"","colors":["000000","1d2b53","fff1e8"]}').colors,g.colors);
 // RIFF PAL
 const n=2,riff=new Uint8Array(24+n*4),v=new DataView(riff.buffer);riff.set([82,73,70,70]);v.setUint32(4,16+n*4,true);riff.set([80,65,76,32,100,97,116,97],8);v.setUint32(16,4+n*4,true);v.setUint16(20,0x300,true);v.setUint16(22,n,true);riff.set([9,8,7,0,1,2,3,0],24);
 assert.deepEqual(PIO.readPalette(riff,'x.pal').colors,[[9,8,7,255],[1,2,3,255]]);
 assert.throws(()=>PIO.readPalette('GIMP Palette\n300 0 0\n'),/above 255/);
 assert.throws(()=>PIO.readPalette('hello world'),/not a colour/);
 assert.equal(PIO.lospecSlug('Endesga 32'),'endesga-32');assert.equal(PIO.lospecURL('PICO-8'),'https://lospec.com/palette-list/pico-8.json');
});
// ------------------------------------------------------------------ ramps, audit
test('hue-shifted ramps keep the base colour, go dark → light, cool shadows and warm lights', ()=>{
 const base=[60,140,70],{colors,position}=hueShiftRamp(base,{steps:7,shift:30});
 assert.equal(colors.length,7);assert.deepEqual(colors[position],[60,140,70,255]);assert.ok(isRamp(colors));
 const hue=c=>okLCh(c)[2],b=hue(base),towards=(h,target)=>Math.abs(((target-h+540)%360)-180);
 assert.ok(towards(hue(colors[0]),265)<towards(b,265),'shadow is cooler');assert.ok(towards(hue(colors[6]),85)<towards(b,85),'highlight is warmer');
 const br=blendRamp([0,0,0],[255,255,255],5);assert.deepEqual(br[0],[0,0,0,255]);assert.deepEqual(br[4],[255,255,255,255]);assert.ok(isRamp(br));
});
test('palette audit: stray colours per frame, budget, near duplicates, stray mask', ()=>{
 const f=(cols)=>({id:'f',name:'f',width:cols.length,height:1,data:Uint8Array.from(cols.flat())});
 const pal=[[0,0,0,255],[255,0,0,255]];
 const r=auditFrames([f([[0,0,0,255],[255,0,0,255]]),f([[0,0,0,255],[250,0,0,255],[250,0,0,255],[1,1,1,255],[0,0,0,0]])],pal,{budget:2});
 assert.equal(r.frames[0].stray.length,0);assert.equal(r.frames[1].stray.length,2);assert.equal(r.frames[1].stray[0].count,2);assert.equal(r.frames[1].over,1);assert.equal(r.over,1);
 assert.ok(r.nearDuplicates.some(([a,b])=>a[0]+b[0]===1||a[0]+b[0]===1),'#000 and #010101 flagged');
 assert.equal(strayMask(f([[0,0,0,255],[9,9,9,255]]),pal).count,1);
});
// ------------------------------------------------------------------ document edits
function sprite(){
 let d=P.createProject({name:'t'});const a=PD.newSprite({name:'hero',width:8,height:8,blob:BLOB});d=P.addAssets(d,[a]);return {d,a};
}
test('document: cels, layers (add / duplicate / move / lock / remove), merge-down plan, palette + colour mode survive normalizeProject', ()=>{
 let {d,a}=sprite();const f=a.frames[0];
 d=PD.setCel(d,a.id,{layerId:'l1',frameId:f.id,blob:BLOB2,x:1,y:2});let A=P.assetById(d,a.id);assert.equal(A.cels.length,2);
 d=PD.setCel(d,a.id,{layerId:'l1',frameId:f.id,blob:BLOB3,x:0,y:0});A=P.assetById(d,a.id);assert.equal(A.cels.length,2);assert.equal(A.cels[1].blob,BLOB3);
 let r=PD.addLayer(d,a.id,{});d=r.doc;const top=r.id;A=P.assetById(d,a.id);assert.equal(A.layers.length,2);assert.equal(A.layers[1].id,top);
 d=PD.setCel(d,a.id,{layerId:top,frameId:P.SHARED,blob:BLOB2,x:0,y:0});
 const plan=PD.mergeDownPlan(P.assetById(d,a.id),top);assert.deepEqual(plan.moments.map(m=>m.frameId).sort(),[P.SHARED,f.id].sort());
 assert.equal(plan.moments.find(m=>m.frameId===f.id).above.frameId,P.SHARED,'the upper layer shows its shared picture on that frame');
 r=PD.duplicateLayer(d,a.id,top);d=r.doc;A=P.assetById(d,a.id);assert.equal(A.layers.length,3);assert.equal(A.cels.filter(c=>c.layerId===r.id).length,1);
 d=PD.moveLayer(d,a.id,r.id,0);assert.equal(P.assetById(d,a.id).layers[0].id,r.id);
 d=PD.setLayer(d,a.id,top,{locked:true,opacity:300,blend:'multiply'});A=P.assetById(d,a.id);const L=A.layers.find(l=>l.id===top);assert.equal(L.locked,true);assert.equal(L.opacity,255);
 d=PD.applyMergeDown(d,a.id,top,[{frameId:P.SHARED,blob:BLOB3,x:0,y:0}]);A=P.assetById(d,a.id);assert.equal(A.layers.length,2);assert.ok(!A.cels.some(c=>c.layerId===top));
 d=PD.setPalette(d,a.id,{colors:PAL});d=PD.setColorMode(d,a.id,'indexed',{transparentIndex:0});
 const round=P.normalizeProject(JSON.parse(JSON.stringify(d))),B=P.assetById(round,a.id);
 assert.equal(B.colorMode,'indexed');assert.equal(B.transparentIndex,0);assert.deepEqual(B.palette.colors,PAL);
 d=PD.setLayer(d,a.id,A.layers[1].id,{locked:true});assert.equal(P.assetById(P.normalizeProject(JSON.parse(JSON.stringify(d))),a.id).layers[1].locked,true);
 assert.throws(()=>PD.removeLayer(PD.removeLayer(d,a.id,A.layers[1].id),a.id,A.layers[0].id),/at least one layer/);
 const lone=PD.removeLayer(d,a.id,A.layers[0].id,{emptyBlob:BLOB});assert.ok(P.assetById(lone,a.id).cels.length>=1);
 assert.throws(()=>P.normalizeProject({...JSON.parse(JSON.stringify(d)),assets:[{...B,palette:{colors:[[1,2]]}}]}),/palette colour/);
});
test('document: a painted frame with a trimmed rect grows it (offset follows) so no pixel is lost', ()=>{
 let {d,a}=sprite();const f=a.frames[0];
 d=P.mapAsset(d,a.id,x=>({...x,frames:x.frames.map(q=>({...q,trimmedRect:{x:2,y:2,w:3,h:3},offsetX:4,offsetY:4,canvasWidth:10,canvasHeight:10}))}));
 d=PD.coverPainted(d,a.id,f.id,{x:1,y:3,w:1,h:1});const q=P.assetById(d,a.id).frames[0];
 assert.deepEqual(q.trimmedRect,{x:1,y:2,w:4,h:3});assert.equal(q.offsetX,3);assert.equal(q.offsetY,4);
 assert.equal(PD.coverPainted(d,a.id,f.id,{x:2,y:2,w:1,h:1}),d,'inside: unchanged document');
 assert.equal(PD.target(P.assetById(d,a.id),0).frameId,f.id);assert.equal(PD.target({...a,frames:[]},0).frameId,P.SHARED);
});
// ------------------------------------------------------------------ cleanup engine
/** A deterministic 1× sprite: blocks of a few colours with a 1-px outline and transparency. */
function sprite1x(w=24,h=20){
 const d=new Uint8Array(w*h*4),cols=[[40,32,60],[200,60,70],[250,200,90],[80,160,90],[60,90,200]];let seed=w*131+h;const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
 // single-pixel detail (like real pixel art), runs of 1–3 px of one colour inside a 1-px outline
 for(let y=2;y<h-2;y++){let c=cols[1],left=0;for(let x=3;x<w-3;x++){const edge=y===2||y===h-3||x===3||x===w-4;if(!left){c=cols[1+Math.floor(rnd()*4)];left=1+Math.floor(rnd()*3);}left--;d.set([...(edge?cols[0]:c),255],(y*w+x)*4);}}
 return {data:d,width:w,height:h};
}
function nearestUp(img,s,{offX=0,offY=0}={}){
 const W=Math.round(img.width*s)-offX,H=Math.round(img.height*s)-offY,d=new Uint8Array(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.min(img.width-1,Math.floor((x+offX)/s)),sy=Math.min(img.height-1,Math.floor((y+offY)/s));d.set(img.data.subarray((sy*img.width+sx)*4,(sy*img.width+sx)*4+4),(y*W+x)*4);}
 return {data:d,width:W,height:H};
}
/** Bilinear (centre-aligned, like Pillow's upscale) of straight RGBA. */
function bilinear(img,s){
 const W=Math.round(img.width*s),H=Math.round(img.height*s),d=new Uint8Array(W*H*4),g=(x,y,c)=>img.data[(Math.max(0,Math.min(img.height-1,y))*img.width+Math.max(0,Math.min(img.width-1,x)))*4+c];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=(x+.5)*img.width/W-.5,v=(y+.5)*img.height/H-.5,x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0;
  for(let c=0;c<4;c++)d[(y*W+x)*4+c]=Math.round(g(x0,y0,c)*(1-fx)*(1-fy)+g(x0+1,y0,c)*fx*(1-fy)+g(x0,y0+1,c)*(1-fx)*fy+g(x0+1,y0+1,c)*fx*fy);}
 return {data:d,width:W,height:H};
}
const accuracy=(a,b)=>{if(a.width!==b.width||a.height!==b.height)return 0;let same=0,n=a.width*a.height;for(let p=0;p<n;p++){const i=p*4,ta=a.data[i+3]<128,tb=b.data[i+3]<128;if(ta&&tb||(!ta&&!tb&&a.data[i]===b.data[i]&&a.data[i+1]===b.data[i+1]&&a.data[i+2]===b.data[i+2]))same++;}return same/n;};
test('grid: exact integer upscales (with an off-grid crop) are recovered exactly', ()=>{
 const src=sprite1x();
 for(const s of [2,3,4,6]){const up=nearestUp(src,s),g=S.findGrid(up);assert.equal(g.kind,'integer');assert.equal(g.scale,s);
  const r=runCleanup([up],{merge:0,fringe:false,alphaCut:null,background:'off'});assert.equal(accuracy(r.frames[0],src),1,`×${s}`);}
 const off=nearestUp(src,4,{offX:2,offY:1}),r=runCleanup([off],{merge:0,fringe:false,background:'off'});assert.equal(r.report.steps[0].scale,4);
});
test('grid: fractional nearest and bilinear resamples — scale within 1 %, 1× recovered', ()=>{
 const src=sprite1x(32,24);
 for(const [s,kind]of [[3.78,'bilinear'],[4.25,'bilinear'],[5.5,'bilinear'],[2.5,'nearest'],[3.3,'nearest'],[4.7,'nearest']]){
  const up=kind==='bilinear'?bilinear(src,s):nearestUp(src,s),g=S.findGrid(up);
  assert.ok(Math.abs(g.scale-s)/s<.01,`${kind} ×${s}: measured ${g.scale}`);
  const r=runCleanup([up],{background:'off'});const acc=accuracy(r.frames[0],src);
  assert.equal(r.frames[0].width,src.width,`${kind} ×${s} width`);assert.equal(r.frames[0].height,src.height,`${kind} ×${s} height`);
  assert.ok(acc>=.97,`${kind} ×${s}: ${(acc*100).toFixed(1)} % exact`);
 }
});
test('cleanup: JPEG-like noise merges back to the real colours; background removal; one palette for all frames', ()=>{
 const src=sprite1x(),up=nearestUp(src,4);let seed=7;const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
 const noisy={...up,data:Uint8Array.from(up.data,(v,i)=>i%4===3?v:Math.max(0,Math.min(255,v+Math.round((rnd()-.5)*10))))};
 const r=runCleanup([noisy],{background:'off'});assert.ok(r.report.colors<=6,`colours ${r.report.colors}`);assert.ok(accuracy(r.frames[0],src)>=.9);
 // opaque background → transparent
 const flat={...up,data:Uint8Array.from(up.data)};for(let i=0;i<flat.data.length;i+=4)if(!flat.data[i+3])flat.data.set([30,160,60,255],i);
 const bg=S.detectBackground(flat);assert.deepEqual(bg.color,[30,160,60]);const rb=runCleanup([flat],{});assert.ok(rb.report.steps.some(s=>s.id==='background'));assert.ok(accuracy(rb.frames[0],src)>=.99);
 // two frames: same palette
 const r2=runCleanup([up,nearestUp(src,4,{offX:1})],{merge:.04});assert.equal(r2.frames.length,2);assert.equal(r2.frames[0].width,r2.frames[1].width);
 assert.ok(analyse([src]).check.verdict==='unit'&&analyse([src]).grid===null,'1× art is left alone unless a scale is forced');
});
test('cleanup: quantize to a fixed palette (dither off by default), outline + shadow batch, frame alignment', ()=>{
 const src=sprite1x(),pal=[[0,0,0],[255,255,255],[200,50,50],[50,150,50],[50,50,200],[240,200,80]];
 const q=runCleanup([src],{palette:pal,background:'off'});const allowed=new Set(pal.map(c=>c.join(',')));
 for(let i=0;i<q.frames[0].data.length;i+=4)if(q.frames[0].data[i+3])assert.ok(allowed.has([...q.frames[0].data.subarray(i,i+3)].join(',')));
 const o=runCleanup([src],{background:'off',outline:{color:[255,255,255]},shadow:{color:[0,0,0],dx:1,dy:1}});assert.ok(o.report.steps.find(s=>s.id==='outline').changed>0);
 const moved=nearestUp(src,1,{offX:0,offY:0});const shifted={...moved,data:new Uint8Array(moved.data.length)};for(let y=0;y<moved.height-1;y++)shifted.data.set(moved.data.subarray(y*moved.width*4,(y+1)*moved.width*4),((y+1)*moved.width)*4);
 const al=runCleanup([moved,shifted],{snap:false,merge:0,fringe:false,background:'off',align:'overlap'});assert.deepEqual(al.report.steps.find(s=>s.id==='align').shifts[1],[0,-1]);
 assert.equal(accuracy(al.frames[1],al.frames[0]),1);
});
