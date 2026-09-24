/** 3D material preview (bottom panel): the picture and its maps on a sphere or a plane, lit by a
 * metallic-roughness model (GGX / Smith / Schlick, one key light + a sky/ground ambient). WebGL2
 * in its own canvas; drag to turn the object. Maps come from the PBR set of the picture (by file
 * name / role, see the Maps panel) or from what the workspace generated; a map that is missing is a
 * constant you set here, and the panel says which is which. */
import {h} from '../../ui/dom.js';
import * as P from '../../core/project.js';
const VS=`#version 300 es
in vec3 aPos;in vec3 aNrm;in vec3 aTan;in vec2 aUV;
uniform mat4 uMVP,uModel;out vec3 vN;out vec3 vT;out vec2 vUV;out vec3 vW;
void main(){vN=mat3(uModel)*aNrm;vT=mat3(uModel)*aTan;vUV=aUV;vec4 w=uModel*vec4(aPos,1.0);vW=w.xyz;gl_Position=uMVP*vec4(aPos,1.0);}`;
const FS=`#version 300 es
precision highp float;in vec3 vN;in vec3 vT;in vec2 vUV;in vec3 vW;out vec4 o;
uniform sampler2D uAlb,uNrm,uRough,uMetal,uAO;uniform vec2 uRep;uniform int uFlipG;uniform vec3 uL;uniform vec3 uEye;
uniform float uRoughK,uMetalK;uniform int uHasRough,uHasMetal,uHasAO,uOrm;
const float PI=3.14159265;
void main(){
 vec2 uv=vUV*uRep;vec4 a=texture(uAlb,uv);vec3 alb=pow(a.rgb,vec3(2.2));
 vec3 nb=texture(uNrm,uv).rgb*2.0-1.0;if(uFlipG==1)nb.g=-nb.g;
 vec3 N0=normalize(vN),T=normalize(vT-N0*dot(N0,vT)),B=cross(N0,T);
 // B = N×T points up the image (texture rows grow downward, OpenGL green is up)
 vec3 N=normalize(T*nb.r+B*nb.g+N0*nb.b);
 vec4 orm=texture(uRough,uv);
 float rough=uHasRough==1?(uOrm==1?orm.g:orm.r):uRoughK;float metal=uHasMetal==1?(uOrm==1?texture(uRough,uv).b:texture(uMetal,uv).r):uMetalK;float ao=uHasAO==1?(uOrm==1?orm.r:texture(uAO,uv).r):1.0;
 rough=clamp(rough,0.04,1.0);vec3 V=normalize(uEye-vW),L=normalize(uL),H=normalize(V+L);
 float NdL=max(dot(N,L),0.0),NdV=max(dot(N,V),1e-3),NdH=max(dot(N,H),0.0),VdH=max(dot(V,H),0.0);
 float a2=pow(rough,4.0),d=NdH*NdH*(a2-1.0)+1.0,D=a2/(PI*d*d);
 float k=(rough+1.0)*(rough+1.0)/8.0,G=(NdV/(NdV*(1.0-k)+k))*(NdL/(NdL*(1.0-k)+k));
 vec3 F0=mix(vec3(0.04),alb,metal),F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
 vec3 spec=D*G*F/max(4.0*NdV*NdL,1e-3),kd=(1.0-F)*(1.0-metal);
 vec3 col=(kd*alb/PI+spec)*NdL*3.2;
 vec3 amb=mix(vec3(0.10,0.09,0.08),vec3(0.20,0.24,0.30),N.y*0.5+0.5);
 col+=(kd*alb+F0*0.25)*amb*ao;
 col=col/(col+1.0);o=vec4(pow(col,vec3(1.0/2.2)),1.0);
}`;
function sphere(n=48){
 const pos=[],nrm=[],tan=[],uv=[],idx=[];
 for(let i=0;i<=n;i++){const th=i/n*Math.PI;for(let j=0;j<=n*2;j++){const ph=j/(n*2)*Math.PI*2,x=Math.sin(th)*Math.cos(ph),y=Math.cos(th),z=Math.sin(th)*Math.sin(ph);
  pos.push(x,y,z);nrm.push(x,y,z);tan.push(-Math.sin(ph),0,Math.cos(ph));uv.push(1-j/(n*2),i/n);}}
 const row=n*2+1;for(let i=0;i<n;i++)for(let j=0;j<n*2;j++){const a=i*row+j,b=a+row;idx.push(a,b,a+1,a+1,b,b+1);}
 // u runs right-to-left above so that, seen from the front, image-right is +X
 for(let k=0;k<tan.length;k+=3){tan[k]=-tan[k];tan[k+2]=-tan[k+2];}
 return {pos,nrm,tan,uv,idx};
}
function plane(){return {pos:[-1,-1,0,1,-1,0,-1,1,0,1,1,0],nrm:[0,0,1,0,0,1,0,0,1,0,0,1],tan:[1,0,0,1,0,0,1,0,0,1,0,0],uv:[0,1,1,1,0,0,1,0],idx:[0,1,2,2,1,3]};}
const mul=(a,b)=>{const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s;}return o;};
const persp=(f,asp,n,fa)=>{const t=1/Math.tan(f/2);return new Float32Array([t/asp,0,0,0,0,t,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0]);};
const rotY=a=>new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
const rotX=a=>new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
const trans=(x,y,z)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
export function createPreview3D(C){
 const {t,ctx}=C,prefs=C.prefs.threed;
 const canvas=h('canvas.tx-3d-canvas',{'aria-label':t('tex.p3d.label'),role:'img'});
 const controls=h('div.tx-3d-controls',{});
 const root=h('div.tx-3d',{},canvas,controls);
 let gl=null,prog=null,u={},meshes={},tex={},yaw=.6,pitch=.25,raf=0,dragging=null,consts={rough:.6,metal:0},maps={rough:null,metal:null,ao:null,orm:false},error='',key='';
 function init(){
  if(gl||error)return;
  gl=canvas.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});if(!gl){error=t('tex.p3d.noGL');return;}
  const sh=(ty,src)=>{const s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
  for(const n of ['uMVP','uModel','uAlb','uNrm','uRough','uMetal','uAO','uRep','uFlipG','uL','uEye','uRoughK','uMetalK','uHasRough','uHasMetal','uHasAO','uOrm'])u[n]=gl.getUniformLocation(prog,n);
  for(const [k,m] of Object.entries({sphere:sphere(),plane:plane()})){
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   const buf=(data,name,size)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const l=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,size,gl.FLOAT,false,0,0);};
   buf(m.pos,'aPos',3);buf(m.nrm,'aNrm',3);buf(m.tan,'aTan',3);buf(m.uv,'aUV',2);
   const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(m.idx),gl.STATIC_DRAW);
   meshes[k]={vao,n:m.idx.length};
  }
  for(const k of ['alb','nrm','rough','metal','ao']){tex[k]=gl.createTexture();upload(k,new Uint8Array([200,200,200,255]),1,1);}
 }
 function upload(k,data,w,hgt,gray=false){
  const d=gray?Uint8Array.from({length:w*hgt*4},(_,i)=>i%4===3?255:data[i>>2]):data;
  gl.bindTexture(gl.TEXTURE_2D,tex[k]);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,hgt,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
  gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 }
 const crop=(src,W,r,ch=4)=>{const o=new Uint8Array(r.w*r.h*ch);for(let y=0;y<r.h;y++)o.set(src.subarray(((r.y+y)*W+r.x)*ch,((r.y+y)*W+r.x+r.w)*ch),y*r.w*ch);return o;};
 /** Re-uploads the maps when the picture, the normal map or the set changed. */
 async function update(){
  if(!visible())return;init();if(error){renderControls();return;}
  const S=C.S,pic=S.pic,g=S.gen,a=C.asset();if(!pic||!a){draw();return;}
  const r=C.region(),members=C.setMembers(),find=role=>members.find(m=>m.role===role&&m.asset.id!==a.id);
  const k=JSON.stringify([pic.key,r,!!g,g?.normal?.length&&S.genKey,!!g?.ao,members.map(m=>m.asset.id+m.role)]);
  if(k!==key){
   key=k;upload('alb',crop(pic.rgba,pic.w,r),r.w,r.h);
   if(g)upload('nrm',crop(g.normal,pic.w,r),r.w,r.h);
   const orm=find('orm'),rough=find('roughness'),smooth=find('smoothness'),metal=find('metallic'),ao=find('ao');
   maps={rough:null,metal:null,ao:null,orm:false};
   const plane=async(m,invert=false)=>{const blob=ctx.images.get(P.primaryBlob(m.asset))?.blob;const d=await C.work({op:'decode',bytes:new Uint8Array(await blob.arrayBuffer())});const p=Uint8Array.from({length:d.width*d.height},(_,i)=>invert?255-d.data[i*4]:d.data[i*4]);return {p,d};};
   try{
    if(orm){const blob=ctx.images.get(P.primaryBlob(orm.asset))?.blob;const d=await C.work({op:'decode',bytes:new Uint8Array(await blob.arrayBuffer())});upload('rough',crop(d.data,d.width,r),r.w,r.h);maps.orm=true;maps.rough=orm.asset.name;maps.metal=orm.asset.name;maps.ao=orm.asset.name;}
    else{
     const rs=rough||smooth;if(rs){const {p,d}=await plane(rs,!rough);upload('rough',crop(p,d.width,r,1),r.w,r.h,true);maps.rough=rs.asset.name;}
     if(metal){const {p,d}=await plane(metal);upload('metal',crop(p,d.width,r,1),r.w,r.h,true);maps.metal=metal.asset.name;}
     if(ao){const {p,d}=await plane(ao);upload('ao',crop(p,d.width,r,1),r.w,r.h,true);maps.ao=ao.asset.name;}
     else if(g?.ao){upload('ao',crop(g.ao,pic.w,r,1),r.w,r.h,true);maps.ao=t('tex.p3d.generatedAO');}
    }
   }catch(err){error=String(err.message||err);}
   renderControls();
  }
  draw();
 }
 function draw(){
  if(!gl||error)return;
  const W=Math.max(1,Math.round(canvas.clientWidth*devicePixelRatio)),H=Math.max(1,Math.round(canvas.clientHeight*devicePixelRatio));
  if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
  gl.viewport(0,0,W,H);gl.clearColor(.09,.1,.11,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);
  if(!C.S.pic)return;
  const shape=prefs.shape,model=mul(rotY(yaw),rotX(pitch)),view=trans(0,0,-3.2),proj=persp(.8,W/H,.1,20),mvp=mul(proj,mul(view,model));
  gl.useProgram(prog);gl.uniformMatrix4fv(u.uMVP,false,mvp);gl.uniformMatrix4fv(u.uModel,false,model);
  ['alb','nrm','rough','metal','ao'].forEach((k,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex[k]);});
  gl.uniform1i(u.uAlb,0);gl.uniform1i(u.uNrm,1);gl.uniform1i(u.uRough,2);gl.uniform1i(u.uMetal,3);gl.uniform1i(u.uAO,4);
  const r=C.region(),asp=r?r.w/r.h:1;gl.uniform2f(u.uRep,shape==='sphere'?2:1,shape==='sphere'?Math.max(.5,Math.round(2/asp)/2):1);
  gl.uniform1i(u.uFlipG,C.isDX()?1:0);
  const L=C.entry()?.scene.lights[0];const lx=L?(L.x/Math.max(1,r.w)-.5)*2:-.6,ly=L?-(L.y/Math.max(1,r.h)-.5)*2:.7;gl.uniform3f(u.uL,lx,ly,.9);gl.uniform3f(u.uEye,0,0,3.2);
  gl.uniform1f(u.uRoughK,consts.rough);gl.uniform1f(u.uMetalK,consts.metal);gl.uniform1i(u.uHasRough,maps.rough?1:0);gl.uniform1i(u.uHasMetal,maps.metal?1:0);gl.uniform1i(u.uHasAO,maps.ao?1:0);gl.uniform1i(u.uOrm,maps.orm?1:0);
  const m=meshes[shape]||meshes.sphere;gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0);
 }
 function loop(){cancelAnimationFrame(raf);if(!prefs.auto||!visible())return;raf=requestAnimationFrame(()=>{yaw+=.008;draw();loop();});}
 canvas.addEventListener('pointerdown',e=>{dragging={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-dragging.x)*.01;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-dragging.y)*.01));dragging={x:e.clientX,y:e.clientY};draw();});
 canvas.addEventListener('pointerup',()=>{dragging=null;});
 const ro=new ResizeObserver(()=>{if(visible()){update();loop();}});ro.observe(canvas);
 function visible(){return root.isConnected&&canvas.offsetParent!==null&&canvas.clientWidth>0;}
 function renderControls(){
  const seg=(v,l)=>{const b=h('button.tx-segbtn',{type:'button',role:'radio','aria-checked':String(prefs.shape===v),'data-k':'p3d-'+v},l);b.addEventListener('click',()=>{prefs.shape=v;C.savePrefs();renderControls();draw();});return b;};
  const auto=h('input',{type:'checkbox',checked:prefs.auto});auto.addEventListener('change',()=>{prefs.auto=auto.checked;C.savePrefs();loop();});
  const num=(k,label)=>{const i=h('input.tx-range',{type:'range',min:0,max:1,step:.01,value:consts[k],'aria-label':label});i.addEventListener('input',()=>{consts[k]=+i.value;draw();});return h('label.tx-slider.tx-slider-compact',{},h('span.tx-slider-label',{},label),i);};
  const src=(label,v)=>h('li',{},h('b',{},label),' ',v?v:h('i',{},t('tex.p3d.constant')));
  controls.replaceChildren(
   error?h('p.tx-note.is-warn',{},error):null,
   h('div.tx-seg',{role:'radiogroup','aria-label':t('tex.p3d.shape')},seg('sphere',t('tex.p3d.sphere')),seg('plane',t('tex.p3d.plane'))),
   h('label.st-check',{},auto,h('span',{},t('tex.p3d.auto'))),
   maps.rough?null:num('rough',t('tex.p3d.rough')),maps.metal?null:num('metal',t('tex.p3d.metal')),
   h('ul.tx-3d-maps',{},src(t('tex.role.normal'),C.S.gen?.imported?C.S.gen.importedName:t('tex.p3d.generated')),src(t('tex.role.roughness'),maps.rough),src(t('tex.role.metallic'),maps.metal),src(t('tex.role.ao'),maps.ao)),
   h('p.tx-note',{},t('tex.p3d.hint')));
 }
 return {root,update,renderControls,visible,destroy(){cancelAnimationFrame(raf);ro.disconnect();gl?.getExtension('WEBGL_lose_context')?.loseContext();}};
}
