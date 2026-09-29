// Seed edits reach D1 through tools/platform/seed-sync.mjs: repeatable, write-minimal, and it never
// wipes what collectors added. Also: collector run retention.
import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {syncSeeds,planVerticals,changedVerticals,runId,SEED_SYNC_FRESHNESS_HOURS} from '../tools/platform/seed-sync.mjs';
import {ingest} from '../platform/ingest.js';
import {recordRun,RUNS_MIN,RUNS_MAX} from '../platform/collector-health.js';
import {collectorItems} from '../server/platform/admin-collectors.js';

const T0=Date.UTC(2026,8,29,1),DAY=864e5;
const rows=(db,sql,...p)=>db.raw.prepare(sql).all(...p).map(r=>({...r}));
const src=id=>({id,kind:'OFFICIAL',url:`https://example.com/${id.slice(4)}`,retrieved:'2026-09-28'});
const seeds=()=>[
 {file:'/seed/studio/a.json',doc:{schema:'nerulio.seed/1',vertical:'studio',sources:[src('src:s1')],entities:[
  {id:'app:tool',type:'app',slug:'tool',names:{en:'Tool'},facts:[{p:'latest_version',v:'1.0',ver:'OFFICIAL',src:'src:s1'}],relations:[{p:'made_by',o:'vendor:maker',src:'src:s1'}],versions:[{version:'1.0',released:'2026-09-01',src:'src:s1'}]},
  {id:'vendor:maker',type:'vendor',slug:'maker',names:{en:'Maker'}}]}},
 {file:'/seed/games/a.json',doc:{schema:'nerulio.seed/1',vertical:'games',sources:[src('src:g1')],entities:[
  {id:'game:steam-1',type:'game',slug:'g1',names:{en:'Game One'},facts:[{p:'korean_official',v:'none',ver:'OFFICIAL',src:'src:g1'}],relations:[{p:'related_to',o:'app:tool',src:'src:g1'}]}]}},
];

test('plan: explicit verticals, unknown ones refused, an unknown git ref means everything',()=>{
 assert.deepEqual(planVerticals({verticals:'studio,ai'}),['ai','studio']);
 assert.throws(()=>planVerticals({verticals:'music'}),/unknown verticals/);
 assert.equal(changedVerticals('0000000000000000000000000000000000000000'),null);
 assert.equal(changedVerticals('no-such-ref-xyz'),null);
 assert.deepEqual(planVerticals({changedSince:'no-such-ref-xyz'}),['ai','games','hardware','studio','subculture']);
 assert.deepEqual(changedVerticals('HEAD'),[],'nothing changed between HEAD and HEAD');
 assert.equal(runId('games'),'seed-sync-games');
});

test('a second sync writes nothing; an edited seed value lands quietly, or on the Radar with --radar',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const r1=await syncSeeds(db,{verticals:['studio','games'],seeds:seeds(),now:T0});
 assert.equal(r1.studio.created,2);assert.ok(r1.studio.rowsWritten>0);
 const again=await syncSeeds(db,{verticals:['studio','games'],seeds:seeds(),now:T0+DAY});
 assert.deepEqual([again.studio.rowsWritten,again.games.rowsWritten,again.studio.changes],[0,0,0]);
 const s=seeds();s[0].doc.entities[0].facts[0].v='1.1';
 const r3=await syncSeeds(db,{verticals:['studio'],seeds:s,now:T0+2*DAY});
 assert.equal(r3.studio.facts.changed,1);
 assert.equal(rows(db,"SELECT importance FROM changes WHERE kind='fact_changed'")[0].importance,0,'seed mode: history, not news');
 s[0].doc.entities[0].facts[0].v='1.2';
 await syncSeeds(db,{verticals:['studio'],seeds:s,now:T0+3*DAY,radar:true});
 assert.equal(rows(db,"SELECT importance FROM changes WHERE kind='fact_changed' ORDER BY id DESC")[0].importance,3,'--radar: a curated correction is news');
});

test('a vertical synced alone creates the entities it references in other verticals (identity only)',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const r=await syncSeeds(db,{verticals:['games'],seeds:seeds(),now:T0});
 assert.equal(r.games.foreign,1);
 assert.deepEqual(rows(db,'SELECT id,vertical FROM entities ORDER BY id'),[{id:'app:tool',vertical:'studio'},{id:'game:steam-1',vertical:'games'}]);
 assert.equal(rows(db,"SELECT * FROM facts WHERE entity_id='app:tool'").length,0,'its facts belong to its own vertical');
 assert.equal(rows(db,'SELECT * FROM relations').length,1);
});

