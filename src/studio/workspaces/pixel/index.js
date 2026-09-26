/** Pixel workspace (P2): an Aseprite-class pixel editor on the Studio canvas — pencil, eraser,
 * bucket, line, rectangle, ellipse, eyedropper, marquee / lasso / magic wand with move, cut, copy,
 * paste, flip and rotate; pixel-perfect strokes, brushes 1–16, symmetry, shading and dithering
 * inks; layers with Aseprite blend modes on the Sprite timeline (layers × frames cels, tags, onion
 * skin, playback); a true indexed colour mode with a palette panel; and the deterministic cleanup
 * pipeline for upscaled / resampled / generated pixel art. It edits the same project document as
 * the Sprite workspace (docs/STUDIO-SPRITE.md + docs/STUDIO-PIXEL.md). Plug-in API: docs/STUDIO.md. */
import './strings.js';
import * as P from '../../core/project.js';
import * as D from '../../sprite/sprite-doc.js';
import * as PD from '../../pixel/pixel-doc.js';
import * as R from '../../pixel/raster.js';
import {h,storage} from '../../ui/dom.js';
import {isTypingTarget} from '../../core/keymap.js';
import {ICONS} from '../../ui/icons.js';
import {createTimeline} from '../../sprite/timeline-ui.js';
import {createPreview} from '../../sprite/preview-ui.js';
import {createImporter,isSpriteFile} from '../../sprite/importers.js';
import {isAPNG} from '../../sprite/apng-decode.js';
import {steps,stepAt,tagAt,stepIndex,onionFrames,rangeTag} from '../../sprite/playback.js';
import {setFrameSelection,onFrameSelection,getFrameSelection} from '../../core/frame-selection.js';
import {rgbaGetter,storeRGBA,blobRGBA} from '../../sprite/frame-render.js';
import {composeFrame,composeCanvas,frameDraws,celAt,flipRGBA} from '../../sprite/frame-image.js';
import {asepriteFromAsset} from '../../sprite/aseprite-bridge.js';
import {writeAseprite} from '../../../game/aseprite.js';
import {frame as makeFrame} from '../../../game/model.js';
import {Session} from './session.js';
import {createTools} from './tools.js';
import {PixelOverlay} from './overlay.js';
import {createPanels} from './panels.js';
import {createCleanup} from './cleanup-ui.js';
import {PIXEL_ICONS} from './icons.js';
import {matcher,keyOf,DB32,indicesFromRGBA,rgbaFromIndices} from '../../pixel/indexed.js';
import {encodeIndexedPNG} from '../../pixel/png8.js';
const PREFS='nerulio.studio.pixel.v1';
const DEFAULTS={size:1,brush:'square',ink:'simple',pixelPerfect:true,symmetry:{mode:'none',axisX:null,axisY:null},ditherPattern:'bayer4',ditherDensity:50,ditherSecond:'bg',
 contiguous:true,tolerance:0,sampleMerged:false,shapeFill:false,onion:{on:false,before:1,after:1,opacity:.45,tint:true},loopTag:true,cw:26,preview:false,previewZoom:2,previewBg:'checker',previewPos:null,
 fg:[0,0,0,255],bg:[255,255,255,255],eyedropSample:'merged'};
