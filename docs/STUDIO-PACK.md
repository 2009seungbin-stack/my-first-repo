# Studio Pack & Export (P1b)

The **Pack & Export** workspace of `/game/studio/` packs every frame of the project into atlas
pages and writes engine bundles. Everything runs in the browser: the packer and the encoders run in
a worker, nothing is uploaded. It reads the document the Sprite workspace edits
(`docs/STUDIO-SPRITE.md`), so tags, per-frame durations, pivots and boxes reach the engines.

## Code

| Path | What |
|---|---|
| `src/game/pack/bins.js` | Rectangle bins. MaxRects with bssf, blsf, baf, bl and cp (contact point, edge-indexed); Skyline bl/waste; Guillotine baf + shorter-leftover-axis split; 90° rotation |
| `src/game/pack/layout.js` | Pages: strip-width search around √area × every heuristic × sort order, then height bisection. Sizes: auto, POT, square, POT-square, fixed, multiple-of. Border and shape padding, extrude, multipack. The work is fixed, never a clock, so the output is deterministic |
| `src/game/pack/sprites.js` | Colour-exact cut and nearest scaling. Trim modes (none / trim / crop-keep / crop), alpha threshold, alias of identical frames (hash + byte check). Page drawing: rotation (clockwise for TexturePacker JSON, counter-clockwise for Spine), extrude belt, premultiply. `canvasOf` / `compose` build frame images |
| `src/game/pack/packer.js` | `packAtlas(frames, sources, settings)` → scale variants → pages + frame table. `publicResult` strips the pixels |
| `src/game/pack/png.js` | Exact PNG writer: adaptive row filters, indexed PNG when a page has ≤ 256 colours, no gAMA/iCCP/sRGB chunks |
| `src/game/export/*.js` | Exporters (pure text) plus `bundle.js`, which draws pages, frame strips, animated previews and `.aseprite`, and `targets.js`, the registry: presets, what each engine requires, verification labels |
| `src/game/export/project-model.js` | Studio document v2 → packer input and export model. Frames that draw the same cels composite one shared source, so a sheet is composited once |
| `src/studio/workspaces/pack.js`, `pack-worker.js`, `pack.css`, `strings-pack.js` | The UI stage (ko/en/ja) and the worker |
| `src/studio/core/frame-selection.js` | Frame selection shared with the Sprite timeline, both ways |

## What the packer does

- **Algorithms.** MaxRects with all five TexturePacker rules, Skyline and Guillotine. "Try all" keeps the smallest page.
  - Ties go to the squarer page: each unit of aspect ratio adds 2 %, and a page over 3:1 wins only when nothing squarer fits.
  - Effort: fast / normal / best.
- **Rotation.** 90°, only when the target can read it. Each preset sets it and each exporter enforces it (see the table).
- **Trim.**
  - none: the full frame is kept.
  - trim: the frame's size and offset are kept (`sourceSize`, `spriteSourceSize`, Godot margin).
  - crop-keep: the frame becomes smaller and the pivot moves, so the art stays in place.
  - crop: size and position are dropped.
  - Alpha threshold: 0 keeps every visible pixel.
- **Alias.** Frames whose visible pixels are identical are stored once, even with different offsets. RGB under alpha 0 is ignored.
- **Page size.** Multipack up to 64 pages. Page limit 8–16384 px. POT, square and fixed sizes. Border padding, shape padding, extrude.
- **Scale variants.** @0.5x, @1x, @2x, @3x, @4x, nearest-neighbour only. Integer upscales are exact pixel doubles.
  - Each variant is its own atlas: `name@2x.png`.
  - Pixi `meta.scale` follows the variant.
- **Premultiplied alpha.** Optional.
- **Colour-exact.** PNGs are decoded in JS (`src/game/texture-png.js`), so the baseline's gAMA/cHRM drift cannot happen. Nothing touches a canvas. Only interlaced PNGs fall back to the browser decoder, and the stage says so.
- **Polygon packing: not done.**
  - None of the engines in the verification harness (Godot, Unity, Phaser 3/4, Pixi 8, Defold, LÖVE, Spine) draws a mesh atlas from exported data, so polygon output could not be verified.
  - For pixel art with rectangular frames the gain is small.
  - It stays a stretch item.

