# UI Lab

One workspace ([`src/task/ui-lab.js`](../src/task/ui-lab.js)) that takes a UI asset from a PNG to
something an engine can use, and then checks it at the sizes it will really be drawn at:
**9-Slice · States · Atlas · Font · Check**. Stages are views over one in-memory asset — nothing is
re-uploaded between them, and a panel cut out of a sheet in the Atlas stage is the panel the
9-Slice stage edits.

Read [GAME-LABS.md](GAME-LABS.md) first for the shared model and the export envelope.

All algorithms live in DOM-free modules with `node:test` coverage; the UI module only orchestrates
them and draws canvases:

| Module | What it owns | Unit tests |
|---|---|---|
| [`src/game/nine-slice.js`](../src/game/nine-slice.js) | border validation, border suggestion, the draw plan, engine border orders | `tests/game-nine-slice.test.mjs` (7) |
| [`src/game/ui-states.js`](../src/game/ui-states.js) | brightness / contrast / saturation / overlay / offset / alpha / outline ops | `tests/game-ui-states.test.mjs` (4) |
| [`src/game/bmfont.js`](../src/game/bmfont.js) | character sets, glyph metrics from alpha, BMFont text writer **and** reader, missing-glyph comparison, localisation-file unwrapping | `tests/game-bmfont.test.mjs` (6) |
| [`src/game/sdf.js`](../src/game/sdf.js) | exact Euclidean distance transform, signed field, downsample, byte encoding | `tests/game-sdf.test.mjs` (4) |
| [`src/game/contrast.js`](../src/game/contrast.js) | WCAG relative luminance, contrast ratio, AA/AAA thresholds | `tests/game-contrast.test.mjs` (4) |
| [`src/game/ui-layout.js`](../src/game/ui-layout.js) | anchor presets, safe areas, screen/scale presets, greedy line breaking, rectangle merging | `tests/game-ui-layout.test.mjs` (6) |
| [`src/game/exporters/ui-envelope.js`](../src/game/exporters/ui-envelope.js) | the one export-envelope builder every UI Lab download uses | `tests/game-ui-envelope.test.mjs` (1) |

Routes: `game/ui-lab` (the Lab), `game/9-slice-editor`, `game/button-state-generator`,
`game/missing-glyph-checker`, `game/ui-scale-preview`, and the original `bitmap-font-maker` URL,
which now opens the Font stage. Every route is the same module opened at a different stage.

Memory: the Lab holds one decoded source canvas, at most one cut-out panel, five small state
variants plus their packed strip, and one transient canvas per preview it is currently drawing.
Nothing keeps an RGBA copy per element, per glyph or per preview size.

**Shared settings links.** Every setting that is not asset data is a URL query key, and
*Copy a settings link* (under Advanced in the 9-Slice stage) writes the current ones out:
`?stage=states&l=5&r=7&t=3&b=4&mode=tile&scale=1&w=250&h=90&px=1&cw=8&ch=8&base=0&fmode=grid&pad=3&merge=4&ext=0`.
Opening such a link starts the Lab at that stage with those numbers; the borders apply to the first
image dropped on it. Image data is never put in a URL.

---

## 1. Nine-slice editor

**Input** a panel or button PNG (any size the browser can decode).
**Output** on screen: a pixelated, zoomable editor with four draggable guides, a tinted **and**
diagonally hatched stretch region, and live previews. In the ZIP: the source PNG, one rendered
preview per target size, `nine-slice.json`, `SETUP.md`.

**Borders** are four integers in source pixels (left, right, top, bottom). They can be dragged,
typed, or nudged with the arrow keys (Shift = 10 px) on a focused guide, which is a full keyboard
alternative to dragging. `clampBorders` keeps a guide from crossing its opposite.

**Auto-suggest** (`suggestBorders`): the longest run of consecutive **identical columns** is the
region that can be stretched without changing how the panel looks, so the borders are what lies
outside it; rows likewise. The suggestion is shown as a suggestion — it names the run it came from
("from a run of 12 identical columns and 12 identical rows") and has to be accepted. A panel whose
middle is a gradient has no such run: `confident:false` is reported instead of invented numbers.

