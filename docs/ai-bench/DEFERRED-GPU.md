# Deferred: background removal and AI upscale on real AI images (stopped 2026-10-11)

Owner decision 2026-10-11: GPU / AI-model work (background removal, AI upscale) is deferred to a later phase.
Nothing in `src/` is changed by this work: `src/matting.js`, `src/matte-worker.js`, `src/super-resolution.js`,
`src/sr-worker.js`, `src/ai-models.js`, `src/onnx-engine.js` and `src/task/remove-bg.js` are byte-identical to
`origin/main`. The unfinished engine code is parked in `docs/ai-bench/deferred/` (not built, not shipped) so it can
be resumed. Everything below is measured, but **only offline (Python ONNX Runtime / Node), not yet in the shipped
browser path**, except where a browser run is named.

## 1. Test set (AI-300, outside git)

`C:\Users\2009s\nerulio-asset-corpus\ai-300` — 381 openly licensed AI outputs, `manifest.json` per file (source URL,
licence, sha256, kind, use, truth method), scripts in `docs/ai-bench/corpus/`:

| source | n | licence |
|---|---:|---|
| DiffusionDB 2M (SD 1.x, 512 px), prompt-stratified (sticker, white background, anime, ghibli, product, pixel art, fur, wallpaper, green screen) | 164 | CC0-1.0 |
| Wikimedia Commons AI categories (ChatGPT/GPT Image, Gemini/Nano Banana, Midjourney, SD/SDXL, Flux, DALL-E, icons, characters, portraits, pixel art) | 127 | public domain (PD-algorithm) |
| DALL-E 3 1M captions dataset (1024 px class) | 30 | MIT (dataset) |
| ToonOut test split (AI anime characters with **human alpha**) | 58 | CC-BY-4.0 |
| OpenGameArt AI pixel art (SD+ControlNet, Gemini Flash 2, GPT-4 image, Nano Banana 2) | 22 | CC0-1.0 |

20 files were excluded after a visual screen (charts, real-person likenesses, etc.; reasons in `manifest.json`).

**Background-removal truth (106 cases):** 58 ToonOut human mattes; 12 AI outputs published as transparent PNGs
(truth = their alpha, input = composite on white); 12 flat-backdrop AI outputs with known-backdrop matting
(`build_truth.py`, ambiguous shadows/holes marked ignore; 16 candidates rejected on a review sheet,
`_src/reject-truth.json`); 24 "scene" composites of those cut-outs over AI-generated backdrops.

## 2. Background removal — measured (offline ONNX Runtime, same ONNX files, bilinear upsampling unless noted)

`docs/ai-bench/matte/score_matte.py`; IoU at alpha 0.5, MAE x100, edge = alpha error in the boundary band,
halo = luminance left 1–6 px outside the subject on black (white-sheet glow).

| model (licence, download) | all IoU | anime IoU | sheet IoU | scene IoU | all MAE | sheet halo | IoU < 0.9 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Nerulio today** BiRefNet-lite @512 (MIT, 192 MB) | 0.9300 | 0.9551 | 0.8966 | 0.9028 | 3.55 | 9.49 | 16/106 |
| BiRefNet-lite @1024 fp16 (MIT, 115 MB) | 0.9220 | 0.9620 | 0.8603 | 0.8870 | 4.47 | 0.79 | 22 |
| **BEN2 base fp16** (MIT, 219 MB) | **0.9625** | **0.9735** | 0.9465 | **0.9521** | **1.73** | 1.41 | 13 |
| BEN2 + flat-backdrop edges + hole fill (`deferred/matte-refine.js`, `sheetBF48`) | **0.9669** | **0.9758** | **0.9599** | 0.9521 | **1.54** | **0.24** | 9 |
| rembg birefnet-general-lite (MIT) | 0.9228 | 0.9623 | 0.8629 | 0.8874 | 4.40 | 0.66 | 21 |
| withoutbg open weights (Apache-2.0) | 0.9380 | 0.9614 | 0.8817 | 0.9377 | 3.20 | 1.12 | 18 |
| rembg isnet-general-use | 0.8731 | 0.9001 | 0.8159 | 0.8651 | 6.20 | 2.54 | 40 |
| rembg isnet-anime | 0.7796 | 0.9302 | 0.6214 | 0.5740 | 10.4 | 7.42 | 35 |
| rembg u2net | 0.8593 | 0.8685 | 0.8644 | 0.8319 | 5.34 | 21.3 | 36 |
| @imgly/background-removal-node 1.4.5 (AGPL, reference only) | 0.8836 | 0.9015 | 0.8386 | 0.8854 | 5.79 | 2.73 | 40 |

Not run: rembg birefnet-general / birefnet-portrait (973 MB; DirectML session crashed), ToonOut weights (BiRefNet full,
needs CUDA torch). Colour clean-up (blur-fusion / known-backdrop un-mixing) did **not** improve the re-composite
metric yet; the guided filter helped the 512 model's IoU slightly but raised halo — neither is ready.

