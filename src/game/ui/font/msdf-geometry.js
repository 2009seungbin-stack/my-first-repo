/** Edge-segment geometry shared by shape.js, raster.js and msdf.js. Pure; no DOM.
 *
 * An edge is {type, p, color}: type 1 = line (p0 p1), 2 = quadratic Bézier (p0 p1 p2),
 * 3 = cubic Bézier (p0 p1 p2 p3); p is a Float64Array of interleaved x,y control points;
 * color is an msdfgen EdgeColor bit mask (RED 1 | GREEN 2 | BLUE 4, WHITE = 7).
 *
 * The maths follows Viktor Chlumský's msdfgen (MIT licence, github.com/Chlumsky/msdfgen,
 * core/edge-segments.cpp, core/equation-solver.cpp, core/convergent-curve-ordering.cpp,
 * v1.13), re-implemented here operation for operation so that results are bit-comparable
 * with the reference binary. That is why lengths are Math.sqrt(x*x+y*y) and not Math.hypot
 * (different rounding), why zero vectors normalise to (0,1) like Vector2::normalize, and why
 * the closest-point searches are exactly msdfgen's:
 *  - line: projection parameter, perpendicular distance inside (0,1), else endpoint distance;
 *  - quadratic: the derivative of |B(t)-P|² is a cubic in t, solved in closed form
 *    (trigonometric / Cardano, solveCubic), candidates in (0,1) compared with both endpoints;
 *  - cubic: 5 uniformly spaced seeds (t = 0, 1/4 … 1), each refined by up to 4 Newton steps on
 *    d/dt |B(t)-P|² while it stays inside (0,1), compared with both endpoints.
 * The sign of a distance is the sign of cross(direction, P→curve), i.e. positive on the right
 * of the direction of travel in a y-up frame (msdfgen's convention). "dot" is the tie-breaker
 * msdfgen stores in SignedDistance: 0 when the closest point is interior, otherwise
 * |cos| of the angle between the end tangent and the direction to the point.
 *
 * Coordinates are whatever frame the caller uses; the generators in msdf.js feed a y-up copy
 * so that every sign here means what it means in msdfgen. */
export const BLACK=0,RED=1,GREEN=2,YELLOW=3,BLUE=4,MAGENTA=5,CYAN=6,WHITE=7;
export const CUBIC_SEARCH_STARTS=4,CUBIC_SEARCH_STEPS=4;
const TAU=2*Math.PI;
export const nonZeroSign=n=>n>0?1:-1;
export const sign=n=>(0<n)-(n<0);
export const median=(a,b,c)=>Math.max(Math.min(a,b),Math.min(Math.max(a,b),c));
const len=(x,y)=>Math.sqrt(x*x+y*y);
export function makeEdge(type,points,color=WHITE){
 if(type!==1&&type!==2&&type!==3)throw Error('Edge type must be 1 (line), 2 (quadratic) or 3 (cubic)');
 if(points.length!==2*(type+1))throw Error(`A type-${type} edge needs ${type+1} points`);
 return {type,p:Float64Array.from(points),color};
}
export const cloneEdge=e=>({type:e.type,p:Float64Array.from(e.p),color:e.color});
export const startX=e=>e.p[0],startY=e=>e.p[1];
export const endX=e=>e.p[2*e.type],endY=e=>e.p[2*e.type+1];

