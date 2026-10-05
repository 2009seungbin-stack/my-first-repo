// @ts-check
import {makeSample} from './sample.js';
const sample=makeSample('obs');
/** Catalog links identify vendors; they are not compatibility evidence. */
export const catalog=/** @type {import('../core/types').CatalogEntry[]} */([
 {id:'streamfx',name:'StreamFX',vendor:'Xaymar',category:'Plugin',aliases:['Stream FX'],vendorUrl:'https://github.com/Xaymar/obs-StreamFX'},
 {id:'aitum-vertical',name:'Aitum Vertical',vendor:'Aitum',category:'Plugin',aliases:['Vertical Canvas','obs-vertical-canvas'],vendorUrl:'https://github.com/Aitum/obs-vertical-canvas/releases'},
 {id:'move-transition',name:'Move Transition',vendor:'Exeldro',category:'Transition',aliases:['Move','obs-move-transition'],vendorUrl:'https://github.com/exeldro/obs-move-transition/releases'},
 {id:'source-record',name:'Source Record',vendor:'Exeldro',category:'Source',aliases:['obs-source-record'],vendorUrl:'https://github.com/exeldro/obs-source-record/releases'},
 {id:'obs-websocket',name:'obs-websocket',vendor:'OBS Project',category:'Runtime',aliases:['WebSocket'],vendorUrl:'https://github.com/obsproject/obs-websocket'},
 {id:'distroav',name:'DistroAV',vendor:'DistroAV',category:'Plugin',aliases:['obs-ndi','NDI'],vendorUrl:'https://github.com/DistroAV/DistroAV'},
 {id:'advanced-scene-switcher',name:'Advanced Scene Switcher',vendor:'Warmuptill',category:'Plugin',aliases:['Scene Switcher'],vendorUrl:'https://github.com/WarmUpTill/obs-advanced-scene-switcher'},
 {id:'multiple-rtmp',name:'Multiple RTMP Outputs',vendor:'sorayuki',category:'Plugin',aliases:['multi-rtmp'],vendorUrl:'https://github.com/sorayuki/obs-multi-rtmp'},
 {id:'shaderfilter',name:'Shaderfilter',vendor:'Exeldro',category:'Filter',aliases:['obs-shaderfilter'],vendorUrl:'https://github.com/exeldro/obs-shaderfilter'},
 {id:'replay-source',name:'Replay Source',vendor:'Exeldro',category:'Source',aliases:['obs-replay-source'],vendorUrl:'https://github.com/exeldro/obs-replay-source'},
 {id:'audio-monitor',name:'Audio Monitor',vendor:'Exeldro',category:'Filter',aliases:['obs-audio-monitor'],vendorUrl:'https://github.com/exeldro/obs-audio-monitor'},
 {id:'input-overlay',name:'Input Overlay',vendor:'univrsal',category:'Source',aliases:['input-overlay'],vendorUrl:'https://github.com/univrsal/input-overlay'},
 {id:'streamdeck',name:'Stream Deck OBS plugin',vendor:'Elgato',category:'Control Tool',aliases:['Stream Deck'],vendorUrl:'https://www.elgato.com/'},
 ...sample.catalog,
]);
/** Real facts are narrowly scoped. A minimum OBS requirement is not an endorsement of OBS 33.
 * This record establishes only failure below the declared minimum for the matching plugin release. */
export const records=/** @type {import('../core/types').CompatibilityRecord[]} */([
 {id:'obs-websocket-builtin-v5',componentId:'obs-websocket',componentName:'obs-websocket',vendor:'OBS Project',componentType:'Runtime',
  platform:['windows','macos','linux'],architecture:['universal'],host:'OBS Studio',hostVersionRange:'>=28 <34',installationTypes:['builtin'],
  compatibilityStatus:'READY',notes:'The OBS Project documents obs-websocket v5 as bundled with OBS 28 and above. This checks the built-in module only, not an independently installed DLL or external v4 protocol client.',
  dependencies:[],knownIssues:['External clients must use the matching WebSocket protocol; client compatibility is not inferred.'],
  breakingChanges:[],sample:false,lastVerifiedAt:'2026-10-05',
  evidence:[{sourceType:'vendor',title:'OBS Project — obs-websocket included by default',url:'https://github.com/obsproject/obs-websocket/blob/master/README.md',
   checkedAt:'2026-10-05',quoteSummary:'The project README describes default inclusion starting with OBS 28. Separate binaries and legacy-protocol clients are outside this record.'}]},
 {id:'move-3.2.0-minimum-host',componentId:'move-transition',componentName:'Move Transition',vendor:'Exeldro',componentType:'Transition',
  platform:['windows','macos','linux'],architecture:['universal'],host:'OBS Studio',hostVersionRange:'>=28 <31.1',
  componentVersionRange:'=3.2.0',compatibilityStatus:'BLOCKED',notes:'Move 3.2.0 declares OBS 31.1 or higher as its minimum host. This installed release cannot run on the selected older target.',
  requiredAction:'Choose a host that meets the declared OBS 31.1 minimum, then verify target compatibility separately.',
  dependencies:[],knownIssues:[],breakingChanges:[],sample:false,hardBlocker:true,lastVerifiedAt:'2026-10-05',
  evidence:[{sourceType:'repository',title:'Move 3.2.0 release — minimum OBS 31.1',url:'https://github.com/exeldro/obs-move-transition/releases/tag/3.2.0',
   checkedAt:'2026-10-05',quoteSummary:'The maintainer release specifies a minimum of OBS 31.1; no untested upper compatibility bound is inferred.'}]},
 ...sample.records,
]);
export const sampleEnvironment=sample.environment;
