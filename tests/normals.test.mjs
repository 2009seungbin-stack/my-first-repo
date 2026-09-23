// Texture workspace engines (src/game/normals/*): kernels, wrap modes, distance transform, bevel,
// brush strokes, GL/DX detection, the Godot light model, packing, 16-bit PNG. Real CC0 fixtures in
// tests/fixtures/texture (see SOURCES.md).
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {edgeIndex,insideDistance,bevelHeight,profile,blur,lumaHeight,applyStroke,strokeDabs,alphaMask} from '../src/game/normals/height.js';
import {gradients,normalsFromHeight,encodeNormals,quantizeNormals,normalMipChain,decodeNormals,roll,rollConsistency,seamError,KERNEL_IDS} from '../src/game/normals/normal.js';
import {detectConvention,curlStatistic} from '../src/game/normals/convention.js';
import {ambientOcclusion,curvature,heightToUint16} from '../src/game/normals/maps.js';
import {shade,renderLit,falloff,falloffTexture,normLight} from '../src/game/normals/lighting.js';
import {generate,normalizeParams,suggestParams,normalPatch,paintStrokes,regionsOf} from '../src/game/normals/pipeline.js';
import {encodeGray16PNG,decodeGrayPNG} from '../src/game/normals/png16.js';
import {bundleFiles,godotScene,animationsOf,unityBlock} from '../src/game/normals/export.js';
import {decodePNG} from '../src/game/texture-png.js';
import {flipGreen,heightToNormal} from '../src/game/texture-normal.js';
import {packPlanes,extractChannel} from '../src/game/texture-channels.js';
import {ENGINE_PRESETS} from '../src/game/texture-presets.js';
const FIX=new URL('./fixtures/texture/',import.meta.url);
const load=async name=>decodePNG(new Uint8Array(readFileSync(new URL(name,FIX))));
const field=(w,h,fn)=>{const o=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)o[y*w+x]=fn(x,y);return o;};
test('edge modes: clamp repeats, tile wraps, mirror reflects without repeating the border',()=>{
 assert.deepEqual([-2,-1,0,4,5,6].map(i=>edgeIndex(i,5,'clamp')),[0,0,0,4,4,4]);
 assert.deepEqual([-2,-1,0,4,5,6].map(i=>edgeIndex(i,5,'tile')),[3,4,0,4,0,1]);
 assert.deepEqual([-2,-1,0,4,5,6].map(i=>edgeIndex(i,5,'mirror')),[2,1,0,4,3,2]);
});
test('exact Euclidean distance transform equals brute force; chamfer metrics are exact too',()=>{
 const w=23,h=17,mask=new Uint8Array(w*h);let s=7;const r=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++)mask[y*w+x]=r()<.8?1:0;
 const d=insideDistance(mask,w,h,{border:'outside'});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!mask[y*w+x]){assert.equal(d[y*w+x],0);continue;}
  let best=Infinity;for(let yy=-1;yy<=h;yy++)for(let xx=-1;xx<=w;xx++){const out=xx<0||yy<0||xx>=w||yy>=h||!mask[yy*w+xx];if(out)best=Math.min(best,Math.hypot(xx-x,yy-y));}
  assert(Math.abs(d[y*w+x]-best)<1e-4,`(${x},${y}) ${d[y*w+x]} vs ${best}`);
 }
 const cheb=insideDistance(mask,w,h,{metric:'chebyshev'}),man=insideDistance(mask,w,h,{metric:'manhattan'});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!mask[y*w+x])continue;let bc=Infinity,bm=Infinity;
  for(let yy=-1;yy<=h;yy++)for(let xx=-1;xx<=w;xx++){const out=xx<0||yy<0||xx>=w||yy>=h||!mask[yy*w+xx];if(out){bc=Math.min(bc,Math.max(Math.abs(xx-x),Math.abs(yy-y)));bm=Math.min(bm,Math.abs(xx-x)+Math.abs(yy-y));}}
  assert.equal(cheb[y*w+x],bc);assert.equal(man[y*w+x],bm);}
});
test('tile border: a shape touching the right edge continues on the left (no false rim)',()=>{
 const w=8,h=4,mask=new Uint8Array(w*h).fill(1);for(let y=0;y<h;y++)mask[y*w+3]=0;
 const t=insideDistance(mask,w,h,{border:'tile'}),o=insideDistance(mask,w,h,{border:'outside'});
 assert.equal(t[0*w+7],4,'x=7 wraps to x=0..2: nearest hole is at x=3, four steps away');
 assert.equal(o[0*w+7],1,'with the border as outside, x=7 is a rim pixel');
});
test('bevel: rim at the silhouette, plateau at full height, profiles are monotonic 0→1',()=>{
 for(const p of ['linear','round','smooth','concave']){let prev=-1;for(let i=0;i<=20;i++){const v=profile(p,i/20);assert(v>=prev-1e-12);prev=v;}assert.equal(profile(p,0),0);assert.equal(profile(p,1),1);}
 const w=20,h=20,mask=new Uint8Array(w*h);for(let y=4;y<16;y++)for(let x=4;x<16;x++)mask[y*w+x]=1;
 const b=bevelHeight(mask,w,h,{width:3,depth:6,shape:'linear'});
 assert.equal(b[0],0);assert.equal(b[10*w+10],6,'plateau');assert.equal(b[10*w+4],1,'rim pixel: (1−.5)/3·6');
});
test('kernels are normalised: a ramp of 1 px per px reads as slope 1 with every kernel, in every edge mode inside',()=>{
 const w=16,h=16,ramp=field(w,h,x=>x);
 for(const kernel of KERNEL_IDS)for(const edge of ['clamp','mirror']){const {gx,gy}=gradients(ramp,w,h,{kernel,edge});assert(Math.abs(gx[8*w+8]-1)<1e-6,kernel);assert(Math.abs(gy[8*w+8])<1e-6);}
});
test('convention: OpenGL green rises where height grows downward; DirectX is exactly the flip; matches texture-normal.js',()=>{
 const w=12,h=12,down=field(w,h,(x,y)=>y*.8);
 const gl=encodeNormals(normalsFromHeight(down,w,h,{convention:'opengl'}),w,h),dx=encodeNormals(normalsFromHeight(down,w,h,{convention:'directx'}),w,h);
 assert(gl[(6*w+6)*4+1]>128);assert(dx[(6*w+6)*4+1]<128);
 const i=(6*w+6)*4;assert.equal(gl[i+1]+dx[i+1],255);
 // the Texture Lab engine (8-bit height 0…255 read as 0…1, sobel) agrees with the float engine on the same slope:
 // bytes b = 8·y, so ∂(b/255)/∂y = 8/255; at Lab strength S that is the float engine at strength S·(8/255)/0.8
 const bytes=Uint8Array.from(down,v=>Math.round(v*10)),S=2.55,old=heightToNormal(bytes,w,h,{strength:S,kernel:'sobel3'});
 const now=encodeNormals(normalsFromHeight(down,w,h,{strength:S*(8/255)/.8}),w,h);
 assert(Math.abs(old[i+1]-now[i+1])<=2,`${old[i+1]} vs ${now[i+1]}`);
});
test('wrap kernels on a REAL tileable texture: shifting the texture shifts the map exactly (zero seam), clamp does not',async()=>{
 const b=await load('bricks_Color.png'),w=b.width,h=b.height;
 for(const [edge,zero] of [['tile',true],['clamp',false],['mirror',false]]){
  const params=normalizeParams({kind:'texture',bevel:{on:false},luma:{depth:4,detail:24},normal:{edge}});
  const a=generate(b.data,w,h,params).normal,r=roll(generate(roll(b.data,w,h,w/2,h/2),w,h,params).normal,w,h,-w/2,-h/2),c=rollConsistency(a,r,w,h);
  if(zero){assert.equal(c.border,0);assert.equal(c.maxBorder,0);assert.equal(c.interior,0);}
  else assert(c.border>.5,`${edge} border ${c.border}`);
 }
});
test('frames are independent: a frame\'s map does not depend on its neighbours, and moves with the sprite',async()=>{
 const t=await load('torch_sheet.png'),w=t.width,h=t.height,frames=regionsOf(w,h,[0,1,2,3,4,5].map(i=>({x:(i%3)*32,y:Math.floor(i/3)*32,w:32,h:32})));
 const p=suggestParams(t.data,w,h,{pixelArt:true});assert.equal(p.kind,'sprite');
 const a=generate(t.data,w,h,p,{regions:frames}).normal;
 // wipe frame 1's neighbour (frame 0): frame 1 must not change
 const cut=new Uint8Array(t.data);for(let y=0;y<32;y++)for(let x=0;x<32;x++)cut.fill(0,(y*w+x)*4,(y*w+x)*4+4);
 const b=generate(cut,w,h,p,{regions:frames}).normal;
 for(let y=0;y<32;y++)for(let x=32;x<64;x++)for(let c=0;c<4;c++)assert.equal(a[(y*w+x)*4+c],b[(y*w+x)*4+c]);
 // a sprite translated inside an empty frame gets the translated normals (same params, same units)
 const one=new Uint8Array(64*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++)one.set(t.data.subarray((y*w+x)*4,(y*w+x)*4+4),(y*64+x+(x<32?0:0))*4);
 const moved=new Uint8Array(64*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++)moved.set(t.data.subarray((y*w+x)*4,(y*w+x)*4+4),(y*64+x+32)*4);
 const n1=generate(one,64,32,p,{regions:[{x:0,y:0,w:32,h:32},{x:32,y:0,w:32,h:32}]}).normal,n2=generate(moved,64,32,p,{regions:[{x:0,y:0,w:32,h:32},{x:32,y:0,w:32,h:32}]}).normal;
 for(let y=0;y<32;y++)for(let x=0;x<32;x++)for(let c=0;c<4;c++)assert.equal(n1[(y*64+x)*4+c],n2[(y*64+x+32)*4+c]);
});
test('pixel-art quantisation: only the allowed directions and tilts appear, flat stays flat',()=>{
 const w=24,h=24,hill=field(w,h,(x,y)=>Math.max(0,8-Math.hypot(x-12,y-12)));
 const q=quantizeNormals(normalsFromHeight(hill,w,h,{strength:1}),w*h,{directions:8,tiers:2});
 const seen=new Set();for(let p=0;p<w*h;p++)seen.add(Array.from(q.slice(p*3,p*3+3),v=>(v+0).toFixed(4).replace('-0.0000','0.0000')).join(','));
 assert(seen.size<=8*2+1,`${seen.size} distinct normals`);
 assert(seen.has('0.0000,0.0000,1.0000'),'flat texels stay exactly flat');
});
test('brush: strokes are deterministic, stay in their clip, and erase goes back to the generated height',()=>{
 const w=40,h=20,base=new Float32Array(w*h).fill(2),s={mode:'raise',r:4,s:1,hard:.5,pts:[5,10,30,10],clip:{x:0,y:0,w:20,h:20}};
 assert.deepEqual(strokeDabs(s),strokeDabs({...s}));
 const p1=paintStrokes(base,w,h,[s]),p2=paintStrokes(base,w,h,[s]);assert.deepEqual([...p1],[...p2]);
 for(let y=0;y<h;y++)for(let x=20;x<w;x++)assert.equal(p1[y*w+x],0,'nothing painted outside the frame the stroke started in');
 assert(p1[10*w+10]>1);
 const paint=new Float32Array(p1);applyStroke(paint,base,w,h,{mode:'erase',r:30,s:1,hard:.99,pts:[10,10,10,10]});
 assert(Math.abs(paint[10*w+10])<1e-6);
});
test('live brush patch equals the full recompute inside the region',()=>{
 const w=48,h=48,mask=new Uint8Array(w*h);for(let y=6;y<42;y++)for(let x=6;x<42;x++)mask[y*w+x]=1;
 const hgt=bevelHeight(mask,w,h,{width:5,depth:5});const p=normalizeParams({});
 const full=encodeNormals(normalsFromHeight(hgt,w,h,{}),w,h,{mask});
 const into=new Uint8Array(full.length).fill(7);const r=normalPatch(hgt,w,h,p,{region:{x:0,y:0,w,h},rect:{x:10,y:12,w:14,h:9},mask,into});
 for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){if(!mask[y*w+x])continue;for(let c=0;c<4;c++)assert.equal(into[(y*w+x)*4+c],full[(y*w+x)*4+c]);}
});
test('GL/DX detection on the real ambientCG pair: right answer with high confidence both ways',async()=>{
 const gl=await load('bricks_NormalGL.png'),dx=await load('bricks_NormalDX.png');
 const a=detectConvention(gl.data,gl.width,gl.height),b=detectConvention(dx.data,dx.width,dx.height);
 assert.equal(a.convention,'opengl');assert.equal(a.confidence,'high');
 assert.equal(b.convention,'directx');assert.equal(b.confidence,'high');
 assert.equal(curlStatistic(gl.data,gl.width,gl.height).rho,-curlStatistic(dx.data,dx.width,dx.height).rho,'flipping green negates the statistic exactly');
});
test('GL/DX detection: a separable surface (no diagonal relief) is "cannot tell", never a guess',()=>{
 const w=64,h=64,hh=field(w,h,(x,y)=>3*Math.sin(x/5)+2*Math.cos(y/7));// h = f(x)+g(y): ∂²h/∂x∂y = 0
 const r=detectConvention(encodeNormals(normalsFromHeight(hh,w,h,{strength:1}),w,h),w,h);
 assert.equal(r.convention,null);assert.equal(r.confidence,'none');
});
test('GL/DX detection on a generated sprite map: both tests agree (silhouette + curl)',async()=>{
 const t=await load('torch_sheet.png'),w=t.width,h=t.height,frames=[0,1,2,3,4,5].map(i=>({x:(i%3)*32,y:Math.floor(i/3)*32,w:32,h:32}));
 const n=generate(t.data,w,h,suggestParams(t.data,w,h,{pixelArt:true}),{regions:frames}).normal;
 const withAlpha=Uint8Array.from(n,(v,i)=>i%4===3?t.data[i]:v);
 const gl=detectConvention(withAlpha,w,h),dx=detectConvention(flipGreen(withAlpha,w,h),w,h);
 assert.equal(gl.convention,'opengl');assert.equal(dx.convention,'directx');assert.equal(gl.reason,'both-agree');
});
test('light model = Godot canvas: a flat normal under a light straight above adds colour·energy·falloff; the green flip matters',()=>{
 const albedo=[.5,.5,.5,1],flat=[128,128,255];
 const c=shade(albedo,flat,10.5,10.5,{ambient:'#000000',lights:[{x:10.5,y:10.5,z:10,color:'#ffffff',energy:1,radius:100}]});
 const nz=Math.sqrt(1-(128/255*2-1)**2*2),N=[128/255*2-1,-(128/255*2-1),nz];
 assert(Math.abs(c[0]-.5*N[2])<1e-9);
 assert.equal(falloff('smooth',0),1);assert.equal(falloff('smooth',1),0);assert.equal(falloff('linear',.5),.5);
 const tex=falloffTexture('linear',16);assert.equal(tex[(8*16+8)*4],Math.round(falloff('linear',Math.hypot(.5,.5)/8)*255));
 // a normal tilted up (OpenGL green high) is lit by a light above it (smaller y) more than by one below
 const up=[128,200,Math.round(127.5+127.5*Math.sqrt(1-(72/127.5)**2))],sc=y=>({ambient:'#000000',lights:[{x:0,y,z:4,color:'#ffffff',energy:1,radius:100}]});
 assert(shade(albedo,up,0,0,sc(-20))[0]>shade(albedo,up,0,0,sc(20))[0]);
 const img=renderLit(new Uint8Array([255,0,0,255]),new Uint8Array([128,128,255,255]),1,1,sc(0));assert.equal(img[3],255);
 assert.equal(normLight({energy:99}).energy,16);
});
test('maps: AO darkens a pit and not a plateau; curvature is 128 on a plane',()=>{
 const w=32,h=32,pit=field(w,h,(x,y)=>Math.hypot(x-16,y-16)<5?0:6);
 const ao=ambientOcclusion(pit,w,h,{radius:8});assert(ao[16*w+16]<ao[2*w+2]-40);assert.equal(ao[2*w+2],255);
 const cv=curvature(field(w,h,(x,y)=>x*.3+y*.2),w,h,{});assert.equal(cv[10*w+10],128);
});
test('16-bit height PNG round-trips exactly and reads the real ambientCG 16-bit displacement',async()=>{
 const w=37,h=11,s=Uint16Array.from({length:w*h},(_,i)=>(i*2654435761)%65536);
 const d=await decodeGrayPNG(await encodeGray16PNG(s,w,h));assert.equal(d.depth,16);assert.deepEqual([...d.samples],[...s]);
 const real=await decodeGrayPNG(new Uint8Array(readFileSync(new URL('bricks_Displacement.png',FIX))));
 assert.equal(real.depth,16);assert(new Set(real.samples).size>256,'more than 256 levels: the low byte is kept');
 const u=heightToUint16(Float32Array.from([0,2,4]));assert.deepEqual([...u.samples],[0,32768,65535]);assert.equal(u.max,4);
});
test('normal mips average vectors and stay unit length; a colour average would not',()=>{
 const n=new Uint8Array([255,128,128,255,0,128,128,255,128,128,255,255,128,128,255,255]);
 const m=normalMipChain(n,2,2,{levels:1})[1].data,v=decodeNormals(m,1,1);assert(Math.abs(Math.hypot(v[0],v[1],v[2])-1)<1e-6);
 const raw=[(255+0+128+128)/4,128,(128+128+255+255)/4].map(b=>(b-127.5)/127.5);assert(Math.hypot(...raw)<.8,'naive average is visibly shorter');
});
test('channel packing with engine presets copies bytes exactly (Godot ORM from the real bricks set)',async()=>{
 const ao=await load('bricks_AmbientOcclusion.png'),ro=await load('bricks_Roughness.png'),w=ao.width,h=ao.height;
 const plane=(img)=>extractChannel(img.data,w,h,'r'),metal=new Uint8Array(w*h);
 const preset=ENGINE_PRESETS['godot-orm'];assert.deepEqual(preset.channels.map(c=>c.role),['ao','roughness','metallic','unused']);
 const packed=packPlanes([plane(ao),plane(ro),metal,new Uint8Array(w*h).fill(255)],w,h,[0,1,2,3]);
 assert.deepEqual([...extractChannel(packed,w,h,'r')],[...plane(ao)]);assert.deepEqual([...extractChannel(packed,w,h,'g')],[...plane(ro)]);
});
test('exports: Godot scene has the CanvasTexture, lights and region animation; Unity rects flip y; generic lists both conventions',()=>{
 const frames=[{rect:{x:0,y:0,w:32,h:32},duration:100},{rect:{x:32,y:0,w:32,h:32},duration:150}],frameList=[{id:'a'},{id:'b'}];
 const scene={ambient:'#202020',lights:[{id:'l1',x:5,y:6,z:20,color:'#ff8000',energy:1.5,radius:64,falloff:'linear'}]};
 const tscn=godotScene({base:'hero',albedo:'hero.png',normal:'hero_n.png',lightTextures:[{falloff:'linear',name:'hero_light_linear.png'}],frames,frameList,tags:[],scene});
 for(const s of ['[sub_resource type="CanvasTexture"','normal_texture = ExtResource("2_normal")','type="PointLight2D"','height = 20.0','energy = 1.5','texture_scale = 0.5','type="CanvasModulate"','NodePath("Sprite:region_rect")','Rect2(32, 0, 32, 32)','"times": PackedFloat32Array(0.0, 0.1)','length = 0.25'])assert(tscn.includes(s),s);
 assert.equal(animationsOf(frameList,[]).length,1);
 const u=unityBlock({albedo:'a.png',normal:'b.png',width:64,height:40,frames,scene});assert.deepEqual(u.frames[0].rect,{x:0,y:8,width:32,height:32});
 const png={albedo:new Uint8Array(1),normal:new Uint8Array(1),normalDX:new Uint8Array(1),light:{linear:new Uint8Array(1)},height:new Uint8Array(1)};
 const files=bundleFiles({base:'hero',targets:['godot','unity','generic'],png,width:64,height:40,frames,frameList,scene});
 const names=files.map(f=>f.name);
 for(const n of ['godot/hero_lit.tscn','godot/hero_canvas_texture.tres','godot/hero_light_linear.png','unity/Editor/NerulioNormalMapImporter.cs','unity/nerulio-texture.json','generic/hero_n_dx.png','generic/hero_height16.png','generic/nerulio-texture.json'])assert(names.includes(n),n);
 const man=JSON.parse(files.find(f=>f.name==='generic/nerulio-texture.json').data);assert.equal(man.maps.normalDX.convention,'directx');assert.equal(man.maps.height.bitDepth,16);
 assert(files.find(f=>f.name==='unity/README.md').data.includes('UNVERIFIED'));
});
test('normalizeParams clamps a hand-edited document and never throws',()=>{
 const p=normalizeParams({kind:'nope',bevel:{width:-4,shape:'x'},normal:{strength:999,kernel:'x',edge:'y'},pixel:{directions:7,tiers:9}});
 assert.equal(p.kind,'sprite');assert.equal(p.bevel.width,.5);assert.equal(p.bevel.shape,'round');assert.equal(p.normal.strength,16);assert.equal(p.normal.kernel,'sobel3');assert.equal(p.pixel.directions,8);assert.equal(p.pixel.tiers,4);
 assert.equal(suggestParams(new Uint8Array(16).fill(255),2,2).kind,'texture');
 const blurred=blur(new Float32Array(25).fill(3),5,5,2);assert(blurred.every(v=>Math.abs(v-3)<1e-5));
 const m=alphaMask(new Uint8Array([0,0,0,0,0,0,0,200]),2,1);assert.deepEqual([...m],[0,1]);
 assert.equal(lumaHeight(new Uint8Array([255,255,255,255]),1,1,{depth:2})[0],2);
 assert(seamError(new Uint8Array(16).fill(9),2,2).ratio===1);
});
