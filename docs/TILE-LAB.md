# Tile Lab

One workspace (`src/task/tile-lab.js`) for a 2D tileset: **measure the grid → slice → autotile
templates → paint terrain and watch the rules choose tiles → see what the sheet is missing →
check a repeating texture's seams → export a Godot 4 pack.** The stages are views over one
decoded sheet; nothing is re-uploaded between them and nothing leaves the device.

The point of the Lab is the thing an artist normally only discovers inside Godot or Tiled: *do my
terrain rules actually work, and which tiles am I still missing?*

Pure logic lives in `src/game/tile-grid.js`, `src/game/autotile.js`, `src/game/seams.js` and
`src/game/godot-tileset.js` (no DOM), with `node:test` coverage in `tests/game-tile-grid.test.mjs`
(14), `tests/game-autotile.test.mjs` (9), `tests/game-seams.test.mjs` (4) and
`tests/game-godot.test.mjs` (6). Browser coverage is the Tile Lab block in `tests/task-browser.py`
and the two ported checks in `tests/recipes-browser.py`.

## Routes

| URL | Opens | Notes |
|---|---|---|
| `game/tile-lab` | the Lab, grid stage | the flagship entry |
| `game/tileset-slicer` | grid stage | slice a sheet into tiles + JSON |
| `game/autotile-tester` | tester stage | paint terrain, rules pick tiles |
| `game/seamless-tile-checker` | seams stage | one texture; the default tile is the whole image |
| `game/tile-helper` (`tile-grid-slicer`) | grid stage | pre-existing id, URL unchanged |
| `game/atlas-padding` (`atlas-edge-extrusion`) | grid stage, extrude = 2 | pre-existing id, URL unchanged |

`?stage=`, `?kind=`, `?tileWidth=`, `?tileHeight=`, `?marginX=`, `?spacingX=`, `?gridSize=` and
`?seed=` are shareable presets. Image data is never put in a URL.

## 1. Grid detection

* **Input** any image the browser can decode; automatic measurement runs up to `ANALYSIS_PIXELS`
  (4 MP), above which the tile size is typed in by hand.
* **Output** a ranked list of candidates — tile size, margin, spacing, columns × rows — each
  showing the numbers it was ranked on. Nothing is applied silently; the first candidate is
  pre-filled and every field stays editable.
* **Algorithm** (`axisProfile`, `periodStrength`, `axisRanking`)
  1. Per axis, a transition profile: the mean absolute channel difference between each line and
     the line before it (alpha weighted double), plus whether each line is blank or flat, plus how
     often drawn content continues across it.
  2. **Periodicity.** The profile is folded at every period from 4 to half the axis and the
     between-bucket share of its variance is measured (one-way ANOVA explained variance, adjusted
     for degrees of freedom so a huge period cannot win by having a bucket per line). This is what
     makes detection work on art whose tile interiors are busier than its tile boundaries — the
     case where an "is this line an outlier" threshold finds nothing at all.
  3. **Phase.** All of a layout's tile starts share one residue class of the fold; with a
     separator, the line where content stops shares another. Both must stand above the folded
     average.
  4. **Separators.** Every line a margin/spacing layout reserves must really be blank or flat.
     Declaring a gap that is neither is evidence *against* the reading, not missing evidence.
  5. **Undeclared gaps.** If the first or last line of every tile is blank, the real tile is
     smaller and that line is separation — which is how "16px + 1px gap" beats "17px tiles".
  6. **Harmonics.** A multiple of the true period explains the sheet just as well (its boundaries
     are a subset), so a candidate loses when one of its own divisors scores within 0.02 of it.
  7. Axis candidates are combined, square and common (8/16/24/32/48/64) sizes get a small bonus,
     and the pair is capped at `MAX_FRAMES` tiles.
* **Limitations** a sheet with one tile per axis cannot be measured (there is no period), and is
  offered as a single-tile reading with a penalty. Sprites scattered without a grid belong in the
  sprite slicer. Detection is a measurement, not a promise: the score is shown so a wrong first
  guess is visible and one click away from being replaced.

