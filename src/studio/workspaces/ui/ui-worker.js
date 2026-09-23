/** UI workspace worker: everything that touches many pixels or a whole font runs here, off the UI
 * thread. Caches decoded images, parsed fonts, parsed translation files and rendered glyphs, so
 * changing one setting re-renders only what that setting affects.
 *
 * in  {op:'blob', id, bytes}                               remember bytes (images, fonts, translations)
 *     {op:'detect', job, blob, threshold, minArea, merge}  → {rects} UI elements of a sheet
 *     {op:'fontInfo', job, blob}                           → {info} family, axes, pixel grid, counts
 *     {op:'font', job, font:FontDoc}                       → {charset, missing, model, pages:[{png, bitmap}]}
 *     {op:'gridDetect', job, blob, keyColor}               → {guess} font-grid.js detection
 *     {op:'export', job, kind:'kit'|'font', payload}       → {blob, name, files}
 * out {job, progress} … {job, ok, …} | {job, ok:false, error} */
import {decodePNG} from '../../../game/texture-png.js';
import {components} from '../../../primitives.js';
import {mergeRects} from '../../../game/ui-layout.js';
import {parseFont} from '../../../game/ui/font/opentype.js';
import {readTranslations,buildCharset,missingGlyphs} from '../../../game/ui/charset.js';
import {normalizeFontSettings,renderGlyph,packGlyphs,composePages,assemble,gridFontModel,pixelGridOf,suggestKerning} from '../../../game/ui/font/build.js';
import {detectFontGrid} from '../../../game/font-grid.js';
import {applyColorKey,detectColorKey,hex} from '../../../game/color-key.js';
import {encodePNG} from '../../../game/pack/png.js';
import {buildKitBundle,buildFontBundle} from '../../../game/ui/export/bundles.js';
import {zip} from '../../../core.js';
const bytes=new Map(),images=new Map(),fonts=new Map(),files=new Map(),glyphCache=new Map();
const post=(m,t)=>self.postMessage(m,t||[]);
async function image(id){
 let img=images.get(id);if(img)return img;
 const b=bytes.get(id);if(!b)throw Error(`Image ${id.slice(0,8)} was not sent to the worker`);
 try{const d=await decodePNG(b,{maxPixels:268e6});img={width:d.width,height:d.height,data:new Uint8ClampedArray(d.data.buffer,d.data.byteOffset,d.data.byteLength)};}
 catch{const bmp=await createImageBitmap(new Blob([b],{type:'image/png'}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});const c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);img={width:bmp.width,height:bmp.height,data:x.getImageData(0,0,bmp.width,bmp.height).data};bmp.close();}
 images.set(id,img);return img;
}
function font(id){
 let f=fonts.get(id);if(f)return f;
 const b=bytes.get(id);if(!b)throw Error(`Font ${id.slice(0,8)} was not sent to the worker`);
 f=parseFont(new Uint8Array(b));fonts.set(id,f);return f;
}
function translations(id,name){
 let f=files.get(id);if(f)return f;
 const b=bytes.get(id);if(!b)throw Error(`${name||'File'} was not sent to the worker`);
 f=readTranslations(name,new Uint8Array(b));files.set(id,f);return f;
}
/** The charset of a FontDoc: its sources → ordered code points + counts + where they come from. */
function charsetOf(doc){
 const sources=doc.charset.sources.map(s=>s.kind==='file'?{...s,file:translations(s.blob,s.name)}:s);
 const cs=buildCharset(sources,{order:doc.charset.order||'frequency',strip:doc.charset.strip!==false,exclude:doc.charset.exclude||''});
 return {cs,files:sources.filter(s=>s.kind==='file').map(s=>s.file)};
}
const glyphKey=(blob,o,cp)=>`${blob}|${JSON.stringify(o.coords||null)}|${o.mode}|${o.size}|${o.range}|${o.padding}|${o.threshold}|${o.alphaOnly?1:0}|${cp}`;
async function pagesOut(model,pages){
 const out=[],transfer=[];
 for(const p of pages){
  const png=await encodePNG({width:p.width,height:p.height,data:p.data},{indexed:model.type==='bitmap'?'auto':'never'});
  // two decodes: the exact channels for the shader preview, and a premultiplied one for the canvas
  // (a white glyph page is (255,255,255,0) around the glyphs: shown straight it would be all white)
  const id=new ImageData(new Uint8ClampedArray(p.data),p.width,p.height);
  const bitmap=await createImageBitmap(id,{premultiplyAlpha:'none'}),display=await createImageBitmap(id,{premultiplyAlpha:'premultiply'});
  out.push({width:p.width,height:p.height,png,bitmap,display});transfer.push(png.buffer,bitmap,display);
 }
 return {out,transfer};
}
/** The keyed (and optionally whitened) sheet of a pixel font, and its model. */
async function gridModel(doc){
 const src=doc.source;let img=await image(src.assetBlob);
 if(src.keyColor)img=applyColorKey(img,src.keyColor.match(/[0-9a-f]{2}/gi).map(h=>parseInt(h,16)),{tolerance:0});
 if(src.white){const d=new Uint8ClampedArray(img.data);for(let i=0;i<d.length;i+=4)if(d[i+3]){d[i]=d[i+1]=d[i+2]=255;}img={...img,data:d};}
 const kern=Object.entries(doc.kerning||{}).map(([k,amount])=>{const [first,second]=k.split(',').map(Number);return {first,second,amount};});
 const model=gridFontModel(img,src.grid,{chars:src.chars,measure:src.measure,baseline:src.baseline,lineHeight:src.lineHeight,spacing:src.spacing??1,spaceAdvance:src.spaceAdvance,overrides:doc.overrides||{},kerning:kern,face:doc.name,file:doc.exportName||'font'});
 return {img,model};
}
async function buildFont(job,doc){
 const t0=performance.now(),src=doc.source,{cs,files:tfiles}=charsetOf(doc);
 if(src.kind==='grid'){
  const {img,model}=await gridModel(doc);
  const have=new Set(model.glyphs.map(g=>g.id));
  const missing=missingGlyphs(cs.codepoints,c=>have.has(c),{counts:cs.counts,files:tfiles});
  const {out,transfer}=await pagesOut(model,[{width:img.width,height:img.height,data:img.data}]);
  return post({job,ok:true,model,pages:out,charset:{count:cs.codepoints.length,stats:cs.stats,perSource:cs.perSource,removed:cs.removed,codepoints:cs.codepoints},missing,ms:Math.round(performance.now()-t0)},transfer);
 }
 const f=font(src.blob),o=normalizeFontSettings({...doc.render,coords:src.coords||null,file:doc.exportName||'font'});
 const want=cs.codepoints.length?cs.codepoints:[0x20];
 const glyphs=[],missingCps=[];let last=0;
 for(let i=0;i<want.length;i++){
  const cp=want[i],k=glyphKey(src.blob,o,cp);
  let g=glyphCache.get(k);
  if(g===undefined){g=renderGlyph(f,cp,o);glyphCache.set(k,g);}
  if(g)glyphs.push(g);else missingCps.push(cp);
  const now=performance.now();if(now-last>120){last=now;post({job,progress:{phase:'render',done:i+1,total:want.length}});}
 }
 if(glyphCache.size>60000)glyphCache.clear();
 // kerning pairs by hand replace or add to the font's own pairs
 post({job,progress:{phase:'pack',done:0,total:glyphs.length}});
 const packed=packGlyphs(glyphs,o),pages=composePages(packed,o);
 const model=assemble(f,{glyphs,missing:missingCps},packed,o,{face:doc.name||f.family,file:doc.exportName||'font'});
 for(const [cpStr,ov] of Object.entries(doc.overrides||{})){const g=model.glyphs.find(x=>x.id===Number(cpStr));if(g)Object.assign(g,Object.fromEntries(Object.entries(ov).filter(([,v])=>v!=null)));}
 const hand=new Map(Object.entries(doc.kerning||{}));
 if(hand.size){model.kerning=model.kerning.filter(k=>!hand.has(k.first+','+k.second));for(const [k,amount] of hand){const [first,second]=k.split(',').map(Number);if(amount)model.kerning.push({first,second,amount,em:amount/o.size,hand:true});}model.kerning.sort((a,b)=>a.first-b.first||a.second-b.second);}
 const missing=missingGlyphs(cs.codepoints,c=>!!f.glyphId(c),{counts:cs.counts,files:tfiles});
 post({job,progress:{phase:'encode',done:0,total:pages.length}});
 const {out,transfer}=await pagesOut(model,pages);
 post({job,ok:true,model,pages:out,charset:{count:cs.codepoints.length,stats:cs.stats,perSource:cs.perSource,removed:cs.removed,codepoints:cs.codepoints},missing,ms:Math.round(performance.now()-t0)},transfer);
}
function fontInfo(id){
 const f=font(id),cps=f.codepoints();
 const sample=[...'HOIEnoxaA0',...'가나다한글'].map(c=>c.codePointAt(0)).filter(c=>f.glyphId(c));
 let grid={pixelSize:null,confidence:'none'};try{grid=f.outlines==='none'?grid:pixelGridOf(f,sample.length?sample:cps.slice(0,40));}catch{}
 const has=(a,b)=>{let n=0;for(const c of cps)if(c>=a&&c<=b)n++;return n;};
 return {family:f.family,subfamily:f.subfamily,fullName:f.fullName,version:f.version,license:f.licenseText||'',copyright:f.copyright||'',
  outlines:f.outlines,container:f.container,bitmapOnly:!!f.bitmapOnly,unitsPerEm:f.unitsPerEm,glyphs:f.numGlyphs,codepoints:cps.length,
  hangul:has(0xac00,0xd7a3),kana:has(0x3040,0x30ff),han:has(0x4e00,0x9fff),latin:has(0x20,0x24f),axes:f.axes||[],instances:f.instances||[],pixelGrid:grid};
}
self.onmessage=async({data:m})=>{
 const {job}=m;
 try{
  if(m.op==='blob'){bytes.set(m.id,m.bytes);return;}
  if(m.op==='forget'){for(const id of m.ids){bytes.delete(id);images.delete(id);fonts.delete(id);files.delete(id);}return;}
  if(m.op==='detect'){
   const img=await image(m.blob);
   const raw=components(img.data,img.width,img.height,{threshold:m.threshold??8,minArea:m.minArea??16});
   const rects=mergeRects(raw.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h})),m.merge??2).sort((a,b)=>a.y-b.y||a.x-b.x);
   return post({job,ok:true,rects,islands:raw.length,width:img.width,height:img.height});
  }
  if(m.op==='pixels'){const img=await image(m.blob);return post({job,ok:true,width:img.width,height:img.height,data:img.data.slice()});}
  if(m.op==='fontInfo')return post({job,ok:true,info:fontInfo(m.blob)});
  if(m.op==='gridDetect'){
   let img=await image(m.blob);const key=m.keyColor===undefined?detectColorKey(img):null;
   const use=m.keyColor||(key?.confidence==='high'?hex(key.color):null);
   if(use)img=applyColorKey(img,use.match(/[0-9a-f]{2}/gi).map(h=>parseInt(h,16)),{tolerance:0});
   return post({job,ok:true,guess:detectFontGrid(img),key:key?{color:hex(key.color),confidence:key.confidence,reasons:key.reasons}:null,keyUsed:use});
  }
  if(m.op==='font')return await buildFont(job,m.font);
  if(m.op==='kernSuggest'){const {img,model}=await gridModel(m.font);return post({job,ok:true,suggestions:suggestKerning(img,model)});}
  if(m.op==='export'){
   const b=m.kind==='kit'?await buildKitBundle(m.payload,{image}):await buildFontBundle(m.payload);
   const blob=new Blob([await zip(b.files.map(f=>({name:f.name,blob:new Blob([f.data])})),{paths:true})],{type:'application/zip'});
   return post({job,ok:true,blob,name:b.name,files:b.files.map(f=>f.name),notes:b.notes||[]});
  }
  throw Error(`Unknown op ${m.op}`);
 }catch(e){post({job,ok:false,error:String(e?.message||e)});}
};
