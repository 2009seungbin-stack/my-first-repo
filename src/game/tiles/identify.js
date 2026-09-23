/** Which autotile layout is this sheet, and which bits does each tile carry? Pure (RGBA in,
 * numbers out); runs in a worker in the Studio.
 *
 * The idea: a layout is a claim about which tiles may sit next to each other. If tile A's mask
 * says "my right side connects" and B's says "my left side connects" (and the corners at both ends
 * agree), the layout claims A|B is a seam-free pair; if only one of them connects, it claims the
 * pair shows a visible break. Real art keeps those promises and a wrong layout breaks them, so
 * each candidate is scored by how well the pixel difference across the boundary separates the
 * pairs it calls continuous from the pairs it calls broken (the area under the ROC curve: 1.0 =
 * every continuous pair is smoother than every broken one, 0.5 = no information). Boundary pixels
 * only: numbers printed in the middle of template tiles do not matter.
 *
 * Nothing here decides for the user: the result is a ranked list with the score, the margin to the
 * runner-up, and counts of cells that disagree (missing / extra tiles), and 'low' confidence is
 * reported as such. */
import {LAYOUTS,placeLayout,SOURCES} from './layouts.js';
import {MODE_IDX,CORNER_SIDES,fromBlob,requiredPatterns} from './patterns.js';
import {assembleSource} from './generator.js';
// ------------------------------------------------------------------ sheet access
export function sheetGrid(img,{w,h,ox=0,oy=0,sx=0,sy=0,cols=0,rows=0}){
 const C=cols||Math.floor((img.width-ox+sx)/(w+sx)),R=rows||Math.floor((img.height-oy+sy)/(h+sy));
 return {w,h,ox,oy,sx,sy,cols:Math.max(0,C),rows:Math.max(0,R)};
}
/** Lazily cut tiles of a sheet; `tile(c,r)` → {data,w,h} (RGBA copy) or null outside. */
export function tileSource(img,grid){
 const g=sheetGrid(img,grid),cache=new Map();
 const tile=(c,r)=>{
  if(c<0||r<0||c>=g.cols||r>=g.rows)return null;
  const k=r*g.cols+c;if(cache.has(k))return cache.get(k);
  const x0=g.ox+c*(g.w+g.sx),y0=g.oy+r*(g.h+g.sy),out=new Uint8ClampedArray(g.w*g.h*4);
  for(let y=0;y<g.h;y++){const s=((y0+y)*img.width+x0)*4;out.set(img.data.subarray(s,s+g.w*4),y*g.w*4);}
  const t={data:out,w:g.w,h:g.h};cache.set(k,t);return t;
 };
 const blank=(c,r)=>{const t=tile(c,r);if(!t)return true;for(let i=3;i<t.data.length;i+=4)if(t.data[i])return false;return true;};
 return {grid:g,tile,blank};
}
/** Premultiplied line of pixels (so fully transparent pixels compare equal whatever their RGB). */
function line(t,side,from=0,to=null){
 const n=side==='top'||side==='bottom'?t.w:t.h;to=to??n;const out=new Float32Array((to-from)*4);
 for(let i=from;i<to;i++){
  const x=side==='left'?0:side==='right'?t.w-1:i,y=side==='top'?0:side==='bottom'?t.h-1:i,p=(y*t.w+x)*4,a=t.data[p+3]/255,o=(i-from)*4;
  out[o]=t.data[p]*a;out[o+1]=t.data[p+1]*a;out[o+2]=t.data[p+2]*a;out[o+3]=t.data[p+3];
 }
 return out;
}
/** Mean per-pixel difference of two lines, 0…255 (alpha counts double). */
export function lineDistance(a,b){
 if(a.length!==b.length||!a.length)return 255;
 let s=0;for(let i=0;i<a.length;i+=4)s+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+2*Math.abs(a[i+3]-b[i+3]))/5;
 return s/(a.length/4);
}
/** AUC: probability that a "continuous" pair is smoother than a "broken" one (ties count half). */
export function auc(good,bad){
 if(!good.length||!bad.length)return null;
 const all=[...good.map(v=>[v,1]),...bad.map(v=>[v,0])].sort((a,b)=>a[0]-b[0]);
 let rankSum=0,i=0;
 while(i<all.length){let j=i;while(j<all.length&&all[j][0]===all[i][0])j++;const r=(i+j+1)/2;for(let k=i;k<j;k++)if(all[k][1])rankSum+=r;i=j;}
 const n1=good.length,n0=bad.length;
 return 1-(rankSum-n1*(n1+1)/2)/(n1*n0);
}
const on=(p,i)=>p[i+1]>=0;
function histAUC(good,bad,ng,nb){
 if(!ng||!nb)return null;
 let below=0,sum=0;// P(good < bad) + ½ P(equal)
 for(let i=0;i<good.length;i++){sum+=bad[i]*(below+good[i]/2);below+=good[i];}
 return sum/(ng*nb);
}
/** What a layout claims about the boundary between A and B (A left of B: dir 'h'; A above B:
 * 'v'), per boundary segment: {start, mid, end} (start = top/left end of the shared boundary).
 * 1 = continuous, 0 = a visible break, null = no claim (both sides open). Corner segments carry
 * the inner/outer corner claims; the middle only says whether the sides connect. */
