import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {Pipeline,previewDoc} from '../src/pipeline/runner.js';
import {splitSheet} from '../src/pipeline/sheet.js';
import {stickerBorder} from '../src/pipeline/border.js';
import {removeSolid,fitPlan,cropRectFor} from '../src/pipeline/steps.js';
import {probe,pngStill,zipFiles} from '../src/pipeline/encode.js';
import {checkSpec} from '../src/pipeline/specs.js';
import {resize,borderColor} from '../src/pipeline/raster.js';
import {decodePNG} from '../src/game/texture-png.js';
import {presetById,validateRecipe,RECIPE_SCHEMA,FIT_SPECS} from '../platform/recipe.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
/** A deterministic "AI emoji sheet": cols×rows round faces with dark outlines, anti-aliased, on an off-white
 * backdrop with mild noise, irregular spacing, and a small caption blob under every second face. */
function sheet(cols,rows,{cell=150,bg=[250,249,246],seed=7}={}){
 const w=cols*cell,h=rows*cell,d=new Uint8ClampedArray(w*h*4);let s=seed;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 for(let i=0;i<d.length;i+=4){const n=Math.round((rnd()-.5)*6);d[i]=bg[0]+n;d[i+1]=bg[1]+n;d[i+2]=bg[2]+n;d[i+3]=255;}
 const disc=(cx,cy,r,col,ring)=>{for(let y=Math.floor(cy-r-2);y<=cy+r+2;y++)for(let x=Math.floor(cx-r-2);x<=cx+r+2;x++){if(x<0||y<0||x>=w||y>=h)continue;const dd=Math.hypot(x+.5-cx,y+.5-cy);const cov=Math.min(1,Math.max(0,r+.5-dd));if(!cov)continue;const c=ring&&dd>r-ring?[30,26,24]:col,i=(y*w+x)*4;for(let k=0;k<3;k++)d[i+k]=Math.round(c[k]*cov+d[i+k]*(1-cov));}};
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const cx=c*cell+cell/2+(rnd()-.5)*cell*.12,cy=r*cell+cell*.45+(rnd()-.5)*cell*.1,R=cell*(.3+rnd()*.06);
  const col=[200+Math.round(rnd()*50),120+Math.round(rnd()*100),60+Math.round(rnd()*80)];
  disc(cx,cy,R,col,3);disc(cx-R*.35,cy-R*.1,R*.12,[30,26,24]);disc(cx+R*.35,cy-R*.1,R*.12,[30,26,24]);
  if((r+c)%2)for(let k=0;k<3;k++)disc(cx-R*.5+k*R*.5,cy+R+cell*.08,cell*.035,[40,40,40]);
 }
 return {items:[{name:'sheet',w,h,frames:[{data:d,ms:0}]}],notes:[]};
}
const pipe=()=>new Pipeline({worker:false});
const filesHash=r=>sha(Buffer.concat(r.exported.files.map(f=>Buffer.from(f.bytes))));

test('sheet.split finds a 6×4 grid, and adapts to 5×4 with the same recipe',()=>{
 const six=sheet(6,4).items[0],r6=splitSheet(six.frames[0].data,six.w,six.h,{mode:'auto',cols:6,rows:4,tolerance:40});
 assert.equal(r6.cells.length,24);assert.deepEqual([r6.cols,r6.rows],[6,4]);
 const five=sheet(5,4,{seed:3}).items[0],r5=splitSheet(five.frames[0].data,five.w,five.h,{mode:'auto',cols:6,rows:4,tolerance:40});
 assert.equal(r5.cells.length,20);assert.deepEqual([r5.cols,r5.rows],[5,4]);
 // Reading order: the first cell is top-left.
 assert.ok(r6.cells[0].x<150&&r6.cells[0].y<150);assert.ok(r6.cells[5].x>=600);
 // 'grid' divides the content box exactly.
 const g=splitSheet(six.frames[0].data,six.w,six.h,{mode:'grid',cols:3,rows:2,tolerance:40});
 assert.equal(g.cells.length,6);
});

test('bg.remove (solid backdrop) clears the backdrop and unmixes the edge (no white halo)',()=>{
 const it=sheet(1,1).items[0],c=borderColor(it.frames[0].data,it.w,it.h).color,out=removeSolid(it.frames[0].data,it.w,it.h,c,36);
 assert.equal(out[3],0);// corner gone
 const mid=((75*it.w)+75)*4;assert.equal(out[mid+3],255);// the face stays
 // Edge pixels that stay semi-transparent carry the face colour, not the backdrop's near-white.
 let soft=0,light=0;for(let i=0;i<out.length;i+=4)if(out[i+3]>0&&out[i+3]<255){soft++;if(out[i]>240&&out[i+1]>240&&out[i+2]>240)light++;}
 assert.ok(soft>0);assert.ok(light/soft<.05,`${light}/${soft} light fringe pixels`);
});

