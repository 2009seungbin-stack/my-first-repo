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
 return {counts,runs,mean:runs?total/runs:0,min:Math.min(...counts.keys()),max:Math.max(...counts.keys())};
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
 return {scale:1,offset:{x:0,y:0},exact:false,divides:true,confident:false,estimate:Number(runs.mean.toFixed(3)),unitShare:Number(unit.toFixed(4)),runs,grid};
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
 // 'integer' — a block grid was proven; 'unit' — single-pixel detail exists, so it is already 1×
 // (blurred if the edge share is high); 'non-integer' — every run is 2+ px but no grid fits.
 const verdict=scale.confident&&scale.scale>1?'integer':scale.exact||(scale.unitShare??1)>=.02?'unit':'non-integer';
 return {width,height,opaque,distinct:colors.size,scale,edges,verdict,blurred:edges.share>=.25||edges.partialAlpha>0,
  logical:verdict==='integer'?{width:Math.ceil((width+scale.offset.x)/scale.scale),height:Math.ceil((height+scale.offset.y)/scale.scale)}:null,
  offGrid:verdict==='integer'&&(scale.offset.x>0||scale.offset.y>0||!scale.divides),
  budget:targetColors?{target:Math.round(targetColors),actual:colors.size,over:Math.max(0,colors.size-Math.round(targetColors))}:null};
}
