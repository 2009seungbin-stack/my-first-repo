import test from 'node:test';
import assert from 'node:assert/strict';
import {versionLabel} from '../platform/version-source.js';
import {collapseVersions} from '../platform/render/format.js';
import {versionsOf,recentVersions} from '../platform/db/channel.js';
import {releaseNews} from '../platform/news.js';
import {loadRadar,renderRadar} from '../platform/render/radar.js';
import {radarFeed} from '../platform/render/feed.js';
import {renderPublishing} from '../server/platform/public.js';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';

test('source channel labels distinguish prereleases and tags without guessing stability',()=>{
 for(const l of ['ko','en']){
  const pre=l==='ko'?'사전공개':'pre-release',tag=l==='ko'?'소스 태그':'source tag';
  assert.equal(versionLabel('release','prerelease',l),pre);
  assert.equal(versionLabel('tag','stable',l),tag);
  assert.equal(versionLabel('tag','prerelease',l),tag+' · '+pre);
  for(const channel of ['stable','unknown',undefined])assert(!versionLabel('release',channel,l).includes(pre));
 }
});

test('same-day build collapsing keeps distinct release channels and missing metadata separate',()=>{
 const entity={id:'runtime:probe'},released_at=Date.parse('2026-11-09T00:00:00Z');
 const row=(version,channel)=>({version,channel,released_at,entity});
 const input=[row('1.1-rc2','prerelease'),row('1.0.1','stable'),row('1.1-rc1','prerelease'),row('1.0.0','stable'),row('nightly-1','nightly'),row('unknown-1',undefined)];
 for(const l of ['ko','en']){
  const out=collapseVersions(input,l);assert.equal(out.length,4);
  assert.match(out.find(r=>r.channel==='prerelease').version,/1\.1-rc1 → 1\.1-rc2/);
  assert.match(out.find(r=>r.channel==='stable').version,/1\.0\.0 → 1\.0\.1/);
  assert.equal(out.find(r=>r.channel==='nightly').version,'nightly-1');
  assert.equal(out.find(r=>r.channel===undefined).version,'unknown-1');
 }
 assert.deepEqual(input.map(r=>r.version),['1.1-rc2','1.0.1','1.1-rc1','1.0.0','nightly-1','unknown-1']);
});

test('real D1 channels reach public news, Radar and RSS without merging stable/pre-release records or writing history',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated(),now=Date.now(),day=Math.floor(now/864e5)*864e5;
 const entities=[{id:'runtime:probe',vertical:'ai',type:'runtime',slug:'probe',names:{ko:'검증 도구',en:'Probe'}},{id:'app:blender',vertical:'studio',type:'app',slug:'blender',names:{ko:'블렌더',en:'Blender'}}];
 try{
  for(const e of entities)await db.prepare('INSERT INTO entities (id,vertical,type,slug,names,created_at,updated_at) VALUES (?,?,?,?,?,0,0)').bind(e.id,e.vertical,e.type,e.slug,JSON.stringify(e.names)).run();
  for(const [version,channel,offset] of [['1.0.0','stable',0],['1.0.1','stable',0],['1.1-rc1','prerelease',1],['1.1-rc2','prerelease',2]])await db.prepare('INSERT INTO versions (entity_id,version,channel,released_at,notes_url,verification,detected_at) VALUES (?,?,?,?,?,?,?)').bind(entities[0].id,version,channel,day+offset,'https://example.com/releases/'+version,'OFFICIAL',day).run();
  await db.prepare('INSERT INTO versions (entity_id,version,channel,released_at,notes_url,verification,detected_at) VALUES (?,?,?,?,?,?,?)').bind(entities[1].id,'5.3.0','stable',day,'https://projects.blender.org/blender/blender/releases/tag/v5.3.0','OFFICIAL',day).run();
  const writes=db.rowsWritten,stored=JSON.stringify((await db.prepare('SELECT entity_id,version,channel,notes_url FROM versions ORDER BY id').all()).results);
  const all=await recentVersions(db,{since:day-1,until:now,limit:20}),one=await versionsOf(db,entities[0].id);
  assert.equal(all.filter(r=>r.channel==='prerelease').length,2);assert.deepEqual(one.map(r=>r.channel).sort(),['prerelease','prerelease','stable','stable']);
  for(const l of ['ko','en']){
   const pre=l==='ko'?'사전공개':'pre-release',tag=l==='ko'?'소스 태그':'source tag';
   const news=releaseNews(all,l,now),item=news.find(r=>r.id.includes('runtime:probe'));
   assert(item.title.endsWith('— '+pre));assert.equal(item.release_channel,'prerelease');
   const publishing=String(renderPublishing({news,articles:[],excerpts:new Map()},l));assert(publishing.includes(item.title));
   const stable=releaseNews([{...all.find(r=>r.entity.id===entities[0].id),channel:'stable',version:'2.0-rc0'}],l,now)[0];assert(!stable.title.includes(pre),'version spelling does not override source metadata');
   const radar=await loadRadar(db,{l,now});assert.equal(radar.releases.length,3);assert.equal(radar.releases.filter(r=>r.channel==='prerelease').length,1);
   const html=String(renderRadar(radar,{origin:'https://example.com',publicOnly:true}));assert(html.includes('data-release-channel="prerelease"'));assert(html.includes('>'+pre+'</span>'));assert(html.includes('1.0.0 → 1.0.1')&&html.includes('1.1-rc1 → 1.1-rc2'));
   const feed=await radarFeed(db,l,'https://example.com');assert.equal((feed.match(new RegExp('<category>'+pre+'</category>','g'))||[]).length,2);assert(feed.includes('<category>'+tag+'</category>'));assert(feed.includes(l==='ko'?'소스 태그 커밋에 기록된 날짜':'date comes from its source-tag commit'));
  }
  assert.equal(JSON.stringify((await db.prepare('SELECT entity_id,version,channel,notes_url FROM versions ORDER BY id').all()).results),stored);assert.equal(db.rowsWritten,writes);
 }finally{db.raw.close();}
});
