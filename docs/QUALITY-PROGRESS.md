# Quality overhaul — working evidence and remaining gates

Baseline: main `739c6e2866292b5e6b691d639a93e7faa1eb324a`. This branch is an ongoing overhaul, not a completed Flagship release. See QUALITY-AUDIT.md for all 38 intents and target maturity. No Pro/Flagship promotions have been made.

## Implemented so far

- Complete intent capability contracts, included in runtime/static reading content and structured data.
- Pinned, locally served, on-demand Pica 10.0.3; mks2013/Lanczos tile resampling, device-selected tile/concurrency, cancellation and smaller-tile retry. Resize/upscale use it; nearest-neighbor pixel scaling remains separate.
- Image input no longer rejects merely for 32 MiB; image batch input holds File references rather than enforcing an arbitrary 128 MiB combined cap. Decoded allocations can still exceed the browser's actual capacity. Full source and final canvases remain; tiled math does not imply tiled decoding or incremental PNG encoding.
- 1920px cached preview proxies. Common editor crop/rotate/resize/fill/trim commits store immutable operation records; arbitrary pixel results still use bounded PNG checkpoints. Undo replays from the immutable source. Incremental worker alpha-bounds scan uses row strips.
- Encoder probes and alpha-aware Auto PNG/JPEG/WebP/available-AVIF candidate search. Candidate output is decoded and evaluated with <=512px black/white composite SSIM. Explicit resolution reduction is opt-in. This is an approximate metric, not proof of readability or natural-photo parity.
- APNG/animated WebP/AVIF sequence guards; GIF input remains explicitly unsupported. Source metadata/profile retention is not promised.
- Chunked ZIP CRC (1 MiB slices), avoiding a whole-file ArrayBuffer. ZIP32 remains limited to <4 GiB/65536 entries. Output is still a Blob archive, not a streaming ZIP64 writer.
- Numeric crop, keyboard movement/resize, percentage/longest-side/megapixel size helpers, and a large-allocation decision dialog.
- Experimental licensed/pinned Swin2SR 2×/4× model path, worker tiles with 32px context, source alpha preservation, cancellation, cache and explicit fallback reporting. GPU adapter absence selects WASM; failed GPU initialization requires a fresh worker to avoid cached runtime failures.

## Executed evidence (Windows, AMD64 Family 25 Model 80, 16 logical CPUs)

`npm run benchmark` / `npm run benchmark:full` create machine-readable records in `test-results/quality`. Raw reports carry the actual browser and backend. Times below are individual runs, not repeated performance guarantees.

| Check | Observed result | Scope |
|---|---|---|
| Chromium 153, 4K → 8K gradient | Actual 7680×4320 PNG encoded and independently decoded; 15,619,908 bytes; ~1.12 s | Classical Pica, not ML |
| Chromium 153, real 132,753,178-byte PNG input | UI opened 7680×4320, resized/downloaded 3840×2160; Pillow checked pixels/dimensions; 27,343,672-byte output; ~3.10 s | Seeded noise, actual disk File |
| Tile size 512 vs 1024 | mks2013 and Lanczos outputs byte-equal on translucent illustration; alpha preserved | Deterministic fixture; not every filter/scale |
| Cancel + repeat lifecycle | Abort observed, timers continued, ten sequential resizes completed | JS heap samples only; browser/GPU peak UNVERIFIED |
| Auto compression | 71,793 → 33,594 bytes at 40 KiB target, proxy SSIM 0.99921, alpha retained | Opt-in shrink chose 266×200 PNG; synthetic illustration |
| Firefox 155 + WebKit 26.6 | Quick image quality/alpha/tiles/compression/undo checks passed | Desktop emulation; real mobile device UNVERIFIED |
| Swin2SR 2× NASA portrait | PSNR 34.61 dB, SSIM 0.97717 vs Lanczos 31.04 / 0.95846 | Transformers 3.7.2 initial experiment, WASM, ~137 s including setup |
| Swin2SR 4× NASA portrait | PSNR 28.63 dB, SSIM 0.92623 vs Lanczos 25.92 / 0.86374 | Same initial runtime, WASM, ~36.6 s |
| Compact Real-ESRGAN candidate | 2×: 27.28 dB / 0.92921; 4×: 23.13 / 0.83323 | Faster (~8.7 / 1.45 s) but worse than classical on this fixture; NOT selected as default |

Swin2SR has subsequently been moved to standalone ONNX Runtime 1.30.0. On 2026-09-21 the standalone path reproduced the initial results exactly on WebGPU (`BENCH_GPU=1 npm run benchmark:ai`, Chrome 151, NVIDIA Pascal): 2× PSNR 34.61 dB / SSIM 0.97717 in ~18.2 s, 4× 28.63 dB / 0.92623 in ~13.8 s, both including ~12 s one-time session creation, no fallback. A 96×96 WebGPU-vs-WASM tensor comparison differed by at most 2e-6 (≤0.01% of 8-bit values). Per 128px tile: WebGPU ~0.8 s (NVIDIA) / ~3.5 s (Edge, AMD integrated) vs WASM ~10 s single-threaded.

