import test from 'node:test';
import assert from 'node:assert/strict';
import {STORE_SLOTS,slotById} from '../src/store-art/spec.js';
import {cropGeometry,normalizedSettings} from '../src/store-art/render.js';
test('required and custom slots keep their source-specific sizes',()=>{
 assert.deepEqual([slotById('store-small').w,slotById('store-small').h],[462,174]);
 assert.deepEqual([slotById('library-hero').w,slotById('library-hero').h],[3840,1240]);
 assert.equal(slotById('library-hero').text,'none');
 assert.equal(slotById('banner-suggested').required,false);
 assert.equal(slotById('feature').format,'jpeg');
 assert.equal(slotById('icon-source').notes.includes('Xcode'),true);
 assert.equal(new Set(STORE_SLOTS.map(x=>x.path)).size,STORE_SLOTS.length);
});
test('slot crop is independent and integer nearest only enlarges by whole factors',()=>{
 const a=normalizedSettings();a.slots['store-small'].x=.2;
 assert.equal(a.slots['store-header'].x,.5);
 const g=cropGeometry(16,16,630,500,{x:.5,y:.5,zoom:1},true);
 assert.equal(g.scale,40);assert.equal(g.integerNearest,true);assert.equal(g.downsampleNearest,false);
 assert.equal(g.w,640);assert.equal(g.h,640);assert.equal(g.x,-5);assert.equal(g.y,-70);
 const d=cropGeometry(3840,2160,462,174,{x:.5,y:.5,zoom:1},true);
 assert.equal(d.downsampleNearest,true);assert.equal(d.integerNearest,false);
});
