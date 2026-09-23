/** True SDF, pseudo-SDF, MSDF and MTSDF from pixel-space shapes (shape.js). Pure; no DOM.
 *
 * Algorithms: Viktor Chlumský, "Shape Decomposition for Multi-channel Distance Fields" (MSc
 * thesis, CTU Prague 2015) and his msdfgen library (MIT licence, github.com/Chlumsky/msdfgen,
 * v1.13 core/: edge-selectors, contour-combiners, edge-coloring, MSDFErrorCorrection,
 * rasterization, msdfgen.cpp). Re-implemented here operation for operation — float32 where
 * msdfgen stores float, same iteration order, same tie-breaks — so the output can be compared
 * with the msdfgen binary texel by texel (tests/studio-ui-msdf.test.mjs does).
 *
 * Distances are EXACT Euclidean distances to the curves (closest point by cubic solve on
 * quadratics, seeded Newton on cubics — msdf-geometry.js), not a distance transform of a raster.
 *  - SDF: true signed distance (TrueDistanceSelector).
 *  - PSDF: pseudo-distance: the nearest edge's distance, but beyond an edge end the distance to
 *    that edge's tangent line, plus corner-bisector domains (PerpendicularDistanceSelector).
 *  - MSDF: edges get 2 of 3 channels by edge colouring (corners change colour, so every sharp
 *    corner is where two channels' edges meet); each channel is the pseudo-distance to its own
 *    edges; median(r,g,b) reproduces sharp corners under bilinear filtering.
 *  - MTSDF: MSDF plus the true SDF in alpha.
 * Pipeline (msdfgen CLI with -nopreprocess, i.e. what this module reproduces by default):
 *  normalise shape → colour edges (edgeColoringSimple, seed 0, 3 rad) → per pixel: every
 *  contour's own selector, merged by the OverlappingContourCombiner (overlapSupport) which uses
 *  contour windings to pick the distance that is consistent with overlapping same-direction
 *  contours (variable fonts) → scanline sign fix (the sign of each texel is forced to agree
 *  with an exact nonzero scanline fill of the curves) → MSDF error correction.
 * Error correction is msdfgen's current MSDFErrorCorrection (not the legacy clash detector):
 *  mode 'edge-priority' (default: texels at corners and those whose extreme channels form a
 *  visible edge are protected), 'indiscriminate', 'edge-only' or 'disabled'; artefacts are found
 *  by predicting where bilinear interpolation between each texel and its 8 neighbours makes
 *  the median jump past its expected range (linear and bilinear/diagonal cases) and those
 *  texels are collapsed to their median. distanceCheck 'none' | 'at-edge' | 'always'
 *  additionally checks candidate texels against the exact shape distance. As in msdfgen,
 *  when the scanline sign fix is on, correction runs after it with distanceCheck 'none'
 *  (msdfgen "auto-fast"); without the sign fix the default is 'at-edge' ("auto-full").
 * Performance: msdfgen's per-edge distance cache — pixels are visited in serpentine order and
 *  an edge is re-evaluated only if it could beat the current best given how far the sample
 *  point moved (1.001 safety factor). Exact: skipped edges provably cannot win.
 *
 * Conventions: input shape in pixel space, y down (shape.js). Output fields are row-major,
 * top row first, in OUTPUT PIXELS, positive inside: Float32Array w·h·channels. `range` is the
 * total width of the distance ramp in pixels (msdfgen -pxrange / msdf-atlas-gen convention):
 * encoded byte = round((d/range + ½)·255). `transform` {scale, translate:[tx,ty]} maps shape
 * pixels to output pixels as out = (p + t)·scale. Internally the shape is mirrored into
 * msdfgen's y-up frame (Y = h − y) so that every sign and orientation test is msdfgen's own.
 * An empty shape yields −Infinity everywhere (no edge is at any finite distance). */
import {WHITE,RED,GREEN,BLUE,CYAN,MAGENTA,YELLOW,BLACK,SD,edgeSignedDistance,edgeDirection,edgePoint,normalize,splitInThirds,scanline,scanlineWinding,fillRule,median} from './msdf-geometry.js';
import {cloneShape,normalizeShape,orientContours} from './shape.js';
export {median};
const MAXD=Number.MAX_VALUE,DELTA_FACTOR=1.001,fr=Math.fround;
const nzs=n=>n>0?1:-1;
const less=(a,ad,b,bd)=>Math.abs(a)<Math.abs(b)||(Math.abs(a)===Math.abs(b)&&ad<bd);
const vlen=(x,y)=>Math.sqrt(x*x+y*y);

// ---------------------------------------------------------------- edge colouring
const symmetricalTrichotomy=(position,n)=>Math.trunc(3+2.875*position/(n-1)-1.4375+.5)-3;
function isCorner(a,b,crossThreshold){return a[0]*b[0]+a[1]*b[1]<=0||Math.abs(a[0]*b[1]-a[1]*b[0])>crossThreshold;}
class Seed{
 constructor(s){if(!Number.isSafeInteger(s)||s<0)throw Error('Colouring seed must be a non-negative safe integer');this.s=s;}
 x2(){const v=this.s%2;this.s=Math.floor(this.s/2);return v;}
 x3(){const v=this.s%3;this.s=Math.floor(this.s/3);return v;}
}
const initColor=seed=>[CYAN,MAGENTA,YELLOW][seed.x3()];
function switchColor(color,seed,banned=BLACK){
 const combined=color&banned;
 if(combined===RED||combined===GREEN||combined===BLUE)return combined^WHITE;
 const shifted=color<<(1+seed.x2());
 return (shifted|shifted>>3)&WHITE;
}
function findCorners(contour,crossThreshold,lengths){
 const corners=[],E=contour.edges;
 let prev=edgeDirection(E[E.length-1],1),spline=0;
 E.forEach((e,i)=>{
  if(isCorner(normalize([prev[0],prev[1]]),normalize(edgeDirection(e,0)),crossThreshold)){corners.push({index:i,prevLength:spline,minor:false,color:BLACK});spline=0;}
  if(lengths)spline+=estimateEdgeLength(e);
  prev=edgeDirection(e,1);
 });
 return {corners,spline};
}
function estimateEdgeLength(e){
 let l=0,a=edgePoint(e,0);
 for(let i=1;i<=4;i++){const b=edgePoint(e,i/4);l+=vlen(b[0]-a[0],b[1]-a[1]);a=b;}
 return l;
}
function colorTeardrop(contour,cornerIndex,colors){
 const E=contour.edges,m=E.length;
 if(m>=3){for(let i=0;i<m;i++)E[(cornerIndex+i)%m].color=colors[1+symmetricalTrichotomy(i,m)];return;}
 // fewer than three edges for three colours: split into thirds (msdfgen does the same)
 const parts=new Array(6).fill(null),c=cornerIndex;
 const s0=splitInThirds(E[0]);parts[0+3*c]=s0[0];parts[1+3*c]=s0[1];parts[2+3*c]=s0[2];
 if(m>=2){
  const s1=splitInThirds(E[1]);parts[3-3*c]=s1[0];parts[4-3*c]=s1[1];parts[5-3*c]=s1[2];
  parts[0].color=parts[1].color=colors[0];parts[2].color=parts[3].color=colors[1];parts[4].color=parts[5].color=colors[2];
 }else{parts[0].color=colors[0];parts[1].color=colors[1];parts[2].color=colors[2];}
 contour.edges=parts.filter(Boolean);
}
/** msdfgen edgeColoringSimple, in place: smooth contours get one colour; a contour with one
 * corner ("teardrop") is split into three colour zones (edges split into thirds if it has < 3);
 * otherwise the colour switches at every corner, never repeating the first colour at the end. */
