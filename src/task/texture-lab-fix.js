import * as Im from '../image.js';
import {dilateEdges,mipChain,potPlan,seamMetrics,heightFromLuminance,heightFromEdges,occlusionApprox,emissionMask,maskExtract,POT_SIZES,BLEED_STEPS} from '../game/texture-fix.js';
import {planeToRGBA} from '../game/texture-channels.js';
/** The Fix stage: edge dilation, mipmap preview, power-of-two resize, seam check, and the
 * helpers that are honestly approximations (height from luminance or edges, height-based
 * occlusion, emission and mask extraction). Also the batch optimiser used by the Export stage.
 * Resampling goes through the repo's quality resampler (src/resample.js via Im.resizeQuality);
 * dilation and the approximations are the pure functions in src/game/texture-fix.js. */
export const TOOLS=Object.freeze(['bleed','mip','pot','seam','height','ao','emission','mask']);
export const defaults=()=>({tool:'bleed',bleed:4,mipLevels:4,potMode:'nearest',potMax:2048,square:false,
 heightMode:'luminance',heightSmooth:1,heightInvert:false,aoRadius:4,aoStrength:1,
 emissionMode:'threshold',emissionThreshold:200,emissionSoft:8,maskSource:'alpha',maskInvert:false,
 batchResize:'none',batchFormat:'png',batchBleed:0,quality:92});
