/** The write form's formatting buttons: Markdown the server's renderer (platform/markdown.js) really
 * understands — **bold**, *italic*, ~~strike~~, `code`, [label](link), > quote, - list, 1. list — applied to
 * the textarea's selection. Pure: text and selection in, text and selection out (islands.js wires the buttons
 * and Ctrl/⌘+B, I, K). A second press on the same selection takes the formatting off again. */

const WRAP=/** @type {Record<string,string>} */({bold:'**',italic:'*',strike:'~~',code:'`'});
const LINE=/** @type {Record<string,RegExp>} */({quote:/^> ?/,ul:/^\s*[-*]\s+/,ol:/^\s*\d+[.)]\s+/});
export const FORMATS=['bold','italic','strike','code','link','quote','ul','ol'];

/**
 * @param {string} value the textarea's text @param {number} start selection start @param {number} end selection end
 * @param {string} kind one of FORMATS @param {{text?:string,item?:string}} [ph] placeholder words for an empty selection
 * @returns {{value:string,start:number,end:number}} the new text and what to select in it
 */
export function applyFormat(value,start,end,kind,ph={}){
 const v=String(value??'');
 let a=Math.max(0,Math.min(v.length,Math.min(start,end)|0)),b=Math.max(0,Math.min(v.length,Math.max(start,end)|0));
 const sel=v.slice(a,b),text=ph.text||'text',item=ph.item||'item';
 const put=(/** @type {string} */ s,/** @type {number} */ from,/** @type {number} */ to,/** @type {number} */ ss,/** @type {number} */ se)=>({value:v.slice(0,from)+s+v.slice(to),start:from+ss,end:from+se});
 const m=WRAP[kind];
 if(m){
  const n=m.length;
  // Already formatted (markers just outside, or inside, the selection): take them off.
  // A single * that is half of ** is bold, not italic, so it is left alone.
  const lone=(/** @type {number} */ i)=>kind!=='italic'||v.slice(i-1,i)!=='*'&&v.slice(i+1,i+2)!=='*';
  if(sel&&v.slice(a-n,a)===m&&v.slice(b,b+n)===m&&lone(a-n)&&lone(b))return put(sel,a-n,b+n,0,sel.length);
  if(sel.length>2*n&&sel.startsWith(m)&&sel.endsWith(m)&&(kind!=='italic'||!sel.startsWith('**')))return put(sel.slice(n,-n),a,b,0,sel.length-2*n);
  // Inline marks do not cross lines in the renderer: format the first line of a longer selection.
  const nl=sel.indexOf('\n');if(nl>=0){b=a+nl;}
  const inner=v.slice(a,b)||text;
  return put(m+inner+m,a,b,n,n+inner.length);
 }
 if(kind==='link'){
  if(/^https?:\/\/\S+$/.test(sel))return put(`[${text}](${sel})`,a,b,1,1+text.length);
  const nl=sel.indexOf('\n');if(nl>=0)b=a+nl;
  const label=v.slice(a,b)||text,url='https://';
  return put(`[${label}](${url})`,a,b,label.length+3,label.length+3+url.length);
 }
 const re=LINE[kind];
 if(!re)return {value:v,start:a,end:b};
 // Whole lines touched by the selection.
 const from=v.lastIndexOf('\n',a-1)+1,stop=v.indexOf('\n',b>a&&v[b-1]==='\n'?b-1:b),to=stop<0?v.length:stop;
 const lines=v.slice(from,to).split('\n'),filled=lines.filter(x=>x.trim());
 const on=filled.length>0&&filled.every(x=>re.test(x));
 let k=0;
 const out=lines.map(x=>{
  if(on)return x.replace(re,'');
  if(!x.trim()&&lines.length>1)return x;
  const bare=x.replace(LINE.quote,'').replace(LINE.ul,'').replace(LINE.ol,'')||(lines.length===1?item:'');
  return (kind==='quote'?'> ':kind==='ul'?'- ':`${++k}. `)+bare;
 }).join('\n');
 // An empty line got a placeholder: select it so typing replaces it.
 if(!on&&lines.length===1&&!lines[0].trim())return put(out,from,to,out.length-item.length,out.length);
 return put(out,from,to,0,out.length);
}
