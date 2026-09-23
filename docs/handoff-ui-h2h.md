# Handoff: P5 UI/fonts head-to-head (stopped 2026-09-24 on owner decision)

Scratch root (S): `C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad\p5\studio-ui\`
Corpus (C): `C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\`
No background runs are left open. Every number below comes from the files listed. None of them is an estimate.

## 1. Done

### Localisation corpus and fixtures
- Real ko files are in `C\l10n\` with pinned-commit URLs and licences in `C\l10n\_sources.json`. **`C\SOURCES.md` is NOT written yet** (see §3).
  - GPL/LGPL/NC, local only: Mindustry `bundle_ko.properties` (GPL-3.0), Shattered PD `*_ko.properties`, SuperTux `ko.po`, Luanti `luanti.po` + `.tr` + Android xml, OpenTTD `korean.txt`, and 25 osu! `*.ko.resx` (CC-BY-NC-4.0).
  - MIT/Apache: Pixelorama po, PokeClicker i18next JSON (a game), GravitaMaze Unity CSV + StringTable YAML (a game), uDesktopMascot CSV, zip-launcher Godot CSV + binary `.translation`, gohud CSV, Stats `.strings`, Humanizer v2.14.1 `.resx`, Thunderbird-Android `strings.xml`, Excalidraw JSON, Tomcat `.properties`, KeepingYouAwake XLIFF, dotnet/sign XLIFF.
- Committed fixtures are in `tests/fixtures/ui/l10n/`: 16 files plus `LICENSES.md`, all from MIT/Apache sources. Excerpts keep whole entries byte-exact. One `.tres` file is a Godot 4.7.2 serialization of real CSV strings; it is labelled "derived" because no ko text `.tres` exists in the wild. The scripts that made them are `S\l10n\make_fixtures.py`, `validate_fixtures.py` and `write_licenses.py`.
- Ground truth comes from `S\l10n\ko_groundtruth.py`, which uses only the stdlib, and is written to `ko_groundtruth.json`. Mindustry `bundle_ko.properties` gives:
  - 3,496 strings.
  - 857 unique characters (854 without whitespace/control; the three excluded are U+000A, U+0020 and U+200B).
  - 724 Hangul syllables.
  - 0 Han and 0 kana.
  - 88 printable ASCII characters.
  - **39 Private-Use icon code points** (U+E800…U+F8C4, Mindustry's icon font).
  - ² … ⚠.
  - 724 values are identical to the English source.
  - Top characters: space 11,650, e 1,925, t 1,841, a 1,642, `.` 1,614, n 1,269, 다 1,229 … (top 50 are in the JSON).
- The charsets used for every competitor are in `S\h2h\`:
  - `charset_ko_game.txt` has 822 characters: ASCII 0x20–0x7E, the 724 Hangul and ²…⚠. Private-use characters and U+200B are dropped.
  - Variants: `_bom.txt` (for BMFont) and `.msdf.txt` (msdf-atlas-gen syntax).
  - Also `charset_ascii.txt`.

### tools/font-quality.py (independent judge) — validated
- It uses fontTools outlines and exact nonzero coverage: analytic spans in x, 16 sub-scanlines per pixel.
- Reconstruction works like a shader: bilinear sample, then median(RGB) or one channel, then a 1-px smoothstep at S = 4/8 (S = 1 for bitmaps).
- It reads msdf-atlas-gen JSON and BMFont text/XML/JSON.
- BMFont em-size conventions are searched, followed by a global offset of ±1 px in 1/8 steps. A scale search is only done with `--register-scale`. `--em-px/--offset` override the search, and `--degrade` gives the negative control.
- Positive controls:
  - msdf-atlas-gen MSDF: Kenney Future mean |err| 0.0014, 0.000% wrong. Noto KR 0.0137, 0.023% wrong. Galmuri 0.0089, 0.14% wrong (x4).
  - BMFont `useSmoothing=0` Galmuri at 12 and 24 px gives **exactly 0.0000**. This shows the BMFont placement convention (em = |size|, baseline = base) is right.
- Negative controls, same atlases:
  - Blur 1 + shift 1 px: 39–54% wrong.
  - Blur 0.7 alone: Kenney 0.0071 vs 0.0014; Noto 0.041 vs 0.014; Galmuri 0.031 vs 0.009.
  - Galmuri BMFont: blur 0.7 gives 0.091, shift 1 gives 51% wrong.

### tools/ninepatch-check.py — validated against aapt2 37.0.0
- Android SDK build-tools are present, so `aapt2 compile` output was parsed from the npTc/npLb chunks (`S\h2h\aapt2_crosscheck.py`).
- The tool agreed with aapt2 on geometry, padding, layout bounds and accept/reject for 4 AOSP `.9.png` files (`C\ninepatch\aosp\`) and 9 synthetic edge cases (`S\h2h\ninepatch\synthetic\`: bad corner, grey tick, semi-transparent tick, red on top, split padding, two stretch regions, layout bounds, bad-patch gradient).
- An aapt2 rule was added: when the top-left corner is opaque white, white is the neutral frame colour.
- draw9patch was not found: Android Studio is installed, but draw9patch is not in the SDK tools.

### Competitors (all outputs are in `S\h2h\<tool>\`; the aggregate is **`S\h2h\summary.json`**)

| Tool / run | Steps | Time | Pages / size | Kerning written | Quality (mean / p95 / wrong%) | Notes |
|---|---|---|---|---|---|---|
| msdf-atlas-gen 1.4 msdf, Noto 822 glyphs | 1 CLI | 1.3 s | 1 × 912² | **0** | x4 0.0137 / 0.091 / 0.023 | mtsdf is the same. sdf/psdf: 0.025, about 0.9% wrong |
| msdf-atlas-gen msdf, Galmuri | 1 CLI | 1.4 s | 1 × 972² | 0 | x4 0.0089 / 0.061 / 0.14 | sdf 1.08% wrong |
| msdf-atlas-gen msdf, Kenney ASCII | 1 CLI | 0.1 s | 236² | 0 (font has none) | 0.0014 / 0.0025 / 0.000 | |
| msdf-atlas-gen, all 11,172 Hangul + ASCII (Noto) | 1 CLI | 44 s | one **3468² page, 11.5 MB PNG** | 0 | not judged | `-dimensions 2048 2048` fails ("could not fit 7416 of 11267"). It has **no multi-page**. It writes **no GPOS kerning**: 0 pairs although Noto has GPOS kern (10,972 fmt-1 pairs) and Galmuri has 8,252 |
| BMFont 1.14b CLI, Galmuri 12 px (smooth on, default) | config + 1 CLI | 1.1 s | 1 × 512² | 380 | 0.054 / 0.133 / 0 | ClearType-grey fringes (alpha 34/230) on a pixel font |
| BMFont, Galmuri 12/24 px, smooth=0 | same | 1.3 s | 1 / 2 × 512² | 380 | **0 / 0 / 0** | exact |
| BMFont, Noto 32 px | same | 2.2 s | **3 × 512²** multi-page | 491 | 0.164 / 0.570 / 7.8 | GDI hinting snaps stems (bolder than the outline) |
| BMFont, Kenney 32 px | same | 0.4 s | 512² (eff 0.13) | 0 | 0.030 / 0.133 / 0 | |
| Hiero (nightly 2026-09-09) `-i -o -b` | settings file + 1 CLI | 4–7 s | 1 × 512² | 366 / 491 | Java render: Galmuri 0 error; Noto 0.092 / 2.7% | **Batch mode truncates the charset to 97 glyphs** (it saves after the first frame; `loadGlyphs(64)`/frame), so 727 of 822 are missing. **FreeType render crashes in batch** (`Gdx.gl` is null). **Native render ignores `font2.file`** and uses a system fallback (29–38% wrong). Distance field: Kenney 0.0071 / 0.28%, Noto 11.3% wrong, Galmuri 8.1% wrong (range = 2·spread = 4) |
| Snowb (Playwright), DEFAULT | 12 UI steps | render ≈2 s. Export: Kenney 0.7 s, Galmuri 6 s, **Noto 46 s (UI frozen)** | always **1 page**: 388², 692², 837×834; auto-pack ignores the 512 max | 380 / 557 | Galmuri **0 error**; Kenney 0.005; Noto 0.125 / 1.2% (registered: em 31.9, dy −0.875; as placed 31% wrong) | Export types: BMFont TEXT/XML/BIN/C/JSON/MSDF-JSON. Screenshots are in each run folder |
| Snowb MSDF (15 steps) | | msdf render 0.5–9 s, export 6–36 s | 1 page | | Kenney 0.0016 / 0.000%; Galmuri 0.0168 / 1.0% | **Noto (CFF OTF) atlas is sign-inverted** (inside/outside swapped, visible in `snowb\notosanskr_32px_msdf\10_msdf.png`): 83% wrong. After an RGB inversion (`notosanskr_32px_msdf_inverted_check\`) it is still 23% wrong |

Scripts: `S\h2h\run_msdf.py`, `run_bmfont.py`, `run_hiero.py`, `snowb\run_snowb.py`, `judge.py` / `judge_msdf.py`, `debug_glyph.py` (side-by-side images `dbg_*.png`) and `make_summary.py`. The BMFont and Hiero binaries are in `C\tools\` (bmfont64 1.14b SHA-256 3ae24f8b…; runnable-hiero.jar 6e637b47…).

Caveat: Windows also has a system-installed "Noto Sans KR" VF. BMFont (GDI) and Hiero Native may have rendered that font instead of the OTF file. Galmuri's GDI face name is "Galmuri11 Regular"; with "Galmuri11", BMFont silently fell back to a font with no Hangul.

## 2. Not done
1. **Web 9-patch tools**: ToolPkg nine-patch, 9patch.vercel.app and others. Not started, so none of their outputs have been checked with `ninepatch-check.py`. The Kenney inputs are `C:\Users\2009s\nerulio-asset-corpus\ui\kenney-ui-pack\blue_button_rectangle_depth_flat.png` and `...\kenney-ui-pack-rpg-expansion\panel_beige.png`.
2. `C\SOURCES.md`: write it from `C\l10n\_sources.json`, `C\ninepatch\aosp\_sources.json` and the two tool downloads (BMFont: angelcode.com/products/bmfont/bmfont64_1.14b_beta.zip, zlib; Hiero: libgdx-nightlies…/runnable-hiero.jar, Apache-2.0).
3. Snowb: the MTSDF/SDF modes and the MSDF-JSON export were not run. The CJK charset in Snowb was pasted without problems (822 characters); no size limit was hit.
4. Hiero: a GUI-mode run (to get the full charset) was not attempted.
5. `summary.json` does not include the 9-slice section yet.

## 3. Exact next steps
- Playwright on toolpkg.com/nine-patch and 9patch.vercel.app, for each Kenney PNG: upload, set borders, record steps, content padding, bad-patch warnings, tile modes, preview sizes, and download `.9.png`/JSON into `S\h2h\ninepatch\<tool>\`. Then run `python tools/ninepatch-check.py <files> --json …` and `python S\h2h\aapt2_crosscheck.py <files>`.
- Rerun `S\h2h\make_summary.py`, then add a `ninepatch` key.
- Write `C\SOURCES.md`.
