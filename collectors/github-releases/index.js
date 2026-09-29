// @ts-check
/** GitHub Releases → versions + latest_version for local AI runtimes.
 * Endpoint: GitHub REST API `GET /repos/{owner}/{repo}/releases?per_page=10` (documented:
 * https://docs.github.com/en/rest/releases/releases#list-releases)
 * and `GET /repos/{owner}/{repo}/releases/latest` ("the most recent non-prerelease, non-draft release",
 * https://docs.github.com/en/rest/releases/releases#get-the-latest-release).
 * latest_version = /releases/latest. llama.cpp publishes a build (bNNNN) every few hours as a GitHub
 * *pre-release* ("nightly") next to occasional semver releases (v0.5.0 …), so the newest builds would push the
 * latest stable release out of any short list — that is why /releases/latest is fetched separately.
 * Unauthenticated limit is 60 requests/hour per IP; this adapter makes two requests per repository. (ctx.get
 * cannot send an Authorization header yet — see docs/n2/sources-ai.md "Suggested core changes".) */
import {isoDay} from '../_ai-shared/util.js';

export const REPOS=Object.freeze([
 {repo:'ggml-org/llama.cpp',entity:'runtime:llama-cpp'},
 {repo:'ollama/ollama',entity:'runtime:ollama'},
 {repo:'vllm-project/vllm',entity:'runtime:vllm'},
]);
const KEEP=5;
export const srcId=(/** @type {string} */ repo)=>`src:collector-github-releases-${repo.split('/')[1].toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;

/** Pure: one repo's release list (+ the /releases/latest object, if any) → partial entity {id, facts, versions}. */
export function entityUpdate(/** @type {{repo:string,entity:string}} */ cfg,/** @type {any[]} */ releases,/** @type {any} */ latestRelease=null){
 const src=srcId(cfg.repo);
 const rel=(releases||[]).filter(r=>r&&!r.draft&&r.tag_name&&r.published_at).sort((a,b)=>a.published_at<b.published_at?1:-1);
 const versions=rel.slice(0,KEEP).map(r=>({version:String(r.tag_name),released:String(r.published_at).slice(0,10),channel:r.prerelease?'prerelease':'stable',notes_url:r.html_url,src}));
 const latest=latestRelease&&latestRelease.tag_name&&!latestRelease.draft&&!latestRelease.prerelease?latestRelease:rel.find(r=>!r.prerelease);
 // Keep the newest stable in the list even when several prereleases came after it.
 if(latest&&!versions.some(v=>v.version===latest.tag_name))versions.push({version:String(latest.tag_name),released:String(latest.published_at).slice(0,10),channel:latest.prerelease?'prerelease':'stable',notes_url:latest.html_url,src});
 /** @type {any[]} */const facts=[];
 const newestPre=rel[0]&&rel[0].prerelease&&(!latest||rel[0].published_at>latest.published_at)?rel[0]:null;
 if(latest)facts.push({p:'latest_version',v:String(latest.tag_name),ver:'OFFICIAL',src,...(newestPre?{note:`Latest stable release; newer pre-release ${newestPre.tag_name} (${String(newestPre.published_at).slice(0,10)}).`}:{})});
 return {id:cfg.entity,facts,versions};
}

export default {
 id:'github-releases',vertical:'ai',mode:'auto',freshnessHours:12,
 hosts:['api.github.com'],minIntervalMs:1500,
 terms:'GitHub REST API (documented, public data). Respect the 60 req/h unauthenticated limit: 6 requests per run.',
 async collect(/** @type {any} */ ctx){
  const day=isoDay(ctx.now);const sources=[],entities=[];const errors=[];
  for(const cfg of REPOS){
   const src=srcId(cfg.repo);
   sources.push({id:src,kind:'OFFICIAL_API',adapter:'github-releases',url:`https://github.com/${cfg.repo}/releases`,title:`${cfg.repo} releases`,publisher:'GitHub',retrieved:day});
   try{
    const r=await ctx.get(`https://api.github.com/repos/${cfg.repo}/releases?per_page=10`,{source:src,accept:'application/vnd.github+json',excerpt:(/** @type {string} */ b)=>JSON.parse(b).slice(0,3).map((/** @type {any} */ x)=>x.tag_name)});
    if(!r.ok){errors.push(`${cfg.repo}: HTTP ${r.status}`);continue;}
    let latest=null;
    try{const l=await ctx.get(`https://api.github.com/repos/${cfg.repo}/releases/latest`,{source:src,accept:'application/vnd.github+json'});if(l.ok)latest=l.json();}catch(e){errors.push(`${cfg.repo} latest: ${e}`);}
    const u=entityUpdate(cfg,r.json(),latest);if(u.facts.length||u.versions.length)entities.push(u);
   }catch(e){errors.push(`${cfg.repo}: ${e}`);}
  }
  if(!entities.length)throw Error('github-releases: no repository answered: '+errors.join('; '));
  if(errors.length)ctx.log('github-releases: '+errors.join('; '));
  return {schema:'nerulio.seed/1',vertical:'ai',sources,entities,events:[]};
 },
};
