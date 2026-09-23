/** Canonical terrain patterns for the Tile workspace. Pure: no DOM, no pixels.
 *
 * Every tile that takes part in autotiling gets ONE internal description, whatever layout the
 * sheet came in (cr31, GameMaker, Godot 3, RPG Maker, dual grid…): a terrain pattern in the same
 * shape Godot 4 uses, so it maps 1:1 onto Godot peering bits and loses nothing for Tiled, LDtk or
 * Unity.
 *
 *   pattern = [t, n, ne, e, se, s, sw, w, nw]
 *     t       the tile's own terrain (its centre), 0…15; -1 = the tile is not a terrain tile
 *     n…nw    the terrain expected at each of the 8 neighbour positions (Godot "peering bits"),
 *             -1 = no terrain there (empty)
 *
 * A terrain set has a match mode that says which of the 8 positions count:
 *   'corners-and-sides'  all 8 (47-tile blob and anything drawn with inner corners)
 *   'sides'              n, e, s, w (16-tile edge sets, 3×3 minimal)
 *   'corners'            ne, se, sw, nw (16-tile corner / Wang 2-corner / dual-grid sets)
 * Positions a mode ignores are stored as -1.
 *
 * Bit order of a cr31 blob mask (used by the corpus and most published tables):
 *   N 1, NE 2, E 4, SE 8, S 16, SW 32, W 64, NW 128  (y grows downwards). */
