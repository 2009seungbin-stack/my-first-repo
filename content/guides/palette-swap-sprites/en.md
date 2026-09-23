To palette-swap a sprite (enemy tiers, team colours, skins) you either **bake** a recoloured copy of the image for each variant, or draw the sprite as an **index map** and let a small shader look each pixel's colour up in a **palette texture**, one row per variant. Baking works in every engine with no shader. The shader route keeps one texture for any number of variants and can switch palettes at runtime. It only stays exact if both textures are sampled with nearest filtering and imported without lossy compression or colour conversion.

This guide builds the shader route in Godot 4 and Unity 6 (URP 2D), bakes variants in Phaser and PixiJS, and shows the filtering mistake that breaks index maps.

![Five palette variants of one Kenney alien drawn by one Godot shader](shot:engine-palette-swap-godot "Rendered by Godot 4.7.2 (Compatibility renderer): one 48×24 index map and one 7×5 palette texture, five Sprite2D nodes sharing one ShaderMaterial, each with its own palette row. Every pixel matched the expected palette colour exactly. Art: Kenney Pixel Platformer (CC0).")

## Pick an approach {#approaches}

| Approach | How it works | Good for | Watch out for |
|---|---|---|---|
| Baked variants | Recolour the PNG once per variant, before or at load time | Few variants, any engine, no shader access | One texture per variant: more memory, more batch breaks |
| Index map + palette texture | Red channel stores a palette index; the shader reads row *n* of a palette image | Many variants, runtime swaps, player-picked colours | Needs nearest filtering and lossless, non-sRGB import |
| Colour-match shader | The shader compares each pixel with a list of colours and replaces matches | Quick swaps on unchanged art | A loop per pixel; breaks when filtering or compression changes a colour |
| Gradient map | The pixel's brightness picks a colour from a gradient | Monochrome art, status effects | Parts with the same brightness get the same colour |

Index maps are the most robust shader route, so we start there.

## Palette swap with a shader in Godot 4 {#godot-shader}

The example is Kenney's green alien: two 24×24 frames, seven colours (outline, a four-step body ramp, helmet, white).

:::steps
1. **Order the palette.** List the sprite's colours in a fixed order, each ramp from dark to light: outline, body (4 shades), helmet, white. The position is the column index.
2. **Paint the palette texture.** A PNG as wide as the palette with one row per variant. Row 0 holds the original colours; the other rows repaint the same columns (blue, pink, red elite, gold boss).
3. **Build the index map.** Replace every opaque pixel with `Color8(column, 0, 0, alpha)`; transparent pixels stay transparent. `make_index_map.gd` below does it. The result looks almost black.
4. **Check the import.** In the **Import** dock keep both PNGs on **Compress > Mode: Lossless** (the 2D default) with **Mipmaps > Generate** off. VRAM compression changes the index values.
5. **Create the shader.** Save `palette_swap.gdshader` (below), create a **ShaderMaterial** with it, and assign `palettes.png` to its **Palette** parameter.
6. **Set Nearest filtering.** On each Sprite2D or AnimatedSprite2D set **CanvasItem > Texture > Filter** to **Nearest**, or set **Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter** to **Nearest**.
7. **Pick a row per node.** Give every enemy the same material and choose its variant with `set_instance_shader_parameter("palette_row", n)`, at any time.
:::

```glsl
// palette_swap.gdshader — Godot 4 (canvas_item)
// The sprite texture is an INDEX MAP: its red channel holds a palette index 0–255.
// `palette` holds one palette per row: column = colour index, row = variant.
shader_type canvas_item;

uniform sampler2D palette : source_color, filter_nearest;
// Per node: set_instance_shader_parameter("palette_row", 2). One shared material for every enemy.
instance uniform int palette_row = 0;

varying vec4 tint; // vertex colour, so modulate / self_modulate still work

void vertex() {
	tint = COLOR;
}

void fragment() {
	vec4 src = texture(TEXTURE, UV);              // set the node's texture_filter to Nearest
	int index = int(round(src.r * 255.0));
	vec4 swapped = texelFetch(palette, ivec2(index, palette_row), 0);
	COLOR = vec4(swapped.rgb, src.a) * tint;
}
```

