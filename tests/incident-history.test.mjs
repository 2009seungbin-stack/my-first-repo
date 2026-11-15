import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {ingest} from '../platform/ingest.js';
import {eventsFor} from '../platform/db/channel.js';
import {handlePublicPage} from '../server/platform/public.js';
import {renderIncidentHistory} from '../platform/render/incident-history.js';

const start=Date.parse('2026-11-13T23:45:00Z'),end=Date.parse('2026-11-14T00:15:00Z');
const event={title:{en:'Collected incident',ko:'수집된 장애'},starts_at:start,ends_at:end,precision:'time',status:'ended',url:'https://status.claude.com/incidents/example'};

test('a recorded incident shows its actual endpoints in KST or UTC without claiming current availability',()=>{
 const ko=String(renderIncidentHistory([event],'ko')),en=String(renderIncidentHistory([event],'en'));
 for(const body of [ko,en]){
  assert(body.includes('datetime="2026-11-13T23:45:00.000Z"'));
  assert(body.includes('datetime="2026-11-14T00:15:00.000Z"'));
  assert(body.includes('https://status.claude.com/incidents/example'));
 }
 assert(ko.includes('2026-11-14 08:45 KST'));assert(ko.includes('2026-11-14 09:15 KST'));
 assert(en.includes('2026-11-13 23:45 UTC'));assert(en.includes('2026-11-14 00:15 UTC'));
 assert(ko.includes('수집 당시 상태: 종료됨'));assert(en.includes('Status at collection: ended'));
 assert(ko.includes('현재 작동 여부나 전체 장애 이력을 보장하지 않습니다'));
 assert(en.includes('does not establish current availability or a complete incident history'));
});

test('missing endpoints and an old unconfirmed record do not become an active outage or a resolved timestamp',()=>{
 for(const l of ['ko','en']){
  const ended=String(renderIncidentHistory([{...event,starts_at:null,ends_at:null}],l));
  assert(!ended.includes('<time'));assert(ended.includes(l==='ko'?'수집 당시 상태: 종료됨':'Status at collection: ended'));
  assert(ended.includes(l==='ko'?'시작 시각 미기록':'Start time not recorded'));assert(ended.includes(l==='ko'?'종료 시각 미기록':'End time not recorded'));
  const unknown=String(renderIncidentHistory([{...event,ends_at:null,status:'confirmed'}],l));
  assert.equal((unknown.match(/<time\b/g)||[]).length,1);
  assert(unknown.includes(l==='ko'?'수집 당시 종료 여부 미확정':'End status unconfirmed at collection'));
  assert(!unknown.includes(l==='ko'?'현재 장애 발생':'Currently down'));
 }
});

test('date-only and coarse records keep their precision instead of inventing midnight or a timezone',()=>{
 for(const [precision,stamp,text] of [
  ['day','2026-11-13','2026-11-13'],['month','2026-11','2026-11'],['year','2026','2026'],
 ]){
  const body=String(renderIncidentHistory([{...event,ends_at:null,precision}],'ko'));
  assert(body.includes(`datetime="${stamp}"`));assert(body.includes(text));
  assert(!body.includes('KST'));assert(!body.includes('00:00'));assert(!body.includes('2026-11-14'));
 }
 const quarter=String(renderIncidentHistory([{...event,ends_at:null,precision:'quarter'}],'en'));
 assert(quarter.includes('Q4 2026'));assert(!quarter.includes('<time'));
 const bad=String(renderIncidentHistory([{...event,starts_at:NaN,ends_at:Infinity}],'en'));
 assert(!bad.includes('<time'));assert(!bad.includes('Invalid Date'));
});

test('source titles and URLs remain escaped, and an empty collection is explicitly incomplete',()=>{
 const body=String(renderIncidentHistory([{...event,title:{en:'<img src=x onerror=alert(1)>'},url:'javascript:alert(1)'}],'en'));
 assert(body.includes('&lt;img'));assert(!body.includes('<img'));assert(!body.includes('href="javascript:'));
 for(const l of ['ko','en']){
  const empty=String(renderIncidentHistory([],l));assert(!empty.includes('<ol'));assert(!empty.includes('<time'));
  assert(empty.includes(l==='ko'?'표시할 수집 기록이 없습니다':'No collected entries to display'));
 }
});

