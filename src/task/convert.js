import * as Im from '../image.js';
import {supportedFormats,hasAlpha} from '../compression.js';
import {bytes,stem} from '../core.js';
import {intentDefaults} from '../intents.js';
import {createBatch} from './batch.js';
import {text,page,locale} from './shell.js';
import {say,attachStyles} from './image-extras.js';
/** Image format conversion (also serves HEIC → JPG): pick the target format, everything
 * else is optional. Inputs are whatever the browser or the HEIC decoder can open. */
export const accept='image/*,.heic,.heif';
const NAMES={jpeg:'JPG',png:'PNG',webp:'WebP',avif:'AVIF'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// "probed" turns true once the real encoders have been tried, so a missing format is reported, not guessed.
let formats=['png','jpeg','webp'],probed=false;supportedFormats().then(f=>{formats=f;probed=true;});
const L=(key,vars)=>say(locale(),key,vars);
function options(query){
 // intentDefaults already resolves landing presets, the old alias routes (/png-to-webp/) and ?format=.
 const q=query,asked=intentDefaults(page.id,page.path,'?'+query.toString()).format,fallback=page.id==='heic'?'jpeg':'png';
 const quality=Number(q.get('quality'));
 return {format:Object.hasOwn(NAMES,asked)?asked:fallback,quality:quality>=20&&quality<=100?quality/100:.92,bg:/^#[0-9a-f]{6}$/i.test(q.get('bg')||'')?q.get('bg'):'#ffffff'};
}
// JPG has no transparency, so the fill colour is offered right under the format instead of only in Advanced.
const FILLS=['#ffffff','#000000'],fillOf=bg=>FILLS.includes(bg.toLowerCase())?bg.toLowerCase():'custom';
const fills=o=>`<div class="it-chips" role="group" id="convertFill" aria-label="${esc(text('compress.bg'))}" ${o.format==='jpeg'?'':'hidden'}><span class="it-label" aria-hidden="true">${esc(text('compress.bg'))}</span>${[['#ffffff',text('bg.white')],['#000000',text('bg.black')],['custom',text('bg.custom')]].map(([v,label])=>`<button type="button" class="chip" data-fill="${v}" aria-pressed="${fillOf(o.bg)===v}">${esc(label)}</button>`).join('')}</div>`;
const simple=o=>`<div class="segmented" role="group" id="convertFormat">${formats.map(f=>`<button type="button" data-action="task-option" data-format="${f}" aria-pressed="${o.format===f}">${NAMES[f]}<small>${esc(text('convert.'+f))}</small></button>`).join('')}</div>${fills(o)}`;
const advanced=o=>`<label class="field"><span>${esc(text('compress.quality'))} <output id="convertQualityOut">${Math.round(o.quality*100)}</output></span><input id="convertQuality" type="range" min="20" max="100" step="1" value="${Math.round(o.quality*100)}" aria-describedby="convertQualityNote" ${o.format==='png'?'disabled':''}><small id="convertQualityNote">${esc(o.format==='png'?L('pngLossless'):text('convert.qualityHint'))}</small></label>
<label class="field inline"><span>${esc(text('compress.bg'))}</span><input id="convertBg" type="color" value="${o.bg}"></label><p class="hint">${esc(text('convert.alpha'))}</p><p class="hint">${esc(text('convert.meta'))}</p><p class="hint" id="convertNoAvif" ${probed&&!formats.includes('avif')?'':'hidden'}>${esc(L('noAvif'))}</p>`;
const read=(form,o)=>({format:form.querySelector('#convertFormat [aria-pressed="true"]')?.dataset.format||o.format,quality:Number(form.querySelector('#convertQuality').value)/100,bg:form.querySelector('#convertBg').value});
const reflect=(form,o)=>{form.querySelector('#convertQualityOut').textContent=Math.round(o.quality*100);
 form.querySelector('#convertFill').hidden=o.format!=='jpeg';for(const c of form.querySelectorAll('#convertFill [data-fill]'))c.setAttribute('aria-pressed',String(c.dataset.fill===fillOf(o.bg)));
 // PNG ignores the quality value: say so instead of offering a slider that does nothing.
 form.querySelector('#convertQuality').disabled=o.format==='png';form.querySelector('#convertQualityNote').textContent=o.format==='png'?L('pngLossless'):text('convert.qualityHint');};
async function process(file,o,{signal}={}){
 const source=await Im.decode(file);let flat=null;
 try{
  // Only report a fill when there really was transparency to lose.
  const filled=o.format==='jpeg'&&await hasAlpha(source,signal);
  if(o.format==='jpeg')flat=Im.background(source,o.bg);// JPG has no transparency
  const blob=await Im.blobOf(flat||source,`image/${o.format}`,o.quality);
  return {blob,name:`${stem(file.name)}.${o.format==='jpeg'?'jpg':o.format}`,sourceWidth:source.width,sourceHeight:source.height,note:`${(file.name.match(/\.([^.]+)$/)?.[1]||'?').toUpperCase()} → ${NAMES[o.format]} · ${source.width}×${source.height} · ${bytes(file.size)} → ${bytes(blob.size)}`,
   warn:[filled?L('alphaFilled',{bg:o.bg.toUpperCase()}):'',blob.size>file.size?L('grew',{f:NAMES[o.format],a:bytes(file.size),b:bytes(blob.size)}):''].filter(Boolean).join(' ')};
 }finally{Im.release(flat);Im.release(source);}
}
const summary=ok=>({big:'→ '+NAMES[ok[0].result.blob.type.replace('image/','')]});
const pill=it=>NAMES[it.result.blob.type.replace('image/','')];
/** White and black write the colour field; "custom" opens Advanced and hands focus to the colour picker. */
function wire(el){
 el.addEventListener('click',e=>{const c=e.target.closest('#convertFill [data-fill]');if(!c)return;const input=el.querySelector('#convertBg');if(!input)return;
  if(c.dataset.fill==='custom'){el.querySelector('#optionsAdvanced').open=true;input.focus();return;}
  input.value=c.dataset.fill;for(const s of el.querySelectorAll('#convertFill [data-fill]'))s.setAttribute('aria-pressed',String(s===c));
  input.dispatchEvent(new Event('input',{bubbles:true}));});
}
export function mount(ctx){
 attachStyles();wire(ctx.el);
 // If the options were drawn before the encoder probe finished, settle the AVIF notice when it does.
 supportedFormats().then(f=>{const n=ctx.el.querySelector('#convertNoAvif');if(n)n.hidden=f.includes('avif');});
 return createBatch(ctx,{options,simple,advanced,read,reflect,process,summary,pill});}
