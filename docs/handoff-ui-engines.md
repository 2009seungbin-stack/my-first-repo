# Hand-off: UI engine verification (Studio P5, UI & fonts)

State on 2026-09-24, when this work was stopped for a new session. Everything below comes from
real engine runs on this machine unless it is marked **not run** or **hypothesis**. All code lives
in `tools/engine-verify/ui/`. No git commands were run by this agent.

Scratch (outputs of the runs quoted here):
`C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad\p5\studio-ui\engines\`

* `ref-ui/`: the reference UI bundle (make_ui_bundle.py).
* `w-all/r.json` + `w-all.txt`: the last full 9-slice run.
* `fonts/`: the reference font bundles (make_font_refs.py).
* `diag.py`, `fit.py`, `decode.py`, `rejudge.py`, `show.py`: throw-away analysis scripts.

## Files

| File | What it is | State |
|---|---|---|
| `ui_common.py` | Bundle reader. Reference nine-slice renderer (per-axis segments, engine profiles, tie handling). Pixel compare. Standard size matrix. | done, used by every run |
| `make_ui_bundle.py` | Builds the reference `nerulio-ui.json` bundle from the Kenney packs, plus every engine file the Studio should export: `godot/<el>.tres` StyleBoxTexture, `godot/<button>_theme.tres`, `web/nerulio-ui.css`, `web/<image>.atlas.json` (Phaser `scale9Borders` + Pixi `borders`), `web/<el>.png` crops for CSS. `--corrupt unity-order\|tres-margins` writes the negative controls. | done. Negative controls **not run yet** |
| `verify_ui.py` | `verify_ui.py <bundle> [--engines godot,unity,phaser3,phaser4,pixi8,css] [--json] [--work] [--port 4521]`. Also holds the Godot runner. | done |
| `godot/ui_probe.gd` | Godot probe. Paths: `tres` (the shipped .tres via `draw_style_box`), `helper` (Builder-built .tres reloaded), `ninepatch` (NinePatchRect from the helper). Plus Button states through the shipped Theme. | done |
| `unity_ui.py` + `unity/NerulioUIProbe.cs` | Unity runner and probe. Builds its own template `%LOCALAPPDATA%\nerulio-engine-verify\unity-template-ui` (shared template + built-in `com.unity.ugui` 2.5.0 + TMP Essential Resources) and copies it per run. | done |
| `web_ui.py` + `web/ui_harness.{html,js}` | Phaser 3.90, Phaser 4.2.1, Pixi 8.21 and CSS in Playwright Chromium. Port 4521 is bound only during a run; if it is busy the run waits and retries. The harness also has a font mode (`phaserFont` / `pixiFont`). | 9-slice done. Font mode written, **not run** |
| `helpers/nerulio_ui_import.gd` | Godot helper. `Builder.build(json, out_dir)` writes `<el>.tres` and `<button>_theme.tres`; `stylebox()`, `nine_patch_rect()`, `theme()`. | verified |
| `helpers/NerulioUIImporter.cs` | Unity editor importer. `Import(json)` sets Sprite, Point, uncompressed, no mips, FullRect, PPU 100. Uses Single or Multiple mode (bottom-left rects) with border `Vector4(L,B,R,T)`. Writes a button prefab (SpriteSwap, `Content` child inset by padding). `ConfigureImage(img, export, el, uiScale)` sets Sliced/Tiled, fillCenter and `pixelsPerUnitMultiplier = 1/scale`. | verified |
| `font_formats.py` | Reads msdf-atlas-gen JSON; writes BMFont text, XML and binary v3; reads all three back. Also repacks glyphs into multiple pages (CJK). | done, output checked by eye only |
| `make_font_refs.py` | Runs the real msdf-atlas-gen 1.4 CLI. Makes `kf-{msdf,mtsdf,sdf,bitmap}` (Kenney Future, ASCII, 32 px/em, pxrange 4, y bottom, plus 4 **synthetic** kerning pairs, because the font has no kern table) and `gm-{msdf,mtsdf,sdf}` (Galmuri11, ASCII + Korean words, y top). `gm-bitmap` is a hardmask at 24 px/em repacked into three 128² pages. `cozette` is the corpus BMFont plus XML and binary versions. | done, generated OK |
| `outline_ref.py` | Exact outline coverage from fontTools: nonzero winding, 8×8 supersampling, no hinting. | done, checked on A/O/게 |
| `helpers/nerulio_font_import.gd` | Godot: msdf-atlas-gen JSON → FontFile. MSDF (msdf_pixel_range = distanceRange, msdf_size = atlas.size; sdf grey copied to RGB) or bitmap (fixed_size, integer scaling). Glyph offset/size/uv from plane/atlas bounds; kerning. | written, **first run was interrupted** |
| `godot/font_probe.gd` + `verify_font.py` | Font verifier. Checks glyph masks against the outline (common shift + 1 px jitter, wrong % of ink), pixel-exact against the file bitmap for bitmap fonts, and kerning by pair ink width. | Godot part written, **not completed** (the first attempt hit a GDScript parse error, since fixed; the second was stopped by the lead) |
| `helpers/NerulioTMPFontImporter.cs`, `unity_font.py`, `web_font.py` | — | **not written** |

## Part A: nine-slice semantics (measured)

Every element of the reference bundle was drawn at 7 sizes plus the previews, 114 cases per path:

* equal to the source size;
* smaller than the source but larger than L+R;
* squash: smaller than L+R;
* 3×+7 (large and odd);
* 2× scale at odd sizes;
* 3× scale;
* 1.5× scale.

All drawing used NEAREST filtering. The calibration image `calib.png` (16×14) has a unique colour per texel and asymmetric borders L3 R5 T2 B4, so `decode.py` can read back which texel each engine pixel shows.

### Last full run (`w-all.txt`)

| Engine / path | PASS | FAIL | N/A | Note |
|---|---|---|---|---|
| Godot 4.7.2: shipped `.tres` | 114 | 0 | 0 | also buttons: 5/5 states PASS (Theme .tres, hover via pushed mouse event) |
| Godot: helper-built `.tres` | 114 | 0 | 0 | fields read back == JSON |
| Godot: NinePatchRect | 98 | 0 | 16 | N/A = Control grew to min size (patch margins) |
| Unity 6000.5.3f1 (D3D12, Gamma) | 93 | 0 | 21 | sprite rect/border read-back 16/16 right; buttons 5/5 PASS |
| Phaser 4.2.1 | 58 | 0 | 56 | N/A = tile / tile-fit / drawCenter=false |
| PixiJS 8.21 | 58 | 0 | 56 | same N/A reasons |
| CSS (Chromium), shipped classes | 94 | 0 | 20 | N/A = element grew (see below) |
| CSS, border-width:0 ("css-raw") | 114 | 0 | 0 | with 0.5 px slack + small residue, see below |
| **Phaser 3.90** | 0 | **58** | 56 | **open problem**: in an earlier run with the same profile (layout gap 16, canvas smaller) Phaser 3 passed 58/58. In the full run (gap 32) every case is wrong from pixel (0,0), i.e. the whole canvas is offset. Suspect the Phaser 3 snapshot/resize with the bigger canvas. Re-run `--engines phaser3` alone and diff `w-all/phaser3/_canvas.png` against the slots |

### Semantics per engine (these are `ui_common.PROFILES`)

* **Studio plan** (`src/game/nine-slice.js`)
  * Squash: `L' = floor(D·L/(L+R))`, `R' = D−L'`.
  * Tile: tiles start at the begin border; the last tile is clipped.
  * **No engine squashes like this.** Every squash case differs from the plan in every engine. At all other sizes Godot, Phaser 4 and Pixi equal the plan.
