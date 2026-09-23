@tool
extends EditorScript
# nerulio_ui_import.gd - builds Godot 4 StyleBoxTexture resources and a Button Theme from a Nerulio
# Studio UI export (nerulio-ui.json). The export already contains ready .tres files next to this
# script; use this helper instead when you prefer to (re)build them from the JSON, or to build
# NinePatchRect nodes from code.
#
# Editor: keep this file in the export's godot/ folder (nerulio-ui.json and the PNGs one folder up),
# open it in the Script editor and run File > Run (Ctrl+Shift+X). It writes godot/built/<element>.tres
# (StyleBoxTexture) and godot/built/<button>_theme.tres (Theme for Button) and prints what it built.
#
# Headless / from code (Godot cannot run an EditorScript from --script):
#
#     var b = preload("res://ui/godot/nerulio_ui_import.gd").Builder.new()
#     var ok: bool = b.build("res://ui/nerulio-ui.json", "res://ui/godot/built")
#     for line in b.log_lines: print(line)
#
#     var data: Dictionary = b.load_data("res://ui/nerulio-ui.json")
#     var box: StyleBoxTexture = b.stylebox(data, "panel")              # one element
#     var rect: NinePatchRect = b.nine_patch_rect(data, "panel", Vector2(300, 120))
#
# Mapping (all numbers are source pixels of the element):
#   nineSlice.left/right/top/bottom  -> texture_margin_* (StyleBoxTexture) / patch_margin_* (NinePatchRect)
#   padding (null = same as nineSlice) -> content_margin_*
#   stretch stretch|tile|tile-fit     -> AXIS_STRETCH_MODE_STRETCH|TILE|TILE_FIT per axis
#   rect (atlas element)              -> region_rect
#   drawCenter                        -> draw_center
#   buttons.<name>.normal|hover|pressed|disabled|focus -> Button/styles/<state>
#     Godot draws `focus` ON TOP of the current state's box, so a focus element should be an
#     outline with a transparent (or undrawn) centre.
# Pixel art: set Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter
# to Nearest (or texture_filter = NEAREST on the Control), otherwise corners are blurred.

const JSON_PATH := "../nerulio-ui.json"
const OUTPUT_DIR := "built"


func _run() -> void:
	var here: String = get_script().resource_path.get_base_dir()
	var builder := Builder.new()
	var ok := builder.build(here.path_join(JSON_PATH).simplify_path(), here.path_join(OUTPUT_DIR))
	for line in builder.log_lines:
		print(line)
	for line in builder.problems:
		push_warning(line)
	if not ok:
		push_error("Nerulio: nothing was saved. See the messages above.")


