// @ts-check
/** Escaping HTML templates for the SSR renderers. Every interpolated value is escaped unless it is
 * already a SafeHtml (another html`` result or raw()). Arrays are joined; null/undefined/false render
 * nothing, so `${cond&&html`…`}` works. Renderers never build markup by string concatenation. */

export class SafeHtml{constructor(/** @type {string} */ s){this.s=s;}toString(){return this.s;}}
const ESC=/** @type {Record<string,string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'});
/** @param {unknown} v */
export const esc=v=>String(v).replace(/[&<>"']/g,c=>ESC[c]);
/** @param {unknown} v @returns {string} */
function part(v){
 if(v===null||v===undefined||v===false||v==='')return '';
 if(v instanceof SafeHtml)return v.s;
 if(Array.isArray(v))return v.map(part).join('');
 return esc(v);
}
/** @param {TemplateStringsArray} strings @param {...unknown} values */
export function html(strings,...values){
 let out=strings[0];
 for(let i=0;i<values.length;i++)out+=part(values[i])+strings[i+1];
 return new SafeHtml(out);
}
/** Trusted markup (e.g. the safe markdown renderer's output). @param {string} s */
export const raw=s=>new SafeHtml(s);
/** Only http(s) and site-relative URLs reach an href. @param {unknown} u */
export function safeHref(u){
 const s=String(u??'');
 if(s.startsWith('/')&&!s.startsWith('//'))return s;
 try{const x=new URL(s);return x.protocol==='https:'||x.protocol==='http:'?x.href:'#';}catch{return '#';}
}
