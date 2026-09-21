import {PDFWorkspace} from '../pdf.js';
import {blobOf,release} from '../image.js';
import {bytes,stem} from '../core.js';
import {createBatch} from './batch.js';
import {text} from './shell.js';
/** PDF compression. The three levels resample every embedded image down to the resolution the
 * page actually draws it at, recompress it, trim embedded fonts to the glyphs the document uses,
 * merge byte-identical objects and re-deflate what was stored raw — text, vectors and search
 * survive all of it. "Flatten to images" is a separate, clearly labelled advanced option
 * because it is the only mode that removes selectable text. */
export const accept='application/pdf,.pdf';
const LEVELS={light:{quality:.82,maxSide:2600,dpi:200},balanced:{quality:.62,maxSide:2000,dpi:144},strong:{quality:.42,maxSide:1400,dpi:96}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=q=>({level:Object.hasOwn(LEVELS,q.get('level'))?q.get('level'):'balanced',raster:q.get('raster')==='1',grayscale:q.get('gray')==='1',removeMetadata:q.get('meta')==='0'});
const simple=o=>`<div class="segmented" role="group" id="pdfcLevel">${Object.keys(LEVELS).map(id=>`<button type="button" data-action="task-option" data-level="${id}" aria-pressed="${o.level===id}">${esc(text('pdfc.'+id))}<small>${esc(text(`pdfc.${id}Hint`))}</small></button>`).join('')}</div>`;
const advanced=o=>`<label class="check"><input id="pdfcMeta" type="checkbox" ${o.removeMetadata?'checked':''}> ${esc(text('pdf.removeMeta'))}</label><label class="check"><input id="pdfcGray" type="checkbox" ${o.grayscale?'checked':''}> ${esc(text('pdfc.gray'))}</label><p class="hint">${esc(text('pdfc.grayHint'))}</p><label class="check"><input id="pdfcRaster" type="checkbox" ${o.raster?'checked':''}> ${esc(text('pdfc.raster'))}</label><p class="hint warning">${esc(text('pdfc.rasterWarn'))}</p><p class="hint">${esc(text('pdfc.how'))}</p>`;
const read=(form,o)=>({level:form.querySelector('#pdfcLevel [aria-pressed="true"]')?.dataset.level||o.level,raster:form.querySelector('#pdfcRaster').checked,grayscale:form.querySelector('#pdfcGray').checked,removeMetadata:form.querySelector('#pdfcMeta').checked});
export async function firstPage(file){
 const ws=new PDFWorkspace();let c=null;
 try{await ws.add([file]);c=await ws.render(ws.pages[0],900,false);return URL.createObjectURL(await blobOf(c,'image/jpeg',.8));}finally{release(c);await ws.clear();}
}
/** What the run actually did, so a small saving is explained rather than left a mystery. */
function note(file,blob,ws,o){
 const r=ws.lastReport||{},parts=[`${bytes(file.size)} → ${bytes(blob.size)}`,text('pdf.pagesN',{n:ws.pages.length}),text(o.raster?'pdfc.textLost':'pdfc.textKept')];
 if(r.optimizedImages)parts.push(text('pdfc.images',{n:r.optimizedImages}));
 if(r.subsetFonts)parts.push(text('pdfc.fonts',{n:r.subsetFonts}));
 const merged=(r.deduplicatedImages||0)+(r.deduplicatedStreams||0);
 if(merged)parts.push(text('pdfc.merged',{n:merged}));
 if(!r.optimizedImages&&!r.subsetFonts&&!merged&&!r.recompressedStreams&&!o.raster)parts.push(text('pdfc.nothingLeft'));
 return parts.join(' · ');
}
async function process(file,o,{signal,progress}){
 const ws=new PDFWorkspace();
 try{
  await ws.add([file],progress,signal);const level=LEVELS[o.level];
  const blob=await ws.export({optimize:!o.raster,raster:o.raster,quality:level.quality,maxSide:o.raster?level.maxSide:Math.max(level.maxSide,2000),dpi:level.dpi,grayscale:o.grayscale,removeMetadata:o.removeMetadata},progress,signal),keep=blob.size>=file.size;
  return {blob:keep?file:blob,name:keep?file.name:`${stem(file.name)}-min.pdf`,
   note:keep?`${text('pdfc.kept')} · ${bytes(file.size)}`:note(file,blob,ws,o)};
 }finally{await ws.clear();}
}
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,process,thumb:firstPage,compare:false,advancedOpen:o=>o.raster});
