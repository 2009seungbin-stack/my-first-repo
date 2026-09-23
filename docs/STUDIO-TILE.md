# Studio · Tile workspace (P3)

`/game/studio/?ws=tile` (all language prefixes). The workspace that ends hand-setting autotile
rules: **import a sheet → the Studio recognises its layout from the pixels → every tile gets its
peering bits (or you paint them, or the pixels suggest them) → a check that never claims "complete"
without measuring → a test map drawn exactly as Godot or Tiled will draw it → engine files that were
loaded in the engine.** It plugs into the Studio through the workspace API (`docs/STUDIO.md`) and
uses only `ctx`; document state lives in `doc.settings.tile`, so every edit is one undo step,
autosaves and is saved in `.nerulio` files without a change to the project format.

## Code

| Where | What |
|---|---|
| `src/game/tiles/patterns.js` | Canonical tile description `[t, n, ne, e, se, s, sw, w, nw]` (terrain per position, -1 = none) — Godot-shaped, so every layout, painted bits and several terrains map onto it. Modes `corners-and-sides` / `sides` / `corners`; cr31 / edge / corner mask conversions; required patterns; completeness (missing, duplicates, corner bits behind open sides); `idealAt` (what a map cell wants). |
| `src/game/tiles/layouts.js` | 12 published layouts as data (below) + sub-tile sources (RPG Maker A2, A4 wall, five-tile). |
| `src/game/tiles/identify.js` | Layout identification by seam continuity; multi-block / multi-terrain clustering; RPG Maker size hints; bit suggestion from pixels; art-vs-bits check. |
| `src/game/tiles/godot-terrain.js` | Port of Godot 4's `set_cells_terrain_connect` matcher (constraints, priorities, painting order, pattern ordering, the empty pattern). |
| `src/game/tiles/generator.js` | Quarter-exact assembly (A2, Blobsmith, A4 wall, five-tile, procedural rim) → blob-47 / edge-16; dual-grid 16 from the same quarters; A-over-B transitions; sheets in any layout; provenance. |
| `src/game/tiles/model.js` | The tileset model (JSON) and its pure edits, collision shapes. |
| `src/game/tiles/{godot-export,tiled,ldtk,unity,exports}.js` | Writers. |
| `src/studio/workspaces/tile/` | `index.js` (workspace), `state.js` (document state, test maps), `resolve.js` (what an engine draws per map layer), `tile-worker.js` (pixel work), `strings.js` (ko/en/ja), `tile.css`, `verify-status.js` (labels shown next to each export). |
| `tools/engine-verify/tile/` | Corpus run and engine checks: `corpus_tiles.mjs`, `run_all.py`, `godot_tile.py` + `terrain_probe.gd`, `tiled_check.py`, `ldtk_check.py`, `unity_tile.py` + `unity/NerulioTileProbe.cs`, `cases.mjs` (the maps every engine paints). |

Tests: `tests/tiles.test.mjs` (16, engines incl. real CC0 art and recorded Godot picks),
`tests/studio-tile.test.mjs` (4, strings parity, map state, resolver), `tests/studio-tile-browser.py`
(45 checks in Chromium on real CC0 sheets; part of `tools/regression.py`). Fixtures:
`tests/fixtures/tile/` (CC0, see `SOURCES.md`).

## The workflow in the UI

1. **Tileset panel** — grid candidates measured from the pixels (`src/game/tile-grid.js`) *and*
   the sizes at which a published layout fits exactly (a size where GameMaker-47 fits is ranked
   first, with its confidence). The best one is only a dashed preview; **Use this grid** applies.
   Blank tiles are counted and dimmed. Several tilesets per project (one per sheet), listed.
   Match mode, terrains (name, colour, add/remove; `[` `]` switch).
