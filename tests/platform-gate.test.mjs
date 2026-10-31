import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {insertDemoContent} from '../tools/platform/demo-posts.mjs';
import {ingest,mergeDescriptionSrc} from '../platform/ingest.js';
import {contentCounts,sitemapEntities} from '../platform/db/channel.js';
import {entityIndexable} from '../platform/seo.js';
import {VERTICALS} from '../platform/schema.js';
import {matchPlatformRoute,renderPlatformPage,renderSitemap} from '../server/platform/pages.js';

const NOW=Date.UTC(2026,8,28,6,0),origin='https://nerulio.com';
const skip=!sqliteAvailable;
const src=[{id:'src:t',kind:'OFFICIAL',url:'https://example.test/',retrieved:'2026-09-28'}];
const doc=(/** @type {any} */ e)=>({schema:'nerulio.seed/1',vertical:'ai',sources:src,entities:[{type:'provider',slug:'x',names:{en:'X'},...e}]});
const srcOf=async(/** @type {any} */ d,/** @type {string} */ id)=>JSON.parse((await d.prepare('SELECT description_src FROM entities WHERE id=?').bind(id).first()).description_src);

test('mergeDescriptionSrc marks only the locales a collected document states',()=>{
 assert.deepEqual(mergeDescriptionSrc({},{en:'a'},'collected'),{en:'collected'});
 assert.deepEqual(mergeDescriptionSrc({en:'collected',ko:'collected'},{ko:'b'},'editor'),{en:'collected'},'an editor text replaces the collected one for that locale only');
 assert.deepEqual(mergeDescriptionSrc({en:'collected'},{ko:'b'},'collected'),{en:'collected',ko:'collected'});
 assert.deepEqual(mergeDescriptionSrc({en:'collected'},{en:null},'collected'),{},'removing a description removes its mark');
});

test('ingest records whether a description was collected or written by an editor',{skip},async()=>{
 const d=D1Shim.migrated();
 await ingest(d,doc({id:'provider:a',slug:'a',description:{en:'Seed text',ko:'시드'}}),{mode:'seed',actor:'seed',now:NOW});
 assert.deepEqual(await srcOf(d,'provider:a'),{},'seed text is editorial by default');
 await ingest(d,doc({id:'provider:b',slug:'b',description:{en:'Collected text'}}),{mode:'collector',actor:'collector:t',adapter:'t',now:NOW});
 assert.deepEqual(await srcOf(d,'provider:b'),{en:'collected'});
 await ingest(d,doc({id:'provider:c',slug:'c',description:{en:'Generated',ko:'생성'},description_origin:'collected'}),{mode:'seed',actor:'seed',now:NOW});
 assert.deepEqual(await srcOf(d,'provider:c'),{en:'collected',ko:'collected'},'a seed entity can declare its description as collected');
 // A later editor text for one locale takes over that locale; a collector re-run marks unmarked rows.
 await ingest(d,doc({id:'provider:c',slug:'c',description:{ko:'사람이 쓴 설명'}}),{mode:'admin',actor:'admin:u',now:NOW+1});
 assert.deepEqual(await srcOf(d,'provider:c'),{en:'collected'});
 await ingest(d,doc({id:'provider:a',slug:'a',description:{en:'Seed text',ko:'시드'}}),{mode:'collector',actor:'collector:t',adapter:'t',now:NOW+2});
 assert.deepEqual(await srcOf(d,'provider:a'),{en:'collected',ko:'collected'});
});

test('the seeded Steam store sentences are marked collected, so they never make a game indexable',{skip},async()=>{
 const d=D1Shim.migrated();await seedDatabase(d,undefined,NOW);
 const r=await d.prepare("SELECT COUNT(*) AS n,SUM(description_src LIKE '%collected%') AS c FROM entities WHERE id LIKE 'game:steam-%' AND descriptions<>'{}'").first();
 assert(r.n>200&&r.n===r.c,`${r.c}/${r.n}`);
 const curated=await d.prepare("SELECT COUNT(*) AS n FROM entities WHERE vertical='ai' AND description_src<>'{}'").first();
 assert.equal(curated.n,0,'curated seed descriptions stay editorial');
});

test('changes remember which ingest mode produced them',{skip},async()=>{
 const d=D1Shim.migrated();
 await ingest(d,doc({id:'provider:a',slug:'a',facts:[{p:'hq_country',v:'US',ver:'OFFICIAL',src:'src:t'}]}),{mode:'seed',actor:'seed',now:NOW});
 await ingest(d,doc({id:'provider:a',slug:'a',facts:[{p:'hq_country',v:'KR',ver:'OFFICIAL',src:'src:t'}]}),{mode:'collector',actor:'collector:t',adapter:'t',now:NOW+1});
 const rows=d.raw.prepare('SELECT kind,origin FROM changes ORDER BY id').all().map((/** @type {any} */ r)=>`${r.kind}:${r.origin}`);
 assert.deepEqual(rows,['entity_added:seed','fact_added:seed','fact_changed:collector']);
});

