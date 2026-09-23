# Nerulio Studio (P0 foundation)

`/game/studio/` (also `/ko/…`, `/en/…`, `/ja/…`) is a full-viewport dark app for 2D game assets:
menu bar, tool bar, canvas, dockable panels, status bar. It has no site header, footer, SEO copy or
ads, and it is `noindex,nofollow` and outside the sitemap. P0 ships the shell, the canvas engine,
the command/undo system, the project store and one small workspace (**Viewer**). The Sprite, Pixel,
Tile, Texture and UI workspaces (P1–P5) plug into the API described here.

## Layout of the code

```
tools/studio-build.mjs          static HTML of the app page (title, boot text, <noscript>); routed from tools/build.mjs
src/studio/main.js              entry: createStudio() + register workspaces + start()
src/studio/app.js               shell: chrome, commands, keys, menus, docks, file intake, autosave, workspace host
src/studio/strings.js           ko/en/ja copy (same pattern as src/task/strings.js, parity tested)
src/studio/studio.css           the whole look; tokens on .studio (dark) and [data-theme=light]
src/studio/canvas/
  view-math.js                  PURE: zoom levels, anchoring, screen↔image, fit, snapping, grids, rulers, wheel heuristics
  overlay-math.js               PURE: handles, drag/resize, polygons, guides, RectIndex (spatial index)
  canvas-view.js                CanvasView (WebGL2 image renderer + Canvas2D fallback, overlay canvas, rulers, input) and ShapeLayer
  rect-editor.js                reusable direct-manipulation tool for the rects of a ShapeLayer
src/studio/core/
  history.js                    PURE: History (do/undo/redo, merge, abort, dirty tracking)
  keymap.js                     PURE: combos, Aseprite-compatible defaults, IME-safe matching, typing guard
  project.js                    PURE: the project document and its edits (extends src/game/model.js)
  nerulio-file.js, zip-read.js  .nerulio read/write (writer = src/core.js zip)
  images.js                     ImageStore: blobs by SHA-256, decoded bitmaps on demand
  autosave.js                   IndexedDB autosave, snapshots, recovery
src/studio/ui/                  dom helpers, icons, menus (menubar pattern), docks (panels), dialogs (palette, keys sheet)
src/studio/workspaces/
  registry.js                   PURE: workspace definitions
  viewer.js                     the Viewer/Import workspace (reference implementation of the API)
  coming.js                     workspaces not built yet, registered as "coming" (no UI of their own)
  tile/                         the Tile workspace (P3) — docs/STUDIO-TILE.md
src/studio/grid-worker.js       worker: grid suggestion (src/game/grid-detect.js) and per-cell occupancy
```

Tests: `tests/studio.test.mjs` (unit: view math, overlay math, RectIndex, History, keymap, project,
.nerulio round trip, zip reader, strings parity, route) and `tests/studio-browser.py` (Playwright,
real Kenney CC0 sheets in `tests/fixtures/kenney/`).

## Canvas engine

* **Units are device pixels.** A zoom of 3 means one image pixel = 3×3 screen pixels on any display,
  so pixel art stays square at 125 %/150 % OS scaling. "100 %" = 1 image px per screen px. The backing
  store is sized from `devicePixelContentBoxSize` (falls back to CSS × DPR under emulation).
* **Zoom levels** are integers ≥ 1 or 1/n below (`ZOOMS` in view-math.js). Every zoom is anchored at
  the cursor (`zoomAt`) with a whole-pixel origin, so the anchored image point never drifts by a
  pixel. Keys: `1` 100 %, `2`–`6` 200–3200 % (Aseprite), `0` fit, `+`/`-` step. Wheel: mouse wheel
  zooms one level per notch, Ctrl/⌘+wheel and trackpad pinch zoom (pinch deltas accumulate), two-axis
  trackpad scroll pans; View › Mouse wheel forces zoom or pan.
* **Pan**: Space+drag with any tool, middle-button drag, Hand tool (H), two-finger touch.
* **Rendering**: WebGL2 draws the checker/solid background and the image (tiled into ≤ 4096² textures,
  NEAREST, premultiplied). Canvas2D is the fallback (`?renderer=2d` forces it) and draws only the
  visible sub-rectangle with smoothing off. A 2D overlay canvas draws the pixel grid (auto from 800 %),
  the custom cell grid (`{w,h,ox,oy,sx,sy}`), layers, marquee; optional rulers. Nothing redraws unless
  something changed.
* **Overlays**: `new ShapeLayer({id, z, color, …})`, `layer.setItems([...])` with
  `{id, shape:'rect'|'point'|'polygon'|'guide', …}` in image pixels, `setSelected(ids)`, `setHover(id)`.
  Rects are indexed (`RectIndex`), drawn culled, and hit-tested with handles for selected rects.
  `rectEditor({layer, bounds, selection, onSelect, onChange, onCreate, create})` gives a complete
  select / move / resize / rubber-band / draw tool with Escape-to-cancel, snapping to whole pixels.
* **Measured** (Chromium, 1440×900, `roguelike_tiled_4096.png` 4096² built from Kenney Roguelike RPG):
  GPU Chrome (GTX 1070 Ti, 144 Hz) pan/zoom p95 frame interval 7.1 ms with 2 000 rects and 7.2 ms with
  10 000; headless SwiftShader 16.8 ms (60 Hz cap) for both renderers; render() CPU p95 ≤ 4.3 ms.
  `view.benchmark({frames, mode:'pan'|'zoom'})` reproduces this.

## Commands, undo and keys

