import {bytes,stem,zip} from '../core.js';
import {BRAND} from '../brand.js';
import {INTENTS} from '../intents.js';
import {t} from '../i18n.js';
import {text,toast,download,authorize,track,onLocale,continueWith,toolURL,page,keyLabel,canPasteButton} from './shell.js';
import {sizeDelta,copyable,batchProgress} from './keys.js';
/** Workspace for "many files in → the same transform → many files out" tools (compress,
 * convert, resize…). Files process automatically as they arrive, one at a time to bound
 * memory; changing an option re-runs the batch without asking for the files again.
 *
 * A tool supplies:  options(query) → object · simple(o) / advanced(o) → HTML · read(form,o)
 *   process(file,o,{signal,progress}) → {blob,name,width,height,note?,warn?} · summary?(items)
 *   viewerActions?(item) → HTML · action?(name,item,{reprocess}) · contents?(item) → files of a bundle
 */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** The shell's shortcuts, printed where they apply (hidden on touch-only devices by task.css). */
const keysHint=names=>`<small class="keys-hint" role="note" aria-label="${esc(text('keys.label'))}">${names.map(n=>`<span><kbd>${esc(keyLabel(n))}</kbd>${esc(text('keys.'+n))}</span>`).join('')}</small>`;
/** Clipboards take PNG: another format is re-encoded to PNG for the copy only (the download keeps its own format). */
async function pngOf(blob){
 if(blob.type==='image/png')return blob;
 const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close?.();
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('png')),'image/png'));
}
const canCopy=()=>typeof ClipboardItem!=='undefined'&&!!navigator.clipboard?.write;
export function createBatch({el,def},tool){
 const items=[];let current=0,generation=0,controller=null,running=false,options=tool.options(new URLSearchParams(page.query)),seq=0,debounce=0,optionsDirty=false;
 const done=()=>items.filter(i=>i.status==='done');
 // A tool may publish a first-pass result (ctx.interim) while it keeps working on a better one:
 // that result is already viewable and downloadable.
 const usable=i=>!!i&&!optionsDirty&&(i.status==='done'||(i.status==='working'&&i.interim)),ready=()=>items.filter(usable);
 const pct=(a,b)=>a>0?Math.round((1-b/a)*100):0;
 function empty(){
  clearTimeout(debounce);debounce=0;optionsDirty=false;
  // Rebuilding the workspace must not strand keyboard focus on <body>: it goes to the picker button.
  const hadFocus=el.contains(document.activeElement);
  el.innerHTML=`<div class="dropzone" data-action="pick"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(text('taskDrop',{kind:def.kinds.map(k=>text('kinds.'+k)).join(' · ')}))}</strong><span>${esc(text('multi'))} · ${esc(text('paste'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button>${def.kinds.includes('image')&&canPasteButton()?`<button type="button" class="ghost" data-action="paste-clipboard">${esc(text('clipboard.paste'))}</button>`:''}${tool.sample?`<button type="button" class="ghost" data-action="task-sample">${esc(text('sample'))}</button>`:''}</div><small class="local-note">${esc(text('local'))}</small>${keysHint(['open','paste'])}</div>`;
  if(hadFocus)el.querySelector('.dropzone .primary')?.focus({preventScroll:true});
 }
 function frame(){
  el.innerHTML=`<div class="work"><section class="viewer" aria-label="${esc(text('compare'))}"><div class="cmp" id="cmp"><img id="cmpBefore" alt="${esc(text('before'))}"><img id="cmpAfter" class="cmp-after" alt="${esc(text('after'))}"><div class="cmp-bar"></div><span class="cmp-tag l">${esc(text('before'))}</span><span class="cmp-tag r">${esc(text('after'))}</span><input id="cmpCut" type="range" min="0" max="100" value="50" aria-label="${esc(text('compare'))}"></div><div class="contents" id="viewerContents" hidden></div><div class="viewer-actions" id="viewerActions"></div><p class="viewer-note" id="viewerNote"></p></section>
<aside class="side is-batch"><div class="summary" id="taskSummary" role="status" aria-live="polite"></div><form id="taskOptions" class="options" autocomplete="off"><div class="options-simple" id="optionsSimple"></div><details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary><div id="optionsAdvancedBody"></div></details></form>
<div class="file-list" id="taskFiles"></div><div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(text('add'))}</button><button type="button" class="link" data-action="task-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="task-download" disabled></button><button type="button" class="ghost copy-result" id="taskCopy" data-action="task-copy" hidden>${esc(text('clipboard.copy'))}</button><nav class="next" id="taskNext"></nav><small class="local-note">${esc(text('local'))}</small>${keysHint(['save','open','paste'])}</aside></div>`;
  el.querySelector('#optionsSimple').innerHTML=tool.simple(options);el.querySelector('#optionsAdvancedBody').innerHTML=tool.advanced(options);
  if(tool.advancedOpen?.(options))el.querySelector('#optionsAdvanced').open=true;
 }
 function renderList(){
  const host=el.querySelector('#taskFiles');if(!host)return;
  // The rows are rebuilt on every progress tick; the control that had keyboard focus gets it back
  // (after a removal: the same button on the row that moved up, else the last row).
  const active=host.contains(document.activeElement)?document.activeElement:null,focused=active&&{action:active.dataset.action,index:Number(active.dataset.index)};
  host.innerHTML=items.map((it,i)=>{
   const r=it.result,complete=it.status==='done'&&!optionsDirty,custom=complete&&tool.pill?.(it),state=optionsDirty?`<em class="pill">${esc(text('calculating'))}</em>`:complete?(custom?`<em class="pill good">${esc(custom)}</em>`:`<em class="pill ${r.blob.size<it.file.size?'good':''}">${r.blob.size<it.file.size?'−'+pct(it.file.size,r.blob.size)+'%':'='}</em>`):it.status==='error'?`<em class="pill bad">${esc(text('failed'))}</em>`:`<em class="pill">${esc(it.status==='working'?(it.progress||text('working')):text('waiting'))}</em>`;
   return `<div class="file ${i===current?'is-current':''}" data-index="${i}"><button type="button" class="file-main" data-action="task-select" data-index="${i}"><img ${it.thumb||it.thumbBroken?`src="${it.thumbBroken&&it.resultURL?it.resultURL:it.thumb}"`:''} data-thumb="${i}" alt=""><span><b>${esc(it.file.name)}</b><small>${complete?esc(tool.detail?.(it)??text('compress.saved',{a:bytes(it.file.size),b:bytes(r.blob.size)})):it.status==='error'&&!optionsDirty?esc(it.error):esc(bytes(it.file.size))}</small></span>${state}</button>${usable(it)?`<button type="button" class="icon" data-action="task-save" data-index="${i}" title="${esc(text('saveOne'))}" aria-label="${esc(text('saveOne'))}">↓</button>`:''}${it.status==='error'&&!optionsDirty?`<button type="button" class="icon" data-action="task-retry" data-index="${i}" title="${esc(text('retry'))}" aria-label="${esc(text('retry'))}: ${esc(it.file.name)}">↻</button>`:''}<button type="button" class="icon" data-action="task-remove" data-index="${i}" title="${esc(text('remove'))}" aria-label="${esc(text('remove'))}">×</button></div>`;
  }).join('');
  if(focused)(host.querySelector(`[data-action="${focused.action}"][data-index="${focused.index}"]`)||host.querySelector(`.file[data-index="${Math.min(focused.index,items.length-1)}"] .file-main`))?.focus({preventScroll:true});
 }
 function renderSummary(){
  const box=el.querySelector('#taskSummary'),button=el.querySelector('#taskDownload');if(!box)return;
  const ok=ready(),a=ok.reduce((s,i)=>s+i.file.size,0),b=ok.reduce((s,i)=>s+i.result.blob.size,0),pending=optionsDirty||items.some(i=>['waiting','working'].includes(i.status)&&!usable(i));
  const custom=ok.length&&tool.summary?.(ok);
  box.innerHTML=ok.length?`<div class="summary-big">${esc(custom?.big??'−'+pct(a,b)+'%')}</div><div class="summary-line">${custom?.line?esc(custom.line)+' · ':''}${custom?.only?'':esc(bytes(a))+' → '+esc(bytes(b))+' · '}${esc(text('files',{n:ok.length}))}${pending?' · '+esc(text('calculating')):''}</div>`:`<div class="summary-big muted">…</div><div class="summary-line">${esc(text('calculating'))}</div>`;
  button.disabled=!ok.length||pending;button.textContent=ok.length>1?text('downloadAll',{n:ok.length}):text('download');
  // One finished picture can also go straight to the clipboard.
  el.querySelector('#taskCopy').hidden=!(ok.length===1&&items.length===1&&!pending&&canCopy()&&copyable(ok[0].result));
  // Several files: how far the batch is, as a bar and as words.
  const p=batchProgress(items);
  if(p.active&&!optionsDirty){box.insertAdjacentHTML('beforeend',`<div class="batch-progress"><div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.finished}" aria-label="${esc(text('doneOf',{a:p.finished,b:p.total}))}"><span></span></div><small>${esc(text('doneOf',{a:p.finished,b:p.total}))}</small></div>`);box.querySelector('.batch-progress span').style.width=p.percent+'%';}
  const next=el.querySelector('#taskNext');
  next.innerHTML=ok.length&&!pending?`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="task-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`:'';
 }
 /** A result that is a bundle (tool.contents) is shown as what is inside it — every file at its
  * true size with its own save button — instead of one enlarged preview. */
 let contentURLs=[],contentsOf=null;
 function renderContents(it,cmp){
  const host=el.querySelector('#viewerContents'),list=usable(it)&&it.status==='done'&&tool.contents?.(it)||null;
  cmp.hidden=!!list;host.hidden=!list;if(!list){if(contentsOf){contentsOf=null;host.innerHTML='';for(const u of contentURLs)URL.revokeObjectURL(u);contentURLs=[];}return;}
  if(contentsOf===it.result)return;contentsOf=it.result;for(const u of contentURLs)URL.revokeObjectURL(u);contentURLs=[];
  host.innerHTML=list.map((e,i)=>{const image=/^image\//.test(e.blob.type)&&!/icon$/.test(e.blob.type),url=image?URL.createObjectURL(e.blob):'';if(url)contentURLs.push(url);const slash=e.name.lastIndexOf('/');
   return `<figure class="content"><div class="content-thumb ${image?'':'is-file'} ${tool.pixelated?'px':''}">${image?`<img src="${url}" alt="" loading="lazy">`:`<span class="content-ext">${esc((e.name.split('.').pop()||'').toUpperCase())}</span>`}</div><figcaption><strong title="${esc(e.name)}">${slash>0?`<small>${esc(e.name.slice(0,slash+1))}</small>`:''}${esc(e.name.slice(slash+1))}</strong><span data-dim>${esc(bytes(e.blob.size))}</span></figcaption><button type="button" class="icon-btn" data-action="task-content" data-entry="${i}" aria-label="${esc(text('download'))}: ${esc(e.name)}">↓</button></figure>`;}).join('');
  for(const img of host.querySelectorAll('img'))img.addEventListener('load',()=>{const d=img.closest('.content').querySelector('[data-dim]');d.textContent=`${img.naturalWidth}×${img.naturalHeight} · ${d.textContent}`;},{once:true});
 }
 function renderNote(it){el.querySelector('#viewerNote').textContent=usable(it)?[it.result.note,it.result.warn,it.status==='done'?'':it.progress].filter(Boolean).join(' · ')||text('compareHint'):it.status==='error'?it.error:text('working');}
 function renderViewer(){
  const it=items[current],cmp=el.querySelector('#cmp');if(!cmp||!it)return;
  const before=it.thumbBroken&&it.resultURL?it.resultURL:it.thumbFull;if(before)el.querySelector('#cmpBefore').src=before;else el.querySelector('#cmpBefore').removeAttribute('src');const after=el.querySelector('#cmpAfter');
  const shown=usable(it),compare=tool.compare!==false&&(!tool.compareWhen||!shown||tool.compareWhen(it));if(shown&&compare){after.src=it.resultURL;after.hidden=false;}else after.hidden=true;
  cmp.classList.toggle('is-pending',!shown);cmp.classList.toggle('is-upgrading',shown&&it.status!=='done');cmp.classList.toggle('no-compare',!compare);after.classList.toggle('px',!!(typeof tool.pixelated==='function'?tool.pixelated(it):tool.pixelated));
  // Each side of the divider says what it is and how heavy it is; the result adds the change against the source.
  const delta=shown&&compare?sizeDelta(it.file.size,it.result.blob.size):'';
  cmp.querySelector('.cmp-tag.l').textContent=`${text('before')} · ${bytes(it.file.size)}`;
  cmp.querySelector('.cmp-tag.r').textContent=shown&&compare?`${text('after')} · ${bytes(it.result.blob.size)}${delta&&delta!=='='?' · '+delta:''}`:text('after');
  if(!compare&&shown&&(it.result.preview||it.result.showResult))el.querySelector('#cmpBefore').src=it.result.preview||it.resultURL;
  el.querySelector('#viewerActions').innerHTML=usable(it)&&it.status==='done'&&tool.viewerActions?tool.viewerActions(it):'';
  if(it.width)cmp.style.aspectRatio=`${it.width} / ${it.height}`;
  renderContents(it,cmp);
  renderNote(it);
 }
 const render=()=>{renderList();renderSummary();renderViewer();};
 async function run(){
  if(running)return;running=true;
  try{
   for(;;){
    const gen=generation,it=items.find(i=>i.status==='waiting');if(!it)break;
    it.status='working';it.interim=false;it.progress='';render();controller=new AbortController();
    try{
     const accept=result=>{if(it.resultURL)URL.revokeObjectURL(it.resultURL);result.blob??=result.entries[0].blob;result.name??=result.entries[0].name;it.result=result;it.resultURL=URL.createObjectURL(result.blob);it.width=result.sourceWidth||it.width;it.height=result.sourceHeight||it.height;};
     const result=await tool.process(it.file,options,{signal:controller.signal,progress:p=>{it.progress=p;renderList();if(it.interim&&items[current]===it)renderNote(it);},interim:r=>{if(gen!==generation||!items.includes(it))return;accept(r);it.interim=true;render();}});
     if(gen!==generation||!items.includes(it)){if(items.includes(it))it.status='waiting';continue;}
     accept(result);it.interim=false;it.status='done';
    }catch(error){
     if(error?.name==='AbortError'||gen!==generation){if(items.includes(it))it.status='waiting';continue;}
     it.status='error';it.error=error?.message||String(error);track('tool_error',{intent:page.id,error_code:'processing_failed'});
    }
    render();
   }
   if(items.length&&items.every(i=>i.status!=='waiting'&&i.status!=='working')&&done().length)track('tool_success',{intent:page.id});
  }finally{running=false;controller=null;}
 }
 function reprocess(){generation++;controller?.abort();for(const it of items){it.status='waiting';it.interim=false;}render();run();}
 async function add(files){
  sync();
  // One Free-plan job per batch that is added; option changes re-run without charging again.
  if(!await authorize(page.id,options))return;
  const first=!items.length,hadFocus=first&&el.contains(document.activeElement);
  if(first)frame();
  for(const file of files){const url=tool.thumb?'':URL.createObjectURL(file),it={id:++seq,file,status:'waiting',thumb:url,thumbFull:url};items.push(it);
   if(tool.thumb)tool.thumb(file).then(u=>{if(!items.includes(it)){URL.revokeObjectURL(u);return;}it.thumb=it.thumbFull=u;render();}).catch(()=>{});}
  track('tool_run',{intent:page.id});render();
  // The drop zone (and its focused button) is gone: continue from the first file row.
  if(hadFocus)el.querySelector('.file-main')?.focus({preventScroll:true});
  run();
 }
 function remove(index){
  const changed=sync(false);
  const [it]=items.splice(index,1);if(!it)return;
  if(it.status==='working'){generation++;controller?.abort();}
  URL.revokeObjectURL(it.thumb);if(it.resultURL)URL.revokeObjectURL(it.resultURL);
  current=Math.min(current,Math.max(0,items.length-1));if(!items.length){empty();return;}
  if(changed)reprocess();else{render();run();}
 }
 async function save(){
  const ok=ready();if(!ok.length)return;
  if(ok.some(i=>i.result.entries?.length>1)){toast(text('zipping'));const many=ok.length>1;
   return download(await zip(ok.flatMap(i=>(i.result.entries||[{name:i.result.name,blob:i.result.blob}]).map(e=>({name:many?`${stem(i.file.name)}/${e.name}`:e.name,blob:e.blob}))),{paths:many}),`${many?BRAND.name.toLowerCase()+'-'+page.id:stem(ok[0].file.name)}.zip`);}
  if(ok.length===1)return download(ok[0].result.blob,ok[0].result.name);
  toast(text('zipping'));
  const used=new Set(),entries=ok.map(i=>{let name=i.result.name,n=1;while(used.has(name))name=`${stem(i.result.name)}-${++n}${i.result.name.slice(stem(i.result.name).length)}`;used.add(name);return {name,blob:i.result.blob};});
  download(await zip(entries),`${BRAND.name.toLowerCase()}-${page.id}.zip`);
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,i=Number(b.dataset.index);
  if(a==='task-select'){current=i;render();}
  else if(a==='task-remove')remove(i);
  // A failed file (a model that did not download, a decoder that ran out of memory) can be run again in place.
  else if(a==='task-retry'){const it=items[i];if(it?.status==='error'){it.status='waiting';it.error='';it.progress='';render();run();}}
  else if(a==='task-save'){const it=items[i];if(it&&usable(it)){if(it.result?.entries?.length>1)download(await zip(it.result.entries),`${stem(it.file.name)}.zip`);else if(it.result)download(it.result.blob,it.result.name);}}
  else if(a==='task-content'){if(usable(items[current])){const e=tool.contents?.(items[current])?.[Number(b.dataset.entry)];if(e)download(e.blob,e.name.split('/').pop());}}
  else if(a==='task-clear'){sync(false);generation++;controller?.abort();for(const it of items.splice(0)){URL.revokeObjectURL(it.thumb);if(it.resultURL)URL.revokeObjectURL(it.resultURL);}current=0;empty();}
  else if(a==='task-download')save();
  else if(a==='task-copy'){const it=ready()[0];if(!it||!copyable(it.result)||!canCopy())return;
   // The ClipboardItem is created inside the click, with the PNG as a promise (Safari requires this order).
   try{await navigator.clipboard.write([new ClipboardItem({'image/png':pngOf(it.result.blob)})]);toast(text('clipboard.done'));}catch{toast(text('clipboard.failed'),{error:true});}}
  else if(a==='task-sample')add([await tool.sample()]);
  else if(a==='task-next'){const ok=ready();if(ok.length)continueWith(b.dataset.tool,ok.flatMap(it=>(it.result.entries||[it.result]).map(e=>new File([e.blob],e.name,{type:e.blob.type}))));}
  else if(a==='task-option'){for(const s of b.parentElement.querySelectorAll('[data-action="task-option"]'))s.setAttribute('aria-pressed',String(s===b));sync();}
  // Tool-specific buttons (tool.viewerActions) act on the file being viewed and may ask for it to be redone.
  else tool.action?.(a,items[current],{reprocess:it=>{if(!items.includes(it)||it.status==='working')return;it.status='waiting';it.interim=false;render();run();}});
 });
 function sync(runAgain=true){
  clearTimeout(debounce);debounce=0;const wasDirty=optionsDirty;optionsDirty=false;
  const form=el.querySelector('#taskOptions');if(!form)return false;
  const next=tool.read(form,options);if(JSON.stringify(next)===JSON.stringify(options)){if(wasDirty)render();return false;}
  options=next;tool.reflect?.(form,options);if(items.length&&runAgain)reprocess();
  return true;
 }
 el.addEventListener('input',e=>{
  if(e.target.id==='cmpCut'){el.querySelector('#cmp').style.setProperty('--cut',e.target.value+'%');return;}
  if(e.target.closest('#taskOptions')){
   // The old output stops being usable immediately, while expensive work stays debounced.
   if(!optionsDirty){optionsDirty=true;render();}
   clearTimeout(debounce);debounce=setTimeout(sync,350);
  }
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('error',e=>{const i=e.target?.dataset?.thumb;if(i!==undefined&&items[i]?.thumb&&!tool.thumb&&!items[i].thumbBroken){items[i].thumbBroken=true;render();}},true);
 onLocale(()=>{sync();if(!items.length){empty();return;}const open=el.querySelector('#optionsAdvanced')?.open;frame();if(open)el.querySelector('#optionsAdvanced').open=true;render();});
 empty();
 return {add,get items(){return items;},editorURL:()=>toolURL(INTENTS[page.id]?.editor==='image'?'image':page.id)};
}