async function community(){
 const d=D1Shim.migrated();await seedDatabase(d,undefined,NOW-2*864e5);await insertDemoContent(d,NOW);
 return d;
}

test('content counts exclude the Radar bot and one-tap issue reports',{skip},async()=>{
 const d=await community();
 const id='service:claude';
 const human=Number((await d.prepare("SELECT COUNT(*) AS n FROM discussion_tags t JOIN discussions x ON x.id=t.discussion_id WHERE t.entity_id=? AND x.status='published' AND x.author_id NOT LIKE 'system:%'").bind(id).first()).n);
 const c=await contentCounts(d,id);
 assert.equal(c.posts,human);assert(human>=3);
 const issues=Number((await d.prepare("SELECT COUNT(*) AS n FROM community_reports WHERE entity_id=? AND kind='issue'").bind(id).first()).n);
 assert(issues>0,'the demo has outage reports');
 assert.equal(c.contributions,Number((await d.prepare("SELECT COUNT(*) AS n FROM community_reports WHERE entity_id=? AND kind IN ('compat','benchmark') AND status='published'").bind(id).first()).n));
});

test('robots meta and entity sitemaps agree on seed data with community activity',{skip},async()=>{
 const d=await community();
 // Editorial history for an indexable GPU (3 admin changes) and collector-only history for another entity.
 const ins=d.raw.prepare("INSERT INTO changes (entity_id,vertical,kind,property,importance,visibility,effective_at,detected_at,origin) VALUES (?,?,'fact_changed','vram_gb',2,'public',?,?,?)");
 for(let i=0;i<3;i++)ins.run('gpu:rtx-5070','hardware',NOW-i,NOW-i,'admin');
 for(let i=0;i<5;i++)ins.run('service:claude','ai',NOW-i,NOW-i,'collector');
 const get=async(/** @type {string} */ url)=>{const r=await renderPlatformPage(new Request(url),{DB:d},{origin,now:()=>NOW});return r?String(await r.text()):null;};
 const robots=(/** @type {string} */ h)=>/<meta name="robots" content="[^"]*noindex/.test(h);
 let listed=0;const seen=new Set();
 for(const v of VERTICALS){
  const xml=await renderSitemap(d,v,origin);
  const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
  for(const url of urls){
   const u=new URL(url);if(!matchPlatformRoute(u.pathname))continue;
   const html=await get(url);
   assert(html,`${url} renders`);
   assert(!robots(html),`${url} is in the ${v} sitemap but renders noindex`);
   seen.add(u.pathname);listed++;
  }
 }
 assert(listed>10,`sitemaps list pages (${listed})`);
 for(const p of ['/ko/ai/claude/','/en/ai/claude/','/ko/ai/claude/status','/ko/hardware/rtx-5070/','/en/hardware/rtx-5070/history','/ko/hardware/rtx-5070/history','/ko/hardware/rtx-5070/local-llm'])assert(seen.has(p)||seen.has(p+'/'),`${p} is listed`);
 assert(!seen.has('/ko/ai/claude/history')&&!seen.has('/en/ai/claude/history'),'collector-only history is not listed');
 assert(robots(await get(origin+'/ko/ai/claude/history')),'collector-only history is noindex');
 // The reverse direction for entity pages: noindex pages are exactly those the sitemap leaves out.
 for(const v of VERTICALS){
  const rows=await sitemapEntities(d,v);
  for(const e of rows.slice(0,40))for(const l of ['ko','en']){
   const path=`/${l}/${e.vertical}/${e.slug}/`,html=await get(origin+path);
   if(!html)continue;
   const ok=entityIndexable(e,e,l);
   assert.equal(!robots(html),ok,path);
   assert.equal(seen.has(path),ok,path);
  }
 }
});

test('no seeded entity is indexable on seed data alone (local measurement)',{skip},async()=>{
 const d=D1Shim.migrated();await seedDatabase(d,undefined,NOW);
 for(const v of VERTICALS){
  const rows=await sitemapEntities(d,v);
  for(const l of ['ko','en'])assert.equal(rows.filter(e=>entityIndexable(e,e,l)).length,0,`${v}/${l}: curated one-sentence seed descriptions and collected facts are not enough`);
 }
});