test('the real public route prioritizes bounded recorded history, excludes future items and performs no writes',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated(),now=Date.now(),day=864e5;
 try{
  await seedDatabase(db,undefined,now-day);
  const id=(await db.prepare("SELECT id FROM entities WHERE vertical='ai' AND slug='claude'").first()).id;
  const events=Array.from({length:23},(_,i)=>({kind:'other',title:{en:`Recorded item ${String(i).padStart(2,'0')}`},starts:new Date(now-(i+1)*3600000).toISOString(),ends:new Date(now-i*3600000-1800000).toISOString(),status:'ended',url:`https://status.claude.com/incidents/fixture-${i}`,entities:[id],ver:'OFFICIAL',src:'src:history-fixture'}));
  events.push({kind:'other',title:{en:'FUTURE_ITEM_MUST_NOT_APPEAR'},starts:new Date(now+day).toISOString(),status:'confirmed',entities:[id],src:'src:history-fixture'});
  events.push({kind:'other',title:{en:'OLD_ITEM_MUST_NOT_APPEAR'},starts:new Date(now-20*day).toISOString(),ends:new Date(now-19*day).toISOString(),status:'ended',entities:[id],src:'src:history-fixture'});
  for(let i=0;i<22;i++)events.push({kind:'other',title:{en:`UNVERIFIED_ITEM_${i}_MUST_NOT_APPEAR`},starts:new Date(now-60000-i*1000).toISOString(),status:'confirmed',ver:'COMMUNITY',entities:[id],src:'src:history-fixture'});
  const doc={schema:'nerulio.seed/1',vertical:'ai',sources:[{id:'src:history-fixture',kind:'OFFICIAL_API',url:'https://status.claude.com/history.atom',title:'Official incident fixture',publisher:'Fixture',retrieved:new Date(now).toISOString().slice(0,10)}],entities:[],events};
  await ingest(db,doc,{mode:'collector',actor:'collector:history-fixture',now});
  assert((await eventsFor(db,[id],{desc:true,limit:50})).some(e=>e.verification==='COMMUNITY'),'other readers retain their existing verification behavior');
  const before=db.rowsWritten,total=db.raw.prepare('SELECT total_changes() AS n').get().n;
  const stored=db.raw.prepare('SELECT id,starts_at,ends_at,status FROM events ORDER BY id').all();
  let background=0;
  for(const l of ['ko','en']){
   const path=`/${l}/ai/claude/status`,res=await handlePublicPage(new Request('https://nerulio.com'+path),{DB:db},{waitUntil(){background++;}},{origin:'https://nerulio.com'});
   assert.equal(res.status,200);const body=await res.text();
   const title=l==='ko'?'Claude — 공식 장애 이력':'Claude — Official incident history';assert(body.includes(`<h1>${title}</h1>`));
   assert(body.includes(`href="https://nerulio.com${path}"`));assert(body.includes(`href="/${l}/ai/claude/"`));
   const history=body.indexOf('data-incident-history');assert(history>0&&history<body.indexOf(l==='ko'?'확인된 정보':'Reference facts'));
   assert.equal((body.match(/<li class="pad"><h3>Recorded item/g)||[]).length,20);
   assert(body.indexOf('Recorded item 00')<body.indexOf('Recorded item 01'));
   assert(body.includes('Recorded item 19'));assert(!body.includes('Recorded item 20'));
   assert(!body.includes('FUTURE_ITEM_MUST_NOT_APPEAR'));assert(!body.includes('OLD_ITEM_MUST_NOT_APPEAR'));
   assert(!body.includes('UNVERIFIED_ITEM_'),'only verified official entries qualify before the 20-entry limit');
   assert(!/data-island="(?:account|follow|compat-vote)"|href="[^\"]*\/community\//.test(body));
  }
  assert.equal(background,0,'history reads must not restart the retired refresh/notification path');
  assert.equal(db.rowsWritten,before);assert.equal(db.raw.prepare('SELECT total_changes() AS n').get().n,total);
  assert.deepEqual(db.raw.prepare('SELECT id,starts_at,ends_at,status FROM events ORDER BY id').all(),stored);
 }finally{db.raw.close();}
});

