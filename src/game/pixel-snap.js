/** Grid snapping for pixel art that was upscaled, resampled, blurred, JPEG-compressed or generated
 * with "pseudo-pixels" (the AI/upscale fixer). Pure: RGBA in, RGBA out, deterministic.
 *
 * 1. GRID. An exact integer upscale is found by pixel-check.js detectScale (every block one colour).
 *    Anything else is measured from the image's edges: the first-difference edge profile along each
 *    axis is tested against lattices of period s (Fourier coherence, as pixel-check estimateResample)
 *    coarse-to-fine, harmonics resolved to the fundamental, and the PHASE of the lattice is read from
 *    the same Fourier coefficient. Each predicted cell boundary is then moved to the strongest edge
 *    within ±30 % of a cell ("elastic" lattice), which follows pseudo-pixels of uneven size.
 * 2. CELLS. Every cell becomes one pixel: alpha by majority, colour by the exact mode of the cell's
 *    inner part when it clearly dominates, else the Oklab medoid (never an average, so no new
 *    in-between colours are invented).
 * 3. COLOURS. Near-identical colours (JPEG noise, resampling) are merged greedily by frequency in
 *    Oklab — the representative is a real colour of the image, not a mean — and optionally reduced
 *    to a colour budget.
 * Everything reports what it measured (scale, phase, confidence, how many boundaries moved) so the
 * UI can show it and the user can override it. */
import {detectScale} from './pixel-check.js';
import {oklab,accumulate,paletteFromHistogram} from '../pixel-engine.js';
const view=s=>{if(!s||!(s.data instanceof Uint8Array||s.data instanceof Uint8ClampedArray)||s.data.length!==s.width*s.height*4)throw Error('Needs {data,width,height} RGBA pixels');return s;};
// ------------------------------------------------------------------ edge profiles
/** Edge energy along `axis`. order 1: |first difference| at boundary i (between line i−1 and i) —
 * where a nearest-neighbour (or JPEG'd) upscale puts its steps. order 2: |second difference|
 * centred on line i−1 — where a SMOOTH resample puts its kinks: bilinear turns each step into a
 * ramp one cell wide, whose first difference is flat (its Fourier component at 1/s vanishes) but
 * whose ends — the original sample centres — are sharp kinks. Alpha counts double. */
export function edgeProfile({data:d,width:w,height:h},axis,order=1){
 const len=axis==='x'?w:h,across=axis==='x'?h:w,out=new Float64Array(len),st=axis==='x'?4:w*4;
 for(let i=order;i<len;i++){let sum=0;
  for(let j=0;j<across;j++){const a=axis==='x'?(j*w+i)*4:(i*w+j)*4,b=a-st;
   if(order===1)sum+=Math.abs(d[a]-d[b])+Math.abs(d[a+1]-d[b+1])+Math.abs(d[a+2]-d[b+2])+2*Math.abs(d[a+3]-d[b+3]);
   else{const c=b-st;sum+=Math.abs(d[a]-2*d[b]+d[c])+Math.abs(d[a+1]-2*d[b+1]+d[c+1])+Math.abs(d[a+2]-2*d[b+2]+d[c+2])+2*Math.abs(d[a+3]-2*d[b+3]+d[c+3]);}}
  out[i]=sum;}
 return out;
}
/** Both orders for both axes: {x:{d1,d2}, y:{d1,d2}}. */
export const axisProfiles=img=>({x:{d1:edgeProfile(img,'x',1),d2:edgeProfile(img,'x',2)},y:{d1:edgeProfile(img,'y',1),d2:edgeProfile(img,'y',2)}});
const addArr=(a,b)=>{const o=new Float64Array(Math.max(a.length,b.length));for(let i=0;i<o.length;i++)o[i]=(a[i]||0)+(b[i]||0);return o;};
/** Sum of several frames' profiles (an animation shares one grid). */
export const addProfiles=(a,b)=>!a?b:{x:{d1:addArr(a.x.d1,b.x.d1),d2:addArr(a.x.d2,b.x.d2)},y:{d1:addArr(a.y.d1,b.y.d1),d2:addArr(a.y.d2,b.y.d2)}};
/** Coherence (0…1) and phase (px) of the profile's lattice at period s. */
export function latticeAt(profile,s){
 let re=0,im=0,total=0;const k=2*Math.PI/s;
 for(let i=1;i<profile.length;i++){const e=profile[i];if(!e)continue;re+=e*Math.cos(k*i);im+=e*Math.sin(k*i);total+=e;}
 const c=total?Math.hypot(re,im)/total:0,phase=((Math.atan2(im,re)/k)%s+s)%s;
 return {c,phase};
}
/** Lattice of one axis at period s from both orders: the stronger one decides, and its phase is
 * turned into the phase of the CELL BOUNDARIES (a second-difference kink at index i is the centre
 * of pixel i−1, i.e. continuous position i−½; the boundary between samples is half a cell further). */
