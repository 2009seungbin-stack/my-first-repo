# Nerulio Studio — Pixel workspace (P2)

`/game/studio/?ws=pixel` (also `/ko/…`, `/en/…`, `/ja/…`). A pixel editor on the Studio canvas
that edits the **same project document** as the Sprite workspace (layers × frames cels, tags,
durations, pivots — docs/STUDIO-SPRITE.md), plus a deterministic cleanup for upscaled, resampled
and generated "pixel art". Everything runs on the device; the only network request anywhere in the
workspace is the optional Lospec palette search, and it asks first.

## 1. Code

```
src/studio/pixel/                 PURE modules (node --test tests/studio-pixel.test.mjs)
  raster.js        planes (packed RGBA Uint32 or palette indices Uint8), brushes, Bresenham, Shift angle
                   snap, rect, ellipse, pixel-perfect filter, symmetry, dither patterns, flood fill /
                   wand, masks (rect, lasso, add/subtract/intersect, invert, edges), floating pieces
                   (lift, stamp, flip, rotate 90), replace colour, outline, drop shadow
  stroke.js        one gesture = one plane edit (inks: simple, alpha, lock alpha, shading, replace, dither)
  indexed.js       palette model, Oklab matcher, RGBA ↔ indices, ordered dither in linear light,
                   move/remove/sort entries with index maps that keep the picture, DB32
  png8.js          indexed PNG (PLTE + tRNS) encoder/decoder — how an indexed sprite's cels are stored
  palette-io.js    .gpl (Lospec, RGBA), JASC .pal, RIFF .pal, Adobe .ase, .act, .hex, Lospec .json,
                   palette of an .aseprite; writers; Lospec slug/URL
  ramps.js         hue-shifted ramps in OkLCh (base colour kept exactly)
  audit.js         per-frame colour budget, off-palette colours, near duplicates, stray mask
  pixel-doc.js     document edits (cels, layers, merge-down plan, palette, colour mode, new sprite,
                   canvas size) — pure: document in, document out
  cleanup.js       the cleanup pipeline (see §5)
src/game/pixel-snap.js            grid finding + cell sampling + colour merge (the cleanup engine)
src/studio/workspaces/pixel/
  index.js         controller: tools, commands + Aseprite keys, menu, timeline, playback, onion skin,
                   floating selection, clipboard, flip/rotate, outline/shadow, exports, import
  session.js       the current frame decoded into one plane per layer; Aseprite-blend compositing;
                   live refresh of the dirty rectangle while drawing; cel commit (indexed PNG if indexed)
  tools.js         pencil, eraser, bucket, eyedropper, line, rectangle, ellipse, marquee, lasso, wand, move
  overlay.js       marching ants, brush footprint, symmetry axes, drafts, cleanup grid
  panels.js        context bar, Colour, Palette, Layers, Audit, dialogs (new sprite, colour mode,
                   canvas size, Lospec, ramp, team variants, palette edit/import/export)
  cleanup-ui.js    Cleanup panel;  cleanup-worker.js  runs analyse/runCleanup off the main thread
  strings.js       ko/en/ja (key + placeholder parity and "every used key exists" are unit-tested)
  pixel.css, icons.js
```

Shared files touched (all additive): `src/studio/app.js` (ctx gets `menus` and `activeTool`),
`src/studio/main.js` (registration), `src/studio/workspaces/coming.js` (pixel removed),
`src/studio/sprite/timeline-ui.js` (optional `W.timelineEmpty(asset)` hook),
`src/studio/core/project.js` (`normalizeProject` keeps palette / colorMode / transparentIndex / locked),
`src/studio/canvas/canvas-view.js` (`updateImage(rgba, rect)` for live painting),
`src/studio/sprite/aseprite-bridge.js` (indexed export), `tools/site-config.mjs` + `tools/serve.mjs`
(Studio CSP block, §4), `tools/check.mjs`, `tools/regression.py`.

## 2. Document additions

| field | meaning |
|---|---|
| `asset.palette` `{colors:[[r,g,b,a]…], names?}` | the sprite palette (RGB and indexed sprites) |
| `asset.colorMode: 'indexed'` | absent = RGB |
| `asset.transparentIndex` | index drawn as transparent (indexed; default 0) |
| `layer.locked: true` | Pixel tools refuse to paint on it (Aseprite "editable" off, written to .aseprite) |

