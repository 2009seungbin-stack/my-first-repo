# Pixel Lab

One workspace (`src/task/pixel-lab.js`) that takes several animation frames — or one sheet — from
"whatever the artist exported" to a consistent, engine-ready pixel asset: extract **one** palette
from all frames, lock every frame to it, recolour ramps, clean up stray pixels and anti-aliasing,
check the pixel grid, export. Nothing is uploaded; every frame is processed in the browser.

Pure logic lives in `src/game/palette.js`, `src/game/pixel-cleanup.js`, `src/game/pixel-check.js`
and `src/pixel-engine.js`, all with `node:test` coverage
(`tests/game-palette.test.mjs`, `tests/game-pixel-cleanup.test.mjs`, `tests/game-pixel-check.test.mjs`).

## Routes

| URL | Opens the Lab at | Search intent |
|---|---|---|
| `game/pixel-lab` | Convert | the Lab itself |
| `game/palette-extractor` | Palette | "extract palette", "gpl palette", "lospec palette" |
| `game/palette-swap-ramp` | Recolour | "palette swap ramp", "team colors", "recolor sprite" |
| `game/pixel-art-cleanup` | Cleanup | "remove anti aliasing", "stray pixels" |
| `game/pixel-perfect-checker` | Check | "pixel size detect", "downscale pixel art" |

The existing `pixel`, `refiner` and `palette-swap` ids and URLs are **untouched and still work**.
`palette-swap` keeps its own page: it is the one-colour swap with a tolerance and a shading offset,
it already has browser coverage (`tests/recipes-browser.py`), and it answers a different question
from "map a whole shading ramp onto another ramp". Hijacking that URL would have replaced a working
tool to save one route, so the ramp mapper earned `game/palette-swap-ramp` instead. All three tools
now list Pixel Lab in their "Continue with" row, and the Lab is reachable from the game category.

## The pipeline (one path, used by both preview and export)

```
source frame
  → optional N×N base            (Im.pixelBase; 0 = keep the frame size, the default)
  → indices + alpha              (palette lock, or the anti-alias remover)
  → cleanup change list applied  (orphans / tiny clusters / holes / outline gap fix)
  → palette re-map by index      (ramp swap, hue window, status tint — or identity)
  → RGBA                          (P.recolorIndexed: alpha comes from the source, never redrawn)
  → optional integer scale        (K.nearestScale, 1×–8×)
```

The preview runs this for the visible frame; the exporter runs it for each frame in turn. There is
no second code path, so preview and export cannot drift apart.

Two deliberate design choices:

* **Every recolour is a palette transform, not a pixel transform.** An operation produces a new
  palette of the same length and the pixels are rewritten by index. Two frames that both used
  index 4 still both use index 4 afterwards, so shading relations and animation consistency are
  exact by construction rather than approximately preserved.
* **Export encodes the RGBA buffer directly** with `src/png-stream.js` (`pngRGBACompressed`), never
  `canvas.toBlob()`. A canvas stores colour premultiplied by alpha, so an anti-aliased edge pixel
  written as a palette colour comes back a shade off it. Before this change 68 of 84 exported
  colours fell outside a 16-colour locked palette; after it, 0 of 16 do (measured, see below).

Memory: only the decoded sources, one frame's indices and the current preview exist at once. Frame
pixels are read through a generator (`pixelsOf`) so extraction and counting keep a single
`ImageData` alive instead of N copies; exports become Blobs one frame at a time.

Every stage walks each pixel in Oklab **on the main thread**, which is right for sprite-sized art
and wrong for a scan. A frame larger than 4096 × 4096 is therefore refused with an explanation
rather than freezing the tab (the shared `LIMITS.pixels` in `src/core.js` allows 536 megapixels,
far beyond what a synchronous per-pixel pipeline can handle). There is **no `AbortSignal`** on the
Lab's own passes — see "Not done / weak".

Undo (`Ctrl+Z`, bound on `document`, and the Undo button) stores small state snapshots — palette,
locks, options, selection — never images. Cleanup previews are change lists of `{at,from,to}`, so
applying and reverting cost only the pixels that actually differ.

---

## 1. Palette extraction

**Input** any number of decoded frames (RGBA views). **Output** 1–256 colours as `[r,g,b]`.

