A dual-grid tilemap stores your terrain on one grid and draws it on a second grid shifted by half a tile. Every drawn tile then sits where four logic cells meet, so it only needs to know which of those four corners are filled. That makes **16 combinations (15 tiles plus empty)** instead of the 47 a blob autotile needs. In Godot 4 you build it from two TileMapLayers: a hidden logic layer, and a display layer offset by half a tile that a short script fills from a 4-corner mask.

Below: why the numbers work, a tested GDScript implementation, how Godot's own Match Corners mode differs (it is *not* a dual grid), and the Tiled equivalent.

![A dual-grid map rendered by Godot 4.7.2 with the logic grid overlaid](shot:engine-dual-grid "Rendered by Godot 4.7.2 with the dual_grid.gd script below and the CC0 \"Wang S-V2\" 2-corner template by Wisp0468 (OpenGameArt), 32 px tiles at 2×. Thin lines are the logic (world) grid, dots are the painted cells; the drawn tiles sit half a tile off, centred on the grid points.")

## Why 16 tiles instead of 47 {#why-16}

In a normal autotile, each tile sits *on* a logic cell and must show how that cell meets its eight neighbours. The eight neighbours give 256 combinations, which reduce to 47 because a corner only matters when both sides next to it are filled (see [Godot 4 terrains and the 47-tile blob](guide:godot-4-terrain-autotile-47-blob)).

A dual grid moves the drawn tile so that its centre is a **grid point**, the spot where four logic cells meet. Each quarter of the drawn tile belongs to exactly one logic cell, so the tile only answers four yes/no questions: are the NW, NE, SE and SW cells filled? That is 2⁴ = 16 combinations. The all-empty one usually draws nothing, so an artist paints 15 tiles, and several of those are rotations of each other. The "is this corner an inner corner or an outer corner?" problem that makes blob sets large disappears, because the corner cells themselves are the data.

This is the same set the tiling literature calls the **2-corner Wang set**, and the one Godot 3 called the "2×2" bitmask. The technique became widely known through Oskar Stålberg's work and the jess::codes video [Draw fewer tiles – by using a Dual-Grid system!](https://youtu.be/jEWFSv3ivTg).

What you give up:

- **The art is drawn on the corners.** A drawn tile's centre is a grid point, so the terrain edges must run through the middle of the tile. You cannot reuse a normal 47-tile sheet as-is.
- **Two layers to keep in sync.** Gameplay (collision, pathfinding, "what is at this cell?") lives on the logic layer. Only the look lives on the display layer.
- **Single cells look round.** A lone painted cell becomes four quarter-tiles around it, so its shape comes from the art's corners, not from a dedicated "isolated" tile.

## Build a dual grid in Godot 4 {#godot-dual-grid}

:::steps
1. **Get a 16-tile corner sheet.** Use a 4×4 sheet with one tile per corner combination (NW, NE, SE, SW filled or empty), such as the 2-corner Wang template in the image. Note which mask each cell stands for.
2. **Create one TileSet.** Set **Tile Size** to your tile size and add the sheet as an atlas. No terrain sets are needed: the script chooses the tiles.
3. **Add two TileMapLayers.** Name one `World` (the logic layer) and one `Display`. Give both the same TileSet, and turn off **Visible** on `World` when you are done painting it.
4. **Attach the script.** Put `dual_grid.gd` (below) on `Display` and assign `World` to its **World Layer** property. At startup it moves `Display` up and left by half a tile and draws every display cell from its four world cells.
5. **Paint the world.** Paint `World` with any tile of the set, or call `set_terrain(cell, true)` from code. Each change redraws the four display cells that touch that world cell.
6. **Put gameplay on World.** Add collision to the tiles `World` uses (or a separate physics layer), and query `World` in code. `Display` is cosmetic.
:::

