/** The Tile workspace's tileset model: one sheet, one grid, one terrain set, patterns per tile.
 * Pure JSON (it lives in the project document under settings.tile), no pixels.
 *
 *   {id, assetId, name, grid:{w,h,ox,oy,sx,sy,cols,rows}, mode, terrains:[{name,color}],
 *    tiles:{"col,row":{pattern:[t,n,ne,e,se,s,sw,w,nw], probability?}}, layoutId, source?}
 *
 * Every edit returns a new object (the Studio's undo keeps the previous one). */
import {MODES,MAX_TERRAINS,inMode,checkPattern,MODE_IDX} from './patterns.js';
import {layoutById,placeLayout} from './layouts.js';
export const TERRAIN_COLORS=Object.freeze(['#e8a33d','#4cc2ff','#7bd88f','#ff6b8b','#b48cff','#f5e06e','#5ee0d0','#ff9f5a']);
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
export function createTileset({id=uid('ts'),assetId,name='Tileset',grid,mode='corners-and-sides',terrains=[{name:'Terrain',color:TERRAIN_COLORS[0]}]}){
 if(!MODES.includes(mode))throw Error('unknown mode');
 return {id,assetId,name:String(name).slice(0,80),grid:normGrid(grid),mode,terrains:terrains.slice(0,MAX_TERRAINS).map((t,i)=>({name:String(t.name||'Terrain '+(i+1)).slice(0,40),color:t.color||TERRAIN_COLORS[i%TERRAIN_COLORS.length]})),tiles:{},layoutId:null};
}
export function normGrid(g){
 const n=(v,min=0)=>{v=Math.round(Number(v));if(!Number.isFinite(v)||v<min)throw Error('bad grid');return v;};
 return {w:n(g.w,1),h:n(g.h,1),ox:n(g.ox||0),oy:n(g.oy||0),sx:n(g.sx||0),sy:n(g.sy||0),cols:n(g.cols||0),rows:n(g.rows||0)};
}
export const cellKey=(c,r)=>c+','+r;
export function setPattern(ts,col,row,pattern){
 const k=cellKey(col,row),cur=ts.tiles[k];
 if(pattern==null){if(!cur)return ts;const tiles={...ts.tiles};delete tiles[k];return {...ts,tiles};}
 checkPattern(pattern);const p=inMode(pattern,ts.mode);
 if(cur&&cur.pattern.every((v,i)=>v===p[i]))return ts;
 return {...ts,tiles:{...ts.tiles,[k]:{...(cur||{}),pattern:p}}};
}
export function setPatterns(ts,list){let out=ts;for(const {col,row,pattern} of list)out=setPattern(out,col,row,pattern);return out;}
/** Toggle one position of a tile for terrain t (the painter's click). Painting a position on a tile
 * that is not a terrain tile yet makes it terrain t. */
export function toggleBit(ts,col,row,pos,t,value=null){
 const cur=ts.tiles[cellKey(col,row)]?.pattern||[t,-1,-1,-1,-1,-1,-1,-1,-1];
 const p=cur.slice();if(p[0]<0)p[0]=t;
 if(pos==='c'){p[0]=value==null?(p[0]===t?-1:t):value;if(p[0]<0)return setPattern(ts,col,row,null);return setPattern(ts,col,row,p);}
 if(!MODE_IDX[ts.mode].includes(pos))return ts;
 p[pos+1]=value==null?(p[pos+1]===t?-1:t):value;
 return setPattern(ts,col,row,p);
}
export function setMode(ts,mode){if(!MODES.includes(mode)||mode===ts.mode)return ts;const tiles={};for(const [k,v] of Object.entries(ts.tiles))tiles[k]={...v,pattern:inMode(v.pattern,mode)};return {...ts,mode,tiles};}
export function addTerrain(ts,name){if(ts.terrains.length>=MAX_TERRAINS)return ts;const i=ts.terrains.length;return {...ts,terrains:[...ts.terrains,{name:name||'Terrain '+(i+1),color:TERRAIN_COLORS[i%TERRAIN_COLORS.length]}]};}
export function updateTerrain(ts,i,patch){return {...ts,terrains:ts.terrains.map((t,k)=>k===i?{...t,...patch}:t)};}
/** Removing a terrain clears its tiles' use of it and renumbers the ones after it. */
export function removeTerrain(ts,i){
 if(ts.terrains.length<=1)return ts;
 const map=v=>v===i?-1:v>i?v-1:v,tiles={};
 for(const [k,v] of Object.entries(ts.tiles)){const p=v.pattern.map(map);if(p[0]>=0)tiles[k]={...v,pattern:p};}
 return {...ts,terrains:ts.terrains.filter((_,k)=>k!==i),tiles};
}
export function clearTiles(ts){return Object.keys(ts.tiles).length?{...ts,tiles:{}}:ts;}
/** Apply a recognised layout placement: every layout cell gets its pattern for terrain `a`
 * (positions with no terrain become `b` when b ≥ 0: an "A over B" transition block). */
