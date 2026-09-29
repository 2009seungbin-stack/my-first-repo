// Regressions from the preview D1 (2026-09-29): conflicts piling up per run, stale seeded versions
// raising conflicts instead of updating, Radar event_changed rows repeated on every run, a version
// recorded twice (stable + lts), and seed re-syncs that must write nothing and revert nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {ingest,canon,mergeLocales,mergeUrls} from '../platform/ingest.js';
import {compareVersionStrings,supersedes} from '../platform/schema.js';

const T0=Date.UTC(2026,8,28,3),HOUR=36e5,DAY=864e5;
const rows=(db,sql,...p)=>db.raw.prepare(sql).all(...p).map(r=>({...r}));
const total=db=>Number(db.raw.prepare('SELECT total_changes() AS c').get().c);
const SEED={mode:'seed',actor:'seed'};
const COL=id=>({mode:'collector',actor:`collector:${id}`,adapter:id});

const studioSeed=()=>({schema:'nerulio.seed/1',vertical:'studio',
 sources:[{id:'src:reaper-download',kind:'OFFICIAL',url:'https://www.reaper.fm/download.php',retrieved:'2026-09-28'},{id:'src:blender-tags',kind:'OFFICIAL',url:'https://projects.blender.org/',retrieved:'2026-09-28'}],
 entities:[
  {id:'vendor:cockos',type:'vendor',slug:'cockos',names:{en:'Cockos'}},
  {id:'app:reaper',type:'app',slug:'reaper',names:{en:'REAPER',ko:'리퍼'},description:{en:'A DAW.',ko:'DAW.'},official_urls:[{label:'Site',url:'https://www.reaper.fm/'}],
   facts:[{p:'latest_version',v:'7.80',ver:'OFFICIAL',src:'src:reaper-download'},{p:'license_model',v:'Discounted/commercial',ver:'OFFICIAL',src:'src:reaper-download'}],
   relations:[{p:'made_by',o:'vendor:cockos',src:'src:reaper-download'}],
   versions:[{version:'7.80',released:'2026-09-13',src:'src:reaper-download'}]},
  {id:'app:blender',type:'app',slug:'blender',names:{en:'Blender'},versions:[{version:'4.5.14',channel:'lts',released:'2026-09-14',src:'src:blender-tags'}]},
 ]});
const reaperRun=(v,ver='AUTOMATED')=>({schema:'nerulio.seed/1',vertical:'studio',
 sources:[{id:'src:auto-reaper',kind:'FEED',url:'https://www.reaper.fm/whatsnew.txt',retrieved:'2026-09-29',adapter:'reaper-whatsnew'}],
 entities:[{id:'app:reaper',facts:[{p:'latest_version',v,ver,src:'src:auto-reaper'}]}]});

test('version order: dotted numbers compare, suffix-only differences and junk do not',()=>{
 assert.equal(compareVersionStrings('7.81','7.80'),1);
 assert.equal(compareVersionStrings('v1.10.0','1.9.9'),1);
 assert.equal(compareVersionStrings('Ver.1.042.00.02','1.042.00.01'),1);
 assert.equal(compareVersionStrings('b4570','b4567'),1);
 assert.equal(compareVersionStrings('580.95.05','580.95.5'),0);
 assert.equal(compareVersionStrings('7.80a','7.80'),null);
 assert.equal(compareVersionStrings('latest','7.80'),null);
 assert.equal(supersedes({ver:'AUTOMATED',value:'7.81',property:'latest_version'},{verification:'OFFICIAL',value:'7.80'}),true);
 assert.equal(supersedes({ver:'AUTOMATED',value:'7.79',property:'latest_version'},{verification:'OFFICIAL',value:'7.80'}),false);
 assert.equal(supersedes({ver:'COMMUNITY',value:'7.81',property:'latest_version'},{verification:'OFFICIAL',value:'7.80'}),false);
 assert.equal(supersedes({ver:'AUTOMATED',value:'2026-10-03',property:'release_date'},{verification:'OFFICIAL',value:'2026-10-02'}),false);
});

