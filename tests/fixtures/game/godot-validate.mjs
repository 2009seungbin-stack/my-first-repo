/** Builds a real Sprite Lab project, writes it out as a tiny Godot project, runs the shipped
 * GDScript helper inside a real Godot build, and checks what came back against what was exported.
 *
 *   node tests/fixtures/game/godot-validate.mjs --godot "<path to godot console exe>" [--out <dir>]
 *
 * Exit code 0 and "GODOT VALIDATION PASSED" mean the engine loaded the export and every animation
 * name, frame count, region, margin, reported frame size, fps, loop flag, per-frame duration and
 * sampled pixel matched. Without --godot (or GODOT_BIN) it writes the project and stops, printing
 * UNVERIFIED — it never pretends. The version tested and the exact command are recorded in
 * docs/SPRITE-LAB.md. */
import {mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {encodePng} from './write-png.mjs';
import {animation,frame as makeFrame,playbackOrder,playbackTimes} from '../../../src/game/model.js';
import {framesFromRects,normalizeFrames} from '../../../src/game/frame-ops.js';
import {packFrames,blitPage} from '../../../src/game/packing.js';
import {frameCollision} from '../../../src/game/contour.js';
import {godotProject,godotBundle} from '../../../src/game/exporters/godot.js';
const here=dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2),arg=name=>{const i=argv.indexOf(name);return i<0?null:argv[i+1];};
const godot=arg('--godot')||process.env.GODOT_BIN||null;
const out=arg('--out')||join(process.env.TEMP||'/tmp','nerulio-godot-validate');
const canvas=(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h});
const box=(img,x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++){const p=((y+j)*img.width+x+i)*4;if(x+i<img.width&&y+j<img.height)img.data.set(c,p);}return img;};
/** Deliberately awkward: frames of three different sizes, artwork that does not fill its cell (so
 * trimming and margins matter), two animations, one of them ping-pong, mixed per-frame durations,
 * a non-default fps, loop off on one, and collision polygons. */
function build(){
 const shapes=[[28,36],[20,30],[34,26],[28,36],[20,30],[24,24]];
 const colours=[[220,60,60,255],[60,200,90,255],[70,110,240,255],[240,200,40,255],[200,80,220,255],[40,210,210,255]];
 const images=shapes.map(([w,h],i)=>{
  const img=canvas(w+10,h+10);
  box(img,5,5,w,h,colours[i]);
  box(img,5+(w>>2),5+(h>>2),Math.max(2,w>>1),Math.max(2,h>>1),[255,255,255,255]);
  return img;
 });
 const width=Math.max(...images.map(i=>i.width)),height=images.reduce((s,i)=>s+i.height+3,0);
 const sheet=canvas(width,height),rects=[];
 let y=0;
 for(const img of images){
  for(let row=0;row<img.height;row++)for(let col=0;col<img.width;col++){
   const from=(row*img.width+col)*4;
   sheet.data.set(img.data.subarray(from,from+4),((y+row)*width+col)*4);
  }
  rects.push({x:0,y,w:img.width,h:img.height});y+=img.height+3;
 }
 const {frames}=framesFromRects(sheet,rects,{trim:true,prefix:'hero_'});
 const normalized=normalizeFrames(frames,{align:'bottom-center',padding:2}).frames;
 const durations=[null,250,null,500,null,null],tags=['start','','','hit','',''];
 const dressed=normalized.map((f,i)=>makeFrame({...f,duration:durations[i],tag:tags[i],
  collision:frameCollision(sheet,f,{tolerance:1,maxVertices:10}).polygons.map(p=>p.points)}));
 const packed=packFrames(sheet,dressed,{padding:2,extrude:1});
 const animations=[
  animation({name:'run',frameIds:dressed.slice(0,4).map(f=>f.id),fps:15,direction:'forward',loop:true},dressed),
  animation({name:'attack',frameIds:dressed.slice(2).map(f=>f.id),fps:8,direction:'pingpong',loop:false},dressed)];
 return {sheet,frames:dressed,animations,packed,project:{frames:dressed,animations,atlas:packed.atlas}};
}
const {sheet,frames,animations,packed,project}=build();
const data=godotProject(project);
rmSync(out,{recursive:true,force:true});
mkdirSync(join(out,'addons','nerulio_sprite'),{recursive:true});
writeFileSync(join(out,'project.godot'),`config_version=5\n\n[application]\n\nconfig/name="nerulio-godot-validate"\nconfig/features=PackedStringArray("4.4")\n`);
for(const file of godotBundle(project))writeFileSync(join(out,file.name),file.text);
data.meta.images.forEach((name,page)=>writeFileSync(join(out,name),encodePng(blitPage(sheet,frames,packed.atlas,page))));
writeFileSync(join(out,'godot-validate.gd'),readFileSync(join(here,'godot-validate.gd')));
console.log(`project written to ${out} (${data.meta.images.length} page(s), ${frames.length} frames, ${animations.length} animations)`);
if(!godot){
 console.log('UNVERIFIED: no Godot binary given. Pass --godot <path> or set GODOT_BIN to run it for real.');
 process.exit(0);
}
if(!existsSync(godot)){console.error(`No Godot binary at ${godot}`);process.exit(2);}
const version=spawnSync(godot,['--version'],{encoding:'utf8'}).stdout.trim();
const run=spawnSync(godot,['--headless','--path',out,'--script','res://godot-validate.gd'],{encoding:'utf8',timeout:180000});
const text=`${run.stdout||''}\n${run.stderr||''}`;
const match=text.match(/NERULIO_REPORT_BEGIN\r?\n([\s\S]*?)\r?\nNERULIO_REPORT_END/);
if(!match){console.error(text);console.error('The validation script produced no report.');process.exit(3);}
const report=JSON.parse(match[1]);
const failures=[...report.errors];
const check=(ok,message)=>{if(!ok)failures.push(message);};
check(report.saved===true,'the resource was not saved');
check(report.scene?.pack_error===0&&report.scene?.save_error===0,`the scene did not pack/save (${JSON.stringify(report.scene)})`);
check(report.scene?.polygons>0,'the built scene has no CollisionPolygon2D children');
// Every animation Godot reloaded, against the export it came from.
const names=Object.keys(data.godot.animations).sort();
check(JSON.stringify(Object.keys(report.animations).sort())===JSON.stringify(names),
 `animation names ${JSON.stringify(Object.keys(report.animations))} != ${JSON.stringify(names)}`);
