/** Seam measurement for a single repeating texture tile, and edge matching between two tiles.
 * Pure RGBA in, numbers out. A seam number on its own means nothing, so every measurement is
 * reported next to the same measurement taken between two ordinary neighbouring lines inside
 * the tile: "the wrap seam differs 6× as much as a normal neighbour" is a judgement a person
 * can act on; "mean 23.4" is not. */
import {offset as offsetHalf} from '../primitives.js';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function check(data,w,h){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<2||h<2)throw Error('A seam check needs a tile of at least 2×2');
 if(data.length!==w*h*4)throw Error('Pixel limit exceeded or invalid RGBA data');
}
/** Worst channel difference between two pixels, alpha included. */
const delta=(d,i,e,j)=>Math.max(Math.abs(d[i]-e[j]),Math.abs(d[i+1]-e[j+1]),Math.abs(d[i+2]-e[j+2]),Math.abs(d[i+3]-e[j+3]));
const stats=profile=>{
 let sum=0,max=0;
 for(const v of profile){sum+=v;if(v>max)max=v;}
 return {mean:profile.length?sum/profile.length:0,max};
};
/** Mean difference between two lines that are simply next to each other inside the tile, at the
 * same distance apart as the wrap pair. This is the "normal" a seam is compared against. */
function baseline(data,w,h,axis){
 const len=axis==='x'?w:h,across=axis==='x'?h:w,step=axis==='x'?4:w*4,jump=axis==='x'?w*4:4;
 let sum=0,n=0;
 for(let i=1;i<len;i++)for(let j=0;j<across;j++){sum+=delta(data,i*step+j*jump,data,(i-1)*step+j*jump);n++;}
 return n?sum/n:0;
}
/** Both wrap seams of one tile: right↔left and bottom↔top, with a per-line profile for a heatmap. */
export function seamReport(data,w,h){
 check(data,w,h);
 const right=new Float64Array(h),bottom=new Float64Array(w);
 for(let y=0;y<h;y++)right[y]=delta(data,(y*w+w-1)*4,data,(y*w)*4);
 for(let x=0;x<w;x++)bottom[x]=delta(data,((h-1)*w+x)*4,data,x*4);
 const bx=baseline(data,w,h,'x'),by=baseline(data,w,h,'y'),rs=stats(right),bs=stats(bottom);
 const ratio=(m,b)=>b>.5?m/b:m>1?Infinity:1;
 return {width:w,height:h,
  horizontal:{...rs,profile:right,neighbourMean:bx,ratio:ratio(rs.mean,bx)},
  vertical:{...bs,profile:bottom,neighbourMean:by,ratio:ratio(bs.mean,by)},
  seamless:rs.mean<=Math.max(2,bx*1.25)&&bs.mean<=Math.max(2,by*1.25)};
}
export const SIDES=Object.freeze(['right','left','top','bottom']);
/** How well tile `b` sits on the given side of tile `a`: the two touching lines are compared.
 * Tiles must share the edge length they would meet along. */
export function edgeMatch(a,b,side){
 check(a.data,a.w,a.h);check(b.data,b.w,b.h);
 if(!SIDES.includes(side))throw Error(`Unknown side ${side}`);
 const vertical=side==='right'||side==='left';
 if(vertical?a.h!==b.h:a.w!==b.w)throw Error('The two tiles do not share the edge they would meet along');
 const n=vertical?a.h:a.w,profile=new Float64Array(n);
 for(let i=0;i<n;i++){
  const [ax,ay]=side==='right'?[a.w-1,i]:side==='left'?[0,i]:side==='bottom'?[i,a.h-1]:[i,0];
  const [bx,by]=side==='right'?[0,i]:side==='left'?[b.w-1,i]:side==='bottom'?[i,0]:[i,b.h-1];
  profile[i]=delta(a.data,(ay*a.w+ax)*4,b.data,(by*b.w+bx)*4);
 }
 const s=stats(profile),base=baseline(a.data,a.w,a.h,vertical?'x':'y');
 return {side,...s,profile,neighbourMean:base,ratio:base>.5?s.mean/base:s.mean>1?Infinity:1,fits:s.mean<=Math.max(2,base*1.25)};
}
/** Every side pairing between two tiles, best first, so "which way round do these two go?" is
 * answered by the numbers instead of by eye. */
export function bestEdge(a,b){
 const out=[];
 for(const side of SIDES){try{out.push(edgeMatch(a,b,side));}catch{}}
 return out.sort((p,q)=>p.mean-q.mean);
}
const smooth=t=>t*t*(3-2*t);
function blendAxis(data,w,h,axis,band){
 const len=axis==='x'?w:h,across=axis==='x'?h:w,step=axis==='x'?4:w*4,jump=axis==='x'?w*4:4;
 const half=Math.floor(len/2),out=new Uint8ClampedArray(data);
 if(band<1)return out;
 for(let i=0;i<len;i++){
  const distance=Math.abs(i-half);if(distance>band)continue;
  const weight=smooth(1-distance/(band+1)),other=(i+half)%len;
  for(let j=0;j<across;j++){
   const p=i*step+j*jump,q=other*step+j*jump;
   for(let k=0;k<4;k++)out[p+k]=Math.round(data[p+k]*(1-weight)+data[q+k]*weight);
  }
 }
 return out;
}
/** Offset by half the tile so the wrap seam lands in the middle, then cross-fade across it with
 * the half-shifted copy — which is continuous exactly there. This ALTERS THE ART inside the
 * bands; the caller must show before/after and say so. */
export function makeSeamless(data,w,h,{blendX=null,blendY=null}={}){
 check(data,w,h);
 const bx=blendX===null?Math.max(1,Math.round(w*.12)):Math.round(blendX),by=blendY===null?Math.max(1,Math.round(h*.12)):Math.round(blendY);
 if(bx<0||by<0||bx>=Math.floor(w/2)||by>=Math.floor(h/2))throw Error('The blend band must be smaller than half the tile');
 const moved=offsetHalf(data,w,h);
 return blendAxis(blendAxis(moved,w,h,'x',bx),w,h,'y',by);
}
/** Values a heatmap can draw directly: 0..1 per line, relative to the worst line. */
export function heatmap(profile){
 let max=0;for(const v of profile)if(v>max)max=v;
 return {max,values:Float64Array.from(profile,v=>max?clamp(v/max,0,1):0)};
}
