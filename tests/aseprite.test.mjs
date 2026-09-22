import test from 'node:test';import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {inflateZlib,deflateZlib,ZlibError,adler32} from '../src/game/zlib.js';
import {blendRGBA,blendGray,mul8,BLEND_MODES} from '../src/game/aseprite-blend.js';
import {readAseprite,writeAseprite,renderFrame,renderLayer,celImage,documentFromImages,toSpriteProject,renderStrip,plainProperties,AsepriteError,TILE,DEFAULT_LIMITS} from '../src/game/aseprite.js';
import {playbackOrder,validateProject} from '../src/game/model.js';

const FIX=new URL('./fixtures/aseprite/',import.meta.url);
const fixture=name=>readFileSync(new URL(name,FIX));
let seed=7;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)&0x7fffffff;return seed/0x7fffffff;};
const canvas=(w,h,fill=[0,0,0,0])=>{const a=new Uint8Array(w*h*4);for(let i=0;i<w*h;i++)a.set(fill,i*4);return a;};
const rect=(img,w,x,y,rw,rh,c)=>{for(let j=y;j<y+rh;j++)for(let i=x;i<x+rw;i++)img.set(c,(j*w+i)*4);return img;};
const px=(img,w,x,y)=>[...img.subarray((y*w+x)*4,(y*w+x)*4+4)];

// ---------------------------------------------------------------------------------------------
// zlib, checked against node:zlib in both directions (independent implementation)
test('inflate decodes node:zlib output at every level and deflate output is accepted by node:zlib',()=>{
 const samples=[new Uint8Array(0),new Uint8Array([1]),new Uint8Array(70000)];
 for(let k=0;k<12;k++){const n=Math.floor(rnd()*90000),a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=k%3===0?rnd()*256:k%3===1?((i/29|0)%7)*30:(rnd()<.95&&i?a[i-1]:rnd()*5);samples.push(a);}
 for(const a of samples){
  for(const level of [0,1,6,9]){
   const z=zlib.deflateSync(a,{level}),r=inflateZlib(z,{size:a.length});
   assert.ok(r.complete&&!r.excess&&r.adlerOk,`level ${level} n=${a.length}`);
   assert.deepEqual(Buffer.from(r.data),Buffer.from(a));
   assert.deepEqual(Buffer.from(zlib.inflateSync(deflateZlib(a,{level}))),Buffer.from(a),`mine→node level ${level}`);
  }
 }
 assert.equal(adler32(new TextEncoder().encode('Wikipedia')),0x11E60398);
 // Fibonacci symbol frequencies force Huffman depths past 15 bits; the length-limited code must
 // stay complete or real zlib answers Z_DATA_ERROR (this broke Aseprite loads once).
 const fib=[1,1];while(fib.length<26)fib.push(fib.at(-1)+fib.at(-2));
 const skew=[];fib.forEach((n,sym)=>{for(let i=0;i<Math.min(n,4000);i++)skew.push(sym*9);});
 for(let i=skew.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[skew[i],skew[j]]=[skew[j],skew[i]];}
 const sk=Uint8Array.from(skew);
 for(const level of [1,6,9])assert.deepEqual(Buffer.from(zlib.inflateSync(deflateZlib(sk,{level}))),Buffer.from(sk),`skewed level ${level}`);
});
test('inflate is bomb-proof and rejects truncated or corrupt streams cleanly',()=>{
 const bomb=zlib.deflateSync(new Uint8Array(40_000_000));
 const t=performance.now(),r=inflateZlib(bomb,{size:4096});
 assert.ok(r.excess&&r.data.length===4096&&performance.now()-t<50,'decoding stops at the declared size');
 assert.throws(()=>inflateZlib(bomb,{maxOutput:1<<20}),ZlibError);
 const good=zlib.deflateSync(Buffer.from('hello aseprite '.repeat(500)));
 let flagged=0;for(let cut=0;cut<good.length-4;cut++){try{const r=inflateZlib(good.subarray(0,cut),{size:7500});if(r.truncated&&!r.complete)flagged++;}catch(e){assert.ok(e instanceof ZlibError,e.message);flagged++;}}
 assert.equal(flagged,good.length-4,'every truncation inside the deflate data is reported (thrown or truncated)');
 const tail=inflateZlib(good.subarray(0,good.length-4),{size:7500});assert.ok(tail.complete&&tail.adlerOk===null,'missing trailer only');
 const short=inflateZlib(good,{size:10000});assert.equal(short.complete,false);
 assert.throws(()=>inflateZlib(new Uint8Array([0x78,0x9c,0xff,0xff,0xff])),ZlibError);
 assert.throws(()=>inflateZlib(new Uint8Array([1,2,3])),/Not a zlib/);
});

