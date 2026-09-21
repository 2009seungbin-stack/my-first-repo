import * as Im from '../image.js';
import {pngRGBACompressed} from '../png-stream.js';
import {stem,zip,bytes} from '../core.js';
import {t} from '../i18n.js';
import {DITHER_MODES} from '../pixel-engine.js';
import * as P from '../game/palette.js';
import * as C from '../game/pixel-cleanup.js';
import * as K from '../game/pixel-check.js';
import {SCHEMA_VERSION} from '../game/model.js';
import {PALETTES} from './pixel.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** Pixel Lab — one workspace that takes several animation frames from "whatever the artist
 * exported" to a consistent, engine-ready pixel asset: extract ONE palette from all frames, lock
 * every frame to it, recolour ramps, clean up stray pixels and anti-aliasing, check the pixel grid
 * and export.
 *
 * The whole Lab is one pipeline, run per frame on demand:
 *   source → (optional) N×N base → indices + alpha (palette lock or anti-alias removal)
 *          → cleanup change list → palette re-map → RGBA → (optional) integer scale
 * The preview runs exactly this pipeline for the visible frame and the exporter runs it for each
 * frame in turn, so preview and export cannot drift apart. Only the decoded sources, the current
 * preview and one frame's indices are ever in memory; exports become Blobs one frame at a time. */