class Builder extends RefCounted:
	const AXIS := {"stretch": StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH, "tile": StyleBoxTexture.AXIS_STRETCH_MODE_TILE,
		"tile-fit": StyleBoxTexture.AXIS_STRETCH_MODE_TILE_FIT}
	const STATES := ["normal", "hover", "pressed", "disabled", "focus"]

	var log_lines: PackedStringArray = []
	var problems: PackedStringArray = []
	var _textures := {}

	func load_data(json_path: String) -> Dictionary:
		var text := FileAccess.get_file_as_string(json_path)
		var parsed: Variant = JSON.parse_string(text)
		if typeof(parsed) != TYPE_DICTIONARY or parsed.get("format", "") != "nerulio-ui":
			problems.append("%s is not a nerulio-ui export" % json_path)
			return {}
		parsed["_dir"] = json_path.get_base_dir()
		return parsed

	func texture(data: Dictionary, image_index: int) -> Texture2D:
		if _textures.has(image_index):
			return _textures[image_index]
		var file: String = data["images"][image_index]["file"]
		var path: String = String(data["_dir"]).path_join(file)
		var tex: Texture2D = load(path) as Texture2D
		if tex == null:
			problems.append("%s is not imported yet (let the editor import it, or run godot --headless --import)" % path)
		_textures[image_index] = tex
		return tex

	static func _side(d: Variant, key: String) -> float:
		return float(d.get(key, 0)) if typeof(d) == TYPE_DICTIONARY else 0.0

	func stylebox(data: Dictionary, element: String) -> StyleBoxTexture:
		var e: Dictionary = data["elements"][element]
		var box := StyleBoxTexture.new()
		box.texture = texture(data, int(e["image"]))
		var ns: Variant = e.get("nineSlice")
		box.texture_margin_left = _side(ns, "left")
		box.texture_margin_right = _side(ns, "right")
		box.texture_margin_top = _side(ns, "top")
		box.texture_margin_bottom = _side(ns, "bottom")
		var pad: Variant = e.get("padding")
		if typeof(pad) == TYPE_DICTIONARY:
			box.content_margin_left = _side(pad, "left")
			box.content_margin_right = _side(pad, "right")
			box.content_margin_top = _side(pad, "top")
			box.content_margin_bottom = _side(pad, "bottom")
		var st: Dictionary = e.get("stretch", {}) if typeof(e.get("stretch")) == TYPE_DICTIONARY else {}
		box.axis_stretch_horizontal = AXIS.get(st.get("horizontal", "stretch"), StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH)
		box.axis_stretch_vertical = AXIS.get(st.get("vertical", "stretch"), StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH)
		var r: Dictionary = e["rect"]
		var img: Dictionary = data["images"][int(e["image"])]
		if int(r["x"]) != 0 or int(r["y"]) != 0 or int(r["w"]) != int(img["width"]) or int(r["h"]) != int(img["height"]):
			box.region_rect = Rect2(r["x"], r["y"], r["w"], r["h"])
		box.draw_center = bool(e.get("drawCenter", true))
		return box

	func nine_patch_rect(data: Dictionary, element: String, size := Vector2.ZERO) -> NinePatchRect:
		var e: Dictionary = data["elements"][element]
		var box := stylebox(data, element)
		var n := NinePatchRect.new()
		n.name = element
		n.texture = box.texture
		n.region_rect = box.region_rect
		n.patch_margin_left = int(box.texture_margin_left)
		n.patch_margin_right = int(box.texture_margin_right)
		n.patch_margin_top = int(box.texture_margin_top)
		n.patch_margin_bottom = int(box.texture_margin_bottom)
		n.axis_stretch_horizontal = box.axis_stretch_horizontal as NinePatchRect.AxisStretchMode
		n.axis_stretch_vertical = box.axis_stretch_vertical as NinePatchRect.AxisStretchMode
		n.draw_center = box.draw_center
		n.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		n.size = size if size != Vector2.ZERO else Vector2(e["rect"]["w"], e["rect"]["h"])
		return n

	func theme(data: Dictionary, button: String) -> Theme:
		var t := Theme.new()
		var states: Dictionary = data["buttons"][button]
		for state: String in STATES:
			if states.has(state) and data["elements"].has(states[state]):
				t.set_stylebox(state, "Button", stylebox(data, states[state]))
			elif states.has(state):
				problems.append("button %s: %s names a missing element %s" % [button, state, states[state]])
		return t

	func build(json_path: String, out_dir: String) -> bool:
		var data := load_data(json_path)
		if data.is_empty():
			return false
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out_dir))
		var saved := 0
		for element: String in data.get("elements", {}):
			var box := stylebox(data, element)
			if box.texture == null:
				continue
			var p := out_dir.path_join(element + ".tres")
			if ResourceSaver.save(box, p) == OK:
				saved += 1
				log_lines.append("saved %s" % p)
			else:
				problems.append("could not save %s" % p)
		for button: String in data.get("buttons", {}):
			var p := out_dir.path_join(button + "_theme.tres")
			if ResourceSaver.save(theme(data, button), p) == OK:
				saved += 1
				log_lines.append("saved %s" % p)
			else:
				problems.append("could not save %s" % p)
		log_lines.append("Nerulio: %d resource(s) written to %s" % [saved, out_dir])
		return saved > 0 and problems.is_empty()