* **Godot 4.7.2** (`StyleBoxTexture` / `NinePatchRect`, one shader, `map_ninepatch_axis`)
  * Squash: borders are never squashed. The begin margin wins, then the end margin, and the middle is dropped. Example: panel 14×16 with 12/12 borders shows 12 px of the left corner and 2 px of the right.
  * TILE: starts at the begin border; the partial tile is at the end.
  * TILE_FIT: `n = max(1, floor(area/tile + 0.5))` tiles, stretched to fit.
  * `draw_center = false` leaves the centre transparent.
  * Integer and fractional scale via node scale: exact up to tie pixels.
  * A Control (Panel, NinePatchRect, Button) never gets smaller than its minimum size. For NinePatchRect that is the patch margins; for StyleBox boxes it is the content margins.
  * `content_margin_* = -1` (padding null) means "use the texture margins".
  * Focus: Godot draws the `focus` box **on top of** the state box.
  * The `.tres` with a relative `ext_resource path="../x.png"` **loads**: verified. The Theme .tres with sub_resource StyleBoxTextures loads, and all 5 Button states render right.
* **Unity 6** (UI Image, Sliced/Tiled)
  * Squash: per axis, proportional (float): `A = D·L/(L+R)`.
  * Tiled: tiles start at the bottom-left, so vertically the partial tile is at the **top** in screen space. This is the bottom-left origin effect.
  * No tile-fit and no per-axis modes. The importer warns and uses Tiled.
  * Scale via `pixelsPerUnitMultiplier = 1/scale`: exact.
  * At exact texel-boundary ties the GPU samples `u−ε` even when the pixel belongs to the next quad (texel "bleed" at 1.5×). The tie variants accept this.
  * Sprite rect y = `H − y − h`; border read back as `[L,B,R,T]`. Both right for Single and Multiple (atlas) sprites.
  * Selected (focus) sprite **replaces** normal. It is not an overlay: a ring-only focus element shows only the ring.
  * UI blending onto a transparent RT leaves premultiplied colour. The captures are unpremultiplied before comparing.
