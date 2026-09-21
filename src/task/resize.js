import * as Im from '../image.js';
import {stem} from '../core.js';
import {landingFor,SOCIAL} from '../landings.js';
import {createBatch} from './batch.js';
import {text,page,locale} from './shell.js';
/** Image resize: a percentage or a pixel size first; fit mode, social-media presets,
 * background, output format and "never enlarge" under Advanced. High-quality tiled
 * resampling (Pica mks2013 / Lanczos) via Im.fitQuality / Im.resizeQuality. */
export const accept='image/*,.heic,.heif';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const int=(v,max=65535)=>{const n=Math.round(Number(v));return Number.isFinite(n)&&n>0?Math.min(max,n):0;};
function options(query){
 const q=new URLSearchParams(landingFor(page.landing)?.query||'');for(const [k,v]of query)q.set(k,v);
 const w=int(q.get('w')),h=int(q.get('h')),percent=int(q.get('percent'),1000);
 return {mode:w||h?'size':'percent',percent:percent||50,w,h,fit:['contain','cover','stretch'].includes(q.get('fit'))?q.get('fit'):'contain',bg:/^#[0-9a-f]{6}$/i.test(q.get('bg')||'')?q.get('bg'):'',format:['keep','png','jpeg','webp'].includes(q.get('format'))?q.get('format'):'keep',noEnlarge:q.get('enlarge')!=='1'};
}
const tab=(id,o,label)=>`<button type="button" data-action="task-option" data-mode="${id}" aria-pressed="${o.mode===id}">${esc(label)}</button>`;
const simple=o=>`<div class="segmented" role="group" id="resizeMode">${tab('percent',o,text('resize.byPercent'))}${tab('size',o,text('resize.bySize'))}</div>
<div id="resizePercentRow" class="chips-row" ${o.mode==='percent'?'':'hidden'}>${[75,50,25].map(p=>`<button type="button" class="chip" data-percent="${p}">${p}%</button>`).join('')}<label class="field compact"><input id="resizePercent" type="number" min="1" max="1000" value="${o.percent}" inputmode="numeric" aria-label="%"><span>%</span></label></div>
<div id="resizeSizeRow" class="field-row" ${o.mode==='size'?'':'hidden'}><label class="field"><span>${esc(text('resize.width'))}</span><input id="resizeW" type="number" min="0" max="65535" value="${o.w||''}" placeholder="${esc(text('resize.auto'))}" inputmode="numeric"></label><label class="field"><span>${esc(text('resize.height'))}</span><input id="resizeH" type="number" min="0" max="65535" value="${o.h||''}" placeholder="${esc(text('resize.auto'))}" inputmode="numeric"></label></div>`;
const advanced=o=>`<label class="field"><span>${esc(text('resize.preset'))}</span><select id="resizePreset"><option value="">—</option>${Object.entries(SOCIAL).map(([slug,[name,w,h]])=>`<option value="${w}x${h}">${esc(name[locale()]||name.en)} · ${w}×${h}</option>`).join('')}</select></label>
<label class="field"><span>${esc(text('resize.fit'))}</span><select id="resizeFit">${['contain','cover','stretch'].map(f=>`<option value="${f}" ${o.fit===f?'selected':''}>${esc(text('resize.'+f))}</option>`).join('')}</select><small>${esc(text('resize.fitHint'))}</small></label>
<label class="field"><span>${esc(text('compress.format'))}</span><select id="resizeFormat">${['keep','jpeg','png','webp'].map(f=>`<option value="${f}" ${o.format===f?'selected':''}>${f==='keep'?esc(text('resize.keep')):f==='jpeg'?'JPG':f.toUpperCase()}</option>`).join('')}</select></label>
<label class="check"><input id="resizeNoEnlarge" type="checkbox" ${o.noEnlarge?'checked':''}> ${esc(text('resize.noEnlarge'))}</label>
<label class="field inline"><span>${esc(text('resize.bg'))}</span><input id="resizeBg" type="color" value="${o.bg||'#ffffff'}"><label class="check" style="margin:0"><input id="resizeBgOn" type="checkbox" ${o.bg?'checked':''}> ${esc(text('resize.bgOn'))}</label></label>`;
function read(form,o){
 const mode=form.querySelector('#resizeMode [aria-pressed="true"]')?.dataset.mode||o.mode;
 return {mode,percent:int(form.querySelector('#resizePercent').value,1000)||o.percent,w:int(form.querySelector('#resizeW').value),h:int(form.querySelector('#resizeH').value),fit:form.querySelector('#resizeFit').value,
  bg:form.querySelector('#resizeBgOn').checked?form.querySelector('#resizeBg').value:'',format:form.querySelector('#resizeFormat').value,noEnlarge:form.querySelector('#resizeNoEnlarge').checked};
}
function reflect(form,o){form.querySelector('#resizePercentRow').hidden=o.mode!=='percent';form.querySelector('#resizeSizeRow').hidden=o.mode!=='size';}
/** Extra wiring the generic form sync cannot express: chips and the preset menu fill inputs. */
function wire(el){
 el.addEventListener('click',e=>{const c=e.target.closest('[data-percent]');if(!c)return;const input=el.querySelector('#resizePercent');input.value=c.dataset.percent;input.dispatchEvent(new Event('input',{bubbles:true}));});
 el.addEventListener('change',e=>{if(e.target.id!=='resizePreset'||!e.target.value)return;const [w,h]=e.target.value.split('x');
  el.querySelector('#resizeW').value=w;el.querySelector('#resizeH').value=h;el.querySelector('#resizeFit').value='cover';
  for(const b of el.querySelectorAll('#resizeMode [data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode==='size'));
  el.querySelector('#resizeW').dispatchEvent(new Event('input',{bubbles:true}));});
}
export function target(sw,sh,o){
 let w,h,fit='stretch';
 if(o.mode==='percent'){w=Math.max(1,Math.round(sw*o.percent/100));h=Math.max(1,Math.round(sh*o.percent/100));}
 else if(o.w&&o.h){w=o.w;h=o.h;fit=o.fit;}
 else if(o.w){w=o.w;h=Math.max(1,Math.round(sh*o.w/sw));}
 else if(o.h){h=o.h;w=Math.max(1,Math.round(sw*o.h/sh));}
 else{w=sw;h=sh;}
 if(o.noEnlarge&&(w>sw||h>sh)&&fit==='stretch'){const k=Math.min(sw/w,sh/h);w=Math.max(1,Math.round(w*k));h=Math.max(1,Math.round(h*k));}
 return {w,h,fit};
}
async function process(file,o,{signal,progress}){
 const source=await Im.decode(file);let out=null;
 try{
  const {w,h,fit}=target(source.width,source.height,o);
  out=fit==='stretch'?(w===source.width&&h===source.height?source:await Im.resizeQuality(source,w,h,{signal,progress})):await Im.fitQuality(source,w,h,fit,o.bg||null,{signal,progress});
  const kept=['image/png','image/jpeg','image/webp'].includes(file.type)?file.type.replace('image/',''):'png',format=o.format==='keep'?kept:o.format;
  let flat=null;try{if(format==='jpeg')flat=Im.background(out,o.bg||'#ffffff');
   const blob=await Im.blobOf(flat||out,`image/${format}`,.92);
   return {blob,name:`${stem(file.name)}-${out.width}x${out.height}.${format==='jpeg'?'jpg':format}`,sourceWidth:out.width,sourceHeight:out.height,pixels:`${out.width}×${out.height}`,note:`${source.width}×${source.height} → ${out.width}×${out.height}`};
  }finally{Im.release(flat);}
 }finally{if(out&&out!==source)Im.release(out);Im.release(source);}
}
const summary=ok=>{const sizes=[...new Set(ok.map(i=>i.result.pixels))];return {big:sizes.length===1?sizes[0].replace('×',' × '):text('resize.mixed',{n:sizes.length})};};
const pill=it=>it.result.pixels;
export function mount(ctx){wire(ctx.el);return createBatch(ctx,{options,simple,advanced,read,reflect,process,summary,pill,advancedOpen:o=>o.fit!=='contain'||o.format!=='keep'||!!o.bg});}
