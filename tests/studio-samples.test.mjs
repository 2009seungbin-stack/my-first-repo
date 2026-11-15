/** Built-in sample images of the Studio empty state (src/studio/core/samples.js). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLES,sampleById,sampleImage,hash01} from '../src/studio/core/samples.js';
import {st} from '../src/studio/strings.js';

const cell=(im,def,k)=>{const ox=(k%def.cols)*def.cell,oy=Math.floor(k/def.cols)*def.cell,out=[];for(let y=0;y<def.cell;y++)out.push(...im.data.subarray(((oy+y)*im.width+ox)*4,((oy+y)*im.width+ox+def.cell)*4));return out.join(',');};

test('every sample is a whole grid of cells with a full RGBA buffer, and is deterministic',()=>{
 assert.deepEqual(SAMPLES.map(s=>s.id),['walk','tiles','gem']);
 for(const def of SAMPLES){
  const a=sampleImage(def.id),b=sampleImage(def.id);
  assert.equal(a.width,def.cell*def.cols,def.id);assert.equal(a.height,def.cell*def.rows,def.id);
  assert(a.data instanceof Uint8ClampedArray);assert.equal(a.data.length,a.width*a.height*4,def.id);
  assert.deepEqual(a.data,b.data,def.id+' is identical on every call');
  assert.match(def.file,/^sample-[a-z-]+\.png$/);assert.equal(sampleById(def.id),def);
 }
 assert.deepEqual(SAMPLES.map(s=>s.workspace),['sprite','tile','pixel'],'the workspace each sample opens in from an empty Viewer');
 assert.equal(sampleById('nope'),null);assert.throws(()=>sampleImage('nope'),/Unknown sample/);
});
test('the walk cycle has 8 different frames on a transparent background, each with a drawn figure',()=>{
 const def=sampleById('walk'),im=sampleImage('walk'),frames=Array.from({length:8},(_,k)=>cell(im,def,k));
 assert.equal(new Set(frames).size,8,'no two frames are the same picture');
 for(let k=0;k<8;k++){
  const ox=(k%4)*32,oy=(k>>2)*32;let opaque=0,clear=0;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){const a=im.data[((oy+y)*im.width+ox+x)*4+3];if(a===255)opaque++;else if(a===0)clear++;}
  assert(opaque>150&&opaque<700,`frame ${k} figure size (${opaque})`);assert(clear>300,`frame ${k} keeps a transparent background`);
  // nothing touches the cell border, so cutting by the 32 px grid never clips the figure
  for(let i=0;i<32;i++)for(const [x,y]of [[i,0],[i,31],[0,i],[31,i]])assert.equal(im.data[((oy+y)*im.width+ox+x)*4+3],0,`frame ${k} border`);
 }
});
test('the tileset is 16 opaque, distinct 16 px tiles',()=>{
 const def=sampleById('tiles'),im=sampleImage('tiles');
 for(let i=3;i<im.data.length;i+=4)assert.equal(im.data[i],255);
 assert.equal(new Set(Array.from({length:16},(_,k)=>cell(im,def,k))).size,16);
});
test('the gem is one outlined image with transparent corners',()=>{
 const im=sampleImage('gem'),a=(x,y)=>im.data[(y*32+x)*4+3];
 for(const [x,y]of [[0,0],[31,0],[0,31],[31,31]])assert.equal(a(x,y),0);
 assert.equal(a(16,16),255);
 let colors=new Set();for(let i=0;i<im.data.length;i+=4)if(im.data[i+3]===255)colors.add(im.data[i]<<16|im.data[i+1]<<8|im.data[i+2]);
 assert(colors.size>=6,'shaded facets, not a flat fill');
});
test('hash01 is stable and stays in [0,1)',()=>{
 assert.equal(hash01(3,7,2),hash01(3,7,2));assert.notEqual(hash01(3,7,2),hash01(7,3,2));
 for(let i=0;i<500;i++){const v=hash01(i,i*7,i%5);assert(v>=0&&v<1);}
});
test('each sample has a name and a size line in ko/en/ja, plus the shared sample and recent copy',()=>{
 for(const l of ['en','ko','ja']){
  for(const def of SAMPLES)for(const k of ['sample.'+def.id,'sample.'+def.id+'Meta'])assert.notEqual(st(l,k),k,`${l} ${k}`);
  for(const k of ['sample.title','sample.hint','sample.menu','sample.load','sample.loaded','sample.loadedIn','sample.cut','recent.title','recent.open','recent.meta'])assert.notEqual(st(l,k),k,`${l} ${k}`);
  assert.match(st(l,'recent.meta',{assets:2,frames:8,time:'T'}),/2.*8.*T/);
 }
 // the size lines state what the generator really draws
 assert.match(st('en','sample.walkMeta'),/8 frames · 32×32/);assert.match(st('en','sample.tilesMeta'),/16 tiles · 16×16/);
});
