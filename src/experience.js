import {mayPromote} from './capabilities.js';
import {parsePalette} from './pixel-engine.js';
import {imageLabel} from './image-controls.js';
import {chooseImagePlan} from './resource-dialog.js';
import {PDFWorkspace} from './pdf.js';
import {readPDFOptions} from './pdf-controls.js';
import {readMediaOptions} from './media-controls.js';
import {BRAND} from './brand.js';
import {track,setAnalyticsContext,trafficSource} from './analytics.js';
import {Toolkit} from './toolkit.js';
import {t,getLocale,setLocale,normalizeLocale,LOCALES,LANGUAGE_NAMES,readPreference,savePreference,locationParts,localizedURL,localeFromEnvironment,translateStatic} from './i18n.js';
import {INTENTS,intentFor,intentDefaults,isFocused,accepts} from './intents.js';
import {bytes,integer,parsePages,stem,zip} from './core.js';
import * as Im from './image.js';
import * as Media from './media.js';
import {icon,esc,button} from './ui.js';
import {updateSiteContent} from './site-content.js';
const $=s=>document.querySelector(s);
const storage=()=>{try{return window.localStorage;}catch{return null;}};
const browserLanguages=()=>navigator.languages?.length?navigator.languages:[navigator.language];
const fields=()=>Array.from($('#panel').querySelectorAll('input[id],select[id],textarea[id]')).map(e=>({id:e.id,value:e.value,checked:e.checked}));
function restoreFields(list){for(const item of list){const e=document.getElementById(item.id);if(e){e.value=item.value;if('checked' in e)e.checked=item.checked;}}}
const generic={image:'image',pdf:'pdf',pixel:'pixel',media:'media'};
const actions={upscale:'image:upscale',background:'image:remove',compress:'image:save',convert:'image:save',crop:'image:crop',resize:'image:resize',pixel:'pixel:apply',pdf:'pdf:save',pdfImages:'pdf:save',media:'media:save',frame:'media:frame'};
export class Experience {
 constructor(adapter){
  this.a=adapter;this.root=adapter.root;this.s=adapter.state;this.result=null;this.original=false;this.panelValues=[];this.lastURL=location.href;
  this.kit=new Toolkit(this);
  this.applyLocation();this.landingIntent=this.id;this.source=trafficSource(document.referrer,location.origin);this.visit();if(new URL(location.href).searchParams.get('explore')==='1')queueMicrotask(()=>this.kit.openSearch());
  $('#languageSelect').addEventListener('change',e=>this.changeLanguage(e.target.value));
  $('#panel').addEventListener('input',()=>this.settingsChanged());
  $('#panel').addEventListener('change',()=>this.settingsChanged());
  window.addEventListener('languagechange',()=>{if(this.auto&&!this.s.busy)this.changeLanguage('auto',false);});
 }
 settingsChanged(){
  if(!this.result||this.s.busy)return;
  const values=fields();this.invalidate();this.render();restoreFields(values);this.a.paint().catch(e=>this.a.message(e.message,true));
 }
 visit(){setAnalyticsContext({intent:this.id,landing_intent:this.landingIntent,language:getLocale(),device_class:matchMedia('(max-width: 640px)').matches?'mobile':'desktop',traffic_source:this.source});track('page_view');track('tool_open');}
 get config(){return INTENTS[this.id];}
 get focused(){return isFocused(this.id);}
 applyLocation(){
  const url=new URL(location.href),parts=locationParts(url.pathname,this.root.pathname),saved=readPreference(storage());
  this.auto=!parts.locale&&!normalizeLocale(url.searchParams.get('lang'))&&!saved;
  setLocale(localeFromEnvironment(url,this.root,{storage:storage(),languages:browserLanguages()}));
  this.configure(intentFor(parts.path),parts.path,url.search);this.lastURL=url.href;
 }
 configure(id,path=INTENTS[id].path,query=''){
  this.invalidate();this.kit.configure(id,query);this.id=id;this.path=path;this.defaults=intentDefaults(id,path,query);const d=this.defaults,s=this.s;
  s.editor=this.config.editor;s.tool='';
  Object.assign(s.export,{format:d.format,kb:d.kb,width:0,quality:d.quality,shrink:d.shrink,all:false});
  Object.assign(s.pix,{n:d.n,colors:d.colors,dither:d.dither,outline:d.outline,fit:d.fit,trim:d.trim});Object.assign(s.pdfExport,{format:d.pdfFormat,range:d.range,raster:false,optimize:id==='pdf-compress',splitMode:'single'});
  Object.assign(s.mediaExport,{mode:'precise',width:id==='video-compress'?1280:0,format:d.mediaFormat,start:0,end:s.media?Math.min(d.mediaFormat==='gif'?4:10,s.media.duration):0});
  this.options={scale:d.scale,scaleMode:d.scaleMode,background:d.background,color:d.color,tolerance:d.tolerance,width:d.width,height:d.height};
  this.panelValues=[];if(this.a.ready()&&['crop','resize','pdf-split','pdf-compress','pdf-to-jpg','video-trim','video-mp3','video-gif','video-compress'].includes(id))s.tool=this.config.tool;
 }
 url(id=this.id,explicit=false,query=''){return localizedURL(INTENTS[id].path,explicit||!this.auto?getLocale():null,this.root,query);}
 query(){
  if(this.kit.active)return this.kit.query();
  const q=new URLSearchParams();const s=this.s;
  if(s.editor==='image'){q.set('format',s.export.format);q.set('quality',s.export.quality);q.set('shrink',s.export.shrink?'1':'0');if(s.export.kb)q.set('kb',s.export.kb);}
  if(this.id==='upscale'){q.set('scale',this.options.scale);q.set('scaleMode',this.options.scaleMode);}
  if(this.id==='resize'){q.set('w',this.options.width||s.c?.width||1080);q.set('h',this.options.height||s.c?.height||1080);}
  if(this.id==='pixel')for(const key of ['n','colors','dither','outline','fit','trim'])q.set(key,typeof s.pix[key]==='boolean'?(s.pix[key]?'1':'0'):s.pix[key]);
  if(this.id==='remove-bg'){q.set('mode',this.options.background);q.set('color',this.options.color);q.set('tolerance',this.options.tolerance);}
  if(s.editor==='pdf'&&s.pdfExport.range)q.set('pages',s.pdfExport.range);
  return q;
 }
 async enter(id,{push=true,consume=false}={}){
  if(!INTENTS[id]||this.s.busy)return;
  if(consume&&this.result?.canvas&&this.result.kind==='image'){const c=Im.copy(this.result.canvas);this.invalidate();await this.a.task(t('이미지 편집기로 보내는 중…'),()=>this.a.applyImage(c));}
  if(consume&&this.result?.kind==='pdf'&&INTENTS[id].editor==='pdf'){const next=new PDFWorkspace(),blob=this.result.blob;let loaded=false;await this.a.task(t('intent.preparing'),async(progress,signal)=>{try{await next.add([new File([blob],'result.pdf',{type:'application/pdf'})],progress,signal);this.a.check(signal);await this.s.pdf.clear();this.s.pdf=next;loaded=true;}finally{if(!loaded)await next.clear();}});if(!loaded)return;}
  this.configure(id);if(push){history.pushState({},'',this.url(id));this.lastURL=location.href;}
  this.visit();this.a.refresh();await this.a.paint();
 }
 invalidate(){if(this.result?.blob)Media.releaseOutput(this.result.blob);if(this.result?.canvas)Im.release(this.result.canvas);this.result=null;this.original=false;}
 preview(){return this.original?null:this.result?.canvas||null;}
 acceptsFiles(files){if(!this.focused)return true;const kinds=files.map(this.a.typeOf);if(accepts(this.id,kinds))return true;this.a.message(t('intent.wrongInput',{type:t('intent.type.'+this.config.accept)}),true);return false;}
 afterInput(){
  this.invalidate();if(this.s.editor!==this.config.editor||this.id==='home'){const id=generic[this.s.editor];this.configure(id);history.replaceState({},'',this.url(id));this.lastURL=location.href;this.visit();}
  if(this.s.c){this.options.width||=this.s.c.width;this.options.height||=this.s.c.height;}
  if(['crop','resize','pdf-split','pdf-compress','pdf-to-jpg','video-trim','video-mp3','video-gif','video-compress'].includes(this.id))this.s.tool=this.config.tool;
 }
 readOptions(){
  if(this.kit.active){this.kit.read();return;}
  const s=this.s,v=id=>document.getElementById(id);
  if(s.tool==='upscale'){this.options.scale=Number(v('scale')?.value||this.options.scale);this.options.scaleMode=v('scaleMode')?.value||this.options.scaleMode;}
  if(s.tool==='background'){this.options.color=v('removeColor')?.value||this.options.color;this.options.tolerance=Number(v('tolerance')?.value??this.options.tolerance);}
  if(s.tool==='resize'){this.options.width=Number(v('resizeW')?.value||this.options.width);this.options.height=Number(v('resizeH')?.value||this.options.height);}
  if(s.tool==='export'&&s.editor==='image'&&v('outFormat'))this.a.readExport();
  if(s.tool==='export'&&s.editor==='pdf'&&v('pdfFormat'))Object.assign(s.pdfExport,readPDFOptions());
  if(s.tool==='export'&&s.editor==='media'&&v('mediaStart'))Object.assign(s.mediaExport,readMediaOptions());
  if(s.tool==='pixel'&&v('pixelN'))Object.assign(s.pix,{palette:parsePalette(v('pixelPalette')?.value||''),paletteText:v('pixelPalette')?.value||'',ditherMode:v('pixelDitherMode')?.value||'floyd-steinberg',n:integer(v('pixelN').value,8,512,'N'),colors:Number(v('pixelColors').value),dither:Number(v('pixelDither').value),fit:v('pixelFit').value,trim:v('pixelTrim').checked,outline:Number(v('pixelOutline').value)});
 }
 async changeLanguage(value,persist=true){
  if(this.s.busy){$('#languageSelect').value=this.auto?'auto':getLocale();return;}
  const captured=fields(),focus=document.activeElement?.id,scroll=$('#panel').scrollTop;
  this.auto=value==='auto';const saved=persist?savePreference(this.auto?null:value,storage()):true;
  const url=new URL(location.href);url.searchParams.delete('lang');
  setLocale(this.auto?localeFromEnvironment(new URL(this.root.href),this.root,{languages:browserLanguages()}):value);
  const next=localizedURL(this.path,this.auto?null:getLocale(),this.root,url.search);
  history.replaceState({},'',next);this.lastURL=next.href;this.visit();track('language_change');
  $('#tooltip').hidden=true;$('#message').hidden=true;
  this.a.refresh();restoreFields(captured);$('#panel').scrollTop=scroll;
  if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  if($('#helpDialog').open)this.a.help(!!this.s.helpPrivacy);await this.a.paint();
  if(!saved)this.a.message(t('language.session'));
 }
 async popstate(){
  if(this.s.busy){history.replaceState({},'',this.lastURL);this.a.message(t('진행 중인 작업을 먼저 취소하세요.'));return;}
  this.applyLocation();this.visit();this.a.refresh();await this.a.paint();
 }
 renderPresets(){
  if(this.kit.active)return this.kit.presets();
  const chip=(key,value,label,on)=>`<button class="chip ${on?'selected':''}" data-action="preset:${key}:${value}" aria-pressed="${on}">${esc(label)}</button>`;
  if(this.id==='upscale')return [2,4].map(n=>chip('scale',n,n+'×',this.options.scale===n)).join('');
  if(this.id==='remove-bg')return ['solid','general','portrait'].map(v=>chip('background',v,v==='general'?imageLabel('general'):t(v==='solid'?'intent.solid':'intent.portrait'),this.options.background===v)).join('');
  if(this.id==='compress')return [200,500,1000].map(n=>chip('kb',n,n===1000?'≤ 1 MB':`≤ ${n} KB`,this.s.export.kb===n)).join('');
  if(['convert','heic'].includes(this.id))return ['png','jpeg','webp'].map(v=>chip('format',v,v==='jpeg'?'JPG':v==='webp'?'WebP':'PNG',this.s.export.format===v)).join('');
  if(this.id==='pixel')return [16,32,64,128].map(n=>chip('n',n,n+'×'+n,this.s.pix.n===n)).join('');
  return '';
 }
 render(){
  const s=this.s;if(this.config.editor!==s.editor){this.configure(generic[s.editor]);history.replaceState({},'',this.url());this.lastURL=location.href;}const has=!!this.a.ready(),c=this.config;document.documentElement.lang=getLocale();document.documentElement.dir='ltr';translateStatic();
  $('#languageSelect').innerHTML=`<option value="auto">${esc(t('language.auto'))}</option>`+LOCALES.map(l=>`<option value="${l}" lang="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
  $('#languageSelect').value=this.auto?'auto':getLocale();$('#languageSelect').disabled=s.busy;
  const title=t(`intent.${this.id}.title`),description=t(`intent.${this.id}.description`);
  updateSiteContent(this.id,getLocale());
  $('#editorTitle').textContent=title;document.title=title+' · '+BRAND.name;$('meta[name="description"]').content=description;
  $('meta[property="og:title"]').content=document.title;$('meta[property="og:description"]').content=description;
  $('#emptyTitle').textContent=t(`intent.${this.id}.headline`);$('#emptySubtitle').textContent=description;
  $('#intentIcon').innerHTML=icon(c.icon,32);$('#intentIcon').hidden=!this.focused;
  $('#pickLabel').textContent=t(c.accept==='pdf'?'intent.pickPDF':c.accept==='media'?'intent.pickMedia':c.accept==='auto'?'shell.open':'intent.pick');
  $('#dropButton').setAttribute('aria-label',$('#pickLabel').textContent);
  $('#landingPresets').innerHTML=this.renderPresets();$('#landingPresets').hidden=has;
  $('#featuredIntents').hidden=has||!['home','image'].includes(this.id);
  $('#featuredIntents').innerHTML=['upscale','remove-bg','compress','pdf-merge'].filter(mayPromote).map(id=>`<a class="feature-link" href="${this.url(id)}" data-action="intent:${id}">${icon(INTENTS[id].icon,22)}<span>${esc(t(`intent.${id}.title`))}</span><span class="feature-arrow">↗</span></a>`).join('');
  $('.sample-button').hidden=c.accept==='pdf'||c.accept==='media';
  document.body.classList.toggle('intent-focused',this.focused);document.body.classList.toggle('has-file',has);document.body.classList.toggle('has-result',!!this.result);
  const controls=$('#intentControls');controls.hidden=!has||!this.focused;
  if(has&&this.focused){
   const result=this.result;
   const summary=result?this.resultSummary():this.id==='upscale'?`${s.c.width} × ${s.c.height} → ${s.c.width*this.options.scale} × ${s.c.height*this.options.scale}`:'';
   controls.innerHTML=`<div class="intent-controls-top"><div class="intent-summary" role="status">${result?icon('check',17):''}<span>${esc(summary)}</span></div>${result?.canvas?`<div class="compare-toggle">${['original','result'].map(v=>`<button data-action="compare:${v}" aria-pressed="${this.original===(v==='original')}">${esc(t('intent.'+v))}</button>`).join('')}</div>`:''}</div><div class="intent-action-row"><div class="intent-presets">${this.renderPresets()}</div>${button('intent-settings','sliders',t('intent.settings'))}<button class="intent-primary" data-action="${result?'intent-download':'intent-run'}">${icon(result?'download':c.icon,18)}<span>${esc(result?t('intent.download'):this.id==='upscale'?t('intent.factor',{scale:this.options.scale}):t(`intent.${this.id}.action`))}</span></button></div>${result?.larger?`<p class="result-warning">${esc(t('intent.warningLarger'))}</p>`:''}${result?`<div class="next-steps"><span>${esc(t('intent.next'))}</span>${c.next.slice(0,3).map(id=>`<a href="${this.url(id)}" data-action="next:${id}">${icon(INTENTS[id].icon,16)}${esc(t(`intent.${id}.title`))}</a>`).join('')}</div>`:''}`;
  }
  // The focused flow has one primary action. Keep the underlying editor accessible.
  const primary=actions[c.action];if(this.focused&&primary)$('#panel').querySelectorAll(`[data-action="${primary}"]`).forEach(b=>b.hidden=true);
  if(this.focused&&s.tool==='upscale'){$('#scale').value=this.options.scale;$('#scaleMode').value=this.options.scaleMode;}
  if(this.focused&&s.tool==='background'){$('#removeColor').value=this.options.color;$('#tolerance').value=this.options.tolerance;}
  if(this.focused&&s.tool==='resize'){$('#resizeW').value=this.options.width||s.c?.width||1080;$('#resizeH').value=this.options.height||s.c?.height||1080;}
  if(!has&&this.focused)$('#panel').hidden=true;
  this.kit.render();
 }
 resultSummary(){const r=this.result;if(r.kind==='image')return ['compress','convert','heic'].includes(this.id)?`${bytes(r.beforeSize)} → ${bytes(r.blob.size)} · ${r.width} × ${r.height}`:`${r.beforeW} × ${r.beforeH} → ${r.width} × ${r.height} · ${bytes(r.blob.size)}${r.processingReport?' · '+r.processingReport.engine+' / '+r.processingReport.backend:''}${r.processingReport?.fallbackReason?' · Fallback: '+r.processingReport.fallbackReason:''}`;if(r.kind==='pdf')return t('intent.pdfMerged',{files:r.files,pages:r.pages})+' · '+bytes(r.pdfReport?.originalBytes||0)+' → '+bytes(r.blob.size)+(r.pdfReport?' · '+r.pdfReport.mode+' · Text/search/vector: '+(r.pdfReport.textPreserved?'✓':'—'):'');if(r.mediaReport){const m=r.mediaReport;return `${bytes(m.originalBytes||0)} → ${bytes(r.blob.size)} · ${m.w||m.width||''}${m.h?' × '+m.h:''} · ${m.videoCodec||m.engine||''} · ${m.audioCodec||''}${m.duration?' · '+m.duration.toFixed(3)+'s':''}${m.targetMet===false?' · Target exceeded':''}`;}return t('intent.actual',{size:bytes(r.blob.size)});}
 async run(){
  if(this.kit.active)return this.kit.run();
  if(!this.a.ready()){this.a.message(t('intent.selectFirst'));return;}
  this.readOptions();const s=this.s,c=this.config,source=s.c;this.s.runIntent=this.id;track('tool_run');
  if(s.editor==='image'&&s.export.all&&['compress','convert'].includes(c.action)){await this.a.task(t('저장 파일을 만드는 중…'),this.a.saveImages);return;}
  this.invalidate();await this.a.task(t('intent.preparing'),async(progress,signal)=>{
   let canvas=null,blob=null,name='',width=0,height=0,kind='file',larger=false;
   try{
    if(['upscale','background','crop','resize','compress','convert','pixel'].includes(c.action)){
     if(c.action==='upscale'){const preset=await chooseImagePlan(source,source.width*this.options.scale,source.height*this.options.scale);canvas=await Im.upscale(source,this.options.scale,this.options.scaleMode,{signal,progress,preset});}
     if(c.action==='background'){
      
      const color=[1,3,5].map(i=>parseInt(this.options.color.slice(i,i+2),16));
      canvas=await Im.processPixels(source,this.options.background==='solid'?'remove':this.options.background,{color,tolerance:this.options.tolerance},progress,signal);
     }
     if(c.action==='crop')canvas=Im.crop(source,s.crop);
     if(c.action==='resize'){const w=integer(this.options.width,1,65535,t('너비')),h=integer(this.options.height,1,65535,t('높이')),preset=await chooseImagePlan(source,w,h);canvas=await Im.resizeQuality(source,w,h,{signal,progress,preset});}
     if(c.action==='pixel')canvas=await this.a.generatePixel(progress,signal);
     let format='png';if(c.action==='compress'||c.action==='convert'){
      format=s.export.format;const result=await Im.encode(source,{...s.export,quality:s.export.quality/100,allowShrink:s.export.shrink,signal,progress,original:c.action==='compress'?this.a.file().blob:null},()=>this.a.check(signal));
      if(!result.met)throw Error(t('intent.limit'));blob=result.blob;format=result.format;canvas=await Im.decode(blob);canvas.compressionReport=result.report;larger=c.action==='compress'&&blob.size>this.a.file().blob.size;
     }
     blob||=await Im.blobOf(canvas);width=canvas.width;height=canvas.height;kind='image';name=`${stem(this.a.file().name)}-${this.id}.${format==='jpeg'?'jpg':format}`;
    }else if(c.action==='pdf'||c.action==='pdfImages'){
     if(s.pdfExport.format==='pdf'&&s.pdfExport.splitMode!=='single'){const entries=await s.pdf.split({...s.pdfExport,mode:s.pdfExport.splitMode,every:s.pdfExport.splitMode==='each'?1:s.pdfExport.every},progress,signal);blob=await zip(entries,{signal});name='split-pages.zip';}else if(s.pdfExport.format==='pdf'){
      blob=await s.pdf.export(s.pdfExport,progress,signal);name=BRAND.name.toLowerCase()+'-edited.pdf';kind='pdf';larger=this.id==='pdf-compress'&&blob.size>s.pdf.inputBytes;
     }else{const entries=await s.pdf.imageExports(s.pdfExport,progress,signal);blob=entries.length===1?entries[0].blob:await zip(entries);name=entries.length===1?entries[0].name:BRAND.name.toLowerCase()+'-pages.zip';}
    }else if(c.action==='frame'){
     canvas=await Media.frame($('#video'),$('#video').currentTime,signal);blob=await Im.blobOf(canvas);name=`${stem(s.media.file.name)}-frame.png`;Im.release(canvas);canvas=null;
    }else if(c.action==='media'){
     const e=s.mediaExport;
     blob=e.format==='gif'?await Media.exportGif($('#video'),s.media,e.start,e.end,progress,signal,e):['mp3','wav'].includes(e.format)?await Media.exportAudio(s.media,e.start,e.end,e.format,progress,signal,e):await Media.exportVideo($('#video'),s.media,e.start,e.end,e.width,progress,signal,e);
     name=`${stem(s.media.file.name)}-clip.${e.format}`;larger=this.id==='video-compress'&&blob.size>s.media.file.size;
    }else{return this.a.onAction('export');}
    this.a.check(signal);this.result={kind,canvas,blob,name,width,height,processingReport:canvas?.processingReport,compressionReport:canvas?.compressionReport,pdfReport:s.editor==='pdf'?s.pdf.lastReport:null,mediaReport:s.editor==='media'?s.media.lastReport:null,beforeW:source?.width,beforeH:source?.height,beforeSize:this.a.file()?.blob.size||0,larger,pages:s.editor==='pdf'?parsePages(s.pdfExport.range,s.pdf.pages.length).length:0,files:s.pdf.sources.length};canvas=null;
   }finally{Im.release(canvas);}
  });
 }
 async action(action){
  if(await this.kit.action(action))return true;
  if(action==='undo'&&this.result){this.invalidate();this.a.refresh();await this.a.paint();return true;}
  if(action.startsWith('select:'))this.invalidate();
  if(action==='intent-run'){await this.run();return true;}
  if(action==='intent-download'){if(this.result){Im.download(this.result.blob,this.result.name);}return true;}
  if(action==='intent-settings'){
   this.readOptions();this.s.tool=this.s.tool?'':this.config.tool||'export';this.a.refresh();await this.a.paint();return true;
  }
  if(action.startsWith('intent:')||action.startsWith('next:')){if(action.startsWith('next:'))track('related_tool_click',{target_intent:action.split(':')[1]});await this.enter(action.split(':')[1],{consume:action.startsWith('next:')});return true;}
  if(action.startsWith('compare:')){this.original=action==='compare:original';this.a.refresh();await this.a.paint();return true;}
  if(action.startsWith('preset:')){
   this.readOptions();const[,key,value]=action.split(':');this.invalidate();
   if(key==='scale')this.options.scale=Number(value);if(key==='background')this.options.background=value;
   if(key==='format')this.s.export.format=value;if(key==='kb')this.s.export.kb=Number(value);if(key==='n'){this.s.pix.n=Number(value);Im.release(this.s.pixel);this.s.pixel=null;}
   if(this.s.tool)this.s.tool='';this.a.refresh();await this.a.paint();return true;
  }
  if(action.startsWith('help-editor:')){$('#helpDialog').close();await this.enter(generic[action.split(':')[1]],{consume:!!this.result?.canvas});return true;}
  if(action.startsWith('editor:')){await this.enter(generic[action.split(':')[1]],{consume:!!this.result?.canvas});return true;}
  if(action.startsWith('tool:')){
   const id={upscale:'upscale',background:'remove-bg',crop:'crop',resize:'resize',pixel:'pixel'}[action.slice(5)];
   if(id&&id!==this.id){await this.enter(id,{consume:!!this.result?.canvas});if(this.a.ready()){this.s.tool=this.config.tool;this.a.refresh();await this.a.paint();}return true;}
  }
  if(this.focused&&action===actions[this.config.action]){await this.run();return true;}
  if(this.focused&&this.id==='remove-bg'&&action==='image:portrait'){this.options.background='portrait';await this.run();return true;}
  if(action==='export'&&this.result){Im.download(this.result.blob,this.result.name);return true;}
  if(action==='share'||action==='copy-tool-link'){
   this.readOptions();const url=this.url(this.id,true,action==='copy-tool-link'?'':this.query());
   try{await navigator.clipboard.writeText(url.href);track('share_preset',{method:'copy'});this.a.message(t('파일이 아닌 도구·설정 링크를 복사했어요.'));}catch{track('share_preset',{method:'dialog'});this.a.dialog(t('링크 복사'),`<p>${esc(t('share.noFiles'))}</p><input readonly style="width:100%" value="${esc(url.href)}">`);}return true;
  }
  if(this.result?.canvas&&['rotate','image:flip','image:trim','image:outline','image:fill','image:to-pdf'].includes(action)){const c=Im.copy(this.result.canvas);this.invalidate();await this.a.task(t('이미지 편집기로 보내는 중…'),()=>this.a.applyImage(c));}
  return false;
 }
}
