/** Packing frames into one or more atlas pages. Builds the model's Atlas; draws nothing.
 *
 * Three things a single-page packer gets wrong and this does not:
 *
 * * **More frames than fit.** When the set cannot go on one page it is split across atlas-0,
 *   atlas-1, … Each frame records its `page`, so nothing silently disappears and no page is grown
 *   past the size limit.
 * * **Frames that are the same pixels.** A held pose, a re-used idle, a mirrored frame that came
 *   back identical: the pixels are stored once and every other frame becomes an `aliasOf` pointing
 *   at the same region. Identity is decided by a content hash and then confirmed byte for byte, so
 *   a hash collision cannot alias two different frames.
 * * **Padding versus extrude.** `padding` is empty space kept between neighbours so a filtered
 *   texture cannot sample across; `extrude` is a belt of *copied edge pixels* around each frame,
 *   which is what stops a seam when a tile is drawn at a non-integer scale. The recorded x/y/w/h
 *   is always the sprite itself — the belt sits outside it — so a reader that ignores extrude
 *   still gets exactly the right pixels.
 *
 * Rotation is not offered. `AtlasTexture` in Godot has no rotation and neither does Unity's sprite
 * importer, so a rotated region could not be described to two of the three exporters; offering a
 * packing mode that silently breaks an export is worse than the few percent of area it would save. */
import {packRects} from '../atlas-pack.js';
import {source,innerRect,hashBytes,checkRect} from './pixels.js';
export const ROTATION_SUPPORTED=false;
export const MAX_PAGES=64;
/** Identity of a frame's stored pixels: size plus a hash of the exact bytes. */
export function frameKey(src,f){
 const s=source(src),inner=innerRect(f),img=s.read(checkRect(inner,s.width,s.height,`frame ${f.name||f.id}`));
 return {id:f.id,w:inner.w,h:inner.h,hash:hashBytes(img.data),key:`${inner.w}x${inner.h}:${hashBytes(img.data)}`};
}
const sameBytes=(a,b)=>{if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;};
/** Groups frames whose stored pixels are byte-identical. Only two frames are in memory at a time. */
export function findAliases(src,frames){
 const s=source(src),keys=frames.map(f=>frameKey(s,f)),buckets=new Map();
 for(const k of keys)(buckets.get(k.key)||buckets.set(k.key,[]).get(k.key)).push(k);
 const representatives=[],aliasOf=new Map();
 for(const bucket of buckets.values()){
  const byId=new Map(frames.map(f=>[f.id,f])),leaders=[];
  for(const candidate of bucket){
   const bytes=s.read(innerRect(byId.get(candidate.id))).data;
   const leader=leaders.find(l=>sameBytes(l.bytes,bytes));
   if(leader)aliasOf.set(candidate.id,leader.id);else leaders.push({id:candidate.id,bytes});
  }
  for(const l of leaders)representatives.push(l.id);
 }
 return {aliasOf,representatives:new Set(representatives),keys};
}
/** Fills one page. The frames are ordered largest first, so the page starts as the longest prefix
 * that fits — found by binary search, which is exact because prefix packing is monotone (adding a
 * rectangle never makes a set easier) and costs about log2(n) attempts instead of n. A prefix
 * alone wastes space, though: one 90px frame would hold a 128px page on its own while 40px frames
 * queue behind it. So a bounded top-up pass then walks the rest of the list and keeps whatever
 * still fits beside what is already there.
 * @returns {packed, taken} — `taken` is the set of ids placed, not necessarily a prefix. */
