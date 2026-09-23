/** The Pixel workspace's editing session: the current frame of the current sprite decoded into one
 * PLANE per layer (packed RGBA for RGB sprites, palette indices for indexed ones), composited with
 * Aseprite's blend modes, shown on the canvas and updated in place while a stroke is drawn.
 *
 * The canvas shows the frame's REGION of the sprite canvas (frame.sourceRect; the whole canvas for a
 * sprite without frames). A stroke paints one layer's plane; committing it writes a new cel for
 * (layer, frame) — a new PNG blob, an indexed PNG in an indexed sprite — as ONE undo step. Nothing
 * is written to the document while the pointer is down. */
import * as R from '../../pixel/raster.js';
import * as PD from '../../pixel/pixel-doc.js';
import {rgbaFromIndices,indicesFromRGBA,keyOf} from '../../pixel/indexed.js';
import {encodeIndexedPNG,decodeIndexedPNG} from '../../pixel/png8.js';
import {celAt} from '../../sprite/frame-image.js';
import {blobRGBA,storeRGBA,drawFrame} from '../../sprite/frame-render.js';
import {blendRGBA,mul8} from '../../../game/aseprite-blend.js';
import {blendIndex} from '../../sprite/frame-image.js';
const indexCache=new Map();// blob id → {indices, colors} of indexed PNGs (small: cels, not sheets)
export class Session{
 constructor({images,view}){this.images=images;this.view=view;this.asset=null;this.layers=[];this.frameId=null;this.rect=null;this.onion=null;this.token=0;this.float=null;this.shownKey='';}
 get kind(){return PD.isIndexed(this.asset)?R.INDEXED:R.RGBA;}
 get ti(){return PD.transparentIndexOf(this.asset);}
 get clear(){return this.kind===R.INDEXED?Math.max(0,this.ti):0;}
 get colors(){return this.asset?.palette?.colors||[];}
 /** Packed RGBA of a plane value (for colour tests and compositing). */
 rgbaOf(v){return this.kind===R.INDEXED?this.lut[v]:v;}
 buildLUT(){const lut=new Uint32Array(256),c=this.colors,ti=this.ti;for(let i=0;i<c.length;i++)lut[i]=i===ti?0:keyOf(c[i][0],c[i][1],c[i][2],c[i][3]??255);this.lut=lut;}
 layer(id){return this.layers.find(l=>l.id===id)||null;}
 /** (Re)loads the frame. Planes whose cel did not change are kept (undo of another layer's stroke
  * does not decode everything again). */
 async load(asset,frameIndex){
  const token=++this.token,tg=PD.target(asset,frameIndex),{w,h}=tg.rect;
  const sameTarget=this.asset?.id===asset.id&&this.frameId===tg.frameId&&this.rect&&this.rect.x===tg.rect.x&&this.rect.y===tg.rect.y&&this.rect.w===w&&this.rect.h===h;
  const kindChanged=this.asset&&PD.isIndexed(this.asset)!==PD.isIndexed(asset);
  const prev=sameTarget&&!kindChanged?new Map(this.layers.map(l=>[l.id,l])):new Map();
  const next=[];
  const kind=PD.isIndexed(asset)?R.INDEXED:R.RGBA;
  for(const meta of asset.layers){
   const cel=tg.frameId==='*'?asset.cels.find(c=>c.layerId===meta.id&&c.frameId==='*')||null:celAt(asset,meta.id,tg.frameId);
   const old=prev.get(meta.id);
   if(old&&old.cel===cel&&(kind!==R.INDEXED||old.paletteKey===paletteKey(asset))){next.push({...old,meta});continue;}
   next.push({id:meta.id,meta,cel,plane:await this.decode(asset,cel,tg.rect,kind),paletteKey:paletteKey(asset)});
   if(token!==this.token)return false;
  }
  this.asset=asset;this.frameId=tg.frameId;this.frame=tg.frame;this.rect=tg.rect;this.layers=next;this.buildLUT();
  return true;
 }
 async decode(asset,cel,rect,kind){
  const p=R.plane(rect.w,rect.h,kind,kind===R.INDEXED?Math.max(0,PD.transparentIndexOf(asset)):0);if(!cel)return p;
  let src;// plane of the cel image
  if(kind===R.INDEXED){
   let hit=indexCache.get(cel.blob);
   if(!hit){const rec=this.images.get(cel.blob);if(!rec)throw Error(`Image ${cel.blob.slice(0,8)} is not loaded`);const bytes=new Uint8Array(await rec.blob.arrayBuffer());let d=null;try{d=decodeIndexedPNG(bytes);}catch{}if(d){hit={indices:d.indices,colors:d.colors,width:d.width,height:d.height};indexCache.set(cel.blob,hit);}}
   const pal=asset.palette.colors,ti=PD.transparentIndexOf(asset);
   if(hit&&samePalette(hit.colors,pal,ti))src={w:hit.width,h:hit.height,data:hit.indices};
   else{const img=await blobRGBA(this.images,cel.blob);src={w:img.width,h:img.height,data:indicesFromRGBA(img.data,img.width,img.height,pal,{transparentIndex:ti}).indices};}
  }else{const img=await blobRGBA(this.images,cel.blob);src=R.planeFromRGBA(img.data,img.width,img.height);}
  const dx=cel.x-rect.x,dy=cel.y-rect.y;
  for(let y=0;y<src.h;y++){const ty=y+dy;if(ty<0||ty>=rect.h)continue;const x0=Math.max(0,-dx),x1=Math.min(src.w,rect.w-dx);if(x1>x0)p.data.set(src.data.subarray(y*src.w+x0,y*src.w+x1),ty*rect.w+dx+x0);}
  return p;
 }
 // ------------------------------------------------------------------ compositing
 /** RGBA bytes of the frame (visible layers) for `rect` (region coordinates). */
 compose(rect=null,{onion=true,extra=null}={}){
  const {w}=this.rect,r=rect||{x:0,y:0,w:this.rect.w,h:this.rect.h},out=new Uint8Array(r.w*r.h*4),lut=this.lut,idx=this.kind===R.INDEXED;
  for(const l of this.layers){
   if(!l.meta.visible)continue;const op=l.meta.opacity??255,cop=l.cel?.opacity??255,opacity=mul8(op,cop),mode=blendIndex(l.meta.blend);if(!opacity)continue;
   const data=(extra?.id===l.id?extra.plane:l.plane).data;
   for(let y=0;y<r.h;y++){let s=(r.y+y)*w+r.x,d=y*r.w*4;
    for(let x=0;x<r.w;x++,s++,d+=4){const v=idx?lut[data[s]]:data[s];if(!v)continue;const a=v>>>24;
     if(mode===0&&opacity===255&&(a===255||out[d+3]===0)){out[d]=v&255;out[d+1]=v>>>8&255;out[d+2]=v>>>16&255;out[d+3]=a;continue;}
     blendRGBA(out,d,v&255,v>>>8&255,v>>>16&255,a,opacity,mode);}}
  }
  if(onion&&this.onion){// the frame over the onion skin (normal "over", display only)
   const o=this.onion;for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const d=(y*r.w+x)*4,s=((r.y+y)*w+r.x+x)*4,oa=o[s+3];if(!oa)continue;const a=out[d+3];if(a===255)continue;
    if(!a){out[d]=o[s];out[d+1]=o[s+1];out[d+2]=o[s+2];out[d+3]=oa;continue;}
    const fa=a/255,ob=oa/255*(1-fa),na=fa+ob;for(let c=0;c<3;c++)out[d+c]=Math.round((out[d+c]*fa+o[s+c]*ob)/na);out[d+3]=Math.round(na*255);}
  }
  return out;
 }
 /** Shows the whole frame (after load, undo, layer changes). Keeps the view when the size is the same. */
 async show({view=null}={}){
  const {w,h}=this.rect,c=new OffscreenCanvas(w,h);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.compose().buffer),w,h),0,0);
  const same=this.view.image&&this.view.image.w===w&&this.view.image.h===h;
  await this.view.setImage(c,w,h,{view:view||(same?this.view.view:null)});
 }
 /** Live update of part of the canvas. */
 refresh(rect,extra=null){
  const r=R.clipRect(rect,this.rect.w,this.rect.h);if(!r)return;
  this.view.updateImage(this.compose(r,{extra}),r);
 }
 /** Onion skin: neighbour frames' regions composited from the document, tinted. */
 async buildOnion(asset,list,{tint=true}={}){
  if(!list?.length||!this.frame){this.onion=null;return;}
  const {w,h}=this.rect,c=new OffscreenCanvas(w,h),x=c.getContext('2d');x.imageSmoothingEnabled=false;
  for(const o of [...list].reverse()){const f=asset.frames[o.index];if(!f)continue;
   // the neighbour's own region, drawn at the same place in this region (frames of a sheet line up cell to cell)
   await drawFrame(x,this.images,asset,{...f,trimmedRect:null,offsetX:0,offsetY:0,canvasWidth:f.sourceRect.w,canvasHeight:f.sourceRect.h},{alpha:o.alpha,tint:tint?o.side==='prev'?[255,70,70]:[70,140,255]:null});}
  this.onion=new Uint8Array(x.getImageData(0,0,w,h).data.buffer);
 }
 // ------------------------------------------------------------------ committing
 /** The layer's plane → a cel for (layer, frame): trimmed to its pixels, indexed PNG when indexed.
  * Returns the new cel (the caller executes the document edit). */
 async celFor(id,plane=this.layer(id).plane){
  const l=this.layer(id),b=R.planeBounds(plane,this.clear),rect=this.rect;
  const r=b||{x:0,y:0,w:1,h:1},crop=R.cropPlane(plane,r,this.clear);let blob;
  if(this.kind===R.INDEXED){
   const png=encodeIndexedPNG(crop.data,r.w,r.h,this.colors,{transparentIndex:this.ti});const rec=await this.images.put(new Blob([png],{type:'image/png'}),{width:r.w,height:r.h});blob=rec.id;
   indexCache.set(blob,{indices:crop.data.slice(),colors:this.colors.map(c=>[c[0],c[1],c[2],c[3]??255]),width:r.w,height:r.h});
  }else blob=await storeRGBA(this.images,{width:r.w,height:r.h,data:new Uint8Array(crop.data.buffer.slice(0))});
  return {layerId:id,frameId:this.frameId,blob,x:rect.x+r.x,y:rect.y+r.y,opacity:l.cel?.opacity??255};
 }
 /** After the document took the cel: the plane now matches it (no re-decode). */
 adopt(asset,id,cel){const l=this.layer(id);if(l){l.cel=cel;l.paletteKey=paletteKey(asset);}this.asset=asset;}
 /** Pixels of the whole frame as RGBA (eyedropper "all layers", bucket "sample merged"). */
 mergedPlane(){const d=this.compose(null,{onion:false});return R.planeFromRGBA(d,this.rect.w,this.rect.h);}
}
const paletteKey=a=>a?.colorMode==='indexed'?JSON.stringify([a.palette?.colors,a.transparentIndex]):'rgb';
/** Same palette as the PNG's PLTE/tRNS (the transparent entry is written with alpha 0, so its alpha is not compared). */
const samePalette=(a,b,ti)=>a.length===b.length&&a.every((c,i)=>c[0]===b[i][0]&&c[1]===b[i][1]&&c[2]===b[i][2]&&(i===ti||(c[3]??255)===(b[i][3]??255)));
export {indexCache};
