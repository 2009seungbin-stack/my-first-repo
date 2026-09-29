// @ts-check
/** The D1 databases the operator scripts write to (tools/platform/collect.mjs, seed-sync.mjs, fx.mjs):
 *   CF_D1_DATABASE_IDS=preview:<id>,prod:<id>   one or more databases; the `label:` part is optional
 *                                                (an unlabelled id is called db1, db2, … by position)
 *   CF_D1_DATABASE_ID=<id>                       back-compat: one database, labelled "default"
 *                                                (ignored when CF_D1_DATABASE_IDS is set)
 * CF_ACCOUNT_ID and CF_API_TOKEN are shared by every target: an account-scoped "D1 Edit" token covers
 * every database of the account.
 * The scripts fetch their sources ONCE, then write the same document into each target one after the
 * other (the Cloudflare API rate limit is per user, so parallel writes would only trade speed for 429s).
 * A failed target is logged and counted and never stops the next one; the script exits 1 at the end. */
import {D1Rest} from './d1-rest.js';

/** @typedef {{label:string,databaseId:string}} D1TargetSpec */
/** @typedef {D1TargetSpec & {db:any}} D1Target */
/** @typedef {Record<string,string|undefined>} Env */

const LABEL=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/;

/**
 * Parse the target list from the environment. Throws on a label without an id, a bad label, or a
 * database or label named twice — before anything is fetched or written.
 * @param {Env} env @returns {D1TargetSpec[]}
 */
export function parseD1Targets(env){
 const list=String(env.CF_D1_DATABASE_IDS||'').trim();
 if(!list){
  const id=String(env.CF_D1_DATABASE_ID||'').trim();
  if(!id)throw Error('no D1 database: set CF_D1_DATABASE_IDS (label:id,…) or CF_D1_DATABASE_ID');
  return [{label:'default',databaseId:id}];
 }
 /** @type {D1TargetSpec[]} */const out=[];
 for(const [i,raw] of list.split(',').map(s=>s.trim()).filter(Boolean).entries()){
  const colon=raw.indexOf(':');
  const label=colon<0?`db${i+1}`:raw.slice(0,colon).trim(),databaseId=colon<0?raw:raw.slice(colon+1).trim();
  if(!LABEL.test(label))throw Error(`CF_D1_DATABASE_IDS: bad label "${label}" (letters, digits, _ . -)`);
  if(!databaseId)throw Error(`CF_D1_DATABASE_IDS: target "${label}" has no database id`);
  if(out.some(t=>t.label===label))throw Error(`CF_D1_DATABASE_IDS: label "${label}" is used twice`);
  if(out.some(t=>t.databaseId===databaseId))throw Error(`CF_D1_DATABASE_IDS: "${label}" names the same database as "${out.find(t=>t.databaseId===databaseId)?.label}"`);
  out.push({label,databaseId});
 }
 if(!out.length)throw Error('CF_D1_DATABASE_IDS has no database id');
 return out;
}

/**
 * One binding per target. `open` defaults to the D1 REST client (CF_ACCOUNT_ID, CF_API_TOKEN);
 * tests pass node:sqlite shims.
 * @param {Env} env @param {(spec:D1TargetSpec,env:Env)=>any} [open] @returns {D1Target[]}
 */
export function openD1Targets(env,open=restTarget){
 return parseD1Targets(env).map(spec=>({...spec,db:open(spec,env)}));
}
/** @param {D1TargetSpec} spec @param {Env} env */
export function restTarget(spec,env){
 return new D1Rest({accountId:env.CF_ACCOUNT_ID||'',databaseId:spec.databaseId,token:env.CF_API_TOKEN||''});
}

/** The binding's running query / rows-written counters (D1Rest, D1Shim). @param {any} db */
export const counters=db=>({queries:Number(db?.queries)||0,rowsWritten:Number(db?.rowsWritten)||0});

/**
 * The one log line per target and run:
 *   d1[prod] steam-store: ok, 3 changes, 812 queries, 41 rows written
 *   d1[prod] steam-store: error D1 REST: …
 * @param {string} label @param {string} name
 * @param {{error?:string|null,changes?:number,queries?:number,rowsWritten?:number}} r
 */
export function targetLine(label,name,r){
 return `d1[${label}] ${name}: ${r.error?'error '+String(r.error).slice(0,200):`ok, ${r.changes||0} changes, ${r.queries||0} queries, ${r.rowsWritten||0} rows written`}`;
}
