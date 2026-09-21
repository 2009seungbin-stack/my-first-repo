import * as Im from '../image.js';
import {bytes,stem,zip} from '../core.js';
import {frameNumber} from '../primitives.js';
import {yieldUI} from '../resources.js';
import * as F from '../sprite-frames.js';
import {paintFrame,renderFrame,trimmedRect} from '../frame-normalize.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** Frame canvas normaliser: drop frames of different sizes and they are immediately shown on the
 * one canvas they will be exported on — as a contact sheet, as an onion skin, and animated — so
 * a drifting foot is visible before the download. Same engine as the slicer's common-canvas
 * export (src/frame-normalize.js) and the same frame records (src/sprite-frames.js). */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const natural=(a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});
const ANCHOR_X={left:0,center:.5,right:1};
export function mount({el,def}){
 let sources=[],frames=[],layout=null,seq=0,busy=false,error='',view='frames';
 let playing=true,tick=0,raf=0,last=0,timer=0,dragId=null;
 let o={align:'bottom',anchorX:'center',size:'auto',width:0,height:0,padding:0,trim:true,fps:12};
 const T=(k,v)=>text('norm.'+k,v);
 const sourceOf=(f,i)=>sources[i]?.canvas;
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="norm-sample">${esc(text('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 const seg=(id,key,values,label)=>`<div class="segmented" role="group" id="${id}">${values.map(v=>`<button type="button" data-action="norm-set" data-key="${key}" data-value="${v}" aria-pressed="${String(o[key])===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
 function frame(){
  el.innerHTML=`<div class="work atlas-work"><section class="board"><div class="atlas-views"><div class="atlas-view"><div class="view-head"><strong>${esc(T('canvasTitle'))}</strong><span id="normInfo"></span><div class="segmented" role="group" id="normView"><button type="button" data-action="norm-view" data-value="frames" aria-pressed="${view==='frames'}">${esc(T('viewFrames'))}</button><button type="button" data-action="norm-view" data-value="onion" aria-pressed="${view==='onion'}">${esc(T('viewOnion'))}</button></div></div>
<div class="norm-grid" id="normGrid"></div><div class="atlas-canvas norm-onion" id="normOnionBox" hidden><canvas id="normOnion" class="px"></canvas></div></div>
<div class="atlas-view anim"><div class="view-head"><strong>${esc(T('animation'))}</strong><button type="button" class="mini-button" data-action="norm-play" id="normPlay" aria-label="${esc(T('animation'))}" title="${esc(T('animation'))}"></button></div><div class="atlas-canvas anim-canvas"><canvas id="normAnim" class="px"></canvas></div><label class="field fps"><span>${esc(T('fps'))} <output id="normFpsOut">${o.fps}</output></span><input id="normFps" type="range" min="1" max="60" value="${o.fps}"></label></div></div>
<p class="viewer-note">${esc(T('hint'))}</p></section>
<aside class="side"><div class="summary" id="normSummary" role="status" aria-live="polite"></div><form id="normOptions" class="options" autocomplete="off">
<span class="opt-label">${esc(T('anchorV'))}</span>${seg('normAlign','align',['top','center','bottom'],v=>T('aligns.'+v))}
<span class="opt-label">${esc(T('anchorH'))}</span>${seg('normAnchorX','anchorX',['left','center','right'],v=>T('anchorsX.'+v))}
<label class="check"><input id="normTrim" data-check="trim" type="checkbox" ${o.trim?'checked':''}> ${esc(T('trim'))}</label>
<details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary>
<span class="opt-label">${esc(T('size'))}</span>${seg('normSize','size',['auto','exact'],v=>T('sizes.'+v))}
<div class="field-row" id="normSizeFields" ${o.size==='exact'?'':'hidden'}><label class="field"><span>${esc(T('width'))}</span><input id="normW" data-num="width" type="number" min="1" max="8192" value="${o.width||''}" inputmode="numeric"></label><label class="field"><span>${esc(T('height'))}</span><input id="normH" data-num="height" type="number" min="1" max="8192" value="${o.height||''}" inputmode="numeric"></label></div>
<label class="field"><span>${esc(T('padding'))}</span><input id="normPadding" data-num="padding" type="number" min="0" max="512" value="${o.padding}" inputmode="numeric"></label>
<p class="hint">${esc(T('sizeHint'))}</p></details></form>
<div class="file-list" id="normFiles"></div>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('add'))}</button><button type="button" class="link" data-action="norm-sort">${esc(T('sortName'))}</button><button type="button" class="link" data-action="norm-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="norm-download" disabled></button><nav class="next" id="normNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
 }
 function relayout(){
  for(const [i,f] of frames.entries())f.trimmedRect=o.trim?sources[i].trim:null;
  try{
   layout=F.layoutFrames(frames,{mode:'common',align:o.align,anchor:ANCHOR_X[o.anchorX],padding:o.padding,
    width:o.size==='exact'?o.width:0,height:o.size==='exact'?o.height:0});
   frames=layout.frames;error='';
  }catch(e){layout=null;error=e?.message||String(e);}
 }
 function renderGrid(){
  const host=el.querySelector('#normGrid'),box=el.querySelector('#normOnionBox');if(!host)return;
  host.hidden=view!=='frames';box.hidden=view!=='onion';
  if(view==='onion'){
   const cv=el.querySelector('#normOnion');
   if(!layout){cv.width=cv.height=1;return;}
   if(cv.width!==layout.width||cv.height!==layout.height){cv.width=layout.width;cv.height=layout.height;}
   const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
   box.style.aspectRatio=`${layout.width} / ${layout.height}`;
   frames.forEach((f,i)=>{ctx.globalAlpha=Math.max(.18,1/frames.length);paintFrame(ctx,sourceOf(f,i),f);});
   ctx.globalAlpha=1;host.innerHTML='';return;
  }
  host.innerHTML=frames.map((f,i)=>`<figure class="norm-cell"><div class="norm-hold"><canvas data-cell="${i}" class="px"></canvas></div><figcaption title="${esc(f.name)}">${i+1}. ${esc(f.name)}</figcaption></figure>`).join('');
  if(!layout)return;
  for(const cv of host.querySelectorAll('canvas[data-cell]')){
   const i=Number(cv.dataset.cell),f=frames[i];
   cv.width=layout.width;cv.height=layout.height;cv.style.aspectRatio=`${layout.width} / ${layout.height}`;
   paintFrame(cv.getContext('2d'),sourceOf(f,i),f);
  }
 }
 function renderList(){
  const host=el.querySelector('#normFiles');if(!host)return;
  host.innerHTML=frames.map((f,i)=>{const b=F.boxOf(f);
   return `<div class="file" draggable="true" data-id="${f.id}"><span class="file-main static"><span><b>${esc(f.name)}</b><small>${sources[i].canvas.width}×${sources[i].canvas.height} → ${b.w}×${b.h}</small></span><em class="pill" title="${esc(T('offset'))}">${f.offsetX},${f.offsetY}</em></span><button type="button" class="icon" data-action="norm-remove" data-id="${f.id}" aria-label="${esc(text('remove'))}">×</button></div>`;
  }).join('');
 }
 function renderSummary(){
  const box=el.querySelector('#normSummary'),button=el.querySelector('#taskDownload');if(!box)return;
  box.innerHTML=error?`<div class="summary-big muted">…</div><div class="summary-line bad">${esc(error)}</div>`
   :`<div class="summary-big">${layout?`${layout.width} × ${layout.height}`:'…'}</div><div class="summary-line">${esc(T('frameCount',{n:frames.length}))}${o.trim?' · '+esc(T('trimmed')):''}</div>`;
  button.disabled=!frames.length||!!error||busy;button.textContent=frames.length?T('run',{n:frames.length}):T('none');
  el.querySelector('#normInfo').textContent=layout?`${layout.width} × ${layout.height}`:'';
  el.querySelector('#normNext').innerHTML=frames.length&&!error?`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="norm-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`:'';
 }
 const render=()=>{renderGrid();renderList();renderSummary();};
 function animate(now){
  raf=requestAnimationFrame(animate);
  const cv=el.querySelector('#normAnim');if(!cv||!layout||!frames.length)return;
  if(playing&&now-last>=1000/o.fps){last=now;tick=(tick+1)%frames.length;}
  else if(cv.dataset.at===`${tick}|${frames.length}|${layout.width}|${layout.height}`)return;
  if(cv.width!==layout.width||cv.height!==layout.height){cv.width=layout.width;cv.height=layout.height;}
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  const at=tick%frames.length;paintFrame(ctx,sourceOf(frames[at],at),frames[at]);
  cv.dataset.at=`${tick}|${frames.length}|${layout.width}|${layout.height}`;
  const play=el.querySelector('#normPlay');if(play)play.textContent=playing?'❚❚':'▶';
 }
 async function add(files){
  if(busy)return;busy=true;const first=!frames.length;
  try{
   for(const file of files){
    const canvas=await Im.decode(file),full={x:0,y:0,w:canvas.width,h:canvas.height},trim=await trimmedRect(canvas,full)||full;
    sources.push({canvas,trim});frames.push(F.makeFrame(++seq,{x:0,y:0,w:canvas.width,h:canvas.height},{name:file.name}));
    await yieldUI();
   }
   if(first){frame();cancelAnimationFrame(raf);raf=requestAnimationFrame(animate);}
   track('tool_run',{intent:route.id});
  }catch(e){toast(e?.message||String(e),{error:true});if(!frames.length)empty();}
  // The summary reads `busy`, so the first render has to happen after it is cleared.
  finally{busy=false;if(frames.length){relayout();render();}}
 }
 function reorder(list){
  const order=new Map(list.map((f,i)=>[f.id,i])),paired=frames.map((f,i)=>[f,sources[i]]).sort((a,b)=>order.get(a[0].id)-order.get(b[0].id));
  frames=paired.map(p=>p[0]);sources=paired.map(p=>p[1]);
 }
 function remove(id){
  const index=frames.findIndex(f=>String(f.id)===String(id));if(index<0)return;
  Im.release(sources[index].canvas);sources.splice(index,1);frames.splice(index,1);
  if(!frames.length)return clear();
  tick=0;relayout();render();
 }
 function clear(){
  for(const s of sources)Im.release(s.canvas);
  sources=[];frames=[];layout=null;error='';cancelAnimationFrame(raf);empty();
 }
 async function sample(){
  const out=[];
  for(let i=0;i<4;i++){
   const w=18+i*3,c=Im.canvas(w+6,26+i),x=c.getContext('2d');
   x.fillStyle='#2b3a67';x.fillRect(3,8,w-6,12+i);x.fillStyle='#f4c095';x.fillRect(4,1,w-8,7);
   out.push(new File([await Im.blobOf(c)],`frame_${i+1}.png`,{type:'image/png'}));Im.release(c);
  }
  return out;
 }
 async function frameFiles(){
  const list=[];
  for(const [i,f] of frames.entries()){
   const c=renderFrame(sourceOf(f,i),f);
   try{list.push(new File([await Im.blobOf(c)],`frames/frame-${frameNumber(i,frames.length)}.png`,{type:'image/png'}));}finally{Im.release(c);}
   await yieldUI();
  }
  return list;
 }
 async function run(){
  if(busy||!frames.length||error)return;busy=true;renderSummary();
  try{
   const files=await frameFiles(),entries=files.map(f=>({name:f.name,blob:f}));
   entries.push({name:'metadata.json',blob:new Blob([JSON.stringify({
    ...F.metadata(frames,{tool:'nerulio-frame-normalize',sourceWidth:layout.width,sourceHeight:layout.height,mode:'normalize',fps:o.fps,prefix:'frame',
     extra:{align:o.align,anchor:ANCHOR_X[o.anchorX],padding:o.padding,trimmed:o.trim}}),
    frames:frames.map((f,i)=>({name:`frames/frame-${frameNumber(i,frames.length)}.png`,index:i,source:f.name,
     x:0,y:0,w:f.canvasWidth,h:f.canvasHeight,sourceRect:F.boxOf(f),offset:{x:f.offsetX,y:f.offsetY},
     canvasWidth:f.canvasWidth,canvasHeight:f.canvasHeight,offsetX:f.offsetX,offsetY:f.offsetY,pivotX:f.pivotX,pivotY:f.pivotY})),
    frameWidth:layout.width,frameHeight:layout.height},null,2)],{type:'application/json'})});
   const blob=await zip(entries,{paths:true});download(blob,`${stem(frames[0].name)||'frames'}-normalized.zip`);
   track('tool_success',{intent:route.id});toast(T('done',{n:frames.length,size:bytes(blob.size)}));
  }catch(e){toast(e?.message||String(e),{error:true});}
  finally{busy=false;renderSummary();}
 }
 function readOptions(){
  const before=JSON.stringify(o),next={...o};
  for(const input of el.querySelectorAll('[data-num]'))next[input.dataset.num]=Math.max(Number(input.min),Math.min(Number(input.max),Math.round(Number(input.value)||0)));
  for(const input of el.querySelectorAll('[data-check]'))next[input.dataset.check]=input.checked;
  o=next;el.querySelector('#normSizeFields').hidden=o.size!=='exact';
  return JSON.stringify(o)!==before;
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='norm-sample')add(await sample());
  else if(a==='norm-set'){
   o={...o,[b.dataset.key]:b.dataset.value};
   for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
   el.querySelector('#normSizeFields').hidden=o.size!=='exact';relayout();render();
  }
  else if(a==='norm-view'){view=b.dataset.value;for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));renderGrid();}
  else if(a==='norm-remove')remove(b.dataset.id);
  else if(a==='norm-sort'){reorder([...frames].sort(natural));relayout();render();}
  else if(a==='norm-play')playing=!playing;
  else if(a==='norm-clear')clear();
  else if(a==='norm-download')run();
  else if(a==='norm-next'){const tool=b.dataset.tool;b.disabled=true;try{await continueWith(tool,await frameFiles());}finally{b.disabled=false;}}
 });
 el.addEventListener('input',e=>{
  if(e.target.id==='normFps'){o.fps=Number(e.target.value)||12;el.querySelector('#normFpsOut').textContent=o.fps;return;}
  if(!e.target.closest('#normOptions'))return;
  clearTimeout(timer);timer=setTimeout(()=>{if(readOptions()){relayout();render();}},250);
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();}});
 el.addEventListener('dragstart',e=>{const row=e.target.closest?.('.file');if(!row)return;dragId=row.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);});
 el.addEventListener('dragover',e=>{if(dragId){e.preventDefault();e.stopPropagation();}});
 el.addEventListener('drop',e=>{
  if(!dragId)return;e.preventDefault();e.stopPropagation();
  const row=e.target.closest?.('.file'),from=frames.findIndex(f=>String(f.id)===dragId);dragId=null;
  if(!row||from<0)return;
  const list=[...frames],[moved]=list.splice(from,1),to=list.findIndex(f=>String(f.id)===row.dataset.id),r=row.getBoundingClientRect();
  list.splice(Math.max(0,to)+(e.clientY>r.top+r.height/2?1:0),0,moved);reorder(list);relayout();render();
 });
 el.addEventListener('dragend',()=>{dragId=null;});
 onLocale(()=>{if(!frames.length){empty();return;}frame();relayout();render();});
 empty();
 return {add};
}
