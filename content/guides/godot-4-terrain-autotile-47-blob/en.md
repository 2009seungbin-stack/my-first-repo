Godot 4 autotiles with **terrains**: add a terrain set in **Match Corners and Sides** mode to your TileSet, give every tile of a 47-tile "blob" sheet its terrain and its eight peering bits, then paint with the **Terrains** tab of a TileMapLayer (or call `set_cells_terrain_connect()`). When Godot puts the wrong tile down, the sheet is almost always missing a combination or has a bit painted wrong. Godot does not warn you. It quietly uses the closest tile it has, and that choice can spill over onto the neighbouring cells.

This guide sets up a real 47-tile sheet, shows the same TileSet built in GDScript, and reproduces each "wrong tile" cause in Godot 4.7.2 so you can recognise it on sight.

![A cave terrain painted by Godot 4.7.2 with set_cells_terrain_connect](shot:engine-godot-terrain-47 "Rendered by Godot 4.7.2 (Compatibility renderer): a Match Corners and Sides terrain built from the CC0 cave 47-tile sheet by \"second\" (OpenGameArt), painted with one set_cells_terrain_connect call. All 43 cells got the tile their neighbourhood asks for.")

## How Godot 4 terrains work {#how-terrains-work}

A TileSet owns one or more **terrain sets**. Each set has a **mode** and a list of **terrains** (grass, dirt, water…). Each tile then says two things:

- **Terrain**: which terrain the tile's centre belongs to.
- **Peering bits**: for each neighbour position, which terrain the tile expects there. `-1` means empty.

When you paint, Godot looks at the terrain around each cell and picks the tile whose bits fit best. The mode decides which bits count:

| Mode | Bits used | Tiles for one terrain | Typical art |
|---|---|---|---|
| Match Corners and Sides | 4 sides + 4 corners | 47 ("blob") | 47-tile sheets, Godot 3 "3×3 minimal" |
| Match Corners | 4 corners | 15 (the 16th is empty) | 2-corner Wang, Godot 3 "2×2" |
| Match Sides | 4 sides | 16 | pipes, roads, fences |

### Why a blob set has 47 tiles {#why-47}

Eight neighbours give 256 on/off combinations. A corner only makes a visible difference when **both** sides next to it are filled: if the tile above is empty, the top edge is drawn anyway, and whatever sits diagonally at the top-right is hidden behind it. Drop the corners that cannot matter and 256 combinations collapse to exactly **47** distinct tiles. That is why 47-tile templates exist: one isolated tile, end caps, straight edges, outer corners, T-junctions, inner corners and the full interior.

The same 47 tiles are published in several different orders (the cr31 ascending order, the GameMaker 8×6 template, the 7×7 "wang blob", the Godot 3 12×4 template…). Nothing inside the PNG says which one you have, so copying a tutorial's bits onto a sheet in a different order produces nonsense.

## Set up a 47-tile terrain in the editor {#setup}

:::steps
1. **Create the layer and TileSet.** Add a **TileMapLayer** node, and in the inspector create a **New TileSet**. Set **Tile Size** to your tile size (64×64 for the sheet above) *before* adding the image.
2. **Add the atlas.** Open the **TileSet** panel at the bottom of the editor and drag the PNG onto it. Answer **Yes** when Godot offers to create tiles automatically. Set **Margins** and **Separation** if your sheet has gaps between tiles.
3. **Add a terrain set.** In the TileSet inspector, open **Terrain Sets**, click **Add Element**, and set **Mode** to **Match Corners and Sides**.
4. **Add a terrain.** Inside that terrain set, add a terrain under **Terrains**. Give it a name and a colour you can see against your art.
5. **Mark the tiles.** In the TileSet panel choose **Paint**, pick **Terrains** as the property to paint, then choose terrain set 0 and your terrain. Click the centre of every terrain tile to set its terrain, then click each side and corner zone that should connect. Right-click clears a zone.
6. **Check all 47.** Each of the 47 combinations must appear exactly once (or several times with identical bits, as random variants). Leave a corner bit off when either side next to it is open.
7. **Paint.** Select the TileMapLayer, open the **Terrains** tab of the TileMap panel, choose **Connect** mode and your terrain, and paint. Use **Path** mode for corridors and roads.
:::

