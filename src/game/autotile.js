/** Autotile rule sets as data. Pure: no DOM, no pixels.
 *
 * Four different things people all call "autotile". They are not interchangeable:
 *  minimal9  3×3 minimal — 9 tiles, matched on the 4 SIDES only. Cannot draw a one-tile-wide
 *            strip or an isolated tile: 7 of the 16 side masks have no tile, by construction.
 *  edge16    16-tile edge Wang (2-edge) — one tile per combination of the 4 sides. Complete.
 *  corner16  16-tile corner Wang (2-corner) — one tile per combination of the 4 CORNER samples.
 *            The tile grid sits half a tile off the terrain grid (a "dual grid"): the tile drawn
 *            at (x,y) shows the four cells meeting at its top-left point. Complete.
 *  blob47    47-tile blob — 8 neighbours, but a corner only counts when both of its edges are
 *            also set (a corner neighbour is invisible behind a missing edge). That reduction
 *            maps all 256 raw masks onto exactly 47 classes.
 *
 * Bit order of the 8-neighbour mask used everywhere in this module:
 *   N 1, NE 2, E 4, SE 8, S 16, SW 32, W 64, NW 128  (y grows downwards, x to the right) */
export const N=1,NE=2,E=4,SE=8,S=16,SW=32,W=64,NW=128;
export const EDGE_BITS=Object.freeze([['n',N],['e',E],['s',S],['w',W]]);
export const CORNER_BITS=Object.freeze([['ne',NE],['se',SE],['sw',SW],['nw',NW]]);
export const SIDES=Object.freeze(['n','e','s','w']);
export const KINDS=Object.freeze(['minimal9','edge16','corner16','blob47']);
const bit=(m,b)=>(m&b)!==0;
/** A corner neighbour is only visible when both of its edges are neighbours too. */
export function reduceMask(mask){
 let m=mask&(N|E|S|W);
 if(bit(mask,NE)&&bit(mask,N)&&bit(mask,E))m|=NE;
 if(bit(mask,SE)&&bit(mask,S)&&bit(mask,E))m|=SE;
 if(bit(mask,SW)&&bit(mask,S)&&bit(mask,W))m|=SW;
 if(bit(mask,NW)&&bit(mask,N)&&bit(mask,W))m|=NW;
 return m;
}
export const edgeMask=mask=>mask&(N|E|S|W);
/** Compact 0..15 index for a side set (n,e,s,w) — the number people mean by "Wang index". */
export const sideIndex=mask=>(bit(mask,N)?1:0)|(bit(mask,E)?2:0)|(bit(mask,S)?4:0)|(bit(mask,W)?8:0);
export const maskFromSideIndex=i=>(i&1?N:0)|(i&2?E:0)|(i&4?S:0)|(i&8?W:0);
/** Corner Wang samples, clockwise from the top-left of the tile. */
export const CORNER_SAMPLES=Object.freeze(['tl','tr','br','bl']);
export const cornerIndex=c=>(c.tl?1:0)|(c.tr?2:0)|(c.br?4:0)|(c.bl?8:0);
const cornerSet=i=>({tl:!!(i&1),tr:!!(i&2),br:!!(i&4),bl:!!(i&8)});
const describe=mask=>{
 const e=EDGE_BITS.filter(([,b])=>bit(mask,b)).map(([k])=>k.toUpperCase()),c=CORNER_BITS.filter(([,b])=>bit(mask,b)).map(([k])=>k.toUpperCase());
 return e.length||c.length?e.join('')+(c.length?'·'+c.join(''):''):'O';
};
/** What a slot is for, so the visualiser can label it instead of relying on colour. */
export function roleOf(mask,kind=''){
 if(kind==='corner16'){
  const c=CORNER_BITS.filter(([,b])=>bit(mask,b)).map(([k])=>k),n=c.length;
  return n===0?'empty':n===4?'full':n===1?'corner':n===3?'inner-corner':(c.includes('nw')&&c.includes('se'))||(c.includes('ne')&&c.includes('sw'))?'diagonal':'edge';
 }
 const sides=EDGE_BITS.filter(([,b])=>bit(mask,b)).map(([k])=>k),n=sides.length;
 if(!n)return 'isolated';
 if(n===1)return 'end';
 if(n===2)return (sides.includes('n')&&sides.includes('s'))||(sides.includes('e')&&sides.includes('w'))?'corridor':'corner';
 if(n===3)return 'tee';
 return CORNER_BITS.every(([,b])=>bit(mask,b))?'full':'inner-corner';
}
const slot=(index,mask,{kind,key,row,col,extra={}})=>Object.freeze({
 index,kind,key,mask,row,col,name:describe(mask),role:roleOf(mask,kind),
 edges:Object.freeze(Object.fromEntries(EDGE_BITS.map(([k,b])=>[k,bit(mask,b)]))),
 corners:Object.freeze(Object.fromEntries(CORNER_BITS.map(([k,b])=>[k,bit(mask,b)]))),...extra});