```gdscript
# dual_grid.gd - attach to the DISPLAY TileMapLayer (the one players see).
# world_layer is a second, hidden TileMapLayer where you (or your game) paint terrain.
extends TileMapLayer

@export var world_layer: TileMapLayer

# 4-corner mask (NW=1, NE=2, SE=4, SW=8) -> atlas coords of the tile that shows it.
# This table matches the 4x4 "2-corner Wang" template; change it for your sheet.
const ATLAS := {
	8: Vector2i(0, 0), 6: Vector2i(1, 0), 13: Vector2i(2, 0), 12: Vector2i(3, 0),
	5: Vector2i(0, 1), 14: Vector2i(1, 1), 15: Vector2i(2, 1), 11: Vector2i(3, 1),
	2: Vector2i(0, 2), 3: Vector2i(1, 2), 7: Vector2i(2, 2), 9: Vector2i(3, 2),
	0: Vector2i(0, 3), 4: Vector2i(1, 3), 10: Vector2i(2, 3), 1: Vector2i(3, 3),
}


func _ready() -> void:
	# The display grid sits half a tile up-left of the world grid.
	position = world_layer.position - Vector2(tile_set.tile_size) / 2.0
	for c in world_layer.get_used_cells():
		refresh_around(c)


func is_filled(world_cell: Vector2i) -> bool:
	return world_layer.get_cell_source_id(world_cell) != -1


# Display cell (x, y) covers the corners where world cells (x-1..x, y-1..y) meet.
func refresh_display_cell(d: Vector2i) -> void:
	var mask := 0
	if is_filled(d + Vector2i(-1, -1)): mask |= 1  # NW
	if is_filled(d + Vector2i(0, -1)): mask |= 2   # NE
	if is_filled(d): mask |= 4                     # SE
	if is_filled(d + Vector2i(-1, 0)): mask |= 8   # SW
	set_cell(d, 0, ATLAS[mask])  # for "terrain over nothing", erase_cell(d) when mask == 0


# One world cell touches four display cells.
func refresh_around(world_cell: Vector2i) -> void:
	for off in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)]:
		refresh_display_cell(world_cell + off)


# Call this from your game or editor tool to paint.
func set_terrain(world_cell: Vector2i, filled: bool) -> void:
	if filled:
		world_layer.set_cell(world_cell, 0, ATLAS[15])
	else:
		world_layer.erase_cell(world_cell)
	refresh_around(world_cell)
```

### How the offset works {#offset}

Display cell `(x, y)` is drawn half a tile up and left, so it covers the bottom-right quarter of world cell `(x-1, y-1)`, the bottom-left quarter of `(x, y-1)`, the top-left quarter of `(x, y)` and the top-right quarter of `(x-1, y)`. Those are exactly the four cells the mask reads. A world map of W×H cells therefore needs (W+1)×(H+1) display cells. In our run, all 160 display cells of a 15×9 world matched an independently computed corner mask.

The table `ATLAS` is the only part that depends on your art. If your sheet uses a different order (for example the "binary" order where tile *n* has mask *n*), write that table instead. Getting it wrong shows up immediately as edges pointing the wrong way.

### Editor preview and ready-made plugins {#plugins}