test('sticker.border grows the canvas and rings the silhouette with the colour',()=>{
 const w=40,h=40,d=new Uint8ClampedArray(w*h*4);for(let y=10;y<30;y++)for(let x=10;x<30;x++){const i=(y*w+x)*4;d[i]=200;d[i+3]=255;}
 const r=stickerBorder(d,w,h,{px:5,color:[255,255,255],shadow:false});
 assert.equal(r.w,w+2*r.pad);
 const at=(x,y)=>r.data.slice(((y+r.pad)*r.w+x+r.pad)*4,((y+r.pad)*r.w+x+r.pad)*4+4);
 assert.deepEqual([...at(7,20)],[255,255,255,255]);// 3 px outside: border
 assert.deepEqual([...at(20,20)],[200,0,0,255]);// inside: untouched
 assert.equal(at(2,20)[3],0);// 8 px outside: clear
 // Enclosed holes are filled like a die-cut.
 const ring=new Uint8ClampedArray(w*h*4);for(let y=5;y<35;y++)for(let x=5;x<35;x++){if(x>12&&x<27&&y>12&&y<27)continue;ring[(y*w+x)*4+3]=255;}
 const rr=stickerBorder(ring,w,h,{px:1,color:[255,255,255],shadow:false});
 assert.equal(rr.data[((20+rr.pad)*rr.w+20+rr.pad)*4+3],255);
 // A tiny dot far outside the cut is dropped instead of getting its own ring.
 const W2=80,dot=new Uint8ClampedArray(W2*W2*4);for(let y=10;y<50;y++)for(let x=10;x<50;x++)dot[(y*W2+x)*4+3]=255;dot[(70*W2+70)*4+3]=255;
 const rd=stickerBorder(dot,W2,W2,{px:3,color:[255,255,255],shadow:false});
 assert.equal(rd.data[((70+rd.pad)*rd.w+70+rd.pad)*4+3],0);
});

test('crop as intent: subject + margin + ratio, never outside an opaque photo',()=>{
 const w=200,h=100,d=new Uint8ClampedArray(w*h*4);for(let y=40;y<60;y++)for(let x=90;x<110;x++)d[(y*w+x)*4+3]=255;
 const r=cropRectFor(d,w,h,{mode:'subject',margin:.5,ratio:'1:1',shape:'rect',radius:0});
 assert.deepEqual([r.w,r.h],[40,40]);assert.deepEqual([r.x,r.y],[80,30]);
 const photo=new Uint8ClampedArray(w*h*4).fill(255),c=cropRectFor(photo,w,h,{mode:'center',margin:0,ratio:'1:1',shape:'rect',radius:0});
 assert.deepEqual(c,{x:50,y:0,w:100,h:100});
});

test('fit plans follow the official specs',()=>{
 const line=validateRecipe({schema:RECIPE_SCHEMA,source:{generator:'other'},input:{},steps:[{op:'fit',p:{preset:'line.sticker'}}]}).recipe.steps[0].p;
 const p=fitPlan(300,500,line);assert.deepEqual([p.W,p.H],[370,320]);assert.ok(p.ch<=320-2*10&&p.cw<=370);
 const tg=fitPlan(300,500,{...line,preset:'telegram.sticker',w:512,h:512});assert.deepEqual([tg.W,tg.H],[307,512]);
 const tw=fitPlan(900,300,{...line,preset:'telegram.sticker',w:512,h:512});assert.deepEqual([tw.W,tw.H],[512,171]);
});

for(const id of ['kakao.static','line.sticker','discord.emoji','telegram.sticker']){
 test(`preset ${id}: every file meets the spec, byte-identical on a second run`,async()=>{
  const input=sheet(6,4),recipe=presetById(id).recipe;
  const a=await pipe().run(input,recipe,{stem:'test'}),b=await pipe().run(sheet(6,4),recipe,{stem:'test'});
  assert.equal(filesHash(a),filesHash(b),'class-A output must not change between runs');
  assert.equal(sha(a.exported.pack.bytes),sha(b.exported.pack.bytes));
  const spec=FIT_SPECS[id],stickers=a.exported.files.filter(f=>!/^(main|tab)\.png$/.test(f.name));
  assert.equal(stickers.length,24);
  for(const f of stickers){const p=probe(f.bytes);
   if(spec.side==='long'){assert.equal(Math.max(p.w,p.h),512);assert.ok(Math.min(p.w,p.h)<=512);}else assert.deepEqual([p.w,p.h],[spec.w,spec.h]);
   if(spec.even)assert.ok(p.w%2===0&&p.h%2===0);
   assert.ok(f.bytes.length<=spec.maxBytes,`${f.name} ${f.bytes.length} > ${spec.maxBytes}`);assert.equal(p.type,'png');}
  assert.equal(a.check.ok,true,JSON.stringify(a.check.problems));
  if(id==='line.sticker'){
   const main=a.exported.files.find(f=>f.name==='main.png'),tab=a.exported.files.find(f=>f.name==='tab.png');
   assert.deepEqual([probe(main.bytes).w,probe(main.bytes).h],[240,240]);assert.deepEqual([probe(tab.bytes).w,probe(tab.bytes).h],[96,74]);
  }
 });
}

