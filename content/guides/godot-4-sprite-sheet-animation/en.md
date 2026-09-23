To animate a sprite sheet in Godot 4, add an **AnimatedSprite2D**, create a **New SpriteFrames** in its **Sprite Frames** property, and click **Add Frames from Sprite Sheet** in the SpriteFrames panel. In the **Select Frames** dialog, set the grid (**Horizontal**/**Vertical** frame counts, or **Size**, **Separation** and **Offset** in pixels), click the frames in play order, and press **Add N Frame(s)**. Then set the animation's FPS, looping and autoplay, and start it from code with `$AnimatedSprite2D.play("run")`.

Everything below was checked in Godot 4.7.2 with the gl_compatibility renderer. The test sheets are CC0: sebshady's samurai sheet (288×480 px, 6×10 frames of 48 px) and Kenney's Pixel Platformer characters (224×74 px, 24 px frames with a 1 px gap).

## Import a sprite sheet and animate it {#steps}

:::steps
1. **Make pixel art sharp first.** Open **Project → Project Settings**, go to **Rendering → Textures → Canvas Textures** and set **Default Texture Filter** to **Nearest**. Without this, Godot draws pixel art with Linear filtering and it looks soft. The default PNG import settings (**Compress Mode** Lossless, no mipmaps) are already right for 2D.
2. **Create the node and its SpriteFrames.** Add an **AnimatedSprite2D** to your scene. In the Inspector, click the empty **Sprite Frames** property and choose **New SpriteFrames**, then click the new resource to open the **SpriteFrames** panel at the bottom of the editor.
3. **Open the sheet.** In the **Animation Frames** toolbar, click **Add Frames from Sprite Sheet** (Ctrl+Shift+O) and pick the PNG. The **Select Frames** dialog opens with a 4×4 grid.
4. **Set the grid.** In the settings on the right, either type the frame counts in **Horizontal** and **Vertical**, or type the frame **Size** in pixels. Add **Separation** if the sheet has gaps between frames and **Offset** if it has a margin before the first frame. Check that every line sits exactly between two frames.
5. **Select the frames in play order.** Click frames one by one, or drag across them; Shift+click selects a range. The number on each frame is the order it will be added in. With **Frame Order** left on **As Selected** that is your click order; choose **Left to Right, Top to Bottom** to ignore the click order. Click **Add N Frame(s)**.
6. **Name the animation and set its timing.** In the **Animations** list, rename `default` (for example `run`), type the speed in the **FPS** field and click **Animation Looping** until it shows the mode you want: loop, ping-pong (new in Godot 4.7) or off for one-shot animations such as `attack`. To give one frame more time, select it and raise **Frame Duration** (2.0 = twice as long). Repeat steps 3–6 for each animation, with **Add Animation** (Ctrl+N).
7. **Play it.** Toggle **Autoplay on Load** on the animation that should start by itself, or call `play()` from a script (see [Playing animations from code](#code)). Press F5/F6 and check the animation in the running game.
:::

![Nine Kenney characters cut from the same sheet: the top row with Separation 0, where each frame drifts 1 px further, and the bottom row with Separation 1, where every frame is centered](shot:engine-godot-spritesheet-separation "Rendered by Godot 4.7.2 (gl_compatibility), AnimatedSprite2D at 4× with Nearest. Top: 24×24 frames with Separation 0, the grid Auto Slice produces. Bottom: Separation 1, correct for this sheet. Art: Kenney, CC0.")

## The Select Frames dialog, field by field {#select-frames-dialog}

The dialog cuts one **AtlasTexture** per selected cell. Its region is `Offset + (column, row) × (Size + Separation)`, with the width and height of **Size**. Each field changes the others:

| Field | What it is | What it changes |
|---|---|---|
| **Horizontal**, **Vertical** | Number of frames per row and per column | **Size** is recomputed: (sheet − Offset − gaps) ÷ count, rounded down |
| **Size** | One frame in pixels | The frame counts are recomputed from the sheet size |
| **Separation** | Gap between two frames, in pixels | Keeps whichever of counts or Size you typed last |
| **Offset** | Margin before the first frame, in pixels | Same as Separation |
| **Auto Slice** (Godot 4.4+) | Guesses the counts from empty rows and columns | Sets **Separation** and **Offset** to 0 |

Three behaviours cause most wrong cuts:

- **The 4×4 reset.** When you open a sheet whose pixel size differs from the last one, the dialog goes back to 4×4 with no separation or offset. It only keeps your previous values when the new sheet has the same size.
- **Auto Slice ignores gaps.** It counts the runs of non-empty columns and rows, divides the sheet by those counts and sets Separation to 0. On Kenney's sheet it finds 9×3 frames of 24 px, but every frame then drifts 1 px further right, as in the top row of the image above. If the art touches the next cell or has empty rows inside a frame, the counts are wrong too: on the samurai sheet it guesses 6×6 frames of 48×80 px instead of 6×10 frames of 48×48. Always check its result against the grid lines.
- **Margins break the count fields.** If the sheet has a border around all the frames, set **Offset** first, then **Size**. The counts only subtract the offset before the first frame, not the border after the last one.

## Timing: FPS, frame duration and speed_scale {#timing}

A SpriteFrames animation has one **FPS** value (new animations start at 5 FPS with looping on), a loop mode (`LOOP_NONE`, `LOOP_LINEAR` or, since Godot 4.7, `LOOP_PINGPONG` via `set_animation_loop_mode()`) and a *relative* **Frame Duration** per frame (default 1.0). Godot shows a frame for:

```text
seconds = frame_duration / (FPS × abs(speed_scale × custom_speed))
```

At 12 FPS, a frame with duration 2.0 lasts 2 ÷ 12 ≈ 0.167 s. To convert per-frame milliseconds from Aseprite or an asset pack's notes, use `duration = ms × FPS ÷ 1000`. For example, 250 ms at 12 FPS is 3.0. `speed_scale` on the node scales every animation (2.0 plays twice as fast), and `play("run", 1.5)` scales one play call through `custom_speed`.

In a fixed-60 fps test run, a frame with duration 3.0 at 10 FPS stayed on screen for 18 ticks (0.3 s), and `speed_scale = 2.0` halved that.

## Playing animations from code {#code}

`play()` does not restart an animation that is already playing, so you can call it every physics frame. `animation_finished` fires only for animations with looping off.

```gdscript
# player.gd - on a CharacterBody2D with an AnimatedSprite2D child
extends CharacterBody2D

const SPEED := 120.0
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
var attacking := false

func _physics_process(_delta: float) -> void:
	var dir := Input.get_axis("ui_left", "ui_right")
	velocity.x = dir * SPEED
	move_and_slide()
	if attacking:
		return
	if dir != 0.0:
		sprite.flip_h = dir < 0.0
		sprite.play("run")   # already playing "run"? Then nothing restarts.
	else:
		sprite.play("idle")

func attack() -> void:
	attacking = true
	sprite.play("attack")   # "attack" has looping off
	await sprite.animation_finished
	attacking = false
```

Other useful members: `play_backwards()`, `pause()` (keeps the frame and progress), `stop()` (back to frame 0), `frame`, `frame_progress`, `set_frame_and_progress()` to switch animations without losing the step, and the signals `frame_changed` and `animation_looped`.

## Building SpriteFrames from code {#spriteframes-from-code}

For big sheets or sheets you re-export often, build the resource with the same formula as the dialog. Save it once with `ResourceSaver.save(frames, "res://hero_frames.tres")`, or build it at runtime:

```gdscript
# sheet_frames.gd - build SpriteFrames from a grid sprite sheet in code.
# Same math as the editor's "Add Frames from Sprite Sheet" dialog:
# region = offset + cell_index * (frame_size + separation)
class_name SheetFrames
extends RefCounted

static func add_animation(frames: SpriteFrames, anim: StringName, sheet: Texture2D,
		frame_size: Vector2i, cells: Array[Vector2i], fps := 10.0, loop := true,
		separation := Vector2i.ZERO, offset := Vector2i.ZERO, durations: Array[float] = []) -> void:
	if frames.has_animation(anim):
		frames.remove_animation(anim)
	frames.add_animation(anim)
	frames.set_animation_speed(anim, fps)
	frames.set_animation_loop(anim, loop)
	for i in cells.size():
		var atlas := AtlasTexture.new()
		atlas.atlas = sheet
		atlas.region = Rect2(offset + cells[i] * (frame_size + separation), frame_size)
		# Relative duration: 1.0 = one tick of `fps`, 2.0 = shown twice as long.
		var duration := durations[i] if i < durations.size() else 1.0
		frames.add_frame(anim, atlas, duration)
```

For example, `SheetFrames.add_animation(frames, &"run", load("res://samurai.png"), Vector2i(48, 48), [Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2)], 12.0)` adds the first three frames of the samurai sheet's third row. A new `SpriteFrames` already contains an empty `default` animation, so remove it if you don't use it.

## AnimatedSprite2D or Sprite2D + AnimationPlayer? {#which-node}

| | AnimatedSprite2D + SpriteFrames | Sprite2D + AnimationPlayer |
|---|---|---|
| Set-up | The dialog above; one resource per character | **Hframes**/**Vframes** on the Sprite2D, then key **Frame** on a timeline |
| Timing | FPS plus relative per-frame duration | Key times in seconds |
| Other properties in the same animation | No | Yes: hitboxes, sounds, method calls, offset |
| Frames of different sizes or several sheets | Yes (each frame is its own texture) | One sheet per Sprite2D, uniform grid |

Use AnimatedSprite2D for simple character loops. Use AnimationPlayer when an animation has to move other things on exact frames, such as enabling a hitbox on the third frame of an attack (see [hitboxes and pivots](guide:hitboxes-pivots-2d-animation)). For the AnimationPlayer route, set **Hframes** 6 and **Vframes** 10 for the samurai sheet, then key **Frame** at 0.0, 0.1, 0.2 s… **Frame Coords** (column, row) sets the same thing by grid position. When you key **Frame** from the Inspector, Godot creates a **Discrete** track. Keep it that way: on a **Continuous** track the integer is interpolated, so it switched to the next frame at 0.06 s instead of at 0.1 s in our test.

## Common mistakes {#common-mistakes}

- **Blurry frames.** The node inherits the project's Linear filter. Set the project default to Nearest (step 1), or set **CanvasItem → Texture → Filter** to **Nearest** on the node. More in [Godot 4 pixel art blurry or jittering](guide:godot-4-pixel-art-blurry-jitter).
- **Every frame shifted by a growing amount.** The sheet has gaps and **Separation** is 0 (the image above), or it has a margin and **Offset** is 0.
- **One frame too many or too few (off by one).** A trailing empty cell or border makes the counts round the size down. Type **Size** instead of the counts, then only select cells that hold art.
- **Frames in the wrong order.** Frames are added in the order you clicked. Use **Select None**, then click again, or choose a **Frame Order**.
- **The character "swims" or jitters in place.** The art is not in the same spot in every cell, so the cells need aligning, or a trimmed atlas lost its offsets. AnimatedSprite2D has a single **Offset** for all frames. See [pivots and hitboxes](guide:hitboxes-pivots-2d-animation).
- **`animation_finished` never fires.** The animation still loops (or ping-pongs). Set **Animation Looping** to off.
- **Autoplay set from a script does nothing.** `autoplay` is read when the node enters the tree; setting it later only prints a warning. Call `play()` instead.
- **Autoplay seems ignored.** **Autoplay on Load** starts the animation when the scene runs, not in the 2D editor view. Use the panel's play buttons to preview it there.

:::nerulio ws=sprite
The Studio's Sprite workspace does the slicing and timing for you, in the browser, and exports a SpriteFrames resource Godot loads as is. It finds the grid with its gaps and margin and shows how sure it is (Kenney's sheet: **Grid 24×24 s1**, high confidence). A sheet stores no timing, so that choice is marked low confidence until you set it.

