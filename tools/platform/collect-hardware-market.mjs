/** Keyless public community collection. --sqlite file for a real local run; --d1 for scheduled use.
 * Sources fetched once, facts persisted sequentially to every existing configured D1 target. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {openD1Targets} from '../../platform/db/d1-targets.js';
import {collectCommunity} from '../../collectors/_hardware-market/collect.js';
import {saveCommunity} from '../../platform/hardware-community.js';
const unavailable=new Set(['BOT_CHALLENGE','ACCESS_DENIED','ROBOTS','RATE_LIMITED']);
export async function run(argv=process.argv.slice(2),{collect=collectCommunity,log=console.log,logErr=console.error}={}){
 const targets=argv.includes('--d1')?openD1Targets(process.env):[];
 const index=argv.indexOf('--sqlite');if(index>=0){if(!argv[index+1])throw Error('--sqlite requires a file');const {D1Shim}=await import('../../tests/d1-shim.mjs');targets.push({label:'local',db:new D1Shim(argv[index+1])});}
 const schema=readFileSync(new URL('../../migrations/0015_hardware_market.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'');
 for(const t of targets)for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean))await t.db.prepare(sql).run();
 const results=await collect({db:targets[0]?.db});
 // Partial access restrictions are operational warnings. Broken schemas, no healthy
 // sources and any database failure still fail the job. Failed-source facts stay stale.
 let failed=!results.some(r=>r.status==='ok')||results.some(r=>r.status!=='ok'&&!unavailable.has(r.status));
 for(const t of targets){try{await saveCommunity(t.db,results);log(`Saved normalized facts to ${t.label}`);}catch(e){failed=true;logErr(`Persistence failed for ${t.label}: ${e.message}`);}}
 for(const r of results){
  log(`${r.source}: ${r.status}, ${r.items.length} items, ${r.excluded} excluded`);
  const location=r.failure?` during ${r.failure.stage} at ${r.failure.url}`:'';
  if(unavailable.has(r.status))logErr(`::warning title=Hardware market source unavailable::${r.source}: ${r.status}${location}; source freshness was not advanced`);
  else if(r.failure)logErr(`${r.source}: ${r.status}${location}`);
 }
 if(!targets.length)log(JSON.stringify(results.map(r=>({source:r.source,status:r.status,items:r.items})),null,2));
 for(const t of targets)t.db.raw?.close();
 return failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await run();
