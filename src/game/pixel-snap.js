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
 if(a.c>=b.c)return {c:a.c,phase:a.phase,order:1,raw:a.phase};
 return {c:b.c,phase:((b.phase-.5+s/2)%s+s)%s,order:2,raw:b.phase};
}
/** How much of an axis's edge energy falls BETWEEN the lattice lines of period s (more than a
 * quarter cell from the nearest one), relative to what randomly placed edges would give (so 1 =
 * no relation to the lattice, 0 = every edge on a line). The pixel lattice scores low; a
 * sprite-sheet cell pitch (a multiple of it) leaves every pixel edge inside its cells and scores
 * high; a harmonic (s/2) scores as low as s itself, which is why the largest low-scoring period wins.
 * Returns null when the lattice is too fine to judge (a quarter cell under half a pixel). */
export function interiorShare(pa,s){
 const l=axisLattice(pa,s),prof=l.order===1?pa.d1:pa.d2,tol=Math.max(.5,.25*s),expected=1-2*tol/s;if(expected<.3)return null;
 let inside=0,total=0;
 for(let i=1;i<prof.length;i++){const e=prof[i];if(!e)continue;total+=e;let d=((i-l.raw)%s+s)%s;d=Math.min(d,s-d);if(d>tol)inside+=e;}
 return total?inside/total/expected:1;
}
function scan(P,from,to,step){
 const out=[];for(let s=from;s<=to+1e-9;s+=step){const x=axisLattice(P.x,s),y=axisLattice(P.y,s);out.push({s:+s.toFixed(4),c:(x.c+y.c)/2,cx:x.c,cy:y.c});}return out;
}
/** Distances between consecutive significant edge peaks of a profile (local maxima at least 20 %
 * of the 95th-percentile peak, so JPEG ripples do not count). */
export function edgeGaps(prof){
 const pk=[];for(let i=1;i<prof.length-1;i++)if(prof[i]>0&&prof[i]>=prof[i-1]&&prof[i]>prof[i+1])pk.push(i);
 if(pk.length<3)return [];
 const v=pk.map(i=>prof[i]).sort((a,b)=>a-b),cut=.2*v[Math.floor(v.length*.95)],sig=pk.filter(i=>prof[i]>=cut),out=[];
 for(let k=1;k<sig.length;k++)out.push(sig[k]-sig[k-1]);
 return out;
}
/** The typical gap: mean of the gaps near the median (a missing edge makes a double gap, a JPEG
 * ripple a short one; both are left out). Null when there is too little to measure. */
export function typicalGap(gaps){
 if(gaps.length<4)return null;const s=[...gaps].sort((a,b)=>a-b),med=s[s.length>>1],keep=s.filter(g=>g>=.6*med&&g<=1.5*med);
 return keep.length?keep.reduce((a,b)=>a+b,0)/keep.length:null;
}
/** Lattice period (scale) of a smoothed / fractional upscale, both axes together, then each axis
 * refined. `P` = axisProfiles(img). @returns {scale, scaleX, scaleY, phaseX, phaseY, order, coherence, prominence, confidence} */