/** Real roots of a x² + b x + c = 0 into out; returns count, -1 for 0 = 0 (msdfgen solveQuadratic). */
export function solveQuadratic(out,a,b,c){
 if(a===0||Math.abs(b)>1e12*Math.abs(a)){
  if(b===0)return c===0?-1:0;
  out[0]=-c/b;return 1;
 }
 let d=b*b-4*a*c;
 if(d>0){d=Math.sqrt(d);out[0]=(-b+d)/(2*a);out[1]=(-b-d)/(2*a);return 2;}
 if(d===0){out[0]=-b/(2*a);return 1;}
 return 0;
}
function solveCubicNormed(out,a,b,c){
 const a2=a*a;let q=1/9*(a2-3*b);const r=1/54*(a*(2*a2-9*b)+27*c),r2=r*r,q3=q*q*q;
 a*=1/3;
 if(r2<q3){
  let t=r/Math.sqrt(q3);if(t<-1)t=-1;if(t>1)t=1;t=Math.acos(t);q=-2*Math.sqrt(q);
  out[0]=q*Math.cos(1/3*t)-a;out[1]=q*Math.cos(1/3*(t+TAU))-a;out[2]=q*Math.cos(1/3*(t-TAU))-a;
  return 3;
 }
 const u=(r<0?1:-1)*Math.pow(Math.abs(r)+Math.sqrt(r2-q3),1/3),v=u===0?0:q/u;
 out[0]=u+v-a;
 if(u===v||Math.abs(u-v)<1e-12*Math.abs(u+v)){out[1]=-.5*(u+v)-a;return 2;}
 return 1;
}
/** Real roots of a x³ + b x² + c x + d = 0 (msdfgen solveCubic, falls back to quadratic when a is negligible). */
export function solveCubic(out,a,b,c,d){
 if(a!==0){const bn=b/a;if(Math.abs(bn)<1e6)return solveCubicNormed(out,bn,c/a,d/a);}
 return solveQuadratic(out,b,c,d);
}

