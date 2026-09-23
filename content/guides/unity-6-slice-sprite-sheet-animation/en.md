To slice a sprite sheet in Unity 6, select the PNG, set **Texture Type** to **Sprite (2D and UI)** and **Sprite Mode** to **Multiple**, click **Apply**, then open the **Sprite Editor** and use **Slice → Grid By Cell Size** with the frame size and the gap between frames as **Padding**. After another **Apply**, select the frames in the Project window and drag them into the Scene: Unity asks where to save the clip, then creates an Animation Clip at 12 frames per second, an Animator Controller and an Animator on the new GameObject.

Everything below was checked in Unity 6000.5.3f1 (Unity 6.5) with the built-in 2D Sprite package. The measurements come from a batch-mode script that calls the same grid slicer as the Sprite Editor. The test sheet is Kenney's CC0 Pixel Platformer character sheet: 224×74 px, 24 px frames with a 1 px gap.

## Slice the sheet and make a clip {#steps}

:::steps
1. **Set the import settings.** Select the sheet in the Project window. In the Inspector set **Texture Type** to **Sprite (2D and UI)**, **Sprite Mode** to **Multiple** and **Pixels Per Unit** to the size of one tile or character cell (16, 24, 32 …). For pixel art also set **Filter Mode** to **Point (no filter)** and **Compression** to **None**. Click **Apply**.
2. **Open the Sprite Editor.** Click **Open Sprite Editor** in the Inspector. If Unity says the Sprite Editor window is not available because the 2D Sprite package is not installed, install **2D Sprite** from **Window → Package Manager** (every 2D template already has it).
3. **Choose the grid.** Click **Slice** in the toolbar. Set **Type** to **Grid By Cell Size**, **Pixel Size** to the frame size (24 × 24 here), **Offset** to the margin before the first frame and **Padding** to the gap between frames (1 × 1 here). Leave **Keep Empty Rects** off unless you need one sprite per cell.
4. **Set the pivot and slice.** Pick **Pivot** **Bottom** for characters that stand on the ground (or **Custom** with **Pivot Unit Mode** **Pixels**), keep **Method** on **Delete Existing** for a first slice, and click **Slice**. Check that every outline sits exactly on a frame, then click **Apply**.
5. **Create the clip.** Expand the sheet in the Project window, select the frames of one animation (for example `characters_0` and `characters_1`) and drag them into the Scene view. Save the `.anim` file when Unity asks. Unity adds a SpriteRenderer, an Animator and a new Animator Controller that plays the clip.
6. **Set the speed and looping.** Open **Window → Animation → Animation**, select the GameObject, and in the Animation window's options menu enable **Show Sample Rate**. Change **Samples** (frames per second) from 12 to the speed you want. Select the `.anim` file and check **Loop Time** in the Inspector for walk and idle cycles; turn it off for one-shot animations such as attacks or deaths.
:::

![Nerulio Studio Sprite workspace detecting a 48×48 grid on a CC0 samurai sheet, with confidence and alternatives, before anything is cut](shot:studio-sprite-import "The Sprite workspace proposes the grid with a confidence score and lets you compare alternatives before cutting.")

## Which slice type to use {#slice-types}

The **Slice** menu has four types. `SpriteEditorMenuSetting.SlicingType` in 6000.5.3f1 lists exactly these: Automatic, GridByCellSize, GridByCellCount, IsometricGrid.

| Type | What it does | Use it for |
|---|---|---|
| Automatic | One rectangle per island of opaque pixels, trimmed tight | Icon sheets, props, UI pieces; not animation |
| Grid By Cell Size | Cells of a fixed **Pixel Size**, plus **Offset** and **Padding** | Animation sheets where you know the frame size |
| Grid By Cell Count | You enter **Column & Row**; Unity computes the cell size | Sheets where you know the frame count but not the size |
| Isometric Grid | Diamond-shaped cells (**Is Alternate** staggers rows) | Isometric tiles |

**Automatic is the wrong choice for animation.** On the test sheet it found the right 27 islands, but in 16 different sizes, from 11×15 to 24×24. Each trimmed rectangle gets its own pivot, so the character jumps around when the frames play. Grid slicing keeps every frame the same size, which keeps the art in place.

## Padding, Offset and the one-pixel drift {#padding-offset}

The "off by one" problem is usually a slice that ignores the gap between frames. It does not show up as a wrong count. We measured three setups on the 224×74 sheet (24 px frames, 1 px gap):