export function estimateLattice(P,{minScale=1.5,maxScale=64}={}){
 const top=Math.max(minScale,Math.min(maxScale,Math.min(P.x.d1.length,P.y.d1.length)/3));
 const coarse=scan(P,minScale,top,.02);
 if(!coarse.length)return null;
 const peaks=coarse.filter((v,i)=>(i===0||v.c>=coarse[i-1].c)&&(i===coarse.length-1||v.c>=coarse[i+1].c));
 const best=peaks.reduce((a,b)=>b.c>a.c?b:a,peaks[0]);
 // The pixel lattice: a lattice of period s also fits s/2, s/3… (harmonics), and a sheet's cell
 // pitch n·s fits too, so coherence alone cannot tell them apart. The spacing of the edges
 // themselves can: neighbouring pixel edges are one cell apart. The strong peak nearest the typical
 // gap between consecutive edge peaks is the pixel lattice.
 const strong=peaks.filter(p=>p.c>=best.c*.5).map(p=>{const a=interiorShare(P.x,p.s),b=interiorShare(P.y,p.s);return {...p,inner:a==null||b==null?null:(a+b)/2};});
 const order=axisLattice(P.x,best.s).order+axisLattice(P.y,best.s).order>2?'d2':'d1',gaps=[...edgeGaps(P.x[order]),...edgeGaps(P.y[order])];
 const gap=typicalGap(gaps);let chosen=best;
 if(gap){const near=strong.filter(p=>Math.abs(p.s/gap-1)<=.25).sort((a,b)=>b.c-a.c)[0];
  if(near)chosen=near;
  else if(gap>=minScale&&gap<=top){const around=scan(P,Math.max(minScale,gap*.88),Math.min(top,gap*1.12),.01);chosen=around.reduce((a,b)=>b.c>a.c?b:a,around[0]);}
  // clean art with large flat areas has few edges one cell apart, so its typical gap is a multiple
  // of the cell; a lattice that puts EVERY edge on its lines (nothing between) and is far more
  // coherent than the gap's period is the pixel lattice
  const b=strong.find(p=>p.s===best.s);if(chosen!==best&&b&&b.inner!=null&&b.inner<=.05&&chosen.c<best.c*.7)chosen=best;}
 const fine=scan(P,Math.max(minScale,chosen.s-.03),chosen.s+.03,.001),f=fine.reduce((a,b)=>b.c>a.c?b:a,fine[0]);
 const refine=(pa,s0)=>{let b={s:s0,c:-1};for(let s=s0-.015;s<=s0+.015+1e-9;s+=.0005){const c=axisLattice(pa,s).c;if(c>b.c)b={s:+s.toFixed(4),c};}return b.s;};
 const sx=refine(P.x,f.s),sy=refine(P.y,f.s),lx=axisLattice(P.x,sx),ly=axisLattice(P.y,sy);
 const sorted=coarse.map(v=>v.c).sort((a,b)=>a-b),median=sorted[sorted.length>>1]||1e-9,prominence=f.c/Math.max(1e-9,median);
 // confidence: how strongly edges sit on the lattice (coherence), how far that stands above other
 // periods (prominence), and how little edge energy is left between its lines
 const rel=(()=>{const a=interiorShare(P.x,f.s),b=interiorShare(P.y,f.s);return a==null||b==null?1:(a+b)/2;})();
 // two independent measures agreeing (the lattice and the spacing of edge peaks) also counts
 const agree=!!gap&&Math.abs(f.s/gap-1)<=.1;
 const confidence=(f.c>=.5&&prominence>=3)||(f.c>=.35&&(rel<=.5||agree)&&prominence>=3)?'high':(f.c>=.35&&prominence>=2)||(f.c>=.2&&(rel<=.65||agree)&&prominence>=2)?'medium':'low';
 return {scale:f.s,gap:gap?+gap.toFixed(3):null,scaleX:sx,scaleY:sy,phaseX:lx.phase,phaseY:ly.phase,order:Math.max(lx.order,ly.order),coherence:+f.c.toFixed(3),prominence:+prominence.toFixed(2),between:+rel.toFixed(3),confidence,
  candidates:strong.sort((a,b)=>b.c-a.c).slice(0,6).map(p=>({scale:p.s,coherence:+p.c.toFixed(3),between:p.inner==null?null:+p.inner.toFixed(3)}))};
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
   // detectScale prefers a grid without an offset, so an off-grid crop of a 6× upscale can come back
   // as 3× (every change is also on the 3-px grid). The largest multiple whose change positions all
   // share one residue is the real block size.
   let s=exact.scale;const cols=exact.grid.columns,rows=exact.grid.rows,same=(pos,S)=>pos.every(p=>p%S===pos[0]%S);
   for(let m=Math.floor(Math.min(16,maxScale,w,h)/s);m>=2;m--)if(same(cols,m*s)&&same(rows,m*s)&&(cols.length>1||rows.length>1)){s=m*s;break;}
   const rx=cols.length?cols[0]%s:0,ry=rows.length?rows[0]%s:0;
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
 // Pseudo-pixels of uneven size (generated "pixel art"): no single lattice holds across the image,
 // but every cell edge is still an edge. When the input is noisy, the lattice is not a clear one and
 // the edges sit off it, cuts that follow the edges replace it (see trackedGrid for the rules).
 if(scale==null&&est.confidence!=='high'){const tr=trackedGrid(img,P,est);if(tr)return tr;}
 if(est.order===2){
  // smooth resample: refine each axis by least squares on the lines with the most detail
  const {x,y}=smoothLines(img);
  const fx=fitSmoothAxis(x,w,est.scaleX,est.phaseX,{range:scale!=null?0:.02}),fy=fitSmoothAxis(y,h,est.scaleY,est.phaseY,{range:scale!=null?0:.02});
  est={...est,scaleX:fx.s,phaseX:phaseX??fx.phase,scaleY:fy.s,phaseY:phaseY??fy.phase,scale:+((fx.s+fy.s)/2).toFixed(4)};
  const xs=cutsAt(w,est.scaleX,est.phaseX),ys=cutsAt(h,est.scaleY,est.phaseY);
  return {kind:'lattice',...est,xs,ys,moved:0,predicted:xs.length+ys.length-4,width:xs.length-1,height:ys.length-1};
 }
 const bx=boundaries(P.x.d1,w,est.scaleX,est.phaseX,{elastic}),by=boundaries(P.y.d1,h,est.scaleY,est.phaseY,{elastic});
 return {kind:'lattice',...est,xs:bx.cuts,ys:by.cuts,moved:bx.moved+by.moved,predicted:bx.predicted+by.predicted,width:bx.cuts.length-1,height:by.cuts.length-1};
}
/** Significant edge peaks of a profile: local maxima above the noise floor (the median of the
 * profile — most lines lie inside cells) by at least `frac` of the way to the strong peaks (95th
 * percentile), so JPEG ripples and per-pixel noise do not count. */
