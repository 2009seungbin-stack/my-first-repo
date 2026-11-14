// @ts-check
/** Blender source tags from the official Forgejo instance, with its official GitHub mirror as a
 * bounded fallback for 403/429/server errors. Other HTTP/schema errors remain errors.
 *
 * Endpoint: GET https://projects.blender.org/api/v1/repos/blender/blender/tags?limit=50
 *   Forgejo/Gitea REST API, documented by the instance itself at https://projects.blender.org/api/swagger
 *   (observed responding 2026-09-28). Release tags are named vX.Y.Z; each tag carries the commit
 *   timestamp (`commit.created`) of the release commit, which is used as the release date and is
 *   labelled as such (it can differ by a day from the date on blender.org/download).
 * notes_url is the actual source-tag code view, not a synthesized Forgejo release page.
 * Why not blender.org/download: that page is HTML; the tag API is structured and official.
 *
 * Output: partial entity app:blender with latest_version (highest vX.Y.Z tag) and the newest
 * MAX_VERSIONS release tags as versions (Blender LTS lines, e.g. 4.5.x, keep receiving tags; ingest
 * treats channel 'stable' and 'lts' as the same release, so a seeded LTS row is not duplicated).
 * latest_version is OFFICIAL: the Blender Foundation's own release tags (see reaper-whatsnew).
 */

export const TAGS_URL='https://projects.blender.org/api/v1/repos/blender/blender/tags?limit=50';
export const SOURCE_ID='src:auto-blender-forgejo-tags';
export const MIRROR_TAGS_URL='https://api.github.com/repos/blender/blender/tags?per_page=50';
export const MIRROR_SOURCE_ID='src:auto-blender-github-tags';
export const MAX_VERSIONS=12;
const TAG=/^v(\d+)\.(\d+)\.(\d+)$/;
/** @typedef {{get:(url:string,o:{source:string,accept?:string,excerpt?:(b:string)=>unknown})=>Promise<{ok:boolean,status:number,json:()=>any}>,now:()=>number,log:(m:string)=>void}} BlenderContext */
/** Metadata only: a failed primary response is retained as an HTTP-error snapshot, not a fact. @param {string} retrieved */
function primarySource(retrieved){return {id:SOURCE_ID,kind:'OFFICIAL_API',url:TAGS_URL,title:'blender/blender tags (projects.blender.org Forgejo API)',publisher:'Blender Foundation',retrieved,adapter:'blender-releases',note:'API documented at https://projects.blender.org/api/swagger; dates are tag commit timestamps.'};}

export function compareVersions(/** @type {string} */ a,/** @type {string} */ b){
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}
 return 0;
}

/** Pure transform: tags JSON → nerulio.seed/1 document. @param {any} tags @param {{retrieved:string,mirror?:boolean,log?:(m:string)=>void}} o */
export function toSeed(tags,o){
 const log=o.log||(()=>{}),source=o.mirror?MIRROR_SOURCE_ID:SOURCE_ID;
 if(!Array.isArray(tags))throw Error('tags: expected a JSON array');
 const versions=[];const seen=new Set();
 for(const t of tags){
  const m=TAG.exec(String(t?.name||''));
  if(!m){log(`skip tag ${t?.name}`);continue;}
  const v=`${m[1]}.${m[2]}.${m[3]}`;if(seen.has(v))continue;seen.add(v);
  /** @type {{version:string,channel:string,released?:string,notes_url:string,src:string}} */
  const out={version:v,channel:'stable',notes_url:`https://projects.blender.org/blender/blender/src/tag/v${v}`,src:source};
  const c=String(t?.commit?.created||'');
  if(/^\d{4}-\d\d-\d\d/.test(c))out.released=c.slice(0,10);
  versions.push(out);
 }
 versions.sort((a,b)=>compareVersions(b.version,a.version));
 const entity={id:'app:blender',facts:/** @type {any[]} */([]),versions:versions.slice(0,MAX_VERSIONS)};
 if(versions.length)entity.facts.push({p:'latest_version',v:versions[0].version,ver:'OFFICIAL',src:source,...(o.mirror?{only_if_newer:true}:{}),...(versions[0].released?{note:`${o.mirror?'Official mirror tag commit UTC date':'Release tag commit dated'} ${versions[0].released}`}:{})});
 else log('no release tags found');
 return {
  schema:'nerulio.seed/1',vertical:'studio',
  sources:[primarySource(o.retrieved),...(o.mirror?[{id:MIRROR_SOURCE_ID,kind:'OFFICIAL_API',url:MIRROR_TAGS_URL,title:'blender/blender tags (official GitHub mirror)',publisher:'Blender Foundation',retrieved:o.retrieved,adapter:'blender-releases',note:'Official mirror documented at https://developer.blender.org/docs/handbook/contributing/using_git/clone_update/. Dates use the UTC day of the matching commit returned by the mirror Git API, not a download release time; mirror synchronization can lag the primary.'}]:[])],
  entities:[entity],
 };
}

