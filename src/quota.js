/** Single source of truth for Free/Pro metering, shared by the browser and the API Worker.
 * Dependency-free on purpose: the Worker bundles this file without the UI modules.
 * Every INTENTS id must appear here exactly once (tests/service.test.mjs enforces it).
 * 'none'  – never consumes quota and never calls the API (crop, rotate, simple convert…).
 * 'heavy' – one Free daily job per completed run request (AI, compression, media export…).
 * Output quality is identical for Free and Pro; only the daily count differs.
 */
export const QUOTA_CLASSES=Object.freeze({
 // Game-asset recipes: palette/grid/crop helpers are light; full pipelines and batch packs are heavy.
 refiner:'heavy','sprite-slicer':'none','frame-normalize':'none','sprite-sheet-maker':'none','palette-swap':'none',
 'marketplace-pack':'heavy','print-pack':'heavy','logo-bg':'none','bitmap-font':'none','mask-packer':'none',
 // Texture Lab and its routes are local pixel work: no metering.
 'texture-lab':'none','channel-unpacker':'none','normal-map-converter':'none','pbr-texture-validator':'none','texture-edge-bleed':'none',
 'pixel-lab':'none','palette-extractor':'none','palette-swap-ramp':'none','pixel-art-cleanup':'none','pixel-perfect-checker':'none',
 'atlas-padding':'none','texture-map':'heavy','tile-helper':'none','scan-split':'none','margin-crop':'none','favicon-pack':'none',
 // Sprite Lab and its stage entries: geometry, records and one atlas page at a time — no API, no metering.
 'sprite-lab':'none','sprite-animation-preview':'none','sprite-pivot-editor':'none','hitbox-editor':'none','collision-polygon-generator':'none',
 // Tile Lab: grid measurement, slicing and rule checks are local region copies, never metered.
 'tile-lab':'none','tileset-slicer':'none','autotile-tester':'none','seamless-tile-checker':'none',
 // UI Lab: nine-slice draws, state variants, glyph measurement and layout previews are all
 // small canvas work on one asset at a time, so none of them meter.
 'ui-lab':'none','9-slice-editor':'none','button-state-generator':'none','missing-glyph-checker':'none','ui-scale-preview':'none',
 // Image
 home:'none',image:'none',upscale:'heavy','remove-bg':'heavy',compress:'heavy',convert:'none',heic:'none',crop:'none',resize:'none',pixel:'none',
 // PDF: page editing, merge, split and rasterization stay free of quota; compression is heavy.
 pdf:'none','pdf-merge':'none','pdf-split':'none','pdf-compress':'heavy','jpg-to-pdf':'none','pdf-to-jpg':'none','pdf-protect':'none','pdf-unlock':'none',
 // Media: every encoded export is heavy; a single still frame is not.
 media:'heavy','video-trim':'heavy','video-frame':'none','video-mp3':'heavy','video-gif':'heavy','video-compress':'heavy'
});
/** Studio actions (/game/studio/). A separate table because the Studio is not a landing
 * intent. 'studio' = one Free daily *Studio export* (its own counter, FREE_DAILY_STUDIO_EXPORTS);
 * 'none' = never counted and never calls the API. Rule: an engine export bundle (a ZIP with
 * atlas/tileset/maps + engine data) counts once, whatever its size; everything that edits,
 * previews, saves or writes a single image is light. Every metered call site in src/studio
 * uses an id from this table (tests/studio-monetization.test.mjs enforces it). */
