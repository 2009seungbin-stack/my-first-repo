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
| PixiJS 8 | spritesheet JSON with `animations` (playback order), `anchor` = pivot, `related_multi_packs`, `meta.scale` | PixiJS 8.21, rotated and multi-page included | Per-step ms are in `meta.nerulio` |
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

## Results

See **Baseline before/after** below. The head-to-head packer comparison is in
`docs/STUDIO-PACK-H2H.md`.