/** Point at parameter t, written into out[0..1]. */
export function edgePoint(e,t,out=[0,0]){
 const p=e.p,s=1-t;
 if(e.type===1){out[0]=s*p[0]+t*p[2];out[1]=s*p[1]+t*p[3];return out;}
 if(e.type===2){
  const ax=s*p[0]+t*p[2],ay=s*p[1]+t*p[3],bx=s*p[2]+t*p[4],by=s*p[3]+t*p[5];
  out[0]=s*ax+t*bx;out[1]=s*ay+t*by;return out;
 }
 const p12x=s*p[2]+t*p[4],p12y=s*p[3]+t*p[5];
 const ax=s*(s*p[0]+t*p[2])+t*p12x,ay=s*(s*p[1]+t*p[3])+t*p12y;
 const bx=s*p12x+t*(s*p[4]+t*p[6]),by=s*p12y+t*(s*p[5]+t*p[7]);
 out[0]=s*ax+t*bx;out[1]=s*ay+t*by;return out;
}
/** Tangent (unnormalised) at t, with msdfgen's fallbacks for vanishing tangents. */
export function edgeDirection(e,t,out=[0,0]){
 const p=e.p,s=1-t;
 if(e.type===1){out[0]=p[2]-p[0];out[1]=p[3]-p[1];return out;}
 if(e.type===2){
  const x=s*(p[2]-p[0])+t*(p[4]-p[2]),y=s*(p[3]-p[1])+t*(p[5]-p[3]);
  if(x===0&&y===0){out[0]=p[4]-p[0];out[1]=p[5]-p[1];}else{out[0]=x;out[1]=y;}
  return out;
 }
 const d0x=p[2]-p[0],d0y=p[3]-p[1],d1x=p[4]-p[2],d1y=p[5]-p[3],d2x=p[6]-p[4],d2y=p[7]-p[5];
 const x=s*(s*d0x+t*d1x)+t*(s*d1x+t*d2x),y=s*(s*d0y+t*d1y)+t*(s*d1y+t*d2y);
 if(x===0&&y===0){
  if(t===0){out[0]=p[4]-p[0];out[1]=p[5]-p[1];return out;}
  if(t===1){out[0]=p[6]-p[2];out[1]=p[7]-p[3];return out;}
 }
 out[0]=x;out[1]=y;return out;
}
/** Vector2::normalize: unit vector, or (0, allowZero?0:1) for the zero vector. */
export function normalize(v,allowZero=false){
 const l=len(v[0],v[1]);
 if(l){v[0]/=l;v[1]/=l;}else{v[0]=0;v[1]=allowZero?0:1;}
 return v;
}
function pointBounds(x,y,b){if(x<b[0])b[0]=x;if(y<b[1])b[1]=y;if(x>b[2])b[2]=x;if(y>b[3])b[3]=y;}
/** Grows b = [xMin, yMin, xMax, yMax] to include the edge (curve extrema included). */
export function edgeBound(e,b){
 const p=e.p;
 pointBounds(p[0],p[1],b);pointBounds(endX(e),endY(e),b);
 if(e.type===2){
  const botx=(p[2]-p[0])-(p[4]-p[2]),boty=(p[3]-p[1])-(p[5]-p[3]),q=[0,0];
  if(botx){const t=(p[2]-p[0])/botx;if(t>0&&t<1){edgePoint(e,t,q);pointBounds(q[0],q[1],b);}}
  if(boty){const t=(p[3]-p[1])/boty;if(t>0&&t<1){edgePoint(e,t,q);pointBounds(q[0],q[1],b);}}
 }else if(e.type===3){
  const r=[0,0],q=[0,0];
  for(const k of [0,1]){
   const a0=p[2+k]-p[k],a1=2*(p[4+k]-p[2+k]-a0),a2=p[6+k]-3*p[4+k]+3*p[2+k]-p[k];
   const n=solveQuadratic(r,a2,a1,a0);
   for(let i=0;i<n;i++)if(r[i]>0&&r[i]<1){edgePoint(e,r[i],q);pointBounds(q[0],q[1],b);}
  }
 }
 return b;
}
export function reverseEdge(e){
 const p=e.p,n=e.type+1;
 for(let i=0,j=n-1;i<j;i++,j--){let t=p[2*i];p[2*i]=p[2*j];p[2*j]=t;t=p[2*i+1];p[2*i+1]=p[2*j+1];p[2*j+1]=t;}
 return e;
}
const mixv=(ax,ay,bx,by,t)=>[(1-t)*ax+t*bx,(1-t)*ay+t*by];
/** EdgeSegment::splitInThirds (exact control points, so a split curve is the same curve). */
export function splitInThirds(e){
 const p=e.p,c=e.color,P=t=>edgePoint(e,t,[0,0]);
 const p13=P(1/3),p23=P(2/3);
 if(e.type===1)return [makeEdge(1,[p[0],p[1],...p13],c),makeEdge(1,[...p13,...p23],c),makeEdge(1,[...p23,p[2],p[3]],c)];
 if(e.type===2){
  const m1=mixv(...mixv(p[0],p[1],p[2],p[3],5/9),...mixv(p[2],p[3],p[4],p[5],4/9),.5);
  return [makeEdge(2,[p[0],p[1],...mixv(p[0],p[1],p[2],p[3],1/3),...p13],c),
   makeEdge(2,[...p13,...m1,...p23],c),
   makeEdge(2,[...p23,...mixv(p[2],p[3],p[4],p[5],2/3),p[4],p[5]],c)];
 }
 const eq=(i,j)=>p[2*i]===p[2*j]&&p[2*i+1]===p[2*j+1];
 const m=(i,j,t)=>mixv(p[2*i],p[2*i+1],p[2*j],p[2*j+1],t);
 const mm=(a,b,t)=>mixv(a[0],a[1],b[0],b[1],t);
 const a1=eq(0,1)?[p[0],p[1]]:m(0,1,1/3);
 const a2=mm(m(0,1,1/3),m(1,2,1/3),1/3);
 const b1=mm(mm(m(0,1,1/3),m(1,2,1/3),1/3),mm(m(1,2,1/3),m(2,3,1/3),1/3),2/3);
 const b2=mm(mm(m(0,1,2/3),m(1,2,2/3),2/3),mm(m(1,2,2/3),m(2,3,2/3),2/3),1/3);
 const c1=mm(m(1,2,2/3),m(2,3,2/3),2/3);
 const c2=eq(2,3)?[p[6],p[7]]:m(2,3,2/3);
 return [makeEdge(3,[p[0],p[1],...a1,...a2,...p13],c),makeEdge(3,[...p13,...b1,...b2,...p23],c),makeEdge(3,[...p23,...c1,...c2,p[6],p[7]],c)];
}
/** QuadraticSegment::convertToCubic (exact degree elevation). */
export function quadToCubic(e){
 const p=e.p;
 return makeEdge(3,[p[0],p[1],...mixv(p[0],p[1],p[2],p[3],2/3),...mixv(p[2],p[3],p[4],p[5],1/3),p[4],p[5]],e.color);
}

