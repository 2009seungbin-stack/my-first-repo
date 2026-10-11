/** Sheet splitting (시트 나누기): an AI "sticker sheet" / "emoji grid" → one picture per sticker.
 *
 * 'auto' works on every image anew (that is what lets a 6×4 recipe run on a 5×4 sheet):
 *   1. at ≤ 512 px, the backdrop is the picture's border colour (or transparency); foreground =
 *      pixels farther than `tolerance` from it
 *   2. the foreground is dilated by ~0.6 % of the long side so anti-aliased outlines and a sticker's
 *      loose bits (sweat drops, sparkles) hold together, then labelled (8-connected)
 *   3. small pieces join the nearest large one when close (a caption under a face), specks are dropped
 *   4. cells are ordered in reading order (rows by centre line), so the grid shape is reported as cols×rows
 *   5. each cell is cut at full resolution with a little padding; pixels of a neighbouring sticker that
 *      reach into the box are painted with the backdrop, so the next step (bg.remove) clears them
 * 'grid' divides the content box into cols×rows equal cells (sheets without gutters, e.g. a Midjourney 2×2).
 * When 'auto' finds one piece covering the sheet but the recipe expects several, it falls back to the grid. */
import {adaptiveTolerance,borderColor,contentBounds,cropRect,limitSide} from './raster.js';
import {distanceSquared} from './border.js';

const WORK=512;
/** 8-connected labelling (union-find over runs is overkill at 512 px: a stack flood is enough). */
function label(mask,w,h){
 const lab=new Int32Array(w*h),comps=[];let n=0;const stack=[];
 for(let s=0;s<w*h;s++){
  if(!mask[s]||lab[s])continue;n++;const c={id:n,x0:w,y0:h,x1:-1,y1:-1,area:0};stack.push(s);lab[s]=n;
  while(stack.length){const p=stack.pop(),x=p%w,y=(p-x)/w;c.area++;if(x<c.x0)c.x0=x;if(x>c.x1)c.x1=x;if(y<c.y0)c.y0=y;if(y>c.y1)c.y1=y;
   for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const q=yy*w+xx;if(mask[q]&&!lab[q]){lab[q]=n;stack.push(q);}}}}
  comps.push(c);
 }
 return {lab,comps};
}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1];};
function stats(c,lab,sw){c.area=0;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=c.y0;y<=c.y1;y++)for(let x=c.x0;x<=c.x1;x++)if(lab[y*sw+x]===c.id){c.area++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}if(c.area){c.x0=x0;c.y0=y0;c.x1=x1;c.y1=y1;}}
function splitOversized(live,comps,lab,sw){
 const maxA=Math.max(...live.map(c=>c.area)),big=live.filter(c=>c.area>=.1*maxA);if(big.length<4)return false;
 const mW=median(big.map(c=>c.x1-c.x0+1)),mH=median(big.map(c=>c.y1-c.y0+1)),mA=median(big.map(c=>c.area));let changed=false;
 for(const c of big){
  const cw=c.x1-c.x0+1,ch=c.y1-c.y0+1,heavy=c.area>1.6*mA;
  const kx=heavy&&cw>1.7*mW?Math.min(6,Math.round(cw/mW)):1,ky=heavy&&ch>1.7*mH?Math.min(6,Math.round(ch/mH)):1;
  if(kx<2&&ky<2)continue;
  const cutsOf=(k,lo,len,count)=>{const cuts=[];for(let j=1;j<k;j++){const t=lo+j*len/k,win=Math.max(1,Math.round(len/k*.3));let best=Math.round(t),bv=Infinity;for(let x=Math.round(t-win);x<=Math.round(t+win);x++){const v=count(x);if(v<bv||(v===bv&&Math.abs(x-t)<Math.abs(best-t))){bv=v;best=x;}}cuts.push(best);}return cuts;};
  const xc=kx>1?cutsOf(kx,c.x0,cw,x=>{let n=0;for(let y=c.y0;y<=c.y1;y++)if(lab[y*sw+x]===c.id)n++;return n;}):[];
  const yc=ky>1?cutsOf(ky,c.y0,ch,y=>{let n=0;for(let x=c.x0;x<=c.x1;x++)if(lab[y*sw+x]===c.id)n++;return n;}):[];
  const ids=[c.id];for(let k=1;k<kx*ky;k++){const n={id:comps.length+1,x0:c.x0,y0:c.y0,x1:c.x1,y1:c.y1,area:0};comps.push(n);ids.push(n.id);}
  for(let y=c.y0;y<=c.y1;y++){const r=yc.filter(v=>y>=v).length;for(let x=c.x0;x<=c.x1;x++){const i=y*sw+x;if(lab[i]!==c.id)continue;lab[i]=ids[r*kx+xc.filter(v=>x>=v).length];}}
  const box={x0:c.x0,y0:c.y0,x1:c.x1,y1:c.y1};for(const id of ids){const n=comps[id-1];Object.assign(n,box);stats(n,lab,sw);}
  changed=true;
 }
 return changed;
}
/** Share of a's box inside b's box. */
const inside=(a,b)=>{const ix=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)+1),iy=Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)+1);return ix*iy/((a.x1-a.x0+1)*(a.y1-a.y0+1));};
/** Multi-source BFS: every foreground pixel takes the label of its nearest seed (4-neighbour steps, in
 * a fixed order, so ties resolve the same way every time); foreground no seed reaches (pieces thinner
 * than the erosion) is labelled on its own afterwards. */
