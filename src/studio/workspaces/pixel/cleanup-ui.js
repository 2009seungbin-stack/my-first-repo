/** Cleanup panel of the Pixel workspace: upscaled / resampled / generated pixel art back to clean
 * 1× pixels. Measure first (nothing changes): the verdict, the scale and how sure it is, the grid on
 * the canvas; then options, a before/after preview at whole-number zoom, and "Apply as new sprite"
 * (one undo step; the original sprite is kept). All work runs in a worker from
 * src/studio/pixel/cleanup.js — deterministic, nothing leaves the device. */
import {h,storage} from '../../ui/dom.js';
import {modal} from '../../ui/dialogs.js';
import * as P from '../../core/project.js';
import * as PD from '../../pixel/pixel-doc.js';
import {DEFAULTS} from '../../pixel/cleanup.js';
import {indicesFromRGBA,hex} from '../../pixel/indexed.js';
import {encodeIndexedPNG} from '../../pixel/png8.js';
import {rgbaGetter,storeRGBA} from '../../sprite/frame-render.js';
import {composeFrame,composeCanvas} from '../../sprite/frame-image.js';
import {animatedAsset,stem} from '../../sprite/import-build.js';
import {SHARED} from '../../core/project.js';
const PREFS='nerulio.studio.pixel.cleanup.v1';
const MAX_PIXELS=48e6;// all frames of the scope together (the worker holds before + after)
let worker=null,seq=0;const waiting=new Map();
function work(msg,transfer=[]){
 worker||=Object.assign(new Worker(new URL('./cleanup-worker.js',import.meta.url),{type:'module'}),{
  onmessage:({data})=>{const w=waiting.get(data.id);if(!w)return;waiting.delete(data.id);data.ok?w.resolve(data.result):w.reject(Error(data.error));},
  onerror:e=>{for(const w of waiting.values())w.reject(Error(e.message||'worker failed'));waiting.clear();worker=null;}});
 const id=++seq;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});worker.postMessage({...msg,id},transfer);});
}
/** Stops a running job (a new measure replaces it; leaving the workspace ends it). */
function stopWorker(){if(!worker)return;worker.terminate();worker=null;for(const w of waiting.values())w.reject(Object.assign(Error('stopped'),{stopped:true}));waiting.clear();}
const copyFrame=f=>({data:new Uint8Array(f.data),width:f.width,height:f.height});
const OPT_KEYS=['background','alphaCut','merge','maxColors','dither','fringe','orphans','align','usePalette','outline','shadow','indexed'];
export function createCleanup(W){
 const {t,ctx,images}=W;
 const saved=storage.get(PREFS,{});
 const o={background:'auto',alphaCut:128,merge:'auto',maxColors:0,dither:'none',fringe:true,orphans:false,align:'off',usePalette:false,outline:false,shadow:false,indexed:false,...Object.fromEntries(Object.entries(saved).filter(([k])=>OPT_KEYS.includes(k)))};
 const S={scope:'frame',scale:'',analysis:null,inputs:null,frameIds:[],assetRef:null,assetId:null,state:'idle',result:null,error:'',view:0,showGrid:true,token:0};
 const root=h('div.px-clean',{'data-px':'cleanup','data-state':'idle'});
 const saveOpts=()=>storage.set(PREFS,Object.fromEntries(OPT_KEYS.map(k=>[k,o[k]])));
 // ------------------------------------------------------------------ what is cleaned
 function scopeFrames(a){
  if(!a.frames.length)return [{id:SHARED,frame:null}];
  const cur=W.cur(),f=a.frames[cur];
  if(S.scope==='all')return a.frames.map(x=>({id:x.id,frame:x}));
  if(S.scope==='tag'){const tg=W.playTag();if(tg){const ids=new Set(tg.frameIds);return a.frames.filter(x=>ids.has(x.id)).map(x=>({id:x.id,frame:x}));}}
  return f?[{id:f.id,frame:f}]:[];
 }
 async function gather(a){
  await W.commitChain();
  const list=scopeFrames(a),frames=list.map(x=>x.frame||{id:SHARED}),rgbaOf=await rgbaGetter(images,a,frames);
  const imgs=list.map(x=>x.frame?composeFrame(a,x.frame,rgbaOf):composeCanvas(a,{id:SHARED},rgbaOf));
  return {imgs,ids:list.map(x=>x.id)};
 }
 const setState=s=>{S.state=s;root.dataset.state=s;};
 const workOpts=()=>{
  const a=W.asset(),pal=o.usePalette&&a?.palette?.colors?.length?a.palette.colors.filter((c,i)=>!(PD.isIndexed(a)&&i===PD.transparentIndexOf(a))&&(c[3]??255)>0):null;
  const scale=Number(S.scale);
  return {...DEFAULTS,scale:scale>1?scale:'auto',background:o.background==='auto'?'auto':null,alphaCut:o.alphaCut>0?o.alphaCut:null,
   merge:o.merge==='off'?0:o.merge==='auto'?'auto':Number(o.merge)||'auto',maxColors:o.maxColors||0,palette:pal,dither:pal?o.dither:'none',fringe:o.fringe,orphans:o.orphans,align:o.align,
   outline:o.outline?{color:W.prefs.fg.slice(0,3),place:'outside',matrix:'circle'}:null,shadow:o.shadow?{color:W.prefs.bg.slice(0,3),dx:1,dy:1}:null};
 };
 async function measure(){
  const a=W.asset();if(!a)return;
  const token=++S.token;stopWorker();S.result=null;S.error='';setState('measuring');render();
  try{
   const {imgs,ids}=await gather(a);if(token!==S.token)return;
   const px=imgs.reduce((s,f)=>s+f.width*f.height,0);if(px>MAX_PIXELS)throw Error(t('px.clean.tooBig',{mp:(px/1e6).toFixed(1),max:MAX_PIXELS/1e6}));
   S.inputs=imgs;S.frameIds=ids;S.assetRef=a;S.assetId=a.id;S.view=0;
   const copies=imgs.map(copyFrame);
   S.analysis=await work({op:'analyse',frames:copies,opts:workOpts()},copies.map(f=>f.data.buffer));
   if(token!==S.token)return;setState('measured');
  }catch(e){if(e.stopped||token!==S.token)return;S.error=String(e.message||e);setState('error');}
  render();showGrid();
 }
 async function preview(){
  if(!S.analysis||!S.inputs)return;
  const token=++S.token;setState('running');render();
  try{
   const copies=S.inputs.map(copyFrame);
   const r=await work({op:'run',frames:copies,opts:workOpts(),analysis:S.analysis},copies.map(f=>f.data.buffer));
   if(token!==S.token)return;S.result=r;S.scrollResult=true;setState('done');
  }catch(e){if(e.stopped||token!==S.token)return;S.error=String(e.message||e);setState('error');}
  render();
 }
 /** The result becomes a new sprite next to the original: frames, durations, pivots, boxes and
  * tags of the cleaned frames are kept; one undo step. */
 async function apply(){
  const a=W.asset(),r=S.result;if(!a||!r||a.id!==S.assetId)return;
  const width=Math.max(...r.frames.map(f=>f.width)),height=Math.max(...r.frames.map(f=>f.height));
  const pal=r.palette&&r.palette.length<=255?r.palette:null,indexed=o.indexed&&!!pal,colors=indexed?[[0,0,0,0],...pal.map(c=>[c[0],c[1],c[2],255])]:null;
  const frames=[];
  for(let i=0;i<r.frames.length;i++){
   const f=r.frames[i],src=S.frameIds[i]===SHARED?null:a.frames.find(x=>x.id===S.frameIds[i]);let blob;
   if(indexed){const ind=indicesFromRGBA(f.data,f.width,f.height,colors,{transparentIndex:0}).indices;blob=(await images.put(new Blob([encodeIndexedPNG(ind,f.width,f.height,colors,{transparentIndex:0})],{type:'image/png'}),{width:f.width,height:f.height})).id;}
   else blob=await storeRGBA(images,{width:f.width,height:f.height,data:f.data});
   frames.push({name:src?.name||`${stem(a.name)}_${i}`,duration:src?.duration??100,pivotX:src?.pivotX??.5,pivotY:src?.pivotY??1,boxes:src?.boxes||[],cels:[{layer:0,blob,x:0,y:0}]});
  }
  const pos=new Map(S.frameIds.map((id,i)=>[id,i]));
  const tags=a.tags.map(tg=>({name:tg.name,positions:tg.frameIds.map(id=>pos.get(id)).filter(i=>i!=null),direction:tg.direction,repeat:tg.repeat,color:tg.color,fps:tg.fps})).filter(tg=>tg.positions.length);
  let next=animatedAsset({name:`${stem(a.name)}_1x`,width,height,frames,tags});
  if(pal)next={...next,palette:{colors:indexed?colors:pal.map(c=>[c[0],c[1],c[2],255])},...(indexed?{colorMode:'indexed',transparentIndex:0}:{})};
  W.exec(t('px.cmd.cleanupApply',{name:next.name}),d=>P.addAssets(d,[next]));
  ctx.toast(t('px.clean.applied',{name:next.name,w:width,h:height,n:frames.length}));
  await ctx.showAsset(next.id);
 }
 // ------------------------------------------------------------------ grid on the canvas
 function showGrid(){
  const ov=W.overlay;if(!ov)return;
  const A=S.analysis,a=W.asset();
  if(!S.showGrid||!A||!a||a.id!==S.assetId){ov.setGrid(null);return;}
  const g=A.grid||A.candidate;if(!g||g.kind==='unit'){ov.setGrid(null);return;}
  const f=a.frames[W.cur()]||null,k=S.frameIds.indexOf(f?f.id:SHARED);if(k<0){ov.setGrid(null);return;}
  const G=A.grid?(A.grid.perFrame?.[k]||A.grid):g;
  // frame-canvas coordinates → the region the canvas shows (frames with a trimmed rect are offset)
  let dx=0,dy=0;if(f){const inner=f.trimmedRect||f.sourceRect;dx=inner.x-f.sourceRect.x-f.offsetX;dy=inner.y-f.sourceRect.y-f.offsetY;}
  ov.setGrid({xs:G.xs.map(x=>x+dx),ys:G.ys.map(y=>y+dy),weak:!A.grid});
 }
 // ------------------------------------------------------------------ rendering
 const conf=c=>h('span.st-conf.is-'+(c==='user'?'alt':c||'low'),{},t('px.clean.conf.'+(c||'low')));
 const fmt=v=>Number.isInteger(v)?String(v):Number(v).toFixed(2);
 function verdict(A){
  const g=A.grid,c=A.check;
  if(g&&g.kind==='integer')return [t('px.clean.v.integer',{s:g.scale}),conf('high')];
  if(g&&g.kind==='lattice')return [t(g.order===2?'px.clean.v.smooth':'px.clean.v.lattice',{s:fmt(g.scaleX),sy:fmt(g.scaleY)}),conf(g.confidence)];
  if(g&&g.kind==='tracked')return [t('px.clean.v.tracked',{s:fmt(g.scaleX),sy:fmt(g.scaleY)}),conf(g.confidence)];
  if(c.verdict==='unit'&&(!A.candidate||A.candidate.kind==='unit'))return [t('px.clean.v.unit'),conf('high')];
  const cand=A.candidate&&A.candidate.kind!=='unit'?A.candidate:null;
  return [cand?t('px.clean.v.untrusted',{s:fmt(cand.scaleX??cand.scale)}):t('px.clean.v.none'),conf(cand?.confidence||'low')];
 }
 function field(label,control,hint){if(hint)control.title=hint;return h('label.px-f.px-f-full',{title:hint||null},h('span',{},label),control);}
 function select(id,value,options,on){const s=h('select.st-input.px-sel',{'data-px':'clean-'+id,'aria-label':t('px.clean.opt.'+id)},...options.map(([v,l])=>h('option',{value:v,selected:String(v)===String(value)||null},l)));s.addEventListener('change',()=>on(s.value));return s;}
 function check(id,on){const i=h('input',{type:'checkbox',checked:o[id]||null,'data-px':'clean-'+id});i.addEventListener('change',()=>{o[id]=i.checked;saveOpts();on?.();invalidateResult();});return h('label.st-check',{},i,t('px.clean.opt.'+id));}
 function invalidateResult(){if(S.result){S.result=null;setState('measured');render();}}
 function setOpt(k,v){o[k]=v;saveOpts();invalidateResult();}
 function render(){
  const a=W.asset();
  if(!a){root.replaceChildren(h('p.st-muted.st-pad',{},t('px.hint.noSprite')));return;}
  const stale=S.analysis&&(S.assetId!==a.id||S.assetRef!==a);
  const tag=W.playTag?.(),multi=a.frames.length>1;
  const seg=(v,label,enabled=true)=>{const b=h('button.px-segbtn',{type:'button',role:'radio','aria-checked':String(S.scope===v),disabled:enabled?null:true,'data-px':'clean-scope-'+v},label);b.addEventListener('click',()=>{S.scope=v;S.analysis=null;S.result=null;setState('idle');W.overlay?.setGrid(null);render();});return b;};
  if(S.scope==='tag'&&!tag||S.scope==='all'&&!multi)S.scope='frame';
  const scale=h('input.st-input.px-num',{type:'number',min:'1.5',max:'64',step:'0.01',value:S.scale,placeholder:t('px.clean.auto'),'data-px':'clean-scale','aria-label':t('px.clean.scale')});
  scale.addEventListener('change',()=>{S.scale=scale.value;if(S.analysis)measure();});
  const busy=S.state==='measuring'||S.state==='running';
  const go=h('button.st-btn'+(S.analysis&&!stale?'':'.primary'),{type:'button','data-px':'clean-measure',disabled:busy||null},S.state==='measuring'?t('px.clean.measuring'):S.analysis?t('px.clean.remeasure'):t('px.clean.measure'));go.addEventListener('click',()=>measure());
  const head=h('div.st-sec',{},
   h('p.st-muted.px-note',{},t('px.clean.lead')),
   a.frames.length>1?h('div.px-seg',{role:'radiogroup','aria-label':t('px.clean.scope')},seg('frame',t('px.clean.scopeFrame')),seg('tag',tag?t('px.clean.scopeTag',{name:tag.name}):t('px.clean.scopeTagNone'),!!tag),seg('all',t('px.clean.scopeAll',{n:a.frames.length}),multi)):h('p.px-scope-one',{},t(a.frames.length?'px.clean.scopeFrame':'px.clean.scopeImage')),
   h('div.px-clean-row',{},field(t('px.clean.scale'),scale,t('px.clean.scaleHint')),go));
  const parts=[head];
  if(S.state==='error')parts.push(h('div.st-sec',{},h('p.st-error',{'data-px':'clean-error'},t('px.clean.failed',{reason:S.error}))));
  if(S.analysis){
   const A=S.analysis,[v,c]=verdict(A),g=A.grid;
   const size=g?`${g.width}×${g.height}`:null,input=S.inputs?.[0];
   const bg=A.background?h('span',{},h('i.px-clean-sw',{style:`--c:rgb(${A.background.color.slice(0,3).join(',')})`}),t(o.background==='keep'?'px.clean.bgKept':'px.clean.bg',{hex:hex(A.background.color),pct:Math.round(A.background.share*100)})):t('px.clean.noBg');
   const gridT=h('input',{type:'checkbox',checked:S.showGrid||null,'data-px':'clean-grid'});gridT.addEventListener('change',()=>{S.showGrid=gridT.checked;showGrid();});
   parts.push(h('div.st-sec',{'data-px':'clean-analysis'},
    stale?h('p.px-warn',{},t('px.clean.stale')):'',
    h('p.px-verdict',{'data-px':'clean-verdict','data-kind':g?.kind||'none'},h('b',{},v),' ',c),
    h('ul.px-facts',{},
     input?h('li',{},t('px.clean.input',{w:input.width,h:input.height,n:S.inputs.length})):'',
     size?h('li',{'data-px':'clean-size'},t('px.clean.output',{size})):h('li',{},t('px.clean.noSnap')),
     h('li',{},t(A.noise.noisy?'px.clean.noisy':'px.clean.clean',{n:A.noise.distinct,pct:Math.round((A.noise.share||0)*100)})),
     h('li',{},bg)),
    (g||A.candidate&&A.candidate.kind!=='unit')?h('label.st-check',{},gridT,t('px.clean.showGrid')):'',
    !g&&A.candidate&&A.candidate.kind!=='unit'?h('p.st-muted.px-note',{},t('px.clean.untrustedHelp')):''));
   // options
   const mergeSel=select('merge',o.merge,[['auto',t('px.clean.mergeAuto')],['off',t('px.clean.mergeOff')],['0.02',t('px.clean.mergeLight')],['0.04',t('px.clean.mergeMedium')],['0.08',t('px.clean.mergeStrong')]],v2=>setOpt('merge',v2));
   const maxC=h('input.st-input.px-num',{type:'number',min:'0',max:'256',value:String(o.maxColors),'data-px':'clean-maxColors','aria-label':t('px.clean.opt.maxColors')});maxC.addEventListener('change',()=>setOpt('maxColors',Math.max(0,Math.min(256,Number(maxC.value)||0))));
   const alpha=h('input.st-input.px-num',{type:'number',min:'0',max:'255',value:String(o.alphaCut),'data-px':'clean-alphaCut','aria-label':t('px.clean.opt.alphaCut')});alpha.addEventListener('change',()=>setOpt('alphaCut',Math.max(0,Math.min(255,Number(alpha.value)||0))));
   const hasPal=!!a.palette?.colors?.length;
   const opts=h('details.st-sec.px-clean-opts',{open:storage.get(PREFS+'.open',false)||null},h('summary',{},t('px.clean.options')),
    field(t('px.clean.opt.background'),select('background',o.background,[['auto',t('px.clean.bgAuto')],['keep',t('px.clean.bgKeep')]],v2=>{setOpt('background',v2);render();})),
    field(t('px.clean.opt.alphaCut'),alpha,t('px.clean.alphaHint')),
    field(t('px.clean.opt.merge'),mergeSel,t('px.clean.mergeHint')),
    field(t('px.clean.opt.maxColors'),maxC,t('px.clean.maxHint')),
    hasPal?check('usePalette',()=>render()):h('p.st-muted.px-note',{},t('px.clean.noPalette')),
    hasPal&&o.usePalette?field(t('px.clean.opt.dither'),select('dither',o.dither,[['none',t('px.dither.none')],['bayer2','Bayer 2×2'],['bayer4','Bayer 4×4'],['bayer8','Bayer 8×8']],v2=>setOpt('dither',v2)),t('px.clean.ditherHint')):'',
    check('fringe'),check('orphans'),
    multi&&S.scope!=='frame'?field(t('px.clean.opt.align'),select('align',o.align,[['off',t('px.clean.alignOff')],['bounds',t('px.clean.alignBounds')],['overlap',t('px.clean.alignOverlap')]],v2=>setOpt('align',v2))):'',
    check('outline'),check('shadow'),check('indexed'));
   opts.addEventListener('toggle',()=>storage.set(PREFS+'.open',opts.open));
   parts.push(opts);
   const run=h('button.st-btn'+(S.result?'':'.primary'),{type:'button','data-px':'clean-preview',disabled:busy||stale||null},S.state==='running'?t('px.clean.running'):t('px.clean.preview'));run.addEventListener('click',()=>preview());
   parts.push(h('div.st-sec',{},h('div.st-row.px-clean-actions',{},run)));
  }
  if(S.result)parts.push(resultView());
  root.replaceChildren(...parts);
  if(S.state==='done'&&S.scrollResult){S.scrollResult=false;requestAnimationFrame(()=>root.querySelector('[data-px="clean-result"]')?.scrollIntoView({block:'nearest'}));}
 }
 function resultView(){
  const r=S.result,n=r.frames.length,k=Math.min(S.view,n-1),before=S.inputs[k],after=r.frames[k];
  const box=132;
  const pane=(img,label,which)=>{const z=zoomFor(img,box),c=h('canvas.px-clean-cv',{width:img.width,height:img.height,'data-px':'clean-'+which,style:`width:${Math.max(1,Math.round(img.width*z))}px;height:${Math.max(1,Math.round(img.height*z))}px`});
   c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer.slice(img.data.byteOffset,img.data.byteOffset+img.data.byteLength)),img.width,img.height),0,0);
   return h('figure.px-clean-fig',{},h('div.px-clean-well',{},c),h('figcaption',{},`${label} · ${img.width}×${img.height} · ${zoomLabel(z)}`));};
  const nav=n>1?h('div.px-clean-nav',{},navBtn('‹',-1),h('span',{'data-px':'clean-frame'},t('px.clean.frameN',{i:k+1,n})),navBtn('›',1)):'';
  const big=h('button.st-btn',{type:'button','data-px':'clean-compare'},t('px.clean.compare'));big.addEventListener('click',()=>compare(k));
  const apply1=h('button.st-btn.primary',{type:'button','data-px':'clean-apply'},t('px.clean.apply'));apply1.addEventListener('click',()=>apply());
  const steps=r.report.steps.map(s=>stepLine(s)).filter(Boolean);
  const pal=r.palette?.length?h('div.px-pal-grid.px-pal-preview',{'data-px':'clean-palette'},...r.palette.slice(0,256).map(c=>h('span.px-pal-sw',{style:`--c:rgb(${c[0]},${c[1]},${c[2]})`,title:hex(c)}))):'';
  return h('div.st-sec',{'data-px':'clean-result'},h('div.px-clean-pair',{},pane(before,t('px.clean.before'),'before'),pane(after,t('px.clean.after'),'after')),nav,
   h('ul.px-facts',{'data-px':'clean-report'},...steps.map(x=>h('li',{},x)),h('li',{},t('px.clean.colorsOut',{n:r.report.colors}))),pal,
   h('div.st-row',{},apply1,big),h('p.st-muted.px-note',{},t('px.clean.applyNote')));
 }
 const navBtn=(label,d)=>{const b=h('button.st-icon-btn',{type:'button','aria-label':t(d<0?'px.clean.prevFrame':'px.clean.nextFrame')},label);b.addEventListener('click',()=>{const n=S.result.frames.length;S.view=(Math.min(S.view,n-1)+d+n)%n;render();});return b;};
 function stepLine(s){
  switch(s.id){
   case 'snap':return t('px.clean.step.snap',{kind:t('px.clean.kind.'+s.kind),s:fmt(s.scale),size:s.size[0].join('×')});
   case 'background':return t('px.clean.step.background',{hex:hex(s.color),n:s.removed});
   case 'alpha':return s.changed?t('px.clean.step.alpha',{n:s.changed,cut:s.cut}):null;
   case 'merge':return s.before!==s.after?t('px.clean.step.merge',{a:s.before,b:s.after}):t('px.clean.step.keep',{n:s.before});
   case 'quantize':return t('px.clean.step.quantize',{n:s.colors,changed:s.changed,dither:s.dither});
   case 'fringe':return s.fixed?t('px.clean.step.fringe',{n:s.fixed}):null;
   case 'orphans':return t('px.clean.step.orphans',{n:s.fixed});
   case 'align':return t('px.clean.step.align',{max:s.max});
   case 'outline':return t('px.clean.step.outline',{n:s.changed});
   case 'shadow':return t('px.clean.step.shadow',{n:s.changed});
   default:return null;
  }
 }
 /** Big side-by-side comparison: the result at a whole-number zoom, the original at the same size. */
 function compare(k){
  const r=S.result,before=S.inputs[k],after=r.frames[k];let z=Math.max(1,Math.min(16,Math.floor(560/Math.max(after.width,after.height))));
  const cb=h('canvas.px-clean-cv',{width:before.width,height:before.height}),ca=h('canvas.px-clean-cv',{width:after.width,height:after.height});
  for(const [c,img]of [[cb,before],[ca,after]])c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer.slice(img.data.byteOffset,img.data.byteOffset+img.data.byteLength)),img.width,img.height),0,0);
  const cap=h('p.st-muted',{});
  const size=()=>{const W2=after.width*z,H2=after.height*z;ca.style.cssText=`width:${W2}px;height:${H2}px`;cb.style.cssText=`width:${W2}px;height:${H2}px`;cap.textContent=t('px.clean.compareCap',{z,bw:before.width,bh:before.height,aw:after.width,ah:after.height});};
  const zs=h('select.st-input.px-sel',{'aria-label':t('px.clean.zoom'),'data-px':'clean-zoom'},...[1,2,3,4,6,8,12,16].map(v=>h('option',{value:String(v),selected:v===z||null},v+'×')));zs.addEventListener('change',()=>{z=Number(zs.value);size();});
  size();
  modal(document.querySelector('.studio'),{title:t('px.clean.compare'),className:'px-compare',body:h('div.px-dlg',{},h('div.px-clean-row',{},h('span',{},t('px.clean.zoom')),zs),cap,
   h('div.px-compare-pair',{},h('figure.px-clean-fig',{},h('div.px-clean-well',{},cb),h('figcaption',{},t('px.clean.before'))),h('figure.px-clean-fig',{},h('div.px-clean-well',{},ca),h('figcaption',{},t('px.clean.after'))))),
   buttons:[{label:t('confirm.close'),value:null}]});
 }
 const zoomFor=(img,box)=>{const m=Math.max(img.width,img.height);if(m<=box)return Math.max(1,Math.floor(box/m));let n=2;while(m/n>box)n++;return 1/n;};
 const zoomLabel=z=>z>=1?z+'×':'1/'+Math.round(1/z);
 function reset(){++S.token;stopWorker();S.analysis=null;S.result=null;S.inputs=null;S.error='';S.assetRef=null;S.assetId=null;setState('idle');W.overlay?.setGrid(null);render();}
 function destroy(){++S.token;stopWorker();}
 return {root,render:()=>{render();showGrid();},showGrid,reset,destroy,measure,preview,apply,state:()=>S,options:o};
}
