// @ts-check
import {compareVersions,matchesRange,normalizeVersion} from './versions.js';
import {resolveEvidence,validEvidence} from './evidence.js';
import {moreSevere} from './policy.js';
import {hostName} from './adapter.js';
/** @typedef {import('./types').CompatibilityResult} Result */
/** @param {import('./types').CompatibilityDatabase} database */
export function createCompatibilityIndex(database){
 /** @type {Map<string,import('./types').CompatibilityRecord[]>} */
 const records=new Map();
 for(const record of database.records){const list=records.get(record.componentId)||[];list.push(record);records.set(record.componentId,list);}
 return records;
}
/** @param {Result} result @param {import('./types').Finding} f @param {number} now */
export function applyFinding(result,f,now){
 const evidence=f.evidence.filter(e=>validEvidence(e,result.sample,now));
 if(!evidence.length&&f.reason.code!=='inventoryMismatch')return;
 result.status=moreSevere(result.status,f.status);
 // A definite failure takes precedence over uncertainty; a legacy advisory does not assert compatibility.
 if(f.status==='BLOCKED')result.status='BLOCKED';
 result.reasons.push(f.reason);result.evidence.push(...evidence);
 if(f.action)result.actions.push(f.action);
 result.hardBlocker ||= !!f.hard;result.unresolvedBreak ||= !!f.unresolved;
}
/** Compatibility resolution deliberately refuses to extrapolate beyond tested scopes.
 * @param {import('./types').PreflightComponent} c @param {import('./types').PreflightEnvironment} environment
 * @param {import('./types').PreflightTarget} target @param {ReturnType<typeof createCompatibilityIndex>} index
 * @param {import('./types').Adapter} adapter @param {number} now @returns {Result} */
export function resolveCompatibility(c,environment,target,index,adapter,now){
 /** @type {Result} */
 const result={component:c,status:'UNKNOWN',confidence:'LOW',reasons:[],evidence:[],dependencies:c.dependencies||[],
  dependencyResults:[],knownIssues:[],actions:[],lastVerifiedAt:null,ageDays:null,stale:false,
  hardBlocker:false,unresolvedBreak:false,sample:!!c.sample};
 const scoped=(index.get(c.id)||[]).filter(r=>
  r.host.toLowerCase()===hostName(adapter,target.platform).toLowerCase()&&r.sample===!!c.sample&&(!r.sample||environment.sample)&&
  r.platform.includes(target.platform)&&
  (r.architecture.includes(target.architecture)||r.architecture.includes('universal'))&&
  (!r.installationTypes||r.installationTypes.includes(c.installType||'unknown'))&&
  matchesRange(target.version,r.hostVersionRange)===true);
 // An installed component's version range distinguishes records, never silently assume latest.
 const exact=scoped.filter(r=>!r.componentVersionRange||matchesRange(c.version||'',r.componentVersionRange)===true);
 const candidates=exact.length?exact:scoped.filter(r=>r.minimumVersion);
 const statuses=new Set(candidates.map(r=>r.compatibilityStatus));
 const record=candidates.sort((a,b)=>Date.parse(b.lastVerifiedAt)-Date.parse(a.lastVerifiedAt))[0];
 if(record&&statuses.size<=1){
  const ev=resolveEvidence(record.evidence,now,record.lastVerifiedAt,result.sample);
  Object.assign(result,ev);result.stale=!!ev.evidence.length&&ev.stale;
  result.recordId=record.id;result.minimumVersion=record.minimumVersion;result.recommendedVersion=record.recommendedVersion;
  result.maximumTestedVersion=record.maximumTestedVersion;result.knownIssues=[...record.knownIssues];
  result.dependencies=[...result.dependencies,...record.dependencies];
  const verified=ev.evidence.some(e=>e.sourceType!=='inference'&&e.sourceType!=='community');
  if(verified){
   result.status=record.compatibilityStatus;result.reasons.push({code:'record',detail:record.notes});
   if(record.requiredAction)result.actions.push(record.requiredAction);
   result.hardBlocker=!!record.hardBlocker;
   if(record.minimumVersion){
    const cmp=compareVersions(c.version||'',record.minimumVersion);
    if(cmp===null){result.status='UNKNOWN';result.reasons.push({code:'missingComponentVersion'});}
    else if(cmp<0){result.status=moreSevere(result.status,'UPDATE_REQUIRED');result.reasons.push({code:'minimumVersion',args:{version:record.minimumVersion}});}
   }
   if(record.componentVersionRange&&matchesRange(c.version||'',record.componentVersionRange)!==true&&result.status!=='UPDATE_REQUIRED'){
    result.status='UNKNOWN';result.reasons.push({code:'componentRange',args:{range:record.componentVersionRange}});
   }
   applyRequirements(result,record.requirements||{},target);
   if(result.status==='READY'&&record.maximumTestedVersion&&compareVersions(target.version,record.maximumTestedVersion)===1){
    result.status='UNKNOWN';result.reasons.push({code:'beyondTested',args:{version:record.maximumTestedVersion}});
   }
   for(const change of record.breakingChanges){
    if(matchesRange(target.version,change.targetVersionRange)===true){
     applyFinding(result,{status:change.resolution?'CAUTION':'BLOCKED',reason:{code:'breakingChange',detail:change.description},
      evidence:change.evidence,action:change.resolution,hard:change.hard,unresolved:!change.resolution},now);
    }
   }
  }else result.reasons.push({code:'noVerifiedEvidence'});
  if(result.stale)result.reasons.push({code:'stale',args:{days:result.ageDays??'unknown'}});
 }else result.reasons.push({code:statuses.size>1?'conflictingEvidence':'noRecord'});
 if(!normalizeVersion(target.version))result.reasons.push({code:'invalidTarget'});
 // Facts imported by a scanner may establish an inventory mismatch; they are not vendor endorsements.
 if(c.platform&&c.platform!==target.platform)applyFinding(result,{status:'BLOCKED',reason:{code:'inventoryMismatch',args:{field:'OS',required:c.platform,actual:target.platform}},evidence:[],hard:true},now);
 // A verified Rosetta requirement is an explicit exception, not an inferred native match.
 const rosettaAllowed=target.platform==='macos'&&target.architecture==='arm64'&&c.architecture==='x86_64'&&result.reasons.some(r=>r.code==='rosetta');
 if(c.native&&c.architecture&&c.architecture!=='universal'&&c.architecture!==target.architecture&&!rosettaAllowed){
  applyFinding(result,{status:'BLOCKED',reason:{code:'inventoryMismatch',args:{field:'architecture',required:c.architecture,actual:target.architecture}},evidence:[],hard:true},now);
 }
 for(const finding of adapter.inspect?.(c,environment,target)||[])applyFinding(result,finding,now);
 const freshness=resolveEvidence(result.evidence,now,result.lastVerifiedAt,result.sample);
 if(result.evidence.length){result.evidence=freshness.evidence;result.confidence=freshness.confidence;result.lastVerifiedAt=freshness.lastVerifiedAt;result.ageDays=freshness.ageDays;result.stale=freshness.stale;}
 if(result.status==='UNKNOWN')result.confidence='LOW';
 return result;
}
/** Runtime/format/native constraints are common to every adapter.
 * @param {Result} result @param {import('./types').Requirements} req @param {import('./types').PreflightTarget} target */
