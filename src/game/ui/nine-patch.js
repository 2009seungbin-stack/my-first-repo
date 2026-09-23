/** The Studio's 9-slice suite (draw9patch-plus): stretch borders AND content padding, per-axis
 * stretch / tile / tile-fit, suggestions from repeated pixels, "bad patch" validation, an exact
 * draw plan at any target size and DPI scale, a reference renderer, and Android .9.png read/write.
 * Pure: RGBA arrays and numbers in, plain data out. No DOM.
 *
 * Coordinates are source pixels of ONE element: `rect` is where the element sits in its image
 * (a whole panel PNG, or one element of a UI sheet); every border is measured from that rect's
 * edges. The four border numbers stay the single source of truth; engine forms (Godot margins,
 * Unity L,B,R,T, CSS slice, .9.png marks) are derived from them in the exporters.
 *
 *   nine = {border:{left,right,top,bottom},            stretch borders (what never scales)
 *           padding:{left,right,top,bottom}|null,       content padding (Android 9-patch bottom/right
 *                                                        marks, Godot content_margin_*); null = same as border
 *           stretch:{h:'stretch'|'tile'|'tile-fit', v:…}, how the middle band fills each axis
 *           drawCenter:true}
 *
 * The draw plan maps destination pixels to source pixels with nearest sampling at pixel centres,
 * which is what an engine does with a Nearest-filtered texture. Where engines differ (where a
 * partial tile goes), `anchor` selects the behaviour; see docs/STUDIO-UI.md for what each engine
 * was measured to do. */
import {borders as checkBorders,clampBorders,suggestBorders} from '../nine-slice.js';
export const MODES=Object.freeze(['stretch','tile','tile-fit']);
export const SIDES=Object.freeze(['left','right','top','bottom']);
const z4=()=>({left:0,right:0,top:0,bottom:0});
const int=v=>Math.max(0,Math.round(Number(v)||0));
export function normalizeNine(n={},w,h){
 const border=clampBorders({...z4(),...(n.border||{})},w,h);
 const padding=n.padding?clampBorders({...z4(),...n.padding},w,h):null;
 const mode=v=>MODES.includes(v)?v:'stretch';
 return {border,padding,stretch:{h:mode(n.stretch?.h),v:mode(n.stretch?.v)},drawCenter:n.drawCenter!==false};
}
/** The padding an engine will use: explicit padding, else (like Android and Godot) the borders. */
export const effectivePadding=n=>n.padding||n.border;
const same4=(a,b)=>SIDES.every(k=>a[k]===b[k]);
export const nineEquals=(a,b)=>same4(a.border,b.border)&&(a.padding===b.padding||(a.padding&&b.padding&&same4(a.padding,b.padding)))&&a.stretch.h===b.stretch.h&&a.stretch.v===b.stretch.v&&a.drawCenter===b.drawCenter;
/** RGBA of one rect of an image (a copy). */
export function crop(data,W,H,r){
 if(data.length!==W*H*4)throw Error('Invalid RGBA data');
 if(r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>W||r.y+r.h>H)throw Error('The element lies outside its image');
 const out=new Uint8ClampedArray(r.w*r.h*4);
 for(let y=0;y<r.h;y++)out.set(data.subarray(((r.y+y)*W+r.x)*4,((r.y+y)*W+r.x+r.w)*4),y*r.w*4);
 return out;
}
// ------------------------------------------------------------------ suggestion
const colEq=(d,w,h,a,b,tol)=>{for(let y=0;y<h;y++){const i=(y*w+a)*4,j=(y*w+b)*4;for(let c=0;c<4;c++)if(Math.abs(d[i+c]-d[j+c])>tol)return false;}return true;};
const rowEq=(d,w,a,b,tol)=>{const i0=a*w*4,j0=b*w*4;for(let x=0;x<w*4;x++)if(Math.abs(d[i0+x]-d[j0+x])>tol)return false;return true;};
/** Smallest period p (2…n/3) such that line x equals line x+p over the longest span; used when a
 * frame has a repeating pattern instead of identical lines (a rope, bricks): tile mode with a
 * middle of one period keeps the pattern intact. */
