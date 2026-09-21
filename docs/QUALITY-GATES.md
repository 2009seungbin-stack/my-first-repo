# Remaining quality gates

This branch contains substantive engine replacements, not completion of the full 70-point mission. No tool is labeled Pro or Flagship. The pre-change audit covers all 38 public intents in QUALITY-AUDIT.md; machine-readable current contracts are in src/capabilities.js.

## Not yet accepted

- AI SR: actual 8K ML export, tile-seam/alpha goldens across photo/anime/text/pixel fixtures, efficient fallback. WebGPU inference now succeeds on desktop Chrome/Edge with WASM-identical output; mobile GPUs are unverified. The WASM fallback is single-threaded because the site is not cross-origin isolated; enabling COOP/COEP is an ads/embedding compatibility decision, not yet made. Swin2SR WASM timings remain too slow for a Flagship claim.
- Background: independently annotated ground-truth masks for hair, fur, products, dark/white objects and transparent edges; high-resolution subject fidelity. Full-resolution alpha output is not high-resolution model inference.
- Compression: browser AVIF is conditional, no dedicated AVIF/MozJPEG/PNG optimizer yet; proxy metrics can miss fine artifacts. Large full-resolution codec benchmarking and competitor output parity remain open.
- Pixel/game: artist-authored character/icon/tile/prop golden outputs and palette consistency across animations. Modern mask packing and atlas extrusion remove the 4MP analysis bottleneck; the legacy no-CompressionStream mask fallback retains it. recipe output archives retain 128MiB and 256-frame safeguards. These are explicitly incomplete architectural migrations.
- PDF: full-document writer parsing remains. Preserve mode only recompresses safe DeviceRGB 8-bit DCT images without masks/Decode overrides; arbitrary ICC/CMYK/JPX/JBIG2 are retained. Forms flatten, signatures are not retained, and existing text editing/OCR/redaction are not implemented. CJK text extraction is tested; broad visual font/glyph fidelity remains open.
- Media: precise encoding depends on native codecs. WebKit 26.6 test environment cannot encode the requested video formats in the worker. Firefox H.264 originally emitted duplicated SPS/PPS NAL headers in encoder metadata. A narrowly matched avcC repair removes the warnings in the executed FFmpeg full-decode/60-frame test; broad interoperability remains a release gate. HDR/VFR/multiple-audio tracks, GPU device loss, quota recovery, >2GB actual input and hour-long *re-encoding* remain unverified.
- GIF uses sequential RGBA frames but retains encoded chunks in memory. PDF/ZIP/image output still materialize Blobs; streaming direct-to-user-file targets and ZIP64 remain open. OPFS output exists for modern media.
- Ten-repeat lifecycle checks cover classical resize, PDF copy and media remux. AI session/GPU memory leak acceptance is unverified. Browser RSS is a sampled sum, not exact GPU/peak allocation accounting.
- Physical Android/iOS and deployed Cloudflare CSP/model-delivery tests have not been run for this branch.

## Release boundaries

Do not promote these experimental engines as Flagship or claim every public tool has been upgraded to Pro. Do not infer broad support from a header, test count, one photograph or one browser. Production deployment is a separate gate after the remaining critical regressions and compatibility decisions are resolved.

The benchmark scripts preserve failed runs as logs. A supported fallback and an unsupported primary path must be reported separately. Existing workflows remain available; unsupported codecs must never become an incorrectly labeled file.

The capability gate excludes tools below Advanced from featured recommendations and SEO sitemaps, and marks their existing pages noindex,follow. All routes and catalog workflows remain accessible. The home and policy pages remain indexable. These are branch changes, not a change to the currently deployed site. Promotion requires capability evidence and an explicit maturity upgrade.
