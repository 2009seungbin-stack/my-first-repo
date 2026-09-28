import {getLocale} from '../i18n.js';
import {PARTS,PALETTES,CATEGORIES} from '../avatar/catalog.js';
import {DEFAULT,parse,normalize,randomize,serialize} from '../avatar/model.js';
import {renderLogical} from '../avatar/render.js';
import {COPY} from './avatar-strings.js';
import {download,onLocale} from './shell.js';

export const accept='image/png,image/jpeg,image/webp';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NAME='nerulio-pixel-avatar';

export function mount({el}){
 if(!document.querySelector('[data-avatar-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./pixel-avatar.css',import.meta.url).href;link.dataset.avatarCss='';document.head.append(link);}
 const initial=parse(location.search),C=()=>COPY[getLocale()]||COPY.en;
 let state=initial.state,tab='face',past=[],future=[],locks={},size=256,busy=false,job=null,status=initial.valid?'statusReady':'statusBadURL';
 let backgroundFile=null,backgroundBitmap=null;
 const $=sel=>el.querySelector(sel);
 const link=()=>{const url=new URL(location.href);url.search=serialize(state);return url.href};
 function syncURL(){history.replaceState({},'',link());}
 function say(key,message=''){status=key;const node=$('#avatarStatus');if(node)node.textContent=(C()[key]||key)+message;}
 function preview(){
  const canvas=$('#avatarCanvas');if(!canvas)return;
  const logical=renderLogical(state);canvas.width=16;canvas.height=16;
  const ctx=canvas.getContext('2d');
  if(backgroundBitmap){
   const scale=Math.max(16/backgroundBitmap.width,16/backgroundBitmap.height),w=backgroundBitmap.width*scale,h=backgroundBitmap.height*scale;
   ctx.drawImage(backgroundBitmap,(16-w)/2,(16-h)/2,w,h);
   const top=renderLogical({...state,background:'transparent'}),layer=document.createElement('canvas');layer.width=16;layer.height=16;
   layer.getContext('2d').putImageData(new ImageData(top.data,16,16),0,0);ctx.drawImage(layer,0,0);
  }else ctx.putImageData(new ImageData(logical.data,16,16),0,0);
 }
 function options(key){return PARTS[key].map(([id])=>`<button type="button" class="avatar-choice ${state[key]===id?'active':''}" data-category="${key}" data-choice="${id}" aria-pressed="${state[key]===id}">${esc(C()[id]||id)}</button>`).join('');}
 function render(){
  const old=document.activeElement,focus=old&&el.contains(old)?{choice:old.dataset.choice,tab:old.dataset.tab,action:old.dataset.action,palette:old.dataset.palette}:null;
  const c=C(),share=link(),x=`https://x.com/intent/tweet?text=${encodeURIComponent(share)}`,line=`https://line.me/R/share?text=${encodeURIComponent(share)}`;
  el.innerHTML=`<div class="avatar-app"><div class="avatar-intro"><p>${esc(c.lead)}</p><small>${esc(c.version)}</small></div>
  <div class="avatar-layout"><section class="avatar-stage" aria-label="${esc(c.preview)}"><div class="avatar-art"><canvas id="avatarCanvas" width="16" height="16" role="img" aria-label="${esc(c.preview)}"></canvas></div>
  <div class="avatar-main-actions"><button type="button" data-action="random">↝ ${esc(c.random)}</button><button type="button" data-action="undo" ${past.length?'':'disabled'}>${esc(c.undo)}</button><button type="button" data-action="redo" ${future.length?'':'disabled'}>${esc(c.redo)}</button><button type="button" data-action="reset">${esc(c.reset)}</button></div>
  <p class="avatar-status" id="avatarStatus" role="status" aria-live="polite">${esc(c[status]||status)}</p></section>
  <section class="avatar-controls" aria-label="${esc(c.face)}"><div class="avatar-tabs" role="group" aria-label="Parts">${CATEGORIES.map(key=>`<button type="button" data-tab="${key}" aria-pressed="${tab===key}" class="${tab===key?'active':''}">${esc(c[key])}${locks[key]?' 🔒':''}</button>`).join('')}</div>
  <div class="avatar-option-head"><h2>${esc(c[tab])}</h2><button type="button" data-action="lock" aria-pressed="${!!locks[tab]}">${locks[tab]?esc(c.unlock):esc(c.lock)}</button></div><div class="avatar-options" role="group" aria-label="${esc(c[tab])}">${options(tab)}</div>
  <div class="avatar-palettes"><label>${esc(c.hairPalette)}<select data-palette="hairPalette">${PALETTES.hair.map(id=>`<option value="${id}" ${state.hairPalette===id?'selected':''}>${esc(c[id])}</option>`).join('')}</select></label>
  <label>${esc(c.outfitPalette)}<select data-palette="outfitPalette">${PALETTES.outfit.map(id=>`<option value="${id}" ${state.outfitPalette===id?'selected':''}>${esc(c[id])}</option>`).join('')}</select></label></div>
  <div class="avatar-background"><button type="button" data-action="pick">${esc(c.pickBackground)}</button>${backgroundFile?`<button type="button" data-action="remove-background">${esc(c.removeBackground)}</button><span>${esc(c.backgroundLoaded+backgroundFile.name)}</span>`:''}<small>${esc(c.backgroundHint)}</small></div>
  <div class="avatar-export"><h2>${esc(c.png)}</h2><label>${esc(c.size)}<select id="avatarSize">${[32,48,64,128,256,512,1024,4096].map(n=>`<option value="${n}" ${size===n?'selected':''}>${n} × ${n}</option>`).join('')}</select></label>
  <div class="avatar-export-buttons"><button type="button" class="primary" data-action="png" ${busy?'disabled':''}>${esc(c.png)}</button><button type="button" data-action="gif" ${busy?'disabled':''}>${esc(c.gif)}</button><button type="button" data-action="card" ${busy?'disabled':''}>${esc(c.card)}</button>${navigator.share&&navigator.canShare?`<button type="button" data-action="native-share" ${busy?'disabled':''}>${esc(c.nativeShare)}</button>`:''}<button type="button" data-action="cancel" ${busy?'':'hidden'}>${esc(c.cancel)}</button></div></div></section></div>
  <div class="avatar-share"><button type="button" data-action="link">${esc(c.link)}</button><a href="${esc(x)}" target="_blank" rel="noopener noreferrer">${esc(c.x)}</a><a href="${esc(line)}" target="_blank" rel="noopener noreferrer">${esc(c.line)}</a></div>
  <p class="avatar-note">${esc(c.local)}</p><p class="avatar-note">${esc(c.license)}</p><p class="avatar-note">${esc(c.gifNote)}</p></div>`;
  preview();
  if(focus){
   const selector=focus.choice?`[data-choice="${focus.choice}"]`:focus.tab?`[data-tab="${focus.tab}"]`:focus.action?`[data-action="${focus.action}"]`:focus.palette?`[data-palette="${focus.palette}"]`:'';
   if(selector)$(selector)?.focus({preventScroll:true});
  }
 }
 function update(next){
  next=normalize(next);if(JSON.stringify(next)===JSON.stringify(state))return;
  past.push(state);if(past.length>60)past.shift();future=[];state=next;syncURL();render();
 }
 function restore(stack,to){if(!stack.length)return;to.push(state);state=stack.pop();syncURL();render();}
 async function exportFile(kind){
  if(busy)return;
  busy=true;say('statusExport');render();
  const outputSize=kind==='gif'?Math.min(size,1024):size;
  job=new Worker(new URL('../avatar/worker.js',import.meta.url),{type:'module'});
  const worker=job,id=crypto.randomUUID();
  worker.onmessage=event=>{
   if(event.data?.id!==id||worker!==job)return;
   if(event.data.type==='result'){
    const ext=kind==='gif'?'gif':'png',suffix=kind==='card'?'card':String(outputSize);
    if(kind==='native-share'){
     const file=new File([event.data.blob],`${NAME}-card.png`,{type:'image/png'});
     if(!navigator.canShare?.({files:[file]}))say('shareUnavailable');
     else navigator.share({files:[file],title:'Nerulio Pixel Avatar'}).then(()=>say('statusDone')).catch(error=>say(error?.name==='AbortError'?'shareCanceled':'shareUnavailable'));
    }else{download(event.data.blob,`${NAME}-${suffix}.${ext}`);say('statusDone');}
    busy=false;worker.terminate();job=null;render();
   }else if(event.data.type==='error'){
    say('statusError',event.data.message);busy=false;worker.terminate();job=null;render();
   }
  };
  worker.onerror=e=>{say('statusError',e.message);busy=false;worker.terminate();job=null;render();};
  worker.postMessage({id,kind:kind==='native-share'?'card':kind,state,size:outputSize,delay:125,background:backgroundFile});
 }
 el.addEventListener('click',async event=>{
  const choice=event.target.closest('[data-choice]');if(choice){update({...state,[choice.dataset.category]:choice.dataset.choice});return;}
  const tabButton=event.target.closest('[data-tab]');if(tabButton){tab=tabButton.dataset.tab;render();return;}
  const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='lock'){locks[tab]=!locks[tab];render();}
  if(action==='random')update(randomize(state,locks,Math.floor(Math.random()*0x100000000)));
  if(action==='undo')restore(past,future);
  if(action==='redo')restore(future,past);
  if(action==='reset')update(DEFAULT);
  if(action==='remove-background'&&backgroundBitmap){backgroundBitmap.close();backgroundBitmap=null;backgroundFile=null;render();}
  if(['png','gif','card','native-share'].includes(action))await exportFile(action);
  if(action==='cancel'&&job){job.terminate();job=null;busy=false;say('statusCancel');render();}
  if(action==='link'){
   try{await navigator.clipboard.writeText(link());say('statusLink');}
   catch{say('statusError','Clipboard unavailable');}
  }
 });
 el.addEventListener('change',event=>{
  if(event.target.dataset.palette)update({...state,[event.target.dataset.palette]:event.target.value});
  if(event.target.id==='avatarSize')size=Number(event.target.value);
 });
 el.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){
   event.preventDefault();if(event.shiftKey)restore(future,past);else restore(past,future);
  }
 });
 onLocale(render);
 render();
 return {async add(files){
  const file=files[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024){say('backgroundError');return;}
  let bitmap;
  try{
   bitmap=await createImageBitmap(file);
   if(bitmap.width>8192||bitmap.height>8192)throw new RangeError('Image dimensions exceed 8192');
   backgroundBitmap?.close();backgroundBitmap=bitmap;backgroundFile=file;render();
  }catch{bitmap?.close();say('backgroundError');}
 }};
}
