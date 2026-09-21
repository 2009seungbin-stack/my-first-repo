# Sprite Lab — engine

The DOM-free core of Sprite Lab: `src/game/*.js` plus `src/game/exporters/*.js`. Every function
here takes plain data (RGBA `Uint8ClampedArray` + width/height, or the frames of
[`src/game/model.js`](../src/game/model.js)) and returns plain data. No canvas, no worker, no
application state — the UI modules orchestrate these, they do not contain algorithms.

Read [GAME-LABS.md](GAME-LABS.md) first for the shared asset model and the export envelope.

## How pixels get in, and why memory stays flat

Every entry point takes a **source**: either `{data, width, height}` RGBA, or
`{width, height, read(rect) -> {data, width, height}}` — a reader that hands back only the
rectangle asked for. `src/game/pixels.js` normalises both.

Nothing in this engine holds one RGBA copy per frame. A sheet is walked in horizontal bands of at
most a megapixel (`eachBand`); a frame is read one rectangle at a time; an atlas page is drawn one
page at a time; comparing two frames holds exactly two frame canvases. The largest single
allocation in a 100-frame project is one atlas page.

| Module | Peak allocation beyond the input |
|---|---|
| `grid-detect` | one band + row/column profiles + a per-row run-length list (a few KB for a sprite sheet) |
| `frame-ops` | rectangles only, except `detectFrames`, which needs the sheet's pixels for `primitives.components` |
| `jitter` | one or two frame canvases |
| `contour` | one silhouette mask of the frame, one byte per pixel |
| `outline` / `defringe` | one output image + one distance field of the same image |
| `packing` | one atlas page at a time; alias detection holds two frames |

---

## 1. Grid suggestion — `src/game/grid-detect.js`

**Input** a sheet (source), optional `candidates` (default 8/16/24/32/48/64/96/128), `custom`
sizes, `threshold`, `maxMargin` (64), `maxSpacing` (16), `minCells`, `limit`.

**Output** `{profile, runs, suggestions, candidates}`. Each suggestion is a full grid spec —
`cellWidth, cellHeight, marginX, marginY, spacingX, spacingY, columns, rows, cells` — plus
`score` (0…1), `confidence` (`high` ≥ .75, `medium` ≥ .5, else `low`), an `evidence` object of
every number it was scored on, and `reasons`, human-readable sentences the UI can show.

**Algorithm.** "The width divides by 32" is not evidence — a 256×256 sheet divides by 8, 16, 32,
64 and 128. What is evidence:

* **Transparent separator lines — a gate, not a weight.** A spec that claims a margin or a spacing
  whose rows/columns are not (98%+) fully transparent is *discarded*. This is deliberately not a
  scoring term: weighting it would reward inventing a "spacing" out of the blank space a sprite
  happens to leave inside its own cell, which is how "45px cells with 3px gaps" beats the 48px grid
  that actually made the sheet.
* **Periodicity.** Normalised autocorrelation of the row and column alpha-occupancy profiles at the
  cell pitch, means removed first so a flat profile scores 0 rather than 1. Autocorrelation peaks
  also *generate* candidates: a measured pitch P adds every cell size from P down to P − maxSpacing,
  which is how a 40px cell with 5px spacing is found without 40 being a preset.
* **Bounds consistency.** The content bounding box inside each cell: spread of widths, heights,
  left insets and bottom insets, normalised by cell size.
* **Boundary crossings.** How often content runs across a proposed cell boundary, from per-row runs
  horizontally and shared columns of adjacent rows vertically. A strong penalty: this is what kills
  a half-size grid whose lines cut through sprite centres.
* **Splittability.** A blank line still crossing a cell's own content span means the cell is too
  big — it is really two cells. Penalty proportional to how much of the content it splits.
* **Tiling completeness and symmetry.** Cells that account for more of the sheet win; and because
  shifting every cell by the same amount stays consistent with the pixels, the margin that leaves
  content evenly inset inside its cell wins.
* **A prior on common sizes.** Cell sizes in the candidate list (plus anything in `custom`) score
  ×1; others ×0.92 per axis. Sprite sheets are overwhelmingly authored at those sizes, and this is
  what separates "32px cells with 2px gaps" from the numerically equivalent "34px cells".

One answer per *pitch* is returned: "45px cells with 3px gaps" and "48px cells edge to edge" are
the same slicing, so they compete and only the better description survives.

**Limitations**
* A cell size outside the candidate list and not backed by a measurable periodicity needs `custom`.
  The suggestion says so in `reasons`.
* Perspective, rotation, per-row different cell sizes and diagonal layouts are not modelled.
* `minCells: 1` is needed to describe a single-sprite sheet; the default 1 allows it.
* `primitives.MAX_FRAMES` (4096) caps the cells in one suggestion.
* Alpha only. A sheet with an opaque background colour instead of transparency must be keyed first.

