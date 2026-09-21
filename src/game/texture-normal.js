/** Normal-map maths: height → normal, OpenGL ↔ DirectX, Reoriented Normal Mapping and a
 * validator. Pure (no DOM). Tangent-space convention used throughout:
 *   X = +U, image right.  Z = surface normal, out of the surface.
 *   Y = +V. 'opengl' means green points up in the image as it is displayed (Unity, Godot,
 *   Blender); 'directx' means green points down (Unreal). See docs/TEXTURE-LAB.md.
 * With image rows counted downward, a height field that gets brighter further down tilts the
 * surface towards the top of the image, so OpenGL green > 128 there and DirectX green < 128. */
export const CONVENTIONS=Object.freeze(['opengl','directx']);
/** Derivative kernels. `scale` normalises the response so a ramp of one unit per pixel yields
 * exactly 1.0; x is the horizontal kernel, the vertical one is its transpose. */
export const KERNELS=Object.freeze({
 sobel3:{size:3,scale:1/8,x:[-1,0,1,-2,0,2,-1,0,1]},
 scharr:{size:3,scale:1/32,x:[-3,0,3,-10,0,10,-3,0,3]},
 sobel5:{size:5,scale:1/128,x:[-1,-2,0,2,1,-4,-8,0,8,4,-6,-12,0,12,6,-4,-8,0,8,4,-1,-2,0,2,1]}
});
export const KERNEL_IDS=Object.freeze(Object.keys(KERNELS));
const encode=v=>Math.max(0,Math.min(255,Math.round((v+1)*127.5)));
const decode=v=>(v-127.5)/127.5;
/** Height plane (0…255 bytes) → RGBA normal map. `wrap` samples across the opposite edge, which
 * is what a tileable texture needs; otherwise edge samples are clamped. */
export function heightToNormal(height,w,h,{strength=2,kernel='sobel3',wrap=false,invertX=false,invertY=false,convention='opengl'}={}){
 if(height.length!==w*h)throw Error('Height plane does not match the given dimensions');
 if(!KERNELS[kernel])throw Error('Unknown derivative kernel');
 if(!CONVENTIONS.includes(convention))throw Error('Unknown normal convention');
 if(!Number.isFinite(strength)||strength<0||strength>20)throw Error('Strength must be between 0 and 20');
 const {size:n,scale,x:kx}=KERNELS[kernel],radius=(n-1)/2,out=new Uint8Array(w*h*4);
 const sampleAt=(px,py)=>{
  const sx=wrap?((px%w)+w)%w:Math.max(0,Math.min(w-1,px)),sy=wrap?((py%h)+h)%h:Math.max(0,Math.min(h-1,py));
  return height[sy*w+sx]/255;
 };
 const ySign=(convention==='opengl'?1:-1)*(invertY?-1:1),xSign=invertX?-1:1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let dx=0,dy=0;
  for(let ky=0;ky<n;ky++)for(let kxi=0;kxi<n;kxi++){
   const weight=kx[ky*n+kxi];if(!weight)continue;
   const value=sampleAt(x+kxi-radius,y+ky-radius);
   dx+=weight*value;dy+=kx[kxi*n+ky]*value;
  }
  const nx=-dx*scale*strength*xSign,ny=dy*scale*strength*ySign,norm=Math.hypot(nx,ny,1),i=(y*w+x)*4;
  out.set([encode(nx/norm),encode(ny/norm),encode(1/norm),255],i);
 }
 return out;
}
/** OpenGL ↔ DirectX: the green channel is mirrored (255−g), which is its own inverse, so a
 * converted map converts back to the very same bytes. Nothing else is touched. */
export function flipGreen(data,w,h){
 if(data.length!==w*h*4)throw Error('RGBA data does not match the given dimensions');
 const out=new Uint8Array(data);
 for(let p=0;p<w*h;p++)out[p*4+1]=255-out[p*4+1];
 return out;
}
const FLAT=Object.freeze([128,128,255]);
const isFlat=(data,i)=>data[i]===FLAT[0]&&data[i+1]===FLAT[1]&&data[i+2]===FLAT[2];
/** Reoriented Normal Mapping (Barré-Brisebois & Hill, "Blending in Detail", 2012): the detail
 * normal is rotated into the base normal's frame instead of being averaged with it, so slopes
 * add up the way geometry does and the result stays unit length. An RGB blend is not an option:
 * it flattens both inputs and produces non-unit vectors.
 * A detail texel that is exactly the flat normal (128,128,255) is an identity rotation and is
 * copied from the base byte for byte, so a flat detail map cannot introduce rounding drift. */
