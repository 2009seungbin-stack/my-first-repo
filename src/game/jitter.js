/** Measuring and removing frame wobble, plus the checks that catch a bad frame list.
 *
 * Hand-drawn or badly sliced animations wander by a pixel or two per frame. This module measures
 * where each frame's artwork actually sits (alpha centroid, bounding-box centre, bounding-box
 * bottom, declared pivot), reports the frame-to-frame series a graph can draw, and can put the
 * frames back in line — by changing integer offsets only. No pixel is ever resampled, so a
 * pixel-art sprite comes out of the fix bit-identical, just placed differently on its canvas.
 *
 * Nothing here knows what a foot is. `bottom-center` is the middle of the lowest opaque row: a
 * cape, a shadow or a dust puff below the feet moves it. */
import {source,boundsIn,innerRect,hashBytes,ALPHA_THRESHOLD} from './pixels.js';
import {pivotPixels,playbackOrder} from './model.js';
import {shiftFrame} from './frame-ops.js';
export const REFERENCES=Object.freeze(['pivot','bottom-center','bounds-centre','alpha-centroid']);
const ALIAS={'bottom-centre':'bottom-center','bounds-center':'bounds-centre','centroid':'alpha-centroid'};
export const resolveReference=r=>{const key=ALIAS[r]||r;if(!REFERENCES.includes(key))throw Error(`Unknown reference ${r}; use one of ${REFERENCES.join(', ')}`);return key;};
const rms=a=>a.length?Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length):0;
const maxAbs=a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
/** The frame's canvas as RGBA: transparent everywhere except where its pixels sit. One frame at a
 * time — this is the only place that allocates a whole frame canvas. */
export function canvasImage(src,f){
 const s=source(src),inner=innerRect(f),img=s.read(inner),out=new Uint8ClampedArray(f.canvasWidth*f.canvasHeight*4);
 for(let y=0;y<inner.h;y++){const from=y*inner.w*4;out.set(img.data.subarray(from,from+inner.w*4),((f.offsetY+y)*f.canvasWidth+f.offsetX)*4);}
 return {data:out,width:f.canvasWidth,height:f.canvasHeight};
}
/** Where one frame's artwork sits on its own canvas. Coordinates are canvas pixels with the pixel
 * grid's corners as integers, so a 4px-wide box starting at x=2 has its centre at 4. */
export function frameAnchors(src,f,{threshold=ALPHA_THRESHOLD}={}){
 const s=source(src),inner=innerRect(f),img=s.read(inner);
 let x0=inner.w,y0=inner.h,x1=-1,y1=-1,sum=0,sx=0,sy=0,opaque=0;
 for(let y=0;y<inner.h;y++)for(let x=0;x<inner.w;x++){
  const a=img.data[(y*inner.w+x)*4+3];
  if(a<=threshold)continue;
  opaque++;sum+=a;sx+=a*(x+.5);sy+=a*(y+.5);
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
 }
 const pivot=pivotPixels(f);
 if(x1<0)return {id:f.id,name:f.name,bbox:null,opaque:0,alphaSum:0,coverage:0,pivot,alphaCentroid:null,boundsCentre:null,bottom:null,blank:true};
 const bbox={x:f.offsetX+x0,y:f.offsetY+y0,w:x1-x0+1,h:y1-y0+1};
 return {id:f.id,name:f.name,bbox,opaque,alphaSum:sum,coverage:opaque/(f.canvasWidth*f.canvasHeight),pivot,blank:false,
  alphaCentroid:{x:f.offsetX+sx/sum,y:f.offsetY+sy/sum},
  boundsCentre:{x:bbox.x+bbox.w/2,y:bbox.y+bbox.h/2},
  bottom:{x:bbox.x+bbox.w/2,y:bbox.y+bbox.h}};
}
export function anchorPoint(a,reference){
 const key=resolveReference(reference);
 const point=key==='pivot'?a.pivot:key==='bottom-center'?a.bottom:key==='bounds-centre'?a.boundsCentre:a.alphaCentroid;
 if(!point)throw Error(`${a.name||a.id} is blank, so it has no ${key}`);
 return point;
}
/** The frames of one animation in playback order, or the list as given. */
export function orderedFrames(frames,{animation=null,order=null}={}){
 const byId=new Map(frames.map(f=>[f.id,f]));
 const ids=order||(animation?playbackOrder(animation):frames.map(f=>f.id));
 return ids.map(id=>{const f=byId.get(id);if(!f)throw Error(`Unknown frame ${id}`);return f;});
}
export function anchorSeries(src,frames,options={}){
 return orderedFrames(frames,options).map(f=>frameAnchors(src,f,options));
}
/** The intended path through a noisy series. The window shrinks at the ends so the first and last
 * frames are not dragged toward the middle.
 * mode 'quadratic' (default) fits a local parabola by least squares — a Savitzky-Golay filter —
 * which passes a smooth bob or arc through almost unchanged (gain ≈ 0.998 for a 16-frame sine at
 * window 5) while still averaging the noise away. mode 'mean' is a plain moving average, which
 * flattens curved motion by about a sixth at the same window. */