**Export schema** — none; a grid spec is a settings preset (shareable in a URL, no image data).

## 2. Frames — `src/game/frame-ops.js`

**Input** a source and either detected components or explicit rectangles; then model frames.

**Output** `mergeRects` → merged rectangles with their `parts`; `readingOrder` → the same
rectangles with a `row` index; `framesFromRects` → `{frames, empty}` model frames;
`normalizeFrames` → `{frames, canvasWidth, canvasHeight, align, padding, shifts, warnings}`.

**Algorithm**
* **Merge.** A sprite is rarely one connected island — a sword, a hat, a cape, a limb drawn with a
  one-pixel gap all come back as separate alpha components. Union-find over rectangle gaps: two
  rectangles join when their gap is at most `distance` on *both* axes, so merging chains correctly
  through a middle part. The sweep is ordered by x and breaks out of the inner loop once no further
  rectangle can be within the gap.
* **Reading order.** Rows by vertical centre with a tolerance (`auto` = 35% of the median height,
  which keeps a tall sprite and a short one on the same row), then left to right inside a row.
  `rightToLeft` is available for sheets authored that way.
* **Trim.** The alpha bounding box inside each rectangle becomes `trimmedRect`. The pixels do not
  move: `sourceRect` still says where the cell was, `offsetX/offsetY` where the opaque part sits.
* **Normalize.** A common canvas from the largest frame plus padding, or an explicit size.
  Alignment is one of `center, top, bottom, left, right, bottom-center, top-left, custom`
  (`custom` takes `anchorX/anchorY` 0…1). Every frame is then *moved by whole pixels* onto that
  canvas, and its pivot, hitboxes and collision polygons move with it, so the model stays
  self-consistent. `tightenFrames` is the opposite direction, for packing.

> **"bottom" is the bounding-box bottom.** It is the lowest opaque pixel of the frame, not foot
> detection. A cape, a shadow, a dust puff or a dropped weapon below the feet lowers it, and then
> the character appears to sink. That is a real limitation, not a bug: use `custom` with an anchor,
> or set pivots per frame, when the silhouette has furniture below the feet.

**Limitations**
* Pixels are never scaled. An explicit canvas smaller than the largest frame is refused with the
  size it would need, rather than resampling artwork.
* `detectFrames` needs the whole sheet's pixels because `primitives.components` labels them, and
  inherits its 4-megapixel analysis cap. Everything after component labelling is rectangles only.
* Merging is rectangle-gap based, so two sprites whose *bounding boxes* come within `distance`
  merge even if no pixel does. Lower `distance` or slice on a grid instead.

## 3. Jitter, duplicates and the loop seam — `src/game/jitter.js`

**Input** a source, model frames, and either an animation or an explicit frame order.

**Output** `frameAnchors` → `{bbox, alphaCentroid, boundsCentre, bottom, pivot, opaque, coverage,
blank}` in canvas pixels; `jitterReport` → `{reference, points, deltas, series, metrics, residual,
warnings}`; `autoFixJitter` → `{frames, shifts, canvasWidth, canvasHeight, grown, before, after,
beforeResidual, afterResidual, warnings}`; plus `findDuplicates`, `loopSeam`, `frameDifference`,
`onionLayers`.

**Algorithm**
* **Anchors.** Per frame: the alpha-weighted centroid, the bounding-box centre, the middle of the
  lowest opaque row, and the declared pivot. Coordinates put integers on the pixel grid's corners,
  so a 4px box starting at x=2 has its centre at 4.
* **Series.** `metrics` describes frame-to-frame movement — which includes *deliberate* motion.
  `residual` describes only what is left after subtracting a smoothed path, which is what "jitter"
  actually means. `series` carries `x, y, smoothX, smoothY, residualX, residualY` ready to graph.
* **Smoothing.** A local quadratic least-squares fit (Savitzky–Golay). Measured gain on a
  16-frame sine: **0.998** at window 5, 0.973 at 9, 0.939 at 11 — against **0.852 / 0.559 / 0.387**
  for a plain moving average at the same windows. So a bob or an arc passes through almost
  unchanged while noise is still averaged away; `mode: 'mean'` is available but flattens motion.
* **Auto-fix.** Integer offsets only. Without `preserveTrend` every frame is pinned to
  `anchorIndex`'s anchor position; with it, only the wobble around the smoothed path is removed.
  If a shift would push artwork off the canvas, the canvas grows on the needed sides and *all*
  frames move together, so they stay aligned. No pixel is resampled: the source rectangle of every
  frame is byte-identical afterwards.
* **Duplicates.** A per-frame content hash groups candidates; byte comparison of the two frame
  canvases confirms. Near-duplicates come from a 16×16 coarse silhouette signature (Hamming
  distance) confirmed by a bounded mean pixel difference. Blank frames have no opaque pixel;
  almost-empty ones fall under a coverage threshold (0.5% by default).
