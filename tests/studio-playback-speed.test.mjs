/** Sprite timeline preview speed (src/studio/sprite/playback.js): a clock scale, never a duration edit. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {SPEEDS,normalizeSpeed,playClock,clockStart,steps,stepAt,rangeTag} from '../src/studio/sprite/playback.js';
import {st} from '../src/studio/strings.js';

const asset={frames:[0,1,2,3].map(i=>({id:'f'+i,duration:100}))};

test('speeds are a fixed ascending list around 1× and anything else falls back to 1×',()=>{
 assert.deepEqual(SPEEDS,[0.25,0.5,1,2,4]);
 for(const v of SPEEDS)assert.equal(normalizeSpeed(v),v);
 assert.equal(normalizeSpeed('2'),2);
 for(const v of [undefined,null,'',0,-1,3,NaN,'fast',Infinity])assert.equal(normalizeSpeed(v),1);
});
test('the clock scales elapsed time: 2× reaches a frame in half the wall-clock time, 0.5× in double',()=>{
 const list=steps(asset,rangeTag(asset)),at=(wall,speed)=>stepAt(list,playClock(wall,0,speed),{loop:true}).index;
 assert.equal(at(150,1),1);assert.equal(at(150,2),3);assert.equal(at(150,0.5),0);assert.equal(at(250,0.5),1);assert.equal(at(60,4),2);
 assert.deepEqual(asset.frames.map(f=>f.duration),[100,100,100,100],'durations are untouched');
});
test('clockStart starts on a given frame and keeps the showing frame across a speed change',()=>{
 const list=steps(asset,rangeTag(asset));
 for(const speed of SPEEDS){
  const t0=clockStart(1000,list[2].from,speed);
  assert.equal(stepAt(list,playClock(1000,t0,speed),{loop:true}).index,2,`starts on frame 3 at ${speed}×`);
 }
 // playing at 1× for 230 ms (frame 3), then switching to 4× at that instant
 const now=5230,t0=5000,ms=playClock(now,t0,1),t1=clockStart(now,ms,4);
 assert.equal(playClock(now,t1,4),ms);
 assert.equal(stepAt(list,playClock(now,t1,4),{loop:true}).index,2);
 assert.equal(stepAt(list,playClock(now+25,t1,4),{loop:true}).index,3,'and runs four times as fast from there');
});
test('the speed control is labelled in ko/en/ja and says durations stay',()=>{
 for(const l of ['en','ko','ja']){assert.notEqual(st(l,'sp.tl.speed'),'sp.tl.speed');assert.equal(st(l,'sp.tl.speedX',{x:0.5}),'0.5×');}
 assert.match(st('en','sp.tl.speed'),/not changed/);
});