* **PixiJS 8** (`NineSliceSprite`, borders from atlas JSON `borders` → `texture.defaultBorders`)
  * Squash: uniform. `f = min(1, W/(L+R), H/(T+B))` is applied to all four borders.
  * Stretch only; the centre is always drawn.
  * Exact at all scales.
* **Phaser 4 / Phaser 3.90** (`add.nineslice(x,y,key,frame,w,h)`, borders from atlas `scale9Borders` {x,y,w,h} = the centre rect)
  * Nine quads are drawn TL,T,TR,L,C,R,BL,B,BR and **alpha-composited over each other**.
  * Borders are never squashed: the overlap shows both corners blended, and the middle quad turns inside out.
  * Stretch only; the centre is always drawn.
  * top = bottom = 0 means **3-slice**: Phaser ignores the requested height and draws the frame height.
  * `setSize()` clamps the width to ≥ L+R (the constructor does not).
  * Phaser 3 with `pixelArt` rounds quad vertices to whole pixels (`round_vertices`). This is visible at 1.5×.
* **CSS border-image** (Chromium)
  * `repeat` centres the tiles in the area. Measured: this matches exactly, and it differs from the Godot/Studio start alignment.
  * `round` rounds the tile count (`round` = tile-fit).
  * Each edge's tiles use that edge's own scale (width/slice). The centre uses the top edge's horizontal scale and the left edge's vertical scale.
  * A `<length>` border-image-width is **floored** to whole px (4.5 → 4, 7.5 → 7).
  * Squash is uniform (like Pixi), and the scaled edges are then rounded half up.
  * Skia's nearest resampling at non-integer ratios puts texel boundaries up to 0.5 px away from centre sampling. The profile has `slack=0.5` and a residue tolerance of max(4 px, 0.5 %); `strictWrong` in the JSON gives the raw count.
  * A border-box element never gets smaller than its border-width. The shipped CSS uses border-width for the padding (content inset) and border-image-width for the slices, so at squash sizes the element **grows** (N/A in "css").
  * `fill` = drawCenter.
  * Atlas elements need cropped PNGs, because border-image cannot crop.
  * `space` and `border-image-outset`: **not measured** yet.

### Open items for part A

