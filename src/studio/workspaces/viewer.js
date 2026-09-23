/** Viewer / Import workspace — the smallest real workspace, proving the stack end to end:
 * import → assets → canvas → grid suggestion (with confidence, explicit Apply) → frames as
 * overlay rects that can be selected, moved, resized, added and deleted with undo → autosave.
 * It uses only the public workspace context (docs/STUDIO.md), like every later workspace will. */
import {ShapeLayer} from '../canvas/canvas-view.js';
import {rectEditor} from '../canvas/rect-editor.js';
import {normalizeGrid,gridCellsIn} from '../canvas/view-math.js';
import {bounds as boundsOf} from '../canvas/overlay-math.js';
import * as P from '../core/project.js';
import {frame as makeFrame} from '../../game/model.js';
import {h} from '../ui/dom.js';
let worker=null,seq=0;const waiting=new Map();
function work(msg){
 worker||=Object.assign(new Worker(new URL('../grid-worker.js',import.meta.url),{type:'module'}),{onmessage:({data})=>{const w=waiting.get(data.id);if(!w)return;waiting.delete(data.id);data.ok?w.resolve(data.result):w.reject(Error(data.error));}});
 const id=++seq;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});worker.postMessage({...msg,id});});
}
const specOf=s=>({w:s.cellWidth,h:s.cellHeight,ox:s.marginX,oy:s.marginY,sx:s.spacingX,sy:s.spacingY});
const sameGrid=(a,b)=>a&&b&&['w','h','ox','oy','sx','sy'].every(k=>a[k]===b[k]);
export default {
 id:'viewer',title:'ws.viewer',status:'ready',summary:'ws.viewerSummary',
 activate(ctx){
  const {t,view}=ctx;
  let assetId=null,selection=[],detect=new Map(),drafts=new Map(),skipEmpty=true,cellInfo=null,cellToken=0;
  const asset=()=>P.assetById(ctx.doc,assetId);
  const layer=ctx.layer(new ShapeLayer({id:'frames',z:10}));
  // ------------------------------------------------------------ selection
  function select(ids){
   const a=asset(),known=new Set(a?.frames.map(f=>f.id)||[]);
   selection=[...new Set(ids)].filter(id=>known.has(id));layer.setSelected(selection);
   const sel=a?.frames.filter(f=>selection.includes(f.id))||[];
   const b=boundsOf(sel.map(f=>f.sourceRect));
   ctx.status('selection',!sel.length?'':sel.length===1?t('status.frameSel',{name:sel[0].name,w:b.w,h:b.h}):t('status.framesSel',{n:sel.length,w:b.w,h:b.h}));
   renderInspector();markStrip();
  }
  // ------------------------------------------------------------ overlay ← document
  function syncLayer(){
   const a=asset();
   layer.setItems(a?a.frames.map((f,i)=>({id:f.id,x:f.sourceRect.x,y:f.sourceRect.y,w:f.sourceRect.w,h:f.sourceRect.h,label:i})):[]);
   select(selection);
  }
  const bounds=()=>{const a=asset();return a?{x:0,y:0,w:a.width,h:a.height}:{x:0,y:0,w:0,h:0};};
  // ------------------------------------------------------------ direct manipulation → commands
  const common={layer,bounds,selection:()=>selection,onSelect:select,
   onChange(map,{phase,key}){
    const id=assetId;if(!id)return;
    if(phase==='end'){ctx.history.close(key);return;}
    if(phase==='cancel'&&ctx.history.abort(key))return;
    const n=map.size,label=phase==='cancel'?t('cmd.frames.move'):n===1&&[...map.values()][0]&&asset().frames.find(f=>f.id===[...map.keys()][0])?.sourceRect.w!==[...map.values()][0].w?t('cmd.frames.resize'):t('cmd.frames.move');
    ctx.execute(ctx.edit(label,d=>P.setFrameRects(d,id,map),{mergeKey:key,open:phase==='drag'}));
    if(phase==='cancel')ctx.history.close(key);
   },
   onCreate(rect){
    const id=assetId;if(!id)return;const before=new Set(asset().frames.map(f=>f.id));
    ctx.execute(ctx.edit(t('cmd.frames.add'),d=>P.addFrames(d,id,[rect])));
    const added=asset().frames.filter(f=>!before.has(f.id)).map(f=>f.id);select(added);
   }};
  const selectTool=rectEditor({...common,create:()=>false});
  const frameTool=rectEditor({...common,create:()=>true});
  ctx.tool({id:'select',title:'tool.select',icon:'move',key:'V',order:10,hint:'tool.selectHint',impl:selectTool});
  ctx.tool({id:'frame',title:'tool.frame',icon:'marquee',key:'M',order:20,hint:'tool.frameHint',impl:frameTool});
  // ------------------------------------------------------------ grid panel
  const gridBox=h('div.st-grid-panel',{});
  const fields={};
  ctx.panel({id:'grid',title:()=>t('panel.grid'),dock:'right',order:20,render(body){body.append(gridBox);}});
  function draft(){const a=asset();if(!a)return null;return drafts.get(a.id)||a.grid||null;}
  function setDraft(spec,{preview=true}={}){
   const a=asset();if(!a)return;const g=spec?normalizeGrid(spec):null;drafts.set(a.id,g);
   view.set({grid:g,gridVisible:!!g&&preview});cellInfo=null;renderGrid();countCells();
  }
  async function runDetect(force=false){
   const a=asset();if(!a)return;const blob=P.primaryBlob(a),key=a.id+':'+blob;
   const cur=detect.get(a.id);if(cur&&!force&&cur.key===key)return;
   detect.set(a.id,{key,status:'running'});renderGrid();
   try{
    const rec=ctx.images.get(blob),result=await work({op:'detect',key:blob,blob:rec.blob});
    detect.set(a.id,{key,status:'done',...result});
    // The best suggestion is loaded as a PREVIEW (dashed grid, "not applied") — never applied.
    if(a.id===assetId&&!a.frames.length&&!drafts.get(a.id)&&!a.grid&&result.suggestions[0])setDraft(specOf(result.suggestions[0]));
   }catch(e){detect.set(a.id,{key,status:'error',error:String(e.message||e)});}
   if(a.id===assetId)renderGrid();
  }
  async function countCells(){
   const a=asset(),g=draft();if(!a||!g)return;
   const {cols,rows,count}=gridCellsIn(g,a.width,a.height);if(!count){cellInfo={cells:[],count:0};renderGridCount();return;}
   if(count>20000){cellInfo={cells:null,count,tooMany:true};renderGridCount();return;}
   const token=++cellToken;
   try{const r=await work({op:'cells',key:P.primaryBlob(a),blob:ctx.images.get(P.primaryBlob(a)).blob,spec:{...g,cols,rows}});if(token!==cellToken)return;cellInfo={cells:r.cells,count};}catch{cellInfo=null;}
   renderGridCount();
  }
  function reasonList(s){
   const e=s.evidence,pct=v=>Math.round((v||0)*100)+'%',out=[];
   const sepLines=(e.separatorLinesX||0)+(e.separatorLinesY||0);
   out.push(sepLines?t('grid.reason.separator',{n:sepLines,pct:pct(Math.min(e.separatorRatioX??1,e.separatorRatioY??1))}):t('grid.reason.noSeparator'));
   out.push(t('grid.reason.period',{px:s.cellWidth+s.spacingX,py:s.cellHeight+s.spacingY,ax:(e.periodicityX||0).toFixed(2),ay:(e.periodicityY||0).toFixed(2)}));
   out.push(t('grid.reason.bounds',{pct:pct(e.boundsConsistency)}));
   out.push((e.crossingsX+e.crossingsY)?t('grid.reason.cross',{n:e.crossingsX+e.crossingsY}):t('grid.reason.noCross'));
   if(e.splitColumns+e.splitRows)out.push(t('grid.reason.split'));
   if(!e.commonSize)out.push(t('grid.reason.uncommon'));
   if(e.outsidePixels)out.push(t('grid.reason.outside',{n:e.outsidePixels}));
   out.push(t('grid.reason.filled',{filled:e.filledCells,cells:s.cells}));
   return out;
  }
  function renderGrid(){
   const a=asset();
   if(!a){gridBox.replaceChildren(h('p.st-muted.st-pad',{},t('grid.noImage')));return;}
   const d=detect.get(a.id),g=draft(),applied=a.grid&&g&&sameGrid(a.grid,g)&&a.frames.length>0;
   const sug=h('div.st-sugs',{});
   if(!d||d.status==='running')sug.append(h('p.st-muted',{},t('grid.detecting')));
   else if(d.status==='error')sug.append(h('p.st-error',{},t('grid.detectFailed',{reason:d.error})));
   else if(!d.suggestions.length)sug.append(h('p.st-muted',{},d.opaque?t('grid.noSuggestion'):t('grid.transparent')));
   else d.suggestions.forEach((s,i)=>{
    const spec=specOf(s),on=g&&sameGrid(spec,g);
    const use=h('button.st-sug',{type:'button','aria-pressed':String(!!on),'data-sug':String(i)},
     h('b',{},`${s.cellWidth}×${s.cellHeight}`),h('span.st-sug-meta',{},[t('grid.cells',{c:s.columns,r:s.rows}),
      s.marginX||s.marginY?t('grid.margin',{v:s.marginX===s.marginY?s.marginX:`${s.marginX},${s.marginY}`}):'',
      s.spacingX||s.spacingY?t('grid.gap',{v:s.spacingX===s.spacingY?s.spacingX:`${s.spacingX},${s.spacingY}`}):''].filter(Boolean).join(' · ')),
     // Only the best candidate carries a confidence level; the rest are alternatives, so a runner-up
     // can never look as sure as (or surer than) the suggestion the preview shows.
     i===0?h('span.st-conf.is-'+s.confidence,{},t('grid.conf.'+s.confidence),' ',Math.round(s.score*100)+'%')
      :h('span.st-conf.is-alt',{},t('grid.alt'),' ',Math.round(s.score*100)+'%'));
    use.addEventListener('click',()=>setDraft(spec));
    const why=h('details.st-why',{},h('summary',{},t('grid.why')),h('ul',{},reasonList(s).map(r=>h('li',{},r))));
    sug.append(h('div.st-sug-row',{},use,why));
   });
   if(d?.status==='done'&&d.suggestions.length>1&&d.suggestions[0].score-d.suggestions[1].score<.1){
    const [a0,a1]=d.suggestions;
    sug.append(h('p.st-close',{'data-close':'1'},t('grid.close',{a:`${a0.cellWidth}×${a0.cellHeight}`,b:`${a1.cellWidth}×${a1.cellHeight}`})));
   }
   const num=(k,label,min)=>{const i=h('input.st-input.st-num',{type:'number',min:String(min),step:'1',value:g?String(g[k]):'',inputmode:'numeric','data-grid':k,'aria-label':t(label)});
    i.addEventListener('change',()=>{const cur=draft()||{w:16,h:16,ox:0,oy:0,sx:0,sy:0};setDraft({...cur,[k]:Number(i.value)});});fields[k]=i;return h('label.st-field.st-field-inline',{},h('span',{},t(label)),i);};
   const show=h('input',{type:'checkbox',checked:!!view.options.gridVisible&&!!g,'data-grid':'show'});show.addEventListener('change',()=>view.set({gridVisible:show.checked}));
   const skip=h('input',{type:'checkbox',checked:skipEmpty,'data-grid':'skip'});skip.addEventListener('change',()=>{skipEmpty=skip.checked;renderGridCount();});
   const apply=h('button.st-btn.primary',{type:'button','data-action':'grid-apply',disabled:!g},t(a.frames.length?'grid.replace':'grid.apply'));apply.addEventListener('click',()=>ctx.runCommand('frames.apply'));
   const redetect=h('button.st-btn',{type:'button','data-action':'grid-detect'},t('grid.detect'));redetect.addEventListener('click',()=>runDetect(true));
   const state=h('p.st-grid-state'+(applied?'.is-applied':g?'.is-preview':''),{'data-state':applied?'applied':g?'preview':'none'},applied?t('grid.stateApplied',{n:a.frames.length}):g?t('grid.statePreview'):t('grid.stateNone'));
   gridBox.replaceChildren(
    h('div.st-sec',{},h('div.st-sec-head',{},h('span',{},t('grid.suggested')),redetect),sug),
    h('div.st-sec',{},h('div.st-sec-head',{},h('span',{},t('grid.cellTitle'))),
     h('div.st-grid-fields',{},num('w','grid.w',1),num('h','grid.h',1),num('ox','grid.ox',0),num('oy','grid.oy',0),num('sx','grid.sx',0),num('sy','grid.sy',0)),
     h('label.st-check',{},show,' ',t('grid.show')),h('label.st-check',{},skip,' ',t('grid.skipEmpty')),
     h('p.st-grid-count.st-muted',{},''),state,h('div.st-row',{},apply)));
   renderGridCount();
  }
  function renderGridCount(){
   const el=gridBox.querySelector('.st-grid-count');if(!el)return;const a=asset(),g=draft();
   if(!a||!g){el.textContent='';return;}
   const {cols,rows,count}=gridCellsIn(g,a.width,a.height);
   if(!cellInfo){el.textContent=t('grid.countPending',{c:cols,r:rows,n:count});return;}
   if(cellInfo.tooMany){el.textContent=t('grid.tooMany',{n:count});return;}
   const filled=cellInfo.cells.filter(c=>!c.empty).length;
   el.textContent=t('grid.count',{c:cols,r:rows,n:count,filled});
  }
  async function applyGrid(){
   const a=asset(),g=draft();if(!a||!g)return;
   if(!cellInfo||cellInfo.tooMany)await countCells();
   if(!cellInfo?.cells){ctx.toast(t('grid.tooMany',{n:cellInfo?.count||0}),{error:true});return;}
   const cells=cellInfo.cells.filter(c=>!skipEmpty||!c.empty).map(({x,y,w,h})=>({x,y,w,h}));
   if(!cells.length){ctx.toast(t('grid.noCells'),{error:true});return;}
   const id=a.id,replaced=a.frames.length;
   ctx.execute(ctx.edit(t('cmd.frames.applyGrid',{w:g.w,h:g.h,n:cells.length}),d=>{const cur=P.assetById(d,id);return P.setGrid(P.setFrames(d,id,P.framesFromCells(cur,cells)),id,g);}));
   drafts.delete(id);select([]);renderGrid();view.fit();
   ctx.toast(replaced?t('toast.gridReplaced',{n:cells.length,old:replaced,undo:ctx.shortcutOf('edit.undo')}):t('toast.gridApplied',{n:cells.length}));
  }
  // ------------------------------------------------------------ frame inspector
  const insp=h('div.st-inspector',{});
  ctx.panel({id:'frame',title:()=>t('panel.frame'),dock:'right',order:30,render(body){body.append(insp);}});
  function renderInspector(){
   const a=asset();
   if(!a){insp.replaceChildren(h('p.st-muted.st-pad',{},t('frame.noImage')));return;}
   const sel=a.frames.filter(f=>selection.includes(f.id));
   if(!sel.length){insp.replaceChildren(h('p.st-muted.st-pad',{},a.frames.length?t('frame.hint',{v:'V',m:'M'}):t('frame.none',{m:'M'})));return;}
   if(sel.length>1){const b=boundsOf(sel.map(f=>f.sourceRect));const del=h('button.st-btn',{type:'button'},t('frame.deleteN',{n:sel.length}));del.addEventListener('click',()=>ctx.runCommand('edit.delete'));
    insp.replaceChildren(h('p.st-pad',{},t('frame.multi',{n:sel.length,x:b.x,y:b.y,w:b.w,h:b.h})),h('div.st-row.st-pad',{},del));return;}
   const f=sel[0],r=f.sourceRect,id=a.id;
   const name=h('input.st-input',{type:'text',value:f.name,'aria-label':t('frame.name'),'data-frame':'name'});
   name.addEventListener('change',()=>ctx.execute(ctx.edit(t('cmd.frames.rename'),d=>P.updateFrame(d,id,f.id,{name:name.value.trim()||f.name}))));
   const num=(k,label)=>{const i=h('input.st-input.st-num',{type:'number',step:'1',min:k==='w'||k==='h'?'1':'0',value:String(r[k]),'aria-label':t(label),'data-frame':k});
    i.addEventListener('change',()=>{const cur=P.assetById(ctx.doc,id)?.frames.find(x=>x.id===f.id);if(!cur)return;const next={...cur.sourceRect,[k]:Math.round(Number(i.value))};ctx.execute(ctx.edit(t('cmd.frames.edit'),d=>P.setFrameRects(d,id,{[f.id]:next}),{mergeKey:'field-'+f.id+k}));});
    return h('label.st-field.st-field-inline',{},h('span',{},t(label)),i);};
   const idx=a.frames.indexOf(f);
   insp.replaceChildren(h('div.st-pad',{},h('label.st-field',{},h('span',{},t('frame.name')),name),
    h('div.st-grid-fields',{},num('x','frame.x'),num('y','frame.y'),num('w','frame.w'),num('h','frame.h')),
    h('p.st-muted',{},t('frame.index',{i:idx,n:a.frames.length}))));
  }
  // ------------------------------------------------------------ frames strip (bottom dock)
  const strip=h('div.st-strip',{role:'listbox','aria-multiselectable':'true','aria-orientation':'horizontal'});
  ctx.panel({id:'frames',title:()=>t('panel.frames'),dock:'bottom',order:10,badge:()=>{const a=asset();return a?.frames.length?String(a.frames.length):'';},render(body){body.append(strip);}});
  const STRIP_MAX=600;let stripToken=0;
  async function renderStrip(){
   const a=asset(),token=++stripToken;strip.setAttribute('aria-label',t('panel.frames'));ctx.badge('frames');
   if(!a||!a.frames.length){strip.replaceChildren(h('p.st-muted.st-pad',{},a?t('strip.empty'):t('frame.noImage')));return;}
   const shown=a.frames.slice(0,STRIP_MAX);let bmp=null;try{bmp=await ctx.images.bitmap(P.primaryBlob(a));}catch{}
   if(token!==stripToken)return;
   const items=shown.map((f,i)=>{
    const c=h('canvas',{width:48,height:48,'aria-hidden':'true'});
    const el=h('div.st-chip',{role:'option','aria-selected':String(selection.includes(f.id)),'data-frame':f.id,tabindex:'-1',title:`${f.name} · ${f.sourceRect.w}×${f.sourceRect.h}`},c,h('span',{},String(i)));
    el.addEventListener('click',e=>{if(e.shiftKey||e.ctrlKey||e.metaKey)select(selection.includes(f.id)?selection.filter(x=>x!==f.id):[...selection,f.id]);else select([f.id]);});
    el.addEventListener('dblclick',()=>{view.reveal(f.sourceRect);});
    return {el,c,f};
   });
   strip.replaceChildren(...items.map(i=>i.el),a.frames.length>STRIP_MAX?h('span.st-muted.st-pad',{},t('strip.more',{n:a.frames.length-STRIP_MAX})):'');
   if(bmp){let k=0;const draw=()=>{if(token!==stripToken)return;const end=Math.min(items.length,k+80);for(;k<end;k++){const {c,f}=items[k],r=f.sourceRect,s=Math.min(48/r.w,48/r.h),z=s>=1?Math.floor(s):s,x=c.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,48,48);const w=r.w*z,hh=r.h*z;x.drawImage(bmp,r.x,r.y,r.w,r.h,Math.round((48-w)/2),Math.round((48-hh)/2),w,hh);}if(k<items.length)requestAnimationFrame(draw);};draw();}
   markStrip();
  }
  function markStrip(){for(const el of strip.querySelectorAll('.st-chip')){const on=selection.includes(el.dataset.frame);el.setAttribute('aria-selected',String(on));}const first=strip.querySelector('.st-chip[aria-selected="true"]');first?.scrollIntoView?.({block:'nearest',inline:'nearest'});}
  strip.addEventListener('keydown',e=>{
   const a=asset();if(!a?.frames.length)return;
   if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();step(e.key==='ArrowRight'?1:-1);strip.querySelector('.st-chip[aria-selected="true"]')?.focus();}
  });
  strip.tabIndex=0;
  // ------------------------------------------------------------ commands + menu
  ctx.command({id:'frames.detect',group:'frames',enabled:()=>!!asset(),run:()=>{ctx.showPanel('grid');runDetect(true);}});
  ctx.command({id:'frames.apply',group:'frames',enabled:()=>!!asset()&&!!draft(),run:()=>applyGrid()});
  ctx.command({id:'frames.clear',group:'frames',enabled:()=>!!asset()?.frames.length,run:()=>{const id=assetId,n=asset().frames.length;ctx.execute(ctx.edit(t('cmd.frames.clear'),d=>P.setGrid(P.setFrames(d,id,[]),id,null)));select([]);ctx.toast(t('toast.cleared',{n,undo:ctx.shortcutOf('edit.undo')}));}});
  ctx.command({id:'frames.reveal',group:'frames',enabled:()=>selection.length>0,run:()=>{const a=asset(),b=boundsOf(a.frames.filter(f=>selection.includes(f.id)).map(f=>f.sourceRect));if(b)view.reveal(b);}});
  ctx.menu({id:'frames',title:'menu.frames',items:()=>['frames.detect','frames.apply','frames.clear','-','tool.select','tool.frame','-','edit.selectAll','edit.deselect','edit.delete','frames.reveal','-','frame.prev','frame.next']});
  function step(dir){
   const a=asset();if(!a?.frames.length)return;
   const cur=a.frames.findIndex(f=>f.id===selection[selection.length-1]);
   const i=cur<0?(dir>0?0:a.frames.length-1):Math.max(0,Math.min(a.frames.length-1,cur+dir));
   select([a.frames[i].id]);const r=a.frames[i].sourceRect,v=view.view,s=v.scale;
   // keep the frame on screen without re-centring on every step
   if(v.x+r.x*s<0||v.y+r.y*s<0||v.x+(r.x+r.w)*s>view.W||v.y+(r.y+r.h)*s>view.H)view.reveal(r);
  }
  // ------------------------------------------------------------ document/asset events
  ctx.on('doc',(doc,prev,ev)=>{
   const a=asset();if(!a){return;}
   const pa=prev?P.assetById(prev,a.id):null;
   if(!pa||pa.frames!==a.frames){syncLayer();renderStrip();}
   if(!pa||pa.grid!==a.grid||pa.frames.length!==a.frames.length){if(ev?.type==='undo'||ev?.type==='redo'||ev?.type==='reset'){drafts.delete(a.id);const g=a.grid;view.set({grid:g,gridVisible:!!g&&view.options.gridVisible});}renderGrid();}
   renderInspector();
  });
  ctx.on('asset',id=>{
   if(id===assetId&&id)return;
   assetId=id;selection=[];const a=asset();
   const g=a?(drafts.get(a.id)||a.grid):null;view.set({grid:g,gridVisible:!!g&&(!a.grid||!a.frames.length||view.options.gridVisible)});
   cellInfo=null;cellToken++;syncLayer();renderGrid();renderInspector();renderStrip();countCells();
   if(a)runDetect();
  });
  ctx.on('view',()=>{const show=gridBox.querySelector('[data-grid="show"]');if(show)show.checked=!!view.options.gridVisible;});
  ctx.on('locale',()=>{renderGrid();renderInspector();renderStrip();select(selection);});
  assetId=null;
  return {
   selectAll(){const a=asset();if(a)select(a.frames.map(f=>f.id));},
   deselect(){select([]);},
   hasSelection:()=>selection.length>0,
   deleteSelection(){const id=assetId,ids=[...selection],n=ids.length;if(!id||!n)return;ctx.execute(ctx.edit(t('cmd.frames.delete',{n}),d=>P.removeFrames(d,id,ids)));select([]);},
   nudge(dx,dy){
    const a=asset();if(!a||!selection.length)return;
    const map=new Map(a.frames.filter(f=>selection.includes(f.id)).map(f=>[f.id,{...f.sourceRect,x:f.sourceRect.x+dx,y:f.sourceRect.y+dy}]));
    // blocked at the image edge: nothing moves (a partial move would change the frames' spacing)
    for(const r of map.values())if(r.x<0||r.y<0||r.x+r.w>a.width||r.y+r.h>a.height)return;
    ctx.execute(ctx.edit(t('cmd.frames.nudge'),d=>P.setFrameRects(d,a.id,map),{mergeKey:'nudge:'+selection.join(',')}));
   },
   step,
   onAsset(id){if(id!==assetId){assetId=null;listenersAsset(id);}},
   /** Frames handed over by another page (e.g. Sprite Lab's "Open in Studio"). */
   handoff(meta,assets){
    const a=assets[0];if(!a||!Array.isArray(meta?.frames)||!meta.frames.length)return;
    const frames=[];for(const f of meta.frames.slice(0,4096)){try{const r=P.clampRect(f.sourceRect,a);frames.push(makeFrame({...f,id:undefined,sourceRect:r,trimmedRect:null,canvasWidth:r.w,canvasHeight:r.h,offsetX:0,offsetY:0,boxes:[],collision:[]}));}catch{}}
    if(!frames.length)return;
    ctx.execute(ctx.edit(t('cmd.frames.fromHandoff',{n:frames.length}),d=>P.setFrames(d,a.id,frames)));
    ctx.toast(t('toast.handoffFrames',{n:frames.length}));
   }
  };
  function listenersAsset(id){assetId=id;selection=[];const a=asset();const g=a?(drafts.get(a.id)||a.grid):null;view.set({grid:g,gridVisible:!!g});cellInfo=null;cellToken++;syncLayer();renderGrid();renderInspector();renderStrip();countCells();if(a)runDetect();}
 }
};
