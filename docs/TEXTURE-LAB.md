# Texture Lab

One browser workspace for preparing and checking PBR / game textures: **Inspect · Normal ·
Channels · Pack · Preview · Fix · Export**. The stages are views over the same in-memory set, so
a map is opened once and every stage sees it. Nothing is uploaded.

Routes (all served by `src/task/texture-lab.js`):

| URL | Opens | Intent id |
|---|---|---|
| `game/texture-lab` | the Lab, Inspect stage | `texture-lab` |
| `game/channel-unpacker` | Channels | `channel-unpacker` |
| `game/normal-map-converter` | Normal | `normal-map-converter` |
| `game/pbr-texture-validator` | Inspect | `pbr-texture-validator` |
| `game/texture-edge-bleed` | Fix | `texture-edge-bleed` |
| `normal-map-generator` (existing URL, id `texture-map`) | Normal | `texture-map` |
| `texture-mask-packer` (existing URL) | the standalone packer page, which the Pack stage also hosts | `mask-packer` |

Pure logic, with `node:test` coverage and no DOM:

```
src/game/texture-png.js       raw PNG decode/encode (exact channel bytes; no canvas)
src/game/texture-channels.js  channel planes, inversion, packing, measurements
src/game/texture-presets.js   engine channel layouts + ko/en/ja tooltips + their documentation
src/game/texture-normal.js    height → normal, OpenGL ↔ DirectX, RNM combine, validator
src/game/texture-set.js       filename classification, workflows, PBR validation rules
src/game/texture-fix.js       dilation, mipmaps, power-of-two plan, seam metrics, approximations
```

## Why the raw PNG path exists

A canvas keeps pixels premultiplied. Read a packed ORM texture through
`drawImage`/`getImageData` and every texel whose alpha is 0 comes back as `0,0,0,0` — the
metallic and roughness bytes that were in the file are gone. So PNG inputs are decoded by
`src/game/texture-png.js` (chunk walk with CRC checks, all non-interlaced colour types, bit
depths 1–16, `tRNS`) and channel PNGs are written by the same module (colour type 0, one byte
per texel). Only previews of non-PNG inputs, resampling and the WebGL preview go through the
browser's decoder, and the UI marks those files "decoded by the browser (not byte-exact)".

Limit: 33 554 432 pixels for the exact path (`MAX_TEXTURE_PIXELS`), e.g. 8192×4096. Interlaced
(Adam7) PNGs are rejected with a message instead of being approximated.

## Engine channel layouts (what is documented, and what is not)

`src/game/texture-presets.js` is the single source; the Pack stage and the standalone packer read
it, so "which channel is what" is stated once. Each preset carries the page it rests on, and
`orderSource` says where the channel order actually comes from.

| Preset | R | G | B | A | Order stated by |
|---|---|---|---|---|---|
| `unity-hdrp-mask` | metallic | ambient occlusion | detail mask | smoothness | **Unity HDRP docs** |
| `unity-urp-metallic` | metallic | ignored | ignored | smoothness | **Unity manual** |
| `unreal-orm` | occlusion | roughness | metallic | unused | glTF 2.0 spec (**not Epic**) |
| `godot-orm` | occlusion | roughness | metallic | unused | Godot engine source (**not the Godot manual**) |
| `gltf-metallic-roughness` | occlusion¹ | roughness | metallic | unused | glTF 2.0 spec |

¹ glTF samples occlusion from the R channel of `occlusionTexture`, which may be the same image.

Sources, quoted in the UI as links:

* Unity HDRP — *Mask and detail maps*, section "Mask map":
  <https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/Mask-Map-and-Detail-Map.html>
  The table reads Red → Metallic, Green → Ambient Occlusion, Blue → Detail mask, Alpha → Smoothness.
