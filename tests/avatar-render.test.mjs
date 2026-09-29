import test from 'node:test';
import assert from 'node:assert/strict';
import {renderLogical,nearest} from '../src/avatar/render.js';

test('original avatar parts are distinct at the logical grid',()=>{
 const base=renderLogical();
 for(const variant of [{face:'angular'},{hair:'swept'},{eyes:'sleepy'},{outfit:'jacket'},{accessory:'glasses'}]){
  assert.notDeepEqual(renderLogical(variant).data,base.data,JSON.stringify(variant));
 }
 assert.equal(base.width,16);
 assert.equal(base.data[3],0);
});

test('32, 48, 64 and 4096 outputs are exact integer replication',()=>{
 const base=renderLogical({face:'angular',hair:'swept',eyes:'sleepy',outfit:'jacket'});
 for(const size of [32,48,64,4096]){
  const output=nearest(base,size),factor=size/16;
  for(const [x,y] of [[0,0],[factor*5,factor*7],[size-1,size-1]]){
   const sourceIndex=((Math.floor(y/factor)*16)+Math.floor(x/factor))*4;
   const outputIndex=(y*size+x)*4;
   assert.deepEqual([...output.data.slice(outputIndex,outputIndex+4)],[...base.data.slice(sourceIndex,sourceIndex+4)]);
  }
 }
 assert.throws(()=>nearest(base,47),RangeError);
});
