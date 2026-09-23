/** What an engine draws for a painted map layer, and where it goes wrong. Pure.
 *   rule 'godot': one set_cells_terrain_connect per terrain, row-major (src/game/tiles/godot-terrain.js,
 *                 checked cell for cell against Godot 4.7.2)
 *   rule 'tiled': Tiled's exact Wang match (src/game/tiles/tiled.js); corner sets sit on grid points
 * Problems: 'missing' = a painted cell the engine leaves empty (no tile has the pattern and the
 * matcher fell back to nothing), 'wrong' = the engine drew a tile whose bits do not fit the
 * neighbourhood (it substituted the closest tile), 'gap' = Tiled has no exact tile. */
import {GodotTerrainSet,resolveGodot} from '../../../game/tiles/godot-terrain.js';
import {resolveTiled} from '../../../game/tiles/tiled.js';
import {idealAt,fits,describe} from '../../../game/tiles/patterns.js';
import {terrainTiles} from '../../../game/tiles/model.js';
import {layerGet} from './state.js';
const sets=new WeakMap();
const setFor=ts=>{let s=sets.get(ts);if(!s){s=new GodotTerrainSet({mode:ts.mode,tiles:terrainTiles(ts)});sets.set(ts,s);}return s;};
const cache=new Map();
export function resolveLayer(map,layer,ts,rule){
 if(!ts)return {cells:new Map(),problems:[],offset:false,painted:0};
 const key=layer.cells+'|'+map.w+'|'+rule+'|'+ts.id;
 const hit=cache.get(key);if(hit&&hit.ts===ts)return hit.result;
 const get=layerGet(map,layer),grid={w:map.w,h:map.h,get};
 const cells=new Map(),problems=[];let painted=0;
 for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)if(get(x,y)>=0)painted++;
 let offset=false;
 if(rule==='tiled'){
  const r=resolveTiled(ts,grid);offset=r.offset;
  for(const c of r.cells){if(c.id)cells.set(c.x+','+c.y,{id:c.id,pattern:ts.tiles[c.id]?.pattern,alternatives:c.alternatives});else problems.push({x:c.x,y:c.y,kind:'gap'});}
 }else{
  const r=resolveGodot(setFor(ts),grid);
  for(const [k,v] of r.cells)cells.set(k,v);
  for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++){
   if(get(x,y)<0)continue;const c=cells.get(x+','+y),want=idealAt(get,x,y,ts.mode);
   if(!c)problems.push({x,y,kind:'missing',want:want.map(v=>v[0])});
   else if(!fits(c.pattern,want))problems.push({x,y,kind:'wrong',got:c.pattern,want:want.map(v=>v[0]),tile:c.id});
  }
 }
 const result={cells,problems,offset,painted};
 if(cache.size>64)cache.clear();
 cache.set(key,{ts,result});
 return result;
}
export const describePattern=describe;
