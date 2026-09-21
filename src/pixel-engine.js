/** Oklab palette clustering, alpha-preserving quantization and bounded error rows. */
const linear=Array.from({length:256},(_,v)=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4);
export function oklab(r,g,b){
 r=linear[Math.max(0,Math.min(255,Math.round(r)))];g=linear[Math.max(0,Math.min(255,Math.round(g)))];b=linear[Math.max(0,Math.min(255,Math.round(b)))];
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
export function parsePalette(text){
 if(Array.isArray(text)){if(text.length>256||text.some(c=>!Array.isArray(c)||c.length!==3||c.some(v=>!Number.isInteger(v)||v<0||v>255)))throw Error('Invalid custom palette');return text.map(c=>[...c]);}
 if(!text?.trim())return [];const colors=[];
 for(const line of text.split(/\r?\n/)){
  const s=line.trim();if(!s)continue;const hex=s.match(/^#?([a-f\d]{6})$/i),gpl=s.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/);
  if(hex)colors.push([0,2,4].map(i=>parseInt(hex[1].slice(i,i+2),16)));
  else if(gpl&&gpl.slice(1).every(v=>+v<=255))colors.push(gpl.slice(1).map(Number));
  else if(!/^(#|GIMP Palette|Name:|Columns:)/.test(s))throw Error('Use one #RRGGBB color per line, or a GIMP palette.');
 }
 if(!colors.length||colors.length>256)throw Error('A palette needs 1–256 colors');return [...new Map(colors.map(c=>[c.join(','),c])).values()];
}
/** Alpha-weighted 5-bit histogram. Several images can share one so a palette extracted from a
 * whole animation weighs every frame at once instead of averaging per-frame palettes. */
export function accumulate(data,histogram=new Map()){
 for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;if(!a)continue;const key=(data[i]>>3)<<10|(data[i+1]>>3)<<5|(data[i+2]>>3);let c=histogram.get(key);if(!c)histogram.set(key,c=[0,0,0,0]);for(let k=0;k<3;k++)c[k]+=data[i+k]*a;c[3]+=a;}
 return histogram;
}
/** Weighted median-cut in Oklab (widest axis × mass, so frequency and perceptual spread both
 * matter) followed by Lloyd refinement with RGB centroids, which keeps the palette in gamut. */
export function paletteFromHistogram(histogram,count){
 const points=[...histogram.values()].map(p=>{const rgb=p.slice(0,3).map(v=>v/p[3]);return {rgb,lab:oklab(...rgb),weight:p[3]};});
 if(!points.length)return [[0,0,0]];
 const boxes=[points];while(boxes.length<count){
  let best=-1,bestScore=0,axis=0;
  boxes.forEach((box,index)=>{if(box.length<2)return;const ranges=[0,1,2].map(k=>{let lo=Infinity,hi=-Infinity;for(const p of box){lo=Math.min(lo,p.lab[k]);hi=Math.max(hi,p.lab[k]);}return hi-lo;});const range=Math.max(...ranges),score=range*box.reduce((n,p)=>n+p.weight,0);if(score>bestScore){bestScore=score;best=index;axis=ranges.indexOf(range);}});
  if(best<0)break;const box=boxes[best].sort((a,b)=>a.lab[axis]-b.lab[axis]),half=box.reduce((n,p)=>n+p.weight,0)/2;let mass=0,at=1;for(;at<box.length;at++){mass+=box[at-1].weight;if(mass>=half)break;}
  // One heavy point can push the median past the last entry; clamping keeps both halves
  // non-empty, because an empty box has no mass and would average to a NaN colour.
  at=Math.min(Math.max(1,at),box.length-1);boxes.splice(best,1,box.slice(0,at),box.slice(at));
 }
 let palette=boxes.map(box=>{const mass=box.reduce((n,p)=>n+p.weight,0);return [0,1,2].map(k=>Math.round(box.reduce((n,p)=>n+p.rgb[k]*p.weight,0)/mass));});
 // Lloyd refinement in perceptual space; RGB centroids keep the palette in gamut.
 for(let iteration=0;iteration<4;iteration++){
  const labs=palette.map(c=>oklab(...c)),sums=palette.map(()=>[0,0,0,0]);
  for(const p of points){let best=0,d=Infinity;for(let i=0;i<labs.length;i++){const e=distance(p.lab,labs[i]);if(e<d){d=e;best=i;}}const s=sums[best];for(let k=0;k<3;k++)s[k]+=p.rgb[k]*p.weight;s[3]+=p.weight;}
  palette=palette.map((c,i)=>sums[i][3]?sums[i].slice(0,3).map(v=>Math.round(v/sums[i][3])):c);
 }
 return palette.filter(c=>c.every(Number.isFinite));
}
export const perceptualPalette=(data,count)=>paletteFromHistogram(accumulate(data),count);
/** Ordered dither matrices, built by the recursive Bayer rule M(2n) = [[4M, 4M+2],[4M+3, 4M+1]]. */
function bayerMatrix(n){
 if(n===1)return [0];const half=n/2,inner=bayerMatrix(half),out=new Array(n*n),corner=[0,2,3,1];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)out[y*n+x]=4*inner[(y%half)*half+x%half]+corner[(y<half?0:2)+(x<half?0:1)];
 return out;
}
export const BAYER=Object.freeze({2:Object.freeze(bayerMatrix(2)),4:Object.freeze(bayerMatrix(4)),8:Object.freeze(bayerMatrix(8))});
/** Every dither the Labs offer. 'ordered' and 'bayer' stay as aliases of the 4×4 matrix so old
 * links and saved presets keep meaning what they meant. */
export const DITHER_MODES=Object.freeze(['none','floyd-steinberg','atkinson','bayer2','bayer4','bayer8']);
const FLOYD=Object.freeze([[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]]);
// Atkinson keeps only 6/8 of the error, which is why it holds contrast on flat pixel-art shading.
const ATKINSON=Object.freeze([[1,0,1/8],[2,0,1/8],[-1,1,1/8],[0,1,1/8],[1,1,1/8],[0,2,1/8]]);
export function ditherKernel(mode='none'){
 if(mode==='none'||!mode)return {kind:'none'};
 if(mode==='atkinson')return {kind:'diffusion',weights:ATKINSON,rows:3,retained:6/8};
 const n=mode==='bayer2'?2:mode==='bayer8'?8:['bayer4','bayer','ordered'].includes(mode)?4:0;
 if(n)return {kind:'ordered',n,matrix:BAYER[n]};
 return {kind:'diffusion',weights:FLOYD,rows:2,retained:1};
}
/** The one quantizer every Lab stage uses. Returns both the RGBA result and the palette index
 * per pixel (-1 where alpha is 0), because the index is what proves two frames agree. */
export function quantizeIndexed(data,w,h,palette,{mode='none',amount=1,labs=null}={}){
 if(!Array.isArray(palette)||!palette.length)throw Error('A palette needs 1–256 colors');
 const L=labs||palette.map(c=>oklab(...c)),kernel=ditherKernel(mode),out=new Uint8ClampedArray(data.length),indices=new Int16Array(w*h).fill(-1);
 const diffusion=kernel.kind==='diffusion'&&amount>0,ordered=kernel.kind==='ordered'&&amount>0;
 const center=ordered?(kernel.n*kernel.n-1)/(2*kernel.n*kernel.n):0;
 // One row buffer per row the kernel can reach; 2 columns of slack on each side hold dx = ±2.
 const rows=diffusion?Array.from({length:kernel.rows},()=>new Float32Array((w+4)*3)):null;
 for(let y=0;y<h;y++){
  const reverse=diffusion&&y%2===1,step=reverse?-1:1;
  for(let t=0;t<w;t++){
   const x=reverse?w-1-t:t,i=(y*w+x)*4;if(!data[i+3])continue;
   const bias=ordered?(kernel.matrix[(y%kernel.n)*kernel.n+x%kernel.n]/(kernel.n*kernel.n)-center)*48*amount:0;
   const color=[0,1,2].map(c=>data[i+c]+bias+(rows?rows[0][(x+2)*3+c]:0)),lab=oklab(...color);let best=0,d=Infinity;
   for(let k=0;k<palette.length;k++){const e=distance(lab,L[k]);if(e<d){d=e;best=k;}}
   out.set(palette[best],i);out[i+3]=data[i+3];indices[y*w+x]=best;
   if(diffusion)for(const [dx,dy,weight] of kernel.weights){
    const nx=x+dx*step;if(nx<0||nx>=w||y+dy>=h||!data[((y+dy)*w+nx)*4+3])continue;
    const row=rows[dy];for(let c=0;c<3;c++)row[(nx+2)*3+c]+=(color[c]-palette[best][c])*weight*amount;
   }
  }
  if(diffusion){const spent=rows.shift();spent.fill(0);rows.push(spent);}
 }
 return {data:out,indices};
}
export function quantizePerceptual(data,w,h,count=16,amount=0,{palette:custom,ditherMode='floyd-steinberg'}={}){
 const locked=parsePalette(custom||[]);if(!count&&!locked.length)return new Uint8ClampedArray(data);
 const palette=locked.length?locked:perceptualPalette(data,count);
 return quantizeIndexed(data,w,h,palette,{mode:amount>0?ditherMode:'none',amount}).data;
}
