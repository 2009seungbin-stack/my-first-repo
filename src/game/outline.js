/** Sprite outlines, pixel-art safe. Pure RGBA in, pure RGBA out.
 *
 * Nothing here anti-aliases, blurs or blends. An outlined pixel is written with exactly the colour
 * it was given, so a 1px black outline on a 16×16 sprite stays one pixel of one colour at any
 * zoom. The band is measured by whole-pixel distance: 8-connectivity counts a diagonal step as one
 * (Chebyshev), so the outline follows corners squarely; 4-connectivity does not (Manhattan), so
 * corners come out bevelled. Choose per taste — both are exact.
 *
 * outer  transparent pixels within `radius` of the sprite become the outline
 * inner  sprite pixels within `radius` of the outside become the outline
 * both   one pass of each, with `innerColour` for the inside band when given */
import {maskOf,distanceField,NEIGHBOURS,ALPHA_THRESHOLD} from './pixels.js';
export const OUTLINE_MODES=Object.freeze(['outer','inner','both']);
const colour=(c,name)=>{
 if(!Array.isArray(c)||c.length<3||c.length>4||!c.every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw Error(`${name} must be [r,g,b] or [r,g,b,a] bytes`);
 return [c[0],c[1],c[2],c.length===4?c[3]:255];
};
/** @param radius        whole pixels, 1…64
 * @param mode           one of OUTLINE_MODES
 * @param connectivity   8 (square corners) or 4 (bevelled corners)
 * @param expand         grow the canvas by `radius` so an outer outline is never clipped
 * @returns {data,width,height,offsetX,offsetY,grown,changed,mask,mode,radius} — `offsetX/offsetY`
 *   is where the original image now sits, so a caller can keep frame offsets in step. */
export function outline(image,{radius=1,mode='outer',connectivity=8,colour:paint=[0,0,0,255],innerColour=null,threshold=ALPHA_THRESHOLD,expand=false}={}){
 if(!OUTLINE_MODES.includes(mode))throw Error(`Outline mode is one of ${OUTLINE_MODES.join(', ')}`);
 if(!Number.isSafeInteger(radius)||radius<1||radius>64)throw Error('Outline radius must be 1…64 whole pixels');
 if(!NEIGHBOURS[connectivity])throw Error('Connectivity is 4 or 8');
 const outer=colour(paint,'colour'),inner=innerColour?colour(innerColour,'innerColour'):outer;
 const pad=expand&&mode!=='inner'?radius:0;
 const width=image.width+pad*2,height=image.height+pad*2;
 const data=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
 for(let y=0;y<image.height;y++){
  const from=y*image.width*4;
  data.set(image.data.subarray(from,from+image.width*4),((y+pad)*width+pad)*4);
 }
 const sprite=maskOf({data,width,height},{threshold});
 let changed=0;
 if(mode==='outer'||mode==='both'){
  const {dist}=distanceField(sprite,{radius,connectivity});
  for(let p=0;p<mask.length;p++)if(!sprite.bits[p]&&dist[p]>0){data.set(outer,p*4);mask[p]=1;changed++;}
 }
 if(mode==='inner'||mode==='both'){
  // Distance from the outside, so "within radius of the edge" is one field, not a per-pixel scan.
  const hole={bits:new Uint8Array(mask.length),width,height};
  for(let p=0;p<hole.bits.length;p++)hole.bits[p]=sprite.bits[p]?0:1;
  const {dist}=distanceField(hole,{radius,connectivity});
  for(let p=0;p<mask.length;p++)if(sprite.bits[p]&&dist[p]>0){data.set(inner,p*4);mask[p]=2;changed++;}
 }
 return {data,width,height,offsetX:pad,offsetY:pad,grown:{left:pad,top:pad,right:pad,bottom:pad},
  changed,mask,mode,radius,connectivity,colour:outer,innerColour:inner};
}
/** The band an outline would occupy, without painting it — for a preview overlay or a cost
 * estimate. `mask` is 1 outside the sprite, 2 inside it, 0 untouched. */
export function outlineMask(image,{radius=1,mode='outer',connectivity=8,threshold=ALPHA_THRESHOLD}={}){
 const {mask,width,height,changed}=outline(image,{radius,mode,connectivity,threshold});
 return {mask,width,height,count:changed};
}
