// @ts-check
/** Product versions use numeric segments, not lexicographic ordering. Unknown is contagious. */
/** @param {unknown} input */
export function normalizeVersion(input){
 if(typeof input!=='string'||input.length>80)return null;
 const s=input.trim();
 const m=/^v?(\d+(?:\.\d+){0,3})(?:[- .]?(alpha|beta|rc|dev|nightly)(?:[-.]?(\d+))?)?(?:\s+(LTS))?(?:\+[\w.-]+)?$/i.exec(s);
 if(!m)return null;
 return {parts:m[1].split('.').map(Number),prerelease:m[2]?.toLowerCase()||null,iteration:Number(m[3]||0),lts:!!m[4],raw:s};
}
/** @param {string} a @param {string} b @returns {number|null} */
export function compareVersions(a,b){
 const x=normalizeVersion(a),y=normalizeVersion(b);if(!x||!y)return null;
 for(let i=0;i<Math.max(x.parts.length,y.parts.length);i++){const d=(x.parts[i]||0)-(y.parts[i]||0);if(d)return Math.sign(d);}
 if(x.prerelease!==y.prerelease){
  if(!x.prerelease)return 1;if(!y.prerelease)return -1;
  const rank=/** @type {Record<string,number>} */({nightly:0,dev:1,alpha:2,beta:3,rc:4});
  return Math.sign(rank[x.prerelease]-rank[y.prerelease]);
 }
 return Math.sign(x.iteration-y.iteration);
}
/** Tri-state: null means unsupported syntax or unknown version, never a match.
 * Supports comparator sets, exact, wildcard, caret, tilde and ||; beta/nightly must be explicit.
 * @param {string} version @param {string|undefined} range @returns {boolean|null} */
export function matchesRange(version,range){
 const v=normalizeVersion(version);if(!v||!range||range==='unknown')return null;
 if(range==='*')return !v.prerelease;
 const alternatives=range.trim().replaceAll('«','').replaceAll('»','').replace(/\s+LTS\b/gi,'').replace(/exact\s+/gi,'=').split(/\s*\|\|\s*/);
 let unknown=false;
 for(const alt of alternatives){
  const tokens=alt.replace(/(>=|<=|>|<|=|\^|~)\s+/g,'$1').split(/\s+/).filter(Boolean);
  if(!tokens.length){unknown=true;continue;}
  let ok=true,valid=true,explicitPrerelease=false;
  for(const token of tokens){
   const m=/^(>=|<=|>|<|=|\^|~)?(v?\d+(?:\.(?:\d+|x|\*)){0,3}(?:[-.]?(?:alpha|beta|rc|nightly|dev)(?:[-.]?\d+)?)?)$/i.exec(token);
   if(!m){valid=false;break;}
   const op=m[1]||'=',s=m[2];
   if(/[x*]/i.test(s)){
    if(op!=='='){valid=false;break;}
    const prefix=s.replace(/^v/,'').split('.');ok=ok&&prefix.every((p,i)=>/[x*]/i.test(p)||Number(p)===(v.parts[i]||0));continue;
   }
   const n=normalizeVersion(s),cmp=compareVersions(version,s);if(!n||cmp===null){valid=false;break;}
   if(n.prerelease)explicitPrerelease=true;
   if(op==='^'||op==='~'){
    const hi=[...n.parts];while(hi.length<3)hi.push(0);
    const index=op==='~'?1:(hi.findIndex(x=>x!==0)===-1?2:hi.findIndex(x=>x!==0));
    hi[index]++;for(let i=index+1;i<hi.length;i++)hi[i]=0;
    ok=ok&&cmp>=0&&/** @type {number} */(compareVersions(version,hi.join('.')))<0;
   }else ok=ok&&(op==='>='?cmp>=0:op==='<='?cmp<=0:op==='>'?cmp>0:op==='<'?cmp<0:cmp===0);
  }
  if(valid&&ok&&(!v.prerelease||explicitPrerelease))return true;
  if(!valid)unknown=true;
 }
 return unknown?null:false;
}
