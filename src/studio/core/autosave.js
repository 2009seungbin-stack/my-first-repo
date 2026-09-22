/** Autosave and recovery in IndexedDB ('nerulio-studio').
 *
 * Stores
 *   blobs      id (sha-256) → {id, blob, width, height}      each image ONCE, whatever the snapshot count
 *   snapshots  auto key → {projectId, name, at, formatVersion, doc, ui, fileSaved, fileName}
 *   session    'current' → {projectId, key, at}                 what to offer on the next open
 * A snapshot holds only the document JSON (a few KB) plus UI state (active asset, per-asset view).
 * Saves are debounced; the last `keep` snapshots per project are kept for "Autosaved versions";
 * blobs no snapshot references are deleted after each save. */
import {referencedBlobs,migrate,normalizeProject} from './project.js';
export const DB_NAME='nerulio-studio',DB_VERSION=1,SNAPSHOT_FORMAT=1;
function openDB(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB_NAME,DB_VERSION);
  r.onupgradeneeded=()=>{const db=r.result;
   if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs',{keyPath:'id'});
   if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{autoIncrement:true}).createIndex('project','projectId');
   if(!db.objectStoreNames.contains('session'))db.createObjectStore('session');};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('IndexedDB blocked'));
 });
}
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Transaction aborted'));});
export class Autosave{
 /** @param source () => {doc, ui, fileSaved, fileName} — what to save right now */
 constructor({images,source,delay=1200,keep=10,onState=()=>{}}){
  Object.assign(this,{images,source,delay,keep,onState});this.timer=0;this.pending=false;this.saving=null;this.db=null;this.persisted=new Set();this.lastDoc=null;this.lastUI='';this.error=null;this.lastAt=0;
 }
 async open(){if(!this.db)this.db=await openDB();return this.db;}
 /** Something changed: save after `delay` ms of quiet (a drag produces one save, not 60). */
 schedule(){this.pending=true;this.onState('pending');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),this.delay);}
 get dirty(){return this.pending||!!this.saving;}
 async flush(){
  clearTimeout(this.timer);
  if(this.saving){await this.saving;if(!this.pending)return;}
  if(!this.pending)return;
  this.pending=false;
  this.saving=this.write().then(()=>{this.error=null;this.lastAt=Date.now();this.onState('saved');},e=>{this.error=e;this.onState('error',e);}).finally(()=>{this.saving=null;});
  return this.saving;
 }
 async write(){
  const {doc,ui,fileSaved=false,fileName=''}=this.source();if(!doc)return;
  const uiText=JSON.stringify(ui||{});
  if(doc===this.lastDoc&&uiText===this.lastUI)return;// nothing new since the last snapshot
  const db=await this.open(),ids=[...referencedBlobs(doc)];
  // 1. images first, each once: a snapshot must never point at a blob that is not stored yet
  const missing=ids.filter(id=>!this.persisted.has(id));
  if(missing.length){
   const known=await Promise.all(missing.map(id=>req(db.transaction('blobs').objectStore('blobs').getKey(id))));
   const tx=db.transaction('blobs','readwrite'),st=tx.objectStore('blobs');
   missing.forEach((id,i)=>{if(known[i]===undefined){const r=this.images.get(id);if(!r)throw Error(`Image ${id.slice(0,8)} missing in memory`);st.put({id,blob:r.blob,width:r.width,height:r.height});}});
   await done(tx);for(const id of missing)this.persisted.add(id);
  }
  // 2. the snapshot + session pointer in one transaction
  const tx=db.transaction(['snapshots','session'],'readwrite'),at=Date.now();
  const key=await req(tx.objectStore('snapshots').add({projectId:doc.id,name:doc.name,at,formatVersion:SNAPSHOT_FORMAT,doc,ui:ui||{},fileSaved,fileName}));
  tx.objectStore('session').put({projectId:doc.id,key,at},'current');await done(tx);
  this.lastDoc=doc;this.lastUI=uiText;
  await this.prune(doc.id);
 }
 /** Keep the newest `keep` snapshots of this project, then drop blobs nothing references. */
 async prune(projectId){
  const db=await this.open(),tx=db.transaction(['snapshots','blobs'],'readwrite'),snaps=tx.objectStore('snapshots');
  const keys=await req(snaps.index('project').getAllKeys(projectId));
  for(const k of keys.sort((a,b)=>a-b).slice(0,Math.max(0,keys.length-this.keep)))snaps.delete(k);
  await done(tx);
  const all=await req(db.transaction('snapshots').objectStore('snapshots').getAll()),live=new Set();
  for(const s of all)for(const id of referencedBlobs(s.doc))live.add(id);
  const blobKeys=await req(db.transaction('blobs').objectStore('blobs').getAllKeys()),dead=blobKeys.filter(k=>!live.has(k));
  if(dead.length){const t=db.transaction('blobs','readwrite');for(const k of dead){t.objectStore('blobs').delete(k);this.persisted.delete(k);}await done(t);}
 }
 async session(){try{const db=await this.open();return await req(db.transaction('session').objectStore('session').get('current'))||null;}catch{return null;}}
 async clearSession(){const db=await this.open(),tx=db.transaction('session','readwrite');tx.objectStore('session').delete('current');await done(tx);}
 async list(projectId=null){
  const db=await this.open(),st=db.transaction('snapshots').objectStore('snapshots');
  const keys=await req(projectId?st.index('project').getAllKeys(projectId):st.getAllKeys());
  const out=[];for(const key of keys){const s=await req(db.transaction('snapshots').objectStore('snapshots').get(key));if(s)out.push({key,projectId:s.projectId,name:s.name,at:s.at,assets:s.doc.assets.length,frames:s.doc.assets.reduce((n,a)=>n+a.frames.length,0),fileSaved:s.fileSaved});}
  return out.sort((a,b)=>b.at-a.at);
 }
 /** A snapshot with its images loaded into the ImageStore. */
 async load(key){
  const db=await this.open(),s=await req(db.transaction('snapshots').objectStore('snapshots').get(key));
  if(!s)throw Error('Snapshot not found');
  if(s.formatVersion>SNAPSHOT_FORMAT)throw Error('Snapshot from a newer Studio');
  const doc=normalizeProject(migrate(s.doc));
  for(const id of referencedBlobs(doc)){
   const b=await req(db.transaction('blobs').objectStore('blobs').get(id));
   if(!b)throw Error(`Autosave is missing image ${id.slice(0,8)}…`);
   await this.images.put(b.blob,{id,width:b.width,height:b.height,persisted:true});this.persisted.add(id);
  }
  this.lastDoc=doc;this.lastUI=JSON.stringify(s.ui||{});
  return {doc,ui:s.ui||{},at:s.at,fileSaved:!!s.fileSaved,fileName:s.fileName||''};
 }
 /** Storage estimate for the status bar / About. */
 async usage(){try{return await navigator.storage?.estimate?.()||null;}catch{return null;}}
}
