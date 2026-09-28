// @ts-check
/** GitHub Releases → versions + latest_version for local AI runtimes.
 * Endpoint: GitHub REST API `GET /repos/{owner}/{repo}/releases?per_page=10` (documented:
 * https://docs.github.com/en/rest/releases/releases#list-releases). Unauthenticated limit is 60 requests/hour
 * per IP; this adapter makes one request per repository. (ctx.get cannot send an Authorization header yet —
 * see docs/n2/sources-ai.md "suggested core changes".)
 * llama.cpp publishes every build (bNNNN) as a GitHub *pre-release* and has no other channel, so its
 * latest_version is the newest build; for the other repos it is the newest non-prerelease. */
import {isoDay} from '../_ai-shared/util.js';

export const REPOS=Object.freeze([
 {repo:'ggml-org/llama.cpp',entity:'runtime:llama-cpp',buildsArePrereleases:true},
 {repo:'ollama/ollama',entity:'runtime:ollama',buildsArePrereleases:false},
 {repo:'vllm-project/vllm',entity:'runtime:vllm',buildsArePrereleases:false},
]);
const KEEP=5;
export const srcId=(/** @type {string} */ repo)=>`src:collector-github-releases-${repo.split('/')[1].toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;

/** Pure: one repo's release list → partial entity {id, facts, versions}. */
export function entityUpdate(/** @type {{repo:string,entity:string,buildsArePrereleases:boolean}} */ cfg,/** @type {any[]} */ releases){
 const src=srcId(cfg.repo);
 const rel=(releases||[]).filter(r=>r&&!r.draft&&r.tag_name&&r.published_at).sort((a,b)=>a.published_at<b.published_at?1:-1);
 const versions=rel.slice(0,KEEP).map(r=>({version:String(r.tag_name),released:String(r.published_at).slice(0,10),channel:r.prerelease?'prerelease':'stable',notes_url:r.html_url,src}));
 const latest=cfg.buildsArePrereleases?rel[0]:rel.find(r=>!r.prerelease);
 // Keep the newest stable in the list even when several prereleases came after it.
 if(latest&&!versions.some(v=>v.version===latest.tag_name))versions.push({version:String(latest.tag_name),released:String(latest.published_at).slice(0,10),channel:latest.prerelease?'prerelease':'stable',notes_url:latest.html_url,src});
 /** @type {any[]} */const facts=[];
 if(latest)facts.push({p:'latest_version',v:String(latest.tag_name),ver:'OFFICIAL',src,...(cfg.buildsArePrereleases?{note:'Newest build; the project publishes every build as a GitHub pre-release.'}:{})});
 return {id:cfg.entity,facts,versions};
}

export default {
 id:'github-releases',vertical:'ai',mode:'auto',freshnessHours:12,
 hosts:['api.github.com'],minIntervalMs:1500,
 terms:'GitHub REST API (documented, public data). Respect the 60 req/h unauthenticated limit: 3 requests per run.',
 async collect(/** @type {any} */ ctx){
  const day=isoDay(ctx.now);const sources=[],entities=[];const errors=[];
  for(const cfg of REPOS){
   const src=srcId(cfg.repo);
   sources.push({id:src,kind:'OFFICIAL_API',adapter:'github-releases',url:`https://github.com/${cfg.repo}/releases`,title:`${cfg.repo} releases`,publisher:'GitHub',retrieved:day});
   try{
    const r=await ctx.get(`https://api.github.com/repos/${cfg.repo}/releases?per_page=10`,{source:src,accept:'application/vnd.github+json',excerpt:(/** @type {string} */ b)=>JSON.parse(b).slice(0,3).map((/** @type {any} */ x)=>x.tag_name)});
    if(!r.ok){errors.push(`${cfg.repo}: HTTP ${r.status}`);continue;}
    const u=entityUpdate(cfg,r.json());if(u.facts.length||u.versions.length)entities.push(u);
   }catch(e){errors.push(`${cfg.repo}: ${e}`);}
  }
  if(!entities.length)throw Error('github-releases: no repository answered: '+errors.join('; '));
  if(errors.length)ctx.log('github-releases: '+errors.join('; '));
  return {schema:'nerulio.seed/1',vertical:'ai',sources,entities,events:[]};
 },
};
