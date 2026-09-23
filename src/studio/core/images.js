/** Image blobs for the Studio, stored once by content (SHA-256 of the PNG bytes).
 * The document only ever holds the id; the PNG bytes live here (and in IndexedDB / .nerulio),
 * and a decoded ImageBitmap is made on demand and kept only while an asset shows it.
 *
 * Import rules: a PNG is kept byte for byte (exact round trip, no colour or premultiplication
 * drift). JPEG / WebP / GIF (first frame) / BMP / AVIF are decoded once and stored as PNG, since the
 * project format is PNG-only; for JPEG this is lossless with respect to the decoded pixels. */
import {sha256Hex} from './nerulio-file.js';
export const IMPORTABLE=/\.(png|jpe?g|webp|gif|bmp|avif)$/i;
export const isImportable=f=>/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(f?.type||'')||IMPORTABLE.test(f?.name||'');
const isPNG=async blob=>{const b=new Uint8Array(await blob.slice(0,8).arrayBuffer());return b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;};
export class ImageStore{
 constructor(){this.records=new Map();}
 has(id){return this.records.has(id);}
 get(id){return this.records.get(id)||null;}
 blob(id){return this.records.get(id)?.blob||null;}
 /** Adds a PNG blob (id = its hash, computed if not given). Returns the record. */
 async put(blob,{id=null,width=0,height=0,persisted=false}={}){
  id=id||await sha256Hex(blob);
  let r=this.records.get(id);
  if(!r){
   if(!width||!height){const bmp=await createImageBitmap(blob);width=bmp.width;height=bmp.height;bmp.close();}
   r={id,blob:new Blob([blob],{type:'image/png'}),width,height,bitmap:null,decoding:null,persisted};this.records.set(id,r);
  }else if(persisted)r.persisted=true;
  return r;
 }
 /** File → {record, source}. Throws a readable error for undecodable files. */
 async importFile(file){
  let png=file;
  if(!(await isPNG(file))){
   let bmp;try{bmp=await createImageBitmap(file,{premultiplyAlpha:'none',colorSpaceConversion:'default'});}catch{throw Error(`decode:${file.name}`);}
   const c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);bmp.close();
   png=await c.convertToBlob({type:'image/png'});
  }
  let record;try{record=await this.put(png);}catch{throw Error(`decode:${file.name}`);}
  return {record,source:{name:file.name,type:file.type,size:file.size,lastModified:file.lastModified}};
 }
 /** Decoded, premultiplied bitmap for display (shared by every asset showing this blob). */
 async bitmap(id){
  const r=this.records.get(id);if(!r)throw Error(`Image ${id.slice(0,8)} is not loaded`);
  if(r.bitmap)return r.bitmap;
  r.decoding||=createImageBitmap(r.blob,{premultiplyAlpha:'premultiply'}).then(b=>{r.bitmap=b;r.decoding=null;return b;});
  return r.decoding;
 }
 /** Drops decoded bitmaps (not bytes) that nothing on screen needs. */
 trimBitmaps(keep){for(const r of this.records.values())if(r.bitmap&&!keep.has(r.id)){r.bitmap.close?.();r.bitmap=null;}}
 /** Forgets blobs no document state can reach any more (`reachable` = ids from the current
 * document plus every undo step). */
 forget(reachable){for(const [id,r]of this.records)if(!reachable.has(id)){r.bitmap?.close?.();this.records.delete(id);}}
 /** Memory: stored bytes and decoded bytes (4 per pixel of each live bitmap). */
 usage(){let bytes=0,decoded=0;for(const r of this.records.values()){bytes+=r.blob.size;if(r.bitmap)decoded+=r.width*r.height*4;}return {bytes,decoded,count:this.records.size};}
}
