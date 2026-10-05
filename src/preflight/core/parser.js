// @ts-check
import {POLICY} from './policy.js';
/** @typedef {import('./types').PreflightEnvironment} Environment */
export const PLATFORMS=['windows','macos','linux'],ARCHITECTURES=['x86_64','arm64','x86','universal'],VERTICALS=['obs','studio','blender','godot'];
/** @param {unknown} x @returns {Record<string,any>} */
function object(x){if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Expected an object');return /** @type {Record<string,any>} */(x);}
/** @param {unknown} x @param {string} field @param {boolean} [required] */
function text(x,field,required=false){
 if(x===undefined&&!required)return '';
 if(typeof x!=='string'||x.length>1024||required&&!x.trim())throw Error('Invalid '+field);
 return x.trim();
}
/** @param {unknown} x @param {string[]} allowed @param {string} name */
function choice(x,allowed,name){if(typeof x!=='string'||!allowed.includes(x))throw Error('Invalid '+name);return x;}
/** @param {unknown} x @returns {import('./types').Dependency[]} */
function dependencies(x){
 if(x===undefined)return [];if(!Array.isArray(x)||x.length>100)throw Error('Invalid dependencies');
 return x.map(d=>{d=object(d);return {componentId:text(d.componentId,'dependency ID',true),versionRange:text(d.versionRange,'dependency range')||undefined,optional:d.optional===true};});
}
/** Pick known fields only; imported compatibility conclusions are not trusted.
 * @param {unknown} input @returns {Environment} */
export function validateEnvironment(input){
 const x=object(input);
 if(x.schemaVersion!==1)throw Error('Unsupported schemaVersion. Expected 1.');
 const vertical=/** @type {import('./types').Vertical} */(choice(x.vertical,VERTICALS,'vertical'));
 const platform=/** @type {import('./types').Platform} */(choice(x.platform,PLATFORMS,'platform'));
 const architecture=/** @type {import('./types').Architecture} */(choice(x.architecture,ARCHITECTURES,'architecture'));
 const host=object(x.host);
 if(!Array.isArray(x.components)||x.components.length>POLICY.maxComponents)throw Error('Invalid components (maximum 10,000).');
 const ids=new Set();
 const components=x.components.map((value,i)=>{
  const c=object(value),id=text(c.id,'component ID')||'import-'+i;
  if(ids.has(id))throw Error('Duplicate component ID: '+id);ids.add(id);
  if(!/^[\w.:-]{1,160}$/.test(id))throw Error('Invalid component ID');
  /** @type {import('./types').PreflightComponent} */
  const component={id,name:text(c.name,'component name',true),category:text(c.category,'category')||'Other',vendor:text(c.vendor,'vendor'),version:text(c.version,'version')||undefined,
   critical:c.critical!==false,ignored:c.ignored===true,sample:id.startsWith('demo-')&&c.sample===true,
   installPath:text(c.installPath,'installation path'),installType:text(c.installType,'installation type'),
   builtForHost:text(c.builtForHost,'built-for host version'),dependencies:dependencies(c.dependencies)};
  if(c.platform!==undefined)component.platform=/** @type {import('./types').Platform} */(choice(c.platform,PLATFORMS,'component platform'));
  if(c.architecture!==undefined)component.architecture=/** @type {import('./types').Architecture} */(choice(c.architecture,ARCHITECTURES,'component architecture'));
  if(c.native!==undefined){if(typeof c.native!=='boolean')throw Error('Invalid native flag');component.native=c.native;}
  return component;
 });
 const generatedAt=text(x.generatedAt,'generatedAt')||new Date().toISOString();
 if(!Number.isFinite(Date.parse(generatedAt)))throw Error('Invalid generatedAt');
 const env=/** @type {Environment} */({schemaVersion:1,vertical,platform,architecture,name:text(x.name,'setup name')||host.name||'My setup',
  generatedAt,sample:x.sample===true||components.some(c=>c.sample||c.id.startsWith('demo-')),host:{name:text(host.name,'host name',true),version:text(host.version,'host version')},components});
 if(x.target)env.target=validateTarget(x.target);
 return env;
}
/** @param {unknown} input @returns {import('./types').PreflightTarget} */
export function validateTarget(input){
 const x=object(input),t=/** @type {import('./types').PreflightTarget} */({
  version:text(x.version,'target version'),platform:choice(x.platform,PLATFORMS,'target platform'),
  architecture:choice(x.architecture,ARCHITECTURES,'target architecture'),osVersion:text(x.osVersion,'OS version'),
  renderer:text(x.renderer,'renderer'),language:text(x.language,'language'),daw:text(x.daw,'DAW'),
 });
 if(x.formats!==undefined){if(!Array.isArray(x.formats)||x.formats.length>20)throw Error('Invalid formats');t.formats=x.formats.map(f=>text(f,'format',true));}
 if(x.runtimes!==undefined){const r=object(x.runtimes);if(Object.keys(r).length>20)throw Error('Invalid runtimes');t.runtimes=Object.fromEntries(Object.entries(r).map(([k,v])=>[text(k,'runtime name',true),text(v,'runtime version')]));}
 return t;
}
/** JSON report, saved setup and scanner inventories share the same parser.
 * @param {string} content @param {string} [expectedVertical] */
export function importEnvironment(content,expectedVertical){
 if(new TextEncoder().encode(content).length>POLICY.maxImportBytes)throw Error('Import exceeds 5 MB.');
 const input=object(JSON.parse(content));
 const env=validateEnvironment(input.environment||input);
 if(expectedVertical&&env.vertical!==expectedVertical)throw Error('Import belongs to '+env.vertical+'. Open that Preflight page.');
 return env;
}
/** Index once per dataset; no repeated object transformation per keystroke.
 * @param {import('./types').CatalogEntry[]} catalog */
export function createCatalogIndex(catalog){
 const aliases=new Map(),search=catalog.filter(c=>!c.sample).map(c=>{
  for(const name of [c.id,c.name,...c.aliases])aliases.set(name.toLowerCase(),c);
  return {entry:c,text:[c.name,c.vendor,c.category,...c.aliases].join(' ').toLowerCase()};
 });
 return {aliases,search,find:(/** @type {string} */ query)=>aliases.get(query.trim().toLowerCase()),
  query:(/** @type {string} */ query,limit=20)=>{const words=query.toLowerCase().split(/\s+/).filter(Boolean);return search.filter(c=>words.every(w=>c.text.includes(w))).slice(0,limit).map(c=>c.entry);}};
}
/** One component per line, optional version after @ or a tab. Repeated identities are deduplicated.
 * @param {string} content @param {ReturnType<typeof createCatalogIndex>} index */
export function parsePasteList(content,index){
 if(new TextEncoder().encode(content).length>POLICY.maxImportBytes)throw Error('Paste exceeds 5 MB.');
 const lines=content.split(/\r?\n/).map(s=>s.replace(/^\s*[-*•]\s*/,'').trim()).filter(Boolean);
 if(lines.length>POLICY.maxComponents)throw Error('Maximum 10,000 components.');
 const seen=new Set();
 return lines.flatMap((line,i)=>{
  let name=line,version='';
  const split=/^(.+?)(?:\s*@\s*|\t+|\s+v(?=\d))(\d[^\t]*)$/.exec(line);
  if(split){name=split[1].trim();version=split[2].trim();}
  const known=index.find(name),key=known?.id||name.toLowerCase();
  if(seen.has(key))return [];seen.add(key);
  return [{id:known?.id||'custom-'+i+'-'+hashName(name),name:known?.name||name,vendor:known?.vendor||'',category:known?.category||'Other',version,critical:known?.critical!==false}];
 });
}
/** @param {string} name */
export function hashName(name){let h=2166136261;for(const c of name.toLowerCase())h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);}
