Unity autotiling comes from the **2D Tilemap Extras** package, which has two tile types for it. A **Rule Tile** picks a sprite by checking rules against the 8 neighbouring cells. Each neighbour is a green arrow (**This**: the same tile is there), a red cross (**Not This**) or empty (ignored); the first rule that matches wins, and **Default Sprite** is used when none does. An **Auto Tile** (package 4.2 and later, Unity 6.1+) skips the rules: you paint masks over a sprite sheet (**Mask_2x2** for 16 layouts, **Mask_3x3** for 47/48), and Unity picks the sprite whose mask matches.

This guide was checked in Unity 6000.5.3f1 with 2D Tilemap Extras 8.0.3. A 47-tile CC0 cave tileset was built into a Rule Tile and an Auto Tile by script and painted on a 40 × 30 test map, and every cell's sprite was compared with an independent calculation.

## Set up a 47-tile Rule Tile {#steps}

:::steps
1. **Install the package.** Open **Window → Package Manager**, choose **Unity Registry**, and install **2D Tilemap Extras** (it comes with the 2D templates).
2. **Slice the tileset.** Import the sheet with **Texture Type** **Sprite (2D and UI)**, **Sprite Mode** **Multiple**, **Pixels Per Unit** equal to the tile size (64 for a 64 px tileset, so one tile fills one Grid cell), **Filter Mode** **Point (no filter)** for pixel art and **Compression** **None**. Slice it in the Sprite Editor with **Grid By Cell Size** and click **Apply**.
3. **Create the Rule Tile.** In the Project window, right-click and choose **Create → 2D → Tiles → Rule Tile**. Set **Default Sprite** to the tile drawn when no rule matches; the full interior tile is the usual choice.
4. **Add one rule per tile.** Under **Tiling Rules** click **+**, drag the tile's sprite into the rule's sprite box, and click the cells of the 3 × 3 grid until they match the tile. A green arrow means this Rule Tile must be there and a red cross means it must not. For a corner, set it only when both sides next to it are green arrows, and leave it empty otherwise. That is what keeps a full blob set at 47 rules instead of 256.
5. **Order the rules.** Put rules with more filled-in cells above rules with fewer. Unity checks rules from the top and uses the first match, so a loose rule placed early hides the specific ones below it.
6. **Paint and check.** Drag the Rule Tile into a Tile Palette (**Window → 2D → Tile Palette**) and paint. Draw a one-tile island, a one-tile-wide line, a plus shape and a room with an inner corner; any cell showing the **Default Sprite** is a combination that no rule covers.
:::

![A Unity Tilemap painted with a 47-rule Rule Tile built from a CC0 cave tileset; islands, one-tile lines, inner and outer corners all get the right tile](shot:engine-unity-ruletile-cave "Rendered by Unity 6000.5.3f1 (Built-in Render Pipeline): part of the 40 × 30 test map painted with the scripted 47-rule Rule Tile, 1 texel = 1 screen pixel. All 695 painted cells matched the expected tile. Tileset: cave platformer 47 by \"second\", CC0.")

## How a Rule Tile decides {#how-rules-work}

For each painted cell, the Rule Tile walks **Tiling Rules** from top to bottom. A rule matches when every neighbour it constrains is satisfied:

- **This** (green arrow): the neighbour cell holds *this same Rule Tile asset*.
- **Not This** (red cross): the neighbour cell is empty or holds any other tile. Cells beyond the edge of what you painted are empty, so the edge of a map draws a border.
- **Empty**: that neighbour is not checked.

The first matching rule's **Output** is used. **Single** paints one sprite. **Random** picks from a list using Perlin noise (**Noise** sets how much neighbouring cells vary) and can also rotate or mirror the sprite (**Shuffle**). **Animation** plays the list as frames at a speed between **Min Speed** and **Max Speed**. If no rule matches, the cell gets **Default Sprite**, **Default GameObject** and **Default Collider**. Clicking the centre cell of a rule's grid cycles its transform (**Fixed**, **Rotated**, **Mirror X**, **Mirror Y**, **Mirror XY**, **Rotated Mirror**). With **Rotated**, one rule also matches its 90°, 180° and 270° turns and paints the sprite rotated to fit. That is how a 16-tile set can be drawn from 6 sprites (end, straight, corner, T, cross, single) when the art is symmetrical.

## 47-tile blob vs 16-tile sets {#blob-vs-16}

| Set | Neighbours the rules check | Tiles | Notes |
|---|---|---|---|
| 16 "sides" set | the 4 sides only | 16 | Paths, pipes, walls. No inner corners: an L of three filled cells looks the same as a straight edge |
| 47 "blob" set | 4 sides + each corner when both sides next to it connect | 47 | Full terrain: inner and outer corners, one-tile lines, islands |
| Auto Tile Mask_2x2 | the four 2 × 2 blocks around the cell | 16 | A quarter of the tile counts as floor only when the 3 neighbours in that corner are painted too |
| Auto Tile Mask_3x3 | all 8 neighbours | 47 (docs: 48 layouts) | The same neighbourhoods as the blob set |