export function edgePeaks(prof,frac=.25){
 const pk=[];for(let i=1;i<prof.length-1;i++)if(prof[i]>0&&prof[i]>=prof[i-1]&&prof[i]>prof[i+1])pk.push(i);
 if(pk.length<3)return [];
 const all=Float64Array.from(prof).sort(),floor=all[all.length>>1],v=pk.map(i=>prof[i]).sort((a,b)=>a-b),top=v[Math.floor(v.length*.95)],cut=floor+frac*(top-floor);
 return pk.filter(i=>prof[i]>=cut);
}
/** Energy-weighted RMS distance of edge peaks from the lattice (s, phase), in cells (0 = every
 * peak on a line; about 0.29 = no relation). */
export function offLattice(prof,pk,s,phase){let e=0,w=0;for(const i of pk){let d=((i-phase)%s+s)%s;d=Math.min(d,s-d);e+=prof[i]*d*d;w+=prof[i];}return w?Math.sqrt(e/w)/s:1;}
/** Cuts along one axis that follow the edges of pseudo-pixels of uneven width:
 *  1. the largest cell size s (sweep 2…64 px, ×1.02) whose cuts — dynamic programming with every
 *     cell between 0.7·s and 1.35·s — still land on ≥ 97 % of the significant edge energy;
 *  2. the typical cell = mean of the single-cell gaps between the edges those cuts landed on;
 *  3. every stretch between two landed edges (and the ends) divided into round(length / cell)
 *     equal cells — runs of equal colour have no edges to follow.
 * Returns {cuts, s, capture} or null when there are too few edges. */
