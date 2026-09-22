/** Direct manipulation of the rects in a ShapeLayer: click to select (Shift toggles), drag a body
 * to move every selected rect, drag a handle to resize one, drag on empty space for a rubber-band
 * selection — or, when `create()` says so, to draw a new rect. Escape during a drag puts things
 * back. Pure behaviour: it reports intent through callbacks and never edits a document itself.
 *
 *   onSelect(ids)                          selection changed (array of ids)
 *   onChange(map id→rect, {phase, key})    phase 'drag' while moving (same key for the whole
 *                                          gesture, so History merges it into one step), 'end' at
 *                                          release, 'cancel' when Escape restored the start rects
 *   onCreate(rect)                         a new rect was drawn (create mode)
 * Returned object is a CanvasView tool: {down, move, up, cancel, hover, leave, cursor}. */
import {dragRect,moveRects,rectFromPoints,rectsIntersect,HANDLE_CURSORS} from './overlay-math.js';
let gestureSeq=0;
export function rectEditor({layer,bounds,selection,onSelect,onChange,onCreate=null,create=()=>false,minSize=1}){
 let s=null,hoverHit=null;
 const sel=()=>selection();
 const startRects=ids=>new Map(ids.map(id=>[id,{...layer.byId.get(id)}]).filter(([,r])=>r.w));
 const tool={
  cursor(info){
   if(s?.type==='resize')return HANDLE_CURSORS[s.handle];
   if(s?.type==='move')return 'move';
   if(!hoverHit)return create()?'crosshair':'default';
   return hoverHit.part==='handle'?HANDLE_CURSORS[hoverHit.handle]:'move';
  },
  hover(info){hoverHit=info.view.hitTest(info);const own=hoverHit?.layer===layer?hoverHit:null;hoverHit=own;layer.setHover(own?.id||null);},
  leave(){hoverHit=null;layer.setHover(null);},
  down(info){
   if(info.button!==0)return false;
   const hit=info.view.hitTest(info),own=hit?.layer===layer?hit:null,key='drag'+(++gestureSeq);
   const p0={x:info.x,y:info.y};
   if(own?.part==='handle'){s={type:'resize',id:own.id,handle:own.handle,p0,start:startRects([own.id]),key,moved:false};return;}
   if(own){
    let ids=sel();
    if(info.shift){ids=ids.includes(own.id)?ids.filter(i=>i!==own.id):[...ids,own.id];onSelect(ids);if(!ids.includes(own.id)){s=null;return false;}}
    else if(!ids.includes(own.id)){ids=[own.id];onSelect(ids);}
    s={type:'move',ids,p0,start:startRects(ids),key,moved:false};return;
   }
   if(create()){s={type:'create',p0,key};return;}
   s={type:'marquee',p0,base:info.shift?sel():[],prev:sel(),key};
   if(!info.shift&&sel().length)onSelect([]);
  },
  move(info){
   if(!s)return;
   const dx=info.x-s.p0.x,dy=info.y-s.p0.y;
   if(s.type==='move'){
    if(!s.moved&&Math.abs(dx)<.5&&Math.abs(dy)<.5)return;// a click must not nudge
    s.moved=true;const ids=[...s.start.keys()],r=moveRects(ids.map(i=>s.start.get(i)),dx,dy,bounds());
    onChange(new Map(ids.map((id,i)=>[id,r.rects[i]])),{phase:'drag',key:s.key});
   }else if(s.type==='resize'){
    s.moved=true;const r=dragRect(s.start.get(s.id),s.handle,dx,dy,{min:minSize,bounds:bounds()});
    onChange(new Map([[s.id,r]]),{phase:'drag',key:s.key});
   }else{
    const r=rectFromPoints(s.p0,info);s.rect=r;info.view.setMarquee(r);
    if(s.type==='marquee'){const hits=layer.rects.filter(it=>rectsIntersect(it,r)).map(it=>it.id);onSelect([...new Set([...s.base,...hits])]);}
   }
   info.view.updateCursor();
  },
  up(info){
   if(!s)return;const done=s;s=null;info.view.setMarquee(null);
   if((done.type==='move'||done.type==='resize')&&done.moved)onChange(new Map(),{phase:'end',key:done.key});
   if(done.type==='create'&&done.rect&&done.rect.w>=minSize&&done.rect.h>=minSize){
    const b=bounds();const r=done.rect;
    const clipped={x:Math.max(b.x,r.x),y:Math.max(b.y,r.y)};clipped.w=Math.min(b.x+b.w,r.x+r.w)-clipped.x;clipped.h=Math.min(b.y+b.h,r.y+r.h)-clipped.y;
    if(clipped.w>=minSize&&clipped.h>=minSize)onCreate?.(clipped);
   }
   info.view.updateCursor();
  },
  cancel(info){
   if(!s)return;const done=s;s=null;info?.view?.setMarquee(null);
   if((done.type==='move'||done.type==='resize')&&done.moved)onChange(done.start,{phase:'cancel',key:done.key});
   if(done.type==='marquee')onSelect(done.prev);// Escape restores the selection a rubber band replaced
  },
  get active(){return !!s;}
 };
 return tool;
}
