/** Frame pixels in the browser.
 *
 * Two paths, on purpose:
 *  - exact: `frameRGBA` decodes cel PNGs in JavaScript (src/game/texture-png.js — no canvas, so no
 *    premultiplication drift) and composes with frame-image.js. Exporters, mirroring, collision and
 *    jitter use this.
 *  - display: `frameBitmap` draws cel ImageBitmaps on a 2D canvas (fast; Canvas blend modes stand in
 *    for Aseprite's only when a layer is not Normal). The canvas shows this.
 * Both caches are LRU by bytes, so a 245-frame GIF does not keep 500 MB of decoded pixels alive. */
import {decodePNG,encodeRGBAPNG} from '../../game/texture-png.js';
import {frameDraws,composeFrame,composeCanvas} from './frame-image.js';
class LRU{
 constructor(budget,size,dispose=()=>{}){Object.assign(this,{budget,size,dispose});this.map=new Map();this.bytes=0;}
 get(k){const v=this.map.get(k);if(v!==undefined){this.map.delete(k);this.map.set(k,v);}return v;}
 set(k,v){if(this.map.has(k)){this.bytes-=this.size(this.map.get(k));this.map.delete(k);}this.map.set(k,v);this.bytes+=this.size(v);
  for(const [key,val]of this.map){if(this.bytes<=this.budget||this.map.size<=1)break;this.map.delete(key);this.bytes-=this.size(val);this.dispose(val);}}
 clear(){for(const v of this.map.values())this.dispose(v);this.map.clear();this.bytes=0;}
}
const rgbaCache=new LRU(384*2**20,v=>v.data?.length||0);
const bitmapCache=new LRU(512*2**20,v=>v.width*v.height*4,b=>b.close?.());
const pending=new Map();
/** Exact RGBA of a stored PNG. */
export async function blobRGBA(images,id){
 const hit=rgbaCache.get(id);if(hit)return hit;
 if(pending.has('r'+id))return pending.get('r'+id);
 const job=(async()=>{const rec=images.get(id);if(!rec)throw Error(`Image ${String(id).slice(0,8)} is not loaded`);
  const img=await decodePNG(new Uint8Array(await rec.blob.arrayBuffer()),{maxPixels:268e6});const out={width:img.width,height:img.height,data:img.data};rgbaCache.set(id,out);return out;})();
 pending.set('r'+id,job);try{return await job;}finally{pending.delete('r'+id);}
}
/** Decoded display bitmap of a stored PNG. */
export async function blobBitmap(images,id){
 const hit=bitmapCache.get(id);if(hit)return hit;
 if(pending.has('b'+id))return pending.get('b'+id);
 const job=(async()=>{const rec=images.get(id);if(!rec)throw Error(`Image ${String(id).slice(0,8)} is not loaded`);
  const bmp=await createImageBitmap(rec.blob,{premultiplyAlpha:'premultiply',colorSpaceConversion:'none'});bitmapCache.set(id,bmp);return bmp;})();
 pending.set('b'+id,job);try{return await job;}finally{pending.delete('b'+id);}
}
/** Loads every blob the frames draw, then returns a synchronous `rgbaOf` for frame-image.js. */
export async function rgbaGetter(images,asset,frames){
 const ids=new Set();for(const f of frames)for(const d of frameDraws(asset,f))ids.add(d.cel.blob);
 const map=new Map();await Promise.all([...ids].map(async id=>map.set(id,await blobRGBA(images,id))));
 return id=>map.get(id)||null;
}
export async function frameRGBA(images,asset,frame){return composeFrame(asset,frame,await rgbaGetter(images,asset,[frame]));}
export async function canvasRGBA(images,asset,frame,rect){return composeCanvas(asset,frame,await rgbaGetter(images,asset,[frame]),{rect});}
const COMPOSITE={multiply:'multiply',screen:'screen',overlay:'overlay',darken:'darken',lighten:'lighten',color_dodge:'color-dodge',color_burn:'color-burn',hard_light:'hard-light',soft_light:'soft-light',difference:'difference',exclusion:'exclusion',hue:'hue',saturation:'saturation',color:'color',luminosity:'luminosity',addition:'lighter'};
/** Draws a frame (its canvas) into a 2D context at (dx, dy). `alpha` multiplies everything,
 * `tint` [r,g,b] recolours it (onion skin). */
export async function drawFrame(ctx,images,asset,frame,{dx=0,dy=0,alpha=1,tint=null,layers=null}={}){
 const draws=frameDraws(asset,frame,{layers}),inner=frame.trimmedRect||frame.sourceRect;
 const bmps=await Promise.all(draws.map(d=>blobBitmap(images,d.cel.blob)));
 let target=ctx,tmp=null;
 if(tint){tmp=new OffscreenCanvas(frame.canvasWidth,frame.canvasHeight);target=tmp.getContext('2d');}
 target.save();
 if(!tint){target.translate(dx,dy);target.globalAlpha=alpha;}
 target.beginPath();target.rect(frame.offsetX,frame.offsetY,inner.w,inner.h);target.clip();
 draws.forEach((d,i)=>{target.globalAlpha=(tint?1:alpha)*d.opacity/255;target.globalCompositeOperation=COMPOSITE[d.layer.blend]||'source-over';
  target.drawImage(bmps[i],d.cel.x-inner.x+frame.offsetX,d.cel.y-inner.y+frame.offsetY);});
 target.restore();
 if(tint){const x=target;x.globalCompositeOperation='source-atop';x.fillStyle=`rgb(${tint.join(',')})`;x.globalAlpha=.55;x.fillRect(0,0,tmp.width,tmp.height);
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(tmp,dx,dy);ctx.restore();}
}
/** The picture of a whole moment (all layers at that frame, full canvas) for Sheet view. */
export async function momentBitmap(images,asset,frame){
 const c=new OffscreenCanvas(asset.width,asset.height),x=c.getContext('2d');x.imageSmoothingEnabled=false;
 const draws=frameDraws(asset,frame||'*');const bmps=await Promise.all(draws.map(d=>blobBitmap(images,d.cel.blob)));
 draws.forEach((d,i)=>{x.globalAlpha=d.opacity/255;x.globalCompositeOperation=COMPOSITE[d.layer.blend]||'source-over';x.drawImage(bmps[i],d.cel.x,d.cel.y);});
 return c.transferToImageBitmap();
}
/** Exact RGBA → stored PNG (id = SHA-256). */
export async function storeRGBA(images,{width,height,data}){
 const png=await encodeRGBAPNG(data instanceof Uint8Array?data:new Uint8Array(data.buffer,data.byteOffset,data.byteLength),width,height);
 const blob=png instanceof Blob?png:new Blob([png],{type:'image/png'});
 const rec=await images.put(blob,{width,height});
 rgbaCache.set(rec.id,{width,height,data:data instanceof Uint8Array?data:new Uint8Array(data)});
 return rec.id;
}
export function forgetCaches(){rgbaCache.clear();bitmapCache.clear();}
