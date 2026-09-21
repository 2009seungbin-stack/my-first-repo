/** Godot 4 terrain export: a generic reference JSON plus a GDScript EditorScript that builds a
 * real TileSet through the engine API. No hand-written .tres is ever produced.
 *
 * Godot 4 replaced the Godot 3 autotile bitmask with terrains. In 3.x a tile carried a bitmask
 * of its own regions (2×2, 3×3 or 3×3-minimal) and the TileMap matched those flags against the
 * same tile id. In 4.x a TileSet owns terrain SETS; each set has a match mode
 * (Match Corners and Sides / Match Corners / Match Sides) and a list of terrains, and each tile
 * says which terrain it belongs to plus, per neighbour position, which terrain it expects there
 * (a "peering bit"). So a 3.x "3×3 minimal" tileset corresponds to a 4.x Match Sides terrain
 * with the four side peering bits, and a 47-tile blob corresponds to Match Corners and Sides
 * with all eight. Peering bit positions are named by TileSet.CellNeighbor; on a square tile
 * shape only the four sides and the four diagonal corners exist. */
export const MODES=Object.freeze(['match_corners_and_sides','match_corners','match_sides']);
/** Our 8-neighbour keys → the TileSet.CellNeighbor constant names, lowercased. */
export const PEERING=Object.freeze({n:'top_side',ne:'top_right_corner',e:'right_side',se:'bottom_right_corner',
 s:'bottom_side',sw:'bottom_left_corner',w:'left_side',nw:'top_left_corner'});
export const SIDE_PEERING=Object.freeze(['top_side','right_side','bottom_side','left_side']);
export const CORNER_PEERING=Object.freeze(['top_right_corner','bottom_right_corner','bottom_left_corner','top_left_corner']);
export const modeFor=kind=>kind==='blob47'?'match_corners_and_sides':kind==='corner16'?'match_corners':'match_sides';
const clean=name=>String(name||'Terrain').replace(/[^\w .-]+/g,'').trim().slice(0,40)||'Terrain';
/** Reference JSON: per tile its atlas coordinates, terrain and peering bits by name.
 * `layout` is an autotile layout (src/game/autotile.js), `grid` a tileRects result. */
export function godotTileSet({layout,grid,offset=0,mode=null,terrainName='Terrain',terrainColor='#4caf50',
 image='tileset.png',width=0,height=0,toolVersion='1'}={}){
 const match=MODES.includes(mode)?mode:modeFor(layout.kind);
 const wanted=match==='match_sides'?SIDE_PEERING:match==='match_corners'?CORNER_PEERING:[...SIDE_PEERING,...CORNER_PEERING];
 const tiles=[];
 for(const slot of layout.slots){
  const rect=grid.rects[slot.index+offset];
  if(!rect)continue;
  const peering={};
  for(const [key,name] of Object.entries(PEERING)){
   if(!wanted.includes(name))continue;
   const on=key.length===1?slot.edges[key]:slot.corners[key];
   if(on)peering[name]=0;
  }
  tiles.push({atlas:{x:rect.col,y:rect.row},terrainSet:0,terrain:0,peering,
   slot:{index:slot.index,kind:slot.kind,key:slot.key,mask:slot.mask,name:slot.name,role:slot.role}});
 }
 return {meta:{tool:'nerulio-tile-lab',toolVersion,schemaVersion:1,engineTarget:'godot-4',image,size:{w:width,h:height}},
  tileSet:{tileSize:{w:grid.tileWidth,h:grid.tileHeight},margins:{x:grid.marginX||0,y:grid.marginY||0},
   separation:{x:grid.spacingX||0,y:grid.spacingY||0},columns:grid.cols,rows:grid.rows,
   autotile:{kind:layout.kind,slots:layout.count,dualGrid:!!layout.dual},
   terrainSets:[{mode:match,terrains:[{name:clean(terrainName),color:terrainColor}]}],tiles}};
}
/** The importer. It is an EditorScript so it runs inside the editor that owns the TileSet format,
 * builds the resource with the public API and saves it with ResourceSaver. */