* **Loop seam.** First versus last of the playback order: anchor jump, silhouette IoU, mean and
  maximum pixel difference, and a warning when they are identical (in a looping animation that
  frame plays twice).

**Limitations**
* `autoFixJitter` requires every frame to share one canvas and says so — run `normalizeFrames`
  first. Aligning frames of different canvas sizes has no well-defined meaning.
* Shifts are whole pixels, so a fix against a fractional anchor (the alpha centroid) leaves up to
  half a pixel of residual. Against an integer anchor with integer jitter it cancels exactly.
* `reference: 'pivot'` aligns *declared* pivots. On a project where every frame declares the same
  pivot it cannot show wobble, and the report says so instead of returning zeros as if all were well.
* Near-duplicate search is limited to `maxPairs` (4000) same-size pairs and reports `truncated`.

## 4. Collision shapes — `src/game/contour.js`

**Input** one RGBA image (a frame canvas, or any rectangle), or a frame via `frameCollision`.

**Output** `{polygons, error, winding, threshold, tolerance, simple, warnings, shapes, vertices}`.
Each polygon has `points`, `vertices`, `area`, `tracedVertices`, its own `tolerance`, `error` and
`holes`. `error` is `{maxDeviation, areaOriginal, areaSimplified, areaDeltaPercent}`.

**Algorithm**
* **Tracing.** On the *pixel lattice*, not through pixel centres: for every opaque pixel whose
  neighbour is transparent, the shared edge is a directed boundary segment, and following those
  segments gives a closed path along real pixel corners — exact integer geometry, no interpolation.
  This is the contour marching squares produces for a binary field, written as edge following.
* **Winding.** An outer contour comes back **clockwise as drawn on screen** (y grows downward),
  which is a positive shoelace sum under Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ). Holes come back the other way.
  `winding: 'ccw'` reverses both.
* **Corner touches.** Where two regions meet only at a corner the boundary is ambiguous. The walk
  always takes the clockwise turn, which separates them; and because the same lattice point is then
  visited twice, the path is cut at every repeated point, turning a figure-eight back into separate
  simple rings. The cut runs on the full lattice path, before collinear runs are merged, so a point
  that a straight run merely passes over is caught too.
* **Simplification.** Ramer–Douglas–Peucker, run on the two halves of the ring (cut at its two most
  distant points) so the answer does not depend on where the trace started. Tolerance rises by
  ×1.25 until the vertex cap is met. **Any tolerance that makes the outline cross itself is
  skipped** and a lower one is used — a self-intersecting collision polygon is a bug in every
  physics engine that takes one. `tests/game-contour.test.mjs` asserts simplicity with an explicit
  segment-intersection test over 40 random multi-blob images at three caps (>100 polygons checked),
  and that intersection test is itself unit-tested against crossings, shared endpoints, collinear
  overlap and a bow tie.
* **Error.** `maxDeviation` is the Hausdorff distance between the traced and simplified rings, in
  pixels; `areaDeltaPercent` the area difference.
