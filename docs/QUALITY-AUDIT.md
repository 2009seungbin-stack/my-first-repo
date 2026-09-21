# Quality audit — baseline, before implementation

Audited main: `739c6e2866292b5e6b691d639a93e7faa1eb324a` (fetched 2026-09-21).
All 38 canonical intents and their shared editor actions are covered below. Aliases resolve to these implementations. This is a code audit, NOT measured output quality. No existing feature earns Pro or Flagship from the existing tests. Existing functional tests remain required.

## Shared architecture

Read the image, PDF, media, core and both workers; app and experience state/dispatch; recipe primitives, recipe worker, registry, toolkit, intent defaults; localization/content/SEO, dependency policy, build/serve/check and regression harness. The static build copies ES modules without bundling. Optional PDF/HEIC/portrait/MP3 engines are remote on-demand; model revisions are not pinned. CI exercises Chromium over HTTP but excludes real external engine success paths. Most tests assert routing, dimensions, format or exact small primitives. There is no perceptual or peak-memory benchmark command.

Image limits I: 32 MiB/file, 128 MiB/session, 24 inputs, 8192/side AND 16 million pixels. Recipe limits R: I plus 4 million analysis pixels, 256 frames. PDF limits P: 32 MiB/file, 128 MiB total, 100 pages. Media limits M: 128 MiB/file, 600 s input, 120 s output, 4K decode; audio 64 MiB source; GIF 320 px/8 fps/8 s.

The active full canvas, worker clone, working arrays and output coexist. Quantization additionally allocates float RGBA for the entire image even without dithering. Every committed edit PNG-encodes and stores a compressed snapshot; preview redraws the full source. Blob references are not necessarily copies, but worker structured clones, typed arrays and PDF ArrayBuffer.slice definitely are. Video input uses a Blob URL (good); audio instead decodes the entire file to PCM. ZIP computes CRC after reading each complete Blob. Cancellation is mostly worker termination or per-page checks, with incomplete model/PDF page cleanup. Static hosting and local user-file processing must remain.

## Intent audit

Columns: current implementation/algorithm; current limits; expected meaning and major quality gap; needed architecture; benchmark plan; current → target maturity. Targets are acceptance goals, not release labels.

