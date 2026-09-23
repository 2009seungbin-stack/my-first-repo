/** Tile set generator: full 47-blob, 16-edge and 16-corner (dual-grid) sets assembled from a few
 * drawn pieces, pixel for pixel (quarter tiles are copied, never resampled). Pure.
 *
 * Every square autotile is four quarters, and each quarter only depends on three neighbours: the
 * top-left quarter on N, W and NW. That gives five quarter states per corner of the tile:
 *   corner  both sides open (outer corner)      hedge  N/S open, W/E connected (rim along top/bottom)
 *   vedge   W/E open, N/S connected (rim along the side)   inner  both connected, diagonal open
 *   full    all three connected
 * so 4 × 5 = 20 quarters (or 4 × 4 for side-only sets) are enough for all 47 tiles. Sources:
 *   rpgmaker-a2      RPG Maker MV/MZ A2 block, 2×3 tiles: top-left = preview, top-right = the four
 *                    inner corners, bottom 2×2 = a box whose corners/edges/centre give the rest
 *   blobsmith        same as A2 with the two top tiles swapped (inner corners top-left)
 *   rpgmaker-a4-wall RPG Maker A4 wall block, 2×2 tiles: sides only → 16 tiles
 *   five             5 tiles in a row: isolated, full, inner corners (+ shape), horizontal strip,
 *                    vertical strip
 *   rim              1 tile: the terrain's full tile; a rim of im pixels in one colour is drawn
 *                    along every open side, round or square outer corners, a rim block in inner
 *                    corners (procedural, still exact: no filtering, no blur)
 * Editing one source piece changes every generated tile that uses it (`provenance` says which).
 *
 * Dual grid: the tile drawn at a dual-grid point shows the quarters of the four cells that meet
 * there, so the same 20 quarters also give the 16 corner tiles (tl,tr,br,bl terrain or not). */
import {BLOB47,fromBlob,fromEdge,fromCorner,N,NE,E,SE,S,SW,W,NW} from './patterns.js';
import {layoutById,cellPattern} from './layouts.js';
export const QUADS=Object.freeze(['tl','tr','bl','br']);
export const STATES=Object.freeze(['corner','hedge','vedge','inner','full']);
/** Where each (quadrant, state) quarter lives, in half-tile units of the source block. */
const A2={tl:{corner:[0,2],hedge:[2,2],vedge:[0,4],inner:[2,0],full:[2,4]},tr:{corner:[3,2],hedge:[1,2],vedge:[3,4],inner:[3,0],full:[1,4]},
 bl:{corner:[0,5],hedge:[2,5],vedge:[0,3],inner:[2,1],full:[2,3]},br:{corner:[3,5],hedge:[1,5],vedge:[3,3],inner:[3,1],full:[1,3]}};
const swapTop=m=>Object.fromEntries(Object.entries(m).map(([q,s])=>[q,Object.fromEntries(Object.entries(s).map(([k,[x,y]])=>[k,y<2?[x<2?x+2:x-2,y]:[x,y]]))]));
const BLOBSMITH=swapTop(A2);
const A4={tl:{corner:[0,0],hedge:[2,0],vedge:[0,2],full:[2,2]},tr:{corner:[3,0],hedge:[1,0],vedge:[3,2],full:[1,2]},
 bl:{corner:[0,3],hedge:[2,3],vedge:[0,1],full:[2,1]},br:{corner:[3,3],hedge:[1,3],vedge:[3,1],full:[1,1]}};
// 'five': the quarter of the tile that shows that state everywhere
const FIVE_TILE={corner:0,full:1,inner:2,hedge:3,vedge:4};
export const SOURCE_KINDS=Object.freeze({
 'rpgmaker-a2':{cols:2,rows:3,mode:'corners-and-sides'},blobsmith:{cols:2,rows:3,mode:'corners-and-sides'},
 'rpgmaker-a4-wall':{cols:2,rows:2,mode:'sides'},five:{cols:5,rows:1,mode:'corners-and-sides'},rim:{cols:1,rows:1,mode:'corners-and-sides'}});
