// @ts-check
import {compareVersions,matchesRange} from '../core/versions.js';
/** Source-backed OBS-specific observations. Core decides priority, confidence and verdict. */
export const OBS_PATH_EVIDENCE=Object.freeze(/** @type {import('../core/types').CompatibilityEvidence} */({
 sourceType:'vendor',title:'OBS — Legacy Plugin Locations',url:'https://obsproject.com/kb/legacy-plugin-locations',
 checkedAt:'2026-10-05',sourcePublishedAt:'2026-09-21',
 quoteSummary:'OBS 33 flags old Windows structures as legacy. The documented Program Files structure stops loading in OBS 34; ProgramData and portable legacy structures have no announced cutoff. macOS locations are unchanged.',
}));
const OBS_ABI_EVIDENCE=/** @type {import('../core/types').CompatibilityEvidence} */({
 sourceType:'release_notes',title:'OBS Studio 32.0 Release Notes',url:'https://obsproject.com/blog/obs-studio-32-0-release-notes',
 checkedAt:'2026-10-05',sourcePublishedAt:'2025-09-22',
 quoteSummary:'Starting with OBS 32, modules built for a newer OBS release are not loaded.',
});
/** @param {import('../core/types').PreflightComponent} c */
function normalizeObs(c){
 const path=(c.installPath||'').replaceAll('\\','/').toLowerCase();
 let installType=c.installType||'unknown';
 if(path.includes('/programdata/obs-studio/plugins/')&&path.includes('/bin/64bit/'))installType='programdata-legacy';
 // Only the specifically documented plugins/<name>/bin/64bit path has the 34 cutoff.
 else if(/\/program files(?: \(x86\))?\/obs-studio\/plugins\/[^/]+\/bin\/64bit\//.test(path))installType='programfiles-legacy';
 else if(path.includes('/programdata/obs-studio/plugins/'))installType='modern';
 else if(path.includes('/obs-plugins/'))installType='old-plugin-directory';
 return {...c,installType};
}
/** @type {Record<import('../core/types').Vertical,import('../core/types').Adapter>} */
export const ADAPTERS={
 obs:{id:'obs',host:'OBS Studio',icon:'film',defaultCurrent:'32.2.2',defaultTarget:'33.0',
  defaultPlatform:'windows',defaultArchitecture:'x86_64',
  categories:['Plugin','Source','Filter','Transition','Runtime','Script','Control Tool'],
  normalizeComponent:normalizeObs,backup:'backup.obs',verify:'verify.obs',
  inspect:(c,e,t)=>{
   /** @type {import('../core/types').Finding[]} */
   const findings=[];
   if(t.platform==='windows'&&matchesRange(t.version,'>=33')===true&&['programdata-legacy','programfiles-legacy','old-plugin-directory','portable-legacy'].includes(c.installType||'')){
    const blocked=c.installType==='programfiles-legacy'&&matchesRange(t.version,'>=34')===true;
    findings.push({status:blocked?'BLOCKED':'LEGACY',reason:{code:blocked?'obsPathBlocked':'obsLegacy',args:{type:c.installType||''}},
     evidence:[OBS_PATH_EVIDENCE],hard:blocked,
     action:'Use the plugin vendor’s updated installer and OBS’s documented directory structure. Back up configuration before migrating; do not move arbitrary DLLs without preserving the matching data folder.'});
   }
   if(c.builtForHost&&matchesRange(t.version,'>=32')===true&&compareVersions(c.builtForHost,t.version)===1)
    findings.push({status:'BLOCKED',reason:{code:'obsBuiltNewer',args:{version:c.builtForHost}},evidence:[OBS_ABI_EVIDENCE],hard:true});
   return findings;
  }},
 studio:{id:'studio',host:'macOS',icon:'pulse',defaultCurrent:'15',defaultTarget:'26',
  hosts:{macos:'macOS',windows:'Windows',linux:'Linux'},
  defaultPlatform:'macos',defaultArchitecture:'arm64',
  categories:['DAW','VST2','VST3','AU','AAX','Audio Interface','Driver','Control Software','License Manager','Standalone Application','MIDI Tool','System Extension','Hardware Firmware'],
  normalizeComponent:c=>({...c}),backup:'backup.studio',verify:'verify.studio'},
 blender:{id:'blender',host:'Blender',icon:'brush',defaultCurrent:'4.5 LTS',defaultTarget:'5.2 LTS',
  defaultPlatform:'windows',defaultArchitecture:'x86_64',
  categories:['Add-on','Extension','Geometry Node Pack','Render Engine','Python Tool','Asset Library','Export Tool','Pipeline Tool','External CLI'],
  normalizeComponent:c=>({...c}),backup:'backup.blender',verify:'verify.blender'},
 godot:{id:'godot',host:'Godot',icon:'gamepad',defaultCurrent:'4.6',defaultTarget:'4.7',
  defaultPlatform:'windows',defaultArchitecture:'x86_64',
  categories:['Editor Plugin','Add-on','GDExtension','Native Library','Dialogue Tool','Terrain Plugin','Rendering Plugin','Export Plugin','Export Template','Asset Dependency'],
  normalizeComponent:c=>({...c}),backup:'backup.godot',verify:'verify.godot'},
};
/** @param {import('../core/types').Vertical} vertical */
export function emptyEnvironment(vertical){
 const a=ADAPTERS[vertical];
 return /** @type {import('../core/types').PreflightEnvironment} */({schemaVersion:1,vertical,name:'My setup',generatedAt:new Date().toISOString(),sample:false,
  host:{name:a.host,version:a.defaultCurrent},platform:a.defaultPlatform,architecture:a.defaultArchitecture,components:[],
  target:{version:a.defaultTarget,platform:a.defaultPlatform,architecture:a.defaultArchitecture,...(vertical==='godot'?{renderer:'forward_plus',language:'gdscript'}:{})}});
}
/** Explicit loader map lets static hosting serve each vertical independently.
 * @param {import('../core/types').Vertical} vertical */
export function loadDatabase(vertical){
 const loaders={obs:()=>import('../data/obs.js'),studio:()=>import('../data/studio.js'),blender:()=>import('../data/blender.js'),godot:()=>import('../data/godot.js')};
 return loaders[vertical]();
}