// ---------------------------------------------------------------------------------------------
// Blend modes: arithmetic identities of Aseprite's integer blenders
test('blend modes follow Aseprite integer arithmetic',()=>{
 assert.equal(BLEND_MODES.length,19);
 assert.equal(mul8(255,255),255);assert.equal(mul8(128,128),64);assert.equal(mul8(0,200),0);
 for(let mode=0;mode<19;mode++){
  const d=new Uint8Array([10,20,30,0]);blendRGBA(d,0,200,100,50,255,255,mode);
  assert.deepEqual([...d],[200,100,50,255],`${BLEND_MODES[mode]} over transparent = source`);
  const e=new Uint8Array([10,20,30,0]);blendRGBA(e,0,200,100,50,255,128,mode);
  assert.deepEqual([...e],[200,100,50,128],`${BLEND_MODES[mode]} with opacity over transparent`);
 }
 const m=new Uint8Array([200,100,50,255]);blendRGBA(m,0,128,255,0,255,255,1);// multiply
 assert.deepEqual([...m],[mul8(200,128),100,0,255]);
 const s=new Uint8Array([200,100,50,255]);blendRGBA(s,0,100,100,100,255,255,17);// subtract
 assert.deepEqual([...s],[100,0,0,255]);
 const half=new Uint8Array([0,0,255,255]);blendRGBA(half,0,255,0,0,255,128,0);// normal 50%
 assert.deepEqual([...half],[128,0,127,255]);
 const g=new Uint8Array([100,255]);blendGray(g,0,50,255,255,1);assert.deepEqual([...g],[mul8(100,50),255]);
 // Aseprite quirk kept on purpose: grayscale Addition uses the Exclusion blender.
 const ga=new Uint8Array([100,255]),gx=new Uint8Array([100,255]);blendGray(ga,0,50,255,255,16);blendGray(gx,0,50,255,255,11);assert.deepEqual([...ga],[...gx]);
});

