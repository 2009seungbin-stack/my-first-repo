OpenGL and DirectX normal maps differ in one thing only: the direction of the green (Y) channel. In an OpenGL-style (Y+) map, bright green means "this slope faces the top of the image"; in a DirectX-style (Y−) map it means the opposite. Godot, Unity, Blender and glTF expect OpenGL, and Unreal Engine works with DirectX. To convert, invert the green channel only (new G = 255 − G). The simplest way is the engine's own import switch: **Normal Map Invert Y** in Godot, **Flip Green Channel** in Unity and in Unreal.

If you use the wrong one, bumps look like dents, and a light above the object seems to light it from below. Red, blue and the file size stay the same, which is why the mistake is easy to miss.

![The same bevelled shape three times, each lit by a light straight above it: correct, lit from below, correct again](shot:engine-normal-yflip-render "Rendered by Godot 4.7.2 (Compatibility renderer), 2D CanvasTexture + PointLight2D placed above each shape. Left: OpenGL map. Middle: the DirectX version of the same map, imported as is: the dome turns into a dent and the lower bevel catches the light. Right: the same DirectX file with Normal Map Invert Y turned on.")

## Which convention each engine and tool expects {#which-convention}

| Engine or tool | Expects | Where to flip green | Stated by the vendor? |
|---|---|---|---|
| Godot 4.7 (3D and 2D) | OpenGL, Y+ | Import dock → **Normal Map Invert Y** | Yes, in the manual |
| Unity 6 | OpenGL, Y+ | Texture Type **Normal map** → **Flip Green Channel** | Yes, in the manual |
| Unreal Engine 5 | DirectX, Y− | Texture editor → **Flip Green Channel** | Inferred (see below) |
| Blender (5.2 manual) | OpenGL by default | Normal Map node → **Convention** | Yes, in the manual |
| Substance 3D Painter | set per project | Project **Normal Map Format**; export **Normal OpenGL** or **Normal DirectX** | Yes |
| glTF 2.0 files | +Y up (OpenGL) | fix the texture before export | Yes, in the spec |

Epic's texture documentation calls Flip Green Channel "useful for some normal maps" and never names a convention. The Y− label for Unreal comes from two other sources: Adobe's Painter documentation recommends DirectX for Unreal (and 3ds Max) and OpenGL for Unity, Maya and Blender, and Epic's glTF exporter has an `adjust_normalmaps` option that flips green "from Unreal to glTF convention", which is +Y up.

Godot's 2D lighting follows the same rule: in the render above, a `CanvasTexture` with the OpenGL map and a `PointLight2D` overhead light the top of the dome. The 2D setup itself is in [2D normal maps and lighting](guide:2d-normal-maps-lighting-godot-unity).

## What the green channel means {#green-channel}

A tangent-space normal map stores one direction per pixel. Red is X (towards the right of the texture), green is Y and blue is Z (out of the surface, towards the viewer). Each value from −1 to 1 is stored as 0 to 255, so a flat pixel is about `(128, 128, 255)`, the typical lavender blue.

Both conventions agree on red and blue. They disagree on which way +Y points: **up the image** for OpenGL, **down the image** for DirectX. So a slope facing the top of the texture has G above 128 in an OpenGL map and below 128 in a DirectX map. Converting is `G' = 255 − G` on every pixel, and doing it twice gives back the original bytes. The vectors stay unit length, so both versions pass any "is this a valid normal map" check.

## How to tell which one you have {#identify}

No metadata in the file records the convention, and both versions are valid data. Check, from quickest to most reliable:

1. **The file name.** Many libraries ship both versions. ambientCG names them `_NormalGL` and `_NormalDX`, and Poly Haven offers `nor_gl` and `nor_dx`. From Substance 3D Painter, check which converted map the export preset used: **Normal OpenGL** or **Normal DirectX**.
2. **Look at a shape you know is raised**, such as a rivet, a brick or a button. In an OpenGL map, its upper edges are green and its lower edges are purple, as if lit from the top right. In a DirectX map, the green is on the lower edges, as if lit from the bottom right.
3. **The light test.** Put one light **above** the object and look at the same raised shape. If its lower edges catch the light, the map is the wrong convention for this engine.

![The OpenGL test map and its DirectX twin drawn unlit: the green highlights sit on the upper edges on the left and on the lower edges on the right](shot:engine-normal-yflip-maps "The two test maps drawn unlit by Godot 4.7.2. Left: OpenGL (Y+), green on the upward-facing slopes. Right: DirectX (Y−), the same map with G = 255 − G.")

> **Tip:** Test with the light above or below the object, not beside it. With a directional light that is exactly horizontal, the Y component of the normal does not affect the lighting at all, so both versions look the same. A nearby point light at the side still shows a difference, but a much smaller one.

## Convert or flip a normal map {#convert}

