# Nerulio Studio pixel: head-to-head against competitors

Status 2026-09-24. Workspace: `scratchpad/p2/competitors` (WORK). Dataset: `C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-pixel` (DATA).
Nerulio itself is **not** scored here. This file sets the bar it has to beat.

## 1. Dataset (DATA/cases.json, 76 cases)

The dataset has 13 CC0 1x sprite and tile crops (`src1x/`). Each one is degraded in a known way, so we know the exact 1x image a perfect cleanup tool should return. There are also 7 real AI "pixel art" images with no truth.

| kind | n | how it was generated (Pillow, deterministic, `build_cases.py`) |
|---|---|---|
| nearest-int | 20 | NEAREST x2 to x8. 7 of these are also phase-cropped (1 to 5 px cut off top-left; tag `phase`, which has 9 cases in total with the 2 smooth-resample crops) |
| nearest-frac | 9 | NEAREST to round(w*2.5 / 3.3 / 4.7), giving uneven 2/3 px cells |
| smooth-resample | 14 | BILINEAR / BICUBIC / LANCZOS at x3.78, 4.25, 5.5, 7.2 (premultiplied alpha), 2 phase-cropped |
| jpeg | 10 | flattened on a background, upscaled (nn / nf / bilinear / bicubic), then JPEG q70/q85 4:2:0 |
| blur | 6 | NEAREST x3 to x8, then GaussianBlur 0.6 to 1.2 |
| ai-sim | 10 | simulated AI pseudo-pixels: nominal 5 to 10 px cells with 80 to 120% jittered widths, per-cell colour drift ±4, noise ±6, some blur or JPEG |
| ai-real | 7 | real AI outputs from OGA (ClipDrop Stable Doodle, GPT-4 image, "Nano Banana 2 based"). Only size, colour count and time are reported |

Every source is CC0-1.0. Authors are Kenney, Eris, sebshady, GrafxKid, Chris_M_The_Game_Dude., DezrasDragons, "second" (OGA), kooow, batterypuck and Rocks7. Per-file URL, author, licence and sha256 are in `DATA/SOURCES.md`. 47 of the 76 inputs have transparency.

Metrics (`score.py` docstring):
- **acc**: exact-pixel % vs the truth, taking the best integer shift in ±2. Transparent matches transparent; opaque pixels must have identical RGB.
- **acc_tol**: the same, but opaque pixels count as a match when Oklab dE ≤ 0.02.
- **size exact / ±1**: output w×h equals the truth size (or an allowed phase-crop size), exactly or within 1 px.
- **scale_err**: |est − true| / true. The estimate comes from the tool if it reports one, otherwise it is input size / output size.
- **dE**: mean Oklab dE over pixels opaque in both images.
- **fringe %**: share of output pixels whose colour is more than 0.02 dE from every truth colour.

In the tables below, failed cases count as 0 acc and as a size miss. dE, fringe % and scale_err are computed over successful cases only.

## 2. Tools, versions, settings

| tool id | project / version | how it was run | settings |
|---|---|---|---|
| snapper | Sprite Fusion Pixel Snapper (clone of the Rust repo at `ae20461`, Cargo 1.0.0) | `node run_snapper.mjs`. There is no Rust toolchain here, so it runs the **site's own WASM** (`_snapweb/snapper_bg.wasm`, fetched 2026-09-23 from spritefusion.com) under a re-implementation of the site's wasm-bindgen glue. The call signature matches the site worker (`process_image(bytes, k, null, null)`) | k_colors 16 (lib/CLI default and the site slider default), auto pixel size, no palette |
| perfectpixel | theamusing/perfectPixel `72096de` (package 0.1.4) | `python run_perfectpixel.py` with the OpenCV backend | `get_perfect_pixel` defaults: center sampling, min_size 4.0, peak_width 6, refine 0.25, fix_square. The API only takes RGB, so alpha is dropped and outputs are opaque |
| unfake | jenissimo/unfake.js `b2bee10` | `python run_unfake.py unfake` runs the lib and the prebuilt unfake-core WASM in headless Chromium. All 76 runs used the WASM core | browser-tool UI defaults: maxColors 16, detect edge/tiled, downscale dominant, domMeanThreshold 0.15, morph+jaggy cleanup, alpha 128, snapGrid |
| unfake-auto | same | `run_unfake.py unfake-auto` | UI defaults with Grid detection set to `auto` (one dropdown change) |
| unfake-lib | same | `run_unfake.py unfake-lib` | `processImage()` library defaults: maxColors 32, cleanup off |

