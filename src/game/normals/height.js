/** Height fields for sprite and texture normal maps. Pure (no DOM): typed arrays in, typed arrays
 * out, so the same code runs in the Studio worker, on the main thread for live brush strokes, and
 * in node:test.
 *
 * Units: a height field is a Float32Array of w·h values in PIXELS (1.0 = one pixel of relief).
 * Using pixels instead of an abstract 0…1 keeps every parameter physical: a 4 px bevel that rises
 * 4 px is a 45° slope whatever the sprite size, and ambient occlusion and the normal map agree on
 * what "steep" means.
 *
 * Edge modes (every kernel here takes one): 'clamp' repeats the border pixel, 'tile' wraps to the
 * opposite side (a tileable texture: the result has no seam), 'mirror' reflects without repeating
 * the border pixel (…2 1 0 1 2…). */
export const EDGE_MODES=Object.freeze(['clamp','tile','mirror']);
export const BEVEL_PROFILES=Object.freeze(['linear','round','smooth','concave','step']);
export const DISTANCE_METRICS=Object.freeze(['euclidean','chebyshev','manhattan']);
/** Source index for a sample `i` on an axis of length n. */
export function edgeIndex(i,n,mode){
 if(i>=0&&i<n)return i;
 if(mode==='tile')return ((i%n)+n)%n;
 if(mode==='mirror'){if(n===1)return 0;const p=2*n-2;let k=((i%p)+p)%p;return k<n?k:p-k;}
 return i<0?0:n-1;
}
/** Lookup table of source indices for samples -pad … n-1+pad (fast inner loops). */
export function edgeTable(n,pad,mode){const t=new Int32Array(n+2*pad);for(let i=0;i<t.length;i++)t[i]=edgeIndex(i-pad,n,mode);return t;}
const check=(len,w,h,what='plane')=>{if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Invalid dimensions');if(len!==w*h)throw Error(`${what} does not match ${w}×${h}`);};
// ------------------------------------------------------------------ distance transform
const INF=1e20;
/** Felzenszwalb & Huttenlocher (2012) exact 1-D squared distance transform of f (length n) into d. */
function dt1d(f,n,d,v,z){
 let k=0;v[0]=0;z[0]=-INF;z[1]=INF;
 for(let q=1;q<n;q++){
  let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
  while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
  k++;v[k]=q;z[k]=s;z[k+1]=INF;
 }
 k=0;
 for(let q=0;q<n;q++){while(z[k+1]<q)k++;const dq=q-v[k];d[q]=dq*dq+f[v[k]];}
}
/** Exact Euclidean distance (pixel centre to pixel centre) from every pixel to the nearest pixel
 * where `feature[p]` is 0. Pixels with no feature anywhere get Infinity. */
function edt(feature,w,h){
 const f=new Float64Array(Math.max(w,h)),d=new Float64Array(Math.max(w,h)),v=new Int32Array(Math.max(w,h)),z=new Float64Array(Math.max(w,h)+1);
 const grid=new Float64Array(w*h);
 for(let p=0;p<w*h;p++)grid[p]=feature[p]?INF:0;
 for(let x=0;x<w;x++){for(let y=0;y<h;y++)f[y]=grid[y*w+x];dt1d(f,h,d,v,z);for(let y=0;y<h;y++)grid[y*w+x]=d[y];}
 for(let y=0;y<h;y++){for(let x=0;x<w;x++)f[x]=grid[y*w+x];dt1d(f,w,d,v,z);for(let x=0;x<w;x++)grid[y*w+x]=d[x];}
 const out=new Float32Array(w*h);
 for(let p=0;p<w*h;p++)out[p]=grid[p]>=INF/2?Infinity:Math.sqrt(grid[p]);
 return out;
}
/** Two-pass chamfer: exact for the city-block (4-neighbour) and chessboard (8-neighbour) metrics. */
function chamfer(feature,w,h,diag){
 const d=new Float32Array(w*h);for(let p=0;p<w*h;p++)d[p]=feature[p]?Infinity:0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(!d[p])continue;let m=d[p];
  if(x>0)m=Math.min(m,d[p-1]+1);if(y>0)m=Math.min(m,d[p-w]+1);
  if(diag&&y>0){if(x>0)m=Math.min(m,d[p-w-1]+1);if(x<w-1)m=Math.min(m,d[p-w+1]+1);}d[p]=m;}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const p=y*w+x;if(!d[p])continue;let m=d[p];
  if(x<w-1)m=Math.min(m,d[p+1]+1);if(y<h-1)m=Math.min(m,d[p+w]+1);
  if(diag&&y<h-1){if(x<w-1)m=Math.min(m,d[p+w+1]+1);if(x>0)m=Math.min(m,d[p+w-1]+1);}d[p]=m;}
 return d;
}
/** Distance from each INSIDE pixel (mask 1) to the nearest outside pixel, centre to centre, so a
 * rim pixel is 1. Outside pixels are 0.
 *  border 'outside' — the image border counts as transparent (a sprite cut by its frame gets a rim)
 *  border 'inside'  — it does not (a tile that continues past its edge)
 *  border 'tile'    — the shape wraps around (a tileable texture with holes) */
