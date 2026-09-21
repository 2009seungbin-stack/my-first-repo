/** Carries files from one Nerulio page to the next (home → tool, result → next tool) without
 * any upload: they are parked in this browser's IndexedDB for a moment and deleted as soon as
 * the next page takes them. Anything older than two minutes is discarded unread. */
const DB='nerulio-handoff',STORE='files',KEY='pending',MAX_AGE=120e3;
function open(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE);
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});
export async function stashFiles(files){
 const list=[...files].filter(f=>f instanceof Blob);if(!list.length)return false;
 try{const db=await open(),tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({at:Date.now(),files:list},KEY);await done(tx);db.close();return true;}
 catch{return false;}// Private windows may refuse storage; the next page simply starts empty.
}
export async function takeFiles(){
 try{
  const db=await open(),tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  const record=await new Promise(resolve=>{const r=store.get(KEY);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});
  store.delete(KEY);await done(tx);db.close();
  return record&&Date.now()-record.at<MAX_AGE?record.files.filter(f=>f instanceof Blob):[];
 }catch{return [];}
}
