/** Runs a ZIP that the Sprite Lab itself produced through the *shipped* Godot helper, in a real
 * Godot 4, and asserts that the engine reports what the bundle's own atlas.json claims.
 *
 * godot-validate.mjs validates the exporter from generated data; this validates the thing a person
 * actually downloads: the ZIP is unpacked into a Godot project as-is, the shipped
 * `nerulio_sprite_frames.gd` builds the SpriteFrames, it is saved with ResourceSaver, reloaded with
 * the cache bypassed, and every animation speed, loop flag, per-frame duration, AtlasTexture region
 * and margin is compared with the JSON. Then the shipped headless runner is executed on its own.
 *
 *   node tests/fixtures/game/godot-validate-bundle.mjs <bundle.zip> [--godot <path>]
 *
 * Without a Godot binary (`--godot` or GODOT_BIN) it prints UNVERIFIED and exits 0, rather than
 * pretending. Only Node's own zlib is used, so nothing but Node is needed to unpack the ZIP. */
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {inflateRawSync} from 'node:zlib';

const args=process.argv.slice(2);
const zipPath=args.find(a=>!a.startsWith('--'));
const godotFlag=args.indexOf('--godot');
const godot=godotFlag>=0?args[godotFlag+1]:process.env.GODOT_BIN;
if(!zipPath){console.error('usage: node godot-validate-bundle.mjs <bundle.zip> [--godot <path>]');process.exit(2);}

/** Stored and deflated entries only, which is all `src/core.js` writes and all we need here. */
function unzip(buffer){
 const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength),out=new Map();
 let end=buffer.length-22;
 while(end>=0&&view.getUint32(end,true)!==0x06054b50)end--;
 if(end<0)throw Error('not a ZIP');
 const count=view.getUint16(end+10,true);
 let at=view.getUint32(end+16,true);
 for(let i=0;i<count;i++){
  if(view.getUint32(at,true)!==0x02014b50)throw Error('bad central directory');
  const method=view.getUint16(at+10,true),size=view.getUint32(at+24,true);
  const nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true);
  const offset=view.getUint32(at+42,true);
  const name=new TextDecoder().decode(buffer.subarray(at+46,at+46+nameLength));
  const localExtra=view.getUint16(offset+28,true),localName=view.getUint16(offset+26,true);
  const from=offset+30+localName+localExtra,raw=buffer.subarray(from,from+ (method===0?size:view.getUint32(offset+18,true)||size));
  out.set(name,method===0?Buffer.from(raw):inflateRawSync(raw));
  at+=46+nameLength+extra+comment;
 }
 return out;
}

const files=unzip(readFileSync(zipPath));
const jsonName=[...files.keys()].find(n=>n.endsWith('.json')&&!n.includes('/'));
if(!jsonName)throw Error(`no atlas JSON in ${zipPath} (${[...files.keys()].join(', ')})`);
const data=JSON.parse(files.get(jsonName).toString('utf8'));
if(data.meta.engineTarget!=='godot-4')throw Error(`this bundle is engineTarget ${data.meta.engineTarget}, not godot-4`);
if(!data.godot)throw Error('this bundle has no godot block; export with the Godot 4 target');

const out=join(tmpdir(),'nerulio-lab-godot-validate');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const [name,body] of files){
 const target=join(out,name);
 mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,body);
}
// The bundle names its JSON after the atlas stem; the helper and the harness both read atlas.json.
if(jsonName!=='atlas.json')writeFileSync(join(out,'atlas.json'),files.get(jsonName));
writeFileSync(join(out,'project.godot'),`config_version=5\n\n[application]\n\nconfig/name="nerulio-lab-godot-validate"\nconfig/features=PackedStringArray("4.4")\n`);
writeFileSync(join(out,'godot-validate.gd'),readFileSync(new URL('./godot-validate.gd',import.meta.url)));
console.log(`bundle ${zipPath} unpacked to ${out}: ${[...files.keys()].length} files, ${data.meta.pages} page(s), ${Object.keys(data.frames).length} frames, ${Object.keys(data.animations).length} animations`);
if(!godot){
 console.log('UNVERIFIED: no Godot binary given. Pass --godot <path> or set GODOT_BIN to run it for real.');
 process.exit(0);
}
if(!existsSync(godot)){console.error(`No Godot binary at ${godot}`);process.exit(2);}
const version=spawnSync(godot,['--version'],{encoding:'utf8'}).stdout.trim();
const run=spawnSync(godot,['--headless','--path',out,'--script','res://godot-validate.gd'],{encoding:'utf8',timeout:180000});
const text=`${run.stdout||''}\n${run.stderr||''}`;
const match=text.match(/NERULIO_REPORT_BEGIN\s+([\s\S]*?)\s+NERULIO_REPORT_END/);
if(!match){console.error(`Godot produced no report:\n${text}`);process.exit(1);}
const report=JSON.parse(match[1]);
const failures=[...report.errors];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const names=Object.keys(data.godot.animations);
check(Object.keys(report.animations).sort().join()===names.slice().sort().join(),
 `Godot has animations ${JSON.stringify(Object.keys(report.animations))}, the export declares ${JSON.stringify(names)}`);
