/** Canvas tools of the Sprite workspace (Frame view): select/move, pivot, rect / circle / polygon
 * boxes. Every drag is one History step (mergeKey + open while dragging, Escape aborts it).
 * Edits apply to the frames of the current scope (this frame / selected / tag / all), and the
 * same box keeps the same id in every frame it is on. Coordinates snap to whole pixels. */
import * as D from './sprite-doc.js';
import {dragRect,HANDLE_CURSORS} from '../canvas/overlay-math.js';
let seq=0;
const snap=v=>Math.round(v);
export function createTools(W){
 const {t}=W;
 let g=null;// the gesture in progress
 const own=info=>{const h=info.view.hitTest(info);return h?.layer===W.overlay?h:null;};
 const begin=(label)=>({key:'sp'+(++seq),label});
 const push=(fn)=>{W.exec(g.label,fn,{mergeKey:g.key,open:true});};
 const end=()=>{if(g){W.history.close(g.key);g=null;}};
 const abort=()=>{if(g){W.history.abort(g.key)||W.history.close(g.key);g=null;}W.overlay.draft=null;W.overlay.invalidate();};
 const frameOnly=fn=>info=>{if(W.mode()!=='frame'||!W.frame()){W.hint('sp.hint.frameView');return false;}return fn(info);};
 /** Snapshot of box `id` on every frame in scope, for relative moves. */
 function boxStarts(id){const a=W.asset(),ids=W.scopeIds(),cur=W.frame(),tpl=cur.boxes.find(b=>b.id===id);const m=new Map();for(const f of a.frames)if(ids.includes(f.id))m.set(f.id,f.boxes.find(b=>b.id===id)||tpl);return {m,tpl,ids};}
 function moveBox(st,dx,dy,part,handle,index){
  push(d=>D.updateBox(d,W.assetId(),st.ids,g.id,(b,f)=>{const s=st.m.get(f.id)||st.tpl;
   if(part==='body'){if(s.shape==='rect')return {x:s.x+dx,y:s.y+dy};if(s.shape==='circle')return {cx:s.cx+dx,cy:s.cy+dy};return {points:s.points.map(([x,y])=>[x+dx,y+dy])};}
   if(part==='handle')return dragRect(s,handle,dx,dy,{min:1});
   if(part==='radius')return {r:Math.max(.5,s.r+dx)};
   if(part==='vertex')return {points:s.points.map((p,i)=>i===index?[p[0]+dx,p[1]+dy]:p)};
   return {};
  },{fill:true,template:st.tpl}));
 }
 const select={
  cursor(info){if(g?.part==='handle')return HANDLE_CURSORS[g.handle];if(g)return 'move';const h=W.overlay.hover;if(!h)return 'default';return h.part==='handle'?HANDLE_CURSORS[h.handle]:h.part==='radius'?'ew-resize':'move';},
  hover(info){const h=W.mode()==='frame'?own(info):null;if((h&&h.id)!==(W.overlay.hover&&W.overlay.hover.id)||h?.part!==W.overlay.hover?.part){W.overlay.hover=h;W.overlay.invalidate();}},
  leave(){W.overlay.hover=null;W.overlay.invalidate();},
  down(info){
   if(W.mode()==='sheet')return W.sheetTool.down(info);
   if(info.button!==0)return false;
   const h=own(info),p0={x:info.x,y:info.y};
   if(!h){W.setSelection({kind:'none'});return false;}
   if(h.kind==='pivot'){W.setSelection({kind:'pivot'});g={...begin(t('sp.cmd.movePivot')),kind:'pivot',p0,moved:false};return;}
   if(h.kind==='collision'){W.setSelection({kind:'collision',poly:h.poly});if(h.part!=='vertex')return false;
    const f=W.frame();g={...begin(t('sp.cmd.editCollision')),kind:'cvertex',p0,poly:h.poly,index:h.index,start:f.collision[h.poly][h.index]};return;}
   W.setSelection({kind:'box',id:h.id});
   g={...begin(h.part==='body'?t('sp.cmd.moveBox'):t('sp.cmd.resizeBox')),kind:'box',id:h.id,part:h.part,handle:h.handle,index:h.index,p0,st:boxStarts(h.id),moved:false};
  },
  move(info){
   if(W.mode()==='sheet')return W.sheetTool.move(info);
   if(!g)return;const dx=snap(info.x-g.p0.x),dy=snap(info.y-g.p0.y);
   if(!g.moved&&!dx&&!dy)return;g.moved=true;
   if(g.kind==='pivot'){const f=W.frame();push(d=>D.setPivotPx(d,W.assetId(),W.scopeIds(),snap(info.x),snap(info.y)));void f;}
   else if(g.kind==='cvertex'){push(d=>D.setCollisionPoint(d,W.assetId(),[W.frame().id],g.poly,g.index,g.start[0]+dx,g.start[1]+dy));}
   else if(g.kind==='box')moveBox(g.st,dx,dy,g.part,g.handle,g.index);
   info.view.updateCursor();
  },
  up(info){if(W.mode()==='sheet')return W.sheetTool.up(info);end();},
  cancel(info){if(W.mode()==='sheet')return W.sheetTool.cancel(info);abort();},
  get active(){return W.mode()==='sheet'?W.sheetTool.active:!!g;}
 };
 const pivot={
  cursor:()=>'crosshair',
  down:frameOnly(info=>{if(info.button!==0)return false;W.setSelection({kind:'pivot'});g={...begin(t('sp.cmd.setPivot')),kind:'pivot'};
   const x=snap(info.x),y=snap(info.y);push(d=>D.setPivotPx(d,W.assetId(),W.scopeIds(),x,y));}),
  move(info){if(!g)return;const x=snap(info.x),y=snap(info.y);push(d=>D.setPivotPx(d,W.assetId(),W.scopeIds(),x,y));},
  up(){end();},cancel(){abort();},get active(){return !!g;}
 };
 function shapeTool(shape){
  return {
   cursor:()=>'crosshair',
   down:frameOnly(info=>{if(info.button!==0)return false;g={kind:'draw',p0:{x:snap(info.x),y:snap(info.y)}};W.overlay.draft=shape==='rect'?{shape,type:W.boxType(),x:g.p0.x,y:g.p0.y,w:0,h:0}:{shape,type:W.boxType(),cx:g.p0.x,cy:g.p0.y,r:0};W.overlay.invalidate();}),
   move(info){if(!g)return;const x=snap(info.x),y=snap(info.y);
    if(shape==='rect')Object.assign(W.overlay.draft,{x:Math.min(x,g.p0.x),y:Math.min(y,g.p0.y),w:Math.abs(x-g.p0.x),h:Math.abs(y-g.p0.y)});
    else W.overlay.draft.r=Math.max(0,Math.round(Math.hypot(info.x-g.p0.x,info.y-g.p0.y)*2)/2);
    W.overlay.invalidate();},
   up(){const d=W.overlay.draft;W.overlay.draft=null;g=null;W.overlay.invalidate();
    if(!d||(shape==='rect'?d.w<1||d.h<1:d.r<.5))return;
    const spec=shape==='rect'?{shape,type:d.type,x:d.x,y:d.y,w:d.w,h:d.h}:{shape,type:d.type,cx:d.cx,cy:d.cy,r:d.r};
    W.addBox(spec);},
   cancel(){g=null;W.overlay.draft=null;W.overlay.invalidate();},
   get active(){return !!g;}
  };
 }
 const polygon={
  cursor:()=>'crosshair',
  down:frameOnly(info=>{
   if(info.button!==0)return false;
   const p=[snap(info.x),snap(info.y)],d=W.overlay.draft;
   if(d&&d.shape==='polygon'){
    const first=d.points[0],tol=6*info.view.dpr/info.view.view.scale;
    if(d.points.length>=3&&Math.abs(p[0]-first[0])<=tol&&Math.abs(p[1]-first[1])<=tol){finishPolygon();return false;}
    if(!(p[0]===d.points[d.points.length-1][0]&&p[1]===d.points[d.points.length-1][1]))d.points.push(p);
   }else W.overlay.draft={shape:'polygon',type:W.boxType(),points:[p],cursor:p};
   W.overlay.invalidate();return false;
  }),
  hover(info){const d=W.overlay.draft;if(d?.shape==='polygon'){d.cursor=[snap(info.x),snap(info.y)];W.overlay.invalidate();}},
  cancel(){if(W.overlay.draft?.shape==='polygon'){W.overlay.draft=null;W.overlay.invalidate();}},
  get active(){return W.overlay.draft?.shape==='polygon';}
 };
 function finishPolygon(){
  const d=W.overlay.draft;if(!d||d.shape!=='polygon')return false;
  W.overlay.draft=null;W.overlay.invalidate();
  if(d.points.length<3){W.hint('sp.hint.polygonPoints');return true;}
  W.addBox({shape:'polygon',type:d.type,points:d.points});return true;
 }
 function undoPoint(){const d=W.overlay.draft;if(d?.shape!=='polygon')return false;d.points.pop();if(!d.points.length)W.overlay.draft=null;W.overlay.invalidate();return true;}
 return {select,pivot,rect:shapeTool('rect'),circle:shapeTool('circle'),polygon,finishPolygon,undoPoint,drawing:()=>!!W.overlay.draft};
}
