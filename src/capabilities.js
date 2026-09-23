import {INTENTS} from './intents.js';
import {GAME_INTENT_PAGES,WORKSPACES} from './game-seo.js';

/** Evidence, not a marketing score. Targets live in QUALITY-AUDIT.md, never here. */
export const MATURITY = Object.freeze(['prototype','basic','advanced','pro','flagship']);
const engines = {
 home:'local browser dispatch', image:'Canvas / immutable transforms / proxy preview', upscale:'Pica / nearest; optional experimental tiled Swin2SR',
 'remove-bg':'border flood fill / BiRefNet general foreground (experimental)', compress:'browser codecs / proxy SSIM candidate search',
 convert:'browser image codecs', heic:'browser / heic2any', crop:'Canvas region copy', resize:'Pica tiled mks2013 / Lanczos',
 pixel:'Oklab palette / locked colors / serpentine FS / Bayer dither', pdf:'PDF worker / ranged PDF.js / native annotations',
 'pdf-merge':'PDF worker / native page objects', 'pdf-split':'PDF worker / ranges, groups, odd-even', 'pdf-compress':'placement-aware image resampling / reference-resolved recompression / TrueType glyph trimming / object dedupe / optional raster mode',
 'jpg-to-pdf':'pdf-lib image embedding', 'pdf-to-jpg':'PDF.js rasterizer',
 'pdf-protect':'WebCrypto AES-256 standard security handler (revision 6)', 'pdf-unlock':'byte-level object rewriter / AES-256, AES-128 and RC4 standard security handlers',
 media:'Mediabunny / WebCodecs / OPFS', 'video-trim':'keyframe remux / WebCodecs precise re-encode', 'video-frame':'WebCodecs source-resolution frame / video fallback',
 'video-mp3':'ranged demux / WebCodecs / LAME WASM', 'video-gif':'WebCodecs sequential frames / gifenc adaptive palettes / measured size targets', 'video-compress':'WebCodecs bitrate and resolution control with measured size targets',
 refiner:'Oklab palette / locked colors / serpentine FS / Bayer dither',
 'sprite-slicer':'streaming run-length alpha components / box merge / margin-and-gutter grid / border colour key',
 'sprite-lab':'alpha components with an evidence-scored merge distance / ranked grid suggestions / integer-only normalize and jitter fix / lattice contour tracing / MaxRects multi-page packing / generic, Godot 4 and (unverified) Unity exporters',
 'sprite-pivot-editor':'normalised and pixel pivots carried through every integer frame shift',
 'sprite-animation-preview':'playbackOrder/playbackTimes stepping / Savitzky-Golay residual jitter series',
 'collision-polygon-generator':'pixel-lattice contour tracing / Ramer-Douglas-Peucker with a self-intersection guard / convex hull, rect and exact bounding circle fallbacks',
 'hitbox-editor':'per-frame box records over a playback step range',
 'frame-normalize':'streaming alpha bounds and common-canvas alignment', 'sprite-sheet-maker':'uniform grid packing',
 'palette-swap':'tiled RGB tolerance / luma offset', 'marketplace-pack':'Pica tiled fit / JPEG',
 'print-pack':'Pica tiled fit / JPEG', 'logo-bg':'border flood fill', 'bitmap-font':'fixed grid BMFont',
 'mask-packer':'sequential row-transfer channel packing / incremental PNG', 'atlas-padding':'nine-blit nearest edge extrusion',
 'texture-lab':'raw PNG channel reader / Sobel-Scharr normals / RNM combine / WebGL2 preview',
 'channel-unpacker':'raw PNG decode / exact channel planes / greyscale PNG writer',
 'normal-map-converter':'green-channel mirror (byte reversible)',
 'pbr-texture-validator':'filename classification / pixel measurements / workflow rules',
 'texture-edge-bleed':'iterative nearest-opaque RGB dilation (alpha untouched)',
 'texture-map':'overlapped tiles / luminance height gradient', 'tile-helper':'exact grid region copy',
 'scan-split':'vertical region copy', 'margin-crop':'white threshold bounds', 'favicon-pack':'raster PNG / ICO',
 'pixel-lab':'shared Oklab histogram / locked palette indices / ordered and error-diffusion dithers / indexed recolour',
 'palette-extractor':'shared alpha-weighted histogram / Oklab median cut + Lloyd / .gpl, HEX and JSON round trip',
 'palette-swap-ramp':'OkLCh ramp position mapping / hue-window replace / index-preserving variants',
 'pixel-art-cleanup':'connected components on palette indices / Oklab segment anti-alias snap / outline run measurement',
 'pixel-perfect-checker':'colour-change residues for integer block grids / run lengths / Oklab edge interpolation count',
 'tile-lab':'folded transition-profile period scoring / exact region copy / autotile rule tables / alpha collision shapes',
 'tileset-slicer':'margin and spacing grid region copy / FNV tile hashing / run-merged collision rectangles',
 'autotile-tester':'8-neighbour mask tables (3×3 minimal, 16 Wang, 47 blob) / nearest-neighbour render',
 'seamless-tile-checker':'wrap-edge channel difference against an in-tile baseline / half offset + cross blend',
 'ui-lab':'nine-slice draw plan / parametric state ops / measured glyph metrics / exact EDT signed distance field',
 '9-slice-editor':'repeated-line border suggestion / nine-slice draw plan (stretch and tile)',
 'button-state-generator':'brightness, contrast, saturation, overlay, offset and square outline ops / MaxRects strip',
 'missing-glyph-checker':'BMFont .fnt parser / per-character occurrence counts',
 'ui-scale-preview':'Godot-style anchor arithmetic / canvas text measurement / WCAG contrast formula'
};
/** Advanced is earned, never assigned. A tool qualifies only when its recorded evidence shows:
 * workflow — the real workflow produced output that was independently decoded or measured;
 * quality  — at least one objective output property beyond "a file was produced";
 * engines  — those checks passed in both Chromium and Firefox on the current source.
 * Each entry names the suite and the exact check so it can be re-run (docs/QUALITY-GATES.md). */
