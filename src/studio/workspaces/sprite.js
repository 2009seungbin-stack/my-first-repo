/** Sprite workspace (P1a): import → frames → animation timeline → pivots, hitboxes, collision.
 * Shapes: docs/STUDIO-SPRITE.md. Plug-in API: docs/STUDIO.md.
 *
 * Two views of the canvas: Frame (the current frame's canvas with onion skin, pivot, boxes and
 * collision — where animation work happens) and Sheet (the whole picture with the frame regions,
 * where slicing is checked and edited). ` toggles them. */
import {ShapeLayer} from '../canvas/canvas-view.js';
import {rectEditor} from '../canvas/rect-editor.js';
import {ICONS} from '../ui/icons.js';
import {h,storage} from '../ui/dom.js';
import * as P from '../core/project.js';
import * as D from '../sprite/sprite-doc.js';
import {SpriteOverlay} from '../sprite/overlay.js';
import {createTools} from '../sprite/tools.js';
import {createTimeline} from '../sprite/timeline-ui.js';
import {createPanels} from '../sprite/panels-ui.js';
import {createPreview} from '../sprite/preview-ui.js';
import {createImporter,isSpriteFile} from '../sprite/importers.js';
import {steps,stepAt,tagAt,stepIndex,onionFrames,rangeTag} from '../sprite/playback.js';
import {drawFrame,momentBitmap,blobRGBA,rgbaGetter,storeRGBA} from '../sprite/frame-render.js';
import {composeFrame,composeCanvas,flipRGBA,drawRGBA,celAt,frameDraws,opaqueBounds} from '../sprite/frame-image.js';
import {asepriteFromAsset} from '../sprite/aseprite-bridge.js';
import {writeAseprite} from '../../game/aseprite.js';
import {collisionPolygons} from '../../game/contour.js';
import {jitterReport,autoFixJitter} from '../../game/jitter.js';
import {frame as makeFrame} from '../../game/model.js';
import {SVG} from '../sprite/icons.js';
import {stem} from '../sprite/import-build.js';
import {gridCellsOf} from '../sprite/import-plan.js';
import {setFrameSelection,onFrameSelection,getFrameSelection} from '../core/frame-selection.js';
const PREFS='nerulio.studio.sprite.v1';
const DEFAULTS={mode:'frame',scope:'frame',boxType:'hit',onion:{on:false,before:1,after:1,opacity:.45},loopTag:true,cw:26,maxVertices:12,alphaThreshold:127,
 align:{width:null,height:null,padding:0,anchor:'bottom-center',trim:true},jitterRef:'bottom-center',preview:false,previewZoom:2,previewBg:'checker',previewPos:null,show:{pivot:true,boxes:true,collision:true}};
