# Studio Sprite workspace (P1a) — checkpoint

Branch `nerulio/studio-sprite` (based on `origin/main` after PR #26, with `origin/nerulio/trust-fixes`
merged). Stopped at a checkpoint on request (usage limit); everything below is committed and pushed.

## Done

**Document shape v2** — `docs/STUDIO-SPRITE.md` (contract for P1b), `src/studio/core/project.js`
(version 2, v1 migration, shared cels `'*'`, tag `repeat`, `asset.import`), `src/studio/sprite/frame-image.js`
(pure exact frame composition with Aseprite blending: `frameDraws`, `composeFrame`, `composeCanvas`).

**Pure modules** (all unit-tested in `tests/studio-sprite.test.mjs`, 15 tests, pass):
- `sprite/playback.js` — steps with per-frame durations, direction, repeat, onion neighbours, stepping inside a tag
- `sprite/sprite-doc.js` — selection semantics, move/duplicate/insert/delete frames, tags (range, rename, resize), durations, pivots, boxes with scope (same id across frames), collision, mirror metadata, normalize, shift
- `sprite/import-plan.js` — decisions with confidence + alternatives; frame-file grouping (natural sort, `walk_01`, `attack (10)`, folders); placement; sheet plan (grid/islands/custom, rows → tags, timing)
- `sprite/grid-rerank.js` — second look at grid-detect's ranking (split cells, exact strip cell, crossings); engine untouched
- `sprite/gif-decode.js` — GIF (LZW, interlace, disposal 1/2/3, delays, loop); 29/29 real GIFs, 408/408 frames exact vs Pillow
- `sprite/apng-decode.js` — APNG (dispose/blend ops); 132/132 frames exact vs Pillow
- `sprite/aseprite-bridge.js` — .aseprite ⇄ asset; layered import self-verified against `renderFrame`, flattened with the reason otherwise; export via `documentFromImages`
- `sprite/import-build.js`, `sprite/atlas-data.js` (Aseprite JSON / TexturePacker JSON / Starling XML)

**Aseprite round trip (corpus, 231 files)**: 222 layered / 9 flattened (5 composition differs, 4 cel z-index);
asset → our writer → real Aseprite 1.3.18.6 CLI: 231/231 open without warnings, tags 231/231, durations 231/231,
pixels 231/231 (227 by `--sheet`, 4 per frame because Aseprite's sheet/TGA export of gray/indexed originals differs).
Scripts: scratchpad `p1/work/asecorpus.mjs`, `asecheck.py`, `asediff*.py`.

**UI** (`src/studio/workspaces/sprite.js` + `sprite/{timeline-ui,panels-ui,preview-ui,tools,overlay,importers,sprite-worker,frame-render,strings,icons}.js`, `sprite/sprite.css`):
import panel (preview + Apply, confidence chips, one-click alternatives, custom grid), timeline (layers × cels,
tag lane drag-to-create, inline rename, resize, inline/bulk durations, reorder drag, Alt+N / empty / Alt+C / flip),
playback (Enter , . Home End, loop in tag), onion skin (F3), floating preview (F7, 1:1–8×, backgrounds),
pivot (P), rect/circle/polygon boxes (B/C/Q) with scope, nudge, collision from alpha, copy boxes, mirror
(pixels + metadata), mirrored tag copy, align canvas, jitter measure/fix with timeline marks, .aseprite export,
Sheet/Frame view (`) with region editing. Strings ko/en/ja (parity test passes).

**Shell changes (src/studio/app.js — merge-sensitive)**: workspace hooks `present()`, `importFiles()`,
definition `claims(files)`; folder drop (`nerulioPath`); last workspace remembered + `?ws=`; Enter on a
focused button never fires shortcuts; `ctx.minBottomHeight()`. `main.js` registers Sprite; `coming.js` drops it;
`strings.js` merges `sp.*` from `sprite/strings.js`.

**Browser test** `tests/studio-sprite-browser.py`: parts 1–2 written and passing (50 checks, port 4461):
sheet import/apply/alternatives/undo, timeline selection/durations/rename/tag drag/reorder/dup/delete/empty,
playback keys, onion, preview, pivot, boxes + scope + move + nudge, circle, polygon, collision, copy, flip, align, jitter.

## Not done yet (next steps, in order)

1. `tests/studio-sprite-browser.py` part 3: GIF/APNG vs Chromium `ImageDecoder`, numbered frames by drop
   (`drop_named` helper is ready), .aseprite import + export → real Aseprite CLI when present, Sprite Lab JSON,
   Torch atlas, `.nerulio` save/open round trip with own cels, autosave recovery, ko/ja, 390 px + screenshots
   into `scratchpad/p1/studio-sprite/`.
2. Add `studio-sprite-browser` to the suite list in `tools/regression.py`; update `tests/studio-browser.py`
   (it still expects 5 "coming" workspaces — now 4, Sprite is ready).
3. Run `npm test`, `python tools/regression.py`, `python tests/service-browser.py`.
4. Head-to-head table (≥10 real assets: samurai, HQ trooper, sumo hulk, roguelike magenta, samurai_magenta,
   toon adventurer, sprite-boy, tank + tank.json, ninja frames, archer attack frames, trooper GIFs, duelyst .ase)
   vs Aseprite CLI (`--sheet`/import behaviour) and Piskel/Novaboard; clicks to 4 named animations with timing.
5. Known gaps: engine reasons in the Import "Why" lists are English (engine strings); rotated atlas frames stay
   rotated (UNVERIFIED); grid-rerank rules are heuristics documented in the module; group opacity with
   compose-groups flattens on import.
