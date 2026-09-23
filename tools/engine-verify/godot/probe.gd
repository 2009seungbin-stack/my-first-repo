# Nerulio engine-verify probe for Godot 4. NOT shipped to users.
#
# Runs inside a throw-away project that tools/engine-verify/godot_runner.py writes: the exported
# bundle is copied in as-is, `godot --import` runs first, then this script is started WITHOUT
# --headless (the dummy renderer of a headless run cannot draw, and the point is to see pixels):
#
#   godot --path <project> --script res://_verify/probe.gd --resolution 64x64
#
# It reads res://_verify/job.json, loads the export THROUGH THE HELPER THE BUNDLE SHIPS (it never
# builds engine resources itself where the bundle claims to), reloads what was saved with the cache
# bypassed, reports every field it can read back, and renders what the engine draws to PNG files.
# Judging is done afterwards in Python against expectations that come from the ORIGINAL asset, so
# nothing in here decides pass/fail except load errors.
extends SceneTree

const OUT := "res://_verify/out"
var report := {"errors": [], "warnings": []}
var job: Dictionary = {}


func _initialize() -> void:
	report["godot"] = Engine.get_version_info()
	report["renderer"] = {"driver": RenderingServer.get_current_rendering_driver_name(), "method": RenderingServer.get_current_rendering_method()}
	RenderingServer.set_default_clear_color(Color(0, 0, 0, 0))
	root.transparent_bg = true
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://_verify/job.json"))
	if typeof(parsed) != TYPE_DICTIONARY:
		report["errors"].append("job.json missing or invalid")
		_finish()
		return
	job = parsed
	report["mode"] = job.get("mode", "")
	report["project_filter"] = ProjectSettings.get_setting("rendering/textures/canvas_textures/default_texture_filter")
	_run()


func _run() -> void:
	await process_frame
	match String(job.get("mode", "")):
		"spriteframes":
			await _sprite_frames()
		"tileset":
			await _tileset()
		"font":
			await _font()
		"texture":
			await _texture()
		_:
			report["errors"].append("unknown mode %s" % job.get("mode", ""))
	_finish()


func _finish() -> void:
	var f := FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("NERULIO_PROBE_DONE errors=%d" % report["errors"].size())
	quit(0)


# ---------------------------------------------------------------- capture

func _capture(size: Vector2i, name: String) -> String:
	if root.size.x < size.x or root.size.y < size.y:
		root.size = Vector2i(maxi(root.size.x, size.x), maxi(root.size.y, size.y))
		await process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var shot := root.get_texture().get_image()
	if shot == null:
		report["errors"].append("viewport capture returned null (is this a --headless run?)")
		return ""
	shot.convert(Image.FORMAT_RGBA8)
	var crop := shot.get_region(Rect2i(Vector2i.ZERO, size))
	var path := OUT.path_join(name + ".png")
	crop.save_png(path)
	return path.get_file()


func _rect(r: Rect2) -> Array:
	return [r.position.x, r.position.y, r.size.x, r.size.y]


func _import_settings(res_path: String) -> Dictionary:
	# What the importer recorded for a texture: the .import file is the ground truth of how the
	# engine treats the PNG (compression, mipmaps), independent of the bundle's claims.
	var cfg := ConfigFile.new()
	if cfg.load(res_path + ".import") != OK:
		return {"imported": false}
	var out := {"imported": true, "importer": cfg.get_value("remap", "importer", ""), "type": cfg.get_value("remap", "type", "")}
	for key in ["compress/mode", "mipmaps/generate", "process/fix_alpha_border", "process/premult_alpha", "detect_3d/compress_to"]:
		out[key] = cfg.get_value("params", key, null)
	return out


# ---------------------------------------------------------------- SpriteFrames (Sprite Lab bundle)

