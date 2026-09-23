/** Pack & Export stage of the Studio (P1b). A workspace through the public plug-in API
 * (docs/STUDIO.md): it reads the project document the Sprite workspace edits
 * (docs/STUDIO-SPRITE.md), packs every frame in a worker (src/studio/pack-worker.js) whenever the
 * frames or the settings change, shows the atlas page in the Studio canvas (integer zoom, page
 * tabs, used %, frame highlight shared with the timeline) and exports one-click bundles per engine.
 * Settings live in the project (`doc.settings.pack`), changed through undoable edits. */
import '../strings-pack.js';
import {ShapeLayer} from '../canvas/canvas-view.js';
import {h} from '../ui/dom.js';
import {TARGETS,settingsFor} from '../../game/export/targets.js';
import {DEFAULT_PACK_SETTINGS,normalizePackSettings} from '../../game/pack/packer.js';
import {getFrameSelection,setFrameSelection,onFrameSelection} from '../core/frame-selection.js';
import {commonName} from '../../game/export/project-model.js';

const SIZES=[256,512,1024,2048,4096,8192,16384];
const PRESETS=['godot4','unity','phaser','pixi','love','aseprite-json','spine','starling','sparrow-phaser3','css'];
const SCALES=[0.5,1,2,3,4];
const TARGET_ORDER={engine:['godot4','unity','phaser','pixi','gamemaker','defold','love'],data:['aseprite-json','aseprite-json-array','aseprite','json','spine','starling','sparrow-phaser3','css'],anim:['gif','apng','webm']};
let cssLoaded=false;
function loadCss(){if(cssLoaded)return;cssLoaded=true;const l=document.createElement('link');l.rel='stylesheet';l.href=new URL('../pack.css',import.meta.url).href;document.head.append(l);}
const stemOf=s=>String(s||'atlas').replace(/\.[^.]+$/,'').replace(/[^\w.-]+/g,'_').replace(/^[._-]+|[._-]+$/g,'')||'atlas';
const pct=v=>Math.round(v*1000)/10;

