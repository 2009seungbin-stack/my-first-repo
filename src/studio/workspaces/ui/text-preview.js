/** Live text preview of a built game font. Bitmap fonts are drawn glyph by glyph from the atlas
 * pages exactly as a sprite batcher does (nearest at whole multiples, filtered otherwise — the blur
 * of a pixel font at 1.5× is real and shown). Distance fields go through a WebGL2 shader of the kind
 * engines use: median of RGB for MSDF, one channel for SDF, the screen-space pixel range for
 * anti-aliasing, plus an outline and a soft shadow computed from the same field. */
import {layoutText} from '../../../game/ui/font/formats.js';
const VS=`#version 300 es
in vec2 aPos;in vec2 aUV;uniform vec2 uView;out vec2 vUV;
void main(){vUV=aUV;gl_Position=vec4(aPos.x/uView.x*2.-1.,1.-aPos.y/uView.y*2.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;in vec2 vUV;out vec4 o;uniform sampler2D uTex;uniform int uMode;uniform float uPxRange;
uniform vec4 uFill;uniform vec4 uLine;uniform float uLineW;uniform float uSoft;uniform int uRaw;
float med(float a,float b,float c){return max(min(a,b),min(max(a,b),c));}
void main(){
 vec4 s=texture(uTex,vUV);
 if(uRaw==1){o=vec4(s.rgb,1.);return;}
 float sd=uMode==1||uMode==2?med(s.r,s.g,s.b):uMode==3?s.a:s.r;
 float d=(sd-.5)*uPxRange;                       // signed distance in screen pixels, + inside
 if(uSoft>0.){float a=clamp((d+uSoft)/(2.*uSoft),0.,1.);o=vec4(uFill.rgb,uFill.a*a);return;}
 float fill=clamp(d+.5,0.,1.),edge=clamp(d+uLineW+.5,0.,1.);
 vec4 c=uLineW>0.?mix(uLine,uFill,fill):uFill;float a=uLineW>0.?edge*mix(uLine.a,uFill.a,fill):fill*uFill.a;
 o=vec4(c.rgb,a);
}`;
const hex=c=>{const n=parseInt(String(c).replace('#',''),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,1];};
export class TextPreview{
 constructor(){this.model=null;this.bitmaps=[];this.gl=null;this.canvas=document.createElement('canvas');this.canvas.className='ui-tp-canvas';this.textures=[];}
 setFont(model,bitmaps){this.model=model;this.bitmaps=bitmaps||[];this.dropTextures();}
 dropTextures(){if(this.gl)for(const t of this.textures)this.gl.deleteTexture(t);this.textures=[];}
 /** opts {text, sizes:[px…], color, background, outline, outlineColor, shadow:{x,y,soft,color}, raw, kerning} */
 render(opts){
  const m=this.model,dpr=devicePixelRatio||1;if(!m)return {missing:[]};
  const lines=[],missing=new Set();let W=0,H=8*dpr;
  for(const px of opts.sizes){
   const k=px*dpr/m.size,l=layoutText(m,opts.text,{kerning:opts.kerning!==false});
   for(const it of l.items)if(it.missing&&it.id!==10)missing.add(it.id);
   lines.push({px,k,l,y:H});W=Math.max(W,l.width*k+16*dpr);H+=l.height*k+12*dpr+14*dpr;
  }
  W=Math.min(8192,Math.max(64,Math.ceil(W)));H=Math.min(8192,Math.ceil(H));
  const cv=this.canvas;cv.width=W;cv.height=H;cv.style.width=`${W/dpr}px`;cv.style.height=`${H/dpr}px`;
  if(m.type==='bitmap')this.draw2d(lines,opts,W,H,dpr);else this.drawGL(lines,opts,W,H,dpr);
  return {missing:[...missing],width:W,height:H};
 }
 draw2d(lines,opts,W,H,dpr){
  if(this.gl){const c=document.createElement('canvas');c.className=this.canvas.className;this.canvas.replaceWith?.(c);this.canvas=c;this.gl=null;this.textures=[];c.width=W;c.height=H;c.style.width=`${W/dpr}px`;c.style.height=`${H/dpr}px`;}
  const x=this.canvas.getContext('2d');x.fillStyle=opts.background;x.fillRect(0,0,W,H);
  // tinted pages: the glyphs are white in alpha, so a source-in fill gives the text colour
  const tinted=this.bitmaps.map(b=>{const c=new OffscreenCanvas(b.width,b.height),g=c.getContext('2d');g.drawImage(b,0,0);if(!this.model.keepColor){g.globalCompositeOperation='source-in';g.fillStyle=opts.color;g.fillRect(0,0,b.width,b.height);}return c;});
  for(const ln of lines){
   x.fillStyle='rgba(255,255,255,.45)';x.font=`${Math.round(10*dpr)}px system-ui,sans-serif`;x.fillText(`${ln.px}px${Number.isInteger(ln.px/this.model.size)?'':' ~'}`,4*dpr,ln.y+10*dpr);
   const oy=ln.y+14*dpr,ox=8*dpr;x.imageSmoothingEnabled=!Number.isInteger(ln.k);
   for(const it of ln.l.items){if(!it.glyph||!it.glyph.w)continue;const g=it.glyph;
    x.drawImage(tinted[g.page],g.x,g.y,g.w,g.h,Math.round(ox+it.x*ln.k),Math.round(oy+it.y*ln.k),Math.round(g.w*ln.k),Math.round(g.h*ln.k));}
  }
 }
 drawGL(lines,opts,W,H,dpr){
  if(!this.gl){const c=document.createElement('canvas');c.className=this.canvas.className;this.canvas.replaceWith?.(c);this.canvas=c;c.width=W;c.height=H;c.style.width=`${W/dpr}px`;c.style.height=`${H/dpr}px`;
   const gl=c.getContext('webgl2',{premultipliedAlpha:false,antialias:false});if(!gl){this.draw2d(lines,opts,W,H,dpr);return;}this.gl=gl;
   const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
   const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);this.prog=p;this.buf=gl.createBuffer();this.textures=[];}
  const gl=this.gl,m=this.model,p=this.prog;
  if(!this.textures.length)this.textures=this.bitmaps.map(b=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,b);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;});
  gl.viewport(0,0,W,H);const bg=hex(opts.background);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(p);
  const U=n=>gl.getUniformLocation(p,n);gl.uniform2f(U('uView'),W,H);gl.uniform1i(U('uMode'),{sdf:0,psdf:0,msdf:1,mtsdf:2}[m.type]+(m.alphaOnly?3:0));gl.uniform1i(U('uRaw'),opts.raw?1:0);
  const aPos=gl.getAttribLocation(p,'aPos'),aUV=gl.getAttribLocation(p,'aUV');gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);
  gl.enableVertexAttribArray(aPos);gl.enableVertexAttribArray(aUV);gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,16,8);
  const pass=(ln,dx,dy,fill,line,lineW,soft)=>{
   const byPage=new Map(),oy=ln.y+14*dpr+dy,ox=8*dpr+dx;
   for(const it of ln.l.items){if(!it.glyph||!it.glyph.w)continue;const g=it.glyph,pg=m.pages[g.page],x0=ox+it.x*ln.k,y0=oy+it.y*ln.k,x1=x0+g.w*ln.k,y1=y0+g.h*ln.k;
    const u0=g.x/pg.width,v0=g.y/pg.height,u1=(g.x+g.w)/pg.width,v1=(g.y+g.h)/pg.height;let a=byPage.get(g.page);if(!a)byPage.set(g.page,a=[]);
    a.push(x0,y0,u0,v0,x1,y0,u1,v0,x0,y1,u0,v1,x1,y0,u1,v0,x1,y1,u1,v1,x0,y1,u0,v1);}
   gl.uniform1f(U('uPxRange'),Math.max(1,m.distanceRange*ln.k));gl.uniform4fv(U('uFill'),fill);gl.uniform4fv(U('uLine'),line);gl.uniform1f(U('uLineW'),lineW);gl.uniform1f(U('uSoft'),soft);
   for(const [page,a] of byPage){gl.bindTexture(gl.TEXTURE_2D,this.textures[page]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STREAM_DRAW);gl.drawArrays(gl.TRIANGLES,0,a.length/4);}
  };
  for(const ln of lines){
   if(opts.shadow?.on)pass(ln,opts.shadow.x*dpr,opts.shadow.y*dpr,[...hex(opts.shadow.color).slice(0,3),.8],[0,0,0,0],0,Math.max(.5,opts.shadow.soft*dpr));
   pass(ln,0,0,hex(opts.color),hex(opts.outlineColor),Math.max(0,(opts.outline||0)*dpr),0);
  }
 }
}
