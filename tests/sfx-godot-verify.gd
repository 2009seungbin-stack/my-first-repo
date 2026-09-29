extends SceneTree

func _initialize() -> void:
	call_deferred("_verify")

func _verify() -> void:
	var failed: Array[String] = []
	for rate in [44100, 48000]:
		for suffix in ["-16.wav", "-24.wav", ".ogg", ".mp3"]:
			var path := "res://audio/coin-%s%s" % [rate, suffix]
			var stream := load(path) as AudioStream
			if stream == null or stream.get_length() <= 0.0:
				failed.append("import: " + path)
				continue
			var player := AudioStreamPlayer.new()
			root.add_child(player)
			player.stream = stream
			player.play()
			if not player.playing or player.get_stream_playback() == null:
				failed.append("play: " + path)
			print("SFX_GODOT_OK ", path, " length=", stream.get_length())
			player.free()
	if failed.is_empty():
		print("SFX_GODOT_ALL_8_PASS")
		quit(0)
	else:
		for item in failed:
			printerr("SFX_GODOT_FAIL ", item)
		quit(1)
