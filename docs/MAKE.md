# 다듬기 작업대 (/{l}/make/) — steps, recipes, measured limits

Owner: MAKER (AI-COMMUNITY-CONTRACT §6). Approved mockups: boards 4 (내 이미지로 해보기), 5 (다듬기 작업대),
8 (모바일 해보기) of https://claude.ai/artifact/TfeTEqg7yN8ax3MGRTYNaF. Research: `nerulio-handoff/research/AI-COMMUNITY-PIPELINE.md`.

## Pages

| URL | What |
|---|---|
| `/{l}/make/` | the workbench, empty (starts with "배경 지우기" as the first step) |
| `/{l}/make/?preset=<id>` | the workbench with a preset recipe; canonical = the preset's landing, noindex |
| `/{l}/make/?recipe=<post id>` | remix mode: the post's recipe replayed on the visitor's picture; noindex |
| `/{l}/make/<slug>/` | preset landing: h1 + direct answer, the workbench preloaded, then spec table (official numbers + source + check date), how-to, FAQ. `kakao-emoticon line-sticker discord-emoji telegram-sticker round-pfp phone-wallpaper ai-pixel-fix`. In `sitemap-n2-ai.xml` with ko/en hreflang. |

Server: `platform/render/make.js` (portal `page()` chrome), routes in `server/platform/pages.js` (`make`, `make-landing`;
unknown params are redirected away like every portal page). Worker routing: `/{l}/make/*` added to `PLATFORM_ROUTES`
(tools/service-build.mjs), and the Worker bundle copies `src/pipeline/recipe.js`.
Client: `src/make/make.js` (island), `fields.js` (step settings), `api.js` (community API calls), `face.js`, `make.css`.

## Recipe format — `platform/recipe.js` (body in `src/pipeline/recipe.js`)

`platform/recipe.js` is the contract's import path; it re-exports `src/pipeline/recipe.js` because browsers are only served
`src/` (the pipeline imports the same file). Exports: `RECIPE_SCHEMA`, `OPS`, `OP_PARAMS`, `FIT_SPECS`, `PRESETS`,
`GENERATORS`, `validateRecipe`, `normalizeParams`, `defaultStep`, `summarize`, `summaryLine`, `stepDetail`, `opName`,
`presetById`, `presetBySlug`.

```json
{"schema":"nerulio.recipe/1","title":"…","source":{"generator":"gemini","prompt":"…","ai":true},"input":{"expect":"sheet"},
 "steps":[{"op":"sheet.split","v":1,"p":{"mode":"auto","cols":6,"rows":4,"tolerance":40}}, …,
          {"op":"export","v":1,"p":{"format":"png","pack":"auto","maxBytes":1000000,"loop":0,"extras":true}}],
 "result":{"w":370,"h":320,"frames":1,"count":24}}
```

`validateRecipe` (object or JSON string) → `{ok,recipe}` or `{ok:false,error}`:
- only the 12 ops; any other op (face swap, undress, age change, watermark removal, code, URLs) is rejected;
- each step's `v` must be the supported version (1); unknown params dropped; numbers clamped to their range; enums,
  booleans, `#rrggbb` colours and texts checked; **every default written out** (rule 1 of the research);
- `fit` with a preset is forced to the preset's official size/mode/margin and carries its `rev` (spec check date);
- export, if present, is last; ≤ 20 steps; ≤ 16 KB as JSON; prompt ≤ 2000, title ≤ 80 characters.

Coordinates are intent: crop = "subject + margin as a share of the subject", border width = share of the long side,
caption size = share of the width, motion amplitude = share of the canvas. A `sheet.split` in `auto` mode finds the cells on
every picture; the cols×rows it stores are what the author's sheet had (the workbench writes the found grid when posting).

## The 12 steps (`src/pipeline/steps.js`)

