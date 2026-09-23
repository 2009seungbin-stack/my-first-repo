/** Modal dialogs built on <dialog>: focus trapping, Escape and inert background come from the
 * platform. Command palette, shortcut sheet, confirm, choose, and a generic info dialog. */
import {h,esc} from './dom.js';
import {icon} from './icons.js';
export function modal(host,{title,body,buttons=[],className='',labelledBy=null,onClose=null}){
 const id='dlg'+Math.random().toString(36).slice(2,8);
 const d=h('dialog.st-dialog'+(className?'.'+className:''),{'aria-labelledby':id+'t'});
 const close=h('button.st-icon-btn.st-dialog-close',{type:'button','aria-label':'×'});close.innerHTML=icon('close');
 const foot=h('div.st-dialog-foot',{});
 d.append(h('div.st-dialog-head',{},h('h2',{id:id+'t'},title),close),h('div.st-dialog-body',{},body),foot);
 let result=null;
 const finish=v=>{result=v;d.close();};
 for(const b of buttons){const el=h('button'+(b.primary?'.st-btn.primary':'.st-btn'),{type:'button','data-value':b.value},b.label);el.addEventListener('click',()=>finish(b.value));foot.append(el);}
 if(!buttons.length)foot.remove();
 close.addEventListener('click',()=>finish(null));
 host.append(d);
 const done=new Promise(resolve=>d.addEventListener('close',()=>{d.remove();onClose?.(result);resolve(result);}));
 d.showModal();
 (d.querySelector('[autofocus]')||foot.querySelector('.primary')||close).focus();
 return {dialog:d,done,close:finish};
}
export function confirmDialog(host,{title,message,ok,cancel,danger=false}){
 return modal(host,{title,body:h('p',{},message),buttons:[{label:cancel,value:false},{label:ok,value:true,primary:true}],className:danger?'is-danger':''}).done.then(v=>v===true);
}
/** Fuzzy-ish command search: every query word must appear in label or id (any order). */
export function matchCommands(list,query){
 const words=query.toLowerCase().split(/\s+/).filter(Boolean);
 if(!words.length)return list;
 return list.map(c=>{const hay=(c.label+' '+c.id+' '+(c.group||'')).toLowerCase();let score=0;for(const w of words){const i=hay.indexOf(w);if(i<0)return null;score+=i===0?3:hay[i-1]===' '?2:1;}return {c,score};})
  .filter(Boolean).sort((a,b)=>b.score-a.score).map(x=>x.c);
}
/** Ctrl+K: type to find any command, Enter to run. `list()` → [{id,label,group,shortcut,disabled}] */
export function commandPalette(host,{t,list,run}){
 const input=h('input.st-input.st-palette-input',{type:'search',autocomplete:'off',spellcheck:'false',placeholder:t('palette.placeholder'),'aria-label':t('palette.title'),role:'combobox','aria-expanded':'true','aria-controls':'stPaletteList',autofocus:true});
 const ul=h('div.st-palette-list#stPaletteList',{role:'listbox','aria-label':t('palette.title')});
 const m=modal(host,{title:t('palette.title'),body:[input,ul],className:'st-palette'});
 let items=[],active=0;
 const render=()=>{
  items=matchCommands(list(),input.value).slice(0,60);active=Math.min(active,Math.max(0,items.length-1));
  ul.replaceChildren(...items.map((c,i)=>{const o=h('div.st-palette-item',{role:'option',id:'pal-'+i,'aria-selected':String(i===active),'aria-disabled':c.disabled?'true':null},h('span',{},c.label),h('small',{},c.groupLabel||''),h('kbd',{},c.shortcut||''));
   o.addEventListener('click',()=>pick(i));o.addEventListener('pointermove',()=>{if(active!==i){active=i;mark();}});return o;}));
  if(!items.length)ul.append(h('div.st-palette-empty',{},t('palette.none')));
  mark();
 };
 const mark=()=>{[...ul.children].forEach((o,i)=>o.setAttribute?.('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant',items.length?'pal-'+active:'');ul.children[active]?.scrollIntoView?.({block:'nearest'});};
 const pick=i=>{const c=items[i];if(!c||c.disabled)return;m.close(null);setTimeout(()=>run(c.id),0);};
 input.addEventListener('input',()=>{active=0;render();});
 input.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(items.length-1,active+1);mark();}
  else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);mark();}
  else if(e.key==='Enter'){e.preventDefault();pick(active);}
  else if(e.key==='Escape'){e.preventDefault();m.close(null);}// a search field would only clear itself
 });
 render();input.focus();
 return m;
}
/** "?" sheet: every command with its keys, plus pointer gestures. groups: [{title, rows:[[label, keys[]]]}] */
export function shortcutSheet(host,{t,groups}){
 const row=([label,keys])=>h('tr',{},h('td',{},label),h('td',{},keys.map((k,i)=>[i?h('span.st-or',{},' / '):'',h('kbd',{},k)])));
 const section=g=>h('section',{},h('h3',{},g.title),h('table',{},h('tbody',{},g.rows.map(row))));
 const body=h('div.st-keys',{},groups.map(section));
 return modal(host,{title:t('keys.title'),body,className:'st-keysheet'});
}
export {esc};