// ---- Signed distance (msdfgen EdgeSegment::signedDistance). Results land in SD:
// SD[0] = signed distance, SD[1] = dot (tie-breaker), SD[2] = curve parameter of the closest point.
export const SD=new Float64Array(3);
const roots=new Float64Array(3);
/** Caches the end tangents the distance functions need on the edge (raw d0/d1, and normalised
 * aF/bF exactly as Vector2::normalize makes them). Must be redone if the points change;
 * edgeSignedDistance does it lazily for edges that never had it. Returns e. */
export function prepareEdge(e){
 const a=edgeDirection(e,0,[0,0]),b=edgeDirection(e,1,[0,0]);
 e.d0x=a[0];e.d0y=a[1];e.d1x=b[0];e.d1y=b[1];
 normalize(a);normalize(b);
 e.aFx=a[0];e.aFy=a[1];e.bFx=b[0];e.bFy=b[1];
 return e;
}
function lineDistance(e,qx,qy){
 const p=e.p,aqx=qx-p[0],aqy=qy-p[1],abx=p[2]-p[0],aby=p[3]-p[1];
 const param=(aqx*abx+aqy*aby)/(abx*abx+aby*aby);
 const ex=(param>.5?p[2]:p[0])-qx,ey=(param>.5?p[3]:p[1])-qy,endpointDistance=len(ex,ey);
 SD[2]=param;
 if(param>0&&param<1){
  // getOrthonormal(false) = (y/l, −x/l) = (aF.y, −aF.x); a line is never zero-length here
  const ortho=e.aFy*aqx+-e.aFx*aqy;
  if(Math.abs(ortho)<endpointDistance){SD[0]=ortho;SD[1]=0;return;}
 }
 SD[0]=nonZeroSign(aqx*aby-aqy*abx)*endpointDistance;
 let mx=ex,my=ey;const l=len(mx,my);if(l){mx/=l;my/=l;}else{mx=0;my=1;}
 SD[1]=Math.abs(e.aFx*mx+e.aFy*my);
}
function endDot(e,atStart,vx,vy){
 const l=len(vx,vy);let mx=vx,my=vy;if(l){mx/=l;my/=l;}else{mx=0;my=1;}
 return Math.abs(atStart?e.aFx*mx+e.aFy*my:e.bFx*mx+e.bFy*my);
}
function quadDistance(e,qx,qy){
 const p=e.p;
 const qax=p[0]-qx,qay=p[1]-qy,abx=p[2]-p[0],aby=p[3]-p[1],brx=p[4]-p[2]-abx,bry=p[5]-p[3]-aby;
 const a=brx*brx+bry*bry,b=3*(abx*brx+aby*bry),c=2*(abx*abx+aby*aby)+(qax*brx+qay*bry),d=qax*abx+qay*aby;
 const n=solveCubic(roots,a,b,c,d);
 let ex=e.d0x,ey=e.d0y;
 let minDistance=nonZeroSign(ex*qay-ey*qax)*len(qax,qay);
 let param=-(qax*ex+qay*ey)/(ex*ex+ey*ey);
 {
  const bx=p[4]-qx,by=p[5]-qy,distance=len(bx,by);
  if(distance<Math.abs(minDistance)){
   ex=e.d1x;ey=e.d1y;
   minDistance=nonZeroSign(ex*by-ey*bx)*distance;
   param=((qx-p[2])*ex+(qy-p[3])*ey)/(ex*ex+ey*ey);
  }
 }
 for(let i=0;i<n;i++){
  const t=roots[i];
  if(t>0&&t<1){
   const qex=qax+2*t*abx+t*t*brx,qey=qay+2*t*aby+t*t*bry,distance=len(qex,qey);
   if(distance<=Math.abs(minDistance)){
    const tx=abx+t*brx,ty=aby+t*bry;
    minDistance=nonZeroSign(tx*qey-ty*qex)*distance;param=t;
   }
  }
 }
 SD[0]=minDistance;SD[2]=param;
 if(param>=0&&param<=1)SD[1]=0;
 else if(param<.5)SD[1]=endDot(e,true,qax,qay);
 else SD[1]=endDot(e,false,p[4]-qx,p[5]-qy);
}
function cubicDistance(e,qx,qy){
 const p=e.p;
 const qax=p[0]-qx,qay=p[1]-qy,abx=p[2]-p[0],aby=p[3]-p[1],brx=p[4]-p[2]-abx,bry=p[5]-p[3]-aby;
 const asx=(p[6]-p[4])-(p[4]-p[2])-brx,asy=(p[7]-p[5])-(p[5]-p[3])-bry;
 let ex=e.d0x,ey=e.d0y;
 let minDistance=nonZeroSign(ex*qay-ey*qax)*len(qax,qay);
 let param=-(qax*ex+qay*ey)/(ex*ex+ey*ey);
 {
  const bx=p[6]-qx,by=p[7]-qy,distance=len(bx,by);
  if(distance<Math.abs(minDistance)){
   ex=e.d1x;ey=e.d1y;
   minDistance=nonZeroSign(ex*by-ey*bx)*distance;
   param=((ex-bx)*ex+(ey-by)*ey)/(ex*ex+ey*ey);
  }
 }
 for(let i=0;i<=CUBIC_SEARCH_STARTS;i++){
  let t=1/CUBIC_SEARCH_STARTS*i;
  let qex=qax+3*t*abx+3*t*t*brx+t*t*t*asx,qey=qay+3*t*aby+3*t*t*bry+t*t*t*asy;
  let d1x=3*abx+6*t*brx+3*t*t*asx,d1y=3*aby+6*t*bry+3*t*t*asy;
  let d2x=6*brx+6*t*asx,d2y=6*bry+6*t*asy;
  let improved=t-(qex*d1x+qey*d1y)/((d1x*d1x+d1y*d1y)+(qex*d2x+qey*d2y));
  if(improved>0&&improved<1){
   let remaining=CUBIC_SEARCH_STEPS;
   do{
    t=improved;
    qex=qax+3*t*abx+3*t*t*brx+t*t*t*asx;qey=qay+3*t*aby+3*t*t*bry+t*t*t*asy;
    d1x=3*abx+6*t*brx+3*t*t*asx;d1y=3*aby+6*t*bry+3*t*t*asy;
    if(!--remaining)break;
    d2x=6*brx+6*t*asx;d2y=6*bry+6*t*asy;
    improved=t-(qex*d1x+qey*d1y)/((d1x*d1x+d1y*d1y)+(qex*d2x+qey*d2y));
   }while(improved>0&&improved<1);
   const distance=len(qex,qey);
   if(distance<Math.abs(minDistance)){minDistance=nonZeroSign(d1x*qey-d1y*qex)*distance;param=t;}
  }
 }
 SD[0]=minDistance;SD[2]=param;
 if(param>=0&&param<=1)SD[1]=0;
 else if(param<.5)SD[1]=endDot(e,true,qax,qay);
 else SD[1]=endDot(e,false,p[6]-qx,p[7]-qy);
}
/** Signed distance from (qx,qy) to the edge; result in SD (see above). */
export function edgeSignedDistance(e,qx,qy){
 if(e.d0x===undefined)prepareEdge(e);
 if(e.type===1)lineDistance(e,qx,qy);else if(e.type===2)quadDistance(e,qx,qy);else cubicDistance(e,qx,qy);
 return SD;
}