Timings are not comparable across tools. Snapper was timed in Node WASM, unfake in-page in Chromium, and perfectPixel in Python + OpenCV.

## 3. Aggregate results (69 cases with truth; re-scored 2026-09-24 from `out/*`)

Headline (overall row):

| tool | fail | size exact % | size ±1 % | median scale_err | mean acc % | mean acc_tol % | mean dE | fringe % | mean ms |
|---|---|---|---|---|---|---|---|---|---|
| snapper | 0 | 6 | 28 | 0.309 | 33.4 | 54.7 | 0.158 | 9.6 | 82 |
| perfectpixel | 15 | 30 | 43 | 0.014 | 33.9 | 55.9 | 0.083 | 11.0 | 29 |
| unfake | 0 | 25 | 41 | 0.028 | 38.7 | 63.1 | 0.096 | 9.4 | 68 |
| unfake-auto | 0 | 26 | 42 | 0.028 | 40.7 | 64.8 | 0.096 | 9.5 | 65 |
| unfake-lib | 0 | 25 | 41 | 0.028 | **44.6** | 64.6 | 0.086 | 9.8 | 67 |

Per tool and per kind. `phase` is a tag subset: 7 nearest-int cases and 2 smooth-resample cases.

#### snapper

| kind | n | fail | size exact % | size ±1 % | median scale_err | mean acc % | mean acc_tol % | mean dE | fringe % | mean ms |
|---|---|---|---|---|---|---|---|---|---|---|
| **overall** | 69 | 0 | 6 | 28 | 0.309 | 33.4 | 54.7 | 0.158 | 9.6 | 82 |
| nearest-int | 20 | 0 | 0 | 15 | 0.391 | 48.0 | 50.0 | 0.201 | 2.1 | 36 |
| nearest-frac | 9 | 0 | 0 | 0 | 0.468 | 39.2 | 42.8 | 0.230 | 2.0 | 13 |
| smooth-resample | 14 | 0 | 7 | 29 | 0.061 | 43.9 | 52.1 | 0.151 | 32.2 | 71 |
| jpeg | 10 | 0 | 10 | 20 | 0.356 | 2.6 | 45.1 | 0.145 | 7.9 | 113 |
| blur | 6 | 0 | 0 | 33 | 0.027 | 46.6 | 60.5 | 0.079 | 6.9 | 74 |
| ai-sim | 10 | 0 | 20 | 80 | 0.010 | 6.9 | 84.8 | 0.074 | 3.2 | 229 |
| phase (tag) | 9 | 0 | 11 | 33 | 0.276 | 56.1 | 58.8 | 0.162 | 17.0 | 31 |

ai-real (no truth): horror_monster 132x127/16c, gosoythoth 178x25/16c, guns 106x84/16c, bones 139x112/16c, asteroids 104x83/16c, turrets 113x86/16c, gosoythoth_f0 29x25/13c

#### perfectpixel

| kind | n | fail | size exact % | size ±1 % | median scale_err | mean acc % | mean acc_tol % | mean dE | fringe % | mean ms |
|---|---|---|---|---|---|---|---|---|---|---|
| **overall** | 69 | 15 | 30 | 43 | 0.014 | 33.9 | 55.9 | 0.083 | 11.0 | 29 |
| nearest-int | 20 | 8 | 55 | 60 | 0.000 | 59.7 | 59.7 | 0.000 | 0.0 | 21 |
| nearest-frac | 9 | 7 | 0 | 0 | 0.069 | 13.6 | 13.6 | 0.157 | 0.0 | 13 |
| smooth-resample | 14 | 0 | 0 | 7 | 0.111 | 37.9 | 46.4 | 0.162 | 20.0 | 25 |
| jpeg | 10 | 0 | 40 | 60 | 0.006 | 11.5 | 67.2 | 0.086 | 15.3 | 31 |
| blur | 6 | 0 | 33 | 50 | 0.023 | 60.5 | 69.7 | 0.097 | 2.1 | 23 |
| ai-sim | 10 | 0 | 40 | 80 | 0.009 | 1.3 | 79.7 | 0.045 | 14.8 | 65 |
| phase (tag) | 9 | 3 | 44 | 44 | 0.015 | 60.2 | 61.6 | 0.027 | 3.0 | 22 |

