/** Maps derived from a height field (px) and from albedo. Pure (no DOM).
 *
 * From height — geometric estimates, honest about being estimates:
 *   ambient occlusion  horizon-based: how much of the sky each texel sees over the height field
 *   cavity             how far a texel sits below (dark) or above (bright) its surroundings
 *   curvature          convex (bright) / concave (dark), from the Laplacian of the height
 * From albedo — APPROXIMATIONS, labelled so in the UI: brightness is not roughness. They are a
 * starting point to paint over, never presented as measured material properties. */
import {edgeTable,blur} from './height.js';
const toByte=v=>v<0?0:v>1?255:Math.round(v*255);
/** Horizon-based ambient occlusion on a height field in pixels. For each of `directions`
 * directions the highest elevation angle to any sample within `radius` px is found; the
 * occlusion of that direction is sin(horizon angle). AO = 1 − mean occlusion, raised to `power`.
 * Height and radius share one unit (px), so a 4 px bevel occludes like a 4 px step does. */
export function ambientOcclusion(height,w,h,{radius=8,directions=8,edge='clamp',power=1,mask=null}={}){
 if(height.length!==w*h)throw Error('Height does not match the given dimensions');
 if(!(radius>=1&&radius<=64))throw Error('Radius must be 1–64 px');
 if(![4,8,16].includes(directions))throw Error('Directions must be 4, 8 or 16');
 // sample distances grow geometrically: fine near the texel, sparse at the rim
 const dists=[];for(let d=1;d<=radius;d=Math.max(d+1,Math.round(d*1.35)))dists.push(d);if(dists[dists.length-1]!==radius)dists.push(radius);
 const R=Math.ceil(radius)+1,tx=edgeTable(w,R,edge),ty=edgeTable(h,R,edge);
 const offs=[];for(let k=0;k<directions;k++){const a=2*Math.PI*k/directions,cx=Math.cos(a),cy=Math.sin(a);for(const d of dists)offs.push(Math.round(cx*d),Math.round(cy*d),d,k);}
 const out=new Uint8Array(w*h),best=new Float32Array(directions);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x;if(mask&&!mask[p]){out[p]=255;continue;}
  const self=height[p];best.fill(0);
  for(let i=0;i<offs.length;i+=4){
   const q=ty[y+offs[i+1]+R]*w+tx[x+offs[i]+R],rise=(height[q]-self)/offs[i+2];
   if(rise>best[offs[i+3]])best[offs[i+3]]=rise;
  }
  let occ=0;for(let k=0;k<directions;k++){const t=best[k];occ+=t/Math.sqrt(1+t*t);}
  out[p]=toByte(Math.pow(Math.max(0,1-occ/directions),power));
 }
 return out;
}
/** Cavity: height minus its blurred self (radius px), mapped to bytes with 128 = level.
 * `gain` px of difference reach full black/white. */
export function cavity(height,w,h,{radius=3,gain=1,edge='clamp'}={}){
 const low=blur(height,w,h,radius,{mode:edge}),out=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++)out[p]=toByte(.5+(height[p]-low[p])/(2*Math.max(.01,gain)));
 return out;
}
/** Curvature: −∇²h (convex bright, concave dark), 128 = flat, `gain` scales. */
export function curvature(height,w,h,{gain=4,edge='clamp'}={}){
 const tx=edgeTable(w,1,edge),ty=edgeTable(h,1,edge),out=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const c=height[y*w+x],l=height[y*w+tx[x]],r=height[y*w+tx[x+2]],u=height[ty[y]*w+x],d=height[ty[y+2]*w+x];
  out[y*w+x]=toByte(.5-(l+r+u+d-4*c)*gain/2);
 }
 return out;
}
/** APPROXIMATION: roughness from albedo. Darker, more contrasted paint reads as rougher; `base`
 * is the roughness of mid-grey, `contrast` how much brightness moves it. */
export function roughnessFromAlbedo(rgba,w,h,{base=.7,contrast=.4,invert=false}={}){
 const out=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const L=(.2126*rgba[p*4]+.7152*rgba[p*4+1]+.0722*rgba[p*4+2])/255;out[p]=toByte(base+(invert?L-.5:.5-L)*contrast);}
 return out;
}
/** APPROXIMATION: specular strength from albedo brightness (bright paint shines more). */
export function specularFromAlbedo(rgba,w,h,{level=.5,gamma=2}={}){
 const out=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const L=(.2126*rgba[p*4]+.7152*rgba[p*4+1]+.0722*rgba[p*4+2])/255;out[p]=toByte(level*Math.pow(L,gamma)*2);}
 return out;
}
/** Height (px) → display bytes: 0 → black, `max` px → white. */
export function heightToBytes(height,{max=null}={}){
 let m=max;if(!m){m=0;for(const v of height)if(v>m)m=v;}
 const out=new Uint8Array(height.length),k=m>0?255/m:0;
 for(let p=0;p<height.length;p++){const v=height[p]*k;out[p]=v<0?0:v>255?255:Math.round(v);}
 return out;
}
/** Height (px) → 16-bit samples (0 → 0, `max` px → 65535): what a 16-bit PNG stores. */
export function heightToUint16(height,{max=null}={}){
 let m=max;if(!m){m=0;for(const v of height)if(v>m)m=v;}
 const out=new Uint16Array(height.length),k=m>0?65535/m:0;
 for(let p=0;p<height.length;p++){const v=height[p]*k;out[p]=v<0?0:v>65535?65535:Math.round(v);}
 return {samples:out,max:m};
}
