import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {insertDemoContent} from '../tools/platform/demo-posts.mjs';
import {renderPlatformPage} from '../server/platform/pages.js';
import {PREVIEW_PATHS} from '../tools/platform/preview.mjs';

// Every internal link on the platform pages leads somewhere: crawl from the preview pages and
// render each link through the router (links outside the platform fall through to the static site).
test('platform pages link only to pages that render',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated(),now=Date.parse('2026-09-28T12:00:00Z');
 await seedDatabase(db,undefined,now-2*864e5);await insertDemoContent(db,now);
 const O='https://nerulio.com',seen=new Set(),queue=PREVIEW_PATHS.map(([p])=>p),bad=[];
 while(queue.length&&seen.size<150){
  const p=/** @type {string} */(queue.shift());if(seen.has(p))continue;seen.add(p);
  const r=await renderPlatformPage(new Request(O+p),{DB:db},{origin:O,now:()=>now});
  if(!r)continue;
  if(r.status>=400)bad.push(`${p} → ${r.status}`);
  if(r.status!==200)continue;
  for(const m of (await r.text()).matchAll(/href="(\/(?:ko|en)\/[^"#]*)/g)){const u=m[1].replace(/&amp;/g,'&');if(!seen.has(u))queue.push(u);}
 }
 assert.deepEqual(bad,[]);
 assert(seen.size>=100,`crawled ${seen.size}`);
});
