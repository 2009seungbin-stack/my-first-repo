/** Page-list arithmetic of the PDF organiser (Merge / Split / Image → PDF). No DOM, no PDF engine:
 * these are the rules a typed page selection and a reversal follow, kept apart so they can be tested. */
/** "1-3, 7, 10-" → sorted, unique 1-based page numbers. Open ends run to the first / last page, a
 * reversed range is read the natural way and an end past the last page stops there; anything that
 * is not a page of this document (0, text, a start past the end) makes the whole entry invalid. */
export function parseSelection(input,count){
 const tokens=String(input??'').replace(/[–—~]/g,'-').replace(/\s*-\s*/g,'-').split(/[\s,;]+/).filter(Boolean),out=new Set();
 if(!tokens.length||!(count>0))return null;
 for(const token of tokens){
  const m=token.match(/^(\d{1,7})?(-)?(\d{1,7})?$/);if(!m||(!m[1]&&!m[3]))return null;
  let a=m[1]?+m[1]:1,b=m[3]?+m[3]:m[2]?count:a;if(a>b)[a,b]=[b,a];
  if(a<1||a>count)return null;
  for(let i=a;i<=Math.min(b,count);i++)out.add(i);
 }
 return [...out].sort((x,y)=>x-y);
}
/** Reverses the picked items in place (their slots stay where they are); with fewer than two
 * picked, the whole list is reversed. Returns a new array. */
export function reverseOrder(list,picked=()=>false){
 const slots=list.map((p,i)=>picked(p)?i:-1).filter(i=>i>=0),use=slots.length>1?slots:list.map((_,i)=>i),values=use.map(i=>list[i]).reverse(),out=list.slice();
 use.forEach((i,k)=>{out[i]=values[k];});return out;
}
