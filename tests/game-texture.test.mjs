import test from 'node:test';import assert from 'node:assert/strict';
import {decodePNG,encodeGrayPNG,encodeRGBAPNG,pngChunks,isPNG} from '../src/game/texture-png.js';
import {extractChannel,unpackChannels,planeToRGBA,invertPlane,invertChannel,planeStats,luminancePlane,colorSpread,alphaStats,packPlanes} from '../src/game/texture-channels.js';
import {ENGINE_PRESETS,PRESET_IDS,presetChannels,roleTooltip,ENGINE_DOCS} from '../src/game/texture-presets.js';
import {classifyTextureName,validateTextureSet,WORKFLOWS,isPowerOfTwo,colorSpaceOf,normalizeStem} from '../src/game/texture-set.js';
import {deflateSync} from 'node:zlib';
import {crc32} from '../src/core.js';
const bytesOf=async blob=>new Uint8Array(await blob.arrayBuffer());
const chunk=(type,data)=>{
 const body=new Uint8Array(4+data.length);body.set(new TextEncoder().encode(type));body.set(data,4);
 const out=new Uint8Array(body.length+8),view=new DataView(out.buffer);
 view.setUint32(0,data.length);out.set(body,4);view.setUint32(out.length-4,crc32(body));return out;
};
/** Minimal PNG writer for the decoder's own tests: `rows` are raw scanlines including the
 * leading filter byte, so a filter or a bit depth can be exercised exactly as the spec defines. */
