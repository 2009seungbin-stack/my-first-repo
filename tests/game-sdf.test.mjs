import test from 'node:test';import assert from 'node:assert/strict';
import {edt,signedDistanceField,downsample,encode,SHADER_NOTE} from '../src/game/sdf.js';
const brute=(mask,w,h)=>{
 const out=new Float64Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let best=Infinity;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(mask[j*w+i])best=Math.min(best,(x-i)**2+(y-j)**2);
  out[y*w+x]=best;
 }
 return out;
};
const disc=(size,r)=>{
 const d=new Uint8ClampedArray(size*size*4),c=(size-1)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(Math.hypot(x-c,y-c)<=r)d.set([255,255,255,255],(y*size+x)*4);
 return d;
};
test('the distance transform is exact, not an approximation',()=>{
 let seed=12345;const rnd=()=>(seed=seed*1103515245+12345>>>0)/2**32;
 for(const [w,h] of [[13,9],[1,7],[8,8]]){
  const mask=new Uint8Array(w*h);
  for(let i=0;i<mask.length;i++)mask[i]=rnd()<.15?1:0;
  if(!mask.some(Boolean))mask[3%mask.length]=1;
  const mine=edt(mask,w,h),reference=brute(mask,w,h);
  for(let i=0;i<mine.length;i++)assert.equal(mine[i],reference[i],`${w}x${h} at ${i}`);
 }
 assert(edt(new Uint8Array(4),2,2).every(v=>v>1e19),'no seeds means unbounded, not NaN');
 assert.throws(()=>edt(new Uint8Array(3),2,2),/mask/);
});
test('the signed field is zero on the contour, positive inside and negative outside',()=>{
 const size=41,r=15,field=signedDistanceField(disc(size,r),size,size),c=(size-1)/2;
 const value=(x,y)=>field[y*size+x];
 assert(value(c,c)>r-1&&value(c,c)<=r+1,`centre ${value(c,c)}`);
 // The contour is where the disc's own radius crosses: values there are within half a pixel.
 assert(Math.abs(value(c+r,c))<=.75,`edge inside ${value(c+r,c)}`);
 assert(Math.abs(value(c+r+1,c))<=.75,`edge outside ${value(c+r+1,c)}`);
 for(let x=0;x<size;x++){
  const d=Math.hypot(x-c,0);
  if(d<r-1)assert(value(x,c)>0,`inside at ${x}`);
  if(d>r+1)assert(value(x,c)<0,`outside at ${x}`);
 }
 // Monotonic along a ray from the centre: distance never increases as we walk outwards.
 for(let x=c;x<size-1;x++)assert(value(x+1,c)<=value(x,c)+1e-6,`not monotonic at ${x}`);
 for(let y=c;y<size-1;y++)assert(value(c,y+1)<=value(c,y)+1e-6,`not monotonic at ${y}`);
 // The exact distance to the disc contour, compared with the field, stays within a pixel.
 for(const [x,y] of [[c,c],[c+5,c],[c-9,c+3],[0,0],[size-1,size-1]]){
  const expected=r-Math.hypot(x-c,y-c);
  assert(Math.abs(value(x,y)-expected)<1.1,`${x},${y}: ${value(x,y)} vs ${expected}`);
 }
});
test('a high-resolution field downsamples into output-pixel units',()=>{
 const size=64,field=signedDistanceField(disc(size,24),size,size);
 const small=downsample(field,size,size,4);
 assert.deepEqual([small.width,small.height],[16,16]);
 assert(Math.abs(small.field[8*16+8]-field[34*size+34]/4)<1e-6);
 assert.throws(()=>downsample(field,size,size,0),/positive integer/);
 assert.throws(()=>downsample(field,size,size,128),/larger/);
});
test('the texture keeps the distance in colour bytes with 128 as the contour',()=>{
 const field=Float32Array.from([0,8,-8,100,-100]),px=encode(field,5,1,{spread:8});
 assert.deepEqual([...px.slice(0,4)],[128,128,128,255]);
 assert.deepEqual([px[4],px[7]],[255,255]);
 assert.deepEqual([px[8],px[11]],[1,255]);
 assert.equal(px[12],255);assert.equal(px[16],0);
 assert.throws(()=>encode(field,5,1,{spread:0}),/Spread/);
 assert.throws(()=>encode(field,4,1,{}),/Field size/);
 assert(SHADER_NOTE(8).includes('128.0'));
});
