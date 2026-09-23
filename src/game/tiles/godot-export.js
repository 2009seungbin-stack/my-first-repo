/** Godot 4 TileSet export from the canonical tileset model. Pure.
 *
 * It writes the same JSON the Tile Lab importer (src/game/godot-tileset.js, godotScript()) reads —
 * that GDScript builds the real TileSet through the engine API and was verified in Godot 4.7.2 —
 * but from per-tile patterns instead of one fixed slot order, so any layout, any painted bits and
 * several terrains per set come through. No .tres is ever written here.
 *
 * tileset model (see docs/STUDIO-TILE.md):
 *   {grid:{w,h,ox,oy,sx,sy,cols,rows}, mode, terrains:[{name,color}],
 *    tiles:{"col,row":{pattern:[t,n,…,nw], probability?, collision?:[[[x,y]…]…]}}}  */
import {GODOT_NAMES,GODOT_MODE,MODE_IDX,inMode} from './patterns.js';
import {godotScript} from '../godot-tileset.js';
const cleanName=s=>String(s||'Terrain').replace(/[^\w .-]+/g,'').trim().slice(0,40)||'Terrain';
export function godotJSON(ts,{image='tileset.png',width=0,height=0,toolVersion='1'}={}){
 const mode=GODOT_MODE[ts.mode];
 const tiles=[];
 for(const [k,tile] of Object.entries(ts.tiles||{})){
  if(!tile?.pattern||tile.pattern[0]<0)continue;
  const [col,row]=k.split(',').map(Number),p=inMode(tile.pattern,ts.mode),peering={};
  for(const i of MODE_IDX[ts.mode])if(p[i+1]>=0)peering[GODOT_NAMES[i]]=p[i+1];
  tiles.push({atlas:{x:col,y:row},terrainSet:0,terrain:p[0],peering,
   ...(tile.probability!=null&&tile.probability!==1?{probability:tile.probability}:{}),
   ...(tile.collision?.length?{collision:tile.collision}:{})});
 }
 tiles.sort((a,b)=>a.atlas.y-b.atlas.y||a.atlas.x-b.atlas.x);
 const g=ts.grid;
 return {meta:{tool:'nerulio-studio-tile',toolVersion,schemaVersion:1,engineTarget:'godot-4',image,size:{w:width,h:height}},
  tileSet:{tileSize:{w:g.w,h:g.h},margins:{x:g.ox||0,y:g.oy||0},separation:{x:g.sx||0,y:g.sy||0},columns:g.cols,rows:g.rows,
   layout:ts.layoutId||null,
   ...(tiles.some(t=>t.collision)?{physicsLayers:[{collisionLayer:1,collisionMask:1,mode:ts.collisionMode||'alpha'}]}:{}),
   terrainSets:[{mode,terrains:(ts.terrains||[]).map(t=>({name:cleanName(t.name),color:t.color||'#4caf50'}))}],tiles}};
}
/** The importer: Tile Lab's verified Builder, plus tile probabilities. */
export function godotImporter(){
 // The shared importer ignores "probability"; add it without touching the verified code path.
 return godotScript().replace('\t\t\ttile_data.terrain = int(tile.get("terrain", 0))\n',
  '\t\t\ttile_data.terrain = int(tile.get("terrain", 0))\n\t\t\tif tile.has("probability"):\n\t\t\t\ttile_data.probability = float(tile["probability"])\n')
  .replace('# Nerulio Tile Lab -> Godot 4 TileSet importer.','# Nerulio Studio (Tile) -> Godot 4 TileSet importer.');
}
export function godotReadme(json){
 const ts=json.tileSet,mode=ts.terrainSets[0].mode;
 return ['Nerulio Studio — Godot 4 TileSet pack','',
  `1. Copy the PNG, nerulio-tileset.json and nerulio_tileset_import.gd into your Godot 4 project (same folder).`,
  `2. Let the editor import the PNG, then open nerulio_tileset_import.gd and run File > Run (Ctrl+Shift+X).`,
  `3. It saves nerulio-tileset.tres: one terrain set (${mode}) with ${ts.terrainSets[0].terrains.length} terrain(s) and ${ts.tiles.length} tiles${ts.physicsLayers?' with collision polygons':''}.`,
  `4. Assign it to a TileMapLayer and paint with the Terrains tab, or call set_cells_terrain_connect() from code.`,'',
  '- Every peering bit is named after a TileSet.CellNeighbor constant; an absent bit means "no terrain" (-1).',
  '- Headless: Godot cannot run an EditorScript with --script; use the Builder class (see the comment at the top of the .gd).',
  '- Verified by the Nerulio engine-verify harness in Godot 4.7.2: the TileSet built by this importer was painted with set_cells_terrain_connect and every cell compared with the Studio painter (docs/STUDIO-TILE.md).',''].join('\n');
}