let cssLoaded=false;
function loadCSS(){if(cssLoaded)return;cssLoaded=true;for(const f of ['../../sprite/sprite.css','./pixel.css'])document.head.append(h('link',{rel:'stylesheet',href:new URL(f,import.meta.url).href}));}
Object.assign(ICONS,PIXEL_ICONS);
export default {
 id:'pixel',title:'ws.pixel',status:'ready',summary:'ws.pixelSummary', activate(ctx){
  loadCSS();
  const {t,view,images}=ctx;
  const saved=storage.get(PREFS,{}),prefs={...DEFAULTS,...saved,symmetry:{...DEFAULTS.symmetry,...saved.symmetry},onion:{...DEFAULTS.onion,...saved.onion}};
  const S={assetId:null,cur:0,sel:[],anchor:null,tagId:null,playing:false,play:null,raf:0,layerId:null,selection:null,lastSel:null,float:null,lastPoint:new Map(),hover:null,draft:null,rampSel:[],palSel:null,clip:null};
  const session=new Session({images,view});
  const asset=()=>S.assetId?P.assetById(ctx.doc,S.assetId):null;
  const frame=()=>asset()?.frames[S.cur]||null;
  const exec=(label,fn,opts)=>ctx.execute(ctx.edit(label,fn,opts));
  const savePrefs=()=>{const {fg,bg,...rest}=prefs;storage.set(PREFS,{...rest,fg,bg});};
  // ------------------------------------------------------------ controller shared with tools / panels
  const W={
   t,ctx,images,history:ctx.history,prefs,session,S,opts:prefs,
   asset,frame,assetId:()=>S.assetId,cur:()=>S.cur,selected:()=>S.sel,exec,
   toast:(m,o)=>ctx.toast(m,o),run:id=>ctx.runCommand(id),showPanel:id=>ctx.showPanel(id),status:(k,v)=>ctx.status('selection',t(k,v)),
   playing:()=>S.playing,playTag,step,setCurrent,clickFrame,selectTag,newTag,setDurations,moveFrames,
   setPref(k,v){prefs[k]=v;savePrefs();afterPref(k);},
   layerId:()=>S.layerId,layerPlane:()=>session.layer(S.layerId)?.plane,
   value:which=>valueOf(prefs[which]),
   symmetry:()=>{const r=session.rect,s=prefs.symmetry;return {mode:s.mode,axisX:s.axisX??r.w/2,axisY:s.axisY??r.h/2};},
   shadingRamp,selectionMask:()=>S.selection,floating:()=>!!S.float,
   canPaint,commitLayer,rememberPoint:p=>S.lastPoint.set(pointKey(),p),lastPoint:()=>S.lastPoint.get(pointKey())||null,
   pick,brushHover:p=>{S.hover=p;overlay.invalidate();},overlayDraft:d=>{S.draft=d;overlay.invalidate();},
   setSelection,deselect,liftSelection,moveFloat,dropFloat,cancelFloat,floatMoved:()=>{updateStatus();},floatHit,selectLayerPixels,
   setColor,swapColors:()=>{[prefs.fg,prefs.bg]=[prefs.bg,prefs.fg];savePrefs();panels.renderColor();},
   refresh:()=>refreshAll(),present,
   setLayer:id=>{S.layerId=id;panels.renderLayers();markTimelineLayer();updateStatus();},
   /** The timeline of a picture without frames: paint on it as it is, or make it frame 1. */
   timelineEmpty(a){
    const b=(label,cmd,primary)=>{const x=h('button.st-btn'+(primary?'.primary':''),{type:'button','data-px':'tl-'+cmd.split('.').pop()},label);x.addEventListener('click',()=>ctx.runCommand(cmd));return x;};
    return h('div.st-pad.sp-tl-empty.px-tl-empty',{},h('p.st-muted',{},t(a?'px.tl.noFrames':'px.tl.noSprite')),h('div.st-row',{},a?b(t('px.cmd.animate'),'pixel.animate',true):b(t('px.cmd.newSprite'),'pixel.newSprite',true),a?'':b(t('cmd.file.import'),'file.import')));
   }
  };
  const pointKey=()=>S.assetId+'|'+session.frameId+'|'+S.layerId;
  // ------------------------------------------------------------ colours ↔ plane values
  function valueOf(c){
   if(!c)return 0;const a=c[3]??255;
   if(session.kind===R.INDEXED){if(!a)return session.clear;const m=matcher(session.colors,{exclude:session.ti});return m.nearest(c[0],c[1],c[2],a);}
   return R.pack(c[0],c[1],c[2],a);
  }
  function setColor(which,c,{index=null}={}){prefs[which]=[c[0],c[1],c[2],c[3]??255];if(index!=null)S.palSel=index;savePrefs();panels.renderColor();panels.renderPalette();}
  function shadingRamp(){
   const a=asset(),cols=a?.palette?.colors||[];let idx=S.rampSel.length>=2?S.rampSel:null;
   if(!idx){// default ramp: the palette in its order (Aseprite shades along the palette)
    idx=cols.map((_,i)=>i).filter(i=>i!==session.ti);}
   return session.kind===R.INDEXED?idx:idx.map(i=>R.pack(cols[i][0],cols[i][1],cols[i][2],cols[i][3]??255));
  }
  // ------------------------------------------------------------ painting guards + commit
  function canPaint(){
   const a=asset();if(!a){ctx.toast(t('px.hint.noSprite'),{error:true});return false;}
   const l=a.layers.find(x=>x.id===S.layerId);if(!l){ctx.toast(t('px.hint.noLayer'),{error:true});return false;}
   if(l.locked){ctx.toast(t('px.hint.locked',{name:l.name}),{error:true});return false;}
   if(!l.visible){ctx.toast(t('px.hint.hidden',{name:l.name}),{error:true});return false;}
   if(S.playing)stop();
   return true;
  }
  let commitChain=Promise.resolve();
  /** The current layer's plane becomes its cel for this frame: one undo step. */
  function commitLayer(label,dirty=null){
   const id=S.layerId,frameId=session.frameId,assetId=S.assetId;
   commitChain=commitChain.then(async()=>{
    const cel=await session.celFor(id);if(S.assetId!==assetId||session.frameId!==frameId)return;
    const r=session.rect,painted=dirty?{x:r.x+dirty.x,y:r.y+dirty.y,w:dirty.w,h:dirty.h}:null;
    commitGuard=true;try{exec(label,d=>PD.coverPainted(PD.setCel(d,assetId,cel),assetId,frameId,painted));}finally{commitGuard=false;}
    const a=asset();session.adopt(a,id,a.cels.find(c=>c.layerId===id&&c.frameId===frameId));
    panels.renderPaletteUsage?.();
   }).catch(e=>{console.error(e);ctx.toast(String(e.message||e),{error:true});});
   return commitChain;
  }
  let commitGuard=false;
  // ------------------------------------------------------------ eyedropper
  function pick(info,which){
   const x=Math.floor(info.x),y=Math.floor(info.y),r=session.rect;if(x<0||y<0||x>=r.w||y>=r.h)return;
   if(session.kind===R.INDEXED&&prefs.eyedropSample==='layer'){const v=session.layer(S.layerId)?.plane.data[y*r.w+x];const c=session.colors[v];if(c)setColor(which,v===session.ti?[0,0,0,0]:c,{index:v});return;}
   let v;if(prefs.eyedropSample==='layer')v=session.rgbaOf(session.layer(S.layerId)?.plane.data[y*r.w+x]||0);else{const d=session.compose({x,y,w:1,h:1},{onion:false});v=R.pack(d[0],d[1],d[2],d[3]);}
   const c=R.unpack(v);let index=null;
   if(session.kind===R.INDEXED){const k=keyOf(c[0],c[1],c[2],c[3]);index=session.colors.findIndex((q,i)=>i!==session.ti&&keyOf(q[0],q[1],q[2],q[3]??255)===k);if(index<0)index=null;}
   setColor(which,c[3]?c:[0,0,0,0],{index});
  }
  // ------------------------------------------------------------ selection + floating pixels
  function setSelection(mask,label){
   if(S.float)dropFloat();
   const any=mask&&R.maskCount(mask)>0;S.selection=any?mask:null;if(any)S.lastSel=mask;overlay.setMask(S.selection);updateStatus();
   void label;
  }
  function deselect(){if(S.float){dropFloat();}S.selection=null;overlay.setMask(null);updateStatus();}
  function selectLayerPixels(){const l=session.layer(S.layerId);if(!l)return;const m=new Uint8Array(l.plane.data.length);let n=0;for(let i=0;i<m.length;i++)if(l.plane.data[i]!==session.clear){m[i]=1;n++;}if(n)setSelection(m);}
  /** Lifts the selected pixels of the current layer into a floating piece (cut, or copy with Ctrl). */
  function liftSelection({copy=false}={}){
   const l=session.layer(S.layerId);if(!l||!S.selection)return false;
   const before=l.plane,res=R.lift(before,S.selection,{cut:!copy,clear:session.clear});if(!res)return false;
   S.float={piece:res.piece,layerId:l.id,base:res.plane,before,copy,moved:false};
   l.plane=R.stamp(R.clonePlane(res.plane),res.piece,{clear:session.clear});session.refresh({x:0,y:0,w:session.rect.w,h:session.rect.h});overlay.invalidate();return true;
  }
  function renderFloat(){const f=S.float,l=session.layer(f.layerId);const prev=l.plane;l.plane=R.stamp(R.clonePlane(f.base),f.piece,{clear:session.clear});void prev;session.refresh({x:0,y:0,w:session.rect.w,h:session.rect.h});S.selection=R.pieceMaskOn(f.piece,session.rect.w,session.rect.h);overlay.setMask(S.selection);}
  function moveFloat(dx,dy){if(!S.float)return;S.float.piece={...S.float.piece,x:S.float.piece.x+dx,y:S.float.piece.y+dy};S.float.moved=true;renderFloat();updateStatus();}
  /** Flip / rotate: floating pixels are transformed and stay floating; a selection (or, without
   * one, the whole layer) is transformed in place as ONE undo step, as in Aseprite. */
  function transformFloat(fn,label){
   const floating=!!S.float,hadSel=!!S.selection;
   if(!floating&&!liftSelectionOrLayer())return;S.float.piece=fn(S.float.piece);S.float.moved=true;S.float.label=label;renderFloat();
   if(!floating){dropFloat();if(!hadSel){S.selection=null;overlay.setMask(null);}updateStatus();}
  }
  function liftSelectionOrLayer(){if(!canPaint())return false;if(!S.selection)selectLayerPixels();return liftSelection();}
  function floatHit(x,y){const f=S.float?.piece;if(!f)return false;const lx=x-f.x,ly=y-f.y;return lx>=0&&ly>=0&&lx<f.w&&ly<f.h&&!!f.mask[ly*f.w+lx];}
  /** Drops the floating piece: the layer as it now looks becomes the cel (one undo step). */
  function dropFloat(){
   const f=S.float;if(!f)return;S.float=null;
   const l=session.layer(f.layerId);if(!l)return;
   if(!f.moved&&!f.copy&&!f.label){l.plane=f.before;session.refresh({x:0,y:0,w:session.rect.w,h:session.rect.h});return;}
   if(R.samePlane(l.plane,f.before))return;
   const keep=S.layerId;S.layerId=f.layerId;commitLayer(f.label||t(f.copy?'px.cmd.copyPixels':'px.cmd.movePixels'));S.layerId=keep;
  }
  function cancelFloat(){const f=S.float;if(!f)return;S.float=null;const l=session.layer(f.layerId);if(l)l.plane=f.before;session.refresh({x:0,y:0,w:session.rect.w,h:session.rect.h});S.selection=S.lastSel;overlay.setMask(S.selection);}
  // clipboard: in-memory piece plus the system clipboard as PNG (so other apps can paste it)
  async function copy({cut=false}={}){
   const l=session.layer(S.layerId);if(!l)return;if(!S.selection&&!S.float){ctx.toast(t('px.hint.selectFirst'),{error:true});return;}
   if(S.float)dropFloat();await commitChain;
   const res=R.lift(l.plane,S.selection,{clear:session.clear});if(!res)return;
   S.clip={piece:res.piece,kind:session.kind,colors:session.colors.slice(),ti:session.ti};
   try{const rgba=pieceRGBA(res.piece);const blob=await pngOf(rgba,res.piece.w,res.piece.h);await navigator.clipboard?.write?.([new ClipboardItem({'image/png':blob})]);}catch{}
   if(cut){if(!canPaint())return;const next=R.clonePlane(l.plane);for(let i=0;i<next.data.length;i++)if(S.selection[i])next.data[i]=session.clear;l.plane=next;session.refresh({x:0,y:0,w:session.rect.w,h:session.rect.h});commitLayer(t('px.cmd.cut'));}
   ctx.toast(t(cut?'px.toast.cut':'px.toast.copied',{w:res.piece.w,h:res.piece.h}));
  }
  const pieceRGBA=p=>{const out=new Uint8Array(p.w*p.h*4);for(let i=0;i<p.w*p.h;i++){if(!p.mask[i])continue;const v=session.rgbaOf(p.data[i]);out.set(R.unpack(v),i*4);}return out;};
  async function pngOf(rgba,w,h2){const c=new OffscreenCanvas(w,h2);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer),w,h2),0,0);return c.convertToBlob({type:'image/png'});}
  /** Pastes a piece as floating pixels at its old place (or the top-left of what is visible). */
  function pastePiece(piece,{fromKind=R.RGBA,colors=null,ti=0}={}){
   if(!canPaint())return;dropFloat();
   let data=piece.data;
   if(fromKind!==session.kind||(session.kind===R.INDEXED&&colors&&colors!==session.colors)){// convert between colour modes / palettes
    const rgba=new Uint8Array(piece.w*piece.h*4);for(let i=0;i<piece.w*piece.h;i++){if(!piece.mask[i])continue;const v=fromKind===R.INDEXED?(i2=>i2===ti?0:keyOf(...colors[i2].slice(0,3),colors[i2][3]??255))(piece.data[i]):piece.data[i];rgba.set(R.unpack(v),i*4);}
    data=session.kind===R.INDEXED?indicesFromRGBA(rgba,piece.w,piece.h,session.colors,{transparentIndex:session.ti}).indices:R.planeFromRGBA(rgba,piece.w,piece.h).data;
   }
   const r=session.rect,vis=visibleRect(),x=piece.x>=0&&piece.x<r.w&&piece.y>=0&&piece.y<r.h?piece.x:Math.max(0,vis.x),y=piece.x>=0&&piece.x<r.w&&piece.y>=0&&piece.y<r.h?piece.y:Math.max(0,vis.y);
   const l=session.layer(S.layerId);
   S.float={piece:{...piece,x,y,data},layerId:l.id,base:l.plane,before:l.plane,copy:true,moved:true,label:t('px.cmd.paste')};renderFloat();ctx.setTool('px-move');
  }
  const pasteClip=()=>pastePiece(S.clip.piece,{fromKind:S.clip.kind,colors:S.clip.colors,ti:S.clip.ti});
  /** Ctrl/⌘+V: our own copy pastes at its place with its exact values (indices included); a picture
   * copied in another app pastes as floating pixels. The shell's paste import never sees it. */
  const onPaste=e=>{
   if(isTypingTarget(document.activeElement)||document.querySelector('dialog[open]')||!asset())return;
   const file=[...(e.clipboardData?.files||[])].find(f=>/^image\//.test(f.type));
   if(!S.clip&&!file)return;
   e.preventDefault();e.stopImmediatePropagation();
   (S.clip?(file?sameAsClip(file):Promise.resolve(true)):Promise.resolve(false)).then(same=>same?pasteClip():pasteImageFile(file)).catch(err=>ctx.toast(String(err.message||err),{error:true}));
  };
  document.addEventListener('paste',onPaste,true);
  async function sameAsClip(file){
   const p=S.clip.piece,bmp=await createImageBitmap(file,{premultiplyAlpha:'none',colorSpaceConversion:'none'});if(bmp.width!==p.w||bmp.height!==p.h)return false;
   const c=new OffscreenCanvas(p.w,p.h),x=c.getContext('2d');x.drawImage(bmp,0,0);const d=x.getImageData(0,0,p.w,p.h).data,want=clipRGBA();
   for(let i=0;i<d.length;i+=4){if(!d[i+3]&&!want[i+3])continue;if(Math.abs(d[i]-want[i])>1||Math.abs(d[i+1]-want[i+1])>1||Math.abs(d[i+2]-want[i+2])>1||Math.abs(d[i+3]-want[i+3])>1)return false;}
   return true;
  }
  const clipRGBA=()=>{const p=S.clip.piece,out=new Uint8Array(p.w*p.h*4);for(let i=0;i<p.w*p.h;i++){if(!p.mask[i])continue;const v=S.clip.kind===R.INDEXED?(p.data[i]===S.clip.ti?0:keyOf(...S.clip.colors[p.data[i]].slice(0,3),S.clip.colors[p.data[i]][3]??255)):p.data[i];out.set(R.unpack(v),i*4);}return out;};
  async function pasteImageFile(file){
   const bmp=await createImageBitmap(file,{premultiplyAlpha:'none',colorSpaceConversion:'none'});const c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);
   const d=new Uint8Array(x.getImageData(0,0,bmp.width,bmp.height).data.buffer);const plane=R.planeFromRGBA(d,bmp.width,bmp.height),mask=new Uint8Array(bmp.width*bmp.height).fill(1);
   pastePiece({x:-1,y:-1,w:bmp.width,h:bmp.height,data:plane.data,mask},{fromKind:R.RGBA});
  }
  function visibleRect(){const v=view.view,s=v.scale;return {x:Math.floor(-v.x/s),y:Math.floor(-v.y/s),w:Math.ceil(view.W/s),h:Math.ceil(view.H/s)};}
  // ------------------------------------------------------------ whole-layer / selection edits
  /** Runs fn(plane, mask) → plane on the current layer (the selection, else everything): one step. */
  function editLayer(label,fn){
   if(!canPaint())return;if(S.float){transformFloatFor(label,fn);return;}
   const l=session.layer(S.layerId),next=fn(l.plane,S.selection);if(!next||R.samePlane(next,l.plane)){ctx.toast(t('px.toast.nothing'));return;}
   l.plane=next;session.refresh({x:0,y:0,w:session.rect.w,h:session.rect.h});commitLayer(label);
  }
  function transformFloatFor(label,fn){const f=S.float;const p=fn({w:f.piece.w,h:f.piece.h,data:f.piece.data},null);if(p){f.piece={...f.piece,data:p.data};f.moved=true;f.label=label;renderFloat();}}
  function clearSelection(){editLayer(t('px.cmd.clear'),(p,m)=>{const n=R.clonePlane(p);for(let i=0;i<n.data.length;i++)if(!m||m[i])n.data[i]=session.clear;return n;});}
  function flip(axis){
   if(S.selection||S.float){transformFloat(p=>R.flipPiece(p,axis),t(axis==='x'?'px.cmd.flipH':'px.cmd.flipV'));return;}
   editLayer(t(axis==='x'?'px.cmd.flipH':'px.cmd.flipV'),p=>{const n=R.plane(p.w,p.h,session.kind);for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++)n.data[y*p.w+x]=p.data[axis==='x'?y*p.w+p.w-1-x:(p.h-1-y)*p.w+x];return n;});
  }
  function rotate(dir){transformFloat(p=>R.rotatePiece(p,dir),t(dir==='cw'?'px.cmd.rotateCW':'px.cmd.rotateCCW'));}
  function fx(kind){
   const which=kind==='shadow'?'bg':'fg',v=valueOf(prefs[which]);
   if(kind==='outline'){const place=prefs.outlinePlace||'outside',matrix=prefs.outlineMatrix||'circle';editLayer(t('px.cmd.outline'),(p,m)=>R.outline(p,v,{place,matrix,clear:session.clear,limit:m?grow(m,p.w,p.h):null}).plane);}
   else editLayer(t('px.cmd.shadow'),(p,m)=>R.dropShadow(p,v,{dx:1,dy:1,clear:session.clear,limit:m?grow(m,p.w,p.h):null}).plane);
  }
  /** The selection grown by one pixel, so an outline / shadow around selected pixels can land. */
  const grow=(m,w,h2)=>{const o=new Uint8Array(m.length);for(let y=0;y<h2;y++)for(let x=0;x<w;x++){if(!m[y*w+x])continue;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<w&&Y<h2)o[Y*w+X]=1;}}return o;};
  function replaceColor(){const from=valueOf(prefs.fg),to=valueOf(prefs.bg);editLayer(t('px.cmd.replaceColor'),(p,m)=>R.replaceColor(p,from,to,{tolerance:prefs.tolerance,kind:session.kind,colorOf:session.kind===R.INDEXED?i=>R.unpack(session.rgbaOf(i)):null,limit:m}).plane);}
  // ------------------------------------------------------------ canvas: tools, overlay, context bar
  const overlay=ctx.layer(new PixelOverlay({W,session,S,prefs}));W.overlay=overlay;
  const tools=createTools(W);W.tools=tools;
  const T=(id,key,order,impl)=>ctx.tool({id:'px-'+id,title:'px.tool.'+id,icon:'px'+id[0].toUpperCase()+id.slice(1),key,order,hint:'px.tool.'+id+'Hint',impl});
  T('pencil','B',10,tools.pencil);T('eraser','E',11,tools.eraser);T('bucket','G',12,tools.bucket);T('picker','I',13,tools.picker);
  T('line','L',20,tools.line);T('rect','U',21,tools.rect);T('ellipse','Shift+U',22,tools.ellipse);
  T('marquee','M',30,tools.marquee);T('lasso','Q',31,tools.lasso);T('wand','W',32,tools.wand);T('move','V',33,tools.move);
  const panels=createPanels(W);W.panels=panels;
  const cleanup=createCleanup(W);
  const hudHost=view.root.closest('.st-canvas-wrap')||view.root.parentElement;
  const bar=panels.contextBar();hudHost.append(bar);
  const previewWin=createPreview({...W,prefs,setPref:W.setPref,asset,playTag},view.root.closest('.studio')||document.body);
  // ------------------------------------------------------------ panels
  const timeline=createTimeline(W);
  ctx.minBottomHeight?.(170);
  ctx.panel({id:'px-timeline',title:()=>t('sp.panel.timeline'),dock:'bottom',order:5,badge:()=>{const a=asset();return a?.frames.length?String(a.frames.length):'';},render(body){body.append(timeline.root);}});
  ctx.panel({id:'px-color',title:()=>t('px.panel.color'),dock:'right',order:8,render(body){body.append(panels.color);}});
  ctx.panel({id:'px-palette',title:()=>t('px.panel.palette'),dock:'right',order:9,badge:()=>String(asset()?.palette?.colors.length||''),render(body,{actions}){panels.paletteActions(actions);body.append(panels.palette);}});
  ctx.panel({id:'px-layers',title:()=>t('px.panel.layers'),dock:'right',order:11,badge:()=>String(asset()?.layers.length||''),render(body,{actions}){panels.layerActions(actions);body.append(panels.layers);}});
  ctx.panel({id:'px-cleanup',title:()=>t('px.panel.cleanup'),dock:'right',order:40,render(body){body.append(cleanup.root);}});
  ctx.panel({id:'px-audit',title:()=>t('px.panel.audit'),dock:'right',order:42,render(body){body.append(panels.audit);}});
  // clicking a layer row in the timeline makes it the current layer
  timeline.root.addEventListener('pointerdown',e=>{const row=e.target.closest?.('[data-layer]');if(row&&!e.target.closest('.sp-eye'))W.setLayer(row.dataset.layer);},true);
  function markTimelineLayer(){for(const el of timeline.root.querySelectorAll('.sp-tl-layer,.sp-tl-cels'))el.classList.toggle('px-cur-layer',el.dataset.layer===S.layerId);}
  // ------------------------------------------------------------ frames, playback (Sprite timeline behaviour)
  function playTag(){const a=asset();if(!a?.frames.length)return null;const f=a.frames[S.cur];if(S.tagId){const tg=a.tags.find(x=>x.id===S.tagId);if(tg&&tg.frameIds.includes(f?.id))return tg;}return tagAt(a,S.cur);}
  function setCurrent(i,{select=false}={}){const a=asset();if(!a?.frames.length){S.cur=0;return;}S.cur=Math.max(0,Math.min(a.frames.length-1,i));
   if(select||!S.sel.includes(a.frames[S.cur].id)){S.sel=[a.frames[S.cur].id];S.anchor=S.sel[0];}onFrameChanged();}
  function clickFrame(i,mods={}){const a=asset();if(!a)return;const id=a.frames[i]?.id;if(!id)return;const r=D.clickSelect({selected:S.sel,anchor:S.anchor},id,mods,a.frames.map(f=>f.id));S.sel=r.selected;S.anchor=r.anchor;S.cur=i;onFrameChanged();}
  function selectTag(id){const a=asset(),tag=a?.tags.find(x=>x.id===id);if(!tag)return;S.tagId=id;const pos=tag.frameIds.map(f=>D.indexOf(a,f)).filter(i=>i>=0).sort((x,y)=>x-y);S.sel=[...tag.frameIds];S.cur=pos[0]??0;onFrameChanged();}
  function step(dir){const a=asset();if(!a?.frames.length)return;stop();const tg=prefs.loopTag?playTag():null;setCurrent(stepIndex(a,S.cur,dir,tg),{select:true});}
  function newTag(from,to){const a=asset();if(!a)return null;const before=new Set(a.tags.map(x=>x.id));exec(t('sp.cmd.newTag'),d=>D.tagFromRange(d,a.id,from,to,{name:t('sp.tag.defaultName')}));const made=asset().tags.find(x=>!before.has(x.id));if(made)S.tagId=made.id;refreshAll();return made?.id||null;}
  function setDurations(ids,ms){if(ids.length)exec(t('sp.cmd.duration',{n:ids.length,ms}),d=>D.setDurations(d,S.assetId,ids,ms));}
  function moveFrames(ids,to){const a=asset(),curId=a.frames[S.cur].id;exec(t('sp.cmd.moveFrames',{n:ids.length}),d=>D.moveFrames(d,a.id,ids,to));S.cur=D.indexOf(asset(),curId);refreshAll();}
  const offSel=onFrameSelection(({ids,source})=>{if(source==='pixel')return;const a=asset();if(!a)return;const known=ids.filter(id=>a.frames.some(f=>f.id===id));if(!known.length)return;S.sel=known;S.cur=D.indexOf(a,known[known.length-1]);onFrameChanged(false);});
  function onFrameChanged(share=true){if(share)setFrameSelection(S.sel,'pixel');if(S.float)dropFloat();present();timeline.mark();markTimelineLayer();updateStatus();previewWin.restart?.();cleanup.showGrid?.();}
  function play(){const a=asset();if(!a?.frames.length||S.playing)return;dropFloat();const tg=prefs.loopTag?playTag():null,tag=tg||rangeTag(a),list=steps(a,tag,{whole:!!tg&&tg.repeat>0});if(!list.length)return;
   const k=Math.max(0,list.findIndex(s=>s.index===S.cur));S.playing=true;S.play={list,loop:!tg||tg.repeat===0,t0:performance.now()-list[k].from};timeline.mark();
   const tick=()=>{if(!S.playing)return;S.raf=requestAnimationFrame(tick);const s=stepAt(S.play.list,performance.now()-S.play.t0,{loop:S.play.loop});if(s.done){S.cur=s.index;stop();onFrameChanged();return;}if(s.index!==S.cur){S.cur=s.index;present();timeline.mark();updateStatus();}};
   S.raf=requestAnimationFrame(tick);}
  function stop(){if(!S.playing)return;S.playing=false;cancelAnimationFrame(S.raf);timeline.mark();present();}
  // ------------------------------------------------------------ presenting
  let presenting=false,again=false;
  async function present(){
   if(presenting){again=true;return;}presenting=true;
   try{do{again=false;await drawNow();}while(again);}catch(e){console.error(e);ctx.toast(String(e.message||e),{error:true});}finally{presenting=false;}
  }
  async function drawNow(){
   const a=asset();if(!a){view.clearImage();session.asset=null;overlay.invalidate();return;}
   if(!(await session.load(a,S.cur)))return;
   if(!a.layers.some(l=>l.id===S.layerId))S.layerId=[...a.layers].reverse().find(l=>l.visible&&!l.locked)?.id||a.layers[a.layers.length-1].id;
   if(prefs.onion.on&&!S.playing&&a.frames.length>1){const tg=prefs.loopTag?playTag():null;await session.buildOnion(a,onionFrames(a,S.cur,{before:prefs.onion.before,after:prefs.onion.after,opacity:prefs.onion.opacity,tag:tg}),{tint:prefs.onion.tint!==false});}else session.onion=null;
   const key=a.id+'|'+session.rect.w+'x'+session.rect.h,v=views.get(key)||null;
   await session.show({view:session.shownKey===key?null:v});session.shownKey=key;
   if(S.selection&&S.selection.length!==session.rect.w*session.rect.h){S.selection=null;S.lastSel=null;}
   overlay.setMask(S.selection);overlay.invalidate();panels.renderLayers();panels.renderPalette();panels.renderColor();bar.sync?.();
  }
  const views=new Map();ctx.on('view',v=>{if(session.shownKey)views.set(session.shownKey,{...v});});
  function updateStatus(){
   const a=asset();if(!a){ctx.status('selection','');return;}
   const l=a.layers.find(x=>x.id===S.layerId),f=frame(),sel=S.selection?R.maskBounds(S.selection,session.rect?.w||1,session.rect?.h||1):null;
   ctx.status('selection',t('px.status.main',{frame:f?t('px.status.frame',{i:S.cur+1,n:a.frames.length}):t('px.status.noFrames'),layer:l?.name||'—',mode:t(PD.isIndexed(a)?'px.mode.indexed':'px.mode.rgb'),sel:sel?` · ${t('px.status.sel',{w:sel.w,h:sel.h,x:sel.x,y:sel.y})}`:''}));
  }
  // ------------------------------------------------------------ document / asset events
  function refreshAll(){
   const a=asset();
   if(a){S.cur=Math.max(0,Math.min(S.cur,a.frames.length-1));const ids=new Set(a.frames.map(f=>f.id));S.sel=S.sel.filter(id=>ids.has(id));if(!S.sel.length&&a.frames[S.cur])S.sel=[a.frames[S.cur].id];}
   present();timeline.render();markTimelineLayer();panels.renderAll();cleanup.render();updateStatus();ctx.badge('px-timeline');ctx.badge('px-layers');ctx.badge('px-palette');
  }
  ctx.on('doc',(doc,prev,ev)=>{
   const a=asset();if(!a){if(S.assetId&&!P.assetById(doc,S.assetId))useAsset(doc.assets[0]?.id||null);else refreshAll();return;}
   const pa=prev?P.assetById(prev,a.id):null;if(pa===a)return;
   if(commitGuard){timeline.render();panels.renderAll();updateStatus();return;}// our own stroke: the canvas already shows it
   if(ev?.type==='undo'||ev?.type==='redo'||ev?.type==='reset'){tools.cancel();if(S.float){S.float=null;}}
   refreshAll();
  });
  ctx.on('asset',id=>{if(id!==S.assetId)useAsset(id);});
  function useAsset(id){
   stop();dropFloat();S.assetId=id;S.cur=0;S.sel=[];S.anchor=null;S.tagId=null;S.selection=null;S.lastSel=null;S.rampSel=[];S.palSel=null;
   const a=asset();if(a){const shared=getFrameSelection().ids.filter(x=>a.frames.some(f=>f.id===x));if(shared.length){S.sel=shared;S.cur=D.indexOf(a,shared[shared.length-1]);}else if(a.frames.length)S.sel=[a.frames[0].id];
    S.layerId=[...a.layers].reverse().find(l=>l.visible&&!l.locked)?.id||a.layers[a.layers.length-1]?.id;}
   cleanup.reset();refreshAll();
  }
  ctx.on('locale',()=>{timeline.render(true);panels.renderAll();cleanup.render();bar.sync?.();updateStatus();});
  function afterPref(k){
   if(k==='onion'||k==='loopTag'){present();timeline.render();}
   else if(k==='symmetry'||k==='size'||k==='brush')overlay.invalidate();
   bar.sync?.();
  }
  // ------------------------------------------------------------ frame commands (same ids and keys as the Sprite workspace)
  const has=()=>!!asset(),hasFrames=()=>!!asset()?.frames.length;
  const cmd=(id,run,{keys,enabled=has,label,checked,group='pixel'}={})=>ctx.command({id,group,keys,run,enabled,checked,label:()=>t(label||'px.cmd.'+id.split('.').pop())});
  const scmd=(id,run,o={})=>cmd(id,run,{group:'frames',label:'sp.menuCmd.'+id.slice(7),enabled:hasFrames,...o});
  scmd('sprite.play',()=>{if(S.float){dropFloat();return;}S.playing?stop():play();},{keys:['Enter'],group:'navigate'});
  scmd('sprite.first',()=>{stop();const a=asset(),tg=prefs.loopTag?playTag():null;const pos=tg?tg.frameIds.map(id=>D.indexOf(a,id)).sort((x,y)=>x-y):[0];setCurrent(pos[0],{select:true});},{keys:['Home'],group:'navigate'});
  scmd('sprite.last',()=>{stop();const a=asset(),tg=prefs.loopTag?playTag():null;const pos=tg?tg.frameIds.map(id=>D.indexOf(a,id)).sort((x,y)=>x-y):[a.frames.length-1];setCurrent(pos[pos.length-1],{select:true});},{keys:['End'],group:'navigate'});
  scmd('sprite.onion',()=>W.setPref('onion',{...prefs.onion,on:!prefs.onion.on}),{keys:['F3'],group:'view',checked:()=>prefs.onion.on,enabled:has});
  scmd('sprite.preview',()=>{previewWin.toggle();},{keys:['F7'],group:'view',checked:()=>previewWin.open,enabled:has});
  scmd('sprite.newFrame',()=>{const a=asset(),ids=S.sel.length?S.sel:[frame().id];let made=[];exec(t('sp.cmd.newFrame',{n:ids.length}),d=>{const r=D.duplicateFrames(d,a.id,ids);made=r.ids;return r.doc;});S.sel=made;S.cur=D.indexOf(asset(),made[0]);refreshAll();},{keys:['Alt+N']});
  scmd('sprite.emptyFrame',async()=>{let a=asset();if(!a.frames.length){exec(t('px.cmd.animate'),d=>PD.frameFromCanvas(d,a.id));a=asset();}
   const f=D.emptyFrame(a),at=S.cur+1,blob=await emptyBlob(),cels=a.layers.map(l=>({layerId:l.id,frameId:f.id,blob,x:0,y:0,opacity:255}));
   exec(t('sp.cmd.emptyFrame'),d=>D.insertFrames(d,a.id,at,[f],cels).doc);S.sel=[f.id];S.cur=at;refreshAll();},{keys:['Alt+Shift+N'],enabled:has});
  scmd('sprite.deleteFrames',()=>{const a=asset(),ids=S.sel.length?[...S.sel]:[frame().id];if(ids.length>=a.frames.length){ctx.toast(t('px.hint.lastFrame'),{error:true});return;}exec(t('sp.cmd.deleteFrames',{n:ids.length}),d=>D.deleteFrames(d,a.id,ids));S.sel=[];S.cur=Math.min(S.cur,asset().frames.length-1);refreshAll();},{keys:['Alt+C']});
  scmd('sprite.flipFrames',()=>flipFrames(S.sel.length?S.sel:[frame().id]),{keys:[]});
  scmd('sprite.newTag',()=>{const a=asset(),pos=(S.sel.length?S.sel:[frame().id]).map(id=>D.indexOf(a,id)).sort((x,y)=>x-y),id=newTag(pos[0],pos[pos.length-1]);if(id){ctx.showPanel('px-timeline');requestAnimationFrame(()=>timeline.renameTag(id));}},{keys:['Alt+T']});
  scmd('sprite.renameTag',()=>{const tg=playTag();if(tg)timeline.renameTag(tg.id);},{keys:['F2'],enabled:()=>!!playTag()});
  let emptyId=null;async function emptyBlob(){if(emptyId&&images.has(emptyId))return emptyId;emptyId=await storeRGBA(images,{width:1,height:1,data:new Uint8Array(4)});return emptyId;}
  /** Mirrors the pixels of frames (every layer; own cels) and their pivots / boxes. */
  async function flipFrames(ids){
   const a=asset();if(!a)return;const frames=a.frames.filter(f=>ids.includes(f.id));const rgbaOf=await rgbaGetter(images,a,frames),cels=[];
   for(const f of frames){const r=f.sourceRect;for(const l of a.layers){const cel=celAt(a,l.id,f.id);if(!cel)continue;
    // the layer's raw pixels (no opacity applied) in the frame's region
    const src=rgbaOf(cel.blob),raw=new Uint8Array(r.w*r.h*4);for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const X=cel.x+x-r.x,Y=cel.y+y-r.y;if(X<0||Y<0||X>=r.w||Y>=r.h)continue;raw.set(src.data.subarray((y*src.width+x)*4,(y*src.width+x)*4+4),(Y*r.w+X)*4);}
    const fl=flipRGBA({width:r.w,height:r.h,data:raw});cels.push(await celFromRGBA(a,l.id,f.id,fl.data,r,cel.opacity));}}
   const set=new Set(ids);exec(t('sp.cmd.flip',{n:frames.length}),d=>P.mapAsset(PD.setCels(d,a.id,cels),a.id,x=>({...x,frames:x.frames.map(f=>set.has(f.id)?D.mirrorFrameMeta(f):f)})));
  }
  /** RGBA of a region → a cel (indexed PNG in an indexed sprite). */
  async function celFromRGBA(a,layerId,frameId,rgba,r,opacity=255){
   const idx=PD.isIndexed(a),ti=PD.transparentIndexOf(a);
   const p=idx?{w:r.w,h:r.h,data:indicesFromRGBA(rgba,r.w,r.h,a.palette.colors,{transparentIndex:ti}).indices}:R.planeFromRGBA(rgba,r.w,r.h);
   const clear=idx?Math.max(0,ti):0,b=R.planeBounds(p,clear)||{x:0,y:0,w:1,h:1},crop=R.cropPlane(p,b,clear);let blob;
   if(idx){const png=encodeIndexedPNG(crop.data,b.w,b.h,a.palette.colors,{transparentIndex:ti});blob=(await images.put(new Blob([png],{type:'image/png'}),{width:b.w,height:b.h})).id;}
   else blob=await storeRGBA(images,{width:b.w,height:b.h,data:new Uint8Array(crop.data.buffer.slice(0))});
   return {layerId,frameId,blob,x:r.x+b.x,y:r.y+b.y,opacity};
  }
  W.celFromRGBA=celFromRGBA;W.emptyBlob=emptyBlob;
  // ------------------------------------------------------------ pixel commands
  const painting=()=>has()&&!!S.layerId;
  cmd('pixel.swapColors',()=>W.swapColors(),{keys:['X']});
  cmd('pixel.brushSmaller',()=>W.setPref('size',Math.max(1,prefs.size-1)),{keys:['[']});
  cmd('pixel.brushBigger',()=>W.setPref('size',Math.min(16,prefs.size+1)),{keys:[']']});
  cmd('pixel.pixelPerfect',()=>W.setPref('pixelPerfect',!prefs.pixelPerfect),{checked:()=>prefs.pixelPerfect});
  cmd('pixel.symmetryX',()=>W.setPref('symmetry',{...prefs.symmetry,mode:prefs.symmetry.mode==='x'?'none':prefs.symmetry.mode==='both'?'y':prefs.symmetry.mode==='y'?'both':'x'}),{checked:()=>prefs.symmetry.mode==='x'||prefs.symmetry.mode==='both'});
  cmd('pixel.symmetryY',()=>W.setPref('symmetry',{...prefs.symmetry,mode:prefs.symmetry.mode==='y'?'none':prefs.symmetry.mode==='both'?'x':prefs.symmetry.mode==='x'?'both':'y'}),{checked:()=>prefs.symmetry.mode==='y'||prefs.symmetry.mode==='both'});
  cmd('pixel.copy',()=>copy(),{keys:['Mod+C'],enabled:painting});
  cmd('pixel.cut',()=>copy({cut:true}),{keys:['Mod+X'],enabled:painting});
  cmd('pixel.paste',async()=>{if(S.clip)pasteClip();else{try{const items=await navigator.clipboard.read();for(const it of items){const type=it.types.find(x=>x.startsWith('image/'));if(type){await pasteImageFile(await it.getType(type));return;}}}catch{}ctx.toast(t('px.hint.clipboardEmpty'),{error:true});}},{enabled:painting});
  cmd('pixel.reselect',()=>{if(S.lastSel)setSelection(S.lastSel);},{keys:['Mod+Shift+D'],enabled:()=>!!S.lastSel});
  cmd('pixel.invertSelection',()=>{const r=session.rect;setSelection(S.selection?R.invertMask(S.selection):new Uint8Array(r.w*r.h).fill(1));},{keys:['Mod+Shift+I'],enabled:painting});
  cmd('pixel.selectLayer',()=>selectLayerPixels(),{enabled:painting});
  cmd('pixel.flipH',()=>flip('x'),{keys:['Shift+H'],enabled:painting});
  cmd('pixel.flipV',()=>flip('y'),{keys:['Shift+V'],enabled:painting});
  cmd('pixel.rotateCW',()=>rotate('cw'),{enabled:painting});
  cmd('pixel.rotateCCW',()=>rotate('ccw'),{enabled:painting});
  cmd('pixel.outline',()=>fx('outline'),{enabled:painting});
  cmd('pixel.shadow',()=>fx('shadow'),{enabled:painting});
  cmd('pixel.replaceColor',()=>replaceColor(),{enabled:painting});
  cmd('pixel.drop',()=>dropFloat(),{enabled:()=>!!S.float});
  cmd('pixel.newLayer',()=>panels.layerOp('new'),{keys:['Shift+N']});
  cmd('pixel.duplicateLayer',()=>panels.layerOp('duplicate'),{keys:['Mod+J']});
  cmd('pixel.mergeDown',()=>panels.layerOp('merge'),{keys:['Mod+E'],enabled:()=>{const a=asset();return !!a&&a.layers.findIndex(l=>l.id===S.layerId)>0;}});
  cmd('pixel.deleteLayer',()=>panels.layerOp('delete'),{enabled:()=>(asset()?.layers.length||0)>1});
  cmd('pixel.newSprite',()=>panels.newSprite(),{enabled:()=>true});
  cmd('pixel.colorMode',()=>panels.colorModeDialog(),{});
  cmd('pixel.canvasSize',()=>panels.canvasSizeDialog(),{keys:['Mod+Alt+C']});
  cmd('pixel.lospec',()=>panels.lospec(),{enabled:()=>true});
  cmd('pixel.ramp',()=>panels.rampDialog(),{});
  cmd('pixel.variants',()=>panels.variantsDialog(),{});
  cmd('pixel.audit',()=>{ctx.showPanel('px-audit');panels.runAudit();},{});
  cmd('pixel.cleanup',()=>ctx.showPanel('px-cleanup'),{});
  cmd('pixel.exportAseprite',()=>exportAseprite(),{group:'file'});
  cmd('pixel.exportPNG',()=>exportFramePNG(),{group:'file'});
  cmd('pixel.animate',()=>{const a=asset();exec(t('px.cmd.animate'),d=>PD.frameFromCanvas(d,a.id));refreshAll();},{enabled:()=>!!asset()&&!asset().frames.length});
  ctx.menu({id:'pixel',title:'px.menu',items:()=>['pixel.newSprite','pixel.colorMode','pixel.canvasSize','-','pixel.copy','pixel.cut','pixel.paste','pixel.drop','-','pixel.reselect','pixel.invertSelection','pixel.selectLayer','-',
   'pixel.flipH','pixel.flipV','pixel.rotateCW','pixel.rotateCCW','pixel.replaceColor','pixel.outline','pixel.shadow','-','pixel.newLayer','pixel.duplicateLayer','pixel.mergeDown','pixel.deleteLayer','-',
   'pixel.swapColors','pixel.pixelPerfect','pixel.symmetryX','pixel.symmetryY','-','pixel.lospec','pixel.ramp','pixel.variants','pixel.audit','pixel.cleanup','-',
   'sprite.play','sprite.onion','sprite.preview','pixel.animate','-','pixel.exportPNG','pixel.exportAseprite']});
  // ------------------------------------------------------------ export
  async function exportAseprite(){
   const a0=asset();if(!a0)return;await commitChain;
   const a=a0.frames.length?a0:{...a0,frames:[P.frameForRect(a0,{x:0,y:0,w:a0.width,h:a0.height},{id:'f0',index:0})]};
   const rgbaOf=await rgbaGetter(images,a,a.frames),idx=PD.isIndexed(a);
   const {doc,skipped}=asepriteFromAsset(a,rgbaOf,idx?{palette:a.palette.colors,transparentIndex:PD.transparentIndexOf(a)}:{});
   const bytes=writeAseprite(doc),name=String(a.name).replace(/\.[^.]+$/,'')+'.aseprite';
   download(new Blob([bytes],{type:'application/octet-stream'}),name);
   ctx.toast(t('px.toast.aseprite',{name,layers:a.layers.length,frames:a.frames.length,mode:t(idx?'px.mode.indexed':'px.mode.rgb')})+(skipped.length?' · '+t('sp.export.skipped',{n:skipped.length,why:skipped[0].reason}):''));
   window.__pxLastExport={name,size:bytes.length,colorMode:doc.colorMode,layers:doc.layers.length,frames:doc.frames.length,skipped,bytes};
  }
  async function exportFramePNG(){
   const a=asset();if(!a)return;await commitChain;const d=session.compose(null,{onion:false}),{w,h:hh}=session.rect;
   let blob;
   // an indexed sprite whose frame uses only palette colours exports as PNG-8 with its palette
   if(PD.isIndexed(a)){const {indices,offPalette}=indicesFromRGBA(d,w,hh,a.palette.colors,{transparentIndex:PD.transparentIndexOf(a)});
    if(!offPalette)blob=new Blob([encodeIndexedPNG(indices,w,hh,a.palette.colors,{transparentIndex:PD.transparentIndexOf(a)})],{type:'image/png'});}
   if(!blob){const {encodeRGBAPNG}=await import('../../../game/texture-png.js');const png=await encodeRGBAPNG(d,w,hh);blob=png instanceof Blob?png:new Blob([png],{type:'image/png'});}
   const f=frame(),name=`${String(a.name).replace(/\.[^.]+$/,'')}${f?'_'+(S.cur+1):''}.png`;download(blob,name);ctx.toast(t('px.toast.png',{name,w,h:hh}));
  }
  function download(blob,name){const link=h('a',{href:URL.createObjectURL(blob),download:name});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),30000);}
  const importer=createImporter(ctx,{onChange:()=>refreshAll()});
  async function isPlainPicture(f){
   if(isSpriteFile(f)||!/^image\/|\.(png|jpe?g|webp|bmp|avif)$/i.test(f.type+' '+f.name))return false;
   const head=new Uint8Array(await f.slice(0,1<<16).arrayBuffer());
   return !(head[0]===137&&head[1]===80&&isAPNG(new Uint8Array(await f.arrayBuffer())));
  }
  async function importPicture(f,{from}){
   const {record,source}=await images.importFile(f);
   const a=P.imageAsset({name:f.name||'image.png',width:record.width,height:record.height,blob:record.id,source});
   ctx.execute(ctx.edit(t('cmd.importN',{n:1}),d=>P.addAssets(d,[a]),{meta:{from}}));
   await ctx.showAsset(a.id);ctx.toast(t('toast.imported',{n:1}));return [a.id];
  }
  // ------------------------------------------------------------ start
  S.assetId=null;timeline.render(true);panels.renderAll();cleanup.render();
  W.markTimelineLayer=markTimelineLayer;W.updateStatus=updateStatus;W.refreshAll=refreshAll;W.useAsset=useAsset;W.previewWin=previewWin;W.timeline=timeline;W.cleanupUI=cleanup;W.commitChain=()=>commitChain;
  window.__pixel=W;// tests and console scripts
  return {
   present:(a,opts)=>{if((a?.id||null)!==S.assetId)useAsset(a?.id||null);void opts;return present();},
   importFiles:async(files,{from}={})=>{
    // pasting an image while a sprite is open pastes it as floating pixels (Aseprite); anything else imports
    if(from==='paste'&&asset()&&files.length===1&&/^image\//.test(files[0].type)){await pasteImageFile(files[0]);return [];}
    // one plain picture arrives as one image to paint on (no sheet analysis); the Sprite importers
    // take GIF / APNG / .aseprite / numbered frames / atlas data with their frames, layers and tags
    if(files.length===1&&await isPlainPicture(files[0]))return importPicture(files[0],{from});
    return importer.importFiles(files,{from});
   },
   selectAll(){const r=session.rect;if(!r)return;setSelection(new Uint8Array(r.w*r.h).fill(1));},
   deselect(){if(tools.busy()){tools.cancel();return;}if(S.float){cancelFloat();return;}deselect();},
   hasSelection:()=>!!S.selection||!!S.float,
   deleteSelection(){if(S.float){const f=S.float;S.float=null;const l=session.layer(f.layerId);l.plane=f.base;session.refresh({x:0,y:0,w:session.rect.w,h:session.rect.h});if(!R.samePlane(l.plane,f.before))commitLayer(t('px.cmd.clear'));S.selection=null;overlay.setMask(null);return;}clearSelection();},
   nudge(dx,dy){if(!S.float&&!S.selection)return;if(!S.float&&!liftSelection())return;moveFloat(dx,dy);},
   step,
   onAsset(id){if(id!==S.assetId)useAsset(id);},
   deactivate(){stop();dropFloat();offSel();document.removeEventListener('paste',onPaste,true);previewWin.destroy();bar.remove();cleanup.destroy?.();delete window.__pixel;}
  };
 }
};