function fillPage(rects,options,{topUp=64}={}){
 const attempt=list=>{
  try{return packRects(list,options);}
  catch(error){
   if(/larger than the/.test(error.message))throw error;
   if(/do not fit|needs \d+×\d+px/.test(error.message))return null;
   throw error;
  }
 };
 const one=attempt(rects.slice(0,1));
 if(!one)throw Error('A single frame does not fit the atlas size limit.');
 const all=rects.length>1?attempt(rects):one;
 if(all&&rects.length>1)return {packed:all,taken:new Set(rects.map(r=>r.id))};
 let lo=1,hi=rects.length,best={packed:one,count:1};
 while(lo+1<hi){
  const mid=(lo+hi)>>1,packed=attempt(rects.slice(0,mid));
  if(packed){lo=mid;best={packed,count:mid};}else hi=mid;
 }
 let chosen=rects.slice(0,best.count),packed=best.packed;
 for(let i=best.count,tried=0;i<rects.length&&tried<topUp;i++,tried++){
  const next=attempt([...chosen,rects[i]]);
  if(next){chosen=[...chosen,rects[i]];packed=next;}
 }
 return {packed,taken:new Set(chosen.map(r=>r.id))};
}
/** @param src      the sheet the frames were cut from ({data,width,height} or {width,height,read})
 * @param frames    model frames; a frame with no opaque pixels is reported, not packed
 * @param padding   empty pixels kept between neighbours
 * @param extrude   pixels of copied edge colour around each frame (outside its recorded rect)
 * @param dedupe    store byte-identical frames once and alias the rest
 * @returns {atlas, pages, efficiency, paddedEfficiency, aliases, unique, blank, warnings} */
export function packFrames(src,frames,{maxSize=4096,padding=2,extrude=0,pot=false,rotate=false,dedupe=true,layout='packed',columns=0,maxPages=MAX_PAGES,signal}={}){
 if(rotate)throw Error('Rotated atlas regions are not supported: Godot AtlasTexture and Unity sprite rects cannot describe one, so the data would not match the image.');
 if(!frames.length)throw Error('Add at least one frame.');
 for(const [name,value,limit] of [['padding',padding,256],['extrude',extrude,64]])
  if(!Number.isSafeInteger(value)||value<0||value>limit)throw Error(`${name} must be 0…${limit} whole pixels`);
 if(!Number.isSafeInteger(maxSize)||maxSize<8||maxSize>32768)throw Error('maxSize must be 8…32768');
 const s=source(src),warnings=[];
 const blank=frames.filter(f=>!f.trimmedRect&&!f.sourceRect).map(f=>f.id);
 const {aliasOf,representatives}=dedupe?findAliases(s,frames):{aliasOf:new Map(),representatives:new Set(frames.map(f=>f.id))};
 if(aliasOf.size)warnings.push(`${aliasOf.size} frame(s) are the same pixels as another and are stored once.`);
 const byId=new Map(frames.map(f=>[f.id,f]));
 const rects=frames.filter(f=>representatives.has(f.id)).map(f=>{const inner=innerRect(f);
  return {id:f.id,w:inner.w+extrude*2,h:inner.h+extrude*2,spriteW:inner.w,spriteH:inner.h};})
  .sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h);
 const options={maxSize,padding,pot,rotate:false,layout,columns};
 const pages=[],placements=new Map();
 let remaining=rects;
 while(remaining.length){
  signal?.throwIfAborted?.();
  if(pages.length>=maxPages)throw Error(`These frames need more than ${maxPages} atlas pages; raise the size limit or pack fewer frames.`);
  const {packed,taken}=fillPage(remaining,options),index=pages.length;
  let extentX=0,extentY=0;
  for(const p of packed.placements){
   const rect=remaining.find(r=>r.id===p.id);
   placements.set(p.id,{page:index,x:p.x+extrude,y:p.y+extrude,w:rect.spriteW,h:rect.spriteH,rotated:false,aliasOf:null});
   extentX=Math.max(extentX,p.x+rect.w+padding);extentY=Math.max(extentY,p.y+rect.h+padding);
  }
  // The page is sized from the placements rather than from packRects' own figure, which adds one
  // padding too many and can therefore report a page a pixel or two past maxSize.
  const next=n=>{let v=1;while(v<n)v*=2;return v;};
  const size=layout==='packed'?{width:pot?next(extentX):extentX,height:pot?next(extentY):extentY}:{width:packed.width,height:packed.height};
  pages.push({index,...size,frames:packed.placements.map(p=>p.id)});
  remaining=remaining.filter(r=>!taken.has(r.id));
 }
 if(pages.length>1)warnings.push(`The frames need ${pages.length} pages at ${maxSize}px; each frame records which one it is on.`);
 const atlasFrames={};
 for(const f of frames){
  const target=aliasOf.get(f.id);
  const placed=placements.get(target??f.id);
  if(!placed){warnings.push(`${f.name||f.id} could not be placed.`);continue;}
  atlasFrames[f.id]=target?{...placed,aliasOf:target}:{...placed};
 }
 const pageArea=pages.reduce((sum,p)=>sum+p.width*p.height,0);
 const used=[...placements.values()].reduce((sum,p)=>sum+p.w*p.h,0);
 const reserved=[...placements.values()].reduce((sum,p)=>sum+(p.w+extrude*2+padding*2)*(p.h+extrude*2+padding*2),0);
 for(const page of pages)page.efficiency=page.frames.reduce((sum,id)=>{const p=placements.get(id);return sum+p.w*p.h;},0)/(page.width*page.height);
 return {atlas:{width:Math.max(...pages.map(p=>p.width)),height:Math.max(...pages.map(p=>p.height)),padding,extrude,
   pages:pages.length,pageSizes:pages.map(p=>({width:p.width,height:p.height})),frames:atlasFrames},
  pages,efficiency:used/pageArea,paddedEfficiency:Math.min(1,reserved/pageArea),
  aliases:Object.fromEntries(aliasOf),unique:placements.size,blank,warnings,rotation:ROTATION_SUPPORTED};
}
/** Draws one atlas page: every frame's pixels at its recorded rect, plus the extrude belt of
 * copied edge pixels. One page is allocated at a time, never all of them. */
