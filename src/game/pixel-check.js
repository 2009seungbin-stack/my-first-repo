/** Pixel-perfect checks for sprites that arrive already upscaled, blurred or off-grid, plus the
 * integer scaler and silhouette view. Pure — no DOM; callers hand in {data,width,height} RGBA.
 *
 * Nothing here scores an image. Each check reports a measurement and, where a repair is exact
 * (an integer block grid), offers it; where it is not, it says so and offers nothing. */
import {oklab} from '../pixel-engine.js';
export const MAX_SCALE=16;
const view=s=>{
 if(!s||!(s.data instanceof Uint8ClampedArray||s.data instanceof Uint8Array)||s.data.length!==s.width*s.height*4)throw Error('Needs {data,width,height} RGBA pixels');
 return s;
};
const at=(d,i)=>d[i]<<24|d[i+1]<<16|d[i+2]<<8|d[i+3];
/** Where the image actually changes colour. Every s×s block is one colour exactly when no colour
 * change happens inside a block, i.e. when every changing column and row sits on a block boundary.
 * Finding the change positions once turns block detection into arithmetic on those positions
 * instead of a scan per candidate scale. */
export function gridAnalysis(source){
 const {data:d,width:w,height:h}=view(source),columns=[],rows=[];
 for(let x=1;x<w;x++)for(let y=0;y<h;y++)if(at(d,(y*w+x)*4)!==at(d,(y*w+x-1)*4)){columns.push(x);break;}
 for(let y=1;y<h;y++)for(let x=0;x<w;x++)if(at(d,(y*w+x)*4)!==at(d,((y-1)*w+x)*4)){rows.push(y);break;}
 return {columns,rows,width:w,height:h};
}
/** The one residue every change position shares modulo s, or -1 when they disagree. */
function residue(positions,s){
 if(!positions.length)return 0;const r=positions[0]%s;
 for(const p of positions)if(p%s!==r)return -1;
 return r;
}
/** Run lengths of identical colour along rows and columns. A clean k× sprite has every run a
 * multiple of k; a 2.5× nearest resize alternates 2 and 3; a bilinear resize has runs of 1. */
export function runLengths(source){
 const {data:d,width:w,height:h}=view(source),counts=new Map();let runs=0,total=0;
 const push=n=>{counts.set(n,(counts.get(n)||0)+1);runs++;total+=n;};
 for(let y=0;y<h;y++){let n=1;for(let x=1;x<=w;x++){if(x<w&&at(d,(y*w+x)*4)===at(d,(y*w+x-1)*4))n++;else{push(n);n=1;}}}
 for(let x=0;x<w;x++){let n=1;for(let y=1;y<=h;y++){if(y<h&&at(d,(y*w+x)*4)===at(d,((y-1)*w+x)*4))n++;else{push(n);n=1;}}}
 const min=Math.min(...counts.keys()),max=Math.max(...counts.keys());
 // The shortest runs carry the scale: a long run is several same-coloured blocks in a row, so
 // averaging everything over-estimates. Only runs within 1.5x of the shortest one are averaged.
 let shortSum=0,shortRuns=0;
 for(const [length,n] of counts)if(length<=min*1.5){shortSum+=length*n;shortRuns+=n;}
 return {counts,runs,mean:runs?total/runs:0,shortMean:shortRuns?shortSum/shortRuns:0,min,max};
}
/** Logical pixel size of an upscaled sprite. Tries the largest integer block size that divides the
 * image and leaves every block one colour; if none fits the grid, it retries with an offset so
 * off-grid crops are still recognised, and otherwise reports the run-length estimate instead of
 * pretending to have found a scale. */
export function detectScale(source,{maxScale=MAX_SCALE}={}){
 const {width:w,height:h}=view(source),limit=Math.max(1,Math.min(maxScale,Math.min(w,h))),grid=gridAnalysis(source);
 // A single-colour image has no block grid to find, and one with changes on only one axis cannot
 // have its other axis measured; both are reported rather than answered with a guess.
 const evidence=grid.columns.length>0&&grid.rows.length>0;
 let aligned=null;
 if(grid.columns.length||grid.rows.length)for(let s=limit;s>1;s--){
  const rx=residue(grid.columns,s),ry=residue(grid.rows,s);if(rx<0||ry<0)continue;
  const offset={x:(s-rx)%s,y:(s-ry)%s},hit={scale:s,offset,exact:true,divides:w%s===0&&h%s===0,confident:evidence,estimate:s,grid};
  if(!offset.x&&!offset.y)return hit;
  aligned=aligned||hit;
 }
 if(aligned)return aligned;
 const runs=runLengths(source),unit=(runs.counts.get(1)||0)/(runs.runs||1);
 // No integer block grid: either the sprite is already 1× / interpolated (runs of a single pixel
 // exist) or it was resized by a non-integer factor (every run is 2–3 px but never 1).
 return {scale:1,offset:{x:0,y:0},exact:false,divides:true,confident:false,estimate:Number(runs.shortMean.toFixed(3)),unitShare:Number(unit.toFixed(4)),runs,grid};
}
/** Blur / interpolation evidence along edges: a pixel counts as intermediate when its colour is
 * strictly between two of its opposite neighbours in Oklab (within `tolerance` of the segment and
 * not equal to either end). Bilinear upscales are full of these; nearest upscales have none. */
