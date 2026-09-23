Pixel art looks blurry in Unity because of the default texture import settings. A new PNG is imported with **Filter Mode** **Bilinear**, which smooths pixels when they are scaled up, and with **Compression** **Normal Quality**, which smears colours in 4×4 blocks. A sheet larger than **Max Size** (2048 by default) is also shrunk silently. To fix it, set **Filter Mode** to **Point (no filter)** and **Compression** to **None**, make **Max Size** at least as large as the image, give every sprite the same **Pixels Per Unit**, and add a **Pixel Perfect Camera** so the game is drawn at a whole-number scale.

Everything below was checked in Unity 6000.5.3f1 (Unity 6.5) with URP 17.5 and its 2D Renderer. The images are real renders from that editor.

![Four renders of the same 48 px CC0 samurai frame at 6× in Unity 6000.5.3f1: Bilinear + Normal Quality compression, Point + Normal Quality, Point with Max Size 128, and Point + None](shot:engine-unity-pixel-import-compare "Rendered by Unity 6000.5.3f1 (Built-in Render Pipeline) at 6×, left to right: Bilinear + compressed (the default), Point + compressed (face detail lost), Point with Max Size 128 (sheet shrunk to 77×128), Point + None. Art: samurai by sebshady, CC0.")

## Fix the import settings {#steps}

:::steps
1. **Select the sprites.** In the Project window, select every pixel-art texture (you can select many at once and edit them together).
2. **Use sprite import.** In the Inspector set **Texture Type** to **Sprite (2D and UI)**. Set **Pixels Per Unit** to your tile or grid size (for example 16) on every sprite, so one tile is one world unit.
3. **Turn filtering off.** Under **Advanced**, turn **Generate Mip Maps** off. Then set **Filter Mode** to **Point (no filter)**.
4. **Turn compression off and check Max Size.** In the platform section (the **Default** tab) set **Compression** to **None**, and set **Max Size** to a value at least as large as the texture's longest side (a 3000 px sheet needs 4096). Click **Apply**.
5. **Add a Pixel Perfect Camera.** Select the camera, click **Add Component** and add **Pixel Perfect Camera**. Set **Assets Pixels Per Unit** to the same value as your sprites and **Reference Resolution** to your game's pixel resolution (for example 320 × 180). With URP the camera must use a 2D Renderer.
6. **Pick how it snaps.** Set **Grid Snapping** to **Pixel Snapping** to stop sub-pixel movement, or to **Upscale Render Texture** to draw the scene at the reference resolution and scale it up, which also keeps rotated sprites on the pixel grid. Choose a **Crop Frame** for screens whose aspect ratio differs from the reference resolution.
:::

## Why each setting matters {#why}

These were measured on a 288×480 CC0 sheet (48 px frames):

| Setting | Default for a new PNG | What it does to pixel art |
|---|---|---|
| **Filter Mode** | Bilinear | Blends neighbouring texels when the sprite is scaled, so every edge becomes a gradient (4,230 colours in the left render instead of 12) |
| **Compression** | Normal Quality (DXT5 on Windows) | Block compression changes colours in 4×4 blocks. With Point it is sharp but wrong: the face detail in the second render is gone |
| **Max Size** | 2048 | A larger texture is scaled down on import with no warning. With Max Size 128 the sheet became 77×128 |
| **Generate Mip Maps** | off for Sprite, on for Default | Smaller copies of the texture that get sampled when the sprite is drawn small; they blur pixel art |
| **Pixels Per Unit** | 100 | Different values on different sprites mean their pixels come out at different sizes on screen |

The rightmost render (**Point**, **None**, Max Size 2048) was pixel-for-pixel identical to a nearest-neighbour 6× enlargement of the source frame.

**Check the Texture Type as well.** In a project that is not in 2D mode, a new PNG is imported as **Default**, not **Sprite (2D and UI)**. That also turns mip maps on, and a non-power-of-two image is rescaled: our 288×480 sheet became 256×512. If a texture that should be a sprite looks soft and slightly stretched, check its **Texture Type** first.

## Pixel Perfect Camera settings {#pixel-perfect-camera}

In Unity 6 with URP, the **Pixel Perfect Camera** component is part of URP (`UnityEngine.Rendering.Universal.PixelPerfectCamera`) and needs a camera that uses the **2D Renderer**. Its Inspector shows an error on any other renderer. The Built-in Render Pipeline uses the separate **2D Pixel Perfect** package (6.0.0 ships with 6000.5), which has older checkbox-style options.

