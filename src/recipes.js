import * as Im from './image.js';
import * as P from './primitives.js';
import {fit, zip, stem, LIMITS, crc32} from './core.js';
import {t} from './i18n.js';
import {PLATFORM_PRESETS, PRINT_RATIOS, BRAND} from './platform-presets.js';

export const DEFAULTS = Object.freeze({n:32, colors:16, dither:0, outline:0, cleanup:false, background:'#ffffff', tolerance:24, padding:0, pack:false,
  threshold:8, minArea:4, align:'bottom', anchor:.5, cellW:32, cellH:32, columns:4, width:0, height:0,
  from:'#ff0000', to:'#0080ff', shading:false, platform:'all', fit:'contain', longSide:2400,
  chars:'ABCDEFGHIJKLMNOPQRSTUVWXYZ', baseline:32, mapping:[0,1,2,'one'], mode:'normal', strength:2, invertY:false, divider:.5, order:'LR'});
export function defaults(id) {
  const o={...DEFAULTS,mapping:[...DEFAULTS.mapping]};
  if(id==='palette-swap')o.tolerance=0;
  if(id==='atlas-padding')o.padding=2;
  if(id==='margin-crop'){o.threshold=245;o.padding=8;}
  if(id==='marketplace-pack'){o.width=2000;o.height=2000;}
  return o;
}
export function check(signal) { if(signal?.aborted)throw new DOMException('Cancelled','AbortError'); }
const tick = () => new Promise(resolve=>setTimeout(resolve,0));
const rgb = value => {if(!/^#[a-f0-9]{6}$/i.test(value))throw Error('Invalid color');return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));};
export const rgba = c => {P.pixels({length:c.width*c.height*4},c.width,c.height);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;};
export function fromRGBA(data,w,h){const c=Im.canvas(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);return c;}
/** A dedicated worker is terminated on cancellation; fallback is capped at 262144 pixels. */
export function primitive(kind, payload, signal) {
  return new Promise((resolve,reject)=>{
    check(signal);let worker,done=false;
    const finish=(error,result)=>{if(done)return;done=true;worker?.terminate();signal?.removeEventListener('abort',abort);error?reject(error):resolve(result);};
    const abort=()=>finish(new DOMException('Cancelled','AbortError'));
    // Some embedded browsers reject module workers. Keep a small bounded backup only.
    const backup=payload.w*payload.h<=262144?structuredClone(payload):null;
    const fallback=async()=>{
      worker?.terminate();await tick();if(done)return;
      if(!backup){finish(Error('Module worker unavailable; compatibility mode is limited to 262144 pixels'));return;}
      try{check(signal);const m=backup;let result;
        if(kind==='components')result=P.components(m.data,m.w,m.h,m.options);
        else if(kind==='swap')result=P.swap(m.data,m.w,m.h,m.options);
        else if(kind==='texture')result=P.mapTexture(m.data,m.w,m.h,m.options);
        else if(kind==='mask')result=P.packChannels(m.inputs,m.w,m.h,m.options.mapping);
        else if(kind==='extrude')result=P.extrude(m.data,m.w,m.h,m.options.cellW,m.options.cellH,m.options.padding);
        else if(kind==='margin')result=P.marginBounds(m.data,m.w,m.h,m.options.threshold,m.options.padding);
        else throw Error('Unknown primitive');check(signal);finish(null,result);
      }catch(error){finish(error);}
    };
    try{
      worker=new Worker(new URL('./recipe-worker.js',import.meta.url),{type:'module'});
      signal?.addEventListener('abort',abort,{once:true});
      worker.onerror=fallback;
      worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.result);
      // Transfer ownership of newly allocated pixels, never the live editor canvas.
      const transfer=payload.inputs?payload.inputs.map(d=>d.buffer):payload.data?[payload.data.buffer]:[];
      worker.postMessage({kind,...payload},transfer);
    }catch(error){fallback();}
  });
}
export function cropRect(source,r){P.rectangle(r,source.width,source.height);const c=Im.canvas(r.w,r.h);c.getContext('2d').drawImage(source,r.x,r.y,r.w,r.h,0,0,r.w,r.h);return c;}
export function fitCanvas(source,w,h,mode='contain',background=null,nearest=false){
  const c=Im.canvas(P.positive(w),P.positive(h)),ctx=c.getContext('2d'),r=fit(source.width,source.height,w,h,mode==='cover');
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,w,h);}ctx.imageSmoothingEnabled=!nearest;ctx.imageSmoothingQuality='high';ctx.drawImage(source,r.x,r.y,r.w,r.h);return c;
}
export async function detect(source,o,signal){
  const result=await primitive('components',{data:rgba(source),w:source.width,h:source.height,options:{threshold:o.threshold,minArea:o.minArea}},signal);check(signal);return result;
}
function jsonFile(name,value){return {name,blob:new Blob([JSON.stringify(value,null,2)],{type:'application/json'})};}
function textFile(name,value){return {name,blob:new Blob([value],{type:'text/plain;charset=utf-8'})};}
function frameBounds(c){return P.bounds(rgba(c),c.width,c.height)||{x:0,y:0,w:1,h:1};}
async function inputCanvas(item,signal){check(signal);const c=await Im.decode(item.blob);try{if(c.width*c.height>P.ANALYSIS_PIXELS)throw Error(t('kit.limit'));check(signal);return c;}catch(error){Im.release(c);throw error;}}
async function normalizeInfo(items,o,signal){
  const list=[];
  for(const item of items){const c=await inputCanvas(item,signal);try{list.push(frameBounds(c));}finally{Im.release(c);}await tick();}
  const width=o.width||Math.max(...list.map(r=>r.w)),height=o.height||Math.max(...list.map(r=>r.h));
  P.positive(width);P.positive(height);list.forEach(r=>P.placement(r.w,r.h,width,height,o.align,o.anchor));return {list,width,height};
}
/** Recipes reuse bounded primitives. Canvases are owned here until returned as the preview. */
export async function runRecipe(id,{source,items,options:o,rects=[],signal,progress=()=>{}}){
  if(!source)throw Error(t('kit.inputFirst'));
  if(source.width*source.height>P.ANALYSIS_PIXELS)throw Error(t('kit.limit'));
  let preview=null,bytes=0;const entries=[],owned=new Set();
  const own=c=>(owned.add(c),c),release=c=>{owned.delete(c);Im.release(c);};
  const append=entry=>{bytes+=entry.blob.size;if(bytes>LIMITS.totalBytes)throw Error(t('kit.limit'));entries.push(entry);};
  const add=async(c,name)=>{check(signal);append({name,blob:await Im.blobOf(c,/\.jpg$/i.test(name)?'image/jpeg':'image/png',.92)});if(!preview)preview=own(Im.resize(c,Math.min(c.width,1024),Math.max(1,Math.round(c.height*Math.min(1,1024/c.width)))));progress(`${entries.length} · ${t('kit.results')}`);await tick();};
  const simple=async c=>{own(c);check(signal);const blob=await Im.blobOf(c);owned.delete(c);return {kind:'image',canvas:c,blob,name:`${stem(items[0]?.name||'image')}-${id}.png`,width:c.width,height:c.height};};
  try{
    check(signal);
    if(id==='logo-bg')return await simple(await Im.processPixels(source,'remove',{color:rgb(o.background),tolerance:o.tolerance},progress,signal));
    if(id==='palette-swap'){const data=await primitive('swap',{data:rgba(source),w:source.width,h:source.height,options:{from:rgb(o.from),to:rgb(o.to),tolerance:o.tolerance,shading:o.shading}},signal);return await simple(fromRGBA(data,source.width,source.height));}
    if(id==='texture-map'){const data=await primitive('texture',{data:rgba(source),w:source.width,h:source.height,options:o},signal);return await simple(fromRGBA(data,source.width,source.height));}
    if(id==='margin-crop'){
      const r=await primitive('margin',{data:rgba(source),w:source.width,h:source.height,options:o},signal);
      if(!r)throw Error(t('kit.empty'));return await simple(cropRect(source,r));
    }
    if(id==='refiner'){
      P.positive(o.n,512);P.positive(o.colors,256);
      if(!Number.isInteger(o.outline)||o.outline<0||o.outline>4||!Number.isInteger(o.padding)||o.padding<0||o.padding>64)throw Error('Invalid padding');
      let cleaned=source;
      if(o.cleanup)cleaned=own(await Im.processPixels(source,'remove',{color:rgb(o.background),tolerance:o.tolerance},progress,signal));
      const b=frameBounds(cleaned),trimmed=own(cropRect(cleaned,b));
      for(const n of o.pack?[...new Set([16,32,64,128,o.n])]:[o.n]){
        const pad=Math.max(o.padding,o.outline);if(pad*2>=n)throw Error('Padding leaves no usable pixels');
        const base=own(Im.canvas(n,n)),inner=own(fitCanvas(trimmed,n-pad*2,n-pad*2));base.getContext('2d').drawImage(inner,pad,pad);release(inner);
        const out=own(await Im.processPixels(base,'pixel',{colors:o.colors,dither:o.dither,outline:o.outline},progress,signal));release(base);
        if(!o.pack){owned.delete(out);return await simple(out);}
        await add(out,`${n}x${n}/asset.png`);release(out);
      }
    }else if(id==='sprite-slicer'||id==='tile-helper'||id==='scan-split'){
      let boxes=rects;
      if(id==='tile-helper')boxes=P.grid(source.width,source.height,o.cellW,o.cellH);
      if(id==='scan-split'){
        const split=Math.round(source.width*o.divider);
        boxes=[{x:0,y:0,w:split,h:source.height},{x:split,y:0,w:source.width-split,h:source.height}];
        if(o.order==='RL')boxes.reverse();
      }
      if(!boxes.length||boxes.length>256)throw Error(t('kit.none'));
      const frames=[];
      for(let i=0;i<boxes.length;i++){
        const r=P.rectangle(boxes[i],source.width,source.height),c=own(cropRect(source,r)),name=`frames/frame-${String(i+1).padStart(3,'0')}.png`;
        await add(c,name);release(c);frames.push({name,...r});
      }
      append(jsonFile('metadata.json',{sourceWidth:source.width,sourceHeight:source.height,frames}));
    }else if(id==='frame-normalize'||id==='sprite-sheet-maker'){
      const info=await normalizeInfo(items,o,signal),layout=P.sheetLayout(items.length,info.width,info.height,o.columns,o.padding);
      const sheet=id==='sprite-sheet-maker'?own(Im.canvas(layout.width,layout.height)):null;
      for(let i=0;i<items.length;i++){
        const c=own(await inputCanvas(items[i],signal)),r=info.list[i],p=P.placement(r.w,r.h,info.width,info.height,o.align,o.anchor);
        const normalized=own(Im.canvas(info.width,info.height));normalized.getContext('2d').drawImage(c,r.x,r.y,r.w,r.h,p.x,p.y,r.w,r.h);release(c);
        layout.frames[i].sourceRect=r;layout.frames[i].offset=p;
        if(sheet)sheet.getContext('2d').drawImage(normalized,layout.frames[i].x,layout.frames[i].y);else await add(normalized,`frames/${layout.frames[i].name}.png`);
        release(normalized);check(signal);await tick();
      }
      if(sheet){await add(sheet,'sprite-sheet.png');release(sheet);}
      append(jsonFile('metadata.json',id==='sprite-sheet-maker'?layout:{frameWidth:info.width,frameHeight:info.height,frames:layout.frames.map(f=>({name:f.name,x:0,y:0,w:f.w,h:f.h,sourceRect:f.sourceRect,offset:f.offset}))}));
    }else if(id==='marketplace-pack'||id==='print-pack'){
      const presets=id==='marketplace-pack'?(o.platform==='custom'?[{name:'Custom',width:o.width,height:o.height}]:PLATFORM_PRESETS.filter(p=>o.platform==='all'||p.id===o.platform)):
        PRINT_RATIOS.map(([w,h,name])=>({name,width:Math.round(o.longSide*w/h),height:o.longSide}));
      if(!presets.length)throw Error('Unknown preset');
      for(let i=0;i<items.length;i++){
        const c=own(await inputCanvas(items[i],signal));
        for(const p of presets){check(signal);const out=own(fitCanvas(c,p.width,p.height,o.fit,o.background));await add(out,`${p.name}/${String(i+1).padStart(3,'0')}-${stem(items[i].name)}.jpg`);release(out);}
        release(c);
      }
      append(jsonFile('presets.json',presets));
    }else if(id==='bitmap-font'){
      const meta=P.fontMetadata(source.width,source.height,o.cellW,o.cellH,o.chars,o.baseline);
      await add(source,'font.png');append(jsonFile('font.json',meta));
      const fnt=`info face="FileForge Grid" size=${o.cellH} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0\ncommon lineHeight=${o.cellH} base=${o.baseline} scaleW=${source.width} scaleH=${source.height} pages=1 packed=0\npage id=0 file="font.png"\nchars count=${meta.glyphs.length}\n`+meta.glyphs.map(g=>`char id=${g.codepoint} x=${g.x} y=${g.y} width=${g.w} height=${g.h} xoffset=0 yoffset=0 xadvance=${o.cellW} page=0 chnl=15`).join('\n');
      append(textFile('font.fnt',fnt));
      append(textFile('README.txt','Fixed-width BMFont text format and generic JSON. Keep font.png beside font.fnt. Godot: import both into your project, then assign the imported font.fnt FontFile to the Font theme override of a Label or other Control. Set the font size to the cell height. Consult https://docs.godotengine.org/en/stable/classes/class_fontfile.html . No .tres resource is synthesized. Godot runtime import was not exercised in this release. Adjust metrics in your engine if required.'));
    }else if(id==='mask-packer'){
      const buffers=[],w=source.width,h=source.height;
      // Four channels need at most four sources; input order is visible in the editor.
      for(let i=0;i<Math.min(items.length,4);i++){
        const c=own(await inputCanvas(items[i],signal));if(c.width!==w||c.height!==h)throw Error(t('kit.sizeMismatch'));buffers.push(rgba(c));release(c);
      }
      const data=await primitive('mask',{inputs:buffers,w,h,options:{mapping:o.mapping}},signal);check(signal);const blob=pngRGBA(data,w,h),canvas=own(fromRGBA(data,w,h));owned.delete(canvas);return {kind:'image',canvas,blob,name:'packed-mask.png',width:w,height:h};
    }else if(id==='atlas-padding'){
      const out=await primitive('extrude',{data:rgba(source),w:source.width,h:source.height,options:o},signal),c=own(fromRGBA(out.data,out.width,out.height));
      await add(c,'padded-atlas.png');release(c);const {data,...metadata}=out;append(jsonFile('metadata.json',metadata));
    }else if(id==='favicon-pack'){
      const icons=[];
      for(const n of [16,32,48,180,192,512]){
        const c=own(fitCanvas(source,n,n,'contain',null)),name=n===180?'apple-touch-icon.png':n>=192?`icon-${n}.png`:`favicon-${n}.png`;
        await add(c,name);if(n<=48)icons.push({size:n,blob:entries.at(-1).blob});release(c);
      }
      append({name:'favicon.ico',blob:await ico(icons)});
      append(jsonFile('site.webmanifest',{name:BRAND.name,icons:[192,512].map(n=>({src:`icon-${n}.png`,sizes:`${n}x${n}`,type:'image/png',purpose:'any'}))}));
      append(textFile('head.html','<link rel="icon" href="favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">\n<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">\n<link rel="manifest" href="site.webmanifest">'));
      append(textFile('README.txt','Replace the manifest name with your app name. This is an icon fragment, not a complete PWA. ICO contains PNG-compressed 16/32/48 entries; legacy Windows decoders may require DIB instead. No maskable safe-zone promise. No source logo watermark.'));
    }else throw Error('Unknown recipe');
    check(signal);const blob=await zip(entries,{paths:true});check(signal);
    const result={kind:'file',canvas:preview,blob,name:`${id}.zip`,width:preview?.width,height:preview?.height,outputCount:entries.length};owned.delete(preview);return result;
  }finally{for(const c of owned)Im.release(c);}
}
/** Modern ICO directory with real embedded PNG images; no extension renaming. */
export async function ico(images){
  const header=new Uint8Array(6+images.length*16),v=new DataView(header.buffer);v.setUint16(2,1,true);v.setUint16(4,images.length,true);let offset=header.length;
  images.forEach(({size,blob},i)=>{const p=6+i*16;header[p]=size===256?0:size;header[p+1]=header[p];v.setUint16(p+4,1,true);v.setUint16(p+6,32,true);v.setUint32(p+8,blob.size,true);v.setUint32(p+12,offset,true);offset+=blob.size;});
  return new Blob([header,...images.map(x=>x.blob)],{type:'image/x-icon'});
}
export async function shareCard(original,result,locale='en'){
  const c=Im.canvas(1200,630),ctx=c.getContext('2d');
  try{
    ctx.fillStyle='#111827';ctx.fillRect(0,0,1200,630);ctx.fillStyle='#ffffff';ctx.font='bold 30px sans-serif';
    const label={ko:['원본','결과'],en:['Original','Result'],ja:['元画像','結果']}[locale]||['Original','Result'];
    for(const [i,src] of [original,result].entries()){
      ctx.fillText(label[i],50+i*600,60);const r=fit(src.width,src.height,500,440,false);ctx.fillStyle='#e5e7eb';ctx.fillRect(50+i*600,88,500,440);ctx.imageSmoothingEnabled=false;ctx.drawImage(src,50+i*600+r.x,88+r.y,r.w,r.h);ctx.font='22px sans-serif';ctx.fillStyle='#ffffff';ctx.fillText(`${src.width} × ${src.height}`,50+i*600,570);ctx.font='bold 30px sans-serif';
    }
    ctx.font='16px sans-serif';ctx.fillStyle='#cbd5e1';ctx.fillText(BRAND.shareCaption,50,610);return await Im.blobOf(c);
  }finally{Im.release(c);}
}

