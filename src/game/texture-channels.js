/** Channel arithmetic for packed PBR textures. Pure: RGBA bytes in, channel planes out.
 * A "plane" is a Uint8Array of w*h single-channel bytes — never scaled, never gamma-adjusted,
 * so an unpacked channel is bit-identical to the bytes that were in the file. */
export const CHANNELS=Object.freeze(['r','g','b','a']);
export const CHANNEL_INDEX=Object.freeze({r:0,g:1,b:2,a:3});
const size=(data,w,h)=>{
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Invalid texture dimensions');
 if(data.length!==w*h*4)throw Error('RGBA data does not match the given dimensions');
};
export function extractChannel(data,w,h,channel){
 size(data,w,h);
 const c=typeof channel==='number'?channel:CHANNEL_INDEX[channel];
 if(!Number.isInteger(c)||c<0||c>3)throw Error('Unknown channel');
 const out=new Uint8Array(w*h);
 for(let p=0;p<out.length;p++)out[p]=data[p*4+c];
 return out;
}
export const unpackChannels=(data,w,h)=>Object.fromEntries(CHANNELS.map((name,c)=>[name,extractChannel(data,w,h,c)]));
/** Plane → opaque grey RGBA, for a preview or an RGB re-encode. */
export function planeToRGBA(plane,w,h){
 if(plane.length!==w*h)throw Error('Plane size does not match the image');
 const out=new Uint8Array(w*h*4);
 for(let p=0;p<plane.length;p++)out.set([plane[p],plane[p],plane[p],255],p*4);
 return out;
}
/** Roughness ↔ smoothness. Exactly 255−v, so inverting twice returns the original bytes. */
export function invertPlane(plane){const out=new Uint8Array(plane.length);for(let i=0;i<plane.length;i++)out[i]=255-plane[i];return out;}
export function invertChannel(data,w,h,channel){
 size(data,w,h);const c=typeof channel==='number'?channel:CHANNEL_INDEX[channel];
 const out=new Uint8Array(data);
 for(let p=0;p<w*h;p++)out[p*4+c]=255-out[p*4+c];
 return out;
}
export function planeStats(plane){
 if(!plane.length)throw Error('Empty plane');
 let min=255,max=0,sum=0;const seen=new Uint8Array(256);
 for(const v of plane){if(v<min)min=v;if(v>max)max=v;sum+=v;seen[v]=1;}
 let unique=0;for(const v of seen)unique+=v;
 return {min,max,mean:sum/plane.length,unique,constant:min===max};
}
export const planesEqual=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
/** Rec. 709 luma, matching src/primitives.js so both paths agree on "grey". */
export function luminancePlane(data,w,h){
 size(data,w,h);const out=new Uint8Array(w*h);
 for(let p=0;p<out.length;p++)out[p]=Math.round(.2126*data[p*4]+.7152*data[p*4+1]+.0722*data[p*4+2]);
 return out;
}
/** How far RGB is from grey, and whether the three channels actually carry different data —
 * the test for "a roughness map that was saved as an RGB PNG" versus "three packed masks". */
export function colorSpread(data,w,h){
 size(data,w,h);let maxSpread=0,differing=0;
 for(let p=0;p<w*h;p++){
  const i=p*4,spread=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);
  if(spread>maxSpread)maxSpread=spread;
  if(spread>2)differing++;
 }
 return {maxSpread,differingPixels:differing,grayscale:maxSpread<=2,differingRatio:differing/(w*h)};
}
export function alphaStats(data,w,h){
 size(data,w,h);let min=255,max=0,zero=0,partial=0,rgbUnderZero=0;
 for(let p=0;p<w*h;p++){
  const a=data[p*4+3];if(a<min)min=a;if(a>max)max=a;
  if(!a){zero++;if(data[p*4]|data[p*4+1]|data[p*4+2])rgbUnderZero++;}
  else if(a<255)partial++;
 }
 return {min,max,zeroPixels:zero,partialPixels:partial,rgbUnderZeroAlpha:rgbUnderZero,constant:min===max,used:min!==255};
}
/** Packs planes into RGBA. `mapping` holds, per output channel, either a plane index, the
 * string 'zero'/'one', or {plane,invert:true}. Bytes are copied, never luma-averaged, so a
 * value written here comes back out of extractChannel unchanged. */
export function packPlanes(planes,w,h,mapping){
 if(!Array.isArray(mapping)||mapping.length!==4)throw Error('Four channel mappings are required');
 for(const plane of planes)if(plane.length!==w*h)throw Error('All channel inputs must have the same dimensions');
 const out=new Uint8Array(w*h*4);
 mapping.forEach((m,c)=>{
  if(m==='zero')return;
  if(m==='one'){for(let p=0;p<w*h;p++)out[p*4+c]=255;return;}
  const index=typeof m==='object'?m.plane:m,invert=typeof m==='object'&&!!m.invert,plane=planes[index];
  if(!plane)throw Error('Missing channel input');
  for(let p=0;p<w*h;p++)out[p*4+c]=invert?255-plane[p]:plane[p];
 });
 return out;
}
