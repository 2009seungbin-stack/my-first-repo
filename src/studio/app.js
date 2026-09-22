/** Nerulio Studio shell: chrome (menu bar, tool bar, docks, status bar), the command/undo system,
 * keyboard map, project store with autosave/recovery and .nerulio files, file intake (picker, drop
 * anywhere, paste, hand-off from tool pages), and the workspace plug-in host.
 * Workspaces only describe their own tools, panels, commands and menus — see docs/STUDIO.md. */
import {CanvasView} from './canvas/canvas-view.js';
import * as V from './canvas/view-math.js';
import {History,edit} from './core/history.js';
import {Keymap,DEFAULT_KEYS,eventCombo,displayCombo,isTypingTarget,BROWSER_DEFAULTS_TO_BLOCK} from './core/keymap.js';
import * as P from './core/project.js';
import {ImageStore,isImportable} from './core/images.js';
import {Autosave} from './core/autosave.js';
import {writeProjectFile,readProjectFile,EXTENSION} from './core/nerulio-file.js';
import {WorkspaceRegistry} from './workspaces/registry.js';
import {st} from './strings.js';
import {h,$,storage,fmtBytes,debounce} from './ui/dom.js';
import {icon} from './ui/icons.js';
import {Menus} from './ui/menus.js';
import {Docks} from './ui/docks.js';
import {modal,confirmDialog,commandPalette,shortcutSheet} from './ui/dialogs.js';
import {takeHandoff} from '../task/handoff.js';
import {LOCALES,LANGUAGE_NAMES,locationParts,savePreference,localeFromEnvironment,localizedURL} from '../i18n.js';

const PREFS_KEY='nerulio.studio.prefs.v1';
const MAX_SIDE=32768,MAX_PIXELS=268e6;
const BACKGROUNDS={checker:{background:'checker',checkerA:'#3a3d44',checkerB:'#2e3036'},light:{background:'checker',checkerA:'#d9dbe0',checkerB:'#bfc2c9'},black:{background:'solid',solid:'#000000'},white:{background:'solid',solid:'#ffffff'},magenta:{background:'solid',solid:'#ff00ff'},gray:{background:'solid',solid:'#7f7f7f'}};
const mac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);

