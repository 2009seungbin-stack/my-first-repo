/** Quiet remaining-count notes (accounts on only). Nothing is shown while more than LOW_AT free
 * Studio exports are left; from LOW_AT down a small line appears under each workspace's main
 * export button and follows it through panel re-renders. No toast, no badge in the chrome. */
import {current,onChange,load} from '../../entitlement.js';
import {LOW_AT} from './meter.js';
import {mt} from './strings.js';
/** The main export button of each metered workspace → its Studio action id. (Pack & Export's
 * per-format list shares the main button's count; one note under the main button is enough.) */
export const METERED_BUTTONS=Object.freeze({'[data-export-main]':'studio-pack-export','[data-action="tile-export"]':'studio-tile-export','[data-action="tex-export"]':'studio-texture-export'});
/** Free Studio exports left today, or null when unknown / unlimited. */
export function studioRemaining(){
 const u=current().me?.studioUsage;
 return u&&!u.unlimited&&Number.isFinite(u.remaining)?u.remaining:null;
}
/** The signed-in limit when this identity is anonymous and a free sign-in would unlock more. */
export function signInUnlocks(){const u=current().me?.studioUsage;return u&&!u.unlimited&&u.signInLimit?u.signInLimit:0;}
/** Anonymous identities see the note only from the last export without an account (never on
 * first use); signed-in Free users from LOW_AT down. */
export function noteText(l,n,unlock){
 if(unlock)return n>1?null:n===1?mt(l,'meter.anonLeft',{n,s:unlock}):mt(l,'meter.anonNone');
 return n>LOW_AT?null:n>0?mt(l,'meter.left',{n}):mt(l,'meter.none');
}
export function startRemainingNotes(root,locale){
 const selector=Object.keys(METERED_BUTTONS).join(',');
 let scheduled=false;
 const decorate=()=>{
  scheduled=false;
  const n=studioRemaining(),l=locale(),text=n==null?null:noteText(l,n,signInUnlocks()),show=text!=null;
  for(const b of root.querySelectorAll(selector)){
   let note=b.nextElementSibling?.classList.contains('st-meter-left')?b.nextElementSibling:null;
   if(!show){note?.remove();continue;}
   if(!note){note=document.createElement('small');note.className='st-meter-left';note.setAttribute('role','status');b.after(note);}
   if(note.textContent!==text)note.textContent=text;
   const unlock=signInUnlocks();note.classList.toggle('is-out',n===0&&!unlock);note.classList.toggle('is-signin',!!unlock);note.title=mt(l,'meter.leftTitle');note.dataset.remaining=String(n);
  }
 };
 const later=()=>{if(!scheduled){scheduled=true;queueMicrotask(decorate);}};
 // Panels re-render their buttons: re-attach after changes that add elements (cheap: 3 selectors).
 new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.classList.contains('st-meter-left'))))later();}).observe(root,{childList:true,subtree:true});
 new MutationObserver(later).observe(root,{attributes:true,attributeFilter:['lang']});
 onChange(later);
 load().then(later,()=>{});
 return later;
}
