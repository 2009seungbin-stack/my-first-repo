import {bytes,stem,zip} from '../core.js';
import {BRAND} from '../brand.js';
import {INTENTS} from '../intents.js';
import {t} from '../i18n.js';
import {text,toast,download,authorize,track,onLocale,continueWith,toolURL,page} from './shell.js';
/** Workspace for "many files in → the same transform → many files out" tools (compress,
 * convert, resize…). Files process automatically as they arrive, one at a time to bound
 * memory; changing an option re-runs the batch without asking for the files again.
 *
 * A tool supplies:  options(query) → object · simple(o) / advanced(o) → HTML · read(form,o)
 *   process(file,o,{signal,progress}) → {blob,name,width,height,note?,warn?} · summary?(items)
 */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createBatch({el,def},tool){
 const items=[];let current=0,generation=0,controller=null,running=false,options=tool.options(new URLSearchParams(page.query)),seq=0,debounce=0;
 const done=()=>items.filter(i=>i.status==='done');
 const pct=(a,b)=>a>0?Math.round((1-b/a)*100):0;
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(text('taskDrop',{kind:def.kinds.map(k=>text('kinds.'+k)).join(' · ')}))}</strong><span>${esc(text('multi'))} · ${esc(text('paste'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button>${tool.sample?`<button type="button" class="ghost" data-action="task-sample">${esc(text('sample'))}</button>`:''}</div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  el.innerHTML=`<div class="work"><section class="viewer" aria-label="${esc(text('compare'))}"><div class="cmp" id="cmp"><img id="cmpBefore" alt="${esc(text('before'))}"><img id="cmpAfter" class="cmp-after" alt="${esc(text('after'))}"><div class="cmp-bar"></div><span class="cmp-tag l">${esc(text('before'))}</span><span class="cmp-tag r">${esc(text('after'))}</span><input id="cmpCut" type="range" min="0" max="100" value="50" aria-label="${esc(text('compare'))}"></div><p class="viewer-note" id="viewerNote"></p></section>
<aside class="side"><div class="summary" id="taskSummary" role="status" aria-live="polite"></div><form id="taskOptions" class="options" autocomplete="off"><div class="options-simple" id="optionsSimple"></div><details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary><div id="optionsAdvancedBody"></div></details></form>
<div class="file-list" id="taskFiles"></div><div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(text('add'))}</button><button type="button" class="link" data-action="task-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="task-download" disabled></button><nav class="next" id="taskNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
  el.querySelector('#optionsSimple').innerHTML=tool.simple(options);el.querySelector('#optionsAdvancedBody').innerHTML=tool.advanced(options);
  if(tool.advancedOpen?.(options))el.querySelector('#optionsAdvanced').open=true;
 }
 function renderList(){
  const host=el.querySelector('#taskFiles');if(!host)return;
  host.innerHTML=items.map((it,i)=>{
   const r=it.result,state=it.status==='done'?`<em class="pill ${r.blob.size<it.file.size?'good':''}">${r.blob.size<it.file.size?'−'+pct(it.file.size,r.blob.size)+'%':'='}</em>`:it.status==='error'?`<em class="pill bad">${esc(text('failed'))}</em>`:`<em class="pill">${esc(it.status==='working'?(it.progress||text('working')):text('waiting'))}</em>`;
   return `<div class="file ${i===current?'is-current':''}" data-index="${i}"><button type="button" class="file-main" data-action="task-select" data-index="${i}"><img src="${it.thumb}" alt=""><span><b>${esc(it.file.name)}</b><small>${it.status==='done'?esc(text('compress.saved',{a:bytes(it.file.size),b:bytes(r.blob.size)})):it.status==='error'?esc(it.error):esc(bytes(it.file.size))}</small></span>${state}</button>${it.status==='done'?`<button type="button" class="icon" data-action="task-save" data-index="${i}" title="${esc(text('saveOne'))}" aria-label="${esc(text('saveOne'))}">↓</button>`:''}<button type="button" class="icon" data-action="task-remove" data-index="${i}" title="${esc(text('remove'))}" aria-label="${esc(text('remove'))}">×</button></div>`;
  }).join('');
 }
 function renderSummary(){
  const box=el.querySelector('#taskSummary'),button=el.querySelector('#taskDownload');if(!box)return;
  const ok=done(),a=ok.reduce((s,i)=>s+i.file.size,0),b=ok.reduce((s,i)=>s+i.result.blob.size,0),pending=items.some(i=>['waiting','working'].includes(i.status));
  box.innerHTML=ok.length?`<div class="summary-big">−${pct(a,b)}%</div><div class="summary-line">${esc(bytes(a))} → ${esc(bytes(b))} · ${esc(text('files',{n:ok.length}))}${pending?' · '+esc(text('calculating')):''}</div>`:`<div class="summary-big muted">…</div><div class="summary-line">${esc(text('calculating'))}</div>`;
  button.disabled=!ok.length||pending;button.textContent=ok.length>1?text('downloadAll',{n:ok.length}):text('download');
  const next=el.querySelector('#taskNext');
  next.innerHTML=ok.length&&!pending?`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="task-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`:'';
 }
 function renderViewer(){
  const it=items[current],cmp=el.querySelector('#cmp');if(!cmp||!it)return;
  el.querySelector('#cmpBefore').src=it.thumbFull;const after=el.querySelector('#cmpAfter');
  if(it.status==='done'){after.src=it.resultURL;after.hidden=false;}else after.hidden=true;
  cmp.classList.toggle('is-pending',it.status!=='done');
  if(it.width)cmp.style.aspectRatio=`${it.width} / ${it.height}`;
  el.querySelector('#viewerNote').textContent=it.status==='done'?[it.result.note,it.result.warn].filter(Boolean).join(' · ')||text('compareHint'):it.status==='error'?it.error:text('working');
 }
 const render=()=>{renderList();renderSummary();renderViewer();};
 async function run(){
  if(running)return;running=true;
  try{
   for(;;){
    const gen=generation,it=items.find(i=>i.status==='waiting');if(!it)break;
    it.status='working';it.progress='';render();controller=new AbortController();
    try{
     const result=await tool.process(it.file,options,{signal:controller.signal,progress:p=>{it.progress=p;renderList();}});
     if(gen!==generation||!items.includes(it)){if(items.includes(it))it.status='waiting';continue;}
     if(it.resultURL)URL.revokeObjectURL(it.resultURL);
     it.result=result;it.resultURL=URL.createObjectURL(result.blob);it.width=result.sourceWidth||it.width;it.height=result.sourceHeight||it.height;it.status='done';
    }catch(error){
     if(error?.name==='AbortError'||gen!==generation){if(items.includes(it))it.status='waiting';continue;}
     it.status='error';it.error=error?.message||String(error);track('tool_error',{intent:page.id,error_code:'processing_failed'});
    }
    render();
   }
   if(items.length&&items.every(i=>i.status!=='waiting'&&i.status!=='working')&&done().length)track('tool_success',{intent:page.id});
  }finally{running=false;controller=null;}
 }
 function reprocess(){generation++;controller?.abort();for(const it of items)it.status='waiting';render();run();}
 async function add(files){
  // One Free-plan job per batch that is added; option changes re-run without charging again.
  if(!await authorize(page.id,options))return;
  if(!items.length)frame();
  for(const file of files){const url=URL.createObjectURL(file);items.push({id:++seq,file,status:'waiting',thumb:url,thumbFull:url});}
  track('tool_run',{intent:page.id});render();run();
 }
 function remove(index){
  const [it]=items.splice(index,1);if(!it)return;
  if(it.status==='working'){generation++;controller?.abort();}
  URL.revokeObjectURL(it.thumb);if(it.resultURL)URL.revokeObjectURL(it.resultURL);
  current=Math.min(current,Math.max(0,items.length-1));if(!items.length){empty();return;}render();run();
 }
 async function save(){
  const ok=done();if(!ok.length)return;
  if(ok.length===1)return download(ok[0].result.blob,ok[0].result.name);
  toast(text('zipping'));
  const used=new Set(),entries=ok.map(i=>{let name=i.result.name,n=1;while(used.has(name))name=`${stem(i.result.name)}-${++n}${i.result.name.slice(stem(i.result.name).length)}`;used.add(name);return {name,blob:i.result.blob};});
  download(await zip(entries),`${BRAND.name.toLowerCase()}-${page.id}.zip`);
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,i=Number(b.dataset.index);
  if(a==='task-select'){current=i;render();}
  else if(a==='task-remove')remove(i);
  else if(a==='task-save'){const it=items[i];if(it?.result)download(it.result.blob,it.result.name);}
  else if(a==='task-clear'){generation++;controller?.abort();for(const it of items.splice(0)){URL.revokeObjectURL(it.thumb);if(it.resultURL)URL.revokeObjectURL(it.resultURL);}current=0;empty();}
  else if(a==='task-download')save();
  else if(a==='task-sample')add([await tool.sample()]);
  else if(a==='task-next')continueWith(b.dataset.tool,done().map(it=>new File([it.result.blob],it.result.name,{type:it.result.blob.type})));
  else if(a==='task-option'){for(const s of b.parentElement.querySelectorAll('[data-action="task-option"]'))s.setAttribute('aria-pressed',String(s===b));sync();}
 });
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();}});
 function sync(){
  const form=el.querySelector('#taskOptions');if(!form)return;
  const next=tool.read(form,options);if(JSON.stringify(next)===JSON.stringify(options))return;
  options=next;tool.reflect?.(form,options);if(items.length)reprocess();
 }
 el.addEventListener('input',e=>{
  if(e.target.id==='cmpCut'){el.querySelector('#cmp').style.setProperty('--cut',e.target.value+'%');return;}
  if(e.target.closest('#taskOptions')){clearTimeout(debounce);debounce=setTimeout(sync,350);}
 });
 el.addEventListener('submit',e=>e.preventDefault());
 onLocale(()=>{if(!items.length){empty();return;}const open=el.querySelector('#optionsAdvanced')?.open;frame();if(open)el.querySelector('#optionsAdvanced').open=true;render();});
 empty();
 return {add,get items(){return items;},editorURL:()=>toolURL(INTENTS[page.id]?.editor==='image'?'image':page.id)};
}