**Algorithm** (`extract` → `accumulate` + `paletteFromHistogram` in `src/pixel-engine.js`): every
frame feeds **one** alpha-weighted 5-bit-per-channel histogram, so a colour that appears in two
frames counts twice and no frame gets its own palette. The histogram is split by weighted median
cut in Oklab — the box with the largest (widest axis × mass) is split on that axis, which is how
frequency and perceptual spread both matter — then refined with four Lloyd iterations whose
centroids are computed in RGB so the palette stays in gamut.

**Bug found and fixed while building this:** one heavy point could push the median past the last
entry of a box, leaving an **empty** box whose weighted average was `NaN`. `quantizePerceptual`
never picks a `NaN` entry (every distance comparison is false), so the old behaviour was a silently
wasted palette slot — asking for 16 colours could quietly give 15 usable ones. The split index is
now clamped so both halves are non-empty, and `paletteFromHistogram` filters non-finite entries.

**Panel** swatches with HEX, per-colour pixel count and percentage, `aria-label` carrying index,
hex and share. Counts are exact (`usage`, nearest palette entry in Oklab with an exact-match fast
path) and cover **every frame** while the animation stays under 4 megapixels in total; above that
they cover the visible frame and the panel says so.

**Limitations** counting buckets colours to 5 bits per channel, so a colour used on one or two
pixels can merge into a neighbour. Asking for more colours than the frames contain returns fewer —
a box cannot be split below one point.

## 2. Sort, edit, import, export

**Sorting** (`sortPalette`) by lightness, hue, saturation or frequency, computed in OkLCh, and
`original`. Greys (chroma < 0.01) are grouped at the end of a hue sort instead of scattered around
the hue circle. The permutation is returned as well, so locks, counts and shares follow the palette.

**Editing** replace (colour input), remove, add, and **lock**: a locked colour survives
"Extract again", which re-extracts only the remaining slots.

**Import / export** (`src/game/palette.js`)

| Format | Reader | Writer | Notes |
|---|---|---|---|
| GIMP `.gpl` | `parseGPL` | `toGPL` | header required, `Name:`/`Columns:` optional, `#` comments and blank lines skipped, colour lines are exactly three 0–255 integers plus an optional name; channel > 255, a bad `Columns:` value, a missing header and a palette with no colours are all rejected with the line number |
| HEX list `.hex`/`.txt` | `parseHexList` | `toHexText` | Lospec style: one colour per line or several separated by commas/spaces, `#` optional, `#rgb` shorthand accepted; `;`, `//` and `#` followed by a non-hex character are comments |
| JSON | `parsePaletteJSON` | `toPaletteJSON` | `{"colors":["#rrggbb"]}`, `{"rgb":[[r,g,b]]}` or a bare array |

`parsePaletteFile` detects the format from the **content**, not the extension, so a `.txt` holding
a GIMP palette still reads correctly. Round trips (including colour names and `Columns:`) are
unit-tested, and the browser suite re-imports each exported format.

## 3. Palette lock and why dithering can flicker

**Input** all loaded frames + a fixed palette (extracted from all frames, imported, or a classic
console/community palette reused from `src/task/pixel.js`: Game Boy, PICO-8, Sweetie 16, Endesga 32,
NES, mono). **Output** per frame: the RGBA result and the palette **index** of every pixel (−1 where
alpha is 0). The index is what proves two frames agree.

**Dither modes** (`src/pixel-engine.js`): None, Floyd–Steinberg, **Atkinson** (new), **Bayer 2×2 /
4×4 / 8×8** (new). The Bayer matrices are generated by the recursive rule
`M(2n) = [[4M, 4M+2],[4M+3, 4M+1]]` and unit-tested against the exact standard tables and for being
a permutation of `0 … n²−1`. Atkinson's six weights sum to **6/8** — it deliberately discards a
quarter of the error, which is why it holds contrast on flat pixel-art shading; it needs three
error rows, so the quantiser keeps one row buffer per row its kernel can reach. `ordered` and
`bayer` remain aliases of the 4×4 matrix so old links and saved presets keep meaning what they
meant. (This also fixed a latent bug: the pixel converter offered a "Bayer" option that the engine
treated as Floyd–Steinberg, because only the literal string `ordered` took the ordered path.)

**Why error diffusion flickers between frames, and ordered dithering does not.** An ordered matrix
adds a bias that depends *only* on `(x mod n, y mod n)`, so the decision for a pixel is a pure
function of its own colour and its position: an unchanged region produces identical indices in
every frame. Error diffusion carries a running error forward across the whole scan; a change
anywhere upstream — one moving pixel, one different row — shifts the residual error and therefore
the decisions of every later pixel. The same flat region can then land on a different palette entry
from frame to frame, which reads as colour flicker in the animation. The Lab therefore **defaults
to None**, warns in the Convert stage when a diffusion mode is chosen with more than one frame
loaded, and `flickers(mode)` exposes the distinction to callers.

