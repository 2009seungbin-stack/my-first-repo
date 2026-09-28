import assert from 'node:assert/strict';
import test from 'node:test';
import {speedLines,speechBalloon,screentone} from '../src/webtoon/effects.js';
test('speed lines are deterministic and bounded',()=>{const a=speedLines({width:4096,height:2160,seed:42,count:100});assert.equal(a,speedLines({width:4096,height:2160,seed:42,count:100}));assert.match(a,/width="4096"/);assert.equal((a.match(/<path/g)||[]).length<=100,true);assert(!a.includes('NaN'));});
test('speech text is XML-escaped, short, and CJK retained',()=>{const a=speechBalloon({text:'안녕 <script>\nこんにちは & hi',width:800,height:400});assert(!a.includes('<script>'));assert(a.includes('&lt;script&gt;'));assert(a.includes('こんにちは'));assert.throws(()=>speechBalloon({text:'X'.repeat(1000)}),/too long/);});
test('tone pitch is PPI / LPI pixels, not tile-size lpi',()=>{const a=screentone({ppi:300,lpi:60,density:.25,width:800,height:1200});assert.match(a,/width="5.000" height="5.000"/);assert.match(a,/r="1.410"/);assert.throws(()=>screentone({ppi:72,lpi:150}),/smaller than 2/);});