ai-real (no truth): horror_monster 129x125/5620c, gosoythoth 153x22/2094c, guns 106x78/1365c, bones 122x99/2020c, asteroids 92x73/1269c, turrets 76x61/1328c, gosoythoth_f0 25x23/348c

#### unfake

| kind | n | fail | size exact % | size ±1 % | median scale_err | mean acc % | mean acc_tol % | mean dE | fringe % | mean ms |
|---|---|---|---|---|---|---|---|---|---|---|
| **overall** | 69 | 0 | 25 | 41 | 0.028 | 38.7 | 63.1 | 0.096 | 9.4 | 68 |
| nearest-int | 20 | 0 | 80 | 80 | 0.000 | 70.8 | 75.5 | 0.056 | 1.2 | 41 |
| nearest-frac | 9 | 0 | 0 | 0 | 0.200 | 32.9 | 34.8 | 0.159 | 0.6 | 18 |
| smooth-resample | 14 | 0 | 0 | 0 | 0.090 | 39.8 | 48.5 | 0.122 | 29.4 | 65 |
| jpeg | 10 | 0 | 10 | 60 | 0.000 | 11.2 | 73.2 | 0.089 | 8.6 | 87 |
| blur | 6 | 0 | 0 | 67 | 0.000 | 47.8 | 68.5 | 0.046 | 11.0 | 66 |
| ai-sim | 10 | 0 | 0 | 20 | 0.014 | 0.0 | 70.8 | 0.115 | 5.9 | 150 |
| phase (tag) | 9 | 0 | 67 | 67 | 0.000 | 66.6 | 71.3 | 0.052 | 10.0 | 38 |

ai-real (no truth): horror_monster 84x85/16c, gosoythoth 95x13/15c, guns 209x166/16c, bones 210x166/16c, asteroids 30x25/15c, turrets 209x166/16c, gosoythoth_f0 11x9/11c

#### unfake-auto

| kind | n | fail | size exact % | size ±1 % | median scale_err | mean acc % | mean acc_tol % | mean dE | fringe % | mean ms |
|---|---|---|---|---|---|---|---|---|---|---|
| **overall** | 69 | 0 | 26 | 42 | 0.028 | 40.7 | 64.8 | 0.096 | 9.5 | 65 |
| nearest-int | 20 | 0 | 85 | 85 | 0.000 | 77.7 | 82.2 | 0.048 | 1.2 | 35 |
| nearest-frac | 9 | 0 | 0 | 0 | 0.200 | 32.9 | 34.8 | 0.158 | 0.6 | 16 |
| smooth-resample | 14 | 0 | 0 | 0 | 0.090 | 39.8 | 48.5 | 0.123 | 29.6 | 65 |
| jpeg | 10 | 0 | 10 | 60 | 0.000 | 11.2 | 73.2 | 0.089 | 8.7 | 84 |
| blur | 6 | 0 | 0 | 67 | 0.000 | 47.8 | 68.5 | 0.046 | 10.9 | 66 |
| ai-sim | 10 | 0 | 0 | 20 | 0.018 | 0.0 | 68.9 | 0.139 | 5.9 | 152 |
| phase (tag) | 9 | 0 | 44 | 44 | 0.091 | 54.3 | 58.4 | 0.094 | 10.0 | 37 |

ai-real (no truth): horror_monster 84x85/16c, gosoythoth 95x13/15c, guns 209x166/16c, bones 210x166/16c, asteroids 30x25/15c, turrets 209x166/16c, gosoythoth_f0 11x9/11c

#### unfake-lib

