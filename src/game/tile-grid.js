/** Tile grid detection, slicing geometry and tile comparison. Pure RGBA in, plain data out:
 * no DOM, no canvas, no application state.
 *
 * Detection does not ask "which size divides the image" — almost every size divides a 256×256
 * sheet. It measures the sheet: where the strong pixel transitions actually repeat, whether the
 * lines a margin/spacing layout would reserve really are blank or flat, and whether drawn
 * content stops at the proposed boundaries. Candidates are ranked and every one of them shows
 * the numbers it was ranked on; the tool never picks silently. */
import {MAX_FRAMES} from '../primitives.js';
export const COMMON_SIZES=Object.freeze([8,16,24,32,48,64]);
export const MARGINS=Object.freeze([0,1,2]);
export const SPACINGS=Object.freeze([0,1,2,4]);
export const MAX_TILES=MAX_FRAMES;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const isInt=v=>Number.isSafeInteger(v);
function check(data,w,h){
 if(!isInt(w)||!isInt(h)||w<1||h<1)throw Error('Invalid dimensions');
 if(data.length!==w*h*4)throw Error('Pixel limit exceeded or invalid RGBA data');
}
/** Per-line statistics along one axis: how different each line is from the one before it, whether
 * the line is blank or flat, and how often drawn content continues across it. */
export function axisProfile(data,w,h,axis){
 check(data,w,h);
 const len=axis==='x'?w:h,across=axis==='x'?h:w,step=axis==='x'?4:w*4,jump=axis==='x'?w*4:4;
 const edge=new Float64Array(len),uniform=new Uint8Array(len),clear=new Uint8Array(len),cross=new Float64Array(len);
 for(let i=0;i<len;i++){
  const base=i*step;let flat=1,blank=1,sum=0,both=0;
  const r0=data[base],g0=data[base+1],b0=data[base+2],a0=data[base+3];
  for(let j=0;j<across;j++){
   const p=base+j*jump;
   if(data[p+3])blank=0;
   if(flat&&(data[p]!==r0||data[p+1]!==g0||data[p+2]!==b0||data[p+3]!==a0))flat=0;
   if(i){
    const q=p-step;
    sum+=Math.abs(data[p]-data[q])+Math.abs(data[p+1]-data[q+1])+Math.abs(data[p+2]-data[q+2])+Math.abs(data[p+3]-data[q+3])*2;
    if(data[p+3]>8&&data[q+3]>8)both++;
   }
  }
  edge[i]=i?sum/(across*5):0;uniform[i]=flat;clear[i]=blank;cross[i]=i?both/across:0;
 }
 // "Strong" is an outlier rule, not a fixed number: a flat tileset and a busy one both work.
 const inner=Array.from(edge.slice(1)).sort((a,b)=>a-b);
 const at=q=>inner.length?inner[clamp(Math.round(q*(inner.length-1)),0,inner.length-1)]:0;
 // A robust spread (interquartile, floored) keeps the few seam lines out of their own threshold.
 const median=at(.5),strong=median+6*Math.max(at(.75)-at(.25),median*.35,.8);
 const strongLines=[];for(let i=1;i<len;i++)if(edge[i]>=strong)strongLines.push(i);
 const meanCross=len>1?cross.slice(1).reduce((s,v)=>s+v,0)/(len-1):0;
 return {axis,len,edge,uniform,clear,cross,strong,strongLines,meanCross};
}
/** Sizes worth trying on one axis: the usual suspects plus the sheet's own exact divisors, so an
 * odd sheet (105 px wide, 15 px tiles) is not silently excluded. */
