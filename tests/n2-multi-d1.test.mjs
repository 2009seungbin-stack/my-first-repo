// The collectors, seed sync and FX job write the same data into several D1 databases (preview + production):
// sources are fetched once, every database gets identical rows, and one failing database neither blocks
// the others nor passes silently (the exit code is 1, so the workflow's notify job fires).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {parseD1Targets,openD1Targets,targetLine} from '../platform/db/d1-targets.js';
import {D1Rest} from '../platform/db/d1-rest.js';
import {main as collectMain} from '../tools/platform/collect.mjs';
import {main as seedSyncMain} from '../tools/platform/seed-sync.mjs';
import {main as fxMain} from '../tools/platform/fx.mjs';

const PREVIEW='11111111-aaaa-4bbb-8ccc-000000000001',PROD='bc890e90-fca6-4837-82ad-0574c2378293';
const ENV={CF_ACCOUNT_ID:'acc',CF_API_TOKEN:'tok'};

/** Every table's rows (FTS shadow tables included), in storage order. */
function dump(db){
 const tables=db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
 return Object.fromEntries(tables.map(t=>[t,db.raw.prepare(`SELECT * FROM "${t}"`).all().map(r=>({...r}))]));
}
/** A D1 REST client whose every query fails like a database over its daily write limit. */
const brokenRest=()=>new D1Rest({accountId:'acc',databaseId:'broken',token:'tok',fetch:/** @type {any} */(async()=>new Response(JSON.stringify({success:false,errors:[{message:"exceeded D1's free tier daily row write limit"}]}),{status:429}))});
/** Opens shims (or a broken REST client) by label, remembering what it opened. */
function opener(map){return spec=>{const db=map[spec.label];assert.ok(db,`unexpected target ${spec.label}`);return db;};}
const capture=()=>{const lines=[];return {lines,log:m=>lines.push(String(m))};};

