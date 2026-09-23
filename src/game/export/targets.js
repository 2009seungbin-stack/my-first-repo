/** Export targets of the Studio's Pack & Export stage: what each one writes, the pack settings its
 * engine needs (`requires`, enforced at export) and the defaults its preset applies (`preset`), and
 * how it was verified. The status strings are claims the docs back with a run
 * (docs/STUDIO-PACK.md): 'verified' means loaded AND drawn by that engine in tools/engine-verify
 * on real corpus assets; 'parsed' means built/parsed by the real tool without drawing; 'unverified'
 * means no engine run exists here and the UI says so. */
import {godotFiles} from './godot.js';
import {unityFiles} from './unity.js';
import {phaserFiles,pixiFiles,asepriteJsonFiles,genericJson} from './atlas-json.js';
import {gamemakerFiles,defoldFiles,loveFiles,spineFiles,starlingFiles,cssFiles} from './engines.js';
export const TARGETS=Object.freeze({
 godot4:{group:'engine',label:'Godot 4',verify:'verified',engine:'Godot 4.7.2',build:godotFiles,
  requires:{allowRotation:false},preset:{allowRotation:false,trimMode:'trim',shapePadding:2,extrude:0,sizeMode:'auto',maxWidth:4096,maxHeight:4096}},
 unity:{group:'engine',label:'Unity 6',verify:'verified',engine:'Unity 6000.5.3f1',build:unityFiles,
  requires:{allowRotation:false},preset:{allowRotation:false,trimMode:'trim',shapePadding:2,extrude:0,sizeMode:'auto',maxWidth:4096,maxHeight:4096}},
 phaser:{group:'engine',label:'Phaser 3 / 4',verify:'verified',engine:'Phaser 3.90 + 4.2',build:phaserFiles,
  // Phaser 3.90 and 4.2 draw a rotated frame mirrored, not rotated (Frame.updateUVsInverted swaps
  // only u, measured in tools/engine-verify), so the Phaser preset never rotates — as TexturePacker's.
  requires:{allowRotation:false},preset:{allowRotation:false,trimMode:'trim',shapePadding:2,extrude:0,sizeMode:'auto',maxWidth:4096,maxHeight:4096,multipack:true}},
 pixi:{group:'engine',label:'PixiJS 8',verify:'verified',engine:'PixiJS 8.21',build:pixiFiles,
  requires:{},preset:{allowRotation:true,trimMode:'trim',shapePadding:2,extrude:0,sizeMode:'auto',maxWidth:4096,maxHeight:4096,multipack:true}},
 gamemaker:{group:'engine',label:'GameMaker',verify:'unverified',engine:'GameMaker (strip import)',build:gamemakerFiles,frames:true,
  requires:{},preset:{}},
 defold:{group:'engine',label:'Defold',verify:'parsed',engine:'Defold bob.jar 1.13.1',build:defoldFiles,frames:true,root:'defold',
  requires:{},preset:{}},
 love:{group:'engine',label:'LÖVE',verify:'verified',engine:'LÖVE 11.5',build:loveFiles,
  requires:{allowRotation:false},preset:{allowRotation:false,trimMode:'trim',shapePadding:2,extrude:1,sizeMode:'auto'}},
 'aseprite-json':{group:'data',label:'Aseprite JSON (hash)',verify:'verified',engine:'Phaser 3.90 + 4.2, PixiJS 8.21',build:(m,v,o)=>asepriteJsonFiles(m,v,{...o,layout:'hash'}),
  requires:{allowRotation:false,multipack:false},preset:{allowRotation:false,multipack:false,trimMode:'trim'}},
 'aseprite-json-array':{group:'data',label:'Aseprite JSON (array)',verify:'verified',engine:'Phaser 3.90 + 4.2, PixiJS 8.21',build:(m,v,o)=>asepriteJsonFiles(m,v,{...o,layout:'array'}),
  requires:{allowRotation:false,multipack:false},preset:{allowRotation:false,multipack:false,trimMode:'trim'}},
 aseprite:{group:'data',label:'.aseprite file',verify:'verified',engine:'Aseprite 1.3 CLI',aseprite:true,requires:{},preset:{}},
 spine:{group:'data',label:'Spine / libGDX atlas',verify:'unverified',engine:'—',build:spineFiles,
  requires:{},preset:{allowRotation:false,trimMode:'trim',shapePadding:2}},
 starling:{group:'data',label:'Starling / Sparrow XML',verify:'verified',engine:'Phaser 4.2 (Phaser 3 needs trim off)',build:starlingFiles,
  requires:{allowRotation:false},preset:{allowRotation:false,trimMode:'trim',shapePadding:2}},
 'sparrow-phaser3':{group:'data',label:'Sparrow XML (Phaser 3)',verify:'verified',engine:'Phaser 3.90 + 4.2',build:starlingFiles,
  requires:{allowRotation:false,trimMode:'none'},preset:{allowRotation:false,trimMode:'none',shapePadding:2}},
 css:{group:'data',label:'CSS sprites',verify:'unverified',engine:'browsers',build:cssFiles,
  requires:{allowRotation:false},preset:{allowRotation:false,trimMode:'none',shapePadding:2}},
 json:{group:'data',label:'Generic JSON',verify:'verified',engine:'Phaser 3.90 + 4.2, PixiJS 8.21 (as a TexturePacker hash)',build:(m,v,o)=>genericJson(m,v,o),
  requires:{},preset:{}},
 gif:{group:'anim',label:'Animated GIF',verify:'decoded',engine:'Pillow',anim:'gif',requires:{},preset:{}},
 apng:{group:'anim',label:'APNG',verify:'decoded',engine:'Pillow',anim:'apng',requires:{},preset:{}},
 webm:{group:'anim',label:'WebM video',verify:'decoded',engine:'Chromium',anim:'webm',browserOnly:true,requires:{},preset:{}}
});
export const TARGET_IDS=Object.freeze(Object.keys(TARGETS));
/** Settings an export will actually pack with, and what had to change for this target. */
export function settingsFor(target,settings){
 const t=TARGETS[target];if(!t)throw Error(`Unknown export target ${target}`);
 const changed=[];const out={...settings};
 for(const [k,v] of Object.entries(t.requires||{}))if(out[k]!==v){changed.push({key:k,from:out[k],to:v});out[k]=v;}
 return {settings:out,changed};
}
