// @ts-check
/** Shared admin UI pieces (n2 vocabulary from the approved mockup): boxes, status tags, the
 * "설정 필요" card, empty/error states, the confirm sheet and the toast. */
import {h,icon,append} from './dom.js';
import {needText,VERTICALS,verticalClass} from './labels.js';
import {AdminError,errorText} from './api.js';

/** A card with a header row. @param {string} title @param {any} [extra] @param {...any} body */
export function box(title,extra,...body){
 return h('section.box',title?h('div.bh',h('h2',title),extra?h('span.x',extra):null):null,...body);
}
/** @param {string} tone ok|bad|warn|mute|o|est @param {string} label */
export const st=(tone,label)=>h(`span.st.${tone}`,label);
/** @param {string} v vertical id */
export const vt=v=>VERTICALS[v]?h(`span.vt.${verticalClass(v)||'none'}`,VERTICALS[v]):null;
/** Status dot + a text alternative for screen readers. @param {string} tone @param {string} label */
export const dot=(tone,label)=>h('span.dotw',h(`span.dotc.${tone}`,{'aria-hidden':'true'}),h('span.sr-only',label));

/** "설정 필요": what is missing, in plain Korean, and how to add it. @param {string|null} need @param {string} [fallback] */
export function needCard(need,fallback){
 const t=needText(need,fallback);
 return h('section.box.need',{role:'status','data-need':need||''},
  h('div.need-h',icon('gear',{size:18}),h('b','설정 필요')),
  h('p.need-what',t.what),h('p.fine',t.how),need?h('p.fine','필요한 값: ',h('code.mono',need)):null);
}
/** @param {string} title @param {string} [text] @param {...any} more */
export const empty=(title,text,...more)=>h('div.empty',h('b',title),text?h('span',text):null,...more);

/** An error state for a whole screen or a box; NOT_CONFIGURED becomes the 설정 필요 card.
 * @param {unknown} err @param {(()=>void)|null} [retry] @param {string} [fallbackNeed] */
export function failure(err,retry=null,fallbackNeed){
 if(err instanceof AdminError&&err.code==='NOT_CONFIGURED')return needCard(err.need||fallbackNeed||null);
 const offline=err instanceof AdminError&&err.code==='NETWORK';
 return h('section.box.fail',{role:'alert'},h('div.empty',
  h('b',offline?'오프라인이라 불러오지 못했어요':'불러오지 못했어요'),
  h('span',errorText(err)),
  retry?h('button.btn.sm',{type:'button',onclick:retry},'다시 시도'):null));
}
/** Placeholder rows while a screen loads. @param {number} [n] */
export const skeleton=(n=3)=>h('div.skel',{'aria-busy':'true','aria-label':'불러오는 중'},...Array.from({length:n},()=>h('div.skel-row')));

/** Filter chips (a single-choice group of toggle buttons).
 * @param {{value:string,label:string}[]} opts @param {string} current @param {(v:string)=>void} on @param {string} label */
export function chips(opts,current,on,label){
 return h('div.chips',{role:'group','aria-label':label},...opts.map(o=>h('button.chipf',{type:'button','aria-pressed':String(o.value===current),class:o.value===current?'on':'',onclick:()=>on(o.value)},o.label)));
}
/** Segmented control. @param {{value:string,label:string}[]} opts @param {string} current @param {(v:string)=>void} on @param {string} label */
export function seg(opts,current,on,label){
 return h('div.seg',{role:'group','aria-label':label},...opts.map(o=>h('button',{type:'button','aria-pressed':String(o.value===current),onclick:()=>on(o.value)},o.label)));
}

let toastTimer=0;
/** @param {string} text @param {{action?:{label:string,run:()=>void},ms?:number}} [o] */
export function toast(text,o={}){
 let el=document.getElementById('toast');
 if(!el){el=h('div#toast.toast',{role:'status','aria-live':'polite'});document.body.append(el);}
 el.replaceChildren(h('span',text),o.action?h('button.btn.sm',{type:'button',onclick:()=>{o.action?.run();if(el)el.hidden=true;}},o.action.label):null);
 el.hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>{if(el)el.hidden=true;},o.ms||3200);
}