## Exports and how each was verified

A 'verified' target was loaded and drawn by the real engine from a bundle downloaded from the
Studio UI. The drawn pixels were compared with the ORIGINAL corpus file (`tools/engine-verify`,
`docs/ENGINE-VERIFY.md`).

| Target | Files | Engine run | Notes |
|---|---|---|---|
| Godot 4 | `.tres` SpriteFrames (AtlasTexture region + margin, relative durations, loop), `.tscn` (AnimatedSprite2D, `texture_filter = Nearest`, pivot offset), `.png.import` (lossless, no mipmaps, `fix_alpha_border=false`) | Godot 4.7.2: loads the `.tres`, draws every animation frame at 1×, and draws the shipped scene at 4× (sharp) | Rotation refused. Godot's default `fix_alpha_border` recolours every pixel under alpha 20 (measured on the 4096² FX sheet), so the bundle ships its own import settings |
| Unity 6 | `.unity.json` and `Editor/NerulioSpriteImporter.cs`: Sprite / Multiple / Point / Uncompressed sprite rects with pivots, plus one AnimationClip per tag | Unity 6000.5.3f1 batch mode: rects, pivots (one common anchor), pixels, clip keys and durations | Rotation refused |
| Phaser 3 / 4 | atlas JSON hash (multiatlas when there are several pages) and `.anims.json` for `anims.fromJSON` | Phaser 3.90 and 4.2 | Rotation refused: both draw rotated TexturePacker frames mirrored |
| PixiJS 8 | spritesheet JSON with `animations` (playback order), `anchor` = pivot, `related_multi_packs`, `meta.scale` | PixiJS 8.21, rotated and multi-page included; the @2x scale variant (2026-09-24, `tools/engine-verify/pixi_scale.py`): PixiJS reads resolution 2 from `meta.scale` and draws it at the @1x size with twice the density, each frame an exact 2× nearest double; with `meta.scale` "1" it draws double size (negative control) | Per-step ms are in `meta.nerulio`. Only @2x was run, not @0.5x/@3x/@4x |
| Aseprite JSON hash / array | frames with `duration`, `meta.frameTags` (contiguous from..to, direction, repeat) and `meta.slices` (pivot, boxes) | Phaser `load.aseprite` + `createFromAseprite` (3.90, 4.2); PixiJS 8.21 frames | Frame keys are `"0".."n"`, which Phaser's createFromAseprite needs |
| `.aseprite` | one pivot-aligned canvas per frame, tags, durations and slices, written by `src/game/aseprite.js` | Aseprite 1.3.18 CLI opens it and renders every frame | |
| GameMaker | `spr_<name>_<tag>_stripN.png` per tag (pivot-aligned cells) + `gamemaker.json` (origin, speed, ms) | **UNVERIFIED in GameMaker** (no headless GameMaker). The strips are cut the way GameMaker's importer cuts them and compared with the source | |
| Defold | `.atlas` (full-canvas frame images + animation groups) and `.tilesource` (grid) under `assets/<name>/` | Defold bob.jar 1.13.1 builds them; the built texture set's UVs are read back from the built texture | One fps per animation |
| LÖVE | Lua quads table + `nerulio_atlas.lua` helper + `main.lua` | LÖVE 11.5 draws every frame and steps every animation through the shipped helper; 4× sharp | Rotation refused |
| Spine / libGDX | `.atlas` (bounds, offsets from the bottom, `rotate:90` stored counter-clockwise) | Spine runtime spine-canvas 4.2 draws every region, rotated and trimmed | libGDX itself not run |
| Starling / Sparrow XML | per-page XML, frameX/Y for trimmed frames, pivots | Phaser 4.2 (trimmed or not); **Phaser 3.90 draws trimmed XML frames wrongly** (its AtlasXML passes the sizes to setTrim in the wrong order) | The **Sparrow XML (Phaser 3)** preset turns trim off and passes in Phaser 3.90 and 4.2 |
| CSS sprites | `.css` + preview `.html`, `image-rendering: pixelated` | Chromium draws every class from the shipped stylesheet (screenshot compared) | Trim and rotation off |
| Generic JSON | `schemaVersion`, `engineTarget`, TexturePacker-compatible `frames`, Pixi-readable `animations`, `animationData`, pivots, boxes, collision | Phaser 3.90, 4.2 and PixiJS 8.21 load it as a TexturePacker hash | |
| GIF / APNG | one file per tag; GIF with an adaptive palette (global or per frame), per-frame delays and 1-bit transparency; APNG exact | Pillow decodes every frame and delay | |
| WebM | VP9 (VP8 fallback) from the browser's VideoEncoder, own muxer, 4× nearest on a solid background | Chromium plays it; ffprobe counts the frames | For sharing, lossy |

