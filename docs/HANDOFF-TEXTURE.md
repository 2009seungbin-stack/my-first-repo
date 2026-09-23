# Handoff — Studio P4 Texture workspace

* Branch `nerulio/studio-texture` (from origin/main, origin/main merged once at c4635a4). Worktree:
  `C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-ab258719b28b2c008`. Head: see `git log -1`
  (this file is in the last commit). Port for this work: **4511**.
* Rules: `scratchpad/STUDIO-AGENT-RULES.md` (session scratchpad
  `C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad`).
  Do not open/merge PRs; push the branch only; report to the coordinator.

## P4 scope (from the coordinator)
Workspace `texture` via the plug-in API (replaces "coming P4"): sprite normal maps (bevel from alpha
distance transform, luminance detail, height brush, pixel-art quantised normals, per-frame batch,
clamp/tile/mirror kernels with measured seams), live WebGL2 2D lighting (point lights, ambient,
colour/height/falloff, specular, rim, animation, flat comparison, 3D sphere/plane for PBR),
OpenGL↔DirectX with automatic detection + confidence, AO/cavity/curvature, roughness/specular
approximations (labelled), channel pack/unpack with engine presets, edge bleed, mip preview, 16-bit
height; exports Godot 4 (verified), Unity 6 URP 2D (verify or UNVERIFIED), PNG set + JSON; undo,
autosave, .nerulio, ko/en/ja, 390 px. Real assets + head-to-head (Laigter, NormalMap-Online, PBR Forge).