export function createStudio(host,{rootURL=new URL('../../',import.meta.url),renderer='auto'}={}){
 // ------------------------------------------------------------------ locale
 const url=new URL(location.href),parts=locationParts(url.pathname,rootURL.pathname);
 let storageRef;try{storageRef=localStorage;}catch{}
 let locale=parts.locale||localeFromEnvironment(url,rootURL,{storage:storageRef,languages:navigator.languages||[]});
 let autoLocale=!parts.locale;
 const t=(key,vars)=>st(locale,key,vars);
 // ------------------------------------------------------------------ state
 const prefs={theme:'dark',bg:'checker',pixelGrid:true,rulers:false,wheel:'auto',grid:null,gridVisible:false,...storage.get(PREFS_KEY,{})};
 const history=new History(P.createProject({name:t('project.untitled')}));
 const images=new ImageStore();
 const workspaces=new WorkspaceRegistry();
 const commands=new Map(),tools=new Map(),listeners={doc:new Set(),asset:new Set(),locale:new Set(),view:new Set()};
 const keymap=new Keymap(DEFAULT_KEYS);
 let activeAssetId=null,assetViews=new Map(),fileName='',currentWs=null,wsInstance=null,wsDispose=null,activeTool='',lastDoc=history.doc,busy=0;
 let wsMenus=[];
 // ------------------------------------------------------------------ DOM
 const root=h('div.studio',{'data-theme':prefs.theme,lang:locale});
 const menubar=h('div.st-menubar',{role:'menubar','aria-label':'menu'});
 const compactMenu=h('button.st-icon-btn.st-compact-only.st-hamburger',{type:'button','aria-haspopup':'menu'});compactMenu.innerHTML=icon('menu');
 const wsTabs=h('div.st-ws-tabs',{role:'tablist'});
 const projectBtn=h('button.st-project',{type:'button'});
 const saveBadge=h('span.st-save-state',{role:'status','aria-live':'polite'});
 const panelsBtn=h('button.st-icon-btn.st-compact-only',{type:'button'});panelsBtn.innerHTML=icon('panels');
 const header=h('header.st-top',{},h('span.st-logo',{'aria-hidden':'true'},'N'),compactMenu,menubar,wsTabs,h('span.st-grow',{}),projectBtn,saveBadge,panelsBtn);
 const toolbar=h('nav.st-toolbar',{role:'toolbar','aria-orientation':'vertical'});
 const canvasHost=h('div.st-canvas-host',{});
 const empty=h('div.st-empty',{});
 const hud=h('div.st-hud',{});
 const bottomSplit=h('div.st-split.st-split-y',{});
 const bottomDock=h('section.st-dock.st-dock-bottom',{});
 const center=h('main.st-center',{},h('div.st-canvas-wrap',{},canvasHost,empty,hud),bottomSplit,bottomDock);
 const rightSplit=h('div.st-split.st-split-x',{});
 const rightDock=h('aside.st-dock.st-dock-right',{});
 const status=h('footer.st-status',{});
 const sheet=h('div.st-sheet',{'aria-hidden':'true'},h('div.st-sheet-grip',{}),h('div.st-sheet-body',{}));
 const menusHost=h('div.st-menus',{});
 const dropHint=h('div.st-drop',{'aria-hidden':'true'},h('div',{}));
 const toastEl=h('div.st-toast',{role:'status','aria-live':'polite',hidden:true});
 const importInput=h('input',{type:'file',multiple:true,accept:'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif',hidden:true});
 const openInput=h('input',{type:'file',accept:EXTENSION+',application/zip',hidden:true});
 root.append(header,h('div.st-body',{},toolbar,center,rightSplit,rightDock),status,sheet,menusHost,dropHint,toastEl,importInput,openInput);
 host.replaceChildren(root);
 const view=new CanvasView(canvasHost,{renderer,options:{...BACKGROUNDS[prefs.bg]||BACKGROUNDS.checker,pixelGrid:prefs.pixelGrid,rulers:prefs.rulers,wheel:prefs.wheel}});
 const menus=new Menus({host:menusHost,resolve:items=>resolveItems(items),onRun:it=>{if(it.id)runCommand(it.id);else it.run?.();}});
 const docks=new Docks({right:rightDock,bottom:bottomDock,sheet,rightSplit,bottomSplit,menus,t,onChange:()=>{}});
 // ------------------------------------------------------------------ status bar
 const slots={};
 for(const k of ['zoom','cursor','selection','image','renderer','spacer','memory','project']){slots[k]=h('span.st-slot.st-slot-'+k,{});status.append(slots[k]);}
 const setStatus=(k,v)=>{if(slots[k]&&slots[k].textContent!==v)slots[k].textContent=v;};
 const updateZoom=()=>{setStatus('zoom',view.image?t('status.zoom',{z:V.zoomPercent(view.view.scale)}):'');hudZoom.textContent=view.image?t('status.zoom',{z:V.zoomPercent(view.view.scale)}):'—';};
 const updateMemory=()=>{const u=images.usage();setStatus('memory',u.count?t('status.memory',{mb:fmtBytes(u.bytes+u.decoded)}):'');slots.memory.title=t('status.memoryHint',{stored:fmtBytes(u.bytes),decoded:fmtBytes(u.decoded)});};
 // ------------------------------------------------------------------ toast
 let toastTimer=0;
 function toast(msg,{error=false}={}){toastEl.textContent=msg;toastEl.classList.toggle('is-error',error);toastEl.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastEl.hidden=true;},error?7000:3200);}
 // ------------------------------------------------------------------ commands
 function command(def){
  const c={group:'other',...def};if(!c.id)throw Error('command id');
  commands.set(c.id,c);if(c.keys)keymap.bind(c.id,c.keys);return c;
 }
 const labelOf=c=>typeof c.label==='function'?c.label():c.label||t('cmd.'+c.id);
 const enabled=c=>!c.enabled||!!c.enabled();
 function runCommand(id,args){
  const c=commands.get(id);if(!c||!enabled(c))return false;
  try{const r=c.run(args);if(r?.catch)r.catch(e=>toast(errText(e),{error:true}));}catch(e){toast(errText(e),{error:true});console.error(e);}
  return true;
 }
 const shortcutOf=id=>{const k=keymap.combos(id)[0];return k?displayCombo(k,{mac}):'';};
 function resolveItems(items){
  return items.map(it=>{
   if(it.sep)return it;
   if(it.command){const c=commands.get(it.command);if(!c)return null;
    return {id:c.id,label:labelOf(c),shortcut:shortcutOf(c.id),checked:c.checked?c.checked():undefined,radio:!!c.radio,disabled:!enabled(c),hint:c.hint?.()};}
   return it;
  }).filter(Boolean).filter((it,i,a)=>!(it.sep&&(i===0||a[i-1]?.sep||i===a.length-1)));
 }
 const errText=e=>{const m=String(e?.message||e);if(m.startsWith('decode:'))return t('error.decode',{name:m.slice(7)});return m;};
 // ------------------------------------------------------------------ tools
 function registerTool(def,owner='app'){
  tools.set(def.id,{...def,owner});
  command({id:'tool.'+def.id,group:'tools',label:()=>t(def.title),keys:def.key?[def.key]:undefined,run:()=>setTool(def.id),checked:()=>activeTool===def.id,radio:true});
  renderToolbar();
 }
 function unregisterTool(id){tools.delete(id);commands.delete('tool.'+id);keymap.unbind('tool.'+id);if(activeTool===id)setTool(defaultTool());renderToolbar();}
 const defaultTool=()=>[...tools.values()].find(x=>x.owner!=='app')?.id||'hand';
 function setTool(id){
  const tool=tools.get(id);if(!tool)return;
  view.tool?.cancel?.(view.lastInfo);
  activeTool=id;view.tool=tool.impl;view.updateCursor();
  for(const b of toolbar.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===id));
 }
 function renderToolbar(){
  const list=[...tools.values()].sort((a,b)=>(a.order??50)-(b.order??50));
  toolbar.replaceChildren(...list.map(tl=>{
   const b=h('button.st-tool',{type:'button','data-tool':tl.id,'aria-pressed':String(tl.id===activeTool),'aria-label':t(tl.title),title:`${t(tl.title)}${tl.key?` (${tl.key})`:''}${tl.hint?' — '+t(tl.hint):''}`});b.innerHTML=icon(tl.icon);
   b.addEventListener('click',()=>{setTool(tl.id);});return b;
  }),h('span.st-grow',{}),toolbarExtra);
  toolbar.setAttribute('aria-label',t('toolbar.label'));
 }
 const toolbarExtra=h('span.st-toolbar-extra',{});
 registerTool({id:'hand',title:'tool.hand',icon:'hand',key:'H',order:90,hint:'tool.handHint',impl:{pans:true,cursor:()=>'grab'}});
 registerTool({id:'zoom',title:'tool.zoom',icon:'zoom',key:'Z',order:91,hint:'tool.zoomHint',impl:{down(i){view.zoomStep(i.alt?-1:1,{x:i.sx,y:i.sy});return false;},cursor:()=>'zoom-in'}});
 // ------------------------------------------------------------------ document flow
 const doc=()=>history.doc;
 function onHistory(ev){
  const prev=lastDoc;lastDoc=history.doc;
  if(prev!==history.doc){
   for(const fn of listeners.doc)fn(history.doc,prev,ev);
   if(!P.assetById(history.doc,activeAssetId))showAsset(history.doc.assets[0]?.id||null);
   else{const a=P.assetById(history.doc,activeAssetId),b=P.assetById(prev,activeAssetId);if(P.primaryBlob(a)!==P.primaryBlob(b))showAsset(a.id);}
   if(ev.type!=='reset')autosave.schedule();
   refreshChrome();
  }
  docks.panels.get('history')&&renderHistory();
  updateSaveState();
 }
 history.subscribe(onHistory);
 async function showAsset(id){
  const a=id?P.assetById(doc(),id):null;activeAssetId=a?.id||null;
  empty.hidden=!!a;hud.hidden=!a;root.classList.toggle('has-image',!!a);
  if(!a){view.clearImage();setStatus('image','');updateZoom();for(const fn of listeners.asset)fn(null);renderAssets();return;}
  try{
   const blob=P.primaryBlob(a),bmp=await images.bitmap(blob);if(activeAssetId!==a.id)return;
   await view.setImage(bmp,a.width,a.height,{view:assetViews.get(a.id)||null});
   images.trimBitmaps(new Set([blob]));
  }catch(e){toast(errText(e),{error:true});}
  setStatus('image',t('status.image',{w:a.width,h:a.height}));updateZoom();updateMemory();
  for(const fn of listeners.asset)fn(a.id);
  renderAssets();autosave.schedule();
 }
 view.on('view',v=>{if(activeAssetId)assetViews.set(activeAssetId,{...v});updateZoom();saveViewSoon();for(const fn of listeners.view)fn(v);});
 const saveViewSoon=debounce(()=>{if(doc().assets.length)autosave.schedule();},1500);
 view.on('cursor',px=>setStatus('cursor',px?t('status.cursor',{x:px.x,y:px.y}):''));
 // ------------------------------------------------------------------ autosave
 const autosave=new Autosave({images,delay:1000,keep:10,
  source:()=>{const d=doc();if(!d.assets.length&&!history.entries.length)return {doc:null};
   return {doc:d,ui:{activeAsset:activeAssetId,views:Object.fromEntries(assetViews),workspace:currentWs},fileSaved:!history.dirty,fileName};},
  onState:()=>updateSaveState()});
 function updateSaveState(){
  const fileDirty=history.dirty&&(doc().assets.length>0||history.entries.length>0);
  let key,cls;
  if(autosave.error){key='save.autosaveFailed';cls='is-error';}
  else if(!doc().assets.length&&!history.entries.length){key='save.empty';cls='';}
  else if(!fileDirty){key='save.saved';cls='is-clean';}
  else if(autosave.saving||autosave.pending){key='save.saving';cls='is-busy';}
  else{key=autosave.lastAt?'save.autosaved':'save.unsaved';cls='is-dirty';}
  saveBadge.textContent=t(key,{time:autosave.lastAt?new Date(autosave.lastAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',second:'2-digit'}):''});
  saveBadge.className='st-save-state '+cls;saveBadge.title=t(fileDirty?'save.hintDirty':'save.hintClean');
  root.dataset.dirty=String(fileDirty);root.dataset.autosave=autosave.pending||autosave.saving?'pending':autosave.error?'error':'idle';
  document.title=`${fileDirty?'• ':''}${doc().name} — ${t('app.title')}`;
  setStatus('project','');
 }
 addEventListener('beforeunload',e=>{
  const unsafe=(history.dirty&&doc().assets.length>0)||autosave.dirty||!!autosave.error;
  if(unsafe){autosave.flush();e.preventDefault();e.returnValue='';return '';}
 });
 addEventListener('pagehide',()=>{autosave.flush();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autosave.flush();});
 // ------------------------------------------------------------------ file intake
 async function importFiles(files,{from='picker'}={}){
  files=[...files];
  const project=files.find(f=>/\.nerulio$/i.test(f.name||''));
  if(project){await openProjectFile(project);files=files.filter(f=>f!==project);if(!files.length)return [];}
  const ok=files.filter(isImportable),bad=files.filter(f=>!isImportable(f));
  if(bad.length)toast(t('error.unsupported',{names:bad.map(f=>f.name).slice(0,3).join(', ')}),{error:true});
  if(!ok.length)return [];
  busy++;root.classList.add('is-busy');
  const assets=[],errors=[];
  try{
   for(let i=0;i<ok.length;i++){
    const f=ok[i];setStatus('selection',t('status.importing',{i:i+1,n:ok.length}));
    try{
     const {record,source}=await images.importFile(f);
     if(record.width>MAX_SIDE||record.height>MAX_SIDE||record.width*record.height>MAX_PIXELS)throw Error(t('error.tooBig',{name:f.name,w:record.width,h:record.height}));
     assets.push(P.imageAsset({name:f.name||'image.png',width:record.width,height:record.height,blob:record.id,source}));
    }catch(e){errors.push(errText(e));}
   }
  }finally{busy--;root.classList.toggle('is-busy',busy>0);setStatus('selection','');}
  if(errors.length)toast(errors.join(' · '),{error:true});
  if(!assets.length)return [];
  history.execute(edit(t('cmd.importN',{n:assets.length}),d=>P.addAssets(d,assets),{meta:{from}}));
  if(!doc().name||doc().name===t('project.untitled')){/* keep: the user names projects explicitly */}
  await showAsset(assets[0].id);
  toast(t('toast.imported',{n:assets.length}));
  return assets;
 }
 async function openProjectFile(file){
  if(!await confirmReplace())return;
  busy++;root.classList.add('is-busy');
  try{
   const {doc:loaded,blobs}=await readProjectFile(file);
   for(const [id,blob]of blobs)await images.put(blob,{id});
   await loadDocument(loaded,{fileSaved:true,fileName:file.name});
   toast(t('toast.opened',{name:file.name}));
  }catch(e){toast(t('error.open',{reason:errText(e)}),{error:true});}
  finally{busy--;root.classList.toggle('is-busy',busy>0);}
 }
 async function loadDocument(d,{fileSaved=false,fileName:name='',ui={}}={}){
  await autosave.flush();
  assetViews=new Map(Object.entries(ui.views||{}));fileName=name;
  history.reset(d,{saved:fileSaved});lastDoc=history.doc;
  for(const fn of listeners.doc)fn(history.doc,null,{type:'reset'});
  images.forget(P.referencedBlobs(d));
  await showAsset(ui.activeAsset&&P.assetById(d,ui.activeAsset)?ui.activeAsset:d.assets[0]?.id||null);
  autosave.schedule();refreshChrome();updateSaveState();renderHistory();
 }
 async function confirmReplace(){
  if(!history.dirty||!doc().assets.length)return true;
  return confirmDialog(root,{title:t('confirm.replaceTitle'),message:t('confirm.replace',{name:doc().name}),ok:t('confirm.continue'),cancel:t('confirm.cancel')});
 }
 const safeName=s=>String(s||'project').replace(/[\\/:*?"<>|\x00-\x1f]+/g,'_').trim()||'project';
 async function saveProject({ask=false}={}){
  if(!doc().assets.length){toast(t('error.nothingToSave'),{error:true});return;}
  if(ask){const name=await promptText(t('dialog.saveAsTitle'),t('dialog.projectName'),doc().name);if(name==null)return;if(name.trim())history.execute(edit(t('cmd.file.rename'),d=>P.renameProject(d,name)));}
  const blob=await writeProjectFile(doc(),id=>images.blob(id));
  fileName=safeName(doc().name)+EXTENSION;
  const a=h('a',{href:URL.createObjectURL(blob),download:fileName});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),30000);
  history.markSaved();autosave.schedule();updateSaveState();toast(t('toast.saved',{name:fileName}));
 }
 function promptText(title,label,value){
  const input=h('input.st-input',{type:'text',value,autofocus:true,maxlength:'120','aria-label':label});
  const m=modal(root,{title,body:h('label.st-field',{},h('span',{},label),input),buttons:[{label:t('confirm.cancel'),value:null},{label:t('confirm.ok'),value:'ok',primary:true}]});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();m.close('ok');}});
  setTimeout(()=>{input.focus();input.select();},0);
  return m.done.then(v=>v==='ok'?input.value:null);
 }
 importInput.addEventListener('change',()=>{const f=[...importInput.files];importInput.value='';if(f.length)importFiles(f);});
 openInput.addEventListener('change',()=>{const f=openInput.files[0];openInput.value='';if(f)openProjectFile(f);});
 // drop anywhere
 let dragDepth=0;const dragOn=()=>root.classList.toggle('is-dropping',dragDepth>0);
 addEventListener('dragenter',e=>{if(e.dataTransfer?.types?.includes('Files')){dragDepth++;dragOn();}});
 addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);dragOn();});
 addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
 addEventListener('drop',e=>{dragDepth=0;dragOn();if(!e.dataTransfer?.files?.length)return;e.preventDefault();importFiles([...e.dataTransfer.files],{from:'drop'});});
 addEventListener('paste',e=>{if(isTypingTarget(document.activeElement))return;const f=[...(e.clipboardData?.files||[])];if(f.length){e.preventDefault();importFiles(f,{from:'paste'});}});
 // ------------------------------------------------------------------ panels shared by every workspace
 const assetsList=h('div.st-assets',{role:'listbox','aria-label':'assets'});
 docks.add({id:'assets',title:()=>t('panel.assets'),dock:'right',order:10,badge:()=>doc().assets.length?String(doc().assets.length):'',
  render(body,{actions}){
   const add=h('button.st-icon-btn',{type:'button'});add.innerHTML=icon('plus');add.addEventListener('click',()=>runCommand('file.import'));add.dataset.i18nTitle='cmd.file.import';
   actions.append(add);body.append(assetsList);
  }});
 const thumbCache=new Map();
 function renderAssets(){
  const list=doc().assets;docks.badge('assets');
  const addBtn=docks.panels.get('assets')?.actions.querySelector('button');if(addBtn){addBtn.title=t('cmd.file.import');addBtn.setAttribute('aria-label',t('cmd.file.import'));}
  assetsList.setAttribute('aria-label',t('panel.assets'));
  if(!list.length){assetsList.replaceChildren(h('p.st-muted.st-pad',{},t('assets.empty')));return;}
  assetsList.replaceChildren(...list.map((a,i)=>{
   const sel=a.id===activeAssetId;
   const thumb=h('canvas.st-thumb',{width:32,height:32,'aria-hidden':'true'});drawThumb(thumb,a);
   const del=h('button.st-icon-btn.st-asset-del',{type:'button','aria-label':t('assets.remove',{name:a.name}),title:t('assets.remove',{name:a.name}),tabindex:'-1'});del.innerHTML=icon('trash');
   del.addEventListener('click',e=>{e.stopPropagation();removeAsset(a.id);});
   const row=h('div.st-asset',{role:'option','aria-selected':String(sel),tabindex:sel||(!activeAssetId&&!i)?'0':'-1','data-asset':a.id,title:a.source?.name||a.name},thumb,h('span.st-asset-name',{},a.name),h('small',{},`${a.width}×${a.height}${a.frames.length?' · '+t('assets.frames',{n:a.frames.length}):''}`),del);
   row.addEventListener('click',()=>showAsset(a.id));
   row.addEventListener('dblclick',async()=>{const n=await promptText(t('dialog.renameAsset'),t('dialog.name'),a.name);if(n!=null)history.execute(edit(t('cmd.renameAsset'),d=>P.renameAsset(d,a.id,n)));});
   row.addEventListener('keydown',e=>{
    const rows=[...assetsList.querySelectorAll('.st-asset')],k=rows.indexOf(row);
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();const n=rows[k+(e.key==='ArrowDown'?1:-1)];if(n){showAsset(n.dataset.asset).then(()=>assetsList.querySelector(`[data-asset="${n.dataset.asset}"]`)?.focus());}}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();showAsset(a.id);}
    else if(e.key==='Delete'){e.preventDefault();e.stopPropagation();removeAsset(a.id);}
    else if(e.key==='F2'){e.preventDefault();row.dispatchEvent(new MouseEvent('dblclick'));}
   });
   return row;
  }));
 }
 async function drawThumb(c,a){
  const blob=P.primaryBlob(a);let bmp=thumbCache.get(blob);
  if(!bmp){const r=images.get(blob);if(!r)return;const s=Math.min(1,64/Math.max(a.width,a.height));
   try{bmp=await createImageBitmap(r.blob,{resizeWidth:Math.max(1,Math.round(a.width*s)),resizeHeight:Math.max(1,Math.round(a.height*s)),resizeQuality:'pixelated'});}catch{return;}thumbCache.set(blob,bmp);}
  const x=c.getContext('2d'),k=Math.min(32/bmp.width,32/bmp.height),w=bmp.width*k,hh=bmp.height*k;x.imageSmoothingEnabled=false;x.clearRect(0,0,32,32);x.drawImage(bmp,(32-w)/2,(32-hh)/2,w,hh);
 }
 function removeAsset(id){const a=P.assetById(doc(),id);if(!a)return;history.execute(edit(t('cmd.removeAsset',{name:a.name}),d=>P.removeAssets(d,[id])));toast(t('toast.removed',{name:a.name,undo:shortcutOf('edit.undo')}));}
 const historyList=h('div.st-history',{role:'listbox','aria-label':'history'});
 docks.add({id:'history',title:()=>t('panel.history'),dock:'right',order:90,badge:()=>history.entries.length?String(history.index)+'/'+history.entries.length:'',render(body){body.append(historyList);}});
 function renderHistory(){
  docks.badge('history');historyList.setAttribute('aria-label',t('panel.history'));
  const rows=[h('div.st-hist-row',{role:'option','aria-selected':String(history.index===0),'data-index':'0',tabindex:'-1'},h('span.st-hist-dot',{}),t('history.start'))];
  history.entries.forEach((e,i)=>rows.push(h('div.st-hist-row'+(i<history.index?'':'.is-undone'),{role:'option','aria-selected':String(history.index===i+1),'data-index':String(i+1),tabindex:'-1'},h('span.st-hist-dot',{}),e.label)));
  historyList.replaceChildren(...rows);
  for(const r of rows)r.addEventListener('click',()=>history.jump(Number(r.dataset.index)));
  historyList.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
 }
 // ------------------------------------------------------------------ app commands
 const zoomTo=s=>()=>view.zoomTo(s,view.lastPointer);
 const hasImage=()=>!!view.image;
 [
  {id:'file.new',group:'file',run:async()=>{if(await confirmReplace())await loadDocument(P.createProject({name:t('project.untitled')}),{fileSaved:true});}},
  {id:'file.open',group:'file',run:()=>openInput.click()},
  {id:'file.import',group:'file',run:()=>importInput.click()},
  {id:'file.save',group:'file',enabled:()=>doc().assets.length>0,run:()=>saveProject()},
  {id:'file.saveAs',group:'file',enabled:()=>doc().assets.length>0,run:()=>saveProject({ask:true})},
  {id:'file.rename',group:'file',run:async()=>{const n=await promptText(t('dialog.renameProject'),t('dialog.projectName'),doc().name);if(n!=null)history.execute(edit(t('cmd.file.rename'),d=>P.renameProject(d,n)));}},
  {id:'file.versions',group:'file',run:()=>showVersions()},
  {id:'edit.undo',group:'edit',label:()=>history.canUndo?t('cmd.edit.undoX',{what:history.undoLabel}):t('cmd.edit.undo'),enabled:()=>history.canUndo,run:()=>{view.tool?.cancel?.(view.lastInfo);history.undo();}},
  {id:'edit.redo',group:'edit',label:()=>history.canRedo?t('cmd.edit.redoX',{what:history.redoLabel}):t('cmd.edit.redo'),enabled:()=>history.canRedo,run:()=>history.redo()},
  {id:'edit.selectAll',group:'edit',enabled:()=>!!wsInstance?.selectAll,run:()=>wsInstance.selectAll()},
  {id:'edit.deselect',group:'edit',enabled:()=>!!wsInstance?.deselect,run:()=>wsInstance.deselect()},
  {id:'edit.delete',group:'edit',enabled:()=>!!wsInstance?.hasSelection?.(),run:()=>wsInstance.deleteSelection()},
  {id:'app.palette',group:'app',run:()=>openPalette()},
  {id:'app.shortcuts',group:'app',run:()=>openShortcuts()},
  {id:'app.history',group:'app',run:()=>docks.show('history')},
  {id:'view.zoomIn',group:'view',enabled:hasImage,run:()=>view.zoomStep(1)},
  {id:'view.zoomOut',group:'view',enabled:hasImage,run:()=>view.zoomStep(-1)},
  {id:'view.zoom100',group:'view',enabled:hasImage,run:zoomTo(1)},
  {id:'view.fit',group:'view',enabled:hasImage,run:()=>view.fit()},
  ...Object.entries({zoom200:2,zoom400:4,zoom800:8,zoom1600:16,zoom3200:32}).map(([k,s])=>({id:'view.'+k,group:'view',enabled:hasImage,label:()=>t('cmd.view.zoomN',{z:s*100}),run:zoomTo(s)})),
  {id:'view.pixelGrid',group:'view',checked:()=>view.options.pixelGrid,run:()=>setPref({pixelGrid:!view.options.pixelGrid})},
  {id:'view.grid',group:'view',checked:()=>!!view.options.gridVisible,enabled:()=>!!view.options.grid,run:()=>{view.set({gridVisible:!view.options.gridVisible});for(const fn of listeners.view)fn(view.view);}},
  {id:'view.rulers',group:'view',checked:()=>!!view.options.rulers,run:()=>setPref({rulers:!view.options.rulers})},
  {id:'view.rightDock',group:'view',checked:()=>docks.layout.rightOpen,run:()=>docks.toggleRight()},
  {id:'view.bottomDock',group:'view',checked:()=>docks.layout.bottomOpen,run:()=>docks.toggleBottom()},
  {id:'view.resetLayout',group:'view',run:()=>docks.reset()},
  ...Object.keys(BACKGROUNDS).map(k=>({id:'view.bg.'+k,group:'view',radio:true,checked:()=>prefs.bg===k,run:()=>setPref({bg:k})})),
  ...['auto','zoom','pan'].map(k=>({id:'view.wheel.'+k,group:'view',radio:true,checked:()=>prefs.wheel===k,run:()=>setPref({wheel:k})})),
  ...['dark','light'].map(k=>({id:'view.theme.'+k,group:'view',radio:true,checked:()=>prefs.theme===k,run:()=>setPref({theme:k})})),
  ...LOCALES.map(l=>({id:'help.lang.'+l,group:'help',radio:true,label:()=>LANGUAGE_NAMES[l],checked:()=>locale===l,run:()=>setLocale(l)})),
  {id:'help.about',group:'help',run:()=>showAbout()}
 ].forEach(command);
 // nudges and frame stepping are delegated to the workspace; they exist only when it handles them
 for(const [id,dx,dy]of [['nudge.left',-1,0],['nudge.right',1,0],['nudge.up',0,-1],['nudge.down',0,1],['nudge.left10',-10,0],['nudge.right10',10,0],['nudge.up10',0,-10],['nudge.down10',0,10]])
  command({id,group:'edit',hidden:true,enabled:()=>!!wsInstance?.nudge&&!!wsInstance?.hasSelection?.(),run:()=>wsInstance.nudge(dx,dy)});
 command({id:'frame.prev',group:'navigate',enabled:()=>!!wsInstance?.step,run:()=>wsInstance.step(-1)});
 command({id:'frame.next',group:'navigate',enabled:()=>!!wsInstance?.step,run:()=>wsInstance.step(1)});
 function setPref(p){
  Object.assign(prefs,p);storage.set(PREFS_KEY,{theme:prefs.theme,bg:prefs.bg,pixelGrid:prefs.pixelGrid,rulers:prefs.rulers,wheel:prefs.wheel});
  if('theme'in p){root.dataset.theme=prefs.theme;}
  if('bg'in p)view.set({...BACKGROUNDS.checker,...(BACKGROUNDS[prefs.bg]||{})});
  if('pixelGrid'in p)view.set({pixelGrid:prefs.pixelGrid});
  if('rulers'in p)view.set({rulers:prefs.rulers});
  if('wheel'in p)view.set({wheel:prefs.wheel});
 }
 // ------------------------------------------------------------------ menus
 const sub=(label,ids)=>({label:t(label),submenu:()=>ids.map(id=>typeof id==='string'?(id==='-'?{sep:true}:{command:id}):id)});
 function menuDefs(){
  const items=list=>()=>list.map(x=>x==='-'?{sep:true}:typeof x==='string'?{command:x}:x);
  return [
   {id:'file',title:()=>t('menu.file'),items:items(['file.new','file.open','file.import','-','file.save','file.saveAs','file.rename','-','file.versions'])},
   {id:'edit',title:()=>t('menu.edit'),items:items(['edit.undo','edit.redo','-','edit.selectAll','edit.deselect','edit.delete','-','app.history','app.palette'])},
   {id:'view',title:()=>t('menu.view'),items:()=>[{command:'view.zoomIn'},{command:'view.zoomOut'},{command:'view.zoom100'},{command:'view.fit'},sub('menu.zoomLevels',['view.zoom200','view.zoom400','view.zoom800','view.zoom1600','view.zoom3200']),{sep:true},
    {command:'view.pixelGrid'},{command:'view.grid'},{command:'view.rulers'},sub('menu.background',Object.keys(BACKGROUNDS).map(k=>'view.bg.'+k)),sub('menu.wheel',['view.wheel.auto','view.wheel.zoom','view.wheel.pan']),{sep:true},
    {command:'view.rightDock'},{command:'view.bottomDock'},{command:'view.resetLayout'},sub('menu.theme',['view.theme.dark','view.theme.light'])]},
   ...wsMenus.map(m=>({id:m.id,title:()=>t(m.title),items:()=>m.items().map(x=>x==='-'?{sep:true}:typeof x==='string'?{command:x}:x)})),
   {id:'workspace',title:()=>t('menu.workspace'),items:()=>workspaces.list().map(w=>w.status==='ready'?{command:'ws.'+w.id}:{label:t(w.title)+' — '+t('ws.comingShort',{phase:w.phase||''}),disabled:true,hint:t(w.summary||'')})},
   {id:'help',title:()=>t('menu.help'),items:()=>[{command:'app.shortcuts'},{command:'app.palette'},{sep:true},sub('menu.language',LOCALES.map(l=>'help.lang.'+l)),{sep:true},{command:'help.about'}]}
  ];
 }
 const renderMenus=()=>menus.renderBar(menubar,menuDefs());
 compactMenu.addEventListener('click',()=>{const r=compactMenu.getBoundingClientRect();menus.openAt(menuDefs().map(m=>({label:m.title(),submenu:m.items})),r.left,r.bottom,{owner:compactMenu});});
 panelsBtn.addEventListener('click',()=>docks.openSheet(!sheet.classList.contains('is-open')));
 sheet.querySelector('.st-sheet-grip').addEventListener('click',()=>docks.openSheet(false));
 projectBtn.addEventListener('click',()=>runCommand('file.rename'));
 // ------------------------------------------------------------------ workspaces
 function renderWsTabs(){
  wsTabs.setAttribute('aria-label',t('menu.workspace'));
  wsTabs.replaceChildren(...workspaces.list().map(w=>{
   const ready=w.status==='ready',on=w.id===currentWs;
   const b=h('button.st-ws-tab',{type:'button',role:'tab','aria-selected':String(on),'aria-disabled':ready?null:'true',tabindex:on?'0':'-1','data-ws':w.id,title:ready?t(w.title):t('ws.coming',{name:t(w.title),phase:w.phase||'',what:t(w.summary||'')})},t(w.title),ready?'':h('small',{},w.phase||''));
   b.addEventListener('click',()=>{if(ready)activateWorkspace(w.id);else toast(b.title);});
   b.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();const all=[...wsTabs.children],i=all.indexOf(b),n=all[(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length];n.focus();});
   return b;
  }));
 }
 function makeContext(ws){
  const disposers=[],on=(type,fn)=>{listeners[type].add(fn);disposers.push(()=>listeners[type].delete(fn));};
  const ctx={
   t,get locale(){return locale;},history,images,view,edit,
   get doc(){return history.doc;},
   execute:cmd=>history.execute(cmd),
   get activeAsset(){return P.assetById(history.doc,activeAssetId);},
   showAsset,importFiles,toast,runCommand,shortcutOf,
   status:(slot,text)=>setStatus(slot==='selection'?'selection':slot,text),
   tool(def){registerTool(def,ws.id);disposers.push(()=>unregisterTool(def.id));},
   panel(def){const p=docks.add(def);disposers.push(()=>docks.remove(def.id));return p;},
   showPanel:id=>docks.show(id),
   command(def){command(def);disposers.push(()=>{commands.delete(def.id);keymap.unbind(def.id);});},
   menu(def){wsMenus.push(def);renderMenus();disposers.push(()=>{wsMenus=wsMenus.filter(m=>m!==def);renderMenus();});},
   layer(l){view.addLayer(l);disposers.push(()=>view.removeLayer(l));return l;},
   on,
   badge:id=>docks.badge(id),
   setTool
  };
  return {ctx,dispose(){while(disposers.length)disposers.pop()();}};
 }
 function activateWorkspace(id){
  const def=workspaces.get(id);if(!def||def.status!=='ready'||id===currentWs)return;
  wsInstance?.deactivate?.();wsDispose?.();
  currentWs=id;const {ctx,dispose}=makeContext(def);wsDispose=dispose;
  wsInstance=def.activate(ctx)||{};
  if(!tools.has(activeTool)||tools.get(activeTool).owner==='app')setTool(defaultTool());
  renderWsTabs();renderMenus();root.dataset.workspace=id;
  wsInstance.onAsset?.(activeAssetId);
 }
 // ------------------------------------------------------------------ keyboard
 document.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  const combo=eventCombo(e,{mac}),target=e.target,typing=isTypingTarget(target);
  if(document.querySelector('dialog[open]'))return;// dialogs own the keyboard
  if(menus.isOpen&&!['Mod+K','?'].includes(combo))return;
  if(combo==='Space'){
   if(typing||target.matches?.(':focus-visible')&&target.matches('button,[role="tab"],[role="option"],a,summary,input,select'))return;
   e.preventDefault();view.setSpace(true);return;
  }
  if(typing){if(combo==='Escape')target.blur();return;}
  if(e.key==='F10'){e.preventDefault();menus.focusBar();return;}
  if(combo==='Escape'&&view.tool?.active){e.preventDefault();view.tool.cancel(view.lastInfo);return;}
  if(combo==='Escape'&&sheet.classList.contains('is-open')){docks.openSheet(false);return;}
  // single keys in lists/tabs/menus keep their widget meaning (arrows, Home/End…)
  const inList=target.closest?.('[role="listbox"],[role="tablist"]'),inMenu=target.closest?.('[role="menu"],[role="menubar"]');
  const inWidget=inList||inMenu;
  const id=keymap.lookup(combo);
  const widgetKey=inMenu?!/^(Mod|Alt|F\d)/.test(combo):inList&&/^(Arrow|Home|End|Enter|Space|Delete|Backspace)/.test(combo);
  if(id&&!widgetKey){
   const c=commands.get(id);
   if(c){e.preventDefault();if(enabled(c))runCommand(id);return;}
  }
  if(BROWSER_DEFAULTS_TO_BLOCK.has(combo)&&!inWidget)e.preventDefault();
 },true);
 document.addEventListener('keyup',e=>{if(e.code==='Space'||e.key===' ')view.setSpace(false);});
 addEventListener('blur',()=>view.setSpace(false));
 // Browser zoom (Ctrl+wheel) must never scale the whole app: the canvas zooms instead.
 addEventListener('wheel',e=>{if(e.ctrlKey&&!e.target.closest?.('.cv-stage'))e.preventDefault();},{passive:false});
 // ------------------------------------------------------------------ palette / shortcut sheet / about / versions
 function paletteList(){
  return [...commands.values()].filter(c=>!c.hidden).map(c=>({id:c.id,label:labelOf(c),group:c.group,groupLabel:t('group.'+c.group),shortcut:shortcutOf(c.id),disabled:!enabled(c)}));
 }
 function openPalette(){menus.close();commandPalette(root,{t,list:paletteList,run:runCommand});}
 function openShortcuts(){
  menus.close();
  const groups=new Map();
  for(const c of commands.values()){const keys=keymap.combos(c.id).map(k=>displayCombo(k,{mac}));if(!keys.length)continue;const g=c.group;if(!groups.has(g))groups.set(g,[]);groups.get(g).push([labelOf(c),keys]);}
  const out=[...groups].map(([g,rows])=>({title:t('group.'+g),rows}));
  out.push({title:t('group.pointer'),rows:[[t('keys.wheel'),[t('keys.wheelKey')]],[t('keys.ctrlWheel'),[displayCombo('Mod+Z',{mac}).replace(/Z$/,'')+t('keys.wheelKey')]],[t('keys.spaceDrag'),['Space + '+t('keys.drag')]],[t('keys.middleDrag'),[t('keys.middle')]],[t('keys.pinch'),[t('keys.pinchKey')]],[t('keys.shiftClick'),['Shift + '+t('keys.click')]],[t('keys.escDrag'),['Esc']]]});
  shortcutSheet(root,{t,groups:out});
 }
 function showAbout(){
  const u=images.usage();
  modal(root,{title:t('about.title'),body:h('div.st-about',{},h('p',{},t('about.body')),h('ul',{},
   h('li',{},t('about.renderer',{r:view.rendererKind==='webgl2'?'WebGL2':'Canvas 2D',why:view.glError?` (${view.glError})`:''})),
   h('li',{},t('about.dpr',{dpr:devicePixelRatio})),h('li',{},t('about.memory',{stored:fmtBytes(u.bytes),decoded:fmtBytes(u.decoded),n:u.count})),h('li',{},t('about.local')))),buttons:[{label:t('confirm.ok'),value:true,primary:true}]});
 }
 async function showVersions(){
  let list=[];try{list=await autosave.list();}catch(e){toast(errText(e),{error:true});return;}
  const body=h('div.st-versions',{});
  if(!list.length)body.append(h('p.st-muted',{},t('versions.none')));
  const m=modal(root,{title:t('versions.title'),body:[h('p.st-muted',{},t('versions.hint')),body],buttons:[{label:t('confirm.close'),value:null}]});
  for(const s of list){
   const b=h('button.st-version',{type:'button'},h('b',{},s.name),h('span',{},new Date(s.at).toLocaleString(locale)),h('small',{},t('versions.meta',{assets:s.assets,frames:s.frames})));
   b.addEventListener('click',async()=>{m.close(null);if(!await confirmReplace())return;try{const snap=await autosave.load(s.key);await loadDocument(snap.doc,{fileSaved:snap.fileSaved,fileName:snap.fileName,ui:snap.ui});toast(t('toast.restored'));}catch(e){toast(errText(e),{error:true});}});
   body.append(b);
  }
 }
 // ------------------------------------------------------------------ empty state + HUD
 const hudZoom=h('button.st-hud-zoom',{type:'button'});
 function renderEmpty(){
  const imp=h('button.st-btn.primary',{type:'button'},t('empty.import'));imp.addEventListener('click',()=>runCommand('file.import'));
  const open=h('button.st-btn',{type:'button'},t('empty.open'));open.addEventListener('click',()=>runCommand('file.open'));
  const keys=h('button.st-link',{type:'button'},t('empty.keys'));keys.addEventListener('click',()=>runCommand('app.shortcuts'));
  empty.replaceChildren(h('div.st-empty-card',{},h('div.st-empty-art',{'aria-hidden':'true'},h('span',{}),h('span',{}),h('span',{}),h('span',{})),h('h1',{},t('empty.title')),h('p',{},t('empty.formats')),h('div.st-empty-actions',{},imp,open),h('p.st-muted',{},t('empty.local'),' · ',keys)));
  const b=(ic,label,fn)=>{const x=h('button.st-icon-btn',{type:'button','aria-label':label,title:label});x.innerHTML=icon(ic);x.addEventListener('click',fn);return x;};
  hudZoom.title=t('cmd.view.zoom100');hudZoom.onclick=()=>runCommand('view.zoom100');
  hud.replaceChildren(b('minus',t('cmd.view.zoomOut'),()=>runCommand('view.zoomOut')),hudZoom,b('plus',t('cmd.view.zoomIn'),()=>runCommand('view.zoomIn')),b('fit',t('cmd.view.fit'),()=>runCommand('view.fit')));
  updateZoom();
 }
 // ------------------------------------------------------------------ chrome
 function refreshChrome(){
  projectBtn.textContent=doc().name;projectBtn.title=t('cmd.file.rename');
  setStatus('renderer',view.rendererKind==='webgl2'?'WebGL2':'Canvas2D');slots.renderer.title=t('about.rendererShort');
  renderAssets();updateMemory();updateSaveState();docks.badge('assets');
 }
 function relabel(){
  root.lang=locale;document.documentElement.lang=locale;
  view.stage.setAttribute('aria-label',t('canvas.label'));
  compactMenu.setAttribute('aria-label',t('menu.more'));panelsBtn.setAttribute('aria-label',t('panel.all'));panelsBtn.title=t('panel.all');
  menubar.setAttribute('aria-label',t('menu.bar'));status.setAttribute('aria-label',t('status.label'));sheet.setAttribute('aria-label',t('panel.all'));
  dropHint.firstChild.textContent=t('drop.hint');
  renderMenus();renderWsTabs();renderToolbar();renderEmpty();docks.relabel();renderHistory();refreshChrome();
  for(const fn of listeners.locale)fn(locale);
 }
 function setLocale(l){
  locale=l;autoLocale=false;savePreference(l,storageRef);
  const next=localizedURL('game/studio',l,rootURL,location.search);history.doc&&window.history.replaceState({},'',next);
  relabel();
 }
 const compactQuery=matchMedia('(max-width: 760px)');
 const applyMode=()=>{const m=compactQuery.matches?'compact':'desktop';root.dataset.mode=m;docks.setMode(m);if(m==='desktop')docks.openSheet(false);};
 compactQuery.addEventListener('change',applyMode);
 // ------------------------------------------------------------------ public API (workspaces, tests, handoff)
 const api={
  t,get locale(){return locale;},history,images,view,docks,menus,autosave,workspaces,keymap,commands,
  get doc(){return history.doc;},get activeAssetId(){return activeAssetId;},get workspace(){return currentWs;},
  register(def){
   workspaces.register(def);
   if(def.status==='ready')command({id:'ws.'+def.id,group:'workspace',radio:true,label:()=>t(def.title),checked:()=>currentWs===def.id,run:()=>activateWorkspace(def.id)});
   renderWsTabs();return api;
  },
  activateWorkspace,runCommand,importFiles,openProjectFile,loadDocument,showAsset,toast,setTool,
  get tool(){return activeTool;},
  async start(){
   applyMode();relabel();showAsset(null);
   activateWorkspace(workspaces.firstReady()?.id);
   root.dataset.ready='1';document.documentElement.dataset.studioReady='1';// interactive from here; recovery may still ask
   const [session,handoff]=await Promise.all([autosave.session().catch(()=>null),takeHandoff()]);
   if(handoff.files.length){
    const assets=await importFiles(handoff.files,{from:'handoff'});
    if(handoff.meta&&assets.length)wsInstance?.handoff?.(handoff.meta,assets);
    if(session)toast(t('toast.previousKept'));
   }else if(session){
    let snap=null;try{snap=(await autosave.list(session.projectId)).find(s=>s.key===session.key);}catch{}
    if(snap&&snap.assets>0){
     const res=await modal(root,{title:t('recover.title'),body:h('div',{},h('p',{},t('recover.body',{name:snap.name,time:new Date(snap.at).toLocaleString(locale),assets:snap.assets,frames:snap.frames})),h('p.st-muted',{},t('recover.hint'))),
      buttons:[{label:t('recover.discard'),value:'new'},{label:t('recover.restore'),value:'restore',primary:true}],className:'st-recover'}).done;
     if(res==='restore'){try{const s=await autosave.load(session.key);await loadDocument(s.doc,{fileSaved:s.fileSaved,fileName:s.fileName,ui:s.ui});toast(t('toast.restored'));}catch(e){toast(errText(e),{error:true});}}
     else await autosave.clearSession().catch(()=>{});
    }
   }
   document.documentElement.dataset.studioStarted='1';
  }
 };
 history.doc&&refreshChrome();
 return api;
}
