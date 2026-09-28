// @ts-check
/** Claude Platform release notes → dated events linked to models.
 * Endpoint: https://platform.claude.com/docs/en/release-notes/overview.md — the official release notes in
 * Markdown (docs pages are served as `.md`; the file's front matter names the canonical page URL).
 * robots.txt on platform.claude.com disallows only /api/.
 * Format: `### <Month D, YYYY>` followed by top-level `*` bullets; each bullet is one event. Models are
 * matched by backticked API ids and by name; bullets without a known model attach to service:claude-api. */
import {isoDay,mdPlain,headline,modelsByApiId,codeSpans,entityMatcher,changeKind,withinDays,parseLongDate} from '../_ai-shared/util.js';

const URL_MD='https://platform.claude.com/docs/en/release-notes/overview.md';
const PAGE='https://platform.claude.com/docs/en/release-notes/overview';
export const SERVICE='service:claude-api';
const WINDOW_DAYS=180,MAX_EVENTS=80;

/** @returns {{date:string,text:string}[]} */
export function parseReleaseNotes(/** @type {string} */ md){
 const out=[];let date='';/** @type {string[]|null} */let cur=null;
 const flush=()=>{if(cur&&date){const t=cur.join('\n').trim();if(t)out.push({date,text:t});}cur=null;};
 for(const line of String(md).split(/\r?\n/)){
  const h=/^#{2,4}\s+(.+?)\s*$/.exec(line);
  if(h){flush();date=parseLongDate(h[1])||'';continue;}
  if(!date)continue;
  const b=/^[*-]\s+(.*)$/.exec(line);
  if(b){flush();cur=[b[1]];continue;}
  if(cur&&(/^\s+\S/.test(line)||(line.trim()&&!/^</.test(line.trim()))))cur.push(line.trim());
  else if(!line.trim()&&cur)cur.push('');
 }
 flush();
 return out;
}
export function buildEvents(/** @type {{date:string,text:string}[]} */ entries,/** @type {any[]} */ targets,/** @type {number} */ nowMs,/** @type {string} */ src){
 const byName=entityMatcher(targets,{types:['model']});const events=[];
 for(const e of entries){
  if(!withinDays(e.date,WINDOW_DAYS,nowMs))continue;
  const plain=mdPlain(e.text);
  // Backticked API ids are the precise signal; names are the fallback (a launch note that mentions the
  // previous model's price must not be linked to that previous model).
  const byId=modelsByApiId(targets,codeSpans(e.text));
  const ids=new Set(byId.length?byId:byName(plain));
  events.push({kind:changeKind(plain),key:`claude-release-notes:${e.date}:${plain.slice(0,60)}`,title:{en:headline(plain)},starts:e.date,url:PAGE,entities:ids.size?[...ids]:[SERVICE],ver:'OFFICIAL',src});
  if(events.length>=MAX_EVENTS)break;
 }
 return events;
}

export default {
 id:'claude-release-notes',vertical:'ai',mode:'auto',freshnessHours:24,
 hosts:['platform.claude.com'],minIntervalMs:2000,
 terms:'platform.claude.com/robots.txt: Disallow /api/ only. One Markdown request per run (daily).',
 async collect(/** @type {any} */ ctx){
  const src='src:collector-claude-release-notes';
  const r=await ctx.get(URL_MD,{source:src,accept:'text/markdown, text/plain;q=0.9'});
  if(!r.ok)throw Error(`overview.md HTTP ${r.status}`);
  const entries=parseReleaseNotes(r.text);
  if(!entries.length)throw Error('release notes: no dated entries parsed (format changed?)');
  return {schema:'nerulio.seed/1',vertical:'ai',
   sources:[{id:src,kind:'OFFICIAL',adapter:'claude-release-notes',url:PAGE,title:'Claude Platform release notes',publisher:'Anthropic',retrieved:isoDay(ctx.now)}],
   entities:[],events:buildEvents(entries,ctx.targets,ctx.now(),src)};
 },
};