function buildPNG(w,h,depth,colorType,rows,extra={},interlace=0){
 const header=new Uint8Array(13),view=new DataView(header.buffer);
 view.setUint32(0,w);view.setUint32(4,h);header.set([depth,colorType,0,0,interlace],8);
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header)];
 if(extra.PLTE)parts.push(chunk('PLTE',new Uint8Array(extra.PLTE)));
 if(extra.tRNS)parts.push(chunk('tRNS',new Uint8Array(extra.tRNS)));
 parts.push(chunk('IDAT',new Uint8Array(deflateSync(Buffer.from(rows.flat())))),chunk('IEND',new Uint8Array()));
 const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);
 let at=0;for(const p of parts){out.set(p,at);at+=p.length;}
 return out;
}
/** A texture whose RGB carries data under alpha 0 — the case a canvas round-trip destroys. */
function packed(w=4,h=4){
 const data=new Uint8Array(w*h*4);
 for(let p=0;p<w*h;p++)data.set([10+p,80+p,220-p,p%2?0:255],p*4);
 return {data,w,h};
}
test('the raw PNG path round-trips RGB that sits under zero alpha',async()=>{
 const {data,w,h}=packed();
 const png=await bytesOf(await encodeRGBAPNG(data,w,h));
 assert(isPNG(png));assert.deepEqual(pngChunks(png).map(c=>c.type).filter(t=>t!=='IDAT'),['IHDR','IEND']);
 const decoded=await decodePNG(png);
 assert.deepEqual([decoded.width,decoded.height,decoded.colorType,decoded.depth],[w,h,6,8]);
 assert.deepEqual([...decoded.data],[...data],'every byte survives, including RGB under alpha 0');
});
test('a greyscale PNG of one channel re-decodes to the very bytes that were packed',async()=>{
 const {data,w,h}=packed();
 for(const [name,channel] of [['r',0],['g',1],['b',2],['a',3]]){
  const plane=extractChannel(data,w,h,name),png=await bytesOf(await encodeGrayPNG(plane,w,h)),back=await decodePNG(png);
  assert.equal(back.colorType,0);assert.equal(back.depth,8);
  assert.deepEqual([...back.data.filter((_,i)=>i%4===0)],[...plane],`channel ${name}`);
  assert.deepEqual([...plane],[...data.filter((_,i)=>i%4===channel)]);
 }
});
test('PNG decoding covers the colour types a texture arrives in, and refuses what it cannot do exactly',async()=>{
 // Hand-built files: the expectation is the spec, not another decoder's opinion.
 const gray8=await decodePNG(buildPNG(2,1,8,0,[[0,7,200]]));
 assert.deepEqual([...gray8.data],[7,7,7,255,200,200,200,255]);
 const gray16=await decodePNG(buildPNG(1,1,16,0,[[0,0x12,0x34]]));
 assert.deepEqual([...gray16.data],[0x12,0x12,0x12,255],'16-bit samples keep their high byte');
 const gray4=await decodePNG(buildPNG(2,1,4,0,[[0,0xf0]]));
 assert.deepEqual([...gray4.data],[255,255,255,255,0,0,0,255],'sub-byte samples scale to 0…255');
 const indexed=await decodePNG(buildPNG(2,1,8,3,[[0,1,0]],{PLTE:[9,8,7,60,70,80],tRNS:[0,255]}));
 assert.deepEqual([...indexed.data],[60,70,80,255,9,8,7,0],'a transparent palette index keeps its RGB');
 const grayAlpha=await decodePNG(buildPNG(1,1,8,4,[[0,40,0]]));
 assert.deepEqual([...grayAlpha.data],[40,40,40,0]);
 const filtered=await decodePNG(buildPNG(3,1,8,2,[[1,10,20,30,5,5,5,5,5,5]]));
 assert.deepEqual([...filtered.data],[10,20,30,255,15,25,35,255,20,30,40,255],'the Sub filter is reversed');
 const rgb=await encodeRGBAPNG(new Uint8Array([1,2,3,255,4,5,6,255]),2,1);
 assert.deepEqual([...(await decodePNG(await bytesOf(rgb))).data.slice(0,4)],[1,2,3,255]);
 await assert.rejects(()=>decodePNG(new Uint8Array([1,2,3])),/Not a PNG/);
 const broken=await bytesOf(rgb);broken[broken.length-6]^=0xff;
 await assert.rejects(()=>decodePNG(broken),/CRC/);
 const small=await bytesOf(await encodeRGBAPNG(new Uint8Array([9,9,9,9]),1,1));
 await assert.rejects(()=>decodePNG(small,{maxPixels:0}),/limited to/);
 await assert.rejects(()=>decodePNG(buildPNG(1,1,8,6,[[0,1,2,3,4]],{},1)),/Interlaced/);
 await assert.rejects(()=>decodePNG(buildPNG(1,1,8,5,[[0,1]])),/colour type 5/);
});
test('channel planes are exact, inversion is its own inverse, and packing copies bytes',()=>{
 const {data,w,h}=packed();
 const planes=unpackChannels(data,w,h);
 assert.deepEqual(Object.keys(planes),['r','g','b','a']);
 assert.equal(planes.r[0],10);assert.equal(planes.a[1],0);
 assert.deepEqual([...invertPlane(invertPlane(planes.g))],[...planes.g]);
 assert.deepEqual([...invertPlane(planes.g)].slice(0,2),[255-80,255-81]);
 const rgba=planeToRGBA(planes.b,w,h);assert.deepEqual([...rgba.slice(0,4)],[220,220,220,255]);
 const repacked=packPlanes([planes.r,planes.g,planes.b,planes.a],w,h,[0,1,2,3]);
 assert.deepEqual([...repacked],[...data],'unpack → pack is lossless');
 const swapped=packPlanes([planes.r,planes.g],w,h,['one',{plane:0,invert:true},1,'zero']);
 assert.deepEqual([...swapped.slice(0,4)],[255,245,80,0]);
 assert.throws(()=>packPlanes([planes.r],w,h,[0,0,0]),/Four channel mappings/);
 assert.throws(()=>packPlanes([planes.r],w,h,[0,1,2,3]),/Missing channel input/);
 assert.deepEqual([...invertChannel(data,w,h,'g').slice(0,4)],[10,175,220,255]);
});
test('measurements the validator relies on',()=>{
 const {data,w,h}=packed();
 const stats=planeStats(extractChannel(data,w,h,'r'));
 assert.deepEqual([stats.min,stats.max,stats.unique,stats.constant],[10,25,16,false]);
 assert(planeStats(new Uint8Array(8).fill(7)).constant);
 const gray=new Uint8Array(16).fill(120);for(let p=0;p<4;p++)gray[p*4+3]=255;
 assert.equal(colorSpread(gray,2,2).grayscale,true);
 assert.equal(colorSpread(data,w,h).grayscale,false);
 assert.equal(luminancePlane(new Uint8Array([255,255,255,255]),1,1)[0],255);
 const alpha=alphaStats(data,w,h);
 assert.equal(alpha.zeroPixels,8);assert.equal(alpha.rgbUnderZeroAlpha,8);assert.equal(alpha.used,true);
 assert.equal(alphaStats(new Uint8Array([1,2,3,255]),1,1).used,false);
});
test('engine presets carry a channel meaning and a tooltip in ko/en/ja',()=>{
 assert(PRESET_IDS.length>=4);
 for(const id of PRESET_IDS){
  const preset=ENGINE_PRESETS[id],channels=presetChannels(id);
  assert.equal(channels.length,4,id);
  for(const c of channels){
   assert(['r','g','b','a'].includes(c.channel),id);
   for(const locale of ['ko','en','ja']){assert(c.tooltip[locale]?.trim().length>4,`${id}.${c.channel}.${locale}`);assert(preset.label[locale]?.trim(),id);}
  }
  assert(preset.doc.url.startsWith('https://'),id);assert(preset.doc.section,id);
  assert(['unity','unreal','godot','generic'].includes(preset.engine),id);
 }
 assert.deepEqual(presetChannels('unity-hdrp-mask').map(c=>c.role),['metallic','ao','detail','smoothness']);
 assert.deepEqual(presetChannels('unity-urp-metallic').map(c=>c.role),['metallic','ignored','ignored','smoothness'],'Unity reads metallic from R only');
 assert.deepEqual(presetChannels('unreal-orm').map(c=>c.role),['ao','roughness','metallic','unused']);
 assert.deepEqual(presetChannels('godot-orm').map(c=>c.role),['ao','roughness','metallic','unused']);
 assert.match(roleTooltip('unreal-orm','g','en'),/rough/);assert.match(roleTooltip('godot-orm','r','ko'),/AO/);
 assert(ENGINE_DOCS.normalConvention.opengl.engines.includes('unity'));
 assert(ENGINE_DOCS.normalConvention.directx.engines.includes('unreal'));
});
test('filenames classify into roles and keep the set name they belong to',()=>{
 const cases=[['rock_basecolor.png','albedo','rock'],['Rock_Albedo.PNG','albedo','rock'],['rock-diffuse.jpg','albedo','rock'],
  ['rock_normal.png','normal','rock'],['rock_nrm.png','normal','rock'],['rock_n.png','normal','rock'],
  ['rock_roughness.png','roughness','rock'],['rock_rough.png','roughness','rock'],['rock_smoothness.png','smoothness','rock'],
  ['rock_metallic.png','metallic','rock'],['rock_metalness.png','metallic','rock'],
  ['rock_ao.png','ao','rock'],['rock_occlusion.png','ao','rock'],['rock_height.png','height','rock'],['rock_disp.png','height','rock'],
  ['rock_emissive.png','emission','rock'],['T_Rock_ORM.png','orm','t_rock'],['T_Rock_MaskMap.png','orm','t_rock'],
  ['rock_opacity.png','opacity','rock'],['rock.png','unknown','rock']];
 for(const [name,role,setName] of cases){
  const found=classifyTextureName(name);
  assert.equal(found.role,role,name);assert.equal(found.setName,setName,name);
 }
 assert.equal(classifyTextureName('rock_n.png').confidence,'low');
 assert.equal(classifyTextureName('rock_normal.png').confidence,'high');
 assert.equal(normalizeStem('Wall 01-Base Color.png'),'wall_01_base_color');
 assert.equal(colorSpaceOf('albedo'),'srgb');assert.equal(colorSpaceOf('roughness'),'linear');
});
const entry=(name,role,over={})=>({name,role,setName:classifyTextureName(name).setName,width:512,height:512,channels:3,
 alpha:{used:false,min:255,max:255,zeroPixels:0,rgbUnderZeroAlpha:0},color:{grayscale:true,maxSpread:0,differingRatio:0},normal:null,...over});