> **Godot 4.3+:** the multi-layer `TileMap` node is deprecated in favour of one **TileMapLayer** node per layer. An old TileMap converts through the toolbox icon at the top right of the TileMap panel: **Extract TileMap layers as individual TileMapLayer nodes**.

## Build the same TileSet in GDScript {#gdscript}

Clicking 188 peering bits by hand invites mistakes. If you know the sheet's layout, a short script sets them all. This one reads a table of neighbour masks (N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128) in GameMaker 47-template order. It builds exactly the TileSet shown in the images on this page.

```gdscript
# blob47_tileset.gd - builds a "Match Corners and Sides" terrain set from a 47-tile sheet.
# Each number is the tile's neighbour mask (N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128),
# written in the order of the GameMaker 47-tile template. null = unused cell.
class_name Blob47Tileset

const MASKS := [
	[null, 127, 253, 125, 247, 119, 245, 117],
	[223, 95, 221, 93, 215, 87, 213, 85],
	[31, 29, 23, 21, 124, 116, 92, 84],
	[241, 209, 113, 81, 199, 71, 197, 69],
	[17, 68, 28, 20, 112, 80, 193, 65],
	[7, 5, 16, 4, 1, 64, 0, 255],
]

# mask bit -> Godot peering bit
const BITS := {
	1: TileSet.CELL_NEIGHBOR_TOP_SIDE,
	2: TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER,
	4: TileSet.CELL_NEIGHBOR_RIGHT_SIDE,
	8: TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER,
	16: TileSet.CELL_NEIGHBOR_BOTTOM_SIDE,
	32: TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER,
	64: TileSet.CELL_NEIGHBOR_LEFT_SIDE,
	128: TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER,
}


static func build(texture: Texture2D, tile_px: int, skip := []) -> TileSet:
	var ts := TileSet.new()
	ts.tile_size = Vector2i(tile_px, tile_px)
	ts.add_terrain_set()
	ts.set_terrain_set_mode(0, TileSet.TERRAIN_MODE_MATCH_CORNERS_AND_SIDES)
	ts.add_terrain(0)
	ts.set_terrain_name(0, 0, "Cave")

	var src := TileSetAtlasSource.new()
	src.texture = texture
	src.texture_region_size = ts.tile_size
	ts.add_source(src, 0)  # add the source first: TileData checks bits against the TileSet

	for row in MASKS.size():
		for col in MASKS[row].size():
			var mask = MASKS[row][col]
			if mask == null or mask in skip:
				continue
			var coords := Vector2i(col, row)
			src.create_tile(coords)
			var td := src.get_tile_data(coords, 0)
			td.terrain_set = 0
			td.terrain = 0  # the tile's centre belongs to terrain 0
			for bit in BITS:
				if mask & bit:
					td.set_terrain_peering_bit(BITS[bit], 0)  # neighbour must be terrain 0
				# bits left unset stay -1 = "empty" on that side/corner
	return ts
```

Then paint from code. `set_cells_terrain_connect(cells, terrain_set, terrain, ignore_empty_terrains = true)` joins every cell to matching neighbours. `set_cells_terrain_path()` only joins *consecutive* cells of the array:

```gdscript
# level.gd - attach to a TileMapLayer node
extends TileMapLayer

func _ready() -> void:
	tile_set = Blob47Tileset.build(preload("res://cave-autotile47.png"), 64)

	# A 6x4 room: one call, so every cell sees its final neighbours.
	var room: Array[Vector2i] = []
	for y in 4:
		for x in 6:
			room.append(Vector2i(x, y))
	set_cells_terrain_connect(room, 0, 0)  # terrain set 0, terrain 0

	# A corridor that only joins consecutive cells of the path.
	var corridor: Array[Vector2i] = [Vector2i(8, 1), Vector2i(9, 1), Vector2i(10, 1), Vector2i(10, 2)]
	set_cells_terrain_path(corridor, 0, 0)
```