test('target list: labels, positional names, back-compat single id, and config errors',()=>{
 assert.deepEqual(parseD1Targets({CF_D1_DATABASE_IDS:`preview:${PREVIEW}, prod:${PROD}`}),[{label:'preview',databaseId:PREVIEW},{label:'prod',databaseId:PROD}]);
 assert.deepEqual(parseD1Targets({CF_D1_DATABASE_IDS:`${PREVIEW},,${PROD},`}),[{label:'db1',databaseId:PREVIEW},{label:'db2',databaseId:PROD}],'unlabelled ids are named by position; empty entries ignored');
 assert.deepEqual(parseD1Targets({CF_D1_DATABASE_ID:PREVIEW}),[{label:'default',databaseId:PREVIEW}],'back-compat: the single id');
 assert.deepEqual(parseD1Targets({CF_D1_DATABASE_ID:'old',CF_D1_DATABASE_IDS:`prod:${PROD}`}),[{label:'prod',databaseId:PROD}],'the list wins over the single id');
 assert.deepEqual(parseD1Targets({CF_D1_DATABASE_ID:PREVIEW,CF_D1_DATABASE_IDS:'  '}),[{label:'default',databaseId:PREVIEW}],'a blank list falls back');
 assert.throws(()=>parseD1Targets({}),/no D1 database/);
 assert.throws(()=>parseD1Targets({CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:`}),/"prod" has no database id/,'an empty secret behind a label is an error, not a silent skip');
 assert.throws(()=>parseD1Targets({CF_D1_DATABASE_IDS:`pre view:${PREVIEW}`}),/bad label/);
 assert.throws(()=>parseD1Targets({CF_D1_DATABASE_IDS:`a:${PREVIEW},a:${PROD}`}),/used twice/);
 assert.throws(()=>parseD1Targets({CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:${PREVIEW}`}),/same database as "preview"/);
 // The default opener: one REST client per database, sharing the account and token.
 const t=openD1Targets({...ENV,CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:${PROD}`});
 assert.deepEqual(t.map(x=>[x.label,x.db instanceof D1Rest,x.db.url.endsWith(`/accounts/acc/d1/database/${x.databaseId}/query`)]),[['preview',true,true],['prod',true,true]]);
 assert.throws(()=>openD1Targets({CF_D1_DATABASE_IDS:`prod:${PROD}`}),/needs accountId, databaseId and token/);
 assert.equal(targetLine('prod','steam-store',{changes:3,queries:812,rowsWritten:41}),'d1[prod] steam-store: ok, 3 changes, 812 queries, 41 rows written');
 assert.equal(targetLine('prod','steam-store',{error:'ingest: D1 REST: boom'}),'d1[prod] steam-store: error ingest: D1 REST: boom');
});

// A tiny collector: one fetch, one new entity with a fact, sourced from its own feed.
const FEED='https://feed.example.com/releases.json';
function fakeAdapter(){
 return {id:'fake-feed',vertical:'studio',mode:'auto',freshnessHours:24,hosts:['feed.example.com'],minIntervalMs:0,
  async collect(ctx){
   const r=await ctx.get(FEED,{source:'src:fake-feed'});const {version}=r.json();
   return {schema:'nerulio.seed/1',vertical:'studio',sources:[{id:'src:fake-feed',kind:'OFFICIAL',url:FEED,retrieved:'2026-09-29',adapter:'fake-feed'}],
    entities:[{id:'app:fake-multi-d1-tool',type:'app',slug:'fake-multi-d1-tool',names:{en:'Fake Tool'},facts:[{p:'latest_version',v:version,ver:'OFFICIAL',src:'src:fake-feed'}]}]};
  }};
}
function feedFetch(){const calls=[];const f=async(url)=>{calls.push(String(url));return new Response(JSON.stringify({version:'2.1'}),{headers:{'content-type':'application/json'}});};return {calls,fetch:/** @type {any} */(f)};}

test('collect --d1: the adapter runs once and both databases get identical rows',{skip:!sqliteAvailable},async()=>{
 const preview=D1Shim.migrated(),prod=D1Shim.migrated(),{calls,fetch}=feedFetch(),{lines,log}=capture();
 const code=await collectMain(['--adapters','fake-feed','--d1'],{env:{...ENV,CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:${PROD}`},open:opener({preview,prod}),load:async()=>fakeAdapter(),fetch,log,logErr:()=>{}});
 assert.equal(code,0,lines.join('\n'));
 assert.deepEqual(calls,[FEED],'sources are fetched once, not once per database');
 assert.equal(lines[0],'d1 targets: preview, prod');
 const ok=lines.filter(l=>l.startsWith('d1['));
 assert.equal(ok.length,2);assert.match(ok[0],/^d1\[preview\] fake-feed: ok, \d+ changes, \d+ queries, \d+ rows written$/);assert.match(ok[1],/^d1\[prod\] fake-feed: ok, /);
 assert.equal(ok[0].replace('preview','X'),ok[1].replace('prod','X'),'same cost in both');
 assert.deepEqual(dump(prod),dump(preview));
 assert.equal(prod.raw.prepare("SELECT value FROM facts WHERE entity_id='app:fake-multi-d1-tool' AND is_current=1").get()?.value,'"2.1"');
 assert.equal(prod.raw.prepare("SELECT status FROM collector_runs WHERE adapter='fake-feed'").get()?.status,'ok');
});

test('collect --d1: a failing database does not block the next one, and the exit code is 1',{skip:!sqliteAvailable},async()=>{
 const prod=D1Shim.migrated(),{calls,fetch}=feedFetch(),{lines,log}=capture();
 const code=await collectMain(['--adapters','fake-feed','--d1'],{env:{...ENV,CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:${PROD}`},open:opener({preview:brokenRest(),prod}),load:async()=>fakeAdapter(),fetch,log,logErr:()=>{}});
 assert.equal(code,1);
 assert.equal(calls.length,1);
 assert.match(lines.find(l=>l.startsWith('d1[preview]')),/^d1\[preview\] fake-feed: error ingest: Error: D1 REST: exceeded D1's free tier/);
 assert.match(lines.find(l=>l.startsWith('d1[prod]')),/^d1\[prod\] fake-feed: ok, /);
 assert.equal(prod.raw.prepare("SELECT COUNT(*) AS n FROM entities WHERE id='app:fake-multi-d1-tool'").get().n,1);
 assert.equal(prod.raw.prepare("SELECT last_error FROM collectors WHERE adapter='fake-feed'").get().last_error,null);
 // The same when the failing database comes second: the first one is written and the run still fails.
 const first=D1Shim.migrated();
 assert.equal(await collectMain(['--adapters','fake-feed','--d1'],{env:{...ENV,CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:${PROD}`},open:opener({preview:first,prod:brokenRest()}),load:async()=>fakeAdapter(),fetch:feedFetch().fetch,log:()=>{},logErr:()=>{}}),1);
 assert.equal(first.raw.prepare("SELECT COUNT(*) AS n FROM entities WHERE id='app:fake-multi-d1-tool'").get().n,1);
});

