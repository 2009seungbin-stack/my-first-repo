import test from 'node:test';import assert from 'node:assert/strict';
import {project,addAnimation,updateAnimation,removeAnimation,mirrorAnimation,applyPivotTo,addBoxTo,updateBox,removeBox,setCollision,setDuration,setTag,
 reorderFrames,removeFrames,setFrames,playback,stepAt,cycleMs,boxTimeline,stepRange,uniqueAnimationName,problems,
 settingsQuery,settingsFromQuery,projectFile,readProjectFile,PROJECT_FORMAT,BOX_PATTERNS} from '../src/game/project.js';
import {frame,playbackOrder,pivotPixels} from '../src/game/model.js';

const sheetFrames=(n=6)=>Array.from({length:n},(_,i)=>frame({name:`walk_${i+1}`,sourceRect:{x:i*10,y:0,w:8,h:12},canvasWidth:10,canvasHeight:14,offsetX:1,offsetY:1}));
const walk=()=>{const frames=sheetFrames();return addAnimation(project({frames}),{name:'Walk',frameIds:frames.map(f=>f.id),fps:12});};

test('animation names stay unique, because an exporter keys on them',()=>{
 let p=project({frames:sheetFrames(2)});
 p=addAnimation(p,{name:'Walk',frameIds:[p.frames[0].id]});
 p=addAnimation(p,{name:'Walk',frameIds:[p.frames[1].id]});
 assert.deepEqual(p.animations.map(a=>a.name),['Walk','Walk_2']);
 assert.equal(uniqueAnimationName(p,'Walk'),'Walk_3');
 assert.deepEqual(problems(p),[],'two animations with distinct names validate');
 p=updateAnimation(p,p.animations[1].id,{name:'Attack',fps:8,direction:'pingpong',loop:false});
 assert.deepEqual([p.animations[1].name,p.animations[1].fps,p.animations[1].direction,p.animations[1].loop],['Attack',8,'pingpong',false]);
 assert.equal(removeAnimation(p,p.animations[0].id).animations.length,1);
 assert.throws(()=>updateAnimation(p,'nope',{fps:4}),/Unknown animation/);
});
test('playback is the only definition of the sequence, and ping-pong does not double its ends',()=>{
 let p=walk();
 const forward=playback(p,p.animations[0]);
 assert.deepEqual(forward.map(s=>s.frame.name),['walk_1','walk_2','walk_3','walk_4','walk_5','walk_6']);
 assert.deepEqual(forward.map(s=>s.duration),Array(6).fill(1000/12));
 p=updateAnimation(p,p.animations[0].id,{direction:'pingpong'});
 const pp=playback(p,p.animations[0]).map(s=>s.frame.name);
 assert.deepEqual(pp,['walk_1','walk_2','walk_3','walk_4','walk_5','walk_6','walk_5','walk_4','walk_3','walk_2']);
 assert.equal(pp.filter(n=>n==='walk_6').length,1,'the last frame plays once');
 assert.equal(pp.filter(n=>n==='walk_1').length,1,'the first frame plays once');
 assert.deepEqual(pp,playbackOrder(p.animations[0]).map(id=>p.frames.find(f=>f.id===id).name),'same list as the exporter reads');
 p=updateAnimation(p,p.animations[0].id,{direction:'reverse'});
 assert.deepEqual(playback(p,p.animations[0]).map(s=>s.frame.name),['walk_6','walk_5','walk_4','walk_3','walk_2','walk_1']);
});
test('per-frame durations move the playhead, and stepAt lands where they say',()=>{
 let p=walk();
 p=setDuration(p,[p.frames[1].id],500);
 const steps=playback(p,p.animations[0]);
 assert.equal(steps[1].duration,500);
 assert.equal(Math.round(cycleMs(p,p.animations[0])),Math.round(5*1000/12+500));
 assert.equal(stepAt(steps,0).step,0);
 assert.equal(stepAt(steps,100).step,1,'the 500ms frame is still showing at 100ms');
 assert.equal(stepAt(steps,500).step,1);
 assert.equal(stepAt(steps,600).step,2);
 assert.equal(stepAt(steps,cycleMs(p,p.animations[0])).step,0,'the cycle wraps');
 assert.equal(stepAt([],10),null);
});
test('pivots apply to a selection, in normalised or pixel units, per frame',()=>{
 let p=project({frames:[...sheetFrames(1),frame({name:'big',sourceRect:{x:0,y:20,w:20,h:20}})]});
 p=applyPivotTo(p,p.frames.map(f=>f.id),'center');
 assert.deepEqual(p.frames.map(f=>[f.pivotX,f.pivotY]),[[.5,.5],[.5,.5]]);
 p=applyPivotTo(p,p.frames.map(f=>f.id),{x:5,y:5,pixels:true});
 assert.deepEqual(p.frames.map(f=>pivotPixels(f)),[{x:5,y:5},{x:5,y:5}],'5px is 5px on both canvases');
 assert.notEqual(p.frames[0].pivotX,p.frames[1].pivotX,'…which is a different normalised value on each');
 assert.throws(()=>applyPivotTo(p,[],'nope'),/Unknown pivot preset/);
});
test('a box is copied per frame, so editing one frame does not edit another',()=>{
 let p=walk();
 const ids=stepRange(p,p.animations[0],4,6);
 assert.deepEqual(ids.map(id=>p.frames.find(f=>f.id===id).name),['walk_4','walk_5','walk_6']);
 p=addBoxTo(p,ids,{type:'hit',shape:'rect',x:2,y:3,w:4,h:5});
 assert.deepEqual(p.frames.map(f=>f.boxes.length),[0,0,0,1,1,1]);
 const boxIds=new Set(p.frames.flatMap(f=>f.boxes.map(b=>b.id)));
 assert.equal(boxIds.size,3,'three boxes, three ids');
 p=updateBox(p,p.frames[3].id,p.frames[3].boxes[0].id,{w:9});
 assert.deepEqual([p.frames[3].boxes[0].w,p.frames[4].boxes[0].w],[9,4]);
 p=removeBox(p,p.frames[5].id,p.frames[5].boxes[0].id);
 assert.deepEqual(p.frames.map(f=>f.boxes.length),[0,0,0,1,1,0]);
 assert.deepEqual(stepRange(p,p.animations[0],5,99).length,2,'a range past the end stops at the last step');
 assert.throws(()=>stepRange(p,p.animations[0],10,12),/outside this animation/);
});
test('the hitbox timeline is the frames × box-type grid, told apart by pattern not colour',()=>{
 let p=walk();
 p=updateAnimation(p,p.animations[0].id,{direction:'pingpong'});
 p=addBoxTo(p,stepRange(p,p.animations[0],4,6),{type:'hit',shape:'rect',x:0,y:0,w:2,h:2});
 p=addBoxTo(p,[p.frames[0].id],{type:'hurt',shape:'circle',cx:5,cy:7,r:3});
 const tl=boxTimeline(p,p.animations[0]);
 assert.equal(tl.steps.length,10,'a ping-pong timeline is as long as its playback');
 assert.deepEqual(tl.rows.map(r=>r.type),['hurt','hit']);
 assert.deepEqual(tl.rows.find(r=>r.type==='hit').cells,[0,0,0,1,1,1,1,1,0,0],'the hit box is active on both passes of frames 4–6');
 assert.deepEqual(tl.rows.find(r=>r.type==='hurt').cells,[1,0,0,0,0,0,0,0,0,0]);
 assert.deepEqual(tl.rows.map(r=>r.pattern),[BOX_PATTERNS.hurt,BOX_PATTERNS.hit]);
});
test('mirroring an animation makes real mirrored frames and plays them in the same order',()=>{
 let p=walk();
 p=applyPivotTo(p,[p.frames[0].id],{x:.25,y:1});
 p=addBoxTo(p,[p.frames[0].id],{type:'hit',shape:'rect',x:1,y:2,w:3,h:4});
 p=setCollision(p,[p.frames[0].id],[[[1,1],[4,1],[4,5]]]);
 p=mirrorAnimation(p,p.animations[0].id);
 assert.equal(p.frames.length,12);
 assert.equal(p.animations[1].name,'Walk_mirror');
 const source=p.frames[0],mirrored=p.frames[6];
 assert.equal(mirrored.name,'walk_1_mirror');
 assert.equal(mirrored.pivotX,1-source.pivotX);
 assert.equal(mirrored.boxes[0].x,source.canvasWidth-source.boxes[0].x-source.boxes[0].w);
 assert.deepEqual(mirrored.collision[0].map(([x])=>x),[source.canvasWidth-4,source.canvasWidth-4,source.canvasWidth-1]);
 assert.deepEqual(playback(p,p.animations[1]).map(s=>s.frame.name),p.frames.slice(6).map(f=>f.name));
 assert.deepEqual(problems(p),[]);
});
test('frame edits invalidate the atlas instead of letting an export read stale rectangles',()=>{
 let p={...walk(),atlas:{width:8,height:8,pages:1,frames:{}}};
 assert.equal(applyPivotTo(p,[p.frames[0].id],'center').atlas,null);
 assert.equal(removeFrames(p,[p.frames[0].id]).atlas,null);
 assert.equal(setTag(p,[p.frames[0].id],'Walk').atlas,null);
 assert.notEqual(reorderFrames(p,[...p.frames].reverse().map(f=>f.id)).atlas,null,'reordering does not move a pixel');
});
test('removing frames removes every reference, and an emptied animation goes with them',()=>{
 let p=walk();
 p=addAnimation(p,{name:'Hit',frameIds:[p.frames[0].id]});
 p=removeFrames(p,[p.frames[0].id]);
 assert.equal(p.frames.length,5);
 assert.deepEqual(p.animations.map(a=>a.name),['Walk']);
 assert.deepEqual(p.animations[0].frameIds.length,5);
 assert.deepEqual(problems(p),[]);
 assert.throws(()=>reorderFrames(p,[p.frames[0].id]),/every frame/);
 assert.equal(setFrames(p,p.frames.slice(0,2)).animations[0].frameIds.length,2);
});
test('settings travel in a URL; image data never does',()=>{
 const defaults={mode:'auto',merge:0,trim:false,maxSize:4096,align:'bottom-center'};
 const query=settingsQuery({mode:'grid',merge:3,trim:true,maxSize:4096,align:'top'},defaults);
 assert.equal(new URLSearchParams(query).get('maxSize'),null,'a default is not written');
 assert.deepEqual(settingsFromQuery(query,defaults),{mode:'grid',merge:3,trim:true,maxSize:4096,align:'top'});
 assert.deepEqual(settingsFromQuery('mode=nonsense&merge=999&align=diagonal&fps=abc',defaults),
  {...defaults,merge:256},'out-of-range clamps, unknown values are ignored');
 assert.deepEqual(settingsFromQuery('sheet=data:image/png;base64,AAAA',defaults),defaults,'no image data is accepted');
});
test('a project file carries records only, and refuses a different sheet',()=>{
 let p=walk();
 p=addBoxTo(p,[p.frames[2].id],{type:'hurt',shape:'polygon',points:[[0,0],[3,0],[3,4]]});
 p=setCollision(p,[p.frames[2].id],[[[0,0],[2,0],[2,2]]]);
 const file=projectFile({...p,settings:{fps:12}},{sheetWidth:60,sheetHeight:14,sheetName:'walk.png'});
 assert.equal(file.format,PROJECT_FORMAT);
 assert(!JSON.stringify(file).includes('data:'),'no image data inside');
 const back=readProjectFile(JSON.parse(JSON.stringify(file)),{sheetWidth:60,sheetHeight:14});
 assert.deepEqual(back.frames.map(f=>f.name),p.frames.map(f=>f.name));
 assert.deepEqual(back.frames[2].boxes[0].points,[[0,0],[3,0],[3,4]]);
 assert.deepEqual(playback(back,back.animations[0]).map(s=>s.frame.name),playback(p,p.animations[0]).map(s=>s.frame.name));
 assert.throws(()=>readProjectFile(file,{sheetWidth:61,sheetHeight:14}),/60×14 sheet/);
 assert.throws(()=>readProjectFile({format:'other'}),/not a Sprite Lab project/);
 assert.throws(()=>readProjectFile({...file,animations:[{...file.animations[0],frameIds:['missing']}]},{sheetWidth:60,sheetHeight:14}),/unknown frame|Animation references/);
});
