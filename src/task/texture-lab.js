import * as Im from '../image.js';
import {bytes,stem,zip,safeName} from '../core.js';
import {t} from '../i18n.js';
import {SCHEMA_VERSION} from '../game/model.js';
import {decodePNG,encodeGrayPNG,encodeRGBAPNG,isPNG,MAX_TEXTURE_PIXELS} from '../game/texture-png.js';
import {alphaStats,colorSpread,luminancePlane,planeToRGBA,planeStats} from '../game/texture-channels.js';
import {validateNormalMap} from '../game/texture-normal.js';
import {classifyTextureName,validateTextureSet,WORKFLOWS,WORKFLOW_IDS,ROLES,GRAY_ROLES,colorSpaceOf,isPowerOfTwo} from '../game/texture-set.js';
import {ENGINE_PRESETS,PRESET_IDS,presetChannels,presetSummary} from '../game/texture-presets.js';
import {text,toast,download,track,onLocale,continueWith,toolURL,authorize,page as route} from './shell.js';
import * as maps from './texture-lab-maps.js';
import * as fix from './texture-lab-fix.js';
import {previewStage} from './texture-preview.js';
/** Texture Lab: one workspace for preparing and checking PBR / game textures. Stages share the
 * files in memory — Inspect · Normal · Channels · Preview · Fix · Export — so nothing is
 * re-uploaded between steps. Only measurements and a thumbnail URL are kept per file; full RGBA
 * is decoded for one operation at a time and dropped again, so a set of 4K maps does not cost
 * one full copy each. Everything that must be byte-exact goes through src/game/texture-png.js
 * rather than a canvas, because canvas pixels are premultiplied and lose RGB under alpha 0. */
export const accept='image/*';
export const TOOL_VERSION='1';
export const STAGES=Object.freeze(['inspect','normal','channels','pack','preview','fix','export']);
/** Which stage an intent URL opens. The old texture-map / normal-map-generator route lands on
 * the Normal stage, so a bookmarked link still does what it used to. */
