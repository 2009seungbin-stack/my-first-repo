/** What a frame looks like, from the document alone. Pure: no DOM, no image decoding — the caller
 * passes `rgbaOf(blobId) → {width,height,data}` (exact RGBA of that PNG).
 *
 * The rule (docs/STUDIO-SPRITE.md §2): for each visible layer, bottom → top, the frame's own cel
 * on that layer, else the layer's shared cel ('*'), drawn at (x, y) on the asset canvas with
 * opacity mul8(cel, layer) and the layer's Aseprite blend mode; then `trimmedRect || sourceRect`
 * is cut out and placed at (offsetX, offsetY) on the frame's canvasWidth × canvasHeight canvas.
 * Blending is Aseprite's own (src/game/aseprite-blend.js), so an imported .aseprite frame
 * composes to the pixels Aseprite exports. */
import {blendRGBA,mul8,BLEND_MODES} from '../../game/aseprite-blend.js';
import {SHARED} from '../core/project.js';
export const blendIndex=name=>{const i=BLEND_MODES.indexOf(String(name||'normal').toLowerCase().replace(/[\s-]/g,'_'));return i<0?0:i;};
/** Index of cels by layer and frame: rebuilt per asset object (documents are immutable). */
const indexCache=new WeakMap();
export function celIndex(asset){
 let m=indexCache.get(asset);if(m)return m;
 m=new Map();for(const c of asset.cels)m.set(c.layerId+'|'+c.frameId,c);
 indexCache.set(asset,m);return m;
}
/** The cel a layer shows at a frame: its own, else the shared one, else null. */
export function celAt(asset,layerId,frameId){const m=celIndex(asset);return m.get(layerId+'|'+frameId)||m.get(layerId+'|'+SHARED)||null;}
/** Does the frame have pixels of its own on this layer (vs the shared picture)? */
export const ownCel=(asset,layerId,frameId)=>celIndex(asset).get(layerId+'|'+frameId)||null;
/** [{layer, cel, opacity, blend}] bottom → top: exactly what is drawn for the frame. */
export function frameDraws(asset,frame,{layers=null}={}){
 const out=[],id=typeof frame==='string'?frame:frame.id;
 for(const l of asset.layers){
  if(layers?!layers.has(l.id):!l.visible)continue;
  const cel=celAt(asset,l.id,id);if(!cel)continue;
  const opacity=mul8(cel.opacity,l.opacity);if(!opacity)continue;
  out.push({layer:l,cel,opacity,blend:blendIndex(l.blend)});
 }
 return out;
}
/** Canvas-sized RGBA of the frame's moment: all drawn cels composited on width × height. */
export function composeCanvas(asset,frame,rgbaOf,{rect=null,layers=null}={}){
 const r=rect||{x:0,y:0,w:asset.width,h:asset.height},out=new Uint8Array(r.w*r.h*4);
 for(const d of frameDraws(asset,frame,{layers})){
  const img=rgbaOf(d.cel.blob);if(!img)throw Error(`Image ${String(d.cel.blob).slice(0,8)} is not loaded`);
  drawRGBA(out,r.w,r.h,img.data,img.width,img.height,d.cel.x-r.x,d.cel.y-r.y,d.opacity,d.blend);
 }
 return {width:r.w,height:r.h,data:out};
}
/** Aseprite's RGBA drawImage: fully zero source pixels are skipped (its mask colour); an opaque
 * normal pixel at full opacity is copied; everything else goes through the blender. */
export function drawRGBA(dst,W,H,src,sw,sh,dx,dy,opacity=255,mode=0){
 const x0=Math.max(0,dx),y0=Math.max(0,dy),x1=Math.min(W,dx+sw),y1=Math.min(H,dy+sh);
 if(x0>=x1||y0>=y1)return;
 for(let y=y0;y<y1;y++){
  let s=((y-dy)*sw+(x0-dx))*4,d=(y*W+x0)*4;
  for(let x=x0;x<x1;x++,s+=4,d+=4){
   const r=src[s],g=src[s+1],b=src[s+2],a=src[s+3];
   if(!(r|g|b|a))continue;
   if(mode===0&&opacity===255&&(a===255||dst[d+3]===0)){dst[d]=r;dst[d+1]=g;dst[d+2]=b;dst[d+3]=a;continue;}
   blendRGBA(dst,d,r,g,b,a,opacity,mode);
  }
 }
}
/** The frame image exporters use: inner rect of the composited moment on the frame's canvas. */
export function composeFrame(asset,frame,rgbaOf,{layers=null}={}){
 const inner=frame.trimmedRect||frame.sourceRect;
 const part=composeCanvas(asset,frame,rgbaOf,{rect:inner,layers});
 if(frame.offsetX===0&&frame.offsetY===0&&frame.canvasWidth===inner.w&&frame.canvasHeight===inner.h)return part;
 const W=frame.canvasWidth,H=frame.canvasHeight,out=new Uint8Array(W*H*4);
 for(let y=0;y<inner.h;y++){const ty=y+frame.offsetY;if(ty<0||ty>=H)continue;
  const x0=Math.max(0,-frame.offsetX),x1=Math.min(inner.w,W-frame.offsetX);if(x1<=x0)continue;
  out.set(part.data.subarray((y*inner.w+x0)*4,(y*inner.w+x1)*4),(ty*W+frame.offsetX+x0)*4);}
 return {width:W,height:H,data:out};
}
/** Mirror of an RGBA image (new array). */
export function flipRGBA(img,{horizontal=true}={}){
 const {width:w,height:h,data}=img,out=new Uint8Array(data.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=horizontal?w-1-x:x,sy=horizontal?y:h-1-y;out.set(data.subarray((sy*w+sx)*4,(sy*w+sx)*4+4),(y*w+x)*4);}
 return {width:w,height:h,data:out};
}
/** Opaque bounds of an RGBA image (alpha > threshold), or null when empty. */
export function opaqueBounds(img,threshold=0){
 const {width:w,height:h,data}=img;let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>threshold){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
export function cropRGBA(img,r){
 const out=new Uint8Array(r.w*r.h*4);
 for(let y=0;y<r.h;y++){const sy=r.y+y;if(sy<0||sy>=img.height)continue;const x0=Math.max(0,r.x),x1=Math.min(img.width,r.x+r.w);if(x1<=x0)continue;out.set(img.data.subarray((sy*img.width+x0)*4,(sy*img.width+x1)*4),(y*r.w+x0-r.x)*4);}
 return {width:r.w,height:r.h,data:out};
}
