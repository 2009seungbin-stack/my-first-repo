import * as Im from '../image.js';
import {decodePNG,isPNG} from '../game/texture-png.js';
/** Colour-exact decoding for the game tools. A browser decode is colour-managed: a PNG with gAMA
 * or cHRM chunks (OpenGameArt's ninja frames have both) comes back with every colour shifted
 * (50 → 46), and a sprite atlas built from that no longer matches its source. Game art is data:
 * the bytes in the file are the colours. PNG goes through the exact decoder (src/game/texture-png.js);
 * anything else asks the browser for no colour-space conversion; only if both fail does the
 * ordinary decode run. Returns a canvas like Im.decode. */
export async function decodeExact(file){
 const head=new Uint8Array(await file.slice(0,16).arrayBuffer());
 if(isPNG(head)){
  try{
   const png=await decodePNG(new Uint8Array(await file.arrayBuffer()));
   const c=Im.canvas(png.width,png.height),data=new Uint8ClampedArray(png.data.buffer,png.data.byteOffset,png.data.byteLength);
   c.getContext('2d').putImageData(new ImageData(data,png.width,png.height),0,0);
   // A canvas stores premultiplied colour, so a pixel at alpha 20 comes back with its RGB rounded
   // to a few levels. The exact bytes ride along for tools that write pixels back out.
   c.exact={data,width:png.width,height:png.height};
   return c;
  }catch{/* interlaced or unusual PNG: fall through to the browser without colour management */}
 }
 if(!/svg|hei[cf]/i.test(file.type||'')&&!/\.(svg|hei[cf])$/i.test(file.name||'')){
  try{
   const bitmap=await createImageBitmap(file,{colorSpaceConversion:'none',premultiplyAlpha:'none',imageOrientation:'from-image'});
   try{const c=Im.canvas(bitmap.width,bitmap.height);c.getContext('2d').drawImage(bitmap,0,0);return c;}finally{bitmap.close();}
  }catch{/* not decodable this way */}
 }
 return Im.decode(file);
}
