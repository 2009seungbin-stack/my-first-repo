# Engine verification harness

`tools/engine-verify/` loads an exported bundle, exactly as a user downloads it, into real game
engines and reports field by field what each engine understood. It then compares the pixels the
engine drew against the **original** corpus asset (`docs/GAME-CORPUS.md`), never against the
export itself.

"Export works in engine X" is only claimed when this harness has run it.

It generalises two earlier checks:

* `tests/fixtures/game/godot-validate*.mjs` (Sprite Lab SpriteFrames fields) stays as it is,
  because `tests/task-browser.py` calls it.
* The out-of-repo Tile Lab `godot_check.py` (independent peering-bit verifier) now lives in
  `godot/probe.gd` and `judge.py`.

What the harness adds to both is real pixels, a terrain paint, fonts, web engines and Unity.

## Engines on the verification machine

Windows 11, 2026-09-23. `python tools/engine-verify/engines.py` prints this list for any machine.

| Engine | Version | Status | How it runs |
|---|---|---|---|
| Godot 4 | 4.7.2.stable.official.ed1daf0bf | **runner** | Console exe. The harness runs `--headless --import`, then `godot/probe.gd` with a real renderer (gl_compatibility / OpenGL 3.3). A small borderless window opens for a few seconds: a `--headless` run has a dummy renderer that cannot draw. |
| Phaser 3 | 3.90.0 (npm) | **runner** | Real `phaser.min.js` in Playwright Chromium (SwiftShader WebGL), standard loaders |
| Phaser 4 | 4.2.1 (npm) | **runner** | same |
| PixiJS 8 | 8.21.0 (npm) | **runner** | same, `Assets.load` |
| Unity 6 | 6000.5.3f1 | **runner** (for the Sprite Lab Unity bundle) | The Unity Hub is signed in here and batch mode picks up the Personal entitlement (`[Licensing::Client] Successfully resolved entitlement details`). Creating the template project took 31 s; each run takes about 1–2 minutes. On a machine without a signed-in Hub the runner reports UNVERIFIED. |
| Defold | 1.13.1 `bob.jar` | **probed, no runner** | `bob.jar` 1.13.1 needs **Java 25** (class file version 69); the installed Java 21 refuses it. A portable Temurin JDK 25 zip (no installer, no admin) works. `java -jar bob.jar -r <proj> build` built a project with a `.atlas` (6 loose ninja frames, one 12 fps animation) into `hero.a.texturesetc` and `hero.texturec` in 1.1 s. It needs `game.project` with `[bootstrap] main_collection` and `[input] game_binding=/builtins/input/all.input_bindingc`. No Nerulio exporter targets Defold, so there is nothing to verify yet. |
| LÖVE | 11.5 (portable zip) | **probed, no runner** | `lovec.exe <folder>` with a `main.lua` that draws a Quad into a Canvas at 4× with `setDefaultFilter("nearest")` and `ImageData:encode`s it. 2400/2400 opaque pixels matched a nearest 4× of the source. LÖVE has no atlas format, so a runner needs an exporter that writes Lua quads or JSON (with a Lua JSON parser) first. |
| GameMaker | — | **not possible here** | There is no free headless import or build path: the IDE, an account login, and the paid/creator-licence runtime build chain are all needed. Not attempted. |

Cached engine downloads (Unity template project, `bob.jar`, JDK 25, LÖVE) live in
`%LOCALAPPDATA%\nerulio-engine-verify` (`NERULIO_ENGINE_CACHE`), outside the repository. The web
engines are pinned in `tools/engine-verify/web/package.json`; install them with
`npm ci --prefix tools/engine-verify/web`. They are not part of the site build or the root
`package.json`.

## How to run

