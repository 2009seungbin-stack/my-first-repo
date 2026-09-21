import * as Im from '../image.js';
import {stem} from '../core.js';
import {createBatch} from './batch.js';
import {text} from './shell.js';
import {AI_MODELS} from '../ai-models.js';
import {borderColor} from '../color-background.js';
/** Background remover: drop photos and the cut-out appears — no Run button. The AI model (or the
 * solid-colour flood fill) runs once per photo; changing the new background, trimming or the file
 * format only re-composes the cached cut-out. "Touch up" opens an erase/restore brush. */
export const accept='image/*,.heic,.heif';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v.toLowerCase():'';
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
// On a metered or data-saving connection the 190 MB model is never fetched unless the person asks for it.
const metered=()=>{const c=navigator.connection;return !!(c&&(c.saveData||c.type==='cellular'||/(^|-)2g$/.test(c.effectiveType||'')));};
function options(q){
 const mode=q.get('mode')==='solid'||q.get('mode')==='color'?'color':'ai',bg=['none','white','black','custom','blur'].includes(q.get('bg'))?q.get('bg'):'none';
 // `background` is the name the Free-plan meter reads: only the AI model counts as a heavy job.
 return {mode,background:mode==='ai'?'general':'solid',bg,color:hex(q.get('color'))||'#2f80ff',quality:['best','fast'].includes(q.get('quality'))?q.get('quality'):metered()?'fast':'best',refine:true,cleanup:true,key:'auto',keyColor:'#ffffff',tolerance:Math.max(0,Math.min(441,Number(q.get('tolerance'))||40)),trim:false,padding:0,format:'png'};
}
const chips=(id,key,rows,current)=>`<div class="segmented" role="group" id="${id}">${rows.map(([v,label,style])=>`<button type="button" data-action="task-option" data-${key}="${v}" aria-pressed="${current===v}"${style?` class="swatch" style="${style}"`:''}>${esc(label)}</button>`).join('')}</div>`;
const simple=o=>`<span class="opt-label">${esc(text('bg.method'))}</span>${chips('bgMode','mode',[['ai',text('bg.ai')],['color',text('bg.solid')]],o.mode)}
<span class="opt-label">${esc(text('bg.newBackground'))}</span>${chips('bgFill','bg',[['none',text('bg.none')],['white',text('bg.white')],['black',text('bg.black')],['custom',text('bg.custom')],['blur',text('bg.blur')]],o.bg)}
<label class="field inline" id="bgColorField" ${o.bg==='custom'?'':'hidden'}><span>${esc(text('bg.color'))}</span><input id="bgColor" type="color" value="${o.color}"></label>`;
const advanced=o=>`<div id="bgAiFields" ${o.mode==='ai'?'':'hidden'}><label class="field"><span>${esc(text('bg.quality'))}</span><select id="bgQuality"><option value="best">${esc(text('bg.qualityBest'))}</option><option value="fast" ${o.quality==='fast'?'selected':''}>${esc(text('bg.qualityFast'))}</option></select></label><label class="check"><input id="bgRefine" type="checkbox" ${o.refine?'checked':''}> ${esc(text('bg.refine'))}</label><label class="check"><input id="bgCleanup" type="checkbox" ${o.cleanup?'checked':''}> ${esc(text('bg.cleanup'))}</label></div>
<div id="bgColorFields" ${o.mode==='color'?'':'hidden'}><label class="field"><span>${esc(text('bg.key'))}</span><select id="bgKey"><option value="auto">${esc(text('bg.keyAuto'))}</option><option value="custom" ${o.key==='custom'?'selected':''}>${esc(text('bg.keyCustom'))}</option></select></label><label class="field inline" id="bgKeyColorField" ${o.key==='custom'?'':'hidden'}><span>${esc(text('bg.color'))}</span><input id="bgKeyColor" type="color" value="${o.keyColor}"></label><label class="field"><span>${esc(text('bg.tolerance'))}</span><input id="bgTolerance" type="range" min="0" max="200" value="${Math.min(200,o.tolerance)}"></label></div>
<label class="check"><input id="bgTrim" type="checkbox" ${o.trim?'checked':''}> ${esc(text('bg.trim'))}</label>
<div class="field-row"><label class="field"><span>${esc(text('bg.padding'))}</span><input id="bgPadding" type="number" min="0" max="2000" value="${o.padding}" inputmode="numeric"></label><label class="field"><span>${esc(text('bg.format'))}</span><select id="bgFormat">${[['png','PNG'],['webp','WebP'],['jpeg','JPG']].map(([v,l])=>`<option value="${v}" ${o.format===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
<p class="hint" id="bgJpegHint" ${o.format==='jpeg'&&o.bg==='none'?'':'hidden'}>${esc(text('bg.jpegHint'))}</p>`;
function read(form,o){
 const pressed=(id,key)=>form.querySelector(`#${id} [aria-pressed="true"]`)?.dataset[key],mode=pressed('bgMode','mode')||o.mode;
 return {mode,background:mode==='ai'?'general':'solid',bg:pressed('bgFill','bg')||o.bg,color:hex(form.querySelector('#bgColor').value)||o.color,quality:form.querySelector('#bgQuality').value,refine:form.querySelector('#bgRefine').checked,cleanup:form.querySelector('#bgCleanup').checked,key:form.querySelector('#bgKey').value,keyColor:hex(form.querySelector('#bgKeyColor').value)||o.keyColor,tolerance:Number(form.querySelector('#bgTolerance').value),trim:form.querySelector('#bgTrim').checked,padding:Math.max(0,Math.min(2000,Math.round(Number(form.querySelector('#bgPadding').value)||0))),format:form.querySelector('#bgFormat').value};
}
function reflect(form,o){
 form.querySelector('#bgColorField').hidden=o.bg!=='custom';form.querySelector('#bgAiFields').hidden=o.mode!=='ai';form.querySelector('#bgColorFields').hidden=o.mode!=='color';
 form.querySelector('#bgKeyColorField').hidden=o.key!=='custom';form.querySelector('#bgJpegHint').hidden=!(o.format==='jpeg'&&o.bg==='none');
}
// The backdrop colour is read off the border: src/color-background.js, shared with the sprite slicer.
export {borderColor};
// Cut-outs are kept for the few photos someone is actively working on; older ones are recomputed.
const cuts=new Map(),edits=new WeakMap(),KEEP=4;
const cutKey=o=>o.mode==='ai'?`ai|${o.quality}|${o.refine}|${o.cleanup}`:`color|${o.key==='custom'?o.keyColor:'auto'}|${o.tolerance}`;
function remember(file,key,canvas){
 const old=cuts.get(file);if(old)Im.release(old.canvas);cuts.delete(file);cuts.set(file,{key,canvas});
 while(cuts.size>KEEP){const [first,entry]=cuts.entries().next().value;Im.release(entry.canvas);cuts.delete(first);}
}
/** The full model is a one-time 190 MB download. Until it is in this browser, a 5 MB model answers
 * first (onQuick) so nobody stares at a progress bar; the better cut-out replaces it when ready. */