A blob tileset has 47 tiles because a corner only matters when both sides next to it are connected. There are 16 side combinations, and the corners that can matter add 31 more distinct cases. If you set all 8 neighbours on every rule, you need a rule for all 256 combinations. Anything you leave out falls back to **Default Sprite**.

## Build the 47 rules by script {#script}

Setting 47 rules by hand means several hundred clicks, which is why people give up on Rule Tiles. The script below builds them from one number per tile: the blob mask of the neighbours that tile expects (N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128, with the image's y pointing down). It compiled and ran in 6000.5.3f1. With the masks of a GameMaker-layout sheet, it produced 47 rules, and all 695 painted cells of the test map showed the expected sprite.

```csharp
// Assets/Editor/BlobRuleTileBuilder.cs  (needs 2D Tilemap Extras, com.unity.2d.tilemap.extras)
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

public static class BlobRuleTileBuilder
{
    // Blob mask bits (image y down): N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128, as Unity cell offsets (y up).
    static readonly (int bit, Vector3Int pos)[] Dirs =
    {
        (1, new Vector3Int(0, 1, 0)), (2, new Vector3Int(1, 1, 0)), (4, new Vector3Int(1, 0, 0)),
        (8, new Vector3Int(1, -1, 0)), (16, new Vector3Int(0, -1, 0)), (32, new Vector3Int(-1, -1, 0)),
        (64, new Vector3Int(-1, 0, 0)), (128, new Vector3Int(-1, 1, 0)),
    };

    // sprites[i] shows the neighbourhood masks[i] (-1 = unused cell). One rule per sprite.
    public static RuleTile Build(Sprite[] sprites, int[] masks, Sprite defaultSprite, string assetPath)
    {
        var rules = new List<RuleTile.TilingRule>();
        for (int i = 0; i < sprites.Length; i++)
        {
            if (masks[i] < 0) continue;
            var rule = new RuleTile.TilingRule
            {
                m_Sprites = new[] { sprites[i] },
                m_NeighborPositions = new List<Vector3Int>(),
                m_Neighbors = new List<int>(),
            };
            for (int d = 0; d < 8; d++)
            {
                bool corner = d % 2 == 1;
                // A corner only counts when both sides next to it are connected; otherwise leave it empty.
                if (corner && ((masks[i] & Dirs[d - 1].bit) == 0 || (masks[i] & Dirs[(d + 1) % 8].bit) == 0))
                    continue;
                rule.m_NeighborPositions.Add(Dirs[d].pos);
                rule.m_Neighbors.Add((masks[i] & Dirs[d].bit) != 0
                    ? RuleTile.TilingRuleOutput.Neighbor.This       // green arrow
                    : RuleTile.TilingRuleOutput.Neighbor.NotThis);  // red cross
            }
            rules.Add(rule);
        }
        var tile = ScriptableObject.CreateInstance<RuleTile>();
        tile.m_DefaultSprite = defaultSprite;
        tile.m_TilingRules = rules.OrderByDescending(r => r.m_Neighbors.Count).ToList(); // most specific first
        AssetDatabase.CreateAsset(tile, assetPath);
        return tile;
    }
}
```

The mask of each tile depends on the sheet's layout (cr31, GameMaker, Godot 3's 12 × 4 template, Tiled's 7 × 7 wang blob …). Using the wrong table is the most common reason a "correct" script still draws the wrong corners. [Godot 4 terrain autotile (47 blob)](guide:godot-4-terrain-autotile-47-blob) shows how to tell the layouts apart.

## Common mistakes, measured {#mistakes}

Each case below was painted on the same 695-cell test map in 6000.5.3f1:

| Mistake | What happened |
|---|---|
| A loose "interior" rule (4 green arrows, corners empty) placed **first** | 63 of 695 cells wrong: every cell with all four sides connected but a corner open (inner corners, crossings) got the plain interior tile |
| The same loose rule placed **last** | 695 / 695 right: the specific rules match first |
| One inner-corner rule missing | the 6 cells that needed it drew **Default Sprite**; everything else was right |
| A second Rule Tile asset (a copy) painted in one column | 25 neighbouring cells changed to edge tiles, because **This** only matches the same asset |
| The complete 47 rules in reverse order | 695 / 695 right, because rules that constrain every side can never overlap |

Other things to check:

- **Pixels Per Unit** not equal to the tile size makes tiles overlap or leave gaps in the Grid. Fix it on the texture, not by scaling the Tilemap.
- **Terrains that should blend** (grass meeting dirt) do not connect across two Rule Tiles. Use one Rule Tile per terrain with its own border art, write a custom rule (**Create → 2D → Tiles → Custom Rule Tile Script**) that treats a sibling tile as **This**, or use a dual-grid setup ([dual-grid autotile](guide:dual-grid-autotile)).
- **Variants of the same rules** (a snow version of the cave) do not need new rules: create a **Rule Override Tile** and swap the sprites. The **⋮** menu of a Rule Tile can also **Copy All Rules** and **Create Rule Tile Template**.

## Auto Tile: masks instead of rules {#auto-tile}

**Auto Tile** was added in 2D Tilemap Extras 4.2 (package versions 4.2.1 to 4.3.1 require Unity 6000.1, and 8.0.3 ships for 6000.5). Unity 6.0 LTS uses 4.1.0, which does not have it. To use it:

1. Slice the sheet as usual.
2. Choose **Create → 2D → Tiles → Auto Tile**, set **Default Sprite**, and pick **Mask Type** **Mask_2x2** or **Mask_3x3**.
3. Under **Used Textures**, click **Add** and drag in the sheet.
4. Click on each sprite to paint red squares over its floor cells.

The Inspector outlines two sprites with the same mask in red. **Save** stores the masks as a template, so another sheet with the same layout only needs **Load**. **Random** (added in package 5.0, Unity 6.2+) picks randomly among sprites that share a mask instead of always using the first one.

We registered the same 47 cave sprites in an Auto Tile with **Mask_3x3** by script and painted the same map. All 695 cells matched the Rule Tile result. So for a standard blob or 16-tile sheet in Unity 6.1+, an Auto Tile does the same job with less setup. A Rule Tile is still the choice when you need **Random** or **Animation** output per rule, rotated or mirrored rules, rules that look further than one cell (**Extend Neighbor**), or custom neighbour logic.

:::nerulio ws=tile
Nerulio Studio's Tile workspace does the mask work for you. Import a tileset and it recognises the layout from the pixels: 12 published layouts, including GameMaker 47, cr31, Godot 3 12 × 4, Tiled wang blob and the 16-tile sets. It shows a confidence score, fills in every tile's neighbours, and checks for missing combinations before you export. The test map paints the set the way Godot or Tiled will. **Export → Unity Rule Tiles** writes the PNG, `nerulio-ruletile.json` and `Editor/NerulioRuleTileImporter.cs`. In Unity, select the JSON and run **Tools → Nerulio → Build Rule Tiles**. It slices the sprites (Point, uncompressed, Pixels Per Unit = tile size) and writes one Rule Tile per terrain, rules most specific first.
- Verified in Unity 6000.5.3f1 with 2D Tilemap Extras 8.0.3: on 10 corpus sets, a painted Tilemap's `GetSprite` matched the Studio's prediction in every cell.
- Not exported to Unity: corner and dual-grid sets (a Rule Tile draws on cells, not grid points), and transitions between terrains (each terrain is its own Rule Tile). It writes Rule Tiles, not Auto Tiles.
- Runs in the browser; the tileset is not uploaded.
:::

![Nerulio Studio Tile workspace recognising the cave sheet as the GameMaker Studio 2 47-tile layout, with the Check panel reporting 47/47 combinations](shot:studio-tile-layout "The Tile workspace names the layout, writes the neighbour bits and reports 47/47 combinations before export.")

## FAQ {#faq}

### Why does my Rule Tile show the default sprite in some cells?

No rule matches that neighbourhood. Paint the smallest shapes (a single tile, a one-wide line, an L, a T, a plus) to find which one. Then add a rule for it, or loosen a corner on an existing rule by setting it to empty where the corner cannot matter.

### Why do my Rule Tiles not connect to each other?

**This** means "the same Rule Tile asset". A second Rule Tile, even an exact copy, counts as **Not This**. Paint connected terrain with one Rule Tile, use a Rule Override Tile for art variants, or write a custom Rule Tile script with your own neighbour check.

### Does the order of Tiling Rules matter?

Yes, whenever two rules can match the same neighbourhood: the first one wins. Put rules with more constrained neighbours first. A complete 47-rule set where every rule constrains all four sides cannot overlap, so its order does not change the result.

### Is Auto Tile available in Unity 6.0 LTS?

No. Auto Tile arrived in 2D Tilemap Extras 4.2, which needs Unity 6.1 (6000.1) or newer. Unity 6.0 uses 4.1.0. On 6.0, use a Rule Tile. You can build it by script as shown above, or generate it with a tool.

### How many tiles does a Rule Tile need?

For full terrain with inner corners, 47 (the blob set). For paths and walls without inner corners, 16. With **Rotated** rules and symmetrical art you can draw a 16-tile set from 6 sprites.

## Sources {#sources}

- 2D Tilemap Extras 8.0 — [Create a rule tile](https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/RuleTile.html)
- 2D Tilemap Extras 8.0 — [Rule Tile Inspector window reference](https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/RuleTile-Inspector.html)
- 2D Tilemap Extras 8.0 — [Create an auto tile](https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/AutoTile.html) and [Auto Tile Inspector window reference](https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/AutoTile-Inspector.html)
- 2D Tilemap Extras — [Changelog](https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/changelog/CHANGELOG.html) (AutoTile added in 4.2.0, Random in 5.0.0)
- 2D Tilemap Extras 8.0 — [Create a custom rule tile script](https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/CustomRulesForRuleTile.html)
- Unity 6.5 Manual — [Create a tile palette](https://docs.unity3d.com/6000.5/Documentation/Manual/tilemaps/tiles-for-tilemaps/create-tile-assets.html)
- Test art: [Cave platformer tileset 47 by "second"](https://opengameart.org/content/cave-platformer-tileset-47), CC0
