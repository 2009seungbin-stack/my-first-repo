import {PDFWorkspace} from '../pdf.js';
import {blobOf,release,decode,canvas as makeCanvas} from '../image.js';
import {bytes,stem} from '../core.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** PDF editor: add text, signatures, images, whiteout, pen, highlighter and shapes on top of
 * the original pages. Everything is written as native PDF objects by the PDF worker, so the
 * document's own text, vectors and search stay intact. Coordinates are fractions of the page. */
export const accept='application/pdf,.pdf';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TOOLS=['select','text','sign','image','whiteout','pen','highlight','rect','ellipse','line','arrow'];
const ICON={select:'↖',text:'T',sign:'✒',image:'▣',whiteout:'▭',pen:'✎',highlight:'▬',rect:'□',ellipse:'○',line:'／',arrow:'↗'};
const BOXED=m=>['text','image','fill','highlight','rect','ellipse','line'].includes(m.type);
export function mount({el,def}){
 const ws=new PDFWorkspace(),T=(k,v)=>text('edit.'+k,v);
 let current=0,zoom=1,tool='select',selected=null,color='#1a3fd6',stroke=3,fontSize=16,bold=false,busy=false,undoStack=[],redoStack=[],lastSignature=null,renderToken=0,fileName='';
 const pg=()=>ws.pages[current];
 const snap=()=>ws.pages.map(p=>({p,marks:p.marks.map(m=>({...m,points:m.points?.map(q=>[...q])}))}));
 function record(){undoStack.push({order:snap(),current});if(undoStack.length>60)undoStack.shift();redoStack=[];}
 function restore(state){ws.pages=state.order.map(s=>{s.p.marks=s.marks;return s.p;});current=Math.min(state.current,ws.pages.length-1);selected=null;renderAll();}
 function empty(){el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;}
 function frame(){
  el.innerHTML=`<div class="editor"><div class="ed-bar" role="toolbar" aria-label="${esc(T('tools'))}">${TOOLS.map(id=>`<button type="button" class="ed-tool" data-tool="${id}" aria-pressed="${tool===id}" title="${esc(T('tool.'+id))}"><span aria-hidden="true">${ICON[id]}</span><em>${esc(T('tool.'+id))}</em></button>`).join('')}<span class="ed-sep"></span>
<label class="ed-prop" title="${esc(T('color'))}"><input id="edColor" type="color" value="${color}" aria-label="${esc(T('color'))}"></label><label class="ed-prop"><span id="edSizeLabel"></span><input id="edSize" type="number" min="1" max="200" step="1" inputmode="numeric"></label><button type="button" class="ed-tool small" id="edBold" data-action="ed-bold" aria-pressed="false" title="${esc(T('bold'))}"><b>B</b></button>
<span class="ed-sep"></span><button type="button" class="ed-tool small" data-action="ed-undo" title="${esc(T('undo'))}">↶</button><button type="button" class="ed-tool small" data-action="ed-redo" title="${esc(T('redo'))}">↷</button><button type="button" class="ed-tool small danger" data-action="ed-delete" title="${esc(T('deleteObject'))}">🗑</button></div>
<div class="ed-body"><nav class="ed-rail" id="edRail" aria-label="${esc(text('pdf.pages'))}"></nav>
<section class="ed-stage" id="edStage"><div class="ed-page" id="edPage"><canvas id="edCanvas"></canvas><svg id="edSvg" class="ed-svg" xmlns="http://www.w3.org/2000/svg"></svg><div id="edLayer" class="ed-layer"></div><div id="edCapture" class="ed-capture" hidden></div></div></section>
<aside class="side ed-side"><div class="summary" id="edSummary"></div><p class="hint" id="edHint"></p><button type="button" class="primary big" id="edSave" data-action="ed-save"></button><div class="result-box" id="edResult" hidden></div><nav class="next" id="edNext"></nav>
<div class="list-actions"><button type="button" class="link" data-action="ed-organize">${esc(T('organize'))}</button><button type="button" class="link" data-action="ed-close">${esc(T('close'))}</button></div><small class="local-note">${esc(text('local'))}</small></aside></div>
<div class="ed-foot"><button type="button" data-action="ed-prev" aria-label="${esc(T('prev'))}">‹</button><span id="edPageNo"></span><button type="button" data-action="ed-next" aria-label="${esc(T('next'))}">›</button><span class="ed-sep"></span><button type="button" data-action="ed-zoom-out" aria-label="${esc(T('zoomOut'))}">−</button><span id="edZoom"></span><button type="button" data-action="ed-zoom-in" aria-label="${esc(T('zoomIn'))}">+</button><button type="button" data-action="ed-fit">${esc(T('fit'))}</button></div></div>
<dialog id="signDialog" class="sign-dialog"></dialog>`;
 }
 const fitZoom=()=>{const stage=el.querySelector('#edStage'),p=pg();return p?Math.max(.25,Math.min(2.5,(stage.clientWidth-40)/p.logicalW)):1;};
 async function renderPage(){
  const p=pg();if(!p)return;const token=++renderToken,box=el.querySelector('#edPage'),cv=el.querySelector('#edCanvas');
  box.style.width=p.logicalW*zoom+'px';box.style.height=p.logicalH*zoom+'px';
  el.querySelector('#edSvg').setAttribute('viewBox',`0 0 ${p.logicalW} ${p.logicalH}`);renderMarks();renderChrome();
  let c=null;try{c=await ws.render({...p,angle:0,marks:[]},Math.max(p.logicalW,p.logicalH)*zoom*Math.min(2,devicePixelRatio||1),false);if(token!==renderToken)return;cv.width=c.width;cv.height=c.height;cv.getContext('2d').drawImage(c,0,0);}catch(e){if(token===renderToken)toast(e?.message||String(e),{error:true});}finally{release(c);}
 }
 function shape(m,i){
  const p=pg(),W=p.logicalW,H=p.logicalH,sel=i===selected?' class="is-selected"':'',common=`data-index="${i}"${sel} stroke="${m.color||'#172b4d'}" stroke-width="${m.size||3}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  if(m.type==='pen')return `<polyline ${common} points="${m.points.map(([x,y])=>`${x*W},${y*H}`).join(' ')}"/>`;
  if(m.type==='highlight'||m.type==='fill')return `<rect data-index="${i}"${sel} x="${m.x*W}" y="${m.y*H}" width="${m.w*W}" height="${m.h*H}" fill="${m.color}" fill-opacity="${m.type==='highlight'?.3:m.opacity??1}" ${m.type==='fill'?'stroke="#c9d3e0" stroke-width=".6" stroke-dasharray="3 3"':''}/>`;
  if(m.type==='rect')return `<rect ${common} x="${m.x*W}" y="${m.y*H}" width="${m.w*W}" height="${m.h*H}" fill="transparent"/>`;
  if(m.type==='ellipse')return `<ellipse ${common} cx="${(m.x+m.w/2)*W}" cy="${(m.y+m.h/2)*H}" rx="${Math.abs(m.w*W/2)}" ry="${Math.abs(m.h*H/2)}" fill="transparent"/>`;
  if(m.type==='line'){const ax=m.x*W,ay=m.y*H,bx=(m.x+m.w)*W,by=(m.y+m.h)*H,ang=Math.atan2(by-ay,bx-ax),len=Math.max(8,(m.size||3)*4);
   return `<g data-index="${i}"${sel}><line ${common} x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>${m.arrow?[-.45,.45].map(d=>`<line ${common} x1="${bx}" y1="${by}" x2="${bx-len*Math.cos(ang+d)}" y2="${by-len*Math.sin(ang+d)}"/>`).join(''):''}<line data-index="${i}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="transparent" stroke-width="${Math.max(14,(m.size||3)*3)}"/></g>`;}
  return '';
 }
 function renderMarks(){
  const p=pg();if(!p)return;const layer=el.querySelector('#edLayer');
  el.querySelector('#edSvg').innerHTML=p.marks.map((m,i)=>shape(m,i)).join('');
  layer.innerHTML=p.marks.map((m,i)=>m.type==='text'?`<div class="ed-text ${i===selected?'is-selected':''}" data-index="${i}" contenteditable="${tool==='select'||tool==='text'}" spellcheck="false" style="left:${m.x*100}%;top:${m.y*100}%;font-size:${(m.size||16)*zoom}px;color:${m.color||'#172b4d'};font-weight:${m.bold?700:400}">${esc(m.text||'')}</div>`
   :m.type==='image'?`<div class="ed-img ${i===selected?'is-selected':''}" data-index="${i}" style="left:${m.x*100}%;top:${m.y*100}%;width:${m.w*100}%;height:${m.h*100}%"><img src="${m.url}" alt="" draggable="false"></div>`:'').join('');
  const m=selected!==null?p.marks[selected]:null,frameBox=BOXED(m||{})&&m.type!=='text'?`<div class="ed-selection" style="left:${Math.min(m.x,m.x+m.w)*100}%;top:${Math.min(m.y,m.y+m.h)*100}%;width:${Math.abs(m.w)*100}%;height:${Math.abs(m.h)*100}%"><span class="ed-handle" data-handle="se"></span></div>`:'';
  layer.insertAdjacentHTML('beforeend',frameBox);
 }
 function renderRail(){
  el.querySelector('#edRail').innerHTML=ws.pages.map((p,i)=>`<button type="button" class="ed-thumb ${i===current?'is-current':''}" data-page="${i}" aria-label="${esc(text('pdf.pageN',{n:i+1}))}"><img data-rail="${p.id}" alt=""><span>${i+1}</span>${p.marks.length?'<i></i>':''}</button>`).join('');
  ws.pages.forEach(async p=>{if(!p.thumb){let c=null;try{c=await ws.render({...p,angle:0,marks:[]},150,false);p.thumb=URL.createObjectURL(await blobOf(c,'image/jpeg',.7));}catch{return;}finally{release(c);}}const img=el.querySelector(`img[data-rail="${p.id}"]`);if(img)img.src=p.thumb;});
 }
 function renderChrome(){
  const p=pg();if(!p)return;const m=selected!==null?p.marks[selected]:null,isText=(m?.type==='text')||(!m&&tool==='text');
  for(const b of el.querySelectorAll('.ed-tool[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===tool));
  el.querySelector('#edPageNo').textContent=`${current+1} / ${ws.pages.length}`;el.querySelector('#edZoom').textContent=Math.round(zoom*100)+'%';
  el.querySelector('#edSizeLabel').textContent=isText?T('fontSize'):T('thickness');el.querySelector('#edSize').value=isText?(m?.size||fontSize):(m?.size||stroke);
  el.querySelector('#edColor').value=m?.color&&/^#[0-9a-f]{6}$/i.test(m.color)?m.color:color;el.querySelector('#edBold').setAttribute('aria-pressed',String(m?m.bold===true:bold));el.querySelector('#edBold').hidden=!isText;
  el.querySelector('[data-action="ed-delete"]').disabled=selected===null;el.querySelector('[data-action="ed-undo"]').disabled=!undoStack.length;el.querySelector('[data-action="ed-redo"]').disabled=!redoStack.length;
  const count=ws.pages.reduce((s,x)=>s+x.marks.length,0);
  el.querySelector('#edSummary').innerHTML=`<div class="summary-big">${esc(text('pdf.pagesN',{n:ws.pages.length}))}</div><div class="summary-line">${esc(fileName)} · ${esc(T('changes',{n:count}))}</div>`;
  el.querySelector('#edHint').textContent=T('hint.'+tool);el.querySelector('#edSave').textContent=busy?text('pdf.working'):T('save');el.querySelector('#edSave').disabled=busy;
  el.querySelector('#edCapture').hidden=['select','text','sign','image'].includes(tool);el.querySelector('#edPage').dataset.tool=tool;
 }
 const renderAll=()=>{renderRail();renderPage();};
 function select(i){selected=i;renderMarks();renderChrome();}
 function addMark(m,{edit=false}={}){record();pg().marks.push(m);selected=pg().marks.length-1;tool=['pen','highlight'].includes(tool)?tool:'select';el.querySelector('#edResult').hidden=true;renderMarks();renderChrome();renderRailDot();if(edit){const n=el.querySelector(`.ed-text[data-index="${selected}"]`);if(n){n.focus();document.getSelection()?.selectAllChildren(n);}}}
 function renderRailDot(){const b=el.querySelector(`.ed-thumb[data-page="${current}"]`);if(b&&!b.querySelector('i')&&pg().marks.length)b.insertAdjacentHTML('beforeend','<i></i>');}
 /** Pointer position as page fractions; works at any zoom because the page box is measured live. */
 function at(e){const r=el.querySelector('#edPage').getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];}
 async function placeImage(source,{signature=false}={}){
  const p=pg(),ratio=source.height/source.width,w=signature?.3:Math.min(.5,source.width/p.logicalW),h=w*p.logicalW*ratio/p.logicalH;
  addMark({type:'image',image:source,url:URL.createObjectURL(await blobOf(source)),x:(1-w)/2,y:Math.max(.02,(1-h)/2),w,h,signature});
 }
 function signDialog(){
  const d=el.querySelector('#signDialog');let mode='draw',drawn=false;
  d.innerHTML=`<h2>${esc(T('sign.title'))}</h2><div class="segmented" role="group">${['draw','type','upload'].map(m=>`<button type="button" data-sign-mode="${m}" aria-pressed="${m===mode}">${esc(T('sign.'+m))}</button>`).join('')}</div>
<div data-pane="draw"><canvas id="signPad" width="600" height="220" aria-label="${esc(T('sign.draw'))}"></canvas><button type="button" class="link" data-sign-clear>${esc(T('sign.clear'))}</button></div>
<div data-pane="type" hidden><input id="signName" type="text" maxlength="40" placeholder="${esc(T('sign.placeholder'))}"><div class="sign-preview" id="signPreview"></div></div>
<div data-pane="upload" hidden><input id="signFile" type="file" accept="image/*"><label class="check"><input id="signWhite" type="checkbox" checked> ${esc(T('sign.removeWhite'))}</label></div>
<div class="service-actions sign-actions">${lastSignature?`<button type="button" class="ghost" data-sign-reuse>${esc(T('sign.reuse'))}</button>`:''}<button type="button" class="ghost" data-sign-cancel>${esc(T('sign.cancel'))}</button><button type="button" class="primary" data-sign-ok>${esc(T('sign.use'))}</button></div>`;
  const pad=d.querySelector('#signPad'),ctx=pad.getContext('2d');ctx.lineWidth=3.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#14213d';let drawing=false;
  const pos=e=>{const r=pad.getBoundingClientRect();return [(e.clientX-r.left)*pad.width/r.width,(e.clientY-r.top)*pad.height/r.height];};
  pad.onpointerdown=e=>{drawing=true;drawn=true;pad.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...pos(e));};pad.onpointermove=e=>{if(drawing){ctx.lineTo(...pos(e));ctx.stroke();}};pad.onpointerup=()=>{drawing=false;};
  const show=()=>{for(const pane of d.querySelectorAll('[data-pane]'))pane.hidden=pane.dataset.pane!==mode;for(const b of d.querySelectorAll('[data-sign-mode]'))b.setAttribute('aria-pressed',String(b.dataset.signMode===mode));};
  d.querySelector('#signName').oninput=e=>{d.querySelector('#signPreview').textContent=e.target.value;};
  function trim(source,knockout){
   const c=makeCanvas(source.width,source.height),x=c.getContext('2d');x.drawImage(source,0,0);const img=x.getImageData(0,0,c.width,c.height),data=img.data;let l=c.width,t=c.height,r=0,b=0;
   for(let i=0,px=0;i<data.length;i+=4,px++){if(knockout&&data[i]>225&&data[i+1]>225&&data[i+2]>225)data[i+3]=0;if(data[i+3]>24){const X=px%c.width,Y=(px/c.width)|0;if(X<l)l=X;if(X>r)r=X;if(Y<t)t=Y;if(Y>b)b=Y;}}
   if(r<l){release(c);return null;}x.putImageData(img,0,0);const out=makeCanvas(r-l+1,b-t+1);out.getContext('2d').drawImage(c,l,t,out.width,out.height,0,0,out.width,out.height);release(c);return out;
  }
  d.onclick=async e=>{
   const m=e.target.closest('[data-sign-mode]');if(m){mode=m.dataset.signMode;show();return;}
   if(e.target.closest('[data-sign-clear]')){ctx.clearRect(0,0,pad.width,pad.height);drawn=false;return;}
   if(e.target.closest('[data-sign-cancel]')){d.close();tool='select';renderChrome();return;}
   if(e.target.closest('[data-sign-reuse]')){d.close();const copy=makeCanvas(lastSignature.width,lastSignature.height);copy.getContext('2d').drawImage(lastSignature,0,0);await placeImage(copy,{signature:true});return;}
   if(!e.target.closest('[data-sign-ok]'))return;let out=null;
   if(mode==='draw'&&drawn)out=trim(pad,false);
   else if(mode==='type'&&d.querySelector('#signName').value.trim()){const c=makeCanvas(900,240),x=c.getContext('2d');x.fillStyle='#14213d';x.font='italic 110px "Segoe Script","Brush Script MT","Apple Chancery",cursive';x.textBaseline='middle';x.fillText(d.querySelector('#signName').value.trim(),20,120,860);out=trim(c,false);release(c);}
   else if(mode==='upload'&&d.querySelector('#signFile').files[0]){const src=await decode(d.querySelector('#signFile').files[0]);out=trim(src,d.querySelector('#signWhite').checked);release(src);}
   if(!out){toast(T('sign.empty'),{error:true});return;}
   lastSignature=makeCanvas(out.width,out.height);lastSignature.getContext('2d').drawImage(out,0,0);d.close();await placeImage(out,{signature:true});
  };
  show();d.showModal();
 }
 async function add(files){
  if(busy)return;const file=files[0];busy=true;
  try{if(ws.pages.length)await closeDocument(false);frame();await ws.add([file]);fileName=file.name;current=0;selected=null;undoStack=[];redoStack=[];zoom=fitZoom();track('tool_run',{intent:route.id});renderAll();if(files.length>1)toast(T('oneFile'));}
  catch(error){toast(error?.message||String(error),{error:true});empty();}finally{busy=false;if(ws.pages.length)renderChrome();}
 }
 async function closeDocument(toEmpty=true){for(const p of ws.pages){if(p.thumb)URL.revokeObjectURL(p.thumb);for(const m of p.marks)if(m.url)URL.revokeObjectURL(m.url);}await ws.clear();if(toEmpty)empty();}
 async function save(){
  if(busy)return;busy=true;renderChrome();
  try{for(const p of ws.pages)p.marks=p.marks.filter(m=>m.type!=='text'||(m.text||'').trim());
   const blob=await ws.export({},p=>{el.querySelector('#edSave').textContent=p;}),name=`${stem(fileName)}-edited.pdf`;download(blob,name);track('tool_success',{intent:route.id});
   const box=el.querySelector('#edResult');box.hidden=false;box.innerHTML=`<strong>${esc(T('saved'))}</strong><span>${esc(bytes(blob.size))}</span><button type="button" class="ghost" data-action="ed-again">${esc(text('pdf.again'))}</button>`;box._blob=blob;box._name=name;
   el.querySelector('#edNext').innerHTML=`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="ed-next-tool" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
  }catch(error){toast(error?.message||String(error),{error:true});track('tool_error',{intent:route.id,error_code:'processing_failed'});}finally{busy=false;renderMarks();renderChrome();}
 }
 // ---- pointer interaction: draw with the capture layer, move/resize/select on the object layer
 let drag=null;
 el.addEventListener('pointerdown',e=>{
  if(!ws.pages.length||busy)return;const cap=e.target.closest('#edCapture'),handle=e.target.closest('.ed-handle'),obj=e.target.closest('[data-index]'),inPage=e.target.closest('#edPage');
  if(cap){const [x,y]=at(e);record();const p=pg(),base={color,size:stroke};
   const m=tool==='pen'?{type:'pen',points:[[x,y]],...base}:tool==='highlight'?{type:'highlight',x,y,w:0,h:0,color:color==='#1a3fd6'?'#ffd400':color}:tool==='whiteout'?{type:'fill',x,y,w:0,h:0,color:'#ffffff',opacity:1}:{type:tool==='arrow'?'line':tool,x,y,w:0,h:0,arrow:tool==='arrow',...base};
   p.marks.push(m);selected=p.marks.length-1;drag={kind:'create',m,x,y};cap.setPointerCapture(e.pointerId);renderMarks();e.preventDefault();return;}
  if(handle&&selected!==null){record();const m=pg().marks[selected];drag={kind:'resize',m,ratio:m.type==='image'?m.h/m.w:0};handle.setPointerCapture(e.pointerId);e.preventDefault();return;}
  if(obj&&tool==='select'){const i=Number(obj.dataset.index),m=pg().marks[i];if(selected!==i)select(i);
   if(m.type==='text'&&document.activeElement===obj)return;// typing, not dragging
   const [x,y]=at(e);drag={kind:'move',m,x,y,moved:false,start:{x:m.x,y:m.y,points:m.points?.map(q=>[...q])}};return;}
  if(tool==='text'&&e.target.closest('.ed-text')){select(Number(e.target.closest('.ed-text').dataset.index));return;}
  if(inPage&&tool==='text'){const [x,y]=at(e);e.preventDefault();addMark({type:'text',text:'',x,y:Math.max(0,y-fontSize/pg().logicalH/2),size:fontSize,color,bold},{edit:true});return;}
  if(inPage&&tool==='select'&&selected!==null&&!obj){select(null);}
 });
 el.addEventListener('pointermove',e=>{
  if(!drag)return;const [x,y]=at(e),m=drag.m;
  if(drag.kind==='create'){if(m.type==='pen'){const last=m.points.at(-1);if(Math.hypot(x-last[0],y-last[1])>.002)m.points.push([x,y]);}else{m.w=x-drag.x;m.h=y-drag.y;if(m.type!=='line'){m.x=Math.min(x,drag.x);m.y=Math.min(y,drag.y);m.w=Math.abs(m.w);m.h=Math.abs(m.h);}}}
  else if(drag.kind==='move'){const dx=x-drag.x,dy=y-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<.004)return;if(!drag.moved){record();drag.moved=true;}if(m.points)m.points=drag.start.points.map(([px,py])=>[px+dx,py+dy]);else{m.x=drag.start.x+dx;m.y=drag.start.y+dy;}}
  else if(drag.kind==='resize'){if(m.type==='line'){m.w=x-m.x;m.h=y-m.y;}else{m.w=Math.max(.01,x-m.x);m.h=drag.ratio?m.w*pg().logicalW*drag.ratio/pg().logicalH:Math.max(.01,y-m.y);}}
  renderMarks();
 });
 addEventListener('pointerup',()=>{
  if(!drag)return;const {kind,m}=drag;drag=null;if(!ws.pages.length)return;
  if(kind==='create'){const tiny=m.type==='pen'?m.points.length<2:Math.hypot(m.w,m.h)<.006;if(tiny){pg().marks.pop();undoStack.pop();selected=null;}else{if(!['pen','highlight'].includes(tool))tool='select';el.querySelector('#edResult').hidden=true;renderRailDot();}}
  renderMarks();renderChrome();
 });
 el.addEventListener('input',e=>{
  const node=e.target.closest?.('.ed-text');if(node){const m=pg().marks[Number(node.dataset.index)];if(m){if(!node.dataset.dirty){record();node.dataset.dirty='1';}m.text=node.innerText.replace(/\n$/,'');}return;}
  const m=selected!==null?pg()?.marks[selected]:null;
  if(e.target.id==='edColor'){color=e.target.value;if(m){record();m.color=color;renderMarks();}}
  if(e.target.id==='edSize'){const v=Math.max(1,Math.min(200,Number(e.target.value)||1));if(m?.type==='text'||(!m&&tool==='text')){fontSize=v;}else stroke=v;if(m&&'size' in m||m?.type==='text'){record();m.size=v;renderMarks();}}
 });
 el.addEventListener('focusout',e=>{const node=e.target.closest?.('.ed-text');if(!node)return;delete node.dataset.dirty;const i=Number(node.dataset.index),m=pg()?.marks[i];if(m&&!(m.text||'').trim()){pg().marks.splice(i,1);if(selected===i)selected=null;renderMarks();renderChrome();}});
 el.addEventListener('click',async e=>{
  const toolButton=e.target.closest('.ed-tool[data-tool]');
  if(toolButton){tool=toolButton.dataset.tool;selected=null;renderMarks();renderChrome();if(tool==='sign')signDialog();if(tool==='image'){const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{if(input.files[0]){try{await placeImage(await decode(input.files[0]));}catch(err){toast(err?.message||String(err),{error:true});}}tool='select';renderChrome();};input.click();}return;}
  const thumb=e.target.closest('.ed-thumb');if(thumb){current=Number(thumb.dataset.page);selected=null;renderRail();renderPage();return;}
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='ed-prev'||a==='ed-next'){const next=Math.max(0,Math.min(ws.pages.length-1,current+(a==='ed-prev'?-1:1)));if(next!==current){current=next;selected=null;renderRail();renderPage();}}
  else if(a==='ed-zoom-in'||a==='ed-zoom-out'){zoom=Math.max(.25,Math.min(4,zoom*(a==='ed-zoom-in'?1.2:1/1.2)));renderPage();}
  else if(a==='ed-fit'){zoom=fitZoom();renderPage();}
  else if(a==='ed-undo'&&undoStack.length){redoStack.push({order:snap(),current});restore(undoStack.pop());}
  else if(a==='ed-redo'&&redoStack.length){undoStack.push({order:snap(),current});restore(redoStack.pop());}
  else if(a==='ed-delete'&&selected!==null){record();const [m]=pg().marks.splice(selected,1);if(m?.url)URL.revokeObjectURL(m.url);selected=null;renderMarks();renderChrome();}
  else if(a==='ed-bold'){const m=selected!==null?pg().marks[selected]:null;if(m?.type==='text'){record();m.bold=!m.bold;renderMarks();}else bold=!bold;renderChrome();}
  else if(a==='ed-save')save();
  else if(a==='ed-again'){const box=el.querySelector('#edResult');download(box._blob,box._name);}
  else if(a==='ed-next-tool'){const box=el.querySelector('#edResult');continueWith(b.dataset.tool,[new File([box._blob],box._name,{type:'application/pdf'})]);}
  else if(a==='ed-organize'){const blob=await ws.export({});continueWith('pdf-merge',[new File([blob],fileName,{type:'application/pdf'})]);}
  else if(a==='ed-close'){await closeDocument();}
 });
 el.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  if(!ws.pages.length)return;const typing=e.target.matches('input,textarea,[contenteditable="true"]');
  if(e.key==='Escape'){if(typing)e.target.blur();tool='select';select(null);return;}
  if(typing)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();el.querySelector(e.shiftKey?'[data-action="ed-redo"]':'[data-action="ed-undo"]').click();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();el.querySelector('[data-action="ed-redo"]').click();}
  else if((e.key==='Delete'||e.key==='Backspace')&&selected!==null){e.preventDefault();el.querySelector('[data-action="ed-delete"]').click();}
  else if(selected!==null&&e.key.startsWith('Arrow')){e.preventDefault();const m=pg().marks[selected],d=(e.shiftKey?10:1)/pg().logicalW,dx=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,dy=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0;record();if(m.points)m.points=m.points.map(([x,y])=>[x+dx,y+dy]);else{m.x+=dx;m.y+=dy;}renderMarks();}
  else if(e.key==='PageDown'||e.key==='PageUp'){e.preventDefault();el.querySelector(e.key==='PageDown'?'[data-action="ed-next"]':'[data-action="ed-prev"]').click();}
 });
 onLocale(()=>{if(!ws.pages.length){empty();return;}frame();renderAll();});
 empty();
 return {add,get workspace(){return ws;}};
}
