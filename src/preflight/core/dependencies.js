// @ts-check
import {matchesRange} from './versions.js';
import {moreSevere} from './policy.js';
/** Iterative O(V+E) reverse propagation. No recursive call stack; handles 10,000-node chains.
 * Cycles of ready nodes are allowed. A blocker/unknown inside a cycle propagates to dependants.
 * @param {import('./types').CompatibilityResult[]} results */
export function resolveDependencies(results){
 const byId=new Map(results.map(r=>[r.component.id,r]));
 // Keep original direct sources; recursively copying transitive sources grows quadratically on long pipelines.
 const directSources=new Map(results.map(r=>[r.component.id,r.evidence]));
 /** @type {Map<string,import('./types').CompatibilityResult[]>} */
 const parents=new Map();
 /** @param {import('./types').CompatibilityResult} r @param {import('./types').ComponentStatus} status @param {import('./types').Reason} reason */
 const flag=(r,status,reason)=>{
  const old=r.status;r.status=moreSevere(r.status,status);
  if(!r.reasons.some(x=>x.code===reason.code&&JSON.stringify(x.args)===JSON.stringify(reason.args)))r.reasons.push(reason);
  if(status==='UNKNOWN')r.confidence='LOW';
  return old!==r.status;
 };
 for(const r of results){
  r.dependencies=[...new Map(r.dependencies.map(d=>[d.componentId,d])).values()];
  for(const d of r.dependencies){
   if(d.optional)continue;
   const dependency=byId.get(d.componentId);
   if(!dependency||dependency.component.ignored){
    flag(r,'BLOCKED',{code:'missingDependency',args:{name:d.componentId}});continue;
   }
   parents.set(d.componentId,[...(parents.get(d.componentId)||[]),r]);
   if(d.versionRange){
    const match=matchesRange(dependency.component.version||'',d.versionRange);
    if(match!==true)flag(r,match===null?'UNKNOWN':'BLOCKED',{code:'dependencyVersion',args:{name:dependency.component.name,range:d.versionRange}});
   }
  }
 }
 const queue=[...results],queued=new Set(results.map(r=>r.component.id));
 for(let i=0;i<queue.length;i++){
  const dep=queue[i];queued.delete(dep.component.id);
  const status=dep.status==='BLOCKED'?'BLOCKED':dep.status==='UNKNOWN'?'UNKNOWN':['UPDATE_REQUIRED','CAUTION','LEGACY','DEPRECATED'].includes(dep.status)||dep.stale?'CAUTION':null;
  for(const parent of parents.get(dep.component.id)||[]){
   // Evidence for a propagated conclusion stays visible in the dependant row.
   parent.evidence=[...new Map([...parent.evidence,...(directSources.get(dep.component.id)||[])].map(e=>[e.title+'|'+e.url,e])).values()];
   const previous=[parent.hardBlocker,parent.unresolvedBreak,parent.confidence,parent.stale,parent.ageDays].join('|');
   const changed=status?flag(parent,status,{code:'dependencyStatus',args:{name:dep.component.name,status:dep.status}}):false;
   parent.hardBlocker ||= dep.hardBlocker;
   parent.unresolvedBreak ||= dep.unresolvedBreak;
   if(dep.confidence==='LOW')parent.confidence='LOW';else if(dep.confidence==='MEDIUM'&&parent.confidence==='HIGH')parent.confidence='MEDIUM';
   if(dep.stale)parent.stale=true;
   if(parent.ageDays!==null&&dep.ageDays!==null&&dep.ageDays>parent.ageDays){parent.ageDays=dep.ageDays;parent.lastVerifiedAt=dep.lastVerifiedAt;}
   if((changed||previous!==[parent.hardBlocker,parent.unresolvedBreak,parent.confidence,parent.stale,parent.ageDays].join('|'))&&!queued.has(parent.component.id)){queue.push(parent);queued.add(parent.component.id);}
  }
 }
 for(const r of results)r.dependencyResults=r.dependencies.map(d=>({componentId:d.componentId,status:byId.get(d.componentId)?.status||'MISSING'}));
 return results;
}
