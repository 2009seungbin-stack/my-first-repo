/** Keyless public community collection. --sqlite file for a real local run; --d1 for scheduled use.
 * Sources fetched once, facts persisted sequentially to every existing configured D1 target. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {openD1Targets} from '../../platform/db/d1-targets.js';
import {collectCommunity} from '../../collectors/_hardware-market/collect.js';
import {saveCommunity} from '../../platform/hardware-community.js';
export async function run(argv=process.argv.slice(2)){
 const targets=argv.includes('--d1')?openD1Targets(process.env):[];
 const index=argv.indexOf('--sqlite');if(index>=0){if(!argv[index+1])throw Error('--sqlite requires a file');const {D1Shim}=await import('../../tests/d1-shim.mjs');targets.push({label:'local',db:new D1Shim(argv[index+1])});}
 const schema=readFileSync(new URL('../../migrations/0015_hardware_market.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'');
 for(const t of targets)for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean))await t.db.prepare(sql).run();
 const results=await collectCommunity({db:targets[0]?.db});let failed=results.some(r=>r.status!=='ok');
 for(const t of targets){try{await saveCommunity(t.db,results);console.log(`Saved normalized facts to ${t.label}`);}catch(e){failed=true;console.error(`Persistence failed for ${t.label}: ${e.message}`);}}
 for(const r of results)console.log(`${r.source}: ${r.status}, ${r.items.length} items, ${r.excluded} excluded`);
 if(!targets.length)console.log(JSON.stringify(results.map(r=>({source:r.source,status:r.status,items:r.items})),null,2));
 for(const t of targets)t.db.raw?.close();
 return failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await run();