test('collect --d1: back-compat single CF_D1_DATABASE_ID writes one database labelled "default"',{skip:!sqliteAvailable},async()=>{
 const only=D1Shim.migrated(),{lines,log}=capture();let opened=null;
 const code=await collectMain(['--adapters','fake-feed','--d1'],{env:{...ENV,CF_D1_DATABASE_ID:PREVIEW},open:spec=>{opened=spec;return only;},load:async()=>fakeAdapter(),fetch:feedFetch().fetch,log,logErr:()=>{}});
 assert.equal(code,0);
 assert.deepEqual(opened,{label:'default',databaseId:PREVIEW});
 assert.match(lines.find(l=>l.startsWith('d1[')),/^d1\[default\] fake-feed: ok, /);
 // A config error stops before any source is fetched.
 const {calls,fetch}=feedFetch();
 await assert.rejects(collectMain(['--adapters','fake-feed','--d1'],{env:{...ENV,CF_D1_DATABASE_IDS:'prod:'},load:async()=>fakeAdapter(),fetch,log:()=>{},logErr:()=>{}}),/has no database id/);
 assert.equal(calls.length,0);
});

const src=id=>({id,kind:'OFFICIAL',url:`https://example.com/${id.slice(4)}`,retrieved:'2026-09-28'});
const seeds=()=>[
 {file:'/seed/studio/a.json',doc:{schema:'nerulio.seed/1',vertical:'studio',sources:[src('src:s1')],entities:[
  {id:'app:tool',type:'app',slug:'tool',names:{en:'Tool'},facts:[{p:'latest_version',v:'1.0',ver:'OFFICIAL',src:'src:s1'}],relations:[{p:'made_by',o:'vendor:maker',src:'src:s1'}],versions:[{version:'1.0',released:'2026-09-01',src:'src:s1'}]},
  {id:'vendor:maker',type:'vendor',slug:'maker',names:{en:'Maker'}}]}},
 {file:'/seed/games/a.json',doc:{schema:'nerulio.seed/1',vertical:'games',sources:[src('src:g1')],entities:[
  {id:'game:steam-1',type:'game',slug:'g1',names:{en:'Game One'},facts:[{p:'korean_official',v:'none',ver:'OFFICIAL',src:'src:g1'}],relations:[{p:'related_to',o:'app:tool',src:'src:g1'}]}]}},
];