| Settings | Sprites | Where the columns start |
|---|---|---|
| Grid By Cell Size 24, Padding 0 | 27 | 0, 24, 48 … 192 — each column 1 px further off; the last is 8 px off |
| Grid By Cell Count 9 × 3, Padding 0 | 27 | same: Unity rounds 224 / 9 = 24.9 down to 24 |
| Grid By Cell Size 24, Padding 1 | 27 | 0, 25, 50 … 200 — exact |

The first two settings give the right number of frames, so nothing looks wrong in the list. The character just slides sideways a little more in every frame, and a strip of the neighbouring frame shows at one edge. **Grid By Cell Count** only works when you also enter the padding: Unity computes the cell as `(width − offset − padding × (columns − 1)) / columns` and rounds down.

Rules that prevent it:

- Measure one frame and one gap in an image editor. The sheet width should equal `offset + columns × cell + (columns − 1) × padding`. Here that is 0 + 9 × 24 + 8 × 1 = 224.
- **Offset** is counted from the top-left corner of the image, which is how most art tools lay out sheets. With Offset 1, 1 the first cell moved one pixel right and one pixel down.
- Leftover pixels are not turned into frames. A copy of the sheet made 1 px wider still gave exactly 27 full 24×24 sprites, with no thin sliver sprite. If you do see a sliver in an older project, delete it in the Sprite Editor before you build the clip.

## Empty cells and Keep Empty Rects {#empty-cells}

Sheets often have unused cells at the end of a row. With **Keep Empty Rects** off (the default), grid slicing skips cells that have no opaque pixels. The CC0 HQ Trooper sheet (6 × 13 cells of 64 px) gave 52 sprites with it off and 78 with it on.

The catch is the numbering. The Sprite Editor names sprites `<texture>_0`, `<texture>_1` … in the order it creates them. When empty cells are skipped, the frame after a gap takes the next free number. After that, "row 3" no longer starts at `_12`, and any script that picks frames by index grabs the wrong ones. Either turn **Keep Empty Rects** on and delete the empties by hand, or rename the frames of each animation (`run_0`, `run_1` …) before building clips.

## Pivot and Pixels Per Unit {#pivot-ppu}

- **Pivot** is where the sprite sits on its GameObject and what it rotates around. For platformer characters, **Bottom** (feet on the ground) makes positioning and ground checks simpler than **Center**. All frames of one animation need the same pivot, or the art jumps.
- **Pixels Per Unit** sets how many texture pixels make one world unit. Give every sprite in a pixel-art project the same value (usually the tile size), so a 16 px tile is exactly 1 unit and the [Pixel Perfect Camera](guide:unity-pixel-art-blurry-pixel-perfect) can snap to whole pixels.

## Re-slicing without breaking references {#slice-method}

The **Method** option decides what happens to sprites you already have:

- **Delete Existing** throws away all rectangles and makes new ones with default names. If you renamed sprites, Unity warns that references to them will be lost.
- **Smart** adds new rectangles while keeping or adjusting the existing ones.
- **Safe** only adds rectangles and never changes existing ones.

Once clips or prefabs use the sprites, re-slice with **Smart** or **Safe**. The Unity 6 Slice panel also has **Slice on Import**, which slices the texture again with the same settings each time you edit the PNG outside Unity and it is reimported.

## Frame rate, frame order and looping {#frame-rate}

What dragging frames into the Scene does in 6000.5.3f1, reproduced by calling the editor's own drag handler:

- The clip is saved at **12 samples per second**, one key per frame. It **loops** (**Loop Time** on). Unity also creates an Animator Controller named after the GameObject and adds an Animator to it.
- Frames are sorted by **natural name order**: `characters_0, characters_1, characters_2, characters_10`, not the order you clicked them in. Name frames so that the natural order is the playback order.
- Each frame lasts 1/12 s, and the last one lasts as long as the others. The clip length is `frames / samples` (4 frames = 0.333 s). You do not need an extra closing key.

To hold a frame longer, drag its key to a later time in the Animation window's Dopesheet, or duplicate the key. To change the speed of the whole clip, change **Samples**; to change it for one state only, set **Speed** on that state in the Animator window.

## Script it: ISpriteEditorDataProvider {#script}

