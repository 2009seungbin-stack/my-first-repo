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
 'pixel-lab':'none','palette-extractor':'none','palette-swap-ramp':'none','pixel-art-cleanup':'none','pixel-perfect-checker':'none',
 'atlas-padding':'none','texture-map':'heavy','tile-helper':'none','scan-split':'none','margin-crop':'none','favicon-pack':'none',
 // Image
 home:'none',image:'none',upscale:'heavy','remove-bg':'heavy',compress:'heavy',convert:'none',heic:'none',crop:'none',resize:'none',pixel:'none',
 // PDF: page editing, merge, split and rasterization stay free of quota; compression is heavy.
 pdf:'none','pdf-merge':'none','pdf-split':'none','pdf-compress':'heavy','jpg-to-pdf':'none','pdf-to-jpg':'none','pdf-protect':'none','pdf-unlock':'none',
 // Media: every encoded export is heavy; a single still frame is not.
 media:'heavy','video-trim':'heavy','video-frame':'none','video-mp3':'heavy','video-gif':'heavy','video-compress':'heavy'
});
export const QUOTA_CLASS_NAMES=Object.freeze(['none','heavy']);
export const HEAVY_TOOLS=Object.freeze(Object.keys(QUOTA_CLASSES).filter(id=>QUOTA_CLASSES[id]==='heavy'));
/** The one place the product default lives. Operators override it with FREE_DAILY_JOBS. */
export const DEFAULT_FREE_DAILY_JOBS=30;
export const quotaClass=id=>Object.hasOwn(QUOTA_CLASSES,id)?QUOTA_CLASSES[id]:null;
export const isHeavy=id=>quotaClass(id)==='heavy';
/** Tool id to authorize for a concrete run, or '' when the run is not metered.
 * Solid-colour background removal is a flood fill, not the AI matting the class targets. */
export function meteredTool(id,options={}){
 if(id==='remove-bg'&&(!options.background||options.background==='solid'))return '';
 return isHeavy(id)?id:'';
}
/** Editor exports that are not tied to a landing intent map onto the equivalent tool. */
export function mediaExportTool(format){return format==='gif'?'video-gif':['mp3','wav'].includes(format)?'video-mp3':'video-compress';}
/** Quota days are UTC calendar days: one global reset instant, no timezone ambiguity. */
export function quotaDay(now=Date.now()){return new Date(now).toISOString().slice(0,10);}
export function nextReset(now=Date.now()){const d=new Date(now);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1);}
export function freeDailyLimit(value){
 const n=Number(value);
 return value!==undefined&&value!==''&&Number.isInteger(n)&&n>=1&&n<=10000?n:DEFAULT_FREE_DAILY_JOBS;
}
