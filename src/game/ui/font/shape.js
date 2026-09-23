/** Glyph outlines → shapes in PIXEL space, ready for rasterising and distance fields. Pure; no DOM.
 *
 * Input: opentype.js-style commands in font units, y-up, contours closed
 *   [{type:'M',x,y},{type:'L',x,y},{type:'Q',x1,y1,x,y},{type:'C',x1,y1,x2,y2,x,y},{type:'Z'}]
 * Output: Shape = {contours:[{edges:[{type:1|2|3, p:Float64Array, color:7}]}], bounds}
 * with px = dx + x·scale and py = dy − y·scale (flipY, the default) — y grows DOWN, pixel (x,y)
 * covers [x,x+1)×[y,y+1) and its sample point is (x+.5, y+.5). Edge format: msdf-geometry.js.
 *
 * Degenerate input is dropped exactly like msdfgen's FreeType importer and EdgeSegment::create,
 * with the tests done in font units (integers for TrueType, so "collinear" means exactly
 * collinear): zero-length lines and quadratics, cubics that return to their start with collinear
 * handles, quadratics/cubics whose control points are all collinear (→ line), and cubics that are
 * degree-elevated quadratics (→ quadratic). A contour missing its closing segment is closed.
 *
 * Orientation convention. msdfgen works y-up and calls a contour "positive" (winding +1) when
 * it is clockwise in y-up; its signed distance is positive on the right of the direction of
 * travel, which is inside a positive contour. TrueType outer contours are positive, CFF ones
 * negative. In this pixel frame (y-down) the same contour is still clockwise ON SCREEN, and its
 * shoelace area Σ(x_i·y_{i+1} − x_{i+1}·y_i)/2 is > 0. contourWinding() reports +1 for such
 * contours, windingAt() reports the fill winding in the same convention (+1 inside a TrueType
 * glyph), and orientContours() makes the nonzero fill positive everywhere it can (see there).
 *
 * normalizeShape = msdfgen Shape::normalize: a one-edge contour is split into thirds (edge
 * colouring needs ≥ 3 edges), and two edges meeting at a cusp (tangents within 1e-6 of
 * opposite) are pushed apart by nudging the control point next to the cusp, after deciding
 * which one bends away first (convergentCurveOrdering) — otherwise the pseudo-distance of
 * the two edges is ambiguous and MSDFs show a spike there. */
import {WHITE,makeEdge,cloneEdge,edgeBound,edgeDirection,edgePoint,normalize,reverseEdge,splitInThirds,quadToCubic,convergentCurveOrdering,scanline,scanlineWinding,fillRule} from './msdf-geometry.js';
export {BLACK,RED,GREEN,YELLOW,BLUE,MAGENTA,CYAN,WHITE} from './msdf-geometry.js';
const CORNER_DOT_EPSILON=1e-6,DECONVERGE_OVERSHOOT=1.11111111111111111;
const fin=v=>typeof v==='number'&&Number.isFinite(v);

