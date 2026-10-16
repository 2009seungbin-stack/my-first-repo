// @ts-check
import {ADAPTERS,emptyEnvironment} from '../adapters/index.js';
/** Fictional identity names prevent demo assertions from matching real products. */
const NAMES={
 obs:['Canvas Switch','Scene Motion','Source Capture','Color Filter','Chat Dock','Audio Monitor','Camera Bridge','Caption Tool','Legacy Overlay','Unverified Filter','Old Encoder','Retired Dock','Web Runtime','Hotkey Control','Script Pack','Output Monitor'],
 studio:['Session DAW','Equalizer','Compressor','Reverb','Tape Color','Synth AU','Meter AAX','MIDI Router','License Service','Unverified Piano','Interface Driver','Retired VST2','Control Panel','Standalone Synth','System Audio','Firmware'],
 blender:['Mesh Toolkit','UV Toolkit','Scatter Pack','Node Library','Render Bridge','Asset Shelf','Export Tool','Pipeline Script','Legacy Add-on','Unverified Rig','Native Renderer','Retired API Tool','Python Runtime','Model Library','Godot Export Tool','External Converter'],
 godot:['Steam Bridge','Dialogue Kit','Terrain Kit','Render Helper','Editor Tools','Export Helper','Asset Pack','Input Helper','Legacy Add-on','Unverified Terrain','Native Extension','Retired Tool','Native Runtime','Export Templates','Shader Pack','Navigation Tools'],
};
const CATEGORIES={
 obs:['Plugin','Transition','Source','Filter','Plugin','Filter','Source','Script','Plugin','Filter','Plugin','Plugin','Runtime','Control Tool','Script','Filter'],
 studio:['DAW','VST3','AU','VST3','VST3','AU','AAX','MIDI Tool','License Manager','VST3','Driver','VST2','Control Software','Standalone Application','System Extension','Hardware Firmware'],
 blender:['Add-on','Add-on','Geometry Node Pack','Geometry Node Pack','Render Engine','Asset Library','Export Tool','Pipeline Tool','Add-on','Add-on','Render Engine','Python Tool','Python Tool','Asset Library','Export Tool','External CLI'],
 godot:['Add-on','Dialogue Tool','Terrain Plugin','Rendering Plugin','Editor Plugin','Export Plugin','Asset Dependency','Add-on','Add-on','Terrain Plugin','GDExtension','Editor Plugin','Native Library','Export Template','Rendering Plugin','Add-on'],
};
/** @param {import('../core/types').Vertical} vertical */
export function makeSample(vertical){
 const a=ADAPTERS[vertical],environment=emptyEnvironment(vertical);
 environment.name='Demo '+a.host+' stack';environment.sample=true;environment.generatedAt='2026-10-05T00:00:00Z';
 /** @type {import('../core/types').CompatibilityRecord[]} */
 const records=[];
 /** @type {import('../core/types').CatalogEntry[]} */
 const catalog=[];
 environment.components=NAMES[vertical].map((name,i)=>{
  const id='demo-'+vertical+'-'+i,category=CATEGORIES[vertical][i];
  catalog.push({id,name:'Demo '+name,vendor:'Fictional Demo Vendor',category,aliases:[],sample:true});
  /** @type {import('../core/types').PreflightComponent} */
  const c={id,name:'Demo '+name,vendor:'Fictional Demo Vendor',category,version:i===6||i===7?'0.9.0':'1.2.0',critical:i!==10,sample:true};
  if(i===9)return c; // intentionally missing evidence
  const status=/** @type {import('../core/types').ComponentStatus} */(i===8?'LEGACY':i===10?'BLOCKED':i===11?'DEPRECATED':i===15?'NOT_APPLICABLE':'READY');
  const date=i===5?'2026-01-01':'2026-10-05';
  const ev=/** @type {import('../core/types').CompatibilityEvidence} */({sourceType:'sample',title:'SAMPLE DATA — fictional compatibility statement',
   checkedAt:date,quoteSummary:'Fictional fixture for demonstrating the report. This is not a verified vendor statement.'});
  /** @type {import('../core/types').CompatibilityRecord} */
  const record={id:id+'-record',componentId:id,componentName:c.name,vendor:c.vendor||'',componentType:category,host:a.host,
   hostVersionRange:vertical==='obs'?'>=33 <34':vertical==='studio'?'>=26 <27':vertical==='blender'?'>=5.2 <5.3':'>=4.7 <4.8',
   platform:['windows','macos','linux'],architecture:['universal'],componentVersionRange:'>=1 <3',minimumVersion:'1.0.0',recommendedVersion:'1.2.0',
   maximumTestedVersion:a.defaultTarget,compatibilityStatus:status,notes:'SAMPLE: fictional '+status.toLowerCase().replaceAll('_',' ')+' scenario.',
   dependencies:[],knownIssues:[],breakingChanges:[],evidence:[ev],lastVerifiedAt:date,sample:true};
  if(i===6||i===7)record.requiredAction='SAMPLE: update '+c.name+' to 1.2.0 before the host upgrade.';
  if(i===8)record.requiredAction='SAMPLE: migrate '+c.name+' using its fictional vendor installer.';
  if(i===10){
   c.critical=vertical!=='obs';
   record.hardBlocker=vertical==='studio';
   record.notes='SAMPLE: no matching native binary or driver is available for this target.';
   if(vertical==='blender'||vertical==='godot')record.breakingChanges.push({id:'demo-api-break',targetVersionRange:record.hostVersionRange,
    description:'SAMPLE: target engine API changed; this fictional extension has no released fix.',evidence:[ev]});
  }
  if(i===13)record.dependencies=[{componentId:'demo-'+vertical+'-'+(vertical==='studio'?8:12),versionRange:'>=1'}];
  if(i===12&&vertical==='studio')record.dependencies=[{componentId:'demo-studio-10',versionRange:'>=1'}];
  if(i===4&&vertical==='blender')record.dependencies=[{componentId:'demo-blender-10',versionRange:'>=1'}];
  if(i===14&&vertical==='godot')record.requirements={renderer:['forward_plus'],language:['gdscript']};
  if(i===2&&vertical==='studio')record.requirements={nativeMode:'rosetta',formats:['AU','VST3']};
  if(i===12&&vertical==='blender')record.requirements={runtimes:{Python:'>=3.11 <3.14'}};
  records.push(record);
  // Demonstrate a stricter next target without implying a real future compatibility statement.
  if(vertical==='obs')records.push({...record,id:id+'-next',hostVersionRange:'>=34 <35',
   compatibilityStatus:i===0||i===8?'BLOCKED':status,hardBlocker:i===0,notes:'SAMPLE: fictional OBS 34 target scenario.'});
  return c;
 });
 if(environment.target){
  if(vertical==='studio')environment.target.formats=['AU','VST3'];
  if(vertical==='blender')environment.target.runtimes={Python:'3.13'};
 }
 return {environment,records,catalog};
}