:::steps
1. **Find out what the target expects.** Godot, Unity, Blender and glTF: OpenGL (Y+). Unreal Engine: DirectX (Y−). Use the table above.
2. **Find out what you have.** Check the file name, then do the light test with the light above the object.
3. **Godot 4: flip on import.** Select the texture in the FileSystem dock. In the Import dock, turn on **Process → Normal Map Invert Y** and click **Reimport**. The `.import` file then contains `process/normal_map_invert_y=true`.
4. **Unity 6: flip on import.** Select the texture. In the Inspector, set **Texture Type** to **Normal map**, tick **Flip Green Channel** and click **Apply**.
5. **Unreal Engine: flip in the texture editor.** Open the texture, tick **Flip Green Channel** and save the asset.
6. **Or convert the file once.** In an image editor, select only the green channel and invert it (255 − G). Leave red, blue and alpha alone, and save as PNG so no compression artefacts creep in.
7. **Check it again.** With one light above the object, raised shapes should now be lit on their upper edges. Flip the texture in one place only: an import flag on top of an already converted file flips it back.
:::

Prefer the import switch: the source file stays as it came, and moving to another engine later is one checkbox.

## Godot 4 in detail {#godot}

After step 3, the relevant lines of the texture's `.import` file look like this:

```ini
; nm_directx.png.import (only the relevant lines)
[params]
compress/normal_map=0
process/normal_map_invert_y=true
```

We imported a DirectX test map this way in Godot 4.7.2 and read the imported pixels back. The green channel came out inverted: it matched the OpenGL original to within 1/255 (rounding), and red and blue were unchanged. Godot 4.7 has a second route with the same result: **Process → Channel Remap → Green → Green Inverted** (`process/channel_remap/green=5` in the `.import` file). Use one or the other, not both.

`compress/normal_map` (Detect, the default) is a different setting. It switches to RGTC compression, which keeps only red and green, when Godot detects that the texture is used as a normal map. It does not change the convention.

For a texture you cannot re-import, such as one loaded at runtime, a 2D node can flip green in a shader. Set this as the node's material and keep the DirectX map in the CanvasTexture's normal slot:

```glsl
// flip_green.gdshader: use a DirectX (Y-) normal map on a 2D node without re-importing it
shader_type canvas_item;

void fragment() {
	vec3 n = texture(NORMAL_TEXTURE, UV).rgb;
	n.g = 1.0 - n.g; // DirectX (Y-) -> OpenGL (Y+), which Godot expects
	NORMAL_MAP = n;
}
```

In our render, this looked the same as the import-flag version. Only the steepest pixels at the rim of the dome differed slightly, by at most 21/255. Mirroring a sprite with `flip_h = true` needs no second normal map: Godot 4.7.2 mirrors the normal's X for you. In our test, the flipped sprite was still lit on the side facing the light.

## Unity 6 in detail {#unity}

The **Normal map** texture type turns off sRGB for you (the importer reports `sRGBTexture = false`), and **Flip Green Channel** is `TextureImporter.flipGreenChannel` in scripts. To fix a whole library that ships DirectX maps, let an asset postprocessor set it on import:

```csharp
// Assets/Editor/FlipDirectXNormals.cs
using UnityEditor;

// Imports every texture whose file name ends in _NormalDX or _nor_dx as a normal map
// and flips its green channel, so DirectX-style (Y-) maps work in Unity, which expects OpenGL (Y+).
public class FlipDirectXNormals : AssetPostprocessor
{
    void OnPreprocessTexture()
    {
        string name = System.IO.Path.GetFileNameWithoutExtension(assetPath).ToLowerInvariant();
        if (!name.EndsWith("_normaldx") && !name.EndsWith("_nor_dx")) return;

        var importer = (TextureImporter)assetImporter;
        importer.textureType = TextureImporterType.NormalMap;
        importer.flipGreenChannel = true;
    }
}
```

In Unity 6000.5.3f1, a DirectX test map named `brick_NormalDX.png` came in through this script as a Normal map with Flip Green Channel on. Its imported pixels were identical to those of the OpenGL original. Because the script runs on every import, it overrides a manual change to those two settings on matching files. Files imported before the script existed need **Reimport**.

For sprites lit by the URP 2D Renderer, the normal map is a secondary texture of the sprite. That setup is covered in [2D normal maps and lighting](guide:2d-normal-maps-lighting-godot-unity).

## Unreal, Blender and Substance {#other-tools}

- **Unreal Engine.** Maps from a Y+ source (Blender, `_NormalGL` files, packs made for Unity) need **Flip Green Channel** in the texture editor. Maps made for Unreal need the flip on the Godot or Unity side instead.
- **Blender.** The Normal Map node uses OpenGL by default. The current manual (5.2 LTS) documents a **Convention** property for DirectX maps. If your version's node has no such property, invert green before the node: Separate Color, then a Math node set to Subtract (1 − G), then Combine Color.
- **Substance 3D Painter.** The project's **Normal Map Format** changes the viewport and the bakers only; Adobe says the layer stack is independent. A normal map you load into a layer or tool is treated as DirectX by default, and you change that from the small arrow next to the map. At export, choose the converted map **Normal OpenGL** or **Normal DirectX** for the target engine.

## When channels are packed differently {#packed-channels}

"Invert green" really means "invert the channel that holds Y". That is not always green in the file you are looking at.

