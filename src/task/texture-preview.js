import {presetChannels} from '../game/texture-presets.js';
/** Material preview stage: WebGL2, hand-written shaders, no library and no new CDN. It is an
 * approximation on purpose — GGX specular, one directional light and a flat ambient term — and
 * says so in the UI. Textures are uploaded straight from the files as ImageBitmaps (no RGBA
 * copies), and every GL object is deleted when a map changes or the stage is left.
 * Roughness / metallic / occlusion are read through a channel selector, so one ORM texture can
 * drive all three exactly the way the engine preset says it does. */
export const SHAPES=Object.freeze(['sphere','cube','plane']);
const ROLE_SLOTS=Object.freeze(['albedo','normal','roughness','metallic','ao','emission']);
const VERT=`#version 300 es
in vec3 aPos;in vec3 aNormal;in vec4 aTangent;in vec2 aUV;
uniform mat4 uProj,uView,uModel;uniform mat3 uNormalMat;uniform float uTiling;
out vec3 vPos;out vec3 vN;out vec3 vT;out vec3 vB;out vec2 vUV;
void main(){vec4 world=uModel*vec4(aPos,1.0);vPos=world.xyz;vN=normalize(uNormalMat*aNormal);vT=normalize(uNormalMat*aTangent.xyz);vB=normalize(cross(vN,vT)*aTangent.w);vUV=aUV*uTiling;gl_Position=uProj*uView*world;}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vPos;in vec3 vN;in vec3 vT;in vec3 vB;in vec2 vUV;
uniform sampler2D uAlbedo,uNormal,uRough,uMetal,uAO,uEmission;
uniform vec4 uRoughSel,uMetalSel,uAOSel;
uniform float hasAlbedo,hasNormal,hasRough,hasMetal,hasAO,hasEmission;
uniform vec3 uLightDir,uCamPos,uBaseColor;
uniform float uRoughness,uMetallic,uNormalStrength,uGreenFlip,uInvertRough,uLight;
out vec4 outColor;
const float PI=3.141592653589793;
vec3 toLinear(vec3 c){return pow(c,vec3(2.2));}
void main(){
 vec3 albedo=hasAlbedo>0.5?toLinear(texture(uAlbedo,vUV).rgb):uBaseColor;
 float rough=hasRough>0.5?dot(texture(uRough,vUV),uRoughSel):uRoughness;
 if(uInvertRough>0.5)rough=1.0-rough;
 float metal=hasMetal>0.5?dot(texture(uMetal,vUV),uMetalSel):uMetallic;
 float ao=hasAO>0.5?dot(texture(uAO,vUV),uAOSel):1.0;
 vec3 emission=hasEmission>0.5?toLinear(texture(uEmission,vUV).rgb):vec3(0.0);
 vec3 N=gl_FrontFacing?normalize(vN):-normalize(vN);
 if(hasNormal>0.5){
  vec3 n=texture(uNormal,vUV).xyz*2.0-1.0;n.y*=uGreenFlip;n.xy*=uNormalStrength;
  N=normalize(mat3(normalize(vT),normalize(vB),N)*normalize(n));
 }
 vec3 V=normalize(uCamPos-vPos),L=normalize(uLightDir),H=normalize(V+L);
 float NdL=max(dot(N,L),0.0),NdV=max(dot(N,V),1e-4),NdH=max(dot(N,H),0.0),VdH=max(dot(V,H),0.0);
 rough=clamp(rough,0.04,1.0);metal=clamp(metal,0.0,1.0);
 float a=rough*rough,a2=a*a,d=NdH*NdH*(a2-1.0)+1.0;
 float D=a2/(PI*d*d),k=a*0.5;
 float G=(NdV/(NdV*(1.0-k)+k))*(NdL/(NdL*(1.0-k)+k));
 vec3 F0=mix(vec3(0.04),albedo,metal),F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
 vec3 spec=D*G*F/(4.0*NdV*NdL+1e-4)*NdL;
 vec3 diffuse=(1.0-metal)*albedo/PI*NdL;
 vec3 ambient=albedo*0.22*ao*(1.0-metal*0.6);
 vec3 color=(diffuse+spec)*uLight+ambient+emission;
 color=color/(color+1.0);
 outColor=vec4(pow(color,vec3(1.0/2.2)),1.0);
}`;
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2),range=near-far;
 return [f/aspect,0,0,0,0,f,0,0,0,0,(near+far)/range,-1,0,0,near*far*2/range,0];
}
function lookAt(eye,target,up){
 const z=normalize([eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]]);
 const x=normalize(cross(up,z)),y=cross(z,x);
 return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normalize=v=>{const l=Math.hypot(...v)||1;return [v[0]/l,v[1]/l,v[2]/l];};