export function edgeQuality(source,{tolerance=.02}={}){
 const {data:d,width:w,height:h}=view(source);
 const lab=new Float32Array(w*h*3),solid=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const i=p*4;if(!d[i+3])continue;solid[p]=1;const c=oklab(d[i],d[i+1],d[i+2]);lab[p*3]=c[0];lab[p*3+1]=c[1];lab[p*3+2]=c[2];}
 let edges=0,intermediate=0,partialAlpha=0;
 for(let p=0;p<w*h;p++){
  const i=p*4;if(d[i+3]&&d[i+3]<255)partialAlpha++;
  if(!solid[p])continue;
  const x=p%w,y=(p-x)/w;let isEdge=false,between=false;
  for(const [dx,dy] of [[1,0],[0,1]]){
   const a=x-dx,b=x+dx,ay=y-dy,by=y+dy;
   if(a<0||ay<0||b>=w||by>=h)continue;
   const pa=ay*w+a,pb=by*w+b;if(!solid[pa]||!solid[pb])continue;
   const ka=at(d,pa*4),kb=at(d,pb*4),kp=at(d,i);
   if(ka!==kb)isEdge=true;
   if(ka===kb||kp===ka||kp===kb)continue;
   const A=[lab[pa*3],lab[pa*3+1],lab[pa*3+2]],B=[lab[pb*3],lab[pb*3+1],lab[pb*3+2]],P=[lab[p*3],lab[p*3+1],lab[p*3+2]];
   const ab=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],len=ab[0]**2+ab[1]**2+ab[2]**2;if(len<1e-9)continue;
   const t=((P[0]-A[0])*ab[0]+(P[1]-A[1])*ab[1]+(P[2]-A[2])*ab[2])/len;
   if(t<=.05||t>=.95)continue;
   if(Math.hypot(P[0]-A[0]-ab[0]*t,P[1]-A[1]-ab[1]*t,P[2]-A[2]-ab[2]*t)<=tolerance)between=true;
  }
  if(isEdge)edges++;
  if(between)intermediate++;
 }
 return {edges,intermediate,partialAlpha,share:edges?intermediate/edges:0};
}
/** Edge energy between neighbouring columns (axis 'x') or rows ('y'): position i is the
 * boundary between line i-1 and line i. Alpha counts double so a silhouette edge weighs in. */
function edgeProfile({data:d,width:w,height:h},axis,order=1){
 const len=axis==='x'?w:h,across=axis==='x'?h:w,out=new Float64Array(len),step=axis==='x'?4:w*4;
 for(let i=order;i<len;i++){let sum=0;
  for(let j=0;j<across;j++){
   const a=axis==='x'?(j*w+i)*4:(i*w+j)*4,b=a-step,c=b-step;
   for(let k=0;k<4;k++){const v=order===1?d[a+k]-d[b+k]:d[a+k]-2*d[b+k]+d[c+k];sum+=(k===3?2:1)*Math.abs(v);}}
  out[i]=sum;}
 return out;
}
/** Phase coherence of edge positions at period s: 1 when every edge sits on one lattice
 * {offset + k·s}, ~0 when edges are spread evenly. This is the magnitude of the profile's Fourier
 * coefficient at frequency 1/s, normalised by the total edge energy — it works for any real s,
 * which is what a 3.78× bilinear resize needs. */
