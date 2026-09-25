/** Studio canvas engine: shows one image at integer (or 1/n) zoom with overlays on top.
 * No workspace logic lives here — workspaces add ShapeLayers and give the view a tool.
 *
 *  ┌ root (.cv) ───────────────────────────────┐
 *  │ corner │ ruler-x                            │   rulers optional
 *  │ ruler-y│ stage: canvas.cv-image  (WebGL2 or 2D: background, checker, image)
 *  │        │        canvas.cv-overlay (2D: pixel grid, custom grid, layers, marquee)
 *  └───────────────────────────────────────────┘
 * Both canvases are sized in device pixels (ResizeObserver device-pixel-content-box), so one image
 * pixel covers exactly `scale` device pixels and nearest-neighbour is exact. Rendering is on demand:
 * nothing draws unless the view, the image, an overlay or a setting changed. */
import * as V from './view-math.js';
import {RectIndex,hitHandle,hitRect,hitPolygon,hitPoint,hitGuide,handlePoints,HANDLES,HANDLE_CURSORS} from './overlay-math.js';

const VS=`#version 300 es
in vec2 aPos;uniform vec2 uViewport;uniform vec4 uRect;out vec2 vUV;
void main(){vec2 p=uRect.xy+aPos*uRect.zw;vUV=aPos;vec2 c=p/uViewport*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);}`;
const FS=`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uTex;uniform int uMode;uniform float uChecker;uniform vec3 uA;uniform vec3 uB;uniform vec3 uSolid;out vec4 o;
void main(){vec4 t=texture(uTex,vUV);vec3 bg;
 if(uMode==0){vec2 c=floor(gl_FragCoord.xy/uChecker);bg=mod(c.x+c.y,2.0)<1.0?uA:uB;}else{bg=uSolid;}
 o=vec4(t.rgb+bg*(1.0-t.a),1.0);}`;// texture is premultiplied: "over" is rgb + bg·(1−a)
const hex=c=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(c||''));const n=m?parseInt(m[1],16):0;return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};

/** WebGL2 image renderer. Large images are split into textures of ≤ MAX_TEXTURE_SIZE (and ≤ 4096
 * so a phone's smaller limit is never hit by surprise). */
