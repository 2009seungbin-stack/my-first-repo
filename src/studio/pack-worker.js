/** Pack & Export worker. Everything that touches pixels runs here, off the UI thread:
 * exact PNG decode (no colour management), cel compositing, packing, page drawing, PNG/GIF/APNG/
 * WebM encoding and the ZIP. Cancel = the page terminates this worker (packing is synchronous, so
 * a message could not interrupt it); caches are then simply rebuilt.
 *
 * in:  {op:'pack', job, doc, assetIds, settings, blobs:[{id,bytes}], preview:variantIndex}
 *      {op:'export', job, target, options:{base, animScale, gifPalette}}
 * out: {job, progress:{…}} … then {job, ok:true, …} or {job, ok:false, error} */
import {decodePNG} from '../game/texture-png.js';
import {composeCanvas} from './sprite/frame-image.js';
import {packAtlas,publicResult} from '../game/pack/packer.js';
import {renderPage} from '../game/pack/sprites.js';
import {modelFromDoc} from '../game/export/project-model.js';
import {buildBundle,animationFrames} from '../game/export/bundle.js';
import {settingsFor,TARGETS} from '../game/export/targets.js';
import {encodeWebM} from '../game/export/webm.js';
import {zip} from '../core.js';

const decoded=new Map(),bytes=new Map(),composed=new Map();
let last=null;// {doc, assetIds, settings, packed, model, key}
const post=(m,t)=>self.postMessage(m,t||[]);
function progressOf(job){let at=0;return p=>{const now=performance.now();if(now-at<60&&p.phase==='layout')return;at=now;post({job,progress:p});};}

