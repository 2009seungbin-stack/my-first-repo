import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePixelGIF} from '../src/studio/pixel/gif-export.js';
import {decodeGIF} from '../src/studio/sprite/gif-decode.js';

test('shared-palette GIF reopens with transparent full frames and rounded delays',async()=>{
 const width=3,height=2;
 const a=new Uint8Array([255,0,0,255, 0,0,0,0, 0,255,0,255, 255,0,0,255, 0,0,0,0, 0,255,0,255]);
 const b=new Uint8Array([0,255,0,255, 255,0,0,255, 0,0,0,0, 0,255,0,255, 255,0,0,255, 0,0,0,0]);
 const frames=[a,b,a].map(data=>({data,width,height}));
 const out=await encodePixelGIF(frames,{durations:[70,130,250],palette:[[255,0,0],[0,255,0]],loop:true});
 assert.deepEqual(Array.from(out.bytes.subarray(0,6)),[71,73,70,56,57,97]);
 const dec=decodeGIF(out.bytes);
 assert.deepEqual([dec.width,dec.height,dec.frames.length,dec.loop],[width,height,3,0]);
 assert.deepEqual(dec.frames.map(f=>f.rawDelay),[70,130,250]);
 for(let i=0;i<frames.length;i++)assert.deepEqual(dec.frames[i].rgba,frames[i].data);
});