class GLRenderer{
 constructor(canvas){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL2 unavailable');
  this.gl=gl;this.kind='webgl2';this.tiles=[];
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  this.p=p;this.u=Object.fromEntries(['uViewport','uRect','uTex','uMode','uChecker','uA','uB','uSolid'].map(n=>[n,gl.getUniformLocation(p,n)]));
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(p,'aPos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  this.maxTex=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));
 }
 async setImage(src,w,h){
  const gl=this.gl;this.clearImage();
  const T=this.maxTex,jobs=[];
  for(let y=0;y<h;y+=T)for(let x=0;x<w;x+=T){const tw=Math.min(T,w-x),th=Math.min(T,h-y);
   jobs.push((async()=>{
    const part=(x||y||tw<w||th<h)?await createImageBitmap(src,x,y,tw,th,{premultiplyAlpha:'premultiply'}):src;
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,part);
    for(const [k,v]of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    if(part!==src)part.close?.();
    return {tex,x,y,w:tw,h:th};
   })());}
  this.tiles=await Promise.all(jobs);
 }
 clearImage(){for(const t of this.tiles)this.gl.deleteTexture(t.tex);this.tiles=[];}
 /** Live painting: straight RGBA of `rect` (w*h*4 bytes) replaces that part of the textures. */
 updateRect(data,rect){
  const gl=this.gl;gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  for(const t of this.tiles){
   const x0=Math.max(rect.x,t.x),y0=Math.max(rect.y,t.y),x1=Math.min(rect.x+rect.w,t.x+t.w),y1=Math.min(rect.y+rect.h,t.y+t.h);if(x1<=x0||y1<=y0)continue;
   const w=x1-x0,h=y1-y0;let part=data;
   if(w!==rect.w||h!==rect.h){part=new Uint8Array(w*h*4);for(let y=0;y<h;y++)part.set(data.subarray(((y0-rect.y+y)*rect.w+x0-rect.x)*4,((y0-rect.y+y)*rect.w+x0-rect.x+w)*4),y*w*4);}
   gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,x0-t.x,y0-t.y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,part);
  }
 }
 draw(v,W,H,o){
  const gl=this.gl,[r,g,b]=hex(o.workspace);
  gl.viewport(0,0,W,H);gl.clearColor(r,g,b,1);gl.clear(gl.COLOR_BUFFER_BIT);
  if(!this.tiles.length)return;
  gl.useProgram(this.p);gl.uniform2f(this.u.uViewport,W,H);gl.uniform1i(this.u.uTex,0);gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(this.u.uMode,o.background==='checker'?0:1);gl.uniform1f(this.u.uChecker,o.checkerPx);
  gl.uniform3fv(this.u.uA,hex(o.checkerA));gl.uniform3fv(this.u.uB,hex(o.checkerB));gl.uniform3fv(this.u.uSolid,hex(o.solid));
  const s=v.scale;
  for(const t of this.tiles){
   const x=v.x+t.x*s,y=v.y+t.y*s,w=t.w*s,h=t.h*s;
   if(x>W||y>H||x+w<0||y+h<0)continue;
   gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.uniform4f(this.u.uRect,x,y,w,h);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
 }
 destroy(){this.clearImage();this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
/** Canvas2D fallback: draws only the visible source sub-rectangle, smoothing off. */
class Canvas2DRenderer{
 constructor(canvas){this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('No 2D canvas');this.kind='2d';this.src=null;this.pattern=null;this.patternKey='';}
 async setImage(src,w,h){this.src=src;this.w=w;this.h=h;}
 clearImage(){this.src=null;}
 updateRect(data,rect){
  // an ImageBitmap cannot be written to: keep a canvas copy from the first live update on
  if(!this.src.getContext){const c=new OffscreenCanvas(this.w,this.h);c.getContext('2d').drawImage(this.src,0,0);this.src=c;}
  this.src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.buffer,data.byteOffset,rect.w*rect.h*4),rect.w,rect.h),rect.x,rect.y);
 }
 draw(v,W,H,o){
  const c=this.ctx;c.setTransform(1,0,0,1,0,0);c.fillStyle=o.workspace;c.fillRect(0,0,W,H);
  if(!this.src)return;
  const vis=V.visibleRect(v,W,H,this.w,this.h);if(!vis.w||!vis.h)return;
  const s=v.scale,dx=v.x+vis.x*s,dy=v.y+vis.y*s,dw=vis.w*s,dh=vis.h*s;
  if(o.background==='checker'){
   const key=o.checkerPx+o.checkerA+o.checkerB;
   if(key!==this.patternKey){const n=o.checkerPx,p=new OffscreenCanvas(2*n,2*n),x=p.getContext('2d');x.fillStyle=o.checkerA;x.fillRect(0,0,2*n,2*n);x.fillStyle=o.checkerB;x.fillRect(n,0,n,n);x.fillRect(0,n,n,n);this.pattern=c.createPattern(p,'repeat');this.patternKey=key;}
   c.fillStyle=this.pattern;
  }else c.fillStyle=o.solid;
  c.fillRect(dx,dy,dw,dh);
  c.imageSmoothingEnabled=false;c.drawImage(this.src,vis.x,vis.y,vis.w,vis.h,dx,dy,dw,dh);
 }
 destroy(){this.src=null;}
}

/** Overlay shapes a workspace owns. Items:
 *   {id, shape:'rect', x,y,w,h, label?}  {id, shape:'point', x,y}  {id, shape:'polygon', points:[[x,y]…]}
 *   {id, shape:'guide', axis:'x'|'y', pos}
 * Coordinates are image pixels. Rects are spatially indexed; the layer draws only what is visible. */