function period(n,eq,{minRepeats=3}={}){
 let best=null;
 for(let p=2;p<=Math.floor(n/minRepeats);p++){
  let s=0,bestRun=null;
  for(let x=0;x+p<n;x++){if(eq(x,x+p))continue;if(x-s>=p*(minRepeats-1)&&(!bestRun||x-s>bestRun.len))bestRun={start:s,len:x-s};s=x+1;}
  if(n-p-s>=p*(minRepeats-1)&&(!bestRun||n-p-s>bestRun.len))bestRun={start:s,len:n-p-s};
  if(bestRun){best={period:p,start:bestRun.start,span:bestRun.len+p};break;}
 }
 return best;
}
/** Borders from pixels. Identical lines are the safest stretch band; a pattern with a period is
 * the next best (tile mode). Each axis reports its own evidence and confidence, and nothing is
 * applied here: the caller shows it as a suggestion. */
export function suggestNine(data,w,h,{tolerance=0}={}){
 const s=suggestBorders(data,w,h,{tolerance});
 const axis=(runLen,n,eq)=>{
  // identical lines win unless a repeating pattern covers far more of the element
  const p=runLen>=Math.max(4,n*.2)?null:period(n,eq);
  if(p&&p.span>=n*.4&&p.span>=runLen*2)return {mode:'tile',period:p.period,start:p.start,span:p.span,run:runLen,confidence:'medium'};
  if(runLen>=3)return {mode:'stretch',run:runLen,confidence:runLen>=Math.max(4,n*.2)?'high':'medium'};
  return {mode:null,run:runLen,confidence:'none'};
 };
 const hx=axis(s.columnRun,w,(a,b)=>colEq(data,w,h,a,b,tolerance)),vy=axis(s.rowRun,h,(a,b)=>rowEq(data,w,a,b,tolerance));
 const border={left:0,right:0,top:0,bottom:0};
 if(hx.mode==='stretch'){border.left=s.left;border.right=s.right;}
 else if(hx.mode==='tile'){border.left=hx.start;border.right=w-hx.start-hx.period;}
 if(vy.mode==='stretch'){border.top=s.top;border.bottom=s.bottom;}
 else if(vy.mode==='tile'){border.top=vy.start;border.bottom=h-vy.start-vy.period;}
 const stretch={h:hx.mode||'stretch',v:vy.mode||'stretch'};
 const confident=hx.confidence!=='none'&&vy.confidence!=='none';
 const level=[hx.confidence,vy.confidence].includes('none')?(hx.confidence==='none'&&vy.confidence==='none'?'none':'low'):[hx.confidence,vy.confidence].includes('medium')?'medium':'high';
 return {border,stretch,horizontal:hx,vertical:vy,confident,confidence:level};
}
// ------------------------------------------------------------------ validation ("bad patches")
/** Differences along the stretch axis of one band. Returns the lines (columns for a horizontal
 * band) that differ from the band's most common line, grouped into runs. */
function lineGroups(n,key){
 const counts=new Map(),keys=[];
 for(let i=0;i<n;i++){const k=key(i);keys.push(k);counts.set(k,(counts.get(k)||0)+1);}
 let mode=null,best=-1;for(const [k,c] of counts)if(c>best){best=c;mode=k;}
 const runs=[];let s=-1;
 for(let i=0;i<=n;i++){const off=i<n&&keys[i]!==mode;if(off&&s<0)s=i;else if(!off&&s>=0){runs.push([s,i-1]);s=-1;}}
 return {distinct:counts.size,modal:best,runs};
}
const hashCol=(d,w,x,y0,y1)=>{let s='';for(let y=y0;y<y1;y++){const i=(y*w+x)*4;s+=d[i]+','+d[i+1]+','+d[i+2]+','+d[i+3]+';';}return s;};
const hashRow=(d,w,y,x0,x1)=>Array.prototype.join.call(d.subarray((y*w+x0)*4,(y*w+x1)*4),',');
const maxStep=(d,w,h,axis,a,b,lo,hi)=>{let m=0;for(let t=lo;t<hi;t++){const i=axis==='x'?(t*w+a)*4:(a*w+t)*4,j=axis==='x'?(t*w+b)*4:(b*w+t)*4;for(let c=0;c<4;c++)m=Math.max(m,Math.abs(d[i+c]-d[j+c]));}return m;};
/** Issues a 9-slice will show when it is stretched or tiled:
 *  gradient   the stretched band is not made of identical lines (a gradient or art in the middle):
 *             stretching distorts it. Tile mode is fine only if the band repeats seamlessly.
 *  cut-corner a corner's art continues past the guide into the stretched band, so part of the
 *             corner will be stretched (the corner is smaller than its art): move the guide.
 *  seam       tile mode: the band's last and first lines do not continue each other.
 *  padding    content padding leaves no room for content.
 *  empty      the whole element is transparent. */
