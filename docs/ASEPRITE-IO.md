# Aseprite I/O (`src/game/aseprite.js`)

Pure-JavaScript reader, compositor and writer for Aseprite `.ase`/`.aseprite` files. It has no DOM
and no Node APIs, so the same module runs in the page, in a (module) worker and in Node tests.
Nothing is uploaded and nothing is fetched: bytes in, data out.

Files:
- `src/game/aseprite.js`: reader, compositor, model mapping and writer.
- `src/game/aseprite-blend.js`: Aseprite's blend modes. It is a line-by-line port of Aseprite's
  MIT-licensed `doc/blend_funcs.cpp`, including its integer rounding and known quirks.
- `src/game/zlib.js`: synchronous zlib inflate/deflate.

The format follows the [official spec](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md).
Where the spec is silent, behaviour follows Aseprite's own MIT-licensed decoder, encoder and
renderer (`dio/aseprite_decoder.cpp`, `dio/aseprite_encoder.cpp`, `render/render.cpp`,
`doc/render_plan.cpp`) from v1.3.18.6.

## API

```js
import {readAseprite,renderFrame,renderLayer,celImage,getCel,paletteAt,toSpriteProject,renderStrip,
        documentFromImages,writeAseprite,plainProperties,AsepriteError,DEFAULT_LIMITS,TILE,BLEND_MODES} from './src/game/aseprite.js';

const doc = readAseprite(bytes);               // ArrayBuffer | Uint8Array. Throws AsepriteError {code, message}
const {rgba, indices} = renderFrame(doc, 0);   // width*height*4 RGBA as Aseprite exports it; indices only for indexed sprites
renderFrame(doc, 0, {layers: [2, 3]});         // only these layers (array/Set of indices or a predicate)
renderLayer(doc, 2, 0);                        // one layer or group on a clear canvas (drawn even if hidden)
celImage(doc, getCel(doc, 2, 0));              // a cel's own pixels as RGBA (tilemap cels expanded)
const project = toSpriteProject(doc, {name: 'hero'});  // model.js frames/animations + metadata
const strip = renderStrip(doc);                // the strip sheet that project.frames[i].sourceRect points into
const out = writeAseprite(doc);                // Uint8Array; a reader document is valid writer input
const doc2 = documentFromImages({width, height, layers, frames, palette, tags, slices, userData});
const {doc: doc3, skipped} = documentFromSpriteProject(project, frameImages); // Lab project → .aseprite
```

- **Errors.** `readAseprite` throws `AsepriteError` when the structure is broken or a limit is hit.
  The codes are `not-aseprite`, `truncated`, `corrupt`, `limit`, `unsupported` and `input`.
  Damage limited to one chunk does not throw. This covers a corrupt cel stream, a truncated
  user-data block or an unknown chunk. The reader records it in `doc.warnings` and loads the rest,
  as Aseprite does. `{strict:true}` turns every such warning into a throw.
- **Limits.** `DEFAULT_LIMITS` sets 256 MiB per file, 8192² pixels per canvas and per cel,
  a 1 GiB total decode budget, 2²⁰ tiles, a 65536-colour palette and 16384 layers.
  Override them with `readAseprite(bytes, {limits:{…}})`. Every allocation is checked before it
  happens. Each zlib stream is inflated into a buffer of exactly its declared size, and decoding
  stops at that size. A 40 MB zlib bomb inside a 64×64 cel therefore costs 16 KB of work.
- **Document shape.** A `doc` holds:
  - canvas and colour: `width`, `height`, `colorMode` (`rgba`/`grayscale`/`indexed`),
    `transparentIndex`, `palettes[{frame, colors:Uint8Array RGBA, names}]`
  - structure: `layers[]` (with `parent`, `type`, `visible`, `blendMode`, `opacity` and flags) and
    `frames[{duration, cels[layerIndex]}]`
  - animation and annotation: `tags[]`, `slices[{keys[{frame,x,y,w,h,center,pivot}]}]`,
    `tilesets[]`
  - other chunks: `userData`, `externalFiles`, `colorProfile`, `unknownChunks`, `warnings`
  - header flags: `composeGroups`, `layerUuids`, etc.