export function edgeColoringSimple(shape,{angleThreshold=3,seed=0}={}){
 if(!(angleThreshold>0))throw Error('Angle threshold must be a positive angle in radians');
 const crossThreshold=Math.sin(angleThreshold),S=new Seed(seed);
 let color=initColor(S);
 for(const contour of shape.contours){
  if(!contour.edges.length)continue;
  const corners=findCorners(contour,crossThreshold,false).corners.map(c=>c.index);
  if(!corners.length){color=switchColor(color,S);for(const e of contour.edges)e.color=color;}
  else if(corners.length===1){
   const colors=[0,WHITE,0];color=switchColor(color,S);colors[0]=color;color=switchColor(color,S);colors[2]=color;
   colorTeardrop(contour,corners[0],colors);
  }else{
   const n=corners.length,m=contour.edges.length,start=corners[0];
   let spline=0;color=switchColor(color,S);const initial=color;
   for(let i=0;i<m;i++){
    const index=(start+i)%m;
    if(spline+1<n&&corners[spline+1]===index){spline++;color=switchColor(color,S,spline===n-1?initial:BLACK);}
    contour.edges[index].color=color;
   }
  }
 }
 return shape;
}
/** msdfgen edgeColoringInkTrap, in place: like simple, but a short edge between two long ones
 * (an ink trap) is a "minor" corner that takes the colour both neighbours lack. */
export function edgeColoringInkTrap(shape,{angleThreshold=3,seed=0}={}){
 if(!(angleThreshold>0))throw Error('Angle threshold must be a positive angle in radians');
 const crossThreshold=Math.sin(angleThreshold),S=new Seed(seed);
 let color=initColor(S);
 for(const contour of shape.contours){
  if(!contour.edges.length)continue;
  const {corners,spline:splineLength}=findCorners(contour,crossThreshold,true);
  if(!corners.length){color=switchColor(color,S);for(const e of contour.edges)e.color=color;}
  else if(corners.length===1){
   const colors=[0,WHITE,0];color=switchColor(color,S);colors[0]=color;color=switchColor(color,S);colors[2]=color;
   colorTeardrop(contour,corners[0].index,colors);
  }else{
   const n=corners.length;let major=n;
   if(n>3){
    corners[0].prevLength+=splineLength;
    for(let i=0;i<n;i++)if(corners[i].prevLength>corners[(i+1)%n].prevLength&&corners[(i+1)%n].prevLength<corners[(i+2)%n].prevLength){corners[i].minor=true;major--;}
   }
   let initial=BLACK;
   for(let i=0;i<n;i++)if(!corners[i].minor){
    major--;color=switchColor(color,S,major?BLACK:initial);corners[i].color=color;
    if(!initial)initial=color;
   }
   for(let i=0;i<n;i++){
    if(corners[i].minor)corners[i].color=(color&corners[(i+1)%n].color)^WHITE;
    else color=corners[i].color;
   }
   let spline=0;const m=contour.edges.length,start=corners[0].index;
   color=corners[0].color;
   for(let i=0;i<m;i++){
    const index=(start+i)%m;
    if(spline+1<n&&corners[spline+1].index===index)color=corners[++spline].color;
    contour.edges[index].color=color;
   }
  }
 }
 return shape;
}