To use your own sheet with this script, replace `MASKS` with your layout's table. To save the result as a `.tres`, call `ResourceSaver.save(ts, "res://cave_tileset.tres")` once.

### Connect or Path? {#connect-vs-path}

**Connect** mode (what `set_cells_terrain_connect` does) links a cell to every same-terrain neighbour on the layer. **Path** mode (`set_cells_terrain_path`) links only cells painted in the same stroke, one after another. Two roads painted side by side in Path mode stay two roads. In Connect mode they merge into one wide road.

## Why Godot puts the wrong tile down {#wrong-tiles}

The class reference says it plainly: terrain painting "requires the TileMapLayer's TileSet to have terrains set up with all required terrain combinations. Otherwise, it may produce unexpected results." Here is what "unexpected" looks like, reproduced in Godot 4.7.2.

### 1. A combination is missing {#missing-combination}

When no tile matches a cell's neighbourhood, Godot does not leave a gap or print a warning. It scores every tile of the terrain and uses the one with the fewest mismatched bits. To show this, we deleted the four single inner-corner tiles (masks 127, 253, 247, 223) from a complete set and painted the same map again:

![Godot 4.7.2 substituting tiles when four inner corners are missing](shot:engine-godot-terrain-missing "Rendered by Godot 4.7.2: the same map with four inner-corner tiles removed from the TileSet (CC0 GameMaker 47 template by MechanicalRage). Outlined cells got a substitute: an extra inner-corner notch appears where there should be none.")

Six cells came out wrong, and one of them *had* a correct tile available. Godot's substitute for the missing inner corner claimed a corner the neighbouring cell also shares, so that neighbour was changed to agree. One missing tile can therefore corrupt a cell that is not missing anything.

**Fix:** complete the set. Count the combinations your mode needs (47, 16 or 16) and check each one appears. If your art cannot supply a combination, paint that area as plain tiles, or change the map so the combination never occurs.

### 2. Painting order changes the result {#painting-order}

