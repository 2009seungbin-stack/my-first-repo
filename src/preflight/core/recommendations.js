// @ts-check
/** @param {import('./types').CompatibilityResult[]} results @param {import('./types').Adapter} adapter @param {import('./types').Verdict} verdict */
export function recommend(results,adapter,verdict){
 /** @type {import('./types').PreflightRecommendation[]} */
 const list=[{id:'backup',kind:'general',phase:'before',text:adapter.backup,evidence:[]}];
 // Dependency actions first, using an iterative topological walk. Cycles are still emitted once.
 const byId=new Map(results.map(r=>[r.component.id,r])),seen=new Set(),ordered=[];
 for(const r of results){
  const stack=[{r,exit:false}];
  while(stack.length){const node=stack.pop();if(!node)break;
   if(node.exit){ordered.push(node.r);continue;}
   if(seen.has(node.r.component.id))continue;seen.add(node.r.component.id);
   stack.push({r:node.r,exit:true});
   for(const dep of node.r.dependencies){const child=byId.get(dep.componentId);if(child&&!dep.optional)stack.push({r:child,exit:false});}
  }
 }
 for(const r of ordered){
  if(r.component.ignored)continue;
  if(r.status==='UNKNOWN'||r.stale)list.push({id:r.component.id+'-verify',kind:'verify',phase:'before',componentId:r.component.id,
   text:'',reason:{code:r.stale?'verifyStale':'verifyComponent',args:{name:r.component.name}},evidence:r.evidence});
  for(const [i,action] of [...new Set(r.actions)].entries())list.push({id:r.component.id+'-'+i,kind:'evidence',phase:'before',componentId:r.component.id,
   text:action,evidence:r.evidence});
  if(r.status==='BLOCKED'&&!r.actions.length)list.push({id:r.component.id+'-resolve',kind:'verify',phase:'before',componentId:r.component.id,
   text:'',reason:{code:'resolveBlocker',args:{name:r.component.name}},evidence:r.evidence});
 }
 list.push({id:'upgrade',kind:'general',phase:'upgrade',text:'',reason:{code:verdict==='WAIT'||verdict==='BLOCKED'?'holdUpgrade':'upgradeAfterActions'},evidence:[]});
 list.push({id:'verify-output',kind:'general',phase:'after',text:adapter.verify,evidence:[]});
 return list;
}