- Drop the sheet, check the **Slicing** and **Animations** decisions (one animation per row by default), and press **Apply**.
- Rename the tags on the timeline and type durations in milliseconds, per frame or for a selection.
- Open **Pack & Export**, pick **Godot 4** and press **Export for Godot 4**. The bundle holds a `.tres` SpriteFrames with your ms converted to FPS and relative durations, a `.tscn` with an AnimatedSprite2D set to Nearest, and `.png.import` files (Lossless, no mipmaps). It was loaded and drawn by Godot 4.7.2.
- Limits: AnimatedSprite2D has one offset per node, so the scene uses the first frame's pivot (every pivot is kept in the resource's metadata). The Godot preset never rotates frames, and Godot 3 cannot read the files.
:::

![The Studio's Sprite workspace after dropping the samurai sheet: 60 numbered frames on a 48×48 grid, with the slicing decision at 87% confidence and alternatives](shot:studio-sprite-import "Nerulio Studio: the Import panel lists each automatic decision with its confidence and one-click alternatives before anything is cut.")

## FAQ {#faq}

### Why does Godot's sprite sheet dialog always start at 4×4?

The **Select Frames** dialog resets to 4×4, with Separation and Offset at 0, whenever the new sheet's pixel size differs from the previous one. It does not store grid settings per image. Type **Size** and **Separation** for each new sheet, or try **Auto Slice** (Godot 4.4+) and check its result.

### How do I set a different duration for one frame in Godot 4?

Select the frame in the SpriteFrames panel and change **Frame Duration**. It is relative: 2.0 shows the frame twice as long as a 1.0 frame at the animation's FPS. To convert milliseconds, use `duration = ms × FPS ÷ 1000`.

### Should I use AnimatedSprite2D or AnimationPlayer for sprite animation?

AnimatedSprite2D is quicker for plain loops such as idle, run and jump. Use Sprite2D with AnimationPlayer when the same timeline must also key hitboxes, sounds, offsets or method calls on exact frames.

### Why are my frames blurry after slicing?

Filtering is set on the node, not on the sheet. The project default is Linear, so set **Rendering → Textures → Canvas Textures → Default Texture Filter** to **Nearest**, or set the node's **Texture → Filter** to Nearest.

### Can Godot 4 open Aseprite files for animation directly?

No. Godot has no built-in `.aseprite` importer. Use a plugin that calls the Aseprite command line, export a PNG sheet and JSON from Aseprite, or convert the file in the browser. See [Aseprite files in Godot, Unity and Phaser](guide:aseprite-files-godot-unity-phaser).

## Sources {#sources}

- [2D sprite animation](https://docs.godotengine.org/en/4.7/tutorials/2d/2d_sprite_animation.html) — Godot 4.7 manual
- [AnimatedSprite2D](https://docs.godotengine.org/en/4.7/classes/class_animatedsprite2d.html) — Godot 4.7 class reference
- [SpriteFrames](https://docs.godotengine.org/en/4.7/classes/class_spriteframes.html) — Godot 4.7 class reference (relative frame duration)
- [Sprite2D](https://docs.godotengine.org/en/4.7/classes/class_sprite2d.html) — Godot 4.7 class reference (hframes, vframes, frame_coords)
- [Animation](https://docs.godotengine.org/en/4.7/classes/class_animation.html) — Godot 4.7 class reference (value track update modes)
- [ProjectSettings: default_texture_filter](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html#class-projectsettings-property-rendering-textures-canvas-textures-default-texture-filter) — Godot 4.7
- [Importing images](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html) — Godot 4.7 manual
- [sprite_frames_editor_plugin.cpp at 4.7.2-stable](https://github.com/godotengine/godot/blob/4.7.2-stable/editor/scene/sprite_frames_editor_plugin.cpp) — source of the Select Frames dialog (4×4 reset, Auto Slice, Frame Order)
