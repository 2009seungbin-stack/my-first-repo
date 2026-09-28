// @ts-check
/** AniList airing-schedule adapter (subculture vertical).
 *
 * Source: AniList public GraphQL API — https://docs.anilist.co/ (documented; POST https://graphql.anilist.co).
 * AniList is a THIRD-PARTY, community-edited database, not the rights holder. Everything this adapter
 * emits is therefore labelled `ver:'COMMUNITY'` under a `FEED` source whose note says so; it can never
 * supersede an OFFICIAL fact (platform/schema.js mayOverride) and is meant as a change signal for curators.
 *
 * Terms (reviewed 2026-09-28, https://docs.anilist.co/guide/terms-of-use): free for non-commercial use and for
 * commercial services under USD 150/month revenue (above that a commercial licence is required); no use as a
 * backup/data store; no hoarding or mass collection; no competing list/tracker services. We therefore only
 * look up the works Nerulio already tracks (seed entities that carry an `anilist_id` fact), in batches of at
 * most 50 ids per request, a handful of requests per run — never a crawl.
 * Rate limit (https://docs.anilist.co/guide/rate-limiting): 90 req/min normally, 30 req/min while "degraded"
 * (observed X-RateLimit-Limit: 30 on 2026-09-28). minIntervalMs 2500 keeps us under 24 req/min.
 *
 * The shared runtime's ctx.get() only issues GET requests and AniList answers GET with 404 ("Use POST"), so this
 * adapter carries a small POST helper that applies the SAME host allowlist, politeness interval and snapshot
 * recording as collectors/_runtime.js (see docs/n2/sources-subculture.md — suggested core change: ctx.post).
 */

const API='https://graphql.anilist.co/';
const SOURCE_ID='src:anilist-graphql-api';
const BATCH=50;
const UA='NerulioCollector/1.0 (+https://nerulio.com/about/)';

export const QUERY=`query($ids:[Int]){Page(page:1,perPage:${BATCH}){media(id_in:$ids,type:ANIME){id format status episodes startDate{year month day} endDate{year month day} nextAiringEpisode{episode airingAt} siteUrl}}}`;

/** AniList MediaStatus → subculture airing_status. */
const STATUS={RELEASING:'airing',FINISHED:'finished',NOT_YET_RELEASED:'upcoming',HIATUS:'hiatus'};

/** {year,month,day} (nullable parts) → partial ISO date, or null. */
export function fuzzyDate(/** @type {any} */ d){
 if(!d||!d.year)return null;
 const p=(/** @type {number} */ n)=>String(n).padStart(2,'0');
 return d.month?(d.day?`${d.year}-${p(d.month)}-${p(d.day)}`:`${d.year}-${p(d.month)}`):String(d.year);
}
/** Epoch seconds → ISO timestamp in Japan time (+09:00), the zone Japanese broadcasts are announced in. */
export function jstTime(/** @type {number} */ sec){
 const d=new Date(sec*1000+9*3600*1000);
 return d.toISOString().slice(0,16)+'+09:00';
}

async function sha256Hex(/** @type {ArrayBuffer} */ buf){
 const d=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');
}
const sleep=(/** @type {number} */ ms)=>new Promise(r=>setTimeout(r,ms));