export const POS=Object.freeze(['n','ne','e','se','s','sw','w','nw']);
export const OFFSETS=Object.freeze([[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]);
export const SIDE_IDX=Object.freeze([0,2,4,6]),CORNER_IDX=Object.freeze([1,3,5,7]);
export const MODES=Object.freeze(['corners-and-sides','sides','corners']);
export const MODE_IDX=Object.freeze({'corners-and-sides':Object.freeze([0,1,2,3,4,5,6,7]),sides:SIDE_IDX,corners:CORNER_IDX});
export const MAX_TERRAINS=16;
/** Godot 4 names (TileSet.CellNeighbor, lowercased) for each position. */
export const GODOT_NAMES=Object.freeze(['top_side','top_right_corner','right_side','bottom_right_corner','bottom_side','bottom_left_corner','left_side','top_left_corner']);
export const GODOT_MODE=Object.freeze({'corners-and-sides':'match_corners_and_sides',corners:'match_corners',sides:'match_sides'});
/** For each corner position, the two side positions next to it. */
export const CORNER_SIDES=Object.freeze({1:[0,2],3:[2,4],5:[4,6],7:[6,0]});
export const N=1,NE=2,E=4,SE=8,S=16,SW=32,W=64,NW=128;
const BLOB_W=[N,NE,E,SE,S,SW,W,NW];
export const EMPTY=Object.freeze([-1,-1,-1,-1,-1,-1,-1,-1,-1]);
export function isMode(m){return MODES.includes(m);}
export function checkPattern(p){
 if(!Array.isArray(p)||p.length!==9)throw Error('A pattern has 9 entries');
 for(const v of p)if(!Number.isInteger(v)||v<-1||v>=MAX_TERRAINS)throw Error('Pattern entries are terrain indexes -1…15');
 return p;
}
/** Only the positions the mode uses; the rest are forced to -1. */
export function inMode(p,mode){const out=p.slice();const keep=new Set(MODE_IDX[mode]);for(let i=0;i<8;i++)if(!keep.has(i))out[i+1]=-1;return out;}
export const patternKey=p=>p.join(',');
export const samePattern=(a,b)=>!!a&&!!b&&a.every((v,i)=>v===b[i]);
/** A corner only matters when both sides next to it connect (it is invisible behind an open side). */
export function reduceBlob(mask){
 let m=mask&(N|E|S|W);
 if(mask&NE&&mask&N&&mask&E)m|=NE;if(mask&SE&&mask&S&&mask&E)m|=SE;
 if(mask&SW&&mask&S&&mask&W)m|=SW;if(mask&NW&&mask&N&&mask&W)m|=NW;
 return m;
}
/** All 47 reduced blob masks, ascending (this is also the cr31 "ascending ID" order). */
export const BLOB47=Object.freeze([...new Set(Array.from({length:256},(_,m)=>reduceBlob(m)))].sort((a,b)=>a-b));
/** cr31 blob mask → pattern of terrain `t` against empty. */
export function fromBlob(mask,t=0){const p=[t];for(let i=0;i<8;i++)p.push(mask&BLOB_W[i]?t:-1);return p;}
/** Side mask with N=1 E=2 S=4 W=8 (the usual "Wang edge index"). */
export function fromEdge(idx,t=0){const p=[t,-1,-1,-1,-1,-1,-1,-1,-1];if(idx&1)p[1]=t;if(idx&2)p[3]=t;if(idx&4)p[5]=t;if(idx&8)p[7]=t;return p;}
/** Corner mask with NW=1 NE=2 SE=4 SW=8 (cr31 2-corner / Godot 3 "2×2"). */
export function fromCorner(idx,t=0){const p=[t,-1,-1,-1,-1,-1,-1,-1,-1];if(idx&1)p[8]=t;if(idx&2)p[2]=t;if(idx&4)p[4]=t;if(idx&8)p[6]=t;return p;}
/** Pattern → cr31 mask of positions equal to terrain `t` (for display and single-terrain checks). */
export function blobOf(p,t=p[0]){let m=0;for(let i=0;i<8;i++)if(p[i+1]===t&&t>=0)m|=BLOB_W[i];return m;}
export const edgeOf=(p,t=p[0])=>(p[1]===t?1:0)|(p[3]===t?2:0)|(p[5]===t?4:0)|(p[7]===t?8:0);
export const cornerOf=(p,t=p[0])=>(p[8]===t?1:0)|(p[2]===t?2:0)|(p[4]===t?4:0)|(p[6]===t?8:0);
/** Human label: sides then corners, e.g. "N E S · NE". */
export function describe(p){
 if(p[0]<0)return '—';
 const on=i=>p[i+1]>=0;
 const s=SIDE_IDX.filter(on).map(i=>POS[i].toUpperCase()),c=CORNER_IDX.filter(on).map(i=>POS[i].toUpperCase());
 const multi=new Set(p.slice(1).filter(v=>v>=0&&v!==p[0])).size>0;
 return (s.join('')||'')+(c.length?'·'+c.join(''):'')+(multi?' *':'')||'O';
}
/** The patterns a complete single-terrain set needs in a mode (terrain t against empty). */
export function requiredPatterns(mode,t=0){
 if(mode==='corners-and-sides')return BLOB47.map(m=>fromBlob(m,t));
 if(mode==='sides')return Array.from({length:16},(_,i)=>fromEdge(i,t));
 return Array.from({length:16},(_,i)=>fromCorner(i,t));
}
/** Transition patterns a complete "A over B" set needs: every required pattern of A where the
 * -1 positions are terrain B instead, plus B's full tile. */
export function requiredPairPatterns(mode,a,b){
 const out=requiredPatterns(mode,a).map(p=>{const q=p.slice();for(const i of MODE_IDX[mode])if(q[i+1]<0)q[i+1]=b;return q;});
 const full=[b,-1,-1,-1,-1,-1,-1,-1,-1];for(const i of MODE_IDX[mode])full[i+1]=b;out.push(full);
 return out;
}
/** Completeness of a tileset's patterns (entries: {id, pattern}) for one terrain set.
 * Returns missing required patterns per terrain (and per declared pair), duplicate groups and
 * patterns that are not valid in the mode (e.g. a corner set without both sides). */
export function completeness(mode,entries,{terrains=1,pairs=[]}={}){
 const byKey=new Map();
 for(const e of entries){if(!e.pattern||e.pattern[0]<0)continue;const k=patternKey(inMode(e.pattern,mode));if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(e.id);}
 const perTerrain=[];
 for(let t=0;t<terrains;t++){
  const used=entries.some(e=>e.pattern&&e.pattern[0]===t);if(!used){perTerrain.push({terrain:t,used:false,missing:[],present:0,expected:0});continue;}
  const need=requiredPatterns(mode,t),missing=need.filter(p=>!byKey.has(patternKey(p)));
  perTerrain.push({terrain:t,used:true,expected:need.length,present:need.length-missing.length,missing});
 }
 const perPair=pairs.map(([a,b])=>{const need=requiredPairPatterns(mode,a,b),missing=need.filter(p=>!byKey.has(patternKey(p)));return {a,b,expected:need.length,present:need.length-missing.length,missing};});
 const duplicates=[...byKey.entries()].filter(([,ids])=>ids.length>1).map(([k,ids])=>({pattern:k.split(',').map(Number),ids}));
 const invalid=[];
 if(mode==='corners-and-sides')for(const e of entries){
  const p=e.pattern;if(!p||p[0]<0)continue;
  // A corner set without one of its sides is a tile the engine can pick but no map ever needs:
  // it usually means a bit was painted on the wrong position.
  for(const [c,[s1,s2]]of Object.entries(CORNER_SIDES)){const ci=+c;if(p[ci+1]>=0&&p[ci+1]===p[0]&&(p[s1+1]!==p[0]||p[s2+1]!==p[0])){invalid.push({id:e.id,position:POS[ci]});break;}}
 }
 return {mode,perTerrain,perPair,duplicates,invalid,
  complete:perTerrain.every(x=>!x.used||!x.missing.length)&&perPair.every(x=>!x.missing.length)&&perTerrain.some(x=>x.used)};
}
/** The pattern a map cell "wants" from its neighbourhood (terrain per cell, -1 = empty).
 * Returns for every position the set of acceptable values: a position shared by cells of one
 * terrain wants that terrain; a position between terrain and empty wants -1; a position where two
 * different terrains meet accepts either (the tileset decides which one draws the transition). */
export function idealAt(get,x,y,mode){
 const t=get(x,y);if(t<0)return null;
 const want=[[t]];
 for(let i=0;i<8;i++){
  if(!MODE_IDX[mode].includes(i)){want.push([-1]);continue;}
  const [dx,dy]=OFFSETS[i];
  const cells=i%2===0?[get(x+dx,y+dy)]:[get(x+dx,y),get(x,y+dy),get(x+dx,y+dy)];
  const all=new Set([t,...cells]);
  if(all.size===1)want.push([t]);
  else if(all.has(-1)&&all.size===2)want.push([-1]);
  else want.push([...all].filter(v=>v>=0));
 }
 return want;
}
export const fits=(p,want)=>!!p&&want.every((vals,i)=>vals.includes(p[i]));