export function trackAxis(prof,len){
 const pk=edgePeaks(prof);if(pk.length<4)return null;
 const val=new Float64Array(len+1);for(const i of pk)val[i]=prof[i];
 const total=pk.reduce((a,i)=>a+prof[i],0);let pick=null,top=0;const runs=[];
 for(let s=2;s<=Math.min(64,len/3);s*=1.02){const r=peakCuts(val,len,s);if(r){runs.push({s,cap:r.score/total,cuts:r.cuts});if(r.score/total>top)top=r.score/total;}}
 for(const r of runs)if(r.cap>=top*.97)pick=r;
 if(!pick)return null;
 const on=pick.cuts.filter(c=>c>0&&c<len&&val[c]>0),gaps=[];for(let k=1;k<on.length;k++)gaps.push(on[k]-on[k-1]);
 if(gaps.length<3)return null;
 const sg=[...gaps].sort((a,b)=>a-b),mn=sg[Math.floor(sg.length*.05)],single=sg.filter(g=>g<=1.5*mn),cell=single.reduce((a,b)=>a+b,0)/single.length;
 const anchors=[0,...on,len],cuts=[0];
 for(let k=1;k<anchors.length;k++){const A=anchors[k-1],B=anchors[k],D=B-A;
  if((k===1||k===anchors.length-1)&&D<cell*.5){if(k===anchors.length-1)cuts[cuts.length-1]=len;continue;}// an end sliver joins its neighbour
  const n=Math.max(1,Math.round(D/cell));for(let q=1;q<=n;q++)cuts.push(Math.round(A+D*q/n));}
 if(cuts[cuts.length-1]!==len)cuts.push(len);
 return {cuts:[...new Set(cuts)].sort((a,b)=>a-b),s:cell,capture:+top.toFixed(3)};
}
function peakCuts(val,len,s){
 const a=Math.max(1,Math.round(.7*s)),b=Math.max(a,Math.round(1.35*s));
 const score=new Float64Array(len+1).fill(-Infinity),from=new Int32Array(len+1).fill(-1);
 for(let i=1;i<=Math.min(len-1,b);i++){score[i]=val[i];from[i]=0;}
 for(let i=1;i<len;i++){if(score[i]===-Infinity)continue;for(let j=i+a;j<=Math.min(len-1,i+b);j++){const v=score[i]+val[j];if(v>score[j]){score[j]=v;from[j]=i;}}}
 let best=-1,bv=-Infinity;for(let i=Math.max(1,len-b);i<len;i++)if(score[i]>bv){bv=score[i];best=i;}
 if(best<0)return null;const cuts=[len];for(let i=best;i>0;i=from[i])cuts.push(i);cuts.push(0);cuts.reverse();return {cuts,score:bv};
}
/** Edge-following grid for generated / hand-resized "pixel art" whose pseudo-pixels vary in size.
 * Used instead of the lattice only when all of these hold (measured on the 69-case benchmark in
 * docs/pixel-bench, where they separate pseudo-pixels from true resamples, blur and JPEG):
 *   the colours are noisy · the lattice is not 'high' · the edges sit off the lattice (≥ 0.1 cell
 *   RMS) · the tracked cell is ≥ 3 px on both axes and roughly square (≤ 1.25:1) · the tracked cuts
 *   land on ≥ 90 % of the edge energy · for a smooth (order 2) lattice, the tracked cell agrees with
 *   it within 10 %. Confidence 'medium': two measures agree, but no exact proof as for a block grid. */
export function trackedGrid(img,P,est){
 if(!colorNoise(img).noisy)return null;
 const px=edgePeaks(P.x.d1),py=edgePeaks(P.y.d1);if(px.length<4||py.length<4)return null;
 const off=(offLattice(P.x.d1,px,est.scaleX,est.phaseX)+offLattice(P.y.d1,py,est.scaleY,est.phaseY))/2;if(off<.1)return null;
 const tx=trackAxis(P.x.d1,img.width),ty=trackAxis(P.y.d1,img.height);if(!tx||!ty)return null;
 if(tx.s<3||ty.s<3||Math.max(tx.s,ty.s)/Math.min(tx.s,ty.s)>1.25||Math.min(tx.capture,ty.capture)<.9)return null;
 if(est.order===2&&(Math.abs(tx.s/est.scaleX-1)>.1||Math.abs(ty.s/est.scaleY-1)>.1))return null;
 return {kind:'tracked',scale:+((tx.s+ty.s)/2).toFixed(3),scaleX:+tx.s.toFixed(3),scaleY:+ty.s.toFixed(3),phaseX:tx.cuts[1]%tx.s,phaseY:ty.cuts[1]%ty.s,order:1,confidence:'medium',
  offLattice:+off.toFixed(3),capture:Math.min(tx.capture,ty.capture),coherence:est.coherence,xs:tx.cuts,ys:ty.cuts,moved:0,width:tx.cuts.length-1,height:ty.cuts.length-1,lattice:{scale:est.scale,confidence:est.confidence}};
}
/** Cell boundaries that follow the edges: dynamic programming over the edge profile, every cell
 * between 0.7 and 1.35 of the typical size `s` (end cells from 0.4), maximising the edge energy on
 * the cuts. `strength` = mean energy on the cuts / mean energy overall (1 = no better than chance). */