// ---------------------------------------------------------------- preparation
function winding(E){// msdfgen Contour::winding on the y-up frame
 if(!E.length)return 0;
 const P=[];
 if(E.length===1)P.push(edgePoint(E[0],0),edgePoint(E[0],1/3),edgePoint(E[0],2/3));
 else if(E.length===2)P.push(edgePoint(E[0],0),edgePoint(E[0],.5),edgePoint(E[1],0),edgePoint(E[1],.5));
 else for(let i=0;i<E.length;i++)P.push([E[i].p[0],E[i].p[1]]);
 let total=0,prev=E.length>2?P[P.length-1]:null;
 if(prev)for(const cur of P){total+=(cur[0]-prev[0])*(prev[1]+cur[1]);prev=cur;}
 else for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];total+=(b[0]-a[0])*(a[1]+b[1]);}
 return (0<total)-(total<0);
}
function colorOption(shape,o){
 const c=o.coloring===undefined?'auto':o.coloring;
 const opts={angleThreshold:o.angleThreshold??3,seed:o.seed??0};
 if(c==='auto'){if(shape.contours.every(k=>k.edges.every(e=>e.color===WHITE)))edgeColoringSimple(shape,opts);}
 else if(c==='simple')edgeColoringSimple(shape,opts);
 else if(c==='inktrap')edgeColoringInkTrap(shape,opts);
 else if(c!==false&&c!=='none')throw Error('coloring must be auto, simple, inktrap or false');
}
/** The shape exactly as the MSDF generator sees it (normalised, oriented, coloured copy). */
export function prepareShape(shape,o={},multi=true){
 if(!shape||!Array.isArray(shape.contours))throw Error('Expected a shape from shapeFromCommands');
 const s=cloneShape(shape);
 s.contours=s.contours.filter(c=>c.edges.length);
 if(o.normalize!==false)normalizeShape(s);
 if(o.orient!==false)orientContours(s);
 if(multi)colorOption(s,o);
 return s;
}
function internal(shape,h,transform){
 const sc=transform?.scale??1,[tx,ty]=transform?.translate??[0,0];
 if(!(sc>0)||!Number.isFinite(tx)||!Number.isFinite(ty))throw Error('transform needs a positive scale and a finite translate');
 const contours=[];
 for(const c of shape.contours){
  const E=c.edges.map(e=>{
   const p=new Float64Array(e.p.length);
   for(let i=0;i<p.length;i+=2){p[i]=(e.p[i]+tx)*sc;p[i+1]=h-(e.p[i+1]+ty)*sc;}
   return {type:e.type,p,color:e.color};
  });
  const n=E.length;
  E.forEach((e,i)=>{
   const last=2*e.type,a=edgeDirection(e,0),b=edgeDirection(e,1);
   e.sx=e.p[0];e.sy=e.p[1];e.ex=e.p[last];e.ey=e.p[last+1];
   const aT=normalize([a[0],a[1]],true),bT=normalize([b[0],b[1]],true),aF=normalize([a[0],a[1]]),bF=normalize([b[0],b[1]]);
   e.aTx=aT[0];e.aTy=aT[1];e.bTx=bT[0];e.bTy=bT[1];e.aFx=aF[0];e.aFy=aF[1];e.bFx=bF[0];e.bFy=bF[1];
  });
  E.forEach((e,i)=>{
   const prev=E[(i+n-1)%n],next=E[(i+1)%n];
   const a=normalize([prev.bTx+e.aTx,prev.bTy+e.aTy],true),b=normalize([e.bTx+next.aTx,e.bTy+next.aTy],true);
   e.aBx=a[0];e.aBy=a[1];e.bBx=b[0];e.bBy=b[1];
  });
  // msdfgen ShapeDistanceFinder visits the last edge first, then 0 … n−2
  contours.push({edges:E,order:E.map((_,i)=>E[(i+n-1)%n]),winding:winding(E)});
 }
 return contours;
}

