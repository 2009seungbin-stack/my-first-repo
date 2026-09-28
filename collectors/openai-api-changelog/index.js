// @ts-check
/** OpenAI API changelog → dated events linked to models.
 * Endpoint: https://developers.openai.com/api/docs/changelog.md — the official changelog page in Markdown
 * (the page itself states "Markdown versions of documentation pages are available by appending `.md`").
 * robots.txt on developers.openai.com: `Allow: /`.
 * Format: `## <Month>, <YYYY>` → `### <Mon> <D>` → a tag line ("Feature · Model: gpt-6-sol · API: v1/responses")
 * → body paragraphs. `Model:` tags are matched against model entities (api_model_id); entries without a
 * known model attach to service:openai-api. */
import {isoDay,mdPlain,headline,modelsByApiId,codeSpans,changeKind,withinDays,MONTHS} from '../_ai-shared/util.js';

const URL_MD='https://developers.openai.com/api/docs/changelog.md';
const PAGE='https://developers.openai.com/api/docs/changelog';
export const SERVICE='service:openai-api';
const WINDOW_DAYS=180,MAX_EVENTS=80;

/** @returns {{date:string,tags:string[],body:string}[]} */
export function parseChangelog(/** @type {string} */ md){
 const out=[];let year=0,month=-1;/** @type {any} */let cur=null;
 const flush=()=>{if(cur){cur.body=cur.lines.join('\n').trim();delete cur.lines;if(cur.body||cur.tags.length)out.push(cur);cur=null;}};
 for(const raw of String(md).split(/\r?\n/)){
  const line=raw.trimEnd();
  let m=/^##\s+([A-Za-z]+),?\s+(\d{4})\s*$/.exec(line);
  if(m){flush();month=MONTHS.findIndex(x=>x.startsWith(m[1].toLowerCase().slice(0,3)));year=+m[2];continue;}
  m=/^###\s+([A-Za-z]+)\.?\s+(\d{1,2})\s*$/.exec(line);
  if(m&&year){flush();const mi=MONTHS.findIndex(x=>x.startsWith(m[1].toLowerCase().slice(0,3)));const mm=mi>=0?mi:month;
   cur={date:`${year}-${String(mm+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`,tags:[],lines:[],tagLine:true};continue;}
  if(!cur)continue;
  if(cur.tagLine&&line.trim()){
   cur.tagLine=false;
   if(/^(Feature|Fix|Update|Deprecation|Change|Improvement|Breaking|Model:|API:)/.test(line.trim())&&!/[.!?]$/.test(line.trim())){cur.tags=line.split('·').map(s=>s.trim()).filter(Boolean);continue;}
  }
  cur.lines.push(line);
 }
 flush();
 return out.map(({date,tags,body})=>({date,tags,body}));
}
export function buildEvents(/** @type {ReturnType<typeof parseChangelog>} */ entries,/** @type {any[]} */ targets,/** @type {number} */ nowMs,/** @type {string} */ src){
 const events=[];
 for(const e of entries){
  if(!withinDays(e.date,WINDOW_DAYS,nowMs))continue;
  const modelTags=e.tags.filter(t=>/^Model:/i.test(t)).map(t=>t.replace(/^Model:\s*/i,''));
  const ids=modelsByApiId(targets,[...modelTags,...codeSpans(e.body)]);
  const plain=mdPlain(e.body.split(/\n\s*\n/)[0]||e.body);
  const unmatched=modelTags.filter(t=>!modelsByApiId(targets,[t]).length);
  /** @type {any} */const ev={kind:changeKind(plain),key:`openai-api-changelog:${e.date}:${plain.slice(0,60)}`,title:{en:headline(plain)},starts:e.date,url:PAGE,entities:ids.length?ids:[SERVICE],ver:'OFFICIAL',src};
  if(e.tags.length)ev.note=e.tags.join(' · ');
  if(unmatched.length)ev.unmatched_models=unmatched;
  events.push(ev);
  if(events.length>=MAX_EVENTS)break;
 }
 return events;
}

export default {
 id:'openai-api-changelog',vertical:'ai',mode:'auto',freshnessHours:24,
 hosts:['developers.openai.com'],minIntervalMs:2000,
 terms:'developers.openai.com/robots.txt: User-agent * Allow /. One Markdown request per run (daily).',
 async collect(/** @type {any} */ ctx){
  const src='src:collector-openai-api-changelog';
  const r=await ctx.get(URL_MD,{source:src,accept:'text/markdown, text/plain;q=0.9'});
  if(!r.ok)throw Error(`changelog.md HTTP ${r.status}`);
  const entries=parseChangelog(r.text);
  if(!entries.length)throw Error('changelog.md: no dated entries parsed (format changed?)');
  return {schema:'nerulio.seed/1',vertical:'ai',
   sources:[{id:src,kind:'OFFICIAL',adapter:'openai-api-changelog',url:PAGE,title:'OpenAI API changelog',publisher:'OpenAI',retrieved:isoDay(ctx.now)}],
   entities:[],events:buildEvents(entries,ctx.targets,ctx.now(),src)};
 },
};