Older answers use `TextureImporter.spritesheet`. In Unity 6 that property is marked obsolete: "Support for accessing sprite meta data through spritesheet has been removed. Please use the UnityEditor.U2D.Sprites.ISpriteEditorDataProvider interface instead." Use `SpriteDataProviderFactories` from the 2D Sprite package instead. The editor script below compiled and ran in 6000.5.3f1. On the test sheet, its 27 rectangles were identical to the Sprite Editor's own grid result, and every sprite's pixels matched the PNG.

```csharp
// Assets/Editor/SpriteSheetSlicer.cs  (needs the 2D Sprite package, com.unity.2d.sprite)
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class SpriteSheetSlicer
{
    // Cuts a grid sheet into sprites named <file>_0, <file>_1 … (top-left cell first).
    // cell = frame size, pad = gap between frames, off = margin before the first frame (pixels).
    public static int Slice(string path, int cellW, int cellH, int padX = 0, int padY = 0,
                            int offX = 0, int offY = 0, float ppu = 16f, bool skipEmpty = true)
    {
        var importer = (TextureImporter)AssetImporter.GetAtPath(path);
        importer.textureType = TextureImporterType.Sprite;          // "Sprite (2D and UI)"
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = ppu;
        importer.filterMode = FilterMode.Point;                      // pixel art: no blur
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.mipmapEnabled = false;
        importer.SaveAndReimport();

        var factory = new SpriteDataProviderFactories();
        factory.Init();
        var provider = factory.GetSpriteEditorDataProviderFromObject(importer);
        provider.InitSpriteEditorDataProvider();
        var texProvider = provider.GetDataProvider<ITextureDataProvider>();
        texProvider.GetTextureActualWidthAndHeight(out int w, out int h); // real size, not Max Size
        Texture2D pixels = skipEmpty ? texProvider.GetReadableTexture2D() : null;

        string baseName = Path.GetFileNameWithoutExtension(path);
        int cols = (w - offX + padX) / (cellW + padX);               // whole cells only
        int rows = (h - offY + padY) / (cellH + padY);
        var rects = new List<SpriteRect>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
            {
                int x = offX + c * (cellW + padX);
                int yFromTop = offY + r * (cellH + padY);
                var rect = new Rect(x, h - yFromTop - cellH, cellW, cellH); // Unity rects start bottom-left
                if (pixels != null && IsEmpty(pixels, rect)) continue;
                rects.Add(new SpriteRect
                {
                    name = baseName + "_" + rects.Count,
                    spriteID = GUID.Generate(),
                    rect = rect,
                    alignment = SpriteAlignment.BottomCenter,          // feet on the ground
                    pivot = new Vector2(0.5f, 0f),
                });
            }

        provider.SetSpriteRects(rects.ToArray());
        // Unity 2021.2+: register each name with its ID so references survive a re-slice.
        var names = provider.GetDataProvider<ISpriteNameFileIdDataProvider>();
        names.SetNameFileIdPairs(rects.Select(s => new SpriteNameFileIdPair(s.name, s.spriteID)).ToList());
        provider.Apply();
        importer.SaveAndReimport();
        return rects.Count;
    }

    static bool IsEmpty(Texture2D tex, Rect r)
    {
        foreach (var c in tex.GetPixels((int)r.x, (int)r.y, (int)r.width, (int)r.height))
            if (c.a > 0f) return false;
        return true;
    }

    // One clip from frame indices, e.g. BuildClip(sheet, "Assets/Anim/Walk.anim", new[] {0, 1}, 8).
    public static AnimationClip BuildClip(string sheetPath, string clipPath, int[] frames, float fps, bool loop = true)
    {
        string baseName = Path.GetFileNameWithoutExtension(sheetPath);
        var sprites = AssetDatabase.LoadAllAssetsAtPath(sheetPath).OfType<Sprite>().ToDictionary(s => s.name);
        var keys = new ObjectReferenceKeyframe[frames.Length];
        for (int i = 0; i < frames.Length; i++)   // one key per frame; Unity adds 1/fps after the last key
            keys[i] = new ObjectReferenceKeyframe { time = i / fps, value = sprites[baseName + "_" + frames[i]] };

        var clip = new AnimationClip { frameRate = fps };
        var binding = EditorCurveBinding.PPtrCurve("", typeof(SpriteRenderer), "m_Sprite");
        AnimationUtility.SetObjectReferenceCurve(clip, binding, keys);
        var settings = AnimationUtility.GetAnimationClipSettings(clip);
        settings.loopTime = loop;
        AnimationUtility.SetAnimationClipSettings(clip, settings);
        AssetDatabase.CreateAsset(clip, clipPath);
        return clip;
    }
}
```

