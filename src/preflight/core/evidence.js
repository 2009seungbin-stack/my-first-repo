// @ts-check
import {POLICY} from './policy.js';
/** @param {import('./types').CompatibilityEvidence} e @param {boolean} sample @param {number} now */
export function validEvidence(e,sample,now){
 if(!e||!Object.hasOwn(POLICY.evidenceRank,e.sourceType)||!e.title||!e.quoteSummary)return false;
 const date=Date.parse(e.checkedAt);if(!Number.isFinite(date)||date>now)return false;
 if(e.sourceType==='sample')return sample;
 try{const u=new URL(e.url||'');return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
}
/** @param {import('./types').CompatibilityEvidence[]} evidence @param {number} now @param {string|null} lastVerifiedAt @param {boolean} sample */
export function resolveEvidence(evidence,now,lastVerifiedAt,sample){
 const valid=evidence.filter(e=>validEvidence(e,sample,now));
 // A fresh source cannot mask an old compatibility verification, nor vice versa.
 const dates=[...valid.map(e=>Date.parse(e.checkedAt)),...(lastVerifiedAt?[Date.parse(lastVerifiedAt)]:[])];
 const verified=dates.length&&dates.every(n=>Number.isFinite(n)&&n<=now)?Math.min(...dates):null;
 const ageDays=verified===null?null:Math.floor((now-verified)/86400000);
 const stale=ageDays===null||ageDays>POLICY.staleAfterDays;
 const rank=Math.max(0,...valid.map(e=>POLICY.evidenceRank[e.sourceType]));
 /** @type {import('./types').Confidence} */
 const confidence=sample||stale||rank<4?'LOW':rank>=6?'HIGH':'MEDIUM';
 return {evidence:valid,confidence,lastVerifiedAt:verified===null?null:new Date(verified).toISOString().slice(0,10),ageDays,stale};
}
/** @param {import('./types').Confidence[]} levels */
export function weakestConfidence(levels){
 if(!levels.length||levels.includes('LOW'))return 'LOW';
 return levels.includes('MEDIUM')?'MEDIUM':'HIGH';
}
