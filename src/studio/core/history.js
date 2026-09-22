/** Undo/redo for the Studio. Pure: no DOM.
 *
 * Every edit is a command with `do` and `undo`. Most edits are document edits: a pure function
 * `apply(doc) → doc` over an immutable project (structural sharing — unchanged assets, frames and
 * blobs are the same objects), and undo is "give back the previous document". That makes undo exact
 * by construction and a step costs only the arrays the edit copied, never an image (images are
 * content-addressed blobs outside the document).
 *
 * Commands that must touch something outside the document supply their own {do(), undo()}.
 *
 * Merging. A command with `mergeKey` equal to the newest entry's key, issued within `mergeWindow`
 * ms (or at any time while that entry is `open`, i.e. a drag in progress), folds into that entry:
 * one undo step for a whole drag or a burst of arrow-key nudges. A merge that brings the document
 * back to where the entry started removes the entry altogether. */
export class History{
 constructor(doc=null,{limit=300,mergeWindow=1000,now=()=>Date.now()}={}){
  this.limit=limit;this.mergeWindow=mergeWindow;this.now=now;
  this.listeners=new Set();this.reset(doc);
 }
 reset(doc,{saved=true}={}){
  this.doc=doc;this.entries=[];this.index=0;this.savedEntry=saved?null:undefined;this.emit('reset');
 }
 /** `index` = number of applied entries; entries[index-1] is the newest applied one. */
 get canUndo(){return this.index>0;}
 get canRedo(){return this.index<this.entries.length;}
 get top(){return this.index?this.entries[this.index-1]:null;}
 get undoLabel(){return this.top?.label||'';}
 get redoLabel(){return this.canRedo?this.entries[this.index].label:'';}
 /** Unsaved: the newest applied entry is not the one that was current at the last save. */
 get dirty(){return (this.top||null)!==this.savedEntry;}
 markSaved(){this.savedEntry=this.top||null;this.emit('saved');}
 markUnsaved(){this.savedEntry=undefined;this.emit('saved');}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(type,entry=null){for(const fn of this.listeners)fn({type,entry,history:this});}
 /** Run a command. Returns the entry it created or merged into, or null for a no-op. */
 execute(cmd){
  if(!cmd||typeof cmd!=='object')throw Error('A command is required');
  const label=String(cmd.label||'Edit'),time=this.now();
  if(typeof cmd.apply==='function'){
   const before=this.doc,after=cmd.apply(before);
   if(after===undefined)throw Error(`Command "${label}" returned no document`);
   const top=this.top;
   if(cmd.mergeKey&&top&&!this.canRedo&&top.mergeKey===cmd.mergeKey&&top.kind==='doc'&&!top.closed&&(top.open||time-top.time<=this.mergeWindow)){
    this.doc=after;top.after=after;top.time=time;top.label=label;top.open=!!cmd.open;
    if(top.before===after){this.entries.pop();this.index--;this.emit('change',null);return null;}
    this.emit('change',top);return top;
   }
   if(after===before)return null;
   this.doc=after;
   return this.push({kind:'doc',label,before,after,mergeKey:cmd.mergeKey||null,open:!!cmd.open,time,meta:cmd.meta||null});
  }
  if(typeof cmd.do!=='function'||typeof cmd.undo!=='function')throw Error(`Command "${label}" needs apply() or do()/undo()`);
  cmd.do();
  return this.push({kind:'custom',label,cmd,mergeKey:null,open:false,time,meta:cmd.meta||null});
 }
 /** Ends an open (drag) entry so the next command with the same key starts a new step. */
 close(mergeKey){const top=this.top;if(top&&(!mergeKey||top.mergeKey===mergeKey)){top.open=false;top.closed=true;}}
 push(entry){
  this.entries.length=this.index;// a new edit discards the redo branch
  this.entries.push(entry);this.index++;
  if(this.entries.length>this.limit){const drop=this.entries.length-this.limit;this.entries.splice(0,drop);this.index-=drop;}
  this.emit('change',entry);return entry;
 }
 undo(){
  if(!this.canUndo)return false;
  const e=this.entries[--this.index];e.open=false;e.closed=true;
  if(e.kind==='doc')this.doc=e.before;else e.cmd.undo();
  this.emit('undo',e);return true;
 }
 redo(){
  if(!this.canRedo)return false;
  const e=this.entries[this.index++];
  if(e.kind==='doc')this.doc=e.after;else e.cmd.do();
  this.emit('redo',e);return true;
 }
 /** Moves to the state after `n` applied entries (history panel click). */
 jump(n){
  n=Math.max(0,Math.min(this.entries.length,n|0));
  while(this.index>n)if(!this.undo())break;
  while(this.index<n)if(!this.redo())break;
 }
 list(){return this.entries.map((e,i)=>({label:e.label,applied:i<this.index,time:e.time}));}
}
/** A document command. `apply(doc) → doc` must be pure and return `doc` itself for "no change". */
export const edit=(label,apply,opts={})=>({label,apply,...opts});