// ---- Scanline crossings (msdfgen EdgeSegment::scanlineIntersections). Each crossing is an x
// and a direction dy = ±1 (+1 where the edge moves towards larger y). Endpoints are handled
// half-open, so a horizontal line through a vertex counts every crossing exactly once.
export function scanlineIntersections(e,y,xs,dys){
 const p=e.p;
 if(e.type===1){
  if((y>=p[1]&&y<p[3])||(y>=p[3]&&y<p[1])){
   const t=(y-p[1])/(p[3]-p[1]);xs[0]=(1-t)*p[0]+t*p[2];dys[0]=sign(p[3]-p[1]);return 1;
  }
  return 0;
 }
 const last=e.type,lx=p[2*last],ly=p[2*last+1];
 let total=0,nextDY=y>p[1]?1:-1;
 xs[0]=p[0];
 if(e.type===2){
  if(p[1]===y){if(p[1]<p[3]||(p[1]===p[3]&&p[1]<p[5]))dys[total++]=1;else nextDY=1;}
  const abx=p[2]-p[0],aby=p[3]-p[1],brx=p[4]-p[2]-abx,bry=p[5]-p[3]-aby,t=[0,0];
  const n=solveQuadratic(t,bry,2*aby,p[1]-y);
  if(n>=2&&t[0]>t[1]){const tmp=t[0];t[0]=t[1];t[1]=tmp;}
  for(let i=0;i<n&&total<2;i++){
   if(t[i]>=0&&t[i]<=1){
    xs[total]=p[0]+2*t[i]*abx+t[i]*t[i]*brx;
    if(nextDY*(aby+t[i]*bry)>=0){dys[total++]=nextDY;nextDY=-nextDY;}
   }
  }
  if(ly===y){
   if(nextDY>0&&total>0){--total;nextDY=-1;}
   if((ly<p[3]||(ly===p[3]&&ly<p[1]))&&total<2){xs[total]=lx;if(nextDY<0){dys[total++]=-1;nextDY=1;}}
  }
 }else{
  if(p[1]===y){if(p[1]<p[3]||(p[1]===p[3]&&(p[1]<p[5]||(p[1]===p[5]&&p[1]<p[7]))))dys[total++]=1;else nextDY=1;}
  const abx=p[2]-p[0],aby=p[3]-p[1],brx=p[4]-p[2]-abx,bry=p[5]-p[3]-aby;
  const asx=(p[6]-p[4])-(p[4]-p[2])-brx,asy=(p[7]-p[5])-(p[5]-p[3])-bry,t=[0,0,0];
  const n=solveCubic(t,asy,3*bry,3*aby,p[1]-y);
  let tmp;
  if(n>=2){
   if(t[0]>t[1]){tmp=t[0];t[0]=t[1];t[1]=tmp;}
   if(n>=3&&t[1]>t[2]){tmp=t[1];t[1]=t[2];t[2]=tmp;if(t[0]>t[1]){tmp=t[0];t[0]=t[1];t[1]=tmp;}}
  }
  for(let i=0;i<n&&total<3;i++){
   if(t[i]>=0&&t[i]<=1){
    xs[total]=p[0]+3*t[i]*abx+3*t[i]*t[i]*brx+t[i]*t[i]*t[i]*asx;
    if(nextDY*(aby+2*t[i]*bry+t[i]*t[i]*asy)>=0){dys[total++]=nextDY;nextDY=-nextDY;}
   }
  }
  if(ly===y){
   if(nextDY>0&&total>0){--total;nextDY=-1;}
   if((ly<p[5]||(ly===p[5]&&(ly<p[3]||(ly===p[3]&&ly<p[1]))))&&total<3){xs[total]=lx;if(nextDY<0){dys[total++]=-1;nextDY=1;}}
  }
 }
 if(nextDY!==(y>=ly?1:-1)){
  if(total>0)--total;
  else{if(Math.abs(ly-y)<Math.abs(p[1]-y))xs[total]=lx;dys[total++]=nextDY;}
 }
 return total;
}
/** All crossings of the horizontal line at y with the contours, sorted by x, as
 * {xs:Float64Array, winding:Int32Array} where winding[i] is the running sum of directions. */
