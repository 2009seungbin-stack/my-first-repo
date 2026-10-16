// @ts-check
export const COMPONENT_STATUSES=Object.freeze(/** @type {import('./types').ComponentStatus[]} */(['READY','UPDATE_REQUIRED','CAUTION','LEGACY','UNKNOWN','BLOCKED','DEPRECATED','NOT_APPLICABLE']));
export const POLICY=Object.freeze({
 staleAfterDays:90,maxComponents:10000,maxImportBytes:5*1024*1024,maxSetups:50,
 evidenceRank:{vendor:7,release_notes:6,repository:5,verified_community:4,community:3,inference:1,sample:0},
 statusPriority:{NOT_APPLICABLE:0,READY:1,CAUTION:2,LEGACY:3,DEPRECATED:4,UPDATE_REQUIRED:5,UNKNOWN:6,BLOCKED:7},
 riskWeights:{NOT_APPLICABLE:0,READY:0,CAUTION:10,LEGACY:15,DEPRECATED:20,UPDATE_REQUIRED:20,UNKNOWN:25,BLOCKED:60},
});
/** @param {import('./types').ComponentStatus} a @param {import('./types').ComponentStatus} b */
export const moreSevere=(a,b)=>POLICY.statusPriority[a]>=POLICY.statusPriority[b]?a:b;
/** Ordered explicit decisions. Risk score does not decide the verdict.
 * @type {{id:string,verdict:import('./types').Verdict,test:(c:import('./types').CompatibilityResult[],warnings:import('./types').Reason[])=>boolean}[]} */
export const VERDICT_RULES=[
 {id:'critical-hard-blocker',verdict:'BLOCKED',test:c=>c.some(x=>x.status==='BLOCKED'&&x.hardBlocker&&x.component.critical)},
 {id:'unresolved-break',verdict:'WAIT',test:c=>c.some(x=>x.unresolvedBreak)},
 {id:'critical-blocker',verdict:'WAIT',test:c=>c.some(x=>x.status==='BLOCKED'&&x.component.critical)},
 {id:'incomplete-or-excluded',verdict:'CAUTION',test:(c,w)=>!c.length||!!w.length},
 {id:'component-action',verdict:'CAUTION',test:c=>c.some(x=>!['READY','NOT_APPLICABLE'].includes(x.status)||x.stale)},
 {id:'verified-stack',verdict:'READY',test:()=>true},
];
