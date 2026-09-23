import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import * as F from '../src/game/ui/font/formats.js';
import {gridFontModel,suggestKerning} from '../src/game/ui/font/build.js';
import {decodePNG} from '../src/game/texture-png.js';
const model=(over={})=>({face:'Test "Face"',size:16,type:'bitmap',distanceRange:0,lineHeight:20,base:15,ascender:15,descender:-5,lineGap:0,unitsPerEm:1000,
 padding:[1,1,1,1],spacing:[2,2],pages:[{file:'t_0.png',width:64,height:32},{file:'t_1.png',width:64,height:32}],
 glyphs:[{id:65,page:0,x:1,y:2,w:9,h:11,xoffset:0,yoffset:4,xadvance:10,advance:.625,plane:{left:.03125,bottom:-.03125,right:.53125,top:.6875}},
  {id:0xac00,page:1,x:3,y:4,w:14,h:14,xoffset:-1,yoffset:2,xadvance:16,advance:1,plane:{left:0,bottom:-.1,right:.9,top:.8}},{id:32,page:0,x:0,y:0,w:0,h:0,xoffset:0,yoffset:0,xadvance:4,advance:.25,plane:null}],
 kerning:[{first:65,second:0xac00,amount:-2,em:-.125},{first:65,second:65,amount:0,em:.01}],...over});