function applyRequirements(result,req,target){
 /** @param {string} field @param {string|undefined} value @param {string|undefined} range */
 const check=(field,value,range)=>{
  if(!range)return;
  const match=matchesRange(value||'',range);
  if(match===null){result.status=moreSevere(result.status,'UNKNOWN');result.reasons.push({code:'missingRequirement',args:{field,range}});}
  else if(!match){result.status='BLOCKED';result.reasons.push({code:'runtimeRequirement',args:{field,range,actual:value||'?'}});}
 };
 check('OS',target.osVersion,req.os);check('host',target.version,req.host);
 for(const [name,range] of Object.entries(req.runtimes||{}))check(name,target.runtimes?.[name],range);
 const choices=/** @type {[string,string[]|undefined,string|undefined][]} */([['renderer',req.renderer,target.renderer],['language',req.language,target.language],['DAW',req.daw,target.daw]]);
 for(const [field,values,value] of choices){
  if(!Array.isArray(values)||!values.length)continue;
  if(!value){result.status=moreSevere(result.status,'UNKNOWN');result.reasons.push({code:'missingRequirement',args:{field:String(field),range:values.join(', ')}});}
  else if(!values.some(v=>v.toLowerCase()===value.toLowerCase())){result.status='BLOCKED';result.reasons.push({code:'runtimeRequirement',args:{field:String(field),range:values.join(', '),actual:String(value)}});}
 }
 if(req.formats?.length){
  if(!target.formats?.length){result.status=moreSevere(result.status,'UNKNOWN');result.reasons.push({code:'missingRequirement',args:{field:'plugin format',range:req.formats.join(', ')}});}
  else if(!req.formats.some(f=>target.formats?.includes(f))){result.status='BLOCKED';result.reasons.push({code:'runtimeRequirement',args:{field:'plugin format',range:req.formats.join(', '),actual:target.formats.join(', ')}});}
 }
 if(req.nativeMode==='rosetta'&&target.architecture==='arm64'&&target.platform==='macos'){
  result.status=moreSevere(result.status,'CAUTION');result.reasons.push({code:'rosetta'});
 }
 if(req.nativeMode==='intel'&&target.architecture==='arm64'){
  result.status='BLOCKED';result.reasons.push({code:'intelOnly'});result.hardBlocker=true;
 }
 if(result.status==='BLOCKED')result.actions.push('Verify the supported runtime, host and binary requirements with the vendor before changing the stack.');
}
