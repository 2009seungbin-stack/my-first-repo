// @ts-check
/** Game-update adapter for subculture game IPs that are published on Steam (Blue Archive, Wuthering Waves,
 * Zenless Zone Zero, Limbus Company, Arknights: Endfield, …).
 *
 * Source: the per-app Steam news RSS feed, https://store.steampowered.com/feeds/news/app/<appid>/?l=koreana
 * (observed responding 2026-09-28 with Content-Type text/xml, generator "Steam 뉴스 RSS"; the feed is the
 * app's announcement channel, whose posts are written by the game's publisher). store.steampowered.com's
 * robots.txt does not disallow /feeds/. We do NOT use api.steampowered.com (its robots.txt is `Disallow: /`).
 *
 * Output (heuristic parsing of publisher-written titles, so `ver:'AUTOMATED'`):
 *  - events kind 'update' for posts whose title announces an update (업데이트/update/patch) — dated by the
 *    date written in the title (e.g. "9/29(화)", "2026년 9월 24일", "2026.10.01"), else by the post date (KST);
 *  - versions[] for titles that carry an explicit version number next to 버전/version (e.g. "3.6 버전").
 * Livestream/preview posts ("Special Program", "예고", "방송") are ignored.
 */

const LOOKBACK_DAYS=45;
const UPDATE=/업데이트|update|patch|패치/i;
const SKIP=/special program|방송|예고|preview|사전|livestream|이슈|오류|issue|bug/i;
const VERSION=/(?:^|[^\d.])(\d+\.\d+(?:\.\d+)?)\s*버전|\bver(?:sion)?\.?\s*(\d+\.\d+(?:\.\d+)?)/i;

const decode=(/** @type {string} */ s)=>s.replace(/^<!\[CDATA\[|\]\]>$/g,'').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();
/** Minimal RSS 2.0 item parser (title, link, pubDate). */
export function parseRss(/** @type {string} */ xml){
 /** @type {{title:string,link:string,pubDate:string}[]} */const out=[];
 for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){
  const tag=(/** @type {string} */ t)=>{const x=m[1].match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));return x?decode(x[1]):'';};
  out.push({title:tag('title'),link:tag('link'),pubDate:tag('pubDate')});
 }
 return out;
}
const pad=(/** @type {number} */ n)=>String(n).padStart(2,'0');
/** Post time → KST calendar date. */
export function kstDate(/** @type {number} */ ms){return new Date(ms+9*3600*1000).toISOString().slice(0,10);}
/** A date written in a Korean/English title, resolved against the post date. */
export function titleDate(/** @type {string} */ title,/** @type {number} */ postMs){
 const post=new Date(postMs+9*3600*1000),py=post.getUTCFullYear(),pm=post.getUTCMonth()+1;
 let m=title.match(/(20\d\d)[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
 if(m)return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
 m=title.match(/(?:^|[^\d])(\d{1,2})월\s*(\d{1,2})일/)||title.match(/(?:^|[^\d./])(\d{1,2})\/(\d{1,2})(?:\s*\(|[^\d/]|$)/);
 if(m){const mo=+m[1],d=+m[2];if(mo<1||mo>12||d<1||d>31)return null;const y=mo<pm-6?py+1:mo>pm+6?py-1:py;return `${y}-${pad(mo)}-${pad(d)}`;}
 return null;
}

/** Pure mapping: parsed feed items for one tracked work → entity patch + events. */
export function mapItems(/** @type {any} */ target,/** @type {{title:string,link:string,pubDate:string}[]} */ items,/** @type {string} */ srcId,/** @type {number} */ nowMs){
 /** @type {any[]} */const versions=[];/** @type {any[]} */const events=[];const seenDay=new Set(),seenVer=new Set();
 for(const it of items){
  const postMs=Date.parse(it.pubDate);if(!Number.isFinite(postMs))continue;
  if(postMs<nowMs-LOOKBACK_DAYS*864e5)continue;
  if(!UPDATE.test(it.title)||SKIP.test(it.title))continue;
  const day=titleDate(it.title,postMs)||kstDate(postMs);
  const vm=it.title.match(VERSION),version=vm&&(vm[1]||vm[2]);
  if(version&&!seenVer.has(version)){seenVer.add(version);versions.push({version,released:day,channel:'stable',notes_url:it.link,src:srcId});}
  if(seenDay.has(day))continue;seenDay.add(day);
  const en=target.names?.en||target.id;
  events.push({kind:'update',title:{en:version?`${en} version ${version} update`:`${en} update (${day})`,ko:it.title.slice(0,200)},
   starts:day,date_precision:'day',status:Date.parse(day)+864e5<nowMs?'ended':'announced',region:'*',url:it.link,entities:[target.id],ver:'AUTOMATED',src:srcId,
   note:'From the publisher\'s announcement on Steam (RSS); date taken from the post title when present, otherwise the post date in KST.'});
 }
 return {versions,events};
}

export default {
 id:'steam-news-subculture',
 vertical:'subculture',
 mode:'auto',
 freshnessHours:12,
 hosts:['store.steampowered.com'],
 minIntervalMs:1500,
 terms:'https://store.steampowered.com/robots.txt (feeds allowed; api.steampowered.com not used) · Steam Subscriber Agreement',
 /** @param {any} ctx */
 async collect(ctx){
  const retrieved=new Date(ctx.now()).toISOString().slice(0,10);
  /** @type {any[]} */const sources=[],entities=[],events=[];
  for(const t of ctx.targets||[]){
   const appid=t.facts?.steam_appid;if(t.type!=='work'||!Number.isInteger(appid))continue;
   const url=`https://store.steampowered.com/feeds/news/app/${appid}/?l=koreana`,srcId=`src:steam-news-${appid}`;
   const res=await ctx.get(url,{source:srcId,accept:'application/rss+xml, text/xml;q=0.9',excerpt:(/** @type {string} */ b)=>parseRss(b).slice(0,5).map(i=>i.title)});
   if(!res.ok)throw Error(`steam-news-subculture: HTTP ${res.status} for app ${appid}`);
   const {versions,events:ev}=mapItems(t,parseRss(res.text),srcId,ctx.now());
   sources.push({id:srcId,kind:'FEED',url,title:`Steam news feed — ${t.names?.en||t.id}`,publisher:'Valve (posts by the game publisher)',retrieved,adapter:'steam-news-subculture'});
   if(versions.length){
    const latest=[...versions].sort((a,b)=>String(b.released).localeCompare(String(a.released)))[0];
    entities.push({id:t.id,versions,facts:[{p:'current_version',v:latest.version,ver:'AUTOMATED',src:srcId,note:'Latest version named in the publisher\'s Steam announcements (lookback 45 days).'}]});
   }
   events.push(...ev);
  }
  return {schema:'nerulio.seed/1',vertical:'subculture',sources,entities,events};
 },
};