export function pairClass(mode,A,B,dir,model='rim'){
 if(mode==='corners'){
  // halves: each half of the shared boundary belongs to one corner point
  if(dir==='h')return {start:on(A,1)===on(B,7)?1:0,end:on(A,3)===on(B,5)?1:0};
  return {start:on(A,5)===on(B,7)?1:0,end:on(A,3)===on(B,1)?1:0};
 }
 // Each end of a boundary shows a rim unless the quarter behind it is full (its two sides and, for
 // blob sets, the diagonal connect): an inner-corner notch, an open top and an open side all put
 // rim pixels there. The middle shows a rim exactly when that side is open. Segments meet cleanly
 // when both tiles show the same thing there.
 const a=dir==='h'?on(A,2):on(A,4),b=dir==='h'?on(B,6):on(B,0);
 if(!a&&!b)return {start:null,mid:null,end:null};
 if(model==='map'){
  // The stricter reading: a pair that can never meet in a real map is a break everywhere, and
  // the ends are judged by whether both quarters are full.
  if(a!==b)return {start:0,mid:0,end:0};
  if(mode==='sides')return {start:null,mid:1,end:null};
  const full=(p,s,c)=>on(p,s)&&on(p,c);
  if(dir==='h')return {start:full(A,0,1)===full(B,0,7)?1:0,mid:1,end:full(A,4,3)===full(B,4,5)?1:0};
  return {start:full(A,6,5)===full(B,6,7)?1:0,mid:1,end:full(A,2,3)===full(B,2,1)?1:0};
 }
 const d=(p,i)=>mode==='sides'||on(p,i);
 const q=(p,side,s,c)=>on(p,side)&&on(p,s)&&d(p,c);
 const cls=(x,y)=>x===y?1:0;
 if(dir==='h')return {start:cls(q(A,2,0,1),q(B,6,0,7)),mid:cls(a,b),end:cls(q(A,2,4,3),q(B,6,4,5))};
 return {start:cls(q(A,4,6,5),q(B,0,6,7)),mid:cls(a,b),end:cls(q(A,4,2,3),q(B,0,2,1))};
}/** Boundary lines of a list of tiles, computed once. */
export function edgeLines(tiles){return tiles.map(t=>t?{left:line(t,'left'),right:line(t,'right'),top:line(t,'top'),bottom:line(t,'bottom'),w:t.w,h:t.h}:null);}
function segments(len,mode){
 if(mode==='corners'){const m=len>>1;return {start:[0,m],end:[len-m,len]};}
 const k=Math.max(1,Math.round(len/4));return {start:[0,k],mid:[k,len-k],end:[len-k,len]};
}
/** Score one assignment of patterns to tiles: entries [{tile index, pattern}] over `lines`. */
export function scoreAssignment(mode,entries,lines,options={}){
 if(options.quick)return scoreWith(mode,entries,lines,'rim',options);
 // Two readings of what a boundary should look like (rims everywhere vs. only where maps put
 // them); art follows one or the other, so the better separation is the layout's score.
 const r=scoreWith(mode,entries,lines,'rim',options);if(mode==='corners')return r;
 const m=scoreWith(mode,entries,lines,'map',options);
 return (m.auc??0)>(r.auc??0)?m:r;
}
function scoreWith(mode,entries,lines,model,{maxPairs=6000,cache=null}={}){
 // distances are 0…255: count them in quarter-level bins, AUC in one pass (no sorting)
 const good=new Uint32Array(1025),bad=new Uint32Array(1025);let ng=0,nb=0,sg=0,sb=0;
 const n=entries.length,total=n*n*2,sample=total>maxPairs;
 // every pair when affordable, otherwise a fixed pseudo-random sample (same sample every run)
 let s=0x9e3779b9;const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
 for(let q=0,count=sample?maxPairs:total;q<count;q++){
  const idx=sample?Math.floor(rnd()*total):q,i=Math.floor(idx/(2*n)),j=Math.floor(idx/2)%n,dir=idx%2?'v':'h';
  const A=entries[i],B=entries[j],cls=pairClass(mode,A.pattern,B.pattern,dir,model);
  const la=lines[A.tile],lb=lines[B.tile];if(!la||!lb)continue;
  const a=dir==='h'?la.right:la.bottom,b=dir==='h'?lb.left:lb.top,segs=segments(a.length/4,mode);
  for(const [part,[s,e]] of Object.entries(segs)){
   const c=cls[part];if(c==null||e<=s)continue;
   let d;const key=cache&&(A.tile*65536+B.tile)*8+(dir==='h'?0:4)+(part==='start'?0:part==='mid'?1:2);
   if(cache&&cache.has(key))d=cache.get(key);else{d=lineDistance(a.subarray(s*4,e*4),b.subarray(s*4,e*4));cache?.set(key,d);}
   const bin=Math.min(1024,Math.round(d*4));if(c){good[bin]++;ng++;sg+=d;}else{bad[bin]++;nb++;sb+=d;}
  }
 }
 return {auc:histAUC(good,bad,ng,nb),good:ng,bad:nb,goodMean:ng?sg/ng:null,badMean:nb?sb/nb:null,model};
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
// ------------------------------------------------------------------ layout identification
/** Ranked layout candidates for a sheet cut with `grid`.
 * @returns {candidates:[{layoutId, family, mode, col, row, score, auc, margin, missing, extra,
 *   cells, confidence, reasons}], blocks:[…same, every non-overlapping good placement…]} */
export function identifyLayout(img,grid,{maxTiles=1024,layouts=LAYOUTS,sources=true}={}){
 const src=tileSource(img,grid),g=src.grid,count=g.cols*g.rows;
 if(!count)return {candidates:[],blocks:[],reason:'no-cells',grid:g};
 if(count>maxTiles)return {candidates:[],blocks:[],reason:'too-many-tiles',grid:g};
 const tiles=[],blank=[];
 for(let r=0;r<g.rows;r++)for(let c=0;c<g.cols;c++){const b=src.blank(c,r);blank.push(b);tiles.push(b?null:src.tile(c,r));}
 const lines=edgeLines(tiles),nonBlank=blank.filter(b=>!b).length,cache=new Map();
 const all=[];
 for(const L of layouts){
  if(L.cols>g.cols||L.rows>g.rows)continue;
  const exact=L.cols===g.cols&&L.rows===g.rows;
  const offs=[];
  for(let r0=0;r0+L.rows<=g.rows;r0++)for(let c0=0;c0+L.cols<=g.cols;c0++){
   // Anywhere on small sheets; on large sheets only on the layout's own block grid.
   if(count>400&&(c0%L.cols||r0%L.rows))continue;offs.push([c0,r0]);
  }
  for(const [c0,r0] of offs){
   const cells=placeLayout(L,c0,r0);let missing=0,extra=0;const entries=[];
   for(const cell of cells){const i=cell.row*g.cols+cell.col;if(blank[i])missing++;else entries.push({tile:i,pattern:cell.pattern,col:cell.col,row:cell.row});}
   for(let r=r0;r<r0+L.rows;r++)for(let c=c0;c<c0+L.cols;c++)if(L.cells[r-r0][c-c0]==null&&!blank[r*g.cols+c])extra++;
   if(entries.length<Math.max(4,cells.length*.5))continue;
   // quick pass on a sample of pairs; only the best few placements of each layout get the full pass
   const s=scoreAssignment(L.mode,entries,lines,offs.length>4?{cache,maxPairs:240,quick:true}:{cache});if(s.auc==null)continue;s.entries=entries;
   // Missing tiles cost more than extras (an extra may be a decoration the layout leaves free).
   const score=s.auc-0.5*missing/cells.length-0.1*extra/cells.length;
   all.push({layoutId:L.id,family:L.family,mode:L.mode,col:c0,row:r0,cols:L.cols,rows:L.rows,score,auc:s.auc,missing,extra,cells:cells.length,model:s.model,claims:new Map(cells.map(x=>[x.row*g.cols+x.col,x.pattern.join()])),
    covers:exact?1:(L.cols*L.rows)/count,pairs:s.good+s.bad,goodMean:s.goodMean,badMean:s.badMean,_entries:offs.length>4?entries:null});
  }
  // full pass for the best placements of this layout
  const mine=all.filter(x=>x.layoutId===L.id&&x._entries).sort((a,b)=>b.score-a.score);
  for(const x of mine.slice(0,6)){const s=scoreAssignment(L.mode,x._entries,lines,{cache});if(s.auc==null)continue;x.score+=s.auc-x.auc;x.auc=s.auc;x.pairs=s.good+s.bad;x.goodMean=s.goodMean;x.badMean=s.badMean;}
  for(const x of mine.slice(6))x.quick=true;
  for(const x of mine)delete x._entries;
 }
 if(sources)for(const S of SOURCES){
  if(S.cols>g.cols||S.rows>g.rows)continue;
  // On the source's own block grid only: any 2×2 corner of a bigger set is a tiny valid "box".
  for(let r0=0;r0+S.rows<=g.rows;r0+=S.rows)for(let c0=0;c0+S.cols<=g.cols;c0+=S.cols){
   let empty=false;for(let r=r0;r<r0+S.rows&&!empty;r++)for(let c=c0;c<c0+S.cols;c++)if(blank[r*g.cols+c]){empty=true;break;}
   if(empty)continue;
   let set;try{set=assembleSource(S.id,(c,r)=>src.tile(c0+c,r0+r),{w:g.w,h:g.h});}catch{continue;}
   const ents=set.tiles.map((t,i)=>({tile:i,pattern:t.pattern}));
   const s=scoreAssignment(set.mode,ents,edgeLines(set.tiles.map(t=>t.image)));if(s.auc==null)continue;
   // An assembled set is seam-consistent by construction when the pieces are where the format
   // puts them; a sheet read in the wrong format mixes rims into interiors and scores low.
   all.push({layoutId:S.id,family:'source',mode:set.mode,col:c0,row:r0,cols:S.cols,rows:S.rows,score:s.auc,auc:s.auc,missing:0,extra:0,cells:S.cols*S.rows,
    covers:(S.cols*S.rows)/count,pairs:s.good+s.bad,goodMean:s.goodMean,badMean:s.badMean,source:true});
  }
 }
 // Prefer placements that explain the whole sheet when scores are close.
 for(const c of all)c.rank=c.score+0.04*Math.min(1,c.covers*(nonBlank?count/nonBlank:1));
 all.sort((a,b)=>b.rank-a.rank);
 // best placement per layout for the candidate list
 const seen=new Set(),candidates=[];
 for(const c of all){if(seen.has(c.layoutId))continue;seen.add(c.layoutId);candidates.push(c);}
 const top=candidates[0];
 // A smaller layout that says the same thing about the same cells (the 3×3 box inside a 16-edge
 // set) is not a rival; anything that claims something else about the sheet is.
 const agrees=(c,o)=>!!c.claims&&!!o.claims&&[...o.claims].every(([k,v])=>c.claims.get(k)===v);
 for(const c of candidates){
  const rival=candidates.find(o=>o!==c&&!agrees(c,o)&&!agrees(o,c));
  c.margin=rival?c.score-rival.score:c.score-0.5;
  c.confidence=confidenceOf(c,c===top?c.margin:null);
 }
 for(const c of all)delete c.claims;
 // Format hints the pixels cannot give: an RPG Maker A2/A4 sheet whose pieces all look alike
 // (a seamless floor) scores 0.5 on seams, but its size is the format's own.
 const hints=[];
 const A2={768:576,512:384},A4={768:720,512:480};
 if(A2[img.width]===img.height&&(g.w===img.width/16))hints.push({layoutId:'rpgmaker-a2',reason:'size',detail:`${img.width}×${img.height} = RPG Maker A2 sheet: 8×4 blocks of 2×3 tiles at ${g.w} px`});
 if(A4[img.width]===img.height&&(g.w===img.width/16))hints.push({layoutId:'rpgmaker-a4',reason:'size',detail:`${img.width}×${img.height} = RPG Maker A4 sheet: 8 columns × 3 pairs of ceiling (2×3, A2 layout) + wall (2×2) blocks at ${g.w} px`});
 // every good, non-overlapping placement (several blocks on one sheet: dual-grid packs, RPG Maker)
 const blocks=[],used=new Set();
 for(const c of all){
  if(c.auc<0.9||c.missing>0)continue;
  const cellsOf=[];for(let r=c.row;r<c.row+c.rows;r++)for(let q=c.col;q<c.col+c.cols;q++)cellsOf.push(r*g.cols+q);
  if(cellsOf.some(i=>used.has(i)))continue;
  cellsOf.forEach(i=>used.add(i));blocks.push({...c,confidence:confidenceOf(c,null)});
 }
 return {candidates:candidates.slice(0,6),blocks,hints,grid:g,nonBlank};
}
function confidenceOf(c,margin){
 if(c.auc>=0.97&&c.missing===0&&(margin==null||margin>=0.03))return 'high';
 if(c.auc>=0.88&&c.missing<=1)return 'medium';
 return 'low';
}
// ------------------------------------------------------------------ several blocks, several terrains
/** Sheets with one block per terrain pair (dual-grid packs): the block's all-terrain tile and its
 * no-terrain tile are the two terrains' plain fills. Plain fills that are the same picture across
 * blocks are the same terrain. Returns {terrains:[{col,row}], blocks:[{...block, a, b}]}
 * where a = the terrain the layout's bits describe and b = the other one (-1 when the block has
 * no plain "outside" tile, e.g. a blob set over transparency). */
export function blockTerrains(img,grid,blocks,{tolerance=3}={}){
 const src=tileSource(img,grid),terrains=[],out=[];
 const same=(p,q)=>{const a=src.tile(p.col,p.row),b=src.tile(q.col,q.row);if(!a||!b)return false;let s=0;for(let i=0;i<a.data.length;i++)s+=Math.abs(a.data[i]-b.data[i]);return s/a.data.length<=tolerance;};
 const terrainOf=cell=>{if(!cell||src.blank(cell.col,cell.row))return -1;let i=terrains.findIndex(t=>same(t,cell));if(i<0){terrains.push(cell);i=terrains.length-1;}return i;};
 for(const b of blocks){
  const L=LAYOUTS.find(l=>l.id===b.layoutId);if(!L){out.push({...b,a:0,b:-1});continue;}
  const fullMask=L.kind==='blob'?255:15;
  let full=null,none=null;
  for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){const m=L.cells[r][c];if(m===fullMask&&!full)full={col:b.col+c,row:b.row+r};if(m===0&&!none)none={col:b.col+c,row:b.row+r};}
  const a=terrainOf(full),bb=L.kind==='blob'?-1:terrainOf(none);
  out.push({...b,a:Math.max(0,a),b:bb===a?-1:bb});
 }
 return {terrains,blocks:out};
}// ------------------------------------------------------------------ bit suggestion (no layout)
/** Otsu split of a list of distances: {threshold, separation 0…1}. */
export function split(values){
 const v=values.filter(Number.isFinite).sort((a,b)=>a-b),n=v.length;if(n<4)return null;
 const pre=new Float64Array(n+1),pre2=new Float64Array(n+1);for(let i=0;i<n;i++){pre[i+1]=pre[i]+v[i];pre2[i+1]=pre2[i]+v[i]*v[i];}
 let best=null;
 for(let i=1;i<n;i++){
  if(v[i]===v[i-1])continue;
  const m0=pre[i]/i,m1=(pre[n]-pre[i])/(n-i),w0=i/n,between=w0*(1-w0)*(m1-m0)**2;
  if(!best||between>best.between)best={between,i,threshold:(v[i-1]+v[i])/2,m0,m1,n0:i,n1:n-i};
 }
 if(!best)return {threshold:v[n-1]+1,separation:0,single:true};
 const i=best.i,var0=pre2[i]/i-best.m0**2,var1=(pre2[n]-pre2[i])/(n-i)-best.m1**2;
 const spread=Math.max(1,Math.sqrt(Math.max(0,var0))+Math.sqrt(Math.max(0,var1)));
 return {...best,separation:Math.min(1,(best.m1-best.m0)/(spread*4))};
}/** Guess the "full" interior tile: the most seam-free tile when repeated next to itself. */
export function guessFullTile(tiles){
 let best=null;
 tiles.forEach((t,i)=>{
  if(!t)return;let opaque=0;for(let k=3;k<t.data.length;k+=4)if(t.data[k]>8)opaque++;
  if(opaque<t.w*t.h*.5)return;
  const wrap=(lineDistance(line(t,'right'),line(t,'left'))+lineDistance(line(t,'bottom'),line(t,'top')))/2;
  const cover=opaque/(t.w*t.h);
  const s=wrap-8*cover;
  if(!best||s<best.s)best={index:i,s,wrap,cover};
 });
 return best;
}
/** Measurements used by suggestion and by the art check: for every tile and position, how
 * different the tile's boundary is from the full tile's matching boundary (small = connects). */
