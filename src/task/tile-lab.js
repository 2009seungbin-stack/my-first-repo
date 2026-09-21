import * as Im from '../image.js';
import {bytes,stem,zip} from '../core.js';
import {ANALYSIS_PIXELS} from '../primitives.js';
import {t} from '../i18n.js';
import {detectGrid,tileRects,sliceMetadata,tileName,cropRGBA,rectHash,isBlank,duplicateGroups,nearDuplicateGroups,variantSet,VARIANTS} from '../game/tile-grid.js';
import {KINDS,LAYOUTS,layoutOf,layoutJSON,layoutFromJSON,completeness,unrepresentable,terrainGrid,renderMap,seededFill,floodFill,cellAt} from '../game/autotile.js';
import {seamReport,edgeMatch,bestEdge,makeSeamless,heatmap} from '../game/seams.js';
import {tileCollision,MODES as COLLISION_MODES} from '../game/tile-collision.js';
import {godotTileSet,godotScript,godotReadme,MODES,modeFor} from '../game/godot-tileset.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** Tile Lab — one workspace for a 2D tileset: measure the grid, slice it, generate autotile
 * templates, paint terrain and watch the rules choose tiles, check what the sheet is missing,
 * test a repeating texture's seams, and export a Godot 4 reference pack.
 * Stages are views over one decoded sheet; nothing is re-uploaded between them. */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STAGES=['grid','templates','tester','rules','seams','export'];
const STAGE_FOR={'tile-lab':'grid','tileset-slicer':'grid','tile-helper':'grid','atlas-padding':'grid','autotile-tester':'tester','seamless-tile-checker':'seams'};
const BODY='#3f7f4c',RIM='#26543a',MARK='#eef6ef',GHOST='#b3383f';
const pct=v=>v==null?'—':Math.round(v*100)+'%';
const num=(v,d=1)=>v==null?'—':!Number.isFinite(v)?'∞':v.toFixed(d);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const int=(v,a,b,fallback)=>{const n=Math.round(Number(v));return Number.isFinite(n)?clamp(n,a,b):fallback;};