| kind | n | fail | size exact % | size ±1 % | median scale_err | mean acc % | mean acc_tol % | mean dE | fringe % | mean ms |
|---|---|---|---|---|---|---|---|---|---|---|
| **overall** | 69 | 0 | 25 | 41 | 0.028 | 44.6 | 64.6 | 0.086 | 9.8 | 67 |
| nearest-int | 20 | 0 | 80 | 80 | 0.000 | 78.8 | 80.1 | 0.049 | 0.2 | 31 |
| nearest-frac | 9 | 0 | 0 | 0 | 0.200 | 34.5 | 35.0 | 0.160 | 0.3 | 15 |
| smooth-resample | 14 | 0 | 0 | 0 | 0.090 | 42.4 | 49.4 | 0.120 | 31.6 | 59 |
| jpeg | 10 | 0 | 10 | 60 | 0.000 | 17.6 | 74.6 | 0.092 | 9.5 | 85 |
| blur | 6 | 0 | 0 | 67 | 0.000 | 60.0 | 71.3 | 0.045 | 4.6 | 55 |
| ai-sim | 10 | 0 | 0 | 20 | 0.014 | 6.2 | 67.6 | 0.059 | 10.1 | 186 |
| phase (tag) | 9 | 0 | 67 | 67 | 0.000 | 71.0 | 72.5 | 0.053 | 9.7 | 26 |

ai-real (no truth): horror_monster 84x85/38c, gosoythoth 95x13/53c, guns 209x166/36c, bones 210x166/50c, asteroids 30x25/31c, turrets 209x166/35c, gosoythoth_f0 11x9/27c

### Failures and why (nothing is hidden: failed cases stay in the denominators)

- **perfectPixel: 15/76 cases return `None`** (no PNG written). All 15 are nearest-int (8) or nearest-frac (7). `pp_log.txt` shows the same pattern every time: "FFT-based grid estimation failed" or "Inconsistent grid size detected (FFT-based)", then "Gradient-based grid estimation failed", then "Failed to estimate grid size".
  - Scale below the default `min_size=4` px accounts for 11 of the 15: sumo x2, kpp_chars x3, ninja x2, tiny_dungeon x3, rpg_sheet x3_crop1, kpp_chars x2.5, sprite_boy x3.3, rogue_chars x2.5, tiny_dungeon x3.3, old_hero x2.5, rpg x3.3.
  - The other failures are at scales of 4 or more: rogue_chars x5, sumo x4_crop1, samurai x6_crop3 and sumo x4.7. The FFT finds inconsistent x/y periods and the gradient fallback finds no peaks.
  - When perfectPixel does detect the grid on clean nearest input, it is exact: 10 perfect cases, dE 0.
  - It never quantises colours, which is why jpeg and ai-sim cases have colour ratios of 75× and 234× and a high fringe %.
- **snapper**: no hard failures, but it over-segments. On nearest-int it hits 0% exact size, and its median estimated scale is 39% off, so outputs come out about 1.3 to 2× the true 1x size (for example sumo x2 gives 139x76 instead of 96x48). It is only good when cells are large (cave47 x7 and x5 give acc 1.0 at ±1 size) or when the input is ai-sim (80% within ±1 size).
  - A cross-check against the live spritefusion.com page (`_snapweb/verify_site.py`) was attempted again. The worker hook captured no result in headless mode, so **byte-identity with the site is unverified**. The WASM binary and call arguments are the site's own.
- **unfake (all variants)**: no failures.
  - It only knows integer scales. nearest-frac has a median scale_err of 0.20 and 0% of outputs have the right size.
  - On ai-sim, exact acc is 0% with 20% ±1 sizes.
  - The default edge detector sometimes locks onto a multiple of the true scale: sumo x2 is detected as 12 (output 16x7), kpp_tiles x4 as 8, ninja x2 as 4.
  - The `auto` detector (unfake-auto) fixes those three cases, which is why its nearest-int size is 85% instead of 80%. But on the phase-cropped cases it drops from 67% to 44% exact size.
  - On ai-real it returns 209x166 for the three 630x500 Rocks7 previews, which means it detected scale 3. Snapper and perfectPixel both estimate about 6 on the same images.
