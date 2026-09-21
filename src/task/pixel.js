import * as Im from '../image.js';
import {parsePalette} from '../pixel-engine.js';
import {stem} from '../core.js';
import {createBatch} from './batch.js';
import {text} from './shell.js';
/** Pixel-art converter: pick a sprite size and a colour count and watch the result; palettes
 * (classic consoles, popular community palettes or your own), dithering, outline, fit and
 * export scale under Advanced. Uses the perceptual (Oklab) quantiser in src/pixel-engine.js. */
export const accept='image/*,.heic,.heif';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PALETTES=Object.freeze({
 gameboy:['#0f380f','#306230','#8bac0f','#9bbc0f'],
 pico8:['#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8','#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa'],
 sweetie16:['#1a1c2c','#5d275d','#b13e53','#ef7d57','#ffcd75','#a7f070','#38b764','#257179','#29366f','#3b5dc9','#41a6f6','#73eff7','#f4f4f4','#94b0c2','#566c86','#333c57'],
 endesga32:['#be4a2f','#d77643','#ead4aa','#e4a672','#b86f50','#733e39','#3e2731','#a22633','#e43b44','#f77622','#feae34','#fee761','#63c74d','#3e8948','#265c42','#193c3e','#124e89','#0099db','#2ce8f5','#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466','#262b44','#181425','#ff0044','#68386c','#b55088','#f6757a','#e8b796','#c28569'],
 nes:['#000000','#fcfcfc','#f8f8f8','#bcbcbc','#7c7c7c','#a4e4fc','#3cbcfc','#0078f8','#0000fc','#b8b8f8','#6888fc','#0058f8','#0000bc','#d8b8f8','#9878f8','#6844fc','#4428bc','#f8b8f8','#f878f8','#d800cc','#940084','#f8a4c0','#f85898','#e40058','#a80020','#f0d0b0','#f87858','#f83800','#a81000','#fce0a8','#fca044','#e45c10','#881400','#f8d878','#f8b800','#ac7c00','#503000','#d8f878','#b8f818','#00b800','#007800','#b8f8b8','#58d854','#00a800','#006800','#b8f8d8','#58f898','#00a844','#005800','#00fcfc','#00e8d8','#008888','#004058'],
 mono:['#000000','#ffffff']
});
const int=(v,min,max,fallback)=>{const n=Math.round(Number(v));return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;};
function options(q){
 const n=int(q.get('n'),8,512,32);
 return {n,chipN:[16,32,48,64,128].includes(n)?n:0,colors:int(q.get('colors'),2,256,16),palette:Object.hasOwn(PALETTES,q.get('palette'))?q.get('palette'):'auto',custom:'',dither:Math.max(0,Math.min(1,Number(q.get('dither'))||0)),ditherMode:'floyd-steinberg',outline:int(q.get('outline'),0,4,0),fit:['contain','cover','stretch'].includes(q.get('fit'))?q.get('fit'):'contain',trim:q.get('trim')!=='0',scale:int(q.get('scale'),1,32,1)};
}
const chips=(id,key,values,current,label=v=>v)=>`<div class="segmented" role="group" id="${id}">${values.map(v=>`<button type="button" data-action="task-option" data-${key}="${v}" aria-pressed="${String(current)===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
const simple=o=>`<span class="opt-label">${esc(text('pixel.size'))}</span>${chips('pixelSize','n',[16,32,48,64,128],o.n,v=>`${v}×${v}`)}<span class="opt-label">${esc(text('pixel.colors'))}</span>${chips('pixelColors','colors',[4,8,16,32,64],o.colors)}`;
const advanced=o=>`<label class="field"><span>${esc(text('pixel.palette'))}</span><select id="pixelPalette"><option value="auto">${esc(text('pixel.auto'))}</option>${Object.keys(PALETTES).map(k=>`<option value="${k}" ${o.palette===k?'selected':''}>${esc(text('pixel.palettes.'+k))} (${PALETTES[k].length})</option>`).join('')}<option value="custom" ${o.palette==='custom'?'selected':''}>${esc(text('pixel.custom'))}</option></select></label>
<label class="field" id="pixelCustomField" ${o.palette==='custom'?'':'hidden'}><span>${esc(text('pixel.customHint'))}</span><textarea id="pixelCustom" rows="4" spellcheck="false" placeholder="#1a1c2c&#10;#5d275d&#10;#b13e53">${esc(o.custom)}</textarea></label>
<div class="field-row"><label class="field"><span>${esc(text('pixel.exact'))}</span><input id="pixelN" type="number" min="8" max="512" value="${o.n}" inputmode="numeric"></label><label class="field"><span>${esc(text('pixel.scale'))}</span><select id="pixelScale">${[1,2,4,8,16].map(v=>`<option value="${v}" ${o.scale===v?'selected':''}>${v}×</option>`).join('')}</select></label></div>
<div class="field-row"><label class="field"><span>${esc(text('pixel.dither'))}</span><select id="pixelDitherMode"><option value="none">${esc(text('pixel.ditherNone'))}</option><option value="floyd-steinberg" ${o.dither&&o.ditherMode==='floyd-steinberg'?'selected':''}>Floyd–Steinberg</option><option value="bayer" ${o.dither&&o.ditherMode==='bayer'?'selected':''}>Bayer</option></select></label><label class="field"><span>${esc(text('pixel.outline'))}</span><select id="pixelOutline">${[0,1,2].map(v=>`<option value="${v}" ${o.outline===v?'selected':''}>${v}px</option>`).join('')}</select></label></div>
<label class="field"><span>${esc(text('resize.fit'))}</span><select id="pixelFit">${['contain','cover','stretch'].map(f=>`<option value="${f}" ${o.fit===f?'selected':''}>${esc(text('resize.'+f))}</option>`).join('')}</select></label>
<label class="check"><input id="pixelTrim" type="checkbox" ${o.trim?'checked':''}> ${esc(text('pixel.trim'))}</label>`;
function read(form,o){
 const pressed=(id,key)=>form.querySelector(`#${id} [aria-pressed="true"]`)?.dataset[key],chipN=Number(pressed('pixelSize','n'))||0,typed=int(form.querySelector('#pixelN').value,8,512,o.n);
 // A size chip and the exact-size box describe the same value; whichever changed last wins.
 const n=chipN&&chipN!==o.chipN?chipN:typed,mode=form.querySelector('#pixelDitherMode').value,palette=form.querySelector('#pixelPalette').value;
 return {n,chipN,colors:Number(pressed('pixelColors','colors'))||o.colors,palette,custom:form.querySelector('#pixelCustom').value,dither:mode==='none'?0:1,ditherMode:mode==='none'?o.ditherMode:mode,outline:Number(form.querySelector('#pixelOutline').value),fit:form.querySelector('#pixelFit').value,trim:form.querySelector('#pixelTrim').checked,scale:Number(form.querySelector('#pixelScale').value)};
}
function reflect(form,o){form.querySelector('#pixelN').value=o.n;form.querySelector('#pixelCustomField').hidden=o.palette!=='custom';for(const b of form.querySelectorAll('#pixelSize [data-n]'))b.setAttribute('aria-pressed',String(Number(b.dataset.n)===o.n));}
async function process(file,o,{signal,progress}){
 const palette=o.palette==='auto'?[]:parsePalette(o.palette==='custom'?o.custom:PALETTES[o.palette].join('\n'));
 if(o.palette==='custom'&&!palette.length)throw Error(text('pixel.needPalette'));
 const source=await Im.decode(file);let base=null,pixels=null,scaled=null;
 try{
  base=await Im.pixelBaseQuality(source,o.n,o.fit,o.trim,{progress,signal});
  pixels=await Im.processPixels(base,'pixel',{colors:o.colors,dither:o.dither,outline:o.outline,palette,ditherMode:o.ditherMode},progress,signal);
  if(o.scale>1)scaled=Im.resize(pixels,pixels.width*o.scale,pixels.height*o.scale,true);
  const out=scaled||pixels,blob=await Im.blobOf(out,'image/png');
  return {blob,name:`${stem(file.name)}-${pixels.width}x${pixels.height}${o.scale>1?`@${o.scale}x`:''}.png`,sourceWidth:out.width,sourceHeight:out.height,pixels:`${pixels.width}×${pixels.height}`,note:`${source.width}×${source.height} → ${pixels.width}×${pixels.height}${o.scale>1?` · ${text('pixel.exported',{w:out.width,h:out.height})}`:''} · ${text('pixel.colorCount',{n:palette.length||o.colors})}`};
 }finally{Im.release(scaled);Im.release(pixels);Im.release(base);Im.release(source);}
}
const summary=ok=>({big:ok[0].result.pixels.replace('×',' × '),only:true});
const pill=it=>it.result.pixels;
const detail=it=>it.result.note;
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,reflect,process,summary,pill,detail,pixelated:true,advancedOpen:o=>o.palette!=='auto'});