* Every document edit is a History command: `ctx.execute(ctx.edit(label, doc => nextDoc, opts))`.
  The document is immutable, so undo restores the previous document by reference (exact, cheap —
  images are never in the document). Commands with side effects may pass `{label, do(), undo()}`.
* **Merging**: `{mergeKey, open:true}` merges a whole drag into one step; `history.close(key)` ends it,
  `history.abort(key)` cancels it (Escape). Repeated nudges with the same key merge within 1 s.
* **App commands** (`app.commands`, id → `{label, run, enabled, checked, group, keys}`) back the
  menus, the command palette (Ctrl/⌘+K, F1), the shortcut sheet (`?`) and the key map. Default keys
  follow Aseprite where it has one: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+S, Ctrl+Shift+S, Ctrl+O,
  Ctrl+A, Ctrl+D, V/M/H/Z tools, `,` `.` frames, 1–6 zoom, Ctrl+' grid, Ctrl+Shift+' pixel grid.
  Letters and digits match by physical key (works with a Korean/Japanese IME on). Shortcuts never
  fire while typing in a field; single keys in lists keep their list meaning (arrows, Delete, Enter).
  Space, arrows, Page keys and browser shortcuts the Studio uses are prevented from scrolling/zooming.

## Project store

* **Document** (`core/project.js`): `{format:'nerulio-project', version, id, name, createdAt,
  assets[], settings}`. An image asset is Aseprite-shaped for the long term — `layers[]`, `timeline[]`
  (frames in time), `cels[]` (`{layerId, frameId, blob}`) — plus `frames[]` (model.js AssetFrame:
  sheet regions with pivot/boxes/collision/duration/tag), `tags[]` (model.js Animation + colour),
  `slices[]` (Aseprite slices with keys, 9-slice centre, pivot) and `grid`. `normalizeProject()`
  validates anything loaded; `migrate()` is the hook for future versions.
* **Images** are stored once, by SHA-256 of the PNG bytes, outside the document. Imported PNGs are
  kept byte for byte; JPG/WebP/GIF (first frame)/BMP/AVIF are decoded once and stored as PNG.
* **Autosave** (`core/autosave.js`): debounced 1 s after an edit or view change, IndexedDB
  `nerulio-studio` (blobs once, snapshots = document JSON + UI state, last 10 per project, unreferenced
  blobs deleted). On reopen the Studio offers to restore; File › Autosaved versions lists the rest.
  `beforeunload` asks when the project has changes not saved to a file or autosave is pending.
* **`.nerulio` file**: ZIP (stored) with `project.json` (`{format:'nerulio-project-file', fileVersion,
  savedAt, project}`) and `images/<sha256>.png`. Reading verifies every image hash. Round trip is
  exact (same document, same bytes; unit and browser tested).

## Hand-off from tool pages

`src/task/handoff.js` now carries an optional `meta` object with the files
(`stashFiles(files, meta)`, `takeHandoff()`; `takeFiles()` unchanged). Sprite Lab has an
**Open in Studio (beta)** button: the sheet and the frames it has cut arrive in the Studio as one
undoable step. Any page can do the same: `await stashFiles(files, {from:'x', frames:[{name,
sourceRect, pivotX, pivotY, duration, tag}]}); location.assign(prefix + 'game/studio/')`.
Dropping files anywhere on the Studio imports them; a `.nerulio` opens as a project; paste works too.

## Workspace plug-in API (for P1–P5)

```js
export default {
  id:'sprite', title:'ws.sprite', status:'ready', summary:'ws.spriteSummary',
  activate(ctx){
    // everything registered through ctx is removed automatically when the workspace is left
    ctx.tool({id, title, icon, key, order, hint, impl});     // impl = CanvasView tool: {down,move,up,hover,leave,cancel,cursor,pans,active}
    ctx.panel({id, title:()=>ctx.t('panel.x'), dock:'right'|'bottom', order, badge, render(body,{actions})});
    ctx.command({id, group, keys:['Mod+E'], run, enabled, checked, label});
    ctx.menu({id:'sprite', title:'menu.sprite', items:()=>['cmd.id','-',…]});
    const layer=ctx.layer(new ShapeLayer({id:'boxes', z:20}));
    ctx.on('doc',(doc,prev,ev)=>…); ctx.on('asset',id=>…); ctx.on('view',v=>…); ctx.on('locale',l=>…);
    ctx.execute(ctx.edit(label, d=>…, {mergeKey, open}));    // undoable document edits
    ctx.status('selection', text); ctx.toast(msg); ctx.showPanel(id); ctx.runCommand(id);
    // ctx.doc, ctx.activeAsset, ctx.history, ctx.images, ctx.view, ctx.t, ctx.importFiles, ctx.shortcutOf
    return {             // optional hooks the shell's generic commands call
      selectAll(), deselect(), hasSelection(), deleteSelection(), nudge(dx,dy), step(dir),
      onAsset(id), handoff(meta, assets), deactivate()
    };
  }
};
```

Rules for workspaces: edits go through `ctx.execute` (never mutate the document); strings go into
`src/studio/strings.js` in all three languages; heuristics show their confidence and are applied only
by an explicit user action (the Viewer's grid suggestion is the pattern: preview + "not applied" +
Apply); no button for a feature that does not exist yet.

## Known gaps (P0)

* Undo history is not persisted across reloads (the document and view are).
* Save downloads a file; File System Access "save in place" is not wired yet.
* Only one layer/one timeline frame per imported image; editing cels is P2.
* Rulers and custom grid are view-only; guides are drawable by API but no guide tool yet.
* Two-finger touch pinch/pan is implemented but not covered by Playwright (no multi-touch there).
* Evidence is Chromium only (Firefox/WebKit not run).
