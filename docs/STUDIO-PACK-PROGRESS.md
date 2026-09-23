# Studio Pack & Export (P1b) — progress checkpoint

Branch `nerulio/studio-pack`, based on `origin/nerulio/ship-studio-p0a`. It has merged
`origin/nerulio/trust-fixes` and `origin/nerulio/studio-sprite` (the document shape v2 contract in
`docs/STUDIO-SPRITE.md`). This work stopped at a checkpoint on the coordinator's instruction: no
full regression and no full engine-verify baseline run yet.

## Done (committed, unit-tested)

**Packer** (`src/game/pack/`, pure, deterministic, 28/28 tests in `tests/studio-pack.test.mjs`)

- `bins.js`
  - MaxRects with five heuristics: bssf, blsf, baf, bl, cp. cp uses an edge index; `openBottom` handles strips.
  - Skyline (bl and waste) and Guillotine (baf with the shorter-leftover-axis split).
  - Rotation by 90°.
- `layout.js`
  - "Pick best" over heuristics × sort orders × strip widths, with a height bisection at the end.
  - The amount of work is fixed and never depends on a clock.
  - Pages: auto, POT, square, POT-square, fixed, and multiple-of sizing.
  - Border padding and shape padding, and extrude.
  - Multipack up to `maxPages`, with clear errors (`too-big`, `no-fit`, `too-many-pages`).
  - Measured on 1,000 random frames in Node: fast 0.9 s, normal 2.9 s, best 12 s. Used area 0.87–0.89 before padding.
- `sprites.js`
  - Colour-exact cut, with nearest-neighbour scaling (scale variants).
  - Trim modes: none, trim, crop-keep (the pivot moves) and crop. Alpha threshold.
  - Alias/dedupe: a hash, then a byte check on the visible pixels.
  - Page render: clockwise rotation (the TexturePacker convention), extrude belt, optional premultiplied alpha.
  - `canvasOf` and `compose` build frame and strip images.
- `packer.js`: `packAtlas` returns variants, each with pages and a frame table. `publicResult` strips the pixels.
- `png.js`: exact PNG with filtered RGBA, or indexed PNG when there are 256 colours or fewer. It writes no gAMA/iCCP chunk.

**Exporters** (`src/game/export/`, pure text plus the bundle builder)

- `targets.js`: the registry, per-engine `preset` and `requires` (which the export enforces), and verification labels.
- `godot.js`: a native SpriteFrames `.tres` with AtlasTexture region/margin, relative durations and loop, using relative page paths. Also a `.tscn` with `texture_filter = Nearest` and the pivot offset, and a README.
- `unity.js`: a JSON with Unity rects and pivots, plus `NerulioSpriteImporter.cs`. The script applies the sprite rects and builds one AnimationClip per tag (`CreateClips`).
- `atlas-json.js`:
  - Phaser: atlas, or multiatlas when there are several pages, plus `.anims.json` for `anims.fromJSON`.
  - Pixi 8: `animations`, anchors and `related_multi_packs`.
  - Aseprite JSON hash and array: frameTags as contiguous runs, repeat, pivot and box slices.
  - Generic JSON: `schemaVersion` and `engineTarget`, and TexturePacker-compatible so web engines can load it.
- `engines.js`:
  - GameMaker: one `spr_x_stripN.png` per tag, with pivot-aligned cells, plus `gamemaker.json`.
  - Defold: `.atlas` and `.tilesource` with full-canvas frames, under `assets/<name>/`.
  - LÖVE: a quads Lua table plus `nerulio_atlas.lua` and `main.lua`.
  - Spine/libGDX `.atlas`, Starling/Sparrow XML, and CSS with an HTML preview.
- `anim.js`: GIF (adaptive palette per frame or global, LZW, disposal 2, delays in 1/100 s, loop) and APNG (exact, delays in ms).
- `webm.js`: an EBML muxer, with VideoEncoder in the browser.
- `bundle.js`: pages, compose jobs, animation previews, and `.aseprite` through `src/game/aseprite.js`.
- `project-model.js`: the adapter for document v2. Frames that share cels share one composited source. It builds an implicit animation when there are no tags.

**Studio UI**

- `src/studio/workspaces/pack.js`: the "Pack & Export" workspace, registered in `src/studio/main.js`.
  - Live pack in `src/studio/pack-worker.js`, with progress and cancel (the worker is terminated).
  - Atlas page in the canvas at integer zoom, page tabs, variant tabs, and used %.
  - Frame list at the bottom. Frame highlighting goes through `src/studio/core/frame-selection.js` (a new hook for the timeline).
  - Preset, basic and advanced settings, saved in `doc.settings.pack` as undoable edits.
  - Export panel: one button per target, a verification badge, a line for the settings the target changes, and the last export's notes.
