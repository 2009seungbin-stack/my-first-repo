#!/usr/bin/env node
/** Which collectors a workflow run should start, as a JSON array for a GitHub Actions matrix.
 *   node tools/platform/collector-plan.mjs [--schedule "<cron>"] [--adapters a,b]
 * Explicit --adapters wins; the 30-minute schedule runs the status pages only; everything else runs
 * every automated adapter. Manual adapters are left out (collect.mjs never writes them to D1).
 * One job per adapter: a slow one (steam-news: ~2,500 D1 REST queries) no longer holds up the rest
 * or pushes the whole run past the job timeout. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adapterIds,loadAdapter} from './collect.mjs';

export const STATUS_SCHEDULE='11,41 * * * *';
export const STATUS_ADAPTERS=Object.freeze(['claude-status','openai-status']);

/** @param {{schedule?:string,adapters?:string}} o @returns {Promise<string[]>} */
export async function plan(o={}){
 const known=adapterIds();
 if(o.adapters){
  const ids=String(o.adapters).split(',').map(s=>s.trim()).filter(Boolean);
  const unknown=ids.filter(id=>!known.includes(id));
  if(unknown.length)throw Error(`unknown adapters: ${unknown.join(', ')}`);
  return ids;
 }
 if(o.schedule===STATUS_SCHEDULE)return [...STATUS_ADAPTERS];
 const out=[];
 for(const id of known)if((await loadAdapter(id)).mode!=='manual')out.push(id);
 return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const a=process.argv.slice(2),get=(/** @type {string} */ k)=>{const i=a.indexOf(k);return i>=0?a[i+1]:undefined;};
 console.log(JSON.stringify(await plan({schedule:get('--schedule'),adapters:get('--adapters')})));
}
