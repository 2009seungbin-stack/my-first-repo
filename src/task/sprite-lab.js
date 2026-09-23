import * as Im from '../image.js';
import {bytes,stem,zip,gif} from '../core.js';
import {yieldUI} from '../resources.js';
import {detectColorKey,applyColorKey,hex as keyHex} from '../game/color-key.js';
import './strings-trust.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,page as route,pagePrefix,root} from './shell.js';
import {stashFiles} from './handoff.js';
import {innerRect,ALPHA_THRESHOLD} from '../game/pixels.js';
import {PIVOT_PRESETS,pivotPixels} from '../game/model.js';
import {detectGridWithColour,gridCells} from '../game/grid-detect.js';
import {detectFramesAsync,framesFromRects,normalizeFrames,readingOrder,unionRect,mergeRects,rectGap,autoVersusGrid,ALIGNMENTS} from '../game/frame-ops.js';
import {jitterReport,autoFixJitter,findDuplicates,loopSeam,frameDifference,REFERENCES} from '../game/jitter.js';
import {frameCollision} from '../game/contour.js';
import {outline} from '../game/outline.js';
import {defringe} from '../game/defringe.js';
import {packFrames,blitPage} from '../game/packing.js';
import {genericBundle} from '../game/exporters/generic-json.js';
import {godotBundle} from '../game/exporters/godot.js';
import {unityBundle} from '../game/exporters/unity.js';
import * as P from '../game/project.js';

/** Sprite Lab — one workspace, five stages, one sheet.
 *
 * Drop a sheet and walk Slice → Normalize → Animate → Pivot & boxes → Pack & export without
 * re-uploading anything: every stage edits the same `project` (src/game/project.js) in the model's
 * own shapes, and the preview and the exporters both read it, so what plays is what is written.
 *
 * No algorithm lives here. Slicing, grid suggestion, jitter, contours, outline, de-fringe, packing
 * and the three exporters are all `src/game/*`; this module decides what the person sees, what an
 * action means, and how undo works (a list of projects — records, never image snapshots).
 *
 * Pixels: exactly one decoded sheet is held. Everything downstream reads rectangles out of it
 * through a lazy `source`, so a 100-frame project never holds 100 RGBA copies. */
