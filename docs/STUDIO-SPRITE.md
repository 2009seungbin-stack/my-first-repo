# Studio Sprite workspace (P1a) and the sprite document shape

This file is the contract between the Sprite workspace (P1a, `nerulio/studio-sprite`) and everything
that reads what it edits — first the Pack/Export panel (P1b, `nerulio/studio-pack`), later the Pixel
editor (P2). The shape below is **project format version 2** (`src/studio/core/project.js`).
Version-1 documents (P0 Viewer) are migrated on load; nothing is lost.

## 1. Project and asset

```
Project {format:'nerulio-project', version:2, id, name, createdAt, assets:Asset[], settings:{}}

Asset (kind 'image')
  id, name, kind:'image'
  width, height      the CANVAS: every cel is positioned on this width × height canvas
  layers[]           {id, name, visible, opacity 0–255, blend}              bottom → top
                     blend = an Aseprite blend mode name (src/game/aseprite-blend.js BLEND_MODES)
  frames[]           model.js AssetFrame, IN TIME ORDER. This array *is* the timeline.
  cels[]             {layerId, frameId, blob, x, y, opacity 0–255}          the pixels
  tags[]             animations (see 4)
  slices[]           Aseprite slices, kept for round trips (see 6)
  grid               {w,h,ox,oy,sx,sy} the grid frames were cut with, or null
  source             {name,type,size,lastModified} of the imported file, informational
  import             optional, see 7 (what the importer decided, with confidence)
```

`timeline[]` from version 1 is gone: version 1 had exactly one timeline entry per asset, and its
cels become the shared cels (`frameId:'*'`) described next.

## 2. Where a frame's pixels come from (the one rule to implement)

A **cel** is one layer's pixels at one moment. `blob` is the SHA-256 id of a PNG in the ImageStore
(IndexedDB / `.nerulio images/`); `(x, y)` is where the PNG's top-left pixel sits on the canvas.

```
cel for (layer L, frame F) = the cel with {layerId:L, frameId:F.id}      — F's own pixels on L
                          ?? the cel with {layerId:L, frameId:'*'}        — L's shared picture
                          ?? nothing (L is empty at F)
```

* A **sprite sheet** is one layer with one shared cel (`frameId:'*'`, the whole sheet) and many
  frames whose `sourceRect`s are regions of it. Reordering, duplicating or re-tagging such frames
  never touches pixels.
* A **GIF / APNG / loose frame files / .aseprite** asset has a cel per frame (and per layer), and
  each frame's `sourceRect` is usually the whole canvas `{0,0,width,height}`.
* A sheet frame that gets its own pixels (mirror, a later pixel edit) simply gains its own cel;
  every other frame keeps using the shared one.

**Frame image** (what a packer, exporter or preview must draw), exactly model.js semantics:

1. Composite the visible layers bottom → top on a transparent `width × height` canvas: each cel
   drawn at `(x, y)` with opacity `mul8(cel.opacity, layer.opacity)` and the layer's blend mode.
2. Cut `inner = frame.trimmedRect || frame.sourceRect` out of that canvas.
3. Place it at `(offsetX, offsetY)` on a transparent `canvasWidth × canvasHeight` canvas.

Use the helpers instead of re-implementing it:

```js
import {frameDraws,composeFrame} from '../sprite/frame-image.js';   // pure, no DOM
frameDraws(asset, frame)            // → [{layer, cel, opacity, blend}] bottom → top (only what is drawn)
composeFrame(asset, frame, rgbaOf)  // → {width, height, data:Uint8Array RGBA} exact, Aseprite blending
                                    //   rgbaOf(blobId) → {width,height,data} of that PNG (exact bytes)
import {frameBitmap,frameRGBA} from '../sprite/frame-render.js';    // browser
await frameRGBA(images, asset, frame)   // exact RGBA (PNG decoded in JS, not through a canvas)
await frameBitmap(images, asset, frame) // ImageBitmap for display only
```

Only visible layers are drawn. A frame whose layers are all empty is a valid, fully transparent frame.