* **Fallbacks.** `shape: 'hull'` (Andrew's monotone chain), `'rect'` (alpha bounds), `'circle'`
  (the smallest enclosing circle, found exactly from the hull — not a centroid-plus-max-radius
  approximation).

**Limitations**
* The vertex cap is a cap, not a target: if the starting tolerance already fits under it, that
  result is returned (a 56px disc at cap 24 returns the same 16 vertices as at cap 16).
* `padding` dilates the silhouette by whole pixels *before* tracing, so padded coordinates go
  negative outside the canvas. That is correct for an outward-padded shape; the caller decides
  whether to clamp.
* Holes are returned as traced, not simplified, and only when `holes: true`.
* Concave decomposition into convex pieces is not done. Engines that need convex shapes
  (Box2D-style) must decompose, or use `shape: 'hull'`.

**Export schema** — polygons go into `AssetFrame.collision` (frame-canvas pixels, y down) and are
carried into every export unchanged; the Godot helper turns them into `CollisionPolygon2D` nodes,
the Unity exporter into rect-relative y-up physics shapes.

## 5. Outline and de-fringe — `src/game/outline.js`, `src/game/defringe.js`

**Input** one RGBA image.

**Output** `outline` → `{data, width, height, offsetX, offsetY, grown, changed, mask, …}` where
`mask` is 1 outside the sprite and 2 inside it. `defringe` → `{data, width, height,
changed:{count, mask, maxDelta}, before, after, alphaUnchanged, warnings}`; `detectFringe` →
`{type, colour, interiorColour, meanEdgeLuma, meanInteriorLuma, delta, spread, confidence,
edgePixels, interiorPixels}`.

**Algorithm**
* **Outline.** A whole-pixel distance field from the silhouette (`outer`), or from the outside into
  it (`inner`). 8-connectivity counts a diagonal step as one, so corners stay square; 4-connectivity
  does not, so corners come out bevelled. Painted pixels get exactly the colour given —
  **no anti-aliasing, no blending, one colour and one alpha** — which is what keeps a 1px outline
  one pixel at any zoom. `expand: true` grows the canvas by `radius` so a sprite touching its own
  edge is not clipped, and reports `offsetX/offsetY` so frame offsets can follow.
* **De-fringe.** A cut-out stores straight (un-premultiplied) RGBA, but the edge pixels of an image
  that was flattened over white hold `body·coverage + white·(1−coverage)` in their RGB while their
  alpha says `coverage`. Re-composited over anything darker, the leftover white shows as a rim.
  `detectFringe` compares the mean edge colour with the interior colour immediately beside it and
  classifies `white`, `black`, `colour` or `none`. `defringe` then replaces the edge RGB with the
  interior colour propagated outwards — breadth-first, each pixel averaging the pixels one step
  closer to the interior, which spreads the colour smoothly instead of stamping one nearest pixel's
  colour over the band — and leaves **every alpha byte exactly as it was**. `bleed: true` also
  rewrites fully transparent pixels within the radius, which stops a filtered or mip-mapped texture
  pulling the old halo back in. `changed.mask` is the before/after difference for an edge-zoom view.

**Limitations**
* De-fringing is a correction, not a reconstruction. The original coverage-weighted colour is gone
  and cannot be recovered; the propagated interior colour is the best available answer.
* An image with no fully opaque interior has nothing to propagate from, and says so.
* `detectFringe` needs at least 8 partly transparent pixels and some opaque interior touching them.
  A hard-edged pixel-art sprite has no soft edge at all, so it correctly reports `none` — and
  `defringe` on it is a no-op, with a warning saying so.
* Outline radius is whole pixels 1…64. There is no soft or glow outline; that would not be
  pixel-art safe and is not offered.

## 6. Packing — `src/game/packing.js`

**Input** a source, model frames, `{maxSize, padding, extrude, pot, dedupe, layout, columns,
maxPages}`.

**Output** `{atlas, pages, efficiency, paddedEfficiency, aliases, unique, blank, warnings,
rotation}`. `atlas` is the model's Atlas: `{width, height, padding, extrude, pages, pageSizes,
frames: {[frameId]: {page, x, y, w, h, rotated, aliasOf}}}`.

**Algorithm.** MaxRects best-short-side-fit from `src/atlas-pack.js`, plus the three things a
single-page packer gets wrong:

* **More frames than fit.** Frames are ordered largest first and each page starts as the longest
  prefix that fits, found by binary search (prefix packing is monotone, so the search is exact and
  costs ~log₂n attempts instead of n). A prefix alone wastes space — one 90px frame would hold a
  128px page on its own while 40px frames queue behind it — so a bounded top-up pass then walks the
  rest of the list and keeps whatever still fits beside it. Every frame records its `page`.
* **Frames that are the same pixels.** A held pose or a re-used idle is stored once; every other
  frame gets `aliasOf` pointing at the same region. Identity is a content hash *confirmed byte for
  byte*, so a hash collision cannot alias two different frames.
* **Padding versus extrude.** `padding` is empty space between neighbours so a filtered texture
  cannot sample across. `extrude` is a belt of *copied edge pixels* around each frame, which is what
  stops a seam at a non-integer scale. The recorded `x/y/w/h` is always the sprite itself — the belt
  sits outside it — so a reader that ignores extrude still gets exactly the right pixels.

`blitPage` draws one page (with its extrude belts); `readRegion` reads a rectangle back out;
`findOverlaps` checks across every page, with or without padding.

**Rotation is not offered at all.** `ROTATION_SUPPORTED` is `false` and `rotate: true` throws with
the reason. Godot's `AtlasTexture` has no rotation and neither does Unity's sprite importer, so a
rotated region could not be described to two of the three exporters. A packing mode that silently
breaks an export is worse than the few percent of area it saves.

**Limitations**
* Aliasing compares stored (trimmed) pixels, so two frames with identical artwork at different
  canvas offsets alias to one region and keep their own offsets — correct, and it is why
  `findDuplicates` in `jitter.js`, which compares whole canvases, can disagree with it.
* Page sizes are computed from the placements rather than from `packRects`' own figure, which adds
  one padding too many.
* `maxPages` defaults to 64 and is an error, not a silent truncation.

**Export schema** — the Atlas is what fills `frames[].page`, `frames[].rect`, `aliasOf`, and
`meta.images`/`meta.pageSizes` in every export.

## 7. Exporters — `src/game/exporters/`

All three read the same model and the same Atlas. Frame rects come from the packer; pivots,
per-frame durations, tags, hitboxes and collision from the model; and the playback sequence from
`playbackOrder`/`playbackTimes` — **the same two functions the preview plays**. So a ping-pong
animation cannot repeat its end frames in one place and not the other: there is only one definition
of the sequence.

### Envelope (`generic-json.js`)

```json
{ "meta": { "tool": "nerulio-sprite-lab", "toolVersion": "1", "schemaVersion": 1,
            "engineTarget": "generic" | "godot-4" | "unity-2022",
            "image": "atlas.png", "images": ["atlas.png"], "pages": 1,
            "size": {"w":0,"h":0}, "pageSizes": [{"w":0,"h":0}],
            "padding": 2, "extrude": 0, "rotated": false },
  "frames": { "<name>": { "page":0, "rect":{"x":0,"y":0,"w":0,"h":0}, "rotated": false,
                          "aliasOf": null, "sourceSize":{"w":0,"h":0}, "offset":{"x":0,"y":0},
                          "pivot":{"x":0.5,"y":1}, "duration": null, "tag": "",
                          "boxes": [], "collision": [[[0,0]]] } },
  "animations": { "<name>": { "frames": ["<name>"], "fps": 12, "direction": "forward",
                              "loop": true,
                              "playback": { "frames": ["<name>"], "durations": [83.33] },
                              "totalMs": 333.3 } } }
