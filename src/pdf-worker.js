// PDF parsing, object copying, font embedding and serialization stay off the UI thread.
import * as L from '../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js';
import {optimize} from './pdf-optimize.js';
import {encodeImage} from './pdf-encode.js';
import {protectDocument,unlockDocument,inspect} from './pdf-secure.js';
import {permissionValue} from './pdf-crypt.js';
const documents=new Map();
let activeJob=0,requestSerial=0,canvasInWorker=null;const imageRequests=new Map();
function encodeOnMain(source,tw,th,options){const requestId=++requestSerial;return new Promise((resolve,reject)=>{imageRequests.set(requestId,{resolve,reject});postMessage({id:activeJob,imageRequest:{requestId,source,tw,th,options}});});}
/** Workers without OffscreenCanvas hand the resampling back to the page that owns them. */
async function encode(source,tw,th,options){
 canvasInWorker??=typeof OffscreenCanvas!=='undefined'&&await encodeImage({rgba:new Uint8ClampedArray(16),width:2,height:2},2,2,{quality:.5})!==null;
 if(canvasInWorker)return encodeImage(source,tw,th,options);
 try{return await encodeOnMain(source,tw,th,options);}catch{return null;}
}
const tick=()=>new Promise(r=>setTimeout(r,0));
async function load(source){if(documents.has(source.id))return documents.get(source.id);const doc=await L.PDFDocument.load(await source.file.arrayBuffer(),{updateMetadata:false});documents.set(source.id,doc);return doc;}
function metadata(page){const b=page.getCropBox(),rotation=((page.getRotation().angle%360)+360)%360,userUnit=page.node.lookupMaybe(L.PDFName.of('UserUnit'),L.PDFNumber)?.asNumber()||1;return {...b,rotation,userUnit,logicalW:(rotation%180?b.height:b.width)*userUnit,logicalH:(rotation%180?b.width:b.height)*userUnit};}
function point(p,u,v){const b=p.box,r=p.rotation;if(r===90)return {x:b.x+v*b.width,y:b.y+u*b.height};if(r===180)return {x:b.x+(1-u)*b.width,y:b.y+v*b.height};if(r===270)return {x:b.x+(1-v)*b.width,y:b.y+(1-u)*b.height};return {x:b.x+u*b.width,y:b.y+(1-v)*b.height};}
function color(hex='#172b4d'){return L.rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);}
let cjkBytes;
async function fontFor(out,text,fonts){try{fonts.latin||=await out.embedFont(L.StandardFonts.Helvetica);fonts.latin.encodeText(text);return fonts.latin;}catch{if(!fonts.cjk){await import('../assets/vendor/pdf-lib-fontkit-1.1.1/fontkit.umd.min.js');out.registerFontkit(globalThis.fontkit);if(!cjkBytes){const response=await fetch('https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf');if(!response.ok)throw Error('Cannot download annotation font. Check the connection and retry.');cjkBytes=await response.arrayBuffer();}fonts.cjk=await out.embedFont(cjkBytes,{subset:true});}fonts.cjkCharacters||=new Set(fonts.cjk.getCharacterSet());for(const ch of text){if(ch!=='\n'&&!fonts.cjkCharacters.has(ch.codePointAt(0)))throw Error(`Annotation font does not contain ${ch}. Choose a supported character.`);}return fonts.cjk;}}
async function marks(out,page,p,fonts){for(const m of p.marks){const size=(m.size||3)/(p.box.userUnit||1),c=color(m.color),unit=p.box.userUnit||1;
 if(m.type==='fill'){page.drawRectangle({...point(p,m.x,m.y+m.h),width:m.w*p.logicalW/unit,height:m.h*p.logicalH/unit,rotate:L.degrees(p.rotation),color:c,opacity:m.opacity??1,borderWidth:0});continue;}
 if(m.type==='ellipse'){const swap=p.rotation%180!==0,rx=Math.abs(m.w)*p.logicalW/unit/2,ry=Math.abs(m.h)*p.logicalH/unit/2;page.drawEllipse({...point(p,m.x+m.w/2,m.y+m.h/2),xScale:swap?ry:rx,yScale:swap?rx:ry,borderColor:c,borderWidth:size,...(m.fill?{color:color(m.fill)}:{})});continue;}
 if(m.type==='line'){const a=point(p,m.x,m.y),b=point(p,m.x+m.w,m.y+m.h);page.drawLine({start:a,end:b,thickness:size,color:c,lineCap:L.LineCapStyle.Round});
  if(m.arrow){const ang=Math.atan2(b.y-a.y,b.x-a.x),len=Math.max(8,size*4);for(const d of [-.45,.45])page.drawLine({start:b,end:{x:b.x-len*Math.cos(ang+d),y:b.y-len*Math.sin(ang+d)},thickness:size,color:c,lineCap:L.LineCapStyle.Round});}continue;}
 if(m.type==='pen'){for(let i=1;i<m.points.length;i++)page.drawLine({start:point(p,...m.points[i-1]),end:point(p,...m.points[i]),thickness:size,color:c,lineCap:L.LineCapStyle.Round});}else if(m.type==='rect'||m.type==='highlight'){page.drawRectangle({...point(p,m.x,m.y+m.h),width:m.w*p.logicalW/(p.box.userUnit||1),height:m.h*p.logicalH/(p.box.userUnit||1),rotate:L.degrees(p.rotation),...(m.type==='highlight'?{color:c,opacity:.3,borderWidth:0}:{borderColor:c,borderWidth:size})});}else if(m.type==='text'){let font=await fontFor(out,m.text||'',fonts);if(m.bold&&font===fonts.latin)font=fonts.bold||=await out.embedFont(L.StandardFonts.HelveticaBold);const s=(m.size||20)/(p.box.userUnit||1);for(const [i,line] of (m.text||'').split('\n').entries())page.drawText(line,{...point(p,m.x,m.y+((m.size||20)*(.85+i*1.35))/p.logicalH),size:s,font,color:c,opacity:m.opacity??1,rotate:L.degrees(p.rotation-(m.angle||0))});}else if(m.type==='image'&&m.blob){const img=await out.embedPng(await m.blob.arrayBuffer());page.drawImage(img,{...point(p,m.x,m.y+m.h),width:m.w*p.logicalW/(p.box.userUnit||1),height:m.h*p.logicalH/(p.box.userUnit||1),rotate:L.degrees(p.rotation)});}}}
