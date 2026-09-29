// @ts-check
/** Tiny DOM builder. Text is always set as text (never parsed as HTML), so API data cannot inject
 * markup; styles are set through CSSOM (el.style), which the strict CSP (no 'unsafe-inline') allows. */

/** @typedef {Node|string|number|null|undefined|false|Array<any>} Child */
/**
 * h('button.btn.p',{type:'button',onclick:fn,'aria-label':'…'},'text',child…)
 * attrs: class/className, style (object), dataset (object), on* (listener), hidden/disabled (bool), others as attributes.
 * @param {string} sel @param {Record<string,any>|Child} [attrs] @param {...Child} kids @returns {HTMLElement}
 */
export function h(sel,attrs,...kids){
 const m=/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel);if(!m)throw Error('bad selector '+sel);
 const el=document.createElement(m[1]||'div');
 for(const part of m[2].match(/[.#][\w-]+/g)||[])part[0]==='.'?el.classList.add(part.slice(1)):el.id=part.slice(1);
 if(attrs&&(typeof attrs!=='object'||attrs instanceof Node||Array.isArray(attrs))){kids.unshift(attrs);attrs=null;}
 for(const [k,v] of Object.entries(/** @type {Record<string,any>} */(attrs||{}))){
  if(v===undefined||v===null||v===false)continue;
  if(k==='class'||k==='className')String(v).split(/\s+/).filter(Boolean).forEach(c=>el.classList.add(c));
  else if(k==='style')Object.assign(el.style,v);
  else if(k==='dataset')Object.assign(el.dataset,v);
  else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2),v);
  else if(k==='text')el.textContent=String(v);
  else if(v===true)el.setAttribute(k,'');
  else el.setAttribute(k,String(v));
 }
 append(el,kids);
 return el;
}
/** @param {Node} el @param {Child[]} kids */
export function append(el,kids){
 for(const k of kids.flat(Infinity)){
  if(k===null||k===undefined||k===false)continue;
  el.append(k instanceof Node?k:document.createTextNode(String(k)));
 }
 return el;
}
/** @param {Element} el @param {...Child} kids */
export function replace(el,...kids){el.replaceChildren();append(el,kids);return el;}

const NS='http://www.w3.org/2000/svg';
/** SVG element with attributes. @param {string} tag @param {Record<string,any>} [attrs] @param {...(Node|null|false)} kids */
export function s(tag,attrs={},...kids){
 const el=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null&&v!==false)el.setAttribute(k,String(v));
 for(const k of kids.flat())if(k)el.append(k);
 return el;
}

/** Stroke icons (24×24, currentColor), from the approved mockup. */
const ICONS=/** @type {Record<string,string[]>} */({
 home:['M3 11l9-7 9 7v9H3z','M9 20v-6h6v6'],
 pulse:['M3 12h4l3-7 4 14 3-7h4'],
 flag:['M5 21V4h11l-1.5 4L16 12H5'],
 data:['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18','M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9','M12 12l6-6'],
 people:['M9 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7','M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5','M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2'],
 visitors:['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z','M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6'],
 bell:['M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8','M10 20a2 2 0 0 0 4 0'],
 refresh:['M20 11a8 8 0 1 0-2.3 5.7','M20 4v7h-7'],
 back:['M15 5l-7 7 7 7'],
 gear:['M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6','M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
 alert:['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20','M12 7v6M12 16.5v.5'],
 fingerprint:['M12 11v3a8 8 0 0 1-1.5 4.7','M8 13.5A4 4 0 0 1 12 7a4 4 0 0 1 4 4v1.5a13 13 0 0 1-.9 4.8','M5.2 16.5A8 8 0 0 1 4 12a8 8 0 0 1 14.4-4.8','M20 12v.5a17 17 0 0 1-.5 4','M9.5 20.5c.8-1.2 1.5-2.6 1.9-4'],
 phone:['M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z','M11 18h2'],
 plus:['M12 5v14M5 12h14'],
 external:['M14 4h6v6','M20 4l-9 9','M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
 offline:['M2 2l20 20','M8.5 16.5a5 5 0 0 1 7 0','M5 12.9a10 10 0 0 1 5.2-2.8','M19 12.9a10 10 0 0 0-2-1.4','M1.5 9a15 15 0 0 1 4.6-2.9','M22.5 9A15 15 0 0 0 10.7 5','M12 20h.01'],
 check:['M5 12.5l4.5 4.5L19 7'],
 download:['M12 4v11','M7 10l5 5 5-5','M5 20h14'],
});
/** @param {string} name @param {{size?:number,width?:number,label?:string}} [o] */
export function icon(name,{size=22,width=2,label}={}){
 const el=s('svg',{viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:'currentColor','stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round',...(label?{role:'img','aria-label':label}:{'aria-hidden':'true',focusable:'false'})},...(ICONS[name]||[]).map(d=>s('path',{d})));
 return el;
}
/** The Nerulio mark (brand square + n arch + dot). @param {number} [size] */
export function logo(size=24){
 return s('svg',{viewBox:'0 0 64 64',width:size,height:size,'aria-hidden':'true',focusable:'false'},
  s('rect',{width:64,height:64,rx:18,fill:'#fff'}),s('path',{d:'M21 47V31a11 11 0 0 1 22 0v16',fill:'none',stroke:'#2b62d6','stroke-width':8.5,'stroke-linecap':'round'}),s('circle',{cx:47.5,cy:16.5,r:5,fill:'#8fbaff'}));
}
