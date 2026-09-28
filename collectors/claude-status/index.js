// @ts-check
/** Claude status page (status.claude.com, Atlassian Statuspage) → incidents as events.
 *
 * Endpoint: https://status.claude.com/history.atom — the incident-history Atom feed linked from the status
 * page. The Statuspage JSON API (/api/v2/*.json) is NOT used: status.claude.com/robots.txt disallows /api/.
 * The feed has no component list and no impact level, so affected services are inferred from the incident
 * text (explicit product names only) and models are matched by their names/API ids; when nothing matches,
 * the incident is attached to the provider. */
import {isoDay,isoSec,parseAtom,stripTags,entityMatcher,withinDays,MONTHS} from '../_ai-shared/util.js';

const BASE='https://status.claude.com';
export const PROVIDER='provider:anthropic';
/** Product names that appear in incident text → service entity. Order irrelevant; all matches are kept. */
export const SERVICE_PATTERNS=Object.freeze([
 [/\bClaude Code\b/i,'service:claude-code'],
 [/\bclaude\.ai\b|\bClaude (apps?|desktop|mobile|for (iOS|Android|Mac|Windows))\b/i,'service:claude'],
 [/\bapi\.anthropic\.com\b|\bClaude API\b|\bAPI\b|\bClaude Console\b|\bplatform\.claude\.com\b/,'service:claude-api'],
 [/\bCowork\b/i,'service:claude-cowork'],
]);
const WINDOW_DAYS=120;
const STATUS_END=/^(Resolved|Completed)$/i;

/** Parse the update list inside one entry's HTML content. Year is taken from the entry's published date
 * (an update in a later month than the entry is from the previous year). */
export function parseUpdates(/** @type {string} */ html,/** @type {string|undefined} */ published){
 const pub=published?new Date(published):new Date();const py=pub.getUTCFullYear(),pm=pub.getUTCMonth();
 const out=[];
 for(const m of html.matchAll(/<small>\s*([A-Za-z]{3,9})\s*<var[^>]*>(\d{1,2})<\/var>,\s*<var[^>]*>(\d\d):(\d\d)<\/var>\s*UTC\s*<\/small>\s*<br\s*\/?>\s*<strong>([^<]+)<\/strong>\s*-?\s*([\s\S]*?)(?=<\/p>|$)/g)){
  const mi=MONTHS.findIndex(x=>x.startsWith(m[1].toLowerCase().slice(0,3)));if(mi<0)continue;
  const y=mi>pm?py-1:py;
  const t=`${y}-${String(mi+1).padStart(2,'0')}-${m[2].padStart(2,'0')}T${m[3]}:${m[4]}:00Z`;
  out.push({at:t,status:m[5].trim(),body:stripTags(m[6])});
 }
 return out.sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:0);
}
export function buildEvents(/** @type {string} */ xml,/** @type {any[]} */ targets,/** @type {number} */ nowMs,/** @type {string} */ src){
 const matchModels=entityMatcher(targets,{types:['model']});const events=[];
 for(const e of parseAtom(xml)){
  const code=(/\/incidents\/([A-Za-z0-9]+)/.exec(e.link)||[])[1];if(!code)continue;
  const ups=parseUpdates(e.content,e.published);
  const starts=ups[0]?.at||isoSec(e.published);if(!starts||!withinDays(starts,WINDOW_DAYS,nowMs))continue;
  const end=ups.find(u=>STATUS_END.test(u.status));
  const text=[e.title,...ups.map(u=>u.body)].join('\n');
  const ids=new Set();
  for(const [re,id] of SERVICE_PATTERNS)if(/** @type {RegExp} */(re).test(text))ids.add(/** @type {string} */(id));
  for(const m of matchModels(text))ids.add(m);
  if(!ids.size)ids.add(PROVIDER);
  const maintenance=ups.some(u=>/^(Scheduled|In progress|Verifying|Completed)$/i.test(u.status));
  /** @type {any} */const ev={kind:'other',key:`claude-status:${code}`,title:{en:e.title||'Incident'},starts,url:`${BASE}/incidents/${code}`,entities:[...ids],status:end?'ended':'confirmed',ver:'OFFICIAL',src};
  if(end)ev.ends=end.at;
  if(maintenance)ev.note='scheduled maintenance';
  events.push(ev);
 }
 return events;
}

export default {
 id:'claude-status',vertical:'ai',mode:'auto',freshnessHours:1,
 hosts:['status.claude.com'],minIntervalMs:2000,
 terms:'status.claude.com/robots.txt: Disallow /api/ and /embed/ → only the public history.atom feed is fetched (linked from the page). One request per run.',
 async collect(/** @type {any} */ ctx){
  const src='src:collector-claude-status';
  const r=await ctx.get(`${BASE}/history.atom`,{source:src,accept:'application/atom+xml'});
  if(!r.ok)throw Error(`history.atom HTTP ${r.status}`);
  return {schema:'nerulio.seed/1',vertical:'ai',
   sources:[{id:src,kind:'FEED',adapter:'claude-status',url:`${BASE}/history.atom`,title:'Claude Status — incident history (Atom)',publisher:'Anthropic',retrieved:isoDay(ctx.now)}],
   entities:[],events:buildEvents(r.text,ctx.targets,ctx.now(),src)};
 },
};
