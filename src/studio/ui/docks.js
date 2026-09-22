/** Panels and docks. A panel is registered once and lives in one dock:
 *   right   stacked, each collapsible (Aseprite/TexturePacker inspector column)
 *   bottom  tabbed strip under the canvas (reserved for the timeline)
 *   sheet   compact layout (phones): every panel as a tab in a bottom sheet
 * Where each panel sits, collapsed state, order and dock sizes are remembered per browser.
 * panel def: {id, title:()=>string, dock:'right'|'bottom', order, render(body, api), badge?:()=>string} */
import {h,clamp,storage} from './dom.js';
import {icon} from './icons.js';
export const LAYOUT_KEY='nerulio.studio.layout.v1';
export const DEFAULT_LAYOUT=Object.freeze({v:1,rightWidth:296,bottomHeight:124,rightOpen:true,bottomOpen:true,panels:{},activeBottom:'',activeSheet:''});
export class Docks{
 constructor({right,bottom,sheet,rightSplit,bottomSplit,menus,t,onChange=()=>{}}){
  Object.assign(this,{right,bottom,sheet,rightSplit,bottomSplit,menus,t,onChange});
  this.panels=new Map();this.mode='desktop';
  const saved=storage.get(LAYOUT_KEY);this.layout={...DEFAULT_LAYOUT,...(saved?.v===1?saved:{}),panels:{...(saved?.v===1?saved.panels:{})}};
  this.splitter(rightSplit,'x');this.splitter(bottomSplit,'y');
  this.applySizes();
 }
 save(){storage.set(LAYOUT_KEY,this.layout);this.onChange(this.layout);}
 reset(){this.layout={...DEFAULT_LAYOUT,panels:{}};this.save();this.applySizes();this.place();}
 pref(id){return this.layout.panels[id]||={};}
 dockOf(p){return this.pref(p.id).dock||p.dock||'right';}
 add(def){
  if(this.panels.has(def.id))throw Error(`Panel ${def.id} already exists`);
  const p={order:100,...def};
  const body=h('div.st-panel-body',{id:'panel-'+p.id,role:'region'});
  const toggle=h('button.st-panel-toggle',{type:'button','aria-expanded':'true','aria-controls':body.id},h('span.st-caret',{html:icon('chevron')}),h('span.st-panel-title',{}),h('span.st-badge',{}));
  const more=h('button.st-icon-btn.st-panel-more',{type:'button','aria-haspopup':'menu'});more.innerHTML=icon('more');
  const actions=h('div.st-panel-actions',{});
  const head=h('div.st-panel-head',{},toggle,actions,more);
  p.el=h('section.st-panel',{'data-panel':p.id},head,body);p.head=head;p.body=body;p.toggle=toggle;p.more=more;p.actions=actions;
  toggle.addEventListener('click',()=>this.setCollapsed(p.id,!this.pref(p.id).collapsed));
  more.addEventListener('click',()=>{const r=more.getBoundingClientRect();this.menus.openAt(this.panelMenu(p),r.left,r.bottom,{owner:more});});
  this.panels.set(p.id,p);
  p.render?.(body,{actions});
  this.relabel(p);this.place();
  return p;
 }
 remove(id){const p=this.panels.get(id);if(!p)return;p.destroy?.();p.el.remove();this.panels.delete(id);this.place();}
 panelMenu(p){
  const dock=this.dockOf(p),list=this.list(dock),i=list.indexOf(p);
  return [
   {label:this.t(dock==='right'?'panel.toBottom':'panel.toRight'),run:()=>{this.pref(p.id).dock=dock==='right'?'bottom':'right';this.save();this.place();}},
   {label:this.t('panel.up'),disabled:i<=0,run:()=>this.move(p,-1)},
   {label:this.t('panel.down'),disabled:i<0||i>=list.length-1,run:()=>this.move(p,1)},
   {sep:true},
   {label:this.t(this.pref(p.id).collapsed?'panel.expand':'panel.collapse'),disabled:dock!=='right',run:()=>this.setCollapsed(p.id,!this.pref(p.id).collapsed)},
   {label:this.t('panel.resetLayout'),run:()=>this.reset()}
  ];
 }
 move(p,d){const dock=this.dockOf(p),list=this.list(dock),i=list.indexOf(p),j=i+d;if(j<0||j>=list.length)return;
  list.forEach((x,k)=>{this.pref(x.id).order=k*10;});this.pref(p.id).order=j*10+(d>0?5:-5);this.save();this.place();}
 list(dock){return [...this.panels.values()].filter(p=>this.dockOf(p)===dock).sort((a,b)=>(this.pref(a.id).order??a.order)-(this.pref(b.id).order??b.order));}
 setCollapsed(id,collapsed){this.pref(id).collapsed=!!collapsed;this.save();this.place();}
 show(id){// bring a panel into view: expand it, select its tab, open the sheet on phones
  const p=this.panels.get(id);if(!p)return;
  if(this.mode==='compact'){this.layout.activeSheet=id;this.openSheet(true);}
  else if(this.dockOf(p)==='bottom'){this.layout.activeBottom=id;this.layout.bottomOpen=true;this.applySizes();}
  else{this.pref(id).collapsed=false;this.layout.rightOpen=true;this.applySizes();}
  this.save();this.place();
 }
 setMode(mode){if(mode===this.mode)return;this.mode=mode;this.place();}
 place(){
  if(this.mode==='compact'){this.placeTabs(this.sheet,[...this.list('right'),...this.list('bottom')],'activeSheet',true);this.right.replaceChildren();this.bottom.replaceChildren();return;}
  this.sheet.querySelector('.st-sheet-body')?.replaceChildren();
  const right=this.list('right');
  this.right.replaceChildren(...right.map(p=>{p.head.replaceChildren(p.toggle,p.actions,p.more);p.el.replaceChildren(p.head,p.body);const c=!!this.pref(p.id).collapsed;p.el.classList.toggle('is-collapsed',c);p.toggle.setAttribute('aria-expanded',String(!c));p.body.hidden=c;p.el.classList.remove('is-tab');return p.el;}));
  this.right.classList.toggle('is-empty',!right.length);
  this.placeTabs(this.bottom,this.list('bottom'),'activeBottom',false);
  this.applySizes();
 }
 placeTabs(host,list,key,sheet){
  const body=sheet?host.querySelector('.st-sheet-body'):host;if(!body)return;
  if(!list.length){body.replaceChildren();host.classList.add('is-empty');return;}
  host.classList.remove('is-empty');
  let active=list.find(p=>p.id===this.layout[key])||list[0];
  const tabs=h('div.st-tabs',{role:'tablist'});
  for(const p of list){
   const tab=h('button.st-tab',{type:'button',role:'tab','aria-selected':String(p===active),'aria-controls':p.body.id,tabindex:p===active?'0':'-1'},p.title(),p.badge?h('span.st-badge',{},p.badge()):'');
   tab.addEventListener('click',()=>{this.layout[key]=p.id;if(!sheet)this.layout.bottomOpen=true;this.save();this.place();});
   tab.addEventListener('keydown',e=>{const i=list.indexOf(p);if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const q=list[(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length];this.layout[key]=q.id;this.save();this.place();host.querySelector(`.st-tab[aria-controls="${q.body.id}"]`)?.focus();}});
   tabs.append(tab);
  }
  if(!sheet){
   const collapse=h('button.st-icon-btn.st-dock-collapse',{type:'button','aria-expanded':String(this.layout.bottomOpen),title:this.t(this.layout.bottomOpen?'panel.hideBottom':'panel.showBottom')});collapse.innerHTML=icon('chevron');
   collapse.addEventListener('click',()=>{this.layout.bottomOpen=!this.layout.bottomOpen;this.save();this.applySizes();collapse.setAttribute('aria-expanded',String(this.layout.bottomOpen));});
   tabs.append(h('span.st-grow',{}),active.actions,active.more,collapse);
  }else tabs.append(h('span.st-grow',{}),active.actions);
  for(const p of list){p.body.hidden=p!==active;p.el.classList.add('is-tab');}
  body.replaceChildren(tabs,active.body);
 }
 openSheet(open){this.sheet.classList.toggle('is-open',!!open);this.sheet.setAttribute('aria-hidden',String(!open));if(open)this.place();}
 applySizes(){
  const L=this.layout,root=this.right.closest('.studio');if(!root)return;
  root.style.setProperty('--right-w',clamp(L.rightWidth,200,Math.max(220,innerWidth*.5))+'px');
  root.style.setProperty('--bottom-h',clamp(L.bottomHeight,64,Math.max(90,innerHeight*.6))+'px');
  root.classList.toggle('right-closed',!L.rightOpen);root.classList.toggle('bottom-closed',!L.bottomOpen||!this.list('bottom').length);
  this.rightSplit.setAttribute('aria-valuenow',String(L.rightWidth));this.bottomSplit.setAttribute('aria-valuenow',String(L.bottomHeight));
 }
 toggleRight(open=!this.layout.rightOpen){this.layout.rightOpen=open;this.save();this.applySizes();}
 toggleBottom(open=!this.layout.bottomOpen){this.layout.bottomOpen=open;this.save();this.applySizes();this.place();}
 splitter(el,axis){
  el.setAttribute('role','separator');el.setAttribute('aria-orientation',axis==='x'?'vertical':'horizontal');el.tabIndex=0;
  const key=axis==='x'?'rightWidth':'bottomHeight',sign=-1;
  el.addEventListener('pointerdown',e=>{
   e.preventDefault();el.setPointerCapture(e.pointerId);const start=axis==='x'?e.clientX:e.clientY,from=this.layout[key];el.classList.add('is-drag');
   const move=ev=>{const d=((axis==='x'?ev.clientX:ev.clientY)-start)*sign;this.layout[key]=Math.round(clamp(from+d,axis==='x'?200:64,axis==='x'?innerWidth*.5:innerHeight*.6));this.applySizes();};
   const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.classList.remove('is-drag');this.save();};
   el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);
  });
  el.addEventListener('dblclick',()=>{this.layout[key]=DEFAULT_LAYOUT[key];this.applySizes();this.save();});
  el.addEventListener('keydown',e=>{const step=e.shiftKey?40:10,d={ArrowLeft:step,ArrowRight:-step,ArrowUp:step,ArrowDown:-step}[e.key];if(d===undefined)return;e.preventDefault();e.stopPropagation();
   this.layout[key]=Math.round(clamp(this.layout[key]+d,axis==='x'?200:64,axis==='x'?innerWidth*.5:innerHeight*.6));this.applySizes();this.save();});
 }
 relabel(p){
  if(!p){for(const x of this.panels.values())this.relabel(x);this.place();return;}
  p.toggle.querySelector('.st-panel-title').textContent=p.title();p.toggle.querySelector('.st-badge').textContent=p.badge?.()||'';
  p.more.setAttribute('aria-label',this.t('panel.options',{name:p.title()}));p.more.title=p.more.getAttribute('aria-label');p.body.setAttribute('aria-label',p.title());
 }
 badge(id){const p=this.panels.get(id);if(!p)return;const b=p.badge?.()||'';p.toggle.querySelector('.st-badge').textContent=b;for(const t of document.querySelectorAll(`.st-tab[aria-controls="${p.body.id}"] .st-badge`))t.textContent=b;}
}