// ---------------------------------------------------------------------------------------------
// Writer → reader round trips (the writer's files are the committed-fixture substitute)
function featureDoc(){
 const W=24,H=16,frames=[];
 for(let f=0;f<4;f++){
  const bg=rect(canvas(W,H),W,0,0,W,H,[30,40,50,255]);
  const body=rect(canvas(W,H),W,4+f,4,6,8,[220,60,60,255]);
  const glow=rect(canvas(W,H),W,2,2,12,6,[40,200,90,160]);
  const still=rect(canvas(W,H),W,16,10,4,4,[250,250,0,255]); // identical every frame → linked cels
  frames.push({duration:[100,120,80,200][f],images:{0:bg,2:body,3:glow,4:still},cels:{2:{userData:f===1?{text:'cel note',color:'#ff000080',properties:null}:null}}});
 }
 return documentFromImages({width:W,height:H,frames,
  layers:[{name:'Background',background:true},{name:'char',type:'group'},{name:'body',parent:1,userData:{text:'body layer',color:null,properties:{'':{damage:3,tags:['a','b'],pos:{type:'point',value:{x:1,y:2}},ratio:0.5,on:true}}}},{name:'glow',parent:1,blendMode:'screen',opacity:200},{name:'still'}],
  tags:[{name:'walk',from:0,to:2,direction:'pingpong',repeat:2,color:'#00ff00ff'},{name:'idle',from:3,to:3,direction:'pingpong_reverse',repeat:0,userData:{text:'loop me',color:'#123456ff',properties:null}}],
  slices:[{name:'hitbox',keys:[{frame:0,x:4,y:4,w:6,h:8},{frame:2,x:6,y:4,w:6,h:8}]},{name:'pivot',keys:[{frame:0,x:0,y:0,w:24,h:16,pivot:{x:12,y:15}}]},{name:'panel',keys:[{frame:0,x:1,y:1,w:10,h:10,center:{x:3,y:3,w:4,h:4}}]}],
  userData:{text:'sprite note',color:null,properties:null}});
}
test('writer round-trips layers, groups, tags, slices, durations, user data and linked cels',()=>{
 const doc=featureDoc(),bytes=writeAseprite(doc),back=readAseprite(bytes,{strict:true});
 assert.equal(new DataView(bytes.buffer).getUint32(0,true),bytes.length,'header file size');
 assert.deepEqual(back.frames.map(f=>f.duration),[100,120,80,200]);
 assert.deepEqual(back.layers.map(l=>[l.name,l.type,l.parent,l.childLevel,l.background]),[['Background','image',-1,0,true],['char','group',-1,0,false],['body','image',1,1,false],['glow','image',1,1,false],['still','image',-1,0,false]]);
 assert.equal(back.layers[3].blendMode,2);assert.equal(back.layers[3].opacity,200);
 assert.deepEqual(back.tags.map(t=>[t.name,t.from,t.to,t.direction,t.repeat]),[['walk',0,2,'pingpong',2],['idle',3,3,'pingpong_reverse',0]]);
 assert.equal(back.tags[1].userData.text,'loop me');assert.equal(back.tags[0].userData.color,'#00ff00ff');
 assert.deepEqual(back.slices[0].keys.map(k=>[k.frame,k.x,k.y,k.w,k.h]),[[0,4,4,6,8],[2,6,4,6,8]]);
 assert.deepEqual(back.slices[1].keys[0].pivot,{x:12,y:15});assert.deepEqual(back.slices[2].keys[0].center,{x:3,y:3,w:4,h:4});
 assert.equal(back.userData.text,'sprite note');
 assert.deepEqual(plainProperties(back.layers[2].userData),{'':{damage:3,tags:['a','b'],pos:{x:1,y:2},ratio:0.5,on:true}});
 assert.equal(back.frames[1].cels[2].data.userData.text,'cel note');
 assert.deepEqual([1,2,3].map(f=>back.frames[f].cels[4].linkedFrame),[0,0,0],'identical cels become linked cels');
 assert.equal(back.frames[1].cels[2].linkedFrame,null);
 for(let f=0;f<4;f++)assert.deepEqual(renderFrame(back,f).rgba,renderFrame(doc,f).rgba,`frame ${f} pixels`);
 // Rewriting what was read is byte-stable (reader output is valid writer input).
 assert.deepEqual(writeAseprite(back),bytes);
});
test('compositing honours visibility, opacity, blend modes, groups and z-index',()=>{
 const doc=featureDoc(),{rgba}=renderFrame(doc,0),W=24;
 assert.deepEqual(px(rgba,W,0,0),[30,40,50,255],'background');
 assert.deepEqual(px(rgba,W,16,10),[250,250,0,255],'top layer');
 // body pixel under a 160-alpha screen glow at opacity 200
 const d=new Uint8Array([30,40,50,255]);blendRGBA(d,0,220,60,60,255,255,0);blendRGBA(d,0,40,200,90,160,200,2);
 assert.deepEqual(px(rgba,W,5,5),[...d]);
 doc.layers[1].visible=false;
 assert.deepEqual(px(renderFrame(doc,0).rgba,W,5,5),[30,40,50,255],'hidden group hides its children');
 assert.deepEqual(px(renderLayer(doc,2,0).rgba,W,5,5),[220,60,60,255],'renderLayer draws one layer even inside a hidden group');
 doc.layers[1].visible=true;
 doc.frames[0].cels[4].zIndex=-10;
 assert.deepEqual(px(renderFrame(doc,0).rgba,W,16,10),[250,250,0,255]);
 doc.frames[0].cels[0].zIndex=0;
 const c=doc.frames[0].cels[2];c.zIndex=5;// body jumps above glow
 assert.deepEqual(px(renderFrame(doc,0).rgba,W,5,5),[220,60,60,255]);
});
test('indexed and grayscale sprites round-trip and render through the palette',()=>{
 const W=8,H=8,pal=[[0,0,0,0],[255,0,0,255],[0,0,255,255],[10,20,30,128]];
 const img=rect(rect(canvas(W,H),W,1,1,3,3,[255,0,0,255]),W,4,4,2,2,[10,20,30,128]);
 const doc=documentFromImages({width:W,height:H,palette:pal,transparentIndex:0,frames:[{images:{0:img}}]});
 const back=readAseprite(writeAseprite(doc),{strict:true});
 assert.equal(back.colorMode,'indexed');assert.equal(back.palette.colors.length,16);
 const r=renderFrame(back,0);assert.deepEqual(px(r.rgba,W,2,2),[255,0,0,255]);assert.deepEqual(px(r.rgba,W,5,5),[10,20,30,128]);assert.deepEqual(px(r.rgba,W,0,0),[0,0,0,0]);
 assert.equal(r.indices[2*W+2],1);
 assert.throws(()=>documentFromImages({width:W,height:H,palette:pal,frames:[{images:{0:rect(canvas(W,H),W,0,0,1,1,[1,2,3,255])}}]}),/not in the palette/);
 const gimg=rect(canvas(W,H),W,2,2,3,3,[90,90,90,255]);
 const gdoc=readAseprite(writeAseprite(documentFromImages({width:W,height:H,grayscale:true,frames:[{images:{0:gimg}}]})),{strict:true});
 assert.equal(gdoc.colorMode,'grayscale');assert.deepEqual(px(renderFrame(gdoc,0).rgba,W,3,3),[90,90,90,255]);
});
test('tilemap layers render tiles with flips and round-trip',()=>{
 // 2 tiles of 2x2 RGBA: tile 0 empty (Aseprite convention), tile 1 = [R G / B W]
 const tiles=new Uint8Array(2*2*2*4);tiles.set([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255],16);
 const doc={width:4,height:2,colorMode:'rgba',transparentIndex:0,composeGroups:false,grid:{x:0,y:0,w:2,h:2},pixelRatio:{w:1,h:1},
  palette:{colors:new Uint8Array([0,0,0,255])},tags:[],slices:[],userData:null,
  tilesets:[{name:'ts',numTiles:2,tileWidth:2,tileHeight:2,baseIndex:1,pixels:tiles,matchFlips:{},userData:null,tileUserData:[]}],
  layers:[{index:0,name:'map',type:'tilemap',parent:-1,visible:true,opacity:255,blendMode:0,tilesetIndex:0}],
  frames:[{duration:100,cels:[{type:'tilemap',layer:0,frame:0,x:0,y:0,width:2,height:1,opacity:255,zIndex:0,tiles:new Uint32Array([1,1|TILE.XFLIP]),linkedFrame:null,data:{userData:null}}]}]};
 const back=readAseprite(writeAseprite(doc),{strict:true});
 assert.equal(back.tilesets[0].numTiles,2);assert.equal(back.layers[0].type,'tilemap');
 const {rgba}=renderFrame(back,0);
 assert.deepEqual([px(rgba,4,0,0),px(rgba,4,1,0),px(rgba,4,2,0),px(rgba,4,3,0)],[[255,0,0,255],[0,255,0,255],[0,255,0,255],[255,0,0,255]],'second tile is x-flipped');
 const d=celImage(back,back.frames[0].cels[0]);assert.equal(d.width,4);assert.equal(d.height,2);
 back.frames[0].cels[0].tiles[1]=1|TILE.DFLIP;
 assert.deepEqual(px(renderFrame(back,0).rgba,4,3,0),[0,0,255,255],'diagonal flip swaps x/y');
});

