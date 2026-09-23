# Nerulio font engine-verify probe for Godot 4. NOT shipped to users.
#
# verify_font.py copies the font bundle into res://bundle/, imports it, then runs this script with a
# real renderer. For every entry of res://_verify/job.json it gets a Font either
#   - through the shipped helper nerulio_font_import.gd (Builder.build(json) -> FontFile, saved to
#     .res and reloaded), or
#   - through Godot's own importer (a .fnt: text, binary, or XML under a .fnt name),
# reads back what Godot made of it, and draws every character at every requested size with
# Font.draw_string at a known baseline pen position (the TextServer path a Label uses; one Label
# sample is drawn too), one PNG per (font, size). Nothing here judges.
extends SceneTree

const OUT := "res://_verify/out"
var report := {"errors": [], "fonts": {}}


class TextDrawer extends Node2D:
	var font: Font
	var size := 16
	var items: Array = []  # [text, Vector2 baseline pen]

	func _draw() -> void:
		for it in items:
			draw_string(font, it[1], it[0], HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color.WHITE)


func _initialize() -> void:
	report["godot"] = Engine.get_version_info()
	RenderingServer.set_default_clear_color(Color(0, 0, 0, 0))
	root.transparent_bg = true
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	_run()


func _run() -> void:
	await process_frame
	var job: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://_verify/job.json"))
	var helper: Object = null
	if job.get("helper", "") != "" and ResourceLoader.exists(job["helper"]):
		var script: GDScript = load(job["helper"])
		if script != null and script.reload() == OK:
			helper = script.get_script_constant_map()["Builder"].new()
		else:
			report["errors"].append("the shipped helper does not parse")
	for e: Dictionary in job["fonts"]:
		var info := {"id": e["id"], "via": e["via"], "path": e["path"], "sizes": {}}
		var font: Font = null
		if e["via"] == "helper":
			if helper == null:
				info["error"] = "no helper"
			else:
				var built: FontFile = helper.build(e["path"])
				info["helper_log"] = Array(helper.log_lines)
				if built != null:
					var res_path := "res://_verify/%s.res" % e["id"]
					if ResourceSaver.save(built, res_path) != OK:
						info["error"] = "could not save %s" % res_path
					font = ResourceLoader.load(res_path, "", ResourceLoader.CACHE_MODE_IGNORE) as Font
		else:
			font = ResourceLoader.load(e["path"], "", ResourceLoader.CACHE_MODE_IGNORE) as Font
		if font == null:
			info["error"] = info.get("error", "Godot did not load %s as a Font" % e["path"])
			report["fonts"][e["id"]] = info
			continue
		info["class"] = font.get_class()
		if font is FontFile:
			var ff := font as FontFile
			info["msdf"] = ff.multichannel_signed_distance_field
			info["msdf_pixel_range"] = ff.msdf_pixel_range
			info["msdf_size"] = ff.msdf_size
			info["fixed_size"] = ff.fixed_size
			var caches := ff.get_size_cache_list(0)
			info["cache_sizes"] = []
			for s in caches:
				info["cache_sizes"].append([s.x, s.y])
			if caches.size() > 0:
				info["glyphs"] = ff.get_glyph_list(0, caches[0]).size()
				info["textures"] = ff.get_texture_count(0, caches[0])
				info["kerning_pairs"] = ff.get_kerning_list(0, caches[0].x).size()
		var chars: Array = e["chars"]
		info["missing"] = []
		for ch: String in chars:
			if not font.has_char(ch.unicode_at(0)):
				info["missing"].append(ch)
		for szf in e["sizes"]:
			var sz := int(szf)
			var cell := int(ceil(sz * 2.0)) + 8
			var cols: int = int(max(1, min(chars.size() + e["pairs"].size(), 2048 / cell)))
			var n: int = chars.size() + e["pairs"].size() + 1
			var rows := int(ceil(float(n) / cols))
			var vp := SubViewport.new()
			vp.size = Vector2i(cols * cell, rows * cell + cell * 2)
			vp.transparent_bg = true
			vp.disable_3d = true
			vp.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR if e.get("filter", "linear") == "linear" else Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
			vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
			root.add_child(vp)
			var d := TextDrawer.new()
			d.font = font
			d.size = sz
			var slots := []
			var texts: Array = chars + e["pairs"]
			for i in texts.size():
				var pen := Vector2((i % cols) * cell + 4 + int(sz * 0.5), (i / cols) * cell + 4 + int(sz * 1.2))
				d.items.append([texts[i], pen])
				slots.append({"text": texts[i], "pen": [pen.x, pen.y], "box": [(i % cols) * cell, (i / cols) * cell, cell, cell],
					"advance": font.get_string_size(texts[i], HORIZONTAL_ALIGNMENT_LEFT, -1, sz).x})
			vp.add_child(d)
			# one Label with the sample text, to show the Label path draws the same glyphs
			var label := Label.new()
			label.add_theme_font_override("font", font)
			label.add_theme_font_size_override("font_size", sz)
			label.position = Vector2(4, rows * cell + 4)
			label.text = e.get("sample", "")
			vp.add_child(label)
			await process_frame
			await RenderingServer.frame_post_draw
			await RenderingServer.frame_post_draw
			var img := vp.get_texture().get_image()
			img.convert(Image.FORMAT_RGBA8)
			var name := "%s_%d" % [e["id"], sz]
			img.save_png(OUT.path_join(name + ".png"))
			info["sizes"][str(sz)] = {"png": name + ".png", "slots": slots, "ascent": font.get_ascent(sz), "height": font.get_height(sz),
				"label": {"pos": [label.position.x, label.position.y], "size": [label.size.x, label.size.y]}}
			vp.queue_free()
			await process_frame
		report["fonts"][e["id"]] = info
	var f := FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("NERULIO_PROBE_DONE")
	quit(0)