Every connect call can rewrite neighbours that were already placed. With a complete set, order makes no difference: we painted the 43-cell map in one call, in two halves, cell by cell forwards and cell by cell backwards, and got identical results. With the incomplete set from case 1, cell-by-cell painting forwards differed from the single call in 1 cell, and backwards in 6 cells. That is the "results depend on painting order" behaviour reported in [godot#73903](https://github.com/godotengine/godot/issues/73903).

**Fix:** complete the set first. In code, pass all cells of one terrain in **one** `set_cells_terrain_connect` call instead of looping over cells.

### 3. A corner bit behind an open side {#corner-bits}

A frequent hand-painting mistake is marking a corner as connected because the art "looks filled" there, even though the side next to it is open. We added one wrong bit to the top-left outer corner tile (mask 28, sides E and S): its top-right corner. Godot then refused that tile wherever it belonged and used the E+S tile *with* an inner-corner notch (mask 20) instead. Both top-left block corners on the map grew a stray notch.

**Fix:** in Match Corners and Sides, set a corner bit only when both sides next to it are set.

### 4. Bits painted on the wrong terrain, or no centre terrain {#wrong-terrain}

A tile whose **Terrain** is still `-1` is ignored by terrain painting, even if its peering bits are set. With several terrains, a bit painted with terrain 1 instead of 0 turns a grass edge into a grass→sand transition. Godot will only choose that tile where sand really is next door. In the TileSet panel's **Paint → Terrains** view, the colours show which terrain every zone carries, so a wrong colour is easy to spot once you look.

### 5. Variants and probability {#probability}

Several tiles may carry identical bits (for example three full-rock variants). Godot then picks one at random, weighted by each tile's **Probability**. In our test on a 28×28 interior, two full tiles at probability 1.0 split 404/380. With the variant at 0.25, the split was 165/619, and at 0.0 the variant was never used.

## Tools that help {#tools}

If Godot's matcher still fights you, community plugins replace or extend it. [Better Terrain](https://github.com/Portponky/better-terrain) adds its own rule types. [Terrain Autotiler](https://github.com/dandeliondino/terrain-autotiler) re-implements the matching so it no longer depends on order. For corner-only art, a dual grid avoids 47-tile sets entirely: see [the dual-grid guide](guide:dual-grid-autotile). If your art is an RPG Maker A2 block, see [RPG Maker A2 to Godot](guide:rpg-maker-a2-autotile-to-godot). For thin lines between tiles, see [tile seams and bleeding](guide:tile-seams-texture-bleeding-padding-extrude).

:::nerulio ws=tile
The Nerulio Tile workspace does the bit work for you and tells you what is missing before you open Godot. It identifies the layout from the pixels (GameMaker 47, cr31, 7×7 wang blob, Godot 3 12×4, 16-tile edge and corner sets) and shows each candidate with a confidence score. It then fills in every peering bit and checks the set.
- Drop your sheet into the Tile workspace and click **Use this grid**, then **Apply** on the recognised layout.
- The **Check** panel lists missing combinations as ghost tiles, duplicates, and corner bits behind open sides.
- The **Test map** paints with the **Godot 4** rule, a port of `set_cells_terrain_connect` that matched Godot 4.7.2 cell for cell in our checks. Cells where Godot would substitute a tile are outlined.
- **Export → Godot 4** gives the PNG, a JSON and `nerulio_tileset_import.gd`, which builds the TileSet with terrains in Godot. This importer was verified in Godot 4.7.2.
:::

![Nerulio Tile workspace with the recognised GameMaker 47 layout](shot:studio-tile-layout "Nerulio Tile workspace: the cave sheet recognised as the GameMaker 47-tile layout (medium confidence, seam score 96.4%), with its peering bits applied and the check reporting 47/47 combinations.")

## FAQ {#faq}

### Why does Godot 4 place the wrong autotile? {#faq-1}
Usually a combination is missing from the TileSet or a peering bit is wrong. Godot then silently uses the tile with the fewest mismatched bits, and may change neighbouring cells to agree with that substitute. Complete all 47 (or 16) combinations and recheck corner bits.

### How many tiles does a Godot 4 terrain need? {#faq-2}
For one terrain against empty space: 47 tiles in Match Corners and Sides, 16 in Match Sides, and 15 in Match Corners (the 16th corner combination is all empty and needs no tile). Each additional terrain transition needs its own set of combinations.

### Where did autotile bitmasks go in Godot 4? {#faq-3}
They were replaced by terrains. The per-tile bitmask became the tile's peering bits, a 47-tile "3×3 minimal" set becomes a Match Corners and Sides terrain, and a "2×2" set becomes Match Corners.

### What is the difference between set_cells_terrain_connect and set_cells_terrain_path? {#faq-4}
`set_cells_terrain_connect` joins each cell to every same-terrain neighbour on the layer. `set_cells_terrain_path` only joins cells that follow each other in the array, like drawing a road stroke. Both take `(cells, terrain_set, terrain, ignore_empty_terrains = true)`.

### Should I use TileMap or TileMapLayer? {#faq-5}
Use TileMapLayer. Since Godot 4.3 the TileMap node is deprecated and each layer is its own TileMapLayer node. The terrain API is the same.

## Sources {#sources}

- [Using TileSets — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html) (terrain sets, modes, peering bits, automatic tile creation)
- [Using TileMaps — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html) (Connect and Path painting modes)
- [TileMapLayer class reference (4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html) (`set_cells_terrain_connect`, `set_cells_terrain_path`)
- [TileSet class reference (4.7)](https://docs.godotengine.org/en/stable/classes/class_tileset.html) (`TerrainMode`, `CellNeighbor`)
- [TileData class reference (4.7)](https://docs.godotengine.org/en/stable/classes/class_tiledata.html) (`terrain_set`, `terrain`, `probability`, `set_terrain_peering_bit`)
- [TileMap class reference (4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemap.html) (deprecation note)
- [godotengine/godot#73903: terrain results depend on painting order](https://github.com/godotengine/godot/issues/73903)
- Art: [Cave platformer tileset 47](https://opengameart.org/content/cave-platformer-tileset-47) and [GameMaker autotile templates](https://opengameart.org/content/gamemaker-autotile-templates), both CC0 on OpenGameArt