**Drawing** (`nineSlicePlan`): one plan of `{region, sx, sy, sw, sh, dx, dy, dw, dh}` ops per target
size, used by the preview and by the exported render — so a corner on screen is the corner in the
file. Corners keep their exact source size (× an integer `scale`), edges either stretch or tile at
their natural size, and the last tile of a row is clipped. A target narrower than `left+right`
squashes its corners proportionally and says so (`narrow` / `short` warnings) instead of drawing
outside the box. Tiling a 1-px middle over a large panel would need one draw call per pixel, so
above 4096 tiles the plan stretches and reports `tileLimit`.

**Export schema** (`nine-slice.json`, envelope from GAME-LABS.md):

```json
{ "meta": {"tool":"nerulio-ui-lab-nine-slice","toolVersion":"1","schemaVersion":1,
           "engineTarget":"generic","image":"panel.png","size":{"w":24,"h":24}},
  "frames": {"panel": {"page":0,"rect":{"x":0,"y":0,"w":24,"h":24},"rotated":false,"aliasOf":null,
              "sourceSize":{"w":24,"h":24},"offset":{"x":0,"y":0},"pivot":{"x":0.5,"y":0.5},
              "duration":null,"tag":"","boxes":[],"collision":[],
              "nineSlice":{"pixels":{"left":6,"right":6,"top":6,"bottom":6},
                           "normalized":{"left":0.25,"right":0.25,"top":0.25,"bottom":0.25},
                           "godot4":{"patch_margin_left":6,"patch_margin_right":6,
                                     "patch_margin_top":6,"patch_margin_bottom":6},
                           "unity":{"border":[6,6,6,6],"order":"left, bottom, right, top"}}}},
  "animations": {},
  "nineSlice": {"mode":"stretch","scale":1,"pixelated":true,
                "previews":[{"width":300,"height":80,"mode":"stretch","scale":1}]} }
```

`SETUP.md` is short prose: Godot 4 `NinePatchRect.patch_margin_*` and `StyleBoxTexture`
`texture_margin_*` (with `axis_stretch_*` = Tile for tile mode), Unity's Sprite Editor border in
its own **L, B, R, T** order with a bottom-left origin, plus Image Type = Sliced/Tiled. No `.tres`,
`.meta` or any other engine resource file is written.

**Limitations.** Pixel-perfect corners require the pixelated (nearest) draw mode, which is the
default; with smoothing on, a 1:1 blit is still expected to be exact but is not asserted. Tile mode
at a non-1 integer scale squashes the final partial tile by up to `(scale-1)/scale` of a source
pixel. Rendering inside Godot or Unity is **UNVERIFIED** here.

## 2. Button state generator

**Input** one button PNG. **Output** five PNGs (`states/normal|hover|pressed|disabled|focus.png`),
one packed strip (`<name>-states.png`) and `states.json`.

Each state is an ordered op list, all of it visible and editable: canvas growth for an outline →
brightness (additive) → contrast (around mid grey) → saturation (towards/away from luma) → colour
overlay → pixel offset → outline (the repo's own `addOutline` from `src/core.js`, a square
neighbourhood) → alpha. Transparent pixels are never recoloured. The panel shows what was applied
("brightness 0.1, saturation 0.08"), so nothing about a variant is hidden. The defaults are a
starting point, not an opinion: hover +10% brightness, pressed −10% and 1 px down, disabled fully
desaturated at 50% alpha, focus a 2 px ring.

This is arithmetic on pixels. It does not draw artwork that is not in the source.

**Export schema.** The same envelope; every frame carries `state` and the strip rect, and
`states.<name>.ops` records the exact numbers used, so a variant can be reproduced.

**Limitations.** Focus grows the canvas by the outline width, so that variant is larger than the
others (its size is in the JSON). The outline is a square dilation, so a 2 px ring fills a 2 px
corner. No per-state nine-slice borders yet — the panel borders are exported from the 9-Slice stage.

## 3. UI atlas and component slicer

**Input** a transparent UI sheet. **Output** `ui-atlas.png` + `ui-atlas.json` (+ `SETUP.md` when any
element has borders).

Elements come from `primitives.components` (8-connected alpha islands above a threshold), then
`mergeRects(rects, distance)` unions boxes whose gap is at most the merge distance, repeating until
nothing merges — so a button and the glyph on top of it become one element instead of two. Each
element can be renamed, removed, or opened in the 9-Slice stage; borders set there are stored on
that element and travel into the envelope. Packing is `packRects` (MaxRects) with padding, and
extrude duplicates the edge pixel outward by N px before packing.

