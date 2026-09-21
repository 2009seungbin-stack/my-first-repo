import {INTENTS} from './intents.js';

/** Evidence, not a marketing score. Targets live in QUALITY-AUDIT.md, never here. */
export const MATURITY = Object.freeze(['prototype','basic','advanced','pro','flagship']);
const engines = {
 home:'local browser dispatch', image:'Canvas / immutable transforms / proxy preview', upscale:'Pica / nearest; optional experimental tiled Swin2SR',
 'remove-bg':'border flood fill / BiRefNet general foreground (experimental)', compress:'browser codecs / proxy SSIM candidate search',
 convert:'browser image codecs', heic:'browser / heic2any', crop:'Canvas region copy', resize:'Pica tiled mks2013 / Lanczos',
 pixel:'Oklab palette / locked colors / serpentine FS / Bayer dither', pdf:'PDF worker / ranged PDF.js / native annotations',
 'pdf-merge':'PDF worker / native page objects', 'pdf-split':'PDF worker / ranges, groups, odd-even', 'pdf-compress':'selective embedded JPEG optimization / optional raster mode',
 'jpg-to-pdf':'pdf-lib image embedding', 'pdf-to-jpg':'PDF.js rasterizer',
 media:'Mediabunny / WebCodecs / OPFS', 'video-trim':'keyframe remux / WebCodecs precise re-encode', 'video-frame':'WebCodecs source-resolution frame / video fallback',
 'video-mp3':'ranged demux / WebCodecs / LAME WASM', 'video-gif':'WebCodecs sequential frames / gifenc adaptive palettes', 'video-compress':'WebCodecs bitrate, resolution and frame-rate control',
 refiner:'Oklab palette / locked colors / serpentine FS / Bayer dither', 'sprite-slicer':'streaming run-length alpha components',
 'frame-normalize':'alpha bounds and alignment', 'sprite-sheet-maker':'uniform grid packing',
 'palette-swap':'tiled RGB tolerance / luma offset', 'marketplace-pack':'Pica tiled fit / JPEG',
 'print-pack':'Pica tiled fit / JPEG', 'logo-bg':'border flood fill', 'bitmap-font':'fixed grid BMFont',
 'mask-packer':'sequential row-transfer channel packing / incremental PNG', 'atlas-padding':'nine-blit nearest edge extrusion',
 'texture-map':'overlapped tiles / luminance height gradient', 'tile-helper':'exact grid region copy',
 'scan-split':'vertical region copy', 'margin-crop':'white threshold bounds', 'favicon-pack':'raster PNG / ICO',
 'tile-lab':'folded transition-profile period scoring / exact region copy / autotile rule tables / alpha collision shapes',
 'tileset-slicer':'margin and spacing grid region copy / FNV tile hashing / run-merged collision rectangles',
 'autotile-tester':'8-neighbour mask tables (3×3 minimal, 16 Wang, 47 blob) / nearest-neighbour render',
 'seamless-tile-checker':'wrap-edge channel difference against an in-tile baseline / half offset + cross blend'
};
/** Advanced is earned, never assigned. A tool qualifies only when its recorded evidence shows:
 * workflow — the real workflow produced output that was independently decoded or measured;
 * quality  — at least one objective output property beyond "a file was produced";
 * engines  — those checks passed in both Chromium and Firefox on the current source.
 * Each entry names the suite and the exact check so it can be re-run (docs/QUALITY-GATES.md). */