async function cutout(file,source,o,{signal,progress,onQuick}){
 const key=cutKey(o),hit=cuts.get(file);if(hit?.key===key)return hit.canvas;
 const ai=model=>Im.processPixels(source,'general',{refine:o.refine,cleanup:o.cleanup,model},p=>progress(friendly(p)),signal);let canvas;
 if(o.mode!=='ai')canvas=await Im.processPixels(source,'remove',{color:o.key==='custom'?rgb(o.keyColor):borderColor(source),tolerance:o.tolerance},progress,signal);
 else if(o.quality==='fast')canvas=await ai('quick');
 else{
  const {modelCached}=await import('../onnx-engine.js');
  if(onQuick&&!await modelCached({...AI_MODELS.matte,file:'onnx/model.onnx'})){
   const first=await ai('quick');await onQuick(first);
   try{canvas=await ai('best');Im.release(first);}
   catch(e){if(e?.name==='AbortError'||signal?.aborted){Im.release(first);throw e;}canvas=first;canvas.fellBack=true;}// offline or blocked: the first pass stands
  }else canvas=await ai('best');
 }
 remember(file,key,canvas);return canvas;
}
// Engine progress is written for logs; people get four plain stages instead.
const friendly=p=>/download|fetch|MB|%/i.test(p)?text('bg.stage.model')+(/(\d+)\s*%/.test(p)?` ${p.match(/(\d+)\s*%/)[1]}%`:''):/infer/i.test(p)?text('bg.stage.find'):/refin|tile/i.test(p)?text('bg.stage.edges'):text('bg.stage.prepare');
/** cut-out → brush edits → trim → new background. Returns a new canvas; never touches the cached cut-out. */
function compose(source,cut,edit,o){
 const w=source.width,h=source.height;let out=Im.copy(cut);const ctx=out.getContext('2d');
 if(edit){
  ctx.globalCompositeOperation='destination-out';ctx.drawImage(edit.erase,0,0,w,h);
  const back=Im.canvas(w,h),b=back.getContext('2d');b.drawImage(edit.restore,0,0,w,h);b.globalCompositeOperation='source-in';b.drawImage(source,0,0);
  ctx.globalCompositeOperation='source-over';ctx.drawImage(back,0,0);Im.release(back);
 }
 let box={x:0,y:0,w,h};
 if(o.trim){const d=ctx.getImageData(0,0,w,h).data;let l=w,t=h,r=-1,bt=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>12){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>bt)bt=y;}if(r>=l)box={x:l,y:t,w:r-l+1,h:bt-t+1};}
 const pad=o.trim?o.padding:0,fill=o.bg==='white'?'#ffffff':o.bg==='black'?'#000000':o.bg==='custom'?o.color:o.bg==='none'&&o.format==='jpeg'?'#ffffff':'';
 if(!o.trim&&!fill&&o.bg!=='blur')return out;
 const final=Im.canvas(box.w+pad*2,box.h+pad*2),f=final.getContext('2d');
 if(fill){f.fillStyle=fill;f.fillRect(0,0,final.width,final.height);}
 else if(o.bg==='blur'){const radius=Math.max(6,Math.round(Math.max(w,h)/60));f.filter=`blur(${radius}px)`;
  // Drawn larger than the frame so the blur never fades to transparent at the edges.
  f.drawImage(source,box.x,box.y,box.w,box.h,pad-radius*2,pad-radius*2,box.w+radius*4,box.h+radius*4);f.filter='none';}
 f.drawImage(out,box.x,box.y,box.w,box.h,pad,pad,box.w,box.h);Im.release(out);return final;
}
async function process(file,o,{signal,progress,interim}){
 const source=await Im.decode(file);
 try{
  const cut=await cutout(file,source,o,{signal,progress,onQuick:async first=>interim(await finish(file,source,first,o,true))});
  return await finish(file,source,cut,o,false);
 }finally{Im.release(source);}
}
async function finish(file,source,cut,o,first){
 let final=null;
 try{
  final=compose(source,cut,edits.get(file),o);
  const type=o.format==='jpeg'?'image/jpeg':o.format==='webp'?'image/webp':'image/png',blob=await Im.blobOf(final,type,.95);
  return {blob,name:`${stem(file.name)}-no-bg.${o.format==='jpeg'?'jpg':o.format}`,sourceWidth:final.width,sourceHeight:final.height,sameFrame:final.width===source.width&&final.height===source.height,showResult:true,size:`${final.width}×${final.height}`,
   warn:cut.fellBack?text('bg.bestFailed'):'',
   note:[`${final.width}×${final.height}`,first?text('bg.noteQuick'):o.mode==='ai'?text('bg.noteAi'):text('bg.noteColor'),edits.has(file)?text('bg.noteEdited'):''].filter(Boolean).join(' · ')};
 }finally{Im.release(final);}
}
const summary=ok=>({big:ok.length===1?text('bg.done'):text('bg.doneMany',{n:ok.length}),only:true});
/** Erase / restore brush. Two masks (kept at ≤2048px) record the strokes; a later stroke of one
 * kind clears the other underneath it, so the order of strokes never has to be replayed. */