export function validateNine(data,w,h,nine){
 const n=normalizeNine(nine,w,h),{left:L,right:R,top:T,bottom:B}=n.border,issues=[];
 const mw=w-L-R,mh=h-T-B;
 let any=false;for(let i=3;i<data.length;i+=4)if(data[i]){any=true;break;}
 if(!any)return [{code:'empty',severity:'error'}];
 // horizontal: columns L…w-R-1 over all rows must be identical to stretch
 if(mw>1&&(L||R||n.stretch.h!=='stretch'||mh<h)){
  const g=lineGroups(mw,i=>hashCol(data,w,L+i,0,h));
  if(g.distinct>1){
   if(n.stretch.h==='stretch'){
    const step=Math.max(...Array.from({length:mw-1},(_,i)=>maxStep(data,w,h,'x',L+i,L+i+1,0,h)));
    issues.push({code:'gradient',axis:'h',severity:'warning',distinct:g.distinct,maxStep:step,columns:g.runs.map(([a,b])=>[L+a,L+b])});
   }
   // non-modal columns glued to a guide = corner art cut by the guide
   const first=g.runs[0],last=g.runs.at(-1);
   if(first&&first[0]===0&&first[1]<mw-1&&g.modal>=mw*.5)issues.push({code:'cut-corner',side:'left',severity:'warning',columns:first[1]+1,suggest:L+first[1]+1});
   if(last&&last[1]===mw-1&&last[0]>0&&g.modal>=mw*.5)issues.push({code:'cut-corner',side:'right',severity:'warning',columns:mw-last[0],suggest:R+mw-last[0]});
  }
  if(n.stretch.h!=='stretch'&&mw>1){const seam=maxStep(data,w,h,'x',L+mw-1,L,0,h),inner=mw>2?Math.max(...Array.from({length:mw-1},(_,i)=>maxStep(data,w,h,'x',L+i,L+i+1,0,h))):0;if(seam>Math.max(24,inner*1.5))issues.push({code:'seam',axis:'h',severity:'warning',step:seam,inner});}
 }
 if(mh>1&&(T||B||n.stretch.v!=='stretch'||mw<w)){
  const g=lineGroups(mh,i=>hashRow(data,w,T+i,0,w));
  if(g.distinct>1){
   if(n.stretch.v==='stretch'){
    const step=Math.max(...Array.from({length:mh-1},(_,i)=>maxStep(data,w,h,'y',T+i,T+i+1,0,w)));
    issues.push({code:'gradient',axis:'v',severity:'warning',distinct:g.distinct,maxStep:step,rows:g.runs.map(([a,b])=>[T+a,T+b])});
   }
   const first=g.runs[0],last=g.runs.at(-1);
   if(first&&first[0]===0&&first[1]<mh-1&&g.modal>=mh*.5)issues.push({code:'cut-corner',side:'top',severity:'warning',rows:first[1]+1,suggest:T+first[1]+1});
   if(last&&last[1]===mh-1&&last[0]>0&&g.modal>=mh*.5)issues.push({code:'cut-corner',side:'bottom',severity:'warning',rows:mh-last[0],suggest:B+mh-last[0]});
  }
  if(n.stretch.v!=='stretch'&&mh>1){const seam=maxStep(data,w,h,'y',T+mh-1,T,0,w),inner=mh>2?Math.max(...Array.from({length:mh-1},(_,i)=>maxStep(data,w,h,'y',T+i,T+i+1,0,w))):0;if(seam>Math.max(24,inner*1.5))issues.push({code:'seam',axis:'v',severity:'warning',step:seam,inner});}
 }
 const p=effectivePadding(n);
 if(p.left+p.right>=w||p.top+p.bottom>=h)issues.push({code:'padding',severity:'error',room:{w:w-p.left-p.right,h:h-p.top-p.bottom}});
 return issues;
}
// ------------------------------------------------------------------ the draw plan
/** One axis: [{s0,s1,d0,d1,c0,c1}] spans. Source span [s0,s1) is mapped linearly onto destination
 * [d0,d1); only [c0,c1) of it is drawn (a clipped last tile). Destination units are target pixels. */
