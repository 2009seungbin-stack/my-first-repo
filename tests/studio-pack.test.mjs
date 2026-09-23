/** Studio Pack & Export (P1b): packer invariants, trim/alias/scale/extrude/rotation pixels,
 * determinism, every exporter's schema, GIF/APNG containers, the document adapter and string
 * parity. Engine loading is tools/engine-verify (docs/STUDIO-PACK.md); the UI is
 * tests/studio-pack-browser.py. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {MaxRectsBin,SkylineBin,GuillotineBin,MAXRECTS_HEURISTICS} from '../src/game/pack/bins.js';
import {layoutPages,regionOf} from '../src/game/pack/layout.js';
import {prepareSprites,renderPage,readSprite,canvasOf,compose} from '../src/game/pack/sprites.js';
import {packAtlas,publicResult,normalizePackSettings,scaleSuffix} from '../src/game/pack/packer.js';
import {encodePNG,paletteOf} from '../src/game/pack/png.js';
import {decodePNG} from '../src/game/texture-png.js';
import {TARGETS,TARGET_IDS,settingsFor} from '../src/game/export/targets.js';
import {buildBundle,animationFrames} from '../src/game/export/bundle.js';
import {asepriteSequence,asepriteJson} from '../src/game/export/atlas-json.js';
import {encodeGIF,encodeAPNG,medianCut} from '../src/game/export/anim.js';
import {muxWebM} from '../src/game/export/webm.js';
import {modelFromDoc,commonName,sourceKey} from '../src/game/export/project-model.js';
import {readAseprite,renderFrame} from '../src/game/aseprite.js';
import {getFrameSelection,setFrameSelection,onFrameSelection} from '../src/studio/core/frame-selection.js';
import * as P from '../src/studio/core/project.js';
import {PACK_STRINGS} from '../src/studio/strings-pack.js';

let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
const rects=(n,min=4,max=60)=>Array.from({length:n},(_,i)=>({id:'r'+i,w:min+Math.floor(rnd()*(max-min)),h:min+Math.floor(rnd()*(max-min))}));
const overlap=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
/** Layout invariants: every footprint (sprite + extrude belt, grown by padding) is on its page,
 * inside the border, and no two footprints come closer than the shape padding. */