test('a repeated conflicting reading is one open conflict, refreshed once per shown day',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,studioSeed(),{...SEED,now:T0});
 const doc=()=>({schema:'nerulio.seed/1',vertical:'studio',sources:[{id:'src:forum',kind:'COMMUNITY',url:'https://forum.example.com/',retrieved:'2026-09-29'}],
  entities:[{id:'app:reaper',facts:[{p:'license_model',v:'Free',ver:'COMMUNITY',src:'src:forum'}]}]});
 for(const at of [T0+HOUR,T0+2*HOUR,T0+3*HOUR])assert.equal((await ingest(db,doc(),{...COL('x'),now:at})).facts.conflicts,1);
 let c=rows(db,'SELECT * FROM fact_conflicts');
 assert.equal(c.length,1,'the same reading three times is one conflict');assert.equal(c[0].observed_at,T0+HOUR);
 const before=total(db);await ingest(db,doc(),{...COL('x'),now:T0+4*HOUR});
 assert.equal(total(db)-before,0,'same day: nothing written');
 await ingest(db,doc(),{...COL('x'),now:T0+DAY});
 c=rows(db,'SELECT * FROM fact_conflicts');assert.equal(c.length,1);assert.equal(c[0].observed_at,T0+DAY,'next day: last seen moves');
 db.raw.prepare("UPDATE fact_conflicts SET status='rejected',resolved_by='admin:1',resolved_at=?").run(T0+DAY);
 await ingest(db,doc(),{...COL('x'),now:T0+2*DAY});
 assert.equal(rows(db,'SELECT * FROM fact_conflicts').length,1,'a value the admin rejected is not raised again');
 // A different value is a new conflict.
 const d=doc();d.entities[0].facts[0].v='Paid';await ingest(db,d,{...COL('x'),now:T0+2*DAY});
 assert.equal(rows(db,"SELECT * FROM fact_conflicts WHERE status='open'").length,1);
});

test('a newer version read by a collector supersedes a stale seeded OFFICIAL value; an older one is a conflict',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,studioSeed(),{...SEED,now:T0});
 // Before the fix: AUTOMATED 7.81 < OFFICIAL 7.80 in the ladder → a conflict on every run.
 const older=await ingest(db,reaperRun('7.79'),{...COL('reaper-whatsnew'),now:T0+HOUR});
 assert.equal(older.facts.conflicts,1);
 const r=await ingest(db,reaperRun('7.81'),{...COL('reaper-whatsnew'),now:T0+2*HOUR});
 assert.equal(r.facts.changed,1);assert.equal(r.facts.conflicts,0);
 const cur=rows(db,"SELECT value,verification,created_by FROM facts WHERE entity_id='app:reaper' AND property='latest_version' AND is_current=1");
 assert.deepEqual(cur,[{value:canon('7.81'),verification:'AUTOMATED',created_by:'collector:reaper-whatsnew'}]);
 assert.equal(rows(db,"SELECT * FROM fact_conflicts WHERE status='open'").length,0,'the 7.79 conflict on the closed 7.80 row is settled');
 assert.equal(rows(db,"SELECT status,resolved_by FROM fact_conflicts")[0].resolved_by,'system:ingest');
 const ch=rows(db,"SELECT old_value,new_value,importance FROM changes WHERE kind='fact_changed'");
 assert.deepEqual(ch,[{old_value:canon('7.80'),new_value:canon('7.81'),importance:3}]);
 // The adapters that read the vendor's own channel now say OFFICIAL: same value → a label upgrade, no change.
 await ingest(db,reaperRun('7.81','OFFICIAL'),{...COL('reaper-whatsnew'),now:T0+3*HOUR});
 assert.equal(rows(db,"SELECT verification FROM facts WHERE property='latest_version' AND is_current=1")[0].verification,'OFFICIAL');
 assert.equal(rows(db,"SELECT * FROM changes WHERE kind='fact_changed'").length,1);
});

test('a conflict adopted by a later change is marked accepted',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,studioSeed(),{...SEED,now:T0});
 const community={schema:'nerulio.seed/1',vertical:'studio',sources:[{id:'src:forum',kind:'COMMUNITY',url:'https://forum.example.com/',retrieved:'2026-09-29'}],entities:[{id:'app:reaper',facts:[{p:'license_model',v:'Free',ver:'COMMUNITY',src:'src:forum'}]}]};
 await ingest(db,community,{...COL('x'),now:T0+HOUR});
 const s=studioSeed();s.entities[1].facts[1].v='Free';
 await ingest(db,s,{...SEED,now:T0+DAY});
 assert.deepEqual(rows(db,'SELECT status,resolved_by FROM fact_conflicts'),[{status:'accepted',resolved_by:'system:ingest'}]);
});

