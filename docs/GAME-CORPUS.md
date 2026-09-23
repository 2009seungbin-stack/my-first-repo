# Game-asset test corpus

The real files every Nerulio Game Studio feature is tested against: sprite sheets, loose frames,
pixel art, palettes, tilesets, Tiled/LDtk projects, PBR and tileable textures, UI 9-slices and
fonts, collected from the places indie developers actually get them (Kenney, OpenGameArt,
ambientCG, Poly Haven, Lospec, the Tiled and LDtk repositories, open font projects).

Synthetic Pillow images are still useful for exact edge cases, but they are not evidence that a
tool works on real game art. Every Lab and every exporter claim is checked on files from here.

## Where it is and how to get it

| What | Where |
|---|---|
| The corpus itself (about 66 MB of files, plus a 146 MB download cache) | `C:\Users\2009s\nerulio-asset-corpus` on the verification machine. Override with `--root` or `NERULIO_CORPUS`. **Not in the repository.** |
| The manifest (source of truth) | `manifest.json` in the corpus root, and the identical committed copy `tests/game-corpus.manifest.json` |
| Reproducible download | `python tools/fetch-game-corpus.py` |
| Committed CI subset (13 CC0 files, 62 KB) | `tests/fixtures/game/corpus/` with `index.json` and `LICENSES.md` |
| Manifest checks in `npm test` | `tests/game-corpus.test.mjs` |

```
python tools/fetch-game-corpus.py                  # download what is missing, check every SHA-256
python tools/fetch-game-corpus.py --verify         # no network: hash-check what is on disk
python tools/fetch-game-corpus.py --only tileset   # one category, source id or path prefix
python tools/fetch-game-corpus.py --record         # authoring: fill sha256/bytes/size of new entries
```

The script downloads each source once into `<root>/_downloads/`, extracts the listed archive
members, regenerates the derived files (Pillow), and exits non-zero if any file is missing or its
SHA-256 differs. On 2026-09-23 a fresh download of every URL into an empty root reproduced all
hashes (checked per slice while building the manifest), and `--verify` on the corpus reported
**160 ok, 0 failed, 0 missing**.

Known limits of the fetch script:

* A cached archive in `_downloads/` is reused even if the URL in the manifest later changes.
  Delete the cache entry after changing a URL.
* Kenney's zip URLs contain a version hash; when Kenney re-publishes a pack, the old URL can
  disappear. The file hashes then tell you if the new zip still contains the same files.
* The bilinear derived file (`pixel/derived/sumoHulk_x3.78_bilinear.png`) was hashed with
  Pillow 12.3.0; another Pillow version may resample differently and fail its hash. The nearest,
  key and grid-repack derivations are exact.

## Licences: what may be committed

| Licence | Files | Committable |
|---|---|---|
| CC0-1.0 (Kenney, OpenGameArt CC0, ambientCG, Poly Haven, templates, Tiled sticker-knight images) + 1 public-domain | 123 | yes |
| Derived from CC0 files | 7 | yes |
| MIT (LDtk samples, dual-grid repo, Cozette) | 9 | **no** (local tests only) |
| GPL (Tiled example data files incl. the sticker-knight map JSON, The Mana World desert art) | 5 | **no** |
| OFL-1.1 (Galmuri, Noto Sans JP) | 5 | **no** |
| "unclear" (Phaser and Pixi example atlases) | 6 | **no** |
| CC0-1.0 or OGA-BY-3.0 (warpgal; the image itself says OGA-BY) | 1 | **no** |
| Lospec palette pages (colour lists, no licence stated) | 4 | **no**, conservatively |

`committable` is `true` only for CC0 or public-domain sources, and `tests/game-corpus.test.mjs`
fails if that rule is broken. Only the 13 small CC0 files in `tests/fixtures/game/corpus/` are in
the repository. Everything else is referenced by URL and hash.

## Contents

160 files from 79 sources, all with a licence and a SHA-256. 140 of them are content files
(the other 20 are the licence texts shipped in the archives). Every content file has a `truth`
block measured by inspection. Seven files are derived (see below). 130 files are committable.

