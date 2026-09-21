import test from 'node:test';import assert from 'node:assert/strict';
import {frame,animation,playbackOrder,playbackTimes,pivotPixels,setPivot,mirrorFrame,validateProject,SCHEMA_VERSION} from '../src/game/model.js';
const F=(o={})=>frame({sourceRect:{x:10,y:20,w:32,h:48},...o});
test('a frame defaults to its source cell with a bottom-centre pivot',()=>{
 const f=F();assert.deepEqual([f.canvasWidth,f.canvasHeight,f.offsetX,f.offsetY,f.pivotX,f.pivotY],[32,48,0,0,.5,1]);assert.equal(SCHEMA_VERSION,1);
 assert.deepEqual(pivotPixels(f),{x:16,y:48});assert.deepEqual(pivotPixels(setPivot(f,8,12,{pixels:true})),{x:8,y:12});
});
test('a trimmed frame keeps its pixels where they were unless told otherwise',()=>{
 const f=F({trimmedRect:{x:14,y:30,w:10,h:20}});assert.deepEqual([f.offsetX,f.offsetY],[4,10]);
 assert.throws(()=>F({trimmedRect:{x:0,y:0,w:4,h:4}}),/inside sourceRect/);
 assert.throws(()=>F({trimmedRect:{x:14,y:30,w:10,h:20},canvasWidth:12,offsetX:4}),/do not fit/);
 assert.throws(()=>F({sourceRect:{x:0,y:0,w:1.5,h:2}}),/integer/);
});
test('playback order is one definition for preview and export',()=>{
 const frames=['a','b','c','d'].map(id=>F({id})),a=animation({frameIds:['a','b','c','d'],fps:10},frames);
 assert.deepEqual(playbackOrder(a),['a','b','c','d']);assert.deepEqual(playbackOrder({...a,direction:'reverse'}),['d','c','b','a']);
 assert.deepEqual(playbackOrder({...a,direction:'pingpong'}),['a','b','c','d','c','b'],'ends are not doubled');
 frames[1].duration=250;assert.deepEqual(playbackTimes(a,frames),[100,250,100,100]);
 assert.throws(()=>animation({frameIds:['zz']},frames),/unknown frame/);assert.throws(()=>animation({fps:0}),/fps/);
});
test('mirroring flips pivot, offset, boxes and collision together and keeps polygon winding',()=>{
 const area=p=>p.reduce((s,[x,y],i)=>{const [nx,ny]=p[(i+1)%p.length];return s+x*ny-nx*y;},0);
 const f=F({trimmedRect:{x:12,y:20,w:10,h:48},pivotX:.25,boxes:[{shape:'rect',type:'hit',x:20,y:4,w:10,h:6},{shape:'circle',type:'hurt',cx:5,cy:5,r:3},{shape:'polygon',points:[[0,0],[8,0],[0,8]]}],collision:[[[0,0],[10,0],[10,10]]]}),m=mirrorFrame(f);
 assert.equal(m.pivotX,.75);assert.equal(m.offsetX,32-2-10);assert.equal(m.boxes[0].x,2);assert.equal(m.boxes[1].cx,27);
 assert.equal(Math.sign(area(m.collision[0])),Math.sign(area(f.collision[0])));assert.equal(Math.sign(area(m.boxes[2].points)),Math.sign(area(f.boxes[2].points)));
 const back=mirrorFrame(m);assert.deepEqual([back.pivotX,back.offsetX,back.boxes[0].x,back.boxes[1].cx],[f.pivotX,f.offsetX,f.boxes[0].x,f.boxes[1].cx],'mirroring twice is the identity');
 assert.equal(m.metadata.mirroredFrom,f.id);assert.notEqual(m.id,f.id);
});
test('project validation names what an exporter could not represent',()=>{
 const f=F({id:'x'});assert.deepEqual(validateProject({frames:[f],animations:[animation({name:'idle',frameIds:['x']})]}),[]);
 const errors=validateProject({frames:[f,f],animations:[{name:'idle',frameIds:['nope']},{name:'idle',frameIds:[]}]});
 assert.ok(errors.some(e=>/Duplicate frame id/.test(e))&&errors.some(e=>/unknown frame nope/.test(e))&&errors.some(e=>/Duplicate animation name/.test(e))&&errors.some(e=>/no frames/.test(e)),errors.join(' | '));
});