const seg=(key,values,label,current,esc)=>`<div class="segmented" role="group">${values.map(v=>`<button type="button" data-action="tex-fix-set" data-key="${key}" data-value="${v}" aria-pressed="${String(current)===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
const field=(label,inner)=>`<label class="field"><span>${label}</span>${inner}</label>`;
const select=(option,values,label,current,esc)=>`<select data-option="${option}">${values.map(v=>`<option value="${v}" ${String(current)===String(v)?'selected':''}>${esc(label(v))}</option>`).join('')}</select>`;
/** One tool, one pure result: either RGBA (`data`) or a single plane (`plane`). */
async function result(ctx,pixels){
 const o=ctx.state.fixOptions,{data,width,height}=pixels;
 if(o.tool==='bleed'){const out=dilateEdges(data,width,height,{pixels:o.bleed});return {data:out.data,width,height,note:ctx.T('bleedNote',{n:out.filled})};}
 if(o.tool==='mip')return {chain:mipChain(data,width,height,{levels:o.mipLevels}),width,height};
 if(o.tool==='pot'){const plan=potPlan(width,height,{mode:o.potMode,max:o.potMax,square:o.square});return {plan,width,height};}
 if(o.tool==='seam')return {seam:seamMetrics(data,width,height),data,width,height};
 if(o.tool==='height'){
  const plane=o.heightMode==='edges'?heightFromEdges(data,width,height,{smooth:o.heightSmooth}):heightFromLuminance(data,width,height,{invert:o.heightInvert,smooth:o.heightSmooth});
  return {plane,width,height,note:ctx.T('approxNote')};
 }
 if(o.tool==='ao'){
  const heightPlane=heightFromLuminance(data,width,height,{smooth:1});
  return {plane:occlusionApprox(heightPlane,width,height,{radius:o.aoRadius,strength:o.aoStrength}),width,height,note:ctx.T('aoNote')};
 }
 if(o.tool==='emission')return {plane:emissionMask(data,width,height,{mode:o.emissionMode,threshold:o.emissionThreshold,soft:o.emissionSoft}),width,height,note:ctx.T('approxNote')};
 return {plane:maskExtract(data,width,height,{source:o.maskSource,invert:o.maskInvert,threshold:o.emissionThreshold,soft:o.emissionSoft}),width,height};
}
export const fixStage={
 board(ctx){
  const {T,esc,state}=ctx,o=state.fixOptions,entry=ctx.activeEntry();
  if(!entry)return `<p class="viewer-note">${esc(T('pickTexture'))}</p>`;
  const head=`<div class="view-head"><strong>${esc(T('fixTool.'+o.tool))}</strong><span>${esc(entry.name)} · ${entry.width}×${entry.height}</span></div>`;
  if(o.tool==='mip')return `${head}<div class="tex-mips" id="texMips"></div><p class="viewer-note">${esc(T('mipNote'))}</p>`;
  if(o.tool==='seam')return `${head}<div class="tex-seam"><figure><figcaption>${esc(T('repeatPreview'))}</figcaption><canvas id="texSeamTile"></canvas></figure>
<figure><figcaption>${esc(T('edgeHeat'))}</figcaption><div class="tex-strips"><canvas id="texSeamHeat" class="strip-v" aria-label="${esc(T('seamVertical'))}" role="img"></canvas><canvas id="texSeamHeatH" class="strip-h" aria-label="${esc(T('seamHorizontal'))}" role="img"></canvas></div><small id="texSeamStat"></small></figure></div><p class="viewer-note">${esc(T('seamNote'))}</p>`;
  if(o.tool==='pot')return `${head}<div class="tex-pair"><figure><figcaption>${esc(T('sourceMap'))}</figcaption><canvas id="texFixSource"></canvas></figure><figure><figcaption>${esc(T('plan'))}</figcaption><div class="tex-plan" id="texPotPlan"></div></figure></div><p class="viewer-note">${esc(T('potNote'))}</p>`;
  return `${head}<div class="tex-pair"><figure><figcaption>${esc(T('sourceMap'))}</figcaption><canvas id="texFixSource"></canvas></figure>
<figure><figcaption>${esc(T('result'))}</figcaption><canvas id="texFixOut"></canvas></figure></div>
<p class="viewer-note" id="texFixNote"></p>${o.tool==='bleed'?`<p class="viewer-note">${esc(T('bleedExplain'))}</p>`:''}`;
 },
 side(ctx){
  const {T,esc,state}=ctx,o=state.fixOptions;
  const controls=o.tool==='bleed'?`<span class="opt-label">${esc(T('bleedWidth'))}</span>${seg('bleed',BLEED_STEPS,v=>v+' px',o.bleed,esc)}`
   :o.tool==='mip'?`<span class="opt-label">${esc(T('mipLevels'))}</span>${seg('mipLevels',[2,3,4],v=>'1/'+2**v,o.mipLevels,esc)}`
   :o.tool==='pot'?`<span class="opt-label">${esc(T('potModeLabel'))}</span>${seg('potMode',['nearest','down','up','fit'],v=>T('potMode.'+v),o.potMode,esc)}
${field(esc(T('potMax')),select('fix-pot-max',POT_SIZES.filter(n=>n>=256),v=>String(v),o.potMax,esc))}
<label class="check"><input type="checkbox" data-option="fix-square" ${o.square?'checked':''}> ${esc(T('makeSquare'))}</label>`
   :o.tool==='height'?`<span class="opt-label">${esc(T('heightFromLabel'))}</span>${seg('heightMode',['luminance','edges'],v=>T('heightFrom.'+v),o.heightMode,esc)}
${field(`${esc(T('smooth'))} <output>${o.heightSmooth}</output>`,`<input type="range" data-key="heightSmooth" data-action="tex-fix-range" min="0" max="4" step="1" value="${o.heightSmooth}">`)}
<label class="check"><input type="checkbox" data-option="fix-height-invert" ${o.heightInvert?'checked':''}> ${esc(T('invertHeight'))}</label>`
   :o.tool==='ao'?`${field(`${esc(T('radius'))} <output>${o.aoRadius}</output>`,`<input type="range" data-key="aoRadius" data-action="tex-fix-range" min="1" max="16" step="1" value="${o.aoRadius}">`)}
${field(`${esc(T('strength'))} <output>${o.aoStrength}</output>`,`<input type="range" data-key="aoStrength" data-action="tex-fix-range" min="0" max="2" step="0.1" value="${o.aoStrength}">`)}`
   :o.tool==='emission'?`<span class="opt-label">${esc(T('maskModeLabel'))}</span>${seg('emissionMode',['threshold','luminance'],v=>T('maskMode.'+v),o.emissionMode,esc)}
${field(`${esc(T('threshold'))} <output>${o.emissionThreshold}</output>`,`<input type="range" data-key="emissionThreshold" data-action="tex-fix-range" min="0" max="255" step="1" value="${o.emissionThreshold}">`)}
${field(`${esc(T('soft'))} <output>${o.emissionSoft}</output>`,`<input type="range" data-key="emissionSoft" data-action="tex-fix-range" min="0" max="64" step="1" value="${o.emissionSoft}">`)}`
   :o.tool==='mask'?`<span class="opt-label">${esc(T('maskSourceLabel'))}</span>${seg('maskSource',['alpha','luminance','threshold'],v=>T('maskSource.'+v),o.maskSource,esc)}
<label class="check"><input type="checkbox" data-option="fix-mask-invert" ${o.maskInvert?'checked':''}> ${esc(T('invertMask'))}</label>`
   :'';
  return `<div class="summary" id="texFixSummary" role="status" aria-live="polite"><div class="summary-big muted">…</div><div class="summary-line">${esc(T('calculating'))}</div></div>
<form class="options" id="texOptions" autocomplete="off">
<span class="opt-label">${esc(T('fixToolLabel'))}</span><div class="chips-row" role="group">${TOOLS.map(id=>`<button type="button" class="chip ${o.tool===id?'is-on':''}" data-action="tex-fix-set" data-key="tool" data-value="${id}" aria-pressed="${o.tool===id}">${esc(T('fixTool.'+id))}</button>`).join('')}</div>
${controls}<p class="hint">${esc(T('fixHint.'+o.tool))}</p></form>
<button type="button" class="primary big" id="taskDownload" data-action="tex-fix-save">${esc(T('fixSave.'+(o.tool==='mip'?'mip':o.tool==='seam'?'seam':'file')))}</button>
<nav class="next"><span>${esc(T('nextStage'))}</span><button type="button" class="chip" data-action="tex-stage" data-stage="export">${esc(T('stage.export'))}</button><button type="button" class="chip" data-action="tex-stage" data-stage="preview">${esc(T('stage.preview'))}</button></nav><small class="local-note">${esc(ctx.text('local'))}</small>`;
 },
 mounted(ctx){refresh(ctx);},
 input(target,ctx){
  const o=ctx.state.fixOptions;
  if(target.dataset.action==='tex-fix-range'){
   o[target.dataset.key]=Number(target.value);
   const out=target.closest('.field')?.querySelector('output');if(out)out.textContent=target.value;
   schedule(ctx);return;
  }
  const checks={'fix-square':'square','fix-height-invert':'heightInvert','fix-mask-invert':'maskInvert'};
  if(checks[target.dataset.option]){o[checks[target.dataset.option]]=target.checked;refresh(ctx);return;}
  if(target.dataset.option==='fix-pot-max'){o.potMax=Number(target.value);refresh(ctx);return;}
  const batch={'batch-resize':'batchResize','batch-format':'batchFormat','batch-bleed':'batchBleed'};
  if(batch[target.dataset.option]){
   const key=batch[target.dataset.option];
   o[key]=key==='batchBleed'?Number(target.value):target.value;
   ctx.render();return;
  }
 },
 async click(action,button,ctx){
  const o=ctx.state.fixOptions;
  if(action==='tex-fix-set'){
   const value=button.dataset.value;
   o[button.dataset.key]=/^\d+(\.\d+)?$/.test(value)?Number(value):value;
   ctx.render();return;
  }
  if(action==='tex-fix-save')await ctx.busy(()=>save(ctx));
 },
 dispose(){clearTimeout(timer);},
 leave(){clearTimeout(timer);}
};
let timer=0;
const schedule=ctx=>{clearTimeout(timer);timer=setTimeout(()=>refresh(ctx),90);};
function paintStrip(canvas,profile,horizontal,ctx){
 if(!canvas)return;
 const length=profile.length,thickness=18;
 const rgba=new Uint8Array((horizontal?length*thickness:thickness*length)*4);
 const width=horizontal?length:thickness,height=horizontal?thickness:length;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const value=profile[horizontal?x:y],i=(y*width+x)*4;
  rgba.set([255,255-value,255-value,255],i);
 }
 ctx.paint(canvas,rgba,width,height);
}
async function refresh(ctx){
 const entry=ctx.activeEntry();if(!entry||ctx.state.stage!=='fix')return;
 // Re-queried after each await: renderSide() replaces the panel while this runs.
 const summary=()=>ctx.q('#texFixSummary'),o=ctx.state.fixOptions;
 try{
  const pixels=await ctx.samplePixels(entry);
  ctx.paint(ctx.q('#texFixSource'),pixels.data,pixels.width,pixels.height);
  const out=await result(ctx,pixels);
  if(out.chain){
   const host=ctx.q('#texMips');
   if(host){
    host.innerHTML=out.chain.map(m=>`<figure><figcaption>1/${2**m.level} · ${m.width}×${m.height}</figcaption><canvas data-mip="${m.level}"></canvas></figure>`).join('');
    for(const m of out.chain)ctx.paint(host.querySelector(`[data-mip="${m.level}"]`),m.data,m.width,m.height);
   }
   const box=summary();if(box)box.innerHTML=`<div class="summary-big">${out.chain.length-1}</div><div class="summary-line">${ctx.esc(ctx.T('mipSummary',{n:out.chain.length-1}))}</div>`;
   return;
  }
  if(out.plan){
   const host=ctx.q('#texPotPlan');
   if(host)host.innerHTML=`<b>${entry.width}×${entry.height}</b><span>→</span><b>${out.plan.width}×${out.plan.height}</b><em>${ctx.esc(out.plan.changed?ctx.T('potChange'):ctx.T('potAlready'))}</em>`;
   const box=summary();if(box)box.innerHTML=`<div class="summary-big">${out.plan.width}</div><div class="summary-line">${ctx.esc(out.plan.width+'×'+out.plan.height)}</div>`;
   return;
  }
  if(out.seam){
   const tile=ctx.q('#texSeamTile');
   if(tile){
    const w=pixels.width,h=pixels.height,size=2;
    const repeated=new Uint8Array(w*size*h*size*4);
    for(let y=0;y<h*size;y++)for(let x=0;x<w*size;x++){
     const source=((y%h)*w+(x%w))*4;
     repeated.set(pixels.data.subarray(source,source+4),(y*w*size+x)*4);
    }
    ctx.paint(tile,repeated,w*size,h*size);
   }
   paintStrip(ctx.q('#texSeamHeat'),out.seam.vertical.profile,false,ctx);
   paintStrip(ctx.q('#texSeamHeatH'),out.seam.horizontal.profile,true,ctx);
   const stat=ctx.q('#texSeamStat');
   if(stat)stat.textContent=ctx.T('seamStat',{v:out.seam.vertical.mean.toFixed(1),h:out.seam.horizontal.mean.toFixed(1),rv:Number.isFinite(out.seam.vertical.ratio)?out.seam.vertical.ratio.toFixed(1):'∞',rh:Number.isFinite(out.seam.horizontal.ratio)?out.seam.horizontal.ratio.toFixed(1):'∞'});
   const box=summary();if(box)box.classList.toggle('bad',!out.seam.seamless);
   if(box)box.innerHTML=`<div class="summary-big">${out.seam.seamless?'✓':'!'}</div><div class="summary-line">${ctx.esc(out.seam.seamless?ctx.T('seamOk'):ctx.T('seamBad'))}</div>`;
   return;
  }
  const data=out.plane?planeToRGBA(out.plane,out.width,out.height):out.data;
  ctx.paint(ctx.q('#texFixOut'),data,out.width,out.height);
  const note=ctx.q('#texFixNote');if(note)note.textContent=[out.note,ctx.T('previewStep',{step:pixels.step})].filter(Boolean).join(' · ');
  const box=summary();if(box)box.classList.remove('bad');
  if(box)box.innerHTML=`<div class="summary-big">✓</div><div class="summary-line">${ctx.esc(ctx.T('fixReady.'+o.tool))}</div>`;
 }catch(error){
  const box=summary();if(box)box.classList.add('bad');
  if(box)box.innerHTML=`<div class="summary-big">!</div><div class="summary-line">${ctx.esc(error?.message||String(error))}</div>`;
 }
}
/** Full-resolution export of the current Fix tool. The mipmap chain saves as a ZIP of levels;
 * the seam check has nothing to export, so it saves the heat-map strip instead. */
