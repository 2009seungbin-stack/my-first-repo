# Handoff: game-dev guides (/guides/)

- **Branch:** `nerulio/game-guides` (pushed; merged with origin/main at c4635a4 = PR #30 home + #31)
- **Head commit:** see `git log -1` (the commit that adds this file; previous: 79766ca)
- **Worktree:** `C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-aef499f5f486793c5`
- **Port used:** 4531 (dev server `PORT=4531 node tools/serve.mjs`; it may no longer be running)
- **Design doc:** `docs/GUIDES.md` (files, page anatomy, Markdown dialect, how to add a guide)

## 1. What exists

13 of 26 planned guides are complete in ko/en/ja, registered in `src/guides.js`, rendered and
linted (no renderer problems; 5 FAQ each; HowTo steps; 2–3 images each). Infrastructure is done:

| Piece | File |
|---|---|
| Registry + contract | `src/guides.js`: `GUIDES`, `GUIDE_ROUTES` (`guides`, `guides/<slug>`), `guideRoute`, `guideLastmod`, `GUIDE_SECTIONS`, `GUIDE_ENGINES` |
| Renderer (pure) | `tools/guides-build.mjs`: Markdown dialect → HTML, guide page, index, Article/BreadcrumbList/FAQPage/HowTo JSON-LD, canonical/hreflang, OG/Twitter; `guideEntry()` |
| Build hook (small, separate) | `tools/build.mjs`: import + `ALL_ROUTES.push(...GUIDE_ROUTES × locales)` + one `guideEntry` line in `entry()` |
| Look | `src/guides.css` (dark game-home palette, sticky TOC ≥1200 px), `src/guides-page.js` (language select, neutral-URL redirect for ko/ja browsers, copy buttons) |
| Footer link | `src/content.js` `footer()`: "Game dev guides" link first in the footer nav (home and every tool page) |
| Screenshots | `assets/guides/<name>-<ko|en|ja>.webp` (14 Nerulio UI shots × 3, `tools/guides-shots.py`), `assets/guides/engine-*.webp` (real engine renders), `assets/guides/CREDITS.txt` |
| Social cards | `tools/generate-guide-social.py` → `assets/social/<l>-guide-<slug>.png`, `<l>-guides.png` (separate script so `tools/generate-social.py` is untouched) |
| Tests | `tests/guides.test.mjs` (registry, bodies, images, cards, pages, index, dialect), `tests/guides-browser.py` (added to `tools/regression.py`) |
| Writer kit | `docs/guides-drafts/WRITER-SPEC.md` (rules + dialect for writers), `docs/guides-drafts/meta/*.json` (writer metadata), `docs/guides-drafts/sync_meta.mjs` (meta → `src/guides.js`; paths inside point at the old scratchpad, edit `M`), `docs/guides-drafts/lint.mjs`, `docs/guides-drafts/verify/<slug>/` (verification scripts of unfinished guides) |

### How the SEO branch consumes it

`origin/nerulio/game-seo-landings` has `tools/guides-registry.mjs`, which does
`await import('../src/guides.js')` (empty lists if the module is missing) and uses `GUIDES[].{slug,
tools, open, title, description, updated}`, `GUIDE_ROUTES`, `guideLastmod(route)` and
`guidePath(slug)` for `sitemap-guides.xml` and for links from game landings and the `/game/` hub to
guides about the same tool/workspace. Keep those names and fields stable. The guides branch does not
write any sitemap; until the SEO branch lands, guides are reachable by links (footer, index) only.

## 2. Guide status

"Tested" = the steps/snippets were run in that engine build (details in section 4). Screenshot
column: N = Nerulio UI shots used, E = real engine renders in `assets/guides/`.

| # | Slug | ko | en | ja | Meta/registry | Verified in | Screenshots |
|---|---|---|---|---|---|---|---|
| 1 | godot-4-sprite-sheet-animation | done | done | done | yes | Godot 4.7.2 (70/70 checks) | N + E `engine-godot-spritesheet-separation` |
| 2 | unity-6-slice-sprite-sheet-animation | done | done | done | yes | Unity 6000.5.3f1 batchmode | N |
| 3 | phaser-sprite-sheet-atlas-animation | done | done | done | yes | Phaser 3.90.0 + 4.2.1 (20/20) | N + E `engine-phaser-spritesheet` |
| 4 | pixijs-8-spritesheet-animation | done | done | done | yes | PixiJS 8.21.0 (18/18) | N + E `engine-pixi-spritesheet` |
| 5 | godot-4-pixel-art-blurry-jitter | done | done | done | yes | Godot 4.7.2 (38/38 + render runs) | N + E `engine-godot-pixel-*` |
| 6 | unity-pixel-art-blurry-pixel-perfect | done | done | done | yes | Unity 6000.5.3f1 + URP 17.5 | E `engine-unity-pixel-*` |
| 7 | palette-swap-sprites | done | done | done | yes | Godot 4.7.2, Unity 6000.5.3f1+URP, Phaser 3.90/4.2, Pixi 8.21 | N + E `engine-palette-*` |
| 8 | godot-4-terrain-autotile-47-blob | done | done | done | yes | Godot 4.7.2 | N + E `engine-godot-terrain-*` |
| 9 | dual-grid-autotile | done | done | done | yes | Godot 4.7.2 | E `engine-dual-grid`, `engine-godot-match-corners` |
| 10 | sprite-sheet-vs-texture-atlas | done | done | done | yes | Phaser 3.90/4.2, Pixi 8.21, Spine 4.2 canvas, Godot 4.7.2 | N + E `engine-atlas-rotation` |
| 11 | 2d-normal-maps-lighting-godot-unity | done | done | done | yes | Godot 4.7.2, Unity 6000.5.3f1 + URP 17.5 (real render) | N + E `engine-normal2d-*` |
| 12 | opengl-vs-directx-normal-maps | done | done | done | yes | Godot 4.7.2, Unity 6000.5.3f1 | E `engine-normal-yflip-*` |
| 13 | bitmap-font-sdf-msdf-game-ui | done | done | done | yes | Godot 4.7.2, Phaser 3.90/4.2, Pixi 8.21 (Unity: reflection only) | N + E `engine-godot-font-modes`, `engine-pixi-sdf-msdf` |
| 14 | tiled-wang-sets-terrain | done | done | **not started** | meta only (not in registry) | Tiled 1.12.2 CLI, Phaser 3.90/4.2, Godot 4.7.2 (tscn export + YATI 2.2.7) | E `engine-phaser-tiled-wang` |
| 15 | unity-rule-tile-autotile | not started | done | not started | meta only | Unity 6000.5.3f1 + Tilemap Extras 8.0.3 (695/695 cells) | N + E `engine-unity-ruletile-cave` |
| 16 | cjk-font-atlas-localization | not started | not started | not started | no | verification done: Godot 4.7.2 render, Unity TMP batchmode, fontTools | E `engine-godot-cjk-subset` (already in assets) |
| 17 | tile-seams-texture-bleeding-padding-extrude | not started | not started | not started | no | Phaser 3.90/4.2 seam measurements done; Godot render not done | Phaser captures only in scratch (not saved as webp) |
| 18 | aseprite-files-godot-unity-phaser | not started | not started | not started | no | Aseprite 1.3.18 CLI, Phaser 3.90/4.2, Godot 4.7.2 done; Unity Aseprite Importer not run | none |
| 19 | love2d-sprite-sheet-quads-anim8 | not started | not started | not started | no | LÖVE 11.5 17/17 checks done (render needs one re-run) | none yet |
| 20 | gamemaker-import-sprite-strip | not started | not started | not started | no | docs-checked only (GameMaker cannot run here) | none |
| 21 | pixel-art-crisp-in-browser-phaser-pixi | not started | not started | not started | no | source-read only (findings file) | none |
| 22 | defold-atlas-tile-source-flipbook | not started | not started | not started | no | docs research only; bob.jar not run | none |
| 23 | rpg-maker-a2-autotile-to-godot | not started | not started | not started | no | Nerulio corpus exports generated only | N `studio-tile-generator` exists |
| 24 | hitboxes-pivots-2d-animation | not started | not started | not started | no | export capabilities read from source | N `studio-sprite-boxes` exists |
| 25 | nine-slice-ui-godot-unity-phaser | not started | not started | not started | no | nothing | N `lab-ui-nine-slice` exists |
| 26 | fix-ai-generated-pixel-art | not started | not started | not started | no | code state read (see known issues) | N `lab-pixel-cleanup` exists |

## 3. Where things live

- **In the branch (permanent):** `content/guides/<slug>/*.md`, `src/guides.js`, `assets/guides/*`,
  `docs/guides-drafts/meta/*.json` (all writer metadata incl. #14, #15), `docs/guides-drafts/verify/`:
  - `cjk-font-atlas-localization/`: `build_charset.py`, `check_glyphs.py` (both meant for publishing, tested), sample `loc/` files, `AddCharsetToFontAsset.cs` (ran in Unity), `godot-render.gd`
  - `tile-seams-texture-bleeding-padding-extrude/`: Phaser harness (`index.html`, `game.js`, `run.py`) and `results.json` (seam pixel counts)
  - `unity-rule-tile-autotile/BlobRuleTileBuilder.cs` (the published snippet, ran in Unity)
  - `aseprite-files-godot-unity-phaser/`: `export_ase.py`, Phaser `run.py`, Godot `aseprite_frames.gd` + `check.gd`; `shared/samurai.aseprite` + `make_samurai_ase.mjs`
  - `love2d-sprite-sheet-quads-anim8/`: `main.lua`, `conf.lua`, `run.py`
  - `gamemaker-import-sprite-strip/NOTES-handoff.txt` (every finding with its manual URL)
  - `pixel-art-crisp-in-browser-phaser-pixi/source-findings.txt` (source facts + test matrix)
- **Scratchpad (session-temporary, may disappear):**
  `C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad\guides\`
  — `verify/<slug>/` (Godot/Unity projects, logs, renders), `meta/`, `shots.py`, `raw/` PNGs.
  Everything needed to continue is in the branch; the scratch copies are only the full evidence logs.
- **REPORT.md files do not exist:** the harness blocks subagents (and this agent) from writing
  report files. Each writer's report (claim tables, measured numbers, log paths) was delivered as a
  hand-off message to the session and is summarised in section 4 and in the coordinator's report.

## 4. Verification notes worth keeping (from the writers' reports)

- Godot 4.7.2: `use_texture_padding` defaults to true (1 px edge copy, no mipmaps); `process/normal_map_invert_y`
  flips green within 1/255; PointLight2D Height is in pixels and defaults to 0 (normal-mapped sprites go
  nearly black); a missing terrain combination makes Godot substitute and can change neighbours that
  had a correct tile; painting order matters only for incomplete sets. `ClassDB.class_has_property`
  does not exist in 4.7 GDScript (the writer spec suggested it) — use `class_get_property_list`.
- Phaser: `createFromAseprite` animations play once by default; per-frame `duration` replaces the
  frameRate interval (docs say "added"); rotated TexturePacker frames are drawn sideways/clipped in
  3.90 and 4.2; Phaser 3.90 misplaces trimmed Sparrow XML (fixed in 4.2); 3.90 `pixelArt` defaults to
  `zoom !== 1`; Phaser loads BMFont XML but not text `.fnt`; 4.2.1 TilemapGPULayer breaks with
  spacing ≠ margin (open PR phaserjs/phaser#7339).
- PixiJS 8.21: `related_multi_packs` animations that point at other pages come back undefined;
  `meta.scale` wins over `@2x` in the file name; SDF/MSDF only from XML `distanceField`.
- Unity 6000.5.3f1: `TextureImporter.spritesheet` obsolete (warning); defaults in 2D mode are Bilinear +
  compressed; Pixel Perfect Camera Filter Mode only shows with Stretch Fill; Light 2D normal-map
  quality starts Disabled; Auto Tile added in Tilemap Extras 4.2.

## 5. Next steps (priority order)

1. Finish the three nearly done guides: `tiled-wang-sets-terrain` (write ja.md mirroring ko.md),
   `unity-rule-tile-autotile` (ko.md, ja.md), `cjk-font-atlas-localization` (all text; verification
   and render done). Then run `sync_meta.mjs` (fix its paths) and `lint.mjs`.
2. `tile-seams-texture-bleeding-padding-extrude`: Godot 4.7.2 render with padding on/off, crop the
   Phaser captures into `assets/guides/engine-*.webp`, write en/ko/ja.
3. `aseprite-files-godot-unity-phaser` (Unity Aseprite Importer 5.0.3 batchmode run left), then
   `hitboxes-pivots-2d-animation` (reuse samurai.aseprite and the export table in section 2).
4. `love2d-sprite-sheet-quads-anim8` (re-run `run.py`, save the render), `gamemaker-import-sprite-strip`
   (docs-only, `tested: []`), `pixel-art-crisp-in-browser-phaser-pixi` (run the matrix in Playwright).
5. `defold-atlas-tile-source-flipbook` (bob.jar build), `rpg-maker-a2-autotile-to-godot`,
   `nine-slice-ui-godot-unity-phaser`, `fix-ai-generated-pixel-art` (describe Nerulio honestly: no
   majority-per-cell downsample, see known issues).
6. When ≥ 20 guides are registered: `node --test tests/guides.test.mjs` must pass (it currently fails
   only on the count and on links to guides not yet registered), `python tools/generate-guide-social.py`,
   then the browser suite and the full regression (section 6). `tests/guides-browser.py` has not been
   run yet against a dist build.
7. Link the guides from the `/game/` hub once the SEO branch lands (it already reads the registry).

## 6. Build, run, test

```
npm test                                   # all node tests; guides.test.mjs fails until >= 20 guides
node docs/guides-drafts/lint.mjs           # renderer problems, structure parity, word counts (fix its W path)
PORT=4531 node tools/serve.mjs             # source mode (restart after src/guides.js changes: ALL_ROUTES is read once)
SITE_URL=https://example.test/ node tools/build.mjs
PORT=4531 node tools/serve.mjs --dist      # then: TEST_URL=http://127.0.0.1:4531 python tests/guides-browser.py
TEST_URL=http://127.0.0.1:4531 python tools/guides-shots.py [name] [--locales=ko,en,ja]   # re-shoot Nerulio screenshots
python tools/generate-guide-social.py [--force]
python tools/regression.py                 # uses ports 4173/4174 (hard-coded); includes guides-browser
NERULIO_CORPUS='C:\nope' npm test          # CI has no corpus; the guides need none (only guides-shots.py
                                           # reads the corpus, for the coolschool A4 block)
```

Engines on this machine: Godot `C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe`, Unity
6000.5.3f1 (template in `%LOCALAPPDATA%\nerulio-engine-verify\unity-template*`, copy before use, one
Unity process at a time), Phaser/Pixi `npm ci --prefix tools/engine-verify/web`, LÖVE/bob.jar/Tiled/
msdfgen in `%LOCALAPPDATA%\nerulio-engine-verify`, Aseprite CLI `C:\Users\2009s\asebuild\b\bin\aseprite.exe`.
For web engines use Playwright request interception (no extra ports).

## 7. Known issues

- Nerulio bugs found by writers (not fixed, outside this branch's area):
  - `src/game/export/unity.js` CreateClips adds a closing key at t = total, so every exported clip is
    1/fps too long in 6000.5.3f1 (2 frames at 8 fps → 0.375 s instead of 0.25 s); the engine-verify
    probe checks key times, not `clip.length`. Unity export always writes PPU 100.
  - UI Lab font-file (TTF) mode writes the cell height as BMFont `info size` (Godot `fixed_size`), so
    text scales by size/cellH; pixel TTFs come out antialiased; characters missing from the TTF are
    silently drawn from a system font and baked into the atlas (so the missing-glyph check passes).
  - `docs/STUDIO-PACK.md` says Phaser draws rotated frames "mirrored"; measured: sideways and clipped.
  - Pixel Lab has no majority-per-cell downsample and does not report grid phase (matters for #26).
- Guides pages carry no ads and no analytics script (static, CSP-clean, no inline script).
- The language-neutral URL shows English with canonical `/en/…` (same as tool pages); ko/ja
  browsers are redirected by `src/guides-page.js`.
- Some Nerulio screenshots show light Lab pages (the Labs are not dark yet) next to the dark guide.

## 8. Conflict hotspots

- `tools/build.mjs`: the SEO branch edits the same import block, the `ALL_ROUTES` line and `entry()`.
  Ours: two imports, one `ALL_ROUTES.push` line, one `guideEntry` line after the Studio line.
- `tools/regression.py`: the SEO branch changes the suite-list line; ours adds the next line
  (`run('guides-browser',…)`) — adjacent, expect a trivial conflict.
- `tools/serve.mjs`: both add `.webp`/`.woff2` MIME types with identical text (should merge cleanly).
- `src/content.js` `footer()`: we add one link; check if other branches touch the footer.
- `tools/generate-social.py`: untouched here on purpose (guides use their own script).