A target that needs a setting it cannot do without (Godot: no rotation; Aseprite JSON: one page) re-packs
for that export and shows the change next to its button before you click.

## The stage (UI)

- **Opening it.** Pack & Export is the third workspace tab. Opening it packs every frame in the project, live, in a worker.
  - A new pack starts 120–250 ms after a settings or document change.
  - A pack still running when you change something is cancelled (the worker is terminated).
  - A **Cancel** button shows the phase.
- **Canvas.** The atlas page is drawn at an integer zoom with one outline per stored frame.
  - Page tabs (PageUp/PageDown) and variant tabs (@2x …).
  - The used % with a meter, the totals (frames, stored, identical, pages, ms), the layout rule that won, and the texture memory.
- **Settings.** A preset per engine, the basic settings, and an Advanced section with everything else.
  - Saved in the project (`doc.settings.pack`) as undoable edits (Ctrl+Z).
- **Export.**
  - A target picker, a file name and one "Export for X" button.
  - The verification line: "Loaded in Godot 4.7.2", or UNVERIFIED in amber.
  - When the target needs a different setting, what it changes is shown next to the button.
  - Below that, every format is one line with its own Export button, and the last export's files and notes are listed.
- **Frame list and selection.**
  - The **Packed frames** panel lists canvas → stored size, page and flags (trimmed, rotated, same as …).
  - Hovering a row outlines its region; clicking a row or a region selects it.
  - The selection is shared with the Sprite timeline (`src/studio/core/frame-selection.js`), both ways.
- **Implicit animation.** With no tags (loose images in the Viewer), the panel says which implicit animation the engines will get, before export.
- **Phone (390 px).** Every panel is a tab of the bottom sheet, with touch-size buttons.

## Performance (measured)

| What | Where | Time |
|---|---|---|
| 1,000 frames (40×25 sheet of 32 px cells, random trimmed sizes), normal effort | Chromium worker | pack **2.4 s**; whole round trip in the UI 3.2 s; Godot export (1,000 AtlasTextures) 0.23 s |
| the same, best effort | Chromium worker | long enough to cancel; Cancel stops it at once |
| 4096² FX sheet (`hit-yellow.png`, 14 frames of 1024²) | Chromium | import + apply 1.8 s, pack 2.1 s (page 3018×1676), Godot export 1.3 s |
| 1,000 random rects, layout only | Node | fast 0.9 s, normal 2.9 s, best 12 s |
| spaceshooter (294 frames) | Node | 0.42 s normal, 0.9 s best |

## Tests

| Test | What | Result |
|---|---|---|
| `tests/studio-pack.test.mjs` (node:test) | Every bin and heuristic without overlap; the layout invariants for every size mode (inside the page and border, padding respected, each sprite placed once); multipack and limit errors; determinism (layout and PNG bytes); trim / crop-keep / crop / none; alias with a byte check; clockwise and counter-clockwise rotation read-back; extrude belt; nearest @2x; premultiply; the schema of every exporter; out-of-canvas boxes; GIF/APNG containers; the WebM muxer; the document adapter; shared selection; string parity | 30 / 30 |
| `tests/studio-pack-browser.py` (in `tools/regression.py`) | The full UI flow with real CC0 frames: live pack, undo, presets, rotation refusal, shared selection with the Sprite timeline, all 17 file exports, a byte-exact Phaser atlas from gAMA/cHRM frames, GIF/APNG exact, WebM through ffprobe and Chromium playback, multipack, @2x, Cancel, 1,000 frames, the 4096² sheet, ko/ja, 390 px, no network, no page errors | 63 / 63 |