export const accept='image/*,.heic,.heif';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const natural=(a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});
export const STAGES=Object.freeze(['convert','palette','recolor','cleanup','check','export']);
const STAGE_FOR=Object.freeze({'pixel-lab':'convert','palette-extractor':'palette','palette-swap-ramp':'recolor','pixel-art-cleanup':'cleanup','pixel-perfect-checker':'check'});
const imageDataOf=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);
function canvasOf({data,width,height}){const c=Im.canvas(width,height);c.getContext('2d').putImageData(new ImageData(data,width,height),0,0);return c;}
// Every stage walks each pixel in Oklab on the main thread, which is right for sprite-sized art
// and wrong for a 100-megapixel scan. A frame above this is refused with an explanation instead of
// freezing the tab; the shared limit in core.js is far too permissive for a synchronous pipeline.
const MAX_FRAME_PIXELS=4096*4096;
const int=(v,min,max,fallback)=>{const n=Math.round(Number(v));return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;};
export function mount({el,def}){
 let sources=[],seq=0,at=0,stage=STAGE_FOR[route.id]||'convert',busy=false,timer=0,preview=null,report=null,candidates=null,history=[],paletteName='palette',lastExport=null;
 let palette=[],locks=[],counts=[],share=[],countScope='all',selection=new Set(),targetRamp=[],recolor={kind:'none'};
 const q=new URLSearchParams(route.query);
 let o={
  size:int(q.get('size'),8,512,0)||0,fit:['contain','cover','stretch'].includes(q.get('fit'))?q.get('fit'):'contain',trim:q.get('trim')==='1',
  colors:int(q.get('colors'),2,256,16),dither:DITHER_MODES.includes(q.get('dither'))?q.get('dither'):'none',amount:1,compare:false,
  classic:Object.hasOwn(PALETTES,q.get('palette'))?q.get('palette'):'',sort:'original',format:'gpl',
  orphans:false,clusters:false,minArea:4,holes:false,aa:false,aaThreshold:80,alphaCut:0,outline:-1,gapFix:false,
  showIO:false,silhouetteView:false,budget:int(q.get('budget'),2,256,16),scale:int(q.get('scale'),1,8,1),hue:0,window:30,tolerance:0,to:'#4a7fd8',preset:'frozen',teams:'red,blue,green,yellow'
 };
 const T=(k,v)=>text('plab.'+k,v);
 const frameAt=()=>sources[Math.min(at,sources.length-1)];
 /** Frame pixels one at a time: a generator keeps a single ImageData alive instead of N copies. */
 const pixelsOf=list=>(function*(){for(const s of list)yield imageDataOf(s.canvas);})();
 const COUNT_BUDGET=4_000_000;
 /** Undo keeps small state snapshots — palette, locks, options — never an image. */
 const pushHistory=()=>{
  history.push({palette:palette.map(c=>[...c]),locks:[...locks],o:{...o},recolor:{...recolor},selection:[...selection]});
  if(history.length>24)history.shift();
  const button=el.querySelector('[data-action="plab-undo"]');if(button)button.disabled=false;
 };
 function undo(){
  const last=history.pop();if(!last)return;
  palette=last.palette;locks=last.locks;o=last.o;recolor=last.recolor;selection=new Set(last.selection);
  shell();schedule();
 }
 // ── pipeline ────────────────────────────────────────────────────────────────────────────────
 /** The working palette every stage shares. Empty until the Palette stage extracts one. */
 function ensurePalette(){
  if(palette.length)return palette;
  if(o.classic){palette=P.parsePaletteFile(PALETTES[o.classic].join('\n')).colors;paletteName=o.classic;}
  else{palette=P.extract(pixelsOf(sources),o.colors).colors;paletteName='extracted';}
  locks=palette.map(()=>false);
  return palette;
 }
 /** Exact per-colour counts. Over the whole animation while that stays under a pixel budget,
  * otherwise for the visible frame only — and the panel says which. */
 function recount(){
  const total=sources.reduce((n,s)=>n+s.canvas.width*s.canvas.height,0),all=total<=COUNT_BUDGET;
  const usage=P.usage(pixelsOf(all?sources:[frameAt()]),palette);
  counts=usage.counts;share=usage.share;countScope=all?'all':'frame';
 }
 /** The palette the pixels are painted with: the working palette after the Recolor stage. */
 function outputPalette(){
  try{
   if(recolor.kind==='ramp'&&selection.size&&targetRamp.length)return P.rampMap(palette,[...selection],targetRamp);
   if(recolor.kind==='hue')return P.hueReplace(palette,{hue:o.hue,window:o.window,tolerance:o.tolerance,target:P.parseColor(o.to)||[74,127,216]}).colors;
   if(recolor.kind==='status')return P.tint(palette,P.STATUS_PRESETS[o.preset]||P.STATUS_PRESETS.frozen);
  }catch{/* an incomplete selection just means "no recolour yet" */}
  return palette;
 }
 function processFrame(source,colors,out){
  const base=o.size?Im.pixelBase(source.canvas,o.size,o.fit,o.trim):source.canvas;
  try{
   const img=imageDataOf(base),view={data:img.data,width:img.width,height:img.height};
   let indices,alpha,aa=null;
   if(o.aa){aa=C.removeAntiAlias(view,colors,{threshold:o.aaThreshold/1000,alphaCut:o.alphaCut||null});indices=aa.indices;alpha=aa.alpha;}
   else{const locked=P.lockFrame(view,colors,{mode:o.dither,amount:o.amount});indices=locked.indices;alpha=locked.alpha;}
   const frame={indices,width:img.width,height:img.height},found=C.detect(frame,{minArea:Math.max(2,o.minArea)});
   const changes=[...(o.orphans?found.orphans.changes:[]),...(o.clusters?found.clusters.changes:[]),...(o.holes?found.holes.changes:[])];
   const outline=o.gapFix&&o.outline>=0?C.outlineAudit(frame,o.outline).gapFix:[];
   if(changes.length||outline.length)indices=C.applyChanges(indices,[...changes,...outline]);
   const rgba=P.recolorIndexed(indices,alpha,out,{width:img.width,height:img.height});
   // Export encodes this exact buffer (src/png-stream.js), never a canvas: a canvas stores colour
   // premultiplied by alpha, so an anti-aliased edge pixel would come back a shade off the palette.
   const pixels=o.scale>1?K.nearestScale(rgba,o.scale):rgba;
   return {pixels,indices,alpha,width:img.width,height:img.height,found,aa,changed:changes.length+outline.length};
  }finally{if(base!==source.canvas)Im.release(base);}
 }
 function build(){
  if(!sources.length)return;
  const colors=ensurePalette(),out=outputPalette();
  preview=null;
  try{
   preview=processFrame(frameAt(),colors,out);
   // Counting and inspecting both walk every pixel, so they run for the stage that needs them.
   if(counts.length!==palette.length||stage==='palette')recount();
   if(stage==='check')report=K.inspect(imageDataOf(frameAt().canvas),{targetColors:o.budget});
   paint();renderSide();renderStrip();
  }catch(error){toast(error?.message||String(error),{error:true});}
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(build,50);};
 function paint(){
  const host=el.querySelector('#plabView');if(!host||!preview)return;
  const cv=el.querySelector('#plabCanvas'),ov=el.querySelector('#plabOverlay'),{data,width:w,height:h}=preview.pixels;
  cv.width=w;cv.height=h;const ctx=cv.getContext('2d');ctx.putImageData(new ImageData(data,w,h),0,0);
  host.style.aspectRatio=`${w} / ${h}`;
  ov.width=preview.width;ov.height=preview.height;const oc=ov.getContext('2d');oc.clearRect(0,0,ov.width,ov.height);
  if(candidates?.length){
   // Semi-transparent so the art stays readable underneath; the count is printed too, because a
   // colour alone must never be the only way to read a result.
   oc.globalAlpha=.8;oc.fillStyle='#ff2d95';
   for(const c of candidates){const x=c.at%preview.width,y=(c.at-x)/preview.width;oc.fillRect(x,y,1,1);}
  }
  el.querySelector('#plabInfo').textContent=`${preview.width} × ${preview.height}${o.scale>1?` → ${w} × ${h}`:''} · ${T('colorCount',{n:palette.length})}`;
  if(o.compare)paintCompare();
 }
 function paintCompare(){
  const host=el.querySelector('#plabCompareGrid');if(!host)return;
  for(const mode of DITHER_MODES){
   const cell=host.querySelector(`canvas[data-mode="${mode}"]`);if(!cell)continue;
   const saved=o.dither;o.dither=mode;
   let made=null;try{made=processFrame(frameAt(),palette,outputPalette());}catch{/* leave the cell blank */}finally{o.dither=saved;}
   if(!made)continue;
   const {data,width,height}=made.pixels;cell.width=width;cell.height=height;
   cell.getContext('2d').putImageData(new ImageData(data,width,height),0,0);
  }
 }
 // ── markup ──────────────────────────────────────────────────────────────────────────────────
 function empty(){el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="plab-sample">${esc(text('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;}
 const seg=(id,key,values,label)=>`<div class="segmented" role="group" id="${id}">${values.map(v=>`<button type="button" data-action="plab-set" data-key="${key}" data-value="${v}" aria-pressed="${String(o[key])===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
 const num=(id,key,min,max,label,step=1)=>`<label class="field"><span>${esc(label)}</span><input id="${id}" data-key="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${o[key]}" inputmode="numeric"></label>`;
 const check=(id,key,label)=>`<label class="check"><input id="${id}" data-key="${key}" type="checkbox" ${o[key]?'checked':''}> ${esc(label)}</label>`;
 function shell(){
  el.innerHTML=`<div class="work plab">
<section class="board">
 <nav class="plab-stages" aria-label="${esc(T('stagesLabel'))}">${STAGES.map(s=>`<button type="button" data-action="plab-stage" data-stage="${s}" aria-current="${s===stage?'page':'false'}">${esc(T('stages.'+s))}</button>`).join('')}</nav>
 <div class="view-head"><strong>${esc(T('stages.'+stage))}</strong><span id="plabInfo"></span><label class="check mini"><input id="plabCompareOn" data-key="compare" type="checkbox" ${o.compare?'checked':''}> ${esc(T('compare'))}</label></div>
 <div class="plab-view" id="plabView"><canvas id="plabCanvas" class="px"></canvas><canvas id="plabOverlay" class="px plab-layer"></canvas></div>
 ${o.compare?`<div class="plab-compare" id="plabCompareGrid">${DITHER_MODES.map(m=>`<figure><canvas class="px" data-mode="${m}"></canvas><figcaption>${esc(T('dithers.'+m))}</figcaption></figure>`).join('')}</div>`:''}
 <div class="view-head frames-head"><strong>${esc(T('frames'))}</strong><span id="plabCount"></span><button type="button" class="mini-button" data-action="plab-sort-frames">${esc(T('sortName'))}</button><button type="button" class="mini-button" data-action="pick">${esc(T('addFrames'))}</button></div>
 <div class="frame-strip" id="plabStrip"></div>
 <p class="viewer-note">${esc(T('note'))}</p>
</section>
<aside class="side">
 <div class="summary" id="plabSummary" role="status" aria-live="polite"></div>
 <form class="options" id="plabOptions" autocomplete="off">${stageControls()}</form>
 <div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('addFrames'))}</button><button type="button" class="link" data-action="plab-undo" ${history.length?'':'disabled'}>${esc(t('되돌리기'))}</button><button type="button" class="link" data-action="plab-clear">${esc(text('removeAll'))}</button></div>
 <button type="button" class="primary big" data-action="plab-export">${esc(T('exportFrames'))}</button>
 <div class="list-actions"><button type="button" class="mini-button" data-action="plab-export-one">${esc(T('exportOne'))}</button><button type="button" class="mini-button" data-action="plab-export-palette">${esc(T('exportPalette'))}</button><button type="button" class="link" data-action="plab-link">${esc(t('설정 링크 복사'))}</button></div>
 <nav class="next" id="plabNext"></nav>
 <small class="local-note">${esc(text('local'))}</small>
</aside></div>`;
 }
 function stageControls(){
  if(stage==='convert')return `<span class="opt-label">${esc(T('colors'))}</span>${seg('plabColors','colors',P.COUNT_PRESETS,v=>String(v))}
<span class="opt-label">${esc(T('dither'))}</span>${seg('plabDither','dither',DITHER_MODES,v=>T('dithers.'+v))}
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary>
${num('plabSize','size',0,512,T('size'))}<p class="hint">${esc(T('sizeHint'))}</p>
<label class="field"><span>${esc(T('fit'))}</span><select id="plabFit" data-key="fit">${['contain','cover','stretch'].map(f=>`<option value="${f}" ${o.fit===f?'selected':''}>${esc(text('resize.'+f))}</option>`).join('')}</select></label>
${check('plabTrim','trim',T('trim'))}
<label class="field"><span>${esc(T('classic'))}</span><select id="plabClassic" data-key="classic"><option value="">${esc(T('fromFrames'))}</option>${Object.keys(PALETTES).map(k=>`<option value="${k}" ${o.classic===k?'selected':''}>${esc(text('pixel.palettes.'+k))} (${PALETTES[k].length})</option>`).join('')}</select></label>
${num('plabAmount','amount',0,1,T('amount'),.1)}</details>
<p class="hint">${esc(P.flickers(o.dither)&&sources.length>1?T('flickerWarning'):T('ditherNote'))}</p>`;
  if(stage==='palette')return `<div id="plabSwatches" class="plab-swatches"></div><div id="plabPicked" class="plab-picked"></div>
<span class="opt-label">${esc(T('sort'))}</span><div class="chips-row">${P.SORT_MODES.map(m=>`<button type="button" class="chip" data-action="plab-sort" data-mode="${m}" aria-pressed="${o.sort===m}">${esc(T('sorts.'+m))}</button>`).join('')}</div>
<div class="list-actions"><button type="button" class="mini-button" data-action="plab-extract">${esc(T('extract'))}</button><button type="button" class="mini-button" data-action="plab-add-color">${esc(T('addColor'))}</button></div>
<details class="options-advanced" data-panel="io" ${o.showIO?'open':''}><summary>${esc(T('importExport'))}</summary>
<label class="field"><span>${esc(T('importFile'))}</span><input type="file" id="plabPaletteFile" accept=".gpl,.hex,.txt,.json,application/json,text/plain"></label>
<label class="field"><span>${esc(T('importText'))}</span><textarea id="plabPaletteText" rows="4" spellcheck="false" placeholder="#1a1c2c&#10;#5d275d"></textarea></label>
<button type="button" class="mini-button" data-action="plab-import-text">${esc(T('importApply'))}</button>
<label class="field"><span>${esc(T('exportAs'))}</span><select id="plabFormat" data-key="format">${Object.entries(P.PALETTE_FORMATS).map(([k,v])=>`<option value="${k}" ${o.format===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
<p class="hint">${esc(T('exportAsHint'))}</p></details>
<span class="opt-label">${esc(T('budget'))}</span>${num('plabBudget','budget',2,256,T('budgetTarget'))}<div id="plabBudget-out"></div>
<button type="button" class="mini-button" data-action="plab-merge">${esc(T('mergeRarest'))}</button>`;
  if(stage==='recolor')return `<span class="opt-label">${esc(T('mode'))}</span><div class="segmented" role="group" id="plabRecolor">${['none','ramp','hue','status'].map(v=>`<button type="button" data-action="plab-recolor" data-value="${v}" aria-pressed="${recolor.kind===v}">${esc(T('recolors.'+v))}</button>`).join('')}</div>
<div id="plabRecolorBody">${recolorControls()}</div>
<div class="list-actions"><button type="button" class="mini-button" data-action="plab-apply-recolor" ${recolor.kind==='none'?'disabled':''}>${esc(T('applyRecolor'))}</button><button type="button" class="mini-button" data-action="plab-variants" ${selection.size?'':'disabled'}>${esc(T('teamZip'))}</button></div>
<label class="field"><span>${esc(T('teams'))}</span><input id="plabTeams" data-key="teams" type="text" maxlength="80" value="${esc(o.teams)}"></label>
<p class="hint">${esc(T('teamHint'))}</p>`;
  if(stage==='cleanup')return `${check('plabOrphans','orphans',T('orphans'))}${check('plabClusters','clusters',T('clusters'))}${num('plabMinArea','minArea',2,64,T('minArea'))}${check('plabHoles','holes',T('holes'))}
${check('plabAA','aa',T('aa'))}
<details class="options-advanced" ${o.aa?'open':''}><summary>${esc(T('aaTitle'))}</summary>
${num('plabAAT','aaThreshold',1,300,T('aaThreshold'))}${num('plabAlphaCut','alphaCut',0,255,T('alphaCut'))}
<p class="hint">${esc(T('aaHint'))}</p></details>
<details class="options-advanced"><summary>${esc(T('outlineTitle'))}</summary>
<label class="field"><span>${esc(T('outline'))}</span><select id="plabOutline" data-key="outline"><option value="-1">${esc(T('outlineNone'))}</option>${palette.map((c,i)=>`<option value="${i}" ${o.outline===i?'selected':''}>${i+1} · ${P.hex(c)}</option>`).join('')}</select></label>
${check('plabGapFix','gapFix',T('gapFix'))}<div id="plabOutlineOut"></div></details>
<div class="list-actions"><button type="button" class="mini-button" data-action="plab-candidates">${esc(T('showCandidates'))}</button><button type="button" class="mini-button" data-action="plab-hide-candidates">${esc(T('hideCandidates'))}</button></div>
<div id="plabCleanupOut"></div>${o.dither==='none'?'':`<p class="hint">${esc(T('ditherCleanupNote'))}</p>`}`;
  if(stage==='check')return `<div id="plabReport"></div>
${num('plabScale','scale',1,8,T('scale'))}
${check('plabSilOn','silhouetteView',T('silhouetteView'))}
<div class="plab-compare" id="plabSilView" ${o.silhouetteView?'':'hidden'}>${[1,2].map(k=>`<figure><canvas class="px" data-sil="${k}"></canvas><figcaption>${k}×</figcaption></figure>`).join('')}</div>
<div class="list-actions"><button type="button" class="mini-button" data-action="plab-recover">${esc(T('recover'))}</button><button type="button" class="mini-button" data-action="plab-silhouette">${esc(T('silhouette'))}</button></div>
<p class="hint">${esc(T('checkNote'))}</p>`;
  return `<div id="plabExportOut"></div>
${num('plabScale2','scale',1,8,T('scale'))}
<p class="hint">${esc(T('exportNote'))}</p>`;
 }
 function recolorControls(){
  if(recolor.kind==='ramp')return `<p class="hint">${esc(T('rampHint'))}</p><div id="plabRampSource" class="plab-swatches small"></div>
<label class="field inline"><span>${esc(T('base'))}</span><input id="plabTo" data-key="to" type="color" value="${esc(o.to)}"></label>
<button type="button" class="mini-button" data-action="plab-auto-ramp">${esc(T('autoRamp'))}</button>
<div id="plabRampTarget" class="plab-swatches small"></div>`;
  if(recolor.kind==='hue')return `${num('plabHue','hue',0,359,T('hue'))}${num('plabWindow','window',1,180,T('window'))}${num('plabTolerance','tolerance',0,90,T('tolerance'))}
<label class="field inline"><span>${esc(T('toColor'))}</span><input id="plabTo" data-key="to" type="color" value="${esc(o.to)}"></label>
<div id="plabMaskOut"></div>`;
  if(recolor.kind==='status')return `<label class="field"><span>${esc(T('preset'))}</span><select id="plabPreset" data-key="preset">${Object.keys(P.STATUS_PRESETS).map(k=>`<option value="${k}" ${o.preset===k?'selected':''}>${esc(T('presets.'+k))}</option>`).join('')}</select></label><p class="hint">${esc(T('presetHint'))}</p>`;
  return `<p class="hint">${esc(T('recolorNone'))}</p>`;
 }
 function renderStrip(){
  const strip=el.querySelector('#plabStrip');if(!strip)return;
  strip.innerHTML=sources.map((s,i)=>`<div class="frame-chip ${i===at?'is-current':''}" data-id="${s.id}" title="${esc(s.name)}" role="button" tabindex="0" aria-current="${i===at?'true':'false'}"><img src="${s.thumb}" alt="${esc(s.name)}" class="px"><span>${i+1}</span><button type="button" data-action="plab-remove" data-id="${s.id}" aria-label="${esc(text('remove'))}">×</button></div>`).join('');
  el.querySelector('#plabCount').textContent=T('frameCount',{n:sources.length});
 }
 function renderSide(){
  const body=el.querySelector('#plabOptions');if(!body)return;
  const summary=el.querySelector('#plabSummary');
  summary.innerHTML=`<div class="summary-big">${palette.length} ${esc(T('colorsShort'))}</div><div class="summary-line">${esc(T('frameCount',{n:sources.length}))} · ${esc(preview?`${preview.width}×${preview.height}`:'—')}${preview?.changed?` · ${esc(T('cleaned',{n:preview.changed}))}`:''}</div><div class="summary-line">${esc(T('scope.'+countScope))}</div>`;
  if(stage==='palette'){
   const host=el.querySelector('#plabSwatches');
   host.innerHTML=palette.map((c,i)=>`<button type="button" class="plab-swatch ${selection.has(i)?'is-on':''} ${locks[i]?'is-locked':''}" data-action="plab-pick" data-index="${i}" style="--c:${P.hex(c)}" aria-pressed="${selection.has(i)}" aria-label="${esc(`${i+1} ${P.hex(c)} · ${(share[i]*100||0).toFixed(1)}%`)}" title="${esc(`${P.hex(c)} · ${counts[i]||0}px`)}"><span class="plab-chip"></span><small>${esc(P.hex(c).slice(1))}</small><em>${esc(((share[i]||0)*100).toFixed(1))}%</em></button>`).join('');
   const picked=[...selection].sort((a,b)=>a-b),detail=el.querySelector('#plabPicked');
   detail.innerHTML=picked.length?picked.map(i=>`<div class="plab-row"><span class="plab-chip" style="--c:${P.hex(palette[i])}"></span><code>${esc(P.hex(palette[i]))}</code><small>rgb(${palette[i].join(', ')}) · ${counts[i]||0}px · ${((share[i]||0)*100).toFixed(2)}%</small>
<input type="color" data-action="plab-edit" data-index="${i}" value="${P.hex(palette[i])}" aria-label="${esc(T('replace'))}">
<button type="button" class="mini-button" data-action="plab-copy" data-index="${i}">${esc(T('copy'))}</button>
<button type="button" class="mini-button" data-action="plab-lock" data-index="${i}" aria-pressed="${!!locks[i]}">${esc(locks[i]?T('unlock'):T('lock'))}</button>
<button type="button" class="mini-button" data-action="plab-remove-color" data-index="${i}">${esc(text('remove'))}</button></div>`).join(''):`<p class="hint">${esc(T('pickHint'))}</p>`;
   const audit=P.auditBudget(palette,counts,o.budget),out=el.querySelector('#plabBudget-out');
   out.innerHTML=audit.over?`<p class="summary-line bad">${esc(T('overBudget',{n:audit.over,target:audit.limit}))}</p><ol class="plab-offenders">${audit.offenders.map(x=>`<li><span class="plab-chip" style="--c:${P.hex(x.color)}"></span><code>${esc(P.hex(x.color))}</code> <small>${x.count}px · ${(x.share*100).toFixed(2)}%</small></li>`).join('')}</ol>`:`<p class="summary-line">${esc(T('withinBudget',{n:palette.length,target:audit.limit}))}</p>`;
  }
  if(stage==='recolor'){
   const src=el.querySelector('#plabRampSource'),tgt=el.querySelector('#plabRampTarget');
   if(src)src.innerHTML=palette.map((c,i)=>`<button type="button" class="plab-swatch ${selection.has(i)?'is-on':''}" data-action="plab-pick" data-index="${i}" style="--c:${P.hex(c)}" aria-pressed="${selection.has(i)}" aria-label="${esc(`${T('source')} ${i+1} ${P.hex(c)}`)}"><span class="plab-chip"></span></button>`).join('');
   if(tgt)tgt.innerHTML=targetRamp.length?targetRamp.map((c,i)=>`<span class="plab-swatch is-static" style="--c:${P.hex(c)}" title="${esc(P.hex(c))}"><span class="plab-chip"></span><small>${esc(P.hex(c).slice(1))}</small></span>`).join(''):`<p class="hint">${esc(T('noTarget'))}</p>`;
   const mask=el.querySelector('#plabMaskOut');
   if(mask){const hit=P.hueWindow(palette,{hue:o.hue,window:o.window,tolerance:o.tolerance});mask.innerHTML=`<p class="summary-line">${esc(T('maskCount',{n:hit.filter(Boolean).length,total:palette.length}))}</p><div class="plab-swatches small">${palette.map((c,i)=>`<span class="plab-swatch is-static ${hit[i]?'is-on':''}" title="${esc(P.hex(c))}${hit[i]?' ✓':''}"><span class="plab-chip" style="--c:${P.hex(c)}"></span>${hit[i]?'<b aria-hidden="true">✓</b>':''}</span>`).join('')}</div>`;}
  }
  if(stage==='cleanup'&&preview){
   const f=preview.found;
   el.querySelector('#plabCleanupOut').innerHTML=`<ul class="plab-list"><li>${esc(T('orphanCount',{n:f.orphans.items.length}))}</li><li>${esc(T('clusterCount',{n:f.clusters.items.length}))}</li><li>${esc(T('holeCount',{n:f.holes.items.length}))}</li>${preview.aa?`<li>${esc(T('aaCount',{n:preview.aa.transition,other:preview.aa.nearest}))}</li>`:''}</ul>`;
   const outline=el.querySelector('#plabOutlineOut');
   if(outline&&o.outline>=0){const audit=C.outlineAudit({indices:preview.indices,width:preview.width,height:preview.height},o.outline);
    outline.innerHTML=`<ul class="plab-list"><li>${esc(T('gapCount',{n:audit.gaps.length}))}</li><li>${esc(T('doubledCount',{n:audit.doubled.length}))}</li><li>${esc(T('thickness',{n:audit.thickness.dominant,min:audit.thickness.min,max:audit.thickness.max}))}</li></ul>`;}
   else if(outline)outline.innerHTML='';
  }
  if(stage==='check'&&report){
   const s=report.scale,verdict=T('verdicts.'+report.verdict);
   el.querySelector('#plabReport').innerHTML=`<ul class="plab-list">
<li><strong>${esc(verdict)}</strong>${report.verdict==='integer'?` · ${esc(T('logical',{w:report.logical.width,h:report.logical.height,s:s.scale}))}`:report.verdict==='non-integer'?` · ${esc(T('estimate',{n:s.estimate}))}`:''}</li>
<li>${esc(T('offGrid',{v:report.offGrid?T('yes'):T('no'),x:s.offset.x,y:s.offset.y}))}</li>
<li>${esc(T('edgeReport',{n:report.edges.intermediate,share:(report.edges.share*100).toFixed(1),alpha:report.edges.partialAlpha}))}</li>
<li>${esc(T('distinct',{n:report.distinct,target:o.budget}))}</li></ul>`;
  }
  if(stage==='check'&&o.silhouetteView&&preview){
   const flat=K.silhouette(preview.pixels);
   for(const k of [1,2]){
    const cell=el.querySelector(`canvas[data-sil="${k}"]`);if(!cell)continue;
    const {data,width,height}=k>1?K.nearestScale(flat,k):flat;
    cell.width=width;cell.height=height;cell.getContext('2d').putImageData(new ImageData(data,width,height),0,0);
   }
  }
  if(stage==='export'){
   el.querySelector('#plabExportOut').innerHTML=`<ul class="plab-list"><li>${esc(T('frameCount',{n:sources.length}))}</li><li>${esc(T('colorCount',{n:palette.length}))}</li><li>${esc(T('dithers.'+o.dither))}${o.scale>1?` · ${o.scale}×`:''}</li></ul>`;
  }
 }
 // ── input ───────────────────────────────────────────────────────────────────────────────────
 async function add(files){
  if(busy)return;busy=true;const first=!sources.length;
  try{
   for(const file of files){
    const canvas=await Im.decode(file);
    if(canvas.width*canvas.height>MAX_FRAME_PIXELS){Im.release(canvas);throw Error(T('tooBig',{w:canvas.width,h:canvas.height,max:4096}));}
    const thumbSize=Math.min(64,Math.max(canvas.width,canvas.height));
    const small=Im.resize(canvas,Math.max(1,Math.round(canvas.width/Math.max(canvas.width,canvas.height)*thumbSize)),Math.max(1,Math.round(canvas.height/Math.max(canvas.width,canvas.height)*thumbSize)),true);
    const thumb=URL.createObjectURL(await Im.blobOf(small));Im.release(small);
    sources.push({id:++seq,name:file.name,canvas,raw:canvas,thumb});
   }
   if(first){palette=[];locks=[];track('tool_run',{intent:route.id});shell();}
   build();
  }catch(error){toast(error?.message||String(error),{error:true});if(!sources.length)empty();}finally{busy=false;}
 }
 function clear(){
  for(const s of sources){Im.release(s.canvas);if(s.raw!==s.canvas)Im.release(s.raw);URL.revokeObjectURL(s.thumb);}
  sources=[];palette=[];locks=[];counts=[];share=[];selection=new Set();targetRamp=[];history=[];preview=null;report=null;candidates=null;empty();
 }
 async function sample(){
  // Eight frames with deliberately anti-aliased edges and more colours than a sprite needs,
  // so the Lab has something real to fix.
  const out=[];
  for(let i=0;i<8;i++){
   const c=Im.canvas(48,48),x=c.getContext('2d'),phase=i/8*Math.PI*2,bob=Math.sin(phase)*2;
   x.clearRect(0,0,48,48);
   const body=x.createLinearGradient(0,10,0,34);body.addColorStop(0,'#5bd0ff');body.addColorStop(1,'#1b4f8a');
   x.fillStyle=body;x.beginPath();x.ellipse(24,24+bob,11,13,0,0,Math.PI*2);x.fill();
   x.fillStyle='#ffd166';x.beginPath();x.arc(24+Math.cos(phase)*5,18+bob,4.5,0,Math.PI*2);x.fill();
   x.strokeStyle='#10182b';x.lineWidth=2;x.beginPath();x.ellipse(24,24+bob,11,13,0,0,Math.PI*2);x.stroke();
   out.push(new File([await Im.blobOf(c)],`sprite_${i}.png`,{type:'image/png'}));Im.release(c);
  }
  return out;
 }
 async function exportPalette(){
  const name=`${paletteName||'palette'}`.replace(/[^\w.-]+/g,'_'),spec=P.PALETTE_FORMATS[o.format];
  const body=P.serializePalette(o.format,palette,{name,columns:Math.min(16,palette.length),source:'nerulio-pixel-lab'});
  download(new Blob([body],{type:'text/plain'}),`${name}.${spec.ext}`);track('tool_success',{intent:route.id});
 }
 function envelope(entries){
  const colors=outputPalette();
  return JSON.stringify({meta:{tool:'nerulio-pixel-lab',toolVersion:'1',schemaVersion:SCHEMA_VERSION,engineTarget:'generic',palette:colors.map(c=>P.hex(c)),dither:o.dither,ditherAmount:o.amount,exportScale:o.scale,cleanup:{orphans:o.orphans,clusters:o.clusters,minArea:o.minArea,holes:o.holes,antiAlias:o.aa}},
   frames:Object.fromEntries(entries.map(e=>[e.name,{page:0,rect:{x:0,y:0,w:e.width,h:e.height},rotated:false,aliasOf:null,sourceSize:{w:e.width,h:e.height},offset:{x:0,y:0},pivot:{x:.5,y:1},duration:null,tag:'',boxes:[],collision:[]}])),
   palette:{name:paletteName,colors:colors.map(c=>P.hex(c)),counts},animations:{}},null,1);
 }
 async function exportFrames(){
  if(busy||!sources.length)return;busy=true;
  try{
   const colors=ensurePalette(),out=outputPalette(),files=[],entries=[];
   for(const s of sources){
    const {pixels}=processFrame(s,colors,out);
    files.push({name:`${stem(s.name)}.png`,blob:await pngRGBACompressed(pixels.data,pixels.width,pixels.height)});
    entries.push({name:`${stem(s.name)}.png`,width:pixels.width,height:pixels.height});
   }
   files.push({name:`${paletteName||'palette'}.gpl`,blob:new Blob([P.toGPL(out,{name:paletteName,columns:Math.min(16,out.length)})],{type:'text/plain'})});
   files.push({name:'pixel-lab.json',blob:new Blob([envelope(entries)],{type:'application/json'})});
   const archive=await zip(files);download(archive,`pixel-lab-${sources.length}.zip`);
   track('tool_success',{intent:route.id});toast(T('exported',{n:entries.length,size:bytes(archive.size)}));
   lastExport=files[0];
   const next=el.querySelector('#plabNext');
   if(next)next.innerHTML=`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="plab-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
  }catch(error){toast(error?.message||String(error),{error:true});}finally{busy=false;}
 }
 async function exportVariants(){
  if(busy||!sources.length)return;
  if(!selection.size){toast(T('needSelection'),{error:true});return;}
  busy=true;
  try{
   const colors=ensurePalette(),names=o.teams.split(/[\s,]+/).filter(Boolean).slice(0,8);
   const bases=Object.fromEntries(names.map(n=>[n,P.TEAM_COLORS[n]||P.parseColor(n)||P.TEAM_COLORS.red]));
   const variants=P.teamVariants(colors,[...selection],bases),files=[];
   for(const v of variants)for(const s of sources){
    const {pixels}=processFrame(s,colors,v.colors);
    files.push({name:`${v.name}/${stem(s.name)}.png`,blob:await pngRGBACompressed(pixels.data,pixels.width,pixels.height)});
   }
   for(const v of variants)files.push({name:`${v.name}/palette.gpl`,blob:new Blob([P.toGPL(v.colors,{name:v.name})],{type:'text/plain'})});
   const archive=await zip(files,{paths:true});download(archive,`pixel-lab-variants-${variants.length}.zip`);
   toast(T('exported',{n:files.length,size:bytes(archive.size)}));track('tool_success',{intent:route.id});
  }catch(error){toast(error?.message||String(error),{error:true});}finally{busy=false;}
 }
 async function exportOne(){
  if(!preview)return;
  const {data,width,height}=preview.pixels;
  try{download(await pngRGBACompressed(data,width,height),`${stem(frameAt().name)}-pixel.png`);track('tool_success',{intent:route.id});}
  catch(error){toast(error?.message||String(error),{error:true});}
 }
 function importPalette(textValue,filename){
  try{
   const parsed=P.parsePaletteFile(textValue,filename);
   pushHistory();palette=parsed.colors;locks=palette.map(()=>false);selection=new Set();paletteName=parsed.name||stem(filename||'imported');
   o.classic='';toast(T('imported',{n:palette.length,format:parsed.format.toUpperCase()}));shell();build();
  }catch(error){toast(error?.message||String(error),{error:true});}
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='plab-sample'){add(await sample());return;}
  if(!sources.length&&a!=='pick')return;
  if(a==='plab-stage'){stage=b.dataset.stage;candidates=null;shell();build();}
  else if(a==='plab-set'){
   const v=b.dataset.value,key=b.dataset.key;o[key]=/^-?\d+$/.test(v)?Number(v):v;
   for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
   if(key==='colors'){palette=[];locks=[];counts=[];}
   if(key==='dither'||key==='colors'){shell();build();}else schedule();
  }
  else if(a==='plab-recolor'){recolor={kind:b.dataset.value};for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));shell();build();}
  else if(a==='plab-pick'){const i=Number(b.dataset.index);selection.has(i)?selection.delete(i):selection.add(i);renderSide();schedule();}
  else if(a==='plab-copy'){const value=P.hex(palette[Number(b.dataset.index)]);try{await navigator.clipboard.writeText(value);toast(T('copied',{v:value}));}catch{toast(value);}}
  else if(a==='plab-lock'){const i=Number(b.dataset.index);pushHistory();locks[i]=!locks[i];renderSide();}
  else if(a==='plab-remove-color'){const i=Number(b.dataset.index);if(palette.length<2){toast(T('needOneColor'),{error:true});return;}pushHistory();palette=palette.filter((_,k)=>k!==i);locks=locks.filter((_,k)=>k!==i);selection=new Set();o.outline=-1;shell();build();}
  else if(a==='plab-add-color'){pushHistory();palette=[...palette,P.parseColor(o.to)||[255,255,255]];locks=[...locks,false];shell();build();}
  else if(a==='plab-extract'){pushHistory();const keep=palette.filter((_,i)=>locks[i]);const fresh=P.extract(pixelsOf(sources),Math.max(1,o.colors-keep.length)).colors;palette=[...keep,...fresh].slice(0,P.MAX_COLORS);locks=palette.map((_,i)=>i<keep.length);paletteName='extracted';selection=new Set();counts=[];shell();build();}
  else if(a==='plab-sort'){pushHistory();o.sort=b.dataset.mode;const sorted=P.sortPalette(palette,o.sort,counts);palette=sorted.colors;locks=sorted.order.map(i=>locks[i]);counts=sorted.order.map(i=>counts[i]);share=sorted.order.map(i=>share[i]);selection=new Set();shell();build();}
  else if(a==='plab-merge'){const plan=P.mergePlan(palette,counts,o.budget);if(!plan.removed.length){toast(T('withinBudget',{n:palette.length,target:o.budget}));return;}pushHistory();palette=plan.colors;locks=palette.map(()=>false);selection=new Set();o.outline=-1;toast(T('merged',{n:plan.removed.length}));shell();build();}
  else if(a==='plab-import-text'){const value=el.querySelector('#plabPaletteText')?.value||'';if(value.trim())importPalette(value,'pasted.txt');}
  else if(a==='plab-export-palette')exportPalette();
  else if(a==='plab-auto-ramp'){const base=P.parseColor(o.to);if(!selection.size||!base){toast(T('needSelection'),{error:true});return;}targetRamp=P.generateRamp(base,[...selection].map(i=>palette[i]));renderSide();schedule();}
  else if(a==='plab-apply-recolor'){const out=outputPalette();if(out===palette){toast(T('recolorNone'));return;}pushHistory();palette=out;recolor={kind:'none'};targetRamp=[];shell();build();}
  else if(a==='plab-variants')exportVariants();
  else if(a==='plab-candidates'){const f=preview?.found;if(!f)return;candidates=[...f.orphans.changes,...f.clusters.changes,...f.holes.changes];if(o.outline>=0)candidates=[...candidates,...C.outlineAudit({indices:preview.indices,width:preview.width,height:preview.height},o.outline).gapFix];paint();toast(T('candidateCount',{n:candidates.length}));}
  else if(a==='plab-hide-candidates'){candidates=null;paint();}
  else if(a==='plab-recover'){
   const source=frameAt(),found=report?.scale;
   if(!report||report.verdict!=='integer'){toast(T('noRecover'),{error:true});return;}
   const recovered=canvasOf(K.recoverSource(imageDataOf(source.canvas),found.scale,found.offset));
   if(source.canvas!==source.raw)Im.release(source.canvas);
   source.canvas=recovered;palette=[];locks=[];toast(T('recovered',{w:recovered.width,h:recovered.height}));shell();build();
  }
  else if(a==='plab-silhouette'){
   const flat=K.silhouette(preview.pixels);
   download(await pngRGBACompressed(flat.data,flat.width,flat.height),`${stem(frameAt().name)}-silhouette.png`);
  }
  else if(a==='plab-remove'){const i=sources.findIndex(s=>String(s.id)===b.dataset.id);if(i<0)return;const [s]=sources.splice(i,1);Im.release(s.canvas);if(s.raw!==s.canvas)Im.release(s.raw);URL.revokeObjectURL(s.thumb);if(!sources.length)return clear();at=Math.min(at,sources.length-1);build();}
  else if(a==='plab-sort-frames'){sources.sort(natural);at=0;build();}
  else if(a==='plab-clear')clear();
  else if(a==='plab-undo')undo();
  else if(a==='plab-export')exportFrames();
  else if(a==='plab-export-one')exportOne();
  else if(a==='plab-next'&&lastExport)continueWith(b.dataset.tool,[new File([lastExport.blob],lastExport.name,{type:'image/png'})]);
  else if(a==='plab-link'){
   const url=new URL(location.href);
   for(const [k,v] of Object.entries({colors:o.colors,dither:o.dither,size:o.size||'',scale:o.scale,budget:o.budget,palette:o.classic}))v?url.searchParams.set(k,String(v)):url.searchParams.delete(k);
   try{await navigator.clipboard.writeText(url.href);toast(T('copied',{v:url.href}));}catch{toast(url.href);}
  }
 });
 el.addEventListener('input',e=>{
  const key=e.target.dataset?.key;
  if(key){
   const value=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?Number(e.target.value):e.target.value;
   if(key==='compare'||key==='silhouetteView'){o[key]=value;shell();build();return;}
   if(key==='classic'&&value!==o.classic){o.classic=value;palette=[];locks=[];selection=new Set();shell();build();return;}
   // A checkbox is an edit, so it is undoable; typing in a number field is not snapshotted per key.
   if(e.target.type==='checkbox')pushHistory();
   o[key]=value;
   if(key==='outline'||key==='to')renderSide();
   schedule();return;
  }
  if(e.target.dataset?.action==='plab-edit'){
   const i=Number(e.target.dataset.index),color=P.parseColor(e.target.value);
   if(color){palette=palette.map((c,k)=>k===i?color:c);schedule();}
  }
 });
 el.addEventListener('change',async e=>{
  if(e.target.id!=='plabPaletteFile')return;
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  if(file.size>1_000_000){toast(T('paletteTooBig'),{error:true});return;}
  importPalette(await file.text(),file.name);
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('toggle',e=>{if(e.target.dataset?.panel==='io')o.showIO=e.target.open;},true);
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone,.frame-chip')){e.preventDefault();e.target.click();}});
 // Shortcuts live on the document: a button that disables itself after a click hands focus back
 // to <body>, and a listener on the workspace element would never see the next key.
 document.addEventListener('keydown',e=>{
  // Text, number and colour fields keep their own undo; a checkbox or a canvas does not.
  const typing=e.target.closest?.('dialog,textarea,select,[contenteditable],input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])');
  if(!el.isConnected||!sources.length||typing)return;
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  // Left/right step through the frame strip without needing to hit a 68 px thumbnail.
  const step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
  if(step&&sources.length>1){e.preventDefault();at=(at+step+sources.length)%sources.length;candidates=null;build();}
 });
 el.addEventListener('click',e=>{const chip=e.target.closest?.('.frame-chip');if(!chip||e.target.closest('[data-action="plab-remove"]'))return;const i=sources.findIndex(s=>String(s.id)===chip.dataset.id);if(i>=0&&i!==at){at=i;candidates=null;build();}});
 onLocale(()=>{if(!sources.length){empty();return;}shell();build();});
 empty();
 return {add};
}
