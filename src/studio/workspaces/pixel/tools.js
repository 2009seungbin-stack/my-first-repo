/** Canvas tools of the Pixel workspace (CanvasView tool objects). Aseprite behaviour: left button
 * paints the foreground colour, right button the background colour; Alt held = eyedropper; Shift+click
 * with the pencil draws a straight line from the last point; Shift while dragging a line snaps to
 * pixel-art angles, a rectangle / ellipse to a square / circle; Escape cancels the gesture. Every
 * gesture is ONE undo step, committed when the pointer is released. */
import * as R from '../../pixel/raster.js';
import {Stroke} from '../../pixel/stroke.js';
export function createTools(W){
 let g=null;// gesture in progress
 const px=i=>[Math.floor(i.x),Math.floor(i.y)];
 const inside=(x,y)=>{const r=W.session.rect;return !!r&&x>=0&&y>=0&&x<r.w&&y<r.h;};
 const union=(a,b)=>R.unionRect(a,b);
 /** Stroke options from the context bar for the current tool and button. */
 function strokeFor(tool,info,{shape=false}={}){
  const o=W.opts,right=info.button===2,S=W.session,erase=tool==='eraser';
  const value=erase?(right?W.value('bg'):S.clear):W.value(right?'bg':'fg'),value2=W.value(right?'fg':'bg');
  const ink=erase?(right?'replace':'simple'):o.ink==='dither'?'simple':o.ink;
  return new Stroke(W.layerPlane(),{kind:S.kind,clear:S.clear,ink,value,value2:o.ink==='dither'&&o.ditherSecond==='bg'?value2:null,from:erase&&right?W.value('fg'):null,
   size:o.size,shape:o.brush,pixelPerfect:!shape&&o.pixelPerfect&&tool==='pencil',symmetry:o.symmetry.mode==='none'?null:W.symmetry(),
   dither:o.ink==='dither'&&!erase?{pattern:o.ditherPattern,density:o.ditherDensity/100}:null,ramp:o.ink==='shading'?W.shadingRamp():null,rampDir:right?-1:1,limit:W.selectionMask()});
 }
 function begin(tool,info,{shape=false}={}){
  if(!W.canPaint())return null;
  W.dropFloat();
  const s=strokeFor(tool,info,{shape});
  g={tool,stroke:s,start:px(info),last:px(info),dirty:null,button:info.button,shift:info.shift};
  return g;
 }
 const touch=()=>{const d=g.stroke.dirty;g.dirty=union(g.dirty,d?{...d}:null);if(g.dirty)W.session.refresh(g.dirty,{id:W.layerId(),plane:W.layerPlane()});};
 async function finish(label){
  const st=g;g=null;if(!st)return;
  if(!st.stroke.changed){st.stroke.revert();if(st.dirty)W.session.refresh(st.dirty);return;}
  W.rememberPoint(st.last);
  await W.commitLayer(label,st.dirty);
 }
 function cancel(){if(!g)return;if(g.axis){g=null;return;}if(g.stroke){g.stroke.revert();if(g.dirty)W.session.refresh(g.dirty);}g=null;W.overlayDraft(null);}
 /** Symmetry axes are dragged by their handles just outside the canvas (above it for the vertical
  * axis, left of it for the horizontal one), as in Aseprite; positions snap to half pixels. */
 function axisAt(info){
  const s=W.opts.symmetry;if(s.mode==='none'||!W.session.rect)return null;const a=W.symmetry(),r=W.session.rect,tol=Math.max(1,8/(info.view?.view.scale||1));
  if((s.mode==='x'||s.mode==='both')&&info.y<0&&info.y>-3*tol&&Math.abs(info.x-a.axisX)<=tol)return 'x';
  if((s.mode==='y'||s.mode==='both')&&info.x<0&&info.x>-3*tol&&Math.abs(info.y-a.axisY)<=tol)return 'y';
  void r;return null;
 }
 function axisDown(info){const k=axisAt(info);if(!k)return false;g={axis:k};return true;}
 function axisMove(info){const r=W.session.rect,v=Math.max(0,Math.min(g.axis==='x'?r.w:r.h,Math.round((g.axis==='x'?info.x:info.y)*2)/2));const s=W.opts.symmetry;
  if((g.axis==='x'?s.axisX:s.axisY)!==v){W.setPref('symmetry',{...s,[g.axis==='x'?'axisX':'axisY']:v});W.status('px.status.axis',{v});}}
 /** Alt held with a painting tool: the eyedropper for this click. */
 const altPick=(info)=>{if(!info.alt)return false;W.pick(info,info.button===2?'bg':'fg');return true;};
 // ------------------------------------------------------------------ freehand: pencil, eraser
 const freehand=(tool,label)=>({
  cursor:i=>{const k=i&&!g?axisAt(i):null;return k?(k==='x'?'ew-resize':'ns-resize'):g?.axis?'grabbing':'crosshair';},get active(){return !!g;},
  down(info){if(info.button!==0&&info.button!==2)return false;if(info.button===0&&axisDown(info))return;if(tool!=='eraser'&&altPick(info))return false;
   const last=W.lastPoint();if(!begin(tool,info))return false;const [x,y]=px(info);
   if(info.shift&&last){g.stroke.shape(R.linePoints(last[0],last[1],x,y));g.last=[x,y];g.line=true;}else g.stroke.point(x,y);
   touch();},
  move(info){if(g?.axis){axisMove(info);return;}if(!g||g.line)return;const [x,y]=px(info);g.stroke.point(x,y);g.last=[x,y];touch();},
  up(){if(g?.axis){g=null;return;}return finish(W.t(label));},
  cancel,hover(info){W.brushHover(px(info));},leave(){W.brushHover(null);}
 });
 // ------------------------------------------------------------------ shapes: line, rectangle, ellipse
 const shapeTool=(tool,label)=>({
  cursor:i=>{const k=i&&!g?axisAt(i):null;return k?(k==='x'?'ew-resize':'ns-resize'):g?.axis?'grabbing':'crosshair';},get active(){return !!g;},
  down(info){if(info.button!==0&&info.button!==2)return false;if(info.button===0&&axisDown(info))return;if(altPick(info))return false;if(!begin(tool,info,{shape:true}))return false;this.move(info);},
  move(info){if(g?.axis){axisMove(info);return;}if(!g)return;let [x,y]=px(info);const [x0,y0]=g.start;const fill=tool!=='line'&&W.opts.shapeFill;
   if(info.shift){if(tool==='line')[x,y]=R.snapLineEnd(x0,y0,x,y);else{const d=Math.max(Math.abs(x-x0),Math.abs(y-y0));x=x0+Math.sign(x-x0||1)*d;y=y0+Math.sign(y-y0||1)*d;}}
   const pts=tool==='line'?R.linePoints(x0,y0,x,y):tool==='rect'?R.rectPixels(x0,y0,x,y,fill):R.ellipsePixels(x0,y0,x,y,fill);
   if(fill){g.stroke.revert();g.stroke.pixels(pts);// the outline gets the brush too
    if(W.opts.size>1)for(const p of tool==='rect'?R.rectPixels(x0,y0,x,y):R.ellipsePixels(x0,y0,x,y))g.stroke.stamp(p[0],p[1]);}
   else g.stroke.shape(pts);
   g.last=[x,y];touch();W.status('px.status.shape',{w:Math.abs(x-x0)+1,h:Math.abs(y-y0)+1});},
  up(){if(g?.axis){g=null;return;}return finish(W.t(label));},
  cancel,hover(info){W.brushHover(px(info));},leave(){W.brushHover(null);}
 });
 // ------------------------------------------------------------------ bucket
 const bucket={
  cursor:()=>'crosshair',get active(){return false;},
  down(info){if(info.button!==0&&info.button!==2)return false;if(altPick(info))return false;const [x,y]=px(info);if(!inside(x,y))return false;
   if(!begin('bucket',info,{shape:true}))return false;const o=W.opts,S=W.session;
   const sample=o.sampleMerged?S.mergedPlane():W.layerPlane();
   const {mask}=R.floodMask(W.layerPlane(),x,y,{tolerance:o.tolerance,contiguous:o.contiguous,kind:o.sampleMerged?R.RGBA:S.kind,colorOf:S.kind===R.INDEXED&&!o.sampleMerged?i=>R.unpack(S.rgbaOf(i)):null,sample,limit:W.selectionMask()});
   g.stroke.mask(mask);touch();finish(W.t('px.cmd.fill'));return false;},
 };
 // ------------------------------------------------------------------ eyedropper
 const picker={
  cursor:()=>'copy',get active(){return !!g;},
  down(info){if(info.button!==0&&info.button!==2)return false;g={pick:info.button===2?'bg':'fg'};W.pick(info,g.pick);},
  move(info){if(g)W.pick(info,g.pick);},up(){g=null;},cancel(){g=null;}
 };
 // ------------------------------------------------------------------ selection: marquee, lasso, wand, move
 const combineMode=i=>i.shift&&i.alt?'intersect':i.shift?'add':i.alt?'subtract':'replace';
 const insideSelection=(x,y)=>{const m=W.selectionMask();return !!m&&inside(x,y)&&!!m[y*W.session.rect.w+x];};
 /** Dragging inside the selection (or a floating piece) moves the pixels; Ctrl+drag copies them. */
 const moveGesture=info=>{const [x,y]=px(info);if(!W.canPaint())return false;
  if(!W.floating())W.liftSelection({copy:info.mod});g={kind:'move',from:[x,y],moved:[0,0]};return true;};
 const moveMove=info=>{const [x,y]=px(info),dx=x-g.from[0],dy=y-g.from[1];if(dx!==g.moved[0]||dy!==g.moved[1]){W.moveFloat(dx-g.moved[0],dy-g.moved[1]);g.moved=[dx,dy];}};
 const marquee={
  cursor:i=>i&&!g&&insideSelection(...px(i))&&combineMode(i)==='replace'?'move':'crosshair',get active(){return !!g;},
  down(info){if(info.button!==0)return false;const [x,y]=px(info);
   if(combineMode(info)==='replace'&&(insideSelection(x,y)||W.floatHit(x,y))){if(!moveGesture(info))return false;return;}
   W.dropFloat();g={kind:'rect',start:[x,y],mode:combineMode(info),end:[x,y]};this.move(info);},
  move(info){if(!g)return;if(g.kind==='move'){moveMove(info);return;}let [x,y]=px(info);const [x0,y0]=g.start;
   if(info.shift&&g.mode==='replace'){const d=Math.max(Math.abs(x-x0),Math.abs(y-y0));x=x0+Math.sign(x-x0||1)*d;y=y0+Math.sign(y-y0||1)*d;}
   g.end=[x,y];const r=rectOf(g.start,g.end);W.overlayDraft({kind:'rect',...r});W.status('px.status.selection',{w:r.w,h:r.h});},
  up(){if(!g)return;const st=g;g=null;if(st.kind==='move'){W.floatMoved();return;}W.overlayDraft(null);
   const r=rectOf(st.start,st.end);if(st.mode==='replace'&&r.w===1&&r.h===1&&st.start[0]===st.end[0]&&st.start[1]===st.end[1]){W.deselect();return;}
   const {w,h}=W.session.rect;W.setSelection(R.combineMask(W.selectionMask(),R.maskFromRect(w,h,r),st.mode),W.t('px.cmd.selectRect'));},
  cancel(){if(g?.kind==='move')W.cancelFloat();g=null;W.overlayDraft(null);},hover(){},leave(){}
 };
 const lasso={
  cursor:i=>i&&!g&&insideSelection(...px(i))&&combineMode(i)==='replace'?'move':'crosshair',get active(){return !!g;},
  down(info){if(info.button!==0)return false;const [x,y]=px(info);
   if(combineMode(info)==='replace'&&(insideSelection(x,y)||W.floatHit(x,y))){moveGesture(info);return;}
   W.dropFloat();g={kind:'lasso',points:[[info.x,info.y]],mode:combineMode(info)};W.overlayDraft({kind:'poly',points:g.points});},
  move(info){if(!g)return;if(g.kind==='move'){moveMove(info);return;}const p=g.points[g.points.length-1];if(Math.hypot(info.x-p[0],info.y-p[1])>=.5){g.points.push([info.x,info.y]);W.overlayDraft({kind:'poly',points:g.points});}},
  up(){if(!g)return;const st=g;g=null;if(st.kind==='move'){W.floatMoved();return;}W.overlayDraft(null);
   const {w,h}=W.session.rect;if(st.points.length<3){if(st.mode==='replace')W.deselect();return;}
   W.setSelection(R.combineMask(W.selectionMask(),R.maskFromPolygon(w,h,st.points),st.mode),W.t('px.cmd.selectLasso'));},
  cancel(){if(g?.kind==='move')W.cancelFloat();g=null;W.overlayDraft(null);},hover(){},leave(){}
 };
 const wand={
  cursor:i=>i&&!g&&insideSelection(...px(i))&&combineMode(i)==='replace'?'move':'crosshair',get active(){return !!g;},
  down(info){if(info.button!==0)return false;const [x,y]=px(info);
   if(combineMode(info)==='replace'&&(insideSelection(x,y)||W.floatHit(x,y))&&info.mod){moveGesture(info);return;}
   if(!inside(x,y))return false;W.dropFloat();const o=W.opts,S=W.session,sample=o.sampleMerged?S.mergedPlane():W.layerPlane();
   const {mask}=R.floodMask(sample,x,y,{tolerance:o.tolerance,contiguous:o.contiguous,kind:o.sampleMerged?R.RGBA:S.kind,colorOf:S.kind===R.INDEXED&&!o.sampleMerged?i=>R.unpack(S.rgbaOf(i)):null});
   W.setSelection(R.combineMask(W.selectionMask(),mask,combineMode(info)),W.t('px.cmd.selectWand'));return false;},
  move(info){if(g?.kind==='move')moveMove(info);},up(){if(g?.kind==='move'){g=null;W.floatMoved();}},cancel(){if(g?.kind==='move')W.cancelFloat();g=null;}
 };
 const move={
  cursor:()=>'move',get active(){return !!g;},
  down(info){if(info.button!==0)return false;if(!W.selectionMask()&&!W.floating())W.selectLayerPixels();if(!moveGesture(info))return false;},
  move(info){if(g)moveMove(info);},up(){if(g){g=null;W.floatMoved();}},cancel(){if(g)W.cancelFloat();g=null;}
 };
 return {pencil:freehand('pencil','px.tool.pencil'),eraser:freehand('eraser','px.tool.eraser'),line:shapeTool('line','px.tool.line'),rect:shapeTool('rect','px.tool.rect'),ellipse:shapeTool('ellipse','px.tool.ellipse'),
  bucket,picker,marquee,lasso,wand,move,busy:()=>!!g,cancel};
}
const rectOf=(a,b)=>({x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),w:Math.abs(a[0]-b[0])+1,h:Math.abs(a[1]-b[1])+1});