* Unity Built-in/URP — *Configure reflections with the Standard Shader* (Metallic parameter):
  <https://docs.unity3d.com/Manual/StandardShaderMaterialParameterMetallic.html> — "the **Metallic**
  levels for the material are controlled by the values in the Red channel of the texture, and the
  [Smoothness] levels … by the Alpha channel … (This means the Green and Blue channels are
  ignored)". The Lab therefore labels G and B *ignored* rather than "metallic in RGB"; writing the
  same grey into RGB is equivalent, not required.
* Unreal — Epic documents channel packing and the sRGB setting in *Using Texture Masks in Unreal
  Engine* (<https://dev.epicgames.com/documentation/en-us/unreal-engine/using-texture-masks-in-unreal-engine>):
  "This is commonly referred to as RGB channel packing and is the preferred method …", and "you
  should Disable sRGB as your masks should not be Gamma corrected". **Epic does not document an
  R=AO, G=roughness, B=metallic "ORM" order** — its own worked example uses a different layout
  (R occlusion, G metallic mask, B non-metallic mask, A object mask), and Unreal has no ORM input:
  the channels are split in the material graph. The ORM order comes from glTF 2.0.
* glTF 2.0 (normative) — `material.pbrMetallicRoughness.schema.json`: "The metalness values are
  sampled from the B channel. The roughness values are sampled from the G channel. These values
  **MUST** be encoded with a linear transfer function."; `material.schema.json` `occlusionTexture`:
  "The occlusion values are linearly sampled from the R channel."
  <https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.pbrMetallicRoughness.schema.json>
* Godot 4 — `ORMMaterial3D` exists and takes one texture
  (<https://docs.godotengine.org/en/stable/classes/class_ormmaterial3d.html>), and the manual only
  says "The different color channels of that texture are used for each parameter"
  (<https://docs.godotengine.org/en/stable/tutorials/3d/standard_material_3d.html>) — it never
  states which. The order in this Lab was read from the engine source that generates the shader,
  `scene/resources/material.cpp` (Godot 4.4): `ROUGHNESS = orm_tex.g; METALLIC = orm_tex.b;`
  and `AO = orm_tex.r;`, with the uniform declared `hint_roughness_g`. Verified against the
  source file, **not** run inside the Godot editor.
  Separately documented and surfaced in the Lab's notes: `StandardMaterial3D` can read each map
  from a chosen channel of one texture (`ao_texture_channel`, `roughness_texture_channel`,
  `metallic_texture_channel`), so a non-ORM layout needs no guessing either.

## Normal maps

**Convention.** Tangent space with X = +U (image right), Z out of the surface. `opengl` means
green points up in the image as displayed; `directx` means green points down. The two differ in
the green channel only, and the conversion is `255 − g`, which is its own inverse — a converted
map converts back to the same bytes.

| Engine | Expects | Stated by |
|---|---|---|
| Unity | OpenGL +Y | "Unity uses Y+ normal maps, sometimes known as OpenGL format." (<https://docs.unity3d.com/Manual/StandardShaderMaterialParameterNormalMap.html>) |
| Godot 4 | OpenGL +Y | "Godot requires the normal map to use the X+, Y+ and Z+ coordinates, this is known as OpenGL style." (<https://docs.godotengine.org/en/stable/tutorials/3d/standard_material_3d.html>) |
| Blender | OpenGL +Y | Normal Map node, *Convention*: "Blender uses the OpenGL convention by default … where the Y axis in the green channel points up." (<https://docs.blender.org/manual/en/latest/render/shader_nodes/displacement/normal_map.html>) |
| Unreal | DirectX −Y | **inferred**, and labelled so in the UI: Epic's glTF exporter documents `adjust_normalmaps` — "exported normalmaps will be adjusted from Unreal to glTF convention (i.e. the green channel is flipped)" (<https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/GLTFExportOptions>) — and glTF fixes +Y ("The normal vectors use the convention +X is right and +Y is up"). Epic never writes "−Y" or "DirectX" in the pages that could be read. |

A file cannot be measured to tell which convention it uses: both are valid normal maps. The Lab
says which engine expects which and lets you convert; it never claims to detect it.

**Height → normal.** Gradient of the luminance (or of the alpha channel) with a normalised
kernel, so the same `strength` means the same slope in every kernel:

| Kernel | Response scale | Notes |
|---|---|---|
| Sobel 3×3 | 1/8 | default |
| Scharr 3×3 | 1/32 | more rotation-consistent |
| Sobel 5×5 | 1/128 | smooths noise, loses fine detail |

`wrap` samples across the opposite edge, which is what a tileable texture needs (verified: the
wrapped edge texel equals the same texel computed inside a real 2× repeat). `invertX` / `invertY`
flip a channel; `invertY` is exactly equivalent to switching convention. A flat height map
produces the flat normal `(128,128,255,255)` in every kernel and convention.

The legacy recipe (`primitives.mapTexture`, still used by the classic editor) wrote green with
the opposite sign and never said so; that is DirectX-style. The Lab defaults to OpenGL and names
the convention on screen.

**Combining** uses Reoriented Normal Mapping (Barré-Brisebois & Hill, *Blending in Detail*, 2012):
the detail normal is rotated into the base normal's frame. An RGB blend is not offered — it
flattens both inputs and produces non-unit vectors. A detail texel that is exactly
`(128,128,255)` is the identity rotation and is copied from the base byte for byte, so a flat
detail map cannot introduce rounding drift.

**Validator.** Decodes each texel and measures the two properties that always hold: vectors are
unit length, and blue (Z) is not negative. It reports mean length, worst deviation, the share of
off-unit samples and the lowest blue. It does not guess the convention.

## Inspect / PBR validation

Filenames are classified with ordered rules (`albedo|basecolor|diffuse`, `normal|nrm|_n`,
`roughness|rough`, `smoothness|gloss`, `metallic|metalness`, `ao|occlusion`, `height|disp|bump`,
`emission|emissive`, `orm|arm|rma|mask`, `opacity|alpha`, `specular`), and every assignment is a
drop-down the user can change. The leftover stem is the "set name" the naming check compares.

Checks, each reported with the file and the number behind it: dimension mismatch, missing
required/recommended maps for the chosen workflow, "the parts of a packed map are already here",
duplicate role, non-power-of-two (and optionally non-square), unclassified name, unexpected alpha,
RGB under zero alpha (stated as a fact, since this Lab preserves it), a grey map stored as RGB,
a single-channel map whose RGB actually differ (probably packed), normal maps that are not unit
length or have negative blue, a map that measures like a normal map but is assigned otherwise,
and inconsistent naming.

**Colour space is guidance, not detection.** No ICC profile or gamma curve is interpreted:
albedo/emission/specular are sRGB, and normal/roughness/metallic/AO/height/ORM must be imported
as linear (non-colour) data. The report includes `srgbChunkPresent` as a plain fact read from the
PNG, never as a verdict. Engine statements behind the guidance: Unity's "sRGB (Color Texture)"
import setting, Epic's "Disable sRGB … masks should not be Gamma corrected", and Godot's
"Albedo and color textures should typically have a `source_color` hint. Normal, roughness,
metallic, and height textures typically do not".

## Fix stage

* **Edge bleed (2/4/8/16 px)** — RGB is pushed outwards from texels that carry alpha into the
  transparent ones, one ring per round, each new texel taking the average RGB of the neighbours
  that already have colour. Alpha is never written. This is what stops bilinear filtering and
  mipmaps from pulling the background colour into a sprite's edge.
* **Mipmap preview (1/4 … 1/16)** — plain per-channel box average, the same naive filter a GPU
  uses on a non-premultiplied texture, so an undilated edge visibly darkens as it shrinks.
* **Power-of-two resize** — nearest / down / up / fit (256…4096, optional square), resampled with
  the repo's quality resampler (`src/resample.js` via `Im.resizeQuality`), not a canvas stretch.
* **Seam check** — implemented here in `src/game/texture-fix.js` (`seamMetrics`) because Tile Lab
  was not on this branch; if Tile Lab grows its own seam measurement, the two should be unified on
  one function rather than kept in parallel. The 2×2 repeat plus per-row and per-column heat strips of the difference
  between the last and the first column/row, judged against the variation one texel inside: a
  noisy tileable texture has a large absolute edge difference and no seam, a smooth gradient has a
  small one and an obvious seam. Saves the measurements as JSON.
* **Approximations, labelled as such** — height from luminance or from edge energy, occlusion from
  height (not ray-traced), emission mask by threshold/luminance, mask from alpha/luminance/colour.

## Export stage

Sequential, cancellable batch: **resize → bleed → encode** (PNG keeps exact bytes; WebP/JPEG go
through the browser encoder). Bleeding runs after resizing on purpose: a resize goes through a
canvas, which discards colour under transparent texels, so the bleed has to be the last pixel
step. One file at a time, so memory stays bounded; output is one ZIP (or the single file).

The check report is generic JSON in the Game Labs envelope — `meta.tool`, `toolVersion`,
`schemaVersion`, `engineTarget` — plus per-texture measurements and the issue ids with their
messages. No `.tres`/`.meta`/`.uasset` look-alikes are produced anywhere in this Lab.

## Material preview

WebGL2 with hand-written shaders (no library, no new CDN): sphere / cube / plane, albedo, normal,
roughness, metallic, AO and emission, orbit by drag or arrow keys, light angle and tiling as
sliders (so there is a keyboard and numeric path for everything the canvas does). Roughness,
metallic and occlusion are read through a channel selector, so one ORM texture drives all three
exactly as the chosen preset says. Labelled on screen as **"preview approximation (GGX, one light
+ ambient)"**: one directional light, a flat ambient term, no shadows, no image-based lighting.
Textures are uploaded straight from the files as `ImageBitmap`s (no RGBA copies) and every GL
object is deleted when a map changes or the stage is left; without WebGL2 the stage explains
itself and every other stage keeps working.

## Memory

Per file the Lab keeps measurements, a thumbnail URL and nothing else. Full RGBA is decoded for
one operation at a time and dropped in a `finally`. Previews come from an exact nearest-sampled
reduction (≤512 px, at most three cached ≈ 3 MB) rather than the browser's scaler, because a
resized `ImageBitmap` is premultiplied and would show black where a packed channel still has
data. Exports always re-run the same pure function on the full-resolution exact pixels.

## Sharing settings

The Normal stage reads `strength`, `kernel`, `convention` and `wrap=1` from the URL query, so a
link can carry a setting (never image data). There is no "copy settings link" button yet; the
query is read, not written.

## Limitations

* The exact-byte path covers PNG. JPEG/WebP/AVIF/HEIC are decoded by the browser, cannot carry
  channel data under zero alpha, and are marked in the UI.
* Interlaced PNG and 16-bit output are not supported (16-bit input keeps its high byte).
* Colour space is guidance; no profile or gamma is detected.
* The convention of an existing normal map cannot be detected — only converted.
* Occlusion, height and emission helpers are approximations, not bakes.
* The material preview is not an engine renderer and must not be used to approve lighting.
* Nothing here was run inside Unity, Unreal or Godot: the channel orders and conventions rest on
  the documentation and engine source quoted above. **Engine import itself is UNVERIFIED.**

## Verification

Measured on this branch. Browser rows were driven in Chromium against the built site and the
downloaded files were re-opened with Pillow/numpy — never read back from the UI.

| What was measured | Method | Result | Status |
|---|---|---|---|
| Channel unpack is byte-identical per channel (64×64 ORM, random bytes) | Playwright download → numpy compare with the source array | max difference 0 on R, G, B and A | VERIFIED |
| RGB survives fully transparent texels | same run, 2048 alpha-0 texels, explicit `(1,2,3,0)` corner | all 2048 equal to the source, corner R = 1 | VERIFIED |
| Channel files are single-channel PNGs | Pillow mode/size | `L`, 64×64 (colour type 0) | VERIFIED |
| Edge bleed never writes alpha | numpy compare of the alpha plane | 0 differing bytes | VERIFIED |
| Edge bleed changes RGB only where alpha is 0 | numpy mask compare | 448 texels changed, none with alpha > 0; 448 = exactly four rings around a 24×24 square | VERIFIED |
| Bleed colour is the sprite's own | pixel probe at the first ring | `(210,40,30,0)` | VERIFIED |
| OpenGL ↔ DirectX differs in green only | two downloads, per-channel numpy compare | `dx.g == 255 − gl.g` exactly; R, B, A identical | VERIFIED |
| Converted normal maps decode to unit vectors | numpy on the downloaded PNG | mean length 1.0001, worst deviation 0.0002 | VERIFIED |
| Blue is never negative | numpy min | min blue 255 on the test ramp (≥ 128 required) | VERIFIED |
| Flat height → flat normal | `tests/game-texture-normal.test.mjs` (all 3 kernels × 2 conventions) and the ported browser check in `tests/recipes-browser.py` | `(128,128,255,255)` everywhere | VERIFIED |
| RNM identity | unit test | flat detail returns the base byte for byte; flat base returns the detail | VERIFIED |
| RNM output is unit length | unit test on a combined pair | worst deviation < 0.01, blue ≥ 128 | VERIFIED |
| Kernel normalisation | unit test on a 1-unit-per-pixel ramp | red within 1 byte across Sobel 3×3 / Scharr / Sobel 5×5 | VERIFIED |
| Wrap sampling equals a real repeat | unit test against a tiled reference | identical bytes at the wrapped edge; interior untouched | VERIFIED |
| Packed output of the Pack stage | Playwright download from inside the Lab | Unreal ORM preset over AO 10 / roughness 80 / metallic 220 → `(10,80,220,255)` | VERIFIED |
| The standalone packer still behaves | same module, its own route | custom mapping `(220,10,80,0)`, Unreal ORM `(10,80,220,255)`, inverted R `(245,80,220,255)` | VERIFIED |
| Batch optimiser output | ZIP listing after a 4-file run | 4 PNGs, one per input, one archive | VERIFIED |
| Check report | downloaded JSON | `schemaVersion` 1, `engineTarget` generic, `alpha.zeroPixels` = 2048 (matches the fixture), `exactChannels` true | VERIFIED |
| Godot ORM channel order | `scene/resources/material.cpp` (4.4) read directly | `AO = orm_tex.r`, `ROUGHNESS = orm_tex.g`, `METALLIC = orm_tex.b` | VERIFIED against source, UNVERIFIED in-engine |
| Unreal −Y convention | chained official statements (glTF exporter + glTF spec) | labelled "inferred" in the UI | UNVERIFIED (not stated by Epic) |
| Import into Unity / Unreal / Godot | — | not attempted | UNVERIFIED |
| Phone layout | Chromium at 390 and 320 px, Lab and Channels stages | `scrollWidth == innerWidth`, no horizontal scroll | VERIFIED |
| Roughness → smoothness inversion | Playwright: invert G, download, numpy compare | saved plane equals `255 − roughness` exactly, and the stage shows the in → out pair | VERIFIED |
| Unit coverage | `node --test tests/game-texture*.test.mjs` | 21 tests, 0 failures | VERIFIED |
| Suite integration | `tests/task-browser.py` (TEST_URL on this branch's port) | 141 checks pass, including 15 new Texture Lab checks | VERIFIED |
| WebGL2 preview | Chromium with SwiftShader | renders; texture-unit binding verified by eye against the source maps | VERIFIED (software GL only) |
