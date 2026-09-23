/** Tiny DOM helpers for the Studio shell (no framework). */
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** h('button.primary#go',{type:'button',onclick},'Go') — attributes starting with "on" become listeners. */
export function h(tag,attrs={},...children){
 const m=/^([a-z0-9-]+)((?:[.#][\w-]+)*)$/i.exec(tag);if(!m)throw Error('bad tag '+tag);
 const el=document.createElement(m[1]);
 for(const part of m[2].match(/[.#][\w-]+/g)||[])part[0]==='.'?el.classList.add(part.slice(1)):el.id=part.slice(1);
 for(const [k,v]of Object.entries(attrs||{})){
  if(v==null||v===false)continue;
  if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2),v);
  else if(k==='dataset')Object.assign(el.dataset,v);
  else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);
  else if(k==='html')el.innerHTML=v;
  else el.setAttribute(k,v===true?'':String(v));
 }
 for(const c of children.flat(Infinity)){if(c==null||c===false)continue;el.append(c.nodeType?c:document.createTextNode(String(c)));}
 return el;
}
export const $=(s,root=document)=>root.querySelector(s);
export const $$=(s,root=document)=>[...root.querySelectorAll(s)];
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function debounce(fn,ms){let t=0;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
export const fmtBytes=n=>n<1024?`${n} B`:n<1024**2?`${(n/1024).toFixed(0)} KB`:n<1024**3?`${(n/1024**2).toFixed(1)} MB`:`${(n/1024**3).toFixed(2)} GB`;
export const storage={
 get(k,def=null){try{const v=localStorage.getItem(k);return v==null?def:JSON.parse(v);}catch{return def;}},
 set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}
};
