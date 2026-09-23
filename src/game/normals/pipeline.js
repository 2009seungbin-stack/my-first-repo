/** From a picture and a parameter set to height, normal and occlusion maps — the one function the
 * Studio worker, the brush path and the tests all call, so the preview, the export and the
 * measurements can never disagree. Pure (no DOM).
 *
 * A picture may hold several frames (a sprite sheet). Each frame REGION is processed on its own:
 * a bevel stops at the frame's border, a blur never mixes two frames, and the kernels sample the
 * frame's own edge. Every frame gets the same parameters and the same absolute units (px), so an
 * animation keeps one consistent relief from frame to frame — nothing is normalised per frame. */
import {alphaMask,bevelHeight,lumaHeight,heightFromPlane,applyStroke,addLayers,hasSilhouette} from './height.js';
import {normalsFromHeight,quantizeNormals,encodeNormals,bleedNormals} from './normal.js';
import {ambientOcclusion} from './maps.js';
export const DEFAULT_PARAMS=Object.freeze({
 kind:'sprite',                // 'sprite' (silhouette, bevel) | 'texture' (tileable surface)
 alphaThreshold:127,
 bevel:{on:true,width:4,depth:4,shape:'round',metric:'euclidean'},
 luma:{on:true,depth:1.5,detail:8,smooth:0,invert:false},
 heightMap:{assetId:null,depth:8,invert:false},
 normal:{strength:1,kernel:'sobel3',edge:'clamp',convention:'opengl'},
 pixel:{on:false,directions:8,tiers:2},
 ao:{radius:8,power:1}
});
const clone=o=>JSON.parse(JSON.stringify(o));
/** Parameters merged over the defaults, with every field range-checked (a document may be old or hand-edited). */
export function normalizeParams(p={}){
 const d=clone(DEFAULT_PARAMS),o=p||{},num=(v,lo,hi,def)=>Number.isFinite(+v)?Math.max(lo,Math.min(hi,+v)):def,pick=(v,list,def)=>list.includes(v)?v:def;
 d.kind=pick(o.kind,['sprite','texture'],d.kind);
 d.alphaThreshold=num(o.alphaThreshold,0,254,d.alphaThreshold);
 const b=o.bevel||{};d.bevel={on:b.on??(d.kind==='sprite'),width:num(b.width,.5,128,4),depth:num(b.depth,0,256,4),shape:pick(b.shape,['linear','round','smooth','concave','step'],'round'),metric:pick(b.metric,['euclidean','chebyshev','manhattan'],'euclidean')};
 const l=o.luma||{};d.luma={on:l.on??true,depth:num(l.depth,0,64,1.5),detail:num(l.detail,0,256,8),smooth:num(l.smooth,0,16,0),invert:!!l.invert};
 const hm=o.heightMap||{};d.heightMap={assetId:hm.assetId?String(hm.assetId):null,depth:num(hm.depth,0,256,8),invert:!!hm.invert};
 const n=o.normal||{};d.normal={strength:num(n.strength,0,16,1),kernel:pick(n.kernel,['central','sobel3','scharr','sobel5'],'sobel3'),edge:pick(n.edge,['clamp','tile','mirror'],d.kind==='texture'?'tile':'clamp'),convention:pick(n.convention,['opengl','directx'],'opengl')};
 const px=o.pixel||{};d.pixel={on:!!px.on,directions:[4,8,16,32].includes(+px.directions)?+px.directions:8,tiers:Math.round(num(px.tiers,1,4,2))};
 const a=o.ao||{};d.ao={radius:num(a.radius,1,64,8),power:num(a.power,.25,4,1)};
 return d;
}
/** Suggested starting parameters for a picture: a silhouette → sprite (bevel on, clamp); an opaque
 * picture → texture (no bevel, wrap). A suggestion only — the UI shows it and it can be changed. */
