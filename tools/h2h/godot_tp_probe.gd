# Draws every AtlasTexture that TexturePacker's own Godot importer (CodeAndWeb
# texturepacker-godot-plugin, enabled in the throw-away project) made from a .tpsheet, one Sprite2D
# at 1x on a transparent viewport, and writes the captures + what it read back. Judged in Python
# (tools/h2h/godot_tp_check.py) against the source frames. NOT shipped.
#   godot --path <project> --script res://_verify/godot_tp_probe.gd --rendering-driver opengl3
extends SceneTree

const OUT := "res://_verify/out"
var report := {"errors": [], "sprites": [], "animations": []}


func _initialize() -> void:
	report["godot"] = Engine.get_version_info()
	RenderingServer.set_default_clear_color(Color(0, 0, 0, 0))
	root.transparent_bg = true
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	_run()


func _run() -> void:
	await process_frame
	var folder := "res://atlas.sprites"
	var dir := DirAccess.open(folder)
	if dir == null:
		report["errors"].append("the importer made no atlas.sprites folder")
		_finish()
		return
	var names := Array(dir.get_files()).filter(func(n): return n.ends_with(".tres"))
	names.sort()
	for n in names:
		var tex = ResourceLoader.load(folder.path_join(n), "", ResourceLoader.CACHE_MODE_IGNORE)
		if not (tex is AtlasTexture):
			report["errors"].append("%s is not an AtlasTexture" % n)
			continue
		var s := Sprite2D.new()
		s.texture = tex
		s.centered = false
		root.add_child(s)
		var size := Vector2i(tex.get_width(), tex.get_height())
		var png := await _capture(size, n.get_basename())
		s.queue_free()
		await process_frame
		report["sprites"].append({"name": n.get_basename(), "size": [size.x, size.y], "region": [tex.region.position.x, tex.region.position.y, tex.region.size.x, tex.region.size.y],
			"margin": [tex.margin.position.x, tex.margin.position.y, tex.margin.size.x, tex.margin.size.y], "png": png})
	var lib_path := "res://atlas.animations.tres"
	if ResourceLoader.exists(lib_path):
		var lib = ResourceLoader.load(lib_path, "", ResourceLoader.CACHE_MODE_IGNORE)
		if lib is AnimationLibrary:
			for a in lib.get_animation_list():
				var anim: Animation = lib.get_animation(a)
				report["animations"].append({"name": a, "length": anim.length, "tracks": anim.get_track_count(),
					"keys": anim.track_get_key_count(0) if anim.get_track_count() else 0})
	_finish()


func _capture(size: Vector2i, name: String) -> String:
	if root.size.x < size.x or root.size.y < size.y:
		root.size = Vector2i(maxi(root.size.x, size.x), maxi(root.size.y, size.y))
		await process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var shot := root.get_texture().get_image()
	if shot == null:
		report["errors"].append("viewport capture returned null")
		return ""
	shot.convert(Image.FORMAT_RGBA8)
	var crop := shot.get_region(Rect2i(Vector2i.ZERO, size))
	var path := OUT.path_join(name + ".png")
	crop.save_png(path)
	return path.get_file()


func _finish() -> void:
	var f := FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("H2H_TP_PROBE_DONE errors=%d sprites=%d" % [report["errors"].size(), report["sprites"].size()])
	quit(0)