func _sprite_frames() -> void:
	var helper_path: String = job.get("helper", "res://addons/nerulio_sprite/nerulio_sprite_frames.gd")
	var json_path: String = job["json"]
	if not ResourceLoader.exists(helper_path):
		report["errors"].append("the bundle ships no Godot importer at %s" % helper_path)
		return
	var Builder: GDScript = load(helper_path)
	if Builder == null or Builder.reload() != OK:
		report["errors"].append("the shipped helper %s does not parse" % helper_path)
		return
	var data: Dictionary = Builder.load_data(json_path)
	if data.is_empty():
		report["errors"].append("the shipped helper could not read %s" % json_path)
		return
	var out_res := "res://_verify/sprite_frames.tres"
	var built: SpriteFrames = Builder.import(json_path, out_res)
	if built == null:
		report["errors"].append("the shipped helper did not build a SpriteFrames")
		return
	var frames: SpriteFrames = ResourceLoader.load(out_res, "SpriteFrames", ResourceLoader.CACHE_MODE_IGNORE)
	if frames == null:
		report["errors"].append("the saved SpriteFrames did not reload from disk")
		return
	report["helper_problems"] = Array(Builder.verify(data, frames)) if Builder.has_method("verify") else []
	var pages := []
	for page_name: String in data.get("meta", {}).get("images", []):
		var p := json_path.get_base_dir().path_join(page_name)
		pages.append({"name": page_name, "import": _import_settings(p)})
	report["pages"] = pages
	var anims := {}
	var sprite := AnimatedSprite2D.new()
	sprite.centered = false
	sprite.sprite_frames = frames
	root.add_child(sprite)
	for anim_name: String in frames.get_animation_names():
		var list := []
		for i in frames.get_frame_count(anim_name):
			var tex := frames.get_frame_texture(anim_name, i)
			var entry := {"duration": frames.get_frame_duration(anim_name, i), "size": [tex.get_width(), tex.get_height()]}
			if tex is AtlasTexture:
				entry["region"] = _rect(tex.region)
				entry["margin"] = _rect(tex.margin)
				entry["filter_clip"] = tex.filter_clip
				entry["atlas_size"] = [tex.atlas.get_width(), tex.atlas.get_height()]
			sprite.animation = anim_name
			sprite.frame = i
			sprite.pause()
			entry["png"] = await _capture(Vector2i(tex.get_width(), tex.get_height()), "anim_%s_%03d" % [anim_name.validate_filename(), i])
			list.append(entry)
		anims[anim_name] = {"speed": frames.get_animation_speed(anim_name), "loop": frames.get_animation_loop(anim_name), "frames": list}
	report["animations"] = anims
	sprite.queue_free()
	await process_frame
	# The shipped scene path, drawn the way a new project draws it: the node as the helper builds
	# it, the project's default texture filter, an integer zoom. Pixel art must stay sharp here.
	var scale := int(job.get("scale", 4))
	var names := frames.get_animation_names()
	if names.size() > 0 and Builder.has_method("build_scene"):
		var scene: Node2D = Builder.build_scene(data, frames, names[0])
		var s: AnimatedSprite2D = scene.get_node("Sprite")
		s.pause()
		s.frame = 0
		var tex := frames.get_frame_texture(names[0], 0)
		scene.scale = Vector2(scale, scale)
		scene.position = -s.offset * scale
		root.add_child(scene)
		report["scaled"] = {"animation": names[0], "frame": 0, "scale": scale, "node_filter": s.texture_filter,
			"png": await _capture(Vector2i(tex.get_width() * scale, tex.get_height() * scale), "scaled_%dx" % scale)}
		scene.queue_free()


# ---------------------------------------------------------------- TileSet (Tile Lab pack)

const NEIGHBORS := {
	"right_side": TileSet.CELL_NEIGHBOR_RIGHT_SIDE, "bottom_right_corner": TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER,
	"bottom_side": TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, "bottom_left_corner": TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER,
	"left_side": TileSet.CELL_NEIGHBOR_LEFT_SIDE, "top_left_corner": TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER,
	"top_side": TileSet.CELL_NEIGHBOR_TOP_SIDE, "top_right_corner": TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER,
}