The earlier "WebGPU failed" result was a harness defect: Playwright's bundled Chromium lacks `dxil.dll`, so Dawn cannot create a D3D12 device (ORT surfaced only a numeric C++ exception). GPU benchmarks now default to an installed Chrome (`BENCH_CHANNEL` overrides), and workers translate numeric ORT exceptions into readable fallback reasons. Session creation cost (~12 s) is independent of graph optimization level. BiRefNet-lite matting also ran on WebGPU with the same landmark result as WASM (~15.9 s vs ~20.7 s end-to-end); matte IoU/edge quality remains unverified. This also avoids adding the Transformers Node-only Sharp dependency tree (npm audit reported two inherited high advisories when tested). Browser runtime bundles do not include Sharp; no claim of a browser exploit is made. The retained legacy portrait path still uses Transformers 3.7.2 pending replacement.

Multi-threaded WASM without isolating the site: cross-origin isolation (COOP/COEP) site-wide was deliberately avoided because it breaks AdSense and third-party embeds. Instead the SR/matte workers run inside a hidden same-origin `/ai-runtime/` iframe served with `Document-Isolation-Policy: isolate-and-credentialless` and its own strict CSP (`frame-ancestors 'self'`); `src/ai-host.js` falls back to a plain Worker when the frame does not report `crossOriginIsolated`. ORT uses `min(8, hardwareConcurrency-1)` threads when isolated, otherwise 1, and reports `threads`. Bitmaps cross the frame boundary as raw RGBA (see failures below). Measured 2026-09-21 (`python tools/benchmark.py --ai`, Playwright Chromium 153, WASM, 8 threads, no page errors): NASA portrait 2× PSNR 34.61 dB / SSIM 0.97717 in 43.1 s (vs ~137 s single-threaded), 4× 28.63 / 0.92623 in 20.6 s — identical metrics to the single-threaded and WebGPU runs. WebGPU still works inside the isolated frame (`BENCH_GPU=1`, Chrome 151, NVIDIA): 2× 34.61 / 0.97717 in 24.7 s, 4× 28.63 / 0.92623 in 19.1 s, no fallback (slower than the earlier 18.2 / 13.8 s direct-worker runs; single runs, RGBA transfer and frame start-up not separately profiled). BiRefNet matting landmarks (background 0, face 255, suit 255) held on WASM with 8 threads (Chromium 153, 17.8 s) and WebGPU (Chrome 151, 6.6 s). Firefox and WebKit ignore Document-Isolation-Policy and remain single-threaded; this was verified earlier and not re-run after the RGBA transfer change. Deployed Cloudflare headers and mobile Chrome are unverified.

## Failures found and fixed

- Development HTTP server joined a trailing-slash root with another separator on Windows, rejecting module files. Normalized the root.
- The split Transformers web bundle could not resolve bare `onnxruntime-common` in a static Worker. Initial test used the bundled runtime; newer SR implementation uses standalone ORT.
- A GPU API can exist while no adapter is available in headless Chromium. Adapter probing and explicit CPU fallback are required. WebGPU inference has since succeeded in installed Chrome/Edge (see above); it is not verified on mobile GPUs.
- Posting a canvas-sourced (GPU-backed) ImageBitmap into the out-of-process isolated AI frame crashed the whole page renderer in installed Chrome 151/Edge on a real GPU (`Target crashed`, before any worker progress; fresh or existing profile, with or without GPU flags, persistent or not). Playwright's bundled Chromium uses a software canvas and did not crash, which hid it. An ImageData-sourced bitmap crossed safely. Bitmaps now cross that boundary as transferable RGBA in both directions (rebuilt with `premultiplyAlpha:'none'` to avoid a second alpha round trip); worker hops inside the frame still transfer bitmaps.
- A stale 10 s fallback timer removed the AI runtime frame after it had reported ready, killing its worker during session creation. The frame now settles exactly once.
- Firefox's initial PNG round-trip changed some translucent byte values. Undo equivalence now compares replay to the same decoded source file, not to an unencoded Canvas. No tolerance was added to hide a graph error.

## Required next gates

Image: standalone SR quality/alpha/seams, actual 8K ML (not yet run), efficient backend, natural photo/text/anime/low-light/transparent fixtures, general subject background model and edge ground truth, real compression comparisons, all recipe/pixel pipelines, bounded source/output lifetime, actual browser/GPU peak measurement, ten-repeat resource audit, precise error recovery.

PDF: lazy hundreds-page loading, native annotations, preserve/raster compression split, actual text/search/vector fidelity, 300-page fixtures.

Media: replace recorder primary path with ranged Blob demux/WebCodecs/mux, codecs/container probing, streaming disk targets, real trim/audio preservation, 500 MiB/30 min/1 h fixtures, incremental GIF/audio paths.

Full current-source regression re-run on 2026-09-21 after the capability gate (Chromium 153, `python tools/regression.py`): syntax, 935 Node tests, build (236 entry pages), existing browser 62, recipe 43, growth 24, SEO 402 — all passed. Quick image (`npm run benchmark`), PDF (`--pdf`) and media (`benchmark:media`) browser runs also completed with no page errors. This does not cover AI/matte, `--full` 8K, Firefox/WebKit or large-media runs, which must be re-run separately.

Mobile viewports on physical devices, dependency/license documentation, claim cleanup and production deployment remain separate gates.
