/** Which frames the user has selected, shared between workspaces (the Sprite timeline and the Pack
 * stage highlight the same frames). A tiny store outside the document: selecting is not an edit,
 * so it is not undoable and not saved. Pure JS, no DOM.
 *
 *   setFrameSelection(ids, source)   ids = frame ids; source = who changed it (to ignore own echoes)
 *   getFrameSelection()              → {ids:string[], source}
 *   onFrameSelection(fn) → off()     fn({ids, source}) after every change */
let state={ids:[],source:''};
const listeners=new Set();
export const getFrameSelection=()=>state;
export function setFrameSelection(ids,source=''){
 const next=[...new Set(ids||[])];
 if(next.length===state.ids.length&&next.every((id,i)=>id===state.ids[i]))return;
 state={ids:next,source};
 for(const fn of [...listeners])try{fn(state);}catch(e){console.error(e);}
}
export function onFrameSelection(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