**Export schema.** The envelope, with `frames.<name>.rect` in atlas pixels, `nineSlice` when set,
`tag: "merged"` when the element came from more than one island, and
`packing: {padding, extrude, mergeDistance, alphaThreshold}`.

**Limitations.** Alpha islands are candidates, not semantics: a sheet where two buttons touch is one
element, and a sheet of separated icons on one button is several until the merge distance joins
them. Single page only (no multi-page atlas). Rotation is off.

## 4. Bitmap fonts

**Input** a glyph sheet (fixed grid), or a TTF/OTF chosen from the device — loaded with `FontFace`
from a local `Blob`, never uploaded, and used only in this browser.
**Output** `font.png`, `font.fnt` (BMFont text), `font.json`, `README.txt`, and optionally
`font-sdf.png` + `font-sdf.json` + `font-sdf.txt`.

Three modes, one font object feeding every output:

* **Fixed grid** — unchanged from the original bitmap-font tool: every glyph is its whole cell and
  every advance is the cell width. Exact Unicode coordinates, including non-Latin glyphs.
* **Measured widths** — the opaque bounds of each cell become the glyph rect; `xoffset`/`yoffset`
  put the ink back where it was, `xadvance` is the ink width plus spacing, and an empty cell (a
  space) still advances. No kerning: BMFont kerning pairs need data a bitmap sheet does not carry,
  and inventing them would be a lie.
* **Font file** — the characters are rendered into a uniform grid at a known baseline with canvas
  text, and then that raster is measured by the same tested code, so the sheet in the ZIP is the
  sheet that was measured. Advances come from the font's own `measureText`, not from the ink.

The **character-set builder** takes pasted text and offers: characters used in my text, ASCII (95),
Latin-1 (191), Korean characters in my text, Japanese characters in my text. All 11,172 Hangul
syllables are never added for you — a script preset filters the pasted text, it does not enumerate a
script.

**Export schema** (`font.json`): `{format:"nerulio-bitmap-font-v1", mode, face, size, image, width,
height, lineHeight, baseline, spacing, glyphs:[{char, codepoint, x, y, w, h, xOffset, yOffset,
xAdvance}]}`. `font.fnt` is the documented BMFont text format (`info` / `common` / `page` /
`chars` / `char` / `kernings count=0`) and is read back by `parseFnt` in the same module.

**Limitations.** One page. No kerning. Grid mode needs a sheet whose size divides by the cell size.
Engine import is **UNVERIFIED**.

### SDF (Beta)

A real signed distance field, not a blur: `edt` is the separable exact Euclidean distance transform
(Felzenszwalb–Huttenlocher), unit-tested against a brute-force O(n²) reference. Each glyph's own
padded cell is rasterised at 4×, transformed alone (so a neighbour can never bleed into its ramp),
downsampled at block centres with the distance converted to output-pixel units, and encoded with
**128 = the contour**, positive inside. The distance goes into R, G and B with alpha left at 255,
because a canvas does not preserve colour bytes under a low alpha; `font-sdf.txt` carries the one
line of shader maths needed to get the shape back. Labelled Beta in the UI.

**MSDF is not shipped.** A multi-channel field needs contour decomposition from outlines, which this
module does not do; calling a single-channel field "MSDF" would be false.

## 5. Checks

Four tabs over the same asset.

* **Missing glyphs.** Paste text or drop `.txt`, `.json`, `.csv`, `.tsv`, `.po`; the text inside the
  structure is unwrapped (all JSON string values, `msgstr` values, all CSV cells) and compared with
  a glyph list from either this Lab's font or an uploaded `.fnt`. Output: every missing character
  with its count and the first lines it appears on, plus `missing-glyphs.json` and a plain list.
  **A TTF's `cmap` table is not parsed** — a robust parser (formats 4, 12, surrogates) is not in
  this release, so a font file is not accepted as the glyph source, and the UI says so.
