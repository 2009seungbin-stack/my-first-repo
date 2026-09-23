# Studio Tile workspace (P3) — progress checkpoint

Branch `nerulio/studio-tile` (based on `origin/nerulio/ship-studio-p0a`, with
`origin/nerulio/trust-fixes` merged; the only merge conflict was a one-line reset in
`src/task/sprite-lab.js`, resolved by keeping both sides' fields). Checkpoint taken on the
coordinator's instruction to save budget; nothing below was run through the full regression yet.

## Done (committed, unit-tested)

Pure engines under `src/game/tiles/` (no DOM; `tests/tiles.test.mjs`, 14 tests, all pass):

| File | What it does |
|---|---|
| `patterns.js` | Canonical tile description `[t, n, ne, e, se, s, sw, w, nw]` (Godot-shaped, -1 = no terrain), modes `corners-and-sides` / `sides` / `corners`, cr31/edge/corner mask conversions, required-pattern sets, completeness (missing / duplicates / invalid corner bits), `idealAt` (what a map cell wants). |
| `layouts.js` | 11 published layouts as data: cr31 ascending, cr31 wang-blob 7×7, caeles 7×7 and 8×6, GameMaker 47, Godot 3 "3×3 minimal" 12×4 (sampled from the godot-docs 3.5 template: 47 distinct masks + 1 blank), edge16 cr31/binary, corner16 cr31 (= Godot 3 "2×2" = dual-grid 4×4 jess::codes/GlitchedinOrbit)/binary, box9. Sub-tile sources: RPG Maker A2, A4 wall, five-tile. Tilesetter's own layout is not published, so it is not in the table. |
| `identify.js` | Layout identification by seam continuity (AUC of boundary-pixel differences for pairs a layout calls continuous vs broken, two boundary models, containment-aware margin, confidence high/medium/low), multi-block + multi-terrain clustering (`blockTerrains`), RPG Maker size hints, bit suggestion from pixels (reference tile chosen by seam consistency), art-vs-bits check (supervised, "not measurable" instead of a false ✓). |
| `godot-terrain.js` | Port of Godot 4 `set_cells_terrain_connect` (constraints, priorities, reverse painting order, pattern ordering, empty pattern) + `resolveGodot` for a whole map. |
| `generator.js` | Quarter-exact assembly: A2, Blobsmith, A4 wall, five-tile, procedural rim → blob47 / edge16; dual-grid 16 from the same quarters; A-over-B transitions; `buildSheet` in any layout; `remapSheet`; provenance ("edit one source quarter → these tiles change", unit-tested). |
| `model.js` | Tileset model (JSON, lives in `doc.settings.tile`): create / apply layout / toggle bit / terrains / normalize. |
| `godot-export.js`, `tiled.js`, `ldtk.js`, `unity.js`, `exports.js` | Godot JSON + the verified Tile Lab importer (plus probability); Tiled TSX Wang set + TMX sample + Tiled exact-match rule; LDtk 1.5.3 project with IntGrid + auto-layer rules (+ rule evaluator); Unity RuleTile JSON + C# editor script that builds RuleTile assets; generic JSON. |

Engine harness `tools/engine-verify/tile/` (`corpus_tiles.mjs`, `cases.mjs`, `godot_tile.py`,
`terrain_probe.gd`, `run_all.py`). **Godot 4.7.2 result on the corpus** (identified from pixels,
exported, built by the shipped importer, painted with `set_cells_terrain_connect`):

| Asset | Truth layout | Detected (confidence) | Model vs truth | Godot = Studio painter | Godot = corpus truth |
|---|---|---|---|---|---|
| template7x7_with_indices | caeles 7×7 | blob47-caeles-7x7 (high) | 49/49 | 485/485 cells | 485/485 |
| template8x6_with_indices | caeles 8×6 | blob47-caeles-8x6 (high) | 48/48 | 485/485 | 485/485 |
| wangblob | cr31 wang blob | blob47-wangblob-7x7 (high) | 49/49 | 485/485 | 485/485 |
| gms_47autotile_template | GameMaker 47 | blob47-gamemaker (high) | 47/47 | 485/485 | 485/485 |
| autotile47 (real cave art) | GameMaker 47 | blob47-gamemaker (medium, AUC 0.964) | 47/47 | 485/485 | 485/485 |
| Wang S-E2 | edge16 | edge16-cr31 (high) | 16/16 | 485/485 | 485/485 |
| Wang S-V2 | 2-corner | corner16-cr31 (high) | 16/16 | 485/485 | 485/485 |
| dual-grid Tilemap (4 terrains, 5 blocks) | dual-grid 16 ×5 | corner16-cr31 ×5 blocks (high) | 80/80 corner terrains (after relabel) | 204/204 incl. 2 multi-terrain maps | — |
| Kenney pixel-platformer (not an autotile sheet) | — | box9 ×2 blocks (high; 2 real 3×3 terrain boxes) | — | 685/685 incl. multi-terrain | — |

Baseline before this work (docs/ENGINE-VERIFY.md): 0/58, 0/58, 0/58, 5/58 and 0/58 cells right.
Kenney tiny dungeon / roguelike / 1-bit, LDtk atlases, desert: no confident layout (correctly "low"),
nothing exported. coolschool A2 (seamless floor): seams carry no information (AUC 0.5); the size
hint "768×576 = RPG Maker A2" is produced but not yet wired to an export. coolschool A4: its ceiling
block is found as an A2 source (high).

## In progress (not committed as working)

* `src/studio/workspaces/tile/tile-worker.js` — worker ops (detect with layout-aware sizes,
  identify, blank, suggest, art, collision, generate). Written, syntax-checked, **not wired, not run**.

## Next steps

1. Workspace UI `src/studio/workspaces/tile/index.js` (+ `strings.js` ko/en/ja merged into
   `STUDIO_STRINGS`, `tile.css`): tileset import panel (grid candidates + layout-fit evidence +
   explicit Apply), layout panel (candidates, confidence, Apply, blocks/terrains, suggest bits),
   bit-painting tool on the sheet (9 zones per tile, drag, right-click erase), terrains panel,
   validation panel (missing / duplicates / invalid / art check), generator panel (source →
   new asset + tileset, provenance highlight), map painter (brush/eraser/bucket, layers, Godot vs
   Tiled rule, wrong/missing cells highlighted), export panel (zip per target). Register in
   `src/studio/main.js`, drop `tile` from `src/studio/workspaces/coming.js`.
2. Wire source/size hints into the corpus run (A2/A4 → generated sheet → exports).
3. Tiled check (Tiled portable + `tmxrasterizer`/`--evaluate`, else pytmx), LDtk schema
   validation (schema downloaded to `nerulio-asset-corpus/_adhoc/nerulio-studio-tile/`), Unity
   6000.5.3f1 RuleTile run (needs `com.unity.2d.tilemap.extras` in a separate template copy).
4. `tests/studio-tile-browser.py` + add to `tools/regression.py`; screenshots 1440×900 / 390×844.
5. Competitor head-to-head (Sprite Fusion, Blobsmith Lite) on the same sheet.
6. `docs/STUDIO-TILE.md` final doc; `npm test`, `tools/regression.py`, `tests/service-browser.py`.

Ad-hoc downloads (dev only, not committed): `C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-tile\`
(Godot 3 template PNGs from godot-docs 3.5, Tilesetter doc images, LDtk JSON schema). A `SOURCES.md`
there is still to be written.
