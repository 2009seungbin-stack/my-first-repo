# Studio vs. the paid and desktop tools (head-to-head, 2026-09-25)

`docs/STUDIO-PACK-H2H.md` compared the Studio with **free web** packers. This page compares it with
the **paid/desktop leaders**: TexturePacker Pro, SpriteIlluminator, Laigter, Tilesetter, plus
Tiled's and Godot's own terrain tools as the free baseline for autotiles. Wins and losses are both
reported with numbers. "Loses" means loses. Where nothing was measured, the page says so.

**Status:** all three comparisons are done. The tile comparison is only partly measured: Tilesetter's
full version was not bought, so what it does is taken from its docs and labelled *docs*.

## Where Nerulio wins, ties and loses

| Area | Result | Measured gap |
|---|---|---|
| Sheet size, rotation allowed, 4 of 5 sets (ninja, archer, samurai, toon) | **Win** | 2.0–17.7 % smaller than TexturePacker's MaxRects Best |
| Sheet size, spaceshooter (294 sprites, 96 sizes) | **Loss** | 0.8 % (square pages) to 2.5 % larger than TexturePacker |
| Sheet size, rotation off | 2 wins, 3 losses | the Studio is smaller on samurai (−8.7 %) and ninja (−16.9 %). TexturePacker is smaller on archer (0.8 %), toon (3.0 %) and spaceshooter (1.2 %), with pages of 5.6:1, 35:1 and 14:1 |
| Sheet size, square pages (TexturePacker `--force-squared`) | 4 wins, 1 loss | −2.6 % to −20.6 %; spaceshooter +0.8 % |
| Sheet size, power of two | Tie | identical page sizes on all 5 sets |
| Frames restored pixel for pixel | Tie | both 415/415 in every configuration |
| Duplicates (alias) | Tie | both store 6 of 18 ninja frames. TexturePacker's alias page for archer ×8 is 1.1 % smaller |
| Multipack (archer ×8, 2048 max, alias off) | **Win** | 5 pages each; the Studio's total area is 1.9 % smaller |
| PNG file size | Tie | within ±3 % either way (both write indexed PNG when a sheet has ≤ 256 colours) |
| Pack speed | Not decided | TexturePacker CLI 0.1–1.9 s per set, including process start. The Studio's modules in Node take 0.01–1.3 s, and TexturePacker is faster only on archer ×8 with alias (1.2 vs. 2.1 s). The Studio's browser worker was not timed on these sets |
| Phaser 3/4, PixiJS 8, Spine runtime | Tie | both pass on all 4 tested sets. Both leave rotation off for Phaser; TexturePacker's rotated Phaser frames FAIL in Phaser 3.90 and 4.2 |
| Godot 4 | **Win** (small) | both draw correctly. TexturePacker's path needs its editor plugin and gives AtlasTextures + an AnimationPlayer library, at a fixed 10 fps. It ships no PNG import settings, so Godot's default `fix_alpha_border` recolours faint pixels (archer 8/10 frames exact). The Studio ships a SpriteFrames `.tres`, a `.tscn` and a `.png.import` (10/10) |
| Unity | Not compared | TexturePacker's importer is on the Unity Asset Store only (needs an Asset Store account action) |
| Polygon packing | **Loss (feature)** | the Studio has none. TexturePacker's polygon mode made the spaceshooter sheet 4.5 % smaller than the Studio's best, but made the four character sets 15–27 % larger than its own rectangle packing |
| Engine exporters | **Loss (breadth)** | TexturePacker has 68 data formats. The Studio has 17 targets, and its targets were loaded in 10 real engines/runtimes |
| Texture formats (PVR, ETC, ASTC, DXT, Basis, WebP) and pixel formats (RGBA4444 …) | **Loss (feature)** | the Studio writes PNG only |
| Price | **Win** | Studio free. TexturePacker Pro costs US$49.99, perpetual with 1 year of updates; this test used its 7-day trial |
| Normal-map accuracy vs. reference normals (SpriteIlluminator, Laigter) | Tie, or a small **loss** | on asteroids Laigter is 1.7° and 0.7 lit levels closer, SpriteIlluminator 0.3–1.8° closer. On bricks SpriteIlluminator is 0.5–1.3° closer (0.2° against Nerulio's height-map mode). On the hand-painted torch every tool, Nerulio included, is worse than a flat map |
| Seamless textures | **Win** | Nerulio roll error 0. SpriteIlluminator's Emboss 1.5–2.9 (max 24 levels). Laigter 58–64 by default, 0 with its Tile preset |
| Normal map → lit sprite in Godot/Unity | **Win** | Nerulio exports a verified Godot scene and Unity importer. SpriteIlluminator and Laigter need it set up by hand. SpriteIlluminator has no command line |
| Normal-map paint tools | **Loss** | SpriteIlluminator has Angle/Structure brushes and selections; the Studio has a height brush only |
| Autotile generation from base + edge tiles (Tilesetter) | **Loss (feature), not measured** | Tilesetter's paid version (US$12.99) builds 47/16 sets from a base and an edge tile with per-direction edges. Lite refuses it. The Studio generates only from quarter-based sources (A2, Blobsmith, A4, five-tile, rim) |
| Existing 47 sheet → working engine terrain | **Win** | Studio: 6 actions, 0 manual bits, Godot 4.7.2 485/485 cells. Godot's editor: 235 bits by hand; Tiled: 188 regions; Tilesetter Lite: no engine export; Tilesetter full: Godot export documented as autotile bitmasks (Godot 3 wording, Godot 4 unverified) |

## Method

* **Assets.** The same five real CC0 frame sets as `docs/STUDIO-PACK-H2H.md`, rebuilt from the
  corpus by `tools/h2h/pack_sets.py`:
  * ninja: 6 frames, 40×29
  * archer: 10 frames, 381×554
  * samurai: 60 frames of 48 px
  * toon: 45 frames of 96×128
  * spaceshooter: 294 sprites in 96 sizes

  Plus ninja ×3 (duplicates) and archer ×8 (multipack).
* **Judge.** `tools/h2h/atlas_verify.py` restores every frame from each tool's TexturePacker JSON
  hash and compares it with its source PNG, ignoring RGB under alpha 0.
  * It uses frame, rotated (stored clockwise), spriteSourceSize and sourceSize.
  * Polygon frames are restored through their triangle mesh, pixel centres inside the triangles.
    A polygon frame is exact only when no opaque source pixel falls outside the mesh.
* **Efficiency** = sum of the frames' opaque bounding boxes ÷ total page area.
* **Engines.** `tools/h2h/engine_check.py` loads TexturePacker's own exports and the Studio's
  bundles into the real engines with `tools/engine-verify`: Phaser 3.90, Phaser 4.2, PixiJS 8.21 and
  spine-canvas 4.2. Both are judged against the source frames. `tools/h2h/godot_tp_check.py` draws
  TexturePacker's Godot path in Godot 4.7.2.
* **Reproduce:**

  ```
  python tools/h2h/pack_sets.py
  python tools/h2h/tp_pack.py            # needs TEXTUREPACKER_BIN with a Pro licence or trial
  node   tools/h2h/nerulio_pack.mjs
  python tools/h2h/atlas_verify.py
  python tools/h2h/tp_engine_exports.py
  python tools/h2h/engine_check.py --port 4561
  TP_GODOT_PLUGIN=<plugin folder> python tools/h2h/godot_tp_check.py
  ```

  Normal maps and tiles:

  ```
  node   tools/engine-verify/texture/h2h_measure.mjs <dir> --json <dir>/h2h.json   # <dir>/in + <dir>/out/<tool>/<input>/<input>_n.png
  python tools/h2h/collect_normals.py <export folder> <dir> <tool>                # file a tool's *_n.png exports into that layout
  python tools/h2h/godot_lit.py <dir>                                             # lit in Godot 4.7.2 vs the reference normals
  python tools/h2h/autotile_clicks.py [corpus path]                               # manual terrain marking from ground-truth masks
  ```

  SpriteIlluminator and Tilesetter have no command line. Their GUI runs were driven with UI
  Automation and the DevTools protocol with the helpers in `tools/h2h/gui/` (see its README). The steps are
  listed in sections 2 and 3.

  Outputs go to `H2H_WORK` (default `test-results/h2h-paid`, git-ignored). The run on this page
  wrote them to `C:\Users\2009s\nerulio-handoff\scratch\h2h-paid\work`. Competitor binaries and
  outputs are not committed.

### Versions and how each tool was obtained

| Tool | Version | Source | Licence used |
|---|---|---|---|
| TexturePacker | 8.3.0 (2026-09-16), 64-bit | official MSI from codeandweb.com, unpacked with `msiexec /a` (not installed) | **Pro trial**: started by the GUI on first launch ("Pro trial: 7 days left"), with no account, e-mail or payment. The CLI then reports `License type: trial, Expiry: 2026-10-02`. Telemetry was declined. The trial EULA allows evaluation only, so no TexturePacker output is committed or shipped |
| TexturePacker Godot plugin | v4.3.0 | github.com/CodeAndWeb/texturepacker-godot-plugin (MIT) | — |
| SpriteIlluminator | 2.1.2 | official MSI, unpacked the same way | Pro trial ("Try SpriteIlluminator Pro"), no account. **GUI only**: it has no command line |
| Laigter | 1.14.0 | GitHub release (GPL-3), run 2026-09-24 by the Texture agent; same outputs re-measured | free build |
| Tilesetter Lite | 2.1.0 (Electron 10, build dated 2021-12) | free demo download on led.itch.io/tilesetter | free; the full version (US$12.99) was **not** bought |
| Tiled / Godot editor | Tiled 1.12.2, Godot 4.7.2 | already on this PC | free |
| Nerulio Studio | `origin/main` @ 0976d1a + this branch | the same modules the Studio runs (`src/game/pack`, `src/game/export`) | — |
| Engines | Godot 4.7.2, Phaser 3.90.0 / 4.2.1, PixiJS 8.21.0, spine-canvas 4.2.120 | `tools/engine-verify` | — |

## 1. TexturePacker Pro vs. Studio Pack & Export

### Settings (identical on both sides)

| | TexturePacker CLI | Studio |
|---|---|---|
| common | `--format json --trim-mode Trim --shape-padding 2 --border-padding 0 --extrude 0 --max-size 4096 --size-constraints AnySize --multipack` (alias on, its default) | `trimMode:'trim', shapePadding:2, borderPadding:0, extrude:0, maxWidth/Height:4096, dedupe:true` |
| rot1-best | `--algorithm MaxRects --maxrects-heuristics Best --pack-mode Best --enable-rotation` | `allowRotation:true, effort:'best'` |
| rot0-best | same with `--disable-rotation` | `allowRotation:false, effort:'best'` |
| rot1-square | rot1-best + `--force-squared` | rot1-best + `sizeMode:'square'` |
| rot0-pot | rot0-best with `--size-constraints POT` | rot0-best + `sizeMode:'pot'` |
| rot1-good / rot1-normal | `--pack-mode Good` (TexturePacker's default mode) | `effort:'normal'` (the Studio's default) |
| polygon | `--algorithm Polygon --trim-mode Polygon --enable-rotation --pack-mode Best` | — (the Studio has no polygon mode) |
| defaults | `--format json` only | — |

### Sheet size

Area in px², with efficiency in brackets. Δ = the Studio relative to TexturePacker; negative means
the Studio's sheet is smaller.

| Set | Config | TexturePacker Pro | Studio | Δ |
|---|---|---|---|---|
| ninja | rotation allowed | 127×18 = 2,286 (0.70) | **33×57 = 1,881 (0.85)** | **−17.7 %** |
| ninja | rotation off | 127×18 = 2,286 (0.70) | **38×50 = 1,900 (0.84)** | **−16.9 %** |
| ninja | square | 55×55 = 3,025 | **49×49 = 2,401** | **−20.6 %** |
| archer | rotation allowed | 873×1942 = 1,695,366 (0.92) | **1071×1526 = 1,634,346 (0.96)** | **−3.6 %** |
| archer | rotation off | **3034×538 = 1,632,292 (0.96)**, a 5.6:1 strip | 1543×1066 = 1,644,838 (0.95) | +0.8 % |
| archer | square | 1350×1350 = 1,822,500 | **1332×1332 = 1,774,224** | **−2.6 %** |
| samurai | rotation allowed | 125×574 = 71,750 (0.77) | **313×216 = 67,608 (0.82)** | **−5.8 %** |
| samurai | rotation off | 588×127 = 74,676 (0.74) | **275×248 = 68,200 (0.81)** | **−8.7 %** |
| samurai | square | 273×273 = 74,529 | **259×259 = 67,081** | **−10.0 %** |
| toon | rotation allowed | 495×716 = 354,420 (0.90) | **587×592 = 347,504 (0.91)** | **−2.0 %** |
| toon | rotation off | **3551×102 = 362,202 (0.88)**, a 35:1 strip | 631×591 = 372,921 (0.85) | +3.0 % |
| toon | square | 601×601 = 361,201 | **590×590 = 348,100** | **−3.6 %** |
| spaceshooter | rotation allowed | **3575×256 = 915,200 (0.93)**, a 14:1 strip | 951×983 = 934,833 (0.91) | **+2.1 %** |
| spaceshooter | rotation off | **256×3604 = 922,624 (0.92)** | 951×982 = 933,882 (0.91) | **+1.2 %** |
| spaceshooter | square | **959×959 = 919,681** | 963×963 = 927,369 | **+0.8 %** |
| spaceshooter | default effort (Good vs normal) | **3582×256 = 916,992** | 944×996 = 940,224 | **+2.5 %** |
| all 5 | power of two | 64², 2048², 256×512, 512×1024, 1024² | identical | 0 |

Notes:

* **Strips.** TexturePacker's Best mode picks the smallest area even when the page is a long strip
  (127×18, 3551×102, 3575×256). The Studio scores squarer pages higher. The square rows compare the
  two tools on the same shape constraint.
* **TexturePacker's plain defaults** (`--format json`) give ninja 2,552, archer 1,701,000,
  samurai 73,152, toon 356,846 and spaceshooter 922,500. At its default normal effort, the Studio
  is smaller on four sets with rotation on, and 1.9 % larger on spaceshooter. With rotation off
  (its generic default), it is also larger on toon (+4.5 %) and on spaceshooter (+2.3 %).
* **Polygon mode (TexturePacker only)**, in px²:

  | Set | Polygon | vs. TexturePacker's own rectangle Best |
  |---|---|---|
  | ninja | 2,904 | larger |
  | archer | 2,013,020 | larger |
  | samurai | 82,626 | larger |
  | toon | 433,066 | larger |
  | spaceshooter | **892,581** | 2.5 % smaller, and 4.5 % smaller than the Studio's best |

  So polygon packing pays off here only on the ship/laser sprites. Every polygon frame covered all
  of its opaque pixels (415/415 exact through the mesh).

### Correctness, duplicates, multipack, file size, speed

* **Exact restore.** Every configuration of both tools: ninja 6/6, archer 10/10, samurai 60/60,
  toon 45/45, spaceshooter 294/294. There were no overlaps. TexturePacker's rotated frames follow
  the same clockwise convention as the Studio's.
* **Duplicates.** Ninja ×3 (18 frames) is stored as 6 frames by both tools. TexturePacker's page is
  127×18 = 2,286 px², the Studio's 38×50 = 1,900 px².
* **Alias + multipack limit.** Archer ×8 at a 2048 max, alias on: TexturePacker 1539×1057 =
  1,626,723 px², the Studio 1543×1066 = 1,644,838 px². TexturePacker is 1.1 % smaller.
* **Multipack without alias** (80 frames, 2048 max): 5 pages each. TexturePacker 13,091,072 px²,
  the Studio **12,841,021** px² (−1.9 %).
* **PNG bytes** (rot1-best / square):

  | Set | TexturePacker | Studio |
  |---|---|---|
  | ninja | 483 / 554 | 531 / 526 |
  | archer | 718,695 / 711,557 | 706,081 / 701,282 |
  | samurai | 6,599 / 7,738 | 6,583 / 7,685 |
  | toon | 104,417 / 106,392 | 106,849 / 104,593 |
  | spaceshooter | 131,622 / 140,170 | 133,469 / 148,169 |

  A tie.
* **Time.** TexturePacker CLI wall time, including about 60 ms of process start and PNG writing:
  * ninja 0.1 s
  * samurai 0.16 s
  * toon 0.2 s
  * archer 0.85 s
  * spaceshooter 1.3–1.9 s
  * archer ×8 multipack 4.5 s

  The Studio's modules in Node (decode + pack + draw + encode + write): 0.01, 0.1, 0.16, 0.5,
  0.6–1.3 and 3.7 s, which is faster on these runs.
  * TexturePacker is faster on one: archer ×8 with alias at 2048, 1.2 s vs. 2.1 s.
  * The Studio's real path is a browser worker, and that was **not** timed on these sets. The
    only browser figure is 1,000 frames in 2.4 s (`docs/STUDIO-PACK.md`).
  * Both are interactive on these sets. No speed claim either way until the worker is timed on
    the same sets.

### In the engines (same four sets, judged against the source frames)

| Engine | TexturePacker's own export | Studio bundle |
|---|---|---|
| Phaser 3.90 + 4.2 (`phaser` format, its default: no rotation) | PASS 4/4 sets | PASS 4/4 |
| Phaser 3.90 + 4.2, TexturePacker with `--enable-rotation` | **FAIL 3/3 sets that rotate**: exactly the rotated frames are wrong (archer 6/10, samurai 40/60, toon 9/45 matched) | the Studio's Phaser preset refuses rotation |
| PixiJS 8.21 (`pixijs4`, which rotates by default) | PASS 4/4, rotated included | PASS 4/4 (rotation on) |
| Spine runtime 4.2 (`spine`, rotation on) | PASS 4/4 | PASS 4/4 |
| Godot 4.7.2 | TexturePacker's plugin imports the `.tpsheet`; drawn: ninja 6/6, **archer 8/10**, samurai 60/60, toon 45/45 exact | PASS 4/4 (SpriteFrames `.tres`, `.tscn`, `.png.import`) |
| Unity 6 | **not measured**: TexturePacker Importer is only on the Unity Asset Store (needs an account action) | PASS (earlier runs, `docs/STUDIO-PACK.md`) |

What the Godot row means in practice:

* **TexturePacker's route.**
  * Copy the addon into the project and enable it in Project Settings.
  * Its importer writes one AtlasTexture `.tres` per sprite.
  * It also writes an AnimationLibrary per name group (`run`, `attack`, `samurai`, `toon`) for an
    AnimationPlayer, at a fixed 10 fps. There is no SpriteFrames and no scene.
  * The PNG gets Godot's default import (`fix_alpha_border=true`). In archer frames 8 and 9 an
    alpha-16 pixel (64,48,32) was recoloured to (191,175,175). That is the engine default, not
    TexturePacker's packing.
* **The Studio's route.** It needs no plugin and ships the import settings, SpriteFrames with
  per-frame durations, and a scene with nearest filtering.

### Features TexturePacker has that the Studio does not (the measured gap is above)

* **Polygon packing and polygon meshes.** The measured gain is 2.5–4.5 % on the sprite pack and a
  loss on characters.
* **68 data formats.** Examples: cocos2d, SpriteKit, Unreal Paper2D, MonoGame, libGDX, Solar2D,
  GameMaker texture group, Godot tpsheet, Unity tpsheet, and custom exporters. The Studio has 17
  targets.
* **GPU texture formats and reduced pixel formats with dithering.** PVR/PVRTC, ETC1/2, ASTC, DXT,
  Basis, KTX/KTX2, WebP, JPG; RGBA4444, RGB565 and so on.
* **Smart folders and a command line / `.tps` project file for build pipelines.**
* **Normal-map sheet packing with the same layout (`--pack-normalmaps`).** The Studio's Texture
  workspace works per sheet, not per packed atlas.
* **Scale variants with smooth filters and Scale2x/Hq2x.** The Studio has nearest only, which is
  the correct choice for pixel art.
* Force-identical layout across variants, content protection, sprite pivots per sprite in the GUI.

Things the Studio has that TexturePacker does not show in this comparison:

* animations with per-frame durations, tags, pivots and hitboxes reaching the engine;
* `.aseprite`, GIF, APNG and WebM output;
* the Godot scene and import settings;
* engine checks run in the real engines;
* it runs free in a browser.

## 2. Normal maps: SpriteIlluminator and Laigter vs. Studio Texture

### Method

The assets, reference normals and metrics are the ones in `docs/STUDIO-TEXTURE.md`, which also
explains why these references are the ground truth. Measured with
`tools/engine-verify/texture/h2h_measure.mjs`.

**Assets and their reference normal maps:**

* **asteroids**: normals rendered from the 3D models (OGA, Jarusca, CC0).
* **torch**: normals hand-painted by the artist, pixel art (OGA, XLIVE99, CC0).
* **bricks**: ambientCG NormalGL. The tools get the albedo (`bricks`) or the 8-bit displacement
  (`bricksheight`) as input.

**Metrics:**

* **°**: mean angle to the reference normal.
* **°best**: the same after the best single strength factor. Strength is a slider in every tool;
  the shape is not.
* **Lambert**: mean |N·L difference| × 255 for 4 lights at 45°.
* **Roll**: the output of the texture rolled by half, then rolled back, compared on a 2 px border
  band. 0 means wrap-correct.

**New here: the maps lit in Godot 4.7.2** (`tools/h2h/godot_lit.py` + `godot_lit_probe.gd`).

* Every tool's normal map and the reference map are put in a CanvasTexture with the same diffuse.
* The scene is lit by a uniform PointLight2D at each corner of the picture, one at a time, at a
  height of half the picture. A black CanvasModulate means only the light is seen.
* The measure is the mean and 95th percentile of the difference to the reference-normal render, in
  8-bit levels, over opaque pixels.
* Two controls give the scale:
  * **flat**, a normal map that does nothing;
  * **green-flipped reference**, the right shape with the wrong convention.

**How each tool was run:**

* **SpriteIlluminator 2.1.2** (Pro trial) has no command line. It was driven through its GUI with
  UI Automation (`pywinauto`):
  1. Add sprites.
  2. Select a sprite.
  3. Apply an effect with its default settings.
  4. Export normals, with the dialog defaults: suffix `_n`, Y not inverted, "7 bit, best
     compatibility" Z.

  The effects used:
  * sprites: **Bevel** (width 16, height 100 %, smoothness 8, Up), and Bevel + **Emboss** (height 4,
    smoothness 1);
  * textures: **Emboss**. It is SpriteIlluminator's detail-from-brightness effect, and it has no
    tile mode. Bevel has a *Tile mode* box, but on an opaque texture Bevel has no edges to act on.
* **Laigter 1.14**: the outputs of the 2026-09-24 run (CLI `--no-gui`, default and `Tile` preset),
  the same files as in `docs/STUDIO-TEXTURE.md`.
* **Nerulio**: regenerated today by `h2h_measure.mjs` with the parameters the Studio suggests when
  it opens the picture. There was no per-asset tuning on any side.

### Accuracy against the reference normals

| Tool | Asteroids ° / °best / Lambert | Torch ° / °best / Lambert | Bricks albedo ° / °best / Lambert · roll | Brick height ° / °best / Lambert · roll |
|---|---|---|---|---|
| **Nerulio** | 20.0 / 19.6 / 35.6 | 38.1 / 37.6 / 62.5 | 14.7 / 14.4 / 29.4 · **0** | 8.8 / 5.5 / 17.6 · **0** (as a height map: 7.7 / 5.5 / 15.5 · **0**) |
| SpriteIlluminator, defaults | 19.7 / 17.7 / 36.5 (Bevel) | **36.6** / **36.4** / 64.7 (Bevel) | **14.1** / 13.9 / **28.4** · 1.49 (max 9) | **7.5** / 6.1 / **15.0** · 2.94 (max 24) |
| SpriteIlluminator, Bevel + Emboss | 18.2 / 16.3 / 33.7 | 38.3 / 36.9 / 67.4 | — | — |
| Laigter 1.14, default | **18.3** / **14.3** / **31.9** | 41.6 / 37.4 / 63.9 | 27.3 / 15.8 / 51.3 · 63.8 | 29.8 / 13.7 / 54.7 · 57.8 |
| Laigter 1.14, Tile preset | — | — | 16.5 / **12.5** / 33.0 · 0 | 26.0 / 10.3 / 49.4 · 0 |

### Lit in Godot 4.7.2

Difference from the scene lit with the reference normal map, in 8-bit levels, mean / p95. Lower is
better.

| Tool | Asteroids | Torch | Bricks (albedo) | Bricks (height) |
|---|---|---|---|---|
| **Nerulio** | 6.98 / 24 | 36.2 / 115 | 10.1 / 29 | 5.96 / 17 (as a height map: 4.97 / 15) |
| SpriteIlluminator (Bevel / Emboss) | 7.39 / 26 | 37.5 / 108 | **9.78** / **28** | 5.09 / **14** |
| SpriteIlluminator (Bevel + Emboss) | 6.86 / 24 | 42.1 / 128 | — | — |
| Laigter default / Tile | **6.32** / **23** | 51.0 / 166 | 16.0 / 47 · Tile 11.3 / 33 | 17.0 / 47 · Tile 15.3 / 43 |
| PBR Forge (web, for reference) | 14.2 / 34 | **29.1** / **66** | 10.6 / 31 | 8.9 / 26 |
| control: **flat** normal map | 15.4 / 35 | **26.6 / 69** | 11.5 / 34 | 11.5 / 34 |
| control: reference, green flipped | 10.1 / 31 | 19.5 / 67 | 15.1 / 51 | 15.1 / 51 |

What this shows:

* **Rendered sprites (asteroids): a close three-way race, and Nerulio is not first.**
  * Laigter's default is closest (6.3 levels, 18.3°). Then SpriteIlluminator Bevel + Emboss (6.9),
    Nerulio (7.0), and SpriteIlluminator Bevel alone (7.4).
  * The spread is under 1 level lit and under 2° in angle. All three are far better than a flat map
    (15.4).
* **Hand-painted pixel art (torch): every generator is worse than no normal map at all.**
  * A flat map is 26.6 levels off. Nerulio is 36.2, SpriteIlluminator 37.5 and Laigter 51.0.
  * Stylised normals cannot be derived from the colours. None of these tools should claim they can.
  * For such art the honest advice is a hand-painted map, or the height brush.
* **Tileable texture from its albedo:**
  * SpriteIlluminator's Emboss is slightly closer than Nerulio: 9.8 vs. 10.1 levels, 14.1° vs.
    14.7°.
  * But it is **not seamless**. The roll test finds a border band of 1.49 (max 9) on the albedo and
    2.94 (max 24) on the height input, because Emboss has no wrap mode.
  * Nerulio is exactly wrap-consistent (roll 0).
  * Laigter needs its Tile preset to reach roll 0, and is then less accurate (11.3).
* **Height map input:** SpriteIlluminator's Emboss (5.09) is between Nerulio's height-map mode
  (4.97, the closest) and Nerulio's default brightness mode (5.96).
* **Convention.** All outputs read as OpenGL (Y+) to the Studio's detector, with high confidence.
  SpriteIlluminator's "Invert y axis" option gives DirectX.

### Workflow: from a sprite PNG to a lit sprite in Godot

| | Nerulio Studio Texture | SpriteIlluminator 2.1.2 | Laigter 1.14 |
|---|---|---|---|
| Price | free, browser | ≈ US$49.99 (TexturePacker bundle US$69.99), perpetual with 1 year of updates; Windows/macOS/Linux | free GPL build on GitHub, paid on itch.io |
| Steps to a normal map | drop the PNG: the map is generated at once, 12–380 ms for these inputs | Add sprites (file dialog) → select → Bevel → Apply → (Emboss → Apply) → Export normals → OK: **6–8 actions** | open, drag PNG, export (or one CLI call) |
| Steps to a lit Godot scene | Ctrl+E → Export ZIP → open `<name>_lit.tscn` (**verified in Godot 4.7.2**, ≤ 1/255 vs the preview) | set up CanvasTexture + lights by hand. Its lit preview uses its own light model, not Godot's | by hand |
| Unity 6 URP 2D | importer + Light2D preview (verified) | by hand | by hand |
| Command line / batch | ○ (the pipeline modules run in Node, no user CLI) | **none** | ● |
| Bevel from alpha | ● size-aware default | ● width/height/smoothness/direction | ● |
| Detail from brightness | ● with a high-pass | ● Emboss | ● |
| Wrap-correct textures | ● suggested for opaque pictures, roll 0 | ○ Emboss has no wrap (roll 1.5–2.9) | ● with the Tile preset |
| Height-map input (16-bit) | ● | ○ | not checked |
| Paint tools | height brush: raise/lower/smooth/flatten/erase | **more**: Height, Angle, Structure (patterns), Smoothen, Erase, plus Color/Polygon/Rectangle/Ellipse selection, Move, copy/paste normals | ○ |
| Per-frame processing of a sheet | ● frames never bleed | one sprite per image; sheets as one picture | the CLI treats a sheet as one image |
| GL/DX detection with confidence | ● | ○ (export option only) | ○ |
| Pixel-art quantised normals | ● 4–32 directions | ○ | ○ |
| AO, specular, cavity maps | ● (labelled approximations) | ○ | ● specular, occlusion, parallax |
| Packing normal maps with the atlas | ○ | ● through TexturePacker (`--pack-normalmaps`) | ○ |
| Export lit sprite / animation | ○ (a lit Godot scene instead) | ● | ○ |

**Summary.**

* **Accuracy: a tie, or a small loss.** SpriteIlluminator and Laigter are as good as Nerulio, and
  on some inputs slightly better: up to 1.8° and 0.9 lit levels.
* **Nerulio wins** on seams, engine export (verified Godot and Unity scenes), convention detection,
  height input, per-frame sheets, price and steps.
* **Nerulio loses** on paint tools. SpriteIlluminator's Angle and Structure brushes and its
  selection tools have no equivalent in the Studio.

## 3. Autotiles: Tilesetter, Tiled and Godot vs. Studio Tile

### Tilesetter: partly measured (Lite), full version docs-based

* **What was run.** Tilesetter **Lite 2.1.0**, the free demo from the official itch.io page
  (led.itch.io/tilesetter). No account or payment. It is an Electron 10 app, driven over the
  DevTools protocol.
* **Not bought: the full version, US$12.99** (itch.io, with a Steam key). Everything below marked
  *docs* comes from tilesetter.org/docs and was not run.
* **Input.** Tiles cut from the real cave blob-47 sheet (OGA, CC0, 64 px): the full tile (mask 255)
  as the *base* and the top-edge tile (mask 124) as the *edge*.

| Step | Tilesetter Lite 2.1.0 (measured) | Tilesetter full US$12.99 (*docs*) | Nerulio Studio Tile (measured, `docs/STUDIO-TILE.md`) |
|---|---|---|---|
| Bring the art in | set tile size 64 → paste or Ctrl+I into the Set View | same | drop the sheet; grid and layout are recognised from the pixels |
| Generate 47 tiles from **base + edge** | **refused**: "Blob border generation between two or more tiles not available in Tilesetter Lite" | Build Borders (Blob) with the base + edge tiles | Generator: A2 / Blobsmith / A4 wall / five-tile / procedural-rim sources → blob-47 or dual-grid 16, quarter-exact |
| Generate from **one** tile | works: right-click → Build Borders (Blob) cuts the base against empty space with a 4 px cutoff (1 selection + 2 clicks). No rim art is drawn | same, plus per-direction edge textures and custom corners | procedural rim from a single block |
| Use an **existing, artist-made** 47 sheet | tiles only, no rules | Godot/Unity/GMS2 export "with auto-tile bitmasks pre-configured" when exported from the Set View (*docs*) | 7 actions, 4.5 s: layout recognised (GameMaker 47, medium, AUC 0.964); bits 47/47 vs. truth |
| Export PNG | Export → Image. In the scripted run it wrote only 1 of 55 selected tiles; not resolved, probably the automation | PNG, JSON | PNG + Godot / Tiled / LDtk / Unity / generic in one ZIP |
| Godot | **Pro** | "auto-tile bitmasks" (*docs*). That is Godot 3 terminology; the changelog never mentions Godot 4 terrains, and the Lite build is dated 2021-12, before Godot 4.0. **Godot 4 support unverified** | TileSet terrain set built by the shipped importer in Godot 4.7.2; **485/485** painted cells right |
| Unity | **Pro** | `.unitypackage` with Rule Tiles, needs the 2d-extras scripts (*docs*) | RuleTiles built in Unity 6000.5.3f1, `GetSprite` = prediction in every cell |
| Tiled / LDtk | — | — (not listed) | Tiled Wang set (verified with Tiled 1.12.2), LDtk rules (schema + loader) |
| GameMaker / Defold | **Pro** | GMS2 with auto-tiling; Defold without tile behaviours (*docs*) | — (not exported) |
| Map editor | "Map editor not available in Tilesetter Lite" | yes, with isometric support | test map with the Godot and the Tiled rule |

**Verdict.**

* **Tilesetter's real strength is generation.** Base + edge tiles, per-direction edge textures and
  mixed borders give art the Studio's quarter-based generator cannot make from two tiles. That
  feature is paid, and it was **not measured**.
* **Nerulio wins** on:
  * using existing 47 sheets: recognition, bits, and engine files verified in Godot 4;
  * price;
  * Godot 4.

### The free baseline: setting up a working 47-tile terrain by hand

`tools/h2h/autotile_clicks.py` computes the unavoidable marking from the corpus ground-truth masks
of the same cave sheet (47 tiles, 47 distinct masks; the GameMaker template gives the same numbers).
Setup steps are counted from the editors' own UI. The editors were not driven, so the setup counts
are *docs/UI-based*. The bit counts are exact.

| | Godot 4.7 TileSet editor | Tiled 1.12 Wang sets | Nerulio Studio Tile |
|---|---|---|---|
| Setup | TileMapLayer → New TileSet → tile size 64 → drag the PNG in → "create tiles automatically" → Terrain Sets: add, mode *Match Corners and Sides*, add terrain → Paint tab → Terrains → pick set and terrain: **≈ 11 steps** | New Tileset (image, 64 px) → Terrain Sets → add *Mixed Set* → add a colour → select the terrain brush: **≈ 6 steps** | Tile tab → import → pick the file → Use this grid → first candidate → Apply: **6 actions** (measured) |
| Marking | **235 bits**: 47 centre + 188 peering, 136 of them sides and 52 corners. A drag can paint several bits at once, so this is the number of bits to set, not a minimum click count | **188 regions**. The all-zero island tile cannot be stored (Tiled drops Wang ID 0) | **0**: the bits come from the recognised layout (188 peering bits written) |
| Chance of a wrong bit | any of 235 manual marks; one swapped pair makes Godot pick wrong tiles (the harness self-test shows exactly that) | any of 188 | art-vs-bits check: two swapped tiles are found exactly on every blob set |
| Checked in the engine | whatever you painted | whatever you painted | Godot 4.7.2 485/485 cells; Tiled 1.12.2 reads every Wang ID as written; Unity RuleTile every cell |
| Time | minutes, not measured | minutes, not measured | 4.5 s (measured, Chromium) |

Godot and Tiled are free, and both have terrain brushes. Neither recognises a layout or generates
tiles. For a sheet in a known layout the Studio removes the 188–235 manual marks. For art in no
known layout, it suggests bits from the pixels: 47/47 on the textured cave art, 0/16 on the Wang
edge template without a reference tile (`docs/STUDIO-TILE.md`).

## Blocked on payment or an account (for the owner to decide)

| Tool | What is blocked | Cost / action |
|---|---|---|
| Tilesetter (full) | base + edge generation, engine exports and the map editor, so a measured comparison of generation quality and of its Godot/Unity output | US$12.99 on itch.io or Steam |
| TexturePacker Importer for Unity | loading TexturePacker's Unity output in Unity 6 | free, but only through the Unity Asset Store: an "acquire" action on the owner's Unity account |
| TexturePacker Pro / SpriteIlluminator Pro | nothing for this report (7-day trials, no account). Re-running after 2026-10-02 needs a licence | US$49.99 each, or US$69.99 as a bundle; perpetual with 1 year of updates |

## Improvements that would turn losses into wins

1. **Spaceshooter-type packs (many small sprites, many sizes), −0.8 to −2.5 %.**
   * Try more strip widths and sort orders at `effort:'best'`, and optionally allow long pages when
     the user permits them. TexturePacker's wins here come from 14:1 strips or a 959² page.
   * Target: ≤ TexturePacker's square result (919,681 px²) on spaceshooter.
2. **Alias + page limit, −1.1 % on archer ×8.** The same search improvement applies.
3. **Polygon packing (optional).**
   * Worth it only for sprite packs with angular shapes: 4.5 % on spaceshooter, worse on characters.
   * It is also limited by engines: Phaser, Pixi and Godot's AtlasTexture do not draw TexturePacker
     meshes from these exports.
   * Lower priority than 1.
4. **Formats.**
   * WebP (lossless) output is cheap and widely read.
   * GPU formats (ASTC/ETC2/Basis) matter for mobile. The Studio would need encoders and engine
     checks.
   * More data formats with real users: cocos2d plist, libGDX (already via Spine), MonoGame.
5. **Speed on big jobs.** Measure the browser worker against the CLI on the same 1,000-frame set
   before claiming parity.
6. **Normal maps of rendered sprites, 1.7° and 0.7 lit levels behind Laigter's default.**
   * Laigter's dome over the whole silhouette fits 3D-rendered sprites best at the best strength
     (14.3° vs. Nerulio's 19.6°).
   * Try a rounder profile with a larger default width for HD sprites, and re-measure on more than
     one 3D-rendered set before changing the default.
7. **Brightness detail on textures, 0.3 lit levels behind SpriteIlluminator's Emboss.** Compare
   Emboss's small-radius relief with the Studio's high-pass on more ambientCG sets. The seam
   advantage must stay at 0.
8. **Paint tools.** An *angle* brush (paint a slope direction directly) and pattern/structure
   stamps would close the feature gap with SpriteIlluminator.
9. **Hand-painted pixel art.**
   * When the Studio suggests generated normals for small pixel art, say that a flat or hand-painted
     map may be better (measured: flat 26.6 levels vs. 36.2 on the torch).
   * Consider a lower default strength for pixel art.
10. **Tilesetter-style generation.**
    * Build blob-47 / Wang-16 from one base tile + one edge tile, with per-direction edge textures
      and corner overrides.
    * This is the one tile feature the paid competitor has and the Studio lacks.
    * Measure it against Tilesetter's full version once the owner decides whether to buy it
      (US$12.99).
11. **Engine formats Tilesetter lists and the Studio does not:** GameMaker `.yy` with auto-tiling,
    and Defold tilesource for tile sets. Both need a real-engine check before they ship.