export function insideDistance(mask,w,h,{border='outside',metric='euclidean'}={}){
 check(mask.length,w,h,'Mask');
 if(!DISTANCE_METRICS.includes(metric))throw Error('Unknown distance metric');
 const run=(m,W,H)=>metric==='euclidean'?edt(m,W,H):chamfer(m,W,H,metric==='chebyshev');
 if(border==='tile'){
  const W=w*3,H=h*3,m=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)m[y*W+x]=mask[(y%h)*w+(x%w)];
  const d=run(m,W,H),out=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)out[y*w+x]=d[(y+h)*W+x+w];
  return out;
 }
 if(border==='outside'){
  const W=w+2,H=h+2,m=new Uint8Array(W*H);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)m[(y+1)*W+x+1]=mask[y*w+x];
  const d=run(m,W,H),out=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)out[y*w+x]=d[(y+1)*W+x+1];
  return out;
 }
 if(border!=='inside')throw Error('Unknown border mode');
 return run(mask,w,h);
}
/** Bevel profile: t in 0…1 across the bevel (0 = the silhouette, 1 = the plateau) → 0…1 height. */
export function profile(name,t){
 const s=t<0?0:t>1?1:t;
 switch(name){
  case 'linear':return s;
  case 'round':return Math.sqrt(1-(1-s)*(1-s));   // quarter circle: a pillow
  case 'smooth':return s*s*(3-2*s);               // smoothstep: soft shoulder at both ends
  case 'concave':return s*s;                      // cove: steep near the plateau
  case 'step':return s>=1?1:s>0?.5:0;             // a single ledge (pixel-art outline)
  default:throw Error('Unknown bevel profile');
 }
}
/** Mask from alpha: 1 where alpha > threshold. */
export function alphaMask(rgba,w,h,threshold=127){
 check(rgba.length,w*4,h,'RGBA data');
 const m=new Uint8Array(w*h);for(let p=0;p<w*h;p++)m[p]=rgba[p*4+3]>threshold?1:0;return m;
}
/** Does this picture have a silhouette at all (some pixels transparent, some opaque)? */
export function hasSilhouette(rgba,w,h,threshold=127){
 let a=0,b=0;for(let p=0;p<w*h;p++){if(rgba[p*4+3]>threshold)a++;else b++;if(a&&b)return true;}return false;
}
/** Bevel height (px) from the silhouette: 0 at the edge, `depth` on the plateau, `width` px wide. */
export function bevelHeight(mask,w,h,{width=4,depth=4,shape='round',border='outside',metric='euclidean'}={}){
 if(!(width>0))throw Error('Bevel width must be positive');
 const d=insideDistance(mask,w,h,{border,metric}),out=new Float32Array(w*h);
 for(let p=0;p<w*h;p++){
  if(!mask[p])continue;
  // the silhouette runs half a pixel outside the rim pixel's centre
  const t=Number.isFinite(d[p])?(d[p]-.5)/width:1;
  out[p]=depth*profile(shape,t);
 }
 return out;
}
// ------------------------------------------------------------------ blur (masked, edge-aware)
/** Box blur of radius r (window 2r+1) along one axis, with an edge mode. The table has one extra
 * sample each side because the sliding window reads one past the last position. */
