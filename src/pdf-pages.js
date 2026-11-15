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
/** Width of a page-number label in Helvetica, in em: digits are .556 wide, space and slash .278. */
export const labelWidth=label=>[...String(label)].reduce((w,ch)=>w+(ch>='0'&&ch<='9'?.556:.278),0);
/** A page number as a text mark for pdf-worker.js. Marks live in the page's own, un-turned frame
 * (fractions from its top-left, the text pivoting on the start of its baseline), so for a page
 * the user turned by `angle` the spot at the bottom of the page as it is displayed is mapped back
 * and the text is counter-turned to read upright. `where`: 'center' | 'left' | 'right'. */
export function pageNumberMark(page,label,where='center'){
 const W=page.logicalW,H=page.logicalH,a=(((page.angle||0)%360)+360)%360,turned=a%180!==0,dw=turned?H:W,dh=turned?W:H;
 const size=Math.round(Math.min(24,Math.max(8,Math.min(dw,dh)*.018))),margin=size*2.4,tw=labelWidth(label)*size;
 const dx=where==='right'?dw-margin-tw:where==='left'?margin:(dw-tw)/2,dy=dh-margin;
 const [ux,uy]=a===90?[dy,H-dx]:a===180?[W-dx,H-dy]:a===270?[W-dy,dx]:[dx,dy];
 return {type:'text',auto:'number',text:String(label),size,color:'#333333',angle:(360-a)%360,x:ux/W,y:(uy-size*.85)/H};
}
