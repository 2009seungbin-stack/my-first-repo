/** Carries files from one Nerulio page to the next (home → tool, result → next tool) without
 * any upload: they are parked in this browser's IndexedDB for a moment and deleted as soon as
 * the next page takes them. Anything older than two minutes is discarded unread.
 * An optional small `meta` object (plain JSON: e.g. the frame rectangles Sprite Lab already cut,
 * or which Studio workspace to open) travels with the files; pages that don't read it ignore it. */
const DB='nerulio-handoff',STORE='files',KEY='pending',MAX_AGE=120e3;
function open(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE);
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});
export async function stashFiles(files,meta=null){
 const list=[...files].filter(f=>f instanceof Blob);if(!list.length)return false;
 try{const db=await open(),tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({at:Date.now(),files:list,meta:meta?JSON.parse(JSON.stringify(meta)):null},KEY);await done(tx);db.close();return true;}
 catch{return false;}// Private windows may refuse storage; the next page simply starts empty.
}
/** Files and meta in one read; both empty when nothing (fresh) is waiting. */
export async function takeHandoff(){
 try{
  const db=await open();
  const record=await new Promise(resolve=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});
  const fresh=record&&Date.now()-record.at<MAX_AGE;
  // Copy the bytes out BEFORE deleting the record: in Firefox a Blob read from IndexedDB is backed
  // by the stored entry and later reads of it fail ("The operation was aborted") once it is deleted.
  const files=fresh?await Promise.all(record.files.filter(f=>f instanceof Blob).map(async f=>new File([await f.arrayBuffer()],f.name||'file',{type:f.type,lastModified:f.lastModified||Date.now()}))):[];
  const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(KEY);await done(tx);db.close();
  return fresh?{files,meta:record.meta||null}:{files:[],meta:null};
 }catch{return {files:[],meta:null};}
}
export async function takeFiles(){return (await takeHandoff()).files;}