**Dither lab** a side-by-side compare grid renders the current frame in all six modes at once.

## 4. Shading-preserving recolour

* **Ramp swap** (`rampMap`) the user selects source colours (palette swatches, which are also the
  keyboard path); they are ordered by Oklab lightness and mapped onto the target ramp **by ramp
  position**, never by nearest colour, so the darkest selected colour becomes the darkest target
  colour and the order cannot invert.
* **Auto ramp from one base colour** (`generateRamp`) keeps the source ramp's Oklab lightness steps
  exactly (unit-tested to within 0.02 L), takes the base colour's hue and chroma, and shifts hue
  along the ramp (shadows cooler, highlights warmer) with a chroma bulge in the mid-tones. It is a
  starting ramp, not art direction.
* **Hue-range replace** (`hueWindow`, `hueReplace`) an OkLCh hue centre ± window ± extra tolerance,
  ignoring colours too grey to have a hue. The preview mask lists how many palette colours are
  inside the window and marks them with a tick as well as a highlight (never colour alone). Each
  matching colour keeps its own lightness, and its chroma unless the target is grey.
* **Team colour batch** (`teamVariants`) N variants in one pass — red, blue, green, yellow, purple,
  orange, white, black or any `#RRGGBB` — each one the same index re-map with a different base, so
  every variant keeps identical shading relations. Exported as a ZIP with one folder per variant
  holding every frame plus that variant's `.gpl`.
* **Status presets** (`STATUS_PRESETS`, `tint`) frozen / poison / burn / ghost / damage flash are
  adjustable hue-mix + lightness-lift + chroma-scale recipes applied to the whole palette. They are
  labelled as recipes, not authored art, and they cannot reorder a ramp.

## 5. Cleanup

All of it is reported as **candidates** first and applied only when a checkbox is ticked; the
highlight overlay draws the candidate pixels at 80 % alpha and the counts are printed as text.

| Check | What it is | Fix |
|---|---|---|
| Stray pixels | 4-connected components of one index with area 1 | the index that surrounds it |
| Tiny clusters | components with `1 < area < N` (N adjustable) | most common bordering index |
| Single-pixel holes | transparent components up to N px that never reach the image edge and are ringed by opaque pixels | most common bordering index |
| Anti-alias | see below | snap to a palette colour |
| Outline | gaps, doubled runs, thickness | gaps only, and only on request |

One component scan produces the first three lists, so the counts are consistent with each other.

**Anti-alias remover** (`removeAntiAlias`). An anti-aliased edge pixel is not merely "off palette":
it sits **between** two palette colours that meet along that edge. So a pixel whose exact RGB is
not in the palette is snapped to the nearer end of the closest neighbour pair whose Oklab segment
it lies on (within an adjustable threshold), and only falls back to the globally nearest palette
entry when it has no two distinct palette-exact neighbours — which is what stops a transition pixel
speckling to some third colour that happens to be nearer in Oklab. Decisions are read from the
**original** pixels, not progressively rewritten ones, so the result is independent of scan order.
Alpha is untouched unless an alpha cut-off is set, and then only rounded to 0 or 255; the report
counts how many pixels were snapped between two colours, how many fell back to nearest, and how
many alpha values were rounded.

**Outline fixer.** Thickness is measured only where exactly one of the four neighbours is outside
the silhouette — i.e. on straight edges — because at a corner two directions point outward and the
thickness a person would name is ambiguous; corners are skipped rather than guessed. A gap is a
silhouette-border pixel that is *not* the outline colour. The auto-fix closes gaps and **never**
thins a doubled outline, because removing a doubled pixel moves the silhouette by a pixel.

**Limitation** dithering deliberately creates single-pixel patterns, so with a dither mode active
these counts include dither pixels; the stage says so and asks you to set dithering to None first.

## 6. Pixel-perfect checker

**Integer block detection.** Every `s × s` block is one colour exactly when no colour change
happens inside a block — that is, when every changing column and row sits on a block boundary. So
`gridAnalysis` records, in one pass, the columns and rows where the image actually changes colour,
and block detection becomes arithmetic on those positions: scale `s` fits when all change positions
share one residue modulo `s`, and the offset is `(s − residue) mod s`. This is exact (no sampling,
no tolerance), finds off-grid crops, and costs one pass plus `O(maxScale × changes)` instead of a
scan per candidate scale and offset.

