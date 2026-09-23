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
        decisions:[{id, label, chosen, confidence:'high'|'medium'|'low', score?, reasons[], alternatives:[{id,label}]}],
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