function coherence(profile,s){
 let re=0,im=0,total=0;const k=2*Math.PI/s;
 for(let i=1;i<profile.length;i++){const e=profile[i];if(!e)continue;re+=e*Math.cos(k*i);im+=e*Math.sin(k*i);total+=e;}
 return total?Math.hypot(re,im)/total:0;
}
/** Scale of an image that was upscaled from pixel art by *any* factor, with or without smoothing.
 * An integer nearest-neighbour upscale is found exactly by detectScale; this is for the rest — a
 * 3.78× bilinear resize has no block grid and runs of one pixel, so the block and run-length
 * checks both call it "1×". Its edges still sit on a lattice of spacing ≈3.78, and that lattice
 * is what is measured (both axes, periods 1.5…maxScale in 0.005 steps).
 * Harmonics: a lattice of spacing s is also a lattice of s/2, s/3 …, so the largest period that
 * scores nearly as well as the best one is taken.
 * @returns {scale, coherence, prominence, confidence:'high'|'medium'|'low', integer, candidates} */
export function estimateResample(source,{minScale=1.5,maxScale=MAX_SCALE,step=.005}={}){
 // First differences put a nearest-then-smoothed edge on the lattice; a plain bilinear resize
 // spreads each step into a ramp, and its lattice shows in the second differences instead (the
 // kinks where the ramps meet sit on the original sample positions). Both are measured.
 const img=view(source),px=edgeProfile(img,'x'),py=edgeProfile(img,'y'),qx=edgeProfile(img,'x',2),qy=edgeProfile(img,'y',2);
 const top=Math.min(maxScale,Math.max(minScale,Math.min(img.width,img.height)/3));
 const values=[];
 for(let s=minScale;s<=top+1e-9;s+=step){
  const cx=Math.max(coherence(px,s),coherence(qx,s)),cy=Math.max(coherence(py,s),coherence(qy,s));
  values.push({s:+s.toFixed(3),c:(cx+cy)/2,cx,cy});}
 if(!values.length)return {scale:1,coherence:0,prominence:0,confidence:'low',integer:true,candidates:[]};
 const peaks=values.filter((v,i)=>(i===0||v.c>=values[i-1].c)&&(i===values.length-1||v.c>=values[i+1].c));
 const best=peaks.reduce((a,b)=>b.c>a.c?b:a,peaks[0]);
 // The fundamental: the largest period that is (nearly) a whole multiple of the best one and
 // still coheres almost as well.
 let chosen=best;
 for(const p of peaks){const ratio=p.s/best.s,k=Math.round(ratio);
  if(k>=2&&Math.abs(ratio-k)<=.03*k&&p.c>=best.c*.8&&p.s>chosen.s)chosen=p;}
 const sorted=values.map(v=>v.c).sort((a,b)=>a-b),median=sorted[sorted.length>>1]||1e-9;
 const prominence=chosen.c/Math.max(1e-9,median);
 const confidence=chosen.c>=.5&&prominence>=3?'high':chosen.c>=.45&&prominence>=2?'medium':'low';
 const nearest=Math.round(chosen.s);
 return {scale:chosen.s,coherence:+chosen.c.toFixed(3),prominence:+prominence.toFixed(2),confidence,
  integer:Math.abs(chosen.s-nearest)<=Math.max(.02,nearest*.006),axes:{x:+chosen.cx.toFixed(3),y:+chosen.cy.toFixed(3)},
  candidates:peaks.sort((a,b)=>b.c-a.c).slice(0,4).map(p=>({scale:p.s,coherence:+p.c.toFixed(3)}))};
}
/** Recover the 1× source of a clean integer upscale by reading one pixel per block. Only call it
 * when detectScale reported `exact`; otherwise the block colour is a guess, not a recovery. */
export function recoverSource(source,scale,offset={x:0,y:0}){
 const {data:d,width:w,height:h}=view(source),s=scale;
 if(!Number.isInteger(s)||s<1)throw Error('Recovering a 1× source needs a whole-number scale');
 const ox=((offset.x||0)%s+s)%s,oy=((offset.y||0)%s+s)%s;
 const width=Math.ceil((w+ox)/s),height=Math.ceil((h+oy)/s),out=new Uint8ClampedArray(width*height*4);
 for(let by=0;by<height;by++)for(let bx=0;bx<width;bx++){
  const x=Math.max(0,bx*s-ox),y=Math.max(0,by*s-oy);if(x>=w||y>=h)continue;
  const i=(y*w+x)*4,o=(by*width+bx)*4;out[o]=d[i];out[o+1]=d[i+1];out[o+2]=d[i+2];out[o+3]=d[i+3];
 }
 return {data:out,width,height};
}
/** Nearest-neighbour integer upscale. Exact pixel replication, no filtering, no half pixels. */
export function nearestScale(source,scale){
 const {data:d,width:w,height:h}=view(source),s=Math.round(scale);
 if(!Number.isInteger(s)||s<1||s>64)throw Error('Integer scale must be 1–64');
 const width=w*s,height=h*s,out=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++){const sy=(y/s|0)*w;for(let x=0;x<width;x++){const i=(sy+(x/s|0))*4,o=(y*width+x)*4;out[o]=d[i];out[o+1]=d[i+1];out[o+2]=d[i+2];out[o+3]=d[i+3];}}
 return {data:out,width,height};
}
/** Flat silhouette: every visible pixel one colour, alpha untouched. Reads as a shape check, and
 * doubles as the reference an edit must not move. */
