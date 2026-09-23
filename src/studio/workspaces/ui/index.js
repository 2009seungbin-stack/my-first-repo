/** UI workspace (P5): 9-slice suite, button states, UI atlas, game fonts. Uses only the workspace
 * plug-in API (docs/STUDIO.md). Document state lives in settings.ui (state.js), so every edit is
 * one undoable command and autosaves with the project; font and translation files are attached
 * blobs (settings.files). Pixel-heavy work runs in ui-worker.js; the maths is src/game/ui/*.
 *
 * Four modes share one canvas: 9-SLICE (an element with its guides), STATES (the state sheet of a
 * button), ATLAS (a sheet with its elements) and FONT (the generated atlas page). Each mode adds its
 * own panels and removes them when it is left (ctx.removePanel). */
import './strings.js';
import * as P from '../../core/project.js';
import {h} from '../../ui/dom.js';
import {ICONS} from '../../ui/icons.js';
import {sha256Hex} from '../../core/nerulio-file.js';
import {decodePNG} from '../../../game/texture-png.js';
import {isImportable} from '../../core/images.js';
import * as U from './state.js';
import {fromNinePatchPNG} from '../../../game/ui/nine-patch.js';
import {sniffFont} from '../../../game/ui/font/opentype.js';
import nineMode from './nine.js';
import statesMode from './states.js';
import atlasMode from './atlas.js';
import fontMode from './font.js';
const CSS_ID='ui-ws-css';
const svg=b=>`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${b}</svg>`;
Object.assign(ICONS,{
 uiEdit:svg('<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M5.5 2.5v11M10.5 2.5v11M2.5 5.5h11M2.5 10.5h11" stroke-dasharray="1.2 1.4"/>'),
 uiFont:svg('<path d="M3 13l4-10h2l4 10M5 9h6"/>')
});
export const MODES=Object.freeze(['nine','states','atlas','font']);
const FONT_EXT=/\.(ttf|otf|ttc|woff|woff2)$/i,L10N_EXT=/\.(po|pot|csv|tsv|strings|resx|tres|xliff|xlf|properties|txt)$/i,FNT_EXT=/\.fnt$/i,ATLAS_DATA=/\.(xml|json)$/i;
export const isFontFile=f=>FONT_EXT.test(f?.name||'')||/^font\//.test(f?.type||'');
export const isTranslationFile=f=>L10N_EXT.test(f?.name||'');
const MODE_KEY='nerulio.studio.ui.mode';
export default {
 id:'ui',title:'ws.ui',status:'ready',summary:'ws.uiSummary',
 /** Fonts, translation tables and .9.png files dropped on another workspace switch to this one. */
 claims:files=>[...files].some(f=>isFontFile(f)||/\.9\.png$/i.test(f.name||'')||/\.(po|pot|strings|resx|xliff|xlf|properties)$/i.test(f.name||'')),
 activate(ctx){
  const {t,view}=ctx;
  if(!document.getElementById(CSS_ID))document.head.append(h('link',{id:CSS_ID,rel:'stylesheet',href:new URL('./ui.css',import.meta.url).href}));
  // ---------------------------------------------------------------- shared services (W)
  let worker=null,seq=0;const waiting=new Map(),sent=new Set();
  const wk=()=>worker||=Object.assign(new Worker(new URL('./ui-worker.js',import.meta.url),{type:'module'}),{
   onmessage:({data})=>{const w=waiting.get(data.job);if(!w)return;if(data.progress){w.onProgress?.(data.progress);return;}waiting.delete(data.job);data.ok?w.resolve(data):w.reject(Error(data.error));},
   onerror:e=>{for(const w of waiting.values())w.reject(Error(e.message||'worker error'));waiting.clear();worker=null;sent.clear();}});
  function work(msg,{transfer=[],onProgress=null}={}){const job=++seq;return new Promise((resolve,reject)=>{waiting.set(job,{resolve,reject,onProgress});wk().postMessage({...msg,job},transfer);});}
  /** Sends a stored blob (image, font, translation file) to the worker once. */
  async function sendBlob(id){if(sent.has(id))return;const b=ctx.images.blob(id);if(!b)throw Error(t('ui.error.missingBlob'));const bytes=await b.arrayBuffer();if(sent.has(id))return;sent.add(id);wk().postMessage({op:'blob',id,bytes},[bytes]);}
  const pixelCache=new Map();
  /** Exact RGBA of a stored PNG (no colour management), cached. */
  function pixels(id){
   let p=pixelCache.get(id);if(p)return p;
   p=(async()=>{const b=ctx.images.blob(id);if(!b)throw Error(t('ui.error.missingBlob'));const d=await decodePNG(new Uint8Array(await b.arrayBuffer()),{maxPixels:67e6});return {width:d.width,height:d.height,data:new Uint8ClampedArray(d.data.buffer,d.data.byteOffset,d.data.byteLength)};})();
   pixelCache.set(id,p);p.catch(()=>pixelCache.delete(id));return p;
  }
  const S=()=>U.uiState(ctx.doc);
  const edit=(label,fn,opts)=>ctx.execute(ctx.edit(label,d=>U.withUi(d,fn),opts));
  const editDoc=(label,fn,opts)=>ctx.execute(ctx.edit(label,fn,opts));
  const assetBlob=assetId=>P.primaryBlob(P.assetById(ctx.doc,assetId));
  let mode=null;const sel={element:null,button:null,font:null};
  const W={ctx,t,view,S,edit,editDoc,work,sendBlob,pixels,assetBlob,sel,
   get mode(){return mode;},setMode,select,refresh:()=>renderMain(),
   /** Draws an asset's picture on the canvas (what the shell does when no workspace presents). */
   async showPicture(assetId,{restoreView=false}={}){const a=P.assetById(ctx.doc,assetId);if(!a){view.clearImage();return;}const bmp=await ctx.images.bitmap(P.primaryBlob(a));await view.setImage(bmp,a.width,a.height,{view:restoreView?{...view.view}:null});},
   element:()=>S().elements?.[sel.element]||null,button:()=>S().buttons?.[sel.button]||null,font:()=>S().fonts?.[sel.font]||null};
  // ---------------------------------------------------------------- modes
  const modes={nine:nineMode(W),states:statesMode(W),atlas:atlasMode(W),font:fontMode(W)};
  let modePanels=[];
  function setMode(next,{keepView=false}={}){
   if(!MODES.includes(next))next='nine';
   if(next===mode)return;
   modes[mode]?.leave?.();for(const id of modePanels)ctx.removePanel(id);modePanels=[];
   mode=next;try{localStorage.setItem(MODE_KEY,next);}catch{}
   for(const p of modes[mode].panels())modePanels.push(ctx.panel(p).id);
   modes[mode].enter?.({keepView});
   renderMain();root.dataset.uiMode=mode;
  }
  function select(kind,id,{reveal=true}={}){
   sel[kind]=id;
   if(kind==='element'){const e=W.element();if(e&&ctx.activeAsset?.id!==e.assetId)ctx.showAsset(e.assetId);else modes[mode].onSelect?.(kind,id,{reveal});}
   else modes[mode].onSelect?.(kind,id,{reveal});
   renderMain();
  }
  // ---------------------------------------------------------------- tool (the current mode decides)
  const tool={
   down:i=>modes[mode].tool?.down?.(i)??false,move:i=>modes[mode].tool?.move?.(i),up:i=>modes[mode].tool?.up?.(i),
   hover:i=>modes[mode].tool?.hover?.(i),leave:()=>modes[mode].tool?.leave?.(),cancel:i=>modes[mode].tool?.cancel?.(i),
   cursor:i=>modes[mode].tool?.cursor?.(i)||'default',get active(){return !!modes[mode].tool?.active;}};
  ctx.tool({id:'ui-edit',title:'ui.tool.edit',icon:'uiEdit',key:'V',order:10,hint:'ui.tool.editHint',impl:tool});
  const overlay={z:30,view:null,visible:true,hit:()=>null,draw(g){modes[mode]?.draw?.(g);}};
  ctx.layer(overlay);
  W.invalidate=()=>view.invalidate();
  // ---------------------------------------------------------------- main panel: mode switch + items
  const root=h('div.ui-main',{});
  ctx.panel({id:'ui-main',title:()=>t('ui.panel.main'),dock:'right',order:5,render(body){body.append(root);}});
  function renderMain(){
   const seg=h('div.ui-seg',{role:'tablist','aria-label':t('ui.modeLabel')},...MODES.map(m=>{
    const b=h('button.ui-seg-btn',{type:'button',role:'tab','aria-selected':String(m===mode),'data-ui-mode':m,title:t('ui.modeHint.'+m)},t('ui.mode.'+m));
    b.addEventListener('click',()=>setMode(m));return b;}));
   root.replaceChildren(seg,modes[mode]?.list?.()||'');
  }
  // ---------------------------------------------------------------- file intake
  async function importFiles(files,{from='picker'}={}){
   files=[...files];const done=[],errors=[];
   const fonts=files.filter(isFontFile),fnts=files.filter(f=>FNT_EXT.test(f.name||'')),nines=files.filter(f=>/\.9\.png$/i.test(f.name||''));
   const data=files.filter(f=>ATLAS_DATA.test(f.name||'')&&!isTranslationFile(f));
   const l10n=files.filter(f=>isTranslationFile(f)&&!fonts.includes(f));
   const imgs=files.filter(f=>isImportable(f)&&!nines.includes(f)&&!fonts.includes(f));
   const other=files.filter(f=>![...fonts,...fnts,...nines,...data,...l10n,...imgs].includes(f));
   if(other.length)errors.push(t('ui.error.unsupported',{names:other.map(f=>f.name).slice(0,3).join(', ')}));
   // images (and .9.png) become assets; a single-island image also becomes an element
   const added=[];
   for(const f of [...imgs,...nines]){
    try{
     let rec,source,nine=null;
     if(nines.includes(f)){
      const d=await decodePNG(new Uint8Array(await f.arrayBuffer()));const r=fromNinePatchPNG(new Uint8ClampedArray(d.data),d.width,d.height);
      const c=new OffscreenCanvas(r.width,r.height);c.getContext('2d').putImageData(new ImageData(r.image,r.width,r.height),0,0);
      const png=await c.convertToBlob({type:'image/png'});rec=await ctx.images.put(png,{width:r.width,height:r.height});nine=r.nine;
      source={name:f.name.replace(/\.9\.png$/i,'.png'),type:'image/png',size:png.size,lastModified:f.lastModified};
      if(r.runs.top>1||r.runs.left>1)errors.push(t('ui.error.multiRun',{name:f.name}));
     }else ({record:rec,source}=await ctx.images.importFile(f));
     added.push({asset:P.imageAsset({name:source.name,width:rec.width,height:rec.height,blob:rec.id,source}),nine,file:f});
    }catch(e){errors.push(String(e.message||e).startsWith('decode:')?t('error.decode',{name:f.name}):String(e.message||e));}
   }
   if(added.length){
    const assets=added.map(a=>a.asset);
    // one island (a panel, a button) is an element right away; a sheet waits for Detect in Atlas mode
    const els=[];let sheets=0;
    for(const a of added){
     const single=a.nine||await isSingle(a.asset);
     if(single){const st=U.putElements(S(),els);els.push(U.newElement(st,{assetId:a.asset.id,rect:{x:0,y:0,w:a.asset.width,h:a.asset.height},name:a.asset.name,nine:a.nine,origin:a.nine?'9png':'image'}));}
     else sheets++;
    }
    editDoc(t('ui.cmd.import',{n:assets.length}),d=>U.withUi(P.addAssets(d,assets),s=>U.putElements(s,els)));
    if(els.length){sel.element=els[0].id;}
    await ctx.showAsset(assets[0].id);
    if(sheets&&!els.length)setMode('atlas');else if(els.length&&mode!=='nine'&&mode!=='states')setMode('nine');
    modes[mode].onSelect?.('element',sel.element,{reveal:true});renderMain();
    done.push(...assets);
   }
   // atlas data next to a sheet (Starling XML / TexturePacker JSON) names its elements exactly
   for(const f of data){try{await modes.atlas.importData(f,added.map(a=>a.asset));}catch(e){errors.push(`${f.name}: ${e.message}`);}}
   for(const f of fonts){try{await modes.font.addFontFile(f);setMode('font');}catch(e){errors.push(`${f.name}: ${e.message}`);}}
   for(const f of fnts){try{await modes.font.importFnt(f,files);setMode('font');}catch(e){errors.push(`${f.name}: ${e.message}`);}}
   if(l10n.length){try{await modes.font.addTranslations(l10n);setMode('font');}catch(e){errors.push(String(e.message||e));}}
   if(errors.length)ctx.toast(errors.join(' · '),{error:true});
   else if(done.length)ctx.toast(t('toast.imported',{n:done.length}));
   return done;
  }
  async function isSingle(asset){
   // one element = one island, or islands that all sit inside the largest one (a button and its
   // label, a panel with inner details); a sheet has separate elements side by side
   try{await sendBlob(P.primaryBlob(asset));const {rects}=await work({op:'detect',blob:P.primaryBlob(asset),threshold:8,minArea:4,merge:0});
    if(rects.length<=1)return true;const big=rects.reduce((a,b)=>a.w*a.h>=b.w*b.h?a:b);
    return rects.every(r=>r.x>=big.x&&r.y>=big.y&&r.x+r.w<=big.x+big.w&&r.y+r.h<=big.y+big.h);}catch{return true;}
  }
  W.importFiles=importFiles;W.attachFile=async(file,owner='ui')=>{
   const blob=new Blob([await file.arrayBuffer()],{type:file.type&&!file.type.startsWith('image/')?file.type:'application/octet-stream'});
   const id=await sha256Hex(blob);await ctx.images.put(blob,{id,file:true});
   return {id,meta:{name:file.name,type:blob.type,size:blob.size,owner}};
  };
  W.sniff=async f=>sniffFont(new Uint8Array(await f.slice(0,64).arrayBuffer()));
  // ---------------------------------------------------------------- commands + menu
  for(const m of MODES)ctx.command({id:'ui.mode.'+m,group:'ui',radio:true,label:()=>t('ui.mode.'+m),checked:()=>mode===m,run:()=>setMode(m)});
  ctx.command({id:'ui.export',group:'ui',keys:['Mod+E'],label:()=>t('ui.cmd.export'),enabled:()=>!!modes[mode].canExport?.(),run:()=>modes[mode].exportNow?.()});
  ctx.command({id:'ui.suggest',group:'ui',label:()=>t('ui.cmd.suggest'),enabled:()=>!!modes[mode].suggest,run:()=>modes[mode].suggest?.()});
  ctx.command({id:'ui.addFont',group:'ui',label:()=>t('ui.cmd.addFont'),run:()=>modes.font.pickFontFile()});
  ctx.menu({id:'ui',title:'ui.menu',items:()=>[...MODES.map(m=>'ui.mode.'+m),'-','ui.suggest','ui.addFont','-','ui.export']});
  // ---------------------------------------------------------------- document events
  ctx.on('doc',(doc,prev,ev)=>{
   // elements of an image that was removed stay in settings.ui (undoing the removal brings them
   // back); lists and exports skip them (U.pruneForAssets)
   const s=U.uiState(doc);
   if(sel.element&&!s.elements?.[sel.element])sel.element=null;if(sel.button&&!s.buttons?.[sel.button])sel.button=null;if(sel.font&&!s.fonts?.[sel.font])sel.font=null;
   for(const m of Object.values(modes))m.onDoc?.(doc,prev,ev);
   renderMain();
  });
  ctx.on('asset',id=>{modes[mode]?.onAsset?.(id);renderMain();});
  ctx.on('locale',()=>{renderMain();modes[mode]?.onLocale?.();});
  let saved=null;try{saved=localStorage.getItem(MODE_KEY);}catch{}
  const first=U.elementsOf(S())[0];if(first)sel.element=first.id;
  sel.font=Object.keys(S().fonts||{})[0]||null;sel.button=Object.keys(S().buttons||{})[0]||null;
  setMode(new URLSearchParams(location.search).get('uimode')||saved||'nine');
  return {
   importFiles,
   present:opts=>modes[mode].present?modes[mode].present(opts):W.showPicture(ctx.activeAsset?.id,opts),
   onAsset:id=>modes[mode]?.onAsset?.(id),
   selectAll:()=>modes[mode].selectAll?.(),deselect:()=>modes[mode].deselect?.(),
   hasSelection:()=>!!modes[mode].hasSelection?.(),deleteSelection:()=>modes[mode].deleteSelection?.(),
   nudge:(dx,dy)=>modes[mode].nudge?.(dx,dy),
   deactivate(){modes[mode]?.leave?.();worker?.terminate();worker=null;for(const b of Object.values(modes))b.dispose?.();
    const a=ctx.activeAsset;setTimeout(()=>{if(a)ctx.showAsset(a.id,{restoreView:true});else view.clearImage();},0);}
  };
 }
};
