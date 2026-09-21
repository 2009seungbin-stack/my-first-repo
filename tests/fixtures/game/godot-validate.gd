# Validation harness for the Sprite Lab Godot export. Not shipped to users: this runs the shipped
# helper (addons/nerulio_sprite/nerulio_sprite_frames.gd) against a generated export, saves the
# resource with ResourceSaver, reloads it from disk with the cache bypassed, and prints a JSON
# report that tests/fixtures/game/godot-validate.mjs asserts on.
#
#   godot --headless --path <project> --script res://godot-validate.gd
extends SceneTree

const Builder := preload("res://addons/nerulio_sprite/nerulio_sprite_frames.gd")
const EXPORT_JSON := "res://atlas.json"
const OUT_RESOURCE := "res://sprite_frames.tres"


func _initialize() -> void:
	var report := {"godot": Engine.get_version_info(), "errors": [], "animations": {}, "frames": {}}
	var data: Dictionary = Builder.load_data(EXPORT_JSON)
	if data.is_empty():
		report["errors"].append("the export could not be read")
		_emit(report)
		return
	var built: SpriteFrames = Builder.import(EXPORT_JSON, OUT_RESOURCE)
	if built == null:
		report["errors"].append("the helper did not build a SpriteFrames")
		_emit(report)
		return
	report["errors"].append_array(Array(Builder.verify(data, built)))
	report["saved"] = FileAccess.file_exists(OUT_RESOURCE)

	# Reload from disk, cache bypassed, so what is checked is what was written - not the object
	# still in memory.
	var reloaded: SpriteFrames = ResourceLoader.load(OUT_RESOURCE, "SpriteFrames", ResourceLoader.CACHE_MODE_IGNORE)
	if reloaded == null:
		report["errors"].append("the saved resource could not be reloaded")
		_emit(report)
		return
	report["errors"].append_array(Array(Builder.verify(data, reloaded)))

	for anim_name: String in reloaded.get_animation_names():
		var frames := []
		for i in reloaded.get_frame_count(anim_name):
			var texture := reloaded.get_frame_texture(anim_name, i) as AtlasTexture
			frames.append({
				"duration": reloaded.get_frame_duration(anim_name, i),
				"region": [texture.region.position.x, texture.region.position.y, texture.region.size.x, texture.region.size.y],
				"margin": [texture.margin.position.x, texture.margin.position.y, texture.margin.size.x, texture.margin.size.y],
				"size": [texture.get_size().x, texture.get_size().y],
				"atlas_size": [texture.atlas.get_width(), texture.atlas.get_height()],
				"filter_clip": texture.filter_clip,
			})
		report["animations"][anim_name] = {
			"speed": reloaded.get_animation_speed(anim_name),
			"loop": reloaded.get_animation_loop(anim_name),
			"frames": frames,
		}

	# The pixels themselves: read the atlas page back and sample the middle of each frame's region,
	# so a wrong region is caught by colour, not only by numbers.
	var pages: Array = []
	for name: String in data["meta"]["images"]:
		var image := Image.load_from_file("res://".path_join(name))
		pages.append(image)
	for frame_name: String in data["frames"]:
		var frame: Dictionary = data["frames"][frame_name]
		var rect: Dictionary = frame["rect"]
		var image: Image = pages[int(frame.get("page", 0))]
		var samples := []
		for point: Array in [[0.5, 0.5], [0.1, 0.1], [0.9, 0.9]]:
			var x := int(rect["x"] + clamp(rect["w"] * point[0], 0, rect["w"] - 1))
			var y := int(rect["y"] + clamp(rect["h"] * point[1], 0, rect["h"] - 1))
			var colour := image.get_pixel(x, y)
			samples.append([int(round(colour.r * 255.0)), int(round(colour.g * 255.0)), int(round(colour.b * 255.0)), int(round(colour.a * 255.0))])
		report["frames"][frame_name] = {"samples": samples}

	# And the scene path: an AnimatedSprite2D with real CollisionPolygon2D children, built and
	# packed through the API rather than written as .tscn text.
	var first_anim: String = data["godot"]["animations"].keys()[0]
	var scene_root: Node2D = Builder.build_scene(data, reloaded, first_anim)
	var packed := PackedScene.new()
	for child in scene_root.get_children():
		_own(child, scene_root)
	var pack_error := packed.pack(scene_root)
	var save_error := ResourceSaver.save(packed, "res://scene.tscn") if pack_error == OK else pack_error
	report["scene"] = {
		"pack_error": pack_error,
		"save_error": save_error,
		"children": scene_root.get_child_count(),
		"polygons": _count_polygons(scene_root),
		"sprite_offset": [scene_root.get_node("Sprite").offset.x, scene_root.get_node("Sprite").offset.y],
	}
	scene_root.free()
	_emit(report)


func _own(node: Node, root: Node) -> void:
	node.owner = root
	for child in node.get_children():
		_own(child, root)


func _count_polygons(node: Node) -> int:
	var total := 0
	if node is CollisionPolygon2D:
		total += 1
	for child in node.get_children():
		total += _count_polygons(child)
	return total


func _emit(report: Dictionary) -> void:
	print("NERULIO_REPORT_BEGIN")
	print(JSON.stringify(report))
	print("NERULIO_REPORT_END")
	quit(0 if report["errors"].is_empty() else 1)
