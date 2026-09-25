import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteAvailable} from './d1-shim.mjs';
/** The API red-team corpus (tests/redteam/api-attacks.mjs, docs/MONETIZATION-SECURITY.md) as a
 * regression gate: every attack must stay BLOCKED or be one of the documented ACCEPTED residuals. */
test('monetization red-team: no API attack works',{skip:!sqliteAvailable&&'node:sqlite unavailable'},async()=>{
 process.env.REDTEAM_QUIET='1';
 const {results}=await import('./redteam/api-attacks.mjs');
 assert(results.length>=35,`expected the full corpus, got ${results.length}`);
 const bad=results.filter(r=>!['BLOCKED','ACCEPTED'].includes(r.verdict));
 assert.deepEqual(bad.map(r=>`${r.id} ${r.verdict}: ${r.title} ${JSON.stringify(r.evidence)}`),[]);
 // The accepted residuals are exactly the documented ones; a new ACCEPTED row needs a doc entry.
 assert.deepEqual(results.filter(r=>r.verdict==='ACCEPTED').map(r=>r.id).sort(),['A10r','A11','A1d','A2','A6b','A7d']);
});