export default {
 id:'pack',title:'ws.pack',status:'ready',summary:'ws.packSummary',
 activate(ctx){
  loadCss();
  const {t,view}=ctx;
  let worker=null,sent=new Set(),job=0,busy=null,progress=null,error='',warnings=[];
  let result=null,model=null,bitmaps=[],variant=0,page=0,selection=[...getFrameSelection().ids],lastExport=null,exporting=null,packedDocKey=null,fitNext=true;
  const layer=ctx.layer(new ShapeLayer({id:'pack-frames',z:10,color:'rgba(76,194,255,.55)',labels:false,handles:false,editable:false}));
  // ------------------------------------------------------------ settings in the document
  const prefs=()=>ctx.doc.settings?.pack||{};
  const settings=()=>({...DEFAULT_PACK_SETTINGS,...(prefs().settings||{})});
  // default file name: the project's name, else what the images have in common (run_0…run_5 → run)
  const exportBase=()=>stemOf(prefs().exportName||(ctx.doc.name&&ctx.doc.name!==t('project.untitled')?ctx.doc.name:ctx.doc.assets.length>1?commonName(ctx.doc.assets.map(a=>stemOf(a.name))):ctx.doc.assets[0]?.name)||'atlas');
  function setPrefs(patch,{label=t('cmd.pack.settings'),mergeKey='pack-settings'}={}){
   ctx.execute(ctx.edit(label,d=>{const cur=d.settings?.pack||{};return {...d,settings:{...d.settings,pack:{...cur,...patch}}};},{mergeKey}));
  }
  function setSettings(patch,opts){
   const next={...settings(),...patch};
   try{normalizePackSettings(next);}catch(e){ctx.toast(e.message,{error:true});renderSettings();return;}
   setPrefs({settings:next},opts);
  }
  // ------------------------------------------------------------ worker
  function ensureWorker(){
   if(worker)return worker;
   worker=new Worker(new URL('../pack-worker.js',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>onWorker(data);
   worker.onerror=e=>{error=String(e.message||'worker error');busy=null;renderResult();};
   sent=new Set();return worker;
  }
  function stopWorker(){worker?.terminate();worker=null;sent=new Set();}
  const docKey=d=>d.assets.map(a=>a.id).join(',')+'|'+d.assets.length;
  async function blobsFor(doc){
   const ids=new Set();for(const a of doc.assets)for(const c of a.cels||[])ids.add(c.blob);
   const out=[];
   for(const id of ids){if(sent.has(id))continue;const b=ctx.images.blob(id);if(!b)continue;out.push({id,bytes:await b.arrayBuffer()});}
   return out;
  }
  let timer=0;
  function schedule(ms=180){clearTimeout(timer);timer=setTimeout(pack,ms);}
  async function pack(){
   const doc=ctx.doc;
   if(!doc.assets.length){result=null;bitmaps=[];busy=null;error='';showPage();renderAll();return;}
   if(busy?.op==='pack'){stopWorker();}
   const w=ensureWorker(),blobs=await blobsFor(doc),id=++job;
   busy={op:'pack',job:id};progress={phase:'decode'};error='';renderResult();
   for(const b of blobs)sent.add(b.id);
   w.postMessage({op:'pack',job:id,doc,settings:settings(),blobs,preview:variant},blobs.map(b=>b.bytes));
   packedDocKey=docKey(doc);
  }
  function cancel(){if(!busy)return;stopWorker();busy=null;progress=null;ctx.toast(t('pack.cancelled'));renderResult();}
  function onWorker(m){
   if(m.progress){if(busy&&m.job===busy.job){progress=m.progress;renderProgress();}return;}
   if(!busy||m.job!==busy.job)return;
   const op=busy.op;busy=null;progress=null;ctx.status('selection','');
   if(!m.ok){error=m.error;if(op==='export'){exporting=null;ctx.toast(m.error,{error:true});}renderAll();return;}
   if(m.op==='pack'||m.op==='preview'){
    if(m.op==='pack'){result=m.result;model=m.model;warnings=m.warnings||[];result.ms=m.ms;}
    for(const b of bitmaps)b.close?.();
    bitmaps=m.bitmaps;variant=m.variant;if(page>=bitmaps.length)page=0;
    showPage();renderAll();
   }else if(m.op==='export'){
    const a=h('a',{href:URL.createObjectURL(m.blob),download:m.name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
    lastExport={target:exporting,name:m.name,files:m.files,notes:m.notes,changed:m.changed,size:m.blob.size};exporting=null;
    ctx.toast(t('pack.exported',{file:m.name,n:m.files.length}));renderExport();renderResult();
    window.dispatchEvent(new CustomEvent('nerulio:pack-export',{detail:{name:m.name,files:m.files,notes:m.notes}}));
   }
  }
  // ------------------------------------------------------------ canvas
  const vr=()=>result?.variants[variant]||null;
  const regionOf=e=>({x:e.x,y:e.y,w:e.rotated?e.h:e.w,h:e.rotated?e.w:e.h});
  const rep=id=>{const e=vr()?.frames[id];return e?.aliasOf||id;};
  async function showPage(){
   const v=vr(),bmp=bitmaps[page];
   if(!v||!bmp){layer.setItems([]);if(!ctx.doc.assets.length)view.clearImage();return;}
   const pg=v.pages[page],prev=view.image,same=prev&&prev.w===pg.width&&prev.h===pg.height;
   await view.setImage(bmp,pg.width,pg.height,{view:same&&!fitNext?{...view.view}:null});fitNext=false;
   // the cell grid belongs to the sheet the Viewer/Sprite workspace shows, not to the atlas
   if(view.options.gridVisible||view.options.grid)view.set({grid:null,gridVisible:false});
   const items=[];
   for(const [id,e] of Object.entries(v.frames))if(e.page===page&&!e.aliasOf)items.push({id,...regionOf(e)});
   layer.setItems(items);markSelection();
   ctx.status('image',t('pack.stats',{w:pg.width,h:pg.height,eff:pct(pg.efficiency)}));
  }
  function markSelection(){
   const reps=new Set(selection.map(rep));layer.setSelected([...reps]);
   for(const el of framesList.querySelectorAll('.pk-frame'))el.setAttribute('aria-selected',String(selection.includes(el.dataset.frame)));
  }
  function select(ids,{from='pack',reveal=false}={}){
   selection=[...new Set(ids)];
   if(from==='pack')setFrameSelection(selection,'pack');
   const v=vr(),first=selection[0]&&v?.frames[selection[0]];
   if(first&&first.page!==page){page=first.page;showPage().then(()=>reveal&&view.reveal(regionOf(first)));renderResult();}
   else if(first&&reveal)view.reveal(regionOf(first));
   markSelection();
   const f=model?.frames.find(x=>x.id===selection[0]);
   ctx.status('selection',f&&first?`${f.name} · ${first.w}×${first.h}${first.rotated?' ↻':''}`:'');
  }
  const offSel=onFrameSelection(s=>{if(s.source!=='pack')select(s.ids,{from:s.source,reveal:true});});
  ctx.tool({id:'packPick',title:'tool.packPick',icon:'move',key:'V',order:10,hint:'tool.packPickHint',impl:{
   down(i){const p={x:i.x,y:i.y},hit=layer.items.find(r=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.w&&p.y<r.y+r.h);
    if(!hit){select([]);return false;}
    // a region shared by identical frames selects all of them
    const ids=Object.entries(vr().frames).filter(([id,e])=>id===hit.id||e.aliasOf===hit.id).map(([id])=>id);
    select(i.shift?[...selection,...ids]:ids);return false;},
   cursor:()=>'default'}});
  // ------------------------------------------------------------ settings panel
  const settingsBox=h('div.pk-settings',{});
  ctx.panel({id:'pack-settings',title:()=>t('panel.packSettings'),dock:'right',order:15,render(body){body.append(settingsBox);}});
  function field(label,control,{wide=false,hint=''}={}){return h('label.st-field'+(wide?'.pk-wide':''),{title:hint||null},h('span',{},label),control);}
  function select_(key,options,{onChange}={}){
   const s=settings(),el=h('select',{'data-pack':key,'aria-label':key});
   for(const [v,label] of options)el.append(h('option',{value:String(v),selected:String(s[key])===String(v)},label));
   el.addEventListener('change',()=>{const raw=el.value,v=typeof s[key]==='number'?Number(raw):raw;onChange?onChange(v):setSettings({[key]:v},{mergeKey:'pack-'+key});});
   return el;
  }
  function number(key,min,max){
   const s=settings(),el=h('input.st-input.st-num',{type:'number',min:String(min),max:String(max),step:'1',value:String(s[key]),'data-pack':key,inputmode:'numeric'});
   el.addEventListener('change',()=>{const v=Math.round(Number(el.value));if(!Number.isFinite(v)){el.value=String(settings()[key]);return;}setSettings({[key]:Math.max(min,Math.min(max,v))},{mergeKey:'pack-'+key});});
   return el;
  }
  function check(key,label,hint=''){
   const el=h('input',{type:'checkbox',checked:!!settings()[key],'data-pack':key});
   el.addEventListener('change',()=>setSettings({[key]:el.checked}));
   return h('label.st-check',{title:hint||null},el,' ',label);
  }
  function renderSettings(){
   const s=settings(),p=prefs();
   const preset=h('select',{'data-pack':'preset','aria-label':t('pack.preset')},h('option',{value:''},t('pack.custom')),...PRESETS.map(id=>h('option',{value:id,selected:p.preset===id},TARGETS[id].label)));
   preset.addEventListener('change',()=>{const id=preset.value;if(!id){setPrefs({preset:''});return;}
    setPrefs({preset:id,settings:{...settings(),...TARGETS[id].preset}},{label:t('cmd.pack.preset',{name:TARGETS[id].label}),mergeKey:null});});
   const sizes=SIZES.map(v=>[v,`${v}×${v}`]);
   const basic=h('div.pk-fields',{},
    field(t('pack.preset'),preset,{wide:true,hint:t('pack.presetHint')}),
    field(t('pack.maxSize'),select_('maxWidth',sizes,{onChange:v=>setSettings({maxWidth:v,maxHeight:v})})),
    field(t('pack.sizeMode'),select_('sizeMode',['auto','pot','square','pot-square','fixed'].map(k=>[k,t('pack.size.'+k)]))),
    ...(s.sizeMode==='fixed'?[field(t('pack.fixedW'),number('fixedWidth',8,16384)),field(t('pack.fixedH'),number('fixedHeight',8,16384))]:[]),
    field(t('pack.trim'),select_('trimMode',['none','trim','crop-keep','crop'].map(k=>[k,t('pack.trimMode.'+k)])),{wide:true}),
    field(t('pack.padding'),number('shapePadding',0,64),{hint:t('pack.paddingHint')}),
    field(t('pack.extrude'),number('extrude',0,32),{hint:t('pack.extrudeHint')}),
    h('div.pk-wide',{},check('allowRotation',t('pack.rotation'),t('pack.rotationHint')),check('dedupe',t('pack.dedupe'))));
   const scales=h('div.pk-scales',{},...SCALES.map(v=>{const el=h('input',{type:'checkbox',checked:s.scales.includes(v),'data-scale':String(v)});
    el.addEventListener('change',()=>{let next=el.checked?[...settings().scales,v]:settings().scales.filter(x=>x!==v);if(!next.length)next=[1];next.sort((a,b)=>a-b);setSettings({scales:next});});
    return h('label.st-check',{},el,' ',`@${v}x`);}));
   const adv=h('details.pk-adv',{open:!!p.advancedOpen},h('summary',{},t('pack.advanced')),h('div.pk-fields',{},
    field(t('pack.algorithm'),select_('algorithm',['maxrects','skyline','guillotine'].map(k=>[k,t('pack.alg.'+k)]),{onChange:v=>setSettings({algorithm:v,heuristic:'best'})})),
    field(t('pack.heuristic'),select_('heuristic',[['best',t('pack.heur.best')],...(s.algorithm==='maxrects'?['bssf','blsf','baf','bl','cp']:s.algorithm==='skyline'?['bl','waste']:['baf']).map(k=>[k,t('pack.heur.'+k)])])),
    field(t('pack.effort'),select_('effort',['fast','normal','best'].map(k=>[k,t('pack.eff.'+k)]))),
    field(t('pack.border'),number('borderPadding',0,64)),
    field(t('pack.multipleOf'),select_('multipleOf',[1,2,4,8,16,32].map(v=>[v,String(v)]))),
    field(t('pack.maxPages'),number('maxPages',1,64)),
    field(t('pack.alpha'),number('alphaThreshold',0,254),{hint:t('pack.alphaHint')}),
    h('div.pk-wide',{},check('multipack',t('pack.multipack')),check('premultiply',t('pack.premultiply'),t('pack.premultiplyHint'))),
    field(t('pack.scales'),scales,{wide:true,hint:t('pack.scaleHint')})));
   adv.addEventListener('toggle',()=>{if(!!prefs().advancedOpen!==adv.open)ctx.execute(ctx.edit(t('cmd.pack.settings'),d=>({...d,settings:{...d.settings,pack:{...(d.settings?.pack||{}),advancedOpen:adv.open}}}),{mergeKey:'pack-adv'}));});
   settingsBox.replaceChildren(h('div.st-sec',{},basic,adv));
  }
  // ------------------------------------------------------------ result panel
  const resultBox=h('div.pk-result',{'aria-live':'polite'});
  ctx.panel({id:'pack-result',title:()=>t('panel.packResult'),dock:'right',order:16,badge:()=>result?`${pct(vr()?.stats.efficiency||0)}%`:'',render(body){body.append(resultBox);}});
  function phaseText(p){if(!p)return t('pack.packing');return t('pack.phase.'+p.phase,{tried:p.tried??'',page:(p.page??0)+1,name:p.name??''});}
  function renderProgress(){const el=resultBox.querySelector('.pk-phase');if(el)el.textContent=phaseText(progress);else renderResult();ctx.status('selection',busy?phaseText(progress):'');}
  function renderResult(){
   ctx.badge('pack-result');
   const parts=[];
   if(busy){const c=h('button.st-btn',{type:'button','data-action':'pack-cancel'},t('pack.cancel'));c.addEventListener('click',cancel);
    parts.push(h('div.st-sec.pk-busy',{},h('span.pk-phase',{},phaseText(progress)),h('span.pk-bar',{},h('i',{})),c));}
   if(error)parts.push(h('p.st-pad.st-error',{'data-pack':'error'},error));
   if(!ctx.doc.assets.length){parts.push(h('p.st-pad.st-muted',{},t('pack.noFrames')));resultBox.replaceChildren(...parts);return;}
   const v=vr();
   if(v){
    const variants=result.variants.length>1?h('div.pk-pages',{},...result.variants.map((x,i)=>{const b=h('button.pk-page',{type:'button','aria-pressed':String(i===variant),'data-variant':String(i)},t('pack.variant',{s:x.scale}));b.addEventListener('click',()=>{if(i===variant)return;variant=i;page=0;fitNext=true;preview();});return b;})):'';
    const pages=h('div.pk-pages',{role:'tablist'},...v.pages.map((pg,i)=>{const b=h('button.pk-page',{type:'button',role:'tab','aria-pressed':String(i===page),'data-page':String(i),title:t('pack.stats',{w:pg.width,h:pg.height,eff:pct(pg.efficiency)})},t('pack.page',{n:i+1}));
     b.addEventListener('click',()=>{page=i;showPage();renderResult();});return b;}));
    const pg=v.pages[page]||v.pages[0],combo=pg.combo||{};
    parts.push(h('div.st-sec',{},variants,pages,
     h('div.pk-eff',{'data-pack':'efficiency'},`${pct(pg.efficiency)}%`,h('small',{},`${pg.width}×${pg.height}`)),
     h('div.pk-meter',{},h('i',{style:{width:`${Math.min(100,pct(pg.efficiency))}%`}})),
     h('p.st-muted',{'data-pack':'totals',style:{margin:0}},t('pack.totals',{frames:v.stats.frames,unique:v.stats.unique,aliases:v.stats.aliases,pages:v.pages.length,eff:pct(v.stats.efficiency),ms:result.ms??''})),
     h('p.pk-hint',{'data-pack':'memory'},t('pack.memory',{size:fmtSize(v.pages.reduce((n,q)=>n+q.width*q.height*4,0))})),
     combo.algorithm?h('p.pk-hint',{},t('pack.rules',{alg:t('pack.alg.'+combo.algorithm),heur:t('pack.heur.'+combo.heuristic),sort:combo.sort})):'',
     v.stats.aliases?h('p.pk-hint',{},t('pack.aliasNote',{n:v.stats.aliases})):'',
     model?.implicitAnimation?h('p.pk-note-implicit',{'data-pack':'implicit'},t('pack.implicit',{name:model.implicitAnimation.name,n:model.implicitAnimation.frames,fps:model.implicitAnimation.fps})):'',
     warnings.length?h('ul.pk-notes',{},...warnings.map(w=>h('li',{},w))):''));
   }
   resultBox.replaceChildren(...parts);
  }
  function preview(){if(!result)return;const w=ensureWorker(),id=++job;busy={op:'preview',job:id};w.postMessage({op:'preview',job:id,preview:variant});renderResult();}
  // ------------------------------------------------------------ export panel
  const exportBox=h('div.pk-export',{});
  ctx.panel({id:'pack-export',title:()=>t('panel.packExport'),dock:'right',order:17,render(body){body.append(exportBox);}});
  function describeChange(c){return c.map(x=>t('pack.chg.'+x.key+'.'+String(x.to))).join(', ');}
  const exportTarget=()=>{const id=prefs().target||prefs().preset;return TARGETS[id]&&!TARGETS[id].aseprite?id:(TARGETS[id]?id:'godot4');};
  const canExport=tg=>!!result&&!busy&&!exporting&&!(tg.browserOnly&&typeof VideoEncoder==='undefined');
  function verifyBadge(tg,{short=false}={}){
   return h('span.pk-badge'+(tg.verify==='unverified'?'.is-unverified':''),{'data-verify':tg.verify,title:t('pack.verify.'+tg.verify,{engine:tg.engine})},
    short?h('i.pk-dot',{'aria-hidden':'true'}):'',short?'':t('pack.verify.'+tg.verify,{engine:tg.engine}));
  }
  function renderExport(){
   const name=h('input.st-input',{type:'text',value:prefs().exportName||exportBase(),'data-pack':'exportName','aria-label':t('pack.exportName'),maxlength:'80'});
   name.addEventListener('change',()=>setPrefs({exportName:stemOf(name.value)},{mergeKey:'pack-name'}));
   // main card: pick a target, see what it needs and how it was verified, one big button
   const cur=exportTarget(),tg=TARGETS[cur],{changed}=settingsFor(cur,settings());
   const pick=h('select',{'data-pack':'target','aria-label':t('pack.exportTarget')},...Object.entries(TARGET_ORDER).map(([g,ids])=>h('optgroup',{label:t('pack.groups.'+g)},...ids.map(id=>h('option',{value:id,selected:id===cur},TARGETS[id].label)))));
   pick.addEventListener('change',()=>setPrefs({target:pick.value},{mergeKey:'pack-target'}));
   const main=h('button.st-btn.primary.pk-main',{type:'button','data-export-main':cur,disabled:!canExport(tg),title:tg.browserOnly&&typeof VideoEncoder==='undefined'?t('pack.webmOnly'):null},t('pack.exportFor',{name:tg.label}));
   main.addEventListener('click',()=>runExport(cur));
   const card=h('div.st-sec.pk-card',{},h('div.pk-fields',{},field(t('pack.exportTarget'),pick,{wide:true}),field(t('pack.exportName'),name,{wide:true})),
    main,verifyBadge(tg),changed.length?h('p.pk-change',{'data-pack':'target-change'},t('pack.changed',{name:tg.label,what:describeChange(changed)})):'',
    exporting?h('p.pk-hint',{'aria-live':'polite'},t('pack.exporting',{name:TARGETS[exporting].label})):'');
   // every target, one line each: name, verification dot, Export
   const groups=Object.entries(TARGET_ORDER).map(([g,ids])=>h('div.pk-group',{},h('h3',{},t('pack.groups.'+g)),...ids.map(id=>{
    const x=TARGETS[id],ch=settingsFor(id,settings()).changed;
    const btn=h('button.st-btn',{type:'button','data-export':id,disabled:!canExport(x),title:x.browserOnly&&typeof VideoEncoder==='undefined'?t('pack.webmOnly'):t('pack.exportFor',{name:x.label})},t('pack.export'));
    btn.addEventListener('click',()=>runExport(id));
    return h('div.pk-target'+(id===cur?'.is-current':''),{'data-target':id},verifyBadge(x,{short:true}),h('b',{title:t('pack.verify.'+x.verify,{engine:x.engine})},x.label),
     ch.length?h('span.pk-change',{title:t('pack.changed',{name:x.label,what:describeChange(ch)})},describeChange(ch)):h('span',{}),btn);
   })));
   const last=lastExport?h('div.st-sec',{'data-pack':'last-export'},h('div.st-sec-head',{},h('span',{},t('pack.lastExport')),h('span',{},lastExport.name)),
    h('p.pk-hint',{},t('pack.files',{n:lastExport.files.length})+' · '+fmtSize(lastExport.size)),
    lastExport.changed?.length?h('p.pk-hint',{},t('pack.changed',{name:TARGETS[lastExport.target]?.label||'',what:describeChange(lastExport.changed)})):'',
    lastExport.notes.length?h('ul.pk-notes',{},...lastExport.notes.map(n=>h('li',{},n))):''):'';
   exportBox.replaceChildren(card,last,h('details.st-sec.pk-all',{open:prefs().allOpen!==false},h('summary',{},t('pack.allFormats',{n:Object.values(TARGET_ORDER).flat().length})),...groups));
   exportBox.querySelector('.pk-all').addEventListener('toggle',e=>{if(e.target.open!==(prefs().allOpen!==false))setPrefs({allOpen:e.target.open},{mergeKey:'pack-all'});});
  }
  const fmtSize=n=>n<1024?`${n} B`:n<1048576?`${Math.round(n/1024)} KB`:`${(n/1048576).toFixed(1)} MB`;
  function runExport(id){
   if(!result||busy||exporting)return;
   const w=ensureWorker(),jid=++job;busy={op:'export',job:jid};exporting=id;
   w.postMessage({op:'export',job:jid,target:id,options:{base:exportBase()}});
   renderExport();renderResult();
  }
  // ------------------------------------------------------------ frames list (bottom)
  const framesList=h('div.pk-frames',{role:'listbox','aria-multiselectable':'true'});
  ctx.panel({id:'pack-frames',title:()=>t('panel.packFrames'),dock:'bottom',order:12,badge:()=>model?String(model.frames.length):'',render(body){body.append(framesList);}});
  function renderFrames(){
   ctx.badge('pack-frames');framesList.setAttribute('aria-label',t('panel.packFrames'));
   const v=vr();if(!v||!model){framesList.replaceChildren(h('p.st-pad.st-muted',{},ctx.doc.assets.length?t('pack.packing'):t('pack.noFrames')));return;}
   const names=new Map(model.frames.map(f=>[f.id,f.name]));
   const rows=model.frames.slice(0,3000).map(f=>{const e=v.frames[f.id];if(!e)return null;
    const flags=[e.trimmed?t('pack.flags.trimmed'):'',e.rotated?t('pack.flags.rotated'):'',e.aliasOf?t('pack.flags.alias',{name:names.get(e.aliasOf)}):''].filter(Boolean).join(' · ');
    const row=h('div.pk-frame',{role:'option','data-frame':f.id,'aria-selected':String(selection.includes(f.id))},h('span',{},f.name),h('span',{},t('pack.frameRow',{w:e.sourceW,h:e.sourceH,sw:e.w,sh:e.h})),h('span',{},t('pack.onPage',{n:e.page+1})),h('span.pk-flag',{},flags));
    row.addEventListener('mouseenter',()=>layer.setHover(rep(f.id)));row.addEventListener('mouseleave',()=>layer.setHover(null));
    row.addEventListener('click',ev=>select(ev.shiftKey||ev.ctrlKey||ev.metaKey?[...selection,f.id]:[f.id],{reveal:true}));return row;}).filter(Boolean);
   framesList.replaceChildren(...rows);
  }
  function renderAll(){renderSettings();renderResult();renderExport();renderFrames();}
  // ------------------------------------------------------------ commands + menu
  ctx.command({id:'pack.repack',group:'pack',keys:['Mod+Shift+P'],run:()=>pack()});
  ctx.command({id:'pack.cancel',group:'pack',enabled:()=>!!busy,run:()=>cancel()});
  ctx.command({id:'pack.nextPage',group:'pack',keys:['PageDown'],enabled:()=>!!vr()&&page<vr().pages.length-1,run:()=>{page++;showPage();renderResult();}});
  ctx.command({id:'pack.prevPage',group:'pack',keys:['PageUp'],enabled:()=>page>0,run:()=>{page--;showPage();renderResult();}});
  ctx.command({id:'pack.exportLast',group:'pack',keys:['Mod+E'],enabled:()=>!!result&&!busy,run:()=>runExport(lastExport?.target||prefs().preset||'godot4')});
  ctx.menu({id:'pack',title:'menu.pack',items:()=>['pack.repack','pack.cancel','-','pack.prevPage','pack.nextPage','-','pack.exportLast']});
  // ------------------------------------------------------------ document events
  const packInput=d=>d.assets;
  ctx.on('doc',(doc,prev)=>{
   const settingsChanged=!prev||JSON.stringify(prev.settings?.pack?.settings)!==JSON.stringify(doc.settings?.pack?.settings);
   if(!prev||packInput(prev)!==packInput(doc)||settingsChanged){if(!prev||docKey(prev)!==docKey(doc))fitNext=true;schedule(settingsChanged?120:250);}
   renderSettings();renderExport();
  });
  ctx.on('asset',()=>{if(bitmaps.length)showPage();});
  ctx.on('locale',()=>renderAll());
  renderAll();pack();
  return {
   selectAll(){if(model)select(model.frames.map(f=>f.id));},
   deselect(){select([]);},
   hasSelection:()=>selection.length>0,
   step(dir){if(!model?.frames.length)return;const i=model.frames.findIndex(f=>f.id===selection[selection.length-1]);const n=Math.max(0,Math.min(model.frames.length-1,i<0?0:i+dir));select([model.frames[n].id],{reveal:true});},
   // the atlas replaces the asset picture while this stage is open (app.js calls present() instead of drawing the asset)
   present(){return showPage();},
   deactivate(){clearTimeout(timer);offSel();stopWorker();for(const b of bitmaps)b.close?.();bitmaps=[];layer.setItems([]);ctx.status('image','');
    // after the switch, so the NEXT workspace draws the asset (its own present() or the picture)
    const a=ctx.activeAsset;setTimeout(()=>{if(a)ctx.showAsset(a.id,{restoreView:true});else view.clearImage();},0);}
  };
 }
};