export function scanline(contours,y){
 const xs=[0,0,0],dys=[0,0,0],hits=[];
 for(const c of contours)for(const e of c.edges){
  const n=scanlineIntersections(e,y,xs,dys);
  for(let i=0;i<n;i++)hits.push([xs[i],dys[i]]);
 }
 hits.sort((a,b)=>a[0]-b[0]);
 const X=new Float64Array(hits.length),W=new Int32Array(hits.length);
 let sum=0;
 for(let i=0;i<hits.length;i++){X[i]=hits[i][0];sum+=hits[i][1];W[i]=sum;}
 return {xs:X,winding:W};
}
/** Running winding at x on a scanline (msdfgen Scanline::sumIntersections: crossings at ≤ x count). */
export function scanlineWinding(line,x){
 const X=line.xs;let lo=0,hi=X.length;
 while(lo<hi){const mid=lo+hi>>1;if(X[mid]<=x)lo=mid+1;else hi=mid;}
 return lo?line.winding[lo-1]:0;
}
export function fillRule(w,rule){
 if(rule==='nonzero')return w!==0;
 if(rule==='evenodd')return (w&1)!==0;
 if(rule==='positive')return w>0;
 if(rule==='negative')return w<0;
 throw Error('Fill rule must be nonzero, evenodd, positive or negative');
}

