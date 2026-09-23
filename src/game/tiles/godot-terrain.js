/** Godot 4 terrain matching, ported so the Studio can show on screen the tile Godot will put in
 * every cell — including the wrong ones. Pure.
 *
 * This follows TileMapLayer::set_cells_terrain_connect → terrain_fill_connect →
 * terrain_fill_constraints → _get_best_terrain_pattern_for_constraints in Godot 4.x
 * (scene/2d/tile_map_layer.cpp) for square tiles:
 *   * constraints live on shared points: a cell centre, the right side, the bottom-right corner or
 *     the bottom side of a base cell ("TerrainConstraint"), so two cells that share a side or a
 *     corner see the same constraint;
 *   * painted cells get priority-10 constraints on their centre and on every side/corner bit whose
 *     other cells are (or will be) of the painted terrain; the painted cells' other bits get a
 *     priority-1 majority vote of the tiles already on the map (empty ignored when
 *     ignore_empty_terrains);
 *   * the cells are then solved one by one — painted cells in REVERSE order, then their neighbours —
 *     and each chosen pattern overwrites the constraints at its points with priority 5, so earlier
 *     choices steer later ones (this is why results depend on painting order);
 *   * a pattern may not change a bit that has no constraint; among the rest the lowest score wins,
 *     ties going to the smallest pattern in TerrainsPattern::operator< order (terrain, then bits in
 *     CellNeighbor enum order), and the empty pattern (terrain -1) always competes — so a missing
 *     tile silently becomes the closest tile or an empty cell.
 * Tiles with identical patterns are picked at random by probability in Godot; here the first one
 * is drawn and the others are reported as `alternatives`.
 *
 * Patterns are the canonical [t, n, ne, e, se, s, sw, w, nw] of patterns.js. */
import {MODE_IDX,EMPTY,patternKey} from './patterns.js';
// TileSet.CellNeighbor values for square tiles, in enum order, and their cell offsets.
const CN={RIGHT:0,BOTTOM_RIGHT:3,BOTTOM:4,BOTTOM_LEFT:7,LEFT:8,TOP_LEFT:11,TOP:12,TOP_RIGHT:15};
const CN_ORDER=[0,3,4,7,8,11,12,15];
const CN_OFF={0:[1,0],3:[1,1],4:[0,1],7:[-1,1],8:[-1,0],11:[-1,-1],12:[0,-1],15:[1,-1]};
// our position index (n,ne,e,se,s,sw,w,nw) → CellNeighbor, and back
export const POS_TO_CN=Object.freeze([12,15,0,3,4,7,8,11]);
const CN_TO_POS=Object.fromEntries(POS_TO_CN.map((cn,i)=>[cn,i]));
const validBits=mode=>MODE_IDX[mode].map(i=>POS_TO_CN[i]).sort((a,b)=>a-b);
const nb=(x,y,cn)=>[x+CN_OFF[cn][0],y+CN_OFF[cn][1]];
const key=(x,y)=>x+','+y;
/** Normalised constraint point: (base cell, bit) with bit 0 centre, 1 right side, 2 bottom-right
 * corner, 3 bottom side. */
