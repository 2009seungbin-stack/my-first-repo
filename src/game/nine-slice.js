/** Nine-slice (9-patch) geometry: border validation, border suggestion from pixels, and the
 * draw plan that both the preview and the export render from, so a corner on screen is the
 * corner in the file. Pure: pixel arrays and integers in, integers out. No DOM.
 *
 * Border numbers are always pixels on the source image: left/right measured from those edges,
 * top/bottom likewise. Every engine mapping (Godot patch_margin_*, Unity L/B/R/T) is derived
 * from those four numbers in engineBorders(), never stored twice. */
const int=(v,name)=>{if(!Number.isSafeInteger(v)||v<0)throw Error(`${name} must be a non-negative integer`);return v;};
export function borders(b={},w,h){
 const left=int(b.left??0,'left'),right=int(b.right??0,'right'),top=int(b.top??0,'top'),bottom=int(b.bottom??0,'bottom');
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1)throw Error('Invalid image size');
 if(left+right>w)throw Error('Left and right borders do not fit the image width');
 if(top+bottom>h)throw Error('Top and bottom borders do not fit the image height');
 return {left,right,top,bottom};
}
/** Keeps four hand-edited or dragged numbers inside the image: the opposite side is clamped to
 * the image first, then this side to whatever room is left, so a guide can never cross another. */
export function clampBorders(b,w,h){
 const fit=(v,room)=>Math.max(0,Math.min(Math.round(Number(v)||0),room));
 const right=fit(b.right,w),bottom=fit(b.bottom,h),left=fit(b.left,w-right),top=fit(b.top,h-bottom);
 return {left,right:fit(b.right,w-left),top,bottom:fit(b.bottom,h-top)};
}
/** The longest run of consecutive identical columns (and rows) is the region that can be
 * stretched without changing how the panel looks; the borders are what is left outside it.
 * This is a suggestion: a panel whose middle is a gradient has no such run, and `confident`
 * says so instead of inventing numbers. */
export function suggestBorders(data,w,h,{tolerance=0}={}){
 if(data.length!==w*h*4)throw Error('Invalid RGBA data');
 const same=(a,b,step,count)=>{for(let k=0;k<count;k++){const i=(a+k*step)*4,j=(b+k*step)*4;
  for(let c=0;c<4;c++)if(Math.abs(data[i+c]-data[j+c])>tolerance)return false;}return true;};
 const run=(n,equal)=>{// longest block [start,end] of identical lines; end is inclusive
  let best={start:0,end:-1,length:0},s=0;
  for(let i=0;i<n-1;i++){
   if(equal(i,i+1))continue;
   if(i-s+1>best.length)best={start:s,end:i,length:i-s+1};
   s=i+1;
  }
  if(n-s>best.length)best={start:s,end:n-1,length:n-s};
  return best;
 };
 const cols=run(w,(a,b)=>same(a,b,w,h)),rows=run(h,(a,b)=>same(a*w,b*w,1,w));
 const wide=cols.length>=2,tall=rows.length>=2;
 return {left:wide?cols.start:0,right:wide?w-1-cols.end:0,top:tall?rows.start:0,bottom:tall?h-1-rows.end:0,
  columnRun:cols.length,rowRun:rows.length,confident:wide&&tall&&cols.length>=3&&rows.length>=3};
}
/** Draw plan for one target size. Every op is a source rect → destination rect in device
 * pixels; `region` names which of the nine it is. Corners keep their exact source size
 * (scaled by an integer `scale`), so they are never resampled. Edges stretch, or tile at
 * their natural size when mode is 'tile'. */