export function axisLattice(pa,s){
 const a=latticeAt(pa.d1,s),b=latticeAt(pa.d2,s);
 if(a.c>=b.c)return {c:a.c,phase:a.phase,order:1};
 return {c:b.c,phase:((b.phase-.5+s/2)%s+s)%s,order:2};
}
function scan(P,from,to,step){
 const out=[];for(let s=from;s<=to+1e-9;s+=step){const x=axisLattice(P.x,s),y=axisLattice(P.y,s);out.push({s:+s.toFixed(4),c:(x.c+y.c)/2,cx:x.c,cy:y.c});}return out;
}
/** Lattice period (scale) of a smoothed / fractional upscale, both axes together, then each axis
 * refined. `P` = axisProfiles(img). @returns {scale, scaleX, scaleY, phaseX, phaseY, order, coherence, prominence, confidence} */
export function estimateLattice(P,{minScale=1.5,maxScale=64}={}){
 const top=Math.max(minScale,Math.min(maxScale,Math.min(P.x.d1.length,P.y.d1.length)/3));
 const coarse=scan(P,minScale,top,.02);
 if(!coarse.length)return null;
 const peaks=coarse.filter((v,i)=>(i===0||v.c>=coarse[i-1].c)&&(i===coarse.length-1||v.c>=coarse[i+1].c));
 const best=peaks.reduce((a,b)=>b.c>a.c?b:a,peaks[0]);
 // the fundamental: the largest period that is a whole multiple of the best one and scores almost as well
 let chosen=best;
 for(const p of peaks){const r=p.s/best.s,k=Math.round(r);if(k>=2&&Math.abs(r-k)<=.03*k&&p.c>=best.c*.8&&p.s>chosen.s)chosen=p;}
 const fine=scan(P,Math.max(minScale,chosen.s-.03),chosen.s+.03,.001),f=fine.reduce((a,b)=>b.c>a.c?b:a,fine[0]);
 const refine=(pa,s0)=>{let b={s:s0,c:-1};for(let s=s0-.015;s<=s0+.015+1e-9;s+=.0005){const c=axisLattice(pa,s).c;if(c>b.c)b={s:+s.toFixed(4),c};}return b.s;};
 const sx=refine(P.x,f.s),sy=refine(P.y,f.s),lx=axisLattice(P.x,sx),ly=axisLattice(P.y,sy);
 const sorted=coarse.map(v=>v.c).sort((a,b)=>a-b),median=sorted[sorted.length>>1]||1e-9,prominence=f.c/Math.max(1e-9,median);
 const confidence=f.c>=.5&&prominence>=3?'high':f.c>=.35&&prominence>=2?'medium':'low';
 return {scale:f.s,scaleX:sx,scaleY:sy,phaseX:lx.phase,phaseY:ly.phase,order:Math.max(lx.order,ly.order),coherence:+f.c.toFixed(3),prominence:+prominence.toFixed(2),confidence,
  candidates:peaks.sort((a,b)=>b.c-a.c).slice(0,4).map(p=>({scale:p.s,coherence:+p.c.toFixed(3)}))};
}
/** Cell boundaries along one axis: the lattice phase + k·s, each moved to the strongest edge within
 * ±`slack`·s when that edge stands out, then partial cells at the ends kept only when at least half
 * a cell wide. Returns the sorted boundary list including 0 and len. */