export function smooth(values,window=5,{mode='quadratic'}={}){
 if(!Number.isSafeInteger(window)||window<1)throw Error('Smoothing window must be a positive integer');
 if(!['quadratic','mean'].includes(mode))throw Error(`Unknown smoothing mode ${mode}`);
 const half=Math.floor(window/2);
 return values.map((_,i)=>{
  const from=Math.max(0,i-half),to=Math.min(values.length,i+half+1);
  if(mode==='mean'||to-from<3)return mean(values.slice(from,to));
  let n=0,t=0,t2=0,t3=0,t4=0,y=0,ty=0,t2y=0;
  for(let j=from;j<to;j++){const d=j-i,v=values[j];n++;t+=d;t2+=d*d;t3+=d**3;t4+=d**4;y+=v;ty+=d*v;t2y+=d*d*v;}
  // Normal equations for y = a + b·t + c·t²; the fitted value at t=0 is a.
  const m=[[n,t,t2],[t,t2,t3],[t2,t3,t4]],r=[y,ty,t2y];
  const det=m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  if(!det)return mean(values.slice(from,to));
  return (r[0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(r[1]*m[2][2]-m[1][2]*r[2])+m[0][2]*(r[1]*m[2][1]-m[1][1]*r[2]))/det;
 });
}
/** @returns {reference, points, deltas, series, metrics, residual, warnings} — `metrics` describes
 * the frame-to-frame movement (which includes deliberate motion) and `residual` describes only the
 * high-frequency part left after smoothing, which is what "jitter" means. */
export function jitterReport(src,frames,{reference='bottom-center',warnPx=1.5,window=5,...options}={}){
 const key=resolveReference(reference),anchors=anchorSeries(src,frames,options);
 const usable=anchors.filter(a=>!a.blank);
 if(usable.length<2)throw Error('Measuring jitter needs at least two non-blank frames.');
 const points=usable.map(a=>({id:a.id,name:a.name,...anchorPoint(a,key)}));
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const deltas=points.slice(1).map((p,i)=>({id:p.id,name:p.name,dx:p.x-points[i].x,dy:p.y-points[i].y}));
 const dx=deltas.map(d=>d.dx),dy=deltas.map(d=>d.dy);
 const sx=smooth(xs,window),sy=smooth(ys,window),rx=xs.map((v,i)=>v-sx[i]),ry=ys.map((v,i)=>v-sy[i]);
 const metrics={maxX:maxAbs(dx),maxY:maxAbs(dy),max:Math.max(maxAbs(dx),maxAbs(dy)),rmsX:rms(dx),rmsY:rms(dy),
  rms:Math.sqrt((rms(dx)**2+rms(dy)**2)/2),meanAbsX:mean(dx.map(Math.abs)),meanAbsY:mean(dy.map(Math.abs))};
 const residual={maxX:maxAbs(rx),maxY:maxAbs(ry),max:Math.max(maxAbs(rx),maxAbs(ry)),rmsX:rms(rx),rmsY:rms(ry),rms:Math.sqrt((rms(rx)**2+rms(ry)**2)/2)};
 const warnings=[];
 if(residual.max>warnPx)warnings.push(`Frames wander up to ${residual.max.toFixed(1)}px off a smooth path (${key}); over ${warnPx}px is visible as shake.`);
 if(anchors.some(a=>a.blank))warnings.push(`${anchors.filter(a=>a.blank).length} blank frame(s) were skipped.`);
 if(key==='pivot'&&new Set(points.map(p=>`${p.x},${p.y}`)).size===1)warnings.push('Every frame declares the same pivot, so this reference cannot show wobble — measure the artwork instead.');
 return {reference:key,points,deltas,series:{x:xs,y:ys,smoothX:sx,smoothY:sy,residualX:rx,residualY:ry},metrics,residual,warnings,warnPx};
}
/** Puts the frames back in line by changing integer offsets only.
 * @param reference      which anchor to hold still (see REFERENCES)
 * @param preserveTrend  false pins every frame to `anchorIndex`'s position — a deliberate pan or
 *                       bob is flattened along with the jitter. true removes only the wobble
 *                       around a smoothed path, so intended motion survives.
 * @returns {frames, shifts, canvasWidth, canvasHeight, grown, before, after, warnings} */
export function autoFixJitter(src,frames,{reference='bottom-center',preserveTrend=false,window=5,anchorIndex=0,maxShift=64,...options}={}){
 const key=resolveReference(reference),ordered=orderedFrames(frames,options);
 const width=ordered[0]?.canvasWidth,height=ordered[0]?.canvasHeight;
 if(!ordered.length)throw Error('Add at least one frame.');
 if(ordered.some(f=>f.canvasWidth!==width||f.canvasHeight!==height))throw Error('Every frame must share one canvas before jitter can be fixed — normalize the frames first.');
 const before=jitterReport(src,frames,{reference:key,window,...options});
 const anchors=anchorSeries(src,frames,options),live=anchors.map((a,i)=>({a,i})).filter(({a})=>!a.blank);
 const xs=live.map(({a})=>anchorPoint(a,key).x),ys=live.map(({a})=>anchorPoint(a,key).y);
 const targetX=preserveTrend?smooth(xs,window):xs.map(()=>xs[Math.min(anchorIndex,xs.length-1)]);
 const targetY=preserveTrend?smooth(ys,window):ys.map(()=>ys[Math.min(anchorIndex,ys.length-1)]);
 const warnings=[...before.warnings],want=new Map();
 live.forEach(({a},k)=>{
  let dx=Math.round(targetX[k]-xs[k]),dy=Math.round(targetY[k]-ys[k]);
  if(Math.abs(dx)>maxShift||Math.abs(dy)>maxShift){warnings.push(`${a.name||a.id} would move ${dx},${dy}px — clamped to ±${maxShift}px.`);
   dx=Math.max(-maxShift,Math.min(maxShift,dx));dy=Math.max(-maxShift,Math.min(maxShift,dy));}
  want.set(a.id,{dx,dy});
 });
 let left=0,top=0,right=0,bottom=0;
 for(const f of ordered){
  const {dx,dy}=want.get(f.id)||{dx:0,dy:0},inner=innerRect(f);
  left=Math.max(left,-(f.offsetX+dx));top=Math.max(top,-(f.offsetY+dy));
  right=Math.max(right,f.offsetX+dx+inner.w-width);bottom=Math.max(bottom,f.offsetY+dy+inner.h-height);
 }
 left=Math.max(0,left);top=Math.max(0,top);right=Math.max(0,right);bottom=Math.max(0,bottom);
 const canvasWidth=width+left+right,canvasHeight=height+top+bottom,grown=left+top+right+bottom>0;
 if(grown)warnings.push(`The canvas grew to ${canvasWidth}×${canvasHeight} so no frame is clipped.`);
 const shifts=[],fixed=frames.map(f=>{
  const {dx,dy}=want.get(f.id)||{dx:0,dy:0};
  shifts.push({id:f.id,name:f.name,dx,dy});
  return shiftFrame(f,dx+left,dy+top,canvasWidth,canvasHeight);
 });
 const after=jitterReport(src,fixed,{reference:key,window,...options});
 return {frames:fixed,shifts,canvasWidth,canvasHeight,grown,before:before.metrics,after:after.metrics,
  beforeResidual:before.residual,afterResidual:after.residual,reference:key,preserveTrend,warnings};
}
/** Exact content hash plus a coarse silhouette signature for near-duplicate search. */
export function frameSignature(src,f,{threshold=ALPHA_THRESHOLD,hashSize=16}={}){
 const s=source(src),inner=innerRect(f),img=s.read(inner);
 const bits=new Uint8Array(hashSize*hashSize),cover=new Float64Array(hashSize*hashSize);
 let opaque=0;
 for(let y=0;y<inner.h;y++)for(let x=0;x<inner.w;x++){
  if(img.data[(y*inner.w+x)*4+3]<=threshold)continue;
  opaque++;cover[Math.min(hashSize-1,Math.floor(y*hashSize/inner.h))*hashSize+Math.min(hashSize-1,Math.floor(x*hashSize/inner.w))]++;
 }
 const cellArea=inner.w*inner.h/(hashSize*hashSize);
 for(let i=0;i<bits.length;i++)bits[i]=cover[i]>cellArea*.5?1:0;
 return {id:f.id,name:f.name,size:`${inner.w}x${inner.h}`,hash:hashBytes(img.data),bits,
  opaque,coverage:opaque/(f.canvasWidth*f.canvasHeight),blank:!opaque};
}
export const hamming=(a,b)=>{let d=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])d++;return d;};
/** Mean and maximum absolute RGBA difference between two frames, compared on their canvases.
 * Only two frames are held at a time. */
