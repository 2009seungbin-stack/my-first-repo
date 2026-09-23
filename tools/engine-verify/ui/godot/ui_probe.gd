# Nerulio UI engine-verify probe for Godot 4 (nine-slices and buttons). NOT shipped to users.
#
# verify_ui.py copies the bundle into res://bundle/, runs `godot --headless --import`, then runs this
# script WITHOUT --headless (the dummy renderer of a headless run cannot draw):
#
#   godot --path <project> --script res://_verify/ui_probe.gd --rendering-driver opengl3
#
# Every case of res://_verify/job.json is drawn into one transparent SubViewport per "path" at the
# slot Python chose, with NEAREST filtering, and each SubViewport is saved as one PNG:
#   tres       the StyleBoxTexture .tres the bundle ships, loaded by Godot's own loader, drawn with
#              CanvasItem.draw_style_box() on a Node2D scaled by the case's scale
#   helper     the StyleBoxTexture the shipped nerulio_ui_import.gd Builder saved, reloaded from disk
#   ninepatch  a NinePatchRect node built by the helper (a Control: it cannot be smaller than its
#              patch margins; its real size is reported)
# plus every button of the bundle in its states through the shipped Theme .tres, and read-back of
# every StyleBoxTexture field. Nothing here judges.
extends SceneTree

const OUT := "res://_verify/out"
var report := {"errors": [], "warnings": []}
var job: Dictionary = {}


class BoxDrawer extends Node2D:
	var box: StyleBox
	var draw_size := Vector2.ZERO

	func _draw() -> void:
		if box != null:
			draw_style_box(box, Rect2(Vector2.ZERO, draw_size))


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
	_run()


func _finish() -> void:
	var f := FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE)
	f.store_string(JSON.stringify(report, " "))
	f.close()
	print("NERULIO_PROBE_DONE errors=%d" % report["errors"].size())
	quit(0)


func _viewport(size: Vector2i) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = size
	vp.transparent_bg = true
	vp.disable_3d = true
	vp.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.gui_embed_subwindows = true
	root.add_child(vp)
	return vp


func _save(vp: SubViewport, name: String) -> String:
	await process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	if img == null:
		report["errors"].append("capture of %s returned null (is this a --headless run?)" % name)
		return ""
	img.convert(Image.FORMAT_RGBA8)
	img.save_png(OUT.path_join(name + ".png"))
	return name + ".png"


func _run() -> void:
	await process_frame
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(job["json"]))
	data["_dir"] = String(job["json"]).get_base_dir()
	# 1. the shipped .tres, loaded by Godot itself
	var tres := {}
	var fields := {}
	for element: String in data["elements"]:
		var p := String(job["tres_dir"]).path_join(element + ".tres")
		if not ResourceLoader.exists(p):
			report["errors"].append("the bundle ships no %s" % p)
			continue
		var box := ResourceLoader.load(p, "StyleBoxTexture", ResourceLoader.CACHE_MODE_IGNORE) as StyleBoxTexture
		if box == null:
			report["errors"].append("Godot did not load %s as a StyleBoxTexture" % p)
			continue
		tres[element] = box
		fields[element] = _fields(box)
	report["tres_fields"] = fields
	# 2. the shipped helper: Builder.build() saves .tres files, which are reloaded from disk
	var helper := {}
	var hfields := {}
	var helper_path: String = job.get("helper", "")
	var builder: Object = null
	if helper_path != "" and ResourceLoader.exists(helper_path):
		var script: GDScript = load(helper_path)
		if script == null or script.reload() != OK:
			report["errors"].append("the shipped helper %s does not parse" % helper_path)
		else:
			builder = script.get_script_constant_map()["Builder"].new()
			var ok: bool = builder.build(job["json"], "res://_verify/built")
			report["helper_log"] = Array(builder.log_lines)
			report["helper_problems"] = Array(builder.problems)
			if not ok:
				report["errors"].append("the shipped helper reported failure")
			for element: String in data["elements"]:
				var b := ResourceLoader.load("res://_verify/built/%s.tres" % element, "StyleBoxTexture", ResourceLoader.CACHE_MODE_IGNORE) as StyleBoxTexture
				if b != null:
					helper[element] = b
					hfields[element] = _fields(b)
	else:
		report["warnings"].append("no helper at %s" % helper_path)
	report["helper_fields"] = hfields
	var canvas: Array = job["canvas"]
	var cases: Array = job["cases"]
	report["paths"] = {}
	for path_name: String in job.get("paths", ["tres", "helper", "ninepatch"]):
		var vp := _viewport(Vector2i(int(canvas[0]), int(canvas[1])))
		var sizes := {}
		for c: Dictionary in cases:
			var s := float(c["scale"])
			var local := Vector2(float(c["w"]) / s, float(c["h"]) / s)
			var slot: Array = c["slot"]
			if path_name == "ninepatch":
				if builder == null:
					continue
				var n: NinePatchRect = builder.nine_patch_rect(data, c["element"], local)
				n.position = Vector2(slot[0], slot[1])
				n.scale = Vector2(s, s)
				vp.add_child(n)
				n.size = local
				sizes[c["id"]] = [n.size.x * s, n.size.y * s]
			else:
				var src: Dictionary = tres if path_name == "tres" else helper
				if not src.has(c["element"]):
					continue
				var d := BoxDrawer.new()
				d.box = src[c["element"]]
				d.draw_size = local
				d.position = Vector2(slot[0], slot[1])
				d.scale = Vector2(s, s)
				vp.add_child(d)
		await process_frame
		report["paths"][path_name] = {"png": await _save(vp, "path_" + path_name), "sizes": sizes}
		vp.queue_free()
		await process_frame
	await _buttons(data)
	_finish()


