// @ts-check
import {validateEnvironment,validateTarget} from './parser.js';
import {normalizeVersion,compareVersions} from './versions.js';
import {resolveCompatibility,createCompatibilityIndex} from './resolver.js';
import {resolveDependencies} from './dependencies.js';
import {COMPONENT_STATUSES,POLICY,VERDICT_RULES} from './policy.js';
import {weakestConfidence} from './evidence.js';
import {recommend} from './recommendations.js';
import {acceptsHost} from './adapter.js';
export const ENGINE_VERSION='1.0.0';
/** @param {import('./types').PreflightEnvironment} input @param {import('./types').PreflightTarget} inputTarget
 * @param {import('./types').CompatibilityDatabase} database @param {import('./types').Adapter} adapter
 * @param {{now?:number,index?:ReturnType<typeof createCompatibilityIndex>}} [options]
 * @returns {import('./types').PreflightResult} */
export function runPreflight(input,inputTarget,database,adapter,options={}){
 const now=options.now??Date.now();if(!Number.isFinite(now))throw Error('Invalid analysis clock');
 const environment=validateEnvironment(input),target=validateTarget(inputTarget);
 if(environment.vertical!==adapter.id)throw Error('Adapter does not match environment');
 if(!acceptsHost(adapter,environment.host.name))throw Error('Host does not match adapter: '+adapter.host);
 environment.components=environment.components.map(adapter.normalizeComponent);
 const index=options.index||createCompatibilityIndex(database);
 const components=resolveDependencies(environment.components.map(c=>resolveCompatibility(c,environment,target,index,adapter,now)));
 const active=components.filter(c=>!c.component.ignored);
 /** @type {import('./types').Reason[]} */
 const warnings=[];
 if(!normalizeVersion(environment.host.version))warnings.push({code:'missingCurrent'});
 if(!normalizeVersion(target.version))warnings.push({code:'invalidTarget'});
 if(normalizeVersion(target.version)?.prerelease)warnings.push({code:'prerelease'});
 if(compareVersions(target.version,environment.host.version)===-1)warnings.push({code:'downgrade'});
 if(!active.length)warnings.push({code:'emptyStack'});
 if(!active.some(c=>c.status!=='NOT_APPLICABLE'))warnings.push({code:'noApplicable'});
 const excluded=components.length-active.length;if(excluded)warnings.push({code:'excluded',args:{count:excluded}});
 const counts=/** @type {import('./types').PreflightResult['counts']} */(Object.fromEntries(COMPONENT_STATUSES.map(s=>[s,0])));
 for(const c of components)counts[c.status]++;
 const matches=VERDICT_RULES.filter(r=>r.test(active,warnings)),rule=matches[0];
 const reasons=[...warnings];
 for(const status of COMPONENT_STATUSES){
  const count=active.filter(c=>c.status===status).length;
  if(count&&status!=='READY'&&status!=='NOT_APPLICABLE')reasons.push({code:'countStatus',args:{count,status}});
 }
 const stale=active.filter(c=>c.stale).length;if(stale)reasons.push({code:'staleCount',args:{count:stale}});
 for(const c of active.filter(c=>c.status==='BLOCKED'||c.unresolvedBreak))reasons.push({code:'blockedComponent',args:{name:c.component.name},detail:c.reasons.map(r=>r.detail).filter(Boolean).join(' ')});
 if(rule.verdict==='READY')reasons.push({code:'allReady',args:{count:active.length}});
 const riskScore=active.length?Math.min(100,Math.round(active.reduce((n,c)=>n+POLICY.riskWeights[c.status]+(c.stale?10:0),0)/active.length)):100;
 return {schemaVersion:1,engineVersion:ENGINE_VERSION,generatedAt:new Date(now).toISOString(),vertical:environment.vertical,
  environment:{...environment,target},target,overallVerdict:rule.verdict,confidence:warnings.length?'LOW':weakestConfidence(active.map(c=>c.confidence)),
  reasons,ruleIds:[rule.id],components,counts,recommendations:recommend(components,adapter,rule.verdict),sample:environment.sample||components.some(c=>c.sample),excluded,
  risk:{score:riskScore,factors:reasons.filter(r=>r.code!=='allReady')}};
}
/** Stable identities allow comparison, even when component display names match.
 * @param {import('./types').PreflightResult} before @param {import('./types').PreflightResult} after */
export function compareTargets(before,after){
 const previous=new Map(before.components.map(c=>[c.component.id,c]));
 return {before:before.overallVerdict,after:after.overallVerdict,
  changes:after.components.flatMap(c=>{const old=previous.get(c.component.id);return !old||old.status!==c.status||JSON.stringify(old.reasons)!==JSON.stringify(c.reasons)?
   [{componentId:c.component.id,name:c.component.name,before:old?.status||'UNKNOWN',after:c.status,reasons:c.reasons}]:[];})};
}
