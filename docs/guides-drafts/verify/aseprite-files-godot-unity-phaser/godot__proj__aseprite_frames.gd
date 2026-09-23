# aseprite_frames.gd - SpriteFrames from Aseprite's sprite sheet JSON (Hash or Array, with Tags).
class_name AsepriteFrames
extends RefCounted

static func build(json_path: String, sheet: Texture2D, fps := 10.0) -> SpriteFrames:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(json_path))
	var list: Array = data.frames if data.frames is Array else data.frames.values()
	var tags: Array = data.meta.get("frameTags", [])
	if tags.is_empty():
		tags = [{"name": "default", "from": 0, "to": list.size() - 1}]
	var frames := SpriteFrames.new()
	frames.remove_animation(&"default")
	for tag in tags:
		var anim := StringName(tag.name)
		frames.add_animation(anim)
		frames.set_animation_speed(anim, fps)
		var dir: String = tag.get("direction", "forward")
		var mode := SpriteFrames.LOOP_LINEAR
		if tag.has("repeat"):            # Aseprite writes "repeat" only for a finite count
			mode = SpriteFrames.LOOP_NONE
		elif dir.begins_with("pingpong"):
			mode = SpriteFrames.LOOP_PINGPONG   # Godot 4.7+
		frames.set_animation_loop_mode(anim, mode)
		var ids := range(int(tag.from), int(tag.to) + 1)
		if dir.ends_with("reverse"):     # "reverse" and "pingpong_reverse"
			ids.reverse()
		for i in ids:
			var f: Dictionary = list[i]
			var atlas := AtlasTexture.new()
			atlas.atlas = sheet
			atlas.region = Rect2(f.frame.x, f.frame.y, f.frame.w, f.frame.h)
			# A trimmed frame gets its cut-off border back, so every frame keeps its full size.
			atlas.margin = Rect2(f.spriteSourceSize.x, f.spriteSourceSize.y,
					f.sourceSize.w - f.frame.w, f.sourceSize.h - f.frame.h)
			frames.add_frame(anim, atlas, f.duration * fps / 1000.0)   # ms -> relative duration
	return frames
