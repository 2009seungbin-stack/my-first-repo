To light a 2D sprite with a normal map, give the engine two images with the same layout: the colour sprite and a normal map whose pixels store which way each part of the surface faces. In **Godot 4**, put both into a **CanvasTexture** (Diffuse and Normal Map) and light it with a **PointLight2D** that has a texture and a **Height** above 0. In **Unity 6**, use URP with the **2D Renderer**, add the normal map to the sprite as a **Secondary Texture** named `_NormalMap`, and set the **Normal Maps → Quality** of each Light 2D to **Fast** or **Accurate**. Both engines expect OpenGL-style (Y+) normal maps. For pixel art, sample the normal map with nearest filtering, like the sprite.

Everything below was run in Godot 4.7.2 and Unity 6000.5.3f1 (URP 17.5.0) with Kenney's CC0 *Tiny Dungeon* tiles and normal maps made in Nerulio's Texture Lab.

![Two renders of the same dungeon scene and light: flat textures on the left, CanvasTexture with normal maps on the right, with the wall around the light enlarged below](shot:engine-normal2d-compare "Rendered by Godot 4.7.2 (Compatibility renderer): PointLight2D at height 30 px with PCF5 shadows from LightOccluder2D. Left: plain textures. Right: the same textures as CanvasTexture with normal maps. The bricks catch the light on the sides that face it. Art: Kenney Tiny Dungeon (CC0).")

## How 2D normal mapping works {#how-it-works}

A normal map stores, for each sprite pixel, which way the surface faces: red is the left–right tilt, green the up–down tilt, blue how much it faces the viewer. Flat, front-facing pixels are lavender `(128, 128, 255)`. The engine brightens the pixels that face the light, so a brick wall lights its left edges when the torch is on the left and its right edges when the torch moves.

Two details decide whether it looks right:

- **Convention.** Godot and Unity both read green as "facing up" (OpenGL, Y+). A DirectX-style map from an Unreal-oriented tool lights from the wrong side vertically. See [OpenGL vs DirectX normal maps](guide:opengl-vs-directx-normal-maps) for how to spot and flip it.
- **Light height.** A 2D light sits on the sprites' plane. Without a virtual height it arrives exactly sideways, and front-facing pixels get almost none of it.

## Set it up in Godot 4 {#godot}