| op | engine | class | notes |
|---|---|---|---|
| `sheet.split` | new (`sheet.js`): backdrop from the border, foreground eroded ~0.4 % → seeds, nearest-seed growth, small pieces joined to the nearest sticker, glued pairs cut at the emptiest column, reading order | A | `grid` mode divides the content box; `auto` falls back to the recipe's grid when the sheet has no gutters |
| `bg.remove` | `auto`: solid border colour → flood fill + edge colour-unmixing + backdrop-speck removal (A); otherwise AI: `src/matting.js` BiRefNet-lite (pinned) — the 512 px preview uses U-2-Netp (4.6 MB) until the big model is cached | A / B | adaptive tolerance in `auto` (1.6 × the border's 90th-percentile noise, never below the recipe's) |
| `crop` | new, intent based; circle / rounded masks with analytic 1 px anti-aliasing; never invents pixels around an opaque photo | A | |
| `upscale` | `ai`: `src/super-resolution.js` Real-ESRGAN general-x4v3 (pinned) ×4 then Lanczos to the asked scale; `smooth`: Lanczos-3 (premultiplied); `pixel`: nearest (`converter.js scaleNearest`) | B / A | the preview pass uses Lanczos; the model runs on the full pass only |
| `fit` | Lanczos-3 / nearest into `FIT_SPECS` (box, or Telegram's "long side exactly 512") | A | |
| `pixelize` | `src/studio/pixel/converter.js sampleToGrid` | A | |
| `palette` | `converter.js paletteFromFrames` + `quantizeFrames` (Wu/median cut/k-means, Bayer, FS, Atkinson, blue noise) | A | |
| `pixel.snap` | `src/studio/pixel/cleanup.js analyse/runCleanup` over `src/game/pixel-snap.js` | A | unchanged size when the grid is not trusted (reported) |
| `sticker.border` | new (`border.js`): exact Euclidean distance transform (Felzenszwalb–Huttenlocher), enclosed holes filled, 1 px AA edge, optional soft shadow; canvas grows | A | |
| `caption` | browser canvas text in the bundled SUIT font, outlined | C | bytes may differ per browser |
| `motion` | new: bounce / shake / blink / zoom as affine warps (bilinear, premultiplied); content pre-shrunk by 1/(1+amp) so nothing clips | A | |
| `export` | PNG (RGBA or indexed when it is smaller), APNG (indexed when ≤ 256 colours), GIF (`src/game/export/anim.js`), stored ZIP (`core.js zipLayout`) — all with JS deflate (`src/game/zlib.js`); WebP via the browser | A / C | `maxBytes`: exact colours first, then Wu palettes 256→16 until each file fits; says when it cannot |

Class A = same bytes everywhere (tested in Node twice per preset); B = same within one model/backend; C = browser encoder.

Runner (`runner.js`): per-step cache keyed by input + all earlier steps + this step (LRU, 400 MB), a ≤ 512 px preview pass then
the full pass, pure steps in `worker.js`, page-only steps (AI, caption) on the page via `browser.js`. Spec check (`specs.js`)
reads the exported files' own headers: size, even sides (LINE), bytes, frame counts, format, LINE set counts (8/16/24/32/40).

LINE exports include `main.png` 240×240 and `tab.png` 96×74 (from the first sticker) when the export step's `extras` is on
(the LINE preset sets it).

## Remix mode

`GET /api/v2/recipes/{id}` → validated → the original's steps shown waiting; the visitor picks a picture; steps replay with
✓ / … / · status and time; `sheet.split auto` re-detects the grid and the page says so ("원글은 6×4였는데 내 이미지는 5×4로…");
`POST /api/v2/recipes/{id}/try` once per picture after the first full run; before/after slider; final-spec select (switches
the last fit + export byte limit); "원글에 리믹스로 올리기" posts with `remixOf`.

Consent: the post form always asks "전연령이고, 실제 사람이 나오면 본인이거나 허락받은 성인" (required). The remix column also
shows a consent box when the browser's FaceDetector finds a face, or — where there is no FaceDetector (most desktop
browsers) — whenever the recipe has background removal / AI upscaling, titled "사람이 나오나요?". Nothing about faces leaves the
browser; no identification. There are no face swap / body reshape / clothing removal / age change / watermark removal steps.

Posting (`api.js`): `POST /api/v2/uploads` for two images (the original, ≤ 1600 px WebP; a sheet of up to 24 results), then
`POST /api/v2/posts?l=` with `channel, kind, tags:[], title, body, recipe, generator, prompt, ai:true, consent:true, remixOf`
and the anonymous `name/password` when signed out; Turnstile through the `/verify/` frame when the server asks. The few lines of
the anonymous path repeat `src/platform/islands.js` because islands.js keeps them private — merge into one shared module.

## Measured (2026-10-11, this machine; never more than this)

Unit tests (`tests/pipeline.test.mjs`, `tests/pipeline-recipe.test.mjs`): synthetic sheets; every sticker preset meets its
spec and is byte-identical across two runs; lossless PNG round trip; byte targets met on noise.

