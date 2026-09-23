# Loads Aseprite CLI exports (untrimmed array strip, and packed + trimmed hash) through aseprite_frames.gd, checks
# animations/timing, then draws every frame with AnimatedSprite2D at 1x and compares the pixels with the original frames.
# Run (real renderer): godot --path proj --script res://check.gd --rendering-driver opengl3 --resolution 640x120
extends SceneTree

var fails := 0

func ok(name: String, cond: bool, detail := "") -> void:
	print(("PASS " if cond else "FAIL ") + name + ("" if detail == "" else "  [" + detail + "]"))
	if not cond:
		fails += 1

func _initialize() -> void:
	_run()

func _run() -> void:
	await process_frame
	print(Engine.get_version_info().string, " ", RenderingServer.get_current_rendering_method())
	RenderingServer.set_default_clear_color(Color(0, 0, 0, 0))
	root.transparent_bg = true
	var raw := FileAccess.get_file_as_bytes("res://art/frames.bin")
	for variant in [["strip", "res://art/samurai_strip.json", "res://art/samurai_strip.png"], ["packed", "res://art/samurai_packed.json", "res://art/samurai_packed.png"]]:
		var sheet: Texture2D = load(variant[2])
		var sf: SpriteFrames = AsepriteFrames.build(variant[1], sheet, 10.0)
		ok(variant[0] + ": animations idle + attack", sf.has_animation(&"idle") and sf.has_animation(&"attack") and not sf.has_animation(&"default"), str(sf.get_animation_names()))
		ok(variant[0] + ": idle 6 frames, loops", sf.get_frame_count(&"idle") == 6 and sf.get_animation_loop_mode(&"idle") == SpriteFrames.LOOP_LINEAR)
		var d := []
		for i in sf.get_frame_count(&"attack"):
			d.append(snappedf(sf.get_frame_duration(&"attack", i), 0.001))
		ok(variant[0] + ": attack plays once, durations 80/80/80/120/160/100 ms -> 0.8 .. 1.6", sf.get_animation_loop_mode(&"attack") == SpriteFrames.LOOP_NONE and d == [0.8, 0.8, 0.8, 1.2, 1.6, 1.0], str(d))
		# draw all 12 frames side by side at 1x
		var holder := Node2D.new()
		root.add_child(holder)
		var order := []
		for anim in [&"idle", &"attack"]:
			for i in 6:
				order.append([anim, i])
		for k in order.size():
			var s := AnimatedSprite2D.new()
			s.sprite_frames = sf
			s.animation = order[k][0]
			s.frame = order[k][1]
			s.centered = false
			s.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			s.position = Vector2((k % 12) * 50, 0)
			holder.add_child(s)
		for i in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		var shot := root.get_texture().get_image()
		shot.convert(Image.FORMAT_RGBA8)
		var bad := 0
		for k in 12:
			for y in 48:
				for x in 48:
					var o := (k * 48 * 48 + y * 48 + x) * 4
					var src_a := raw[o + 3]
					var c := shot.get_pixel(k * 50 + x, y)
					if src_a == 0:
						if c.a8 != 0:
							bad += 1
					elif c.r8 != raw[o] or c.g8 != raw[o + 1] or c.b8 != raw[o + 2] or c.a8 != src_a:
						bad += 1
		ok(variant[0] + ": 12 frames drawn by Godot match the original 48x48 frames pixel for pixel", bad == 0, "%d differing pixels" % bad)
		holder.free()
	print("CHECK_DONE fails=%d" % fails)
	quit(0)