* **Sizes and anchors.** The element is drawn through its nine-slice plan inside a simulated screen
  at 1280×720 / 1920×1080 / 2560×1440 / 3840×2160 and 4:3 / 16:9 / 16:10 / 21:9, positioned by an
  anchor preset. The anchor maths are Godot 4's four `anchor_*` numbers (Unity's RectTransform
  presets are the same numbers), labelled in the UI as a conceptual simulation — no engine ran a
  layout pass. **Safe areas**: 90% title-safe and 93%/95% action-safe — the long-published broadcast
  television convention, cited for what it is under *Sources* below — plus custom insets. Console
  TRC and phone cut-out values are device-specific and are **not** shipped as presets.
* **Scale.** The same element at 1×, 1.25×, 1.5×, 1.75×, 2×, 2.5×, 3×, side by side, integer scales
  labelled crisp; the fractional ones are drawn the way a UI at that scale draws them, which is what
  the softness in the comparison is.
* **Localisation overflow.** KO/EN/JA strings in a box of a given size and font size: the width is
  measured with canvas `measureText`, wrapping is the greedy breaker in `ui-layout.js` (per word,
  or per character for text without spaces), and each language gets `fits` / `wraps` / `too tall` /
  `overflows` / `truncated` with the measured pixels. Measured with a browser font — a game font has
  different widths, which the note says.
* **Contrast.** The WCAG relative-luminance formula, exactly: black on white is 21:1, `#767676` on
  white is 4.54:1. AA / AAA / UI 3:1 are shown as reference levels, with the large-text exception
  (≥24 px, or ≥18.66 px bold). A ratio is a number about two colours, not a verdict on a design.

**Sources for the safe-area presets.** 90% title-safe and 93–95% action-safe are the long-published
broadcast television convention — the numbers TV-safe overlays in editors and broadcast style guides
have used for decades. **No standards document was consulted while writing this release**, so treat
them as that convention and nothing stronger; they are not a platform requirement. Console TRC and
phone cut-out values are device-specific, are not published in a form this tool can cite, and are
therefore not shipped as presets: those go in custom insets.

---

## Verification

Measured on this branch, Chromium (Playwright) at 1440×1000 and phones at 390/320, Windows 11.
Unit tests: `node --test tests/*.test.mjs` (1266 pass, of which 32 are the modules above).
Browser: 31 UI Lab checks appended to `tests/task-browser.py` (173 pass in total) and the ported
bitmap-font check in `tests/recipes-browser.py` (43 pass in total), both re-opening every download
with Pillow / zipfile / an independent BMFont parser written inside the test.

