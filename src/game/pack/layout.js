/** Page layout for the Studio packer: which sprite goes on which page, where, and whether rotated.
 * Pure and deterministic; no pixels (see sprites.js for those).
 *
 * Geometry. A sprite of w×h stored pixels takes a footprint of (w + 2·extrude + shapePadding) ×
 * (h + 2·extrude + shapePadding) inside the page's usable area, which is the page minus
 * `borderPadding` on every side plus one `shapePadding` (so the last column needs no gap after it).
 * The stored pixels start at borderPadding + footprint position + extrude. Consequences that the
 * unit tests assert: two sprites are always ≥ shapePadding apart (extrude belts included), every
 * extrude belt is ≥ borderPadding from the page edge, and nothing leaves the page.
 *
 * Search. For "smallest page" the packer tries strip widths around √(total area) with every
 * heuristic × sort order, keeps the smallest resulting page (after power-of-two / square /
 * multiple-of rounding), then tightens the height of the winner by bisection. The amount of work
 * depends only on the input and the settings — never on a clock — so the same project always packs
 * to the same atlas. When the sprites do not fit one page of the maximum size, pages are filled
 * one at a time (most area first) and each page is then shrunk to its own smallest size. */
import {makeBin,heuristicsOf,ALGORITHMS} from './bins.js';
export const SIZE_MODES=Object.freeze(['auto','pot','square','pot-square','fixed']);
export const SORTS=Object.freeze(['area','maxside','height','width','perimeter']);
const nextPow2=n=>{let v=1;while(v<n)v*=2;return v;};
const prevPow2=n=>{let v=1;while(v*2<=n)v*=2;return v;};
const roundTo=(n,d)=>d>1?Math.ceil(n/d)*d:n;
const cmp=(a,b,keys)=>{for(const k of keys){const d=a[k]-b[k];if(d)return d;}return 0;};
function sorted(items,order){
 const key={area:r=>r.fw*r.fh,maxside:r=>Math.max(r.fw,r.fh),height:r=>r.fh,width:r=>r.fw,perimeter:r=>r.fw+r.fh}[order];
 const second={area:r=>Math.max(r.fw,r.fh),maxside:r=>r.fw*r.fh,height:r=>r.fw,width:r=>r.fh,perimeter:r=>r.fw*r.fh}[order];
 return items.map((r,i)=>({r,i})).sort((a,b)=>key(b.r)-key(a.r)||second(b.r)-second(a.r)||a.i-b.i).map(x=>x.r);
}
export function normalizeLayoutSettings(s={}){
 const n=(v,d,min,max,name)=>{const x=v??d;if(!Number.isSafeInteger(x)||x<min||x>max)throw Error(`${name} must be a whole number ${min}…${max}`);return x;};
 const out={
  algorithm:s.algorithm??'maxrects',heuristic:s.heuristic??'best',
  maxWidth:n(s.maxWidth,4096,8,16384,'Max width'),maxHeight:n(s.maxHeight,4096,8,16384,'Max height'),
  sizeMode:s.sizeMode??'auto',fixedWidth:n(s.fixedWidth,1024,8,16384,'Fixed width'),fixedHeight:n(s.fixedHeight,1024,8,16384,'Fixed height'),
  multipleOf:n(s.multipleOf,1,1,64,'Size multiple'),allowRotation:!!s.allowRotation,
  shapePadding:n(s.shapePadding,2,0,64,'Shape padding'),borderPadding:n(s.borderPadding,0,0,64,'Border padding'),extrude:n(s.extrude,0,0,32,'Extrude'),
  multipack:s.multipack!==false,maxPages:n(s.maxPages,16,1,64,'Max pages'),effort:s.effort??'normal'};
 if(!ALGORITHMS.includes(out.algorithm))throw Error(`Unknown algorithm ${out.algorithm}`);
 if(out.heuristic!=='best'&&!heuristicsOf(out.algorithm).includes(out.heuristic))throw Error(`${out.algorithm} has no heuristic ${out.heuristic}`);
 if(!SIZE_MODES.includes(out.sizeMode))throw Error(`Unknown size mode ${out.sizeMode}`);
 if(!['fast','normal','best'].includes(out.effort))throw Error(`Unknown effort ${out.effort}`);
 if(out.sizeMode==='fixed'){out.maxWidth=out.fixedWidth;out.maxHeight=out.fixedHeight;}
 return out;
}
/** Everything the packer will try, in a fixed order. */
function combos(s,count){
 const heur=s.heuristic==='best'?heuristicsOf(s.algorithm):[s.heuristic];
 const sorts=s.effort==='fast'?['maxside']:s.effort==='best'||count<=200?SORTS:['area','maxside'];
 const out=[];for(const h of heur)for(const o of sorts)out.push({algorithm:s.algorithm,heuristic:h,sort:o});
 return out;
}
/** Pack `list` (footprints) into one bin of aw×ah usable pixels; all must fit unless `partial`. */
function packInto(list,aw,ah,c,rotate,partial=false,strip=false){
 const bin=makeBin(c.algorithm,c.heuristic,aw,ah,rotate,{openBottom:strip}),placed=[];let usedW=0,usedH=0,area=0;
 for(const r of list){
  const n=bin.insert(r.fw,r.fh);
  if(!n){if(partial)continue;return null;}
  placed.push({id:r.id,fx:n.x,fy:n.y,rot:n.rot});usedW=Math.max(usedW,n.x+n.w);usedH=Math.max(usedH,n.y+n.h);area+=r.fw*r.fh;
 }
 return {placed,usedW,usedH,area};
}
export function layoutPages(items,settings={},{progress=()=>{}}={}){
 const s=normalizeLayoutSettings(settings);
 if(!items.length)return {pages:[],settings:s,tried:0};
 const e=s.extrude,p=s.shapePadding,b=s.borderPadding;
 const avail=v=>v-2*b+p,page=v=>v-p+2*b;
 const foot=items.map((it,i)=>({id:it.id,w:it.w,h:it.h,fw:it.w+2*e+p,fh:it.h+2*e+p,i}));
 const potMode=s.sizeMode==='pot'||s.sizeMode==='pot-square',square=s.sizeMode==='square'||s.sizeMode==='pot-square';
 const maxW=potMode?prevPow2(s.maxWidth):s.maxWidth,maxH=potMode?prevPow2(s.maxHeight):s.maxHeight;
 const tooBig=foot.filter(r=>{const fits=(w,h)=>w<=avail(maxW)&&h<=avail(maxH);return !(fits(r.fw,r.fh)||s.allowRotation&&fits(r.fh,r.fw));});
 if(tooBig.length)throw Object.assign(Error(`${tooBig.length} sprite(s) do not fit a ${maxW}×${maxH} page with this padding: ${tooBig.slice(0,4).map(r=>`${r.id} (${r.w}×${r.h})`).join(', ')}`),{code:'too-big',ids:tooBig.map(r=>r.id)});
 let tried=0;
 const tick=()=>{tried++;if(tried%4===0)progress({tried});};
 /** Final page size from a bin's used extent, or null when the rounding breaks the limits. */
 const finish=(usedW,usedH)=>{
  let w=page(usedW),h=page(usedH);
  if(s.sizeMode==='fixed')return {w:s.fixedWidth,h:s.fixedHeight};
  if(potMode){w=nextPow2(w);h=nextPow2(h);}
  w=roundTo(w,s.multipleOf);h=roundTo(h,s.multipleOf);
  if(square){w=h=Math.max(w,h);if(potMode)w=h=nextPow2(w);}
  return w<=s.maxWidth&&h<=s.maxHeight?{w,h}:null;
 };
 // Smallest area wins, with a 2 % surcharge per unit of aspect ratio so a near-tie goes to the
 // squarer page; a page more than 3:1 only wins when nothing squarer exists (a 48×2998 column of
 // frames has no waste and is still not what anyone wants in an engine).
 const better=(a,b)=>!b||cmp(a,b,['long','cost','area','side','w'])<0;
 /** Smallest single page holding ALL of `list`, or null. */
 function bestPage(list){
  const cs=combos(s,list.length);
  const area=list.reduce((n,r)=>n+r.fw*r.fh,0);
  const minAw=Math.max(...list.map(r=>s.allowRotation?Math.min(r.fw,r.fh):r.fw));
  const minAh=Math.max(...list.map(r=>s.allowRotation?Math.min(r.fw,r.fh):r.fh));
  let best=null;
  const consider=(res,c)=>{if(!res)return;const size=finish(res.usedW,res.usedH);if(!size)return;
   const side=Math.max(size.w,size.h),aspect=side/Math.min(size.w,size.h);
   const area=size.w*size.h,cand={...size,area,side,long:aspect>3?1:0,cost:Math.round(area*(1+.02*(aspect-1))),placed:res.placed,combo:c};if(better(cand,best))best=cand;};
  if(s.sizeMode==='fixed'){
   for(const c of cs){tick();consider(packInto(sorted(list,c.sort),avail(s.fixedWidth),avail(s.fixedHeight),c,s.allowRotation),c);}
   return best;
  }
  if(square){
   // One side for both: the smallest side (bisection per combo) that holds everything.
   const sides=potMode?[]:null;
   if(potMode)for(let v=nextPow2(Math.max(page(minAw),page(minAh)));v<=Math.min(maxW,maxH);v*=2)sides.push(v);
   for(const c of cs){
    const order=sorted(list,c.sort);
    if(potMode){for(const v of sides){tick();const r=packInto(order,avail(v),avail(v),c,s.allowRotation);if(r){consider(r,c);break;}}continue;}
    let lo=Math.max(page(minAw),page(minAh),Math.ceil(Math.sqrt(area))-2*b),hi=Math.min(maxW,maxH),hit=null;
    tick();const top=packInto(order,avail(hi),avail(hi),c,s.allowRotation);if(!top)continue;hit=top;
    while(lo<hi){const mid=(lo+hi)>>1;tick();const r=packInto(order,avail(mid),avail(mid),c,s.allowRotation);if(r){hit=r;hi=mid;}else lo=mid+1;}
    consider(hit,c);
   }
   return best;
  }
  // Strips: a bin as wide as a candidate width and as tall as the limit; the used height is the page.
  const widths=new Set(),aw=avail(maxW),ah=avail(maxH);
  if(potMode){for(let v=nextPow2(page(minAw));v<=maxW;v*=2)widths.add(avail(v));}
  else{
   const base=Math.sqrt(area),factors=s.effort==='fast'?[1,1.4]:list.length>300&&s.effort!=='best'?[.8,1,1.25,1.6,2.1]:[.6,.7,.8,.9,1,1.1,1.25,1.4,1.6,1.8,2.1,2.5,3.2];
   widths.add(minAw);widths.add(aw);
   for(const f of factors)widths.add(Math.round(base*f));
   // exact multiples of the most common footprint width make grids of equal cells tight
   const common=new Map();for(const r of list)common.set(r.fw,(common.get(r.fw)||0)+1);
   const [cw]=[...common].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
   for(const k of [Math.floor(base/cw),Math.ceil(base/cw),Math.ceil(base/cw)+1])if(k>0)widths.add(k*cw);
  }
  const ws=[...widths].filter(w=>w>=minAw&&w<=aw).sort((a,b)=>a-b);
  const shortlist=[];
  for(const c of cs){const order=sorted(list,c.sort);for(const w of ws){tick();const r=packInto(order,w,ah,c,s.allowRotation,false,true);
   if(r){const size=finish(r.usedW,r.usedH);if(size)shortlist.push({c,w:size.w,h:size.h,area:size.w*size.h});}consider(r,c);}}
  if(!best)return null;
  // Tighten: a strip only bounds the height. Bisect the height of the best few (combination,
  // width) pairs in a closed bin, where every rule behaves as designed.
  shortlist.sort((a,b)=>a.area-b.area||a.w-b.w);
  const seen=new Set(),top=[];
  for(const x of shortlist){const k=`${x.c.heuristic}/${x.c.sort}/${x.w}`;if(seen.has(k))continue;seen.add(k);top.push(x);if(top.length>=(s.effort==='fast'?1:s.effort==='best'?8:3))break;}
  for(const x of top){
   const order=sorted(list,x.c.sort),wUse=avail(x.w);
   let lo=Math.max(minAh,Math.ceil(area/Math.max(1,wUse))),hi=avail(x.h)-1;
   for(let steps=0;lo<=hi&&steps<14;steps++){
    const mid=(lo+hi)>>1;tick();const r=packInto(order,wUse,mid,x.c,s.allowRotation);
    if(r){consider(r,x.c);hi=mid-1;}else lo=mid+1;
   }
  }
  return best;
 }
 /** A full-size page holding as much area as possible (multipack). */
 function fullestPage(list){
  const cs=combos(s,list.length);let best=null;
  for(const c of cs){tick();const r=packInto(sorted(list,c.sort),avail(maxW),avail(maxH),c,s.allowRotation,true);
   if(r&&r.placed.length&&(!best||r.area>best.area||(r.area===best.area&&r.placed.length>best.placed.length)))best={...r,combo:c};}
  return best;
 }
 const pages=[];let remaining=foot;
 while(remaining.length){
  const one=bestPage(remaining);
  if(one){pages.push(one);break;}
  if(!s.multipack)throw Object.assign(Error(`These sprites do not fit one ${maxW}×${maxH} page. Turn on multipack or raise the size limit.`),{code:'no-fit'});
  if(pages.length+1>=s.maxPages)throw Object.assign(Error(`These sprites need more than ${s.maxPages} pages of ${maxW}×${maxH}.`),{code:'too-many-pages'});
  const full=fullestPage(remaining);
  if(!full)throw Object.assign(Error('A sprite could not be placed on an empty page.'),{code:'no-fit'});
  const ids=new Set(full.placed.map(q=>q.id)),subset=remaining.filter(r=>ids.has(r.id));
  pages.push(bestPage(subset)||{...finish(full.usedW,full.usedH),placed:full.placed,combo:full.combo});
  remaining=remaining.filter(r=>!ids.has(r.id));
 }
 const byId=new Map(foot.map(r=>[r.id,r]));
 return {settings:s,tried,
  pages:pages.map((pg,index)=>({index,width:pg.w,height:pg.h,combo:pg.combo,
   placements:pg.placed.map(q=>{const r=byId.get(q.id);return {id:q.id,x:b+q.fx+e,y:b+q.fy+e,w:r.w,h:r.h,rotated:!!q.rot};})}))};
}
/** Region a placement occupies on its page (rotated sprites are stored h×w). */
export const regionOf=pl=>({x:pl.x,y:pl.y,w:pl.rotated?pl.h:pl.w,h:pl.rotated?pl.w:pl.h});