2. **Layout & bits panel** — every known layout is scored at every placement; top candidates with
   confidence, seam score, placement, missing/extra cells, and a warning when a layout explains only
   part of the sheet. Clicking one shows a preview on the canvas; **Apply** (Enter) writes the bits
   (one undo step). Sheets with several blocks (a dual-grid pack) come with their terrains
   recognised (plain fills that are the same picture = the same terrain). RPG Maker sheets named
   by their size offer "Assemble from this block". Other ways: fill from any layout template at the
   selected tile, or **Suggest bits from pixels** (preview first).
3. **Bits tool (B)** — click or drag over the 9 zones of a tile; right-click/Alt clears; one stroke =
   one undo step. **Select (V)**, **Tile panel**: 3×3 bit editor for all selected tiles, full / clear /
   rotate (R) / mirror, copy/paste bits (Ctrl+C/V), probability. **Collision (C)**: shapes from alpha
   (outline, exact rectangles, box), drag points, double-click an edge to add, Alt+click to remove.
4. **Check panel** — per terrain: combinations present / expected, the missing ones drawn as ghost
   tiles, duplicates (clickable), corner bits behind open sides, and the art-vs-bits check. The
   verdict is **Complete** only when every combination has one tile, nothing is invalid, and the art
   check was *measured* and found no contradiction. "Not measured" is said as such, never as ✓. The headline always names the first open item (missing combinations, invalid bits, duplicates, art contradictions, or "could not measure"); for a generated set it says the art check does not apply because its pixels come byte-exact from the source.
5. **Test map (M)** — a new map starts with a painted island (lake, peninsula, islet) so the autotiling shows at once; maps with layers (each with its tileset), brush (P) with sizes, eraser (E),
   fill (G), pick (I), random fill the set can draw, clear, resize. The map is drawn with the
   **Godot rule** (one `set_cells_terrain_connect` per terrain, row-major — the port that equals
   Godot 4.7.2 cell for cell) or the **Tiled rule** (exact Wang match; corner sets on grid points,
   half a tile off). Cells where the engine leaves a hole or substitutes a tile are outlined and
   listed; hovering a cell shows the tile and why.
6. **Generator** — pick a source kind and its block on the sheet, choose blob-47 layout or dual
   grid, optionally a terrain-B tile for transitions → a new image asset + its tileset, linked to
   the source. The linked set shows a pixel editor over the source block: every stroke re-assembles
   the set and replaces both images in **one** undo step; hovering a quarter says how many generated
   tiles use it.
7. **Export (Ctrl+E)** — Godot 4, Tiled, LDtk, Unity, generic PNG+JSON in one ZIP, each target labelled
   with what it was verified with (and `NOTES.txt` in the ZIP says the same).

Keyboard: V select · B bits · C collision · P brush · E eraser · G fill · I pick · M sheet/map ·
`[` `]` terrain · Shift+`[` `]` brush size · R rotate bits · Ctrl+C/V bits · Enter apply preview ·
Delete clear selected tiles · Ctrl+E export · arrows move the tile selection · `,` `.` step tiles.

## Layout identification (how, and how well)

A layout is a claim about which tiles may sit side by side. If A's right side connects and B's left
side connects, the layout claims A|B is seam-free; if only one connects, a visible break. Each
boundary is split into its two corner segments and its middle (a corner shows a rim unless the
quarter behind it is "full"), and the pixel difference across every claimed boundary is compared:
the score is the probability that a "continuous" boundary is smoother than a "broken" one (ROC AUC;
1.0 = perfect, 0.5 = no information). Two readings of the rims are scored and the better one kept.
Only boundary pixels count, so index numbers printed on templates do not matter. Placements: every
position on small sheets, the layout's own block grid on large ones; a quick sampled pass, then a
full pass on the best six per layout. Confidence: high = AUC ≥ 0.97, nothing missing, clear margin;
medium = AUC ≥ 0.88; else low.