- **Cels.** An image cel holds `pixels` in the sprite's own format: RGBA, value+alpha, or indices.
  A tilemap cel holds `tiles` (Uint32 in Aseprite's in-memory layout; `TILE.INDEX_MASK/XFLIP/YFLIP/DFLIP`).
  Linked cels share `pixels` and `data.userData` with the cel they link to, and `linkedFrame`
  names that frame.
- **User data.** Properties are kept typed (`{type:'int32', value}`, …). This lets them round-trip
  exactly. `plainProperties(userData)` gives plain JS values, keyed by extension ID (`''` = user
  properties). When writing, plain JS values work too; their types are inferred.
- **Tags.** Tags come back in Aseprite's sorted order: by `from`, then the longer tag first.
  Aseprite pairs tag user-data chunks with that order. The writer sorts the same way, so tag
  colours and texts land on the right tag in Aseprite.

## Compositing

`renderFrame` reproduces Aseprite's export path (new blend method, no checkerboard):
- **Render plan.** Layers draw back-to-front. Cel z-index reorders them exactly as
  `RenderPlan::processZIndexes` does. Background layers draw in a first pass.
- **Hidden layers.** A layer is skipped if it, or any group above it, is hidden. Reference layers
  are skipped too.
- **Opacity.** Cel opacity is multiplied by layer opacity with `MUL_UN8`. Layer opacity counts only
  when header flag 1 is set. Background layers are always Normal at 255.
- **Blend modes.** All 19 blend modes are supported in RGBA and grayscale. Grayscale keeps
  Aseprite's mapping: the HSL modes act as Normal, and Addition uses the Exclusion blender.
- **Indexed sprites.** These composite by index, as Aseprite's PNG export does: the last visible
  non-transparent index wins, and opacity and blend modes are ignored. Palettes can change per
  frame. The transparent index becomes alpha 0 unless a visible Background layer exists.
- **Groups.**
  - With header flag 2 ("compose groups"), each group renders into its own buffer. That buffer is
    then composited with the group's opacity and blend mode. This matches what the Aseprite editor
    shows with the preference on.
  - Aseprite's PNG export always renders groups flat. `renderFrame(doc,f,{composeGroups:false})`
    reproduces that.
- **Tilemaps.** Tilemap cels draw tile by tile with X, Y and diagonal flips. When a diagonal flip
  on a non-square tile reads out of range, the pixel is cleared, as Aseprite does.

## Mapping to Nerulio's model (`toSpriteProject`)

- **Frames.** Each Aseprite frame becomes an `AssetFrame` on a horizontal strip (`sourceRect.x = i·width`).
  Its per-frame duration is carried over, and `tag` names the first tag that contains it.
- **Tags.** Each tag becomes an `Animation` with `direction`. `pingpong_reverse` becomes `pingpong`
  over the reversed frame list. That gives the same playback order, and the tests check this with
  `playbackOrder`. `repeat` 0 means `loop:true`. Any other value gives `loop:false`, and the number
  is kept in `animation.metadata.aseprite.repeat`. A file without tags gets one `default`
  animation.
- **Pivot.** The pivot comes from a slice with pivot data. A slice named pivot, origin or anchor is
  preferred; otherwise the first slice with a pivot is used.
- **Boxes.** Other non-9-patch slices become rectangle boxes on every frame their key covers.
  - The type is guessed from the name: `hurt` → hurt, `hit/attack/damage` → hit,
    `interact/trigger/use` → interact. Any other name gives `custom`.
  - **Every guess is recorded** in `metadata.aseprite.mapping` with `basis` and `confidence`,
    so the UI can show it and undo it.
- **9-patch slices.** These go to `frame.metadata.aseprite.nineSlices`. Each entry carries
  `bounds`, `center` and `borders:{left,top,right,bottom}` in the same terms as `nine-slice.js`.
- **Everything else** goes in `project.metadata.aseprite`: layers, tag and slice raw data, user
  data, tilesets, palette, external files, colour profile and warnings.

### Back out: `documentFromSpriteProject(project, images)`

`images` maps each frame id to the `{width, height, rgba}` of that frame's canvas. The output is a
one-layer document:
- **Frames and durations** keep project order.
- **Animations** become tags when their frames are consecutive in project order. A backwards run
  becomes `reverse`, or `pingpong_reverse` for ping-pong. Anything else goes to `skipped` and is
  never bent into a wrong tag.
- **Direction and repeat** come from the metadata of an imported tag while the Lab has not
  changed that tag.
- **Pivots** become a `pivot` slice. Rectangle boxes become one slice per box type and slot, with
  a key wherever they change.
- **9-patch slices** from the import are restored.
- **Canvases of different sizes** sit at the top left of the largest one.

The full loop was checked in real Aseprite on `indexed-features.aseprite`: an Aseprite file goes
through our reader and the Lab project and comes back out. Aseprite reads the same 4 tags
(direction and repeat), the same durations and the pivot and hit slices, and exports
pixel-exact frames.

## Writer (`writeAseprite`)

- **What it writes.**
  - Header: flag 1, plus flag 2 when `composeGroups` is set and flag 4 when layers have UUIDs.
  - First-frame chunks: external files (for extension property maps and external tilesets), an
    sRGB colour profile, a new palette chunk, sprite user data, tilesets with tile user data,
    sorted tags with user data, layers with user data, slices with all keys and user data.
  - Every frame: its cels, compressed with zlib, as linked cels, or as 32-bit tilemap cels.
- **Linked cels.** With `linkDuplicates` (default on), a cel that is byte-identical to an earlier
  cel on the same layer, with the same position and opacity and no user data of its own, is
  written as a linked cel.
- **Palette.** An RGBA document without a palette gets one built from its first 256 colours.
- **`documentFromImages`.** This builds a document from full-canvas RGBA images per layer and
  frame and trims each cel to its opaque bounds. With a `palette` it makes an indexed sprite. It
  throws if a pixel's colour is not in the palette; alpha 0 maps to `transparentIndex`.
- **`target:'libresprite'`.** LibreSprite, a fork of Aseprite 1.1, refuses files that contain
  slices, tilesets or external-file chunks. This option leaves them out.
- **Compression.** `deflate` is a pure-JS package-merge Huffman plus LZ77, within about 1% of
  zlib level 6. Pass `{deflate: bytes => zlib.deflateSync(bytes)}` for speed in Node.

## Supported chunks and verification matrix

Verified means checked against a real, independent implementation (see "How it was verified"
below). UNVERIFIED means implemented from the spec and the Aseprite source, but no real file or
independent tool exercised it.

| Feature | Read | Render | Write | Evidence |
|---|---|---|---|---|
| Header, frames, durations (incl. `speed` fallback, >0xFFFF chunk count field) | ✓ | – | ✓ | verified: 231 files, 1,831 frames |
| RGBA / grayscale / indexed (transparent index, palette alpha) | ✓ | ✓ | ✓ | verified: 164 / 13 / 54 files |
| New palette chunk 0x2019 | ✓ | ✓ | ✓ | verified (173 files) |
| Old palette chunk 0x0004 | ✓ | ✓ | – | verified (216 files); writer uses 0x2019 only |
| Old palette chunk 0x000B (6-bit) | ✓ | ✓ | – | **UNVERIFIED** (no sample file) |
| Per-frame palette changes | ✓ | ✓ | – | verified (1 file); **writer writes one palette only** |
| Layers: normal / group / tilemap, flags, child levels | ✓ | ✓ | ✓ | verified (22 files with groups, 23 with tilemaps) |
| Hidden layers and hidden groups | ✓ | ✓ | ✓ | verified (35 files) |
| Reference layers (skipped in render) | ✓ | ✓ | ✓ | verified (2 files) |
| Layer UUIDs (header flag 4) | ✓ | – | ✓ | verified (4 files) |
| Blend modes, all 19 (RGBA) | ✓ | ✓ | ✓ | verified: every mode, 31 files incl. the generated `blend-rgba` |
| Blend modes (grayscale) | ✓ | ✓ | ✓ | verified (`gray-blend`, writer `gray` case) |
| Layer opacity (header flag 1), cel opacity | ✓ | ✓ | ✓ | verified |
| Group opacity/blend (header flag 2) | ✓ | ✓ | ✓ | verified against Aseprite's own composed render (`Image:drawSprite` with compose_groups on). Aseprite's CLI export renders groups flat, and so does `composeGroups:false` |
| Cels: raw (0), linked (1), compressed (2) | ✓ | ✓ | linked + compressed | verified (raw 2 files, linked 28 files) |
| Cel z-index | ✓ | ✓ | ✓ | verified (4 files) |
| Cel extra 0x2006 (precise bounds) | ✓ | – | ✗ | parsed in 2 files, but the values were **not compared** (UNVERIFIED). Not written; Aseprite writes it only for reference layers |
| Compressed tilemap cels (3), 32-bit tiles, X/Y/D flips | ✓ | ✓ | ✓ | verified (23 files; 4 use flips) |
| 8/16-bit tiles | ✓ | ✓ | – | **UNVERIFIED** (Aseprite itself rejects them) |
| Tilesets 0x2023 (embedded), tile user data | ✓ | ✓ | ✓ | verified (tileset + tile user data compared with Aseprite's scripting view) |
| Old tilesets without "tile 0 is empty" flag | ✓ | ✓ | – | **UNVERIFIED** (no sample file) |
| External tilesets / external files 0x2008 | ✓ | – | ✓ (extension IDs) | external files verified (2 files); **external tilesets UNVERIFIED** |
| Colour profile 0x2007 (none / sRGB / ICC) | ✓ (kept, not applied) | – | sRGB | verified (203 sRGB, 3 ICC) |
| Tags 0x2018: 4 directions, repeat, colour | ✓ | – | ✓ | verified (59 files; 32 use reverse or ping-pong) |
| User data 0x2020: text, colour, typed properties (all 19 types, nested, extension maps) | ✓ | – | ✓ | verified for sprite, layers, cels, tags, slices, tilesets and tiles (user maps). Extension maps were verified on `indexed-features` |
| Slices 0x2022: 9-patch centre, pivot, per-frame keys | ✓ | – | ✓ | verified (31 files). Aseprite's scripting API shows only the frame-0 key, so later keys were checked only by our own round trip and by the fixture tests |
| Old slices chunk 0x2021 | ✓ | – | – | **UNVERIFIED** (dev-only chunk, no sample) |
| Mask 0x2016 (deprecated), path 0x2017 | name only / skipped | – | – | **UNVERIFIED** |
| Unknown chunks | skipped + warning | – | – | fuzz-tested |

## How it was verified

The corpus is 231 real files in `C:\Users\2009s\nerulio-asset-corpus\_adhoc\aseprite-io\`; see its
`SOURCES.md`. They come from 43 source folders:
- parser test suites: asefile, AsepriteDotNet, and Aseprite's own `tests/sprites`
- game and asset repositories: CC0 packs such as Duelyst, and LDtk samples
- 5 files generated with Aseprite by `tools/aseprite/make-fixtures.lua`

Most are MIT or CC0. A few are marked "local testing only" and are never committed.

The independent tools were:
- **Real Aseprite v1.3.18.6.** It was built from the official source zip with
  `LAF_BACKEND=none` (CLI build, Visual Studio 2026).
- **LibreSprite 1.2-dev.** This is the official Windows build.

| Check | Result |
|---|---|
| Our `renderFrame` against Aseprite's `--save-as {frame}.png`, decoded by Pillow, every frame | **231/231 files pixel-exact**. 1,829 frames compared as RGBA with max diff 0. For `setanarut-aseprite/prop.ase`, Aseprite could not write its ICC profile into PNG; its 2 frames were compared as palette indices via a TGA export, also exact |
| Our reader's metadata against Aseprite's scripting API (`tools/aseprite/dump.lua`). Covers layers, tree, flags, opacity, blend, frame durations, cels (position, size, opacity, z-index, link groups, user data), tags, slices, tilesets, and user data text and properties | **231/231 identical** |
| Writer: each corpus file re-encoded by `writeAseprite`, then opened by real Aseprite and exported | **231/231 open without warnings and are pixel-exact** against the original. 893 duplicate cels became linked cels |
| Writer metadata: Aseprite's scripting view of our re-encoding against its view of the original | **231/231 identical**, except link grouping where deduplication added links |
| Writer feature cases (`tools/aseprite/writer-cases.mjs`): all blend modes in a group, typed and extension user data, 4 tag directions, multi-key slices, indexed with transparent index 3 and palette alpha, grayscale blends, tilemap with flips and z-index, compose-groups | **All pixel-exact in Aseprite**. Metadata identical, apart from Aseprite's own tag reordering, which the writer now matches |
| LibreSprite exports of the originals | 156 files exact. 53 files have no reference: LibreSprite cannot open 48 of them (slices, tilemaps, chunks it does not know), and the 5 generated files were not tried. Of the 22 mismatches: 20 use blend modes that LibreSprite renders with its old pre-1.2 blenders; for `askeladdk-aseprite/index_error.aseprite` LibreSprite failed to write the PNG; for `setanarut-aseprite/prop.ase` it wrote 1 of 2 frames, and that frame differs in 78 px (not investigated; Aseprite itself matches us there) |
| LibreSprite opening our writer output (`target:'libresprite'`) | Opens every non-tilemap case. Indexed and all-Normal-blend cases are pixel-exact, including groups, opacity, linked cels and 5 frames. Blend-mode cases differ because of LibreSprite's own blending |
| asefile's shipped reference PNGs (secondary, provenance not recorded) | 35/38 exact. The 3 misses (hue, saturation, saturation_bug) are PNGs from an older Aseprite `set_sat`; Aseprite 1.3.18 itself matches us on those files |
| zlib | Our inflate decodes node:zlib output at levels 0, 1, 6 and 9. node:zlib accepts our deflate output for all 4,547 corpus cels. Chromium's `DecompressionStream` accepts it for the fixture cels |
| Browser | Chromium main thread and a module worker (`tools/aseprite/browser-check.py`, port 4431). The fixtures are exact there too |

Robustness:
- `tests/aseprite.test.mjs` truncates a file at every 7th byte and applies 1,500 random multi-byte
  mutations. Every outcome is either a clean `AsepriteError` or a loaded document that renders.
  The whole run takes about 0.4 s.
- A zlib bomb inside a cel is stopped at the declared cel size.

**Not claimed:**
- Pixelorama import was not tried.
- ICC profiles are read but not applied to colours, and neither does Aseprite's PNG export.
- The Aseprite-specific round trip of properties covers the "user" map and one extension map.
- Per-frame slice keys after frame 0 were not visible to the scripting dump.

## Performance

Node 24, same V8 as Chrome; median of 3 runs.

| File | Size | Canvas × frames | Parse | Composite every frame | Write |
|---|---|---|---|---|---|
| `ldtk/compare.aseprite` (largest) | 9.18 MB (472 MB decoded) | 1346×413 × 245 | 1.56 s | 2.51 s (10.2 ms/frame) | 7.6 s (3.5 s with node:zlib) |
| `ldtk/rulesRework-1.3.aseprite` | 4.52 MB (164 MB decoded) | 1161×582 × 241 | 0.57 s | 2.47 s | 3.4 s |
| `askeladdk-aseprite/blendtest.aseprite` | 0.82 MB | 640×360 × 1, blend layers | 24 ms | 28 ms | 71 ms |
| `duelyst-units/f5_ragnoramk2_attack.ase` | 0.11 MB | 130×130 × 36 | 9 ms | 5 ms | 67 ms |

Parsing decodes every cel eagerly. That is fine for game sprites, but a 9 MB file holds about
470 MB decoded. Lazy per-cel decoding is the obvious next step if the studio needs it for huge
files.

## Reproducing the verification

```
node tools/aseprite-corpus.mjs <corpus> <out> --roundtrip          # our renders + writer re-encodings
powershell tools/aseprite/export-refs.ps1 -exe aseprite.exe -corpus <corpus> -outdir <refs>
python tools/aseprite/compare.py <out> <refs> report.json          # pixel comparison (Pillow)
powershell tools/aseprite/export-rt.ps1 -exe aseprite.exe -dir <out> -outdir <rt-refs>
powershell tools/aseprite/dump-all.ps1 -exe aseprite.exe -corpus <corpus> -outdir <dumps> -rtdir <out>
node tools/aseprite/meta-compare.mjs <corpus> <dumps> meta.json    # metadata comparison
node tools/aseprite/writer-cases.mjs <dir> ; python tools/aseprite/writer-check.py <dir>
```
