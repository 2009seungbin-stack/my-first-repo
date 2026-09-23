# Renders the subset CJK font with the real Godot renderer (gl_compatibility).
# Run: godot --path . --script res://render.gd --rendering-driver opengl3 --resolution 960x560
extends SceneTree

var info := {}

func _label(font: Font, txt: String, pos: Vector2) -> Label:
	var l := Label.new()
	l.text = txt
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", 12)
	l.add_theme_color_override("font_color", Color(1, 0.93, 0.6))
	l.position = pos
	l.scale = Vector2(3, 3)
	l.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	root.add_child(l)
	return l

func _caption(txt: String, pos: Vector2) -> void:
	var l := Label.new()
	l.text = txt
	l.add_theme_font_size_override("font_size", 15)
	l.add_theme_color_override("font_color", Color(0.75, 0.8, 0.9))
	l.position = pos
	root.add_child(l)

func _initialize() -> void:
	RenderingServer.set_default_clear_color(Color(0.09, 0.1, 0.16))
	var game: FontFile = load("res://fonts/Galmuri11-game.ttf")
	var sysfb: FontFile = load("res://fonts/Galmuri11-game-sysfb.ttf")
	var noto: FontFile = load("res://fonts/NotoSansJP-game.ttf")
	# A second resource for the "with fallback" row; the Import dock's Fallbacks list sets the same property.
	var with_fb: FontFile = game.duplicate()
	with_fb.fallbacks = [noto]
	info["fallbacks_property"] = "fallbacks" in with_fb
	info["allow_system_fallback"] = {"game": game.allow_system_fallback, "sysfb": sysfb.allow_system_fallback}
	for ch in ["가", "똠", "髙", "뷁"]:
		info["has_" + ch] = {"game": game.has_char(ch.unicode_at(0)), "noto": noto.has_char(ch.unicode_at(0))}
	_caption("Galmuri11 subset to the game's strings (47.8 KB instead of 5.4 MB); 12 px, Antialiasing Disabled, scale 3", Vector2(16, 6))
	_label(game, "게임 시작  이어하기  설정  종료", Vector2(16, 28))
	_label(game, "いらっしゃい、旅の方！品物を見ていくかい？", Vector2(16, 76))
	_caption("A name typed by the player at runtime, never in the string table (system fallback off):", Vector2(16, 136))
	_label(game, "용사 뷁뷁이 님이 입장했습니다", Vector2(16, 158))
	_caption("Same text, allow_system_fallback on (the default): Windows draws the glyph from a system font", Vector2(16, 218))
	_label(sysfb, "용사 뷁뷁이 님이 입장했습니다", Vector2(16, 240))
	_caption("\"髙\" is not in Galmuri11: without a fallback (top) / with the Noto Sans JP subset as fallback (bottom)", Vector2(16, 300))
	_label(game, "鍛冶屋の髙橋", Vector2(16, 322))
	_label(with_fb, "鍛冶屋の髙橋", Vector2(16, 370))
	await process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://out_cjk.png")
	var f := FileAccess.open("res://out_info.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(info, " "))
	f.close()
	print("DONE ", Engine.get_version_info()["string"])
	quit(0)