```

`rect` is in atlas pixels, origin top-left, y down. `offset` is where the stored pixels sit inside
the frame's own canvas (`sourceSize`). `pivot` is normalised on that canvas. `boxes` and `collision`
are in frame-canvas pixels, y down. One page is `atlas.png`; several are `atlas-0.png`,
`atlas-1.png`, … so a single-page export carries no index nobody needs. Frame keys are made unique
(`same`, `same_2`) and file-safe.

An export **throws** rather than emit something an engine would read as a lie: no atlas at all, a
frame with no atlas region, an animation naming a frame that is not there, a duplicate animation
name, an unknown `engineTarget`.

### Godot 4 — VERIFIED

`godotProject()` adds `meta.godot`, a `godot` block, and per-frame/per-animation `godot` fields for
the two things that need converting into Godot's own units:

* `animations[name].godot = {speed, loop, frames:[{frame, duration}]}` where `duration` is
  **relative** — `add_frame`'s duration is a multiple of one tick at the animation's speed, so a
  250 ms frame in a 12 fps animation is `250 × 12 / 1000 = 3.0`. The frame list is already in
  **playback order**, because `SpriteFrames` has no direction of its own: reverse and ping-pong are
  baked.
* `frames[name].godot.margin = [offset.x, offset.y, sourceSize.w − rect.w, sourceSize.h − rect.h]`,
  which is what makes `AtlasTexture` report a trimmed frame's original size again.

`godotBundle()` ships `atlas.json` plus `addons/nerulio_sprite/`:
`nerulio_sprite_frames.gd` (the builder: `load_data`, `load_textures`, `atlas_texture`, `build`,
`import`, `build_scene`, `verify` — static functions, so nothing depends on `class_name` being
registered), `nerulio_sprite_import.gd` (an `@tool EditorScript`), `nerulio_sprite_import_cli.gd`
(`extends SceneTree`, for headless runs) and a README.

**No `.tres` or `.tscn` text is written by this project.** A hand-written resource look-alike is a
guess at a format that changes between versions. The helper calls `SpriteFrames.add_frame` and
`ResourceSaver.save`, and the scene path calls `PackedScene.pack` on nodes built through the API,
so the engine writes whatever format the installed Godot actually uses.

Pivots, tags, hitboxes and collision polygons have nowhere to live on `SpriteFrames`, so they ride
along as resource metadata under the key `nerulio`; `build_scene()` turns the collision polygons
into real `CollisionPolygon2D` nodes under a `StaticBody2D`, and offsets the `AnimatedSprite2D` so
the pivot lands on the node's origin.

**Version differences.** Godot **4.x only**. Godot 3.x `SpriteFrames` has no per-frame duration at
all — a 3.x import would silently lose every per-frame timing — and its node is `AnimatedSprite`,
not `AnimatedSprite2D`. There is also no `set_frame_duration` in 4.x, so durations must be passed
at `add_frame` time, which the helper does.

#### The Godot run that was actually done

```
Godot 4.7.2.stable.official.ed1daf0bf   (official win64 console build,
                                         github.com/godotengine/godot/releases/tag/4.7.2-stable)

node tests/fixtures/game/godot-validate.mjs --godot <path>/Godot_v4.7.2-stable_win64_console.exe

