import {bytes,stem} from '../core.js';
import {t} from '../i18n.js';
import {openMedia,seek,frameImage,exportGif,exportAudio,exportVideo,estimateGif,thumbnails,releaseOutput,COMPAT} from '../media.js';
import {text,toast,download,authorize,track,onLocale,continueWith,page as route} from './shell.js';
/** One page per video job (GIF, audio, compress, trim, frame): a player with a draggable trim
 * timeline, result settings as chips, one Run button, a real percentage with cancel, then the
 * result itself — GIF as an image, audio in a player, video in a player — with size before
 * and after. Encoding is expensive, so it waits for Run; the defaults are good enough that
 * one click is the whole job. */
export const accept='video/*,audio/*,.mp4,.mov,.m4v,.webm,.mkv,.mp3,.wav,.m4a,.ogg';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const JOB={'video-gif':'gif','video-mp3':'audio','video-compress':'compress','video-trim':'trim','video-frame':'frame'};
const JOBS=['gif','audio','compress','trim','frame'];
const EXT={gif:'gif',frame:'png'},STEP=1/30;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const time=s=>{const v=Math.max(0,s||0),m=Math.floor(v/60);return `${m}:${String(Math.floor(v%60)).padStart(2,'0')}.${String(Math.floor(v*100)%100).padStart(2,'0')}`;};
function defaults(query){
 const n=(k,f)=>{const v=Number(query.get(k));return Number.isFinite(v)&&v>0?v:f;};
 return {start:0,end:0,width:n('w',480),fps:n('fps',15),speed:1,loop:true,reverse:false,ratio:'',colors:256,dither:0,gifMB:n('mb',0),
  audioFormat:query.get('format')==='wav'?'wav':'mp3',audioBitrate:192,fadeIn:0,fadeOut:0,normalize:false,rate:0,
  quality:'balanced',cap:0,targetMB:n('mb',0),mute:false,format:'mp4',mode:'precise',frameFormat:'png'};
}
export function mount({el,def}){
 const T=(k,v)=>text('media.'+k,v);
 let info=null,job=JOB[route.id]||'gif',o=defaults(route.query),busy=false,abort=null,result=null,resultURL='',view='result';
 let strip=[],estimate=null,estimateSeq=0,estimateBusy=false,drag='',timer=0;
 const video=()=>el.querySelector('#video');
 const seg=(id,key,values,label,hint)=>`<div class="segmented" role="group" id="${id}">${values.map(v=>`<button type="button" data-action="media-set" data-key="${key}" data-value="${v}" aria-pressed="${String(o[key])===String(v)}">${esc(label(v))}${hint?.(v)?`<small>${esc(hint(v))}</small>`:''}</button>`).join('')}</div>`;
 const check=(id,key,label)=>`<label class="check"><input id="${id}" type="checkbox" data-key="${key}" ${o[key]?'checked':''}> ${esc(label)}</label>`;
 const num=(id,key,label,max,step=1,hint='')=>`<label class="field"><span>${esc(label)}</span><input id="${id}" type="number" data-key="${key}" min="0" max="${max}" step="${step}" value="${o[key]}" inputmode="decimal">${hint?`<small>${esc(hint)}</small>`:''}</label>`;
 const audioOnly=()=>!!info&&!info.w;
 const canEncode=()=>!!info?.webCodecs;
 /** Everything the engine needs for the current job; also what `authorize` is asked about. */
 function plan(){
  const mode=canEncode()?o.mode:'compatibility';
  if(job==='gif')return {mode:canEncode()?'precise':'compatibility',width:o.width||(canEncode()?info?.w||640:COMPAT.gifSide),fps:o.fps,colors:o.colors,dither:o.dither,speed:o.speed,reverse:o.reverse,loop:o.loop,crop:o.ratio,targetMB:o.gifMB};
  if(job==='audio')return {mode:canEncode()?'precise':'compatibility',format:o.audioFormat,audioBitrate:o.audioBitrate,fadeIn:o.fadeIn,fadeOut:o.fadeOut,normalize:o.normalize,sampleRate:o.rate};
  if(job==='frame')return {format:o.frameFormat};
  const preset=o.quality==='high'?'best':o.quality==='small'?'small':'balanced';
  return {mode:job==='trim'?mode:canEncode()?'precise':'compatibility',format:canEncode()?o.format:'webm',width:o.cap&&info?.h?Math.round(o.cap*info.w/info.h):0,preset,targetMB:job==='compress'?o.targetMB:0,mute:o.mute,fps:0};
 }
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  el.innerHTML=`<div class="work media-work"><section class="board">
<div class="media-tabs" id="mediaTabs" hidden><button type="button" class="mini-button" data-action="media-view" data-view="result" aria-pressed="true">${esc(T('result'))}</button><button type="button" class="mini-button" data-action="media-view" data-view="source" aria-pressed="false">${esc(T('source'))}</button></div>
<div class="media-stage" id="mediaStage"><video id="video" playsinline preload="auto" controls></video><div class="media-art" id="mediaArt" hidden></div><div class="media-out" id="mediaOut" hidden></div></div>
<div class="transport"><button type="button" class="mini-button" data-action="media-prev" title="${esc(T('prev'))}" aria-label="${esc(T('prev'))}">⏮</button><button type="button" class="mini-button" id="mediaPlay" data-action="media-play" aria-label="${esc(T('play'))}">▶</button><button type="button" class="mini-button" data-action="media-next" title="${esc(T('next'))}" aria-label="${esc(T('next'))}">⏭</button><span class="transport-time" id="mediaClock">0:00.00</span><span class="transport-end" id="mediaLength"></span><span class="transport-tools"><button type="button" class="mini-button" data-action="media-in">${esc(T('setIn'))}</button><button type="button" class="mini-button" data-action="media-out">${esc(T('setOut'))}</button><button type="button" class="mini-button" data-action="media-whole">${esc(T('whole'))}</button></span></div>
<div class="tl" id="tl"><div class="tl-strip" id="tlStrip"></div><div class="tl-dim l" id="tlDimL"></div><div class="tl-dim r" id="tlDimR"></div><div class="tl-head" id="tlHead"></div>
<button type="button" class="tl-handle in" id="tlIn" data-handle="in" role="slider" aria-label="${esc(T('inHandle'))}" aria-valuemin="0" aria-valuenow="0" aria-valuemax="0"></button><button type="button" class="tl-handle out" id="tlOut" data-handle="out" role="slider" aria-label="${esc(T('outHandle'))}" aria-valuemin="0" aria-valuenow="0" aria-valuemax="0"></button></div>
<div class="time-row"><label class="field inline"><span>${esc(T('start'))}</span><input id="mediaStart" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label><label class="field inline"><span>${esc(T('end'))}</span><input id="mediaEnd" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label><span class="time-span" id="mediaSpan"></span></div>
<p class="viewer-note" id="mediaHint">${esc(T('sectionHint'))}</p></section>
<aside class="side"><div class="summary" id="mediaSummary" role="status" aria-live="polite"></div>
${route.id==='media'?`<span class="opt-label">${esc(T('jobLabel'))}</span><div class="segmented" role="group" id="mediaJob">${JOBS.map(j=>`<button type="button" data-action="media-job" data-job="${j}" aria-pressed="${job===j}">${esc(T('job.'+j))}</button>`).join('')}</div>`:''}
<form id="taskOptions" class="options" autocomplete="off"><div class="options-simple" id="mediaSimple"></div><details class="options-advanced" id="optionsAdvanced"><summary>${esc(text('advanced'))}</summary><div id="mediaAdvanced"></div></details></form>
<p class="hint warning" id="mediaWarn" hidden></p>
<div class="file-list" id="mediaFile"></div><div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(text('add'))}</button><button type="button" class="link" data-action="media-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="mediaRun" data-action="media-run" disabled></button>
<div class="progress" id="mediaProgress" hidden><div class="progress-bar"><span id="mediaBar"></span></div><div class="progress-row"><span id="mediaPhase"></span><button type="button" class="link" data-action="media-cancel">${esc(T('cancel'))}</button></div></div>
<div class="result-box" id="mediaResult" hidden></div>
<button type="button" class="primary big" id="taskDownload" data-action="media-download" disabled>${esc(text('download'))}</button>
<nav class="next" id="mediaNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
  const v=video();
  v.addEventListener('timeupdate',clock);v.addEventListener('play',()=>playIcon(true));v.addEventListener('pause',()=>playIcon(false));
  v.addEventListener('loadeddata',()=>{renderTimeline();renderSummary();});
  renderOptions();
 }
 function renderOptions(){
  const simple=el.querySelector('#mediaSimple'),adv=el.querySelector('#mediaAdvanced');if(!simple)return;
  const label=k=>T(k);
  if(job==='gif'){
   simple.innerHTML=`<span class="opt-label">${esc(label('width'))}</span>${seg('gifWidth','width',[320,480,640,0],v=>v?v+'px':T('original'))}
<span class="opt-label">${esc(label('fps'))}</span>${seg('gifFps','fps',[10,15,24],v=>v+' fps')}
<span class="opt-label">${esc(label('speed'))}</span>${seg('gifSpeed','speed',[0.5,1,2],v=>v+'×')}
<div class="chips-row">${check('gifLoop','loop',label('loop'))}${check('gifReverse','reverse',label('reverse'))}</div>
<span class="opt-label">${esc(label('crop'))}</span>${seg('gifRatio','ratio',['','1:1','4:5','16:9'],v=>v||T('cropNone'))}
${num('gifTarget','gifMB',label('target'),512,0.1,label('targetHint'))}`;
   adv.innerHTML=`<span class="opt-label">${esc(label('colors'))}</span>${seg('gifColors','colors',[256,128,64,32],v=>String(v))}
<span class="opt-label">${esc(label('dither'))}</span>${seg('gifDither','dither',[0,0.5,1],v=>v?Math.round(v*100)+'%':T('ditherNone'))}
<p class="hint">${esc(label('estimateHint'))}</p>`;
  }else if(job==='audio'){
   simple.innerHTML=`<span class="opt-label">${esc(label('format'))}</span>${seg('audioFormat','audioFormat',['mp3','wav'],v=>v.toUpperCase())}
<span class="opt-label">${esc(label('bitrate'))}</span>${seg('audioBitrate','audioBitrate',[128,192,256,320],v=>String(v))}`;
   adv.innerHTML=`<div class="field-row">${num('audioFadeIn','fadeIn',label('fadeIn'),60,0.1)}${num('audioFadeOut','fadeOut',label('fadeOut'),60,0.1)}</div>
${check('audioNormalize','normalize',label('normalize'))}
<span class="opt-label">${esc(label('rate'))}</span>${seg('audioRate','rate',[0,44100,48000],v=>v?v/1000+' kHz':T('original'))}`;
  }else if(job==='frame'){
   simple.innerHTML=`<span class="opt-label">${esc(label('format'))}</span>${seg('frameFormat','frameFormat',['png','jpeg','webp'],v=>v==='jpeg'?'JPG':v.toUpperCase())}`;
   adv.innerHTML=`<p class="hint">${esc(T('sectionHint'))}</p>`;
  }else{
   const caps=[0,1080,720,480];
   simple.innerHTML=`${job==='compress'?`<span class="opt-label">${esc(label('qualityLabel'))}</span>${seg('videoQuality','quality',['small','balanced','high'],v=>T('quality.'+v),v=>T('qualityHint.'+v))}
${num('videoTarget','targetMB',label('target'),4096,0.5,label('targetHint'))}`:''}
<span class="opt-label">${esc(label('cap'))}</span>${seg('videoCap','cap',caps,v=>v?v+'p':T('original'))}
<div class="chips-row">${check('videoMute','mute',label('mute'))}</div>`;
   adv.innerHTML=`<span class="opt-label">${esc(label('format'))}</span>${seg('videoFormat','format',info?.mp4?['mp4','webm']:['webm'],v=>v==='mp4'?'MP4 · H.264':'WebM')}
${job==='trim'?`<span class="opt-label">${esc(label('modeLabel'))}</span>${seg('videoMode','mode',['precise','fast'],v=>T('mode.'+v))}<p class="hint">${esc(label('modeHint'))}</p>`:''}
${num('videoAudioBitrate','audioBitrate',label('bitrate'),320,1)}`;
  }
 }
 const pct=v=>info&&info.duration>0?clamp(v/info.duration,0,1)*100:0;
 function renderTimeline(){
  if(!info)return;const tl=el.querySelector('#tl');if(!tl)return;
  const a=pct(o.start),b=pct(o.end);
  el.querySelector('#tlDimL').style.width=a+'%';el.querySelector('#tlDimR').style.width=(100-b)+'%';
  const i=el.querySelector('#tlIn'),ou=el.querySelector('#tlOut');
  i.style.left=a+'%';ou.style.left=b+'%';
  for(const [node,value]of [[i,o.start],[ou,o.end]]){node.setAttribute('aria-valuenow',value.toFixed(2));node.setAttribute('aria-valuemax',info.duration.toFixed(2));node.setAttribute('aria-valuetext',time(value));}
  el.querySelector('#mediaStart').value=o.start.toFixed(2);el.querySelector('#mediaEnd').value=o.end.toFixed(2);
  el.querySelector('#mediaSpan').textContent=time(o.end-o.start);
  el.querySelector('#mediaLength').textContent='/ '+time(info.duration);
  clock();
 }
 function clock(){
  const v=video();if(!v||!info)return;
  el.querySelector('#mediaClock').textContent=time(v.currentTime);
  const head=el.querySelector('#tlHead');if(head)head.style.left=pct(v.currentTime)+'%';
 }
 const playIcon=on=>{const b=el.querySelector('#mediaPlay');if(b){b.textContent=on?'❚❚':'▶';b.setAttribute('aria-label',on?T('pause'):T('play'));}};
 function renderStrip(){
  const host=el.querySelector('#tlStrip');if(!host)return;
  host.innerHTML=strip.map(s=>`<img src="${s}" alt="" draggable="false">`).join('');
 }
 function renderSummary(){
  const box=el.querySelector('#mediaSummary'),run=el.querySelector('#mediaRun'),warn=el.querySelector('#mediaWarn');if(!box||!info)return;
  const span=o.end-o.start,gif=job==='gif';
  // A GIF or a still is judged by its own size; a compressed clip by how much it saved.
  const big=result?(['gif','frame'].includes(job)?bytes(result.blob.size):result.blob.size<=info.file.size?T('savedPct',{n:Math.round((1-result.blob.size/info.file.size)*100)}):T('grew',{n:Math.round((result.blob.size/info.file.size-1)*100)})):gif&&estimate?T('estimate',{size:bytes(estimate.bytes)}):time(span);
  const line=result?T('sizeLine',{a:bytes(info.file.size),b:bytes(result.blob.size)}):gif?(estimateBusy?T('estimating'):T('frames',{n:estimate?estimate.frames:Math.max(1,Math.round(span/o.speed*o.fps))})):`${bytes(info.file.size)} · ${info.w?`${info.w}×${info.h}`:T('audioOnly')}`;
  box.innerHTML=`<div class="summary-big">${esc(big)}</div><div class="summary-line">${esc(line)}</div>`;
  const blocked=blocker();
  run.disabled=busy||!!blocked;run.textContent=busy?T('working'):T('run.'+job,{f:o.audioFormat.toUpperCase()});
  const note=blocked||engineNote();warn.hidden=!note;if(note)warn.textContent=note;
  const art=el.querySelector('#mediaArt');art.hidden=!audioOnly()||!!result;art.textContent=audioOnly()?T('audioOnly'):'';
  el.querySelector('#mediaFile').innerHTML=`<div class="file"><span class="file-main static"><span><b>${esc(info.file.name)}</b><small>${esc(T('opened',{name:info.w?`${info.w}×${info.h}`:T('audioOnly'),duration:info.duration.toFixed(1),size:bytes(info.file.size)}))}</small></span></span></div>`;
 }
 /** Why Run cannot work at all, in the visitor's words — never a silent failure. */
 function blocker(){
  if(!info)return '';
  if(audioOnly()&&job!=='audio')return T('noVideo');
  if(job==='audio'&&!info.audio)return T('noAudio');
  if(['compress','trim'].includes(job)&&!canEncode()&&!(window.MediaRecorder&&HTMLVideoElement.prototype.captureStream))return T('cannotEncode');
  return '';
 }
 const engineNote=()=>canEncode()?'':job==='gif'?T('compatGif'):job==='audio'?T('compatAudio'):T('compatVideo');
 function renderProgress(label,fraction){
  const box=el.querySelector('#mediaProgress');if(!box)return;
  box.hidden=!busy;el.querySelector('#mediaPhase').textContent=label||'';
  el.querySelector('#mediaBar').style.width=Number.isFinite(fraction)?Math.round(fraction*100)+'%':'';
  el.querySelector('#mediaBar').classList.toggle('indeterminate',!Number.isFinite(fraction));
 }
 function renderResult(){
  const box=el.querySelector('#mediaResult'),out=el.querySelector('#mediaOut'),tabs=el.querySelector('#mediaTabs'),save=el.querySelector('#taskDownload');if(!box)return;
  save.disabled=!result;box.hidden=!result;tabs.hidden=!result;
  if(!result){out.hidden=true;out.innerHTML='';video().hidden=false;el.querySelector('#mediaNext').innerHTML='';return;}
  const r=result.report||{},notes=[];
  if(r.targetMB)notes.push(r.targetMet?T('targetMet',{n:r.targetMB}):T('targetMissed',{n:r.targetMB,size:bytes(result.blob.size)}));
  if(r.requestedWidth&&r.w&&r.w<r.requestedWidth)notes.push(T('shrunk',{w:r.w}));
  if(r.passes>1)notes.push(T('pass',{n:r.passes}));
  box.innerHTML=`<strong>${esc(T('result'))}</strong><span>${esc(T('sizeLine',{a:bytes(info.file.size),b:bytes(result.blob.size)}))}${r.w?' · '+r.w+'×'+r.h:''}${r.frames?' · '+T('frames',{n:r.frames}):''}</span>${notes.length?`<small class="result-note">${esc(notes.join(' '))}</small>`:''}`;
  out.innerHTML=result.kind==='image'?`<img src="${resultURL}" alt="${esc(T('result'))}">`:result.kind==='audio'?`<audio controls src="${resultURL}"></audio>`:`<video controls playsinline src="${resultURL}"></video>`;
  const showing=view==='result';out.hidden=!showing;video().hidden=showing;
  for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.view===view));
  el.querySelector('#mediaNext').innerHTML=`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="media-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
 }
 const render=()=>{renderTimeline();renderSummary();renderResult();};
 function clearResult(){
  if(!result)return;const old=result.blob;result=null;if(resultURL)URL.revokeObjectURL(resultURL);resultURL='';view='result';
  releaseOutput(old).catch(()=>{});
 }
 /** GIF size is the knob people get wrong, so it is measured from three real frames. */
 function scheduleEstimate(){
  if(job!=='gif'||!info||!info.w||!canEncode())return;
  clearTimeout(timer);timer=setTimeout(async()=>{
   const seq=++estimateSeq;estimateBusy=true;renderSummary();
   try{const report=await estimateGif(info,o.start,o.end,plan(),null);if(seq!==estimateSeq)return;estimate=report;}
   catch{if(seq===estimateSeq)estimate=null;}
   finally{if(seq===estimateSeq){estimateBusy=false;renderSummary();}}
  },350);
 }
 async function loadStrip(){
  if(!info?.w)return;
  try{const list=await thumbnails(info,{start:0,end:info.duration,count:10,width:120},null);
   for(const u of strip)URL.revokeObjectURL(u);
   strip=list.map(x=>URL.createObjectURL(x.blob));renderStrip();
  }catch{}
 }
 async function add(files){
  if(busy)return;const file=files[0];busy=true;
  try{
   const fresh=!info;if(fresh)frame();
   clearResult();for(const u of strip)URL.revokeObjectURL(u);strip=[];estimate=null;
   if(info){video().pause();URL.revokeObjectURL(info.url);info=null;}
   info=await openMedia(video(),file,null);
   if(route.id==='media'&&audioOnly())job='audio';
   o.start=0;o.end=job==='gif'?Math.min(info.duration,6):info.duration;
   renderOptions();render();renderStrip();track('tool_run',{intent:route.id});
   loadStrip();scheduleEstimate();
  }catch(error){toast(error?.message||String(error),{error:true});if(!info)empty();}
  finally{busy=false;if(info)renderSummary();}
 }
 async function run(){
  if(!info||busy||blocker())return;
  const options=plan();
  // A still frame costs no quota (src/quota.js); every encoded export does.
  if(!await authorize(job==='frame'?'video-frame':route.id,options))return;
  busy=true;abort=new AbortController();clearResult();render();renderProgress(T('working'),NaN);
  const progress=(label,fraction)=>renderProgress(label,fraction);
  const base=stem(info.file.name);
  try{
   let blob,kind,name;
   if(job==='frame'){const shot=await frameImage(video(),info,video().currentTime,o.frameFormat,abort.signal);blob=shot.blob;kind='image';name=`${base}-frame.${o.frameFormat==='jpeg'?'jpg':o.frameFormat}`;info.lastReport={engine:'WebCodecs',w:shot.w,h:shot.h,outputBytes:blob.size};}
   else if(job==='gif'){blob=await exportGif(video(),info,o.start,o.end,progress,abort.signal,options);kind='image';name=`${base}.gif`;}
   else if(job==='audio'){blob=await exportAudio(info,o.start,o.end,o.audioFormat,progress,abort.signal,options);kind='audio';name=`${base}.${o.audioFormat}`;}
   else{blob=await exportVideo(video(),info,o.start,o.end,options.width,progress,abort.signal,options);kind='video';name=`${base}-${job==='compress'?'small':'cut'}.${info.lastReport?.format||options.format}`;}
   result={blob,kind,name,report:info.lastReport||{}};resultURL=URL.createObjectURL(blob);view='result';
   track('tool_success',{intent:route.id});
  }catch(error){
   if(error?.name!=='AbortError'){toast(error?.message||String(error),{error:true});track('tool_error',{intent:route.id,error_code:'processing_failed'});}
  }finally{busy=false;abort=null;renderProgress('',NaN);render();}
 }
 function setTime(which,value){
  if(!info)return;const min=.02;
  if(which==='in')o.start=clamp(value,0,Math.max(0,o.end-min));
  else o.end=clamp(value,Math.min(info.duration,o.start+min),info.duration);
  renderTimeline();renderSummary();scheduleEstimate();
 }
 const atX=x=>{const box=el.querySelector('#tl').getBoundingClientRect();return clamp((x-box.left)/box.width,0,1)*info.duration;};
 async function jump(to){if(!info)return;try{await seek(video(),to,null);}catch{}clock();}
 el.addEventListener('pointerdown',e=>{
  if(!info)return;const handle=e.target.closest?.('.tl-handle');
  if(handle){drag=handle.dataset.handle;handle.setPointerCapture?.(e.pointerId);e.preventDefault();return;}
  if(e.target.closest?.('#tl')){const to=atX(e.clientX);jump(to);}
 });
 el.addEventListener('pointermove',e=>{if(!drag||!info)return;e.preventDefault();const to=atX(e.clientX);setTime(drag,to);jump(to);});
 el.addEventListener('pointerup',()=>{drag='';});
 el.addEventListener('pointercancel',()=>{drag='';});
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='media-set'){const raw=b.dataset.value,key=b.dataset.key,value=raw===''?'':/^-?[\d.]+$/.test(raw)?Number(raw):raw;o[key]=value;
   for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
   if(key==='audioFormat'||key==='format')renderOptions();
   clearResult();render();scheduleEstimate();}
  else if(a==='media-job'){job=b.dataset.job;for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));
   if(job==='gif'&&o.end-o.start>20)o.end=Math.min(info.duration,o.start+6);
   clearResult();renderOptions();render();scheduleEstimate();}
  else if(a==='media-play'){const v=video();if(v.paused){if(v.currentTime<o.start-.05||v.currentTime>o.end)await jump(o.start);v.play().catch(()=>{});}else v.pause();}
  else if(a==='media-prev')jump(Math.max(0,video().currentTime-STEP));
  else if(a==='media-next')jump(Math.min(info.duration,video().currentTime+STEP));
  else if(a==='media-in')setTime('in',video().currentTime);
  else if(a==='media-out')setTime('out',video().currentTime);
  else if(a==='media-whole'){o.start=0;o.end=info.duration;renderTimeline();renderSummary();scheduleEstimate();}
  else if(a==='media-view'){view=b.dataset.view;renderResult();}
  else if(a==='media-run')run();
  else if(a==='media-cancel')abort?.abort();
  else if(a==='media-download'&&result)download(result.blob,result.name);
  else if(a==='media-next'&&result)continueWith(b.dataset.tool,[new File([result.blob],result.name,{type:result.blob.type})]);
  else if(a==='media-clear'){abort?.abort();clearResult();for(const u of strip)URL.revokeObjectURL(u);strip=[];estimate=null;
   if(info){video().pause();URL.revokeObjectURL(info.url);info=null;}empty();}
 });
 el.addEventListener('input',e=>{
  const node=e.target;if(!info)return;
  if(node.id==='mediaStart')return setTime('in',Number(node.value));
  if(node.id==='mediaEnd')return setTime('out',Number(node.value));
  const key=node.dataset.key;if(!key)return;
  o[key]=node.type==='checkbox'?node.checked:clamp(Number(node.value)||0,0,1e6);
  clearResult();renderSummary();renderResult();scheduleEstimate();
 });
 el.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  const handle=e.target.closest?.('.tl-handle');
  if(handle&&info&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
   e.preventDefault();const which=handle.dataset.handle,step=(e.shiftKey?1:STEP)*(e.key==='ArrowLeft'?-1:1),now=which==='in'?o.start:o.end;
   setTime(which,e.key==='Home'?0:e.key==='End'?info.duration:now+step);jump(which==='in'?o.start:o.end);
  }
 });
 el.addEventListener('submit',e=>e.preventDefault());
 onLocale(()=>{if(!info){empty();return;}const url=info.url;frame();video().src=url;video().load();renderStrip();render();});
 empty();
 return {add,get info(){return info;}};
}