```
python tools/fetch-game-corpus.py                     # the corpus (once)
npm ci --prefix tools/engine-verify/web               # Phaser 3/4 + PixiJS 8 (once)
python tools/engine-verify/engines.py                 # what can run here

python tools/engine-verify/selftest.py                # the harness must pass good data and fail broken copies
python tools/engine-verify/verify.py <bundle.zip|folder> --expect <expect.json> [--engines godot,phaser3,phaser4,pixi8,unity] [--json report.json]
python tools/engine-verify/expect_from_corpus.py <corpus path> --out <dir> [--animations rows]
python tools/engine-verify/baseline.py [--port 4441] [--out test-results/engine-baseline] [--only <case>] [--skip-export]
```

* `GODOT_BIN` overrides the Godot path and `UNITY_BIN` the Unity path. The web engines are served
  on `127.0.0.1:<port>` (default 4441).
* `verify.py` exits 1 if any engine run FAILs.
* Without `--expect`, only what the engine itself reports is checked, and the verdict is at best
  UNVERIFIED. A PASS needs expectations from the source asset.
* `baseline.py` starts `node tools/serve.mjs` on `--port`, drives the Labs in Chromium, stops the
  server, and then runs the engines on the same port.

## What happens in a run

1. **Unpack and detect** (`ev_common.detect`). The bundle is unpacked and every loadable thing in
   it is found by file shape, not by what the bundle claims:
   * Sprite Lab Godot / Unity / Generic envelope
   * sprite-sheet-maker "Godot 4" JSON
   * Tile Lab Godot pack
   * TexturePacker JSON (hash or array)
   * Aseprite JSON
   * Starling/Sparrow XML
   * BMFont (text, XML or binary)
   * TTF/OTF
   * loose PNG
2. **Load in each engine through the standard or shipped path.**

   | Engine | Load path |
   |---|---|
   | Godot | The helper script **the bundle ships**: the Sprite Lab `nerulio_sprite_frames.gd` or the Tile Lab `nerulio_tileset_import.gd` `Builder`. BMFont `.fnt` and TTF use Godot's own importer. The saved resource is reloaded with `CACHE_MODE_IGNORE`. |
   | Phaser | `load.atlas`, `load.aseprite` + `anims.createFromAseprite`, `load.atlasXML`, `load.bitmapFont` |
   | Pixi | `Assets.load` |
   | Unity | The bundle's `NerulioSpriteImporter.Apply`, reached by reflection because its menu entry opens a file dialog that batch mode cannot show |

   A bundle that ships no loader for an engine it claims is a FAIL. An engine the bundle does not
   target is N/A.
3. **Read back what the engine made.**

   | Engine | What is read back |
   |---|---|
   | Godot SpriteFrames | animation names, speed, loop, per-frame relative durations, `AtlasTexture` region, margin, size, `filter_clip`, atlas size, and the `.import` settings of the page |
   | Godot TileSet | tile size, margins, separation, terrain sets and modes, every tile's terrain and peering bits, physics layers |
   | Godot fonts | the `FontFile` height and glyph count, and `has_char` |
   | Phaser / Pixi | frame cut rects, real/orig sizes, trim offsets, rotation, animations |
   | Unity | `TextureImporter` type, mode, filter, compression, mipmaps and PPU, plus every Sprite's rect, pivot, border and physics-shape count |
4. **Let the engine draw.**
   * **Godot** draws each animation frame with an `AnimatedSprite2D` at 1×. It draws one frame at
     4× through the helper's own `build_scene()`, with the node and project filter settings a new
     project has. It paints a terrain shape with `TileMapLayer.set_cells_terrain_connect` and records
     which atlas tile it chose for every cell. It draws each glyph in a `Label`.
   * **Phaser and Pixi** draw every frame in its own slot of one canvas. Slots are spaced one
     largest frame side apart, so a frame drawn at the wrong size cannot spill into its neighbour.
   * **Unity**: the probe cuts each Sprite's rect out of the texture Unity decoded.