function axisSpans(n,lo,hi,D,scale,mode,anchor){
 const out=[],mid=n-lo-hi;
 let a=Math.round(lo*scale),b=Math.round(hi*scale),warn=null;
 if(a+b>D){warn={need:a+b,got:D};const k=a+b?D*a/(a+b):0;a=Math.floor(k);b=D-a;}
 const push=(k,s0,s1,d0,d1,c0=d0,c1=d1)=>{if(s1>s0&&c1>c0)out.push({k,s0,s1,d0,d1,c0,c1});};
 push(0,0,lo,0,a);
 const i0=a,i1=D-b,inner=i1-i0;
 if(mid>0&&inner>0){
  const tile=mid*scale;
  if(mode==='stretch'||tile<=0)push(1,lo,lo+mid,i0,i1);
  else if(mode==='tile-fit'){const count=Math.max(1,Math.round(inner/tile));for(let k=0;k<count;k++)push(1,lo,lo+mid,i0+Math.round(k*inner/count),i0+Math.round((k+1)*inner/count));}
  else{
   // natural-size tiles; `anchor` decides where the partial tile goes: 'start' = whole tiles
   // from the start edge, clipped at the end; 'end' = the mirror; 'center' = one tile centred
   // (CSS border-image `repeat`), partial tiles at both ends
   let start=i0;
   if(anchor==='end')start=i1-Math.ceil(inner/tile)*tile;
   else if(anchor==='center'){const c=i0+(inner-tile)/2;start=c-Math.ceil((c-i0)/tile-1e-9)*tile;}
   for(let d=start;d<i1-1e-9;d+=tile){const d0=Math.round(d),d1=Math.round(d+tile);push(1,lo,lo+mid,d0,d1,Math.max(i0,d0),Math.min(i1,d1));}
  }
 }
 push(2,n-hi,n,D-b,D);
 return {spans:out,warn,effective:[a,b]};
}
const REGION=[['top-left','top','top-right'],['left','center','right'],['bottom-left','bottom','bottom-right']];
/** Draw plan for one target size. `scale` is the DPI / UI scale (1, 2, 3, or fractional such as
 * 1.5): corners are drawn at round(border × scale) pixels, tiles at their natural size × scale.
 * Ops: {region, sx,sy,sw,sh, dx,dy,dw,dh, clip:{x,y,w,h}} — source rect (element pixels) mapped
 * onto the destination rect, drawn only inside `clip`. */
export function ninePlan(size,nine,targetW,targetH,{scale=1,anchor='start',anchorV=anchor}={}){
 const w=size.w,h=size.h,n=normalizeNine(nine,w,h);checkBorders(n.border,w,h);
 const tw=Math.round(targetW),th=Math.round(targetH);
 if(!(tw>=1&&th>=1))throw Error('Target size must be at least 1×1');
 if(!(scale>0))throw Error('Scale must be positive');
 const X=axisSpans(w,n.border.left,n.border.right,tw,scale,n.stretch.h,anchor),Y=axisSpans(h,n.border.top,n.border.bottom,th,scale,n.stretch.v,anchorV);
 const ops=[];
 for(const y of Y.spans)for(const x of X.spans){
  const region=REGION[y.k][x.k];
  if(region==='center'&&!n.drawCenter)continue;
  ops.push({region,sx:x.s0,sy:y.s0,sw:x.s1-x.s0,sh:y.s1-y.s0,dx:x.d0,dy:y.d0,dw:x.d1-x.d0,dh:y.d1-y.d0,clip:{x:x.c0,y:y.c0,w:x.c1-x.c0,h:y.c1-y.c0}});
 }
 const warnings=[];
 if(X.warn)warnings.push({code:'narrow',...X.warn});
 if(Y.warn)warnings.push({code:'short',...Y.warn});
 if(!Number.isInteger(scale)&&[n.border.left,n.border.right,n.border.top,n.border.bottom].some(v=>v&&!Number.isInteger(v*scale)))warnings.push({code:'fractional',scale});
 return {ops,warnings,targetW:tw,targetH:th,scale,nine:n,effective:{left:X.effective[0],right:X.effective[1],top:Y.effective[0],bottom:Y.effective[1]}};
}
/** Reference renderer: nearest sampling at destination pixel centres, exactly the plan. */
export function renderPlan(src,w,h,plan){
 if(src.length!==w*h*4)throw Error('Invalid RGBA data');
 const W=plan.targetW,H=plan.targetH,out=new Uint8ClampedArray(W*H*4);
 for(const o of plan.ops){
  const cx0=Math.max(0,o.clip.x),cy0=Math.max(0,o.clip.y),cx1=Math.min(W,o.clip.x+o.clip.w),cy1=Math.min(H,o.clip.y+o.clip.h);
  for(let y=cy0;y<cy1;y++){
   const sy=o.sy+Math.min(o.sh-1,Math.floor((y-o.dy+.5)*o.sh/o.dh));
   for(let x=cx0;x<cx1;x++){
    const sx=o.sx+Math.min(o.sw-1,Math.floor((x-o.dx+.5)*o.sw/o.dw)),i=(sy*w+sx)*4,j=(y*W+x)*4;
    out[j]=src[i];out[j+1]=src[i+1];out[j+2]=src[i+2];out[j+3]=src[i+3];
   }
  }
 }
 return out;
}
/** Where content goes inside a target of this size (after padding, at this scale). */
export function contentRect(nine,size,targetW,targetH,scale=1){
 const n=normalizeNine(nine,size.w,size.h),p=effectivePadding(n);
 const l=Math.round(p.left*scale),r=Math.round(p.right*scale),t=Math.round(p.top*scale),b=Math.round(p.bottom*scale);
 return {x:l,y:t,w:Math.max(0,targetW-l-r),h:Math.max(0,targetH-t-b)};
}
/** Smallest target that shows every corner at full size (at a scale). */
export const minimumTarget=(nine,scale=1)=>({w:Math.round(nine.border.left*scale)+Math.round(nine.border.right*scale),h:Math.round(nine.border.top*scale)+Math.round(nine.border.bottom*scale)});
// ------------------------------------------------------------------ Android .9.png
const isMark=(d,i)=>d[i]===0&&d[i+1]===0&&d[i+2]===0&&d[i+3]===255;
/** Android 9-patch: the image plus a 1-px frame. Top/left black lines = stretchable band, bottom/
 * right = content (padding). Android allows several stretch runs per side; this format has one. */
