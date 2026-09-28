# Pixel Art Converter & Cleanup Pro — design for coordinator review

Status: **implementation in verification**, 2026-09-28, branch `nerulio/tool-t1-pixel` based on `origin/main` `cd1e69a`. The coordinator approved implementation after the design review. Measurements and remaining gaps are in `docs/PIXEL-CONVERTER-RESULTS.md`. Dedicated development port: 4701.

## 1. Product boundary and current baseline

This is one conversion workflow inside the existing Pixel workspace (`/game/studio/?ws=pixel`), reached from the existing `/game/fix-ai-pixel-art/` and related indexable task pages. A simple first screen asks for a file and a goal: **restore enlarged pixel art** or **turn a photo/drawing into pixel art**. Advanced controls expand below the result. The output opens as a new Studio sprite, leaving the source and its undo history intact. This avoids creating another editor beside the Pixel workspace or changing the existing `src/task/pixel.js` batch tool without a clear migration.

Code inspection at `cd1e69a` finds substantial shipped functionality:

| Capability | Current owner and evidence | T1 decision |
|---|---|---|
| Grid detection, offset and fractional scale, bilinear recovery, confidence | `src/game/pixel-snap.js`, `src/studio/pixel/cleanup.js`; measured in `docs/STUDIO-PIXEL.md` | Reuse; expose manual X/Y grid override only if benchmark failures justify it. |
| Frame-consistent cleanup, alignment, background/alpha, fringe, orphans, outline/shadow | `src/studio/pixel/cleanup.js`; `cleanup-ui.js` + `cleanup-worker.js` | Extend one pipeline; preserve conservative defaults, original and one-step undo. |
| Indexed sprite, Oklab nearest palette matching, Bayer dither, PNG-8, `.aseprite` | `src/studio/pixel/{indexed,png8,palette-io}.js`, Pixel workspace; real Aseprite round trip reported in `docs/STUDIO-PIXEL.md` | Reuse exporters and validators; do not write a second `.aseprite` codec. |
| `.gpl`, `.pal` (JASC/RIFF), `.ase` (Adobe swatch), `.hex`, `.act`, Lospec slug | `src/studio/pixel/palette-io.js`, consent UI | Reuse parser and consent; do not contact Lospec for local palettes. |
| GIF/APNG import, frames/tags/timing | Sprite workspace (`docs/STUDIO-SPRITE.md`) | Reuse import and timeline; prove frame composition and timing on real files. |
| RGB/PNG/ZIP simple converter | `src/task/pixel.js`, `pixel-lab.js`, `src/pixel-engine.js` | Keep existing routes; link to the Studio conversion flow where advanced cleanup is needed. |

The prior 69-case benchmark in `docs/STUDIO-PIXEL.md` reports 81% exact output size and 63.2% exact pixels at defaults, versus 25–30% size and 33.9–44.6% pixels for three cleanup competitors. These are **previous-session results**, not a T1 rerun or a parity verdict. Their default removes a background that some ground truths retain (background-kept variant 74.0% exact pixels). JPEG exact pixels were 4.5% at defaults, simulated generated art exact size 20%, and seven real generated examples had no 1× truth and were deliberately not auto-resized. `docs/pixel-bench/scores/perfectpixel.json` says 76 cases, so the frozen case list, denominator and script versions must be reconciled before reusing any score in product copy.

Demand rationale: `reports/Nerulio 방문자 성장 전략.md` §“새 기능 1순위…” prioritizes this area because the site already has the engine and the image-to-pixel-art / cleanup searches are adjacent. Traffic and keyword numbers in the report are third-party estimates; they are not acceptance criteria or copy-ready claims. The idea bank supports the same task cluster. No palette-specific landing is added without distinct worked examples and intent.

## 2. Competitor investigation and feature matrix

The existing project recorded real head-to-head runs on a CC0 Sumo Hulk sheet and a 69-case set: Sprite Fusion Pixel Snapper, unfake.js, perfectPixel and Aseprite (methods/results: `docs/pixel-bench/H2H.md`, `docs/STUDIO-PIXEL.md`). This session additionally opened Pixel Art Village in Chrome, loaded its built-in Sunrise example, set pixel size to 12 and applied its PICO-8 palette. At that point it displayed a 100×100 result derived from a 1200×1200 source; the live UI had General/Palette/Grid/Download views, brightness/contrast/saturation sliders, Lospec/PixilArt palette import and small/large downloads. This is a **workflow observation**, not an independently decoded output score. The other competitors' current offerings were checked against their primary product/project docs below; old measurements will be rerun with frozen versions before claims.