for(const name of names){
 const want=data.godot.animations[name],got=report.animations[name];
 if(!got){failures.push(`${name} is missing from the reloaded resource`);continue;}
 check(Math.abs(got.speed-want.speed)<1e-3,`${name} speed ${got.speed} != ${want.speed}`);
 check(got.loop===want.loop,`${name} loop ${got.loop} != ${want.loop}`);
 check(got.frames.length===want.frames.length,`${name} frame count ${got.frames.length} != ${want.frames.length}`);
 want.frames.forEach((step,i)=>{
  const frame=data.frames[step.frame],actual=got.frames[i];
  if(!actual)return;
  check(Math.abs(actual.duration-step.duration)<1e-3,`${name}[${i}] duration ${actual.duration} != ${step.duration}`);
  check(JSON.stringify(actual.region)===JSON.stringify([frame.rect.x,frame.rect.y,frame.rect.w,frame.rect.h]),
   `${name}[${i}] region ${JSON.stringify(actual.region)} != ${JSON.stringify([frame.rect.x,frame.rect.y,frame.rect.w,frame.rect.h])}`);
  check(JSON.stringify(actual.margin)===JSON.stringify(frame.godot.margin),
   `${name}[${i}] margin ${JSON.stringify(actual.margin)} != ${JSON.stringify(frame.godot.margin)}`);
  check(actual.size[0]===frame.sourceSize.w&&actual.size[1]===frame.sourceSize.h,
   `${name}[${i}] reported size ${JSON.stringify(actual.size)} != source size ${frame.sourceSize.w}x${frame.sourceSize.h}`);
  check(actual.filter_clip===true,`${name}[${i}] filter_clip is off`);
  const page=data.meta.pageSizes[frame.page];
  check(actual.atlas_size[0]===page.w&&actual.atlas_size[1]===page.h,`${name}[${i}] atlas page ${JSON.stringify(actual.atlas_size)} != ${page.w}x${page.h}`);
 });
}
// And the pixels: what Godot read out of the region against what the packer put there.
for(const [name,entry] of Object.entries(report.frames)){
 const frame=data.frames[name],page=blitPage(sheet,frames,packed.atlas,frame.page);
 [[0.5,0.5],[0.1,0.1],[0.9,0.9]].forEach(([fx,fy],i)=>{
  const x=frame.rect.x+Math.min(frame.rect.w-1,Math.floor(frame.rect.w*fx)),y=frame.rect.y+Math.min(frame.rect.h-1,Math.floor(frame.rect.h*fy));
  const at=(y*page.width+x)*4,expected=[page.data[at],page.data[at+1],page.data[at+2],page.data[at+3]];
  const got=entry.samples[i];
  const close=expected.every((v,c)=>Math.abs(v-got[c])<=1);
  check(close,`${name} sample ${i} at ${x},${y}: Godot read ${JSON.stringify(got)}, the atlas holds ${JSON.stringify(expected)}`);
 });
}
check(JSON.stringify(report.scripts)===JSON.stringify({'nerulio_sprite_frames.gd':'RefCounted','nerulio_sprite_import.gd':'EditorScript','nerulio_sprite_import_cli.gd':'SceneTree'}),
 `the shipped scripts did not all parse with the expected base types (${JSON.stringify(report.scripts)})`);
// And the shipped headless runner itself, not only the builder it shares with this harness.
const cli=spawnSync(godot,['--headless','--path',out,'--script','res://addons/nerulio_sprite/nerulio_sprite_import_cli.gd','--','atlas.json','res://from_cli.tres'],{encoding:'utf8',timeout:120000});
const cliText=`${cli.stdout||''}\n${cli.stderr||''}`;
check(cli.status===0&&/problems=0/.test(cliText),`the shipped CLI import failed:\n${cliText}`);
for(const name of names)check(new RegExp(`${name} frames=${data.godot.animations[name].frames.length} speed=${data.godot.animations[name].speed.toFixed(6)} loop=${data.godot.animations[name].loop?'true':'false'}`).test(cliText),
 `the shipped CLI did not report ${name} as exported`);
console.log(`Godot ${version}`);
console.log(`command: "${godot}" --headless --path "${out}" --script res://godot-validate.gd`);
console.log(`checked ${names.length} animations, ${Object.keys(data.frames).length} frames, ${Object.keys(report.frames).length}×3 pixel samples, 3 shipped scripts parsed, the shipped CLI run`);
if(failures.length){console.error(`\nGODOT VALIDATION FAILED (${failures.length}):`);for(const f of failures)console.error(`  - ${f}`);process.exit(1);}
console.log('GODOT VALIDATION PASSED');