| Layout id | Names |
|---|---|
| blob47-cr31-ascending | cr31 ascending ID (8×6), Nerulio Tile Lab blob47 |
| blob47-wangblob-7x7 | cr31 wang blob 7×7 (Tiled's wangblob) |
| blob47-caeles-7x7 / -8x6 | caeles seamless template II |
| blob47-gamemaker | GameMaker Studio 2 47-tile autotile |
| blob47-godot3-12x4 | Godot 3 "3×3 minimal" template (sampled from the godot-docs 3.5 image: 47 masks + 1 blank) |
| edge16-cr31 / edge16-binary | 16 side tiles |
| corner16-cr31 / corner16-binary | 16 corner tiles = cr31 2-corner = Godot 3 "2×2" = dual-grid 4×4 (jess::codes / GlitchedinOrbit) |
| box9 | 3×3 box, sides only |
| edge16-8x2 | the 16 side tiles in one 8×2 strip (Blobsmith's 16 export) |
| sources | RPG Maker MV/MZ A2 (2×3), Blobsmith base (2×3, inner corners top-left), A4 wall (2×2), five-tile (1×5); a lone 2×3 block is named by its size |

Tilesetter's output layout is not published; a Tilesetter sheet is recognised only when it matches
one of these, otherwise bits come from the pixels or are painted.

**Bit suggestion without a layout.** For each tile, each side's middle and each corner's short
segments are measured against a reference "full" tile two ways (boundary continuity, and colour-band
histograms for textured art), split into connect/open by Otsu on a linear or log scale; corners
only where both sides connect. The reference tile, the measurement and the scale are chosen by which
reading best explains the seams of the whole set (the same AUC). The art check is supervised: it
finds the threshold that best separates the given bits and reports only bits that threshold gets
wrong by a clear margin.

## Results on the corpus (identified from the pixels, no hints)

`node tools/engine-verify/tile/corpus_tiles.mjs test-results/tile-corpus` then
`python tools/engine-verify/tile/run_all.py test-results/tile-corpus`. 2026-09-23, Windows 11.
Godot 4.7.2.stable.official, Tiled 1.12.2, LDtk 1.5.3 JSON schema + official QuickType loader, Unity
6000.5.3f1 + com.unity.2d.tilemap.extras 8.0.3. Godot/Unity cells = cells painted by the engine that
equal the Studio painter's prediction; truth = cells whose tile has the mask the corpus manifest
records for that neighbourhood (not derived from our export).

| Asset (corpus) | Truth layout | Detected (confidence, seam AUC) | Bits vs truth | Godot = Studio | Godot = truth | Tiled | LDtk (schema+loader+rules) | Unity RuleTile | Collision polys in Godot |
|---|---|---|---|---|---|---|---|---|---|
| caeles template 7×7 | caeles 7×7 | caeles 7×7 (high, 1.000) | 49/49 | 485/485 | 485/485 | PASS | PASS | PASS (485/485) | 49/49 exact |
| caeles template 8×6 | caeles 8×6 | caeles 8×6 (high, 1.000) | 48/48 | 485/485 | 485/485 | PASS | PASS | PASS | 48/48 |
| Tiled wangblob | cr31 wang blob | wang blob 7×7 (high, 1.000) | 49/49 | 485/485 | 485/485 | PASS | PASS | PASS | 49/49 |
| GameMaker 47 template | GameMaker 47 | GameMaker 47 (high, 1.000) | 47/47 | 485/485 | 485/485 | PASS | PASS | PASS | 47/47 |
| cave platformer 47 (real art, 64 px) | GameMaker 47 | GameMaker 47 (medium, 0.964) | 47/47 | 485/485 | 485/485 | PASS | PASS | PASS | 47/47 |
| Wang S-E2 | edge16 | edge16 cr31 (high, 1.000) | 16/16 | 485/485 | 485/485 | PASS | PASS | PASS | 16/16 |
| Wang S-V2 | 2-corner | corner16 cr31 (high, 1.000) | 16/16 | 485/485 | 485/485 | PASS | PASS | n/a (corner sets are not RuleTiles) | 16/16 |
| dual-grid Tilemap (4 terrains, MIT) | dual-grid 16 ×5 | corner16 ×5 blocks (high, 1.000), 4 terrains | 80/80 corner terrains | 251/251 (incl. 3 multi-terrain maps) | — | PASS | PASS | n/a | 80/80 |
| Kenney pixel platformer (+ packed) | not an autotile sheet | two real 3×3 boxes (high), 2 terrains | — | 685/685 | — | PASS | PASS | PASS (default sprite where the box has no tile, as predicted) | 18/18 |
| coolschool A2 (seamless floor) | RPG Maker A2 | pixels: low (AUC 0.5, no information); **size hint** A2 → assembled | generated 47 | 485/485 | — | PASS | PASS | PASS | — |
| coolschool A4 | RPG Maker A4 | ceiling block = A2 source (high, 1.000) → assembled | generated 47 | 485/485 | — | PASS | PASS | PASS | — |
| Kenney tiny dungeon, 1-bit, roguelike, LDtk atlases, Tiled desert | not autotile layouts in the table | low, or a real 3×3 box somewhere on the sheet, with "only part of the sheet: 9 of N tiles" | — | — | — | — | — | — | — |

Bits from pixels alone (no layout): 49/49, 48/48, 49/49, 47/47 on the templates and **47/47 on the
textured cave art** (was 4/47 before the colour-band measurement); Wang S-E2 edge template 0/16
without a reference, 16/16 with its full tile selected. Art check: no false flag on any corpus set;
two swapped tiles are found exactly (both tiles, nothing else) on every blob set.

Baseline for comparison (docs/ENGINE-VERIFY.md, Tile Lab's fixed slot order): 0/58, 0/58, 0/58, 5/58
cells right on the same blob sets; edge16 exported with 8 px tiles.

**Harness can fail:** Godot: a swapped pair of peering bits fails (Engine-Verify selftest) and the
Studio's own picks for incomplete / multi-terrain sets are recorded in
`tests/fixtures/tile/godot-terrain-picks.json` (the unit test replays them). Tiled/LDtk: swapped
wangids, a changed gid, spacing +1, a removed required field, a changed auto-tile id and an inverted
rule all FAIL (`tools/engine-verify/tile/tiled/negatives.py`). Unity: two swapped sprites in the rule
JSON fail (56/58, 130/141, 188/200 cells).

## Exports

| Target | Files | What was verified | Status |
|---|---|---|---|
| Godot 4 | PNG, `nerulio-tileset.json`, `nerulio_tileset_import.gd` (the Tile Lab `Builder`, verified since P0; + probability), README | Built by the shipped importer in Godot 4.7.2 (headless), reloaded, painted with `set_cells_terrain_connect`; every cell = the Studio painter (corners-and-sides, sides, corners, 2- and 4-terrain sets); collision polygons read back point for point after the half-tile shift | VERIFIED |
| Tiled | PNG, `<name>.tsx` (Wang set: mixed / edge / corner, one colour per terrain), `sample.tmx` (a map drawn with the Tiled rule; corner sets as a layer offset by half a tile), README | Tiled 1.12.2's own `--export-tileset` / `--export-map` readers: every Wang ID read as written, the sample map is a valid Wang tiling in Tiled; `tmxrasterizer` render pixel-exact vs an independent render | VERIFIED (the terrain *brush* itself was not driven: `tiled --evaluate` does not run scripts headless on this Windows build) |
| LDtk | PNG, `<name>.ldtk` (1.5.3: IntGrid value per terrain, one 3×3 rule per tile, corner sets with a half-tile tile offset, a sample level with `autoLayerTiles`), README | LDtk 1.5.3 JSON schema, the official QuickType loader, an independent re-run of the rules = exported tiles | PARTLY VERIFIED — not opened in the LDtk app (Electron installer only, no command line) |
| Unity 6 | PNG, `nerulio-ruletile.json`, `Editor/NerulioRuleTileImporter.cs` (builds one RuleTile per terrain, slices sprites, Point/Uncompressed) | Unity 6000.5.3f1 batch mode with 2D Tilemap Extras 8.0.3: the shipped script builds the RuleTiles, a painted Tilemap's `GetSprite` = prediction in every cell; sprite rects and pixels exact | VERIFIED for blob / side sets. Corner / dual-grid sets are not exported (a RuleTile draws on cells). Several terrains = several RuleTiles with no transitions between them (documented, shown in the UI) |
| Generic | PNG, `tileset.json` (patterns, cr31/edge/corner masks, Tiled Wang IDs, Godot peering names, rects) | unit tests | — |

Findings from the engines that changed the code: Tiled drops a Wang tile whose ID is all zeros, so
the isolated tile of a one-colour blob set is not written and the Tiled rule flags lone cells (a
Tiled brush cannot place that tile). Unity draws the RuleTile's default sprite where a combination is
missing (Godot leaves the cell empty or substitutes the closest tile) — the painter shows both.

## Competitors (same real CC0 sheets, 2026-09-23)

Driven with Playwright; files and screenshots in the P3 scratchpad (`p3/studio-tile/competitors/`).

| Tool | Input | Steps | Terrain rules in the engine file? | Result vs truth | Notes |
|---|---|---|---|---|---|
| **Nerulio Tile** | cave blob-47 sheet (64 px) | 7 actions, 4.5 s (Tile tab, import, pick file, Use this grid, first candidate, Apply, Download) | **Yes**: Godot terrain set with 47 tiles / 188 peering bits + importer, Tiled Wang set, LDtk rules, Unity RuleTiles | Godot 485/485 cells right | free, local |
| **Sprite Fusion** (web) | same sheet | 12 setup actions; building the 47 rules by hand = 537 clicks (computed from the masks; tiles assigned via the UI put 3/47 in the wrong rule) | **No**: Godot 4 export loads with 0 terrain sets (58 baked cells), TMX has no Wang set (tileset repacked to the 24 used tiles) | 58/58 inside its editor once the rules are complete | an auto layer paints nothing until its "Default Tiles" slot is set; $14.99 desktop upsell |
| **Blobsmith Lite 1.0.4** (web) | the cave art cut to a 2×3 base; coolschool A2 block | 4 actions for the 47 sheet (+2 for 16) | **No** in the free tier: `.tres` and `.tsx` need the $9.95 version | its 47 sheet is cr31 ascending order (Nerulio identifies it, 0.964 medium; its 16 sheet as `edge16-8x2`, 1.000 high) | vs Nerulio's generator: 46/47 (cave) and 47/47 (coolschool) tiles byte-identical; the one difference is the isolated tile (Blobsmith copies the base's island tile, Nerulio assembles four outer-corner quarters). Its help calls the base "same as RPG Maker A2" but puts the inner corners top-left — Nerulio has both orders (`rpgmaker-a2`, `blobsmith`) and tells them apart (0.964 vs 0.852) |
## Not done / limits

* The Tiled terrain brush and the LDtk app were not driven (see above). The Godot editor's own
  terrain painter was not driven either — only `set_cells_terrain_connect`, which it calls.
* Godot's painter is path-dependent; the Studio shows the result of painting each terrain once,
  row by row (what a script or the harness does), not an arbitrary stroke history.
* Multi-terrain transitions: recognised and exported for dual-grid packs, generated for A-over-B
  (one pair at a time). Rules for more than two terrains meeting at one point are only as complete as
  the art.
* Bit suggestion needs a reference "full" tile; on side-only path templates (Wang S-E2) the guess can
  fail unless the full tile is selected.
* Isometric / hex tiles, animated tiles, alternative tiles, occlusion and navigation layers are out
  of scope. Collision polygons are exported as drawn/traced (outer loops; holes are exact only with
  "exact rectangles").
* Evidence is Chromium only.