| Property | Values in 6000.5.3f1 | Use |
|---|---|---|
| **Assets Pixels Per Unit** | default 100 | Must match the sprites' **Pixels Per Unit** |
| **Reference Resolution** | default 320 × 180 | The resolution your art is drawn for. The camera picks the largest whole-number scale that fits the screen |
| **Crop Frame** | None, Pillarbox, Letterbox, Windowbox, Stretch Fill | What to do with the leftover screen space: black bars, or stretch to fill |
| **Grid Snapping** | None, Pixel Snapping, Upscale Render Texture | Pixel Snapping snaps sprite renderers to the pixel grid when they are drawn; Upscale Render Texture draws at the reference resolution, then scales up |
| **Filter Mode** | Retro AA (default), Point | Shown only with **Crop Frame** set to **Stretch Fill**. Retro AA upscales with point sampling to the nearest whole multiple, then bilinear-filters to the screen size. Point stays sharp but shimmers more |

**Current Pixel Ratio** in the Inspector shows the scale the camera settled on (for example 4:1) while the game is running. If it is not a whole number at your target resolution, change **Reference Resolution** or **Crop Frame**. Our 288 px test render with a 48 × 48 reference resolution reported a ratio of 6.

![Two URP renders of the same frame rotated 20°: Grid Snapping None gives rotated large pixels, Upscale Render Texture keeps the pixels upright on the grid](shot:engine-unity-pixel-perfect-rotation "Rendered by Unity 6000.5.3f1, URP 17.5 2D Renderer, Pixel Perfect Camera at 6×: Grid Snapping None (left) and Upscale Render Texture (right), sprite rotated 20°.")

**Grid Snapping** matters most when sprites rotate or scale. With **None**, a rotated sprite is drawn at full screen resolution, so its big pixels turn with it and cut across the pixel grid ("mixels"). With **Upscale Render Texture**, the scene is drawn at the reference resolution first, so the rotated sprite is re-pixelated on the same grid as everything else. Unity's documentation notes the trade-off: sharper pixels shimmer more when they move.

## Apply the settings to every new texture {#presets}

Setting these by hand on each file is how blurry sprites come back. There are two reliable ways to automate it; both were tested in 6000.5.3f1.

**Preset Manager (no code).** Set one texture up correctly, click the preset selector (the slider icon) at the top right of the Inspector, and click **Create New** in the **Select Preset** window to save a preset asset. Select the preset and click **Add to default** in its Inspector, then open **Edit → Project Settings → Preset Manager** and give it a **Filter** such as `glob:"Assets/Art/Sprites/**"`. A new PNG copied into that folder was imported as Sprite / Point / None with the preset's Pixels Per Unit; a PNG outside it kept the defaults. Unity does not apply default presets when you reimport an existing asset. A preset also copies every setting it holds, including **Sprite Mode**, unless you exclude that property in the preset.

**AssetPostprocessor (code).** This version only touches new files, so a later change in the Inspector is kept:

```csharp
// Assets/Editor/PixelArtImportSettings.cs
using UnityEditor;
using UnityEngine;

// Gives every texture imported under Assets/Art/Pixel/ pixel-art settings on its first import.
public class PixelArtImportSettings : AssetPostprocessor
{
    const string Folder = "Assets/Art/Pixel/";
    const float PixelsPerUnit = 16f;

    void OnPreprocessTexture()
    {
        if (!assetPath.StartsWith(Folder)) return;
        if (!assetImporter.importSettingsMissing) return; // only new files: later Inspector edits are kept
        var importer = (TextureImporter)assetImporter;
        importer.textureType = TextureImporterType.Sprite;
        importer.spritePixelsPerUnit = PixelsPerUnit;
        importer.filterMode = FilterMode.Point;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.mipmapEnabled = false;
        importer.maxTextureSize = 16384;                     // never downscale silently
    }
}
```

In the test, a new file in `Assets/Art/Pixel/` came in as Sprite, Point, uncompressed, Max Size 16384, 16 PPU and no mip maps. When we then switched it to Bilinear in the Inspector, it stayed Bilinear after reimport. Remove the `importSettingsMissing` line if you want the folder rule to win every time.

## Sprite Atlas and tilemap gaps {#atlas-tilemap}

