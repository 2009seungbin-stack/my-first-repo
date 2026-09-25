# Hand-off: P2 Pixel workspace (`nerulio/studio-pixel`)

- **Branch:** `nerulio/studio-pixel` (from origin/main `c4635a4`, merged; pushed to origin)
- **Head commit:** see `git log -1` on the branch (the commit that adds this file)
- **Worktree used:** `C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-ae3a259be05a673a5`
- **Port:** 4501 (`PORT=4501 node tools/serve.mjs`). Screenshots go to `scratchpad/p2/studio-pixel/` (none taken yet).
- Rules: `scratchpad/STUDIO-AGENT-RULES.md` (incl. P1+ addendum: corpus-less CI run, byte-exact fixtures in `.gitattributes`).

## STATUS (session 2, 2026-09-25) — read this first
- Merged origin/main (101 commits, no conflicts). `npm test` 2206 pass / 0 fail / 1 skip.
- Workspace is WIRED and RUNS: registered in main.js (tab after Tile), removed from coming.js, check.mjs covers
  src/studio/pixel + workspaces/pixel. strings.js (ko/en/ja, parity + "every used key exists" tests), pixel.css,
  cleanup-ui.js + cleanup-worker.js written. Stubs fixed (noop command removed; `ctx.menus` added to ctx).
- Bug found + fixed: the earlier `get tool()` on ctx shadowed `ctx.tool(def)` (broke every workspace) → now `ctx.activeTool`.
- Verified by hand in Playwright (port 4501): stroke = 1 undo step, undo/redo, right-click BG, bucket, rect, pixel-perfect,
  Shift+click line, symmetry, marquee move/drop/undo, flip/rotate in place, copy/paste, layers + multiply blend + merge
  down (pixels identical), lock refuses paint, indexed conversion keeps the picture, palette drag reorder keeps the picture,
  cleanup of old_hero bilinear x4.25 with background=keep → 3072/3072 pixels = truth, .nerulio round trip keeps
  palette/colorMode/locked/blend + pixels.
- Real Aseprite CLI: exported indexed 2-layer (normal + multiply, locked) 2-frame sprite opens as indexed, palette 33,
  transparentColor 0, blend MULTIPLY, editable=false; `--color-mode rgb --save-as` frames = Studio composite, 0 px diff
  (scratch: C:/Users/2009s/nerulio-handoff/scratch/p2/aseprite/).