export function framePixelDiff(src,a,b){
 const A=canvasImage(src,a),B=canvasImage(src,b);
 const width=Math.max(A.width,B.width),height=Math.max(A.height,B.height);
 let sum=0,max=0,changed=0,inter=0,union=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const ia=x<A.width&&y<A.height?(y*A.width+x)*4:-1,ib=x<B.width&&y<B.height?(y*B.width+x)*4:-1;
  let worst=0;
  for(let c=0;c<4;c++){const va=ia<0?0:A.data[ia+c],vb=ib<0?0:B.data[ib+c];const d=Math.abs(va-vb);sum+=d;if(d>worst)worst=d;}
  if(worst){changed++;if(worst>max)max=worst;}
  const oa=ia<0?0:A.data[ia+3]>ALPHA_THRESHOLD?1:0,ob=ib<0?0:B.data[ib+3]>ALPHA_THRESHOLD?1:0;
  if(oa||ob)union++;if(oa&&ob)inter++;
 }
 return {width,height,meanDiff:sum/(width*height*4),maxDiff:max,changed,changedRatio:changed/(width*height),
  silhouetteIoU:union?inter/union:1,identical:!changed};
}
/** Duplicate, near-duplicate, blank and almost-empty frames.
 * Exact duplicates are decided by a content hash and then confirmed byte for byte; near-duplicates
 * are found with the coarse silhouette signature and confirmed with a bounded pixel difference. */