const same=(parsed,m)=>{
 assert.equal(parsed.common.lineHeight,m.lineHeight);assert.equal(parsed.common.base,m.base);assert.equal(parsed.common.pages,m.pages.length);
 assert.deepEqual(parsed.pages,m.pages.map(p=>p.file));
 assert.deepEqual(parsed.chars.map(c=>[c.id,c.x,c.y,c.width,c.height,c.xoffset,c.yoffset,c.xadvance,c.page]),m.glyphs.map(g=>[g.id,g.x,g.y,g.w,g.h,g.xoffset,g.yoffset,g.xadvance,g.page]));
 assert.deepEqual(parsed.kernings.map(k=>[k.first,k.second,k.amount]),[[65,0xac00,-2]],'zero-pixel pairs are not written');
};
test('BMFont text, XML and binary (v3) write the same font and read back identically',()=>{
 const m=model();
 same(F.parseBMFont(F.fntText(m)),m);same(F.parseBMFont(F.fntXML(m)),m);same(F.parseBMFont(F.fntBinary(m)),m);
 const bin=F.fntBinary(m);assert.deepEqual([...bin.subarray(0,4)],[66,77,70,3]);
 // block 1 is 14 fixed bytes + face + NUL; the face keeps its quote in binary, text replaces it
 assert.equal(new DataView(bin.buffer).getInt32(5,true),14+'Test "Face"'.length+1);
 assert.match(F.fntText(m),/^info face="Test 'Face'" size=16 /);
 assert.equal(F.parseBMFont(F.fntBinary(m)).info.face,'Test "Face"');
 assert.equal(F.parseBMFont(F.fntText(m)).common.alphaChnl,0);assert.equal(F.parseBMFont(F.fntText(m)).common.redChnl,4,'bitmap: white glyph in alpha');
});
test('distance-field fonts carry the msdf-bmfont-xml distanceField record; binary refuses them',()=>{
 const m=model({type:'msdf',distanceRange:4});
 assert.match(F.fntText(m),/\ndistanceField fieldType=msdf distanceRange=4\n/);
 assert.deepEqual(F.parseBMFont(F.fntText(m)).distanceField,{fieldType:'msdf',distanceRange:4});
 assert.deepEqual(F.parseBMFont(F.fntXML(m)).distanceField,{fieldType:'msdf',distanceRange:4});
 assert.throws(()=>F.fntBinary(m),/no field for distance-field/);
 const back=F.modelFromBMFont(F.parseBMFont(F.fntText(m)));assert.equal(back.type,'msdf');assert.equal(back.distanceRange,4);
});
test('msdf-atlas-gen JSON: texel-centre quads, bottom origin by default, em-unit metrics and kerning',()=>{
 const j=F.msdfAtlasJSON(model({type:'mtsdf',distanceRange:4,pages:[{file:'t.png',width:64,height:32}],glyphs:model().glyphs.map(g=>({...g,page:0}))}));
 assert.deepEqual(j.atlas,{type:'mtsdf',distanceRange:4,distanceRangeMiddle:0,size:16,width:64,height:32,yOrigin:'bottom'});
 const a=j.glyphs[0];assert.deepEqual(a.atlasBounds,{left:1.5,bottom:32-12.5,right:9.5,top:32-2.5});
 assert.deepEqual(a.planeBounds,{left:.03125,bottom:-.03125,right:.53125,top:.6875});
 assert.equal(j.glyphs[2].planeBounds,undefined,'a space has an advance only');
 assert.deepEqual(j.kerning,[{unicode1:65,unicode2:0xac00,advance:-.125},{unicode1:65,unicode2:65,advance:.01}],'sub-pixel pairs survive in em units');
 assert.equal(j.metrics.lineHeight,1.25);assert.equal(j.metrics.ascender,.9375);
 const top=F.msdfAtlasJSON(model({pages:[{file:'t.png',width:64,height:32}],glyphs:[model().glyphs[0]]}),{yOrigin:'top'});
 assert.deepEqual(top.glyphs[0].atlasBounds,{left:1.5,bottom:12.5,right:9.5,top:2.5});
 const multi=F.msdfAtlasJSON(model());assert.equal(multi.atlas.pages,2);assert.equal(multi.glyphs[1].page,1);
});
test('layoutText applies advances, offsets and kerning; missing characters are reported',()=>{
 const l=F.layoutText(model(),'A가?\nA');
 assert.deepEqual(l.items.map(i=>[i.id,i.x,i.y,!!i.missing]),[[65,0,4,false],[0xac00,10-2-1,2,false],[63,24,0,true],[65,0,24,false]]);
});
test('grid pixel font: measured widths, empty cells advance, overrides and hand kerning; suggestions from shapes',()=>{
 // 3×1 grid of 6×8 cells: "A" is a 5-wide block, "V" a 3-wide bar, the third cell (space) is empty
 const W=18,H=8,d=new Uint8ClampedArray(W*H*4);const ink=(x,y)=>d.set([255,255,255,255],(y*W+x)*4);
 for(let y=1;y<7;y++)for(let x=0;x<5;x++)ink(x,y);
 for(let y=1;y<7;y++)for(let x=7;x<10;x++)ink(x,y);
 const m=gridFontModel({width:W,height:H,data:d},{cellW:6,cellH:8,cols:3,rows:1,ox:0,oy:0,sx:0,sy:0},{chars:'AV ',baseline:7,spacing:1,spaceAdvance:3,overrides:{86:{xadvance:6}},kerning:[{first:65,second:86,amount:-1}]});
 assert.deepEqual(m.glyphs.map(g=>[g.id,g.x,g.y,g.w,g.h,g.yoffset,g.xadvance]),[[65,0,1,5,6,1,6],[86,7,1,3,6,1,6],[32,0,0,0,0,0,3]]);
 assert.deepEqual(m.kerning,[{first:65,second:86,amount:-1,em:-.125}]);
 const text=F.parseBMFont(F.fntText(m));assert.equal(text.chars.length,3);assert.equal(text.common.base,7);
 assert.throws(()=>gridFontModel({width:W,height:H,data:d},{cellW:6,cellH:8,cols:3,rows:1,ox:0,oy:0,sx:0,sy:0},{chars:'ABCD'}),/4 characters for 3 cells/);
 // a glyph with a slanted right side against a flat-left glyph: the pair sits further apart than typical
 const W2=24,d2=new Uint8ClampedArray(W2*8*4),ink2=(x,y)=>d2.set([255,255,255,255],(y*W2+x)*4);
 for(let y=0;y<8;y++)for(let x=0;x<=Math.floor(y/2);x++)ink2(x,y);            // "L"-ish wedge, wide at the bottom
 for(let y=0;y<8;y++){ink2(8,y);ink2(9,y);}                                    // "I"
 for(let y=0;y<8;y++)for(let x=Math.floor(y/2);x<=3;x++)ink2(16+x,y);        // "V"-ish: its left side slants the other way
 const m2=gridFontModel({width:W2,height:8,data:d2},{cellW:8,cellH:8,cols:3,rows:1,ox:0,oy:0,sx:0,sy:0},{chars:'LIV',baseline:8,spacing:1});
 const s=suggestKerning({width:W2,height:8,data:d2},m2);
 // L then V: the slants never meet, every row is at least 4 px apart → the tightest suggestion
 assert.deepEqual([s.pairs[0].first,s.pairs[0].second],[76,86]);assert.equal(s.pairs[0].gap,4);assert.equal(s.pairs[0].amount,s.typical-4);assert.equal(s.pairs[0].confidence,'high');
 assert.ok(!s.pairs.some(p=>p.first===73&&p.second===73),'I I sits at the typical gap');
});
const COZ='C:/Users/2009s/nerulio-asset-corpus/fonts/cozette-bmfont/Cozette-standard.fnt';
test('a real BMFont (Cozette, 2129 chars) reads, rewrites and reads back unchanged',{skip:!existsSync(COZ)},async()=>{
 const p=F.parseBMFont(await readFile(COZ,'utf8'));assert.equal(p.chars.length,2129);
 const m=F.modelFromBMFont(p);
 for(const out of [F.fntText(m),F.fntXML(m),F.fntBinary(m)]){const b=F.parseBMFont(out);assert.deepEqual(b.chars.map(c=>[c.id,c.x,c.y,c.width,c.height,c.xoffset,c.yoffset,c.xadvance,c.page]),p.chars.map(c=>[c.id,c.x,c.y,c.width,c.height,c.xoffset,c.yoffset,c.xadvance,c.page||0]));}
});
const BEL='C:/Users/2009s/nerulio-asset-corpus/fonts/oga-bitmap-font-bellanger/font.png';
test('Bellanger 8×12 sheet (corpus): 94 measured glyphs, advances from ink',{skip:!existsSync(BEL)},async()=>{
 const img=await decodePNG(new Uint8Array(await readFile(BEL)));
 const chars=Array.from({length:96},(_,i)=>String.fromCharCode(32+i)).join('');
 const m=gridFontModel(img,{cellW:8,cellH:12,cols:16,rows:6,ox:0,oy:0,sx:0,sy:0},{chars,baseline:9});
 assert.equal(m.glyphs.filter(g=>g.w).length,94);
 assert.ok(m.glyphs.find(g=>g.id===0x57).xadvance>m.glyphs.find(g=>g.id===0x69).xadvance,'W is wider than i');
});