- **Two-channel normal maps.** Formats like BC5/RGTC store only X and Y, and the shader rebuilds Z. Godot's Normal Map compression keeps only red and green. Blue does not matter there; Y is still green.
- **Unity's imported normal maps are swizzled.** In Unity 6000.5.3f1 on Windows, an uncompressed Normal map read back from a script came out as R = 255, G = Y, B = Y, A = X. Shaders decode this layout for you. A script that reads the imported texture does not get the original RGB, so flip the source file or use the importer flag, not a pixel loop over the imported texture.
- **Packed detail maps.** Unity HDRP's detail map stores normal Y in green and normal X in alpha, next to albedo (red) and smoothness (blue). Flipping it means inverting green only.

Two fixes that do not work: flipping the image vertically moves the pixels off the UVs, and inverting all channels also flips X (red) and points blue into the surface.

:::nerulio tool=normal-map-converter
Nerulio's Normal Map Converter is the Normal stage of the Texture Lab, and it runs in your browser: the file is not uploaded. Its **OpenGL ↔ DirectX** mode inverts the green channel and nothing else, and converting twice returns the original bytes. PNGs are decoded byte for byte instead of through a canvas, which is how the Lab's tests measured `G' = 255 − G` exactly, with red, blue and alpha unchanged.
- Drop a normal map, choose **OpenGL ↔ DirectX**, then **Save normal map (PNG)**.
- In the **Preview** stage, tick **Treat the normal map as DirectX (flip green)** to compare both readings under one light. It is an approximation, not an engine renderer.
- **Height → normal** writes a new map in the **Convention** you pick: **OpenGL +Y** or **DirectX −Y**.
- It cannot tell you which convention a file uses; nothing can for certain. The Lab lists which engine expects which, with its sources, and converts.
:::

![Nerulio Texture Lab, Normal stage: source and result side by side, the OpenGL and DirectX convention buttons and the list of which engine expects which](shot:lab-texture-normal "Texture Lab, Normal stage: the convention toggle and the engine list with the sources behind each entry.")

## FAQ {#faq}

### Does Unity use OpenGL or DirectX normal maps?
OpenGL. The Unity manual says "Unity uses Y+ normal maps, sometimes known as OpenGL format." For a DirectX map, set Texture Type to Normal map and tick Flip Green Channel.

### Does Unreal Engine use DirectX normal maps?
Yes, Unreal works with DirectX-style (Y−) maps. Epic does not say it in those words, but Adobe recommends DirectX for Unreal and Epic's glTF exporter flips green to reach glTF's +Y. Tick Flip Green Channel on OpenGL maps.

### Does Godot use OpenGL or DirectX normal maps?
OpenGL (X+, Y+, Z+), as the Godot manual states. The same holds for 2D lighting with CanvasTexture. For a DirectX map, turn on Normal Map Invert Y in the Import dock and reimport.

### Can I fix a DirectX normal map by flipping the image vertically?
No. A vertical flip moves every pixel, so the texture no longer matches the model's UVs, and the lighting is still wrong. Invert only the green channel's values, or use the engine's flip option.

### How do I know if my normal map is OpenGL or DirectX?
Check the file name first (`_NormalGL`/`_NormalDX`, `nor_gl`/`nor_dx`). Then look at a raised detail: green on its upper edges means OpenGL, green on its lower edges means DirectX. To confirm, light the object from above in your engine.

## Sources {#sources}

- [Importing images, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html)
- [ResourceImporterTexture, Godot Engine 4.7 class reference](https://docs.godotengine.org/en/4.7/classes/class_resourceimportertexture.html)
- [Standard Material 3D and ORM Material 3D, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/3d/standard_material_3d.html)
- [2D lights and shadows, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/2d/2d_lights_and_shadows.html)
- [Introduction to normal maps (bump mapping), Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/StandardShaderMaterialParameterNormalMap.html)
- [Normal map texture type, Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-normal-map.html)
- [TextureImporter.flipGreenChannel, Unity 6.5 Scripting API](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/TextureImporter-flipGreenChannel.html)
- [Mask and detail maps, Unity HDRP 17.1 documentation](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/Mask-Map-and-Detail-Map.html)
- [Texture Asset Editor, Unreal Engine documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/texture-asset-editor-in-unreal-engine)
- [unreal.GLTFExportOptions (adjust_normalmaps), Unreal Engine Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/GLTFExportOptions)
- [Normal Map Node, Blender 5.2 LTS Manual](https://docs.blender.org/manual/en/latest/render/shader_nodes/displacement/normal_map.html)
- [Project configuration, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/interface/project-configuration.html)
- [Normal map looks incorrect when loaded in layer or tool properties, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/technical-support/workflow-issues/tools-issues/normal-map-looks-incorrect-when-loaded-in-layer-or-tool-properties.html)
- [Output templates, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/getting-started/export/export-window/output-templates.html)
- [What is the difference between the OpenGL and DirectX normal format?, Adobe Substance 3D bakers](https://helpx.adobe.com/substance-3d-bake/common-questions/what-is-the-difference-between-the-opengl-and-directx-normal-format.html)
- [glTF 2.0 material schema (normalTexture), Khronos Group](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.schema.json)
