/** Exact-area anti-aliased coverage of a pixel-space shape (shape.js), and point-in-shape tests.
 * Pure; no DOM.
 *
 * Pixel (x,y) covers [x,x+1)×[y,y+1); its coverage is the exact area of that square inside the
 * fill, in 0…1. Curves are flattened adaptively: a Bézier is cut into n uniform pieces with n
 * chosen from its second-difference bound so the chord never strays more than `tolerance`
 * pixels (default 0.01) from the curve — |B''| ≤ 2|p0−2p1+p2| (quadratic) or
 * 6·max|second differences| (cubic), chord error ≤ |B''|·h²/8.
 *
 * Accumulation is the font-rs / stb_truetype-v2 signed-area scheme: for a line crossing a row,
 * each cell gets the area between the line and the cell's right side, so a prefix sum along the
 * row yields "area right of the boundary". Plain font-rs sums every contour and clamps |sum| to 1,
 * which double-counts where same-direction contours overlap (a pixel half covered by two
 * overlapping contours reads 1, not ½) — and variable fonts overlap on purpose. So this raster
 * resolves the fill rule per row instead: each row strip is cut into sub-strips at every line
 * end and every pairwise line crossing inside the strip; within a sub-strip no two lines cross,
 * so the lines sorted by x give the exact winding intervals. Only the boundaries of FILLED
 * intervals (winding 0 → ≠0 and back, or odd/even) are accumulated, as trapezoids. The result
 * is the exact nonzero (or even-odd) area of the flattened outline, no clamping involved.
 *
 * insideAt / windingAt are exact on the curves themselves (no flattening): msdfgen's scanline
 * crossing rules, which count a vertex exactly once, so points level with vertices are safe. */
import {edgePoint,fillRule} from './msdf-geometry.js';
export {insideAt,windingAt} from './shape.js';

function flatten(shape,tolerance){
 const L=[],q=[0,0];
 for(const c of shape.contours)for(const e of c.edges){
  const p=e.p;let n=1;
  if(e.type===2)n=Math.ceil(Math.sqrt(Math.hypot(p[0]-2*p[2]+p[4],p[1]-2*p[3]+p[5])/(4*tolerance)));
  else if(e.type===3)n=Math.ceil(Math.sqrt(3*Math.max(Math.hypot(p[0]-2*p[2]+p[4],p[1]-2*p[3]+p[5]),Math.hypot(p[2]-2*p[4]+p[6],p[3]-2*p[5]+p[7]))/(4*tolerance)));
  n=Math.min(Math.max(n,1),4096);
  let px=p[0],py=p[1];
  for(let i=1;i<=n;i++){
   edgePoint(e,i/n,q);
   if(py!==q[1])L.push(px,py,q[0],q[1]);// horizontal pieces cross no row boundary and enclose no area
   px=q[0];py=q[1];
  }
 }
 return L;
}
// font-rs cell accumulation of the area right of the line (xa,ya)→(xb,yb), all inside one row,
// with x already clamped to [0,w]; d = signed height.
function accumulate(acc,o,xa,xb,d){
 const x0=Math.min(xa,xb),x1=Math.max(xa,xb),x0f=Math.floor(x0),x0i=x0f,x1c=Math.ceil(x1),x1i=x1c;
 if(x1i<=x0i+1){
  const xmf=.5*(xa+xb)-x0f;
  acc[o+x0i]+=d-d*xmf;acc[o+x0i+1]+=d*xmf;
  return;
 }
 const s=1/(x1-x0),fx=x0-x0f,a0=.5*s*(1-fx)*(1-fx),x1f=x1-x1c+1,am=.5*s*x1f*x1f;
 acc[o+x0i]+=d*a0;
 if(x1i===x0i+2)acc[o+x0i+1]+=d*(1-a0-am);
 else{
  const a1=s*(1.5-fx);
  acc[o+x0i+1]+=d*(a1-a0);
  for(let xi=x0i+2;xi<x1i-1;xi++)acc[o+xi]+=d*s;
  const a2=a1+(x1i-x0i-3)*s;
  acc[o+x1i-1]+=d*(1-a2-am);
 }
 acc[o+x1i]+=d*am;
}
// A boundary line over one sub-strip, split where it leaves [0,w] so the clamp stays linear.
function boundary(acc,o,w,xa,ya,xb,yb,sgn){
 const cuts=[0,1];
 for(const edge of [0,w])if((xa-edge)*(xb-edge)<0)cuts.push((edge-xa)/(xb-xa));
 cuts.sort((a,b)=>a-b);
 for(let i=0;i+1<cuts.length;i++){
  const t0=cuts[i],t1=cuts[i+1];if(t1<=t0)continue;
  const X0=Math.min(w,Math.max(0,xa+(xb-xa)*t0)),X1=Math.min(w,Math.max(0,xa+(xb-xa)*t1));
  accumulate(acc,o,X0,X1,sgn*(yb-ya)*(t1-t0));
 }
}
/** Coverage 0…1 per pixel (Float32Array w*h), rule 'nonzero' (default) or 'evenodd';
 * 'positive'/'negative' use the windingAt sign convention (+1 inside TrueType outlines). */
