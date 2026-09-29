import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {ingest,canon} from '../platform/ingest.js';

const T0=Date.UTC(2026,8,1),DAY=864e5;
const src=[{id:'src:official',kind:'OFFICIAL',url:'https://example.com/spec',retrieved:'2026-09-01'},{id:'src:forum',kind:'COMMUNITY',url:'https://forum.example.com/t/1',retrieved:'2026-09-01'}];
const seedDoc=()=>({schema:'nerulio.seed/1',vertical:'games',sources:src,entities:[
 {id:'game:steam-1',type:'game',slug:'test-game',names:{en:'Test Game',ko:'테스트 게임'},aliases:['TG'],facts:[{p:'korean_official',v:'none',ver:'OFFICIAL',src:'src:official'},{p:'steam_appid',v:1,ver:'OFFICIAL',src:'src:official'}],versions:[{version:'1.8',released:'2026-08-01',src:'src:official'}]},
 {id:'translation_patch:test-game-ko',type:'translation_patch',slug:'test-game-korean-patch',names:{en:'Test Game Korean patch',ko:'테스트 게임 한글패치'},facts:[{p:'patch_version',v:'1.3',ver:'COMMUNITY',src:'src:forum'}],relations:[{p:'translates',o:'game:steam-1',src:'src:forum'}]}
],compatibility:[{subject:'translation_patch:test-game-ko',subject_version:'1.3',target:'game:steam-1',target_version:'1.8',status:'works',ver:'COMMUNITY',src:'src:forum'}]});
const rows=(db,sql,...p)=>db.raw.prepare(sql).all(...p).map(r=>({...r}));

test('seed import writes entities, facts, aliases, search rows and quiet history',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const s=await ingest(db,seedDoc(),{mode:'seed',actor:'seed',now:T0});
 assert.equal(s.created,2);assert.equal(s.facts.added,3);
 assert.equal(rows(db,'SELECT * FROM facts WHERE is_current=1').length,3);
 assert.ok(rows(db,"SELECT * FROM entity_aliases WHERE norm='테스트게임'").length);
 assert.equal(rows(db,"SELECT doc_key FROM search_docs WHERE search_docs MATCH '테스트'").length>=2,true);
 assert.deepEqual(rows(db,'SELECT DISTINCT importance FROM changes').map(r=>r.importance),[0],'seed history never floods the Radar');
});

test('re-observing the same value only moves observed_at; a new value keeps history and explains itself',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,seedDoc(),{mode:'seed',actor:'seed',now:T0});
 const upd={schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',facts:[{p:'korean_official',v:'none',ver:'AUTOMATED',src:'src:official'}]}]};
 const a=await ingest(db,upd,{mode:'collector',actor:'collector:steam',now:T0+DAY});
 assert.equal(a.facts.confirmed,1);assert.equal(a.changes,0);
 assert.equal(rows(db,"SELECT observed_at FROM facts WHERE property='korean_official'")[0].observed_at,T0+DAY);
 assert.equal(rows(db,"SELECT verification FROM facts WHERE property='korean_official'")[0].verification,'OFFICIAL','a weaker source does not downgrade the label');
 upd.entities[0].facts[0]={p:'korean_official',v:'interface_subtitles',ver:'OFFICIAL',src:'src:official'};
 const b=await ingest(db,upd,{mode:'collector',actor:'collector:steam',now:T0+2*DAY});
 assert.equal(b.facts.changed,1);
 const hist=rows(db,"SELECT value,is_current,valid_until FROM facts WHERE property='korean_official' ORDER BY id");
 assert.deepEqual(hist.map(h=>[h.value,h.is_current]),[[canon('none'),0],[canon('interface_subtitles'),1]]);
 assert.equal(hist[0].valid_until,T0+2*DAY);
 const ch=rows(db,"SELECT * FROM changes WHERE kind='fact_changed'")[0];
 assert.equal(ch.old_value,canon('none'));assert.equal(ch.new_value,canon('interface_subtitles'));assert.equal(ch.importance,3);assert.equal(ch.source_id,'src:official');
});