function measurements(tiles,full){
 const F=tiles[full];if(!F)return null;
 const w=F.w,h=F.h,kx=Math.max(1,Math.round(w/4)),ky=Math.max(1,Math.round(h/4));
 const fL=line(F,'left'),fR=line(F,'right'),fT=line(F,'top'),fB=line(F,'bottom');
 const seg=(l,a,b)=>l.subarray(a*4,b*4);
 return tiles.map(t=>{
  if(!t||t.w!==w||t.h!==h)return null;
  const L=line(t,'left'),R=line(t,'right'),T=line(t,'top'),B=line(t,'bottom');
  // sides: the middle part of each boundary against the full tile's opposite boundary
  const side=[lineDistance(seg(T,kx,w-kx),seg(fB,kx,w-kx)),lineDistance(seg(R,ky,h-ky),seg(fL,ky,h-ky)),
   lineDistance(seg(B,kx,w-kx),seg(fT,kx,w-kx)),lineDistance(seg(L,ky,h-ky),seg(fR,ky,h-ky))];
  // corners: both short segments that meet at the corner
  const corner=[
   (lineDistance(seg(T,w-kx,w),seg(fB,w-kx,w))+lineDistance(seg(R,0,ky),seg(fL,0,ky)))/2,
   (lineDistance(seg(B,w-kx,w),seg(fT,w-kx,w))+lineDistance(seg(R,h-ky,h),seg(fL,h-ky,h)))/2,
   (lineDistance(seg(B,0,kx),seg(fT,0,kx))+lineDistance(seg(L,h-ky,h),seg(fR,h-ky,h)))/2,
   (lineDistance(seg(T,0,kx),seg(fB,0,kx))+lineDistance(seg(L,0,ky),seg(fR,0,ky)))/2];
  return {side,corner};// side: n,e,s,w · corner: ne,se,sw,nw
 });
}
const SIDE_OF=[0,2,4,6],CORNER_OF=[1,3,5,7];
/** Suggest a pattern for every tile from its pixels alone (no layout). The full tile is guessed
 * unless given. Each bit carries a confidence (distance from the split, 0…1).
 * @returns {full, measurable, reason?, tiles:[{pattern, confidence:[8]}|null], sideSplit, cornerSplit} */