// ---------------------------------------------------------------------------------------------
// Model mapping
test('toSpriteProject maps frames, tags, slices and keeps the rest as metadata',()=>{
 const doc=readAseprite(writeAseprite(featureDoc()));
 const p=toSpriteProject(doc,{name:'hero'});
 assert.deepEqual(validateProject(p),[]);
 assert.equal(p.frames.length,4);assert.deepEqual(p.frames[2].sourceRect,{x:48,y:0,w:24,h:16});
 assert.deepEqual(p.frames.map(f=>f.duration),[100,120,80,200]);
 assert.equal(p.frames[0].pivotX,12/24);assert.equal(p.frames[0].pivotY,15/16);
 assert.deepEqual(p.frames[2].boxes.map(b=>[b.type,b.x,b.y,b.w,b.h]),[['hit',6,4,6,8]]);
 const walk=p.animations.find(a=>a.name==='walk'),idle=p.animations.find(a=>a.name==='idle');
 assert.equal(walk.direction,'pingpong');assert.equal(walk.loop,false);assert.equal(walk.metadata.aseprite.repeat,2);
 assert.deepEqual(playbackOrder(walk),[p.frames[0].id,p.frames[1].id,p.frames[2].id,p.frames[1].id]);
 assert.equal(idle.direction,'pingpong');assert.equal(idle.metadata.aseprite.direction,'pingpong_reverse');
 const m=p.metadata.aseprite.mapping;
 assert.deepEqual(m.find(x=>x.slice==='hitbox'),{slice:'hitbox',as:'box',type:'hit',basis:'name',confidence:'medium'});
 assert.equal(m.find(x=>x.slice==='panel').as,'nineSlice');
 assert.deepEqual(p.frames[0].metadata.aseprite.nineSlices[0].center,{x:3,y:3,w:4,h:4});
 const strip=renderStrip(doc);assert.equal(strip.width,96);
 assert.deepEqual(px(strip.rgba,96,24+16,10),[250,250,0,255]);
});