- **All tools**: 0% exact size on nearest-frac and on smooth-resample (apart from snapper's single 7%). No tool reaches 20% mean exact acc on jpeg or ai-sim. That is where the headroom is.

## 4. Job D: edit-task comparison

Legend:
- **Y**: supported natively. **~**: partial or needs a workaround. **-**: not supported.
- **EXEC**: executed and measured in this run. **DOCS**: taken from the tool's documented UI or public docs. **UI-probe**: the control was seen in the live web app's DOM or tooltips but the task was not run. **?**: not verified.
- Step counts are approximate GUI actions for a user who already has the file open.

Truth for T9/T10 is `pixel/oga-sumo-hulk/sumoHulk_spriteSheet.png` (96x144, 9 colours). Inputs are `sumoHulk_spriteSheet_x4.png` (384x576) and `pixel/derived/sumoHulk_x3.78_bilinear.png` (363x544). Exact-pixel % comes from `jobd/compare.py`, using the best shift in ±2 with transparent == transparent.

| task | Aseprite 1.3.18 (CLI, `-b --script`) | Pixelorama v1.2.3 web | Piskel (piskelapp.com) | Lospec Pixel Editor (web) |
|---|---|---|---|---|
| T1 pixel-perfect freehand | Y, DOCS: Pencil "Pixel-perfect" toggle, 1 click | Y, DOCS: Pencil "Pixel Perfect" option | -, DOCS/UI-probe: pen size 1 to 4 only, no pixel-perfect mode | ?, not verified |
| T2 bucket contiguous / global / tolerance | Y, DOCS: Contiguous toggle + Tolerance 0 to 255, 2 to 3 clicks | Y, DOCS: fill "similar area" / "similar colours" + similarity % | ~, UI-probe: Bucket (contiguous) and "Paint all pixels of same color" (global, Shift = all frames); **no tolerance** | ~, UI-probe: fill tool only, contiguous, no tolerance or global option seen |
| T3 symmetry X / Y / both / custom axis | Y, DOCS: horizontal, vertical, both; axis draggable | Y, DOCS: horizontal/vertical mirroring with movable guides | ~, UI-probe: Vertical Mirror pen (V); Ctrl = horizontal axis, Shift = both; **axis fixed at centre** | -, no symmetry in the tool list |
| T4 shading ink along a ramp | Y, DOCS: Pencil ink = Shading over the selected palette ramp | Y, DOCS: Shading tool (simple / hue-shift / colour-replace modes) | ~, UI-probe: Lighten/Darken tool (U), not ramp-based | - |
| T5 → indexed PICO-8, no dither | ~ **EXEC**: Load Palette + Color Mode > Indexed (dithering none), about 4 steps. **With defaults only 23.0% of opaque pixels get their nearest PICO-8 colour.** Index 0 (#000000) becomes the transparent mask, so none of the 1708 black pixels stay black. With fitCriteria=rgb: 70.3%. With fit=rgb plus a 17th transparent palette entry as the mask: **100%** (`aseprite/T5_fixmask_rgb.png`). No alpha lost | ?, DOCS: Palettize effect (not verified) | -, no indexed mode | -, no colour-mode conversion |
| T6 hue-shifted ramp generation | ~, DOCS: Palette > Gradient between 2 colours (RGB/HSV); hue shift has to be set manually or via extensions. Not executed | ?, not verified | - | - |
| T7 palette-swap variants across all frames | Y **EXEC**: sheet imported as 54 frames. Team colour #84d652 recoloured in 36 non-empty frames (2662/2662 px, all other px unchanged) for red, blue and green, plus undo between variants. Indexed route: **1 palette-entry edit recolours all frames** (verified 2662/2662) | ?, not verified | Y, UI-probe: "Paint all pixels of same color" + Shift = all frames, 1 click per colour per variant | ~: no frames; palette edit, not verified |
| T8 1-px outline + drop shadow | Outline Y **EXEC**: Canvas +1 px, then Edit > FX > Outline. Produces 1846 px, which equals the expected 4-connected outline exactly, with originals unchanged. Drop shadow ~ **EXEC**: no command in 1.3.18, so the manual route was used (duplicate layer, fill silhouette, offset 1,1, move below, flatten; +705 px). About 6 steps | Y, DOCS: Effects > Outline and Effects > Drop Shadow | - | - |
| T9 4× nearest → 1× | Y **EXEC**: Sprite Size 25%, nearest. Output 96x144, **100.0% exact** (9 colours), 98 ms CLI. About 3 steps | ~, attempted: the app boots headless but the picked file never reached the app (see below). DOCS: Image > Scale Image with nearest | Y, UI-probe: Import > "Resize to 96x144", "Smooth resize" off. **Import did not complete headless** (wizard stuck on step 1, sprite stayed 32x32). Not measured | Y **EXEC**: Open, Edit > Scale sprite 25% (nearest default), Export. 96x144, **100.0% exact**. About 6 steps |
| T10 3.78× bilinear → 1× | ~ **EXEC**: there is no grid detection, so the user must know the true size is 96x144. With the true size typed in: nearest **81.5%** (opaque-only 59.2%, 554 colours vs 9), bilinear 78.4%, rotsprite 81.1%. Nearest + palette-from-sprite (10 colours) + indexed gives 56.1% and is worse. **A user who guesses 25% gets 91x136 and 54.4%** | ~, DOCS: Scale Image; needs the true size | ~, UI-probe: Import with resize to a typed size; not measured | ~ **EXEC**: Scale sprite with width typed 96 (height 143.87 rounded to 144), nearest. **80.1%** (opaque-only 58.3%, 578 colours) |
| T11 .aseprite, 2 layers, one blend mode, indexed | Y **EXEC**: saved, then reopened with colorMode INDEXED, 16-entry palette, layer 2 "shade-multiply" blend MULTIPLY opacity 160 | -: saves .pxo (not verified whether it imports .aseprite) | -: .piskel / PNG / GIF only | -: .lpe / PNG |
| T12 onion skin + playback | Y, DOCS: F3 onion skin, Enter to play | Y, DOCS: onion skinning + playback controls (visible in screenshot) | Y, UI-probe: "Toggle onion skin (alt+O)" + preview FPS slider | -: no animation frames |
| T13 Lospec palette search by name | -, DOCS: no built-in search (load a downloaded .gpl/.hex) | ?, not verified | - | ~, UI-probe: only a fixed preset list of 11 (Endesga 32, Resurrect 64, AAP-64, Zughy 32, Journey, Vinik24, Sweetie 16, Lospec500, C64, PICO-8, GBC). Search exists on lospec.com, not in the editor |
| T14 palette import/export .gpl / .pal / .hex / Adobe .ase | ~ **EXEC**: .gpl, .pal, .hex, .act, .col and .png each save and reload with the first 16 entries identical. **A real Adobe Swatch Exchange (ASEF) file fails** ("Error reading header": .ase is Aseprite's own sprite extension) | ?, not verified | ?, not verified (palette import exists in the UI) | ~ **EXEC** (import only): Load palette accepts .gpl/.hex/png/gif; pico-8.gpl loaded (16 colours **appended** to the image's colours, not replacing them). Export not verified |

**Pixelorama (time-boxed, about 10 of the 15 minutes used)**:
- The Godot web build (Pixelorama v1.2.3-stable, Godot 4.7.2) **does boot headless** in Chromium with SwiftShader (`jobd/probe_pixelorama.json`, `shots/pixelorama_p1.png`). With locale en-US the glyphs render; the first probe without it showed tofu.
- File > Open does fire a browser file chooser, and Playwright set the file. The image never arrived in the project: the canvas stayed at a blank 64x64 (`jobd/log_pixelorama_run2.txt`, `shots/pixelorama_p4.png`, `shots/pixelorama_p5.png`).
- So no Pixelorama task was executed. Its column is DOCS/? only.

**Piskel**: a second, dedicated attempt (`jobd/piskel_t9t10.py`, ad hosts blocked) also got stuck on step 1 of the import wizard, and the page logged a "Failed to fetch" error. The blank 32x32 exports from that attempt were deleted and are not reported.

Artefacts: `aseprite/` (all Aseprite outputs + `results.json` + `verify.json` + `T5_variants.json`), `jobd/dl_lospec/T9_*.png`, `jobd/dl_lospec/T10_*.png`, `shots/`.

## 5. Scoring a new tool (e.g. Nerulio)

Write `<out-dir>/<case-id>.png`, one 1x PNG per case in `DATA/cases.json`. Optionally add `<case-id>.json` with `{"detected_scale": s | [sx, sy], "time_ms": t, "error": null}`. Then run:

```
cd scratchpad/p2/competitors
python score.py nerulio <out-dir>            # writes scores/nerulio.json, prints the per-case and summary tables
python agg_tables.py nerulio snapper perfectpixel unfake unfake-auto unfake-lib   # markdown tables as above
```

A missing PNG counts as a failed case. For T9/T10-style checks: `python jobd/compare.py <out.png> <truth.png>`.