5. **Judge** (`judge.py`) against expectations built from the corpus truth
   (`expect_from_corpus.py`):

   | Field | Meaning |
   |---|---|
   | `frames.count` | engine frame count against the non-empty source cells or files |
   | `frames.art` | every expected frame is drawn with identical art, compared trimmed so it does not depend on position |
   | `frames.order` | the engine's frame order is the source reading order or natural file order |
   | `frames.placement` | the art sits in the same place inside a same-size frame as in its source cell: trim restoration, no re-alignment |
   | `frames.anchor` (Unity) | every sprite's pivot puts its art where it was in its source cell, relative to one common anchor |
   | `animations.present` / `anim[x].count/fps/loop/durations/art` | animation data the engine can play |
   | `render.4x.sharp` | the 4× render equals a nearest-neighbour 4× of the 1× render, so pixel art stays sharp as shipped |
   | `tileset.*` | tile size, margins, separation, tile count and terrain mode against the corpus grid, and peering bits against the bundle's own JSON |
   | `terrain.paint.picks` | the tile Godot actually paints for each cell of a 58-cell test shape (holes, diagonals, 1-wide arms) against the tile the **source layout** defines for that neighbourhood. The masks come from the corpus truth (`truth.masks`). Where a layout has duplicates (the caeles sheet has three 255 tiles), any of them counts |
   | `font.chars`, `font.glyph_shapes` | every character is present, and the glyph's coverage mask (alpha ≥ 128, trimmed) equals the source glyph cell |
   | `import.*` (Unity) | the texture is Point-filtered, uncompressed and in Multiple sprite mode |

### How pixels are compared (measured, not assumed)

* **Premultiplied read-back.** Drawing with ordinary alpha blending onto a *transparent* target
  leaves `rgb·a` in the buffer. Godot's viewport, Phaser 3's `snapshot` and Pixi 8's
  `extract.canvas` all do this; Phaser 4's snapshot does not. Measured examples:
  * Phaser 3 reads a (106,151,178,79) texel back as (32,48,55,79).
  * Pixi 8 reads a (67,48,30,69) texel back as (18,15,7,69).
  * Godot reads a (195,131,99,47) texel back as (36,24,18,47).

  On any opaque background that is exactly what a player sees, so captures are un-premultiplied
  before comparison (`ev_common.unpremultiply`).
* **What counts as a difference.** Comparison happens in premultiplied space. The colour of fully
  transparent pixels is ignored.
  * Opaque pixels: tolerance 2 levels.
  * Semi-transparent pixels: 8 levels. Phaser 3 moves a 12 %-alpha texel by up to 8 levels.
  * Texels under 6 % opacity: their colour may differ by at most their own premultiplied weight
    (measured: (196,177,177,13) comes back as (255,0,0,13) from Phaser 3 and Pixi 8). Their alpha
    is still compared exactly.
  * Classic pixel art (binary alpha) is compared at 2 levels everywhere.
* **Phaser 3.90 odd-size quirk.** With `pixelArt`/`roundPixels`, Phaser 3.90 draws a *trimmed*
  frame 1 px right (down) when its source width (height) is odd. Measured on every trimmed frame of
  the 29 px-tall ninja and the 381 px-wide archer; Phaser 4 and Pixi 8 draw the same bundles
  exactly. `frames.placement` tolerates exactly that pattern, for `phaser3` only, and says so in
  its note.

### The harness can fail (self-test)

`python tools/engine-verify/selftest.py` (last run 2026-09-23: **SELFTEST PASSED**, 9/9):

| Case | Engines | Want | Got |
|---|---|---|---|
| Aseprite JSON hash from the corpus (OGA torch, made by Aseprite) | phaser3, phaser4, pixi8 | PASS | PASS ×3 |
| The same JSON with one frame shifted 1 px | phaser3, phaser4, pixi8 | FAIL | FAIL ×3 (`frames.art`) |
| A TileSet JSON written from the corpus GameMaker blob-47 masks, built by the shipped Tile Lab importer, terrain-painted by Godot | godot | PASS | PASS (58/58 painted cells right) |
| The same with two tiles' peering bits swapped | godot | FAIL | FAIL (`terrain.paint.picks`) |
| Cozette BMFont text `.fnt` as a Godot `FontFile` | godot | PASS | PASS (26/26 glyph shapes) |

