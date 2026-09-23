/** The 2D lighting model of the Texture workspace — the SAME arithmetic as Godot 4's canvas
 * shader (drivers/gles3/shaders/canvas.glsl and servers/rendering/renderer_rd/shaders/canvas.glsl,
 * 4.x), so what the preview shows is what a Sprite2D + PointLight2D draws. This module is the CPU
 * reference: the WebGL2 preview mirrors it line for line, the unit tests pin it, and the Godot
 * verification compares Godot's pixels against it.
 *
 * Per pixel (canvas space: x right, y DOWN, z towards the viewer, units = pixels):
 *   base     = albedo (sRGB bytes / 255 — Godot's 2D lighting runs on the stored values)
 *   N        = (2r−1, −(2g−1), sqrt(1 − x² − y²))   OpenGL map; Godot flips green into y-down and
 *              rebuilds z from x and y (the stored blue is not read)
 *   colour   = base · ambient                          CanvasModulate
 *   for each point light:  L = normalize(light.xyz − (px, py, 0)),  F = falloff(distance / radius)
 *     colour += F · light.colour · energy · (base · max(0, N·L) + spec)
 *   spec     = Blinn term of canvas.glsl, only when a specular map is used
 * Rim light is a preview aid (no engine draws it without a custom shader) and is labelled so. */
export const FALLOFFS=Object.freeze(['smooth','linear','quadratic','constant']);
/** Light texture curve, t = distance / radius (0 centre … 1 edge). */
export function falloff(kind,t){
 if(t>=1)return 0;const s=t<0?0:t;
 switch(kind){
  case 'smooth':{const u=1-s*s;return u*u;}
  case 'linear':return 1-s;
  case 'quadratic':return (1-s)*(1-s);
  case 'constant':return 1;
  default:throw Error('Unknown falloff');
 }
}
/** The PointLight2D texture for a falloff: `size`² greyscale RGBA whose texel centres sample the
 * curve at their distance from the centre. Godot draws it `radius`·2 px wide
 * (texture_scale = 2·radius / size), so texel (i+.5)/size across = t. */
export function falloffTexture(kind,size=256){
 const out=new Uint8Array(size*size*4),c=size/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const t=Math.hypot(x+.5-c,y+.5-c)/c,v=Math.round(falloff(kind,t)*255),i=(y*size+x)*4;
  out[i]=out[i+1]=out[i+2]=v;out[i+3]=255;
 }
 return out;
}
const hex=c=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(c||''));const n=m?parseInt(m[1],16):0xffffff;return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
export const hexToRGB=hex;
/** A light as the document stores it. Positions are image pixels (x right, y down); z = height. */
export function normLight(l={}){
 return {id:String(l.id||'l1'),x:+l.x||0,y:+l.y||0,z:Math.max(0,Number.isFinite(+l.z)?+l.z:32),color:/^#[0-9a-f]{6}$/i.test(l.color||'')?l.color.toLowerCase():'#ffffff',
  energy:Math.max(0,Math.min(16,Number.isFinite(+l.energy)?+l.energy:1)),radius:Math.max(1,Math.min(8192,+l.radius||256)),falloff:FALLOFFS.includes(l.falloff)?l.falloff:'smooth',enabled:l.enabled!==false};
}
/** Godot's specular: shininess from the specular map's alpha, a normalised Blinn lobe. */
function blinn(N,L,specA){
 const V=[0,0,1],hx=L[0],hy=L[1],hz=L[2]+1,hl=Math.hypot(hx,hy,hz)||1,H=[hx/hl,hy/hl,hz/hl];
 const NdotV=Math.max(N[2],0),NdotH=Math.max(N[0]*H[0]+N[1]*H[1]+N[2]*H[2],0),NdotL=Math.max(0,N[0]*L[0]+N[1]*L[1]+N[2]*L[2]);
 const sh=Math.pow(2,15*specA+1)*.25;let b=Math.pow(NdotH,sh);b*=(sh+8)/(8*Math.PI);
 return b/Math.max(4*NdotV*NdotL,.75);
}
/** Shades one pixel. `albedo` 0…1 RGBA, `nrm` RGB bytes of an OpenGL map, `spec` optional
 * [r,g,b,a] 0…1 (specular map × specular colour), (px, py) the pixel centre in canvas px. */