## Head-to-head

The packer against CodeAndWeb's free packer, GAPTools and free-tex-packer on five real frame sets
(size, exactness, features) is in `docs/STUDIO-PACK-H2H.md`. With rotation allowed the Studio
makes the smallest sheet on all five sets; its frames are exact on all five.

## Baseline before/after (2026-09-23, real corpus, real engines)

`python tools/engine-verify/baseline.py --port 4471` was run on this branch, with every case driven
through its UI and loaded into the real engines. The Studio cases drive `/game/studio/?ws=sprite`:

1. Drop the file(s).
2. For a sheet, keep the Sprite import's plan and press Apply.
3. Open **Pack & Export** and press **Export** next to the target.

The two out-of-canvas box cases are the exception: they are built with the same modules in Node.

| Rows | PASS | FAIL | N/A |
|---|---|---|---|
| **Before** — historical baseline (main @ c741bbe), sprite exporter rows (Sprite Lab + sprite-sheet-maker) | 5 | 25 | — |
| Before — all exporter rows, including Tile Lab and fonts (docs/ENGINE-VERIFY.md) | 8 | 32 | 2 |
| Today's Labs on this branch (after trust-fixes), same sprite cases | 25 | 5 | — |
| **After — Studio Pack & Export, 49 engine runs** | **47** | **2** | — |
| Whole run today (references, Labs, Tile Lab, fonts, Studio) | 83 | 13 | 4 |

**The 2 Studio FAILs are one known engine bug.** Trimmed Starling/Sparrow XML in **Phaser 3.90**
comes out wrong, because its `AtlasXML` parser passes the trimmed and full sizes to `setTrim` in the
wrong order.

- The same files pass in Phaser 4.2.
- The **Sparrow XML (Phaser 3)** preset turns trim off, and it passes in Phaser 3.90 and 4.2.
- The rows are kept to show the bug.

**Other findings from today's run (not in the Studio's code):**

- `sl-hit-4096-auto-godot` (Sprite Lab) fails `frames.art` in Godot. Godot's default PNG import has
  `process/fix_alpha_border=true`, which recolours every pixel under alpha 20: faint sparks
  `(255,204,0,10)` come back `(255,255,230,10)`. The Studio's Godot bundle ships a `.png.import`
  with that setting off and passes. The Sprite Lab bundle does not ship one yet.
- `ssm-*-hash-rotate` in Phaser 3/4 (sprite-sheet-maker) fail: Phaser draws rotated TexturePacker
  frames mirrored. The Studio's Phaser preset never rotates.
- The six Tile Lab cases timed out in the baseline's UI drive (phase 1). The Tile Lab page flow
  changed in trust-fixes and `baseline.py`'s Tile Lab recipe needs an update. This is outside P1b;
  the harness itself is fine.

