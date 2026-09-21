import * as Im from '../image.js';
import {supportedFormats} from '../compression.js';
import {stem} from '../core.js';
import {intentDefaults} from '../intents.js';
import {createBatch} from './batch.js';
import {text,page} from './shell.js';
/** Image format conversion (also serves HEIC → JPG): pick the target format, everything
 * else is optional. Inputs are whatever the browser or the HEIC decoder can open. */
export const accept='image/*,.heic,.heif';
const NAMES={jpeg:'JPG',png:'PNG',webp:'WebP',avif:'AVIF'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let formats=['png','jpeg','webp'];supportedFormats().then(f=>{formats=f;});
function options(query){
 // intentDefaults already resolves landing presets, the old alias routes (/png-to-webp/) and ?format=.
 const q=query,asked=intentDefaults(page.id,page.path,'?'+query.toString()).format,fallback=page.id==='heic'?'jpeg':'png';
 const quality=Number(q.get('quality'));
 return {format:Object.hasOwn(NAMES,asked)?asked:fallback,quality:quality>=20&&quality<=100?quality/100:.92,bg:/^#[0-9a-f]{6}$/i.test(q.get('bg')||'')?q.get('bg'):'#ffffff'};
}
const simple=o=>`<div class="segmented" role="group" id="convertFormat">${formats.map(f=>`<button type="button" data-action="task-option" data-format="${f}" aria-pressed="${o.format===f}">${NAMES[f]}<small>${esc(text('convert.'+f))}</small></button>`).join('')}</div>`;
const advanced=o=>`<label class="field"><span>${esc(text('compress.quality'))} <output id="convertQualityOut">${Math.round(o.quality*100)}</output></span><input id="convertQuality" type="range" min="20" max="100" step="1" value="${Math.round(o.quality*100)}"><small>${esc(text('convert.qualityHint'))}</small></label>
<label class="field inline"><span>${esc(text('compress.bg'))}</span><input id="convertBg" type="color" value="${o.bg}"></label><p class="hint">${esc(text('convert.alpha'))}</p><p class="hint">${esc(text('compress.meta'))}</p>`;
const read=(form,o)=>({format:form.querySelector('#convertFormat [aria-pressed="true"]')?.dataset.format||o.format,quality:Number(form.querySelector('#convertQuality').value)/100,bg:form.querySelector('#convertBg').value});
const reflect=(form,o)=>{form.querySelector('#convertQualityOut').textContent=Math.round(o.quality*100);};
async function process(file,o){
 const source=await Im.decode(file);let flat=null;
 try{
  if(o.format==='jpeg')flat=Im.background(source,o.bg);// JPG has no transparency
  const blob=await Im.blobOf(flat||source,`image/${o.format}`,o.quality);
  return {blob,name:`${stem(file.name)}.${o.format==='jpeg'?'jpg':o.format}`,sourceWidth:source.width,sourceHeight:source.height,note:`${(file.name.match(/\.([^.]+)$/)?.[1]||'?').toUpperCase()} → ${NAMES[o.format]} · ${source.width}×${source.height}`};
 }finally{Im.release(flat);Im.release(source);}
}
const summary=ok=>({big:'→ '+NAMES[ok[0].result.blob.type.replace('image/','')]});
const pill=it=>NAMES[it.result.blob.type.replace('image/','')];
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,reflect,process,summary,pill});