// ---------------------------------------------------------------- edge selectors
// Edge cache layout (per edge): 0 px, 1 py, 2 absDistance, 3 aDomain, 4 bDomain, 5 aPerp, 6 bPerp
class TrueSel{
 constructor(){this.fresh(0,0);}
 fresh(x,y){this.x=x;this.y=y;this.d=-MAXD;this.dot=0;}
 reset(x,y){const delta=DELTA_FACTOR*vlen(x-this.x,y-this.y);this.d+=nzs(this.d)*delta;this.x=x;this.y=y;}
 addEdge(c,o,e){
  const delta=DELTA_FACTOR*vlen(this.x-c[o],this.y-c[o+1]);
  if(c[o+2]-delta<=Math.abs(this.d)){
   edgeSignedDistance(e,this.x,this.y);
   if(less(SD[0],SD[1],this.d,this.dot)){this.d=SD[0];this.dot=SD[1];}
   c[o]=this.x;c[o+1]=this.y;c[o+2]=Math.abs(SD[0]);
  }
 }
 merge(s){if(less(s.d,s.dot,this.d,this.dot)){this.d=s.d;this.dot=s.dot;}}
 distance(out){out[0]=this.d;}
}
class PerpChannel{
 constructor(){this.init();}
 init(){this.td=-MAXD;this.tdot=0;this.neg=-MAXD;this.pos=MAXD;this.near=null;this.param=0;}
 reset(delta){this.td+=nzs(this.td)*delta;this.neg=-Math.abs(this.td);this.pos=Math.abs(this.td);this.near=null;this.param=0;}
 relevant(c,o,delta){
  const ad=c[o+3],bd=c[o+4],ap=c[o+5],bp=c[o+6];
  return c[o+2]-delta<=Math.abs(this.td)||Math.abs(ad)<delta||Math.abs(bd)<delta||
   (ad>0&&(ap<0?ap+delta>=this.neg:ap-delta<=this.pos))||
   (bd>0&&(bp<0?bp+delta>=this.neg:bp-delta<=this.pos));
 }
 addTrue(e,d,dot,param){if(less(d,dot,this.td,this.tdot)){this.td=d;this.tdot=dot;this.near=e;this.param=param;}}
 addPerp(d){if(d<=0&&d>this.neg)this.neg=d;if(d>=0&&d<this.pos)this.pos=d;}
 merge(s){
  if(less(s.td,s.tdot,this.td,this.tdot)){this.td=s.td;this.tdot=s.tdot;this.near=s.near;this.param=s.param;}
  if(s.neg>this.neg)this.neg=s.neg;
  if(s.pos<this.pos)this.pos=s.pos;
 }
 compute(x,y){
  let min=this.td<0?this.neg:this.pos;
  const e=this.near;
  if(e){
   let d=this.td;
   if(this.param<0){
    const ax=x-e.sx,ay=y-e.sy;
    if(ax*e.aFx+ay*e.aFy<0){const pd=ax*e.aFy-ay*e.aFx;if(Math.abs(pd)<=Math.abs(d))d=pd;}
   }else if(this.param>1){
    const bx=x-e.ex,by=y-e.ey;
    if(bx*e.bFx+by*e.bFy>0){const pd=bx*e.bFy-by*e.bFx;if(Math.abs(pd)<=Math.abs(d))d=pd;}
   }
   if(Math.abs(d)<Math.abs(min))min=d;
  }
  return min;
 }
}
// Shared body of PerpendicularDistanceSelector::addEdge / MultiDistanceSelector::addEdge.
function perpAdd(chs,mask,c,o,e,x,y){
 edgeSignedDistance(e,x,y);
 const d=SD[0],dot=SD[1],param=SD[2];
 for(let k=0;k<chs.length;k++)if(mask>>k&1)chs[k].addTrue(e,d,dot,param);
 c[o]=x;c[o+1]=y;c[o+2]=Math.abs(d);
 const apx=x-e.sx,apy=y-e.sy,bpx=x-e.ex,bpy=y-e.ey;
 const add=apx*e.aBx+apy*e.aBy,bdd=-(bpx*e.bBx+bpy*e.bBy);
 if(add>0){
  let pd=d;
  if(apx*-e.aTx+apy*-e.aTy>0){// getPerpendicularDistance(pd, ap, -aDir)
   const q=apx*-e.aTy-apy*-e.aTx;
   if(Math.abs(q)<Math.abs(pd)){pd=-q;for(let k=0;k<chs.length;k++)if(mask>>k&1)chs[k].addPerp(pd);}
  }
  c[o+5]=pd;
 }
 if(bdd>0){
  let pd=d;
  if(bpx*e.bTx+bpy*e.bTy>0){
   const q=bpx*e.bTy-bpy*e.bTx;
   if(Math.abs(q)<Math.abs(pd)){pd=q;for(let k=0;k<chs.length;k++)if(mask>>k&1)chs[k].addPerp(pd);}
  }
  c[o+6]=pd;
 }
 c[o+3]=add;c[o+4]=bdd;
}
class PerpSel{
 constructor(){this.ch=[new PerpChannel()];this.x=0;this.y=0;}
 fresh(x,y){this.ch[0].init();this.x=x;this.y=y;}
 reset(x,y){this.ch[0].reset(DELTA_FACTOR*vlen(x-this.x,y-this.y));this.x=x;this.y=y;}
 addEdge(c,o,e){if(this.ch[0].relevant(c,o,DELTA_FACTOR*vlen(this.x-c[o],this.y-c[o+1])))perpAdd(this.ch,1,c,o,e,this.x,this.y);}
 merge(s){this.ch[0].merge(s.ch[0]);}
 distance(out){out[0]=this.ch[0].compute(this.x,this.y);}
}
class MultiSel{
 constructor(withTrue){this.ch=[new PerpChannel(),new PerpChannel(),new PerpChannel()];this.t=withTrue;this.x=0;this.y=0;}
 fresh(x,y){for(const c of this.ch)c.init();this.x=x;this.y=y;}
 reset(x,y){const delta=DELTA_FACTOR*vlen(x-this.x,y-this.y);for(const c of this.ch)c.reset(delta);this.x=x;this.y=y;}
 addEdge(c,o,e){
  const delta=DELTA_FACTOR*vlen(this.x-c[o],this.y-c[o+1]),m=e.color,[r,g,b]=this.ch;
  if((m&1&&r.relevant(c,o,delta))||(m&2&&g.relevant(c,o,delta))||(m&4&&b.relevant(c,o,delta)))perpAdd(this.ch,m,c,o,e,this.x,this.y);
 }
 merge(s){for(let k=0;k<3;k++)this.ch[k].merge(s.ch[k]);}
 distance(out){
  for(let k=0;k<3;k++)out[k]=this.ch[k].compute(this.x,this.y);
  if(this.t){
   let d=this.ch[0].td,dot=this.ch[0].tdot;
   for(let k=1;k<3;k++)if(less(this.ch[k].td,this.ch[k].tdot,d,dot)){d=this.ch[k].td;dot=this.ch[k].tdot;}
   out[3]=d;
  }
 }
}
const makeSel={sdf:()=>new TrueSel(),psdf:()=>new PerpSel(),msdf:()=>new MultiSel(false),mtsdf:()=>new MultiSel(true)};
const CH={sdf:1,psdf:1,msdf:3,mtsdf:4};

// ---------------------------------------------------------------- distance finder + combiners
class DistanceFinder{
 constructor(contours,mode,overlap){
  this.contours=contours;this.mode=mode;this.overlap=overlap;this.n=CH[mode];
  const edges=contours.reduce((a,c)=>a+c.edges.length,0);
  this.cache=new Float64Array(7*edges);
  this.sels=overlap?contours.map(()=>makeSel[mode]()):[makeSel[mode]()];
  if(overlap){
   this.tmp=[makeSel[mode](),makeSel[mode](),makeSel[mode]()];
   this.cd=contours.map(()=>new Float64Array(this.n));
   this.buf=[0,1,2,3].map(()=>new Float64Array(this.n));
  }
 }
 res(v){return this.n>=3?median(v[0],v[1],v[2]):v[0];}
 /** Distance at (x,y) into out (length = channels), msdfgen ShapeDistanceFinder::distance. */
 distance(x,y,out){
  for(const s of this.sels)s.reset(x,y);
  let o=0;
  for(let i=0;i<this.contours.length;i++){
   const s=this.sels[this.overlap?i:0];
   for(const e of this.contours[i].order){s.addEdge(this.cache,o,e);o+=7;}
  }
  if(!this.overlap){this.sels[0].distance(out);return out;}
  return this.combine(x,y,out);
 }
 combine(x,y,out){// OverlappingContourCombiner::distance
  const n=this.contours.length,[shape,inner,outer]=this.tmp,cd=this.cd,W=this.contours.map(c=>c.winding);
  shape.fresh(x,y);inner.fresh(x,y);outer.fresh(x,y);
  for(let i=0;i<n;i++){
   const s=this.sels[i];s.distance(cd[i]);
   const r=this.res(cd[i]);
   shape.merge(s);
   if(W[i]>0&&r>=0)inner.merge(s);
   if(W[i]<0&&r<=0)outer.merge(s);
  }
  const [shapeD,innerD,outerD]=this.buf;
  shape.distance(shapeD);inner.distance(innerD);outer.distance(outerD);
  const iS=this.res(innerD),oS=this.res(outerD);
  let dist,wnd=0;
  if(iS>=0&&Math.abs(iS)<=Math.abs(oS)){
   dist=innerD;wnd=1;
   for(let i=0;i<n;i++)if(W[i]>0){const r=this.res(cd[i]);if(Math.abs(r)<Math.abs(oS)&&r>this.res(dist))dist=cd[i];}
  }else if(oS<=0&&Math.abs(oS)<Math.abs(iS)){
   dist=outerD;wnd=-1;
   for(let i=0;i<n;i++)if(W[i]<0){const r=this.res(cd[i]);if(Math.abs(r)<Math.abs(iS)&&r<this.res(dist))dist=cd[i];}
  }else{out.set(shapeD);return out;}
  for(let i=0;i<n;i++)if(W[i]!==wnd){
   const r=this.res(cd[i]),rd=this.res(dist);
   if(r*rd>=0&&Math.abs(r)<Math.abs(rd))dist=cd[i];
  }
  if(this.res(dist)===this.res(shapeD))dist=shapeD;
  out.set(dist);return out;
 }
}

