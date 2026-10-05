// @ts-check
import {makeSample} from './sample.js';
const sample=makeSample('blender');
export const catalog=/** @type {import('../core/types').CatalogEntry[]} */([
 {id:'node-wrangler',name:'Node Wrangler',vendor:'Blender',category:'Add-on',aliases:[],vendorUrl:'https://extensions.blender.org/'},
 {id:'rigify',name:'Rigify',vendor:'Blender',category:'Add-on',aliases:[],vendorUrl:'https://extensions.blender.org/'},
 {id:'looptools',name:'LoopTools',vendor:'Blender community',category:'Extension',aliases:['Loop Tools'],vendorUrl:'https://extensions.blender.org/'},
 {id:'hardops',name:'Hard Ops',vendor:'Hard Ops team',category:'Add-on',aliases:['HardOps'],vendorUrl:'https://hopsdocs.com/'},
 {id:'boxcutter',name:'Boxcutter',vendor:'Boxcutter team',category:'Add-on',aliases:['Box Cutter'],vendorUrl:'https://boxcutter-manual.readthedocs.io/'},
 {id:'mmd-tools',name:'MMD Tools',vendor:'MMD community',category:'Add-on',aliases:['mmd_tools'],vendorUrl:'https://github.com/MMD-Blender/blender_mmd_tools'},
 {id:'vrm-addon',name:'VRM Add-on',vendor:'VRM Consortium',category:'Export Tool',aliases:['VRM'],vendorUrl:'https://github.com/saturday06/VRM-Addon-for-Blender'},
 {id:'blenderkit',name:'BlenderKit',vendor:'BlenderKit',category:'Asset Library',aliases:[],vendorUrl:'https://www.blenderkit.com/'},
 {id:'luxcore',name:'LuxCoreRender',vendor:'LuxCore',category:'Render Engine',aliases:['LuxCore'],vendorUrl:'https://luxcorerender.org/'},
 {id:'octane',name:'OctaneRender',vendor:'OTOY',category:'Render Engine',aliases:['Octane'],vendorUrl:'https://home.otoy.com/'},
 {id:'gscatter',name:'GScatter',vendor:'Graswald',category:'Geometry Node Pack',aliases:[],vendorUrl:'https://www.graswald3d.com/'},
 {id:'send-to-unreal',name:'Send to Unreal',vendor:'Epic Games',category:'Pipeline Tool',aliases:['Send2UE'],vendorUrl:'https://github.com/EpicGamesExt/BlenderTools'},
 {id:'godot-exporter',name:'Godot Blender Exporter',vendor:'Godot community',category:'Export Tool',aliases:[],vendorUrl:'https://github.com/godotengine/godot-blender-exporter'},
 {id:'substance',name:'Substance 3D Blender tools',vendor:'Adobe',category:'Pipeline Tool',aliases:['Substance'],vendorUrl:'https://www.adobe.com/products/substance3d.html'},
 ...sample.catalog,
]);
export const records=sample.records;
export const sampleEnvironment=sample.environment;