export class ShapeLayer{
 constructor({id,z=0,color='#4cc2ff',selectedColor='#ffc83d',hoverColor='#ffffff',fill='',labels=true,handles=true,editable=true}={}){
  Object.assign(this,{id,z,color,selectedColor,hoverColor,fill,labels,handles,editable});
  this.items=[];this.rects=[];this.others=[];this.byId=new Map();this.index=null;this.selected=new Set();this.hover=null;this.visible=true;this.view=null;
 }
 setItems(items){
  this.items=items;this.byId=new Map(items.map(i=>[i.id,i]));
  this.rects=items.filter(i=>(i.shape||'rect')==='rect');this.others=items.filter(i=>(i.shape||'rect')!=='rect');this.index=null;
  this.view?.invalidate();
 }
 get rectIndex(){return this.index||=new RectIndex(this.rects);}
 setSelected(ids){this.selected=new Set(ids);this.view?.invalidate();}
 setHover(id){if(id!==this.hover){this.hover=id;this.view?.invalidate();}}
 /** Topmost hit: a resize handle of a selected rect, then shapes, newest first. */
 hit(p,{tol,handleTol}){
  if(!this.visible)return null;
  if(this.editable&&this.handles&&this.selected.size&&this.selected.size<=64)
   for(const id of this.selected){const r=this.byId.get(id);if(r&&(r.shape||'rect')==='rect'){const h=hitHandle(r,p,handleTol);if(h)return {layer:this,id,part:'handle',handle:h};}}
  // a selected rect wins where rects overlap, so what you just selected is what you drag
  if(this.selected.size&&this.selected.size<=256)for(const id of this.selected){const r=this.byId.get(id);if(r&&(r.shape||'rect')==='rect'&&hitRect(r,p))return {layer:this,id,part:'body'};}
  for(let i=this.others.length-1;i>=0;i--){const it=this.others[i];
   if(it.shape==='point'&&hitPoint(it,p,handleTol))return {layer:this,id:it.id,part:'body'};
   if(it.shape==='guide'&&hitGuide(it,p,tol))return {layer:this,id:it.id,part:'body'};
   if(it.shape==='polygon'){const h=hitPolygon(it.points,p,tol);if(h)return {layer:this,id:it.id,part:h.part,index:h.index};}
  }
  const hits=this.rectIndex.at(p,0);
  for(let i=hits.length-1;i>=0;i--){const r=this.rects[hits[i]];if(hitRect(r,p))return {layer:this,id:r.id,part:'body'};}
  return null;
 }
 draw(g){
  if(!this.visible)return;
  const {ctx,view:v,dpr}=g,s=v.scale,vis=g.visible;
  const ids=this.rectIndex.query(vis,1),X=x=>Math.round(v.x+x*s),Y=y=>Math.round(v.y+y*s);
  const normal=new Path2D(),sel=new Path2D();let labels=0;
  for(const i of ids){const r=this.rects[i],p=this.selected.has(r.id)?sel:normal;const x=X(r.x),y=Y(r.y),w=X(r.x+r.w)-x,h=Y(r.y+r.h)-y;p.rect(x+.5,y+.5,Math.max(0,w-1),Math.max(0,h-1));}
  if(this.fill){ctx.fillStyle=this.fill;ctx.fill(normal);}
  // dark halo keeps light outlines readable on light art; with thousands on screen the boxes are a
  // texture anyway, and the halo would double the stroke cost
  if(ids.length<=1500){ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.45)';ctx.stroke(normal);}
  ctx.lineWidth=1;ctx.strokeStyle=this.color;ctx.stroke(normal);
  if(this.selected.size){ctx.lineWidth=Math.max(2,Math.round(2*dpr));ctx.strokeStyle='rgba(0,0,0,.6)';ctx.stroke(sel);ctx.lineWidth=Math.max(1,Math.round(dpr));ctx.strokeStyle=this.selectedColor;ctx.stroke(sel);}
  const hov=this.hover&&this.byId.get(this.hover);
  if(hov&&(hov.shape||'rect')==='rect'){ctx.lineWidth=Math.max(1,Math.round(dpr));ctx.strokeStyle=this.hoverColor;ctx.strokeRect(X(hov.x)+.5,Y(hov.y)+.5,X(hov.x+hov.w)-X(hov.x)-1,Y(hov.y+hov.h)-Y(hov.y)-1);}
  if(this.labels&&ids.length<=600){
   const fs=Math.round(10*dpr);ctx.font=`600 ${fs}px ui-monospace,SFMono-Regular,Consolas,monospace`;ctx.textBaseline='top';
   for(const i of ids){const r=this.rects[i];if(r.label==null)continue;const w=r.w*s,h=r.h*s;if(w<fs*2.2||h<fs*1.6)continue;
    const t=String(r.label),x=X(r.x)+2,y=Y(r.y)+2,tw=ctx.measureText(t).width+4*dpr;
    ctx.fillStyle=this.selected.has(r.id)?this.selectedColor:'rgba(12,14,18,.78)';ctx.fillRect(x,y,tw,fs+3*dpr);
    ctx.fillStyle=this.selected.has(r.id)?'#111':'#e8eaed';ctx.fillText(t,x+2*dpr,y+1.5*dpr);if(++labels>600)break;}
  }
  for(const it of this.others){
   const on=this.selected.has(it.id),c=on?this.selectedColor:it.id===this.hover?this.hoverColor:this.color;ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=Math.max(1,Math.round(dpr*(on?2:1)));
   if(it.shape==='guide'){ctx.setLineDash([4*dpr,3*dpr]);ctx.beginPath();if(it.axis==='x'){const x=X(it.pos)+.5;ctx.moveTo(x,0);ctx.lineTo(x,g.H);}else{const y=Y(it.pos)+.5;ctx.moveTo(0,y);ctx.lineTo(g.W,y);}ctx.stroke();ctx.setLineDash([]);}
   else if(it.shape==='point'){const x=v.x+it.x*s,y=v.y+it.y*s,r=4*dpr;ctx.beginPath();ctx.moveTo(x-r*1.6,y);ctx.lineTo(x+r*1.6,y);ctx.moveTo(x,y-r*1.6);ctx.lineTo(x,y+r*1.6);ctx.stroke();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
   else if(it.shape==='polygon'){ctx.beginPath();it.points.forEach(([px,py],i)=>{const x=v.x+px*s,y=v.y+py*s;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();if(on)for(const [px,py]of it.points){const x=v.x+px*s,y=v.y+py*s;ctx.fillRect(x-3*dpr,y-3*dpr,6*dpr,6*dpr);}}
  }
  if(this.editable&&this.handles&&this.selected.size&&this.selected.size<=64){
   const hs=Math.round(7*dpr),hh=hs>>1;ctx.lineWidth=1;
   for(const id of this.selected){const r=this.byId.get(id);if(!r||(r.shape||'rect')!=='rect')continue;const pts=handlePoints(r);
    for(const k of HANDLES){const x=Math.round(v.x+pts[k][0]*s)-hh,y=Math.round(v.y+pts[k][1]*s)-hh;ctx.fillStyle='#fff';ctx.fillRect(x,y,hs,hs);ctx.strokeStyle='#111';ctx.strokeRect(x+.5,y+.5,hs-1,hs-1);}}
  }
 }
}

const DEFAULTS={workspace:'#1b1d21',background:'checker',checkerA:'#3a3d44',checkerB:'#2e3036',solid:'#000000',checkerCss:8,pixelGrid:true,
 grid:null,gridVisible:false,gridColor:'rgba(76,194,255,.55)',rulers:false,wheel:'auto',border:true};
export class CanvasView{
 constructor(host,{renderer='auto',options={}}={}){
  this.host=host;this.o={...DEFAULTS,...options};this.layers=[];this.image=null;this.v=V.view(1,0,0);this.W=1;this.H=1;this.dpr=devicePixelRatio||1;
  this.tool=null;this.space=false;this.pan=null;this.touches=new Map();this.gesture=null;this.wheelAcc=0;this.marquee=null;this.cursorPx=null;this.frame=0;
  this.listeners={view:new Set(),cursor:new Set(),render:new Set()};this.stats={frames:0,lastMs:0,totalMs:0};
  const root=this.root=document.createElement('div');root.className='cv';
  root.innerHTML='<div class="cv-corner"></div><canvas class="cv-ruler cv-ruler-x" aria-hidden="true"></canvas><canvas class="cv-ruler cv-ruler-y" aria-hidden="true"></canvas><div class="cv-stage"><canvas class="cv-image"></canvas><canvas class="cv-overlay"></canvas></div>';
  host.append(root);
  this.stage=root.querySelector('.cv-stage');this.imageCanvas=root.querySelector('.cv-image');this.overlay=root.querySelector('.cv-overlay');this.octx=this.overlay.getContext('2d');
  this.rulerX=root.querySelector('.cv-ruler-x');this.rulerY=root.querySelector('.cv-ruler-y');
  this.renderer=this.makeRenderer(renderer);
  this.imageCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;});
  this.imageCanvas.addEventListener('webglcontextrestored',async()=>{this.lost=false;this.renderer=this.makeRenderer('webgl2');if(this.image)await this.renderer.setImage(this.image.src,this.image.w,this.image.h);this.invalidate();});
  this.stage.tabIndex=0;this.stage.setAttribute('role','application');
  this.bindInput();
  this.ro=new ResizeObserver(entries=>{for(const e of entries)this.resize(e);});
  try{this.ro.observe(this.stage,{box:'device-pixel-content-box'});}catch{this.ro.observe(this.stage);}
  this.applyRulers();
 }
 makeRenderer(kind){
  if(kind!=='2d'){try{return new GLRenderer(this.imageCanvas);}catch(e){this.glError=String(e?.message||e);if(kind==='webgl2')throw e;}}
  return new Canvas2DRenderer(this.imageCanvas);
 }
 get rendererKind(){return this.renderer.kind;}
 on(type,fn){this.listeners[type].add(fn);return ()=>this.listeners[type].delete(fn);}
 emit(type,value){for(const fn of this.listeners[type])fn(value);}
 resize(entry){
  const dpr=devicePixelRatio||1,box=entry?.devicePixelContentBoxSize?.[0],css=this.stage.getBoundingClientRect();
  let W=Math.max(1,box?box.inlineSize:Math.round(css.width*dpr)),H=Math.max(1,box?box.blockSize:Math.round(css.height*dpr));
  // Emulated DPR (devtools, headless device emulation) reports CSS-sized device boxes: fall back to css × dpr.
  if(box&&dpr!==1&&Math.abs(W-css.width)<1&&Math.abs(H-css.height)<1){W=Math.max(1,Math.round(css.width*dpr));H=Math.max(1,Math.round(css.height*dpr));}
  if(W===this.W&&H===this.H&&dpr===this.dpr)return;
  const first=!this.sized;this.sized=true;
  // keep the centre of the view where it was (a fitted view is fitted again below)
  const refit=!first&&this.fitted&&!!this.image;
  if(!first)this.v={...this.v,x:Math.round(this.v.x+(W-this.W)/2),y:Math.round(this.v.y+(H-this.H)/2)};
  this.W=W;this.H=H;this.dpr=dpr;
  for(const c of [this.imageCanvas,this.overlay]){c.width=W;c.height=H;}
  this.sizeRulers();
  if(first&&this.image){const pv=this.pendingView;this.pendingView=null;if(pv&&pv!=='fit')this.setView(pv);else this.fit();}else if(refit)this.fit();else this.invalidate();
  this.emit('view',this.v);
 }
 // ------------------------------------------------------------------ image
 /** @param src ImageBitmap/canvas (premultiplied), @param view optional saved {scale,x,y} */
 async setImage(src,w,h,{view=null}={}){
  const token=this.frame=(this.frame||0)+1;
  this.image={src,w,h};await this.renderer.setImage(src,w,h);if(token!==this.frame)return;
  const good=view&&V.isValidZoom(view.scale);
  // re-showing the same view (a workspace redrawing its picture) keeps a fitted view fitted
  const keep=good&&this.fitted&&view.scale===this.v.scale&&view.x===this.v.x&&view.y===this.v.y;
  if(!this.sized)this.pendingView=good?view:'fit';else if(good){this.setView(view);if(keep)this.fitted=true;}else this.fit();
  this.invalidate();
 }
 clearImage(){this.image=null;this.renderer.clearImage();this.invalidate();}
 /** Replaces part of the shown image in place without touching the view (live painting): `data` is
  * straight RGBA of `rect` (rect.w*rect.h*4 bytes), in image pixels. */
 updateImage(data,rect){if(!this.image||this.lost)return;this.renderer.updateRect(data,rect);this.invalidate();}
 // ------------------------------------------------------------------ view
 get view(){return this.v;}
 setView(v,{clamp=true}={}){
  let next={scale:V.isValidZoom(v.scale)?v.scale:V.floorZoom(v.scale),x:Math.round(v.x),y:Math.round(v.y)};
  if(clamp&&this.image)next=V.clampView(next,this.image.w,this.image.h,this.W,this.H,Math.round(KEEP_VISIBLE*this.dpr));
  this.fitted=false;// any other view change (zoom, pan, a restored view) ends "fitted"; fit() sets it again
  if(next.scale===this.v.scale&&next.x===this.v.x&&next.y===this.v.y)return;
  this.v=next;this.invalidate();this.emit('view',this.v);
 }
 zoomTo(scale,anchor=null){const a=anchor||{x:this.W/2,y:this.H/2};this.setView(V.zoomAt(this.v,Math.min(V.MAX_ZOOM,Math.max(V.MIN_ZOOM,scale)),a.x,a.y));}
 zoomStep(dir,anchor=null){this.zoomTo(V.stepZoom(this.v.scale,dir),anchor||this.lastPointer);}
 /** Fits and centres the image. The view stays "fitted" (re-fitted when the viewport resizes: a
  * panel opens, the phone rotates) until the user zooms or pans. */
 fit(){if(!this.image)return;const pad=Math.round(24*this.dpr);this.setView(V.fitView(this.image.w,this.image.h,this.W,this.H,{pad,max:Math.max(1,Math.round(8*this.dpr))}),{clamp:false});this.fitted=true;}
 actual(){this.zoomTo(1,this.lastPointer);}
 panBy(dx,dy){this.setView(V.panBy(this.v,dx,dy));}
 /** Centre an image-space rect in the viewport at the current zoom. */
 reveal(r){const s=this.v.scale;this.setView({scale:s,x:Math.round(this.W/2-(r.x+r.w/2)*s),y:Math.round(this.H/2-(r.y+r.h/2)*s)});}
 toImage(clientX,clientY){const b=this.stage.getBoundingClientRect(),sx=(clientX-b.left)*this.W/Math.max(1,b.width),sy=(clientY-b.top)*this.H/Math.max(1,b.height);return {...V.toImage(this.v,sx,sy),sx,sy};}
 // ------------------------------------------------------------------ settings
 set(options){
  const rulers=this.o.rulers;Object.assign(this.o,options);
  if(options.grid)this.o.grid=V.normalizeGrid(options.grid);
  if(rulers!==this.o.rulers)this.applyRulers();
  this.invalidate();
 }
 get options(){return {...this.o};}
 applyRulers(){this.root.classList.toggle('has-rulers',!!this.o.rulers);this.sizeRulers();}
 sizeRulers(){
  if(!this.o.rulers)return;
  const r=Math.round(18*this.dpr);this.rulerX.width=this.W;this.rulerX.height=r;this.rulerY.width=r;this.rulerY.height=this.H;
 }
 addLayer(layer){layer.view=this;this.layers.push(layer);this.layers.sort((a,b)=>a.z-b.z);this.invalidate();return layer;}
 removeLayer(layer){this.layers=this.layers.filter(l=>l!==layer);layer.view=null;this.invalidate();}
 setMarquee(r){this.marquee=r;this.invalidate();}
 // ------------------------------------------------------------------ rendering
 invalidate(){if(this.raf)return;this.raf=requestAnimationFrame(()=>{this.raf=0;this.render();});}
 render(){
  if(this.lost)return;
  const t0=performance.now(),v=this.v,W=this.W,H=this.H,o={...this.o,checkerPx:Math.max(2,Math.round(o_checker(this.o)*this.dpr))};
  this.renderer.draw(v,W,H,o);
  const ctx=this.octx;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
  if(this.image){
   const {w,h}=this.image,s=v.scale,visible=V.visibleRect(v,W,H,w,h),g={ctx,view:v,W,H,dpr:this.dpr,visible};
   if(this.o.border){ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=1;ctx.strokeRect(v.x-.5,v.y-.5,w*s+1,h*s+1);}
   const alpha=this.o.pixelGrid?V.pixelGridAlpha(s):0;
   if(alpha&&visible.w&&visible.h){
    ctx.beginPath();
    for(let x=visible.x;x<=visible.x+visible.w;x++){const px=v.x+x*s+.5;ctx.moveTo(px,v.y+visible.y*s);ctx.lineTo(px,v.y+(visible.y+visible.h)*s);}
    for(let y=visible.y;y<=visible.y+visible.h;y++){const py=v.y+y*s+.5;ctx.moveTo(v.x+visible.x*s,py);ctx.lineTo(v.x+(visible.x+visible.w)*s,py);}
    ctx.lineWidth=1;ctx.strokeStyle=`rgba(128,128,128,${(.32*alpha).toFixed(3)})`;ctx.stroke();
   }
   if(this.o.gridVisible&&this.o.grid)this.drawGrid(g);
   for(const l of this.layers)l.draw(g);
   if(this.marquee){const m=this.marquee;ctx.lineWidth=1;ctx.setLineDash([4*this.dpr,4*this.dpr]);ctx.strokeStyle='#fff';const x=Math.round(v.x+m.x*s)+.5,y=Math.round(v.y+m.y*s)+.5,mw=Math.round(m.w*s)-1,mh=Math.round(m.h*s)-1;ctx.strokeRect(x,y,mw,mh);ctx.lineDashOffset=4*this.dpr;ctx.strokeStyle='#000';ctx.strokeRect(x,y,mw,mh);ctx.setLineDash([]);ctx.lineDashOffset=0;}
  }
  if(this.o.rulers)this.drawRulers();
  const ms=performance.now()-t0;this.stats.frames++;this.stats.lastMs=ms;this.stats.totalMs+=ms;
  this.emit('render',ms);
 }
 drawGrid(g){
  const {ctx,view:v,visible}=g,s=v.scale,G=this.o.grid,range=V.gridRange(G,visible);
  if(!range.count)return;
  const cellPx=Math.min(G.w,G.h)*s;if(cellPx<3)return;// denser than 3 px per cell is noise, not a grid
  ctx.beginPath();
  if(!G.sx&&!G.sy){// edge-to-edge cells: lines, not boxes
   const {w,h}=this.image,x0=v.x+G.ox*s,y0=v.y+G.oy*s,cols=V.gridCellsIn(G,w,h),xEnd=v.x+(G.ox+Math.max(1,cols.cols)*G.w)*s,yEnd=v.y+(G.oy+Math.max(1,cols.rows)*G.h)*s;
   for(let c=range.c0;c<=Math.min(range.c1+1,cols.cols);c++){const x=Math.round(x0+c*G.w*s)+.5;ctx.moveTo(x,Math.max(y0,0));ctx.lineTo(x,Math.min(yEnd,g.H));}
   for(let r=range.r0;r<=Math.min(range.r1+1,cols.rows);r++){const y=Math.round(y0+r*G.h*s)+.5;ctx.moveTo(Math.max(x0,0),y);ctx.lineTo(Math.min(xEnd,g.W),y);}
  }else for(let r=range.r0;r<=range.r1;r++)for(let c=range.c0;c<=range.c1;c++){const cell=V.gridCell(G,c,r);if(cell.x+cell.w>this.image.w||cell.y+cell.h>this.image.h)continue;ctx.rect(Math.round(v.x+cell.x*s)+.5,Math.round(v.y+cell.y*s)+.5,Math.round(cell.w*s)-1,Math.round(cell.h*s)-1);}
  ctx.lineWidth=1;ctx.strokeStyle=this.o.gridColor;ctx.stroke();
 }
 drawRulers(){
  const dpr=this.dpr,s=this.v.scale,step=V.rulerStep(s,Math.round(56*dpr)),minor=step*s>=40*dpr?step/5:step*s>=20*dpr?step/2:0;
  const fs=Math.round(9*dpr),font=`${fs}px ui-monospace,SFMono-Regular,Consolas,monospace`;
  for(const [c,axis]of [[this.rulerX,'x'],[this.rulerY,'y']]){
   const x=c.getContext('2d'),len=axis==='x'?c.width:c.height,thick=axis==='x'?c.height:c.width,org=axis==='x'?this.v.x:this.v.y;
   x.setTransform(1,0,0,1,0,0);x.fillStyle='#202226';x.fillRect(0,0,c.width,c.height);x.fillStyle='#8a8f98';x.strokeStyle='#5a5f68';x.font=font;x.textBaseline='top';
   const i0=Math.floor(-org/s),i1=Math.ceil((len-org)/s);x.beginPath();
   if(minor)for(let i=Math.floor(i0/minor)*minor;i<=i1;i+=minor){const p=Math.round(org+i*s)+.5;if(axis==='x'){x.moveTo(p,thick*.72);x.lineTo(p,thick);}else{x.moveTo(thick*.72,p);x.lineTo(thick,p);}}
   for(let i=Math.floor(i0/step)*step;i<=i1;i+=step){const p=Math.round(org+i*s)+.5;if(axis==='x'){x.moveTo(p,0);x.lineTo(p,thick);x.fillText(String(i),p+2*dpr,1*dpr);}else{x.moveTo(0,p);x.lineTo(thick,p);x.save();x.translate(1*dpr,p+2*dpr);x.rotate(Math.PI/2);x.fillText(String(i),0,-thick+2*dpr);x.restore();}}
   x.stroke();
   if(this.cursorPx){const p=Math.round(org+(axis==='x'?this.cursorPx.x+.5:this.cursorPx.y+.5)*s);x.fillStyle='#ffc83d';if(axis==='x')x.fillRect(p-dpr,0,2*dpr,thick);else x.fillRect(0,p-dpr,thick,2*dpr);}
  }
 }
 // ------------------------------------------------------------------ input
 hitTest(p){
  const tol=4*this.dpr/this.v.scale,handleTol=6*this.dpr/this.v.scale;
  for(let i=this.layers.length-1;i>=0;i--){const h=this.layers[i].hit?.(p,{tol,handleTol});if(h)return h;}
  return null;
 }
 info(e){
  const p=this.toImage(e.clientX,e.clientY),pixel=this.image?V.pixelAt(this.v,p.sx,p.sy,this.image.w,this.image.h):null;
  return {x:p.x,y:p.y,sx:p.sx,sy:p.sy,pixel,button:e.button,buttons:e.buttons,shift:e.shiftKey,alt:e.altKey,mod:e.ctrlKey||e.metaKey,pointerType:e.pointerType,event:e,view:this};
 }
 setSpace(on){if(this.space===on)return;this.space=on;this.updateCursor();}
 updateCursor(hint){
  const c=this.pan?'grabbing':this.space?'grab':hint||this.tool?.cursor?.(this.lastInfo)||'default';
  if(this.stage.style.cursor!==c)this.stage.style.cursor=c;
 }
 bindInput(){
  const st=this.stage;
  st.addEventListener('wheel',e=>this.onWheel(e),{passive:false});
  st.addEventListener('contextmenu',e=>e.preventDefault());
  st.addEventListener('pointerdown',e=>this.onDown(e));
  st.addEventListener('pointermove',e=>this.onMove(e));
  st.addEventListener('pointerup',e=>this.onUp(e));
  st.addEventListener('pointercancel',e=>this.onUp(e,true));
  st.addEventListener('pointerleave',()=>{if(!this.pan&&!this.dragging){this.cursorPx=null;this.lastPointer=null;this.emit('cursor',null);this.tool?.leave?.();if(this.o.rulers)this.invalidate();}});
  // Stop the browser from scrolling or zooming the page from inside the canvas (touch).
  st.style.touchAction='none';
 }
 onWheel(e){
  e.preventDefault();if(!this.image)return;
  const p=this.toImage(e.clientX,e.clientY),a={x:p.sx,y:p.sy};this.lastPointer=a;
  const scale=e.deltaMode===1?33:e.deltaMode===2?this.H:1,dx=e.deltaX*scale*this.dpr,dy=e.deltaY*scale*this.dpr;
  const zoom=e.ctrlKey||e.metaKey||this.o.wheel==='zoom'||(this.o.wheel==='auto'&&!e.shiftKey&&V.looksLikeMouseWheel(e));
  if(zoom){
   if(Math.abs(e.deltaY)>=50||e.deltaMode){this.wheelAcc=0;this.zoomStep(e.deltaY<0?1:-1,a);return;}// one notch = one level
   const r=V.wheelSteps(this.wheelAcc,-e.deltaY,24);this.wheelAcc=r.rest;// pinch: accumulate
   for(let i=0;i<Math.abs(r.steps);i++)this.zoomStep(Math.sign(r.steps),a);
   return;
  }
  if(e.shiftKey&&!dx)this.panBy(-dy,0);else this.panBy(-dx,-dy);
 }
 onDown(e){
  this.stage.focus({preventScroll:true});
  if(e.pointerType==='touch'){this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.touches.size===2){this.tool?.cancel?.();this.dragging=false;this.startGesture();this.stage.setPointerCapture(e.pointerId);return;}}
  if(this.gesture)return;
  const info=this.info(e);this.lastInfo=info;
  if(e.button===1||(e.button===0&&(this.space||this.tool?.pans))){e.preventDefault();this.pan={x:e.clientX,y:e.clientY,rx:0,ry:0};this.stage.setPointerCapture(e.pointerId);this.updateCursor();return;}
  if(!this.image||!this.tool?.down)return;
  if(this.tool.down(info)!==false){this.dragging=true;this.stage.setPointerCapture(e.pointerId);}
 }
 onMove(e){
  if(e.pointerType==='touch'&&this.touches.has(e.pointerId)){this.touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.gesture){this.moveGesture();return;}}
  const info=this.info(e);this.lastInfo=info;this.lastPointer={x:info.sx,y:info.sy};
  const px=info.pixel;if((px?.x)!==(this.cursorPx?.x)||(px?.y)!==(this.cursorPx?.y)){this.cursorPx=px;this.emit('cursor',px);if(this.o.rulers)this.invalidate();}
  if(this.pan){// fractional device deltas accumulate so slow drags still move smoothly
   const k=this.dpr,dx=(e.clientX-this.pan.x)*k+this.pan.rx,dy=(e.clientY-this.pan.y)*k+this.pan.ry,ix=Math.trunc(dx),iy=Math.trunc(dy);
   this.pan={x:e.clientX,y:e.clientY,rx:dx-ix,ry:dy-iy};if(ix||iy)this.panBy(ix,iy);return;
  }
  if(this.dragging){this.tool?.move?.(info);return;}
  this.tool?.hover?.(info);this.updateCursor();
 }
 onUp(e,cancel=false){
  if(e.pointerType==='touch'){this.touches.delete(e.pointerId);if(this.gesture){if(this.touches.size<2)this.gesture=null;return;}}
  if(this.pan){this.pan=null;this.stage.releasePointerCapture?.(e.pointerId);this.updateCursor();return;}
  if(this.dragging){this.dragging=false;const info=this.info(e);cancel?this.tool?.cancel?.(info):this.tool?.up?.(info);this.stage.releasePointerCapture?.(e.pointerId);this.updateCursor();}
 }
 startGesture(){const [a,b]=[...this.touches.values()];this.gesture={d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2,my:(a.y+b.y)/2};}
 moveGesture(){
  const [a,b]=[...this.touches.values()],g=this.gesture,d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  this.panBy((mx-g.mx)*this.dpr,(my-g.my)*this.dpr);g.mx=mx;g.my=my;
  const p=this.toImage(mx,my),anchor={x:p.sx,y:p.sy};
  if(d>g.d*1.3){this.zoomStep(1,anchor);g.d=d;}else if(d<g.d/1.3){this.zoomStep(-1,anchor);g.d=d;}
 }
 /** Frame-time measurement: drives `frames` view changes through requestAnimationFrame and reports
 * rAF-to-rAF intervals (what the user sees) and the CPU time of render() itself. */
 async benchmark({frames=120,mode='pan'}={}){
  const intervals=[],cpu=[];let last=0,dir=1;const start={...this.v};
  await new Promise(r=>requestAnimationFrame(r));
  for(let i=0;i<frames;i++){
   await new Promise(resolve=>requestAnimationFrame(t=>{
    if(last)intervals.push(t-last);last=t;
    if(mode==='pan')this.v={...this.v,x:this.v.x+(i%60<30?7:-7),y:this.v.y+(i%40<20?3:-3)};
    else{const next=V.stepZoom(this.v.scale,dir);if(next===this.v.scale)dir=-dir;this.v=V.zoomAt(this.v,V.stepZoom(this.v.scale,dir),this.W/2,this.H/2);if(i%6===5)dir=-dir;}
    const t0=performance.now();this.render();cpu.push(performance.now()-t0);resolve();
   }));
  }
  if(this.renderer.gl)this.renderer.gl.finish();
  this.v=start;this.render();
  const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];},avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
  return {mode,frames,renderer:this.renderer.kind,W:this.W,H:this.H,interval:{avg:avg(intervals),p50:q(intervals,.5),p95:q(intervals,.95),max:Math.max(...intervals)},render:{avg:avg(cpu),p50:q(cpu,.5),p95:q(cpu,.95),max:Math.max(...cpu)}};
 }
 destroy(){this.ro.disconnect();cancelAnimationFrame(this.raf);this.renderer.destroy();this.root.remove();}
}
const o_checker=o=>o.checkerCss||8;
/** CSS px of the image that must stay on screen however far it is panned. */
export const KEEP_VISIBLE=64;
export {HANDLE_CURSORS};
