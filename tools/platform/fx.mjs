#!/usr/bin/env node
/** Daily reference rate for "≈ ₩" next to USD prices: the ECB euro foreign exchange reference rates
 * (free, no key, published around 16:00 CET on working days). KRW per USD = (KRW per EUR) / (USD per EUR).
 *   node tools/platform/fx.mjs            → prints the rate
 *   node tools/platform/fx.mjs --d1       → writes fx_rates in D1 (CF_ACCOUNT_ID, CF_API_TOKEN, and
 *                                            CF_D1_DATABASE_IDS=preview:<id>,prod:<id> or CF_D1_DATABASE_ID)
 * Every run is recorded as collector "ecb-fx" (collectors / collector_runs). The rate is fetched once and
 * written into every database in turn; a failed database never skips the next one (exit code 1). */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openD1Targets,counters,targetLine} from '../../platform/db/d1-targets.js';
import {recordRun} from '../../platform/collector-health.js';

export const ECB_URL='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

/** Parse the ECB daily XML into {asOf, rates:{USD:1.1,KRW:1500,…}} (per 1 EUR). @param {string} xml */
export function parseEcb(xml){
 const asOf=/time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1]||null;
 /** @type {Record<string,number>} */const rates={};
 for(const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g))rates[m[1]]=Number(m[2]);
 return {asOf,rates};
}
/** KRW per 1 USD from the ECB table, or null when either rate is missing. @param {{rates:Record<string,number>}} t */
export function krwPerUsd(t){const k=t.rates.KRW,u=t.rates.USD;return k>0&&u>0?Math.round(k/u*100)/100:null;}

/** @param {any} db @param {{asOf:string,rate:number}} r @param {number} now */
export async function storeRate(db,r,now){
 await db.prepare(`INSERT INTO fx_rates (base,quote,rate,as_of,source_url,fetched_at) VALUES ('USD','KRW',?,?,?,?)
  ON CONFLICT(base,quote) DO UPDATE SET rate=excluded.rate,as_of=excluded.as_of,source_url=excluded.source_url,fetched_at=excluded.fetched_at`).bind(r.rate,r.asOf,ECB_URL,now).run();
}

/**
 * The command line. Returns the exit code (1 when the rate could not be fetched or a database failed).
 * @param {string[]} argv
 * @param {{env?:Record<string,string|undefined>,open?:(spec:{label:string,databaseId:string},env:any)=>any,fetch?:typeof fetch,log?:(m:string)=>void}} [deps]
 */
export async function main(argv,deps={}){
 const log=deps.log||console.log,doFetch=deps.fetch||fetch;
 // Every database is opened (and the list checked) before the rate is fetched.
 const targets=argv.includes('--d1')?openD1Targets(deps.env||process.env,deps.open):[];
 const started=Date.now();/** @type {string|null} */let error=null;/** @type {number|null} */let rate=null;/** @type {string|null} */let asOf=null;
 try{
  const res=await doFetch(ECB_URL,{headers:{'user-agent':'NerulioBot/1.0 (+https://nerulio.com)'}});
  if(!res.ok)throw Error(`HTTP ${res.status}`);
  const t=parseEcb(await res.text());rate=krwPerUsd(t);asOf=t.asOf;
  if(!rate||!asOf)throw Error('USD or KRW missing in the ECB table');
  log(JSON.stringify({asOf,krwPerUsd:rate}));
 }catch(e){error=String(e);console.error(error);}
 let failed=error?1:0;
 const now=Date.now();
 for(const {label,db} of targets){
  const c0=counters(db);/** @type {string|null} */let err=error;
  try{if(rate&&asOf)await storeRate(db,{rate,asOf},now);}catch(e){err=`store: ${e}`;}
  const c1=counters(db),queries=c1.queries-c0.queries,rowsWritten=c1.rowsWritten-c0.rowsWritten;
  try{await recordRun(db,{id:'ecb-fx',vertical:'ai',mode:'auto',freshnessHours:96},{started,finished:Date.now(),error:err,observations:rate?1:0,changes:0,rowsWritten,queries});}
  catch(e){err=err?`${err}; run record: ${e}`:`run record: ${e}`;}
  log(targetLine(label,'ecb-fx',{error:err,changes:0,queries,rowsWritten}));
  if(err)failed++;
 }
 return failed?1:0;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{process.exitCode=await main(process.argv.slice(2));}
 catch(e){console.error(String(/** @type {any} */(e)?.stack||e));process.exitCode=1;}
}