const boxPassSafe=(src,w,h,r,mode,horizontal)=>{
 const n=horizontal?w:h,lines=horizontal?h:w,t=edgeTable(n,r+1,mode),win=2*r+1,out=new Float32Array(w*h);
 for(let l=0;l<lines;l++){
  const at=i=>horizontal?src[l*w+t[i+1]]:src[t[i+1]*w+l];
  let sum=0;for(let i=0;i<win;i++)sum+=at(i);
  for(let i=0;i<n;i++){out[horizontal?l*w+i:i*w+l]=sum/win;sum+=at(i+win)-at(i);}
 }
 return out;
};
/** Approximate Gaussian of standard deviation ≈ sigma: three box passes per axis (Wells 1986). */
export function blur(src,w,h,sigma,{mode='clamp'}={}){
 check(src.length,w,h);
 if(!(sigma>0))return Float32Array.from(src);
 // three boxes of width wb give variance 3·(wb²−1)/12
 const wb=Math.max(1,Math.round(Math.sqrt(4*sigma*sigma+1))),r=Math.max(0,Math.floor(wb/2));
 let a=Float32Array.from(src);if(!r)return a;
 for(let k=0;k<3;k++){a=boxPassSafe(a,w,h,r,mode,true);a=boxPassSafe(a,w,h,r,mode,false);}
 return a;
}
/** Normalised (masked) blur: only pixels inside the mask contribute, so transparent pixels — whose
 * RGB is anything — never leak into a sprite's height. Outside the mask the result is 0. */
export function maskedBlur(src,mask,w,h,sigma,{mode='clamp'}={}){
 if(!mask)return blur(src,w,h,sigma,{mode});
 const num=new Float32Array(w*h),den=new Float32Array(w*h);
 for(let p=0;p<w*h;p++)if(mask[p]){num[p]=src[p];den[p]=1;}
 const a=blur(num,w,h,sigma,{mode}),b=blur(den,w,h,sigma,{mode}),out=new Float32Array(w*h);
 for(let p=0;p<w*h;p++)out[p]=mask[p]&&b[p]>1e-6?a[p]/b[p]:0;
 return out;
}
// ------------------------------------------------------------------ luminance height
/** Rec. 709 luma of RGBA bytes, 0…1. */
export function luma(rgba,w,h){
 check(rgba.length,w*4,h,'RGBA data');
 const out=new Float32Array(w*h);
 for(let p=0;p<w*h;p++)out[p]=(.2126*rgba[p*4]+.7152*rgba[p*4+1]+.0722*rgba[p*4+2])/255;
 return out;
}
/** Height (px) from brightness. An approximation: brightness is paint, not shape, so this is
 * labelled as such in the UI. `detail` > 0 removes brightness changes larger than that many
 * pixels (a dark cloak is not a hole), keeping the small relief; `smooth` softens pixel noise. */
export function lumaHeight(rgba,w,h,{depth=2,detail=0,smooth=0,invert=false,mask=null,mode='clamp'}={}){
 let L=luma(rgba,w,h);
 if(invert)for(let p=0;p<L.length;p++)L[p]=1-L[p];
 if(smooth>0)L=maskedBlur(L,mask,w,h,smooth,{mode});
 if(detail>0){
  const low=maskedBlur(L,mask,w,h,detail,{mode});
  for(let p=0;p<L.length;p++)L[p]=L[p]-low[p]+.5;
 }
 const out=new Float32Array(w*h);
 for(let p=0;p<L.length;p++)out[p]=mask&&!mask[p]?0:depth*L[p];
 return out;
}
/** A grey plane (a Height/Displacement map, 8 or 16 bit) → px. `samples` is the file's own integer
 * range (255 or 65535), so a 16-bit height keeps its 256× finer steps. */
