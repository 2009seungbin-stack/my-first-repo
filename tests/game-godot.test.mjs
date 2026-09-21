import test from 'node:test';import assert from 'node:assert/strict';
import {godotTileSet,godotScript,godotReadme,MODES,PEERING,SIDE_PEERING,CORNER_PEERING,modeFor} from '../src/game/godot-tileset.js';
import {LAYOUTS,layoutOf,N,NE,E,SE,S,SW,W,NW} from '../src/game/autotile.js';
import {tileRects} from '../src/game/tile-grid.js';

const gridFor=(kind,tile=16,margin=0,spacing=0)=>{
 const l=layoutOf(kind);
 return tileRects({width:margin*2+l.columns*(tile+spacing)-spacing,height:margin*2+l.rows*(tile+spacing)-spacing,
  tileWidth:tile,tileHeight:tile,marginX:margin,marginY:margin,spacingX:spacing,spacingY:spacing});
};
const BITS={n:N,ne:NE,e:E,se:SE,s:S,sw:SW,w:W,nw:NW};

test('the match mode follows the rule set, not the other way round',()=>{
 assert.equal(modeFor('blob47'),'match_corners_and_sides');
 assert.equal(modeFor('corner16'),'match_corners');
 assert.equal(modeFor('edge16'),'match_sides');
 assert.equal(modeFor('minimal9'),'match_sides');
 assert.deepEqual([...MODES],['match_corners_and_sides','match_corners','match_sides']);
 // Every peering name is a real TileSet.CellNeighbor constant name for a square tile.
 assert.deepEqual(Object.values(PEERING).sort(),[...SIDE_PEERING,...CORNER_PEERING].sort());
 assert.equal(SIDE_PEERING.length,4);assert.equal(CORNER_PEERING.length,4);
});
test('every blob tile carries exactly the peering bits its neighbour mask says',()=>{
 const layout=LAYOUTS.blob47,json=godotTileSet({layout,grid:gridFor('blob47'),image:'t.png',width:128,height:96});
 assert.equal(json.meta.engineTarget,'godot-4');
 assert.equal(json.tileSet.tiles.length,47);
 assert.equal(json.tileSet.terrainSets[0].mode,'match_corners_and_sides');
 assert.deepEqual(json.tileSet.autotile,{kind:'blob47',slots:47,dualGrid:false});
 for(const tile of json.tileSet.tiles){
  const slot=layout.slots[tile.slot.index];
  const want=Object.fromEntries(Object.entries(BITS).filter(([,b])=>slot.mask&b).map(([k])=>[PEERING[k],0]));
  assert.deepEqual(tile.peering,want,`slot ${slot.index} ${slot.name}`);
  assert.deepEqual([tile.terrain,tile.terrainSet],[0,0]);
  assert.deepEqual(tile.atlas,{x:slot.col,y:slot.row});
 }
 // The isolated slot has no peering bit at all, the full slot has all eight.
 assert.deepEqual(json.tileSet.tiles.find(t=>t.slot.mask===0).peering,{});
 assert.equal(Object.keys(json.tileSet.tiles.find(t=>t.slot.mask===255).peering).length,8);
});
test('a side-matching set publishes side bits only, a corner set corner bits only',()=>{
 for(const [kind,wanted] of [['edge16',SIDE_PEERING],['minimal9',SIDE_PEERING],['corner16',CORNER_PEERING]]){
  const json=godotTileSet({layout:layoutOf(kind),grid:gridFor(kind)});
  for(const tile of json.tileSet.tiles)for(const name of Object.keys(tile.peering))assert(wanted.includes(name),`${kind} published ${name}`);
 }
 // An explicit mode overrides the default and prunes the bits that mode cannot express.
 const sides=godotTileSet({layout:LAYOUTS.blob47,grid:gridFor('blob47'),mode:'match_sides'});
 assert.equal(sides.tileSet.terrainSets[0].mode,'match_sides');
 assert(sides.tileSet.tiles.every(t=>Object.keys(t.peering).every(n=>SIDE_PEERING.includes(n))));
 assert.equal(godotTileSet({layout:LAYOUTS.blob47,grid:gridFor('blob47'),mode:'nonsense'}).tileSet.terrainSets[0].mode,'match_corners_and_sides');
});
test('margins, separation and the slot offset reach the reference JSON',()=>{
 const grid=gridFor('edge16',32,2,4);
 const json=godotTileSet({layout:LAYOUTS.edge16,grid,offset:0,terrainName:'Grass / dirt!!',terrainColor:'#8bc34a'});
 assert.deepEqual(json.tileSet.tileSize,{w:32,h:32});
 assert.deepEqual(json.tileSet.margins,{x:2,y:2});
 assert.deepEqual(json.tileSet.separation,{x:4,y:4});
 assert.deepEqual(json.tileSet.terrainSets[0].terrains,[{name:'Grass  dirt',color:'#8bc34a'}]);
 // An offset shifts which sheet tile each slot reads, and slots past the end are dropped
 // instead of silently pointing at tile 0.
 const shifted=godotTileSet({layout:LAYOUTS.edge16,grid,offset:4});
 assert.equal(shifted.tileSet.tiles.length,12);
 assert.deepEqual(shifted.tileSet.tiles[0].atlas,{x:grid.rects[4].col,y:grid.rects[4].row});
 assert.equal(godotTileSet({layout:LAYOUTS.edge16,grid:{...grid,rects:[]}}).tileSet.tiles.length,0);
});
test('the importer is a GDScript EditorScript that uses the public TileSet API',()=>{
 const gd=godotScript();
 for(const needed of ['@tool','extends EditorScript','func _run()','TileSetAtlasSource.new()','tile_set.add_terrain_set()',
  'set_terrain_set_mode','tile_data.terrain_set','tile_data.terrain =','set_terrain_peering_bit','ResourceSaver.save'])
  assert(gd.includes(needed),needed);
 for(const name of Object.values(PEERING))assert(gd.includes(`"${name}"`),name);
 for(const constant of ['CELL_NEIGHBOR_TOP_SIDE','CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER','TERRAIN_MODE_MATCH_CORNERS_AND_SIDES'])
  assert(gd.includes('TileSet.'+constant),constant);
 // No hand-written resource text: the file must not fabricate the .tres format itself.
 assert(!/\[gd_resource|\[sub_resource|ExtResource\(/.test(gd),'the helper must not write resource syntax by hand');
});
test('the readme states the mode, the count, the headless route and where verification is recorded',()=>{
 const json=godotTileSet({layout:LAYOUTS.corner16,grid:gridFor('corner16'),image:'t.png'});
 const readme=godotReadme(json);
 assert.equal(readme.steps.length,4);
 assert(readme.text.includes('corner16')&&readme.text.includes('match_corners'));
 assert(readme.notes.some(n=>/dual grid/i.test(n)),'a dual grid layout must warn about the half-tile offset');
 assert(readme.notes.some(n=>/cannot run Godot/.test(n)&&/docs\/TILE-LAB\.md/.test(n)),'the pack must say where the engine run is recorded');
 assert(readme.notes.some(n=>/extends SceneTree/.test(n)&&/--import/.test(n)),'the headless route needs the wrapper and the import pass');
 assert(!godotReadme(godotTileSet({layout:LAYOUTS.blob47,grid:gridFor('blob47')})).notes.some(n=>/dual grid/i.test(n)));
});