export const STUDIO_ACTIONS=Object.freeze({
 // metered: engine export bundles
 'studio-pack-export':'studio',      // Pack & Export: atlas pages + engine data (Godot/Unity/Phaser/Pixi/Defold/LÖVE/Spine/Aseprite…)
 'studio-tile-export':'studio',      // Tile: tileset ZIP (Godot/Tiled/Unity/LDtk + sample map + collision)
 'studio-texture-export':'studio',   // Texture: map set ZIP (normal/height/AO/roughness… per engine convention)
 // light: never counted
 'studio-import':'none','studio-open-project':'none','studio-save-project':'none','studio-autosave':'none',
 'studio-edit':'none','studio-undo':'none','studio-preview':'none','studio-pack-preview':'none',
 'studio-grid-detect':'none','studio-tile-identify':'none','studio-texture-generate':'none',
 'studio-aseprite-export':'none',     // one .aseprite file of the user's own frames = saving work
 'studio-texture-quick-png':'none',   // one normal-map PNG
 'studio-texture-channel-pack':'none' // one packed PNG
});
export const QUOTA_CLASS_NAMES=Object.freeze(['none','heavy','studio']);
export const HEAVY_TOOLS=Object.freeze(Object.keys(QUOTA_CLASSES).filter(id=>QUOTA_CLASSES[id]==='heavy'));
export const STUDIO_METERED=Object.freeze(Object.keys(STUDIO_ACTIONS).filter(id=>STUDIO_ACTIONS[id]==='studio'));
/** The one place the product defaults live. Operators override them with FREE_DAILY_JOBS
 * and FREE_DAILY_STUDIO_EXPORTS (see docs/PRICING-MODEL.md for the reasoning). */
export const DEFAULT_FREE_DAILY_JOBS=30;
export const DEFAULT_FREE_DAILY_STUDIO_EXPORTS=10;
export const quotaClass=id=>typeof id!=='string'?null:Object.hasOwn(QUOTA_CLASSES,id)?QUOTA_CLASSES[id]:Object.hasOwn(STUDIO_ACTIONS,id)?STUDIO_ACTIONS[id]:null;
export const isHeavy=id=>quotaClass(id)==='heavy';
/** True for classes that consume a daily count ('heavy' tools, 'studio' exports). */
export const isMetered=id=>['heavy','studio'].includes(quotaClass(id));
/** Tool id to authorize for a concrete run, or '' when the run is not metered.
 * Solid-colour background removal is a flood fill, not the AI matting the class targets. */
export function meteredTool(id,options={}){
 if(id==='remove-bg'&&(!options.background||options.background==='solid'))return '';
 return isMetered(id)?id:'';
}
/** Editor exports that are not tied to a landing intent map onto the equivalent tool. */
export function mediaExportTool(format){return format==='gif'?'video-gif':['mp3','wav'].includes(format)?'video-mp3':'video-compress';}
/** Quota days are UTC calendar days: one global reset instant, no timezone ambiguity. */
export function quotaDay(now=Date.now()){return new Date(now).toISOString().slice(0,10);}
export function nextReset(now=Date.now()){const d=new Date(now);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1);}
const limitOr=(value,fallback)=>{const n=Number(value);return value!==undefined&&value!==null&&value!==''&&Number.isInteger(n)&&n>=1&&n<=10000?n:fallback;};
export const freeDailyLimit=value=>limitOr(value,DEFAULT_FREE_DAILY_JOBS);
export const freeStudioLimit=value=>limitOr(value,DEFAULT_FREE_DAILY_STUDIO_EXPORTS);
/** Studio engine exports allowed per day WITHOUT an account (FREE_ANON_STUDIO_EXPORTS, default 3).
 * After that a free Google sign-in unlocks the rest of FREE_DAILY_STUDIO_EXPORTS. 0 means
 * "sign in for every engine export"; the value never exceeds the signed-in limit. */
export const DEFAULT_FREE_ANON_STUDIO_EXPORTS=3;
export function freeAnonStudioLimit(value,signedIn=DEFAULT_FREE_DAILY_STUDIO_EXPORTS){
 const n=Number(value);
 const v=value!==undefined&&value!==null&&value!==''&&Number.isInteger(n)&&n>=0&&n<=10000?n:DEFAULT_FREE_ANON_STUDIO_EXPORTS;
 return Math.min(v,signedIn);
}
/** Daily counters are separate per class: the D1 subject of a Studio export is suffixed so
 * the file tools' heavy jobs and the Studio's exports never eat each other's allowance. */
export const STUDIO_SUBJECT_SUFFIX='#studio';
export const counterSubject=(subject,cls)=>cls==='studio'?subject+STUDIO_SUBJECT_SUFFIX:subject;