test('community values never overwrite official facts: they become conflicts',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,seedDoc(),{mode:'seed',actor:'seed',now:T0});
 const r=await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',facts:[{p:'korean_official',v:'full_audio',ver:'COMMUNITY',src:'src:forum'}]}]},{mode:'community',actor:'user:u1',now:T0+DAY});
 assert.equal(r.facts.conflicts,1);
 assert.equal(JSON.parse(rows(db,"SELECT value FROM facts WHERE is_current=1 AND property='korean_official'")[0].value),'none');
 assert.equal(rows(db,"SELECT * FROM fact_conflicts WHERE status='open'").length,1);
});

test('a new game version turns verified patch compatibility into UNVERIFIED_AFTER_UPDATE',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,seedDoc(),{mode:'seed',actor:'seed',now:T0});
 const r=await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',versions:[{version:'1.9',released:'2026-09-10',src:'src:official'}]}]},{mode:'collector',actor:'collector:steam-news',now:Date.UTC(2026,8,10)});
 assert.ok(r.changes>=2);
 const cur=rows(db,"SELECT target_version,status FROM compatibility WHERE is_current=1 ORDER BY id");
 assert.deepEqual(cur,[{target_version:'1.8',status:'works'},{target_version:'1.9',status:'unverified_after_update'}]);
 const c=rows(db,"SELECT importance,new_value FROM changes WHERE kind='compat_changed' ORDER BY id DESC")[0];
 assert.equal(c.importance,3);assert.equal(JSON.parse(c.new_value),'unverified_after_update');
 // A second update carries only the newest verified row forward, once.
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',versions:[{version:'2.0',released:'2026-09-20',src:'src:official'}]}]},{mode:'collector',actor:'collector:steam-news',now:Date.UTC(2026,8,20)});
 assert.equal(rows(db,"SELECT * FROM compatibility WHERE target_version='2.0'").length,1);
});

test('events are deduplicated by url and their changes recorded; availability keeps history',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const doc={schema:'nerulio.seed/1',vertical:'ai',sources:[src[0]],entities:[
  {id:'plan:p-plus',type:'plan',slug:'p-plus',names:{en:'P Plus'}},{id:'feature:f-x',type:'feature',slug:'f-x',names:{en:'Feature X'}}],
  availability:[{entity:'feature:f-x',plan:'plan:p-plus',platform:'web',region:'KR',state:'rolling_out',ver:'OFFICIAL',src:'src:official'}],
  events:[{kind:'release',title:{en:'Feature X launch'},starts:'2026-10-01',url:'https://example.com/launch',entities:['feature:f-x'],ver:'OFFICIAL',src:'src:official'}]};
 await ingest(db,doc,{mode:'collector',actor:'collector:x',now:T0});
 doc.availability[0].state='available';doc.events[0].starts='2026-10-05';
 await ingest(db,doc,{mode:'collector',actor:'collector:x',now:T0+DAY});
 assert.equal(rows(db,'SELECT * FROM events').length,1);
 assert.equal(rows(db,"SELECT * FROM changes WHERE kind='event_changed'").length,1);
 assert.deepEqual(rows(db,'SELECT state,is_current FROM availability ORDER BY id').map(r=>[r.state,r.is_current]),[['rolling_out',0],['available',1]]);
 const av=rows(db,"SELECT importance,old_value,new_value FROM changes WHERE kind='availability_changed' ORDER BY id").at(-1);
 assert.deepEqual([av.importance,JSON.parse(av.old_value),JSON.parse(av.new_value)],[3,'rolling_out','available']);
});

test('seed imports never put schedule edits on the Radar',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const src=[{id:'src:o',kind:'OFFICIAL',url:'https://example.com/',retrieved:'2026-09-01'}];
 const ent=[{id:'game:steam-9',type:'game',slug:'g9',names:{en:'G9'}}];
 const ev=starts=>({schema:'nerulio.seed/1',vertical:'games',sources:src,entities:ent,events:[{kind:'event',title:{en:'Fest'},starts,entities:['game:steam-9'],url:'https://example.com/fest',ver:'OFFICIAL',src:'src:o'}]});
 await ingest(db,ev('2026-10-01'),{mode:'seed',actor:'seed',now:T0});
 await ingest(db,ev('2026-10-02'),{mode:'seed',actor:'seed',now:T0+DAY});
 assert.deepEqual(rows(db,"SELECT importance FROM changes WHERE kind='event_changed'").map(r=>r.importance),[0]);
 await ingest(db,ev('2026-10-03'),{mode:'collector',actor:'collector:x',now:T0+2*DAY});
 assert.equal(rows(db,"SELECT importance FROM changes WHERE kind='event_changed' ORDER BY id DESC")[0].importance,2,'a collector-detected change is news');
});