/** @param {unknown} raw */
function commitDay(raw){
 const s=typeof raw==='string'?raw:'',match=/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.exec(s),at=Date.parse(s);
 if(!match||!Number.isFinite(at)||Number(match[2])>23||Number(match[3])>59||Number(match[4])>59)throw Error('mirror commit: invalid committer timestamp');
 const day=new Date(match[1]+'T00:00:00Z');
 if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==match[1])throw Error('mirror commit: invalid calendar date');
 return new Date(at).toISOString();
}

/** @param {BlenderContext} ctx @param {string} retrieved */
async function mirrorSeed(ctx,retrieved){
 const response=await ctx.get(MIRROR_TAGS_URL,{source:MIRROR_SOURCE_ID,accept:'application/vnd.github+json',excerpt:b=>JSON.parse(b).slice(0,5).map((/** @type {any} */ t)=>t.name)});
 if(!response.ok)throw Error(`mirror tags: HTTP ${response.status}`);
 const tags=response.json();if(!Array.isArray(tags))throw Error('mirror tags: expected a JSON array');
 const seen=new Set(),selected=tags.filter(t=>TAG.test(String(t?.name||''))).sort((a,b)=>compareVersions(String(b.name).slice(1),String(a.name).slice(1))).filter(t=>seen.has(t.name)?false:(seen.add(t.name),true)).slice(0,MAX_VERSIONS);
 if(!selected.length)throw Error('mirror tags: no numeric release tags');
 const normalized=[];
 for(const tag of selected){
  const sha=String(tag.commit?.sha||'');if(!/^[a-f0-9]{40}$/.test(sha))throw Error('mirror tag: invalid commit SHA');
  // Use the fixed official repository, never a URL supplied in the response.
  const commitResponse=await ctx.get(`https://api.github.com/repos/blender/blender/git/commits/${sha}`,{source:MIRROR_SOURCE_ID,accept:'application/vnd.github+json',excerpt:b=>{const c=JSON.parse(b);return {sha:c.sha,committedAt:c.committer?.date};}});
  if(!commitResponse.ok)throw Error(`mirror commit: HTTP ${commitResponse.status}`);
  const commit=commitResponse.json();if(commit?.sha!==sha)throw Error('mirror commit: SHA mismatch');
  normalized.push({name:tag.name,commit:{created:commitDay(commit.committer?.date)}});
 }
 return toSeed(normalized,{retrieved,mirror:true,log:ctx.log});
}

export default {
 id:'blender-releases',
 vertical:'studio',
 mode:'auto',
 freshnessHours:24,
 hosts:['projects.blender.org','api.github.com'],
 minIntervalMs:3000,
 terms:'Public Forgejo REST API (/api/swagger). On 403/429/5xx, use the official GitHub mirror documented by Blender: one 50-tag page and at most 12 matching Git commits, with the same three-second per-host interval. No challenge script, credentials or private endpoint is used.',
 /** @param {BlenderContext} ctx */
 async collect(ctx){
  const res=await ctx.get(TAGS_URL,{source:SOURCE_ID,accept:'application/json',excerpt:b=>JSON.parse(b).slice(0,5).map((/** @type {any} */ t)=>t.name)});
  if(!res.ok){
   if(res.status===403||res.status===429||(res.status>=500&&res.status<=599)){
    ctx.log(`Forgejo tags HTTP ${res.status}; reading the official GitHub mirror`);
    return mirrorSeed(ctx,new Date(ctx.now()).toISOString().slice(0,10));
   }
   throw Error(`tags: HTTP ${res.status}`);
  }
  return toSeed(res.json(),{retrieved:new Date(ctx.now()).toISOString().slice(0,10),log:ctx.log});
 },
};