export const ADVANCED_CRITERIA=Object.freeze({kinds:['workflow','quality'],engines:['chromium','firefox']});
// Recorded 2026-09-21 from `python tools/benchmark.py --browser chromium|firefox [--pdf|--media]`
// (Chromium 153 / Firefox 155, test-results/quality/<engine>-quick.json, -pdf.json, -media.json),
// with outputs re-decoded by tools/media-quality.py and ffprobe/Pillow in the runner.
// Only checks that passed in BOTH engines and that exercise the named tool are listed.
// Not listed on purpose: crop, pdf-merge, jpg-to-pdf, pdf-to-jpg (no tool-specific check yet);
// AI upscale/background (gates in QUALITY-GATES.md).
// The media suite now completes in Firefox: its size targets are reached by measuring the
// encoded bytes of each pass, not by predicting them from the duration.
const IMG='tests/quality-browser.mjs',PDF='tests/pdf-browser.mjs',MEDIA='tests/media-browser.mjs',BOTH=Object.freeze(['chromium','firefox']);
const ev=(kind,suite,check)=>Object.freeze({kind,suite,check,engines:BOTH});
// Game routes the Studio now does (src/game-seo.js GAME_INTENT_PAGES). Recorded 2026-09-23:
// tests/game-landing-browser.py opens each landing page in Chromium 153 AND Firefox 155, hands a
// committed CC0 fixture to the Studio through the page's own file picker, and measures the result
// (pixels against the source, bits against the layout's truth, exported data read back). Each tool
// also cites the real-engine run its exports passed; that run drove the Studio UI in Chromium only,
// so it carries engines:['chromium'] and never counts toward the Firefox requirement.
const GL='tests/game-landing-browser.py',gl=(kind,check)=>ev(kind,GL,check);
const engineRun=(check,suite,doc,verifiedIn)=>Object.freeze({kind:'engine',suite,check,doc,engines:Object.freeze(['chromium']),verifiedIn:Object.freeze(verifiedIn)});
const SPRITE_ENGINES=engineRun('Studio Pack & Export baseline: 49 engine runs on corpus assets, 47 PASS (the 2 FAIL are Phaser 3.90 drawing trimmed Starling XML wrongly)','tools/engine-verify/baseline.py','docs/STUDIO-PACK.md',['Godot 4.7.2','Unity 6000.5.3f1','Phaser 3.90','Phaser 4.2','PixiJS 8.21','LÖVE 11.5','Defold bob.jar 1.13.1','spine-canvas 4.2','Aseprite 1.3.18']);
const ASE_ROUNDTRIP=engineRun('.aseprite corpus: 231/231 re-written files open in Aseprite 1.3.18.6 with the same tags, durations and pixels','tests/studio-sprite-browser.py','docs/STUDIO-SPRITE.md',['Aseprite 1.3.18.6']);
const TILE_ENGINES=engineRun('tile corpus: Godot painter = Studio on every set (485/485 per blob set, 251/251 dual grid), Tiled readers, Unity RuleTile cells','tools/engine-verify/tile/run_all.py','docs/STUDIO-TILE.md',['Godot 4.7.2','Tiled 1.12.2','Unity 6000.5.3f1 + 2D Tilemap Extras 8.0.3','LDtk 1.5.3 schema']);
const STUDIO_EVIDENCE={
 'sprite-slicer':[gl('workflow','sprite-slicer: Apply cuts 60 frames of 48×48 in 10 row animations'),gl('quality','sprite-slicer: every cut frame equals its cell of the source sheet, pixel for pixel'),SPRITE_ENGINES],
 'sprite-lab':[gl('workflow','sprite-lab: the .aseprite file opens in the Sprite workspace with its 4 frames and its tags'),gl('quality','sprite-lab: frame 1 equals Aseprite\'s own render of the file, pixel for pixel'),ASE_ROUNDTRIP,SPRITE_ENGINES],
 'frame-normalize':[gl('workflow','frame-normalize: Align frames puts all 6 on one canvas size'),gl('quality','frame-normalize: aligned frames keep every source pixel (whole-pixel moves, nothing resampled)'),SPRITE_ENGINES],
 'sprite-animation-preview':[gl('workflow','sprite-animation-preview: Enter plays the animation (the current frame advances)'),gl('quality','sprite-animation-preview: each frame keeps the GIF delay as its duration and equals Pillow\'s decode of that frame'),SPRITE_ENGINES],
 'sprite-pivot-editor':[gl('workflow','sprite-pivot-editor: a click with the pivot tool puts the pivot on the pixel (24, 40) of that frame only'),gl('quality','sprite-pivot-editor: the pivot is exported (Aseprite JSON slice pivot 24, 40 on frame 1)'),SPRITE_ENGINES],
 'hitbox-editor':[gl('workflow','hitbox-editor: a drag with the box tool makes a 20×30 hit box snapped to pixels'),gl('quality','hitbox-editor: the box is exported with the drawn bounds (Aseprite JSON slice 10, 10, 20×30 on frame 1)'),SPRITE_ENGINES],
 'collision-polygon-generator':[gl('workflow','collision-polygon-generator: Auto from alpha makes a polygon of at most 8 vertices for the frame'),gl('quality','collision-polygon-generator: with 24 vertices the polygon stays inside the frame and covers at least 95% of its opaque pixels'),SPRITE_ENGINES],
 'sprite-sheet-maker':[gl('workflow','sprite-sheet-maker: frame files arrive as one animation and open straight in Pack & Export, packed on one page'),gl('quality','sprite-sheet-maker: the Phaser atlas gives back every source frame pixel for pixel'),SPRITE_ENGINES],
 'tile-lab':[gl('workflow','tile-lab: the sheet opens in the Tile workspace with a 64×64 grid suggestion naming GameMaker 47'),gl('quality','tile-lab: the GameMaker-47 layout gives all 47 tiles their bits and the check says Complete after measuring the art'),gl('quality','tile-lab: the Godot export holds the import script and a tileset of 47 tiles with terrain bits'),TILE_ENGINES],
 'autotile-tester':[gl('workflow','autotile-tester: a new test map is painted with the Godot rule'),gl('quality','autotile-tester: every painted cell gets a correct tile under the Godot rule (no hole, no substitute)'),TILE_ENGINES],
 'tileset-slicer':[gl('workflow','tileset-slicer: Use this grid gives 12×11 tiles of 16 px with spacing 1'),gl('quality','tileset-slicer: the first grid candidate for the Kenney tilemap is 16×16 with a 1 px gap'),TILE_ENGINES]
};
const EVIDENCE={
 image:[ev('workflow',IMG,'operation history replays without re-encoding source'),ev('quality',IMG,'overlapped outline tiles equal whole-image reference')],
 resize:[ev('workflow',IMG,'mks2013: tile-grid-independent output'),ev('quality',IMG,'lanczos3: opaque/transparent and partial alpha')],
 compress:[ev('workflow',IMG,'NASA portrait: decoded full-resolution quality and target'),ev('quality',IMG,'compression quality on illustration fixture'),ev('quality',IMG,'already-compressed source candidate avoids unnecessary growth')],
 convert:[ev('workflow',IMG,'encoder MIME matches selected format'),ev('quality',IMG,'transparent logo: decoded full-resolution quality and target'),ev('quality',IMG,'compression preserves alpha-aware choice')],
 'atlas-padding':[ev('workflow',IMG,'direct atlas blits match reference padding and coordinates'),ev('quality',IMG,'single-pixel atlas 1x1 preserves edge padding')],
 pdf:[ev('workflow',PDF,'rotation and crop preserved'),ev('quality',PDF,'native pen is at normalized source position'),ev('quality',PDF,'page 320 searchable text')],
 'pdf-split':[ev('workflow',PDF,'custom split groups preserve counts'),ev('quality',PDF,'page 1 searchable text')],
 'pdf-compress':[ev('workflow',PDF,'image optimization reduces actual PDF bytes'),ev('quality',PDF,'image object actually recompressed'),ev('quality',PDF,'page 320 searchable text')],
 media:[ev('workflow',MEDIA,'precise duration'),ev('quality',MEDIA,'measured target strategy produces near-target output')],
 'video-trim':[ev('workflow',MEDIA,'fast duration'),ev('quality',MEDIA,'fast preserves audio')],
 'video-compress':[ev('workflow',MEDIA,'compression actual size and resolution'),ev('quality',MEDIA,'measured target strategy produces near-target output')],
 'video-gif':[ev('workflow',MEDIA,'GIF exceeds legacy 320px'),ev('quality',MEDIA,'GIF size target is reached by measured passes'),ev('quality',MEDIA,'reversed, sped-up, square-cropped GIF keeps the planned frames')],
 'video-mp3':[ev('workflow',MEDIA,'mp3 duration'),ev('quality',MEDIA,'audio normalisation scales by the measured peak')],
 'video-frame':[ev('workflow',MEDIA,'actual 4K frame preserves source dimensions'),ev('quality',MEDIA,'frame format is honoured at source resolution')],
 ...STUDIO_EVIDENCE
};
export function qualifies(evidence=[]){
 const kinds=new Set(evidence.map(e=>e.kind)),engines=new Set(evidence.flatMap(e=>e.engines));
 return ADVANCED_CRITERIA.kinds.every(k=>kinds.has(k))&&ADVANCED_CRITERIA.engines.every(k=>engines.has(k))&&evidence.every(e=>e.suite&&e.check&&e.engines?.length);
}
// Studio-backed game routes: what actually runs, where it was checked, and the workspace's limits.
const STUDIO_ENGINE={sprite:'Studio Sprite workspace: measured grid (margin, spacing) or alpha islands, colour key, previewed import decisions; GIF/APNG/.aseprite decoders; timeline, pivots, boxes, alpha contour collision',pack:'Studio Pack & Export: MaxRects/Skyline/Guillotine, trim/alias/extrude/multipack, colour-exact PNG writer, engine exporters',tile:'Studio Tile workspace: seam-continuity layout identification, terrain bits, Godot 4 terrain matcher port, quarter-exact generator, Godot/Tiled/LDtk/Unity writers'};
const STUDIO_CAPABILITY=Object.fromEntries(Object.entries(GAME_INTENT_PAGES).map(([id,p])=>[id,{engine:STUDIO_ENGINE[p.ws],studio:Object.freeze({workspace:p.ws,route:'game/studio/?ws='+p.ws,docs:p.ws==='tile'?['docs/STUDIO-TILE.md']:['docs/STUDIO-SPRITE.md','docs/STUDIO-PACK.md','docs/STUDIO-PACK-H2H.md']}),verifiedBrowsers:['Chromium 153 and Firefox 155: landing page → Studio workflow on CC0 fixtures (tests/game-landing-browser.py)','Exports loaded in the engines themselves; the engine runs drove the Studio in Chromium'],limitations:WORKSPACES[p.ws].limits.en}]));
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
  streaming:media?'ranged input; OPFS output (video and GIF) when supported':pdf?'ranged preview reader; writer still parses whole document':false,tiled:['upscale','resize','compress','pixel','refiner','marketplace-pack','print-pack','palette-swap','texture-map','mask-packer','atlas-padding'].includes(id),verifiedBrowsers:pdf?['Chromium 153 / Firefox 155 / WebKit 26.6 synthetic PDF suite']:media?['Chromium 153 and Firefox 155 synthetic media suite, outputs re-decoded with FFprobe/Pillow']:modern?['Chromium 153','Firefox 155 quick image suite','WebKit 26.6 quick image suite']:[],qualityEvidence:[...new Set([...(pdf?['tests/pdf-browser.mjs']:media?['tests/media-browser.mjs']:modern?['tests/quality-browser.mjs']:[]),...(EVIDENCE[id]||[]).map(e=>e.suite)])],
  limitations:pdf?['Full writer parse; forms flatten; signatures not retained.','Preserve compression only optimizes compatible RGB JPEG image objects.','Aggressive raster mode loses native text, search and vectors.']:media?['Codec support is browser-dependent. Fast cut shrinks to keyframes; precise cut re-encodes.','Compatibility recorder (no WebCodecs) records in real time for up to 10 minutes; compatibility audio decodes sources up to 20 minutes in memory.','A size target is met by measuring each encode; it may lower the resolution, and if the browser encoder cannot go smaller the result is reported as not met instead of silently missing it.','Synthetic benchmarks do not establish arbitrary codec/HDR/multitrack fidelity.']:['8-bit browser color; metadata/profile retention not guaranteed.','AI flagship and broad natural-image quality acceptance remain incomplete.'],
  ...(STUDIO_CAPABILITY[id]||{})
 })];
})));
export function capabilitySummary(id,locale='en') {
 const c=CAPABILITIES[id];
 const title={en:'Implementation and verified quality',ko:'처리 방식과 검증 수준',ja:'処理方式と検証状況'}[locale];
 const note={en:'Quality qualification is in progress. Pro/Flagship quality has not been established.',ko:'품질 검증을 진행 중입니다. Pro·Flagship 수준은 아직 입증되지 않았습니다.',ja:'品質検証中です。Pro・Flagship水準はまだ実証されていません。'}[locale];
 return {title,text:`${c.maturity} · ${c.engine}. ${note}`};
}

export const mayPromote=id=>id==='home'||!!CAPABILITIES[id]?.seoPromotable&&MATURITY.indexOf(CAPABILITIES[id].maturity)>=2&&qualifies(CAPABILITIES[id].evidence);