export function findDuplicates(src,frames,{threshold=ALPHA_THRESHOLD,hashSize=16,nearBits=6,pixelTolerance=6,almostEmpty=.005,maxPairs=4000}={}){
 const signatures=frames.map(f=>frameSignature(src,f,{threshold,hashSize}));
 const byId=new Map(frames.map(f=>[f.id,f])),groups=new Map();
 signatures.forEach(sig=>{const key=`${sig.size}:${sig.hash}`;(groups.get(key)||groups.set(key,[]).get(key)).push(sig);});
 const exact=[],aliasOf=new Map();
 for(const group of groups.values()){
  if(group.length<2)continue;
  const keep=group[0],duplicates=[];
  for(const other of group.slice(1))if(framePixelDiff(src,byId.get(keep.id),byId.get(other.id)).identical){duplicates.push(other.id);aliasOf.set(other.id,keep.id);}
  if(duplicates.length)exact.push({keep:keep.id,name:keep.name,duplicates});
 }
 const near=[];let pairs=0,truncated=false;
 for(let i=0;i<signatures.length&&!truncated;i++)for(let j=i+1;j<signatures.length;j++){
  const a=signatures[i],b=signatures[j];
  if(a.blank||b.blank||aliasOf.get(b.id)===a.id||a.size!==b.size)continue;
  const bits=hamming(a.bits,b.bits);
  if(bits>nearBits)continue;
  if(++pairs>maxPairs){truncated=true;break;}
  const diff=framePixelDiff(src,byId.get(a.id),byId.get(b.id));
  if(!diff.identical&&diff.meanDiff<=pixelTolerance)near.push({a:a.id,b:b.id,names:[a.name,b.name],hamming:bits,meanDiff:diff.meanDiff,maxDiff:diff.maxDiff,silhouetteIoU:diff.silhouetteIoU});
 }
 return {exact,near,truncated,aliasOf:Object.fromEntries(aliasOf),
  blank:signatures.filter(s=>s.blank).map(s=>s.id),
  almostEmpty:signatures.filter(s=>!s.blank&&s.coverage<almostEmpty).map(s=>({id:s.id,name:s.name,coverage:s.coverage,opaque:s.opaque}))};
}
/** How well the animation loops: the jump from the last frame back to the first. */
export function loopSeam(src,frames,{reference='bottom-center',jumpPx=1.5,minIoU=.75,...options}={}){
 const ordered=orderedFrames(frames,options);
 if(ordered.length<2)throw Error('A loop seam needs at least two frames.');
 const first=ordered[0],last=ordered[ordered.length-1],key=resolveReference(reference);
 const a=frameAnchors(src,first,options),b=frameAnchors(src,last,options);
 const pa=a.blank||b.blank?null:anchorPoint(a,key),pb=a.blank||b.blank?null:anchorPoint(b,key);
 const diff=framePixelDiff(src,last,first),warnings=[];
 const positionDelta=pa?{dx:pa.x-pb.x,dy:pa.y-pb.y,distance:Math.hypot(pa.x-pb.x,pa.y-pb.y)}:null;
 if(diff.identical)warnings.push('The last frame is identical to the first: in a looping animation it plays twice. Drop it or set the direction to ping-pong.');
 if(positionDelta&&positionDelta.distance>jumpPx)warnings.push(`The loop jumps ${positionDelta.distance.toFixed(1)}px at the seam (${key}).`);
 if(diff.silhouetteIoU<minIoU)warnings.push(`First and last silhouettes overlap only ${Math.round(diff.silhouetteIoU*100)}%, so the loop will pop.`);
 return {first:first.id,last:last.id,reference:key,positionDelta,silhouetteIoU:diff.silhouetteIoU,
  meanPixelDiff:diff.meanDiff,maxPixelDiff:diff.maxDiff,changedPixels:diff.changed,identical:diff.identical,warnings};
}
/** Per-pixel difference between two frames as RGBA the UI can draw directly, plus a change mask.
 * mode 'alpha' compares only the silhouette, 'luma' only brightness, 'rgba' every channel. */
