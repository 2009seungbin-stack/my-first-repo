/** Published autotile layouts as data. Pure.
 *
 * "47 tiles" is not one thing: the same 47 blob tiles are published in several incompatible
 * orders, and nothing inside a PNG says which one you have. Each entry below is a table of the
 * neighbour mask every cell stands for, taken from the layout's own reference sheet:
 *
 *   blob47-cr31-ascending  cr31 "ID order": the 47 masks sorted ascending, 8 per row (also the
 *                          Nerulio Tile Lab blob47 template)
 *   blob47-wangblob-7x7    cr31 "wang blob" packed 7×7 (Tiled's wangblob.tsx example); three
 *                          cells are mask 0
 *   blob47-caeles-7x7 / blob47-caeles-8x6   the OpenGameArt "seamless tileset template II" sheets
 *   blob47-gamemaker       GameMaker Studio 2's 47-tile autotile template (cell 0 unused)
 *   blob47-godot3-12x4     Godot 3 docs "3×3 minimal" bitmask template, 12×4 with one blank
 *   edge16-cr31 / edge16-binary          16 side (2-edge Wang) tiles
 *   corner16-cr31 / corner16-binary      16 corner tiles: cr31 2-corner Wang, Godot 3 "2×2",
 *                          and the dual-grid 4×4 (jess::codes / GlitchedinOrbit) share one order
 *   box9                   a 3×3 "box" (outer corners, edges, centre), sides only; it cannot
 *                          draw one-tile-wide strips (7 of 16 side combinations have no tile)
 *
 * The corpus manifest (C:\Users\2009s\nerulio-asset-corpus\manifest.json) verified the cr31,
 * caeles, GameMaker, edge and corner tables against their sheets; the Godot 3 table was sampled
 * from the template image in the godot-docs 3.5 branch (47 distinct masks, 1 blank).
 *
 * Masks: kind 'blob' = cr31 weights N1 NE2 E4 SE8 S16 SW32 W64 NW128; 'edge' = N1 E2 S4 W8;
 * 'corner' = NW1 NE2 SE4 SW8. `null` = a cell the layout leaves empty. */
