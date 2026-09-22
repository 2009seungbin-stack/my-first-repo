# Sprite Lab

One workspace — [`src/task/sprite-lab.js`](../src/task/sprite-lab.js) — over a DOM-free engine:
`src/game/*.js` plus `src/game/exporters/*.js`. Every engine function takes plain data (RGBA
`Uint8ClampedArray` + width/height, or the frames of [`src/game/model.js`](../src/game/model.js))
and returns plain data. No canvas, no worker, no application state: the page orchestrates these,
it does not contain algorithms.

Read [GAME-LABS.md](GAME-LABS.md) first for the shared asset model and the export envelope.
[§8](#8-the-workspace--srctasksprite-labjs) is the UI: the stages, what each one does, and what is
verified about it.

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
* **Choosing the distance — `autoMergeDistance`.** `detectFrames(src, {distance:'auto'})` picks it
  and says why, because "one component = one frame" is wrong far more often than it is right and
  guessing a fixed 2px is wrong the other way. Trying 0…N one by one would do the same work N times;
  only the distances at which *something new joins* can change the answer, and `mergeThresholds`
  lists exactly those (for each pair, `max(gapX, gapY)`). Each candidate is then scored on
  * **frame-size consistency** (×0.5): `1 − stdev/mean` of the group widths and heights. Seventeen
    islands of a body, a hat and a sword score 0.41; the six characters they belong to score 0.89.
  * **box fill** (×0.2): opaque pixels over the group rectangles' area. This is what collapses when
    a merge glues two sprites together and their joint box is mostly empty.
  * **stability** (×0.3): how far the next threshold is, i.e. how long this frame count survives.
    On the fixture, 6 frames hold from 2px to 24px; 17 and 15 last one step each.
  A single group's consistency is undefined, so its own fill stands in for it, **capped at 0.8** —
  "everything merged into one box" can never beat a genuinely uniform set. And if the raw components
  are already ≥85% the same size (`UNIFORM_AT_ZERO`), nothing is merged at all: ten 20×20 sprites
  drawn 1px apart stay ten frames. The chosen distance is returned as the slider value with the
  sentence the UI shows, so it is an adjustable default, never a hidden decision.
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

## 8. The workspace — `src/task/sprite-lab.js`

**Input** one image: a sprite sheet, dropped, pasted, picked or handed off from another tool.
**Output** a ZIP — atlas page(s) plus the chosen bundle (Generic JSON / Godot 4 / Unity) — and,
separately, per-frame PNGs, a GIF preview and a project JSON.

One page, five stages, **one decoded sheet**. Nothing is re-uploaded between stages, and nothing is
re-decoded: the sheet is decoded once and every stage reads rectangles out of it through a lazy
`source` (`ctx.getImageData(rect)`), which is the engine's own contract. A 100-frame project never
holds 100 RGBA copies; the largest allocation is one atlas page.

```
Slice ──▶ Normalize ──▶ Animate ──▶ Pivot & boxes ──▶ Pack & export
```

The stage bar is the only navigation. The primary button is always "the next stage", and on the last
stage it is the download — so the default path is five clicks with no decisions, and every decision
is optional. Each stage shows **3–5 primary controls**; everything else is under `Advanced ▾`. On a
phone the stage bar scrolls horizontally, the workspace becomes one column
(`grid-template-columns:minmax(0,1fr)`), and the tool panel drops below the board.

### Slice

Auto (alpha components) or Grid. Auto is the default and it **chooses its own merge distance**
([§2](#2-frames--srcgameframe-opsjs)): the slider is pre-set to what it chose and the sentence under
it says why ("chose 2px — 6 frames of 89% equal size, and nothing else joins until 9px"). Unchecking
"Choose the merge distance automatically" hands the slider over.

Grid mode shows the ranked suggestions of [§1](#1-grid-suggestion--srcgamegrid-detectjs) as chips —
cell size, confidence and score, with the full `reasons` list as the chip's tooltip and as
screen-reader text — plus a custom cell size field and margin/spacing under Advanced.

Editing is the old slicer's, unchanged in behaviour: click to select, Shift/Ctrl for several, drag to
move, drag empty space to add, corner handles to resize, `Delete` to remove, arrows to nudge (Shift
×10, Alt resizes), numeric X/Y/W/H for every one of those, plus **Merge selected**, **Delete
selected** and **Reading order**. Drag the strip to reorder. A colour key (auto from the border, or
picked) is available under Advanced for sheets with an opaque backdrop.

### Normalize

Trim, alignment (including **"Bounding-box bottom, centred"** — labelled that way, never "foot"),
auto or explicit common canvas, and padding, with **before and after** side by side and the real
canvas size shown before anything is applied. Pixels are only ever moved by whole pixels, and a
canvas too small for the largest frame is refused with the size it would need.

### Animate

Create, rename and delete animations; tag from Idle/Walk/Run/Attack/Hit/Death or type your own;
assign the selected frames; drag the strip to reorder; fps, per-frame duration in ms, loop on/off,
forward / reverse / ping-pong. A sliced sheet already *is* an animation, so one is created from every
frame in strip order the first time the stage opens — renameable and splittable from there.

The preview **plays `playbackOrder`/`playbackTimes`** and nothing else, which is the same pair the
exporters read. It fits and integer-zooms the frame (nearest-neighbour, 1×…8× or Fit) on a
checkerboard, black, white or magenta background — a 12px sprite is never drawn as 12 pixels in a
300px box. Onion skin (0…8 frames either side, over the *playback* list so a ping-pong shows what
really plays next) and a difference view are under Advanced.

Beside the preview: the **jitter graph** — the residual x and y series of
[§3](#3-jitter-duplicates-and-the-loop-seam--srcgamejitterjs) drawn as two polylines (solid x, dashed
y, so they are not told apart by colour alone), with RMS and max in pixels and the engine's warning
text. **Auto-fix** takes the reference (declared pivot / bounding-box bottom / bounding-box centre /
alpha centroid) and `preserveTrend`, and shows the before → after RMS as a proposal you **Keep** or
**Discard** — the playback keeps running on the proposed frames while it is open, which is the
side-by-side. A duplicate/blank report and the loop-seam warning sit under the strip; removal is a
button, never automatic.

**Mirror** builds real mirrored frames (`mirrorFrame`: pivot, boxes and collision flipped, polygon
winding preserved) plus an animation that plays them. The pixels are flipped at draw time and at
export time from the same `metadata.mirroredFrom` flag, so the preview and the atlas agree.

### Pivot & boxes

Pivot presets, a red crosshair on the frame, and numeric entry in **both** normalised (0–1) and
pixels — the pixel field is per frame, so 9px is 9px on a 40-wide and on a 64-wide canvas. "Apply to"
is Selected frames / This animation / All frames.

Boxes are hit / hurt / interact / custom, as rect, circle or polygon, several per frame, each drawn
with its own **hatch pattern and name** (never colour alone) and editable numerically for keyboard
users. "Copy to this range" puts one box on frames *n…m* of the current animation. The **hitbox
timeline** is a real table — playback steps across, box types down, `<th scope>` on both axes — and
every cell is focusable and jumps to that frame.

Collision polygons come from [§4](#4-collision-shapes--srcgamecontourjs): shape (polygon / convex
hull / rect / circle), threshold, tolerance, max vertices and outward padding, and the result line
reports **traced → simplified vertices, max deviation in pixels and area error in percent** rather
than claiming success.

### Pack & export

Engine (Generic JSON / Godot 4 / Unity), spacing and max page size in front; extrude, outline width
and colour, de-fringe, power-of-two and de-duplication under Advanced. The stage opens on a packed
atlas and re-packs on every change, showing the page image, its size, efficiency per page, how many
frames share a region, and the packer's warnings. A page limit smaller than a single frame is
reported as an error with the download disabled, not silently rounded up.

Outline and de-fringe are **non-destructive**: they are applied to a copy of each frame at export
time into one extra working sheet, the frames are re-pointed at it, and pivots, boxes and collision
move by the same integer offset. An **edge zoom** shows one real frame before and after at 1:12, so a
one-pixel change is visible. Rotation is not offered at all (see [§6](#6-packing--srcgamepackingjs)).

The Godot target says it was verified in the engine; **the Unity target says UNVERIFIED in red**, and
the same word is in the JSON, the C# file and the README.

Also on this stage: per-frame PNGs as a ZIP, a GIF preview, **Save project JSON** (coordinates,
boxes, collision and settings — no image data, and loading one asks for the sheet again and refuses a
sheet of a different size) and **Copy a settings link**, which puts the slicing/packing preset in the
URL query and never an image.

### State, undo and cancellation

Undo/redo is a stack of **projects** — the records of [`src/game/project.js`](../src/game/project.js),
a few KB for a 100-frame project — never image snapshots, 32 deep, on `Ctrl+Z` / `Ctrl+Shift+Z` /
`Ctrl+Y` and as buttons. Any edit that moves a frame drops the atlas, so an export can never read
stale rectangles. Shortcuts are bound on `document`, guarded by `el.isConnected`, and ignored inside
a form field or a `<dialog>`. Re-detection is debounced and carries an `AbortSignal`, so changing a
slicing option while a detect is in flight cancels it instead of racing.

**Limitations**
* Auto merging is rectangle-gap based, so two sprites whose *bounding boxes* come within the distance
  merge even if no pixel does. The slider and manual split/merge are the answer; a uniform sheet
  should use Grid.
* The pivot crosshair is drawn and typed, not dragged: the overlay is `pointer-events:none` and the
  numeric fields (and presets) are the only way to move it. Dragging it is not implemented.
* Polygon boxes are created as a rectangle of four points and then edited numerically; there is no
  point-by-point polygon drawing tool.
* An outlined export builds one extra working sheet, capped at 64 megapixels; above that it refuses
  with the size it would have needed.
* `findDuplicates` and the jitter report run on the main thread, over the whole frame list. On the
  100-frame fixture that is tens of milliseconds; they are not in a worker.
* Loading a project JSON requires the same sheet dimensions. It does not try to re-find the frames.
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

### The workspace, in a real browser

`tests/task-browser.py` (Sprite Lab block) drives the page in Chromium and then re-opens every
export with Pillow, `zipfile` and `json`. Run it against your own server with
`TEST_URL=http://127.0.0.1:<port> GODOT_BIN=<godot> python tests/task-browser.py`.

| Claim | How | Result |
|---|---|---|
| a sheet of six characters, each drawn as a body + a hat + a sword 1–2px apart, slices into **six** frames | `tests/fixtures/game/irregular-characters.png` dropped on the page; `.slicer-box` counted | **VERIFIED** — 17 alpha components → 6 frames, distance 2 chosen by `autoMergeDistance` |
| the chosen distance is shown, explained and adjustable | the slider is pre-set to 2 and the line reads "chose 2px — 6 frames of 89% equal size, and nothing else joins until 9px" | **VERIFIED** |
| ten 20×20 sprites 1px apart are **not** merged | `tests/game-frame-ops.test.mjs` | **VERIFIED** — 10 frames, distance 0, with the reason |
| the animation preview fits the frame instead of drawing it tiny | integer zoom 1×…8× or Fit, nearest-neighbour, checkerboard / black / white / magenta | **VERIFIED** by screenshot at 1440, 390 and 320 |
| every atlas region equals that frame's pixels on the **source sheet** | each frame's alpha bounding box computed from the fixture with Pillow, cropped, compared byte for byte with the region the JSON names | **VERIFIED** — 6/6, and 6/6 again across a 2-page atlas at `maxSize: 128` |
| the JSON pivot is the pivot the UI showed | UI in pixel mode read from `#labPivotX/Y`, compared with `pivot × sourceSize` | **VERIFIED** — 9 / 55 px ↔ 0.225 / 0.859375 |
| the JSON boxes are the boxes the timeline showed | hitbox typed as 3,5 11×7 and copied to frames 4–6 of Attack; the timeline row read back as `_ _ _ 1 1 1`; the JSON has it on exactly three frames with those numbers | **VERIFIED** |
| the JSON collision is what the UI counted | `#labCollisionCount` polygons/vertices compared with `frames[].collision` | **VERIFIED** |
| a per-frame duration reaches both the frame and the playback block | 250 ms typed on frame 2 | **VERIFIED** — `frames[].duration` and `animations.Walk.playback.durations` |
| animation frame order equals the strip order | `animations.Walk.frames` compared with the frame keys in strip order | **VERIFIED** |
| ping-pong playback has no doubled ends | `playback.frames` compared with `frames + frames[-2:0:-1]`, first and last counted once | **VERIFIED** |
| jitter is measured, shown and reduced | alpha-centroid residual RMS read from `#labJitterRms` before and after auto-fix | **VERIFIED** — the check requires a drop of more than half |
| a multi-page export really appears at a small page limit | `maxSize: 128` on 40×64 frames | **VERIFIED** — 2 pages, every page ≤128px, every image named in `meta.images` present |
| a page limit smaller than one frame is explained | `maxSize: 48` | **VERIFIED** — the error is shown and the download is disabled |
| aliases resolve | a sheet whose first and third sprites are identical | **VERIFIED** — one `aliasOf`, same rect, and that region holds those pixels |
| **the ZIP the Lab produced loads in Godot 4** | `tests/fixtures/game/godot-validate-bundle.mjs` unpacks the downloaded bundle as a Godot project, the shipped GDScript builds the `SpriteFrames`, `ResourceSaver` saves it, it is reloaded with `CACHE_MODE_IGNORE`, and every animation speed, loop flag, per-frame duration, `AtlasTexture` region, margin, reported size, `filter_clip` and page size is compared with the bundle's own JSON; then the shipped headless importer is run on its own | **VERIFIED** in **Godot 4.7.2.stable.official.ed1daf0bf** — 2 animations, 6 frames, 3 `CollisionPolygon2D` nodes in the packed scene, `problems=0` |
| that Godot check can fail | one frame's `sourceSize.w` in the bundle raised by 5px | **VERIFIED** — `problems=2`, `MISMATCH … reports size (40.0, 64.0), expected (45.0, 64.0)`, exit 1 |
| Unity is labelled UNVERIFIED where a person would see it | the chip note in red in the UI, `unity.verified: false` in the JSON, the word in `NerulioSpriteImporter.cs` and in `UNITY-README.md`, and no `.meta` file | **VERIFIED** that the label is there — the import itself is **UNVERIFIED** |
| the old URLs still work and still prove what they proved | `sprite-slicer` and `normalize-sprite-frames` checks ported from `tests/task-browser.py` and `tests/recipes-browser.py`: detection with no Run button, handles, exact numbers, the edited rectangle deciding the exported pixels, undo, grid suggestions, one canvas and one bottom edge | **VERIFIED** — both suites |
| no horizontal scroll, no console errors | every stage at 1440, 390 and 320 | **VERIFIED** — `scrollWidth == innerWidth` at all three, 15 stage screenshots, zero page errors |

### Measured in the browser

One run each, Chromium on a Windows 11 laptop. These say "interactive", not "benchmarked". The
timings are wall clock from the click to the stage's canvas being drawn, so they include the
re-render, not only the engine call.

| Sheet | Frames | Slice: drop → boxes drawn | Normalize | Animate | Pivot & boxes | Pack | Export ZIP | Atlas | JS heap |
|---|---|---|---|---|---|---|---|---|---|
| 100 sprites of mixed size on a 640×640 sheet, each with a hat drawn 2px off the body | **100** (Auto, distance 2) | **130 ms** | 47 ms | **94 ms** (incl. the first jitter report and duplicate scan over all 100) | 56 ms | 84 ms | **43 ms** | 1 page, 409×418 | **17 MB** |
| 2048×2048, 8×8 cells of 256px holding a 200px block each | **64** (Grid) | Auto **refuses** (see below); Grid **406 ms**, and 4.0 s to slice the 64 cells | — | — | — | **524 ms** | **183 ms** | 1 page, 204×204, 96% used — the 64 identical blocks are stored once with 63 aliases | **48 MB** |

A 2048×2048 sheet is 4.19 megapixels, past `primitives.ANALYSIS_PIXELS` (4 MP), which is what
`components` needs to label alpha islands. **Auto refuses it**, and the Lab says so in words with
the number and points at Grid — whose suggestions were already computed, because
`detectGrid`/`runLengths`/`alphaProfile` are band-read and have no such cap. On that sheet Grid's
top suggestion is 256×256, margin 8, `high` confidence, 82%: the grid that really made it.

The 17 MB heap for a 100-frame project is the point of the `source` contract: one decoded sheet
(640×640×4 = 1.6 MB) plus one atlas page, not 100 frame canvases.

### What is not done

**In the workspace**
* **Auto is capped at 4 megapixels** (`primitives.ANALYSIS_PIXELS`), because `components` labels the
  whole sheet at once. The Lab explains it and points at Grid, but Auto on a 4096×4096 sheet is not
  possible without moving component labelling to a tiled or worker path.
* **The pivot crosshair cannot be dragged.** Presets and the numeric fields (normalised and pixel)
  are the only way to move it; the overlay is `pointer-events:none`. Boxes cannot be dragged either —
  they are typed. This is the largest gap against the brief's "drag crosshair".
* **Polygon boxes have no drawing tool.** Choosing `polygon` creates a rectangle of four points,
  editable only as numbers.
* Cancellation covers the debounced re-detect (an `AbortController` per run, passed to `detectGrid`).
  Packing, the collision pass and the export are not cancellable — they are fast enough on the
  fixtures measured above that no progress UI exists, which is a bet, not a proof.
* `findDuplicates`, `jitterReport` and the collision pass run on the main thread over the whole
  frame list. 100 frames is tens of milliseconds; 1000 frames has not been tried.
* **Firefox and WebKit are untested.** Every browser number above is Chromium. The page uses nothing
  exotic (2D canvas, `getImageData`, SVG), but that is an argument, not evidence, so
  `src/capabilities.js` still lists the Lab as `basic` with no `seoPromotable` evidence.
* Loading a project JSON requires a sheet of the same dimensions; it does not re-find frames.
* Onion skin has fixed opacity falloff (0.5 per step); the brief's "prev/next opacity" is not
  separately adjustable.
* The GIF preview uses the site's existing 256-colour GIF encoder with one delay for the whole
  animation (the mean of the per-frame durations), so per-frame timing is *not* preserved in the GIF.
  It is a preview; the JSON and the engine bundles carry the real timings.

**In the engine**
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
