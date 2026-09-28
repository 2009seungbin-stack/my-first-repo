// @ts-check
/** Gemini API changelog → dated events linked to models.
 * Endpoint: https://ai.google.dev/gemini-api/docs/changelog.md.txt — the Markdown export ai.google.dev
 * serves for every docs page (same content as https://ai.google.dev/gemini-api/docs/changelog).
 * robots.txt on ai.google.dev: `Disallow:` (nothing disallowed).
 * Format: `## <Month D, YYYY>` followed by top-level `- **Title**: text` items (continuation lines and nested
 * lists are indented). Models are matched by backticked model codes; others attach to service:gemini-api. */
import {isoDay,mdPlain,headline,modelsByApiId,codeSpans,changeKind,withinDays,parseLongDate} from '../_ai-shared/util.js';

const URL_MD='https://ai.google.dev/gemini-api/docs/changelog.md.txt';
const PAGE='https://ai.google.dev/gemini-api/docs/changelog';
export const SERVICE='service:gemini-api';
const WINDOW_DAYS=180,MAX_EVENTS=80;

/** @returns {{date:string,title:string,text:string}[]} */
export function parseChangelog(/** @type {string} */ md){
 const out=[];let date='';/** @type {string[]|null} */let cur=null;
 const flush=()=>{
  if(cur&&date){const text=cur.join('\n').trim();if(text){const b=/^\*\*([\s\S]+?)\*\*/.exec(text);out.push({date,title:b?mdPlain(b[1]).replace(/\s*:$/,''):'',text});}}
  cur=null;
 };
 for(const line of String(md).split(/\r?\n/)){
  const h=/^##\s+(.+?)\s*$/.exec(line);
  if(h){flush();date=parseLongDate(h[1])||'';continue;}
  if(!date)continue;
  const b=/^[-*]\s+(.*)$/.exec(line);
  if(b){flush();cur=[b[1]];continue;}
  if(cur)cur.push(line.trim());
 }
 flush();
 return out;
}
export function buildEvents(/** @type {ReturnType<typeof parseChangelog>} */ entries,/** @type {any[]} */ targets,/** @type {number} */ nowMs,/** @type {string} */ src){
 const events=[];
 for(const e of entries){
  if(!withinDays(e.date,WINDOW_DAYS,nowMs))continue;
  const plain=mdPlain(e.text);
  const ids=modelsByApiId(targets,codeSpans(e.text));
  const title=e.title||headline(plain);
  events.push({kind:changeKind(e.title+' '+plain),key:`gemini-api-changelog:${e.date}:${title.slice(0,60)}`,title:{en:headline(title)},starts:e.date,url:PAGE,entities:ids.length?ids:[SERVICE],ver:'OFFICIAL',src});
  if(events.length>=MAX_EVENTS)break;
 }
 return events;
}

export default {
 id:'gemini-api-changelog',vertical:'ai',mode:'auto',freshnessHours:24,
 hosts:['ai.google.dev'],minIntervalMs:2000,
 terms:'ai.google.dev/robots.txt: nothing disallowed. One Markdown request per run (daily).',
 async collect(/** @type {any} */ ctx){
  const src='src:collector-gemini-api-changelog';
  const r=await ctx.get(URL_MD,{source:src,accept:'text/markdown, text/plain;q=0.9'});
  if(!r.ok)throw Error(`changelog.md.txt HTTP ${r.status}`);
  const entries=parseChangelog(r.text);
  if(!entries.length)throw Error('changelog: no dated entries parsed (format changed?)');
  return {schema:'nerulio.seed/1',vertical:'ai',
   sources:[{id:src,kind:'OFFICIAL',adapter:'gemini-api-changelog',url:PAGE,title:'Gemini API changelog',publisher:'Google',retrieved:isoDay(ctx.now)}],
   entities:[],events:buildEvents(entries,ctx.targets,ctx.now(),src)};
 },
};
