# Lit render of one diffuse texture with different normal maps in Godot 4 (2D, CanvasTexture +
# PointLight2D, CanvasModulate black so only the light is seen). Reads res://_verify/job.json:
#   {"cases": [{"id": "...", "diffuse": "res://...", "normal": "res://...", "size": [w, h]}],
#    "lights": [[x, y, height], ...]}   (x, y in fractions of the picture, height in px)
# Writes res://_verify/out/<id>_L<i>.png. Judged by tools/h2h/godot_lit.py. NOT shipped.
extends SceneTree

const OUT := "res://_verify/out"
var report := {"errors": [], "renders": []}


func _initialize() -> void:
	RenderingServer.set_default_clear_color(Color(0, 0, 0, 0))
	root.transparent_bg = true
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	_run()


func _run() -> void:
	await process_frame
	var job: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://_verify/job.json"))
	var dark := CanvasModulate.new()
	dark.color = Color(0, 0, 0)
	root.add_child(dark)
	var white := Image.create(8, 8, false, Image.FORMAT_RGBA8)
	white.fill(Color(1, 1, 1, 1))
	var light_tex := ImageTexture.create_from_image(white)
	for c in job["cases"]:
		var ct := CanvasTexture.new()
		ct.diffuse_texture = load(c["diffuse"])
		ct.normal_texture = load(c["normal"])
		var s := Sprite2D.new()
		s.texture = ct
		s.centered = false
		s.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		root.add_child(s)
		var size := Vector2i(int(c["size"][0]), int(c["size"][1]))
		var i := 0
		for L in job["lights"]:
			var light := PointLight2D.new()
			light.texture = light_tex
			# a uniform light big enough to cover the picture from any corner: no falloff, so the
			# picture shows N.L only
			light.texture_scale = float(maxi(size.x, size.y)) * 4.0 / 8.0
			light.position = Vector2(L[0] * size.x, L[1] * size.y)
			light.height = L[2]
			light.energy = 1.0
			root.add_child(light)
			var png := await _capture(size, "%s_L%d" % [c["id"], i])
			report["renders"].append(png)
			light.queue_free()
			await process_frame
			i += 1
		s.queue_free()
		await process_frame
	var f := FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("H2H_LIT_DONE %d" % report["renders"].size())
	quit(0)


func _capture(size: Vector2i, name: String) -> String:
	if root.size.x < size.x or root.size.y < size.y:
		root.size = Vector2i(maxi(root.size.x, size.x), maxi(root.size.y, size.y))
		await process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var shot := root.get_texture().get_image()
	shot.convert(Image.FORMAT_RGBA8)
	var crop := shot.get_region(Rect2i(Vector2i.ZERO, size))
	crop.save_png(OUT.path_join(name + ".png"))
	return name + ".png"