Pixels never live in the document. A stroke paints the layer's plane in memory (the canvas shows it
live); on pointer-up the plane becomes a new cel blob for (layer, frame) — an **indexed PNG** in an
indexed sprite — and the document edit is **one undo step**. Painting a frame of a sheet gives that
frame its own cel; the shared sheet is untouched (docs/STUDIO-SPRITE.md §2).

## 3. Using it (Aseprite key map)

| key | tool / command | key | tool / command |
|---|---|---|---|
| B | Pencil (pixel-perfect on by default; Shift+click = line from last point) | M | Rectangular marquee (Shift add, Alt subtract, Shift+Alt intersect) |
| E | Eraser (right button: replace BG with FG) | Q | Lasso |
| G | Paint bucket (contiguous / global, tolerance, all layers) | W | Magic wand |
| I / Alt | Eyedropper (left FG, right BG; all layers or current) | V | Move (selection, else the layer) |
| L | Line (Shift snaps to pixel-art angles) | U / Shift+U | Rectangle / Ellipse (filled toggle; Shift = square / circle) |
| X | Swap colours | [ / ] | Brush size 1–16 (square / round) |
| Shift+H / Shift+V | Flip selection or layer | Ctrl+C / X / V | Copy / cut / paste (floating; Enter drops, Esc cancels) |
| Ctrl+Shift+D / Ctrl+Shift+I | Reselect / invert selection | Ctrl+A / Ctrl+D | Select all / deselect |
| Shift+N / Ctrl+J / Ctrl+E | New layer / duplicate / merge down | Ctrl+Alt+C | Canvas size |
| Enter / F3 / F7 | Play / onion skin / preview window | Alt+N / Alt+Shift+N / Alt+C | New frame (duplicate) / empty frame / delete frames |
| , / . | Previous / next frame | Arrows | Nudge floating pixels 1 px (Shift: 10) |

Inks: simple, alpha compositing, lock alpha, shading (steps along the selected palette ramp —
Shift/Ctrl+click palette colours to choose it — right button steps the other way), dither
(Bayer 2/4/8, checker, rows, columns; density; second colour = BG or keep). Symmetry: vertical,
horizontal, both, with typed axis positions. Every stroke, fill, shape, move, flip, rotate, paste,
palette edit, layer change, conversion and cleanup is exactly one entry in History.

Layers panel: visibility, lock, rename (double-click), opacity, the 19 Aseprite blend modes (Aseprite's
own blender, src/game/aseprite-blend.js), move up/down, merge down (per moment: the shared picture
and every frame where either layer has a cel). The Sprite timeline is reused (frames, tags,
durations, onion skin, loop inside tag, preview window).

Palette panel: click = FG, right-click = BG, double-click = edit, Shift/Ctrl+click = ramp selection,
drag = reorder (in an indexed sprite every cel is rewritten through the index map, so the picture
never changes), sort by brightness / hue / saturation / use, add / remove, transparent index, palette
from the picture, import / export (.gpl .pal .hex .ase .act .json), Lospec search, hue-shifted ramp,
team-colour variants (the selected ramp mapped onto each team colour's ramp for every frame and
layer; each variant a new sprite). Colour mode: RGB ↔ indexed (exact colours of the picture, the
current palette or DB32; nearest colour in Oklab; dithering off by default). Audit panel: colours
per frame vs a budget, off-palette colours per frame, near duplicates, select the stray pixels or
snap them to the palette (one step).

Exports (Pixel menu): **.aseprite** (layers, blend, opacity, locked → not editable, indexed palette
+ transparent index, frames, durations, tags), frame PNG (PNG-8 with the palette when an indexed
frame uses only palette colours), and the project `.nerulio`. Animation sheets and engine bundles
stay in Pack & Export.

390 px: the panels open as a bottom sheet (Colour, Palette, Layers, Cleanup, Audit, Timeline,
History tabs); the tool strip and the options bar scroll sideways; a tap paints one pixel.

## 4. Lospec (the only network request)