/** Geometry with per-vertex tangents, so a normal map has a frame to be rotated into. */
function geometry(shape){
 const positions=[],normals=[],tangents=[],uvs=[],indices=[];
 if(shape==='sphere'){
  const rings=48,sectors=64;
  for(let y=0;y<=rings;y++)for(let x=0;x<=sectors;x++){
   const u=x/sectors,v=y/rings,phi=u*Math.PI*2,theta=v*Math.PI;
   const nx=Math.cos(phi)*Math.sin(theta),ny=Math.cos(theta),nz=Math.sin(phi)*Math.sin(theta);
   positions.push(nx,ny,nz);normals.push(nx,ny,nz);
   tangents.push(-Math.sin(phi),0,Math.cos(phi),1);uvs.push(u,v);
  }
  for(let y=0;y<rings;y++)for(let x=0;x<sectors;x++){
   const a=y*(sectors+1)+x,b=a+sectors+1;
   indices.push(a,b,a+1,a+1,b,b+1);
  }
 }else if(shape==='cube'){
  const faces=[[[0,0,1],[1,0,0]],[[0,0,-1],[-1,0,0]],[[1,0,0],[0,0,-1]],[[-1,0,0],[0,0,1]],[[0,1,0],[1,0,0]],[[0,-1,0],[1,0,0]]];
  faces.forEach(([n,t],face)=>{
   const b=cross(n,t);
   for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
    const su=(u*2-1),sv=(1-v*2);
    positions.push(n[0]+t[0]*su+b[0]*sv,n[1]+t[1]*su+b[1]*sv,n[2]+t[2]*su+b[2]*sv);
    normals.push(...n);tangents.push(t[0],t[1],t[2],1);uvs.push(u,v);
   }
   const o=face*4;indices.push(o,o+1,o+2,o,o+2,o+3);
  });
 }else{
  for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
   positions.push(u*2-1,1-v*2,0);normals.push(0,0,1);tangents.push(1,0,0,1);uvs.push(u,v);
  }
  indices.push(0,1,2,0,2,3);
 }
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),tangents:new Float32Array(tangents),uvs:new Float32Array(uvs),indices:new Uint16Array(indices)};
}
let gl=null,program=null,buffers=null,vao=null,textures=new Map(),shape='',pending=0,view={yaw:.6,pitch:.2,light:.8,tiling:1,shape:'sphere',normalStrength:1,greenFlip:1,roughness:.5,metallic:0,invertRough:false,exposure:3.4},assign={},ready=false;
function compile(context,type,source){
 const shader=context.createShader(type);
 context.shaderSource(shader,source);context.compileShader(shader);
 if(!context.getShaderParameter(shader,context.COMPILE_STATUS)){const log=context.getShaderInfoLog(shader);context.deleteShader(shader);throw Error('Shader: '+log);}
 return shader;
}
function setup(canvas){
 gl=canvas.getContext('webgl2',{antialias:true,alpha:false,premultipliedAlpha:false});
 if(!gl)return false;
 const vertex=compile(gl,gl.VERTEX_SHADER,VERT),fragment=compile(gl,gl.FRAGMENT_SHADER,FRAG);
 program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
 gl.deleteShader(vertex);gl.deleteShader(fragment);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program: '+gl.getProgramInfoLog(program));
 gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.07,.08,.1,1);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 ready=true;return true;
}
function upload(name){
 const {positions,normals,tangents,uvs,indices}=geometry(name);
 if(buffers)for(const [key,buffer] of Object.entries(buffers))if(key!=='count')gl.deleteBuffer(buffer);
 if(vao)gl.deleteVertexArray(vao);
 vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const make=(data,location,size)=>{
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  const index=gl.getAttribLocation(program,location);
  gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,0,0);return buffer;
 };
 buffers={position:make(positions,'aPos',3),normal:make(normals,'aNormal',3),tangent:make(tangents,'aTangent',4),uv:make(uvs,'aUV',2)};
 buffers.index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffers.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
 buffers.count=indices.length;shape=name;
}
/** Binds the entry's texture to `unit`, creating it on first use. Creation also binds, so the
 * unit is selected before any bind: otherwise a lazily created texture would replace whatever
 * the previously active unit was holding, and a later role's map would be read as an earlier
 * one's (albedo showing the roughness map, which is exactly what happened once). */