export function boundaries(profile,len,s,phase,{slack=.3,elastic=true}={}){
 const pred=[];for(let b=phase;b<len;b+=s)if(b>0)pred.push(b);
 let moved=0;const out=[];
 for(const b of pred){
  let pos=Math.round(b);
  if(elastic){const lo=Math.max(1,Math.ceil(b-slack*s)),hi=Math.min(len-1,Math.floor(b+slack*s));let best=-1,bi=pos,sum=0,n=0;
   for(let i=lo;i<=hi;i++){sum+=profile[i];n++;if(profile[i]>best){best=profile[i];bi=i;}}
   const mean=n?sum/n:0;if(best>0&&best>=mean*1.6&&bi!==pos){pos=bi;moved++;}}
  if(pos>0&&pos<len&&(!out.length||pos-out[out.length-1]>=Math.max(1,s*.5)))out.push(pos);
 }
 const list=[0,...out,len];
 // a sliver at either end (less than half a cell) belongs to its neighbour
 if(list.length>2&&list[1]-list[0]<s*.5)list.splice(1,1);
 if(list.length>2&&list[list.length-1]-list[list.length-2]<s*.5)list.splice(list.length-2,1);
 return {cuts:list,moved,predicted:pred.length};
}
/** Finds the grid of an image. `scale`/`phase` may be forced by the user (override). */
export function findGrid(img,{maxScale=64,scale=null,phaseX=null,phaseY=null,elastic=true,profiles=null}={}){
 view(img);const {width:w,height:h}=img;
 if(scale==null){
  const exact=detectScale(img,{maxScale:Math.min(16,maxScale)});
  if(exact.confident&&exact.exact&&exact.scale>1){
   const s=exact.scale,rx=exact.grid.columns.length?exact.grid.columns[0]%s:0,ry=exact.grid.rows.length?exact.grid.rows[0]%s:0;
   const xs=cutsAt(w,s,rx),ys=cutsAt(h,s,ry);
   return {kind:'integer',scale:s,scaleX:s,scaleY:s,phaseX:rx,phaseY:ry,confidence:'high',coherence:1,xs,ys,moved:0,width:xs.length-1,height:ys.length-1};
  }
 }
 const P=profiles||axisProfiles(img);
 let est;
 if(scale!=null){const lx=axisLattice(P.x,scale),ly=axisLattice(P.y,scale);est={scale,scaleX:scale,scaleY:scale,phaseX:lx.phase,phaseY:ly.phase,order:Math.max(lx.order,ly.order),coherence:+((lx.c+ly.c)/2).toFixed(3),confidence:'user'};}
 else est=estimateLattice(P,{maxScale:Math.min(maxScale,Math.max(2,Math.min(w,h)/2))});
 if(!est||est.scale<1.4)return {kind:'unit',scale:1,scaleX:1,scaleY:1,phaseX:0,phaseY:0,confidence:est?.confidence||'low',coherence:est?.coherence||0,xs:cutsAt(w,1,0),ys:cutsAt(h,1,0),moved:0,width:w,height:h};
 if(phaseX!=null)est.phaseX=phaseX;if(phaseY!=null)est.phaseY=phaseY;
 const bx=boundaries(P.x.d1,w,est.scaleX,est.phaseX,{elastic}),by=boundaries(P.y.d1,h,est.scaleY,est.phaseY,{elastic});
 return {kind:'lattice',...est,xs:bx.cuts,ys:by.cuts,moved:bx.moved+by.moved,predicted:bx.predicted+by.predicted,width:bx.cuts.length-1,height:by.cuts.length-1};
}
function cutsAt(len,s,phase){const out=[0];for(let b=phase||s;b<len;b+=s)if(b>0)out.push(b);out.push(len);if(out.length>2&&out[1]<s*.5)out.splice(1,1);if(out.length>2&&len-out[out.length-2]<s*.5)out.splice(out.length-2,1);return out;}
// ------------------------------------------------------------------ cells → pixels
/** One pixel per grid cell. `inner` = share of the cell kept around its centre (0.5 drops the outer
 * quarter on each side, where resampling mixes neighbours). */
