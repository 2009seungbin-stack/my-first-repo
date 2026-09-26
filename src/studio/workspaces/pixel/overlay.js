/** Canvas overlay of the Pixel workspace: marching ants around the selection, the brush footprint
 * under the cursor (with its symmetry mirrors), symmetry axes, the selection / lasso being drawn and
 * the grid the cleanup panel measured. Draws in device pixels on the CanvasView overlay canvas. */
import {maskEdges,brushOffsets,mirrorPoints} from '../../pixel/raster.js';
const PAINT=new Set(['px-pencil','px-eraser','px-line','px-rect','px-ellipse']);
export class PixelOverlay{
 constructor({W,session,S,prefs}){Object.assign(this,{W,session,S,prefs});this.id='px-overlay';this.z=30;this.view=null;this.visible=true;this.mask=null;this.edges=null;this.grid=null;this.dash=0;this.timer=0;}
 invalidate(){this.view?.invalidate();}
 setMask(m){if(m===this.mask)return;this.mask=m;this.edges=null;clearInterval(this.timer);this.timer=0;
  if(m)this.timer=setInterval(()=>{if(!this.view||!document.contains(this.view.stage)){clearInterval(this.timer);this.timer=0;return;}this.dash=(this.dash+1)%8;this.invalidate();},160);this.invalidate();}
 /** Cleanup preview: cut positions (region pixels) drawn as lines. */
 setGrid(g){this.grid=g;this.invalidate();}
 hit(){return null;}
 draw(g){
  const {ctx,view:v,dpr}=g,s=v.scale,r=this.session.rect;if(!r)return;
  const X=x=>Math.round(v.x+x*s)+.5,Y=y=>Math.round(v.y+y*s)+.5;
  // symmetry axes
  const sym=this.prefs.symmetry;
  if(sym.mode!=='none'&&PAINT.has(currentTool(this.W))){
   const ax=sym.axisX??r.w/2,ay=sym.axisY??r.h/2;ctx.save();ctx.setLineDash([6*dpr,4*dpr]);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,90,200,.85)';ctx.beginPath();
   if(sym.mode==='x'||sym.mode==='both'){ctx.moveTo(X(ax),Y(0));ctx.lineTo(X(ax),Y(r.h));}
   if(sym.mode==='y'||sym.mode==='both'){ctx.moveTo(X(0),Y(ay));ctx.lineTo(X(r.w),Y(ay));}
   ctx.stroke();
   // drag handles just outside the canvas (the tools grab them there)
   ctx.setLineDash([]);ctx.fillStyle='rgba(255,90,200,.95)';const k=7*dpr;
   if(sym.mode==='x'||sym.mode==='both'){const x=X(ax),y=Y(0)-3*dpr;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-k,y-k*1.4);ctx.lineTo(x+k,y-k*1.4);ctx.closePath();ctx.fill();}
   if(sym.mode==='y'||sym.mode==='both'){const x=X(0)-3*dpr,y=Y(ay);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-k*1.4,y-k);ctx.lineTo(x-k*1.4,y+k);ctx.closePath();ctx.fill();}
   ctx.restore();
  }
  // cleanup grid
  if(this.grid){ctx.save();ctx.lineWidth=1;ctx.strokeStyle=this.grid.weak?'rgba(240,180,60,.75)':'rgba(76,194,255,.7)';if(this.grid.weak)ctx.setLineDash([3*dpr,3*dpr]);ctx.beginPath();
   for(const x of this.grid.xs){ctx.moveTo(X(x),Y(0));ctx.lineTo(X(x),Y(r.h));}for(const y of this.grid.ys){ctx.moveTo(X(0),Y(y));ctx.lineTo(X(r.w),Y(y));}ctx.stroke();ctx.restore();}
  // selection ants
  if(this.mask&&this.mask.length===r.w*r.h){
   this.edges||=maskEdges(this.mask,r.w,r.h);const e=this.edges,path=new Path2D();
   for(let i=0;i<e.length;i+=4){path.moveTo(X(e[i]),Y(e[i+1]));path.lineTo(X(e[i+2]),Y(e[i+3]));}
   ctx.save();ctx.lineWidth=1;ctx.setLineDash([4*dpr,4*dpr]);ctx.lineDashOffset=-this.dash*dpr;ctx.strokeStyle='#000';ctx.stroke(path);ctx.lineDashOffset=-this.dash*dpr+4*dpr;ctx.strokeStyle='#fff';ctx.stroke(path);ctx.restore();
  }
  // draft selection
  const d=this.S.draft;
  if(d){ctx.save();ctx.lineWidth=1;ctx.setLineDash([4*dpr,4*dpr]);ctx.strokeStyle='#fff';
   if(d.kind==='rect')ctx.strokeRect(X(d.x),Y(d.y),Math.round(d.w*s)-1,Math.round(d.h*s)-1);
   else if(d.kind==='poly'&&d.points.length>1){ctx.beginPath();d.points.forEach(([x,y],i)=>i?ctx.lineTo(v.x+x*s,v.y+y*s):ctx.moveTo(v.x+x*s,v.y+y*s));ctx.stroke();}
   ctx.restore();}
  // brush footprint
  const hv=this.S.hover;
  if(hv&&PAINT.has(currentTool(this.W))&&s>=2){
   const off=brushOffsets(this.prefs.size,this.prefs.brush),pts=sym.mode!=='none'?mirrorPoints(hv[0],hv[1],{mode:sym.mode,...this.W.symmetry()}):[hv];
   ctx.save();ctx.lineWidth=1;
   for(const [cx,cy,]of pts){const mx=cx!==hv[0]?-1:1,my=cy!==hv[1]?-1:1,path=new Path2D();
    for(let k=0;k<off.length;k+=2){const x=cx+mx*off[k],y=cy+my*off[k+1];path.rect(Math.round(v.x+x*s)+.5,Math.round(v.y+y*s)+.5,Math.round(s)-1,Math.round(s)-1);}
    ctx.strokeStyle='rgba(0,0,0,.7)';ctx.stroke(path);ctx.setLineDash([2*dpr,2*dpr]);ctx.strokeStyle='#fff';ctx.stroke(path);ctx.setLineDash([]);}
   ctx.restore();
  }
 }
}
const currentTool=W=>W.ctx.activeTool||'';