test('the PBR validator reports the real problems and stays quiet otherwise',()=>{
 const clean=[entry('rock_basecolor.png','albedo',{color:{grayscale:false,maxSpread:120,differingRatio:.9}}),
  entry('rock_normal.png','normal',{color:{grayscale:false,maxSpread:90,differingRatio:.9},normal:{unitLength:true,blueNonNegative:true,flatRatio:0,looksLikeNormalMap:true,maxDeviation:.01,offUnitRatio:0,negativeBlueRatio:0,minBlue:200}}),
  entry('rock_roughness.png','roughness'),entry('rock_metallic.png','metallic')];
 const good=validateTextureSet(clean,{workflow:'metallic-roughness'});
 assert.equal(good.ok,true);
 assert.deepEqual(good.issues.filter(i=>i.level!=='info').map(i=>i.id),[],JSON.stringify(good.issues));
 const ids=r=>r.issues.map(i=>i.id);
 const mismatched=validateTextureSet([clean[0],{...clean[1],width:1024}],{workflow:'metallic-roughness'});
 assert(ids(mismatched).includes('dimension-mismatch'));assert.equal(mismatched.ok,false);
 const npot=validateTextureSet([{...clean[0],width:500,height:512}]);
 assert(ids(npot).includes('not-power-of-two')&&ids(npot).includes('missing-recommended'));
 const alpha=validateTextureSet([clean[0],{...clean[1],alpha:{used:true,min:0,max:255,zeroPixels:12,rgbUnderZeroAlpha:4}}]);
 assert(ids(alpha).includes('unexpected-alpha')&&ids(alpha).includes('rgb-under-zero-alpha'));
 const rgbRough=validateTextureSet([clean[0],{...clean[2],color:{grayscale:false,maxSpread:40,differingRatio:.5}}]);
 assert(ids(rgbRough).includes('gray-channels-differ'));
 const badNormal=validateTextureSet([clean[0],{...clean[1],normal:{unitLength:false,blueNonNegative:false,flatRatio:0,looksLikeNormalMap:false,maxDeviation:.4,offUnitRatio:.3,negativeBlueRatio:.2,minBlue:10}}]);
 assert(ids(badNormal).includes('normal-not-unit')&&ids(badNormal).includes('normal-blue-negative'));
 const hdrp=validateTextureSet(clean,{workflow:'unity-hdrp-mask'});
 assert(ids(hdrp).includes('missing-required'));
 const naming=validateTextureSet([clean[0],{...clean[1],name:'stone_normal.png',setName:'stone'}]);
 assert(ids(naming).includes('naming-inconsistent'));
 assert(isPowerOfTwo(1024)&&!isPowerOfTwo(1000)&&!isPowerOfTwo(0));
 assert.throws(()=>validateTextureSet(clean,{workflow:'nope'}),/Unknown texture workflow/);
 assert.deepEqual(Object.keys(WORKFLOWS).length>=4,true);
});
