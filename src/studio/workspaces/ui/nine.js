/** 9-SLICE mode of the UI workspace: draggable stretch and content-padding guides on the canvas
 * (whole-pixel snapping, Shift = symmetric, arrows nudge the last guide, Esc cancels a drag, one
 * undo step per drag), a suggestion with its evidence, bad-patch checks with one-click fixes, and
 * live previews at many sizes and DPI scales as a chosen engine draws them. */
import {h} from '../../ui/dom.js';
import * as V from '../../canvas/view-math.js';
import * as U from './state.js';
import * as N from '../../../game/ui/nine-patch.js';
import {ENGINES,enginePlan} from '../../../game/ui/engines.js';
import {kitPanel} from './kit-export.js';
const SIDES=['left','right','top','bottom'];
const PREVIEW_KEY='nerulio.studio.ui.preview';
const loadPrefs=()=>{try{return {scales:[1,2],engine:'ideal',custom:null,content:true,slices:false,...JSON.parse(localStorage.getItem(PREVIEW_KEY)||'{}')};}catch{return {scales:[1,2],engine:'ideal',custom:null,content:true,slices:false};}};
export default function nineMode(W){
 const {ctx,t,view}=W;
 let pix=null;          // {id, key, data, w, h} pixels of the selected element
 let suggestion=null,issues=[],guide=null,hoverGuide=null,drag=null,gesture=0;
 const prefs=loadPrefs();const savePrefs=()=>{try{localStorage.setItem(PREVIEW_KEY,JSON.stringify(prefs));}catch{}};
 const el=()=>{const e=W.element();return e&&ctx.doc.assets.some(a=>a.id===e.assetId)?e:null;};
 const nineOf=e=>e.nine||N.normalizeNine({},e.rect.w,e.rect.h);
 const setNine=(label,fn,opts)=>{const e=el();if(!e)return;W.edit(label,s=>U.setNine(s,e.id,fn(nineOf(U.uiState(ctx.doc).elements[e.id]))),opts);};
 // ---------------------------------------------------------------- pixels, suggestion, checks
 let loading=null;
 async function ensurePixels(){
  const e=el();if(!e){pix=null;suggestion=null;issues=[];return;}
  const blob=W.assetBlob(e.assetId),key=blob+JSON.stringify(e.rect);
  if(pix?.key===key)return;
  if(loading?.key===key)return loading.p;
  const p=(async()=>{const img=await W.pixels(blob);const data=N.crop(img.data,img.width,img.height,e.rect);pix={id:e.id,key,data,w:e.rect.w,h:e.rect.h};suggestion=N.suggestNine(data,e.rect.w,e.rect.h);})();
  loading={key,p};try{await p;}finally{loading=null;}
 }
 function check(){const e=el();issues=e&&pix&&e.nine?N.validateNine(pix.data,pix.w,pix.h,e.nine):[];}
 async function refresh(){try{await ensurePixels();}catch(e){ctx.toast(String(e.message||e),{error:true});}check();renderPanel();renderPreview();W.invalidate();}
 // ---------------------------------------------------------------- canvas: guides
 const guidesOf=e=>{
  const n=nineOf(e),r=e.rect,out=[];
  out.push({kind:'border',side:'left',axis:'x',pos:r.x+n.border.left},{kind:'border',side:'right',axis:'x',pos:r.x+r.w-n.border.right},{kind:'border',side:'top',axis:'y',pos:r.y+n.border.top},{kind:'border',side:'bottom',axis:'y',pos:r.y+r.h-n.border.bottom});
  if(n.padding)out.push({kind:'padding',side:'left',axis:'x',pos:r.x+n.padding.left},{kind:'padding',side:'right',axis:'x',pos:r.x+r.w-n.padding.right},{kind:'padding',side:'top',axis:'y',pos:r.y+n.padding.top},{kind:'padding',side:'bottom',axis:'y',pos:r.y+r.h-n.padding.bottom});
  return out;
 };
 function hitGuide(i){
  const e=el();if(!e)return null;const v=view.view,s=v.scale,tol=7*(view.dpr||1),r=e.rect,pad=14*(view.dpr||1);
  let best=null;
  for(const g of guidesOf(e)){
   const d=g.axis==='x'?Math.abs(i.sx-(v.x+g.pos*s)):Math.abs(i.sy-(v.y+g.pos*s));
   const along=g.axis==='x'?i.sy>=v.y+r.y*s-pad&&i.sy<=v.y+(r.y+r.h)*s+pad:i.sx>=v.x+r.x*s-pad&&i.sx<=v.x+(r.x+r.w)*s+pad;
   if(d<=tol&&along&&(!best||d<best.d-.01||(Math.abs(d-best.d)<.01&&g.kind==='border')))best={...g,d};
  }
  return best;
 }
 const same=(a,b)=>a&&b&&a.kind===b.kind&&a.side===b.side;
 function valueAt(g,i,e){
  const r=e.rect,x=Math.round(i.x),y=Math.round(i.y);
  return g.side==='left'?x-r.x:g.side==='right'?r.x+r.w-x:g.side==='top'?y-r.y:r.y+r.h-y;
 }
 function applyGuide(n,g,v,sym){
  const out={...n,border:{...n.border},padding:n.padding?{...n.padding}:null};
  const box=g.kind==='border'?out.border:out.padding,opp={left:'right',right:'left',top:'bottom',bottom:'top'}[g.side];
  box[g.side]=Math.max(0,v);if(sym)box[opp]=Math.max(0,v);
  return out;
 }
 const tool={
  cursor(){const g=drag?.g||hoverGuide;return g?(g.axis==='x'?'ew-resize':'ns-resize'):'default';},
  hover(i){const g=hitGuide(i);if(!same(g,hoverGuide)){hoverGuide=g;W.invalidate();}if(g)ctx.status('selection',t('ui.nine.guideHint',{what:t(`ui.nine.${g.kind}.${g.side}`)}));},
  leave(){if(hoverGuide){hoverGuide=null;W.invalidate();}},
  down(i){
   if(i.button!==0)return false;
   const e=el();if(!e)return false;
   const g=hitGuide(i);
   if(!g){ // a click inside another element of the same image selects it
    const other=U.elementsForAsset(W.S(),e.assetId).find(x=>i.x>=x.rect.x&&i.y>=x.rect.y&&i.x<x.rect.x+x.rect.w&&i.y<x.rect.y+x.rect.h);
    if(other&&other.id!==e.id)W.select('element',other.id);
    return false;
   }
   guide={kind:g.kind,side:g.side};
   if(g.kind==='padding'&&!e.nine?.padding)return false;
   drag={g,key:'nine-guide-'+(++gesture),start:nineOf(e)};W.invalidate();
  },
  move(i){
   if(!drag)return;const e=el();if(!e)return;
   const v=valueAt(drag.g,i,e),next=applyGuide(nineOf(e),drag.g,v,i.shift);
   W.edit(t('ui.cmd.moveGuide'),s=>U.setNine(s,e.id,next),{mergeKey:drag.key,open:true});
   const n=nineOf(W.element());ctx.status('selection',t('ui.nine.borders',{l:n.border.left,r:n.border.right,t:n.border.top,b:n.border.bottom}));
  },
  up(){if(!drag)return;ctx.history.close(drag.key);drag=null;W.invalidate();},
  cancel(){if(!drag)return;ctx.history.abort(drag.key);drag=null;W.invalidate();},
  get active(){return !!drag;}
 };
 function draw(g){
  const e=el();if(!e||ctx.activeAsset?.id!==e.assetId)return;
  const {ctx:c,view:v,W:CW,H:CH,dpr}=g,s=v.scale,r=e.rect,n=nineOf(e);
  const X=x=>Math.round(v.x+x*s),Y=y=>Math.round(v.y+y*s);
  const x0=X(r.x),y0=Y(r.y),x1=X(r.x+r.w),y1=Y(r.y+r.h);
  // everything outside the element is dimmed (a sheet keeps its context)
  c.fillStyle='rgba(12,13,16,.55)';c.beginPath();c.rect(0,0,CW,CH);c.rect(x0,y0,x1-x0,y1-y0);c.fill('evenodd');
  // stretch bands
  const bx0=X(r.x+n.border.left),bx1=X(r.x+r.w-n.border.right),by0=Y(r.y+n.border.top),by1=Y(r.y+r.h-n.border.bottom);
  c.fillStyle=n.stretch.h==='stretch'?'rgba(76,194,255,.14)':'rgba(180,140,255,.18)';if(bx1>bx0)c.fillRect(bx0,y0,bx1-bx0,y1-y0);
  c.fillStyle=n.stretch.v==='stretch'?'rgba(76,194,255,.14)':'rgba(180,140,255,.18)';if(by1>by0)c.fillRect(x0,by0,x1-x0,by1-by0);
  // bad patches: red on the offending columns / rows
  for(const is of issues){
   c.fillStyle='rgba(255,90,90,.33)';
   if(is.code==='gradient'&&is.axis==='h')for(const [a,b] of is.columns)c.fillRect(X(r.x+a),y0,X(r.x+b+1)-X(r.x+a),y1-y0);
   if(is.code==='gradient'&&is.axis==='v')for(const [a,b] of is.rows)c.fillRect(x0,Y(r.y+a),x1-x0,Y(r.y+b+1)-Y(r.y+a));
   if(is.code==='cut-corner'){c.fillStyle='rgba(255,196,61,.4)';const k=is.columns??is.rows;
    if(is.side==='left')c.fillRect(bx0,y0,X(r.x+n.border.left+k)-bx0,y1-y0);if(is.side==='right')c.fillRect(X(r.x+r.w-n.border.right-k),y0,bx1-X(r.x+r.w-n.border.right-k),y1-y0);
    if(is.side==='top')c.fillRect(x0,by0,x1-x0,Y(r.y+n.border.top+k)-by0);if(is.side==='bottom')c.fillRect(x0,Y(r.y+r.h-n.border.bottom-k),x1-x0,by1-Y(r.y+r.h-n.border.bottom-k));}
  }
  c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.55)';c.strokeRect(x0+.5,y0+.5,x1-x0-1,y1-y0-1);
  const ext=10*dpr,hs=Math.max(5,Math.round(4*dpr));
  for(const gd of guidesOf(e)){
   const on=same(gd,drag?.g)||same(gd,hoverGuide),sel=same(gd,guide),border=gd.kind==='border';
   c.strokeStyle=border?(on?'#ffffff':'#4cc2ff'):(on?'#ffffff':'#7bd88f');c.lineWidth=Math.max(1,Math.round((on||sel?2:1)*dpr));
   c.setLineDash(border?[]:[4*dpr,3*dpr]);c.beginPath();
   if(gd.axis==='x'){const x=X(gd.pos)+.5;c.moveTo(x,y0-ext);c.lineTo(x,y1+ext);}else{const y=Y(gd.pos)+.5;c.moveTo(x0-ext,y);c.lineTo(x1+ext,y);}
   c.stroke();c.setLineDash([]);
   // handles outside the element so they never hide pixels
   c.fillStyle=border?'#4cc2ff':'#7bd88f';
   if(gd.axis==='x'){const x=X(gd.pos);c.fillRect(x-hs/2,y0-ext-hs,hs,hs);c.fillRect(x-hs/2,y1+ext,hs,hs);}
   else{const y=Y(gd.pos);c.fillRect(x0-ext-hs,y-hs/2,hs,hs);c.fillRect(x1+ext,y-hs/2,hs,hs);}
  }
  // numbers next to the handles when there is room
  if(s>=2){c.font=`${Math.round(11*dpr)}px system-ui,sans-serif`;c.fillStyle='#fff';c.textBaseline='bottom';
   c.fillText(`${n.border.left}`,X(r.x+n.border.left)+3*dpr,y0-ext-2*dpr);c.fillText(`${n.border.right}`,X(r.x+r.w-n.border.right)+3*dpr,y0-ext-2*dpr);
   c.textBaseline='middle';c.fillText(`${n.border.top}`,x1+ext+hs+3*dpr,Y(r.y+n.border.top));c.fillText(`${n.border.bottom}`,x1+ext+hs+3*dpr,Y(r.y+r.h-n.border.bottom));}
 }
 // ---------------------------------------------------------------- list (in the main panel)
 function list(){
  const s=W.S(),els=U.pruneForAssets(s,ctx.doc.assets.map(a=>a.id)),all=U.elementsOf(els);
  const box=h('div.ui-list',{role:'listbox','aria-label':t('ui.list.elements')});
  if(!all.length)box.append(h('p.st-muted.st-pad',{},t('ui.nine.noElements')));
  for(const e of all){
   const on=e.id===W.sel.element,n=e.nine;
   const row=h('div.ui-row',{role:'option','aria-selected':String(on),tabindex:on?'0':'-1','data-element':e.id,title:e.name},
    h('span.ui-row-name',{},e.name),h('small',{},`${e.rect.w}×${e.rect.h}`),
    h('span.ui-chip'+(n?'.is-on':''),{title:n?t('ui.nine.chipOn',{l:n.border.left,r:n.border.right,t:n.border.top,b:n.border.bottom}):t('ui.nine.chipOff')},n?'9':'—'));
   row.addEventListener('click',()=>W.select('element',e.id));
   row.addEventListener('dblclick',()=>rename(e));
   row.addEventListener('keydown',ev=>{const rows=[...box.querySelectorAll('.ui-row')],k=rows.indexOf(row);
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ev.preventDefault();ev.stopPropagation();const nx=rows[k+(ev.key==='ArrowDown'?1:-1)];if(nx){W.select('element',nx.dataset.element);queueMicrotask(()=>box.parentElement?.querySelector(`[data-element="${nx.dataset.element}"]`)?.focus());}}
    else if(ev.key==='F2'){ev.preventDefault();rename(e);}else if(ev.key==='Delete'){ev.preventDefault();ev.stopPropagation();removeEl(e.id);}});
   box.append(row);
  }
  const a=ctx.activeAsset;
  const acts=h('div.ui-actions',{});
  if(a&&!U.elementsForAsset(s,a.id).some(e=>e.rect.w===a.width&&e.rect.h===a.height)){
   const b=h('button.st-btn',{type:'button','data-action':'whole'},t('ui.nine.useWhole',{name:a.name}));
   b.addEventListener('click',()=>{const e=U.newElement(W.S(),{assetId:a.id,rect:{x:0,y:0,w:a.width,h:a.height},name:a.name});W.edit(t('ui.cmd.addElement'),st=>U.putElements(st,[e]));W.select('element',e.id);});acts.append(b);
  }
  return h('div',{},box,acts);
 }
 async function rename(e){
  const input=h('input.st-input',{type:'text',value:e.name,'aria-label':t('ui.nine.name'),maxlength:'80'});
  const row=document.querySelector(`[data-element="${e.id}"] .ui-row-name`);if(!row)return;
  row.replaceChildren(input);input.focus();input.select();
  const done=ok=>{if(ok&&input.value.trim()&&input.value!==e.name)W.edit(t('ui.cmd.rename'),s=>U.renameElement(s,e.id,input.value.trim()));else W.refresh();};
  input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();done(true);}if(ev.key==='Escape'){ev.preventDefault();done(false);}});
  input.addEventListener('blur',()=>done(true),{once:true});
 }
 function removeEl(id){const e=W.S().elements[id];if(!e)return;W.edit(t('ui.cmd.removeElement',{name:e.name}),s=>U.removeElements(s,[id]));ctx.toast(t('toast.removed',{name:e.name,undo:ctx.shortcutOf('edit.undo')}));}
 // ---------------------------------------------------------------- the 9-slice panel
 const panelBox=h('div.ui-nine',{});
 const num=(value,label,on,{min=0,max=9999,data}={})=>{const el=h('input.st-input.st-num',{type:'number',min:String(min),max:String(max),step:'1',value:String(value),'aria-label':label,'data-nine':data,inputmode:'numeric'});
  el.addEventListener('change',()=>{const v=Math.round(Number(el.value));if(!Number.isFinite(v)){el.value=String(value);return;}on(Math.max(min,Math.min(max,v)));});return el;};
 const field=(label,ctl)=>h('label.st-field',{},h('span',{},label),ctl);
 function renderPanel(){
  const e=el();
  if(!e){panelBox.replaceChildren(h('p.st-muted.st-pad',{},t('ui.nine.pick')));return;}
  const n=nineOf(e),has=!!e.nine,parts=[];
  parts.push(h('div.ui-head',{},h('b',{},e.name),h('span.st-muted',{},`${e.rect.w}×${e.rect.h} px`)));
  // suggestion with its evidence; applied only by the button
  if(suggestion&&suggestion.confidence!=='none'){
   const sb=suggestion.border,same=has&&SIDES.every(k=>sb[k]===n.border[k])&&suggestion.stretch.h===n.stretch.h&&suggestion.stretch.v===n.stretch.v;
   const why=[suggestion.horizontal.mode==='stretch'?t('ui.nine.whyCols',{n:suggestion.horizontal.run}):suggestion.horizontal.mode==='tile'?t('ui.nine.whyPeriod',{axis:t('ui.nine.axisH'),p:suggestion.horizontal.period}):t('ui.nine.whyNoneH'),
    suggestion.vertical.mode==='stretch'?t('ui.nine.whyRows',{n:suggestion.vertical.run}):suggestion.vertical.mode==='tile'?t('ui.nine.whyPeriod',{axis:t('ui.nine.axisV'),p:suggestion.vertical.period}):t('ui.nine.whyNoneV')].join(' · ');
   const apply=h('button.st-btn'+(same?'':'.primary'),{type:'button','data-action':'apply-suggestion',disabled:same},same?t('ui.nine.applied'):t('ui.nine.apply'));
   apply.addEventListener('click',()=>{W.edit(t('ui.cmd.applySuggestion'),s=>U.setNine(s,e.id,{...n,border:{...sb},stretch:{...suggestion.stretch}}),{mergeKey:null});});
   parts.push(h('div.ui-suggest'+(same?'.is-applied':''),{'data-nine':'suggestion','data-confidence':suggestion.confidence},
    h('div',{},h('b',{},t('ui.nine.suggested',{l:sb.left,r:sb.right,t:sb.top,b:sb.bottom})),' ',h('span.ui-conf.is-'+suggestion.confidence,{},t('ui.conf.'+suggestion.confidence))),
    h('small.st-muted',{},why),suggestion.stretch.h==='tile'||suggestion.stretch.v==='tile'?h('small.st-muted',{},t('ui.nine.tileSuggested')):'',apply));
  }else if(suggestion)parts.push(h('p.ui-note',{},t('ui.nine.noSuggestion')));
  // borders
  const setB=k=>v=>setNine(t('ui.cmd.border'),m=>({...m,border:{...m.border,[k]:v}}),{mergeKey:'nine-num-'+k});
  parts.push(h('div.ui-sec',{},h('h3',{},t('ui.nine.stretchBorders')),
   h('div.ui-grid4',{},...SIDES.map(k=>field(t('ui.side.'+k),num(n.border[k],t('ui.side.'+k),setB(k),{data:'border-'+k,max:k==='left'||k==='right'?e.rect.w:e.rect.h})))),
   h('small.st-muted',{},t('ui.nine.dragHint'))));
  // content padding
  const pad=h('input',{type:'checkbox',checked:!!n.padding,'data-nine':'padding-on'});
  pad.addEventListener('change',()=>setNine(t('ui.cmd.padding'),m=>({...m,padding:pad.checked?{...m.border}:null}),{mergeKey:null}));
  const setP=k=>v=>setNine(t('ui.cmd.padding'),m=>({...m,padding:{...(m.padding||m.border),[k]:v}}),{mergeKey:'nine-pad-'+k});
  parts.push(h('div.ui-sec',{},h('label.st-check',{},pad,' ',t('ui.nine.paddingOn')),
   n.padding?h('div.ui-grid4',{},...SIDES.map(k=>field(t('ui.side.'+k),num(n.padding[k],t('ui.side.'+k),setP(k),{data:'padding-'+k})))):h('small.st-muted',{},t('ui.nine.paddingOff'))));
  // middle band
  const mode=axis=>{const s=h('select',{'data-nine':'stretch-'+axis,'aria-label':t('ui.nine.axis'+axis.toUpperCase())},...N.MODES.map(m=>h('option',{value:m,selected:n.stretch[axis]===m},t('ui.stretch.'+m))));
   s.addEventListener('change',()=>setNine(t('ui.cmd.stretch'),m=>({...m,stretch:{...m.stretch,[axis]:s.value}}),{mergeKey:null}));return s;};
  const center=h('input',{type:'checkbox',checked:n.drawCenter,'data-nine':'center'});center.addEventListener('change',()=>setNine(t('ui.cmd.center'),m=>({...m,drawCenter:center.checked}),{mergeKey:null}));
  parts.push(h('div.ui-sec',{},h('h3',{},t('ui.nine.middle')),h('div.ui-grid2',{},field(t('ui.nine.axisH'),mode('h')),field(t('ui.nine.axisV'),mode('v'))),h('label.st-check',{},center,' ',t('ui.nine.drawCenter'))));
  // checks
  const rows=issues.map(is=>{
   const fix=is.code==='cut-corner'?h('button.st-btn.ui-fix',{type:'button','data-fix':is.side},t('ui.nine.fixGuide',{v:is.suggest})):null;
   fix?.addEventListener('click',()=>setNine(t('ui.cmd.fixGuide'),m=>({...m,border:{...m.border,[is.side]:is.suggest}}),{mergeKey:null}));
   return h('li.ui-issue.is-'+is.severity,{'data-issue':is.code},h('span',{},t('ui.issue.'+is.code+(is.axis?'.'+is.axis:''),{n:is.distinct??'',side:t('ui.side.'+(is.side||'left')),k:is.columns??is.rows??'',step:is.step??is.maxStep??''})),fix);
  });
  parts.push(h('div.ui-sec',{'data-nine':'checks'},h('h3',{},t('ui.nine.checks')),has?(rows.length?h('ul.ui-issues',{},...rows):h('p.ui-ok',{},t('ui.nine.clean'))):h('p.st-muted',{},t('ui.nine.notSet'))));
  // the same numbers as each engine asks for them
  if(has){const b=n.border;parts.push(h('details.ui-sec',{},h('summary',{},t('ui.nine.engineNumbers')),h('dl.ui-dl',{},
   h('dt',{},'Godot'),h('dd',{},`patch_margin / texture_margin L ${b.left} T ${b.top} R ${b.right} B ${b.bottom}`),
   h('dt',{},'Unity'),h('dd',{},`Border L ${b.left} B ${b.bottom} R ${b.right} T ${b.top}`),
   h('dt',{},'CSS'),h('dd',{},`border-image-slice: ${b.top} ${b.right} ${b.bottom} ${b.left}`),
   h('dt',{},'Phaser / Pixi'),h('dd',{},`${b.left}, ${b.right}, ${b.top}, ${b.bottom}`))));}
  if(has){const clear=h('button.st-link',{type:'button','data-action':'clear-nine'},t('ui.nine.clear'));clear.addEventListener('click',()=>W.edit(t('ui.cmd.clearNine'),s=>U.setNine(s,e.id,null)));parts.push(clear);}
  panelBox.replaceChildren(...parts);
 }
 // ---------------------------------------------------------------- previews (bottom)
 const previewBox=h('div.ui-previews',{});
 function targets(e){
  const n=nineOf(e),min=N.minimumTarget(n);
  const list=[{id:'min',w:Math.max(1,min.w),h:Math.max(1,min.h)},{id:'source',w:e.rect.w,h:e.rect.h},{id:'wide',w:e.rect.w*3,h:e.rect.h},{id:'tall',w:e.rect.w,h:e.rect.h*2},{id:'large',w:Math.min(640,e.rect.w*4),h:Math.min(360,e.rect.h*3)}];
  if(prefs.custom)list.push({id:'custom',...prefs.custom});
  return list;
 }
 function renderPreview(){
  const e=el();
  if(!e||!pix||pix.id!==e.id){previewBox.replaceChildren(h('p.st-muted.st-pad',{},t('ui.nine.pick')));return;}
  const n=nineOf(e),engine=prefs.engine,dpr=devicePixelRatio||1;
  const eng=h('select',{'data-preview':'engine','aria-label':t('ui.preview.engine')},...Object.keys(ENGINES).map(k=>h('option',{value:k,selected:k===engine},t('ui.engine.'+k))));
  eng.addEventListener('change',()=>{prefs.engine=eng.value;savePrefs();renderPreview();});
  const scales=h('div.ui-scales',{role:'group','aria-label':t('ui.preview.scales')},...[1,1.5,2,3].map(sc=>{const b=h('button.ui-toggle',{type:'button','aria-pressed':String(prefs.scales.includes(sc)),'data-scale':String(sc)},`${sc}×`);
   b.addEventListener('click',()=>{prefs.scales=prefs.scales.includes(sc)?prefs.scales.filter(x=>x!==sc):[...prefs.scales,sc].sort((a,b)=>a-b);if(!prefs.scales.length)prefs.scales=[1];savePrefs();renderPreview();});return b;}));
  const cw=h('input.st-input.st-num',{type:'number',min:'1',max:'4096',value:String(prefs.custom?.w||e.rect.w*2),'aria-label':t('ui.preview.customW'),'data-preview':'w'});
  const ch=h('input.st-input.st-num',{type:'number',min:'1',max:'4096',value:String(prefs.custom?.h||e.rect.h),'aria-label':t('ui.preview.customH'),'data-preview':'h'});
  const setCustom=()=>{const w=Math.max(1,Math.min(4096,Math.round(+cw.value||1))),hh=Math.max(1,Math.min(4096,Math.round(+ch.value||1)));prefs.custom={w,h:hh};savePrefs();renderPreview();};
  cw.addEventListener('change',setCustom);ch.addEventListener('change',setCustom);
  const content=h('input',{type:'checkbox',checked:prefs.content});content.addEventListener('change',()=>{prefs.content=content.checked;savePrefs();renderPreview();});
  const slices=h('input',{type:'checkbox',checked:prefs.slices});slices.addEventListener('change',()=>{prefs.slices=slices.checked;savePrefs();renderPreview();});
  const bar=h('div.ui-preview-bar',{},h('label.st-field.ui-inline',{},h('span',{},t('ui.preview.engine')),eng),scales,h('span.ui-inline',{},t('ui.preview.custom'),' ',cw,'×',ch),h('label.st-check',{},content,' ',t('ui.preview.content')),h('label.st-check',{},slices,' ',t('ui.preview.slices')));
  const tiles=[],notes=new Set();
  for(const sc of prefs.scales)for(const tg of targets(e)){
   let plan;try{plan=enginePlan(engine,{w:e.rect.w,h:e.rect.h},n,Math.round(tg.w*sc),Math.round(tg.h*sc),{scale:sc});}catch(err){continue;}
   for(const x of plan.notes)notes.add(t('ui.preview.noMode',{engine:t('ui.engine.'+engine),mode:t('ui.stretch.'+x.mode)}));
   const W2=plan.targetW,H2=plan.targetH;if(W2*H2>4e6)continue;
   const out=N.renderPlan(pix.data,pix.w,pix.h,plan);
   const cv=h('canvas.ui-pv',{width:W2,height:H2,'data-preview-size':`${tg.id}@${sc}`,style:{width:`${W2/dpr}px`,height:`${H2/dpr}px`}});
   const x=cv.getContext('2d');x.putImageData(new ImageData(out,W2,H2),0,0);
   if(prefs.content){const cr=N.contentRect(n,{w:e.rect.w,h:e.rect.h},W2,H2,sc);x.strokeStyle='rgba(123,216,143,.9)';x.lineWidth=1;x.setLineDash([3,2]);x.strokeRect(cr.x+.5,cr.y+.5,Math.max(0,cr.w-1),Math.max(0,cr.h-1));x.setLineDash([]);}
   if(prefs.slices){x.strokeStyle='rgba(76,194,255,.8)';x.lineWidth=1;x.beginPath();const ef=plan.effective;for(const px of [ef.left,W2-ef.right]){x.moveTo(px+.5,0);x.lineTo(px+.5,H2);}for(const py of [ef.top,H2-ef.bottom]){x.moveTo(0,py+.5);x.lineTo(W2,py+.5);}x.stroke();}
   const warn=plan.warnings.map(w=>t('ui.preview.warn.'+w.code)).join(' · ');
   tiles.push(h('figure.ui-pv-tile'+(warn?'.has-warn':''),{},cv,h('figcaption',{},`${tg.w}×${tg.h}`,h('b',{},` @${sc}×`),warn?h('span.ui-warn',{title:warn},' ⚠'):'')));
  }
  previewBox.replaceChildren(bar,notes.size?h('p.ui-note',{'data-preview':'notes'},[...notes].join(' · ')):'',h('div.ui-pv-strip',{},...tiles));
 }
 // ---------------------------------------------------------------- mode API
 const kit=kitPanel(W);
 return {
  panels:()=>[
   {id:'ui-nine',title:()=>t('ui.panel.nine'),dock:'right',order:15,badge:()=>issues.length?String(issues.length):'',render(body){body.append(panelBox);}},
   kit.panel,
   {id:'ui-preview',title:()=>t('ui.panel.preview'),dock:'bottom',order:5,render(body){body.append(previewBox);}}
  ],
  enter(){ctx.minBottomHeight?.(220);const e=el();if(e&&ctx.activeAsset?.id!==e.assetId)ctx.showAsset(e.assetId);else{W.showPicture(ctx.activeAsset?.id,{restoreView:true}).then(()=>reveal());}refresh();kit.render();},
  leave(){drag&&tool.cancel();hoverGuide=null;},
  list,tool,draw,
  present:async opts=>{await W.showPicture(ctx.activeAsset?.id,opts);if(!opts?.restoreView)reveal();},
  onSelect(kind){if(kind==='element'){guide=null;refresh().then(reveal);}},
  onAsset(id){const e=el();if(!e||e.assetId!==id){const first=U.elementsForAsset(W.S(),id)[0];if(first){W.sel.element=first.id;}}refresh();W.refresh();},
  onDoc(doc,prev){if(W.mode!=='nine')return;const a=U.uiState(doc).elements?.[W.sel.element],b=prev&&U.uiState(prev).elements?.[W.sel.element];if(a!==b)refresh();kit.render();},
  onLocale(){renderPanel();renderPreview();kit.render();},
  suggest(){const e=el();if(!e||!suggestion||suggestion.confidence==='none')return;W.edit(t('ui.cmd.applySuggestion'),s=>U.setNine(s,e.id,{...nineOf(e),border:{...suggestion.border},stretch:{...suggestion.stretch}}));},
  hasSelection:()=>!!guide&&!!el(),
  deselect(){guide=null;W.invalidate();},
  nudge(dx,dy){const e=el();if(!e||!guide)return;const g=guidesOf(e).find(x=>x.kind===guide.kind&&x.side===guide.side);if(!g)return;
   const d=g.axis==='x'?dx:dy;if(!d)return;const n=nineOf(e),box=guide.kind==='border'?n.border:n.padding;if(!box)return;
   const sign=guide.side==='left'||guide.side==='top'?1:-1;
   W.edit(t('ui.cmd.moveGuide'),s=>U.setNine(s,e.id,applyGuide(n,g,box[guide.side]+d*sign,false)),{mergeKey:'nine-nudge-'+guide.kind+guide.side});},
  deleteSelection(){const e=el();if(e)removeEl(e.id);},
  canExport:()=>kit.canExport(),exportNow:()=>kit.exportNow()
 };
 function reveal(){
  const e=el();if(!e||ctx.activeAsset?.id!==e.assetId||!view.image)return;
  if(e.rect.w===view.image.w&&e.rect.h===view.image.h){view.fit();return;}
  const W2=view.W,H2=view.H,pad=Math.round(48*(view.dpr||1)),z=V.fitZoom(e.rect.w,e.rect.h,W2,H2,{pad,max:Math.max(1,Math.round(12*(view.dpr||1)))});
  view.setView({scale:z,x:Math.round(W2/2-(e.rect.x+e.rect.w/2)*z),y:Math.round(H2/2-(e.rect.y+e.rect.h/2)*z)});
 }
}