function assertLayout(items,res,s){
 const seen=new Set(),e=s.extrude||0,p=s.shapePadding??2,b=s.borderPadding||0;
 for(const pg of res.pages){
  assert.ok(pg.width<=s.maxWidth&&pg.height<=s.maxHeight,`page ${pg.width}×${pg.height} over the limit`);
  const boxes=pg.placements.map(pl=>{const r=regionOf(pl);return {id:pl.id,x:r.x-e,y:r.y-e,w:r.w+2*e,h:r.h+2*e};});
  for(const q of boxes){
   assert.ok(!seen.has(q.id),`${q.id} placed twice`);seen.add(q.id);
   assert.ok(q.x>=b&&q.y>=b&&q.x+q.w<=pg.width-b&&q.y+q.h<=pg.height-b,`${q.id} leaves the page/border`);
  }
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],c=boxes[j],grown={x:a.x-p,y:a.y-p,w:a.w+2*p,h:a.h+2*p};
   assert.ok(!overlap(p?{...grown,x:grown.x+1,y:grown.y+1,w:grown.w-2,h:grown.h-2}:a,c),`${a.id} and ${c.id} closer than padding ${p}`);
  }
 }
 assert.equal(seen.size,items.length,'every sprite placed exactly once');
}
test('every MaxRects heuristic, Skyline and Guillotine place without overlap inside the bin',()=>{
 const list=rects(120);
 const bins=[...MAXRECTS_HEURISTICS.map(h=>()=>new MaxRectsBin(700,700,{heuristic:h,rotate:true})),()=>new SkylineBin(700,700,{rotate:true}),()=>new SkylineBin(700,700,{heuristic:'waste'}),()=>new GuillotineBin(700,700,{rotate:true})];
 for(const make of bins){
  const bin=make(),placed=[];
  for(const r of list){const n=bin.insert(r.w,r.h);assert.ok(n,'fits');assert.equal(n.rot?[n.h,n.w].join():[n.w,n.h].join(),[r.w,r.h].join());placed.push(n);}
  for(const n of placed)assert.ok(n.x>=0&&n.y>=0&&n.x+n.w<=700&&n.y+n.h<=700);
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)assert.ok(!overlap(placed[i],placed[j]),`${bin.constructor.name} overlap`);
 }
});
test('layout respects padding, border, extrude, limits and places every sprite once (all size modes)',()=>{
 const items=rects(90,3,50);
 for(const s of [{shapePadding:2},{shapePadding:0},{shapePadding:3,borderPadding:4,extrude:2},{shapePadding:1,allowRotation:true},{sizeMode:'pot'},{sizeMode:'square'},{sizeMode:'pot-square',shapePadding:1},
  {sizeMode:'fixed',fixedWidth:600,fixedHeight:500},{multipleOf:8},{algorithm:'skyline'},{algorithm:'guillotine'},{heuristic:'cp'},{effort:'fast'}]){
  const full={maxWidth:4096,maxHeight:4096,shapePadding:2,...s},res=layoutPages(items,full);
  if(full.sizeMode!=='fixed'){full.maxWidth=4096;full.maxHeight=4096;}else{full.maxWidth=600;full.maxHeight=500;}
  assertLayout(items,res,full);
  const pg=res.pages[0];
  if(s.sizeMode==='pot'||s.sizeMode==='pot-square')assert.ok([pg.width,pg.height].every(v=>(v&(v-1))===0),'power of two');
  if(s.sizeMode==='square'||s.sizeMode==='pot-square')assert.equal(pg.width,pg.height);
  if(s.sizeMode==='fixed')assert.deepEqual([pg.width,pg.height],[600,500]);
  if(s.multipleOf)assert.ok(pg.width%8===0&&pg.height%8===0);
 }
});
test('a grid of equal frames packs into a tight, sane page (no one-column strip)',()=>{
 const res=layoutPages(Array.from({length:60},(_,i)=>({id:'s'+i,w:48,h:48})),{shapePadding:2});
 const pg=res.pages[0];assert.equal(pg.placements.length,60);
 assert.ok(Math.max(pg.width,pg.height)/Math.min(pg.width,pg.height)<=3,`aspect ${pg.width}×${pg.height}`);
 assert.ok(60*48*48/(pg.width*pg.height)>.9,'over 90 % used');
});
test('multipack splits over pages of the maximum size and never loses a sprite; the limit is honoured',()=>{
 const items=rects(400,10,60),res=layoutPages(items,{maxWidth:512,maxHeight:512,shapePadding:2});
 assert.ok(res.pages.length>1);assertLayout(items,res,{maxWidth:512,maxHeight:512,shapePadding:2});
 assert.throws(()=>layoutPages(items,{maxWidth:512,maxHeight:512,multipack:false}),/do not fit one/);
 assert.throws(()=>layoutPages(items,{maxWidth:512,maxHeight:512,maxPages:2}),/more than 2 pages/);
 assert.throws(()=>layoutPages([{id:'big',w:600,h:10}],{maxWidth:512,maxHeight:512}),e=>e.code==='too-big');
});
test('layout is deterministic: same input, same settings → identical result',()=>{
 const items=rects(200,5,70);
 const a=JSON.stringify(layoutPages(items,{allowRotation:true,shapePadding:2})),b=JSON.stringify(layoutPages(items.map(x=>({...x})),{allowRotation:true,shapePadding:2}));
 assert.equal(a,b);
});
// ------------------------------------------------------------------ pixels
function sheet(w,h,fill){const d=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)d.set(fill(x,y),(y*w+x)*4);return {width:w,height:h,data:d};}
// 4 cells of 10×8: an asymmetric shape per cell, cell 2 identical to cell 0, cell 3 empty
const SRC=sheet(40,8,(x,y)=>{const c=Math.floor(x/10),lx=x%10;if(c===3)return [0,0,0,0];const k=c===2?0:c;
 return lx>=2+k&&lx<7&&y>=1&&y<(k?7:5)?[40*lx+k,10*y,200-k,lx===2+k?128:255]:[9,9,9,0];});