Two more checks were run by hand:

* **Unity negative control.** In the Sprite Lab Unity bundle, one sprite's `rect.x` was moved by
  5 px → FAIL, `frames.art` 59/60 matched.
* **Real tool exports pass everywhere they load.** In the baseline, Kenney's Starling XML passes
  Phaser 3 and 4, the Aseprite JSON passes Phaser 3, Phaser 4 and Pixi 8, and the Cozette BMFont
  passes Godot and Pixi 8. Pixel-exact.

## What is NOT verified (UNVERIFIED)

* **Godot, what is not exercised:**
  * The `@tool EditorScript` menu route inside the editor GUI. Only the same `Builder`/helper
    functions it calls are run.
  * `AnimationPlayer` tracks, and collision shapes from Sprite Lab as physics behaviour (they are
    only counted as nodes by the older `tests/fixtures/game/godot-validate*.mjs`).
  * TileSet alternative tiles, physics, occlusion and navigation behaviour.
  * Terrain painting through the editor's paint tool rather than `set_cells_terrain_connect`.
* **Godot renderer.** Only gl_compatibility (OpenGL 3.3, NVIDIA GTX 1070 Ti) is used. Forward+ and
  Mobile are not.
* **Phaser and Pixi:**
  * Only standard loaders are used; community Tiled/LDtk loaders are not.
  * Tilemaps are not loaded at all: no Nerulio exporter writes Tiled JSON yet.
  * Phaser reads only XML BMFont. Text `.fnt` rows are N/A for Phaser, not verified.
  * Pixi 8 has no Starling/Sparrow XML loader (N/A).
  * Pixi builds no animations from Aseprite `frameTags`; that is recorded as a warning, not tested
    as an animation.
  * Everything web runs in Chromium with SwiftShader WebGL. Firefox, WebKit and real GPUs are not
    covered.
* **Unity:**
  * Only the Sprite Lab Unity target (sprite rects, pivots, import settings) is checked.
  * Not checked: physics-shape outlines as colliders, 9-slice borders in a UI Image, Animator
    clips, anything the importer does not write.
  * The template adds `com.unity.2d.sprite` (every Unity 2D template ships it). In a Unity *3D*
    template without it, the shipped `NerulioSpriteImporter.cs` would not compile; that case was
    not run.
* **Defold and LÖVE:** feasibility only, no runner (no exporter).
* **GameMaker:** not possible here.
* **Textures:** PBR sets and normal-map conventions are not imported in any engine by this
  harness. The Godot probe has a `texture` mode (import settings plus a draw), but no exporter case
  uses it yet.
* **Fonts:** TTF-mode fonts from the UI Lab, kerning, and CJK multipage BMFont are not verified.
* **Scale:**
  * The 4096×4096 Sprite Lab case never reached an export, so nothing large was verified in an
    engine.
  * The web layout would put 1024 px frames on a very large canvas; this is untested.

## Baseline (2026-09-23, main @ c741bbe)

Today's exporters were driven through their own pages, as a user would drive them, on real
corpus assets:

* **Sprite Lab:** drop the sheet; Auto or a typed grid; open Animate so the default animation
  exists (except the one case that skips it); Export with the target.
* **sprite-sheet-maker:** drop the frames; "Sort by name"; format; optionally rotate.
* **Tile Lab:** `?stage=export&kind=…`, drop the sheet, Download.
* **UI Lab bitmap font:** cell size, baseline and the 95 ASCII characters typed; Export.

Everything else was left at its defaults. The results are **15 PASS, 32 FAIL, 4 N/A** out of 51
engine runs. That includes 9 reference rows (7 PASS, 2 N/A) that calibrate the harness itself.
Exporter rows alone: **8 PASS, 32 FAIL, 2 N/A.**

