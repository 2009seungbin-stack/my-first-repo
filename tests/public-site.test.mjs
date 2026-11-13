import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1Shim} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {insertDemoContent} from '../tools/platform/demo-posts.mjs';
import {handlePublicPage,retiredCommunityResponse,homePublishing} from '../server/platform/public.js';
import {useDigestArticles} from '../platform/digest.js';

const origin='https://nerulio.com';
const request=(path,method='GET')=>new Request(origin+path,{method});
const site={origin};

test('retired pages, images and all public community API methods return 410 before any database access',async()=>{
 const paths=['/ko/community/','/en/community/free/1','/ko/community/ai/write','/ko/community/u/name','/u/12345678/full.jpg','/ko/ai/claude/write','/ko/ai/claude/1','/ko/ai/claude/feed.xml'];
 for(const path of paths)for(const method of ['GET','HEAD','POST']){
  const r=await handlePublicPage(request(path,method),{get DB(){throw Error('must not read DB');}},null,site);
  assert.equal(r.status,410,`${method} ${path}`);assert.match(r.headers.get('x-robots-tag'),/noindex/);
 }
 for(const path of ['posts','comments','votes','reports','uploads','profile','follow','tags/propose','facts/propose','rollout','posts/source','my-radar','state','anon/check']){
  for(const method of ['GET','POST','PUT','DELETE']){
   const r=retiredCommunityResponse(request('/api/v2/'+path,method));
   assert.equal(r.status,410);assert.equal((await r.json()).error.code,'COMMUNITY_CLOSED');
  }
 }
 for(const path of ['/api/v2/hit','/api/v2/admin/me','/api/v1/me','/ko/image/compress/'])assert.equal(retiredCommunityResponse(request(path)),null);
 // Check the production entry, not just a helper unused by the deployed Worker.
 const entry=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
 assert(entry.indexOf('retiredCommunityResponse(request)')<entry.indexOf('return handlePlatformApi(request'));
 assert(entry.includes('await handlePublicPage(request'));
});

test('home exposes only published commentary and system news; former boards never leak into navigation or stories',async()=>{
 const db=D1Shim.migrated();
 try{
  await seedDatabase(db);await insertDemoContent(db,Date.now());
  await db.prepare("UPDATE discussions SET title='HUMAN_POST_MUST_STAY_CLOSED' WHERE author_id NOT LIKE 'system:%'").run();
  const before=(await db.prepare('SELECT COUNT(*) AS n FROM discussions').first()).n;
  const article={slug:'reviewed-example',locale:'ko',date:'2026-11-13',updated:'2026-11-13',title:'Published commentary fixture',summary:'A reviewed test fixture.',status:'published',sources:[{title:'Source',url:'https://example.test/'}],body:'Reviewed fixture text.'};
  useDigestArticles([article,{...article,slug:'draft-secret',title:'DRAFT_MUST_NOT_LEAK',status:'draft'}]);
  const m=await homePublishing(db,'ko');assert(m.news.length>0);assert(m.news.every(p=>p.bot));
  for(const path of ['/','/en/','/ko/news/','/ko/ai/','/ko/ai/claude/','/ko/ai/claude/status','/ko/ai/digest/','/ko/ai/digest/reviewed-example/','/ko/hardware/performance/','/ko/bracket/','/ko/radar/']){
   const r=await handlePublicPage(request(path),{DB:db},null,site);assert.equal(r.status,200,path);
   const body=await r.text();
   assert(!body.includes('HUMAN_POST_MUST_STAY_CLOSED'),path);assert(!body.includes('DRAFT_MUST_NOT_LEAK'),path);
   assert(!/href="[^"#]*\/community\//.test(body),path);
   assert(!body.includes('platform/islands.js'),path);
   assert(!/data-island="(?:account|follow|bench-form|my-radar|channel-sheet|channel-bar)"/.test(body),path);
   if(path==='/'){assert(body.includes('data-home-news'));assert(body.includes('data-home-digest'));assert(body.includes('Published commentary fixture'));}
  }
  const news=m.news.find(p=>!p.url);assert(news);const nr=await handlePublicPage(request(`/ko/news/${news.channel_id}/${news.channel_no}`),{DB:db},null,site);
  assert.equal(nr.status,200);assert(!/comment-form|data-island="vote"/.test(await nr.text()));
  const human=await db.prepare("SELECT channel_id,channel_no FROM discussions WHERE author_id NOT LIKE 'system:%' LIMIT 1").first();
  assert.equal((await handlePublicPage(request(`/ko/news/${human.channel_id}/${human.channel_no}`),{DB:db},null,site)).status,404);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM discussions').first()).n,before);
  const sitemap=await(await handlePublicPage(request('/sitemap-n2-ai.xml'),{DB:db},null,site)).text();
  assert(!sitemap.includes('/community/'));assert(!sitemap.includes('/ko/news/'));assert(sitemap.includes('reviewed-example'));assert(!sitemap.includes('draft-secret'));
 }finally{useDigestArticles([]);db.raw.close();}
});

test('empty streams stay honest and unindexed while the home keeps working',async()=>{
 const db=D1Shim.migrated();useDigestArticles([]);
 try{
  const home=await(await handlePublicPage(request('/'),{DB:db},null,site)).text();
  assert(home.includes('아직 게시된 뉴스가 없습니다.'));assert(home.includes('아직 게시된 해설이 없습니다.'));
  for(const path of ['/ko/news/','/ko/ai/digest/']){
   const r=await handlePublicPage(request(path),{DB:db},null,site);assert.equal(r.status,200);
   assert.match(await r.text(),/<meta name="robots" content="noindex,follow">/);
  }
 }finally{db.raw.close();}
});

test('a data failure returns a retryable error rather than claiming there are no articles',async()=>{
 const r=await handlePublicPage(request('/'),{DB:{prepare(){throw Error('fixture database unavailable');}}},null,site);
 assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('retry-after'),'30');
 assert(!((await r.text()).includes('아직 게시된')));
});