const FRAMES=[0,1,2,3].map(i=>({id:'f'+i,name:'cell_'+i,src:'s',rect:{x:i*10,y:0,w:10,h:8},canvasW:10,canvasH:8,offX:0,offY:0,pivotX:.5,pivotY:1}));
const cellOf=i=>{const out=new Uint8Array(10*8*4);for(let y=0;y<8;y++)out.set(SRC.data.subarray((y*40+i*10)*4,(y*40+i*10+10)*4),y*40);return out;};
const visible=d=>{const o=new Uint8Array(d);for(let i=0;i<o.length;i+=4)if(!o[i+3])o[i]=o[i+1]=o[i+2]=0;return o;};
test('trim keeps size and position; crop-keep moves the pivot; none keeps full frames; empty frames become one clear pixel',()=>{
 const src={s:SRC};
 const [t0,t1,,t3]=prepareSprites(FRAMES,src,{trimMode:'trim'});
 assert.deepEqual([t0.w,t0.h,t0.ox,t0.oy,t0.sourceW,t0.sourceH,t0.trimmed],[5,4,2,1,10,8,true]);
 assert.deepEqual([t3.w,t3.h,t3.trimmed],[1,1,true]);
 for(const [i,sp] of [[0,t0],[1,t1]])assert.deepEqual(visible(canvasOf(sp).data),visible(cellOf(i)),'trim undone = the original cell');
 const [k0]=prepareSprites(FRAMES,src,{trimMode:'crop-keep'});
 assert.deepEqual([k0.w,k0.sourceW,k0.ox],[5,5,0]);
 assert.ok(Math.abs(k0.pivotX*5+2-.5*10)<1e-9&&Math.abs(k0.pivotY*4+1-8)<1e-9,'pivot moved with the crop so the art stays put');
 const [n0]=prepareSprites(FRAMES,src,{trimMode:'none'});assert.deepEqual([n0.w,n0.h,n0.trimmed],[10,8,false]);
 const [c0]=prepareSprites(FRAMES,src,{trimMode:'crop'});assert.deepEqual([c0.w,c0.sourceW,c0.ox,c0.pivotX],[5,5,0,.5]);
});
test('identical frames are stored once (hash + byte check); RGB under alpha 0 does not break identity, one visible pixel does',()=>{
 const sp=prepareSprites(FRAMES,{s:SRC},{trimMode:'trim'});
 assert.equal(sp[2].aliasOf,'f0');assert.equal(sp[1].aliasOf,null);
 const s2=sheet(20,4,(x,y)=>x<10?[1,2,3,x===0?0:255]:[x===10?200:1,2,3,x===10?0:255]);
 const fr=[0,1].map(i=>({id:'g'+i,src:'s',rect:{x:i*10,y:0,w:10,h:4},canvasW:10,canvasH:4,offX:0,offY:0}));
 assert.equal(prepareSprites(fr,{s:s2},{trimMode:'none'})[1].aliasOf,'g0');
 const s3=sheet(20,4,(x,y)=>[x===15&&y===2?2:1,2,3,255]);
 assert.equal(prepareSprites(fr,{s:s3},{trimMode:'none'})[1].aliasOf,null);
 assert.equal(prepareSprites(FRAMES,{s:SRC},{dedupe:false})[2].aliasOf,null);
});
test('pages hold exactly the stored pixels, rotated 90° clockwise where rotated, with the extrude belt copied from the edge',()=>{
 const tall=sheet(3,40,(x,y)=>[x*50,y*6,7,255]);// forces rotation into a short page
 const frames=[{id:'t',src:'a',rect:{x:0,y:0,w:3,h:40},canvasW:3,canvasH:40,offX:0,offY:0},...Array.from({length:8},(_,i)=>({id:'w'+i,src:'b',rect:{x:0,y:0,w:40,h:3},canvasW:40,canvasH:3,offX:0,offY:0}))];
 const wide=sheet(40,3,(x,y)=>[x*6,y*80,90,255]);
 for(const extrude of [0,2]){
  const r=packAtlas(frames,{a:tall,b:wide},{allowRotation:true,trimMode:'none',dedupe:false,extrude,shapePadding:1,maxWidth:64,maxHeight:64});
  const v=r.variants[0],pg=v.pages[0],img=renderPage(pg,v.sprites,{extrude});
  const rot=pg.placements.filter(p=>p.rotated);assert.ok(rot.length>0,'something was rotated');
  for(const pl of pg.placements){const sp=v.sprites.get(pl.id);assert.deepEqual(readSprite(img,pl,sp.w,sp.h),sp.data,`${pl.id} reads back exactly`);}
  if(extrude){const pl=pg.placements[0],reg=regionOf(pl),W=img.width,at=(x,y)=>[...img.data.subarray((y*W+x)*4,(y*W+x)*4+4)];
   assert.deepEqual(at(reg.x-1,reg.y-1),at(reg.x,reg.y),'corner belt = corner pixel');assert.deepEqual(at(reg.x+reg.w+1,reg.y+2),at(reg.x+reg.w-1,reg.y+2));}
 }
 // clockwise: the sprite's top-left pixel lands on the region's top-right
 const r=packAtlas([frames[0]],{a:tall},{allowRotation:true,trimMode:'none',maxWidth:64,maxHeight:8,shapePadding:0});
 const pl=r.variants[0].pages[0].placements[0],img=renderPage(r.variants[0].pages[0],r.variants[0].sprites);
 assert.equal(pl.rotated,true);assert.deepEqual([...img.data.subarray(((pl.y)*img.width+pl.x+39)*4,((pl.y)*img.width+pl.x+39)*4+4)],[0,0,7,255]);
});
test('Spine pages store rotated regions counter-clockwise and read back exactly',()=>{
 const tall=sheet(3,40,(x,y)=>[x*50,y*6,7,255]);
 const r=packAtlas([{id:'t',src:'a',rect:{x:0,y:0,w:3,h:40},canvasW:3,canvasH:40,offX:0,offY:0}],{a:tall},{allowRotation:true,trimMode:'none',maxWidth:64,maxHeight:8,shapePadding:0});
 const v=r.variants[0],pl=v.pages[0].placements[0],img=renderPage(v.pages[0],v.sprites,{rotation:'ccw'});
 assert.equal(pl.rotated,true);
 assert.deepEqual(readSprite(img,pl,3,40,{rotation:'ccw'}),v.sprites.get('t').data);
 assert.deepEqual([...img.data.subarray(((pl.y+2)*img.width+pl.x)*4,((pl.y+2)*img.width+pl.x)*4+4)],[0,0,7,255],'top-left pixel lands bottom-left');
});
test('scale variants are nearest-neighbour (@2x = every pixel doubled) and named @2x',()=>{
 const r=packAtlas(FRAMES.slice(0,2),{s:SRC},{scales:[1,2,0.5],trimMode:'none'});
 assert.deepEqual(r.variants.map(v=>v.suffix),['','@2x','@0.5x']);
 const one=r.variants[0].sprites.get('f1'),two=r.variants[1].sprites.get('f1');
 assert.deepEqual([two.w,two.h],[20,16]);
 for(let y=0;y<16;y++)for(let x=0;x<20;x++)assert.deepEqual([...two.data.subarray((y*20+x)*4,(y*20+x)*4+4)],[...one.data.subarray((Math.floor(y/2)*10+Math.floor(x/2))*4,(Math.floor(y/2)*10+Math.floor(x/2))*4+4)]);
 assert.deepEqual([r.variants[2].sprites.get('f1').w,r.variants[2].sprites.get('f1').h],[5,4]);
 assert.equal(scaleSuffix(3),'@3x');
});
test('premultiplied pages multiply colour by alpha; the default keeps straight alpha byte-exact',()=>{
 const r=packAtlas([FRAMES[0]],{s:SRC},{trimMode:'trim'}),v=r.variants[0];
 const straight=renderPage(v.pages[0],v.sprites),pm=renderPage(v.pages[0],v.sprites,{premultiply:true});
 let semi=0;for(let i=0;i<straight.data.length;i+=4)if(straight.data[i+3]===128){semi++;assert.equal(pm.data[i],Math.round(straight.data[i]*128/255));}
 assert.ok(semi>0);
});
test('packAtlas is deterministic end to end, including the PNG bytes; indexed PNG is lossless',async()=>{
 const a=packAtlas(FRAMES,{s:SRC},{allowRotation:true}),b=packAtlas(FRAMES,{s:SRC},{allowRotation:true});
 assert.equal(JSON.stringify(publicResult(a)),JSON.stringify(publicResult(b)));
 const pa=renderPage(a.variants[0].pages[0],a.variants[0].sprites),pb=renderPage(b.variants[0].pages[0],b.variants[0].sprites);
 const [ea,eb]=[await encodePNG(pa),await encodePNG(pb)];assert.deepEqual(ea,eb);
 const back=await decodePNG(ea);assert.deepEqual(visible(back.data),visible(pa.data),'PNG round trip is exact (visible pixels)');
 assert.ok(paletteOf(pa.data),'few colours → indexed');
 const rgba=await decodePNG(await encodePNG(pa,{indexed:'never'}));assert.deepEqual(rgba.data,pa.data,'RGBA PNG keeps every byte');
 assert.ok(!new TextDecoder('latin1').decode(ea).includes('gAMA'),'no colour-management chunk');
});
test('settings are validated with readable errors',()=>{
 assert.throws(()=>normalizePackSettings({shapePadding:-1}),/Shape padding/);
 assert.throws(()=>normalizePackSettings({trimMode:'x'}),/trim mode/);
 assert.throws(()=>normalizePackSettings({scales:[0]}),/Scale/);
 assert.throws(()=>normalizePackSettings({algorithm:'skyline',heuristic:'cp'}),/no heuristic/);
});
// ------------------------------------------------------------------ exporters
function project(){
 const frames=FRAMES.map((f,i)=>({id:f.id,name:f.name,canvasW:10,canvasH:8,pivotX:.5,pivotY:1,duration:i===1?250:null,tag:'',boxes:i===0?[{id:'b1',type:'hit',shape:'rect',x:1,y:1,w:3,h:2}]:[],collision:[]}));
 return {name:'hero',frames,animations:[{id:'a',name:'walk',frameIds:['f0','f1','f2'],fps:10,direction:'forward',loop:true,repeat:0},{id:'b',name:'hit',frameIds:['f1','f0'],fps:10,direction:'pingpong',loop:false,repeat:2}]};
}
async function bundle(target,extra={}){
 const {settings}=settingsFor(target,{...TARGETS[target].preset,...extra});
 const packed=packAtlas(FRAMES,{s:SRC},settings);
 const b=await buildBundle(target,project(),packed,{base:'hero'});
 const files=Object.fromEntries(b.files.map(f=>[f.name,f.bytes]));
 const text=n=>new TextDecoder().decode(files[n]);
 return {b,files,text,packed};
}
test('every target builds; rotation-less engines refuse a rotated pack and their presets never rotate',async()=>{
 for(const id of TARGET_IDS){if(TARGETS[id].browserOnly)continue;const {b}=await bundle(id);assert.ok(b.files.length>0,id);}
 for(const id of ['godot4','unity','phaser','love','starling','css','aseprite-json'])assert.equal(settingsFor(id,{allowRotation:true}).settings.allowRotation,false,id);
 const {godotFiles}=await import('../src/game/export/godot.js');
 const packed=publicResult(packAtlas([{id:'t',src:'a',rect:{x:0,y:0,w:3,h:40},canvasW:3,canvasH:40,offX:0,offY:0}],{a:sheet(3,40,()=>[1,1,1,255])},{allowRotation:true,trimMode:'none',maxWidth:64,maxHeight:8,shapePadding:0}));
 assert.throws(()=>godotFiles({name:'x',frames:[{id:'t',name:'t',canvasW:3,canvasH:40,pivotX:.5,pivotY:1}],animations:[{name:'a',frameIds:['t'],fps:1}]},packed.variants[0]),e=>e.code==='rotation');
});
test('Godot: SpriteFrames .tres with relative page path, AtlasTexture region+margin, relative durations, loop; scene is Nearest',async()=>{
 const {text}=await bundle('godot4');
 const tres=text('hero.tres'),scene=text('hero.tscn');
 assert.match(tres,/^\[gd_resource type="SpriteFrames" load_steps=\d+ format=3\]/);
 assert.match(tres,/\[ext_resource type="Texture2D" path="hero\.png" id="1_page"\]/);
 assert.match(tres,/region = Rect2\(\d+, \d+, 5, 4\)\nmargin = Rect2\(2, 1, 5, 4\)/,'trim restored by margin');
 assert.match(tres,/"duration": 2\.5,/,'250 ms at 10 fps = 2.5');
 assert.match(tres,/"loop": false,\n"name": &"hit"/);
 assert.match(tres,/"name": &"walk",\n"speed": 10\.0/);
 assert.match(scene,/texture_filter = 1/);assert.match(scene,/offset = Vector2\(-5\.0, -8\.0\)/);
});
test('Aseprite JSON: TexturePacker frames + per-frame ms, frameTags as contiguous from..to, repeat, pivot and box slices',async()=>{
 const {text}=await bundle('aseprite-json');
 const j=JSON.parse(text('hero.json'));
 const {seq,tags}=asepriteSequence(project());
 assert.deepEqual(seq,['f0','f1','f2','f1','f0','f3'],'hit (f1,f0) is not a run of walk, so it gets its own entries');
 assert.deepEqual(j.meta.frameTags.map(t=>[t.name,t.from,t.to,t.direction,t.repeat]),[['walk',0,2,'forward',undefined],['hit',3,4,'pingpong','2']]);
 assert.deepEqual(Object.keys(j.frames),['0','1','2','3','4','5']);
 assert.equal(j.frames['1'].duration,250);assert.equal(j.frames['0'].duration,100);
 assert.deepEqual(j.frames['0'].sourceSize,{w:10,h:8});assert.deepEqual(j.frames['0'].spriteSourceSize,{x:2,y:1,w:5,h:4});
 assert.deepEqual(j.meta.slices.map(s=>s.name),['pivot','hit']);
 assert.equal(asepriteJson(project(),publicResult(packAtlas(FRAMES,{s:SRC},{})).variants[0],{names:'title'}).text.includes('"hero 0.aseprite"'),true);
});
test('Phaser: atlas hash (unrotated w/h), anims.fromJSON with absolute ms, yoyo, repeat counts extra plays',async()=>{
 const {text}=await bundle('phaser');
 const atlas=JSON.parse(text('hero.json')),anims=JSON.parse(text('hero.anims.json'));
 assert.deepEqual(atlas.frames.cell_0.frame.w,5);assert.equal(atlas.meta.image,'hero.png');
 const hit=anims.anims.find(a=>a.key==='hit'),walk=anims.anims.find(a=>a.key==='walk');
 assert.deepEqual([hit.yoyo,hit.repeat,hit.frames.length],[true,1,2]);
 assert.deepEqual(walk.frames.map(f=>[f.key,f.frame,f.duration]),[['hero','cell_0',100],['hero','cell_1',250],['hero','cell_2',100]]);
 assert.equal(walk.repeat,-1);
 const multi=await bundle('phaser',{maxWidth:8,maxHeight:8,shapePadding:0});
 const m=JSON.parse(multi.text('hero.multiatlas.json'));assert.ok(m.textures.length>1);assert.ok(m.textures.every(t=>t.frames.every(f=>f.filename)));
});
test('Pixi: animations in playback order (ping-pong baked), anchors = pivots, related_multi_packs for pages',async()=>{
 const {text}=await bundle('pixi');const j=JSON.parse(text('hero.json'));
 assert.deepEqual(j.animations.hit,['cell_1','cell_0']);
 assert.deepEqual(j.frames.cell_0.anchor,{x:.5,y:1});
 assert.deepEqual(j.meta.nerulio.animations.walk.durationsMs,[100,250,100]);
 const multi=await bundle('pixi',{maxWidth:8,maxHeight:8,shapePadding:0,allowRotation:false});
 const first=JSON.parse(multi.text('hero-0.json'));assert.ok(first.meta.related_multi_packs.length>=1);
});
test('Unity: rects flipped to bottom-left, pivots inside the rect (y up), one clip per tag with ms per key',async()=>{
 const {text,packed}=await bundle('unity');const j=JSON.parse(text('hero.unity.json'));
 const pg=packed.variants[0].pages[0],e=packed.variants[0].frames.f0,s=j.unity.sprites.find(x=>x.name==='cell_0');
 assert.deepEqual(s.rect,{x:e.x,y:pg.height-(e.y+e.h),width:5,height:4});
 assert.deepEqual(s.pivot,{x:(5-2)/5,y:(4-(8-1))/4});
 assert.deepEqual(j.unity.clips.find(c=>c.name==='walk').frames.map(f=>f.durationMs),[100,250,100]);
 assert.equal(j.meta.engineTarget,'unity-2022');
 assert.match(text('Editor/NerulioSpriteImporter.cs'),/static void CreateClips\(string folder, UnityBlock block\)/);
});
test('GameMaker strips are named name_stripN with a pivot-aligned cell; Defold atlas/tilesource syntax; LÖVE table; Spine offsets from the bottom',async()=>{
 const gm=await bundle('gamemaker');assert.ok(gm.files['spr_hero_walk_strip3.png']&&gm.files['spr_hero_hit_strip2.png']);
 const g=JSON.parse(gm.text('gamemaker.json'));assert.deepEqual([g.sprites[0].width,g.sprites[0].xorigin,g.sprites[0].yorigin,g.verified],[10,5,8,false]);
 const strip=await decodePNG(gm.files['spr_hero_walk_strip3.png']);assert.deepEqual([strip.width,strip.height],[30,8]);
 const df=await bundle('defold');assert.equal(df.b.root,'assets/hero');
 assert.match(df.text('hero.atlas'),/animations \{\n  id: "hit"[\s\S]*playback: PLAYBACK_ONCE_PINGPONG\n  fps: 10/);
 assert.match(df.text('hero.tilesource'),/tile_width: 10\ntile_height: 8/);
 const lv=await bundle('love');const lua=lv.text('hero.lua');
 assert.match(lua,/\["cell_0"\] = \{ page = 1, x = \d+, y = \d+, w = 5, h = 4, ox = 2, oy = 1, sw = 10, sh = 8, px = 5, py = 8 \}/);
 assert.match(lua,/\["walk"\] = \{ loop = true, frames = \{ "cell_0", "cell_1", "cell_2" \}, durations = \{ 0\.1, 0\.25, 0\.1 \} \}/);
 const sp=await bundle('spine');assert.match(sp.text('hero.atlas'),/cell_0\nbounds:\d+,\d+,5,4\noffsets:2,3,10,8/);
});
test('Starling XML writes negative frameX for trimmed frames; the Phaser 3 preset turns trim off; CSS and generic JSON',async()=>{
 const st=await bundle('starling');assert.match(st.text('hero.xml'),/name="cell_0" x="\d+" y="\d+" width="5" height="4" frameX="-2" frameY="-1" frameWidth="10" frameHeight="8"/);
 const p3=await bundle('sparrow-phaser3');assert.doesNotMatch(p3.text('hero.xml'),/frameX/);
 const css=await bundle('css');assert.match(css.text('hero.css'),/\.sprite-cell_0\{width:10px;height:8px;background-position:-?\d+px -?\d+px;\}/);
 const js=await bundle('json');const j=JSON.parse(js.text('hero.nerulio.json'));
 assert.deepEqual([j.schemaVersion,j.engineTarget],[1,'generic']);
 assert.deepEqual(j.animations.walk,['cell_0','cell_1','cell_2'],'Pixi-readable animations');
 assert.deepEqual(j.animationData.hit.playback.frames,['cell_1','cell_0']);
 assert.deepEqual(j.frames.cell_0.boxes[0].type,'hit');
});
test('.aseprite export opens with our reader: tags, durations and pixels on one pivot-aligned canvas',async()=>{
 const {files}=await bundle('aseprite');const doc=readAseprite(files['hero.aseprite']);
 assert.deepEqual(doc.tags.map(t=>[t.name,t.from,t.to]),[['walk',0,2],['hit',3,4]]);
 assert.deepEqual(doc.frames.slice(0,3).map(f=>f.duration),[100,250,100]);
 const f0=renderFrame(doc,0);assert.deepEqual(visible(f0.rgba),visible(cellOf(0)));
});
// ------------------------------------------------------------------ GIF / APNG / WebM
function chunks(png){const out=[];for(let at=8;at<png.length;){const n=new DataView(png.buffer,png.byteOffset+at).getUint32(0),type=String.fromCharCode(...png.subarray(at+4,at+8));out.push({type,data:png.subarray(at+8,at+8+n)});at+=12+n;}return out;}
test('APNG: one fcTL per frame with exact ms delays, IDAT then fdAT, num_plays from repeat',async()=>{
 const frames=[0,1].map(i=>({width:4,height:4,data:new Uint8Array(64).fill(i*100+5),delayMs:[100,250][i]}));
 const {bytes}=await encodeAPNG(frames,{loop:2}),c=chunks(bytes);
 assert.deepEqual(c.map(x=>x.type),['IHDR','acTL','fcTL','IDAT','fcTL','fdAT','IEND']);
 const fc=c.filter(x=>x.type==='fcTL').map(x=>{const v=new DataView(x.data.buffer,x.data.byteOffset);return [v.getUint16(20),v.getUint16(22)];});
 assert.deepEqual(fc,[[100,1000],[250,1000]]);
 assert.equal(new DataView(c[1].data.buffer,c[1].data.byteOffset).getUint32(4),2);
});
test('GIF: header, NETSCAPE loop (or none for play-once), one image per frame, delays in 1/100 s, exact palette when ≤255 colours',()=>{
 const frames=[0,1,2].map(i=>({width:3,height:2,data:new Uint8Array([255,0,0,255,0,255,0,255,0,0,0,0, 0,0,255,255,i*40,i*40,i*40,255,9,9,9,255]),delayMs:[100,250,83.3][i]}));
 const {bytes,exact,notes}=encodeGIF(frames,{loop:0});
 assert.equal(new TextDecoder().decode(bytes.subarray(0,6)),'GIF89a');assert.equal(exact,true);
 const s=Buffer.from(bytes).toString('latin1');assert.ok(s.includes('NETSCAPE2.0'));
 const gce=[...s.matchAll(/\x21\xf9\x04(.)(..)/gs)].map(m=>m[2].charCodeAt(0)|m[2].charCodeAt(1)<<8);assert.deepEqual(gce,[10,25,8]);
 assert.ok(notes.some(n=>/rounded/.test(n)));
 assert.ok(!Buffer.from(encodeGIF(frames,{loop:null}).bytes).toString('latin1').includes('NETSCAPE'));
 assert.equal(medianCut(new Map(Array.from({length:600},(_,i)=>[i*997%16777216,1+i%3])),255).length,255);
});
test('WebM muxer writes EBML + Segment with one video track and a SimpleBlock per frame',()=>{
 const w=muxWebM([{data:new Uint8Array([1,2,3]),timestampMs:0,key:true},{data:new Uint8Array([4,5]),timestampMs:100,key:false}],{width:64,height:32,durationMs:200});
 assert.deepEqual([...w.subarray(0,4)],[0x1a,0x45,0xdf,0xa3]);
 const s=Buffer.from(w).toString('latin1');assert.ok(s.includes('webm')&&s.includes('V_VP9'));
 assert.equal((s.match(/\xa3/g)||[]).length>=2,true);
});
test('animation preview frames follow playback order on one pivot-aligned cell',()=>{
 const packed=packAtlas(FRAMES,{s:SRC},{});const v={...publicResult(packed).variants[0],sprites:packed.variants[0].sprites};
 const anims=animationFrames(project(),v);
 assert.deepEqual(anims.map(a=>[a.name,a.frames.length]),[['walk',3],['hit',2]]);
 assert.deepEqual(visible(anims[0].frames[1].data),visible(cellOf(1)));assert.equal(anims[0].frames[1].delayMs,250);
});
// ------------------------------------------------------------------ document adapter, selection, strings
test('the document adapter: one composited source per sheet, loose images as whole frames, implicit animation named from the frames',()=>{
 const H1='a'.repeat(64),H2='b'.repeat(64);
 let d=P.addAssets(P.createProject({id:'p',name:'Untitled'}),[P.imageAsset({id:'a',name:'samurai.png',width:96,height:48,blob:H1})]);
 d=P.addFrames(d,'a',[{x:0,y:0,w:48,h:48},{x:48,y:0,w:48,h:48}]);
 let m=modelFromDoc(d);
 assert.equal(m.sources.length,1,'both frames composite from the one shared sheet');assert.equal(m.packFrames[1].rect.x,48);
 assert.deepEqual(m.model.implicitAnimation,{name:'samurai',frames:2,fps:12});
 d=P.addAssets(d,[P.imageAsset({id:'b',name:'run_1.png',width:8,height:8,blob:H2})]);
 m=modelFromDoc(d);assert.equal(m.sources.length,2);assert.equal(m.model.frames[2].name,'run_1');
 d=P.addTag(d,'a',{name:'idle',frameIds:d.assets[0].frames.map(f=>f.id),fps:8,repeat:3});
 m=modelFromDoc(d);assert.equal(m.model.implicitAnimation,null);assert.deepEqual([m.model.animations[0].loop,m.model.animations[0].repeat],[false,3]);
 assert.equal(commonName(['attack (1)','attack (2)','attack (10)']),'attack');assert.equal(commonName(['run_0','run_5']),'run');assert.equal(commonName(['a','b']),'default');
 assert.notEqual(sourceKey(d.assets[0],'x'),sourceKey(d.assets[1],'x'));
});
test('frame selection is shared, deduplicated, and reports who changed it',()=>{
 const seen=[];const off=onFrameSelection(s=>seen.push(s));
 setFrameSelection(['a','a','b'],'sprite');setFrameSelection(['a','b'],'pack');setFrameSelection(['c'],'pack');off();setFrameSelection([],'x');
 assert.deepEqual(seen.map(s=>[s.ids,s.source]),[[['a','b'],'sprite'],[['c'],'pack']]);assert.deepEqual(getFrameSelection().ids,[]);
});
test('Pack strings: ko/en/ja have the same keys and placeholders',()=>{
 const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?flat(v,p+k+'.'):[[p+k,[...String(v).matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join()]]);
 const en=Object.fromEntries(flat(PACK_STRINGS.en));
 for(const l of ['ko','ja']){const other=Object.fromEntries(flat(PACK_STRINGS[l]));assert.deepEqual(Object.keys(other).sort(),Object.keys(en).sort(),l);
  for(const k in en)assert.equal(other[k],en[k],`${l} ${k} placeholders`);}
 assert.ok(!JSON.stringify(PACK_STRINGS).match(/\bAI\b/),'no AI wording');
});