export function silhouette(source,color=[17,17,17]){
 const {data:d,width,height}=view(source),out=new Uint8ClampedArray(d.length);
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;out[i]=color[0];out[i+1]=color[1];out[i+2]=color[2];out[i+3]=d[i+3];}
 return {data:out,width,height};
}
/** Alpha mask as a bitset, for comparing silhouettes before and after an edit. */
export const alphaMask=(source,threshold=1)=>{const {data:d}=view(source),out=new Uint8Array(d.length/4);for(let p=0;p<out.length;p++)out[p]=d[p*4+3]>=threshold?1:0;return out;};
export function maskDifference(a,b){
 if(a.length!==b.length)throw Error('Masks describe different images');
 let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;return changed;
}
/** The whole Check stage in one call: what the frame is, not how good it is. */
export function inspect(source,{targetColors=0,maxScale=MAX_SCALE}={}){
 const {width,height}=view(source),scale=detectScale(source,{maxScale}),edges=edgeQuality(source),colors=new Set();
 const {data:d}=source;let opaque=0;
 for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;opaque++;colors.add(d[i]<<16|d[i+1]<<8|d[i+2]);}
 const blurred=edges.share>=.25||edges.partialAlpha>0;
 // 'integer'     — a block grid was proven (exact, recoverable);
 // 'resampled'   — no block grid, but the edges sit on a lattice of spacing > 1: the art was
 //                 scaled by a non-integer factor and/or smoothed (bilinear). Reported with the
 //                 measured scale and a confidence; nothing is "recovered" from it;
 // 'unit'        — single-pixel detail on no coarser lattice: already 1× (blurred if flagged);
 // 'non-integer' — every run is 2+ px but neither a grid nor a lattice was found.
 let verdict=scale.confident&&scale.scale>1?'integer':scale.exact||(scale.unitShare??1)>=.02?'unit':'non-integer',resample=null;
 if(verdict==='integer')resample={kind:'integer',scale:scale.scale,integer:true,smoothed:false,confidence:'high',coherence:1};
 else if(verdict==='non-integer'&&scale.estimate>=1.4){
  // Every run is 2+ px and no block grid fits: a nearest-neighbour resize by a fractional factor
  // (runs alternate 2 and 3 at 2.5×). The run lengths measure it better than a lattice would.
  const nearest=Math.round(scale.estimate);
  resample={kind:'resampled',scale:scale.estimate,integer:Math.abs(scale.estimate-nearest)<=.02,smoothed:false,confidence:'medium',coherence:null};
 }else{
  const r=estimateResample(source,{maxScale});
  // Crisp 1× art on a sheet repeats with its cell pitch, which is a lattice too. What a resize
  // leaves behind and a crisp sheet does not is smoothing (in-between colours, partial alpha); a
  // crisp image needs an overwhelming lattice before it is called resampled.
  const convincing=blurred?r.confidence!=='low':r.confidence==='high'&&r.coherence>=.6&&r.prominence>=4;
  if(convincing&&r.scale>=1.4){
   resample={kind:'resampled',scale:r.scale,integer:r.integer,smoothed:blurred,confidence:r.confidence,coherence:r.coherence,prominence:r.prominence,candidates:r.candidates};
   verdict='resampled';
  }
 }
 return {width,height,opaque,distinct:colors.size,scale,edges,verdict,resample,blurred,
  logical:verdict==='integer'?{width:Math.ceil((width+scale.offset.x)/scale.scale),height:Math.ceil((height+scale.offset.y)/scale.scale)}:null,
  offGrid:verdict==='integer'&&(scale.offset.x>0||scale.offset.y>0||!scale.divides),
  budget:targetColors?{target:Math.round(targetColors),actual:colors.size,over:Math.max(0,colors.size-Math.round(targetColors))}:null};
}