export function trackBoundaries(prof,len,s,{lo=.7,hi=1.35,end=.4}={}){
 const a=Math.max(1,Math.round(lo*s)),b=Math.max(a,Math.round(hi*s)),e0=Math.max(1,Math.round(end*s));
 const score=new Float64Array(len+1).fill(-Infinity),from=new Int32Array(len+1).fill(-1);
 for(let i=e0;i<=Math.min(len-1,b);i++){score[i]=prof[i];from[i]=0;}
 for(let i=1;i<len;i++){if(score[i]===-Infinity)continue;for(let j=i+a;j<=Math.min(len-1,i+b);j++){const v=score[i]+prof[j];if(v>score[j]){score[j]=v;from[j]=i;}}}
 let best=-1,bv=-Infinity;for(let i=Math.max(1,len-b);i<=len-e0;i++)if(score[i]>bv){bv=score[i];best=i;}
 if(best<0)return {cuts:[0,len],strength:0};
 const cuts=[len];for(let i=best;i>0;i=from[i])cuts.push(i);cuts.push(0);cuts.reverse();
 let total=0;for(let i=1;i<len;i++)total+=prof[i];const on=cuts.slice(1,-1).reduce((sum,i)=>sum+prof[i],0)/Math.max(1,cuts.length-2);
 return {cuts,strength:total?on/(total/Math.max(1,len-1)):0};
}
/** Up to `max` rows (x) and columns (y) with the most edge energy, as premultiplied intensity lines. */
function smoothLines({data:d,width:w,height:h},max=40){
 const v=(p)=>(d[p*4]+d[p*4+1]+d[p*4+2])*d[p*4+3]/255+d[p*4+3];
 const pick=(n,len,get)=>{const score=[];for(let i=0;i<n;i++){let e=0;for(let j=1;j<len;j++)e+=Math.abs(get(i,j)-get(i,j-1));score.push([e,i]);}
  return score.sort((a,b)=>b[0]-a[0]||a[1]-b[1]).slice(0,max).map(([,i])=>Float64Array.from({length:len},(_,j)=>get(i,j)));};
 return {x:pick(h,w,(y,x)=>v(y*w+x)),y:pick(w,h,(x,y)=>v(y*w+x))};
}
function cutsAt(len,s,phase){const out=[0];for(let b=phase||s;b<len;b+=s)if(b>0)out.push(b);out.push(len);if(out.length>2&&out[1]<s*.5)out.splice(1,1);if(out.length>2&&len-out[out.length-2]<s*.5)out.splice(out.length-2,1);return out;}
// ------------------------------------------------------------------ cells → pixels
/** One pixel per grid cell. `inner` = share of the cell kept around its centre (0.5 drops the outer
 * quarter on each side, where resampling mixes neighbours). */
export function sampleCells(img,grid,opts={}){
 return grid.order===2?sampleSmooth(img,grid,opts):sampleBlocks(img,grid,opts);
}
/** Smooth resamples (bilinear and friends): the image is modelled as a linear interpolation
 * between the original sample centres (continuous position phase + (k+½)·s), and the 1× samples
 * are solved for by least squares, one axis at a time (the operator is separable and its normal
 * matrix tridiagonal, so this is exact and O(n)). Colours are premultiplied by alpha for the solve,
 * as resamplers do. For a true bilinear upscale this inverts the resample (±1 level); for bicubic
 * or JPEG'd input it is the closest bilinear explanation. Near-identical results are unified by the
 * colour merge step afterwards. */
function sampleSmooth(img,grid,{alphaCut=128}={}){
 const {data:d,width:w,height:h}=img,W=grid.xs.length-1,H=grid.ys.length-1;
 const centres=(cuts,n,s,phase)=>Array.from({length:n},(_,k)=>{const mid=(cuts[k]+cuts[k+1])/2,m=Math.round((mid-phase)/s-.5);return phase+(m+.5)*s;});
 const cxs=centres(grid.xs,W,grid.scaleX,grid.phaseX),cys=centres(grid.ys,H,grid.scaleY,grid.phaseY);
 // premultiplied float planes
 const src=new Float64Array(w*h*4);for(let p=0;p<w*h;p++){const a=d[p*4+3]/255;src[p*4]=d[p*4]*a;src[p*4+1]=d[p*4+1]*a;src[p*4+2]=d[p*4+2]*a;src[p*4+3]=d[p*4+3];}
 const rowsOut=new Float64Array(W*h*4),out=new Float64Array(W*H*4);
 const solveX=taps(w,cxs),solveY=taps(h,cys);
 for(let y=0;y<h;y++)for(let c=0;c<4;c++){const line=new Float64Array(w);for(let x=0;x<w;x++)line[x]=src[(y*w+x)*4+c];const r=solveX(line);for(let k=0;k<W;k++)rowsOut[(y*W+k)*4+c]=r[k];}
 for(let k=0;k<W;k++)for(let c=0;c<4;c++){const line=new Float64Array(h);for(let y=0;y<h;y++)line[y]=rowsOut[(y*W+k)*4+c];const r=solveY(line);for(let j=0;j<H;j++)out[(j*W+k)*4+c]=r[j];}
 const px=new Uint8Array(W*H*4);
 for(let p=0;p<W*H;p++){const a=out[p*4+3];if(a<alphaCut)continue;for(let c=0;c<3;c++)px[p*4+c]=Math.max(0,Math.min(255,Math.round(out[p*4+c]*255/Math.max(1,Math.min(255,a)))));px[p*4+3]=255;}
 return {data:px,width:W,height:H,solved:true};
}
/** Sample centres of the cells a lattice (s, phase) cuts a line of `len` pixels into (same rule
 * as the cuts: an end sliver under half a cell joins its neighbour). */