async function save(ctx){
 const entry=ctx.activeEntry();if(!entry)return;
 const o=ctx.state.fixOptions,pixels=await ctx.fullPixels(entry),base=ctx.stem(entry.name);
 try{
  if(o.tool==='mip'){
   const chain=mipChain(pixels.data,pixels.width,pixels.height,{levels:o.mipLevels});
   const files=[];
   for(const m of chain)files.push({name:`${base}-mip${m.level}-${m.width}x${m.height}.png`,blob:await ctx.rgbaBlob(m.data,m.width,m.height)});
   ctx.download(await ctx.zip(files),`${base}-mips.zip`);
  }else if(o.tool==='seam'){
   const seam=seamMetrics(pixels.data,pixels.width,pixels.height);
   const report={tool:'nerulio-texture-lab',check:'seam',file:entry.name,width:pixels.width,height:pixels.height,
    vertical:{meanDifference:Number(seam.vertical.mean.toFixed(2)),max:seam.vertical.max,interior:Number(seam.vertical.interior.toFixed(2)),ratio:Number.isFinite(seam.vertical.ratio)?Number(seam.vertical.ratio.toFixed(2)):null},
    horizontal:{meanDifference:Number(seam.horizontal.mean.toFixed(2)),max:seam.horizontal.max,interior:Number(seam.horizontal.interior.toFixed(2)),ratio:Number.isFinite(seam.horizontal.ratio)?Number(seam.horizontal.ratio.toFixed(2)):null},
    seamless:seam.seamless};
   ctx.download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),`${base}-seam.json`);
  }else if(o.tool==='pot'){
   const plan=potPlan(pixels.width,pixels.height,{mode:o.potMode,max:o.potMax,square:o.square});
   const next=await resample(pixels,plan.width,plan.height);
   ctx.download(await ctx.rgbaBlob(next.data,next.width,next.height),`${base}-${plan.width}x${plan.height}.png`);
  }else{
   const out=await result(ctx,pixels);
   const blob=out.plane?await ctx.planeBlob(out.plane,out.width,out.height):await ctx.rgbaBlob(out.data,out.width,out.height);
   ctx.download(blob,`${base}-${o.tool}.png`);
  }
  ctx.toast(ctx.T('savedFull',{w:pixels.width,h:pixels.height}));
 }finally{pixels.data=null;}
}
/** Quality resampling reuses src/resample.js through Im.resizeQuality; pixels go in and out
 * through a canvas, which is also why dilation runs after a resize and never before. */
