// Builds one Texture-workspace engine case WITHOUT a browser: the same pure modules the Studio
// runs (src/game/normals/*) turn a real sprite/texture into a normal map, the export bundle for
// every target is written exactly as the Studio zips it, and the reference lit render of each
// checked frame (src/game/normals/lighting.js) is saved next to it for the engine comparison.
//
//   node tools/engine-verify/texture/make_case.mjs --albedo <png> --out <dir> [--grid 32x32] [--frames 0,3]
//        [--kind sprite|texture] [--pixel] [--normal <png>] [--flip-green] [--name hero] [--lights json]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join,basename} from 'node:path';
import {decodePNG,encodeRGBAPNG} from '../../../src/game/texture-png.js';
import {generate,suggestParams,normalizeParams} from '../../../src/game/normals/pipeline.js';
import {renderLit,defaultScene} from '../../../src/game/normals/lighting.js';
import {bundleFiles,lightTexturesFor,specularMap} from '../../../src/game/normals/export.js';
import {flipGreen} from '../../../src/game/texture-normal.js';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]);return a;},[]));
if(!args.albedo||!args.out){console.error('usage: --albedo <png> --out <dir>');process.exit(2);}
const bytes=async blob=>new Uint8Array(await blob.arrayBuffer());
const albedoBytes=new Uint8Array(readFileSync(args.albedo)),img=await decodePNG(albedoBytes),{width:w,height:h,data}=img;
let frames=[];
if(args.grid){const [cw,ch]=String(args.grid).split('x').map(Number);for(let y=0;y+ch<=h;y+=ch)for(let x=0;x+cw<=w;x+=cw)frames.push({rect:{x,y,w:cw,h:ch},duration:100,name:`f${frames.length}`});}
const regions=frames.map(f=>f.rect);
let params=suggestParams(data,w,h,{pixelArt:!!args.pixel});
if(args.kind)params=normalizeParams({...params,kind:args.kind,bevel:{...params.bevel,on:args.kind==='sprite'},normal:{...params.normal,edge:args.kind==='texture'?'tile':'clamp'}});
let normal;
if(args.normal){const n=await decodePNG(new Uint8Array(readFileSync(args.normal)));normal=args['flip-green']?flipGreen(n.data,w,h):n.data;}
else normal=generate(data,w,h,params,{regions}).normal;
const fw=frames[0]?.rect.w||w,fh=frames[0]?.rect.h||h;
const scene=args.lights?JSON.parse(readFileSync(args.lights,'utf8')):{...defaultScene(fw,fh),lights:[
 {id:'l1',x:Math.round(fw*.2),y:Math.round(fh*.15),z:Math.max(8,Math.round(fw*.3)),color:'#ffd9a8',energy:1.3,radius:Math.round(Math.max(fw,fh)*1.5),falloff:'smooth'},
 {id:'l2',x:Math.round(fw*.9),y:Math.round(fh*.8),z:Math.max(6,Math.round(fw*.2)),color:'#6fa8ff',energy:.8,radius:Math.round(Math.max(fw,fh)),falloff:'linear'}]};
if(args.specular)scene.specular={strength:+args.specular,shininess:+(args.shininess??.5)};
const base=args.name||basename(args.albedo).replace(/\.png$/i,'');
const png={albedo:albedoBytes,normal:await bytes(await encodeRGBAPNG(normal,w,h)),normalDX:await bytes(await encodeRGBAPNG(flipGreen(normal,w,h),w,h)),light:{}};
const spec=specularMap(scene,w,h);if(spec)png.specular=await bytes(await encodeRGBAPNG(spec,w,h));
for(const [k,v] of Object.entries(lightTexturesFor(scene)))png.light[k]=await bytes(await encodeRGBAPNG(v,256,256));
const files=bundleFiles({base,targets:['godot','unity','generic'],png,width:w,height:h,frames,frameList:frames.map((f,i)=>({id:'f'+i})),tags:[],scene,pixelArt:!!args.pixel,params});
for(const f of files){const p=join(args.out,'bundle',f.name);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,typeof f.data==='string'?f.data:f.data);}
// reference renders of the checked frames (frame-local lights, pixel centres)
const pick=(args.frames?String(args.frames).split(',').map(Number):[0]).filter(i=>i<Math.max(1,frames.length));
const crop=(src,r)=>{const o=new Uint8Array(r.w*r.h*4);for(let y=0;y<r.h;y++)o.set(src.subarray(((r.y+y)*w+r.x)*4,((r.y+y)*w+r.x+r.w)*4),y*r.w*4);return o;};
const checks=[];
for(const i of pick){
 const r=frames[i]?.rect||{x:0,y:0,w,h},sopt=spec?{specular:crop(spec,r),specularColor:[1,1,1,scene.specular.shininess]}:{},lit=renderLit(crop(data,r),crop(normal,r),r.w,r.h,scene,sopt);
 writeFileSync(join(args.out,`expected_${i}.png`),await bytes(await encodeRGBAPNG(lit,r.w,r.h)));
 // the same scene read with the green channel flipped: what a wrong convention would look like
 writeFileSync(join(args.out,`expected_flipped_${i}.png`),await bytes(await encodeRGBAPNG(renderLit(crop(data,r),crop(normal,r),r.w,r.h,scene,{...sopt,flipGreen:true}),r.w,r.h)));
 writeFileSync(join(args.out,`albedo_${i}.png`),await bytes(await encodeRGBAPNG(crop(data,r),r.w,r.h)));
 checks.push({frame:i,rect:r,expected:`expected_${i}.png`,albedo:`albedo_${i}.png`});
}
writeFileSync(join(args.out,'case.json'),JSON.stringify({base,albedo:args.albedo,width:w,height:h,frames:frames.length,checks,scene,params},null,1));
console.log(`case ${base}: ${w}x${h}, ${frames.length||1} frame(s), ${files.length} files → ${args.out}`);
