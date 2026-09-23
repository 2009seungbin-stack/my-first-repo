@tool
extends EditorScript
# nerulio_font_import.gd - builds a Godot 4 FontFile from a Nerulio Studio font export in the
# msdf-atlas-gen JSON format (+ its PNG atlas) and saves it as a .res you can use anywhere a Font
# goes (Label theme override, Theme default font, draw_string).
#
# Why a script: Godot's own BMFont (.fnt) importer reads bitmap fonts (text and binary) but it
# IGNORES the `distanceField` line, so an MSDF/SDF .fnt would be drawn as a coloured bitmap. This
# builder turns on FontFile.multichannel_signed_distance_field with the right msdf_pixel_range and
# msdf_size, so the text stays sharp at any size. Plain bitmap exports (.fnt) need no script: drop
# the .fnt and its PNG pages into the project and use the .fnt as a Font.
#
# Editor: put this file next to font.json and font.png, set JSON_PATH below if the name differs,
# then File > Run (Ctrl+Shift+X) in the Script editor. It writes font.res next to the JSON.
#
# Headless / from code (Godot cannot run an EditorScript from --script):
#     var b = preload("res://fonts/nerulio_font_import.gd").Builder.new()
#     var font: FontFile = b.build("res://fonts/font.json")             # PNG = same name .png
#     ResourceSaver.save(font, "res://fonts/font.res")
#
# Mapping (msdf-atlas-gen JSON -> FontFile), S = atlas.size (px per em):
#   atlas.type msdf|mtsdf|sdf|psdf -> multichannel_signed_distance_field = true,
#       msdf_pixel_range = atlas.distanceRange, msdf_size = S (sdf/psdf grey is copied to R,G,B:
#       Godot takes the median of R,G,B, which for a single-channel field is that channel)
#   atlas.type hardmask|softmask   -> bitmap font: fixed_size = S, integer-only scaling, white glyphs
#                                     with the mask as alpha. Use a NEAREST texture filter for pixels.
#   glyph advance * S              -> set_glyph_advance
#   planeBounds * S (y flipped)    -> set_glyph_offset (top-left from the pen on the baseline) / set_glyph_size
#   atlasBounds                    -> set_glyph_uv_rect (texels, top-down; yOrigin bottom is flipped)
#   kerning[].advance * S          -> set_kerning
#   metrics.ascender/descender * S -> cache ascent/descent (positive, px)
# MSDF text needs LINEAR filtering (the default); with NEAREST the field is sampled blocky.

const JSON_PATH := "font.json"


func _run() -> void:
	var here: String = get_script().resource_path.get_base_dir()
	var b := Builder.new()
	var src := here.path_join(JSON_PATH)
	var font := b.build(src)
	for line in b.log_lines:
		print(line)
	if font == null:
		push_error("Nerulio: no font was built. See the messages above.")
		return
	var out := src.get_basename() + ".res"
	if ResourceSaver.save(font, out) == OK:
		print("Nerulio: saved %s" % out)


class Builder extends RefCounted:
	var log_lines: PackedStringArray = []

	func build(json_path: String, image_path := "") -> FontFile:
		var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(json_path))
		if typeof(data) != TYPE_DICTIONARY or not data.has("atlas") or not data.has("glyphs"):
			log_lines.append("%s is not msdf-atlas-gen JSON" % json_path)
			return null
		if image_path == "":
			image_path = json_path.get_basename() + ".png"
		var img := Image.load_from_file(image_path)
		if img == null or img.is_empty():
			log_lines.append("could not read the atlas image %s" % image_path)
			return null
		var atlas: Dictionary = data["atlas"]
		var metrics: Dictionary = data["metrics"]
		var kind: String = atlas.get("type", "msdf")
		var S := float(atlas["size"])
		var H := float(atlas["height"])
		var top_origin: bool = atlas.get("yOrigin", "bottom") == "top"
		var field := kind in ["msdf", "mtsdf", "sdf", "psdf"]
		img = _page(img, kind)
		var font := FontFile.new()
		var size := Vector2i(int(S), 0)
		if field:
			font.multichannel_signed_distance_field = true
			font.msdf_pixel_range = int(atlas.get("distanceRange", 4))
			font.msdf_size = int(S)
		else:
			font.fixed_size = int(S)
			font.fixed_size_scale_mode = TextServer.FIXED_SIZE_SCALE_INTEGER_ONLY
		font.antialiasing = TextServer.FONT_ANTIALIASING_GRAY if field else TextServer.FONT_ANTIALIASING_NONE
		font.set_texture_image(0, size, 0, img)
		var sign := -1.0 if top_origin else 1.0
		font.set_cache_ascent(0, int(S), sign * float(metrics.get("ascender", 0.8)) * S)
		font.set_cache_descent(0, int(S), -sign * float(metrics.get("descender", -0.2)) * S)
		font.set_cache_underline_position(0, int(S), -sign * float(metrics.get("underlineY", -0.1)) * S)
		font.set_cache_underline_thickness(0, int(S), float(metrics.get("underlineThickness", 0.05)) * S)
		var count := 0
		for g: Dictionary in data["glyphs"]:
			var u := int(g["unicode"])
			font.set_glyph_advance(0, int(S), u, Vector2(float(g["advance"]) * S, 0))
			if g.has("atlasBounds") and g.has("planeBounds"):
				var ab: Dictionary = g["atlasBounds"]
				var pb: Dictionary = g["planeBounds"]
				var a_top := float(ab["top"]) if top_origin else H - float(ab["top"])
				var a_bottom := float(ab["bottom"]) if top_origin else H - float(ab["bottom"])
				var p_top_up := -float(pb["top"]) if top_origin else float(pb["top"])
				var p_bottom_up := -float(pb["bottom"]) if top_origin else float(pb["bottom"])
				font.set_glyph_offset(0, size, u, Vector2(float(pb["left"]) * S, -p_top_up * S))
				font.set_glyph_size(0, size, u, Vector2((float(pb["right"]) - float(pb["left"])) * S, (p_top_up - p_bottom_up) * S))
				font.set_glyph_uv_rect(0, size, u, Rect2(float(ab["left"]), a_top, float(ab["right"]) - float(ab["left"]), a_bottom - a_top))
				font.set_glyph_texture_idx(0, size, u, 0)
			count += 1
		var pairs := 0
		for k: Dictionary in data.get("kerning", []):
			font.set_kerning(0, int(S), Vector2i(int(k["unicode1"]), int(k["unicode2"])), Vector2(float(k["advance"]) * S, 0))
			pairs += 1
		log_lines.append("Nerulio: %s %s font, %d glyphs, %d kerning pairs, %d px/em, range %s" % [json_path.get_file(), kind, count, pairs, int(S), atlas.get("distanceRange", "-")])
		return font

	static func _page(img: Image, kind: String) -> Image:
		img.convert(Image.FORMAT_RGBA8)
		if kind in ["mtsdf"]:
			return img
		var w := img.get_width()
		var h := img.get_height()
		for y in h:
			for x in w:
				var c := img.get_pixel(x, y)
				match kind:
					"sdf", "psdf":
						img.set_pixel(x, y, Color(c.r, c.r, c.r, 1.0))
					"msdf":
						img.set_pixel(x, y, Color(c.r, c.g, c.b, 1.0))
					_:  # hardmask / softmask: white, coverage in alpha
						img.set_pixel(x, y, Color(1, 1, 1, c.r))
		return img
