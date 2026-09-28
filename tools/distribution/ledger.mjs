import {readFile,writeFile,rename,mkdir,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {validCanonical,assertNoSecrets} from './common.mjs';
export const emptyLedger=()=>({schemaVersion:1,entries:[]});
const states=new Set(['candidate','generated','draft','published','failed','pending']);
export function validateLedger(l){
 if(l?.schemaVersion!==1||!Array.isArray(l.entries))throw Error('Invalid distribution ledger');
 const keys=new Set();
 for(const e of l.entries){
  const k=e.platform+e.sourceRoute;
  if(keys.has(k)||e.platform!=='devto'||!states.has(e.status)||!validCanonical(e.sourceCanonical)||new URL(e.sourceCanonical).pathname!==e.sourceRoute)throw Error('Invalid or duplicate ledger entry');
  keys.add(k);
  for(const t of ['createdAt','publishedAt','lastAttemptAt'])if(e[t]!=null&&!Number.isFinite(Date.parse(e[t])))throw Error('Invalid ledger timestamp');
  if(e.status==='published'&&!e.publishedAt)throw Error('Published ledger entry needs a timestamp');
  if(e.externalId!=null&&(!Number.isSafeInteger(e.externalId)||e.externalId<1))throw Error('Invalid external ID');
 }
 assertNoSecrets(l);return l;
}
export async function readLedger(file){try{return validateLedger(JSON.parse(await readFile(file,'utf8')));}catch(e){if(e.code==='ENOENT')return emptyLedger();throw e;}}
export async function saveLedger(file,l){validateLedger(l);await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(l,null,2)+'\n',{mode:0o600});await rename(tmp,file);}
export async function lockLedger(file){await mkdir(path.dirname(file),{recursive:true});const lock=file+'.lock';let h;try{h=await open(lock,'wx');await h.writeFile(String(process.pid));}catch{throw Error('Distribution state is locked; inspect the active process before removing a stale .lock');}return async()=>{await h.close();await unlink(lock);};}
export function entryFor(l,a,now=new Date()){
 let e=l.entries.find(e=>e.sourceRoute===a.sourceRoute&&e.platform==='devto');
 if(!e){e={sourceRoute:a.sourceRoute,sourceCanonical:a.canonical_url,platform:'devto',generatedTitle:a.title,status:'candidate',externalId:null,externalUrl:null,createdAt:now.toISOString(),publishedAt:null,lastAttemptAt:null,error:null,contentHash:a.contentHash,fingerprint:a.fingerprint,topicCluster:a.topicCluster};l.entries.push(e);}
 return e;
}
export function enforceCadence(l,{now=new Date(),force=false,manual=false}={}){
 if(force&&!manual)throw Error('Force requires an operator workflow_dispatch');
 if(l.entries.some(e=>e.uncertain||e.status==='pending'))throw Error('An unresolved attempt must be reconciled before another mutation');
 if(force)return;
 const recent=l.entries.filter(e=>e.publishedAt&&Date.parse(e.publishedAt)>+now-7*864e5);
 if(recent.length>=2)throw Error('Cadence limit: at most two publications per rolling seven days');
 if(recent.some(e=>Date.parse(e.publishedAt)>+now-3*864e5))throw Error('Cadence limit: at least 72 hours between publications');
}