Browser (`tests/make-browser.py`, Chromium, dev server): LINE 24 × 370×320 even ≤ 1 MB + main/tab from the downloaded ZIP;
Kakao 360×360 ≤ 150 KB, Discord 128×128 ≤ 256 KB, Telegram 512 from the downloaded PNG; motion → APNG; caption + WebP;
remix 6×4 → 5×4 adaptation, try counted once, post payload; 390 px without horizontal overflow, phone bar targets ≥ 44 px.

Real AI pictures:
- **Sheet split, 13 DiffusionDB sticker sheets (CC0, SD 1.x, `~/nerulio-asset-corpus/ai-sheets`, prompts in sources.json):**
  a clean 8×6 chibi sheet → 49 pieces for 48 stickers (one split in two); a 3×3 sticker sheet on teal → 10 for ~9–10; the
  blue 3-row chibi sheet → 26 for 29 (stickers drawn overlapping stay paired); halloween sheets with motifs drawn over each
  other → 19–34 pieces (not separable by any rule); comic-panel / painted sheets → kept as one picture (by design).
  **No ChatGPT or Gemini emoji grid was available to test** (research §4.4 asks the operator to make 50). Those are cleaner
  (flat white backdrop, gutters) than the SD sheets above; the real number for them is still unmeasured.
- **Background removal:** the solid-backdrop path (flood fill + unmixing) is what `auto` picks on sticker sheets; on noisy SD
  backdrops a faint fringe of backdrop colour can remain inside a sticker's own white border. The AI path ran end to end in
  Chromium on a DiffusionDB picture (U-2-Netp preview 10.8 s incl. the 4.6 MB download; BiRefNet full pass, total 47.7 s incl.
  the one-time 190 MB download, dev server, no WASM threads). Cut-out quality on AI images is BENCH's measurement, not mine.
- **Wallpaper (AI ×2 of a 1024×1536 ChatGPT picture → 1206×2622):** spec ✓, 4.3 MB PNG, but 642 s on the dev server
  (headless Chromium, no WebGPU, single-thread WASM because the dev server does not serve `/ai-runtime/`). Production uses the
  isolated runtime (threads) or WebGPU; not measured there yet.
- **Packaging on the AI corpus (Node, 2026-10-12):** 318 pictures ≤ 1.7 MP from `~/nerulio-asset-corpus` (`ai-300` +
  `ai-sheets`; 74 larger ones skipped for time) × 6 presets: every exported file met its preset's size / even-side / byte limit
  (kakao 318/318, line 318/318, discord 318/318, telegram 318/318, round pfp 318/318, pixel fix 318/318; largest Kakao file
  148,773 B of 150,000; largest Telegram 511,195 B of 512,000). This measures sizes and bytes only: `auto` background removal
  needed the AI model for 1,388 of 2,042 sticker pieces, which Node cannot run, so those pieces were packaged uncut — cut
  quality is not part of this number. LINE's set-count rule (8/16/24/32/40) depends on the picture and is reported separately.
  Average time per picture (Node, one thread): Discord 0.1 s, LINE 0.5 s, round pfp 0.5 s, Telegram 1.1 s, Kakao 2.3 s
  (colour reduction to fit 150 KB), AI pixel fix 7.0 s (`pixel.snap` grid search).

## GPU / AI-model work: deferred (owner decision, 2026-10-11)

`bg.remove` (AI) and `upscale` (AI) stay wired to the existing engines exactly as they are (`src/matting.js`,
`src/super-resolution.js`, their pinned models, their WebGPU → WASM fallback). No new model, backend or GPU tuning, and no GPU
benchmarking in the MAKE suites. Both steps work on CPU-only devices through the existing WASM path; the page says
"AI 처리 중 · 기기에 따라 오래 걸릴 수 있어요" while they run and never implies a GPU is required. The timings above are
what this machine measured on the dev server, not a target.

## Known gaps

- No face detector model: FaceDetector (Shape Detection API) only where the browser has it; elsewhere the page asks.
- No animated WebP or alpha WebM (Telegram video stickers, Kakao's final animated WebP); animated exports are APNG/GIF.
- `caption` is class C (browser text rendering). WebP output is class C.
- Kakao and Discord numbers come from secondary sources (marked on the landings); LINE and Telegram are official.
- A recipe's `pixel.snap` on real AI pixel art often keeps the size (not confident) — reported, by design.
- Upload of "real" stickers to LINE/Kakao/Discord/Telegram (the research's first-try pass rate) has not been done.