Legend: **E** existing Nerulio code; **P** planned; **D** competitor docs / previous measured task; **L** current live UI exercise; **?** not established. “Yes” does not mean equal output quality.

| Feature | Nerulio now | Pixel Snapper | Pixel Art Village | unfake.js | perfectPixel | Aseprite |
|---|---|---|---|---|---|---|
| Automatic 1× grid recovery, confidence | E, shows unsure and keeps source | D auto snap, no confidence observed | ? (photo pixel-size control) | D auto/manual scale | D FFT/Sobel auto/manual | D manual resize; no automatic recovery claim |
| Fractional/offset, smooth-resample repair | E; prior measured cases | D/previous run | ? | D grid snap | D refined grid | D manual |
| Photo → chosen pixel dimensions | E basic task tool, not unified Studio flow | ? | L pixel size, 1200→100 example | D content-aware downscale | ? | D manual resize |
| Nearest/median/mode/k-centroid cell sampling | E mode/Oklab medoid, integer recovery | ? | ? | D dominant/median/mode/mean/qvote | D center/median/majority | D manual resize algorithms |
| Custom/fixed palette, limit | E files/Lospec/Oklab nearest; E colour budget | D PNG palette and count | L PICO-8, Lospec/PixilArt import | D fixed, imagequant | D quantization claim | D indexed ≤256 |
| Median-cut, k-means, Wu in Oklab | **P** (none of these three verified in Studio) | ? | ? | D imagequant, algorithm differs | ? | D conversion method differs |
| Bayer 2/4/8; FS, Atkinson, blue noise | E Bayer; **P** diffusion/blue noise | ? | L selector not yet measured | ? | ? | D ordered Bayer 2/4/8 CLI |
| Batch frames with one palette/grid policy | E cleanup frame/tag/all + shared palette | D paid desktop batch; web single | ? | D library per-image | D per-image | E editor animation |
| Inspect before/after, undo, manual edit | E Studio | D before/after PNG | L live preview | D before/after/magnifier/recolour | ? | E full editor |
| 1×/integer PNG, PNG-8, indexed `.aseprite`, GIF | E first three via Studio/Pack paths; **P** integrated GIF export | D PNG | L small/large | D PNG | D array/PNG integration | D native and GIF |

