import test from 'node:test';import assert from 'node:assert/strict';
import {heightToNormal,flipGreen,combineNormals,validateNormalMap,greenBias,KERNELS,KERNEL_IDS,CONVENTIONS} from '../src/game/texture-normal.js';
import {mapTexture} from '../src/primitives.js';
const FLAT=[128,128,255,255];
const plane=(w,h,fn)=>{const out=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)out[y*w+x]=fn(x,y);return out;};
const at=(data,w,x,y)=>[...data.subarray((y*w+x)*4,(y*w+x)*4+4)];
test('a flat height map produces the flat normal in every kernel and convention',()=>{
 for(const kernel of KERNEL_IDS)for(const convention of CONVENTIONS){
  const out=heightToNormal(plane(4,4,()=>50),4,4,{kernel,convention,strength:2});
  assert.deepEqual([...new Set(Array.from({length:16},(_,p)=>at(out,4,p%4,Math.floor(p/4)).join(',')))],[FLAT.join(',')],`${kernel}/${convention}`);
 }
 // The ported recipe check: primitives.mapTexture and the Lab agree on the flat case.
 assert.deepEqual([...mapTexture(new Uint8ClampedArray([50,50,50,255]),1,1,{mode:'normal'})],FLAT);
});
test('kernels are normalised so a one-unit-per-pixel ramp reports the same slope',()=>{
 const w=16,h=16,ramp=plane(w,h,x=>x*8);
 const results=KERNEL_IDS.map(kernel=>at(heightToNormal(ramp,w,h,{kernel,strength:1}),w,8,8));
 for(const r of results)assert.deepEqual(r.slice(1),results[0].slice(1),'green/blue agree across kernels');
 for(const r of results)assert(Math.abs(r[0]-results[0][0])<=1,`red within one byte: ${r[0]} vs ${results[0][0]}`);
 assert(results[0][0]<128,'a height rising to the right tilts the normal left (red < 128)');
 assert.equal(KERNELS.sobel3.scale,1/8);assert.equal(KERNELS.scharr.scale,1/32);assert.equal(KERNELS.sobel5.scale,1/128);
});
test('the green channel follows the declared convention, and only the green channel',()=>{
 const w=8,h=8,down=plane(w,h,(x,y)=>y*30);// brighter towards the bottom of the image
 const gl=heightToNormal(down,w,h,{convention:'opengl',strength:2}),dx=heightToNormal(down,w,h,{convention:'directx',strength:2});
 const a=at(gl,w,4,4),b=at(dx,w,4,4);
 assert(a[1]>128,`OpenGL green points up in the image: ${a[1]}`);
 assert(b[1]<128,`DirectX green points down: ${b[1]}`);
 assert.deepEqual([a[0],a[2],a[3]],[b[0],b[2],b[3]],'nothing but green differs');
 assert.deepEqual([...flipGreen(gl,w,h)],[...dx],'flipGreen is the same conversion');
 assert.deepEqual([...flipGreen(flipGreen(gl,w,h),w,h)],[...gl],'converting twice is byte-identical');
 assert.deepEqual(at(heightToNormal(down,w,h,{convention:'opengl',invertY:true,strength:2}),w,4,4),b,'invert Y equals the other convention');
 const right=plane(w,h,x=>x*30);
 assert(at(heightToNormal(right,w,h,{strength:2}),w,4,4)[0]<128);
 assert(at(heightToNormal(right,w,h,{strength:2,invertX:true}),w,4,4)[0]>128);
 assert(greenBias(gl,w,h).meanDeviation>2,'a sloped map leans on green');
 assert(greenBias(heightToNormal(plane(w,h,()=>9),w,h),w,h).meanDeviation<1,'a flat map carries no vertical slope at all');
});
test('wrap-around sampling removes the edge artefact a tileable texture would show',()=>{
 const w=8,h=4,wave=plane(w,h,x=>Math.round(128+120*Math.sin(x/w*Math.PI*2)));
 const tiled=plane(w*2,h,x=>wave[x%w]);// the same texture actually repeated once
 const clamped=heightToNormal(wave,w,h,{wrap:false,strength:4}),wrapped=heightToNormal(wave,w,h,{wrap:true,strength:4});
 const reference=heightToNormal(tiled,w*2,h,{wrap:false,strength:4});
 assert.deepEqual(at(wrapped,w,0,2),at(reference,w*2,w,2),'the wrapped edge equals the same texel inside a real repeat');
 assert.notDeepEqual(at(clamped,w,0,2),at(wrapped,w,0,2),'clamped sampling gets that texel wrong');
 assert.deepEqual(at(clamped,w,4,2),at(wrapped,w,4,2),'interior texels are untouched');
});
test('Reoriented Normal Mapping: flat is the identity, output stays unit length, no RGB average',()=>{
 const w=4,h=4,base=heightToNormal(plane(w,h,(x,y)=>x*20+y*10),w,h,{strength:3}),flat=new Uint8Array(w*h*4);
 for(let p=0;p<w*h;p++)flat.set(FLAT,p*4);
 assert.deepEqual([...combineNormals(base,flat,w,h)],[...base],'a flat detail returns the base byte for byte');
 assert.deepEqual([...combineNormals(flat,base,w,h)],[...base],'a flat base returns the detail');
 const detail=heightToNormal(plane(w,h,(x,y)=>(x%2)*120),w,h,{strength:2}),mixed=combineNormals(base,detail,w,h);
 const report=validateNormalMap(mixed,w,h,{tolerance:.01});
 assert(report.unitLength&&report.maxDeviation<.01,`unit length within rounding: ${report.maxDeviation}`);
 assert(report.blueNonNegative);
 let differs=0;for(let p=0;p<w*h;p++)if(mixed[p*4+1]!==Math.round((base[p*4+1]+detail[p*4+1])/2))differs++;
 assert(differs>0,'the result is not an RGB average of the two maps');
 assert.throws(()=>combineNormals(base,detail.slice(0,4),w,h),/same dimensions/);
 assert.throws(()=>combineNormals(base,detail,w,h,{strength:9}),/strength/);
});
test('the validator separates a normal map from a colour texture',()=>{
 const w=8,h=8,normal=heightToNormal(plane(w,h,(x,y)=>x*12+y*3),w,h,{strength:2});
 const good=validateNormalMap(normal,w,h);
 assert(good.looksLikeNormalMap&&good.unitLength&&good.blueNonNegative&&good.meanLength>.98&&good.meanLength<1.02);
 const albedo=new Uint8Array(w*h*4);for(let p=0;p<w*h;p++)albedo.set([200,40,20,255],p*4);
 const bad=validateNormalMap(albedo,w,h);
 assert(!bad.looksLikeNormalMap&&!bad.unitLength&&!bad.blueNonNegative&&bad.negativeBlueRatio===1);
 const inverted=flipGreen(normal,w,h);
 assert(validateNormalMap(inverted,w,h).looksLikeNormalMap,'a convention flip is still a valid normal map — it cannot be detected as wrong');
 assert.equal(validateNormalMap(normal,w,h,{maxSamples:4}).sampled,4);
});
test('inputs are validated instead of producing quietly wrong maps',()=>{
 assert.throws(()=>heightToNormal(new Uint8Array(3),2,2),/Height plane/);
 assert.throws(()=>heightToNormal(new Uint8Array(4),2,2,{kernel:'blur'}),/kernel/);
 assert.throws(()=>heightToNormal(new Uint8Array(4),2,2,{convention:'metal'}),/convention/);
 assert.throws(()=>heightToNormal(new Uint8Array(4),2,2,{strength:99}),/Strength/);
 assert.throws(()=>flipGreen(new Uint8Array(4),2,2),/RGBA data/);
});