## 2. Tileset slicer

* **Input** a sheet plus the grid (tile size, margin, spacing).
* **Output** `tiles/tile-NNN.png` per tile, `metadata.json`, optionally `variants/…` and
  `padded-atlas.png`, in one ZIP.
* **Algorithm** `tileRects` computes exact integer rectangles; each tile is `cropRGBA`'d from the
  decoded sheet (an exact region copy, never a resample) and encoded as PNG. Tile pixels are
  cropped on demand and cached by index, so a sheet is never held as N full RGBA copies.
  * *Blank skipping* — a tile whose every alpha is 0 is left out (counted in `skippedBlank`).
  * *Duplicates* — exact by 32-bit FNV-1a hash of the RGBA bytes; near-exact by mean/worst
    per-pixel difference against group representatives, labelled in the UI as a pixel threshold
    and not as a judgement of similarity. Aliases are computed only over the tiles that get
    written, and are recorded in `metadata.json` (`aliases`, `deduplicated`, `dedupeMode`).
  * *Variants* — 90°/180°/270°/flipX/flipY, with variants a symmetric tile turns into itself
    dropped by comparing hashes (a four-fold symmetric tile produces none).
  * *Padded atlas* — nine blits per tile (the tile, its four edges stretched outwards, its four
    corner pixels), the same geometry the `atlas-padding` recipe produced.
* **Limitations** regular grids only. Near-duplicate clustering is capped at 2048 tiles.
* **Export schema** the envelope from `docs/GAME-LABS.md` plus the tile grid:

```json
{ "meta": {"tool":"nerulio-tile-lab","toolVersion":"1","schemaVersion":1,"engineTarget":"generic",
           "image":"terrain.png","size":{"w":128,"h":96}},
  "tileSet": {"tileSize":{"w":16,"h":16},"margins":{"x":1,"y":1},"separation":{"x":2,"y":2},
              "columns":5,"rows":3,"count":13,"skippedBlank":2,"deduplicated":1,
              "dedupeMode":"exact","aliases":{"tile-011.png":"tile-000.png"}},
  "frames": {"tile-005.png": {"page":0,"rect":{"x":19,"y":19,"w":16,"h":16},"rotated":false,
              "aliasOf":null,"sourceSize":{"w":16,"h":16},"offset":{"x":0,"y":0},
              "pivot":{"x":0.5,"y":0.5},"duration":null,"tag":"","boxes":[],"collision":[],
              "tile":{"index":5,"col":1,"row":1}}} }
```

## 3. Autotile templates

Four different things people all call "autotile". They are **not** interchangeable:

| Kind | Tiles | Matches on | Notes |
|---|---|---|---|
| `minimal9` | 9 | the 4 sides | cannot draw a one-tile-wide strip or a lone tile: 7 of the 16 side masks have no tile, by construction (`unrepresentable`) |
| `edge16` | 16 | the 4 sides | every combination; complete |
| `corner16` | 16 | the 4 corners | a **dual grid**: the tile drawn at (x,y) shows the four cells meeting at its top-left point, so the tile grid sits half a tile off the terrain grid |
| `blob47` | 47 | 8 neighbours | a corner only counts when both of its edges are also set, which maps all 256 raw masks onto exactly 47 classes |

* **Input** the kind and a tile size (8–256 px).
* **Output** `<kind>-template.png` (clean guide art at the chosen size),
  `<kind>-template-labelled-Nx.png` (the same sheet enlarged with slot numbers and mask names) and
  `<kind>-layout.json`.
* **Algorithm** the rule sets are data (`src/game/autotile.js`): every slot carries its
  8-neighbour mask, its edge/corner flags, its role (`isolated`, `end`, `corner`, `corridor`,
  `tee`, `inner-corner`, `full`, …) and its cell in the sheet. Guide art draws the body, a rim on
  every side with no neighbour, and a rim block in every corner that is a real inner corner.
  `layoutFromJSON` reads a layout back and **refuses** a table that disagrees with the rules.