`texelFetch` reads one exact texel, so neighbouring palette colours never blend. The `tint` varying keeps `modulate` working for hit flashes and fades.

The converter, run once with `godot --headless --path . --script res://make_index_map.gd`:

```gdscript
# make_index_map.gd — reads the sprite and the palette strip (row 0 = the sprite's own colours,
# in ramp order) and writes an index map whose red channel is the column of each pixel's colour.
extends SceneTree

func _init() -> void:
	var sprite := Image.load_from_file("res://alien_green.png")
	var palette := Image.load_from_file("res://palettes.png")
	sprite.convert(Image.FORMAT_RGBA8)
	var lookup := {}
	for x in palette.get_width():
		lookup[palette.get_pixel(x, 0).to_rgba32() | 0xff] = x   # key: RGB with alpha forced to 255
	var out := Image.create(sprite.get_width(), sprite.get_height(), false, Image.FORMAT_RGBA8)
	var missing := 0
	for y in sprite.get_height():
		for x in sprite.get_width():
			var c := sprite.get_pixel(x, y)
			if c.a8 == 0:
				continue                                  # stays transparent
			var key := c.to_rgba32() | 0xff
			if not lookup.has(key):
				missing += 1
				continue
			out.set_pixel(x, y, Color8(lookup[key], 0, 0, c.a8))
	out.save_png("res://alien_index_gd.png")
	print("index map written, colours not in the palette: ", missing)
	quit()
```

Missing colours are usually anti-aliased edges; clean them up first (see [fixing off-palette pixels](guide:fix-ai-generated-pixel-art)). The per-enemy script:

```gdscript
# enemy.gd — on a Sprite2D whose texture is the index map and whose material uses palette_swap.gdshader
extends Sprite2D

@export var tier := 0   # row in palettes.png

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	set_instance_shader_parameter("palette_row", tier)
```

### Why an instance uniform {#instance-uniform}

A plain `uniform` forces one material per variant, and every material change breaks 2D batching. In our Godot 4.7.2 test, 200 sprites sharing one material with `instance uniform` rows drew in **1** draw call; with one duplicated material each they took **200**, in both the Compatibility and Forward+ renderers. Per-instance uniforms take scalars and vectors only, at most 16 per shader.

### Without an index map: colour matching {#color-match}

If you cannot convert the art, compare colours in the shader. This works on the original PNG (pixel-exact in our test), but any compression, filtering or resampling breaks the match.

```glsl
// color_match.gdshader — Godot 4 (canvas_item)
// Every pixel whose colour matches from_colors[i] becomes to_colors[i].
shader_type canvas_item;

const int MAX_COLORS = 8;
uniform vec4 from_colors[MAX_COLORS] : source_color;
uniform vec4 to_colors[MAX_COLORS] : source_color;
uniform int color_count = 0;
uniform float tolerance = 0.004; // about 1/255: exact matches only

varying vec4 tint;

void vertex() {
	tint = COLOR;
}

void fragment() {
	vec4 src = texture(TEXTURE, UV);
	vec3 rgb = src.rgb;
	for (int i = 0; i < color_count; i++) {
		if (distance(src.rgb, from_colors[i].rgb) < tolerance) {
			rgb = to_colors[i].rgb;
			break;
		}
	}
	COLOR = vec4(rgb, src.a) * tint;
}
```

Set the arrays with `material.set_shader_parameter("from_colors", [...])`, padded to `MAX_COLORS`.

### Gradient maps {#gradient-map}

A gradient map reads `texture(gradient, vec2(brightness, 0.5))` from a `GradientTexture1D` (Gradient **Interpolation Mode: Constant** for hard steps). It needs no preparation but only knows brightness: on the alien, the pale helmet and the body highlight landed in the same band. Use it for monochrome art and status effects, not multi-part characters.

## Keep ramps consistent {#ramps}