test('a changelog that repeats a title on two dates is two events and re-ingests without Radar changes',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const PAGE='https://ai.google.dev/gemini-api/docs/changelog';
 const ev=(title,starts)=>({kind:'update',title:{en:title},starts,url:PAGE,entities:['service:gemini-api'],ver:'OFFICIAL',src:'src:gemini'});
 const doc=()=>({schema:'nerulio.seed/1',vertical:'ai',sources:[{id:'src:gemini',kind:'OFFICIAL',url:PAGE,retrieved:'2026-09-29'}],
  entities:[{id:'service:gemini-api',type:'service',slug:'gemini-api',names:{en:'Gemini API'}}],
  // Newest first, as on the page; three bullets on 06-15 share the headline.
  events:[ev('Deprecation announcement','2026-07-30'),ev('Gemini 3.6 Flash GA','2026-07-21'),ev('Deprecation announcement','2026-06-15'),ev('Deprecation announcement','2026-06-15'),ev('Deprecation announcement','2026-06-15')]});
 await ingest(db,doc(),{...COL('gemini-api-changelog'),now:T0});
 assert.deepEqual(rows(db,"SELECT starts_at FROM events WHERE title=? ORDER BY starts_at",JSON.stringify({en:'Deprecation announcement'})).map(r=>new Date(r.starts_at).toISOString().slice(0,10)),['2026-06-15','2026-07-30']);
 for(const at of [T0+6*HOUR,T0+12*HOUR,T0+DAY]){
  const before=total(db),s=await ingest(db,doc(),{...COL('gemini-api-changelog'),now:at});
  assert.equal(s.changes,0);assert.equal(total(db)-before,0,'an unchanged changelog writes nothing');
 }
 assert.equal(rows(db,"SELECT * FROM changes WHERE kind='event_changed'").length,0);
 assert.equal(rows(db,'SELECT * FROM events').length,3);
});

test('the preview state (one row for a repeated title) heals with one insert, then stays quiet',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const PAGE='https://developers.openai.com/api/docs/changelog',title={en:'Released chat-latest snapshot.'};
 const doc=()=>({schema:'nerulio.seed/1',vertical:'ai',sources:[{id:'src:openai',kind:'OFFICIAL',url:PAGE,retrieved:'2026-09-29'}],
  entities:[{id:'service:openai-api',type:'service',slug:'openai-api',names:{en:'OpenAI API'}}],
  events:[{kind:'release',title,starts:'2026-05-28',url:PAGE,entities:['service:openai-api'],ver:'OFFICIAL',src:'src:openai'},{kind:'release',title,starts:'2026-05-05',url:PAGE,entities:['service:openai-api'],ver:'OFFICIAL',src:'src:openai'}]});
 // What the old pipeline left behind: a single event row for both items.
 await ingest(db,{...doc(),events:[doc().events[1]]},{...COL('openai-api-changelog'),now:T0});
 await ingest(db,doc(),{...COL('openai-api-changelog'),now:T0+HOUR});
 assert.equal(rows(db,'SELECT * FROM events').length,2);
 assert.equal(rows(db,"SELECT * FROM changes WHERE kind='event_changed'").length,0,'no date flip-flop');
 const before=total(db);await ingest(db,doc(),{...COL('openai-api-changelog'),now:T0+2*HOUR});
 assert.equal(total(db)-before,0);
});

test('an LTS release reported as "stable" by a collector is the same version, not a second one',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,studioSeed(),{...SEED,now:T0});
 await ingest(db,{schema:'nerulio.seed/1',vertical:'studio',sources:[],entities:[{id:'app:blender',versions:[{version:'4.5.14',channel:'stable',released:'2026-09-14',src:'src:blender-tags'},{version:'5.2.3',channel:'stable',released:'2026-09-28',src:'src:blender-tags'}]}]},{...COL('blender-releases'),now:T0+HOUR});
 assert.deepEqual(rows(db,"SELECT version,channel FROM versions WHERE entity_id='app:blender' ORDER BY version"),[{version:'4.5.14',channel:'lts'},{version:'5.2.3',channel:'stable'}]);
 assert.equal(rows(db,"SELECT * FROM changes WHERE kind='version_released' AND entity_id='app:blender' AND new_value=?",JSON.stringify('4.5.14')).length,1);
});

