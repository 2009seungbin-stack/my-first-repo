# Nerulio engine-verify probe for the Texture workspace's Godot 4 export. NOT shipped to users.
#
# Loads the exported scene (<base>_lit.tscn) exactly as a user would, stops its AnimationPlayer,
# and for each checked frame sets the Sprite2D region to that frame, waits for the frame to be drawn
# with the exported PointLight2Ds, CanvasModulate and CanvasTexture (diffuse + normal), and saves
# the drawn pixels. The clear colour is opaque black, so opaque sprite pixels are exactly what the
# engine lit. Judging happens in godot_texture.py against src/game/normals/lighting.js renders.
extends SceneTree

const OUT := "res://_verify/out"
const OFFSET := Vector2(16, 16)
var report := {"errors": [], "frames": []}


func _initialize() -> void:
	report["godot"] = Engine.get_version_info()
	report["renderer"] = {"driver": RenderingServer.get_current_rendering_driver_name(), "method": RenderingServer.get_current_rendering_method()}
	RenderingServer.set_default_clear_color(Color(0, 0, 0, 1))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	_run()


func _run() -> void:
	await process_frame
	var job: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://_verify/job.json"))
	var packed: PackedScene = load(job["scene"])
	if packed == null:
		report["errors"].append("could not load %s" % job["scene"])
		_finish()
		return
	var node: Node2D = packed.instantiate()
	node.position = OFFSET
	root.add_child(node)
	var sprite: Sprite2D = node.get_node("Sprite")
	var tex: Texture2D = sprite.texture
	report["texture_class"] = tex.get_class()
	if tex is CanvasTexture:
		report["normal_texture"] = (tex as CanvasTexture).normal_texture.resource_path if (tex as CanvasTexture).normal_texture else ""
		report["diffuse_texture"] = (tex as CanvasTexture).diffuse_texture.resource_path if (tex as CanvasTexture).diffuse_texture else ""
	var lights := []
	for c in node.get_children():
		if c is PointLight2D:
			lights.append({"position": [c.position.x, c.position.y], "height": c.height, "energy": c.energy, "texture_scale": c.texture_scale, "color": [c.color.r, c.color.g, c.color.b]})
	report["lights"] = lights
	report["modulate"] = [node.get_node("Ambient").color.r, node.get_node("Ambient").color.g, node.get_node("Ambient").color.b]
	var player: AnimationPlayer = node.get_node_or_null("AnimationPlayer")
	if player:
		report["animations"] = Array(player.get_animation_list())
		var anim := player.get_animation(player.get_animation_list()[0])
		var keys := []
		for k in anim.track_get_key_count(0):
			keys.append({"time": anim.track_get_key_time(0, k), "rect": str(anim.track_get_key_value(0, k))})
		report["animation_keys"] = keys
		player.stop()
	for check in job["checks"]:
		var r: Dictionary = check["rect"]
		if player and job.get("via_animation", false) and check.has("time"):
			player.play(player.get_animation_list()[0])
			player.seek(float(check["time"]), true)
			player.pause()
		else:
			sprite.region_rect = Rect2(r["x"], r["y"], r["w"], r["h"])
		for i in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var shot := root.get_texture().get_image()
		var crop := shot.get_region(Rect2i(int(OFFSET.x), int(OFFSET.y), int(r["w"]), int(r["h"])))
		var path := OUT.path_join("frame_%d.png" % int(check["frame"]))
		crop.save_png(path)
		report["frames"].append({"frame": check["frame"], "png": path, "region": str(sprite.region_rect)})
	_finish()


func _finish() -> void:
	var f := FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("NERULIO_TEXTURE_PROBE_DONE errors=%d" % report["errors"].size())
	quit()
