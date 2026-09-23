/** Tile workspace document state (pure). Everything lives in doc.settings.tile so the shared
 * project format (src/studio/core/project.js) needs no change: settings are kept as JSON by
 * normalizeProject, autosaved and written into .nerulio files.
 *
 *   settings.tile = {
 *     tilesets: {id: tileset}                       src/game/tiles/model.js shape, one per sheet asset
 *     maps:     {id: {id, name, w, h, rule:'godot'|'tiled', layers:[{id, name, tilesetId, visible, cells}]}}
 *     activeMap: id|null
 *     links:    {generatedAssetId: {sourceAssetId, kind, origin:{col,row}, dual, layout, rim, background, sourceBlob}}
 *   }
 * A layer's `cells` is a string, one character per cell: '.' empty, 'a'…'p' terrain 0…15. */
import {normalizeTileset} from '../../../game/tiles/model.js';
export const EMPTY_STATE=Object.freeze({tilesets:{},maps:{},activeMap:null,links:{}});
export const tileState=doc=>doc?.settings?.tile||EMPTY_STATE;
export function withTileState(doc,fn){
 const cur=tileState(doc),next=fn(cur);
 return next===cur?doc:{...doc,settings:{...(doc.settings||{}),tile:next}};
}
const seen=new WeakMap();
/** Tilesets loaded from a file are validated once (a bad one is dropped, not trusted). */
export function tilesetsOf(state){
 const out=[];
 for(const ts of Object.values(state.tilesets||{})){
  if(!seen.has(ts)){let ok=null;try{ok=normalizeTileset(ts);}catch{}seen.set(ts,ok);}
  const v=seen.get(ts);if(v)out.push(ts);
 }
 return out;
}
export const tilesetForAsset=(state,assetId)=>tilesetsOf(state).find(t=>t.assetId===assetId)||null;
export const putTileset=(state,ts)=>({...state,tilesets:{...state.tilesets,[ts.id]:ts}});
export function removeTileset(state,id){
 if(!state.tilesets?.[id])return state;
 const tilesets={...state.tilesets};delete tilesets[id];
 // layers painting with it lose their tileset (their terrain cells stay)
 const maps={};for(const [k,m] of Object.entries(state.maps||{}))maps[k]={...m,layers:m.layers.map(l=>l.tilesetId===id?{...l,tilesetId:null}:l)};
 return {...state,tilesets,maps};
}
export function updateTileset(state,id,fn){const ts=state.tilesets?.[id];if(!ts)return state;const next=fn(ts);return next===ts?state:putTileset(state,next);}
// ------------------------------------------------------------------ maps
export const MAX_MAP=128;
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
export const cellChar=t=>t<0?'.':String.fromCharCode(97+t);
export const charCell=ch=>ch==='.'||!ch?-1:ch.charCodeAt(0)-97;
export function createMap({name='Map',w=24,h=16,tilesetId=null,rule='godot'}={}){
 w=Math.max(2,Math.min(MAX_MAP,w|0));h=Math.max(2,Math.min(MAX_MAP,h|0));
 return {id:uid('m'),name,w,h,rule,layers:[{id:uid('l'),name:'Terrain',tilesetId,visible:true,cells:'.'.repeat(w*h)}]};
}
export function putMap(state,map,{activate=true}={}){return {...state,maps:{...state.maps,[map.id]:map},activeMap:activate?map.id:state.activeMap};}
export function updateMap(state,id,fn){const m=state.maps?.[id];if(!m)return state;const next=fn(m);return next===m?state:{...state,maps:{...state.maps,[id]:next}};}
export function removeMap(state,id){if(!state.maps?.[id])return state;const maps={...state.maps};delete maps[id];return {...state,maps,activeMap:state.activeMap===id?Object.keys(maps)[0]||null:state.activeMap};}
export function updateLayer(map,layerId,fn){let hit=false;const layers=map.layers.map(l=>{if(l.id!==layerId)return l;const n=fn(l);if(n!==l)hit=true;return n;});return hit?{...map,layers}:map;}
export function addLayer(map,{name,tilesetId=null}={}){return {...map,layers:[...map.layers,{id:uid('l'),name:name||'Layer '+(map.layers.length+1),tilesetId,visible:true,cells:'.'.repeat(map.w*map.h)}]};}
export function removeLayer(map,layerId){return map.layers.length<=1?map:{...map,layers:map.layers.filter(l=>l.id!==layerId)};}
export function moveLayer(map,layerId,d){const i=map.layers.findIndex(l=>l.id===layerId),j=i+d;if(i<0||j<0||j>=map.layers.length)return map;const layers=[...map.layers];[layers[i],layers[j]]=[layers[j],layers[i]];return {...map,layers};}
/** Resize keeping the top-left content. */
export function resizeMap(map,w,h){
 w=Math.max(2,Math.min(MAX_MAP,w|0));h=Math.max(2,Math.min(MAX_MAP,h|0));if(w===map.w&&h===map.h)return map;
 return {...map,w,h,layers:map.layers.map(l=>{let s='';for(let y=0;y<h;y++)for(let x=0;x<w;x++)s+=x<map.w&&y<map.h?l.cells[y*map.w+x]:'.';return {...l,cells:s};})};
}
export const layerGet=(map,layer)=>(x,y)=>x<0||y<0||x>=map.w||y>=map.h?-1:charCell(layer.cells[y*map.w+x]);
/** Set cells (list of [x,y]) to terrain t (-1 erases). */
export function paintCells(map,layer,cells,t){
 const a=layer.cells.split('');let changed=false;const ch=cellChar(t);
 for(const [x,y] of cells){if(x<0||y<0||x>=map.w||y>=map.h)continue;const i=y*map.w+x;if(a[i]!==ch){a[i]=ch;changed=true;}}
 return changed?{...layer,cells:a.join('')}:layer;
}
/** 4-connected flood fill of the region containing (x,y). */
export function floodCells(map,layer,x,y){
 const get=layerGet(map,layer),target=get(x,y),out=[],seenCells=new Set([y*map.w+x]),queue=[[x,y]];
 while(queue.length){const [cx,cy]=queue.pop();out.push([cx,cy]);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=map.w||ny>=map.h)continue;const k=ny*map.w+nx;if(seenCells.has(k)||get(nx,ny)!==target)continue;seenCells.add(k);queue.push([nx,ny]);}}
 return out;
}
/** Square brush footprint centred on (x,y). */
export function brushCells(x,y,size){const r=Math.floor((size-1)/2),out=[];for(let dy=-r;dy<size-r;dy++)for(let dx=-r;dx<size-r;dx++)out.push([x+dx,y+dy]);return out;}
/** Seeded blobby fill for quick tests (same generator as the engine harness). */
export function randomCells(map,seed,terrains=1,density=.55){
 let s=(seed|0)||1;const r=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
 let cur=new Int8Array(map.w*map.h).fill(-1);for(let i=0;i<cur.length;i++)if(r()<density)cur[i]=terrains>1?Math.floor(r()*terrains):0;
 const next=new Int8Array(cur);
 for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++){const count=new Map();let empty=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;const v=nx<0||ny<0||nx>=map.w||ny>=map.h?-1:cur[ny*map.w+nx];if(v<0)empty++;else count.set(v,(count.get(v)||0)+1);}let best=-1,bn=empty;for(const [v,n] of count)if(n>bn){best=v;bn=n;}next[y*map.w+x]=bn>=4?best:cur[y*map.w+x];}
 return [...next].map(cellChar).join('');
}
/** A readable starter shape for a new test map: an island with a lake, a two-wide peninsula and a
 * small islet — outer and inner corners, straight edges and a strip show at once. '#' = terrain. */
export function islandCells(w,h){
 const cx=w*.4,cy=h/2-.5,rx=Math.max(2.5,w*.28),ry=Math.max(2.5,h*.36),out=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const e=((x-cx)/rx)**2+((y-cy)/ry)**2,lake=((x-cx+.5)/(rx*.34))**2+((y-cy)/(ry*.3))**2;
  const pen=y>=Math.floor(cy)&&y<=Math.floor(cy)+1&&x>=cx+rx-1&&x<Math.min(w-1,cx+rx+Math.max(3,w*.18));
  const islet=x>=w-4&&x<w-2&&y>=1&&y<3;
  out.push((e<=1&&lake>1)||pen||islet?'#':'.');
 }
 return out.join('');
}