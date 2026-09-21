import {PDFWorkspace} from '../pdf.js';
import {blobOf,release,decode} from '../image.js';
import {bytes,stem,zip} from '../core.js';
import {BRAND} from '../brand.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** PDF page organiser behind Merge PDF and Split PDF: every page of every file as a
 * thumbnail you can drag, rotate, duplicate or delete; images may be mixed in as pages.
 * Native page objects are copied (text, vectors and search stay intact) — see src/pdf.js. */
export const accept='application/pdf,.pdf,image/*,.heic,.heif';
const PAGE={a4:[595.28,841.89],letter:[612,792]};
/** One image → one PDF page. JPEG-like inputs stay JPEG (small), PNG keeps its sharp edges and
 * transparency. decode() applies the camera orientation, which raw JPEG embedding would lose. */
async function imagePage(file,o){
 const L=await import('../../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js'),c=await decode(file);
 try{
  const png=file.type==='image/png',bytes=await (await blobOf(c,png?'image/png':'image/jpeg',.92)).arrayBuffer(),doc=await L.PDFDocument.create(),img=png?await doc.embedPng(bytes):await doc.embedJpg(bytes);
  let [pw,ph]=o.pageSize==='fit'?[c.width*.75+o.margin*2,c.height*.75+o.margin*2]:PAGE[o.pageSize];if(o.pageSize!=='fit'&&c.width>c.height)[pw,ph]=[ph,pw];
  const k=Math.min((pw-o.margin*2)/c.width,(ph-o.margin*2)/c.height),w=c.width*k,h=c.height*k;doc.addPage([pw,ph]).drawImage(img,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});
  return new File([await doc.save()],file.name,{type:'application/pdf'});
 }finally{release(c);}
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LETTER=i=>String.fromCharCode(65+i%26)+(i>=26?Math.floor(i/26):'');
export function mount({el,def}){
 const ws=new PDFWorkspace(),split=route.id==='pdf-split',images=route.id==='jpg-to-pdf',inputs=[],thumbs=new Map(),selected=new Set();
 let anchor=null,busy=false,abort=null,result=null,dragId=null,queue=[],loading=0,observer=null;
 let options={mode:split?'each':'merge',every:2,ranges:'',optimize:false,removeMetadata:false,name:'',pageSize:'a4',margin:24};
 const T=(k,v)=>text('pdf.'+k,v),pages=()=>ws.pages,indexOf=id=>pages().findIndex(p=>p.id===id);
 const sourceIndex=p=>ws.sources.filter(s=>pages().some(x=>x.source===s)).indexOf(p.source);
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T(images?'dropImages':'drop'))}</strong><span>${esc(T(images?'dropImagesHint':'dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  el.innerHTML=`<div class="work pdf-work"><section class="board"><div class="board-bar" role="toolbar" aria-label="${esc(T('tools'))}"><span class="board-count" id="pdfSelection"></span><span class="board-tools">
<button type="button" data-action="pdf-all">${esc(T('selectAll'))}</button><button type="button" data-action="pdf-left" title="${esc(T('rotateLeft'))}" aria-label="${esc(T('rotateLeft'))}">⟲</button><button type="button" data-action="pdf-right" title="${esc(T('rotateRight'))}" aria-label="${esc(T('rotateRight'))}">⟳</button><button type="button" data-action="pdf-back" title="${esc(T('moveBack'))}" aria-label="${esc(T('moveBack'))}">←</button><button type="button" data-action="pdf-forward" title="${esc(T('moveForward'))}" aria-label="${esc(T('moveForward'))}">→</button><button type="button" data-action="pdf-duplicate">${esc(T('duplicate'))}</button><button type="button" data-action="pdf-delete" class="danger">${esc(T('delete'))}</button><button type="button" data-action="pdf-undo">${esc(T('undo'))}</button></span></div>
<div class="pages" id="pdfPages" role="listbox" aria-multiselectable="true" aria-label="${esc(T('pages'))}"></div><p class="viewer-note">${esc(T('hint'))}</p></section>
<aside class="side"><div class="summary" id="pdfSummary" role="status" aria-live="polite"></div><form id="pdfOptions" class="options" autocomplete="off">${split?`<div class="segmented split-modes" role="group" id="pdfMode">${['each','every','ranges','selected','odd-even'].map(m=>`<button type="button" data-action="pdf-mode" data-mode="${m}" aria-pressed="${options.mode===m}">${esc(T('mode.'+m))}</button>`).join('')}</div><div id="pdfModeFields"></div>`:''}
${images?`<div class="segmented" role="group" id="pdfPageSize">${['a4','letter','fit'].map(v=>`<button type="button" data-action="pdf-pagesize" data-size="${v}" aria-pressed="${options.pageSize===v}">${esc(T('size.'+v))}</button>`).join('')}</div><div class="segmented" role="group" id="pdfMargin" style="margin-top:8px">${[0,24,48].map(v=>`<button type="button" data-action="pdf-margin" data-margin="${v}" aria-pressed="${options.margin===v}">${esc(T('margin.'+v))}</button>`).join('')}</div>`:''}
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary><label class="field"><span>${esc(T('fileName'))}</span><input id="pdfName" type="text" maxlength="80" value="${esc(options.name)}" placeholder="${esc(defaultName())}"></label><label class="check"><input id="pdfOptimize" type="checkbox" ${options.optimize?'checked':''}> ${esc(T('optimize'))}</label><label class="check"><input id="pdfMeta" type="checkbox" ${options.removeMetadata?'checked':''}> ${esc(T('removeMeta'))}</label></details></form>
<div class="file-list" id="pdfFiles"></div><div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('addFiles'))}</button>${split?'':`<button type="button" class="link" data-action="pdf-sort">${esc(T('sortAZ'))}</button>`}<button type="button" class="link" data-action="pdf-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="pdfRun" data-action="pdf-run"></button><div class="result-box" id="pdfResult" hidden></div><nav class="next" id="pdfNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
  observer?.disconnect();observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);want(e.target.dataset.id);}},{root:null,rootMargin:'400px'});
  modeFields();
 }
 const defaultName=()=>images?stem(ws.sources[0]?.name||'images'):`${stem(ws.sources[0]?.name||BRAND.name.toLowerCase())}-${split?'split':'merged'}`;
 function modeFields(){
  const host=el.querySelector('#pdfModeFields');if(!host)return;
  host.innerHTML=options.mode==='every'?`<label class="field"><span>${esc(T('everyLabel'))}</span><input id="pdfEvery" type="number" min="1" max="9999" value="${options.every}" inputmode="numeric"></label>`
   :options.mode==='ranges'?`<label class="field"><span>${esc(T('rangesLabel'))}</span><input id="pdfRanges" type="text" value="${esc(options.ranges)}" placeholder="1-3; 4-8; 9"><small>${esc(T('rangesHint'))}</small></label>`
   :options.mode==='selected'?`<p class="hint">${esc(T('selectedHint'))}</p>`:'';
 }
 /** 1-based page groups for the current split mode; also drives the "file 2 starts here" markers. */
 function groups(){
  const n=pages().length;if(!split||!n)return [];
  if(options.mode==='each')return pages().map((_,i)=>[i+1]);
  if(options.mode==='every'){const k=Math.max(1,options.every|0),out=[];for(let i=0;i<n;i+=k)out.push(Array.from({length:Math.min(k,n-i)},(_,j)=>i+j+1));return out;}
  if(options.mode==='odd-even')return [pages().map((_,i)=>i+1).filter(i=>i%2),pages().map((_,i)=>i+1).filter(i=>i%2===0)].filter(g=>g.length);
  if(options.mode==='selected')return [pages().map((p,i)=>selected.has(p.id)?i+1:0).filter(Boolean)].filter(g=>g.length);
  const out=[];for(const part of options.ranges.split(';').map(s=>s.trim()).filter(Boolean)){const g=[];for(const piece of part.split(',')){const m=piece.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)return null;const a=+m[1],b=+(m[2]??m[1]);if(a<1||b>n||a>b)return null;for(let i=a;i<=b;i++)g.push(i);}out.push(g);}return out;
 }
 function want(id){const p=pages().find(x=>x.id===id);if(!p||thumbs.has(key(p)))return;queue.push(p);pump();}
 const key=p=>`${p.source.id}:${p.index}`;
 async function pump(){
  while(loading<2&&queue.length){
   const p=queue.shift(),k=key(p);if(thumbs.has(k))continue;loading++;thumbs.set(k,'');
   (async()=>{let c=null;try{c=await ws.render({...p,angle:0,marks:[]},260,false);thumbs.set(k,URL.createObjectURL(await blobOf(c,'image/jpeg',.72)));for(const img of el.querySelectorAll(`img[data-key="${k}"]`))img.src=thumbs.get(k);}catch{thumbs.delete(k);}finally{release(c);loading--;pump();}})();
  }
 }
 function renderPages(){
  const host=el.querySelector('#pdfPages');if(!host)return;const g=groups(),starts=new Map();if(g&&options.mode!=='odd-even'&&options.mode!=='selected')g.forEach((grp,i)=>starts.set(grp[0],i+1));
  host.innerHTML=pages().map((p,i)=>{const k=key(p),s=sourceIndex(p);
   return `<div class="pg ${selected.has(p.id)?'is-selected':''} ${starts.has(i+1)&&starts.get(i+1)>1?'starts-part':''}" role="option" aria-selected="${selected.has(p.id)}" tabindex="0" draggable="true" data-id="${p.id}" ${starts.has(i+1)?`data-part="${esc(T('part',{n:starts.get(i+1)}))}"`:''}><div class="pg-frame"><img data-key="${k}" alt="${esc(T('pageN',{n:i+1}))}" ${thumbs.get(k)?`src="${thumbs.get(k)}"`:''} style="transform:rotate(${p.angle}deg)" draggable="false"></div><span class="pg-num">${i+1}</span><span class="pg-src s${s%6}" title="${esc(p.source.name)}">${LETTER(s)}</span><span class="pg-actions"><button type="button" data-action="pg-rotate" title="${esc(T('rotateRight'))}" aria-label="${esc(T('rotateRight'))}">⟳</button><button type="button" data-action="pg-delete" title="${esc(T('delete'))}" aria-label="${esc(T('delete'))}">×</button></span></div>`;}).join('');
  for(const card of host.children)if(!thumbs.get(card.querySelector('img').dataset.key))observer.observe(card);
 }
 function renderSide(){
  const n=pages().length,used=ws.sources.filter(s=>pages().some(p=>p.source===s)),g=groups();
  el.querySelector('#pdfSummary').innerHTML=`<div class="summary-big">${esc(T('pagesN',{n}))}</div><div class="summary-line">${esc(text('files',{n:used.length}))} · ${esc(bytes(used.reduce((s,f)=>s+f.file.size,0)))}${split&&g?` · ${esc(T('outputs',{n:g.length}))}`:''}</div>`;
  el.querySelector('#pdfFiles').innerHTML=used.map((s,i)=>`<div class="file"><span class="pg-src s${i%6} inline">${LETTER(i)}</span><span class="file-main static"><span><b>${esc(s.name)}</b><small>${esc(T('pagesN',{n:pages().filter(p=>p.source===s).length}))} · ${esc(bytes(s.file.size))}</small></span></span><button type="button" class="icon" data-action="pdf-file-remove" data-source="${s.id}" title="${esc(text('remove'))}" aria-label="${esc(text('remove'))}">×</button></div>`).join('');
  el.querySelector('#pdfSelection').textContent=selected.size?T('selectedN',{n:selected.size}):T('noneSelected');
  const run=el.querySelector('#pdfRun'),invalid=split&&(!g||!g.length);run.disabled=busy||!n||invalid;
  run.textContent=busy?T('working'):split?(invalid?T(options.mode==='selected'?'needSelection':'badRanges'):T('runSplit',{n:g.length})):T(images?'runPdf':'runMerge');
  for(const b of el.querySelectorAll('.board-tools button'))if(!['pdf-all','pdf-undo'].includes(b.dataset.action))b.disabled=!selected.size||busy;
  el.querySelector('[data-action="pdf-undo"]').disabled=!ws.history.length||busy;
 }
 const render=()=>{renderPages();renderSide();};
 function clearResult(){result=null;const box=el.querySelector('#pdfResult');if(box){box.hidden=true;el.querySelector('#pdfNext').innerHTML='';}}
 function changed(){clearResult();for(const id of [...selected])if(indexOf(id)<0)selected.delete(id);render();}
 function mutate(fn){if(busy)return;ws.snapshot();fn();changed();}
 const chosen=()=>pages().filter(p=>selected.has(p.id));
 function moveSelection(delta){
  mutate(()=>{const list=pages(),order=delta<0?list.slice():list.slice().reverse();
   for(const p of order){if(!selected.has(p.id))continue;const i=list.indexOf(p),j=i+delta;if(j<0||j>=list.length||selected.has(list[j].id))continue;[list[i],list[j]]=[list[j],list[i]];}});
 }
 function dropAt(target,after){
  mutate(()=>{const list=pages(),moving=selected.has(dragId)?list.filter(p=>selected.has(p.id)):list.filter(p=>p.id===dragId),ids=new Set(moving.map(p=>p.id));
   if(ids.has(target))return;const rest=list.filter(p=>!ids.has(p.id)),at=rest.findIndex(p=>p.id===target)+(after?1:0);rest.splice(at,0,...moving);list.splice(0,list.length,...rest);});
 }
 async function add(files){
  if(busy)return;busy=true;const first=!pages().length;if(first)frame();renderSide();
  try{inputs.push(...files);const ready=[];for(const f of files)ready.push(f.type==='application/pdf'||/.pdf$/i.test(f.name)?f:await imagePage(f,options));await ws.add(ready,p=>{const r=el.querySelector('#pdfRun');if(r)r.textContent=p;});track('tool_run',{intent:route.id});}
  catch(error){toast(error?.message||String(error),{error:true});}
  finally{busy=false;if(!pages().length){empty();}else changed();}
 }
 /** Page size / margin apply to the image pages, so those are rebuilt from the original files. */
 async function rebuild(){if(busy)return;const files=inputs.splice(0);await ws.clear();selected.clear();clearResult();await add(files);}
 async function run(){
  if(busy)return;busy=true;abort=new AbortController();renderSide();const base=(options.name.trim()||defaultName()).replace(/\.pdf$/i,''),progress=p=>{const r=el.querySelector('#pdfRun');if(r)r.textContent=p;};
  try{
   const common={optimize:options.optimize,removeMetadata:options.removeMetadata};let blob,name,count=1;
   if(!split){blob=await ws.export(common,progress,abort.signal);name=base+'.pdf';}
   else{const g=groups(),entries=[];for(let i=0;i<g.length;i++){progress(T('partProgress',{a:i+1,b:g.length}));entries.push({name:`${base}-${String(i+1).padStart(String(g.length).length,'0')}.pdf`,blob:await ws.export({...common,range:g[i].join(',')},()=>{},abort.signal)});}
    count=entries.length;if(count===1){blob=entries[0].blob;name=entries[0].name;}else{blob=await zip(entries,{signal:abort.signal});name=base+'.zip';}result={entries};}
   result={...(result||{}),blob,name,count};download(blob,name);track('tool_success',{intent:route.id});
   const box=el.querySelector('#pdfResult');box.hidden=false;box.innerHTML=`<strong>${esc(T(split?'doneSplit':images?'donePdf':'doneMerge'))}</strong><span>${esc(split?T('outputs',{n:count}):T('pagesN',{n:pages().length}))} · ${esc(bytes(blob.size))}</span><button type="button" class="ghost" data-action="pdf-again">${esc(T('again'))}</button>`;
   el.querySelector('#pdfNext').innerHTML=`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="pdf-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
  }catch(error){if(error?.name!=='AbortError'){toast(error?.message||String(error),{error:true});track('tool_error',{intent:route.id,error_code:'processing_failed'});}}
  finally{busy=false;abort=null;renderSide();}
 }
 function readOptions(){
  const q=s=>el.querySelector(s);options={...options,every:Math.max(1,Number(q('#pdfEvery')?.value)||options.every),ranges:q('#pdfRanges')?.value??options.ranges,name:q('#pdfName')?.value??options.name,optimize:!!q('#pdfOptimize')?.checked,removeMetadata:!!q('#pdfMeta')?.checked};
  clearResult();render();
 }
 el.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]'),card=e.target.closest('.pg');
  if(b){const a=b.dataset.action;
   if(a==='pg-rotate'||a==='pg-delete'){const id=card.dataset.id;mutate(()=>{const i=indexOf(id);if(a==='pg-rotate')pages()[i].angle=(pages()[i].angle+90)%360;else pages().splice(i,1);});return;}
   if(a==='pdf-all'){if(selected.size===pages().length)selected.clear();else for(const p of pages())selected.add(p.id);render();}
   else if(a==='pdf-left'||a==='pdf-right')mutate(()=>{for(const p of chosen())p.angle=(p.angle+(a==='pdf-left'?270:90))%360;});
   else if(a==='pdf-back')moveSelection(-1);else if(a==='pdf-forward')moveSelection(1);
   else if(a==='pdf-duplicate')mutate(()=>{for(const p of chosen()){const copy={...p,id:crypto.randomUUID(),marks:[]};pages().splice(indexOf(p.id)+1,0,copy);}});
   else if(a==='pdf-delete')mutate(()=>{const keep=pages().filter(p=>!selected.has(p.id));pages().splice(0,pages().length,...keep);selected.clear();});
   else if(a==='pdf-undo'){if(ws.undo())changed();}
   else if(a==='pdf-file-remove')mutate(()=>{const keep=pages().filter(p=>p.source.id!==b.dataset.source);pages().splice(0,pages().length,...keep);});
   else if(a==='pdf-sort')mutate(()=>{const order=ws.sources.slice().sort((x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true}));pages().sort((x,y)=>order.indexOf(x.source)-order.indexOf(y.source)||x.index-y.index);});
   else if(a==='pdf-clear'){inputs.length=0;ws.clear();selected.clear();for(const u of thumbs.values())if(u)URL.revokeObjectURL(u);thumbs.clear();result=null;empty();}
   else if(a==='pdf-mode'){options.mode=b.dataset.mode;for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));modeFields();clearResult();render();}
   else if(a==='pdf-pagesize'||a==='pdf-margin'){if(a==='pdf-pagesize')options.pageSize=b.dataset.size;else options.margin=Number(b.dataset.margin);for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));rebuild();}
   else if(a==='pdf-run')run();
   else if(a==='pdf-again'&&result)download(result.blob,result.name);
   else if(a==='pdf-next'&&result)continueWith(b.dataset.tool,result.entries?result.entries.map(x=>new File([x.blob],x.name,{type:'application/pdf'})):[new File([result.blob],result.name,{type:'application/pdf'})]);
   if(a.startsWith('pdf-')||a.startsWith('pg-'))return;
  }
  if(card){const id=card.dataset.id;
   if(e.shiftKey&&anchor&&indexOf(anchor)>=0){const [a,z]=[indexOf(anchor),indexOf(id)].sort((x,y)=>x-y);for(let i=a;i<=z;i++)selected.add(pages()[i].id);}
   else if(e.ctrlKey||e.metaKey||matchMedia('(pointer: coarse)').matches){selected.has(id)?selected.delete(id):selected.add(id);anchor=id;}
   else{const only=selected.size===1&&selected.has(id);selected.clear();if(!only)selected.add(id);anchor=id;}
   render();el.querySelector(`.pg[data-id="${id}"]`)?.focus();}
 });
 // On the document, not the workspace: a button that disables itself after its click drops focus to
 // <body>, and shortcuts (undo, delete) pressed next would otherwise never reach the workspace.
 document.addEventListener('keydown',e=>{
  if(!el.isConnected||e.target.closest?.('dialog'))return;
  if(e.target.matches('input,textarea,select'))return;
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  if(!pages().length)return;const card=e.target.closest?.('.pg');
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();for(const p of pages())selected.add(p.id);render();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(ws.undo())changed();}
  else if((e.key==='Delete'||e.key==='Backspace')&&selected.size){e.preventDefault();el.querySelector('[data-action="pdf-delete"]').click();}
  else if(card&&(e.key===' '||e.key==='Enter')){e.preventDefault();card.click();}
  else if(card&&e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(!selected.has(card.dataset.id)){selected.clear();selected.add(card.dataset.id);}moveSelection(e.key==='ArrowLeft'?-1:1);el.querySelector(`.pg[data-id="${card.dataset.id}"]`)?.focus();}
  else if(card&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();(e.key==='ArrowLeft'?card.previousElementSibling:card.nextElementSibling)?.focus();}
 });
 el.addEventListener('dragstart',e=>{const card=e.target.closest?.('.pg');if(!card||busy)return;dragId=card.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);card.classList.add('is-dragging');});
 el.addEventListener('dragend',()=>{dragId=null;for(const c of el.querySelectorAll('.is-dragging,.drop-before,.drop-after'))c.classList.remove('is-dragging','drop-before','drop-after');});
 el.addEventListener('dragover',e=>{if(!dragId)return;const card=e.target.closest?.('.pg');e.preventDefault();e.stopPropagation();for(const c of el.querySelectorAll('.drop-before,.drop-after'))c.classList.remove('drop-before','drop-after');if(!card||card.dataset.id===dragId)return;const r=card.getBoundingClientRect();card.classList.add(e.clientX>r.left+r.width/2?'drop-after':'drop-before');});
 el.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();const card=e.target.closest?.('.pg');if(card&&card.dataset.id!==dragId){const r=card.getBoundingClientRect();dropAt(card.dataset.id,e.clientX>r.left+r.width/2);}});
 el.addEventListener('input',e=>{if(e.target.closest('#pdfOptions'))readOptions();});
 el.addEventListener('submit',e=>e.preventDefault());
 onLocale(()=>{if(!pages().length){empty();return;}frame();render();});
 empty();
 return {add,get pages(){return pages();}};
}