function grow(fg,{lab,comps},w,h){
 let q=new Int32Array(w*h),qn=0;for(let i=0;i<lab.length;i++)if(lab[i])q[qn++]=i;
 for(let head=0;head<qn;head++){const i=q[head],x=i%w,l=lab[i];
  const nb=[x>0?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i+w<w*h?i+w:-1];
  for(const j of nb)if(j>=0&&fg[j]&&!lab[j]){lab[j]=l;q[qn++]=j;}}
 const rest=new Uint8Array(w*h);let any=false;for(let i=0;i<rest.length;i++)if(fg[i]&&!lab[i]){rest[i]=1;any=true;}
 if(any){const r=label(rest,w,h),base=comps.length;for(let i=0;i<rest.length;i++)if(r.lab[i])lab[i]=r.lab[i]+base;for(const c of r.comps)comps.push({...c,id:c.id+base});}
 return {lab,comps};
}
const gap=(a,b)=>Math.max(0,Math.max(a.x0,b.x0)-Math.min(a.x1,b.x1)-1,Math.max(a.y0,b.y0)-Math.min(a.y1,b.y1)-1);

/**
 * @param {Uint8ClampedArray} data straight RGBA @param {number} w @param {number} h
 * @param {{mode:'auto'|'grid',cols:number,rows:number,tolerance:number}} p
 * @returns {{cells:{x:number,y:number,w:number,h:number,data:Uint8ClampedArray}[],cols:number,rows:number,method:string,backdrop:number[]|null}}
 */