export function sampleCells(img,grid,{inner=.5,alphaCut=128,modeShare=.5}={}){
 view(img);const {data:d,width:w}=img,{xs,ys}=grid,W=xs.length-1,H=ys.length-1,out=new Uint8Array(W*H*4);
 let modeCells=0,medoidCells=0;
 for(let cy=0;cy<H;cy++)for(let cx=0;cx<W;cx++){
  const [x0,x1]=shrink(xs[cx],xs[cx+1],inner),[y0,y1]=shrink(ys[cy],ys[cy+1],inner);
  let opaque=0,total=0;const counts=new Map(),px=[];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*4;total++;if(d[i+3]<alphaCut)continue;opaque++;const k=(d[i]|d[i+1]<<8|d[i+2]<<16)>>>0;counts.set(k,(counts.get(k)||0)+1);px.push(k);}
  const o=(cy*W+cx)*4;if(!total||opaque*2<total)continue;
  let best=0,n=0;for(const [k,c]of counts)if(c>n||c===n&&k<best){best=k;n=c;}
  let k=best;
  if(n<modeShare*opaque&&counts.size>2){k=medoid(counts);medoidCells++;}else modeCells++;
  out[o]=k&255;out[o+1]=k>>>8&255;out[o+2]=k>>>16&255;out[o+3]=255;
 }
 return {data:out,width:W,height:H,modeCells,medoidCells};
}
const shrink=(a,b,inner)=>{const len=b-a,keep=Math.max(1,Math.round(len*inner)),s=a+Math.floor((len-keep)/2);return [s,s+keep];};
/** The colour with the smallest summed Oklab distance to all others (weighted by count). */
function medoid(counts){
 const keys=[...counts.keys()],labs=keys.map(k=>oklab(k&255,k>>>8&255,k>>>16&255));let best=keys[0],bd=Infinity;
 if(keys.length>200){// many distinct colours: component-wise median in Oklab, then the nearest real colour
  const n=keys.length,med=[0,1,2].map(c=>{const v=keys.map((k,i)=>[labs[i][c],counts.get(k)]).sort((a,b)=>a[0]-b[0]);let half=v.reduce((s,x)=>s+x[1],0)/2;for(const [x,wt]of v){half-=wt;if(half<=0)return x;}return v[v.length-1][0];});
  for(let i=0;i<n;i++){const e=(labs[i][0]-med[0])**2+(labs[i][1]-med[1])**2+(labs[i][2]-med[2])**2;if(e<bd){bd=e;best=keys[i];}}return best;}
 for(let i=0;i<keys.length;i++){let s=0;for(let j=0;j<keys.length;j++){if(i===j)continue;s+=Math.hypot(labs[i][0]-labs[j][0],labs[i][1]-labs[j][1],labs[i][2]-labs[j][2])*counts.get(keys[j]);}if(s<bd){bd=s;best=keys[i];}}
 return best;
}
// ------------------------------------------------------------------ colours
/** Greedy merge of near-identical colours: most frequent colour first; every colour within
 * `threshold` (Oklab distance) of an existing representative joins it. Then, if more than
 * `maxColors` remain, the representatives are reduced by median cut and each maps to the nearest.
 * @returns {data, palette:[[r,g,b]], merged (colours folded), before, after} */
