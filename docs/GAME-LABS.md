# Game Labs

Five workspaces that take a 2D game asset from a raw file to something an engine can use, in the
browser, without uploading anything: **Sprite Lab, Pixel Lab, Tile Lab, Texture Lab, UI Lab**.

Priority when trade-offs appear: real workflow > output quality > engine usefulness > performance >
feature count. A button that exists is not a feature; a feature is done when its output has been
re-opened independently and matches what the preview showed.

## Audit of what existed (September 2026)

| Tool | Implementation | Input → output | Limits found | Reused | Lab |
|---|---|---|---|---|---|
| sprite-slicer | classic editor, `primitives.components/grid` | sheet → frames ZIP + JSON | no grid suggestion, no merge of nearby islands, no pivot/animation data | components, rectangle, frameNumber | Sprite |
| frame-normalize | classic editor, `recipes.normalizeInfo`, `primitives.placement` | frames → common canvas ZIP | bounding-box bottom only; no pivot, no jitter measure | placement | Sprite |
| sprite-sheet-maker | task page, `atlas-pack.js` MaxRects, 7 data formats | frames → atlas + data | single page only, no alias de-duplication; the "Godot" format was a `.tres.txt` look-alike (replaced by JSON + helper script, see SPRITE-LAB.md) | packRects, atlasData | Sprite |
| pixel / refiner | task pages, `pixel-engine.js` Oklab quantiser, FS + Bayer dither | image → pixel sprite | palette not shared across frames, no cleanup / AA removal / budget audit | oklab, perceptualPalette, quantizePerceptual, parsePalette | Pixel |
| palette-swap | recipe, `primitives.swap` | one colour → one colour (± shading offset) | no ramp mapping, no hue range, no batch variants | swap | Pixel |
| tile-helper | recipe, `primitives.grid` | sheet → tiles ZIP | exact-division grid only; no margin/spacing, no autotile knowledge | grid | Tile |
| atlas-padding | recipe, `primitives.extrude` | atlas → extruded atlas | fine; becomes a Tile/Texture Lab step | extrude | Tile |
| texture-map | recipe, `primitives.mapTexture` | height → normal / gray / invert / alpha | one kernel, no format flip, no combine | mapTexture | Texture |
| mask-packer | `mask-packer.js` (exact channel bytes under zero alpha) | ≤4 masks → RGBA | no unpack, no engine presets, no set validation | packMasks, packChannels | Texture |
| bitmap-font | recipe, `primitives.fontMetadata`, BMFont text + JSON | grid image → font | fixed cell only; no glyph check, no SDF (the URL now opens UI Lab's Font stage, which adds measured widths, TTF input, a character-set builder and a real SDF — see UI-LAB.md) | fontMetadata | UI |

Unit coverage that existed: `tests/primitives.test.mjs` (15), `tests/atlas.test.mjs` (4); browser
coverage in `tests/recipes-browser.py` and `tests/task-browser.py`.

## Architecture

```
src/game/model.js            shared asset model (AssetFrame, Animation, Atlas) — pure, tested
src/game/*.js                pure algorithms (no DOM): detection, jitter, contours, palettes, autotile…
src/game/exporters/          generic-json.js, godot.js, unity.js — one source: the model
src/task/<lab>.js            one workspace page per Lab (SPA-like: stages share in-memory state)
src/task/registry.js         the Lab id and its intent ids all map to the Lab module
docs/<LAB>.md                input, output, algorithm, limits, export schema per feature
```

* **One workspace per Lab.** A Lab is a single page module with stages. Stages are views over the
  same in-memory project, so nothing is re-uploaded. Intent URLs open the same Lab at the matching
  stage; only tools with their own search intent get a URL.
  **Sprite Lab is built** — `src/task/sprite-lab.js`, five stages (Slice → Normalize → Animate →
  Pivot & boxes → Pack & export) at `/game/sprite-lab/`, with `/sprite-slicer/`,
  `/normalize-sprite-frames/`, `/game/sprite-animation-preview/`, `/game/sprite-pivot-editor/`,
  `/game/hitbox-editor/` and `/game/collision-polygon-generator/` opening it at a stage. See
  [SPRITE-LAB.md §8](SPRITE-LAB.md#8-the-workspace--srctasksprite-labjs) for the UI and what is
  verified about it.
* **Single source of truth.** Preview and export both read the model (`playbackOrder`,
  `playbackTimes`, frame rects, pivots, boxes). Pixels are cropped from the decoded sheet on demand;
  frames are never stored as per-frame RGBA copies. Undo stores model snapshots (small JSON), never images.
* **Simple first.** The default screen is: add file → preview → 3–5 primary actions → Advanced ▾.
  A Lab never shows a toolbar of thirty buttons; on a phone the stage bar scrolls, tools collapse.
* **Heavy work** runs in workers where one exists (`recipe-worker.js`, `component-worker.js`,
  tiled image pipeline), takes an `AbortSignal`, and processes batches sequentially.
* **Engine output is never faked.** No `.tres`, `.meta`, `.aseprite`, `.tmx` look-alikes. Engines get
  the generic JSON (`schemaVersion`, `toolVersion`, `engineTarget`) plus a small, readable import
  helper script. Anything not run in the real engine is labelled UNVERIFIED in the Lab doc.
* **No AI claims.** "Auto", "Smart", "Detect" describe heuristics. Nothing here is called AI.
* **Local-first / Free = Pro quality.** Assets never leave the device; only quota/account calls exist.
* **Sharing.** Settings without asset data (grid, fps, padding, dither…) are URL presets. Image data
  never goes in a URL.

## Export envelope (all Labs)

```json
{ "meta": { "tool": "nerulio-sprite-lab", "toolVersion": "1", "schemaVersion": 1,
            "engineTarget": "generic" | "godot-4" | "unity-2022", "image": "atlas-0.png", "size": {"w":0,"h":0} },
  "frames": { "<name>": { "page":0, "rect":{x,y,w,h}, "rotated":false, "aliasOf":null,
                          "sourceSize":{w,h}, "offset":{x,y}, "pivot":{x,y}, "duration":null,
                          "tag":"", "boxes":[…], "collision":[[[x,y],…]] } },
  "animations": { "<name>": { "frames":["<name>",…], "fps":12, "direction":"forward", "loop":true } } }
```

`rect` is in atlas pixels, origin top-left, y down. `pivot` is normalised on the frame's own canvas
(`sourceSize`); engines with a bottom-left origin convert in their helper, not in this file.

## Status report (2026-09-22, after PR #24)

1. **Branch audited**: `main` at PR #18; Quality Overhaul present; no unpushed work. Labs were built on `nerulio/game-foundation` and integrated one PR at a time (#21 sprite tools + engine, #22 PDF, #23 Pixel + Texture Lab, #24 Sprite + Tile + UI Lab).
2. **Existing game tools reused**: `primitives.js` (components, grid, extrude, swap, mapTexture, fontMetadata), `atlas-pack.js` (MaxRects), `pixel-engine.js` (Oklab), `mask-packer.js`, `recipes.js`. Old ids keep their URLs and open the matching Lab stage (`sprite-slicer`, `frame-normalize`, `tile-helper`, `atlas-padding`, `texture-map`, `bitmap-font`); `pixel`, `refiner`, `palette-swap`, `sprite-sheet-maker`, `mask-packer` keep their own pages.
3. **Shared model**: `src/game/model.js` (AssetFrame / Animation / Atlas, playback order, mirror, validation) — the single source for previews and exporters.
4. **Sprite Lab** built (`src/task/sprite-lab.js`; engine `grid-detect`, `frame-ops`, `jitter`, `contour`, `outline`, `defringe`, `packing`, `project`). Gaps: pivot/box dragging on canvas, point-by-point polygons, Auto slicing above 4 MP, cancellation of pack/collision/export.
5. **Pixel Lab** built (`pixel-lab.js`; `palette`, `pixel-cleanup`, `pixel-check`). Gaps: no worker/AbortSignal, no playback in the strip.
6. **Tile Lab** built (`tile-lab.js`; `tile-grid`, `autotile`, `seams`, `tile-collision`, `godot-tileset`). Gaps: no animated-tile builder, no multi-terrain transitions, no settings-link button.
7. **Texture Lab** built (`texture-lab.js`; `texture-png`, `texture-presets`, `texture-normal`, `texture-fix`, WebGL2 preview). Gaps: no 16-bit output, no undo (nothing edited in place), preview tested on software GL only.
8. **UI Lab** built (`ui-lab.js`; `nine-slice`, `ui-states`, `bmfont`, `sdf`, `contrast`, `ui-layout`). Gaps: no TTF cmap parsing, no MSDF, no kerning, no undo/cancel.
9. **Godot**: Sprite Lab bundle and Tile Lab pack VERIFIED in Godot 4.7.2.stable.official (headless: helper builds the resource, saved, reloaded, compared field by field; tile pack 376 peering bits, 0 mismatches). UNVERIFIED: the `@tool` EditorScript run from the editor GUI, `minimal9`/`corner16` in-engine, Texture Lab and UI Lab Godot notes.
10. **Unity**: UNVERIFIED everywhere (JSON conversions unit-tested; C# importer never run; no `.meta` written).
11. **Generic export**: envelope above with `schemaVersion:1`, `toolVersion`, `engineTarget`; per-Lab schemas in each Lab doc.
12. **Performance**: one decoded sheet + on-demand crops; 100-frame sheet slice 130 ms / pack 84 ms / export 43 ms, 17 MB heap; 2048² sheet grid 406 ms, pack 524 ms, 48 MB heap; 1600 tiles sliced+zipped 2.2 s.
13. **Workers**: existing workers reused (components, recipe, matte/SR); Lab per-frame passes still run on the main thread (gap).
14. **Large assets**: 100 frames and 2048² tested; 1000 frames untested.
15. **Visual tests**: every stage screenshotted at 1440 / 390 / 320 by the building agent and the coordinator; no horizontal overflow.
16. **Output validation**: every export re-opened with Pillow/zipfile/JSON; atlas regions byte-identical to source frames; JSON pivots/durations/boxes equal the UI; tiles byte-identical to sheet regions; channel PNGs exact; 9-slice corners byte-identical.
17. **Browser tests**: `tests/task-browser.py` (≈270 checks incl. all Labs), `tests/recipes-browser.py` (46), Chromium; unit tests 1,555.
18. **Existing regression**: `tools/regression.py` and `tests/service-browser.py` (50) pass on every integration branch.
19. **Not yet production quality**: see gaps in 4–8, plus cancellation/progress for long Lab passes and Firefox/WebKit coverage.
20. **Engine exports UNVERIFIED**: Unity (all), Godot for Texture/UI Lab and the editor-GUI script path.
21. **Limitations**: Chromium-only evidence, so every Lab route is `noindex` and out of the sitemap until the quality suites pass in Firefox too; grid detection is alpha-only; near-duplicate detection is a pixel threshold.
22. **Recommended next**: canvas dragging for pivot/boxes; worker + AbortSignal for the per-frame passes; Firefox evidence for the Lab routes; GIF encoder with adaptive palette and per-frame delay; animated tiles; MSDF only if implemented properly.