- CSP: tools/site-config.mjs headers() adds /game/studio/* and /:lang/game/studio/* blocks = site CSP + https://lospec.com
  in connect-src (unit test). Lospec JSON sends Access-Control-Allow-Origin: * (checked with curl).
- Fixtures: tests/fixtures/pixel/ (CC0, LICENSE.md, -text).
- NEXT: tests/studio-pixel-browser.py + regression.py entry; screenshots 1440/390 review; 512x512x100 timing;
  engine work on ai-sim/JPEG; bench script paths → scratch/p2; head-to-head; docs/STUDIO-PIXEL.md.

## Scope of P2 (from the task)

An Aseprite-class pixel editor workspace `pixel` inside the Studio (replacing the "coming P2" entry), editing
the same project document as the Sprite workspace (layers × frames cels):
1. Tools: pencil B, eraser E, bucket G (contiguous/global, tolerance), line L, rect/ellipse U (filled/outline),
   eyedropper I / Alt, marquee M, magic wand W, lasso Q, move V (cut/copy/paste/flip/rotate 90°), Shift-click
   lines, pixel-perfect, brushes 1–16 square/round, symmetry X/Y/both + custom axis, shading ink, dithering brush,
   replace colour, outline/shadow for selection; right-click = BG colour; each stroke one undo step; stable at
   512×512 × 100 frames.
2. Layers & frames: layer panel (add/delete/duplicate/merge down, visibility, lock, opacity, Aseprite blend modes),
   Sprite timeline (cels), onion skin + playback reusing Sprite behaviour, preview window 1:1/2×.
3. Palette: true indexed colour mode, palette panel with drag reorder, hue-shifted ramps, .gpl/.pal/.hex/.ase
   import/export, Lospec search (only network call, consent dialog, optional), team-colour variants across frames,
   per-frame palette audit.
4. Cleanup pipeline (upscale / "AI-look" fixer): scale detection incl. resampled art, grid snap to 1×, Oklab
   quantize (dither off by default), anti-alias fringe / mixels, frame stabilisation, outline/shadow batch,
   before/after with integer zoom, deterministic, nothing uploaded, no "AI" wording.
5. Undo, autosave, `.nerulio` round trip, `.aseprite` export verified in the real Aseprite CLI
   (`C:\Users\2009s\asebuild\b\bin\aseprite.exe`) with layers / blend / indexed palette.
6. ko/en/ja, Aseprite key map in the `?` sheet, usable at 390 px.
Plus: real-asset head-to-heads (pixel-snapper, perfectPixel, unfake.js; Aseprite/Pixelorama/Piskel/Lospec editor),
`tests/studio-pixel-browser.py` in `tools/regression.py`, docs/STUDIO-PIXEL.md, final report per the rules file.

## DONE (committed)

### Pure modules — unit-tested, `tests/studio-pixel.test.mjs` 27/27 pass (`node --test tests/studio-pixel.test.mjs`)
| file | what |
|---|---|
| `src/studio/pixel/raster.js` | planes (packed RGBA `Uint32Array` or palette indices `Uint8Array`), brush footprints, Bresenham, Shift angle snap (0/26.57/45/63.43/90°), rect, Zingl ellipse, pixel-perfect filter, symmetry mirrors, ordered dither patterns, tolerance, flood fill / magic wand (contiguous/global, 4/8, selection limit), masks (rect, lasso polygon, combine add/subtract/intersect, invert, bounds, marching-ant edges), floating pieces (lift/cut, stamp, flip, rotate 90), replace colour, Aseprite-style outline (outside/inside, circle/square/h/v matrix), drop shadow, crop/place helpers |
| `src/studio/pixel/stroke.js` | one gesture: reads a snapshot, writes the plane (ink applied once per pixel per stroke); inks simple / alpha (Aseprite normal blend) / lockAlpha / shading (ramp step) / replace; dither brush; pixel-perfect with hit counts; symmetry with mirrored footprints; `revert`, `shape()` for line/rect/ellipse preview |
| `src/studio/pixel/indexed.js` | palette model, Oklab matcher (never returns the transparent index), RGBA↔indices, **two-colour ordered dither in linear light**, palette move/remove/sort with index maps that keep the picture, exact palette, DB32 |
| `src/studio/pixel/png8.js` | indexed PNG (colour type 3, PLTE+tRNS) encoder/decoder, deterministic bytes — how an indexed sprite's cels are stored |
| `src/studio/pixel/palette-io.js` | GPL (Lospec headers, Channels: RGBA), JASC-PAL, RIFF PAL, Adobe Swatch Exchange (RGB/CMYK/LAB/Gray), ACT, HEX, JSON (Lospec), palette from an `.aseprite` file; writers; `lospecSlug/lospecURL`, popular slugs |
| `src/studio/pixel/ramps.js` | hue-shifted ramps in OkLCh (base kept exactly, cool shadows / warm lights), blend ramps |
| `src/studio/pixel/audit.js` | per-frame audit: distinct colours, stray (off-palette) colours with counts + first position, budget, near-duplicates; stray mask |
| `src/studio/pixel/pixel-doc.js` | document edits: `target`, `setCel(s)`, `coverPainted` (grows trimmedRect + offset so painted pixels are not lost), layers add/remove/duplicate/move/setLayer (locked), merge-down plan/apply, `setPalette`, `setColorMode`, `newSprite`, `frameFromCanvas` |
| `src/studio/pixel/cleanup.js` | pipeline: analyse (pixel-check `inspect` + `findGrid` + background + noise) → snap → background → hard alpha → colours (auto merge only when noisy / smooth; or quantize to a given palette, dither off by default) → fringe (pixel-cleanup `removeAntiAlias`) → orphans (off by default) → one canvas + align (bounds / best overlap) → outline / shadow. Returns frames + report |
| `src/game/pixel-snap.js` (new engine module; existing engines untouched) | grid finding: exact integer grid (pixel-check `detectScale` + fix for off-grid crops picking a submultiple), Fourier lattice on 1st **and 2nd** differences (smooth resamples have flat 1st differences), pixel lattice chosen by the **spacing of edge peaks** (not harmonics, not sheet pitch), elastic boundaries, **least-squares inverse of bilinear** for smooth resamples (exact on synthetic ×2.3…×7.2), tracked (DP) cuts for uneven pseudo-pixels, cell sampling (mode / Oklab medoid / noisy mean), colour merge (mode or mean), background detect/remove, hard alpha, frame shift / anchor |

### Shared files changed (merge hot-spots — all additive)
- `src/studio/core/project.js` — `normalizeProject` keeps `asset.palette {colors[,names]}`, `asset.colorMode:'indexed'`, `asset.transparentIndex`, `layer.locked` (validated). Needed for `.nerulio`/autosave round trip.
- `src/studio/canvas/canvas-view.js` — `CanvasView.updateImage(rgba, rect)` (+ `updateRect` in both renderers: GL `texSubImage2D`, 2D `putImageData`) for live painting.
- `src/studio/app.js` — ctx gets `get tool()` (current tool id).
- `src/studio/sprite/aseprite-bridge.js` — `asepriteFromAsset(asset, rgbaOf, {palette, transparentIndex})` writes an indexed .aseprite; layer `editable = !locked`.

### Workspace UI — WRITTEN BUT NOT WIRED OR RUN YET (syntax-checked only)
`src/studio/workspaces/pixel/`: `index.js` (controller: tools, commands + Aseprite keys, menu, timeline reuse, playback, onion, floating selection, clipboard, merge/flip/rotate/outline, export .aseprite / frame PNG / PNG-8, importer reuse), `session.js` (per-layer planes of the current frame region, Aseprite-blend compositing, onion underlay, live `refresh`, cel commit incl. indexed PNG), `tools.js` (pencil, eraser, bucket, picker, line, rect, ellipse, marquee, lasso, wand, move), `overlay.js` (ants, brush footprint, symmetry axes, drafts, cleanup grid), `panels.js` (context bar, Colour HSV picker, Palette panel + applyPalette that rewrites indexed cels, Lospec with consent, ramps, variants, Layers panel + merge down, Audit, New sprite, Colour mode), `icons.js`.

## Benchmark results so far (data + scripts in `docs/pixel-bench/`)
76 cases (69 with truth: nearest-int 20, nearest-frac 9, smooth-resample 14, jpeg 10, blur 6, ai-sim 10; 7 real CC0 AI images) in `C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-pixel\` (cases.json, SOURCES.md — all CC0).
Overall (69 with truth), from `docs/pixel-bench/agg_latest.txt`:

| tool | size exact % | size ±1 % | median scale err | exact-pixel % | near-match % | mean ΔE |
|---|---|---|---|---|---|---|
| **Nerulio (this branch, head 6bade78 engine)** | **75** | **80** | **0.000** | **56.9** | **68.6** | **0.061** |
| unfake-lib | 25 | 41 | 0.028 | 44.6 | 64.6 | 0.086 |
| perfectPixel (15 failures) | 30 | 43 | 0.014 | 33.9 | 55.9 | 0.083 |
| snapper (spritefusion) | 6 | 28 | 0.309 | 33.4 | 54.7 | 0.158 |

Nerulio per kind: nearest-int 100 % size / 92 % pixels; nearest-frac 78/67; smooth 93/70; jpeg 80 % size but 4.5 % exact
pixels (colours stay noisy: needs a better merge / palette step); blur 67/54; **ai-sim 0 % size** and the 7 real AI
images are left un-snapped (grid judged "low" → not trusted). Competitor details + edit-task table (Aseprite CLI executed for
T5/T7/T8/T9/T10/T11/T14; Piskel import wizard stuck headless; Pixelorama boots but file open never loaded): `docs/pixel-bench/H2H.md`.
Re-run: `python docs/pixel-bench/png_cache.py` (JPEG→PNG for Node), `node docs/pixel-bench/run_nerulio.mjs <repo-root>`, then from the
scratchpad WORK folder `python score.py nerulio out/nerulio && python agg_tables.py nerulio snapper perfectpixel unfake unfake-auto unfake-lib`
(the scripts carry absolute scratchpad paths: WORK = `scratchpad/p2/competitors`; copy them back there or edit the paths). Diagnostics: `node diag.mjs <regex>`.

## NEXT STEPS (priority order)
1. **Wire the workspace**: register `pixel` in `src/studio/main.js`, remove it from `src/studio/workspaces/coming.js`; add
   `src/studio/pixel` and `src/studio/workspaces/pixel` to `tools/check.mjs` folders.
2. **Write the missing UI files**: `workspaces/pixel/strings.js` (ko/en/ja, merged into `STUDIO_STRINGS[l].px` like
   `tile/strings.js`; every `px.*` key used in index/panels/tools/cleanup-ui — grep `t('px.`), `pixel.css` (classes used:
   `px-bar, px-tog, px-f, px-range, px-num, px-sel, px-hint, px-color*, px-swatch-big, px-sv*, px-hue, px-alpha, px-hex,
   px-palette, px-pal-grid, px-pal-sw(.is-fg/.is-bg/.is-ramp/.is-transparent/.is-drop), px-pal-info, px-layers, px-layer(.is-cur),
   px-layer-name, px-layer-props, px-audit*, px-bad, px-dlg*, px-lospec*, px-net, px-teams, px-team, px-cur-layer`), and
   **`cleanup-ui.js`** (`createCleanup(W)` → `{root, render, reset, destroy}`: scope current frame / tag / all frames; runs
   `analyse`/`runCleanup` from `src/studio/pixel/cleanup.js` in a worker (`cleanup-worker.js`, transfer buffers); shows verdict,
   scale, confidence, candidates, grid overlay via `W.overlay.setGrid({xs,ys})`, scale override, options (background, alpha
   cut, merge/max colours/palette incl. current or Lospec, dither none/bayer, fringe, orphans, align, outline/shadow),
   before/after canvases at integer zoom, "Apply as new sprite" (one undo step; frames/tags/durations copied, pivots scaled)).
   Fix the known stubs in index.js/panels.js: `ctx.runCommand('noop')` in the palette click handler (remove), `ctx.menus`
   does not exist on ctx (use the shell `Menus` via a ctx addition or build a small popup) for the palette sort/more menus.
3. Run it: `PORT=4501 node tools/serve.mjs`, open `http://127.0.0.1:4501/en/game/studio/?ws=pixel`; debug with Playwright.
   Check: stroke → one history entry, undo/redo reloads planes, commit serialisation (`commitChain`), floating selection
   drop/cancel, indexed mode palette edits rewrite cels, `.nerulio` save/open round trip keeps palette/colorMode/locked.
4. `tests/studio-pixel-browser.py` (tools, pixel-perfect, bucket, symmetry, selection move/flip/rotate, layers + blend +
   merge, indexed conversion + palette reorder keeps picture, Lospec consent (mock `fetch`, no real network in tests), audit,
   cleanup on committed CC0 fixtures, .aseprite export opened with the real Aseprite CLI when present, ko/ja, 390 px,
   512×512×100 frames timing); add to `tools/regression.py` suite list; run with and without `NERULIO_CORPUS='C:\nope'`.
5. Verify `.aseprite` export (layers, blend, indexed palette, transparent index) in `C:\Users\2009s\asebuild\b\bin\aseprite.exe -b`
   (Lua: read colorMode/layers/blend, `--save-as` PNG and compare pixels).
6. Engine: ai-sim / AI-real grids (tracked cuts exist but confidence gating rejects them; consider trusting `tracked` when
   noise is high and edge-gap spacing is consistent), JPEG colour merge (exact-pixel 4.5 %).
7. docs/STUDIO-PIXEL.md, screenshots 1440×900 + 390×844, full `python tools/regression.py` + `python tests/service-browser.py`
   (regression.py hard-codes ports 4173/4174 — check they are free / note it), final report.

## Build / run / test
- Unit: `npm test` (all) or `node --test tests/studio-pixel.test.mjs`.
- Syntax: `node tools/check.mjs` (add the pixel folders first).
- App: `PORT=4501 node tools/serve.mjs` → `/en/game/studio/?ws=pixel`.
- Browser suites: `TEST_URL=http://127.0.0.1:4501 python tests/studio-pixel-browser.py` (to be written); corpus-less: `NERULIO_CORPUS='C:\nope'`.
- Lospec CSP: `_headers` connect-src does not include `https://lospec.com` — the Lospec fetch will be blocked on Cloudflare
  until a studio-scoped CSP block adds it (the dev server sends no CSP).

## Known issues / notes
- Selection overlay brush-footprint mirror flag is approximate on the symmetry axis (display only).
- `session.buildOnion` draws neighbour frames region-to-region (fine for sheets and full-canvas frames).
- Cleanup `analyse` is slow on large inputs (smooth least-squares fit ~2–10 s on 1000 px) → must run in a worker.
- Painting a sheet frame gives that frame its own cel (per docs/STUDIO-SPRITE.md §2); the shared sheet stays untouched.
