// @ts-check
/** REAPER versions from Cockos's official plain-text changelog.
 *
 * Endpoint: GET https://www.reaper.fm/whatsnew.txt — the complete REAPER changelog published by
 * Cockos (linked from https://www.reaper.fm/download.php). Each release starts with a heading line
 * "vX.YY - Month D YYYY" (observed 2026-09-28, e.g. "v7.80 - September 13 2026").
 * www.reaper.fm/robots.txt returns 404 (no crawl restrictions); one request per run (~1.5 MB).
 *
 * Output: partial entity app:reaper with latest_version and the newest MAX_VERSIONS releases.
 */

export const FEED_URL='https://www.reaper.fm/whatsnew.txt';
export const SOURCE_ID='src:auto-cockos-reaper-whatsnew';
export const MAX_VERSIONS=12;
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const HEAD=/^v(\d+\.\d+[a-z0-9.]*) - ([A-Za-z]+) (\d{1,2}),? (\d{4})\s*$/;

/** Parse the changelog text → [{version, released}] in file order (newest first). */
export function parseHeadings(/** @type {string} */ text,/** @type {(m:string)=>void} */ log=()=>{}){
 const out=[];
 for(const line of text.split(/\r?\n/)){
  if(!line.startsWith('v'))continue;
  const m=HEAD.exec(line.trim());
  if(!m)continue;
  // Month names are sometimes abbreviated ("Apr") or misspelt ("Feburary") in the file: match on the first 3 letters.
  const mo=MONTHS.findIndex(x=>x.startsWith(m[2].slice(0,3).toLowerCase()));
  if(mo<0){log(`bad month in ${line}`);continue;}
  const day=Number(m[3]);if(day<1||day>31){log(`bad day in ${line}`);continue;}
  out.push({version:m[1],released:`${m[4]}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`});
 }
 return out;
}

/** Pure transform: whatsnew.txt → seed document. @param {string} text @param {{retrieved:string,log?:(m:string)=>void}} o */
export function toSeed(text,o){
 const log=o.log||(()=>{});
 const heads=parseHeadings(text,log);
 if(!heads.length)throw Error('whatsnew.txt: no version headings found (format changed?)');
 const versions=heads.slice(0,MAX_VERSIONS).map(h=>({version:h.version,channel:'stable',released:h.released,notes_url:FEED_URL,src:SOURCE_ID}));
 return {
  schema:'nerulio.seed/1',vertical:'studio',
  sources:[{id:SOURCE_ID,kind:'FEED',url:FEED_URL,title:'REAPER whatsnew.txt',publisher:'Cockos',retrieved:o.retrieved,adapter:'reaper-whatsnew'}],
  entities:[{id:'app:reaper',facts:[{p:'latest_version',v:heads[0].version,ver:'AUTOMATED',src:SOURCE_ID,note:`Released ${heads[0].released}`}],versions}],
 };
}

export default {
 id:'reaper-whatsnew',
 vertical:'studio',
 mode:'auto',
 freshnessHours:24,
 hosts:['www.reaper.fm'],
 minIntervalMs:3000,
 terms:'Official changelog file linked from https://www.reaper.fm/download.php; robots.txt is absent (HTTP 404 on 2026-09-28). One request per run.',
 /** @param {{get:(url:string,o:{source:string,accept?:string,excerpt?:(b:string)=>unknown})=>Promise<{ok:boolean,status:number,text:string}>,now:()=>number,log:(m:string)=>void}} ctx */
 async collect(ctx){
  const res=await ctx.get(FEED_URL,{source:SOURCE_ID,accept:'text/plain',excerpt:b=>parseHeadings(b.slice(0,20000)).slice(0,3)});
  if(!res.ok)throw Error(`whatsnew.txt: HTTP ${res.status}`);
  return toSeed(res.text,{retrieved:new Date(ctx.now()).toISOString().slice(0,10),log:ctx.log});
 },
};