- **Same number of steps per ramp.** Four body shades need four replacement shades, dark to light. Squeezing a three-step ramp into four columns flattens the shading.
- **Keep the lightness steps.** Change the hue and keep each step about as bright as the original. A midtone lighter than its highlight turns the shading inside out.
- **Separate slots for separate parts.** Outline and helmet have their own columns, so a variant can keep or change them (the gold boss changes both). Parts that share one colour can never be recoloured independently.
- **One palette for every frame.** Extract it from all frames together, or a colour that only appears in frame 7 is missing from the index.
- **Hue-shift the ramps.** Good ramps drift cooler in the shadows and warmer in the highlights. Lospec's palette list has tested ramps.

## Filtering and import artefacts {#filtering}

An index map is data, not colour: anything that blends neighbouring texels creates wrong indices, and those pick colours from unrelated palette slots.

![Nearest vs linear filtering of the same index map in Godot](shot:engine-palette-filter-godot "Rendered by Godot 4.7.2: the same index map and palette row, left with Nearest filtering (exact), right with Linear filtering on the index map. Blended indices pick other palette columns, so the outline turns into a halo of body and helmet colours. Art: Kenney (CC0).")

- **Nearest on the index map.** Switching only the index map to Linear changed 5,350 of 20,736 screen pixels above. See also [crisp pixel art in Godot](guide:godot-4-pixel-art-blurry-jitter).
- **Exact reads on the palette.** `texelFetch` / `LOAD_TEXTURE2D`, or Point sampling at texel centres.
- **No mipmaps, no lossy or GPU compression** on the index map.
- **No colour-space conversion** on the index map. Godot left it untouched in both renderers we tried; Unity's Linear colour space decodes an sRGB-imported index map (see below).
- **Indexed PNGs don't help.** Engines expand them to plain colours on import; the index has to be written into a channel.
- **Scale the node, not the file.** Resampling the index map in an image editor blends indices.

## Unity 6 (URP 2D Renderer) {#unity}

This unlit sprite shader compiled without errors in Unity 6000.5.3f1 with URP 17.5.0, and a 2D Renderer camera drew all five variants pixel-exact in both Gamma and Linear colour space. SpriteRenderer **Color** and **Flip X** still work.

```text
// PaletteSwap2D.shader — Unity 6, URP 2D Renderer (unlit sprite)
// _MainTex is an INDEX MAP (red channel = palette index 0–255), imported with sRGB OFF.
// _Palette has one palette per row (column = index), row 0 = the TOP row of the PNG.
Shader "Custom/PaletteSwap2D"
{
    Properties
    {
        [MainTexture] _MainTex ("Index Map", 2D) = "white" {}
        [NoScaleOffset] _Palette ("Palette", 2D) = "white" {}
        _PaletteRow ("Palette Row", Float) = 0
    }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "RenderPipeline" = "UniversalPipeline" }
        Blend SrcAlpha OneMinusSrcAlpha, One OneMinusSrcAlpha
        Cull Off
        ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_MainTex);  SAMPLER(sampler_MainTex);
            TEXTURE2D(_Palette);
            float4 _Palette_TexelSize;          // (1/width, 1/height, width, height)

            CBUFFER_START(UnityPerMaterial)
                float _PaletteRow;
            CBUFFER_END

            struct Attributes { float3 positionOS : POSITION; float2 uv : TEXCOORD0; half4 color : COLOR; };
            struct Varyings  { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; half4 color : COLOR; };

            Varyings vert (Attributes v)
            {
                Varyings o;
                // unity_SpriteProps.xy = flipX/flipY, unity_SpriteColor = SpriteRenderer.color
                o.positionCS = TransformObjectToHClip(float3(v.positionOS.xy * unity_SpriteProps.xy, v.positionOS.z));
                o.uv = v.uv;
                o.color = v.color * unity_SpriteColor;
                return o;
            }

            half4 frag (Varyings i) : SV_Target
            {
                half4 src = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv);   // Filter Mode: Point
                int index = (int)round(src.r * 255.0);
                int row = (int)_Palette_TexelSize.w - 1 - (int)_PaletteRow;     // Unity rows start at the bottom
                half4 swapped = LOAD_TEXTURE2D(_Palette, int2(index, row));
                return half4(swapped.rgb, src.a) * i.color;
            }
            ENDHLSL
        }
    }
}
```

Import settings matter more than the shader:

