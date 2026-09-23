/** The Studio packer: frames + decoded sources + settings → atlas pages and a frame table per scale
 * variant. Pure and deterministic (same input and settings → same layout and same bytes). The pack
 * worker (src/studio/pack-worker.js) runs this; exporters (src/game/export/) read its result.
 *
 * Result (per variant):
 *   {scale, suffix, pages:[{index,width,height,efficiency,placements}],
 *    frames:{[frameId]:{page, x, y, w, h, rotated, trimmed, sourceW, sourceH, ox, oy, pivotX, pivotY, aliasOf}},
 *    stats:{frames, unique, aliases, storedArea, pageArea, efficiency}}
 * `x,y` is where the stored (possibly trimmed) pixels start on the page; `w,h` their UNROTATED size;
 * a rotated frame occupies h×w on the page, turned 90° clockwise. `sourceW/H` is the frame canvas at
 * this scale and `ox,oy` where the stored pixels sit on it. `pivot*` is normalised on sourceW/H. */
import {layoutPages,normalizeLayoutSettings} from './layout.js';
import {prepareSprites,renderPage,normalizeSpriteSettings} from './sprites.js';
export const DEFAULT_PACK_SETTINGS=Object.freeze({
 algorithm:'maxrects',heuristic:'best',effort:'normal',maxWidth:4096,maxHeight:4096,sizeMode:'auto',fixedWidth:1024,fixedHeight:1024,multipleOf:1,
 allowRotation:false,shapePadding:2,borderPadding:0,extrude:0,multipack:true,maxPages:16,
 trimMode:'trim',alphaThreshold:0,dedupe:true,premultiply:false,scales:[1]});
export function normalizePackSettings(s={}){
 const merged={...DEFAULT_PACK_SETTINGS,...s};
 const layout=normalizeLayoutSettings(merged),sprite=normalizeSpriteSettings(merged);
 const scales=[...new Set((merged.scales||[1]).map(Number))];
 if(!scales.length||scales.some(v=>!(v>0&&v<=8)))throw Error('Scale variants must be above 0 and at most 8');
 return {...layout,...sprite,premultiply:!!merged.premultiply,scales};
}
/** File-name suffix of a scale variant: @1x has none, 2 → "@2x", 0.5 → "@0.5x". */
export const scaleSuffix=v=>v===1?'':`@${v}x`;
export function packAtlas(frames,sources,settings={},{progress=()=>{}}={}){
 const s=normalizePackSettings(settings);
 if(!frames.length)throw Error('Nothing to pack: add at least one frame.');
 const ids=new Set();for(const f of frames){if(ids.has(f.id))throw Error(`Duplicate frame id ${f.id}`);ids.add(f.id);}
 const variants=[];
 s.scales.forEach((scale,vi)=>{
  progress({phase:'sprites',variant:vi,variants:s.scales.length});
  const sprites=prepareSprites(frames,sources,s,{scale});
  const unique=sprites.filter(x=>!x.aliasOf);
  const lay=layoutPages(unique.map(x=>({id:x.id,w:x.w,h:x.h})),s,{progress:p=>progress({phase:'layout',variant:vi,variants:s.scales.length,...p})});
  const byId=new Map(sprites.map(x=>[x.id,x])),table={};
  const pages=lay.pages.map(pg=>{
   let stored=0;
   for(const pl of pg.placements){const sp=byId.get(pl.id);stored+=sp.w*sp.h;
    table[pl.id]={page:pg.index,x:pl.x,y:pl.y,w:sp.w,h:sp.h,rotated:pl.rotated};}
   return {index:pg.index,width:pg.width,height:pg.height,placements:pg.placements,combo:pg.combo,efficiency:stored/(pg.width*pg.height)};
  });
  const frameTable={};
  for(const sp of sprites){
   const place=table[sp.aliasOf??sp.id];
   frameTable[sp.id]={...place,trimmed:sp.trimmed,sourceW:sp.sourceW,sourceH:sp.sourceH,ox:sp.ox,oy:sp.oy,pivotX:sp.pivotX,pivotY:sp.pivotY,aliasOf:sp.aliasOf};
  }
  const storedArea=unique.reduce((n,x)=>n+x.w*x.h,0),pageArea=pages.reduce((n,p)=>n+p.width*p.height,0);
  variants.push({scale,suffix:scaleSuffix(scale),pages,frames:frameTable,sprites:byId,tried:lay.tried,
   stats:{frames:sprites.length,unique:unique.length,aliases:sprites.length-unique.length,storedArea,pageArea,efficiency:pageArea?storedArea/pageArea:0}});
 });
 return {settings:s,variants};
}
/** RGBA pixels of every page of a variant (one page at a time when iterated lazily). */
export function* renderVariantPages(variant,settings){
 for(const page of variant.pages)yield renderPage(page,variant.sprites,{extrude:settings.extrude,premultiply:settings.premultiply});
}
/** The frame table without pixel data: what the UI thread and the exporters receive. */
export function publicResult(result){
 return {settings:result.settings,variants:result.variants.map(v=>({scale:v.scale,suffix:v.suffix,stats:v.stats,tried:v.tried,frames:v.frames,
  pages:v.pages.map(p=>({index:p.index,width:p.width,height:p.height,efficiency:p.efficiency,combo:p.combo}))}))};
}
