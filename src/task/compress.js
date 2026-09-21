import * as Im from '../image.js';
import {supportedFormats} from '../compression.js';
import {bytes,stem} from '../core.js';
import {landingFor} from '../landings.js';
import {createBatch} from './batch.js';
import {text,page} from './shell.js';
/** Image compression task: three plain choices first; codec, target size, max width and
 * exact quality under "Advanced". Uses the existing candidate-search encoder, which decodes
 * every candidate again and scores it (SSIM) instead of trusting a quality number. */
export const accept='image/*';
const LEVELS={small:.6,balanced:.8,high:.92};
// Lowest acceptable similarity per level; the encoder keeps the smallest candidate above it.
const FLOOR={small:.93,balanced:.965,high:.985};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let formats=['png','jpeg','webp'];supportedFormats().then(f=>{formats=f;});
function options(query){
 // A landing page preset (e.g. /image/compress-to-100kb/) applies unless the URL overrides it.
 const q=new URLSearchParams(landingFor(page.landing)?.query||'');for(const [k,v]of query)q.set(k,v);
 const int=(k,max)=>{const n=Number(q.get(k));return Number.isFinite(n)&&n>0?Math.min(max,Math.round(n)):0;};
 const level=Object.hasOwn(LEVELS,q.get('level'))?q.get('level'):'balanced';
 return {level,quality:LEVELS[level],format:['auto','png','jpeg','webp','avif'].includes(q.get('format'))?q.get('format'):'auto',kb:int('kb',102400),width:int('w',65535),shrink:q.get('shrink')==='1',bg:/^#[0-9a-f]{6}$/i.test(q.get('bg')||'')?q.get('bg'):'#ffffff'};
}
const level=(id,o)=>`<button type="button" data-action="task-option" data-level="${id}" aria-pressed="${o.level===id}">${esc(text('compress.'+id))}<small>${esc(text(`compress.${id}Hint`))}</small></button>`;
const simple=o=>`<div class="segmented" role="group" id="compressLevel">${['small','balanced','high'].map(id=>level(id,o)).join('')}</div>`;
const advanced=o=>`<label class="field"><span>${esc(text('compress.format'))}</span><select id="compressFormat"><option value="auto">${esc(text('compress.auto'))}</option>${formats.map(f=>`<option value="${f}">${f==='jpeg'?'JPG':f.toUpperCase()}</option>`).join('')}</select></label>
<label class="field"><span>${esc(text('compress.quality'))} <output id="compressQualityOut">${Math.round(o.quality*100)}</output></span><input id="compressQuality" type="range" min="20" max="100" step="1" value="${Math.round(o.quality*100)}"></label>
<div class="field-row"><label class="field"><span>${esc(text('compress.target'))}</span><input id="compressTarget" type="number" min="0" max="102400" step="10" inputmode="numeric" value="${o.kb}"><small>${esc(text('compress.targetHint'))}</small></label>
<label class="field"><span>${esc(text('compress.maxWidth'))}</span><input id="compressWidth" type="number" min="0" max="65535" step="10" inputmode="numeric" value="${o.width}"><small>${esc(text('compress.maxWidthHint'))}</small></label></div>
<label class="check"><input id="compressShrink" type="checkbox" ${o.shrink?'checked':''}> ${esc(text('compress.shrink'))}</label>
<label class="field inline"><span>${esc(text('compress.bg'))}</span><input id="compressBg" type="color" value="${o.bg}"></label>
<p class="hint">${esc(text('compress.meta'))}</p>`;
function read(form,o){
 const pressed=form.querySelector('#compressLevel [aria-pressed="true"]')?.dataset.level||o.level,slider=Number(form.querySelector('#compressQuality').value)/100;
 // Picking a level moves the slider; moving the slider by hand keeps the level as a label only.
 const quality=pressed!==o.level?LEVELS[pressed]:slider,num=(id,max)=>Math.max(0,Math.min(max,Math.round(Number(form.querySelector(id).value)||0)));
 return {level:pressed,quality,format:form.querySelector('#compressFormat').value,kb:num('#compressTarget',102400),width:num('#compressWidth',65535),shrink:form.querySelector('#compressShrink').checked,bg:form.querySelector('#compressBg').value};
}
function reflect(form,o){form.querySelector('#compressQuality').value=Math.round(o.quality*100);form.querySelector('#compressQualityOut').textContent=Math.round(o.quality*100);}
async function process(file,o,{signal,progress}){
 const source=await Im.decode(file);
 try{
  const r=await Im.encode(source,{format:o.format,quality:o.quality,kb:o.kb,width:o.width,allowShrink:o.shrink,bg:o.bg,minSSIM:o.kb?0:FLOOR[o.level],signal,progress,original:file});
  // Never hand back something bigger than what came in (unless a smaller width was asked for).
  const keep=r.blob.size>=file.size&&!o.width&&(o.format==='auto'||file.type===`image/${o.format}`);
  const blob=keep?file:r.blob,ext=keep?(file.name.match(/\.[^.]+$/)?.[0]||''):'.'+(r.format==='jpeg'?'jpg':r.format);
  const resized=!keep&&(r.w!==source.width||r.h!==source.height);
  return {blob,name:keep?file.name:`${stem(file.name)}-min${ext}`,sourceWidth:source.width,sourceHeight:source.height,
   note:keep?text('compress.kept'):`${bytes(file.size)} → ${bytes(blob.size)} · ${text(resized?'compress.newPixels':'compress.samePixels',{w:resized?r.w:source.width,h:resized?r.h:source.height})}`,
   warn:o.kb&&!r.met&&!keep?text('compress.missed'):''};
 }finally{Im.release(source);}
}
async function sample(){
 const c=Im.canvas(1600,1067),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,1067);g.addColorStop(0,'#7db7ff');g.addColorStop(.6,'#ffd9a8');g.addColorStop(1,'#35506f');x.fillStyle=g;x.fillRect(0,0,1600,1067);
 for(let i=0;i<40;i++){x.fillStyle=`hsla(${200+i*4},60%,${30+i}%,.55)`;x.beginPath();x.moveTo((i*137)%1600,1067);x.lineTo((i*137)%1600+180+i*6,520+(i*53)%380);x.lineTo((i*137)%1600+420+i*5,1067);x.fill();}
 const d=x.getImageData(0,0,1600,1067);let s=7;for(let i=0;i<d.data.length;i+=4){s=(s*1103515245+12345)&0x7fffffff;const n=(s>>16)%24-12;d.data[i]+=n;d.data[i+1]+=n;d.data[i+2]+=n;}x.putImageData(d,0,0);
 try{return new File([await Im.blobOf(c,'image/png')],'nerulio-sample.png',{type:'image/png'});}finally{Im.release(c);}
}
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,reflect,process,sample,advancedOpen:o=>!!(o.kb||o.width||o.format!=='auto')});
