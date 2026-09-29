// Shared helpers for the AI-vertical collector tests (recorded fixtures only — never the live network).
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runAdapter} from '../../../../collectors/_runtime.js';
import {validateSeed} from '../../../../platform/seed.js';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../../..');
export const NOW=Date.parse('2026-09-28T13:00:00Z');
export const fixture=(/** @type {string} */ adapter,/** @type {string} */ file)=>readFileSync(path.join(HERE,adapter,file),'utf8');

/** fetch() stub: routes[url] = body string | {status, body, type}. Unknown URLs → 404. Records calls. */
export function fakeFetch(/** @type {Record<string,any>} */ routes){
 const calls=[];
 const f=async(/** @type {string} */ url,/** @type {any} */ init)=>{
  calls.push({url,init});const r=routes[url];
  const {status=200,body='',type='text/plain'}=typeof r==='string'?{body:r}:r||{status:404,body:'not found'};
  return new Response(body,{status,headers:{'content-type':type}});
 };
 f.calls=calls;return f;
}
/** Seed-like targets used by the adapters' name/API-id matchers. */
export const TARGETS=[
 {id:'model:gpt-6-sol',type:'model',vertical:'ai',names:{en:'GPT-6 Sol'},aliases:[],facts:{api_model_id:'gpt-6-sol'}},
 {id:'model:gpt-6-luna',type:'model',vertical:'ai',names:{en:'GPT-6 Luna'},aliases:[],facts:{api_model_id:'gpt-6-luna'}},
 {id:'model:claude-opus-5-5',type:'model',vertical:'ai',names:{en:'Claude Opus 5.5'},aliases:[],facts:{api_model_id:'claude-opus-5-5'}},
 {id:'model:claude-opus-5',type:'model',vertical:'ai',names:{en:'Claude Opus 5'},aliases:[],facts:{api_model_id:'claude-opus-5'}},
 {id:'model:claude-mythos-5-1',type:'model',vertical:'ai',names:{en:'Claude Mythos 5.1'},aliases:[],facts:{}},
 {id:'model:gemini-3.8-live',type:'model',vertical:'ai',names:{en:'Gemini 3.8 Live'},aliases:[],facts:{api_model_id:'gemini-3.8-live'}},
 {id:'model:gemini-3.8-flash-tts',type:'model',vertical:'ai',names:{en:'Gemini 3.8 Flash TTS'},aliases:[],facts:{api_model_id:'gemini-3.8-flash-tts'}},
];
export async function run(/** @type {any} */ adapter,/** @type {Record<string,any>} */ routes,targets=TARGETS){
 const fetch=fakeFetch(routes);
 // The clock advances 10 s per read so the runtime's politeness delay never actually sleeps.
 let t=NOW;const res=await runAdapter(adapter,{fetch,now:()=>(t+=10000),targets});
 return {...res,calls:fetch.calls};
}
/** Validate a collector document the way collect.mjs does; entity ids referenced by it are "known". */
export function validate(/** @type {any} */ doc,/** @type {string[]} */ extraKnown=[]){
 const ids=new Set([...TARGETS.map(t=>t.id),...extraKnown]);
 for(const e of doc.events||[])for(const id of e.entities)ids.add(id);
 for(const e of doc.entities||[])ids.add(e.id);
 return validateSeed(doc,{entities:ids,sources:new Set()});
}
/** Entity ids defined in data/seed/ai/*.json (empty when the seed is not there yet). */
export function seedEntityIds(){
 const dir=path.join(ROOT,'data/seed/ai');const ids=new Set();
 if(!existsSync(dir))return ids;
 for(const f of readdirSync(dir))if(f.endsWith('.json'))for(const e of JSON.parse(readFileSync(path.join(dir,f),'utf8')).entities||[])ids.add(e.id);
 return ids;
}
