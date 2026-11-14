import test from 'node:test';
import assert from 'node:assert/strict';
import {versionNotes} from '../platform/version-source.js';
import {releaseNews} from '../platform/news.js';
import {versionsOf,recentVersions} from '../platform/db/channel.js';
import {loadRadar,renderRadar} from '../platform/render/radar.js';
import {renderPublishing} from '../server/platform/public.js';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';

const old=v=>`https://projects.blender.org/blender/blender/releases/tag/v${v}`;
const current=v=>`https://projects.blender.org/blender/blender/src/tag/v${v}`;
const now=Date.parse('2026-11-14T00:00:00Z'),day=Date.parse('2026-11-09T00:00:00Z');
const entity={id:'app:blender',vertical:'studio',type:'app',slug:'blender',names:{ko:'블렌더',en:'Blender'}};
const row=(version,at=day,extra={})=>({entity,version,released_at:at,notes_url:old(version),verification:'OFFICIAL',...extra});

test('known Blender release-page observations resolve to actual source tags, idempotently',()=>{
 assert.deepEqual(versionNotes(entity.id,'4.5.16',old('4.5.16')),{url:current('4.5.16'),kind:'tag'});
 assert.deepEqual(versionNotes(entity.id,'v4.5.16',current('4.5.16')),{url:current('4.5.16'),kind:'tag'});
 for(const [id,version,url] of [
  ['app:other','4.5.16',old('4.5.16')],
  [entity.id,'5.3.0',old('4.5.16')],
  [entity.id,'4.5.16','https://projects.blender.org.evil.example/blender/blender/releases/tag/v4.5.16'],
  [entity.id,'4.5.16','https://user:pass@projects.blender.org/blender/blender/releases/tag/v4.5.16'],
  [entity.id,'4.5.16','https://example.com/release'],
 ])assert.deepEqual(versionNotes(id,version,url),{url,kind:'release'});
});

test('same-day source tags choose the highest version without depending on input arrival; invalid rows cannot suppress it',()=>{
 const other={entity:{id:'app:other',names:{en:'Other'}},version:'2.0',released_at:day,notes_url:'https://example.com/release',verification:'OFFICIAL'};
 for(const rows of [[row('4.5.16'),other,row('5.3.0'),row('5.2.4')],[row('5.2.4'),row('5.3.0'),other,row('4.5.16')],[row('v4.5.16',day,{notes_url:old('4.5.16')}),other,row('5.3.0')]]){
  const out=releaseNews([...rows,row('99.0.0',day,{verification:'COMMUNITY'})],'en',now);
  const tags=out.filter(r=>r.source_kind==='tag');assert.equal(tags.length,1);assert.match(tags[0].title,/Blender 5\.3\.0 — source tag/);assert.equal(tags[0].url,current('5.3.0'));assert(out.some(r=>r.url===other.notes_url));
 }
 const latest=releaseNews([row('5.3.0'),row('4.5.16',day+864e5)],'ko',now);assert.match(latest[0].title,/4\.5\.16 — 소스 태그/);
 const credentials=row('4.5.16',day,{notes_url:'https://user:pass@projects.blender.org/blender/blender/releases/tag/v4.5.16'});assert.equal(releaseNews([credentials],'en',now).length,0);
});

test('public publishing distinguishes tag-commit dates from formal release notes in both languages',()=>{
 for(const l of ['ko','en']){
  const news=releaseNews([row('4.5.16')],l,now),html=String(renderPublishing({news,articles:[],excerpts:new Map()},l));
  assert(html.includes(`href="${current('4.5.16')}"`));assert(!html.includes('/releases/tag/'));assert(html.includes(l==='ko'?'태그 커밋에 기록된 날짜':'date comes from its tag commit'));assert(!html.includes(l==='ko'?'공식 릴리스 원문':'original release notes'));assert(html.includes('<time datetime="2026-11-09">'),'the source day is not presented as a measured midnight timestamp');
 }
});

test('old D1 rows stay intact while all version readers repair links and Radar keeps separate source tags',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 try{
  for(const e of [entity,{id:'app:other',vertical:'studio',type:'app',slug:'other',names:{en:'Other'}}])await db.prepare('INSERT INTO entities (id,vertical,type,slug,names,created_at,updated_at) VALUES (?,?,?,?,?,0,0)').bind(e.id,e.vertical,e.type,e.slug,JSON.stringify(e.names)).run();
  for(const r of [row('4.5.16'),row('5.3.0'),...[1,2].map(n=>({entity:{id:'app:other'},version:'1.0.'+n,released_at:day,notes_url:'https://example.com/release'}))])await db.prepare('INSERT INTO versions (entity_id,version,channel,released_at,notes_url,verification,detected_at) VALUES (?,?,?,?,?,?,?)').bind(r.entity.id,r.version,'stable',r.released_at,r.notes_url,'OFFICIAL',day).run();
  const writes=db.rowsWritten,one=await versionsOf(db,entity.id),all=await recentVersions(db,{since:day-1,until:now,limit:20});
  assert(one.every(v=>v.notes_url===current(v.version)));assert(all.filter(v=>v.entity.id===entity.id).every(v=>v.notes_url===current(v.version)));
  const radar=await loadRadar(db,{l:'en',now});assert.equal(radar.releases.length,3);assert.equal(radar.releases.filter(v=>v.entity.id===entity.id).length,2);assert.match(radar.releases.find(v=>v.entity.id==='app:other').version,/1\.0\.1 → 1\.0\.2/);
  const html=String(renderRadar(radar,{origin:'https://example.com',publicOnly:true}));assert(html.includes(current('4.5.16'))&&html.includes(current('5.3.0')));assert(!html.includes('/releases/tag/'));assert(html.includes('Separate LTS and major-version tags remain separate records.'));
  const stored=await db.prepare('SELECT notes_url FROM versions WHERE entity_id=?').bind(entity.id).all();assert(stored.results.every(v=>v.notes_url.includes('/releases/tag/')),'historical observations were not rewritten');assert.equal(db.rowsWritten,writes,'read-side correction performs no writes');
 }finally{db.raw.close();}
});