export function combineNormals(base,detail,w,h,{strength=1}={}){
 if(base.length!==w*h*4||detail.length!==w*h*4)throw Error('Both normal maps must have the same dimensions');
 if(!Number.isFinite(strength)||strength<0||strength>4)throw Error('Detail strength must be between 0 and 4');
 const out=new Uint8Array(w*h*4);
 for(let p=0;p<w*h;p++){
  const i=p*4;
  if(isFlat(detail,i)){out.set(base.subarray(i,i+4),i);continue;}
  if(strength===1&&isFlat(base,i)){out.set(detail.subarray(i,i+3),i);out[i+3]=base[i+3];continue;}
  const bx=decode(base[i]),by=decode(base[i+1]),bz=decode(base[i+2]);
  let dx=decode(detail[i])*strength,dy=decode(detail[i+1])*strength,dz=decode(detail[i+2]);
  const dLen=Math.hypot(dx,dy,dz)||1;dx/=dLen;dy/=dLen;dz/=dLen;
  // t = 2·base + (−1,−1,0) expressed on decoded values; u = (−dx,−dy,dz).
  const tx=bx,ty=by,tz=bz+1,dot=tx*-dx+ty*-dy+tz*dz,k=tz?dot/tz:0;
  let rx=tx*k+dx,ry=ty*k+dy,rz=tz*k-dz;
  const len=Math.hypot(rx,ry,rz)||1;rx/=len;ry/=len;rz/=len;
  out.set([encode(rx),encode(ry),encode(rz),base[i+3]],i);
 }
 return out;
}
/** Is this actually a tangent-space normal map? Checks the two properties that always hold:
 * the decoded vectors are unit length, and Z (blue) is not negative — a texel with blue < 128
 * points into the surface. Returns measurements, not a verdict wrapped in marketing. */
export function validateNormalMap(data,w,h,{tolerance=.12,maxSamples=1_000_000}={}){
 if(data.length!==w*h*4)throw Error('RGBA data does not match the given dimensions');
 const total=w*h,step=Math.max(1,Math.ceil(total/maxSamples));
 let sampled=0,sumLength=0,maxDeviation=0,offUnit=0,negativeBlue=0,flat=0,lowBlue=255;
 for(let p=0;p<total;p+=step){
  const i=p*4,x=decode(data[i]),y=decode(data[i+1]),z=decode(data[i+2]),length=Math.hypot(x,y,z);
  sampled++;sumLength+=length;
  const deviation=Math.abs(length-1);if(deviation>maxDeviation)maxDeviation=deviation;
  if(deviation>tolerance)offUnit++;
  if(data[i+2]<128)negativeBlue++;
  if(data[i+2]<lowBlue)lowBlue=data[i+2];
  if(isFlat(data,i))flat++;
 }
 const offUnitRatio=offUnit/sampled,negativeBlueRatio=negativeBlue/sampled;
 return {sampled,step,meanLength:sumLength/sampled,maxDeviation,offUnitRatio,negativeBlueRatio,minBlue:lowBlue,
  flatRatio:flat/sampled,unitLength:offUnitRatio<=.01,blueNonNegative:!negativeBlue,
  looksLikeNormalMap:offUnitRatio<=.05&&negativeBlueRatio<=.001};
}
/** Mean absolute green difference: how much a map would change if its convention were flipped.
 * Near zero means the map has no vertical slope information to tell the two conventions apart. */
export function greenBias(data,w,h){
 if(data.length!==w*h*4)throw Error('RGBA data does not match the given dimensions');
 let sum=0,above=0;
 for(let p=0;p<w*h;p++){const g=data[p*4+1];sum+=Math.abs(g-127.5);if(g>128)above++;}
 return {meanDeviation:sum/(w*h),aboveRatio:above/(w*h)};
}
