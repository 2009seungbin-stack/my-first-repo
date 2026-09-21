import test from 'node:test';import assert from 'node:assert/strict';
import {envelope,TOOL_VERSION} from '../src/game/exporters/ui-envelope.js';
test('the envelope is the documented shape and fills in what a frame leaves out',()=>{
 const json=envelope({tool:'nerulio-ui-lab',image:'ui-atlas.png',width:64,height:32,
  frames:[{name:'panel',rect:{x:0,y:0,w:24,h:16},nineSlice:{left:6,right:6,top:5,bottom:4}},
          {name:'icon',rect:{x:24,y:0,w:8,h:8},sourceSize:{w:10,h:10},offset:{x:1,y:1},state:'normal'}]});
 assert.deepEqual(json.meta,{tool:'nerulio-ui-lab',toolVersion:TOOL_VERSION,schemaVersion:1,engineTarget:'generic',image:'ui-atlas.png',size:{w:64,h:32}});
 assert.deepEqual(json.frames.panel.rect,{x:0,y:0,w:24,h:16});
 assert.deepEqual(json.frames.panel.sourceSize,{w:24,h:16});
 assert.deepEqual(json.frames.panel.nineSlice.pixels,{left:6,right:6,top:5,bottom:4});
 assert.deepEqual(json.frames.panel.nineSlice.unity.border,[6,4,6,5]);
 assert.equal(json.frames.panel.nineSlice.normalized.top,5/16);
 assert.deepEqual(json.frames.icon.offset,{x:1,y:1});
 assert.equal(json.frames.icon.state,'normal');
 assert.equal(json.frames.icon.nineSlice,undefined);
 assert.deepEqual(json.animations,{});
 assert.throws(()=>envelope({tool:'x',width:0,height:1}),/atlas size/);
 assert.throws(()=>envelope({tool:'',width:1,height:1}),/names the tool/);
 assert.throws(()=>envelope({tool:'x',width:8,height:8,frames:[{name:'a',rect:{x:0,y:0,w:1,h:1}},{name:'a',rect:{x:1,y:0,w:1,h:1}}]}),/Duplicate/);
});
