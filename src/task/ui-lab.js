import * as Im from '../image.js';
import {zip,bytes,stem} from '../core.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,page as route} from './shell.js';
import * as NS from '../game/nine-slice.js';
import * as ST from '../game/ui-states.js';
import * as BM from '../game/bmfont.js';
import * as SDF from '../game/sdf.js';
import * as LAY from '../game/ui-layout.js';
import {contrastRatio,wcag,round2} from '../game/contrast.js';
import {envelope} from '../game/exporters/ui-envelope.js';
import {components} from '../primitives.js';
import {packRects} from '../atlas-pack.js';
/** UI Lab: one workspace with five stages over one in-memory asset — 9-Slice, States, Atlas,
 * Font, Check. Stages are views, not pages: nothing is re-uploaded between them, and every
 * preview is drawn from the same plan the export writes (src/game/*.js), so what is on screen
 * is what lands in the ZIP. Routes open the Lab at their stage (docs/UI-LAB.md). */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STAGES=['slice','states','atlas','font','check'];
const STAGE_OF={'ui-lab':'slice','9-slice-editor':'slice','button-state-generator':'states','bitmap-font':'font','missing-glyph-checker':'check','ui-scale-preview':'check'};
const TAB_OF={'missing-glyph-checker':'glyphs','ui-scale-preview':'sizes'};
const SIDES=['left','right','top','bottom'];
const TARGETS=[[100,40],[300,80],[800,200]];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const int=(v,lo,hi,fallback=lo)=>{const n=Math.round(Number(v));return Number.isFinite(n)?clamp(n,lo,hi):fallback;};
const rgba=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
function fromRGBA(data,w,h){const c=Im.canvas(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);return c;}
function cropCanvas(src,r){const c=Im.canvas(r.w,r.h),x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(src,r.x,r.y,r.w,r.h,0,0,r.w,r.h);return c;}
/** The one place nine-slice pixels are produced: preview canvases and exported PNGs both call it. */
function drawPlan(canvas,src,plan,{pixelated=true}={}){
 const x=canvas.getContext('2d');x.imageSmoothingEnabled=!pixelated;x.clearRect(0,0,canvas.width,canvas.height);
 for(const o of plan.ops)x.drawImage(src,o.sx,o.sy,o.sw,o.sh,o.dx,o.dy,o.dw,o.dh);
 return plan;
}
function renderNine(src,border,w,h,options){
 const canvas=Im.canvas(w,h);
 drawPlan(canvas,src,NS.nineSlicePlan({w:src.width,h:src.height},border,w,h,options),options);
 return canvas;
}
export function mount({el,def}){
 const T=(k,v)=>text('uiLab.'+k,v);
 // `source` is the dropped asset. `panel` is what the 9-slice stage edits: the source itself,
 // or one element cut out of a UI sheet in the Atlas stage. The sheet is never thrown away.
 let source=null,sourceName='panel.png',panel=null,stage=STAGE_OF[route.id]||'slice',busy=false,drag=null;
 const target=()=>panel||source;
 const panelName=()=>S.atlas.editing!=null?S.atlas.elements[S.atlas.editing].name:stem(sourceName)||'panel';
 const S={
  border:{left:0,right:0,top:0,bottom:0},suggestion:null,suggested:false,
  slice:{mode:'stretch',pixelated:true,scale:1,customW:420,customH:120,zoom:0},
  states:{ops:JSON.parse(JSON.stringify(ST.DEFAULT_OPS)),selected:'hover',canvases:null,strip:null},
  atlas:{threshold:8,merge:4,minArea:16,padding:2,extrude:0,elements:null,packed:null,editing:null},
  font:{mode:'grid',cellW:8,cellH:8,baseline:0,spacing:1,chars:'',preset:'text',sample:'',sdf:false,spread:8,size:32,family:'',fileName:'',built:null,sheet:null},
  check:{tab:TAB_OF[route.id]||'glyphs',text:'',source:'lab',imported:null,importedName:'',screen:'1080p',aspect:'16:9',anchor:'bottom-center',safe:'none',insetX:0,insetY:0,
   strings:{ko:'',en:'',ja:''},boxW:220,boxH:56,fontSize:18,wrapMode:'single',fg:'#ffffff',bg:'#3182f6',fontPx:16,bold:false}
 };
 const needsImage=s=>s!=='check';
 const $=s=>el.querySelector(s);
 /** A shared link carries settings only — borders, mode, sizes, the stage — never image data.
  * `settingsLink()` writes the same keys back, so a link is round-trippable. */
 const PRESET=[['stage',()=>stage,v=>{if(STAGES.includes(v))stage=v;}],
  ['l',()=>S.border.left,v=>S.border.left=int(v,0,4096)],['r',()=>S.border.right,v=>S.border.right=int(v,0,4096)],
  ['t',()=>S.border.top,v=>S.border.top=int(v,0,4096)],['b',()=>S.border.bottom,v=>S.border.bottom=int(v,0,4096)],
  ['mode',()=>S.slice.mode,v=>{if(['stretch','tile'].includes(v))S.slice.mode=v;}],
  ['scale',()=>S.slice.scale,v=>S.slice.scale=int(v,1,4)],
  ['w',()=>S.slice.customW,v=>S.slice.customW=int(v,1,4096)],['h',()=>S.slice.customH,v=>S.slice.customH=int(v,1,4096)],
  ['px',()=>S.slice.pixelated?1:0,v=>S.slice.pixelated=v!=='0'],
  ['cw',()=>S.font.cellW,v=>S.font.cellW=int(v,1,4096)],['ch',()=>S.font.cellH,v=>S.font.cellH=int(v,1,4096)],
  ['base',()=>S.font.baseline,v=>S.font.baseline=int(v,0,4096)],
  ['fmode',()=>S.font.mode,v=>{if(['grid','measured','ttf'].includes(v))S.font.mode=v;}],
  ['pad',()=>S.atlas.padding,v=>S.atlas.padding=int(v,0,32)],['merge',()=>S.atlas.merge,v=>S.atlas.merge=int(v,0,64)],
  ['ext',()=>S.atlas.extrude,v=>S.atlas.extrude=int(v,0,8)]];
 for(const [key,,apply] of PRESET){const raw=route.query.get(key);if(raw!==null)apply(raw);}
 // Borders from a shared link belong to the first image dropped on it; a later image starts clean.
 let presetBorder={...S.border},firstFile=true;
 const settingsLink=()=>{
  const url=new URL(location.href);url.search='';
  for(const [key,read] of PRESET)url.searchParams.set(key,String(read()));
  return url.href;
 };
 const glyphSet=()=>{
  if(S.check.source==='fnt'&&S.check.imported)return BM.fntCodepoints(S.check.imported);
  const font=S.font.built;return new Set((font?.glyphs||[]).map(g=>g.codepoint));
 };
 // ---------- shell ----------
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span>
<div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="ui-sample">${esc(text('sample'))}</button><button type="button" class="ghost" data-action="ui-stage" data-stage="check">${esc(T('openCheck'))}</button></div>
<small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  el.innerHTML=`<div class="ui-lab">
<div class="ui-stagebar" role="tablist" aria-label="${esc(T('stages'))}">${STAGES.map(s=>`<button type="button" role="tab" data-action="ui-stage" data-stage="${s}" aria-selected="${s===stage}">${esc(T('stage.'+s))}</button>`).join('')}</div>
<div class="work ui-work"><section class="board" id="uiBoard"></section><aside class="side" id="uiSide"></aside></div></div>`;
  paintStage();
 }
 function paintStage(){
  const view=VIEWS[stage];
  if(needsImage(stage)&&!source){
   $('#uiBoard').innerHTML=`<div class="ui-need"><strong>${esc(T('needImage'))}</strong><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="ui-sample">${esc(text('sample'))}</button></div></div>`;
   $('#uiSide').innerHTML=`<p class="hint">${esc(T('needImageHint'))}</p>`;
   return;
  }
  // Re-rendering the side panel must not collapse Advanced under the user's hands.
  const open=$('#optionsAdvanced')?.open;
  $('#uiBoard').innerHTML=view.board();
  $('#uiSide').innerHTML=view.side();
  if(open){const details=$('#optionsAdvanced');if(details)details.open=true;}
  view.paint?.();
 }
 const refresh=()=>{if(source||!needsImage(stage))paintStage();};
 // ---------- 9-slice ----------
 function sliceZoom(){
  const image=target();if(!image)return 1;
  const box=$('#nsStage')?.clientWidth||520;
  return S.slice.zoom||clamp(Math.floor(box/image.width)||1,1,16);
 }
 const previewTargets=()=>[...TARGETS,[S.slice.customW,S.slice.customH]];
 const planFor=(w,h)=>NS.nineSlicePlan({w:target().width,h:target().height},S.border,w,h,{mode:S.slice.mode,scale:S.slice.scale});
 function sliceWarnings(){
  const out=[];
  for(const [w,h] of previewTargets())for(const warning of planFor(w,h).warnings)out.push(T('warn.'+warning.code,{w,h,need:warning.need,got:warning.got,tiles:warning.tiles}));
  return [...new Set(out)];
 }
 const VIEWS={
  slice:{
   board(){
    return `${S.atlas.editing!=null?`<div class="ui-banner"><span>${esc(T('editingElement',{name:S.atlas.elements[S.atlas.editing].name}))}</span><button type="button" class="chip" data-action="ui-back-atlas">${esc(T('backToAtlas'))}</button></div>`:''}
<div class="view-head"><strong>${esc(T('editor'))}</strong><span id="nsInfo"></span>
<label class="check mini"><input type="checkbox" data-opt="slice.pixelated" ${S.slice.pixelated?'checked':''}> ${esc(text('atlas.pixelated'))}</label></div>
<div class="ns-stage" id="nsStage"><div class="ns-art" id="nsArt"><canvas id="nsCanvas"></canvas><div class="ns-center" id="nsCenter"><span>${esc(T('stretchArea'))}</span></div>
${SIDES.map(side=>`<button type="button" class="ns-guide ${side}" data-guide="${side}" aria-label="${esc(T('guide.'+side))}" title="${esc(T('guide.'+side))}" role="slider" aria-valuemin="0"><i></i><b></b></button>`).join('')}</div></div>
<p class="viewer-note">${esc(T('guideHint'))}</p>
<div class="view-head"><strong>${esc(T('livePreview'))}</strong><span>${esc(T('previewNote'))}</span></div>
<div class="ns-previews" id="nsPreviews"></div>`;
   },
   side(){
    const s=S.suggestion;
    return `<div class="summary" id="nsSummary" role="status" aria-live="polite"></div>
<form class="options" autocomplete="off" id="nsForm">
<span class="opt-label">${esc(T('borders'))}</span>
<div class="field-row ns-fields">${SIDES.map(side=>`<label class="field"><span>${esc(T('guide.'+side))}</span><input type="number" id="ns-${side}" data-opt="border.${side}" min="0" max="${side==='left'||side==='right'?target().width:target().height}" step="1" value="${S.border[side]}" inputmode="numeric"></label>`).join('')}</div>
${s?`<div class="ui-suggest ${s.confident?'':'weak'}"><strong>${esc(T('suggestTitle'))}</strong><span>${esc(T(s.confident?'suggestFrom':'suggestWeak',{l:s.left,r:s.right,t:s.top,b:s.bottom,cols:s.columnRun,rows:s.rowRun}))}</span>
<div class="dropzone-actions"><button type="button" class="chip" data-action="ui-accept">${esc(T('accept'))}</button><button type="button" class="link" data-action="ui-dismiss">${esc(T('dismiss'))}</button></div></div>`
 :`<button type="button" class="dashed" data-action="ui-suggest">${esc(T('suggest'))}</button>`}
<span class="opt-label">${esc(T('edgeMode'))}</span>
<div class="segmented" role="group">${['stretch','tile'].map(m=>`<button type="button" data-action="ui-set" data-key="slice.mode" data-value="${m}" aria-pressed="${S.slice.mode===m}">${esc(T('mode.'+m))}</button>`).join('')}</div>
<span class="opt-label">${esc(T('customSize'))}</span>
<div class="field-row"><label class="field"><span>${esc(text('resize.width'))}</span><input type="number" data-opt="slice.customW" min="1" max="4096" value="${S.slice.customW}" inputmode="numeric"></label><label class="field"><span>${esc(text('resize.height'))}</span><input type="number" data-opt="slice.customH" min="1" max="4096" value="${S.slice.customH}" inputmode="numeric"></label></div>
<details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary>
<div class="field-row"><label class="field"><span>${esc(T('integerScale'))}</span><select data-opt="slice.scale">${[1,2,3,4].map(n=>`<option value="${n}" ${S.slice.scale===n?'selected':''}>${n}×</option>`).join('')}</select></label>
<label class="field"><span>${esc(T('zoom'))}</span><select data-opt="slice.zoom"><option value="0" ${!S.slice.zoom?'selected':''}>${esc(T('zoomFit'))}</option>${[1,2,4,6,8,12].map(n=>`<option value="${n}" ${S.slice.zoom===n?'selected':''}>${n}×</option>`).join('')}</select></label></div>
<p class="hint">${esc(T('scaleHint'))}</p>
<button type="button" class="mini-button" data-action="ui-copy-link">${esc(T('copyLink'))}</button>
<p class="hint">${esc(T('copyLinkHint'))}</p></details></form>
<button type="button" class="primary big" data-action="ui-export-slice">${esc(T('exportSlice'))}</button>
<small class="local-note">${esc(text('local'))}</small>`;
   },
   paint(){
    const image=target(),zoom=sliceZoom(),b=S.border,art=$('#nsArt'),canvas=$('#nsCanvas');
    canvas.width=image.width;canvas.height=image.height;
    const x=canvas.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(image,0,0);
    canvas.classList.toggle('px',S.slice.pixelated);
    art.style.width=image.width*zoom+'px';art.style.height=image.height*zoom+'px';
    $('#nsCenter').style.inset=`${b.top*zoom}px ${b.right*zoom}px ${b.bottom*zoom}px ${b.left*zoom}px`;
    for(const side of SIDES){
     const guide=art.querySelector(`[data-guide="${side}"]`),horizontal=side==='left'||side==='right';
     const at=(side==='left'?b.left:side==='right'?image.width-b.right:side==='top'?b.top:image.height-b.bottom)*zoom;
     guide.style[horizontal?'left':'top']=at+'px';
     guide.setAttribute('aria-valuenow',String(b[side]));guide.setAttribute('aria-valuemax',String(horizontal?image.width:image.height));
    }
    $('#nsInfo').textContent=`${image.width} × ${image.height} · ${zoom}×`;
    for(const side of SIDES){const input=$('#ns-'+side);if(input&&document.activeElement!==input)input.value=b[side];}
    $('#nsSummary').innerHTML=`<div class="summary-big">${b.left} · ${b.right} · ${b.top} · ${b.bottom}</div><div class="summary-line">${esc(T('bordersLine',{w:image.width,h:image.height}))}</div>`+
     sliceWarnings().map(w=>`<div class="summary-line bad">${esc(w)}</div>`).join('');
    // Each preview is its target in real pixels, never upscaled; when the column is narrower
    // than the target the caption says at what percentage it is being shown.
    const host=$('#nsPreviews');
    host.innerHTML=previewTargets().map(([w,h],i)=>`<figure class="ns-preview${i===3?' custom':''}"><figcaption><b>${w} × ${h}</b><span data-shown="${i}"></span>${i===3?' · '+esc(T('dragResize')):''}</figcaption>
<div class="ns-box" style="width:min(100%,${w}px);aspect-ratio:${w} / ${h}"><canvas data-preview="${i}"></canvas>${i===3?'<span class="ns-resize" data-action="ui-resize" aria-hidden="true"></span>':''}</div></figure>`).join('');
    for(const [i,[w,h]] of previewTargets().entries()){
     const cv=host.querySelector(`[data-preview="${i}"]`);cv.width=w;cv.height=h;cv.classList.toggle('px',S.slice.pixelated);
     drawPlan(cv,image,planFor(w,h),S.slice);
     const shown=Math.round(cv.clientWidth/w*100);
     if(shown&&shown<99)host.querySelector(`[data-shown="${i}"]`).textContent=T('shownAt',{n:shown});
    }
   }
  },
  // ---------- button states ----------
  states:{
   board(){
    return `<div class="view-head"><strong>${esc(T('variants'))}</strong><span>${esc(T('variantsNote'))}</span></div>
<div class="ui-states" id="stateGrid"></div><p class="viewer-note" id="stateApplied"></p>
<div class="view-head"><strong>${esc(T('stripPreview'))}</strong><span id="stripInfo"></span></div>
<div class="atlas-canvas" id="stripHost"></div>`;
   },
   side(){
    const name=S.states.selected,op=S.states.ops[name];
    const num=(key,label,min,max,step)=>`<label class="field"><span>${esc(label)}</span><input type="number" data-state="${key}" min="${min}" max="${max}" step="${step}" value="${op[key]??0}" inputmode="decimal"></label>`;
    return `<div class="summary"><div class="summary-big">${esc(T('state.'+name))}</div><div class="summary-line">${esc(T('editingState'))}</div></div>
<div class="segmented ui-statepick" role="group">${ST.STATES.map(s=>`<button type="button" data-action="ui-set" data-key="states.selected" data-value="${s}" aria-pressed="${S.states.selected===s}">${esc(T('state.'+s))}</button>`).join('')}</div>
<form class="options" autocomplete="off">
<div class="field-row">${num('brightness',T('brightness'),-1,1,.05)}${num('contrast',T('contrast'),-1,1,.05)}</div>
<div class="field-row">${num('saturation',T('saturation'),-1,1,.05)}${num('alpha',T('opacity'),0,1,.05)}</div>
<div class="field-row"><label class="field inline"><span>${esc(T('overlay'))}</span><input type="color" data-state="overlayColor" value="${esc(op.overlayColor||'#000000')}"></label>${num('overlayAlpha',T('overlayAlpha'),0,1,.05)}</div>
<div class="field-row">${num('offsetX',T('offsetX'),-16,16,1)}${num('offsetY',T('offsetY'),-16,16,1)}</div>
<div class="field-row">${num('outline',T('outlineWidth'),0,8,1)}<label class="field inline"><span>${esc(T('outlineColor'))}</span><input type="color" data-state="outlineColor" value="${esc(op.outlineColor||'#3182f6')}"></label></div>
<details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary>
<div class="field-row"><label class="field"><span>${esc(text('atlas.padding'))}</span><input type="number" data-opt="atlas.padding" min="0" max="16" value="${S.atlas.padding}" inputmode="numeric"></label></div>
<p class="hint">${esc(T('stripNote'))}</p></details>
<div class="list-actions"><button type="button" class="link" data-action="ui-reset-state">${esc(T('resetState'))}</button></div></form>
<button type="button" class="primary big" data-action="ui-export-states">${esc(T('exportStates'))}</button>
<small class="local-note">${esc(text('local'))}</small>`;
   },
   paint(){
    releaseStates();
    const base=rgba(source),made=S.states.ops,out={};
    const grid=$('#stateGrid');grid.innerHTML='';
    // Small button art is shown at an integer zoom so the preview stays crisp and readable.
    const zoom=clamp(Math.floor(150/source.width)||1,1,6);
    for(const name of ST.STATES){
     const v=ST.variant(base,source.width,source.height,made[name]);
     const canvas=fromRGBA(v.data,v.width,v.height);out[name]={canvas,applied:v.applied,pad:v.pad};
     const figure=document.createElement('figure');figure.className='ui-state'+(S.states.selected===name?' is-current':'');
     figure.innerHTML=`<button type="button" class="ui-state-pick" data-action="ui-set" data-key="states.selected" data-value="${name}" aria-pressed="${S.states.selected===name}"><span class="ui-state-art"></span><figcaption>${esc(T('state.'+name))}<small>${v.width}×${v.height}</small></figcaption></button>`;
     canvas.classList.add('px');canvas.style.width=v.width*zoom+'px';canvas.style.height=v.height*zoom+'px';
     figure.querySelector('.ui-state-art').append(canvas);
     grid.append(figure);
    }
    S.states.canvases=out;
    $('#stateApplied').textContent=out[S.states.selected].applied.length?T('appliedList',{list:out[S.states.selected].applied.join(' · ')}):T('appliedNone');
    const strip=buildStrip(),host=$('#stripHost');
    S.states.strip=strip;strip.canvas.classList.add('px');
    host.replaceChildren(strip.canvas);fitHost(host,strip.width,strip.height,220);
    $('#stripInfo').textContent=`${strip.width} × ${strip.height}`;
   }
  },
  // ---------- atlas ----------
  atlas:{
   board(){
    return `<div class="view-head"><strong>${esc(T('atlasPreview'))}</strong><span id="atlasInfo"></span>
<button type="button" class="mini-button" data-action="ui-detect">${esc(T('detect'))}</button></div>
<div class="atlas-canvas" id="uiAtlasHost"><canvas id="uiAtlasCanvas"></canvas><svg id="uiAtlasSvg" xmlns="http://www.w3.org/2000/svg"></svg></div>
<div class="view-head"><strong>${esc(T('elements'))}</strong><span id="elementCount"></span></div>
<div class="ui-elements" id="elementList"></div>`;
   },
   side(){
    return `<div class="summary" id="atlasSummary" role="status" aria-live="polite"></div>
<form class="options" autocomplete="off">
<div class="field-row"><label class="field"><span>${esc(T('mergeDistance'))}</span><input type="number" data-opt="atlas.merge" min="0" max="64" value="${S.atlas.merge}" inputmode="numeric"></label>
<label class="field"><span>${esc(T('minArea'))}</span><input type="number" data-opt="atlas.minArea" min="1" max="10000" value="${S.atlas.minArea}" inputmode="numeric"></label></div>
<div class="field-row"><label class="field"><span>${esc(text('atlas.padding'))}</span><input type="number" data-opt="atlas.padding" min="0" max="32" value="${S.atlas.padding}" inputmode="numeric"></label>
<label class="field"><span>${esc(text('atlas.extrude'))}</span><input type="number" data-opt="atlas.extrude" min="0" max="8" value="${S.atlas.extrude}" inputmode="numeric"></label></div>
<details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary>
<label class="field"><span>${esc(T('alphaThreshold'))}</span><input type="number" data-opt="atlas.threshold" min="0" max="254" value="${S.atlas.threshold}" inputmode="numeric"></label>
<p class="hint">${esc(T('atlasHint'))}</p></details></form>
<button type="button" class="primary big" data-action="ui-export-atlas">${esc(T('exportAtlas'))}</button>
<small class="local-note">${esc(text('local'))}</small>`;
   },
   paint(){
    if(!S.atlas.elements)detectElements();
    const list=S.atlas.elements||[];
    $('#elementCount').textContent=T('elementCount',{n:list.length});
    $('#elementList').innerHTML=list.length?list.map((e,i)=>`<div class="ui-element${S.atlas.editing===i?' is-current':''}">
<label class="field"><span>${e.rect.w}×${e.rect.h}${e.border?' · 9◱':''}</span><input type="text" data-element="${i}" value="${esc(e.name)}" maxlength="48" spellcheck="false" aria-label="${esc(T('elementName'))}"></label>
<button type="button" class="mini-button" data-action="ui-element-slice" data-index="${i}">${esc(T('setBorders'))}</button>
<button type="button" class="mini-button" data-action="ui-element-drop" data-index="${i}" aria-label="${esc(text('remove'))}" title="${esc(text('remove'))}">×</button></div>`).join(''):`<p class="hint">${esc(T('noElements'))}</p>`;
    packAtlas();
   }
  },
  // ---------- font ----------
  font:{
   board(){
    return `<div class="view-head"><strong>${esc(T('fontSheet'))}</strong><span id="fontInfo"></span></div>
<div class="atlas-canvas" id="fontHost"><canvas id="fontCanvas"></canvas><svg id="fontSvg" xmlns="http://www.w3.org/2000/svg"></svg></div>
<div id="fontSampleWrap"><div class="view-head"><strong>${esc(T('fontSample'))}</strong></div>
<div class="ui-fontsample"><canvas id="fontSampleCanvas"></canvas></div></div>
<p class="viewer-note" id="fontNote"></p>`;
   },
   side(){
    const f=S.font;
    return `<div class="summary" id="fontSummary" role="status" aria-live="polite"></div>
<div class="segmented" role="group">${['grid','measured','ttf'].map(m=>`<button type="button" data-action="ui-set" data-key="font.mode" data-value="${m}" aria-pressed="${f.mode===m}">${esc(T('fontMode.'+m))}</button>`).join('')}</div>
<form class="options" autocomplete="off">
${f.mode==='ttf'?`<label class="field"><span>${esc(T('fontFile'))}</span><input type="file" id="fontFile" accept=".ttf,.otf,.woff,font/ttf,font/otf" data-local-drop></label>
<div class="field-row"><label class="field"><span>${esc(T('fontSize'))}</span><input type="number" data-opt="font.size" min="6" max="128" value="${f.size}" inputmode="numeric"></label><label class="field"><span>${esc(T('glyphSpacing'))}</span><input type="number" data-opt="font.spacing" min="0" max="16" value="${f.spacing}" inputmode="numeric"></label></div>
<p class="hint">${esc(f.fileName?T('fontLoaded',{name:f.fileName}):T('fontFileHint'))}</p>`
 :`<div class="field-row"><label class="field"><span>${esc(t('kit.cellW'))}</span><input type="number" id="rc-cellW" data-opt="font.cellW" min="1" max="4096" value="${f.cellW}" inputmode="numeric"></label>
<label class="field"><span>${esc(t('kit.cellH'))}</span><input type="number" id="rc-cellH" data-opt="font.cellH" min="1" max="4096" value="${f.cellH}" inputmode="numeric"></label></div>
<div class="field-row"><label class="field"><span>${esc(T('baseline'))}</span><input type="number" id="rc-baseline" data-opt="font.baseline" min="0" max="4096" value="${f.baseline}" inputmode="numeric"></label>
${f.mode==='measured'?`<label class="field"><span>${esc(T('glyphSpacing'))}</span><input type="number" data-opt="font.spacing" min="0" max="16" value="${f.spacing}" inputmode="numeric"></label>`:''}</div>`}
<span class="opt-label">${esc(T('charset'))}</span>
<label class="field"><span>${esc(T('chars'))}</span><textarea id="rc-chars" data-opt="font.chars" rows="3" spellcheck="false">${esc(f.chars)}</textarea></label>
<details class="options-advanced" id="optionsAdvanced"><summary>${esc(T('charsetBuilder'))}</summary>
<label class="field"><span>${esc(T('fromText'))}</span><textarea data-opt="font.sample" rows="3" spellcheck="false" placeholder="${esc(T('fromTextHint'))}">${esc(f.sample)}</textarea></label>
<div class="chips-row">${BM.PRESETS.map(p=>`<button type="button" class="chip" data-action="ui-charset" data-preset="${p}">${esc(T('preset.'+p))}</button>`).join('')}</div>
<p class="hint">${esc(T('charsetHint'))}</p>
<label class="check"><input type="checkbox" data-opt="font.sdf" ${f.sdf?'checked':''}> ${esc(T('sdfOption'))}</label>
${f.sdf?`<label class="field"><span>${esc(T('sdfSpread'))}</span><input type="number" data-opt="font.spread" min="2" max="32" value="${f.spread}" inputmode="numeric"></label><p class="hint">${esc(T('sdfNote'))}</p>`:''}
</details></form>
<button type="button" class="primary big" data-action="ui-export-font">${esc(T('exportFont'))}</button>
<small class="local-note">${esc(text('local'))}</small>`;
   },
   paint(){buildFont();}
  },
  // ---------- check ----------
  check:{
   board(){
    const tabs=['glyphs','sizes','text','contrast'];
    return `<div class="ui-stagebar sub" role="tablist" aria-label="${esc(T('checks'))}">${tabs.map(tab=>`<button type="button" role="tab" data-action="ui-set" data-key="check.tab" data-value="${tab}" aria-selected="${S.check.tab===tab}">${esc(T('check.'+tab))}</button>`).join('')}</div>
<div id="checkBoard"></div>`;
   },
   side(){
    const c=S.check;
    if(c.tab==='glyphs')return `<div class="summary" id="glyphSummary" role="status" aria-live="polite"></div>
<form class="options" autocomplete="off">
<span class="opt-label">${esc(T('glyphSource'))}</span>
<div class="segmented" role="group">${[['lab','glyphSourceLab'],['fnt','glyphSourceFnt']].map(([v,k])=>`<button type="button" data-action="ui-set" data-key="check.source" data-value="${v}" aria-pressed="${c.source===v}">${esc(T(k))}</button>`).join('')}</div>
${c.source==='fnt'?`<label class="field"><span>${esc(T('loadFnt'))}</span><input type="file" id="fntFile" accept=".fnt,.txt,text/plain" data-local-drop></label><p class="hint">${esc(c.importedName?T('fntLoaded',{name:c.importedName,n:c.imported?.chars.length||0}):T('fntHint'))}</p>`:`<p class="hint">${esc(T('glyphSourceLabHint'))}</p>`}
<label class="field"><span>${esc(T('localeFile'))}</span><input type="file" id="localeFile" accept=".txt,.json,.csv,.tsv,.po,text/plain,application/json" data-local-drop></label>
<label class="field"><span>${esc(T('pasteText'))}</span><textarea data-opt="check.text" rows="6" spellcheck="false" placeholder="${esc(T('pasteHint'))}">${esc(c.text)}</textarea></label>
</form>
<button type="button" class="primary big" data-action="ui-export-missing">${esc(T('exportMissing'))}</button>
<p class="hint">${esc(T('ttfLimit'))}</p>`;
    if(c.tab==='sizes')return `<div class="summary" id="sizeSummary" role="status" aria-live="polite"></div>
<form class="options" autocomplete="off">
<span class="opt-label">${esc(T('screen'))}</span>
<div class="segmented" role="group">${LAY.SCREENS.map(s=>`<button type="button" data-action="ui-set" data-key="check.screen" data-value="${s.id}" aria-pressed="${c.screen===s.id}">${esc(s.id)}</button>`).join('')}</div>
<span class="opt-label">${esc(T('aspect'))}</span>
<div class="segmented" role="group">${LAY.ASPECTS.map(a=>`<button type="button" data-action="ui-set" data-key="check.aspect" data-value="${a.id}" aria-pressed="${c.aspect===a.id}">${esc(a.id)}</button>`).join('')}</div>
<label class="field"><span>${esc(T('anchor'))}</span><select data-opt="check.anchor">${Object.keys(LAY.ANCHORS).map(k=>`<option value="${k}" ${c.anchor===k?'selected':''}>${k}</option>`).join('')}</select></label>
<label class="field"><span>${esc(T('safeArea'))}</span><select data-opt="check.safe"><option value="none" ${c.safe==='none'?'selected':''}>${esc(T('safeNone'))}</option>${LAY.SAFE_AREAS.map(s=>`<option value="${s.id}" ${c.safe===s.id?'selected':''}>${esc(T('safe.'+s.id))}</option>`).join('')}<option value="custom" ${c.safe==='custom'?'selected':''}>${esc(T('safeCustom'))}</option></select></label>
${c.safe==='custom'?`<div class="field-row"><label class="field"><span>${esc(T('insetX'))}</span><input type="number" data-opt="check.insetX" min="0" max="400" value="${c.insetX}" inputmode="numeric"></label><label class="field"><span>${esc(T('insetY'))}</span><input type="number" data-opt="check.insetY" min="0" max="400" value="${c.insetY}" inputmode="numeric"></label></div>`:''}
<p class="hint">${esc(T('anchorNote'))}</p></form>`;
    if(c.tab==='text')return `<div class="summary" id="textSummary" role="status" aria-live="polite"></div>
<form class="options" autocomplete="off">
<div class="field-row"><label class="field"><span>${esc(T('boxW'))}</span><input type="number" data-opt="check.boxW" min="20" max="2000" value="${c.boxW}" inputmode="numeric"></label>
<label class="field"><span>${esc(T('boxH'))}</span><input type="number" data-opt="check.boxH" min="10" max="1000" value="${c.boxH}" inputmode="numeric"></label></div>
<div class="field-row"><label class="field"><span>${esc(T('fontSize'))}</span><input type="number" data-opt="check.fontSize" min="6" max="96" value="${c.fontSize}" inputmode="numeric"></label>
<label class="field"><span>${esc(T('wrapMode'))}</span><select data-opt="check.wrapMode">${['single','wrap','truncate'].map(m=>`<option value="${m}" ${c.wrapMode===m?'selected':''}>${esc(T('wrap.'+m))}</option>`).join('')}</select></label></div>
${['ko','en','ja'].map(l=>`<label class="field"><span>${esc(T('string.'+l))}</span><input type="text" data-string="${l}" value="${esc(c.strings[l])}" placeholder="${esc(T('sampleString.'+l))}" maxlength="160" spellcheck="false" lang="${l}"></label>`).join('')}
<p class="hint">${esc(T('overflowNote'))}</p></form>`;
    return `<div class="summary" id="contrastSummary" role="status" aria-live="polite"></div>
<form class="options" autocomplete="off">
<div class="field-row"><label class="field inline"><span>${esc(T('foreground'))}</span><input type="color" data-opt="check.fg" value="${esc(c.fg)}"></label>
<label class="field inline"><span>${esc(T('background'))}</span><input type="color" data-opt="check.bg" value="${esc(c.bg)}"></label></div>
<div class="field-row"><label class="field"><span>${esc(T('fontSize'))}</span><input type="number" data-opt="check.fontPx" min="6" max="96" value="${c.fontPx}" inputmode="numeric"></label>
<label class="check"><input type="checkbox" data-opt="check.bold" ${c.bold?'checked':''}> ${esc(T('boldText'))}</label></div>
<p class="hint">${esc(T('contrastNote'))}</p></form>`;
   },
   paint(){paintCheck();}
  }
 };
 // ---------- element detection and packing ----------
 function detectElements(){
  if(!source)return;
  const list=components(rgba(source),source.width,source.height,{threshold:S.atlas.threshold,minArea:Math.max(1,S.atlas.minArea)});
  const merged=LAY.mergeRects(list,S.atlas.merge);
  const previous=new Map((S.atlas.elements||[]).map(e=>[`${e.rect.x},${e.rect.y},${e.rect.w},${e.rect.h}`,e]));
  S.atlas.elements=merged.map((r,i)=>{
   const key=`${r.x},${r.y},${r.w},${r.h}`,old=previous.get(key);
   return old||{name:`element-${String(i+1).padStart(2,'0')}`,rect:{x:r.x,y:r.y,w:r.w,h:r.h},parts:r.parts,border:null};
  });
 }
 function packAtlas(){
  const host=$('#uiAtlasHost'),canvas=$('#uiAtlasCanvas'),list=S.atlas.elements||[];
  const summary=$('#atlasSummary');
  if(!list.length){S.atlas.packed=null;canvas.width=canvas.height=1;host.hidden=true;summary.className='summary warn';summary.innerHTML=`<div class="summary-line">${esc(T('noElements'))}</div>`;return;}
  host.hidden=false;summary.className='summary';
  const e=S.atlas.extrude;
  try{
   const packed=packRects(list.map((item,i)=>({id:String(i),w:item.rect.w+e*2,h:item.rect.h+e*2})),{padding:S.atlas.padding,maxSize:4096});
   canvas.width=packed.width;canvas.height=packed.height;
   const x=canvas.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,packed.width,packed.height);
   const placed=new Map(packed.placements.map(p=>[p.id,p]));
   const frames=list.map((item,i)=>{
    const p=placed.get(String(i)),r=item.rect;
    for(let dy=-e;dy<r.h+e;dy++)for(let dx=-e;dx<r.w+e;dx++){
     if(e&&(dx<0||dy<0||dx>=r.w||dy>=r.h)){
      const sx=r.x+clamp(dx,0,r.w-1),sy=r.y+clamp(dy,0,r.h-1);
      x.drawImage(source,sx,sy,1,1,p.x+e+dx,p.y+e+dy,1,1);
     }
    }
    x.drawImage(source,r.x,r.y,r.w,r.h,p.x+e,p.y+e,r.w,r.h);
    return {name:item.name,rect:{x:p.x+e,y:p.y+e,w:r.w,h:r.h},sourceSize:{w:r.w,h:r.h},nineSlice:item.border||null,tag:item.parts>1?'merged':''};
   });
   S.atlas.packed={width:packed.width,height:packed.height,frames};
   fitHost(host,packed.width,packed.height,300);canvas.classList.add('px');
   $('#uiAtlasSvg').setAttribute('viewBox',`0 0 ${packed.width} ${packed.height}`);
   $('#uiAtlasSvg').innerHTML=frames.map(f=>`<rect x="${f.rect.x}" y="${f.rect.y}" width="${f.rect.w}" height="${f.rect.h}"/>`).join('');
   $('#atlasInfo').textContent=`${packed.width} × ${packed.height}`;
   summary.innerHTML=`<div class="summary-big">${packed.width} × ${packed.height}</div><div class="summary-line">${esc(T('elementCount',{n:list.length}))}</div>`;
  }catch(error){S.atlas.packed=null;summary.className='summary warn';summary.innerHTML=`<div class="summary-line">${esc(error.message)}</div>`;}
 }
 // ---------- font building ----------
 function fontChars(){return Array.from(S.font.chars).filter((c,i,a)=>a.indexOf(c)===i&&!/[\n\r]/.test(c)).join('');}
 function buildFont(){
  const f=S.font,summary=$('#fontSummary'),info=$('#fontInfo'),note=$('#fontNote');
  const chars=fontChars();
  releaseFontSheet();
  try{
   if(!chars)throw Error(T('needChars'));
   if(f.mode==='ttf'){
    if(!f.family)throw Error(T('needFontFile'));
    f.sheet=renderTTFSheet(chars);
   }else{
    if(!source)throw Error(T('needImage'));
    f.sheet=null;
   }
   const sheet=f.sheet||source;
   if(f.mode==='grid'&&!f.sheet)f.built=BM.gridFont({width:sheet.width,height:sheet.height,cellW:f.cellW,cellH:f.cellH,chars,baseline:f.baseline||f.cellH,face:'Nerulio Grid'});
   else{
    const cellW=f.sheet?f.sheet.cellW:f.cellW,cellH=f.sheet?f.sheet.cellH:f.cellH;
    f.built=BM.measuredFont({data:rgba(sheet),width:sheet.width,height:sheet.height,cellW,cellH,chars,
     baseline:f.sheet?f.sheet.baseline:(f.baseline||f.cellH),spacing:f.spacing,advances:f.sheet?f.sheet.advances:null,
     face:f.sheet?`Nerulio ${f.fileName||'font'}`:'Nerulio Measured'});
   }
   drawFontPreview(sheet,f.built);
   info.textContent=`${sheet.width} × ${sheet.height}`;
   summary.className='summary';
   summary.innerHTML=`<div class="summary-big">${f.built.glyphs.length}</div><div class="summary-line">${esc(T('glyphCount',{n:f.built.glyphs.length,mode:T('fontMode.'+f.mode)}))}</div>`;
   note.textContent=T(f.mode==='grid'?'fontNoteGrid':f.mode==='measured'?'fontNoteMeasured':'fontNoteTtf');
   $('#fontHost').hidden=false;$('#fontSampleWrap').hidden=false;
  }catch(error){
   f.built=null;summary.className='summary warn';summary.innerHTML=`<div class="summary-line">${esc(error.message)}</div>`;info.textContent='';
   const canvas=$('#fontCanvas');canvas.width=canvas.height=1;$('#fontSvg').innerHTML='';
   const sampleCanvas=$('#fontSampleCanvas');sampleCanvas.width=sampleCanvas.height=1;note.textContent='';
   $('#fontHost').hidden=true;$('#fontSampleWrap').hidden=true;
  }
 }
 /** Renders the chosen characters into a uniform grid with a known baseline, then the tested
  * metric code measures that raster: the sheet the user downloads is the sheet we measured. */
 function renderTTFSheet(chars){
  const f=S.font,list=Array.from(chars),probe=Im.canvas(8,8),pc=probe.getContext('2d');
  pc.font=`${f.size}px "${f.family}"`;
  const metrics=pc.measureText('Hg');
  const ascent=Math.ceil(metrics.fontBoundingBoxAscent||f.size*.8),descent=Math.ceil(metrics.fontBoundingBoxDescent||f.size*.25);
  const advances=new Map(list.map(ch=>[ch,pc.measureText(ch).width]));
  const pad=f.sdf?f.spread:1;
  const cellW=Math.ceil(Math.max(...advances.values(),f.size*.5))+pad*2,cellH=ascent+descent+pad*2;
  const columns=Math.min(list.length,Math.ceil(Math.sqrt(list.length))),rows=Math.ceil(list.length/columns);
  const canvas=Im.canvas(columns*cellW,rows*cellH),x=canvas.getContext('2d');
  x.font=`${f.size}px "${f.family}"`;x.textBaseline='alphabetic';x.fillStyle='#fff';
  Im.release(probe);
  list.forEach((ch,i)=>x.fillText(ch,(i%columns)*cellW+pad,Math.floor(i/columns)*cellH+pad+ascent));
  canvas.cellW=cellW;canvas.cellH=cellH;canvas.baseline=pad+ascent;canvas.advances=advances;
  return canvas;
 }
 function drawFontPreview(sheet,font){
  const canvas=$('#fontCanvas'),host=$('#fontHost');
  canvas.width=sheet.width;canvas.height=sheet.height;
  const x=canvas.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,sheet.width,sheet.height);x.drawImage(sheet,0,0);
  canvas.classList.add('px');fitHost(host,sheet.width,sheet.height,300);
  $('#fontSvg').setAttribute('viewBox',`0 0 ${sheet.width} ${sheet.height}`);
  $('#fontSvg').innerHTML=font.glyphs.filter(g=>g.w&&g.h).map(g=>`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/>`).join('');
  // A line of the font's own glyphs, placed with its own metrics: a wrong advance shows here.
  const line=BM.layoutLine(font,font.glyphs.slice(0,24).map(g=>g.char).join('')),sample=$('#fontSampleCanvas');
  sample.width=Math.max(1,Math.ceil(line.width));sample.height=font.lineHeight;
  const sx=sample.getContext('2d');sx.imageSmoothingEnabled=false;
  for(const item of line.items)if(item.glyph?.w)sx.drawImage(sheet,item.glyph.x,item.glyph.y,item.glyph.w,item.glyph.h,Math.round(item.x),Math.round(item.y),item.glyph.w,item.glyph.h);
  sample.classList.add('px');
 }
 // ---------- check stage ----------
 function paintCheck(){
  const host=$('#checkBoard'),c=S.check;
  if(c.tab==='glyphs')return paintGlyphs(host);
  if(c.tab==='sizes')return paintSizes(host);
  if(c.tab==='text')return paintText(host);
  return paintContrast(host);
 }
 function paintGlyphs(host){
  const have=glyphSet(),body=S.check.text;
  const missing=body?BM.missingCharacters(body,have):[];
  const used=body?[...BM.occurrences(body).keys()].filter(ch=>!/^\s$/.test(ch)).length:0;
  host.innerHTML=`<div class="ui-report">${!body?`<p class="hint">${esc(T('glyphEmpty'))}</p>`:
   !have.size?`<p class="hint bad">${esc(T('glyphNoFont'))}</p>`:
   missing.length?`<table class="ui-table"><caption>${esc(T('missingCount',{n:missing.length,used}))}</caption>
<thead><tr><th>${esc(T('character'))}</th><th>U+</th><th>${esc(T('count'))}</th><th>${esc(T('lines'))}</th></tr></thead>
<tbody>${missing.slice(0,300).map(m=>`<tr><td class="ui-char">${esc(m.char)}</td><td>${m.codepoint.toString(16).toUpperCase().padStart(4,'0')}</td><td>${m.count}</td><td>${m.lines.join(', ')}</td></tr>`).join('')}</tbody></table>`
   :`<p class="ui-good">${esc(T('missingNone',{used}))}</p>`}</div>`;
  const summary=$('#glyphSummary');
  if(summary){
   summary.className=body&&missing.length?'summary warn':'summary';
   summary.innerHTML=(body?`<div class="summary-big">${missing.length}</div>`:'')+`<div class="summary-line">${esc(T('glyphSummaryLine',{have:have.size,used}))}</div>`;
  }
 }
 function paintSizes(host){
  const c=S.check,screen=LAY.SCREENS.find(s=>s.id===c.screen)||LAY.SCREENS[1],ratio=LAY.ASPECTS.find(a=>a.id===c.aspect).ratio;
  const w=screen.w,h=Math.round(screen.w/ratio);
  const child=target()?{w:clamp(Math.round(w*.22),target().width,1200),h:clamp(Math.round(h*.09),target().height,400)}:{w:320,h:96};
  const box=LAY.anchoredRect(c.anchor,{w,h},child,Math.round(w/60));
  const safe=c.safe==='none'?null:c.safe==='custom'?LAY.safeRect(w,h,{insets:{left:c.insetX,right:c.insetX,top:c.insetY,bottom:c.insetY}})
   :LAY.safeRect(w,h,{percent:LAY.SAFE_AREAS.find(s=>s.id===c.safe).percent});
  const screenCanvas=Im.canvas(w,h),x=screenCanvas.getContext('2d');
  x.fillStyle='#101726';x.fillRect(0,0,w,h);
  x.strokeStyle='#2b3a55';x.lineWidth=Math.max(1,Math.round(h/540));
  for(let i=1;i<3;i++){x.beginPath();x.moveTo(w*i/3,0);x.lineTo(w*i/3,h);x.moveTo(0,h*i/3);x.lineTo(w,h*i/3);x.stroke();}
  if(safe){x.setLineDash([16,12]);x.strokeStyle='#f5a524';x.lineWidth=Math.max(2,Math.round(h/360));x.strokeRect(safe.x,safe.y,safe.w,safe.h);x.setLineDash([]);}
  // The element is drawn at the size the anchor gives it, through the same nine-slice plan the
  // 9-Slice stage previews: this is the panel at that size, not a stretched screenshot of it.
  if(target()&&box.w>0&&box.h>0){
   const element=renderNine(target(),S.border,box.w,box.h,S.slice);
   x.imageSmoothingEnabled=false;x.drawImage(element,box.x,box.y);Im.release(element);
  }
  host.innerHTML=`<figure class="ui-screenfig"><figcaption>${w} × ${h} · ${esc(c.aspect)} · ${esc(c.anchor)}${safe?' · '+esc(c.safe==='custom'?T('safeCustom'):T('safe.'+c.safe)):''}</figcaption><div class="ui-screen" id="screenBox"></div></figure>
<div class="ui-scalegrid" id="scaleGrid"></div>`;
  const shown=$('#screenBox');shown.style.aspectRatio=`${w} / ${h}`;screenCanvas.className='ui-screen-canvas';shown.append(screenCanvas);
  const summary=$('#sizeSummary');
  if(summary)summary.innerHTML=`<div class="summary-big">${box.w} × ${box.h}</div><div class="summary-line">${esc(T('anchorLine',{x:box.x,y:box.y}))}</div>`+
   (safe?`<div class="summary-line">${esc(T('safeLine',{x:safe.x,y:safe.y,w:safe.w,h:safe.h}))}</div>`:'');
  paintScales($('#scaleGrid'));
 }
 function paintScales(host){
  if(!host)return;
  if(!target()){host.innerHTML=`<p class="hint">${esc(T('needImageHint'))}</p>`;return;}
  const base=renderNine(target(),S.border,Math.min(160,Math.max(target().width,120)),Math.min(64,Math.max(target().height,40)),S.slice);
  host.innerHTML=`<div class="view-head"><strong>${esc(T('scaleCompare'))}</strong><span>${esc(T('scaleNote'))}</span></div>
<div class="ui-scales">${LAY.SCALES.map((s,i)=>`<figure class="ui-scale${LAY.isCrisp(s)?' crisp':''}"><div class="ui-scale-art" data-scale="${i}"></div><figcaption>${s}× · ${esc(T(LAY.isCrisp(s)?'crisp':'blurry'))}</figcaption></figure>`).join('')}</div>`;
  LAY.SCALES.forEach((s,i)=>{
   const slot=host.querySelector(`[data-scale="${i}"]`),w=Math.round(base.width*s),h=Math.round(base.height*s);
   const canvas=Im.canvas(w,h),x=canvas.getContext('2d');
   // A fractional scale cannot land source pixels on whole screen pixels; drawing it the way a
   // UI at that scale draws it is what the softness in this comparison is.
   x.imageSmoothingEnabled=!LAY.isCrisp(s);x.imageSmoothingQuality='high';x.drawImage(base,0,0,w,h);
   canvas.className='ui-scale-canvas';slot.append(canvas);
  });
  Im.release(base);
 }
 function paintText(host){
  const c=S.check,probe=Im.canvas(8,8),x=probe.getContext('2d');
  const rows=['ko','en','ja'].map(locale=>{
   const value=c.strings[locale]||T('sampleString.'+locale);
   x.font=`${c.fontSize}px system-ui, "Segoe UI", "Malgun Gothic", "Yu Gothic", sans-serif`;
   const width=x.measureText(value).width,lineHeight=Math.ceil(c.fontSize*1.35);
   const spaced=value.includes(' ');
   const chunks=spaced?value.split(/\s+/).filter(Boolean).map(word=>({text:word,width:x.measureText(word).width}))
    :Array.from(value).map(ch=>({text:ch,width:x.measureText(ch).width}));
   const fit=LAY.textFit({width,lineHeight,boxWidth:c.boxW,boxHeight:c.boxH,chunks,spaceWidth:spaced?x.measureText(' ').width:0,mode:c.wrapMode});
   return {locale,value,fit};
  });
  Im.release(probe);
  host.innerHTML=`<div class="ui-overflow">${rows.map(r=>`<figure class="ui-overflow-row">
<figcaption><b>${esc(T('string.'+r.locale))}</b> <span class="pill ${r.fit.fits?'good':'bad'}">${esc(T('status.'+r.fit.status))}</span> <small>${r.fit.width}px / ${c.boxW}px · ${r.fit.lines}${esc(T('linesShort'))}</small></figcaption>
<div class="ui-textbox" style="width:${c.boxW}px;height:${c.boxH}px"><span class="${c.wrapMode==='single'?'nowrap':c.wrapMode==='truncate'?'truncate':''}" style="font-size:${c.fontSize}px" lang="${r.locale}">${esc(r.value)}</span></div></figure>`).join('')}</div>`;
  const summary=$('#textSummary'),bad=rows.filter(r=>!r.fit.fits).length;
  if(summary)summary.innerHTML=`<div class="summary-big">${bad?T('overflowN',{n:bad}):T('overflowNone')}</div><div class="summary-line">${esc(T('overflowLine',{w:c.boxW,h:c.boxH,size:c.fontSize}))}</div>`;
 }
 function paintContrast(host){
  const c=S.check,ratio=contrastRatio(c.fg,c.bg),level=wcag(ratio,{fontSizePx:c.fontPx,bold:c.bold});
  const badge=(label,pass)=>`<span class="pill ${pass?'good':'bad'}">${esc(label)} ${pass?'✓':'✗'}</span>`;
  host.innerHTML=`<div class="ui-contrast"><div class="ui-swatch" style="background:${esc(c.bg)};color:${esc(c.fg)}"><span style="font-size:${c.fontPx}px;font-weight:${c.bold?800:500}">${esc(T('contrastSample'))}</span></div>
<div class="ui-contrast-figures"><strong>${round2(ratio)}:1</strong>
<div class="chips-row">${badge('AA',level.aa)}${badge('AAA',level.aaa)}${badge(T('uiComponent'),level.ui)}</div>
<p class="hint">${esc(T('contrastNeeded',{aa:level.needed.aa,aaa:level.needed.aaa,large:T(level.large?'largeYes':'largeNo')}))}</p>
<p class="hint">${esc(T('contrastNote'))}</p></div></div>`;
  const summary=$('#contrastSummary');
  if(summary)summary.innerHTML=`<div class="summary-big">${round2(ratio)}:1</div><div class="summary-line">${esc(T('contrastLine',{fg:c.fg,bg:c.bg}))}</div>`;
 }
 // ---------- exports ----------
 const setupNotes=(border,w,h)=>{
  const e=NS.engineBorders(border,w,h);
  return [T('setup.title'),'',T('setup.numbers',{l:e.pixels.left,r:e.pixels.right,t:e.pixels.top,b:e.pixels.bottom}),'',
   '## Godot 4','',T('setup.godot1'),T('setup.godot2',{l:e.godot4.patch_margin_left,r:e.godot4.patch_margin_right,t:e.godot4.patch_margin_top,b:e.godot4.patch_margin_bottom}),T('setup.godot3'),'',
   '## Unity','',T('setup.unity1'),T('setup.unity2',{border:e.unity.border.join(', ')}),T('setup.unity3'),'',
   '## '+T('setup.normalized'),'',`left=${e.normalized.left.toFixed(4)} right=${e.normalized.right.toFixed(4)} top=${e.normalized.top.toFixed(4)} bottom=${e.normalized.bottom.toFixed(4)}`,'',
   T('setup.unverified'),''].join('\n');
 };
 const textFile=(name,body)=>({name,blob:new Blob([body],{type:'text/plain;charset=utf-8'})});
 const jsonFile=(name,value)=>({name,blob:new Blob([JSON.stringify(value,null,2)],{type:'application/json'})});
 async function pngFile(name,canvas){return {name,blob:await Im.blobOf(canvas)};}
 async function exportSlice(){
  const image=target(),base=panelName(),entries=[await pngFile(`${base}.png`,image)],previews=[];
  for(const [w,h] of previewTargets()){
   const canvas=renderNine(image,S.border,w,h,S.slice);
   entries.push(await pngFile(`previews/${w}x${h}.png`,canvas));Im.release(canvas);
   previews.push({width:w,height:h,mode:planFor(w,h).mode,scale:S.slice.scale});
  }
  entries.push(jsonFile('nine-slice.json',envelope({tool:'nerulio-ui-lab-nine-slice',image:`${base}.png`,width:image.width,height:image.height,
   frames:[{name:base,rect:{x:0,y:0,w:image.width,h:image.height},nineSlice:S.border}],
   extra:{nineSlice:{mode:S.slice.mode,scale:S.slice.scale,pixelated:S.slice.pixelated,previews}}})),
   textFile('SETUP.md',setupNotes(S.border,image.width,image.height)));
  await save(entries,`${base}-nine-slice.zip`);
 }
 /** The packed strip, built once and used by both the preview and the export. */
 function buildStrip(){
  const made=S.states.canvases;if(!made)throw Error(T('needImage'));
  const packed=packRects(ST.STATES.map(name=>({id:name,w:made[name].canvas.width,h:made[name].canvas.height})),{padding:S.atlas.padding,maxSize:4096});
  const canvas=Im.canvas(packed.width,packed.height),x=canvas.getContext('2d');x.imageSmoothingEnabled=false;
  const frames=packed.placements.map(p=>{
   x.drawImage(made[p.id].canvas,p.x,p.y);
   return {name:p.id,rect:{x:p.x,y:p.y,w:p.w,h:p.h},state:p.id,pivot:{x:.5,y:.5},tag:made[p.id].applied.join(' · ')};
  });
  return {canvas,width:packed.width,height:packed.height,frames};
 }
 async function exportStates(){
  const made=S.states.canvases;if(!made)throw Error(T('needImage'));
  const base=stem(sourceName)||'button',entries=[];
  for(const name of ST.STATES)entries.push(await pngFile(`states/${name}.png`,made[name].canvas));
  // The strip on screen is the strip in the ZIP: the same canvas the preview shows.
  const strip=S.states.strip||buildStrip();
  entries.push(await pngFile(`${base}-states.png`,strip.canvas),
   jsonFile('states.json',envelope({tool:'nerulio-ui-lab-states',image:`${base}-states.png`,width:strip.width,height:strip.height,frames:strip.frames,
    extra:{states:Object.fromEntries(ST.STATES.map(name=>[name,{ops:S.states.ops[name],padding:made[name].pad,size:{w:made[name].canvas.width,h:made[name].canvas.height}}]))}})),
   textFile('README.txt',T('statesReadme')));
  await save(entries,`${base}-states.zip`);
 }
 async function exportAtlas(){
  const packed=S.atlas.packed;if(!packed)throw Error(T('noElements'));
  const canvas=$('#uiAtlasCanvas');
  const entries=[await pngFile('ui-atlas.png',canvas),
   jsonFile('ui-atlas.json',envelope({tool:'nerulio-ui-lab-atlas',image:'ui-atlas.png',width:packed.width,height:packed.height,frames:packed.frames,
    extra:{packing:{padding:S.atlas.padding,extrude:S.atlas.extrude,mergeDistance:S.atlas.merge,alphaThreshold:S.atlas.threshold}}}))];
  const sliced=packed.frames.filter(f=>f.nineSlice);
  if(sliced.length)entries.push(textFile('SETUP.md',sliced.map(f=>`# ${f.name}\n\n`+setupNotes(f.nineSlice,f.rect.w,f.rect.h)).join('\n')));
  await save(entries,'ui-atlas.zip');
 }
 async function exportFont(){
  const f=S.font;if(!f.built)throw Error(T('needChars'));
  const sheet=f.sheet||source,entries=[await pngFile('font.png',sheet),
   jsonFile('font.json',f.built),textFile('font.fnt',BM.fntText(f.built)),textFile('README.txt',T('fontReadme'))];
  if(f.sdf){
   const sdfSheet=buildSDFSheet(sheet,f.built,f.spread);
   entries.push(await pngFile('font-sdf.png',sdfSheet.canvas),jsonFile('font-sdf.json',sdfSheet.meta),textFile('font-sdf.txt',T('sdfReadme',{spread:f.spread,shader:SDF.SHADER_NOTE(f.spread)})));
   Im.release(sdfSheet.canvas);
  }
  await save(entries,'bitmap-font.zip');
 }
 /** Per-glyph signed distance field: each glyph's own padded cell is rasterised at 4×, the exact
  * distance transform runs on that cell alone (so a neighbour can never bleed into its ramp),
  * and the result is stored back in the same cell. Beta: not validated inside an engine. */
 function buildSDFSheet(sheet,font,spread){
  const scale=clamp(Math.floor(4096/Math.max(sheet.width,sheet.height)),1,4);
  const canvas=Im.canvas(sheet.width,sheet.height),out=canvas.getContext('2d');
  const hi=Im.canvas(sheet.width*scale,sheet.height*scale),hx=hi.getContext('2d');
  hx.imageSmoothingEnabled=false;hx.drawImage(sheet,0,0,hi.width,hi.height);
  const hiData=rgba(hi),glyphs=[];
  for(const g of font.glyphs){
   const pad=spread,x0=Math.max(0,g.x-pad),y0=Math.max(0,g.y-pad);
   const w=Math.min(sheet.width-x0,g.w+pad*2),h=Math.min(sheet.height-y0,g.h+pad*2);
   if(w<1||h<1){glyphs.push({...g,sdf:null});continue;}
   const hw=w*scale,hh=h*scale,cell=new Uint8ClampedArray(hw*hh*4);
   for(let y=0;y<hh;y++){
    const sy=y0*scale+y;if(sy>=hi.height)break;
    cell.set(hiData.subarray((sy*hi.width+x0*scale)*4,(sy*hi.width+x0*scale+hw)*4),y*hw*4);
   }
   const field=SDF.downsample(SDF.signedDistanceField(cell,hw,hh),hw,hh,scale);
   const bytes=SDF.encode(field.field,field.width,field.height,{spread});
   out.putImageData(new ImageData(bytes,field.width,field.height),x0,y0);
   glyphs.push({char:g.char,codepoint:g.codepoint,x:x0,y:y0,w:field.width,h:field.height,xOffset:g.xOffset-(g.x-x0),yOffset:g.yOffset-(g.y-y0),xAdvance:g.xAdvance});
  }
  Im.release(hi);
  return {canvas,meta:{format:'nerulio-sdf-font-v1',beta:true,spread,scale,channels:'distance in R, G and B; alpha stays 255',contour:128,
   shader:SDF.SHADER_NOTE(spread),image:'font-sdf.png',width:sheet.width,height:sheet.height,lineHeight:font.lineHeight,baseline:font.baseline,glyphs}};
 }
 async function exportMissing(){
  const have=glyphSet(),body=S.check.text;
  if(!body)throw Error(T('glyphEmpty'));
  const missing=BM.missingCharacters(body,have);
  await save([jsonFile('missing-glyphs.json',{format:'nerulio-missing-glyphs-v1',checkedCharacters:[...BM.occurrences(body).keys()].length,
   fontGlyphs:have.size,source:S.check.source==='fnt'?S.check.importedName:'ui-lab-font',
   missing:missing.map(m=>({char:m.char,codepoint:'U+'+m.codepoint.toString(16).toUpperCase().padStart(4,'0'),count:m.count,lines:m.lines}))}),
   textFile('missing-glyphs.txt',missing.map(m=>m.char).join(''))],'missing-glyphs.zip');
 }
 async function save(entries,name){
  const blob=await zip(entries,{paths:true});download(blob,name);
  track('tool_success',{intent:route.id});toast(T('saved',{size:bytes(blob.size)}));
 }
 // ---------- samples ----------
 async function sample(){
  const make=async(canvas,name)=>{const file=new File([await Im.blobOf(canvas)],name,{type:'image/png'});Im.release(canvas);return [file];};
  if(stage==='states'){
   const c=Im.canvas(96,32),x=c.getContext('2d');
   x.fillStyle='#2f6fed';x.fillRect(0,0,96,32);x.fillStyle='#1b4fc0';x.fillRect(0,28,96,4);
   x.fillStyle='#ffffff';x.fillRect(12,13,10,3);x.fillRect(26,13,18,3);x.fillRect(48,13,10,3);x.fillRect(62,13,22,3);
   return make(c,'button.png');
  }
  if(stage==='atlas'){
   const c=Im.canvas(128,64),x=c.getContext('2d');
   x.fillStyle='#3182f6';x.fillRect(4,4,40,16);x.fillStyle='#12925f';x.fillRect(56,6,24,24);
   x.fillStyle='#e5484d';x.beginPath();x.arc(104,18,12,0,Math.PI*2);x.fill();
   x.fillStyle='#8250df';x.fillRect(8,36,52,20);x.fillStyle='#f5a524';x.fillRect(72,40,44,12);
   return make(c,'ui-sheet.png');
  }
  if(stage==='font'){
   const glyphs='ABCDEFGH',c=Im.canvas(glyphs.length*8,8),x=c.getContext('2d');
   x.fillStyle='#ffffff';
   glyphs.split('').forEach((ch,i)=>{const w=2+i%3;x.fillRect(i*8+1,1,w,6);x.fillRect(i*8+1,1,5,1);});
   S.font.cellW=8;S.font.cellH=8;S.font.baseline=7;S.font.chars=glyphs;
   return make(c,'font-sheet.png');
  }
  // A panel with four different corners and a flat middle: the borders are findable and the
  // corners are distinguishable, which is exactly what the checks look at.
  const c=Im.canvas(24,24),x=c.getContext('2d');
  x.fillStyle='#24344d';x.fillRect(0,0,24,24);
  x.fillStyle='#38537d';x.fillRect(2,2,20,20);
  x.fillStyle='#4f7ec0';x.fillRect(6,6,12,12);
  for(const [px,py,colour] of [[0,0,'#e5484d'],[23,0,'#12925f'],[0,23,'#3182f6'],[23,23,'#f5a524']]){x.fillStyle=colour;x.fillRect(px,py,1,1);}
  return make(c,'panel.png');
 }
 // ---------- state plumbing ----------
 function assign(path,value){
  const [group,key]=path.split('.');
  if(group==='border'){
   S.border=NS.clampBorders({...S.border,[key]:value},target().width,target().height);
   // Borders edited for one element of a sheet belong to that element, not to the sheet.
   if(S.atlas.editing!=null)S.atlas.elements[S.atlas.editing].border={...S.border};
   return;
  }
  S[group][key]=value;
 }
 function readOption(input){
  const path=input.dataset.opt;if(!path)return null;
  const value=input.type==='checkbox'?input.checked:input.type==='number'?int(input.value,Number(input.min||0),Number(input.max||99999)):input.value;
  assign(path,value);return path;
 }
 function releaseStates(){
  if(S.states.canvases)for(const v of Object.values(S.states.canvases))Im.release(v.canvas);
  Im.release(S.states.strip?.canvas);S.states.canvases=null;S.states.strip=null;
 }
 /** Keeps a canvas host at its content's aspect ratio without letting it grow taller than
  * `maxHeight` on a wide screen, which a plain aspect-ratio box would. */
 const fitHost=(host,w,h,maxHeight)=>{host.style.aspectRatio=`${w} / ${h}`;host.style.maxWidth=Math.round(w/h*maxHeight)+'px';};
 function releaseFontSheet(){if(S.font.sheet){Im.release(S.font.sheet);S.font.sheet=null;}}
 function setStage(next){
  if(!STAGES.includes(next)||next===stage)return;
  stage=next;track('tool_run',{intent:route.id});
  if(source||!needsImage(stage)){if(!el.querySelector('.ui-lab'))frame();else{for(const b of el.querySelectorAll('[data-action="ui-stage"]'))b.setAttribute('aria-selected',String(b.dataset.stage===stage));paintStage();}}
  else empty();
 }
 async function add(files){
  if(busy)return;busy=true;
  try{
   const file=files[0];if(!file)return;
   const decoded=await Im.decode(file);
   Im.release(source);Im.release(panel);source=decoded;panel=null;sourceName=file.name;
   S.atlas.elements=null;S.atlas.editing=null;releaseStates();
   S.suggestion=null;
   S.border=firstFile?NS.clampBorders(presetBorder,decoded.width,decoded.height):{left:0,right:0,top:0,bottom:0};
   firstFile=false;
   if(stage==='slice')suggest({silent:true});
   frame();
  }catch(error){toast(error?.message||String(error),{error:true});if(!source)empty();}
  finally{busy=false;}
 }
 function suggest({silent=false}={}){
  const image=target();if(!image)return;
  S.suggestion=NS.suggestBorders(rgba(image),image.width,image.height);
  if(!silent)refresh();
 }
 function acceptSuggestion(){
  const s=S.suggestion;if(!s)return;
  for(const side of SIDES)assign('border.'+side,s[side]);
  S.suggestion=null;refresh();
 }
 async function loadLocalFile(input,kind){
  const file=input.files?.[0];if(!file)return;
  try{
   if(kind==='font'){
    const family='uilab-'+Math.random().toString(36).slice(2,8);
    const face=new FontFace(family,await file.arrayBuffer());await face.load();document.fonts.add(face);
    S.font.family=family;S.font.fileName=file.name;refresh();return;
   }
   const body=await file.text();
   if(kind==='fnt'){S.check.imported=BM.parseFnt(body);S.check.importedName=file.name;S.check.source='fnt';refresh();return;}
   S.check.text=BM.extractText(file.name,body);refresh();
  }catch(error){toast(error?.message||String(error),{error:true});}
 }
 // ---------- events ----------
 el.addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  try{
   if(action==='ui-stage')setStage(button.dataset.stage);
   else if(action==='ui-sample')await add(await sample());
   else if(action==='ui-set'){
    const [group,key]=button.dataset.key.split('.');let value=button.dataset.value;
    S[group][key]=/^-?\d+$/.test(value)?Number(value):value;
    if(button.dataset.key==='font.mode'||button.dataset.key==='check.tab'||button.dataset.key==='check.source')refresh();
    else if(button.dataset.key==='states.selected'){for(const b of el.querySelectorAll('[data-key="states.selected"]'))b.setAttribute('aria-pressed',String(b.dataset.value===value));refresh();}
    else{for(const sibling of button.parentElement.children)sibling.setAttribute('aria-pressed',String(sibling===button));VIEWS[stage].paint?.();}
   }
   else if(action==='ui-copy-link'){const link=settingsLink();await navigator.clipboard?.writeText(link);toast(T('copiedLink'));}
   else if(action==='ui-suggest')suggest();
   else if(action==='ui-accept')acceptSuggestion();
   else if(action==='ui-dismiss'){S.suggestion=null;refresh();}
   else if(action==='ui-detect'){S.atlas.elements=null;VIEWS.atlas.paint();}
   else if(action==='ui-element-slice'){
    const index=Number(button.dataset.index),item=S.atlas.elements[index];
    S.atlas.editing=index;S.border=item.border?{...item.border}:{left:0,right:0,top:0,bottom:0};
    Im.release(panel);panel=cropCanvas(source,item.rect);
    stage='slice';S.suggestion=null;frame();if(!item.border)suggest();
   }
   else if(action==='ui-back-atlas'){Im.release(panel);panel=null;S.atlas.editing=null;S.border={left:0,right:0,top:0,bottom:0};S.suggestion=null;setStage('atlas');}
   else if(action==='ui-element-drop'){S.atlas.elements.splice(Number(button.dataset.index),1);VIEWS.atlas.paint();}
   else if(action==='ui-reset-state'){S.states.ops[S.states.selected]=JSON.parse(JSON.stringify(ST.DEFAULT_OPS[S.states.selected]));refresh();}
   else if(action==='ui-charset'){
    const preset=button.dataset.preset;
    S.font.chars=BM.charset(S.font.sample||S.font.chars,preset).join('');
    S.font.preset=preset;refresh();
   }
   else if(action==='ui-export-slice')await exportSlice();
   else if(action==='ui-export-states')await exportStates();
   else if(action==='ui-export-atlas')await exportAtlas();
   else if(action==='ui-export-font')await exportFont();
   else if(action==='ui-export-missing')await exportMissing();
  }catch(error){toast(error?.message||String(error),{error:true});}
 });
 el.addEventListener('input',e=>{
  const input=e.target;
  if(input.dataset.opt){
   const path=readOption(input);
   // Detection settings describe how elements are found, so they have to be found again.
   if(['atlas.merge','atlas.minArea','atlas.threshold'].includes(path))S.atlas.elements=null;
   if(['font.mode','check.tab','check.safe','font.sdf'].includes(path))refresh();
   else VIEWS[stage].paint?.();
   return;
  }
  if(input.dataset.state){
   const op=S.states.ops[S.states.selected],key=input.dataset.state;
   op[key]=input.type==='color'?input.value:Number(input.value)||0;
   VIEWS.states.paint();return;
  }
  if(input.dataset.element){S.atlas.elements[Number(input.dataset.element)].name=input.value.trim()||`element-${Number(input.dataset.element)+1}`;packAtlas();return;}
  if(input.dataset.string){S.check.strings[input.dataset.string]=input.value;paintCheck();}
 });
 el.addEventListener('change',e=>{
  if(e.target.id==='fontFile')loadLocalFile(e.target,'font');
  else if(e.target.id==='fntFile')loadLocalFile(e.target,'fnt');
  else if(e.target.id==='localeFile')loadLocalFile(e.target,'locale');
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  const guide=e.target.closest?.('.ns-guide');
  if(!guide||!source)return;
  const side=guide.dataset.guide,step=e.shiftKey?10:1;
  const delta={ArrowLeft:side==='left'?-step:side==='right'?step:0,ArrowRight:side==='left'?step:side==='right'?-step:0,
   ArrowUp:side==='top'?-step:side==='bottom'?step:0,ArrowDown:side==='top'?step:side==='bottom'?-step:0}[e.key];
  if(delta===undefined)return;
  e.preventDefault();assign('border.'+side,S.border[side]+delta);VIEWS.slice.paint();
 });
 // Dragging a guide, and dragging the custom preview's corner, both work in source pixels.
 el.addEventListener('pointerdown',e=>{
  const guide=e.target.closest?.('.ns-guide');
  if(guide&&source){drag={kind:'guide',side:guide.dataset.guide,zoom:sliceZoom(),rect:$('#nsArt').getBoundingClientRect()};guide.setPointerCapture?.(e.pointerId);e.preventDefault();return;}
  const handle=e.target.closest?.('[data-action="ui-resize"]');
  if(handle){const box=handle.closest('.ns-box').getBoundingClientRect();drag={kind:'resize',x:e.clientX,y:e.clientY,w:S.slice.customW,h:S.slice.customH,scale:S.slice.customW/box.width};handle.setPointerCapture?.(e.pointerId);e.preventDefault();}
 });
 el.addEventListener('pointermove',e=>{
  if(!drag)return;
  if(drag.kind==='guide'){
   const b=drag.rect,at=drag.side==='left'||drag.side==='right'?(e.clientX-b.left)/drag.zoom:(e.clientY-b.top)/drag.zoom;
   const value=drag.side==='left'||drag.side==='top'?at:(drag.side==='right'?source.width:source.height)-at;
   assign('border.'+drag.side,Math.round(value));
  }else{
   S.slice.customW=int(drag.w+(e.clientX-drag.x)*drag.scale,1,4096);
   S.slice.customH=int(drag.h+(e.clientY-drag.y)*drag.scale,1,4096);
   for(const input of el.querySelectorAll('[data-opt="slice.customW"],[data-opt="slice.customH"]'))input.value=input.dataset.opt.endsWith('W')?S.slice.customW:S.slice.customH;
  }
  VIEWS.slice.paint();
 });
 for(const type of ['pointerup','pointercancel'])el.addEventListener(type,()=>{drag=null;});
 // A .fnt, a .txt or a font file can be dropped straight onto its own field; the page-level
 // intake only accepts images, so those drops must not reach it.
 el.addEventListener('drop',e=>{
  const field=e.target.closest?.('input[data-local-drop]');
  if(!field||!e.dataTransfer?.files?.length)return;
  e.preventDefault();e.stopPropagation();
  const kind=field.id==='fontFile'?'font':field.id==='fntFile'?'fnt':'locale';
  loadLocalFile({files:e.dataTransfer.files},kind);
 },true);
 el.addEventListener('dragover',e=>{if(e.target.closest?.('input[data-local-drop]')){e.preventDefault();e.stopPropagation();}},true);
 onLocale(()=>{if(source||!needsImage(stage))frame();else empty();});
 if(needsImage(stage))empty();else frame();
 return {add};
}
