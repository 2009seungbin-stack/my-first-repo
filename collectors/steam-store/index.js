// @ts-check
/** steam-store — Steam store app details for game entities that carry a `steam_appid` fact.
 *
 * Endpoint: https://store.steampowered.com/api/appdetails?appids=<id>&l=<language>&cc=<country>
 * This is the JSON endpoint behind the Steam store page. It is widely used and publicly reachable
 * without a key, but it is NOT part of Valve's documented Steam Web API (partner.steamgames.com /
 * the Steam Web API docs do not list it). Status and terms: docs/n2/sources-games.md.
 * The store robots.txt (checked 2026-09-28) does not disallow /api/.
 *
 * Per game: one English request (stable language/genre names, release date) and one Korean request
 * (the Korean store name when the developer localised it, Korean genre labels for the ko description).
 * Output: game entities (names, facts, developer/publisher relations) + org entities.
 * Facts are `AUTOMATED` (machine-read from Valve's store data by this collector); the source kind is
 * `OFFICIAL` (the official store page, data entered by the developer/publisher on Steamworks),
 * never `OFFICIAL_API`, because the endpoint is undocumented. */
import {parseLanguages,koreanSupport,parseReleaseDate,parsePlatforms,parseGenres,cleanName,slugify,shortHash,parseCompanies,parseWebsite,humanDate,koreanStoreName} from './parse.js';
import {normName} from '../../platform/schema.js';

const HOST='store.steampowered.com';
const sleep=(/** @type {number} */ ms)=>new Promise(r=>setTimeout(r,ms));
export const storeUrl=(/** @type {number} */ appid)=>`https://${HOST}/app/${appid}/`;
export const detailsUrl=(/** @type {number} */ appid,/** @type {string} */ l,/** @type {string} */ cc)=>`https://${HOST}/api/appdetails?appids=${appid}&l=${l}&cc=${cc}`;
export const sourceId=(/** @type {number} */ appid)=>`src:steam-store-app-${appid}`;

/** Small excerpt kept with each snapshot (what the parser relied on). @param {string} body */
function excerpt(body){
 const j=JSON.parse(body),x=j&&Object.values(j)[0];
 if(!x?.success)return {success:false};
 const d=x.data||{};
 return {success:true,type:d.type,name:d.name,supported_languages:String(d.supported_languages||'').slice(0,600),release_date:d.release_date,developers:d.developers,publishers:d.publishers,platforms:d.platforms,genres:(d.genres||[]).map((/** @type {any} */ g)=>g.description)};
}

/**
 * Fetch one appdetails response with backoff. Valve answers throttling with HTTP 429 (sometimes a
 * 200 with the body `null`); both are retried after the configured delays, then give up.
 * @param {any} ctx @param {number} appid @param {'english'|'koreana'} l @param {string} cc @param {number[]} delays
 * @returns {Promise<{data:any}|{missing:true}>}
 */
async function fetchDetails(ctx,appid,l,cc,delays){
 for(let attempt=0;;attempt++){
  const res=await ctx.get(detailsUrl(appid,l,cc),{source:sourceId(appid),accept:'application/json',excerpt});
  const throttled=res.status===429||res.status>=500||(res.ok&&res.text.trim()==='null');
  if(throttled){
   if(attempt>=delays.length)throw Error(`appdetails ${appid} ${l}: throttled (HTTP ${res.status}) after ${attempt+1} attempts`);
   ctx.log(`steam-store: ${appid} ${l} throttled (HTTP ${res.status}), waiting ${delays[attempt]} ms`);
   await sleep(delays[attempt]);continue;
  }
  if(!res.ok)throw Error(`appdetails ${appid} ${l}: HTTP ${res.status}`);
  const x=res.json()?.[String(appid)];
  return x?.success&&x.data?{data:x.data}:{missing:true};
 }
}

/** @param {string[]} a */
const joinEn=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];

/**
 * Build the game entity from the English (+ optional Korean) details. Pure; exported for tests.
 * Korean name: the Korean store name when the developer set one (names_src.ko → this store source).
 * Without one — the Korean store shows the English name, or the Korean request failed — the target's
 * existing `names.ko` (from another official source, or an earlier run) is kept with its `names_src`,
 * so a collector run never drops a curated Korean name (ingest replaces `names` as a whole).
 * @param {any} en English `data` @param {any|null} ko Korean `data`
 * @param {{appid:number,id:string,slug:string,src:string,orgId:(name:string)=>string,prev?:{names?:any,names_src?:any}}} o
 */