Reproduce with `python tools/engine-verify/baseline.py` (about 20 minutes). The per-run reports,
engine PNGs, expectations and the exported bundles are written to `test-results/engine-baseline/`
(git-ignored; the run documented here was written to a scratch folder with `--out`).

### What the baseline found (the studio must beat these)

**Sprite Lab**

* **Godot: pixel art blurs as shipped.** The helper's `build_scene()` leaves `texture_filter` on
  inherit, and a new project defaults to Linear. At 4×, 6851 of 36864 pixels differ from nearest
  on samurai. Every Sprite Lab Godot case fails `render.4x.sharp`. The 1× data is right: the
  samurai grid case matched 60/60 frames, same order, same placement, animation present.
* **No animation, nothing to play.** When Animate is never opened, the Godot bundle has
  0 animations and the helper builds an empty SpriteFrames. There is no warning at export.
* **The Generic JSON cannot be loaded by any web engine.** It has `frames[].rect`, not `.frame`.
  * Phaser 3 and Phaser 4 throw `Cannot read properties of undefined (reading 'x')` inside their
    loader and never finish.
  * Pixi 8 parses 0 textures.

  Phaser/Pixi users must use sprite-sheet-maker instead.
* **Auto slicing:**
  * Samurai: 58 frames instead of 60. 6 frames do not match their cells, because 1 px blood drops
    and adjacent poses are merged or split.
  * Toon (96×128 cells): all 45 frames have the right art, but 0/45 keep their place in the cell.
    Auto trims to the island and re-aligns, so the source author's alignment is lost.
* **Colour keys:**
  * Real magenta-keyed Kenney sheet with default settings: 1 frame instead of 448. The key is
    `None` by default and hidden in Advanced.
  * Grid + margin 4 + spacing 2 + key Auto: 34/60 frames exact. Magenta enclosed by the art
    survives: pure (255,0,255) pixels in the gaps between arm and body.
* **4096² sheet:** no export. Auto produced no frame boxes within 90 s, and the Download button was still disabled 180 s later (275 s in total).
* **Unity target: PASS in Unity 6000.5.3f1.** The Sprite Lab page and `unity.js` still call this
  path **UNVERIFIED**; that label is now out of date.
  * Point filter, Uncompressed, Multiple mode.
  * 60/60 sprite rects equal to the export and 60/60 frames with identical art.
  * One common pivot anchor.

**sprite-sheet-maker**

* **Colours are changed.** The ninja PNGs carry `gAMA`/`cHRM` chunks. The page bakes the
  browser's colour-managed decode into the atlas: source (50,50,50) becomes (46,46,46), with 99
  pixels of `run_0` off by up to 8 levels. That is 0/6 exact frames in all three web engines, for
  hash, array, XML and rotate alike. The frames without those chunks (archer) are exact.
  Sprite Lab does not have this problem: the toon sheet has `gAMA` and matched 45/45.
* **Rotation is broken.** `frame.w/h` are written in atlas orientation, but TexturePacker JSON
  (and so Phaser and Pixi) expects the unrotated size. All 8 rotated archer frames come out
  garbled in Phaser 3, Phaser 4 and Pixi 8; the 2 unrotated ones are exact.
* **The "Godot 4" format** is JSON with no importer in the ZIP, so a Godot user gets nothing
  (FAIL).
* **Trimmed XML fails in Phaser 3.** Phaser 3.90's `atlasXML` ignores
  `frameX`/`frameWidth`, so the art comes out cropped: 0/10. Phaser 4 is exact, 10/10.
* **What works:** json-hash without rotation on the archer frames is exact in all three engines,
  and the natural order `attack (1)…(10)` holds after "Sort by name".

**Tile Lab Godot pack**

