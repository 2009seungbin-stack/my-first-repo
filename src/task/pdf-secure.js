import {PDFWorkerClient} from '../pdf-rpc.js';
import {bytes,stem,zip} from '../core.js';
import {BRAND} from '../brand.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** Add or remove a PDF open password. One screen: drop the files, type the password, press the
 * button. Permissions live under Advanced. Protecting writes a revision 6 (AES-256) standard
 * security handler; unlocking needs the password the owner gave you and also drops the owner
 * restrictions, because a file with no /Encrypt dictionary has no restrictions left to enforce.
 * Both run in the PDF Worker (src/pdf-secure.js) so a large file does not freeze the page. */
export const accept='application/pdf,.pdf';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PERMS=['print','copy','modify'];
export function mount({el,def}){
 const worker=new PDFWorkerClient(),locking=route.id==='pdf-protect',T=(k,v)=>text('sec.'+k,v);
 const items=[];let busy=false,allow={print:true,copy:true,modify:false};
 const ready=()=>items.filter(i=>i.blob);
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>${locking?'🔒':'🔓'}</b></div><strong>${esc(T(locking?'drop':'dropOpen'))}</strong><span>${esc(T(locking?'dropHint':'dropOpenHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  el.innerHTML=`<div class="work"><section class="viewer sec-viewer" aria-label="${esc(T(locking?'title':'titleOpen'))}"><div class="sec-hero"><span class="sec-lock" aria-hidden="true">${locking?'🔒':'🔓'}</span><strong id="secHeadline"></strong><p id="secLead"></p></div><div class="file-list" id="secFiles"></div></section>
<aside class="side"><form id="secForm" class="options" autocomplete="off">
<label class="field"><span>${esc(T('password'))}</span><input id="secPassword" type="password" autocomplete="new-password" maxlength="127" spellcheck="false" placeholder="${esc(T('passwordPlaceholder'))}"></label>
${locking?`<label class="field"><span>${esc(T('confirm'))}</span><input id="secConfirm" type="password" autocomplete="new-password" maxlength="127" spellcheck="false"></label>`:''}
<label class="check"><input id="secShow" type="checkbox"> ${esc(T('show'))}</label>
${locking?`<details class="options-advanced" id="secAdvanced"><summary>${esc(text('advanced'))}</summary><div><p class="opt-label">${esc(T('allow'))}</p>${PERMS.map(id=>`<label class="check"><input type="checkbox" data-perm="${id}" ${allow[id]?'checked':''}> ${esc(T('allow'+id[0].toUpperCase()+id.slice(1)))}</label>`).join('')}<label class="field"><span>${esc(T('owner'))}</span><input id="secOwner" type="password" autocomplete="new-password" maxlength="127" spellcheck="false"></label><small>${esc(T('ownerHint'))}</small></div></details>`:''}
</form>
<p class="hint" id="secHint">${esc(T(locking?'keepSafe':'legal'))}</p>
<button type="button" class="primary big" id="secRun" data-action="sec-run"></button>
<button type="button" class="primary big" id="secDownload" data-action="sec-download" hidden></button>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(text('add'))}</button><button type="button" class="link" data-action="sec-clear">${esc(text('removeAll'))}</button></div>
<nav class="next" id="secNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
 }
 const state=it=>it.error?`<em class="pill bad">${esc(it.error)}</em>`:it.blob?`<em class="pill good">${esc(T(locking?'done':'doneOpen'))}</em>`:it.working?`<em class="pill">${esc(text('working'))}</em>`:it.info?.encrypted===false&&locking?`<em class="pill">${esc(T('ready'))}</em>`:`<em class="pill">${esc(text('waiting'))}</em>`;
 function detail(it){
  if(it.row)return it.row;
  if(it.note)return it.note;
  if(it.info?.encrypted)return T('detected',{h:it.info.handler});
  if(it.info&&!it.info.encrypted)return T('notProtected');
  return bytes(it.file.size);
 }
 function render(){
  const list=el.querySelector('#secFiles');if(!list)return;
  list.innerHTML=items.map((it,i)=>`<div class="file"><div class="file-main"><span class="sec-icon" aria-hidden="true">${it.blob?'✓':it.error?'!':'📄'}</span><span><b>${esc(it.file.name)}</b><small>${esc(detail(it))}</small></span>${state(it)}</div>${it.blob?`<button type="button" class="icon" data-action="sec-save" data-index="${i}" title="${esc(text('saveOne'))}" aria-label="${esc(text('saveOne'))}">↓</button>`:''}<button type="button" class="icon" data-action="sec-remove" data-index="${i}" title="${esc(text('remove'))}" aria-label="${esc(text('remove'))}">×</button></div>`).join('');
  const ok=ready(),run=el.querySelector('#secRun'),save=el.querySelector('#secDownload');
  el.querySelector('#secHeadline').textContent=ok.length?T(locking?'protectedHead':'unlockedHead',{n:ok.length}):T(locking?'head':'headOpen');
  el.querySelector('#secLead').textContent=ok.length?ok.map(i=>i.note).filter(Boolean)[0]||'':T(locking?'lead':'leadOpen');
  run.textContent=busy?text('working'):T(locking?'run':'runOpen');
  run.disabled=busy||!items.length;run.hidden=ok.length===items.length&&!!items.length;
  save.hidden=!ok.length;save.textContent=ok.length>1?text('downloadAll',{n:ok.length}):text('download');
  el.querySelector('#secNext').innerHTML=ok.length&&!busy?`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="sec-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`:'';
 }
 function readForm(){
  const value=id=>el.querySelector('#'+id)?.value||'';
  for(const box of el.querySelectorAll('[data-perm]'))allow[box.dataset.perm]=box.checked;
  return {password:value('secPassword'),confirm:locking?value('secConfirm'):value('secPassword'),owner:value('secOwner')};
 }
 async function add(files){
  if(busy)return;
  if(!items.length)frame();
  for(const file of files)items.push({file,info:null});
  track('tool_run',{intent:route.id});render();
  for(const it of items.filter(i=>!i.info))
   try{it.info=await worker.run('inspect',{file:it.file});render();}catch{/* inspection is a courtesy */}
 }
 async function run(){
  if(busy||!items.length)return;
  const {password,confirm,owner}=readForm();
  if(locking&&!password){toast(T('needPassword'),{error:true});el.querySelector('#secPassword').focus();return;}
  if(locking&&password!==confirm){toast(T('mismatch'),{error:true});el.querySelector('#secConfirm').focus();return;}
  busy=true;render();
  for(const it of items){
   if(it.blob)continue;
   it.working=true;it.error='';render();
   try{
    const result=locking
     ?await worker.run('protect',{file:it.file,password,ownerPassword:owner,allow:{...allow}},p=>{it.note=p;render();})
     :await worker.run('unlock',{file:it.file,password});
    it.blob=result.blob;it.name=`${stem(it.file.name)}-${locking?'protected':'unlocked'}.pdf`;
    it.note=locking
     ?T('protectedNote',{n:result.report.pages,size:bytes(result.blob.size)})
     :result.report.alreadyOpen?T('wasOpen'):T('unlockedNote',{n:result.report.pages,h:result.report.handler});
    it.row=`${text('pdf.pagesN',{n:result.report.pages||0})} · ${bytes(result.blob.size)}`;
    if(!locking&&!result.report.verified){it.note+=' · '+T('unverified');it.row+=' · '+T('unverified');}
   }catch(error){
    const code=error?.message||String(error);
    it.error=code.includes('WRONG_PASSWORD')?T('wrongPassword'):code.includes('NO_PASSWORD')?T('needPassword')
     :code.includes('UNSUPPORTED_OBJECT_STREAM')?T('unsupported'):/encrypt/i.test(code)?T('alreadyProtected'):code;
    track('tool_error',{intent:route.id,error_code:'processing_failed'});
   }finally{it.working=false;render();}
  }
  busy=false;render();
  if(ready().length)track('tool_success',{intent:route.id});
 }
 async function save(){
  const ok=ready();if(!ok.length)return;
  if(ok.length===1)return download(ok[0].blob,ok[0].name);
  toast(text('zipping'));
  download(await zip(ok.map(i=>({name:i.name,blob:i.blob}))),`${BRAND.name.toLowerCase()}-${route.id}.zip`);
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const a=b.dataset.action,i=Number(b.dataset.index);
  if(a==='sec-run')run();
  else if(a==='sec-download')save();
  else if(a==='sec-save'){const it=items[i];if(it?.blob)download(it.blob,it.name);}
  else if(a==='sec-remove'){items.splice(i,1);if(!items.length){worker.close();empty();return;}render();}
  else if(a==='sec-clear'){items.splice(0);worker.close();empty();}
  else if(a==='sec-next')continueWith(b.dataset.tool,ready().map(it=>new File([it.blob],it.name,{type:'application/pdf'})));
 });
 el.addEventListener('input',e=>{
  if(e.target.id==='secShow'){for(const field of el.querySelectorAll('#secForm input[autocomplete="new-password"]'))field.type=e.target.checked?'text':'password';return;}
  if(e.target.closest('#secForm')){for(const it of items)if(!it.blob)it.error='';render();}
 });
 el.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  if(e.key==='Enter'&&e.target.closest('#secForm')){e.preventDefault();run();}
 });
 el.addEventListener('submit',e=>e.preventDefault());
 onLocale(()=>{if(!items.length){empty();return;}frame();render();});
 empty();
 return {add};
}