export function mount({el,def}){
 let src=null,data=null,candidates=[],grid=null,busy=false,ready=false;
 let stage=STAGES.includes(route.query.get('stage'))?route.query.get('stage'):STAGE_FOR[route.id]||'grid';
 let terrain=null,cursor={x:0,y:0},painting=null,art=null;
 const o={
  tileWidth:16,tileHeight:16,marginX:0,marginY:0,spacingX:0,spacingY:0,
  lines:true,zoom:2,skipBlank:true,dedupe:'none',nearMean:2,variants:false,extrude:route.id==='atlas-padding'?2:0,
  kind:'blob47',templateSize:32,offset:0,source:'template',sourcePinned:false,outside:false,gridLines:true,mapZoom:3,gridSize:16,seed:1234,brush:'paint',
  seamIndex:0,repeat:2,healed:false,blend:0,matchIndex:1,collide:'none',alpha:0,simplify:0,
  terrainName:'Terrain',mode:''
 };
 for(const [key,min,max] of [['tileWidth',1,4096],['tileHeight',1,4096],['marginX',0,256],['marginY',0,256],['spacingX',0,256],['spacingY',0,256],['templateSize',8,256],['gridSize',4,64],['seed',0,999999]]){
  const raw=route.query.get(key);if(raw!==null)o[key]=int(raw,min,max,o[key]);
 }
 if(KINDS.includes(route.query.get('kind')))o.kind=route.query.get('kind');
 const T=(k,v)=>text('tile.'+k,v);
 const q=s=>el.querySelector(s);
 const layout=()=>layoutOf(o.kind);
 /** Zoomed size, but never wider than the board it sits in: on a phone the map fits instead of
  * scrolling sideways, and on a desktop the zoom is what it says. */
 const fit=(node,natural,zoom,cap)=>{
  const room=node.parentElement?.clientWidth||cap;
  node.style.width=Math.max(48,Math.min(natural*zoom,cap,room))+'px';
 };

 /* ---------- source ---------- */
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="tl-sample">${esc(T('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 const analysable=()=>!!data;
 function applyCandidate(c){
  Object.assign(o,{tileWidth:c.tileWidth,tileHeight:c.tileHeight,marginX:c.marginX,marginY:c.marginY,spacingX:c.spacingX,spacingY:c.spacingY});
  rebuild();
 }
 function rebuild(){
  grid=null;dropArt();
  if(!src)return;
  try{grid=tileRects({width:src.width,height:src.height,tileWidth:o.tileWidth,tileHeight:o.tileHeight,marginX:o.marginX,marginY:o.marginY,spacingX:o.spacingX,spacingY:o.spacingY});}
  catch(error){grid={error:error.message||String(error),rects:[],cols:0,rows:0,count:0};}
  tiles.clear();hashes=null;pickSource();
 }
 /* Tile pixels are cropped on demand and cached by index, never kept as N full copies. */
 const tiles=new Map();
 let hashes=null;
 function tileData(index){
  if(!data||!grid?.rects[index])return null;
  if(!tiles.has(index)){
   if(tiles.size>4096)tiles.clear();
   tiles.set(index,cropRGBA(data,src.width,src.height,grid.rects[index]));
  }
  return tiles.get(index);
 }
 const tileHashes=()=>{
  if(!hashes&&data&&grid?.rects.length)hashes=grid.rects.map(r=>rectHash(data,src.width,src.height,r));
  return hashes||[];
 };
 const blanks=()=>data&&grid?.rects.length?grid.rects.filter(r=>isBlank(data,src.width,src.height,r)).map(r=>r.index):[];
 /** Collision polygons per tile index, in tile pixels. Empty when the option is off. */
 function collisionShapes(){
  if(o.collide==='none'||!data||!grid?.rects.length)return null;
  const out=new Map();
  for(const r of grid.rects){
   const pixels=tileData(r.index);if(!pixels)continue;
   const shapes=tileCollision(pixels,r.w,r.h,{mode:o.collide,threshold:o.alpha,epsilon:o.simplify});
   if(shapes.length)out.set(r.index,shapes);
  }
  return out;
 }

 /* ---------- template art ---------- */
 /** Guide art for one slot: the body, a rim on every side with no neighbour, and a rim block in
  * every corner that is a real inner corner. This is what an artist paints over. */
 function drawSlot(ctx,slot,x,y,size,{labels=false}={}){
  const rim=Math.max(1,Math.round(size/5)),kind=slot.kind;
  ctx.save();ctx.translate(x,y);
  if(kind==='corner16'){
   const h=size/2;
   for(const [key,cx,cy] of [['tl',0,0],['tr',h,0],['br',h,h],['bl',0,h]]){
    ctx.fillStyle=slot.samples[key]?BODY:'#00000000';
    if(slot.samples[key])ctx.fillRect(cx,cy,h,h);
   }
   ctx.strokeStyle=RIM;ctx.lineWidth=Math.max(1,size/16);ctx.strokeRect(h,0,0,size);
  }else{
   ctx.fillStyle=BODY;ctx.fillRect(0,0,size,size);
   ctx.fillStyle=RIM;
   if(!slot.edges.n)ctx.fillRect(0,0,size,rim);
   if(!slot.edges.s)ctx.fillRect(0,size-rim,size,rim);
   if(!slot.edges.w)ctx.fillRect(0,0,rim,size);
   if(!slot.edges.e)ctx.fillRect(size-rim,0,rim,size);
   for(const [corner,a,b,cx,cy] of [['ne','n','e',size-rim,0],['se','s','e',size-rim,size-rim],['sw','s','w',0,size-rim],['nw','n','w',0,0]])
    if(slot.edges[a]&&slot.edges[b]&&!slot.corners[corner])ctx.fillRect(cx,cy,rim,rim);
  }
  if(labels){
   const f=Math.max(7,Math.round(size/4.2));
   ctx.font=`600 ${f}px ui-monospace,Consolas,monospace`;ctx.textBaseline='top';
   ctx.fillStyle='#0b1425aa';ctx.fillRect(1,1,ctx.measureText(String(slot.index)).width+4,f+3);
   ctx.fillStyle=MARK;ctx.fillText(String(slot.index),3,2);
   // The mask name is as long as the neighbourhood is complex, so shrink it until it fits the
   // cell instead of letting slot 46 write over slot 47.
   let fs=Math.max(5,Math.round(size/5.6)),wd=0;
   for(;;){ctx.font=`500 ${fs}px ui-monospace,Consolas,monospace`;wd=ctx.measureText(slot.name).width;if(wd<=size-6||fs<=5)break;fs--;}
   ctx.fillStyle='#0b1425aa';ctx.fillRect(size-wd-4,size-fs-4,wd+3,fs+3);
   ctx.fillStyle=MARK;ctx.fillText(slot.name,size-wd-2,size-fs-3);
  }
  ctx.restore();
 }
 /** The template sheet: one cell per slot at the chosen tile size (`scale` for the legend copy). */
 function templateCanvas(size,{labels=false}={}){
  const l=layout(),c=Im.canvas(l.columns*size,l.rows*size),ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  for(const slot of l.slots)drawSlot(ctx,slot,slot.col*size,slot.row*size,size,{labels});
  return c;
 }
 /** The sheet can only stand in for the layout when it actually holds that many tiles; until the
  * person chooses, a 12-tile sheet under a 47-slot rule set shows the template instead of 35
  * red holes. */
 function pickSource(){if(!o.sourcePinned)o.source=grid?.count>=layout().count?'sheet':'template';}
 /** Where each slot's pixels live: either in the sheet (offset into the grid) or in template art. */
 function tileArt(){
  if(art)return art;
  const l=layout();
  if(o.source==='sheet'&&src&&grid?.rects.length){
   art={canvas:src,w:o.tileWidth,h:o.tileHeight,rect:i=>grid.rects[i+o.offset]||null};
  }else{
   const size=Math.max(8,Math.min(64,o.tileWidth||o.templateSize)),c=templateCanvas(size);
   art={canvas:c,w:size,h:size,own:true,rect:i=>{const s=l.slots[i];return s?{x:s.col*size,y:s.row*size,w:size,h:size}:null;}};
  }
  return art;
 }
 const dropArt=()=>{if(art?.own)Im.release(art.canvas);art=null;};

 /* ---------- markup ---------- */
 const seg=(key,values,label,extra='')=>`<div class="segmented" role="group" id="tl-${key}"${extra}>${values.map(v=>`<button type="button" data-action="tl-set" data-key="${key}" data-value="${esc(v)}" aria-pressed="${String(o[key])===String(v)}">${label(v)}</button>`).join('')}</div>`;
 const field=(key,min,max,step=1)=>`<label class="field"><span>${esc(T(key))}</span><input data-option="${key}" id="tl-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${o[key]}" inputmode="numeric"></label>`;
 const check=key=>`<label class="check"><input data-option="${key}" id="tl-${key}" type="checkbox" ${o[key]?'checked':''}> ${esc(T(key))}</label>`;
 const stageBar=()=>`<nav class="tl-stages" aria-label="${esc(T('stages'))}">${STAGES.map(s=>`<button type="button" data-action="tl-stage" data-stage="${s}" aria-pressed="${s===stage}">${esc(T('stage.'+s))}</button>`).join('')}</nav>`;

 function candidateList(){
  if(!analysable())return `<p class="hint warning">${esc(T('tooBig'))}</p>`;
  if(!candidates.length)return '';
  const current=c=>c.tileWidth===o.tileWidth&&c.tileHeight===o.tileHeight&&c.marginX===o.marginX&&c.marginY===o.marginY&&c.spacingX===o.spacingX&&c.spacingY===o.spacingY;
  return `<span class="opt-label">${esc(T('detect'))}</span><div class="tl-cands">${candidates.map((c,i)=>`<button type="button" class="tl-cand" data-action="tl-cand" data-i="${i}" aria-pressed="${current(c)}">
<b>${c.tileWidth}×${c.tileHeight}</b><span class="tl-score">${pct(c.score)}</span>
<small>${esc(T('gridInfo',{c:c.cols,r:c.rows,w:c.tileWidth,h:c.tileHeight}))}${c.marginX||c.marginY?` · ${esc(T('marginX'))} ${c.marginX}/${c.marginY}`:''}${c.spacingX||c.spacingY?` · ${esc(T('spacingX'))} ${c.spacingX}/${c.spacingY}`:''}</small>
<small class="tl-ev">${['repeatedEdges','boundaryEdges','separators'].map(k=>`<i>${esc(T('evidence.'+k))} ${pct(c.evidence[k])}</i>`).join('')}</small></button>`).join('')}</div><p class="viewer-note">${esc(T('detectNote'))}</p>`;
 }
 function gridSide(){
  const blank=blanks(),dup=data&&grid?.rects.length?duplicateGroups(tileHashes()):[];
  const summary=grid?.error?`<div class="summary-line bad">${esc(grid.error)}</div>`
   :`<div class="summary-big">${grid.count}</div><div class="summary-line">${esc(T('gridInfo',{c:grid.cols,r:grid.rows,w:grid.tileWidth,h:grid.tileHeight}))}${blank.length?' · '+esc(T('blankCount',{n:blank.length})):''}${dup.length?' · '+esc(T('duplicates',{n:dup.length})):''}</div>`;
  return `<div class="summary" id="tlSummary" role="status" aria-live="polite">${summary}</div>
<form id="tlOptions" class="options" autocomplete="off">${candidateList()}
<span class="opt-label">${esc(T('manual'))}</span><div class="field-row">${field('tileWidth',1,4096)}${field('tileHeight',1,4096)}</div>
<div class="field-row">${field('marginX',0,256)}${field('marginY',0,256)}</div><div class="field-row">${field('spacingX',0,256)}${field('spacingY',0,256)}</div>
<details class="options-advanced" ${o.extrude?'open':''}><summary>${esc(text('advanced'))}</summary>
${check('skipBlank')}<span class="opt-label">${esc(T('dedupe'))}</span>${seg('dedupe',['none','exact','near'],v=>esc(T('dedupe'+v[0].toUpperCase()+v.slice(1))))}
${o.dedupe==='near'?`${field('nearMean',0,32)}<p class="viewer-note">${esc(T('nearNote'))}</p>`:''}
${check('variants')}<p class="viewer-note">${esc(T('variantsNote'))}</p>
${field('extrude',0,16)}<p class="viewer-note">${esc(T('extrudeNote'))}</p>
<span class="opt-label">${esc(T('collideLabel'))}</span>${seg('collide',COLLISION_MODES,v=>esc(T('collide.'+v)))}
${o.collide==='none'?'':`<div class="field-row">${field('alpha',0,254)}${field('simplify',0,8)}</div><p class="viewer-note">${esc(T('collideNote'))}</p>`}</details></form>
<button type="button" class="primary big" id="taskDownload" data-action="tl-slice" ${grid?.error?'disabled':''}>${esc(T('run'))}</button>
<nav class="next" id="tlNext"></nav><small class="local-note">${esc(text('local'))}</small>`;
 }
 function gridBoard(){
  return `<div class="board-bar"><span class="board-count" id="tlInfo"></span>${check('lines')}<label class="field compact"><span>${esc(T('zoom'))}</span><input data-option="zoom" id="tl-zoom" type="number" min="1" max="8" value="${o.zoom}"></label></div>
<div class="tl-stage" id="tlStage"><div class="tl-sheet" id="tlSheetBox"><canvas id="tlSheet" class="px"></canvas><svg id="tlGridSvg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"></svg></div></div>`;
 }
 function templatesSide(){
  const l=layout();
  return `<div class="summary"><div class="summary-big">${l.count}</div><div class="summary-line">${esc(T('kinds.'+o.kind))} · ${esc(T('count',{n:l.count}))}</div></div>
<form class="options" autocomplete="off"><span class="opt-label">${esc(T('kind'))}</span>${seg('kind',KINDS,v=>esc(T('kinds.'+v)))}
<p class="viewer-note">${esc(T('kindNote.'+o.kind))}</p>${field('templateSize',8,256)}</form>
<button type="button" class="primary big" id="taskDownload" data-action="tl-template">${esc(T('runTemplate'))}</button>
<p class="viewer-note">${esc(T('templateNote'))}</p><small class="local-note">${esc(text('local'))}</small>`;
 }
 function templatesBoard(){
  return `<div class="board-bar"><span class="board-count">${esc(T('kinds.'+o.kind))}</span></div><div class="tl-stage"><canvas id="tlTemplate" class="px tl-fit"></canvas></div>`;
 }
 function testerSide(){
  const l=layout();
  return `<div class="summary" id="tlMapSummary" role="status" aria-live="polite"></div>
<form class="options" autocomplete="off"><span class="opt-label">${esc(T('kind'))}</span>${seg('kind',KINDS,v=>esc(T('kinds.'+v)))}
<p class="viewer-note">${esc(T('kindNote.'+o.kind))}</p>
<span class="opt-label">${esc(T('source'))}</span>${seg('source',['sheet','template'],v=>esc(v==='sheet'?T('sourceSheet'):T('sourceTemplate')))}
${o.source==='sheet'?field('offset',0,Math.max(0,(grid?.count||1)-1)):''}
<span class="opt-label">${esc(T('paint'))}</span>${seg('brush',['paint','erase'],v=>esc(T(v)))}
<div class="chips-row"><button type="button" class="mini-button" data-action="tl-fill">${esc(T('fillAll'))}</button><button type="button" class="mini-button" data-action="tl-clear">${esc(T('clear'))}</button><button type="button" class="mini-button" data-action="tl-random">${esc(T('randomFill'))}</button></div>
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary><div class="field-row">${field('gridSize',4,64)}${field('seed',0,999999)}</div>
<div class="field-row">${field('mapZoom',1,12)}</div>${check('outside')}${check('gridLines')}
<label class="field"><span>${esc(T('importLayout'))}</span><input id="tlLayoutFile" type="file" accept="application/json,.json"></label></details></form>
<p class="viewer-note">${esc(T('testerNote'))} ${esc(T('keyboardNote'))}</p><small class="local-note">${esc(text('local'))}</small>`;
 }
 function testerBoard(){
  return `<div class="board-bar"><span class="board-count" id="tlMapInfo"></span></div>
<div class="tl-stage"><canvas id="tlMap" class="px tl-paint" tabindex="0" role="application" aria-label="${esc(T('testerNote'))}"></canvas></div>`;
 }
 function rulesSide(){
  const report=ruleReport();
  return `<div class="summary" id="tlRules" role="status" aria-live="polite"><div class="summary-big${report.missing.length?' muted':''}">${report.missing.length||'0'}</div>
<div class="summary-line">${report.missing.length?esc(T('missing',{n:report.missing.length})):esc(T('complete'))}${report.identical.length?' · '+esc(T('identical',{n:report.identical.length})):''}</div></div>
<form class="options" autocomplete="off"><span class="opt-label">${esc(T('kind'))}</span>${seg('kind',KINDS,v=>esc(T('kinds.'+v)))}
${field('offset',0,Math.max(0,(grid?.count||1)-1))}
${unrepresentable(o.kind).length?`<p class="viewer-note">${esc(T('unrepresentable',{n:unrepresentable(o.kind).length}))}</p>`:''}
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary><div class="field-row">${field('gridSize',4,64)}${field('seed',0,999999)}</div></details></form>
<div class="chips-row"><button type="button" class="mini-button" data-action="tl-reroll">${esc(T('preview'))}</button></div>
<p class="viewer-note">${esc(T('previewNote'))}</p><small class="local-note">${esc(text('local'))}</small>`;
 }
 function rulesBoard(){
  const report=ruleReport();
  return `<div class="board-bar"><span class="board-count">${esc(T('kinds.'+o.kind))}</span>${check('lines')}</div>
<div class="tl-stage"><div class="tl-sheet" id="tlSheetBox"><canvas id="tlSheet" class="px"></canvas><svg id="tlGridSvg" xmlns="http://www.w3.org/2000/svg"></svg></div></div>
${report.missing.length?`<div class="view-head"><strong>${esc(T('ghost'))}</strong><span>${esc(T('missing',{n:report.missing.length}))}</span></div>
<div class="tl-ghosts">${report.missing.map(s=>`<figure><canvas class="px" data-ghost="${s.index}" width="48" height="48"></canvas><figcaption>${s.index} · ${esc(s.name)}<small>${esc(T('roles.'+s.role))}</small></figcaption></figure>`).join('')}</div>`:''}
<div class="view-head"><strong>${esc(T('preview'))}</strong><span id="tlPreviewInfo"></span></div><div class="tl-stage small"><canvas id="tlPreview" class="px tl-fit"></canvas></div>`;
 }
 /** The verdict and the numbers, rebuilt in place so changing the tile number does not rebuild
  * the form under the person's cursor. */
 function seamVerdict(r){
  return `<div class="summary-big${r&&!r.report.seamless?' muted':''}">${r?(r.report.seamless?'✓':'✕'):'—'}</div>
<div class="summary-line">${r?esc(r.report.seamless?T('seamlessYes'):T('seamlessNo')):esc(T('needTile'))}</div>`;
 }
 const seamNumbers=r=>!r?'':`<dt>${esc(T('diffH'))}</dt><dd>${num(r.report.horizontal.mean)} · ${esc(T('ratio',{n:num(r.report.horizontal.ratio)}))}</dd>
<dt>${esc(T('diffV'))}</dt><dd>${num(r.report.vertical.mean)} · ${esc(T('ratio',{n:num(r.report.vertical.ratio)}))}</dd>
<dt>${esc(T('neighbour'))}</dt><dd>${num(r.report.horizontal.neighbourMean)} / ${num(r.report.vertical.neighbourMean)}</dd>`;
 const seamMatch=r=>!r?.match?'':r.match.map(m=>`<dt>${esc(T('sides.'+m.side))}</dt><dd>${num(m.mean)} · ${esc(m.fits?T('fits'):T('notFit'))}</dd>`).join('');
 function seamsSide(){
  const r=seamStats();
  return `<div class="summary" id="tlSeamSummary" role="status" aria-live="polite">${seamVerdict(r)}</div>
<form class="options" autocomplete="off">${field('seamIndex',0,Math.max(0,(grid?.count||1)-1))}
<span class="opt-label">${esc(T('repeat'))}</span>${seg('repeat',[2,3],v=>v+'×'+v)}
<dl class="tl-numbers" id="tlSeamNumbers">${seamNumbers(r)}</dl>
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary><p class="viewer-note">${esc(T('healNote'))}</p>${field('blend',0,64)}
${field('matchIndex',0,Math.max(0,(grid?.count||1)-1))}<dl class="tl-numbers" id="tlSeamMatch">${seamMatch(r)}</dl></details></form>
<button type="button" class="primary big" id="taskDownload" data-action="tl-heal-save" ${r?'':'disabled'}>${esc(T('healSave'))}</button><small class="local-note">${esc(text('local'))}</small>`;
 }
 function seamsBoard(){
  return `<div class="board-bar"><span class="board-count" id="tlSeamInfo"></span>${check('healed')}</div>
<div class="tl-stage"><canvas id="tlRepeat" class="px tl-fit"></canvas></div>
<div class="tl-heat"><div><span>${esc(T('diffH'))}</span><canvas id="tlHeatH" class="px" height="12"></canvas></div><div><span>${esc(T('diffV'))}</span><canvas id="tlHeatV" class="px" height="12"></canvas></div></div>`;
 }
 function exportSide(){
  return `<div class="summary"><div class="summary-big">${layout().count}</div><div class="summary-line">${esc(T('kinds.'+o.kind))} · ${esc(T('modes.'+(o.mode||modeFor(o.kind))))}</div></div>
<form class="options" autocomplete="off"><span class="opt-label">${esc(T('kind'))}</span>${seg('kind',KINDS,v=>esc(T('kinds.'+v)))}
<label class="field"><span>${esc(T('terrainName'))}</span><input data-option="terrainName" id="tl-terrainName" type="text" maxlength="40" value="${esc(o.terrainName)}"></label>
<label class="field"><span>${esc(T('mode'))}</span><select data-option="mode" id="tl-mode">${MODES.map(m=>`<option value="${m}" ${(o.mode||modeFor(o.kind))===m?'selected':''}>${esc(T('modes.'+m))}</option>`).join('')}</select></label>
<span class="opt-label">${esc(T('collideLabel'))}</span>${seg('collide',COLLISION_MODES,v=>esc(T('collide.'+v)))}
${field('offset',0,Math.max(0,(grid?.count||1)-1))}</form>
<button type="button" class="primary big" id="taskDownload" data-action="tl-godot" ${grid?.rects.length?'':'disabled'}>${esc(T('runGodot'))}</button>
<p class="viewer-note">${esc(T('godotNote'))}</p><small class="local-note">${esc(text('local'))}</small>`;
 }
 function exportBoard(){
  if(!grid?.rects.length)return `<p class="hint warning">${esc(T('needGrid'))}</p>`;
  const pack=godotPack(),short=layout().count-pack.json.tileSet.tiles.length;
  return `<div class="board-bar"><span class="board-count">${esc(T('count',{n:pack.json.tileSet.tiles.length}))} → TileSet</span></div>
${short>0?`<p class="hint warning">${esc(T('shortPack',{n:short,total:layout().count}))}</p>`:''}
<ol class="tl-steps">${godotReadme(pack.json).steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
${listing('nerulio-tileset.json',JSON.stringify(pack.json,null,1))}
${listing('nerulio_tileset_import.gd',pack.script)}`;
 }
 /** A readable excerpt of a file that is in the download, labelled with what was cut. */
 function listing(name,body){
  const shown=body.slice(0,2400);
  return `<div class="view-head"><strong>${esc(name)}</strong><span>${esc(T('excerpt',{n:shown.length,total:body.length}))}</span></div>
<pre class="tl-code" tabindex="0">${esc(shown)}${body.length>shown.length?'\n…':''}</pre>`;
 }
 function frame(){
  const boards={grid:gridBoard,templates:templatesBoard,tester:testerBoard,rules:rulesBoard,seams:seamsBoard,export:exportBoard};
  const sides={grid:gridSide,templates:templatesSide,tester:testerSide,rules:rulesSide,seams:seamsSide,export:exportSide};
  el.innerHTML=`<div class="work tl-work">${stageBar()}<section class="board" id="tlBoard">${boards[stage]()}</section><aside class="side" id="tlSide">${sides[stage]()}</aside></div>`;
  paint();
 }

 /* ---------- drawing ---------- */
 function drawSheet(){
  const cv=q('#tlSheet');if(!cv||!src)return;
  if(cv.width!==src.width){cv.width=src.width;cv.height=src.height;}
  const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(src,0,0);
  const box=q('#tlSheetBox');if(box)fit(box,src.width,o.zoom,1000);
  const svg=q('#tlGridSvg');if(!svg)return;
  svg.setAttribute('viewBox',`0 0 ${src.width} ${src.height}`);
  if(!o.lines||!grid?.rects.length){svg.innerHTML='';return;}
  const cells=grid.rects.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`).join('');
  svg.innerHTML=cells+(stage==='rules'?ruleOverlay():'');
 }
 function drawTemplate(){
  const cv=q('#tlTemplate');if(!cv)return;
  const l=layout(),size=o.templateSize,scale=Math.max(1,Math.round(96/size)),labelled=templateCanvas(size*scale,{labels:true});
  cv.width=labelled.width;cv.height=labelled.height;
  const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(labelled,0,0);
  ctx.strokeStyle='#0b142533';ctx.lineWidth=1;
  for(let i=1;i<l.columns;i++){ctx.beginPath();ctx.moveTo(i*size*scale,0);ctx.lineTo(i*size*scale,cv.height);ctx.stroke();}
  for(let i=1;i<l.rows;i++){ctx.beginPath();ctx.moveTo(0,i*size*scale);ctx.lineTo(cv.width,i*size*scale);ctx.stroke();}
  Im.release(labelled);
 }
 function ensureTerrain(){
  if(!terrain||terrain.w!==o.gridSize||terrain.h!==o.gridSize){
   terrain=terrainGrid(o.gridSize,o.gridSize);
   for(let y=2;y<o.gridSize-2;y++)for(let x=2;x<o.gridSize-2;x++)terrain.cells[y*o.gridSize+x]=1;
  }
  return terrain;
 }
 /** Draws a rendered slot map with the current tile art; missing slots get a labelled ghost. */
 function drawRendered(cv,rendered,tile,{lines=false,cursorAt=null}={}){
  const {w,h}=tile,ctx=cv.getContext('2d');
  cv.width=rendered.w*w;cv.height=rendered.h*h;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);
  let missing=0;
  for(let y=0;y<rendered.h;y++)for(let x=0;x<rendered.w;x++){
   const index=rendered.slots[y*rendered.w+x];if(index<0)continue;
   const rect=tile.rect(index);
   if(!rect){
    missing++;ctx.fillStyle=GHOST;ctx.globalAlpha=.55;ctx.fillRect(x*w,y*h,w,h);ctx.globalAlpha=1;
    ctx.strokeStyle=MARK;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x*w+1,y*h+1);ctx.lineTo(x*w+w-1,y*h+h-1);ctx.moveTo(x*w+w-1,y*h+1);ctx.lineTo(x*w+1,y*h+h-1);ctx.stroke();
    continue;
   }
   ctx.drawImage(tile.canvas,rect.x,rect.y,rect.w,rect.h,x*w,y*h,w,h);
  }
  if(lines){
   ctx.strokeStyle='#0b142544';ctx.lineWidth=1;
   for(let x=1;x<rendered.w;x++){ctx.beginPath();ctx.moveTo(x*w+.5,0);ctx.lineTo(x*w+.5,cv.height);ctx.stroke();}
   for(let y=1;y<rendered.h;y++){ctx.beginPath();ctx.moveTo(0,y*h+.5);ctx.lineTo(cv.width,y*h+.5);ctx.stroke();}
  }
  if(cursorAt){
   // On a dual grid the tile at (x+1,y+1) is the one the terrain cell (x,y) sits under.
   const shift=rendered.offsetX?1:0;
   ctx.strokeStyle='#3182f6';ctx.lineWidth=2;ctx.strokeRect((cursorAt.x+shift)*w+1,(cursorAt.y+shift)*h+1,w-2,h-2);
  }
  return missing;
 }
 function drawMap(){
  const cv=q('#tlMap');if(!cv)return;
  const g=ensureTerrain(),rendered=renderMap(o.kind,g,{outside:o.outside}),tile=tileArt();
  const missing=drawRendered(cv,rendered,tile,{lines:o.gridLines,cursorAt:cursor});
  fit(cv,cv.width,o.mapZoom,900);
  const info=q('#tlMapInfo');if(info)info.textContent=`${rendered.w} × ${rendered.h} · ${T('kinds.'+o.kind)}`;
  const box=q('#tlMapSummary');
  if(box)box.innerHTML=`<div class="summary-big${missing?' muted':''}">${missing||'✓'}</div><div class="summary-line">${missing?esc(T('missingHere',{n:missing})):esc(T('complete'))}</div>`;
 }
 function ruleReport(){
  const l=layout(),present=[],identical=[];
  if(grid?.rects.length){
   const blank=new Set(blanks()),hashList=data?tileHashes():[],byHash=new Map();
   for(const slot of l.slots){
    const index=slot.index+o.offset,rect=grid.rects[index];
    if(!rect||blank.has(index))continue;
    present.push({key:slot.key,tile:index});
    const hash=hashList[index];
    if(hash){if(byHash.has(hash))identical.push([byHash.get(hash),slot.index]);else byHash.set(hash,slot.index);}
   }
  }
  return {...completeness(o.kind,present),identical};
 }
 /** Marks on the sheet: which slot each tile satisfies, its role, and the peering bits as dots
  * at the eight neighbour positions — labels and positions, never colour alone. */
 function ruleOverlay(){
  const l=layout();let out='';
  for(const slot of l.slots){
   const rect=grid.rects[slot.index+o.offset];if(!rect)continue;
   const s=Math.max(2,Math.round(Math.min(rect.w,rect.h)/9));
   const dots=[['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5],['nw',0,0]]
    .filter(([k])=>k.length===1?slot.edges[k]:slot.corners[k])
    .map(([,fx,fy])=>`<rect class="tl-bit" x="${rect.x+fx*(rect.w-s)}" y="${rect.y+fy*(rect.h-s)}" width="${s}" height="${s}"/>`).join('');
   out+=`<g class="tl-rule"><rect class="tl-cell" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/>${dots}<text x="${rect.x+rect.w/2}" y="${rect.y+rect.h/2}" font-size="${Math.max(5,rect.h/3.4)}">${slot.index}</text></g>`;
  }
  return out;
 }
 function drawGhosts(){
  for(const cv of el.querySelectorAll('[data-ghost]')){
   const slot=layout().slots[Number(cv.dataset.ghost)],ctx=cv.getContext('2d');
   ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);drawSlot(ctx,slot,0,0,48);
   ctx.strokeStyle=GHOST;ctx.lineWidth=3;ctx.strokeRect(1.5,1.5,45,45);
  }
 }
 function drawPreview(){
  const cv=q('#tlPreview');if(!cv)return;
  const g=seededFill(terrainGrid(o.gridSize,o.gridSize),o.seed),rendered=renderMap(o.kind,g,{outside:o.outside}),tile=tileArt();
  const missing=drawRendered(cv,rendered,tile,{});
  fit(cv,cv.width,2,640);
  const info=q('#tlPreviewInfo');if(info)info.textContent=missing?T('missingHere',{n:missing}):T('complete');
 }
 function seamTile(index){
  const rect=grid?.rects[index];if(!rect||!data)return null;
  const raw=cropRGBA(data,src.width,src.height,rect);
  if(rect.w<2||rect.h<2)return null;
  const healed=o.healed?makeSeamless(raw,rect.w,rect.h,o.blend?{blendX:Math.min(o.blend,Math.floor(rect.w/2)-1),blendY:Math.min(o.blend,Math.floor(rect.h/2)-1)}:{}):null;
  const shown=healed||raw;
  return {rect,raw,shown,w:rect.w,h:rect.h};
 }
 function seamStats(){
  const tile=seamTile(o.seamIndex);if(!tile)return null;
  const report=seamReport(tile.shown,tile.w,tile.h);
  let match=null;
  const other=seamTile(o.matchIndex);
  if(other&&other.w===tile.w&&other.h===tile.h&&o.matchIndex!==o.seamIndex)match=bestEdge({data:tile.shown,w:tile.w,h:tile.h},{data:other.shown,w:other.w,h:other.h});
  return {tile,report,match};
 }
 function drawSeams(){
  const cv=q('#tlRepeat');if(!cv)return;
  const s=seamStats();
  const info=q('#tlSeamInfo');
  for(const [sel,html] of [['#tlSeamSummary',seamVerdict(s)],['#tlSeamNumbers',seamNumbers(s)],['#tlSeamMatch',seamMatch(s)]]){const box=q(sel);if(box)box.innerHTML=html;}
  const save=q('#taskDownload');if(save)save.disabled=!s;
  if(!s){cv.width=cv.height=1;if(info)info.textContent=T('needTile');return;}
  const {w,h}=s.tile,n=o.repeat,src2=Im.canvas(w,h);
  src2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(s.tile.shown),w,h),0,0);
  cv.width=w*n;cv.height=h*n;
  const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)ctx.drawImage(src2,x*w,y*h);
  Im.release(src2);
  fit(cv,cv.width,Math.max(1,Math.round(320/(w*n))),640);
  if(info)info.textContent=`#${o.seamIndex} · ${w}×${h} · ${n}×${n}`;
  for(const [id,profile,vertical] of [['#tlHeatH',s.report.horizontal.profile,true],['#tlHeatV',s.report.vertical.profile,false]]){
   const strip=q(id);if(!strip)continue;
   // Scaled against the difference between ordinary neighbouring lines inside the tile, so a
   // seamless tile stays cool instead of glowing red at its own tiny maximum.
   const reference=Math.max(8,(vertical?s.report.horizontal:s.report.vertical).neighbourMean*2);
   const map=heatmap(profile,{reference});strip.width=profile.length;strip.height=12;
   const c=strip.getContext('2d');c.clearRect(0,0,strip.width,12);
   for(let i=0;i<profile.length;i++){
    const v=map.values[i];
    c.fillStyle=`rgb(${Math.round(40+215*v)},${Math.round(120-80*v)},${Math.round(110-70*v)})`;
    c.fillRect(i,0,1,12);
   }
   strip.setAttribute('aria-label',`${vertical?T('diffH'):T('diffV')} ${num(map.max,0)} / ${num(map.reference,0)}`);
  }
 }
 function godotPack(){
  const l=layout(),mode=o.mode||modeFor(o.kind);
  const json=godotTileSet({layout:l,grid:grid||{tileWidth:o.tileWidth,tileHeight:o.tileHeight,marginX:0,marginY:0,spacingX:0,spacingY:0,rects:[],cols:0,rows:0,count:0},
   offset:o.offset,mode,terrainName:o.terrainName,collision:collisionShapes(),collisionMode:o.collide,image:(src?stem(src.name||'tileset'):'tileset')+'.png',
   width:src?src.width:l.columns*o.tileWidth,height:src?src.height:l.rows*o.tileHeight});
  return {json,script:godotScript()};
 }
 function paint(){
  if(stage==='grid'||stage==='rules')drawSheet();
  if(stage==='grid'){const info=q('#tlInfo');if(info)info.textContent=`${src.width} × ${src.height}`;}
  if(stage==='templates')drawTemplate();
  if(stage==='tester')drawMap();
  if(stage==='rules'){drawGhosts();drawPreview();}
  if(stage==='seams')drawSeams();
 }

 /* ---------- export ---------- */
 async function pngOf(pixels,w,h){
  const c=Im.canvas(w,h);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),w,h),0,0);
  try{return await Im.blobOf(c);}finally{Im.release(c);}
 }
 function extrudedAtlas(pad){
  const cell=[o.tileWidth+pad*2,o.tileHeight+pad*2],c=Im.canvas(grid.cols*cell[0],grid.rows*cell[1]),ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  for(const r of grid.rects){
   const dx=r.col*cell[0]+pad,dy=r.row*cell[1]+pad;
   // Nine blits: the tile, its four edges stretched outwards and its four corner pixels.
   for(const [tx,ty,tw,th,sx,sy,sw,sh] of [[0,0,r.w,r.h,0,0,r.w,r.h],[-pad,0,pad,r.h,0,0,1,r.h],[r.w,0,pad,r.h,r.w-1,0,1,r.h],
    [0,-pad,r.w,pad,0,0,r.w,1],[0,r.h,r.w,pad,0,r.h-1,r.w,1],[-pad,-pad,pad,pad,0,0,1,1],[r.w,-pad,pad,pad,r.w-1,0,1,1],
    [-pad,r.h,pad,pad,0,r.h-1,1,1],[r.w,r.h,pad,pad,r.w-1,r.h-1,1,1]])
    ctx.drawImage(src,r.x+sx,r.y+sy,sw,sh,dx+tx,dy+ty,tw,th);
  }
  return c;
 }
 async function slice(){
  if(busy||!grid||grid.error)return;busy=true;
  const button=q('#taskDownload');if(button)button.disabled=true;
  try{
   const blank=new Set(o.skipBlank?blanks():[]);
   let keep=grid.rects.filter(r=>!blank.has(r.index));
   const aliases=new Map();
   if(o.dedupe!=='none'&&data){
    // Only tiles that are actually written can alias each other: skipped blanks are all
    // identical, and listing them as duplicates of one another says nothing.
    const kept=keep.map(r=>r.index),hashList=tileHashes();
    const groups=o.dedupe==='exact'||kept.length>2048
     ?duplicateGroups(kept.map(i=>hashList[i])).map(g=>g.map(i=>kept[i]))
     :nearDuplicateGroups(kept.map(i=>tileData(i)),{maxMean:o.nearMean}).map(g=>g.indices.map(i=>kept[i]));
    for(const group of groups)for(const index of group.slice(1))aliases.set(index,group[0]);
    keep=keep.filter(r=>!aliases.has(r.index));
   }
   if(!keep.length)throw Error(t('저장할 파일이 없습니다.'));
   const entries=[],list=[];
   for(const r of keep){
    const name=tileName(r.index,grid.count)+'.png',pixels=tileData(r.index);
    entries.push({name:'tiles/'+name,blob:pixels?await pngOf(pixels,r.w,r.h):await regionBlob(r)});
    list.push({...r,name});
    if(o.variants&&pixels)for(const v of variantSet(pixels,r.w,r.h,VARIANTS)){
     const vn=`${tileName(r.index,grid.count)}-${v.kind}.png`;
     entries.push({name:'variants/'+vn,blob:await pngOf(v.data,v.w,v.h)});
     list.push({index:r.index,col:r.col,row:r.row,x:r.x,y:r.y,w:v.w,h:v.h,name:vn,tag:v.kind,aliasOf:name});
    }
   }
   const shapes=collisionShapes();
   if(shapes)for(const item of list)if(!item.tag)item.collision=shapes.get(item.index)||[];
   const meta=sliceMetadata(grid,{image:(src.name?stem(src.name):'tileset')+'.png',width:src.width,height:src.height,tiles:list});
   if(o.collide!=='none'){meta.tileSet.collision={mode:o.collide,alphaThreshold:o.alpha,simplify:o.simplify};}
   meta.tileSet.skippedBlank=blank.size;meta.tileSet.deduplicated=aliases.size;meta.tileSet.dedupeMode=o.dedupe;
   if(o.dedupe==='near')meta.tileSet.nearMeanThreshold=o.nearMean;
   if(aliases.size)meta.tileSet.aliases=Object.fromEntries([...aliases].map(([from,to])=>[tileName(from,grid.count)+'.png',tileName(to,grid.count)+'.png']));
   entries.push({name:'metadata.json',blob:new Blob([JSON.stringify(meta,null,1)],{type:'application/json'})});
   if(o.extrude>0){
    const atlas=extrudedAtlas(o.extrude);
    try{entries.push({name:'padded-atlas.png',blob:await Im.blobOf(atlas)});}finally{Im.release(atlas);}
   }
   const blob=await zip(entries,{paths:true});
   download(blob,`${src.name?stem(src.name):'tileset'}-tiles.zip`);
   track('tool_success',{intent:route.id});
   toast(T('done',{size:bytes(blob.size)}));
   const next=q('#tlNext');
   if(next)next.innerHTML=`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="tl-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
  }catch(error){toast(error?.message||String(error),{error:true});}
  finally{busy=false;const b=q('#taskDownload');if(b)b.disabled=false;}
 }
 async function regionBlob(r){
  const c=Im.canvas(r.w,r.h),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.drawImage(src,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  try{return await Im.blobOf(c);}finally{Im.release(c);}
 }
 async function exportTemplate(){
  if(busy)return;busy=true;
  const size=o.templateSize,scale=Math.max(1,Math.round(96/size));
  const plain=templateCanvas(size),labelled=templateCanvas(size*scale,{labels:true});
  try{
   const json=layoutJSON(o.kind,{tileWidth:size,tileHeight:size,image:`${o.kind}-template.png`});
   const blob=await zip([
    {name:`${o.kind}-template.png`,blob:await Im.blobOf(plain)},
    {name:`${o.kind}-template-labelled-${scale}x.png`,blob:await Im.blobOf(labelled)},
    {name:`${o.kind}-layout.json`,blob:new Blob([JSON.stringify(json,null,1)],{type:'application/json'})}]);
   download(blob,`${o.kind}-template.zip`);track('tool_success',{intent:route.id});toast(T('done',{size:bytes(blob.size)}));
  }catch(error){toast(error?.message||String(error),{error:true});}
  finally{Im.release(plain);Im.release(labelled);busy=false;}
 }
 async function saveHealed(){
  const s=seamStats();if(!s||busy)return;busy=true;
  try{
   const pixels=o.healed?s.tile.shown:makeSeamless(s.tile.raw,s.tile.w,s.tile.h,o.blend?{blendX:Math.min(o.blend,Math.floor(s.tile.w/2)-1),blendY:Math.min(o.blend,Math.floor(s.tile.h/2)-1)}:{});
   download(await pngOf(pixels,s.tile.w,s.tile.h),`${src.name?stem(src.name):'tile'}-${o.seamIndex}-seamless.png`);
   track('tool_success',{intent:route.id});
  }catch(error){toast(error?.message||String(error),{error:true});}finally{busy=false;}
 }
 async function exportGodot(){
  if(busy||!grid?.rects.length)return;busy=true;
  try{
   const pack=godotPack(),name=src.name?stem(src.name):'tileset';
   const sheet=await Im.blobOf(src);
   const blob=await zip([
    {name:pack.json.meta.image,blob:sheet},
    {name:'nerulio-tileset.json',blob:new Blob([JSON.stringify(pack.json,null,1)],{type:'application/json'})},
    {name:'nerulio_tileset_import.gd',blob:new Blob([pack.script],{type:'text/plain'})},
    {name:'README.txt',blob:new Blob([godotReadme(pack.json).text],{type:'text/plain'})}]);
   download(blob,`${name}-godot4.zip`);track('tool_success',{intent:route.id});toast(T('done',{size:bytes(blob.size)}));
  }catch(error){toast(error?.message||String(error),{error:true});}finally{busy=false;}
 }

 /* ---------- interaction ---------- */
 function cellFromEvent(e){
  const cv=q('#tlMap');if(!cv)return null;
  const r=cv.getBoundingClientRect(),rendered=renderMap(o.kind,ensureTerrain(),{outside:o.outside});
  const x=Math.floor((e.clientX-r.left)/r.width*rendered.w)+(rendered.offsetX?-1:0);
  const y=Math.floor((e.clientY-r.top)/r.height*rendered.h)+(rendered.offsetY?-1:0);
  return x>=0&&y>=0&&x<terrain.w&&y<terrain.h?{x,y}:null;
 }
 function setCell(x,y,value){
  const g=ensureTerrain();if(cellAt(g,x,y)===(value?1:0))return;
  g.cells[y*g.w+x]=value?1:0;cursor={x,y};drawMap();
 }
 function stageTo(next){
  if(!STAGES.includes(next)||next===stage)return;
  stage=next;dropArt();frame();
  const url=new URL(location.href);url.searchParams.set('stage',next);history.replaceState({},'',url);
 }
 function readOptions(){
  const form=el.querySelector('.options');if(!form)return;
  for(const input of el.querySelectorAll('[data-option]')){
   const key=input.dataset.option;
   if(input.type==='checkbox')o[key]=input.checked;
   else if(input.type==='number'){const spec={tileWidth:[1,4096],tileHeight:[1,4096],marginX:[0,256],marginY:[0,256],spacingX:[0,256],spacingY:[0,256],zoom:[1,8],nearMean:[0,32],extrude:[0,16],templateSize:[8,256],offset:[0,4095],gridSize:[4,64],seed:[0,999999],mapZoom:[1,12],seamIndex:[0,4095],matchIndex:[0,4095],blend:[0,64],alpha:[0,254],simplify:[0,8]}[key]||[0,4096];o[key]=int(input.value,spec[0],spec[1],o[key]);}
   else o[key]=input.value;
  }
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const a=b.dataset.action;
  if(a==='tl-sample'){add(await sample(),'sample');return;}
  if(a==='tl-stage')return stageTo(b.dataset.stage);
  if(a==='tl-cand'){applyCandidate(candidates[Number(b.dataset.i)]);frame();return;}
  if(a==='tl-set'){
   const key=b.dataset.key,value=b.dataset.value;
   o[key]=/^\d+$/.test(value)?Number(value):value;
   if(key==='source')o.sourcePinned=true;
   if(key==='kind'){o.mode='';pickSource();}
   for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
   dropArt();frame();return;
  }
  if(a==='tl-fill'){const g=ensureTerrain();g.cells.fill(1);return drawMap();}
  if(a==='tl-clear'){const g=ensureTerrain();g.cells.fill(0);return drawMap();}
  if(a==='tl-random'){terrain=seededFill(ensureTerrain(),o.seed);o.seed=(o.seed+1)%1000000;const f=q('#tl-seed');if(f)f.value=o.seed;return drawMap();}
  if(a==='tl-reroll'){o.seed=(o.seed+1)%1000000;const f=q('#tl-seed');if(f)f.value=o.seed;return drawPreview();}
  if(a==='tl-slice')return slice();
  if(a==='tl-template')return exportTemplate();
  if(a==='tl-heal-save')return saveHealed();
  if(a==='tl-godot')return exportGodot();
  if(a==='tl-next')return continueWith(b.dataset.tool,[new File([await Im.blobOf(src)],(src.name?stem(src.name):'tileset')+'.png',{type:'image/png'})]);
 });
 el.addEventListener('input',e=>{
  if(!e.target.matches('[data-option]'))return;
  const key=e.target.dataset.option;readOptions();
  if(['tileWidth','tileHeight','marginX','marginY','spacingX','spacingY'].includes(key)){rebuild();frame();return;}
  if(['dedupe','variants','skipBlank','extrude','nearMean','alpha','simplify'].includes(key)){frame();return;}
  if(key==='offset'||key==='source'||key==='gridSize'){dropArt();if(stage==='rules')frame();else paint();return;}
  if(key==='terrainName'||key==='mode'){if(stage==='export')frame();return;}
  paint();
 });
 el.addEventListener('change',async e=>{
  if(e.target.matches('select[data-option]')){readOptions();frame();return;}
  if(e.target.id!=='tlLayoutFile')return;
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  // A layout JSON the Lab exported earlier selects the kind and tile size it was made for.
  try{
   const imported=layoutFromJSON(JSON.parse(await file.text()));
   o.kind=imported.kind;o.templateSize=clamp(imported.tileWidth,8,256);o.mode='';
   dropArt();frame();toast(T('kinds.'+imported.kind));
  }catch(error){toast(error?.message||String(error),{error:true});}
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('pointerdown',e=>{
  if(!e.target.matches('#tlMap'))return;
  const cell=cellFromEvent(e);if(!cell)return;
  e.preventDefault();e.target.focus();e.target.setPointerCapture?.(e.pointerId);
  painting=o.brush==='erase'?0:1;setCell(cell.x,cell.y,painting);
 });
 el.addEventListener('pointermove',e=>{
  if(painting===null||!e.target.matches('#tlMap')||!(e.buttons&1))return;
  const cell=cellFromEvent(e);if(cell)setCell(cell.x,cell.y,painting);
 });
 addEventListener('pointerup',()=>{painting=null;});
 el.addEventListener('keydown',e=>{
  if(e.target.matches('.dropzone')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click();return;}
  if(!e.target.matches('#tlMap'))return;
  const g=ensureTerrain(),step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(step){e.preventDefault();cursor={x:clamp(cursor.x+step[0],0,g.w-1),y:clamp(cursor.y+step[1],0,g.h-1)};drawMap();return;}
  if(e.key===' '||e.key==='Enter'){e.preventDefault();setCell(cursor.x,cursor.y,cellAt(g,cursor.x,cursor.y)?0:1);return;}
  if(e.key==='f'||e.key==='F'){e.preventDefault();g.cells.fill(1);drawMap();return;}
  if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();terrain=floodFill(g,cursor.x,cursor.y,0);drawMap();}
 });

 /* ---------- intake ---------- */
 async function sample(){
  // A 47-tile blob template drawn at 16px is a real tileset: it is what the Lab itself exports.
  const l=LAYOUTS.blob47,size=16,c=Im.canvas(l.columns*size,l.rows*size),ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  for(const slot of l.slots)drawSlot(ctx,slot,slot.col*size,slot.row*size,size);
  const file=new File([await Im.blobOf(c)],'blob47-sample.png',{type:'image/png'});
  Im.release(c);return [file];
 }
 async function add(files){
  if(busy)return;busy=true;
  if(files.length>1)toast(text('edit.oneFile'));
  try{
   const decoded=await Im.decode(files[0]);
   Im.release(src);src=decoded;src.name=files[0].name;
   data=null;tiles.clear();hashes=null;dropArt();terrain=null;
   if(src.width*src.height<=ANALYSIS_PIXELS)data=src.getContext('2d',{willReadFrequently:true}).getImageData(0,0,src.width,src.height).data;
   candidates=data?detectGrid(data,src.width,src.height):[];
   const preset=route.query.has('tileWidth')||route.query.has('tileHeight');
   // The seam checker is asked about one repeating texture, so its default tile is the whole
   // image; everywhere else the measured grid is the default.
   if(!preset&&route.id==='seamless-tile-checker')Object.assign(o,{tileWidth:src.width,tileHeight:src.height,marginX:0,marginY:0,spacingX:0,spacingY:0});
   else if(candidates.length&&!preset)Object.assign(o,{tileWidth:candidates[0].tileWidth,tileHeight:candidates[0].tileHeight,marginX:candidates[0].marginX,marginY:candidates[0].marginY,spacingX:candidates[0].spacingX,spacingY:candidates[0].spacingY});
   rebuild();
   o.seamIndex=0;o.matchIndex=Math.min(1,Math.max(0,(grid?.count||1)-1));
   track('tool_run',{intent:route.id});
   ready=true;frame();
  }catch(error){toast(error?.message||String(error),{error:true});if(!src)empty();}
  finally{busy=false;}
 }
 onLocale(()=>{if(ready)frame();else empty();});
 empty();
 return {add};
}
