import test from 'node:test';import assert from 'node:assert/strict';
import {exportProject,projectJson,genericBundle,frameNames,imageNames,TOOL,TOOL_VERSION,ENGINE_TARGETS} from '../src/game/exporters/generic-json.js';
import {godotProject,godotJson,godotBundle,GODOT_HELPER,GODOT_VERSION_NOTES,GODOT_TARGET} from '../src/game/exporters/godot.js';
import {unityProject,unityBundle,toUnityRect,toUnityPivot,toUnityPoint,toUnityBorder,toUnityPhysicsShape,UNITY_VERIFIED,UNITY_TARGET,UNITY_NOTES,UNITY_EDITOR_SCRIPT} from '../src/game/exporters/unity.js';
import {animation,playbackOrder,playbackTimes,SCHEMA_VERSION} from '../src/game/model.js';
import {framesFromRects,normalizeFrames} from '../src/game/frame-ops.js';
import {packFrames} from '../src/game/packing.js';
import {frameCollision} from '../src/game/contour.js';
import {canvas,box,disc,stack,walkCycle,hundredFrames} from './game-fixtures.mjs';
import {spawnSync} from 'node:child_process';

function project({count=4,direction='forward',fps=12,collision=false,durations=null}={}){
 const {sheet,rects}=stack(walkCycle(count));
 const {frames}=framesFromRects(sheet,rects,{trim:true,prefix:'walk_'});
 const normalized=normalizeFrames(frames,{align:'bottom-center',padding:1}).frames;
 const withExtras=normalized.map((f,i)=>({...f,tag:i?'':'start',duration:durations?durations[i]:null,
  collision:collision?frameCollision(sheet,f,{tolerance:1,maxVertices:10}).polygons.map(p=>p.points):[]}));
 const packed=packFrames(sheet,withExtras,{padding:2});
 const anim=animation({name:'walk',frameIds:withExtras.map(f=>f.id),fps,direction},withExtras);
 return {sheet,project:{frames:withExtras,animations:[anim],atlas:packed.atlas},packed,anim};
}

