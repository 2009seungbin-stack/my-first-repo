import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {renderPlatformPage,renderSitemap} from '../server/platform/pages.js';
import {createPost} from '../platform/community.js';
import {policyContent} from '../src/policies.js';

const origin='https://nerulio.example.test';

test('empty boards stay accessible but leave search discovery; publication and hiding update both gates',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 const get=async path=>{
  const response=await renderPlatformPage(new Request(origin+path),{DB:db},{origin});
  assert.equal(response.status,200,path);return response.text();
 };
 try{
  for(const locale of ['ko','en']){
   const board=await get(`/${locale}/community/free/`);
   assert.match(board,/<meta name="robots" content="noindex,follow">/);
   assert.match(board,/data-board-resources/);
   assert(board.includes(`href="/${locale}/tools/"`));
  }
  let sitemap=await renderSitemap(db,'ai',origin);
  assert(!sitemap.includes('/community/free/'));
  assert(!sitemap.includes('/community/best/'));
  await db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES('reader',NULL,'Reader','github','reader',0)").run();
  await createPost(db,{id:'report',channel:'free',kind:'info',tags:[],title:'Export troubleshooting',body:'A report describing a reproducible export problem and its resolution.',locale:'en',authorId:'reader'},Date.now());
  for(const locale of ['ko','en'])assert(!(await get(`/${locale}/community/free/`)).includes('content="noindex,follow"'));
  sitemap=await renderSitemap(db,'ai',origin);
  for(const locale of ['ko','en'])assert(sitemap.includes(`${origin}/${locale}/community/free/`));
  await db.prepare("UPDATE discussions SET status='hidden' WHERE id='report'").run();
  assert.match(await get('/en/community/free/'),/content="noindex,follow"/);
  assert(!(await renderSitemap(db,'ai',origin)).includes('/community/free/'));
  for(const path of ['/en/community/best/','/en/community/free/best'])assert.match(await get(path),/content="noindex,follow"/);
 }finally{db.raw.close();}
});

test('community privacy disclosure follows the platform even with visit tracking off',()=>{
 for(const locale of ['ko','en','ja']){
  const withCommunity=policyContent('privacy',locale,false,'accounts',false,false,true);
  assert.match(withCommunity,/class="community-privacy"/);
  assert.match(withCommunity,/Cloudflare R2/);
  assert(!withCommunity.includes('class="traffic-status"'));
  assert(!policyContent('privacy',locale,false,false,false,false,false).includes('class="community-privacy"'));
  const about=policyContent('about',locale,false,'accounts',false,false,true);
  assert(about.includes(`href="${locale==='ja'?'ja/':`${locale}/tools/`}"`));
  assert(!policyContent('about',locale).includes(`${locale}/tools/`),'standalone builds link their actual tool directory');
 }
});