async function resample(pixels,width,height){
 const source=Im.canvas(pixels.width,pixels.height);
 let scaled=null;
 try{
  source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height),0,0);
  scaled=await Im.resizeQuality(source,width,height,{});
  const data=new Uint8Array(scaled.getContext('2d').getImageData(0,0,width,height).data.buffer);
  return {data,width,height};
 }finally{Im.release(source);Im.release(scaled);}
}
export const stepSummary=(step,o,T)=>step==='resize'?(o.batchResize==='none'?T('keepSize'):T('potMode.'+o.batchResize)+' · '+o.potMax):step==='format'?o.batchFormat.toUpperCase():o.batchBleed?o.batchBleed+' px':T('noBleed');
export const pipelineFields=(o,T,esc)=>`${field(esc(T('batchResize')),select('batch-resize',['none','nearest','down','up','fit'],v=>v==='none'?T('keepSize'):T('potMode.'+v),o.batchResize,esc))}
${o.batchResize==='none'?'':field(esc(T('potMax')),select('fix-pot-max',POT_SIZES.filter(n=>n>=256),v=>String(v),o.potMax,esc))}
${field(esc(T('batchFormat')),select('batch-format',['png','webp','jpeg'],v=>v.toUpperCase(),o.batchFormat,esc))}
${field(esc(T('batchBleed')),select('batch-bleed',[0,...BLEED_STEPS],v=>v?v+' px':T('noBleed'),o.batchBleed,esc))}
<p class="hint">${esc(T('batchOrder'))}</p>`;
/** One file of the batch: resize → dilate → encode, sequentially, cancellable between steps. */
export async function optimise(entry,o,ctx){
 const abort=()=>{if(ctx.signal?.aborted)throw new DOMException('Cancelled','AbortError');};
 abort();
 let pixels=await ctx.fullPixels(entry);
 try{
  const notes=[];
  if(o.batchResize!=='none'){
   const plan=potPlan(pixels.width,pixels.height,{mode:o.batchResize,max:o.potMax});
   if(plan.changed){abort();const next=await resample(pixels,plan.width,plan.height);pixels.data=null;pixels=next;notes.push(`${plan.width}×${plan.height}`);}
  }
  abort();
  if(o.batchBleed){const out=dilateEdges(pixels.data,pixels.width,pixels.height,{pixels:o.batchBleed});pixels.data=out.data;notes.push(ctx.T('bleedNote',{n:out.filled}));}
  abort();
  const base=ctx.stem(entry.name);
  if(o.batchFormat==='png')return {name:`${base}.png`,blob:await ctx.rgbaBlob(pixels.data,pixels.width,pixels.height),note:notes.join(' · ')};
  const canvas=Im.canvas(pixels.width,pixels.height);
  try{
   canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height),0,0);
   const blob=await Im.blobOf(canvas,`image/${o.batchFormat}`,o.quality/100);
   return {name:`${base}.${o.batchFormat==='jpeg'?'jpg':o.batchFormat}`,blob,note:[...notes,o.batchFormat.toUpperCase()].join(' · ')};
  }finally{Im.release(canvas);}
 }finally{pixels.data=null;}
}
