/** STATES mode: a button's normal / hover / pressed / disabled / focus images — each either separate
 * art (an element) or generated from another state by visible, editable pixel operations. The
 * canvas shows the state sheet; the bottom panel is a live button you can hover, press, focus and
 * disable, drawn through each state's own 9-slice (per-state borders). */
import {h} from '../../ui/dom.js';
import * as U from './state.js';
import * as N from '../../../game/ui/nine-patch.js';
import {variant} from '../../../game/ui-states.js';
import {kitPanel} from './kit-export.js';
const OPS=[['brightness',-1,1,.02],['contrast',-1,1,.02],['saturation',-1,1,.02],['alpha',0,1,.05],['offsetX',-16,16,1],['offsetY',-16,16,1],['outline',0,16,1]];
export default function statesMode(W){
 const {ctx,t,view}=W;
 let images=new Map();// state → {w,h,data,nine,applied,element}
 let hoverState=null,live={w:0,h:0,scale:2,label:'OK',disabled:false,focus:false},sheetRects=[];
 const btn=()=>{const b=W.button();return b&&W.S().elements?.[b.states.normal?.element]?b:null;};
 async function elementImage(id){const e=W.S().elements?.[id];if(!e)return null;const img=await W.pixels(W.assetBlob(e.assetId));return {w:e.rect.w,h:e.rect.h,data:N.crop(img.data,img.width,img.height,e.rect),nine:e.nine,element:e};}
 /** Every state's pixels, in dependency order (a state generated from 'hover' needs hover first). */
 async function build(){
  images=new Map();const b=btn();if(!b)return;
  const pending=new Map(Object.entries(b.states));
  for(let pass=0;pass<6&&pending.size;pass++)for(const [st,v] of [...pending]){
   if(v.element){const img=await elementImage(v.element);if(img)images.set(st,{...img,applied:[]});pending.delete(st);continue;}
   const from=images.get(v.from||'normal');if(!from)continue;
   const r=variant(from.data,from.w,from.h,v.ops||{}),pad=r.pad||0;
   const grow=b=>b&&Object.fromEntries(Object.entries(b).map(([k,x])=>[k,x+pad]));
   const nine=from.nine?N.normalizeNine({...from.nine,border:grow(from.nine.border),padding:grow(from.nine.padding)},r.width,r.height):null;
   images.set(st,{w:r.width,h:r.height,data:r.data,nine,applied:r.applied,from:v.from||'normal',pad});pending.delete(st);
  }
 }
 async function refresh(){try{await build();}catch(e){ctx.toast(String(e.message||e),{error:true});}renderPanel();renderLive();if(W.mode==='states')await present();}
 // ---------------------------------------------------------------- canvas: the state sheet
 async function present(opts={}){
  const b=btn();if(!b||!images.size){return W.showPicture(ctx.activeAsset?.id,opts);}
  const gap=6,list=U.STATE_NAMES.filter(s=>images.has(s)).map(s=>[s,images.get(s)]);
  const Wd=list.reduce((n,[,i])=>n+i.w,0)+gap*(list.length+1),Ht=Math.max(...list.map(([,i])=>i.h))+gap*2;
  const c=new OffscreenCanvas(Wd,Ht),x=c.getContext('2d');let px=gap;sheetRects=[];
  for(const [s,i] of list){x.putImageData(new ImageData(new Uint8ClampedArray(i.data),i.w,i.h),px,gap);sheetRects.push({state:s,x:px,y:gap,w:i.w,h:i.h});px+=i.w+gap;}
  const bmp=await createImageBitmap(c);const same=view.image&&view.image.w===Wd&&view.image.h===Ht;
  await view.setImage(bmp,Wd,Ht,{view:same||opts.restoreView?{...view.view}:null});
 }
 function draw(g){
  if(!btn()||!sheetRects.length)return;const {ctx:c,view:v,dpr}=g,s=v.scale;
  c.font=`${Math.round(11*dpr)}px system-ui,sans-serif`;c.textBaseline='bottom';
  for(const r of sheetRects){const x=Math.round(v.x+r.x*s),y=Math.round(v.y+r.y*s),w=Math.round(r.w*s),hh=Math.round(r.h*s);
   c.strokeStyle=r.state===hoverState?'#ffc83d':'rgba(255,255,255,.35)';c.lineWidth=Math.max(1,dpr);c.strokeRect(x+.5,y+.5,w-1,hh-1);
   c.fillStyle='#fff';c.fillText(t('ui.state.'+r.state),x,y-3*dpr);
   const i=images.get(r.state);if(i?.nine&&s>=2){c.strokeStyle='rgba(76,194,255,.8)';c.setLineDash([3*dpr,3*dpr]);c.beginPath();const b=i.nine.border;
    for(const xx of [b.left,r.w-b.right]){c.moveTo(x+Math.round(xx*s)+.5,y);c.lineTo(x+Math.round(xx*s)+.5,y+hh);}for(const yy of [b.top,r.h-b.bottom]){c.moveTo(x,y+Math.round(yy*s)+.5);c.lineTo(x+w,y+Math.round(yy*s)+.5);}c.stroke();c.setLineDash([]);}}
 }
 const tool={hover(i){const r=sheetRects.find(r=>i.x>=r.x&&i.y>=r.y&&i.x<r.x+r.w&&i.y<r.y+r.h);const s=r?.state||null;if(s!==hoverState){hoverState=s;W.invalidate();}},
  leave(){hoverState=null;W.invalidate();},down(i){const r=sheetRects.find(r=>i.x>=r.x&&i.y>=r.y&&i.x<r.x+r.w&&i.y<r.y+r.h);if(r)panelBox.querySelector(`[data-state="${r.state}"]`)?.scrollIntoView({block:'nearest'});return false;},cursor:()=>'default'};
 // ---------------------------------------------------------------- list
 function list(){
  const s=W.S(),box=h('div.ui-list',{role:'listbox','aria-label':t('ui.list.buttons')});
  const all=Object.values(s.buttons||{});
  if(!all.length)box.append(h('p.st-muted.st-pad',{},t('ui.states.none')));
  for(const b of all){const on=b.id===W.sel.button;const row=h('div.ui-row',{role:'option','aria-selected':String(on),tabindex:on?'0':'-1','data-button':b.id},h('span.ui-row-name',{},b.name),h('small',{},t('ui.states.count',{n:Object.keys(b.states).length})));
   const del=h('button.st-icon-btn',{type:'button','aria-label':t('ui.states.remove',{name:b.name}),title:t('ui.states.remove',{name:b.name})},'×');
   del.addEventListener('click',ev=>{ev.stopPropagation();W.edit(t('ui.cmd.removeButton',{name:b.name}),st=>U.removeButton(st,b.id));});row.append(del);
   row.addEventListener('click',()=>W.select('button',b.id));box.append(row);}
  const acts=h('div.ui-actions',{});
  const e=W.element();
  if(e){const nb=h('button.st-btn',{type:'button','data-action':'new-button'},t('ui.states.fromElement',{name:e.name}));
   nb.addEventListener('click',()=>{const b=U.newButton(W.S(),{normal:e.id});W.edit(t('ui.cmd.newButton'),st=>U.putButton(st,b));W.select('button',b.id);});acts.append(nb);}
  else acts.append(h('small.st-muted',{},t('ui.states.needElement')));
  // images whose names say they are states of one button (buttonLong_blue + buttonLong_blue_pressed)
  for(const g of U.suggestButtons(s)){const base=s.elements[g.normal];
   const b=h('button.st-btn',{type:'button','data-action':'suggested-button',title:t('ui.states.suggestHint')},t('ui.states.suggest',{name:base.name,states:Object.keys(g.states).map(k=>t('ui.state.'+k)).join(', ')}));
   b.addEventListener('click',()=>{let nb=U.newButton(W.S(),{normal:g.normal,generate:true});for(const [k,id] of Object.entries(g.states))nb={...nb,states:{...nb.states,[k]:{element:id}}};W.edit(t('ui.cmd.newButton'),st=>U.putButton(st,nb));W.select('button',nb.id);});
   acts.append(b);}
  return h('div',{},box,acts);
 }
 // ---------------------------------------------------------------- states panel
 const panelBox=h('div.ui-states',{});
 function renderPanel(){
  const b=btn();if(!b){panelBox.replaceChildren(h('p.st-muted.st-pad',{},t('ui.states.pick')));return;}
  const els=U.elementsOf(U.pruneForAssets(W.S(),ctx.doc.assets.map(a=>a.id)));
  const setState=(st,v,key=null)=>W.edit(t('ui.cmd.state',{state:t('ui.state.'+st)}),s=>U.setButtonState(s,b.id,st,v),{mergeKey:key});
  const rows=U.STATE_NAMES.map(st=>{
   const v=b.states[st],img=images.get(st);
   const src=h('select',{'data-state-source':st,'aria-label':t('ui.states.source',{state:t('ui.state.'+st)})},
    ...(st==='normal'?[]:[h('option',{value:'',selected:!v},t('ui.states.none1'))]),
    ...(st==='normal'?[]:U.STATE_NAMES.filter(x=>x!==st).map(x=>h('option',{value:'gen:'+x,selected:v?.from===x&&!v.element},t('ui.states.genFrom',{state:t('ui.state.'+x)})))),
    ...els.map(e=>h('option',{value:'el:'+e.id,selected:v?.element===e.id},e.name)));
   src.addEventListener('change',()=>{const x=src.value;if(!x)return setState(st,null);if(x.startsWith('el:'))return setState(st,{element:x.slice(3)});const from=x.slice(4);setState(st,{from,ops:{...(v?.ops||U.DEFAULT_STATE_OPS[st]||{})}});});
   const parts=[h('div.ui-state-head',{},h('b',{},t('ui.state.'+st)),src)];
   if(v&&!v.element){
    const ops=v.ops||{};
    const opRow=([k,min,max,step])=>{const inp=h('input.st-input.st-num',{type:'number',min:String(min),max:String(max),step:String(step),value:String(ops[k]??0),'data-op':k,'aria-label':t('ui.op.'+k)});
     inp.addEventListener('change',()=>{const n=Number(inp.value);if(!Number.isFinite(n))return;setState(st,{...v,ops:{...ops,[k]:Math.max(min,Math.min(max,n))}},'op-'+st+k);});
     return h('label.st-field',{},h('span',{},t('ui.op.'+k)),inp);};
    const col=(k,label)=>{const inp=h('input',{type:'color',value:ops[k]||'#3182f6','data-op':k,'aria-label':label});inp.addEventListener('change',()=>setState(st,{...v,ops:{...ops,[k]:inp.value}},'op-'+st+k));return h('label.st-field',{},h('span',{},label),inp);};
    const ov=h('input.st-input.st-num',{type:'number',min:'0',max:'1',step:'.05',value:String(ops.overlayAlpha||0),'data-op':'overlayAlpha','aria-label':t('ui.op.overlayAlpha')});
    ov.addEventListener('change',()=>setState(st,{...v,ops:{...ops,overlayAlpha:Math.max(0,Math.min(1,+ov.value||0)),overlayColor:ops.overlayColor||'#ffffff'}},'op-'+st+'ov'));
    parts.push(h('div.ui-ops',{},...OPS.map(opRow),col('outlineColor',t('ui.op.outlineColor')),col('overlayColor',t('ui.op.overlayColor')),h('label.st-field',{},h('span',{},t('ui.op.overlayAlpha')),ov)));
   }
   if(img)parts.push(h('small.st-muted',{'data-state-info':st},[`${img.w}×${img.h}`,img.nine?t('ui.states.borders',{l:img.nine.border.left,r:img.nine.border.right,t:img.nine.border.top,b:img.nine.border.bottom}):t('ui.states.noBorders'),img.applied?.length?img.applied.join(', '):'',img.pad?t('ui.states.grown',{n:img.pad}):''].filter(Boolean).join(' · ')));
   if(v?.element&&img&&!img.nine)parts.push(h('small.ui-warn',{},t('ui.states.ownNoNine')));
   return h('div.ui-state',{'data-state':st},...parts);
  });
  const name=h('input.st-input',{type:'text',value:b.name,'aria-label':t('ui.states.name'),maxlength:'60'});
  name.addEventListener('change',()=>W.edit(t('ui.cmd.rename'),s=>U.putButton(s,{...b,name:U.uniqueName(Object.values(s.buttons).filter(x=>x.id!==b.id).map(x=>x.name),name.value)})));
  panelBox.replaceChildren(h('label.st-field',{},h('span',{},t('ui.states.name')),name),h('p.ui-note',{},t('ui.states.lead')),...rows);
 }
 // ---------------------------------------------------------------- live button (bottom)
 const liveBox=h('div.ui-live',{});
 function renderLive(){
  const b=btn(),normal=images.get('normal');if(!b||!normal){liveBox.replaceChildren(h('p.st-muted.st-pad',{},t('ui.states.pick')));return;}
  if(!live.w){live.w=Math.max(normal.w,Math.round(normal.w*1.6));live.h=normal.h;}
  const dpr=devicePixelRatio||1;
  const drawState=(st,cv)=>{const img=images.get(st)||normal,sc=live.scale;
   // a generated state may be larger (focus ring): its canvas grows by the same pad on each side
   const pad=img.pad||0,tw=Math.round((live.w+2*pad)*sc),th=Math.round((live.h+2*pad)*sc);
   const plan=N.ninePlan({w:img.w,h:img.h},img.nine||N.normalizeNine({},img.w,img.h),tw,th,{scale:sc});
   cv.width=tw;cv.height=th;cv.style.width=`${tw/dpr}px`;cv.style.height=`${th/dpr}px`;cv.style.margin=`${-pad*sc/dpr}px`;
   const x=cv.getContext('2d');x.putImageData(new ImageData(N.renderPlan(img.data,img.w,img.h,plan),tw,th),0,0);
   const cr=N.contentRect(img.nine||N.normalizeNine({},img.w,img.h),{w:img.w,h:img.h},tw,th,sc);
   x.fillStyle=st==='disabled'?'rgba(255,255,255,.55)':'#fff';x.font=`600 ${Math.max(8,Math.round(Math.min(cr.h*.55,16*sc)))}px system-ui,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(live.label,cr.x+cr.w/2,cr.y+cr.h/2);
   cv.dataset.liveState=st;};
  const main=h('canvas.ui-live-btn',{tabindex:'0','aria-label':t('ui.states.liveLabel')});
  let state=live.disabled?'disabled':'normal';
  const set=st=>{if(live.disabled)st='disabled';else if(live.focus&&st==='normal'&&images.has('focus'))st='focus';state=st;drawState(st,main);};
  main.addEventListener('pointerenter',()=>set('hover'));main.addEventListener('pointerleave',()=>set('normal'));
  main.addEventListener('pointerdown',()=>set('pressed'));main.addEventListener('pointerup',()=>set('hover'));
  main.addEventListener('focus',()=>{live.focus=true;set('normal');});main.addEventListener('blur',()=>{live.focus=false;set('normal');});
  set(state);
  const wIn=h('input.st-input.st-num',{type:'number',min:'1',max:'2048',value:String(live.w),'aria-label':t('ui.preview.customW'),'data-live':'w'}),hIn=h('input.st-input.st-num',{type:'number',min:'1',max:'2048',value:String(live.h),'aria-label':t('ui.preview.customH'),'data-live':'h'});
  wIn.addEventListener('change',()=>{live.w=Math.max(1,Math.min(2048,+wIn.value||1));renderLive();});hIn.addEventListener('change',()=>{live.h=Math.max(1,Math.min(2048,+hIn.value||1));renderLive();});
  const sc=h('select',{'aria-label':t('ui.preview.scales'),'data-live':'scale'},...[1,1.5,2,3].map(v=>h('option',{value:String(v),selected:v===live.scale},`${v}×`)));sc.addEventListener('change',()=>{live.scale=+sc.value;renderLive();});
  const label=h('input.st-input',{type:'text',value:live.label,'aria-label':t('ui.states.labelText'),maxlength:'40'});label.addEventListener('input',()=>{live.label=label.value;set(state);});
  const dis=h('input',{type:'checkbox',checked:live.disabled,'data-live':'disabled'});dis.addEventListener('change',()=>{live.disabled=dis.checked;set('normal');});
  const strip=h('div.ui-live-strip',{},...U.STATE_NAMES.filter(s=>images.has(s)).map(s=>{const c=h('canvas',{});drawState(s,c);return h('figure',{},c,h('figcaption',{},t('ui.state.'+s)));}));
  liveBox.replaceChildren(h('div.ui-preview-bar',{},h('span.ui-inline',{},t('ui.preview.size'),' ',wIn,'×',hIn),sc,h('label.st-field.ui-inline',{},h('span',{},t('ui.states.labelText')),label),h('label.st-check',{},dis,' ',t('ui.state.disabled'))),
   h('div.ui-live-stage',{},main,h('small.st-muted',{},t('ui.states.liveHint'))),strip);
 }
 const kit=kitPanel(W);
 return {
  panels:()=>[{id:'ui-states',title:()=>t('ui.panel.states'),dock:'right',order:15,render(body){body.append(panelBox);}},kit.panel,
   {id:'ui-button-preview',title:()=>t('ui.panel.live'),dock:'bottom',order:5,render(body){body.append(liveBox);}}],
  enter(){ctx.minBottomHeight?.(200);if(!W.sel.button){const b=Object.values(W.S().buttons||{})[0];if(b)W.sel.button=b.id;}refresh();kit.render();},
  leave(){hoverState=null;sheetRects=[];},
  list,tool,draw,present,
  onSelect(kind){if(kind==='button'){live.w=0;refresh();}},
  onAsset(){},
  onDoc(doc,prev){if(W.mode!=='states')return;const a=U.uiState(doc),b=prev&&U.uiState(prev);if(a.buttons!==b?.buttons||a.elements!==b?.elements)refresh();kit.render();},
  onLocale(){renderPanel();renderLive();kit.render();},
  canExport:()=>kit.canExport(),exportNow:()=>kit.exportNow()
 };
}
