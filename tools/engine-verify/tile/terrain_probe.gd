# Nerulio Studio (Tile) terrain probe for Godot 4. NOT shipped to users.
#
# Runs headless inside a throw-away project that tools/engine-verify/tile/tile_verify.py writes:
#   godot --headless --path <project> --script res://_verify/terrain_probe.gd
# It builds the TileSet THROUGH THE IMPORTER THE BUNDLE SHIPS (its Builder class), reloads the
# saved .tres with the cache bypassed, then for every case in job.json paints a fresh
# TileMapLayer with the listed set_cells_terrain_connect calls (in order) and reports which atlas
# tile Godot put in every cell. Judging happens in Python against the Studio's own prediction and
# against the corpus truth.
extends SceneTree

var report := {"errors": [], "cases": {}}


func _initialize() -> void:
	report["godot"] = Engine.get_version_info()
	var job: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://_verify/job.json"))
	if typeof(job) != TYPE_DICTIONARY:
		report["errors"].append("job.json missing")
		_finish()
		return
	var importer: String = job.get("importer", "res://nerulio_tileset_import.gd")
	var script: GDScript = load(importer)
	if script == null or script.reload() != OK:
		report["errors"].append("the shipped importer does not parse")
		_finish()
		return
	var consts := script.get_script_constant_map()
	if not consts.has("Builder"):
		report["errors"].append("the shipped importer has no Builder class")
		_finish()
		return
	var builder: Object = consts["Builder"].new()
	var out_res := "res://_verify/tileset.tres"
	var ok: bool = builder.build(job.get("json", "res://nerulio-tileset.json"), out_res)
	report["importer_log"] = Array(builder.get("log_lines"))
	report["importer_problems"] = Array(builder.get("problems"))
	if not ok:
		report["errors"].append("the shipped importer reported failure")
		_finish()
		return
	var ts: TileSet = ResourceLoader.load(out_res, "TileSet", ResourceLoader.CACHE_MODE_IGNORE)
	if ts == null:
		report["errors"].append("the saved TileSet did not reload")
		_finish()
		return
	var src: TileSetAtlasSource = ts.get_source(ts.get_source_id(0))
	var tiles := {}
	for i in src.get_tiles_count():
		var c := src.get_tile_id(i)
		var td := src.get_tile_data(c, 0)
		var bits := {}
		for n in [TileSet.CELL_NEIGHBOR_RIGHT_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER, TileSet.CELL_NEIGHBOR_LEFT_SIDE, TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER, TileSet.CELL_NEIGHBOR_TOP_SIDE, TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER]:
			var mode: int = ts.get_terrain_set_mode(td.terrain_set) if td.terrain_set >= 0 else -1
			var corner: bool = (int(n) % 2) == 1
			if mode == TileSet.TERRAIN_MODE_MATCH_CORNERS_AND_SIDES or (mode == TileSet.TERRAIN_MODE_MATCH_CORNERS and corner) or (mode == TileSet.TERRAIN_MODE_MATCH_SIDES and not corner):
				bits[str(n)] = td.get_terrain_peering_bit(n)
		tiles["%d,%d" % [c.x, c.y]] = {"terrain_set": td.terrain_set, "terrain": td.terrain, "bits": bits,
			"polygons": td.get_collision_polygons_count(0) if ts.get_physics_layers_count() > 0 else 0,
			"probability": td.probability}
	var sets := []
	for s in ts.get_terrain_sets_count():
		var names := []
		for t in ts.get_terrains_count(s):
			names.append(ts.get_terrain_name(s, t))
		sets.append({"mode": ts.get_terrain_set_mode(s), "terrains": names})
	report["tileset"] = {"tile_size": [ts.tile_size.x, ts.tile_size.y], "margins": [src.margins.x, src.margins.y],
		"separation": [src.separation.x, src.separation.y], "terrain_sets": sets, "tiles": tiles,
		"physics_layers": ts.get_physics_layers_count()}
	for case: Dictionary in job.get("cases", []):
		var layer := TileMapLayer.new()
		layer.tile_set = ts
		root.add_child(layer)
		for call: Dictionary in case.get("calls", []):
			var coords: Array[Vector2i] = []
			for c: Array in call["cells"]:
				coords.append(Vector2i(int(c[0]), int(c[1])))
			layer.set_cells_terrain_connect(coords, 0, int(call["terrain"]), bool(call.get("ignore_empty", true)))
		var picked := {}
		for v: Vector2i in layer.get_used_cells():
			var a := layer.get_cell_atlas_coords(v)
			picked["%d,%d" % [v.x, v.y]] = [a.x, a.y]
		report["cases"][case["name"]] = picked
		layer.queue_free()
	_finish()


func _finish() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://_verify/out"))
	var f := FileAccess.open("res://_verify/out/report.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("NERULIO_TILE_PROBE_DONE errors=%d" % report["errors"].size())
	quit(0)