const STAGE_FOR=Object.freeze({'texture-map':'normal','normal-map-converter':'normal','channel-unpacker':'channels','pbr-texture-validator':'inspect','texture-edge-bleed':'fix','texture-lab':'inspect'});
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PREVIEW_MAX=1024;
const LARGE_PIXELS=16_777_216;
export function mount({el,def}){
 const state={files:[],seq:0,active:null,stage:STAGE_FOR[route.id]||'inspect',workflow:'metallic-roughness',preset:'unreal-orm',requireSquare:false,busy:false,report:null,
  normal:maps.normalDefaults(new URLSearchParams(route.query)),channels:maps.channelDefaults(),fixOptions:fix.defaults(),batch:null,view:{}};
 const T=(key,vars)=>text('texture.'+key,vars);
 const q=s=>el.querySelector(s);
 const roleLabel=role=>T('role.'+role);
 const entryOf=id=>state.files.find(f=>String(f.id)===String(id))||null;
 const activeEntry=()=>entryOf(state.active)||state.files[0]||null;
 const urls=new Set();
 const objectURL=blob=>{const url=URL.createObjectURL(blob);urls.add(url);return url;};
 const forget=url=>{if(url&&urls.has(url)){URL.revokeObjectURL(url);urls.delete(url);}};
 /** Exact pixels for export-quality work: the raw PNG path when the file is a PNG, the browser
  * decoder otherwise (and then `exact` is false, which the UI says out loud). */
 async function fullPixels(entry){
  const buffer=new Uint8Array(await entry.file.arrayBuffer());
  if(isPNG(buffer)){
   const png=await decodePNG(buffer);
   return {data:png.data,width:png.width,height:png.height,exact:true,colorType:png.colorType,depth:png.depth,srgb:png.srgb};
  }
  const canvas=await Im.decode(entry.file);
  try{
   const {width,height}=canvas;
   if(width*height>MAX_TEXTURE_PIXELS)throw Error(T('tooLarge',{n:MAX_TEXTURE_PIXELS}));
   return {data:new Uint8Array(canvas.getContext('2d').getImageData(0,0,width,height).data.buffer),width,height,exact:false,colorType:null,depth:8,srgb:false};
  }finally{Im.release(canvas);}
 }
 /** Downscaled pixels for live previews. The browser's own decoder does the scaling, so a 4K
  * map never becomes a full RGBA array just to be looked at. */
 async function previewPixels(entry,max=PREVIEW_MAX){
  const scale=Math.min(1,max/Math.max(entry.width,entry.height));
  const width=Math.max(1,Math.round(entry.width*scale)),height=Math.max(1,Math.round(entry.height*scale));
  if(scale===1&&entry.width*entry.height<=LARGE_PIXELS/4){const full=await fullPixels(entry);return full;}
  let bitmap;
  try{bitmap=await createImageBitmap(entry.file,{resizeWidth:width,resizeHeight:height,resizeQuality:'high'});}
  catch{const full=await fullPixels(entry);return full;}
  const canvas=Im.canvas(width,height);
  try{
   canvas.getContext('2d').drawImage(bitmap,0,0);
   return {data:new Uint8Array(canvas.getContext('2d').getImageData(0,0,width,height).data.buffer),width,height,exact:false,scaled:scale!==1};
  }finally{bitmap.close();Im.release(canvas);}
 }
 /** Exact pixels, nearest-sampled down to `max` and cached for the few textures in play. Channel
  * previews must come from here and not from the browser's scaler: a resized ImageBitmap is
  * premultiplied, which would show black where a packed channel still holds data under alpha 0.
  * Three cached samples at 512² cost about 3 MB, which is the point of the cap. */
 const SAMPLE_MAX=512,samples=new Map();
 async function samplePixels(entry,max=SAMPLE_MAX){
  const key=`${entry.id}:${max}`,cached=samples.get(key);
  if(cached)return cached;
  const raw=await fullPixels(entry);
  try{
   const step=Math.max(1,Math.ceil(Math.max(raw.width,raw.height)/max));
   if(step===1){const value={data:raw.data,width:raw.width,height:raw.height,exact:raw.exact,step};samples.set(key,value);trim();return value;}
   const width=Math.max(1,Math.ceil(raw.width/step)),height=Math.max(1,Math.ceil(raw.height/step)),data=new Uint8Array(width*height*4);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const source=(Math.min(raw.height-1,y*step)*raw.width+Math.min(raw.width-1,x*step))*4;
    data.set(raw.data.subarray(source,source+4),(y*width+x)*4);
   }
   const value={data,width,height,exact:raw.exact,step};samples.set(key,value);trim();return value;
  }finally{if(samples.get(key)?.data!==raw.data)raw.data=null;}
 }
 const trim=()=>{while(samples.size>3)samples.delete(samples.keys().next().value);};
 const planeBlob=(plane,w,h)=>encodeGrayPNG(plane,w,h);
 const rgbaBlob=(data,w,h)=>encodeRGBAPNG(data,w,h);
 /** Draws RGBA (or a single plane) into a canvas element at its natural size; CSS scales it. */
 function paint(canvas,data,w,h,{pixelated=false}={}){
  if(!canvas)return;
  canvas.width=w;canvas.height=h;
  const rgba=data.length===w*h?planeToRGBA(data,w,h):data;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0);
  canvas.classList.toggle('px',pixelated);
 }
 async function measure(entry){
  const raw=await fullPixels(entry);
  try{
   Object.assign(entry,{width:raw.width,height:raw.height,exact:raw.exact,colorType:raw.colorType,depth:raw.depth,srgbChunk:raw.srgb,
    channels:raw.colorType===0||raw.colorType===4?1:3,
    alpha:alphaStats(raw.data,raw.width,raw.height),color:colorSpread(raw.data,raw.width,raw.height),
    normal:validateNormalMap(raw.data,raw.width,raw.height,{maxSamples:262_144}),
    luma:planeStats(luminancePlane(raw.data,raw.width,raw.height)),
    large:raw.width*raw.height>LARGE_PIXELS});
  }finally{raw.data=null;}
 }
 function validation(){
  const entries=state.files.filter(f=>f.width);
  if(!entries.length)return {issues:[],ok:false,roles:[]};
  return validateTextureSet(entries,{workflow:state.workflow,requireSquare:state.requireSquare});
 }
 const ISSUE_VARS={
  'dimension-mismatch':i=>({sizes:i.sizes.join(' / ')}),
  'missing-required':i=>({role:roleLabel(i.role)}),
  'missing-recommended':i=>({role:roleLabel(i.role)}),
  'pack-available':i=>({parts:i.parts.map(roleLabel).join(' + ')}),
  'duplicate-role':i=>({role:roleLabel(i.role),files:i.files.join(', ')}),
  'not-power-of-two':i=>({name:i.name,w:i.width,h:i.height}),
  'not-square':i=>({name:i.name,w:i.width,h:i.height}),
  unclassified:i=>({name:i.name}),
  'unexpected-alpha':i=>({name:i.name,role:roleLabel(i.role),n:i.zeroPixels}),
  'rgb-under-zero-alpha':i=>({name:i.name,n:i.pixels}),
  'gray-stored-as-rgb':i=>({name:i.name,role:roleLabel(i.role)}),
  'gray-channels-differ':i=>({name:i.name,role:roleLabel(i.role),spread:i.maxSpread,ratio:i.ratio}),
  'normal-not-unit':i=>({name:i.name,dev:i.maxDeviation,ratio:i.ratio}),
  'normal-blue-negative':i=>({name:i.name,min:i.minBlue,ratio:i.ratio}),
  'normal-all-flat':i=>({name:i.name}),
  'looks-like-normal':i=>({name:i.name,role:roleLabel(i.role)}),
  'naming-inconsistent':i=>({names:i.names.join(', ')})
 };
 const issueText=issue=>T('issue.'+issue.id,ISSUE_VARS[issue.id]?.(issue)||{});
 // ---- stage context handed to the stage modules -------------------------------------------
 const ctx={state,T,esc,q,el,roleLabel,entryOf,activeEntry,fullPixels,previewPixels,samplePixels,planeBlob,rgbaBlob,paint,objectURL,forget,
  toast,download:(blob,name)=>download(blob,safeName(name)),zip,text,toolURL,bytes,stem,
  render:()=>render(),renderSide:()=>renderSide(),busy:run,validation,issueText,measure,addGenerated:(file,role)=>addGenerated(file,role),
  refreshFiles:()=>{renderFileStrip();},pixelLimit:MAX_TEXTURE_PIXELS};
 const STAGE_MODULES={normal:maps.normalStage,channels:maps.channelStage,preview:previewStage,fix:fix.fixStage,inspect:null,export:null};
 async function run(work){
  if(state.busy)return;
  state.busy=true;syncBusy();
  try{await work();}
  catch(error){if(error?.name!=='AbortError'){toast(error?.message||String(error),{error:true});track('tool_error',{intent:route.id,error_code:'processing_failed'});}}
  finally{state.busy=false;syncBusy();}
 }
 function syncBusy(){
  for(const button of el.querySelectorAll('.tex-lab button[data-action]'))button.classList.toggle('is-busy',state.busy);
  const primary=q('#taskDownload');if(primary)primary.disabled=state.busy||primary.dataset.blocked==='1';
 }
 // ---- rendering ---------------------------------------------------------------------------
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="tex-sample">${esc(text('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  el.innerHTML=`<div class="tex-lab"><nav class="tex-stages" id="texStages" role="tablist" aria-label="${esc(T('stages'))}">${STAGES.map(id=>`<button type="button" role="tab" data-action="tex-stage" data-stage="${id}" aria-selected="${state.stage===id}">${esc(T('stage.'+id))}</button>`).join('')}</nav>
<div class="work" id="texWork"><section class="board" id="texBoard"></section><aside class="side" id="texSide"></aside></div>
<div class="tex-pack" id="texPack" hidden></div>
<div class="tex-files"><div class="view-head"><strong>${esc(T('files'))}</strong><span id="texFileCount"></span><button type="button" class="mini-button" data-action="pick">${esc(text('add'))}</button><button type="button" class="link" data-action="tex-clear">${esc(text('removeAll'))}</button></div><div class="file-list" id="texFiles"></div></div></div>`;
 }
 function renderFileStrip(){
  const host=q('#texFiles');if(!host)return;
  host.innerHTML=state.files.map(f=>{
   const problems=f.width?[!isPowerOfTwo(f.width)||!isPowerOfTwo(f.height)?'NPOT':'',f.alpha?.used&&GRAY_ROLES.includes(f.role)?'A':''].filter(Boolean).join(' '):'';
   return `<div class="file ${String(f.id)===String(state.active)?'is-current':''}" data-index="${f.id}">
<button type="button" class="file-main" data-action="tex-select" data-id="${f.id}"><img src="${f.thumb}" alt="" loading="lazy"><span><b>${esc(f.name)}</b><small>${f.width?`${f.width}×${f.height} · ${esc(roleLabel(f.role))}${f.exact?'':' · '+esc(T('notExact'))}`:esc(T('reading'))}</small></span>${problems?`<em class="pill">${esc(problems)}</em>`:''}</button>
<label class="tex-role"><span class="sr-only">${esc(T('assignRole',{name:f.name}))}</span><select data-action="tex-role" data-id="${f.id}" aria-label="${esc(T('assignRole',{name:f.name}))}">${ROLES.map(r=>`<option value="${r}" ${f.role===r?'selected':''}>${esc(roleLabel(r))}</option>`).join('')}</select></label>
<button type="button" class="icon" data-action="tex-remove" data-id="${f.id}" title="${esc(text('remove'))}" aria-label="${esc(text('remove'))}">×</button></div>`;
  }).join('');
  const count=q('#texFileCount');if(count)count.textContent=text('files',{n:state.files.length});
 }
 function renderStages(){
  for(const button of el.querySelectorAll('[data-action="tex-stage"]'))button.setAttribute('aria-selected',String(button.dataset.stage===state.stage));
 }
 function renderBoard(){
  const host=q('#texBoard');if(!host)return;
  const module=STAGE_MODULES[state.stage];
  host.innerHTML=module?module.board(ctx):state.stage==='export'?exportBoard():inspectBoard();
  module?.mounted?.(ctx);
 }
 function renderSide(){
  const host=q('#texSide');if(!host)return;
  const module=STAGE_MODULES[state.stage];
  host.innerHTML=module?module.side(ctx):state.stage==='export'?exportSide():inspectSide();
  module?.sideMounted?.(ctx);
  syncBusy();
 }
 /** The Pack stage is the standalone packer page (src/task/mask-packer.js), mounted once into a
  * container this Lab keeps alive and moves in and out of the DOM. Reusing the module means the
  * packer has one implementation, one set of engine presets (src/game/texture-presets.js) and one
  * set of tests; the Lab only hands it the files that are already open. */
 let packer=null,packHost=null,packedIds=new Set();
 async function showPack(){
  const host=q('#texPack');if(!host)return;
  if(!packHost){
   packHost=document.createElement('div');
   const module=await import('./mask-packer.js');
   packer=module.mount({el:packHost,def});
  }
  if(packHost.parentElement!==host)host.append(packHost);
  // Up to four maps, greyscale roles first: the packer takes four inputs at most.
  const order=['ao','roughness','smoothness','metallic','height','opacity'];
  const candidates=[...state.files].sort((a,b)=>(order.indexOf(a.role)+1||99)-(order.indexOf(b.role)+1||99));
  const fresh=candidates.filter(f=>!packedIds.has(f.id)).slice(0,4);
  if(fresh.length){for(const f of fresh)packedIds.add(f.id);await packer.add(fresh.map(f=>f.file));}
 }
 function render(){
  if(!state.files.length){empty();return;}
  if(!el.querySelector('.tex-lab'))frame();
  renderStages();
  const pack=state.stage==='pack',work=q('#texWork'),host=q('#texPack');
  if(work)work.hidden=pack;
  if(host)host.hidden=!pack;
  if(pack){
   // The packer renders its own #taskDownload; the hidden board and side must not keep a second one.
   for(const id of ['#texBoard','#texSide']){const node=q(id);if(node)node.innerHTML='';}
   showPack().catch(error=>toast(error?.message||String(error),{error:true}));
  }else{
   // Detached, not destroyed: the packer keeps its files and its mapping for the next visit,
   // and the page keeps exactly one primary action.
   packHost?.remove();
   renderBoard();renderSide();
  }
  renderFileStrip();
 }
 // ---- Inspect ------------------------------------------------------------------------------
 function inspectBoard(){
  const result=validation(),levels={error:0,warn:1,info:2};
  const sorted=[...result.issues].sort((a,b)=>levels[a.level]-levels[b.level]);
  const spec=WORKFLOWS[state.workflow];
  const slot=role=>{
   const found=state.files.filter(f=>f.role===role);
   return `<li class="tex-slot ${found.length?'has':spec.required.includes(role)?'missing':'optional'}"><b>${esc(roleLabel(role))}</b><span>${found.length?esc(found.map(f=>f.name).join(', ')):esc(spec.required.includes(role)?T('required'):T('notProvided'))}</span><em>${esc(T('space.'+colorSpaceOf(role)))}</em></li>`;
  };
  const roles=[...new Set([...spec.required,...spec.recommended,...spec.optional])];
  return `<div class="view-head"><strong>${esc(T('setTitle'))}</strong><span>${esc(T('workflow.'+state.workflow))}</span></div>
<ul class="tex-slots">${roles.map(slot).join('')}</ul>
<div class="view-head"><strong>${esc(T('issues'))}</strong><span>${esc(T('issueCount',{n:result.issues.length}))}</span></div>
${sorted.length?`<ul class="tex-issues">${sorted.map(i=>`<li class="lvl-${i.level}"><em>${esc(T('level.'+i.level))}</em><span>${esc(issueText(i))}</span></li>`).join('')}</ul>`:`<p class="viewer-note">${esc(T('noIssues'))}</p>`}
<div class="view-head"><strong>${esc(T('colorSpace'))}</strong></div><p class="viewer-note">${esc(T('colorSpaceNote'))}</p>
<table class="tex-table"><thead><tr><th>${esc(T('file'))}</th><th>${esc(T('roleCol'))}</th><th>${esc(T('size'))}</th><th>${esc(T('alphaCol'))}</th><th>${esc(T('spaceCol'))}</th></tr></thead><tbody>${state.files.map(f=>`<tr><td>${esc(f.name)}</td><td>${esc(roleLabel(f.role))}</td><td>${f.width?`${f.width}×${f.height}`:'—'}</td><td>${f.alpha?esc(f.alpha.used?T('alphaUsed',{n:f.alpha.zeroPixels}):T('alphaNone')):'—'}</td><td>${esc(T('space.'+colorSpaceOf(f.role)))}</td></tr>`).join('')}</tbody></table>`;
 }
 function inspectSide(){
  const result=validation(),errors=result.issues.filter(i=>i.level==='error').length,warns=result.issues.filter(i=>i.level==='warn').length;
  return `<div class="summary ${errors?'bad':''}" id="texSummary" role="status" aria-live="polite"><div class="summary-big">${errors?errors:warns?warns:'✓'}</div><div class="summary-line">${esc(errors?T('errorCount',{n:errors}):warns?T('warnCount',{n:warns}):T('setOk'))}</div></div>
<form class="options" id="texOptions" autocomplete="off"><label class="field"><span>${esc(T('workflowLabel'))}</span><select data-option="workflow" id="texWorkflow">${WORKFLOW_IDS.map(id=>`<option value="${id}" ${state.workflow===id?'selected':''}>${esc(T('workflow.'+id))}</option>`).join('')}</select></label>
<p class="hint">${esc(T('workflowHint.'+state.workflow))}</p>
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary><label class="check"><input type="checkbox" data-option="square" ${state.requireSquare?'checked':''}> ${esc(T('requireSquare'))}</label>
<p class="hint">${esc(T('exactHint'))}</p></details></form>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(text('add'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="tex-report">${esc(T('saveReport'))}</button>
<nav class="next" id="texNext"><span>${esc(T('nextStage'))}</span><button type="button" class="chip" data-action="tex-stage" data-stage="fix">${esc(T('stage.fix'))}</button><button type="button" class="chip" data-action="tex-stage" data-stage="preview">${esc(T('stage.preview'))}</button><button type="button" class="chip" data-action="tex-stage" data-stage="channels">${esc(T('stage.channels'))}</button></nav><small class="local-note">${esc(text('local'))}</small>`;
 }
 /** The report is generic JSON in the Game Labs envelope: measurements and issue ids, never a
  * fake engine asset. `engineTarget` follows the chosen workflow. */
 function report(){
  const result=validation();
  return {meta:{tool:'nerulio-texture-lab',toolVersion:TOOL_VERSION,schemaVersion:SCHEMA_VERSION,engineTarget:ENGINE_TARGET[state.workflow]||'generic',workflow:state.workflow,generated:new Date().toISOString().slice(0,10)},
   textures:state.files.filter(f=>f.width).map(f=>({name:f.name,role:f.role,setName:f.setName,width:f.width,height:f.height,powerOfTwo:isPowerOfTwo(f.width)&&isPowerOfTwo(f.height),
    exactChannels:!!f.exact,pngColorType:f.colorType,bitDepth:f.depth,srgbChunkPresent:!!f.srgbChunk,colorSpaceGuidance:colorSpaceOf(f.role),
    alpha:f.alpha&&{used:f.alpha.used,min:f.alpha.min,max:f.alpha.max,zeroPixels:f.alpha.zeroPixels,rgbUnderZeroAlpha:f.alpha.rgbUnderZeroAlpha},
    color:f.color&&{grayscale:f.color.grayscale,maxChannelSpread:f.color.maxSpread},
    normalCheck:f.normal&&{meanLength:Number(f.normal.meanLength.toFixed(4)),unitLength:f.normal.unitLength,blueNonNegative:f.normal.blueNonNegative,looksLikeNormalMap:f.normal.looksLikeNormalMap}})),
   issues:result.issues.map(i=>({id:i.id,level:i.level,...i,message:issueText(i)})),
   notes:[T('reportNote'),T('colorSpaceNote')]};
 }
 const ENGINE_TARGET={'unity-hdrp-mask':'unity-2022','unity-urp-metallic':'unity-2022','unreal-orm':'unreal-5','godot-orm':'godot-4','metallic-roughness':'generic'};
 // ---- Export -------------------------------------------------------------------------------
 function exportBoard(){
  const batch=state.batch;
  return `<div class="view-head"><strong>${esc(T('batchTitle'))}</strong><span>${esc(T('batchHint'))}</span></div>
<ol class="tex-pipeline">${['resize','format','bleed'].map((step,i)=>`<li><b>${i+1}</b><span>${esc(T('step.'+step))}</span><em>${esc(fix.stepSummary(step,state.fixOptions,T))}</em></li>`).join('')}</ol>
<div class="view-head"><strong>${esc(T('batchResults'))}</strong><span id="texBatchState">${esc(batch?batch.label:T('batchIdle'))}</span></div>
<div class="file-list" id="texBatchList">${(batch?.items||[]).map(item=>`<div class="file"><span class="file-main static"><span><b>${esc(item.name)}</b><small>${esc(item.note||'')}</small></span><em class="pill ${item.status==='done'?'good':item.status==='error'?'bad':''}">${esc(item.status==='done'?bytes(item.size):item.status==='error'?text('failed'):item.status==='working'?text('working'):text('waiting'))}</em></span></div>`).join('')}</div>
<p class="viewer-note">${esc(T('batchNote'))}</p>`;
 }
 function exportSide(){
  const done=state.batch?.items?.filter(i=>i.status==='done').length||0;
  return `<div class="summary" role="status" aria-live="polite"><div class="summary-big">${state.files.length}</div><div class="summary-line">${esc(T('exportSummary',{done}))}</div></div>
<form class="options" id="texOptions" autocomplete="off">${fix.pipelineFields(state.fixOptions,T,esc)}</form>
<div class="list-actions"><button type="button" class="dashed" data-action="tex-report">${esc(T('saveReport'))}</button>${state.batch?.running?`<button type="button" class="link" data-action="tex-cancel">${esc(text('cancel'))}</button>`:''}</div>
<button type="button" class="primary big" id="taskDownload" data-action="tex-batch">${esc(T('runBatch',{n:state.files.length}))}</button>
<nav class="next">${(def.next||[]).length?`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="tex-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`:''}</nav><small class="local-note">${esc(text('local'))}</small>`;
 }
 async function runBatch(){
  const items=state.files.map(f=>({id:f.id,name:f.name,status:'waiting',note:'',size:0}));
  const controller=new AbortController();
  state.batch={items,running:true,label:T('batchRunning'),controller};
  renderBoard();renderSide();
  const outputs=[];
  try{
   for(const item of items){
    if(controller.signal.aborted)break;
    item.status='working';renderBoard();
    const entry=entryOf(item.id);
    try{
     const result=await fix.optimise(entry,state.fixOptions,{...ctx,signal:controller.signal});
     item.status='done';item.size=result.blob.size;item.note=result.note;outputs.push({name:result.name,blob:result.blob});
    }catch(error){
     if(error?.name==='AbortError')throw error;
     item.status='error';item.note=error?.message||String(error);
    }
    renderBoard();
   }
   if(!outputs.length)throw Error(T('batchEmpty'));
   state.batch.label=T('batchZipping');renderBoard();
   const archive=outputs.length>1?await zip(outputs):null;
   ctx.download(archive||outputs[0].blob,archive?`nerulio-textures.zip`:outputs[0].name);
   state.batch.label=T('batchDone',{n:outputs.length});track('tool_success',{intent:route.id});
  }catch(error){
   state.batch.label=error?.name==='AbortError'?T('batchCancelled'):error?.message||String(error);
   if(error?.name!=='AbortError')throw error;
  }finally{state.batch.running=false;renderBoard();renderSide();}
 }
 // ---- intake -------------------------------------------------------------------------------
 async function add(files){
  if(state.busy)return;
  // One Free-plan job per set of files that is added, like the batch workspace. Only the legacy
  // texture-map id is metered at all; the Lab's own routes are quota class 'none'.
  if(!await authorize(route.id,{}))return;
  const first=!state.files.length;
  await run(async()=>{
   for(const file of files){
    const found=classifyTextureName(file.name);
    const entry={id:++state.seq,file,name:file.name,role:found.role,setName:found.setName,confidence:found.confidence,thumb:objectURL(file)};
    state.files.push(entry);
    if(first&&state.files.length===1){frame();}
    renderFileStrip();
    try{await measure(entry);}
    catch(error){entry.error=error?.message||String(error);toast(`${entry.name}: ${entry.error}`,{error:true});state.files=state.files.filter(f=>f!==entry);forget(entry.thumb);}
    if(!state.active)state.active=entry.id;
    render();
   }
   track('tool_run',{intent:route.id});
  });
  if(!state.files.length)empty();
 }
 /** A map made inside the Lab (a generated normal) joins the set like a dropped file, with its
  * role already known and marked as generated, so the Preview and Export see it at once. */
 async function addGenerated(file,role){
  const replaced=state.files.find(f=>f.generated&&f.name===file.name);
  if(replaced){forget(replaced.thumb);state.files=state.files.filter(f=>f!==replaced);}
  const entry={id:++state.seq,file,name:file.name,role,setName:classifyTextureName(file.name).setName,confidence:'high',thumb:objectURL(file),manualRole:true,generated:true};
  state.files.push(entry);
  await measure(entry);
  renderFileStrip();
 }
 function clear(){
  for(const f of state.files)forget(f.thumb);
  samples.clear();
  for(const module of Object.values(STAGE_MODULES))module?.dispose?.(ctx);
  packHost?.remove();packHost=null;packer=null;packedIds=new Set();
  state.files=[];state.active=null;state.batch=null;empty();
 }
 /** A small four-map set built in the page, so the Lab can be tried without a texture at hand. */
 async function sample(){
  const n=128,out=[];
  const make=async(name,fn)=>{
   const canvas=Im.canvas(n,n),data=new Uint8ClampedArray(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++)data.set(fn(x,y),(y*n+x)*4);
   canvas.getContext('2d').putImageData(new ImageData(data,n,n),0,0);
   out.push(new File([await Im.blobOf(canvas)],name,{type:'image/png'}));Im.release(canvas);
  };
  const brick=(x,y)=>{const row=Math.floor(y/16),offset=row%2?8:0,bx=(x+offset)%32,by=y%16;return {mortar:bx<3||by<2,bx,by};};
  await make('demo_basecolor.png',(x,y)=>{const b=brick(x,y);return b.mortar?[178,172,160,255]:[150+((x*7+y*13)%18),70+((x*3)%14),56,255];});
  await make('demo_height.png',(x,y)=>{const b=brick(x,y),v=b.mortar?40:150+((x*5+y*3)%40);return [v,v,v,255];});
  await make('demo_roughness.png',(x,y)=>{const b=brick(x,y),v=b.mortar?210:120+((x*11+y*5)%30);return [v,v,v,255];});
  await make('demo_ao.png',(x,y)=>{const b=brick(x,y),v=b.mortar?150:235;return [v,v,v,255];});
  return out;
 }
 // ---- events -------------------------------------------------------------------------------
 el.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='tex-sample'){add(await sample());return;}
  if(action==='tex-stage'){
   const next=button.dataset.stage;if(!STAGES.includes(next)||next===state.stage)return;
   STAGE_MODULES[state.stage]?.leave?.(ctx);state.stage=next;render();track('tool_option_change',{intent:route.id});return;
  }
  if(action==='tex-select'){state.active=button.dataset.id;render();return;}
  if(action==='tex-remove'){
   const entry=entryOf(button.dataset.id);if(!entry)return;
   forget(entry.thumb);state.files=state.files.filter(f=>f!==entry);
   for(const key of [...samples.keys()])if(key.startsWith(entry.id+':'))samples.delete(key);
   if(String(state.active)===String(entry.id))state.active=state.files[0]?.id||null;
   if(!state.files.length){clear();return;}
   render();return;
  }
  if(action==='tex-clear'){clear();return;}
  if(action==='tex-report'){
   const json=JSON.stringify(report(),null,2);
   ctx.download(new Blob([json],{type:'application/json'}),'texture-report.json');toast(T('reportSaved'));return;
  }
  if(action==='tex-batch'){run(runBatch);return;}
  if(action==='tex-cancel'){state.batch?.controller?.abort();return;}
  if(action==='tex-next'){continueWith(button.dataset.tool,state.files.map(f=>f.file));return;}
  const module=STAGE_MODULES[state.stage];
  if(module?.click)await module.click(action,button,ctx);
 });
 el.addEventListener('change',event=>{
  const select=event.target.closest('[data-action="tex-role"]');
  if(select){
   const entry=entryOf(select.dataset.id);if(!entry)return;
   entry.role=select.value;entry.manualRole=true;render();return;
  }
  if(event.target.dataset.option==='workflow'){state.workflow=WORKFLOW_IDS.includes(event.target.value)?event.target.value:'metallic-roughness';render();return;}
  if(event.target.dataset.option==='square'){state.requireSquare=event.target.checked;render();return;}
  const module=STAGE_MODULES[state.stage];module?.input?.(event.target,ctx);
 });
 el.addEventListener('input',event=>{
  if(event.target.dataset.option)return;// selects and checkboxes are handled on change
  const module=STAGE_MODULES[state.stage];module?.input?.(event.target,ctx);
 });
 el.addEventListener('submit',event=>event.preventDefault());
 el.addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&event.target.matches('.dropzone')){event.preventDefault();event.target.click();}
  const module=STAGE_MODULES[state.stage];module?.keydown?.(event,ctx);
 });
 onLocale(()=>{if(!state.files.length){empty();return;}frame();render();});
 // Work lives only in this tab: leaving it with textures loaded asks first.
 addEventListener('beforeunload',e=>{if(el.isConnected&&state.files.length){e.preventDefault();e.returnValue='';}});
 empty();
 return {add};
}
export {WORKFLOWS,PRESET_IDS,ENGINE_PRESETS,presetChannels,presetSummary};
