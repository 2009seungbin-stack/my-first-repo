/** Panels and dialogs of the Pixel workspace: the context bar (tool options), Colour (FG/BG with an
 * HSV picker), Palette (true indexed palette: reorder by drag, add / remove / sort / edit, import /
 * export, Lospec, ramps, team-colour variants), Layers (add / duplicate / merge down / delete /
 * reorder, visibility, lock, opacity, blend modes), Audit (per-frame colour budget and strays),
 * New sprite and Colour mode. Every document change is one undo step. */
import {h,storage} from '../../ui/dom.js';
import {modal} from '../../ui/dialogs.js';
import {icon} from '../../ui/icons.js';
import * as P from '../../core/project.js';
import * as PD from '../../pixel/pixel-doc.js';
import * as R from '../../pixel/raster.js';
import * as I from '../../pixel/indexed.js';
import * as PIO from '../../pixel/palette-io.js';
import {hueShiftRamp} from '../../pixel/ramps.js';
import {auditFrames,strayMask} from '../../pixel/audit.js';
import {encodeIndexedPNG,decodeIndexedPNG} from '../../pixel/png8.js';
import {BLEND_MODES,blendRGBA,mul8} from '../../../game/aseprite-blend.js';
import {rampMap,TEAM_COLORS} from '../../../game/palette.js';
import {blobRGBA,rgbaGetter,storeRGBA} from '../../sprite/frame-render.js';
import {composeFrame,blendIndex} from '../../sprite/frame-image.js';
import {indexCache} from './session.js';
const CONSENT='nerulio.studio.lospec.consent.v1';
const hexOf=c=>I.hex(c);
export function createPanels(W){
 const {t,ctx,images,session}=W;
 const asset=()=>W.asset(),prefs=W.prefs;
 const btn=(ic,label,fn,{id,cls=''}={})=>{const b=h('button.st-icon-btn'+cls,{type:'button',title:label,'aria-label':label,'data-px':id||null});b.innerHTML=icon(ic)||'';if(!icon(ic))b.textContent=label;b.addEventListener('click',fn);return b;};
 const sel=(label,value,options,on,id)=>{const s=h('select.st-input.px-sel',{'aria-label':label,title:label,'data-px':id||null},...options.map(([v,l])=>h('option',{value:v,selected:String(v)===String(value)||null},l)));s.addEventListener('change',()=>on(s.value));return s;};
 const num=(label,value,min,max,on,id,step=1)=>{const i=h('input.st-input.px-num',{type:'number',min:String(min),max:String(max),step:String(step),value:String(value),'aria-label':label,title:label,'data-px':id||null});i.addEventListener('change',()=>{const v=Math.max(min,Math.min(max,Number(i.value)||min));i.value=String(v);on(v);});return i;};
 const toggle=(label,on,fn,id)=>{const b=h('button.px-tog',{type:'button','aria-pressed':String(!!on),'data-px':id||null},label);b.addEventListener('click',fn);return b;};
 // ------------------------------------------------------------------ context bar (tool options)
 const lab=text=>h('span.px-f.px-lab',{'aria-hidden':'true'},text);
 function contextBar(){
  const el=h('div.px-bar',{role:'toolbar','aria-label':t('px.bar.label'),'data-px':'bar'});
  const sync=()=>{
   const tool=ctx.activeTool||'',o=prefs,paint=/px-(pencil|eraser|line|rect|ellipse)/.test(tool),fill=/px-(bucket|wand)/.test(tool),shape=/px-(rect|ellipse)/.test(tool),selT=/px-(marquee|lasso|wand|move)/.test(tool);
   const parts=[h('span.px-bar-tool',{},t('px.tool.'+(tool.replace('px-','')||'pencil')))];
   if(paint){
    parts.push(h('label.px-f',{},h('span',{},t('px.bar.size')),num(t('px.bar.size'),o.size,1,16,v=>W.setPref('size',v),'size'),
     h('input.px-range',{type:'range',min:'1',max:'16',value:String(o.size),'aria-label':t('px.bar.size'),'data-px':'size-range',oninput:e=>W.setPref('size',Number(e.target.value))})));
    parts.push(sel(t('px.bar.brush'),o.brush,[['square',t('px.brush.square')],['round',t('px.brush.round')]],v=>W.setPref('brush',v),'brush'));
    if(tool!=='px-eraser')parts.push(lab(t('px.bar.ink')),sel(t('px.bar.ink'),o.ink,[['simple',t('px.ink.simple')],['alpha',t('px.ink.alpha')],['lockAlpha',t('px.ink.lockAlpha')],['shading',t('px.ink.shading')],['dither',t('px.ink.dither')]],v=>W.setPref('ink',v),'ink'));
    if(tool==='px-pencil')parts.push(toggle(t('px.bar.pixelPerfect'),o.pixelPerfect,()=>W.setPref('pixelPerfect',!o.pixelPerfect),'pixel-perfect'));
    if(o.ink==='dither'&&tool!=='px-eraser')parts.push(sel(t('px.bar.pattern'),o.ditherPattern,Object.keys(R.DITHER_PATTERNS).map(k=>[k,t('px.dither.'+k)]),v=>W.setPref('ditherPattern',v),'dither-pattern'),
     h('label.px-f',{},h('span',{},t('px.bar.density')),num(t('px.bar.density'),o.ditherDensity,0,100,v=>W.setPref('ditherDensity',v),'dither-density',5)),
     sel(t('px.bar.second'),o.ditherSecond,[['bg',t('px.dither.bg')],['keep',t('px.dither.keep')]],v=>W.setPref('ditherSecond',v),'dither-second'));
    if(o.ink==='shading'&&tool!=='px-eraser')parts.push(h('span.px-hint',{},W.S.rampSel.length>=2?t('px.bar.rampSel',{n:W.S.rampSel.length}):t('px.bar.rampAll')));
    const s=o.symmetry;
    parts.push(lab(t('px.bar.symmetry')),sel(t('px.bar.symmetry'),s.mode,[['none',t('px.sym.none')],['x',t('px.sym.x')],['y',t('px.sym.y')],['both',t('px.sym.both')]],v=>W.setPref('symmetry',{...s,mode:v}),'symmetry'));
    if(s.mode!=='none'){const r=session.rect||{w:0,h:0};
     if(s.mode!=='y')parts.push(h('label.px-f',{},h('span',{},'X'),num(t('px.bar.axisX'),s.axisX??r.w/2,0,r.w,v=>W.setPref('symmetry',{...s,axisX:v}),'axis-x',.5)));
     if(s.mode!=='x')parts.push(h('label.px-f',{},h('span',{},'Y'),num(t('px.bar.axisY'),s.axisY??r.h/2,0,r.h,v=>W.setPref('symmetry',{...s,axisY:v}),'axis-y',.5)));}
    if(shape)parts.push(toggle(t('px.bar.filled'),o.shapeFill,()=>W.setPref('shapeFill',!o.shapeFill),'filled'));
   }
   if(fill){parts.push(toggle(t('px.bar.contiguous'),o.contiguous,()=>W.setPref('contiguous',!o.contiguous),'contiguous'),
    h('label.px-f',{},h('span',{},t('px.bar.tolerance')),num(t('px.bar.tolerance'),o.tolerance,0,255,v=>W.setPref('tolerance',v),'tolerance')),
    toggle(t('px.bar.sampleMerged'),o.sampleMerged,()=>W.setPref('sampleMerged',!o.sampleMerged),'sample-merged'));
    if(tool==='px-bucket')parts.push(lab(t('px.bar.ink')),sel(t('px.bar.ink'),o.ink==='alpha'||o.ink==='lockAlpha'?'simple':o.ink,[['simple',t('px.ink.simple')],['shading',t('px.ink.shading')],['dither',t('px.ink.dither')]],v=>W.setPref('ink',v),'ink'));}
   if(tool==='px-picker')parts.push(lab(t('px.bar.sample')),sel(t('px.bar.sample'),o.eyedropSample,[['merged',t('px.sample.merged')],['layer',t('px.sample.layer')]],v=>W.setPref('eyedropSample',v),'eyedrop-sample'));
   if(selT){parts.push(h('span.px-hint',{},t('px.bar.selectHint')));
    const b=(label,cmd,id)=>{const x=h('button.px-tog',{type:'button','data-px':id},label);x.addEventListener('click',()=>ctx.runCommand(cmd));return x;};
    parts.push(b(t('px.cmd.flipH'),'pixel.flipH','flip-h'),b(t('px.cmd.flipV'),'pixel.flipV','flip-v'),b(t('px.cmd.rotateCW'),'pixel.rotateCW','rotate-cw'),b(t('px.cmd.rotateCCW'),'pixel.rotateCCW','rotate-ccw'),b(t('px.cmd.outline'),'pixel.outline','outline'),b(t('px.cmd.shadow'),'pixel.shadow','shadow'));
    if(W.floating())parts.push(b(t('px.cmd.drop'),'pixel.drop','drop'));}
   el.replaceChildren(...parts);el.hidden=!asset();
  };
  el.sync=sync;
  // re-sync when the tool changes (the tool bar and keys both go through the shell)
  const mo=new MutationObserver(()=>sync());const tb=document.querySelector('.st-toolbar');if(tb)mo.observe(tb,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
  el.addEventListener('remove',()=>mo.disconnect());
  const origRemove=el.remove.bind(el);el.remove=()=>{mo.disconnect();origRemove();};
  sync();return el;
 }
 // ------------------------------------------------------------------ Colour
 const color=h('div.px-color',{'data-px':'color'});
 let editing='fg';
 function renderColor(){
  const sw=(which)=>{const c=prefs[which],b=h('button.px-swatch-big',{type:'button','data-px':which,'aria-pressed':String(editing===which),title:t('px.color.'+which)+' '+hexOf(c),style:`--c:rgba(${c[0]},${c[1]},${c[2]},${(c[3]??255)/255})`},h('span',{}));b.addEventListener('click',()=>{editing=which;renderColor();});return b;};
  const swap=btn('pxSwap',t('px.cmd.swapColors')+' (X)',()=>W.swapColors(),{id:'swap'});
  const c=prefs[editing],[H,S,V]=rgbToHsv(c);
  const sv=h('canvas.px-sv',{width:160,height:96,'data-px':'sv','aria-label':t('px.color.sv')});drawSV(sv,H);
  const mark=h('span.px-sv-mark',{style:`left:${S*100}%;top:${(1-V)*100}%`});
  const svWrap=h('div.px-sv-wrap',{},sv,mark);
  const pickSV=e=>{const r=sv.getBoundingClientRect(),s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),v=Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));const rgb=hsvToRgb(H,s,v);W.setColor(editing,[...rgb,c[3]??255]);};
  sv.addEventListener('pointerdown',e=>{sv.setPointerCapture(e.pointerId);pickSV(e);const mv=ev=>pickSV(ev),up=()=>{sv.removeEventListener('pointermove',mv);sv.removeEventListener('pointerup',up);};sv.addEventListener('pointermove',mv);sv.addEventListener('pointerup',up);});
  const hue=h('input.px-hue',{type:'range',min:'0',max:'359',value:String(Math.round(H)),'aria-label':t('px.color.hue'),'data-px':'hue'});hue.addEventListener('input',()=>{const rgb=hsvToRgb(Number(hue.value),S||1,V||1);W.setColor(editing,[...rgb,c[3]??255]);});
  const alpha=h('input.px-alpha',{type:'range',min:'0',max:'255',value:String(c[3]??255),'aria-label':t('px.color.alpha'),'data-px':'alpha'});alpha.addEventListener('change',()=>W.setColor(editing,[c[0],c[1],c[2],Number(alpha.value)]));
  const hex=h('input.st-input.px-hex',{type:'text',value:hexOf(c),spellcheck:'false','aria-label':t('px.color.hex'),'data-px':'hex'});hex.addEventListener('change',()=>{const v=I.parseHex(hex.value);if(v)W.setColor(editing,v);else hex.value=hexOf(c);});
  const a=asset(),idx=PD.isIndexed(a),k=idx?I.matcher(a.palette.colors,{exclude:PD.transparentIndexOf(a)}).nearest(c[0],c[1],c[2],c[3]??255):null;
  color.replaceChildren(h('div.px-color-top',{},h('div.px-swatches',{},sw('fg'),sw('bg'),swap),h('div.px-color-info',{},hex,h('small.st-muted',{},`rgba(${c.join(', ')})`),idx?h('small.st-muted',{'data-px':'fg-index'},t('px.color.index',{i:k})):'')),
   svWrap,h('label.px-f.px-f-full',{},h('span',{},t('px.color.hue')),hue),h('label.px-f.px-f-full',{},h('span',{},t('px.color.alpha')),alpha),
   idx?h('p.st-muted.px-note',{},t('px.color.indexedNote')):'');
 }
 // ------------------------------------------------------------------ Palette
 const palette=h('div.px-palette',{'data-px':'palette'});
 let palSel=new Set(),dragFrom=null,imageColors=null,lastClick=null;
 function paletteActions(actions){
  actions.append(btn('plus',t('px.pal.add'),()=>addFg(),{id:'pal-add'}),btn('trash',t('px.pal.remove'),()=>removeSelected(),{id:'pal-remove'}),btn('pxSort',t('px.pal.sort'),e=>sortMenu(e.currentTarget),{id:'pal-sort'}),btn('pxMenu',t('px.pal.more'),e=>palMenu(e.currentTarget),{id:'pal-menu'}));
 }
 function currentColors(){const a=asset();if(!a)return [];if(a.palette?.colors?.length)return a.palette.colors;return imageColors||[];}
 function renderPalette(){
  const a=asset();if(!a){palette.replaceChildren(h('p.st-muted.st-pad',{},t('px.hint.noSprite')));return;}
  const cols=currentColors(),ti=PD.transparentIndexOf(a),idx=PD.isIndexed(a),fromImage=!a.palette?.colors?.length;
  if(fromImage&&!imageColors){imageColors=[];deriveImageColors();}
  const fgKey=I.colorKey(prefs.fg),bgKey=I.colorKey(prefs.bg);
  const grid=h('div.px-pal-grid',{role:'listbox','aria-multiselectable':'true','aria-label':t('px.panel.palette'),'data-px':'pal-grid'});
  cols.forEach((c,i)=>{
   const isT=idx&&i===ti,sw=h('button.px-pal-sw'+(isT?'.is-transparent':''),{type:'button',role:'option','aria-selected':String(palSel.has(i)),'data-i':String(i),title:`${i}: ${hexOf(c)}${isT?' · '+t('px.pal.transparent'):''}${W.S.rampSel.includes(i)?' · '+t('px.pal.inRamp'):''}`,style:`--c:rgba(${c[0]},${c[1]},${c[2]},${(c[3]??255)/255})`,draggable:'false'});
   if(I.colorKey(c)===fgKey)sw.classList.add('is-fg');if(I.colorKey(c)===bgKey)sw.classList.add('is-bg');if(W.S.rampSel.includes(i))sw.classList.add('is-ramp');
   grid.append(sw);
  });
  const info=h('p.st-muted.px-pal-info',{'data-px':'pal-info'},fromImage?t('px.pal.fromImage',{n:cols.length}):t(idx?'px.pal.infoIndexed':'px.pal.infoRgb',{n:cols.length,ti}));
  const ramp=W.S.rampSel.length?h('p.st-muted.px-pal-info',{},t('px.pal.rampSel',{n:W.S.rampSel.length})):'';
  palette.replaceChildren(grid,info,ramp);
 }
 async function deriveImageColors(){
  const a=asset();if(!a||!session.rect)return;const d=session.compose(null,{onion:false}),ex=I.exactPalette([{data:d}],{max:257});
  imageColors=ex?ex.colors.slice(1):[];renderPalette();
 }
 // palette pointer: click = FG, right-click = BG, Shift/Ctrl = select several (a shading ramp),
 // drag = move entries (the picture keeps its colours), double-click = edit the colour
 palette.addEventListener('contextmenu',e=>{const sw=e.target.closest('.px-pal-sw');if(!sw)return;e.preventDefault();const i=Number(sw.dataset.i),c=currentColors()[i];W.setColor('bg',PD.isIndexed(asset())&&i===PD.transparentIndexOf(asset())?[0,0,0,0]:c,{index:i});});
 palette.addEventListener('pointerdown',e=>{const sw=e.target.closest('.px-pal-sw');if(!sw||e.button!==0)return;dragFrom={i:Number(sw.dataset.i),x:e.clientX,y:e.clientY,moved:false,mods:{shift:e.shiftKey,mod:e.ctrlKey||e.metaKey}};palette.setPointerCapture(e.pointerId);});
 palette.addEventListener('pointermove',e=>{if(!dragFrom)return;if(!dragFrom.moved&&Math.hypot(e.clientX-dragFrom.x,e.clientY-dragFrom.y)>6)dragFrom.moved=true;if(dragFrom.moved){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.px-pal-sw');for(const s of palette.querySelectorAll('.is-drop'))s.classList.remove('is-drop');el?.classList.add('is-drop');}});
 palette.addEventListener('pointerup',e=>{const d=dragFrom;dragFrom=null;if(!d)return;for(const s of palette.querySelectorAll('.is-drop'))s.classList.remove('is-drop');
  if(d.moved){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.px-pal-sw');if(el)moveEntries(palSel.has(d.i)?[...palSel]:[d.i],Number(el.dataset.i));return;}
  const i=d.i,c=currentColors()[i];
  // double-click = edit (detected here: the first click re-renders the swatches, so the browser's dblclick never reaches one)
  const now=performance.now(),dbl=lastClick&&lastClick.i===i&&now-lastClick.t<450&&!d.mods.shift&&!d.mods.mod;lastClick=dbl?null:{i,t:now};
  if(dbl){editEntry(i);return;}
  if(d.mods.shift||d.mods.mod){if(d.mods.shift&&palSel.size){const last=[...palSel].pop(),[lo,hi]=last<i?[last,i]:[i,last];for(let k=lo;k<=hi;k++)palSel.add(k);}else palSel.has(i)?palSel.delete(i):palSel.add(i);W.S.rampSel=[...palSel].sort((a,b)=>a-b);if(W.S.rampSel.length<2)W.S.rampSel=[];}
  else{palSel=new Set([i]);W.S.rampSel=[];}
  W.setColor('fg',PD.isIndexed(asset())&&i===PD.transparentIndexOf(asset())?[0,0,0,0]:c,{index:i});document.querySelector('.px-bar')?.sync?.();});
 /** Writes a new palette. In an indexed sprite every cel is rewritten (indices remapped by `map`,
  * PLTE replaced) so other workspaces and exports see the new colours: one undo step. */
 async function applyPalette(colors,{map=null,transparentIndex,label}){
  const a=asset();if(!a)return;
  const ti=transparentIndex===undefined?PD.transparentIndexOf(a):transparentIndex;
  if(!PD.isIndexed(a)){W.exec(label,d=>PD.setPalette(d,a.id,{colors},{transparentIndex:a.transparentIndex}));imageColors=null;return;}
  if(colors.length>256){ctx.toast(t('px.pal.tooMany'),{error:true});return;}
  await W.commitChain();const cels=[];
  for(const c of a.cels){const ind=await celIndices(a,c),next=map?I.remap(ind.indices,map):ind.indices;
   const png=encodeIndexedPNG(next,ind.w,ind.h,colors,{transparentIndex:ti}),rec=await images.put(new Blob([png],{type:'image/png'}),{width:ind.w,height:ind.h});
   indexCache.set(rec.id,{indices:next,colors:colors.map(q=>[q[0],q[1],q[2],q[3]??255]),width:ind.w,height:ind.h});cels.push({...c,blob:rec.id});}
  W.exec(label,d=>PD.setCels(PD.setPalette(d,a.id,{colors},{transparentIndex:ti}),a.id,cels));
 }
 /** Indices of a cel of an indexed sprite (its PNG's own indices when it carries the sprite palette). */
 async function celIndices(a,cel){
  const hit=indexCache.get(cel.blob);if(hit)return {indices:hit.indices,w:hit.width,h:hit.height};
  const rec=images.get(cel.blob),bytes=new Uint8Array(await rec.blob.arrayBuffer());let d=null;try{d=decodeIndexedPNG(bytes);}catch{}
  if(d&&d.colors.length===a.palette.colors.length)return {indices:d.indices,w:d.width,h:d.height};
  const img=await blobRGBA(images,cel.blob);return {indices:I.indicesFromRGBA(img.data,img.width,img.height,a.palette.colors,{transparentIndex:PD.transparentIndexOf(a)}).indices,w:img.width,h:img.height};
 }
 W.applyPalette=applyPalette;W.celIndices=celIndices;
 function ensurePalette(){const a=asset();return a?.palette?.colors?.length?a.palette.colors:currentColors();}
 function addFg(){const cols=[...ensurePalette()];if(cols.length>=256){ctx.toast(t('px.pal.tooMany'),{error:true});return;}cols.push([...prefs.fg]);applyPalette(cols,{label:t('px.cmd.palAdd')});}
 function removeSelected(){
  const a=asset();if(!a)return;const cols=ensurePalette(),rm=[...palSel].filter(i=>i<cols.length);if(!rm.length){ctx.toast(t('px.pal.pickFirst'),{error:true});return;}
  if(PD.isIndexed(a)){const r=I.removePaletteEntries(cols,rm,{transparentIndex:PD.transparentIndexOf(a)});palSel.clear();applyPalette(r.colors,{map:r.map,transparentIndex:r.transparentIndex,label:t('px.cmd.palRemove',{n:rm.length})});}
  else{palSel.clear();applyPalette(cols.filter((_,i)=>!rm.includes(i)),{label:t('px.cmd.palRemove',{n:rm.length})});}
 }
 function moveEntries(from,toIndex){
  const a=asset(),cols=ensurePalette();const rest=cols.map((_,i)=>i).filter(i=>!from.includes(i)),to=rest.filter(i=>i<toIndex).length;
  const r=I.movePaletteEntries(cols,from,to,{transparentIndex:PD.transparentIndexOf(a)});palSel=new Set(from.map(i=>r.map[i]));
  applyPalette(r.colors,{map:PD.isIndexed(a)?r.map:null,transparentIndex:PD.isIndexed(a)?r.transparentIndex:undefined,label:t('px.cmd.palMove')});
 }
 function sortMenu(anchor){
  const r=anchor.getBoundingClientRect(),run=mode=>{const a=asset(),cols=ensurePalette();const counts=mode==='usage'?usage():null;const s=I.sortPaletteEntries(cols,mode,{transparentIndex:PD.isIndexed(a)?PD.transparentIndexOf(a):-1,counts});applyPalette(s.colors,{map:PD.isIndexed(a)?s.map:null,transparentIndex:PD.isIndexed(a)?s.transparentIndex:undefined,label:t('px.cmd.palSort')});};
  ctx.menus.openAt(['luminance','hue','saturation','usage'].map(m=>({label:t('px.sort.'+m),run:()=>run(m)})),r.left,r.bottom,{owner:anchor});
 }
 function usage(){const a=asset();if(!PD.isIndexed(a))return null;const c=new Array(a.palette.colors.length).fill(0);for(const l of session.layers)for(const v of l.plane.data)c[v]++;return c;}
 function palMenu(anchor){
  const r=anchor.getBoundingClientRect();
  const items=[{label:t('px.pal.import'),run:()=>importPalette()},...Object.keys(PIO.PALETTE_WRITERS).map(f=>({label:t('px.pal.export',{fmt:'.'+f}),run:()=>exportPalette(f)})),{sep:true},
   {label:t('px.cmd.lospec'),run:()=>lospec()},{label:t('px.cmd.ramp'),run:()=>rampDialog()},{label:t('px.cmd.variants'),run:()=>variantsDialog()},{label:t('px.pal.fromImageCmd'),run:()=>paletteFromImage()},{sep:true},
   {label:t('px.pal.setTransparent'),run:()=>setTransparent()},{label:t('px.cmd.colorMode'),run:()=>colorModeDialog()}];
  ctx.menus.openAt(items,r.left,r.bottom,{owner:anchor});
 }
 async function paletteFromImage(){await deriveImageColors();const a=asset(),cols=imageColors||[];if(!cols.length)return;if(cols.length>=256){ctx.toast(t('px.pal.tooMany'),{error:true});return;}
  const base=PD.isIndexed(a)?null:cols;if(base)applyPalette(base,{label:t('px.cmd.palFromImage')});else ctx.toast(t('px.pal.indexedFromImage'));}
 function setTransparent(){const a=asset();if(!PD.isIndexed(a)){ctx.toast(t('px.pal.onlyIndexed'),{error:true});return;}const i=[...palSel][0];if(i==null){ctx.toast(t('px.pal.pickFirst'),{error:true});return;}
  // the picture keeps its look: pixels of the old transparent index become the new one, and vice versa
  const n=a.palette.colors.length,map=Array.from({length:n},(_,k)=>k),old=PD.transparentIndexOf(a);map[old]=i;map[i]=old;
  const cols=a.palette.colors.map((c,k)=>k===i?a.palette.colors[old]:k===old?a.palette.colors[i]:c);applyPalette(cols,{map,transparentIndex:i,label:t('px.cmd.palTransparent',{i})});}
 function editEntry(i){
  const a=asset(),cols=ensurePalette(),c=cols[i];if(!c)return;
  const input=h('input.st-input',{type:'text',value:hexOf(c),'aria-label':t('px.color.hex'),'data-px':'edit-hex'}),native=h('input',{type:'color',value:hexOf(c).slice(0,7),'aria-label':t('px.color.pick')});
  native.addEventListener('input',()=>{input.value=native.value;});
  const m=modal(document.querySelector('.studio'),{title:t('px.pal.editTitle',{i}),body:h('div.px-dlg',{},h('label.st-field',{},h('span',{},t('px.color.hex')),input),native,PD.isIndexed(a)?h('p.st-muted',{},t('px.pal.editIndexed')):h('p.st-muted',{},t('px.pal.editRgb'))),buttons:[{label:t('confirm.cancel'),value:null},{label:t('confirm.ok'),value:'ok',primary:true}]});
  m.done.then(v=>{if(v!=='ok')return;const nc=I.parseHex(input.value);if(!nc)return;const next=cols.map((q,k)=>k===i?nc:q);applyPalette(next,{label:t('px.cmd.palEdit',{i})});});
 }
 function importPalette(){
  const inp=h('input',{type:'file',accept:'.gpl,.pal,.hex,.ase,.aseprite,.act,.json,.txt',hidden:true});document.body.append(inp);
  inp.addEventListener('change',async()=>{const f=inp.files[0];inp.remove();if(!f)return;try{const p=PIO.readPalette(new Uint8Array(await f.arrayBuffer()),f.name);await useLoadedPalette(p,f.name);}catch(e){ctx.toast(t('px.pal.importFailed',{reason:e.message}),{error:true});}});
  inp.click();
 }
 /** A palette from a file or Lospec: replace (indexed: pixels move to the nearest new colour) or append. */
 async function useLoadedPalette(p,name,{mode=null}={}){
  const a=asset();if(!a)return;
  const how=mode||await modal(document.querySelector('.studio'),{title:t('px.pal.loadedTitle',{name,n:p.colors.length}),body:h('div.px-dlg',{},swatchRow(p.colors),h('p.st-muted',{},t(PD.isIndexed(a)?'px.pal.replaceIndexed':'px.pal.replaceRgb'))),
   buttons:[{label:t('confirm.cancel'),value:null},{label:t('px.pal.append'),value:'append'},{label:t('px.pal.replace'),value:'replace',primary:true}]}).done;
  if(!how)return;
  const cur=ensurePalette();
  if(how==='append'){const next=[...cur,...p.colors].slice(0,256);applyPalette(next,{label:t('px.cmd.palImport',{name})});return;}
  if(PD.isIndexed(a)){// indices remapped to the nearest colour of the new palette (the transparent entry stays 0)
   const ti=PD.transparentIndexOf(a),next=[[0,0,0,0],...p.colors].slice(0,256),m=I.matcher(next,{exclude:0}),map=cur.map((c,i)=>i===ti?0:m.nearest(c[0],c[1],c[2],c[3]??255));
   applyPalette(next,{map,transparentIndex:0,label:t('px.cmd.palImport',{name})});
  }else applyPalette(p.colors,{label:t('px.cmd.palImport',{name})});
 }
 const swatchRow=cols=>h('div.px-pal-grid.px-pal-preview',{},...cols.map(c=>h('span.px-pal-sw',{style:`--c:rgba(${c[0]},${c[1]},${c[2]},${(c[3]??255)/255})`,title:hexOf(c)})));
 function exportPalette(fmt){
  const a=asset(),cols=ensurePalette();if(!cols.length)return;const spec=PIO.PALETTE_WRITERS[fmt],name=String(a?.name||'palette').replace(/\.[^.]+$/,'');
  const data=spec.write(cols,{name}),blob=new Blob([data],{type:spec.type}),link=h('a',{href:URL.createObjectURL(blob),download:`${name}.${spec.ext}`});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),30000);
  ctx.toast(t('px.pal.exported',{name:`${name}.${spec.ext}`,n:cols.length}));
 }
 // ------------------------------------------------------------------ Lospec (the only network request; asks first)
 async function lospec(){
  const host=document.querySelector('.studio');
  if(!storage.get(CONSENT,false)){
   const remember=h('input',{type:'checkbox','data-px':'lospec-remember'});
   const ok=await modal(host,{title:t('px.lospec.consentTitle'),body:h('div.px-dlg',{},h('p',{},t('px.lospec.consent')),h('p.st-muted',{},t('px.lospec.consentDetail')),h('label.st-check',{},remember,t('px.lospec.remember'))),
    buttons:[{label:t('confirm.cancel'),value:false},{label:t('px.lospec.allow'),value:true,primary:true}],className:'px-lospec-consent'}).done;
   if(!ok)return;if(remember.checked)storage.set(CONSENT,true);
  }
  const input=h('input.st-input',{type:'search',list:'px-lospec-list',placeholder:'pico-8',autofocus:true,'aria-label':t('px.lospec.name'),'data-px':'lospec-name'});
  const list=h('datalist#px-lospec-list',{},...PIO.LOSPEC_POPULAR.map(s=>h('option',{value:s})));
  const out=h('div.px-lospec-out',{'data-px':'lospec-out'}),go=h('button.st-btn',{type:'button','data-px':'lospec-go'},t('px.lospec.fetch'));
  let found=null;
  const fetchIt=async()=>{const slug=PIO.lospecSlug(input.value);if(!slug)return;out.replaceChildren(h('p.st-muted',{},t('px.lospec.loading',{url:PIO.lospecURL(slug)})));
   try{const r=await fetch(PIO.lospecURL(slug),{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error(r.status===404?t('px.lospec.notFound',{slug}):'HTTP '+r.status);
    const p=PIO.parsePaletteJSON(await r.text());found={...p,slug};out.replaceChildren(h('p',{},h('b',{},p.name||slug),p.author?` · ${p.author}`:'',` · ${t('px.lospec.count',{n:p.colors.length})}`),swatchRow(p.colors));}
   catch(e){found=null;out.replaceChildren(h('p.st-error',{},t('px.lospec.failed',{reason:e.message})));}};
  go.addEventListener('click',fetchIt);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();fetchIt();}});
  const m=modal(host,{title:t('px.lospec.title'),body:h('div.px-dlg',{},h('p.st-muted.px-net',{},t('px.lospec.network')),h('div.px-lospec-row',{},input,list,go),out),buttons:[{label:t('confirm.close'),value:null},{label:t('px.pal.append'),value:'append'},{label:t('px.pal.replace'),value:'replace',primary:true}],className:'px-lospec'});
  const v=await m.done;if(v&&found)await useLoadedPalette(found,found.name||found.slug,{mode:v});
 }
 // ------------------------------------------------------------------ ramps, variants
 async function rampDialog(){
  const host=document.querySelector('.studio'),base=[...prefs.fg];
  const o={steps:5,shift:24,darkest:18,lightest:94};let ramp=hueShiftRamp(base,{steps:o.steps,shift:o.shift,darkest:o.darkest/100,lightest:o.lightest/100}).colors;
  const prev=h('div',{'data-px':'ramp-preview'},swatchRow(ramp));const upd=()=>{ramp=hueShiftRamp(base,{steps:o.steps,shift:o.shift,darkest:o.darkest/100,lightest:o.lightest/100}).colors;prev.replaceChildren(swatchRow(ramp));};
  const f=(k,label,min,max)=>h('label.st-field.st-field-inline',{},h('span',{},label),num(label,o[k],min,max,v=>{o[k]=v;upd();},'ramp-'+k));
  const v=await modal(host,{title:t('px.ramp.title'),body:h('div.px-dlg',{},h('p.st-muted',{},t('px.ramp.help',{hex:hexOf(base)})),f('steps',t('px.ramp.steps'),2,16),f('shift',t('px.ramp.shift'),0,90),f('darkest',t('px.ramp.darkest'),0,95),f('lightest',t('px.ramp.lightest'),5,100),prev),
   buttons:[{label:t('confirm.cancel'),value:null},{label:t('px.ramp.add'),value:'add',primary:true}]}).done;
  if(v!=='add')return;const cols=[...ensurePalette()],start=cols.length;const next=[...cols,...ramp].slice(0,256);
  await applyPalette(next,{label:t('px.cmd.ramp')});W.S.rampSel=ramp.map((_,i)=>start+i).filter(i=>i<256);palSel=new Set(W.S.rampSel);renderPalette();
 }
 /** Team-colour variants: the selected ramp mapped onto a ramp of each chosen base colour (by
  * position, so shading order holds), applied to EVERY frame and layer; each variant becomes a
  * new sprite. Indexed sprites only change their palette (the indices are the same pixels). */
 async function variantsDialog(){
  const a=asset();if(!a)return;const cols=ensurePalette(),src=W.S.rampSel.length?W.S.rampSel:[...palSel];
  if(!src.length){ctx.toast(t('px.var.pickRamp'),{error:true});return;}
  const host=document.querySelector('.studio'),checks=Object.entries(TEAM_COLORS).map(([name,c])=>{const i=h('input',{type:'checkbox',checked:['red','blue','green'].includes(name)||null,'data-team':name});return {name,c,i,el:h('label.st-check',{},i,h('span.px-team',{style:`--c:rgb(${c.join(',')})`}),t('px.team.'+name))};});
  const v=await modal(host,{title:t('px.var.title'),body:h('div.px-dlg',{},h('p.st-muted',{},t('px.var.help',{n:src.length})),swatchRow(src.map(i=>cols[i])),h('div.px-teams',{},...checks.map(c=>c.el))),buttons:[{label:t('confirm.cancel'),value:null},{label:t('px.var.make'),value:'ok',primary:true}]}).done;
  if(v!=='ok')return;const picked=checks.filter(c=>c.i.checked);if(!picked.length)return;
  await W.commitChain();
  const made=[];
  for(const team of picked){
   const target=hueShiftTarget(team.c,src.length),next=rampMap(cols.map(c=>c.slice(0,3)),src,target).map((c,i)=>[c[0],c[1],c[2],cols[i][3]??255]);
   made.push(await variantAsset(a,cols,next,team.name));
  }
  W.exec(t('px.cmd.variants',{n:made.length}),d=>P.addAssets(d,made));ctx.toast(t('px.var.done',{n:made.length,names:picked.map(p=>t('px.team.'+p.name)).join(', ')}));
 }
 const hueShiftTarget=(base,n)=>hueShiftRamp(base,{steps:Math.max(2,n),shift:18}).colors.map(c=>c.slice(0,3));
 async function variantAsset(a,from,to,suffix){
  const id=P.uid('a'),copy={...JSON.parse(JSON.stringify(a)),id,name:`${String(a.name).replace(/\.[^.]+$/,'')}_${suffix}`};
  if(PD.isIndexed(a)){copy.palette={colors:to};const cels=[];for(const c of a.cels){const ind=await celIndices(a,c),png=encodeIndexedPNG(ind.indices,ind.w,ind.h,to,{transparentIndex:PD.transparentIndexOf(a)}),rec=await images.put(new Blob([png],{type:'image/png'}),{width:ind.w,height:ind.h});cels.push({...c,blob:rec.id});}copy.cels=cels;return copy;}
  const swap=new Map();from.forEach((c,i)=>{const k=I.colorKey(c),n=to[i];if(k!==I.colorKey(n))swap.set(k,n);});
  const cels=[];for(const c of a.cels){const img=await blobRGBA(images,c.blob),d=new Uint8Array(img.data);for(let p=0;p<d.length;p+=4){if(!d[p+3])continue;const n=swap.get(I.keyOf(d[p],d[p+1],d[p+2],d[p+3]));if(n){d[p]=n[0];d[p+1]=n[1];d[p+2]=n[2];}}
   cels.push({...c,blob:await storeRGBA(images,{width:img.width,height:img.height,data:d})});}
  copy.cels=cels;if(copy.palette)copy.palette={colors:to};return copy;
 }
 // ------------------------------------------------------------------ Layers
 const layers=h('div.px-layers',{role:'listbox','aria-label':t('px.panel.layers'),'data-px':'layers'});
 function layerActions(actions){actions.append(btn('plus',t('px.cmd.newLayer')+' (Shift+N)',()=>layerOp('new'),{id:'layer-new'}),btn('pxCopy',t('px.cmd.duplicateLayer'),()=>layerOp('duplicate'),{id:'layer-dup'}),btn('pxMerge',t('px.cmd.mergeDown')+' (Ctrl+E)',()=>layerOp('merge'),{id:'layer-merge'}),btn('trash',t('px.cmd.deleteLayer'),()=>layerOp('delete'),{id:'layer-delete'}));}
 function renderLayers(){
  const a=asset();if(!a){layers.replaceChildren();return;}
  const rows=[...a.layers].reverse().map((l,ri)=>{
   const i=a.layers.length-1-ri,cur=l.id===W.layerId();
   const eye=btn(l.visible?'eye':'eye',t(l.visible?'sp.tl.hideLayer':'sp.tl.showLayer',{name:l.name}),e=>{e.stopPropagation();W.exec(t('sp.cmd.layerVisible'),d=>PD.setLayer(d,a.id,l.id,{visible:!l.visible}));},{id:'eye',cls:l.visible?'':'.is-off'});
   const lock=btn(l.locked?'pxLock':'pxUnlock',t(l.locked?'px.layer.unlock':'px.layer.lock',{name:l.name}),e=>{e.stopPropagation();W.exec(t(l.locked?'px.cmd.unlockLayer':'px.cmd.lockLayer'),d=>PD.setLayer(d,a.id,l.id,{locked:!l.locked}));},{id:'lock',cls:l.locked?'.is-on':''});
   const name=h('span.px-layer-name',{title:l.name},l.name);
   name.addEventListener('dblclick',async()=>{const v=await promptName(t('px.layer.rename'),l.name);if(v)W.exec(t('sp.cmd.renameLayer'),d=>PD.setLayer(d,a.id,l.id,{name:v}));});
   const row=h('div.px-layer'+(cur?'.is-cur':''),{role:'option','aria-selected':String(cur),tabindex:cur?'0':'-1','data-layer':l.id,'data-index':String(i)},eye,lock,name,h('small.st-muted',{},l.blend!=='normal'?t('px.blend.'+l.blend):''),h('small.st-muted',{},l.opacity<255?Math.round(l.opacity/2.55)+'%':''));
   row.addEventListener('click',()=>W.setLayer(l.id));
   row.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();const n=a.layers[i+(e.key==='ArrowUp'?1:-1)];if(n){W.setLayer(n.id);layers.querySelector(`[data-layer="${n.id}"]`)?.focus();}}});
   return row;
  });
  const l=a.layers.find(x=>x.id===W.layerId());
  const props=l?h('div.px-layer-props',{'data-px':'layer-props'},
   h('label.px-f.px-f-full',{},h('span',{},t('px.layer.opacity')),h('input.px-range',{type:'range',min:'0',max:'255',value:String(l.opacity),'data-px':'layer-opacity','aria-label':t('px.layer.opacity'),onchange:e=>W.exec(t('px.cmd.layerOpacity'),d=>PD.setLayer(d,a.id,l.id,{opacity:Number(e.target.value)}))})),
   h('label.px-f.px-f-full',{},h('span',{},t('px.layer.blend')),sel(t('px.layer.blend'),l.blend,BLEND_MODES.map(b=>[b,t('px.blend.'+b)]),v=>W.exec(t('px.cmd.layerBlend'),d=>PD.setLayer(d,a.id,l.id,{blend:v})),'layer-blend')),
   h('div.st-row',{},h('button.st-btn',{type:'button','data-px':'layer-up',onclick:()=>layerOp('up')},t('px.layer.up')),h('button.st-btn',{type:'button','data-px':'layer-down',onclick:()=>layerOp('down')},t('px.layer.down')))):'';
  layers.replaceChildren(...rows,props);ctx.badge('px-layers');
 }
 async function promptName(title,value){const i=h('input.st-input',{type:'text',value,autofocus:true,maxlength:'120'});const m=modal(document.querySelector('.studio'),{title,body:i,buttons:[{label:t('confirm.cancel'),value:null},{label:t('confirm.ok'),value:'ok',primary:true}]});i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();m.close('ok');}});setTimeout(()=>i.select(),0);return (await m.done)==='ok'?i.value.trim():null;}
 async function layerOp(op){
  const a=asset();if(!a)return;const id=W.layerId(),i=a.layers.findIndex(l=>l.id===id);
  await W.commitChain();
  if(op==='new'){let made;W.exec(t('px.cmd.newLayer'),d=>{const r=PD.addLayer(d,a.id,{aboveId:id,name:PD.layerName(a,t('px.layer.defaultName',{n:'{n}'}))});made=r.id;return r.doc;});W.setLayer(made);return;}
  if(op==='duplicate'){let made;W.exec(t('px.cmd.duplicateLayer'),d=>{const r=PD.duplicateLayer(d,a.id,id);made=r.id;return r.doc;});if(made)W.setLayer(made);return;}
  if(op==='delete'){if(a.layers.length<=1){ctx.toast(t('px.layer.last'),{error:true});return;}const blob=await W.emptyBlob();const name=a.layers[i].name;W.exec(t('px.cmd.deleteLayer'),d=>PD.removeLayer(d,a.id,id,{emptyBlob:blob}));W.setLayer(asset().layers[Math.max(0,i-1)].id);ctx.toast(t('px.layer.deleted',{name,undo:ctx.shortcutOf('edit.undo')}));return;}
  if(op==='up'||op==='down'){W.exec(t('px.cmd.moveLayer'),d=>PD.moveLayer(d,a.id,id,i+(op==='up'?1:-1)));return;}
  if(op==='merge'){if(i<=0){ctx.toast(t('px.layer.noBelow'),{error:true});return;}await mergeDown(a,id);}
 }
 /** Aseprite's Merge Down: the upper layer is drawn onto the lower one with its opacity and blend
  * mode, moment by moment (the shared picture and every frame where either has its own cel). */
 async function mergeDown(a,id){
  const plan=PD.mergeDownPlan(a,id);if(!plan)return;const {upper,lower}=plan,cels=[];
  for(const m of plan.moments){
   const parts=[m.below,m.above].filter(Boolean),x0=Math.min(...parts.map(c=>c.x)),y0=Math.min(...parts.map(c=>c.y));
   const imgs=await Promise.all(parts.map(c=>blobRGBA(images,c.blob))),x1=Math.max(...parts.map((c,k)=>c.x+imgs[k].width)),y1=Math.max(...parts.map((c,k)=>c.y+imgs[k].height));
   const w=x1-x0,hh=y1-y0,out=new Uint8Array(w*hh*4);
   const put=(cel,img,opacity,mode)=>{for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const s=(y*img.width+x)*4,d=((cel.y-y0+y)*w+cel.x-x0+x)*4,al=img.data[s+3];if(!al)continue;
    if(mode===0&&opacity===255&&(al===255||!out[d+3])){out.set(img.data.subarray(s,s+4),d);continue;}blendRGBA(out,d,img.data[s],img.data[s+1],img.data[s+2],al,opacity,mode);}};
   if(m.below)put(m.below,imgs[0],255,0);
   if(m.above)put(m.above,imgs[m.below?1:0],mul8(m.above.opacity??255,upper.opacity??255),blendIndex(upper.blend));
   cels.push(await W.celFromRGBA(a,lower.id,m.frameId,out,{x:x0,y:y0,w,h:hh},m.below?.opacity??255));
  }
  W.exec(t('px.cmd.mergeDown'),d=>PD.applyMergeDown(d,a.id,id,cels));W.setLayer(lower.id);
 }
 // ------------------------------------------------------------------ Audit
 const audit=h('div.px-audit',{'data-px':'audit'});
 let auditResult=null,budget=16;
 function renderAudit(){
  const a=asset();if(!a){audit.replaceChildren(h('p.st-muted.st-pad',{},t('px.hint.noSprite')));return;}
  const run=h('button.st-btn',{type:'button','data-px':'audit-run'},t('px.audit.run'));run.addEventListener('click',()=>runAudit());
  const head=h('div.st-sec',{},h('div.st-sec-head',{},h('span',{},t('px.audit.title')),run),h('label.st-field.st-field-inline',{},h('span',{},t('px.audit.budget')),num(t('px.audit.budget'),budget,0,256,v=>{budget=v;},'audit-budget')),
   h('p.st-muted',{},a.palette?.colors?.length?t('px.audit.against',{n:a.palette.colors.length}):t('px.audit.noPalette')));
  if(!auditResult){audit.replaceChildren(head);return;}
  const r=auditResult,list=h('div.px-audit-list',{'data-px':'audit-list'},...r.frames.map((f,i)=>{const row=h('button.px-audit-row'+(f.stray.length||f.over?'.is-bad':''),{type:'button','data-frame':String(i)},h('b',{},String(i+1)),h('span',{},t('px.audit.colors',{n:f.distinct})),f.over?h('span.px-bad',{},t('px.audit.over',{n:f.over})):'',f.stray.length?h('span.px-bad',{},t('px.audit.stray',{n:f.stray.length,px:f.strayPixels})):h('span.st-muted',{},'✓'));row.addEventListener('click',()=>{if(asset().frames.length)W.setCurrent(i,{select:true});});return row;}));
  const sum=h('p',{'data-px':'audit-summary'},t('px.audit.summary',{frames:r.frames.length,union:r.union,over:r.over,stray:r.strayFrames}));
  const near=r.nearDuplicates.length?h('p.st-muted',{},t('px.audit.near',{n:r.nearDuplicates.length,ex:r.nearDuplicates.slice(0,3).map(([x,y])=>hexOf(x)+'≈'+hexOf(y)).join(', ')})):'';
  const selStray=h('button.st-btn',{type:'button','data-px':'audit-select'},t('px.audit.select'));selStray.addEventListener('click',()=>selectStrays());
  const fix=h('button.st-btn',{type:'button','data-px':'audit-fix'},t('px.audit.fix'));fix.addEventListener('click',()=>fixStrays());
  audit.replaceChildren(head,h('div.st-sec',{},sum,near,list,h('div.st-row',{},selStray,fix)));
 }
 async function runAudit(){
  const a=asset();if(!a)return;await W.commitChain();
  const frames=a.frames.length?a.frames:[P.frameForRect(a,{x:0,y:0,w:a.width,h:a.height},{id:'*',index:0})];
  const rgbaOf=await rgbaGetter(images,a,frames.map(f=>f.id==='*'?{...f,id:'*'}:f)),imgs=frames.map((f,i)=>{const img=composeFrame(a,f,rgbaOf);return {id:f.id,name:f.name||String(i+1),...img};});
  auditResult=auditFrames(imgs,a.palette?.colors||[],{budget,transparentIndex:PD.transparentIndexOf(a)});renderAudit();
 }
 function selectStrays(){const a=asset();if(!a?.palette?.colors?.length){ctx.toast(t('px.audit.noPalette'),{error:true});return;}const d=session.compose(null,{onion:false}),{mask,count}=strayMask({data:d,width:session.rect.w,height:session.rect.h},a.palette.colors,{transparentIndex:PD.transparentIndexOf(a)});
  if(!count){ctx.toast(t('px.audit.clean'));return;}W.setSelection(mask);ctx.toast(t('px.audit.selected',{n:count}));}
 /** Every layer of every frame: colours not in the palette move to the nearest palette colour (one step). */
 async function fixStrays(){
  const a=asset();if(!a?.palette?.colors?.length){ctx.toast(t('px.audit.noPalette'),{error:true});return;}await W.commitChain();
  const ti=PD.transparentIndexOf(a),pal=a.palette.colors.filter((_,i)=>i!==ti),m=I.matcher(pal),keys=new Set(pal.map(I.colorKey)),cels=[];let fixed=0;
  if(PD.isIndexed(a)){ctx.toast(t('px.audit.indexedClean'));return;}
  for(const c of a.cels){const img=await blobRGBA(images,c.blob),d=new Uint8Array(img.data);let n=0;for(let p=0;p<d.length;p+=4){if(!d[p+3])continue;const k=I.keyOf(d[p],d[p+1],d[p+2],d[p+3]);if(keys.has(k))continue;const q=pal[m.nearest(d[p],d[p+1],d[p+2],d[p+3])];d[p]=q[0];d[p+1]=q[1];d[p+2]=q[2];d[p+3]=q[3]??255;n++;}
   if(n){fixed+=n;cels.push({...c,blob:await storeRGBA(images,{width:img.width,height:img.height,data:d})});}}
  if(!cels.length){ctx.toast(t('px.audit.clean'));return;}
  W.exec(t('px.cmd.fixStrays',{n:fixed}),d=>PD.setCels(d,a.id,cels));ctx.toast(t('px.audit.fixed',{n:fixed}));await runAudit();
 }
 // ------------------------------------------------------------------ New sprite + colour mode
 async function newSprite(){
  const host=document.querySelector('.studio'),w=num(t('px.new.width'),32,1,4096,()=>{},'new-w'),hh=num(t('px.new.height'),32,1,4096,()=>{},'new-h');
  const mode=sel(t('px.new.mode'),'rgb',[['rgb',t('px.mode.rgb')],['indexed',t('px.mode.indexed')]],()=>{},'new-mode'),name=h('input.st-input',{type:'text',value:'sprite','data-px':'new-name','aria-label':t('px.new.name')});
  const v=await modal(host,{title:t('px.new.title'),body:h('div.px-dlg',{},h('label.st-field',{},h('span',{},t('px.new.name')),name),h('div.px-dlg-row',{},h('label.st-field',{},h('span',{},t('px.new.width')),w),h('label.st-field',{},h('span',{},t('px.new.height')),hh)),h('label.st-field',{},h('span',{},t('px.new.mode')),mode),h('p.st-muted',{},t('px.new.palette'))),
   buttons:[{label:t('confirm.cancel'),value:null},{label:t('px.new.create'),value:'ok',primary:true}],className:'px-new'}).done;
  if(v!=='ok')return;
  const W0=Number(w.value)||32,H0=Number(hh.value)||32,indexed=mode.value==='indexed';
  let blob;const pal=[[0,0,0,0],...I.DB32];
  if(indexed){const png=encodeIndexedPNG(new Uint8Array(W0*H0),W0,H0,pal,{transparentIndex:0});blob=(await images.put(new Blob([png],{type:'image/png'}),{width:W0,height:H0})).id;}
  else blob=await storeRGBA(images,{width:W0,height:H0,data:new Uint8Array(W0*H0*4)});
  const a=PD.newSprite({name:name.value.trim()||'sprite',width:W0,height:H0,blob,palette:indexed?pal:I.DB32,colorMode:indexed?'indexed':'rgb',transparentIndex:0,layer:t('px.layer.defaultName',{n:1})});
  W.exec(t('px.cmd.newSprite'),d=>P.addAssets(d,[a]));await ctx.showAsset(a.id);ctx.setTool('px-pencil');
 }
 /** Sprite › Canvas Size (Aseprite): pixels added (or removed, negative) on each side; nothing is scaled. */
 async function canvasSizeDialog(){
  const a=asset();if(!a)return;await W.commitChain();const host=document.querySelector('.studio');
  const v={left:1,top:1,right:1,bottom:1},size=h('p.st-muted',{'data-px':'canvas-result'});
  const upd=()=>{size.textContent=t('px.canvas.result',{w:a.width+v.left+v.right,h:a.height+v.top+v.bottom});};
  const f=k=>h('label.st-field',{},h('span',{},t('px.canvas.'+k)),num(t('px.canvas.'+k),v[k],-4096,4096,x=>{v[k]=x;upd();},'canvas-'+k));
  for(const k of Object.keys(v))v[k]=1;upd();
  const ok=await modal(host,{title:t('px.cmd.canvasSize'),body:h('div.px-dlg',{},h('p.st-muted',{},t('px.canvas.help',{w:a.width,h:a.height})),h('div.px-dlg-row',{},f('left'),f('right')),h('div.px-dlg-row',{},f('top'),f('bottom')),size),
   buttons:[{label:t('confirm.cancel'),value:null},{label:t('confirm.ok'),value:'ok',primary:true}],className:'px-canvas'}).done;
  if(ok!=='ok')return;
  try{W.exec(t('px.canvas.step',{w:a.width+v.left+v.right,h:a.height+v.top+v.bottom}),d=>PD.canvasSize(d,a.id,v));ctx.toast(t('px.canvas.done',{w:asset().width,h:asset().height}));}catch(e){ctx.toast(e.message,{error:true});}
 }
 async function colorModeDialog(){
  const a=asset();if(!a)return;const host=document.querySelector('.studio'),idx=PD.isIndexed(a);
  if(idx){const ok=await modal(host,{title:t('px.mode.toRgbTitle'),body:h('p',{},t('px.mode.toRgb')),buttons:[{label:t('confirm.cancel'),value:false},{label:t('px.mode.convert'),value:true,primary:true}]}).done;
   if(ok)W.exec(t('px.cmd.toRgb'),d=>PD.setColorMode(d,a.id,'rgb'));return;}
  await W.commitChain();
  const rgbaOf=await rgbaGetter(images,a,a.frames.length?a.frames:[]),allImgs=await Promise.all(a.cels.map(c=>blobRGBA(images,c.blob)));void rgbaOf;
  const exact=I.exactPalette(allImgs.map(i=>({data:i.data})));
  const src=sel(t('px.mode.palette'),exact?'exact':'current',[...(exact?[['exact',t('px.mode.exact',{n:exact.colors.length-1})]]:[]),...(a.palette?.colors?.length?[['current',t('px.mode.current',{n:a.palette.colors.length})]]:[]),['db32',t('px.mode.db32')]],()=>{},'mode-palette');
  const dither=sel(t('px.mode.dither'),'none',[['none',t('px.dither.none')],['bayer2','Bayer 2×2'],['bayer4','Bayer 4×4'],['bayer8','Bayer 8×8']],()=>{},'mode-dither');
  const v=await modal(host,{title:t('px.mode.toIndexedTitle'),body:h('div.px-dlg',{},h('p.st-muted',{},t('px.mode.toIndexed')),h('label.st-field',{},h('span',{},t('px.mode.palette')),src),h('label.st-field',{},h('span',{},t('px.mode.dither')),dither),h('p.st-muted',{},t('px.mode.ditherNote'))),
   buttons:[{label:t('confirm.cancel'),value:null},{label:t('px.mode.convert'),value:'ok',primary:true}],className:'px-mode'}).done;
  if(v!=='ok')return;
  let pal;if(src.value==='exact')pal=exact.colors;else if(src.value==='current')pal=a.palette.colors.some(c=>(c[3]??255)===0)?a.palette.colors:[[0,0,0,0],...a.palette.colors].slice(0,256);else pal=[[0,0,0,0],...I.DB32];
  const ti=pal.findIndex(c=>(c[3]??255)===0);const T=ti<0?0:ti;const cels=[];let off=0;
  for(let k=0;k<a.cels.length;k++){const c=a.cels[k],img=allImgs[k],r=I.indicesFromRGBA(img.data,img.width,img.height,pal,{transparentIndex:T,dither:dither.value==='none'?null:{pattern:dither.value}});off+=r.offPalette;
   const png=encodeIndexedPNG(r.indices,img.width,img.height,pal,{transparentIndex:T}),rec=await images.put(new Blob([png],{type:'image/png'}),{width:img.width,height:img.height});indexCache.set(rec.id,{indices:r.indices,colors:pal.map(q=>[q[0],q[1],q[2],q[3]??255]),width:img.width,height:img.height});cels.push({...c,blob:rec.id});}
  W.exec(t('px.cmd.toIndexed'),d=>PD.setColorMode(d,a.id,'indexed',{palette:{colors:pal},transparentIndex:T,cels}));
  ctx.toast(off?t('px.mode.convertedNearest',{n:off,colors:pal.length}):t('px.mode.converted',{colors:pal.length}));
 }
 function renderAll(){imageColors=null;renderColor();renderPalette();renderLayers();renderAudit();ctx.badge('px-palette');}
 return {contextBar,color,palette,layers,audit,paletteActions,layerActions,layerOp,renderColor,renderPalette,renderLayers,renderAudit,renderAll,runAudit,newSprite,colorModeDialog,canvasSizeDialog,lospec,rampDialog,variantsDialog,applyPalette,useLoadedPalette};
}
// ------------------------------------------------------------------ HSV helpers
function rgbToHsv(c){const r=c[0]/255,g=c[1]/255,b=c[2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let hh=0;if(d){if(mx===r)hh=((g-b)/d)%6;else if(mx===g)hh=(b-r)/d+2;else hh=(r-g)/d+4;hh*=60;if(hh<0)hh+=360;}return [hh,mx?d/mx:0,mx];}
function hsvToRgb(hh,s,v){const c=v*s,x=c*(1-Math.abs((hh/60)%2-1)),m=v-c;const [r,g,b]=hh<60?[c,x,0]:hh<120?[x,c,0]:hh<180?[0,c,x]:hh<240?[0,x,c]:hh<300?[x,0,c]:[c,0,x];return [r,g,b].map(q=>Math.round((q+m)*255));}
function drawSV(cv,hue){const x=cv.getContext('2d'),w=cv.width,hh=cv.height;const [r,g,b]=hsvToRgb(hue,1,1);x.fillStyle=`rgb(${r},${g},${b})`;x.fillRect(0,0,w,hh);const wg=x.createLinearGradient(0,0,w,0);wg.addColorStop(0,'#fff');wg.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=wg;x.fillRect(0,0,w,hh);const bg=x.createLinearGradient(0,0,0,hh);bg.addColorStop(0,'rgba(0,0,0,0)');bg.addColorStop(1,'#000');x.fillStyle=bg;x.fillRect(0,0,w,hh);}