for(const name of names){
 const want=data.godot.animations[name],got=report.animations[name];
 if(!got){check(false,`${name} is missing in the engine`);continue;}
 check(got.frames.length===want.frames.length,`${name} has ${got.frames.length} frames in the engine, ${want.frames.length} in the export`);
 check(Math.abs(got.speed-want.speed)<1e-4,`${name} speed ${got.speed} != ${want.speed}`);
 check(got.loop===want.loop,`${name} loop ${got.loop} != ${want.loop}`);
 want.frames.forEach((step,i)=>{
  const actual=got.frames[i];if(!actual)return;
  const frame=data.frames[step.frame];
  check(Math.abs(actual.duration-step.duration)<1e-3,`${name}[${i}] duration ${actual.duration} != ${step.duration}`);
  check(actual.region.join()===[frame.rect.x,frame.rect.y,frame.rect.w,frame.rect.h].join(),
   `${name}[${i}] region ${JSON.stringify(actual.region)} != ${JSON.stringify([frame.rect.x,frame.rect.y,frame.rect.w,frame.rect.h])}`);
  check(actual.margin.join()===frame.godot.margin.join(),`${name}[${i}] margin ${JSON.stringify(actual.margin)} != ${JSON.stringify(frame.godot.margin)}`);
  check(actual.size[0]===frame.sourceSize.w&&actual.size[1]===frame.sourceSize.h,
   `${name}[${i}] reported size ${JSON.stringify(actual.size)} != source size ${frame.sourceSize.w}x${frame.sourceSize.h}`);
  check(actual.filter_clip===true,`${name}[${i}] filter_clip is off`);
  const page=data.meta.pageSizes[frame.page];
  check(actual.atlas_size[0]===page.w&&actual.atlas_size[1]===page.h,`${name}[${i}] atlas page ${JSON.stringify(actual.atlas_size)} != ${page.w}x${page.h}`);
 });
}
check(JSON.stringify(report.scripts)===JSON.stringify({'nerulio_sprite_frames.gd':'RefCounted','nerulio_sprite_import.gd':'EditorScript','nerulio_sprite_import_cli.gd':'SceneTree'}),
 `the shipped scripts did not all parse with the expected base types (${JSON.stringify(report.scripts)})`);
check(report.scene&&report.scene.pack_error===0&&report.scene.save_error===0,`the scene path failed: ${JSON.stringify(report.scene)}`);
const wantPolygons=Object.values(data.frames).reduce((n,f)=>n+(f.collision?.length||0),0);
check(report.scene.polygons>0===wantPolygons>0,
 `the scene has ${report.scene.polygons} CollisionPolygon2D nodes but the export carries ${wantPolygons} polygons`);
const cli=spawnSync(godot,['--headless','--path',out,'--script','res://addons/nerulio_sprite/nerulio_sprite_import_cli.gd','--','atlas.json','res://from_cli.tres'],{encoding:'utf8',timeout:120000});
const cliText=`${cli.stdout||''}\n${cli.stderr||''}`;
check(cli.status===0&&/problems=0/.test(cliText),`the shipped CLI import failed:\n${cliText}`);
for(const name of names)check(new RegExp(`${name} frames=${data.godot.animations[name].frames.length} speed=${data.godot.animations[name].speed.toFixed(6)} loop=${data.godot.animations[name].loop?'true':'false'}`).test(cliText),
 `the shipped CLI did not report ${name} as exported`);
console.log(`Godot ${version}`);
console.log(`command: "${godot}" --headless --path "${out}" --script res://godot-validate.gd`);
console.log(`checked ${names.length} animations, ${Object.keys(data.frames).length} frames, ${report.scene.polygons} collision polygons in the packed scene, 3 shipped scripts parsed, the shipped CLI run`);
if(failures.length){console.error(`\nLAB BUNDLE GODOT VALIDATION FAILED (${failures.length}):`);for(const f of failures)console.error(`  - ${f}`);process.exit(1);}
console.log('LAB BUNDLE GODOT VALIDATION PASSED');
