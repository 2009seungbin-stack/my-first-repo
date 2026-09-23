import * as Im from '../image.js';
import {bytes,stem,zip} from '../core.js';
import {t} from '../i18n.js';
import {imagePalette,swapColors} from '../game/palette-swap.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
import './strings-trust.js';
import {decodeExact} from './exact-decode.js';
/** Palette swap: the colours the sprite actually uses, picked from swatches or straight off the
 * image (eyedropper), and as many swaps as needed in one pass (src/game/palette-swap.js). Every
 * dropped image gets the same swaps; one image downloads as a PNG, several as a ZIP.
 * The first swap's fields keep the recipe page's names (data-option from / to / tolerance /
 * shading), so a shared link or script written for the old page still drives this one. */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MAX_SWATCHES=64;
const isHex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''));
export function mount({el,def}){
 const T=(k,v)=>text('pswap.'+k,v);
 let images=[],active=0,rules=[],armed=0,busy=false,palette=null,zoom=0,last=null;
 // A shared link (?from=#ff0000&to=#00ff00&tolerance=0) presets the first swap, as before.
 const q=route.query,preset={from:isHex(q.get('from'))?q.get('from'):null,to:isHex(q.get('to'))?q.get('to'):null,
  tolerance:Math.max(0,Math.min(441,Number(q.get('tolerance'))||0)),shading:q.get('shading')==='1'};
 const $=s=>el.querySelector(s);
 const current=()=>images[active]||null;
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="pswap-sample">${esc(T('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 const ruleRow=(r,i)=>{
  const name=k=>i===0?`data-option="${k}"`:`data-rule="${i}" data-key="${k}"`;
  return `<div class="pswap-rule" data-index="${i}"><button type="button" class="mini-button" data-action="pswap-arm" data-index="${i}" aria-pressed="${armed===i}" title="${esc(T('pick'))}">${i+1}</button>
<label class="field inline"><span>${esc(T('from'))}</span><input type="color" ${name('from')} value="${esc(r.from)}"></label>
<label class="field inline"><span>${esc(T('to'))}</span><input type="color" ${name('to')} value="${esc(r.to)}"></label>
<button type="button" class="mini-button" data-action="pswap-remove" data-index="${i}" ${rules.length>1?'':'disabled'}>${esc(T('removeSwap'))}</button>
<label class="field inline"><span>${esc(T('tolerance'))}</span><input type="number" min="0" max="441" step="1" ${name('tolerance')} value="${r.tolerance}" inputmode="numeric"></label>
<label class="check"><input type="checkbox" ${name('shading')} ${r.shading?'checked':''}> ${esc(T('shading'))}</label></div>`;
 };
 function frame(){
  el.innerHTML=`<div class="work pswap-work"><section class="board">
<div class="view-head"><strong>${esc(T('palette'))}</strong><span id="pswapPaletteInfo"></span></div>
<div class="pswap-views"><figure><figcaption>${esc(T('before'))} · <small>${esc(T('pickHint'))}</small></figcaption><canvas id="pswapBefore" class="px" tabindex="0" aria-label="${esc(T('pick'))}"></canvas></figure>
<figure><figcaption>${esc(T('after'))}</figcaption><canvas id="pswapAfter" class="px"></canvas></figure></div>
<ul class="pswap-files" id="taskFiles"></ul></section>
<aside class="side"><div class="summary" id="pswapSummary" role="status" aria-live="polite"></div>
<span class="opt-label">${esc(T('palette'))}</span><div class="pswap-palette" id="pswapPalette" role="group" aria-label="${esc(T('palette'))}"></div>
<form class="options" id="pswapForm" autocomplete="off"><span class="opt-label">${esc(T('swaps'))}</span><div id="pswapRules"></div>
<button type="button" class="dashed" data-action="pswap-add">${esc(T('addSwap'))}</button>
<details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary><label class="field"><span>${esc(T('zoom'))}</span><select id="pswapZoom">${[0,1,2,4,8].map(z=>`<option value="${z}" ${zoom===z?'selected':''}>${z?z+'×':esc(text('slicer.fit'))}</option>`).join('')}</select></label></details></form>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(text('add'))}</button><button type="button" class="link" data-action="pswap-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="pswap-run"></button><nav class="next" id="pswapNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
  renderRules();render();
 }
 function renderRules(){const host=$('#pswapRules');if(host)host.innerHTML=rules.map(ruleRow).join('');}
 function renderFiles(){
  const host=$('#taskFiles');if(!host)return;
  host.innerHTML=images.map((im,i)=>`<li class="file ${i===active?'is-selected':''}"><button type="button" class="link" data-action="pswap-pick-image" data-index="${i}" aria-pressed="${i===active}">${esc(im.name)}</button> <small>${im.w}×${im.h}</small></li>`).join('');
 }
 function renderPalette(){
  const host=$('#pswapPalette'),info=$('#pswapPaletteInfo'),im=current();if(!host||!im)return;
  palette=imagePalette({data:im.data,width:im.w,height:im.h},{max:MAX_SWATCHES});
  const from=new Set(rules.map(r=>r.from.toLowerCase()));
  host.innerHTML=palette.colors.map(c=>`<button type="button" class="pswap-swatch" data-action="pswap-swatch" data-hex="${c.hex}" style="background:${c.hex}" aria-pressed="${from.has(c.hex)}" title="${c.hex} · ${c.count}px" aria-label="${c.hex}"></button>`).join('')+(palette.more?`<small>${esc(T('paletteMore',{n:palette.more}))}</small>`:'');
  if(info)info.textContent=T('paletteCount',{n:palette.distinct});
 }
 function fit(cv,w,h){
  const box=cv.parentElement.clientWidth||300,scale=zoom||Math.max(1,Math.min(16,Math.floor(box/w)));
  cv.style.width=w*scale+'px';cv.style.height=h*scale+'px';
 }
 function render(){
  const im=current();if(!im)return;
  renderFiles();renderPalette();
  const out=swapColors({data:im.data,width:im.w,height:im.h},rules);last=out;
  for(const [id,data] of [['#pswapBefore',im.data],['#pswapAfter',out.data]]){
   const cv=$(id);cv.width=im.w;cv.height=im.h;cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),im.w,im.h),0,0);fit(cv,im.w,im.h);
  }
  const box=$('#pswapSummary');
  box.innerHTML=`<div class="summary-big">${esc(T('changed',{n:out.changed}))}</div><div class="summary-line">${rules.map((r,i)=>`${i+1}. ${r.from} → ${r.to} · ${out.perRule[i]}px`).join('<br>')||esc(T('noSwaps'))}</div>`;
  box.dataset.changed=String(out.changed);
  const run=$('#taskDownload');run.disabled=busy;run.textContent=images.length>1?T('runMany',{n:images.length}):T('run');
 }
 function addRule(hex){
  rules.push({from:hex,to:hex,tolerance:0,shading:false});armed=rules.length-1;renderRules();render();
  el.querySelector(`[data-index="${armed}"] input[type=color]:not([data-option="from"]):not([data-key="from"])`)?.focus();
 }
 /** A picked colour fills the armed swap's "from" (a new swap when none is armed). */
 function picked(hex){
  const r=rules[armed];
  if(!r||r.touched)return void addRule(hex);
  if(r.to===r.from)r.to=hex;
  r.from=hex;renderRules();render();
 }
 async function add(files){
  if(busy)return;busy=true;const first=!images.length;
  try{
   for(const file of files){
    const c=await decodeExact(file);
    try{const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);images.push({name:file.name,w:c.width,h:c.height,data:d.data});}
    finally{Im.release(c);}
   }
   if(first){
    const top=imagePalette({data:images[0].data,width:images[0].w,height:images[0].h},{max:1}).colors[0]?.hex||'#000000';
    rules=[{from:preset.from||top,to:preset.to||preset.from||top,tolerance:preset.tolerance,shading:preset.shading}];armed=0;
    frame();
   }else{busy=false;render();}
   track('tool_run',{intent:route.id});
  }catch(error){toast(error?.message||String(error),{error:true});if(!images.length)empty();}
  finally{busy=false;if(images.length)render();}
 }
 async function pngOf(im,data){
  const c=Im.canvas(im.w,im.h);
  try{c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),im.w,im.h),0,0);return await Im.blobOf(c);}finally{Im.release(c);}
 }
 async function run(){
  if(!images.length||busy)return;busy=true;render();
  try{
   const outputs=[];
   for(const im of images)outputs.push({name:`${stem(im.name)}-palette-swap.png`,blob:await pngOf(im,swapColors({data:im.data,width:im.w,height:im.h},rules).data)});
   const blob=outputs.length>1?await zip(outputs):outputs[0].blob;
   download(blob,outputs.length>1?'palette-swap.zip':outputs[0].name);
   track('tool_success',{intent:route.id});toast(T('done',{size:bytes(blob.size)}));
   const next=$('#pswapNext');
   if(next&&outputs.length===1){next.innerHTML=`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="pswap-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;next.dataset.blob='1';last.file=new File([outputs[0].blob],outputs[0].name,{type:'image/png'});}
  }catch(error){toast(error?.message||String(error),{error:true});}
  finally{busy=false;render();}
 }
 async function sample(){
  const c=Im.canvas(16,16),x=c.getContext('2d');
  x.fillStyle='#1b1f3b';x.fillRect(4,1,8,14);x.fillStyle='#e85d75';x.fillRect(5,2,6,4);x.fillStyle='#b8405a';x.fillRect(5,5,6,1);
  x.fillStyle='#f4c095';x.fillRect(5,6,6,3);x.fillStyle='#3a86ff';x.fillRect(5,9,6,4);x.fillStyle='#265dab';x.fillRect(5,12,6,1);
  const file=new File([await Im.blobOf(c)],'palette_sample.png',{type:'image/png'});Im.release(c);return file;
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');
  if(!b){
   // Eyedropper: a click on the original image picks that pixel's colour.
   const cv=e.target.closest?.('#pswapBefore'),im=current();
   if(cv&&im){const r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*im.w),y=Math.floor((e.clientY-r.top)/r.height*im.h),i=(y*im.w+x)*4;
    if(x>=0&&y>=0&&x<im.w&&y<im.h&&im.data[i+3])picked('#'+[0,1,2].map(k=>im.data[i+k].toString(16).padStart(2,'0')).join(''));}
   return;
  }
  const a=b.dataset.action;
  if(a==='pswap-sample')return void add([await sample()]);
  if(a==='pswap-swatch')return void picked(b.dataset.hex);
  if(a==='pswap-arm'){armed=Number(b.dataset.index);rules[armed].touched=false;renderRules();return;}
  if(a==='pswap-add'){const top=palette?.colors.find(c=>!rules.some(r=>r.from===c.hex))?.hex||'#000000';addRule(top);return;}
  if(a==='pswap-remove'){rules.splice(Number(b.dataset.index),1);armed=Math.min(armed,rules.length-1);renderRules();render();return;}
  if(a==='pswap-pick-image'){active=Number(b.dataset.index);render();return;}
  if(a==='pswap-clear'){images=[];rules=[];empty();return;}
  if(a==='pswap-run')return void run();
  if(a==='pswap-next'&&last?.file)continueWith(b.dataset.tool,[last.file]);
 });
 el.addEventListener('input',e=>{
  const input=e.target;
  if(input.id==='pswapZoom'){zoom=Number(input.value)||0;render();return;}
  const index=input.dataset.option?0:input.dataset.rule!=null?Number(input.dataset.rule):-1,key=input.dataset.option||input.dataset.key;
  if(index<0||!rules[index]||!key)return;
  const r=rules[index];
  if(key==='tolerance')r.tolerance=Math.max(0,Math.min(441,Math.round(Number(input.value)||0)));
  else if(key==='shading')r.shading=input.checked;
  else if(isHex(input.value))r[key]=input.value.toLowerCase();
  r.touched=true;render();
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();}});
 addEventListener('resize',()=>{if(images.length)render();});
 // Work lives only in this tab: leaving it with images loaded asks first.
 addEventListener('beforeunload',e=>{if(el.isConnected&&images.length){e.preventDefault();e.returnValue='';}});
 onLocale(()=>{if(!images.length){empty();return;}frame();});
 empty();
 return {add};
}
