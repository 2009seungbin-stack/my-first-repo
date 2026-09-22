import test from 'node:test';import assert from 'node:assert/strict';
import {N,NE,E,SE,S,SW,W,NW,KINDS,LAYOUTS,layoutOf,reduceMask,sideIndex,maskFromSideIndex,cornerIndex,slotFor,completeness,unrepresentable,
 layoutJSON,layoutFromJSON,terrainGrid,maskAt,renderMap,usedSlots,seededFill,floodFill,roleOf} from '../src/game/autotile.js';

test('the blob reduction maps all 256 masks onto exactly 47 classes',()=>{
 const set=new Set();
 for(let m=0;m<256;m++){const r=reduceMask(m);assert.equal(reduceMask(r),r,'reduction is idempotent');set.add(r);}
 assert.equal(set.size,47);
 assert.equal(LAYOUTS.blob47.count,47);
 // A corner bit survives only behind both of its edges.
 assert.equal(reduceMask(NE),0);assert.equal(reduceMask(N|E|NE),N|E|NE);assert.equal(reduceMask(N|NE),N);
 assert.equal(reduceMask(255),255);assert.equal(reduceMask(N|E|S|W),N|E|S|W);
 // Every slot's own mask is already reduced and the lookup is total over the 256 raw masks.
 for(const s of LAYOUTS.blob47.slots)assert.equal(reduceMask(s.mask),s.mask);
 for(let m=0;m<256;m++)assert.equal(slotFor('blob47',m).mask,reduceMask(m),'mask '+m);
});
test('edge and corner Wang sets are exactly sixteen and cover every combination',()=>{
 for(const kind of ['edge16','corner16']){
  const l=layoutOf(kind);assert.equal(l.count,16);assert.equal(new Set(l.slots.map(s=>s.key)).size,16);
  for(let i=0;i<16;i++)assert.equal(l.byKey.get(i).index,i);
 }
 assert.equal(LAYOUTS.edge16.match,'sides');assert.equal(LAYOUTS.corner16.match,'corners');assert(LAYOUTS.corner16.dual);
 assert.equal(sideIndex(N|E),3);assert.equal(maskFromSideIndex(3),N|E);assert.equal(sideIndex(maskFromSideIndex(11)),11);
 assert.equal(slotFor('edge16',N|E|NE).key,sideIndex(N|E),'corner bits are ignored by an edge set');
 assert.equal(cornerIndex({tl:true,br:true}),5);assert.equal(slotFor('corner16',{tl:true,br:true}).key,5);
 assert.equal(roleOf(LAYOUTS.corner16.byKey.get(15).mask,'corner16'),'full');
 assert.equal(roleOf(LAYOUTS.corner16.byKey.get(5).mask,'corner16'),'diagonal');
});
test('3x3 minimal has nine slots and admits that seven side masks have no tile',()=>{
 const l=layoutOf('minimal9');assert.equal(l.count,9);assert.equal(l.columns,3);assert.equal(l.rows,3);
 assert.deepEqual(l.slots.map(s=>[s.row,s.col]),[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]);
 assert.equal(unrepresentable('minimal9').length,7);
 assert.equal(slotFor('minimal9',S|E).name,'ES','top-left corner has neighbours below and right');
 assert.equal(slotFor('minimal9',N|E|S|W).role,'inner-corner');
 assert.equal(slotFor('minimal9',0),null,'an isolated tile cannot be drawn by a minimal set');
 assert.equal(slotFor('minimal9',N|S),null,'a one-tile-wide vertical strip cannot be drawn either');
 assert.equal(unrepresentable('blob47').length,0);assert.equal(unrepresentable('edge16').length,0);
});
test('every kind places each slot on its own template cell',()=>{
 for(const kind of KINDS){
  const l=layoutOf(kind),cells=new Set(l.slots.map(s=>s.row+'/'+s.col));
  assert.equal(cells.size,l.count,kind);
  assert(l.slots.every(s=>s.col<l.columns&&s.row<l.rows),kind);
  assert.equal(new Set(l.slots.map(s=>s.name)).size,l.count,kind+' names are distinct');
 }
});
test('the layout table round-trips through JSON and rejects a doctored one',()=>{
 for(const kind of KINDS){
  const json=layoutJSON(kind,{tileWidth:24,tileHeight:24,image:'t.png'}),back=layoutFromJSON(json);
  assert.deepEqual(back,{kind,tileWidth:24,tileHeight:24,columns:LAYOUTS[kind].columns,rows:LAYOUTS[kind].rows});
  assert.equal(json.layout.slots.length,LAYOUTS[kind].count);
  assert.equal(json.meta.size.w,LAYOUTS[kind].columns*24);
  for(const s of json.layout.slots){
   const own=LAYOUTS[kind].slots[s.index];
   assert.deepEqual(s.rect,{x:own.col*24,y:own.row*24,w:24,h:24});
   assert.equal(s.mask,own.mask);assert.equal(s.key,own.key);
   // The published table is enough on its own to find the slot a mask needs.
   assert.equal(slotFor(kind,kind==='corner16'?s.key:s.mask).index,s.index);
  }
 }
 const bad=layoutJSON('blob47');bad.layout.slots[3].mask^=NW;
 assert.throws(()=>layoutFromJSON(bad),/does not match/);
 bad.layout.slots.pop();assert.throws(()=>layoutFromJSON(bad),/47 slots/);
 assert.throws(()=>layoutFromJSON({layout:{kind:'blob9'}}),/autotile layout/);
});
test('a painted terrain pattern picks the tiles the rules require',()=>{
 // A 3x3 solid block inside a 5x5 grid: the nine cells are the nine minimal slots, in order.
 const g=terrainGrid(5,5);
 for(let y=1;y<4;y++)for(let x=1;x<4;x++)g.cells[y*5+x]=1;
 assert.equal(maskAt(g,2,2),255,'the centre sees all eight neighbours');
 assert.equal(maskAt(g,1,1),E|SE|S,'the top-left corner only sees right, below and the corner between');
 const minimal=renderMap('minimal9',g);
 assert.deepEqual([...minimal.slots].slice(5,10),[-1,0,1,2,-1],'row 1 of the sheet: empty, then the three top slots, then empty');
 const inner=[];for(let y=1;y<4;y++)for(let x=1;x<4;x++)inner.push(minimal.slots[y*5+x]);
 assert.deepEqual(inner,[0,1,2,3,4,5,6,7,8]);
 const blob=renderMap('blob47',g),centre=blob.slots[2*5+2];
 assert.equal(LAYOUTS.blob47.slots[centre].mask,255,'the centre of a block is the all-neighbours slot');
 assert.equal(LAYOUTS.blob47.slots[blob.slots[1*5+1]].mask,E|SE|S);
 // An isolated tile: blob has a slot for it, the minimal set has none.
 const one=terrainGrid(3,3);one.cells[4]=1;
 assert.equal(LAYOUTS.blob47.slots[renderMap('blob47',one).slots[4]].mask,0);
 assert.equal(renderMap('minimal9',one).slots[4],-1);
 // Corner Wang renders a dual grid one cell larger, offset by half a tile.
 const dual=renderMap('corner16',one);
 assert.deepEqual([dual.w,dual.h,dual.offsetX],[4,4,-.5]);
 assert.equal(dual.slots[1*4+1],cornerIndex({br:true}),'the vertex above-left of the cell only touches it at its bottom-right');
 assert.equal(dual.slots[2*4+2],cornerIndex({tl:true}));
 assert.equal(dual.slots[0],0,'a vertex with no terrain around it uses the empty slot');
 assert.equal(usedSlots(dual).get(0),16-4);
});
test('outside-as-terrain removes the border seam it would otherwise draw',()=>{
 const g=terrainGrid(3,3,1);
 assert.equal(maskAt(g,0,0),E|SE|S);assert.equal(maskAt(g,0,0,{outside:true}),255);
 assert.equal(maskAt(g,1,1,{wrap:true}),255);
 const filled=renderMap('blob47',g,{outside:true});
 assert(new Set(filled.slots).size===1,'a full grid with outside terrain is one slot everywhere');
});
test('completeness names what is missing and what was claimed twice',()=>{
 const all=LAYOUTS.blob47.slots.map(s=>({key:s.key,tile:s.index}));
 assert.deepEqual(completeness('blob47',all),{kind:'blob47',expected:47,present:47,missing:[],duplicates:[],complete:true});
 const removed=[5,17,40],short=all.filter(a=>!removed.includes(a.tile));
 const gap=completeness('blob47',short);
 assert.deepEqual(gap.missing.map(s=>s.index),removed);assert.equal(gap.complete,false);assert.equal(gap.present,44);
 const twice=completeness('blob47',[...all,{key:all[9].key,tile:99}]);
 assert.equal(twice.missing.length,0);assert.deepEqual(twice.duplicates.map(d=>d.slot.index),[9]);
 assert.equal(twice.duplicates[0].tiles.length,2);assert.equal(twice.complete,false);
 assert.equal(completeness('edge16',[0,1,2,3]).missing.length,12);
 assert.equal(completeness('edge16',[0,99]).present,1,'keys outside the rule set are not counted');
});
test('a seeded fill is reproducible and flood fill only changes one region',()=>{
 const a=seededFill(terrainGrid(24,16),1234),b=seededFill(terrainGrid(24,16),1234);
 assert.deepEqual([...a.cells],[...b.cells]);
 assert.notDeepEqual([...a.cells],[...seededFill(terrainGrid(24,16),1235).cells]);
 const g=terrainGrid(4,1);g.cells[0]=1;g.cells[1]=1;g.cells[3]=1;
 assert.deepEqual([...floodFill(g,0,0,0).cells],[0,0,0,1]);
 assert.equal(floodFill(g,0,0,1),g,'filling with the value already there changes nothing');
 assert.throws(()=>terrainGrid(0,5),/grid size/);
});
