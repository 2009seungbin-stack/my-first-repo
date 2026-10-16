import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {configuration} from './site-config.mjs';
import {SITEMAP_FILES} from './sitemaps.mjs';
import {PLATFORM_SITEMAPS} from '../platform/seo.js';
import {waitForCommit} from './live-check.mjs';
/** IndexNow (Bing, Yandex, Naver, Seznam…) after a production deploy. Deploy-time only. The ownership
 * key file is public by protocol, not an API credential. There is no Google submission API: Google
 * reads the sitemap index from robots.txt / Search Console.
 *
 *   node tools/indexnow.mjs                         dry run: every page URL of dist/
 *   node tools/indexnow.mjs --since ../previous/dist  new, changed and removed static canonical URLs
 *                                                   compared with the build of the previous deploy
 *   … --wait-live                                   first poll the live site until it serves this
 *                                                   build's sitemaps (the deploy has finished)
 *   … --submit                                      POST to api.indexnow.org (checks the key file first)
 * .github/workflows/indexnow.yml runs `--since … --wait-live --submit` on every push to main. */
const locs=xml=>[...xml.matchAll(/<(?:url|sitemap)>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map(m=>[m[1].replaceAll('&amp;','&'),m[2]||'']);
const dynamicSitemaps=new Set(PLATFORM_SITEMAPS);
const staticSitemaps=new Set(Object.values(SITEMAP_FILES));
/** Page URLs → lastmod of a built site: follows sitemap.xml when it is an index (the image sitemap
 * lists pages, not new URLs, and is skipped); an older build's single urlset works too. Known D1
 * sitemaps exist only in the Worker, so they are never part of a static deployment comparison. */
export async function builtPages(dist='dist'){
 const index=await readFile(path.join(dist,'sitemap.xml'),'utf8');
 if(!index.includes('<sitemapindex'))return new Map(locs(index));
 const pages=new Map();
 for(const [url] of locs(index)){
  const name=decodeURIComponent(new URL(url).pathname.split('/').pop());
  if(name===SITEMAP_FILES.images||dynamicSitemaps.has(name))continue;
  const file=path.join(dist,name);
  if(!existsSync(file))throw Error(`The index lists ${name} but ${file} does not exist`);
  for(const [loc,lastmod] of locs(await readFile(file,'utf8')))pages.set(loc,lastmod);
 }
 return pages;
}
/** IndexNow accepts additions, updates and deletions. A URL removed from the static sitemap may
 * also have become a redirect, noindex page, or a platform route; notifying it lets the engine
 * retrieve its current state. D1-only changes need a separate data-change submission/snapshot. */
export function changedSince(now,before){return [...now].filter(([u,d])=>!before.has(u)||before.get(u)!==d).map(([u])=>u).concat([...before.keys()].filter(u=>!now.has(u)));}
export function submission(config,xmlOrUrls) {
  if(config.preview||!config.siteURL||!config.indexNowKey)throw Error('Production SITE_URL and INDEXNOW_KEY are required');
  const site=new URL(config.siteURL);
  const urls=Array.isArray(xmlOrUrls)?xmlOrUrls:locs(xmlOrUrls).map(([u])=>u);
  if(!urls.length||urls.length>10000||urls.some(v=>{const u=new URL(v);return u.origin!==site.origin||!u.pathname.startsWith(site.pathname)||u.search||u.hash;}))throw Error('Invalid sitemap URL set');
  return {host:site.host,key:config.indexNowKey,keyLocation:new URL(config.indexNowKey+'.txt',site).href,urlList:[...new Set(urls)]};
}
/** Page URL → lastmod from the live canonical inventory. Fetch only this site's known sitemap
 * files; includeDynamic=false compares the static deploy without D1 updates or query pages. */
export async function livePages(siteURL,{includeDynamic=true,fetcher=fetch}={}){
 const site=new URL(siteURL);
 const get=async u=>{const r=await fetcher(u,{cache:'no-store',redirect:'error'});if(!r.ok)throw Error(`${u}: HTTP ${r.status}`);return r.text();};
 const index=await get(new URL('sitemap.xml',siteURL));
 if(!index.includes('<sitemapindex'))return new Map(locs(index));
 const pages=new Map();
 for(const [url] of locs(index)){
  const parsed=new URL(url),name=decodeURIComponent(parsed.pathname.split('/').pop());
  if(parsed.href!==new URL(name,site).href||(!staticSitemaps.has(name)&&!dynamicSitemaps.has(name)))throw Error(`Unexpected live sitemap URL: ${url}`);
  if(name===SITEMAP_FILES.images||!includeDynamic&&dynamicSitemaps.has(name))continue;
  for(const [loc,lastmod] of locs(await get(url)))pages.set(loc,lastmod);
 }
 return pages;
}
/** Resolves once the live site lists every page of this build with this build's lastmod, i.e. the
 * static deploy has finished. Removed static URLs must leave the static inventory too, even if
 * a dynamic platform sitemap now lists that URL (for example the portal home). */
export async function waitLive(config,pages,{removed=[],timeoutMs=30*60e3,everyMs=20e3,fetcher=fetch}={}){
 const until=Date.now()+timeoutMs;
 for(;;){
  let missing=pages.size+removed.length,read=false;
  try{const live=await livePages(config.siteURL,{includeDynamic:false,fetcher});missing=[...pages].filter(([u,d])=>!live.has(u)||live.get(u)!==d).length+removed.filter(u=>live.has(u)).length;read=true;}catch(e){console.log(String(e?.message||e));}
  if(read&&!missing){console.log(`The live static sitemaps match all ${pages.size} pages and ${removed.length} removals of this build.`);return;}
  if(Date.now()>=until)throw Error(`After ${timeoutMs/60e3} minutes the live static sitemaps still differ from this build on ${missing} pages: the deploy did not finish, or production was built from other settings. Nothing was submitted.`);
  console.log(`Waiting for the deploy: ${missing} of ${pages.size} pages not live yet.`);
  await new Promise(r=>setTimeout(r,everyMs));
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
  const config=configuration(),pages=await builtPages('dist'),since=arg('--since');
  const before=since&&existsSync(path.join(since,'sitemap.xml'))?await builtPages(since):new Map();
  const removed=[...before.keys()].filter(u=>!pages.has(u));
  const urls=since?changedSince(pages,before):[...pages.keys()];
  if(!urls.length){console.log('No new, changed or removed static page URLs since the previous build; nothing to submit.');process.exit(0);}
  const body=submission(config,urls);
  if(!process.argv.includes('--submit'))console.log(`Dry run: ${body.urlList.length} ${since?'new, changed or removed static':'static canonical'} URLs for ${body.host}. Pass --submit after deployment.\n${body.urlList.slice(0,20).join('\n')}${body.urlList.length>20?'\n…':''}`);
  else {
    if(process.argv.includes('--wait-live')){
      if(process.env.LIVE_COMMIT)await waitForCommit(config.siteURL,process.env.LIVE_COMMIT.trim());
      await waitLive(config,pages,{removed});
    }
    const key=await fetch(body.keyLocation);if(!key.ok||(await key.text()).trim()!==body.key)throw Error('Deploy and verify the public ownership file first');
    const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(body)});
    if(![200,202].includes(response.status))throw Error(`IndexNow HTTP ${response.status}`);
    console.log(`IndexNow accepted ${body.urlList.length} URLs (HTTP ${response.status}); this does not guarantee indexing.`);
  }
}