test('names merge per locale: a seed never wipes a locale, description or link a collector added',{skip:!sqliteAvailable},async()=>{
 assert.deepEqual(mergeLocales({en:'A',ko:'에이'},{en:'A2'}),{en:'A2',ko:'에이'});
 assert.deepEqual(mergeLocales({en:'A',ja:'エー'},{ja:null}),{en:'A'});
 assert.deepEqual(mergeUrls([{label:'Site',url:'https://a/'}],[{label:'Steam',url:'https://s/'},{label:'Home',url:'https://a/'}]),[{label:'Home',url:'https://a/'},{label:'Steam',url:'https://s/'}]);
 const db=D1Shim.migrated();
 const seed=()=>({schema:'nerulio.seed/1',vertical:'games',sources:[{id:'src:o',kind:'OFFICIAL',url:'https://example.com/',retrieved:'2026-09-28'}],
  entities:[{id:'game:steam-7',type:'game',slug:'g7',names:{en:'Game Seven'},description:{en:'A game.'},official_urls:[{label:'Site',url:'https://g7.example.com/'}]}]});
 await ingest(db,seed(),{...SEED,now:T0});
 // The Steam store collector finds the Korean store name (no description this time).
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-7',type:'game',slug:'g7',names:{en:'Game Seven',ko:'게임 세븐'},official_urls:[{label:'Steam',url:'https://store.steampowered.com/app/7/'}]}]},{...COL('steam-store'),now:T0+HOUR});
 const e=()=>rows(db,"SELECT names,descriptions,official_urls,regions FROM entities WHERE id='game:steam-7'")[0];
 assert.deepEqual(JSON.parse(e().names),{en:'Game Seven',ko:'게임 세븐'});
 assert.deepEqual(JSON.parse(e().descriptions),{en:'A game.'},'a document without a description keeps it');
 assert.equal(JSON.parse(e().official_urls).length,2);
 // Re-syncing the seed (no ko) keeps ko and writes nothing.
 const before=total(db);await ingest(db,seed(),{...SEED,now:T0+DAY});
 assert.equal(total(db)-before,0);
 assert.deepEqual(JSON.parse(e().names),{en:'Game Seven',ko:'게임 세븐'});
 // A curated Korean name wins for ko.
 const s=seed();s.entities[0].names.ko='게임 7';await ingest(db,s,{...SEED,now:T0+2*DAY});
 assert.deepEqual(JSON.parse(e().names),{en:'Game Seven',ko:'게임 7'});
 assert.deepEqual(rows(db,"SELECT title FROM search_docs WHERE doc_key='entity:game:steam-7' AND locale='ko'"),[{title:'게임 7'}],'search rows rebuilt');
});

test('seed re-sync: unchanged seed lines never revert newer data, edited ones apply, nothing moves "last verified"',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,studioSeed(),{...SEED,now:T0});
 await ingest(db,reaperRun('7.81','OFFICIAL'),{...COL('reaper-whatsnew'),now:T0+HOUR});
 const cur=()=>rows(db,"SELECT value,created_by,observed_at FROM facts WHERE entity_id='app:reaper' AND property='latest_version' AND is_current=1")[0];
 const before=total(db);
 const s1=await ingest(db,studioSeed(),{...SEED,now:T0+DAY});
 assert.equal(total(db)-before,0,'an unchanged seed writes nothing');
 assert.equal(s1.facts.kept,1);assert.equal(cur().value,canon('7.81'),'the collector value stays');
 assert.equal(rows(db,"SELECT observed_at FROM facts WHERE property='license_model'")[0].observed_at,T0,'seed re-sync is not a re-verification');
 // A curator bumps the seed past the collector: applied.
 const s=studioSeed();s.entities[1].facts[0].v='7.82';
 await ingest(db,s,{...SEED,now:T0+2*DAY});
 assert.deepEqual([cur().value,cur().created_by],[canon('7.82'),'seed']);
 // …and a later collector reading of an older version cannot conflict-spam either: one conflict.
 await ingest(db,reaperRun('7.81','OFFICIAL'),{...COL('reaper-whatsnew'),now:T0+3*DAY});
 assert.equal(cur().value,canon('7.81'),'equal trust: the live official page wins');
 // A seed edit that is older than the current version never moves it backwards.
 const old=studioSeed();old.entities[1].facts[0].v='7.79';
 await ingest(db,old,{...SEED,now:T0+4*DAY});
 assert.equal(cur().value,canon('7.81'));
});

