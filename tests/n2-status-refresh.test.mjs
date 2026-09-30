/** The site keeps the AI status fresh itself when the scheduled collectors run late: a page view that finds
 * claude-status/openai-status older than 10 minutes runs them after the response, claimed in D1 so one
 * isolate fetches at a time. Real SQL over node:sqlite; the status pages are recorded fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {refreshStatus,staleAdapters,claim,maybeRefreshStatus,resetStatusRefresh,REFRESH_AFTER,LOCK_MS} from '../server/platform/status-refresh.js';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const ATOM=readFileSync(new URL('./fixtures/n2/collectors/claude-status/history.atom',import.meta.url),'utf8');
const fetchStub=async(/** @type {any} */ url)=>String(url)==='https://status.claude.com/history.atom'?new Response(ATOM,{headers:{'content-type':'application/atom+xml'}}):new Response('no',{status:503});

async function setup(lastSuccess){
 const db=D1Shim.migrated();await seedDatabase(db,undefined,Date.now()-30*864e5);
 for(const id of ['claude-status','openai-status'])await db.prepare("INSERT OR REPLACE INTO collectors (adapter,vertical,mode,freshness_hours,last_attempt_at,last_success_at,consecutive_failures) VALUES (?,'ai','auto',1,?,?,0)").bind(id,lastSuccess,lastSuccess).run();
 return db;
}

test('status refresh: stale status is collected into the database and recorded like a scheduled run',{skip},async()=>{
 const now=Date.now(),db=await setup(now-3*36e5);
 assert.deepEqual((await staleAdapters(db,now)).map(a=>a.id),['claude-status','openai-status']);
 const ran=await refreshStatus(db,{now,fetch:fetchStub});
 assert.deepEqual(ran,['claude-status','openai-status']);
 const ev=await db.prepare("SELECT COUNT(*) AS n FROM events WHERE url LIKE 'https://status.claude.com/incidents/%'").first();
 assert(Number(ev.n)>=1,'the incidents from the feed are in the graph');
 const rows=new Map(((await db.prepare("SELECT adapter,last_success_at,consecutive_failures FROM collectors").all()).results).map(r=>[r.adapter,r]));
 assert(Number(rows.get('claude-status').last_success_at)>=now,'claude-status is fresh now');
 assert.equal(Number(rows.get('openai-status').consecutive_failures),1,'a failing status page is recorded as a failure, not hidden');
 const runs=(await db.prepare("SELECT adapter,status FROM collector_runs ORDER BY id").all()).results;
 assert.deepEqual(runs.map(r=>`${r.adapter}:${r.status}`),['claude-status:ok','openai-status:error']);
 // Fresh (claude) or just tried (openai): nothing to do for the next views.
 assert.deepEqual(await refreshStatus(db,{now:now+60e3,fetch:fetchStub}),[]);
 assert.deepEqual((await staleAdapters(db,now+LOCK_MS+60e3)).map(a=>a.id),['openai-status'],'the failed one is retried after the lock');
});

test('status refresh: one claim per adapter, never while fresh or while another isolate holds it',{skip},async()=>{
 const now=Date.now(),db=await setup(now-REFRESH_AFTER-1);
 assert.equal(await claim(db,'claude-status',now),true);
 assert.equal(await claim(db,'claude-status',now+1000),false,'a second isolate backs off');
 const fresh=await setup(now-60e3);
 assert.equal(await claim(fresh,'claude-status',now),false,'fresh data is not refetched');
 const none=D1Shim.migrated();
 assert.deepEqual(await staleAdapters(none,now),[],'no collector row (collectors never ran here): nothing');
});

test('status refresh from a page view: once per isolate per minute, after the response',{skip},async()=>{
 resetStatusRefresh();
 const now=Date.now(),db=await setup(now),jobs=[];
 const ctx={waitUntil:p=>jobs.push(p)};
 assert.equal(maybeRefreshStatus({DB:db},ctx,{origin:'https://nerulio.test',now}),true);
 assert.equal(maybeRefreshStatus({DB:db},ctx,{origin:'https://nerulio.test',now:now+1000}),false,'no second check within a minute');
 assert.equal(jobs.length,1);await Promise.all(jobs);
 assert.equal(maybeRefreshStatus({DB:db},{},{origin:'x',now:now+120e3}),false,'no waitUntil, no work');
 resetStatusRefresh();
});