export const ADVANCED_CRITERIA=Object.freeze({kinds:['workflow','quality'],engines:['chromium','firefox']});
// Recorded 2026-09-21 from `python tools/benchmark.py --browser chromium|firefox [--pdf]`
// (Chromium 153 / Firefox 155, test-results/quality/<engine>-quick.json and -pdf.json).
// Only checks that passed in BOTH engines and that exercise the named tool are listed.
// Not listed on purpose: crop, pdf-merge, jpg-to-pdf, pdf-to-jpg (no tool-specific check yet);
// media (Firefox failed "duration-based target strategy produces measured near-target output",
// so its later checks never ran there); AI upscale/background (gates in QUALITY-GATES.md).
const IMG='tests/quality-browser.mjs',PDF='tests/pdf-browser.mjs',BOTH=Object.freeze(['chromium','firefox']);
const ev=(kind,suite,check)=>Object.freeze({kind,suite,check,engines:BOTH});
const EVIDENCE={
 image:[ev('workflow',IMG,'operation history replays without re-encoding source'),ev('quality',IMG,'overlapped outline tiles equal whole-image reference')],
 resize:[ev('workflow',IMG,'mks2013: tile-grid-independent output'),ev('quality',IMG,'lanczos3: opaque/transparent and partial alpha')],
 compress:[ev('workflow',IMG,'NASA portrait: decoded full-resolution quality and target'),ev('quality',IMG,'compression quality on illustration fixture'),ev('quality',IMG,'already-compressed source candidate avoids unnecessary growth')],
 convert:[ev('workflow',IMG,'encoder MIME matches selected format'),ev('quality',IMG,'transparent logo: decoded full-resolution quality and target'),ev('quality',IMG,'compression preserves alpha-aware choice')],
 'atlas-padding':[ev('workflow',IMG,'direct atlas blits match reference padding and coordinates'),ev('quality',IMG,'single-pixel atlas 1x1 preserves edge padding')],
 pdf:[ev('workflow',PDF,'rotation and crop preserved'),ev('quality',PDF,'native pen is at normalized source position'),ev('quality',PDF,'page 320 searchable text')],
 'pdf-split':[ev('workflow',PDF,'custom split groups preserve counts'),ev('quality',PDF,'page 1 searchable text')],
 'pdf-compress':[ev('workflow',PDF,'image optimization reduces actual PDF bytes'),ev('quality',PDF,'image object actually recompressed'),ev('quality',PDF,'page 320 searchable text')]
};
export function qualifies(evidence=[]){
 const kinds=new Set(evidence.map(e=>e.kind)),engines=new Set(evidence.flatMap(e=>e.engines));
 return ADVANCED_CRITERIA.kinds.every(k=>kinds.has(k))&&ADVANCED_CRITERIA.engines.every(k=>engines.has(k))&&evidence.every(e=>e.suite&&e.check&&e.engines?.length);
}
export const CAPABILITIES = Object.freeze(Object.fromEntries(Object.entries(INTENTS).map(([id,intent])=>{
 const pdf=intent.editor==='pdf',media=intent.editor==='media',recipe=intent.action==='recipe';
 const modern=['image','upscale','crop','resize','compress','convert','heic'].includes(id);
 return [id,Object.freeze({
  maturity:qualifies(EVIDENCE[id])?'advanced':'basic', seoPromotable:qualifies(EVIDENCE[id]), qualification:qualifies(EVIDENCE[id])?'advanced-evidence':'in-progress', evidence:Object.freeze(EVIDENCE[id]||[]),
  engine:engines[id], maxInput:media?{bytes:null,seconds:null,policy:'ranged Blob reads; demux and codec support'}:pdf?{bytes:null,pages:null,policy:'full writer parse in Worker; ranged reader; device memory'}:modern?{bytes:null,pixels:null,policy:'browser decode/allocation; tested limits are evidence, not universal guarantees'}:{bytes:null,pixels:null},
  maxOutput:media?{seconds:null,policy:'codec, temporary storage and container limits; compatibility recorder only, up to 10 minutes'}:pdf?{pages:null,policy:'writer memory; pages rendered sequentially only in raster modes'}:{pixels:null,bytes:recipe?4294967296:null,frames:recipe?4096:null,policy:'actual canvas allocation and operation resource plan'},
  supportedFormats:pdf?['pdf','png','jpeg']:media?['mp4 (detected)','webm','gif','png','mp3','wav']:['png','jpeg','webp','avif (detected)'],
  preservesAlpha:pdf?'PDF native objects retained in preserve mode':media?'not promised for video; frame PNG depends on decoded source':'PNG/WebP/AVIF when codec supports alpha; JPEG and explicit fill flatten', preservesMetadata:false, lossless:'PNG and native page-copy do not add codec loss; resampling, compression and rasterization are mode-dependent',
  ai:id==='upscale'?'optional experimental Swin2SR (2x / 4x); explicit classical fallback':id==='remove-bg'?'optional experimental BiRefNet (people and objects)':false, hardwareAcceleration:'browser dependent',
  streaming:media?'ranged input; OPFS output (video and GIF) when supported':pdf?'ranged preview reader; writer still parses whole document':false,tiled:['upscale','resize','compress','pixel','refiner','marketplace-pack','print-pack','palette-swap','texture-map','mask-packer','atlas-padding'].includes(id),verifiedBrowsers:pdf?['Chromium 153 / Firefox 155 / WebKit 26.6 synthetic PDF suite']:media?['Chromium 153; Firefox 155 synthetic suite / decoded H.264 after metadata repair']:modern?['Chromium 153','Firefox 155 quick image suite','WebKit 26.6 quick image suite']:[],qualityEvidence:[...new Set([...(pdf?['tests/pdf-browser.mjs']:media?['tests/media-browser.mjs']:modern?['tests/quality-browser.mjs']:[]),...(EVIDENCE[id]||[]).map(e=>e.suite)])],
  limitations:pdf?['Full writer parse; forms flatten; signatures not retained.','Preserve compression only optimizes compatible RGB JPEG image objects.','Aggressive raster mode loses native text, search and vectors.']:media?['Codec support is browser-dependent. Fast cut shrinks to keyframes; precise cut re-encodes.','Compatibility recorder (no WebCodecs) records in real time for up to 10 minutes; compatibility audio decodes sources up to 20 minutes in memory.','Synthetic benchmarks do not establish arbitrary codec/HDR/multitrack fidelity.']:['8-bit browser color; metadata/profile retention not guaranteed.','AI flagship and broad natural-image quality acceptance remain incomplete.']
 })];
})));
export function capabilitySummary(id,locale='en') {
 const c=CAPABILITIES[id];
 const title={en:'Implementation and verified quality',ko:'처리 방식과 검증 수준',ja:'処理方式と検証状況'}[locale];
 const note={en:'Quality qualification is in progress. Pro/Flagship quality has not been established.',ko:'품질 검증을 진행 중입니다. Pro·Flagship 수준은 아직 입증되지 않았습니다.',ja:'品質検証中です。Pro・Flagship水準はまだ実証されていません。'}[locale];
 return {title,text:`${c.maturity} · ${c.engine}. ${note}`};
}

export const mayPromote=id=>id==='home'||!!CAPABILITIES[id]?.seoPromotable&&MATURITY.indexOf(CAPABILITIES[id].maturity)>=2&&qualifies(CAPABILITIES[id].evidence);