/**
 * Bottom confirm sheet (a modal <dialog>: focus stays inside, Esc and the scrim cancel).
 * `run` does the action; a failure keeps the sheet open with the server's error text.
 * @param {{title:string,body?:any[],confirm:string,danger?:boolean,
 *  reason?:{label:string,min?:number,max?:number,quick?:readonly string[],value?:string}|null,
 *  choices?:{label:string,options:{value:string,label:string}[],value:string}|null,
 *  run:(input:{reason:string,choice:string})=>Promise<any>}} o
 * @returns {Promise<any>} resolves with run()'s result, or undefined when cancelled
 */
export function confirmSheet(o){
 return new Promise(resolve=>{
  const id='sh'+Math.random().toString(36).slice(2,8);
  const err=h('p.sheet-err',{role:'alert',hidden:true});
  let choice=o.choices?.value||'';
  const choiceRow=o.choices?h('div.chips',{role:'group','aria-label':o.choices.label},...o.choices.options.map(c=>{
   const b=h('button.chipf',{type:'button','aria-pressed':String(c.value===choice),class:c.value===choice?'on':'',onclick:()=>{choice=c.value;for(const x of choiceRow?.querySelectorAll('button')||[]){const on=x===b;x.setAttribute('aria-pressed',String(on));x.classList.toggle('on',on);}}},c.label);return b;})):null;
  const min=o.reason?.min??2,max=o.reason?.max??500;
  const input=o.reason?/** @type {HTMLInputElement} */(h('input',{id:id+'-r',type:'text',value:o.reason.value||'',minlength:min,maxlength:max,autocomplete:'off',enterkeyhint:'done'})):null;
  const reasonField=o.reason&&input?h('div.field',h('label',{for:id+'-r'},o.reason.label),input,
   o.reason.quick?.length?h('div.qr',...o.reason.quick.map(q=>h('button',{type:'button',onclick:()=>{input.value=q;input.focus();}},q))):null):null;
  const cancel=h('button.btn',{type:'button',value:'cancel'},'취소');
  const ok=/** @type {HTMLButtonElement} */(h(`button.btn.${o.danger?'dp':'p'}`,{type:'submit'},o.confirm));
  const form=h('form.sheet',{method:'dialog'},h('span.grab',{'aria-hidden':'true'}),h('h3',{id:id+'-h'},o.title),...(o.body||[]),choiceRow,reasonField,err,h('div.btns',cancel,ok));
  const dlg=/** @type {HTMLDialogElement} */(h('dialog.sheetd',{'aria-labelledby':id+'-h'},form));
  let result;let done=false;
  const close=(/** @type {any} */ v)=>{if(done)return;done=true;dlg.close();dlg.remove();resolve(v);};
  cancel.addEventListener('click',()=>close(undefined));
  dlg.addEventListener('cancel',e=>{e.preventDefault();if(!ok.disabled)close(undefined);});
  dlg.addEventListener('click',e=>{if(e.target===dlg&&!ok.disabled)close(undefined);});   // the backdrop
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   const reason=input?input.value.trim():'';
   if(input&&([...reason].length<min||[...reason].length>max)){err.textContent=`사유를 ${min}~${max}자로 적어 주세요. (처리 기록에 남습니다)`;err.hidden=false;input.focus();return;}
   ok.disabled=true;cancel.setAttribute('disabled','');ok.classList.add('busy');err.hidden=true;
   try{result=await o.run({reason,choice});close(result===undefined?true:result);}
   catch(x){err.textContent=errorText(x);err.hidden=false;ok.disabled=false;cancel.removeAttribute('disabled');ok.classList.remove('busy');}
  });
  document.body.append(dlg);dlg.showModal();
  (input||ok).focus();
 });
}

/** A key/value list. @param {[string,any][]} pairs */
export const kv=pairs=>h('dl.kv',...pairs.filter(p=>p[1]!==null&&p[1]!==undefined&&p[1]!=='').flatMap(([k,v])=>[h('dt',k),h('dd',v)]));
/** @param {HTMLElement} el @param {...any} kids */
export const fill=(el,...kids)=>{el.replaceChildren();append(el,kids);return el;};