- **Index map:** Texture Type **Sprite (2D and UI)**, **sRGB (Color Texture)** off, **Filter Mode** Point (no filter), **Compression** None, **Generate Mipmaps** off. With sRGB left on in a Linear project, our whole sprite came out in the outline colour: the small index values were decoded towards 0.
- **Palette texture:** Texture Type **Default**, sRGB on, Filter Mode Point, Compression None, and **Non-Power of 2** set to **None**. With the Default type's defaults (To nearest, Bilinear, Compressed), our 7×5 palette was imported rescaled to 8×4, which moves every column.
- **One material per variant:** a material asset per tier with its **Palette Row**. A `MaterialPropertyBlock` also works, but Unity's manual lists "mustn't use MaterialPropertyBlocks" among the SRP Batcher's conditions.

In Shader Graph (**Assets > Create > Shader Graph > URP > Sprite Unlit Shader Graph**): sample `_MainTex`, multiply R by 255, **Round**, add 0.5 and divide by the palette width from a **Texture Size** node for U; use `1 − (row + 0.5) / height` for V. Read the palette with **Sample Texture 2D LOD** (LOD 0) and a **Sampler State** set to **Point** into **Base Color**, and send the main texture's A to **Alpha**.

## Phaser and PixiJS: bake variants at load time {#web}

On the web the simplest robust route is baking: draw the image to a canvas, swap colours in its pixel data, and register the result as a new texture. This ran unchanged in Phaser 3.90 and 4.2, including an animation played from the baked sheet:

```js
// palette-bake.js — works in Phaser 3.90 and 4.x
// from / to: arrays of 0xRRGGBB, same length (from[i] becomes to[i]).
function bakePalette(scene, srcKey, newKey, from, to) {
  const srcTex = scene.textures.get(srcKey);
  const img = srcTex.getSourceImage();
  const tex = scene.textures.createCanvas(newKey, img.width, img.height);
  const ctx = tex.getContext();
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const map = new Map(from.map((c, i) => [c, to[i]]));
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;                       // skip transparent pixels
    const out = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (out === undefined) continue;                    // colour not in the swap list
    d[i] = out >> 16; d[i + 1] = (out >> 8) & 255; d[i + 2] = out & 255;
  }
  ctx.putImageData(data, 0, 0);
  // copy the frame rectangles, so animations can use the same frame names
  for (const name of srcTex.getFrameNames()) {
    const f = srcTex.get(name);
    tex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  }
  tex.refresh();
  return tex;
}
// in create(): bakePalette(this, 'alien', 'alien-red', GREEN, RED);
//              this.add.sprite(100, 100, 'alien-red', 1);
```

The PixiJS 8.21 version is the same loop with a different last step:

```js
// PixiJS 8 — returns a new Texture with the colours swapped
function bakePaletteTexture(texture, from, to) {
  const img = texture.source.resource;                  // the loaded image
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const map = new Map(from.map((c, i) => [c, to[i]]));
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const out = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (out === undefined) continue;
    d[i] = out >> 16; d[i + 1] = (out >> 8) & 255; d[i + 2] = out & 255;
  }
  ctx.putImageData(data, 0, 0);
  const baked = Texture.from(canvas);
  baked.source.scaleMode = 'nearest';                   // pixel art: no filtering
  return baked;
}
```

Cut frames with `new Texture({ source: baked.source, frame: new Rectangle(x, y, w, h) })`. In both engines a canvas stores premultiplied colour, so semi-transparent pixels can drift by a shade (opaque and fully transparent ones stay exact). Each variant is also its own texture and costs extra batches; with many variants, bake them into one atlas. For crisp scaling see [pixel art in Phaser and PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi).

## Baked variants vs runtime shader {#trade-offs}

- **Memory:** baking stores a full sheet per variant; the shader route stores one index map plus a palette a few pixels in size.
- **Draw calls:** a shared material with per-instance rows batches; baked variants batch only when they share an atlas page.
- **Runtime changes:** player-chosen colours and status tints are one parameter with a shader, a re-bake without.
- **Portability:** baked PNGs work everywhere; index maps look black outside the game and need the shader wherever they are drawn.
- **Rule of thumb:** a handful of fixed variants, bake; many variants or runtime choice, index map and palette.