export function frameDifference(src,a,b,{mode='rgba',amplify=1,colour=[255,0,90]}={}){
 if(!['rgba','alpha','luma'].includes(mode))throw Error(`Unknown difference mode ${mode}`);
 const A=canvasImage(src,a),B=canvasImage(src,b);
 const width=Math.max(A.width,B.width),height=Math.max(A.height,B.height);
 const data=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
 let changed=0,sum=0,max=0;
 const luma=(d,i)=>i<0?0:(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])*(d[i+3]/255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=y*width+x,ia=x<A.width&&y<A.height?(y*A.width+x)*4:-1,ib=x<B.width&&y<B.height?(y*B.width+x)*4:-1;
  const d=mode==='alpha'?Math.abs((ia<0?0:A.data[ia+3])-(ib<0?0:B.data[ib+3])):mode==='luma'?Math.abs(luma(A.data,ia)-luma(B.data,ib))
   :Math.max(...[0,1,2,3].map(c=>Math.abs((ia<0?0:A.data[ia+c])-(ib<0?0:B.data[ib+c]))));
  sum+=d;if(d>max)max=d;
  if(d>0){changed++;mask[p]=1;data.set([colour[0],colour[1],colour[2],Math.min(255,Math.round(d*amplify))],p*4);}
 }
 return {data,mask,width,height,changed,changedRatio:changed/(width*height),meanDiff:sum/(width*height),maxDiff:max,mode};
}
/** Which frames an onion-skin view should draw behind and in front of frame `index`, and how
 * strongly. Pure numbers: the caller does the drawing. */
export function onionLayers(frames,index,{before=1,after=1,falloff=.5,opacity=.5,animation=null,order=null}={}){
 const ordered=orderedFrames(frames,{animation,order});
 if(!Number.isSafeInteger(index)||index<0||index>=ordered.length)throw Error('Onion skin needs a frame index inside the animation');
 if([before,after].some(v=>!Number.isSafeInteger(v)||v<0||v>16))throw Error('Onion skin shows 0…16 frames either side');
 const out=[];
 for(let k=before;k>=1;k--)if(index-k>=0)out.push({id:ordered[index-k].id,offset:-k,role:'before',opacity:opacity*falloff**(k-1)});
 out.push({id:ordered[index].id,offset:0,role:'current',opacity:1});
 for(let k=1;k<=after;k++)if(index+k<ordered.length)out.push({id:ordered[index+k].id,offset:k,role:'after',opacity:opacity*falloff**(k-1)});
 return out;
}
