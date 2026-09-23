/** Texture workspace (P4): sprite normal maps with live 2D lighting, and PBR texture tools.
 * Plug-in API only (docs/STUDIO.md); document state in settings.texture (state.js), so every edit
 * is one undo step, autosaves, and round-trips through .nerulio files. The pixel work is
 * src/game/normals/* (pure), run in texture-worker.js; the canvas is lit-view.js (WebGL2, the
 * Godot-compatible light model of src/game/normals/lighting.js).
 *
 * It reads the same document as the Sprite workspace: an asset's frames are its animation, so a
 * sheet cut there is lit here frame by frame, with lights placed in frame-local pixels. */
import './strings.js';
import * as P from '../../core/project.js';
import {h,storage} from '../../ui/dom.js';
import {ICONS} from '../../ui/icons.js';
import {zip} from '../../../core.js';
import {rgbaGetter} from '../../sprite/frame-render.js';
import {composeCanvas,composeFrame} from '../../sprite/frame-image.js';
import {steps,stepAt,rangeTag} from '../../sprite/playback.js';
import * as St from './state.js';
import {LitView} from './lit-view.js';
import {createPanels} from './panels.js';
import {createPreview3D} from './preview3d.js';
import {suggestParams,normalizeParams,regionAt,normalPatch} from '../../../game/normals/pipeline.js';
import {applyStroke} from '../../../game/normals/height.js';
import {renderLit,normLight} from '../../../game/normals/lighting.js';
import {bundleFiles,lightTexturesFor,safeBase} from '../../../game/normals/export.js';
import {heightToUint16,heightToBytes} from '../../../game/normals/maps.js';
import {encodeGray16PNG} from '../../../game/normals/png16.js';
import {encodeRGBAPNG,encodeGrayPNG} from '../../../game/texture-png.js';
import {flipGreen} from '../../../game/texture-normal.js';
import {dilateEdges} from '../../../game/texture-fix.js';
import {classifyTextureName,normalConvention} from '../../../game/texture-set.js';
const CSS_ID='texture-ws-css',PREFS='nerulio.studio.texture.v1';
const svg=b=>`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${b}</svg>`;
Object.assign(ICONS,{
 texLight:svg('<circle cx="8" cy="7" r="3"/><path d="M8 1.5v1.5M3.5 3l1 1M12.5 3l-1 1M2 7h1.5M12.5 7H14M6.5 12.5h3M7 14.5h2"/>'),
 texBrush:svg('<path d="M2.5 13.5c2-.3 3-1.3 3.2-3.2l6.8-7a1.4 1.4 0 012 2l-7 6.8c-1.9.2-2.9 1.2-3.2 3.2"/><path d="M9 6l1 1"/>'),
 texPlay:svg('<path d="M5 3.5v9l7-4.5z"/>'),texPause:svg('<path d="M5 3.5v9M11 3.5v9"/>')
});
const VIEW_MODES=['albedo','height','normal','lit','ao','maps'];
const DEFAULT_PREFS={view:'lit',scope:'frame',brush:{mode:'raise',r:6,s:.6,hard:.4},split:false,tile:false,map:'cavity',threed:{shape:'sphere',auto:true}};
let worker=null,seq=0;const waiting=new Map();
function work(msg,transfer=[]){
 worker||=Object.assign(new Worker(new URL('./texture-worker.js',import.meta.url),{type:'module'}),{onmessage:({data})=>{const w=waiting.get(data.id);if(!w)return;waiting.delete(data.id);data.ok?w.resolve(data.result):w.reject(Error(data.error));}});
 const id=++seq;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});worker.postMessage({...msg,id},transfer);});
}
const blank=new Map();
function blankCanvas(w,hgt){const k=w+'x'+hgt;let c=blank.get(k);if(!c){c=document.createElement('canvas');c.width=w;c.height=hgt;blank.clear();blank.set(k,c);}return c;}
const bytesOf=async b=>new Uint8Array(await (b instanceof Blob?b:new Blob([b])).arrayBuffer());
/** A grid all frames sit on (same size, aligned), so a whole lit sheet lights every frame alike. */
function uniformGrid(rects){
 if(rects.length<2)return null;const {w,h}=rects[0];
 if(!rects.every(r=>r.w===w&&r.h===h))return null;
 const ox=rects[0].x%w,oy=rects[0].y%h;
 return rects.every(r=>(r.x-ox)%w===0&&(r.y-oy)%h===0)?{x:ox,y:oy,w,h}:null;
}
export default {
 id:'texture',title:'ws.texture',status:'ready',summary:'ws.textureSummary',
 activate(ctx){
  const {t,view}=ctx;
  if(!document.getElementById(CSS_ID))document.head.append(h('link',{id:CSS_ID,rel:'stylesheet',href:new URL('./texture.css',import.meta.url).href}));
  const prefs={...DEFAULT_PREFS,...storage.get(PREFS,{})};prefs.brush={...DEFAULT_PREFS.brush,...prefs.brush};prefs.threed={...DEFAULT_PREFS.threed,...prefs.threed};
  if(!VIEW_MODES.includes(prefs.view))prefs.view='lit';
  const savePrefs=()=>storage.set(PREFS,prefs);
  // ---------------------------------------------------------------- view state (not in the document)
  const S={assetId:null,frame:0,playing:false,raf:0,playStart:0,tagId:null,split:null,selLight:null,hoverLight:null,brushAt:null,
   pic:null,gen:null,genKey:'',busy:false,error:'',detect:null,seam:null,maps:{},mips:null,importedNormal:null,heightPlane:null,drawn:''};
  let lit=null,glError='';
  try{lit=new LitView(view);}catch(e){glError=String(e.message||e);}
  const entry=()=>{
   const a=asset();if(!a)return null;
   const st=St.texState(ctx.doc),e=St.entryOf(st,a.id,frameSize());
   if(!e.has&&S.pic){e.params=suggestParams(S.pic.rgba,S.pic.w,S.pic.h,{pixelArt:isPixelArt()});if(!St.texState(ctx.doc).assets?.[a.id]?.scene)e.scene=defaultSceneFor();}
   return e;
  };
  const asset=()=>S.assetId?P.assetById(ctx.doc,S.assetId):null;
  const layout=()=>S.pic?.layout||null;
  const frameRects=()=>layout()?.frameRects||[];
  const frameSize=()=>{const r=frameRects()[S.frame];return r?{w:r.w,h:r.h}:{w:S.pic?.w||asset()?.width||64,h:S.pic?.h||asset()?.height||64};};
  const isPixelArt=()=>{const s=frameSize();return Math.max(s.w,s.h)<=128;};
  function defaultSceneFor(){const {w,h:hh}=frameSize();return {ambient:'#3a3f4d',lights:[normLight({id:'l1',x:Math.round(w*.22),y:Math.round(hh*.18),z:Math.round(Math.max(6,Math.min(w,hh)*.35)),color:'#ffe2b8',energy:1.2,radius:Math.round(Math.max(w,hh)*1.4),falloff:'smooth'})],rim:{strength:0,color:'#9fd0ff',power:2},specular:{strength:0,shininess:.5}};}
  /** Every document edit of this workspace: one undo step (drags merge by key). The entry is
   * created from the effective values the first time, so what was shown is what gets stored. */
  function edit(label,fn,opts){
   const a=asset();if(!a)return;const cur=entry(),size=frameSize();
   ctx.execute(ctx.edit(label,d=>St.withTexState(d,s=>{
    let st=s;if(!st.assets?.[a.id]){const {has,...plain}=cur;st={...st,assets:{...(st.assets||{}),[a.id]:plain}};}
    return fn(st,a.id,size);
   }),opts));
  }
  // ---------------------------------------------------------------- the working picture
  function picSignature(a){return JSON.stringify([a.width,a.height,a.layers.map(l=>[l.id,l.visible,l.opacity,l.blend]),a.cels.map(c=>[c.layerId,c.frameId,c.blob,c.x,c.y,c.opacity]),a.frames.map(f=>[f.id,f.sourceRect,f.trimmedRect,f.canvasWidth,f.canvasHeight,f.offsetX,f.offsetY])]);}
  async function loadPicture(a){
   const sig=picSignature(a);if(S.pic&&S.pic.assetId===a.id&&S.pic.sig===sig)return S.pic;
   const L=St.workingLayout(a);let rgba;
   const rgbaOf=await rgbaGetter(ctx.images,a,a.frames.length?a.frames:[{id:'*'}]);
   if(L.mode==='sheet')rgba=composeCanvas(a,'*',rgbaOf).data;
   else{rgba=new Uint8Array(L.width*L.height*4);a.frames.forEach((f,i)=>{const img=composeFrame(a,f,rgbaOf),r=L.frameRects[i];for(let y=0;y<img.height;y++)rgba.set(img.data.subarray(y*img.width*4,(y+1)*img.width*4),((r.y+y)*L.width+r.x)*4);});}
   const key=a.id+':'+hash(sig);
   await work({op:'put',key,rgba:rgba.slice(),w:L.width,h:L.height});
   return {assetId:a.id,sig,key,rgba,w:L.width,h:L.height,layout:L};
  }
  const hash=s=>{let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619);}return (x>>>0).toString(36);};
  // ---------------------------------------------------------------- related assets (PBR set, imported maps)
  function roleOf(a){const r=St.texState(ctx.doc).roles?.[a.id];if(r)return {role:r,declared:true,convention:normalConvention(a.name)};const c=classifyTextureName(a.name);return {role:c.role,declared:false,confidence:c.confidence,convention:normalConvention(a.name),setName:c.setName};}
  function setMembers(){
   const a=asset();if(!a)return [];const me=classifyTextureName(a.name).setName;
   return ctx.doc.assets.filter(x=>x.width===a.width&&x.height===a.height).map(x=>({asset:x,...roleOf(x),same:classifyTextureName(x.name).setName===me}));
  }
  // ---------------------------------------------------------------- generation
  let genTimer=0,genToken=0;
  const genKeyOf=e=>JSON.stringify([S.pic?.key,e.params,e.strokes.length,e.strokes[e.strokes.length-1]?.pts?.slice(0,4),e.normalFrom,e.params.heightMap.assetId]);
  function scheduleGen(delay=60){clearTimeout(genTimer);genTimer=setTimeout(runGen,delay);}
  async function runGen(){
   const a=asset(),pic=S.pic;if(!a||!pic||pic.assetId!==a.id)return;
   const e=entry(),key=genKeyOf(e);if(key===S.genKey&&S.gen)return;
   const token=++genToken;S.busy=true;renderStatus();
   try{
    let heightPlane=null;
    if(e.params.heightMap.assetId){heightPlane=await heightPlaneOf(e.params.heightMap.assetId,pic);}
    const r=await work({op:'generate',key:pic.key,regions:pic.layout.regions,params:e.params,strokes:e.strokes,heightPlane,ao:needAO()});
    if(token!==genToken)return;
    let normal=r.normal,imported=null;
    if(e.normalFrom){imported=await importedNormal(e.normalFrom,pic);if(token!==genToken)return;if(imported)normal=imported.data;}
    S.gen={...r,normal,imported:!!imported,importedName:imported?.name||'',w:pic.w,h:pic.h};S.genKey=key;S.error='';S.maps={};S.mips=null;
    if(lit){lit.upload('nrm',normal,pic.w,pic.h);}
    uploadMap();present2d();
    if(e.normalFrom&&imported)runDetect(imported.data,pic.w,pic.h,'imported');
    else if(roleOf(a).role==='normal')runDetect(pic.rgba,pic.w,pic.h,'self');
    else S.detect=null;
    if(e.params.kind==='texture')runSeam();else S.seam=null;
   }catch(err){if(token===genToken){S.error=String(err.message||err);}}
   finally{if(token===genToken){S.busy=false;renderStatus();panels.render();threeD.update();}}
  }
  async function heightPlaneOf(id,pic){
   const h2=P.assetById(ctx.doc,id);if(!h2||h2.width!==pic.w||h2.height!==pic.h)return null;
   const blob=ctx.images.get(P.primaryBlob(h2))?.blob;if(!blob)return null;
   const k='h:'+P.primaryBlob(h2);if(S.heightPlane?.k===k)return S.heightPlane.v;
   const d=await work({op:'decode',bytes:await bytesOf(blob)});
   const v=d.gray?{samples:d.gray.samples,max:65535}:{samples:Uint8Array.from({length:d.width*d.height},(_,p)=>d.data[p*4]),max:255};
   S.heightPlane={k,v};return v;
  }
  async function importedNormal(id,pic){
   const n=P.assetById(ctx.doc,id);if(!n||n.width!==pic.w||n.height!==pic.h)return null;
   const k='n:'+P.primaryBlob(n);if(S.importedNormal?.k===k)return S.importedNormal.v;
   const blob=ctx.images.get(P.primaryBlob(n))?.blob;if(!blob)return null;
   const d=await work({op:'decode',bytes:await bytesOf(blob)});
   const v={data:d.data,name:n.name};S.importedNormal={k,v};return v;
  }
  async function runDetect(rgba,w,hh,source){
   // a sprite's own alpha tells the silhouette test where the edge is
   let data=rgba;if(source==='imported'&&S.pic){data=new Uint8Array(rgba);for(let p=0;p<w*hh;p++)data[p*4+3]=S.pic.rgba[p*4+3];}
   try{const r=await work({op:'detect',rgba:data.slice(),w,h:hh});S.detect={...r,source};panels.render();}catch{}
  }
  async function runSeam(){
   const e=entry();if(!S.gen||!S.pic)return;
   try{S.seam=await work({op:'seam',key:S.pic.key,params:e.params,normal:S.gen.normal.slice()});panels.render();}catch{}
  }
  const needAO=()=>prefs.view==='ao'||threeD.visible();
  /** Occlusion is computed when something shows or exports it (it is the slowest map). */
  async function ensureAO(){
   if(!S.gen||S.gen.ao||S.gen.imported)return S.gen?.ao||null;
   const e=entry(),g=S.gen,r=await work({op:'ao',height:g.height.slice(),w:S.pic.w,h:S.pic.h,params:e.params,regions:S.pic.layout.regions,mask:g.mask?g.mask.slice():null});
   if(S.gen===g){g.ao=r.ao;uploadMap();threeD.update();}return r.ao;
  }
  async function ensureMap(kind){
   if(!S.gen||S.maps[kind])return;
   const e=entry();const r=await work({op:'maps',key:S.pic.key,height:S.gen.height.slice(),params:e.params,regions:S.pic.layout.regions,which:[kind]});
   Object.assign(S.maps,r);uploadMap();
  }
  // ---------------------------------------------------------------- what the canvas shows
  const effective=()=>{const e=entry();return e;};
  function region(){
   const pic=S.pic;if(!pic)return null;const rects=frameRects();
   if(rects.length&&(prefs.scope==='frame'||prefs.view==='lit'&&!uniformGrid(rects)))return rects[Math.min(S.frame,rects.length-1)];
   return {x:0,y:0,w:pic.w,h:pic.h};
  }
  const repeat=()=>prefs.tile&&entry()?.params.kind==='texture'?3:1;
  function mapPlane(){
   const g=S.gen;if(!g)return null;
   if(prefs.view==='height')return {data:heightToBytes(g.height),gray:true};
   if(prefs.view==='ao'){if(!g.ao){ensureAO();return null;}return {data:g.ao,gray:true};}
   if(prefs.view==='maps'){const m=S.maps[prefs.map];if(!m){ensureMap(prefs.map);return null;}return {data:m,gray:true};}
   return null;
  }
  function uploadMap(){if(!lit||!S.gen)return;const m=mapPlane();if(m)lit.upload('map',m.data,S.pic.w,S.pic.h,{gray:m.gray});lit.view.invalidate();}
  async function present2d({fit=false}={}){
   const a=asset(),pic=S.pic;if(!a||!pic){lit?.set(null);return;}
   const r=region(),rep=repeat(),dw=r.w*rep,dh=r.h*rep,e=entry();
   const drawn=`${a.id}:${dw}x${dh}`;
   if(glError){await drawCPU(r,rep);S.drawn=drawn;return;}
   if(S.drawn!==drawn||!view.image||fit){await view.setImage(blankCanvas(dw,dh),dw,dh,{view:fit?null:(S.drawn.startsWith(a.id+':')?view.view:null)});S.drawn=drawn;}
   const rects=frameRects(),grid=r.w===pic.w&&r.h===pic.h&&rects.length?uniformGrid(rects):null;
   const mode=prefs.view==='albedo'?'albedo':prefs.view==='normal'?'normal':prefs.view==='lit'?'lit':'map';
   lit.set({mode,region:r,repeat:rep,split:S.split,flipGreen:isDX()&&mode==='lit',mapAlpha:e.params.kind==='sprite',scene:e.scene,cell:grid});
   overlay.view?.invalidate();renderHud();
  }
  /** Is the normal map in use DirectX (green down)? The light model reads OpenGL, so it flips. */
  const isDX=()=>{const e=entry();return S.gen?.imported?e.normalDeclared==='directx':e.params.normal.convention==='directx';};
  /** Canvas2D fallback (no WebGL2): the same pictures drawn on the CPU. */
  async function drawCPU(r,rep){
   const pic=S.pic,g=S.gen,e=entry();if(!pic)return;
   const crop=(src,ch=4)=>{const o=new Uint8Array(r.w*r.h*ch);for(let y=0;y<r.h;y++)o.set(src.subarray(((r.y+y)*pic.w+r.x)*ch,((r.y+y)*pic.w+r.x+r.w)*ch),y*r.w*ch);return o;};
   let out=crop(pic.rgba);
   if(g&&prefs.view==='normal'){const n=crop(g.normal);for(let p=0;p<r.w*r.h;p++){n[p*4+3]=out[p*4+3];}out=n;}
   else if(g&&prefs.view==='lit')out=renderLit(out,crop(g.normal),r.w,r.h,e.scene,{flipGreen:isDX()});
   else if(g&&['height','ao','maps'].includes(prefs.view)){const m=mapPlane();if(m){const pl=crop(m.data,1);out=new Uint8Array(r.w*r.h*4);for(let p=0;p<pl.length;p++){out[p*4]=out[p*4+1]=out[p*4+2]=pl[p];out[p*4+3]=255;}}}
   const c=document.createElement('canvas');c.width=r.w*rep;c.height=r.h*rep;const x=c.getContext('2d');const id=new ImageData(new Uint8ClampedArray(out.buffer),r.w,r.h);
   for(let j=0;j<rep;j++)for(let i=0;i<rep;i++)x.putImageData(id,i*r.w,j*r.h);
   await view.setImage(c,c.width,c.height,{view:view.image?view.view:null});
  }
  // ---------------------------------------------------------------- overlay: lights, brush, split
  const overlay={z:40,view:null,visible:true,hit:()=>null,draw(g){drawOverlay(g);}};
  ctx.layer(overlay);
  const toScreen=(v,x,y)=>({x:v.x+x*v.scale,y:v.y+y*v.scale});
  function lightOrigins(){
   // where frame-local (0,0) is on the displayed picture: one per frame in a lit grid sheet
   const r=region(),rep=repeat(),pic=S.pic;if(!r)return [];
   const rects=frameRects(),grid=r.w===pic.w&&r.h===pic.h&&rects.length?uniformGrid(rects):null;
   if(grid)return rects.map(f=>({x:f.x,y:f.y}));
   const out=[];for(let j=0;j<rep;j++)for(let i=0;i<rep;i++)out.push({x:i*r.w,y:j*r.h});return out;
  }
  function drawOverlay({ctx:c,view:v,dpr}){
   const a=asset(),e=S.pic&&entry();if(!a||!e)return;
   const r=region();
   if(prefs.view==='lit'){
    const origins=lightOrigins();
    for(const l of e.scene.lights){
     const sel=l.id===S.selLight,hov=l.id===S.hoverLight;
     origins.forEach((o,k)=>{
      const p=toScreen(v,o.x+l.x,o.y+l.y),rad=(sel||hov?7:5)*dpr;
      if(k===0&&sel){c.setLineDash([4*dpr,4*dpr]);c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,l.radius*v.scale,0,Math.PI*2);c.stroke();c.setLineDash([]);}
      c.beginPath();c.arc(p.x,p.y,rad,0,Math.PI*2);c.fillStyle=l.enabled?l.color:'#555';c.globalAlpha=k?0.45:1;c.fill();c.lineWidth=Math.max(1,1.5*dpr);c.strokeStyle=sel?'#ffc83d':'rgba(0,0,0,.8)';c.stroke();c.globalAlpha=1;
      if(k===0){c.font=`${Math.round(10*dpr)}px ui-monospace,Consolas,monospace`;c.fillStyle='#fff';c.strokeStyle='rgba(0,0,0,.8)';c.lineWidth=3;const label=`z ${Math.round(l.z)}`;c.strokeText(label,p.x+rad+3*dpr,p.y-rad);c.fillText(label,p.x+rad+3*dpr,p.y-rad);}
     });
    }
   }
   if(S.split!=null){const x=Math.round(v.x+S.split*v.scale)+.5,top=v.y,bot=v.y+r.h*repeat()*v.scale;c.lineWidth=Math.max(2,2*dpr);c.strokeStyle='#ffc83d';c.beginPath();c.moveTo(x,top);c.lineTo(x,bot);c.stroke();
    c.font=`600 ${Math.round(10*dpr)}px system-ui,sans-serif`;c.fillStyle='#ffc83d';c.textAlign='right';c.fillText(t('tex.split.flat'),x-6*dpr,top+14*dpr);c.textAlign='left';c.fillText(t('tex.split.lit'),x+6*dpr,top+14*dpr);}
   if(S.brushAt&&currentTool==='brush'){const p=toScreen(v,S.brushAt.x,S.brushAt.y);c.beginPath();c.arc(p.x,p.y,prefs.brush.r*v.scale,0,Math.PI*2);c.lineWidth=1.5*dpr;c.strokeStyle='rgba(255,255,255,.9)';c.stroke();c.beginPath();c.arc(p.x,p.y,prefs.brush.r*v.scale*Math.max(.05,prefs.brush.hard),0,Math.PI*2);c.strokeStyle='rgba(255,255,255,.35)';c.stroke();}
   if(prefs.scope==='sheet'&&prefs.view!=='lit'&&region().w===S.pic.w){c.lineWidth=1;c.strokeStyle='rgba(127,211,255,.45)';for(const f of frameRects()){const p=toScreen(v,f.x,f.y);c.strokeRect(Math.round(p.x)+.5,Math.round(p.y)+.5,Math.round(f.w*v.scale)-1,Math.round(f.h*v.scale)-1);}}
  }
  // ---------------------------------------------------------------- light tool
  let currentTool='';
  const localOf=i=>{const r=region(),rects=frameRects(),grid=r&&S.pic&&r.w===S.pic.w&&r.h===S.pic.h&&rects.length?uniformGrid(rects):null;
   if(grid){const f=rects.find(q=>i.x>=q.x&&i.y>=q.y&&i.x<q.x+q.w&&i.y<q.y+q.h)||rects[0];return {x:i.x-f.x,y:i.y-f.y};}
   return {x:((i.x%r.w)+r.w)%r.w,y:((i.y%r.h)+r.h)%r.h};};
  function lightAt(i){
   const e=entry();if(!e||prefs.view!=='lit')return null;const v=view.view,tol=10*view.dpr/v.scale;
   for(const o of lightOrigins())for(const l of [...e.scene.lights].reverse())if(Math.hypot(i.x-(o.x+l.x),i.y-(o.y+l.y))<=tol)return l;
   return null;
  }
  const nearSplit=i=>S.split!=null&&Math.abs(i.x-S.split)*view.view.scale<=6*view.dpr;
  let drag=null,dragN=0;
  const lightTool={
   cursor(i){currentTool='light';if(i&&nearSplit(i))return 'ew-resize';return i&&lightAt(i)?'move':'crosshair';},
   down(i){
    if(!asset()||!S.pic)return false;
    if(nearSplit(i)){drag={kind:'split'};return true;}
    if(prefs.view!=='lit')setView('lit');
    const hit=lightAt(i),e=entry(),p=localOf(i);
    if(hit&&i.alt){S.selLight=null;edit(t('tex.cmd.removeLight'),(s,id,size)=>St.removeLight(s,id,hit.id,size));return false;}
    if(hit){S.selLight=hit.id;drag={kind:'light',id:hit.id,key:'light'+(++dragN),dx:hit.x-p.x,dy:hit.y-p.y};panels.render();return true;}
    if(i.shift||!e.scene.lights.length){
     if(e.scene.lights.length>=St.MAX_LIGHTS){ctx.toast(t('tex.light.max',{n:St.MAX_LIGHTS}),{error:true});return false;}
     const base=e.scene.lights[e.scene.lights.length-1]||defaultSceneFor().lights[0];
     edit(t('tex.cmd.addLight'),(s,id,size)=>St.addLight(s,id,{...base,x:Math.round(p.x),y:Math.round(p.y),enabled:true},size));
     const ls=entry().scene.lights;S.selLight=ls[ls.length-1]?.id;panels.render();return false;
    }
    const target=e.scene.lights.find(l=>l.id===S.selLight)||e.scene.lights[0];S.selLight=target.id;
    drag={kind:'light',id:target.id,key:'light'+(++dragN),dx:0,dy:0};
    moveLight(p,drag);return true;
   },
   move(i){if(!drag)return;if(drag.kind==='split'){S.split=Math.max(0,Math.min(region().w*repeat(),Math.round(i.x)));present2d();return;}moveLight(localOf(i),drag);},
   up(){if(drag?.kind==='light')ctx.history.close(drag.key);drag=null;panels.render();},
   cancel(){if(drag?.kind==='light'&&ctx.history.abort(drag.key)){drag=null;return;}drag=null;},
   hover(i){const l=lightAt(i);const id=l?.id||null;if(id!==S.hoverLight){S.hoverLight=id;overlay.view?.invalidate();}const px=i.pixel;if(px)statusPixel(px);},
   leave(){S.hoverLight=null;overlay.view?.invalidate();}
  };
  function moveLight(p,d){
   const x=Math.round((p.x+d.dx)*2)/2,y=Math.round((p.y+d.dy)*2)/2;
   edit(t('tex.cmd.moveLight'),(s,id,size)=>St.setLight(s,id,d.id,{x,y},size),{mergeKey:d.key,open:true});
  }
  // ---------------------------------------------------------------- height brush
  let stroke=null;
  const brushTool={
   cursor(){currentTool='brush';return 'none';},
   down(i){
    const a=asset(),pic=S.pic,g=S.gen;if(!a||!pic||!g)return false;
    if(g.imported){ctx.toast(t('tex.brush.imported'),{error:true});return false;}
    const w=workingPoint(i);if(!w)return false;
    const reg=regionAt(pic.layout.regions.length?pic.layout.regions:[{x:0,y:0,w:pic.w,h:pic.h}],w.x,w.y);if(!reg)return false;
    const b=prefs.brush,mode=i.alt&&b.mode==='raise'?'lower':i.alt&&b.mode==='lower'?'raise':b.mode;
    const cur=g.height[Math.floor(w.y)*pic.w+Math.floor(w.x)]||0;
    stroke={mode,r:b.r,s:mode==='raise'||mode==='lower'?b.s:Math.min(1,b.s),hard:b.hard,pts:[round2(w.x),round2(w.y)],clip:reg,target:mode==='flatten'?round2(cur):undefined,
     live:new Float32Array(pic.w*pic.h),normal:new Uint8Array(g.normal),height:g.height};
    dab(0);return true;
   },
   move(i){S.brushAt={x:i.x,y:i.y};if(!stroke){overlay.view?.invalidate();return;}const w=workingPoint(i);if(!w)return;const n=stroke.pts.length;if(Math.hypot(w.x-stroke.pts[n-2],w.y-stroke.pts[n-1])<Math.max(.5,stroke.r*.2))return;stroke.pts.push(round2(w.x),round2(w.y));dab(n-2);},
   up(){if(!stroke)return;const {live,normal,height,...rec}=stroke;stroke=null;edit(t('tex.cmd.paint',{mode:t('tex.brush.mode.'+rec.mode)}),(s,id,size)=>St.addStroke(s,id,rec,size));},
   cancel(){if(!stroke)return;stroke=null;S.genKey='';if(lit&&S.gen)lit.upload('nrm',S.gen.normal,S.pic.w,S.pic.h);present2d();},
   hover(i){S.brushAt={x:i.x,y:i.y};overlay.view?.invalidate();if(i.pixel)statusPixel(i.pixel);},
   leave(){S.brushAt=null;overlay.view?.invalidate();},
   get active(){return !!stroke;}
  };
  const round2=v=>Math.round(v*100)/100;
  /** Canvas point → working-picture point (the frame's offset added; tile repeats folded). */
  function workingPoint(i){const r=region();if(!r)return null;const x=((i.x%r.w)+r.w)%r.w,y=((i.y%r.h)+r.h)%r.h;return {x:r.x+x,y:r.y+y};}
  /** Live brush: the new part of the stroke is applied to a paint layer over the current height and
   * only the touched normals are recomputed and uploaded. The committed stroke is replayed exactly
   * by the worker afterwards. */
  function dab(from){
   const pic=S.pic,e=entry(),s=stroke,sub={...s,pts:s.pts.slice(Math.max(0,from))};
   const dirty=applyStroke(s.live,s.height,pic.w,pic.h,sub,{clip:s.clip});if(!dirty)return;
   const pad=4,rect={x:Math.max(0,dirty.x-pad),y:Math.max(0,dirty.y-pad),w:0,h:0};rect.w=Math.min(pic.w,dirty.x+dirty.w+pad)-rect.x;rect.h=Math.min(pic.h,dirty.y+dirty.h+pad)-rect.y;
   const x0=Math.max(s.clip.x,rect.x-4),y0=Math.max(s.clip.y,rect.y-4),x1=Math.min(s.clip.x+s.clip.w,rect.x+rect.w+4),y1=Math.min(s.clip.y+s.clip.h,rect.y+rect.h+4);
   // the final height of the patch neighbourhood: current height + this stroke
   const hgt=new Float32Array(s.height);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*pic.w+x;hgt[p]=Math.max(0,s.height[p]+s.live[p]);}
   const done=normalPatch(hgt,pic.w,pic.h,e.params,{region:s.clip,rect,mask:S.gen.mask,into:s.normal});
   if(done&&lit)lit.upload('nrm',s.normal,pic.w,pic.h,{rect:done});
   if(glError)present2d();
  }
  ctx.tool({id:'tex-light',title:'tex.tool.light',icon:'texLight',key:'L',order:10,hint:'tex.tool.lightHint',impl:lightTool});
  ctx.tool({id:'tex-brush',title:'tex.tool.brush',icon:'texBrush',key:'B',order:11,hint:'tex.tool.brushHint',impl:brushTool});
  // ---------------------------------------------------------------- status
  function statusPixel(px){
   const r=region(),g=S.gen;if(!r||!g)return;const x=r.x+(px.x%r.w),y=r.y+(px.y%r.h),p=y*S.pic.w+x;
   const n=g.normal.subarray(p*4,p*4+3);ctx.status('selection',t('tex.status.pixel',{x:px.x,y:px.y,h:(g.height[p]||0).toFixed(2),n:`${n[0]},${n[1]},${n[2]}`}));
  }
  function renderStatus(){const pic=S.pic;ctx.status('selection',S.busy?t('tex.status.working'):S.error?S.error:pic?t('tex.status.ready',{w:pic.w,h:pic.h,ms:S.gen?.ms??'…'}):'');}
  // ---------------------------------------------------------------- HUD (view switch)
  const hudHost=view.root.parentElement,hud=h('div.tx-hud',{role:'toolbar','aria-label':t('tex.hud.label')});hudHost.append(hud);
  function renderHud(){
   const a=asset();hud.hidden=!a;if(!a)return;
   const e=entry(),rects=frameRects();
   const mk=(v,key)=>{const b=h('button.tx-hud-btn',{type:'button','aria-pressed':String(prefs.view===v),'data-tex-view':v,title:`${t('tex.view.'+v)} (Alt+${VIEW_MODES.indexOf(v)+1})`},t('tex.view.'+v));b.addEventListener('click',()=>setView(v));return b;};
   const tog=(id,on,label,fn,key)=>{const b=h('button.tx-hud-btn.tx-hud-tog',{type:'button','aria-pressed':String(!!on),'data-tex':id,title:label+(key?` (${key})`:'')},label);b.addEventListener('click',fn);return b;};
   const kids=[h('div.tx-hud-group',{},VIEW_MODES.map(v=>mk(v)))];
   const extra=[];
   if(prefs.view==='lit')extra.push(tog('split',S.split!=null,t('tex.hud.compare'),()=>ctx.runCommand('tex.compare'),'C'));
   if(e?.params.kind==='texture')extra.push(tog('tile',prefs.tile,t('tex.hud.tile'),()=>ctx.runCommand('tex.tile'),'T'));
   if(rects.length)extra.push(tog('scope',prefs.scope==='sheet',t('tex.hud.sheet'),()=>ctx.runCommand('tex.scope'),'`'));
   if(rects.length){const play=h('button.tx-hud-btn',{type:'button','data-tex':'play','aria-pressed':String(S.playing),title:(S.playing?t('tex.frames.pause'):t('tex.frames.play'))+' (Enter)','aria-label':S.playing?t('tex.frames.pause'):t('tex.frames.play')});play.innerHTML=S.playing?ICONS.texPause:ICONS.texPlay;play.addEventListener('click',()=>ctx.runCommand('tex.play'));
    extra.push(h('span.tx-hud-count',{'data-tex':'frame-count'},`${S.frame+1}/${rects.length}`),play);}
   if(extra.length)kids.push(h('div.tx-hud-group',{},extra));
   hud.replaceChildren(...kids);
  }
  // ---------------------------------------------------------------- view switching, frames, playback
  function setView(v){if(!VIEW_MODES.includes(v))return;prefs.view=v;savePrefs();if(v!=='lit')S.split=null;uploadMap();scheduleGen(0);present2d();panels.render();}
  function setFrame(i,{fromPlay=false}={}){
   const n=frameRects().length;if(!n)return;const next=Math.max(0,Math.min(n-1,i));if(next===S.frame&&!fromPlay)return;
   S.frame=next;present2d();if(!fromPlay)panels.renderFrames();else panels.markFrame();
  }
  function playSteps(){const a=asset();if(!a?.frames.length)return [];const tag=a.tags.find(x=>x.id===S.tagId)||null;return steps(a,tag||rangeTag(a));}
  function play(on=!S.playing){
   if(on===S.playing)return;S.playing=on;cancelAnimationFrame(S.raf);
   if(on){const list=playSteps();if(!list.length){S.playing=false;return;}S.playStart=performance.now()-(list.find(s=>s.index===S.frame)?.from||0);
    const tick=now=>{if(!S.playing)return;const s=stepAt(list,now-S.playStart);if(s&&s.index!==S.frame)setFrame(s.index,{fromPlay:true});S.raf=requestAnimationFrame(tick);};S.raf=requestAnimationFrame(tick);}
   renderHud();panels.renderFrames();
  }
  // ---------------------------------------------------------------- selecting an asset
  let selToken=0;
  async function select(id,{fit=false}={}){
   const token=++selToken;play(false);
   const a=id?P.assetById(ctx.doc,id):null;
   if(!a){S.assetId=null;S.pic=null;S.gen=null;lit?.set(null);panels.render();renderHud();return;}
   const changed=S.assetId!==a.id;S.assetId=a.id;
   if(changed){S.frame=0;S.gen=null;S.genKey='';S.detect=null;S.seam=null;S.maps={};S.split=null;S.selLight=null;S.importedNormal=null;S.heightPlane=null;S.drawn='';}
   try{const pic=await loadPicture(a);if(token!==selToken)return;S.pic=pic;}
   catch(err){S.error=String(err.message||err);renderStatus();return;}
   if(lit)lit.upload('alb',S.pic.rgba,S.pic.w,S.pic.h);
   await present2d({fit:changed||fit});
   panels.render();runGen();
  }
  // ---------------------------------------------------------------- export
  async function exportZip({targets,includeHeight=true,includeAO=true,bleed=0}){
   const a=asset(),pic=S.pic,g=S.gen,e=entry();if(!a||!pic||!g)throw Error(t('tex.export.notReady'));
   const base=safeBase(a.name);
   let normal=g.normal;if(g.imported&&e.normalDeclared==='directx')normal=flipGreen(normal,pic.w,pic.h);
   else if(!g.imported&&e.params.normal.convention==='directx')normal=flipGreen(normal,pic.w,pic.h);
   // the user's own PNG, byte for byte, when the picture is exactly one stored image
   let albedo=null;const single=a.layers.length===1&&a.cels.length===1&&a.cels[0].frameId==='*'&&a.layers[0].visible&&a.layers[0].opacity===255&&a.cels[0].opacity===255&&!a.cels[0].x&&!a.cels[0].y&&pic.layout.mode==='sheet';
   if(single&&!bleed){const b=ctx.images.get(a.cels[0].blob)?.blob;if(b&&b.type==='image/png')albedo=await bytesOf(b);}
   if(!albedo){let rgba=pic.rgba;if(bleed)rgba=dilateEdges(rgba,pic.w,pic.h,{pixels:bleed}).data;albedo=await bytesOf(await encodeRGBAPNG(rgba,pic.w,pic.h));}
   const png={albedo,normal:await bytesOf(await encodeRGBAPNG(normal,pic.w,pic.h)),normalDX:await bytesOf(await encodeRGBAPNG(flipGreen(normal,pic.w,pic.h),pic.w,pic.h)),light:{}};
   for(const [k,v] of Object.entries(lightTexturesFor(e.scene)))png.light[k]=await bytesOf(await encodeRGBAPNG(v,256,256));
   let heightMax=0;
   if(includeHeight&&!g.imported){const u=heightToUint16(g.height);heightMax=u.max;png.height=await encodeGray16PNG(u.samples,pic.w,pic.h);}
   if(includeAO&&!g.imported)await ensureAO();
   if(includeAO&&g.ao&&!g.imported)png.ao=await bytesOf(await encodeGrayPNG(g.ao,pic.w,pic.h));
   const frames=pic.layout.frameRects.map((r,i)=>({rect:r,duration:a.frames[i]?.duration||100,name:a.frames[i]?.name||`frame_${i}`}));
   const files=bundleFiles({base,targets,png,width:pic.w,height:pic.h,frames,frameList:a.frames,tags:a.tags,scene:e.scene,convention:g.imported?(e.normalDeclared||'opengl'):'opengl',pixelArt:isPixelArt(),heightMax,params:g.imported?null:e.params});
   const blob=await zip(files.map(f=>({name:f.name,blob:new Blob([f.data],{type:f.type})})),{paths:true});
   return {blob,name:`${base}-texture.zip`,files};
  }
  function download(blob,name){const u=URL.createObjectURL(blob),el=h('a',{href:u,download:name});document.body.append(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);}
  /** Adds generated maps to the project as images (undoable import), next to the picture. */
  async function addToProject(kinds){
   const pic=S.pic,g=S.gen,a=asset();if(!pic||!g||!a)return;const base=safeBase(a.name),files=[];
   for(const k of kinds){
    if(k==='normal')files.push(new File([await encodeRGBAPNG(g.normal,pic.w,pic.h)],`${base}_n.png`,{type:'image/png'}));
    if(k==='height'){const u=heightToUint16(g.height);files.push(new File([await encodeGray16PNG(u.samples,pic.w,pic.h)],`${base}_height.png`,{type:'image/png'}));}
    if(k==='ao'&&await ensureAO())files.push(new File([await encodeGrayPNG(g.ao,pic.w,pic.h)],`${base}_ao.png`,{type:'image/png'}));
    if(S.maps[k])files.push(new File([await encodeGrayPNG(S.maps[k],pic.w,pic.h)],`${base}_${k}.png`,{type:'image/png'}));
   }
   if(!files.length)return;const keep=a.id;const added=await ctx.importFiles(files,{from:'texture'});await ctx.showAsset(keep,{restoreView:true});
   ctx.toast(t('tex.toast.added',{n:added.length}));
  }
  // ---------------------------------------------------------------- panels + 3D preview
  const C={t,ctx,S,prefs,savePrefs,asset,entry,edit,setView,setFrame,play,present2d,scheduleGen,runSeam,ensureMap,uploadMap,frameRects,frameSize,region,setMembers,roleOf,exportZip,download,addToProject,defaultSceneFor,
   work,isPixelArt,ensureAO,isDX,glError:()=>glError,select:()=>select(S.assetId,{fit:true}),runDetect};
  const threeD=createPreview3D(C);C.threeD=threeD;
  const panels=createPanels(C);
  // ---------------------------------------------------------------- commands + menu
  VIEW_MODES.forEach((v,i)=>ctx.command({id:'tex.view.'+v,group:'texture',keys:['Alt+'+(i+1)],label:()=>t('tex.view.'+v),radio:true,checked:()=>prefs.view===v,enabled:()=>!!asset(),run:()=>setView(v)}));
  ctx.command({id:'tex.compare',group:'texture',keys:['C'],label:()=>t('tex.cmd.compare'),checked:()=>S.split!=null,enabled:()=>!!asset(),run:()=>{if(prefs.view!=='lit')setView('lit');S.split=S.split==null?Math.round(region().w*repeat()/2):null;present2d();renderHud();}});
  ctx.command({id:'tex.tile',group:'texture',keys:['T'],label:()=>t('tex.cmd.tile'),checked:()=>prefs.tile,enabled:()=>entry()?.params.kind==='texture',run:()=>{prefs.tile=!prefs.tile;savePrefs();present2d({fit:true});renderHud();}});
  ctx.command({id:'tex.scope',group:'texture',keys:['`'],label:()=>t('tex.cmd.scope'),checked:()=>prefs.scope==='sheet',enabled:()=>frameRects().length>0,run:()=>{prefs.scope=prefs.scope==='sheet'?'frame':'sheet';savePrefs();present2d({fit:true});renderHud();}});
  ctx.command({id:'tex.play',group:'texture',keys:['Enter'],label:()=>S.playing?t('tex.frames.pause'):t('tex.frames.play'),enabled:()=>frameRects().length>1,run:()=>play()});
  ctx.command({id:'tex.addLight',group:'texture',label:()=>t('tex.cmd.addLight'),enabled:()=>!!asset()&&(entry()?.scene.lights.length||0)<St.MAX_LIGHTS,run:()=>{const e=entry(),{w,h:hh}=frameSize();edit(t('tex.cmd.addLight'),(s,id,size)=>St.addLight(s,id,{...(e.scene.lights[0]||defaultSceneFor().lights[0]),x:Math.round(w*.75),y:Math.round(hh*.25)},size));const ls=entry().scene.lights;S.selLight=ls[ls.length-1]?.id;setView('lit');}});
  ctx.command({id:'tex.export',group:'texture',keys:['Mod+E'],label:()=>t('tex.cmd.export'),enabled:()=>!!S.gen,run:()=>{ctx.showPanel('tex-export');panels.focusExport();}});
  ctx.command({id:'tex.brushSmaller',group:'texture',keys:['['],label:()=>t('tex.cmd.smaller'),enabled:()=>!!asset(),run:()=>adjust(-1)});
  ctx.command({id:'tex.brushBigger',group:'texture',keys:[']'],label:()=>t('tex.cmd.bigger'),enabled:()=>!!asset(),run:()=>adjust(1)});
  ctx.command({id:'tex.resetStrokes',group:'texture',label:()=>t('tex.cmd.clearPaint'),enabled:()=>(entry()?.strokes.length||0)>0,run:()=>edit(t('tex.cmd.clearPaint'),(s,id,size)=>St.clearStrokes(s,id,size))});
  function adjust(d){
   if(currentTool==='light'&&S.selLight){const l=entry().scene.lights.find(x=>x.id===S.selLight);if(l)edit(t('tex.cmd.lightHeight'),(s,id,size)=>St.setLight(s,id,l.id,{z:Math.max(0,l.z+d*4)},size),{mergeKey:'lz'});return;}
   const r=prefs.brush.r;prefs.brush.r=Math.max(1,Math.min(128,d>0?Math.max(r+1,Math.round(r*1.25)):Math.min(r-1,Math.round(r*.8))));savePrefs();overlay.view?.invalidate();panels.render();
  }
  ctx.menu({id:'texture',title:'tex.menu',items:()=>[...VIEW_MODES.map(v=>'tex.view.'+v),'-','tex.compare','tex.tile','tex.scope','tex.play','-','tex.addLight','tex.resetStrokes','-','tex.export']});
  // ---------------------------------------------------------------- document / asset / locale events
  ctx.on('doc',(doc,prev)=>{
   const a=asset();
   if(S.assetId&&!a){select(doc.assets[0]?.id||null);return;}
   if(!a)return;
   const pa=prev?P.assetById(prev,a.id):null;
   if(!pa||picSignature(pa)!==picSignature(a)){select(a.id);return;}
   const ps=prev?St.texState(prev):null,ns=St.texState(doc);
   if(!ps||ps!==ns){scheduleGen(entry().strokes.length!==St.entryOf(ps||St.EMPTY,a.id).strokes.length?0:90);present2d();panels.render();}
  });
  ctx.on('asset',id=>{if(id&&id!==S.assetId)select(id);});
  ctx.on('locale',()=>{panels.render();renderHud();hud.setAttribute('aria-label',t('tex.hud.label'));});
  ctx.minBottomHeight?.(170);
  select(ctx.activeAsset?.id||null);
  window.nerulioTexture={S,prefs,entry,lit:()=>lit,exportZip,region,select:id=>select(id)};
  return {
   present(a){return select(a.id);},
   step(dir){if(frameRects().length){play(false);setFrame(S.frame+dir);}},
   hasSelection:()=>!!S.selLight,
   deleteSelection(){const id=S.selLight;if(!id)return;S.selLight=null;edit(t('tex.cmd.removeLight'),(s,aid,size)=>St.removeLight(s,aid,id,size));},
   deselect(){S.selLight=null;panels.render();overlay.view?.invalidate();},
   onAsset(id){if(id&&id!==S.assetId)select(id);},
   deactivate(){
    play(false);clearTimeout(genTimer);lit?.destroy();hud.remove();threeD.destroy();panels.destroy();delete window.nerulioTexture;ctx.status('selection','');
    const a=ctx.activeAsset;setTimeout(()=>{if(a)ctx.showAsset(a.id,{restoreView:true});else view.clearImage();},0);
   }
  };
 }
};