async function textureFor(entry,unit){
 const key=String(entry.id),existing=textures.get(key);
 if(existing){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,existing);return existing;}
 const bitmap=await createImageBitmap(entry.file);
 try{
  const texture=gl.createTexture();
  gl.activeTexture(gl.TEXTURE0+unit);
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  textures.set(key,texture);return texture;
 }finally{bitmap.close();}
}
function releaseTextures(keep=new Set()){
 for(const [key,texture] of [...textures])if(!keep.has(key)){gl?.deleteTexture(texture);textures.delete(key);}
}
function releaseAll(){
 if(!gl)return;
 releaseTextures();
 if(buffers)for(const [key,buffer] of Object.entries(buffers))if(key!=='count')gl.deleteBuffer(buffer);
 if(vao)gl.deleteVertexArray(vao);
 if(program)gl.deleteProgram(program);
 gl.getExtension('WEBGL_lose_context')?.loseContext();
 gl=null;program=null;buffers=null;vao=null;shape='';ready=false;
}
const SELECTORS={r:[1,0,0,0],g:[0,1,0,0],b:[0,0,1,0],a:[0,0,0,1]};
/** Sampler and "is it assigned" uniform per role slot. */
const SLOT_UNIFORMS=Object.freeze({albedo:['uAlbedo','hasAlbedo'],normal:['uNormal','hasNormal'],roughness:['uRough','hasRough'],metallic:['uMetal','hasMetal'],ao:['uAO','hasAO'],emission:['uEmission','hasEmission']});
/** Which channel of the assigned texture each scalar map reads: an ORM texture uses the
 * preset's own letters, a dedicated greyscale map uses R. */