test('two dates announced on one page stay two events; a retitled incident stays one',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const src=[{id:'src:o',kind:'OFFICIAL',url:'https://example.com/',retrieved:'2026-09-01'}];
 const ent=[{id:'game:steam-8',type:'game',slug:'g8',names:{en:'G8'}}];
 const e=(title,starts)=>({kind:'broadcast',title:{en:title},starts,entities:['game:steam-8'],url:'https://example.com/news/1',ver:'OFFICIAL',src:'src:o'});
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:src,entities:ent,events:[e('Episode 49','2026-10-20'),e('Episode 50','2026-10-27')]},{mode:'seed',actor:'seed',now:T0});
 assert.equal(rows(db,'SELECT COUNT(*) n FROM events')[0].n,2);
 const inc=title=>({schema:'nerulio.seed/1',vertical:'games',sources:src,entities:ent,events:[{kind:'incident',title:{en:title},starts:'2026-09-29T01:00:00Z',entities:['game:steam-8'],url:'https://status.example.com/incidents/x',ver:'OFFICIAL',src:'src:o'}]});
 await ingest(db,inc('Elevated errors'),{mode:'collector',actor:'c',now:T0});
 await ingest(db,inc('Elevated errors on API'),{mode:'collector',actor:'c',now:T0+1000});
 assert.equal(rows(db,"SELECT COUNT(*) n FROM events WHERE kind='incident'")[0].n,1);
});

test('an unchanged collector run writes nothing; "last verified" moves once per shown day',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,seedDoc(),{mode:'seed',actor:'seed',now:T0});
 const tc=()=>Number(db.raw.prepare('SELECT total_changes() AS c').get().c);
 const snap={source:'src:official',url:'https://example.com/spec',fetched_at:'2026-09-01T03:00:00Z',http_status:200,content_type:'text/html',checksum:'abc',byte_size:10};
 const run=()=>({...seedDoc(),snapshots:[snap],entities:seedDoc().entities.map(e=>({...e,facts:(e.facts||[]).map(f=>({...f,snap:0}))}))});
 const at=T0+3*36e5;                                         // 03:00 UTC = 12:00 KST
 await ingest(db,run(),{mode:'collector',actor:'collector:x',adapter:'x',now:at});
 const snaps=rows(db,'SELECT id FROM snapshots').length,versions=rows(db,'SELECT id,version FROM entities ORDER BY id');
 const before=tc();
 const s=await ingest(db,run(),{mode:'collector',actor:'collector:x',adapter:'x',now:at+6*36e5});   // same UTC and KST day
 assert.equal(tc()-before,0,'no row is written when nothing changed');
 assert.deepEqual(s.touched,[]);
 assert.equal(rows(db,'SELECT id FROM snapshots').length,snaps,'the same page (checksum) reuses its snapshot');
 assert.deepEqual(rows(db,'SELECT id,version FROM entities ORDER BY id'),versions,'edge-cache versions stay');
 await ingest(db,run(),{mode:'collector',actor:'collector:x',adapter:'x',now:at+DAY});
 assert.equal(rows(db,"SELECT observed_at FROM facts WHERE property='korean_official' AND is_current=1")[0].observed_at,at+DAY,'next day: re-confirmed');
 snap.checksum='def';
 await ingest(db,run(),{mode:'collector',actor:'collector:x',adapter:'x',now:at+DAY+36e5});
 assert.equal(rows(db,'SELECT id FROM snapshots').length,snaps+1,'a changed page is a new snapshot');
});

test('a new alias re-indexes only that entity for search',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();await ingest(db,seedDoc(),{mode:'seed',actor:'seed',now:T0});
 const doc=seedDoc();doc.entities[0].aliases=['TG','Zyxwv Quest'];
 const s=await ingest(db,doc,{mode:'collector',actor:'collector:x',now:T0+DAY});
 assert.deepEqual(s.touched,['game:steam-1']);
 assert.ok(rows(db,"SELECT doc_key FROM search_docs WHERE search_docs MATCH 'zyxwv'").length,'new alias is searchable');
});