test('the day strip counts listed entries per calendar day and never calls an empty day incident-free',async()=>{
 const {incidentDays,HISTORY_DAYS}=await import('../platform/render/incident-history.js');
 const now=Date.parse('2026-11-15T03:00:00Z'),at=(/** @type {string} */ s)=>Date.parse(s);
 const events=[
  {...event},// 23:45–00:15 UTC on Nov 13–14 → both UTC days, but one KST day (Nov 14 08:45–09:15)
  {...event,starts_at:at('2026-11-10T10:00:00Z'),ends_at:null,status:'confirmed'},// no end: start day only
  {...event,starts_at:at('2026-11-01T12:00:00Z'),ends_at:at('2026-11-03T12:00:00Z')},// starts before the window, ends inside it
  {...event,starts_at:at('2026-11-12T00:00:00Z'),ends_at:null,precision:'day'},// a date-only record keeps its calendar date in both zones
  {...event,starts_at:at('2026-11-01T00:00:00Z'),ends_at:null,precision:'month'},// too coarse to place
  {...event,starts_at:null,ends_at:null},// no start
 ];
 const en=incidentDays(events,now,'en'),ko=incidentDays(events,now,'ko');
 const on=(/** @type {{days:{date:string,count:number}[]}} */ r)=>Object.fromEntries(r.days.filter(d=>d.count).map(d=>[d.date,d.count]));
 assert.equal(en.days.length,HISTORY_DAYS);assert.equal(en.days[0].date,'2026-11-02');assert.equal(en.days.at(-1)?.date,'2026-11-15');
 assert.deepEqual(on(en),{'2026-11-02':1,'2026-11-03':1,'2026-11-10':1,'2026-11-12':1,'2026-11-13':1,'2026-11-14':1});
 assert.deepEqual(on(ko),{'2026-11-02':1,'2026-11-03':1,'2026-11-10':1,'2026-11-12':1,'2026-11-14':1});
 assert.equal(en.unplaced,2);assert.equal(ko.unplaced,2);
 // 03:00 UTC is already Nov 15 in Seoul; one hour before 15:00 UTC the KST day has not turned yet.
 assert.equal(incidentDays([],Date.parse('2026-11-15T14:59:00Z'),'ko').days.at(-1)?.date,'2026-11-15');
 assert.equal(incidentDays([],Date.parse('2026-11-15T15:00:00Z'),'ko').days.at(-1)?.date,'2026-11-16');
 // An entry entirely outside the window is not placed.
 assert.deepEqual(incidentDays([{...event,starts_at:at('2026-10-01T00:00:00Z'),ends_at:at('2026-10-01T01:00:00Z')}],now,'en').unplaced,1);
 for(const l of ['ko','en']){
  const body=String(renderIncidentHistory(events,l,now));
  assert.equal((body.match(/class="ih-d( on)?"/g)||[]).length,HISTORY_DAYS);
  assert.equal((body.match(/class="ih-d on"/g)||[]).length,l==='ko'?5:6);
  assert(body.includes(l==='ko'?'빈 칸은 수집된 기록이 없다는 뜻이며, 그날 장애가 없었다는 뜻이 아닙니다':'An empty cell means nothing was collected, not that there was no incident that day'));
  assert(body.includes(l==='ko'?'날짜를 특정할 수 없거나 이 14일 밖에 있는 기록 2개는 넣지 않았습니다':'2 entries with no usable date or outside these 14 days are not placed'));
  assert(body.includes(l==='ko'?'11월 2일 – 11월 15일 (KST)':'Nov 2 – Nov 15 (UTC)'));
  assert(!/정상|장애 없음|all systems|operational|incident-free/i.test(body),'no availability claim');
  const empty=String(renderIncidentHistory([],l,now));
  assert.equal((empty.match(/class="ih-d"/g)||[]).length,HISTORY_DAYS);assert(!empty.includes('ih-d on'));
  assert(empty.includes(l==='ko'?'수집된 기록 없음':'nothing collected'));
  assert(!String(renderIncidentHistory(events,l)).includes('data-incident-days'),'no strip without a clock');
 }
});
