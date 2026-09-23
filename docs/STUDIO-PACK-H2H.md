# Studio packer vs. free web packers (head-to-head, 2026-09-23)

## How it was measured

**Frame sets.** Five real CC0 frame sets from the corpus (`C:\Users\2009s\nerulio-asset-corpus`):

| set | frames | frame size | source |
|---|---|---|---|
| ninja | 6 | 40×29 | OGA, carries gAMA/cHRM |
| archer | 10 | 381×554 | OGA |
| samurai | 60 | 48 px cells | OGA |
| toon | 45 | 96×128 cells | Kenney |
| spaceshooter | 294 | 96 distinct sizes | Kenney |

**The packers**, each run on the same files:

| packer | how it was run |
|---|---|
| CodeAndWeb free web packer | live site, Playwright |
| GAPTools texture packer | live site, Playwright |
| free-tex-packer | npm core 0.3.9; the web app's domain is parked |
| the Studio packer | the same modules the Studio runs |

**Settings.** Trim on, padding 2, max 4096 wherever the tool offers them.

**Efficiency** = the sum of the frames' opaque bounding boxes ÷ the total sheet area.

**Exact** means each frame, restored from the atlas with TexturePacker JSON semantics (trim offsets,
rotation), equals the source file pixel for pixel, ignoring RGB under alpha 0.

Scripts and raw data are in the session scratchpad (`p1/studio-pack/h2h/`): `RESULTS.md` and
`results.json` for the competitors; `nerulio/pack.mjs`, `nerulio/judge.py` and `nerulio/judged.json`
for the Studio.

## Smallest single sheet per set

| set | opaque area | CodeAndWeb free (no trim) | GAPTools | free-tex-packer-core | **Studio** (rotation off) | **Studio** (rotation on) |
|---|---|---|---|---|---|---|
| ninja | 1,591 | 126×62 = 7,812 (0.20) | 64×36 = 2,304 (0.69) | 129×20 = 2,580 (0.62) | **38×50 = 1,900 (0.84)** | 33×57 = 1,881 (0.85) |
| archer | 1,566,860 | 1532×1668 (0.61) | 1936×872 = 1,688,192 (0.93) | 3037×540 = 1,639,980 (0.96, a strip) | 1543×1066 = 1,644,838 (0.95) | **1071×1526 = 1,634,346 (0.96)** |
| samurai | 55,441 | 400×400 (0.35) | 292×256 = 74,752 (0.74) | 276×300 = 82,800 (0.67) | 275×248 = 68,200 (0.81) | **313×216 = 67,608 (0.82)** |
| toon | 317,900 | 784×780 (0.52) | 760×496 = 376,960 (0.84) | 3560×105 = 373,800 (0.85, a strip) | 631×591 = 372,921 (0.85) | **587×592 = 347,504 (0.91)** |
| spaceshooter | 850,225 | 1158×1051 (0.70) | 1024×1024 = 1,048,576 (0.81) | 1003×1003 = 1,006,009 (0.85) | 966×977 = 943,782 (0.90) | 944×996 = 940,224 (0.90) |

- **effort: best**: spaceshooter 951×982 = 933,882 (0.91); the other sets are unchanged.
- **Power of two**: samurai 256×512, toon 512×1024, spaceshooter 1024×1024.
- **Pack time** (Node, per config): 2–60 ms; spaceshooter 0.42 s (normal), 0.9–1.0 s (best).

## Correctness: frames restored exactly

| set | CodeAndWeb | GAPTools | free-tex-packer-core | **Studio** |
|---|---|---|---|---|
| ninja (gAMA/cHRM) | 0 / 6 | 0 / 6 | 6 / 6 | **6 / 6** |
| archer | 0 / 10 | 0 / 10 | 10 / 10 | **10 / 10** |
| samurai | 60 / 60 | 60 / 60 | 60 / 60 | **60 / 60** |
| toon | 0 / 45 | 0 / 45 | 45 / 45 | **45 / 45** |
| spaceshooter | 0 / 294 | 0 / 294 | 294 / 294 | **294 / 294** |

The two browser tools decode through `<img>` and a 2D canvas, which breaks exactness in two ways:

- **Colour management.** The ninja gAMA/cHRM chunks turn grey (50,50,50) into (46,46,46).
- **Premultiplied alpha.** Semi-transparent pixels drift by up to 10 levels on spaceshooter.

The Studio decodes PNGs in JS and never touches a canvas. Its rotated frames follow the TexturePacker
convention, which the restoration confirmed on every rotated frame. No tool produced overlaps.

## Duplicates and multipack

| test | CodeAndWeb | GAPTools | free-tex-packer-core | **Studio** |
|---|---|---|---|---|
| ninja ×3 (18 frames, 6 distinct) | 18 stored, 168×155 | 18 stored, 120×52 | 6 stored | **6 stored, 38×50** |
| archer ×8 (80 frames) at max 2048, dedupe off | one 4213×4448 sheet (ignores limits) | 5 sheets, 13,253,792 px² | — | 5 pages, **12,841,021 px²** |
| same, dedupe on | — | — | — | **10 stored, one 1543×1066 page** |

## Features

| feature | CodeAndWeb free | GAPTools | free-tex-packer (dead web app) | **Studio** |
|---|---|---|---|---|
| MaxRects heuristics | compact only | "MaxRects" | BSSF / Smart / Optimal | **BSSF, BLSF, BAF, BL, CP + Skyline + Guillotine; best-of search** |
| trim modes | — (Pro) | trim | trim | **none / trim / crop-keep / crop + alpha threshold** |
| rotation | — (Pro) | yes | yes | **yes, per engine where the engine reads it** |
| alias / dedupe | — | — | yes | **yes (hash + byte check)** |
| multipack | — | yes | yes | **yes (up to 64 pages)** |
| extrude, border/shape padding | padding only | extrude + padding | padding, extrude | **all** |
| POT / square / fixed / multiple-of | — | POT, multiple-of | POT | **all** |
| scale variants (nearest) | — | — | scale | **@0.5x–@4x, exact nearest** |
| premultiplied alpha | — | — | — | **option** |
| pixel-exact output | no | no | yes | **yes (tested)** |
| preview | bilinear-blurred | pixelated | — | **integer zoom in the Studio canvas, page tabs, used %** |
| tags, durations and pivots reach the engine | — | — | — | **yes (15 targets, engine-verified)** |
| engine targets verified in the real engine | — | — | — | **Godot, Unity, Phaser 3/4, Pixi 8, Defold, LÖVE, Spine, Aseprite** |

**Summary**

- **Size, rotation allowed:** the Studio sheet is the smallest on all five sets.
- **Size, rotation off:** it is the smallest on four of five. On archer, free-tex-packer's
  OptimalPacker is 0.3 % smaller, but as a 3037×540 strip.
- **Exactness:** every frame is exact.
- **Engines:** it is the only one of these tools whose output was loaded by the engines themselves.