export function suggestParams(rgba,w,h,{pixelArt=false}={}){
 const sprite=hasSilhouette(rgba,w,h);
 const p=normalizeParams({kind:sprite?'sprite':'texture'});
 if(!sprite){p.bevel.on=false;p.luma.depth=3;p.luma.detail=24;p.normal.edge='tile';}
 if(pixelArt){p.bevel.width=1.5;p.bevel.depth=2;p.normal.kernel='central';p.luma.detail=4;p.bevel.metric='euclidean';}
 return p;
}
const cropPlane=(src,W,r,ch=1)=>{const out=new src.constructor(r.w*r.h*ch);for(let y=0;y<r.h;y++)out.set(src.subarray(((r.y+y)*W+r.x)*ch,((r.y+y)*W+r.x+r.w)*ch),y*r.w*ch);return out;};
const pastePlane=(dst,W,r,src,ch=1)=>{for(let y=0;y<r.h;y++)dst.set(src.subarray(y*r.w*ch,(y+1)*r.w*ch),((r.y+y)*W+r.x)*ch);};
export {cropPlane,pastePlane};
/** Regions to process: the frames' rects, clipped to the picture, or the whole picture. */
export function regionsOf(w,h,frames){
 const out=[];for(const f of frames||[]){const x=Math.max(0,Math.floor(f.x)),y=Math.max(0,Math.floor(f.y)),x1=Math.min(w,Math.ceil(f.x+f.w)),y1=Math.min(h,Math.ceil(f.y+f.h));if(x1>x&&y1>y)out.push({x,y,w:x1-x,h:y1-y});}
 return out.length?out:[{x:0,y:0,w,h}];
}
/** Generated height of the whole picture (px), region by region, before brush strokes. */
export function baseHeight(rgba,w,h,params,{regions=null,heightPlane=null}={}){
 const P=normalizeParams(params),out=new Float32Array(w*h),mask=P.kind==='sprite'?alphaMask(rgba,w,h,P.alphaThreshold):null;
 const edge=P.normal.edge,border=P.kind==='sprite'?'outside':edge==='tile'?'tile':'inside';
 for(const r of regionsOf(w,h,regions)){
  const px=cropPlane(rgba,w,r,4),m=mask?cropPlane(mask,w,r):null,hr=new Float32Array(r.w*r.h);
  if(P.bevel.on&&m)hr.set(bevelHeight(m,r.w,r.h,{width:P.bevel.width,depth:P.bevel.depth,shape:P.bevel.shape,border,metric:P.bevel.metric}));
  if(P.luma.on&&P.luma.depth>0){const L=lumaHeight(px,r.w,r.h,{depth:P.luma.depth,detail:P.luma.detail,smooth:P.luma.smooth,invert:P.luma.invert,mask:m,mode:edge});for(let i=0;i<hr.length;i++)hr[i]+=L[i];}
  if(heightPlane&&heightPlane.samples.length===w*h){const hp=heightFromPlane(cropPlane(heightPlane.samples,w,r),r.w,r.h,{depth:P.heightMap.depth,invert:P.heightMap.invert,max:heightPlane.max});for(let i=0;i<hr.length;i++)hr[i]+=m&&!m[i]?0:hp[i];}
  pastePlane(out,w,r,hr);
 }
 return {height:out,mask,params:P};
}
/** The region a pixel belongs to (brush strokes are clipped to it). */
export const regionAt=(regions,x,y)=>regions.find(r=>x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h)||null;
/** Applies brush strokes (each carries its own clip rect) onto a paint layer. */
export function paintStrokes(base,w,h,strokes){
 const paint=new Float32Array(w*h);
 for(const s of strokes||[])applyStroke(paint,base,w,h,s,{clip:s.clip||null});
 return paint;
}
/** Normal map (RGBA bytes) for a final height, region by region. `rect` limits the work to the
 * regions that intersect it (the brush path recomputes only what a stroke touched) and writes
 * into `into`. */
export function normalMap(height,w,h,params,{regions=null,mask=null,rect=null,into=null,bleed=2}={}){
 const P=normalizeParams(params),out=into||new Uint8Array(w*h*4);
 for(const r of regionsOf(w,h,regions)){
  if(rect&&(rect.x>=r.x+r.w||rect.y>=r.y+r.h||rect.x+rect.w<=r.x||rect.y+rect.h<=r.y))continue;
  const hr=cropPlane(height,w,r),m=mask?cropPlane(mask,w,r):null;
  let n=normalsFromHeight(hr,r.w,r.h,{strength:P.normal.strength,kernel:P.normal.kernel,edge:P.normal.edge,convention:P.normal.convention});
  if(P.pixel.on)n=quantizeNormals(n,r.w*r.h,{directions:P.pixel.directions,tiers:P.pixel.tiers});
  let bytes=encodeNormals(n,r.w,r.h,{mask:m});
  if(m&&bleed)bytes=bleedNormals(bytes,m,r.w,r.h,bleed);
  pastePlane(out,w,r,bytes,4);
 }
 return out;
}
/** Occlusion (bytes), region by region, with the same edge mode as the normals. */
export function occlusionMap(height,w,h,params,{regions=null,mask=null}={}){
 const P=normalizeParams(params),out=new Uint8Array(w*h);
 for(const r of regionsOf(w,h,regions)){
  const hr=cropPlane(height,w,r),m=mask?cropPlane(mask,w,r):null;
  pastePlane(out,w,r,ambientOcclusion(hr,r.w,r.h,{radius:Math.min(P.ao.radius,Math.max(1,Math.min(r.w,r.h))),edge:P.normal.edge,power:P.ao.power,mask:m}));
 }
 return out;
}
/** Everything at once: {height (final, px), base, paint, mask, normal (RGBA), params}. */
export function generate(rgba,w,h,params,{regions=null,strokes=[],heightPlane=null}={}){
 const reg=regionsOf(w,h,regions),b=baseHeight(rgba,w,h,params,{regions:reg,heightPlane});
 const paint=paintStrokes(b.height,w,h,strokes),height=addLayers(b.height,paint);
 const normal=normalMap(height,w,h,b.params,{regions:reg,mask:b.mask});
 return {height,base:b.height,paint,mask:b.mask,normal,params:b.params,regions:reg};
}