// ---------------------------------------------------------------- generation (y-up bitmap, normalised float32 like msdfgen)
function generateBitmap(contours,w,h,mode,range,overlap){
 const N=CH[mode],bmp=new Float32Array(w*h*N),finder=new DistanceFinder(contours,mode,overlap),out=new Float64Array(N);
 const ms=1/range,mt=range/2;// DistanceMapping(Range(−range/2, range/2))
 let dir=1;
 for(let y=0;y<h;y++){
  let x=dir<0?w-1:0;
  for(let col=0;col<w;col++,x+=dir){
   finder.distance(x+.5,y+.5,out);
   const o=(y*w+x)*N;
   for(let k=0;k<N;k++)bmp[o+k]=ms*(out[k]+mt);
  }
  dir=-dir;
 }
 return bmp;
}
function signCorrection(bmp,contours,w,h,N,rule){// msdfgen distanceSignCorrection, zero value .5
 const match=new Int8Array(w*h);let ambiguous=false;
 for(let y=0;y<h;y++){
  const line=scanline(contours,y+.5);
  for(let x=0;x<w;x++){
   const fill=fillRule(scanlineWinding(line,x+.5),rule),o=(y*w+x)*N;
   if(N===1){if((bmp[o]>.5)!==fill)bmp[o]=fr(1-bmp[o]);continue;}
   const sd=median(bmp[o],bmp[o+1],bmp[o+2]);
   if(sd===.5)ambiguous=true;
   else if((sd>.5)!==fill){bmp[o]=fr(1-bmp[o]);bmp[o+1]=fr(1-bmp[o+1]);bmp[o+2]=fr(1-bmp[o+2]);match[y*w+x]=-1;}
   else match[y*w+x]=1;
   if(N>=4&&(bmp[o+3]>.5)!==fill)bmp[o+3]=fr(1-bmp[o+3]);
  }
 }
 if(ambiguous&&N>=3)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(match[i])continue;
  let nm=0;
  if(x>0)nm+=match[i-1];if(x<w-1)nm+=match[i+1];if(y>0)nm+=match[i-w];if(y<h-1)nm+=match[i+w];
  if(nm<0){const o=i*N;bmp[o]=fr(1-bmp[o]);bmp[o+1]=fr(1-bmp[o+1]);bmp[o+2]=fr(1-bmp[o+2]);}
 }
}

