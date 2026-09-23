Tiled autotiles with **terrain sets** (Wang sets in the file format). Open the tileset, click the **Terrain Sets** button, add a **Corner**, **Edge** or **Mixed** set, add a terrain colour, and paint that colour onto the corners and/or sides of each tile. Then paint the map with the **Terrain Brush** (`T`). The terrain rules stay in Tiled: engines load the tiles Tiled placed. Phaser needs the tileset **embedded** in the JSON map. Tiled's built-in Godot 4 export bakes the tiles without terrain data, while the YATI importer turns Wang sets into real Godot terrain sets.

Everything below was checked with the Tiled 1.12.2 command line, Phaser 3.90.0 and 4.2.1 in Chromium, and Godot 4.7.2.

![A Tiled map with a mixed terrain set, drawn by Phaser](shot:engine-phaser-tiled-wang "Rendered by Phaser 3.90.0 in Chromium (Phaser 4.2.1 drew identical pixels): a Tiled 1.12.2 map painted from a 47-tile mixed terrain set, exported with tiled --embed-tilesets --export-map json. Art: CC0 cave 47-tile sheet by \"second\" (OpenGameArt).")

## Corner, Edge or Mixed: pick the right set type {#set-types}

A terrain set says which parts of each tile belong to which terrain. The type decides which parts you can mark:

| Set type | You mark | Complete set for 2 terrains | Typical art |
|---|---|---|---|
| Corner Set | the 4 corners | 16 tiles | grass/sand transitions, dual-grid art |
| Edge Set | the 4 sides | 16 tiles | roads, fences, pipes, platforms |
| Mixed Set | corners and sides | 256 (or a reduced 47-tile blob) | 47-tile "blob" sheets |

If your sheet has 47 tiles with inner and outer corners, it is a Mixed set. If it has 16 tiles whose edges run through the middle of the tile, it is a Corner set. A set that turns out to be the wrong type can be changed later: right-click it and choose **Terrain Set Properties…**. A terrain set can hold up to 254 terrains.

## Create a terrain set {#setup}

:::steps
1. **Open the tileset.** In the map, select the tileset and click **Edit Tileset** under the Tilesets view (or open the `.tsx`).
2. **Enter terrain mode.** Click the **Terrain Sets** button on the tileset toolbar. The Terrain Sets view appears with a button to add a set.
3. **Add a set.** Add a **Corner Set**, **Edge Set** or **Mixed Set** and name it. Right-click a tile and choose **Use as Terrain Set Image** to give it an icon.
4. **Add terrains.** The set starts with one terrain. Use **Add Terrain** for more, double-click to rename, and right-click → **Pick Custom Color** to recolour. You do not need a terrain for "empty": leave empty parts unmarked.
5. **Mark the tiles.** Select a terrain and click or drag over the corners/sides of each tile that belong to it. Use **Erase Terrain** or `Ctrl+Z` to fix mistakes.
6. **Check the Patterns tab.** Next to **Terrains**, the **Patterns** tab darkens every pattern that already has a tile, so missing ones stand out.
7. **Paint.** Leave terrain mode, open the **Terrain Sets** window in the map editor, pick a terrain and paint with the **Terrain Brush** (`T`). `Shift` draws lines and `Ctrl` enlarges the brush to a whole tile.
:::

In the saved `.tsx` each tile gets a `wangid` of eight numbers: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left. `0` means no terrain.

```xml
<wangsets>
 <wangset name="cave" type="mixed" tile="47">
  <wangcolor name="Rock" color="#e8a33d" tile="47" probability="1"/>
  <!-- tile 20: open at the top, rock to the right, below and left -->
  <wangtile tileid="20" wangid="0,0,1,1,1,1,1,0"/>
 </wangset>
</wangsets>
```

## Painting: brush, fill mode and probability {#painting}