test('PNG output is lossless (decodes to the exact pixels)',async()=>{
 const it=sheet(1,1).items[0],bytes=pngStill(it.frames[0].data,it.w,it.h),back=await decodePNG(bytes);
 assert.deepEqual([back.width,back.height],[it.w,it.h]);assert.equal(sha(back.data),sha(new Uint8Array(it.frames[0].data.buffer)));
});

test('a byte target reduces colours until the file fits, and says so',async()=>{
 const w=360,h=360,d=new Uint8ClampedArray(w*h*4);let s=1;for(let i=0;i<d.length;i++){s=(Math.imul(s,1103515245)+12345)>>>0;d[i]=i%4===3?255:s>>>24;}
 const r=await pipe().run({items:[{name:'noise',w,h,frames:[{data:d,ms:0}]}],notes:[]},{schema:RECIPE_SCHEMA,source:{generator:'other'},input:{},steps:[{op:'fit',p:{preset:'kakao.static'}},{op:'export',p:{maxBytes:150_000}}]});
 const f=r.exported.files[0];assert.ok(f.bytes.length<=150_000);assert.ok(f.colors&&f.colors<=256);assert.equal(r.check.ok,true);
});

test('motion: an animated LINE sticker is an APNG of the right size and frame count; GIF works too',async()=>{
 const base=presetById('line.sticker').recipe;
 const steps=[...base.steps.slice(0,-2),{op:'fit',p:{preset:'line.sticker'}},{op:'motion',p:{kind:'bounce',frames:8,ms:100}},{op:'export',p:{format:'apng',maxBytes:1_000_000}}];
 const r=await pipe().run(sheet(2,1),{...base,steps});
 for(const f of r.exported.files){const p=probe(f.bytes);assert.equal(p.type,'apng');assert.equal(p.frames,8);}
 const g=await pipe().run(sheet(1,1),{...base,steps:[{op:'fit',p:{preset:'discord.emoji'}},{op:'motion',p:{kind:'shake',frames:6}},{op:'export',p:{format:'gif',maxBytes:256_000}}]});
 const p=probe(g.exported.files[0].bytes);assert.equal(p.type,'gif');assert.equal(p.frames,6);assert.deepEqual([p.w,p.h],[128,128]);
});

test('the runner caches each step: changing the last step does not redo the first ones',async()=>{
 const pl=pipe(),input=sheet(3,2),recipe=presetById('discord.emoji').recipe;
 await pl.run(input,recipe);
 const changed={...recipe,steps:recipe.steps.map(s=>s.op==='crop'?{...s,p:{...s.p,margin:.1}}:s)};
 const r=await pl.run(input,changed);
 assert.deepEqual(r.steps.map(s=>s.status),['cached','cached','done','done']);
});

test('preview pass works on a ≤512 px copy',()=>{
 const p=previewDoc(sheet(6,4));assert.equal(Math.max(p.items[0].w,p.items[0].h),512);
 assert.equal(resize(new Uint8ClampedArray(16),2,2,4,4).length,64);
});

test('spec check catches wrong sizes, odd sides, bytes and LINE set counts',()=>{
 const bad=pngStill(new Uint8ClampedArray(371*320*4),371,320);
 const r=checkSpec([{name:'01.png',bytes:bad}],'line.sticker');
 assert.equal(r.ok,false);assert.ok(r.problems.some(p=>/짝수/.test(p.ko)));assert.ok(r.problems.some(p=>/8·16·24/.test(p.ko)));
 assert.ok(zipFiles([{name:'a.png',bytes:bad}]).length>bad.length);
});

// Real AI sheets (DiffusionDB, CC0) when the local corpus is present: C:\Users\…\nerulio-asset-corpus\ai-sheets
const CORPUS=process.env.NERULIO_AI_SHEETS||`${process.env.USERPROFILE||process.env.HOME}/nerulio-asset-corpus/ai-sheets`;
test('real AI sticker sheets split into the stickers a person counts',{skip:!existsSync(CORPUS)&&'AI sheet corpus not on this machine'},async()=>{
 // Counted by eye on the originals (docs/MAKE.md §Measured): [file, stickers, accepted range]
 for(const [file,lo,hi] of [['ddb-sheet-83b04f39.png',48,50],['ddb-sheet-167183cd.png',10,12],['ddb-sheet-a9b89d1e.png',9,11]]){
  const img=await decodePNG(await readFile(`${CORPUS}/${file}`));
  const r=splitSheet(new Uint8ClampedArray(img.data),img.width,img.height,{mode:'auto',cols:1,rows:1,tolerance:40});
  assert.ok(r.cells.length>=lo&&r.cells.length<=hi,`${file}: ${r.cells.length} cells, expected ${lo}–${hi}`);
 }
});