// ---------------------------------------------------------------- MSDF error correction (msdfgen MSDFErrorCorrection)
const PROTECTED=1,ERROR=2,ARTIFACT_T_EPSILON=.01,PROTECTION_RADIUS_TOLERANCE=1.001;
const F_CANDIDATE=1,F_ARTIFACT=2;
const fmedian=(a,b,c)=>median(a,b,c);// medians of float32 values are float32 values
const fmix=(a,b,t)=>fr((1-t)*a+t*b);
function rangeTest(span,prot,at,bt,xt,am,bm,xm){
 if((am>.5&&bm>.5&&xm<=.5)||(am<.5&&bm<.5&&xm>=.5)||(!prot&&fmedian(am,bm,xm)!==xm)){
  const ax=(xt-at)*span,bx=(bt-xt)*span;
  if(!(xm>=am-ax&&xm<=am+ax&&xm>=bm-bx&&xm<=bm+bx))return F_CANDIDATE|F_ARTIFACT;
  return F_CANDIDATE;
 }
 return 0;
}
function interpMedian2(A,a,B,b,t){return fmedian(fmix(A[a],B[b],t),fmix(A[a+1],B[b+1],t),fmix(A[a+2],B[b+2],t));}
function linearInner(cls,am,bm,A,a,B,b,dA,dB){
 const t=dA/fr(dA-dB);
 if(t>ARTIFACT_T_EPSILON&&t<1-ARTIFACT_T_EPSILON){
  const xm=interpMedian2(A,a,B,b,t);
  return cls.evaluate(t,xm,rangeTest(cls.span,cls.prot,0,1,t,am,bm,xm));
 }
 return false;
}
function hasLinearArtifact(cls,am,A,a,B,b){
 const bm=fmedian(B[b],B[b+1],B[b+2]);
 return Math.abs(fr(am-.5))>=Math.abs(fr(bm-.5))&&(
  linearInner(cls,am,bm,A,a,B,b,fr(A[a+1]-A[a]),fr(B[b+1]-B[b]))||
  linearInner(cls,am,bm,A,a,B,b,fr(A[a+2]-A[a+1]),fr(B[b+2]-B[b+1]))||
  linearInner(cls,am,bm,A,a,B,b,fr(A[a]-A[a+2]),fr(B[b]-B[b+2])));
}
const qroots=[0,0];
function diagInner(cls,am,dm,a,l,q,dA,dBC,dD,tEx0,tEx1){
 const n=solveQ(qroots,fr(fr(dD-dBC)+dA),fr(fr(dBC-dA)-dA),dA),T=[qroots[0],qroots[1]];
 const im=t=>fmedian(fr(t*(t*q[0]+l[0])+a[0]),fr(t*(t*q[1]+l[1])+a[1]),fr(t*(t*q[2]+l[2])+a[2]));
 for(let i=0;i<n;i++){
  const t=T[i];
  if(t>ARTIFACT_T_EPSILON&&t<1-ARTIFACT_T_EPSILON){
   const xm=im(t);
   let flags=rangeTest(cls.span,cls.prot,0,1,t,am,dm,xm);
   for(const tEx of [tEx0,tEx1])if(tEx>0&&tEx<1){
    const tEnd=[0,1],em=[am,dm],k=tEx>t?1:0;
    tEnd[k]=tEx;em[k]=im(tEx);
    flags|=rangeTest(cls.span,cls.prot,tEnd[0],tEnd[1],t,em[0],em[1],xm);
   }
   if(cls.evaluate(t,xm,flags))return true;
  }
 }
 return false;
}
function solveQ(out,a,b,c){// msdfgen solveQuadratic (kept local: returns the same values)
 if(a===0||Math.abs(b)>1e12*Math.abs(a)){if(b===0)return c===0?-1:0;out[0]=-c/b;return 1;}
 let d=b*b-4*a*c;
 if(d>0){d=Math.sqrt(d);out[0]=(-b+d)/(2*a);out[1]=(-b-d)/(2*a);return 2;}
 if(d===0){out[0]=-b/(2*a);return 1;}
 return 0;
}
function hasDiagonalArtifact(cls,am,S,a,b,c,d){
 const dm=fmedian(S[d],S[d+1],S[d+2]);
 if(Math.abs(fr(am-.5))>=Math.abs(fr(dm-.5))){
  const abc=[0,1,2].map(k=>fr(fr(S[a+k]-S[b+k])-S[c+k]));
  const l=[0,1,2].map(k=>fr(-S[a+k]-abc[k])),q=[0,1,2].map(k=>fr(S[d+k]+abc[k]));
  const tEx=[0,1,2].map(k=>-.5*l[k]/q[k]);
  const A=[S[a],S[a+1],S[a+2]];
  const dBC=(i,j)=>fr(fr(fr(S[b+i]-S[b+j])+S[c+i])-S[c+j]);
  return diagInner(cls,am,dm,A,l,q,fr(S[a+1]-S[a]),dBC(1,0),fr(S[d+1]-S[d]),tEx[0],tEx[1])||
   diagInner(cls,am,dm,A,l,q,fr(S[a+2]-S[a+1]),dBC(2,1),fr(S[d+2]-S[d+1]),tEx[1],tEx[2])||
   diagInner(cls,am,dm,A,l,q,fr(S[a]-S[a+2]),dBC(0,2),fr(S[d]-S[d+2]),tEx[2],tEx[0]);
 }
 return false;
}
function edgeBetweenChannel(S,a,b,ch){
 const t=(S[a+ch]-.5)/fr(S[a+ch]-S[b+ch]);
 if(t>0&&t<1){
  const c0=fmix(S[a],S[b],t),c1=fmix(S[a+1],S[b+1],t),c2=fmix(S[a+2],S[b+2],t),cc=[c0,c1,c2][ch];
  return fmedian(c0,c1,c2)===cc;
 }
 return false;
}
const edgeBetween=(S,a,b)=>RED*edgeBetweenChannel(S,a,b,0)+GREEN*edgeBetweenChannel(S,a,b,1)+BLUE*edgeBetweenChannel(S,a,b,2);
function protectExtreme(st,i,S,o,m,mask){
 if((mask&RED&&S[o]!==m)||(mask&GREEN&&S[o+1]!==m)||(mask&BLUE&&S[o+2]!==m))st[i]|=PROTECTED;
}
class ErrorCorrection{
 constructor(S,w,h,N,range,{minDeviationRatio=1.11111111111111111,minImproveRatio=1.11111111111111111}={}){
  Object.assign(this,{S,w,h,N,range,minDeviationRatio,minImproveRatio,st:new Uint8Array(w*h)});
 }
 unit(diag){const v=1/this.range;return diag?Math.sqrt(v*v+v*v):Math.sqrt(v*v);}// unprojectVector(distanceMapping(Delta(1)))
 protectCorners(contours){
  const {w,h,st}=this;
  for(const c of contours){
   let prev=c.edges[c.edges.length-1];
   for(const e of c.edges){
    const common=prev.color&e.color;
    if(!(common&(common-1))){
     const l=Math.floor(e.sx-.5),b=Math.floor(e.sy-.5),r=l+1,t=b+1;
     if(l<w&&b<h&&r>=0&&t>=0){
      if(l>=0&&b>=0)st[b*w+l]|=PROTECTED;
      if(r<w&&b>=0)st[b*w+r]|=PROTECTED;
      if(l>=0&&t<h)st[t*w+l]|=PROTECTED;
      if(r<w&&t<h)st[t*w+r]|=PROTECTED;
     }
    }
    prev=e;
   }
  }
 }
 protectEdges(){
  const {S,w,h,N,st}=this,M=i=>fmedian(S[i*N],S[i*N+1],S[i*N+2]);
  const pair=(i,j,radius)=>{
   const mi=M(i),mj=M(j);
   if(fr(Math.abs(fr(mi-.5))+Math.abs(fr(mj-.5)))<radius){
    const mask=edgeBetween(S,i*N,j*N);
    protectExtreme(st,i,S,i*N,mi,mask);protectExtreme(st,j,S,j*N,mj,mask);
   }
  };
  let radius=fr(PROTECTION_RADIUS_TOLERANCE*this.unit(false));
  for(let y=0;y<h;y++)for(let x=0;x<w-1;x++)pair(y*w+x,y*w+x+1,radius);
  for(let y=0;y<h-1;y++)for(let x=0;x<w;x++)pair(y*w+x,(y+1)*w+x,radius);
  radius=fr(PROTECTION_RADIUS_TOLERANCE*this.unit(true));
  for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
   pair(y*w+x,(y+1)*w+x+1,radius);
   pair(y*w+x+1,(y+1)*w+x,radius);
  }
 }
 protectAll(){this.st.fill(PROTECTED);}
 findErrors(checker){
  const {S,w,h,N,st}=this,md=this.minDeviationRatio;
  const hSpan=md*this.unit(false),vSpan=hSpan,dSpan=md*this.unit(true);
  const base=(span,prot)=>({span,prot,evaluate:(t,m,flags)=>(flags&F_ARTIFACT)!==0});
  let dir=1;
  for(let y=0;y<h;y++){
   let x=checker&&dir<0?w-1:0;
   for(let col=0;col<w;col++,x+=checker?dir:1){
    const i=y*w+x;
    if(checker&&st[i]&ERROR)continue;
    const c=i*N,cm=fmedian(S[c],S[c+1],S[c+2]),prot=(st[i]&PROTECTED)!==0;
    const cls=checker?(dx,dy,span)=>checker.classifier(x,y,c,prot,dx,dy,span):(dx,dy,span)=>base(span,prot);
    const L=c-N,R=c+N,B=c-w*N,T=c+w*N;
    const err=(x>0&&hasLinearArtifact(cls(-1,0,hSpan),cm,S,c,S,L))||
     (y>0&&hasLinearArtifact(cls(0,-1,vSpan),cm,S,c,S,B))||
     (x<w-1&&hasLinearArtifact(cls(1,0,hSpan),cm,S,c,S,R))||
     (y<h-1&&hasLinearArtifact(cls(0,1,vSpan),cm,S,c,S,T))||
     (x>0&&y>0&&hasDiagonalArtifact(cls(-1,-1,dSpan),cm,S,c,L,B,B-N))||
     (x<w-1&&y>0&&hasDiagonalArtifact(cls(1,-1,dSpan),cm,S,c,R,B,B+N))||
     (x>0&&y<h-1&&hasDiagonalArtifact(cls(-1,1,dSpan),cm,S,c,L,T,T-N))||
     (x<w-1&&y<h-1&&hasDiagonalArtifact(cls(1,1,dSpan),cm,S,c,R,T,T+N));
    if(err)st[i]|=ERROR;
   }
   dir=-dir;
  }
 }
 apply(){
  const {S,N,st}=this;
  for(let i=0;i<st.length;i++)if(st[i]&ERROR){const o=i*N,m=fmedian(S[o],S[o+1],S[o+2]);S[o]=S[o+1]=S[o+2]=m;}
 }
}
function interpolate(S,w,h,N,px,py,out){// msdfgen bitmap-interpolation.hpp
 px=px>=0&&px<=w?px:(px>0)*w;py=py>=0&&py<=h?py:(py>0)*h;
 px-=.5;py-=.5;
 let l=Math.floor(px),b=Math.floor(py),r=l+1,t=b+1;
 const lr=px-l,bt=py-b,cl=(v,m)=>v>=0&&v<=m?v:(v>0)*m;
 l=cl(l,w-1);r=cl(r,w-1);b=cl(b,h-1);t=cl(t,h-1);
 for(let i=0;i<N;i++)out[i]=fmix(fmix(S[(b*w+l)*N+i],S[(b*w+r)*N+i],lr),fmix(S[(t*w+l)*N+i],S[(t*w+r)*N+i],lr),bt);
 return out;
}
class ShapeDistanceChecker{
 constructor(ec,contours,overlap){
  this.ec=ec;this.finder=new DistanceFinder(contours,'psdf',overlap);this.d=new Float64Array(1);this.old=new Float64Array(ec.N);
 }
 classifier(x,y,c,prot,dx,dy,span){
  const ec=this.ec,self=this;
  return {span,prot,evaluate(t,m,flags){
   if(!(flags&F_CANDIDATE))return false;
   if(flags&F_ARTIFACT)return true;
   const tx=t*dx,ty=t*dy,S=ec.S,old=interpolate(S,ec.w,ec.h,ec.N,x+.5+tx,y+.5+ty,self.old);
   const aw=(1-Math.abs(tx))*(1-Math.abs(ty)),apsd=fmedian(S[c],S[c+1],S[c+2]);
   const n0=fr(old[0]+aw*fr(apsd-S[c])),n1=fr(old[1]+aw*fr(apsd-S[c+1])),n2=fr(old[2]+aw*fr(apsd-S[c+2]));
   const oldPSD=fmedian(old[0],old[1],old[2]),newPSD=fmedian(n0,n1,n2);
   self.finder.distance(x+.5+tx,y+.5+ty,self.d);
   const ref=fr(1/ec.range*(self.d[0]+ec.range/2));
   return ec.minImproveRatio*Math.abs(fr(newPSD-ref))<Math.abs(fr(oldPSD-ref));
  }};
 }
}
const EC_MODES=['disabled','indiscriminate','edge-priority','edge-only'],EC_CHECKS=['none','at-edge','always'];
function errorCorrect(S,contours,w,h,N,range,cfg,overlap){
 const {mode,distanceCheck}=cfg;
 if(mode==='disabled')return;
 const ec=new ErrorCorrection(S,w,h,N,range,cfg);
 if(mode==='edge-priority'){ec.protectCorners(contours);ec.protectEdges();}
 else if(mode==='edge-only')ec.protectAll();
 if(distanceCheck==='none'||(distanceCheck==='at-edge'&&mode!=='edge-only')){
  ec.findErrors(null);
  if(distanceCheck==='at-edge')ec.protectAll();
 }
 if(distanceCheck==='always'||distanceCheck==='at-edge')ec.findErrors(new ShapeDistanceChecker(ec,contours,overlap));
 ec.apply();
}
function ecConfig(v,scanlineFix){
 const o=v===false?{mode:'disabled'}:v===true||v===undefined?{}:v;
 if(typeof o!=='object')throw Error('errorCorrection must be true, false or an options object');
 const mode=o.mode??'edge-priority';
 if(!EC_MODES.includes(mode))throw Error(`errorCorrection.mode must be one of ${EC_MODES.join(', ')}`);
 // msdfgen: after a scanline sign fix the shape-distance check no longer matches the field
 const distanceCheck=scanlineFix?'none':o.distanceCheck??'at-edge';
 if(!EC_CHECKS.includes(distanceCheck))throw Error(`errorCorrection.distanceCheck must be one of ${EC_CHECKS.join(', ')}`);
 const r={mode,distanceCheck};
 if(o.minDeviationRatio!==undefined)r.minDeviationRatio=+o.minDeviationRatio;
 if(o.minImproveRatio!==undefined)r.minImproveRatio=+o.minImproveRatio;
 return r;
}

