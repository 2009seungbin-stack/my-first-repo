import assert from 'node:assert/strict';
import test from 'node:test';
import {evenlySpaced,validateCuts,suggestedCuts,joinedLayout} from '../src/webtoon/geometry.js';
import {checkOutput} from '../src/webtoon/specs.js';
test('split rows are disjoint, exhaustive and height-bounded',()=>{
 for(let h=1;h<4096;h+=37){const parts=validateCuts(h,evenlySpaced(h,128));assert.equal(parts.reduce((n,p)=>n+p.height,0),h);assert.equal(parts[0].y,0);assert.equal(parts.at(-1).y+parts.at(-1).height,h);assert(parts.every(p=>p.height>0&&p.height<=128));}
});
test('gutter suggestion is advisory and valid',()=>{const rows=new Float32Array(1000).fill(0.9);rows[480]=0;const v=suggestedCuts(1000,500,rows,{radius:60,minPart:50});assert.deepEqual(v.cuts,[480]);assert.equal(validateCuts(1000,v.cuts).length,2);});
test('join order and memory refusal',()=>{assert.deepEqual(joinedLayout([{width:100,height:20},{width:80,height:30}]).placements.map(x=>x.y),[0,20]);assert.throws(()=>joinedLayout([{width:800,height:100000}]),/budget/);});
test('dated profiles distinguish hard dimensions from conservative byte targets',()=>{assert.equal(checkOutput('canvas',[{width:800,height:1280,bytes:1_500_000,format:'jpeg'}]).ok,true);assert.equal(checkOutput('canvas',[{width:800,height:1281,bytes:1_500_000,format:'jpeg'}]).ok,false);assert.match(checkOutput('canvas',[]).scope,/conservative/);assert.equal(checkOutput('naver',[{width:690,height:5000,bytes:1000,format:'jpeg'}]).ok,true);assert.equal(checkOutput('naver',[{width:690,height:5000,bytes:1000,format:'png'}]).ok,false);});