export function gameEntity(en,ko,o){
 const f=(/** @type {string} */ p,/** @type {unknown} */ v,/** @type {Record<string,unknown>} */ more={})=>({p,v,ver:'AUTOMATED',src:o.src,...more});
 const nameEn=cleanName(en.name),rawKo=ko?.name?String(ko.name):'',storeKo=cleanName(rawKo),nameKo=koreanStoreName(storeKo,nameEn,normName);
 const names=/** @type {{en:string,ko?:string}} */({en:nameEn});
 /** @type {Record<string,string>} */const names_src={};
 if(nameKo){names.ko=nameKo;names_src.ko=o.src;}
 else if(o.prev?.names?.ko&&normName(o.prev.names.ko)!==normName(nameEn)){names.ko=o.prev.names.ko;if(o.prev.names_src?.ko)names_src.ko=o.prev.names_src.ko;}
 const aliases=[...new Set([en.name!==nameEn?String(en.name).trim():'',...(storeKo&&normName(storeKo)!==normName(nameEn)?[rawKo.trim(),storeKo]:[])].filter(a=>a&&a!==names.ko&&a!==nameEn))];
 const langs=parseLanguages(en.supported_languages),korean=koreanSupport(langs);
 const upcoming=!!en.release_date?.coming_soon,released=parseReleaseDate(en.release_date?.date);
 const platforms=parsePlatforms(en.platforms),genres=parseGenres(en.genres),website=parseWebsite(en.website);
 const devs=parseCompanies(en.developers),pubs=parseCompanies(en.publishers);
 const facts=[f('steam_appid',o.appid)];
 if(upcoming)facts.push(f('status','upcoming'));
 if(released)facts.push(f('release_date',released,upcoming?{note:'Planned date shown on the Steam store (not released yet).'}:{}));
 if(korean)facts.push(f('korean_official',korean,korean==='interface_subtitles'?{note:'Steam lists Korean without the full-audio marker; the store data does not separate interface from subtitles.'}:korean==='full_audio'?{note:'Steam lists Korean with the full-audio marker.'}:{}));
 if(langs.length)facts.push(f('official_languages',langs.map(l=>l.name)));
 if(platforms.length)facts.push(f('platforms',platforms));
 if(genres.length)facts.push(f('genres',genres));
 if(website)facts.push(f('homepage',website));
 const relations=[...devs.map(n=>({p:'developed_by',o:o.orgId(n),ver:'AUTOMATED',src:o.src})),...pubs.map(n=>({p:'published_by',o:o.orgId(n),ver:'AUTOMATED',src:o.src}))];
 // Descriptions: factual sentences composed from the facts above (no store text is copied).
 const genresKo=parseGenres(ko?.genres);
 const who={en:devs.length?`developed by ${joinEn(devs)}`+(pubs.length&&pubs.join()!==devs.join()?` and published by ${joinEn(pubs)}`:''):'',ko:devs.length?`${devs.join(', ')} 개발`+(pubs.length&&pubs.join()!==devs.join()?`, ${pubs.join(', ')} 배급`:''):''};
 const on=released?(released.length===10?'on ':'in ')+humanDate(released,'en'):'';
 const when={en:released?(upcoming?`, planned for Steam release ${on}`:`, released on Steam ${on}`):'',ko:released?(upcoming?` ${humanDate(released,'ko')} Steam에 출시될 예정`:` ${humanDate(released,'ko')} Steam에 출시되었`):''};
 const KOR={full_audio:{en:'The Steam store lists Korean with full audio support.',ko:'Steam 스토어 기준 한국어 인터페이스·자막·음성을 지원합니다.'},interface_subtitles:{en:'The Steam store lists Korean text support without full Korean audio.',ko:'Steam 스토어 기준 한국어 텍스트(인터페이스·자막)를 지원하며, 한국어 음성은 지원 목록에 없습니다.'},none:{en:'The Steam store lists no official Korean support.',ko:'Steam 스토어 기준 공식 한국어를 지원하지 않습니다.'}};
 const kor=korean?KOR[korean]:{en:'',ko:''};
 const genreEn=genres.filter(g=>!/^(indie|free to play|early access|massively multiplayer)$/i.test(g)).slice(0,2).join('/');
 const genreKo=genresKo.filter(g=>!/^(인디|무료|앞서 해보기|무료 플레이|대규모 멀티플레이어)$/.test(g)).slice(0,2).join('/');
 const description=who.en||when.en?{
  en:`${genreEn?`${genreEn} game`:'Game'} for PC${who.en?' '+who.en:''}${when.en}. ${kor.en}`.trim(),
  ko:`${who.ko?who.ko+'의 ':''}PC ${genreKo&&ko?genreKo+' ':''}게임으로${when.ko?when.ko+'습니다':upcoming?' Steam에 출시될 예정입니다':', Steam에서 판매됩니다'}. ${kor.ko}`.replace('예정습니다','예정입니다').replace('으로, Steam','으로 Steam').trim(),
 }:undefined;
 const official_urls=[{label:'Steam',url:storeUrl(o.appid)},...(website?[{label:'Official site',url:website}]:[])];
 return {id:o.id,type:'game',slug:o.slug,names,...(Object.keys(names_src).length?{names_src}:{}),...(aliases.length?{aliases}:{}),...(description?{description}:{}),official_urls,facts,relations};
}