A single-colour image, or one that changes on only one axis, is reported as *not confident* rather
than answered with a guess.

**Non-integer scaling.** When no block grid fits, the scale is estimated from run lengths — and
only from the **shortest** runs (within 1.5× of the minimum), because a long run is several
same-coloured blocks in a row and averaging everything over-estimates. On a 2.5× nearest resize of
a sprite with flat borders, the plain mean reads 2.885× while the short-run mean reads exactly
2.500×.

**Blur / interpolation.** `edgeQuality` counts edge pixels whose colour lies strictly between two
opposite neighbours in Oklab (within a tolerance of the segment, and not equal to either end), plus
partially transparent pixels. Nearest-scaled art has zero; a bilinear resize of the same sprite has
1243 such pixels, 86.3 % of its edges, and 700 soft-alpha pixels.

**Recover 1× source** reads one pixel per block and is offered **only** when an exact block grid was
proven; otherwise the button explains that an exact recovery is not possible.

**Integer scaler** 1×–8× nearest (`nearestScale`, pure and unit-tested), with the output size shown
next to the source size.

**Colour budget auditor** target vs actual, with the offending colours listed by pixel count and
share, and one-click merge of the rarest into their nearest surviving neighbour in Oklab
(`auditBudget`, `mergePlan`). Colours are never merged into each other, only into survivors.

**Silhouette check** the flat silhouette at 1× and 2× on screen and as a PNG. No score, no grade.

## Export schema

The ZIP holds one PNG per frame, the palette as `.gpl`, and `pixel-lab.json` in the shared Game
Labs envelope (`docs/GAME-LABS.md`):

```json
{ "meta": { "tool": "nerulio-pixel-lab", "toolVersion": "1", "schemaVersion": 1,
            "engineTarget": "generic", "palette": ["#1a1c2c", "…"], "dither": "none",
            "ditherAmount": 1, "exportScale": 1,
            "cleanup": { "orphans": false, "clusters": false, "minArea": 4, "holes": false, "antiAlias": false } },
  "frames": { "anim_0.png": { "page": 0, "rect": {"x":0,"y":0,"w":48,"h":48}, "rotated": false,
                              "aliasOf": null, "sourceSize": {"w":48,"h":48}, "offset": {"x":0,"y":0},
                              "pivot": {"x":0.5,"y":1}, "duration": null, "tag": "",
                              "boxes": [], "collision": [] } },
  "palette": { "name": "extracted", "colors": ["#1a1c2c", "…"], "counts": [902, "…"] },
  "animations": {} }
```

`rect` is the frame's own canvas (this Lab does not pack an atlas — `sprite-sheet-maker` does), so
`rect.x`/`rect.y` are 0 and `sourceSize` equals the exported size. `pivot` is normalised on the
frame canvas. No engine project files are written: there is no `.tres`, `.meta` or `.aseprite`
look-alike anywhere in this Lab.

Settings without asset data are shareable as URL presets — `?colors=8&dither=bayer8&scale=2&size=64&budget=16&palette=pico8`
— and "Copy tool link" writes the current settings into the address. Image data never goes in a URL.

## Verification

Unit tests: `node --test tests/*.test.mjs` → **1182 pass, 0 fail** (24 of them in the three new
Pixel Lab files). `node tools/check.mjs` passes.

Browser: Chromium via Playwright against a built `dist` (`tests/task-browser.py`, Pixel Lab block;
fixtures generated with Pillow by `tests/pixel-lab-fixtures.py`). Every number below was measured
by re-opening the downloaded file with Pillow / `zipfile` / `json`, never read from the UI.