async function touchUp(it,api,o){
 const file=it.file,source=await Im.decode(file),cut=await cutout(file,source,o,{progress:()=>{}}),W=source.width,H=source.height,ms=Math.min(1,2048/Math.max(W,H)),mw=Math.max(1,Math.round(W*ms)),mh=Math.max(1,Math.round(H*ms));
 const prior=edits.get(file),erase=Im.canvas(mw,mh),restore=Im.canvas(mw,mh);if(prior){erase.getContext('2d').drawImage(prior.erase,0,0);restore.getContext('2d').drawImage(prior.restore,0,0);}
 const vs=Math.min(1,1600/Math.max(W,H)),vw=Math.max(1,Math.round(W*vs)),vh=Math.max(1,Math.round(H*vs)),small=Im.resize(source,vw,vh),smallCut=Im.resize(cut,vw,vh),tmp=Im.canvas(vw,vh);
 const d=document.createElement('dialog');d.className='brush-dialog';
 d.innerHTML=`<div class="brush-bar"><div class="segmented" role="group"><button type="button" data-brush="erase" aria-pressed="true">${esc(text('bg.erase'))}</button><button type="button" data-brush="restore" aria-pressed="false">${esc(text('bg.restore'))}</button></div><label class="brush-size"><span>${esc(text('bg.brush'))}</span><input id="brushSize" type="range" min="4" max="200" value="40"></label><div class="segmented" role="group" id="brushZoom">${[1,2,4].map(z=>`<button type="button" data-zoom="${z}" aria-pressed="${z===1}">${z}×</button>`).join('')}</div><button type="button" class="ghost" data-brush-undo disabled>${esc(text('bg.undo'))}</button><button type="button" class="ghost" data-brush-reset>${esc(text('bg.reset'))}</button><span class="brush-gap"></span><button type="button" class="ghost" data-brush-cancel>${esc(text('bg.cancel'))}</button><button type="button" class="primary" data-brush-done>${esc(text('bg.apply'))}</button></div>
<div class="brush-stage"><canvas id="brushCanvas" width="${vw}" height="${vh}" aria-label="${esc(text('bg.touchUp'))}"></canvas><div class="brush-cursor" hidden></div></div><p class="hint">${esc(text('bg.brushHint'))}</p>`;
 document.body.append(d);
 const view=d.querySelector('#brushCanvas'),ctx=view.getContext('2d'),cursor=d.querySelector('.brush-cursor'),stage=d.querySelector('.brush-stage'),undo=[];let mode='erase',zoom=1,last=null,changed=false;
 const size=()=>Number(d.querySelector('#brushSize').value);
 function paint(){
  ctx.clearRect(0,0,vw,vh);ctx.globalAlpha=.2;ctx.drawImage(small,0,0);ctx.globalAlpha=1;// faint original: shows what Restore can bring back
  const t=tmp.getContext('2d');t.globalCompositeOperation='source-over';t.clearRect(0,0,vw,vh);t.drawImage(smallCut,0,0);t.globalCompositeOperation='destination-out';t.drawImage(erase,0,0,vw,vh);ctx.drawImage(tmp,0,0);
  t.globalCompositeOperation='source-over';t.clearRect(0,0,vw,vh);t.drawImage(restore,0,0,vw,vh);t.globalCompositeOperation='source-in';t.drawImage(small,0,0);ctx.drawImage(tmp,0,0);
 }
 const point=e=>{const r=view.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,px:r.width};};
 function stroke(a,b){
  // Brush size is in screen pixels, so zooming in gives a finer brush on the image.
  const width=size()/b.px*mw;for(const [canvas,op] of [[mode==='erase'?erase:restore,'source-over'],[mode==='erase'?restore:erase,'destination-out']]){const c=canvas.getContext('2d');c.globalCompositeOperation=op;c.strokeStyle=c.fillStyle='#000';c.lineWidth=width;c.lineCap=c.lineJoin='round';c.beginPath();c.moveTo(a.x*mw,a.y*mh);c.lineTo(b.x*mw+.01,b.y*mh+.01);c.stroke();}
  paint();
 }
 const moveCursor=e=>{const r=stage.getBoundingClientRect(),s=size();cursor.hidden=false;cursor.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left+stage.scrollLeft-s/2}px;top:${e.clientY-r.top+stage.scrollTop-s/2}px`;};
 view.addEventListener('pointerdown',e=>{if(e.button)return;view.setPointerCapture(e.pointerId);undo.push([Im.copy(erase),Im.copy(restore)]);if(undo.length>12)undo.shift().forEach(Im.release);d.querySelector('[data-brush-undo]').disabled=false;last=point(e);stroke(last,last);changed=true;});
 view.addEventListener('pointermove',e=>{moveCursor(e);if(!last)return;const p=point(e);stroke(last,p);last=p;});
 for(const name of ['pointerup','pointercancel'])view.addEventListener(name,()=>{last=null;});
 view.addEventListener('pointerleave',()=>{cursor.hidden=true;});
 const close=()=>{d.close();d.remove();for(const c of [small,smallCut,tmp,source,...undo.flat()])Im.release(c);};
 d.addEventListener('cancel',e=>{e.preventDefault();close();Im.release(erase);Im.release(restore);});
 d.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.brush){mode=b.dataset.brush;for(const x of d.querySelectorAll('[data-brush]'))x.setAttribute('aria-pressed',String(x===b));}
  else if(b.dataset.zoom){zoom=Number(b.dataset.zoom);view.style.width=zoom===1?'':`${zoom*100}%`;view.style.maxHeight=zoom===1?'':'none';for(const x of d.querySelectorAll('[data-zoom]'))x.setAttribute('aria-pressed',String(x===b));}
  else if('brushUndo' in b.dataset){const s=undo.pop();if(s){for(const [to,from] of [[erase,s[0]],[restore,s[1]]]){const c=to.getContext('2d');c.globalCompositeOperation='copy';c.drawImage(from,0,0);c.globalCompositeOperation='source-over';Im.release(from);}paint();}b.disabled=!undo.length;changed=true;}
  else if('brushReset' in b.dataset){undo.push([Im.copy(erase),Im.copy(restore)]);d.querySelector('[data-brush-undo]').disabled=false;for(const c of [erase,restore])c.getContext('2d').clearRect(0,0,mw,mh);paint();changed=true;}
  else if('brushCancel' in b.dataset){close();Im.release(erase);Im.release(restore);}
  else if('brushDone' in b.dataset){close();if(!changed){Im.release(erase);Im.release(restore);return;}const old=edits.get(file);if(old){Im.release(old.erase);Im.release(old.restore);}edits.set(file,{erase,restore});api.reprocess(it);}
 });
 paint();d.showModal();
}
export const mount=ctx=>{
 let current=options(new URLSearchParams());
 return createBatch(ctx,{options:q=>current=options(q),simple,advanced,read:(form,o)=>current=read(form,o),reflect,process,summary,pill:it=>it.result.size,detail:it=>it.result.note,compareWhen:it=>!!it.result?.sameFrame,
  viewerActions:it=>`<button type="button" class="chip" data-action="bg-touch-up">${esc(text('bg.touchUp'))}</button>`,
  action:(name,it,api)=>name==='bg-touch-up'&&it?touchUp(it,api,current):null});
};
