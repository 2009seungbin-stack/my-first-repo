// @ts-check
/** NVIDIA data center GPU driver releases (Linux), from NVIDIA's documented release file.
 *
 * Source: https://docs.nvidia.com/datacenter/tesla/drivers/releases.json
 * Documented on https://docs.nvidia.com/datacenter/tesla/drivers/supported-drivers-and-cuda-toolkit-versions.html:
 * "The release information can be scraped by automation tools (for example jq) by parsing the
 * release information: releases.json." (read 2026-09-28). One request per run.
 *
 * Shape observed 2026-09-28: { "<branch>": { "type": "production branch" | "lts branch" |
 * "new feature branch", "driver_info": [ {release_version, release_date (YYYY-MM-DD or ""),
 * release_notes (url), architectures[], runfile_url{arch:url}} … newest first ] } … }
 *
 * Output: one `driver` entity per branch (driver:nvidia-dc-r<branch>) with latest_version,
 * branch_type, release_date (earliest dated release listed for the branch) and every listed
 * release as a version. Download (runfile) URLs are deliberately NOT stored: Nerulio links to the
 * release notes, never hosts or deep-links installers.
 */

export const RELEASES_URL='https://docs.nvidia.com/datacenter/tesla/drivers/releases.json';
export const DOC_URL='https://docs.nvidia.com/datacenter/tesla/drivers/supported-drivers-and-cuda-toolkit-versions.html';
export const SOURCE_ID='src:nvidia-datacenter-driver-releases-json';
const BRANCH_TYPES=/** @type {Record<string,'production'|'lts'|'new_feature'>} */({
 'production branch':'production','lts branch':'lts','long term support branch':'lts','new feature branch':'new_feature',
});
const BRANCH_LABEL={production:{en:'production branch',ko:'프로덕션 브랜치'},lts:{en:'long-term support branch',ko:'장기 지원(LTS) 브랜치'},new_feature:{en:'new feature branch',ko:'신기능 브랜치'}};
const DATE=/^\d{4}-\d\d-\d\d$/;
const VERSION=/^\d{2,4}(\.\d{1,4}){1,3}$/;

/** Compare dotted numeric versions (a > b → positive). */
export function compareVersions(/** @type {string} */ a,/** @type {string} */ b){
 const x=a.split('.').map(Number),y=b.split('.').map(Number);
 for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d;}
 return 0;
}
const httpsUrl=(/** @type {unknown} */ u)=>{if(typeof u!=='string')return null;try{const x=new URL(u);return x.protocol==='https:'&&x.hostname.endsWith('nvidia.com')?x.href:null;}catch{return null;}};

/**
 * Pure transform: releases.json object → nerulio.seed/1 document.
 * @param {any} json @param {{retrieved:string,log?:(m:string)=>void}} o
 */
export function toSeed(json,o){
 const log=o.log||(()=>{});
 if(!json||typeof json!=='object'||Array.isArray(json))throw Error('releases.json: expected an object keyed by branch');
 const entities=[];
 const branches=Object.entries(json).sort((a,b)=>Number(b[0])-Number(a[0]));
 for(const [branch,info] of branches){
  if(!/^\d{3,4}$/.test(branch)){log(`skip branch key ${branch}`);continue;}
  const type=BRANCH_TYPES[String(info?.type||'').trim().toLowerCase()];
  const rows=Array.isArray(info?.driver_info)?info.driver_info:[];
  const versions=[];
  for(const r of rows){
   const v=String(r?.release_version||'').trim();
   if(!VERSION.test(v)||!v.startsWith(branch)){log(`skip release ${v} in branch ${branch}`);continue;}
   /** @type {{version:string,channel?:string,released?:string,notes_url?:string,src:string}} */
   const out={version:v,src:SOURCE_ID};
   if(type)out.channel=type;
   if(DATE.test(String(r.release_date||'')))out.released=r.release_date;
   const notes=httpsUrl(r.release_notes);if(notes)out.notes_url=notes;
   versions.push(out);
  }
  if(!versions.length){log(`branch ${branch}: no valid releases`);continue;}
  versions.sort((a,b)=>compareVersions(b.version,a.version));
  const latest=versions[0];
  const dated=versions.filter(v=>v.released).map(v=>/** @type {string} */(v.released)).sort();
  const facts=[{p:'latest_version',v:latest.version,ver:'OFFICIAL',src:SOURCE_ID}];
  if(type)facts.push({p:'branch_type',v:type,ver:'OFFICIAL',src:SOURCE_ID});
  else log(`branch ${branch}: unknown type ${JSON.stringify(info?.type)}`);
  // Oldest listed release that has a date (the file lists some old releases without one).
  if(dated.length&&versions[versions.length-1].released)facts.push({p:'release_date',v:dated[0],ver:'OFFICIAL',src:SOURCE_ID,note:'Date of the earliest release listed for this branch in releases.json'});
  const kind=type?BRANCH_LABEL[type]:null;
  entities.push({
   id:`driver:nvidia-dc-r${branch}`,type:'driver',slug:`nvidia-datacenter-driver-r${branch}`,
   names:{en:`NVIDIA Data Center GPU Driver R${branch} (Linux)`},
   aliases:[`R${branch}`,`NVIDIA R${branch}`,`NVIDIA driver ${branch}`,`${branch} driver`],
   description:{
    en:`Release branch ${branch} of NVIDIA's Linux driver for data center GPUs${kind?`, classified by NVIDIA as a ${kind.en}`:''}.`,
    ko:`데이터센터 GPU용 엔비디아 리눅스 드라이버의 ${branch} 릴리스 브랜치${kind?`로, 엔비디아가 ${kind.ko}로 분류합니다`:'입니다'}.`,
   },
   official_urls:[{label:'Supported drivers and CUDA versions',url:DOC_URL},...(latest.notes_url?[{label:`Release notes ${latest.version}`,url:latest.notes_url}]:[])],
   facts,
   relations:[{p:'made_by',o:'vendor:nvidia',src:SOURCE_ID}],
   versions,
  });
 }
 return {
  schema:'nerulio.seed/1',vertical:'hardware',
  sources:[{id:SOURCE_ID,kind:'FEED',url:RELEASES_URL,title:'NVIDIA Data Center Drivers — releases.json',publisher:'NVIDIA',retrieved:o.retrieved,adapter:'nvidia-datacenter-drivers',note:`Documented as machine-readable on ${DOC_URL}`}],
  entities,
 };
}

export default {
 id:'nvidia-datacenter-drivers',
 vertical:'hardware',
 mode:'auto',
 freshnessHours:24,
 hosts:['docs.nvidia.com'],
 minIntervalMs:2000,
 terms:'https://docs.nvidia.com/robots.txt (User-agent * allowed except tracking-parameter URLs); file documented for automation on '+DOC_URL,
 /** @param {{get:(url:string,o:{source:string,accept?:string,excerpt?:(b:string)=>unknown})=>Promise<{ok:boolean,status:number,json:()=>any}>,now:()=>number,log:(m:string)=>void}} ctx */
 async collect(ctx){
  const res=await ctx.get(RELEASES_URL,{source:SOURCE_ID,accept:'application/json',excerpt:b=>Object.keys(JSON.parse(b)).sort((x,y)=>Number(y)-Number(x)).slice(0,5)});
  if(!res.ok)throw Error(`releases.json: HTTP ${res.status}`);
  return toSeed(res.json(),{retrieved:new Date(ctx.now()).toISOString().slice(0,10),log:ctx.log});
 },
};