1. The Phaser 3 regression above.
2. Negative controls: run `make_ui_bundle.py <dir> --corrupt unity-order` and `--corrupt tres-margins` and confirm FAIL. Not done yet.
3. CSS `space` and `border-image-outset` probe. Not done.
4. The Studio plan's squash rule matches no engine. Either the preview gets per-engine profiles (recommended; the profiles in `ui_common.py` are exactly what the engines do), or the Studio picks one.
5. Performance: judging all engines takes a few minutes, because tie variants are rendered lazily only for failing cases.

## Part B: fonts (partly measured)

* msdf-atlas-gen 1.4 (in the cache, `.ready` present) works.
  * `atlasBounds` are inset half a texel (e.g. 164.5..189.5).
  * With `-pxalign on` the BMFont integer offsets are exact (rounding error 0.0 for all 8 generated fonts).
  * `yOrigin: top` flips the metric signs (ascender −1, descender +0.17).
  * Kenney Future and Galmuri11 give **0 kerning pairs**, so the synthetic pairs are used for kf-*.
* **Unity TMP is available offline.**
  * uGUI 2.5.0 is a built-in editor package: `Editor\Data\Resources\PackageManager\BuiltInPackages\com.unity.ugui`.
  * `Package Resources/TMP Essential Resources.unitypackage` is inside it. The UI template imports it; `Assets/TextMesh Pro/{Shaders,Resources,Fonts}` are present.
  * TMP_FontAsset `glyphTable`, `characterTable`, `atlasWidth/Height/Padding`, `atlasRenderMode` and `fontFeatureTable` have **internal setters**, so the importer must use reflection (or `SerializedObject`). `faceInfo`, `material` and `creationSettings` are public.
  * TMP sets `_GradientScale = padding + 1` (TMP_FontAssetCreatorWindow.cs:1679).
  * The msdf-atlas-gen `distanceRange` → GradientScale mapping is **not measured yet**. Plan: have TMP generate an SDFAA atlas for a known padding and measure the alpha slope across a straight stem.
* **Pixi 8 distance fields** (from reading the source, **not run**)
  * The text and XML parsers read `distanceField`.
  * **One shader for every fieldType:** `median(r,g,b)`, then `min(median, a)`.
  * Field textures are loaded linear with `premultiply-alpha-on-upload`. So:
    * sdf must be grey in RGB with opaque alpha;
    * msdf must be RGB with opaque alpha;
    * mtsdf will probably break, because premultiplication scales RGB by the true-SDF alpha.
  * The loader reads text or XML only; binary is not supported.
* **Godot**: whether Godot's .fnt importer reads `distanceField` is **not verified yet**. The probe records `multichannel_signed_distance_field` for the imported .fnt files. The helper's header states the expected answer (it ignores it) as a hypothesis.
* **Phaser**: bitmap XML only; a field would be drawn as a picture. Not run.

## Exact next steps

1. `python tools/engine-verify/ui/verify_font.py <scratch>/fonts --engines godot --work <dir> --json <dir>/r.json`. It takes about 10+ minutes: 9 fonts × up to 4 files × 2–4 sizes. Use `--only kf-msdf,gm-bitmap` first. Then:
   * look at the wrong% numbers;
   * set `FIELD_LIMIT` / `GLYPH_LIMIT` from the data;
   * check that the bitmap rows are pixel exact;
   * check that `msdf` is false for the imported .fnt with distanceField.
2. Write `web_font.py`. Mirror `web_ui.py`, using the harness font mode: plan `{mode:'font', fonts:[{key,data,image}], texts:[{id,font,text,size,slot}], canvas}`, then pass slots and pens into `verify_font.judge_run`.
3. Write `helpers/NerulioTMPFontImporter.cs`, `unity/NerulioFontProbe.cs` and `unity_font.py`. Reuse `unity_ui.new_project` and `template()`.
   * Types: sdf (grey → alpha), mtsdf (take alpha), hardmask (bitmap, TMP Bitmap shader).
   * Measure the GradientScale mapping; render TMP text to an RT.
4. Rerun the 9-slice suite. Fix Phaser 3, then run the negative controls.
5. Update `docs/ENGINE-VERIFY.md` with the tables above once the numbers are final.
