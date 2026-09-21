import {PDFWorkspace} from '../pdf.js';
import {blobOf,release} from '../image.js';
import {bytes,stem} from '../core.js';
import {createBatch} from './batch.js';
import {text} from './shell.js';
/** PDF compression. The three levels recompress the embedded photos (the part of a PDF that
 * is actually big) and keep text, vectors and search. "Flatten to images" is a separate,
 * clearly labelled advanced option because it removes selectable text. */
export const accept='application/pdf,.pdf';
const LEVELS={light:{quality:.78,maxSide:1800},balanced:{quality:.6,maxSide:1300},strong:{quality:.4,maxSide:900}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=q=>({level:Object.hasOwn(LEVELS,q.get('level'))?q.get('level'):'balanced',raster:q.get('raster')==='1',removeMetadata:q.get('meta')==='0'});
const simple=o=>`<div class="segmented" role="group" id="pdfcLevel">${Object.keys(LEVELS).map(id=>`<button type="button" data-action="task-option" data-level="${id}" aria-pressed="${o.level===id}">${esc(text('pdfc.'+id))}<small>${esc(text(`pdfc.${id}Hint`))}</small></button>`).join('')}</div>`;
const advanced=o=>`<label class="check"><input id="pdfcMeta" type="checkbox" ${o.removeMetadata?'checked':''}> ${esc(text('pdf.removeMeta'))}</label><label class="check"><input id="pdfcRaster" type="checkbox" ${o.raster?'checked':''}> ${esc(text('pdfc.raster'))}</label><p class="hint warning">${esc(text('pdfc.rasterWarn'))}</p><p class="hint">${esc(text('pdfc.how'))}</p>`;
const read=(form,o)=>({level:form.querySelector('#pdfcLevel [aria-pressed="true"]')?.dataset.level||o.level,raster:form.querySelector('#pdfcRaster').checked,removeMetadata:form.querySelector('#pdfcMeta').checked});
export async function firstPage(file){
 const ws=new PDFWorkspace();let c=null;
 try{await ws.add([file]);c=await ws.render(ws.pages[0],900,false);return URL.createObjectURL(await blobOf(c,'image/jpeg',.8));}finally{release(c);await ws.clear();}
}
async function process(file,o,{signal,progress}){
 const ws=new PDFWorkspace();
 try{
  await ws.add([file],progress,signal);const level=LEVELS[o.level];
  const blob=await ws.export({optimize:!o.raster,raster:o.raster,quality:level.quality,maxSide:level.maxSide,removeMetadata:o.removeMetadata},progress,signal),keep=blob.size>=file.size,r=ws.lastReport||{};
  return {blob:keep?file:blob,name:keep?file.name:`${stem(file.name)}-min.pdf`,
   note:keep?text('pdfc.kept'):`${bytes(file.size)} → ${bytes(blob.size)} · ${text('pdf.pagesN',{n:ws.pages.length})} · ${text(o.raster?'pdfc.textLost':'pdfc.textKept')}${r.optimizedImages?` · ${text('pdfc.images',{n:r.optimizedImages})}`:''}`};
 }finally{await ws.clear();}
}
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,process,thumb:firstPage,compare:false,advancedOpen:o=>o.raster});
