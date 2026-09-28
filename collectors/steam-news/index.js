// @ts-check
/** steam-news — detects game updates from the developer's Steam announcements.
 *
 * Endpoint (documented, no key): ISteamNews/GetNewsForApp v2
 *   https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=<id>&count=50&maxlength=300&feeds=steam_community_announcements
 * Documented at https://partner.steamgames.com/doc/webapi/ISteamNews (appid, maxlength, enddate,
 * count, feeds). `feeds=steam_community_announcements` keeps only posts made by the developer on
 * Steam (no press articles).
 *
 * Per game it writes (partial entity update, the game must already exist in the graph):
 *   - `last_update_at`: UTC day of the newest STABLE update post (exact timestamp in the note),
 *   - `current_build`: the version that newest update post states, only when it states one,
 *   - `versions[]`: stable update posts whose title states a version (notes_url = the post).
 * A new stable version is what moves translation-patch compatibility rows to
 * UNVERIFIED_AFTER_UPDATE in platform/ingest.js. Beta/experimental posts are ignored.
 * Facts are AUTOMATED (classification of posts is heuristic, see parse.js); the source kind is
 * OFFICIAL_API (documented Steam Web API, developer-authored posts). */
import {classify,postDate} from './parse.js';

const HOST='api.steampowered.com';
const sleep=(/** @type {number} */ ms)=>new Promise(r=>setTimeout(r,ms));
export const newsUrl=(/** @type {number} */ appid)=>`https://${HOST}/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=50&maxlength=300&feeds=steam_community_announcements&format=json`;
export const sourceId=(/** @type {number} */ appid)=>`src:steam-news-${appid}`;
const MAX_VERSIONS=8;

/** @param {string} body */
function excerpt(body){
 const items=JSON.parse(body)?.appnews?.newsitems||[];
 return items.slice(0,12).map((/** @type {any} */ n)=>({date:n.date,title:String(n.title||'').slice(0,160),tags:n.tags||[]}));
}

/**
 * Turn news items into facts/versions. Pure; exported for tests.
 * @param {any[]} items newest first (as returned) @param {{appid:number,src:string,name?:string}} o name = the game's English name (skips posts about sibling games)
 * @returns {{facts:any[],versions:any[],updates:number}}
 */
export function updatesFromNews(items,o){
 const posts=[...items].filter(n=>Number.isFinite(n?.date)).sort((a,b)=>b.date-a.date)
  .map(n=>({n,c:classify(n,o.name)})).filter(x=>x.c.update&&x.c.channel==='stable');
 const facts=[],versions=[];
 if(posts.length){
  const latest=posts[0],d=postDate(latest.n.date);
  facts.push({p:'last_update_at',v:d.day,ver:'AUTOMATED',src:o.src,note:`Newest update post: "${String(latest.n.title).slice(0,140)}" (${d.iso}).`});
  if(latest.c.version)facts.push({p:'current_build',v:latest.c.version,ver:'AUTOMATED',src:o.src,note:`Version stated in the update post of ${d.day}.`});
 }
 /** @type {Map<string,any>} */const seen=new Map();
 // Oldest first so a version keeps the date of its first post (later posts about it are follow-ups).
 for(const {n,c} of [...posts].reverse()){
  if(!c.version||seen.has(c.version))continue;
  const url=typeof n.url==='string'&&/^https:\/\//.test(n.url)&&!/\s/.test(n.url)?n.url:undefined;
  seen.set(c.version,{version:c.version,released:postDate(n.date).day,channel:'stable',...(url?{notes_url:url}:{}),ver:'AUTOMATED',src:o.src});
 }
 versions.push(...[...seen.values()].sort((a,b)=>a.released<b.released?1:a.released>b.released?-1:0).slice(0,MAX_VERSIONS));
 return {facts,versions,updates:posts.length};
}

/** @param {{retryDelays?:number[]}} [opts] */
export function createSteamNewsAdapter(opts={}){
 const delays=opts.retryDelays??[30000,90000];
 return {
  id:'steam-news',vertical:'games',mode:'auto',freshnessHours:24,
  hosts:[HOST],minIntervalMs:1500,
  terms:'https://steamcommunity.com/dev/apiterms (Steam Web API Terms of Use); docs https://partner.steamgames.com/doc/webapi/ISteamNews; api.steampowered.com/robots.txt disallows crawling (we call the documented API, we do not crawl) — see docs/n2/sources-games.md',
  /** @param {any} ctx */
  async collect(ctx){
   const retrieved=new Date(ctx.now()).toISOString().slice(0,10);
   const games=(ctx.targets||[]).filter((/** @type {any} */ t)=>t.type==='game'&&Number.isInteger(t.facts?.steam_appid));
   const entities=[],sources=[];let ok=0,failed=0,withUpdates=0;
   for(const t of games){
    const appid=t.facts.steam_appid;let items=null;
    for(let attempt=0;;attempt++){
     let res;
     try{res=await ctx.get(newsUrl(appid),{source:sourceId(appid),accept:'application/json',excerpt});}catch(e){ctx.log(`steam-news: ${appid}: ${e}`);break;}
     if((res.status===429||res.status>=500)&&attempt<delays.length){ctx.log(`steam-news: ${appid} HTTP ${res.status}, waiting ${delays[attempt]} ms`);await sleep(delays[attempt]);continue;}
     if(!res.ok){ctx.log(`steam-news: ${appid}: HTTP ${res.status}`);break;}
     try{items=res.json()?.appnews?.newsitems;}catch(e){ctx.log(`steam-news: ${appid}: bad JSON`);}
     break;
    }
    if(!Array.isArray(items)){failed++;continue;}
    ok++;
    const u=updatesFromNews(items,{appid,src:sourceId(appid),name:t.names?.en});
    if(!u.facts.length&&!u.versions.length)continue;
    withUpdates++;
    entities.push({id:t.id,facts:u.facts,...(u.versions.length?{versions:u.versions}:{})});
    sources.push({id:sourceId(appid),kind:'OFFICIAL_API',url:newsUrl(appid),title:`Steam developer announcements for app ${appid}`,publisher:'Valve Corporation (Steam Web API, ISteamNews)',retrieved,adapter:'steam-news',
     note:`Developer posts; store view: https://store.steampowered.com/news/app/${appid}`});
   }
   if(games.length&&!ok)throw Error(`steam-news: no news could be read (${failed} failed)`);
   ctx.log(`steam-news: ${ok} read, ${withUpdates} with updates, ${failed} failed`);
   return {schema:'nerulio.seed/1',vertical:'games',sources,entities,stats:{ok,failed,withUpdates}};
  },
 };
}

export default createSteamNewsAdapter();