Pixel › Lospec palette… first shows a consent dialog ("only the palette name you type is sent; your
pictures never leave this device", optional "don't ask again"); declining sends nothing. It then
fetches `https://lospec.com/palette-list/<slug>.json` (Lospec answers with
`Access-Control-Allow-Origin: *`) with `credentials:'omit'` and `referrerPolicy:'no-referrer'`.
The site CSP allows `connect-src` to lospec.com **only on Studio pages**: `tools/site-config.mjs`
`headers()` appends `/game/studio/*` and `/{ko,en,ja}/game/studio/*` blocks that detach the site CSP
and re-add it with `https://lospec.com` (unit-tested); `tools/serve.mjs` now applies the same
`headers()` to the source tree, so dev and CI see the production CSP. Tests mock the request;
`docs/pixel-bench/h2h_nerulio.py --online` made one real request (PICO-8, 16 colours) through the
dev server. **UNVERIFIED on Cloudflare** until deployed (the header file is generated the same way).

## 5. Cleanup (upscaled / resampled / generated pixel art)

Panel "Cleanup": pick the scope (this frame / the tag / all frames), **Measure** (nothing changes):
verdict, pixel size and how sure it is (sure / likely / unsure), input and result sizes, colour
noise, detected background; the measured grid is drawn on the canvas (dashed amber when it is too
weak to trust). Options: background (make transparent / keep), alpha cut, colour merge (auto / off /
light / medium / strong), colour limit, quantize to the sprite palette (+ optional Bayer dither),
anti-alias fringe removal, stray pixels, frame alignment, outline, drop shadow, result as indexed.
**Preview** shows before/after at whole-number zoom (and a large side-by-side compare);
**Apply as new sprite** adds the cleaned sprite (frames, durations, pivots, boxes and tags kept) as
one undo step — the original is never modified. All work runs in a worker; the same input and
options always give the same bytes.

Engine (`src/game/pixel-snap.js`): exact integer block grids (with off-grid crops); a Fourier
lattice on first **and second** differences (smooth resamples have flat first differences), the
pixel period chosen by the spacing of edge peaks, and — new in this session — a lattice that puts
every edge on its lines keeps priority over a gap period that is a multiple of it; elastic cuts;
**least-squares inverse of bilinear** for smooth resamples; and **edge tracking** for pseudo-pixels
of uneven width (generated art): significant edge peaks above the noise floor, the largest cell
size whose DP cuts land on ≥ 97 % of the edge energy, flat runs divided evenly. Tracking replaces
the lattice only when the colours are noisy, the lattice is not "high", edges sit ≥ 0.1 cell off the
lattice, the tracked cell is ≥ 3 px and square-ish, and (for smooth lattices) both agree within 10 %.
Cells → pixels by mode / Oklab medoid (never an average of edges), colours merged in Oklab.

### Benchmark (69 cases with truth, 13 CC0 sources; data and scripts in docs/pixel-bench/)

Cases: `C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-pixel\` (cases.json, SOURCES.md —
Kenney, Eris, sebshady, GrafxKid, Chris_M, DezrasDragons, OGA "second"; all CC0). Metrics:
docs/pixel-bench/score.py (exact pixel % at the best ±2 shift; "±ΔE" = opaque pixels within Oklab
ΔE 0.02). Competitors run with their own defaults (docs/pixel-bench/H2H.md §2).

| tool | size exact | size ±1 | exact pixels | pixels ±ΔE .02 | mean ΔE | failures |
|---|---|---|---|---|---|---|
| **Nerulio, defaults** (background auto-removed) | **81 %** | **90 %** | **63.2 %** | 75.4 % | 0.044 | 0 |
| **Nerulio, background kept** (as the competitors do) | **81 %** | **90 %** | **74.0 %** | **91.1 %** | **0.026** | 0 |
| unfake.js (lib defaults) | 25 % | 41 % | 44.6 % | 64.6 % | 0.086 | 0 |
| unfake.js (tool, grid auto) | 26 % | 42 % | 40.7 % | 64.8 % | 0.096 | 0 |
| perfectPixel | 30 % | 43 % | 33.9 % | 55.9 % | 0.083 | 15 |
| Sprite Fusion pixel snapper | 6 % | 28 % | 33.4 % | 54.7 % | 0.158 | 0 |

Nerulio per kind (defaults / background kept, exact pixels): nearest ×int 92.2 / 97.4 % (size 100 %),
nearest ×fraction 88.6 / 97.0 % (size 100 %, was 78 %), smooth resample 70.5 / 75.9 % (size 93 %),
JPEG 4.5 / 12.1 % exact but 48.4 / **84.0 % within ΔE .02** (size 80 %), blur 53.8 / 66.4 %
(size 67 %), simulated generated art 36.1 / **70.3 %** exact, 92.8 % within ΔE (size exact 20 %,
±1 80 % — was 0 % / 30 % before edge tracking). The 7 real generated images have no truth: **all 7
are judged "unsure" and left at their size** — the panel shows the weak candidate (e.g. ≈3.3 px on
the Rocks7 previews, which carry a drawn background grid and JPEG noise; unfake picks 3, snapper
and perfectPixel about 6) and the user can type it; the competitors always output a guess.

Re-run: `python docs/pixel-bench/png_cache.py`, `node docs/pixel-bench/run_nerulio.mjs` (variant
options via `PIXEL_BENCH_OPTS='{"background":null}' … "" nerulio-keepbg`), then in docs/pixel-bench
`python score.py nerulio <WORK>/out/nerulio && python agg_tables.py nerulio nerulio-keepbg snapper
perfectpixel unfake unfake-auto unfake-lib`. WORK (tool clones, outputs) = `$PIXEL_BENCH_WORK` or
`C:\Users\2009s\nerulio-handoff\scratch\p2\competitors`.

## 6. Head-to-head: the same edit tasks on the same real asset

Asset: Sumo Hulk sheet by Eris (OpenGameArt, CC0), 96×144, 9 colours; its ×4 nearest and ×3.78
bilinear versions; PICO-8 palette from Lospec. Aseprite 1.3.18 = the real CLI build
(`-b --script`), Lospec editor driven in Chromium (H2H.md §4, 2026-09-24). Nerulio = the Studio UI
driven by `docs/pixel-bench/h2h_nerulio.py` (results: `docs/pixel-bench/h2h_nerulio_results.json`).
Steps are GUI actions with the file open. EXEC = executed and measured; DOCS = from the tool's docs.

| task | Nerulio Pixel | Aseprite 1.3.18 | Pixelorama 1.2.3 web | Piskel | Lospec editor |
|---|---|---|---|---|---|
| T1 pixel-perfect freehand | Y EXEC (browser test: staircase L-corners removed), default on | Y | Y | - | ? |
| T2 bucket contiguous / global / tolerance | Y EXEC (all three) | Y | Y | ~ no tolerance | ~ contiguous only |
| T3 symmetry X / Y / both / custom axis | Y EXEC (axis typed; **not draggable** on the canvas) | Y (draggable axis) | Y | ~ centre only | - |
| T4 shading ink along a ramp | Y EXEC (steps one ramp colour per stroke) | Y | Y | ~ lighten/darken | - |
| T5 RGB → indexed PICO-8, no dither | Y EXEC, ≈6 steps: **100 %** of opaque px get their Oklab-nearest PICO-8 colour, 1708/1708 black px stay black, alpha kept (transparency is a separate index). Note: only 31.7 % agree with RGB-nearest (we match perceptually) | ~ EXEC: defaults 23.0 % (black becomes the transparent mask); 100 % only with fit=rgb + an extra mask entry | ? | - | - |
| T6 hue-shifted ramp | Y (dialog: steps, hue shift, darkest/lightest; base kept exactly) | ~ gradient between two entries | ? | - | - |
| T7 team colour on every frame | Y EXEC: indexed = 1 palette edit (3 actions) → 2662/2662 px, 0 other px, one undo step; RGB = variants dialog (one new sprite per team) | Y EXEC (same 2662 px) | ? | Y (per colour per variant) | ~ |
| T8 1-px outline + drop shadow | Y EXEC: Canvas size +1, Outline, Drop shadow = **1846 / 705 px, identical to Aseprite**, 3 commands | Y outline; shadow ~ manual (≈6 steps) | Y (effects) | - | - |
| T9 ×4 nearest → 1× | Y EXEC: **100 %** exact, size found by the tool (5 actions, 1.4 s) | Y EXEC 100 % (user types 25 %) | not measured | not measured | Y EXEC 100 % |
| T10 ×3.78 bilinear → 1× | Y EXEC: **99.7 %** exact (99.2 % of opaque px), 96×144 found automatically, 13 colours (truth 9), 4.7 s | ~ EXEC: needs the true size typed: best 81.5 %; 54.4 % if the user guesses 25 % | ~ needs the size | ~ | ~ EXEC 80.1 % with size typed |
| T11 .aseprite, 2 layers, blend, indexed | Y EXEC: real Aseprite reopens INDEXED, 2 layers, MULTIPLY at opacity 160 (and locked → not editable; frames pixel-identical in the browser test) | Y EXEC | ? (.pxo) | - | - |
| T12 onion skin + playback | Y (F3, Enter, preview window) | Y | Y | Y | - |
| T13 Lospec palette by name | Y EXEC (live request after consent: PICO-8, 16 colours) | - (file only) | ? | - | ~ 11 presets |
| T14 palette files | Y EXEC: .gpl .pal .hex .ase .act .json write → read back identical; reads Aseprite's .gpl/.pal/.hex/.act and a **real Adobe .ase** (16 colours) | ~ EXEC: Adobe .ase fails ("Error reading header") | ? | ? | ~ import only |

Pixelorama (v1.2.3 web) boots headless but neither the file dialog (2026-09-24) nor a synthetic
drop (2026-09-25: Godot's web drop handler needs real `webkitGetAsEntry` entries) loaded an image,
so no Pixelorama task was measured. Piskel's import wizard stayed on step 1 headless. Their columns
are DOCS / ? only.

### Where Nerulio is still worse (honest list)

* **Tools Aseprite has and we do not**: layer groups, linked cels, tilemap layers, reference
  layers, RotSprite / free rotation and scaling of a selection (only flip and 90°), gradient, spray,
  contour, text, blur/jumble tools, custom brushes from a selection (brushes are square/round 1–16),
  polygonal lasso, tiled-mode (seamless) drawing, Sprite Size (resampling) — scaling down happens
  through Cleanup, scaling up in Pack & Export — Lua scripting and a CLI, a key-remapping UI.
* The symmetry axis is typed, not dragged on the canvas; `.` / `,` stop at the last / first frame
  instead of wrapping (shared with the Sprite workspace).
* Touch: no right button, so the background colour needs the swap button or X; two-finger gestures
  are not covered by tests (shell).
* Cleanup: JPEG input comes back within ±2 levels (84 % within ΔE .02 with the background kept) but
  rarely bit-exact (12 %); simulated generated art gets the size exactly right only 20 % of the time
  (±1: 80 %); none of the 7 real generated images is snapped automatically (the user has to type the
pixel size the panel suggests). The default removes
  a solid border background, which the benchmark counts as wrong on art whose background is part of
  the picture (63.2 % vs 74.0 % exact) — it is shown before Apply and one select switches it off.
* T5: nearest colours are chosen in Oklab; users who expect Aseprite's RGB distance get different
  (perceptually closer) picks for 68 % of pixels.
* Evidence is Chromium only (Firefox/WebKit not run).

## 7. Performance (headless Chromium, SwiftShader)

512×512 sprite × 100 frames (browser test): a stroke refreshes only its dirty rectangle
(0.03 ms per 24 px refresh); pointer moves stay at the 16.8 ms frame interval of the driver; commit
of a stroke 21–25 ms; frame switch 16 ms; undo 90–140 ms; playback keeps the 100 ms frame timing
(20 frames in 2 s). Cleanup of a 384×576 ×4 upscale 1.4 s end to end, of a 363×544 bilinear
resample 4.7 s (least-squares fit), both in the worker.

## 8. Tests

* `node --test tests/studio-pixel.test.mjs` — 34 tests: raster, strokes, inks, indexed, PNG-8,
  palette files, ramps, audit, document edits (incl. canvas size), grid engine (exact, fractional,
  bilinear, pseudo-pixels on the committed Old Hero fixture), cleanup, strings parity, Studio CSP.
* `tests/studio-pixel-browser.py` (in `tools/regression.py`) — 76 checks on real CC0 fixtures
  (`tests/fixtures/pixel/`, LICENSE.md): tools and undo, selection, layers and blend, lock, canvas
  size, indexed mode and palette edits, Lospec consent (mocked, no network), audit, cleanup on Old
  Hero ×7 / ×4.25 bilinear (exact 1× pixels) / Ninja ×4.25 transparent / a generated image (not
  auto-snapped), Ninja run frames, .aseprite read back by the real Aseprite CLI (pixel-identical;
  skipped with a note when the CLI is missing, as in CI), .nerulio round trip, ko/ja, 390 px,
  512×512×100 timing.
* `docs/pixel-bench/` — cleanup benchmark and the head-to-head script.