export function heightFromPlane(plane,w,h,{depth=4,max=plane instanceof Uint16Array?65535:255,invert=false,mid=false}={}){
 check(plane.length,w,h);
 const out=new Float32Array(w*h);
 for(let p=0;p<w*h;p++){let v=plane[p]/max;if(invert)v=1-v;out[p]=depth*(mid?v-.5:v);}
 return out;
}
// ------------------------------------------------------------------ height brush strokes
export const BRUSH_MODES=Object.freeze(['raise','lower','smooth','flatten','erase']);
/** Deterministic dab list for a stroke: points every `spacing`·radius along the polyline. */
export function strokeDabs(stroke){
 const pts=stroke.pts||[],r=Math.max(.5,+stroke.r||1),step=Math.max(.5,r*(stroke.spacing??.25)),out=[];
 if(pts.length<2)return out;
 out.push(pts[0],pts[1]);
 let carry=0;
 for(let i=2;i+1<pts.length;i+=2){
  const x0=pts[i-2],y0=pts[i-1],x1=pts[i],y1=pts[i+1],len=Math.hypot(x1-x0,y1-y0);
  let at=step-carry;
  while(at<=len){const k=at/len;out.push(x0+(x1-x0)*k,y0+(y1-y0)*k);at+=step;}
  carry=len-(at-step);
 }
 return out;
}
const falloff=(d,r,hard)=>{if(d>=r)return 0;const t=d/r;if(t<=hard)return 1;const u=(t-hard)/(1-hard);return 1-u*u*(3-2*u);};
/** Applies strokes to a paint layer (Float32, px added on top of the generated height).
 * `base` is the generated height (read by smooth/flatten, which act on the sum).
 * Stroke: {mode, r (px), s (strength: px per dab for raise/lower, 0…1 blend for the rest),
 *          hard (0…1), pts:[x,y,…] in pixel coordinates, target? (flatten height)}.
 * Returns the dirty rect {x,y,w,h} (or null). */
export function applyStroke(paint,base,w,h,stroke,{clip=null}={}){
 check(paint.length,w,h,'Paint layer');
 const mode=stroke.mode||'raise';if(!BRUSH_MODES.includes(mode))throw Error('Unknown brush mode');
 const r=Math.max(.5,+stroke.r||1),s=+stroke.s||0,hard=Math.max(0,Math.min(.99,stroke.hard??.5)),dabs=strokeDabs(stroke);
 const cx0=clip?clip.x:0,cy0=clip?clip.y:0,cx1=clip?clip.x+clip.w:w,cy1=clip?clip.y+clip.h:h;
 let dirty=null;const grow=(x0,y0,x1,y1)=>{if(!dirty)dirty={x0,y0,x1,y1};else{dirty.x0=Math.min(dirty.x0,x0);dirty.y0=Math.min(dirty.y0,y0);dirty.x1=Math.max(dirty.x1,x1);dirty.y1=Math.max(dirty.y1,y1);}};
 const target=stroke.target;
 for(let i=0;i<dabs.length;i+=2){
  // dab centre is in pixel coordinates; pixel (x,y) is sampled at its centre (x+.5,y+.5)
  const cx=dabs[i],cy=dabs[i+1];
  const x0=Math.max(cx0,Math.floor(cx-r)),x1=Math.min(cx1-1,Math.ceil(cx+r)),y0=Math.max(cy0,Math.floor(cy-r)),y1=Math.min(cy1-1,Math.ceil(cy+r));
  if(x0>x1||y0>y1)continue;
  let avg=0;
  if(mode==='smooth'){let sum=0,n=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=falloff(Math.hypot(x+.5-cx,y+.5-cy),r,0);if(k>0){sum+=(base[y*w+x]+paint[y*w+x])*k;n+=k;}}avg=n?sum/n:0;}
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const k=falloff(Math.hypot(x+.5-cx,y+.5-cy),r,hard);if(k<=0)continue;
   const p=y*w+x,cur=base[p]+paint[p];
   if(mode==='raise')paint[p]+=s*k;
   else if(mode==='lower')paint[p]-=s*k;
   else if(mode==='smooth')paint[p]+=(avg-cur)*Math.min(1,s*k);
   else if(mode==='flatten')paint[p]+=((target??0)-cur)*Math.min(1,s*k);
   else paint[p]*=1-Math.min(1,s*k);// erase: back towards the generated height
  }
  grow(x0,y0,x1,y1);
 }
 return dirty&&{x:dirty.x0,y:dirty.y0,w:dirty.x1-dirty.x0+1,h:dirty.y1-dirty.y0+1};
}
/** Replays a stroke list onto a fresh paint layer. */
export function paintLayer(strokes,base,w,h,{clip=null}={}){
 const paint=new Float32Array(w*h);
 for(const s of strokes||[])applyStroke(paint,base,w,h,s,{clip});
 return paint;
}
/** base + paint, never below 0 (a hole deeper than the background would light from behind). */
export function addLayers(base,paint){const out=new Float32Array(base.length);for(let p=0;p<base.length;p++)out[p]=Math.max(0,base[p]+(paint?paint[p]:0));return out;}