**Browser blocker (measured in Chrome, RTX 3080 Ti):** ONNX Runtime Web **1.30.0** (what `src/onnx-engine.js` pins)
fails BEN2 fp16 on WebGPU ("Invalid ShaderModule LayerNorm"); **1.29.0 and 1.27.0 run it: ~380 ms per 1024² run
after an 8.4 s first run** (shader compile). BEN2 on WASM (8 threads) took ~31 s per image. BiRefNet-lite @1024
(onnx-community fp16 and fp32) fails on WebGPU in every ORT version tried ("Too many storage buffers in shader:
17 > 16"). The current 512 model: 2.1 s per run on WebGPU after warm-up (probe_models.py).

**Next steps:** (1) per-model ORT version (`deferred/onnx-engine.js` adds `ort(version)`), BEN2 as the WebGPU default,
BiRefNet-lite-512 kept for WASM-only/low-memory devices; (2) wire `deferred/matte-refine.js` (flat-backdrop edges +
hole fill only; guided filter off for 1024 models) into the worker (`deferred/matte-worker.js` is a working draft);
(3) full browser run of all 106 cases with `deferred/run_browser.py` (host page must allow framing /ai-runtime/);
(4) halo/colour metric on 1:1 crops and a blind visual pass; (5) memory test on a phone before BEN2 ships.

## 3. AI upscale — measured (offline ONNX Runtime; 138 AI images, centre crop ≤ 1024 px reduced 4x with bicubic, then 4x)

`docs/ai-bench/upscale/score_sr.py`: PSNR / SSIM on luma, LPIPS-alex (lower = closer perceptually).
The bicubic-reduction protocol favours bicubic-trained models in PSNR (Swin2SR) — treat LPIPS as the main number.

| engine | all PSNR | all SSIM | **all LPIPS** | ill LPIPS | photo LPIPS | text LPIPS | size |
|---|---:|---:|---:|---:|---:|---:|---:|
| Lanczos | 29.31 | 0.841 | 0.313 | 0.340 | 0.280 | 0.297 | — |
| **Nerulio today** realesr-general-x4v3 (BSD-3) | 28.47 | 0.854 | 0.221 | 0.204 | 0.223 | 0.136 | 4.8 MB |
| realesr-general-**wdn**-x4v3 (BSD-3, same architecture) | **29.10** | 0.848 | **0.183** | **0.174** | **0.182** | 0.127 | 4.8 MB |
| general-x4v3 DNI 0.5 (Real-ESRGAN CLI default mix) | 28.73 | 0.850 | 0.202 | 0.190 | 0.203 | 0.128 | 4.8 MB |
| RealESRGAN_x4plus (BSD-3) | 29.02 | 0.850 | 0.183 | 0.175 | 0.183 | **0.117** | 64 MB |
| RealESRGAN_x4plus_anime_6B | 27.69 | 0.833 | 0.223 | 0.196 | 0.238 | 0.128 | 18 MB |
| realesr-animevideov3 | 29.21 | 0.849 | 0.250 | 0.241 | 0.244 | 0.189 | 2.4 MB |
| Upscayl 2.15 standard-4x (upscayl-bin, Vulkan) | 28.95 | 0.849 | 0.184 | 0.175 | 0.185 | 0.117 | — |
| Upscayl high-fidelity-4x | 29.38 | 0.855 | 0.187 | 0.184 | 0.183 | 0.158 | — |
| Upscayl digital-art-4x | 27.67 | 0.832 | 0.225 | 0.197 | 0.239 | 0.129 | — |
| Swin2SR x4 (Nerulio's `engine:'quality'` default) | (31.08) | (0.863) | (0.204) | 0.173 | 0.208 | 0.102 | 54 MB |

Swin2SR: some tiles failed under DirectML (paint class 24.6 dB) — rerun on CPU before trusting. waifu2x swin_unet:
my tiling wrapper produced misaligned output (LPIPS ≈ 1.0) — **invalid, rerun**. The no-reference run on original
1024 px outputs (`sr-work/nr`, 24 crops) was stopped before scoring; no browser timing was taken.

**Next steps:** (1) switch the "AI" upscale model to realesr-general-wdn-x4v3 (same 4.8 MB SRVGG; self-host the ONNX
exported by `upscale/export_realesrgan.py` — verified bit-identical export of the shipped x4v3); it ties Upscayl's
default on LPIPS at 1/13 the size of x4plus; (2) confirm on the no-reference set + side-by-side crops that wdn does not
over-smooth clean 1024 px AI art; (3) reconsider `superResolve`'s default `engine:'quality'` (Swin2SR, 54 MB) vs the
4.8 MB Real-ESRGAN; (4) browser timing 1024² → 4096² on WebGPU/WASM with larger tiles.

## 4. How to resume

Work files outside git: `C:\Users\2009s\nerulio-handoff\scratch\aic-bench` (venvs: `venv` = onnxruntime-directml,
`venv-wbg` = withoutbg, `venv-gen` = CUDA torch + diffusers; `models/`, `sr-models/`, `competitors/` (Upscayl 2.15,
waifu2x ONNX), `matte-out/`, `sr-work/`). Re-run: `corpus/*.py` → `matte/run_models.py` → `matte/prep_raw.py` +
`matte/refine_bench.mjs` → `matte/score_matte.py` + `matte/table.py`; `upscale/prep_sr.py` → `upscale/run_sr.py` →
`upscale/score_sr.py`. To put the parked engine back: copy `deferred/matte-refine.js`, `deferred/matte-worker.js`,
`deferred/ai-models.js`, `deferred/onnx-engine.js` into `src/` and `deferred/matte-refine.test.mjs` into `tests/`
(fix the import path), then change `remove-bg.js`'s `modelCached({...AI_MODELS.matte,file:...})` to
`modelCached(AI_MODELS.matte)`.