# which runs:
<godot> --headless --path <tmp>/nerulio-godot-validate --script res://godot-validate.gd
```

`tests/fixtures/game/godot-validate.mjs` builds a deliberately awkward project — six frames of
three different sizes, artwork that does not fill its cell (so trimming and margins matter), two
animations (15 fps forward looping, 8 fps ping-pong non-looping), mixed per-frame durations
(default / 250 ms / 500 ms), collision polygons, `extrude: 1` — writes it as a real Godot project
with the shipped helper, then in the engine: imports it, saves with `ResourceSaver`, **reloads it
from disk with the cache bypassed** (`CACHE_MODE_IGNORE`) and compares against the export.

Checked and matching: animation names, frame counts, `get_animation_speed`, `get_animation_loop`,
every `get_frame_duration`, every `AtlasTexture.region`, every `margin`, every `get_size()` against
`sourceSize`, `filter_clip`, the atlas page dimensions, and 18 pixels sampled out of the PNG by
`Image.get_pixel` against what the packer wrote. The scene path packs and saves, with the expected
`CollisionPolygon2D` children.

All three shipped scripts are also loaded and reparsed in the engine, with their base types
checked (`RefCounted`, `EditorScript`, `SceneTree`) — that is the only way to test the
`EditorScript`, which a headless run cannot execute. And the **shipped** headless runner is then
run on its own, not only the builder it shares with the harness:

```
<godot> --headless --path . --script res://addons/nerulio_sprite/nerulio_sprite_import_cli.gd -- atlas.json res://from_cli.tres
animations=["attack", "run"]
attack frames=6 speed=8.000000 loop=false
run frames=4 speed=15.000000 loop=true
problems=0
```

The check was confirmed able to fail: changing the helper's margin width by 5 px made it report
`reports size (33.0, 40.0), expected (38.0, 40.0)` and exit non-zero.

Re-run it with `GODOT_BIN=<path> node --test tests/game-exporters.test.mjs`; without `GODOT_BIN`
that test is skipped rather than quietly assumed.

### Unity — UNVERIFIED

**Unity is not installed on the machine this was written on, and no part of the Unity path has ever
been run inside the editor.** The coordinate conversions are unit-tested numerically; the importer
is not tested at all. `UNITY_VERIFIED` is `false`, and the label appears in `meta.unity.verified`,
`unity.verified`, `unity.notes`, the C# file itself and `UNITY-README.md`. **No `.meta` file is
generated** — writing Unity's own asset metadata by hand is exactly the kind of guess this project
refuses.

The conversions, each a place a sprite ends up subtly wrong if skipped:

| | Ours | Unity | Conversion |
|---|---|---|---|
| Texture origin | top-left, y down | bottom-left, y up | `y_unity = pageHeight − (y + h)` |
| Pivot | normalised on the frame canvas, y down | normalised inside the sprite rect, y up | `x = (pivotX·canvasW − offsetX)/rect.w`, `y = (rect.h − (pivotY·canvasH − offsetY))/rect.h` |
| Border | `metadata.border` `{left,top,right,bottom}` | `Vector4(left, bottom, right, top)` | reordered |
| Physics shape | frame-canvas pixels, y down | rect-relative, y up | `{x − offsetX, rect.h − (y − offsetY)}` |

A bottom-centre pivot on a frame whose artwork floats above the canvas bottom converts to a **y
below 0**. That is legal in Unity, is not clamped, and is the only way to keep the frame aligned
with the rest of the animation. `alignment` is `9` (`SpriteAlignment.Custom`).

`unityBundle()` ships `atlas.json`, `Editor/NerulioSpriteImporter.cs` (an `AssetPostprocessor`-free
menu item under Tools ▸ Nerulio that sets `TextureImporter` to Multiple sprite mode, point filter,
no mipmaps, uncompressed, then writes `SpriteRect`s through `ISpriteEditorDataProvider` and physics
outlines through `ISpritePhysicsOutlineDataProvider`) and the README. The one line most likely to
need adjusting — re-centring the physics outline on the rect's centre — is commented as such.

### `src/atlas-pack.js` — the fake Godot format is gone

The sprite-sheet tool's `godot` option used to emit a `.tres.txt` file: a `.tres` look-alike with
`region = Rect2(...)` lines that no Godot version reads. It now emits honest JSON
(`engineTarget: "godot-4"`, `region` and `margin` in `AtlasTexture` terms) and points at the helper
script above. `ATLAS_FORMATS.godot.ext` changed from `tres.txt` to `json`; `src/task/atlas.js`
needed **no change** (it reads `ATLAS_FORMATS[format].ext` for both the label and the filename) and
`tests/atlas.test.mjs` was updated to assert the JSON.

While packing multi-page atlases, one real bug in `packRects` surfaced and is fixed: the first bin
guess was not clamped to `maxSize`, so a set whose total area exceeded `maxSize²` could be packed
into that oversized guess and returned — four 78px frames at `maxSize: 128` came back as a 160px
atlas. It now returns the limit or explains that the images do not fit.

---

## Verification

Measured with `node tests/fixtures/game/measure.mjs` on the fixtures in
`tests/game-fixtures.mjs` (all generated from a seeded PRNG, so every number is reproducible).
Timings are one run on a Windows 11 laptop, Node 24 — they say "interactive", not "benchmarked".

### Grid suggestion

| Sheet | Size | Top suggestion | Score | Result |
|---|---|---|---|---|
| 32px cells, margin 4, spacing 2, 15 cells | 176×108 | 32×32, margin 4, spacing 2, 5×3 | 0.896 high | **VERIFIED** exact |
| 48px cells edge to edge, 12 cells | 288×96 | 48×48, margin 0, spacing 0, 6×2 | 0.920 high | **VERIFIED** exact (16 and 24 divide too and score lower) |
| 24×48 cells, margin 3, spacing 5, 7px leftover | 117×107 | 24×48, margin 3, spacing 5, 4×2 | 0.883 high | **VERIFIED** exact, leftover reported |
| 40px cells (not a preset) with `custom:[40]` | 176×88 | 40×40, margin 2, spacing 4, 4×2 | 0.883 high | **VERIFIED** exact |
| six unrelated sprites, no grid at all | 200×140 | 96×128, 2×1 | 0.605 **medium** | **VERIFIED**: never confident about a sheet that has no grid |

### Frames

| Case | Result | |
|---|---|---|
| irregular sheet, 6 sprites of 6 different sizes | 6 components → 6 frames, each rect equal to the drawn sprite | **VERIFIED** |
| two characters of 6 loose islands each, merge distance 4 | 12 islands → 2 frames (6 parts each) | **VERIFIED** |
| 100 frames of mixed size → one canvas, bottom-centre | 53×53, every bounding-box bottom on the canvas bottom | **VERIFIED** |
| normalize with an explicit canvas too small | refused, with the size it would need | **VERIFIED** (pixels are never scaled) |
| pivot, hitboxes, collision after a normalize shift | all moved by the same integer delta | **VERIFIED** |

### Jitter

| Case | Before | After | Result |
|---|---|---|---|
| 12-frame walk, ±3px injected jitter, alpha centroid | max **6.00px**, RMS **2.33px** | max **0.00px**, RMS **0.00px** | **VERIFIED** (target was ≤ 0.5px) |
| source pixels after the fix | — | byte-identical; offsets only | **VERIFIED** |
| 16-frame walk, 15px pan + 12px bob + jitter: RMS distance from the intended path | x 1.66 / y 1.54 | `preserveTrend` x **0.56** / y **0.79** | **VERIFIED** |
| motion left in the result (range) | intended x 15 / y 12px | `preserveTrend` x **14** / y **12px**; without it x **0** / y **0px** | **VERIFIED**: the trend survives, and the plain mode really does flatten it |
| duplicate scan, 100 frames (20 deliberate repeats) | — | 20 exact, 0 near, 0 blank, 30.5 ms | **VERIFIED** |
| loop seam of the shaken walk | — | 5.00px jump, silhouette IoU 0.254, 2 warnings | **VERIFIED** |
| 100-frame ping-pong measured in playback order | — | 198 points, ends not doubled | **VERIFIED** |

### Contours

| Shape | Traced | Simplified | Max deviation | Area error | Result |
|---|---|---|---|---|---|
| 56px disc, cap 6 | 140 | 4 | 8.19px | 33.8% | **VERIFIED** (a 4-gon of a circle is this bad — the number is the warning) |
| 56px disc, cap 8 | 140 | 8 | 2.68px | 6.8% | **VERIFIED** |
| 56px disc, cap 12 | 140 | 12 | 1.58px | 1.5% | **VERIFIED** |
| 56px disc, cap 16 / 24 / 32 | 140 | 16 | 0.96px | 1.0% | **VERIFIED** (the cap is a cap, not a target) |
| 6 loose body parts, cap 12 each | — | 6 polygons, 28 vertices | 0.89px | 1.6% | **VERIFIED** |
| 56px disc, convex hull | 140 | 40 | 1.11px | 3.3% | **VERIFIED** |
| 40 random multi-blob images × 3 caps, holes on | — | >100 polygons | — | — | **VERIFIED** none self-intersect, by explicit segment-intersection test |
| single 8×10 rectangle, tolerance 0 | — | exactly `[[4,6],[12,6],[12,16],[4,16]]`, area 80 | 0 | 0% | **VERIFIED** pixel-exact, positive shoelace |

### Outline and de-fringe

| Case | Result | |
|---|---|---|
| radius 1, 8-connected, around one pixel | 8 pixels; radius 2 → 24 (Chebyshev) | **VERIFIED** |
| radius 1, 4-connected, around one pixel | 4 pixels; radius 2 → 12 (Manhattan diamond) | **VERIFIED** |
| every painted pixel of a radius-2 outline on a disc | exactly one colour and one alpha, no gradient | **VERIFIED** no anti-aliasing |
| inner outline on an 8×8 block | silhouette unchanged (64 opaque pixels), 28 recoloured | **VERIFIED** |
| white-haloed 32px sprite, detection | `white`, edge luma **166.7** vs interior **73.8** (delta **93.0**) | **VERIFIED** |
| the same after `defringe(radius: 3)` | edge luma **74.2**, delta **0.5**, type now `none`, 148px changed | **VERIFIED** (186× closer to the interior) |
| alpha after de-fringing (and with `bleed`) | **every byte identical** | **VERIFIED** |
| blue halo on a warm body (210,160,40), mean edge RGB | **112.8 / 98.4 / 150.1** → **209.5 / 159.9 / 40.6**, i.e. the body's own colour; type now `none` | **VERIFIED** corrected per channel, not just darkened |
| de-fringe a hard-edged sprite | 0 pixels changed, warning that no halo was found | **VERIFIED** |

### Packing

| Case | Pages | Stored | Efficiency | Result |
|---|---|---|---|---|
| 100-frame fixture, padding 2, no de-dupe | 1 × 418×372 | 100 | **70.8%** | **VERIFIED** every region reads back as its source pixels |
| 100-frame fixture, padding 2, de-dupe | 1 × 373×332 | 80 (+20 aliased) | 70.6% | **VERIFIED** smaller page, aliases resolve |
| 100-frame fixture, padding 0 | 1 × 369×332 | 100 | **89.8%** | **VERIFIED** |
| 100-frame fixture, padding 2, power of two | 1 × 512×512 | 100 | 42.0% | **VERIFIED** (the cost of rounding up, stated not hidden) |
| 100-frame fixture, padding 2, extrude 1 | 1 × 441×446 | 100 | 55.9% | **VERIFIED** belts are copied edge pixels |
| 40 frames of 48–87px at `maxSize: 128` | **22 pages** | 40 | **86.4%** | **VERIFIED** no page over 128px, every frame on exactly one page |
| overlap check across all pages, with and without padding | — | — | — | **VERIFIED** zero overlaps |
| `rotate: true` | — | — | — | **VERIFIED** refused with the reason |

### Exporters

| Claim | How | Result |
|---|---|---|
| Godot 4 import: animation names, frame counts, fps, loop, per-frame durations, regions, margins, reported frame sizes, atlas size, `filter_clip` | built by the shipped GDScript inside **Godot 4.7.2.stable.official**, saved with `ResourceSaver`, reloaded with the cache bypassed, compared to the JSON | **VERIFIED** — all match |
| Godot 4: the atlas regions hold the right pixels | 18 pixels read out of the PNG with `Image.get_pixel` and compared with what the packer wrote | **VERIFIED** |
| Godot 4: the scene path | `build_scene` → `PackedScene.pack` → `ResourceSaver.save`, `CollisionPolygon2D` children counted | **VERIFIED** |
| Godot 4: the shipped scripts parse | all three loaded and reparsed in the engine, base types `RefCounted` / `EditorScript` / `SceneTree` | **VERIFIED** |
| Godot 4: the shipped headless runner | run on its own, reports both animations with the exported frame counts, speeds and loop flags, `problems=0` | **VERIFIED** |
| Godot 4: the `@tool EditorScript` running in the editor UI | — | parses in the engine, but **not executed** — a headless run cannot run an `EditorScript` |
| the Godot check can fail | helper's margin sabotaged by 5px | **VERIFIED** — reported and exited non-zero |
| no fake engine files | the bundle contains no `.tres`, `.tscn` or `.meta`, and the helper assembles no resource text | **VERIFIED** by test |
| preview == export for forward, reverse and ping-pong | the exported `playback` block compared against `playbackOrder`/`playbackTimes` for all three | **VERIFIED** |
| Godot relative durations | 250 ms at 12 fps → 3.0, 500 ms → 6.0, default → 1.0 | **VERIFIED** numerically and in the engine |
| Unity coordinate conversions | rect flip, pivot renormalisation (including the negative case), border reorder, physics-shape flip | **VERIFIED** numerically only |
| Unity import actually works | — | **UNVERIFIED** — Unity was never run. Labelled as such in the JSON, the C# file, the README and here. |

### What is not done

* No UI. The slicer page and the Sprite Lab workspace are other agents' work; this is the engine
  plus the exporter layer only.
* `AbortSignal` is accepted by `detectGrid`, `alphaProfile`, `runLengths` and `packFrames`. The
  per-frame loops in `jitter`, `contour`, `outline` and `defringe` do not take one yet — they run
  per frame, so the caller can cancel between frames, but a single very large frame cannot be
  interrupted.
* `findDuplicates`' near-duplicate search is O(n²) over same-size pairs with a hard `maxPairs` cap
  of 4000; above that it reports `truncated: true` rather than running for minutes.
* Concave-to-convex decomposition of collision polygons is not implemented (see §4).
* The Godot `@tool EditorScript` parses in the engine but has never been *run* from the editor UI,
  because a headless run cannot execute an `EditorScript`. The builder it calls, and the headless
  runner that calls the same builder, are both verified.
* Unity, as above: **UNVERIFIED**.