const QUAD_SIDES={tl:{v:N,h:W,c:NW},tr:{v:N,h:E,c:NE},bl:{v:S,h:W,c:SW},br:{v:S,h:E,c:SE}};
/** Quarter state of quadrant q for a (reduced) blob mask. */
export function quadState(mask,q,sidesOnly=false){
 const {v,h,c}=QUAD_SIDES[q],vv=!!(mask&v),hh=!!(mask&h);
 if(!vv&&!hh)return 'corner';if(!vv)return 'hedge';if(!hh)return 'vedge';
 if(sidesOnly)return 'full';
 return mask&c?'full':'inner';
}
function blank(w,h){return {data:new Uint8ClampedArray(w*h*4),w,h};}
function copyRect(src,sx,sy,dst,dx,dy,w,h){
 for(let y=0;y<h;y++){const s=((sy+y)*src.w+sx)*4;dst.data.set(src.data.subarray(s,s+w*4),((dy+y)*dst.w+dx)*4);}
}
/** Straight-alpha "over" in integers (exact for opaque pixels). */
function over(dst,src){
 const d=dst.data,s=src.data;
 for(let i=0;i<d.length;i+=4){
  const a=s[i+3];if(!a)continue;if(a===255){d[i]=s[i];d[i+1]=s[i+1];d[i+2]=s[i+2];d[i+3]=255;continue;}
  const b=d[i+3],oa=a+b*(255-a)/255;
  for(let k=0;k<3;k++)d[i+k]=Math.round((s[i+k]*a+d[i+k]*b*(255-a)/255)/oa);
  d[i+3]=Math.round(oa);
 }
}
/** A quarter picker: (quadrant, state) → {image, x, y, from} (the region of a source tile). */
function quarterPicker(kind,tileAt,w,h,rimOptions={}){
 if(w%2||h%2)throw Error('Tile width and height must be even to split into quarters');
 const qw=w/2,qh=h/2;
 if(kind==='rpgmaker-a2'||kind==='blobsmith'||kind==='rpgmaker-a4-wall'){
  const map=kind==='rpgmaker-a2'?A2:kind==='blobsmith'?BLOBSMITH:A4;
  return (q,state)=>{const s=map[q][state]??map[q].full;const [qx,qy]=s,tc=qx>>1,tr=qy>>1,t=tileAt(tc,tr);if(!t)throw Error('source tile missing');return {image:t,x:(qx&1)*qw,y:(qy&1)*qh,from:{col:tc,row:tr,qx:qx&1,qy:qy&1}};};
 }
 if(kind==='five'){
  return (q,state)=>{const i=FIVE_TILE[state],t=tileAt(i,0);if(!t)throw Error('source tile missing');return {image:t,x:q[1]==='r'?qw:0,y:q[0]==='b'?qh:0,from:{col:i,row:0,qx:q[1]==='r'?1:0,qy:q[0]==='b'?1:0}};};
 }
 if(kind==='rim')return rimPicker(tileAt(0,0),w,h,rimOptions);
 throw Error('Unknown source kind '+kind);
}
/** Procedural rim quarters from one full tile: `rim` px of `color` along open sides. */
function rimPicker(full,w,h,{rim=2,color=[40,32,28,255],round=true}={}){
 if(!full)throw Error('source tile missing');
 const qw=w/2,qh=h/2,k=Math.max(1,Math.min(Math.floor(Math.min(qw,qh)),rim|0)),cache=new Map();
 return (q,state)=>{
  const key=q+state;if(cache.has(key))return cache.get(key);
  const out=blank(w,h),x0=q[1]==='r'?qw:0,y0=q[0]==='b'?qh:0;
  copyRect(full,x0,y0,out,x0,y0,qw,qh);
  for(let y=0;y<qh;y++)for(let x=0;x<qw;x++){
   // distance from the tile's outer boundary in this quadrant's own frame
   const dx=q[1]==='r'?qw-1-x:x,dy=q[0]==='b'?qh-1-y:y;
   const edgeV=dy<k,edgeH=dx<k;// near the top/bottom boundary, near the left/right boundary
   let paint=false,clear=false;
   if(state==='hedge')paint=edgeV;
   else if(state==='vedge')paint=edgeH;
   else if(state==='corner'){paint=edgeV||edgeH;clear=round&&dx===0&&dy===0;}
   else if(state==='inner')paint=edgeV&&edgeH;
   const i=((y0+y)*w+x0+x)*4;
   if(clear)out.data.fill(0,i,i+4);else if(paint)out.data.set(color,i);
  }
  const r={image:out,x:x0,y:y0,from:{col:0,row:0,rim:state}};cache.set(key,r);return r;
 };
}
/** Assemble a full set from a source. `tileAt(col,row)` returns the source tiles ({data,w,h}).
 * @returns {mode, tiles:[{pattern, mask, image, provenance:{tl,tr,bl,br}}]} in canonical order
 *   (47 blob masks ascending, or the 16 side masks N1 E2 S4 W8 for side-only sources). */
