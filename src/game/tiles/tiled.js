/** Tiled export (TSX tileset with a Wang set, TMX sample map) and Tiled's matching rule. Pure.
 *
 * A Tiled Wang set stores, per tile, the colour at its 8 positions in the order top, top-right,
 * right, bottom-right, bottom, bottom-left, left, top-left — the same order as our patterns — with
 * 0 meaning "no colour". Types: 'mixed' (corners and sides: blob sets), 'edge' (sides) and
 * 'corner' (corner / dual-grid sets, whose colours sit on the grid points, so the sample map layer
 * is drawn half a tile up-left).
 *
 * Tiled's terrain brush places a tile whose Wang ID matches the wanted colours exactly and picks
 * among equal tiles by probability; when no tile matches it falls back to the closest one. The
 * painter reproduces the exact-match part and marks every cell where Tiled would have to fall back. */
import {MODE_IDX,idealAt} from './patterns.js';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const WANG_TYPE=Object.freeze({'corners-and-sides':'mixed',sides:'edge',corners:'corner'});
export const TILED_VERSION='1.10',TILED_APP='1.12.2';
/** Tile id inside an image tileset: row-major over the atlas grid. */
export const tileId=(ts,col,row)=>row*ts.grid.cols+col;
export function wangId(ts,pattern){
 const keep=new Set(MODE_IDX[ts.mode]);
 return Array.from({length:8},(_,i)=>keep.has(i)&&pattern[i+1]>=0?pattern[i+1]+1:0);
}
export function tsx(ts,{imageName,width,height,name=ts.name||'tileset'}){
 const g=ts.grid,type=WANG_TYPE[ts.mode];
 const tiles=Object.entries(ts.tiles).filter(([,v])=>v.pattern[0]>=0).map(([k,v])=>{const [c,r]=k.split(',').map(Number);return {id:tileId(ts,c,r),pattern:v.pattern,probability:v.probability};}).sort((a,b)=>a.id-b.id);
 const full=t=>tiles.find(x=>x.pattern[0]===t&&MODE_IDX[ts.mode].every(i=>x.pattern[i+1]===t));
 const lines=[`<?xml version="1.0" encoding="UTF-8"?>`,
  `<tileset version="${TILED_VERSION}" tiledversion="${TILED_APP}" name="${esc(name)}" tilewidth="${g.w}" tileheight="${g.h}" spacing="${g.sx}" margin="${g.ox}" tilecount="${g.cols*g.rows}" columns="${g.cols}">`,
  ` <image source="${esc(imageName)}" width="${width}" height="${height}"/>`];
 const probs=tiles.filter(t=>t.probability!=null&&t.probability!==1);
 for(const t of probs)lines.push(` <tile id="${t.id}" probability="${t.probability}"/>`);
 lines.push(' <wangsets>',`  <wangset name="${esc(name)}" type="${type}" tile="${full(0)?.id??-1}">`);
 ts.terrains.forEach((t,i)=>lines.push(`   <wangcolor name="${esc(t.name)}" color="${esc(t.color)}" tile="${full(i)?.id??-1}" probability="1"/>`));
 for(const t of tiles)lines.push(`   <wangtile tileid="${t.id}" wangid="${wangId(ts,t.pattern).join(',')}"/>`);
 lines.push('  </wangset>',' </wangsets>','</tileset>','');
 return lines.join('\n');
}
/** The tile Tiled's brush puts in every cell. Blob/edge sets: a tile per terrain cell whose Wang
 * colours equal what the neighbours want. Corner sets: a tile per grid POINT (the layer is offset
 * by half a tile), whose corner colours are the four cells meeting there.
 * @returns {w,h,offset:boolean, cells:[{x,y,id|null,alternatives,missing}]} */
export function resolveTiled(ts,grid){
 const get=(x,y)=>x<0||y<0||x>=grid.w||y>=grid.h?-1:grid.get(x,y);
 const tiles=Object.entries(ts.tiles).filter(([,v])=>v.pattern[0]>=0).map(([k,v])=>{const [c,r]=k.split(',').map(Number);return {key:k,id:tileId(ts,c,r),w:wangId(ts,v.pattern)};});
 const byWang=new Map();for(const t of tiles){const k=t.w.join();if(!byWang.has(k))byWang.set(k,[]);byWang.get(k).push(t);}
 const cells=[];
 if(ts.mode==='corners'){
  for(let y=0;y<=grid.h;y++)for(let x=0;x<=grid.w;x++){
   const c=[get(x-1,y-1),get(x,y-1),get(x,y),get(x-1,y)];// tl,tr,br,bl
   if(c.every(v=>v<0))continue;
   const want=[0,c[1]+1,0,c[2]+1,0,c[3]+1,0,c[0]+1],hit=byWang.get(want.join())||[];
   cells.push({x,y,id:hit[0]?.key??null,alternatives:hit.map(h=>h.key),missing:!hit.length,want});
  }
  return {w:grid.w+1,h:grid.h+1,offset:true,cells};
 }
 for(let y=0;y<grid.h;y++)for(let x=0;x<grid.w;x++){
  if(get(x,y)<0)continue;
  const ideal=idealAt(get,x,y,ts.mode);
  const hit=tiles.filter(t=>t.w.every((v,i)=>!MODE_IDX[ts.mode].includes(i)||ideal[i+1].includes(v-1)));
  cells.push({x,y,id:hit[0]?.key??null,alternatives:hit.map(h=>h.key),missing:!hit.length});
 }
 return {w:grid.w,h:grid.h,offset:false,cells};
}
export function tmx(ts,resolved,{tsxName='tileset.tsx',layerName='Terrain'}={}){
 const g=ts.grid,W=resolved.w,H=resolved.h,data=new Array(W*H).fill(0);
 for(const c of resolved.cells)if(c.id){const [col,row]=c.id.split(',').map(Number);data[c.y*W+c.x]=tileId(ts,col,row)+1;}
 const csv=[];for(let y=0;y<H;y++)csv.push(data.slice(y*W,(y+1)*W).join(','));
 const off=resolved.offset?` offsetx="${-g.w/2}" offsety="${-g.h/2}"`:'';
 return [`<?xml version="1.0" encoding="UTF-8"?>`,
  `<map version="${TILED_VERSION}" tiledversion="${TILED_APP}" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="${g.w}" tileheight="${g.h}" infinite="0" nextlayerid="2" nextobjectid="1">`,
  ` <tileset firstgid="1" source="${esc(tsxName)}"/>`,
  ` <layer id="1" name="${esc(layerName)}" width="${W}" height="${H}"${off}>`,
  '  <data encoding="csv">',csv.join(',\n'),'</data>',' </layer>','</map>',''].join('\n');
}