- **Nothing happens when you paint?** On an empty map the brush has nothing to transition from if your set has no "terrain to empty" tiles. Hold `Ctrl` to paint a full tile, or bucket-fill the base terrain first. For sets that do transition to nothing, **Erase Terrain** removes terrain and fixes the neighbours.
- **Terrain Fill Mode.** The Stamp Brush, Bucket Fill and Shape Fill tools have a *Terrain Fill Mode* that fills an area with random tiles which still match everything around them.
- **Variations.** Several tiles with the same pattern are chosen at random. Each tile and each terrain has a **Probability**. A tile's chance is its own probability times the probability of the terrain at each marked corner or side. Probability `0` keeps a tile out of automatic placement but still lets Tiled understand it.
- **Transformations.** In **Tileset Properties** you can allow flipping and rotation, so Tiled can build missing patterns from rotated tiles. **Prefer Untransformed Tiles** keeps the originals first.
- **Missing lone tiles in blob sets.** In a one-terrain blob set, the isolated tile has terrain on none of its eight positions. Its Wang ID is all zeros, which Tiled treats as "no terrain", so that tile is not part of the set (the 47-tile set above has 46 Wang tiles). The brush therefore never places a lone single tile. Place it by hand, or add a second terrain for the background.

## Export to Phaser (Tiled JSON) {#phaser}

Phaser reads Tiled's JSON map format, but **not external tilesets**. With a `.tsx` referenced from the map, both Phaser 3.90.0 and 4.2.1 printed `External tilesets unsupported. Use Embed Tileset and re-export`, then threw an error while building the layer. Three ways to fix it:

- In the map, select the tileset and click **Embed Tileset** in the Tilesets view.
- Or enable **Embed tilesets** under *Edit > Preferences > General > Export Options*. The map file keeps its external tileset and only the export embeds it.
- Or export from the command line:

```shell
tiled --embed-tilesets --export-map json level.tmx level.tmj
```

Then load it:

```js
// game.js - load a Tiled JSON map (exported with embedded tilesets) and draw it.
class Level extends Phaser.Scene {
  preload() {
    this.load.tilemapTiledJSON('level', 'assets/level.tmj');
    this.load.image('cave', 'assets/autotile47.png');
  }
  create() {
    const map = this.make.tilemap({ key: 'level' });
    // 1st argument: the tileset name as written in Tiled; 2nd: the image key loaded above
    const tiles = map.addTilesetImage('autotile47', 'cave');
    map.createLayer('Terrain', tiles, 0, 0);
  }
}

new Phaser.Game({ type: Phaser.WEBGL, width: 896, height: 704, pixelArt: true, scene: Level });
```

The embedded tileset still carries its `wangsets` in the JSON, but Phaser does not autotile at runtime: it draws the tile IDs Tiled saved. If your tileset has margins or spacing (for example after extruding it against seams), pass them as the 5th and 6th arguments of `addTilesetImage(name, key, tileWidth, tileHeight, tileMargin, tileSpacing)`.

## Export to Godot 4 {#godot}

There are two routes, and they give different results:

| Route | Node created | Terrain data in Godot | What we measured (Godot 4.7.2) |
|---|---|---|---|
| Tiled's own **File > Export As…** → *Godot 4 Scene files (\*.tscn)* (since Tiled 1.10) | `TileMap` (deprecated since Godot 4.3) | none | loads, 58 cells drawn, **0 terrain sets** |
| [YATI](https://github.com/Kiamo2/YATI) 2.2.7 import plugin (`.tmx`/`.tmj`) | `TileMapLayer` | Wang set → terrain set with peering bits | 1 terrain set (Match Corners and Sides), 46/46 tiles with terrain, repainting the 58 cells with `set_cells_terrain_connect` gave the same tiles as Tiled |

Tiled's exporter needs the `.tscn`, the tileset image and a `project.godot` in one folder hierarchy. It searches parent folders for the `.godot` file to work out `res://` paths. Use it if you only need the finished map. If you want to keep painting in Godot's **Terrains** tab or call `set_cells_terrain_connect()`, import with YATI instead: copy `addons/YATI` into the project, enable it under **Project Settings → Plugins**, and drop the `.tmx` in. YATI 2.x requires Godot 4.3 or newer. See [Godot 4 terrain autotiling](guide:godot-4-terrain-autotile-47-blob) for what the terrain set does after import.

## Export to Unity {#unity}

Unity has no Tiled importer of its own. [SuperTiled2Unity](https://seanba.itch.io/supertiled2unity) (free or pay what you want) imports `.tmx` files as prefabs built on Unity's Tilemap, with the tiles Tiled placed. Its documentation does not describe turning Tiled terrain sets into Rule Tiles, so for autotiling *inside* Unity, set up a Rule Tile: see [Unity Rule Tile autotiling](guide:unity-rule-tile-autotile).

## LDtk as an alternative {#ldtk}

[LDtk](https://ldtk.io/) takes a different approach. You paint an **IntGrid** layer (cells marked 1, 2, 3…), and **auto-layer rules** (small grid patterns) decide which tile goes where. The rules are easy to see and edit next to the result, but they stay in LDtk: the exported JSON contains the resulting tiles (`autoLayerTiles`), and engines draw those. LDtk 1.5.3 is the current release. Pick Tiled if you need Tiled's object tools, many orientations (isometric, hexagonal, oblique since 1.12) or wide engine support. Pick LDtk for rule-driven level design with typed entities.

:::nerulio ws=tile
Nerulio writes the Tiled terrain set for you. Drop a tilesheet into the Tile workspace: the layout is identified from the pixels (47-tile blob orders, 16-tile edge and corner sets, RPG Maker A2 sources) with a confidence score, and every tile gets its terrain marks.
- **Export → Tiled** gives the PNG, a `.tsx` with a Mixed, Edge or Corner Wang set (one colour per terrain) and a `sample.tmx` painted with that set. Tiled 1.12.2's own command-line exporters read back every Wang ID as written (the Terrain Brush itself was not driven).
- The **Test map** can draw with the **Tiled** rule, so you see what the Terrain Brush will produce, including lone cells it cannot place.
- The same set exports to Godot 4 (terrain set, verified in 4.7.2), LDtk 1.5.3 (IntGrid + rules, partly verified) and Unity (RuleTiles, verified in 6000.5.3f1).
:::

![Nerulio's test map drawn with an engine rule](shot:studio-tile-map "Nerulio Tile workspace: a test map drawn from the cave set, with the engine rule switch (Godot 4 / Tiled) and the check reporting every painted cell.")

## FAQ {#faq}

### Are Tiled terrains and Wang sets the same thing? {#faq-1}
Yes. Since Tiled 1.5, the old terrains and Wang tiles were unified. The editor calls them terrain sets, and the TMX/JSON files store them as `wangsets` with a `wangid` per tile.

### Why does Phaser say "External tilesets unsupported"? {#faq-2}
Your JSON map references a `.tsx`/`.tsj` file instead of containing the tileset. Click **Embed Tileset** in Tiled, enable **Embed tilesets** in the export options, or export with `tiled --embed-tilesets --export-map json`.

### Does Godot keep Tiled's terrain rules? {#faq-3}
Not with Tiled's built-in Godot 4 export, which writes baked tiles into a TileMap node with no terrain sets. The YATI importer converts Wang sets into Godot terrain sets on TileMapLayer nodes, so you can keep painting with terrains.

### Which terrain set type do I need for a 47-tile tileset? {#faq-4}
Mixed. Corner and Edge sets have 16 tiles for two terrains. The 47-tile blob needs both corners and sides, and the Tiled manual lists it as a reduced Mixed set.

### Can Tiled autotile at runtime in my game? {#faq-5}
No. The terrain brush runs only in the editor. Engines load the tile IDs it placed. For runtime autotiling, use the engine's own system (Godot terrains, Unity Rule Tiles) or your own code.

## Sources {#sources}

- [Using Terrains — Tiled 1.12 documentation](https://doc.mapeditor.org/en/stable/manual/terrain/) (set types, marking tiles, Patterns view, Terrain Fill Mode, probability, transformations)
- [Editing Tile Layers — Terrain Brush (Tiled)](https://doc.mapeditor.org/en/stable/manual/editing-tile-layers/#terrain-tool)
- [Preferences — Export Options (Tiled)](https://doc.mapeditor.org/en/stable/manual/preferences/#export-options) (Embed tilesets)
- [Godot 4 export (Tiled)](https://doc.mapeditor.org/en/stable/manual/export-tscn/) (since Tiled 1.10, `res://` resolution)
- [Tilemap API — Phaser documentation](https://docs.phaser.io/api-documentation/class/tilemaps-tilemap) (`addTilesetImage`, `createLayer`) and [LoaderPlugin.tilemapTiledJSON](https://docs.phaser.io/api-documentation/class/loader-loaderplugin)
- [YATI — Yet Another Tiled Importer for Godot 4](https://github.com/Kiamo2/YATI) (Reference.md: Wang set → terrain set mapping)
- [SuperTiled2Unity documentation](https://supertiled2unity.readthedocs.io/)
- [LDtk auto-layer rules](https://ldtk.io/docs/general/auto-layers/auto-layer-rules/)
- Art: [Cave platformer tileset 47](https://opengameart.org/content/cave-platformer-tileset-47) (CC0, OpenGameArt)