export function shapeFromCommands(commands,{scale=1,dx=0,dy=0,flipY=true}={}){
 if(!Array.isArray(commands))throw Error('Glyph commands must be an array');
 if(!fin(scale)||!fin(dx)||!fin(dy))throw Error('scale, dx and dy must be finite numbers');
 const sy=flipY?-scale:scale,X=x=>dx+x*scale,Y=y=>dy+y*sy;
 const contours=[];let edges=null,x0=0,y0=0,px=0,py=0;
 const need=(c,...keys)=>{for(const k of keys)if(!fin(c[k]))throw Error(`Glyph command ${c.type} has a non-numeric ${k}`);};
 const close=()=>{
  if(!edges)return;
  if(px!==x0||py!==y0)edges.push(makeEdge(1,[X(px),Y(py),X(x0),Y(y0)]));
  if(edges.length)contours.push({edges});
  edges=null;px=x0;py=y0;
 };
 for(const c of commands){
  const t=c&&c.type;
  if(t==='M'){close();need(c,'x','y');edges=[];x0=px=c.x;y0=py=c.y;continue;}
  if(t==='Z'){close();continue;}
  if(t!=='L'&&t!=='Q'&&t!=='C')throw Error(`Unknown glyph command ${JSON.stringify(t)}`);
  if(!edges){edges=[];x0=px;y0=py;}// drawing without a moveto starts at the current point
  if(t==='L'){
   need(c,'x','y');
   if(c.x!==px||c.y!==py)edges.push(makeEdge(1,[X(px),Y(py),X(c.x),Y(c.y)]));
  }else if(t==='Q'){
   need(c,'x1','y1','x','y');
   if(c.x!==px||c.y!==py){
    if((c.x1-px)*(c.y-c.y1)-(c.y1-py)*(c.x-c.x1)===0)edges.push(makeEdge(1,[X(px),Y(py),X(c.x),Y(c.y)]));
    else edges.push(makeEdge(2,[X(px),Y(py),X(c.x1),Y(c.y1),X(c.x),Y(c.y)]));
   }
  }else{
   need(c,'x1','y1','x2','y2','x','y');
   if(c.x!==px||c.y!==py||(c.x1-c.x)*(c.y2-c.y)-(c.y1-c.y)*(c.x2-c.x)!==0){
    const ax=c.x1-px,ay=c.y1-py,mx=c.x2-c.x1,my=c.y2-c.y1,bx=c.x-c.x2,by=c.y-c.y2;
    if(ax*my-ay*mx===0&&mx*by-my*bx===0)edges.push(makeEdge(1,[X(px),Y(py),X(c.x),Y(c.y)]));
    else{
     const qx=1.5*c.x1-.5*px,qy=1.5*c.y1-.5*py;
     if(qx===1.5*c.x2-.5*c.x&&qy===1.5*c.y2-.5*c.y)edges.push(makeEdge(2,[X(px),Y(py),X(qx),Y(qy),X(c.x),Y(c.y)]));
     else edges.push(makeEdge(3,[X(px),Y(py),X(c.x1),Y(c.y1),X(c.x2),Y(c.y2),X(c.x),Y(c.y)]));
    }
   }
  }
  px=c.x;py=c.y;
 }
 close();
 const shape={contours,bounds:null};
 shape.bounds=shapeBounds(shape);
 return shape;
}
/** Tight bounds of the curves (extrema included) or null for an empty shape. */
export function shapeBounds(shape){
 const b=[Infinity,Infinity,-Infinity,-Infinity];
 for(const c of shape.contours)for(const e of c.edges)edgeBound(e,b);
 return b[0]<=b[2]?{x0:b[0],y0:b[1],x1:b[2],y1:b[3]}:null;
}
export function cloneShape(shape){
 return {contours:shape.contours.map(c=>({edges:c.edges.map(cloneEdge)})),bounds:shape.bounds&&{...shape.bounds}};
}
export const edgeCount=shape=>shape.contours.reduce((n,c)=>n+c.edges.length,0);
export function reverseContour(contour){contour.edges.reverse();for(const e of contour.edges)reverseEdge(e);return contour;}
/** Maps a shape through px' = (px+tx)·s, py' = (py+ty)·s (a cell placement), in place. */
export function transformShape(shape,{scale=1,translate=[0,0]}={}){
 const [tx,ty]=translate;
 for(const c of shape.contours)for(const e of c.edges)for(let i=0;i<e.p.length;i+=2){e.p[i]=(e.p[i]+tx)*scale;e.p[i+1]=(e.p[i+1]+ty)*scale;}
 shape.bounds=shapeBounds(shape);
 return shape;
}

function deconverge(edges,i,param,vx,vy){
 let e=edges[i];
 if(e.type===1)return;
 if(e.type===2)e=edges[i]=quadToCubic(e);
 const p=e.p;
 if(param===0){const l=Math.sqrt((p[2]-p[0])**2+(p[3]-p[1])**2);p[2]+=l*vx;p[3]+=l*vy;}
 else{const l=Math.sqrt((p[4]-p[6])**2+(p[5]-p[7])**2);p[4]+=l*vx;p[5]+=l*vy;}
}
/** msdfgen Shape::normalize, in place. Mirror-equivariant, so running it on the y-down frame is
 * the same as msdfgen running it on the y-up original. */
export function normalizeShape(shape){
 for(const c of shape.contours){
  const E=c.edges;
  if(E.length===1){c.edges=splitInThirds(E[0]);continue;}
  if(!E.length)continue;
  let prev=E.length-1;
  for(let i=0;i<E.length;i++){
   const pd=normalize(edgeDirection(E[prev],1)),cd=normalize(edgeDirection(E[i],0));
   if(pd[0]*cd[0]+pd[1]*cd[1]<CORNER_DOT_EPSILON-1){
    const f=DECONVERGE_OVERSHOOT*Math.sqrt(1-(CORNER_DOT_EPSILON-1)*(CORNER_DOT_EPSILON-1))/(CORNER_DOT_EPSILON-1);
    const ax0=normalize([cd[0]-pd[0],cd[1]-pd[1]]);
    let ax=f*ax0[0],ay=f*ax0[1];
    if(convergentCurveOrdering(E[prev],E[i])<0){ax=-ax;ay=-ay;}
    deconverge(E,prev,1,-ay,ax);// getOrthogonal(true) = (-y, x)
    deconverge(E,i,0,ay,-ax);// getOrthogonal(false) = (y, -x)
   }
   prev=i;
  }
 }
 shape.bounds=shapeBounds(shape);
 return shape;
}
/** +1 for a contour that is clockwise on screen (positive / TrueType-outer), −1 for the other
 * way, 0 for none. msdfgen Contour::winding (shoelace over edge start points; one- and two-edge
 * contours sampled at thirds/halves), with the sign flipped because this frame is y-down. */