// ---------------------------------------------------------------------------------------------
// Robustness
test('hostile and damaged files fail with AsepriteError, never hang or crash',()=>{
 assert.throws(()=>readAseprite(new Uint8Array(10)),e=>e instanceof AsepriteError&&e.code==='truncated');
 const base=writeAseprite(featureDoc());
 const bad=base.slice();bad[4]=0;assert.throws(()=>readAseprite(bad),e=>e.code==='not-aseprite');
 const huge=base.slice();new DataView(huge.buffer).setUint16(8,60000,true);new DataView(huge.buffer).setUint16(10,60000,true);
 assert.throws(()=>readAseprite(huge),e=>e.code==='limit');
 for(let cut=0;cut<base.length;cut+=7){
  try{readAseprite(base.subarray(0,cut));}catch(e){assert.ok(e instanceof AsepriteError,`cut ${cut}: ${e.stack}`);}
 }
 let loaded=0,rejected=0;const t0=performance.now();
 for(let k=0;k<1500;k++){
  const b=base.slice(),n=1+Math.floor(rnd()*6);
  for(let i=0;i<n;i++){const at=Math.floor(rnd()*b.length);b[at]=rnd()<.3?0xff:rnd()<.5?0:Math.floor(rnd()*256);}
  try{const d=readAseprite(b,{limits:{maxCanvasPixels:1<<20,maxDecodedBytes:1<<24}});loaded++;for(let f=0;f<Math.min(2,d.frames.length);f++)renderFrame(d,f);}
  catch(e){assert.ok(e instanceof AsepriteError,`mutation ${k}: ${e.stack}`);rejected++;}
 }
 assert.ok(performance.now()-t0<20000,'fuzzing finishes quickly');
 assert.ok(loaded>0&&rejected>0,`${loaded} loaded, ${rejected} rejected`);
 // a zlib bomb inside a cel: declared 64x64 cel, stream inflates to 40 MB
 const bomb=zlib.deflateSync(new Uint8Array(40_000_000));
 const doc=featureDoc();doc.frames=[doc.frames[0]];doc.tags=[];doc.slices=[];
 const bytes=writeAseprite(doc,{deflate:b=>b.length===24*16*4?bomb:zlib.deflateSync(b)});
 const got=readAseprite(bytes);assert.ok(got.warnings.some(w=>/extra compressed data/.test(w)),got.warnings.join());
 assert.throws(()=>readAseprite(bytes,{strict:true}),AsepriteError);
 assert.ok(DEFAULT_LIMITS.maxDecodedBytes>=1<<28);
});

// ---------------------------------------------------------------------------------------------
// Committed fixtures written by real Aseprite (see tests/fixtures/aseprite/README.md)
const manifestUrl=new URL('manifest.json',FIX);
const manifest=existsSync(manifestUrl)?JSON.parse(readFileSync(manifestUrl,'utf8')):[];
for(const entry of manifest){
 test(`Aseprite-written fixture ${entry.file} matches Aseprite's own PNG export`,async()=>{
  const doc=readAseprite(fixture(entry.file),{strict:true});
  for(const [key,value] of Object.entries(entry.expect||{}))assert.deepEqual(key.split('.').reduce((o,k)=>o?.[k],doc),value,key);
  for(const {frame,rgba} of entry.frames){
   const ref=zlib.inflateSync(fixture(rgba)),got=renderFrame(doc,frame).rgba;
   let diff=0;for(let i=0;i<ref.length;i+=4){if(ref[i+3]===0&&got[i+3]===0)continue;for(let c=0;c<4;c++)diff=Math.max(diff,Math.abs(ref[i+c]-got[i+c]));}
   assert.equal(diff,0,`${entry.file} frame ${frame}`);
  }
 });
}

// Optional: full local corpus (not committed). Runs only when the folder exists.
const CORPUS='C:/Users/2009s/nerulio-asset-corpus/_adhoc/aseprite-io';
test('local corpus parses without errors (skipped when absent)',{skip:!existsSync(CORPUS)},()=>{
 const files=[];const walk=d=>{for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())walk(p);else if(/\.(ase|aseprite)$/i.test(n)&&!/\.rt\./.test(n))files.push(p);}};walk(CORPUS);
 for(const f of files){const d=readAseprite(readFileSync(f));assert.ok(d.frames.length>0,f);}
 assert.ok(files.length>=30,`${files.length} corpus files`);
});