export function suggestBits(tiles,{full=null,mode='corners-and-sides',terrain=0}={}){
 if(full!=null)return suggestWith(tiles,full,mode,terrain);
 // Which tile is the interior? On opaque templates the background tile is just as seamless as the
 // terrain tile, and measuring against it inverts every bit. The reference that explains the most
 // distinct required combinations is the terrain.
 const need=new Set(requiredPatterns(mode,terrain).map(p=>p.join()));
 // A wrong reference can still give a tidy-looking set (a corridor tile mirrors one axis), so every
 // candidate's result is also checked against the seams: the right reading predicts which tiles
 // join cleanly.
 const lines=edgeLines(tiles),cache=new Map(),runs=[];
 for(const c of fullCandidates(tiles,64)){
  const s=suggestWith(tiles,c,mode,terrain);if(!s.measurable)continue;
  const distinct=new Set(s.tiles.filter(Boolean).map(t=>t.pattern.join()).filter(k=>need.has(k))).size;
  runs.push({s,distinct});
 }
 if(!runs.length)return {measurable:false,reason:'no-full-tile',tiles:tiles.map(()=>null)};
 const most=Math.max(...runs.map(r=>r.distinct));
 let best=null;
 for(const r of runs.filter(r=>r.distinct>=most*.8)){
  const entries=r.s.tiles.map((t,i)=>t&&{tile:i,pattern:t.pattern}).filter(Boolean);
  const seam=scoreAssignment(mode,entries,lines,{cache}).auc??0;
  if(!best||seam>best.seam+1e-9||Math.abs(seam-best.seam)<=1e-9&&r.distinct>best.distinct)best={...r.s,distinct:r.distinct,seam};
 }
 return best;
}
function fullCandidates(tiles,n){
 const out=[];
 tiles.forEach((t,i)=>{
  if(!t)return;let opaque=0;for(let k=3;k<t.data.length;k+=4)if(t.data[k]>8)opaque++;
  if(opaque<t.w*t.h*.5)return;
  const wrap=(lineDistance(line(t,'right'),line(t,'left'))+lineDistance(line(t,'bottom'),line(t,'top')))/2;
  out.push({i,s:wrap-8*opaque/(t.w*t.h)});
 });
 return out.sort((a,b)=>a.s-b.s).slice(0,n).map(x=>x.i);
}
function suggestWith(tiles,f,mode,terrain){
 const m=measurements(tiles,f);
 const sides=m.flatMap(x=>x?x.side:[]),corners=m.flatMap(x=>x?x.corner:[]);
 const ss=split(sides),cs=split(corners);
 if(!ss||ss.separation<0.15)return {measurable:false,reason:'sides-look-alike',full:f,tiles:tiles.map(()=>null),sideSplit:ss};
 const conf=(d,s)=>s?Math.max(0,Math.min(1,Math.abs(d-s.threshold)/Math.max(1,(s.m1-s.m0)/2))):0;
 const out=m.map(x=>{
  if(!x)return null;
  const p=[terrain,-1,-1,-1,-1,-1,-1,-1,-1],c=new Array(8).fill(0);
  x.side.forEach((d,k)=>{const i=SIDE_OF[k];c[i]=conf(d,ss);if(d<=ss.threshold&&MODE_IDX[mode].includes(i))p[i+1]=terrain;});
  x.corner.forEach((d,k)=>{
   const i=CORNER_OF[k],[s1,s2]=CORNER_SIDES[i];
   if(mode==='corners'){const sp=cs||ss;c[i]=conf(d,sp);if(d<=sp.threshold)p[i+1]=terrain;return;}
   if(mode!=='corners-and-sides')return;
   // a corner only counts when both of its sides connect; otherwise it is decided by them
   if(p[s1+1]<0||p[s2+1]<0){c[i]=Math.min(c[s1],c[s2]);return;}
   const sp=cs&&cs.separation>=0.15?cs:ss;c[i]=conf(d,sp);if(d<=sp.threshold)p[i+1]=terrain;
  });
  return {pattern:p,confidence:c};
 });
 return {measurable:true,full:f,tiles:out,sideSplit:ss,cornerSplit:cs};
}
/** Tiles whose art contradicts the bits they were given. Supervised: the given bits say which
 * boundaries should connect; the split between the two groups is measured, and only bits clearly
 * on the wrong side (beyond the middle of the other group) are reported. Returns
 * {measurable, reason?, auc, mismatches:[{index, positions:[{pos, expected, distance}]}]}. */