export function axisSizes(len,extra=[]){
 const sizes=new Set();
 for(const s of [...COMMON_SIZES,...extra])if(isInt(s)&&s>=4&&s<=len)sizes.add(s);
 for(let count=2;count<=64;count++){const s=len/count;if(isInt(s)&&s>=4&&s<=256)sizes.add(s);}
 return [...sizes].sort((a,b)=>a-b);
}
function axisOption(p,tile,margin,spacing){
 const period=tile+spacing,usable=p.len-margin;
 if(tile<4||usable<tile)return null;
 const count=Math.floor((usable+spacing)/period);
 if(count<1)return null;
 const trailing=usable-count*tile-(count-1)*spacing;
 if(trailing<0||trailing>=period)return null;
 const start=i=>margin+i*period;
 const separators=[];
 for(let i=0;i<margin;i++)separators.push(i);
 for(let i=0;i<trailing;i++)separators.push(p.len-1-i);
 for(let i=1;i<count;i++)for(let k=0;k<spacing;k++)separators.push(start(i)-spacing+k);
 const boundaries=[];
 for(let i=1;i<count;i++){boundaries.push(start(i));if(spacing)boundaries.push(start(i)-spacing);}
 const purity=separators.length?separators.reduce((s,x)=>s+(p.clear[x]?1:p.uniform[x]?.8:0),0)/separators.length:null;
 // Precision: do this layout's own boundaries land on strong transitions?
 const coverage=boundaries.length?boundaries.filter(x=>p.edge[x]>=p.strong).length/boundaries.length:null;
 // Recall: does it explain every strong transition in the sheet? Without this, half the true
 // period scores as well as the period itself on a sheet whose size several sizes divide.
 const owned=new Set([...separators,...boundaries]);
 if(margin)owned.add(start(0));
 if(trailing)owned.add(p.len-trailing);
 const explained=p.strongLines.length?p.strongLines.filter(x=>owned.has(x)).length/p.strongLines.length:null;
 const repeated=coverage===null?(explained===null?.45:explained*.5):explained===null?coverage:coverage+explained?2*coverage*explained/(coverage+explained):0;
 const breakage=boundaries.length&&p.meanCross>.02?clamp(1-boundaries.reduce((s,x)=>s+p.cross[x],0)/boundaries.length/p.meanCross,0,1):null;
 let score=.55*repeated+.27*(purity??.5)+.18*(breakage??.5);
 if(trailing&&trailing!==margin)score-=.22;
 if(margin)score-=.02;
 if(spacing)score-=.02;
 if(count===1)score-=.12;
 return {tile,margin,spacing,count,trailing,score:clamp(score,0,1),coverage,explained,repeated,purity,breakage};
}
function axisRanking(p,extra){
 const out=[];
 for(const tile of axisSizes(p.len,extra))for(const margin of MARGINS)for(const spacing of SPACINGS){
  const o=axisOption(p,tile,margin,spacing);if(o)out.push(o);
 }
 return out.sort((a,b)=>b.score-a.score||a.tile-b.tile);
}
/** Ranked grid candidates. Nothing is applied; the caller shows them and the person chooses. */
export function detectGrid(data,w,h,{sizes=[],limit=8,axisLimit=24}={}){
 check(data,w,h);
 const px=axisProfile(data,w,h,'x'),py=axisProfile(data,w,h,'y');
 const xs=axisRanking(px,sizes).slice(0,axisLimit),ys=axisRanking(py,sizes).slice(0,axisLimit);
 const seen=new Set(),out=[];
 for(const a of xs)for(const b of ys){
  if(a.count*b.count>MAX_TILES)continue;
  const key=[a.tile,b.tile,a.margin,b.margin,a.spacing,b.spacing].join(':');
  if(seen.has(key))continue;seen.add(key);
  const square=a.tile===b.tile,common=COMMON_SIZES.includes(a.tile)&&COMMON_SIZES.includes(b.tile);
  out.push({tileWidth:a.tile,tileHeight:b.tile,marginX:a.margin,marginY:b.margin,spacingX:a.spacing,spacingY:b.spacing,
   cols:a.count,rows:b.count,count:a.count*b.count,trailingX:a.trailing,trailingY:b.trailing,
   score:clamp((a.score+b.score)/2+(square?.06:0)+(common?.04:0),0,1),
   evidence:{separators:pair(a.purity,b.purity),repeatedEdges:pair(a.repeated,b.repeated),
    boundaryEdges:pair(a.coverage,b.coverage),strongEdgesExplained:pair(a.explained,b.explained),contentStops:pair(a.breakage,b.breakage)}});
 }
 return out.sort((p,q)=>q.score-p.score||p.count-q.count).slice(0,limit);
}
const pair=(a,b)=>a==null&&b==null?null:((a??b)+(b??a))/2;
/** Exact tile rectangles for a grid. Throws rather than guessing when a tile would fall outside. */
export function tileRects({width,height,tileWidth,tileHeight,marginX=0,marginY=0,spacingX=0,spacingY=0,cols=0,rows=0}){
 for(const [name,v] of [['width',width],['height',height],['tileWidth',tileWidth],['tileHeight',tileHeight]])if(!isInt(v)||v<1)throw Error(`${name} must be a positive integer`);
 for(const [name,v] of [['marginX',marginX],['marginY',marginY],['spacingX',spacingX],['spacingY',spacingY]])if(!isInt(v)||v<0||v>256)throw Error(`${name} must be between 0 and 256`);
 const fit=(len,tile,margin,spacing)=>{const c=Math.floor((len-margin+spacing)/(tile+spacing));if(c<1)throw Error('No tile fits inside the image with these margins');return c;};
 const c=cols||fit(width,tileWidth,marginX,spacingX),r=rows||fit(height,tileHeight,marginY,spacingY);
 if(!isInt(c)||!isInt(r)||c<1||r<1)throw Error('Invalid column or row count');
 if(marginX+c*tileWidth+(c-1)*spacingX>width||marginY+r*tileHeight+(r-1)*spacingY>height)throw Error('The grid does not fit inside the image');
 if(c*r>MAX_TILES)throw Error(`At most ${MAX_TILES} tiles`);
 const rects=[];
 for(let row=0;row<r;row++)for(let col=0;col<c;col++)rects.push({index:row*c+col,col,row,
  x:marginX+col*(tileWidth+spacingX),y:marginY+row*(tileHeight+spacingY),w:tileWidth,h:tileHeight});
 return {cols:c,rows:r,count:c*r,tileWidth,tileHeight,marginX,marginY,spacingX,spacingY,rects};
}
export const tileName=(i,count,prefix='tile')=>`${prefix}-${String(i).padStart(Math.max(3,String(count-1).length),'0')}`;
/** Export envelope (docs/GAME-LABS.md) plus the grid and per-tile index/col/row a tile map needs. */
export function sliceMetadata(grid,{image='tileset.png',width,height,toolVersion='1',engineTarget='generic',tiles=null}={}){
 const list=tiles||grid.rects.map(r=>({...r,name:tileName(r.index,grid.count)+'.png'}));
 return {meta:{tool:'nerulio-tile-lab',toolVersion,schemaVersion:1,engineTarget,image,size:{w:width,h:height}},
  tileSet:{tileSize:{w:grid.tileWidth,h:grid.tileHeight},margins:{x:grid.marginX,y:grid.marginY},
   separation:{x:grid.spacingX,y:grid.spacingY},columns:grid.cols,rows:grid.rows,count:list.length},
  frames:Object.fromEntries(list.map(t=>[t.name,{page:0,rect:{x:t.x,y:t.y,w:t.w,h:t.h},rotated:false,aliasOf:t.aliasOf??null,
   sourceSize:{w:t.w,h:t.h},offset:{x:0,y:0},pivot:{x:.5,y:.5},duration:null,tag:t.tag||'',boxes:[],collision:[],
   tile:{index:t.index,col:t.col,row:t.row}}]))};
}
/* ---- tile comparison ---- */
const FNV=16777619;
export function hashRGBA(data){
 let hash=2166136261;
 for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],FNV);
 return (hash>>>0).toString(16).padStart(8,'0');
}
export function cropRGBA(data,w,h,rect){
 check(data,w,h);
 if(rect.x<0||rect.y<0||rect.w<1||rect.h<1||rect.x+rect.w>w||rect.y+rect.h>h)throw Error('Frame is outside the image');
 const out=new Uint8ClampedArray(rect.w*rect.h*4);
 for(let y=0;y<rect.h;y++){const from=((rect.y+y)*w+rect.x)*4;out.set(data.subarray(from,from+rect.w*4),y*rect.w*4);}
 return out;
}
export function rectHash(data,w,h,rect){return hashRGBA(cropRGBA(data,w,h,rect));}
export function isBlank(data,w,h,rect,threshold=0){
 const tile=cropRGBA(data,w,h,rect);
 for(let i=3;i<tile.length;i+=4)if(tile[i]>threshold)return false;
 return true;
}
/** Difference between two equally sized tiles: per-pixel worst channel, averaged and maximal.
 * `mean` is in 0..255 so a threshold reads as "on average N levels per channel". */