| # | Case | Asset | Export | Engine | Result | Answers (historical baseline → today's Lab) |
|---|---|---|---|---|---|---|
| 1 | `sp-samurai-godot` | `sprites/oga-samurai/samurai.png` | godot4 | godot | **PASS** | `sl-samurai-auto-godot` FAIL → PASS |
| 2 | `sp-ninja-viewer-godot` | `sprites/oga-ninja/1x/` | godot4 | godot | **PASS** | `sl-samurai-grid-noanim-godot` FAIL → PASS |
| 3 | `sp-samurai-json` | `sprites/oga-samurai/samurai.png` | json | phaser3 | **PASS** | `sl-samurai-grid-generic` FAIL → PASS |
| 4 | `sp-samurai-json` | `sprites/oga-samurai/samurai.png` | json | phaser4 | **PASS** | `sl-samurai-grid-generic` FAIL → PASS |
| 5 | `sp-samurai-json` | `sprites/oga-samurai/samurai.png` | json | pixi8 | **PASS** | `sl-samurai-grid-generic` FAIL → PASS |
| 6 | `sp-samurai-unity` | `sprites/oga-samurai/samurai.png` | unity | unity | **PASS** | `sl-samurai-grid-unity` PASS → PASS |
| 7 | `sp-toon-godot` | `sprites/kenney-toon-characters/character_femaleAdventurer_sheet.png` | godot4 | godot | **PASS** | `sl-toon-auto-godot` FAIL → PASS |
| 8 | `sp-samurai-magenta-godot` | `sprites/derived/samurai_magenta_m4_s2.png` | godot4 | godot | **PASS** | `sl-samurai-magenta-grid-godot` FAIL → PASS |
| 9 | `sp-rogue-magenta-godot` | `sprites/kenney-roguelike-characters/roguelikeChar_magenta.png` | godot4 | godot | **PASS** | `sl-rogue-magenta-auto-godot` FAIL → PASS |
| 10 | `sp-hit-4096-godot` | `sprites/oga-hit-effect/hit-yellow.png` | godot4 | godot | **PASS** | `sl-hit-4096-auto-godot` - → FAIL |
| 11 | `sp-toon-pixi` | `sprites/kenney-toon-characters/character_femaleAdventurer_sheet.png` | pixi | pixi8 | **PASS** | (new) |
| 12 | `sp-rogue-phaser` | `sprites/kenney-roguelike-characters/roguelikeChar_magenta.png` | phaser | phaser3 | **PASS** | (new) |
| 13 | `sp-rogue-phaser` | `sprites/kenney-roguelike-characters/roguelikeChar_magenta.png` | phaser | phaser4 | **PASS** | (new) |
| 14 | `sp-ninja-phaser` | `sprites/oga-ninja/1x/` | phaser | phaser3 | **PASS** | `ssm-ninja-hash` FAIL → PASS |
| 15 | `sp-ninja-phaser` | `sprites/oga-ninja/1x/` | phaser | phaser4 | **PASS** | `ssm-ninja-hash` FAIL → PASS |
| 16 | `sp-ninja-pixi` | `sprites/oga-ninja/1x/` | pixi | pixi8 | **PASS** | `ssm-ninja-hash` FAIL → PASS; `ssm-ninja-hash-rotate` FAIL → PASS |
| 17 | `sp-ninja-aseprite-array` | `sprites/oga-ninja/1x/` | aseprite-json-array | phaser3 | **PASS** | `ssm-ninja-array` FAIL → PASS |
| 18 | `sp-ninja-aseprite-array` | `sprites/oga-ninja/1x/` | aseprite-json-array | phaser4 | **PASS** | `ssm-ninja-array` FAIL → PASS |
| 19 | `sp-ninja-starling` | `sprites/oga-ninja/1x/` | starling | phaser3 | **FAIL** | `ssm-ninja-xml` FAIL → PASS |
| 20 | `sp-ninja-starling` | `sprites/oga-ninja/1x/` | starling | phaser4 | **PASS** | `ssm-ninja-xml` FAIL → PASS |
| 21 | `sp-ninja-sparrow-p3` | `sprites/oga-ninja/1x/` | sparrow-phaser3 | phaser3 | **PASS** | `ssm-ninja-xml` FAIL → PASS |
| 22 | `sp-ninja-sparrow-p3` | `sprites/oga-ninja/1x/` | sparrow-phaser3 | phaser4 | **PASS** | `ssm-ninja-xml` FAIL → PASS |
| 23 | `sp-ninja-godot` | `sprites/oga-ninja/1x/` | godot4 | godot | **PASS** | `ssm-ninja-godot` FAIL → PASS |
| 24 | `sp-ninja-aseprite-hash` | `sprites/oga-ninja/1x/` | aseprite-json | phaser3 | **PASS** | (reference-style Aseprite JSON) |
| 25 | `sp-ninja-aseprite-hash` | `sprites/oga-ninja/1x/` | aseprite-json | phaser4 | **PASS** | (reference-style Aseprite JSON) |
| 26 | `sp-ninja-aseprite-hash` | `sprites/oga-ninja/1x/` | aseprite-json | pixi8 | **PASS** | (reference-style Aseprite JSON) |
| 27 | `sp-archer-phaser` | `sprites/oga-skeleton-archer/attack-frames/` | phaser | phaser3 | **PASS** | `ssm-archer-hash` PASS → PASS; `ssm-archer-hash-rotate` FAIL → FAIL |
| 28 | `sp-archer-phaser` | `sprites/oga-skeleton-archer/attack-frames/` | phaser | phaser4 | **PASS** | `ssm-archer-hash` PASS → PASS; `ssm-archer-hash-rotate` FAIL → FAIL |
| 29 | `sp-archer-pixi` | `sprites/oga-skeleton-archer/attack-frames/` | pixi | pixi8 | **PASS** | `ssm-archer-hash` PASS → PASS; `ssm-archer-hash-rotate` FAIL → PASS |
| 30 | `sp-archer-starling` | `sprites/oga-skeleton-archer/attack-frames/` | starling | phaser3 | **FAIL** | `ssm-archer-xml` FAIL → PASS |
| 31 | `sp-archer-starling` | `sprites/oga-skeleton-archer/attack-frames/` | starling | phaser4 | **PASS** | `ssm-archer-xml` PASS → PASS |
| 32 | `sp-archer-sparrow-p3` | `sprites/oga-skeleton-archer/attack-frames/` | sparrow-phaser3 | phaser3 | **PASS** | `ssm-archer-xml` FAIL → PASS |
| 33 | `sp-archer-sparrow-p3` | `sprites/oga-skeleton-archer/attack-frames/` | sparrow-phaser3 | phaser4 | **PASS** | `ssm-archer-xml` PASS → PASS |
| 34 | `sp-ninja-unity` | `sprites/oga-ninja/1x/` | unity | unity | **PASS** | (new: Unity clips) |
| 35 | `sp-ninja-love` | `sprites/oga-ninja/1x/` | love | love | **PASS** | (new: no LÖVE exporter before) |
| 36 | `sp-ninja-defold` | `sprites/oga-ninja/1x/` | defold | defold | **PASS** | (new: no Defold exporter before) |
| 37 | `sp-ninja-defold` | `sprites/oga-ninja/1x/` | defold | defold | **PASS** | (new: no Defold exporter before) |
| 38 | `sp-samurai-defold` | `sprites/oga-samurai/samurai.png` | defold | defold | **PASS** | (new) |
| 39 | `sp-samurai-defold` | `sprites/oga-samurai/samurai.png` | defold | defold | **PASS** | (new) |
| 40 | `sp-samurai-love` | `sprites/oga-samurai/samurai.png` | love | love | **PASS** | (new) |
| 41 | `sp-ninja-spine` | `sprites/oga-ninja/1x/` | spine | spine | **PASS** | (new: Spine atlas, trimmed) |
| 42 | `sp-archer-spine` | `sprites/oga-skeleton-archer/attack-frames/` | spine | spine | **PASS** | (new: Spine atlas, rotated) |
| 43 | `sp-samurai-css` | `sprites/oga-samurai/samurai.png` | css | css | **PASS** | (new: CSS sprites drawn by Chromium) |
| 44 | `sp-samurai-gamemaker` | `sprites/oga-samurai/samurai.png` | gamemaker | pillow | **PASS** | (new, strips decoded only: GameMaker itself UNVERIFIED) |
| 45 | `sp-ninja-aseprite-file` | `sprites/oga-ninja/1x/` | aseprite | aseprite | **PASS** | (new: .aseprite opened by the Aseprite CLI) |
| 46 | `sp-ninja-gif` | `sprites/oga-ninja/1x/` | gif | pillow | **PASS** | (new) |
| 47 | `sp-ninja-apng` | `sprites/oga-ninja/1x/` | apng | pillow | **PASS** | (new) |
| 48 | `sp-ninja-boxes-aseprite` | `sprites/oga-ninja/1x/` | aseprite | aseprite | **PASS** | (new) |
| 49 | `sp-ninja-boxes-godot` | `sprites/oga-ninja/1x/` | godot4 | godot | **PASS** | (new) |