export function latticeCentres(len,s,phase){
 const cuts=cutsAt(len,s,phase);return Array.from({length:cuts.length-1},(_,k)=>{const mid=(cuts[k]+cuts[k+1])/2,m=Math.round((mid-phase)/s-.5);return phase+(m+.5)*s;});
}
/** Refines (s, phase) of one axis of a smooth resample by least squares: the lattice whose linear
 * interpolation explains `lines` (signals along that axis) with the smallest residual. */
export function fitSmoothAxis(lines,len,s0,phase0,{range=.02}={}){
 const cost=(s,ph)=>{const c=latticeCentres(len,s,((ph%s)+s)%s);if(c.length<2)return Infinity;const solve=taps(len,c,true);let e=0;for(const l of lines)e+=solve(l);return e;};
 let best={s:s0,phase:phase0,e:cost(s0,phase0)};
 for(let s=Math.max(1.4,s0-range);s<=s0+range+1e-9;s+=.002)for(let k=0;k<24;k++){const ph=phase0+(k-12)*s/48,e=cost(s,ph);if(e<best.e)best={s,phase:((ph%s)+s)%s,e};}
 const b2=best;for(let s=b2.s-.002;s<=b2.s+.002+1e-9;s+=.0004)for(let k=-6;k<=6;k++){const ph=b2.phase+k*s/200,e=cost(s,ph);if(e<best.e)best={s:+s.toFixed(4),phase:((ph%s)+s)%s,e};}
 return best;
}
/** Least-squares inverse of 1-D linear interpolation through `centres` (continuous positions) for
 * a line of `len` pixels: returns fn(line) → samples. Pixels outside the first/last centre take the
 * end sample (clamped, like resamplers do at borders). */