function point(x,y,cn){
 if(cn==null)return [x,y,0];
 switch(cn){
  case CN.RIGHT:return [x,y,1];
  case CN.BOTTOM_RIGHT:return [x,y,2];
  case CN.BOTTOM:return [x,y,3];
  case CN.BOTTOM_LEFT:return [x-1,y,2];
  case CN.LEFT:return [x-1,y,1];
  case CN.TOP_LEFT:return [x-1,y-1,2];
  case CN.TOP:return [x,y-1,3];
  case CN.TOP_RIGHT:return [x,y-1,2];
 }
 throw Error('bad neighbour '+cn);
}
const pkey=([x,y,b])=>x+','+y+','+b;
/** The cells (and which of their bits) that meet at a constraint point, in Godot's order. */
function overlapping([x,y,b]){
 if(b===1)return [[x,y,CN.RIGHT],[x+1,y,CN.LEFT]];
 if(b===2)return [[x,y,CN.BOTTOM_RIGHT],[x+1,y,CN.BOTTOM_LEFT],[x+1,y+1,CN.TOP_LEFT],[x,y+1,CN.TOP_RIGHT]];
 if(b===3)return [[x,y,CN.BOTTOM],[x,y+1,CN.TOP]];
 return [[x,y,null]];
}
/** Godot ordering of patterns (TerrainsPattern::operator<): terrain, then bits in enum order. */
function comparePatterns(a,b,bits){
 if(a.t!==b.t)return a.t-b.t;
 for(const cn of bits){const d=a.bits[cn]-b.bits[cn];if(d)return d;}
 return 0;
}
/** A TileSet terrain set: `tiles` = [{id, pattern, probability?}] (pattern null/-1 = no terrain). */
export class GodotTerrainSet{
 constructor({mode,tiles}){
  if(!MODE_IDX[mode])throw Error('unknown terrain mode '+mode);
  this.mode=mode;this.bits=validBits(mode);
  const byKey=new Map();
  this.tileInfo=new Map();
  for(const tile of tiles){
   if(!tile.pattern||tile.pattern[0]<0)continue;
   const p=this.fromPattern(tile.pattern),k=this.pkey(p);
   if(!byKey.has(k))byKey.set(k,{pattern:p,tiles:[]});
   byKey.get(k).tiles.push(tile.id);
   this.tileInfo.set(tile.id,p);
  }
  // The empty pattern is always a candidate (TileSet::_update_terrains_cache adds it).
  const empty=this.fromPattern(EMPTY);byKey.set(this.pkey(empty),{pattern:empty,tiles:[null]});
  this.patterns=[...byKey.values()].sort((a,b)=>comparePatterns(a.pattern,b.pattern,this.bits));
  this.byKey=byKey;this.empty=empty;
 }
 fromPattern(p){const bits=new Int8Array(16).fill(-1);for(const cn of this.bits)bits[cn]=p[CN_TO_POS[cn]+1];return {t:p[0],bits};}
 toPattern(q){const p=[q.t,-1,-1,-1,-1,-1,-1,-1,-1];for(const cn of this.bits)p[CN_TO_POS[cn]+1]=q.bits[cn];return p;}
 pkey(q){let s=String(q.t);for(const cn of this.bits)s+=','+q.bits[cn];return s;}
 tilesFor(q){return this.byKey.get(this.pkey(q))?.tiles||[];}
}
/** A TileMapLayer with one terrain set. cells: Map "x,y" → tile id. */
export class GodotLayer{
 constructor(set){this.set=set;this.cells=new Map();}
 get(x,y){return this.cells.get(key(x,y))??null;}
 patternAt(x,y){const id=this.get(x,y);if(id==null)return this.set.empty;return this.set.tileInfo.get(id)||this.set.empty;}
 /** set_cells_terrain_connect(cells, 0, terrain, ignore_empty_terrains). Returns the changed cells. */
 setCellsTerrainConnect(coords,terrain,ignoreEmpty=true){
  const S=this.set,bits=S.bits;
  const canModifyList=[],canModify=new Set(),painted=new Set();
  for(let i=coords.length-1;i>=0;i--){const [x,y]=coords[i],k=key(x,y);canModifyList.push([x,y]);canModify.add(k);painted.add(k);}
  for(const [x,y] of coords)for(const cn of CN_ORDER){const [nx,ny]=nb(x,y,cn),k=key(nx,ny);if(!canModify.has(k)){canModifyList.push([nx,ny]);canModify.add(k);}}
  const withCentre=new Set();
  for(const k of canModify){if(painted.has(k)){withCentre.add(k);continue;}const [x,y]=k.split(',').map(Number),p=this.patternAt(x,y);if(this.get(x,y)!=null&&p.t===terrain)withCentre.add(k);}
  const constraints=new Map();// key → {pt, terrain, priority}; insert only when absent (RBSet::insert)
  const insert=(pt,t,priority)=>{const k=pkey(pt);if(!constraints.has(k))constraints.set(k,{pt,terrain:t,priority});};
  for(const [x,y] of coords){
   insert(point(x,y,null),terrain,10);
   for(const cn of bits){
    const pt=point(x,y,cn);
    if(cn%2===0){const [nx,ny]=nb(x,y,cn);if(withCentre.has(key(nx,ny)))insert(pt,terrain,10);}
    else if(overlapping(pt).every(([ox,oy])=>withCentre.has(key(ox,oy))))insert(pt,terrain,10);
   }
  }
  // _get_terrain_constraints_from_painted_cells_list(painted): majority of existing peering bits.
  const dummy=new Map();
  for(const k of painted){const [x,y]=k.split(',').map(Number);for(const cn of bits){const pt=point(x,y,cn);dummy.set(pkey(pt),pt);}}
  for(const pt of dummy.values()){
   const count=new Map();
   for(const [ox,oy,ocn] of overlapping(pt)){
    const id=this.get(ox,oy),p=id!=null?S.tileInfo.get(id):null;
    const t=p?p.bits[ocn]:-1;
    if(!ignoreEmpty||t>=0)count.set(t,(count.get(t)||0)+1);
   }
   let max=0,maxT=-1;for(const [t,n] of count)if(n>max){max=n;maxT=t;}
   if(max>0)insert(pt,maxT,1);
  }
  for(const k of painted){const [x,y]=k.split(',').map(Number),id=this.get(x,y),p=id!=null?S.tileInfo.get(id):null,t=p?p.t:-1;if(!ignoreEmpty||t>=0)insert(point(x,y,null),t,1);}
  // terrain_fill_constraints
  const output=new Map();
  for(const [x,y] of canModifyList){
   const current=this.patternAt(x,y),best=this.best(x,y,constraints,current);
   const add=[[point(x,y,null),best.t],...bits.map(cn=>[point(x,y,cn),best.bits[cn]])];
   for(const [pt,t] of add){const k=pkey(pt);constraints.delete(k);constraints.set(k,{pt,terrain:t,priority:5});}
   output.set(key(x,y),best);
  }
  const changed=[];
  for(const [k,q] of output){
   const [x,y]=k.split(',').map(Number);
   if(!painted.has(k)){const inMap=this.patternAt(x,y);if(S.pkey(inMap)===S.pkey(q))continue;}
   const id=S.tilesFor(q)[0]??null;
   if(id==null)this.cells.delete(k);else this.cells.set(k,id);
   changed.push({x,y,id,pattern:S.toPattern(q),alternatives:S.tilesFor(q).filter(v=>v!=null)});
  }
  return changed;
 }
 best(x,y,constraints,current){
  const S=this.set;let min=Infinity,minP=current;
  const centre=constraints.get(pkey(point(x,y,null)));
  const bitCons=S.bits.map(cn=>[cn,constraints.get(pkey(point(x,y,cn)))]);
  for(const {pattern:q} of S.patterns){
   let score=0;
   if(centre){if(centre.terrain!==q.t)score+=centre.priority;}
   else if(current.t!==q.t)continue;
   let bad=false;
   for(const [cn,c] of bitCons){
    if(c){if(c.terrain!==q.bits[cn])score+=c.priority;}
    else if(current.bits[cn]!==q.bits[cn]){bad=true;break;}
   }
   if(bad)continue;
   if(score<min){min=score;minP=q;}
  }
  return minP;
 }
}
/** What Godot draws for a whole terrain map when a script (or the harness) paints it on an empty
 * layer with one set_cells_terrain_connect call per terrain, terrain 0 first, cells in row-major
 * order. `grid` = {w, h, get(x,y) → terrain or -1}. Returns {cells: Map "x,y"→{id,pattern,alternatives}, calls}. */
export function resolveGodot(set,grid,{ignoreEmpty=true}={}){
 const layer=new GodotLayer(set),terrains=new Set();
 for(let y=0;y<grid.h;y++)for(let x=0;x<grid.w;x++){const t=grid.get(x,y);if(t>=0)terrains.add(t);}
 const calls=[];
 for(const t of [...terrains].sort((a,b)=>a-b)){
  const coords=[];for(let y=0;y<grid.h;y++)for(let x=0;x<grid.w;x++)if(grid.get(x,y)===t)coords.push([x,y]);
  layer.setCellsTerrainConnect(coords,t,ignoreEmpty);calls.push({terrain:t,cells:coords.length});
 }
 const cells=new Map();
 for(const [k,id] of layer.cells){const q=set.tileInfo.get(id);const alternatives=set.tilesFor(q).filter(v=>v!=null);cells.set(k,{id,pattern:set.toPattern(q),alternatives});}
 return {cells,calls,layer};
}
export {patternKey};
