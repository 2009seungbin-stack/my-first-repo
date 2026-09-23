# P5 UI & fonts workspace — handoff (2026-09-24)

This work is moving to a new session. This file tells the next session what exists, what is half
done, and what to do next, in priority order.

* **Branch** `nerulio/studio-ui`, pushed to origin. Base: `origin/main` @ 4c03bb0 (origin/main was
  merged again later; it was already up to date). The head commit is the one that adds this file;
  the commit before it is `8e31e2f`.
* **Worktree** `C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55`
* **Port** 4521: `PORT=4521 node tools/serve.mjs`, then open
  `http://127.0.0.1:4521/en/game/studio/?ws=ui`. Use `&uimode=font|states|atlas|nine` to open a mode.
* **Helper reports** from the stopped sub-agents (read these next):
  `docs/handoff-ui-engines.md` (engine verification) and `docs/handoff-ui-h2h.md` (competitors).
* **Scratch** (not in git): `C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad\p5\studio-ui\`.
  It holds screenshots (`shots/`), competitor outputs (`h2h/`), engine runs (`engines/`) and msdf
  work (`msdf/`). The small, important scripts and data are copied into `tools/ui-dev/`.

## Scope (from the P5 brief)

The UI workspace in `/game/studio/` has four areas:

1. **9-slice suite.** Draggable, pixel-snapped guides. Suggested borders from repeat detection.
   Content padding kept separate from the stretch borders. Per-state borders. Stretch, tile or
   tile-fit per axis. Bad-patch checks. Previews at many sizes and DPI scales. Exports:
   * Godot StyleBoxTexture / NinePatchRect
   * Unity sprite borders
   * Android `.9.png`
   * CSS `border-image`
   * JSON
2. **UI states and atlas.** Button states (normal, hover, pressed, disabled, focus), generated or
   made from separate art. A UI atlas built from a sheet.
3. **Fonts.**
   * Sources: bitmap from a glyph grid (measured widths, kerning editor) or TTF/OTF/WOFF (our own
     parser).
   * Atlas types: bitmap, SDF, PSDF, MSDF, MTSDF. Multi-page for CJK.
   * A charset built from localisation files, with a missing-glyph report.
   * A shader text preview.
   * Exports: BMFont (text, XML, binary), Godot FontFile, Unity TMP, Phaser/Pixi, msdf-atlas-gen JSON.
4. **Common requirements.**
   * Undo, autosave and `.nerulio` round trip. Strings in ko, en and ja. Usable at 390 px.
   * Real assets, and verification in the real engines.
   * Head-to-heads against Snowb, Hiero, BMFont, msdf-atlas-gen and draw9patch-style tools.

## DONE (committed, tested)

| Area | Files | Tests |
|---|---|---|
| Attached non-image files (fonts, translation files) in projects: `settings.files`, autosave, `.nerulio` `files/<sha>`. A font-only project counts as content | `src/studio/core/{project,images,nerulio-file,autosave}.js`, `src/studio/app.js` (small edits) | `tests/studio-ui-core.test.mjs` |
| `ctx.removePanel(id)` for workspaces that swap panels per mode | `src/studio/app.js` | used by the UI workspace |
| 9-slice engine: borders, padding, per-axis stretch/tile/tile-fit, tile anchors (start/end/centre), DPI scale incl. fractional, suggestion from identical or periodic lines with per-axis confidence, validation (gradient, cut corner, tile seam, padding, empty), reference renderer, `.9.png` write and read | `src/game/ui/nine-patch.js` | `tests/studio-ui-nine.test.mjs`: Kenney CC0 buttons match the corpus truth insets |
| How each engine draws a 9-slice (modes and tile anchor per engine). **The anchors are placeholders until the engine findings are applied** | `src/game/ui/engines.js` | `tests/studio-ui.test.mjs` |
| Charset from localisation files: .po/.pot, CSV/TSV (incl. Unity `Name(xx)` headers), JSON, .strings (UTF-16), .resx, XLIFF, Android, .properties, Godot .tres (4.0 and 4.7 formats), Unity StringTable .asset. Also placeholder/markup stripping, frequency order, KS X 1001 / JIS presets and a missing-glyph report | `src/game/ui/charset.js` | `tests/studio-ui-charset.test.mjs`: 15 real MIT/Apache fixtures; the local-only ground truth equals independent Python counts (Mindustry 3496 strings / 854 characters, SuperTux 1310/615, Pixelorama 608/444) |
| OpenType parser: sfnt, TTC, WOFF1, cmap, glyf, CFF1 incl. CID, fvar/avar/gvar/HVAR, GPOS/kern kerning incl. variable deltas | `src/game/ui/font/opentype.js`, `otf-*.js` | `tests/studio-ui-font.test.mjs`: bit-exact against fontTools on Galmuri11, Noto Sans JP (default and wght 700) and Noto Sans KR OTF (local); CC0 fixtures in CI |
| Raster, SDF, PSDF, MSDF, MTSDF: a line-by-line port of msdfgen 1.13 (edge-priority error correction, overlapping-contour combiner, scanline sign fix) and an exact nonzero coverage raster | `src/game/ui/font/{shape,raster,msdf,msdf-geometry}.js` | `tests/studio-ui-msdf.test.mjs`: equal to the msdfgen 1.13 binary within float32 on 18 CC0 shapes; local Noto kanji to 4.8e-7 px |
| Font model and writers/readers: BMFont text, XML and binary v3 (+ the msdf-bmfont `distanceField` record), msdf-atlas-gen JSON, `layoutText` | `src/game/ui/font/formats.js` | `tests/studio-ui-formats.test.mjs` (Cozette round trip local) |
| Font builder: glyph render with pixel-grid-aligned boxes, frequency-ordered multi-page packing (single page through `src/game/pack/layout.js`), page composition, kerning, pixel-grid detection (Kenney Pixel 16, Galmuri11 12 — both equal the corpus truth), grid fonts from sheets, kerning suggestions from glyph shapes | `src/game/ui/font/build.js` | `tests/studio-ui.test.mjs`, `tests/studio-ui-formats.test.mjs` |
| Export bundles: UI kit (generic JSON, Godot `.tres` + Theme, Unity importer, Android `.9.png`, CSS, Phaser/Pixi atlas with `scale9Borders`) and font (BMFont ×3, msdf JSON, Godot, Unity TMP, Phaser, Pixi, charset.txt, missing-glyphs.txt) | `src/game/ui/export/{bundles,helpers,helper-sources}.js`, `tools/ui-helpers-embed.mjs` | `tests/studio-ui.test.mjs` (bundles re-opened independently; embedded helpers equal the verifier files) |
| UI workspace, 4 modes. Registered in `src/studio/main.js`; the "coming" P5 entry was removed | `src/studio/workspaces/ui/*` (`index.js`, `nine.js`, `states.js`, `atlas.js`, `font.js`, `kit-export.js`, `text-preview.js`, `state.js`, `strings.js`, `ui.css`, `ui-worker.js`, `glyph-worker.js`) | strings parity and key coverage in `tests/studio-ui.test.mjs`; smoke scripts in `tools/ui-dev/` |

`npm test`: 1772 tests, 1771 pass, 0 fail, 1 skipped (at `8e31e2f`). The seven `tests/studio-ui*.test.mjs`
files with the corpus hidden (`NERULIO_CORPUS='C:\nope'`): 73 pass, 5 skipped (the corpus-only checks).

What was seen working in Chromium (screenshots in scratch `shots/`):
* **9-slice:** import, suggestion + Apply, hatched stretch bands, guides, previews.
* **States:** the "buttonLong_blue + _pressed" button suggestion from file names, the state sheet on the canvas, the live button.
* **Atlas:** Kenney `uipack_rpg_sheet.png` + XML give 87 named elements.
* **Font:** Kenney Future + ko.po build a 95-glyph atlas and report 105 missing Hangul; the bitmap text preview works.

## IN PROGRESS / BROKEN

1. **Galmuri11 (5 MB) in the browser.** `tools/ui-dev/smoke3.py` timed out waiting for the first
   font result, on the `/ko/` route. In Node the same pipeline works: parse 4 ms, pixel grid 12 px
   (high), mono render 28 glyphs in 7 ms, MSDF 28 glyphs in 126 ms. Not yet debugged. Suspects:
   * `fontInfo` → `f.codepoints()` over 20k code points
   * the worker glyph pool (`ui-worker.js` `poolRender`, nested module workers)
   * `attachFile` of a 5 MB blob
   * a thrown error swallowed before `renderStatus`

   First step: run smoke3 with the console printed and look for `[data-font="error"]`.
2. **Engine verification (sub-agent, stopped mid-way).**
   * `tools/engine-verify/ui/` holds:
     * `verify_ui.py` + `ui_common.py` + `make_ui_bundle.py` (9-slice)
     * `unity_ui.py`, `web_ui.py`, `web/ui_harness.html`
     * `godot/ui_probe.gd`, `godot/font_probe.gd`
     * `verify_font.py`, `font_formats.py`, `make_font_refs.py`, `outline_ref.py`
   * Helpers: `helpers/nerulio_ui_import.gd`, `helpers/NerulioUIImporter.cs`, `helpers/nerulio_font_import.gd`.
   * **`NerulioTMPFontImporter.cs` does not exist yet**, so the Unity TMP export ships an empty importer.
   * Its findings (exact tile anchors per engine, TMP availability, whether Godot reads the BMFont
     `distanceField` record) are in `docs/handoff-ui-engines.md` if it managed to write it.
   * `VERIFY` in `src/game/ui/export/helpers.js` is still "unverified" everywhere, and
     `src/game/ui/engines.js` anchors are guesses (Unity `anchorV:'end'`, CSS `center`) until those
     findings are applied.
3. **Head-to-head (sub-agent, stopped; its report is `docs/handoff-ui-h2h.md`).**
   * Data: `tools/ui-dev/h2h/summary.json` plus the run scripts.
   * msdf-atlas-gen on Galmuri11 with the Mindustry ko charset (822 glyphs):
     * 972×972 page, 90.5 % efficiency, 1.44 s
     * ×4 wrong pixels 0.138 %, ×8 0.229 % (`tools/font-quality.py`)
   * The font-quality tool's negative controls fail as they should: blur 0.7 → 0.70 %/2.35 %; blur+shift → 51 %.
   * BMFont 1.14b: multi-page works and kerning is written. With default smoothing a pixel font gets grey fringes.
   * msdf-atlas-gen: writes 0 kerning pairs; no multi-page (all Hangul makes one 3468² page).
   * Hiero batch mode saves only 97 of 822 glyphs.
   * Snowb: a single page only; the Noto Sans KR MSDF comes out inside-out (83 % wrong pixels).
   * `tools/ninepatch-check.py` agrees with Android aapt2 on 4 real + 9 synthetic files.
   * Not done: the web 9-patch tools (ToolPkg, 9patch.vercel.app).
   * Details and exact remaining steps: `docs/handoff-ui-h2h.md`.
4. `importFnt` (open an existing `.fnt`) is not implemented. The font mode throws a clear
   "not supported yet" error, and `.fnt` is not claimed on drop.

## NEXT STEPS (priority order)

1. **Fix the Galmuri11 browser build** (item 1 above). Then run the real Korean pipeline:
   * Galmuri11 + `…\_adhoc\nerulio-studio-ui\l10n\mindustry\bundle_ko.properties` (854 characters) in mono 12 px and MSDF 32 px (`tools/ui-dev/smoke3.py`).
   * Time the MSDF build (2000 glyphs ≈ 9 ms/glyph single-threaded; the pool uses up to 6 workers).
2. **Finish engine verification and apply it.**
   * Godot 4.7.2:
     * render our `.fnt` (bitmap, multi-page Hangul) with the `glyph_shapes` checks of the existing harness;
     * run the MSDF path through `nerulio_font_import.gd`;
     * load `.tres` StyleBoxTexture + Theme and compare against `renderPlan`.
   * Phaser 3/4: XML BMFont + NineSlice. Pixi 8: `.fnt` with `distanceField` + NineSliceSprite. CSS border-image in Chromium.
   * Unity 6: sprite borders; TMP if it is available offline, otherwise mark it UNVERIFIED.
   * Then set `VERIFY` and the `ENGINES` anchors from the measurements, and keep the export badges honest.
   * The "build a Korean game UI font from a real ko localisation file and render it in Godot + Phaser" requirement is still open.
3. **Head-to-head table.** Run our MSDF export of the same Galmuri/ko charset through
   `tools/font-quality.py` and compare with msdf-atlas-gen: quality, atlas efficiency, steps. Add
   Snowb, BMFont and Hiero where they ran, and the web 9-patch tools compared on the Kenney button.
4. **`tests/studio-ui-browser.py` (not written yet)** and add it to the suite list in
   `tools/regression.py`. Cover:
   * 9-slice: import + suggestion not applied until clicked; guide drag + one undo step; Esc cancels; arrow nudge; gradient issue; previews; `.9.png` import/export; kit export ZIP opened by `tools/ninepatch-check.py`.
   * States: suggestion, live button.
   * Atlas: 87 elements from the XML.
   * Font: pixel grid → mono; ko.po missing glyphs; MSDF build; font ZIP parsed back.
   * Project: `.nerulio` round trip with a font; autosave recovery.
   * UI: ko/ja; 390×844 without horizontal scroll. Screenshots to scratch `p5/studio-ui/`.

   Run it with and without the corpus, then `python tools/regression.py` and `python tests/service-browser.py`.
5. **`docs/STUDIO-UI.md`**: user docs, engine semantics, the verification table, head-to-head, and
   what is unverified. Then update `docs/STUDIO.md` (the `ctx.removePanel` API, attached files) and
   `docs/DEPENDENCIES.md` (no new dependency: the parser and MSDF are ours; msdfgen is only a test
   reference, MIT).
6. **Private-use characters.** Mindustry's ko file uses 39 private-use code points for its icon
   font. The charset includes them today, and the missing-glyph report then lists them against any
   text font. Flag PUA code points separately (default: excluded, with a count) in `buildCharset` /
   `missingGlyphs`.
7. **Polish:**
   * `.fnt` import
   * a glyph table view
   * hand kerning for outline fonts in the canvas
   * 390 px screenshots and fixes
   * the ko/ja visual check
   * light theme

## How to build / run / test

```
cd C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55
npm test                                             # all unit tests (node --test tests/*.test.mjs)
node --test tests/studio-ui.test.mjs tests/studio-ui-core.test.mjs tests/studio-ui-nine.test.mjs tests/studio-ui-charset.test.mjs tests/studio-ui-formats.test.mjs tests/studio-ui-font.test.mjs tests/studio-ui-msdf.test.mjs
NERULIO_CORPUS='C:\nope' node --test <same files>    # CI-like; corpus-only checks skip (they also test existsSync on corpus paths)
node tools/ui-helpers-embed.mjs                      # after editing tools/engine-verify/ui/helpers/*
python tools/ui-font-fixtures.py                     # regenerate font fixtures + fontTools references (reproducible)
python tools/ui-msdf-reference.py                    # regenerate msdfgen references (needs %LOCALAPPDATA%\nerulio-engine-verify\msdfgen)
PORT=4521 node tools/serve.mjs                       # dev server; stop it afterwards
python tools/ui-dev/smoke.py 1440 900 tag            # 9-slice smoke (TEST_URL defaults to :4521)
python tools/ui-dev/smoke2.py 1440 900 tag           # states + atlas + font smoke
python tools/ui-dev/smoke3.py [font.ttf] mono,msdf   # Korean pipeline (local corpus)
python tools/font-quality.py --font F --atlas atlas.json|font.fnt [--charset chars.txt] [--json out.json]
python tools/ninepatch-check.py file.9.png           # independent .9.png validator
```

Tools and data outside the repo:
* **msdfgen / msdf-atlas-gen:** `%LOCALAPPDATA%\nerulio-engine-verify\msdfgen\` (1.13 / 1.4, win64).
* **Corpus additions** in `C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\`, each with its `SOURCES.md`:
  * `fonts/NotoSansKR-Regular.otf` (OFL)
  * `l10n/*`: game translation files — Mindustry, Shattered PD, SuperTux, Luanti, OpenTTD, osu! (GPL etc., local only); Pixelorama and others (MIT).
* **Ground truth:** `tools/ui-dev/ko_groundtruth.{py,json}`.

## UNVERIFIED (nothing below has been run in its engine yet)

* **Godot:** `.tres` StyleBoxTexture / Theme, the `.fnt` import of our fonts (bitmap and multi-page), and MSDF through `nerulio_font_import.gd`.
* **Unity:** sprite borders through `NerulioUIImporter.cs`; the TMP importer does not exist yet.
* **Phaser / Pixi:** XML BMFont, NineSlice / NineSliceSprite, and the `scale9Borders` field.
* **CSS:** `border-image` output in Chromium, including the tile anchor.
* **Android:** `.9.png` (aapt2 cross-check script `tools/ui-dev/h2h/aapt2_crosscheck.py` exists; its result is unknown).
* **Browsers:** Firefox and WebKit were not run.

## Known issues

* The Galmuri11 browser timeout (above).
* A mode's panels are rebuilt on every mode switch, so a scroll position in a panel is lost.
* Grid-font pages are the keyed sheet as drawn. Unused sheet areas stay in the texture; there is no repacking yet.
* `fntBinary` requires page file names of equal length; ours are.
* Unity CSV literal `\n` sequences are counted as a backslash and an "n". This is ambiguous in the source data.

## Conflict hotspots when merging

* **`src/studio/main.js`, `src/studio/workspaces/coming.js`:** the P2/P4 agents edit these too (registration lines).
* **`src/studio/app.js`:**
  * `P.hasContent` replaces `doc().assets.length` checks;
  * `ctx.removePanel`;
  * the import `accept` list.
* **`src/studio/core/{project,images,nerulio-file,autosave}.js`:** attached files.
* **`src/studio/strings.js`:** only the three `uiSummary` strings.
* **`.gitattributes`:** `tests/fixtures/ui/** -text`.