The script above draws at runtime. To see the result while painting in the editor, make it a `@tool` script and redraw when `World` changes, or use a plugin. [TileMapDual](https://github.com/pablogila/TileMapDual) (MIT) is a custom TileMapLayer node that does this in the editor and in game, and supports square and isometric grids. The [GDScript port of jess::codes' system](https://github.com/GlitchedinOrbit/dual-grid-tilemap-system-godot-gdscript) is a minimal reference implementation. Making dual grids part of the engine is proposed in [godot-proposals#10567](https://github.com/godotengine/godot-proposals/issues/10567), which is still open.

## Why Godot's Match Corners mode is not a dual grid {#match-corners}

Godot 4 terrains have a **Match Corners** mode, and a corner set fits it: 15 tiles, with corner peering bits only. But Godot draws those tiles **on the painted cells**, not half a tile off. A painted cell is treated as a corner *point*, so the terrain is drawn between the centres of painted cells:

![The same map painted with Godot's Match Corners terrain](shot:engine-godot-match-corners "Rendered by Godot 4.7.2: the same 38 cells painted with set_cells_terrain_connect on a Match Corners terrain made from the same 15 tiles. The sand shrinks to the area between painted cell centres, and single cells and one-cell-wide lines become water-only tiles. Dark cells were never painted.")

Every shape shrinks by half a cell on each side, and single cells or one-cell-wide lines vanish. Only 1 of the 38 painted cells got the full-sand tile. Match Corners is still useful when you *think* in grid points: paint the corners you want filled, and accept that the painted cells are the corners. If you want "the cell I clicked is sand", use the two-layer dual grid.

## Tiled and other editors {#tiled}

Tiled's terrain system calls this a **Corner Set**. The manual notes that "a complete set with 2 terrains has 16 tiles". The Terrain Brush on a corner set paints the grid points between tiles, which is the same idea as a dual grid. What you store in the map is the resulting tiles, not the corner data. See [Tiled terrain sets](guide:tiled-wang-sets-terrain) for setup and export. LDtk can imitate a dual grid with auto-layer rules and a half-tile offset.

## Multiple terrains {#multiple-terrains}

With two terrains (sand and water, as in the images), mask 0 is the "all water" tile, so every display cell is drawn. With more terrains, the common approach is one display layer per terrain, stacked in priority order (water, then sand over it, then grass over that). Each layer uses its own 16-tile "terrain over transparent" set and erases its mask-0 cells, as the comment in the script says. That keeps 15 tiles per terrain instead of a transition set for every pair.

:::nerulio ws=tile
The Nerulio Tile workspace recognises 16-tile corner sheets (cr31 2-corner / Godot 3 "2×2" / the dual-grid 4×4 order) from the pixels, and packs with several blocks get their terrains recognised. It can also *generate* a dual-grid 16 set from the same quarter tiles it uses for 47-tile sets, for example from an RPG Maker A2 block.
- The **Test map** shows the **Tiled** rule (corner sets drawn half a tile off, like a dual grid) and the **Godot 4** rule (corner sets on cells, as in the second image above).
- **Export → Tiled** writes a corner Wang set, plus a sample map whose layer is offset by half a tile. It was read back by Tiled 1.12.2.
- **Export → Godot 4** writes a Match Corners terrain, verified in Godot 4.7.2. For a true dual grid in Godot, use that set's `ATLAS` table with the script above or TileMapDual. The Unity export does not include corner sets, because a RuleTile draws on cells.
:::

## FAQ {#faq}

### How many tiles does a dual-grid tileset need? {#faq-1}
16 corner combinations, of which the all-empty one usually draws nothing, so 15 tiles per terrain. Up to rotation there are only 5 distinct shapes (one corner, two adjacent corners, two opposite corners, three corners, full), so if your art may be rotated you can draw 5 tiles and rotate the rest.

### Is a dual grid the same as Godot's Match Corners terrain? {#faq-2}
No. Both use the same 15-tile corner set, but Match Corners draws tiles on the painted cells and treats the cells as corner points, so shapes shrink by half a cell. A dual grid draws on a second grid offset by half a tile, so each painted cell shows up as filled.

### Can I use a normal 47-tile tileset with a dual grid? {#faq-3}
Not directly. Dual-grid tiles are drawn with terrain edges through the middle of the tile, while blob tiles put the edges on the tile border. You need a corner (16-tile) sheet, or a tool that assembles one from the same quarter pieces.

### Where should collision go in a dual-grid setup? {#faq-4}
On the logic (world) layer, which is aligned with your gameplay grid. The display layer is offset by half a tile and only exists for looks.

### Does Tiled support dual-grid tilesets? {#faq-5}
Yes, as a Corner Set in its terrain system: the Terrain Brush paints grid points and places the matching corner tiles. Engines then load the resulting tiles like any other Tiled map.

## Sources {#sources}

- [Using TileSets — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html) (terrain modes, Match Corners)
- [TileMapLayer class reference (4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html) (`set_cell`, `erase_cell`, `get_cell_source_id`, `set_cells_terrain_connect`)
- [Using Terrains — Tiled 1.12 documentation](https://doc.mapeditor.org/en/stable/manual/terrain/) (Corner Set, Edge Set, Mixed Set)
- [godot-proposals#10567: Add a dual-grid tilemap system](https://github.com/godotengine/godot-proposals/issues/10567)
- [TileMapDual](https://github.com/pablogila/TileMapDual) and [dual-grid-tilemap-system-godot-gdscript](https://github.com/GlitchedinOrbit/dual-grid-tilemap-system-godot-gdscript) (community implementations)
- [jess::codes — Draw fewer tiles, by using a Dual-Grid system!](https://youtu.be/jEWFSv3ivTg)
- Art: [Tileset templates by Wisp0468](https://opengameart.org/content/tileset-templates) (CC0, OpenGameArt)