async function decode(id){
 let img=decoded.get(id);if(img)return img;
 const b=bytes.get(id);if(!b)throw Error(`Image ${id.slice(0,8)} was not sent to the packer`);
 try{const d=await decodePNG(b,{maxPixels:268e6});img={width:d.width,height:d.height,data:d.data,exact:true};}
 catch(e){
  // Interlaced PNGs are refused by the exact decoder; fall back to the browser (no colour
  // conversion, but its 2D canvas rounds semi-transparent colours) and say so.
  const bmp=await createImageBitmap(new Blob([b],{type:'image/png'}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
  const c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);
  img={width:bmp.width,height:bmp.height,data:new Uint8Array(x.getImageData(0,0,bmp.width,bmp.height).data.buffer),exact:false,why:String(e.message||e)};bmp.close();
 }
 decoded.set(id,img);return img;
}
async function sourcesFor(doc,specs,warnings){
 const out=new Map();
 for(const s of specs){
  let img=composed.get(s.key);
  if(!img){
   const asset=doc.assets.find(a=>a.id===s.assetId);
   const blobs=new Set();for(const c of asset.cels)blobs.add(c.blob);
   for(const id of blobs)await decode(id);
   img=composeCanvas(asset,s.frameId,id=>decoded.get(id));
   composed.set(s.key,img);
  }
  out.set(s.key,img);
 }
 for(const [id,img] of decoded)if(!img.exact&&!warnings.some(w=>w.includes(id.slice(0,8))))warnings.push(`Image ${id.slice(0,8)}: ${img.why}. Decoded by the browser instead; semi-transparent colours may be off by one or two levels.`);
 if(composed.size>64)for(const k of [...composed.keys()].slice(0,composed.size-64))composed.delete(k);
 return out;
}
async function pack(msg,{settings=msg.settings}={}){
 const {doc,assetIds}=msg,warnings=[];
 const {model,packFrames,sources}=modelFromDoc(doc,{assetIds});
 if(!packFrames.length)throw Object.assign(Error('Nothing to pack: import an image or cut frames first.'),{code:'empty'});
 post({job:msg.job,progress:{phase:'decode'}});
 const src=await sourcesFor(doc,sources,warnings);
 const t0=performance.now();
 const packed=packAtlas(packFrames,src,settings,{progress:progressOf(msg.job)});
 return {packed,model,warnings,ms:Math.round(performance.now()-t0)};
}
async function pagesAsBitmaps(packed,vi){
 const v=packed.variants[vi]||packed.variants[0],out=[];
 for(const page of v.pages){
  const img=renderPage(page,v.sprites,{extrude:packed.settings.extrude,premultiply:false});
  out.push(await createImageBitmap(new ImageData(new Uint8ClampedArray(img.data.buffer),img.width,img.height),{premultiplyAlpha:'premultiply'}));
 }
 return out;
}
self.onmessage=async({data:msg})=>{
 try{
  if(msg.blobs)for(const b of msg.blobs)if(!bytes.has(b.id))bytes.set(b.id,new Uint8Array(b.bytes));
  if(msg.op==='forget'){for(const id of [...bytes.keys()])if(!msg.keep.includes(id)){bytes.delete(id);decoded.delete(id);}return;}
  if(msg.op==='pack'){
   const r=await pack(msg);
   last={doc:msg.doc,assetIds:msg.assetIds,settings:r.packed.settings,packed:r.packed,model:r.model};
   const vi=Math.min(msg.preview||0,r.packed.variants.length-1);
   const bitmaps=await pagesAsBitmaps(r.packed,vi);
   post({job:msg.job,ok:true,op:'pack',result:publicResult(r.packed),model:r.model,warnings:r.warnings,ms:r.ms,variant:vi,bitmaps},bitmaps);
   return;
  }
  if(msg.op==='preview'){
   if(!last)throw Error('Nothing packed yet');
   const vi=Math.min(msg.preview||0,last.packed.variants.length-1),bitmaps=await pagesAsBitmaps(last.packed,vi);
   post({job:msg.job,ok:true,op:'preview',variant:vi,bitmaps},bitmaps);return;
  }
  if(msg.op==='export'){
   if(!last)throw Error('Pack first: there is nothing to export yet.');
   const t=TARGETS[msg.target];if(!t)throw Error(`Unknown target ${msg.target}`);
   const {settings,changed}=settingsFor(msg.target,last.settings);
   let packed=last.packed,model=last.model,warnings=[];
   if(changed.length){post({job:msg.job,progress:{phase:'repack',changed}});const r=await pack({...msg,doc:last.doc,assetIds:last.assetIds},{settings});packed=r.packed;model=r.model;warnings=r.warnings;}
   const o=msg.options||{},base=o.base||'atlas';
   let files,root,notes;
   if(t.anim==='webm'){
    const v={...publicResult(packed).variants[0],sprites:packed.variants[0].sprites};
    files=[];notes=[];root=`${base}_webm`;
    for(const a of animationFrames(model,v)){post({job:msg.job,progress:{phase:'video',name:a.name}});const out=await encodeWebM(a.frames,{scale:o.videoScale||4});files.push({name:`${base}_${a.name.replace(/[^\w.-]+/g,'_')}.webm`,bytes:out.bytes});notes.push(...out.notes.map(n=>`${a.name}: ${n}`));}
   }else ({files,root,notes}=await buildBundle(msg.target,model,packed,{base,animScale:o.animScale||1,gifPalette:o.gifPalette||'global',onProgress:p=>post({job:msg.job,progress:p})}));
   post({job:msg.job,progress:{phase:'zip'}});
   const blob=await zip(files.map(f=>({name:`${root}/${f.name}`,blob:new Blob([f.bytes])})),{paths:true});
   post({job:msg.job,ok:true,op:'export',blob,name:`${base}_${msg.target}.zip`,files:files.map(f=>({name:`${root}/${f.name}`,size:f.bytes.length})),notes:[...warnings,...notes],changed,
    pages:packed.variants.map(v=>v.pages.map(p=>[p.width,p.height]))});
  }
 }catch(e){post({job:msg.job,ok:false,error:String(e?.message||e),code:e?.code||''});}
};