* **The ordering is fixed.** Every real blob-47 layout (GameMaker, caeles 7×7, cr31 wang-blob)
  and the real cave art get the wrong tiles when Godot paints: 0/58, 0/58, 0/58 and 5/58 cells
  right. The importer, peering bits and tile size are all correct; the Lab's own slot order simply
  is not the sheet's.
* **Wrong grid, no warning.** On the 32 px edge16 template, the grid auto-detected 8×8 and the
  pack was exported with 8 px tiles.
* **Nonsense passes structurally.** Forcing `kind=blob47` on the Kenney Tiny Dungeon (not an
  autotile sheet) exports a pack whose structure checks all pass (16 px, spacing 1, 376 peering
  bits consistent with the JSON). Nothing warns that the sheet is not a blob set.

**UI Lab bitmap font**

* **Bellanger 8×12 grid:** PASS in Godot (`FontFile`) and Pixi 8. 94/94 glyph shapes match.
* **Intrepid** (black glyphs on opaque white): 0/94 in Godot and Pixi. The font sheet keeps the
  opaque background, because the font stage has no colour key.
* **Phaser:** N/A. It exports text BMFont only, and Phaser reads XML BMFont.

### Results table

Case ids match `tools/engine-verify/baseline.py`. "Details" shows the failing fields (or the
passing ones). The full per-field JSON is `baseline.json` in the output folder.

