import * as Im from '../image.js';
import {bytes,stem} from '../core.js';
import {packMasks} from '../mask-packer.js';
import {yieldUI} from '../resources.js';
import {t,getLocale} from '../i18n.js';
import {ENGINE_PRESETS,PRESET_IDS,presetChannels} from '../game/texture-presets.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** RGBA mask packer: drop up to four grayscale maps, say which channel each one goes to, and the
 * packed texture is already on screen — with a preview per channel, because a packed mask is
 * unreadable as one image. Engine: src/mask-packer.js, which streams 32 rows at a time and writes
 * the PNG itself, so RGB survives under alpha 0 (canvas encoding would erase it). */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CHANNELS=['R','G','B','A'],MAX=4,PREVIEW=248;
/** Engine channel layouts come from src/game/texture-presets.js, which carries the documentation
 * behind each claim and is shared with Texture Lab — one source for "which channel is what".
 * A channel the engine ignores is written as 0; an alpha the layout does not use is written as
 * 255 so the packed file stays opaque. Inputs fill the meaningful channels in order. */
const PRESETS=Object.freeze(Object.fromEntries(PRESET_IDS.map(id=>{
 let input=0;
 const channels=presetChannels(id);
 return [id,{mapping:channels.map(c=>c.role==='ignored'?'zero':c.role==='unused'?'one':input++),channels,
  label:ENGINE_PRESETS[id].label,short:ENGINE_PRESETS[id].short,note:ENGINE_PRESETS[id].note,doc:ENGINE_PRESETS[id].doc}];
})));
export function mount({el,def}){
 let inputs=[],mapping=[0,1,2,'one'],invert=[false,false,false,false],preset='custom',size=null;
 let busy=false,error='',result=null,timer=0;
 const T=(k,v)=>text('mask.'+k,v);
 /** Per-channel label and explanation for the chosen preset, in the current language. */
 const roles=()=>PRESETS[preset]?.channels.map(c=>({label:c.label[getLocale()],tip:c.tooltip[getLocale()],role:c.role}))||[null,null,null,null];
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="mask-sample">${esc(text('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  el.innerHTML=`<div class="work atlas-work"><section class="board"><div class="view-head"><strong>${esc(T('packed'))}</strong><span id="maskInfo"></span></div>
<div class="atlas-canvas mask-main" id="maskMainBox"><canvas id="maskMain" class="px"></canvas></div>
<div class="view-head"><strong>${esc(T('perChannel'))}</strong></div><div class="mask-channels" id="maskPreviews"></div>
<p class="viewer-note">${esc(T('hint'))}</p></section>
<aside class="side"><div class="summary" id="maskSummary" role="status" aria-live="polite"></div>
<form id="maskOptions" class="options" autocomplete="off"><span class="opt-label">${esc(T('preset'))}</span>
<div class="chips-row" role="group" id="maskPreset">${[['custom',T('presets.custom'),''],...PRESET_IDS.map(id=>[id,PRESETS[id].short?.[getLocale()]||PRESETS[id].label[getLocale()],PRESETS[id].label[getLocale()]])].map(([v,label,tip])=>`<button type="button" class="chip" data-action="mask-preset" data-value="${v}" aria-pressed="${preset===v}" title="${esc(tip)}">${esc(label)}</button>`).join('')}</div>
<span class="opt-label">${esc(T('channels'))}</span><div id="maskRows"></div><p class="hint" id="maskPresetNote"></p></form>
<div class="file-list" id="maskFiles"></div>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('add'))}</button><button type="button" class="link" data-action="mask-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="mask-download" disabled></button><nav class="next" id="maskNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
 }
 function renderRows(){
  const host=el.querySelector('#maskRows');if(!host)return;
  const role=roles();
  host.innerHTML=CHANNELS.map((name,c)=>{
   const value=typeof mapping[c]==='number'?'input'+mapping[c]:mapping[c];
   const options=[['zero',T('zero')],['one',T('one')],...inputs.map((f,i)=>['input'+i,`${i+1}. ${f.name}`])];
   return `<div class="mask-row"><label class="field"><span>${name}${role[c]?` <small title="${esc(role[c].tip)}">${esc(role[c].label)}</small>`:''}</span><select data-channel="${c}">${options.map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label><label class="check"><input type="checkbox" data-invert="${c}" ${invert[c]?'checked':''}> ${esc(T('invert'))}</label></div>`;
  }).join('');
  const note=el.querySelector('#maskPresetNote');
  if(note)note.textContent=PRESETS[preset]?.note?.[getLocale()]||'';
 }
 function renderList(){
  const host=el.querySelector('#maskFiles');if(!host)return;
  host.innerHTML=inputs.map((f,i)=>`<div class="file"><span class="file-main static"><span><b>${i+1}. ${esc(f.name)}</b><small>${f.width}×${f.height}${(f.width!==size?.w||f.height!==size?.h)?' · '+esc(T('mismatch')):''}</small></span><em class="pill">${esc(usedBy(i)||T('unused'))}</em></span><button type="button" class="icon" data-action="mask-remove" data-index="${i}" aria-label="${esc(text('remove'))}">×</button></div>`).join('');
 }
 const usedBy=i=>CHANNELS.filter((_,c)=>mapping[c]===i).join('');
 const mapText=()=>CHANNELS.map((n,c)=>`${n}←${typeof mapping[c]==='number'?mapping[c]+1:mapping[c]==='one'?'255':'0'}${invert[c]?'⁻':''}`).join(' · ');
 /** Every preview is built from the same luminance the engine writes, at preview scale. */
 function renderPreviews(){
  const main=el.querySelector('#maskMain'),host=el.querySelector('#maskPreviews');if(!main||!size)return;
  const scale=Math.min(1,PREVIEW/Math.max(size.w,size.h)),pw=Math.max(1,Math.round(size.w*scale)),ph=Math.max(1,Math.round(size.h*scale));
  const packed=new Uint8ClampedArray(pw*ph*4);
  for(let c=0;c<4;c++){
   const m=mapping[c];
   if(m==='zero'||m==='one'){const v=(m==='one')!==invert[c]?255:0;if(v)for(let i=c;i<packed.length;i+=4)packed[i]=v;continue;}
   const src=inputs[m]?.preview(pw,ph);if(!src)continue;
   for(let i=0;i<packed.length;i+=4){const value=Math.round(.2126*src[i]+.7152*src[i+1]+.0722*src[i+2]);packed[i+c]=invert[c]?255-value:value;}
  }
  main.width=pw;main.height=ph;main.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(packed),pw,ph),0,0);
  el.querySelector('#maskMainBox').style.aspectRatio=`${size.w} / ${size.h}`;
  el.querySelector('#maskInfo').textContent=`${size.w} × ${size.h}`;
  const role=roles();
  host.innerHTML=CHANNELS.map((name,c)=>`<figure class="mask-channel"><canvas data-preview="${c}" class="px"></canvas><figcaption${role[c]?` title="${esc(role[c].tip)}"`:''}>${name}${role[c]?` · ${esc(role[c].label)}`:''}</figcaption></figure>`).join('');
  for(const cv of host.querySelectorAll('canvas[data-preview]')){
   const c=Number(cv.dataset.preview),gray=new Uint8ClampedArray(pw*ph*4);
   for(let i=0;i<gray.length;i+=4){const v=packed[i+c];gray[i]=gray[i+1]=gray[i+2]=v;gray[i+3]=255;}
   cv.width=pw;cv.height=ph;cv.getContext('2d').putImageData(new ImageData(gray,pw,ph),0,0);
  }
 }
 function validate(){
  error='';
  if(!inputs.length){error=T('needInput');return;}
  if(inputs.some(f=>f.width!==size.w||f.height!==size.h)){error=T('sizeMismatch');return;}
  if(mapping.some(m=>typeof m==='number'&&!inputs[m])){error=T('needChannel');return;}
  if(!mapping.some(m=>typeof m==='number')){error=T('needChannel');return;}
 }
 function renderSummary(){
  const box=el.querySelector('#maskSummary'),button=el.querySelector('#taskDownload');if(!box)return;
  box.innerHTML=error?`<div class="summary-big muted">…</div><div class="summary-line bad">${esc(error)}</div>`
   :`<div class="summary-big">${size?`${size.w} × ${size.h}`:'…'}</div><div class="summary-line">${esc(mapText())}${result?' · '+esc(bytes(result.blob.size)):''}</div>`;
  button.disabled=!!error||busy;button.textContent=busy?T('working'):T('run');
  el.querySelector('#maskNext').innerHTML=result?`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="mask-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`:'';
 }
 const render=()=>{validate();renderRows();renderList();renderPreviews();renderSummary();};
 async function add(files){
  if(busy)return;busy=true;const first=!inputs.length;
  try{
   for(const file of files){
    if(inputs.length>=MAX){toast(T('onlyFour'));break;}
    const canvas=await Im.decode(file),width=canvas.width,height=canvas.height;
    // Only a preview-sized copy is kept: the engine re-reads the file itself at full size.
    const scale=Math.min(1,PREVIEW/Math.max(width,height)),small=Im.resize(canvas,Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)),true);
    Im.release(canvas);
    const cache=new Map();
    inputs.push({name:file.name,blob:file,width,height,
     preview(pw,ph){const k=pw+'x'+ph;if(cache.has(k))return cache.get(k);
      const c=small.width===pw&&small.height===ph?small:Im.resize(small,pw,ph,true),data=c.getContext('2d').getImageData(0,0,pw,ph).data;
      if(c!==small)Im.release(c);cache.set(k,data);return data;},
     dispose(){Im.release(small);cache.clear();}});
    if(!size)size={w:width,h:height};
    await yieldUI();
   }
   if(first){frame();mapping=defaultMapping();}
   else mapping=mapping.map((m,c)=>m==='zero'&&inputs[c]?c:m);
   track('tool_run',{intent:route.id});result=null;
  }catch(e){toast(e?.message||String(e),{error:true});if(!inputs.length)empty();}
  // The summary reads `busy`, so the first render has to happen after it is cleared.
  finally{busy=false;if(inputs.length)render();}
 }
 const defaultMapping=()=>[0,1,2,3].map(c=>inputs[c]?c:c===3?'one':'zero');
 function clear(){for(const f of inputs)f.dispose();inputs=[];size=null;result=null;mapping=[0,1,2,'one'];invert=[false,false,false,false];preset='custom';empty();}
 async function run(){
  if(busy||error)return;busy=true;renderSummary();
  try{
   const blob=await packMasks(inputs,size.w,size.h,mapping,{invert,progress:()=>{}});
   result={blob};download(blob,`${stem(inputs[0].name)||'packed'}-mask.png`);
   track('tool_success',{intent:route.id});toast(T('done',{size:bytes(blob.size)}));
  }catch(e){toast(e?.message||String(e),{error:true});}
  finally{busy=false;renderSummary();}
 }
 async function sample(){
  const out=[];
  for(const [i,name] of ['metallic','ao','detail','smoothness'].entries()){
   const c=Im.canvas(64,64),x=c.getContext('2d'),g=x.createLinearGradient(0,0,i%2?0:64,i%2?64:0);
   g.addColorStop(0,'#000');g.addColorStop(1,'#fff');x.fillStyle=g;x.fillRect(0,0,64,64);
   x.fillStyle=i<2?'#888':'#333';x.fillRect(8+i*4,8+i*4,20,20);
   out.push(new File([await Im.blobOf(c)],`${name}.png`,{type:'image/png'}));Im.release(c);
  }
  return out;
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='mask-sample')add(await sample());
  else if(a==='mask-preset'){
   preset=b.dataset.value;
   for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
   if(PRESETS[preset])mapping=PRESETS[preset].mapping.map(m=>typeof m==='number'?(inputs[m]?m:'zero'):m);
   result=null;render();
  }
  else if(a==='mask-remove'){
   const index=Number(b.dataset.index);inputs.splice(index,1)[0]?.dispose();
   if(!inputs.length)return clear();
   mapping=mapping.map(m=>typeof m!=='number'?m:m===index?'zero':m>index?m-1:m);
   size={w:inputs[0].width,h:inputs[0].height};result=null;render();
  }
  else if(a==='mask-clear')clear();
  else if(a==='mask-download')run();
  else if(a==='mask-next'&&result)continueWith(b.dataset.tool,[new File([result.blob],`${stem(inputs[0].name)||'packed'}-mask.png`,{type:'image/png'})]);
 });
 el.addEventListener('change',e=>{
  const select=e.target.closest('[data-channel]'),check=e.target.closest('[data-invert]');
  if(select){const c=Number(select.dataset.channel),v=select.value;mapping=mapping.map((m,i)=>i===c?(v.startsWith('input')?Number(v.slice(5)):v):m);preset='custom';}
  else if(check)invert=invert.map((v,i)=>i===Number(check.dataset.invert)?check.checked:v);
  else return;
  for(const s of el.querySelectorAll('#maskPreset button'))s.setAttribute('aria-pressed',String(s.dataset.value===preset));
  result=null;clearTimeout(timer);timer=setTimeout(render,0);
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();}});
 onLocale(()=>{if(!inputs.length){empty();return;}frame();render();});
 empty();
 return {add};
}
