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
# 1. Copy this file, the JSON and the PNG into your project (same folder is easiest).
# 2. Set JSON_PATH below if you renamed the JSON.
# 3. Open it in the script editor and run File > Run (Ctrl+Shift+X), or from a terminal:
#      godot --headless --path <project> --script res://nerulio_tileset_import.gd
# It writes <name>.tres next to the JSON and prints what it built.

const JSON_PATH := "res://nerulio-tileset.json"

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

func _run() -> void:
	var text := FileAccess.get_file_as_string(JSON_PATH)
	if text.is_empty():
		push_error("Cannot read %s" % JSON_PATH)
		return
	var data: Variant = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY or not data.has("tileSet"):
		push_error("%s is not a Nerulio tileset JSON" % JSON_PATH)
		return
	var spec: Dictionary = data["tileSet"]
	var folder := JSON_PATH.get_base_dir()
	var image_path := folder.path_join(str(data.get("meta", {}).get("image", "tileset.png")))
	var texture := ResourceLoader.load(image_path)
	if texture == null or not (texture is Texture2D):
		push_error("Cannot load the tileset texture %s" % image_path)
		return

	var tile_set := TileSet.new()
	tile_set.tile_shape = TileSet.TILE_SHAPE_SQUARE
	tile_set.tile_size = Vector2i(int(spec["tileSize"]["w"]), int(spec["tileSize"]["h"]))

	# Terrain sets first: peering bits can only be set once the terrains they name exist.
	for set_index in range(spec.get("terrainSets", []).size()):
		var terrain_set: Dictionary = spec["terrainSets"][set_index]
		tile_set.add_terrain_set()
		tile_set.set_terrain_set_mode(set_index, MODES.get(str(terrain_set.get("mode", "match_sides")), TileSet.TERRAIN_MODE_MATCH_SIDES))
		for terrain_index in range(terrain_set.get("terrains", []).size()):
			var terrain: Dictionary = terrain_set["terrains"][terrain_index]
			tile_set.add_terrain(set_index)
			tile_set.set_terrain_name(set_index, terrain_index, str(terrain.get("name", "Terrain")))
			if terrain.has("color"):
				tile_set.set_terrain_color(set_index, terrain_index, Color(str(terrain["color"])))

	var source := TileSetAtlasSource.new()
	source.texture = texture
	source.texture_region_size = tile_set.tile_size
	source.margins = Vector2i(int(spec.get("margins", {}).get("x", 0)), int(spec.get("margins", {}).get("y", 0)))
	source.separation = Vector2i(int(spec.get("separation", {}).get("x", 0)), int(spec.get("separation", {}).get("y", 0)))
	var source_id := tile_set.add_source(source)

	var made := 0
	var bits := 0
	for tile: Dictionary in spec.get("tiles", []):
		var coords := Vector2i(int(tile["atlas"]["x"]), int(tile["atlas"]["y"]))
		if not source.has_room_for_tile(coords, Vector2i.ONE, 1, Vector2i.ZERO, -1):
			push_warning("No room for tile at %s; skipped" % coords)
			continue
		source.create_tile(coords)
		var tile_data: TileData = source.get_tile_data(coords, 0)
		tile_data.terrain_set = int(tile.get("terrainSet", 0))
		tile_data.terrain = int(tile.get("terrain", 0))
		for name: String in tile.get("peering", {}).keys():
			if not NEIGHBORS.has(name):
				push_warning("Unknown peering bit %s" % name)
				continue
			tile_data.set_terrain_peering_bit(NEIGHBORS[name], int(tile["peering"][name]))
			bits += 1
		made += 1

	var out := folder.path_join("%s.tres" % JSON_PATH.get_file().get_basename())
	var error := ResourceSaver.save(tile_set, out)
	if error != OK:
		push_error("Could not save %s (error %d)" % [out, error])
		return
	print("Saved %s: source %d, %d tiles, %d peering bits, mode %s" % [out, source_id, made, bits, str(spec["terrainSets"][0]["mode"])])
`;
}
/** Setup steps shown in the page and shipped as README.txt. */
export function godotReadme(json){
 const kind=json.tileSet.autotile.kind,mode=json.tileSet.terrainSets[0].mode;
 const steps=[
  'Unzip the three files into your Godot 4 project (the PNG, the JSON and the .gd next to each other).',
  'Open nerulio_tileset_import.gd in the Godot script editor and run it with File > Run (Ctrl+Shift+X).',
  `It saves nerulio-tileset.tres: one terrain set in ${mode} mode with ${json.tileSet.tiles.length} tiles from the ${kind} layout.`,
  'Assign that .tres to a TileMapLayer’s Tile Set, then paint with the Terrains tab.'];
 const notes=[
  'The JSON is the source of truth: atlas coordinates are column/row in the sheet, and every peering bit is named after a TileSet.CellNeighbor constant.',
  json.tileSet.autotile.dualGrid?'This layout is a dual grid: the tiles are drawn half a tile off the terrain grid. Godot’s Match Corners does not offset the layer for you, so the art has to be drawn with that offset already baked in.':'',
  'Godot is not installed in the browser, so this pack is generated, not executed here. See docs/TILE-LAB.md for what has been run in a real Godot build and what has not.'].filter(Boolean);
 return {steps,notes,text:[`Nerulio Tile Lab — Godot 4 pack (${kind}, ${mode})`,'',...steps.map((s,i)=>`${i+1}. ${s}`),'',...notes.map(n=>'- '+n),''].join('\n')};
}