Primary competitor references: [Sprite Fusion Pixel Snapper](https://www.spritefusion.com/pixel-snapper), [Pixel Art Village](https://pixelartvillage.com/), [unfake.js repository](https://github.com/jenissimo/unfake.js), [perfectPixel repository](https://github.com/theamusing/perfectPixel), [Aseprite colour mode](https://www.aseprite.com/docs/color-mode/) and [CLI](https://www.aseprite.com/docs/cli/). Current live findings are scoped to 2026-09-28; other cells marked D come from published docs or the repository's earlier runs. **No “superset”, “beats”, or paid-tool parity claim follows yet.**

## 3. Proposed experience and algorithms

1. Input by drop, paste or file selection. Decode locally. Show source dimensions/frame count before processing and a per-format support result. For animation, import fully composited GIF/APNG frames with disposal/blend/timing intact via the existing Sprite importer. Present a limit before allocating; 4K still is a performance target, not an unlimited promise.
2. Select intent. **Restore** starts with existing `analyse()` and a visible “sure / likely / unsure” grid. Unsure requires manual choice, or retains original size. **Convert** uses typed width/height or block size; preview shows exact output dimensions and crop policy. Noninteger scale requires a documented alignment/crop rule. Reset any automatic choice without losing the source.
3. Cell sampler: nearest centre, median channel sample, modal source colour, and an Oklab k-centroid choice selected only if measured to preserve features better. Keep separate controls for grid offset X/Y and cell sampling; never call k-centroid “AI”. Do not average antialiased edges without an explicit method choice.
4. Palette: auto size 2–256, locked imported palette, or named preset. Implement deterministic Oklab median-cut, seeded k-means and Wu variants with bounded iteration/memory. Compare against existing Oklab nearest matcher and expose algorithms only if quality/performance gates pass. One palette is learned from **all frames** for animations; never silently create a different palette per frame. Transparency is a separate index where needed; preserve semitransparency only in formats that can represent it. Label “Game Boy”, “NES” and “PICO-8” as named palette sources rather than claiming hardware fidelity; NES has no single universal RGB palette.
5. Dither: none, Bayer 2/4/8, Floyd–Steinberg, Atkinson, fixed-seed blue-noise table, with intensity 0–100%. Operate after grid recovery and before outline/stray edits. Error diffusion carries no error into transparent pixels and must not leak across frames; compare temporal flicker and keep it off by default for animation. All choices deterministic across browsers where possible.
6. Postprocess: existing fringe, isolated-pixel, 1-pixel line/outline controls with a before/after diff overlay. Destructive suggestions are previewed and reversible; one-pixel eyes and deliberate dither must be protected by default.
7. Output: original-size 1×, 2–16× nearest PNG, indexed PNG-8, indexed `.aseprite` via the existing bridge, animated GIF with explicit loop and frame delays, and “Continue in Studio”. Each export is reopened by an independent decoder or Aseprite CLI. If GIF timing/alpha/palette limits cannot be met, omit or label that export **UNVERIFIED**. The source remains available for a new run.
8. Settings (intent, dimensions, palette preset, methods, thresholds) serialize to a versioned query string; files and pixels never do. Parse/clamp unknown or old values. A copied link reopens the controls without implying the image is present.

### Architecture fit

Extend `src/studio/pixel/cleanup.js` with small pure modules for sampling, quantization and dithering; keep `cleanup-worker.js` as the compute boundary. Avoid a second stateful pipeline in `src/task/pixel.js` or `pixel-lab.js`. `cleanup-ui.js` hosts simple controls and an advanced disclosure, with `strings.js` ko/en/ja parity. Reuse `src/studio/pixel/{indexed,palette-io,png8}.js`, Sprite animation import and the existing Aseprite bridge. Use transferable pixel buffers; cap aggregate source/result/preview allocation and provide cancellation/progress. Loading a URL, rendering SEO text or editing settings must never send image bytes. Lospec remains the only optional fetch, behind the existing explicit consent and Studio CSP.

The task page `/game/fix-ai-pixel-art/` remains indexable and leads to the Studio action. Its current SEO depth entry is in `src/seo-depth/pixel-fix.js`; update that entry only for real changed behaviour, then run `node tools/lastmod.mjs --write`, hreflang/structured-data and SEO audits during implementation. No thin palette-variant landings. Studio itself remains a noindex workspace. If any future WASM path needs SharedArrayBuffer, use an ad-free isolated route and keep normal pages ad-compatible; the proposed JS worker needs no isolation.

## 4. Acceptance and independent measurement plan

| Gate | Test and measurement | Acceptance target |
|---|---|---|
| Core determinism | Pure module tests, same bytes across repeated runs, order-independent multi-frame palette learning | No random output without a visible seed; expected algorithm goldens pass. |
| 1× geometry | CC0 originals upscaled integer, fractional, bilinear, JPEG and offset; Pillow reads actual PNG outputs; dimensions and pixel equality compared to originals | No regression against **rerun** current-main baseline by case class; report exact size, ±1 size, exact pixels and Oklab ΔE separately. |
| Photo conversion | CC0 photographs with human-reviewed 1× reference or task criteria; compare contours, colour budget, palette coverage and blinded visual preference against 3–5 competitors | Publish per-image results and failure cases; no global “better” claim from a single score. |
| Animation | Real CC0 GIF/APNG with disposal/blend/variable delays; Pillow/APNG decoder and Aseprite compare every composited frame, sequence, alpha, loop and delay | Frame count/order/dimensions exact; timing within target format precision; no unintended palette flicker. |
| Palette/index exports | Pillow verifies PNG colour type 3, PLTE/tRNS, indices, RGBA round trip; Aseprite CLI opens indexed `.aseprite` and reexports frames | Pixel equality for lossless cases; palette and transparent index correct. |
| GIF output | Pillow and Aseprite decode frames/times/loop; test transparent pixels, 256-colour ceiling, disposal and 1× dimensions | No false claim of full alpha; document GIF quantization/timing changes. |
| Local-only/privacy | Browser request log during input/process/export; URL share test; opt-in Lospec request with `credentials: omit`, no referrer | Zero new network calls containing files; only consented palette fetch. |
| UX/a11y | Chromium keyboard-only, drop/paste/select, focus order, progress/cancel, undo and side-by-side compare; visual screenshots at 1440×900 and 390×844, inspect by eye | Complete flow usable with keyboard and at 390px; no obscured primary action/overflow. |
| Languages | ko/en/ja message key tests and human review of instructions/errors | Equal controls and accurate terminology in all three. |
| Regression/SEO | `npm test`, `python tools/regression.py`, `python tests/service-browser.py`, focused Pixel browser suite with and without `NERULIO_CORPUS`; build, `tests/seo-depth.test.mjs`, SEO audit | Required suites pass with counts reported; pre-existing failures separated. |

Corpus root: `C:\Users\2009s\nerulio-asset-corpus`, with `manifest.json` and the existing `_adhoc\nerulio-studio-pixel` 69-case truth set. Record every source URL, author, CC0 evidence, hash and transformations; do not commit non-CC0 assets. Freeze case IDs and version before comparing tools. Rerun each competitor on **identical input**, record method/options/version and independently decode outputs. The existing `docs/pixel-bench/` scripts are a starting point; inspect their absolute scratch paths and reconcile 69/76 counts. Report unsupported inputs and errors rather than scoring them as zero silently. Aseprite reference tasks can run via `C:\Users\2009s\asebuild\b\bin\aseprite.exe`; outputs need actual reopen, not just a magic-byte check.

Performance budget proposal (measure 10 warm/cold runs separately in Chromium on the same machine): 3840×2160 still, first useful preview ≤2 s, completed default conversion ≤10 s, UI event-loop tasks ≤50 ms; 100×512² animation preview ≤5 s and processing ≤30 s; peak JS/WASM memory <1 GiB on desktop and a lower guarded input limit on 390px mobile. These are **targets, not observed timings**. Test cancellation, rapid option changes, cache invalidation and browser tab recovery. Existing `docs/STUDIO-PIXEL.md` records 384×576 nearest cleanup 1.4 s and 363×544 bilinear 4.7 s in headless Chromium; those are not 4K evidence.

## 5. Specifications, trust boundaries and risks

Official/primary format references checked 2026-09-28: [W3C PNG Third Edition](https://www.w3.org/TR/png-3/) (indexed PLTE/tRNS and APNG acTL/fcTL/fdAT; disposal/blend/delay), [CompuServe GIF89a specification](https://www.w3.org/Graphics/GIF/spec-gif89a.txt) (palette, graphic control, transparency/disposal), [Aseprite file specification](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md) (8-bit indexed pixels, palette chunks, transparent index), [Aseprite indexed colour documentation](https://www.aseprite.com/docs/color-mode/) (≤256 entries), [Lospec palette API](https://lospec.com/palettes/api) (slug JSON shape and 404), [Adobe Photoshop file formats](https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/) (swatch exchange), and [Aseprite CLI](https://www.aseprite.com/docs/cli/) (colour mode and ordered matrices). Format rules will be cited beside encoder code when implemented. For `.gpl`, `.hex`, JASC/RIFF `.pal` and Adobe `.ase`, validate against real files and existing parser tests; do not invent one universal “.pal” meaning.

| Risk | Required response |
|---|---|
| “AI cleanup” implies semantic reconstruction | Explain that grid/palette methods are deterministic heuristics; show confidence and untouched/unsure cases. Never label them AI. |
| Loss of single-pixel features or intentional dither | Conservative defaults, zoomed diff and non-destructive new sprite; compare eyes/lines/dither goldens. |
| Animated temporal shimmer | Shared grid estimate and palette, deterministic phase; temporal error/flicker metric, no default error diffusion. |
| Transparent edges and colour profiles | Distinguish straight alpha and premultiplication; compare opaque and alpha separately; record colour-profile handling. |
| PNG-8 vs `.aseprite` indexed semantics | Separate a PNG palette transparency table from Aseprite's transparent index; independent decoders. |
| GIF limit and delay rounding | Explicit 256-colour/limited-alpha and timing report; tests of disposal and loop. |
| 4K or long animation memory blow-up | Transfer buffers, bounded previews, aggregate byte cap, early size message, cancellation; measure peak in browser. |
| Competitor and SEO claims drift | Date versions/options, rerun results before claim, document where competitors are better, avoid doorway pages. |
| Overlap and merge conflicts | Prefer new pure modules plus narrow edits in `cleanup.js`, `cleanup-ui.js`, `strings.js`; flag any shared `tools/build.mjs`, `tools/regression.py`, `src/studio/main.js`, `src/seo-depth/pixel-fix.js` edit to coordinator. |

## 6. Implementation sequence after review

1. Freeze corpus manifest and reproduce current-main benchmark/results; resolve 69/76 case discrepancy and document four competitors' executable routes/options.
2. Add pure sampling, quantization and dithering modules with independent goldens; select defaults on measured quality, not feature count.
3. Integrate the worker and Studio UI; three languages, URL settings, keyboard and mobile. Use port 4701 only.
4. Add animation/output paths, reopen every format, then browser test and full regression both with/without corpus.
5. Run competitor comparison, 4K/performance, screenshots and visual review. Update the existing intent page's ko/en/ja depth and SEO artifacts only for verified functionality. Report every unverified format/method honestly.

Review questions for coordinator: whether photo conversion should surface first on `/image-to-pixel-art/` while reusing the same Studio controller, and whether the proposed 4K time/memory targets match the product budget. Neither affects the shared engine design.