export function assembleSource(kind,tileAt,{w,h,terrain=0,background=null,rim={}}={}){
 const K=SOURCE_KINDS[kind];if(!K)throw Error('Unknown source kind '+kind);
 const pick=quarterPicker(kind,tileAt,w,h,rim),qw=w/2,qh=h/2,sidesOnly=K.mode==='sides';
 const masks=sidesOnly?Array.from({length:16},(_,i)=>(i&1?N:0)|(i&2?E:0)|(i&4?S:0)|(i&8?W:0)):BLOB47;
 const tiles=masks.map((mask,idx)=>{
  const img=blank(w,h),prov={};
  for(const q of QUADS){const st=quadState(mask,q,sidesOnly),p=pick(q,st),dx=q[1]==='r'?qw:0,dy=q[0]==='b'?qh:0;copyRect(p.image,p.x,p.y,img,dx,dy,qw,qh);prov[q]={state:st,...p.from};}
  let image=img;
  if(background){image={data:new Uint8ClampedArray(background.data),w,h};over(image,img);}
  return {pattern:sidesOnly?fromEdge(idx,terrain):fromBlob(mask,terrain),mask,image,provenance:prov};
 });
 return {mode:K.mode,tiles};
}
/** 16 dual-grid (corner) tiles from the same quarters. Corner mask NW1 NE2 SE4 SW8.
 * The quarter at the dual tile's top-left belongs to the cell up-left of the point, and shows that
 * cell's bottom-right quarter as seen from its neighbours. */
export function assembleDual(kind,tileAt,{w,h,terrain=0,background=null,rim={}}={}){
 const K=SOURCE_KINDS[kind];if(!K)throw Error('Unknown source kind '+kind);
 if(K.mode==='sides')throw Error('A side-only source cannot draw corner tiles');
 const pick=quarterPicker(kind,tileAt,w,h,rim),qw=w/2,qh=h/2,tiles=[];
 for(let idx=0;idx<16;idx++){
  const tl=!!(idx&1),tr=!!(idx&2),br=!!(idx&4),bl=!!(idx&8),img=blank(w,h),prov={};
  // [dual quadrant, is that cell terrain, which quadrant of the cell, that cell's neighbour mask]
  const parts=[['tl',tl,'br',(bl?S:0)|(tr?E:0)|(br?SE:0)],['tr',tr,'bl',(br?S:0)|(tl?W:0)|(bl?SW:0)],
   ['bl',bl,'tr',(tl?N:0)|(br?E:0)|(tr?NE:0)],['br',br,'tl',(tr?N:0)|(bl?W:0)|(tl?NW:0)]];
  for(const [dq,filled,cq,mask] of parts){
   if(!filled)continue;
   const st=quadState(mask,cq),p=pick(cq,st),dx=dq[1]==='r'?qw:0,dy=dq[0]==='b'?qh:0;
   copyRect(p.image,p.x,p.y,img,dx,dy,qw,qh);prov[dq]={state:st,quadrant:cq,...p.from};
  }
  let image=img;if(background){image={data:new Uint8ClampedArray(background.data),w,h};over(image,img);}
  tiles.push({pattern:fromCorner(idx,terrain),mask:idx,image,provenance:prov});
 }
 return {mode:'corners',tiles};
}
/** Terrain-B background version of a generated set: open positions become terrain B (for a
 * two-terrain Godot/Tiled set), and B's full tile is appended. */