* **Limitations** this is guide art to paint over, not finished tiles. Bit order is
  N 1, NE 2, E 4, SE 8, S 16, SW 32, W 64, NW 128 (y down) and is published in the JSON as
  `bitOrder`.

## 4. Autotile live tester

* **Input** a kind (or an imported layout JSON), tile art (the uploaded sheet, or the template
  guide art when the sheet cannot cover the layout), and terrain painted on a grid.
* **Output** a live render, on screen. Paint/erase with mouse or touch, fill, clear, seeded random
  fill, zoom, optional grid lines; arrow keys move a cursor, Space paints or erases, F fills, and
  Backspace flood-fills — the canvas is never mouse-only.
* **Algorithm** for each cell, `maskAt` builds the 8-neighbour mask and `slotFor` reduces it to the
  slot the chosen kind requires (`sideIndex` for side sets, `reduceMask` for blob, the four corner
  samples for the dual grid). A cell whose rule has no tile is drawn as a labelled cross-hatched
  ghost and counted — that count *is* the feature.
* **Limitations** one terrain at a time: it does not model transitions between several terrains,
  and it does not reproduce an engine's own matcher. `corner16` renders (w+1)×(h+1) cells offset by
  half a tile; Godot does not offset a layer for you, so that offset has to be baked into the art.
* Terrain is one byte per cell (`Uint8Array`), so state is small and cheap to snapshot.

## 5. Rule visualiser and completeness check

* **Input** the sheet, the chosen kind and the slot the sheet's first tile fills (`offset`).
* **Output** an overlay on the sheet — per tile its slot number and its peering bits as marks at
  the eight neighbour positions (position and number, never colour alone) — plus a list of missing
  slots drawn as ghost cells with their index, mask name and role, a count of slots claimed by
  pixel-identical tiles, and a small seeded random map preview.
* **Algorithm** `completeness(kind, assignments)` returns missing slots and duplicate claims;
  blank tiles are not counted as present; pixel-identical tiles are found by hash.
* **Limitations** the preview is **not a map generator** — it exists to surface missing slots and
  ugly transitions, and it says how many cells had no tile.

## 6. Seams

* **Input** one tile (the whole image on the `seamless-tile-checker` route, or any tile of a sheet).
* **Output** a 2×2 / 3×3 repeat preview, the left↔right and top↔bottom mean and worst difference,
  an edge heatmap, a verdict, an optional edge match against a second tile, and a "make seamless"
  save.
* **Algorithm** every wrap difference is reported next to *the same measurement taken between two
  ordinary neighbouring lines inside the tile*: "the wrap differs 6× as much as a normal
  neighbour" is actionable, "mean 23.4" is not. The verdict is
  `mean ≤ max(2, neighbourMean × 1.25)` on both axes. The heatmap is scaled against that
  neighbour difference, not against the profile's own maximum (which would paint a perfectly
  seamless tile solid red). `makeSeamless` offsets by half the tile (`primitives.offset`) so the
  wrap seam lands in the middle, then cross-fades across it with the half-shifted copy.
* **Limitations** the seamless helper **alters the art** inside the blend bands and synthesises
  nothing; the page says so and shows before/after. A tile smaller than 2×2 cannot be measured.

## 7. Godot 4 helper

Godot 4 replaced the Godot 3 autotile bitmask with **terrains**. In 3.x a tile carried a bitmask of
its own regions (2×2, 3×3 or 3×3-minimal) and the TileMap matched those flags against the same tile
id. In 4.x a TileSet owns terrain *sets*; each set has a match mode (Match Corners and Sides /
Match Corners / Match Sides) and a list of terrains, and each tile says which terrain it belongs to
plus, per neighbour position, which terrain it expects there (a *peering bit*). So a 3.x
"3×3 minimal" tileset corresponds to a 4.x **Match Sides** terrain using the four side peering
bits, and a 47-tile blob corresponds to **Match Corners and Sides** using all eight. Peering
positions are named after `TileSet.CellNeighbor`; on a square tile shape only the four sides and
the four diagonal corners exist.