export function splitSheet(data,w,h,p){
 const b=borderColor(data,w,h,p.tolerance);
 const backdrop=b.transparent?null:b.color;
 if(p.mode==='grid')return grid(data,w,h,p.cols,p.rows,b,'grid');
 const small=limitSide(data,w,h,WORK),sw=small.w,sh=small.h,sd=small.data,scale=sw/w;
 // No single backdrop (a photo, a painted scene): one picture.
 if(!b.transparent&&b.share<.6)return one(data,w,h,'no-backdrop',backdrop);
 const tol=b.transparent?p.tolerance:adaptiveTolerance(sd,sw,sh,b.color,p.tolerance),fg=new Uint8Array(sw*sh),lim=tol*tol;
 for(let i=0,j=0;j<fg.length;i+=4,j++){
  if(b.transparent){fg[j]=sd[i+3]>40?1:0;continue;}
  if(sd[i+3]<16)continue;const r=sd[i]-b.color[0],g=sd[i+1]-b.color[1],bl=sd[i+2]-b.color[2];fg[j]=r*r+g*g+bl*bl>lim?1:0;
 }
 // Foreground over most of the sheet, or a backdrop as noisy as the art (comic panels, a scene): not
 // stickers on a backdrop.
 let cover=0;for(let j=0;j<fg.length;j++)cover+=fg[j];
 if(cover>.85*fg.length||tol>=90)return p.cols*p.rows>1?grid(data,w,h,p.cols,p.rows,b,'grid-fallback'):one(data,w,h,'no-backdrop',backdrop);
 // Stickers that touch through a thin bridge (a shared outline, background noise): seeds are the
 // foreground eroded by ~0.4 % of the long side; every foreground pixel then joins its nearest seed.
 const e=Math.max(1,Math.round(.004*Math.max(sw,sh)));
 const bgMask=new Uint8Array(sw*sh);for(let j=0;j<bgMask.length;j++)bgMask[j]=fg[j]?0:1;
 const d2=distanceSquared(bgMask,sw,sh),seed=new Uint8Array(sw*sh);for(let j=0;j<seed.length;j++)seed[j]=fg[j]&&d2[j]>e*e?1:0;
 const {lab,comps}=grow(fg,label(seed,sw,sh),sw,sh);
 for(const c of comps){c.area=0;c.x0=sw;c.y0=sh;c.x1=-1;c.y1=-1;}
 for(let j=0;j<fg.length;j++){const l=lab[j];if(!l)continue;const c=comps[l-1],x=j%sw,y=(j-x)/sw;c.area++;if(x<c.x0)c.x0=x;if(x>c.x1)c.x1=x;if(y<c.y0)c.y0=y;if(y>c.y1)c.y1=y;}
 let live=comps.filter(c=>c.area>0);
 if(!live.length)return one(data,w,h,'empty',backdrop);
 // Two or three stickers glued by their borders read as one wide (or tall) piece: cut it at the
 // emptiest columns (rows) near the expected spacing, measured on the other pieces.
 if(splitOversized(live,comps,lab,sw))live=comps.filter(c=>c.area>0);
 const maxA=Math.max(...live.map(c=>c.area)),bigs=live.filter(c=>c.area>=.1*maxA).map(c=>c.area).sort((a,c)=>a-c),ref=bigs[bigs.length>>1];
 // Small pieces: join the nearest large piece when it is close, else keep (a smaller sticker) or drop (a speck).
 const parent=new Map(live.map(c=>[c.id,c.id]));const find=id=>{while(parent.get(id)!==id)id=/** @type {number} */(parent.get(id));return id;};
 const large=live.filter(c=>c.area>=.3*ref);
 const reach=.25*Math.sqrt(ref);
 for(const c of live){
  if(c.area>=.3*ref)continue;
  let best=null,bd=Infinity;for(const L of large){const d=gap(c,L)-(inside(c,L)>.5?1e6:0);if(d<bd){bd=d;best=L;}}
  if(best&&bd<=reach){parent.set(c.id,best.id);const B=best;B.x0=Math.min(B.x0,c.x0);B.y0=Math.min(B.y0,c.y0);B.x1=Math.max(B.x1,c.x1);B.y1=Math.max(B.y1,c.y1);}
  else if(c.area<.05*ref)parent.set(c.id,0);
 }
 const cells=live.filter(c=>parent.get(c.id)===c.id);
 // One piece over (nearly) the whole sheet while the recipe expects a grid: the gutters are not backdrop.
 if(cells.length<=1){
  const c=cells[0];
  if(p.cols*p.rows>1&&c&&(c.x1-c.x0+1)*(c.y1-c.y0+1)>.6*sw*sh)return grid(data,w,h,p.cols,p.rows,b,'grid-fallback');
  if(!c)return one(data,w,h,'empty',backdrop);
 }
 // Reading order: rows by centre line (a new row when a centre is below the row's by more than half a cell).
 const hs=cells.map(c=>c.y1-c.y0+1).sort((a,c)=>a-c),medH=hs[hs.length>>1];
 cells.sort((a,c)=>(a.y0+a.y1)-(c.y0+c.y1));
 /** @type {any[][]} */const rows=[];
 for(const c of cells){const cy=(c.y0+c.y1)/2,row=rows[rows.length-1];if(row&&cy-row.reduce((s,x)=>s+(x.y0+x.y1)/2,0)/row.length<=.5*medH)row.push(c);else rows.push([c]);}
 for(const row of rows)row.sort((a,c)=>a.x0-c.x0);
 const ordered=rows.flat(),ids=new Map(ordered.map((c,i)=>[c.id,i+1]));
 // Final label per small pixel: the cell it belongs to (0 = backdrop or dropped).
 const own=new Int32Array(sw*sh);for(let j=0;j<own.length;j++)if(lab[j]){const root=find(lab[j]);own[j]=root?ids.get(root)||0:0;}
 const out=ordered.map((c,k)=>{
  const x0=Math.floor(c.x0/scale),y0=Math.floor(c.y0/scale),x1=Math.min(w-1,Math.ceil((c.x1+1)/scale)-1),y1=Math.min(h-1,Math.ceil((c.y1+1)/scale)-1);
  const pad=Math.round(.04*Math.max(x1-x0+1,y1-y0+1));
  const rect={x:Math.max(0,x0-pad),y:Math.max(0,y0-pad),w:0,h:0};rect.w=Math.min(w,x1+pad+1)-rect.x;rect.h=Math.min(h,y1+pad+1)-rect.y;
  const cell=cropRect(data,w,h,rect);
  // Another sticker reaching into this box: paint it with the backdrop (or clear it).
  for(let y=0;y<rect.h;y++){const sy=Math.min(sh-1,Math.floor((y+rect.y)*scale));for(let x=0;x<rect.w;x++){const o=own[sy*sw+Math.min(sw-1,Math.floor((x+rect.x)*scale))];if(o&&o!==k+1){const i=(y*rect.w+x)*4;if(backdrop){cell[i]=backdrop[0];cell[i+1]=backdrop[1];cell[i+2]=backdrop[2];cell[i+3]=255;}else cell[i+3]=0;}}}
  return {...rect,data:cell};
 });
 return {cells:out,cols:Math.max(...rows.map(r=>r.length)),rows:rows.length,method:'auto',backdrop};
}
function one(data,w,h,method,backdrop){return {cells:[{x:0,y:0,w,h,data:new Uint8ClampedArray(data)}],cols:1,rows:1,method,backdrop};}
function grid(data,w,h,cols,rows,b,method){
 const box=contentBounds(data,w,h,36)||{x:0,y:0,w,h};
 // A sheet whose content fills it nearly edge to edge: divide the whole picture (no off-by-a-margin cells).
 const full=box.w>.9*w&&box.h>.9*h?{x:0,y:0,w,h}:box;
 const cells=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const x0=full.x+Math.round(c*full.w/cols),x1=full.x+Math.round((c+1)*full.w/cols),y0=full.y+Math.round(r*full.h/rows),y1=full.y+Math.round((r+1)*full.h/rows);
  const rect={x:x0,y:y0,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0)};cells.push({...rect,data:cropRect(data,w,h,rect)});
 }
 return {cells,cols,rows,method,backdrop:b.transparent?null:b.color};
}