export function mergeColors(img,{threshold=.04,maxColors=0}={}){
 view(img);const d=img.data,count=new Map();
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const k=(d[i]|d[i+1]<<8|d[i+2]<<16)>>>0;count.set(k,(count.get(k)||0)+1);}
 const keys=[...count].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).map(e=>e[0]),rgb=k=>[k&255,k>>>8&255,k>>>16&255];
 const reps=[],repLab=[],map=new Map(),t2=threshold*threshold;
 for(const k of keys){const c=rgb(k),l=oklab(...c);let hit=-1,bd=t2;
  for(let r=0;r<reps.length;r++){const q=repLab[r],e=(l[0]-q[0])**2+(l[1]-q[1])**2+(l[2]-q[2])**2;if(e<=bd){bd=e;hit=r;}}
  if(hit<0){reps.push(c);repLab.push(l);hit=reps.length-1;}map.set(k,hit);}
 let palette=reps,final=reps.map((_,i)=>i);
 if(maxColors>0&&reps.length>maxColors){
  const hist=new Map();for(const [k,n]of count){const c=reps[map.get(k)],key=(c[0]>>3)<<10|(c[1]>>3)<<5|(c[2]>>3);let e=hist.get(key);if(!e)hist.set(key,e=[0,0,0,0]);e[0]+=c[0]*n;e[1]+=c[1]*n;e[2]+=c[2]*n;e[3]+=n;}
  const cut=paletteFromHistogram(hist,maxColors),labs=cut.map(c=>oklab(...c));
  // snap each median-cut centre to the nearest real representative, so the palette stays made of image colours
  const chosen=[];for(const l of labs){let b=0,bd2=Infinity;repLab.forEach((q,i)=>{const e=(l[0]-q[0])**2+(l[1]-q[1])**2+(l[2]-q[2])**2;if(e<bd2&&!chosen.includes(i)){bd2=e;b=i;}});chosen.push(b);}
  palette=chosen.map(i=>reps[i]);const pl=chosen.map(i=>repLab[i]);
  final=repLab.map(l=>{let b=0,bd2=Infinity;pl.forEach((q,i)=>{const e=(l[0]-q[0])**2+(l[1]-q[1])**2+(l[2]-q[2])**2;if(e<bd2){bd2=e;b=i;}});return b;});
 }
 const out=new Uint8Array(d.length);
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const k=(d[i]|d[i+1]<<8|d[i+2]<<16)>>>0,c=palette[final[map.get(k)]];out[i]=c[0];out[i+1]=c[1];out[i+2]=c[2];out[i+3]=d[i+3];}
 return {data:out,width:img.width,height:img.height,palette,before:keys.length,after:palette.length,merged:keys.length-palette.length};
}
/** Solid background of an opaque image: the colour covering most of the border, when it covers
 * at least `minShare` of it (then flood-removed from the border within `tolerance`, Oklab). */