## 3. Frames (model.js AssetFrame, all coordinates in pixels)

| field | meaning in the Studio |
|---|---|
| `id`, `name` | stable id; `name` is what exporters use for frame keys |
| `sourceRect` | region of the (composited) canvas this frame shows |
| `trimmedRect` | opaque part inside `sourceRect`, or null (untrimmed) |
| `canvasWidth/Height`, `offsetX/Y` | the frame's own canvas and where `inner` sits on it (alignment tools change these, never pixels) |
| `pivotX/Y` | 0–1 of the frame canvas (pixel = pivot × canvas size) |
| `duration` | milliseconds. The Studio always writes a number (Aseprite default 100) |
| `tag` | name of the first tag containing the frame (kept in sync, informational) |
| `boxes[]` | `{id,type,shape:'rect'|'circle'|'polygon',…}` in frame-canvas pixels (see 5) |
| `collision[]` | polygons `[[x,y],…]` in frame-canvas pixels |
| `metadata` | free-form; `metadata.aseprite` from an .aseprite import, `metadata.jitter` never stored |

## 4. Tags (animations)

```
{id, name, frameIds[], fps, direction:'forward'|'reverse'|'pingpong', loop, repeat, color, metadata?}
```

* `frameIds` is the source of truth (model.js Animation). The timeline draws a tag as a bar over
  every run of consecutive frames it contains; the importer and the timeline create contiguous tags.
