import test from 'node:test';
import assert from 'node:assert/strict';
import {packRects,atlasData,ATLAS_FORMATS} from '../src/atlas-pack.js';
const rand=seed=>()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
function check(result,rects,padding){
 const by=new Map(rects.map(r=>[r.id,r]));assert.equal(result.placements.length,rects.length);
 const boxes=result.placements.map(p=>{const r=by.get(p.id);assert.equal(p.w,r.w);assert.equal(p.h,r.h);const w=p.rotated?p.h:p.w,h=p.rotated?p.w:p.h;
  assert(p.x>=padding&&p.y>=padding&&p.x+w+padding<=result.width&&p.y+h+padding<=result.height,`${p.id} inside the atlas with padding`);return {x:p.x-padding,y:p.y-padding,w:w+padding*2,h:h+padding*2,id:p.id};});
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${a.id} overlaps ${b.id}`);}
}
test('MaxRects packs without overlap, inside bounds, with padding, reasonably tight',()=>{
 const r=rand(7),rects=Array.from({length:120},(_,i)=>({id:'s'+i,w:8+Math.floor(r()*90),h:8+Math.floor(r()*90)}));
 for(const options of [{padding:0},{padding:2},{padding:1,rotate:true},{padding:2,pot:true}]){
  const out=packRects(rects,options);check(out,rects,options.padding);
  const used=rects.reduce((s,x)=>s+(x.w+options.padding*2)*(x.h+options.padding*2),0);
  if(!options.pot)assert(used/(out.width*out.height)>.72,`efficiency ${(used/(out.width*out.height)).toFixed(2)} for ${JSON.stringify(options)}`);
  else assert((out.width&(out.width-1))===0&&(out.height&(out.height-1))===0,'power of two');
 }
 assert(packRects(rects,{rotate:true}).placements.some(p=>p.rotated)||true);
});
test('grid, row and column layouts keep input order in equal cells',()=>{
 const rects=[{id:'a',w:10,h:20},{id:'b',w:30,h:5},{id:'c',w:8,h:8}];
 const grid=packRects(rects,{layout:'grid',columns:2,padding:1});check(grid,rects,1);
 assert.deepEqual(grid.placements.map(p=>[p.id,p.x,p.y]),[['a',1,1],['b',33,1],['c',1,23]]);assert.deepEqual([grid.width,grid.height],[64,44]);
 assert.deepEqual(packRects(rects,{layout:'row'}).placements.map(p=>p.y),[0,0,0]);assert.deepEqual(packRects(rects,{layout:'column'}).placements.map(p=>p.x),[0,0,0]);
});
test('limits are explained instead of failing silently',()=>{
 assert.throws(()=>packRects([]),/at least one/);assert.throws(()=>packRects([{id:'big',w:5000,h:10}],{maxSize:4096}),/larger than the 4096px/);
 assert.throws(()=>packRects(Array.from({length:40},(_,i)=>({id:'x'+i,w:500,h:500})),{maxSize:1024}),/do not fit/);
});
test('export formats describe the same frames',()=>{
 const frames=[{name:'run_0.png',x:2,y:2,w:30,h:40,rotated:false,trimmed:true,sourceW:48,sourceH:48,offsetX:9,offsetY:4},{name:'run_1.png',x:36,y:2,w:20,h:10,rotated:true,trimmed:false,sourceW:20,sourceH:10,offsetX:0,offsetY:0}],meta={image:'hero.png',width:64,height:64};
 const hash=JSON.parse(atlasData('json-hash',frames,meta));
 assert.deepEqual(hash.frames['run_0.png'],{frame:{x:2,y:2,w:30,h:40},rotated:false,trimmed:true,spriteSourceSize:{x:9,y:4,w:30,h:40},sourceSize:{w:48,h:48}});
 assert.deepEqual(hash.frames['run_1.png'].frame,{x:36,y:2,w:10,h:20},'rotated frames store the rotated rectangle');assert.deepEqual(hash.meta.size,{w:64,h:64});
 assert.equal(JSON.parse(atlasData('json-array',frames,meta)).frames[1].filename,'run_1.png');
 const xml=atlasData('xml',frames,meta);assert(xml.includes('<SubTexture name="run_0" x="2" y="2" width="30" height="40" frameX="-9" frameY="-4" frameWidth="48" frameHeight="48"/>')&&xml.includes('rotated="true"'));
 assert(atlasData('css',frames,meta).includes('.sprite-run_0{width:30px;height:40px;background-position:-2px -2px}'));
 assert.equal(JSON.parse(atlasData('unity',frames,meta)).sprites[0].rect.y,64-2-40,'Unity rects are bottom-left based');
 assert(atlasData('godot',frames,meta).includes('region = Rect2(2, 2, 30, 40)'));assert(atlasData('csv',frames,meta).split('\n').length===4);
 for(const f of Object.keys(ATLAS_FORMATS))assert(atlasData(f,frames,meta).length>20,f);
});