test('seed re-sync keeps a community compatibility verdict and an automated relation does not flip a seeded one',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const seed=()=>({schema:'nerulio.seed/1',vertical:'games',sources:[{id:'src:patch',kind:'COMMUNITY',url:'https://patch.example.com/',retrieved:'2026-09-28'},{id:'src:o',kind:'OFFICIAL',url:'https://example.com/',retrieved:'2026-09-28'}],
  entities:[{id:'org:dev',type:'developer',slug:'dev',names:{en:'Dev'}},{id:'game:steam-5',type:'game',slug:'g5',names:{en:'G5'},relations:[{p:'developed_by',o:'org:dev',src:'src:o'}]},{id:'translation_patch:g5-ko',type:'translation_patch',slug:'g5-ko',names:{en:'G5 Korean patch'}}],
  compatibility:[{subject:'translation_patch:g5-ko',subject_version:'1.0',target:'game:steam-5',target_version:'1.2',status:'works',ver:'COMMUNITY',src:'src:patch'}]});
 await ingest(db,seed(),{...SEED,now:T0});
 // Community reports turn it into a DISPUTED "broken" verdict (platform/community.js writes source_id NULL).
 db.raw.prepare("UPDATE compatibility SET is_current=0,valid_until=? WHERE is_current=1").run(T0+HOUR);
 db.raw.prepare("INSERT INTO compatibility (subject_id,subject_version,target_id,target_version,env,env_key,status,verification,confirmations,contradictions,score,last_confirmed_at,valid_from,is_current,created_at,updated_at) VALUES ('translation_patch:g5-ko','1.0','game:steam-5','1.2','{}','','broken','DISPUTED',1,3,0,?,?,1,?,?)").run(T0+HOUR,T0+HOUR,T0+HOUR,T0+HOUR);
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-5',relations:[{p:'developed_by',o:'org:dev',ver:'AUTOMATED',src:'src:o'}]}]},{...COL('steam-store'),now:T0+2*HOUR});
 const before=total(db);await ingest(db,seed(),{...SEED,now:T0+DAY});
 assert.equal(total(db)-before,0);
 assert.deepEqual(rows(db,'SELECT status,verification FROM compatibility WHERE is_current=1'),[{status:'broken',verification:'DISPUTED'}]);
 assert.equal(rows(db,'SELECT verification FROM relations')[0].verification,'OFFICIAL');
});

test('re-ingesting the same full document (every section) produces no changes and writes nothing',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const doc=()=>({schema:'nerulio.seed/1',vertical:'ai',sources:[{id:'src:o',kind:'OFFICIAL',url:'https://example.com/',retrieved:'2026-09-28'}],
  entities:[{id:'provider:acme',type:'provider',slug:'acme',names:{en:'Acme',ko:'애크미'}},{id:'plan:acme-plus',type:'plan',slug:'acme-plus',names:{en:'Acme Plus'},facts:[{p:'price_monthly',v:20,unit:'USD',region:'US',ver:'OFFICIAL',src:'src:o'}]},
   {id:'service:acme-chat',type:'service',slug:'acme-chat',names:{en:'Acme Chat'},aliases:['AC'],relations:[{p:'made_by',o:'provider:acme',src:'src:o'},{p:'has_plan',o:'plan:acme-plus',src:'src:o'}],versions:[{version:'2.0',released:'2026-09-01',src:'src:o'}],facts:[{p:'status',v:'active',ver:'OFFICIAL',src:'src:o'}]},
   {id:'feature:acme-agent',type:'feature',slug:'acme-agent',names:{en:'Acme Agent'}}],
  events:[{kind:'release',title:{en:'Acme Agent GA'},starts:'2026-09-20',url:'https://example.com/news',entities:['feature:acme-agent','service:acme-chat'],ver:'OFFICIAL',src:'src:o'},{kind:'update',title:{en:'Maintenance'},starts:'2026-10-02T01:00:00Z',ends:'2026-10-02T03:00:00Z',url:'https://example.com/news',entities:['service:acme-chat'],ver:'OFFICIAL',src:'src:o'}],
  availability:[{entity:'feature:acme-agent',plan:'plan:acme-plus',platform:'web',region:'*',state:'available',ver:'OFFICIAL',src:'src:o'}]});
 for(const opts of [{...COL('x'),now:T0},{...SEED,now:T0}]){
  const db2=D1Shim.migrated();await ingest(db2,doc(),opts);
  const n=rows(db2,'SELECT COUNT(*) n FROM changes')[0].n;
  const before=total(db2),s=await ingest(db2,doc(),{...opts,now:opts.now+HOUR});
  assert.equal(s.changes,0,opts.mode);assert.equal(total(db2)-before,0,opts.mode);
  assert.equal(rows(db2,'SELECT COUNT(*) n FROM changes')[0].n,n);
 }
 await ingest(db,doc(),{...SEED,now:T0});
 assert.equal(rows(db,'SELECT * FROM events').length,2);
});
