/** Menu bar and popup menus (WAI-ARIA menubar pattern): click or Alt/F10 to enter, arrows to move,
 * Enter/Space to run, Escape to leave. Items come from the command registry, so a menu entry, its
 * shortcut label and the command palette always agree.
 *   item: {command:id} | {sep:true} | {label, submenu:()=>items} | {label, run(), checked?, disabled?, radio?} */
import {h,$$} from './dom.js';
export class Menus{
 constructor({host,resolve,onRun}){
  this.host=host;this.resolve=resolve;this.onRun=onRun;this.stack=[];this.bar=null;this.triggers=[];this.current=null;
  document.addEventListener('pointerdown',e=>{if(this.stack.length&&!e.target.closest('.st-menu,.st-menu-trigger'))this.close();},true);
  addEventListener('blur',()=>this.close());
  addEventListener('resize',()=>this.close());
 }
 /** menus: [{id, title:()=>string, items:()=>item[]}] */
 renderBar(bar,menus){
  this.bar=bar;this.menus=menus;bar.replaceChildren();
  this.triggers=menus.map((m,i)=>{
   const b=h('button.st-menu-trigger',{type:'button',role:'menuitem','aria-haspopup':'menu','aria-expanded':'false',tabindex:i?'-1':'0','data-menu':m.id},m.title());
   b.addEventListener('click',()=>{this.current===m.id?this.close():this.openMenu(m.id,{focus:false});});
   b.addEventListener('pointerenter',()=>{if(this.current&&this.current!==m.id)this.openMenu(m.id,{focus:false});});
   b.addEventListener('keydown',e=>this.barKey(e,i));
   return b;
  });
  bar.append(...this.triggers);
 }
 focusBar(){(this.triggers[0])?.focus();}
 barKey(e,i){
  const n=this.triggers.length,go=j=>{const t=this.triggers[(j+n)%n];this.triggers.forEach(x=>x.tabIndex=-1);t.tabIndex=0;t.focus();if(this.current)this.openMenu(t.dataset.menu,{focus:true});};
  if(e.key==='ArrowRight'){e.preventDefault();go(i+1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();go(i-1);}
  else if(e.key==='ArrowDown'||e.key==='Enter'||e.key===' '){e.preventDefault();this.openMenu(this.menus[i].id,{focus:true});}
  else if(e.key==='Escape'){this.close();e.currentTarget.blur();}
 }
 openMenu(id,{focus}){
  const m=this.menus.find(x=>x.id===id),t=this.triggers.find(x=>x.dataset.menu===id);if(!m||!t)return;
  this.close();this.current=id;t.setAttribute('aria-expanded','true');t.classList.add('is-open');
  const r=t.getBoundingClientRect();this.popup(m.items(),r.left,r.bottom,{focus,level:0,owner:t});
 }
 /** Context/overflow menu at a point (panel ⋯ buttons, compact mode ☰). */
 openAt(items,x,y,{focus=true,owner=null}={}){this.close();this.current='@';this.popup(items,x,y,{focus,level:0,owner});}
 popup(items,x,y,{focus,level,owner}){
  const list=this.resolve(items);
  const ul=h('div.st-menu',{role:'menu','data-level':level});
  const buttons=[];
  for(const it of list){
   if(it.sep){ul.append(h('div.st-menu-sep',{role:'separator'}));continue;}
   const role=it.checked===undefined?'menuitem':it.radio?'menuitemradio':'menuitemcheckbox';
   const b=h('button.st-menu-item',{type:'button',role,tabindex:'-1','aria-disabled':it.disabled?'true':null,'aria-checked':it.checked===undefined?null:String(!!it.checked),'aria-haspopup':it.submenu?'menu':null,'data-command':it.id||null},
    h('span.st-mcheck',{'aria-hidden':'true'},it.checked?'✓':''),h('span.st-menu-label',{},it.label),h('span.st-kbd',{},it.shortcut||''),h('span.st-sub',{'aria-hidden':'true'},it.submenu?'›':''));
   if(it.hint)b.title=it.hint;
   b.addEventListener('click',()=>this.activate(it,b,level));
   b.addEventListener('pointerenter',()=>{b.focus({preventScroll:true});this.closeFrom(level+1);if(it.submenu&&!it.disabled)this.openSub(it,b,level,false);});
   b.addEventListener('keydown',e=>this.itemKey(e,it,b,buttons,level,owner));
   buttons.push(b);ul.append(b);
  }
  this.host.append(ul);
  // keep inside the viewport
  const vw=innerWidth,vh=innerHeight,r=ul.getBoundingClientRect();
  ul.style.left=Math.max(4,Math.min(x,vw-r.width-4))+'px';ul.style.top=Math.max(4,Math.min(y,vh-r.height-4))+'px';
  this.stack.push({ul,owner,buttons});
  if(focus)(buttons.find(b=>b.getAttribute('aria-disabled')!=='true')||buttons[0])?.focus();
 }
 openSub(it,b,level,focus){const r=b.getBoundingClientRect();this.popup(it.submenu(),r.right-2,r.top-4,{focus,level:level+1,owner:b});b.setAttribute('aria-expanded','true');}
 activate(it,b,level){
  if(it.disabled)return;
  if(it.submenu){this.closeFrom(level+1);this.openSub(it,b,level,true);return;}
  const owner=this.stack[0]?.owner;this.close();
  if(owner&&owner.classList.contains('st-menu-trigger'))owner.blur();
  this.onRun(it);
 }
 itemKey(e,it,b,buttons,level,owner){
  const enabled=buttons,i=enabled.indexOf(b),move=d=>{e.preventDefault();enabled[(i+d+enabled.length)%enabled.length].focus();};
  if(e.key==='ArrowDown')move(1);else if(e.key==='ArrowUp')move(-1);
  else if(e.key==='Home'){e.preventDefault();enabled[0].focus();}else if(e.key==='End'){e.preventDefault();enabled.at(-1).focus();}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();this.activate(it,b,level);}
  else if(e.key==='ArrowRight'){e.preventDefault();if(it.submenu&&!it.disabled)this.activate(it,b,level);else if(this.current&&this.current!=='@')this.stepBar(1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();if(level>0){this.closeFrom(level);owner?.focus();}else if(this.current&&this.current!=='@')this.stepBar(-1);}
  else if(e.key==='Escape'){e.preventDefault();if(level>0){this.closeFrom(level);owner?.focus();}else{const o=this.stack[0]?.owner;this.close();o?.focus();}}
  else if(e.key==='Tab'){this.close();}
 }
 stepBar(d){const i=this.triggers.findIndex(t=>t.dataset.menu===this.current),n=this.triggers.length,t=this.triggers[(i+d+n)%n];this.openMenu(t.dataset.menu,{focus:true});}
 closeFrom(level){while(this.stack.length>level){const s=this.stack.pop();s.ul.remove();s.owner?.setAttribute?.('aria-expanded','false');}}
 close(){this.closeFrom(0);for(const t of this.triggers){t.setAttribute('aria-expanded','false');t.classList.remove('is-open');}this.current=null;}
 get isOpen(){return this.stack.length>0;}
 relabel(){this.triggers.forEach((t,i)=>{t.textContent=this.menus[i].title();});}
}
export {$$};