/** @param {{retryDelays?:number[]}} [opts] */
export function createSteamStoreAdapter(opts={}){
 const delays=opts.retryDelays??[30000,90000];
 return {
  id:'steam-store',vertical:'games',mode:'auto',freshnessHours:168,
  hosts:[HOST],minIntervalMs:1500,
  terms:'https://store.steampowered.com/subscriber_agreement/ ; robots: https://store.steampowered.com/robots.txt (no /api/ rule, checked 2026-09-28); endpoint undocumented — see docs/n2/sources-games.md',
  /** @param {any} ctx */
  async collect(ctx){
   const retrieved=new Date(ctx.now()).toISOString().slice(0,10);
   /** @type {any[]} */const targets=ctx.targets||[];
   const games=targets.filter(t=>t.type==='game'&&Number.isInteger(t.facts?.steam_appid));
   // Slugs are unique per vertical: reserve every slug already used by other entities.
   /** @type {Map<string,string>} */const slugOwner=new Map();
   for(const t of targets)if(t.slug)slugOwner.set(t.slug,t.id);
   const claim=(/** @type {string} */ want,/** @type {string} */ id,/** @type {string} */ suffix)=>{
    let s=want;if(slugOwner.has(s)&&slugOwner.get(s)!==id)s=`${want}-${suffix}`.slice(0,96);
    let i=2;while(slugOwner.has(s)&&slugOwner.get(s)!==id)s=`${want}-${suffix}-${i++}`.slice(0,96);
    slugOwner.set(s,id);return s;
   };
   // Companies: reuse existing org entities by normalised name/alias, otherwise mint org:<slug>.
   /** @type {Map<string,{id:string,slug:string,names:any,names_src?:any,aliases_src?:any,aliases:Set<string>,existing:boolean}>} */const orgs=new Map();
   for(const t of targets.filter(t=>t.type==='org')){
    const o={id:t.id,slug:t.slug,names:t.names,names_src:t.names_src,aliases_src:t.aliases_src,aliases:new Set(t.aliases||[]),existing:true};
    for(const n of [t.names?.en,t.names?.ko,...(t.aliases||[])].filter(Boolean))orgs.set(normName(n),o);
   }
   /** @type {Set<any>} */const usedOrgs=new Set();
   const orgId=(/** @type {string} */ name)=>{
    const k=normName(name);let o=orgs.get(k);
    if(!o){
     const base=slugify(name)||`org-${shortHash(k)}`,id=`org:${base}`;
     const dup=[...orgs.values()].find(x=>x.id===id);
     o=dup||{id,slug:claim(base,id,'company'),names:{en:name},aliases:new Set(),existing:false};
     if(dup&&dup.names.en!==name)dup.aliases.add(name);
     orgs.set(k,o);
    }
    usedOrgs.add(o);return o.id;
   };
   const entities=[],sources=[];let ok=0,failed=0,skipped=0;
   for(const t of games){
    const appid=t.facts.steam_appid;
    let en;
    let enCc='us';
    try{
     en=await fetchDetails(ctx,appid,'english','us',delays);
     // Some Korean/Asian releases are not sold in the US store: read the English data via the KR store.
     if('missing' in en){enCc='kr';en=await fetchDetails(ctx,appid,'english','kr',delays);}
    }catch(e){failed++;ctx.log(`steam-store: ${appid}: ${e}`);continue;}
    if('missing' in en){skipped++;ctx.log(`steam-store: ${appid}: no store data (removed, region-locked or not an app)`);continue;}
    if(en.data.type!=='game'){skipped++;ctx.log(`steam-store: ${appid}: type ${en.data.type}, not a game`);continue;}
    let ko=null;
    try{const r=await fetchDetails(ctx,appid,'koreana','kr',delays);if(!('missing' in r))ko=r.data;}catch(e){ctx.log(`steam-store: ${appid} (ko): ${e}`);}
    const name=cleanName(en.data.name);
    const slug=t.slug||claim(slugify(name)||`steam-${appid}`,t.id,String(appid));
    if(t.slug)slugOwner.set(t.slug,t.id);
    entities.push(gameEntity(en.data,ko,{appid,id:t.id,slug,src:sourceId(appid),orgId,prev:t}));
    sources.push({id:sourceId(appid),kind:'OFFICIAL',url:storeUrl(appid),title:`${name} on Steam`,publisher:'Valve Corporation (Steam store)',retrieved,adapter:'steam-store',
     note:`Machine-read from ${detailsUrl(appid,'english',enCc)} and ${detailsUrl(appid,'koreana','kr')} (undocumented store JSON endpoint behind this page).`});
    ok++;
   }
   if(games.length&&!ok)throw Error(`steam-store: no game could be read (${failed} failed, ${skipped} skipped)`);
   ctx.log(`steam-store: ${ok} games, ${skipped} skipped, ${failed} failed`);
   const orgEntities=[...usedOrgs].sort((a,b)=>a.id<b.id?-1:1).map(o=>({id:o.id,type:'org',slug:o.slug,names:o.names,...(o.names_src?{names_src:o.names_src}:{}),...(o.aliases.size?{aliases:[...o.aliases].sort()}:{}),...(o.aliases_src?{aliases_src:o.aliases_src}:{})}));
   return {schema:'nerulio.seed/1',vertical:'games',sources,entities:[...entities,...orgEntities],stats:{ok,failed,skipped}};
  },
 };
}

export default createSteamStoreAdapter();