| # | Case | Asset | Export | Engine | Result | Details |
|---|---|---|---|---|---|---|
| 1 | `ref-aseprite-torch` | `Torch_Sheet.png` | reference: Aseprite JSON hash (torch, 6 frames) | phaser3 | **PASS** | frames.count 6; frames.art 6 matched; frames.placement 6/6 placed identically |
| 2 | `ref-aseprite-torch` | `Torch_Sheet.png` | reference: Aseprite JSON hash (torch, 6 frames) | phaser4 | **PASS** | frames.count 6; frames.art 6 matched; frames.placement 6/6 placed identically |
| 3 | `ref-aseprite-torch` | `Torch_Sheet.png` | reference: Aseprite JSON hash (torch, 6 frames) | pixi8 | **PASS** | frames.count 6; frames.art 6 matched; frames.placement 6/6 placed identically |
| 4 | `ref-starling-toon` | `character_femaleAdventurer_sheet.png` | reference: Kenney Starling XML (toon, 45 frames) | phaser3 | **PASS** | frames.count 45; frames.art 45 matched; frames.placement 45/45 placed identically |
| 5 | `ref-starling-toon` | `character_femaleAdventurer_sheet.png` | reference: Kenney Starling XML (toon, 45 frames) | phaser4 | **PASS** | frames.count 45; frames.art 45 matched; frames.placement 45/45 placed identically |
| 6 | `ref-starling-toon` | `character_femaleAdventurer_sheet.png` | reference: Kenney Starling XML (toon, 45 frames) | pixi8 | **N/A** | has no standard loader for starling-xml |
| 7 | `sl-samurai-auto-godot` | `samurai.png` | Sprite Lab (godot) | godot | **FAIL** | frames.count: 58 (want 60); frames.art: 54 matched; frames.order: [0, None, None, 1, 2, 3, 4, None, None, 7, 8, 9]... |
| 8 | `sl-samurai-grid-godot` | `samurai.png` | Sprite Lab (godot) | godot | **FAIL** | render.4x.sharp: 6851 of 36864 pixels differ (max delta 169) |
| 9 | `sl-samurai-grid-noanim-godot` | `samurai.png` | Sprite Lab (godot) | godot | **FAIL** | load: 0 animations; frames.count: 0 (want 60); frames.art: 0 matched |
| 10 | `sl-samurai-grid-generic` | `samurai.png` | Sprite Lab (generic) | phaser3 | **FAIL** | Uncaught TypeError: Cannot read properties of undefined (reading 'x'); load: nothing usable; frames.count: 0 (want 60); frames.art: 0 matched |
| 11 | `sl-samurai-grid-generic` | `samurai.png` | Sprite Lab (generic) | phaser4 | **FAIL** | Uncaught TypeError: Cannot read properties of undefined (reading 'x'); load: nothing usable; frames.count: 0 (want 60); frames.art: 0 matched |
| 12 | `sl-samurai-grid-generic` | `samurai.png` | Sprite Lab (generic) | pixi8 | **FAIL** | Pixi parsed b/atlas.json as fn with 0 textures; load: nothing usable; frames.count: 0 (want 60); frames.art: 0 matched |
| 13 | `sl-samurai-grid-unity` | `samurai.png` | Sprite Lab (unity) | unity | **PASS** | import.filter Point; import.compression Uncompressed; import.spriteMode Multiple; sprites.rects_vs_export 60/60; frames.count 60; frames.art 60 matched; frames.order same |
| 14 | `sl-toon-auto-godot` | `character_femaleAdventurer_sheet.png` | Sprite Lab (godot) | godot | **FAIL** | frames.placement: 0/45 placed identically; render.4x.sharp: 27031 of 97280 pixels differ (max delta 155) |
| 15 | `sl-samurai-magenta-grid-godot` | `samurai_magenta_m4_s2.png` | Sprite Lab (godot) | godot | **FAIL** | frames.art: 34 matched; frames.order: [0, 1, 2, 3, None, 5, None, None, None, 9, 10, 11]...; render.4x.sharp: 6851 of 36864 pixels differ (max delta 169) |
| 16 | `sl-rogue-magenta-auto-godot` | `roguelikeChar_magenta.png` | Sprite Lab (godot) | godot | **FAIL** | frames.count: 1 (want 448); frames.art: 0 matched; frames.order: [None, None, None, None, None, None, None, None, None, None, None, None]... |
| 17 | `sl-hit-4096-auto-godot` | `hit-yellow.png` | Sprite Lab (godot) | - | **FAIL** | export failed: TimeoutError: Page.wait_for_function: Timeout 180000ms exceeded. |
| 18 | `ssm-ninja-hash` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-hash) | phaser3 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 19 | `ssm-ninja-hash` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-hash) | phaser4 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 20 | `ssm-ninja-hash` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-hash) | pixi8 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 21 | `ssm-ninja-array` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-array) | phaser3 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 22 | `ssm-ninja-array` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-array) | phaser4 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 23 | `ssm-ninja-xml` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (xml) | phaser3 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 24 | `ssm-ninja-xml` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (xml) | phaser4 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 25 | `ssm-ninja-godot` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (godot) | godot | **FAIL** | the bundle is labelled Godot 4 but ships no importer; Godot has no built-in loader for this JSON |
| 26 | `ssm-ninja-hash-rotate` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-hash, rotate) | phaser3 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 27 | `ssm-ninja-hash-rotate` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-hash, rotate) | phaser4 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 28 | `ssm-ninja-hash-rotate` | `sprites/oga-ninja/1x/` | sprite-sheet-maker (json-hash, rotate) | pixi8 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 29 | `ssm-archer-hash` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (json-hash) | phaser3 | **PASS** | frames.count 10; frames.art 10 matched; frames.order same; frames.placement 10/10 placed identically |
| 30 | `ssm-archer-hash` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (json-hash) | phaser4 | **PASS** | frames.count 10; frames.art 10 matched; frames.order same; frames.placement 10/10 placed identically |
| 31 | `ssm-archer-hash` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (json-hash) | pixi8 | **PASS** | frames.count 10; frames.art 10 matched; frames.order same; frames.placement 10/10 placed identically |
| 32 | `ssm-archer-hash-rotate` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (json-hash, rotate) | phaser3 | **FAIL** | frames.art: 2 matched; frames.order: [None, None, None, 3, None, None, None, None, None, 9]... |
| 33 | `ssm-archer-hash-rotate` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (json-hash, rotate) | phaser4 | **FAIL** | frames.art: 2 matched; frames.order: [None, None, None, 3, None, None, None, None, None, 9]... |
| 34 | `ssm-archer-hash-rotate` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (json-hash, rotate) | pixi8 | **FAIL** | frames.art: 2 matched; frames.order: [None, None, None, 3, None, None, None, None, None, 9]... |
| 35 | `ssm-archer-xml` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (xml) | phaser3 | **FAIL** | frames.art: 0 matched; frames.order: [None, None, None, None, None, None, None, None, None, None]...; frames.placement: 0/0 placed identically |
| 36 | `ssm-archer-xml` | `sprites/oga-skeleton-archer/attack-frames/` | sprite-sheet-maker (xml) | phaser4 | **PASS** | frames.count 10; frames.art 10 matched; frames.order same; frames.placement 10/10 placed identically |
| 37 | `tl-gms47-blob` | `gms_47autotile_template.png` | Tile Lab Godot pack (blob47) | godot | **FAIL** | terrain.paint.picks: 0/58 cells right |
| 38 | `tl-cave47-blob` | `autotile47.png` | Tile Lab Godot pack (blob47) | godot | **FAIL** | terrain.paint.picks: 0/58 cells right |
| 39 | `tl-caeles7x7-blob` | `template7x7_with_indices.png` | Tile Lab Godot pack (blob47) | godot | **FAIL** | terrain.paint.picks: 0/58 cells right |
| 40 | `tl-wangblob-blob` | `wangblob.png` | Tile Lab Godot pack (blob47) | godot | **FAIL** | terrain.paint.picks: 5/58 cells right |
| 41 | `tl-edge16` | `Wang S-E2.png` | Tile Lab Godot pack (edge16) | godot | **FAIL** | tileset.tile_size: [8, 8] (want [32, 32]); terrain.paint.picks: 0/58 cells right |
| 42 | `tl-tinydungeon-blob` | `tilemap.png` | Tile Lab Godot pack (blob47) | godot | **PASS** | tileset.tile_size [16, 16]; tileset.margins [0, 0]; tileset.separation [1, 1]; tileset.peering_vs_export 376 compared, 0 differ |
| 43 | `font-bellanger` | `font.png` | UI Lab bitmap font (grid) | godot | **PASS** | font.chars 94 present; font.glyph_shapes 94/94 glyphs match |
| 44 | `font-bellanger` | `font.png` | UI Lab bitmap font (grid) | phaser3 | **N/A** | has no standard loader for bmfont-text (Phaser reads XML BMFont only) |
| 45 | `font-bellanger` | `font.png` | UI Lab bitmap font (grid) | pixi8 | **PASS** | font.chars 94 present; font.glyph_shapes 94/94 glyphs match |
| 46 | `font-intrepid` | `intrepid.png` | UI Lab bitmap font (grid) | godot | **FAIL** | font.glyph_shapes: 0/94 glyphs match |
| 47 | `font-intrepid` | `intrepid.png` | UI Lab bitmap font (grid) | phaser3 | **N/A** | has no standard loader for bmfont-text (Phaser reads XML BMFont only) |
| 48 | `font-intrepid` | `intrepid.png` | UI Lab bitmap font (grid) | pixi8 | **FAIL** | font.glyph_shapes: 0/94 glyphs match |
| 49 | `ref-bmfont-cozette` | `Cozette-standard.fnt` | reference: BMFont text .fnt (Cozette) | godot | **PASS** | font.chars 62 present; font.glyph_shapes 62/62 glyphs match |
| 50 | `ref-bmfont-cozette` | `Cozette-standard.fnt` | reference: BMFont text .fnt (Cozette) | pixi8 | **PASS** | font.chars 62 present; font.glyph_shapes 62/62 glyphs match |
| 51 | `ref-bmfont-cozette` | `Cozette-standard.fnt` | reference: BMFont text .fnt (Cozette) | phaser3 | **N/A** | has no standard loader for bmfont-text (Phaser reads XML BMFont only) |