let cssLoaded=false;
function loadCSS(){if(cssLoaded)return;cssLoaded=true;const l=document.createElement('link');l.rel='stylesheet';l.href=new URL('../sprite/sprite.css',import.meta.url).href;document.head.append(l);}
Object.assign(ICONS,{spSelect:SVG.select,spPivot:SVG.pivot,spRect:SVG.rect,spCircle:SVG.circle,spPolygon:SVG.polygon,spRegion:SVG.region});
export default {
 id:'sprite',title:'ws.sprite',status:'ready',summary:'ws.spriteSummary',
 /** Files only this workspace understands switch the Studio to it (see app.js importFiles). */
 claims:files=>[...files].some(isSpriteFile),
 activate(ctx){
  loadCSS();
  const {t,view,images}=ctx;
  const prefs={...DEFAULTS,...storage.get(PREFS,{})};prefs.onion={...DEFAULTS.onion,...prefs.onion};prefs.align={...DEFAULTS.align,...prefs.align};prefs.show={...DEFAULTS.show,...prefs.show};
  const S={assetId:null,cur:0,sel:[],anchor:null,tagId:null,selection:{kind:'none'},playing:false,play:null,raf:0,jitter:null,alignResult:'',shown:null};
  const asset=()=>S.assetId?P.assetById(ctx.doc,S.assetId):null;
  const frame=()=>asset()?.frames[S.cur]||null;
  const exec=(label,fn,opts)=>ctx.execute(ctx.edit(label,fn,opts));
  // ------------------------------------------------------------ controller shared with the UI modules
  const W={
   t,ctx,images,history:ctx.history,prefs,
   asset,frame,assetId:()=>S.assetId,cur:()=>S.cur,selected:()=>S.sel,mode:()=>prefs.mode,selection:()=>S.selection,
   exec,toast:(m,o)=>ctx.toast(m,o),run:id=>ctx.runCommand(id),showPanel:id=>ctx.showPanel(id),
   hint:key=>ctx.toast(t(key)),boxType:()=>prefs.boxType,show:k=>prefs.show[k]!==false,
   playing:()=>S.playing,playTag,scopeIds,step,
   setPref(k,v){prefs[k]=v;storage.set(PREFS,prefs);afterPref(k);},
   setSelection(sel){S.selection=sel;overlay.invalidate();panels.renderFrame();},
   setCurrent,clickFrame,selectTag,setDurations,moveFrames,newTag,addBox,removeBox,
   choose:(id,alt)=>{const a=asset();if(a)importer.choose(a.id,id,alt);},
   applyImport:()=>{const a=asset();if(a&&importer.applySheet(a.id)){setMode('frame');setCurrent(0,{select:true});}},
   setCustomGrid:g=>importer.setCustomGrid(S.assetId,g),
   importState:()=>{const a=asset();if(!a)return null;const st=importer.sheetState(a.id),p=importer.planFor(a.id);return p?{...p,choice:st?.choice||{}}:st?{choice:st.choice}:null;},
   jitterReport:()=>S.jitter?.report||null,alignResult:()=>S.alignResult
  };
  // ------------------------------------------------------------ layers on the canvas
  const overlay=ctx.layer(new SpriteOverlay({mode:()=>prefs.mode,frame,selection:()=>S.selection,show:k=>prefs.show[k]!==false}));
  W.overlay=overlay;
  const regions=ctx.layer(new ShapeLayer({id:'sp-regions',z:10}));
  const planLayer=ctx.layer(new ShapeLayer({id:'sp-plan',z:9,color:'#7fd3ff',editable:false,handles:false,fill:'rgba(127,211,255,.08)'}));
  const islandLayer=ctx.layer(new ShapeLayer({id:'sp-islands',z:11,color:'#ff4d5e',editable:false,handles:false,labels:false}));
  const sheetEditor=rectEditor({layer:regions,bounds:()=>{const a=asset();return a?{x:0,y:0,w:a.width,h:a.height}:{x:0,y:0,w:0,h:0};},
   selection:()=>S.sel,onSelect:ids=>{const a=asset();if(!a)return;S.sel=a.frames.filter(f=>ids.includes(f.id)).map(f=>f.id);if(S.sel.length)S.cur=D.indexOf(a,S.sel[S.sel.length-1]);regions.setSelected(S.sel);setFrameSelection(S.sel,'sprite');timeline.mark();panels.renderFrame();status();},
   onChange(map,{phase,key}){if(phase==='end'){ctx.history.close(key);return;}if(phase==='cancel'&&ctx.history.abort(key))return;exec(t('sp.cmd.moveRegions'),d=>P.setFrameRects(d,S.assetId,map),{mergeKey:key,open:phase==='drag'});if(phase==='cancel')ctx.history.close(key);},
   onCreate(rect){const a=asset();if(!a)return;const f=P.frameForRect(a,rect,{id:P.uid('f'),index:a.frames.length});exec(t('sp.cmd.addRegion'),d=>P.addFrames(d,a.id,[f]));S.sel=[f.id];S.cur=asset().frames.length-1;refreshAll();},
   create:()=>regionDraw});
  let regionDraw=false;
  W.sheetTool=sheetEditor;
  // the first cell of a custom grid: drag to move the grid (offset), handles to resize the cells;
  // the whole grid previews live and the drop is one undo step
  const customLayer=ctx.layer(new ShapeLayer({id:'sp-custom-cell',z:12,color:'#ffc83d',selectedColor:'#ffc83d',fill:'rgba(255,200,61,.14)'}));
  let customDraft=null;
  const customGridNow=()=>{const a=asset();const p=a&&importer.planFor(a.id);const d=p?.plan.decisions.find(x=>x.id==='slice');return d?.chosen==='custom'?p.plan.grid:null;};
  const customEditor=rectEditor({layer:customLayer,bounds:()=>{const a=asset();return a?{x:0,y:0,w:a.width,h:a.height}:{x:0,y:0,w:0,h:0};},selection:()=>['cell0'],onSelect:()=>{},
   onChange(map,{phase}){
    if(phase==='drag'){const r=map.get('cell0');if(!r)return;customDraft=r;const g=customGridNow();if(g)previewGrid({...g,ox:r.x,oy:r.y,w:r.w,h:r.h});return;}
    if(phase==='end'&&customDraft){const g=customGridNow(),r=customDraft;customDraft=null;if(g)W.setCustomGrid({...g,ox:r.x,oy:r.y,w:r.w,h:r.h});return;}
    if(phase==='cancel'){customDraft=null;syncPlanLayer();}
   },create:()=>false});
  function previewGrid(g){
   const a=asset();if(!a)return;
   customLayer.setItems([{id:'cell0',x:g.ox,y:g.oy,w:g.w,h:g.h,label:1}]);customLayer.setSelected(['cell0']);
   planLayer.visible=true;planLayer.setItems(gridCellsOf(g,a.width,a.height).slice(0,20000).map((r,i)=>({id:'p'+i,x:r.x,y:r.y,w:r.w,h:r.h,label:i+1})));
  }
  // ------------------------------------------------------------ tools
  const tools=createTools(W);
  let sheetActive=sheetEditor;
  const sheetOr=(impl,draw)=>({...impl,
   down(i){if(prefs.mode==='sheet'){regionDraw=draw;const hit=customLayer.visible&&!draw?i.view.hitTest(i):null;sheetActive=hit?.layer===customLayer?customEditor:sheetEditor;return sheetActive.down(i);}return impl.down(i);},
   move(i){if(prefs.mode==='sheet')return sheetActive.move(i);return impl.move?.(i);},
   up(i){if(prefs.mode==='sheet')return sheetActive.up(i);return impl.up?.(i);},
   cancel(i){if(prefs.mode==='sheet')return sheetActive.cancel(i);return impl.cancel?.(i);},
   hover(i){if(prefs.mode==='sheet'){customEditor.hover(i);return sheetEditor.hover(i);}return impl.hover?.(i);},
   cursor(i){if(prefs.mode==='sheet'){const c=customEditor.cursor(i);return sheetActive===customEditor&&sheetActive.active||c!=='default'?c:sheetEditor.cursor(i);}return impl.cursor?.(i);},
   get active(){return prefs.mode==='sheet'?sheetActive.active:impl.active;}});
  ctx.tool({id:'sp-select',title:'sp.tool.select',icon:'spSelect',key:'V',order:10,hint:'sp.tool.selectHint',impl:sheetOr(tools.select,false)});
  ctx.tool({id:'sp-region',title:'sp.tool.region',icon:'spRegion',key:'M',order:15,hint:'sp.tool.regionHint',impl:{...sheetOr({down(){W.hint('sp.hint.sheetView');return false;},cursor:()=>'not-allowed'},true)}});
  ctx.tool({id:'sp-pivot',title:'sp.tool.pivot',icon:'spPivot',key:'P',order:20,hint:'sp.tool.pivotHint',impl:tools.pivot});
  ctx.tool({id:'sp-rect',title:'sp.tool.rect',icon:'spRect',key:'B',order:30,hint:'sp.tool.rectHint',impl:tools.rect});
  ctx.tool({id:'sp-circle',title:'sp.tool.circle',icon:'spCircle',key:'C',order:31,hint:'sp.tool.circleHint',impl:tools.circle});
  ctx.tool({id:'sp-polygon',title:'sp.tool.polygon',icon:'spPolygon',key:'Q',order:32,hint:'sp.tool.polygonHint',impl:tools.polygon});
  // ------------------------------------------------------------ panels
  const timeline=createTimeline(W),panels=createPanels(W);
  ctx.minBottomHeight?.(186);
  ctx.panel({id:'sp-timeline',title:()=>t('sp.panel.timeline'),dock:'bottom',order:5,badge:()=>{const a=asset();return a?.frames.length?String(a.frames.length):'';},render(body){body.append(timeline.root);}});
  ctx.panel({id:'sp-import',title:()=>t('sp.panel.import'),dock:'right',order:16,render(body){body.append(panels.imp);}});
  ctx.panel({id:'sp-frame',title:()=>t('sp.panel.frame'),dock:'right',order:12,render(body){body.append(panels.fr);}});
  ctx.panel({id:'sp-tag',title:()=>t('sp.panel.tag'),dock:'right',order:14,render(body){body.append(panels.tg);}});
  ctx.panel({id:'sp-align',title:()=>t('sp.panel.align'),dock:'right',order:40,render(body){body.append(panels.al);}});
  // canvas HUD: Frame / Sheet switch + what is showing
  const hudHost=view.root.parentElement;
  const hud=h('div.sp-hud',{role:'group','aria-label':t('sp.hud.view')});
  hudHost.append(hud);
  const previewWin=createPreview(W,view.root.closest('.studio')||document.body);
  function renderHud(){
   const a=asset(),mk=(mode,icon,label)=>{const b=h('button.sp-hud-btn',{type:'button','aria-pressed':String(prefs.mode===mode),'data-sp':'view-'+mode,title:label+' (`)'},h('span',{html:SVG[icon]}),h('span',{},label));b.addEventListener('click',()=>setMode(mode));return b;};
   const pv=h('button.sp-hud-btn',{type:'button','aria-pressed':String(previewWin.open),'data-sp':'preview-toggle',title:t('sp.preview.title')+' (F7)','aria-label':t('sp.preview.title')},h('span',{html:SVG.preview}));pv.addEventListener('click',()=>ctx.runCommand('sprite.preview'));
   const ic=(icon,label,fn,id)=>{const b=h('button.sp-hud-btn',{type:'button',title:label,'aria-label':label,'data-sp':id},h('span',{html:SVG[icon]}));b.addEventListener('click',fn);return b;};
   const hasF=!!a?.frames.length;
   // an unapplied sheet import: its Apply is on the canvas too (where the preview is being checked)
   const pending=a?.import?.kind==='sheet'&&!a.import.applied&&importer.planFor(a.id);
   if(pending){const b=h('button.sp-hud-btn.sp-hud-apply',{type:'button','data-sp':'hud-apply'},t('sp.imp.applyN',{n:pending.plan.rects.length}));b.addEventListener('click',()=>W.applyImport());hud.replaceChildren(mk('frame','frame',t('sp.hud.frame')),mk('sheet','sheet',t('sp.hud.sheet')),b);hud.hidden=false;return;}
   hud.replaceChildren(mk('frame','frame',t('sp.hud.frame')),mk('sheet','sheet',t('sp.hud.sheet')),
    ...(hasF?[h('span.sp-hud-count',{'data-sp':'hud-count'},`${S.cur+1}/${a.frames.length}`),ic('prev',t('sp.tl.prev')+' (,)',()=>step(-1),'hud-prev'),ic(S.playing?'pause':'play',(S.playing?t('sp.tl.stop'):t('sp.tl.play'))+' (Enter)',()=>ctx.runCommand('sprite.play'),'hud-play'),ic('next',t('sp.tl.next')+' (.)',()=>step(1),'hud-next')]:[]),pv);
   hud.hidden=!a;
  }
  // ------------------------------------------------------------ importer
  const importer=createImporter(ctx,{onChange:id=>{if(!id||id===S.assetId)refreshImport();}});
  function refreshImport(){
   panels.renderImport();syncPlanLayer();renderHud();
   const a=asset();
   if(a?.import?.kind==='sheet'&&!a.import.applied&&prefs.mode!=='sheet')setMode('sheet');
  }
  // ------------------------------------------------------------ selection & current frame
  function setCurrent(i,{select=false,keepSelection=false}={}){
   const a=asset();if(!a?.frames.length){S.cur=0;return;}
   S.cur=Math.max(0,Math.min(a.frames.length-1,i));
   if(select){S.sel=[a.frames[S.cur].id];S.anchor=a.frames[S.cur].id;}
   else if(!keepSelection&&!S.sel.includes(a.frames[S.cur].id)){S.sel=[a.frames[S.cur].id];S.anchor=a.frames[S.cur].id;}
   const f=a.frames[S.cur];if(S.tagId&&!a.tags.find(x=>x.id===S.tagId)?.frameIds.includes(f.id))S.tagId=null;
   if(S.selection.kind==='box'&&!f.boxes.some(b=>b.id===S.selection.id))S.selection={kind:'none'};
   onFrameChanged();
  }
  function clickFrame(i,mods={}){
   const a=asset();if(!a)return;const id=a.frames[i]?.id;if(!id)return;
   const r=D.clickSelect({selected:S.sel,anchor:S.anchor},id,mods,a.frames.map(f=>f.id));
   S.sel=r.selected;S.anchor=r.anchor;S.cur=i;
   const f=a.frames[i];if(S.tagId&&!a.tags.find(x=>x.id===S.tagId)?.frameIds.includes(f.id))S.tagId=null;
   onFrameChanged();
  }
  function selectTag(id){
   const a=asset(),tag=a?.tags.find(x=>x.id===id);if(!tag)return;
   S.tagId=id;const pos=tag.frameIds.map(f=>D.indexOf(a,f)).filter(i=>i>=0).sort((x,y)=>x-y);
   S.sel=[...tag.frameIds];S.anchor=a.frames[pos[0]]?.id;S.cur=pos[0]??0;
   onFrameChanged();panels.renderTag();
  }
  function playTag(){
   const a=asset();if(!a?.frames.length)return null;const f=a.frames[S.cur];
   if(S.tagId){const tg=a.tags.find(x=>x.id===S.tagId);if(tg&&tg.frameIds.includes(f?.id))return tg;}
   return tagAt(a,S.cur);
  }
  function scopeIds(){
   const a=asset(),f=frame();if(!a||!f)return [];
   if(prefs.scope==='all')return a.frames.map(x=>x.id);
   if(prefs.scope==='selected')return S.sel.length?[...S.sel]:[f.id];
   if(prefs.scope==='tag'){const tg=playTag();return tg?[...tg.frameIds]:[f.id];}
   return [f.id];
  }
  // the selected frames are shared with other workspaces/panels (P1b's Pack stage highlights them)
  const offSelection=onFrameSelection(({ids,source})=>{
   if(source==='sprite')return;const a=asset();if(!a)return;const known=ids.filter(id=>a.frames.some(f=>f.id===id));if(!known.length)return;
   S.sel=known;S.cur=D.indexOf(a,known[known.length-1]);onFrameChanged(false);
  });
  function onFrameChanged(share=true){
   if(share)setFrameSelection(S.sel,'sprite');
   present();timeline.mark();overlay.invalidate();
   regions.setSelected(S.sel);panels.renderFrame();panels.renderTag();panels.renderAlign();status();
  }
  function status(){
   const a=asset(),f=frame();if(!a){ctx.status('selection','');return;}
   if(!f){ctx.status('selection',t('sp.status.noFrames'));return;}
   const tg=playTag(),cnt=hud.querySelector('[data-sp="hud-count"]');if(cnt)cnt.textContent=`${S.cur+1}/${a.frames.length}`;
   ctx.status('selection',t('sp.status.frame',{i:S.cur+1,n:a.frames.length,ms:f.duration??100,tag:tg?` · ${tg.name}`:'',sel:S.sel.length>1?` · ${t('sp.status.selected',{n:S.sel.length})}`:''}));
  }
  // ------------------------------------------------------------ presenting the canvas
  let presenting=false,again=null;
  async function present(opts={}){
   if(presenting){again={...(again||{}),...opts};return;}
   presenting=true;
   try{let o=opts;do{again=null;await drawNow(o);o=again||{};}while(again);}
   catch(e){console.error(e);}
   finally{presenting=false;}
  }
  async function drawNow({restoreView=false,view:saved=null}={}){
   const a=asset();
   if(!a){view.clearImage();S.shown=null;renderHud();return;}
   let bmp,w,hgt;const f=a.frames[S.cur];
   if(prefs.mode==='sheet'||!f){
    bmp=await momentBitmap(images,a,f&&a.cels.some(c=>c.frameId===f.id)?f:null);w=a.width;hgt=a.height;
   }else{
    w=f.canvasWidth;hgt=f.canvasHeight;const c=new OffscreenCanvas(w,hgt),x=c.getContext('2d');x.imageSmoothingEnabled=false;
    if(prefs.onion.on&&!S.playing){
     const tg=prefs.loopTag?playTag():null;
     for(const o of onionFrames(a,S.cur,{before:prefs.onion.before,after:prefs.onion.after,opacity:prefs.onion.opacity,tag:tg}).reverse()){
      const of=a.frames[o.index],dx=Math.round(f.pivotX*f.canvasWidth-of.pivotX*of.canvasWidth),dy=Math.round(f.pivotY*f.canvasHeight-of.pivotY*of.canvasHeight);
      await drawFrame(x,images,a,of,{dx,dy,alpha:o.alpha,tint:prefs.onion.tint===false?null:o.side==='prev'?[255,70,70]:[70,140,255]});
     }
    }
    await drawFrame(x,images,a,f);bmp=c.transferToImageBitmap();
   }
   if(asset()!==a&&asset()?.id!==a.id){bmp.close?.();return;}
   const key=a.id+'|'+prefs.mode,prev=S.shown,same=prev&&prev.key===key&&view.image&&view.image.w===w&&view.image.h===hgt;
   let v=saved||null;
   if(!v&&prev&&prev.key===key&&view.image){v=same?view.view:{scale:view.view.scale,x:Math.round(view.view.x+(view.image.w-w)*view.view.scale/2),y:Math.round(view.view.y+(view.image.h-hgt)*view.view.scale/2)};}
   if(!v&&!restoreView&&S.views.has(key))v=S.views.get(key);
   const old=prev?.bmp;
   await view.setImage(bmp,w,hgt,{view:v});
   S.shown={key,bmp};if(old&&old!==bmp)old.close?.();
   keepFrameInView({strict:false});
   syncRegions();syncPlanLayer();renderHud();
  }
  S.views=new Map();
  /** The frame must stay on screen when the canvas area changes (a phone's panel sheet opening or
   * closing, a dock resize, rotation): centre it when it fits at this zoom, otherwise fit it. On a
   * phone the whole frame is kept visible; on a desktop a deliberately zoomed-in view is left alone
   * unless the frame went fully off-screen. */
  function keepFrameInView({strict=root()?.dataset.mode==='compact'}={}){
   if(!view.image||!view.W||!view.H)return;
   const v=view.view,s=v.scale,w=view.image.w*s,hh=view.image.h*s,W0=view.W,H0=view.H;
   const inside=v.x>=0&&v.y>=0&&v.x+w<=W0&&v.y+hh<=H0,visible=v.x<W0&&v.y<H0&&v.x+w>0&&v.y+hh>0;
   if(inside||(!strict&&visible))return;
   if(w<=W0&&hh<=H0)view.setView({scale:s,x:Math.round((W0-w)/2),y:Math.round((H0-hh)/2)},{clamp:false});else view.fit();
  }
  const root=()=>view.root.closest('.studio');
  let roRaf=0,lastBox='';
  const ro=new ResizeObserver(()=>{cancelAnimationFrame(roRaf);roRaf=requestAnimationFrame(()=>{const box=view.W+'x'+view.H;if(box===lastBox)return;lastBox=box;keepFrameInView();});});
  ro.observe(view.stage);
  ctx.on('view',v=>{if(S.shown)S.views.set(S.shown.key,{...v});});
  function setMode(mode){
   if(prefs.mode===mode)return;
   stop();prefs.mode=mode;storage.set(PREFS,prefs);
   const sheet=mode==='sheet';regions.visible=sheet;planLayer.visible=sheet;islandLayer.visible=sheet;overlay.visible=!sheet;
   present();renderHud();overlay.invalidate();
  }
  function syncRegions(){
   const a=asset(),sheet=prefs.mode==='sheet';regions.visible=sheet;overlay.visible=!sheet;
   regions.setItems(a&&sheet?a.frames.map((f,i)=>({id:f.id,x:f.sourceRect.x,y:f.sourceRect.y,w:f.sourceRect.w,h:f.sourceRect.h,label:i+1})):[]);
   regions.setSelected(S.sel);
  }
  function syncPlanLayer(){
   const a=asset(),sheet=prefs.mode==='sheet',p=a&&a.import?.kind==='sheet'&&!a.import.applied?importer.planFor(a.id):null;
   planLayer.visible=sheet;islandLayer.visible=sheet;
   planLayer.setItems(p&&sheet?p.plan.rects.map((r,i)=>({id:'p'+i,x:r.x,y:r.y,w:r.w,h:r.h,label:i+1})):[]);
   const slice=p?.plan.decisions.find(d=>d.id==='slice')?.chosen;
   islandLayer.setItems(p&&sheet&&slice==='auto'?(p.analysis.auto?.unassignedRects||[]).map((r,i)=>({id:'u'+i,x:r.x-1,y:r.y-1,w:r.w+2,h:r.h+2})):[]);
   const g=sheet&&!customDraft?customGridNow():null;
   customLayer.visible=!!g;customLayer.setItems(g?[{id:'cell0',x:g.ox,y:g.oy,w:g.w,h:g.h,label:1}]:[]);customLayer.setSelected(g?['cell0']:[]);
  }
  // ------------------------------------------------------------ playback
  function play(){
   const a=asset();if(!a?.frames.length||S.playing)return;
   const tg=prefs.loopTag?playTag():null,tag=tg||rangeTag(a);
   const list=steps(a,tag,{whole:!!tg&&tg.repeat>0});if(!list.length)return;
   const k=Math.max(0,list.findIndex(s=>s.index===S.cur));
   S.playing=true;S.play={list,loop:!tg||tg.repeat===0,t0:performance.now()-list[k].from};
   timeline.mark();renderHud();
   const tick=()=>{if(!S.playing)return;S.raf=requestAnimationFrame(tick);
    const s=stepAt(S.play.list,performance.now()-S.play.t0,{loop:S.play.loop});
    if(s.done){S.cur=s.index;stop();onFrameChanged();return;}
    if(s.index!==S.cur){S.cur=s.index;present();timeline.mark();status();}};
   S.raf=requestAnimationFrame(tick);
  }
  function stop(){if(!S.playing)return;S.playing=false;cancelAnimationFrame(S.raf);timeline.mark();renderHud();present();panels.renderFrame();}
  function step(dir){const a=asset();if(!a?.frames.length)return;stop();const tg=prefs.loopTag?playTag():null;setCurrent(stepIndex(a,S.cur,dir,tg),{select:true});}
  // ------------------------------------------------------------ edits
  function setDurations(ids,ms){if(!ids.length)return;exec(t('sp.cmd.duration',{n:ids.length,ms}),d=>D.setDurations(d,S.assetId,ids,ms));}
  function moveFrames(ids,to){const a=asset();exec(t('sp.cmd.moveFrames',{n:ids.length}),d=>D.moveFrames(d,a.id,ids,to));const b=asset();S.cur=D.indexOf(b,a.frames[S.cur].id);refreshAll();}
  function newTag(from,to){
   const a=asset();if(!a)return null;const before=new Set(a.tags.map(x=>x.id));
   exec(t('sp.cmd.newTag'),d=>D.tagFromRange(d,a.id,from,to,{name:t('sp.tag.defaultName')}));
   const made=asset().tags.find(x=>!before.has(x.id));if(made){S.tagId=made.id;}refreshAll();return made?.id||null;
  }
  function addBox(spec){
   const ids=scopeIds();if(!ids.length)return;
   let id=null;exec(t('sp.cmd.addBox',{type:spec.type}),d=>{const r=D.addBox(d,S.assetId,ids,spec);id=r.id;return r.doc;});
   S.selection={kind:'box',id};overlay.invalidate();panels.renderFrame();
  }
  function removeBox(id){exec(t('sp.cmd.removeBox'),d=>D.removeBox(d,S.assetId,scopeIds(),id));if(S.selection.id===id)S.selection={kind:'none'};}
  /** Own cels with the pixels of `fn(rgba)` for every drawn layer of each frame (exact). */
  async function repaint(frames,fn){
   const a=asset(),rgbaOf=await rgbaGetter(images,a,frames),newCels=[];
   for(const f of frames){const inner=f.trimmedRect||f.sourceRect;
    for(const d of frameDraws(a,f,{layers:new Set(a.layers.map(l=>l.id))})){
     const src=rgbaOf(d.cel.blob),raw=new Uint8Array(inner.w*inner.h*4);drawRGBA(raw,inner.w,inner.h,src.data,src.width,src.height,d.cel.x-inner.x,d.cel.y-inner.y,255,0);
     const out=fn({width:inner.w,height:inner.h,data:raw});const blob=await storeRGBA(images,out);
     newCels.push({layerId:d.layer.id,frameId:f.id,blob,x:inner.x,y:inner.y,opacity:d.cel.opacity});}}
   return newCels;
  }
  async function flipFrames(ids){
   const a=asset();if(!a)return;const frames=a.frames.filter(f=>ids.includes(f.id));if(!frames.length)return;
   const cels=await repaint(frames,img=>flipRGBA(img));const set=new Set(ids);
   exec(t('sp.cmd.flip',{n:frames.length}),d=>P.mapAsset(d,a.id,x=>({...x,frames:x.frames.map(f=>set.has(f.id)?D.mirrorFrameMeta(f):f),
    cels:[...x.cels.filter(c=>!(set.has(c.frameId)&&cels.some(n=>n.frameId===c.frameId&&n.layerId===c.layerId))),...cels]})));
  }
  async function mirrorTag(){
   const a=asset(),tg=playTag();if(!a||!tg)return;
   const {doc:d1,ids}=D.duplicateFrames(ctx.doc,a.id,tg.frameIds);
   // build the copies in a scratch document first so the whole operation is one undo step
   const scratch=P.assetById(d1,a.id),copies=scratch.frames.filter(f=>ids.includes(f.id));
   const rgbaOf=await rgbaGetter(images,scratch,copies),cels=[];
   for(const f of copies){const inner=f.trimmedRect||f.sourceRect;for(const d of frameDraws(scratch,f,{layers:new Set(scratch.layers.map(l=>l.id))})){
    const src=rgbaOf(d.cel.blob),raw=new Uint8Array(inner.w*inner.h*4);drawRGBA(raw,inner.w,inner.h,src.data,src.width,src.height,d.cel.x-inner.x,d.cel.y-inner.y,255,0);
    cels.push({layerId:d.layer.id,frameId:f.id,blob:await storeRGBA(images,flipRGBA({width:inner.w,height:inner.h,data:raw})),x:inner.x,y:inner.y,opacity:d.cel.opacity});}}
   const set=new Set(ids),name=`${tg.name}_mirror`;
   exec(t('sp.cmd.mirrorTag',{name}),()=>{let d=P.mapAsset(d1,a.id,x=>({...x,
    tags:x.tags.map(q=>({...q,frameIds:q.frameIds.filter(id=>!set.has(id))})),
    frames:x.frames.map(f=>set.has(f.id)?{...D.mirrorFrameMeta(f),name:`${f.name.replace(/_copy\d*$/,'')}_mirror`}:f),
    cels:[...x.cels.filter(c=>!(set.has(c.frameId)&&cels.some(n=>n.frameId===c.frameId&&n.layerId===c.layerId))),...cels]}));
    d=P.addTag(d,a.id,{name,frameIds:ids,direction:tg.direction,repeat:tg.repeat,fps:tg.fps});
    return P.mapAsset(d,a.id,x=>D.syncTags(x));});
   const b=asset();S.tagId=b.tags.find(q=>q.name===name||q.name.startsWith(name))?.id||null;setCurrent(D.indexOf(b,ids[0]),{select:true});
  }
  async function autoCollision(){
   const a=asset(),ids=scopeIds();if(!a||!ids.length)return;const frames=a.frames.filter(f=>ids.includes(f.id));
   const rgbaOf=await rgbaGetter(images,a,frames),by=new Map();let v=0,warn=[];
   for(const f of frames){const img=composeFrame(a,f,rgbaOf);const r=collisionPolygons({data:img.data,width:img.width,height:img.height},{threshold:prefs.alphaThreshold,maxVertices:prefs.maxVertices});
    by.set(f.id,r.polygons.map(p=>p.points));v+=r.vertices||0;warn=warn.concat(r.warnings||[]);}
   exec(t('sp.cmd.autoCollision',{n:frames.length}),d=>D.setCollision(d,a.id,by));
   ctx.toast(t('sp.col.done',{n:frames.length,v})+(warn.length?' · '+warn[0]:''));
  }
  /** Frames as a virtual strip (exact pixels) for src/game/jitter.js. */
  async function strip(a,frames){
   const rgbaOf=await rgbaGetter(images,a,frames);let x=0;const parts=frames.map(f=>{const inner=f.trimmedRect||f.sourceRect,img=composeCanvas(a,f,rgbaOf,{rect:inner});const r={x,y:0,w:inner.w,h:inner.h};x+=inner.w;return {f,img,r};});
   const W0=Math.max(1,x),H0=Math.max(1,...parts.map(p=>p.r.h)),data=new Uint8ClampedArray(W0*H0*4);
   for(const p of parts)for(let y=0;y<p.r.h;y++)data.set(p.img.data.subarray(y*p.r.w*4,(y+1)*p.r.w*4),(y*W0+p.r.x)*4);
   return {src:{data,width:W0,height:H0},vframes:parts.map(p=>({...p.f,sourceRect:p.r,trimmedRect:null}))};
  }
  function jitterFrames(){const a=asset(),tg=playTag(),ids=prefs.scope==='frame'?(tg?tg.frameIds:a.frames.map(f=>f.id)):scopeIds();return a.frames.filter(f=>ids.includes(f.id));}
  async function measureJitter(){
   const a=asset();if(!a)return;const frames=jitterFrames();
   try{const {src,vframes}=await strip(a,frames),report=jitterReport(src,vframes,{reference:prefs.jitterRef});
    const byId=new Map(report.points.map((p,i)=>[p.id,Math.hypot(report.series.residualX[i],report.series.residualY[i])]));
    S.jitter={report,byId,assetFrames:a.frames};timeline.setJitter({byId});panels.renderAlign();
    ctx.toast(t('sp.align.measured',{n:frames.length,max:report.residual.max.toFixed(2)}));
   }catch(e){ctx.toast(e.message,{error:true});}
  }
  async function fixJitter(preserveTrend){
   const a=asset();if(!a)return;const frames=jitterFrames();
   try{const {src,vframes}=await strip(a,frames),r=autoFixJitter(src,vframes,{reference:prefs.jitterRef,preserveTrend});
    const by=new Map(r.frames.map(f=>[f.id,f]));
    exec(t('sp.cmd.fixJitter',{n:frames.length}),d=>P.mapAsset(d,a.id,x=>({...x,frames:x.frames.map(f=>{const q=by.get(f.id);return q?makeFrame({...f,canvasWidth:q.canvasWidth,canvasHeight:q.canvasHeight,offsetX:q.offsetX,offsetY:q.offsetY,pivotX:q.pivotX,pivotY:q.pivotY,boxes:q.boxes,collision:q.collision}):f;})})));
    ctx.toast(t('sp.align.fixed',{before:r.beforeResidual.max.toFixed(2),after:r.afterResidual.max.toFixed(2)})+(r.warnings.length?' · '+r.warnings[r.warnings.length-1]:''));
    await measureJitter();
   }catch(e){ctx.toast(e.message,{error:true});}
  }
  async function normalize(){
   const a=asset(),ids=scopeIds();if(!a||!ids.length)return;const o=prefs.align;
   let base=ctx.doc;
   if(o.trim){// record each frame's opaque bounds first: alignment moves the artwork, not empty space
    const frames=a.frames.filter(f=>ids.includes(f.id)),rgbaOf=await rgbaGetter(images,a,frames),trims=new Map();
    for(const f of frames){const img=composeCanvas(a,f,rgbaOf,{rect:f.sourceRect}),b=opaqueBounds(img,0);if(b)trims.set(f.id,{x:f.sourceRect.x+b.x,y:f.sourceRect.y+b.y,w:b.w,h:b.h});}
    base=P.mapAsset(base,a.id,x=>({...x,frames:x.frames.map(f=>{const r=trims.get(f.id);if(!r)return f;const inner=f.trimmedRect||f.sourceRect,dx=r.x-inner.x,dy=r.y-inner.y;return makeFrame({...f,trimmedRect:r,offsetX:f.offsetX+dx,offsetY:f.offsetY+dy});})}));
   }
   try{const {doc,result}=D.normalizeCanvas(base,a.id,ids,{width:o.width||undefined,height:o.height||undefined,align:o.anchor,padding:o.padding||0});
    exec(t('sp.cmd.normalize',{n:ids.length,w:result.canvasWidth,h:result.canvasHeight}),()=>doc);
    S.alignResult=t('sp.align.result',{n:ids.length,w:result.canvasWidth,h:result.canvasHeight,moved:result.shifts.filter(s=>s.dx||s.dy).length});panels.renderAlign();
   }catch(e){ctx.toast(e.message,{error:true});}
  }
  async function exportAseprite(){
   const a=asset();if(!a?.frames.length){ctx.toast(t('sp.status.noFrames'),{error:true});return;}
   const rgbaOf=await rgbaGetter(images,a,a.frames),{doc,skipped}=asepriteFromAsset(a,rgbaOf);
   const bytes=writeAseprite(doc),blob=new Blob([bytes],{type:'application/octet-stream'}),name=stem(a.name)+'.aseprite';
   const link=h('a',{href:URL.createObjectURL(blob),download:name});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),30000);
   ctx.toast(t('sp.export.aseprite',{name,frames:a.frames.length,tags:doc.tags.length})+(skipped.length?' · '+t('sp.export.skipped',{n:skipped.length,why:skipped[0].reason}):''));
   window.__spLastExport={name,size:bytes.length,skipped};
  }
  // ------------------------------------------------------------ commands + menu
  const has=()=>!!asset(),hasFrames=()=>!!asset()?.frames.length;
  const cmd=(id,run,{keys,enabled=hasFrames,label,checked,group='frames'}={})=>ctx.command({id,group,keys,run,enabled,checked,label:()=>t(label||'sp.menuCmd.'+id.slice(7))});
  cmd('sprite.play',()=>{if(tools.drawing()&&tools.finishPolygon())return;S.playing?stop():play();},{keys:['Enter'],group:'navigate'});
  cmd('sprite.first',()=>{stop();const a=asset(),tg=prefs.loopTag?playTag():null;const pos=tg?tg.frameIds.map(id=>D.indexOf(a,id)).sort((x,y)=>x-y):[0];setCurrent(pos[0],{select:true});},{keys:['Home'],group:'navigate'});
  cmd('sprite.last',()=>{stop();const a=asset(),tg=prefs.loopTag?playTag():null;const pos=tg?tg.frameIds.map(id=>D.indexOf(a,id)).sort((x,y)=>x-y):[a.frames.length-1];setCurrent(pos[pos.length-1],{select:true});},{keys:['End'],group:'navigate'});
  cmd('sprite.onion',()=>W.setPref('onion',{...prefs.onion,on:!prefs.onion.on}),{keys:['F3'],group:'view',checked:()=>prefs.onion.on,enabled:has});
  cmd('sprite.preview',()=>{previewWin.toggle();renderHud();},{keys:['F7'],group:'view',checked:()=>previewWin.open,enabled:has});
  cmd('sprite.toggleView',()=>setMode(prefs.mode==='frame'?'sheet':'frame'),{keys:['`'],group:'view',enabled:has});
  cmd('sprite.newFrame',()=>{const a=asset();const ids=S.sel.length?S.sel:[frame().id];let made=[];exec(t('sp.cmd.newFrame',{n:ids.length}),d=>{const r=D.duplicateFrames(d,a.id,ids);made=r.ids;return r.doc;});const b=asset();S.sel=made;S.cur=D.indexOf(b,made[0]);refreshAll();},{keys:['Alt+N']});
  cmd('sprite.emptyFrame',async()=>{const a=asset(),f=D.emptyFrame(a),at=S.cur+1;
   // a transparent own cel on every layer, so it does not show the shared picture
   const blob=await storeRGBA(images,{width:1,height:1,data:new Uint8Array(4)});const cels=a.layers.map(l=>({layerId:l.id,frameId:f.id,blob,x:0,y:0,opacity:255}));
   exec(t('sp.cmd.emptyFrame'),d=>D.insertFrames(d,a.id,at,[f],cels).doc);S.sel=[f.id];S.cur=at;refreshAll();},{keys:['Alt+Shift+N'],enabled:has});
  cmd('sprite.deleteFrames',()=>deleteFrames(),{keys:['Alt+C']});
  cmd('sprite.flipFrames',()=>flipFrames(S.sel.length?S.sel:[frame().id]),{keys:['Shift+H']});
  cmd('sprite.mirrorTag',()=>mirrorTag(),{enabled:()=>!!playTag()});
  cmd('sprite.newTag',()=>{const a=asset();const pos=(S.sel.length?S.sel:[frame().id]).map(id=>D.indexOf(a,id)).sort((x,y)=>x-y);const id=newTag(pos[0],pos[pos.length-1]);if(id){ctx.showPanel('sp-timeline');requestAnimationFrame(()=>timeline.renameTag(id));}},{keys:['Alt+T']});
  cmd('sprite.renameTag',()=>{const tg=playTag();if(tg)timeline.renameTag(tg.id);},{keys:['F2'],enabled:()=>!!playTag()});
  cmd('sprite.copyBoxesNext',()=>{const a=asset(),f=frame(),n=a.frames[S.cur+1];if(!n){ctx.toast(t('sp.box.noNext'),{error:true});return;}exec(t('sp.cmd.copyBoxes',{n:1}),d=>D.copyBoxes(d,a.id,f.id,[n.id]));setCurrent(S.cur+1,{select:true});},{keys:['Alt+B'],enabled:()=>!!frame()?.boxes.length});
  cmd('sprite.copyBoxesScope',()=>{const a=asset(),f=frame(),ids=scopeIds().filter(id=>id!==f.id);if(!ids.length){ctx.toast(t('sp.box.scopeOne'),{error:true});return;}exec(t('sp.cmd.copyBoxes',{n:ids.length}),d=>D.copyBoxes(d,a.id,f.id,ids));},{enabled:()=>!!frame()?.boxes.length});
  cmd('sprite.autoCollision',()=>autoCollision(),{});
  cmd('sprite.clearCollision',()=>{const ids=scopeIds();exec(t('sp.cmd.clearCollision'),d=>D.setCollision(d,S.assetId,new Map(ids.map(id=>[id,[]]))));},{});
  cmd('sprite.normalize',()=>normalize(),{});
  cmd('sprite.measureJitter',()=>measureJitter(),{});
  cmd('sprite.fixJitter',()=>fixJitter(true),{enabled:()=>!!S.jitter});
  cmd('sprite.fixJitterPin',()=>fixJitter(false),{enabled:()=>!!S.jitter});
  cmd('sprite.exportAseprite',()=>exportAseprite(),{group:'file'});
  cmd('sprite.applyImport',()=>W.applyImport(),{enabled:()=>!!importer.planFor(S.assetId||'')});
  const folderInput=h('input',{type:'file',multiple:true,webkitdirectory:true,hidden:true});
  folderInput.addEventListener('change',()=>{const f=[...folderInput.files];folderInput.value='';if(f.length)ctx.importFiles(f,{from:'folder'});});
  view.root.append(folderInput);
  cmd('sprite.importFolder',()=>folderInput.click(),{group:'file',enabled:()=>true});
  ctx.menu({id:'sprite',title:'sp.menu',items:()=>['sprite.importFolder','sprite.applyImport','-','sprite.play','sprite.first','sprite.last','frame.prev','frame.next','-',
   'sprite.newFrame','sprite.emptyFrame','sprite.deleteFrames','sprite.flipFrames','-','sprite.newTag','sprite.renameTag','sprite.mirrorTag','-',
   'sprite.copyBoxesNext','sprite.copyBoxesScope','sprite.autoCollision','sprite.clearCollision','-','sprite.normalize','sprite.measureJitter','sprite.fixJitter','-',
   'sprite.onion','sprite.preview','sprite.toggleView','-','sprite.exportAseprite']});
  function deleteFrames(){
   const a=asset();if(!a?.frames.length)return;const ids=S.sel.length?[...S.sel]:[frame().id],n=ids.length;
   exec(t('sp.cmd.deleteFrames',{n}),d=>D.deleteFrames(d,a.id,ids));
   const b=asset();S.sel=[];S.cur=Math.min(S.cur,Math.max(0,b.frames.length-1));if(b.frames[S.cur])S.sel=[b.frames[S.cur].id];
   ctx.toast(t('sp.toast.deleted',{n,undo:ctx.shortcutOf('edit.undo')}));refreshAll();
  }
  // ------------------------------------------------------------ prefs side effects
  function afterPref(k){
   if(k==='onion'||k==='loopTag'){present();timeline.render();}
   else if(k==='scope'){panels.renderFrame();panels.renderAlign();}
   else if(k==='boxType'){panels.renderFrame();}
   else if(k==='cw'){}
   else if(k==='align'||k==='jitterRef'){panels.renderAlign();}
   else if(k==='maxVertices'||k==='alphaThreshold'){panels.renderFrame();}
  }
  // ------------------------------------------------------------ document / asset events
  function refreshAll(){
   const a=asset();
   if(a){S.cur=Math.max(0,Math.min(S.cur,a.frames.length-1));const ids=new Set(a.frames.map(f=>f.id));S.sel=S.sel.filter(id=>ids.has(id));if(!S.sel.length&&a.frames[S.cur])S.sel=[a.frames[S.cur].id];}
   present();timeline.render();panels.renderAll();syncRegions();syncPlanLayer();overlay.invalidate();status();renderHud();ctx.badge('sp-timeline');
  }
  ctx.on('doc',(doc,prev,ev)=>{
   const a=asset();if(!a){if(S.assetId&&!P.assetById(doc,S.assetId)){S.assetId=null;}refreshAll();return;}
   const pa=prev?P.assetById(prev,a.id):null;
   if(pa===a)return;
   if(S.jitter&&S.jitter.assetFrames!==a.frames){S.jitter=null;timeline.setJitter(null);}
   if(ev?.type==='undo'||ev?.type==='redo'||ev?.type==='reset'){tools.select.cancel?.();}
   if(a.import?.kind==='sheet'&&a.import.applied&&(!pa?.import?.applied)&&prefs.mode==='sheet'&&a.frames.length)setMode('frame');
   refreshAll();
  });
  ctx.on('asset',id=>{if(id!==S.assetId)useAsset(id);});
  function useAsset(id){
   stop();
   S.assetId=id;S.cur=0;S.sel=[];S.anchor=null;S.tagId=null;S.selection={kind:'none'};S.jitter=null;S.alignResult='';timeline.setJitter(null);
   const a=asset();
   if(a){if(a.frames.length)S.sel=[a.frames[0].id];
    // start on the frames another workspace selected (e.g. picked on the Pack stage's atlas)
    const shared=getFrameSelection().ids.filter(id=>a.frames.some(f=>f.id===id));if(shared.length){S.sel=shared;S.cur=D.indexOf(a,shared[shared.length-1]);}
    if(a.import?.kind==='sheet'&&!a.import.applied){if(prefs.mode!=='sheet')setMode('sheet');importer.analyzeSheet(a.id).catch(()=>{});}
    else if(!a.frames.length&&prefs.mode!=='sheet')setMode('sheet');
    else if(a.frames.length&&prefs.mode==='sheet'&&a.import?.kind&&a.import.kind!=='sheet')setMode('frame');}
   refreshAll();
  }
  ctx.on('locale',()=>{timeline.render(true);panels.renderAll();renderHud();status();});
  // ------------------------------------------------------------ workspace hooks for the shell
  S.assetId=null;renderHud();timeline.render(true);panels.renderAll();
  return {
   present:(a,opts)=>{if((a?.id||null)!==S.assetId)useAsset(a?.id||null);return present(opts);},
   importFiles:(files,opts)=>importer.importFiles(files,opts),
   selectAll(){const a=asset();if(!a)return;S.sel=a.frames.map(f=>f.id);onFrameChanged();},
   deselect(){if(tools.drawing()){tools.polygon.cancel();return;}if(S.selection.kind!=='none'){W.setSelection({kind:'none'});return;}const f=frame();S.sel=f?[f.id]:[];onFrameChanged();},
   hasSelection:()=>tools.drawing()||S.selection.kind==='box'||S.selection.kind==='collision'||S.selection.kind==='pivot'||S.sel.length>0,
   deleteSelection(){
    if(tools.undoPoint())return;
    if(S.selection.kind==='box'){removeBox(S.selection.id);return;}
    if(S.selection.kind==='collision'){const f=frame(),pi=S.selection.poly;exec(t('sp.cmd.clearCollision'),d=>D.setCollision(d,S.assetId,new Map([[f.id,f.collision.filter((_,i)=>i!==pi)]])));S.selection={kind:'none'};return;}
    if(S.selection.kind==='pivot')return;
    deleteFrames();
   },
   nudge(dx,dy){
    const a=asset(),f=frame();if(!a||!f)return;
    if(prefs.mode==='sheet'){const map=new Map(a.frames.filter(x=>S.sel.includes(x.id)).map(x=>[x.id,{...x.sourceRect,x:x.sourceRect.x+dx,y:x.sourceRect.y+dy}]));for(const r of map.values())if(r.x<0||r.y<0||r.x+r.w>a.width||r.y+r.h>a.height)return;exec(t('sp.cmd.moveRegions'),d=>P.setFrameRects(d,a.id,map),{mergeKey:'nudge-r'});return;}
    if(S.selection.kind==='box'){const id=S.selection.id;exec(t('sp.cmd.moveBox'),d=>D.updateBox(d,a.id,scopeIds(),id,b=>b.shape==='rect'?{x:b.x+dx,y:b.y+dy}:b.shape==='circle'?{cx:b.cx+dx,cy:b.cy+dy}:{points:b.points.map(([x,y])=>[x+dx,y+dy])}),{mergeKey:'nudge-b'+id});return;}
    if(S.selection.kind==='pivot'){exec(t('sp.cmd.movePivot'),d=>D.nudgePivot(d,a.id,scopeIds(),dx,dy),{mergeKey:'nudge-p'});}
   },
   step,
   onAsset(id){if(id!==S.assetId)useAsset(id);},
   handoff(meta,assets){
    const id=typeof assets?.[0]==='string'?assets[0]:assets?.[0]?.id,a=id&&P.assetById(ctx.doc,id);if(!a||!Array.isArray(meta?.frames)||!meta.frames.length)return;
    const frames=[];for(const f of meta.frames.slice(0,4096)){try{const r=P.clampRect(f.sourceRect,a);frames.push(makeFrame({...f,id:P.uid('f')+frames.length,sourceRect:r,trimmedRect:null,canvasWidth:r.w,canvasHeight:r.h,offsetX:0,offsetY:0,duration:f.duration??100,boxes:[],collision:[]}));}catch{}}
    if(!frames.length)return;
    const groups=new Map();frames.forEach((f,i)=>{const k=f.tag||'';if(!k)return;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
    exec(t('sp.cmd.handoff',{n:frames.length}),d=>D.setTags(D.replaceContent(d,a.id,{frames,importInfo:{kind:'sprite-lab',decisions:[{id:'lab',label:'lab',chosen:'handoff',confidence:'high',reasons:[`${frames.length} frames from Sprite Lab`],alternatives:[]}]}}),a.id,[...groups].map(([name,pos])=>({name,frameIds:pos.map(i=>frames[i].id)}))));
    ctx.toast(t('sp.toast.handoff',{n:frames.length}));setMode('frame');
   },
   deactivate(){stop();offSelection();ro.disconnect();cancelAnimationFrame(roRaf);previewWin.destroy();hud.remove();folderInput.remove();}
  };
 }
};
export {celAt,blobRGBA};