export function contourWinding(contour){
 const E=contour.edges;if(!E.length)return 0;
 const pts=[];
 if(E.length===1)pts.push(edgePoint(E[0],0),edgePoint(E[0],1/3),edgePoint(E[0],2/3));
 else if(E.length===2)pts.push(edgePoint(E[0],0),edgePoint(E[0],.5),edgePoint(E[1],0),edgePoint(E[1],.5));
 else for(const e of E)pts.push([e.p[0],e.p[1]]);
 let total=0;
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];total+=(b[0]-a[0])*(a[1]+b[1]);}
 return total<0?1:total>0?-1:0;// msdfgen: sign(total) in y-up; the y-down mirror flips it
}
/** Fill winding at a point: +1 inside a positive contour (see header), msdfgen scanline rules. */
export function windingAt(shape,x,y){const w=scanlineWinding(scanline(shape.contours,y),x);return w?-w:0;}
/** msdfgen text shape description of a pixel-space shape, mirrored into msdfgen's y-up frame
 * with Y = height − y (so msdfgen's pixel row r from the bottom is this frame's row height−1−r).
 * Colours are written when `colors` is set. Numbers use JS shortest round-trip form, which
 * msdfgen's strtod/fscanf reads back to the identical double. */
export function shapeDescription(shape,{height,colors=false}={}){
 if(!Number.isFinite(height))throw Error('shapeDescription needs the output height');
 const code={3:'y',5:'m',6:'c',7:'w'},pt=(e,i)=>`${e.p[2*i]}, ${height-e.p[2*i+1]}`;
 const out=[];
 for(const c of shape.contours){
  if(!c.edges.length)continue;
  const parts=[];
  c.edges.forEach((e,k)=>{
   parts.push(pt(e,0));
   const col=colors&&code[e.color]?code[e.color]:'';
   if(e.type===1){if(col)parts.push(col);}
   else parts.push(`${col}(${e.type===2?pt(e,1):`${pt(e,1)}; ${pt(e,2)}`})`);
  });
  out.push(`{\n ${parts.join(';\n ')};\n #\n}`);
 }
 return out.join('\n')+'\n';
}
export const insideAt=(shape,x,y,rule='nonzero')=>fillRule(windingAt(shape,x,y),rule);

/** Make windings consistent so that the NONZERO fill has positive-inside distance, in place.
 *
 * msdfgen's own orientContours assumes non-overlapping contours (even-odd nesting on a
 * scanline) and would flip one of two overlapping same-direction contours — wrong for variable
 * fonts, which keep their overlaps. This version preserves the nonzero fill instead: every
 * contour votes, per edge (weighted by length), by probing the fill winding just to the right
 * (positive side) and left of the edge's midpoint. An edge whose right side is empty (w = 0)
 * and left side filled is backwards; right filled / left empty is correct; filled on both sides
 * (an internal, overlapped edge) abstains. Contours with a negative vote total are reversed.
 * A contour that abstains everywhere (entirely inside the fill) is reversed only if it sits
 * in negative winding. For shapes whose contours are all wound one way (TrueType or CFF) this
 * is exactly "keep" or "reverse everything"; for mixed components it fixes each component. */
export function orientContours(shape){
 const b=shape.bounds||shapeBounds(shape);
 if(!b)return shape;
 const eps=Math.max(b.x1-b.x0,b.y1-b.y0,1)*1e-7,flips=[];
 for(const c of shape.contours){
  let vote=0,inner=0;
  for(const e of c.edges){
   const m=edgePoint(e,.5),d=normalize(edgeDirection(e,.5));
   let w=0;const q=[0,0];
   for(let k=0;k<4;k++){const a=edgePoint(e,k/4),z=edgePoint(e,(k+1)/4,q);w+=Math.sqrt((z[0]-a[0])**2+(z[1]-a[1])**2);}
   // right of travel in a y-up frame is (dy,-dx); flipped for y-down pixels it is (-dy, dx)
   const rx=-d[1],ry=d[0];
   const wr=windingAt(shape,m[0]+eps*rx,m[1]+eps*ry),wl=windingAt(shape,m[0]-eps*rx,m[1]-eps*ry);
   if(wr!==0&&wl===0)vote+=w;
   else if(wr===0&&wl!==0)vote-=w;
   else inner+=w*Math.sign(wr);
  }
  flips.push(vote<0||(vote===0&&inner<0));
 }
 shape.contours.forEach((c,i)=>{if(flips[i])reverseContour(c);});
 return shape;
}