Call it from a menu item or from `-executeMethod` in batch mode, for example `SpriteSheetSlicer.Slice("Assets/Art/characters.png", 24, 24, 1, 1, 0, 0, 24f)`. Keys are one frame apart at the clip's `frameRate`. The clip built from two frames at 8 fps is 0.25 s long and shows each frame for 0.125 s.

> **Tip:** The Sprite Editor stores rectangles in bottom-left coordinates, while art tools count from the top-left. That is why the script converts `y`. Get this wrong and your rows come out in reverse order.

:::nerulio ws=sprite
Nerulio's Studio finds the grid for you. Drop a sheet into the Sprite workspace and it measures cell size, margin and gap from the pixels, with a confidence score and alternatives. You can check every cut before applying it, and tag animations on the timeline with per-frame durations. **Pack & Export → Unity 6** then writes the atlas PNG, a `.unity.json` and `Editor/NerulioSpriteImporter.cs`. Run **Tools → Nerulio → Import Studio JSON** in Unity to get the same Sprite / Multiple / Point / uncompressed import, one sprite per frame with its pivot, and one `.anim` clip per tag.
- Verified in Unity 6000.5.3f1 batch mode: rects, pivots, pixels, clip keys and durations (see the export line in the Studio).
- Pixels Per Unit is written as 100. Edit `pixelsPerUnit` in the `.unity.json` before importing if your project uses 16 or 32.
- Needs the 2D Sprite package, like the Sprite Editor itself. Everything runs in the browser; the sheet is never uploaded.
:::

![Nerulio Pack & Export listing Unity 6 among the engine targets, with the verification line under the export button](shot:studio-pack-export "Pack & Export: pick Unity 6 and the bundle comes with the importer script.")

## FAQ {#faq}

### Why does Unity say the Sprite Editor window is not available?

The Sprite Editor is part of the **2D Sprite** package (`com.unity.2d.sprite`). Projects made from a 3D template may not have it. Install it from **Window → Package Manager → Unity Registry**. The texture also needs **Texture Type** set to **Sprite (2D and UI)**.

### Why are my sliced frames shifted by a pixel or two?

The sheet has gaps between frames and **Padding** is 0. The cells then drift one pixel further per column. Set **Padding** to the gap and **Offset** to the outer margin, and check that `offset + columns × cell + (columns − 1) × padding` equals the image width.

### How do I change the animation speed in Unity 6?

In the Animation window, open the options menu, enable **Show Sample Rate** and change **Samples**. Clips made by dragging sprites into the Scene start at 12. To speed up only one state, set **Speed** on that state in the Animator window.

### Why does my animation not loop, or loops when it should not?

Looping is the **Loop Time** checkbox on the `.anim` asset. Clips created by dragging sprites have it on. Turn it off for one-shot animations, and use an Animator transition with **Has Exit Time** to go back to idle.

### Can I import an Aseprite file directly instead?

Yes. Unity 6 has the 2D Aseprite Importer package, which imports `.aseprite` files with their tags as clips. See [Aseprite files in Godot, Unity and Phaser](guide:aseprite-files-godot-unity-phaser) for how its output compares with a sliced PNG.

## Sources {#sources}

- Unity 6.5 Manual — [Cut out sprites from a texture](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/sprite-editor/use-editor.html)
- Unity 6.5 Manual — [Sprite Editor window reference](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/sprite-editor/sprite-editor-window-reference.html)
- Unity 6.5 Manual — [Sprite (2D and UI) texture Import Settings reference](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-sprite.html)
- 2D Sprite package 1.0 — [Sprite Editor Data Provider API](https://docs.unity3d.com/Packages/com.unity.2d.sprite@1.0/manual/DataProvider.html)
- Unity 6.5 Scripting API — [TextureImporter.spritesheet](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/TextureImporter-spritesheet.html)
- Unity 6.5 Scripting API — [AnimationUtility.SetObjectReferenceCurve](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AnimationUtility.SetObjectReferenceCurve.html)
- Unity 6.5 Manual — [Create a new Animation Clip](https://docs.unity3d.com/6000.5/Documentation/Manual/animeditor-CreatingANewAnimationClip.html)
- Test art: [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) and [HQ Trooper by drakzlin](https://opengameart.org/content/space-soldier-resize-64x64), both CC0