export function shade(albedo,nrm,px,py,scene,spec=null){
 const nx=nrm[0]/255*2-1,ny=-(nrm[1]/255*2-1),nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny)),N=[nx,ny,nz];
 const amb=hex(scene.ambient??'#333333'),out=[albedo[0]*amb[0],albedo[1]*amb[1],albedo[2]*amb[2]];
 for(const raw of scene.lights||[]){
  const l=normLight(raw);if(!l.enabled)continue;
  const dx=l.x-px,dy=l.y-py,dist=Math.hypot(dx,dy),F=falloff(l.falloff,dist/l.radius);if(F<=0)continue;
  const len=Math.hypot(dx,dy,l.z)||1,L=[dx/len,dy/len,l.z/len],NdotL=Math.max(0,nx*L[0]+ny*L[1]+nz*L[2]);
  const c=hex(l.color),k=F*l.energy;
  for(let i=0;i<3;i++){let v=c[i]*k*albedo[i]*NdotL;if(spec)v+=c[i]*k*spec[i]*blinn(N,L,spec[3]);out[i]+=v;}
 }
 if(scene.rim&&scene.rim.strength>0){
  const rc=hex(scene.rim.color||'#ffffff'),r=Math.pow(Math.max(0,1-nz),scene.rim.power??2)*scene.rim.strength;
  for(let i=0;i<3;i++)out[i]+=albedo[i]*rc[i]*r;
 }
 return out;
}
/** Renders a lit image (RGBA bytes, straight alpha = the albedo's). `origin` places the image in
 * canvas space (the lights use image pixels, so the default is 0,0). `flipGreen` reads a DirectX
 * map. `specular` optional RGBA bytes map; `specularColor` [r,g,b,shininess] multiplies it. */
export function renderLit(albedo,normal,w,h,scene,{origin={x:0,y:0},flipGreen=false,specular=null,specularColor=[1,1,1,1]}={}){
 if(albedo.length!==w*h*4||normal.length!==w*h*4)throw Error('Albedo and normal must be RGBA of the same size');
 const out=new Uint8Array(w*h*4),a=[0,0,0,0],n=[0,0,0],s=[0,0,0,0];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  a[0]=albedo[i]/255;a[1]=albedo[i+1]/255;a[2]=albedo[i+2]/255;a[3]=albedo[i+3]/255;
  n[0]=normal[i];n[1]=flipGreen?255-normal[i+1]:normal[i+1];n[2]=normal[i+2];
  let sp=null;if(specular){for(let c=0;c<4;c++)s[c]=specular[i+c]/255*specularColor[c];sp=s;}
  const c=shade(a,n,origin.x+x+.5,origin.y+y+.5,scene,sp);
  out[i]=Math.min(255,Math.round(c[0]*255));out[i+1]=Math.min(255,Math.round(c[1]*255));out[i+2]=Math.min(255,Math.round(c[2]*255));out[i+3]=albedo[i+3];
 }
 return out;
}
/** Default lighting for a picture of w×h: one warm key light up-left, a cool ambient. */
export function defaultScene(w,h){
 return {ambient:'#3a3f4d',lights:[{id:'l1',x:Math.round(w*.25),y:Math.round(h*.2),z:Math.round(Math.max(8,Math.min(w,h)*.35)),color:'#ffe2b8',energy:1.2,radius:Math.round(Math.max(w,h)*1.2),falloff:'smooth',enabled:true}],rim:{strength:0,color:'#9fd0ff',power:2},specular:{strength:0,shininess:.5}};
}
