/** Glyph path helpers for the OpenType parser: TrueType contours → M/L/Q/Z commands, and tight
 * bounds of a command list. Pure; no DOM.
 *
 * The contour walk is fontTools' glyf draw + BasePen.qCurveTo, step for step: each contour
 * starts at its first on-curve point, consecutive off-curve points get the implied on-curve
 * midpoint 0.5·(a+b), the closing straight line back to the start is left to 'Z', and a contour
 * with no on-curve point at all starts at the midpoint of its last and first points. Doing the
 * same float operations in the same order is what lets the tests compare against fontTools with
 * exact equality instead of a tolerance.
 *
 * Bounds are the tight box of the drawn curves (curve extrema included), like fontTools'
 * BoundsPen — not the control-point box stored in glyf headers. */

/** xy: Float64Array of x,y pairs; on: on-curve flags; ends: last point index of each contour. */
export function contoursToCommands(xy,on,ends){
 const out=[];let start=0;
 for(const end of ends){
  const n=end-start+1;
  if(n<=0){start=end+1;continue;}
  const X=i=>xy[(start+i)*2],Y=i=>xy[(start+i)*2+1];
  let first=-1;for(let i=0;i<n;i++)if(on[start+i]){first=i;break;}
  if(first<0){
   const sx=0.5*(X(n-1)+X(0)),sy=0.5*(Y(n-1)+Y(0));
   out.push({type:'M',x:sx,y:sy});
   for(let i=0;i<n-1;i++)out.push({type:'Q',x1:X(i),y1:Y(i),x:0.5*(X(i)+X(i+1)),y:0.5*(Y(i)+Y(i+1))});
   out.push({type:'Q',x1:X(n-1),y1:Y(n-1),x:sx,y:sy});
  }else{
   out.push({type:'M',x:X(first),y:Y(first)});
   let offs=[];
   for(let k=1;k<=n;k++){
    const i=(first+k)%n;
    if(!on[start+i]){offs.push(i);continue;}
    if(!offs.length){if(k<n)out.push({type:'L',x:X(i),y:Y(i)});continue;}
    for(let j=0;j<offs.length-1;j++){const a=offs[j],b=offs[j+1];out.push({type:'Q',x1:X(a),y1:Y(a),x:0.5*(X(a)+X(b)),y:0.5*(Y(a)+Y(b))});}
    const last=offs[offs.length-1];out.push({type:'Q',x1:X(last),y1:Y(last),x:X(i),y:Y(i)});
    offs=[];
   }
  }
  out.push({type:'Z'});
  start=end+1;
 }
 return out;
}

function quadExtrema(a,b,c,add){// t where d/dt of (1-t)²a + 2t(1-t)b + t²c is 0
 const den=a-2*b+c;if(den===0)return;
 const t=(a-b)/den;if(t>0&&t<1){const u=1-t;add(u*u*a+2*u*t*b+t*t*c);}
}
function cubicExtrema(a,b,c,d,add){
 const A=-a+3*b-3*c+d,B=2*(a-2*b+c),C=b-a;// derivative/3 = A t² + B t + C
 const at=t=>{if(t>0&&t<1){const u=1-t;add(u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d);}};
 if(Math.abs(A)<1e-12){if(B!==0)at(-C/B);return;}
 const disc=B*B-4*A*C;if(disc<0)return;
 const r=Math.sqrt(disc);at((-B+r)/(2*A));at((-B-r)/(2*A));
}
/** Tight bounds of a command list → {xMin,yMin,xMax,yMax} or null when nothing is drawn. */
export function commandBounds(cmds){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,cx=0,cy=0;
 const ax=x=>{if(x<x0)x0=x;if(x>x1)x1=x;},ay=y=>{if(y<y0)y0=y;if(y>y1)y1=y;};
 for(const c of cmds){
  if(c.type==='Z')continue;
  if(c.type==='Q'){quadExtrema(cx,c.x1,c.x,ax);quadExtrema(cy,c.y1,c.y,ay);}
  else if(c.type==='C'){cubicExtrema(cx,c.x1,c.x2,c.x,ax);cubicExtrema(cy,c.y1,c.y2,c.y,ay);}
  ax(c.x);ay(c.y);cx=c.x;cy=c.y;
 }
 return x0>x1?null:{xMin:x0,yMin:y0,xMax:x1,yMax:y1};
}