export function godotScript(){
 return `@tool
extends EditorScript
# Nerulio Tile Lab -> Godot 4 TileSet importer.
# 1. Copy this file, the JSON and the PNG into your project (the same folder is easiest).
# 2. Set JSON_PATH below if you renamed the JSON.
# 3. Open it in the script editor and run File > Run (Ctrl+Shift+X).
# It writes nerulio-tileset.tres next to the JSON and prints what it built.
#
# Godot cannot run an EditorScript from --script, so the work lives in the Builder class below.
# To do it headlessly (or to check the result in CI), put this next to it and run
# \`godot --headless --path <project> --script res://run_import.gd\`:
#
#     extends SceneTree
#     func _initialize() -> void:
#         var b = preload("res://nerulio_tileset_import.gd").Builder.new()
#         var ok: bool = b.build("res://nerulio-tileset.json", "res://nerulio-tileset.tres")
#         for line in b.log_lines: print(line)
#         quit(0 if ok else 1)

const JSON_PATH := "res://nerulio-tileset.json"
const OUTPUT_PATH := "res://nerulio-tileset.tres"


func _run() -> void:
	var builder := Builder.new()
	var built := builder.build(JSON_PATH, OUTPUT_PATH)
	for line in builder.log_lines:
		print(line)
	for line in builder.problems:
		push_warning(line)
	if not built:
		push_error("Nerulio: the TileSet was not saved. See the messages above.")


class Builder extends RefCounted:

	# Peering bit names in the JSON are TileSet.CellNeighbor constant names, lowercased.
	const NEIGHBORS := {
		"right_side": TileSet.CELL_NEIGHBOR_RIGHT_SIDE,
		"bottom_right_corner": TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER,
		"bottom_side": TileSet.CELL_NEIGHBOR_BOTTOM_SIDE,
		"bottom_left_corner": TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER,
		"left_side": TileSet.CELL_NEIGHBOR_LEFT_SIDE,
		"top_left_corner": TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER,
		"top_side": TileSet.CELL_NEIGHBOR_TOP_SIDE,
		"top_right_corner": TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER,
	}
	const MODES := {
		"match_corners_and_sides": TileSet.TERRAIN_MODE_MATCH_CORNERS_AND_SIDES,
		"match_corners": TileSet.TERRAIN_MODE_MATCH_CORNERS,
		"match_sides": TileSet.TERRAIN_MODE_MATCH_SIDES,
	}

	var log_lines: PackedStringArray = []
	var problems: PackedStringArray = []
	var tile_set: TileSet = null
	var source_id := -1

	func build(json_path: String, out_path: String) -> bool:
		var text := FileAccess.get_file_as_string(json_path)
		if text.is_empty():
			problems.append("Cannot read %s" % json_path)
			return false
		var data: Variant = JSON.parse_string(text)
		if typeof(data) != TYPE_DICTIONARY or not data.has("tileSet"):
			problems.append("%s is not a Nerulio tileset JSON" % json_path)
			return false
		var spec: Dictionary = data["tileSet"]
		var folder := json_path.get_base_dir()
		var image_path := folder.path_join(str(data.get("meta", {}).get("image", "tileset.png")))
		var texture: Texture2D = null
		if ResourceLoader.exists(image_path):
			var loaded: Resource = ResourceLoader.load(image_path)
			if loaded is Texture2D:
				texture = loaded
		if texture == null:
			# Outside the editor the PNG may not be imported yet. Reading it straight off disk
			# keeps the run working, but the texture is then stored inside the .tres instead of
			# pointing at the project's own imported image.
			var image := Image.load_from_file(image_path)
			if image == null or image.is_empty():
				problems.append("Cannot load the tileset texture %s" % image_path)
				return false
			texture = ImageTexture.create_from_image(image)
			problems.append("%s was not imported yet, so its pixels are embedded in the TileSet. Let the editor import the PNG and run this again to reference it instead." % image_path)

		tile_set = TileSet.new()
		tile_set.tile_shape = TileSet.TILE_SHAPE_SQUARE
		tile_set.tile_size = Vector2i(int(spec["tileSize"]["w"]), int(spec["tileSize"]["h"]))

		# Terrain sets first: a peering bit can only be set once the terrain it names exists.
		var terrain_sets: Array = spec.get("terrainSets", [])
		for set_index in range(terrain_sets.size()):
			var terrain_set: Dictionary = terrain_sets[set_index]
			tile_set.add_terrain_set()
			tile_set.set_terrain_set_mode(set_index, MODES.get(str(terrain_set.get("mode", "match_sides")), TileSet.TERRAIN_MODE_MATCH_SIDES))
			var terrains: Array = terrain_set.get("terrains", [])
			for terrain_index in range(terrains.size()):
				var terrain: Dictionary = terrains[terrain_index]
				tile_set.add_terrain(set_index)
				tile_set.set_terrain_name(set_index, terrain_index, str(terrain.get("name", "Terrain")))
				if terrain.has("color"):
					tile_set.set_terrain_color(set_index, terrain_index, Color(str(terrain["color"])))

		var source := TileSetAtlasSource.new()
		source.texture = texture
		source.texture_region_size = tile_set.tile_size
		source.margins = Vector2i(int(spec.get("margins", {}).get("x", 0)), int(spec.get("margins", {}).get("y", 0)))
		source.separation = Vector2i(int(spec.get("separation", {}).get("x", 0)), int(spec.get("separation", {}).get("y", 0)))
		source_id = tile_set.add_source(source)

		var made := 0
		var bits := 0
		# The atlas grid already accounts for the region size, the margins and the separation, so
		# it is the honest bound: a coordinate outside it is a mismatch between JSON and PNG.
		var atlas_grid := source.get_atlas_grid_size()
		for tile: Dictionary in spec.get("tiles", []):
			var coords := Vector2i(int(tile["atlas"]["x"]), int(tile["atlas"]["y"]))
			if coords.x < 0 or coords.y < 0 or coords.x >= atlas_grid.x or coords.y >= atlas_grid.y:
				problems.append("Tile %s is outside the %s atlas grid; skipped" % [coords, atlas_grid])
				continue
			source.create_tile(coords)
			var tile_data: TileData = source.get_tile_data(coords, 0)
			tile_data.terrain_set = int(tile.get("terrainSet", 0))
			tile_data.terrain = int(tile.get("terrain", 0))
			var peering: Dictionary = tile.get("peering", {})
			for name: String in peering.keys():
				if not NEIGHBORS.has(name):
					problems.append("Unknown peering bit %s" % name)
					continue
				tile_data.set_terrain_peering_bit(NEIGHBORS[name], int(peering[name]))
				bits += 1
			made += 1

		var error := ResourceSaver.save(tile_set, out_path)
		if error != OK:
			problems.append("Could not save %s (error %d)" % [out_path, error])
			return false
		log_lines.append("Saved %s: source %d, %d tiles, %d peering bits, mode %s" % [
			out_path, source_id, made, bits, str(terrain_sets[0]["mode"]) if terrain_sets.size() else "none"])
		return true
`;
}
/** Setup steps shown in the page and shipped as README.txt. */
export function godotReadme(json){
 const kind=json.tileSet.autotile.kind,mode=json.tileSet.terrainSets[0].mode;
 const steps=[
  'Unzip the three files into your Godot 4 project (the PNG, the JSON and the .gd next to each other).',
  'Let the editor import the PNG (it does that as soon as the project is open), then open nerulio_tileset_import.gd and run it with File > Run (Ctrl+Shift+X).',
  `It saves nerulio-tileset.tres: one terrain set in ${mode} mode with ${json.tileSet.tiles.length} tiles from the ${kind} layout.`,
  'Assign that .tres to a TileMapLayer’s Tile Set, then paint with the Terrains tab.'];
 const notes=[
  'The JSON is the source of truth: atlas coordinates are column/row in the sheet, and every peering bit is named after a TileSet.CellNeighbor constant. A position that is absent means "no terrain" (-1 in the engine).',
  json.tileSet.autotile.dualGrid?'This layout is a dual grid: the tiles are drawn half a tile off the terrain grid. Godot’s Match Corners does not offset the layer for you, so the art has to be drawn with that offset already baked in.':'',
  'Headless (or in CI): Godot cannot run an EditorScript from --script, so put this next to the .gd and run `godot --headless --path <project> --script res://run_import.gd`:\n\n    extends SceneTree\n    func _initialize() -> void:\n        var b = preload("res://nerulio_tileset_import.gd").Builder.new()\n        var built: bool = b.build("res://nerulio-tileset.json", "res://nerulio-tileset.tres")\n        for line in b.log_lines: print(line)\n        for line in b.problems: print(line)\n        quit(0 if built else 1)\n\n  Run `godot --headless --path <project> --import` once first so the PNG is imported.',
  'This pack is generated in your browser; the browser cannot run Godot. See docs/TILE-LAB.md for exactly which Godot build the helper was executed in and what was compared afterwards.'].filter(Boolean);
 return {steps,notes,text:[`Nerulio Tile Lab — Godot 4 pack (${kind}, ${mode})`,'',...steps.map((s,i)=>`${i+1}. ${s}`),'',...notes.map(n=>'- '+n),''].join('\n')};
}
