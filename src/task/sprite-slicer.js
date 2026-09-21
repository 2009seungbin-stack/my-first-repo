import * as Im from '../image.js';
import {bytes,stem,zip,gif} from '../core.js';
import {bounds,ANALYSIS_PIXELS} from '../primitives.js';
import {imageComponents} from '../image-components.js';
import {yieldUI} from '../resources.js';
import {borderColor} from '../color-background.js';
import * as F from '../sprite-frames.js';
import {paintFrame,renderFrame,stripSheet,frameBuffers} from '../frame-normalize.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** Sprite sheet slicer: drop a sheet and the frames are already found and drawn over it — no Run
 * button. Auto mode is alpha-connected components (merged when they belong to one sprite); Grid
 * mode is cells with a margin and a gutter, with recommended sizes read off the sheet itself.
 * Every frame is a plain record in `frames` (src/sprite-frames.js): the overlay, the strip, the
 * animation preview and the export all read that one array, so the preview cannot lie. */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const HANDLES=[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]];
const GIF_PIXELS=24_000_000,STRIP_CHIPS=300;
export function mount({el,def}){
 let sheet=null,work=null,workKey=null,sourceName='sprite',frames=[],selected=new Set(),seq=0,history=[],trims=new Map();
 let components=[],suggestions=[],layout=null,anim=null,drag=null,busy=false,generation=0,error='';
 let playing=true,tick=0,raf=0,last=0,timer=0;
 let o={mode:'auto',threshold:8,minArea:16,merge:0,key:'none',keyColor:'#ff00ff',tolerance:40,
  gridBy:'cell',cellW:32,cellH:32,columns:4,rows:1,offsetX:0,offsetY:0,spacingX:0,spacingY:0,skipEmpty:true,
  zoom:'fit',fps:12,trim:false,canvas:'each',anchor:'bottom-center',padding:0,prefix:'',wantGif:false,wantStrip:false};
 const T=(k,v)=>text('slicer.'+k,v);
 const ctxOf=c=>c.getContext('2d',{willReadFrequently:true});
 const anchorOf=()=>F.ANCHORS[o.anchor]||F.ANCHORS['bottom-center'];
 const prefix=()=>(o.prefix.trim()||stem(sourceName)||'sprite').replace(/[^\w.-]+/g,'_')||'sprite';
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="slicer-sample">${esc(text('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 const seg=(id,key,values,label)=>`<div class="segmented" role="group" id="${id}">${values.map(v=>`<button type="button" data-action="slicer-set" data-key="${key}" data-value="${v}" aria-pressed="${String(o[key])===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
 const num=(id,key,min,max,step=1)=>`<label class="field"><span>${esc(T(key))}</span><input id="${id}" data-num="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${o[key]}" inputmode="numeric"></label>`;
 function frame(){
  el.innerHTML=`<div class="work atlas-work slicer-work"><section class="board"><div class="atlas-views"><div class="atlas-view"><div class="view-head"><strong>${esc(T('sheet'))}</strong><span id="slicerInfo"></span>${seg('slicerZoom','zoom',['fit',1,2,4],v=>v==='fit'?T('fit'):v+'×').replace('role="group"',`role="group" aria-label="${esc(T('zoom'))}"`)}</div>
<div class="slicer-stage" id="slicerStage"><div class="slicer-sheet" id="slicerSheet"><canvas id="slicerCanvas" class="px"></canvas><svg id="slicerOverlay" xmlns="http://www.w3.org/2000/svg" tabindex="0" aria-label="${esc(T('sheet'))}"></svg></div></div></div>
<div class="atlas-view anim"><div class="view-head"><strong>${esc(T('animation'))}</strong><button type="button" class="mini-button" data-action="slicer-play" id="slicerPlay" aria-label="${esc(T('animation'))}" title="${esc(T('animation'))}"></button></div><div class="atlas-canvas anim-canvas"><canvas id="slicerAnim" class="px"></canvas></div><label class="field fps"><span>${esc(T('fps'))} <output id="slicerFpsOut">${o.fps}</output></span><input id="slicerFps" type="range" min="1" max="60" value="${o.fps}"></label></div></div>
<div class="view-head frames-head"><strong>${esc(T('frames'))}</strong><span id="slicerCount"></span><button type="button" class="mini-button" data-action="slicer-order">${esc(T('order'))}</button><button type="button" class="mini-button" data-action="slicer-merge" id="slicerMergeButton">${esc(T('mergeSelected'))}</button><button type="button" class="mini-button" data-action="slicer-remove" id="slicerRemoveButton">${esc(T('deleteSelected'))}</button><button type="button" class="mini-button" data-action="slicer-undo" id="slicerUndoButton">${esc(T('undo'))}</button></div>
<div class="frame-strip" id="slicerStrip"></div>
<div class="slicer-rect" id="slicerRect" hidden><span class="opt-label">${esc(T('exact'))}</span><div class="field-row">${['x','y','w','h'].map(k=>`<label class="field inline"><span>${k.toUpperCase()}</span><input id="slicerRect${k.toUpperCase()}" data-rect="${k}" type="number" min="${k==='w'||k==='h'?1:0}" max="65535" step="1" inputmode="numeric"></label>`).join('')}</div></div>
<p class="viewer-note">${esc(T('hint'))}</p></section>
<aside class="side"><div class="summary" id="slicerSummary" role="status" aria-live="polite"></div><form id="slicerOptions" class="options" autocomplete="off">
<span class="opt-label">${esc(T('mode'))}</span>${seg('slicerMode','mode',['auto','grid'],v=>T('modes.'+v))}
<div id="slicerGridSimple" ${o.mode==='grid'?'':'hidden'}><span class="opt-label">${esc(T('suggested'))}</span><div class="chips-row" id="slicerSuggest"></div>${seg('slicerGridBy','gridBy',['cell','count'],v=>T('gridBy.'+v))}
<div class="field-row" id="slicerCellFields">${num('slicerCellW','cellW',1,8192)}${num('slicerCellH','cellH',1,8192)}</div>
<div class="field-row" id="slicerCountFields" hidden>${num('slicerColumns','columns',1,512)}${num('slicerRows','rows',1,512)}</div></div>
<div id="slicerAutoSimple" ${o.mode==='auto'?'':'hidden'}><p class="hint">${esc(T('autoHint'))}</p></div>
<details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary>
<div id="slicerAutoFields" ${o.mode==='auto'?'':'hidden'}>${num('slicerThreshold','threshold',0,254)}${num('slicerMinArea','minArea',1,1000000)}${num('slicerMerge','merge',0,256)}</div>
<div id="slicerGridFields" ${o.mode==='grid'?'':'hidden'}><div class="field-row">${num('slicerOffsetX','offsetX',0,8192)}${num('slicerOffsetY','offsetY',0,8192)}</div><div class="field-row">${num('slicerSpacingX','spacingX',0,8192)}${num('slicerSpacingY','spacingY',0,8192)}</div><label class="check"><input id="slicerSkipEmpty" data-check="skipEmpty" type="checkbox" ${o.skipEmpty?'checked':''}> ${esc(T('skipEmpty'))}</label></div>
<label class="field"><span>${esc(T('key'))}</span><select id="slicerKey" data-select="key">${[['none','keyNone'],['auto','keyAuto'],['custom','keyCustom']].map(([v,k])=>`<option value="${v}" ${o.key===v?'selected':''}>${esc(T(k))}</option>`).join('')}</select></label>
<div class="field-row" id="slicerKeyFields" ${o.key==='custom'?'':'hidden'}><label class="field inline"><span>${esc(T('keyColor'))}</span><input id="slicerKeyColor" data-color="keyColor" type="color" value="${o.keyColor}"></label></div>
<label class="field" id="slicerToleranceField" ${o.key==='none'?'hidden':''}><span>${esc(T('tolerance'))}</span><input id="slicerTolerance" data-num="tolerance" type="range" min="0" max="200" value="${Math.min(200,o.tolerance)}"></label>
<span class="opt-label">${esc(T('output'))}</span><label class="check"><input id="slicerTrim" data-check="trim" type="checkbox" ${o.trim?'checked':''}> ${esc(T('trim'))}</label>
${seg('slicerCanvasMode','canvas',['each','common'],v=>T('canvases.'+v))}
<label class="field" id="slicerAnchorField" ${o.canvas==='common'?'':'hidden'}><span>${esc(T('anchor'))}</span><select id="slicerAnchor" data-select="anchor">${Object.keys(F.ANCHORS).map(k=>`<option value="${k}" ${o.anchor===k?'selected':''}>${esc(T('anchors.'+k))}</option>`).join('')}</select></label>
<div class="field-row">${num('slicerPadding','padding',0,512)}<label class="field"><span>${esc(T('prefix'))}</span><input id="slicerPrefix" data-text="prefix" type="text" maxlength="40" value="${esc(o.prefix)}" placeholder="${esc(prefix())}"></label></div>
<label class="check"><input id="slicerWantGif" data-check="wantGif" type="checkbox" ${o.wantGif?'checked':''}> ${esc(T('wantGif'))}</label>
<label class="check"><input id="slicerWantStrip" data-check="wantStrip" type="checkbox" ${o.wantStrip?'checked':''}> ${esc(T('wantStrip'))}</label></details></form>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('another'))}</button><button type="button" class="link" data-action="slicer-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="slicer-download" disabled></button><nav class="next" id="slicerNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
 }
 // ---- measurement: one pass over the rows gives every frame's opaque box, the empty cells and
 // the transparent separator profile the grid suggestions are read from.
 async function measure(src,rects){
  const acc=rects.map(F.emptyBounds),buckets=F.rowBuckets(rects,src.height),columns=new Uint8Array(src.width),rowFlags=new Uint8Array(src.height),ctx=ctxOf(src);
  for(let y=0;y<src.height;y+=64){
   const rows=Math.min(64,src.height-y);
   F.scanRows(ctx.getImageData(0,y,src.width,rows).data,src.width,y,rows,{rects,acc,buckets,columns,rowFlags,threshold:o.threshold});
   await yieldUI();
  }
  return {boxes:acc.map(F.accBox),profile:{columns,rows:rowFlags}};
 }
 function trimOf(f){
  const b=f.sourceRect;
  if(b.w*b.h>ANALYSIS_PIXELS)return {...b};// a frame that large is not worth a second full scan
  const r=bounds(ctxOf(work).getImageData(b.x,b.y,b.w,b.h).data,b.w,b.h,o.threshold);
  return r?{x:b.x+r.x,y:b.y+r.y,w:r.w,h:r.h}:null;
 }
 const trimFor=f=>trims.has(key(f))?trims.get(key(f)):(trims.set(key(f),trimOf(f)),trims.get(key(f)));
 const key=f=>`${f.sourceRect.x},${f.sourceRect.y},${f.sourceRect.w},${f.sourceRect.h},${o.threshold}`;
 /** Trim, canvas and anchor are pure layout: applied without touching a pixel or re-detecting. */
 function relayout(){
  for(const f of frames)f.trimmedRect=o.trim?trimFor(f):null;
  const common={...anchorOf(),padding:o.padding};
  try{
   layout=F.layoutFrames(frames,{mode:o.canvas,...common});frames=layout.frames;
   anim=frames.length?F.layoutFrames(frames,{mode:'common',...common}):null;error='';
  }catch(e){layout=null;anim=null;error=e?.message||String(e);}
 }
 async function prepare(){
  const want=o.key==='none'?'':`${o.key}|${o.keyColor}|${o.tolerance}`;
  if(workKey===want&&work)return work;
  if(work&&work!==sheet)Im.release(work);
  work=want?await Im.processPixels(sheet,'remove',{color:o.key==='custom'?rgb(o.keyColor):borderColor(sheet),tolerance:o.tolerance},()=>{}):sheet;
  workKey=want;trims.clear();drawSheet();return work;
 }
 async function detect({keepOrder=false}={}){
  if(!sheet)return;
  const gen=++generation;
  try{
   const src=await prepare();if(gen!==generation)return;
   let rects;
   if(o.mode==='auto'){
    components=await imageComponents(src,{threshold:o.threshold,minArea:Math.min(o.minArea,src.width*src.height)});
    if(gen!==generation)return;
    rects=F.mergeRects(components,o.merge);
   }else{
    const cell=gridCell(src);rects=F.gridFrames(src.width,src.height,{...cell,offsetX:o.offsetX,offsetY:o.offsetY,spacingX:o.spacingX,spacingY:o.spacingY,columns:o.gridBy==='count'?o.columns:0,rows:o.gridBy==='count'?o.rows:0});
   }
   const {boxes,profile}=await measure(src,rects);if(gen!==generation)return;
   suggestions=F.suggestCells(src.width,src.height,{rects:components.length?components:rects,profile});
   const kept=rects.filter((r,i)=>!(o.mode==='grid'&&o.skipEmpty&&!boxes[i]));
   const boxOfRect=new Map(rects.map((r,i)=>[r,boxes[i]]));
   const ordered=keepOrder||o.mode==='grid'?kept:F.readingOrder(kept,F.rowTolerance(kept));
   trims.clear();frames=ordered.map(r=>{const f=F.makeFrame(++seq,r);trims.set(key(f),boxOfRect.get(r));return f;});
   selected=new Set();history=[];error='';
  }catch(e){frames=[];error=e?.message||String(e);}
  relayout();render();
 }
 /** Grid by columns × rows: the cell is whatever is left after the margin and the gutters. */
 function gridCell(src){
  if(o.gridBy!=='count')return {cellW:o.cellW,cellH:o.cellH};
  return {cellW:Math.max(1,Math.floor((src.width-o.offsetX-(o.columns-1)*o.spacingX)/o.columns)),
   cellH:Math.max(1,Math.floor((src.height-o.offsetY-(o.rows-1)*o.spacingY)/o.rows))};
 }
 // ---- drawing
 function drawSheet(){
  const cv=el.querySelector('#slicerCanvas');if(!cv||!work)return;
  if(cv.width!==work.width||cv.height!==work.height){cv.width=work.width;cv.height=work.height;}
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(work,0,0);
  const holder=el.querySelector('#slicerSheet');holder.style.aspectRatio=`${work.width} / ${work.height}`;
  holder.style.width=o.zoom==='fit'?'':`${work.width*Number(o.zoom)}px`;
  el.querySelector('#slicerInfo').textContent=`${work.width} × ${work.height}`;
 }
 function drawOverlay(){
  const svg=el.querySelector('#slicerOverlay');if(!svg||!work)return;
  svg.setAttribute('viewBox',`0 0 ${work.width} ${work.height}`);
  const scale=(svg.getBoundingClientRect().width||work.width)/work.width,unit=v=>v/Math.max(.001,scale);
  const live=drag?.rect&&drag.kind!=='move'?drag.rect:null,label=Math.max(7,unit(11));
  let html=frames.map((f,i)=>{
   const r=drag?.kind==='move'&&drag.id===f.id?drag.rect:f.sourceRect,on=selected.has(f.id);
   return `<g class="slicer-box ${on?'is-selected':''}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/><text x="${r.x+unit(2)}" y="${r.y+label}" font-size="${label}">${i+1}</text></g>`;
  }).join('');
  if(live)html+=`<rect class="slicer-new" x="${live.x}" y="${live.y}" width="${live.w}" height="${live.h}"/>`;
  if(selected.size===1&&!drag){
   const f=frames.find(x=>selected.has(x.id));
   if(f)html+=HANDLES.map(([name,fx,fy])=>{const s=unit(9);return `<rect class="slicer-handle" data-handle="${name}" x="${f.sourceRect.x+f.sourceRect.w*fx-s/2}" y="${f.sourceRect.y+f.sourceRect.h*fy-s/2}" width="${s}" height="${s}"/>`;}).join('');
  }
  svg.innerHTML=html;
 }
 function renderStrip(){
  const host=el.querySelector('#slicerStrip');if(!host)return;
  const shown=frames.slice(0,STRIP_CHIPS);
  host.innerHTML=shown.map((f,i)=>`<div class="frame-chip ${selected.has(f.id)?'is-selected':''}" draggable="true" data-id="${f.id}" data-index="${i}" tabindex="0" title="${F.boxOf(f).w}×${F.boxOf(f).h}"><canvas data-chip="${f.id}"></canvas><span>${i+1}</span><button type="button" data-action="slicer-chip-remove" data-id="${f.id}" aria-label="${esc(text('remove'))}">×</button></div>`).join('')
   +(frames.length>shown.length?`<div class="frame-chip is-more">+${frames.length-shown.length}</div>`:'');
  for(const cv of host.querySelectorAll('canvas[data-chip]')){
   const f=frames.find(x=>String(x.id)===cv.dataset.chip),b=F.boxOf(f),s=Math.min(1,56/Math.max(b.w,b.h));
   cv.width=Math.max(1,Math.round(b.w*s));cv.height=Math.max(1,Math.round(b.h*s));
   const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(work,b.x,b.y,b.w,b.h,0,0,cv.width,cv.height);
  }
  el.querySelector('#slicerCount').textContent=T('frameCount',{n:frames.length})+(selected.size?' · '+T('selectedN',{n:selected.size}):'');
  for(const [id,on] of [['slicerMergeButton',selected.size<2],['slicerRemoveButton',!selected.size],['slicerUndoButton',!history.length]])el.querySelector('#'+id).disabled=on;
 }
 /** The numeric route to everything dragging does, and the one screen readers can use. */
 function renderRect(){
  const host=el.querySelector('#slicerRect');if(!host)return;
  const one=selected.size===1?frames.find(f=>selected.has(f.id)):null;
  host.hidden=!one;
  if(!one||host.contains(document.activeElement))return;
  for(const input of host.querySelectorAll('[data-rect]'))input.value=one.sourceRect[input.dataset.rect];
 }
 function renderSuggest(){
  const host=el.querySelector('#slicerSuggest');if(!host)return;
  host.innerHTML=suggestions.length?suggestions.map(s=>`<button type="button" class="chip" data-action="slicer-suggest" data-cell="${s.key}">${s.cellW}×${s.cellH}<small>${esc(T('reasons.'+s.reason))}</small></button>`).join(''):`<span class="hint">${esc(T('noSuggestion'))}</span>`;
 }
 function renderSummary(){
  const box=el.querySelector('#slicerSummary'),button=el.querySelector('#taskDownload');if(!box)return;
  const size=layout?.uniform?`${layout.width} × ${layout.height}`:frames.length?T('mixed'):'…';
  box.innerHTML=error?`<div class="summary-big muted">…</div><div class="summary-line bad">${esc(error)}</div>`
   :`<div class="summary-big">${esc(T('frameCount',{n:frames.length}))}</div><div class="summary-line">${esc(size)}${o.trim?' · '+esc(T('trimmed')):''}</div>`;
  button.disabled=!frames.length||!!error||busy;button.textContent=frames.length?T('run',{n:frames.length}):T('none');
  el.querySelector('#slicerNext').innerHTML=frames.length&&!error?`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="slicer-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`:'';
 }
 const render=()=>{drawSheet();drawOverlay();renderStrip();renderRect();renderSuggest();renderSummary();};
 function animate(now){
  raf=requestAnimationFrame(animate);
  const cv=el.querySelector('#slicerAnim');if(!cv||!anim?.frames.length)return;
  if(playing&&now-last>=1000/o.fps){last=now;tick=(tick+1)%anim.frames.length;}
  else if(cv.dataset.at===`${tick}|${anim.frames.length}|${anim.width}`)return;
  if(cv.width!==anim.width||cv.height!==anim.height){cv.width=anim.width;cv.height=anim.height;}
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  paintFrame(ctx,work,anim.frames[tick%anim.frames.length]);
  cv.dataset.at=`${tick}|${anim.frames.length}|${anim.width}`;
  const play=el.querySelector('#slicerPlay');if(play)play.textContent=playing?'❚❚':'▶';
 }
 // ---- editing
 const remember=()=>{history.push(F.snapshot(frames));if(history.length>32)history.shift();};
 function commit(){relayout();render();}
 function undo(){const past=history.pop();if(!past)return;const keep=[...selected].filter(id=>past.some(f=>f.id===id));frames=past;selected=new Set(keep);commit();}
 function removeSelected(){if(!selected.size)return;remember();frames=frames.filter(f=>!selected.has(f.id));selected=new Set();commit();}
 const inside=(r,p)=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
 function stagePoint(e){
  const svg=el.querySelector('#slicerOverlay'),r=svg.getBoundingClientRect(),scale=r.width/work.width;
  return {x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale,scale};
 }
 function resized(start,handle,p){
  const r={...start},right=r.x+r.w,bottom=r.y+r.h,x=Math.round(p.x),y=Math.round(p.y);
  if(handle.includes('w')){r.x=Math.min(right-1,Math.max(0,x));r.w=right-r.x;}
  if(handle.includes('e'))r.w=Math.max(1,Math.min(work.width,x)-r.x);
  if(handle.includes('n')){r.y=Math.min(bottom-1,Math.max(0,y));r.h=bottom-r.y;}
  if(handle.includes('s'))r.h=Math.max(1,Math.min(work.height,y)-r.y);
  return F.clampRect(r,work.width,work.height);
 }
 function pointerDown(e){
  if(e.button||!work||!frames)return;
  const svg=el.querySelector('#slicerOverlay');svg.focus({preventScroll:true});
  const p=stagePoint(e),grab=9/p.scale;
  const only=selected.size===1?frames.find(f=>selected.has(f.id)):null;
  const handle=only&&HANDLES.find(([,fx,fy])=>Math.abs(p.x-(only.sourceRect.x+only.sourceRect.w*fx))<=grab&&Math.abs(p.y-(only.sourceRect.y+only.sourceRect.h*fy))<=grab);
  svg.setPointerCapture(e.pointerId);e.preventDefault();
  if(handle){drag={kind:'resize',id:only.id,handle:handle[0],start:{...only.sourceRect},rect:{...only.sourceRect}};return;}
  const hit=[...frames].reverse().find(f=>inside(f.sourceRect,p));
  if(hit){
   if(e.shiftKey||e.ctrlKey||e.metaKey){selected.has(hit.id)?selected.delete(hit.id):selected.add(hit.id);}
   else if(!selected.has(hit.id)||selected.size>1)selected=new Set([hit.id]);
   drag={kind:'move',id:hit.id,from:p,start:{...hit.sourceRect},rect:{...hit.sourceRect}};
   drawOverlay();renderStrip();renderRect();return;
  }
  selected=new Set();drag={kind:'new',from:p,rect:{x:Math.round(p.x),y:Math.round(p.y),w:1,h:1}};drawOverlay();renderStrip();renderRect();
 }
 function pointerMove(e){
  if(!drag)return;const p=stagePoint(e);
  if(drag.kind==='resize')drag.rect=resized(drag.start,drag.handle,p);
  else if(drag.kind==='move'){const dx=Math.round(p.x-drag.from.x),dy=Math.round(p.y-drag.from.y);
   if(dx||dy)drag.moved=true;
   drag.rect=F.clampRect({...drag.start,x:Math.max(0,Math.min(work.width-drag.start.w,drag.start.x+dx)),y:Math.max(0,Math.min(work.height-drag.start.h,drag.start.y+dy))},work.width,work.height);}
  else drag.rect=F.clampRect({x:Math.min(drag.from.x,p.x),y:Math.min(drag.from.y,p.y),w:Math.abs(p.x-drag.from.x)||1,h:Math.abs(p.y-drag.from.y)||1},work.width,work.height);
  drawOverlay();
 }
 function pointerUp(){
  const d=drag;drag=null;if(!d)return;
  if(d.kind==='new'){
   if(d.rect.w<3||d.rect.h<3){drawOverlay();return;}
   remember();const f=F.makeFrame(++seq,d.rect);frames=[...frames,f];selected=new Set([f.id]);commit();return;
  }
  if(d.kind==='move'&&!d.moved){drawOverlay();renderStrip();return;}
  const target=frames.find(f=>f.id===d.id);if(!target){render();return;}
  remember();target.sourceRect=d.rect;commit();
 }
 // ---- export
 const json=value=>({blob:new Blob([JSON.stringify(value,null,2)],{type:'application/json'})});
 async function frameFiles(){
  const list=[],name=prefix();
  for(let i=0;i<frames.length;i++){
   const c=renderFrame(work,frames[i]);
   try{list.push(new File([await Im.blobOf(c)],F.frameName(name,i,frames.length),{type:'image/png'}));}finally{Im.release(c);}
   if(i%8===7)await yieldUI();
  }
  return list;
 }
 async function run(){
  if(busy||!frames.length||error)return;busy=true;renderSummary();
  try{
   const name=prefix(),files=await frameFiles(),entries=files.map(f=>({name:f.name,blob:f}));
   entries.push({name:'metadata.json',...json(F.metadata(frames,{tool:'nerulio-sprite-slicer',sourceWidth:work.width,sourceHeight:work.height,mode:o.mode,fps:o.fps,prefix:name,
    extra:{trimmed:o.trim,canvas:o.canvas,anchor:o.anchor,padding:o.padding,colorKey:o.key==='none'?null:o.key}}))});
   const common={...anchorOf(),padding:o.padding};
   if(o.wantStrip){const s=stripSheet(()=>work,frames,common);try{entries.push({name:`${name}_strip.png`,blob:await Im.blobOf(s.canvas)});}finally{Im.release(s.canvas);}}
   if(o.wantGif){
    const {width,height,buffers}=frameBuffers(()=>work,frames,common);
    if(width*height*buffers.length>GIF_PIXELS)throw Error(T('gifTooBig'));
    entries.push({name:`${name}.gif`,blob:new Blob([gif(buffers,width,height,Math.round(1000/o.fps),{transparent:true})],{type:'image/gif'})});
   }
   const blob=await zip(entries);download(blob,`${name}-frames.zip`);track('tool_success',{intent:route.id});
   toast(T('done',{n:frames.length,size:bytes(blob.size)}));
  }catch(e){toast(e?.message||String(e),{error:true});}
  finally{busy=false;renderSummary();}
 }
 async function sample(){
  const c=Im.canvas(160,48),x=c.getContext('2d');
  for(let i=0;i<4;i++){
   const bob=i%2,ox=i*40;
   x.fillStyle='#2b3a67';x.fillRect(ox+14,16+bob,12,16);x.fillStyle='#f4c095';x.fillRect(ox+15,7+bob,10,9);x.fillStyle='#e85d75';x.fillRect(ox+13,5+bob,14,4);
   x.fillStyle='#1b1f3b';x.fillRect(ox+15+i,32+bob,4,10-bob);x.fillRect(ox+21-i,32+bob,4,10-bob);
  }
  const file=new File([await Im.blobOf(c)],'walk_sheet.png',{type:'image/png'});Im.release(c);return file;
 }
 const schedule=(options={})=>{clearTimeout(timer);timer=setTimeout(()=>detect(options),80);};
 async function add(files){
  if(busy)return;busy=true;
  try{
   const file=files[0];if(!file)return;
   if(files.length>1)toast(T('oneSheet'));
   const next=await Im.decode(file);
   if(sheet){if(work&&work!==sheet)Im.release(work);Im.release(sheet);}
   sheet=next;work=null;workKey=null;sourceName=file.name;frames=[];components=[];history=[];selected=new Set();
   frame();cancelAnimationFrame(raf);raf=requestAnimationFrame(animate);
   track('tool_run',{intent:route.id});
   busy=false;await detect();
  }catch(e){toast(e?.message||String(e),{error:true});if(!sheet)empty();}
  finally{busy=false;}
 }
 function clear(){
  if(work&&work!==sheet)Im.release(work);Im.release(sheet);
  sheet=work=null;workKey=null;frames=[];components=[];suggestions=[];history=[];selected=new Set();layout=anim=null;error='';
  cancelAnimationFrame(raf);empty();
 }
 function readOptions(){
  const q=s=>el.querySelector(s),before=JSON.stringify(o),next={...o};
  for(const input of el.querySelectorAll('[data-num]'))next[input.dataset.num]=Math.max(Number(input.min),Math.min(Number(input.max),Math.round(Number(input.value)||0)));
  for(const input of el.querySelectorAll('[data-check]'))next[input.dataset.check]=input.checked;
  for(const input of el.querySelectorAll('[data-select]'))next[input.dataset.select]=input.value;
  for(const input of el.querySelectorAll('[data-color]'))next[input.dataset.color]=input.value;
  for(const input of el.querySelectorAll('[data-text]'))next[input.dataset.text]=input.value;
  next.fps=Number(q('#slicerFps').value)||o.fps;
  o=next;q('#slicerFpsOut').textContent=o.fps;
  reflect();
  return JSON.stringify({...o,fps:0,prefix:''})!==JSON.stringify({...JSON.parse(before),fps:0,prefix:''});
 }
 function reflect(){
  const q=s=>el.querySelector(s);
  q('#slicerAutoSimple').hidden=o.mode!=='auto';q('#slicerGridSimple').hidden=o.mode!=='grid';
  q('#slicerAutoFields').hidden=o.mode!=='auto';q('#slicerGridFields').hidden=o.mode!=='grid';
  q('#slicerCellFields').hidden=o.gridBy!=='cell';q('#slicerCountFields').hidden=o.gridBy!=='count';
  q('#slicerKeyFields').hidden=o.key!=='custom';q('#slicerToleranceField').hidden=o.key==='none';
  q('#slicerAnchorField').hidden=o.canvas!=='common';
 }
 const LAYOUT_ONLY=new Set(['trim','canvas','anchor','padding','prefix','wantGif','wantStrip','fps','zoom']);
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='slicer-sample')add([await sample()]);
  else if(a==='slicer-set'){
   const key=b.dataset.key,value=b.dataset.value;o={...o,[key]:/^\d+$/.test(value)?Number(value):value};
   for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
   reflect();if(LAYOUT_ONLY.has(key)){relayout();render();}else schedule();
  }
  else if(a==='slicer-suggest'){
   const s=suggestions.find(x=>x.key===b.dataset.cell);if(!s)return;
   o={...o,mode:'grid',gridBy:'cell',cellW:s.cellW,cellH:s.cellH,offsetX:s.offsetX,offsetY:s.offsetY,spacingX:s.spacingX,spacingY:s.spacingY};
   frame();reflect();detect();
  }
  else if(a==='slicer-order'){remember();frames=F.orderFrames(frames,F.rowTolerance(frames.map(f=>f.sourceRect)));commit();}
  else if(a==='slicer-merge'){
   if(selected.size<2)return;remember();
   const keep=frames.find(f=>selected.has(f.id))?.id;frames=F.mergeFrames(frames,[...selected]);selected=new Set(keep===undefined?[]:[keep]);commit();
  }
  else if(a==='slicer-remove')removeSelected();
  else if(a==='slicer-chip-remove'){remember();frames=frames.filter(f=>String(f.id)!==b.dataset.id);selected.delete(Number(b.dataset.id));commit();}
  else if(a==='slicer-undo')undo();
  else if(a==='slicer-play')playing=!playing;
  else if(a==='slicer-clear')clear();
  else if(a==='slicer-download')run();
  else if(a==='slicer-next'){const tool=b.dataset.tool;b.disabled=true;try{await continueWith(tool,await frameFiles());}finally{b.disabled=false;}}
 });
 el.addEventListener('pointerdown',e=>{if(e.target.closest('#slicerOverlay'))pointerDown(e);});
 el.addEventListener('pointermove',pointerMove);
 for(const name of ['pointerup','pointercancel'])el.addEventListener(name,pointerUp);
 el.addEventListener('click',e=>{
  const chip=e.target.closest('.frame-chip');if(!chip||!chip.dataset.id||e.target.closest('button'))return;
  const id=Number(chip.dataset.id);
  if(e.shiftKey||e.ctrlKey||e.metaKey)selected.has(id)?selected.delete(id):selected.add(id);
  else selected=new Set([id]);
  drawOverlay();renderStrip();renderRect();renderSummary();
 });
 function editRect(patch){
  const one=selected.size===1?frames.find(f=>selected.has(f.id)):null;if(!one)return;
  remember();one.sourceRect=F.clampRect({...one.sourceRect,...patch},work.width,work.height);commit();
 }
 el.addEventListener('input',e=>{
  if(e.target.dataset.rect){
   const patch={};
   for(const input of el.querySelectorAll('#slicerRect [data-rect]'))patch[input.dataset.rect]=Number(input.value)||0;
   editRect(patch);return;
  }
  if(e.target.id==='slicerFps'){o.fps=Number(e.target.value)||12;el.querySelector('#slicerFpsOut').textContent=o.fps;return;}
  if(!e.target.closest('#slicerOptions'))return;
  const keys=[e.target.dataset.num,e.target.dataset.check,e.target.dataset.select,e.target.dataset.color,e.target.dataset.text].filter(Boolean);
  const changed=readOptions();
  if(!changed)return renderSummary();
  if(keys.every(k=>LAYOUT_ONLY.has(k))){relayout();render();}else schedule();
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select'))return;
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  if(!frames.length)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();selected=new Set(frames.map(f=>f.id));drawOverlay();renderStrip();renderRect();renderSummary();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected();}
  else if(e.key==='Escape'){selected=new Set();drawOverlay();renderStrip();renderRect();renderSummary();}
  else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected.size===1){
   e.preventDefault();const step=e.shiftKey?10:1,r=frames.find(f=>selected.has(f.id)).sourceRect;
   const dx=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,dy=e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0;
   editRect(e.altKey?{w:r.w+dx,h:r.h+dy}:{x:r.x+dx,y:r.y+dy});
  }
 });
 let dragId=null;
 el.addEventListener('dragstart',e=>{const chip=e.target.closest?.('.frame-chip');if(!chip?.dataset.id)return;dragId=chip.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);});
 el.addEventListener('dragover',e=>{if(dragId){e.preventDefault();e.stopPropagation();}});
 el.addEventListener('drop',e=>{
  if(!dragId)return;e.preventDefault();e.stopPropagation();
  const chip=e.target.closest?.('.frame-chip'),from=frames.findIndex(f=>String(f.id)===dragId);dragId=null;
  if(!chip?.dataset.id||from<0)return;
  remember();const [moved]=frames.splice(from,1),to=frames.findIndex(f=>String(f.id)===chip.dataset.id),r=chip.getBoundingClientRect();
  frames.splice(Math.max(0,to)+(e.clientX>r.left+r.width/2?1:0),0,moved);commit();
 });
 el.addEventListener('dragend',()=>{dragId=null;});
 addEventListener('resize',()=>{if(frames.length)drawOverlay();});
 onLocale(()=>{if(!sheet){empty();return;}frame();reflect();render();});
 empty();
 return {add};
}