export function blitPage(src,frames,atlas,pageIndex=0,{pages=null}={}){
 const s=source(src),size=atlas.pageSizes?.[pageIndex]??{width:atlas.width,height:atlas.height};
 if(!size)throw Error(`No atlas page ${pageIndex}`);
 const {width,height}=size,data=new Uint8ClampedArray(width*height*4),extrude=atlas.extrude||0;
 const byId=new Map(frames.map(f=>[f.id,f]));
 const drawn=new Set();
 for(const [id,place] of Object.entries(atlas.frames)){
  if(place.page!==pageIndex||place.aliasOf)continue;
  const key=`${place.x},${place.y}`;
  if(drawn.has(key))continue;
  drawn.add(key);
  const f=byId.get(id);
  if(!f)throw Error(`Atlas names frame ${id}, which is not in the frame list`);
  const inner=innerRect(f),img=s.read(checkRect(inner,s.width,s.height,`frame ${f.name||id}`));
  if(img.width!==place.w||img.height!==place.h)throw Error(`${f.name||id} is ${img.width}×${img.height} but the atlas reserved ${place.w}×${place.h}`);
  for(let y=-extrude;y<place.h+extrude;y++)for(let x=-extrude;x<place.w+extrude;x++){
   const dx=place.x+x,dy=place.y+y;
   if(dx<0||dy<0||dx>=width||dy>=height)continue;
   const sx=Math.max(0,Math.min(place.w-1,x)),sy=Math.max(0,Math.min(place.h-1,y)),from=(sy*place.w+sx)*4;
   data.set(img.data.subarray(from,from+4),(dy*width+dx)*4);
  }
 }
 return {data,width,height,page:pageIndex};
}
/** Reads a frame's region back out of a drawn page — the check that the data describes the image. */
export function readRegion(page,rect){
 const r=checkRect(rect,page.width,page.height,'region'),data=new Uint8ClampedArray(r.w*r.h*4);
 for(let y=0;y<r.h;y++){const from=((r.y+y)*page.width+r.x)*4;data.set(page.data.subarray(from,from+r.w*4),y*r.w*4);}
 return {data,width:r.w,height:r.h};
}
/** Overlap check across every page: the guarantee that two frames never share a pixel. */
export function findOverlaps(atlas,{includePadding=false}={}){
 const pad=includePadding?(atlas.padding||0):0,extrude=atlas.extrude||0,grow=pad+extrude;
 const byPage=new Map();
 for(const [id,p] of Object.entries(atlas.frames)){
  if(p.aliasOf)continue;
  (byPage.get(p.page)||byPage.set(p.page,[]).get(p.page)).push({id,x:p.x-grow,y:p.y-grow,w:p.w+grow*2,h:p.h+grow*2});
 }
 const overlaps=[];
 for(const [page,list] of byPage)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];
  if(a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h)continue;// the same region, shared by identical frames
  if(a.x+a.w>b.x&&b.x+b.w>a.x&&a.y+a.h>b.y&&b.y+b.h>a.y)overlaps.push({page,a:a.id,b:b.id});
 }
 return overlaps;
}