export function applyLayout(ts,{layoutId,col=0,row=0},{a=0,b=-1}={}){
 const L=layoutById(layoutId);if(!L)throw Error('unknown layout '+layoutId);
 let out=L.mode!==ts.mode?setMode(ts,L.mode):ts;
 const list=placeLayout(L,col,row,a).map(c=>({col:c.col,row:c.row,pattern:withB(c.pattern,L.mode,a,b)}));
 out=setPatterns(out,list);
 return {...out,layoutId};
}
/** Positions without terrain → terrain b; for corner sets the centre follows the majority corner. */
export function withB(p,mode,a,b){
 if(b<0)return p;
 const q=p.map((v,i)=>i===0?v:(MODE_IDX[mode].includes(i-1)&&v<0?b:v));
 if(mode==='corners'){const na=[2,4,6,8].filter(i=>q[i]===a).length;q[0]=na>=2?a:b;}
 return q;
}
export function patternsList(ts){return Object.entries(ts.tiles).map(([k,v])=>{const [col,row]=k.split(',').map(Number);return {id:k,col,row,pattern:v.pattern,probability:v.probability};});}
/** A GodotTerrainSet-ready list. */
export const terrainTiles=ts=>patternsList(ts).map(e=>({id:e.id,pattern:e.pattern,probability:e.probability}));
/** Validate a model loaded from a project (throws with a reason). */
export function normalizeTileset(raw){
 const ts=createTileset({id:String(raw.id||uid('ts')).slice(0,60),assetId:String(raw.assetId||''),name:raw.name,grid:raw.grid,mode:raw.mode,terrains:Array.isArray(raw.terrains)&&raw.terrains.length?raw.terrains:undefined});
 const tiles={};
 for(const [k,v] of Object.entries(raw.tiles||{})){if(!/^\d+,\d+$/.test(k))continue;try{checkPattern(v.pattern);tiles[k]={pattern:inMode(v.pattern,ts.mode),...(v.probability!=null?{probability:Math.max(0,Math.min(1000,Number(v.probability)||0))}:{}),...(Array.isArray(v.collision)?{collision:cleanShapes(v.collision,ts.grid)}:{})};}catch{}}
 return {...ts,tiles,layoutId:typeof raw.layoutId==='string'?raw.layoutId:null,...(raw.source?{source:raw.source}:{}),...(raw.collision?{collision:raw.collision}:{})};
}
/** Collision polygons of a tile: [[[x,y],…],…] in tile pixels, integers clamped to the tile, at
 * least 3 points each, at most 64 polygons of 256 points. */
export function cleanShapes(shapes,grid){
 const out=[];
 for(const poly of (shapes||[]).slice(0,64)){
  if(!Array.isArray(poly))continue;
  const pts=poly.slice(0,256).map(p=>[Math.max(0,Math.min(grid.w,Math.round(Number(p?.[0])||0))),Math.max(0,Math.min(grid.h,Math.round(Number(p?.[1])||0)))]);
  if(pts.length>=3)out.push(pts);
 }
 return out;
}
export function setCollision(ts,col,row,shapes){
 const k=cellKey(col,row),cur=ts.tiles[k];if(!cur)return ts;
 const next={...cur};const clean=shapes?cleanShapes(shapes,ts.grid):[];
 if(clean.length)next.collision=clean;else delete next.collision;
 return {...ts,tiles:{...ts.tiles,[k]:next}};
}