// ---- convergentCurveOrdering (msdfgen v1.12+): which of two curves leaving the same corner in
// (almost) the same direction bends away first, decided by the lowest non-vanishing derivative
// of the cross product of the two arc-length-normed curves. Used by Shape::normalize.
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
function simplifyDegenerate(cp,order){
 const eq=(i,j)=>cp[i][0]===cp[j][0]&&cp[i][1]===cp[j][1];
 if(order===3&&(eq(1,0)||eq(1,3))&&(eq(2,0)||eq(2,3))){cp[1]=cp[3];order=1;}
 if(order===2&&(eq(1,0)||eq(1,2))){cp[1]=cp[2];order=1;}
 if(order===1&&eq(0,1))order=0;
 return order;
}
function orderingAt(before,corner,after){
 const nb=before.length,na=after.length;
 if(!(nb>0&&na>0))return 0;
 const V=(x,y)=>[x,y],sub=(a,b)=>V(a[0]-b[0],a[1]-b[1]),cr=(a,b)=>cross(a[0],a[1],b[0],b[1]),L=a=>len(a[0],a[1]);
 const at=i=>i<0?before[nb+i]:i===0?corner:after[i-1];
 let a1=sub(at(-1),corner),b1=sub(at(1),corner),a2=V(0,0),b2=V(0,0),a3=V(0,0),b3=V(0,0);
 if(nb>=2)a2=sub(sub(at(-2),at(-1)),a1);
 if(na>=2)b2=sub(sub(at(2),at(1)),b1);
 if(nb>=3){a3=sub(sub(sub(at(-3),at(-2)),sub(at(-2),at(-1))),a2);a2=V(3*a2[0],3*a2[1]);}
 if(na>=3){b3=sub(sub(sub(at(3),at(2)),sub(at(2),at(1))),b2);b2=V(3*b2[0],3*b2[1]);}
 a1=V(a1[0]*nb,a1[1]*nb);b1=V(b1[0]*na,b1[1]*na);
 const nz=a=>a[0]!==0||a[1]!==0;
 if(nz(a1)&&nz(b1)){
  const as=L(a1),bs=L(b1);let d;
  if((d=as*cr(a1,b2)+bs*cr(a2,b1)))return sign(d);
  if((d=as*as*cr(a1,b3)+as*bs*cr(a2,b2)+bs*bs*cr(a3,b1)))return sign(d);
  if((d=as*cr(a2,b3)+bs*cr(a3,b2)))return sign(d);
  return sign(cr(a3,b3));
 }
 let s=1;
 if(nz(a1)){let t;b1=a1;t=b2;b2=a2;a2=t;t=b3;b3=a3;a3=t;s=-1;}
 if(nz(b1)){
  let d;
  if((d=cr(a3,b1)))return s*sign(d);
  if((d=cr(a2,b2)))return s*sign(d);
  if((d=cr(a3,b2)))return s*sign(d);
  if((d=cr(a2,b3)))return s*sign(d);
  return s*sign(cr(a3,b3));
 }
 const d=Math.sqrt(L(a2))*cr(a2,b3)+Math.sqrt(L(b2))*cr(a3,b2);
 if(d)return sign(d);
 return sign(cr(a3,b3));
}
export function convergentCurveOrdering(a,b){
 const pts=e=>Array.from({length:e.type+1},(_,i)=>[e.p[2*i],e.p[2*i+1]]);
 const A=pts(a),B=pts(b);
 const ae=A[a.type];
 if(ae[0]!==B[0][0]||ae[1]!==B[0][1])return 0;
 const ao=simplifyDegenerate(A,a.type),bo=simplifyDegenerate(B,b.type);
 return orderingAt(A.slice(0,ao),B[0],B.slice(1,bo+1));
}