/** Lossless straight-alpha RGBA PNG. Canvas encoding would erase RGB when alpha=0. */
export function pngRGBA(data,w,h){
  P.pixels(data,w,h);const raw=new Uint8Array(h*(w*4+1));
  for(let y=0;y<h;y++)raw.set(data.subarray(y*w*4,(y+1)*w*4),y*(w*4+1)+1);
  const blocks=Math.ceil(raw.length/65535),z=new Uint8Array(2+raw.length+blocks*5+4);z.set([0x78,0x01]);let at=2,a=1,b=0;
  for(let i=0;i<raw.length;i+=65535){const n=Math.min(65535,raw.length-i);z[at++]=i+n===raw.length?1:0;z[at++]=n&255;z[at++]=n>>>8;z[at++]=(~n)&255;z[at++]=(~n>>>8)&255;z.set(raw.subarray(i,i+n),at);at+=n;}
  for(const v of raw){a=(a+v)%65521;b=(b+a)%65521;}new DataView(z.buffer).setUint32(at,(b<<16|a)>>>0);
  const chunk=(name,payload)=>{const c=new Uint8Array(payload.length+12),v=new DataView(c.buffer);v.setUint32(0,payload.length);c.set(new TextEncoder().encode(name),4);c.set(payload,8);v.setUint32(c.length-4,crc32(c.subarray(4,c.length-4)));return c;};
  const head=new Uint8Array(13),v=new DataView(head.buffer);v.setUint32(0,w);v.setUint32(4,h);head.set([8,6,0,0,0],8);
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',z),chunk('IEND',new Uint8Array())],{type:'image/png'});
}
