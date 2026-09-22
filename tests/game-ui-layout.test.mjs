import test from 'node:test';import assert from 'node:assert/strict';
import {ANCHORS,anchoredRect,SAFE_AREAS,safeRect,SCREENS,ASPECTS,SCALES,isCrisp,crispBelow,wrap,textFit,mergeRects} from '../src/game/ui-layout.js';
const screen={w:1920,h:1080},button={w:200,h:64};
test('anchor presets place a control the way the four anchor numbers say',()=>{
 assert.deepEqual(ANCHORS.center,[.5,.5,.5,.5]);
 const c=anchoredRect('center',screen,button);
 assert.deepEqual([c.x,c.y,c.w,c.h],[860,508,200,64]);
 assert.deepEqual(c.stretched,{x:false,y:false});
 const tr=anchoredRect('top-right',screen,button,16);
 assert.deepEqual([tr.x,tr.y,tr.w,tr.h],[1704,16,200,64]);
 const bl=anchoredRect('bottom-left',screen,button,24);
 assert.deepEqual([bl.x,bl.y],[24,992]);
 const wide=anchoredRect('bottom-wide',screen,button,20);
 assert.deepEqual([wide.x,wide.y,wide.w,wide.h],[20,996,1880,64]);
 assert.deepEqual(wide.stretched,{x:true,y:false});
 const full=anchoredRect('full-rect',screen,button,0);
 assert.deepEqual([full.x,full.y,full.w,full.h],[0,0,1920,1080]);
 assert.throws(()=>anchoredRect('middle-ish',screen,button),/anchor preset/);
});
test('safe areas are a percentage inset or the exact insets given',()=>{
 assert.deepEqual(SAFE_AREAS.map(s=>s.percent),[90,93,95]);
 assert.deepEqual(safeRect(1920,1080,{percent:90}),{x:96,y:54,w:1728,h:972});
 assert.deepEqual(safeRect(1920,1080,{percent:93}),{x:67,y:38,w:1786,h:1004});
 assert.deepEqual(safeRect(800,600,{insets:{top:40,left:10}}),{x:10,y:40,w:790,h:560});
 assert.deepEqual(safeRect(100,100,{}),{x:0,y:0,w:100,h:100});
});
test('screen, aspect and scale presets are plain data',()=>{
 assert.deepEqual(SCREENS.map(s=>s.w),[1280,1920,2560,3840]);
 assert.equal(ASPECTS.find(a=>a.id==='21:9').ratio,21/9);
 assert.deepEqual(SCALES.filter(isCrisp),[1,2,3]);
 assert.equal(crispBelow(1.75),1);assert.equal(crispBelow(2.5),2);
});
test('line breaking is greedy over measured chunks and reports the widest line',()=>{
 const words=[{text:'Start',width:60},{text:'the',width:30},{text:'game',width:50}];
 const one=wrap(words,200,{spaceWidth:8});
 assert.deepEqual([one.count,one.width],[1,156]);
 const two=wrap(words,100,{spaceWidth:8});
 assert.deepEqual(two.lines.map(l=>l.chunks.map(c=>c.text)),[['Start','the'],['game']]);
 assert.deepEqual([two.count,two.width],[2,98]);
 const chars=[...'시작하기'].map(c=>({text:c,width:24}));
 assert.equal(wrap(chars,50,{spaceWidth:0}).count,2,'text without spaces breaks per character');
});
test('a fixed button reports fits, wraps, clipped or overflow per string',()=>{
 assert.equal(textFit({width:120,lineHeight:20,boxWidth:200,boxHeight:40}).status,'fits');
 const over=textFit({width:260,lineHeight:20,boxWidth:200,boxHeight:40});
 assert.deepEqual([over.status,over.overBy,over.fits],['overflow',60,false]);
 assert.equal(textFit({width:260,lineHeight:20,boxWidth:200,boxHeight:40,mode:'truncate'}).status,'truncated');
 const wrapped=textFit({lineHeight:20,boxWidth:100,boxHeight:60,mode:'wrap',spaceWidth:8,
  chunks:[{text:'Continue',width:90},{text:'playing',width:80}]});
 assert.deepEqual([wrapped.status,wrapped.lines,wrapped.fits],['wrapped',2,true]);
 const clipped=textFit({lineHeight:20,boxWidth:100,boxHeight:20,mode:'wrap',spaceWidth:8,
  chunks:[{text:'Continue',width:90},{text:'playing',width:80}]});
 assert.deepEqual([clipped.status,clipped.lines,clipped.fits],['clipped',2,false]);
});
test('detected element boxes merge transitively within a distance',()=>{
 const rects=[{x:0,y:0,w:10,h:10},{x:12,y:0,w:10,h:10},{x:24,y:0,w:10,h:10},{x:60,y:60,w:5,h:5}];
 assert.equal(mergeRects(rects,0).length,4);
 const merged=mergeRects(rects,2);
 assert.equal(merged.length,2);
 assert.deepEqual(merged[0],{x:0,y:0,w:34,h:10,parts:3});
 assert.deepEqual(mergeRects([{x:0,y:0,w:4,h:4},{x:1,y:1,w:2,h:2}],0)[0],{x:0,y:0,w:4,h:4,parts:2});
});