/** Password handling. Both directions re-open their own output before it is handed back, so the
 * page never claims a protection or a removal it has not seen a second reader confirm. */
async function secure(action,payload,progress){
 const source=await payload.file.arrayBuffer();
 if(action==='inspect')return inspect(source);
 if(action==='protect'){
  progress('Encrypting document');
  const {bytes,report}=await protectDocument(source,{password:payload.password,ownerPassword:payload.ownerPassword,permissions:permissionValue(payload.allow||{})});
  const check=inspect(bytes);
  if(!check.encrypted||check.method!=='AESV3')throw Error('The encrypted result did not verify. Nothing was saved.');
  return {blob:new Blob([bytes],{type:'application/pdf'}),report:{...report,...check}};
 }
 const before=inspect(source);
 const {bytes,report}=await unlockDocument(source,payload.password||'');
 if(inspect(bytes).encrypted)throw Error('The result is still encrypted. Nothing was saved.');
 report.handler=before.handler||report.handler;
 let pages=0,verified=false;
 try{pages=(await L.PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:false})).getPageCount();verified=pages>0;}catch{/* reported as unverified */}
 return {blob:new Blob([bytes],{type:'application/pdf'}),report:{...report,pages,verified}};
}
/** AcroForm fields as plain data, so the page can offer them without importing pdf-lib. */
function formFields(doc){
 try{return doc.getForm().getFields().map(f=>{
  const name=f.getName();
  if(f instanceof L.PDFTextField)return {name,kind:'text',value:f.getText()||'',multiline:f.isMultiline(),readOnly:f.isReadOnly()};
  if(f instanceof L.PDFCheckBox)return {name,kind:'check',value:f.isChecked(),readOnly:f.isReadOnly()};
  if(f instanceof L.PDFRadioGroup)return {name,kind:'radio',value:f.getSelected()||'',options:f.getOptions(),readOnly:f.isReadOnly()};
  if(f instanceof L.PDFDropdown)return {name,kind:'select',value:f.getSelected()?.[0]||'',options:f.getOptions(),readOnly:f.isReadOnly()};
  if(f instanceof L.PDFOptionList)return {name,kind:'list',value:f.getSelected()?.[0]||'',options:f.getOptions(),readOnly:f.isReadOnly()};
  return null;
 }).filter(Boolean);}catch{return [];}
}
async function fillFields(doc,values,flatten){
 const form=doc.getForm();if(!form.getFields().length)return;
 for(const {name,kind,value} of values){
  try{
   if(kind==='text')form.getTextField(name).setText(String(value??''));
   else if(kind==='check'){const box=form.getCheckBox(name);value?box.check():box.uncheck();}
   else if(kind==='radio'&&value)form.getRadioGroup(name).select(String(value));
   else if(kind==='select'&&value)form.getDropdown(name).select(String(value));
   else if(kind==='list'&&value)form.getOptionList(name).select(String(value));
  }catch{/* the writer declared a field the document cannot actually set */}
 }
 try{form.updateFieldAppearances(await doc.embedFont(L.StandardFonts.Helvetica));}catch{/* keep the viewer's own appearance */}
 if(flatten)form.flatten();
}
/** Assemble the requested pages into a fresh document, draw the marks, then shrink what is left. */
async function exportPages(payload,progress){
 const out=await L.PDFDocument.create(),fonts={},copied=new Map();
 for(const src of new Map(payload.pages.map(p=>[p.source.id,p.source])).values()){const indices=[...new Set(payload.pages.filter(p=>p.source.id===src.id).map(p=>p.index))],source=await load(src),pages=await out.copyPages(source,indices);indices.forEach((index,i)=>copied.set(src.id+':'+index,pages[i]));}
 for(let i=0;i<payload.pages.length;i++){
  const p=payload.pages[i],key=p.source.id+':'+p.index;let page=copied.get(key);
  if(page)copied.delete(key);else [page]=await out.copyPages(await load(p.source),[p.index]);
  out.addPage(page);page.setRotation(L.degrees((p.rotation+p.angle)%360));
  if(p.crop)page.setCropBox(p.crop.x,p.crop.y,p.crop.width,p.crop.height);
  await marks(out,page,p,fonts);progress(`Writing PDF page ${i+1} / ${payload.pages.length}`);await tick();
 }
 if(payload.fields)await fillFields(out,payload.fields,payload.flatten);
 const report={mode:payload.optimize?'preserve-compress':'preserve',pages:payload.pages.length,textPreserved:true,searchPreserved:true,vectorsPreserved:true};
 if(payload.optimize||payload.removeMetadata)Object.assign(report,await optimize(out,{quality:payload.quality||.62,maxSide:payload.maxSide||2000,dpi:payload.dpi||144,grayscale:!!payload.grayscale,images:!!payload.optimize,streams:!!payload.optimize,metadata:!!payload.removeMetadata},progress,encode));
 const blob=new Blob([await out.save({useObjectStreams:true,updateMetadata:!payload.removeMetadata})],{type:'application/pdf'});
 return {blob,report:{...report,outputBytes:blob.size}};
}
self.onmessage=async({data:{id,action,payload}})=>{if(action==='imageEncoded'){const request=imageRequests.get(payload.requestId);imageRequests.delete(payload.requestId);if(request)payload.error?request.reject(Error(payload.error)):request.resolve(payload);return;}activeJob=id;const progress=message=>postMessage({id,progress:message});try{let result;if(action==='add'){const doc=await load(payload);if(!doc.getPageCount())throw Error('The PDF has no pages.');const fields=payload.keepForms?formFields(doc):[];let flattened=false;if(!payload.keepForms&&doc.getForm().getFields().length){doc.getForm().flatten();flattened=true;}const file=flattened?new Blob([await doc.save()],{type:'application/pdf'}):payload.file;result={pages:doc.getPages().map(metadata),file,flattened,fields};}else if(action==='export'){result=await exportPages(payload,progress);}else if(['inspect','protect','unlock'].includes(action)){result=await secure(action,payload,progress);}else if(action==='clear'){documents.clear();cjkBytes=null;result=true;}else throw Error('Unknown PDF operation.');postMessage({id,result});}catch(e){postMessage({id,error:e.message});}};