test('the envelope is exactly what docs/GAME-LABS.md describes',()=>{
 const {project:p}=project();
 const data=exportProject(p);
 assert.deepEqual(Object.keys(data).sort(),['animations','frames','meta']);
 assert.equal(data.meta.tool,TOOL);assert.equal(data.meta.toolVersion,TOOL_VERSION);
 assert.equal(data.meta.schemaVersion,SCHEMA_VERSION);assert.equal(data.meta.engineTarget,'generic');
 assert.equal(data.meta.image,'atlas.png');assert.deepEqual(data.meta.images,['atlas.png']);
 assert.deepEqual(data.meta.size,{w:p.atlas.pageSizes[0].width,h:p.atlas.pageSizes[0].height});
 const first=data.frames[Object.keys(data.frames)[0]];
 assert.deepEqual(Object.keys(first).sort(),['aliasOf','boxes','collision','duration','metadata','offset','page','pivot','rect','rotated','sourceSize','tag'].sort());
 assert.equal(first.rotated,false);
 assert.deepEqual(ENGINE_TARGETS,['generic','godot-4','unity-2022']);
 assert.equal(JSON.parse(projectJson(p)).meta.tool,TOOL);
 assert.deepEqual(genericBundle(p).map(f=>f.name),['atlas.json']);
});
test('every frame rect in the export is the rect the packer placed',()=>{
 const {project:p}=project({count:8});
 const data=exportProject(p),names=frameNames(p.frames);
 for(const f of p.frames){
  const entry=data.frames[names.get(f.id)],place=p.atlas.frames[f.id];
  assert.deepEqual(entry.rect,{x:place.x,y:place.y,w:place.w,h:place.h},`${f.name} rect`);
  assert.equal(entry.page,place.page);
  assert.deepEqual(entry.sourceSize,{w:f.canvasWidth,h:f.canvasHeight});
  assert.deepEqual(entry.offset,{x:f.offsetX,y:f.offsetY});
  assert.deepEqual(entry.pivot,{x:f.pivotX,y:f.pivotY});
 }
 const aliased=Object.values(data.frames).filter(e=>e.aliasOf);
 assert(aliased.length,'the repeated walk poses are aliased in the export too');
 for(const e of aliased)assert(data.frames[e.aliasOf],'an alias names a frame that is in the export');
});
test('playback order and per-frame durations come from the model, so preview equals export',()=>{
 for(const direction of ['forward','reverse','pingpong']){
  const {project:p,anim}=project({count:4,direction,fps:10,durations:[null,250,null,null]});
  const data=exportProject(p),names=frameNames(p.frames);
  const a=data.animations.walk;
  assert.equal(a.direction,direction);assert.equal(a.fps,10);assert.equal(a.loop,true);
  assert.deepEqual(a.frames,p.frames.map(f=>names.get(f.id)),'the authored order is kept as authored');
  assert.deepEqual(a.playback.frames,playbackOrder(anim).map(id=>names.get(id)),`${direction} playback order`);
  assert.deepEqual(a.playback.durations,playbackTimes(anim,p.frames));
  assert.equal(a.totalMs,a.playback.durations.reduce((s,v)=>s+v,0));
 }
 const {project:p}=project({count:4,direction:'pingpong'});
 assert.equal(exportProject(p).animations.walk.playback.frames.length,6,'ping-pong does not double the end frames');
});
test('an export refuses to describe something an engine could not load',()=>{
 const {project:p}=project();
 assert.throws(()=>exportProject({...p,atlas:null}),/Pack the frames before exporting/);
 assert.throws(()=>exportProject({...p,frames:[]}),/at least one frame/);
 assert.throws(()=>exportProject(p,{engineTarget:'unreal'}),/engineTarget must be/);
 assert.throws(()=>exportProject({...p,animations:[{name:'walk',frameIds:['nope']}]}),/unknown frame nope/);
 assert.throws(()=>exportProject({...p,atlas:{...p.atlas,frames:{}}}),/No atlas region for/);
 const dup=[{...p.frames[0],name:'same'},{...p.frames[1],name:'same'},{...p.frames[2],name:''}];
 const names=frameNames(dup);
 assert.deepEqual([...names.values()],['same','same_2','frame_003'],'colliding and empty names are made unique');
 assert.deepEqual(imageNames(1),['atlas.png']);
 assert.deepEqual(imageNames(3,{base:'hero sheet.png'}),['hero_sheet-0.png','hero_sheet-1.png','hero_sheet-2.png']);
 assert.throws(()=>imageNames(0),/1…256/);
});
test('a multi-page project names every page and every frame says which one it is on',()=>{
 const {sheet,rects}=stack(hundredFrames());
 const {frames}=framesFromRects(sheet,rects,{trim:true});
 const packed=packFrames(sheet,frames,{maxSize:128,padding:1,dedupe:false});
 assert(packed.atlas.pages>1);
 const data=exportProject({frames,animations:[],atlas:packed.atlas},{base:'hero'});
 assert.equal(data.meta.pages,packed.atlas.pages);
 assert.equal(data.meta.images.length,packed.atlas.pages);
 assert.equal(data.meta.images[0],'hero-0.png');
 assert.equal(data.meta.pageSizes.length,packed.atlas.pages);
 for(const [name,entry] of Object.entries(data.frames)){
  assert(entry.page>=0&&entry.page<packed.atlas.pages,`${name} page ${entry.page}`);
  const page=data.meta.pageSizes[entry.page];
  assert(entry.rect.x+entry.rect.w<=page.w&&entry.rect.y+entry.rect.h<=page.h,`${name} fits its page`);
 }
});
test('the Godot export converts durations to relative ticks and margins to AtlasTexture terms',()=>{
 const {project:p,anim}=project({count:4,fps:12,durations:[null,250,500,null]});
 const data=godotProject(p);
 assert.equal(data.meta.engineTarget,GODOT_TARGET);
 assert.equal(data.meta.godot.version,'4');
 assert.deepEqual(data.meta.godot.notes,GODOT_VERSION_NOTES);
 const g=data.godot.animations.walk;
 assert.equal(g.speed,12);assert.equal(g.loop,true);
 // 1000/12 ms is one tick: the default frames are 1.0, a 250ms frame is 3.0, a 500ms frame is 6.0
 assert.deepEqual(g.frames.map(f=>f.duration),[1,3,6,1]);
 assert.deepEqual(g.frames.map(f=>f.frame),playbackOrder(anim).map(id=>frameNames(p.frames).get(id)));
 for(const [name,entry] of Object.entries(data.frames)){
  const [mx,my,mw,mh]=entry.godot.margin;
  assert.deepEqual([mx,my],[entry.offset.x,entry.offset.y],`${name} margin position is the offset`);
  assert.deepEqual([mw,mh],[entry.sourceSize.w-entry.rect.w,entry.sourceSize.h-entry.rect.h],`${name} margin size is the trimmed slack`);
  assert.equal(entry.godot.filterClip,true);
 }
 const reverse=godotProject(project({count:4,direction:'reverse'}).project);
 assert.deepEqual(reverse.godot.animations.walk.frames.map(f=>f.frame).reverse(),reverse.animations.walk.frames,
  'the direction is baked into the Godot frame order, because SpriteFrames has none');
});
test('the Godot bundle ships a helper that is a script, not a resource look-alike',()=>{
 const {project:p}=project({collision:true});
 const bundle=godotBundle(p);
 assert.deepEqual(bundle.map(f=>f.name),['atlas.json','addons/nerulio_sprite/nerulio_sprite_frames.gd',
  'addons/nerulio_sprite/nerulio_sprite_import.gd','addons/nerulio_sprite/nerulio_sprite_import_cli.gd','addons/nerulio_sprite/README.md']);
 for(const file of bundle)assert(file.text.length>100,`${file.name} has content`);
 assert(!bundle.some(f=>/\.tres$|\.tscn$/.test(f.name)),'no resource files are hand-written');
 assert(GODOT_HELPER.includes('ResourceSaver.save'),'the resource is saved by the engine');
 assert(GODOT_HELPER.includes('add_frame(anim_name, cache[frame_name], float(step.get("duration", 1.0)))'));
 assert(GODOT_HELPER.includes('texture.margin = Rect2(margin[0], margin[1], margin[2], margin[3])'));
 assert(GODOT_HELPER.includes('CollisionPolygon2D'),'collision polygons become real nodes');
 assert(!/\[gd_resource|\[sub_resource|\[ext_resource/.test(GODOT_HELPER),'and no .tres text is assembled in the script either');
 const withCollision=JSON.parse(godotJson(p));
 assert(Object.values(withCollision.frames).some(f=>f.collision.length),'the collision polygons are in the data');
});
test('the Unity export flips to a bottom-left origin and renormalises the pivot inside the rect',()=>{
 assert.deepEqual(toUnityRect({x:10,y:12,w:20,h:14},64),{x:10,y:64-12-14,width:20,height:14});
 assert.deepEqual(toUnityRect({x:0,y:0,w:8,h:8},8),{x:0,y:0,width:8,height:8});
 assert.throws(()=>toUnityRect({x:0,y:4,w:8,h:8},8),/does not fit/);
 assert.throws(()=>toUnityRect({x:0,y:0,w:8,h:8},0),/page height/);
 // A 32x24 canvas whose 20x14 artwork sits at (5,7), with a bottom-centre pivot at (16,24):
 // inside the rect that is (11, -3) from the top-left, i.e. y = (14 - 17)/14 below the rect.
 const frame={canvasWidth:32,canvasHeight:24,offsetX:5,offsetY:7,pivotX:.5,pivotY:1,collision:[],metadata:{}};
 const rect={x:0,y:0,w:20,h:14};
 assert.deepEqual(toUnityPivot(frame,rect),{x:11/20,y:(14-17)/14});
 assert(toUnityPivot(frame,rect).y<0,'a pivot below the artwork is negative on purpose, not clamped');
 const centred={...frame,pivotX:.5,pivotY:.5};
 assert.deepEqual(toUnityPivot(centred,rect),{x:11/20,y:(14-5)/14});
 assert.deepEqual(toUnityPoint(5,7,frame,rect),{x:0,y:14},'the top-left of the artwork is the top-left of the rect, y up');
 assert.deepEqual(toUnityPoint(25,21,frame,rect),{x:20,y:0});
 assert.deepEqual(toUnityBorder(frame),{x:0,y:0,z:0,w:0});
 assert.deepEqual(toUnityBorder({...frame,metadata:{border:{left:1,top:2,right:3,bottom:4}}}),{x:1,y:4,z:3,w:2},'Unity orders a border left, bottom, right, top');
 assert.throws(()=>toUnityBorder({...frame,metadata:{border:{left:-1,top:0,right:0,bottom:0}}}),/non-negative/);
 assert.deepEqual(toUnityPhysicsShape({...frame,collision:[[[5,7],[25,7],[25,21]]]},rect),[[{x:0,y:14},{x:20,y:14},{x:20,y:0}]]);
});
test('the Unity export is labelled UNVERIFIED everywhere it can be read',()=>{
 const {project:p}=project({collision:true});
 const data=unityProject(p);
 assert.equal(data.meta.engineTarget,UNITY_TARGET);
 assert.equal(UNITY_VERIFIED,false);
 assert.equal(data.unity.verified,false);assert.equal(data.meta.unity.verified,false);
 assert(data.unity.notes.some(n=>/UNVERIFIED/.test(n)),JSON.stringify(data.unity.notes));
 assert(UNITY_NOTES.some(n=>/UNVERIFIED/.test(n)));
 assert(UNITY_EDITOR_SCRIPT.includes('UNVERIFIED'),'and in the C# file itself');
 const bundle=unityBundle(p);
 assert.deepEqual(bundle.map(f=>f.name),['atlas.json','Editor/NerulioSpriteImporter.cs','UNITY-README.md']);
 assert(!bundle.some(f=>/\.meta$/.test(f.name)),'no .meta files are invented');
 assert(bundle.find(f=>f.name==='UNITY-README.md').text.includes('UNVERIFIED'));
 for(const sprite of data.unity.sprites){
  const page=data.meta.pageSizes[sprite.page];
  assert(sprite.rect.y>=0&&sprite.rect.y+sprite.rect.height<=page.h,`${sprite.name} sits inside its page after the flip`);
  assert.equal(sprite.alignment,9,'SpriteAlignment.Custom, since the pivot is exact');
 }
 assert(data.unity.sprites.some(s=>s.physicsShape.length),'the collision polygons became physics shapes');
 assert.equal(data.unity.pixelsPerUnit,100);
 assert.equal(unityProject(p,{pixelsPerUnit:16}).unity.pixelsPerUnit,16);
});
// The Godot export is validated inside a real Godot build by tests/fixtures/game/godot-validate.mjs,
// which needs an engine binary. Point GODOT_BIN at one (a console/headless build from
// github.com/godotengine/godot/releases) and this runs it; without one the check is skipped rather
// than quietly assumed. The result of the run that was done is recorded in docs/SPRITE-LAB.md.
test('the Godot export loads in a real Godot build',{skip:!process.env.GODOT_BIN&&'set GODOT_BIN to a Godot 4 binary to run this'},()=>{
 const run=spawnSync(process.execPath,['tests/fixtures/game/godot-validate.mjs','--godot',process.env.GODOT_BIN],{encoding:'utf8',timeout:300000});
 assert.equal(run.status,0,`${run.stdout}\n${run.stderr}`);
 assert.match(run.stdout,/GODOT VALIDATION PASSED/);
});