func _fields(box: StyleBoxTexture) -> Dictionary:
	return {"texture": box.texture.resource_path if box.texture else "", "texture_size": [box.texture.get_width(), box.texture.get_height()] if box.texture else null,
		"texture_margin": [box.texture_margin_left, box.texture_margin_right, box.texture_margin_top, box.texture_margin_bottom],
		"content_margin": [box.get_margin(SIDE_LEFT), box.get_margin(SIDE_RIGHT), box.get_margin(SIDE_TOP), box.get_margin(SIDE_BOTTOM)],
		"content_margin_raw": [box.content_margin_left, box.content_margin_right, box.content_margin_top, box.content_margin_bottom],
		"axis": [box.axis_stretch_horizontal, box.axis_stretch_vertical], "region": [box.region_rect.position.x, box.region_rect.position.y, box.region_rect.size.x, box.region_rect.size.y],
		"draw_center": box.draw_center, "minimum_size": [box.get_minimum_size().x, box.get_minimum_size().y]}


# Buttons through the shipped Theme: normal, hover (a mouse-motion event pushed into the viewport),
# pressed (toggle_mode + button_pressed), disabled, focus (grab_focus: Godot draws the focus box
# on top of the normal box).
func _buttons(data: Dictionary) -> void:
	var out := {}
	for b: Dictionary in job.get("buttons", []):
		var theme := ResourceLoader.load(b["theme"], "Theme", ResourceLoader.CACHE_MODE_IGNORE) as Theme
		if theme == null:
			report["errors"].append("Godot did not load %s as a Theme" % b["theme"])
			continue
		var info := {"styles": Array(theme.get_stylebox_list("Button")), "states": {}}
		var size := Vector2(b["w"], b["h"])
		for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
			var vp := _viewport(Vector2i(int(size.x) + 16, int(size.y) + 16))
			vp.gui_disable_input = false
			var btn := Button.new()
			btn.theme = theme
			btn.focus_mode = Control.FOCUS_ALL
			btn.position = Vector2(8, 8)
			vp.add_child(btn)
			btn.size = size
			match state:
				"pressed":
					btn.toggle_mode = true
					btn.button_pressed = true
				"disabled":
					btn.disabled = true
				"focus":
					btn.grab_focus()
			await process_frame
			if state == "hover":
				var ev := InputEventMouseMotion.new()
				ev.position = Vector2(8, 8) + size / 2
				ev.global_position = ev.position
				vp.push_input(ev)
				await process_frame
			var st := {"draw_mode": btn.get_draw_mode(), "has_focus": btn.has_focus(), "size": [btn.size.x, btn.size.y],
				"minimum_size": [btn.get_combined_minimum_size().x, btn.get_combined_minimum_size().y],
				"hovered": btn.is_hovered(), "png": await _save(vp, "button_%s_%s" % [b["button"], state])}
			info["states"][state] = st
			vp.queue_free()
			await process_frame
		out[b["button"]] = info
	report["buttons"] = out
