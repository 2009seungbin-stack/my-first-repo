import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/studio/core/project.js';
import {History} from '../src/studio/core/history.js';
import {createImporter} from '../src/studio/sprite/importers.js';

// Pixel analysis is covered by real-browser/Pillow tests. Here the worker is held at
// each measurement boundary so edit ordering and undo cannot depend on machine speed.
const pending=[];
class ControlledWorker{
 postMessage(msg){
  const done=result=>this.onmessage({data:{id:msg.id,ok:true,result}});
  if(msg.op==='analyze')queueMicrotask(()=>done({width:203,height:186,key:null,
   grids:[{cellWidth:16,cellHeight:16,marginX:0,marginY:0,spacingX:1,spacingY:1,confidence:'high',score:.9,reasons:[]}],
   cells:{},auto:{rects:[],reasonCode:''}}));
  else if(msg.op==='cells')pending.push(()=>done({cells:null}));
  else throw Error('Unexpected worker operation '+msg.op);
 }
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function finishMeasurement(){await flush();assert.equal(pending.length,1,'one measured edit runs at a time');pending.shift()();await flush();}

test('rapid sparse grid edits and Apply keep both axes, preserve order and undo one edit at a time',async()=>{
 const originalWorker=globalThis.Worker;globalThis.Worker=ControlledWorker;
 try{
  const hash='a'.repeat(64),asset={...P.imageAsset({id:'tiles',name:'tiles.png',width:203,height:186,blob:hash}),import:{kind:'sheet',decisions:[]}};
  const history=new History(P.addAssets(P.createProject({id:'grid-test'}),[asset]));
  const notices=[],ctx={get doc(){return history.doc;},t:key=>key,
   images:{get:id=>id===hash?{blob:new Blob([])}:null},
   edit:(label,apply)=>({label,apply}),execute:cmd=>history.execute(cmd),toast:message=>notices.push(message)};
  const importer=createImporter(ctx);await importer.analyzeSheet('tiles');
  const x=importer.setCustomGrid('tiles',{sx:0}),y=importer.setCustomGrid('tiles',{sy:0});
  const applied=importer.applySheet('tiles');
  await finishMeasurement();await finishMeasurement();
  await Promise.all([x,y,applied]);
  let a=history.doc.assets[0];assert.deepEqual(a.grid,{w:16,h:16,ox:0,oy:0,sx:0,sy:0});
  assert.equal(a.frames.length,132);assert.deepEqual(a.frames.at(-1).sourceRect,{x:176,y:160,w:16,h:16});
  assert.equal(history.entries.length,3,'X, Y and Apply are separate ordered steps');
  history.undo();assert.equal(history.doc.assets[0].frames.length,0);
  history.undo();assert.equal(importer.planFor('tiles').plan.grid.sx,0);assert.equal(importer.planFor('tiles').plan.grid.sy,1);
  history.undo();assert.equal(importer.planFor('tiles').plan.grid.sx,1);assert.equal(importer.planFor('tiles').plan.grid.sy,1);
  history.redo();history.redo();history.redo();
  const nextX=importer.setCustomGrid('tiles',{sx:1}),nextY=importer.setCustomGrid('tiles',{sy:1});
  await finishMeasurement();await finishMeasurement();await Promise.all([nextX,nextY]);
  a=history.doc.assets[0];assert.equal(a.grid.sx,1);assert.equal(a.grid.sy,1);
  assert.deepEqual(a.frames.at(-1).sourceRect,{x:187,y:170,w:16,h:16});
  history.undo();assert.equal(importer.planFor('tiles').plan.grid.sx,1);assert.equal(importer.planFor('tiles').plan.grid.sy,0);
  history.redo();assert.equal(importer.planFor('tiles').plan.grid.sy,1);
  const count=history.entries.length;
  await Promise.all([importer.setCustomGrid('tiles',{sx:1}),importer.setCustomGrid('tiles',{sx:1})]);
  assert.equal(history.entries.length,count,'Enter followed by blur does not add duplicate edits');
  assert.deepEqual(notices,[]);
 }finally{globalThis.Worker=originalWorker;}
});
