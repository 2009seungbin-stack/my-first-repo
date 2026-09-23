// Tile workspace: ko/en/ja strings parity, document state helpers and the map resolver (pure parts
// of src/studio/workspaces/tile/).
import test from 'node:test';
import assert from 'node:assert/strict';
import {TILE_STRINGS} from '../src/studio/workspaces/tile/strings.js';
import {st} from '../src/studio/strings.js';
import * as St from '../src/studio/workspaces/tile/state.js';
import {resolveLayer} from '../src/studio/workspaces/tile/resolve.js';
import {createTileset,applyLayout} from '../src/game/tiles/model.js';
import {VERIFY} from '../src/studio/workspaces/tile/verify-status.js';
const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?flat(v,p+k+'.'):[[p+k,String(v)]]);
const slots=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join();
test('ko, en and ja have the same keys and the same {placeholders}', () => {
 const en=new Map(flat(TILE_STRINGS.en));
 for(const l of ['ko','ja']){
  const other=new Map(flat(TILE_STRINGS[l]));
  assert.deepEqual([...other.keys()].sort(),[...en.keys()].sort(),l);
  for(const [k,v] of en)assert.equal(slots(other.get(k)),slots(v),`${l} ${k}`);
 }
 // merged into the Studio strings, with the palette group
 assert.equal(st('ko','tile.panel.set'),'타일셋');assert.equal(st('ja','group.tile'),'タイル');
 assert.doesNotMatch(JSON.stringify(TILE_STRINGS),/\bAI\b|인공지능|人工知能/,'no "AI" wording for heuristics');
});
test('map state: paint, flood, resize and layers are pure and exact', () => {
 let s=St.EMPTY_STATE;const m=St.createMap({w:6,h:4});s=St.putMap(s,m);
 const L=m.layers[0];
 const painted=St.paintCells(m,L,St.brushCells(2,1,3),0);
 assert.equal(painted.cells.replace(/\./g,'').length,9);
 assert.equal(St.paintCells(m,painted,[[2,1]],0),painted,'no change → same object');
 const flood=St.floodCells(m,painted,0,3);assert.equal(flood.length,24-9);
 const big=St.resizeMap({...m,layers:[painted]},8,5);assert.equal(big.layers[0].cells.length,40);
 assert.equal(St.layerGet(big,big.layers[0])(2,1),0);assert.equal(St.layerGet(big,big.layers[0])(7,4),-1);
 const two=St.addLayer(m);assert.equal(two.layers.length,2);assert.equal(St.removeLayer(St.removeLayer(two,two.layers[1].id),m.layers[0].id).layers.length,1);
 assert.equal(St.randomCells(m,5).length,24);assert.equal(St.randomCells(m,5),St.randomCells(m,5));
});
test('map resolver: a complete blob set leaves nothing to flag; a missing isolated tile is flagged per rule', () => {
 let ts=createTileset({assetId:'a',grid:{w:16,h:16,cols:8,rows:6}});ts=applyLayout(ts,{layoutId:'blob47-gamemaker'});
 const m=St.createMap({w:5,h:5}),L={...m.layers[0],cells:'.....'+'.#...'.replace('#','a')+'.....'+'..aa.'+'..aa.'};
 const g=resolveLayer(m,L,ts,'godot');assert.equal(g.painted,5);assert.equal(g.problems.length,0);
 const t=resolveLayer(m,L,ts,'tiled');assert.equal(t.problems.filter(p=>p.kind==='gap').length,1,'Tiled drops the all-zero Wang ID of the isolated tile');
 const noIso={...ts,tiles:Object.fromEntries(Object.entries(ts.tiles).filter(([k])=>k!=='6,5'))};
 const g2=resolveLayer(m,L,noIso,'godot');assert.deepEqual(g2.problems.map(p=>[p.x,p.y,p.kind]),[[1,1,'missing']]);
});
test('verification labels only claim what was run', () => {
 for(const [k,v] of Object.entries(VERIFY)){assert.match(v.status,/^(verified|unverified)$/);assert.ok(v.detail.length>10,k);}
});