| Category | Files | What is covered |
|---|---|---|
| `sprite-sheet` | 21 | Uniform grids at 8, 16, 24, 32, 48 and 64 px, plus non-square 80×110 and 96×128 cells. Grids with 1 px spacing and with a 16 px margin. A real magenta-keyed Kenney sheet and a real opaque-background sheet. Derived cyan, green and magenta keys, one with margin 4 and spacing 2. The 4096×4096 hit-effect sheet (detached spark islands). Samurai with 1 px detached blood drops. A ragged one-animation-per-row trooper. A packed caveman sheet without data. A 3781×2140 archer sheet that is not on a grid |
| `sprite-frames` | 16 | Loose frames: ninja `run_0…5`, and archer `attack (1)…(10)`, a natural-sort trap |
| `sprite-atlas-data` | 5 | Kenney Starling XML (toon 45 frames, space shooter 294 frames). TexturePacker JSON hash with 50 rotated and 22 trimmed frames. Pixi fighter, all trimmed. Aseprite JSON with Move/Reverse tags and 100–2000 ms durations |
| `pixel-art` | 7 | Sumo 1× plus a real 4× nearest; derived 2× and 3× nearest and a 3.78× bilinear blur; sprite-boy 32/64 px; one CC0 image with fake "pixels" of about 8–11 px (the page says it was made with Clipdrop Stable Doodle) |
| `palette` | 4 | Lospec pico-8 (`.gpl` and `.hex`), endesga-32, sweetie-16. The `.gpl` files have HTML in the description and CRLF line endings |
| `tileset` | 22 | Kenney Tiny Dungeon, Pixel Platformer, Roguelike RPG and 1-Bit, with 1 px spacing and packed twins. Blob-47 in three different orderings (caeles 7×7, cr31 wang-blob 7×7, GameMaker 8×6) plus real 64 px GameMaker-order cave art. A 2-edge Wang/edge16 set and a 2-corner (dual-grid) set. 80-tile dual-grid art in 5 terrain pairs. RPG Maker A2/A4 sheets. The Tiled desert tileset with opaque black gutters |
| `tilemap-project` | 19 | Tiled `.tmx` with external `.tsx`, CSV data and flip flags. A `.tmx` with two external tilesets and a tile offset. A `.tmx` with an embedded base64+zlib tileset. Tiled JSON with an image-collection tileset. LDtk `AutoLayers_1_basic` and `Typical_TopDown_example` with their atlases |
| `texture-pbr` | 16 | ambientCG Bricks076C and MetalPlates006: Color, NormalGL **and** NormalDX, Roughness, AO/Metalness, 16-bit Displacement. Poly Haven brick_wall_001: diffuse, nor_gl, nor_dx, arm |
| `texture-tileable` | 2 | ambientCG Ground054 (seam ratio 1.02), and a derived crop that is NOT tileable (ratio 2.72) |
| `sprite-normal` | 5 | OGA torch sheet + normal map (DX, medium confidence) + Aseprite JSON; OGA asteroids 23×9 cells, diffuse + normal (GL, high confidence) |
| `ui-nine-slice` | 9 | Kenney UI Pack buttons (normal/pressed pairs, gradient, Double size) and RPG panels with notched edges |
| `ui-sheet` | 3 | Kenney RPG UI sheet + Starling XML (the XML's imagePath does not match the file name); Pixel Adventure 32 px + 1 px spacing |
| `font-ttf` | 3 | Kenney Pixel, Mini Square Mono, Future (TTF, CC0) |
| `font-bitmap` | 5 | Bellanger 8×12 ASCII grid + `fontdef.txt` widths; Intrepid 8×8 black on opaque white; Cozette BMFont text `.fnt` + page |
| `font-cjk` | 3 | Galmuri11, Galmuri11Bitmap (Hangul), Noto Sans JP (kana/kanji, variable, no Hangul) |
| `licence` | 20 | The licence texts that came in the archives |

**Aseprite files** are collected by the aseprite-io work under `_adhoc/aseprite-io/`, with its own
`SOURCES.md` and licences. The manifest lists those folders under `references` (42 folders,
226 `.ase`/`.aseprite` files on 2026-09-23) but does not fetch or hash them, so they are not
duplicated.

### Derived files

Seven files have no real CC0 equivalent, so they are made from corpus files by deterministic
transforms. Their truth is exact by construction. The `derive` ops in `fetch-game-corpus.py`
are:

* `nearest` — integer upscale
* `resample` — bilinear, bicubic or lanczos to a given size
* `key` — flatten transparency onto a key colour
* `grid-repack` — re-lay a uniform grid with a new margin and spacing
* `crop`, `tile`, `blur`

The derived files are:

* the cyan, green and margin/spacing magenta sprite sheets
* the sumo 2×, 3× and 3.78× bilinear upscales
* a Ground054 crop that is not tileable

### What could not be found

* No CC0 TexturePacker or Aseprite JSON atlas. All the JSON atlases here are local-only.
* No CC0 BMFont `.fnt` with a stable download URL. Cozette (MIT) stands in.
* No CC0 font with Hangul; only OFL ones.
* No CC0 character sheet with large detached FX. The samurai's 1 px blood drops and the separate
  hit-effect sheet are the closest.
* No real cyan- or green-keyed sheet, and no real transparent sheet with a margin > 0.
* No real-art blob-47 set in cr31 order, and edge16 only as a template.
* A Tiled JSON map with tile layers under a clear licence.
* A Godot demo TileSet was skipped.

## Ground truth: what `truth` means

Every content file has a `truth` object. `truth.verified` says how it was checked (Pillow
measurements, parsing the data file, looking at the image, cross-checking against a twin file or
an author's formula). Where something is ambiguous, `truth.notes` says so rather than guessing.

| Field | Meaning |
|---|---|
| `grid` | `cellW, cellH, marginX, marginY, spacingX, spacingY, cols, rows` in pixels. `width == 2·margin + cols·cell + (cols−1)·spacing` unless the notes say otherwise; the roguelike characters sheet has one extra pixel column, for example |
| `frames` / `tiles` | non-empty cells |
| `background` | `"transparent"` or `{"key":[r,g,b]}`; an opaque tile background is noted |
| `atlas` | `{format: starling-xml / texturepacker-json-hash / aseprite-json-hash…, file, frames}` |
| `animations` | `{name: count}` only where the layout makes it unambiguous |
| `sequence` | loose-frame prefix, index and count, including the natural-order note |
| `pixelScale`, `resampled`, `nativeSize`, `colors` | pixel-art scale facts |
| `layout` | tile layout name: `kenney-grid`, `blob47-caeles-7x7`, `blob47-cr31-wang-7x7`, `blob47-gamemaker`, `edge16`, `wang-2corner`, `dual-grid-16`, `rpgmaker-a2` … |
| `masks` | per-cell neighbour masks, rows top to bottom. Blob sets use cr31 weights N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128, and a corner counts only when both of its sides are set. `edge16` uses N=1 E=2 S=4 W=8; `wang-2corner` uses NW=1 NE=2 SE=4 SW=8 |
| `project` | Tiled/LDtk facts read from the file: tile size, map size, layers, external or embedded tilesets |
| `normalConvention` | `GL` (+Y up) or `DX` (+Y down), with `confidence` and the measurement (height correlation plus a curl test) |
| `tileable` | `true` / `false`, with the measured seam ratio |
| `nineSlice`, `state` | 9-slice insets where rows/columns stop varying; `null` with notes where edges are notched |
| `font` | format, cell, first char and order for grid fonts; unitsPerEm and crisp pixel size for TTFs; CJK coverage read from the cmap |

`tools/engine-verify/expect_from_corpus.py` turns this truth into engine expectations (the frame
images cut from the original sheet, glyph images, the tile each painted cell must get). See
`docs/ENGINE-VERIFY.md`.

## Adding files

1. Add the source (URL, page, type, author, licence, licenceUrl, `committable`) and the file
   entries (`path`, `category`, `source`, `member`, `truth`) to the manifest. Leave `sha256` out.
2. `python tools/fetch-game-corpus.py --manifest <file> --record` downloads the files and writes
   their hashes and sizes.
3. Measure the truth for real. Say how in `truth.verified`.
4. Copy the manifest to `tests/game-corpus.manifest.json` and run `npm test`.