## DONE (all committed)
| Area | Files |
|---|---|
| Pure engines (no DOM) | `src/game/normals/height.js` (exact EDT Felzenszwalb, chamfer metrics, bevel profiles, masked blur, luminance height, 16-bit plane → height, brush strokes), `normal.js` (separable kernels central/sobel3/scharr/sobel5 with clamp/tile/mirror, quantiser, encode, normal bleed, normal-aware mips, seam + roll-consistency metrics), `convention.js` (GL/DX: curl/integrability test + silhouette test, block voting → confidence, never guesses), `maps.js` (horizon AO, cavity, curvature, labelled albedo approximations, height → 8/16-bit), `lighting.js` (Godot 4 canvas light model, falloff textures — CPU reference), `pipeline.js` (params, per-frame regions, generate, live `normalPatch`), `png16.js` (16-bit grey PNG in/out), `export.js` (Godot .tscn/.tres, Unity importer C# + JSON, generic manifest, specular map) |
| Workspace | `src/studio/workspaces/texture/index.js` (tools Light L / Height brush B, HUD view switch Alt+1…6, compare C, tile 3×3 T, sheet \`, play Enter, [ ] size/light height, Ctrl+E export, generation via worker, live brush, export ZIP, add maps to project), `panels.js` (Normal map, Lighting, Maps & channels incl. PBR set roles + pack/unpack, Check = convention verdict + seams + mips, Export, Frames, 3D preview), `lit-view.js` (WebGL2 canvas between the Studio image and overlay; same view transform; Godot model in GLSL; per-cell lights on a whole sheet), `preview3d.js` (GGX sphere/plane), `state.js` (doc `settings.texture`, pure edits, working layout sheet/strip), `texture-worker.js`, `strings.js` (ko/en/ja), `texture.css`. Registered in `src/studio/main.js`; removed from `workspaces/coming.js`. |
| Fix outside my area (separate commit d6cdd74) | `src/game/texture-normal.js` (Texture Lab): `heightToNormal` skipped the vertical kernel's centre column → green slopes were ½ (Sobel) to ⅕ (Scharr) of red. All existing tests still pass. |
| Tests | `tests/normals.test.mjs` (21 engine tests on real CC0 fixtures), `tests/studio-texture.test.mjs` (3: strings parity, state round-trip through normalizeProject, working layout), `tests/studio-texture-browser.py` (**37 checks, all PASS** on 4511; added to `tools/regression.py`), fixtures `tests/fixtures/texture/` (CC0, `SOURCES.md`; `.gitattributes` -text). |
| Engine verification | `tools/engine-verify/texture/make_case.mjs` (builds bundle + reference renders without a browser), `godot_texture.py` + `texture_probe.gd` (Godot 4.7.2 gl_compatibility; compares lit pixels vs `lighting.js`, plus a green-flipped negative control), `unity_texture.py` + `unity/NerulioTextureProbe.cs` (URP 2D batchmode render), `convention_eval.mjs` (GL/DX accuracy), `fetch_acg.py` / `fetch_ph.py` (CC0 downloads into the corpus `_adhoc`). Results in `tools/engine-verify/texture/results/`. |

## Results so far
* **Godot 4.7.2: 6/6 PASS** (`results/godot-2026-09-24.json`): torch (pixel art, 6 frames, also via
  the exported AnimationPlayer), torch + specular map, Kenney adventurer 80×110 (HD), OGA samurai
  48×48, bricks tileable 256², bricks from an imported **DirectX** map converted to GL. Every case:
  max |Δ| = 1/255, 100 % of opaque pixels within 1/255, mean 0.14–0.22; the green-flipped render is
  4–17× worse (the check can catch a wrong convention).
* **Studio WebGL2 preview = reference model** (browser test reads pixels back): ≤ 1/255.
* **GL/DX detection** (`results/convention-2026-09-24.json`): 68 full 1K maps (ambientCG ×30 sets
  downloaded + corpus ambientCG/Poly Haven + 2 sprites): verdict on 100 %, **accuracy 100 %**;
  596 samples incl. 256² and 64² crops: 99.7 %, **0 wrong "high"**, the only 2 errors are "medium"
  on 64² crops of Tiles107 (flat tiles). Naive "mostly green-high" rule: 53.7 %. Torch (hand-painted,
  DX) → DirectX with *low* confidence (tests disagree), which is honest.
* **Seams**: wrap kernels give roll-consistency error exactly 0 on the real tileable bricks (unit +
  browser tests); clamp ≈ 1.8 mean / 16 max at the border, mirror ≈ 2.2 / 19.
* **Unity 6000.5.3f1**: the shipped importer compiles and sets the sprite's Secondary Texture
  `_NormalMap` with sRGB off (settingsOk = true), but the lit render comparison **FAILED**
  (Spearman −0.46 vs flipped −0.21; `results/unity-torch-lit-2026-09-24.png`). Most likely the
  judge's orientation (Unity ReadPixels/EncodeToPNG y-flip) or the light placement/pivot, not
  necessarily the export. → Unity stays **UNVERIFIED** in `export.js` VERIFIED and the UI.
* Texture Lab bug found and fixed (above).

## IN PROGRESS (not finished)
* Unity lit judge (`unity_texture.py`): debug the negative correlation — check whether `lit.png` is
  upside down (compare its alpha/brightness silhouette with the albedo), whether the Light2D lands
  where `CreatePreview` puts it (sprite pivot centre, y up), and whether URP's 2D lights need a
  Global Light for the sprite to render at all. The URP template is cached at
  `%LOCALAPPDATA%\nerulio-engine-verify\unity-template-urp` (built OK).
* Poly Haven fetch (`fetch_ph.py`) not run yet; ambientCG fetch done (30 sets in
  `C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-texture\ambientcg`, `SOURCES.md` there).

## NEXT STEPS (priority order)
1. Unity: fix/finish the lit judge; if it passes, set `VERIFIED.unity` in `src/game/normals/export.js`
   (and the browser test that expects "UNVERIFIED"), else keep UNVERIFIED and document why.
2. Run `python tools/engine-verify/texture/fetch_ph.py`, rerun `convention_eval.mjs`, record numbers.
3. Head-to-head (competitor notes: `scratchpad/competitors/TILE-TEXTURE-UI.md`, scripts
   `scratchpad/competitors/tile/nm*.py`, `pf*.py`): NormalMap-Online roll/seam test on the same
   bricks (feed the texture and the half-rolled texture, un-roll, compare border band — our wrap = 0);
   PBR Forge sprite bevel + Tile edge mode + GL/DX; Laigter free build (GitHub releases of
   azagaya/laigter, GPL-3) if downloadable — normal map of the torch, steps/clicks, features. Table:
   steps, seam error, GL/DX correctness, detection (nobody else has it), brushes, animation, engines.
4. `docs/STUDIO-TEXTURE.md` (model, units, per-frame consistency, detection maths + accuracy table,
   engine results, head-to-head, known gaps); link from `docs/STUDIO.md` workspace list.
5. Full suites: `npm test`; `python tools/regression.py` (uses fixed ports 4173/4174 — check they are
   free first); `python tests/service-browser.py`; the studio suites again with
   `NERULIO_CORPUS='C:\nope'` (my suites use only `tests/fixtures/texture`, so they should not change).
6. Screenshots 1440×900 + 390×844 into `scratchpad/p4/studio-texture/` (the browser test writes them
   with `TEXTURE_SHOTS=<dir>`); look at them.
7. Final report to the coordinator (Korean summary for the owner), per the rules file.

## How to build / run / test
```
PORT=4511 node tools/serve.mjs                       # dev server (serves src/ directly)
open http://127.0.0.1:4511/en/game/studio/?ws=texture
node --test tests/normals.test.mjs tests/studio-texture.test.mjs
TEST_URL=http://127.0.0.1:4511 TEXTURE_SHOTS=<dir> python tests/studio-texture-browser.py
node tools/engine-verify/texture/make_case.mjs --albedo <png> --out <case> [--grid 32x32 --frames 0,4 --pixel --kind texture --normal <png> --flip-green --specular .7 --shininess .35]
python tools/engine-verify/texture/godot_texture.py <case>... --json out.json   # a small window opens
python tools/engine-verify/texture/unity_texture.py <case>... --json out.json   # Unity batchmode with GPU
node tools/engine-verify/texture/convention_eval.mjs --json out.json            # NERULIO_CORPUS overrides the corpus path
```
The 6 Godot cases: torch (`sprites-normal/oga-pixel-torch/Torch_Sheet.png --grid 32x32 --frames 0,4 --pixel`),
torch_spec (`--frames 1,5 --specular 0.7 --shininess 0.35`), adventurer (`sprites/kenney-platformer-characters/adventurer_tilesheet.png --grid 80x110 --frames 0,9,20`),
samurai (`sprites/oga-samurai/samurai.png --grid 48x48 --frames 0,13 --pixel`), bricks (`tests/fixtures/texture/bricks_Color.png --kind texture`),
bricks_dx (`… --normal tests/fixtures/texture/bricks_NormalDX.png --flip-green`).

## UNVERIFIED
* Unity 6 URP 2D export (importer settings verified in batchmode; lit pixels not).
* Rim light is preview-only (no engine draws it without a custom shader) — labelled in the UI.
* Roughness/specular from albedo are approximations — labelled.
* Chromium only; Firefox/WebKit not run.

## Known issues / notes
* A PNG without frames (e.g. a sheet) is lit as one picture; frames come from the Sprite workspace
  (the Frames panel says so). No grid cutting inside Texture.
* Brush live path recomputes a padded patch; near a region border in Wrap/Mirror mode the live
  preview can differ slightly until the worker's exact recompute replaces it (after the stroke).
* Imported normal maps: detection is shown (HUD chip + Check panel) but applied only after the user
  confirms "It is DirectX/OpenGL" (stored as `normalDeclared`).
* The browser test waits for autosave idle before the recovery step (a fast reload can recover an
  older snapshot — shell behaviour, not Texture-specific).

## Conflict hotspots
`src/studio/main.js` (register line), `src/studio/workspaces/coming.js` (texture removed),
`tools/regression.py` (suite list), `.gitattributes` (fixture line), `src/game/texture-normal.js`
(Lab fix). Everything else is new files under `src/game/normals/`, `src/studio/workspaces/texture/`,
`tools/engine-verify/texture/`, `tests/`.
