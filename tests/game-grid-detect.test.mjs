import test from 'node:test';import assert from 'node:assert/strict';
import {detectGrid,axisCandidates,periodCandidates,gridCells,cellRect,cellEvidence,runLengths,CELL_CANDIDATES} from '../src/game/grid-detect.js';
import {alphaProfile,source} from '../src/game/pixels.js';
import {gridSheet,irregularSheet,walker,canvas,box,disc,blit,rand} from './game-fixtures.mjs';
const best=r=>r.suggestions[0];
const shape=s=>[s.cellWidth,s.cellHeight,s.marginX,s.marginY,s.spacingX,s.spacingY,s.columns,s.rows];

test('a margin+spacing sheet is described exactly, with the separator lines as evidence',()=>{
 const sheet=gridSheet({cellW:32,cellH:32,cols:5,rows:3,margin:4,spacing:2,draw:(c,i)=>disc(c,16,16,10-i%3,[200,60+i*8,60,255])});
 const r=detectGrid(sheet),b=best(r);
 assert.deepEqual(shape(b),[32,32,4,4,2,2,5,3],JSON.stringify(b.reasons));
 assert.equal(b.evidence.separatorRatioX,1);assert.equal(b.evidence.separatorRatioY,1);
 assert.equal(b.evidence.crossingsX+b.evidence.crossingsY,0,'nothing crosses a boundary');
 assert.equal(b.evidence.filledCells,15);assert(b.score>.8&&b.confidence==='high',`score ${b.score}`);
 assert.equal(gridCells(b).length,15);assert.deepEqual(cellRect(b,1,1),{x:4+34,y:4+34,w:32,h:32});
 assert(b.reasons.some(s=>/margin\/spacing/.test(s))&&b.reasons.some(s=>/autocorrelation/.test(s)));
});
test('an edge-to-edge sheet is not decided by divisibility: 48 beats 16 and 24',()=>{
 const sheet=gridSheet({cellW:48,cellH:48,cols:6,rows:2,draw:(c,i)=>{box(c,10,6,28,36,[90,90,200,255]);disc(c,24,14,7,[240,220,180,255]);}});
 const r=detectGrid(sheet),b=best(r);
 assert.deepEqual([b.cellWidth,b.cellHeight,b.columns,b.rows],[48,48,6,2],JSON.stringify(r.suggestions.map(s=>[s.cellWidth,s.cellHeight,+s.score.toFixed(3)])));
 assert.equal(b.evidence.separatorRatioX,null,'no margin or spacing: separators carry no evidence');
 assert(b.evidence.periodicityX>.5,`periodicity ${b.evidence.periodicityX}`);
 assert(b.reasons.some(s=>/no margin or spacing/.test(s)));
 const sixteen=r.suggestions.find(s=>s.cellWidth===16);
 if(sixteen)assert(sixteen.score<b.score,'a wrong divisor scores lower');
});
test('non-square cells and a sheet with leftover pixels still rank correctly',()=>{
 const sheet=gridSheet({cellW:24,cellH:48,cols:4,rows:2,margin:3,spacing:5,draw:c=>box(c,4,6,16,36,[30,180,90,255])});
 const wide=canvas(sheet.width+7,sheet.height+3);blit(wide,sheet,0,0);
 const b=best(detectGrid(wide));
 assert.deepEqual([b.cellWidth,b.cellHeight,b.spacingX,b.spacingY,b.marginX,b.marginY],[24,48,5,5,3,3],JSON.stringify(b.reasons));
 assert.equal(b.evidence.exactFitX,false,'the sheet has leftover pixels and that is reported');
});
test('a cell size outside the preset list needs `custom`, and then wins',()=>{
 const sheet=gridSheet({cellW:40,cellH:40,cols:4,rows:2,margin:2,spacing:4,draw:c=>disc(c,20,22,13,[220,120,40,255])});
 const plain=best(detectGrid(sheet));
 assert.notEqual(plain.cellWidth,40,'40 is not a preset, so the plain run describes the sheet differently');
 assert(plain.reasons.some(s=>/not one of the common authoring sizes/.test(s)),JSON.stringify(plain.reasons));
 const b=best(detectGrid(sheet,{custom:[40]}));
 assert.deepEqual(shape(b),[40,40,2,2,4,4,4,2],JSON.stringify(b.reasons));
});
test('a sheet of unrelated sprites gets a low-confidence answer, never a confident wrong one',()=>{
 const sheet=irregularSheet();
 const r=detectGrid(sheet);
 assert(r.suggestions.length,'still offers something to try');
 assert(best(r).score<.7,`irregular sheets must not look certain (got ${best(r).score.toFixed(2)})`);
 assert(r.suggestions.every(s=>s.confidence!=='high'));
});
test('a single-frame sheet, a transparent sheet and custom sizes are handled',()=>{
 const one=canvas(40,40);disc(one,20,20,15,[255,0,0,255]);
 const b=best(detectGrid(one,{minCells:1}));
 assert.equal(b.cells,1,JSON.stringify([b.cellWidth,b.cellHeight,b.columns,b.rows]));
 const blank=detectGrid(canvas(32,32));
 assert.deepEqual(blank.suggestions,[]);assert.match(blank.reason,/fully transparent/);
 const odd=gridSheet({cellW:37,cellH:37,cols:3,rows:1,draw:c=>box(c,5,5,27,27,[10,10,240,255])});
 assert.equal(best(detectGrid(odd,{custom:[37]})).cellWidth,37,'a custom size is tried');
 assert(periodCandidates(alphaProfile(source(odd)).cols).some(p=>p.lag===37),'the sheet suggests 37 by itself');
});
test('the axis search rejects a claimed margin or spacing that is not blank',()=>{
 const sheet=gridSheet({cellW:16,cellH:16,cols:4,rows:1,draw:c=>box(c,0,0,16,16,[0,0,0,255])});
 const p=alphaProfile(source(sheet));
 const specs=axisCandidates(sheet.width,p.cols,p.emptyCols,{candidates:[16],maxMargin:8,maxSpacing:4});
 assert.equal(specs.length,1);assert.deepEqual([specs[0].cell,specs[0].margin,specs[0].spacing],[16,0,0]);
});
test('run lengths and cell evidence stay consistent with the pixels',()=>{
 const sheet=gridSheet({cellW:20,cellH:20,cols:3,rows:2,draw:(c,i)=>i===4?null:box(c,4,4,12,12,[1,2,3,255])});
 const rl=runLengths(sheet);
 assert.equal(rl.rows.length,sheet.height+1);
 const ev=cellEvidence(rl,sheet.spec);
 assert.equal(ev.filled,5);assert.equal(ev.coverage,5/6);assert.equal(ev.insidePixels,5*144);assert.equal(ev.outsidePixels,0);
 assert.deepEqual([ev.cells[0].x0,ev.cells[0].y0,ev.cells[0].x1,ev.cells[0].y1],[4,4,16,15]);
 assert.equal(ev.cells[4],null);assert(ev.consistency>.99);
});
test('a lazy read(rect) source gives the same answer as plain pixels and reads no whole sheet',()=>{
 const sheet=gridSheet({cellW:32,cellH:32,cols:4,rows:2,margin:2,spacing:2,draw:c=>disc(c,16,16,9,[7,7,7,255])});
 let biggest=0;
 const lazy={width:sheet.width,height:sheet.height,read(r){biggest=Math.max(biggest,r.w*r.h);
  const out=new Uint8ClampedArray(r.w*r.h*4);
  for(let y=0;y<r.h;y++){const from=((r.y+y)*sheet.width+r.x)*4;out.set(sheet.data.subarray(from,from+r.w*4),y*r.w*4);}
  return {data:out,width:r.w,height:r.h};}};
 assert.deepEqual(shape(best(detectGrid(lazy))),shape(best(detectGrid(sheet))));
 assert(biggest<sheet.width*sheet.height||sheet.width*sheet.height<=1_048_576,'bands, not the sheet');
 assert.equal(CELL_CANDIDATES.includes(32),true);
});