function taps(len,centres,residual=false){
 const n=centres.length,rows=[];
 for(let x=0;x<len;x++){const X=x+.5;let k=0;while(k<n-1&&centres[k+1]<=X)k++;
  if(X<=centres[0]||n===1)rows.push([0,1,0,0]);else if(k>=n-1)rows.push([n-1,1,0,0]);
  else{const f=(X-centres[k])/(centres[k+1]-centres[k]);rows.push([k,1-f,k+1,f]);}}
 // normal matrix (tridiagonal): diag, upper
 const dg=new Float64Array(n).fill(1e-6),up=new Float64Array(n);
 for(const [a,wa,b,wb]of rows){dg[a]+=wa*wa;if(wb){dg[b]+=wb*wb;up[a]+=wa*wb;}}
 return line=>{const rhs=new Float64Array(n);rows.forEach(([a,wa,b,wb],x)=>{rhs[a]+=wa*line[x];if(wb)rhs[b]+=wb*line[x];});
  // Thomas algorithm
  const c=new Float64Array(n),r=new Float64Array(n);c[0]=up[0]/dg[0];r[0]=rhs[0]/dg[0];
  for(let i=1;i<n;i++){const m=dg[i]-up[i-1]*c[i-1];c[i]=up[i]/m;r[i]=(rhs[i]-up[i-1]*r[i-1])/m;}
  for(let i=n-2;i>=0;i--)r[i]-=c[i]*r[i+1];
  if(!residual)return r;
  let e=0;rows.forEach(([a,wa,b,wb],x)=>{const v=wa*r[a]+(wb?wb*r[b]:0)-line[x];e+=v*v;});return e;};
}
function sampleBlocks(img,grid,{inner=.5,alphaCut=128,modeShare=.5,noisy=false}={}){
 view(img);const {data:d,width:w}=img,{xs,ys}=grid,W=xs.length-1,H=ys.length-1,out=new Uint8Array(W*H*4);
 let modeCells=0,medoidCells=0;
 for(let cy=0;cy<H;cy++)for(let cx=0;cx<W;cx++){
  const [x0,x1]=shrink(xs[cx],xs[cx+1],inner),[y0,y1]=shrink(ys[cy],ys[cy+1],inner);
  let opaque=0,total=0;const counts=new Map(),px=[];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*4;total++;if(d[i+3]<alphaCut)continue;opaque++;const k=(d[i]|d[i+1]<<8|d[i+2]<<16)>>>0;counts.set(k,(counts.get(k)||0)+1);px.push(k);}
  const o=(cy*W+cx)*4;if(!total||opaque*2<total)continue;
  let best=0,n=0;for(const [k,c]of counts)if(c>n||c===n&&k<best){best=k;n=c;}
  let k=best;
  if(n<modeShare*opaque&&counts.size>2){k=medoid(counts);medoidCells++;
   // noisy input: average the pixels that agree with the medoid (JPEG noise cancels, mixels stay out)
   if(noisy){const ml=oklab(k&255,k>>>8&255,k>>>16&255);let r=0,g=0,b=0,m=0;for(const [q,c]of counts){const l=oklab(q&255,q>>>8&255,q>>>16&255);if(Math.hypot(l[0]-ml[0],l[1]-ml[1],l[2]-ml[2])<=.06){r+=(q&255)*c;g+=(q>>>8&255)*c;b+=(q>>>16&255)*c;m+=c;}}
    if(m)k=(Math.round(r/m)|Math.round(g/m)<<8|Math.round(b/m)<<16)>>>0;}}
  else modeCells++;
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
export function mergeColors(img,{threshold=.04,maxColors=0,represent='mode'}={}){
 view(img);const d=img.data,count=new Map();
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const k=(d[i]|d[i+1]<<8|d[i+2]<<16)>>>0;count.set(k,(count.get(k)||0)+1);}
 const keys=[...count].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).map(e=>e[0]),rgb=k=>[k&255,k>>>8&255,k>>>16&255];
 const reps=[],repLab=[],map=new Map(),t2=threshold*threshold;
 for(const k of keys){const c=rgb(k),l=oklab(...c);let hit=-1,bd=t2;
  for(let r=0;r<reps.length;r++){const q=repLab[r],e=(l[0]-q[0])**2+(l[1]-q[1])**2+(l[2]-q[2])**2;if(e<=bd){bd=e;hit=r;}}
  if(hit<0){reps.push(c);repLab.push(l);hit=reps.length-1;}map.set(k,hit);}
 // each group's colour: 'mode' keeps the most frequent member (a real colour of the image); 'mean'
 // is the count-weighted mean of the members, which for JPEG / resample noise is the noise-free centre
 if(represent==='mean'){const members=reps.map(()=>[0,0,0,0]);for(const [k,n]of count){const m=members[map.get(k)],c=rgb(k);m[0]+=c[0]*n;m[1]+=c[1]*n;m[2]+=c[2]*n;m[3]+=n;}
  members.forEach((m,r)=>{reps[r]=[0,1,2].map(c=>Math.round(m[c]/m[3]));repLab[r]=oklab(...reps[r]);});}
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
/** Is the image noisy (JPEG, AI pseudo-pixels, smooth resample leftovers) or clean pixel art?
 * Clean art spends almost all its pixels on a few exact colours; noise spreads them over many.
 * @returns {noisy, top (share of opaque pixels in the `top` most used colours), distinct} */
export function colorNoise(img,{top=32,clean=.97}={}){
 const d=img.data,count=new Map();let n=0;
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;n++;const k=(d[i]|d[i+1]<<8|d[i+2]<<16)>>>0;count.set(k,(count.get(k)||0)+1);}
 const share=n?[...count.values()].sort((a,b)=>b-a).slice(0,top).reduce((s,x)=>s+x,0)/n:1;
 return {noisy:share<clean,share:+share.toFixed(4),distinct:count.size};
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
