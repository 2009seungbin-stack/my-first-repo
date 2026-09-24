# Studio · Texture workspace (P4)

`/game/studio/?ws=texture` (all language prefixes). Normal maps and lighting for 2D games: **open a
sprite, a sprite sheet or a tileable texture → a normal map is generated at once (bevel from the
silhouette, detail from brightness, or your height map) → paint relief where the guess is wrong →
see it lit exactly as Godot draws it → check the convention and the seams → export files that were
loaded and rendered in Godot 4.7.2 and Unity 6.** It plugs into the Studio through the workspace API
(`docs/STUDIO.md`) and uses only `ctx`. Document state lives in `doc.settings.texture`, so every
edit is one undo step, autosaves, and is saved in `.nerulio` files without a change to the project
format.

## Using it

1. **Open a picture** (File › Import or drop a PNG). The Studio suggests *Sprite* when the picture
   has transparent pixels and *Tileable texture* when it has none. This is a suggestion only: it is
   shown under "This picture is" and nothing is stored until you change something.
   Frames cut in the Sprite workspace are the animation here: every frame is processed on its own,
   with the same parameters and units in pixels, so an animation keeps one consistent relief.
2. **Normal map panel.** *Source* is **Generate from the picture** or **Use <an imported normal
   map>**. For generated maps you have these controls:
   * **Bevel from the silhouette.** Width and height in px. The profile is round, linear, smooth,
     cove or ledge. The distance is round (exact Euclidean), square or diamond.
     Suggested width: pixel art (frames ≤ 128 px) gets a 1.5 px rim. Larger sprites get about
     0.9 × their typical inscribed radius, which makes a rounded "pillow" over the whole shape
     (see *Head-to-head*).
   * **Detail from brightness.** Labelled as an approximation. "Ignore shading wider than" is a
     high-pass, so a dark cloak is not read as a hole.
   * **Height map.** Any Height/Displacement asset of the same size, 16-bit PNGs included.
   * **Normal map.** Strength, and a kernel: Pixel (central difference, no smoothing), Sobel,
     Scharr or Sobel 5×5. Edges are Clamp (sprites), Wrap (tileable, so there is no seam) or Mirror.
     Green is OpenGL (Y+) or DirectX (Y−).
   * **Pixel-art normals** snap every pixel to 4/8/16/32 directions × 1–4 tilts.
   * **Height brush (B).** Raise, lower, smooth, flatten or erase. `[` `]` change the size, Alt
     inverts. Each stroke is one undo step and stays inside the frame it started in.
3. **Lighting panel + Lights tool (L).** Drag a light, Shift+click to add one, Alt+click to remove
   one. You can have up to 8 lights. Each light has colour, energy, height (z in px), radius and a
   falloff (smooth, linear, quadratic or none). There is also ambient (Godot `CanvasModulate`),
   specular (exported as a Godot specular map) and a rim light. The rim light is **preview only**,
   and the UI says so. Light positions are in frame pixels, so every frame is lit alike.