import {BLOB47,fromBlob,fromEdge,fromCorner} from './patterns.js';
const rows=(flat,cols)=>{const out=[];for(let i=0;i<flat.length;i+=cols)out.push(flat.slice(i,i+cols));return out;};
const pad=(flat,n)=>[...flat,...Array(Math.max(0,n-flat.length)).fill(null)];
const def=(o)=>Object.freeze({...o,cells:Object.freeze(o.cells.map(r=>Object.freeze(r))),rows:o.cells.length,cols:o.cells[0].length});
export const LAYOUTS=Object.freeze([
 def({id:'blob47-cr31-ascending',family:'blob47',mode:'corners-and-sides',kind:'blob',names:['cr31 ascending ID (8×6)','Nerulio Tile Lab blob47'],
  cells:rows(pad(BLOB47,48),8)}),
 def({id:'blob47-wangblob-7x7',family:'blob47',mode:'corners-and-sides',kind:'blob',names:['cr31 wang blob 7×7 (Tiled wangblob)'],
  cells:[[0,4,92,124,116,80,0],[16,20,87,223,241,21,64],[29,117,85,71,221,125,112],[31,253,113,28,127,247,209],[23,199,213,95,255,245,81],[5,84,93,119,215,193,17],[0,1,7,197,69,68,65]]}),
 def({id:'blob47-caeles-7x7',family:'blob47',mode:'corners-and-sides',kind:'blob',names:['caeles seamless template II 7×7'],
  cells:[[0,4,84,92,124,116,80],[16,28,117,95,255,253,113],[21,87,221,127,255,247,209],[29,125,119,199,215,213,81],[31,255,241,20,65,17,1],[23,223,245,85,68,93,112],[5,71,197,69,64,7,193]]}),
 def({id:'blob47-caeles-8x6',family:'blob47',mode:'corners-and-sides',kind:'blob',names:['caeles seamless template II 8×6'],
  cells:[[0,4,92,112,28,124,116,64],[20,84,87,221,127,255,245,80],[29,117,85,95,247,215,209,1],[23,213,81,31,253,125,113,16],[21,69,93,119,223,255,241,17],[5,68,71,193,7,199,197,65]]}),
 def({id:'blob47-gamemaker',family:'blob47',mode:'corners-and-sides',kind:'blob',names:['GameMaker Studio 2 47-tile autotile'],
  cells:[[null,127,253,125,247,119,245,117],[223,95,221,93,215,87,213,85],[31,29,23,21,124,116,92,84],[241,209,113,81,199,71,197,69],[17,68,28,20,112,80,193,65],[7,5,16,4,1,64,0,255]]}),
 def({id:'blob47-godot3-12x4',family:'blob47',mode:'corners-and-sides',kind:'blob',names:['Godot 3 “3×3 minimal” template 12×4'],
  cells:[[16,20,84,80,213,92,116,87,28,125,124,112],[17,21,85,81,29,127,253,113,31,119,null,245],[1,5,69,65,23,223,247,209,95,255,221,241],[0,4,68,64,117,71,197,93,7,199,215,193]]}),
 def({id:'edge16-cr31',family:'edge16',mode:'sides',kind:'edge',names:['cr31 2-edge Wang 4×4'],
  cells:[[4,6,14,12],[5,7,15,13],[1,3,11,9],[0,2,10,8]]}),
 def({id:'edge16-binary',family:'edge16',mode:'sides',kind:'edge',names:['16 sides in index order (N1 E2 S4 W8)'],
  cells:rows(Array.from({length:16},(_,i)=>i),4)}),
 def({id:'corner16-cr31',family:'corner16',mode:'corners',kind:'corner',names:['cr31 2-corner Wang 4×4','Godot 3 “2×2” template','dual-grid 4×4 (jess::codes)'],
  cells:[[8,6,13,12],[5,14,15,11],[2,3,7,9],[0,4,10,1]]}),
 def({id:'corner16-binary',family:'corner16',mode:'corners',kind:'corner',names:['16 corners in index order (NW1 NE2 SE4 SW8)'],
  cells:rows(Array.from({length:16},(_,i)=>i),4)}),
 def({id:'box9',family:'box9',mode:'sides',kind:'edge',names:['3×3 box (9 tiles, sides only)'],
  cells:[[6,14,12],[7,15,13],[3,11,9]]})
]);
export const layoutById=id=>LAYOUTS.find(l=>l.id===id)||null;
/** Pattern of a layout cell for terrain `t` (null for an empty cell). */
export function cellPattern(layout,col,row,t=0){
 const m=layout.cells[row]?.[col];if(m==null)return null;
 return layout.kind==='blob'?fromBlob(m,t):layout.kind==='edge'?fromEdge(m,t):fromCorner(m,t);
}
/** Every non-empty cell of a layout placed at (col0,row0) of a sheet grid, as {col,row,pattern}. */
export function placeLayout(layout,col0=0,row0=0,t=0){
 const out=[];
 for(let r=0;r<layout.rows;r++)for(let c=0;c<layout.cols;c++){const p=cellPattern(layout,c,r,t);if(p)out.push({col:col0+c,row:row0+r,pattern:p,mask:layout.cells[r][c]});}
 return out;
}
/** Sub-tile sources (a sheet that is not the tiles themselves but the pieces they are assembled
 * from). Identification assembles them and checks the result, see identify.js. */
export const SOURCES=Object.freeze([
 Object.freeze({id:'rpgmaker-a2',cols:2,rows:3,names:['RPG Maker MV/MZ A2 autotile block (2×3)','Blobsmith base']}),
 Object.freeze({id:'rpgmaker-a4-wall',cols:2,rows:2,names:['RPG Maker MV/MZ A4 wall block (2×2)']}),
 Object.freeze({id:'five',cols:5,rows:1,names:['5-tile base: isolated, full, inner corners, horizontal, vertical']})
]);
export const sourceById=id=>SOURCES.find(s=>s.id===id)||null;