test('seed-sync --d1: identical rows in every database; a failing one is reported and the rest still sync',{skip:!sqliteAvailable},async()=>{
 const preview=D1Shim.migrated(),prod=D1Shim.migrated(),{lines,log}=capture();
 const env={...ENV,CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:${PROD}`};
 assert.equal(await seedSyncMain(['--d1','--verticals','studio,games'],{env,open:opener({preview,prod}),seeds:seeds(),now:Date.UTC(2026,8,29),log}),0,lines.join('\n'));
 // collector_runs keep each database's own wall-clock times; everything else is the same row for row.
 const strip=d=>({...d,collector_runs:d.collector_runs.map(r=>({...r,started_at:0,finished_at:0})),collectors:d.collectors.map(r=>({...r,last_attempt_at:0,last_success_at:0}))});
 assert.deepEqual(strip(dump(prod)),strip(dump(preview)));
 assert.equal(prod.raw.prepare("SELECT COUNT(*) AS n FROM entities WHERE id IN ('app:tool','vendor:maker','game:steam-1')").get().n,3);
 const tl=lines.filter(l=>/^d1\[\w+\] seed-sync-/.test(l));
 assert.deepEqual(tl.map(l=>l.split(':')[0]),['d1[preview] seed-sync-games','d1[preview] seed-sync-studio','d1[prod] seed-sync-games','d1[prod] seed-sync-studio']);
 assert.ok(tl.every(l=>/: ok, \d+ changes, \d+ queries, \d+ rows written$/.test(l)));
 assert.ok(lines.some(l=>l.startsWith('d1[prod] studio: 1 files')),'the per-vertical detail line carries the label');

 const good=D1Shim.migrated(),out=capture();
 const code=await seedSyncMain(['--d1','--verticals','studio'],{env,open:opener({preview:brokenRest(),prod:good}),seeds:seeds(),log:out.log,logErr:out.log});
 assert.equal(code,1);
 assert.match(out.lines.find(l=>l.startsWith('d1[preview] seed-sync-studio')),/: error /);
 assert.ok(out.lines.some(l=>l.startsWith('d1[preview] seed-sync studio: Error: D1 REST: exceeded')),'the full error goes to stderr');
 assert.match(out.lines.find(l=>l.startsWith('d1[prod] seed-sync-studio')),/: ok, /);
 assert.equal(good.raw.prepare("SELECT status FROM collector_runs WHERE adapter='seed-sync-studio'").get()?.status,'ok');
 assert.equal(good.raw.prepare("SELECT COUNT(*) AS n FROM entities WHERE id='app:tool'").get().n,1);
});

const XML=`<Cube><Cube time='2026-09-25'><Cube currency='USD' rate='1.1700'/><Cube currency='KRW' rate='1638.00'/></Cube></Cube>`;
test('fx --d1: the ECB table is fetched once and stored in every database; a failing one fails the step',{skip:!sqliteAvailable},async()=>{
 const preview=D1Shim.migrated(),prod=D1Shim.migrated(),{lines,log}=capture();let fetches=0;
 const fetch=/** @type {any} */(async()=>{fetches++;return new Response(XML);});
 const env={...ENV,CF_D1_DATABASE_IDS:`preview:${PREVIEW},prod:${PROD}`};
 assert.equal(await fxMain(['--d1'],{env,open:opener({preview,prod}),fetch,log}),0);
 assert.equal(fetches,1);
 for(const db of [preview,prod])assert.deepEqual({...db.raw.prepare("SELECT rate,as_of FROM fx_rates WHERE base='USD' AND quote='KRW'").get()},{rate:1400,as_of:'2026-09-25'});
 assert.match(lines.find(l=>l.startsWith('d1[prod]')),/^d1\[prod\] ecb-fx: ok, 0 changes, \d+ queries, [1-9]\d* rows written$/);
 const good=D1Shim.migrated();
 assert.equal(await fxMain(['--d1'],{env,open:opener({preview:brokenRest(),prod:good}),fetch,log:()=>{}}),1);
 assert.equal(good.raw.prepare('SELECT COUNT(*) AS n FROM fx_rates').get().n,1);
 assert.equal(good.raw.prepare("SELECT status FROM collector_runs WHERE adapter='ecb-fx'").get()?.status,'ok');
});

test('workflows pass CF_D1_DATABASE_IDS: preview always, prod only when its secret is set',()=>{
 const expected="CF_D1_DATABASE_IDS: preview:${{ secrets.CF_D1_DATABASE_ID }}${{ secrets.CF_D1_DATABASE_ID_PROD != '' && format(',prod:{0}', secrets.CF_D1_DATABASE_ID_PROD) || '' }}";
 for(const [file,n] of [['collectors.yml',2],['seed-sync.yml',1]]){
  const y=readFileSync(new URL(`../.github/workflows/${file}`,import.meta.url),'utf8');
  assert.equal(y.split(expected).length-1,n,file);
  assert.ok(!/^\s+CF_D1_DATABASE_ID:/m.test(y),`${file}: the single-id variable is not passed any more`);
  assert.equal(y.split('CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}').length-1,n);assert.equal(y.split('CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}').length-1,n);
 }
});
