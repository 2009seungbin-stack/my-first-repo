#!/usr/bin/env node
/** Daily reference rate for "≈ ₩" next to USD prices: the ECB euro foreign exchange reference rates
 * (free, no key, published around 16:00 CET on working days). KRW per USD = (KRW per EUR) / (USD per EUR).
 *   node tools/platform/fx.mjs            → prints the rate
 *   node tools/platform/fx.mjs --d1       → writes fx_rates in D1 (CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN)
 * Every run is recorded as collector "ecb-fx" (collectors / collector_runs). */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {D1Rest} from '../../platform/db/d1-rest.js';
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

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const started=Date.now();let error=null,rate=null,asOf=null;
 try{
  const res=await fetch(ECB_URL,{headers:{'user-agent':'NerulioBot/1.0 (+https://nerulio.com)'}});
  if(!res.ok)throw Error(`HTTP ${res.status}`);
  const t=parseEcb(await res.text());rate=krwPerUsd(t);asOf=t.asOf;
  if(!rate||!asOf)throw Error('USD or KRW missing in the ECB table');
  console.log(JSON.stringify({asOf,krwPerUsd:rate}));
 }catch(e){error=String(e);console.error(error);}
 if(process.argv.includes('--d1')){
  const d1=new D1Rest({accountId:process.env.CF_ACCOUNT_ID||'',databaseId:process.env.CF_D1_DATABASE_ID||'',token:process.env.CF_API_TOKEN||''});
  if(rate&&asOf)await storeRate(d1,{rate,asOf},Date.now());
  await recordRun(d1,{id:'ecb-fx',vertical:'ai',mode:'auto',freshnessHours:96},{started,finished:Date.now(),error,observations:rate?1:0,changes:0});
 }
 process.exitCode=error?1:0;
}
