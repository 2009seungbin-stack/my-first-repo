/** The Texture workspace's canvas layer: a WebGL2 canvas inserted between the Studio's image canvas
 * and its overlay, drawn with the SAME view transform (device pixels, integer zoom, whole-pixel
 * origin), so zoom, pan, rulers and the overlay keep working exactly as elsewhere.
 *
 * It draws the working picture in any view — albedo, normal map, a grey map, or LIT with the
 * Godot-compatible model of src/game/normals/lighting.js (the shader below is that function,
 * line for line; tests/studio-texture-browser.py reads pixels back and compares them with it).
 * Texels are fetched exactly (texelFetch, no filtering) and lit at their centre, so at any zoom
 * the preview is a magnified 1:1 engine frame. A split line shows the unlit picture on its left. */
const VS=`#version 300 es
in vec2 aPos;uniform vec2 uViewport;uniform vec4 uRect;out vec2 vUV;
void main(){vec2 p=uRect.xy+aPos*uRect.zw;vUV=aPos;vec2 c=p/uViewport*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);}`;
const MAXL=8;
const FS=`#version 300 es
precision highp float;precision highp int;
in vec2 vUV;out vec4 o;
uniform sampler2D uAlb,uNrm,uMap;
uniform vec4 uRegion;uniform vec2 uDisp;uniform int uMode;uniform float uSplit;uniform int uFlipG;uniform int uMapAlpha;
uniform vec3 uAmb;uniform int uNL;uniform vec4 uLPos[${MAXL}];uniform vec4 uLCol[${MAXL}];uniform int uLFall[${MAXL}];
uniform vec4 uRim;uniform float uRimPow;uniform vec2 uSpec;
uniform int uBg;uniform vec3 uCA,uCB,uSolid;uniform float uChecker;uniform vec4 uCell;
float falloff(int k,float t){if(t>=1.0)return 0.0;float s=max(t,0.0);
 if(k==0){float u=1.0-s*s;return u*u;} if(k==1)return 1.0-s; if(k==2)return (1.0-s)*(1.0-s); return 1.0;}
float blinn(vec3 N,vec3 L,float a){vec3 H=normalize(L+vec3(0,0,1));float NdotV=max(N.z,0.0),NdotH=max(dot(N,H),0.0),NdotL=max(dot(N,L),0.0);
 float sh=exp2(15.0*a+1.0)*0.25;float b=pow(NdotH,sh)*(sh+8.0)/(8.0*3.14159265358979);return b/max(4.0*NdotV*NdotL,0.75);}
void main(){
 vec2 p=vUV*uDisp;vec2 lp=mod(p,uRegion.zw);ivec2 tp=ivec2(uRegion.xy+floor(lp));
 vec4 a=texelFetch(uAlb,tp,0);vec3 c;float alpha=a.a;
 int mode=uMode;if(uSplit>=0.0&&p.x<uSplit)mode=0;
 if(mode==0){c=a.rgb;}
 else if(mode==1){vec3 n=texelFetch(uNrm,tp,0).rgb;if(uFlipG==1)n.g=1.0-n.g;c=n;}
 else if(mode==2){vec4 m=texelFetch(uMap,tp,0);c=m.rgb;if(uMapAlpha==0)alpha=1.0;}
 else{
  vec3 nb=texelFetch(uNrm,tp,0).rgb;if(uFlipG==1)nb.g=1.0-nb.g;
  float nx=nb.r*2.0-1.0,ny=-(nb.g*2.0-1.0),nz=sqrt(max(0.0,1.0-nx*nx-ny*ny));vec3 N=vec3(nx,ny,nz);
  vec2 lpos=uCell.z>0.0?mod(p-uCell.xy,uCell.zw):lp;vec3 px=vec3(floor(lpos)+0.5,0.0);c=a.rgb*uAmb;
  float specA=uSpec.y;
  for(int i=0;i<${MAXL};i++){if(i>=uNL)break;
   vec3 d=uLPos[i].xyz-px;float dist=length(d.xy);float F=falloff(uLFall[i],dist/uLPos[i].w);if(F<=0.0)continue;
   vec3 L=normalize(d);float NdotL=max(0.0,dot(N,L));vec3 lc=uLCol[i].rgb*(F*uLCol[i].a);
   c+=lc*a.rgb*NdotL;if(uSpec.x>0.0)c+=lc*uSpec.x*blinn(N,L,specA);
  }
  if(uRim.a>0.0)c+=a.rgb*uRim.rgb*pow(max(0.0,1.0-nz),uRimPow)*uRim.a;
  c=min(c,vec3(1.0));
 }
 vec3 bg;if(uBg==0){vec2 q=floor(gl_FragCoord.xy/uChecker);bg=mod(q.x+q.y,2.0)<1.0?uCA:uCB;}else bg=uSolid;
 o=vec4(c*alpha+bg*(1.0-alpha),1.0);
}`;
export const FALL_INDEX={smooth:0,linear:1,quadratic:2,constant:3};
const hex=c=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(c||''));const n=m?parseInt(m[1],16):0;return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
export class LitView{
 constructor(view){
  this.view=view;this.canvas=document.createElement('canvas');this.canvas.className='cv-lit';
  Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
  view.stage.insertBefore(this.canvas,view.overlay);
  const gl=this.canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
  if(!gl)throw Error('WebGL2 unavailable');
  this.gl=gl;
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  this.p=p;const names=['uViewport','uRect','uAlb','uNrm','uMap','uRegion','uDisp','uMode','uSplit','uFlipG','uMapAlpha','uAmb','uNL','uLPos','uLCol','uLFall','uRim','uRimPow','uSpec','uBg','uCA','uCB','uSolid','uChecker','uCell'];
  this.u=Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]));
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(p,'aPos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  this.tex={alb:this.makeTex(),nrm:this.makeTex(),map:this.makeTex()};this.size={alb:null,nrm:null,map:null};
  this.state=null;this.enabled=true;
  this.off=view.on('render',()=>this.draw());
  this.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);
 }
 makeTex(){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const [k,v]of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));return t;}
 /** Uploads RGBA bytes (straight alpha) into slot 'alb' | 'nrm' | 'map'. Grey planes are expanded.
  * With `rect` only that part is replaced (a brush stroke). */
 upload(slot,data,w,h,{rect=null,gray=false}={}){
  const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.tex[slot]);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  if(rect&&this.size[slot]?.w===w&&this.size[slot]?.h===h)gl.texSubImage2D(gl.TEXTURE_2D,0,rect.x,rect.y,rect.w,rect.h,gl.RGBA,gl.UNSIGNED_BYTE,gray?expand(data,w,h,rect):sub(data,w,rect));
  else{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,gray?expand(data,w,h,null):data);this.size[slot]={w,h};}
  this.view.invalidate();
 }
 /** What to draw: {mode:'albedo'|'normal'|'map'|'lit', region:{x,y,w,h}, repeat:1|3, split:null|x,
  * flipGreen, mapAlpha, scene, cell}. `cell` = the frame grid of a whole sheet: lights are then
  * placed in each cell's own pixels, so every frame is lit alike. null hides the layer (the Studio's own image shows). */
 set(state){this.state=state;this.canvas.hidden=!state;this.view.invalidate();}
 draw(){
  const gl=this.gl,v=this.view.view,W=this.view.W,H=this.view.H,S=this.state;
  if(this.canvas.width!==W||this.canvas.height!==H){this.canvas.width=W;this.canvas.height=H;}
  gl.viewport(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  if(!S||!this.view.image||!this.size.alb)return;
  const r=S.region,rep=S.repeat||1,dw=r.w*rep,dh=r.h*rep,s=v.scale,u=this.u,o=this.view.options;
  gl.useProgram(this.p);gl.uniform2f(u.uViewport,W,H);gl.uniform4f(u.uRect,v.x,v.y,dw*s,dh*s);
  [['alb',0],['nrm',1],['map',2]].forEach(([k,i])=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.tex[k]);});
  gl.uniform1i(u.uAlb,0);gl.uniform1i(u.uNrm,1);gl.uniform1i(u.uMap,2);
  gl.uniform4f(u.uRegion,r.x,r.y,r.w,r.h);gl.uniform2f(u.uDisp,dw,dh);
  gl.uniform1i(u.uMode,{albedo:0,normal:1,map:2,lit:3}[S.mode]??0);gl.uniform1f(u.uSplit,S.split==null?-1:S.split);
  gl.uniform1i(u.uFlipG,S.flipGreen?1:0);gl.uniform1i(u.uMapAlpha,S.mapAlpha?1:0);
  const sc=S.scene||{lights:[]},lights=(sc.lights||[]).filter(l=>l.enabled!==false).slice(0,MAXL);
  gl.uniform3fv(u.uAmb,hex(sc.ambient||'#ffffff'));gl.uniform1i(u.uNL,lights.length);
  const pos=new Float32Array(4*MAXL),col=new Float32Array(4*MAXL),fall=new Int32Array(MAXL);
  lights.forEach((l,i)=>{pos.set([l.x,l.y,l.z,l.radius],i*4);col.set([...hex(l.color),l.energy],i*4);fall[i]=FALL_INDEX[l.falloff]??0;});
  gl.uniform4fv(u.uLPos,pos);gl.uniform4fv(u.uLCol,col);gl.uniform1iv(u.uLFall,fall);
  const rim=sc.rim||{};gl.uniform4f(u.uRim,...hex(rim.color||'#ffffff'),+rim.strength||0);gl.uniform1f(u.uRimPow,+rim.power||2);
  gl.uniform2f(u.uSpec,+sc.specular?.strength||0,+(sc.specular?.shininess??.5));
  gl.uniform1i(u.uBg,o.background==='checker'?0:1);gl.uniform3fv(u.uCA,hex(o.checkerA));gl.uniform3fv(u.uCB,hex(o.checkerB));gl.uniform3fv(u.uSolid,hex(o.solid));
  const cell=S.cell;gl.uniform4f(u.uCell,cell?cell.x:0,cell?cell.y:0,cell?cell.w:0,cell?cell.h:0);
  gl.uniform1f(u.uChecker,Math.max(2,Math.round((o.checkerCss||8)*this.view.dpr)));
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 /** Pixels of the drawn frame at device-pixel (x, y) (tests, pickers). */
 read(x,y){const gl=this.gl,out=new Uint8Array(4);gl.readPixels(x,this.canvas.height-1-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);return [...out];}
 destroy(){this.off?.();this.canvas.remove();this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
function sub(data,w,r){const out=new Uint8Array(r.w*r.h*4);for(let y=0;y<r.h;y++)out.set(data.subarray(((r.y+y)*w+r.x)*4,((r.y+y)*w+r.x+r.w)*4),y*r.w*4);return out;}
function expand(plane,w,h,r){
 const R=r||{x:0,y:0,w,h},out=new Uint8Array(R.w*R.h*4);
 for(let y=0;y<R.h;y++)for(let x=0;x<R.w;x++){const v=plane[(R.y+y)*w+R.x+x],i=(y*R.w+x)*4;out[i]=out[i+1]=out[i+2]=v;out[i+3]=255;}
 return out;
}
