/** Pure helpers behind the Lab trust fixes: autotile art that contradicts its slot, palette
 * swaps, animations from file names, and the ko/en/ja parity of the new copy. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodePNG} from '../src/game/texture-png.js';
import {artMismatch,sideLine,lineDifference} from '../src/game/autotile-check.js';
import {LAYOUTS} from '../src/game/autotile.js';
import {cropRGBA,detectGrid as detectTileGrid} from '../src/game/tile-grid.js';
const detectTileGridForKind=(img,kind)=>detectTileGrid(img.data,img.width,img.height,{kind})[0];
import {imagePalette,swapColors,parseHex} from '../src/game/palette-swap.js';
import {animationKey,groupAnimations,naturalCompare,sharedCanvas} from '../src/game/animation-names.js';
import {TRUST_STRINGS} from '../src/task/strings-trust.js';
import {canvas,box} from './game-fixtures.mjs';

function blobSheet(size=16){
 const l=LAYOUTS.blob47,img=canvas(8*size,6*size),rim=Math.max(1,Math.round(size/8));
 for(const s of l.slots){const x=s.col*size,y=s.row*size;box(img,x,y,size,size,[86,160,70,255]);
  const R=[52,96,44,255];if(!s.edges.n)box(img,x,y,size,rim,R);if(!s.edges.s)box(img,x,y+size-rim,size,rim,R);if(!s.edges.w)box(img,x,y,rim,size,R);if(!s.edges.e)box(img,x+size-rim,y,rim,size,R);}
 return img;
}
const tiles=(img,size,cols)=>i=>{const c=i%cols,r=Math.floor(i/cols);if((r+1)*size>img.height)return null;return {data:cropRGBA(img.data,img.width,img.height,{x:c*size,y:r*size,w:size,h:size}),w:size,h:size};};

test('B11: art that matches every blob-47 slot passes; two swapped tiles are named',()=>{
 const img=blobSheet(),at=tiles(img,16,8);
 const ok=artMismatch('blob47',at);
 assert(ok.measurable);assert.equal(ok.checked,47);assert.deepEqual(ok.mismatches,[]);
 const swapped=artMismatch('blob47',i=>at(i===3?5:i===5?3:i));
 assert.deepEqual(swapped.mismatches.map(m=>m.slot).sort((a,b)=>a-b),[3,5]);
 assert(swapped.mismatches.every(m=>m.sides.length>0));
});
test('B11 on real art: a template in another slot order is reported, not called complete',async()=>{
 const png=await decodePNG(new Uint8Array(await readFile(new URL('./fixtures/game/cc0/oga-caeles-blob47-16px.png',import.meta.url))));
 const img={data:new Uint8ClampedArray(png.data.buffer),width:png.width,height:png.height};
 const r=artMismatch('blob47',tiles(img,16,7));
 assert(r.measurable);assert(r.mismatches.length>0);
});
test('art checks say "not measurable" instead of guessing',()=>{
 assert.equal(artMismatch('corner16',()=>null).measurable,false);
 assert.equal(artMismatch('blob47',()=>null).measurable,false);
 const flat=canvas(16,16,[9,9,9,255]);
 assert.equal(artMismatch('edge16',()=>({data:flat.data,w:16,h:16})).measurable,false,'connected and open sides look alike');
 const t=canvas(4,4);box(t,0,0,4,1,[255,0,0,255]);
 assert.equal(lineDifference(sideLine({data:t.data,w:4,h:4},'n'),sideLine({data:t.data,w:4,h:4},'s')),(255+2*255)/5,'alpha counts double');
});
test('B17: the palette is the exact colours, most used first; several swaps in one pass, no chaining',()=>{
 const img=canvas(4,1);img.data.set([255,0,0,255, 255,0,0,255, 0,0,255,255, 0,0,0,0]);
 const pal=imagePalette(img);
 assert.deepEqual(pal.colors.map(c=>[c.hex,c.count]),[['#ff0000',2],['#0000ff',1]]);assert.equal(pal.total,3);
 const out=swapColors(img,[{from:'#ff0000',to:'#0000ff'},{from:'#0000ff',to:'#00ff00'}]);
 assert.deepEqual([...out.data.subarray(0,12)],[0,0,255,255, 0,0,255,255, 0,255,0,255],'red became blue and blue became green — not red→green');
 assert.equal(out.changed,3);assert.deepEqual(out.perRule,[2,1]);
 assert.deepEqual([...out.data.subarray(12)],[0,0,0,0],'transparent pixels untouched');
 const ramp=canvas(2,1);ramp.data.set([200,40,40,255, 160,20,20,255]);
 const shaded=swapColors(ramp,[{from:[200,40,40],to:[40,40,200],tolerance:80,shading:true}]);
 assert.deepEqual([...shaded.data],[40,40,200,255, 0,20,180,255],'shading keeps the ramp');
 assert.throws(()=>parseHex('red'),/RRGGBB/);
});
test('B18: frames group into animations by name, numbers sort as numbers',()=>{
 for(const [name,base,index] of [['walk_01.png','walk',1],['walk-2.png','walk',2],['attack 3.png','attack',3],['hero_run_0.png','hero_run',0],['player_walk1.png','player_walk',1],['idle.png','idle',null],['12.png','12',12]])
  assert.deepEqual([animationKey(name).base,animationKey(name).index],[base,index],name);
 const names=['walk_10.png','attack_1.png','walk_2.png','walk_1.png','attack_0.png','Walk-3.png','idle.png'];
 const groups=groupAnimations(names);
 assert.deepEqual(groups.map(g=>[g.name,g.frames.map(i=>names[i])]),[
  ['walk',['walk_1.png','walk_2.png','Walk-3.png','walk_10.png']],['attack',['attack_0.png','attack_1.png']],['idle',['idle.png']]]);
 assert(naturalCompare('a2','a10')<0);
 const shared=sharedCanvas([{w:10,h:20},{w:14,h:18}]);
 assert.deepEqual(shared,{w:14,h:20,offsets:[{x:2,y:0},{x:0,y:2}]});
});
test('engine baseline fixes: generic JSON is also a TexturePacker hash, Godot defaults to nearest, trim keeps faint pixels',async()=>{
 const {genericBundle}=await import('../src/game/exporters/generic-json.js');
 const {godotProject,GODOT_HELPER}=await import('../src/game/exporters/godot.js');
 const {frame,animation}=await import('../src/game/model.js');
 const {framesFromRects}=await import('../src/game/frame-ops.js');
 const f=frame({id:'a',name:'run_0',sourceRect:{x:0,y:0,w:10,h:12},trimmedRect:{x:2,y:3,w:5,h:6}});
 const project={frames:[f],animations:[animation({name:'run',frameIds:['a']})],atlas:{frames:{a:{x:4,y:5,w:5,h:6,page:0}},pages:1,width:16,height:16}};
 const data=JSON.parse(genericBundle(project)[0].text).frames.run_0;
 assert.deepEqual([data.frame,data.spriteSourceSize,data.sourceSize,data.trimmed],[{x:4,y:5,w:5,h:6},{x:2,y:3,w:5,h:6},{w:10,h:12},true]);
 assert.equal(godotProject(project).meta.godot.textureFilter,'nearest');
 assert.match(GODOT_HELPER,/TEXTURE_FILTER_NEAREST/);
 const img=canvas(8,8);box(img,2,2,3,3,[255,255,255,255]);img.data.set([255,255,0,3],(6*8+6)*4);// a faint glow pixel, alpha 3
 const t=framesFromRects(img,[{x:0,y:0,w:8,h:8}]).frames[0].trimmedRect;
 assert.deepEqual(t,{x:2,y:2,w:5,h:5},'the alpha-3 pixel stays inside the trimmed frame');
});
test('the rule set is a prior for the tile grid: a 32px edge16 template is read as 4×4, not 8×8',()=>{
 const img=canvas(128,128);
 for(let i=0;i<16;i++){const x=(i%4)*32,y=Math.floor(i/4)*32;box(img,x,y,32,32,[118,135,171,255]);
  for(let k=0;k<4;k++)if(i>>k&1)box(img,x+[12,20,12,0][k],y+[0,12,20,12][k],[8,12,8,12][k],[12,8,12,8][k],[230,200,120,255]);box(img,x+8,y+8,16,16,[200,220,230,255]);}
 const top=detectTileGridForKind(img,'edge16');
 assert.deepEqual([top.tileWidth,top.cols,top.rows],[32,4,4]);
});
test('the trust copy exists in ko, en and ja with the same keys',()=>{
 const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?keys(v,p+k+'.'):[p+k]).sort();
 const en=keys(TRUST_STRINGS.en);
 for(const l of ['ko','ja'])assert.deepEqual(keys(TRUST_STRINGS[l]),en,l);
 const vars=s=>[...String(s).matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join();
 const at=(o,k)=>k.split('.').reduce((x,p)=>x[p],o);
 for(const k of en)for(const l of ['ko','ja'])assert.equal(vars(at(TRUST_STRINGS[l],k)),vars(at(TRUST_STRINGS.en,k)),`${l} ${k}`);
});
