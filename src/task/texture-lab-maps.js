import {heightToNormal,flipGreen,combineNormals,validateNormalMap,greenBias,KERNEL_IDS,CONVENTIONS} from '../game/texture-normal.js';
import {extractChannel,invertPlane,planeStats,luminancePlane,CHANNELS} from '../game/texture-channels.js';
import {ENGINE_PRESETS,PRESET_IDS,presetChannels,presetChannel,ENGINE_DOCS} from '../game/texture-presets.js';
import {heightFromLuminance} from '../game/texture-fix.js';
import {getLocale as L} from '../i18n.js';
/** Two stages of Texture Lab that work on one texture at a time:
 *  Normal   — height → normal, OpenGL ↔ DirectX, and a Reoriented Normal Mapping combine.
 *  Channels — unpack R/G/B/A into exact single-channel PNGs, labelled by engine preset.
 * Previews are computed on an exact nearest-sampled reduction (ctx.samplePixels) so what is
 * shown for a packed channel is the real byte, premultiplication included nowhere. Exports
 * re-run the same pure function on the full-resolution exact pixels. */
export const normalDefaults=query=>({
 mode:'height',strength:clampNumber(query?.get('strength'),2,0,10),kernel:KERNEL_IDS.includes(query?.get('kernel'))?query.get('kernel'):'sobel3',
 convention:CONVENTIONS.includes(query?.get('convention'))?query.get('convention'):'opengl',
 wrap:query?.get('wrap')==='1',invertX:false,invertY:false,detail:null,detailStrength:1,source:'luminance'
});
export const channelDefaults=()=>({preset:'unreal-orm',invert:{r:false,g:false,b:false,a:false}});
const clampNumber=(value,fallback,min,max)=>{
 if(value===null||value===undefined||value==='')return fallback;
 const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
const seg=(action,key,values,label,current,esc)=>`<div class="segmented" role="group">${values.map(v=>`<button type="button" data-action="${action}" data-key="${key}" data-value="${v}" aria-pressed="${String(current)===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
const docLink=(doc,esc)=>`<a class="tex-doc" href="${esc(doc.url)}" target="_blank" rel="noopener nofollow">${esc(doc.title)}${doc.section?` — ${esc(doc.section)}`:''}</a>`;
// ---- Normal ---------------------------------------------------------------------------------
async function normalResult(ctx,pixels){
 const {state}=ctx,o=state.normal,{data,width,height}=pixels;
 if(o.mode==='convert')return {data:flipGreen(data,width,height),width,height};
 if(o.mode==='combine'){
  const detail=ctx.entryOf(o.detail);
  if(!detail)throw Error(ctx.T('pickDetail'));
  const other=await ctx.samplePixels(detail,Math.max(width,height));
  if(other.width!==width||other.height!==height)throw Error(ctx.T('sizeMismatch'));
  return {data:combineNormals(data,other.data,width,height,{strength:o.detailStrength}),width,height};
 }
 const heightPlane=o.source==='alpha'?extractChannel(data,width,height,'a'):heightFromLuminance(data,width,height);
 return {data:heightToNormal(heightPlane,width,height,{strength:o.strength,kernel:o.kernel,wrap:o.wrap,invertX:o.invertX,invertY:o.invertY,convention:o.convention}),width,height};
}
export const normalStage={
 board(ctx){
  const {T,esc,state}=ctx,entry=ctx.activeEntry(),o=state.normal;
  if(!entry)return `<p class="viewer-note">${esc(T('pickTexture'))}</p>`;
  const convention=ENGINE_DOCS.normalConvention[o.mode==='convert'?'opengl':o.convention];
  return `<div class="view-head"><strong>${esc(T('normalTitle'))}</strong><span>${esc(entry.name)} · ${entry.width}×${entry.height}</span></div>
<div class="tex-pair"><figure><figcaption>${esc(o.mode==='combine'?T('base'):T('sourceMap'))}</figcaption><canvas id="texNormalSource"></canvas></figure>
<figure><figcaption>${esc(T('result'))}</figcaption><canvas id="texNormalOut"></canvas></figure></div>
<p class="viewer-note" id="texNormalNote"></p>
<div class="view-head"><strong>${esc(T('conventionTitle'))}</strong></div>
<ul class="tex-conventions">${['opengl','directx'].map(id=>{
   const c=ENGINE_DOCS.normalConvention[id];
   return `<li class="${o.mode!=='convert'&&o.convention===id?'is-on':''}"><b>${esc(c.label[L()])}</b><span>${c.engines.map(e=>esc(T('engine.'+e))).join(' · ')}</span><em>${esc(c.documented===true?T('documented'):T('inferred'))}</em>${c.docs.map(d=>docLink(d,esc)).join('')}</li>`;
  }).join('')}</ul>
<p class="viewer-note">${esc(T('conventionNote'))}${convention.documented==='inferred'?' '+esc(T('inferredNote')):''}</p>`;
 },
 side(ctx){
  const {T,esc,state}=ctx,o=state.normal,entry=ctx.activeEntry();
  const others=state.files.filter(f=>f.id!==entry?.id);
  return `<div class="summary" id="texNormalSummary" role="status" aria-live="polite"><div class="summary-big muted">…</div><div class="summary-line">${esc(T('calculating'))}</div></div>
<form class="options" id="texOptions" autocomplete="off">
<span class="opt-label">${esc(T('normalModeLabel'))}</span>${seg('tex-normal-set','mode',['height','convert','combine'],v=>T('normalMode.'+v),o.mode,esc)}
<p class="hint">${esc(T('normalModeHint.'+o.mode))}</p>
${o.mode==='height'?`<span class="opt-label">${esc(T('convention'))}</span>${seg('tex-normal-set','convention',CONVENTIONS,v=>T('conventionShort.'+v),o.convention,esc)}
<label class="field"><span>${esc(T('strength'))} <output>${o.strength}</output></span><input type="range" data-key="strength" data-action="tex-normal-range" min="0" max="10" step="0.5" value="${o.strength}"></label>
<details class="options-advanced"><summary>${esc(ctx.text('advanced'))}</summary>
<label class="field"><span>${esc(T('kernelLabel'))}</span><select data-key="kernel" data-option="normal-kernel">${KERNEL_IDS.map(id=>`<option value="${id}" ${o.kernel===id?'selected':''}>${esc(T('kernel.'+id))}</option>`).join('')}</select></label>
<label class="check"><input type="checkbox" data-option="normal-wrap" ${o.wrap?'checked':''}> ${esc(T('wrap'))}</label>
<label class="check"><input type="checkbox" data-option="normal-invert-x" ${o.invertX?'checked':''}> ${esc(T('invertX'))}</label>
<label class="check"><input type="checkbox" data-option="normal-invert-y" ${o.invertY?'checked':''}> ${esc(T('invertY'))}</label>
<label class="field"><span>${esc(T('heightSourceLabel'))}</span><select data-option="normal-source">${['luminance','alpha'].map(id=>`<option value="${id}" ${o.source===id?'selected':''}>${esc(T('heightSource.'+id))}</option>`).join('')}</select></label>
<p class="hint">${esc(T('kernelHint'))}</p></details>`:''}
${o.mode==='combine'?`<label class="field"><span>${esc(T('detailMap'))}</span><select data-option="normal-detail">${[`<option value="">${esc(T('pickDetail'))}</option>`,...others.map(f=>`<option value="${f.id}" ${String(o.detail)===String(f.id)?'selected':''}>${esc(f.name)}</option>`)].join('')}</select></label>
<label class="field"><span>${esc(T('detailStrength'))} <output>${o.detailStrength}</output></span><input type="range" data-key="detailStrength" data-action="tex-normal-range" min="0" max="2" step="0.1" value="${o.detailStrength}"></label>
<p class="hint">${esc(T('rnmHint'))}</p>`:''}
${o.mode==='convert'?`<p class="hint">${esc(T('convertHint'))}</p>`:''}
</form>
<button type="button" class="primary big" id="taskDownload" data-action="tex-normal-save">${esc(T('saveNormal'))}</button>
<nav class="next"><span>${esc(T('nextStage'))}</span><button type="button" class="chip" data-action="tex-stage" data-stage="preview">${esc(T('stage.preview'))}</button><button type="button" class="chip" data-action="tex-stage" data-stage="channels">${esc(T('stage.channels'))}</button></nav><small class="local-note">${esc(ctx.text('local'))}</small>`;
 },
 mounted(ctx){refreshNormal(ctx);},
 input(target,ctx){
  const o=ctx.state.normal;
  if(target.dataset.action==='tex-normal-range'){
   o[target.dataset.key]=Number(target.value);
   const out=target.closest('.field')?.querySelector('output');if(out)out.textContent=target.value;
   schedule(ctx);return;
  }
  const map={'normal-kernel':'kernel','normal-source':'source','normal-detail':'detail'};
  if(map[target.dataset.option]){o[map[target.dataset.option]]=target.value||null;refreshNormal(ctx);return;}
  if(target.dataset.option==='normal-wrap'){o.wrap=target.checked;refreshNormal(ctx);return;}
  if(target.dataset.option==='normal-invert-x'){o.invertX=target.checked;refreshNormal(ctx);return;}
  if(target.dataset.option==='normal-invert-y'){o.invertY=target.checked;refreshNormal(ctx);return;}
 },
 async click(action,button,ctx){
  const o=ctx.state.normal;
  if(action==='tex-normal-set'){
   o[button.dataset.key]=button.dataset.value;
   ctx.render();return;
  }
  if(action==='tex-normal-save')await ctx.busy(()=>saveNormal(ctx));
 },
 dispose(){clearTimeout(timer);}
};
let timer=0;
const schedule=ctx=>{clearTimeout(timer);timer=setTimeout(()=>refreshNormal(ctx),90);};
async function refreshNormal(ctx){
 const entry=ctx.activeEntry();if(!entry||ctx.state.stage!=='normal')return;
 // Looked up after every await: the side panel is re-rendered while this runs, so an element
 // captured before the first await would be the detached one.
 const summary=()=>ctx.q('#texNormalSummary'),note=()=>ctx.q('#texNormalNote');
 try{
  const pixels=await ctx.samplePixels(entry);
  ctx.paint(ctx.q('#texNormalSource'),pixels.data,pixels.width,pixels.height);
  const result=await normalResult(ctx,pixels);
  ctx.paint(ctx.q('#texNormalOut'),result.data,result.width,result.height);
  const report=validateNormalMap(result.data,result.width,result.height),bias=greenBias(result.data,result.width,result.height);
  const box=summary();
  if(box)box.classList.toggle('bad',!report.looksLikeNormalMap);
  if(box)box.innerHTML=`<div class="summary-big">${report.looksLikeNormalMap?'✓':'!'}</div><div class="summary-line">${ctx.esc(ctx.T('normalCheck',{len:report.meanLength.toFixed(3),dev:report.maxDeviation.toFixed(3)}))}</div>`;
  const line=note();
  if(line)line.textContent=ctx.T('normalNote',{green:bias.aboveRatio>.5?ctx.T('greenUp'):ctx.T('greenDown'),step:pixels.step});
 }catch(error){
  const box=summary();
  if(box)box.classList.add('bad');
  if(box)box.innerHTML=`<div class="summary-big">!</div><div class="summary-line">${ctx.esc(error?.message||String(error))}</div>`;
 }
}
async function saveNormal(ctx){
 const entry=ctx.activeEntry();if(!entry)return;
 const pixels=await ctx.fullPixels(entry);
 try{
  const result=await normalResult(ctx,pixels);
  const suffix=ctx.state.normal.mode==='convert'?'-'+(ctx.state.normal.convention==='opengl'?'directx':'opengl'):'-normal';
  ctx.download(await ctx.rgbaBlob(result.data,result.width,result.height),`${ctx.stem(entry.name)}${suffix}.png`);
  ctx.toast(ctx.T('savedFull',{w:result.width,h:result.height}));
 }finally{pixels.data=null;}
}
// ---- Channels -------------------------------------------------------------------------------
export const channelStage={
 board(ctx){
  const {T,esc,state}=ctx,entry=ctx.activeEntry(),preset=ENGINE_PRESETS[state.channels.preset],locale=L();
  if(!entry)return `<p class="viewer-note">${esc(T('pickTexture'))}</p>`;
  return `<div class="view-head"><strong>${esc(T('channelsTitle'))}</strong><span>${esc(entry.name)} · ${entry.width}×${entry.height}${entry.exact?'':' · '+esc(T('notExact'))}</span></div>
<div class="tex-channels">${presetChannels(state.channels.preset).map(c=>{
   const inverted=state.channels.invert[c.channel];
   return `<figure class="tex-channel${inverted?' is-inverted':''}"><figcaption><b>${c.channel.toUpperCase()}</b> <span title="${esc(c.tooltip[locale])}">${esc(c.label[locale])}</span></figcaption>
${inverted?`<div class="tex-inout"><span><canvas id="texChannelIn-${c.channel}"></canvas><small>${esc(T('inputChannel'))}</small></span><b aria-hidden="true">→</b><span><canvas id="texChannel-${c.channel}"></canvas><small>${esc(T('outputChannel'))}</small></span></div>`:`<canvas id="texChannel-${c.channel}"></canvas>`}
<div class="tex-channel-foot"><small id="texChannelStat-${c.channel}"></small>
${c.invertOf||c.role==='roughness'?`<button type="button" class="mini-button" data-action="tex-channel-invert" data-channel="${c.channel}" aria-pressed="${!!inverted}">${esc(inverted?T('inverted'):T('invert'))}</button>`:''}
<button type="button" class="mini-button" data-action="tex-channel-save" data-channel="${c.channel}">${esc(T('savePNG'))}</button></div>
<p class="tex-tooltip">${esc(c.tooltip[locale])}</p></figure>`;
  }).join('')}</div>
<p class="viewer-note">${esc(T('channelNote',{step:state.view.channelStep||1}))}</p>
<div class="view-head"><strong>${esc(T('presetTitle'))}</strong><span>${esc(preset.summary[locale])}</span></div>
<p class="viewer-note">${esc(preset.note?.[locale]||'')} ${docLink(preset.doc,esc)} ${preset.orderDoc?docLink(preset.orderDoc,esc):''}</p>
<div class="view-head"><strong>${esc(T('packTitle'))}</strong></div>
<p class="viewer-note">${esc(T('packNote'))}</p>
<div class="chips-row"><button type="button" class="chip" data-action="tex-stage" data-stage="pack">${esc(T('stage.pack'))}</button><a class="chip" href="${esc(ctx.toolURL('mask-packer'))}">${esc(T('openPacker'))}</a></div>`;
 },
 side(ctx){
  const {T,esc,state}=ctx,locale=L();
  return `<div class="summary" role="status" aria-live="polite"><div class="summary-big">4</div><div class="summary-line">${esc(T('channelsSummary'))}</div></div>
<form class="options" id="texOptions" autocomplete="off">
<label class="field"><span>${esc(T('presetLabel'))}</span><select data-option="channel-preset">${PRESET_IDS.map(id=>`<option value="${id}" ${state.channels.preset===id?'selected':''}>${esc(ENGINE_PRESETS[id].label[locale])}</option>`).join('')}</select></label>
<p class="hint">${esc(T('presetHint'))}</p>
<details class="options-advanced"><summary>${esc(ctx.text('advanced'))}</summary><p class="hint">${esc(T('exactHint'))}</p><p class="hint">${esc(T('invertHint'))}</p></details></form>
<button type="button" class="primary big" id="taskDownload" data-action="tex-channel-all">${esc(T('saveAllChannels'))}</button>
<nav class="next"><span>${esc(T('nextStage'))}</span><button type="button" class="chip" data-action="tex-stage" data-stage="inspect">${esc(T('stage.inspect'))}</button><button type="button" class="chip" data-action="tex-stage" data-stage="fix">${esc(T('stage.fix'))}</button></nav><small class="local-note">${esc(ctx.text('local'))}</small>`;
 },
 mounted(ctx){refreshChannels(ctx);},
 input(target,ctx){
  if(target.dataset.option==='channel-preset'){ctx.state.channels.preset=PRESET_IDS.includes(target.value)?target.value:'unreal-orm';ctx.render();}
 },
 async click(action,button,ctx){
  const channels=ctx.state.channels;
  if(action==='tex-channel-invert'){
   const letter=button.dataset.channel;channels.invert[letter]=!channels.invert[letter];ctx.render();return;
  }
  if(action==='tex-channel-save')await ctx.busy(()=>saveChannels(ctx,[button.dataset.channel]));
  if(action==='tex-channel-all')await ctx.busy(()=>saveChannels(ctx,[...CHANNELS]));
 }
};
async function refreshChannels(ctx){
 const entry=ctx.activeEntry();if(!entry||ctx.state.stage!=='channels')return;
 const pixels=await ctx.samplePixels(entry);
 ctx.state.view.channelStep=pixels.step;
 for(const letter of CHANNELS){
  const source=extractChannel(pixels.data,pixels.width,pixels.height,letter);
  let plane=source;
  if(ctx.state.channels.invert[letter]){
   plane=invertPlane(source);
   // Inversion is the roughness ↔ smoothness conversion, so both sides are shown, not just the result.
   ctx.paint(ctx.q(`#texChannelIn-${letter}`),source,pixels.width,pixels.height);
  }
  ctx.paint(ctx.q(`#texChannel-${letter}`),plane,pixels.width,pixels.height);
  const stats=planeStats(plane),label=ctx.q(`#texChannelStat-${letter}`);
  if(label)label.textContent=ctx.T('channelStat',{min:stats.min,max:stats.max,mean:Math.round(stats.mean),unique:stats.unique});
 }
}
/** Channel PNGs are written from the full-resolution exact pixels, one greyscale byte per texel:
 * whatever was in the source channel is what lands in the file. */
async function saveChannels(ctx,letters){
 const entry=ctx.activeEntry();if(!entry)return;
 const pixels=await ctx.fullPixels(entry),files=[];
 try{
  for(const letter of letters){
   let plane=extractChannel(pixels.data,pixels.width,pixels.height,letter);
   const inverted=ctx.state.channels.invert[letter];
   if(inverted)plane=invertPlane(plane);
   const role=presetChannel(ctx.state.channels.preset,letter)?.role||letter;
   files.push({name:`${ctx.stem(entry.name)}-${letter}-${inverted?'inverted-':''}${role}.png`,blob:await ctx.planeBlob(plane,pixels.width,pixels.height)});
  }
 }finally{pixels.data=null;}
 if(files.length===1)ctx.download(files[0].blob,files[0].name);
 else ctx.download(await ctx.zip(files),`${ctx.stem(entry.name)}-channels.zip`);
 ctx.toast(ctx.T('savedFull',{w:entry.width,h:entry.height}));
}
export const dispose=ctx=>{clearTimeout(timer);};
export const leave=ctx=>{clearTimeout(timer);};