export const accept='image/*';
export const STAGES=Object.freeze(['slice','normalize','animate','boxes','export']);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const HANDLES=[['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]];
const GIF_PIXELS=24_000_000,STRIP_CHIPS=300,EXPORT_PIXELS=64_000_000;
const DEFAULTS={mode:'auto',autoMerge:true,merge:0,threshold:ALPHA_THRESHOLD,minArea:16,key:'auto',keyColor:'#ff00ff',tolerance:40,
 cellW:32,cellH:32,offsetX:0,offsetY:0,spacingX:0,spacingY:0,skipEmpty:true,
 trim:true,canvas:'auto',canvasW:64,canvasH:64,align:'bottom-center',padding:0,
 fps:12,direction:'forward',zoom:0,bg:'checker',onionBefore:0,onionAfter:0,
 reference:'bottom-center',preserveTrend:false,
 atlasPadding:2,extrude:0,pot:false,maxSize:4096,dedupe:true,target:'generic',outline:0,outlineColor:'#101828',defringe:false,
 collisionShape:'polygon',collisionTolerance:1,collisionVertices:16,collisionThreshold:127,collisionPadding:0};
const CLAMP={merge:[0,256],threshold:[0,254],minArea:[1,1_000_000],tolerance:[0,200],cellW:[1,8192],cellH:[1,8192],
 offsetX:[0,8192],offsetY:[0,8192],spacingX:[0,8192],spacingY:[0,8192],canvasW:[1,8192],canvasH:[1,8192],padding:[0,256],
 fps:[1,240],onionBefore:[0,8],onionAfter:[0,8],atlasPadding:[0,256],extrude:[0,64],maxSize:[8,32768],outline:[0,16],
 collisionTolerance:[0,64],collisionVertices:[3,64],collisionThreshold:[0,254],collisionPadding:[0,32],
 rangeFrom:[1,4096],rangeTo:[1,4096],boxX:[-4096,4096],boxY:[-4096,4096],boxW:[1,4096],boxH:[1,4096],boxR:[1,4096]};

export function mount({el,def}){
 let sheet=null,work=null,workKey=null,sourceName='sprite',reader=null,sourceFile=null;
 let project=P.project(),past=[],future=[],selected=new Set(),busy=false,generation=0,error='',abort=null;
 let stage=STAGES.includes(def?.stage)?def.stage:'slice';
 let suggestions=[],autoMerge=null,animationId='',frameCursor=0,boxId='',advancedOpen=false;
 // What the automatic steps decided, kept so the panel can show it and offer the way back:
 // keyInfo — the detected background colour; islands — small islands attached or left over;
 // gridHint — Auto's frames straddle a detected grid; anchor — the Shift+click range start.
 let keyInfo=null,keyDeclined=false,islands=null,showIslands=true,gridHint=null,anchorId=null,progressText='',deleteArmed=0;
 let atlasResult=null,jitter=null,fixPreview=null,duplicates=null,seam=null,normalizePreview=null;
 let playing=true,raf=0,clock=0,lastFrameTime=0,timer=0,diffView=false,pivotUnit='unit',pivotScope='selected';
 let box={type:'hit',shape:'rect',x:0,y:0,w:8,h:8,cx:8,cy:8,r:4},range={from:1,to:1};
 let o={...DEFAULTS,...P.settingsFromQuery(route.query,DEFAULTS)};
 const T=(k,v)=>text('lab.'+k,v);
 const ctxOf=c=>c.getContext('2d',{willReadFrequently:true});
 const q=s=>el.querySelector(s);
 const prefix=()=>(stem(sourceName)||'sprite').replace(/[^\w.-]+/g,'_')||'sprite';
 const animation=()=>P.animationOf(project,animationId)||project.animations[0]||null;
 const steps=()=>P.playback(project,animation());
 /** The one pixel gateway: a rectangle at a time out of the single decoded sheet. */
 function src(){
  if(!work)throw Error('No sheet');
  if(reader?.canvas===work)return reader.source;
  const ctx=ctxOf(work);
  reader={canvas:work,source:{width:work.width,height:work.height,
   read(r){const d=ctx.getImageData(r.x,r.y,r.w,r.h);return {data:d.data,width:r.w,height:r.h};}}};
  return reader.source;
 }
 const frameById=id=>project.frames.find(f=>f.id===id)||null;
 const selectedFrames=()=>project.frames.filter(f=>selected.has(f.id));
 const currentFrame=()=>selectedFrames()[0]||project.frames[frameCursor]||project.frames[0]||null;
 /** Which frames an "apply to" choice means. */
 function targetIds(scope){
  if(scope==='all')return project.frames.map(f=>f.id);
  if(scope==='animation')return animation()?[...new Set(animation().frameIds)]:[];
  return selected.size?[...selected]:currentFrame()?[currentFrame().id]:[];
 }
 // ---- undo: whole projects, which are records. 32 steps of a 100-frame project is well under a megabyte.
 function commit(next){
  past.push(project);if(past.length>32)past.shift();
  future=[];project=next;
  if(!project.atlas){atlasResult?.release?.();atlasResult=null;}
  invalidate();render();
 }
 function undo(){if(!past.length)return;future.push(project);project=past.pop();invalidate();render();}
 function redo(){if(!future.length)return;past.push(project);project=future.pop();invalidate();render();}
 const invalidate=()=>{jitter=null;fixPreview=null;duplicates=null;seam=null;normalizePreview=null;if(!project.atlas)atlasResult=null;};

 // ---------------------------------------------------------------- markup
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="lab-sample">${esc(text('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 const seg=(key,values,label,{aria=''}={})=>`<div class="segmented" role="group"${aria?` aria-label="${esc(aria)}"`:''}>${values.map(v=>`<button type="button" data-action="lab-set" data-key="${key}" data-value="${esc(v)}" aria-pressed="${String(o[key])===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
 const num=(key,{id='',label=key}={})=>{const [min,max]=CLAMP[key]||[0,65535];
  return `<label class="field inline"><span>${esc(T(label))}</span><input${id?` id="${id}"`:''} data-num="${key}" type="number" min="${min}" max="${max}" step="1" value="${o[key]}" inputmode="numeric"></label>`;};
 const check=(key,{id='',label=key}={})=>`<label class="check"><input${id?` id="${id}"`:''} data-check="${key}" type="checkbox" ${o[key]?'checked':''}> ${esc(T(label))}</label>`;
 function shellMarkup(){
  el.innerHTML=`<nav class="lab-stages" id="labStages" aria-label="${esc(T('stages.slice'))}">${STAGES.map((s,i)=>
   `<button type="button" data-action="lab-stage" data-stage="${s}" aria-pressed="${s===stage}"><b>${i+1}</b>${esc(T('stages.'+s))}</button>`).join('')}</nav>
<div class="work lab-work"><section class="board" id="labBoard"></section>
<aside class="side"><div class="summary" id="labSummary" role="status" aria-live="polite"></div>
<div id="labTools"></div>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('another'))}</button><button type="button" class="link" data-action="lab-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="lab-primary" disabled></button>
<div class="chips-row"><button type="button" class="mini-button" data-action="lab-undo" id="labUndo">${esc(T('undo'))}</button><button type="button" class="mini-button" data-action="lab-redo" id="labRedo">${esc(T('redo'))}</button><button type="button" class="mini-button" data-action="lab-share">${esc(T('share'))}</button><button type="button" class="mini-button" data-action="lab-save-project">${esc(T('saveProject'))}</button><button type="button" class="mini-button" data-action="lab-studio">${esc(T('openStudio'))}</button><label class="mini-button" for="labProjectFile">${esc(T('loadProject'))}<input id="labProjectFile" type="file" accept="application/json,.json" hidden></label></div>
<small class="local-note">${esc(text('local'))}</small></aside></div>`;
  stageMarkup();
 }
 const strip=()=>`<div class="frame-strip" id="labStrip"></div>`;
 const stripHTML=()=>{
  const shown=project.frames.slice(0,STRIP_CHIPS);
  return shown.map((f,i)=>
   `<div class="frame-chip ${selected.has(f.id)?'is-selected':''}" draggable="true" data-id="${f.id}" data-index="${i}" tabindex="0" title="${esc(f.name)} ${innerRect(f).w}×${innerRect(f).h}"><canvas data-chip="${f.id}"></canvas><span>${i+1}</span><button type="button" data-action="lab-chip-remove" data-id="${f.id}" aria-label="${esc(text('remove'))}">×</button></div>`).join('')
   +(project.frames.length>shown.length?`<div class="frame-chip is-more">+${project.frames.length-shown.length}</div>`:'');
 };
 const previewBox=(id,extra='')=>`<div class="lab-stage-view bg-${o.bg}" id="${id}Hold"><canvas id="${id}" class="px"></canvas>${extra}</div>`;
 const bgRow=()=>`<div class="chips-row"><span class="opt-label">${esc(T('bg'))}</span>${seg('bg',['checker','black','white','magenta'],v=>T('bgs.'+v),{aria:T('bg')})}<span class="opt-label">${esc(T('zoom'))}</span>${seg('zoom',[0,1,2,4,8],v=>v==='0'||v===0?T('fit'):v+'×',{aria:T('zoom')})}</div>`;

 function stageMarkup(){
  const board=q('#labBoard'),tools=q('#labTools');if(!board)return;
  // Rebuilding the tools must not fold Advanced away under someone who just opened it.
  advancedOpen=q('#optionsAdvanced')?.open??advancedOpen;
  if(stage==='animate'||stage==='boxes')ensureAnimation();
  if(stage==='slice'){
   board.innerHTML=`<div class="view-head"><strong>${esc(T('sheet'))}</strong><span id="labInfo"></span></div>
<div class="slicer-stage" id="labSheetStage"><div class="slicer-sheet" id="labSheet"><canvas id="labCanvas" class="px"></canvas><svg id="labOverlay" xmlns="http://www.w3.org/2000/svg" tabindex="0" aria-label="${esc(T('sheet'))}"></svg></div></div>
<div class="view-head frames-head"><strong>${esc(T('frames'))}</strong><span id="labCount"></span><button type="button" class="mini-button" data-action="lab-order">${esc(T('order'))}</button><button type="button" class="mini-button" data-action="lab-merge" id="labMergeButton">${esc(T('mergeSelected'))}</button><button type="button" class="mini-button" data-action="lab-remove" id="labRemoveButton">${esc(T('deleteSelected'))}</button></div>
${strip()}
<div class="slicer-rect" id="labRect" hidden><span class="opt-label">${esc(T('exact'))}</span><div class="field-row">${['x','y','w','h'].map(k=>`<label class="field inline"><span>${k.toUpperCase()}</span><input id="labRect${k.toUpperCase()}" data-rect="${k}" type="number" min="${k==='w'||k==='h'?1:0}" max="65535" step="1" inputmode="numeric"></label>`).join('')}</div></div>
<p class="viewer-note">${esc(T('sliceHint'))}</p>`;
   tools.innerHTML=`<form id="labOptions" class="options" autocomplete="off"><span class="opt-label">${esc(T('mode'))}</span>${seg('mode',['auto','grid'],v=>T('modes.'+v),{aria:T('mode')})}
<div id="labAssist" class="lab-assist" aria-live="polite"></div>
<div id="labAuto" ${o.mode==='auto'?'':'hidden'}><p class="hint">${esc(T('autoHint'))}</p>${check('autoMerge',{id:'labAutoMerge',label:'mergeAuto'})}
<label class="field"><span>${esc(T('merge'))} <output id="labMergeOut">${o.merge}</output></span><input id="labMerge" data-num="merge" type="range" min="0" max="24" value="${Math.min(24,o.merge)}" ${o.autoMerge?'disabled':''}></label>
<p class="hint" id="labMergeReason"></p></div>
<div id="labGrid" ${o.mode==='grid'?'':'hidden'}><span class="opt-label">${esc(T('suggested'))}</span><div class="chips-row" id="labSuggest"></div>
<span class="opt-label">${esc(T('cellCustom'))}</span><div class="field-row">${num('cellW',{id:'labCellW'})}${num('cellH',{id:'labCellH'})}</div></div>
<details class="options-advanced" id="optionsAdvanced" ${advancedOpen?'open':''}><summary>${esc(text('advanced'))}</summary>
<div id="labAutoAdvanced" ${o.mode==='auto'?'':'hidden'}><div class="field-row">${num('threshold')}${num('minArea')}</div></div>
<div id="labGridAdvanced" ${o.mode==='grid'?'':'hidden'}><div class="field-row">${num('offsetX')}${num('offsetY')}</div><div class="field-row">${num('spacingX')}${num('spacingY')}</div>${check('skipEmpty')}</div>
<label class="field"><span>${esc(T('key'))}</span><select data-select="key">${[['none','keyNone'],['auto','keyAuto'],['custom','keyCustom']].map(([v,k])=>`<option value="${v}" ${o.key===v?'selected':''}>${esc(T(k))}</option>`).join('')}</select></label>
<div class="field-row" id="labKeyFields" ${o.key==='custom'?'':'hidden'}><label class="field inline"><span>${esc(T('keyColor'))}</span><input data-color="keyColor" type="color" value="${o.keyColor}"></label></div>
<label class="field" id="labToleranceField" ${o.key==='none'?'hidden':''}><span>${esc(T('tolerance'))}</span><input data-num="tolerance" type="range" min="0" max="200" value="${Math.min(200,o.tolerance)}"></label>
</details></form>`;
  }
  else if(stage==='normalize'){
   board.innerHTML=`<div class="atlas-views"><div class="atlas-view"><div class="view-head"><strong>${esc(T('before'))}</strong></div><div class="norm-grid" id="labBefore"></div></div>
<div class="atlas-view"><div class="view-head"><strong>${esc(T('after'))}</strong><span id="labNormSize"></span></div><div class="norm-grid" id="labAfter"></div></div></div>
<p class="viewer-note" id="labNormNote">${esc(T('sizeHint'))}</p>`;
   tools.innerHTML=`<form id="labOptions" class="options" autocomplete="off">${check('trim',{id:'labTrim'})}
<span class="opt-label">${esc(T('align'))}</span><select data-select="align" id="labAlign">${ALIGNMENTS.filter(a=>a!=='custom').map(a=>`<option value="${a}" ${o.align===a?'selected':''}>${esc(T('aligns.'+a))}</option>`).join('')}</select>
<span class="opt-label">${esc(T('size'))}</span>${seg('canvas',['auto','exact'],v=>T('sizes.'+v),{aria:T('size')})}
<div class="field-row" id="labCanvasFields" ${o.canvas==='exact'?'':'hidden'}>${num('canvasW',{id:'labCanvasW',label:'width'})}${num('canvasH',{id:'labCanvasH',label:'height'})}</div>
<div class="field-row">${num('padding',{id:'labPadding'})}</div>
<p class="hint">${esc(T('sizeHint'))}</p></form>`;
  }
  else if(stage==='animate'){
   const a=animation();
   board.innerHTML=`<div class="atlas-views"><div class="atlas-view"><div class="view-head"><strong>${esc(T('stages.animate'))}</strong><span id="labPlayInfo"></span><button type="button" class="mini-button" data-action="lab-play" id="labPlay" aria-label="${esc(T('play'))}" title="${esc(T('play'))}"></button></div>
${previewBox('labAnim')}${bgRow()}
<label class="field fps"><span>${esc(T('fps'))} <output id="labFpsOut">${a?a.fps:o.fps}</output></span><input id="labFps" type="range" min="1" max="60" value="${a?a.fps:o.fps}"></label></div>
<div class="atlas-view"><div class="view-head"><strong>${esc(T('jitter'))}</strong><span id="labJitterValue"></span></div>
<div class="lab-graph" id="labJitterGraph"></div><div class="lab-notes" id="labJitterNotes"></div></div></div>
<div class="view-head frames-head"><strong>${esc(T('frames'))}</strong><span id="labCount"></span><button type="button" class="mini-button" data-action="lab-assign">${esc(T('assign'))}</button></div>
${strip()}
<div class="lab-notes" id="labAnimNotes"></div>`;
   tools.innerHTML=`<form id="labOptions" class="options" autocomplete="off">
<span class="opt-label">${esc(T('animations'))}</span><div class="chips-row" id="labAnimList"></div>
<div class="chips-row"><button type="button" class="mini-button" data-action="lab-anim-new">${esc(T('newAnimation'))}</button><button type="button" class="mini-button" data-action="lab-anim-rename" ${a?'':'disabled'}>${esc(T('renameAnimation'))}</button><button type="button" class="mini-button" data-action="lab-anim-delete" ${a?'':'disabled'}>${esc(T('deleteAnimation'))}</button></div>
<span class="opt-label">${esc(T('direction'))}</span>${seg('direction',['forward','reverse','pingpong'],v=>T('directions.'+v),{aria:T('direction')})}
<label class="check"><input id="labLoop" data-anim-check="loop" type="checkbox" ${a?.loop!==false?'checked':''}> ${esc(T('loop'))}</label>
<div class="chips-row"><button type="button" class="mini-button" data-action="lab-autofix" id="labAutoFix">${esc(T('autoFix'))}</button><button type="button" class="mini-button" data-action="lab-mirror">${esc(T('mirror'))}</button></div>
<p class="hint" id="labFixNeedsCanvas" hidden>${esc(T('fixNeedsCanvas'))}</p>
<div id="labFixBox" hidden><p class="hint" id="labFixText"></p><div class="chips-row"><button type="button" class="chip" data-action="lab-fix-keep" id="labFixKeep">${esc(T('keepFix'))}</button><button type="button" class="mini-button" data-action="lab-fix-drop">${esc(T('dropFix'))}</button></div></div>
<details class="options-advanced" id="optionsAdvanced" ${advancedOpen?'open':''}><summary>${esc(text('advanced'))}</summary>
<label class="field"><span>${esc(T('duration'))}</span><input id="labDuration" data-duration type="number" min="1" max="60000" step="1" placeholder="${esc(T('durationAuto'))}" inputmode="numeric"></label>
<label class="field"><span>${esc(T('tag'))}</span><select data-select-tag id="labTag"><option value=""></option>${P.TAGS.map(tg=>`<option value="${tg}">${esc(tg)}</option>`).join('')}</select></label>
<span class="opt-label">${esc(T('onion'))}</span><div class="field-row">${num('onionBefore',{id:'labOnionBefore'})}${num('onionAfter',{id:'labOnionAfter'})}</div>
<label class="check"><input id="labDiff" type="checkbox" ${diffView?'checked':''}> ${esc(T('difference'))}</label>
<label class="field"><span>${esc(T('reference'))}</span><select data-select="reference" id="labReference">${REFERENCES.map(r=>`<option value="${r}" ${o.reference===r?'selected':''}>${esc(T('references.'+r))}</option>`).join('')}</select></label>
${check('preserveTrend',{id:'labPreserveTrend'})}
<div class="chips-row"><button type="button" class="mini-button" data-action="lab-dup-remove" id="labDupRemove">${esc(T('dupRemove'))}</button></div>
</details></form>`;
  }
  else if(stage==='boxes'){
   board.innerHTML=`<div class="atlas-views"><div class="atlas-view"><div class="view-head"><strong>${esc(T('pivot'))}</strong><span id="labFrameName"></span></div>
${previewBox('labFrame',`<svg id="labFrameOverlay" xmlns="http://www.w3.org/2000/svg" tabindex="0" aria-label="${esc(T('pivot'))}"></svg>`)}${bgRow()}</div>
<div class="atlas-view"><div class="view-head"><strong>${esc(T('timeline'))}</strong></div><div class="lab-timeline" id="labTimeline"></div><p class="hint">${esc(T('timelineHint'))}</p>
<div class="lab-notes" id="labBoxNotes"></div></div></div>
<div class="view-head frames-head"><strong>${esc(T('frames'))}</strong><span id="labCount"></span></div>
${strip()}`;
   tools.innerHTML=`<form id="labOptions" class="options" autocomplete="off">
<span class="opt-label">${esc(T('applyTo'))}</span><div class="chips-row">${['selected','animation','all'].map(s=>`<button type="button" class="chip" data-action="lab-pivot-scope" data-scope="${s}">${esc(T('targets.'+s))}</button>`).join('')}</div>
<span class="opt-label">${esc(T('pivot'))}</span><div class="chips-row">${Object.keys(PIVOT_PRESETS).map(k=>`<button type="button" class="chip" data-action="lab-pivot-preset" data-preset="${k}">${esc(T('pivots.'+k))}</button>`).join('')}</div>
<div class="segmented" role="group" aria-label="${esc(T('pivot'))}"><button type="button" data-action="lab-pivot-unit" data-value="unit" aria-pressed="${pivotUnit==='unit'}">${esc(T('pivotUnit'))}</button><button type="button" data-action="lab-pivot-unit" data-value="pixels" aria-pressed="${pivotUnit==='pixels'}">${esc(T('pivotPixels'))}</button></div>
<div class="field-row"><label class="field inline"><span>${esc(T('pivotX'))}</span><input id="labPivotX" data-pivot="x" type="number" step="${pivotUnit==='pixels'?1:0.001}" inputmode="decimal"></label><label class="field inline"><span>${esc(T('pivotY'))}</span><input id="labPivotY" data-pivot="y" type="number" step="${pivotUnit==='pixels'?1:0.001}" inputmode="decimal"></label></div>
<span class="opt-label">${esc(T('boxes'))}</span><div class="field-row"><label class="field inline"><span>${esc(T('boxType'))}</span><select id="labBoxType" data-box="type">${P.BOX_KINDS.map(k=>`<option value="${k}" ${box.type===k?'selected':''}>${esc(T('boxTypes.'+k))}</option>`).join('')}</select></label><label class="field inline"><span>${esc(T('shape'))}</span><select id="labBoxShape" data-box="shape">${['rect','circle','polygon'].map(s=>`<option value="${s}" ${box.shape===s?'selected':''}>${esc(T('shapes.'+s))}</option>`).join('')}</select></label></div>
<div class="field-row" id="labBoxRect" ${box.shape==='rect'?'':'hidden'}><label class="field inline"><span>X</span><input id="labBoxX" data-box="x" type="number" step="1" value="${box.x}"></label><label class="field inline"><span>Y</span><input id="labBoxY" data-box="y" type="number" step="1" value="${box.y}"></label><label class="field inline"><span>W</span><input id="labBoxW" data-box="w" type="number" min="1" step="1" value="${box.w}"></label><label class="field inline"><span>H</span><input id="labBoxH" data-box="h" type="number" min="1" step="1" value="${box.h}"></label></div>
<div class="field-row" id="labBoxCircle" ${box.shape==='circle'?'':'hidden'}><label class="field inline"><span>CX</span><input id="labBoxCX" data-box="cx" type="number" step="1" value="${box.cx}"></label><label class="field inline"><span>CY</span><input id="labBoxCY" data-box="cy" type="number" step="1" value="${box.cy}"></label><label class="field inline"><span>R</span><input id="labBoxR" data-box="r" type="number" min="1" step="1" value="${box.r}"></label></div>
<div class="field-row"><label class="field inline"><span>${esc(T('rangeFrom'))}</span><input id="labRangeFrom" data-range="from" type="number" min="1" step="1" value="${range.from}"></label><label class="field inline"><span>${esc(T('rangeTo'))}</span><input id="labRangeTo" data-range="to" type="number" min="1" step="1" value="${range.to}"></label></div>
<div class="chips-row"><button type="button" class="chip" data-action="lab-box-add" id="labBoxAdd">${esc(T('addBox'))}</button><button type="button" class="mini-button" data-action="lab-box-range" id="labBoxRange">${esc(T('copyToRange'))}</button></div>
<div id="labBoxList" class="lab-notes"></div>
<details class="options-advanced" id="optionsAdvanced" ${advancedOpen?'open':''}><summary>${esc(text('advanced'))}</summary>
<span class="opt-label">${esc(T('collision'))}</span><label class="field"><span>${esc(T('collisionShape'))}</span><select data-select="collisionShape" id="labCollisionShape">${['polygon','hull','rect','circle'].map(s=>`<option value="${s}" ${o.collisionShape===s?'selected':''}>${esc(T('collisionShapes.'+s))}</option>`).join('')}</select></label>
<div class="field-row">${num('collisionTolerance',{id:'labCollisionTolerance'})}${num('collisionVertices',{id:'labCollisionVertices'})}</div>
<div class="field-row">${num('collisionThreshold')}${num('collisionPadding')}</div>
<div class="chips-row"><button type="button" class="chip" data-action="lab-collision" id="labCollision">${esc(T('collisionRun'))}</button></div>
<p class="hint" id="labCollisionResult">${esc(T('collisionNone'))}</p></details></form>`;
  }
  else{
   board.innerHTML=`<div class="view-head"><strong>${esc(T('atlas'))}</strong><span id="labAtlasInfo"></span></div>
<div class="slicer-stage" id="labAtlasStage"><div class="slicer-sheet"><canvas id="labAtlasCanvas" class="px"></canvas></div></div>
<div class="lab-notes" id="labPages"></div>
<div class="atlas-views" id="labEdgeZoomRow" hidden><div class="atlas-view"><div class="view-head"><strong>${esc(T('before'))}</strong></div><div class="lab-stage-view bg-checker"><canvas id="labEdgeBefore" class="px"></canvas></div></div>
<div class="atlas-view"><div class="view-head"><strong>${esc(T('after'))}</strong></div><div class="lab-stage-view bg-checker"><canvas id="labEdgeAfter" class="px"></canvas></div></div></div>`;
   tools.innerHTML=`<form id="labOptions" class="options" autocomplete="off">
<span class="opt-label">${esc(T('target'))}</span>${seg('target',['generic','godot','unity'],v=>T('targets2.'+v),{aria:T('target')})}
<p class="hint ${o.target==='unity'?'bad':''}" id="labTargetNote"></p>
<div class="field-row">${num('atlasPadding',{id:'labAtlasPadding'})}${num('maxSize',{id:'labMaxSize'})}</div>
<div class="chips-row"><button type="button" class="chip" data-action="lab-pack" id="labPack">${esc(T('pack'))}</button></div>
<details class="options-advanced" id="optionsAdvanced" ${advancedOpen?'open':''}><summary>${esc(text('advanced'))}</summary>
<div class="field-row">${num('extrude',{id:'labExtrude'})}${num('outline',{id:'labOutline'})}</div>
<label class="field inline"><span>${esc(T('outlineColor'))}</span><input data-color="outlineColor" type="color" value="${o.outlineColor}"></label>
${check('defringe',{id:'labDefringe'})}${check('pot',{id:'labPot'})}${check('dedupe',{id:'labDedupe'})}
<p class="hint">${esc(T('nonDestructive'))}</p>
<div class="chips-row"><button type="button" class="mini-button" data-action="lab-frames-zip">${esc(T('downloadFrames'))}</button><button type="button" class="mini-button" data-action="lab-gif">${esc(T('downloadGif'))}</button></div>
<p class="hint">${esc(T('projectNote'))}</p></details></form>`;
  }
  reflect();
 }

 // ---------------------------------------------------------------- detection
 /** A lazy band reader over any canvas (the sheet or the keyed working copy). */
 function canvasSource(canvas){
  const ctx=ctxOf(canvas);
  return {width:canvas.width,height:canvas.height,read(r){const d=ctx.getImageData(r.x,r.y,r.w,r.h);return {data:d.data,width:r.w,height:r.h};}};
 }
 /** The working copy with the key colour made transparent, written band by band so a large
  * sheet never needs a second full RGBA array. The colour is removed everywhere, not only where
  * it touches the border: key pixels between a character's arms are background too. */
 function keyedCanvas(color,tolerance){
  const out=Im.canvas(sheet.width,sheet.height),src=ctxOf(sheet),dst=out.getContext('2d');
  const rows=Math.max(1,Math.floor(1_048_576/sheet.width));
  for(let y=0;y<sheet.height;y+=rows){
   const h=Math.min(rows,sheet.height-y),band=src.getImageData(0,y,sheet.width,h);
   const keyed=applyColorKey({data:band.data,width:band.width,height:h},color,{tolerance});
   dst.putImageData(new ImageData(keyed.data,band.width,h),0,y);
  }
  return out;
 }
 async function prepare(){
  // 'auto' looks for a key colour and applies it only when the evidence is strong ('high');
  // a weaker guess is offered in the panel, never applied behind the person's back.
  if(o.key==='auto')keyInfo=keyInfo||detectColorKey(canvasSource(sheet));
  const useAuto=o.key==='auto'&&keyInfo?.apply&&!keyDeclined;
  const want=o.key==='custom'?`custom|${o.keyColor}|${o.tolerance}`:useAuto?`auto|${keyInfo.color}|${keyInfo.tolerance}`:'none';
  if(workKey===want&&work)return work;
  if(work&&work!==sheet)Im.release(work);
  let color=null,tolerance=o.tolerance;
  if(o.key==='custom')color=rgb(o.keyColor);
  else if(useAuto){color=keyInfo.color;tolerance=keyInfo.tolerance;}
  work=color?keyedCanvas(color,tolerance):sheet;
  // The grid reading depends on which pixels are transparent, so it is redone for a new key.
  if(workKey!==null&&workKey!==want)suggestions=[];
  workKey=want;reader=null;return work;
 }
 function gridSpec(){
  return {cellWidth:Math.max(1,o.cellW),cellHeight:Math.max(1,o.cellH),marginX:o.offsetX,marginY:o.offsetY,
   spacingX:o.spacingX,spacingY:o.spacingY,
   columns:Math.max(1,Math.floor((work.width-o.offsetX+o.spacingX)/(o.cellW+o.spacingX))),
   rows:Math.max(1,Math.floor((work.height-o.offsetY+o.spacingY)/(o.cellH+o.spacingY)))};
 }
 async function detect(){
  if(!sheet)return;
  const gen=++generation;
  abort?.abort();abort=new AbortController();
  const signal=abort.signal;
  busy=true;renderSummary();
  try{
   await prepare();if(gen!==generation)return;
   const s=src();
   // Grid suggestions are read off the sheet once and band by band, so they cost no full copy and
   // are ready even when component labelling refuses the sheet — which is what makes the "too
   // large for Auto" message actionable instead of a dead end.
   if(!suggestions.length){suggestions=detectGridWithColour(s,{custom:[o.cellW,o.cellH],limit:5,signal}).suggestions;await yieldUI();if(gen!==generation)return;}
   let rects;
   islands=null;gridHint=null;
   if(o.mode==='auto'){
    // Band by band with a turn for the page in between, so a 4096² sheet labels with a
    // progress line instead of freezing — and with no megapixel cap below the sheet limit.
    const found=await detectFramesAsync(s,{threshold:o.threshold,minArea:Math.min(o.minArea,s.width*s.height),
     distance:o.autoMerge?'auto':o.merge,signal,pause:yieldUI,
     progress:({done,total})=>{if(gen!==generation)return;progressText=T('labelling',{a:Math.round(done/total*100)});renderSummary();}});
    progressText='';
    if(gen!==generation)return;
    autoMerge=found.auto;
    if(o.autoMerge)o.merge=found.distance;
    rects=found.rects;
    islands={attached:found.attached,unassigned:found.unassigned,unassignedPixels:found.unassignedPixels,
     attachedPixels:found.attached.reduce((sum,a)=>sum+a.island.area,0),smallCount:found.smallCount};
    showIslands=true;
    gridHint=autoVersusGrid(found.rects,suggestions[0]);
   }else{
    const cells=gridCells(gridSpec());
    rects=readingOrder(cells);
    autoMerge=null;
   }
   await yieldUI();if(gen!==generation)return;
   const {frames}=framesFromRects(s,rects,{trim:true,threshold:o.threshold,prefix:prefix()+'_',
    skipEmpty:o.mode!=='grid'||o.skipEmpty});
   past=[];future=[];
   project=P.project({frames,settings:{...o}});
   selected=new Set();animationId='';frameCursor=0;atlasResult=null;invalidate();error='';
  }catch(e){if(e?.name!=='AbortError'){project=P.project();error=e?.message||String(e);}}
  finally{if(gen===generation){busy=false;progressText='';render();}}
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>detect(),90);};

 // ---------------------------------------------------------------- drawing
 function drawSheet(){
  const cv=q('#labCanvas');if(!cv||!work)return;
  if(cv.width!==work.width||cv.height!==work.height){cv.width=work.width;cv.height=work.height;}
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(work,0,0);
  const holder=q('#labSheet');if(holder)holder.style.aspectRatio=`${work.width} / ${work.height}`;
  const info=q('#labInfo');if(info)info.textContent=`${work.width} × ${work.height}`;
 }
 let drag=null;
 function drawOverlay(){
  const svg=q('#labOverlay');if(!svg||!work)return;
  svg.setAttribute('viewBox',`0 0 ${work.width} ${work.height}`);
  const scale=(svg.getBoundingClientRect().width||work.width)/work.width,unit=v=>v/Math.max(.001,scale);
  const live=drag?.rect&&drag.kind!=='move'?drag.rect:null,label=Math.max(7,unit(11));
  let html=project.frames.map((f,i)=>{
   const r=drag?.kind==='move'&&drag.id===f.id?drag.rect:f.sourceRect,on=selected.has(f.id);
   return `<g class="slicer-box ${on?'is-selected':''}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/><text x="${r.x+unit(2)}" y="${r.y+label}" font-size="${label}">${i+1}</text></g>`;
  }).join('');
  if(live)html+=`<rect class="slicer-new" x="${live.x}" y="${live.y}" width="${live.w}" height="${live.h}"/>`;
  if(showIslands&&o.mode==='auto'&&islands?.unassigned?.length){
   const pad=unit(2);
   html+=islands.unassigned.slice(0,2000).map(r=>`<rect class="lab-island" x="${r.x-pad}" y="${r.y-pad}" width="${r.w+pad*2}" height="${r.h+pad*2}"/>`).join('');
  }
  if(selected.size===1&&!drag){
   const f=currentFrame();
   if(f)html+=HANDLES.map(([name,fx,fy])=>{const s=unit(9);return `<rect class="slicer-handle" data-handle="${name}" x="${f.sourceRect.x+f.sourceRect.w*fx-s/2}" y="${f.sourceRect.y+f.sourceRect.h*fy-s/2}" width="${s}" height="${s}"/>`;}).join('');
  }
  svg.innerHTML=html;
 }
 function drawChips(){
  const host=q('#labStrip');if(!host||!work)return;
  // The strip is rebuilt on every render, so keyboard focus is put back on the same chip.
  const focused=host.contains(document.activeElement)?document.activeElement.closest('.frame-chip')?.dataset.id:null;
  host.innerHTML=stripHTML();
  if(focused)host.querySelector(`.frame-chip[data-id="${focused}"]`)?.focus({preventScroll:true});
  for(const cv of host.querySelectorAll('canvas[data-chip]')){
   const f=frameById(cv.dataset.chip);if(!f)continue;
   const b=innerRect(f),s=Math.min(1,56/Math.max(b.w,b.h));
   cv.width=Math.max(1,Math.round(b.w*s));cv.height=Math.max(1,Math.round(b.h*s));
   const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(work,b.x,b.y,b.w,b.h,0,0,cv.width,cv.height);
  }
  const count=q('#labCount');
  if(count)count.textContent=T('frameCount',{n:project.frames.length})+(selected.size?' · '+T('selectedN',{n:selected.size}):'');
  for(const [id,off] of [['labMergeButton',selected.size<2],['labRemoveButton',!selected.size]]){const b=q('#'+id);if(b)b.disabled=off;}
 }
 /** Defect fixed: the preview fits the frame instead of drawing a 12px sprite in a 300px box.
  * Integer zoom only, nearest-neighbour, on the chosen background. */
 function fitCanvas(cv,width,height){
  const hold=cv.parentElement,boxW=hold.clientWidth||320,boxH=hold.clientHeight||240;
  const want=o.zoom?Number(o.zoom):Math.max(1,Math.floor(Math.min(boxW/Math.max(1,width),boxH/Math.max(1,height))));
  const scale=Math.max(1,Math.min(32,want));
  if(cv.width!==width||cv.height!==height){cv.width=width;cv.height=height;}
  cv.style.width=`${width*scale}px`;cv.style.height=`${height*scale}px`;
  return scale;
 }
 function paintFrameTo(ctx,frame,{alpha=1}={}){
  const b=innerRect(frame);
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  if(frame.metadata?.mirroredFrom){ctx.translate(frame.offsetX+b.w,0);ctx.scale(-1,1);ctx.drawImage(work,b.x,b.y,b.w,b.h,0,frame.offsetY,b.w,b.h);}
  else ctx.drawImage(work,b.x,b.y,b.w,b.h,frame.offsetX,frame.offsetY,b.w,b.h);
  ctx.restore();
 }
 /** One frame's own canvas as RGBA, *including* the horizontal flip of a mirrored frame. The
  * engine's `canvasImage` cannot do this — it only copies a rectangle — and a mirrored frame is
  * exactly a frame whose metadata is already flipped while its source pixels are not. Everything
  * that turns a frame into pixels (preview, GIF, frame PNGs, the export sheet) goes through here or
  * through `paintFrameTo`, so none of them can disagree. */
 function frameImage(f){
  const c=Im.canvas(f.canvasWidth,f.canvasHeight),ctx=c.getContext('2d',{willReadFrequently:true});
  try{paintFrameTo(ctx,f);const d=ctx.getImageData(0,0,f.canvasWidth,f.canvasHeight);return {data:d.data,width:d.width,height:d.height};}
  finally{Im.release(c);}
 }
 const isMirrored=f=>!!f.metadata?.mirroredFrom;
 const sharedCanvas=()=>project.frames.length>1&&project.frames.every(f=>f.canvasWidth===project.frames[0].canvasWidth&&f.canvasHeight===project.frames[0].canvasHeight);
 function drawAnimation(){
  const cv=q('#labAnim');if(!cv||!work)return;
  const list=fixPreview?fixPreview.project:project,a=animation();
  const play=P.playback(list,a&&P.animationOf(list,a.id)?P.animationOf(list,a.id):a);
  const step=play.length?P.stepAt(play,clock):null,frame=step?.frame||currentFrame();
  if(!frame){cv.width=cv.height=1;return;}
  const ctx=cv.getContext('2d');
  fitCanvas(cv,frame.canvasWidth,frame.canvasHeight);
  ctx.clearRect(0,0,cv.width,cv.height);
  if(diffView&&play.length>1){
   const other=play[(step.step+1)%play.length].frame;
   const diff=frameDifference(src(),frame,other,{mode:'rgba',amplify:2});
   paintFrameTo(ctx,frame,{alpha:.35});
   const tmp=new ImageData(diff.data,diff.width,diff.height);
   const buffer=Im.canvas(diff.width,diff.height);
   try{buffer.getContext('2d').putImageData(tmp,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(buffer,0,0);}finally{Im.release(buffer);}
  }else{
   // Onion skin over the *playback* list, so a ping-pong shows the frames that really play next.
   for(let k=o.onionBefore;k>=1;k--){const prev=play[step.step-k];if(prev)paintFrameTo(ctx,prev.frame,{alpha:.5*.5**(k-1)});}
   for(let k=1;k<=o.onionAfter;k++){const nxt=play[step.step+k];if(nxt)paintFrameTo(ctx,nxt.frame,{alpha:.5*.5**(k-1)});}
   paintFrameTo(ctx,frame);
  }
  const info=q('#labPlayInfo');
  if(info)info.textContent=play.length?`${(step.step+1)}/${play.length} · ${frame.canvasWidth}×${frame.canvasHeight}`:'';
  const button=q('#labPlay');if(button)button.textContent=playing?'❚❚':'▶';
 }
 function drawNormalize(){
  const before=q('#labBefore'),after=q('#labAfter');if(!before||!work)return;
  const list=project.frames.slice(0,48);
  const cell=(f,i)=>`<figure class="norm-cell"><div class="norm-hold"><canvas data-norm="${i}"></canvas></div><figcaption>${esc(f.name)} ${f.canvasWidth}×${f.canvasHeight}</figcaption></figure>`;
  before.innerHTML=list.map(cell).join('');
  const out=normalizePreview;
  after.innerHTML=out?out.frames.slice(0,48).map((f,i)=>`<figure class="norm-cell"><div class="norm-hold"><canvas data-normafter="${i}"></canvas></div><figcaption>${esc(f.name)} ${f.canvasWidth}×${f.canvasHeight}</figcaption></figure>`).join(''):'';
  const paint=(nodes,frames)=>nodes.forEach((cv,i)=>{
   const f=frames[i];if(!f)return;
   cv.width=f.canvasWidth;cv.height=f.canvasHeight;paintFrameTo(cv.getContext('2d'),f);
  });
  paint([...before.querySelectorAll('[data-norm]')],list);
  if(out)paint([...after.querySelectorAll('[data-normafter]')],out.frames);
  const size=q('#labNormSize');
  if(size)size.textContent=out?T('normalized',{w:out.canvasWidth,h:out.canvasHeight}):'';
  const note=q('#labNormNote');
  if(note)note.textContent=out?.warnings?.length?out.warnings.join(' '):T('sizeHint');
 }
 /** The pivot crosshair, the boxes and the collision outline, all in frame-canvas pixels. */
 function drawFrameStage(){
  const cv=q('#labFrame'),svg=q('#labFrameOverlay');if(!cv||!work)return;
  const f=currentFrame();
  if(!f){cv.width=cv.height=1;if(svg)svg.innerHTML='';return;}
  fitCanvas(cv,f.canvasWidth,f.canvasHeight);
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);paintFrameTo(ctx,f);
  const name=q('#labFrameName');if(name)name.textContent=`${f.name} · ${f.canvasWidth}×${f.canvasHeight}`;
  if(!svg)return;
  svg.setAttribute('viewBox',`0 0 ${f.canvasWidth} ${f.canvasHeight}`);
  const pivot=pivotPixels(f);
  const shapes=f.boxes.map(b=>{
   const cls=`lab-box lab-box-${b.type} ${b.id===boxId?'is-selected':''}`;
   if(b.shape==='rect')return `<rect class="${cls}" data-box-id="${b.id}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>`;
   if(b.shape==='circle')return `<circle class="${cls}" data-box-id="${b.id}" cx="${b.cx}" cy="${b.cy}" r="${b.r}"/>`;
   return `<polygon class="${cls}" data-box-id="${b.id}" points="${b.points.map(p=>p.join(',')).join(' ')}"/>`;
  }).join('');
  const poly=f.collision.map(p=>`<polygon class="lab-collision" points="${p.map(pt=>pt.join(',')).join(' ')}"/>`).join('');
  svg.innerHTML=`<defs>
<pattern id="labPatHit" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0,4 l4,-4" stroke="#f97316" stroke-width="1"/></pattern>
<pattern id="labPatHurt" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0,2 h4 M2,0 v4" stroke="#2563eb" stroke-width=".8"/></pattern>
<pattern id="labPatInteract" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#16a34a"/></pattern>
<pattern id="labPatCustom" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0,2 h4" stroke="#7c3aed" stroke-width=".8"/></pattern></defs>
${poly}${shapes}
<g class="lab-pivot"><line x1="${pivot.x}" y1="0" x2="${pivot.x}" y2="${f.canvasHeight}"/><line x1="0" y1="${pivot.y}" x2="${f.canvasWidth}" y2="${pivot.y}"/><circle cx="${pivot.x}" cy="${pivot.y}" r="1.6"/></g>`;
  for(const input of el.querySelectorAll('[data-pivot]')){
   if(document.activeElement===input)continue;
   input.value=pivotUnit==='pixels'?(input.dataset.pivot==='x'?pivot.x:pivot.y).toFixed(1)
    :(input.dataset.pivot==='x'?f.pivotX:f.pivotY).toFixed(3);
  }
  const list=q('#labBoxList');
  if(list)list.innerHTML=(f.boxes.length?'':`<p class="hint">${esc(T('noBoxes'))}</p>`)+f.boxes.map(b=>`<div class="lab-note ${b.id===boxId?'is-selected':''}" data-action="lab-box-pick" data-id="${b.id}" tabindex="0" role="button"><span class="lab-swatch lab-box-${b.type}" aria-hidden="true"></span><b>${esc(T('boxTypes.'+(P.BOX_KINDS.includes(b.type)?b.type:'custom')))}</b> ${esc(T('shapes.'+b.shape))} ${esc(b.shape==='rect'?`${b.x},${b.y} ${b.w}×${b.h}`:b.shape==='circle'?`${b.cx},${b.cy} r${b.r}`:`${b.points.length}pt`)}<button type="button" class="mini-button" data-action="lab-box-remove" data-id="${b.id}" aria-label="${esc(T('removeBoxLabel'))}" title="${esc(T('removeBoxLabel'))}">×</button></div>`).join('')
   +`<p class="hint" id="labCollisionCount" data-polygons="${f.collision.length}" data-vertices="${f.collision.reduce((s,p)=>s+p.length,0)}">${f.collision.length?`${esc(T('collision'))}: ${f.collision.length} · ${f.collision.reduce((s,p)=>s+p.length,0)}pt`:esc(T('collisionNone'))}</p>`;
 }
 function drawTimeline(){
  const host=q('#labTimeline');if(!host)return;
  const a=animation();
  if(!a){host.innerHTML=`<p class="hint">${esc(T('needAnimation'))}</p>`;return;}
  const tl=P.boxTimeline(project,a);
  host.innerHTML=`<table class="lab-grid"><caption class="sr-only">${esc(T('timeline'))}</caption><thead><tr><th scope="col">${esc(T('boxType'))}</th>${tl.steps.map(s=>`<th scope="col">${s.step+1}</th>`).join('')}</tr></thead><tbody>${
   tl.rows.length?tl.rows.map(row=>`<tr><th scope="row"><span class="lab-swatch lab-box-${row.type}" aria-hidden="true"></span>${esc(T('boxTypes.'+(P.BOX_KINDS.includes(row.type)?row.type:'custom')))}</th>${row.cells.map((n,i)=>`<td class="${n?'on lab-fill-'+row.type:''}" data-action="lab-timeline-cell" data-step="${i}" data-type="${row.type}" tabindex="0" aria-label="${esc(T('boxTypes.'+(P.BOX_KINDS.includes(row.type)?row.type:'custom')))} ${i+1}: ${n}">${n?n:''}</td>`).join('')}</tr>`).join('')
   :`<tr><td colspan="${tl.steps.length+1}" class="hint">${esc(T('addBox'))}</td></tr>`}</tbody></table>`;
 }
 function drawJitter(){
  const graph=q('#labJitterGraph'),value=q('#labJitterValue'),notes=q('#labJitterNotes');if(!graph)return;
  const a=animation();
  if(!jitter&&a&&a.frameIds.length>1){
   try{jitter=jitterReport(src(),project.frames,{reference:o.reference,animation:a});}
   catch(e){jitter={error:e?.message||String(e)};}
  }
  if(!jitter||jitter.error){graph.innerHTML='';if(value)value.textContent='';if(notes)notes.textContent=jitter?.error||T('jitterNone');return;}
  const {series,residual,metrics,warnings}=jitter;
  if(value)value.innerHTML=`<span id="labJitterRms">${esc(T('jitterRms',{n:residual.rms.toFixed(2)}))}</span> · <span id="labJitterMax">${esc(T('jitterMax',{n:residual.max.toFixed(2)}))}</span>`;
  const n=series.x.length,all=[...series.residualX,...series.residualY];
  const span=Math.max(1,Math.max(...all.map(Math.abs))*1.2),W=100,H=40;
  const line=(values,cls)=>`<polyline class="${cls}" points="${values.map((v,i)=>`${(i/(Math.max(1,n-1)))*W},${H/2-(v/span)*(H/2)}`).join(' ')}"/>`;
  graph.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(T('jitter'))}"><line class="lab-axis" x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"/>${line(series.residualX,'lab-series-x')}${line(series.residualY,'lab-series-y')}</svg>
<p class="hint">x — ${esc(T('jitterRms',{n:residual.rmsX.toFixed(2)}))} · y ⋯ ${esc(T('jitterRms',{n:residual.rmsY.toFixed(2)}))} · ${esc(T('jitterMax',{n:metrics.max.toFixed(2)}))}</p>`;
  if(notes)notes.innerHTML=warnings.map(w=>`<p class="summary-line bad">${esc(w)}</p>`).join('');
 }
 function drawAnimationList(){
  const host=q('#labAnimList');if(!host)return;
  const a=animation();
  host.innerHTML=project.animations.length?project.animations.map(x=>`<button type="button" class="chip" data-action="lab-anim-pick" data-id="${x.id}" aria-pressed="${x.id===a?.id}">${esc(x.name)}<small>${P.playback(project,x).length}</small></button>`).join(''):`<span class="hint">${esc(T('needAnimation'))}</span>`;
  const notes=q('#labAnimNotes');
  if(notes){
   const lines=[];
   if(a&&a.frameIds.length>1){
    if(!duplicates)try{duplicates=findDuplicates(src(),project.frames);}catch{duplicates={exact:[],blank:[],almostEmpty:[],near:[]};}
    lines.push(duplicates.exact.length||duplicates.blank.length
     ?`<p class="summary-line">${esc(T('dupFound',{n:duplicates.exact.length,b:duplicates.blank.length}))}</p>`
     :`<p class="summary-line">${esc(T('dupNone'))}</p>`);
    if(!seam)try{seam=loopSeam(src(),project.frames,{animation:a,reference:o.reference});}catch(e){seam={warnings:[e?.message||String(e)]};}
    for(const w of seam.warnings||[])lines.push(`<p class="summary-line bad">${esc(T('loopSeam'))}: ${esc(w)}</p>`);
   }
   lines.push(`<p class="hint">${esc(T('playbackNote'))}</p>`);
   notes.innerHTML=lines.join('');
  }
  const remove=q('#labDupRemove');if(remove)remove.disabled=!duplicates?.exact?.length&&!duplicates?.blank?.length;
  // Aligning frames of different canvas sizes has no meaning, so the button says so before the
  // click rather than after it.
  const shared=sharedCanvas(),fix=q('#labAutoFix'),needs=q('#labFixNeedsCanvas');
  if(fix)fix.disabled=!shared||!a;
  if(needs)needs.hidden=shared||!a;
  const fixBox=q('#labFixBox');
  if(fixBox){
   fixBox.hidden=!fixPreview;
   if(fixPreview)q('#labFixText').textContent=T('fixed',{a:fixPreview.beforeResidual.rms.toFixed(2),b:fixPreview.afterResidual.rms.toFixed(2)});
  }
  const dur=q('#labDuration'),tag=q('#labTag'),f=currentFrame();
  if(dur&&document.activeElement!==dur)dur.value=f?.duration??'';
  if(tag&&document.activeElement!==tag)tag.value=f?.tag||'';
 }
 function drawAtlas(){
  const cv=q('#labAtlasCanvas'),info=q('#labAtlasInfo'),pages=q('#labPages'),hold=q('#labAtlasStage');if(!cv)return;
  if(hold)hold.classList.toggle('is-packed',!!atlasResult);
  if(!atlasResult){cv.width=cv.height=1;if(info)info.textContent='';if(pages)pages.innerHTML=`<p class="hint">${esc(T('needPack'))}</p>`;return;}
  const {atlas,result,source}=atlasResult;
  const page=blitPage(source,result.frames,atlas,0);
  cv.width=page.width;cv.height=page.height;
  cv.getContext('2d').putImageData(new ImageData(page.data,page.width,page.height),0,0);
  const holder=cv.parentElement;holder.style.aspectRatio=`${page.width} / ${page.height}`;
  if(info)info.textContent=`${page.width} × ${page.height} · ${T('pages',{n:atlas.pages})} · ${T('efficiency',{n:Math.round(result.efficiency*100)})}`;
  if(pages)pages.innerHTML=result.pages.map(p=>`<p class="summary-line">${esc(T('pageLine',{i:p.index+1,w:p.width,h:p.height,n:Math.round(p.efficiency*100)}))}</p>`).join('')
   +(Object.keys(result.aliases).length?`<p class="summary-line">${esc(T('aliased',{n:Object.keys(result.aliases).length}))}</p>`:'')
   +result.warnings.map(w=>`<p class="summary-line">${esc(w)}</p>`).join('');
  drawEdgeZoom();
 }
 /** Outline and de-fringe are export-time only, so the only honest way to show them is the edges
  * of one real frame, before and after, at a zoom where a one-pixel change is visible. */
 function drawEdgeZoom(){
  const row=q('#labEdgeZoomRow');if(!row)return;
  const want=o.outline>0||o.defringe,f=currentFrame();
  row.hidden=!want||!f;
  if(row.hidden)return;
  const original=frameImage(f),processed=processFrameImage(original);
  for(const [id,img] of [['#labEdgeBefore',original],['#labEdgeAfter',{data:processed.data,width:processed.width,height:processed.height}]]){
   const cv=q(id);if(!cv)continue;
   cv.width=img.width;cv.height=img.height;
   cv.getContext('2d').putImageData(new ImageData(img.data,img.width,img.height),0,0);
   const scale=Math.max(1,Math.min(12,Math.floor(240/Math.max(img.width,img.height))));
   cv.style.width=`${img.width*scale}px`;cv.style.height=`${img.height*scale}px`;
  }
 }
 function renderSummary(){
  const box=q('#labSummary'),button=q('#taskDownload');if(!box||!button)return;
  const count=project.frames.length;
  const problems=count?P.problems(project):[];
  const lines=[];
  if(stage==='animate'&&animation())lines.push(`${animation().name} · ${P.playback(project,animation()).length} · ${animation().fps}fps`);
  if(stage==='export'&&atlasResult)lines.push(`${atlasResult.atlas.width}×${atlasResult.atlas.height} · ${T('efficiency',{n:Math.round(atlasResult.result.efficiency*100)})}`);
  box.classList.toggle('is-error',!!error&&!busy);
  box.classList.toggle('warn',!error&&!busy&&!!islands?.unassigned?.length&&stage==='slice');
  box.innerHTML=error?`<div class="summary-big">!</div><div class="summary-line"><b>${esc(T('errorTitle'))}</b> · ${esc(error)}</div>`
   :busy?`<div class="summary-big muted">…</div><div class="summary-line">${esc(progressText||T('working'))}</div>`
   :`<div class="summary-big">${esc(T('frameCount',{n:count}))}</div>${lines.map(l=>`<div class="summary-line">${esc(l)}</div>`).join('')}${problems.map(p=>`<div class="summary-line bad">${esc(p)}</div>`).join('')}`;
  const label={slice:T('stages.normalize'),normalize:T('runNormalize'),animate:T('stages.boxes'),boxes:T('stages.export'),
   export:T('download',{f:T('targets2.'+o.target)})}[stage];
  button.textContent=count?label:T('none');
  button.disabled=busy||!count||!!error||(stage==='export'&&!atlasResult);
  for(const [id,off] of [['labUndo',!past.length],['labRedo',!future.length]]){const b=q('#'+id);if(b)b.disabled=off;}
  const note=q('#labTargetNote');
  if(note){note.textContent=o.target==='unity'?T('unityNote'):o.target==='godot'?T('godotNote'):'';note.classList.toggle('bad',o.target==='unity');}
 }
 function renderSuggest(){
  const host=q('#labSuggest');if(!host)return;
  host.innerHTML=suggestions.length?suggestions.map((s,i)=>
   `<button type="button" class="chip" data-action="lab-suggest" data-index="${i}" title="${esc(s.reasons.join('\n'))}" aria-describedby="labSuggestReason${i}">${s.cellWidth}×${s.cellHeight}${s.marginX||s.marginY?` m${s.marginX}`:''}${s.spacingX||s.spacingY?` s${s.spacingX}`:''}<small>${esc(text('confidence.'+s.confidence))} ${Math.round(s.score*100)}%${s.source==='colour'?' · '+esc(T('gridColour')):''}</small><span class="sr-only" id="labSuggestReason${i}">${esc(s.reasons.join('. '))}</span></button>`).join('')
   :`<span class="hint">${esc(T('noSuggestion'))}</span>`;
 }
 function renderRect(){
  const host=q('#labRect');if(!host)return;
  const one=selected.size===1?currentFrame():null;
  host.hidden=!one;
  if(!one||host.contains(document.activeElement))return;
  for(const input of host.querySelectorAll('[data-rect]'))input.value=one.sourceRect[input.dataset.rect];
 }
 /** What the automatic steps did, with the way back: the background key, small islands that
  * were attached or left over, and a grid when Auto's islands are frames that touch. */
 function renderAssist(){
  const host=q('#labAssist');if(!host)return;
  const parts=[],conf=c=>text('confidence.'+c);
  if(keyInfo&&o.key==='auto'){
   const swatch=`<span class="lab-swatch lab-key-swatch" style="background:${esc(keyHex(keyInfo.color))}" aria-hidden="true"></span>`;
   const why=`<details class="lab-why"><summary>${esc(T('keyWhy'))}</summary><ul>${keyInfo.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></details>`;
   if(keyInfo.apply&&!keyDeclined)parts.push(`<div class="lab-assist-line" id="labKeyNote" data-key="${esc(keyHex(keyInfo.color))}" data-confidence="${keyInfo.confidence}" data-applied="true">${swatch}<span>${esc(T('keyApplied',{hex:keyHex(keyInfo.color),conf:conf(keyInfo.confidence)}))}</span><button type="button" class="mini-button" data-action="lab-key-off">${esc(T('keyOff'))}</button>${why}</div>`);
   else if(keyInfo.confidence!=='low'||keyDeclined)parts.push(`<div class="lab-assist-line" id="labKeyNote" data-key="${esc(keyHex(keyInfo.color))}" data-confidence="${keyInfo.confidence}" data-applied="false">${swatch}<span>${esc(T('keySuggest',{hex:keyHex(keyInfo.color),conf:conf(keyInfo.confidence)}))}</span><button type="button" class="mini-button" data-action="lab-key-use">${esc(T('keyUse'))}</button>${why}</div>`);
  }
  if(o.mode==='auto'&&islands){
   if(islands.attached.length)parts.push(`<div class="lab-assist-line" id="labIslandsAttached" data-n="${islands.attached.length}" data-px="${islands.attachedPixels}"><span>${esc(T('islandsAttached',{n:islands.attached.length,px:islands.attachedPixels}))}</span></div>`);
   if(islands.unassignedPixels>0)parts.push(`<div class="lab-assist-line bad" id="labIslandsUnassigned" data-n="${islands.unassigned.length}" data-px="${islands.unassignedPixels}"><span>${esc(T('islandsUnassigned',{n:islands.unassigned.length,px:islands.unassignedPixels}))}</span>
<button type="button" class="mini-button" data-action="lab-islands-toggle" aria-pressed="${showIslands}">${esc(showIslands?T('islandsHide'):T('islandsShow'))}</button><button type="button" class="mini-button" data-action="lab-islands-attach">${esc(T('islandsAttach'))}</button><button type="button" class="mini-button" data-action="lab-islands-add">${esc(T('islandsAdd'))}</button></div>`);
  }
  if(o.mode==='auto'&&gridHint?.recommend)parts.push(`<div class="lab-assist-line" id="labGridHint" data-grid="${gridHint.gridFrames}"><span>${esc(T('gridHint',{auto:gridHint.autoFrames,w:gridHint.cell.w,h:gridHint.cell.h,grid:gridHint.gridFrames,conf:conf(suggestions[0]?.confidence||'low')}))}</span><button type="button" class="mini-button" data-action="lab-suggest" data-index="0">${esc(T('useGrid'))}</button></div>`);
  host.innerHTML=parts.join('');host.hidden=!parts.length;
 }
 function reflect(){
  const show=(sel,on)=>{const n=q(sel);if(n)n.hidden=!on;};
  show('#labAuto',o.mode==='auto');show('#labGrid',o.mode==='grid');
  show('#labAutoAdvanced',o.mode==='auto');show('#labGridAdvanced',o.mode==='grid');
  show('#labKeyFields',o.key==='custom');show('#labToleranceField',o.key!=='none');
  show('#labCanvasFields',o.canvas==='exact');
  show('#labBoxRect',box.shape==='rect');show('#labBoxCircle',box.shape==='circle');
  const merge=q('#labMerge');if(merge)merge.disabled=o.autoMerge;
  const reason=q('#labMergeReason');
  if(reason)reason.textContent=o.mode==='auto'&&autoMerge?.reasonCode?`${T('mergeChosen',{n:o.merge})} — ${T('mergeWhy.'+autoMerge.reasonCode,{frames:autoMerge.frames,pct:Math.round((autoMerge.consistency||0)*100),until:autoMerge.until??''})}`:'';
  renderAssist();
  const out=q('#labMergeOut');if(out)out.textContent=o.merge;
 }
 function render(){
  if(!sheet){empty();return;}
  if(!q('#labStages'))shellMarkup();
  for(const b of el.querySelectorAll('[data-action="lab-stage"]'))b.setAttribute('aria-pressed',String(b.dataset.stage===stage));
  if(stage==='slice'){drawSheet();drawOverlay();drawChips();renderRect();renderSuggest();}
  else if(stage==='normalize'){if(!normalizePreview)computeNormalize();drawNormalize();}
  else if(stage==='animate'){ensureAnimation();drawChips();drawAnimationList();drawJitter();drawAnimation();}
  else if(stage==='boxes'){ensureAnimation();drawChips();drawFrameStage();drawTimeline();}
  else drawAtlas();
  reflect();renderSummary();
 }
 function animate(now){
  raf=requestAnimationFrame(animate);
  if(stage!=='animate'||!work)return;
  if(playing){clock+=Math.min(200,now-(lastFrameTime||now));}
  lastFrameTime=now;
  drawAnimation();
 }

 // ---------------------------------------------------------------- stage actions
 function computeNormalize(){
  if(!project.frames.length){normalizePreview=null;return;}
  try{
   normalizePreview=normalizeFrames(project.frames,{align:o.align,padding:o.padding,
    ...(o.canvas==='exact'?{width:o.canvasW,height:o.canvasH}:{})});
   error='';
  }catch(e){normalizePreview=null;error=e?.message||String(e);}
 }
 function applyNormalize(){
  computeNormalize();
  if(!normalizePreview)return;
  commit(P.setFrames(project,normalizePreview.frames));
  toast(T('normalized',{w:normalizePreview.canvasWidth,h:normalizePreview.canvasHeight}));
 }
 function newAnimation(){
  const ids=selected.size?project.frames.filter(f=>selected.has(f.id)).map(f=>f.id):project.frames.map(f=>f.id);
  if(!ids.length)return;
  const next=P.addAnimation(project,{name:P.TAGS[project.animations.length%P.TAGS.length],frameIds:ids,fps:o.fps,direction:o.direction});
  animationId=next.animations[next.animations.length-1].id;
  commit(next);
 }
 /** The Animate stage is useless without an animation, and "every frame in strip order at the
  * chosen fps" is the animation a sliced sheet already is. It is a normal animation from there:
  * renameable, splittable, deletable. */
 function ensureAnimation(){
  if(project.animations.length||!project.frames.length)return;
  project=P.addAnimation(project,{name:P.TAGS[0],frameIds:project.frames.map(f=>f.id),fps:o.fps,direction:o.direction});
  animationId=project.animations[0].id;
 }
 function autoFix(){
  const a=animation();
  if(!a){toast(T('needAnimation'),{error:true});return;}
  try{
   const out=autoFixJitter(src(),project.frames,{reference:o.reference,preserveTrend:o.preserveTrend,animation:a});
   fixPreview={...out,project:P.setFrames(project,out.frames)};
   for(const w of out.warnings.slice(0,1))toast(w);
   render();
  }catch(e){toast(e?.message||String(e),{error:true});}
 }
 function generateCollision(){
  const ids=targetIds(selected.size?'selected':'all');
  if(!ids.length)return;
  const byFrame=new Map();let traced=0,simple=0,dev=0,area=0,shapes=0;
  for(const id of ids){
   const f=frameById(id);if(!f)continue;
   const out=frameCollision(src(),f,{shape:o.collisionShape,threshold:o.collisionThreshold,
    tolerance:o.collisionTolerance,maxVertices:o.collisionVertices,padding:o.collisionPadding});
   const polygons=out.polygons.length?out.polygons.map(p=>p.points)
    :out.circle?[circlePolygon(out.circle)]:out.rect?[rectPolygon(out.rect)]:[];
   byFrame.set(id,polygons);
   for(const p of out.polygons){traced+=p.tracedVertices;simple+=p.vertices;shapes++;}
   if(out.error){dev=Math.max(dev,out.error.maxDeviation);area=Math.max(area,Math.abs(out.error.areaDeltaPercent));}
  }
  commit(P.setFrameCollision(project,byFrame));
  const node=q('#labCollisionResult');
  if(node)node.textContent=shapes?T('collisionResult',{traced,simple,dev:dev.toFixed(2),area:area.toFixed(1)}):T('collisionNone');
 }
 const circlePolygon=c=>Array.from({length:16},(_,i)=>{const a=i/16*Math.PI*2;return [c.cx+Math.cos(a)*c.r,c.cy+Math.sin(a)*c.r];});
 const rectPolygon=r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
 function boxSpec(){
  return box.shape==='rect'?{type:box.type,shape:'rect',x:box.x,y:box.y,w:Math.max(1,box.w),h:Math.max(1,box.h)}
   :box.shape==='circle'?{type:box.type,shape:'circle',cx:box.cx,cy:box.cy,r:Math.max(1,box.r)}
   :{type:box.type,shape:'polygon',points:rectPolygon({x:box.x,y:box.y,w:Math.max(3,box.w),h:Math.max(3,box.h)})};
 }

 // ---------------------------------------------------------------- packing and export
 /** Outline and de-fringe are non-destructive: they are applied to a copy of the frame's pixels at
  * export time only, and only then does the export sheet exist. */
 function processFrameImage(img){
  let out={data:img.data,width:img.width,height:img.height,offsetX:0,offsetY:0};
  if(o.defringe){const d=defringe(out,{radius:2});out={...out,data:d.data};}
  if(o.outline>0){
   const grown=outline(out,{radius:o.outline,colour:[...rgb(o.outlineColor),255],expand:true});
   out={data:grown.data,width:grown.width,height:grown.height,offsetX:grown.offsetX,offsetY:grown.offsetY};
  }
  return out;
 }
 /** When outline, de-fringe or a mirrored frame is involved, packing needs pixels that do not exist
  * on the sheet. One extra sheet is built — frames side by side in a bounded grid — and the frames
  * are re-pointed at it, with pivots, boxes and collision moved by the same integer offset.
  * Nothing is resampled. Without any of those, the sheet itself is the source and no copy is made. */
 function exportSource(){
  if(!o.outline&&!o.defringe&&!project.frames.some(isMirrored))return {source:src(),frames:project.frames,release:()=>{}};
  const images=project.frames.map(f=>processFrameImage(frameImage(f)));
  const cellW=Math.max(...images.map(i=>i.width)),cellH=Math.max(...images.map(i=>i.height));
  const columns=Math.max(1,Math.min(images.length,Math.floor(4096/cellW)||1));
  const rows=Math.ceil(images.length/columns),width=columns*cellW,height=rows*cellH;
  if(width*height>EXPORT_PIXELS)throw Error(`An outlined export would need a ${width}×${height} working sheet. Lower the outline width or pack fewer frames.`);
  const canvas=Im.canvas(width,height),ctx=canvas.getContext('2d');
  const frames=project.frames.map((f,i)=>{
   const img=images[i],col=i%columns,row=Math.floor(i/columns),x=col*cellW,y=row*cellH;
   ctx.putImageData(new ImageData(img.data,img.width,img.height),x,y);
   const dx=-(img.offsetX||0),dy=-(img.offsetY||0);
   return {...f,sourceRect:{x,y,w:img.width,h:img.height},trimmedRect:null,
    canvasWidth:img.width,canvasHeight:img.height,offsetX:0,offsetY:0,
    pivotX:(pivotPixels(f).x+dx)/img.width,pivotY:(pivotPixels(f).y+dy)/img.height,
    boxes:f.boxes.map(b=>b.shape==='rect'?{...b,x:b.x+dx,y:b.y+dy}:b.shape==='circle'?{...b,cx:b.cx+dx,cy:b.cy+dy}:{...b,points:b.points.map(([px,py])=>[px+dx,py+dy])}),
    collision:f.collision.map(p=>p.map(([px,py])=>[px+dx,py+dy]))};
  });
  const ctx2=canvas.getContext('2d',{willReadFrequently:true});
  return {source:{width,height,read(r){const d=ctx2.getImageData(r.x,r.y,r.w,r.h);return {data:d.data,width:r.w,height:r.h};}},
   frames,release:()=>Im.release(canvas)};
 }
 function pack(){
  if(!project.frames.length)return;
  const prepared=exportSource();
  try{
   const result=packFrames(prepared.source,prepared.frames,{maxSize:o.maxSize,padding:o.atlasPadding,
    extrude:o.extrude,pot:o.pot,dedupe:o.dedupe});
   atlasResult={atlas:result.atlas,result:{...result,frames:prepared.frames},source:prepared.source,release:prepared.release};
   project={...project,atlas:result.atlas};
   error='';
  }catch(e){atlasResult=null;prepared.release();error=e?.message||String(e);}
  render();
 }
 const bundleOf=data=>o.target==='godot'?godotBundle(data):o.target==='unity'?unityBundle(data):genericBundle(data);
 async function pageBlob(source,frames,atlas,index){
  const page=blitPage(source,frames,atlas,index);
  const c=Im.canvas(page.width,page.height);
  try{c.getContext('2d').putImageData(new ImageData(page.data,page.width,page.height),0,0);return await Im.blobOf(c);}
  finally{Im.release(c);}
 }
 async function exportBundle(){
  if(!atlasResult){pack();if(!atlasResult)return;}
  const {atlas,result,source}=atlasResult;
  const data={frames:result.frames,animations:project.animations,atlas};
  const files=bundleOf(data),entries=[];
  const names=atlas.pages===1?['atlas.png']:Array.from({length:atlas.pages},(_,i)=>`atlas-${i}.png`);
  for(let i=0;i<atlas.pages;i++){entries.push({name:names[i],blob:await pageBlob(source,result.frames,atlas,i)});await yieldUI();}
  for(const file of files)entries.push({name:file.name,blob:new Blob([file.text],{type:file.type})});
  const blob=await zip(entries,{paths:true});
  download(blob,`${prefix()}-${o.target}.zip`);
  track('tool_success',{intent:route.id});
  toast(T('done',{size:bytes(blob.size)}));
 }
 async function framesZip(){
  const entries=[];
  for(let i=0;i<project.frames.length;i++){
   const f=project.frames[i],c=Im.canvas(f.canvasWidth,f.canvasHeight);
   try{paintFrameTo(c.getContext('2d'),f);entries.push({name:`${f.name||'frame'}.png`,blob:await Im.blobOf(c)});}finally{Im.release(c);}
   if(i%8===7)await yieldUI();
  }
  download(await zip(entries),`${prefix()}-frames.zip`);
 }
 async function gifExport(){
  const a=animation();
  const play=a?P.playback(project,a):project.frames.map((f,step)=>({step,frame:f,duration:1000/o.fps}));
  if(!play.length)return;
  const width=Math.max(...play.map(s=>s.frame.canvasWidth)),height=Math.max(...play.map(s=>s.frame.canvasHeight));
  if(width*height*play.length>GIF_PIXELS)throw Error(T('gifTooBig'));
  const c=Im.canvas(width,height),ctx=c.getContext('2d');
  try{
   const buffers=play.map(s=>{ctx.clearRect(0,0,width,height);paintFrameTo(ctx,s.frame);return ctx.getImageData(0,0,width,height).data;});
   const delay=Math.round(play.reduce((sum,s)=>sum+s.duration,0)/play.length);
   download(new Blob([gif(buffers,width,height,delay,{transparent:true})],{type:'image/gif'}),`${prefix()}.gif`);
  }finally{Im.release(c);}
 }
 /** Hands the sheet and the frames cut so far to the Studio (/game/studio/) — in this browser only,
  * through the same IndexedDB hand-off the other pages use; nothing is uploaded. */
 async function openStudio(){
  if(!sourceFile)return;
  const frames=project.frames.map(f=>({name:f.name,sourceRect:f.sourceRect,pivotX:f.pivotX,pivotY:f.pivotY,duration:f.duration,tag:f.tag}));
  await stashFiles([sourceFile],{from:'sprite-lab',frames});track('related_tool_click',{target_intent:'studio'});
  location.assign(new URL(pagePrefix()+'game/studio/',root).href);
 }
 function saveProject(){
  const data=P.projectFile({...project,settings:{...o}},{sheetWidth:work.width,sheetHeight:work.height,sheetName:sourceName});
  download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`${prefix()}-project.json`);
 }
 async function loadProject(file){
  try{
   const loaded=P.readProjectFile(JSON.parse(await file.text()),{sheetWidth:work.width,sheetHeight:work.height});
   o={...o,...P.settingsFromQuery(new URLSearchParams(Object.entries(loaded.settings||{}).map(([k,v])=>[k,String(v)])),o)};
   commit(loaded);shellMarkup();render();
  }catch(e){toast(e?.message||String(e),{error:true});}
 }
 function shareSettings(){
  const url=new URL(location.href);url.search=P.settingsQuery({...o},DEFAULTS);
  navigator.clipboard?.writeText(url.href).then(()=>toast(T('shared')),()=>toast(url.href));
 }

 // ---------------------------------------------------------------- slice editing
 const inside=(r,p)=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
 const clampRect=r=>{
  const x=Math.max(0,Math.min(work.width-1,Math.round(r.x))),y=Math.max(0,Math.min(work.height-1,Math.round(r.y)));
  return {x,y,w:Math.max(1,Math.min(work.width-x,Math.round(r.w))),h:Math.max(1,Math.min(work.height-y,Math.round(r.h)))};
 };
 function stagePoint(e,svg){
  const r=svg.getBoundingClientRect(),scale=r.width/work.width;
  return {x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale,scale};
 }
 function setRects(patches){
  const s=src(),rects=project.frames.map(f=>patches.get(f.id)||f.sourceRect);
  const {frames}=framesFromRects(s,rects,{trim:true,threshold:o.threshold,skipEmpty:false,
   names:project.frames.map(f=>f.name)});
  const merged=frames.map((f,i)=>{const old=project.frames[i];
   return {...f,id:old.id,pivotX:old.pivotX,pivotY:old.pivotY,duration:old.duration,tag:old.tag,boxes:old.boxes,collision:old.collision};});
  commit({...project,frames:merged,atlas:null});
 }
 function pointerDown(e){
  const svg=q('#labOverlay');
  if(e.button||!work||!svg||!e.target.closest('#labOverlay'))return;
  svg.focus({preventScroll:true});
  const p=stagePoint(e,svg),grab=9/p.scale,only=selected.size===1?currentFrame():null;
  const handle=only&&HANDLES.find(([,fx,fy])=>Math.abs(p.x-(only.sourceRect.x+only.sourceRect.w*fx))<=grab&&Math.abs(p.y-(only.sourceRect.y+only.sourceRect.h*fy))<=grab);
  svg.setPointerCapture(e.pointerId);e.preventDefault();
  if(handle){drag={kind:'resize',id:only.id,handle:handle[0],start:{...only.sourceRect},rect:{...only.sourceRect}};return;}
  const hit=[...project.frames].reverse().find(f=>inside(f.sourceRect,p));
  if(hit){
   if(e.shiftKey||e.ctrlKey||e.metaKey)select(hit.id,e);
   else if(!selected.has(hit.id)||selected.size>1){selected=new Set([hit.id]);anchorId=hit.id;}
   drag={kind:'move',id:hit.id,from:p,start:{...hit.sourceRect},rect:{...hit.sourceRect}};
   drawOverlay();drawChips();renderRect();return;
  }
  selected=new Set();drag={kind:'new',from:p,rect:{x:Math.round(p.x),y:Math.round(p.y),w:1,h:1}};
  drawOverlay();drawChips();renderRect();
 }
 function pointerMove(e){
  if(!drag)return;
  const svg=q('#labOverlay');if(!svg)return;
  const p=stagePoint(e,svg);
  if(drag.kind==='resize'){
   const r={...drag.start},right=r.x+r.w,bottom=r.y+r.h,x=Math.round(p.x),y=Math.round(p.y);
   if(drag.handle.includes('w')){r.x=Math.min(right-1,Math.max(0,x));r.w=right-r.x;}
   if(drag.handle.includes('e'))r.w=Math.max(1,Math.min(work.width,x)-r.x);
   if(drag.handle.includes('n')){r.y=Math.min(bottom-1,Math.max(0,y));r.h=bottom-r.y;}
   if(drag.handle.includes('s'))r.h=Math.max(1,Math.min(work.height,y)-r.y);
   drag.rect=clampRect(r);
  }else if(drag.kind==='move'){
   const dx=Math.round(p.x-drag.from.x),dy=Math.round(p.y-drag.from.y);
   if(dx||dy)drag.moved=true;
   drag.rect=clampRect({...drag.start,x:Math.max(0,Math.min(work.width-drag.start.w,drag.start.x+dx)),y:Math.max(0,Math.min(work.height-drag.start.h,drag.start.y+dy))});
  }else drag.rect=clampRect({x:Math.min(drag.from.x,p.x),y:Math.min(drag.from.y,p.y),w:Math.abs(p.x-drag.from.x)||1,h:Math.abs(p.y-drag.from.y)||1});
  drawOverlay();
 }
 function pointerUp(){
  const d=drag;drag=null;if(!d||!work)return;
  if(d.kind==='new'){
   if(d.rect.w<3||d.rect.h<3){drawOverlay();return;}
   const s=src(),{frames}=framesFromRects(s,[d.rect],{trim:true,threshold:o.threshold,skipEmpty:false,prefix:prefix()+'_new_'});
   selected=new Set([frames[0].id]);
   commit({...project,frames:[...project.frames,frames[0]]});
   return;
  }
  if(d.kind==='move'&&!d.moved){drawOverlay();drawChips();return;}
  setRects(new Map([[d.id,d.rect]]));
 }
 function editRect(patch){
  const one=selected.size===1?currentFrame():null;if(!one)return;
  setRects(new Map([[one.id,clampRect({...one.sourceRect,...patch})]]));
 }
 function mergeSelected(){
  if(selected.size<2)return;
  const ids=[...selected],rect=unionRect(ids.map(id=>frameById(id).sourceRect));
  const s=src(),{frames}=framesFromRects(s,[rect],{trim:true,threshold:o.threshold,skipEmpty:false,names:[frameById(ids[0]).name]});
  const first=project.frames.findIndex(f=>selected.has(f.id));
  const kept=project.frames.filter(f=>!selected.has(f.id));
  kept.splice(Math.max(0,project.frames.slice(0,first).filter(f=>!selected.has(f.id)).length),0,frames[0]);
  selected=new Set([frames[0].id]);
  commit(P.setFrames(project,kept));
 }
 function orderFrames(){
  const rects=readingOrder(project.frames.map(f=>({...f.sourceRect,id:f.id})));
  commit(P.reorderFrames(project,rects.map(r=>r.id)));
 }

 /** Selection the way every editor does it: a plain click selects one, Shift+click selects the
  * range from the last plainly clicked frame (strip order), Ctrl/⌘+click adds or removes one. */
 function select(id,e){
  const ids=project.frames.map(f=>f.id);
  if(e.shiftKey&&anchorId&&ids.includes(anchorId)){
   const a=ids.indexOf(anchorId),b=ids.indexOf(id),range=ids.slice(Math.min(a,b),Math.max(a,b)+1);
   selected=e.ctrlKey||e.metaKey?new Set([...selected,...range]):new Set(range);
  }else if(e.ctrlKey||e.metaKey){selected.has(id)?selected.delete(id):selected.add(id);anchorId=id;}
  else{selected=new Set([id]);anchorId=id;}
 }
 /** Small islands left out of every frame: grow the nearest frame over each one. */
 function attachIslands(){
  if(!islands?.unassigned?.length||!project.frames.length)return;
  const patches=new Map();
  for(const island of islands.unassigned){
   let best=null,gap=Infinity;
   for(const f of project.frames){const r=patches.get(f.id)||f.sourceRect,g=rectGap(r,island),d=Math.max(g.x,g.y);if(d<gap){gap=d;best=f;}}
   if(best)patches.set(best.id,unionRect([patches.get(best.id)||best.sourceRect,island]));
  }
  islands={...islands,attached:[...islands.attached,...islands.unassigned.map(island=>({island}))],attachedPixels:islands.attachedPixels+islands.unassignedPixels,unassigned:[],unassignedPixels:0};
  setRects(patches);
 }
 /** …or make them frames of their own, merged with the same distance Auto used. */
 function addIslandFrames(){
  if(!islands?.unassigned?.length)return;
  const groups=readingOrder(mergeRects(islands.unassigned,{distance:o.merge||0}));
  const {frames}=framesFromRects(src(),groups,{trim:true,threshold:o.threshold,skipEmpty:false,prefix:prefix()+'_fx_'});
  islands={...islands,unassigned:[],unassignedPixels:0};
  commit({...project,frames:[...project.frames,...frames]});
 }
 // ---------------------------------------------------------------- events
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const a=b.dataset.action;
  try{
   if(a==='lab-sample')return void add([await sample()]);
   if(a==='lab-stage'){
    stage=b.dataset.stage;shellMarkup();
    // Pack & export opens on a packed atlas: it is the thing the stage is about, and packing
    // 100 frames is milliseconds. Every setting below it re-packs on change.
    if(stage==='export'&&!atlasResult&&project.frames.length)pack();else render();
    return;
   }
   if(a==='lab-clear')return void clear();
   if(a==='lab-undo')return void undo();
   if(a==='lab-redo')return void redo();
   if(a==='lab-share')return void shareSettings();
   if(a==='lab-save-project')return void saveProject();
   if(a==='lab-studio')return void openStudio();
   if(a==='lab-set'){
    const key=b.dataset.key,value=b.dataset.value;
    o={...o,[key]:/^-?\d+$/.test(value)?Number(value):value};
    for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
    if(key==='mode'){shellMarkup();detect();return;}
    if(key==='direction'&&animation())return void commit(P.updateAnimation(project,animation().id,{direction:o.direction}));
    if(key==='target'){renderSummary();return;}
    reflect();render();return;
   }
   if(a==='lab-suggest'){
    const s=suggestions[Number(b.dataset.index)];if(!s)return;
    o={...o,mode:'grid',cellW:s.cellWidth,cellH:s.cellHeight,offsetX:s.marginX,offsetY:s.marginY,spacingX:s.spacingX,spacingY:s.spacingY};
    shellMarkup();detect();return;
   }
   if(a==='lab-order')return void orderFrames();
   if(a==='lab-key-off'||a==='lab-key-use'){keyDeclined=a==='lab-key-off';if(a==='lab-key-use'&&keyInfo)keyInfo={...keyInfo,apply:true};detect();return;}
   if(a==='lab-islands-toggle'){showIslands=!showIslands;drawOverlay();renderAssist();return;}
   if(a==='lab-islands-attach')return void attachIslands();
   if(a==='lab-islands-add')return void addIslandFrames();
   if(a==='lab-merge')return void mergeSelected();
   if(a==='lab-remove'){if(!selected.size)return;const ids=[...selected];selected=new Set();return void commit(P.removeFrames(project,ids));}
   if(a==='lab-chip-remove'){selected.delete(b.dataset.id);return void commit(P.removeFrames(project,[b.dataset.id]));}
   if(a==='lab-play'){playing=!playing;drawAnimation();return;}
   if(a==='lab-anim-new')return void newAnimation();
   if(a==='lab-anim-pick'){animationId=b.dataset.id;jitter=null;seam=null;clock=0;shellMarkup();render();return;}
   if(a==='lab-anim-rename'){
    const current=animation();if(!current)return;
    const name=prompt(T('renameAnimation'),current.name);
    if(name)commit(P.updateAnimation(project,current.id,{name}));
    return;
   }
   if(a==='lab-anim-delete'){
    const current=animation();if(!current)return;
    animationId='';return void commit(P.removeAnimation(project,current.id));
   }
   if(a==='lab-assign'){
    const current=animation();
    if(!current)return void newAnimation();
    const ids=selected.size?project.frames.filter(f=>selected.has(f.id)).map(f=>f.id):project.frames.map(f=>f.id);
    return void commit(P.updateAnimation(project,current.id,{frameIds:ids}));
   }
   if(a==='lab-autofix')return void autoFix();
   if(a==='lab-fix-keep'){
    if(!fixPreview)return;
    const next=fixPreview.project;fixPreview=null;return void commit(next);
   }
   if(a==='lab-fix-drop'){fixPreview=null;render();return;}
   if(a==='lab-mirror'){
    const current=animation();if(!current)return;
    const next=P.mirrorAnimation(project,current.id);
    animationId=next.animations[next.animations.length-1].id;
    return void commit(next);
   }
   if(a==='lab-dup-remove'){
    if(!duplicates)return;
    const ids=[...duplicates.exact.flatMap(g=>g.duplicates),...duplicates.blank];
    if(!ids.length)return;
    return void commit(P.removeFrames(project,ids));
   }
   if(a==='lab-pivot-preset')return void commit(P.applyPivotTo(project,targetIds(pivotScope),b.dataset.preset));
   if(a==='lab-pivot-scope'){
    pivotScope=b.dataset.scope;
    for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
    return;
   }
   if(a==='lab-pivot-unit'){
    pivotUnit=b.dataset.value;shellMarkup();render();return;
   }
   if(a==='lab-box-add'){
    const ids=targetIds(pivotScope);
    if(!ids.length)return;
    return void commit(P.addBoxTo(project,ids,boxSpec()));
   }
   if(a==='lab-box-range'){
    const current=animation();
    if(!current){toast(T('needAnimation'),{error:true});return;}
    const ids=P.stepRange(project,current,range.from,range.to);
    return void commit(P.addBoxTo(project,ids,boxSpec()));
   }
   if(a==='lab-box-remove'){
    const f=currentFrame();if(!f)return;
    if(boxId===b.dataset.id)boxId='';
    return void commit(P.removeBox(project,f.id,b.dataset.id));
   }
   if(a==='lab-box-pick'){boxId=boxId===b.dataset.id?'':b.dataset.id;drawFrameStage();return;}
   if(a==='lab-timeline-cell'){
    const step=Number(b.dataset.step),list=steps();
    if(list[step]){selected=new Set([list[step].id]);frameCursor=project.frames.findIndex(f=>f.id===list[step].id);render();}
    return;
   }
   if(a==='lab-collision')return void generateCollision();
   if(a==='lab-pack')return void pack();
   if(a==='lab-frames-zip')return void await framesZip();
   if(a==='lab-gif')return void await gifExport();
   if(a==='lab-primary')return void await primary();
  }catch(err){toast(err?.message||String(err),{error:true});}
 });
 async function primary(){
  if(busy)return;
  if(stage==='slice'){stage='normalize';shellMarkup();render();return;}
  if(stage==='normalize'){applyNormalize();stage='animate';shellMarkup();render();return;}
  if(stage==='animate'){stage='boxes';shellMarkup();render();return;}
  if(stage==='boxes'){stage='export';shellMarkup();pack();return;}
  busy=true;renderSummary();
  try{await exportBundle();}
  catch(e){toast(e?.message||String(e),{error:true});}
  finally{busy=false;renderSummary();}
 }
 el.addEventListener('pointerdown',pointerDown);
 el.addEventListener('pointermove',pointerMove);
 for(const name of ['pointerup','pointercancel'])el.addEventListener(name,pointerUp);
 el.addEventListener('click',e=>{
  const chip=e.target.closest('.frame-chip');if(!chip?.dataset.id||e.target.closest('button'))return;
  const id=chip.dataset.id;
  select(id,e);
  frameCursor=project.frames.findIndex(f=>f.id===id);
  if(stage==='slice'){drawOverlay();drawChips();renderRect();renderSummary();}
  else render();
 });
 const LAYOUT_ONLY=new Set(['zoom','bg','onionBefore','onionAfter','align','padding','canvas','canvasW','canvasH','trim',
  'atlasPadding','extrude','pot','maxSize','dedupe','outline','outlineColor','defringe','target','reference','preserveTrend',
  'collisionShape','collisionTolerance','collisionVertices','collisionThreshold','collisionPadding']);
 const PACK_KEYS=new Set(['atlasPadding','extrude','pot','maxSize','dedupe','outline','outlineColor','defringe']);
 function readOptions(){
  const next={...o};
  for(const input of el.querySelectorAll('[data-num]')){
   const key=input.dataset.num,[min,max]=CLAMP[key]||[0,65535];
   next[key]=Math.max(min,Math.min(max,Math.round(Number(input.value)||0)));
  }
  for(const input of el.querySelectorAll('[data-check]'))next[input.dataset.check]=input.checked;
  for(const input of el.querySelectorAll('[data-select]'))next[input.dataset.select]=input.value;
  for(const input of el.querySelectorAll('[data-color]'))next[input.dataset.color]=input.value;
  const changed=Object.keys(next).filter(k=>next[k]!==o[k]);
  o=next;return changed;
 }
 el.addEventListener('input',e=>{
  const target=e.target;
  if(target.dataset.rect){
   const patch={};
   for(const input of el.querySelectorAll('#labRect [data-rect]'))patch[input.dataset.rect]=Number(input.value)||0;
   editRect(patch);return;
  }
  if(target.dataset.pivot){
   const f=currentFrame();if(!f)return;
   const x=Number(q('#labPivotX').value),y=Number(q('#labPivotY').value);
   if(!Number.isFinite(x)||!Number.isFinite(y))return;
   project=P.applyPivotTo(project,targetIds(pivotScope),{x,y,pixels:pivotUnit==='pixels'});
   atlasResult=null;drawFrameStage();renderSummary();return;
  }
  if(target.dataset.box!==undefined){
   const key=target.dataset.box;
   box={...box,[key]:key==='type'||key==='shape'?target.value:Math.round(Number(target.value)||0)};
   reflect();return;
  }
  if(target.dataset.range){range={...range,[target.dataset.range]:Math.max(1,Math.round(Number(target.value)||1))};return;}
  if(target.id==='labFps'){
   o.fps=Number(target.value)||12;q('#labFpsOut').textContent=o.fps;
   if(animation())project=P.updateAnimation(project,animation().id,{fps:o.fps});
   return;
  }
  if(target.id==='labDiff'){diffView=target.checked;drawAnimation();return;}
  if(target.dataset.selectTag!==undefined){
   const ids=targetIds(pivotScope);
   if(ids.length)commit(P.setTag(project,ids,target.value));
   return;
  }
  if(target.dataset.duration!==undefined){
   const ids=targetIds('selected');
   if(!ids.length)return;
   const value=target.value===''?null:Math.max(1,Math.round(Number(target.value)||0));
   project=P.setDuration(project,ids,value);jitter=null;renderSummary();return;
  }
  if(target.dataset.animCheck==='loop'){
   if(animation())commit(P.updateAnimation(project,animation().id,{loop:target.checked}));
   return;
  }
  if(!target.closest('#labOptions'))return;
  const changed=readOptions();
  if(!changed.length)return void renderSummary();
  if(changed.every(k=>LAYOUT_ONLY.has(k))){
   if(stage==='normalize')computeNormalize();
   if(stage==='animate'&&changed.includes('reference'))jitter=null;
   if(stage==='export'&&changed.some(k=>PACK_KEYS.has(k))){pack();return;}
   reflect();render();return;
  }
  schedule();
 });
 el.addEventListener('change',e=>{
  if(e.target.id!=='labProjectFile')return;
  const file=e.target.files?.[0];e.target.value='';
  if(file)loadProject(file);
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('toggle',e=>{if(e.target.id==='optionsAdvanced')advancedOpen=e.target.open;},true);
 let dragId=null;
 el.addEventListener('dragstart',e=>{const chip=e.target.closest?.('.frame-chip');if(!chip?.dataset.id)return;dragId=chip.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);});
 el.addEventListener('dragover',e=>{if(dragId){e.preventDefault();e.stopPropagation();}});
 el.addEventListener('drop',e=>{
  if(!dragId)return;e.preventDefault();e.stopPropagation();
  const chip=e.target.closest?.('.frame-chip'),from=project.frames.findIndex(f=>f.id===dragId);
  const moving=dragId;dragId=null;
  if(!chip?.dataset.id||from<0)return;
  const ids=project.frames.map(f=>f.id);
  ids.splice(from,1);
  const to=ids.indexOf(chip.dataset.id),r=chip.getBoundingClientRect();
  ids.splice(Math.max(0,to)+(e.clientX>r.left+r.width/2?1:0),0,moving);
  const next=P.reorderFrames(project,ids);
  const current=animation();
  commit(current?P.updateAnimation(next,current.id,{frameIds:ids.filter(id=>current.frameIds.includes(id))}):next);
 });
 el.addEventListener('dragend',()=>{dragId=null;});
 /** Shortcuts live on the document so the canvas does not have to hold focus, and are ignored
  * inside a form field or a dialog. */
 const keys=e=>{
  if(!el.isConnected||!sheet)return;
  if(e.target.closest?.('dialog')||e.target.matches?.('input,textarea,select'))return;
  const lower=(e.key||'').toLowerCase();
  if((e.ctrlKey||e.metaKey)&&lower==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&lower==='y'){e.preventDefault();redo();return;}
  if((e.ctrlKey||e.metaKey)&&lower==='a'){e.preventDefault();selected=new Set(project.frames.map(f=>f.id));render();return;}
  if(e.key==='Escape'){selected=new Set();render();return;}
  if(e.key===' '&&stage==='animate'){e.preventDefault();playing=!playing;return;}
  if(e.key===' '&&e.target.closest?.('#labSheetStage,#labOverlay,.frame-strip')){e.preventDefault();return;}
  if((e.key==='Delete'||e.key==='Backspace')&&selected.size){
   e.preventDefault();
   // Slice is where frames are made and removed. Elsewhere a stray Delete must not wipe frames
   // out of every animation: it asks for a second press, and either way Ctrl+Z brings them back.
   if(stage!=='slice'&&Date.now()-deleteArmed>4000){deleteArmed=Date.now();toast(T('deleteAgain',{n:selected.size}));return;}
   deleteArmed=0;
   const ids=[...selected];selected=new Set();commit(P.removeFrames(project,ids));toast(T('deleted',{n:ids.length}));return;
  }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected.size===1&&stage==='slice'){
   e.preventDefault();
   const step=e.shiftKey?10:1,r=currentFrame().sourceRect;
   const dx=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,dy=e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0;
   editRect(e.altKey?{w:r.w+dx,h:r.h+dy}:{x:r.x+dx,y:r.y+dy});
  }
 };
 document.addEventListener('keydown',keys);
 addEventListener('resize',()=>{if(project.frames.length)render();});

 async function sample(){
  const c=Im.canvas(160,56),x=c.getContext('2d');
  for(let i=0;i<4;i++){
   const bob=i%2,ox=i*40;
   x.fillStyle='#2b3a67';x.fillRect(ox+14,16+bob,12,16);x.fillStyle='#f4c095';x.fillRect(ox+15,7+bob,10,9);
   x.fillStyle='#e85d75';x.fillRect(ox+13,3+bob,14,3);// a hat, drawn a pixel off the head
   x.fillStyle='#1b1f3b';x.fillRect(ox+15+i,32+bob,4,10-bob);x.fillRect(ox+21-i,32+bob,4,10-bob);
   x.fillStyle='#cbd5e1';x.fillRect(ox+29,18+bob,3,14);// a sword, two pixels off the body
  }
  const file=new File([await Im.blobOf(c)],'walk_sheet.png',{type:'image/png'});Im.release(c);return file;
 }
 async function add(files){
  if(busy)return;busy=true;
  try{
   const file=files[0];if(!file)return;
   if(files.length>1)toast(T('oneSheet'));
   const next=await Im.decode(file);
   if(sheet){if(work&&work!==sheet)Im.release(work);Im.release(sheet);}
   sheet=next;work=null;workKey=null;reader=null;sourceName=file.name;sourceFile=file;keyInfo=null;keyDeclined=false;islands=null;gridHint=null;anchorId=null;
   project=P.project();past=[];future=[];selected=new Set();suggestions=[];autoMerge=null;atlasResult=null;
   shellMarkup();cancelAnimationFrame(raf);raf=requestAnimationFrame(animate);
   track('tool_run',{intent:route.id});
   busy=false;await detect();
  }catch(e){toast(e?.message||String(e),{error:true});if(!sheet)empty();}
  finally{busy=false;}
 }
 function clear(){
  abort?.abort();
  atlasResult?.release?.();
  if(work&&work!==sheet)Im.release(work);Im.release(sheet);
  sheet=work=null;workKey=null;reader=null;keyInfo=null;keyDeclined=false;islands=null;gridHint=null;
  project=P.project();past=[];future=[];selected=new Set();suggestions=[];atlasResult=null;error='';invalidate();
  cancelAnimationFrame(raf);empty();
 }
 onLocale(()=>{if(!sheet){empty();return;}shellMarkup();render();});
 // Work lives only in this tab: leaving it (All tools, a link, closing) asks first.
 addEventListener('beforeunload',e=>{if(el.isConnected&&sheet&&project.frames.length){e.preventDefault();e.returnValue='';}});
 empty();
 return {add};
}