| Tool / intent | Implementation / algorithm | Limits | Expected meaning; weakness / quality gap | Architecture change | Benchmark plan | Maturity |
|---|---|---|---|---|---|---|
| home | Shared entry and file dispatch | I/P/M | Reliable routing; advertises unequal engines | Capability-driven claims | All intent/claim contracts | basic → advanced |
| image | Destructive canvas editor and PNG snapshots | I | High-resolution edits; freezes/copies/re-encodes | Proxy, operation history, worker/tile engine | 8K transform + undo + alpha + 10 repeats | basic → pro |
| upscale | Canvas high smoothing / nearest 2×/4× | I output | Recover usable detail; interpolation only | Licensed tiled ML SR plus quality classical fallback | Photo/anime/text/UI/pixel/alpha PSNR/SSIM + visual | basic → flagship |
| remove-bg | Border RGB flood fill / MODNet portrait WASM | I; portrait 4MP | General subjects, hair/fur; binary edges or human-only | Licensed general matte model, high-res guided refinement | IoU and edge alpha against known masks + natural subjects | basic → flagship |
| compress | Selected Canvas codec; binary quality search, optional 0.8 resize | I | Best useful quality at requested bytes; no quality scoring | Codec detection, perceptual candidate search, sequential batch | Photo/text/UI/alpha SSIM, dimensions, target error | basic → flagship |
| convert | Canvas PNG/JPEG/WebP encoding | I | Correct format, alpha/orientation; animation silently at risk | Inspect containers, verify MIME/magic, profile disclosure | Independent decode + alpha/orientation/animation | basic → pro |
| heic | heic2any fallback decode → Canvas JPEG | I | Reliable orientation/format; whole decode, remote dependency | Isolated decode and explicit collection/profile handling | Licensed HEIC orientation/multi-image fixtures | basic → pro |
| crop | Normalized rectangle Canvas crop | I | Exact crop; no numeric/keyboard positioning | Numeric source coordinates, proxy-only interaction | Pixel-exact rotated crop, keyboard, 8K export | basic → pro |
| resize | Canvas smoothing, aspect lock | I | Quality size change; no perceptual resampler | Worker tiled resampling, fit/fill/percentage/MP targets | Bandlimited reference, ringing, alpha and seam tests | basic → pro |
| pixel | Canvas fit + median cut RGB + Floyd–Steinberg | I; native 8–512 | Game-ready silhouette/palette; binary alpha, RGB distance | Perceptual palette and locked palette, row error buffers | Palette error/count, native dimensions, silhouette/alpha | basic → flagship |
| pdf | pdf-lib page objects, PDF.js preview, Canvas marks | P | Page editor/annotations; marks rasterized | Lazy pages/thumbnails, native marks, separate modes | Text/vector/page/mark preservation and 300 pages | basic → pro |
| pdf-merge | pdf-lib copyPages; eager page metadata | P | Preserve content on large merge | Lazy preview and per-source lifecycle | 300 pages, extracted text, render fidelity | basic → pro |
| pdf-split | Range selection into one PDF | P | Actual splitting workflows absent | Group/range/every-N/odd-even export queue | Group/page/text order and 300 pages | basic → pro |
| pdf-compress | Entire page JPEG rasterization option | P; raster 1440px | Smaller PDF with searchable text; no true image optimization | Preserve structure mode + explicit raster mode | Size, text/search/vector preservation by mode | prototype → flagship |
| jpg-to-pdf | Images embedded in new PDF pages | I/P | Full-quality pages; aspect/orientation/copy budget | Sequential embed and page sizing | Alpha/aspect/orientation and independent PDF render | basic → pro |
| pdf-to-jpg | PDF.js render then Canvas encode | P; 1600px | Legible full-res pages; fixed low resolution | DPI controls, sequential render/write | Text legibility, exact DPI, 300-page export | basic → pro |
| media | HTML video preview + canvas/MediaRecorder | M | Practical editor; playback-speed processing | Blob range demux + WebCodecs/mux + disk target | Container/decode/timestamps/audio/large file | prototype → pro |
| video-trim | Real-time re-recording | M | Fast/precise cut; keyframes/timestamps uncontrolled | Sample remux and precise conversion modes | Start/end error, duration, audio, long source | prototype → flagship |
| video-frame | Seek + Canvas, 1920px longest side | M | Source-resolution frame; forced reduction | Demux decode frame at source resolution | 4K/8K dimensions and timestamp pixel compare | basic → pro |
| video-mp3 | Whole AudioContext decode → lamejs 128 kbps | M; 64MiB/120s | Long audio extraction and quality options | Incremental demux/decode/encode/write | Duration, bitrate, sample rate, audio signal | basic → pro |
| video-gif | Seek all frames; fixed 3-3-2 palette + naive LZW | M; 320/8fps/8s | Useful motion/colors; poor compression and huge frame retention | Incremental encoder, learned palette, dither controls | Decoded frame count/timing, palette error, memory | prototype → pro |
| video-compress | Fixed formula bitrate MediaRecorder WebM | M | Size/quality controls and MP4; no target strategy | Codec-probed WebCodecs, bitrate budget, sequential mux | Reduction/target error/duration/audio/4K | prototype → flagship |
| refiner | Trim/fit + RGB median cut, FS, outline; repeat pack | R | Game-ready multires sprites; no perceptual palette locking | Shared pixel engine + target-specific layout | Character/icon/prop silhouette, 16/32/64/128 goldens | basic → flagship |
| sprite-slicer | 8-connected alpha components with editable boxes | R | Correct candidate frames; not semantic separation | Tiled/row component analysis; retain manual review | Detached parts, touching pieces, exact bounds | basic → pro |
| frame-normalize | Alpha bounding boxes, align/canvas pad | R | Stable anchors; only bounds-based | Streaming bounds + one-frame-at-time export | Anchor/center/bottom and transparent frames | basic → pro |
| sprite-sheet-maker | Equal grid placement PNG + JSON | R; 16MP output | Correct engine-import coordinates; limited pack | Sequential blits, validated coordinate manifest | Crop-back pixel equality + padded edges | basic → pro |
| palette-swap | RGB tolerance + optional luma offset | R | Predictable recolor; hue/perception mismatch | Perceptual matching, alpha-safe tiled apply | Locked colors, alpha equality, shade error | basic → pro |
| marketplace-pack | Canvas contain/cover, fixed JPEG .92 | R | Sharp correctly sized product photos | Shared quality resampler/encoder, sequential outputs | Independent dimensions, crop and SSIM | basic → pro |
| print-pack | Five aspect ratios, Canvas JPEG | R; longest 4096 | Useful print-ratio pixels; no color/DPI assurance | Quality resampler, output reporting | Ratio rounding, resolution, detailed text/photo | basic → pro |
| logo-bg | Border-connected RGB threshold, binary alpha | R | Clean logo edge; halos and lost translucent edge | Soft matte / decontamination distinct from AI | Analytic antialiased logo masks, halo color error | basic → pro |
| bitmap-font | Fixed-grid glyph coordinates, FNT + JSON | R | Valid usable atlas metadata; no kerning/variable advance | Validate target import; optional trimmed metrics | Unicode IDs, crop equality, baseline/advance | basic → pro |
| mask-packer | Full four RGBA buffers, byte-luma packing; custom PNG | R | Exact channels incl RGB under alpha zero | Tiled channels + lossless encoder, explicit color space | Independent inflate, all channel values, large input | basic → pro |
| atlas-padding | Per-pixel nearest edge extrusion, new JSON | R | Bleed-free exact padding; grid-only | Tile writes, preserve coordinate contract | All borders/corners, crop-back identity | basic → pro |
| texture-map | Luma-as-height central gradient | R | Height-derived normals; not PBR reconstruction | Overlapped tiles, explicit height assumption | Analytic flat/ramp/norm length/seam goldens | basic → pro |
| tile-helper | Exact regular grid PNG split | R; 256 frames | Useful split with exact pixels | Sequential region encode/write | Tile recomposition exact equality | basic → pro |
| scan-split | User-selected vertical divider | R | Two scan halves; no deskew/auto gutter | Region export, high-res support | Recomposition and left/right order | basic → advanced |
| margin-crop | White threshold → full RGBA mask → bounds | R | Trim paper; pale content can be lost | Row/tile bounds without mask allocation | Known bounds + pale content warning + 8K | basic → pro |
| favicon-pack | Canvas scales, PNG-in-ICO, HTML/manifest snippets | R | Crisp small icons; generic resampling | Size-specific quality resampler, retain raster contract | ICO independent decode, small-edge goldens | basic → pro |

