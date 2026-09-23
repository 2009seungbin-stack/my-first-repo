/** Test maps for the Studio Tile engine checks (Godot, Tiled, Unity, LDtk). Shared so every
 * engine paints exactly the same cells. Pure. */
export const SHAPE58=['..............','.#####...###..','.#####..#####.','.##.##..##.##.','.#####..#####.','.#####...###..','...#......#...','..###.#..###..','...#.###......','......#.......','..............'];
export function rng(seed){let s=(seed|0)||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
/** A terrain grid {w,h,cells:Int8Array} (-1 empty). */
export function gridFromRows(rows,terrain=0){
 const h=rows.length,w=rows[0].length,cells=new Int8Array(w*h).fill(-1);
 rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch==='#')cells[y*w+x]=terrain;else if(/[0-9]/.test(ch))cells[y*w+x]=+ch;}));
 return {w,h,cells};
}
/** Seeded blobby map: `terrains` > 1 paints several terrains. */
export function randomGrid(w,h,seed,{density=.55,terrains=1,smooth=1}={}){
 const r=rng(seed),cells=new Int8Array(w*h).fill(-1);
 for(let i=0;i<cells.length;i++)if(r()<density)cells[i]=terrains>1?Math.floor(r()*terrains):0;
 let cur=cells;
 for(let p=0;p<smooth;p++){
  const next=new Int8Array(cur);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const count=new Map();let empty=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;const v=nx<0||ny<0||nx>=w||ny>=h?-1:cur[ny*w+nx];if(v<0)empty++;else count.set(v,(count.get(v)||0)+1);}
   let best=-1,bn=empty;for(const [v,n] of count)if(n>bn){best=v;bn=n;}
   next[y*w+x]=bn>=4?best:cur[y*w+x];
  }
  cur=next;
 }
 return {w,h,cells:cur};
}
export const getter=g=>(x,y)=>x<0||y<0||x>=g.w||y>=g.h?-1:g.cells[y*g.w+x];
/** The Godot calls a script makes for a grid: one set_cells_terrain_connect per terrain, row-major. */
export function godotCalls(g){
 const ts=[...new Set([...g.cells].filter(v=>v>=0))].sort((a,b)=>a-b);
 return ts.map(t=>{const cells=[];for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++)if(g.cells[y*g.w+x]===t)cells.push([x,y]);return {terrain:t,cells};});
}
export function standardCases(terrains=1){
 const out=[{name:'shape58',grid:gridFromRows(SHAPE58)},
  {name:'random-a',grid:randomGrid(18,14,7)},{name:'random-sparse',grid:randomGrid(18,14,11,{density:.35,smooth:0})},
  {name:'random-dense',grid:randomGrid(18,14,23,{density:.7})}];
 if(terrains>1){out.push({name:'multi-full',grid:randomGrid(16,12,13,{terrains,density:1,smooth:2})});out.push({name:'multi-a',grid:randomGrid(18,14,5,{terrains,density:.8})});out.push({name:'multi-b',grid:randomGrid(16,12,9,{terrains,density:.9,smooth:2})});}
 return out;
}
