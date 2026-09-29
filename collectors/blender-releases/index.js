// @ts-check
/** Blender release versions from the official Blender Forgejo instance (projects.blender.org).
 *
 * Endpoint: GET https://projects.blender.org/api/v1/repos/blender/blender/tags?limit=50
 *   Forgejo/Gitea REST API, documented by the instance itself at https://projects.blender.org/api/swagger
 *   (observed responding 2026-09-28). Release tags are named vX.Y.Z; each tag carries the commit
 *   timestamp (`commit.created`) of the release commit, which is used as the release date and is
 *   labelled as such (it can differ by a day from the date on blender.org/download).
 * Why not blender.org/download: that page is HTML; the tag API is structured and official.
 *
 * Output: partial entity app:blender with latest_version (highest vX.Y.Z tag) and the newest
 * MAX_VERSIONS release tags as versions (Blender LTS lines, e.g. 4.5.x, keep receiving tags; ingest
 * treats channel 'stable' and 'lts' as the same release, so a seeded LTS row is not duplicated).
 * latest_version is OFFICIAL: the Blender Foundation's own release tags (see reaper-whatsnew).
 */

export const TAGS_URL='https://projects.blender.org/api/v1/repos/blender/blender/tags?limit=50';
export const SOURCE_ID='src:auto-blender-forgejo-tags';
export const MAX_VERSIONS=12;
const TAG=/^v(\d+)\.(\d+)\.(\d+)$/;

export function compareVersions(/** @type {string} */ a,/** @type {string} */ b){
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}
 return 0;
}

/** Pure transform: tags JSON → nerulio.seed/1 document. @param {any} tags @param {{retrieved:string,log?:(m:string)=>void}} o */
export function toSeed(tags,o){
 const log=o.log||(()=>{});
 if(!Array.isArray(tags))throw Error('tags: expected a JSON array');
 const versions=[];const seen=new Set();
 for(const t of tags){
  const m=TAG.exec(String(t?.name||''));
  if(!m){log(`skip tag ${t?.name}`);continue;}
  const v=`${m[1]}.${m[2]}.${m[3]}`;if(seen.has(v))continue;seen.add(v);
  /** @type {{version:string,channel:string,released?:string,notes_url:string,src:string}} */
  const out={version:v,channel:'stable',notes_url:`https://projects.blender.org/blender/blender/releases/tag/v${v}`,src:SOURCE_ID};
  const c=String(t?.commit?.created||'');
  if(/^\d{4}-\d\d-\d\d/.test(c))out.released=c.slice(0,10);
  versions.push(out);
 }
 versions.sort((a,b)=>compareVersions(b.version,a.version));
 const entity={id:'app:blender',facts:/** @type {any[]} */([]),versions:versions.slice(0,MAX_VERSIONS)};
 if(versions.length)entity.facts.push({p:'latest_version',v:versions[0].version,ver:'OFFICIAL',src:SOURCE_ID,...(versions[0].released?{note:`Release tag commit dated ${versions[0].released}`}:{})});
 else log('no release tags found');
 return {
  schema:'nerulio.seed/1',vertical:'studio',
  sources:[{id:SOURCE_ID,kind:'OFFICIAL_API',url:TAGS_URL,title:'blender/blender tags (projects.blender.org Forgejo API)',publisher:'Blender Foundation',retrieved:o.retrieved,adapter:'blender-releases',note:'API documented at https://projects.blender.org/api/swagger; dates are tag commit timestamps.'}],
  entities:[entity],
 };
}

export default {
 id:'blender-releases',
 vertical:'studio',
 mode:'auto',
 freshnessHours:24,
 hosts:['projects.blender.org'],
 minIntervalMs:3000,
 terms:'Public Forgejo REST API of projects.blender.org (documented at /api/swagger). robots.txt sits behind a Cloudflare browser challenge and could not be read by a script on 2026-09-28; the adapter makes a single API request per run.',
 /** @param {{get:(url:string,o:{source:string,accept?:string,excerpt?:(b:string)=>unknown})=>Promise<{ok:boolean,status:number,json:()=>any}>,now:()=>number,log:(m:string)=>void}} ctx */
 async collect(ctx){
  const res=await ctx.get(TAGS_URL,{source:SOURCE_ID,accept:'application/json',excerpt:b=>JSON.parse(b).slice(0,5).map((/** @type {any} */ t)=>t.name)});
  if(!res.ok)throw Error(`tags: HTTP ${res.status}`);
  return toSeed(res.json(),{retrieved:new Date(ctx.now()).toISOString().slice(0,10),log:ctx.log});
 },
};