4. **View (HUD, Alt+1…6):** Albedo · Height · Normal · Lit · AO · Maps. **C** splits the view into
   flat and lit. **T** shows a 3×3 tile (textures). **`** switches between the whole sheet and one
   frame. **Enter** plays the animation lit.
5. **Maps & channels.** You can show AO, cavity, curvature, roughness ≈ and specular ≈. The last two
   are approximations from the albedo, and the UI labels them. You can add maps to the project, and
   pack or unpack channels with engine presets (Godot ORM, Unity mask …). Material sets are grouped
   by file name, and you can correct their roles.
6. **Check panel.**
   * **Normal map convention.** For an imported map, the panel shows a verdict, its confidence and
     the evidence (below). The verdict is **never applied until you confirm it** ("It is
     DirectX/OpenGL"). A warning chip on the canvas opens the panel. When the silhouette shows that
     **red** is flipped, the panel says so, and **Flip red (X−)** fixes it on load (undoable).
   * **Seams (textures).** The wrap test (0 = seamless) and the albedo's own seam ratio.
   * **Mipmaps.** The normal map is averaged as vectors and renormalised.
7. **Export (Ctrl+E).** The ZIP has one folder per target, each with a README that repeats the
   verification status:
   * **Godot 4** (verified): `<name>_lit.tscn` (Sprite2D + CanvasTexture + CanvasModulate + one
     PointLight2D per light with this falloff as its texture + AnimationPlayer over the frames),
     `<name>_canvas_texture.tres`, the PNGs and a specular map when specular > 0.
   * **Unity 6 URP 2D** (verified): the PNGs, `nerulio-texture.json` and
     `Editor/NerulioNormalMapImporter.cs`. *Tools › Nerulio › Apply Texture JSON* sets the sprite
     rects and adds the normal map as Secondary Texture `_NormalMap` (linear, uncompressed, never
     resampled). *Create Lit Preview* adds point Light2D lights with Normal Map quality Accurate and
     Normal Map Distance = z. URP draws its own light falloff, so the brightness curve is Unity's
     and not the Studio's.
   * **PNG set + JSON** (plain files): albedo, normal in both conventions (`_n` OpenGL, `_n_dx`
     DirectX), a 16-bit height map, AO, specular and a manifest.

   Also: *Normal map PNG · OpenGL / DirectX* for a quick single file, and optional albedo edge bleed
   (0 = the albedo PNG stays byte-identical).

Everything runs in the browser. Generation runs in a worker (`texture-worker.js`) and nothing is
uploaded.

## Model and units

* **Height** is in pixels: the bevel's plateau is `depth` px above the edge, and brightness detail
  adds up to `depth` px. The slope a kernel measures is px per px, so strength 1 gives a 45° face
  for a 1 px rise per px.
* **Normals** are OpenGL (x right, y up, z out) unless DirectX is chosen. They are encoded as
  `(n+1)/2·255`. Flat is (128,128,255).
* **Per-frame consistency**: frames are regions of the sheet. The distance transform, blur and
  kernels never read across a region border. Parameters are absolute px, never normalised per
  frame. `tests/normals.test.mjs` proves that a frame's map does not depend on its neighbours and
  moves with the sprite.
* **Lighting** = Godot 4's canvas light (`src/game/normals/lighting.js` is the CPU reference, and
  `lit-view.js` mirrors it in GLSL):

  `colour = base·ambient + Σ falloff(d/r)·light·energy·(base·max(0, N·L) + spec)`

  N is decoded like Godot: x = 2r−1, y = −(2g−1) in canvas y-down, z rebuilt from x and y.
  **The WebGL2 preview = the reference ≤ 1/255** (browser test reads pixels back), and
  **Godot 4.7.2 = the reference ≤ 1/255** (below).

## GL/DX detection (`src/game/normals/convention.js`)

1. **Integrability (curl).** Read as OpenGL, the slopes are gx = −nx/nz and gy = ny/nz. A real
   surface has ∂gx/∂y = ∂gy/∂x. A DirectX map negates one side, so the sign of
   ρ = corr(∂gx/∂y, ∂gy/∂x) gives the convention.
   * The map is cut into blocks. Each block votes, weighted by its mixed-derivative signal.
   * The confidence comes from the size of ρ and the block agreement.
   * Surfaces without diagonal relief ("no mixed slopes") give **no verdict**, never a guess.
2. **Silhouette (sprites).** Normals face outward at the edge. The test correlates green (and red,
   separately) with the outward direction of the blurred alpha. Two independent tests that agree
   lift the confidence. When they disagree, only a clearly stronger test may speak, with low
   confidence.
3. **Red.** The curl test sees *handedness*, not which channel is flipped. On sprites the
   silhouette measures red on its own:
   * A flipped red inverts the curl vote back.
   * The verdict is then about green, and `red: 'flipped'` is reported.
   * The confidence is capped at medium.

   NormalMap-Online's default output is such a map. Before this rule, the Studio called it a
   confident "DirectX". **Without a silhouette (a texture) red cannot be separated from green**, and
   the Check panel says so next to a DirectX verdict.

Accuracy (`tools/engine-verify/texture/convention_eval.mjs`, results in
`results/convention-2026-09-24.json`). The samples are real maps whose convention is known: 30
ambientCG sets and 30 Poly Haven sets (both conventions each), the corpus textures, and two real
sprite packs cut into frames.

| Samples | n | Verdict given | Accuracy | Wrong "high" |
|---|---|---|---|---|
| Full 1K maps (ambientCG, Poly Haven, corpus) | 128 | 100 % | **100 %** | 0 |
| – of which Poly Haven | 60 | 100 % | 100 % | 0 |
| 256² crops | 504 | 99.2 % | 100 % | 0 |
| 64² crops | 504 | 99.6 % | 99.6 % | 0 (2 wrong "medium": flat Tiles107) |
| Sprite frames (213: OGA asteroids 3D-rendered normals, 75 px, + pixel torch hand-painted, 32 px) | 213 | 100 % | 100 % | 0 |
| The same frames with RED flipped | 213 | 100 % | 100 % green; red reported flipped on 213/213 | 0 (capped at medium) |
| Naive "mostly green-high = OpenGL" rule, all samples | 1562 | — | 46 % | — |

A full 1K map takes about 45 ms (median). The hand-painted torch reads as DirectX with *low*
confidence, because its tests disagree. That is honest for a stylised map.

## Engine verification (`tools/engine-verify/texture/`)

`make_case.mjs` builds a case without a browser. It uses the same pure modules as the Studio, writes
the export bundle exactly as the Studio zips it, and saves reference renders from `lighting.js`.
There are six real-asset cases:

| Case | Asset (CC0) | What it covers |
|---|---|---|
| torch | OGA pixel torch, 6 frames 32² | pixel art, AnimationPlayer frames |
| torch_spec | same, frames 1/5 | specular map + shininess |
| adventurer | Kenney platformer adventurer, 80×110 frames, 720×330 sheet (not a power of two) | HD sprite, size-aware bevel |
| samurai | OGA samurai 48² | pixel art, 60 frames |
| bricks | ambientCG bricks 256², tileable | texture, wrap |
| bricks_dx | the ambientCG **DirectX** normal map, converted to GL | imported map path |

**Godot 4.7.2 (gl_compatibility)**, run with `godot_texture.py`, results in
`results/godot-2026-09-24.json`: **6/6 PASS**.

* Every checked frame (by region, and through the exported AnimationPlayer): max |Δ| = 1/255 and
  100 % of opaque pixels within 1/255. The mean is 0.14–0.22 levels.
* Negative control: the same render with green flipped is 3.8–37 levels off. The check can see a
  wrong convention.

**Unity 6000.5.3f1, URP 17.5, 2D Renderer, Direct3D 12**, run with `unity_texture.py`, results in
`results/unity-2026-09-24.json` and `results/unity-negative-2026-09-24.json`:
**12/12 PASS** (6 cases × Gamma and Linear colour space).

* **How it works.** The probe runs the **shipped importer** (`CreatePreview`). It renders every
  light alone twice at 1 texel per pixel: once with the imported normal map, and once with the
  light's normal map switched off. Their ratio is exactly the N·L factor URP applied.
* **What is compared.** That factor is compared with N·L computed from the exported `_n.png`,
  decoded the way URP decodes it (thresholds fixed before the first run: mean ≤ 0.02, p95 ≤ 0.05).
  The settings must also hold: `_NormalMap` secondary texture, sRGB off, texture sizes unchanged,
  Accurate quality, Normal Map Distance = z / PPU.
* **Measured.** Mean |error| is 0.0037–0.0085 and p95 is 0.013–0.022. The same prediction with
  green flipped is 8–60× worse.
* **Negative control** (`--negative`). The bundle's `_n.png` is green-flipped *inside Unity*. Every
  run **FAILs**: mean error 0.19 (torch), 0.10 (adventurer), 0.07 (bricks). The flipped prediction
  then fits to 0.006–0.009, which shows that the check really reads Unity's pixels.

Getting Unity to PASS found **three real bugs in the shipped importer** (fixed):

1. Unity 6 moved `Light2D` to the `Unity.RenderPipelines.Universal.2D.Runtime` assembly. The
   importer looked only in `…Universal.Runtime`, so *Create Lit Preview* made **no lights**. The
   first judge compared an unlit render and got Spearman −0.46.
2. `normalMapDistance` / `normalMapQuality` are read-only properties in URP 17. The importer now
   sets `m_NormalMapDistance` / `m_NormalMapQuality` through `SerializedObject`.
3. The normal map is imported as a Default texture, and Unity **resampled it to a power of two**
   (96×64 → 128×64), which blurred the normals. The mean error was 0.045 before the fix and 0.005
   after (`npotScale = None`, and `maxTextureSize` fitted to the sheet for albedo and normal).

The probe sets the 2D Renderer's *Light Render Texture Scale* to 1. The default 0.5 computes
lighting at half resolution. That is a project setting, not part of the export, and the Unity
README tells pixel-art users about it.

**Not exported / preview only:** the rim light (no engine draws it without a custom shader) and
Unity specular (Godot only). Roughness ≈ and specular ≈ are approximations and are labelled.

## Head-to-head (2026-09-24, same real CC0 assets)

Script: `tools/engine-verify/texture/h2h_measure.mjs`, results in `results/h2h-2026-09-24.json`.
Each tool's output is compared with a **real reference normal map** of the same asset:

* **asteroids**: normals rendered from the 3D models (OGA, Jarusca).
* **torch**: normals hand-painted by the artist (OGA, XLIVE99), given as DirectX and flipped to GL
  for the comparison.
* **bricks**: the ambientCG NormalGL (the bricks tests use the albedo, and the 8-bit displacement
  as the input).

The competitors ran with their **default settings**. Nerulio ran with the parameters the Studio
suggests when it opens the picture. Neither side was tuned per asset.

* **NormalMap-Online**: Playwright on the live site. The image was loaded as its height input and
  the result downloaded.
* **PBR Forge**: Playwright on the live site. Image Type Sprite or Texture, exported as OpenGL.
  Edge Handling was left at its default, and also tried with Tile.
* **Laigter 1.14.0**: the Windows build from GitHub, run through its CLI
  `--no-gui --diffuse … --normal`. It was also run with a preset `Tile 1`.

What each column means:

* **°**: the mean angle to the reference as exported. **°best**: the same after the best single
  strength factor (strength is a slider in every tool, the shape is not).
* **Lambert**: the mean |N·L difference| × 255 for 4 lights at 45° elevation. This is the lighting
  term of the Godot model above.
* **Seam**: step across the wrap border ÷ step inside. **Roll**: the output of the texture rolled by
  half, rolled back, compared on a 2 px border band. 0 = wrap-correct.
* **Detected**: what the Studio's detector says about the file.

| Tool | Asteroids (3D-rendered) °/°best/Lambert | Torch (hand-painted) °/°best | Bricks albedo °/°best · seam · roll | Brick height °/°best · roll | Detected on its output |
|---|---|---|---|---|---|
| **Nerulio** | **20.0** / 19.6 / 35.6 | 38.1 / 37.6 | **14.7** / 14.4 · 1.19 · **0** | **8.8** / 5.5 · **0** (as a height map: **7.7** / 5.5) | OpenGL, high |
| Laigter 1.14 (default) | **18.3** / 14.3 / 31.9 | 41.6 / 37.4 | 27.3 / 15.8 · **24.0 · 63.8** | 29.8 / 13.7 · 57.8 | OpenGL, high |
| Laigter 1.14 (Tile preset) | — | — | 16.5 / 12.5 · 2.14 · 0 | 26.0 / 10.3 · 0 | OpenGL, high |
| PBR Forge (default / Tile) | 42.0 / 28.9 / 78.3 | 37.0 / 37.0 | 15.5 / 13.6 · 1.62 · 0.57 (Tile 0.24) | 13.1 / 6.7 · 1.17 (Tile 0.37) | OpenGL, high |
| NormalMap-Online | 61.1 / 53.5 / 97.4 | 87.1 / 80.4 | 65.6 / 54.1 · 1.34 · 0 | 77.8 / 77.4 · 0 | **red flipped** (sprites: "OpenGL, medium + red flipped"; textures: "DirectX, high", see *Red* above) |

What it shows:

* **Sprites with a 3D ground truth (asteroids).**
  * Laigter's default is the closest (18.3°). Nerulio is 20.0°. It was 36.6° with the old fixed
    4 px bevel, and this comparison is why the suggested bevel now scales with the sprite.
  * PBR Forge's sprite bevel is a thin rim (42°). NormalMap-Online has no bevel, and its default
    output has **red inverted** (corr(R, truth) = −0.58) with a very low z.
* **Hand-painted pixel art (torch).** Every generator is 37–42° off; stylised hand-painted normals
  are not derivable from the colours. NormalMap-Online is 87° off.
* **Seams.**
  * Laigter's default treats the image border as a sprite edge, with a 3 px tilted band on every
    side (roll error 63.8). Its Tile preset fixes it.
  * PBR Forge leaves a small border difference even with Tile (0.24).
  * Nerulio (Wrap is suggested for opaque pictures) and NormalMap-Online are exactly wrap-consistent
    on this asset. An earlier research note (2026-09-23) saw a border band in NormalMap-Online on a
    different image; it did not reproduce here.
* **Height input.** Nerulio with the 8-bit displacement is the closest to ambientCG's own normal
  map (7.7° as a height map, 5.5° at the best strength). The Studio also reads the 16-bit file
  directly.

Workflow and features (the task: a normal map of a sprite, lit in Godot):

| | Nerulio Studio | Laigter 1.14 | PBR Forge | NormalMap-Online |
|---|---|---|---|---|
| Where | browser, local | desktop (paid on itch.io; free GPL-3 build on GitHub) | browser, local, free beta | browser, local, free |
| Steps to a normal map | drop the PNG (it is generated at once) | open the app, drag the PNG, export | Select Image → (Sprite is auto-picked) → export panel → Normal Map | choose the file → Download |
| Steps to a lit Godot scene | Ctrl+E → Export ZIP → open `_lit.tscn` (**verified in Godot 4.7.2**) | set up a CanvasTexture and lights by hand | same, by hand | same, by hand |
| Unity | importer + Light2D preview (**verified in Unity 6**) | by hand | by hand | by hand |
| Bevel from alpha | ● size-aware | ● (a dome, good default) | ● thin rim | ○ |
| Per-frame processing of a sheet | ● frames never bleed | not checked (the CLI treats a sheet as one image) | ○ (whole image) | ○ |
| Pixel-art quantised normals | ● 4–32 directions × tilts | not seen | not seen | ○ |
| Height brush | ● raise/lower/smooth/flatten/erase, per frame | not checked | ○ | ○ |
| GL/DX **detection** with confidence | ● (+ red-flip warning) | ○ | ○ (choose on export) | ○ (invert toggles, unlabelled) |
| Tile / wrap | ● suggested for opaque pictures, roll error 0 | ● option (off by default) | ● option | wrap-consistent here |
| Lit 2D preview | ● = Godot's model (≤ 1/255) | ● own model | ● own model | 3D shapes only |
| 16-bit height input / output | ● / ● | not checked | not checked | ○ |

The raw outputs of every tool are kept under `C:\Users\2009s\nerulio-handoff\scratch\texture\h2h`
(not committed). The runner scripts are `run_nmo.py` and `run_pbrforge.py` next to them.

## Code

| Where | What |
|---|---|
| `src/game/normals/height.js` | Exact EDT (Felzenszwalb) + chamfer metrics, bevel profiles, masked blur, luminance height, 16-bit plane → height, brush strokes |
| `src/game/normals/normal.js` | Separable kernels (central/sobel3/scharr/sobel5) × clamp/tile/mirror, quantiser, encode, bleed, normal-aware mips, seam + roll metrics |
| `src/game/normals/convention.js` | GL/DX detection (curl + silhouette, red check) |
| `src/game/normals/maps.js` | AO (horizon), cavity, curvature, labelled albedo approximations, height → 8/16-bit |
| `src/game/normals/lighting.js` | Godot 4 canvas light model (CPU reference), falloff textures |
| `src/game/normals/pipeline.js` | Parameters, suggestions (`suggestParams`, `typicalRadius`), per-frame generation, live brush patch |
| `src/game/normals/png16.js`, `export.js` | 16-bit grey PNG; Godot `.tscn`/`.tres`, Unity importer + JSON, generic manifest, specular map, `VERIFIED` |
| `src/studio/workspaces/texture/` | `index.js` (workspace, tools, commands), `panels.js`, `lit-view.js` (WebGL2), `preview3d.js` (GGX sphere/plane), `state.js`, `texture-worker.js`, `strings.js` (ko/en/ja), `texture.css` |
| `tools/engine-verify/texture/` | `make_case.mjs`, `godot_texture.py` + `texture_probe.gd`, `unity_texture.py` + `unity/NerulioTextureProbe.cs`, `convention_eval.mjs`, `h2h_measure.mjs`, `fetch_acg.py` / `fetch_ph.py` (CC0 downloads into the corpus `_adhoc`), `results/` |

Tests:

* `tests/normals.test.mjs`: 23 engine tests on real CC0 fixtures.
* `tests/studio-texture.test.mjs`: 3 tests (strings parity, state round trip incl. the red flip,
  working layout).
* `tests/studio-texture-browser.py`: 40 checks in Chromium, part of `tools/regression.py`. It
  covers the lit preview ≤ 1/255, one undo step per light drag, brush and slider, wrap test 0, DX
  detection not applied until confirmed, red-flip warning and fix, ORM pack byte-exact, export
  ZIP, autosave recovery, `.nerulio` round trip, ko/ja and 390 px.

Fixtures are in `tests/fixtures/texture/` (CC0, `SOURCES.md`; `-text` in `.gitattributes`).

## Known gaps

* **Chromium only.** Firefox and WebKit were not run.
* **Textures: red vs green is ambiguous.** On a picture without transparent edges a flipped red
  reads as DirectX. The UI warns about it and offers the manual *Flip red*.
* **No frame cutting inside Texture.** A sheet without frames is lit as one picture. Frames come
  from the Sprite workspace, and the Frames panel says so.
* **Brush preview near borders.** Near a region border in Wrap/Mirror mode, the live brush preview
  can differ slightly until the worker's exact recompute replaces it after the stroke.
* **Unity brightness.** Unity's lit brightness follows URP's falloff, not Godot's. The export
  verifies placement, height and the normal-map reading, not identical brightness.