/** POST helper with the runtime's guarantees (allowlist, politeness, snapshot record). */
export function makePost(/** @type {any} */ ctx,/** @type {any} */ adapter,/** @type {typeof fetch} */ doFetch){
 let last=0;
 return async function post(/** @type {string} */ url,/** @type {unknown} */ body,/** @type {{source:string}} */ o){
  const u=new URL(url);
  if(u.protocol!=='https:'||!adapter.hosts.includes(u.hostname))throw Error(`${adapter.id}: host not allowlisted: ${u.hostname}`);
  const wait=last+adapter.minIntervalMs-ctx.now();if(last&&wait>0)await sleep(wait);
  last=ctx.now();
  const fetchedAt=new Date(ctx.now()).toISOString();
  try{
   const res=await doFetch(u.href,{method:'POST',headers:{'user-agent':UA,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});
   const buf=await res.arrayBuffer();const text=new TextDecoder().decode(buf);
   ctx.snapshots.push({source:o.source,url:u.href,fetched_at:fetchedAt,http_status:res.status,content_type:res.headers.get('content-type')||'',checksum:await sha256Hex(buf),byte_size:buf.byteLength,excerpt:{ratelimit_remaining:res.headers.get('x-ratelimit-remaining')}});
   return {status:res.status,ok:res.ok,text,json:()=>JSON.parse(text)};
  }catch(e){
   ctx.snapshots.push({source:o.source,url:u.href,fetched_at:fetchedAt,http_status:0,content_type:'',checksum:'',byte_size:0,error:String(e).slice(0,500)});
   throw e;
  }
 };
}

/** Pure mapping: AniList media rows + tracked targets → nerulio.seed/1 document. */
export function toSeed(/** @type {any[]} */ media,/** @type {Map<number,any>} */ byAnilist,/** @type {string} */ retrieved,/** @type {number} */ nowMs){
 /** @type {any[]} */const entities=[];/** @type {any[]} */const events=[];
 const f=(/** @type {string} */ p,/** @type {unknown} */ v)=>({p,v,ver:'COMMUNITY',src:SOURCE_ID});
 for(const m of media){
  const t=byAnilist.get(m.id);if(!t)continue;
  const facts=[];
  if(STATUS[/** @type {keyof typeof STATUS} */(m.status)])facts.push(f('airing_status',STATUS[/** @type {keyof typeof STATUS} */(m.status)]));
  if(Number.isInteger(m.episodes)&&m.episodes>0)facts.push(f('episodes',m.episodes));
  const start=fuzzyDate(m.startDate),end=fuzzyDate(m.endDate);
  if(start)facts.push(f('release_date',start));
  if(end&&m.status==='FINISHED')facts.push(f('end_date',end));
  if(facts.length)entities.push({id:t.id,facts});
  const n=m.nextAiringEpisode;
  if(n&&Number.isInteger(n.episode)&&Number.isFinite(n.airingAt)&&n.airingAt*1000>nowMs){
   const en=t.names?.en||t.id,ko=t.names?.ko,movie=m.format==='MOVIE';
   const title=movie?(ko?{en:`${en} — release`,ko:`${ko} 개봉`}:{en:`${en} — release`}):(ko?{en:`${en} — episode ${n.episode}`,ko:`${ko} ${n.episode}화`}:{en:`${en} — episode ${n.episode}`});
   events.push({kind:movie?'release':'broadcast',title,
    starts:jstTime(n.airingAt),date_precision:'time',status:'announced',region:'JP',url:m.siteUrl,entities:[t.id],ver:'COMMUNITY',src:SOURCE_ID,
    note:movie?'Japanese release date as listed by AniList (third-party community database); verify on the official site.':'Japanese first-broadcast time as listed by AniList (third-party community database); verify on the official site.'});
  }
 }
 return {schema:'nerulio.seed/1',vertical:'subculture',
  sources:[{id:SOURCE_ID,kind:'FEED',url:'https://docs.anilist.co/',title:'AniList GraphQL API (airing schedule)',publisher:'AniList',retrieved,adapter:'anilist-schedule',
   note:'Third-party community-edited database, not the rights holder. Values are COMMUNITY-labelled change signals; official sites remain the source of record.'}],
  entities,events};
}

export default {
 id:'anilist-schedule',
 vertical:'subculture',
 mode:'auto',
 freshnessHours:12,
 hosts:['graphql.anilist.co'],
 minIntervalMs:2500,
 terms:'https://docs.anilist.co/guide/terms-of-use',
 /** @param {any} ctx */
 async collect(ctx){
  /** @type {Map<number,any>} */const byAnilist=new Map();
  for(const t of ctx.targets||[])if(t.type==='work'&&Number.isInteger(t.facts?.anilist_id))byAnilist.set(t.facts.anilist_id,t);
  const ids=[...byAnilist.keys()];
  const post=ctx.post||makePost(ctx,this,/** @type {any} */(this)._fetch||globalThis.fetch);
  /** @type {any[]} */const media=[];
  for(let i=0;i<ids.length;i+=BATCH){
   const res=await post(API,{query:QUERY,variables:{ids:ids.slice(i,i+BATCH)}},{source:SOURCE_ID});
   if(!res.ok)throw Error(`anilist-schedule: HTTP ${res.status} ${res.text.slice(0,200)}`);
   const j=res.json();
   if(j.errors?.length)throw Error(`anilist-schedule: ${JSON.stringify(j.errors).slice(0,300)}`);
   media.push(...(j.data?.Page?.media||[]));
  }
  return toSeed(media,byAnilist,new Date(ctx.now()).toISOString().slice(0,10),ctx.now());
 },
};
