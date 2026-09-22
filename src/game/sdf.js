/** Signed distance fields from a glyph or shape raster. Pure; no DOM.
 *
 * The distance transform is exact, not a blur: `edt` is the separable lower-envelope algorithm
 * (Felzenszwalb & Huttenlocher, "Distance Transforms of Sampled Functions", 2012), which
 * returns the true squared Euclidean distance to the nearest seed pixel in O(w·h).
 * The signed field is positive inside the shape, negative outside, and zero halfway between
 * the last inside pixel centre and the first outside pixel centre — the contour.
 *
 * This is a single-channel SDF. It is NOT an MSDF: multi-channel distance fields need contour
 * decomposition from outlines, which this module does not do, and nothing here pretends to. */
const INF=1e20;
function dt1d(f,n,d,v,z){
 let k=0;v[0]=0;z[0]=-INF;z[1]=INF;
 for(let q=1;q<n;q++){
  let s=(f[q]+q*q-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
  while(s<=z[k]){k--;s=(f[q]+q*q-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
  k++;v[k]=q;z[k]=s;z[k+1]=INF;
 }
 for(let q=0,j=0;q<n;q++){while(z[j+1]<q)j++;d[q]=(q-v[j])*(q-v[j])+f[v[j]];}
}
/** Squared Euclidean distance to the nearest set pixel of `mask` (1 = seed). */
export function edt(mask,w,h){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||mask.length!==w*h)throw Error('Invalid mask');
 const out=new Float64Array(w*h),n=Math.max(w,h),f=new Float64Array(n),d=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
 let seeds=0;
 for(let i=0;i<out.length;i++){out[i]=mask[i]?0:INF;if(mask[i])seeds++;}
 if(!seeds)return out.fill(INF);// nothing to be near: every distance is unbounded, not NaN
 for(let x=0;x<w;x++){
  for(let y=0;y<h;y++)f[y]=out[y*w+x];
  dt1d(f,h,d,v,z);
  for(let y=0;y<h;y++)out[y*w+x]=d[y];
 }
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++)f[x]=out[y*w+x];
  dt1d(f,w,d,v,z);
  for(let x=0;x<w;x++)out[y*w+x]=d[x];
 }
 return out;
}
/** Signed distance in pixels for an RGBA raster: inside is alpha above `threshold`.
 * Positive inside, negative outside, 0 at the contour. */
export function signedDistanceField(data,w,h,{threshold=127}={}){
 if(data.length!==w*h*4)throw Error('Invalid RGBA data');
 const inside=new Uint8Array(w*h),outside=new Uint8Array(w*h);
 for(let p=0;p<inside.length;p++){const on=data[p*4+3]>threshold?1:0;inside[p]=on;outside[p]=on?0:1;}
 const toOutside=edt(outside,w,h),toInside=edt(inside,w,h),field=new Float32Array(w*h);
 for(let p=0;p<field.length;p++)field[p]=inside[p]?Math.sqrt(toOutside[p])-.5:-(Math.sqrt(toInside[p])-.5);
 return field;
}
/** Picks the field value at the centre of each output pixel's source block and converts it to
 * output-pixel units, so an SDF rendered at 4× and shipped at 1× still means pixels. */
export function downsample(field,w,h,scale){
 if(!Number.isSafeInteger(scale)||scale<1)throw Error('Scale must be a positive integer');
 if(scale===1)return {field:Float32Array.from(field),width:w,height:h};
 const W=Math.floor(w/scale),H=Math.floor(h/scale);
 if(W<1||H<1)throw Error('Scale is larger than the raster');
 const out=new Float32Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const sx=Math.min(w-1,Math.floor(x*scale+scale/2)),sy=Math.min(h-1,Math.floor(y*scale+scale/2));
  out[y*W+x]=field[sy*w+sx]/scale;
 }
 return {field:out,width:W,height:H};
}
/** RGBA bytes for a texture: the distance goes into R, G and B with alpha kept opaque, because
 * a canvas cannot store exact colour bytes under a low alpha. 128 is the contour; `spread`
 * pixels of distance map onto the 0…255 range. Sample any colour channel in the shader. */
export function encode(field,w,h,{spread=8}={}){
 if(!(spread>0))throw Error('Spread must be positive');
 if(field.length!==w*h)throw Error('Field size does not match');
 const out=new Uint8ClampedArray(w*h*4);
 for(let p=0;p<field.length;p++){
  const v=Math.round(128+field[p]/spread*127);
  out[p*4]=out[p*4+1]=out[p*4+2]=v;out[p*4+3]=255;
 }
 return out;
}
/** What a shader must do to get the shape back; shipped next to the texture, not guessed at. */
export const SHADER_NOTE=(spread=8)=>`distance_px = (sample.r * 255.0 - 128.0) / 127.0 * ${spread}.0; alpha = clamp(distance_px / fwidth_px + 0.5, 0.0, 1.0);`;