export function rasterize(shape,w,h,{rule='nonzero',tolerance=.01}={}){
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Raster size must be positive integers');
 if(!(tolerance>0))throw Error('Flattening tolerance must be positive');
 fillRule(0,rule);// validates the rule name
 const L=flatten(shape,tolerance),rows=Array.from({length:h},()=>[]);
 for(let i=0;i<L.length;i+=4){
  const y0=Math.min(L[i+1],L[i+3]),y1=Math.max(L[i+1],L[i+3]);
  if(y1<=0||y0>=h)continue;
  for(let r=Math.max(0,Math.floor(y0)),e=Math.min(h,Math.ceil(y1));r<e;r++)rows[r].push(i);
 }
 const W=w+2,acc=new Float64Array(W*h),out=new Float32Array(w*h);
 for(let r=0;r<h;r++){
  const idx=rows[r];if(!idx.length)continue;
  // pieces: ya, yb (ya<yb), xa at ya, slope dx/dy, dir (winding convention: +1 = upwards on screen)
  const n=idx.length,YA=new Float64Array(n),YB=new Float64Array(n),X0=new Float64Array(n),K=new Float64Array(n),D=new Int8Array(n);
  let m=0;
  for(const i of idx){
   const x0=L[i],y0=L[i+1],x1=L[i+2],y1=L[i+3],k=(x1-x0)/(y1-y0);
   const lo=Math.max(r,Math.min(y0,y1)),hi=Math.min(r+1,Math.max(y0,y1));
   if(!(hi>lo))continue;
   YA[m]=lo;YB[m]=hi;K[m]=k;X0[m]=lo===y0?x0:lo===y1?x1:x0+(lo-y0)*k;D[m]=y1<y0?1:-1;m++;
  }
  const xAt=(j,y)=>y===YA[j]?X0[j]:X0[j]+(y-YA[j])*K[j];
  const ys=[r,r+1];
  for(let j=0;j<m;j++){ys.push(YA[j],YB[j]);}
  for(let a=0;a<m;a++)for(let b=a+1;b<m;b++){
   const lo=Math.max(YA[a],YA[b]),hi=Math.min(YB[a],YB[b]);
   if(!(hi>lo))continue;
   const f0=xAt(a,lo)-xAt(b,lo),f1=xAt(a,hi)-xAt(b,hi);
   if((f0<0&&f1>0)||(f0>0&&f1<0)){const y=lo+(hi-lo)*(f0/(f0-f1));if(y>lo&&y<hi)ys.push(y);}
  }
  ys.sort((a,b)=>a-b);
  const o=r*W,act=[],mid=new Float64Array(m);
  for(let s=0;s+1<ys.length;s++){
   const s0=ys[s],s1=ys[s+1];
   if(!(s1>s0))continue;
   act.length=0;
   const ym=.5*(s0+s1);
   for(let j=0;j<m;j++)if(YA[j]<s1&&YB[j]>s0){act.push(j);mid[j]=xAt(j,ym);}
   if(act.length<2)continue;
   act.sort((a,b)=>mid[a]-mid[b]);
   let wnd=0,left=-1;
   for(const j of act){
    const was=fillRule(wnd,rule);wnd+=D[j];const now=fillRule(wnd,rule);
    if(!was&&now)left=j;
    else if(was&&!now&&left>=0){
     boundary(acc,o,w,xAt(left,s0),s0,xAt(left,s1),s1,1);
     boundary(acc,o,w,xAt(j,s0),s0,xAt(j,s1),s1,-1);
     left=-1;
    }
   }
  }
  let sum=0;
  for(let x=0;x<w;x++){sum+=acc[o+x];out[r*w+x]=sum<0?0:sum>1?1:sum;}
 }
 return out;
}