// ---------------------------------------------------------------- public generators
function run(mode,shape,w,h,opts={}){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Field size must be positive integers');
 const range=opts.range;
 if(!(typeof range==='number'&&range>0&&Number.isFinite(range)))throw Error('range (total ramp width in pixels) must be a positive number');
 const multi=mode==='msdf'||mode==='mtsdf',N=CH[mode];
 const prepared=prepareShape(shape,opts,multi);
 const contours=internal(prepared,h,opts.transform);
 const overlap=opts.overlapSupport!==false,scan=opts.scanlineSignFix!==false,rule=opts.fillRule??'nonzero';
 fillRule(0,rule);
 const S=generateBitmap(contours,w,h,mode,range,overlap);
 if(multi){
  const cfg=ecConfig(opts.errorCorrection,scan);
  if(!scan)errorCorrect(S,contours,w,h,N,range,cfg,overlap);
  else{signCorrection(S,contours,w,h,N,rule);errorCorrect(S,contours,w,h,N,range,cfg,overlap);}
 }else if(scan)signCorrection(S,contours,w,h,N,rule);
 const out=new Float32Array(w*h*N);
 for(let y=0;y<h;y++){
  const src=(h-1-y)*w*N,dst=y*w*N;
  for(let i=0;i<w*N;i++)out[dst+i]=(S[src+i]-.5)*range;
 }
 return out;
}
/** True signed distance field (px, positive inside), Float32Array w·h. */
export const generateSDF=(shape,w,h,opts)=>run('sdf',shape,w,h,opts);
/** Pseudo signed distance field (px), Float32Array w·h. */
export const generatePSDF=(shape,w,h,opts)=>run('psdf',shape,w,h,opts);
/** Multi-channel signed distance field (px per channel), Float32Array w·h·3. */
export const generateMSDF=(shape,w,h,opts)=>run('msdf',shape,w,h,opts);
/** MSDF + true SDF in the 4th channel, Float32Array w·h·4. */
export const generateMTSDF=(shape,w,h,opts)=>run('mtsdf',shape,w,h,opts);