:::nerulio tool=pixel-lab
Nerulio's Pixel Lab does the art side of a palette swap in the browser, with no upload: one palette for all frames, ramp-correct recolours and baked variants. It does not write an index map or palette texture yet; for the shader route, export its palette to fix the column order and run the converter above.
- **Palette**: extract one palette from every frame at once, sort it, lock colours, and export `.gpl`, `.hex` or JSON.
- **Recolour > Ramp swap**: pick the source ramp; it is mapped onto the target ramp by lightness order, so the darkest shade stays darkest. **Hue range** and **Status tint** (frozen, poison, burn…) work on the whole palette.
- **Export team variants (ZIP)**: type bases such as `red,blue,gold` or `#RRGGBB`; you get one folder per variant with every frame and that variant's `.gpl`.
- For a quick one-off swap, the [palette swap tool](tool:palette-swap) replaces picked colours with a tolerance and an option to keep the shading offset, on one image or a batch.
:::

![Nerulio Pixel Lab recolour stage](shot:lab-pixel-palette "Nerulio Pixel Lab, Recolour stage: one palette for all frames, with Ramp swap, Hue range, Status tint and the team-variant export.")

## FAQ {#faq}

### How do I palette swap a sprite in Godot 4? {#faq-godot}
Convert the sprite to an index map (palette index in the red channel), put the palettes in a small texture with one row per variant, and use a `canvas_item` shader that reads `texelFetch(palette, ivec2(index, row), 0)`. Set the node's texture filter to Nearest and pick the row per node with an `instance uniform`.

### Why does my palette swap shader show wrong colours at the edges? {#faq-edges}
The index map is being filtered. Linear filtering, mipmaps or lossy compression blend neighbouring indices into values that point at other palette columns. Use Nearest (Point) filtering, no mipmaps and lossless import, and read the palette with an exact texel fetch.

### Should I bake palette variants or use a shader? {#faq-bake}
Bake when you have a few fixed variants or an engine where custom shaders are awkward. Use a shader when you need many variants, runtime colour choice or effects like hit flashes: it keeps one texture and lets sprites with different palettes share one material.

### Why are my palette colours wrong in Unity but fine in Godot? {#faq-unity}
In Unity's Linear colour space an index map imported with **sRGB (Color Texture)** on is converted before the shader reads it, so the index values change. Turn sRGB off on the index map, keep it on for the palette, and set the palette's **Non-Power of 2** to **None** so Unity does not rescale it.

### Can I use an indexed PNG from Aseprite as the index map? {#faq-indexed-png}
Not directly. Engines expand indexed PNGs to ordinary colours on import, so the shader never sees the index. Draw in Indexed mode if you like, then write the index into the red channel with a converter such as `make_index_map.gd`.

## Sources {#sources}

- [Shading language — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html) (uniform hints `source_color` and `filter_nearest`, per-instance uniforms, uniform arrays)
- [Built-in functions — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shader_functions.html) (`texelFetch`)
- [CanvasItem shaders — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html) (`TEXTURE`, `UV`, `COLOR`)
- [Importing images — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html) (Lossless mode, VRAM compression and pixel art)
- [Default texture import settings — Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-default.html) (sRGB (Color Texture), Non Power of 2, Filter Mode)
- [SRP Batcher materials — Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/SRPBatcher-Materials.html) (MaterialPropertyBlock condition)
- [Sampler State node — Shader Graph 17.5](https://docs.unity3d.com/Packages/com.unity.shadergraph@17.5/manual/Sampler-State-Node.html) and [Sample Texture 2D LOD node](https://docs.unity3d.com/Packages/com.unity.shadergraph@17.5/manual/Sample-Texture-2D-LOD-Node.html)
- [CanvasTexture — Phaser 4 API documentation](https://docs.phaser.io/api-documentation/class/textures-canvastexture) (`getContext`, `add`, `refresh`)
- [Textures — PixiJS 8 guide](https://pixijs.com/8.x/guides/components/textures) (`Texture.from`, texture sources)
- [Lospec palette list](https://lospec.com/palette-list) (tested ramps)
- Art: [Pixel Platformer by Kenney](https://kenney.nl/assets/pixel-platformer) (CC0)