func _tileset() -> void:
	var importer_path: String = job.get("importer", "res://nerulio_tileset_import.gd")
	var json_path: String = job.get("json", "res://nerulio-tileset.json")
	if not ResourceLoader.exists(importer_path):
		report["errors"].append("the bundle ships no Godot importer at %s" % importer_path)
		return
	var script: GDScript = load(importer_path)
	if script == null or script.reload() != OK:
		report["errors"].append("the shipped importer does not parse")
		return
	var consts := script.get_script_constant_map()
	if not consts.has("Builder"):
		report["errors"].append("the shipped importer has no Builder class")
		return
	var builder: Object = consts["Builder"].new()
	var out_res := "res://_verify/tileset.tres"
	var ok: bool = builder.build(json_path, out_res)
	report["importer_log"] = Array(builder.get("log_lines")) if builder.get("log_lines") != null else []
	report["importer_problems"] = Array(builder.get("problems")) if builder.get("problems") != null else []
	if not ok:
		report["errors"].append("the shipped importer reported failure")
		return
	var ts: TileSet = ResourceLoader.load(out_res, "TileSet", ResourceLoader.CACHE_MODE_IGNORE)
	if ts == null:
		report["errors"].append("the saved TileSet did not reload from disk")
		return
	var info := {"tile_size": [ts.tile_size.x, ts.tile_size.y], "sources": ts.get_source_count(), "terrain_sets": [], "physics_layers": ts.get_physics_layers_count()}
	for s in ts.get_terrain_sets_count():
		var terrains := []
		for t in ts.get_terrains_count(s):
			terrains.append(ts.get_terrain_name(s, t))
		info["terrain_sets"].append({"mode": ts.get_terrain_set_mode(s), "terrains": terrains})
	var src: TileSetAtlasSource = ts.get_source(ts.get_source_id(0))
	info["margins"] = [src.margins.x, src.margins.y]
	info["separation"] = [src.separation.x, src.separation.y]
	info["texture_size"] = [src.texture.get_width(), src.texture.get_height()]
	info["texture_path"] = src.texture.resource_path
	info["import"] = _import_settings(src.texture.resource_path) if src.texture.resource_path != "" else {"imported": false}
	var tiles := {}
	for i in src.get_tiles_count():
		var c := src.get_tile_id(i)
		var td := src.get_tile_data(c, 0)
		var peering := {}
		if td.terrain_set >= 0:
			# Only the bits the terrain set's mode has: sides, corners, or both.
			var mode := ts.get_terrain_set_mode(td.terrain_set)
			for n: String in NEIGHBORS:
				var corner := n.ends_with("_corner")
				if mode == TileSet.TERRAIN_MODE_MATCH_CORNERS_AND_SIDES or (mode == TileSet.TERRAIN_MODE_MATCH_CORNERS) == corner:
					peering[n] = td.get_terrain_peering_bit(NEIGHBORS[n])
		tiles["%d,%d" % [c.x, c.y]] = {"terrain_set": td.terrain_set, "terrain": td.terrain, "peering": peering,
			"polygons": td.get_collision_polygons_count(0) if ts.get_physics_layers_count() > 0 else 0}
	info["tiles"] = tiles
	report["tileset"] = info
	# Paint the job's cells with the terrain the way a user does (terrain "connect" brush), then
	# report which atlas tile the engine picked for every painted cell and render the map.
	var cells: Array = job.get("paint", [])
	if cells.is_empty() or ts.get_terrain_sets_count() == 0:
		return
	var layer := TileMapLayer.new()
	layer.tile_set = ts
	root.add_child(layer)
	var coords: Array[Vector2i] = []
	var max_c := Vector2i.ZERO
	for c: Array in cells:
		var v := Vector2i(int(c[0]), int(c[1]))
		coords.append(v)
		max_c = Vector2i(maxi(max_c.x, v.x), maxi(max_c.y, v.y))
	layer.set_cells_terrain_connect(coords, 0, 0, true)
	var picked := {}
	for v in coords:
		var a := layer.get_cell_atlas_coords(v)
		picked["%d,%d" % [v.x, v.y]] = [a.x, a.y]
	report["paint"] = {"picked": picked, "png": await _capture(Vector2i((max_c.x + 2) * ts.tile_size.x, (max_c.y + 2) * ts.tile_size.y), "terrain_paint")}
	layer.queue_free()


# ---------------------------------------------------------------- Font (BMFont .fnt / TTF)

func _font() -> void:
	var path: String = job["font"]
	var font: Font = ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_IGNORE) as Font
	if font == null:
		report["errors"].append("Godot did not load %s as a Font" % path)
		return
	var size := int(job.get("size", 16))
	var info := {"class": font.get_class(), "height": font.get_height(size), "ascent": font.get_ascent(size), "name": font.get_font_name()}
	if font is FontFile:
		var ff := font as FontFile
		info["fixed_size"] = ff.fixed_size
		info["cache_sizes"] = []
		for s in ff.get_size_cache_list(0):
			info["cache_sizes"].append([s.x, s.y])
		if ff.get_size_cache_list(0).size() > 0:
			var s0: Vector2i = ff.get_size_cache_list(0)[0]
			info["glyphs"] = ff.get_glyph_list(0, s0).size()
			info["textures"] = ff.get_texture_count(0, s0)
			size = s0.x if ff.fixed_size > 0 or job.get("use_cache_size", true) else size
	info["render_size"] = size
	report["font"] = info
	var chars: Array = job.get("chars", [])
	var glyphs := {}
	var label := Label.new()
	label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	label.position = Vector2(4, 4)
	root.add_child(label)
	var i := 0
	for ch: String in chars:
		var entry := {"has": font.has_char(ch.unicode_at(0)), "advance": font.get_char_size(ch.unicode_at(0), size).x}
		label.text = ch
		entry["png"] = await _capture(Vector2i(size * 4 + 8, size * 3 + 8), "glyph_%04d" % i)
		glyphs[ch] = entry
		i += 1
	report["glyphs"] = glyphs
	if job.has("sample"):
		label.text = String(job["sample"])
		report["sample"] = {"text": job["sample"], "png": await _capture(Vector2i(size * String(job["sample"]).length() * 2 + 16, size * 3 + 8), "sample")}
	label.queue_free()


# ---------------------------------------------------------------- Texture import flags + draw

func _texture() -> void:
	var path: String = job["texture"]
	var tex: Texture2D = ResourceLoader.load(path, "Texture2D", ResourceLoader.CACHE_MODE_IGNORE) as Texture2D
	if tex == null:
		report["errors"].append("Godot did not load %s as a Texture2D" % path)
		return
	report["texture"] = {"size": [tex.get_width(), tex.get_height()], "import": _import_settings(path), "class": tex.get_class()}
	var scale := int(job.get("scale", 1))
	var s := Sprite2D.new()
	s.texture = tex
	s.centered = false
	s.scale = Vector2(scale, scale)
	root.add_child(s)
	report["texture"]["png"] = await _capture(Vector2i(tex.get_width() * scale, tex.get_height() * scale), "texture_%dx" % scale)
	s.queue_free()