function selectorFor(role,entry,preset){
 if(entry?.role!=='orm')return SELECTORS.r;
 const found=presetChannels(preset).find(c=>c.role===(role==='roughness'?'roughness':role));
 return SELECTORS[found?.channel||'r'];
}
async function draw(ctx){
 if(!ready||!gl)return;
 const canvas=gl.canvas,rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
 const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round((rect.height||rect.width*.7)*dpr));
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 if(shape!==view.shape)upload(view.shape);
 gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const radius=view.shape==='plane'?3:3.2;
 const eye=[radius*Math.cos(view.pitch)*Math.sin(view.yaw),radius*Math.sin(view.pitch),radius*Math.cos(view.pitch)*Math.cos(view.yaw)];
 const uniform=name=>gl.getUniformLocation(program,name);
 gl.uniformMatrix4fv(uniform('uProj'),false,perspective(.9,width/height,.1,50));
 gl.uniformMatrix4fv(uniform('uView'),false,lookAt(eye,[0,0,0],[0,1,0]));
 gl.uniformMatrix4fv(uniform('uModel'),false,identity());
 gl.uniformMatrix3fv(uniform('uNormalMat'),false,[1,0,0,0,1,0,0,0,1]);
 gl.uniform1f(uniform('uTiling'),view.tiling);
 gl.uniform3fv(uniform('uCamPos'),eye);
 gl.uniform3fv(uniform('uLightDir'),normalize([Math.sin(view.light),.75,Math.cos(view.light)]));
 gl.uniform3fv(uniform('uBaseColor'),[.62,.62,.64]);
 gl.uniform1f(uniform('uRoughness'),view.roughness);gl.uniform1f(uniform('uMetallic'),view.metallic);
 gl.uniform1f(uniform('uNormalStrength'),view.normalStrength);gl.uniform1f(uniform('uGreenFlip'),view.greenFlip);
 gl.uniform1f(uniform('uInvertRough'),view.invertRough?1:0);gl.uniform1f(uniform('uLight'),view.exposure);
 const preset=ctx.state.channels.preset,keep=new Set();
 let unit=0;
 for(const role of ROLE_SLOTS){
  const entry=ctx.entryOf(assign[role]),[sampler,flag]=SLOT_UNIFORMS[role];
  if(!entry){gl.uniform1f(uniform(flag),0);continue;}
  await textureFor(entry,unit);keep.add(String(entry.id));
  gl.uniform1i(uniform(sampler),unit);
  gl.uniform1f(uniform(flag),1);
  if(role==='roughness')gl.uniform4fv(uniform('uRoughSel'),selectorFor('roughness',entry,preset));
  if(role==='metallic')gl.uniform4fv(uniform('uMetalSel'),selectorFor('metallic',entry,preset));
  if(role==='ao')gl.uniform4fv(uniform('uAOSel'),selectorFor('ao',entry,preset));
  unit++;
 }
 releaseTextures(keep);
 gl.bindVertexArray(vao);
 gl.drawElements(gl.TRIANGLES,buffers.count,gl.UNSIGNED_SHORT,0);
}
const schedule=ctx=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{draw(ctx).catch(error=>ctx.toast(error?.message||String(error),{error:true}));});};
/** Default assignment from the roles the Inspect stage already worked out. */
function autoAssign(ctx){
 const pick=role=>ctx.state.files.find(f=>f.role===role)?.id||null;
 const orm=pick('orm');
 assign={albedo:pick('albedo'),normal:pick('normal'),roughness:pick('roughness')||pick('smoothness')||orm,metallic:pick('metallic')||orm,ao:pick('ao')||orm,emission:pick('emission')};
 view.invertRough=!ctx.state.files.find(f=>f.role==='roughness')&&!!ctx.state.files.find(f=>f.role==='smoothness');
}
export const previewStage={
 board(ctx){
  const {T,esc}=ctx;
  // Assign before the HTML is built, so the drop-downs show what the shader is actually using.
  if(!Object.keys(assign).length)autoAssign(ctx);
  return `<div class="view-head"><strong>${esc(T('previewTitle'))}</strong><span>${esc(T('previewApprox'))}</span></div>
<div class="tex-gl" id="texGLHost"><canvas id="texGL" tabindex="0" role="img" aria-label="${esc(T('previewCanvas'))}"></canvas><p class="tex-gl-fallback" id="texGLFallback" hidden>${esc(T('noWebGL'))}</p></div>
<p class="viewer-note">${esc(T('previewNote'))}</p>
<div class="tex-assign" id="texAssign">${ROLE_SLOTS.map(role=>`<label class="field"><span>${esc(ctx.roleLabel(role))}</span><select data-option="assign" data-role="${role}"><option value="">${esc(T('none'))}</option>${ctx.state.files.map(f=>`<option value="${f.id}" ${String(assign[role])===String(f.id)?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label>`).join('')}</div>`;
 },
 side(ctx){
  const {T,esc}=ctx;
  const range=(key,label,min,max,step)=>`<label class="field"><span>${esc(label)} <output>${view[key]}</output></span><input type="range" data-action="tex-view-range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${view[key]}"></label>`;
  return `<div class="summary" role="status" aria-live="polite"><div class="summary-big">${esc(T('shape.'+view.shape))}</div><div class="summary-line">${esc(T('previewSummary'))}</div></div>
<form class="options" id="texOptions" autocomplete="off">
<span class="opt-label">${esc(T('shapeLabel'))}</span><div class="segmented" role="group">${SHAPES.map(id=>`<button type="button" data-action="tex-view-shape" data-value="${id}" aria-pressed="${view.shape===id}">${esc(T('shape.'+id))}</button>`).join('')}</div>
${range('tiling',T('tiling'),1,8,1)}${range('light',T('lightAngle'),0,6.28,.05)}
<details class="options-advanced"><summary>${esc(ctx.text('advanced'))}</summary>
${range('yaw',T('yaw'),-3.14,3.14,.02)}${range('pitch',T('pitch'),-1.4,1.4,.02)}${range('normalStrength',T('normalStrength'),0,2,.1)}${range('roughness',T('fallbackRoughness'),0,1,.05)}${range('metallic',T('fallbackMetallic'),0,1,.05)}
<label class="check"><input type="checkbox" data-option="view-green" ${view.greenFlip<0?'checked':''}> ${esc(T('previewFlipGreen'))}</label>
<label class="check"><input type="checkbox" data-option="view-invert-rough" ${view.invertRough?'checked':''}> ${esc(T('previewSmoothness'))}</label>
<p class="hint">${esc(T('previewKeyboard'))}</p></details></form>
<button type="button" class="primary big" id="taskDownload" data-action="tex-stage" data-stage="export">${esc(T('goExport'))}</button>
<nav class="next"><span>${esc(T('nextStage'))}</span><button type="button" class="chip" data-action="tex-stage" data-stage="fix">${esc(T('stage.fix'))}</button></nav><small class="local-note">${esc(ctx.text('local'))}</small>`;
 },
 mounted(ctx){
  const canvas=ctx.q('#texGL');if(!canvas)return;
  try{
   if(!gl&&!setup(canvas))throw Error('no-webgl2');
   if(gl&&gl.canvas!==canvas){releaseAll();if(!setup(canvas))throw Error('no-webgl2');}
   schedule(ctx);
  }catch{
   canvas.hidden=true;const fallback=ctx.q('#texGLFallback');if(fallback)fallback.hidden=false;
   return;
  }
  let dragging=false,last=null;
  canvas.addEventListener('pointerdown',event=>{dragging=true;last=[event.clientX,event.clientY];canvas.setPointerCapture?.(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{
   if(!dragging)return;
   view.yaw-=(event.clientX-last[0])*.01;view.pitch=Math.max(-1.4,Math.min(1.4,view.pitch+(event.clientY-last[1])*.01));
   last=[event.clientX,event.clientY];schedule(ctx);
  });
  for(const type of ['pointerup','pointercancel','pointerleave'])canvas.addEventListener(type,()=>{dragging=false;});
  canvas.addEventListener('keydown',event=>{
   const step=event.shiftKey?.25:.08;
   const moves={ArrowLeft:()=>view.yaw-=step,ArrowRight:()=>view.yaw+=step,ArrowUp:()=>view.pitch=Math.min(1.4,view.pitch+step),ArrowDown:()=>view.pitch=Math.max(-1.4,view.pitch-step)};
   if(moves[event.key]){event.preventDefault();moves[event.key]();schedule(ctx);}
  });
 },
 input(target,ctx){
  if(target.dataset.action==='tex-view-range'){
   view[target.dataset.key]=Number(target.value);
   const out=target.closest('.field')?.querySelector('output');if(out)out.textContent=target.value;
   schedule(ctx);return;
  }
  if(target.dataset.option==='assign'){assign[target.dataset.role]=target.value||null;schedule(ctx);return;}
  if(target.dataset.option==='view-green'){view.greenFlip=target.checked?-1:1;schedule(ctx);return;}
  if(target.dataset.option==='view-invert-rough'){view.invertRough=target.checked;schedule(ctx);return;}
 },
 click(action,button,ctx){
  if(action==='tex-view-shape'){
   view.shape=SHAPES.includes(button.dataset.value)?button.dataset.value:'sphere';
   for(const other of button.parentElement.children)other.setAttribute('aria-pressed',String(other===button));
   schedule(ctx);
  }
 },
 leave(){cancelAnimationFrame(pending);releaseAll();},
 dispose(){cancelAnimationFrame(pending);releaseAll();assign={};}
};