export function tileDifference(a,b){
 if(a.length!==b.length)throw Error('Tiles must have the same size to be compared');
 let sum=0,max=0;
 for(let i=0;i<a.length;i+=4){
  let d=0;
  for(let k=0;k<4;k++)d=Math.max(d,Math.abs(a[i+k]-b[i+k]));
  sum+=d;if(d>max)max=d;
 }
 const pixels=a.length/4;
 return {mean:sum/pixels,max,pixels};
}
/** Exact duplicates, by hash. Groups keep source order; the first index is the representative. */
export function duplicateGroups(hashes){
 const by=new Map();
 hashes.forEach((hash,index)=>{if(!by.has(hash))by.set(hash,[]);by.get(hash).push(index);});
 return [...by.values()].filter(g=>g.length>1);
}
/** Near duplicates: clustered against group representatives with a bounded pixel difference.
 * This is a threshold on pixels, not a perceptual judgement — it is labelled as such in the UI. */
export function nearDuplicateGroups(tiles,{maxMean=2,maxPixel=32,limit=2048}={}){
 if(tiles.length>limit)throw Error(`Near-duplicate comparison is limited to ${limit} tiles`);
 const groups=[];
 outer:for(let i=0;i<tiles.length;i++){
  for(const g of groups){
   const d=tileDifference(tiles[g.indices[0]],tiles[i]);
   if(d.mean<=maxMean&&d.max<=maxPixel){g.indices.push(i);g.worst=Math.max(g.worst,d.mean);continue outer;}
  }
  groups.push({indices:[i],worst:0});
 }
 return groups.filter(g=>g.indices.length>1);
}
/* ---- variants ---- */
export const VARIANTS=Object.freeze(['rot90','rot180','rot270','flipX','flipY']);
export function transformRGBA(data,w,h,kind){
 check(data,w,h);
 const turned=kind==='rot90'||kind==='rot270',ow=turned?h:w,oh=turned?w:h,out=new Uint8ClampedArray(data.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const from=(y*w+x)*4;
  let tx=x,ty=y;
  if(kind==='rot90'){tx=h-1-y;ty=x;}
  else if(kind==='rot180'){tx=w-1-x;ty=h-1-y;}
  else if(kind==='rot270'){tx=y;ty=w-1-x;}
  else if(kind==='flipX')tx=w-1-x;
  else if(kind==='flipY')ty=h-1-y;
  else if(kind!=='none')throw Error(`Unknown variant ${kind}`);
  out.set(data.subarray(from,from+4),(ty*ow+tx)*4);
 }
 return {kind,data:out,w:ow,h:oh};
}
/** Variants of one tile with symmetric ones dropped: a tile with mirror symmetry produces no
 * flipX, a four-fold symmetric tile produces nothing at all. */
export function variantSet(data,w,h,kinds=VARIANTS){
 const seen=new Set([hashRGBA(data)]),out=[];
 for(const kind of kinds){
  const v=transformRGBA(data,w,h,kind),hash=hashRGBA(v.data);
  if(seen.has(hash))continue;
  seen.add(hash);out.push({...v,hash});
 }
 return out;
}