| # | What was measured | Result | Status |
|---|---|---|---|
| 1 | Exact EDT vs a brute-force reference on 13×9, 1×7 and 8×8 random masks | every cell equal | VERIFIED |
| 2 | Signed field on a radius-15 disc: sign, contour, monotonicity along a ray | \|d\| ≤ 0.75 at the contour, positive inside, never increasing outwards, within 1.1 px of the analytic distance | VERIFIED |
| 3 | Corner fidelity: 6×6 corner blocks of every exported preview vs the source | byte-identical at 100×40, 300×80, 800×200 and 420×120 | VERIFIED |
| 4 | Nine-slice coverage: destination rects of a plan | 0 gaps, 0 overlaps at 300×80, at scale 3, and when squashed to 8×4 | VERIFIED |
| 5 | Tile vs stretch on a striped 12×12 panel | tiles repeat the 4 px source period; stretching makes columns 4 and 6 identical | VERIFIED |
| 6 | Border suggestion on a generated panel (6 px borders) | 6 · 6 · 6 · 6 from a run of 12 identical columns / 12 rows | VERIFIED |
| 7 | Keyboard alternative | two `ArrowRight` = +2 px, `Shift+ArrowLeft` = −10 px and clamps to 0 | VERIFIED |
| 8 | State ops on a 40×16 button | normal byte-identical to the source; hover brighter; pressed offset 3 px with the vacated rows cleared; disabled grey at alpha 128; focus 44×20 with a #3182f6 ring and untouched artwork | VERIFIED |
| 9 | States strip | all five rects in `states.json` cut exactly that state's PNG out of the strip | VERIFIED |
| 10 | Element detection on a 128×64 sheet (one button with a transparent hole) | 4 elements; merge distance 40 joins them | VERIFIED |
| 11 | Atlas pixels | the packed element equals the source rect; extrude 1 duplicates the edge pixel outside the rect; `packing` recorded | VERIFIED |
| 12 | Element → 9-slice → back | borders 5/5/4/4 survive on that element and appear in `ui-atlas.json` | VERIFIED |
| 13 | Fixed-grid font (the original guarantee) | `char id=12354 x=8 y=0 width=8 height=8`, `glyphs[1].codepoint == 12354`, font.png 16×8 | VERIFIED |
| 14 | `.fnt` read back by an independent parser in the test | header (lineHeight 8, base 6, scaleW 16, page file, unicode 1) and all glyph records equal the JSON; every rect inside the atlas | VERIFIED |
| 15 | Measured mode | every glyph rect is tight around its ink; ≥3 distinct advances; the empty cell still advances | VERIFIED |
| 16 | Arial 24 px, 6 glyphs | tight rects for all inked glyphs; `xadvance(W) > xadvance(i)`; space > 0 | VERIFIED |
| 17 | SDF plumbing on the largest Arial glyph | ≥90% of inked pixels ≥ 128 and ≥90% of empty pixels ≤ 128; alpha 255; falls off with distance | VERIFIED |
| 18 | Missing glyphs from a `.po` against a 4-glyph `.fnt` | exactly `a 시 작 끝 내 기`, counts and line numbers; `가` (present) not reported | VERIFIED |
| 19 | Safe area at 3840×2160, title-safe | 192, 108 · 3456×1944 (90%, centred) | VERIFIED |
| 20 | Anchors at 3840×2160, top-left with a 64 px margin | element at 64, 64 | VERIFIED |
| 21 | Localisation overflow, 120 px box | EN "Continue playing this very long label" overflows, KO sample fits; wrapping changes the verdict | VERIFIED |
| 22 | Contrast | black/white exactly 21:1 with AA, AAA and UI 3:1 passing; `#767676`/white 4.54:1 | VERIFIED |
| 23 | Phones | no horizontal scroll on all five stages at 390 px and 320 px, ko and ja | VERIFIED |
| 24 | Console | no page errors and no console errors across all 83 scripted interactions | VERIFIED |
| 24b | A shared settings link | `?stage=states&l=5&r=7&t=3&b=4&mode=tile&w=250&h=90` opens the States stage with those borders, tile mode and that custom size; the copied link round-trips | VERIFIED |
| 25 | ASCII-95 @32 px measured atlas from a TTF | 28 ms to build, 350×380 sheet, 63 KB ZIP | VERIFIED |
| 26 | The same atlas with per-glyph SDF (spread 8, 4× raster) | 1174 ms for the export, 77 KB SDF PNG | VERIFIED |
| 27 | 1024×1024 sheet with 40 elements | 76 ms to detect, merge, pack and draw; 840×825 atlas | VERIFIED |
| 28 | Repaint after a border change (editor + previews up to 1600×900) | median 15 ms of [21, 15, 14, 22, 12] | VERIFIED |
| 29 | Godot 4 import of the exported PNG + JSON + setup notes | not run — Godot was not executed for this release | **UNVERIFIED** |
| 30 | Unity import of the PNG and the L,B,R,T border numbers | not run — no Unity here, and no `.meta` is written | **UNVERIFIED** |
| 31 | SDF texture rendered by a real shader in an engine | not run; the encoding and the shader line are documented, the result is not proven | **UNVERIFIED** |
| 32 | Firefox / WebKit | not run for this Lab; Chromium only | **UNVERIFIED** |

### Deliberately not implemented yet

* **Undo/redo.** Borders, state ops and element names are all directly editable numbers, so there is
  no history stack; a mis-drag is corrected by typing the number back.
* **Cancellation.** Every operation except the SDF export finishes in well under a second (see the
  timings above), so nothing here takes an `AbortSignal` yet; the 1.2 s SDF export for 95 glyphs
  does not report progress and cannot be cancelled.
* **"Continue with" hand-off chips** after an export (other task pages have them).

### Not in this release

* No TTF `cmap` parsing, so the missing-glyph checker does not accept a font file as its glyph
  source (a `.fnt` or the Lab's own font only).
* No MSDF.
* No kerning pairs, no multi-page font atlas, no multi-page UI atlas.
* No per-state nine-slice borders, and no `.tres` / `.meta` / any engine resource file — by design.