export function toNinePatchPNG(data,w,h,nine){
 const n=normalizeNine(nine,w,h),W=w+2,H=h+2,out=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<h;y++)out.set(data.subarray(y*w*4,(y+1)*w*4),((y+1)*W+1)*4);
 const mark=(x,y)=>out.set([0,0,0,255],(y*W+x)*4);
 const b=n.border,{left:L,right:R,top:T,bottom:B}=b;
 // A side with no border still needs a mark: the whole axis stretches (Android requires ≥ 1 run).
 for(let x=L;x<w-R;x++)mark(x+1,0);if(w-R<=L)for(let x=0;x<w;x++)mark(x+1,0);
 for(let y=T;y<h-B;y++)mark(0,y+1);if(h-B<=T)for(let y=0;y<h;y++)mark(0,y+1);
 const p=effectivePadding(n);
 for(let x=p.left;x<w-p.right;x++)mark(x+1,H-1);
 for(let y=p.top;y<h-p.bottom;y++)mark(W-1,y+1);
 return {data:out,width:W,height:H};
}
/** Reads a .9.png (RGBA of the whole file image). Several stretch runs on one side are reported
 * (`runs`), and the border becomes the outermost run's ends, since Studio 9-slices have one band. */
export function fromNinePatchPNG(data,W,H){
 if(W<3||H<3||data.length!==W*H*4)throw Error('A .9.png needs a 1-pixel frame around the image');
 const w=W-2,h=H-2;
 const runs=(len,at)=>{const r=[];let s=-1;for(let i=0;i<=len;i++){const on=i<len&&isMark(data,at(i));if(on&&s<0)s=i;else if(!on&&s>=0){r.push([s,i-1]);s=-1;}}return r;};
 const bad=[];
 const check=(len,at,label)=>{for(let i=0;i<len;i++){const k=at(i);if(data[k+3]&&!isMark(data,k)&&!(data[k]===255&&data[k+1]===0&&data[k+2]===0&&data[k+3]===255))bad.push(label);}};
 const top=runs(w,i=>(i+1)*4),left=runs(h,i=>((i+1)*W)*4),bottom=runs(w,i=>((H-1)*W+i+1)*4),right=runs(h,i=>((i+1)*W+W-1)*4);
 check(w,i=>(i+1)*4,'top');check(h,i=>((i+1)*W)*4,'left');check(w,i=>((H-1)*W+i+1)*4,'bottom');check(h,i=>((i+1)*W+W-1)*4,'right');
 if(!top.length||!left.length)throw Error('This .9.png has no stretch marks on its top or left edge');
 const border={left:top[0][0],right:w-1-top.at(-1)[1],top:left[0][0],bottom:h-1-left.at(-1)[1]};
 const padding=bottom.length&&right.length?{left:bottom[0][0],right:w-1-bottom.at(-1)[1],top:right[0][0],bottom:h-1-right.at(-1)[1]}:null;
 const image=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)image.set(data.subarray(((y+1)*W+1)*4,((y+1)*W+1+w)*4),y*w*4);
 return {image,width:w,height:h,nine:normalizeNine({border,padding},w,h),runs:{top:top.length,left:left.length,bottom:bottom.length,right:right.length},invalidMarks:[...new Set(bad)]};
}