* **Input** the sheet, the grid, the kind, a terrain name and (optionally) an explicit mode.
* **Output** a ZIP: the PNG, `nerulio-tileset.json`, `nerulio_tileset_import.gd` and `README.txt`.
  **No `.tres` is ever written by the browser.**
* **Export schema**

```json
{ "meta": {"tool":"nerulio-tile-lab","toolVersion":"1","schemaVersion":1,
           "engineTarget":"godot-4","image":"terrain.png","size":{"w":128,"h":96}},
  "tileSet": {"tileSize":{"w":16,"h":16},"margins":{"x":0,"y":0},"separation":{"x":0,"y":0},
              "columns":8,"rows":6,
              "autotile":{"kind":"blob47","slots":47,"dualGrid":false},
              "terrainSets":[{"mode":"match_corners_and_sides",
                              "terrains":[{"name":"Terrain","color":"#4caf50"}]}],
              "tiles":[{"atlas":{"x":3,"y":1},"terrainSet":0,"terrain":0,
                        "peering":{"top_side":0,"right_side":0,"bottom_right_corner":0},
                        "slot":{"index":11,"kind":"blob47","key":21,"mask":21,
                                "name":"NES","role":"tee"}}]} }
```

  `atlas` is the tile's column/row in the sheet (Godot's atlas coordinates). A peering entry's
  value is the terrain index expected at that neighbour; a position that is absent means "no
  terrain" (`-1` in the engine).
* **Algorithm** the importer is an `EditorScript`, so it runs inside the editor that owns the
  format and builds the resource through the public API: `TileSet.new()`, `add_terrain_set`,
  `set_terrain_set_mode`, `add_terrain`, `TileSetAtlasSource` with `texture_region_size`,
  `margins`, `separation`, then per tile `create_tile`, `terrain_set`, `terrain` and
  `set_terrain_peering_bit`, saved with `ResourceSaver.save`. The work lives in an inner `Builder`
  class because Godot cannot run an `EditorScript` from `--script`; the README shows the six-line
  `extends SceneTree` wrapper that drives the same code headlessly.
* **Limitations** one terrain set with one terrain. Alternative tiles, animation frames, occlusion,
  navigation and physics layers are not written. A `corner16` dual grid needs the half-tile offset
  baked into the art. Nothing here claims Unity support.

## Verification

Measured on this branch, not asserted from reading the code.

| What was measured | How | Numbers | Status |
|---|---|---|---|
| Blob reduction is exactly 47 classes and total over all 256 masks | `tests/game-autotile.test.mjs` | 256 → 47, `slotFor` defined for all 256 | VERIFIED |
| `edge16` / `corner16` are exactly 16, `minimal9` is 9 with 7 unrepresentable side masks | same | 16/16/9, 7 | VERIFIED |
| Template slot ↔ mask table round-trips, and a doctored table is refused | same | 4 kinds, 88 slots | VERIFIED |
| A painted 3×3 block picks the expected slot indices | same | minimal9 inner cells = slots 0…8; blob centre mask 255; dual grid 4×4 offset −0.5 | VERIFIED |
| A complete 47-blob fixture reports 0 missing; one with 3 removed reports exactly those 3 | same + `tests/task-browser.py` | missing = [5, 17, 40] | VERIFIED |
| Grid detection on 10 synthetic sheets (margin 1/spacing 2, odd 15px, non-square 16×32, strips, 8px, outlined tiles whose interiors are louder than their boundaries) | `tests/game-tile-grid.test.mjs` + scratch probe | true grid ranked first in 10/10; margin1+spacing2 scores 1.00, plain 32px 0.91, outlined 16px 0.63 | VERIFIED |
| A sheet whose size 8, 16, 32 and 64 all divide resolves to its real 32px period | same | score(32) > score(16)+0.1 and > score(64)+0.1 | VERIFIED |
| Every sliced tile equals its source region pixel for pixel (margin 1, spacing 2, blanks, a duplicate) | Chromium + Pillow (`scratchpad/verify.py`) | 13/13 tiles byte-identical; rect ↔ col/row consistent | VERIFIED |
| Blank skipping, exact aliases, rotate/flip variants | same | 47 of 48 written, 1 blank skipped; 1 alias; 60 variants; rot90/flipX match Pillow's own transforms | VERIFIED |
| Padded atlas geometry (the `atlas-padding` contract) | same + `tests/recipes-browser.py` | 2×1 of 1px tiles + 1px extrude → 6×3, edge pixels isolated | VERIFIED |
| All four template PNGs against their layout JSON | same | 9/16/16/47 cells drawn exactly where the JSON says | VERIFIED |
| Tester renders the tile the rule requires (pixels read back from the canvas) | `tests/task-browser.py` | filled area centre = slot for mask 255; corner = slot for E\|SE\|S; keyboard paint = slot for W | VERIFIED |
| Seam verdicts | same + `tests/game-seams.test.mjs` | cos-wrapping tile: ratio < 1.3 → seamless; ramp: mean > 240, ratio > 20 → seam; after `makeSeamless` mean < 8 | VERIFIED |
| Godot pack contents and peering bits recomputed from the masks | `scratchpad/verify.py` | 47 tiles, 8 bits on the full slot, 0 on the isolated slot, no `.tres`/`.meta` in the ZIP | VERIFIED |
| **The exported pack builds a real TileSet in Godot** | Godot **4.7.2.stable.official** (`godot --headless --path <proj> --import`, then `--script res://run_import.gd` driving the shipped `Builder`, then an independently written verifier) | see below | see below |