/** 3×3 minimal: the row says whether there is a neighbour above / below, the column left / right.
 * A side set with neither above nor below (or neither left nor right) has no slot at all. */
function minimal9(){
 const rowOf=m=>bit(m,N)&&bit(m,S)?1:bit(m,S)?0:bit(m,N)?2:-1,colOf=m=>bit(m,W)&&bit(m,E)?1:bit(m,E)?0:bit(m,W)?2:-1,out=[];
 for(let i=0;i<16;i++){const m=maskFromSideIndex(i),r=rowOf(m),c=colOf(m);if(r<0||c<0)continue;out.push([r*3+c,m,r,c]);}
 return out.sort((a,b)=>a[0]-b[0]).map(([,m,r,c],index)=>slot(index,m,{kind:'minimal9',key:sideIndex(m),row:r,col:c}));
}
function wang16(kind){
 const out=[];
 for(let i=0;i<16;i++){
  const mask=kind==='edge16'?maskFromSideIndex(i):(i&1?NW:0)|(i&2?NE:0)|(i&4?SE:0)|(i&8?SW:0);
  const extra=kind==='corner16'?{samples:Object.freeze(cornerSet(i))}:{};
  out.push(slot(i,mask,{kind,key:i,row:i>>2,col:i&3,extra}));
 }
 return out;
}
function blob47(){
 const seen=new Set();
 for(let m=0;m<256;m++)seen.add(reduceMask(m));
 return [...seen].sort((a,b)=>a-b).map((mask,index)=>slot(index,mask,{kind:'blob47',key:mask,row:index>>3,col:index&7}));
}
const build=kind=>{
 const slots=kind==='minimal9'?minimal9():kind==='blob47'?blob47():wang16(kind);
 const columns=kind==='minimal9'?3:kind==='blob47'?8:4;
 return Object.freeze({kind,columns,rows:Math.max(...slots.map(s=>s.row))+1,count:slots.length,
  match:kind==='corner16'?'corners':kind==='blob47'?'corners-and-sides':'sides',dual:kind==='corner16',
  slots:Object.freeze(slots),byKey:Object.freeze(new Map(slots.map(s=>[s.key,s])))});
};
export const LAYOUTS=Object.freeze(Object.fromEntries(KINDS.map(k=>[k,build(k)])));
export const layoutOf=kind=>{const l=LAYOUTS[kind];if(!l)throw Error(`Unknown autotile kind ${kind}`);return l;};
/** Side masks a kind cannot represent at all (3×3 minimal has seven of them). */
export function unrepresentable(kind){
 const l=layoutOf(kind);if(l.match!=='sides')return [];
 const have=new Set(l.slots.map(s=>s.key));
 return Array.from({length:16},(_,i)=>i).filter(i=>!have.has(i));
}
/** The slot a neighbourhood needs. `mask` is the raw 8-neighbour mask of a terrain cell;
 * for corner16 pass the four corner samples instead. Returns null when nothing fits. */
export function slotFor(kind,value){
 const l=layoutOf(kind);
 if(kind==='corner16')return l.byKey.get(typeof value==='number'?value:cornerIndex(value))||null;
 const key=kind==='blob47'?reduceMask(value):sideIndex(value);
 return l.byKey.get(key)||null;
}
/** Which slots a set of painted keys is missing, and which keys were claimed twice. */
export function completeness(kind,assignments=[]){
 const l=layoutOf(kind),byKey=new Map();
 for(const a of assignments){
  const key=typeof a==='number'?a:a.key;if(!l.byKey.has(key))continue;
  if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(a);
 }
 const missing=l.slots.filter(s=>!byKey.has(s.key)),duplicates=l.slots.filter(s=>(byKey.get(s.key)||[]).length>1).map(s=>({slot:s,tiles:byKey.get(s.key)}));
 return {kind,expected:l.count,present:byKey.size,missing,duplicates,complete:missing.length===0&&duplicates.length===0};
}
/** Exported layout: the slot ↔ mask table itself, so a tester can reload a template by hand. */
export function layoutJSON(kind,{tileWidth=16,tileHeight=16,toolVersion='1',image=''}={}){
 const l=layoutOf(kind);
 return {meta:{tool:'nerulio-tile-lab',toolVersion,schemaVersion:1,engineTarget:'generic',image,
   size:{w:l.columns*tileWidth,h:l.rows*tileHeight}},
  layout:{kind,match:l.match,dualGrid:l.dual,columns:l.columns,rows:l.rows,count:l.count,
   tileSize:{w:tileWidth,h:tileHeight},bitOrder:{n:N,ne:NE,e:E,se:SE,s:S,sw:SW,w:W,nw:NW},
   slots:l.slots.map(s=>({index:s.index,key:s.key,mask:s.mask,name:s.name,role:s.role,col:s.col,row:s.row,
    rect:{x:s.col*tileWidth,y:s.row*tileHeight,w:tileWidth,h:tileHeight},
    edges:{...s.edges},corners:{...s.corners},...(s.samples?{samples:{...s.samples}}:{})}))}};
}
/** Reads back what layoutJSON wrote, and refuses a table that disagrees with the rule set. */
export function layoutFromJSON(json){
 const d=json?.layout;if(!d||!KINDS.includes(d.kind))throw Error('Not a Tile Lab autotile layout');
 const l=layoutOf(d.kind);
 if(!Array.isArray(d.slots)||d.slots.length!==l.count)throw Error(`A ${d.kind} layout has ${l.count} slots`);
 for(const s of d.slots){
  const known=l.slots[s.index];
  if(!known||known.key!==s.key||known.mask!==s.mask)throw Error(`Slot ${s.index} does not match the ${d.kind} rules`);
 }
 const tileWidth=Math.round(d.tileSize?.w||0),tileHeight=Math.round(d.tileSize?.h||0);
 if(!(tileWidth>0&&tileHeight>0))throw Error('Layout tile size is missing');
 return {kind:d.kind,tileWidth,tileHeight,columns:d.columns||l.columns,rows:d.rows||l.rows};
}
/* ---- terrain map ---- */
/** A paintable terrain grid. Stored as one byte per cell so undo can snapshot it cheaply. */
export function terrainGrid(w,h,fill=0){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w*h>1<<20)throw Error('Invalid grid size');
 return {w,h,cells:new Uint8Array(w*h).fill(fill?1:0)};
}
export const cellAt=(g,x,y)=>x>=0&&y>=0&&x<g.w&&y<g.h?g.cells[y*g.w+x]:0;
/** Outside the grid counts as terrain when `wrap` is false and `outside` is true: that is what
 * makes the border of a finished map look continuous instead of edged. */