export function asTransition(set,b,fullB){
 const tiles=set.tiles.map(t=>({...t,pattern:t.pattern.map((v,i)=>i===0?v:v<0?b:v)}));
 const p=[b,b,b,b,b,b,b,b,b];
 if(set.mode==='sides')for(const i of [2,4,6,8])p[i]=-1;// corners unused in side mode
 if(set.mode==='corners')for(const i of [1,3,5,7])p[i]=-1;
 tiles.push({pattern:p,mask:-1,image:fullB,provenance:{}});
 return {...set,tiles};
}
/** Lay tiles out as a sheet in a published layout. `tiles` = [{pattern, image}]; the first tile
 * matching each layout cell's pattern is used. Cells with no tile stay transparent and are listed.
 * Extra tiles (transitions, duplicates) are appended in rows below. */
export function buildSheet(tiles,layoutId,{w,h,terrain=0,spacing=0,margin=0}={}){
 const L=layoutById(layoutId);if(!L)throw Error('Unknown layout '+layoutId);
 const key=p=>p.join(','),byKey=new Map();for(const t of tiles)if(!byKey.has(key(t.pattern)))byKey.set(key(t.pattern),t);
 const used=new Set(),cells=[],missing=[];
 for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){
  const p=cellPattern(L,c,r,terrain);if(!p)continue;
  const t=byKey.get(key(normaliseForMode(p,L.mode)))||byKey.get(key(p));
  if(t){used.add(t);cells.push({col:c,row:r,pattern:t.pattern,tile:t});}else missing.push({col:c,row:r,pattern:p});
 }
 const extra=tiles.filter(t=>!used.has(t));
 const cols=L.cols,extraRows=Math.ceil(extra.length/cols);
 extra.forEach((t,i)=>cells.push({col:i%cols,row:L.rows+Math.floor(i/cols),pattern:t.pattern,tile:t,extra:true}));
 const rows=L.rows+extraRows,W=margin*2+cols*w+(cols-1)*spacing,H=margin*2+rows*h+(rows-1)*spacing;
 const out={data:new Uint8ClampedArray(W*H*4),w:W,h:H};
 for(const c of cells)copyRect(c.tile.image,0,0,out,margin+c.col*(w+spacing),margin+c.row*(h+spacing),w,h);
 return {image:{data:out.data,width:W,height:H},grid:{w,h,ox:margin,oy:margin,sx:spacing,sy:spacing,cols,rows},
  cells:cells.map(({col,row,pattern,extra})=>({col,row,pattern,extra:!!extra})),missing,layoutId};
}
const normaliseForMode=(p,mode)=>p;
/** Re-arrange an existing sheet's tiles (by their patterns) into another layout: `tileAt(col,row)`
 * and `entries` = [{col,row,pattern}] of the source. */
export function remapSheet(tileAt,entries,layoutId,{w,h,terrain=0}={}){
 const tiles=entries.filter(e=>e.pattern&&e.pattern[0]>=0).map(e=>({pattern:e.pattern,image:tileAt(e.col,e.row)})).filter(t=>t.image);
 return buildSheet(tiles,layoutId,{w,h,terrain});
}
/** Which generated tiles use a given source quarter (for "edit one, see every tile it feeds"). */
export function usesOf(set,{col,row}){
 return set.tiles.map((t,i)=>Object.values(t.provenance).some(p=>p.col===col&&p.row===row)?i:-1).filter(i=>i>=0);
}