- **A Sprite Atlas has its own texture settings.** In 6000.5.3f1 a new atlas starts with **Filter Mode** Bilinear, **Compression** Normal Quality, **Padding** 4, and **Allow Rotation** and **Tight Packing** on. Packed sprites are drawn from the atlas texture, so set the atlas to **Point** and **None** as well, or the blur comes back after packing.
- **Thin lines between tiles** usually come from the renderer sampling a neighbouring texel at a tile's edge. The cause is a camera position or zoom between pixels, bilinear filtering, mip maps or compression. Point filtering, no mip maps, and a Pixel Perfect Camera fix most cases. Packing the tiles into a Sprite Atlas with Padding (2 or more) and Point filtering fixes the rest. Edge extrusion and why it works are covered in [tile seams and texture bleeding](guide:tile-seams-texture-bleeding-padding-extrude).
- **Jitter while moving** (sprites wobbling by a pixel against the background) is sub-pixel movement. Use **Grid Snapping**, or keep the camera and sprites on positions that are multiples of `1 / Pixels Per Unit`.

:::nerulio tool=pixel-perfect-checker
Sometimes the PNG itself is already blurry: an upscaled export, an image resized with smoothing, or generated "pixel art" that sits on no real grid. No Unity setting fixes that. Nerulio's Pixel Perfect Checker measures the file in your browser and tells you which case you have.
- Finds the pixel size and grid offset of upscaled art. When an exact grid exists it offers **Recover 1× source**, so you can import the true 1× image.
- Counts edge pixels that sit between two colours (a nearest-scaled image has none; a smoothed one has many) and the number of distinct colours, and says plainly when the original pixels cannot be recovered.
- The Studio's [Pack & Export](studio:pack) Unity 6 target imports with Point, no compression and no mip maps, and raises Max Size to fit the atlas page. That export was verified in Unity 6000.5.3f1.
:::

![Nerulio Pixel Perfect Checker measuring an image resampled by about 7.29×, reporting smoothing with high confidence and 84.6% intermediate edge pixels](shot:lab-pixel-cleanup "The checker reports a non-integer resample and smoothing instead of guessing a grid.")

## FAQ {#faq}

### Why is my pixel art blurry only in the Game view?

The Scene view and the Game view zoom differently. At a non-integer zoom the pixels get uneven even with **Point** filtering, and with **Bilinear** they also blur. Set the Game view to a fixed resolution, and add a Pixel Perfect Camera so the game scales by whole numbers.

### Should I use Point or Bilinear for pixel art in Unity?

Use **Point (no filter)**. Bilinear is meant for smooth art. For pixel art it averages neighbouring pixels when the sprite is scaled. If you use Pixel Perfect Camera with **Stretch Fill**, its own **Filter Mode** (Retro AA) is a separate setting for the final upscale.

### My sprites are still blurry after setting Point. What else?

Check **Compression** (set it to **None**), **Max Size** (it must not be smaller than the image), **Generate Mip Maps** (off), and whether the sprite is packed in a Sprite Atlas whose own Filter Mode is still Bilinear. Also check that the texture is not imported as **Default**.

### What Pixels Per Unit should I use?

Use the size of one tile or grid cell (16 for a 16 px tileset), and the same value on every sprite and on the camera's **Assets Pixels Per Unit**. The number itself is a design choice. What matters is that everything matches.

### Does Pixel Perfect Camera work with the Built-in Render Pipeline?

Not the URP component. The Built-in pipeline uses the **2D Pixel Perfect** package, which is still published (6.0.0 for Unity 6.5). In URP, use the component that URP ships with a 2D Renderer.

## Sources {#sources}

- Unity 6.5 Manual — [Sprite (2D and UI) texture Import Settings reference](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-sprite.html)
- Unity 6.5 Manual — [Add a pixel perfect camera (prepare your sprites)](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-prep-sprites.html)
- Unity 6.5 Manual — [Configure a pixel perfect camera](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-configure.html)
- Unity 6.5 Manual — [Pixel Perfect Camera component reference for URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-ref.html)
- 2D Pixel Perfect package 6.0 — [2D Pixel Perfect (Built-in Render Pipeline)](https://docs.unity3d.com/Packages/com.unity.2d.pixel-perfect@6.0/manual/index.html)
- Unity 6.5 Manual — [Preset Manager](https://docs.unity3d.com/6000.5/Documentation/Manual/class-PresetManager.html) and [Apply default presets by folder](https://docs.unity3d.com/6000.5/Documentation/Manual/DefaultPresetsByFolder.html)
- Unity 6.5 Scripting API — [AssetPostprocessor.OnPreprocessTexture](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AssetPostprocessor.OnPreprocessTexture.html), [AssetImporter.importSettingsMissing](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AssetImporter-importSettingsMissing.html)
- Unity 6.5 Manual — [Sprite Atlas Inspector window reference](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/atlas/sprite-atlas-reference.html)
- Test art: [Samurai sprites by sebshady](https://opengameart.org/content/samurai-sprites), CC0
