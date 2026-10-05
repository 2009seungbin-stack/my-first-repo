// @ts-check
import {escapeHTML as e} from '../core/report.js';
/** Search is pre-indexed. Keyboard focus remains on the ARIA combobox.
 * @param {HTMLInputElement} input @param {HTMLElement} list
 * @param {ReturnType<typeof import('../core/parser.js').createCatalogIndex>} index
 * @param {(entry:import('../core/types').CatalogEntry)=>void} choose */
export function componentPicker(input,list,index,choose){
 /** @type {import('../core/types').CatalogEntry[]} */
 let entries=[];let active=-1;
 /** @type {string[]} */
 const recent=[];
 const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
 const select=(/** @type {number} */ i)=>{const entry=entries[i];if(!entry)return;input.value=entry.name;choose(entry);recent.unshift(entry.id);close();};
 const highlight=()=>{
  for(const [i,node] of [...list.children].entries())node.setAttribute('aria-selected',String(i===active));
  if(active>=0){input.setAttribute('aria-activedescendant','pf-option-'+active);list.children[active]?.scrollIntoView({block:'nearest'});}
  else input.removeAttribute('aria-activedescendant');
 };
 const update=()=>{
  entries=index.query(input.value);
  if(!input.value)entries.sort((a,b)=>{const ai=recent.indexOf(a.id),bi=recent.indexOf(b.id);return (ai===-1?999:ai)-(bi===-1?999:bi);});
  active=-1;list.innerHTML=entries.map((c,i)=>'<div role="option" id="pf-option-'+i+'" data-option="'+i+'" aria-selected="false"><b>'+e(c.name)+'</b><small>'+e(c.vendor)+' · '+e(c.category)+'</small></div>').join('');
  list.hidden=!entries.length;input.setAttribute('aria-expanded',String(!!entries.length));
 };
 input.addEventListener('input',update);input.addEventListener('focus',update);
 input.addEventListener('blur',close);
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){close();return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();if(list.hidden)update();if(!entries.length)return;
   active=(active+(event.key==='ArrowDown'?1:-1)+entries.length)%entries.length;highlight();
  }else if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();select(active);}
 });
 list.addEventListener('pointerdown',event=>{event.preventDefault();});
 list.addEventListener('click',event=>{
  const target=/** @type {HTMLElement} */(event.target),node=target.closest('[data-option]');
  if(node)select(Number(/** @type {HTMLElement} */(node).dataset.option));
 });
 return {close};
}