| What was measured | Number | Status |
|---|---|---|
| 8 anti-aliased 48×48 frames → one 16-colour palette, union of exported colours ⊆ palette | 16 colours out, **0** outside | VERIFIED |
| Palette count never exceeds the request (4/8/16/32/64) | ≤ requested in every case | VERIFIED |
| Unchanged flat band identical across all 8 frames, dithering off | **1** distinct version of the band | VERIFIED |
| Same, with Bayer 4×4 (position-only bias) | **1** distinct version; union still ⊆ palette | VERIFIED |
| Error-diffusion warning shown when >1 frame is loaded | present in ko/en/ja | VERIFIED |
| Dither compare grid renders all modes | **6** canvases | VERIFIED |
| `.gpl` / `.hex` / JSON export → re-import round trip through the UI | 16 → 16 colours each | VERIFIED |
| `.gpl` strict parser: names, `Columns:`, comments, CRLF, and the four rejection cases | unit-tested round trip, byte-identical re-serialisation | VERIFIED |
| Anti-alias remover on the anti-aliased frames | **271 → 16** distinct colours, all in the palette | VERIFIED |
| Silhouette movement from the anti-alias remover (no alpha cut-off) | **0** alpha pixels differ (0 px, better than the ≤1 px target) | VERIFIED |
| Integer scale detection: 1×, 2×, 3×, 4×, 8× nearest | exact scale, offset (0,0), logical size 16×16 | VERIFIED |
| Off-grid crop of a 4× sprite (cropped 2 px, 3 px) | scale 4, offset (2,3), reported off-grid | VERIFIED |
| 2.5× **nearest** resize | "No integer grid", estimate **2.500×** | VERIFIED |
| 2.5× **bilinear** resize | not called integer; **1243** intermediate edge pixels (**86.3 %** of edges), 700 soft-alpha | VERIFIED |
| "Recover 1× source" on a 3× sprite | 16×16, pixel-identical to the original (unit test) | VERIFIED |
| Colour budget: 16 colours, target 8 | 8 offenders listed; after merge the export really uses **8** colours, 0 outside the palette | VERIFIED |
| Team variants: 4 bases × 8 frames | **32** PNGs in 4 folders; each variant changes exactly the 3 selected slots, the other 13 byte-identical | VERIFIED |
| Status tint (frozen) | same 16 slots, different colours, export ⊆ its own palette | VERIFIED |
| `Ctrl+Z` bound on `document` after a self-disabling control | undoes cleanup and the budget merge | VERIFIED |
| Deep links open the right stage (5 routes) | convert / palette / recolor / cleanup / check | VERIFIED |
| URL preset `?colors=8&dither=bayer8&scale=2` | chips pressed, canvas info reads `48 × 48 → 96 × 96 · 8 colours` | VERIFIED |
| No horizontal scroll at 390 and 320 px, on Convert / Palette / Cleanup / Check | `scrollWidth == innerWidth` in all cases | VERIFIED |
| Engine parity of the quantiser refactor | byte-identical output for `ordered`, `floyd-steinberg` and unknown modes across 3 sizes × 3 amounts × 2 counts | VERIFIED |
| Whole `tests/task-browser.py` suite, including the Pixel Lab block | **110 checks, 0 failures**, exit 0 | VERIFIED |
| Screenshots reviewed at 1440 / 390 / 320 on all six stages, plus the candidate overlay | no console or page errors, no horizontal scroll | VERIFIED |
| Firefox / WebKit | — | **UNVERIFIED** (Chromium only; `src/capabilities.js` therefore keeps these ids unpromotable and `noindex`) |
| Godot / Unity import of `pixel-lab.json` | — | **UNVERIFIED** (no engine is installed here; the file is generic JSON, no engine project file is produced) |

## Not done / weak

* **No animation preview.** The frame strip steps through frames (click, or ← / →) but the Lab does
  not play them back; flicker is therefore proven by comparing exported pixels, not by eye.
* **Counts above 4 megapixels of total frame area** cover the visible frame only.
* **`recolorIndexed` clamps an out-of-range index** to the last palette colour rather than failing,
  so shrinking a palette while a stale index exists paints the last colour instead of throwing.
* **The outline fixer does not thin doubled outlines** even optionally; only gap closing is offered.
* **No per-frame palette overrides** — the whole point is one palette, but a sprite sheet with two
  unrelated characters has to be split first.
* **No cancellation and no worker.** The pipeline is synchronous on the main thread, so a very
  large batch blocks the tab until it finishes; the only protection is the 4096 × 4096 per-frame
  refusal above. The Game Labs brief asks for an `AbortSignal` on long operations and this Lab does
  not have one. Moving the per-pixel passes into `recipe-worker.js` (or a new worker) with progress
  and cancellation is the first thing to do next.
* **Sprite sheets are not sliced here.** Dropping one sheet treats it as a single frame; use
  `sprite-slicer` first. The Lab accepts "one sheet" only in the sense that it will palette-lock,
  clean and check it as one image.
* **`aaThreshold` is in thousandths of an Oklab distance** (default 80 = 0.08). That is an honest
  number but not a friendly one; it has no unit label in the UI beyond its range.