:::steps
1. **Get a normal map with the same layout as the sprite.** One normal pixel per sprite pixel, same size, same frame positions for a sheet, OpenGL (Y+) convention. The [ways to make one](#making-normal-maps) are below.
2. **Set nearest filtering for pixel art.** Set *Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter* to **Nearest**, or set *Texture → Filter* to **Nearest** on the node. A CanvasTexture samples its diffuse and normal map with the same filter.
3. **Create a CanvasTexture.** On the Sprite2D (or AnimatedSprite2D frame, TileSet atlas, Control…), click *Texture → New CanvasTexture*. Put the sprite in *Diffuse → Texture* and the normal map in *Normal Map → Texture*. Specular is optional.
4. **Darken the scene.** Add a **CanvasModulate** with a dark colour. It sets the colour of everything no light reaches.
5. **Add a PointLight2D and give it a Texture.** A PointLight2D without a texture lights nothing. A radial *GradientTexture2D* works; the light's size is the texture's size × *Texture Scale*.
6. **Raise the light's Height.** For a PointLight2D, *Height* is in pixels (at 100, it reaches a point 100 px away at 45°). Try 20–100 and move the light around. For a DirectionalLight2D, *Height* goes from 0 (parallel to the plane) to 1 (straight down).
7. **Add shadows if you want them.** Turn on *Shadow → Enabled* on the light. Select the Sprite2D and use *Sprite2D → Create LightOccluder2D Sibling*, or draw an OccluderPolygon2D by hand. *Shadow → Filter* offers None, PCF5 and PCF13.
8. **Test with a moving light.** Bumps should catch the light on the side facing it. If they light from the opposite side vertically, the map is DirectX-style: flip its green channel.
:::

The same scene in code, as it was run in Godot 4.7.2:

```gdscript
# lit_scene.gd: attach to a Node2D. Builds a normal-mapped sprite, a light and a shadow.
extends Node2D

func _ready() -> void:
	# 1. Diffuse + normal map in one CanvasTexture
	var tex := CanvasTexture.new()
	tex.diffuse_texture = preload("res://art/knight.png")
	tex.normal_texture = preload("res://art/knight_n.png")  # OpenGL (+Y) normal map
	var knight := Sprite2D.new()
	knight.texture = tex
	knight.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST  # pixel art: diffuse AND normal
	knight.scale = Vector2(4, 4)
	knight.position = Vector2(288, 160)
	add_child(knight)

	# 2. A shadow caster at the sprite's feet
	var occluder := LightOccluder2D.new()
	var poly := OccluderPolygon2D.new()
	poly.polygon = PackedVector2Array([Vector2(-5, 4), Vector2(5, 4), Vector2(5, 7), Vector2(-5, 7)])
	occluder.occluder = poly
	knight.add_child(occluder)

	# 3. Darken everything the light does not reach
	var ambient := CanvasModulate.new()
	ambient.color = Color(0.15, 0.15, 0.2)
	add_child(ambient)

	# 4. A point light: it needs a texture, and a height for normal mapping
	var falloff := Gradient.new()
	falloff.set_color(0, Color.WHITE)   # centre
	falloff.set_color(1, Color.BLACK)   # edge
	var shape := GradientTexture2D.new()
	shape.width = 256              # light size = texture size x texture_scale
	shape.height = 256
	shape.gradient = falloff
	shape.fill = GradientTexture2D.FILL_RADIAL
	shape.fill_from = Vector2(0.5, 0.5)
	shape.fill_to = Vector2(1.0, 0.5)
	var light := PointLight2D.new()
	light.texture = shape          # without a texture the light draws nothing
	light.texture_scale = 2.0
	light.height = 30.0            # pixels; at 0 flat normal-mapped areas stay dark
	light.shadow_enabled = true
	light.shadow_filter = Light2D.SHADOW_FILTER_PCF5
	light.position = Vector2(200, 110)
	add_child(light)
```

> **The default GradientTexture2D is only 64×64.** With it, the light above has a radius of 64 px and misses a sprite 100 px away. That is why the snippet sets `width` and `height`.

### Light height: the most common "normal maps do nothing" cause {#light-height}

The PointLight2D *Height* default is **0**. At 0 the light comes in parallel to the sprites, so a normal-mapped pixel that faces the viewer gets almost no light. In our scene, normal maps with the light at height 0 left the frame nearly black (mean brightness 22 of 255, against 84 without normal maps); the Godot manual also tells you to increase *Height*. At 30 px the relief appears. At 150 px the lighting is brighter and flatter again, because the light now comes from almost straight above.

A normal-mapped sprite is usually darker than the same sprite without one, because an unmapped sprite is treated as facing the light fully. Raise the light's *Energy* rather than removing the normal map.

### Pixel art: nearest filtering on the normal map too {#pixel-art}

A blurred normal map smears highlights across every pixel edge, even when the colour is sharp. We lit a 3× scaled sprite with a DirectionalLight2D, so the lighting depends only on the normal:

- Node *Texture Filter* **Nearest**: every 3×3 screen block was one flat colour (0 of 9,216 varied), so both images were sampled nearest.
- Node filter **Linear**: all 9,216 blocks varied.
- The CanvasTexture's own *Texture Filter*, when not *Inherit*, overrides the node for the diffuse and the normal map alike.

So one setting covers both images. Make the normal map at the sprite's native resolution and keep it lossless: VRAM compression and mipmaps both average neighbouring normals. For the rest of the pixel-art setup, see [Godot 4 pixel art blurry or jittering](guide:godot-4-pixel-art-blurry-jitter).

### Sprite sheets, AnimatedSprite2D and TileMaps {#sheets-and-tilemaps}

The normal map must follow the sprite's layout frame for frame. With a CanvasTexture, every usual way of drawing a sheet keeps it. Lit from the left, then the right, these pixels changed:

- **AnimatedSprite2D** with SpriteFrames of **AtlasTexture** regions whose *Atlas* is the CanvasTexture: 2,864 of 16,384 pixels.
- **Sprite2D** with *Hframes*/*Vframes* on a CanvasTexture: the same.
- **TileMapLayer** whose TileSetAtlasSource *Texture* is a CanvasTexture: 12,800 of 16,384.
- Control, the same frames cut from the plain PNG: 0 pixels.

If you pack sprites into an atlas, pack the normal maps with the identical layout, or generate the normal map from the finished atlas. Trimming and rotation must match too; see [sprite sheet vs texture atlas](guide:sprite-sheet-vs-texture-atlas).

*Specular* is optional. A greyscale *Specular → Texture* marks the shiny pixels (metal, wet stone), *Shininess* sets how tight the highlight is, and *Color* tints it.

## Set it up in Unity 6 (URP 2D Renderer) {#unity}

Unity's 2D lights need URP's **2D Renderer**. The **Universal 2D** project template already has it (the template shipped with 6000.5.3f1 contains `Assets/Settings/Renderer2D.asset` and a scene with a *Global Light 2D*). In an existing URP project, use *Assets → Create → Rendering → URP Asset (with 2D Renderer)* and make that asset the active render pipeline in *Project Settings → Graphics* (and *Quality*, if a quality level overrides it).

1. **Import the normal map.** Set *Texture Type* to **Normal Map**; this also turns sRGB off, as the manual asks. For pixel art, set *Filter Mode* to **Point** and *Compression* to **None**.
2. **Attach it to the sprite.** Select the sprite texture and open the *Sprite Editor*. Choose **Secondary Textures** from the dropdown, click **+**, and set *Name* to `_NormalMap` and *Texture* to the normal map. Unity samples it with the sprite's UVs, so the layout must match.
3. **Use a lit material.** Under the 2D Renderer, a new Sprite Renderer gets **Sprite-Lit-Default**, which reads `_NormalMap`.
4. **Add a light.** Use *GameObject → Light → Spot Light 2D* (in the API this light type is still called `Point`).
5. **Turn normal maps on for that light.** Open the **Normal Maps** foldout and set *Quality* to **Fast** or **Accurate**. It is **Disabled** on every new light. *Distance* (default 3) is the light's simulated height above the sprite, like Godot's *Height*. (The manual says *Use Normal Map* / *Normal Map Quality*; the 6000.5.3f1 Inspector shows *Quality* and *Distance*.)
6. **Lower the global light.** The template's *Global Light 2D* has intensity 1, which lights everything evenly and hides the relief. Drop it to about 0.1–0.3.
7. **Shadows (optional).** Add a **Shadow Caster 2D** component to the sprites that should block light, and set *Strength* in the light's *Shadows* section.

To attach normal maps from an editor script, this is the code we ran in 6000.5.3f1 batch mode:

```csharp
// Editor/NormalMapImport.cs: pixel-art sprite + its normal map as the _NormalMap secondary texture
using UnityEditor;
using UnityEngine;

public static class NormalMapImport
{
    public static void Assign(string spritePath, string normalPath)
    {
        var n = (TextureImporter)AssetImporter.GetAtPath(normalPath);
        n.textureType = TextureImporterType.NormalMap;   // also sets sRGB off
        n.filterMode = FilterMode.Point;                 // pixel art: Point on the normal map too
        n.mipmapEnabled = false;
        n.textureCompression = TextureImporterCompression.Uncompressed;
        n.SaveAndReimport();

        var d = (TextureImporter)AssetImporter.GetAtPath(spritePath);
        d.textureType = TextureImporterType.Sprite;
        d.filterMode = FilterMode.Point;
        d.secondarySpriteTextures = new[] {
            new SecondarySpriteTexture { name = "_NormalMap", texture = AssetDatabase.LoadAssetAtPath<Texture2D>(normalPath) }
        };
        d.SaveAndReimport();
    }
}
```

A Light 2D's `normalMapQuality` and `normalMapDistance` have no public setter in URP 17.5, so set them in the Inspector (or through `SerializedObject` on `m_NormalMapQuality` / `m_NormalMapDistance` in editor code).

![Unity render of the same scene, normal maps disabled on the left and Accurate on the right, with the wall enlarged below](shot:engine-normal2d-unity "Rendered by Unity 6000.5.3f1, URP 17.5.0 2D Renderer (batch mode, Direct3D 12): Sprite-Lit-Default, _NormalMap secondary textures, one Spot Light 2D and a Global Light 2D at 0.15. Left: Normal Maps Quality Disabled. Right: Accurate, Distance 1. Art: Kenney Tiny Dungeon (CC0).")

In that run a lower *Distance* strengthened the relief, and *Fast* and *Accurate* gave pixel-identical frames for this small scene; compare both on your own art. Normal maps are not free: the manual notes that Unity then adds a depth pre-pass per layer batch, rendered to a full-size render texture.

In a **Sprite Atlas**, the secondary textures are packed with the sprites. Give every sprite in the atlas the same set of secondary textures, or the combined normal-map page fills with empty space.

## How to make normal maps for sprites {#making-normal-maps}

| Method | Good for | Tools |
|---|---|---|
| Generated from luminance ("height from brightness") | Stone, bricks, wood, textured tiles, quick tests | Nerulio Texture Lab, [Laigter](https://github.com/azagaya/laigter), [SpriteIlluminator](https://www.codeandweb.com/spriteilluminator) |
| Generated from the alpha edge (a bevel) | Rounded pickups, UI, silhouettes | Laigter, SpriteIlluminator, Nerulio (*Height from: Alpha channel*) |
| Painted from lighting profiles | Characters with real volume | [Sprite Lamp](http://www.snakehillgames.com/spritelamp/) (2–5 drawings of the sprite lit from different sides) |
| Hand-painted normals | Key art, small pixel sprites where every pixel counts | Any paint program, with a normal palette |
| Rendered from 3D | Pre-rendered sprites | Your 3D package's normal pass |

Generated maps are a starting point: brightness is not height, so a dark eye or black outline reads as a hole. Check under a moving light. The Godot manual points to Laigter (free, GPL-3.0, with a 2D light preview); SpriteIlluminator adds brushes for shaping volume by hand.

When you generate from a whole sheet, leave transparent pixels between frames: a 3×3 kernel reads one pixel into the neighbour, a 5×5 kernel two.

:::nerulio tool=texture-lab
Texture Lab's **Normal** stage turns a sprite or tile into a normal map in the browser, without uploading it. It reads the image as a height field and writes the normal it implies, so a sheet or atlas keeps its exact layout. It names the convention on screen and never guesses it.
- Drop the PNG and choose **Height → normal**, then **Convention: OpenGL +Y** for Godot and Unity.
- Set **Strength** (0–10, default 2). Under *Advanced settings*, choose the **Derivative kernel** (Sobel 3×3, Scharr 3×3, Sobel 5×5), **Height from** (Luminance or Alpha channel) and **Wrap around the edges** for tileable tiles.
- Press **Save normal map (PNG)**. You get `<name>-normal.png` at full resolution; the normal maps in the renders above came from this button.
- Already have a DirectX map? **OpenGL ↔ DirectX** mirrors the green channel exactly.
- Limits: one map at a time; no 2D light preview (the Preview stage is a 3D material preview); no specular map generator.
:::

![Nerulio Texture Lab, Normal stage: a dungeon tile as the source, its generated normal map, and the OpenGL/DirectX convention choice](shot:lab-texture-normal "Nerulio Texture Lab: Height → normal with the OpenGL +Y convention, plus the table of which engine expects which.")

## FAQ {#faq}

### Why does my normal map do nothing in Godot 4? {#faq-godot-no-effect}

The texture must be a CanvasTexture, not the plain PNG. A PointLight2D needs a Texture, and its reach is that texture's size × Texture Scale. Its Height must be above 0, or flat normal-mapped areas stay nearly black. The sprite's Light Mask must match the light's Item Cull Mask.

### Why does my Unity sprite ignore the normal map? {#faq-unity-ignored}

On every new Light 2D, Normal Maps → Quality is Disabled; set it to Fast or Accurate. Also check that the project uses the 2D Renderer, that the material is Sprite-Lit-Default (or a lit Shader Graph), and that the secondary texture is named exactly `_NormalMap`.

### Do Godot and Unity use OpenGL or DirectX normal maps? {#faq-convention}

Both expect OpenGL-style (Y+) normal maps. If lighting looks inverted vertically, invert the green channel of the map. Godot can do it at import with *Normal Map Invert Y*, and Unity with *Flip Green Channel*.

### Should normal maps for pixel art use nearest filtering? {#faq-nearest}

Yes. In Godot the CanvasTexture samples the normal map with the same filter as the sprite, so setting the node, CanvasTexture or project default to Nearest covers both. In Unity set the normal map's own Filter Mode to Point and Compression to None.

### Can I use normal maps on a TileMap or an animated sprite? {#faq-tilemap-animation}

Yes, in both engines. In Godot, use a CanvasTexture as the TileSet atlas texture, or as the atlas of the AtlasTextures in a SpriteFrames. In Unity, give each sprite sheet its `_NormalMap` secondary texture; it follows the same slices.

## Sources {#sources}

- Godot Engine 4.7 documentation: [2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)
- Godot 4.7 class reference: [CanvasTexture](https://docs.godotengine.org/en/stable/classes/class_canvastexture.html), [PointLight2D](https://docs.godotengine.org/en/stable/classes/class_pointlight2d.html), [DirectionalLight2D](https://docs.godotengine.org/en/stable/classes/class_directionallight2d.html), [Light2D](https://docs.godotengine.org/en/stable/classes/class_light2d.html)
- Godot 4.7 class reference: [ProjectSettings, rendering/textures/canvas_textures/default_texture_filter](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)
- Unity 6.5 (6000.5) Manual: [Add a normal map or a mask map to a sprite in URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/SecondaryTextures.html)
- Unity 6.5 Manual: [Light 2D component reference for URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2DLightProperties.html)
- Unity 6.5 Manual: [Create a 2D light in URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-light-properties-explained.html)
- Unity 6.5 Manual: [Set up a project for 2D games with the Universal 2D template](https://docs.unity3d.com/6000.5/Documentation/Manual/setup-project-2d-game.html)
- Unity 6.5 Manual: [Create a sprite atlas](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/atlas/create-sprite-atlas.html)
- Laigter: [GitHub repository (GPL-3.0)](https://github.com/azagaya/laigter)
- CodeAndWeb: [SpriteIlluminator](https://www.codeandweb.com/spriteilluminator)
- Snake Hill Games: [Sprite Lamp](http://www.snakehillgames.com/spritelamp/)
