/** Die-cut sticker border (흰 테두리): the picture's silhouette grown by `px` with an exact Euclidean
 * distance transform (Felzenszwalb & Huttenlocher 2012), enclosed holes filled like a real die-cut,
 * a 1 px anti-aliased edge from the sub-pixel distance, optional soft drop shadow. The canvas grows so
 * nothing is clipped. Pure and deterministic. */
import {blank} from './raster.js';

const INF=1e20;
/** 1D squared-distance transform of f (in place into d). */
function dt1(f,n,d,v,z){
 let k=0;v[0]=0;z[0]=-INF;z[1]=INF;
 for(let q=1;q<n;q++){
  let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
  while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
  k++;v[k]=q;z[k]=s;z[k+1]=INF;
 }
 k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])*(q-v[k])+f[v[k]];}
}
/** Squared Euclidean distance from every pixel to the nearest set pixel of `mask`. */
export function distanceSquared(mask,w,h){
 const g=new Float64Array(w*h);for(let i=0;i<g.length;i++)g[i]=mask[i]?0:INF;
 const n=Math.max(w,h),f=new Float64Array(n),d=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
 for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=g[y*w+x];dt1(f,h,d,v,z);for(let y=0;y<h;y++)g[y*w+x]=d[y];}
 for(let y=0;y<h;y++){for(let x=0;x<w;x++)f[x]=g[y*w+x];dt1(f,w,d,v,z);for(let x=0;x<w;x++)g[y*w+x]=d[x];}
 return g;
}
/** Transparent regions not connected to the canvas edge (holes inside the silhouette). */
function enclosed(mask,w,h){
 const out=new Uint8Array(w*h),seen=new Uint8Array(w*h),stack=[];
 const push=i=>{if(!seen[i]&&!mask[i]){seen[i]=1;stack.push(i);}};
 for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
 while(stack.length){const i=stack.pop(),x=i%w,y=(i-x)/w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);}
 for(let i=0;i<out.length;i++)out[i]=!mask[i]&&!seen[i]?1:0;
 return out;
}
/** Bits floating outside the cut (sparkle dots, backdrop specks a sheet left behind) would each get their own
 * little ring: pieces farther than 2 × the border from the main silhouette and under 0.5 % of its area are
 * removed from the picture and the mask. Closer pieces join the silhouette through the grown border. */
function dropFloaters(src,mask,W,H,r){
 const lab=new Int32Array(W*H),areas=[0],stack=[];
 for(let s=0;s<lab.length;s++){if(!mask[s]||lab[s])continue;const id=areas.length;let a=0;lab[s]=id;stack.push(s);
  while(stack.length){const i=stack.pop();a++;const x=i%W;for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,i-W,i+W])if(j>=0&&j<lab.length&&mask[j]&&!lab[j]){lab[j]=id;stack.push(j);}}
  areas.push(a);}
 if(areas.length<3)return;
 const big=areas.indexOf(Math.max(...areas)),total=areas.reduce((a,b)=>a+b,0);
 const main=new Uint8Array(W*H);for(let i=0;i<main.length;i++)main[i]=areas[lab[i]]>=.005*total?1:0;
 const d2=distanceSquared(main,W,H),lim=(2*r)**2;
 const far=new Set();for(let i=0;i<lab.length;i++){const l=lab[i];if(l&&l!==big&&areas[l]<.005*total&&d2[i]>lim)far.add(l);}
 // A piece is dropped only when all of it is far.
 for(let i=0;i<lab.length;i++){const l=lab[i];if(far.has(l)&&d2[i]<=lim)far.delete(l);}
 if(!far.size)return;
 for(let i=0;i<lab.length;i++)if(far.has(lab[i])){mask[i]=0;src[i*4+3]=0;}
 // and their soft rims
 for(let i=0;i<lab.length;i++)if(!mask[i]&&src[i*4+3]&&src[i*4+3]<128){const x=i%W;let near=false;for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,i-W,i+W])if(j>=0&&j<lab.length&&far.has(lab[j])){near=true;break;}if(near)src[i*4+3]=0;}
}
/** Separable box blur of an alpha plane (3 passes ≈ Gaussian). */
function blurPlane(a,w,h,r){
 if(r<1)return a;let src=Float32Array.from(a),tmp=new Float32Array(w*h);
 for(let pass=0;pass<3;pass++){
  for(let y=0;y<h;y++){let s=0;const row=y*w;for(let x=-r;x<=r;x++)s+=src[row+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){tmp[row+x]=s/(2*r+1);s+=src[row+Math.min(w-1,x+r+1)]-src[row+Math.max(0,x-r)];}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=tmp[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){src[y*w+x]=s/(2*r+1);s+=tmp[Math.min(h-1,y+r+1)*w+x]-tmp[Math.max(0,y-r)*w+x];}}
 }
 return src;
}
/**
 * @param {Uint8ClampedArray} data straight RGBA @param {number} w @param {number} h
 * @param {{px:number,color:number[],shadow:boolean}} o px = border width in pixels
 * @returns {{data:Uint8ClampedArray,w:number,h:number,pad:number}}
 */
export function stickerBorder(data,w,h,{px,color,shadow}){
 const r=Math.max(0,px),sh=shadow?Math.max(2,Math.round(r*.9+Math.max(w,h)*.01)):0;
 const pad=Math.ceil(r)+2+(shadow?sh*2:0),W=w+2*pad,H=h+2*pad;
 const src=blank(W,H);for(let y=0;y<h;y++)src.set(data.subarray(y*w*4,(y+1)*w*4),((y+pad)*W+pad)*4);
 const mask=new Uint8Array(W*H);for(let i=0;i<mask.length;i++)mask[i]=src[i*4+3]>=128?1:0;
 const holes=enclosed(mask,W,H);for(let i=0;i<mask.length;i++)if(holes[i])mask[i]=1;
 if(r>0)dropFloaters(src,mask,W,H,r);
 const d2=distanceSquared(mask,W,H);
 // Border alpha: 1 inside the grown silhouette, a linear ramp over the last pixel (sub-pixel distance).
 const borderA=new Float32Array(W*H);
 for(let i=0;i<borderA.length;i++){if(r<=0){borderA[i]=mask[i];continue;}const d=Math.sqrt(d2[i]);borderA[i]=d<=r-.5?1:d>=r+.5?0:r+.5-d;}
 const out=blank(W,H);
 if(shadow){
  const blur=blurPlane(borderA,W,H,Math.max(1,Math.round(sh/2))),off=Math.max(1,Math.round(sh*.6));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sy=y-off;if(sy<0)continue;const a=blur[sy*W+x]*.32;if(a<=0)continue;const j=(y*W+x)*4;out[j]=21;out[j+1]=23;out[j+2]=26;out[j+3]=Math.round(a*255);}
 }
 // Border layer over the shadow, then the picture over the border.
 for(let i=0;i<borderA.length;i++){const a=borderA[i];if(!a)continue;const j=i*4,ba=out[j+3]/255,oa=a+ba*(1-a);
  for(let c=0;c<3;c++)out[j+c]=Math.round((color[c]*a+out[j+c]*ba*(1-a))/oa);out[j+3]=Math.round(oa*255);}
 for(let i=0;i<W*H;i++){const j=i*4,a=src[j+3]/255;if(!a)continue;const ba=out[j+3]/255,oa=a+ba*(1-a);
  for(let c=0;c<3;c++)out[j+c]=Math.round((src[j+c]*a+out[j+c]*ba*(1-a))/oa);out[j+3]=Math.round(oa*255);}
 return {data:out,w:W,h:H,pad};
}
