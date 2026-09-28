// @ts-check
/** Release versions of open-source studio apps from the GitHub Releases REST API.
 *
 * Endpoint (documented): GET https://api.github.com/repos/{owner}/{repo}/releases
 *   https://docs.github.com/en/rest/releases/releases#list-releases  (unauthenticated: 60 req/h;
 *   this adapter makes one request per repository per run). Observed responding 2026-09-28.
 * Releases are published by the projects themselves (godotengine/godot, obsproject/obs-studio),
 * so they are the projects' own release records; values are labelled AUTOMATED because they are
 * collected by a machine, not checked by a curator.
 *
 * Output: partial entities (id + facts + versions) for app entities defined in
 * data/seed/studio/apps-b.json — latest_version (highest non-prerelease, non-draft version) and
 * up to MAX_VERSIONS versions (newest first) with their publication date and release page.
 * Download assets are deliberately ignored (Nerulio links to release pages, never to binaries).
 */

export const REPOS=Object.freeze(/** @type {Record<string,{entity:string,tag:(t:string)=>string|null}>} */({
 'godotengine/godot':{entity:'app:godot',tag:t=>{const m=/^(\d+\.\d+(?:\.\d+)*)-stable$/.exec(t);return m?m[1]:null;}},
 'obsproject/obs-studio':{entity:'app:obs-studio',tag:t=>/^\d+\.\d+\.\d+(-(beta|rc)\d+)?$/.test(t)?t:null},
}));
export const MAX_VERSIONS=12;
const DATE=/^\d{4}-\d\d-\d\d/;

/** Compare dotted numeric versions, ignoring a pre-release suffix (a > b → positive). */
export function compareVersions(/** @type {string} */ a,/** @type {string} */ b){
 const n=(/** @type {string} */ s)=>s.split('-')[0].split('.').map(Number);
 const x=n(a),y=n(b);
 for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}
 const pa=a.includes('-'),pb=b.includes('-');
 return pa===pb?0:pa?-1:1;
}
export const sourceId=(/** @type {string} */ repo)=>`src:auto-github-${repo.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-releases`;

/**
 * Pure transform: releases JSON of one repo → {source, entity} for a seed document.
 * @param {string} repo @param {any} releases @param {{retrieved:string,log?:(m:string)=>void}} o
 */
export function toEntity(repo,releases,o){
 const log=o.log||(()=>{});
 const cfg=REPOS[repo];if(!cfg)throw Error(`unknown repo ${repo}`);
 if(!Array.isArray(releases))throw Error(`${repo}: expected a JSON array of releases`);
 const src=sourceId(repo);
 /** @type {{version:string,channel:string,released?:string,notes_url?:string,src:string}[]} */
 const versions=[];
 for(const r of releases){
  if(!r||r.draft)continue;
  const v=cfg.tag(String(r.tag_name||''));
  if(!v){log(`${repo}: skip tag ${r?.tag_name}`);continue;}
  const out={version:v,channel:r.prerelease?'prerelease':'stable',src};
  if(DATE.test(String(r.published_at||'')))out.released=String(r.published_at).slice(0,10);
  const u=String(r.html_url||'');if(u.startsWith(`https://github.com/${repo}/releases/`))out.notes_url=u;
  versions.push(out);
 }
 versions.sort((a,b)=>compareVersions(b.version,a.version));
 const stable=versions.filter(v=>v.channel==='stable');
 const facts=[];
 if(stable.length)facts.push({p:'latest_version',v:stable[0].version,ver:'AUTOMATED',src,...(stable[0].released?{note:`Published ${stable[0].released}`}:{})});
 else log(`${repo}: no stable release in the response`);
 return {
  source:{id:src,kind:'OFFICIAL_API',url:`https://api.github.com/repos/${repo}/releases`,title:`${repo} releases (GitHub REST API)`,publisher:repo.split('/')[0],retrieved:o.retrieved,adapter:'studio-github-releases',note:'Documented at https://docs.github.com/en/rest/releases/releases#list-releases'},
  entity:{id:cfg.entity,facts,versions:versions.slice(0,MAX_VERSIONS)},
 };
}

export default {
 id:'studio-github-releases',
 vertical:'studio',
 mode:'auto',
 freshnessHours:24,
 hosts:['api.github.com'],
 minIntervalMs:2000,
 terms:'GitHub REST API (documented, unauthenticated 60 requests/hour) — https://docs.github.com/en/site-policy/github-terms/github-terms-of-service ; API use is permitted for public data within rate limits.',
 /** @param {{get:(url:string,o:{source:string,accept?:string,excerpt?:(b:string)=>unknown})=>Promise<{ok:boolean,status:number,json:()=>any}>,now:()=>number,log:(m:string)=>void}} ctx */
 async collect(ctx){
  const retrieved=new Date(ctx.now()).toISOString().slice(0,10);
  const sources=[],entities=[];
  for(const repo of Object.keys(REPOS)){
   const res=await ctx.get(`https://api.github.com/repos/${repo}/releases?per_page=30`,{source:sourceId(repo),accept:'application/vnd.github+json',excerpt:b=>JSON.parse(b).slice(0,5).map((/** @type {any} */ r)=>r.tag_name)});
   if(!res.ok)throw Error(`${repo}: HTTP ${res.status}`);
   const {source,entity}=toEntity(repo,res.json(),{retrieved,log:ctx.log});
   sources.push(source);entities.push(entity);
  }
  return {schema:'nerulio.seed/1',vertical:'studio',sources,entities};
 },
};