export function detectBackground(img,{minShare=.8,tolerance=.06}={}){
 view(img);const {data:d,width:w,height:h}=img;let transparent=0;
 for(let i=3;i<d.length;i+=4)if(d[i]<255)transparent++;
 if(transparent>d.length/4*.01)return {color:null,share:0,reason:'has transparency'};
 const border=[];for(let x=0;x<w;x++){border.push(x,(h-1)*w+x);}for(let y=1;y<h-1;y++){border.push(y*w,y*w+w-1);}
 const labs=border.map(p=>oklab(d[p*4],d[p*4+1],d[p*4+2]));
 // the border pixel with the most border neighbours within tolerance is the background candidate
 let best=0,bn=-1;const step=Math.max(1,Math.floor(border.length/400));
 for(let i=0;i<border.length;i+=step){let n=0;for(let j=0;j<border.length;j+=step)if(Math.hypot(labs[i][0]-labs[j][0],labs[i][1]-labs[j][1],labs[i][2]-labs[j][2])<=tolerance)n++;if(n>bn){bn=n;best=i;}}
 const ref=labs[best];let near=0;for(const l of labs)if(Math.hypot(l[0]-ref[0],l[1]-ref[1],l[2]-ref[2])<=tolerance)near++;
 const share=near/labs.length,p=border[best];
 return share>=minShare?{color:[d[p*4],d[p*4+1],d[p*4+2]],share:+share.toFixed(3),tolerance}:{color:null,share:+share.toFixed(3),reason:'no dominant border colour'};
}
/** Makes the background transparent: flood from every border pixel through pixels within
 * `tolerance` (Oklab) of `color`. Returns {data, removed}. */
export function removeBackground(img,color,{tolerance=.06}={}){
 view(img);const {data:d,width:w,height:h}=img,out=new Uint8Array(d),ref=oklab(...color),seen=new Uint8Array(w*h),stack=[];let removed=0;
 const near=p=>{const i=p*4;if(!d[i+3])return true;const l=oklab(d[i],d[i+1],d[i+2]);return Math.hypot(l[0]-ref[0],l[1]-ref[1],l[2]-ref[2])<=tolerance;};
 const push=p=>{if(!seen[p]&&near(p)){seen[p]=1;stack.push(p);}};
 for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
 while(stack.length){const p=stack.pop(),x=p%w,y=(p-x)/w;out[p*4]=out[p*4+1]=out[p*4+2]=out[p*4+3]=0;removed++;
  if(x>0)push(p-1);if(x<w-1)push(p+1);if(y>0)push(p-w);if(y<h-1)push(p+w);}
 return {data:out,width:w,height:h,removed};
}
/** Alpha to 0 / 255 at `cut` (AI and resampled art has soft edges pixel art never has). */
export function hardAlpha(img,cut=128){const d=new Uint8Array(img.data);let n=0;for(let i=3;i<d.length;i+=4){const a=d[i]>=cut?255:0;if(a!==d[i])n++;d[i]=a;if(!a)d[i-3]=d[i-2]=d[i-1]=0;}return {data:d,width:img.width,height:img.height,changed:n};}
// ------------------------------------------------------------------ frames
/** Translation (dx, dy) within ±r that best overlays `img` on `ref` (alpha IoU, then colour
 * agreement). Integer pixels only. */
export function bestShift(ref,img,{radius=3}={}){
 let best={dx:0,dy:0,score:-1};
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  let inter=0,uni=0,same=0;
  for(let y=0;y<ref.height;y++)for(let x=0;x<ref.width;x++){const sx=x-dx,sy=y-dy,a=ref.data[(y*ref.width+x)*4+3]>0,inI=sx>=0&&sy>=0&&sx<img.width&&sy<img.height,b=inI&&img.data[(sy*img.width+sx)*4+3]>0;
   if(a||b)uni++;if(a&&b){inter++;const i=(y*ref.width+x)*4,j=(sy*img.width+sx)*4;if(ref.data[i]===img.data[j]&&ref.data[i+1]===img.data[j+1]&&ref.data[i+2]===img.data[j+2])same++;}}
  const score=(uni?inter/uni:0)+(inter?same/inter:0)*.1-(Math.abs(dx)+Math.abs(dy))*1e-4;
  if(score>best.score)best={dx,dy,score:+score.toFixed(4)};
 }
 return best;
}
/** Bottom-centre anchor of the opaque bounds (feet of a character), or null. */
export function anchorOf(img){
 const {data:d,width:w,height:h}=img;let x0=w,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]){if(x<x0)x0=x;if(x>x1)x1=x;y1=y;}
 return x1<0?null:{x:Math.round((x0+x1+1)/2),y:y1+1};
}