- `src/studio/strings-pack.js`: ko/en/ja strings, parity-tested.
- `src/studio/pack.css`.
- Checked by hand in Chromium at 1440×900 and 390×844 with the ninja frames: the pack runs and the Godot export downloads.

**Engine verification**

`tools/engine-verify` changes are additive. The existing modes are unchanged.

- New detect kinds: `godot-spriteframes-tres`, `phaser-multiatlas`, `love-quads`, `defold-atlas`, `defold-tilesource`, `anim-gif`, `apng` and `aseprite-file`. Phaser `anims` files are attached to their atlas.
- Godot probe: new mode `spriteframes-tres`, which loads the shipped `.tres` and renders the shipped `.tscn` at 4×.
- Web harness: Phaser `anims.fromJSON` and `load.multiatlas`, Pixi linked sheets, and anchor forced to 0 for slot drawing.
- Unity probe: calls `CreateClips` and reads the clip keyframes back.
- New runners:
  - `love_runner.py`: LÖVE 11.5 draws through the shipped helper.
  - `defold_runner.py`: a bob.jar 1.13.1 build, then the built texture and UVs are read back.
  - `file_runners.py`: Pillow for GIF/APNG, and the Aseprite CLI for `.aseprite`.
- `studio_pack_bundle.mjs` builds bundles in Node with the same modules.

These passed on the real ninja frames (`sprites/oga-ninja/1x`, which carry gAMA), built in Node and checked in each engine:

- Godot 4.7.2: 6/6 art and placement, 4× sharp (0 px differ).
- Phaser 3 and 4 (atlas + anims).
- Pixi 8, with rotated frames.
- Aseprite JSON in Phaser 3/4 and Pixi 8.
- Generic JSON in Phaser 3/4 and Pixi 8.
- Sparrow XML with trim off in Phaser 3/4.
- Starling XML with trim in Phaser 4.
- Unity 6000.5.3f1: rects, anchor and clip durations.
- Defold: atlas and tilesource build, with built pixels 6/6.
- LÖVE, 4× sharp.
- GIF, APNG and `.aseprite` (Aseprite CLI).

Measured engine limits, now reflected in presets and docs:

- Phaser 3.90 and 4.2 draw rotated frames mirrored, so the Phaser preset never rotates.
- Phaser 3.90's AtlasXML swaps trimmed and full sizes, so the Sparrow XML (Phaser 3) preset uses trim none.

## In progress (committed, not yet run)

- `tools/engine-verify/baseline.py`: `STUDIO_CASES`, 25 cases `sp-*`, driven through the Studio UI, with `studio_expectation()` and `drive_studio()`. It compiles. It has NOT been run yet.

## Next steps

1. Run `python tools/engine-verify/baseline.py --port 4471` for the full before/after table (it takes about 30+ minutes including Unity). Fix any UI-drive issues.
2. `tests/studio-pack-browser.py`: import real frames, run the live pack, switch page tabs, check the frame highlight, and download Godot/Phaser ZIPs to compare with the Node bundle. Add it to the suite list in `tools/regression.py`.
3. Run the 1,000-frame and 4096² performance runs in the worker through the UI (hit-yellow 4096² case, plus a synthetic 1,000 frames) and record the times.
4. Head-to-head table. Competitor numbers are ready in `scratchpad/p1/studio-pack/h2h/RESULTS.md`:
   - CodeAndWeb free: no trim or rotation, blurry preview.
   - GAPTools: MaxRects+trim; its canvas re-encode breaks gAMA and semi-transparent pixels. Exact only on samurai.
   - free-tex-packer.com is dead; free-tex-packer-core was run instead.

   Still to do: pack the same 5 sets (ninja, archer, samurai, toon, spaceshooter) with our packer and write the table.
5. `docs/STUDIO-PACK.md` (architecture, formats, verification table, UNVERIFIED list) and the ENGINE-VERIFY.md update.
6. Then run `npm test`, `python tools/regression.py` and `python tests/service-browser.py`, take screenshots into `scratchpad/p1/studio-pack/`, and report.

## Known gaps / UNVERIFIED

- GameMaker: no headless engine, so it is UNVERIFIED (labelled in the UI and the README).
- Spine/libGDX `.atlas` and CSS: UNVERIFIED, no runtime run.
- WebM: the muxer is unit-tested; encoding in Chromium has not been checked yet.
- Polygon packing: not done.
- Colour key and sheet auto-slice belong to the P1a import. The magenta baseline cases will stay FAIL until then.
- The timeline selection link needs P1a to call `setFrameSelection` / `onFrameSelection`.

## Files touched outside the Pack area

- `src/studio/main.js`: registers `pack`.
- `tools/check.mjs`: adds the `src/game/pack` and `src/game/export` folders.
- `src/studio/core/frame-selection.js`: new.
- `src/task/sprite-lab.js`: merge-conflict resolution only.
- `tools/engine-verify/*`: additive.