export function nineSlicePlan(source,border,targetW,targetH,{mode='stretch',scale=1}={}){
 const w=int(source.w,'source.w'),h=int(source.h,'source.h'),b=borders(border,w,h);
 const sc=int(scale,'scale')||1,tw=int(targetW,'targetW'),th=int(targetH,'targetH');
 if(!['stretch','tile'].includes(mode))throw Error('Unknown nine-slice mode');
 if(tw<1||th<1)throw Error('Target size must be at least 1×1');
 const warnings=[],ops=[];
 let L=b.left*sc,R=b.right*sc,T=b.top*sc,B=b.bottom*sc;
 // A target narrower than its own corners cannot show them at full size; engines squash them
 // too, so the plan does the same and says it out loud rather than drawing outside the box.
 if(L+R>tw){warnings.push({code:'narrow',need:L+R,got:tw});const k=L+R?tw*L/(L+R):0;L=Math.floor(k);R=tw-L;}
 if(T+B>th){warnings.push({code:'short',need:T+B,got:th});const k=T+B?th*T/(T+B):0;T=Math.floor(k);B=th-T;}
 const mw=w-b.left-b.right,mh=h-b.top-b.bottom,innerW=tw-L-R,innerH=th-T-B;
 // Tiling a one-pixel middle over a large panel would mean one draw call per pixel; that is a
 // stretch in every practical sense, so the plan says so and stretches instead.
 let plan=mode;
 if(mode==='tile'&&mw>0&&mh>0&&Math.ceil(innerW/(mw*sc))*Math.ceil(innerH/(mh*sc))>4096){warnings.push({code:'tileLimit',tiles:Math.ceil(innerW/(mw*sc))*Math.ceil(innerH/(mh*sc))});plan='stretch';}
 const push=(region,sx,sy,sw,sh,dx,dy,dw,dh)=>{if(sw>0&&sh>0&&dw>0&&dh>0)ops.push({region,sx,sy,sw,sh,dx,dy,dw,dh});};
 const spans=(srcStart,srcSize,destStart,destSize,axisScale)=>{
  // One stretched span, or a row of natural-size tiles with the last one clipped.
  if(plan==='stretch'||srcSize<=0||destSize<=0)return [[srcStart,srcSize,destStart,destSize]];
  const out=[],step=srcSize*axisScale;
  for(let at=0;at<destSize;at+=step){
   const rest=Math.min(step,destSize-at);
   out.push([srcStart,Math.min(srcSize,Math.ceil(rest/axisScale)),destStart+at,rest]);
  }
  return out;
 };
 push('top-left',0,0,b.left,b.top,0,0,L,T);
 push('top-right',w-b.right,0,b.right,b.top,tw-R,0,R,T);
 push('bottom-left',0,h-b.bottom,b.left,b.bottom,0,th-B,L,B);
 push('bottom-right',w-b.right,h-b.bottom,b.right,b.bottom,tw-R,th-B,R,B);
 for(const [sx,sw,dx,dw] of spans(b.left,mw,L,innerW,sc)){
  push('top',sx,0,sw,b.top,dx,0,dw,T);
  push('bottom',sx,h-b.bottom,sw,b.bottom,dx,th-B,dw,B);
 }
 for(const [sy,sh,dy,dh] of spans(b.top,mh,T,innerH,sc)){
  push('left',0,sy,b.left,sh,0,dy,L,dh);
  push('right',w-b.right,sy,b.right,sh,tw-R,dy,R,dh);
 }
 for(const [sy,sh,dy,dh] of spans(b.top,mh,T,innerH,sc))for(const [sx,sw,dx,dw] of spans(b.left,mw,L,innerW,sc))push('center',sx,sy,sw,sh,dx,dy,dw,dh);
 return {ops,warnings,borders:b,effective:{left:L,right:R,top:T,bottom:B},targetW:tw,targetH:th,mode:plan,scale:sc};
}
/** Smallest target that shows every corner at full size. */
export const minimumSize=(b,scale=1)=>({w:(b.left+b.right)*scale,h:(b.top+b.bottom)*scale});
/** The four numbers in every form an engine asks for. Nothing here is engine-specific data:
 * it is the same border repeated in the order and origin each editor's field list uses. */
export function engineBorders(b,w,h){
 const v=borders(b,w,h);
 return {pixels:v,
  normalized:{left:v.left/w,right:v.right/w,top:v.top/h,bottom:v.bottom/h},
  godot4:{patch_margin_left:v.left,patch_margin_right:v.right,patch_margin_top:v.top,patch_margin_bottom:v.bottom},
  unity:{border:[v.left,v.bottom,v.right,v.top],order:'left, bottom, right, top'}};
}
