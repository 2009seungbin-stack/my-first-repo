#!/usr/bin/env node
/** Build collectors/steam-store/targets.json — the list of Steam games the games vertical tracks.
 *
 *   node collectors/steam-store/select-targets.mjs            # fetch charts + merge curated.json
 *
 * Inputs (all recorded in the output with the date):
 *  1. Steam weekly top sellers for Korea (ranks 1–200), IStoreTopSellersService/GetWeeklyTopSellers/v1
 *     with country_code=KR — the endpoint behind https://store.steampowered.com/charts/topselling/KR.
 *     Observed responding (not in Valve's documented Web API list).
 *  2. Steam most played (global, ranks 1–100), ISteamChartsService/GetMostPlayedGames/v1 — the endpoint
 *     behind https://store.steampowered.com/charts/mostplayed. Observed responding (not documented).
 *  3. collectors/steam-store/curated.json — hand-picked games with a stated reason.
 * Chart items that are DLC/soundtracks (type ≠ 0) or carry Steam's adult-content descriptors
 * (3 = Adult Only Sexual Content, 4 = Frequent Nudity or Sexual Content) are left out. Existing
 * targets are kept (a game does not vanish because it dropped off a weekly chart). */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {collectorContext} from '../_runtime.js';

const DIR=fileURLToPath(new URL('./',import.meta.url));
const OUT=DIR+'targets.json';
/** Non-games that chart on Steam, or games we deliberately skip. */
export const EXCLUDE=new Map([
 [431960,'Wallpaper Engine — desktop software, not a game'],
 [1675200,'Steam Deck — hardware'],
]);
const TOP_SELLERS=(start)=>'https://api.steampowered.com/IStoreTopSellersService/GetWeeklyTopSellers/v1/?input_json='+encodeURIComponent(JSON.stringify({context:{language:'english',country_code:'KR'},country_code:'KR',page_start:start,page_count:100}));
const MOST_PLAYED='https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/';
const ADULT=new Set([3,4]);

async function main(){
 const ctx=collectorContext({id:'select-targets',hosts:['api.steampowered.com'],minIntervalMs:1500},{log:m=>console.error(m)});
 const today=new Date().toISOString().slice(0,10);
 const prev=existsSync(OUT)?JSON.parse(readFileSync(OUT,'utf8')):{targets:[]};
 /** @type {Map<number,{appid:number,name?:string,why:string[]}>} */const t=new Map();
 const add=(appid,why,name)=>{if(EXCLUDE.has(appid))return;const x=t.get(appid)||{appid,why:[]};if(name&&!x.name)x.name=name;if(!x.why.includes(why))x.why.push(why);t.set(appid,x);};
 let skippedAdult=0,skippedType=0;
 for(const start of [0,100]){
  const r=await ctx.get(TOP_SELLERS(start),{source:'charts'});
  for(const x of r.json().response?.ranks||[]){
   const it=x.item||{};
   if(it.type!==undefined&&it.type!==0){skippedType++;continue;}
   if((it.content_descriptorids||[]).some(id=>ADULT.has(id))){skippedAdult++;continue;}
   add(x.appid,`kr_top_seller_week:${x.rank}`,it.name);
  }
 }
 const mp=await ctx.get(MOST_PLAYED,{source:'charts'});
 for(const x of mp.json().response?.ranks||[])add(x.appid,`most_played_global:${x.rank}`);
 const curated=JSON.parse(readFileSync(DIR+'curated.json','utf8'));
 for(const c of curated.targets)add(c.appid,`curated:${c.why}`,c.name);
 // Keep earlier targets (with their original reasons) so history stays attached.
 for(const p of prev.targets||[])if(!t.has(p.appid)&&!EXCLUDE.has(p.appid))t.set(p.appid,{...p,why:[...p.why]});
 const out={
  schema:'nerulio.targets/1',vertical:'games',generated:today,
  selection:{
   kr_top_seller_week:{url:'https://store.steampowered.com/charts/topselling/KR',endpoint:'IStoreTopSellersService/GetWeeklyTopSellers/v1 (country_code=KR, ranks 1-200; observed, undocumented)',retrieved:today},
   most_played_global:{url:'https://store.steampowered.com/charts/mostplayed',endpoint:'ISteamChartsService/GetMostPlayedGames/v1 (ranks 1-100; observed, undocumented)',retrieved:today},
   curated:'collectors/steam-store/curated.json',
   excluded:Object.fromEntries([...EXCLUDE].map(([k,v])=>[k,v])),
   filters:'chart items with type != 0 (DLC, soundtracks) or adult-content descriptors 3/4 are left out',
  },
  targets:[...t.values()],
 };
 writeFileSync(OUT,JSON.stringify(out,null,1)+'\n');
 console.log(`targets: ${out.targets.length} (skipped ${skippedType} non-game chart items, ${skippedAdult} adult-descriptor items)`);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await main();
