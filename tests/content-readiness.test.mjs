import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {renderPlatformPage,renderSitemap} from '../server/platform/pages.js';
import {createPost} from '../platform/community.js';
import {policyContent,ACCOUNTS_PRIVACY,SERVICE_PRIVACY,COMMUNITY_PRIVACY_NOTE} from '../src/policies.js';
import {renderHomeContent} from '../platform/render/home-content.js';
import {ALL_ROUTES} from '../tools/build.mjs';

const origin='https://nerulio.example.test';

test('homepage links resolve to registered production routes rather than the entry renderer fallback',()=>{
 const routes=new Set([...ALL_ROUTES,'ko/tools','en/tools']);
 for(const locale of ['ko','en'])for(const [,href] of String(renderHomeContent(locale)).matchAll(/href="([^"]+)"/g)){
  const path=new URL(href,origin).pathname.replace(/^\/+|\/+$/g,'');
  assert(routes.has(path),`${locale}: ${href} is not a production route`);
 }
});

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

test('public privacy leads with closure and does not describe community uploads as an available action',()=>{
 const original=JSON.stringify({ACCOUNTS_PRIVACY,SERVICE_PRIVACY,COMMUNITY_PRIVACY_NOTE});
 const active={
  en:['Images you explicitly attach to community posts are uploaded separately.','When you open the account page or the community,','When you post, comment, vote, report or upload an image'],
  ko:['커뮤니티 글에 직접 첨부하는 이미지는 별도로 업로드됩니다.','계정 페이지나 커뮤니티를 열면','커뮤니티에서 로그인하지 않고 글·댓글·추천·신고·이미지를 올리면'],
  ja:['コミュニティの投稿に明示的に添付する画像は別途アップロードされます。','アカウントページやコミュニティを開くと','コミュニティでログインせずに投稿・コメント・投票・通報・画像のアップロードをすると']
 };
 for(const locale of ['ko','en','ja'])for(const service of [false,true,'accounts']){
  const body=policyContent('privacy',locale,false,service,false,false,true);
  assert(body.indexOf('class="community-closed"')<body.indexOf('<section>'),'closure precedes processing details');
  for(const text of active[locale])assert(!body.includes(text),`${locale}/${service}: obsolete active-community wording`);
  for(const retained of ['Cloudflare R2','90','IPv4 /24','IPv6 /48','localStorage'])assert(body.includes(retained),`${locale}: retained-data disclosure remains`);
  assert(!policyContent('privacy',locale,false,service,false,false,false).includes('class="community-closed"'));
 }
 assert.equal(JSON.stringify({ACCOUNTS_PRIVACY,SERVICE_PRIVACY,COMMUNITY_PRIVACY_NOTE}),original,'public copy must not mutate service templates or retention rules');
});
