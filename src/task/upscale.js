import * as Im from '../image.js';
import {stem} from '../core.js';
import {createBatch} from './batch.js';
import {text} from './shell.js';
/** Upscaler: drop images, pick 2× or 4×. "AI" is Real-ESRGAN general-x4v3 (a 5 MB model that
 * measured both faster and sharper here than the 54 MB Swin2SR it replaces as the default);
 * "Smooth" is the classical Lanczos resampler and "Pixel art" keeps hard pixels. */
export const accept='image/*,.heic,.heif';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Above this the tiled model takes minutes on a CPU; the classical resampler answers instead, and says so.
export const AI_MAX_PIXELS=4_000_000;
function options(q){
 const asked=q.get('mode')||{sr:'ai',pixel:'pixel',smooth:'smooth'}[q.get('scaleMode')];
 return {scale:q.get('scale')==='4'?4:2,mode:['ai','smooth','pixel'].includes(asked)?asked:'ai',format:['png','jpeg','webp'].includes(q.get('format'))?q.get('format'):'png'};
}
const chips=(id,key,rows,current)=>`<div class="segmented" role="group" id="${id}">${rows.map(([v,label,small])=>`<button type="button" data-action="task-option" data-${key}="${v}" aria-pressed="${String(current)===String(v)}">${esc(label)}${small?`<small>${esc(small)}</small>`:''}</button>`).join('')}</div>`;
const simple=o=>`<span class="opt-label">${esc(text('upscale.size'))}</span>${chips('upScale','scale',[[2,'2×'],[4,'4×']],o.scale)}
<span class="opt-label">${esc(text('upscale.method'))}</span>${chips('upMode','mode',[['ai',text('upscale.ai'),text('upscale.aiHint')],['smooth',text('upscale.smooth'),text('upscale.smoothHint')],['pixel',text('upscale.pixel'),text('upscale.pixelHint')]],o.mode)}`;
const advanced=o=>`<label class="field"><span>${esc(text('bg.format'))}</span><select id="upFormat">${[['png','PNG'],['jpeg','JPG'],['webp','WebP']].map(([v,l])=>`<option value="${v}" ${o.format===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
function read(form,o){
 const pressed=(id,key)=>form.querySelector(`#${id} [aria-pressed="true"]`)?.dataset[key];
 return {scale:Number(pressed('upScale','scale'))||o.scale,mode:pressed('upMode','mode')||o.mode,format:form.querySelector('#upFormat').value};
}
// The model always produces 4×; keeping the last few lets 2× ↔ 4× and format changes answer at once.
const enlarged=new Map(),KEEP=3;
function keep(file,canvas){enlarged.set(file,canvas);while(enlarged.size>KEEP){const [first,old]=enlarged.entries().next().value;Im.release(old);enlarged.delete(first);}}
const friendly=p=>/download|MiB|cached/i.test(p)?text('upscale.stage.model'):/tile\s*(\d+)\s*\/\s*(\d+)/i.test(p)?text('upscale.stage.tiles',{a:p.match(/tile\s*(\d+)\s*\/\s*(\d+)/i)[1],b:p.match(/tile\s*(\d+)\s*\/\s*(\d+)/i)[2]}):text('upscale.stage.prepare');
async function process(file,o,{signal,progress}){
 const source=await Im.decode(file);let big=null,out=null;
 try{
  const w=source.width*o.scale,h=source.height*o.scale;let warn='',how=o.mode;
  if(o.mode==='ai'&&source.width*source.height>AI_MAX_PIXELS){how='smooth';warn=text('upscale.tooLarge');}
  if(how==='ai'){
   // The model is native 4×; 2× is that result reduced with the high-quality resampler.
   big=enlarged.get(file)||await Im.upscale(source,4,'sr',{engine:'fast',signal,progress:p=>progress(friendly(p))});
   if(/^pica/.test(big.processingReport?.engine||'')){// the model could not be fetched or run; the engine already fell back
   how='smooth';warn=text('upscale.noModel');}
   else if(!enlarged.has(file))keep(file,big);
   out=o.scale===4&&big.width===w?big:await Im.resizeQuality(big,w,h,{signal});
  }else out=await Im.upscale(source,o.scale,how==='pixel'?'pixel':'smooth',{signal,progress:()=>progress(text('upscale.stage.prepare'))});
  const type=o.format==='jpeg'?'image/jpeg':o.format==='webp'?'image/webp':'image/png',blob=await Im.blobOf(out,type,.95);
  return {blob,name:`${stem(file.name)}-${o.scale}x.${o.format==='jpeg'?'jpg':o.format}`,sourceWidth:out.width,sourceHeight:out.height,size:`${out.width}×${out.height}`,hard:how==='pixel',warn,note:`${source.width}×${source.height} → ${out.width}×${out.height} · ${text('upscale.'+how)}`};
 }finally{if(out!==big)Im.release(out);if(big&&enlarged.get(file)!==big)Im.release(big);Im.release(source);}
}
async function sample(){
 const c=Im.canvas(360,280),x=c.getContext('2d');x.fillStyle='#eef3ff';x.fillRect(0,0,360,280);x.fillStyle='#ff9269';x.beginPath();x.roundRect(128,110,104,114,[12,12,36,36]);x.fill();x.fillStyle='#2f80ff';x.beginPath();x.arc(180,96,44,0,Math.PI*2);x.fill();x.fillStyle='#1d2a3d';x.font='700 22px system-ui,sans-serif';x.textAlign='center';x.fillText('Nerulio 360×280',180,258);
 try{return new File([await Im.blobOf(c,'image/png')],'nerulio-sample.png',{type:'image/png'});}finally{Im.release(c);}
}
const summary=ok=>({big:ok.length===1?ok[0].result.size.replace('×',' × '):text('files',{n:ok.length}),only:true});
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,process,sample,summary,pill:it=>it.result.size,detail:it=>it.result.note,pixelated:it=>it.result?.hard});
