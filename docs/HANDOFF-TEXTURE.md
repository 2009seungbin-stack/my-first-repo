# Handoff — Studio P4 Texture workspace

* Branch `nerulio/studio-texture` (from origin/main; origin/main merged at c4635a4, nothing new on main
  since). Worktree `C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-ab258719b28b2c008`. Head: see
  `git log -1` (this file is in the last commit). Port for this work: **4511**.
* Rules: `C:\Users\2009s\nerulio-handoff\STUDIO-AGENT-RULES.md` + `START-HERE.md`. Do not open or
  merge PRs. Push the branch only and report to the coordinator.
* Scratch (case folders, head-to-head outputs, screenshots, patch scripts):
  `C:\Users\2009s\nerulio-handoff\scratch\texture\`. It is a copy of the old session scratchpad's
  `p4/` plus the competitor scripts.

User and developer documentation: **`docs/STUDIO-TEXTURE.md`**. It covers the model, detection
maths, accuracy tables, the engine runs, the head-to-head and the known gaps. This file only tracks
status.

## Status (2026-09-24, session 2) — feature-complete, pending the coordinator's ship run

### DONE

**Everything from session 1** (see git history): pure engines under `src/game/normals/`, the
workspace under `src/studio/workspaces/texture/`, the tests, and the Godot verification.

**Session 2:**

1. **Unity 6000.5.3f1: VERIFIED.** `export.js` has `VERIFIED.unity.status = 'verified'`. The UI,
   the README and both tests are updated.
   * The old judge compared an **unlit** render. `lights: []`, because the importer's
     `Type.GetType("…Light2D, Unity.RenderPipelines.Universal.Runtime")` fails in Unity 6: Light2D
     now lives in `Unity.RenderPipelines.Universal.2D.Runtime`.
   * **Three shipped-importer bugs fixed:**
     * Light2D is now found in any loaded assembly.
     * `m_NormalMapQuality` / `m_NormalMapDistance` are set via SerializedObject (the properties are
       read-only).
     * `npotScale = None` + `maxTextureSize` fitted. The Default-type normal map had been resampled
       96×64 → 128×64, which blurred the normals.
   * **New judge.** The probe renders each light alone, with and without its normal map. The ratio
     is Unity's N·L, which is compared with N·L predicted from the exported `_n.png`. Thresholds:
     mean ≤ 0.02, p95 ≤ 0.05, and the flipped prediction must be ≥ 3× worse. The settings must also
     hold: sizes unchanged, sRGB off, Accurate quality, distance = z/PPU. It runs in Gamma **and**
     Linear.
   * **12/12 PASS:** mean 0.0037–0.0085, p95 ≤ 0.022, flipped 8–60× worse.
   * **Negative control** (`--negative`, green flipped inside Unity): 3/3 FAIL, as they must (mean
     0.07–0.19).
   * Results: `tools/engine-verify/texture/results/unity-2026-09-24.json`, `unity-negative-2026-09-24.json`.
2. **Godot 4.7.2 re-run** after the changes: **6/6 PASS** (max 1/255 everywhere; the adventurer
   case was rebuilt with the new bevel).
3. **Poly Haven.** `fetch_ph.py` downloads 30 sets (60 maps) into the corpus
   `_adhoc/nerulio-studio-texture/polyhaven/`, and SOURCES.md there is updated.
   `convention_eval.mjs` reads them, and also every **frame** of the two real sprite packs, plus the
   same frames with RED flipped. Results:
   * 128 full maps: 100 %.
   * 1562 samples: 99.9 %, **0 wrong "high"**.
   * 213 frames: 100 %.
   * Red-flipped frames: green 100 %, red reported 213/213, none "high".
4. **Red-flip detection + fix.** The curl test cannot tell R from G. The silhouette now measures red
   separately, so NormalMap-Online's default output (red inverted) no longer reads as a confident
   "DirectX". The Check panel shows a warning and a **Flip red (X−)** toggle (`normalRedFlipped` in
   the state, undoable, round-trips through `.nerulio`). For textures without a silhouette, a note
   explains the R/G ambiguity. ko/en/ja.
5. **Size-aware default bevel** (`suggestParams` + `typicalRadius`). HD sprites get a width of about
   0.9 × the median inscribed radius per frame. Against the 3D-rendered asteroid normals the mean
   angle went from 36.6° to 20.0° (Laigter default 18.3°). Pixel art is unchanged.
6. **Head-to-head** (`tools/engine-verify/texture/h2h_measure.mjs`, `results/h2h-2026-09-24.json`,
   table in docs/STUDIO-TEXTURE.md). Tools: Laigter 1.14 CLI (GitHub build), PBR Forge (live,
   Playwright), NormalMap-Online (live, Playwright), and Nerulio. Assets: asteroids, torch, bricks
   albedo and bricks height, each against a real reference normal map. Runner scripts are in
   `scratch/texture/h2h/run_nmo.py` and `run_pbrforge.py`, and Laigter is in `scratch/texture/h2h/laigter/`.
7. `docs/STUDIO-TEXTURE.md` written and linked from `docs/STUDIO.md`.
8. **UI polish** from the screenshots:
   * The Frames hint rendered as ", and . step frames". It is now `<kbd>,</kbd> <kbd>.</kbd>
     previous / next frame`.
   * The "Select a light" note had no padding.
9. **Browser test: 40 checks**, up from 37: red flip is flagged and not called a confident DX, Flip
   red restores the map byte-for-byte, and the flip is one undo step. Unity is now labelled
   verified.

### Test status

See the final section of the coordinator report; the last full run is recorded in the commit
message of the head commit.

## Open / next (small)

* **Firefox/WebKit** not run.
* **390 px:** the dock tab labels wrap to two lines ("Normal / map"). That is the shell's tab style
  (shared CSS), so it is not changed here.
* **Laigter:** its GUI brush and animation features were not checked. Only the CLI default and the
  Tile preset were measured.

## How to build / run / test

```
PORT=4511 node tools/serve.mjs
TEST_URL=http://127.0.0.1:4511 TEXTURE_SHOTS=<dir> python tests/studio-texture-browser.py
node --test tests/normals.test.mjs tests/studio-texture.test.mjs
node tools/engine-verify/texture/make_case.mjs --albedo <png> --out <case> [--grid 32x32 --frames 0,4 --pixel --kind texture --normal <png> --flip-green --specular .7 --shininess .35 --name x]
python tools/engine-verify/texture/godot_texture.py <case>... --json out.json
python tools/engine-verify/texture/unity_texture.py <case>... [--space Gamma|Linear] [--negative] --json out.json
node tools/engine-verify/texture/convention_eval.mjs --json out.json
node tools/engine-verify/texture/h2h_measure.mjs C:\Users\2009s\nerulio-handoff\scratch\texture\h2h --json out.json
```

There are six cases, all under `scratch/texture/cases/`:

| Case | make_case arguments |
|---|---|
| torch | `sprites-normal/oga-pixel-torch/Torch_Sheet.png --grid 32x32 --frames 0,4 --pixel --name torch` |
| torch_spec | same sheet, `--frames 1,5 --specular 0.7 --shininess 0.35 --name torch_spec` |
| adventurer | `sprites/kenney-platformer-characters/adventurer_tilesheet.png --grid 80x110 --frames 0,9,20 --name adventurer` |
| samurai | `sprites/oga-samurai/samurai.png --grid 48x48 --frames 0,13 --pixel --name samurai` |
| bricks | `tests/fixtures/texture/bricks_Color.png --kind texture --name bricks` |
| bricks_dx | the same albedo, plus `--normal tests/fixtures/texture/bricks_NormalDX.png --flip-green --name bricks_dx` |

## Conflict hotspots (outside the texture area)

* `src/studio/main.js`: the register line.
* `src/studio/workspaces/coming.js`: texture removed.
* `tools/regression.py`: the suite list.
* `.gitattributes`: the fixture line.
* `src/game/texture-normal.js`: the Lab fix d6cdd74.
* `docs/STUDIO.md`: one line in the code list.

Everything else is new files under `src/game/normals/`, `src/studio/workspaces/texture/`,
`tools/engine-verify/texture/`, `tests/` and `docs/STUDIO-TEXTURE.md`.
