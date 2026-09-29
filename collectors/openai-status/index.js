// @ts-check
/** OpenAI status page (status.openai.com, hosted by incident.io) → incidents as events.
 *
 * Endpoints (all public, unauthenticated, read-only; robots.txt on status.openai.com returns 404 = no rules):
 *  - /api/v2/incidents.json   Statuspage-compatible incident list (observed responding 2026-09-28;
 *                             incident.io serves Statuspage-compatible /api/v2 JSON). Gives created/resolved
 *                             times and impact.
 *  - /feed.atom               Atom feed linked from the status page ("Subscribe → Atom"). Gives the
 *                             affected components of each incident.
 *  - /proxy/status.openai.com the page's widget JSON (incident.io "Widget API": public read-only JSON,
 *                             documented at docs.incident.io/status-pages/api). Gives the component → group
 *                             structure (APIs / ChatGPT / Codex / …), so new components map without code changes.
 * Incidents become `events` with kind 'other' (EVENT_KINDS has no 'incident' yet — see
 * docs/n2/sources-ai.md) plus extra keys `key`, `status`, `impact`, `components` for the ingest pipeline. */
import {isoDay,isoSec,parseAtom,stripTags,entityMatcher,withinDays} from '../_ai-shared/util.js';

const BASE='https://status.openai.com';
/** Status-page component group → Nerulio entity. */
export const GROUP_ENTITY=Object.freeze({'APIs':'service:openai-api','ChatGPT':'service:chatgpt','Codex':'service:codex'});
export const PROVIDER='provider:openai';
/** Only when an incident lists no components: product names in its title → service. */
export const TITLE_PATTERNS=Object.freeze([[/\bCodex\b/,'service:codex'],[/\bChatGPT\b/,'service:chatgpt'],[/\bAPIs?\b/,'service:openai-api']]);
const WINDOW_DAYS=120;

/** Component name → group name, from the widget JSON. */
export function componentGroups(/** @type {any} */ widget){
 /** @type {Map<string,string>} */const map=new Map();
 for(const item of widget?.summary?.structure?.items||[]){
  const g=item.group;if(g)for(const c of g.components||[])if(c?.name)map.set(c.name,g.name);
  else if(item.component?.name)map.set(item.component.name,item.component.name);
 }
 return map;
}
/** Incident id → affected component names, from the Atom feed ("<li>Name (Status)</li>"). */
export function atomComponents(/** @type {string} */ xml){
 /** @type {Map<string,string[]>} */const map=new Map();
 for(const e of parseAtom(xml)){
  const id=(/\/incidents\/([A-Za-z0-9]+)/.exec(e.link||e.id)||[])[1];if(!id)continue;
  const html=e.content||e.summary;const i=html.indexOf('Affected components');
  const names=i<0?[]:[...html.slice(i).matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m=>stripTags(m[1]).replace(/\s*\([^()]*\)\s*$/,'').trim()).filter(Boolean);
  map.set(id,names);
 }
 return map;
}
/** Build events from the three documents (pure; used by collect() and the unit test). */
export function buildEvents(/** @type {any} */ incidentsJson,/** @type {Map<string,string[]>} */ comps,/** @type {Map<string,string>} */ groups,/** @type {any[]} */ targets,/** @type {number} */ nowMs,/** @type {string} */ src){
 const matchModels=entityMatcher(targets,{types:['model']});const events=[];
 for(const inc of incidentsJson?.incidents||[]){
  const starts=isoSec(inc.started_at||inc.created_at);if(!starts||!withinDays(starts,WINDOW_DAYS,nowMs))continue;
  const names=comps.get(inc.id)||(inc.components||[]).map((/** @type {any} */ c)=>c.name).filter(Boolean);
  const ids=new Set();
  for(const n of names){const g=groups.get(n);const e=g&&GROUP_ENTITY[/** @type {keyof typeof GROUP_ENTITY} */(g)];if(e)ids.add(e);}
  if(!names.length)for(const [re,id] of TITLE_PATTERNS)if(/** @type {RegExp} */(re).test(inc.name||''))ids.add(/** @type {string} */(id));
  const text=[inc.name,...(inc.incident_updates||[]).map((/** @type {any} */ u)=>u.body)].join('\n');
  for(const m of matchModels(text))ids.add(m);
  if(!ids.size)ids.add(PROVIDER);
  const resolved=isoSec(inc.resolved_at);
  /** @type {any} */const ev={kind:'other',key:`openai-status:${inc.id}`,title:{en:String(inc.name||'').trim()||'Incident'},starts,url:`${BASE}/incidents/${inc.id}`,entities:[...ids],status:inc.status==='resolved'||inc.status==='postmortem'?'ended':'confirmed',impact:inc.impact||undefined,components:names.length?names:undefined,ver:'OFFICIAL',src};
  if(resolved)ev.ends=resolved;
  events.push(ev);
 }
 return events;
}

export default {
 id:'openai-status',vertical:'ai',mode:'auto',freshnessHours:1,
 hosts:['status.openai.com'],minIntervalMs:2000,
 terms:'status.openai.com/robots.txt → 404 (no rules). Public status page; feeds linked from the page. Low frequency (hourly), 3 requests per run.',
 async collect(/** @type {any} */ ctx){
  const src='src:collector-openai-status';
  const inc=await ctx.get(`${BASE}/api/v2/incidents.json`,{source:src,accept:'application/json',excerpt:(/** @type {string} */ b)=>({incidents:JSON.parse(b).incidents?.length})});
  if(!inc.ok)throw Error(`incidents.json HTTP ${inc.status}`);
  let comps=new Map(),groups=new Map();
  try{const a=await ctx.get(`${BASE}/feed.atom`,{source:src,accept:'application/atom+xml'});if(a.ok)comps=atomComponents(a.text);}catch(e){ctx.log(`openai-status: atom skipped: ${e}`);}
  try{const w=await ctx.get(`${BASE}/proxy/status.openai.com`,{source:src,accept:'application/json'});if(w.ok)groups=componentGroups(w.json());}catch(e){ctx.log(`openai-status: widget skipped: ${e}`);}
  const events=buildEvents(inc.json(),comps,groups,ctx.targets,ctx.now(),src);
  return {schema:'nerulio.seed/1',vertical:'ai',
   sources:[{id:src,kind:'FEED',adapter:'openai-status',url:`${BASE}/`,title:'OpenAI status — incidents',publisher:'OpenAI',retrieved:isoDay(ctx.now),note:'incident.io status page: /api/v2/incidents.json + /feed.atom + widget JSON'}],
   entities:[],events};
 },
};