### Godot run

Reproduce with `scratchpad/godot_check.py <pack.zip>` (the harness writes the project, the
`extends SceneTree` wrapper and the verifier; the importer is the file the Lab shipped).

**Godot 4.7.2.stable.official (ed1daf0bf), Windows x86-64 console build, 2026-09-22.** Two packs
exported by the Lab in Chromium were run and then checked by a verifier that declares the
`TileSet.CellNeighbor` table again itself, so a wrong name in the importer cannot verify itself:

| Pack | Importer result | Verifier |
|---|---|---|
| `blob47`, 16px tiles, 128×96 sheet, no margin/spacing | `Saved res://nerulio-tileset.tres: source 0, 47 tiles, 188 peering bits, mode match_corners_and_sides` | reloaded the `.tres` with `CACHE_MODE_IGNORE`; **376 peering bits compared (47 × 8), 0 mismatches**; tile size, mode, terrain name, margins, separation and tile count all matched the JSON. `RESULT PASS fails=0` |
| `edge16`, 16px tiles, 72×72 sheet, margin 1, spacing 2 | `Saved …: source 0, 16 tiles, 32 peering bits, mode match_sides` | `RESULT PASS fails=0` — margins `(1,1)` and separation `(2,2)` reached `TileSetAtlasSource` |

Commands:

```
godot --headless --path <proj> --import
godot --headless --path <proj> --script res://run_import.gd   # drives the shipped Builder class
godot --headless --path <proj> --script res://run_verify.gd   # independent comparison
```

So the Godot 4 export is **VERIFIED** for `blob47` and `edge16` (with and without margin/spacing).
`minimal9` and `corner16` go through the same code path with fewer peering bits and were **not**
run in the engine; the dual-grid half-tile offset for `corner16` is a property of the art, which
this check cannot judge. The `File > Run` route inside the editor GUI was not exercised — only the
same `Builder.build()` the menu item calls.

## Not done

* No animated tile builder (frames → strip + JSON) and no per-tile collision shapes; the export
  envelope already carries `duration`, `boxes` and `collision` fields for them.
* Multi-terrain transitions (grass → sand → water in one set) are not modelled anywhere.
* Unity/Tiled exports do not exist. Only the Godot 4 helper does.
* The Lab has no undo for painted terrain (fill/clear/random are one click away, and the grid is
  one byte per cell, so a snapshot stack is cheap to add later).
* Near-duplicate detection is a pixel threshold, not perceptual.