const sample=(g,x,y,{wrap=false,outside=false}={})=>wrap?g.cells[((y%g.h+g.h)%g.h)*g.w+(x%g.w+g.w)%g.w]:(x<0||y<0||x>=g.w||y>=g.h?(outside?1:0):g.cells[y*g.w+x]);
export function maskAt(g,x,y,options={}){
 let m=0;
 for(const [dx,dy,b] of [[0,-1,N],[1,-1,NE],[1,0,E],[1,1,SE],[0,1,S],[-1,1,SW],[-1,0,W],[-1,-1,NW]])if(sample(g,x+dx,y+dy,options))m|=b;
 return m;
}
/** Slot index per cell, -1 where nothing is drawn. For corner16 the result is a (w+1)×(h+1)
 * grid offset by half a tile: cell (x,y) of the output reads terrain cells (x-1,y-1)…(x,y). */
export function renderMap(kind,g,options={}){
 const l=layoutOf(kind);
 if(l.dual){
  const w=g.w+1,h=g.h+1,out=new Int16Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const key=cornerIndex({tl:!!sample(g,x-1,y-1,options),tr:!!sample(g,x,y-1,options),br:!!sample(g,x,y,options),bl:!!sample(g,x-1,y,options)});
   out[y*w+x]=l.byKey.get(key).index;
  }
  return {w,h,offsetX:-.5,offsetY:-.5,slots:out};
 }
 const out=new Int16Array(g.w*g.h);
 for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++){
  if(!g.cells[y*g.w+x]){out[y*g.w+x]=-1;continue;}
  const s=slotFor(kind,maskAt(g,x,y,options));out[y*g.w+x]=s?s.index:-1;
 }
 return {w:g.w,h:g.h,offsetX:0,offsetY:0,slots:out};
}
/** Which slots a rendered map actually asked for — the honest way to say "this map would show
 * a hole" instead of calling a preview a map generator. */
export function usedSlots(rendered){
 const used=new Map();
 for(const index of rendered.slots)if(index>=0)used.set(index,(used.get(index)||0)+1);
 return used;
}
/** Deterministic value noise so a seeded fill is reproducible across reloads and machines. */
export function seededFill(g,seed,{density=.55,smooth=2}={}){
 let s=(seed|0)||1;const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)/4294967296);};
 const a=new Uint8Array(g.w*g.h);
 for(let i=0;i<a.length;i++)a[i]=rnd()<density?1:0;
 let cur=a;
 for(let pass=0;pass<smooth;pass++){
  const next=new Uint8Array(cur.length);
  for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++){
   let n=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=g.w||ny>=g.h)n++;else n+=cur[ny*g.w+nx];}
   next[y*g.w+x]=n>=5?1:0;
  }
  cur=next;
 }
 return {...g,cells:cur};
}
export function floodFill(g,x,y,value){
 const target=cellAt(g,x,y),v=value?1:0;
 if(target===v)return g;
 const cells=new Uint8Array(g.cells),queue=[y*g.w+x];cells[y*g.w+x]=v;
 while(queue.length){
  const p=queue.pop(),px=p%g.w,py=(p-px)/g.w;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=g.w||ny>=g.h)continue;
   const n=ny*g.w+nx;if(cells[n]===target){cells[n]=v;queue.push(n);}
  }
 }
 return {...g,cells};
}