// ---------------------------------------------------------------- encoding, sampling, reconstruction
const toByte=v=>{// msdfgen pixelFloatToByte: ~int(255.5f − 255.f·clamp(v))
 const c=v>=0&&v<=1?v:v>0?1:0;
 return 255-Math.trunc(fr(255.5-fr(255*c)));
};
/** RGBA bytes: value = clamp(d/range + ½)·255 (msdfgen rounding). channels 1 → R=G=B=v, A=255, or
 * with alphaOnly (TextMeshPro-style SDF) RGB=255, A=v; 3 → RGB, A=255; 4 → RGBA. */
export function encodeField(field,w,h,channels,{range,alphaOnly=false}={}){
 if(![1,3,4].includes(channels))throw Error('channels must be 1, 3 or 4');
 if(field.length!==w*h*channels)throw Error('Field size does not match w·h·channels');
 if(!(range>0))throw Error('range must be positive');
 const out=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){
  const o=i*4,f=i*channels,b=k=>toByte(field[f+k]/range+.5);
  if(channels===1){const v=b(0);if(alphaOnly){out[o]=out[o+1]=out[o+2]=255;out[o+3]=v;}else{out[o]=out[o+1]=out[o+2]=v;out[o+3]=255;}}
  else{out[o]=b(0);out[o+1]=b(1);out[o+2]=b(2);out[o+3]=channels===4?b(3):255;}
 }
 return out;
}
/** Bilinear sample at field-pixel coordinates (x,y) (texel centres at i+.5, edges clamped, msdfgen
 * interpolate()); returns out, an array of `channels` values. */
export function sampleField(field,w,h,channels,x,y,out=new Float64Array(channels)){
 x=x>=0&&x<=w?x:(x>0)*w;y=y>=0&&y<=h?y:(y>0)*h;
 x-=.5;y-=.5;
 let l=Math.floor(x),t=Math.floor(y),r=l+1,b=t+1;
 const fx=x-l,fy=y-t,cl=(v,m)=>v<0?0:v>m?m:v;
 l=cl(l,w-1);r=cl(r,w-1);t=cl(t,h-1);b=cl(b,h-1);
 for(let k=0;k<channels;k++){
  const a=field[(t*w+l)*channels+k],c=field[(t*w+r)*channels+k],d=field[(b*w+l)*channels+k],e=field[(b*w+r)*channels+k];
  out[k]=(1-fy)*((1-fx)*a+fx*c)+fy*((1-fx)*d+fx*e);
 }
 return out;
}
/** What a shader does with an encoded texture, at `scale`× the texture size: bilinear per
 * channel, median (MSDF), distance in output pixels = (m − ½)·range·scale, then coverage =
 * smoothstep over a one-pixel ramp (ramp:'smoothstep', default) or clamp(d + ½) (ramp:'linear',
 * msdfgen -testrender). Returns Float32Array (w·scale)·(h·scale). */
export function reconstructCoverage(encoded,w,h,channels,{scale=1,range,ramp='smoothstep',alphaOnly=false}={}){
 if(![1,3,4].includes(channels))throw Error('channels must be 1, 3 or 4');
 if(encoded.length!==w*h*4)throw Error('Encoded texture must be RGBA w·h·4');
 if(!(range>0)||!(scale>0))throw Error('range and scale must be positive');
 if(ramp!=='smoothstep'&&ramp!=='linear')throw Error('ramp must be smoothstep or linear');
 const W=Math.round(w*scale),H=Math.round(h*scale),N=channels===1?1:3,f=new Float32Array(w*h*N);
 for(let i=0;i<w*h;i++){
  if(N===1)f[i]=encoded[i*4+(alphaOnly?3:0)]/255;
  else for(let k=0;k<3;k++)f[i*3+k]=encoded[i*4+k]/255;
 }
 const out=new Float32Array(W*H),s=new Float64Array(N),sx=w/W,sy=h/H,pxr=range*(W+H)/(w+h);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  sampleField(f,w,h,N,sx*(x+.5),sy*(y+.5),s);
  const m=N===1?s[0]:median(s[0],s[1],s[2]);
  let c=(m-.5)*pxr+.5;c=c<0?0:c>1?1:c;
  out[y*W+x]=ramp==='linear'?c:c*c*(3-2*c);
 }
 return out;
}