test('syncing the seed never wipes a Korean name, a newer version or a collector fact added since',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 await syncSeeds(db,{verticals:['studio','games'],seeds:seeds(),now:T0});
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[{id:'src:steam-1',kind:'OFFICIAL_API',url:'https://store.steampowered.com/app/1/',retrieved:'2026-09-29',adapter:'steam-store'}],
  entities:[{id:'game:steam-1',type:'game',slug:'g1',names:{en:'Game One',ko:'게임 원'},facts:[{p:'genres',v:['Action'],ver:'AUTOMATED',src:'src:steam-1'}]}]},{mode:'collector',actor:'collector:steam-store',now:T0+3600e3});
 await ingest(db,{schema:'nerulio.seed/1',vertical:'studio',sources:[src('src:s1')],entities:[{id:'app:tool',facts:[{p:'latest_version',v:'1.3',ver:'OFFICIAL',src:'src:s1'}]}]},{mode:'collector',actor:'collector:x',now:T0+7200e3});
 const r=await syncSeeds(db,{verticals:['studio','games'],seeds:seeds(),now:T0+DAY});
 assert.equal(r.games.rowsWritten+r.studio.rowsWritten,0);
 assert.deepEqual(JSON.parse(rows(db,"SELECT names FROM entities WHERE id='game:steam-1'")[0].names),{en:'Game One',ko:'게임 원'});
 assert.equal(rows(db,"SELECT value FROM facts WHERE entity_id='app:tool' AND property='latest_version' AND is_current=1")[0].value,'"1.3"');
 assert.equal(rows(db,"SELECT COUNT(*) n FROM facts WHERE entity_id='game:steam-1' AND property='genres' AND is_current=1")[0].n,1);
});

test('collector run history is pruned: newest kept, >90 days or >1000 dropped; seed-sync rows are on-push, not scheduled',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const def={id:'claude-status',vertical:'ai',mode:'auto',freshnessHours:1};
 const old=T0-100*DAY;
 for(let i=0;i<RUNS_MIN+5;i++)db.raw.prepare("INSERT INTO collector_runs (adapter,started_at,finished_at,status) VALUES ('claude-status',?,?,'ok')").run(old+i,old+i);
 await recordRun(db,def,{started:T0,finished:T0,error:null,observations:1,changes:0});
 assert.equal(rows(db,"SELECT COUNT(*) n FROM collector_runs WHERE adapter='claude-status'")[0].n,RUNS_MIN,'only the newest 20 survive when the rest are older than 90 days');
 for(let i=0;i<RUNS_MAX+10;i++)db.raw.prepare("INSERT INTO collector_runs (adapter,started_at,finished_at,status) VALUES ('openai-status',?,?,'ok')").run(T0-i,T0-i);
 await recordRun(db,{...def,id:'openai-status'},{started:T0,finished:T0,error:null,observations:1,changes:0});
 assert.equal(rows(db,"SELECT COUNT(*) n FROM collector_runs WHERE adapter='openai-status'")[0].n,RUNS_MAX);
 await recordRun(db,{id:runId('games'),vertical:'games',mode:'auto',freshnessHours:SEED_SYNC_FRESHNESS_HOURS},{started:T0,finished:T0,error:'boom',observations:0,changes:0});
 const item=collectorItems(rows(db,'SELECT * FROM collectors'),T0+30*DAY).find(x=>x.id==='seed-sync-games');
 assert.deepEqual([item.state,item.schedule,item.next_run_at],['failing','manual',null]);
});

test('a seed-sync workflow failure that recorded nothing says so in the admin push',async()=>{
 const {workflowFailedMessage}=await import('../server/platform/admin-notify.js');
 assert.equal(workflowFailedMessage({runUrl:'https://github.com/o/r/actions/runs/1'}).title,'수집기 워크플로 실패');
 const m=workflowFailedMessage({label:'seed-sync'});
 assert.equal(m.kind,'collector_failed');assert.equal(m.title,'시드 동기화 워크플로 실패');assert.match(m.body,/시드 수정/);
});

test('seed-sync workflow: seed pushes and manual runs, gated, one job per vertical, collectors secrets, failure push',async()=>{
 const {readFileSync}=await import('node:fs');
 const y=readFileSync(new URL('../.github/workflows/seed-sync.yml',import.meta.url),'utf8');
 assert.match(y,/push:\s+branches: \[main\]\s+paths:\s+- 'data\/seed\/\*\*'/);
 assert.match(y,/workflow_dispatch:[\s\S]*verticals:[\s\S]*radar:/);
 assert.match(y,/if: \$\{\{ vars\.PLATFORM_COLLECTORS == 'on' \}\}/);
 assert.match(y,/seed-sync\.mjs --plan/);assert.match(y,/--changed-since "\$BEFORE"/);assert.match(y,/fetch-depth: 0/);
 assert.match(y,/vertical: \$\{\{ fromJSON\(needs\.plan\.outputs\.verticals\) \}\}/);
 assert.match(y,/timeout-minutes: 45/);
 for(const s of ['CF_ACCOUNT_ID','CF_D1_DATABASE_ID','CF_API_TOKEN'])assert.ok(y.includes(s+': ${{ secrets.'+s+' }}'),s);
 assert.ok(y.includes('{\\"kind\\":\\"collector_failed\\",\\"payload\\":{\\"runUrl\\":\\"$RUN_URL\\",\\"label\\":\\"seed-sync\\"}}'));
 assert.match(y,/NOTIFY_URL: \$\{\{ vars\.NOTIFY_URL \}\}/);
 // The planner prints a JSON array the matrix can use.
 const {execFileSync}=await import('node:child_process');
 const out=execFileSync(process.execPath,['tools/platform/seed-sync.mjs','--plan','--verticals','games,ai'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.deepEqual(JSON.parse(out),['ai','games']);
});
