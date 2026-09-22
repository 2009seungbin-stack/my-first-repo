/** Texture-set classification and PBR validation. Pure: takes measurements (which the UI
 * collects once per file) and returns issue records with ids and numbers. The wording lives in
 * src/task/strings.js so every issue exists in ko/en/ja. */
export const ROLES=Object.freeze(['albedo','normal','roughness','smoothness','metallic','ao','height','emission','orm','opacity','specular','unknown']);
/** Single-channel roles: one grey value per texel is all the engine reads. */
export const GRAY_ROLES=Object.freeze(['roughness','smoothness','metallic','ao','height','opacity']);
/** Guidance only — no file is inspected for an ICC profile or a gamma curve here. Colour data
 * is authored in sRGB; everything that is a number rather than a colour must stay linear. */
export const COLOR_SPACE=Object.freeze({albedo:'srgb',emission:'srgb',specular:'srgb',normal:'linear',roughness:'linear',smoothness:'linear',metallic:'linear',ao:'linear',height:'linear',orm:'linear',opacity:'linear',unknown:'unknown'});
/** Filename rules, most specific first. Each is matched against the stem with separators
 * normalised to '_', so "T_Rock_ORM.png", "rock-basecolor.png" and "rock_n.png" all classify. */
const RULES=Object.freeze([
 ['orm',/(^|_)(orm|arm|rma|mra|maskmap|mask_map|packed|mask)(_|$)/],
 ['albedo',/(^|_)(albedo|basecolor|base_color|base_colour|diffuse|diff|col|color|colour|alb)(_|$)/],
 ['normal',/(^|_)(normal|normalmap|normal_map|nrm|norm|nor|n)(_|$)/],
 ['roughness',/(^|_)(roughness|rough|rgh|r)(_|$)/],
 ['smoothness',/(^|_)(smoothness|smooth|gloss|glossiness)(_|$)/],
 ['metallic',/(^|_)(metallic|metalness|metal|mtl|met|m)(_|$)/],
 ['ao',/(^|_)(ao|occlusion|ambientocclusion|ambient_occlusion|occ)(_|$)/],
 ['height',/(^|_)(height|displacement|disp|bump|hgt|h)(_|$)/],
 ['emission',/(^|_)(emission|emissive|emit|glow|e)(_|$)/],
 ['opacity',/(^|_)(opacity|alpha|transparency|transparent|mask_alpha)(_|$)/],
 ['specular',/(^|_)(specular|spec|reflection)(_|$)/]
]);
export const normalizeStem=name=>String(name).replace(/\.[^.]+$/,'').toLowerCase().replace(/[\s.\-+]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
/** Which map a filename claims to be, plus the set name left over once the role token is
 * removed — that leftover is what the naming-consistency check compares. */
export function classifyTextureName(name){
 const stem=normalizeStem(name);
 for(const [role,pattern] of RULES){
  const match=stem.match(pattern);
  if(match)return {role,token:match[2],confidence:match[2].length>2?'high':'low',setName:stem.replace(pattern,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||stem};
 }
 return {role:'unknown',token:'',confidence:'none',setName:stem};
}
/** Workflows a real engine actually asks for. `channels` names the packed map when there is one. */
export const WORKFLOWS=Object.freeze({
 'metallic-roughness':{required:['albedo'],recommended:['normal','roughness','metallic'],optional:['ao','emission','height','opacity'],preset:null},
 'unity-hdrp-mask':{required:['albedo','orm'],recommended:['normal'],optional:['height','emission','opacity'],preset:'unity-hdrp-mask'},
 'unity-urp-metallic':{required:['albedo'],recommended:['normal','metallic'],optional:['ao','emission','height','opacity'],preset:'unity-urp-metallic'},
 'unreal-orm':{required:['albedo'],recommended:['normal','orm'],optional:['emission','height','opacity'],preset:'unreal-orm'},
 'godot-orm':{required:['albedo'],recommended:['normal','orm'],optional:['emission','height','opacity'],preset:'godot-orm'}
});
export const WORKFLOW_IDS=Object.freeze(Object.keys(WORKFLOWS));
export const isPowerOfTwo=n=>Number.isInteger(n)&&n>0&&(n&(n-1))===0;
/** Validates a set of measured textures. Every issue carries an id (translated by the UI),
 * a level, the files it concerns and the numbers behind it. No issue is invented from a
 * filename alone where a pixel measurement was available. */
export function validateTextureSet(entries,{workflow='metallic-roughness',requireSquare=false}={}){
 const spec=WORKFLOWS[workflow];if(!spec)throw Error('Unknown texture workflow');
 const issues=[],used=entries.filter(e=>e.role!=='unknown'&&!e.skip);
 const add=(id,level,fields={})=>issues.push({id,level,...fields});
 if(!entries.length)return {issues,ok:false,workflow};
 const sizes=[...new Set(entries.map(e=>`${e.width}x${e.height}`))];
 if(sizes.length>1)add('dimension-mismatch','error',{sizes,files:entries.map(e=>({name:e.name,size:`${e.width}x${e.height}`}))});
 const byRole=new Map();
 for(const e of used)byRole.set(e.role,[...(byRole.get(e.role)||[]),e]);
 for(const [role,list] of byRole)if(list.length>1)add('duplicate-role','warn',{role,files:list.map(e=>e.name)});
 const has=role=>byRole.has(role)||role==='roughness'&&byRole.has('smoothness')||role==='smoothness'&&byRole.has('roughness');
 for(const role of [...spec.required,...spec.recommended]){
  if(has(role))continue;
  add(spec.required.includes(role)?'missing-required':'missing-recommended',spec.required.includes(role)?'error':'warn',{role,workflow});
  // The packed map is missing but the maps it is made of are here: that is a packing step, not a missing asset.
  if(role==='orm'&&has('roughness')&&byRole.has('metallic'))add('pack-available','info',{role,parts:['ao','roughness','metallic'].filter(r=>has(r)),preset:spec.preset});
 }
 for(const e of entries){
  if(e.skip)continue;
  if(!isPowerOfTwo(e.width)||!isPowerOfTwo(e.height))add('not-power-of-two','warn',{name:e.name,width:e.width,height:e.height});
  if(requireSquare&&e.width!==e.height)add('not-square','info',{name:e.name,width:e.width,height:e.height});
  if(e.role==='unknown')add('unclassified','warn',{name:e.name});
  if(e.alpha?.used&&!['albedo','opacity','orm','unknown'].includes(e.role)&&!(e.role==='metallic'&&workflow==='unity-urp-metallic'))
   add('unexpected-alpha','warn',{name:e.name,role:e.role,min:e.alpha.min,zeroPixels:e.alpha.zeroPixels});
  if(e.alpha?.rgbUnderZeroAlpha)add('rgb-under-zero-alpha','info',{name:e.name,pixels:e.alpha.rgbUnderZeroAlpha});
  if(GRAY_ROLES.includes(e.role)&&e.color){
   if(e.color.grayscale&&e.channels>1)add('gray-stored-as-rgb','info',{name:e.name,role:e.role});
   else if(!e.color.grayscale)add('gray-channels-differ','warn',{name:e.name,role:e.role,maxSpread:e.color.maxSpread,ratio:Math.round(e.color.differingRatio*1000)/10});
  }
  if(e.role==='normal'&&e.normal){
   if(!e.normal.unitLength)add('normal-not-unit','warn',{name:e.name,maxDeviation:Math.round(e.normal.maxDeviation*100)/100,ratio:Math.round(e.normal.offUnitRatio*1000)/10});
   if(!e.normal.blueNonNegative)add('normal-blue-negative','warn',{name:e.name,minBlue:e.normal.minBlue,ratio:Math.round(e.normal.negativeBlueRatio*1000)/10});
   if(e.normal.flatRatio>.995)add('normal-all-flat','info',{name:e.name});
  }
  if(e.role!=='normal'&&e.normal?.looksLikeNormalMap&&e.role!=='unknown')add('looks-like-normal','warn',{name:e.name,role:e.role});
 }
 const names=[...new Set(used.map(e=>e.setName).filter(Boolean))];
 if(names.length>1)add('naming-inconsistent','info',{names});
 return {issues,ok:!issues.some(i=>i.level==='error'),workflow,roles:[...byRole.keys()],size:sizes[0]||''};
}
/** Colour-space guidance for one role: what to set at import time. Guidance, not detection. */
export const colorSpaceOf=role=>COLOR_SPACE[role]||'unknown';
