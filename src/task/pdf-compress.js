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
/** Each level is one resolution, stated twice: `dpi` against the size the page really draws an
 * image at, and `maxSide` as that same resolution on a normal page (A4's long side is 11.69in).
 * maxSide is never allowed to be raised out of the way, because it is the only cap that bites on
 * a file whose declared page size is meaningless — an A4 scan wrapped by an image-to-PDF
 * converter is a 17x24in page at a genuine 72dpi, where a resolution rule has nothing to grip.
 * `gray` is how colourless a picture must be before it is stored as grey; see pdf-encode.js. */
const LEVELS={
 light:{quality:.82,dpi:200,maxSide:2340,gray:{mean:2,coloured:.0005}},
 balanced:{quality:.58,dpi:120,maxSide:1400,gray:{mean:6,coloured:.002}},
 strong:{quality:.40,dpi:90,maxSide:1050,gray:{mean:10,coloured:.005}}
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=q=>({level:Object.hasOwn(LEVELS,q.get('level'))?q.get('level'):'balanced',raster:q.get('raster')==='1',grayscale:q.get('gray')==='1',autoGray:q.get('autogray')!=='0',removeMetadata:q.get('meta')==='0'});
const simple=o=>`<div class="segmented" role="group" id="pdfcLevel">${Object.keys(LEVELS).map(id=>`<button type="button" data-action="task-option" data-level="${id}" aria-pressed="${o.level===id}">${esc(text('pdfc.'+id))}<small>${esc(text(`pdfc.${id}Hint`))}</small></button>`).join('')}</div>`;
const advanced=o=>`<label class="check"><input id="pdfcMeta" type="checkbox" ${o.removeMetadata?'checked':''}> ${esc(text('pdf.removeMeta'))}</label><label class="check"><input id="pdfcAutoGray" type="checkbox" ${o.autoGray?'checked':''}> ${esc(text('pdfc.autoGray'))}</label><p class="hint">${esc(text('pdfc.autoGrayHint'))}</p><label class="check"><input id="pdfcGray" type="checkbox" ${o.grayscale?'checked':''}> ${esc(text('pdfc.gray'))}</label><p class="hint">${esc(text('pdfc.grayHint'))}</p><label class="check"><input id="pdfcRaster" type="checkbox" ${o.raster?'checked':''}> ${esc(text('pdfc.raster'))}</label><p class="hint warning">${esc(text('pdfc.rasterWarn'))}</p><p class="hint">${esc(text('pdfc.how'))}</p>`;
const read=(form,o)=>({level:form.querySelector('#pdfcLevel [aria-pressed="true"]')?.dataset.level||o.level,raster:form.querySelector('#pdfcRaster').checked,grayscale:form.querySelector('#pdfcGray').checked,autoGray:form.querySelector('#pdfcAutoGray').checked,removeMetadata:form.querySelector('#pdfcMeta').checked});
export async function firstPage(file){
 const ws=new PDFWorkspace();let c=null;
 try{await ws.add([file]);c=await ws.render(ws.pages[0],900,false);return URL.createObjectURL(await blobOf(c,'image/jpeg',.8));}finally{release(c);await ws.clear();}
}
/** What the run actually did, so a small saving is explained rather than left a mystery. */
function note(file,blob,ws,o){
 const r=ws.lastReport||{},parts=[`${bytes(file.size)} → ${bytes(blob.size)}`,text('pdf.pagesN',{n:ws.pages.length}),text(o.raster?'pdfc.textLost':'pdfc.textKept')];
 if(r.optimizedImages)parts.push(text('pdfc.images',{n:r.optimizedImages}));
 if(r.grayscaleImages)parts.push(text('pdfc.grayed',{n:r.grayscaleImages}));
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
  const blob=await ws.export({optimize:!o.raster,raster:o.raster,quality:level.quality,maxSide:level.maxSide,dpi:level.dpi,
   grayscale:o.grayscale,grayLimits:o.autoGray?level.gray:null,removeMetadata:o.removeMetadata},progress,signal),keep=blob.size>=file.size;
  return {blob:keep?file:blob,name:keep?file.name:`${stem(file.name)}-min.pdf`,
   note:keep?`${text('pdfc.kept')} · ${bytes(file.size)}`:note(file,blob,ws,o)};
 }finally{await ws.clear();}
}
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,process,thumb:firstPage,compare:false,advancedOpen:o=>o.raster});