* `repeat`: 0 = loop forever (Aseprite's "∞"), n > 0 = play n times. `loop` = `repeat === 0` and is
  kept for model.js/exporters. For ping-pong one repeat is one pass in one direction (Aseprite).
* `direction` 'pingpong' with the frames listed backwards is Aseprite's `pingpong_reverse`.
* Timing comes from each frame's `duration`; `fps` is only a fallback for frames with `duration:null`.
* Playback order for one cycle: `playbackOrder(tag)` from model.js; the Studio's
  `src/studio/sprite/playback.js` adds `repeat` and exact time → frame lookup.

## 5. Boxes, pivots and collision

* Box `type`: `hit`, `hurt`, `interact` or any custom lowercase word (`shield`, `grab` …). Colours:
  hit `#ff4d5e`, hurt `#3fa9ff`, interact `#ffd23f`, custom = stable colour from the name.
* **The same box across frames has the same `id`.** Editing "this box on the whole tag / all frames"
  edits every box with that id in the chosen frames. An exporter that wants per-animation shape
  tracks can group by id.
* Rect `{x,y,w,h}`, circle `{cx,cy,r}`, polygon `{points:[[x,y],…]}` — frame-canvas pixels,
  snapped to whole pixels by the editor.
* `collision[]` holds auto (alpha contour, src/game/contour.js) or hand-drawn polygons.

## 6. Slices

Aseprite slices `{id,name,color,data,keys:[{frame (frame index), bounds, center?, pivot?}]}` are kept
as they were imported so a round trip to `.aseprite` gives them back. On import they are also
mapped into frame pivots / boxes / 9-slice metadata (each mapping listed in `asset.import`).

## 7. Import decisions (`asset.import`)

```
import {kind:'sheet'|'frames'|'gif'|'apng'|'aseprite'|'atlas'|'sprite-lab',
        decisions:[{id, label, kind?, chosen, confidence:'high'|'medium'|'low', score?, reasons[], alternatives:[id…]}],
        applied?, choice?, sliceBoxes?, pivotSlice?,   // importer state needed to re-apply / export
        sourceBlob?}   // the untouched original when the importer changed pixels (colour key)
```

Nothing automatic is silent: the Import panel lists every decision with its confidence and a
one-click alternative; choosing one re-applies the import as a single undoable step.

## 8. Editing rules for other workspaces

* Change documents only through `ctx.execute(ctx.edit(label, doc => nextDoc))` with the pure
  functions in `src/studio/core/project.js` and `src/studio/sprite/sprite-doc.js`.
* Never move pixels by editing `sourceRect` of a frame that has its own cels unless you mean to
  change the visible region.
* New pixels = a new PNG blob (`images.put`) and a new cel; blobs are never mutated.

## 9. The workspace (what P1a ships)

Code: `src/studio/workspaces/sprite.js` + `src/studio/sprite/*`. Pure modules (unit-tested in
`tests/studio-sprite.test.mjs`): `sprite-doc.js` (all edits), `playback.js`, `import-plan.js`,
`grid-rerank.js`, `gif-decode.js`, `apng-decode.js`, `aseprite-bridge.js`, `import-build.js`,
`atlas-data.js`, `frame-image.js`. Browser: `importers.js` (+ `sprite-worker.js`), `timeline-ui.js`,
`panels-ui.js`, `preview-ui.js`, `tools.js`, `overlay.js`, `frame-render.js`. Browser suite:
`tests/studio-sprite-browser.py` (in `tools/regression.py`).

* **Import** (drop anywhere, File › Import, Sprite › Import a folder): sheet → preview + Apply with key
  colour, grid (margin/spacing) or islands (small FX pieces attached, unplaceable ones shown red),
  one animation per row, timing — each a decision with confidence, reasons (ko/en/ja) and one-click
  alternatives; numbered frame files / folders (natural sort, grouped by name); GIF / APNG (all
  frames, delays, disposal); `.aseprite` (layers kept when they compose exactly, else flattened with
  the reason; tags, durations, slices → pivot / boxes / 9-slice as decisions); Sprite Lab JSON;
  Aseprite JSON / TexturePacker JSON / Starling XML with their sheet.
* **Timeline**: layers × frames cels (own ● / shared ○ / empty), tag lanes (drag to create, inline
  rename, drag ends to resize, right-click → Animation panel), durations inline and in bulk, reorder
  by drag, Alt+N duplicate, Alt+Shift+N empty, Alt+C delete, Shift+H flip, click / Shift / Ctrl
  selection, jitter marks.
* **Playback**: Enter, `,` `.`, Home/End, loop inside the tag (direction + repeat), onion skin F3
  (before/after, opacity, tint), floating preview F7 (1:1–8×, backgrounds).
* **Canvas** (Frame view; ` toggles Sheet view with region editing): P pivot, B box, C circle,
  Q polygon (Enter/first point closes, Backspace removes the last point), V select/move/resize,
  arrows nudge, scope this frame / selected / tag / all, box types hit/hurt/interact/custom,
  collision polygon from alpha with a vertex cap, copy boxes to next frame / scope, mirror (pixels +
  pivot + boxes) and mirrored tag copy.
* **Align**: one canvas size with anchor (whole-pixel moves only), jitter measure / fix.
* Sprite › Export .aseprite (layers, tags, durations, pivot/box/9-slice slices).
* The frame selection is shared through `src/studio/core/frame-selection.js` (same file as P1b).

## 10. Evidence (2026-09-23)

* GIF decoder vs Pillow: 29 real GIFs, 408/408 frames exact; in Chromium equal to `ImageDecoder`.
* APNG decoder vs Pillow: 16 files (dispose 0/1/2 × blend 0/1), 132/132 frames exact; equal to `ImageDecoder`.
* `.aseprite` corpus (231 files): 222 imported layered (self-verified), 9 flattened (5 composition
  differs, 4 cel z-index). Import → Studio asset → our writer → **real Aseprite 1.3.18.6**: 231/231
  open without warnings, tags 231/231, durations 231/231, pixels 231/231 (227 compared as sheets,
  4 per frame — Aseprite's own sheet export of their gray/indexed originals differs, per frame they match).
* 16 real assets through the UI (sheets, keyed sheets, 4096² FX sheet, atlas data, frame files, GIFs,
  .aseprite): frames correct 16/16 with the default choices; see the P1a report for the table.

Known limits: rotated atlas frames stay rotated in the sheet (their export is UNVERIFIED); compose-groups
files with group opacity import flattened; the grid re-rank is a documented heuristic on top of
`src/game/grid-detect.js` (the engine itself is unchanged).
