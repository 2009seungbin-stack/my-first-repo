/** Canvas overlay of the Sprite workspace's Frame view: pivot, hit/hurt/interact/custom boxes
 * (rect, circle, polygon), collision polygons and the shape being drawn. Coordinates are the
 * current frame's canvas pixels (= image pixels of what the view shows). It is a CanvasView layer
 * ({z, draw(g), hit(p)}), drawn on the overlay canvas, never on the image. */
import {boxColor} from './sprite-doc.js';
import {handlePoints,hitHandle,hitRect,hitPolygon,HANDLES} from '../canvas/overlay-math.js';
export const COLLISION_COLOR='#7bd88f',PIVOT_COLOR='#ff5cf0';
export class SpriteOverlay{
 constructor(host){this.host=host;this.z=30;this.view=null;this.visible=true;this.draft=null;this.hover=null;}
 invalidate(){this.view?.invalidate();}
 frame(){return this.host.mode()==='frame'?this.host.frame():null;}
 draw(g){
  const f=this.frame();if(!f||!this.visible)return;
  const {ctx,view:v,dpr}=g,s=v.scale,X=x=>v.x+x*s,Y=y=>v.y+y*s,sel=this.host.selection();
  const lw=Math.max(1,Math.round(dpr));
  // collision polygons
  if(this.host.show('collision'))f.collision.forEach((poly,pi)=>{
   ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.closePath();
   ctx.fillStyle='rgba(123,216,143,.12)';ctx.fill();ctx.setLineDash([4*dpr,3*dpr]);ctx.lineWidth=lw;ctx.strokeStyle=COLLISION_COLOR;ctx.stroke();ctx.setLineDash([]);
   if(sel.kind==='collision'&&sel.poly===pi)for(const [x,y]of poly)square(ctx,X(x),Y(y),3*dpr,COLLISION_COLOR);
  });
  // boxes
  if(this.host.show('boxes'))for(const b of f.boxes){
   const on=sel.kind==='box'&&sel.id===b.id,hov=this.hover?.id===b.id,c=boxColor(b.type);
   ctx.beginPath();
   if(b.shape==='rect')ctx.rect(Math.round(X(b.x))+.5,Math.round(Y(b.y))+.5,Math.round(b.w*s)-1,Math.round(b.h*s)-1);
   else if(b.shape==='circle')ctx.arc(X(b.cx),Y(b.cy),b.r*s,0,Math.PI*2);
   else{b.points.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.closePath();}
   ctx.globalAlpha=on?.26:.16;ctx.fillStyle=c;ctx.fill();ctx.globalAlpha=1;
   ctx.lineWidth=on?2*lw:lw;ctx.strokeStyle='rgba(0,0,0,.55)';ctx.stroke();ctx.lineWidth=on||hov?Math.max(2,2*lw):lw;ctx.strokeStyle=c;ctx.stroke();
   const lx=b.shape==='rect'?X(b.x):b.shape==='circle'?X(b.cx-b.r):X(Math.min(...b.points.map(p=>p[0]))),ly=b.shape==='rect'?Y(b.y):b.shape==='circle'?Y(b.cy-b.r):Y(Math.min(...b.points.map(p=>p[1])));
   const fs=Math.round(10*dpr);if(s*8>=fs*1.4){ctx.font=`600 ${fs}px ui-monospace,Consolas,monospace`;ctx.textBaseline='bottom';const tw=ctx.measureText(b.type).width+4*dpr;ctx.fillStyle=c;ctx.fillRect(lx,ly-fs-3*dpr,tw,fs+3*dpr);ctx.fillStyle='#111';ctx.fillText(b.type,lx+2*dpr,ly-1*dpr);}
   if(on){
    if(b.shape==='rect'){const pts=handlePoints(b);for(const k of HANDLES)square(ctx,X(pts[k][0]),Y(pts[k][1]),3.5*dpr,'#fff','#111');}
    else if(b.shape==='circle'){square(ctx,X(b.cx+b.r),Y(b.cy),3.5*dpr,'#fff','#111');square(ctx,X(b.cx),Y(b.cy),2.5*dpr,c,'#111');}
    else for(const [x,y]of b.points)square(ctx,X(x),Y(y),3.5*dpr,'#fff','#111');
   }
  }
  // pivot
  if(this.host.show('pivot')){
   const px=X(f.pivotX*f.canvasWidth),py=Y(f.pivotY*f.canvasHeight),r=5*dpr,on=sel.kind==='pivot';
   ctx.lineWidth=3*lw;ctx.strokeStyle='rgba(0,0,0,.6)';cross(ctx,px,py,r);ctx.lineWidth=on?2*lw:lw;ctx.strokeStyle=PIVOT_COLOR;cross(ctx,px,py,r);
  }
  // shape being drawn
  const d=this.draft;
  if(d){ctx.lineWidth=lw;ctx.strokeStyle=boxColor(d.type||'hit');ctx.setLineDash([3*dpr,3*dpr]);ctx.beginPath();
   if(d.shape==='rect')ctx.rect(X(d.x)+.5,Y(d.y)+.5,d.w*s,d.h*s);
   else if(d.shape==='circle')ctx.arc(X(d.cx),Y(d.cy),d.r*s,0,Math.PI*2);
   else if(d.shape==='polygon'){d.points.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));if(d.cursor)ctx.lineTo(X(d.cursor[0]),Y(d.cursor[1]));}
   ctx.stroke();ctx.setLineDash([]);
   if(d.shape==='polygon')d.points.forEach(([x,y],i)=>square(ctx,X(x),Y(y),(i?3:4.5)*dpr,i?'#fff':boxColor(d.type||'hit'),'#111'));
  }
 }
 /** What is under image point p: {kind:'pivot'|'box'|'collision', id?, part, handle?, index?, poly?} */
 hit(p,{tol,handleTol}){
  const f=this.frame();if(!f||!this.visible)return null;const sel=this.host.selection();
  if(sel.kind==='box'&&this.host.show('boxes')){const b=f.boxes.find(x=>x.id===sel.id);if(b){
   if(b.shape==='rect'){const h=hitHandle(b,p,handleTol);if(h)return {layer:this,kind:'box',id:b.id,part:'handle',handle:h};}
   else if(b.shape==='circle'){if(Math.abs(p.x-(b.cx+b.r))<=handleTol&&Math.abs(p.y-b.cy)<=handleTol)return {layer:this,kind:'box',id:b.id,part:'radius'};}
   else{const h=hitPolygon(b.points,p,handleTol);if(h?.part==='vertex')return {layer:this,kind:'box',id:b.id,part:'vertex',index:h.index};}
  }}
  if(this.host.show('pivot')){const px=f.pivotX*f.canvasWidth,py=f.pivotY*f.canvasHeight;if(Math.abs(p.x-px)<=handleTol*1.2&&Math.abs(p.y-py)<=handleTol*1.2)return {layer:this,kind:'pivot',part:'body'};}
  if(sel.kind==='collision'&&this.host.show('collision')){const poly=f.collision[sel.poly];if(poly){const h=hitPolygon(poly,p,handleTol);if(h?.part==='vertex')return {layer:this,kind:'collision',poly:sel.poly,part:'vertex',index:h.index};}}
  if(this.host.show('boxes'))for(let i=f.boxes.length-1;i>=0;i--){const b=f.boxes[i];
   const inside=b.shape==='rect'?hitRect(b,p,tol):b.shape==='circle'?Math.hypot(p.x-b.cx,p.y-b.cy)<=b.r+tol:!!hitPolygon(b.points,p,tol);
   if(inside)return {layer:this,kind:'box',id:b.id,part:'body'};}
  if(this.host.show('collision'))for(let i=f.collision.length-1;i>=0;i--){const h=hitPolygon(f.collision[i],p,tol);if(h)return {layer:this,kind:'collision',poly:i,part:h.part,index:h.index};}
  return null;
 }
}
function square(ctx,x,y,r,fill,stroke){ctx.fillStyle=fill;ctx.fillRect(Math.round(x-r),Math.round(y-r),Math.round(2*r),Math.round(2*r));if(stroke){ctx.lineWidth=1;ctx.strokeStyle=stroke;ctx.strokeRect(Math.round(x-r)+.5,Math.round(y-r)+.5,Math.round(2*r)-1,Math.round(2*r)-1);}}
function cross(ctx,x,y,r){ctx.beginPath();ctx.moveTo(x-r*2,y);ctx.lineTo(x+r*2,y);ctx.moveTo(x,y-r*2);ctx.lineTo(x,y+r*2);ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