export function artCheck(tiles,patterns,{mode='corners-and-sides'}={}){
 const fullIdx=patterns.findIndex((p,i)=>p&&tiles[i]&&p[0]>=0&&MODE_IDX[mode].every(k=>p[k+1]===p[0]));
 if(fullIdx<0)return {measurable:false,reason:'no-full-tile',mismatches:[]};
 const m=measurements(tiles,fullIdx);
 const groups={side:{on:[],off:[]},corner:{on:[],off:[]}};
 const items=[];
 m.forEach((x,i)=>{
  const p=patterns[i];if(!x||!p||p[0]<0)return;
  const t=p[0];
  for(let k=0;k<4;k++){const pos=SIDE_OF[k];if(!MODE_IDX[mode].includes(pos))continue;const want=p[pos+1]===t;(want?groups.side.on:groups.side.off).push(x.side[k]);items.push({i,pos,kind:'side',want,d:x.side[k]});}
  for(let k=0;k<4;k++){const pos=CORNER_OF[k];if(!MODE_IDX[mode].includes(pos))continue;
   if(mode==='corners-and-sides'){const [s1,s2]=CORNER_SIDES[pos];if(p[s1+1]!==t||p[s2+1]!==t)continue;}
   const want=p[pos+1]===t;(want?groups.corner.on:groups.corner.off).push(x.corner[k]);items.push({i,pos,kind:'corner',want,d:x.corner[k]});}
 });
 const stat={};
 for(const [k,g] of Object.entries(groups)){
  const a=auc(g.on,g.off);
  stat[k]={auc:a,on:median(g.on),off:median(g.off),n:g.on.length+g.off.length,usable:a!=null&&a>=0.8&&median(g.off)-median(g.on)>=6};
 }
 if(!stat.side.usable&&!stat.corner.usable)return {measurable:false,reason:'connected-and-open-look-alike',auc:stat.side.auc,mismatches:[]};
 const by=new Map();
 for(const it of items){
  const s=stat[it.kind];if(!s.usable)continue;
  const mid=(s.on+s.off)/2;
  // clearly wrong: past the midpoint AND closer to the other group's median than to its own
  const wrong=it.want?it.d>mid&&Math.abs(it.d-s.off)<Math.abs(it.d-s.on):it.d<mid&&Math.abs(it.d-s.on)<Math.abs(it.d-s.off);
  if(!wrong)continue;
  if(!by.has(it.i))by.set(it.i,[]);
  by.get(it.i).push({pos:it.pos,expected:it.want?'connected':'open',distance:+it.d.toFixed(1)});
 }
 return {measurable:true,full:fullIdx,side:stat.side,corner:stat.corner,mismatches:[...by].map(([index,positions])=>({index,positions}))};
}
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[s.length>>1];};
export {fromBlob};
