/** ATLAS mode: a UI sheet split into elements — detected from alpha islands (a suggestion with a
 * count, added only on request), read exactly from atlas data shipped with the sheet (Starling /
 * Sparrow XML, TexturePacker JSON), or drawn by hand; then moved, resized, renamed, and given
 * 9-slice borders in one batch. */
import {h} from '../../ui/dom.js';
import {ShapeLayer} from '../../canvas/canvas-view.js';
import {rectEditor} from '../../canvas/rect-editor.js';
import * as U from './state.js';
import * as N from '../../../game/ui/nine-patch.js';
import {kitPanel} from './kit-export.js';
const DETECT_KEY='nerulio.studio.ui.detect';
export function parseAtlasData(name,text){
 const out=[];
 if(/^\s*</.test(text)){
  const image=/imagePath\s*=\s*"([^"]*)"/.exec(text)?.[1]||'';
  for(const m of text.matchAll(/<SubTexture\b([^>]*)\/?>/g)){
   const a=Object.fromEntries([...m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map(x=>[x[1],x[2]]));
   if(a.rotated==='true')throw Error('Rotated atlas regions are not supported here');
   out.push({name:a.name,x:+a.x,y:+a.y,w:+a.width,h:+a.height});
  }
  return {image,rects:out};
 }
 const j=JSON.parse(text),frames=Array.isArray(j.frames)?j.frames.map(f=>[f.filename,f]):Object.entries(j.frames||{});
 for(const [n,f] of frames){if(f.rotated)throw Error('Rotated atlas regions are not supported here');out.push({name:n,x:f.frame.x,y:f.frame.y,w:f.frame.w,h:f.frame.h,borders:f.scale9Borders||null});}
 return {image:j.meta?.image||'',rects:out};
}
export default function atlasMode(W){
 const {ctx,t,view}=W;
 const layer=new ShapeLayer({id:'ui-elements',z:25,color:'#4cc2ff',selectedColor:'#ffc83d',hoverColor:'#ffffff',labels:true,handles:true,editable:true});
 const ghost=new ShapeLayer({id:'ui-detected',z:24,color:'rgba(180,140,255,.9)',labels:false,handles:false,editable:false});
 let attached=false,selection=[],detected=null,drawing=false,busy=false;
 let opts={threshold:8,merge:2,minArea:16};try{opts={...opts,...JSON.parse(localStorage.getItem(DETECT_KEY)||'{}')};}catch{}
 const asset=()=>ctx.activeAsset;
 const els=()=>{const a=asset();return a?U.elementsForAsset(W.S(),a.id):[];};
 function sync(){
  layer.setItems(els().map(e=>({id:e.id,x:e.rect.x,y:e.rect.y,w:e.rect.w,h:e.rect.h,label:e.name+(e.nine?' ⁹':'')})));
  layer.setSelected(selection);ghost.setItems((detected||[]).map((r,i)=>({id:'d'+i,...r})));
 }
 const editor=rectEditor({layer,bounds:()=>({x:0,y:0,w:asset()?.width||1,h:asset()?.height||1}),selection:()=>selection,
  onSelect:ids=>{selection=ids;layer.setSelected(ids);if(ids.length===1)W.sel.element=ids[0];renderPanel();W.refresh();},
  onChange:(map,{phase,key})=>{
   if(phase==='end'){ctx.history.close(key);return;}
   if(phase==='cancel'){ctx.history.abort(key);return;}
   W.edit(t('ui.cmd.moveElement'),s=>{let st=s;for(const [id,r] of map)st=U.updateElement(st,id,e=>({...e,rect:{...r},nine:e.nine?N.normalizeNine(e.nine,r.w,r.h):null}));return st;},{mergeKey:key,open:true});
  },
  onCreate:r=>{const a=asset();if(!a)return;const e=U.newElement(W.S(),{assetId:a.id,rect:r,name:`${a.name}_${els().length+1}`,origin:'drawn'});W.edit(t('ui.cmd.addElement'),s=>U.putElements(s,[e]));selection=[e.id];W.sel.element=e.id;},
  create:()=>drawing});
 // ---------------------------------------------------------------- detection
 async function detect(){
  const a=asset();if(!a||busy)return;busy=true;renderPanel();
  try{const blob=W.assetBlob(a.id);await W.sendBlob(blob);const r=await W.work({op:'detect',blob,threshold:opts.threshold,minArea:opts.minArea,merge:opts.merge});
   detected=r.rects;ctx.toast(t('ui.atlas.found',{n:r.rects.length,islands:r.islands}));}
  catch(e){ctx.toast(String(e.message||e),{error:true});}
  finally{busy=false;sync();renderPanel();W.invalidate();}
 }
 function addDetected(replace){
  const a=asset();if(!a||!detected)return;
  const keep=replace?[]:els(),overlaps=r=>keep.some(e=>r.x<e.rect.x+e.rect.w&&e.rect.x<r.x+r.w&&r.y<e.rect.y+e.rect.h&&e.rect.y<r.y+r.h);
  const fresh=[];let st=W.S();if(replace)st=U.removeElements(st,els().map(e=>e.id));
  for(const r of detected.filter(r=>!overlaps(r))){const e=U.newElement(U.putElements(st,fresh),{assetId:a.id,rect:r,name:`${a.name}_${fresh.length+1}`,origin:'detected'});fresh.push(e);}
  W.edit(t('ui.cmd.detected',{n:fresh.length}),s=>{let x=replace?U.removeElements(s,els().map(e=>e.id)):s;return U.putElements(x,fresh);});
  detected=null;sync();renderPanel();
 }
 /** Batch: suggested borders for every selected (or every) element whose suggestion is confident. */
 async function suggestAll(){
  const a=asset();if(!a)return;const img=await W.pixels(W.assetBlob(a.id)),list=(selection.length?els().filter(e=>selection.includes(e.id)):els());
  const updates=[];for(const e of list){const s=N.suggestNine(N.crop(img.data,img.width,img.height,e.rect),e.rect.w,e.rect.h);if(s.confidence==='high'||s.confidence==='medium')updates.push([e.id,{border:s.border,stretch:s.stretch}]);}
  if(!updates.length){ctx.toast(t('ui.atlas.noneConfident'));return;}
  W.edit(t('ui.cmd.suggestAll',{n:updates.length}),s=>{let st=s;for(const [id,n] of updates)st=U.setNine(st,id,{...(st.elements[id].nine||{}),...n});return st;});
  ctx.toast(t('ui.atlas.suggested',{n:updates.length,of:list.length}));
 }
 async function importData(file,freshAssets=[]){
  const text=await file.text(),{image,rects}=parseAtlasData(file.name,text);
  if(!rects.length)throw Error(t('ui.atlas.noRegions'));
  const stem=s=>String(s||'').replace(/\.[^.]+$/,'').toLowerCase();
  const cand=[...freshAssets,...ctx.doc.assets];
  const a=cand.find(x=>stem(x.name)===stem(image))||cand.find(x=>stem(x.name)===stem(file.name))||cand.find(x=>rects.every(r=>r.x+r.w<=x.width&&r.y+r.h<=x.height));
  if(!a)throw Error(t('ui.atlas.noSheet'));
  const list=[];let st=W.S();
  for(const r of rects){if(r.x+r.w>a.width||r.y+r.h>a.height)continue;
   const b=r.borders?{left:r.borders.x,top:r.borders.y,right:r.w-r.borders.x-r.borders.w,bottom:r.h-r.borders.y-r.borders.h}:null;
   list.push(U.newElement(U.putElements(st,list),{assetId:a.id,rect:r,name:r.name,nine:b?{border:b}:null,origin:'detected'}));}
  W.edit(t('ui.cmd.importAtlas',{n:list.length,name:file.name}),s=>U.putElements(s,list));
  if(ctx.activeAsset?.id!==a.id)await ctx.showAsset(a.id);
  W.setMode('atlas');ctx.toast(t('ui.atlas.imported',{n:list.length,name:file.name}));
 }
 // ---------------------------------------------------------------- panel
 const box=h('div.ui-atlas',{});
 function renderPanel(){
  const a=asset();if(!a){box.replaceChildren(h('p.st-muted.st-pad',{},t('ui.atlas.noImage')));return;}
  const num=(k,min,max,label)=>{const i=h('input.st-input.st-num',{type:'number',min:String(min),max:String(max),value:String(opts[k]),'data-detect':k,'aria-label':label});
   i.addEventListener('change',()=>{opts[k]=Math.max(min,Math.min(max,Math.round(+i.value||0)));try{localStorage.setItem(DETECT_KEY,JSON.stringify(opts));}catch{}});return h('label.st-field',{},h('span',{},label),i);};
  const go=h('button.st-btn'+(els().length?'':'.primary'),{type:'button','data-action':'detect',disabled:busy},busy?t('ui.atlas.detecting'):t('ui.atlas.detect'));go.addEventListener('click',detect);
  const parts=[h('p.ui-note',{},t('ui.atlas.lead')),h('div.ui-grid3',{},num('threshold',0,254,t('ui.atlas.threshold')),num('merge',0,64,t('ui.atlas.merge')),num('minArea',1,4096,t('ui.atlas.minArea'))),go];
  if(detected){const add=h('button.st-btn.primary',{type:'button','data-action':'add-detected'},t('ui.atlas.addNew',{n:detected.length}));add.addEventListener('click',()=>addDetected(false));
   const rep=h('button.st-btn',{type:'button','data-action':'replace-detected'},t('ui.atlas.replace'));rep.addEventListener('click',()=>addDetected(true));
   const no=h('button.st-link',{type:'button'},t('ui.atlas.discard'));no.addEventListener('click',()=>{detected=null;sync();renderPanel();});
   parts.push(h('div.ui-suggest',{'data-atlas':'detected'},h('b',{},t('ui.atlas.preview',{n:detected.length})),h('small.st-muted',{},t('ui.atlas.previewHint')),h('div.ui-actions',{},add,rep,no)));}
  const draw=h('button.ui-toggle',{type:'button','aria-pressed':String(drawing),'data-action':'draw'},t('ui.atlas.draw'));draw.addEventListener('click',()=>{drawing=!drawing;renderPanel();view.updateCursor?.();});
  const sug=h('button.st-btn',{type:'button','data-action':'suggest-all',disabled:!els().length},selection.length>1?t('ui.atlas.suggestSel',{n:selection.length}):t('ui.atlas.suggestAll'));sug.addEventListener('click',suggestAll);
  const toNine=h('button.st-btn',{type:'button',disabled:selection.length!==1},t('ui.atlas.editNine'));toNine.addEventListener('click',()=>{W.sel.element=selection[0];W.setMode('nine');});
  const del=h('button.st-btn',{type:'button',disabled:!selection.length,'data-action':'delete'},t('ui.atlas.delete',{n:selection.length}));del.addEventListener('click',()=>deleteSelection());
  parts.push(h('div.ui-actions',{},draw,sug,toNine,del),h('small.st-muted',{},t('ui.atlas.count',{n:els().length,nine:els().filter(e=>e.nine).length})));
  box.replaceChildren(...parts);
 }
 function deleteSelection(){if(!selection.length)return;const ids=[...selection];W.edit(t('ui.cmd.removeElements',{n:ids.length}),s=>U.removeElements(s,ids));selection=[];sync();renderPanel();}
 const kit=kitPanel(W);
 return {
  panels:()=>[{id:'ui-atlas',title:()=>t('ui.panel.atlas'),dock:'right',order:15,render(body){body.append(box);}},kit.panel],
  enter(){if(!attached){ctx.layer(ghost);ctx.layer(layer);attached=true;}ghost.visible=layer.visible=true;selection=W.sel.element?[W.sel.element]:[];sync();renderPanel();kit.render();W.showPicture(ctx.activeAsset?.id,{restoreView:true});},
  leave(){editor.cancel?.({view});ghost.visible=layer.visible=false;layer.setItems([]);ghost.setItems([]);drawing=false;},
  list(){return h('div',{},h('small.st-muted.st-pad',{},t('ui.atlas.listHint')))},
  tool:editor,importData,
  onSelect(kind,id){if(kind==='element'){selection=id?[id]:[];sync();}},
  onAsset(){detected=null;selection=[];if(W.mode==='atlas'){sync();renderPanel();}},
  onDoc(){if(W.mode!=='atlas')return;selection=selection.filter(id=>W.S().elements?.[id]);sync();renderPanel();kit.render();},
  onLocale(){renderPanel();kit.render();},
  selectAll(){selection=els().map(e=>e.id);sync();renderPanel();},deselect(){selection=[];sync();renderPanel();},
  hasSelection:()=>selection.length>0,deleteSelection,
  nudge(dx,dy){const ids=selection;if(!ids.length)return;W.edit(t('ui.cmd.moveElement'),s=>{let st=s;const a=asset();for(const id of ids)st=U.updateElement(st,id,e=>{const x=Math.max(0,Math.min(a.width-e.rect.w,e.rect.x+dx)),y=Math.max(0,Math.min(a.height-e.rect.h,e.rect.y+dy));return {...e,rect:{...e.rect,x,y}};});return st;},{mergeKey:'atlas-nudge'});},
  suggest:suggestAll,canExport:()=>kit.canExport(),exportNow:()=>kit.exportNow(),
  dispose(){}
 };
}
