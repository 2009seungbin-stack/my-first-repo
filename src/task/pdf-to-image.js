import {PDFWorkspace} from '../pdf.js';
import {parsePages,stem,bytes} from '../core.js';
import {createBatch} from './batch.js';
import {firstPage} from './pdf-compress.js';
import {text} from './shell.js';
/** PDF → JPG / PNG: every page (or a range) becomes an image; several PDFs at once, each in
 * its own folder of the ZIP. Resolution is a plain choice first, exact pixels under Advanced. */
export const accept='application/pdf,.pdf';
const SIZES={screen:1600,standard:2400,print:4000};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=q=>({size:Object.hasOwn(SIZES,q.get('size'))?q.get('size'):'standard',format:q.get('format')==='png'?'png':'jpeg',range:/^[0-9,\s-]{1,256}$/.test(q.get('pages')||'')?q.get('pages'):'',maxSide:0});
const simple=o=>`<div class="segmented" role="group" id="p2iSize">${Object.keys(SIZES).map(id=>`<button type="button" data-action="task-option" data-size="${id}" aria-pressed="${o.size===id}">${esc(text('p2i.'+id))}<small>${esc(text(`p2i.${id}Hint`))}</small></button>`).join('')}</div>
<div class="segmented" role="group" id="p2iFormat" style="margin-top:8px">${['jpeg','png'].map(f=>`<button type="button" data-action="task-option" data-format="${f}" aria-pressed="${o.format===f}">${f==='jpeg'?'JPG':'PNG'}<small>${esc(text('convert.'+f))}</small></button>`).join('')}</div>`;
const advanced=o=>`<label class="field"><span>${esc(text('p2i.range'))}</span><input id="p2iRange" type="text" value="${esc(o.range)}" placeholder="1,3-5" inputmode="numeric"><small>${esc(text('p2i.rangeHint'))}</small></label><label class="field"><span>${esc(text('p2i.maxSide'))}</span><input id="p2iMax" type="number" min="0" max="12000" step="100" value="${o.maxSide||''}" placeholder="${SIZES[o.size]}" inputmode="numeric"></label>`;
const read=(form,o)=>({size:form.querySelector('#p2iSize [aria-pressed="true"]')?.dataset.size||o.size,format:form.querySelector('#p2iFormat [aria-pressed="true"]')?.dataset.format||o.format,range:form.querySelector('#p2iRange').value.trim(),maxSide:Math.max(0,Math.min(12000,Math.round(Number(form.querySelector('#p2iMax').value)||0)))});
async function process(file,o,{signal,progress}){
 const ws=new PDFWorkspace();
 try{
  await ws.add([file],progress,signal);const picked=parsePages(o.range,ws.pages.length).map(i=>ws.pages[i]);// also validates the range with a readable error
  const entries=(await ws.imageExports({range:o.range,format:o.format,maxSide:o.maxSide||SIZES[o.size]},progress,signal)).map(e=>({...e,name:`${stem(file.name)}-${e.name}`}));
  // What was really made: the measured pixel size (when every page shares one size) and the total weight.
  const parts=[text('p2i.made',{n:entries.length,f:o.format==='jpeg'?'JPG':'PNG'})],same=picked.every(p=>p.logicalW===picked[0].logicalW&&p.logicalH===picked[0].logicalH);
  if(same)try{const bitmap=await createImageBitmap(entries[0].blob);parts.push(`${bitmap.width}×${bitmap.height}px`);bitmap.close();}catch{}
  parts.push(bytes(entries.reduce((sum,e)=>sum+e.blob.size,0)));
  return {entries,preview:URL.createObjectURL(entries[0].blob),count:entries.length,note:parts.join(' · ')};
 }finally{await ws.clear();}
}
const summary=ok=>({big:text('p2i.images',{n:ok.reduce((s,i)=>s+i.result.count,0)}),only:true});
const detail=it=>it.result.note;
const pill=it=>text('p2i.images',{n:it.result.count});
export const mount=ctx=>createBatch(ctx,{options,simple,advanced,read,process,summary,pill,detail,thumb:firstPage,compare:false,advancedOpen:o=>!!(o.range||o.maxSide)});