## Editor actions without separate intent

| Action | Current algorithm / limits / gap | Architecture / benchmark | Current → target |
|---|---|---|---|
| Rotate / flip | Canvas copy, I; re-encode edit | Operation record; inverse pixel equality at 8K | basic → pro |
| Transparent trim | Full RGBA read, I; main-thread scan | Row scan in worker; exact alpha bounds incl empty | basic → pro |
| Outline | Full RGBA square dilation, I; alpha threshold | Overlap tiles; edge/corner/alpha golden | basic → pro |
| Background fill | Full Canvas composite, I | Single pass export; alpha composite reference | basic → pro |
| Batch export / game pack | Sequential decode, blobs retained; CRC full read, 128MiB | Incremental CRC/ZIP writer and bounded output queue; independent unzip | basic → pro |
| PDF reorder / rotate / duplicate | Logical page objects, P; all metadata eager | Lazy page access; text/render/page order and undo | basic → pro |
| PDF text / pen / highlight / rectangle / image | Canvas raster overlay (2048px) embedded in PDF | Native PDF text/path/rectangle/image; text search/vector inspection | basic → pro |
| WAV export | Entire decoded PCM and WAV buffer | Sequential PCM chunks + RIFF size accounting; signal/duration | basic → pro |
| WebM export | MediaRecorder only | Codec-probed WebCodecs with documented recorder fallback | prototype → pro |

## Gates and evidence policy

1. Capability contract covers every intent; metadata never labels unmeasured work Pro. UI/static content include its limitations. Model weights require a separately verified commercial license and pinned revision.
2. Benchmarks generate deterministic fixtures, decode actual output and record environment, dimensions, bytes, backend, elapsed time, objective error and resource estimates. Synthetic images cannot establish natural-photo or hair/fur quality. Memory estimates are explicitly not measurements of browser/GPU peak.
3. Upgrade image allocation/worker/resampling first; validate 4K→8K plus alpha, tile seams, cancellation and 10 repetitions before broadening. Keep reference algorithms for comparisons, not as evidence of AI quality.
4. Audit and implementation records distinguish unit, integration, browser, visual, quality, performance and large-file tests. Baseline tests are regression guards only. Every phase has pass/fail/unverified evidence.
5. PDF and media remain below Pro until their separate large-document, real codec and output-quality gates execute. No claim of competitor parity from synthetic tests or published feature lists.

## Initial comparison sources (research, not measured competitor outputs)

- Pica: tiled mks2013/Lanczos resizing, worker/WASM execution and alpha processing (MIT), https://github.com/nodeca/pica . Baseline has only browser smoothing. Compare native smoothing and deterministic reference images.
- Mediabunny: BlobSource demux, conversion/remux, MP4/WebM mux and stream targets, https://mediabunny.dev/guide/quick-start . Baseline records playback. Version/license and exact cancellation/stream semantics must be verified before adoption.
- AI/background natural-image competitor comparisons, commercial weight licenses and objective output parity: UNVERIFIED. Do not promote based on marketing comparisons.
